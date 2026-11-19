import type { HordeUnitId, LineId, Ratio, WingId } from './ids';

/** Preparação das ondas lidas pelos presságios (GDD §11.1–11.2; ADR 0020, 18–19). */
export type HordeWaveDef = {
  readonly number: 1 | 2 | 3;
  readonly baseCount: number;
  readonly mix: Partial<Record<HordeUnitId, number>>;
  readonly fixed: readonly {
    readonly wing: WingId;
    readonly line: LineId;
    readonly unit: HordeUnitId;
    readonly count: number;
    /** O chefe vem além do tamanho-base; o Xamã da primeira onda conta nele. */
    readonly extra: boolean;
  }[];
};

/** Fatores de tamanho das ondas do Cerco por ano de jogo (respostas do autor de 2026-11-04: um terço no ano 1, dois terços no ano 2). */
export const hordeWaveYearFactors: readonly Ratio[] = [
  { num: 1, den: 3 },
  { num: 2, den: 3 },
];

/** Fator multiplicador do tamanho base da onda conforme o ano do Cerco (ano >= 1; ano 3+ é 1/1). */
export function siegeWaveYearFactor(year: number): Ratio {
  if (year <= 0) return hordeWaveYearFactors[0]!;
  const index = year - 1;
  return index < hordeWaveYearFactors.length ? hordeWaveYearFactors[index]! : { num: 1, den: 1 };
}

/** D-13: +10% por ano anterior, aplicado com piso após o fator do ano. */
export function siegeWaveGrowthFactor(year: number): Ratio {
  return { num: 10 + Math.max(0, year - 1), den: 10 };
}

/** D-14: memória anterior só na primeira preparação, com metade da adaptação. */
export const previousYearMemoryFactor: Ratio = { num: 1, den: 2 };

/** Pesos iniciais do agente, conforme os tipos de cada onda do GDD; medir na V4G-T2. */
export const hordeWaves: readonly HordeWaveDef[] = [
  {
    number: 1,
    baseCount: 40,
    mix: { raider: 70, banditArcher: 30 },
    fixed: [{ wing: 'center', line: 'back', unit: 'shaman', count: 1, extra: false }],
  },
  { number: 2, baseCount: 60, mix: { wolf: 50, ogre: 20, raider: 30 }, fixed: [] },
  {
    number: 3,
    baseCount: 80,
    mix: { blackKnight: 45, skeleton: 40, shaman: 15 },
    fixed: [{ wing: 'center', line: 'front', unit: 'warlord', count: 1, extra: true }],
  },
];

/** Datas dos tiles em dias de jogo; a Fortaleza segue a estação. */
export const hordeTiles = { campAtGameDay: 25, fortressSeason: 'autumn' as const };
