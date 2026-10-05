import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ApiError,
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
  countRows,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  type Player,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Segunda fila de obras e início automático das planejadas (V2C-T5; GDD §6.3; ADR 0013, decisão
// 18) vistos pela API: a planejada automática que começa sozinha com o jogador fora, no instante
// exato e em qualquer ritmo; a marca que passa pelo recibo, sem pagar duas vezes; as recusas com
// a frase do motor. Os números são os do GDD: a partida nova tem 120 de madeira, 65 de pedra e
// 250 de ouro, e um lenhador rende 8 de madeira por hora de jogo.

const SECOND = 1000;
const PACE = 3;
/**
 * O instante de jogo em que a Pedreira de `leaveQuarryPlanned` começa sozinha: faltam 50 de
 * madeira. Os três lenhadores, recém-chegados, rendem metade no primeiro dia de jogo (12 por
 * hora: 24 de madeira em 2 h) e, adaptados, com 4 de experiência e a moral em 60, 25,502 por
 * hora (24 × 1,012 × 1,05): os 26 que faltam chegam 3.670.301 ms depois.
 */
const QUARRY_STARTS_AT = 2 * HOUR + Math.ceil((26_000 * HOUR) / 25_502);
const REPLAYED = 'x-lords-replayed';

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

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, who: Player, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, who);
}

async function viewOf(server: TestApp, who: Player): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${who.game.id}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(server: TestApp, who: Player): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(
    server,
    'GET',
    `/games/${who.game.id}/events?limit=500`,
    { token: who.token },
  );
  expect(reply.status).toBe(200);
  return reply.body.events;
}

async function accepted(
  server: TestApp,
  who: Player,
  command: ReturnType<typeof order>,
): Promise<CommandAccepted> {
  const reply = await send<CommandAccepted>(server, who.token, who.game.id, command);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
}

const stock = (view: ViewState, id: 'wood' | 'stone' | 'gold') =>
  view.resources.find((entry) => entry.id === id)?.stock ?? -1;
const autoStarted = (events: GameEvent[]) =>
  events.filter((event) => event.type === 'constructionAutoStarted');

/**
 * As ordens de quem vai sair: três lenhadores, dois fazendeiros, as Habitações em obra e a
 * Pedreira planejada como automática. Ficam 70 de madeira; a Pedreira pede 120.
 */
async function leaveQuarryPlanned(server: TestApp, who: Player): Promise<CommandAccepted> {
  await accepted(server, who, order('setWorkers', { building: 'lumberMill', count: 3 }));
  await accepted(server, who, order('setWorkers', { building: 'farm', count: 2 }));
  await accepted(server, who, order('startConstruction', { building: 'housing' }));
  return accepted(server, who, order('planConstruction', { building: 'quarry', autoStart: true }));
}

