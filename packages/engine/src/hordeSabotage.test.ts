import type { DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import {
  alertHordeFortress,
  applyWaveSabotage,
  observeFormation,
  revealWaveThree,
  settleHordeTiles,
  turnOmens,
} from './hordePlan';
import { currentShape } from './migrations';
import { cloneState } from './state';
import type { GameEvent } from './types';
import { deriveViewState } from './view';
import { AUTUMN, gameAt, YEAR } from './test-helpers';

/**
 * A Horda preparada no outono do ano pedido. As contas da onda inteira (40/60/80) são as do
 * ano 3 em diante; o ano 1 tem um terço e o ano 2 dois terços (respostas do autor de 2026-11-04).
 */
function preparedHorde(difficulty: DifficultyId = 'lord', year = 1) {
  const autumn = (year - 1) * YEAR + AUTUMN;
  const state = gameAt(autumn, (draft) => {
    draft.settings.difficulty = difficulty;
  });
  settleHordeTiles(state, autumn, []);
  return state;
}

const total = (composition: readonly { count: number }[]) =>
  composition.reduce((sum, post) => sum + post.count, 0);

describe('as ondas após sabotagem', () => {
  // Ano 3, ondas inteiras de 40, 60 e 81 (o chefe vem além): 15% dá ⌊40·85/100⌋ = 34,
  // ⌊60·85/100⌋ = 51 e ⌊81·85/100⌋ = 68; 30%, 28/42/56; 45%, 22/33/44; a quarta fica em 45%.
  // Ano 1, ondas de 13, 20 e 27 (um terço, mais o chefe): 15% dá ⌊13·85/100⌋ = 11,
  // ⌊20·85/100⌋ = 17 e ⌊27·85/100⌋ = 22; 30%, ⌊9,1⌋ = 9, 14, ⌊18,9⌋ = 18; 45%, ⌊7,15⌋ = 7,
  // 11, ⌊14,85⌋ = 14. O piso de 1 por posto não pesa: cada posto continua com mais de um.
  it.each([
    [
      3,
      [
        [34, 51, 68],
        [28, 42, 56],
        [22, 33, 44],
        [22, 33, 44],
      ],
    ],
    [
      1,
      [
        [11, 17, 22],
        [9, 14, 18],
        [7, 11, 14],
        [7, 11, 14],
      ],
    ],
  ] as const)(
    'recalcula três reduções sobre a base total no ano %i, limita a 45% e preserva os postos fixos',
    (year, expected) => {
      const state = preparedHorde('lord', year);
      const at = state.lastProcessedAt;
      const rng = cloneState(state).rng;
      for (const [index, counts] of expected.entries()) {
        for (const number of [1, 2, 3] as const)
          applyWaveSabotage(state, number, at, [], 'expedition-1');
        expect(state.horde.wavePlan!.waves.map((wave) => total(wave.composition))).toEqual(counts);
        expect(state.horde.wavePlan!.waves.map((wave) => wave.reductionPercent)).toEqual(
          [1, 2, 3].map(() => Math.min(45, (index + 1) * 15)),
        );
        expect(state.horde.wavePlan!.waves[0]!.composition).toContainEqual({
          wing: 'center',
          line: 'back',
          unit: 'shaman',
          count: 1,
        });
        expect(state.horde.wavePlan!.waves[2]!.composition).toContainEqual({
          wing: 'center',
          line: 'front',
          unit: 'warlord',
          count: 1,
        });
        expect(currentShape(state, '')).toBeNull();
      }
      expect(state.rng).toEqual(rng);
    },
  );

  it('a regeneração aplica a mesma conta e a mesma distribuição da redução', () => {
    const state = preparedHorde();
    for (const number of [1, 2, 3] as const) {
      for (let success = 0; success < 3; success += 1)
        applyWaveSabotage(state, number, AUTUMN, [], 'expedition-1');
    }
    const before = state.horde.wavePlan!.waves.map((wave) =>
      wave.composition.map((post) => post.count),
    );
    observeFormation(state, [{ unit: 'archer', count: 12 }], AUTUMN);
    expect(
      state.horde.wavePlan!.waves.map((wave) => wave.composition.map((post) => post.count)),
    ).toEqual(before);
    expect(currentShape(state, '')).toBeNull();
  });
  it('descarta a revelação do Xamã ao reduzir a onda, sem reescrever a Crônica', () => {
    const state = preparedHorde();
    state.settlement.buildings.watchtower = 2;
    const events: GameEvent[] = [];
    revealWaveThree(state, AUTUMN, events);
    const history = JSON.parse(JSON.stringify(events)) as GameEvent[];
    expect(state.horde.omens).toHaveLength(1);
    applyWaveSabotage(state, 3, AUTUMN, [], 'expedition-2');
    expect(state.horde.omens).toEqual([]);
    expect(deriveViewState(state, AUTUMN).army.omens).toEqual([]);
    expect(currentShape(state, '')).toBeNull();
    expect(events).toEqual(history);
  });

  it.each([1, 2, 4])('descarta presságios naturais afetados com Torre Nv%i', (tower) => {
    const state = preparedHorde();
    state.settlement.buildings.watchtower = tower;
    for (
      let attempt = 0;
      attempt < 100 && !state.horde.omens.some((omen) => omen.wave === 1);
      attempt += 1
    )
      turnOmens(state, AUTUMN, []);
    expect(state.horde.omens.some((omen) => omen.wave === 1)).toBe(true);
    expect(currentShape(state, '')).toBeNull();
    const otherWaves = state.horde.omens.filter((omen) => omen.wave !== 1);
    alertHordeFortress(state, AUTUMN, [], 'expedition-1');
    expect(state.horde.omens).toEqual(otherWaves);
    expect(currentShape(state, '')).toBeNull();
    observeFormation(state, [{ unit: 'knight', count: 8 }], AUTUMN);
    expect(state.horde.omens).toEqual([]);
    expect(currentShape(state, '')).toBeNull();
  });
  // Ano 3: ⌊28·11/10⌋ = 30 em Camponês e ⌊40·11/10⌋ = 44 em Senhor. Ano 1, com as ondas a um
  // terço: ⌊13·11/10⌋ = 14 em Senhor, e em Camponês ⌊9·11/10⌋ = 9, isto é, o alerta não soma
  // ninguém a uma primeira onda de 9 (o piso da conta; balance-v0.4, "Ondas por ano").
  it.each([
    ['peasant', 3, 28, 30],
    ['lord', 3, 40, 44],
    ['peasant', 1, 9, 9],
    ['lord', 1, 13, 14],
  ] as const)(
    'o alerta conta o total uma vez em %s no ano %i (%i → %i), com restos fixos',
    (difficulty, year, before, after) => {
      const state = preparedHorde(difficulty, year);
      const at = state.lastProcessedAt;
      const wave = state.horde.wavePlan!.waves[0]!;
      expect(total(wave.composition)).toBe(before);
      const rng = cloneState(state).rng;
      alertHordeFortress(state, at, [], 'expedition-1');
      expect(total(wave.composition)).toBe(after);
      const counts = wave.composition.map((post) => post.count);
      alertHordeFortress(state, at, [], 'expedition-2');
      expect(wave.composition.map((post) => post.count)).toEqual(counts);
      expect(state.rng).toEqual(rng);
      observeFormation(state, [{ unit: 'knight', count: 8 }], at);
      expect(state.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(counts);
      expect(currentShape(state, '')).toBeNull();
    },
  );

  // Ano 3: ⌊40·55/100⌋ = 22 e ⌊22·11/10⌋ = 24. Ano 1: ⌊13·55/100⌋ = 7 e ⌊7·11/10⌋ = 7.
  it.each([
    [3, 24],
    [1, 7],
  ] as const)(
    'alerta e redução dão o mesmo efetivo e distribuição em qualquer ordem e após regenerar (ano %i)',
    (year, after) => {
      const first = preparedHorde('lord', year);
      const second = preparedHorde('lord', year);
      const at = first.lastProcessedAt;
      alertHordeFortress(first, at, [], 'expedition-1');
      for (const state of [first, second])
        for (let success = 0; success < 3; success += 1)
          applyWaveSabotage(state, 1, at, [], 'expedition-1');
      alertHordeFortress(second, at, [], 'expedition-2');
      const expected = first.horde.wavePlan!.waves[0]!.composition.map((post) => post.count);
      expect(total(first.horde.wavePlan!.waves[0]!.composition)).toBe(after);
      expect(second.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(
        expected,
      );
      observeFormation(first, [{ unit: 'archer', count: 8 }], at);
      expect(first.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(
        expected,
      );
    },
  );
});
