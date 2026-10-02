import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { calendarAt } from './clock';
import { applyCommand } from './commands';
import { assignedWorkers } from './population';
import { command, DAY, gameAt, HOUR, MINUTE, newGame, WINTER, YEAR } from './test-helpers';
import type { BuildingId, Command, GameEvent, GameState, ProductionBuildingId } from './types';

const DAY_REAL = 24 * HOUR;

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

const crafts: ProductionBuildingId[] = ['farm', 'lumberMill', 'quarry', 'goldMine'];

/** O que vale em qualquer estado, com ou sem troca de ofício no caminho. */
function expectCraftInvariants(state: GameState): void {
  const { settlement } = state;
  // A soma dos trabalhadores nunca passa dos habitantes.
  expect(assignedWorkers(state)).toBeLessThanOrEqual(settlement.population.villagers);
  // Nenhuma coorte vencida fica para trás, nenhuma é vazia, e a lista está em ordem de término.
  const ends = settlement.adaptation.map((cohort) => cohort.untilMs);
  expect(ends).toEqual([...ends].sort((a, b) => a - b));
  for (const cohort of settlement.adaptation) {
    expect(cohort.untilMs).toBeGreaterThan(state.lastProcessedAt);
    expect(cohort.count).toBeGreaterThan(0);
  }
  for (const building of crafts) {
    // Quem se adapta em um edifício trabalha nele.
    const adapting = settlement.adaptation
      .filter((cohort) => cohort.building === building)
      .reduce((sum, cohort) => sum + cohort.count, 0);
    expect(adapting).toBeLessThanOrEqual(settlement.workers[building]);
    expect(settlement.craftExperience[building]).toBeGreaterThanOrEqual(0);
    expect(settlement.craftExperience[building]).toBeLessThanOrEqual(100);
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

  it('vale em qualquer época do ano, atravessando viradas de estação, o frio e a fome', () => {
    // O feudo começa em um instante qualquer de dois anos, com gente, níveis e estoques
    // sorteados; a madeira e a comida são muitas vezes poucas, para a lenha e a fome abrirem e
    // fecharem no caminho. O intervalo vai até 200 horas de jogo: mais de um ano.
    const seasonal = fc.record({
      startMs: fc.nat(2 * YEAR),
      villagers: fc.integer({ min: 0, max: 30 }),
      workers: fc.tuple(fc.nat(10), fc.nat(10), fc.nat(10), fc.nat(10)),
      levels: fc.tuple(fc.integer({ min: 1, max: 6 }), fc.integer({ min: 1, max: 6 })),
      food: fc.oneof(fc.nat(60_000), fc.nat(2_000_000)),
      wood: fc.oneof(fc.nat(40_000), fc.nat(600_000)),
      rests: fc.tuple(
        fc.integer({ min: -3_599_999, max: 3_599_999 }),
        fc.integer({ min: -3_599_999, max: 3_599_999 }),
      ),
      build: fc.option(fc.constantFrom(...buildingIds)),
      recruit: fc.nat(5),
      cuts: fc.array(fc.integer({ min: 1, max: 200 * HOUR }), { minLength: 2, maxLength: 4 }),
    });
    const seen = { coldStarted: 0, coldEnded: 0, famineStarted: 0, seasonChanged: 0 };
    fc.assert(
      fc.property(seasonal, (plan) => {
        let state = gameAt(plan.startMs, (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = plan.villagers;
          settlement.buildings.townHall = 6;
          settlement.buildings.housing = 6;
          settlement.buildings.farm = plan.levels[0];
          settlement.buildings.lumberMill = plan.levels[1];
          settlement.resources.food = plan.food;
          settlement.resources.wood = plan.wood;
          settlement.accumulators.food = plan.rests[0];
          settlement.accumulators.wood = plan.rests[1];
        });
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
        const start = state;
        const frozen = JSON.stringify(start);
        const instants = [...plan.cuts].sort((a, b) => a - b).map((cut) => plan.startMs + cut);
        const end = instants[instants.length - 1] as number;

        const direct = advanceTo(start, end);
        let stepped = start;
        const events: GameEvent[] = [];
        for (const instant of instants) {
          const result = advanceTo(stepped, instant);
          stepped = result.state;
          events.push(...result.events);
          expectNoNegativeResources(stepped);
        }
        expect(stepped).toStrictEqual(direct.state);
        expect(events).toStrictEqual(direct.events);
        expect(JSON.stringify(start)).toBe(frozen);

        // O frio só existe na estação da lenha, e nunca abre e fecha no mesmo instante.
        const cold = direct.events.filter((event) => event.type.startsWith('cold'));
        for (const [index, event] of cold.entries()) {
          expect(event.type).not.toBe(cold[index - 1]?.type);
          if (index > 0) {
            expect(event.atMs).toBeGreaterThan(cold[index - 1]?.atMs ?? Infinity);
          }
          if (event.type === 'coldStarted') {
            expect(calendarAt(event.atMs).season.id).toBe('winter');
          }
        }
        if (direct.state.settlement.cold !== null) {
          expect(calendarAt(end).season.id).toBe('winter');
        }
        for (const event of direct.events) {
          if (event.type in seen) {
            seen[event.type as keyof typeof seen] += 1;
          }
        }
      }),
      { numRuns: 400 },
    );
    // O gerador passa mesmo pelo que o teste diz atravessar.
    expect(seen.seasonChanged).toBeGreaterThan(100);
    expect(seen.coldStarted).toBeGreaterThan(20);
    expect(seen.coldEnded).toBeGreaterThan(20);
    expect(seen.famineStarted).toBeGreaterThan(20);
  });

  it('vale atravessando o início do frio, com o corte em qualquer milissegundo', () => {
    // 10 de madeira e 5 habitantes no primeiro instante do inverno: a lenha acaba em 4 horas.
    const start = gameAt(WINTER, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 10_000;
    });
    const end = WINTER + 30 * HOUR;
    const direct = advanceTo(start, end);
    expect(direct.events.filter((event) => event.type === 'coldStarted')).toMatchObject([
      { atMs: WINTER + 4 * HOUR },
    ]);
    expect(direct.events.filter((event) => event.type === 'coldEnded')).toMatchObject([
      { atMs: YEAR },
    ]);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 30 * HOUR - 1 }), (cut) => {
        const half = advanceTo(start, WINTER + cut);
        const split = advanceTo(half.state, end);
        expect(split.state).toStrictEqual(direct.state);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);
        expectNoNegativeResources(half.state);
      }),
      { numRuns: 500 },
    );
    // E em cima dos instantes que importam: o da lenha, a virada do dia e a do ano.
    for (const cut of [
      4 * HOUR - 1,
      4 * HOUR,
      4 * HOUR + 1,
      24 * HOUR - 1,
      24 * HOUR,
      24 * HOUR + 1,
    ]) {
      const half = advanceTo(start, WINTER + cut);
      const split = advanceTo(half.state, end);
      expect(split.state).toStrictEqual(direct.state);
      expect([...half.events, ...split.events]).toStrictEqual(direct.events);
    }
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

  it('vale com trocas de ofício no caminho: fim de adaptação como evento e experiência a cada virada', () => {
    // Três visitas com ordens de alocação, a intervalos quebrados: cada uma cria coortes, tira
    // gente de coortes antigas ou esvazia um edifício. A experiência parte de valores
    // quaisquer, muitos perto do máximo, para o ofício ser dominado (e perdido) no caminho.
    const allocation = fc.tuple(fc.nat(6), fc.nat(6), fc.nat(6), fc.nat(6));
    const plan = fc.record({
      startMs: fc.nat(2 * YEAR),
      villagers: fc.integer({ min: 4, max: 16 }),
      levels: fc.tuple(
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
        fc.integer({ min: 1, max: 4 }),
      ),
      experience: fc.tuple(
        fc.oneof(fc.nat(100), fc.integer({ min: 88, max: 100 })),
        fc.oneof(fc.nat(100), fc.integer({ min: 88, max: 100 })),
        fc.nat(100),
        fc.nat(100),
      ),
      visits: fc.array(
        fc.record({ afterMs: fc.integer({ min: 1, max: 3 * HOUR }), workers: allocation }),
        { minLength: 1, maxLength: 3 },
      ),
      cuts: fc.array(fc.integer({ min: 1, max: 80 * HOUR }), { minLength: 2, maxLength: 4 }),
    });
    const seen = { cohortEnds: 0, splitCohorts: 0, mastered: 0, lost: 0 };
    fc.assert(
      fc.property(plan, (scenario) => {
        let state = gameAt(scenario.startMs, (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = scenario.villagers;
          settlement.buildings.townHall = 6;
          settlement.buildings.housing = 6;
          settlement.buildings.granary = 4;
          settlement.buildings.warehouse = 4;
          crafts.forEach((building, index) => {
            settlement.buildings[building] = scenario.levels[index] as number;
            settlement.craftExperience[building] = scenario.experience[index] as number;
          });
          settlement.resources = { food: 400_000, wood: 300_000, stone: 100_000, gold: 0 };
        });
        for (const visit of scenario.visits) {
          state = advanceTo(state, state.lastProcessedAt + visit.afterMs).state;
          crafts.forEach((building, index) => {
            const order = command('setWorkers', {
              building,
              count: visit.workers[index] as number,
            });
            const result = applyCommand(state, order, state.lastProcessedAt);
            if (result.ok) {
              state = result.state;
            }
          });
          expectCraftInvariants(state);
        }
        const start = state;
        const frozen = JSON.stringify(start);
        const cohorts = start.settlement.adaptation;
        // Os cortes sorteados e, de propósito, o milissegundo de cada fim de adaptação e os dois
        // vizinhos dele.
        const offsets = [
          ...scenario.cuts,
          ...cohorts.flatMap((cohort) => {
            const at = cohort.untilMs - start.lastProcessedAt;
            return [at - 1, at, at + 1];
          }),
        ].filter((offset) => offset >= 1);
        const instants = [...new Set(offsets)]
          .sort((a, b) => a - b)
          .map((offset) => start.lastProcessedAt + offset);
        const end = instants[instants.length - 1] as number;

        const direct = advanceTo(start, end);
        let stepped = start;
        const events: GameEvent[] = [];
        for (const instant of instants) {
          const result = advanceTo(stepped, instant);
          stepped = result.state;
          events.push(...result.events);
          expectCraftInvariants(stepped);
          expectNoNegativeResources(stepped);
        }
        expect(stepped).toStrictEqual(direct.state);
        expect(events).toStrictEqual(direct.events);
        expect(JSON.stringify(start)).toBe(frozen);

        // Toda coorte termina no seu instante, com ou sem corte em cima dele.
        for (const cohort of cohorts) {
          const before = advanceTo(start, cohort.untilMs - 1).state;
          expect(before.settlement.adaptation).toContainEqual(cohort);
          const after = advanceTo(before, cohort.untilMs).state;
          expect(after.settlement.adaptation).not.toContainEqual(cohort);
        }
        // O ofício dominado sai uma vez por edifício e por ano, sempre em uma virada de dia.
        const mastered = direct.events.filter((event) => event.type === 'craftMastered');
        const keys = mastered.map(
          (event) => `${String(event.data.building)}:${calendarAt(event.atMs).year}`,
        );
        expect(new Set(keys).size).toBe(keys.length);
        for (const event of mastered) {
          expect(event.atMs % DAY).toBe(0);
        }

        seen.cohortEnds += cohorts.filter((cohort) => cohort.untilMs <= end).length;
        seen.splitCohorts += cohorts.length > 1 ? 1 : 0;
        seen.mastered += mastered.length;
        seen.lost += crafts.some(
          (building) =>
            direct.state.settlement.craftExperience[building] <
            start.settlement.craftExperience[building],
        )
          ? 1
          : 0;
      }),
      { numRuns: 300 },
    );
    // O gerador passa mesmo pelo que o teste diz atravessar.
    expect(seen.cohortEnds).toBeGreaterThan(200);
    expect(seen.splitCohorts).toBeGreaterThan(50);
    expect(seen.mastered).toBeGreaterThan(30);
    expect(seen.lost).toBeGreaterThan(50);
  });

  it('vale atravessando o fim de uma adaptação, com o corte em qualquer milissegundo', () => {
    // Dois lenhadores chegam aos 30 minutos; um terceiro, uma hora depois. A segunda leva
    // termina às 3 h 30 min, depois de uma virada de dia que conta a experiência.
    let start = advanceTo(newGame(), 30 * MINUTE).state;
    for (const [afterMs, count] of [
      [0, 2],
      [HOUR, 3],
    ] as const) {
      start = advanceTo(start, start.lastProcessedAt + afterMs).state;
      const result = applyCommand(
        start,
        command('setWorkers', { building: 'lumberMill', count }),
        start.lastProcessedAt,
      );
      if (result.ok) {
        start = result.state;
      }
    }
    expect(start.settlement.adaptation).toHaveLength(2);
    const end = 6 * HOUR;
    const direct = advanceTo(start, end);
    expect(direct.state.settlement.adaptation).toEqual([]);
    fc.assert(
      fc.property(fc.integer({ min: 90 * MINUTE + 1, max: end - 1 }), (cut) => {
        const half = advanceTo(start, cut);
        const split = advanceTo(half.state, end);
        expect(split.state).toStrictEqual(direct.state);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);
        expectCraftInvariants(half.state);
      }),
      { numRuns: 500 },
    );
  });
});
