import { describe, expect, it } from 'vitest';
import { balance, hordeWaves } from './index';
import { BalanceSchema, HordeWavesSchema } from './schemas';

describe('Cerco: números do ADR 0020/19–22', () => {
  it('valida números e composição da preparação existente', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(HordeWavesSchema.safeParse(hordeWaves).error).toBeUndefined();
    expect(hordeWaves.map((w) => w.baseCount)).toEqual([40, 60, 80]);
    expect(hordeWaves[2]!.fixed).toEqual([
      { wing: 'center', line: 'front', unit: 'warlord', count: 1, extra: true },
    ]);
    expect(balance.siege.waveIntervalRealMs).toBe(3_600_000);
    expect(balance.siege.fall).toEqual({
      resourcesLost: { num: 3, den: 10 },
      populationLost: { num: 1, den: 5 },
      buildingsDamaged: 2,
      levelsLost: 2,
    });
  });
  it('recusa perda integral e intervalo fracionário', () => {
    expect(
      BalanceSchema.safeParse({ ...balance, siege: { ...balance.siege, waveIntervalRealMs: 0.5 } })
        .success,
    ).toBe(false);
    expect(
      BalanceSchema.safeParse({
        ...balance,
        siege: {
          ...balance.siege,
          fall: { ...balance.siege.fall, resourcesLost: { num: 1, den: 1 } },
        },
      }).success,
    ).toBe(false);
  });
});
