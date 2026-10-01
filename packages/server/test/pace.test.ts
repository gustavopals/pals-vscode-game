import type {
  ApiError,
  ChronicleResponse,
  CommandAccepted,
  CreateGameResponse,
  EventsResponse,
  GameEvent,
  GameRuleError,
  ListGamesResponse,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { ConfigError, loadConfig } from '../src/config';
import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  createTestApp,
  HOUR,
  JWT_SECRET,
  MINUTE,
  newPlayer,
  order,
  type Player,
  RECOVERY_CODE_SECRET,
  renew,
  send,
  signUp,
  type TestApp,
  testConfig,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Ritmo das partidas (ADR 0011): o servidor grava GAME_TIME_SCALE em cada partida nova, o motor
// segue em tempo de jogo e a visão sai em tempo real. Os números de jogo usados aqui são os do
// GDD no ritmo Normal: melhoria das Habitações em 4 min, aldeão em 20 min, dia de 2 h, 180 de
// comida inicial, 10 de comida por fazendeiro por hora e 1 de consumo por aldeão por hora.

const SECOND = 1000;
const PACE = 3;

/** Instância no ritmo Normal do GDD, para comparar. */
let normal: TestApp;
/** Instância no ritmo do MVP. Cada instância tem o próprio relógio. */
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

// --- Apoio --------------------------------------------------------------------

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, player: Player, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, player);
}

async function viewOf(server: TestApp, player: Player): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
    token: player.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(server: TestApp, player: Player): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(
    server,
    'GET',
    `/games/${player.game.id}/events?limit=500`,
    { token: player.token },
  );
  expect(reply.status).toBe(200);
  return reply.body.events;
}

async function chronicleOf(server: TestApp, player: Player): Promise<GameEvent[]> {
  const reply = await call<ChronicleResponse>(
    server,
    'GET',
    `/games/${player.game.id}/chronicle?limit=500`,
    { token: player.token },
  );
  expect(reply.status).toBe(200);
  return reply.body.entries;
}

async function accepted(
  server: TestApp,
  player: Player,
  command: ReturnType<typeof order>,
): Promise<CommandAccepted> {
  const reply = await send<CommandAccepted>(server, player.token, player.game.id, command);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
}

function resource(view: ViewState, id: 'food' | 'wood' | 'stone' | 'gold') {
  const found = view.resources.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`Recurso ${id} ausente da visão.`);
  }
  return found;
}

function worker(view: ViewState, building: string) {
  const found = view.workers.find((entry) => entry.building === building);
  if (found === undefined) {
    throw new Error(`Edifício ${building} ausente da visão.`);
  }
  return found;
}

function upgradeOf(view: ViewState, building: string) {
  const found = view.constructions.available.find((entry) => entry.building === building);
  if (found === undefined) {
    throw new Error(`Melhoria de ${building} ausente da visão.`);
  }
  return found;
}

function createdAtMs(player: Player): number {
  return new Date(player.game.createdAt).getTime();
}

/**
 * O que a visão de uma partida no ritmo Normal vira em outro ritmo, no mesmo instante de jogo:
 * prazos divididos (para cima; para baixo nos dois que contam o que já passou ou o que resta de
 * estoque) e taxas por hora multiplicadas. Escrito aqui, de propósito, sem reutilizar o motor.
 * Os textos de explicação das taxas ficam de fora: são conferidos por extenso nos testes.
 */
