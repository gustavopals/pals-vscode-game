import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { trainingLotKey } from './army';
import { inhabitants } from './masters';
import { housingCapacity } from './population';
import { apply, barracksYard, command, HOUR, MINUTE } from './test-helpers';
import type { GameEvent, GameState } from './types';

/**
 * O exército nas propriedades (V4C-T1.9): a divisão de intervalo com o treino terminando e a
 * fome abrindo no caminho, a comida que nunca fica negativa, os habitantes que nunca passam das
 * casas e a ausência de ciclo lucrativo aldeão → soldado → aldeão.
 */
const MILLI = 1000;
const UNITS = ['spearman', 'swordsman', 'archer', 'knight', 'shieldbearer'] as const;

const lotKeyOf = (state: GameState): string =>
  state.army.training === null ? 'sem-lote' : trainingLotKey(state.army.training);

/** O pátio com poucos mantimentos e soldados já alistados: a fome abre no caminho do treino. */
function hungryYard(
  food: number,
  soldiers: number,
  villagers: number,
  timeScale: number,
): GameState {
  return barracksYard(
    0,
    (draft) => {
      draft.settlement.population.villagers = villagers;
      draft.settlement.resources.food = food * MILLI;
      draft.settlement.resources.gold = 2000 * MILLI;
      draft.settlement.weapons = 10;
      draft.army.units.spearman = soldiers;
    },
    { timeScale, seed: 'exercito-propriedades' },
  );
}

const order = (state: GameState, unit: (typeof UNITS)[number], amount: number): GameState => {
  const result = apply(state, command('trainSoldiers', { unit, amount }));
  return result.ok ? result.state : state;
};

