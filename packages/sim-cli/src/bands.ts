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
 * (seção 16: as correções das cartas da revisão das Fases D e E, V2DE, nas três dificuldades;
 * a seção 15 é a dos objetivos 5 a 10 e dos bots seguindo a lista, V2E-T4; a 14, a das
 * incursões de lobos e da política da Paliçada, V2E-T3; a 13, a da Paliçada por erguer e das
 * três cartas da promessa, V2E-T2; a 12, a da Torre de Vigia e da Ameaça, V2E-T1; a 11, a do
 * primeiro lote de cartas, V2D-T2; a 10, a do motor do Conselho, V2D-T1; e a 9, a da Fase C).
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
    'week/3/preguicoso': measured([33, 35], 6, 0, 0, 4125, 4125, 13763, 120),
    'week/3/regular': measured([70, 76], 8, 0, 0, 5511, 6375, 153622, 30),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5860, 6375, 316224, 18),
    'week/1/preguicoso': measured([16, 29], 2, 0, 0, 2322, 3375, 980, 46),
    'week/1/regular': measured([63, 72], 7, 0, 0, 4875, 4920, 18983, 6),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 17410, 3),
    'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1290, 1885, 276, 4.5),
    'week/0.5/regular': measured([49, 54], 5, 0, 0, 1139, 985, 940, 2),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 1516, 1146, 829, 0),
    'year/3/preguicoso': measured([13, 15], 2, 0, 0, 321, 475, 404, 120),
    'year/3/regular': measured([24, 30], 4, 0, 0, 659, 1224, 5339, 15),
    'year/3/dedicado': measured([50, 55], 6, 0, 0, 1945, 2460, 14152, 18),
    'year/1/preguicoso': measured([16, 29], 2, 0, 0, 2322, 3375, 980, 46),
    'year/1/regular': measured([63, 72], 7, 0, 0, 4875, 4920, 18983, 6),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 17410, 3),
    'year/0.5/preguicoso': measured([53, 60], 7, 0, 0, 2400, 954, 3126, 8),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 19246, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6369, 6375, 31506, 3),
  },
  lord: {
    'week/3/preguicoso': measured([33, 35], 6, 0, 0, 3900, 3900, 13660, 123),
    'week/3/regular': measured([70, 75], 7, 0, 0, 5100, 5087, 159919, 33),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4257, 5100, 288044, 21),
    'week/1/preguicoso': measured([16, 30], 2, 0, 0, 1923, 2700, 828, 58),
    'week/1/regular': measured([57, 72], 7, 0, 0, 4366, 4536, 20386, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5096, 5100, 35452, 3),
    'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1500, 1583, 275, 6),
    'week/0.5/regular': measured([49, 54], 5, 0, 0, 2700, 1867, 2281, 2.5),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 1254, 1118, 487, 0),
    'year/3/preguicoso': measured([13, 15], 2, 0, 0, 207, 390, 409, 123),
    'year/3/regular': measured([24, 30], 4, 0, 0, 774, 715, 6538, 18),
    'year/3/dedicado': measured([51, 55], 6, 0, 0, 2861, 2000, 16254, 18),
    'year/1/preguicoso': measured([16, 30], 2, 0, 0, 1923, 2700, 828, 58),
    'year/1/regular': measured([57, 72], 7, 0, 0, 4366, 4536, 20386, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5096, 5100, 35452, 3),
    'year/0.5/preguicoso': measured([54, 60], 6, 0, 0, 4500, 1771, 6521, 8.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 5100, 5100, 39293, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5097, 5100, 46803, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 35], 6, 0, 0, 3120, 3120, 13695, 135),
    'week/3/regular': measured([64, 75], 7, 0, 0, 2736, 3600, 162435, 60),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2712, 3600, 295281, 42),
    'week/1/preguicoso': measured([16, 29], 2, 0, 0, 1938, 2160, 525, 45),
    'week/1/regular': measured([64, 71], 6, 0, 0, 3600, 3568, 22871, 9),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 42436, 3),
    'week/0.5/preguicoso': measured([24, 25], 3, 0, 0, 1680, 1680, 275, 10),
    'week/0.5/regular': measured([47, 54], 5, 0, 0, 2160, 1355, 1782, 2.5),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 1514, 796, 535, 0),
    'year/3/preguicoso': measured([13, 15], 2, 0, 0, 268, 477, 506, 126),
    'year/3/regular': measured([24, 30], 4, 0, 0, 565, 727, 6381, 18),
    'year/3/dedicado': measured([49, 54], 5, 0, 0, 1560, 1639, 15266, 18),
    'year/1/preguicoso': measured([16, 29], 2, 0, 0, 1938, 2160, 525, 45),
    'year/1/regular': measured([64, 71], 6, 0, 0, 3600, 3568, 22871, 9),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 42436, 3),
    'year/0.5/preguicoso': measured([55, 60], 6, 0, 0, 3600, 1847, 6565, 10.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3594, 3600, 42197, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 51454, 2.5),
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
