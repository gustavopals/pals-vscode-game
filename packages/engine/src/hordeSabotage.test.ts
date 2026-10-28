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
import { AUTUMN, gameAt } from './test-helpers';

function preparedHorde(difficulty: DifficultyId = 'lord') {
  const state = gameAt(AUTUMN, (draft) => {
    draft.settings.difficulty = difficulty;
  });
  settleHordeTiles(state, AUTUMN, []);
  return state;
}

const total = (composition: readonly { count: number }[]) =>
  composition.reduce((sum, post) => sum + post.count, 0);

describe('as ondas após sabotagem', () => {
  it('recalcula três reduções sobre a base total, limita a 45% e preserva os postos fixos', () => {
    const state = preparedHorde();
    const rng = cloneState(state).rng;
    const expected = [
      [34, 51, 68],
      [28, 42, 56],
      [22, 33, 44],
      [22, 33, 44],
    ];
    for (const [index, counts] of expected.entries()) {
      for (const number of [1, 2, 3] as const)
        applyWaveSabotage(state, number, AUTUMN, [], 'expedition-1');
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
  });

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
  it.each([
    ['peasant', 28, 30],
    ['lord', 40, 44],
  ] as const)(
    'o alerta aumenta o total uma vez em %s (%i → %i), com restos fixos',
    (difficulty, before, after) => {
      const state = preparedHorde(difficulty);
      const wave = state.horde.wavePlan!.waves[0]!;
      expect(total(wave.composition)).toBe(before);
      const rng = cloneState(state).rng;
      alertHordeFortress(state, AUTUMN, [], 'expedition-1');
      expect(total(wave.composition)).toBe(after);
      const counts = wave.composition.map((post) => post.count);
      alertHordeFortress(state, AUTUMN, [], 'expedition-2');
      expect(wave.composition.map((post) => post.count)).toEqual(counts);
      expect(state.rng).toEqual(rng);
      observeFormation(state, [{ unit: 'knight', count: 8 }], AUTUMN);
      expect(state.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(counts);
      expect(currentShape(state, '')).toBeNull();
    },
  );

  it('alerta e redução dão o mesmo efetivo e distribuição em qualquer ordem e após regenerar', () => {
    const first = preparedHorde();
    const second = preparedHorde();
    alertHordeFortress(first, AUTUMN, [], 'expedition-1');
    for (const state of [first, second])
      for (let success = 0; success < 3; success += 1)
        applyWaveSabotage(state, 1, AUTUMN, [], 'expedition-1');
    alertHordeFortress(second, AUTUMN, [], 'expedition-2');
    const expected = first.horde.wavePlan!.waves[0]!.composition.map((post) => post.count);
    expect(total(first.horde.wavePlan!.waves[0]!.composition)).toBe(24);
    expect(second.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(
      expected,
    );
    observeFormation(first, [{ unit: 'archer', count: 8 }], AUTUMN);
    expect(first.horde.wavePlan!.waves[0]!.composition.map((post) => post.count)).toEqual(expected);
  });
});
