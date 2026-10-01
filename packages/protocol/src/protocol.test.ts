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
  type Command,
  CommandAcceptedSchema,
  CommandSchema,
  CreateGameRequestSchema,
  DeleteMeResponseSchema,
  EventsQuerySchema,
  ExtensionToWebviewSchema,
  type GameEvent,
  GameRuleErrorSchema,
  GithubAuthResponseSchema,
  PROTOCOL_VERSION,
  type RejectionCode,
  StateVersionSchema,
  type ViewState,
  ViewResponseSchema,
  ViewStateSchema,
  WebviewToExtensionSchema,
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
    capsEnabled: false as const,
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
      capsEnabled: false,
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
    expect(CreateGameRequestSchema.safeParse({ ...body, difficulty: 'ironKing' }).success).toBe(
      false,
    );
    expect(CreateGameRequestSchema.safeParse({ ...body, timeScale: 2 }).success).toBe(false);
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

describe('mensagens da Webview', () => {
  it('a Webview só manda comandos e navegação', () => {
    const order = { commandId: uuid, type: 'recruitVillagers', payload: { quantity: 1 } };
    expect(WebviewToExtensionSchema.safeParse({ type: 'command', command: order }).success).toBe(
      true,
    );
    expect(WebviewToExtensionSchema.safeParse({ type: 'navigate', route: 'fief' }).success).toBe(
      true,
    );
    expect(WebviewToExtensionSchema.safeParse({ type: 'fetch', url: 'https://x' }).success).toBe(
      false,
    );
  });

  it('a extensão manda view, erro, conexão e navegação', () => {
    expect(ExtensionToWebviewSchema.safeParse({ type: 'connection', online: false }).success).toBe(
      true,
    );
    const failure = { type: 'error', code: 'GAME_RULE', message: 'Faltam 15 pedra.' };
    expect(ExtensionToWebviewSchema.safeParse(failure).success).toBe(true);
    expect(ExtensionToWebviewSchema.safeParse({ type: 'navigate', route: 'map' }).success).toBe(
      false,
    );
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
