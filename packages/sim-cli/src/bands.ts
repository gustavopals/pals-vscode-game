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
 * (seção 20: os sete problemas das cartas corrigidos, V2G-T4, com o antes e o depois das células
 * que mudaram; a 18 é a da capacidade de 1.000 no nível 1 dos depósitos e dos 50 de ouro do
 * objetivo 4, ADR 0016, com o antes e o depois de cada célula e o que piorou; a 17 é a das cartas corrigidas
 * depois da revisão das Fases D e E, sobre a Ameaça reequilibrada da seção 16, nas três
 * dificuldades; a 15 é a dos objetivos 5 a 10 e dos bots seguindo a lista, V2E-T4; a 14, a das incursões de lobos e da política da Paliçada, V2E-T3;
 * a 13, a da Paliçada por erguer e das três cartas da promessa, V2E-T2; a 12, a da Torre de
 * Vigia e da Ameaça, V2E-T1; a 11, a do primeiro lote de cartas, V2D-T2; a 10, a do motor do
 * Conselho, V2D-T1; e a 9, a da Fase C).
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
    'week/3/preguicoso': measured([36, 38], 7, 0, 0, 4250, 4250, 7524, 63),
    'week/3/regular': measured([72, 76], 8, 0, 0, 5636, 6500, 152495, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5520, 6500, 323662, 15),
    'week/1/preguicoso': measured([31, 33], 5, 0, 0, 1435, 3056, 1165, 13),
    'week/1/regular': measured([62, 72], 7, 0, 0, 5029, 4985, 18058, 8),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 20225, 3),
    'week/0.5/preguicoso': measured([20, 20], 3, 0, 0, 1727, 2067, 30, 3),
    'week/0.5/regular': measured([50, 54], 6, 0, 0, 1008, 1125, 935, 0),
    'week/0.5/dedicado': measured([58, 65], 6, 0, 0, 1491, 1227, 1237, 1),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 363, 517, 202, 60),
    'year/3/regular': measured([27, 30], 5, 0, 0, 641, 1104, 3560, 6),
    'year/3/dedicado': measured([50, 55], 6, 0, 0, 1915, 3307, 13816, 9),
    'year/1/preguicoso': measured([31, 33], 5, 0, 0, 1435, 3056, 1165, 13),
    'year/1/regular': measured([62, 72], 7, 0, 0, 5029, 4985, 18058, 8),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 20225, 3),
    'year/0.5/preguicoso': measured([52, 56], 7, 0, 0, 1549, 685, 2004, 8),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6500, 6500, 21275, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 33840, 2.5),
  },
  lord: {
    'week/3/preguicoso': measured([36, 38], 7, 0, 0, 3400, 3400, 7497, 72),
    'week/3/regular': measured([72, 75], 8, 0, 0, 5200, 5200, 148487, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 4225, 5200, 324539, 15),
    'week/1/preguicoso': measured([31, 33], 5, 0, 0, 1136, 2647, 1139, 16),
    'week/1/regular': measured([64, 73], 7, 0, 0, 4512, 4637, 23641, 9),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 5200, 5200, 21575, 5),
    'week/0.5/preguicoso': measured([20, 20], 3, 0, 0, 1071, 1576, 30, 5.5),
    'week/0.5/regular': measured([50, 54], 6, 0, 0, 1037, 1254, 1044, 1),
    'week/0.5/dedicado': measured([60, 65], 6, 0, 0, 1781, 1173, 940, 1),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 194, 517, 304, 63),
    'year/3/regular': measured([27, 30], 5, 0, 0, 783, 1114, 3052, 9),
    'year/3/dedicado': measured([51, 55], 6, 0, 0, 1650, 2091, 12964, 15),
    'year/1/preguicoso': measured([31, 33], 5, 0, 0, 1136, 2647, 1139, 16),
    'year/1/regular': measured([64, 73], 7, 0, 0, 4512, 4637, 23641, 9),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 5200, 5200, 21575, 5),
    'year/0.5/preguicoso': measured([52, 56], 6, 0, 0, 4185, 1855, 3936, 7),
    'year/0.5/regular': measured([84, 84], 8, 0, 0, 5200, 5200, 22535, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 32471, 4),
  },
  ironKing: {
    'week/3/preguicoso': measured([36, 38], 7, 0, 0, 3200, 3200, 7536, 75),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2804, 3680, 165302, 24),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2837, 3680, 294121, 45),
    'week/1/preguicoso': measured([31, 34], 5, 0, 0, 1281, 2104, 1255, 18),
    'week/1/regular': measured([64, 71], 6, 0, 0, 3680, 3680, 19717, 5),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 43766, 3),
    'week/0.5/preguicoso': measured([20, 20], 3, 0, 0, 145, 940, 30, 11.5),
    'week/0.5/regular': measured([49, 54], 6, 0, 0, 1098, 887, 730, 1),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1709, 768, 763, 0),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 268, 529, 474, 66),
    'year/3/regular': measured([27, 30], 4, 0, 0, 588, 660, 6322, 6),
    'year/3/dedicado': measured([50, 55], 6, 0, 0, 1274, 1646, 14091, 18),
    'year/1/preguicoso': measured([31, 34], 5, 0, 0, 1281, 2104, 1255, 18),
    'year/1/regular': measured([64, 71], 6, 0, 0, 3680, 3680, 19717, 5),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 43766, 3),
    'year/0.5/preguicoso': measured([48, 53], 6, 0, 0, 3200, 1956, 5802, 11.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3672, 3680, 44215, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 53059, 3),
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
