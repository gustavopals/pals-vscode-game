import { describe, expect, it } from 'vitest';

import { balance, DIFFICULTY_IDS, HORDE_UNIT_IDS, omenTexts, UNIT_IDS } from './index';
import { BalanceSchema } from './schemas';

describe('A Horda que aprende e os presságios (ADR 0020, decisões 15 e 18)', () => {
  it('o conteúdo passa no schema', () => {
    const result = BalanceSchema.safeParse(balance);
    expect(result.error).toBeUndefined();
  });

  it('a astúcia é a do ADR 0020: 3/10, 1/2 e 4/5', () => {
    expect(balance.horde.cunning).toEqual({
      peasant: { num: 3, den: 10 },
      lord: { num: 1, den: 2 },
      ironKing: { num: 4, den: 5 },
    });
    expect(Object.keys(balance.horde.cunning)).toEqual([...DIFFICULTY_IDS]);
    expect(Object.keys(balance.horde.counterWeights)).toEqual([...UNIT_IDS]);
    expect(balance.horde.counterWeights.shieldbearer).toBe(0);
  });

  it('a chance e a clareza são as do GDD §11.1', () => {
    expect(balance.omens.chancePercent).toBe(35);
    expect(balance.omens.perTowerLevelAbove1).toBe(10);
    expect(balance.omens.clarityByLevel).toEqual(['vague', 'vague', 'partial', 'partial', 'exact']);
  });

  it('há uma frase vaga por inimigo e os marcadores das outras existem', () => {
    expect(Object.keys(omenTexts.vague)).toEqual([...HORDE_UNIT_IDS]);
    for (const text of Object.values(omenTexts.vague)) {
      expect(text).not.toMatch(/\d/);
    }
    for (const marker of ['{contagem}', '{inimigo}', '{ala}', '{onda}']) {
      expect(omenTexts.partial).toContain(marker);
    }
    for (const marker of ['{onda}', '{composicao}']) {
      expect(omenTexts.exact).toContain(marker);
    }
  });
});