function atPace(view: ViewState, pace: number): ViewState {
  const up = (seconds: number) => Math.ceil(seconds / pace);
  const down = (seconds: number) => Math.floor(seconds / pace);
  const { active } = view.constructions;
  return {
    ...view,
    calendar: {
      ...view.calendar,
      secondsToNextDay: up(view.calendar.secondsToNextDay),
      secondsToNextSeason: up(view.calendar.secondsToNextSeason),
    },
    population: {
      ...view.population,
      secondsToNextRecruit:
        view.population.secondsToNextRecruit === null
          ? null
          : up(view.population.secondsToNextRecruit),
    },
    resources: view.resources.map((entry) => ({
      ...entry,
      perHour: entry.perHour * pace,
      depletesInSeconds: entry.depletesInSeconds === null ? null : down(entry.depletesInSeconds),
    })),
    workers: view.workers.map((entry) => ({
      ...entry,
      grossPerHour: entry.grossPerHour * pace,
      perWorkerPerHour: entry.perWorkerPerHour * pace,
    })),
    constructions: {
      active:
        active === null
          ? null
          : {
              ...active,
              secondsRemaining: up(active.secondsRemaining),
              totalSeconds: up(active.totalSeconds),
            },
      planned: view.constructions.planned.map((entry) => ({
        ...entry,
        durationSeconds: up(entry.durationSeconds),
      })),
      available: view.constructions.available.map((entry) => ({
        ...entry,
        durationSeconds: up(entry.durationSeconds),
      })),
    },
    recruitment: {
      ...view.recruitment,
      secondsPerVillager: up(view.recruitment.secondsPerVillager),
    },
    famine:
      view.famine === null
        ? null
        : { ...view.famine, secondsElapsed: down(view.famine.secondsElapsed) },
  };
}

/** A visão sem os textos de explicação que citam taxas por hora. */
function withoutRateTexts(view: ViewState): ViewState {
  return {
    ...view,
    resources: view.resources.map((entry) => ({ ...entry, breakdown: '' })),
    workers: view.workers.map((entry) => ({ ...entry, breakdown: '' })),
  };
}

function expectSameWorld(fastView: ViewState, normalView: ViewState): void {
  expect(withoutRateTexts(fastView)).toEqual(withoutRateTexts(atPace(normalView, PACE)));
}

// --- Criação ------------------------------------------------------------------

describe('ritmo das partidas novas (ADR 0011)', () => {
  it('a partida nasce com o ritmo do servidor, na resposta, na listagem e na coluna time_scale', async () => {
    const player = await newPlayer(fast);
    expect(player.game.timeScale).toBe(3);

    const listed = await call<ListGamesResponse>(fast, 'GET', '/games', { token: player.token });
    expect(listed.body.games.map((game) => game.timeScale)).toEqual([3]);

    const { rows } = await fast.pool.query<{ time_scale: string }>(
      'select time_scale from games where id = $1',
      [player.game.id],
    );
    expect(Number(rows[0]?.time_scale)).toBe(3);

    // O servidor de ritmo 1 grava 1.
    const slow = await newPlayer(normal);
    expect(slow.game.timeScale).toBe(1);
  });

  it('"timeScale: 1" no corpo é aceito e ignorado: vale o ritmo do servidor', async () => {
    const auth = await signUp(fast);
    const reply = await call<CreateGameResponse>(fast, 'POST', '/games', {
      token: auth.accessToken,
      body: {
        settlementName: 'Vale Fundo',
        timezone: 'UTC',
        vigilHourLocal: 20,
        timeScale: 1,
      },
    });
    expect(reply.status).toBe(201);
    expect(reply.body.game.timeScale).toBe(3);
    const { rows } = await fast.pool.query<{ time_scale: string }>(
      'select time_scale from games where id = $1',
      [reply.body.game.id],
    );
    expect(Number(rows[0]?.time_scale)).toBe(3);
  });

  it.each([3, 2, 0.5, 0, '1', null])(
    'timeScale: %j no corpo é 400 VALIDATION e não cria partida',
    async (timeScale) => {
      const auth = await signUp(fast);
      const reply = await call<ApiError>(fast, 'POST', '/games', {
        token: auth.accessToken,
        body: { settlementName: 'Vale Fundo', timezone: 'UTC', vigilHourLocal: 20, timeScale },
      });
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
      const listed = await call<ListGamesResponse>(fast, 'GET', '/games', {
        token: auth.accessToken,
      });
      expect(listed.body.games).toEqual([]);
    },
  );
});

