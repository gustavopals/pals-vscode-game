import type { DifficultyId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { applyWaveSabotage, observeFormation, settleHordeTiles } from './hordePlan';
import { currentShape } from './migrations';
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
    const rng = structuredClone(state.rng);
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
});