describe('a planejada automática começa sozinha com o jogador fora', () => {
  it('no ritmo Normal: a visão diz o que ela espera, e a obra começa no instante em que a madeira chega', async () => {
    const who = await newPlayer(normal);
    const planned = await leaveQuarryPlanned(normal, who);
    // Planejar não cobra e não inicia: a fila está ocupada e faltam 50 de madeira.
    expect(planned.events).toEqual([]);
    expect(stock(planned.view, 'wood')).toBe(70);
    expect(planned.view.constructions).toMatchObject({
      queuesUnlocked: 1,
      queuesNote: 'A segunda fila abre com o Salão do Senhor Nv4.',
      queues: [{ building: 'housing', targetLevel: 2 }],
      planned: [
        {
          building: 'quarry',
          targetLevel: 2,
          autoStart: true,
          // O prazo conta com a adaptação dos lenhadores e com a moral da próxima virada:
          // 3 h 01 min 11 s, arredondados para cima.
          waiting: { reason: 'resources', text: 'espera 50 de madeira', etaSeconds: 10_871 },
        },
      ],
    });

    expect(QUARRY_STARTS_AT).toBe(10_870_301);

    // Seis horas fora. A Pedreira começou sozinha às 3 h 04 min e já terminou.
    await wait(normal, who, 6 * HOUR);
    const events = await eventsOf(normal, who);
    const [started, ...others] = autoStarted(events);
    expect(others).toEqual([]);
    expect(started).toMatchObject({
      atMs: QUARRY_STARTS_AT,
      text: 'No 2º dia da Primavera, com as reservas cheias, os pedreiros começaram sozinhos a erguer a Pedreira ao 2º nível.',
      data: { building: 'quarry', level: 2, spent_wood: 120, spent_gold: 30 },
    });
    expect(new Date(started?.at ?? 0).getTime()).toBe(
      new Date(who.game.createdAt).getTime() + QUARRY_STARTS_AT,
    );
    const finished = events.find(
      (event) => event.type === 'constructionFinished' && event.data.building === 'quarry',
    );
    expect(finished?.atMs).toBe(QUARRY_STARTS_AT + 6 * MINUTE);

    const view = await viewOf(normal, who);
    expect(view.constructions.planned).toEqual([]);
    expect(view.constructions.queues).toEqual([null]);
    expect(view.workers.find((row) => row.building === 'quarry')?.level).toBe(2);

    // A obra que começou sozinha é linha da Crônica, como a que começa por ordem.
    const chronicle = await call<ChronicleResponse>(
      normal,
      'GET',
      `/games/${who.game.id}/chronicle?limit=500`,
      { token: who.token },
    );
    expect(chronicle.body.entries.map((entry) => entry.type)).toContain('constructionAutoStarted');
  });

  it('no ritmo Rápido: o mesmo instante de jogo, um terço do tempo real', async () => {
    const who = await newPlayer(fast);
    const planned = await leaveQuarryPlanned(fast, who);
    // A visão fala em tempo real: o mesmo instante de jogo, visto em um terço do tempo.
    const etaSeconds = Math.ceil(QUARRY_STARTS_AT / PACE / SECOND);
    expect(etaSeconds).toBe(3624);
    expect(planned.view.constructions.planned[0]?.waiting).toEqual({
      reason: 'resources',
      text: 'espera 50 de madeira',
      etaSeconds,
    });

    // Um segundo real antes, ainda não; no segundo anunciado, sim.
    await wait(fast, who, (etaSeconds - 1) * SECOND);
    expect(autoStarted(await eventsOf(fast, who))).toEqual([]);
    await wait(fast, who, SECOND);
    const [started] = autoStarted(await eventsOf(fast, who));
    expect(started).toMatchObject({ atMs: QUARRY_STARTS_AT, data: { building: 'quarry' } });
    expect(new Date(started?.at ?? 0).getTime()).toBe(
      new Date(who.game.createdAt).getTime() + Math.round(QUARRY_STARTS_AT / PACE),
    );
  });

  it('ler várias vezes no caminho não muda nada: a obra começa uma vez, no mesmo instante', async () => {
    const who = await newPlayer(normal);
    await leaveQuarryPlanned(normal, who);
    // O app à vista, de 7 em 7 minutos, atravessando o instante do início.
    for (let poll = 0; poll < 30; poll += 1) {
      await wait(normal, who, 7 * MINUTE);
      await viewOf(normal, who);
    }
    const started = autoStarted(await eventsOf(normal, who));
    expect(started.map((event) => event.atMs)).toEqual([QUARRY_STARTS_AT]);
    expect(
      await countRows(
        normal.pool,
        'game_events',
        `game_id = '${who.game.id}' and kind = 'constructionAutoStarted'`,
      ),
    ).toBe(1);
  });
});