// --- Visão em tempo real --------------------------------------------------------

describe('a visão fala em tempo real', () => {
  it('visão inicial: taxas por hora real 3× e prazos em segundos reais', async () => {
    const quick = await newPlayer(fast);
    const slow = await newPlayer(normal);
    const fastView = await viewOf(fast, quick);
    const normalView = await viewOf(normal, slow);

    // Ritmo Normal, como no GDD: dia de 2 h, estação de 24 dias, comida para 36 h.
    expect(normalView.calendar).toMatchObject({
      secondsToNextDay: 7200,
      secondsToNextSeason: 172_800,
    });
    expect(resource(normalView, 'food')).toMatchObject({ perHour: -5, depletesInSeconds: 129_600 });
    expect(worker(normalView, 'farm').perWorkerPerHour).toBe(10);
    expect(upgradeOf(normalView, 'housing').durationSeconds).toBe(240);
    expect(normalView.recruitment.secondsPerVillager).toBe(1200);

    // Ritmo 3: o dia dura 40 min reais, a estação 16 h e a comida acaba em 12 h.
    expect(fastView.calendar).toMatchObject({
      year: 1,
      dayOfSeason: 1,
      secondsToNextDay: 2400,
      secondsToNextSeason: 57_600,
    });
    expect(resource(fastView, 'food')).toMatchObject({
      stock: 180,
      perHour: -15,
      depletesInSeconds: 43_200,
      breakdown: 'Fazenda: 0 trabalhadores × 30 × 1 (Nv1) = 0/h; consumo 5 × 3 = 15/h',
    });
    expect(fastView.workers.map((entry) => [entry.building, entry.perWorkerPerHour])).toEqual([
      ['farm', 30],
      ['lumberMill', 24],
      ['quarry', 15],
      ['goldMine', 12],
    ]);
    expect(upgradeOf(fastView, 'housing').durationSeconds).toBe(80);
    expect(upgradeOf(fastView, 'townHall').durationSeconds).toBe(200);
    expect(fastView.recruitment.secondsPerVillager).toBe(400);

    // E o resto da visão é o mesmo mundo: estoques, custos, população, objetivos.
    expectSameWorld(fastView, normalView);
  });

  it('mesmas ordens nos mesmos instantes de jogo: o mesmo mundo, com prazos ÷3 e taxas ×3', async () => {
    const quick = await newPlayer(fast);
    const slow = await newPlayer(normal);

    const opening = () => [
      order('setWorkers', { building: 'farm', count: 2 }),
      order('startConstruction', { building: 'housing' }),
      order('recruitVillagers', { quantity: 1 }),
    ];
    let fastReply: CommandAccepted | undefined;
    let normalReply: CommandAccepted | undefined;
    for (const command of opening()) {
      fastReply = await accepted(fast, quick, command);
    }
    for (const command of opening()) {
      normalReply = await accepted(normal, slow, command);
    }
    if (fastReply === undefined || normalReply === undefined) {
      throw new Error('As ordens de abertura não foram enviadas.');
    }
    // A resposta de um comando também sai em tempo real, igual à leitura seguinte.
    expectSameWorld(fastReply.view, normalReply.view);
    expect(fastReply.view).toEqual(await viewOf(fast, quick));
    expect(fastReply.view.constructions.active).toMatchObject({
      building: 'housing',
      secondsRemaining: 80,
      totalSeconds: 80,
      progressPercent: 0,
    });
    expect(fastReply.view.population.secondsToNextRecruit).toBe(400);
    expect(resource(fastReply.view, 'food')).toMatchObject({
      perHour: 45,
      breakdown: 'Fazenda: 2 trabalhadores × 30 × 1 (Nv1) = 60/h; consumo 5 × 3 = 15/h',
    });
    expect(worker(fastReply.view, 'farm')).toMatchObject({
      grossPerHour: 60,
      perWorkerPerHour: 30,
      breakdown: '2 trabalhadores × 30 × 1 (Nv1) = 60/h',
    });

    // Instantes de jogo: 3 min (obra a 75%), 19 min 57 s (aldeão a 3 s de jogo de chegar),
    // 30 min (obra pronta, aldeão em casa) e 3 h (depois da primeira virada de dia).
    const checkpoints = [3 * MINUTE, 19 * MINUTE + 57 * SECOND, 30 * MINUTE, 3 * HOUR];
    let gameNow = 0;
    for (const checkpoint of checkpoints) {
      await wait(fast, quick, (checkpoint - gameNow) / PACE);
      await wait(normal, slow, checkpoint - gameNow);
      gameNow = checkpoint;
      const fastView = await viewOf(fast, quick);
      const normalView = await viewOf(normal, slow);
      expectSameWorld(fastView, normalView);
      if (checkpoint === 3 * MINUTE) {
        expect(fastView.constructions.active).toMatchObject({
          secondsRemaining: 20,
          totalSeconds: 80,
          progressPercent: 75,
        });
        expect(fastView.population.secondsToNextRecruit).toBe(340);
      }
      if (checkpoint === 19 * MINUTE + 57 * SECOND) {
        expect(normalView.population.secondsToNextRecruit).toBe(3);
        expect(fastView.population.secondsToNextRecruit).toBe(1);
      }
      if (checkpoint === 30 * MINUTE) {
        expect(fastView.constructions.active).toBeNull();
        expect(fastView.population).toMatchObject({ villagers: 6, capacity: 15 });
        // Uma ordem no meio do caminho, no mesmo instante de jogo nas duas partidas.
        const command = () => order('setWorkers', { building: 'lumberMill', count: 3 });
        const fastOrder = await accepted(fast, quick, command());
        const normalOrder = await accepted(normal, slow, command());
        expectSameWorld(fastOrder.view, normalOrder.view);
        expect(resource(fastOrder.view, 'wood').perHour).toBe(72);
      }
    }

    // Os eventos são os mesmos, nos mesmos instantes de jogo; o instante real é que encolhe.
    const fastEvents = await eventsOf(fast, quick);
    const normalEvents = await eventsOf(normal, slow);
    const story = (events: GameEvent[]) =>
      events.map(({ seq, type, atMs, text, data }) => ({ seq, type, atMs, text, data }));
    expect(story(fastEvents)).toEqual(story(normalEvents));
    expect(fastEvents.map((event) => event.type)).toContain('dayStarted');
    for (const event of fastEvents) {
      expect(new Date(event.at).getTime(), event.type).toBe(createdAtMs(quick) + event.atMs / PACE);
    }
    for (const event of normalEvents) {
      expect(new Date(event.at).getTime(), event.type).toBe(createdAtMs(slow) + event.atMs);
    }
  });

  it('depois de 1 hora real com 2 fazendeiros, a comida subiu o equivalente a 3 horas de jogo', async () => {
    const quick = await newPlayer(fast);
    const slow = await newPlayer(normal);
    await accepted(fast, quick, order('setWorkers', { building: 'farm', count: 2 }));
    await accepted(normal, slow, order('setWorkers', { building: 'farm', count: 2 }));

    await wait(fast, quick, HOUR);
    await wait(normal, slow, HOUR);
    const fastView = await viewOf(fast, quick);
    const normalView = await viewOf(normal, slow);

    // Por hora de jogo: 2 × 10 de produção − 5 de consumo = +15.
    expect(resource(normalView, 'food')).toMatchObject({ stock: 195, perHour: 15 });
    expect(resource(fastView, 'food')).toMatchObject({ stock: 225, perHour: 45 });
    // Uma hora real são três horas de jogo: o dia de 2 h já virou uma vez.
    expect(normalView.calendar).toMatchObject({ dayOfSeason: 1, secondsToNextDay: 3600 });
    expect(fastView.calendar).toMatchObject({ dayOfSeason: 2, secondsToNextDay: 1200 });
    // Os recursos sem trabalhadores não se mexem.
    expect(resource(fastView, 'wood').stock).toBe(120);
  });
});

