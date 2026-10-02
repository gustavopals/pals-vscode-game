import { balance, DIFFICULTY_IDS } from '@lotg/content';
import type {
  Command as EngineCommand,
  GameEvent as EngineEvent,
  RejectionCode as EngineRejectionCode,
  ViewState as EngineViewState,
} from '@lotg/engine';
import { advanceTo, applyCommand, createInitialState, deriveViewState } from '@lotg/engine';
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  API_ERROR_CODES,
  API_ERROR_STATUS,
  ApiErrorSchema,
  canonicalJson,
  CatalogResponseSchema,
  type Command,
  CommandAcceptedSchema,
  CommandSchema,
  CreateGameRequestSchema,
  DeleteMeResponseSchema,
  EventsQuerySchema,
  GithubDevicePollRequestSchema,
  GithubDevicePollResponseSchema,
  GithubDeviceStartResponseSchema,
  ReturnReportSchema,
  type GameEvent,
  GameRuleErrorSchema,
  GithubAuthResponseSchema,
  PROTOCOL_VERSION,
  type RejectionCode,
  StateVersionSchema,
  type ViewState,
  ViewResponseSchema,
  ViewStateSchema,
} from './index';

const uuid = '0b2f7d0e-6f0a-4c35-9f43-6f5a0c1d2e3f';

describe('equivalência de tipos com o motor', () => {
  // Estes testes falham na checagem de tipos (`pnpm typecheck`) se um contrato divergir.
  it('Command é idêntico ao do motor', () => {
    expectTypeOf<Command>().toEqualTypeOf<EngineCommand>();
  });

  it('ViewState é idêntico ao do motor', () => {
    expectTypeOf<ViewState>().toEqualTypeOf<EngineViewState>();
  });

  it('os códigos de recusa são os do motor', () => {
    expectTypeOf<RejectionCode>().toEqualTypeOf<EngineRejectionCode>();
  });

  it('o evento da API é o do motor mais a sequência e o instante real', () => {
    expectTypeOf<Omit<GameEvent, 'seq' | 'at'>>().toEqualTypeOf<EngineEvent>();
  });
});

describe('CommandSchema', () => {
  const valid: Command[] = [
    { commandId: uuid, type: 'setWorkers', payload: { building: 'farm', count: 2 } },
    { commandId: uuid, type: 'startConstruction', payload: { building: 'townHall' } },
    { commandId: uuid, type: 'cancelConstruction', payload: { building: 'housing' } },
    { commandId: uuid, type: 'planConstruction', payload: { building: 'quarry' } },
    { commandId: uuid, type: 'unplanConstruction', payload: { building: 'quarry' } },
    { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 3 } },
    { commandId: uuid, type: 'renameSettlement', payload: { name: 'Vau Alto' } },
  ];

  it.each(valid)('aceita $type', (command) => {
    expect(CommandSchema.parse(command)).toEqual(command);
  });

  it('deixa as faixas de regra para o motor', () => {
    // 9 aldeões é forma válida; quem recusa, com frase em português, é o motor.
    const order = { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 9 } };
    expect(CommandSchema.safeParse(order).success).toBe(true);
  });

  it.each([
    [
      'commandId que não é UUID',
      { commandId: 'abc', type: 'recruitVillagers', payload: { quantity: 1 } },
    ],
    ['tipo desconhecido', { commandId: uuid, type: 'declareWar', payload: {} }],
    [
      'edifício inexistente',
      { commandId: uuid, type: 'startConstruction', payload: { building: 'keep' } },
    ],
    [
      'trabalhadores em edifício não produtivo',
      { commandId: uuid, type: 'setWorkers', payload: { building: 'housing', count: 1 } },
    ],
    [
      'quantidade fracionária',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1.5 } },
    ],
    [
      'campo a mais no payload',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1, free: true } },
    ],
    [
      'campo a mais no comando',
      { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1 }, at: 5 },
    ],
    ['sem payload', { commandId: uuid, type: 'recruitVillagers' }],
  ])('recusa %s', (_, command) => {
    expect(CommandSchema.safeParse(command).success).toBe(false);
  });
});

