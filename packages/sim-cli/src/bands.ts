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
 * (seção 12: a rodada com a Torre de Vigia e a Ameaça, V2E-T1, nas três dificuldades; a seção
 * 11 é a do primeiro lote de cartas, V2D-T2, a 10, a do motor do Conselho, V2D-T1, e a 9, a da
 * Fase C).
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
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4524, 72),
    'week/3/regular': measured([72, 75], 8, 0, 0, 6188, 6375, 149121, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5835, 6375, 321285, 15),
    'week/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
    'week/1/regular': measured([62, 71], 7, 0, 0, 5625, 4892, 12903, 7),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 20707, 4),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
    'week/0.5/regular': measured([48, 59], 6, 0, 0, 1520, 1389, 1229, 1.5),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1656, 1234, 1262, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
    'year/3/regular': measured([27, 29], 5, 0, 0, 1508, 1518, 2188, 18),
    'year/3/dedicado': measured([48, 55], 7, 0, 0, 1993, 2398, 4959, 6),
    'year/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
    'year/1/regular': measured([62, 71], 7, 0, 0, 5625, 4892, 12903, 7),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 20707, 4),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 265, 931, 848, 5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 22275, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6363, 6375, 34141, 2),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4518, 75),
    'week/3/regular': measured([72, 74], 7, 0, 0, 5100, 5100, 164535, 30),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4951, 5100, 286950, 9),
    'week/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
    'week/1/regular': measured([65, 72], 7, 0, 0, 4559, 4541, 16804, 10),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5081, 5100, 39810, 3),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
    'week/0.5/regular': measured([51, 54], 5, 0, 0, 2700, 1918, 1197, 2.5),
    'week/0.5/dedicado': measured([59, 64], 6, 0, 0, 2189, 1226, 770, 0.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
    'year/3/regular': measured([27, 29], 5, 0, 0, 712, 1418, 2851, 24),
    'year/3/dedicado': measured([52, 55], 6, 0, 0, 2782, 2031, 13229, 9),
    'year/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
    'year/1/regular': measured([65, 72], 7, 0, 0, 4559, 4541, 16804, 10),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5081, 5100, 39810, 3),
    'year/0.5/preguicoso': measured([22, 22], 5, 0, 0, 2897, 1022, 2270, 4),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 4295, 5100, 40331, 2.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5092, 5094, 48041, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4467, 72),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3600, 166557, 30),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2712, 3600, 293821, 18),
    'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
    'week/1/regular': measured([64, 72], 7, 0, 0, 3600, 3568, 18599, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3552, 3600, 44474, 4),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
    'week/0.5/regular': measured([47, 54], 6, 0, 0, 1246, 1240, 832, 1),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 2101, 824, 418, 1.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
    'year/3/regular': measured([27, 29], 5, 0, 0, 765, 855, 1863, 30),
    'year/3/dedicado': measured([48, 54], 6, 0, 0, 2640, 2081, 12703, 18),
    'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
    'year/1/regular': measured([64, 72], 7, 0, 0, 3600, 3568, 18599, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3552, 3600, 44474, 4),
    'year/0.5/preguicoso': measured([22, 22], 6, 0, 0, 451, 1667, 799, 5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3500, 3579, 45176, 2),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 53238, 3),
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