describe('a marca de automática passa pelo recibo', () => {
  it('planejar como automática com recurso e fila inicia na hora, e o reenvio não paga de novo', async () => {
    const who = await newPlayer(normal);
    const plan = order('planConstruction', { building: 'farm', autoStart: true });
    const first = await send<CommandAccepted>(normal, who.token, who.game.id, plan);
    expect(first.status).toBe(200);
    // Fazenda: 80 de madeira e 40 de ouro, pagos uma vez.
    expect(first.body.events.map((event) => event.type)).toEqual(['constructionAutoStarted']);
    expect(stock(first.body.view, 'wood')).toBe(40);
    expect(stock(first.body.view, 'gold')).toBe(210);
    expect(first.body.view.constructions.planned).toEqual([]);

    // Duplo clique, resposta atrasada: o mesmo comando devolve o recibo.
    const again = await send<CommandAccepted>(normal, who.token, who.game.id, plan);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(first.body);
    const view = await viewOf(normal, who);
    expect(stock(view, 'wood')).toBe(40);
    expect(autoStarted(await eventsOf(normal, who))).toHaveLength(1);

    // O mesmo UUID com a marca trocada é outra ordem: conflito, e nada muda.
    const other = await send<ApiError>(normal, who.token, who.game.id, {
      ...order('planConstruction', { building: 'farm' }),
      commandId: plan.commandId,
    });
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('COMMAND_ID_CONFLICT');
  });

  it('setAutoStart marca a planejada manual; em duas abas, a segunda encontra a obra já iniciada', async () => {
    const who = await newPlayer(normal);
    const planned = await accepted(normal, who, order('planConstruction', { building: 'housing' }));
    // Manual e pronta para começar: não espera nada, e não começa sozinha.
    expect(planned.events).toEqual([]);
    expect(planned.view.constructions.planned).toMatchObject([
      { building: 'housing', autoStart: false, waiting: null },
    ]);
    await wait(normal, who, HOUR);
    expect(autoStarted(await eventsOf(normal, who))).toEqual([]);

    const mark = order('setAutoStart', { building: 'housing', autoStart: true });
    const marked = await accepted(normal, who, mark);
    expect(marked.events.map((event) => event.type)).toContain('constructionAutoStarted');
    expect(marked.view.constructions.queues).toMatchObject([{ building: 'housing' }]);
    const wood = stock(marked.view, 'wood');

    // A outra aba manda a mesma marca com outro UUID: a planejada não está mais na lista.
    const late = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('setAutoStart', { building: 'housing', autoStart: true }),
    );
    expect(late.status).toBe(422);
    const message = 'As Habitações não estão na lista de obras planejadas.';
    expect(late.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'NOT_PLANNED', message },
    });
    expect(stock(await viewOf(normal, who), 'wood')).toBe(wood);
    // E a primeira, reenviada, é o recibo.
    const again = await send<CommandAccepted>(normal, who.token, who.game.id, mark);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(marked);
  });
});

