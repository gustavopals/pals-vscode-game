import { describe, expect, it } from 'vitest';

import { balance } from './balance';
import { BalanceSchema } from './schemas';

describe('a batalha (GDD §10.1 a §10.4; ADR 0019, decisão 11)', () => {
  it('os fatores do GDD, em fração', () => {
    const rules = balance.battle;
    expect(rules.maxRounds).toBe(12);
    expect(rules.luck).toEqual({ min: 90, max: 110 });
    expect(rules.absorb).toEqual({ num: 1, den: 2 });
    expect(rules.minDamage).toEqual({ num: 1, den: 5 });
    expect(rules.flank).toEqual({ num: 5, den: 4 });
    expect(rules.counter).toEqual({ num: 3, den: 2 });
    expect(rules.shieldbearerShare).toEqual({ num: 1, den: 2 });
    expect(rules.wall).toEqual({
      enemyRangedFactor: { num: 7, den: 10 },
      coverFactor: { num: 6, den: 5 },
      ignoresHalfShare: { num: 1, den: 2 },
    });
    // 12 por nível da Torre acima do 2.
    expect(rules.towers).toEqual({ fromLevel: 3, damagePerLevel: 12 });
    expect(rules.morale).toEqual({
      start: 100,
      perSquad: 10,
      perWing: 20,
      perCommander: 15,
      routAtOrBelow: 30,
    });
    expect(rules.auras.warriorDefense).toEqual({ num: 23, den: 20 });
    expect(rules.auras.archerRanged).toEqual({ num: 23, den: 20 });
    expect(rules.auras.mage.everyRounds).toBe(3);
    expect(rules.auras.cleric).toMatchObject({
      everyRounds: 2,
      heal: { num: 1, den: 10 },
      morale: 20,
    });
    expect(rules.auras.undeadFactor).toEqual({ num: 2, den: 1 });
    expect(balance.army.reportsKept).toBe(3);
  });

  it('o schema recusa uma sorte que não contém 100', () => {
    const broken = { ...balance, battle: { ...balance.battle, luck: { min: 101, max: 110 } } };
    expect(BalanceSchema.safeParse(broken).success).toBe(false);
    expect(BalanceSchema.safeParse(balance).success).toBe(true);
  });
});