// --- Prazos anunciados ----------------------------------------------------------

describe('o que a visão anuncia acontece no relógio real', () => {
  it('a melhoria das Habitações termina em durationSeconds segundos reais, e não antes', async () => {
    const player = await newPlayer(fast);
    await wait(fast, player, 7 * SECOND);
    const before = await viewOf(fast, player);
    const announced = upgradeOf(before, 'housing').durationSeconds;
    expect(announced).toBe(80);
    expect(before.population.capacity).toBe(10);

    const startedAt = fast.clock.now().getTime();
    const started = await accepted(
      fast,
      player,
      order('startConstruction', { building: 'housing' }),
    );
    expect(started.view.constructions.active).toMatchObject({
      secondsRemaining: announced,
      totalSeconds: announced,
    });
    const startedEvent = started.events.find((event) => event.type === 'constructionStarted');
    expect(startedEvent).toMatchObject({
      atMs: 7 * SECOND * PACE,
      at: new Date(startedAt).toISOString(),
    });

    // secondsRemaining desce 1 a cada segundo real.
    for (let elapsed = 1; elapsed <= 5; elapsed += 1) {
      fast.clock.advance(SECOND);
      const view = await viewOf(fast, player);
      expect(view.constructions.active?.secondsRemaining).toBe(announced - elapsed);
    }

    // Dois segundos antes do prazo ainda está em obra.
    fast.clock.advance((announced - 5 - 2) * SECOND);
    const almost = await viewOf(fast, player);
    expect(almost.constructions.active).toMatchObject({
      building: 'housing',
      secondsRemaining: 2,
      totalSeconds: announced,
    });
    expect(almost.population.capacity).toBe(10);
    fast.clock.advance(SECOND);
    expect((await viewOf(fast, player)).constructions.active?.secondsRemaining).toBe(1);

    // No prazo anunciado a obra está pronta.
    fast.clock.advance(SECOND);
    const done = await viewOf(fast, player);
    expect(done.constructions.active).toBeNull();
    expect(done.population.capacity).toBe(15);
    expect(upgradeOf(done, 'housing')).toMatchObject({ fromLevel: 2, targetLevel: 3 });

    const finished = (await eventsOf(fast, player)).find(
      (event) => event.type === 'constructionFinished',
    );
    expect(finished).toMatchObject({
      atMs: (7 * SECOND + announced * SECOND) * PACE,
      at: new Date(startedAt + announced * SECOND).toISOString(),
    });
    expect(new Date(finished?.at ?? 0).getTime()).toBe(fast.clock.now().getTime());
  });

  it('um aldeão recrutado chega no terço do tempo do ritmo Normal', async () => {
    const quick = await newPlayer(fast);
    const slow = await newPlayer(normal);
    const recruit = () => order('recruitVillagers', { quantity: 1 });
    const fastOrder = await accepted(fast, quick, recruit());
    const normalOrder = await accepted(normal, slow, recruit());
    expect(normalOrder.view.population.secondsToNextRecruit).toBe(1200);
    expect(fastOrder.view.population).toMatchObject({
      villagers: 5,
      inTraining: 1,
      secondsToNextRecruit: 400,
    });
    const orderedAt = fast.clock.now().getTime();

    await wait(fast, quick, 399 * SECOND);
    expect((await viewOf(fast, quick)).population).toMatchObject({
      villagers: 5,
      inTraining: 1,
      secondsToNextRecruit: 1,
    });
    fast.clock.advance(SECOND);
    expect((await viewOf(fast, quick)).population).toMatchObject({
      villagers: 6,
      inTraining: 0,
      secondsToNextRecruit: null,
    });
    const arrived = (await eventsOf(fast, quick)).find(
      (event) => event.type === 'recruitmentFinished',
    );
    expect(arrived).toMatchObject({
      atMs: 20 * MINUTE,
      at: new Date(orderedAt + 400 * SECOND).toISOString(),
    });

    // No ritmo Normal, 400 s depois o aldeão ainda está a caminho; chega aos 1.200 s.
    await wait(normal, slow, 400 * SECOND);
    expect((await viewOf(normal, slow)).population).toMatchObject({
      villagers: 5,
      secondsToNextRecruit: 800,
    });
    await wait(normal, slow, 800 * SECOND);
    expect((await viewOf(normal, slow)).population.villagers).toBe(6);
  });

  it('sem fazendeiros, a comida inicial acaba em 12 horas reais, com o instante exato na Crônica', async () => {
    const player = await newPlayer(fast);
    const start = await viewOf(fast, player);
    expect(resource(start, 'food').depletesInSeconds).toBe(12 * 3600);

    // Um segundo real antes: ainda há comida (3 s de jogo de consumo) e não há fome.
    await wait(fast, player, 12 * HOUR - SECOND);
    const almost = await viewOf(fast, player);
    expect(almost.famine).toBeNull();
    expect(resource(almost, 'food')).toMatchObject({ perHour: -15, depletesInSeconds: 1 });
    expect((await chronicleOf(fast, player)).map((entry) => entry.type)).toEqual([]);

    fast.clock.advance(SECOND);
    const hungry = await viewOf(fast, player);
    expect(hungry.famine).toMatchObject({ sinceMs: 36 * HOUR, secondsElapsed: 0 });
    expect(resource(hungry, 'food')).toMatchObject({ stock: 0, depletesInSeconds: null });

    const exact = new Date(createdAtMs(player) + 12 * HOUR).toISOString();
    const chronicle = await chronicleOf(fast, player);
    expect(chronicle).toHaveLength(1);
    expect(chronicle[0]).toMatchObject({
      type: 'famineStarted',
      atMs: 36 * HOUR,
      at: exact,
      // 36 h de jogo são 18 dias de 2 h: a fome começa quando amanhece o 19º dia.
      text: 'No 19º dia da Primavera, as despensas de Pedra Alta ficaram vazias. A fome começou.',
    });
    // GET /events traz o mesmo evento e as 18 viradas de dia, cada uma a 40 min reais da outra.
    const events = await eventsOf(fast, player);
    expect(events.find((event) => event.type === 'famineStarted')).toEqual(chronicle[0]);
    const days = events.filter((event) => event.type === 'dayStarted');
    expect(days.map((event) => new Date(event.at).getTime() - createdAtMs(player))).toEqual(
      Array.from({ length: 18 }, (_, index) => (index + 1) * 40 * MINUTE),
    );

    // O tempo de fome também é contado em segundos reais.
    await wait(fast, player, 90 * SECOND);
    expect((await viewOf(fast, player)).famine).toMatchObject({
      sinceMs: 36 * HOUR,
      secondsElapsed: 90,
    });
  });

  it('uma recusa do motor devolve a visão em tempo real', async () => {
    const player = await newPlayer(fast);
    await wait(fast, player, 10 * MINUTE);
    const refused = await send<GameRuleError>(
      fast,
      player.token,
      player.game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.view).toEqual(await viewOf(fast, player));
    // 10 min reais são 30 min de jogo: faltam 90 min de jogo, 30 min reais, para o dia virar.
    expect(refused.body.details.view.calendar.secondsToNextDay).toBe(1800);
    expect(resource(refused.body.details.view, 'food').perHour).toBe(-15);
  });

  it('o job de avanço respeita o ritmo da partida', async () => {
    const player = await newPlayer(fast);
    fast.clock.advance(2 * HOUR);
    await runJobsOnce(fast.ctx);
    // 2 h reais são 6 h de jogo: três viradas de dia, gravadas pelo job antes de qualquer leitura.
    const { rows } = await fast.pool.query<{ kind: string; at: Date }>(
      'select kind, at from game_events where game_id = $1 order by seq',
      [player.game.id],
    );
    expect(rows.map((row) => [row.kind, row.at.getTime() - createdAtMs(player)])).toEqual([
      ['dayStarted', 40 * MINUTE],
      ['dayStarted', 80 * MINUTE],
      ['dayStarted', 120 * MINUTE],
    ]);
  });
});