describe('duas abas com a tela atrasada: a ordem diz o nível que a tela mostrava', () => {
  const STATE_VERSION = 'x-lords-state-version';

  it('planejar como automática duas vezes, com UUIDs diferentes, não paga o nível seguinte', async () => {
    const who = await newPlayer(normal);
    // As duas abas leram a mesma visão: Habitações → Nv2, livre para começar.
    const before = await call<ViewResponse>(normal, 'GET', `/games/${who.game.id}/view`, {
      token: who.token,
    });
    const offered = before.body.view.constructions.available.find(
      (entry) => entry.building === 'housing',
    );
    expect(offered).toMatchObject({ targetLevel: 2, blockedCode: null });
    const seen = { [STATE_VERSION]: before.body.stateVersion };
    const plan = () =>
      order('planConstruction', { building: 'housing', autoStart: true, targetLevel: 2 });

    // Aba A: a obra começa na hora, paga uma vez (80 de madeira e 20 de pedra).
    const first = await send<CommandAccepted>(normal, who.token, who.game.id, plan(), seen);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(autoStarted(first.body.events)).toMatchObject([
      { data: { building: 'housing', level: 2, spent_wood: 80, spent_stone: 20 } },
    ]);
    // Dos 120 de madeira saem 80, e o objetivo das Habitações devolve 30.
    expect(stock(first.body.view, 'wood')).toBe(70);

    // Aba B: a mesma intenção, outro UUID, a mesma visão velha. A obra pedida já começou.
    const second = await send<GameRuleError>(normal, who.token, who.game.id, plan(), seen);
    expect(second.status, JSON.stringify(second.body)).toBe(422);
    const message = 'As Habitações já estão em obras.';
    expect(second.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'ALREADY_UPGRADING', message, staleView: true },
    });
    expect(second.body.details.view.constructions.planned).toEqual([]);

    // Com gente na madeira e na pedra, o nível 3 (128 e 32) caberia no bolso: e não começa.
    await accepted(normal, who, order('setWorkers', { building: 'lumberMill', count: 3 }));
    await accepted(normal, who, order('setWorkers', { building: 'quarry', count: 2 }));
    await wait(normal, who, 12 * HOUR);
    const view = await viewOf(normal, who);
    expect(view.constructions.queues).toEqual([null]);
    expect(
      view.constructions.available.find((entry) => entry.building === 'housing'),
    ).toMatchObject({ fromLevel: 2, targetLevel: 3 });
    expect(stock(view, 'wood')).toBeGreaterThanOrEqual(128);
    expect(stock(view, 'stone')).toBeGreaterThanOrEqual(32);
    expect(view.constructions.planned).toEqual([]);
    expect(autoStarted(await eventsOf(normal, who))).toHaveLength(1);
  });

  it('a obra pedida já terminou: a recusa diz qual é a obra de agora', async () => {
    const who = await newPlayer(normal);
    await accepted(
      normal,
      who,
      order('planConstruction', { building: 'housing', autoStart: true, targetLevel: 2 }),
    );
    await wait(normal, who, HOUR);
    const late = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('planConstruction', { building: 'housing', autoStart: true, targetLevel: 2 }),
    );
    expect(late.status).toBe(422);
    const message =
      'Essa ordem ficou para trás: a obra das Habitações agora é a do nível 3. Confira a lista e peça de novo.';
    expect(late.body).toMatchObject({ details: { code: 'STALE_LEVEL', message } });
    expect(late.body.details.view.constructions.planned).toEqual([]);
  });

  it('setAutoStart com a tela atrasada não marca a planejada de outro nível', async () => {
    const who = await newPlayer(normal);
    // A aba velha mostra a planejada manual das Habitações → Nv2.
    await accepted(normal, who, order('planConstruction', { building: 'housing', targetLevel: 2 }));
    // A outra aba inicia essa obra e planeja a seguinte, manual.
    await accepted(normal, who, order('startConstruction', { building: 'housing' }));
    const next = await accepted(
      normal,
      who,
      order('planConstruction', { building: 'housing', targetLevel: 3 }),
    );
    expect(next.view.constructions.planned).toMatchObject([
      { building: 'housing', targetLevel: 3, autoStart: false },
    ]);

    const late = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('setAutoStart', { building: 'housing', autoStart: true, targetLevel: 2 }),
    );
    expect(late.status).toBe(422);
    expect(late.body.details.code).toBe('STALE_LEVEL');
    expect((await viewOf(normal, who)).constructions.planned).toMatchObject([
      { building: 'housing', targetLevel: 3, autoStart: false },
    ]);
    // Com o nível que a lista mostra agora, a marca entra.
    const marked = await accepted(
      normal,
      who,
      order('setAutoStart', { building: 'housing', autoStart: true, targetLevel: 3 }),
    );
    expect(marked.view.constructions.planned).toMatchObject([
      { building: 'housing', targetLevel: 3, autoStart: true },
    ]);
  });

  it('a forma é do protocolo: nível que não é inteiro positivo é 400', async () => {
    const who = await newPlayer(normal);
    for (const targetLevel of [0, 1.5, '2', null]) {
      const reply = await call<ApiError>(normal, 'POST', `/games/${who.game.id}/commands`, {
        token: who.token,
        body: {
          ...order('planConstruction', { building: 'farm' }),
          payload: { building: 'farm', targetLevel },
        },
      });
      expect(reply.status, JSON.stringify(targetLevel)).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
    }
    expect((await viewOf(normal, who)).constructions.planned).toEqual([]);
  });
});

describe('recusas', () => {
  it('a segunda obra com o Salão abaixo do nível 4 diz o que abre a segunda fila', async () => {
    const who = await newPlayer(normal);
    await accepted(normal, who, order('startConstruction', { building: 'housing' }));
    const refused = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('startConstruction', { building: 'farm' }),
    );
    expect(refused.status).toBe(422);
    const message =
      'Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4.';
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'QUEUE_LOCKED', message },
    });
    const view = await viewOf(normal, who);
    expect(view.constructions.available.find((entry) => entry.building === 'farm')).toMatchObject({
      blockedCode: 'QUEUE_LOCKED',
      blockedReason: message,
    });
  });

  it('a forma é do protocolo: marca que não é booleana e campo a mais são 400', async () => {
    const who = await newPlayer(normal);
    const bad = [
      {
        ...order('planConstruction', { building: 'farm' }),
        payload: { building: 'farm', autoStart: 'sim' },
      },
      {
        ...order('setAutoStart', { building: 'farm', autoStart: true }),
        payload: { building: 'farm' },
      },
      {
        ...order('setAutoStart', { building: 'farm', autoStart: true }),
        payload: { building: 'farm', autoStart: true, now: true },
      },
    ];
    for (const command of bad) {
      const reply = await call<ApiError>(normal, 'POST', `/games/${who.game.id}/commands`, {
        token: who.token,
        body: command,
      });
      expect(reply.status, JSON.stringify(command.payload)).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
    }
    expect((await viewOf(normal, who)).constructions.planned).toEqual([]);
  });
});

