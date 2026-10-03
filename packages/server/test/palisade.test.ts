import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createInitialState, type GameState } from '@lotg/engine';
import type {
  ChronicleResponse,
  CommandAccepted,
  EventsResponse,
  GameEvent,
  GameRuleError,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// A Paliçada (V2E-T2; GDD §6.1 e §8.2; ADR 0014, decisão 11) e a cadeia "A Promessa da Paliçada"
// vistas pela API: a obra passa pelo recibo como qualquer outra, a visão diz o que ela segura
// com ou sem Torre, e a promessa feita no Conselho é conferida pela obra, com o senhor presente
// ou ausente. O desfecho de uma incursão contra ela é da incursão de lobos (V2E-T3).

const PACE = 3;
/** Um dia de jogo, em tempo de jogo. */
const GAME_DAY = 2 * HOUR;
const REPLAYED = 'x-lords-replayed';
const NV1 =
  'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.';

/** Instância no ritmo Normal do GDD. */
let normal: TestApp;
/** Instância no ritmo Rápido: a hora real vale três de jogo. */
let fast: TestApp;

beforeAll(async () => {
  await resetTestDb();
  normal = await createTestApp({ config: { GAME_TIME_SCALE: '1' } });
  fast = await createTestApp({ config: { GAME_TIME_SCALE: String(PACE) } });
});
afterAll(async () => {
  await normal.close();
  await fast.close();
});

type Session = { token: string; refreshToken: string };

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, who: Session, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, who);
}