// --- Partidas antigas -----------------------------------------------------------

describe('mudar GAME_TIME_SCALE não mexe nas partidas que já existem', () => {
  it('a partida criada no ritmo 1 continua no ritmo 1 quando lida pela instância de ritmo 3', async () => {
    // Duas instâncias sobre o mesmo banco e o mesmo relógio: a de antes e a de depois da mudança.
    const before = await createTestApp({ config: { GAME_TIME_SCALE: '1' } });
    const after = await createTestApp({ clock: before.clock, config: { GAME_TIME_SCALE: '3' } });
    try {
      const player = await newPlayer(before, 'Veterano');
      expect(player.game.timeScale).toBe(1);

      const listed = await call<ListGamesResponse>(after, 'GET', '/games', {
        token: player.token,
      });
      expect(listed.body.games).toEqual([player.game]);

      // Lida e comandada pela instância nova, a partida segue nos números do ritmo Normal.
      const first = await viewOf(after, player);
      expect(first).toEqual(await viewOf(before, player));
      expect(first.calendar.secondsToNextDay).toBe(7200);
      expect(resource(first, 'food')).toMatchObject({ perHour: -5, depletesInSeconds: 129_600 });
      expect(upgradeOf(first, 'housing').durationSeconds).toBe(240);
      expect(first.recruitment.secondsPerVillager).toBe(1200);

      const ordered = await accepted(
        after,
        player,
        order('setWorkers', { building: 'farm', count: 2 }),
      );
      expect(resource(ordered.view, 'food').perHour).toBe(15);
      await accepted(after, player, order('startConstruction', { building: 'housing' }));

      // 80 s depois (o prazo do ritmo 3) a obra não terminou: o prazo dela é de 240 s.
      before.clock.advance(80 * SECOND);
      expect((await viewOf(after, player)).constructions.active?.secondsRemaining).toBe(160);
      before.clock.advance(160 * SECOND);
      expect((await viewOf(after, player)).constructions.active).toBeNull();

      // Uma hora real depois da criação: uma hora de jogo, +15 de comida, ainda no 1º dia.
      await wait(after, player, HOUR - 240 * SECOND);
      const later = await viewOf(after, player);
      expect(resource(later, 'food')).toMatchObject({ stock: 195, perHour: 15 });
      expect(later.calendar).toMatchObject({ dayOfSeason: 1, secondsToNextDay: 3600 });
      expect(later).toEqual(await viewOf(before, player));

      const { rows } = await after.pool.query<{ time_scale: string }>(
        'select time_scale from games where id = $1',
        [player.game.id],
      );
      expect(Number(rows[0]?.time_scale)).toBe(1);

      // Quem quer o ritmo novo começa outra partida; a antiga fica arquivada no ritmo dela.
      const replaced = await call<CreateGameResponse>(after, 'POST', '/games', {
        token: player.token,
        body: {
          settlementName: 'Pedra Nova',
          timezone: 'America/Sao_Paulo',
          vigilHourLocal: 20,
          replaceActive: true,
        },
      });
      expect(replaced.status).toBe(201);
      expect(replaced.body.game.timeScale).toBe(3);
      const both = await call<ListGamesResponse>(after, 'GET', '/games', { token: player.token });
      expect(
        both.body.games
          .map((game) => [game.settlementName, game.status, game.timeScale])
          .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
      ).toEqual([
        ['Pedra Alta', 'archived', 1],
        ['Pedra Nova', 'active', 3],
      ]);
    } finally {
      await before.close();
      await after.close();
    }
  });
});

