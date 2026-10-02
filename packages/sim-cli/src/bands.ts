import { balance, type DifficultyId } from '@lotg/content';

import type { ProfileId, Range, WindowId } from './matrix';
import {
  formatDecimal,
  refusedByCode,
  type Summary,
  SURPLUS_RESOURCES,
  type SurplusResource,
  worstWasteStreak,
} from './report';

/** Uma célula da matriz: `week/3/regular` é 7 dias reais, ritmo 3, perfil Regular. */
export type CellKey = `${WindowId}/${number}/${ProfileId}`;

export function cellKey(window: WindowId, timeScale: number, profile: ProfileId): CellKey {
  return `${window}/${timeScale}/${profile}`;
}

/** O que as 50 sementes mediram em uma célula, só nas grandezas que têm faixa. */
type Baseline = {
  /** Menor e maior população final. */
  villagers: Range;
  /** Menor nível final do Salão do Senhor. */
  townHall: number;
  /** Maior número de horas reais com fome. */
  famineHours: number;
  /** Maior número de horas reais com frio. */
  coldHours: number;
  /** Maior estoque final de cada material, em unidades: o excedente parado. */
  surplus: Record<SurplusResource, number>;
  /** A maior sequência desperdiçando um recurso, o pior deles, em horas de jogo. */
  wasteStreak: number;
};

function measured(
  villagers: [number, number],
  townHall: number,
  famineHours: number,
  coldHours: number,
  wood: number,
  stone: number,
  gold: number,
  wasteStreak: number,
): Baseline {
  return {
    villagers: { min: villagers[0], max: villagers[1] },
    townHall,
    famineHours,
    coldHours,
    surplus: { wood, stone, gold },
    wasteStreak,
  };
}

/**
 * Linha de base medida: 50 sementes por célula, em cada dificuldade. As faixas saem daqui, pela
 * regra de `SLACK`. A rodada completa, com data e identificação, está em docs/balance-v0.2.md
 * (seção 14: a rodada com as incursões de lobos e a política da Paliçada, V2E-T3, nas três
 * dificuldades; a seção 13 é a da Paliçada por erguer e das três cartas da promessa, V2E-T2, a
 * 12, a da Torre de Vigia e da Ameaça, V2E-T1, a 11, a do primeiro lote de cartas, V2D-T2, a
 * 10, a do motor do Conselho, V2D-T1, e a 9, a da Fase C).
 *
 * Estes números NÃO são metas aprovadas pelo autor: são o jogo como ele está, postos como
 * guarda de regressão (ADR 0013, decisão 5). Quando uma mecânica muda a economia de propósito,
 * a tarefa roda `pnpm -s sim -- --matrix` em cada dificuldade, confere o que mudou e por quê,
 * atualiza esta tabela e registra a rodada em docs/balance-v0.2.md, como se faz com um golden.
 * Quando uma faixa falha sem que a mudança fosse a intenção, o ajuste é nos números de
 * `@lotg/content`, nunca no bot.
 */
// Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro
// parados, e a maior sequência desperdiçando um recurso, em horas de jogo.
const MEASURED: Record<DifficultyId, Partial<Record<CellKey, Baseline>>> = {
  peasant: {
    'week/3/preguicoso': measured([26, 33], 6, 0, 0, 4125, 4125, 16113, 129),
    'week/3/regular': measured([68, 74], 8, 0, 0, 5547, 6375, 151631, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5954, 6375, 313483, 15),
    'week/1/preguicoso': measured([17, 32], 4, 0, 0, 2625, 2324, 3437, 8),
    'week/1/regular': measured([59, 71], 7, 0, 0, 4903, 4805, 12955, 6),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 16328, 3),
    'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 408, 252, 247, 1),
    'week/0.5/regular': measured([48, 54], 5, 0, 0, 1377, 837, 921, 2.5),
    'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 1358, 1203, 781, 0),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 1070, 868, 160, 129),
    'year/3/regular': measured([27, 27], 4, 0, 0, 948, 1946, 2515, 9),
    'year/3/dedicado': measured([47, 54], 6, 0, 0, 3079, 2304, 10286, 9),
    'year/1/preguicoso': measured([17, 32], 4, 0, 0, 2625, 2324, 3437, 8),
    'year/1/regular': measured([59, 71], 7, 0, 0, 4903, 4805, 12955, 6),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 16328, 3),
    'year/0.5/preguicoso': measured([21, 22], 5, 0, 0, 2995, 1875, 2004, 7),
    'year/0.5/regular': measured([84, 84], 8, 0, 0, 6375, 6375, 19251, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 30974, 2.5),
  },
  lord: {
    'week/3/preguicoso': measured([26, 33], 6, 0, 0, 3900, 3900, 16184, 132),
    'week/3/regular': measured([72, 75], 7, 0, 0, 4782, 5100, 162453, 33),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4901, 5100, 284556, 18),
    'week/1/preguicoso': measured([17, 32], 4, 0, 0, 2100, 2100, 3447, 16),
    'week/1/regular': measured([60, 71], 6, 0, 0, 4417, 4549, 15132, 9),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 35085, 3),
    'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 405, 346, 264, 4),
    'week/0.5/regular': measured([48, 54], 5, 0, 0, 2700, 1557, 1704, 3),
    'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 2486, 826, 634, 1),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 891, 868, 160, 132),
    'year/3/regular': measured([27, 27], 4, 0, 0, 775, 1487, 2311, 18),
    'year/3/dedicado': measured([51, 54], 6, 0, 0, 2848, 1956, 12053, 18),
    'year/1/preguicoso': measured([17, 32], 4, 0, 0, 2100, 2100, 3447, 16),
    'year/1/regular': measured([60, 71], 6, 0, 0, 4417, 4549, 15132, 9),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 35085, 3),
    'year/0.5/preguicoso': measured([20, 22], 5, 0, 0, 2700, 959, 2203, 7.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 5100, 5100, 38821, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5069, 5100, 46914, 3.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([25, 33], 6, 0, 0, 3120, 3120, 17320, 135),
    'week/3/regular': measured([72, 74], 7, 0, 0, 2736, 3600, 162297, 33),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2740, 3600, 289164, 33),
    'week/1/preguicoso': measured([17, 32], 4, 0, 0, 1680, 1434, 3552, 9),
    'week/1/regular': measured([64, 70], 7, 0, 0, 3600, 3592, 17032, 9),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3599, 3600, 40413, 3),
    'week/0.5/preguicoso': measured([12, 13], 4, 0, 0, 323, 355, 248, 5),
    'week/0.5/regular': measured([47, 54], 5, 0, 0, 2160, 1267, 1315, 2.5),
    'week/0.5/dedicado': measured([54, 64], 6, 0, 0, 1464, 802, 505, 1.5),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 607, 660, 160, 135),
    'year/3/regular': measured([27, 29], 4, 0, 0, 799, 1348, 2236, 27),
    'year/3/dedicado': measured([50, 53], 6, 0, 0, 2640, 1806, 10576, 15),
    'year/1/preguicoso': measured([17, 32], 4, 0, 0, 1680, 1434, 3552, 9),
    'year/1/regular': measured([64, 70], 7, 0, 0, 3600, 3592, 17032, 9),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3599, 3600, 40413, 3),
    'year/0.5/preguicoso': measured([20, 22], 5, 0, 0, 2160, 1680, 2081, 8),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3600, 3600, 42860, 3.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 51693, 2.5),
  },
};

/** A folga entre o que foi medido e o que a faixa aceita. Pequena e explícita. */
export const SLACK = {
  /** População: de 10% abaixo do menor a 10% acima do maior valor medido. */
  villagersPercent: 10,
  /**
   * Horas de fome, horas de frio, excedente parado e sequência desperdiçando: até 5% acima do
   * maior valor medido.
   */
  ceilingPercent: 5,
} as const;

