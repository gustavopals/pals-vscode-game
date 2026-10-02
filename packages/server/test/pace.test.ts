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
  quietHorde,
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

// Ritmo das partidas (ADR 0011; ADR 0013, decisão 2a): sem escolha no corpo de POST /games, o
// servidor grava GAME_TIME_SCALE na partida nova; com `timeScale`, vale o escolhido. O motor
// segue em tempo de jogo e a visão sai em tempo real. Os números de jogo usados aqui são os do
// GDD no ritmo Normal: melhoria das Habitações em 4 min, aldeão em 20 min (16 na primavera, em
// que toda partida nasce), dia de 2 h, 180 de comida inicial, 10 de comida por fazendeiro por hora
// (12 na primavera) e 1 de consumo por aldeão por hora.

const SECOND = 1000;
const PACE = 3;
/** O rótulo que a visão mostra em cada ritmo oferecido (GDD §4.2). */
const PACE_LABELS: Record<number, string> = {
  3: 'Rápido: um ano em 56 horas',
  1: 'Normal: um ano em 7 dias',
  0.5: 'Tranquilo: um ano em 14 dias',
};

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
  // As taxas da visão têm até três casas (milésimos); o produto em ponto flutuante é limpo aqui.
  const scaled = (rate: number) => Math.round(rate * pace * 1000) / 1000;
  // O que resta das 24 h reais de uma carta, vista no outro ritmo no mesmo instante de jogo.
  const CARD_DEADLINE = 24 * 3600;
  const deadline = (seconds: number) => CARD_DEADLINE - down(CARD_DEADLINE - seconds);
  const underway = (work: ViewState['constructions']['active']) =>
    work === null
      ? null
      : {
          ...work,
          secondsRemaining: up(work.secondsRemaining),
          totalSeconds: up(work.totalSeconds),
        };
  return {
    ...view,
    settlement: { ...view.settlement, paceLabel: PACE_LABELS[pace] ?? '' },
    calendar: {
      ...view.calendar,
      secondsToNextDay: up(view.calendar.secondsToNextDay),
      secondsToNextSeason: up(view.calendar.secondsToNextSeason),
      nextSeason: {
        ...view.calendar.nextSeason,
        secondsUntil: up(view.calendar.nextSeason.secondsUntil),
        firewood: firewoodAtPace(view.calendar.nextSeason.firewood, pace),
        // A previsão da comida: o saldo é uma taxa e o prazo, contado de agora, um prazo.
        food:
          view.calendar.nextSeason.food === null
            ? null
            : {
                ...view.calendar.nextSeason.food,
                perHour: scaled(view.calendar.nextSeason.food.perHour),
                depletesInSeconds:
                  view.calendar.nextSeason.food.depletesInSeconds === null
                    ? null
                    : down(view.calendar.nextSeason.food.depletesInSeconds),
              },
      },
      // A estação da lenha, quando ainda vem: o prazo até ela é um prazo, e a conta, a mesma.
      nextFirewoodSeason:
        view.calendar.nextFirewoodSeason === null
          ? null
          : {
              ...view.calendar.nextFirewoodSeason,
              secondsUntil: up(view.calendar.nextFirewoodSeason.secondsUntil),
              firewood:
                firewoodAtPace(view.calendar.nextFirewoodSeason.firewood, pace) ??
                view.calendar.nextFirewoodSeason.firewood,
            },
    },
    // Os feridos são os mesmos; o prazo até o primeiro sarar é um prazo como os outros.
    population: {
      ...view.population,
      secondsToNextRecruit:
        view.population.secondsToNextRecruit === null
          ? null
          : up(view.population.secondsToNextRecruit),
      secondsToNextRecovery:
        view.population.secondsToNextRecovery === null
          ? null
          : up(view.population.secondsToNextRecovery),
    },
    resources: view.resources.map((entry) => ({
      ...entry,
      perHour: scaled(entry.perHour),
      depletesInSeconds: entry.depletesInSeconds === null ? null : down(entry.depletesInSeconds),
      // "Cheio em" é um prazo como os outros; o que vai ao chão por hora é uma taxa.
      fullInSeconds: entry.fullInSeconds === null ? null : up(entry.fullInSeconds),
      wastingPerHour: scaled(entry.wastingPerHour),
    })),
    // O prazo da adaptação de quem troca de ofício é um prazo como os outros.
    workersRules: {
      ...view.workersRules,
      adaptationSeconds: up(view.workersRules.adaptationSeconds),
    },
    workers: view.workers.map((entry) => ({
      ...entry,
      grossPerHour: scaled(entry.grossPerHour),
      perWorkerPerHour: scaled(entry.perWorkerPerHour),
      perNewWorkerPerHour: scaled(entry.perNewWorkerPerHour),
      adaptationEndsInSeconds:
        entry.adaptationEndsInSeconds === null ? null : up(entry.adaptationEndsInSeconds),
      adaptingCohorts: entry.adaptingCohorts.map((cohort) => ({
        ...cohort,
        endsInSeconds: up(cohort.endsInSeconds),
      })),
    })),
    constructions: {
      ...view.constructions,
      active: underway(view.constructions.active),
      queues: view.constructions.queues.map(underway),
      planned: view.constructions.planned.map((entry) => ({
        ...entry,
        durationSeconds: up(entry.durationSeconds),
        // O prazo da espera de uma planejada é um prazo como os outros.
        waiting:
          entry.waiting === null
            ? null
            : {
                ...entry.waiting,
                etaSeconds: entry.waiting.etaSeconds === null ? null : up(entry.waiting.etaSeconds),
              },
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
    // A moral é a mesma; os prazos dela (a próxima virada, o fim de um efeito) são prazos.
    morale: {
      ...view.morale,
      nextUpdateInSeconds: up(view.morale.nextUpdateInSeconds),
      effects: view.morale.effects.map((effect) => ({
        ...effect,
        endsInSeconds: up(effect.endsInSeconds),
      })),
    },
    // O Conselho: a cadência é tempo de jogo, e o prazo até a audiência, um prazo como os
    // outros. O prazo de resposta de uma carta é o único de tempo real (24 h em qualquer
    // ritmo): no mesmo instante de jogo, o que já se gastou dele é que se divide.
    council: {
      ...view.council,
      nextCardInSeconds:
        view.council.nextCardInSeconds === null ? null : up(view.council.nextCardInSeconds),
      nextAudienceInSeconds: up(view.council.nextAudienceInSeconds),
      pending: view.council.pending.map((card) => ({
        ...card,
        expiresInSeconds: deadline(card.expiresInSeconds),
      })),
    },
    pendingDecisions: view.pendingDecisions.map((decision) => ({
      ...decision,
      expiresInSeconds: deadline(decision.expiresInSeconds),
    })),
    // A Ameaça é a mesma; a próxima subida e a chegada de uma incursão são prazos.
    threat: view.threat.known
      ? {
          ...view.threat,
          nextRiseInSeconds: up(view.threat.nextRiseInSeconds),
          incoming:
            view.threat.incoming === null
              ? null
              : { ...view.threat.incoming, inSeconds: up(view.threat.incoming.inSeconds) },
        }
      : view.threat,
    winter:
      view.winter === null
        ? null
        : {
            firewoodPerHour: scaled(view.winter.firewoodPerHour),
            firewood: firewoodAtPace(view.winter.firewood, pace) ?? view.winter.firewood,
            cold:
              view.winter.cold === null
                ? null
                : {
                    ...view.winter.cold,
                    secondsElapsed: down(view.winter.cold.secondsElapsed),
                  },
          },
  };
}

type Firewood = NonNullable<ViewState['calendar']['nextSeason']['firewood']>;

/** A conta da lenha em outro ritmo: só a taxa por hora muda; os totais são de jogo. */
function firewoodAtPace(firewood: Firewood | null, pace: number): Firewood | null {
  return firewood === null
    ? null
    : { ...firewood, perHour: Math.round(firewood.perHour * pace * 1000) / 1000 };
}

/**
 * A visão sem os textos de explicação que citam taxas por hora: os das taxas e, no inverno ou às
 * portas dele, os que dizem quanto a lareira queima por hora.
 */
function withoutRateTexts(view: ViewState): ViewState {
  return {
    ...view,
    calendar: {
      ...view.calendar,
      seasonEffects: view.winter === null ? view.calendar.seasonEffects : '',
      nextSeason: {
        ...view.calendar.nextSeason,
        changes: view.calendar.nextSeason.firewood === null ? view.calendar.nextSeason.changes : [],
        // A frase da previsão da comida cita o saldo por hora e um prazo em tempo real.
        food:
          view.calendar.nextSeason.food === null
            ? null
            : { ...view.calendar.nextSeason.food, text: '' },
      },
    },
    // A frase de um depósito cheio cita o que vai ao chão por hora.
    resources: view.resources.map((entry) => ({
      ...entry,
      breakdown: '',
      fullNote: entry.wastingPerHour > 0 ? '' : entry.fullNote,
    })),
    workers: view.workers.map((entry) => ({ ...entry, breakdown: '' })),
    // A frase da troca de ofício diz o prazo da adaptação em tempo real.
    workersRules: { ...view.workersRules, adaptationText: '' },
    // As frases da moral citam prazos em tempo real (a comida guardada "para 8 h", a deserção
    // "depois de 4 h de fome"): os números e as faixas são conferidos, os textos, por extenso.
    morale: {
      ...view.morale,
      terms: view.morale.terms.map((term) => ({ ...term, label: '' })),
      breakdown: '',
      advice: view.morale.advice === null ? null : '',
      foodReserve: { ...view.morale.foodReserve, text: '' },
      notes: view.morale.notes.map(() => ''),
    },
    winter:
      view.winter === null || view.winter.cold === null
        ? view.winter
        : { ...view.winter, cold: { ...view.winter.cold, text: '' } },
    // As regras do Conselho citam a cadência em tempo real, e o efeito de uma opção, quanto
    // dura a moral dela: os números são conferidos, as frases, por extenso em `council.test.ts`.
    council: {
      ...view.council,
      rulesText: '',
      pending: view.council.pending.map((card) => ({
        ...card,
        options: card.options.map((option) => ({ ...option, effectsText: '' })),
      })),
    },
    // As frases da Torre de Vigia citam a antecedência do aviso em tempo real, e a tendência
    // da Ameaça, quanto dura um dia de jogo: os números são conferidos, as frases, por extenso
    // em `threat.test.ts`.
    constructions: {
      ...view.constructions,
      available: view.constructions.available.map((entry) =>
        entry.building === 'watchtower' ? { ...entry, effect: '' } : entry,
      ),
      planned: view.constructions.planned.map((entry) =>
        entry.building === 'watchtower' ? { ...entry, effect: '' } : entry,
      ),
    },
    // A frase dos feridos diz em quanto tempo real eles saram.
    population: {
      ...view.population,
      injuredNote: view.population.injuredNote === null ? null : '',
    },
    // As frases das incursões citam prazos em tempo real: quando a marcada chega, quanto dura
    // um ferimento. Os números são conferidos; as frases, por extenso em `raids.test.ts`.
    threat: view.threat.known
      ? {
          ...view.threat,
          watchtower: { ...view.threat.watchtower, text: '', next: '' },
          trend: '',
          raidRisk: '',
          raidCosts: [],
          incoming:
            view.threat.incoming === null ? null : { ...view.threat.incoming, costText: '' },
        }
      : { ...view.threat, watchtower: { ...view.threat.watchtower, text: '', next: '' } },
  };
}

/** A visão sem o saldo por hora dos recursos nem o que vai ao chão, conferidos à parte. */
function withoutNetRates(view: ViewState): ViewState {
  const { nextSeason } = view.calendar;
  return {
    ...view,
    calendar: {
      ...view.calendar,
      nextSeason: {
        ...nextSeason,
        food: nextSeason.food === null ? null : { ...nextSeason.food, perHour: 0 },
      },
    },
    resources: view.resources.map((entry) => ({ ...entry, perHour: 0, wastingPerHour: 0 })),
  };
}

function expectSameWorld(fastView: ViewState, normalView: ViewState): void {
  const expected = atPace(normalView, PACE);
  expect(withoutNetRates(withoutRateTexts(fastView))).toEqual(
    withoutNetRates(withoutRateTexts(expected)),
  );
  // O saldo por hora sai da visão arredondado a uma casa. O triplo de um valor já arredondado
  // pode ficar a até duas casas decimais de distância do triplo de verdade, também arredondado
  // (10,368 vira 10,4 e o triplo 31,2; 31,104 vira 31,1).
  for (const [index, entry] of fastView.resources.entries()) {
    const tripled = expected.resources[index]?.perHour ?? Number.NaN;
    expect(Math.abs(entry.perHour - tripled), entry.id).toBeLessThanOrEqual(0.2 + 1e-9);
    // O que vai ao chão com o depósito cheio é o mesmo saldo, com o mesmo arredondamento.
    const wasted = expected.resources[index]?.wastingPerHour ?? Number.NaN;
    expect(Math.abs(entry.wastingPerHour - wasted), entry.id).toBeLessThanOrEqual(0.2 + 1e-9);
    expect(entry.wastingPerHour > 0, entry.id).toBe(wasted > 0);
  }
  // O saldo de comida da estação que vem é um saldo como os outros, com o mesmo arredondamento.
  const ahead = fastView.calendar.nextSeason.food;
  const aheadTripled = expected.calendar.nextSeason.food;
  if (ahead !== null && aheadTripled !== null) {
    expect(Math.abs(ahead.perHour - aheadTripled.perHour)).toBeLessThanOrEqual(0.2 + 1e-9);
  }
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

  it('o ritmo escolhido no corpo vale mais que o do servidor (ADR 0013, decisão 2a)', async () => {
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
    expect(reply.body.game.timeScale).toBe(1);
    const { rows } = await fast.pool.query<{ time_scale: string; state_scale: number }>(
      "select time_scale, (state -> 'settings' ->> 'timeScale')::float as state_scale from games where id = $1",
      [reply.body.game.id],
    );
    expect(Number(rows[0]?.time_scale)).toBe(1);
    expect(rows[0]?.state_scale).toBe(1);
    // E a partida anda no ritmo escolhido: o dia de jogo dura 2 h reais, não 40 min.
    const view = await call<ViewResponse>(fast, 'GET', `/games/${reply.body.game.id}/view`, {
      token: auth.accessToken,
    });
    expect(view.body.view.calendar.secondsToNextDay).toBe(7200);
    expect(view.body.view.settlement.paceLabel).toBe('Normal: um ano em 7 dias');
  });

  it.each([2, 7, 0, '1', null])(
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
    // Primavera: a comida rende × 1,2 e o recrutamento leva × 0,8.
    expect(worker(normalView, 'farm').perWorkerPerHour).toBe(12);
    expect(upgradeOf(normalView, 'housing').durationSeconds).toBe(240);
    expect(normalView.recruitment.secondsPerVillager).toBe(960);

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
      breakdown:
        'Fazenda: 0 trabalhadores × 30 × 1 (Nv1) × 1,2 (primavera) = 0/h; consumo 5 × 3 = 15/h',
    });
    expect(fastView.workers.map((entry) => [entry.building, entry.perWorkerPerHour])).toEqual([
      ['farm', 36],
      ['lumberMill', 24],
      ['quarry', 15],
      ['goldMine', 12],
    ]);
    expect(upgradeOf(fastView, 'housing').durationSeconds).toBe(80);
    expect(upgradeOf(fastView, 'townHall').durationSeconds).toBe(200);
    expect(fastView.recruitment.secondsPerVillager).toBe(320);

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
    expect(fastReply.view.population.secondsToNextRecruit).toBe(320);
    // Os dois lavradores acabaram de chegar: rendem metade por um dia de jogo, 40 minutos reais.
    expect(resource(fastReply.view, 'food')).toMatchObject({
      perHour: 21,
      breakdown:
        'Fazenda: 2 trabalhadores (2 em adaptação por 40 min, valendo metade: contam como 1) × 30 × 1 (Nv1) × 1,2 (primavera) = 36/h; consumo 5 × 3 = 15/h',
    });
    expect(worker(fastReply.view, 'farm')).toMatchObject({
      grossPerHour: 36,
      perWorkerPerHour: 36,
      perNewWorkerPerHour: 18,
      adapting: 2,
      adaptationEndsInSeconds: 2400,
      breakdown:
        '2 trabalhadores (2 em adaptação por 40 min, valendo metade: contam como 1) × 30 × 1 (Nv1) × 1,2 (primavera) = 36/h',
    });
    expect(fastReply.view.workersRules).toMatchObject({
      adaptationSeconds: 2400,
      adaptationText: 'Quem troca de ofício produz metade por 40 min.',
    });
    expect(normalReply.view.workersRules).toMatchObject({
      adaptationSeconds: 7200,
      adaptationText: 'Quem troca de ofício produz metade por 2 h.',
    });

    // Instantes de jogo: 3 min (obra a 75%), 15 min 57 s (aldeão a 3 s de jogo de chegar),
    // 30 min (obra pronta, aldeão em casa) e 3 h (depois da primeira virada de dia).
    const checkpoints = [3 * MINUTE, 15 * MINUTE + 57 * SECOND, 30 * MINUTE, 3 * HOUR];
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
        expect(fastView.population.secondsToNextRecruit).toBe(260);
      }
      if (checkpoint === 15 * MINUTE + 57 * SECOND) {
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
        // Três lenhadores recém-chegados: metade de 24 por hora de jogo, vistos no ritmo 3.
        expect(resource(fastOrder.view, 'wood').perHour).toBe(36);
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

    // Por hora de jogo, na primavera: os dois lavradores, recém-chegados, rendem metade no
    // primeiro dia de jogo (12 − 5 de consumo = +7). No ritmo 1 passou uma hora de jogo. No
    // ritmo 3 passaram três: duas a +7 e uma já com os lavradores adaptados, 4 de experiência
    // e a moral em 60 (2 × 10 × 1,2 × 1,012 × 1,05 − 5 = +20,502 por hora de jogo, +61,5 por
    // hora real).
    expect(resource(normalView, 'food')).toMatchObject({ stock: 187, perHour: 7 });
    expect(resource(fastView, 'food')).toMatchObject({ stock: 214, perHour: 61.5 });
    // A moral fala em tempo real: a virada em 20 min, a comida guardada "para 8 h".
    expect(normalView.morale).toMatchObject({ value: 50, nextUpdateInSeconds: 3600 });
    expect(normalView.morale.terms[1]?.label).toBe('Comida guardada para 24 h');
    expect(fastView.morale).toMatchObject({
      value: 60,
      multiplierPercent: 105,
      nextUpdateInSeconds: 1200,
      breakdown: '50 (base) + 10 (comida guardada para 8 h) = 60',
    });
    expect(fastView.morale.foodReserve.text).toBe(
      'Há comida guardada para 8 h (120 para 5 habitantes): a moral ganha 10.',
    );
    expect(normalView.workers[0]).toMatchObject({ adapting: 2, adaptationEndsInSeconds: 3600 });
    expect(fastView.workers[0]).toMatchObject({ adapting: 0, experience: 4 });
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
    // Na primavera o treinamento leva 16 min de jogo: 960 s no ritmo Normal, 320 s no 3.
    expect(normalOrder.view.population.secondsToNextRecruit).toBe(960);
    expect(fastOrder.view.population).toMatchObject({
      villagers: 5,
      inTraining: 1,
      secondsToNextRecruit: 320,
    });
    const orderedAt = fast.clock.now().getTime();

    await wait(fast, quick, 319 * SECOND);
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
      atMs: 16 * MINUTE,
      at: new Date(orderedAt + 320 * SECOND).toISOString(),
    });

    // No ritmo Normal, 320 s depois o aldeão ainda está a caminho; chega aos 960 s.
    await wait(normal, slow, 320 * SECOND);
    expect((await viewOf(normal, slow)).population).toMatchObject({
      villagers: 5,
      secondsToNextRecruit: 640,
    });
    await wait(normal, slow, 640 * SECOND);
    expect((await viewOf(normal, slow)).population.villagers).toBe(6);
  });

  it('sem fazendeiros, a comida inicial acaba em 12 horas reais, com o instante exato na Crônica', async () => {
    const player = await newPlayer(fast);
    // O prazo anunciado é o de quem não é atacado no caminho: os lobos do roteiro levariam
    // comida às 10 h reais, e a previsão não conta com o que os vigias não viram.
    await quietHorde(fast, player.game.id);
    const start = await viewOf(fast, player);
    expect(resource(start, 'food').depletesInSeconds).toBe(12 * 3600);

    // Um segundo real antes: ainda há comida (3 s de jogo de consumo) e não há fome.
    await wait(fast, player, 12 * HOUR - SECOND);
    const almost = await viewOf(fast, player);
    expect(almost.famine).toBeNull();
    expect(resource(almost, 'food')).toMatchObject({ perHour: -15, depletesInSeconds: 1 });
    // Até aqui a Crônica só tem as audiências do Conselho, que não são assunto deste teste.
    const withoutCards = (entries: Array<{ type: string }>) =>
      entries.filter((entry) => !entry.type.startsWith('card'));
    expect(withoutCards(await chronicleOf(fast, player))).toEqual([]);

    fast.clock.advance(SECOND);
    const hungry = await viewOf(fast, player);
    expect(hungry.famine).toMatchObject({ sinceMs: 36 * HOUR, secondsElapsed: 0 });
    expect(resource(hungry, 'food')).toMatchObject({ stock: 0, depletesInSeconds: null });

    const exact = new Date(createdAtMs(player) + 12 * HOUR).toISOString();
    const chronicle = withoutCards(await chronicleOf(fast, player));
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
      expect(first.recruitment.secondsPerVillager).toBe(960);

      const ordered = await accepted(
        after,
        player,
        order('setWorkers', { building: 'farm', count: 2 }),
      );
      // Dois lavradores recém-chegados, no ritmo 1: 12 − 5 por hora, por 2 h reais.
      expect(resource(ordered.view, 'food').perHour).toBe(7);
      expect(ordered.view.workersRules.adaptationSeconds).toBe(7200);
      await accepted(after, player, order('startConstruction', { building: 'housing' }));

      // 80 s depois (o prazo do ritmo 3) a obra não terminou: o prazo dela é de 240 s.
      before.clock.advance(80 * SECOND);
      expect((await viewOf(after, player)).constructions.active?.secondsRemaining).toBe(160);
      before.clock.advance(160 * SECOND);
      expect((await viewOf(after, player)).constructions.active).toBeNull();

      // Uma hora real depois da criação: uma hora de jogo, +7 de comida (os lavradores ainda
      // se adaptam, por 2 h reais neste ritmo), ainda no 1º dia.
      await wait(after, player, HOUR - 240 * SECOND);
      const later = await viewOf(after, player);
      expect(resource(later, 'food')).toMatchObject({ stock: 187, perHour: 7 });
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

// --- Estações ---------------------------------------------------------------------

describe('as estações no relógio real (V2C-T1)', () => {
  const DAY = 2 * HOUR;
  const WINTER = 72 * DAY;
  const YEAR = 84 * DAY;

  it('no ritmo 3, o inverno chega em 48 horas reais; sem madeira, o frio abre na virada e a Crônica o registra', async () => {
    const player = await newPlayer(fast);
    // Só as estações: sem os lobos, que feririam lavradores e mexeriam na moral.
    await quietHorde(fast, player.game.id);
    const created = createdAtMs(player);
    // Todos na Fazenda (a comida sobra o ano inteiro) e a madeira inteira em uma obra: a
    // Pedreira custa 120 de madeira, tudo o que o feudo tem.
    await accepted(fast, player, order('setWorkers', { building: 'farm', count: 5 }));
    const built = await accepted(fast, player, order('startConstruction', { building: 'quarry' }));
    expect(resource(built.view, 'wood').stock).toBe(0);
    expect(built.view.winter).toBeNull();
    expect(built.view.calendar.seasonEffects).toBe(
      'Primavera: comida × 1,2; recrutamento com prazo × 0,8.',
    );

    // Outono, dois dias de jogo antes do inverno: a visão já faz a conta da lenha, com a taxa
    // por hora real e os totais do inverno inteiro.
    await wait(fast, player, (WINTER - 2 * DAY) / PACE);
    const autumn = await viewOf(fast, player);
    expect(autumn.calendar).toMatchObject({ season: 'autumn', dayOfSeason: 23 });
    expect(autumn.calendar.nextSeason).toMatchObject({
      id: 'winter',
      label: 'Inverno',
      secondsUntil: (2 * DAY) / PACE / SECOND,
      firewood: {
        perHour: 7.5,
        winterTotal: 60,
        winterProduction: 0,
        stock: 0,
        missing: 60,
        text: 'O Inverno vai queimar 60 de madeira com 5 habitantes. A Serraria repõe 0 e há 0 em estoque: faltam 60 de madeira.',
      },
    });
    expect(autumn.calendar.nextSeason.changes).toContain(
      'A lareira passa a queimar 1,5 de madeira por habitante por hora; sem madeira, vem o frio.',
    );

    // Um segundo real antes da virada ainda é outono; na virada, o frio.
    await wait(fast, player, (2 * DAY) / PACE - SECOND);
    expect((await viewOf(fast, player)).winter).toBeNull();
    fast.clock.advance(SECOND);
    const winter = await viewOf(fast, player);
    expect(winter.calendar).toMatchObject({ season: 'winter', dayOfSeason: 1 });
    expect(winter.winter).toMatchObject({
      firewoodPerHour: 7.5,
      firewood: { perHour: 7.5, winterTotal: 60, winterProduction: 0, stock: 0, missing: 60 },
      cold: { secondsElapsed: 0 },
    });
    expect(winter.winter?.cold?.text).toContain('a produção de todo o feudo cai para 80%');
    expect(winter.winter?.cold?.text).toContain('A lareira pede 7,5/h e a Serraria entrega 0/h');
    expect(resource(winter, 'wood')).toMatchObject({ stock: 0, perHour: -7.5 });
    expect(resource(winter, 'wood').breakdown).toBe(
      'Serraria: 0 trabalhadores × 24 × 1 (Nv1) × 0,8 (inverno) × 1,05 (moral 60) × 0,8 (frio) = 0/h; −7,5/h (lenha de 5 habitantes)',
    );
    // Inverno com frio: 5 × 30 × 0,4 × 0,8 = 48 por hora real, × 1,3 do ofício, dominado em
    // três estações de Fazenda ocupada, × 1,05 da moral: a virada que trouxe o inverno a
    // calculou antes de o frio abrir, e o frio só pesa nela na virada seguinte.
    expect(worker(winter, 'farm')).toMatchObject({
      grossPerHour: 65.52,
      perWorkerPerHour: 13.104,
      experience: 100,
    });
    // A obra iniciada agora leva × 1,5, e a visão diz por quê.
    expect(upgradeOf(winter, 'housing')).toMatchObject({
      durationSeconds: 120,
      durationNote: 'No Inverno, o prazo de uma obra iniciada agora é × 1,5.',
    });
    expect(winter.recruitment).toMatchObject({ secondsPerVillager: 400, durationNote: null });

    const started = (await eventsOf(fast, player)).filter((event) => event.type === 'coldStarted');
    expect(started).toHaveLength(1);
    expect(started[0]).toMatchObject({
      atMs: WINTER,
      at: new Date(created + WINTER / PACE).toISOString(),
      text: 'No 1º dia do Inverno, queimou-se a última acha de lenha em Pedra Alta. O frio entrou nas casas.',
    });

    // Uma hora real de frio depois, o senhor manda dois aldeões para a Serraria: a lareira
    // volta. Um só já não bastaria: o dia virou com o frio aberto, a moral caiu de 60 para 40, e
    // um lenhador recém-chegado rende 8 × 0,8 × 0,8 × metade × 0,95 = 2,43, menos que os 2,5
    // da lenha.
    await wait(fast, player, HOUR);
    const cold = await viewOf(fast, player);
    expect(cold.winter?.cold?.secondsElapsed).toBe(3600);
    expect(cold.morale).toMatchObject({ value: 40, band: 'restless', bandLabel: 'Inquieto' });
    expect(cold.morale.advice).toContain('O que mais pesa é o frio (−20)');
    await accepted(fast, player, order('setWorkers', { building: 'farm', count: 3 }));
    const warmed = await accepted(
      fast,
      player,
      order('setWorkers', { building: 'lumberMill', count: 2 }),
    );
    expect(warmed.events.map((event) => event.type)).toEqual(['coldEnded']);
    expect(warmed.events[0]).toMatchObject({
      atMs: WINTER + 3 * HOUR,
      text: 'No 2º dia do Inverno, as lareiras voltaram a arder em Pedra Alta. O frio passou.',
      data: { reason: 'firewood', sinceMs: WINTER },
    });
    expect(warmed.view.winter).toMatchObject({ firewoodPerHour: 7.5, cold: null });
    // Sem o frio, os dois lenhadores recém-chegados rendem metade, ainda com a moral em 40:
    // 2 × 8 × 0,8 × 0,5 × 0,95 = 6,08 por hora de jogo, menos 2,5 de lenha; por hora real, o
    // triplo. Com o frio seriam 4,86: ainda acima da lenha.
    expect(resource(warmed.view, 'wood').perHour).toBe(10.7);
    // A moral só se refaz na virada: a visão diz que ela volta a 60.
    expect(warmed.view.morale).toMatchObject({ value: 40, next: { value: 60, band: 'content' } });

    // A Crônica conta o frio como contou a fome: começo e fim, cada um uma vez.
    const chronicle = await chronicleOf(fast, player);
    expect(
      chronicle.filter((entry) => entry.type.startsWith('cold')).map((entry) => entry.type),
    ).toEqual(['coldStarted', 'coldEnded']);

    // E a primavera chega na hora marcada, sem lareira nenhuma na visão.
    await wait(fast, player, (YEAR - WINTER - 3 * HOUR) / PACE);
    const spring = await viewOf(fast, player);
    expect(spring.calendar).toMatchObject({ year: 2, season: 'spring', dayOfSeason: 1 });
    expect(spring.winter).toBeNull();
    expect(resource(spring, 'wood').depletesInSeconds).toBeNull();
  });

  it('o mesmo inverno nos dois ritmos é o mesmo mundo, com prazos ÷3 e taxas ×3', async () => {
    const quick = await newPlayer(fast);
    const slow = await newPlayer(normal);
    for (const [server, player] of [
      [fast, quick],
      [normal, slow],
    ] as const) {
      await accepted(server, player, order('setWorkers', { building: 'farm', count: 4 }));
      await accepted(server, player, order('setWorkers', { building: 'quarry', count: 1 }));
      await accepted(server, player, order('startConstruction', { building: 'farm' }));
    }
    // A cada audiência do Conselho (de 4 em 4 dias de jogo, o ano inteiro) os dois senhores
    // respondem na hora, com a opção que o conselho aplicaria sozinho. Sem isso os mundos se
    // separam, e é de propósito: o prazo de resposta é de tempo real (24 h em qualquer ritmo),
    // então uma carta sem resposta expira em instantes de jogo diferentes em cada ritmo.
    const audiences = Array.from({ length: YEAR / (4 * DAY) }, (_, index) => (index + 1) * 4 * DAY);
    // 40 de madeira e 5 habitantes: a lenha dura 16 horas de jogo de inverno.
    const instants = [WINTER - DAY, WINTER + 7 * HOUR + 1234 * SECOND, WINTER + 17 * HOUR];
    const stops = [...new Set([...audiences, ...instants])].sort((a, b) => a - b);
    let gameNow = 0;
    for (const instant of stops) {
      await wait(fast, quick, (instant - gameNow) / PACE);
      await wait(normal, slow, instant - gameNow);
      gameNow = instant;
      if (audiences.includes(instant)) {
        for (const [server, player] of [
          [fast, quick],
          [normal, slow],
        ] as const) {
          for (const card of (await viewOf(server, player)).council.pending) {
            const { instanceId, defaultOptionId: optionId } = card;
            await accepted(server, player, order('answerCard', { instanceId, optionId }));
          }
        }
      }
      expectSameWorld(await viewOf(fast, quick), await viewOf(normal, slow));
    }
    const story = (events: GameEvent[]) =>
      events
        .filter((event) => event.type !== 'dayStarted')
        .map(({ type, atMs, text, data }) => ({ type, atMs, text, data }));
    const fastStory = story(await eventsOf(fast, quick));
    expect(fastStory).toEqual(story(await eventsOf(normal, slow)));
    // 40 de madeira dariam 16 horas de jogo de lareira; os lobos, que passam pelo feudo o ano
    // inteiro, levam uma parte a cada incursão, e o frio vem antes disso, no mesmo instante de
    // jogo nos dois ritmos.
    const cold = fastStory.filter((event) => event.type.startsWith('cold'));
    expect(cold).toMatchObject([
      { type: 'coldStarted' },
      { type: 'coldEnded', atMs: YEAR, data: { reason: 'thaw' } },
    ]);
    expect(cold[0]?.atMs).toBeGreaterThan(WINTER);
    expect(cold[0]?.atMs).toBeLessThan(WINTER + 16 * HOUR);
    // As incursões são tempo de jogo: os uivos, a do roteiro e as que a Ameaça sorteia caem
    // nos mesmos instantes, com as mesmas perdas e os mesmos feridos, nos dois ritmos.
    const raids = fastStory.filter((event) =>
      /^(wolvesHowl|raid|villager(Injured|Recovered))/.test(event.type),
    );
    expect(raids.filter((event) => event.type === 'raidSuffered').length).toBeGreaterThan(5);
    expect(raids[0]).toMatchObject({ type: 'wolvesHowl', atMs: 9 * DAY });
    expect(raids.find((event) => event.type === 'raidSuffered')).toMatchObject({
      atMs: 15 * DAY,
      data: { raidId: 'wolvesYear1', size: 'light' },
    });
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
      expect(view.settlement.paceLabel).toBe('Tranquilo: um ano em 14 dias');
      expect(view.calendar.secondsToNextDay).toBe(4 * 3600);
      expect(resource(view, 'food')).toMatchObject({ perHour: -2.5, depletesInSeconds: 72 * 3600 });
      expect(worker(view, 'farm').perWorkerPerHour).toBe(6);
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
      // O 7 não está entre os ritmos oferecidos: a partida nasce nele mesmo assim (é o padrão
      // deste servidor) e a visão dá um rótulo honesto, sem o nome de nenhum dos oferecidos.
      expect(player.game.timeScale).toBe(7);
      const first = await viewOf(server, player);
      expect(first.settlement.paceLabel).toBe('Ritmo 7×: um ano em 1 dia');
      // 240 s de jogo ÷ 7 = 34,29 s reais: a visão anuncia 35.
      const announced = upgradeOf(first, 'housing').durationSeconds;
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
