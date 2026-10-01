import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { command, HOUR, newGame } from './test-helpers';
import type { BuildingId, Command, GameState } from './types';

const DAY_REAL = 24 * HOUR;

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
];

const scenario = fc.record({
  workers: fc.tuple(fc.nat(5), fc.nat(5), fc.nat(5), fc.nat(5)),
  build: fc.option(fc.constantFrom(...buildingIds)),
  recruit: fc.nat(5),
  // Instantes em milissegundos quaisquer, para os acumuladores ficarem "quebrados".
  warmUpMs: fc.nat(3 * DAY_REAL),
  firstMs: fc.integer({ min: 1, max: 15 * DAY_REAL }),
  secondMs: fc.integer({ min: 1, max: 15 * DAY_REAL }),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Avança até um instante qualquer e dá ordens; as recusadas são simplesmente ignoradas. */
function prepare(plan: Scenario): GameState {
  let state = advanceTo(newGame(), plan.warmUpMs).state;
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  const orders: Command[] = [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
    command('recruitVillagers', { quantity: plan.recruit }),
  ];
  if (plan.build !== null) {
    orders.push(command('startConstruction', { building: plan.build }));
  }
  for (const order of orders) {
    const result = applyCommand(state, order, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
    }
  }
  return state;
}

function expectNoNegativeResources(state: GameState): void {
  for (const amount of Object.values(state.settlement.resources)) {
    expect(amount).toBeGreaterThanOrEqual(0);
  }
}

describe('invariante de divisão de intervalo', () => {
  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3)', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const start = prepare(plan);
        const frozen = JSON.stringify(start);
        const t2 = start.lastProcessedAt + plan.firstMs;
        const t3 = t2 + plan.secondMs;

        const direct = advanceTo(start, t3);
        const half = advanceTo(start, t2);
        const split = advanceTo(half.state, t3);

        expect(split.state).toStrictEqual(direct.state);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);

        expectNoNegativeResources(half.state);
        expectNoNegativeResources(direct.state);
        expect(JSON.stringify(start)).toBe(frozen);
      }),
      { numRuns: 500 },
    );
  });

  it('vale atravessando o início da fome, com o corte em qualquer milissegundo', () => {
    // Sem fazendeiros, a comida acaba em exatamente 36 h: o corte cai antes, em cima e depois.
    const start = newGame();
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 72 * HOUR - 1 }), (cut) => {
        const direct = advanceTo(start, 72 * HOUR);
        const half = advanceTo(start, cut);
        const split = advanceTo(half.state, 72 * HOUR);
        expect(split.state).toStrictEqual(direct.state);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);
        expectNoNegativeResources(half.state);
      }),
      { numRuns: 500 },
    );
  });
});
