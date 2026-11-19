import { describe, expect, it } from 'vitest';
import { VOW_IDS, vows, vowRules } from './index';

it('publica só os quatro Votos da D-16, seus bônus e a janela real da D-17', () => {
  expect(VOW_IDS).toEqual(['noWalls', 'cunningHorde', 'scarceFood', 'mortalHeroes']);
  expect(Object.keys(vows)).toEqual([...VOW_IDS]);
  expect(VOW_IDS.map((id) => vows[id].legacyBonusPercent)).toEqual([40, 25, 20, 35]);
  expect(vowRules.choiceWindowRealMs).toBe(86_400_000);
});

describe('frações dos desafios', () => {
  it('mantém os fatores em inteiros', () => {
    expect(vows.cunningHorde.cunning).toEqual({ num: 4, den: 5 });
    expect(vows.scarceFood.productionMultiplier).toEqual({ num: 4, den: 5 });
  });
});
