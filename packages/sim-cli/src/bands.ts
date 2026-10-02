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
 * (seção 11: a rodada com o primeiro lote de cartas, V2D-T2, nas três dificuldades; a seção 10
 * é a do motor do Conselho, V2D-T1, e a 9, a da Fase C).
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
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4668, 72),
    'week/3/regular': measured([72, 75], 8, 0, 0, 6375, 6375, 148046, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5638, 6375, 322140, 15),
    'week/1/preguicoso': measured([30, 33], 6, 0, 0, 1175, 589, 1750, 9),
    'week/1/regular': measured([64, 71], 7, 0, 0, 5054, 4886, 18782, 6),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 23455, 3),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 215, 183, 238, 1),
    'week/0.5/regular': measured([54, 59], 6, 0, 0, 1687, 1303, 842, 1.5),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 2255, 1558, 1516, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 660, 161, 72),
    'year/3/regular': measured([27, 29], 5, 0, 0, 1543, 1650, 2403, 18),
    'year/3/dedicado': measured([48, 55], 7, 0, 0, 1916, 3015, 5923, 6),
    'year/1/preguicoso': measured([30, 33], 6, 0, 0, 1175, 589, 1750, 9),
    'year/1/regular': measured([64, 71], 7, 0, 0, 5054, 4886, 18782, 6),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 6375, 6375, 23455, 3),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 695, 1758, 1003, 1),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6375, 6375, 25589, 3.5),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6375, 6375, 36126, 2),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4662, 75),
    'week/3/regular': measured([72, 74], 7, 0, 0, 5100, 5100, 165682, 30),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 4883, 5100, 284783, 21),
    'week/1/preguicoso': measured([30, 33], 6, 0, 0, 1242, 720, 1645, 11),
    'week/1/regular': measured([64, 72], 7, 0, 0, 5071, 5009, 23001, 10),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 5098, 5100, 39797, 3),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 74, 190, 232, 4),
    'week/0.5/regular': measured([51, 54], 5, 0, 0, 2700, 1743, 1101, 2),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1750, 974, 948, 1),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 532, 160, 75),
    'year/3/regular': measured([27, 29], 5, 0, 0, 784, 1332, 2851, 24),
    'year/3/dedicado': measured([52, 54], 6, 0, 0, 1705, 2022, 16562, 18),
    'year/1/preguicoso': measured([30, 33], 6, 0, 0, 1242, 720, 1645, 11),
    'year/1/regular': measured([64, 72], 7, 0, 0, 5071, 5009, 23001, 10),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 5098, 5100, 39797, 3),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1033, 1281, 978, 4),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 5075, 5100, 41627, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 5096, 5100, 50117, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4612, 72),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2736, 3590, 168623, 30),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2736, 3600, 295750, 48),
    'week/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 936, 1677, 12),
    'week/1/regular': measured([64, 70], 7, 0, 0, 3600, 3557, 18939, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 44281, 3),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 333, 266, 227, 4.5),
    'week/0.5/regular': measured([53, 54], 6, 0, 0, 1046, 1007, 945, 1),
    'week/0.5/dedicado': measured([58, 64], 6, 0, 0, 1862, 833, 554, 1.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 497, 160, 72),
    'year/3/regular': measured([27, 29], 5, 0, 0, 421, 941, 1058, 30),
    'year/3/dedicado': measured([46, 54], 6, 0, 0, 2560, 1808, 13323, 18),
    'year/1/preguicoso': measured([30, 33], 5, 0, 0, 1680, 936, 1677, 12),
    'year/1/regular': measured([64, 70], 7, 0, 0, 3600, 3557, 18939, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 44281, 3),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 880, 777, 959, 5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3599, 3600, 45910, 2.5),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3600, 3600, 53438, 3),
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