describe('duas filas abertas: o Salão no nível 4', () => {
  // O retrato `queues` do motor (ritmo 3): o Salão no nível 4, a Serraria e a Mina de Ouro em
  // obras, e três planejadas: a Serraria de novo, automática; as Habitações, manuais; e o Salão,
  // automático, à espera de recurso. Madeira 200, pedra 170, ouro 110; o estado parou aos
  // 184.567 ms de jogo, a obra da Serraria acaba aos 300.000 e a da Mina, aos 480.000.
  const QUEUES_STATE = readFileSync(
    new URL('../../engine/src/__fixtures__/state-v7-queues.json', import.meta.url),
    'utf8',
  );
  const SAVED_AT = 184_567;
  const LUMBER_MILL_ENDS_AT = 300_000;
  const QUEUE_BUSY = 'Os pedreiros já estão ocupados: não há fila de obras livre.';

  /** Grava a partida do retrato como o servidor a deixou, com o relógio de jogo onde ela parou. */
  async function queuesPlayer(server: TestApp): Promise<Player> {
    const auth = await signUp(server, 'Senhor das Filas');
    const state = JSON.parse(QUEUES_STATE) as {
      seed: string;
      schemaVersion: number;
      lastProcessedAt: number;
    };
    expect(state.lastProcessedAt).toBe(SAVED_AT);
    const now = server.clock.now().getTime();
    const id = randomUUID();
    const createdAt = new Date(now - Math.floor(SAVED_AT / PACE));
    await server.pool.query(
      `insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                          schema_version, state, state_version, last_processed_at, created_at, updated_at)
       values ($1, $2, 'active', $3, 'lord', $4, 'America/Sao_Paulo', 20, $5, $6::jsonb, 1, $7, $8, $7)`,
      [
        id,
        auth.account.id,
        state.seed,
        String(PACE),
        state.schemaVersion,
        QUEUES_STATE,
        new Date(now),
        createdAt,
      ],
    );
    return {
      auth,
      accountId: auth.account.id,
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
      game: { id, createdAt: createdAt.toISOString() } as Player['game'],
    };
  }

  const inQueues = (view: ViewState) =>
    view.constructions.queues.map((slot) => (slot === null ? null : slot.building));

  it('com as duas ocupadas, a terceira obra é recusada; cancelar uma libera os pedreiros para a planejada automática', async () => {
    const who = await queuesPlayer(fast);
    const view = await viewOf(fast, who);
    expect(view.constructions).toMatchObject({
      queuesUnlocked: 2,
      queuesNote: null,
      active: { building: 'lumberMill', targetLevel: 2 },
      queues: [
        // (300.000 − 184.567) ms de jogo no ritmo 3: 38,5 s reais, arredondados para cima.
        { building: 'lumberMill', targetLevel: 2, secondsRemaining: 39 },
        { building: 'goldMine', targetLevel: 2, secondsRemaining: 99 },
      ],
      planned: [
        {
          building: 'lumberMill',
          targetLevel: 3,
          autoStart: true,
          waiting: { reason: 'upgrading' },
        },
        // Tem recurso; só faltam os pedreiros, e a primeira fila a vagar é a da Serraria.
        { building: 'housing', autoStart: false, waiting: { reason: 'queue', etaSeconds: 39 } },
        { building: 'townHall', autoStart: true, waiting: { reason: 'resources' } },
      ],
    });
    expect(view.constructions.queues).toHaveLength(2);
    expect(view.constructions.available.find((entry) => entry.building === 'farm')).toMatchObject({
      affordable: true,
      blockedCode: 'QUEUE_BUSY',
      blockedReason: QUEUE_BUSY,
    });

    // A terceira obra: há recurso, não há fila. A recusa não fala em abrir a segunda fila.
    const third = order('startConstruction', { building: 'farm' });
    const refused = await send<GameRuleError>(fast, who.token, who.game.id, third);
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message: QUEUE_BUSY,
      details: { code: 'QUEUE_BUSY', message: QUEUE_BUSY },
    });
    expect(inQueues(refused.body.details.view)).toEqual(['lumberMill', 'goldMine']);
    const refusedAgain = await send<GameRuleError>(fast, who.token, who.game.id, third);
    expect(refusedAgain.status).toBe(422);
    expect(refusedAgain.headers[REPLAYED]).toBe('true');
    expect(refusedAgain.body).toEqual(refused.body);

    // As Habitações viram automáticas: com as duas filas ocupadas, esperam os pedreiros.
    const marked = await accepted(
      fast,
      who,
      order('setAutoStart', { building: 'housing', autoStart: true }),
    );
    expect(marked.events).toEqual([]);
    expect(stock(marked.view, 'wood')).toBe(200);

    // Cancelar a Mina devolve 80% (96 de madeira e 64 de pedra) e, na mesma ordem, a fila que
    // vagou é das Habitações (80 e 20). A Serraria Nv3 continua esperando a obra dela.
    const cancel = order('cancelConstruction', { building: 'goldMine' });
    const cancelled = await send<CommandAccepted>(fast, who.token, who.game.id, cancel);
    expect(cancelled.status, JSON.stringify(cancelled.body)).toBe(200);
    expect(cancelled.body.events.map((event) => [event.type, event.atMs, event.data])).toEqual([
      [
        'constructionCancelled',
        SAVED_AT,
        { building: 'goldMine', level: 1, gained_wood: 96, gained_stone: 64 },
      ],
      [
        'constructionAutoStarted',
        SAVED_AT,
        { building: 'housing', level: 2, spent_wood: 80, spent_stone: 20 },
      ],
      ['objectiveCompleted', SAVED_AT, { objective: 'upgradeHousing', gained_wood: 30 }],
    ]);
    expect(inQueues(cancelled.body.view)).toEqual(['lumberMill', 'housing']);
    expect(stock(cancelled.body.view, 'wood')).toBe(200 + 96 - 80 + 30);
    expect(stock(cancelled.body.view, 'stone')).toBe(170 + 64 - 20);
    expect(cancelled.body.view.constructions.planned.map((plan) => plan.building)).toEqual([
      'lumberMill',
      'townHall',
    ]);

    // Reenviado, o cancelamento é o recibo: nada é devolvido nem pago outra vez.
    const cancelledAgain = await send<CommandAccepted>(fast, who.token, who.game.id, cancel);
    expect(cancelledAgain.status).toBe(200);
    expect(cancelledAgain.headers[REPLAYED]).toBe('true');
    expect(cancelledAgain.body).toEqual(cancelled.body);
    const after = await viewOf(fast, who);
    expect(stock(after, 'wood')).toBe(246);
    expect(inQueues(after)).toEqual(['lumberMill', 'housing']);

    // 39 s reais depois a Serraria chega ao nível 2 e, no mesmo instante de jogo, a planejada
    // do nível 3 (160 de madeira e 80 de pedra) ocupa a fila que ela deixou.
    await wait(fast, who, 39 * SECOND);
    const events = await eventsOf(fast, who);
    expect(events.slice(3).map((event) => [event.type, event.atMs, event.data])).toEqual([
      ['constructionFinished', LUMBER_MILL_ENDS_AT, { building: 'lumberMill', level: 2 }],
      [
        'constructionAutoStarted',
        LUMBER_MILL_ENDS_AT,
        { building: 'lumberMill', level: 3, spent_wood: 160, spent_stone: 80 },
      ],
    ]);
    const later = await viewOf(fast, who);
    expect(later.constructions.queues).toMatchObject([
      { building: 'lumberMill', targetLevel: 3 },
      { building: 'housing', targetLevel: 2 },
    ]);
    expect(later.constructions.planned).toMatchObject([
      { building: 'townHall', targetLevel: 5, autoStart: true, waiting: { reason: 'resources' } },
    ]);
    expect(
      await countRows(
        fast.pool,
        'game_events',
        `game_id = '${who.game.id}' and kind = 'constructionAutoStarted'`,
      ),
    ).toBe(2);
  });

  it('com as duas livres, duas ordens começam, a terceira é recusada, e cada reenvio devolve o recibo', async () => {
    const who = await queuesPlayer(fast);
    // As duas obras do retrato são canceladas: voltam 80 + 96 de madeira e 40 + 64 de pedra.
    await accepted(fast, who, order('cancelConstruction', { building: 'lumberMill' }));
    const freed = await accepted(fast, who, order('cancelConstruction', { building: 'goldMine' }));
    expect(freed.view.constructions.queues).toEqual([null, null]);
    expect(freed.view.constructions.active).toBeNull();
    expect(stock(freed.view, 'wood')).toBe(376);
    // Com fila livre, nenhuma automática começa: a Serraria Nv3 espera a obra do nível 2, que
    // ninguém iniciou de novo, e o Salão espera recurso. As Habitações são manuais.
    expect(freed.events.map((event) => event.type)).toEqual(['constructionCancelled']);
    expect(freed.view.constructions.planned).toMatchObject([
      { building: 'lumberMill', targetLevel: 3, waiting: { reason: 'upgrading' } },
      { building: 'housing', autoStart: false, waiting: null },
      { building: 'townHall', waiting: { reason: 'resources' } },
    ]);

    const farm = order('startConstruction', { building: 'farm' });
    const quarry = order('startConstruction', { building: 'quarry' });
    const housing = order('startConstruction', { building: 'housing' });
    const first = await send<CommandAccepted>(fast, who.token, who.game.id, farm);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(inQueues(first.body.view)).toEqual(['farm', null]);
    const second = await send<CommandAccepted>(fast, who.token, who.game.id, quarry);
    expect(second.status, JSON.stringify(second.body)).toBe(200);
    expect(inQueues(second.body.view)).toEqual(['farm', 'quarry']);
    expect(second.body.view.constructions.active).toMatchObject({ building: 'farm' });
    // Fazenda: 80 de madeira e 40 de ouro. Pedreira: 120 e 30.
    expect(stock(second.body.view, 'wood')).toBe(376 - 80 - 120);
    expect(stock(second.body.view, 'gold')).toBe(110 - 40 - 30);
    const third = await send<GameRuleError>(fast, who.token, who.game.id, housing);
    expect(third.status).toBe(422);
    expect(third.body).toMatchObject({ details: { code: 'QUEUE_BUSY', message: QUEUE_BUSY } });

    // Duplo clique, resposta atrasada: cada ordem reenviada devolve o que respondeu antes.
    for (const [command, reply] of [
      [farm, first],
      [quarry, second],
      [housing, third],
    ] as const) {
      const again = await send(fast, who.token, who.game.id, command);
      expect(again.status).toBe(reply.status);
      expect(again.headers[REPLAYED]).toBe('true');
      expect(again.body).toEqual(reply.body);
    }
    const view = await viewOf(fast, who);
    expect(inQueues(view)).toEqual(['farm', 'quarry']);
    expect(stock(view, 'wood')).toBe(176);
    expect(stock(view, 'gold')).toBe(40);
    expect(
      (await eventsOf(fast, who)).filter((event) => event.type === 'constructionStarted'),
    ).toHaveLength(2);

    // No ritmo 3 a Fazenda leva 100 s reais e a Pedreira, 120. Um segundo a mais: `created_at`
    // é arredondado ao milissegundo real, e o relógio de jogo fica 1 ms atrás do retrato.
    await wait(fast, who, 121 * SECOND);
    const done = await viewOf(fast, who);
    expect(done.constructions.queues).toEqual([null, null]);
    expect(done.workers.find((row) => row.building === 'farm')?.level).toBe(2);
    expect(done.workers.find((row) => row.building === 'quarry')?.level).toBe(2);
    // A terceira, agora, começa.
    const late = await accepted(fast, who, order('startConstruction', { building: 'housing' }));
    expect(inQueues(late.view)).toEqual(['housing', null]);
  });
});
