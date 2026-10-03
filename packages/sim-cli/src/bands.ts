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
 * (seção 16: a Ameaça reequilibrada depois da revisão das Fases D e E, nas três dificuldades;
 * a seção 15 é a dos objetivos 5 a 10 e dos bots seguindo a lista, V2E-T4; a seção 14 é a
 * das incursões de lobos e da política da Paliçada, V2E-T3; a
 * seção 13 é a da Paliçada por erguer e das três cartas da promessa, V2E-T2, a
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
    'week/3/preguicoso': measured([33, 33], 6, 0, 0, 4125, 2897, 13529, 63),
    'week/3/regular': measured([69, 75], 8, 0, 0, 5625, 6375, 150895, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5780, 6375, 325156, 15),
    'week/1/preguicoso': measured([21, 25], 3, 0, 0, 2834, 3375, 754, 22),
    'week/1/regular': measured([63, 71], 7, 0, 0, 4912, 4851, 18951, 7),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 18991, 3),
    'week/0.5/preguicoso': measured([26, 26], 4, 0, 0, 415, 1355, 49, 4.5),
    'week/0.5/regular': measured([51, 54], 6, 0, 0, 1169, 995, 898, 0),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1401, 1180, 836, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 325, 495, 405, 60),
    'year/3/regular': measured([24, 30], 5, 0, 0, 916, 1300, 2638, 6),
    'year/3/dedicado': measured([52, 55], 6, 0, 0, 1971, 2582, 14803, 12),
    'year/1/preguicoso': measured([21, 25], 3, 0, 0, 2834, 3375, 754, 22),
    'year/1/regular': measured([63, 71], 7, 0, 0, 4912, 4851, 18951, 7),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 18991, 3),
    'year/0.5/preguicoso': measured([59, 60], 7, 0, 0, 478, 727, 3531, 7.5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 20275, 2.5),
    'year/0.5/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 30699, 2.5),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 6, 0, 0, 3900, 2387, 13474, 63),
    'week/3/regular': measured([69, 74], 7, 0, 0, 5100, 5100, 159306, 33),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4809, 5100, 285390, 48),
    'week/1/preguicoso': measured([21, 25], 3, 0, 0, 2586, 2700, 1078, 21),
    'week/1/regular': measured([63, 71], 7, 0, 0, 4548, 4543, 18103, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 38801, 4),
    'week/0.5/preguicoso': measured([26, 26], 4, 0, 0, 111, 980, 49, 6),
    'week/0.5/regular': measured([50, 54], 5, 0, 0, 2700, 1766, 973, 2),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1436, 811, 570, 1),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 194, 353, 428, 63),
    'year/3/regular': measured([24, 30], 5, 0, 0, 742, 1027, 2591, 9),
    'year/3/dedicado': measured([51, 55], 6, 0, 0, 2653, 1945, 13672, 18),
    'year/1/preguicoso': measured([21, 25], 3, 0, 0, 2586, 2700, 1078, 21),
    'year/1/regular': measured([63, 71], 7, 0, 0, 4548, 4543, 18103, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 38801, 4),
    'year/0.5/preguicoso': measured([59, 60], 7, 0, 0, 1168, 1424, 3962, 8.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 4382, 5100, 39626, 2.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5100, 5100, 47119, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 6, 0, 0, 3120, 1739, 13349, 135),
    'week/3/regular': measured([69, 75], 7, 0, 0, 3197, 3600, 165037, 24),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2712, 3600, 290691, 48),
    'week/1/preguicoso': measured([21, 25], 3, 0, 0, 1643, 2160, 1069, 23),
    'week/1/regular': measured([61, 70], 7, 0, 0, 3600, 3600, 18216, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3523, 3600, 43442, 3),
    'week/0.5/preguicoso': measured([26, 26], 4, 0, 0, 79, 1160, 49, 4.5),
    'week/0.5/regular': measured([51, 54], 6, 0, 0, 1262, 721, 800, 1.5),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1433, 800, 611, 0.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 138, 374, 377, 66),
    'year/3/regular': measured([24, 30], 4, 0, 0, 749, 503, 5493, 12),
    'year/3/dedicado': measured([50, 53], 6, 0, 0, 1217, 1728, 14708, 18),
    'year/1/preguicoso': measured([21, 25], 3, 0, 0, 1643, 2160, 1069, 23),
    'year/1/regular': measured([61, 70], 7, 0, 0, 3600, 3600, 18216, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3523, 3600, 43442, 3),
    'year/0.5/preguicoso': measured([59, 60], 6, 0, 0, 3600, 1614, 7852, 7.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3579, 3600, 44156, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 52223, 3),
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
