import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands';
import { DAY_MS } from './clock';
import { RNG_STREAMS } from './random';
import {
  advanceWithDailyDraws,
  command,
  eventsOfType,
  HOUR,
  newGame,
  SYNTHETIC_DRAW,
} from './test-helpers';
import type { BuildingId, Command, GameEvent, GameState } from './types';

/**
 * A divisão de intervalo com sorteios no caminho. Nenhuma regra sorteia ainda, então o cenário
 * é sintético (`advanceWithDailyDraws`): o laço de `advanceTo` de verdade, com uma virada de
 * dia que sorteia nos três fluxos e mexe no estoque. As mecânicas que sorteiam de verdade
 * repetem esta prova com os próprios eventos.
 */

const DAY_REAL = 24 * HOUR;
const MONTH = 30 * DAY_REAL;

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
];

const scenario = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  workers: fc.tuple(fc.nat(5), fc.nat(5), fc.nat(5), fc.nat(5)),
  build: fc.option(fc.constantFrom(...buildingIds)),
  recruit: fc.nat(5),
  // Instantes em milissegundos quaisquer: o corte cai antes, em cima e depois das viradas.
  warmUpMs: fc.nat(3 * DAY_REAL),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Um feudo de semente qualquer, já com sorteios feitos e com ordens dadas no meio de um dia. */
function prepare(plan: Scenario): GameState {
  let state = advanceWithDailyDraws(newGame(plan.seed), plan.warmUpMs).state;
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

/** Avança parando em cada instante da lista, na ordem, e junta os eventos. */
function advanceThrough(start: GameState, instants: number[]) {
  let state = start;
  const events: GameEvent[] = [];
  for (const instant of instants) {
    const result = advanceWithDailyDraws(state, instant);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('divisão de intervalo com sorteios no caminho', () => {
  it('o cenário sintético sorteia a cada virada de dia, nos três fluxos, e muda o estoque', () => {
    const { state, events } = advanceWithDailyDraws(newGame('pedra-alta'), 10 * DAY_MS);
    const draws = eventsOfType(events, SYNTHETIC_DRAW);

    expect(draws.map((event) => event.atMs)).toEqual(
      Array.from({ length: 10 }, (_, index) => (index + 1) * DAY_MS),
    );
    expect(Object.keys(state.rng).sort()).toEqual([...RNG_STREAMS].sort());
    expect(new Set(draws.map((event) => event.data.gift)).size).toBeGreaterThan(1);

    // Mesma semente, mesmo passado; outra semente, outros sorteios.
    expect(advanceWithDailyDraws(newGame('pedra-alta'), 10 * DAY_MS).events).toStrictEqual(events);
    const other = advanceWithDailyDraws(newGame('pedra-baixa'), 10 * DAY_MS);
    expect(other.state.rng).not.toEqual(state.rng);
    expect(eventsOfType(other.events, SYNTHETIC_DRAW)).not.toEqual(draws);
  });

  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3), no estado, no RNG e nos eventos', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        (plan, firstMs, secondMs) => {
          const start = prepare(plan);
          const frozen = JSON.stringify(start);
          const t2 = start.lastProcessedAt + firstMs;
          const t3 = t2 + secondMs;

          const direct = advanceWithDailyDraws(start, t3);
          const split = advanceThrough(start, [t2, t3]);

          expect(split.state).toStrictEqual(direct.state);
          expect(split.state.rng).toStrictEqual(direct.state.rng);
          expect(split.events).toStrictEqual(direct.events);
          expect(JSON.stringify(start)).toBe(frozen);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('um mês de uma vez ou em até dez pedaços quaisquer consome o gerador igual', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.array(fc.integer({ min: 1, max: MONTH - 1 }), { minLength: 1, maxLength: 9 }),
        (plan, cuts) => {
          const start = prepare(plan);
          const end = start.lastProcessedAt + MONTH;
          const instants = [...cuts]
            .sort((a, b) => a - b)
            .map((cut) => start.lastProcessedAt + cut);

          const direct = advanceWithDailyDraws(start, end);
          const pieces = advanceThrough(start, [...instants, end]);

          expect(pieces.state).toStrictEqual(direct.state);
          expect(pieces.events).toStrictEqual(direct.events);
          // 360 viradas de dia, cada uma com o seu sorteio, nem uma a mais.
          expect(eventsOfType(direct.events, SYNTHETIC_DRAW)).toHaveLength(MONTH / DAY_MS);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('consultar a cada hora, como quem deixa a aba aberta, não rerrola nada', () => {
    const start = prepare({
      seed: 'pedra-alta',
      workers: [2, 3, 1, 0],
      build: 'housing',
      recruit: 3,
      warmUpMs: 5 * HOUR + 1234,
    });
    const end = start.lastProcessedAt + MONTH;
    const hourly = Array.from(
      { length: 720 },
      (_, index) => start.lastProcessedAt + (index + 1) * HOUR,
    );

    const direct = advanceWithDailyDraws(start, end);
    const polled = advanceThrough(start, hourly);
    expect(polled.state).toStrictEqual(direct.state);
    expect(polled.events).toStrictEqual(direct.events);

    // Olhar o futuro e jogar o resultado fora não gasta o gerador de quem ficou no presente.
    const frozen = JSON.stringify(start);
    advanceWithDailyDraws(start, end);
    advanceWithDailyDraws(start, end + DAY_MS);
    expect(JSON.stringify(start)).toBe(frozen);
    expect(advanceWithDailyDraws(start, end)).toStrictEqual(direct);
  });

  it('avançar para o mesmo instante de novo não sorteia de novo', () => {
    const atTurn = advanceWithDailyDraws(newGame('pedra-alta'), 3 * DAY_MS);
    const again = advanceWithDailyDraws(atTurn.state, 3 * DAY_MS);
    expect(again.events).toEqual([]);
    expect(again.state).toBe(atTurn.state);
  });
});
