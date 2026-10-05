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
export type Baseline = {
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
 * regra de `SLACK`. **A rodada de agora é a da carta "Estrangeira ferida" e do primeiro soldo
 * (V3C-T3), em docs/balance-v0.3.md, seção 3**, com o antes e o depois de cada célula e o que
 * piorou: todo feudo passou a ter um herói com soldo, e a carta ocupa uma audiência do Conselho,
 * o que muda o sorteio de toda semente. As rodadas anteriores estão em docs/balance-v0.2.md
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
 * atualiza esta tabela e registra a rodada (na v0.3, em docs/balance-v0.3.md), como se faz com
 * um golden.
 * Quando uma faixa falha sem que a mudança fosse a intenção, o ajuste é nos números de
 * `@lotg/content`, nunca no bot.
 */
// Colunas: população (menor e maior), Salão, horas de fome, horas de frio, madeira, pedra e ouro
// parados, e a maior sequência desperdiçando um recurso, em horas de jogo.
const MEASURED: Record<DifficultyId, Partial<Record<CellKey, Baseline>>> = {
  peasant: {
    'week/3/preguicoso': measured([36, 39], 7, 0, 0, 4250, 4250, 6804, 63),
    'week/3/regular': measured([72, 76], 8, 0, 0, 5634, 6500, 150960, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 6052, 6500, 320468, 15),
    'week/1/preguicoso': measured([31, 34], 5, 0, 0, 1922, 3098, 961, 13),
    'week/1/regular': measured([61, 72], 7, 0, 0, 5026, 4990, 19614, 7),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 20127, 4),
    'week/0.5/preguicoso': measured([25, 27], 3, 0, 0, 1861, 2000, 283, 4.5),
    'week/0.5/regular': measured([50, 54], 6, 0, 0, 1029, 1038, 1104, 1),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 1406, 1201, 1101, 0.5),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 363, 516, 154, 60),
    'year/3/regular': measured([27, 30], 5, 0, 0, 578, 1112, 3392, 6),
    'year/3/dedicado': measured([52, 55], 6, 0, 0, 2011, 2585, 14378, 12),
    'year/1/preguicoso': measured([31, 34], 5, 0, 0, 1922, 3098, 961, 13),
    'year/1/regular': measured([61, 72], 7, 0, 0, 5026, 4990, 19614, 7),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 20127, 4),
    'year/0.5/preguicoso': measured([60, 62], 7, 0, 0, 2281, 827, 6250, 5.5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6500, 6500, 20062, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 33509, 2),
  },
  lord: {
    'week/3/preguicoso': measured([36, 39], 7, 0, 0, 3400, 3400, 6778, 75),
    'week/3/regular': measured([72, 76], 8, 0, 0, 4324, 5200, 150285, 33),
    'week/3/dedicado': measured([84, 85], 8, 0, 0, 5013, 5200, 319751, 18),
    'week/1/preguicoso': measured([31, 34], 5, 0, 0, 1799, 2640, 982, 16),
    'week/1/regular': measured([64, 73], 7, 0, 0, 4600, 4592, 19777, 8),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 18559, 4),
    'week/0.5/preguicoso': measured([29, 29], 4, 0, 0, 339, 1599, 99, 8),
    'week/0.5/regular': measured([50, 54], 6, 0, 0, 1492, 987, 1104, 1.5),
    'week/0.5/dedicado': measured([56, 64], 6, 0, 0, 1884, 829, 897, 0.5),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 194, 516, 256, 63),
    'year/3/regular': measured([27, 30], 5, 0, 0, 772, 930, 2979, 6),
    'year/3/dedicado': measured([51, 56], 6, 0, 0, 2793, 2049, 12515, 18),
    'year/1/preguicoso': measured([31, 34], 5, 0, 0, 1799, 2640, 982, 16),
    'year/1/regular': measured([64, 73], 7, 0, 0, 4600, 4592, 19777, 8),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 18559, 4),
    'year/0.5/preguicoso': measured([62, 63], 7, 0, 0, 1293, 221, 4634, 8),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 5200, 5200, 21490, 3),
    'year/0.5/dedicado': measured([84, 84], 8, 0, 0, 5188, 5200, 31643, 3),
  },
  ironKing: {
    'week/3/preguicoso': measured([36, 38], 7, 0, 0, 3200, 3200, 6816, 75),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2804, 3674, 165720, 24),
    'week/3/dedicado': measured([74, 75], 7, 0, 0, 2792, 3680, 290931, 36),
    'week/1/preguicoso': measured([31, 34], 5, 0, 0, 1760, 2124, 1025, 19),
    'week/1/regular': measured([59, 72], 6, 0, 0, 3662, 3680, 19471, 8),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 43599, 3),
    'week/0.5/preguicoso': measured([29, 29], 4, 0, 0, 142, 1253, 84, 8.5),
    'week/0.5/regular': measured([49, 54], 5, 0, 0, 1680, 1046, 1113, 1),
    'week/0.5/dedicado': measured([57, 64], 6, 0, 0, 1440, 766, 588, 1),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 268, 517, 426, 66),
    'year/3/regular': measured([27, 30], 4, 0, 0, 588, 602, 6215, 6),
    'year/3/dedicado': measured([48, 55], 6, 0, 0, 1569, 1650, 14072, 18),
    'year/1/preguicoso': measured([31, 34], 5, 0, 0, 1760, 2124, 1025, 19),
    'year/1/regular': measured([59, 72], 6, 0, 0, 3662, 3680, 19471, 8),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 43599, 3),
    'year/0.5/preguicoso': measured([59, 62], 7, 0, 0, 1691, 1345, 4587, 8.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3680, 3680, 43597, 3),
    'year/0.5/dedicado': measured([74, 75], 7, 0, 0, 3680, 3680, 52092, 2),
  },
};

/**
 * A linha de base de uma célula, como está em `MEASURED`; `null` se a célula não foi medida.
 * Serve ao teste que confere que uma tarefa que não era para mexer na economia não mexeu: a
 * faixa tem folga, a linha de base não.
 */
export function baselineFor(key: CellKey, difficulty: DifficultyId = 'lord'): Baseline | null {
  return MEASURED[difficulty][key] ?? null;
}

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
