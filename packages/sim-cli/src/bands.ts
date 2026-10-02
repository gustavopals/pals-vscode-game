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
 * (seção 10: a rodada com o Conselho do Feudo, V2D-T1, nas três dificuldades; a seção 9 é a da
 * Fase C, a anterior).
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
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4664, 72),
    'week/3/regular': measured([72, 72], 8, 0, 0, 5511, 6110, 127744, 30),
    'week/3/dedicado': measured([84, 84], 8, 0, 0, 5299, 6153, 304872, 6),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 585, 1749, 6),
    'week/1/regular': measured([68, 68], 7, 0, 0, 2902, 4114, 9515, 4),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 5216, 5906, 18504, 0),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 209, 180, 236, 1),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 1061, 459, 644, 0),
    'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 360, 428, 528, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 658, 161, 72),
    'year/3/regular': measured([27, 27], 5, 0, 0, 1427, 1154, 1184, 12),
    'year/3/dedicado': measured([50, 50], 7, 0, 0, 1233, 866, 1821, 3),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 585, 1749, 6),
    'year/1/regular': measured([68, 68], 7, 0, 0, 2902, 4114, 9515, 4),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 5216, 5906, 18504, 0),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 536, 686, 1001, 1),
    'year/0.5/regular': measured([84, 84], 8, 0, 0, 6330, 6375, 18504, 0.5),
    'year/0.5/dedicado': measured([84, 84], 8, 0, 0, 5590, 5838, 27638, 0),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4657, 75),
    'week/3/regular': measured([72, 72], 7, 0, 0, 4236, 5100, 156656, 18),
    'week/3/dedicado': measured([74, 74], 7, 0, 0, 4212, 5027, 276913, 3),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 711, 1637, 6),
    'week/1/regular': measured([69, 69], 7, 0, 0, 3739, 3662, 8707, 1),
    'week/1/dedicado': measured([74, 74], 7, 0, 0, 4180, 5014, 33588, 1),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 68, 187, 230, 3.5),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 588, 1725, 1156, 0.5),
    'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 237, 50, 153, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 530, 160, 75),
    'year/3/regular': measured([27, 27], 5, 0, 0, 622, 1197, 2364, 18),
    'year/3/dedicado': measured([52, 52], 6, 0, 0, 886, 1426, 11895, 3),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 711, 1637, 6),
    'year/1/regular': measured([69, 69], 7, 0, 0, 3739, 3662, 8707, 1),
    'year/1/dedicado': measured([74, 74], 7, 0, 0, 4180, 5014, 33588, 1),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1027, 1278, 976, 3.5),
    'year/0.5/regular': measured([74, 74], 7, 0, 0, 4092, 5078, 39445, 1.5),
    'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 3094, 3737, 43689, 1),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4607, 72),
    'week/3/regular': measured([72, 72], 7, 0, 0, 2048, 3380, 157140, 24),
    'week/3/dedicado': measured([74, 74], 7, 0, 0, 2628, 3600, 281676, 12),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 355, 395, 1591, 9),
    'week/1/regular': measured([64, 64], 7, 0, 0, 802, 1229, 17011, 9),
    'week/1/dedicado': measured([74, 74], 7, 0, 0, 2671, 3565, 39467, 0),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 327, 263, 226, 4.5),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 508, 517, 464, 0),
    'week/0.5/dedicado': measured([57, 57], 6, 0, 0, 618, 575, 148, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 495, 160, 72),
    'year/3/regular': measured([27, 27], 5, 0, 0, 131, 635, 1052, 24),
    'year/3/dedicado': measured([51, 51], 6, 0, 0, 498, 109, 11210, 12),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 355, 395, 1591, 9),
    'year/1/regular': measured([64, 64], 7, 0, 0, 802, 1229, 17011, 9),
    'year/1/dedicado': measured([74, 74], 7, 0, 0, 2671, 3565, 39467, 0),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 880, 774, 957, 5),
    'year/0.5/regular': measured([74, 74], 7, 0, 0, 2303, 3268, 42953, 0),
    'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 109, 2155, 49130, 0),
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