const run = (state: GameState, ...stops: number[]): { state: GameState; events: GameEvent[] } => {
  let current = state;
  const events: GameEvent[] = [];
  for (const at of stops) {
    const step = advanceTo(current, at);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
};

describe('o exército nas propriedades (V4C-T1.9)', () => {
  it('cortar o tempo em qualquer instante não muda estado, eventos nem gerador, com treino e fome no caminho', () => {
    let hungry = 0;
    let trained = 0;
    fc.assert(
      fc.property(
        fc.constantFrom(3, 1, 0.5),
        fc.integer({ min: 0, max: 150 }),
        fc.integer({ min: 0, max: 8 }),
        fc.integer({ min: 4, max: 20 }),
        fc.constantFrom(...UNITS),
        fc.integer({ min: 1, max: 2 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (timeScale, food, soldiers, villagers, unit, amount, shareA, shareB) => {
          const start = order(hungryYard(food, soldiers, villagers, timeScale), unit, amount);
          const end = start.lastProcessedAt + 36 * HOUR;
          const span = end - start.lastProcessedAt;
          const a = start.lastProcessedAt + Math.floor(span * Math.min(shareA, shareB));
          const b = start.lastProcessedAt + Math.floor(span * Math.max(shareA, shareB));
          const whole = run(start, end);
          const split = run(start, a, b, end);
          expect(split.state).toStrictEqual(whole.state);
          expect(split.events).toStrictEqual(whole.events);
          if (whole.state.settlement.famine !== null) {
            hungry += 1;
          }
          if (whole.events.some((event) => event.type === 'soldiersTrained')) {
            trained += 1;
          }
        },
      ),
      { numRuns: 40 },
    );
    // A propriedade passou por partidas com fome aberta e por treinos que terminaram.
    expect(hungry).toBeGreaterThan(0);
    expect(trained).toBeGreaterThan(0);
  });

  it('a comida nunca fica negativa e os habitantes nunca passam das casas, com ordens no meio do caminho', () => {
    const stepOrder = (
      state: GameState,
      kind: string,
      unit: (typeof UNITS)[number],
      amount: number,
    ) => {
      if (kind === 'train') {
        return command('trainSoldiers', { unit, amount });
      }
      if (kind === 'cancel') {
        return command('cancelTraining', {
          lotKey: state.army.training === null ? 'sem-lote' : trainingLotKey(state.army.training),
        });
      }
      return command('disbandSoldiers', { unit, amount });
    };
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 120 }),
        fc.integer({ min: 0, max: 10 }),
        fc.integer({ min: 4, max: 24 }),
        fc.array(
          fc.record({
            kind: fc.constantFrom('train', 'cancel', 'disband'),
            unit: fc.constantFrom(...UNITS),
            amount: fc.integer({ min: 1, max: 10 }),
            wait: fc.integer({ min: 1, max: 5 * 60 }),
          }),
          { minLength: 1, maxLength: 8 },
        ),
        (food, soldiers, villagers, steps) => {
          let state = hungryYard(food, soldiers, villagers, 3);
          for (const step of steps) {
            state = advanceTo(state, state.lastProcessedAt + step.wait * MINUTE).state;
            expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
            expect(inhabitants(state)).toBeLessThanOrEqual(housingCapacity(state));
            const result = apply(state, stepOrder(state, step.kind, step.unit, step.amount));
            if (result.ok) {
              state = result.state;
            }
            expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
            expect(inhabitants(state)).toBeLessThanOrEqual(housingCapacity(state));
          }
        },
      ),
      { numRuns: 40 },
    );
  });

  it('não há ciclo lucrativo: treinar e dispensar nunca devolve recurso, arma nem gente', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...UNITS),
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 0, max: 3 * 60 }),
        (unit, amount, waitMinutes) => {
          const start = hungryYard(500, 0, 20, 3);
          // Cancelar logo depois de ordenar: nada volta além do que se pagou.
          const ordered = order(start, unit, amount);
          const cancelled = apply(
            ordered,
            command('cancelTraining', { lotKey: lotKeyOf(ordered) }),
          );
          if (!cancelled.ok) {
            throw new Error('Cancelar um lote em treino devia ser aceito.');
          }
          const before = start.settlement.resources;
          for (const key of Object.keys(before) as Array<keyof typeof before>) {
            expect(cancelled.state.settlement.resources[key]).toBeLessThanOrEqual(before[key]);
          }
          expect(cancelled.state.settlement.weapons).toBeLessThanOrEqual(start.settlement.weapons);

          // Treinar até o fim e dispensar tudo.
          const trainedState = advanceTo(ordered, ordered.army.training?.endsAtMs ?? 0).state;
          const soldiers = trainedState.army.units[unit];
          let after = trainedState;
          if (soldiers > 0) {
            const disbanded = apply(
              trainedState,
              command('disbandSoldiers', { unit, amount: soldiers }),
            );
            if (!disbanded.ok) {
              throw new Error('Dispensar quem existe devia ser aceito.');
            }
            after = disbanded.state;
          }
          // Dispensar não mexe em recurso nem em arma, e devolve os aldeões um a um.
          expect(after.settlement.resources).toStrictEqual(trainedState.settlement.resources);
          expect(after.settlement.weapons).toBe(trainedState.settlement.weapons);
          expect(after.settlement.population.villagers + after.army.units[unit]).toBe(
            trainedState.settlement.population.villagers + soldiers,
          );
          expect(after.settlement.population.villagers).toBeLessThanOrEqual(
            start.settlement.population.villagers,
          );

          // Com o tempo, o feudo que fez o ciclo nunca tem mais que o que não o fez.
          const at = after.lastProcessedAt + waitMinutes * MINUTE;
          const control = advanceTo(start, trainedState.lastProcessedAt).state;
          const controlLater = advanceTo(control, at).state;
          const cycled = advanceTo(after, at).state;
          for (const key of Object.keys(controlLater.settlement.resources) as Array<
            keyof typeof controlLater.settlement.resources
          >) {
            expect(cycled.settlement.resources[key]).toBeLessThanOrEqual(
              controlLater.settlement.resources[key],
            );
          }
          expect(cycled.settlement.weapons).toBeLessThanOrEqual(controlLater.settlement.weapons);
          expect(cycled.settlement.population.villagers).toBeLessThanOrEqual(
            controlLater.settlement.population.villagers,
          );
        },
      ),
      { numRuns: 40 },
    );
  });
});
