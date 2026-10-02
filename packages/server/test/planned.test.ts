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
    const message = 'As Habitações não está na lista de obras planejadas.';
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
