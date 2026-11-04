import { describe, expect, it } from 'vitest';
import { balance, hordeWaveYearFactors, hordeWaves, siegeWaveYearFactor } from './index';
import { BalanceSchema, HordeWaveYearFactorsSchema, HordeWavesSchema } from './schemas';

describe('Cerco: números do ADR 0020/19–22', () => {
  it('valida números e composição da preparação existente', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
    expect(HordeWavesSchema.safeParse(hordeWaves).error).toBeUndefined();
    expect(HordeWaveYearFactorsSchema.safeParse(hordeWaveYearFactors).error).toBeUndefined();
    expect(hordeWaves.map((w) => w.baseCount)).toEqual([40, 60, 80]);
    expect(hordeWaves[2]!.fixed).toEqual([
      { wing: 'center', line: 'front', unit: 'warlord', count: 1, extra: true },
    ]);
    expect(balance.siege.waveIntervalRealMs).toBe(3_600_000);
    expect(balance.siege.waveYearFactors).toEqual([
      { num: 1, den: 3 },
      { num: 2, den: 3 },
    ]);
    expect(balance.siege.fall).toEqual({
      resourcesLost: { num: 3, den: 10 },
      populationLost: { num: 1, den: 5 },
      buildingsDamaged: 2,
      levelsLost: 2,
    });
  });

  it('fatores das ondas por ano escalam 1/3, 2/3 e 1 dali em diante', () => {
    expect(siegeWaveYearFactor(1)).toEqual({ num: 1, den: 3 });
    expect(siegeWaveYearFactor(2)).toEqual({ num: 2, den: 3 });
    expect(siegeWaveYearFactor(3)).toEqual({ num: 1, den: 1 });
    expect(siegeWaveYearFactor(4)).toEqual({ num: 1, den: 1 });

    const waveSizesForYear = (year: number) => {
      const factor = siegeWaveYearFactor(year);
      return hordeWaves.map((w) => Math.floor((w.baseCount * factor.num) / factor.den));
    };

    expect(waveSizesForYear(1)).toEqual([13, 20, 26]);
    expect(waveSizesForYear(2)).toEqual([26, 40, 53]);
    expect(waveSizesForYear(3)).toEqual([40, 60, 80]);
    expect(waveSizesForYear(4)).toEqual([40, 60, 80]);
  });

  it('recusa perda integral, intervalo fracionário e fatores inválidos', () => {
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
    expect(
      HordeWaveYearFactorsSchema.safeParse([
        { num: 0.5, den: 1 },
        { num: 3, den: 4 },
      ]).success,
    ).toBe(false);
    expect(
      HordeWaveYearFactorsSchema.safeParse([
        { num: -1, den: 2 },
        { num: 3, den: 4 },
      ]).success,
    ).toBe(false);
    expect(
      HordeWaveYearFactorsSchema.safeParse([
        { num: 1, den: 0 },
        { num: 3, den: 4 },
      ]).success,
    ).toBe(false);
    expect(
      HordeWaveYearFactorsSchema.safeParse([
        { num: 5, den: 4 },
        { num: 3, den: 4 },
      ]).success,
    ).toBe(false);
  });
});