// --- Outros ritmos --------------------------------------------------------------

describe('ritmos que não são 3', () => {
  it('ritmo 0,5: o dia de jogo dura 4 horas reais e as taxas caem à metade', async () => {
    const server = await createTestApp({ config: { GAME_TIME_SCALE: '0.5' } });
    try {
      const player = await newPlayer(server);
      expect(player.game.timeScale).toBe(0.5);
      const view = await viewOf(server, player);
      expect(view.calendar.secondsToNextDay).toBe(4 * 3600);
      expect(resource(view, 'food')).toMatchObject({ perHour: -2.5, depletesInSeconds: 72 * 3600 });
      expect(worker(view, 'farm').perWorkerPerHour).toBe(5);
      expect(upgradeOf(view, 'housing').durationSeconds).toBe(480);

      await wait(server, player, 4 * HOUR - SECOND);
      expect((await viewOf(server, player)).calendar).toMatchObject({
        dayOfSeason: 1,
        secondsToNextDay: 1,
      });
      server.clock.advance(SECOND);
      expect((await viewOf(server, player)).calendar.dayOfSeason).toBe(2);
    } finally {
      await server.close();
    }
  });

  it('ritmo que não divide o prazo: o anunciado é arredondado para cima e a obra não atrasa', async () => {
    const server = await createTestApp({ config: { GAME_TIME_SCALE: '7' } });
    try {
      const player = await newPlayer(server);
      // 240 s de jogo ÷ 7 = 34,29 s reais: a visão anuncia 35.
      const announced = upgradeOf(await viewOf(server, player), 'housing').durationSeconds;
      expect(announced).toBe(35);
      const started = await accepted(
        server,
        player,
        order('startConstruction', { building: 'housing' }),
      );
      expect(started.view.constructions.active).toMatchObject({
        secondsRemaining: 35,
        totalSeconds: 35,
      });

      server.clock.advance(33 * SECOND);
      expect((await viewOf(server, player)).constructions.active?.secondsRemaining).toBe(2);
      server.clock.advance(SECOND);
      expect((await viewOf(server, player)).constructions.active?.secondsRemaining).toBe(1);
      server.clock.advance(SECOND);
      expect((await viewOf(server, player)).constructions.active).toBeNull();

      // O evento fica no milissegundo real mais próximo do fim da obra, nunca depois de agora.
      const finished = (await eventsOf(server, player)).find(
        (event) => event.type === 'constructionFinished',
      );
      expect(finished?.atMs).toBe(4 * MINUTE);
      expect(new Date(finished?.at ?? 0).getTime()).toBe(createdAtMs(player) + 34_286);
    } finally {
      await server.close();
    }
  });
});

