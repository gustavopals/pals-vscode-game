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
 * (seção 9: a rodada de balanceamento da Fase C, V2C-T7, com as três dificuldades).
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
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 4125, 4125, 4666, 72),
    'week/3/regular': measured([72, 72], 8, 0, 0, 5511, 6111, 127764, 30),
    'week/3/dedicado': measured([84, 84], 8, 0, 0, 5316, 6168, 304802, 6),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 587, 1749, 6),
    'week/1/regular': measured([68, 68], 7, 0, 0, 4018, 2125, 12251, 0),
    'week/1/dedicado': measured([84, 84], 8, 0, 0, 5221, 5908, 18505, 0),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 211, 181, 237, 1),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 1065, 460, 271, 0),
    'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 327, 452, 537, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 994, 659, 161, 72),
    'year/3/regular': measured([27, 27], 5, 0, 0, 1429, 1155, 1185, 12),
    'year/3/dedicado': measured([50, 50], 7, 0, 0, 574, 80, 1239, 3),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 729, 587, 1749, 6),
    'year/1/regular': measured([68, 68], 7, 0, 0, 4018, 2125, 12251, 0),
    'year/1/dedicado': measured([84, 84], 8, 0, 0, 5221, 5908, 18505, 0),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 691, 1756, 1001, 1),
    'year/0.5/regular': measured([84, 84], 8, 0, 0, 6347, 6298, 17012, 0),
    'year/0.5/dedicado': measured([84, 84], 8, 0, 0, 5583, 5811, 27646, 0.5),
  },
  lord: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3900, 3900, 4660, 75),
    'week/3/regular': measured([72, 72], 7, 0, 0, 4236, 5100, 156690, 18),
    'week/3/dedicado': measured([74, 74], 7, 0, 0, 4212, 5020, 276963, 3),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 713, 1637, 6),
    'week/1/regular': measured([69, 69], 7, 0, 0, 3741, 3663, 8708, 1),
    'week/1/dedicado': measured([74, 74], 7, 0, 0, 4097, 5039, 33685, 1),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 70, 188, 231, 3.5),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 589, 1726, 1156, 0.5),
    'week/0.5/dedicado': measured([62, 62], 6, 0, 0, 230, 56, 152, 0.5),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 513, 531, 160, 75),
    'year/3/regular': measured([27, 27], 5, 0, 0, 624, 1198, 2364, 18),
    'year/3/dedicado': measured([52, 52], 6, 0, 0, 889, 1427, 11896, 3),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 692, 713, 1637, 6),
    'year/1/regular': measured([69, 69], 7, 0, 0, 3741, 3663, 8708, 1),
    'year/1/dedicado': measured([74, 74], 7, 0, 0, 4097, 5039, 33685, 1),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 1029, 1279, 977, 3.5),
    'year/0.5/regular': measured([74, 74], 7, 0, 0, 4063, 5050, 39449, 2),
    'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 3108, 3709, 43687, 1),
  },
  ironKing: {
    'week/3/preguicoso': measured([33, 33], 7, 0, 0, 3120, 3120, 4610, 72),
    'week/3/regular': measured([72, 72], 7, 0, 0, 2048, 3380, 157176, 24),
    'week/3/dedicado': measured([74, 74], 7, 0, 0, 2499, 3573, 280419, 12),
    'week/1/preguicoso': measured([33, 33], 6, 0, 0, 356, 395, 1591, 9),
    'week/1/regular': measured([64, 64], 7, 0, 0, 638, 338, 16836, 0),
    'week/1/dedicado': measured([74, 74], 7, 0, 0, 2675, 3566, 39467, 0),
    'week/0.5/preguicoso': measured([14, 14], 4, 0, 0, 329, 264, 226, 4.5),
    'week/0.5/regular': measured([54, 54], 6, 0, 0, 512, 519, 465, 0),
    'week/0.5/dedicado': measured([57, 57], 6, 0, 0, 621, 577, 149, 0),
    'year/3/preguicoso': measured([13, 13], 3, 0, 0, 333, 496, 160, 72),
    'year/3/regular': measured([27, 27], 5, 0, 0, 133, 636, 1053, 24),
    'year/3/dedicado': measured([51, 51], 6, 0, 0, 474, 80, 11142, 12),
    'year/1/preguicoso': measured([33, 33], 6, 0, 0, 356, 395, 1591, 9),
    'year/1/regular': measured([64, 64], 7, 0, 0, 638, 338, 16836, 0),
    'year/1/dedicado': measured([74, 74], 7, 0, 0, 2675, 3566, 39467, 0),
    'year/0.5/preguicoso': measured([23, 23], 6, 0, 0, 880, 775, 957, 5),
    'year/0.5/regular': measured([74, 74], 7, 0, 0, 2592, 3269, 42720, 0),
    'year/0.5/dedicado': measured([74, 74], 7, 0, 0, 113, 2157, 49131, 0),
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