describe('ViewStateSchema', () => {
  const settings = {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord' as const,
    timeScale: 1,
  };

  it('aceita o que o motor produz, do estado inicial a uma semana de jogo', () => {
    let state = createInitialState('pedra-alta', settings);
    expect(ViewStateSchema.safeParse(deriveViewState(state, 0)).error).toBeUndefined();
    const started = applyCommand(
      state,
      { commandId: uuid, type: 'startConstruction', payload: { building: 'farm' } },
      0,
    );
    if (started.ok) {
      state = started.state;
    }
    for (const hour of [1, 40, 168]) {
      state = advanceTo(state, hour * 3_600_000).state;
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(ViewStateSchema.safeParse(view).error).toBeUndefined();
    }
  });

  it('recusa campos a mais: o cliente nunca recebe o que não está no contrato', () => {
    const view = deriveViewState(createInitialState('s', settings), 0);
    expect(ViewStateSchema.safeParse({ ...view, enemyComposition: [] }).success).toBe(false);
  });
});

describe('contratos da API', () => {
  const view = deriveViewState(
    createInitialState('s', {
      settlementName: 'Pedra Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 1,
    }),
    0,
  );
  const event = {
    seq: 1,
    type: 'dayStarted',
    at: '2026-10-01T12:00:00.000Z',
    atMs: 7_200_000,
    text: 'Amanhece o 2º dia da Primavera em Pedra Alta.',
    data: { dayOfYear: 2 },
  };

  it('stateVersion é uma string decimal positiva', () => {
    expect(StateVersionSchema.safeParse('1').success).toBe(true);
    expect(StateVersionSchema.safeParse('9007199254740993').success).toBe(true);
    for (const bad of ['0', '01', '-1', '1.5', '', 1]) {
      expect(StateVersionSchema.safeParse(bad).success).toBe(false);
    }
  });

  it('/view responde { view, stateVersion }', () => {
    expect(ViewResponseSchema.safeParse({ view, stateVersion: '3' }).success).toBe(true);
    expect(ViewResponseSchema.safeParse({ view, stateVersion: 3 }).success).toBe(false);
  });

  it('comando aceito responde { view, events, stateVersion, staleView }', () => {
    const body = { view, events: [event], stateVersion: '2', staleView: false };
    expect(CommandAcceptedSchema.safeParse(body).error).toBeUndefined();
  });

  it('recusa do motor é GAME_RULE com o estado avançado nos detalhes', () => {
    const body = {
      code: 'GAME_RULE',
      message: 'Faltam 30 madeira e 35 pedra.',
      details: {
        code: 'INSUFFICIENT_RESOURCES',
        message: 'Faltam 30 madeira e 35 pedra.',
        view,
        events: [event],
        stateVersion: '2',
        staleView: true,
      },
    };
    expect(GameRuleErrorSchema.safeParse(body).error).toBeUndefined();
    expect(ApiErrorSchema.safeParse(body).success).toBe(true);
  });

  it('exclusão responde deletedAt e purgeAfter em UTC ISO 8601', () => {
    const ok = { deletedAt: '2026-10-01T12:00:00.000Z', purgeAfter: '2026-10-08T12:00:00.000Z' };
    expect(DeleteMeResponseSchema.safeParse(ok).success).toBe(true);
    const local = { ...ok, deletedAt: '2026-10-01T09:00:00-03:00' };
    expect(DeleteMeResponseSchema.safeParse(local).success).toBe(false);
  });

  it('criação de partida valida nome, fuso e Hora da Vigília', () => {
    const body = {
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
    };
    expect(CreateGameRequestSchema.safeParse(body).success).toBe(true);
    expect(CreateGameRequestSchema.safeParse({ ...body, timezone: 'Marte/Olimpo' }).success).toBe(
      false,
    );
    expect(CreateGameRequestSchema.safeParse({ ...body, vigilHourLocal: 24 }).success).toBe(false);
    expect(CreateGameRequestSchema.safeParse({ ...body, settlementName: 'A' }).success).toBe(false);
  });

  it('criação de partida: a dificuldade é uma das três do conteúdo, ou nenhuma', () => {
    const body = { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 };
    for (const difficulty of DIFFICULTY_IDS) {
      expect(CreateGameRequestSchema.safeParse({ ...body, difficulty }).data?.difficulty).toBe(
        difficulty,
      );
    }
    expect(CreateGameRequestSchema.safeParse(body).data).not.toHaveProperty('difficulty');
    for (const difficulty of ['normal', 'Lord', 'LORD', '', null, 1, ['lord']]) {
      expect(CreateGameRequestSchema.safeParse({ ...body, difficulty }).success).toBe(false);
    }
  });

  it('criação de partida: o ritmo é um dos oferecidos pelo conteúdo, ou nenhum', () => {
    const body = { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 };
    expect(balance.paces.map((pace) => pace.timeScale)).toEqual([3, 1, 0.5]);
    for (const { timeScale } of balance.paces) {
      expect(CreateGameRequestSchema.safeParse({ ...body, timeScale }).data?.timeScale).toBe(
        timeScale,
      );
    }
    expect(CreateGameRequestSchema.safeParse(body).data).not.toHaveProperty('timeScale');
    // O 2× saiu da lista (ADR 0013, decisão 2); 7 é um GAME_TIME_SCALE válido, mas não é oferecido.
    for (const timeScale of [2, 7, 0, -1, 0.25, 3.0001, '3', null, Number.NaN, [3]]) {
      expect(CreateGameRequestSchema.safeParse({ ...body, timeScale }).success).toBe(false);
    }
  });

  it('/catalog responde as opções de nova partida, com os padrões entre elas', () => {
    const catalog = {
      contentHash: '0123456789abcdef',
      newGame: {
        difficulties: DIFFICULTY_IDS.map((id) => ({
          id,
          label: balance.difficulties[id].label,
          description: balance.difficulties[id].description,
          recommended: balance.difficulties[id].recommended,
        })),
        paces: balance.paces.map(({ timeScale, label, description, hint, recommended }) => ({
          timeScale,
          label,
          description,
          hint,
          recommended,
        })),
        defaults: { difficulty: 'lord', timeScale: 3 },
      },
    };
    expect(CatalogResponseSchema.safeParse(catalog).error).toBeUndefined();

    const { newGame } = catalog;
    const withNewGame = (change: object) => ({ ...catalog, newGame: { ...newGame, ...change } });
    // Um padrão que não está entre as opções deixaria as boas-vindas sem nada marcado.
    for (const defaults of [
      { difficulty: 'lord', timeScale: 2 },
      { difficulty: 'normal', timeScale: 3 },
      { difficulty: 'lord' },
    ]) {
      expect(CatalogResponseSchema.safeParse(withNewGame({ defaults })).success).toBe(false);
    }
    expect(CatalogResponseSchema.safeParse(withNewGame({ paces: [] })).success).toBe(false);
    expect(CatalogResponseSchema.safeParse(withNewGame({ difficulties: [] })).success).toBe(false);
    // Nenhum fator de regra sai no catálogo: só o que as boas-vindas mostram.
    const leaking = newGame.difficulties.map((entry) => ({ ...entry, storageCapacity: 1 }));
    expect(CatalogResponseSchema.safeParse(withNewGame({ difficulties: leaking })).success).toBe(
      false,
    );
  });

  it('a resposta do GitHub traz os tokens só quando nasce uma sessão', () => {
    const account = {
      id: uuid,
      displayName: 'Gustavo',
      linked: { github: true },
      hasRecoveryCode: false,
      createdAt: '2026-10-01T12:00:00.000Z',
    };
    expect(GithubAuthResponseSchema.safeParse({ account }).success).toBe(true);
    const tokens = { accessToken: 'a', refreshToken: 'r', expiresIn: 900 };
    expect(GithubAuthResponseSchema.safeParse({ account, ...tokens }).success).toBe(true);
  });

  it('a consulta de eventos tem padrões e converte texto em número', () => {
    expect(EventsQuerySchema.parse({})).toEqual({ after: 0, limit: 100 });
    expect(EventsQuerySchema.parse({ after: '12', limit: '5' })).toEqual({ after: 12, limit: 5 });
    expect(EventsQuerySchema.safeParse({ after: '-1' }).success).toBe(false);
  });

  it('todo código de erro tem status HTTP', () => {
    expect(Object.keys(API_ERROR_STATUS).sort()).toEqual([...API_ERROR_CODES].sort());
    expect(API_ERROR_STATUS.GAME_RULE).toBe(422);
    expect(API_ERROR_STATUS.COMMAND_ID_CONFLICT).toBe(409);
    expect(API_ERROR_STATUS.SESSION_REVOKED).toBe(401);
    expect(API_ERROR_STATUS.UPGRADE_REQUIRED).toBe(426);
    expect(PROTOCOL_VERSION).toBe(1);
  });
});