// --- Configuração ---------------------------------------------------------------

describe('GAME_TIME_SCALE na configuração', () => {
  const base = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgres://lotg:lotg@localhost:5432/lotg',
    JWT_SECRET,
    RECOVERY_CODE_SECRET,
  };

  it('sem a variável, o padrão é 3', () => {
    expect(loadConfig(base).gameTimeScale).toBe(3);
  });

  it.each([
    ['0.5', 0.5],
    ['1', 1],
    ['2.5', 2.5],
    ['10', 10],
  ])('aceita %s', (value, expected) => {
    expect(loadConfig({ ...base, GAME_TIME_SCALE: value }).gameTimeScale).toBe(expected);
  });

  it.each(['0', '11', 'rápido', '0.49', '10.01', '-3', 'NaN', 'Infinity'])(
    'recusa %s no arranque, citando só o nome da variável',
    async (value) => {
      let thrown: unknown;
      try {
        loadConfig({ ...base, GAME_TIME_SCALE: value });
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(ConfigError);
      const { message } = thrown as ConfigError;
      expect(message).toBe('Configuração inválida:\n  - GAME_TIME_SCALE tem valor inválido.');
      expect(message).not.toContain(value);

      // A instância nem chega a subir.
      expect(() => testConfig({ GAME_TIME_SCALE: value })).toThrow(ConfigError);
      await expect(createTestApp({ config: { GAME_TIME_SCALE: value } })).rejects.toBeInstanceOf(
        ConfigError,
      );
    },
  );
});
