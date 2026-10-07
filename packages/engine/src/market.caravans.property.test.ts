import { balance } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { ambushLoss, caravanSlots } from './caravans';
import { applyCommand } from './commands';
import { currentShape } from './migrations';
import { cloneState, createInitialState } from './state';
import { addHero, command, HOUR, settings } from './test-helpers';
import { nextEventAt } from './timeline';
import type {
  Command,
  DifficultyId,
  GameEvent,
  GameState,
  MarketResourceId,
  PostureId,
} from './types';
import { deriveViewState } from './view';

const { caravan: rules } = balance.market;
const DAY_REAL = 24 * HOUR;

/**
 * Um feudo de verdade (objetivos, Conselho, lobos, moral, fome e a carta da estrangeira no
 * caminho, com os sorteios deles), com o Mercado e a Guilda de pé e três heróis. O senhor passa
 * pelo feudo em instantes quaisquer: manda caravanas, com e sem escolta, envia quem está livre
 * em expedição e negocia no balcão. As chegadas, as emboscadas e o nascimento e a morte de cada
 * fluxo `caravan:<id>` caem em instantes que nenhum teste escolheu, com entidades criadas por
 * ordem no meio de um trecho (README do motor, R5).
 */
const scenario = fc.record({
  seed: fc.constantFrom('pedra-alta', 'vau-do-corvo', 'porto-do-rio'),
  timeScale: fc.constantFrom(3, 1, 0.5),
  difficulty: fc.constantFrom<DifficultyId>('peasant', 'lord', 'ironKing'),
  marketLevel: fc.constantFrom(2, 3, 4, 5),
  tower: fc.constantFrom(0, 0, 1, 2),
  workers: fc.tuple(fc.nat(3), fc.nat(2), fc.nat(1), fc.nat(3)),
  // Em milésimos, para o resto do acumulador nascer "quebrado". Às vezes o ouro acaba no
  // caminho, e o soldo em atraso abre com um herói na estrada.
  gold: fc.integer({ min: 0, max: 300_000 }),
  wood: fc.integer({ min: 100_000, max: 499_000 }),
  warmUpMs: fc.nat(2 * DAY_REAL),
  visits: fc.array(
    fc.record({
      // Em tempo real: no ritmo 3 são até 6 h de jogo por visita, mais que uma viagem.
      afterRealMs: fc.integer({ min: 1, max: 2 * HOUR }),
      resource: fc.constantFrom<MarketResourceId>('food', 'wood', 'stone'),
      amount: fc.integer({ min: 1, max: 320 }),
      escort: fc.constantFrom('none', 'none', 'first', 'last'),
      second: fc.boolean(),
      expedition: fc.boolean(),
      posture: fc.constantFrom<PostureId>('cautious', 'balanced', 'bold'),
      sell: fc.nat(120),
      watchtower: fc.boolean(),
    }),
    { minLength: 6, maxLength: 12 },
  ),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;
type Visit = Scenario['visits'][number];

function prepare(plan: Scenario): GameState {
  const state = cloneState(
    createInitialState(plan.seed, {
      ...settings,
      timeScale: plan.timeScale,
      difficulty: plan.difficulty,
    }),
  );
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  Object.assign(state.settlement.buildings, {
    townHall: 3,
    guild: 1,
    market: plan.marketLevel,
    watchtower: plan.tower,
  });
  state.settlement.population.villagers = 10;
  Object.assign(state.settlement.workers, { farm, lumberMill, quarry, goldMine });
  state.settlement.resources.gold = plan.gold;
  state.settlement.resources.wood = plan.wood;
  addHero(state, { name: 'Edda', gender: 'f', classId: 'warrior', level: 3, traits: ['brave'] });
  addHero(state, { name: 'Rolf', classId: 'archer', level: 2, traits: ['prudent', 'tracker'] });
  addHero(state, { name: 'Brann', classId: 'mage', level: 2, traits: ['loyal'] });
  return advanceTo(state, Math.round(plan.warmUpMs * plan.timeScale)).state;
}

/** As ordens de uma visita, lidas da visão: aceitas ou recusadas, o estado segue. */
function visit(state: GameState, plan: Visit): { state: GameState; events: GameEvent[] } {
  const now = state.lastProcessedAt;
  const view = deriveViewState(state, now);
  const orders: Command[] = [];
  const { eligibleEscortIds } = view.market.caravanOffer;
  const escort =
    plan.escort === 'none'
      ? null
      : ((plan.escort === 'first' ? eligibleEscortIds[0] : eligibleEscortIds.at(-1)) ?? null);
  orders.push(
    command('sendCaravan', {
      resource: plan.resource,
      amount: plan.amount,
      escortHeroId: escort,
      quoteDay: view.market.quoteDay,
    }),
  );
  if (plan.second) {
    orders.push(
      command('sendCaravan', {
        resource: 'wood',
        amount: 40,
        escortHeroId: null,
        quoteDay: view.market.quoteDay,
      }),
    );
  }
  if (plan.expedition) {
    const free = view.guild.heroes.filter((hero) => hero.canDepart && hero.id !== escort);
    orders.push(
      command('sendExpedition', {
        modelId: 'patrol',
        heroIds: free.slice(0, 1).map((hero) => hero.id),
        posture: plan.posture,
      }),
    );
  }
  if (plan.sell > 0) {
    orders.push(
      command('trade', {
        resource: 'food',
        direction: 'sell',
        amount: plan.sell,
        quoteDay: state.market.quoteDay,
      }),
    );
  }
  if (plan.watchtower) {
    orders.push(command('startConstruction', { building: 'watchtower' }));
  }
  let current = state;
  const events: GameEvent[] = [];
  for (const order of orders) {
    const before = current;
    const result = applyCommand(current, order, now);
    if (result.ok) {
      // Uma ordem não sorteia: o gerador sai como entrou, e o fluxo da caravana não nasce.
      expect(result.state.rng).toStrictEqual(before.rng);
      current = result.state;
      events.push(...result.events);
    }
  }
  return { state: current, events };
}

const stored = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;

/** O que tem de valer em qualquer instante de qualquer partida com caravanas. */
function expectInvariants(state: GameState): void {
  // O estado inteiro continua na forma da versão: é o que o servidor confere ao gravar.
  expect(currentShape(stored(state), '')).toBeNull();
  // Fora do instante da chegada nenhum fluxo de caravana existe: nasce e é apagado nela (R1).
  expect(Object.keys(state.rng).filter((key) => key.startsWith('caravan:'))).toEqual([]);
  // Nunca mais caravanas do que os lugares; toda chegada é futura.
  expect(state.market.caravans.length).toBeLessThanOrEqual(caravanSlots(state));
  for (const caravan of state.market.caravans) {
    expect(caravan.arrivesAtMs).toBeGreaterThan(state.lastProcessedAt);
    expect(caravan.amount).toBeLessThanOrEqual(rules.maxUnits);
  }
  // Quem está em escolta escolta exatamente uma caravana.
  const escorts = state.market.caravans.flatMap((caravan) => caravan.escortHeroId ?? []);
  expect(new Set(escorts).size).toBe(escorts.length);
  expect(
    state.guild.heroes
      .filter((hero) => hero.status === 'escort')
      .map((hero) => hero.id)
      .sort(),
  ).toEqual([...escorts].sort());
  const { stats } = state;
  expect((stats.caravansSent ?? 0) - (stats.caravansArrived ?? 0)).toBe(
    state.market.caravans.length,
  );
  const next = nextEventAt(state);
  expect(next === null || next >= state.lastProcessedAt).toBe(true);
}

/** As chegadas de um lote de eventos: cada uma confere com a conta da regra. */
function tallyArrivals(events: GameEvent[]): { arrived: number; ambushed: number } {
  let arrived = 0;
  let ambushed = 0;
  for (const event of events) {
    if (event.type !== 'caravanArrived' && event.type !== 'caravanAmbushed') {
      continue;
    }
    arrived += 1;
    const { amount, sold, unitPrice, gold } = event.data as Record<string, number>;
    expect(gold).toBe((sold ?? 0) * (unitPrice ?? 0));
    if (event.type === 'caravanAmbushed') {
      ambushed += 1;
      expect(event.data.lost).toBe(ambushLoss(amount ?? 0));
      expect(sold).toBe((amount ?? 0) - ambushLoss(amount ?? 0));
    } else {
      expect(sold).toBe(amount);
    }
  }
  return { arrived, ambushed };
}

describe('a divisão de intervalo com caravanas, expedições e Mercado no caminho', () => {
  it('avançar de uma vez ou em dois pedaços dá o mesmo estado, os mesmos eventos, o mesmo gerador e os mesmos contadores, com ordens entre os avanços, nos três ritmos', () => {
    let sent = 0;
    let arrived = 0;
    let ambushed = 0;
    let escorted = 0;
    let expeditions = 0;
    let trades = 0;
    const paces = new Set<number>();
    fc.assert(
      fc.property(scenario, (plan) => {
        let state = prepare(plan);
        expectInvariants(state);
        for (const step of plan.visits) {
          const target = state.lastProcessedAt + Math.round(step.afterRealMs * plan.timeScale);
          const middle = state.lastProcessedAt + Math.floor((target - state.lastProcessedAt) / 3);
          const direct = advanceTo(state, target);
          const half = advanceTo(state, middle);
          // O estado passa pelo banco no corte: é o que o servidor faz entre duas leituras.
          const split = advanceTo(stored(half.state), target);
          expect(split.state).toStrictEqual(direct.state);
          expect(split.state.rng).toStrictEqual(direct.state.rng);
          expect(split.state.ids).toStrictEqual(direct.state.ids);
          expect([...half.events, ...split.events]).toStrictEqual(direct.events);
          expectInvariants(half.state);
          expectInvariants(direct.state);
          // A visão e a linha do tempo não tocam o gerador nem os contadores.
          const frozen = JSON.stringify(direct.state);
          deriveViewState(direct.state, target, { timeScale: plan.timeScale });
          nextEventAt(direct.state);
          expect(JSON.stringify(direct.state)).toBe(frozen);

          const tally = tallyArrivals(direct.events);
          arrived += tally.arrived;
          ambushed += tally.ambushed;
          expeditions += direct.events.filter(
            (event) => event.type === 'expeditionReturned',
          ).length;

          const ordered = visit(direct.state, step);
          sent += ordered.events.filter((event) => event.type === 'caravanSent').length;
          escorted += ordered.events.filter(
            (event) => event.type === 'caravanSent' && event.data.escorted === 1,
          ).length;
          trades += ordered.events.filter((event) => event.type === 'marketTraded').length;
          expectInvariants(ordered.state);
          state = stored(ordered.state);
        }
        paces.add(plan.timeScale);
      }),
      { numRuns: 120 },
    );
    // A propriedade passou mesmo pelo que diz provar. Os pisos ficam longe do que as rodadas
    // dão (em seis rodadas: 370 a 454 enviadas, 221 a 305 chegadas, 120 a 148 com escolta, 7 a
    // 12 emboscadas): o plano é sorteado a cada execução, e com o piso das chegadas em 200 uma
    // rodada de 198 reprovou o portão sem defeito nenhum.
    expect(sent).toBeGreaterThan(200);
    expect(arrived).toBeGreaterThan(120);
    expect(escorted).toBeGreaterThan(50);
    expect(ambushed).toBeGreaterThan(0);
    expect(expeditions).toBeGreaterThan(30);
    expect(trades).toBeGreaterThan(100);
    expect([...paces].sort()).toEqual([0.5, 1, 3]);
  });

  it('30 dias sem acesso com caravanas na estrada dão o mesmo que 30 dias de visitas com a tela aberta', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        let sentAt = start;
        for (const step of plan.visits.slice(0, 2)) {
          sentAt = visit(sentAt, step).state;
        }
        const end = sentAt.lastProcessedAt + 30 * DAY_REAL * plan.timeScale;
        const away = advanceTo(sentAt, end);
        let visiting = sentAt;
        const told: GameEvent[] = [];
        for (let day = 1; day <= 30; day += 1) {
          const at = sentAt.lastProcessedAt + day * DAY_REAL * plan.timeScale;
          const next = advanceTo(visiting, at);
          deriveViewState(next.state, at, { timeScale: plan.timeScale });
          told.push(...next.events);
          visiting = stored(next.state);
        }
        expect(visiting).toStrictEqual(away.state);
        expect(told).toStrictEqual(away.events);
        expect(away.state.market.caravans).toEqual([]);
        expectInvariants(away.state);
      }),
      { numRuns: 12 },
    );
  });
});