async function viewOf(server: TestApp, who: Session, gameId: string): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(server: TestApp, who: Session, gameId: string): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events?limit=500`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.events;
}

async function chronicleOf(server: TestApp, who: Session, gameId: string): Promise<string[]> {
  const reply = await call<ChronicleResponse>(server, 'GET', `/games/${gameId}/chronicle`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.entries.map((entry) => entry.text);
}

async function storedState(server: TestApp, gameId: string) {
  const { rows } = await server.pool.query<{ schema_version: number; state: GameState }>(
    'select schema_version, state from games where id = $1',
    [gameId],
  );
  const [row] = rows;
  if (row === undefined) {
    throw new Error('A partida do teste não está no banco.');
  }
  return row;
}

/** Grava uma partida com o estado dado, com o relógio de jogo onde ele parou. */
async function insertGame(
  server: TestApp,
  state: { schemaVersion: number; seed: string; lastProcessedAt: number },
  timeScale: number,
) {
  const auth = await signUp(server, 'Senhor da Cerca');
  const now = server.clock.now().getTime();
  const id = randomUUID();
  await server.pool.query(
    `insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                        schema_version, state, state_version, last_processed_at, created_at, updated_at)
     values ($1, $2, 'active', $3, 'lord', $4, 'America/Sao_Paulo', 20, $5, $6::jsonb, 7, $7, $8, $7)`,
    [
      id,
      auth.account.id,
      state.seed,
      String(timeScale),
      state.schemaVersion,
      JSON.stringify(state),
      new Date(now),
      // Para baixo: o relógio de jogo nunca fica atrás do estado.
      new Date(now - Math.floor(state.lastProcessedAt / timeScale)),
    ],
  );
  return { id, token: auth.accessToken, refreshToken: auth.refreshToken };
}

/**
 * Um feudo novo com o Salão no nível 3, o Armazém erguido, gente na Fazenda e o estoque para os
 * dois níveis da Paliçada: só falta dar a ordem. O Conselho fica calado (a primeira audiência é
 * para daqui a mil anos de jogo), para o sorteio não pôr outra carta na mesa no meio do teste.
 */
function readyForPalisade(seed: string, timeScale: number): GameState {
  const state = createInitialState(seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale,
  });
  state.settlement.buildings.townHall = 3;
  state.settlement.buildings.warehouse = 1;
  state.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
  state.settlement.resources = { food: 400_000, wood: 800_000, stone: 450_000, gold: 300_000 };
  state.council.nextDrawAtMs = 1000 * 84 * GAME_DAY;
  return state;
}

/** O mesmo feudo com "Os aldeões perguntam pela cerca" na mesa, como o sorteio a teria posto. */
function withPlea(seed: string, timeScale: number): GameState {
  const state = readyForPalisade(seed, timeScale);
  state.council.pending = [
    {
      instanceId: 'palisadePromisePlea-1',
      cardId: 'palisadePromisePlea',
      drawnAtMs: 0,
      expiresAtMs: 24 * HOUR * timeScale,
      origin: null,
    },
  ];
  state.council.seenThisYear = ['palisadePromisePlea'];
  state.stats.cardsDrawn = 1;
  return state;
}

const stock = (view: ViewState, resource: string) =>
  view.resources.find((row) => row.id === resource)?.stock ?? 0;
const palisade = (view: ViewState) =>
  view.constructions.available.find((entry) => entry.building === 'palisade');
const cardNamed = (view: ViewState, title: string) => {
  const card = view.council.pending.find((entry) => entry.title === title);
  if (card === undefined) {
    throw new Error(`O teste esperava a carta "${title}" na mesa.`);
  }
  return card;
};

describe('a Paliçada como obra, pela API', () => {
  it('aparece na lista presa ao Salão no nível 3, com o que ela segura, e a visão diz que nada protege o feudo', async () => {
    const who = await newPlayer(normal);
    const view = await viewOf(normal, who, who.game.id);
    expect(palisade(view)).toMatchObject({
      label: 'Paliçada',
      fromLevel: 0,
      targetLevel: 1,
      blockedCode: 'GATE_LOCKED',
      blockedReason: 'Melhore antes o Salão do Senhor para o nível 3.',
      effect:
        'Segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    });
    expect(view.threat.defense).toEqual({
      building: 'palisade',
      palisadeLevel: 0,
      text: 'Sem Paliçada, nada segura um ataque.',
      next: NV1,
    });
    const refused = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('startConstruction', { building: 'palisade' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.code).toBe('GATE_LOCKED');
    expect(refused.body.message).toBe('Melhore antes o Salão do Senhor para o nível 3.');
  });

  it('a ordem passa pelo recibo; pronta a Paliçada, a visão diz o que ela segura, mesmo sem Torre', async () => {
    const game = await insertGame(normal, readyForPalisade('cerca-normal', 1), 1);
    const build = order('startConstruction', { building: 'palisade' });
    const first = await send<CommandAccepted>(normal, game.token, game.id, build);
    expect(first.status).toBe(200);
    expect(stock(first.body.view, 'wood')).toBe(600);
    expect(stock(first.body.view, 'stone')).toBe(400);
    expect(first.body.view.threat.defense.palisadeLevel).toBe(0);
    // Reenviar a mesma ordem devolve o recibo: a Paliçada não é paga duas vezes.
    const again = await send<CommandAccepted>(normal, game.token, game.id, build);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(stock(await viewOf(normal, game, game.id), 'stone')).toBe(400);

    // 20 minutos depois ela está de pé. O feudo não tem Torre: a Ameaça continua fechada, e a
    // defesa aparece do mesmo jeito.
    await wait(normal, game, 20 * MINUTE);
    const built = await viewOf(normal, game, game.id);
    expect(built.threat.known).toBe(false);
    expect(built.threat.defense).toEqual({
      building: 'palisade',
      palisadeLevel: 1,
      text: NV1,
      next: 'Paliçada Nv2: passa a segurar também os ataques médios, sem perda nem ferido.',
    });
    expect(palisade(built)).toMatchObject({
      fromLevel: 1,
      targetLevel: 2,
      durationSeconds: 30 * 60,
      effect: 'Passa a segurar também os ataques médios, sem perda nem ferido.',
    });
    expect(await chronicleOf(normal, game, game.id)).toEqual(
      expect.arrayContaining([
        'No 1º dia da Primavera, os pedreiros começaram a levantar a Paliçada em Pedra Alta.',
        'No 1º dia da Primavera, ergueu-se a Paliçada em Pedra Alta.',
      ]),
    );
    const row = await storedState(normal, game.id);
    expect(row.state.settlement.buildings.palisade).toBe(1);
    // Ela não mexe na Ameaça: o número do estado é o de qualquer feudo àquela hora.
    expect(row.state.map.threat).toBe(0);
  });

  it('no ritmo Rápido o prazo sai em tempo real, o nível 2 é o teto, e a recusa diz que a Muralha fica para depois', async () => {
    const game = await insertGame(fast, readyForPalisade('cerca-rapida', PACE), PACE);
    const fresh = await viewOf(fast, game, game.id);
    // 20 min de jogo são 6 min 40 s reais.
    expect(palisade(fresh)).toMatchObject({ durationSeconds: 400, blockedCode: null });
    const build = () =>
      send<CommandAccepted>(
        fast,
        game.token,
        game.id,
        order('startConstruction', { building: 'palisade' }),
      );
    expect((await build()).status).toBe(200);
    await wait(fast, game, 7 * MINUTE);
    expect((await viewOf(fast, game, game.id)).threat.defense.palisadeLevel).toBe(1);
    expect((await build()).status).toBe(200);
    await wait(fast, game, 10 * MINUTE);
    const top = await viewOf(fast, game, game.id);
    expect(palisade(top)).toBeUndefined();
    expect(top.threat.defense).toEqual({
      building: 'palisade',
      palisadeLevel: 2,
      text: 'Paliçada Nv2: segura ataques leves e médios, sem perda nem ferido. A Muralha de Pedra chega em uma versão futura.',
      next: null,
    });
    const refused = await send<GameRuleError>(
      fast,
      game.token,
      game.id,
      order('startConstruction', { building: 'palisade' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.code).toBe('MAX_LEVEL');
    expect(refused.body.message).toBe(
      'A Paliçada já está no nível máximo. A Muralha de Pedra chega em uma versão futura.',
    );
  });

  it('cancelar a obra devolve 80% e deixa o feudo sem Paliçada', async () => {
    const game = await insertGame(normal, readyForPalisade('cerca-desistida', 1), 1);
    await send(normal, game.token, game.id, order('startConstruction', { building: 'palisade' }));
    await wait(normal, game, 5 * MINUTE);
    const before = await viewOf(normal, game, game.id);
    const cancelled = await send<CommandAccepted>(
      normal,
      game.token,
      game.id,
      order('cancelConstruction', { building: 'palisade' }),
    );
    expect(cancelled.status).toBe(200);
    expect(cancelled.body.events.map((event) => event.data)).toEqual([
      { building: 'palisade', level: 0, gained_wood: 160, gained_stone: 40 },
    ]);
    expect(stock(cancelled.body.view, 'stone')).toBe(stock(before, 'stone') + 40);
    await wait(normal, game, HOUR);
    const later = await viewOf(normal, game, game.id);
    expect(later.threat.defense.palisadeLevel).toBe(0);
    expect((await storedState(normal, game.id)).state.settlement.buildings.palisade).toBe(0);
  });
});

describe('"A Promessa da Paliçada", pela API', () => {
  it('prometer, erguer e mostrar no prazo: a opção trancada abre com a obra, e nada é cobrado nem premiado duas vezes', async () => {
    const game = await insertGame(normal, withPlea('promessa-cumprida', 1), 1);
    const first = await viewOf(normal, game, game.id);
    const plea = cardNamed(first, 'Os aldeões perguntam pela cerca');
    expect(plea.options.map((option) => [option.id, option.locked, option.lockedReason])).toEqual([
      ['show', true, 'Requer a Paliçada.'],
      ['explain', false, null],
      ['promise', false, null],
    ]);
    // Mostrar o que não existe é recusado, e a recusa diz o que falta.
    const locked = await send<GameRuleError>(
      normal,
      game.token,
      game.id,
      order('answerCard', { instanceId: plea.instanceId, optionId: 'show' }),
    );
    expect(locked.status).toBe(422);
    expect(locked.body.details.code).toBe('OPTION_LOCKED');
    expect(locked.body.message).toBe(
      'Essa opção ainda está fora do alcance do feudo: requer a Paliçada.',
    );

    const promise = order('answerCard', { instanceId: plea.instanceId, optionId: 'promise' });
    const promised = await send<CommandAccepted>(normal, game.token, game.id, promise);
    expect(promised.status).toBe(200);
    // (Na mesma resposta saem os objetivos que o feudo montado à mão já cumpria.)
    expect(
      promised.body.events
        .filter((event) => event.type.startsWith('card'))
        .map((event) => [event.type, event.text]),
    ).toEqual([
      [
        'cardAnswered',
        'No 1º dia da Primavera, o senhor de Pedra Alta prometeu aos aldeões que logo veriam a paliçada de pé em volta do feudo. Dormiu-se melhor naquela noite.',
      ],
    ]);
    // Duas abas, duplo clique: a mesma ordem devolve o recibo, e a promessa vale uma vez.
    const again = await send<CommandAccepted>(normal, game.token, game.id, promise);
    expect(again.headers[REPLAYED]).toBe('true');
    const after = await viewOf(normal, game, game.id);
    expect(after.morale.effects).toHaveLength(1);
    expect(after.council.pending).toEqual([]);
    // A promessa não ergue nada: a obra é a de sempre.
    expect(after.threat.defense.palisadeLevel).toBe(0);
    // Nada do que a carta guarda sai do servidor: nem flag, nem a cobrança agendada.
    expect(JSON.stringify([promised.body, after])).not.toMatch(
      /palisadePromise\.|flags|scheduled|Deadline|Reckoning/,
    );

    await send(normal, game.token, game.id, order('startConstruction', { building: 'palisade' }));
    // Quatro dias de jogo depois (8 h reais no ritmo Normal), a cobrança, com a obra de pé.
    await wait(normal, game, 4 * GAME_DAY);
    const due = await viewOf(normal, game, game.id);
    const deadline = cardNamed(due, 'O prazo da paliçada');
    expect(deadline).toMatchObject({
      expiresInSeconds: 24 * 3600,
      // Com a Paliçada de pé, até sem resposta a promessa se cumpre.
      defaultOptionId: 'show',
      defaultOptionLabel: 'Mostrar a paliçada erguida',
    });
    expect(deadline.options[0]).toMatchObject({
      id: 'show',
      locked: false,
      lockedReason: null,
      effectsText: '+15 de moral por 3 dias de jogo (6 h)',
    });
    const shown = await send<CommandAccepted>(
      normal,
      game.token,
      game.id,
      order('answerCard', { instanceId: deadline.instanceId, optionId: 'show' }),
    );
    expect(shown.status).toBe(200);
    expect(shown.body.events[0]?.text).toBe(
      'No 5º dia da Primavera, o senhor de Pedra Alta mostrou aos aldeões a paliçada que prometera. Passaram a mão nas estacas, um por um.',
    );
    const row = await storedState(normal, game.id);
    expect(row.state.council.flags).toEqual({ 'palisadePromise.kept': true });
    expect(row.state.council.scheduled).toEqual([]);
    const cards = (await eventsOf(normal, game, game.id)).filter((event) =>
      event.type.startsWith('card'),
    );
    expect(cards.map((event) => [event.type, event.data.cardId, event.data.optionId])).toEqual([
      ['cardAnswered', 'palisadePromisePlea', 'promise'],
      ['cardDrawn', 'palisadePromiseDeadline', undefined],
      ['cardAnswered', 'palisadePromiseDeadline', 'show'],
    ]);
  });

  it('quem promete, ergue a Paliçada e não volta tem a promessa cumprida pelo conselho, e a Crônica conta', async () => {
    const game = await insertGame(fast, withPlea('promessa-ausente', PACE), PACE);
    const plea = cardNamed(await viewOf(fast, game, game.id), 'Os aldeões perguntam pela cerca');
    await send(
      fast,
      game.token,
      game.id,
      order('answerCard', { instanceId: plea.instanceId, optionId: 'promise' }),
    );
    await send(fast, game.token, game.id, order('startConstruction', { building: 'palisade' }));
    // Dois dias reais sem ninguém: a cobrança chega em 2 h 40 min e expira 24 h reais depois.
    await wait(fast, game, 48 * HOUR);
    const view = await viewOf(fast, game, game.id);
    expect(view.council.pending).toEqual([]);
    const expired = (await eventsOf(fast, game, game.id)).filter(
      (event) => event.type === 'cardExpired',
    );
    expect(
      expired.map((event) => [event.data.cardId, event.data.optionId, event.data.morale]),
    ).toEqual([['palisadePromiseDeadline', 'show', 15]]);
    expect((await chronicleOf(fast, game, game.id)).join('\n')).toMatch(
      /sem palavra do senhor, o conselho de Pedra Alta levou os aldeões até a paliçada prometida/,
    );
    expect((await storedState(fast, game.id)).state.council.flags).toEqual({
      'palisadePromise.kept': true,
    });
  });

  it('quem promete e não ergue nada paga a conta da promessa, mesmo ausente, e ela não tira recurso nenhum', async () => {
    const game = await insertGame(fast, withPlea('promessa-quebrada', PACE), PACE);
    const plea = cardNamed(await viewOf(fast, game, game.id), 'Os aldeões perguntam pela cerca');
    await send(
      fast,
      game.token,
      game.id,
      order('answerCard', { instanceId: plea.instanceId, optionId: 'promise' }),
    );
    // Três dias reais: a cobrança expira (o conselho pede mais dias), e a segunda também.
    await wait(fast, game, 72 * HOUR);
    await viewOf(fast, game, game.id);
    const expired = (await eventsOf(fast, game, game.id)).filter(
      (event) => event.type === 'cardExpired',
    );
    expect(
      expired.map((event) => [event.data.cardId, event.data.optionId, event.data.morale]),
    ).toEqual([
      ['palisadePromiseDeadline', 'delay', undefined],
      ['palisadePromiseReckoning', 'admit', -15],
    ]);
    for (const event of expired) {
      expect(Object.keys(event.data).filter((key) => /^(spent|lost)_/.test(key))).toEqual([]);
    }
    const row = await storedState(fast, game.id);
    expect(row.state.council.flags).toEqual({ 'palisadePromise.broken': true });
    expect(row.state.settlement.buildings.palisade).toBe(0);
  });
});

describe('uma partida gravada antes da Paliçada (estado na versão 9)', () => {
  type StoredState = {
    schemaVersion: number;
    seed: string;
    lastProcessedAt: number;
    settings: { timeScale: number };
    settlement: { buildings: Record<string, number> };
  };

  function v9State(name: string): StoredState {
    const url = new URL(`../../engine/src/__fixtures__/state-v9-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as StoredState;
  }

  it('entra com a Paliçada por construir, e quem já tem o Salão no nível 3 pode erguê-la', async () => {
    // O feudo que veio da v0.1, no ritmo 3: o Salão já passou do nível 3.
    const before = v9State('migrated-3x');
    expect(before.schemaVersion).toBe(9);
    expect(before.settlement.buildings).not.toHaveProperty('palisade');
    expect(before.settlement.buildings.townHall).toBeGreaterThanOrEqual(3);
    const game = await insertGame(fast, before, before.settings.timeScale);
    const view = await viewOf(fast, game, game.id);
    expect(view.threat.defense).toMatchObject({
      palisadeLevel: 0,
      text: 'Sem Paliçada, nada segura um ataque.',
    });
    expect(palisade(view)).toMatchObject({ fromLevel: 0, targetLevel: 1 });
    expect(palisade(view)?.blockedCode).not.toBe('GATE_LOCKED');

    const row = await storedState(fast, game.id);
    expect(row.schema_version).toBe(11);
    expect(row.state.schemaVersion).toBe(11);
    expect(row.state.settlement.buildings).toEqual({ ...before.settlement.buildings, palisade: 0 });
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
    // Nada do Conselho mudou na fronteira: a promessa só existe para quem a fizer.
    expect(Object.keys(row.state.council.flags).join()).not.toContain('palisadePromise');
  });

  it('a Torre que a partida já tinha continua vendo a Ameaça depois da migração', async () => {
    const before = v9State('threat');
    const game = await insertGame(normal, before, before.settings.timeScale);
    const view = await viewOf(normal, game, game.id);
    expect(view.threat).toMatchObject({ known: true, level: 45 });
    expect(view.threat.defense.palisadeLevel).toBe(0);
  });
});