describe('Relatório de Retorno e device flow', () => {
  it('o relatório tem estoques, contagens, fome e destaques', () => {
    const report = {
      awaySeconds: 18_000,
      resources: [{ id: 'food', label: 'Comida', before: 180, after: 240, delta: 60 }],
      counts: {
        daysPassed: 2,
        constructionsFinished: 1,
        villagersArrived: 3,
        objectivesCompleted: 1,
      },
      famine: 'none',
      highlights: ['No 1º dia da Primavera, os pedreiros ergueram as Habitações ao 2º nível.'],
    };
    expect(ReturnReportSchema.safeParse(report).error).toBeUndefined();
    expect(ReturnReportSchema.safeParse({ ...report, famine: 'talvez' }).success).toBe(false);
    expect(ReturnReportSchema.safeParse({ ...report, extra: 1 }).success).toBe(false);
  });

  it('a consulta do device flow tem cinco desfechos e nada além deles', () => {
    const accepted = [
      { status: 'authorized', githubAccessToken: 'gho_x' },
      { status: 'pending' },
      { status: 'slowDown', intervalSeconds: 10 },
      { status: 'expired' },
      { status: 'denied' },
    ];
    for (const body of accepted) {
      expect(GithubDevicePollResponseSchema.safeParse(body).error).toBeUndefined();
    }
    for (const body of [
      { status: 'authorized' },
      { status: 'pending', githubAccessToken: 'gho_x' },
      { status: 'slowDown' },
      { status: 'error' },
    ]) {
      expect(GithubDevicePollResponseSchema.safeParse(body).success).toBe(false);
    }
    expect(
      GithubDeviceStartResponseSchema.safeParse({
        deviceCode: 'd',
        userCode: 'WDJB-MJHT',
        verificationUri: 'https://github.com/login/device',
        expiresInSeconds: 900,
        intervalSeconds: 5,
      }).error,
    ).toBeUndefined();
    expect(GithubDevicePollRequestSchema.safeParse({ deviceCode: '' }).success).toBe(false);
  });
});

describe('canonicalJson', () => {
  it('ordena as chaves recursivamente e preserva a ordem dos arrays', () => {
    const a = {
      type: 'setWorkers',
      payload: { count: 2, building: 'farm' },
      list: [3, 1, { b: 1, a: 2 }],
    };
    const b = {
      list: [3, 1, { a: 2, b: 1 }],
      payload: { building: 'farm', count: 2 },
      type: 'setWorkers',
    };
    expect(canonicalJson(a)).toBe(canonicalJson(b));
    expect(canonicalJson(a)).toBe(
      '{"list":[3,1,{"a":2,"b":1}],"payload":{"building":"farm","count":2},"type":"setWorkers"}',
    );
    expect(canonicalJson({ list: [1, 3] })).not.toBe(canonicalJson({ list: [3, 1] }));
    expect(canonicalJson(null)).toBe('null');
  });
});