/** A faixa que a CI cobra de cada partida de uma célula. */
export type Band = {
  villagers: Range;
  townHallMin: number;
  famineHoursMax: number;
  coldHoursMax: number;
  /** Limite do excedente parado de cada material, em unidades. */
  surplusMax: Record<SurplusResource, number>;
  /**
   * Limite da maior sequência desperdiçando um recurso, em horas de jogo. Como as outras, é o
   * medido com folga, uma guarda de regressão: a **meta** é `WASTE_STREAK_GOAL`, e as células do
   * perfil Regular que ainda passam dela estão em `balance.test.ts` e em docs/balance-v0.2.md.
   */
  wasteStreakMax: number;
};

function ceiling(value: number): number {
  return Math.ceil((value * (100 + SLACK.ceilingPercent)) / 100);
}

function bandOf(baseline: Baseline): Band {
  const { villagersPercent } = SLACK;
  return {
    villagers: {
      min: Math.floor((baseline.villagers.min * (100 - villagersPercent)) / 100),
      max: Math.ceil((baseline.villagers.max * (100 + villagersPercent)) / 100),
    },
    townHallMin: baseline.townHall,
    famineHoursMax: ceiling(baseline.famineHours),
    coldHoursMax: ceiling(baseline.coldHours),
    surplusMax: Object.fromEntries(
      SURPLUS_RESOURCES.map((id) => [id, ceiling(baseline.surplus[id])]),
    ) as Record<SurplusResource, number>,
    wasteStreakMax: ceiling(baseline.wasteStreak),
  };
}

/**
 * A faixa de uma célula em uma dificuldade (o padrão é Senhor, a de quem não escolhe); `null`
 * quando a célula não foi medida (um ritmo que o jogo não oferece).
 */
export function bandFor(key: CellKey, difficulty: DifficultyId = 'lord'): Band | null {
  const baseline = MEASURED[difficulty][key];
  return baseline === undefined ? null : bandOf(baseline);
}

/** O que uma partida tem fora da faixa, uma frase por problema; vazio quando está dentro. */
export function checkBand(band: Band, summary: Summary): string[] {
  const problems: string[] = [];
  const { villagers, townHall, famineHours, coldHours, surplus, commandsRefused } = summary;
  if (villagers < band.villagers.min || villagers > band.villagers.max) {
    problems.push(
      `população ${villagers}, fora da faixa de ${band.villagers.min} a ${band.villagers.max}`,
    );
  }
  if (townHall < band.townHallMin) {
    problems.push(`Salão no nível ${townHall}, abaixo do nível ${band.townHallMin}`);
  }
  if (famineHours > band.famineHoursMax) {
    problems.push(`${famineHours} h de fome, acima do limite de ${band.famineHoursMax} h`);
  }
  if (coldHours > band.coldHoursMax) {
    problems.push(`${coldHours} h de frio, acima do limite de ${band.coldHoursMax} h`);
  }
  for (const id of SURPLUS_RESOURCES) {
    if (surplus[id] > band.surplusMax[id]) {
      problems.push(
        `excedente parado de ${balance.resources[id].label.toLowerCase()}: ${surplus[id]}, acima do limite de ${band.surplusMax[id]}`,
      );
    }
  }
  const waste = worstWasteStreak(summary);
  if (waste.gameHours > band.wasteStreakMax) {
    problems.push(
      `${formatDecimal(waste.gameHours)} h de jogo seguidas desperdiçando ${balance.resources[waste.resource].label.toLowerCase()}, acima do limite de ${band.wasteStreakMax} h`,
    );
  }
  if (commandsRefused > 0) {
    problems.push(
      `${commandsRefused} ordens recusadas pelo motor (${refusedByCode(summary.refusedByCode)})`,
    );
  }
  return problems;
}
