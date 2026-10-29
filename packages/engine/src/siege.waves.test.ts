import { describe, expect, it } from 'vitest';
import {
  applyWaveSabotage,
  alertHordeFortress,
  observeFormation,
  revealWaveThree,
} from './hordePlan';
import { preparedSiegeWaves } from './siege';
import { siegeYard } from './siege.test-helpers';
import { deriveViewState } from './view';

const totals = (state: ReturnType<typeof siegeYard>) =>
  preparedSiegeWaves(state).map((w) => w.composition.reduce((sum, p) => sum + p.count, 0));

describe('Cerco: a preparação da Horda é a composição definitiva', () => {
  it.each([
    ['peasant', [28, 42, 57]],
    ['lord', [40, 60, 81]],
    ['ironKing', [52, 78, 105]],
  ] as const)('conta %s em inteiros e conserva o chefe extra', (difficulty, expected) => {
    const state = siegeYard(difficulty);
    expect(totals(state)).toEqual(expected);
    expect(preparedSiegeWaves(state)[2]!.composition.find((p) => p.unit === 'warlord')).toEqual({
      wing: 'center',
      line: 'front',
      unit: 'warlord',
      count: 1,
    });
    const copy = preparedSiegeWaves(state);
    copy[0]!.composition[0]!.count = 1;
    expect(totals(state)).toEqual(expected);
  });
  it('preserva redução, alerta e chefe após a Horda observar outra formação', () => {
    const state = siegeYard();
    const now = state.lastProcessedAt;
    applyWaveSabotage(state, 1, now, [], 'expedition-1');
    applyWaveSabotage(state, 3, now, [], 'expedition-1');
    alertHordeFortress(state, now, [], 'expedition-1');
    const expected = totals(state);
    expect(expected).toEqual([37, 60, 68]);
    observeFormation(state, [{ unit: 'archer', count: 20 }], now);
    expect(totals(state)).toEqual(expected);
  });
  it('só revela a preparação pela névoa existente, sem expor as ondas', () => {
    const state = siegeYard();
    revealWaveThree(state, state.lastProcessedAt, []);
    const before = JSON.stringify(state.rng);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect('siege' in view).toBe(false);
    expect(JSON.stringify(view)).not.toContain('wavePlan');
    expect(JSON.stringify(state.rng)).toBe(before);
    expect(state.horde.omens[0]!.reveals).toEqual(preparedSiegeWaves(state)[2]!.composition);
  });
});
