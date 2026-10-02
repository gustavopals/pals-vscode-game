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
 * (seção 13: a rodada com a Paliçada por erguer e as três cartas da promessa no sorteio,
 * V2E-T2, nas três dificuldades; a seção 12 é a da Torre de Vigia e da Ameaça, V2E-T1, a 11, a
 * do primeiro lote de cartas, V2D-T2, a 10, a do motor do Conselho, V2D-T1, e a 9, a da Fase
 * C).
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
    'week/3/regular': measured([72, 75], 8, 0, 0, 6204, 6375, 152661, 30),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 6165, 6375, 319793, 15),
    'week/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
    'week/1/regular': measured([56, 72], 7, 0, 0, 4915, 4944, 13686, 6),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 21732, 4),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
    'week/0.5/regular': measured([52, 59], 6, 0, 0, 1380, 1240, 1073, 1.5),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1398, 1175, 1168, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
    'year/3/regular': measured([27, 27], 5, 0, 0, 1504, 1544, 2172, 18),
    'year/3/dedicado': measured([48, 55], 7, 0, 0, 1989, 3108, 6092, 6),
    'year/1/preguicoso': measured([30, 33], 6, 0, 0, 597, 469, 1700, 10),
    'year/1/regular': measured([56, 72], 7, 0, 0, 4915, 4944, 13686, 6),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 21732, 4),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 265, 931, 848, 5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 22238, 2.5),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 33867, 2),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4518, 75),
    'week/3/regular': measured([72, 74], 7, 0, 0, 4702, 5100, 163202, 27),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4257, 5100, 286161, 15),
    'week/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
    'week/1/regular': measured([65, 72], 7, 0, 0, 4500, 4498, 16276, 10),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 40346, 3),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
    'week/0.5/regular': measured([50, 54], 5, 0, 0, 2700, 1820, 985, 2.5),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1841, 1161, 710, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
    'year/3/regular': measured([27, 27], 5, 0, 0, 689, 1338, 2860, 24),
    'year/3/dedicado': measured([52, 54], 6, 0, 0, 2817, 2342, 14273, 15),
    'year/1/preguicoso': measured([30, 33], 5, 0, 0, 2100, 905, 1585, 11),
    'year/1/regular': measured([65, 72], 7, 0, 0, 4500, 4498, 16276, 10),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 40346, 3),
    'year/0.5/preguicoso': measured([22, 22], 5, 0, 0, 2897, 1022, 2270, 4),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 4887, 5099, 40290, 2.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5099, 5100, 47431, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4467, 72),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3600, 169241, 30),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2738, 3600, 294587, 15),
    'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
    'week/1/regular': measured([64, 72], 7, 0, 0, 3600, 3598, 19564, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3572, 3600, 44789, 4),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
    'week/0.5/regular': measured([47, 54], 6, 0, 0, 1306, 1231, 795, 1),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 2004, 794, 447, 1.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
    'year/3/regular': measured([27, 29], 5, 0, 0, 778, 794, 1635, 30),
    'year/3/dedicado': measured([47, 54], 6, 0, 0, 2584, 2111, 12727, 15),
    'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 672, 1548, 12),
    'year/1/regular': measured([64, 72], 7, 0, 0, 3600, 3598, 19564, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3572, 3600, 44789, 4),
    'year/0.5/preguicoso': measured([22, 22], 6, 0, 0, 451, 1667, 799, 5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3594, 3600, 45478, 2.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 54557, 2.5),
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
