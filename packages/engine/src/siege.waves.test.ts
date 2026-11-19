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
  // Ano 3: crescimento 12/10 depois do fator anual; as ondas inteiras de hordeWaves (40/60/80 e o chefe extra) vezes o fator da
  // dificuldade (7/10, 1, 13/10): 33/50/67+1, 48/72/96+1, 62/93/124+1.
  it.each([
    ['peasant', [33, 50, 68]],
    ['lord', [48, 72, 97]],
    ['ironKing', [62, 93, 125]],
  ] as const)('conta %s em inteiros e conserva o chefe extra', (difficulty, expected) => {
    const state = siegeYard(difficulty, 1, 3);
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
  // Ano 1 (um terço) e ano 2 (dois terços), com os pisos de cada conta: o fator do ano vem
  // antes do da dificuldade. Ano 1: ⌊40/3⌋ = 13, ⌊60/3⌋ = 20, ⌊80/3⌋ = 26; em Camponês
  // ⌊13·7/10⌋ = 9, ⌊20·7/10⌋ = 14, ⌊26·7/10⌋ = 18; no Rei de Ferro ⌊13·13/10⌋ = 16,
  // ⌊20·13/10⌋ = 26, ⌊26·13/10⌋ = 33. Ano 2 em Senhor: ⌊80/3⌋ = 26, 40, ⌊160/3⌋ = 53.
  // D-13: depois do fator anual, ⌊26·11/10⌋=28, ⌊40·11/10⌋=44, ⌊53·11/10⌋=58.
  // O chefe da terceira onda vem além do tamanho-base em todos os anos.
  it.each([
    ['peasant', 1, [9, 14, 19]],
    ['lord', 1, [13, 20, 27]],
    ['ironKing', 1, [16, 26, 34]],
    ['lord', 2, [28, 44, 59]],
  ] as const)(
    'conta %s no ano %i com o fator do ano e o chefe extra',
    (difficulty, year, expected) => {
      const state = siegeYard(difficulty, 1, year);
      expect(state.horde.wavePlan!.year).toBe(year);
      expect(totals(state)).toEqual(expected);
      expect(preparedSiegeWaves(state)[2]!.composition.find((p) => p.unit === 'warlord')).toEqual({
        wing: 'center',
        line: 'front',
        unit: 'warlord',
        count: 1,
      });
    },
  );
  // Ano 3: a primeira onda perde 15% (⌊48·85/100⌋ = 40) e o alerta soma 10% (⌊40·11/10⌋ = 44);
  // a terceira perde 15% sobre 97 (⌊97·85/100⌋ = 82).
  it('preserva redução, alerta e chefe após a Horda observar outra formação', () => {
    const state = siegeYard('lord', 1, 3);
    const now = state.lastProcessedAt;
    applyWaveSabotage(state, 1, now, [], 'expedition-1');
    applyWaveSabotage(state, 3, now, [], 'expedition-1');
    alertHordeFortress(state, now, [], 'expedition-1');
    const expected = totals(state);
    expect(expected).toEqual([44, 72, 82]);
    observeFormation(state, [{ unit: 'archer', count: 20 }], now);
    expect(totals(state)).toEqual(expected);
  });
  // Ano 1: ⌊13·85/100⌋ = 11 e ⌊11·11/10⌋ = 12 na primeira; ⌊27·85/100⌋ = 22 na terceira.
  it('preserva redução, alerta e chefe no ano 1, com as ondas a um terço', () => {
    const state = siegeYard();
    const now = state.lastProcessedAt;
    applyWaveSabotage(state, 1, now, [], 'expedition-1');
    applyWaveSabotage(state, 3, now, [], 'expedition-1');
    alertHordeFortress(state, now, [], 'expedition-1');
    const expected = totals(state);
    expect(expected).toEqual([12, 20, 22]);
    observeFormation(state, [{ unit: 'archer', count: 20 }], now);
    expect(totals(state)).toEqual(expected);
  });
  it('só revela a preparação pela névoa existente, sem expor as ondas', () => {
    const state = siegeYard();
    revealWaveThree(state, state.lastProcessedAt, []);
    const before = JSON.stringify(state.rng);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.siege).toBeNull();
    expect(JSON.stringify(view)).not.toContain('wavePlan');
    expect(JSON.stringify(state.rng)).toBe(before);
    expect(state.horde.omens[0]!.reveals).toEqual(preparedSiegeWaves(state)[2]!.composition);
  });
});
