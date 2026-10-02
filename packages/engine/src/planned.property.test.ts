import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { queuesUnlocked } from './construction';
import { hasStartablePlan, planWait } from './planned';
import { command, gameAt, gameWith, HOUR, WINTER, YEAR } from './test-helpers';
import { nextEventAt } from './timeline';
import type { BuildingId, Command, GameEvent, GameState } from './types';

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
];

/** Dá as ordens no instante em que o estado está; as recusadas são simplesmente ignoradas. */
function order(start: GameState, orders: Command[]): GameState {
  let state = start;
  for (const next of orders) {
    const result = applyCommand(state, next, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
    }
  }
  return state;
}

/** Avança por uma lista de instantes e junta os eventos. */
function stepThrough(start: GameState, instants: number[]) {
  let state = start;
  const events: GameEvent[] = [];
  for (const instant of instants) {
    const result = advanceTo(state, instant);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** O que uma obra debitou e quando: é o que "os mesmos débitos, obras e instantes" compara. */
function starts(events: GameEvent[]) {
  return events
    .filter(
      (event) => event.type === 'constructionAutoStarted' || event.type === 'constructionStarted',
    )
    .map((event) => ({ type: event.type, atMs: event.atMs, ...event.data }));
}

// Quase todas automáticas; as manuais ficam na lista, no meio das outras, e nunca começam.
const plans = fc.array(
  fc.record({
    building: fc.constantFrom(...buildingIds),
    autoStart: fc.oneof({ weight: 5, arbitrary: fc.constant(true) }, fc.constant(false)),
  }),
  { minLength: 1, maxLength: 8 },
);

/**
 * Um feudo em um instante qualquer de dois anos, com gente, níveis, estoques e restos de
 * produção sorteados, uma lista de planejadas em ordem qualquer (quase todas automáticas) e,
 * às vezes, uma ou duas obras já em curso. O Salão vai de 1 a 6: metade das vezes a segunda
 * fila está aberta. Os estoques são muitas vezes curtos, para as planejadas esperarem recurso.
 */
const feud = fc.record({
  startMs: fc.nat(2 * YEAR),
  townHall: fc.integer({ min: 1, max: 7 }),
  levels: fc.tuple(
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
    fc.integer({ min: 1, max: 6 }),
  ),
  stores: fc.tuple(fc.nat(6), fc.nat(6)),
  villagers: fc.integer({ min: 0, max: 60 }),
  workers: fc.tuple(fc.nat(20), fc.nat(20), fc.nat(20), fc.nat(20)),
  food: fc.oneof(fc.nat(60_000), fc.nat(900_000)),
  wood: fc.oneof(fc.nat(80_000), fc.nat(900_000), fc.nat(3_000_000)),
  stone: fc.oneof(fc.nat(60_000), fc.nat(900_000), fc.nat(3_000_000)),
  gold: fc.oneof(fc.nat(60_000), fc.nat(900_000), fc.nat(3_000_000)),
  rests: fc.tuple(
    fc.integer({ min: -3_599_999, max: 3_599_999 }),
    fc.integer({ min: -3_599_999, max: 3_599_999 }),
    fc.integer({ min: -3_599_999, max: 3_599_999 }),
    fc.integer({ min: -3_599_999, max: 3_599_999 }),
  ),
  underway: fc.array(fc.constantFrom(...buildingIds), { maxLength: 2 }),
  plans,
  cuts: fc.array(fc.integer({ min: 1, max: 120 * HOUR }), { minLength: 2, maxLength: 5 }),
});

type Feud = typeof feud extends fc.Arbitrary<infer T> ? T : never;

function build(plan: Feud): GameState {
  const base = gameAt(plan.startMs, (draft) => {
    const { settlement } = draft;
    const [farm, lumberMill, quarry, goldMine, housing] = plan.levels;
    settlement.population.villagers = plan.villagers;
    settlement.buildings = {
      townHall: plan.townHall,
      farm,
      lumberMill,
      quarry,
      goldMine,
      housing,
      granary: plan.stores[0],
      warehouse: plan.stores[1],
    };
    settlement.resources = {
      food: plan.food,
      wood: plan.wood,
      stone: plan.stone,
      gold: plan.gold,
    };
    const [food, wood, stone, gold] = plan.rests;
    settlement.accumulators = { food, wood, stone, gold };
  });
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  return order(base, [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
    ...plan.underway.map((building) => command('startConstruction', { building })),
    ...plan.plans.map((entry) => command('planConstruction', entry)),
  ]);
}

type Seen = {
  autoStarted: number;
  byProduction: number;
  afterFinish: number;
  secondQueue: number;
  winter: number;
};

/**
 * A propriedade: de uma vez ou aos pedaços, o mesmo estado e os mesmos eventos, e portanto os
 * mesmos débitos, as mesmas obras e os mesmos instantes. Conta em `seen` de onde veio cada
 * início automático, para o teste conferir que o gerador passou pelo que diz atravessar.
 */
function checkSplit(plan: Feud, seen: Seen): void {
  const start = build(plan);
  const frozen = JSON.stringify(start);
  const instants = [...plan.cuts].sort((a, b) => a - b).map((cut) => plan.startMs + cut);
  const end = instants[instants.length - 1] as number;

  const direct = advanceTo(start, end);
  const stepped = stepThrough(start, instants);

  expect(stepped.state).toStrictEqual(direct.state);
  expect(stepped.events).toStrictEqual(direct.events);
  expect(starts(stepped.events)).toStrictEqual(starts(direct.events));
  expect(JSON.stringify(start)).toBe(frozen);

  // Em repouso: nenhuma automática fica para trás podendo começar, e nada fica negativo.
  expect(hasStartablePlan(direct.state)).toBe(false);
  for (const amount of Object.values(direct.state.settlement.resources)) {
    expect(amount).toBeGreaterThanOrEqual(0);
  }
  // Nunca duas obras do mesmo edifício, nunca obra em fila fechada.
  const queues = direct.state.settlement.constructionQueues;
  expect(queues).toHaveLength(2);
  const works = queues.flatMap((slot) => (slot === null ? [] : [slot.building]));
  expect(new Set(works).size).toBe(works.length);
  if (queuesUnlocked(direct.state) === 1) {
    expect(queues[1]).toBeNull();
  }

  // De onde veio cada início: da produção que completou o custo (nada mais acontece no
  // instante), de uma obra que terminou no mesmo instante, com outra obra ainda em curso.
  const busy = new Set(
    start.settlement.constructionQueues.flatMap((slot) => (slot ? [slot.building] : [])),
  );
  for (const event of direct.events) {
    if (event.type === 'constructionFinished' || event.type === 'buildingFounded') {
      busy.delete(event.data.building as BuildingId);
    }
    if (event.type !== 'constructionAutoStarted') {
      continue;
    }
    const sameInstant = direct.events.filter((other) => other.atMs === event.atMs);
    seen.autoStarted += 1;
    seen.byProduction += sameInstant.every((other) => other.type === 'constructionAutoStarted')
      ? 1
      : 0;
    seen.afterFinish += sameInstant.some(
      (other) => other.type === 'constructionFinished' || other.type === 'buildingFounded',
    )
      ? 1
      : 0;
    seen.secondQueue += busy.size > 0 ? 1 : 0;
    seen.winter += event.atMs % YEAR >= WINTER ? 1 : 0;
    busy.add(event.data.building as BuildingId);
  }
}

const nothingSeen = (): Seen => ({
  autoStarted: 0,
  byProduction: 0,
  afterFinish: 0,
  secondQueue: 0,
  winter: 0,
});

describe('início automático: divisão de intervalo', () => {
  it('avançar de uma vez ou aos pedaços dá os mesmos débitos, as mesmas obras e os mesmos instantes', () => {
    const seen = nothingSeen();
    fc.assert(
      fc.property(feud, (plan) => checkSplit(plan, seen)),
      { numRuns: 600 },
    );
    // O gerador passa mesmo pelo que o teste diz atravessar: obras que começaram sozinhas
    // porque a produção completou o custo, porque outra obra terminou, e no inverno.
    expect(seen.autoStarted).toBeGreaterThan(200);
    expect(seen.byProduction).toBeGreaterThan(150);
    expect(seen.afterFinish).toBeGreaterThan(10);
    expect(seen.winter).toBeGreaterThan(5);
  });

  it('duas filas disputando os mesmos recursos: a ordem da lista decide, em qualquer divisão', () => {
    // O Salão sempre com a segunda fila aberta, edifícios altos (obras de mais de meia hora),
    // muita gente em todos os ofícios e a lista cheia de automáticas: as obras se atropelam.
    const crowded = feud.map((plan) => ({
      ...plan,
      townHall: 4 + (plan.townHall % 4),
      levels: plan.levels.map((level) => 3 + (level % 4)) as Feud['levels'],
      stores: plan.stores.map((level) => 3 + (level % 6)) as Feud['stores'],
      // Metade dos feudos tem estoque de sobra: neles as planejadas esperam a fila, não o recurso.
      ...(plan.villagers % 2 === 0
        ? { wood: 2_000_000 + plan.wood, stone: 2_000_000 + plan.stone, gold: 2_000_000 }
        : {}),
      villagers: 40 + plan.villagers,
      workers: plan.workers.map((count) => 5 + count) as Feud['workers'],
      plans: buildingIds.map((building, index) => ({
        building: buildingIds[(index + plan.villagers) % buildingIds.length] as BuildingId,
        autoStart: plan.plans[index]?.autoStart ?? true,
      })),
    }));
    const seen = nothingSeen();
    fc.assert(
      fc.property(crowded, (plan) => checkSplit(plan, seen)),
      { numRuns: 300 },
    );
    // Obras que começaram sozinhas com a outra fila ocupada, muitas no instante em que uma
    // obra terminou e liberou os pedreiros.
    expect(seen.autoStarted).toBeGreaterThan(600);
    expect(seen.afterFinish).toBeGreaterThan(100);
    expect(seen.secondQueue).toBeGreaterThan(100);
  });

  it('a obra automática começa no primeiro milissegundo em que pode, e nem um antes', () => {
    fc.assert(
      fc.property(feud, (plan) => {
        const start = build(plan);
        const end = plan.startMs + Math.max(...plan.cuts);
        const { events } = advanceTo(start, end);
        const first = events.find((event) => event.type === 'constructionAutoStarted');
        if (first === undefined || first.atMs === start.lastProcessedAt) {
          return;
        }
        // Um milissegundo antes, a planejada ainda esperava alguma coisa.
        const before = advanceTo(start, first.atMs - 1).state;
        const waiting = before.settlement.planned.find(
          (entry) => entry.building === first.data.building,
        );
        expect(waiting?.autoStart).toBe(true);
        expect(waiting === undefined ? null : planWait(before, waiting)).not.toBeNull();
        // E o milissegundo seguinte a inicia, com o mesmo evento.
        const after = advanceTo(before, first.atMs);
        expect(after.events.filter((event) => event.type === 'constructionAutoStarted')[0]).toEqual(
          first,
        );
      }),
      { numRuns: 300 },
    );
  });

  it('a linha do tempo nunca para: com planejadas automáticas, o próximo evento é sempre depois de agora', () => {
    fc.assert(
      fc.property(feud, (plan) => {
        let state = build(plan);
        const end = plan.startMs + Math.min(...plan.cuts);
        // Anda evento a evento, como o laço de `advanceTo`, e conta os passos.
        for (let steps = 0; state.lastProcessedAt < end; steps += 1) {
          const next = nextEventAt(state);
          expect(next).not.toBeNull();
          expect(next as number).toBeGreaterThan(state.lastProcessedAt);
          expect(steps).toBeLessThan(5_000);
          state = advanceTo(state, Math.min(next as number, end)).state;
        }
      }),
      { numRuns: 150 },
    );
  });

  it('vale com os objetivos ainda por cumprir: a recompensa que paga uma obra a inicia no mesmo instante', () => {
    // Partidas novas, com os objetivos ativos, pouco ouro e, metade das vezes, as duas filas
    // abertas. Alocar fazendeiros rende 20 de ouro e iniciar as Habitações rende 30 de madeira:
    // a recompensa pode completar o custo de uma planejada, e ela começa na mesma ordem.
    const fresh = fc.record({
      townHall: fc.constantFrom(1, 4),
      warehouse: fc.nat(2),
      workers: fc.tuple(fc.integer({ min: 2, max: 5 }), fc.nat(5), fc.nat(5), fc.nat(5)),
      wood: fc.integer({ min: 0, max: 400_000 }),
      stone: fc.integer({ min: 0, max: 200_000 }),
      gold: fc.integer({ min: 0, max: 60_000 }),
      plans,
      recruit: fc.nat(5),
      cuts: fc.array(fc.integer({ min: 1, max: 60 * HOUR }), { minLength: 2, maxLength: 4 }),
    });
    let rewarded = 0;
    fc.assert(
      fc.property(fresh, (plan) => {
        const [farm, lumberMill, quarry, goldMine] = plan.workers;
        let state = gameWith((draft) => {
          draft.settlement.buildings.townHall = plan.townHall;
          draft.settlement.buildings.warehouse = plan.warehouse;
          draft.settlement.resources.wood = plan.wood;
          draft.settlement.resources.stone = plan.stone;
          draft.settlement.resources.gold = plan.gold;
        });
        const orders = [
          ...plan.plans.map((entry) => command('planConstruction', entry)),
          command('startConstruction', { building: 'housing' }),
          command('setWorkers', { building: 'farm', count: farm }),
          command('recruitVillagers', { quantity: plan.recruit }),
          command('setWorkers', { building: 'lumberMill', count: lumberMill }),
          command('setWorkers', { building: 'quarry', count: quarry }),
          command('setWorkers', { building: 'goldMine', count: goldMine }),
        ];
        for (const next of orders) {
          const result = applyCommand(state, next, state.lastProcessedAt);
          if (!result.ok) {
            continue;
          }
          state = result.state;
          // Depois de toda ordem aceita, nenhuma automática fica para trás podendo começar.
          expect(hasStartablePlan(state)).toBe(false);
          for (const [index, event] of result.events.entries()) {
            if (
              event.type === 'constructionAutoStarted' &&
              result.events[index - 1]?.type === 'objectiveCompleted'
            ) {
              rewarded += 1;
            }
          }
        }
        const instants = [...plan.cuts].sort((a, b) => a - b);
        const direct = advanceTo(state, instants[instants.length - 1] as number);
        const stepped = stepThrough(state, instants);
        expect(stepped.state).toStrictEqual(direct.state);
        expect(stepped.events).toStrictEqual(direct.events);
        expect(hasStartablePlan(direct.state)).toBe(false);
      }),
      { numRuns: 400 },
    );
    // O gerador passa mesmo pela recompensa que destrava um início.
    expect(rewarded).toBeGreaterThan(0);
  });
});
