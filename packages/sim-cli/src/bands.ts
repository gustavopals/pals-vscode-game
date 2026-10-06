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
 * regra de `SLACK`. **A rodada de agora é a da revisão da Fase D (V3D-T5), em
 * docs/balance-v0.3.md, seção 9**: só as células do Explorador mudaram (o catálogo recalibrado,
 * a Patrulha que rende pouco, os bônus de item que somam, o bot que ergue a Guilda na frente
 * das outras obras e, em metade das sementes, a visita extra de quem atende o aviso da
 * encruzilhada); as dos outros perfis são as da Taverna, linha a linha. A anterior é a do
 * catálogo de expedições (V3D-T3), na seção 8 (os dezoito grafos de verdade, com encruzilhada
 * em quase todos, e o bot que envia a expedição de maior recompensa que a equipe passa com
 * folga e deixa metade das encruzilhadas para a Postura). Antes dela, a dos desfechos (V3D-T2), na
 * seção 7 (o Explorador passou a melhorar a Guilda, a ir ao Covil de Lobos e a equipar itens;
 * e o Covil limpo mexe na Ameaça), e antes dela a do motor das
 * expedições (V3D-T1), na seção 6, e antes dela a da Taverna (V3C-T2), em docs/balance-v0.3.md, seção
 * 4, com o antes e o depois de cada célula e o que piorou: todo bot passou a erguer a Taverna
 * (ela soma moral, e a moral traz colonos; as obras dela disputam a fila com o Salão), e entrou
 * a célula do perfil Explorador, que contrata e dá festival. A rodada anterior da v0.3 é a da
 * carta "Estrangeira ferida" e do primeiro soldo (V3C-T3), na seção 3. As da v0.2 estão em docs/balance-v0.2.md
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
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 4250, 4250, 5954, 63),
    'week/3/regular': measured([84, 85], 8, 0, 0, 6500, 6500, 229537, 33),
    'week/3/dedicado': measured([85, 85], 8, 0, 0, 5752, 6500, 378434, 30),
    'week/3/explorador': measured([85, 85], 8, 0, 0, 6224, 6500, 296541, 33),
    'week/1/preguicoso': measured([31, 35], 5, 0, 0, 1273, 2825, 262, 18),
    'week/1/regular': measured([65, 77], 7, 0, 0, 4999, 5740, 23083, 8),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 21901, 4),
    'week/1/explorador': measured([64, 80], 7, 0, 0, 5094, 5000, 24367, 9),
    'week/0.5/preguicoso': measured([25, 27], 3, 0, 0, 1704, 2000, 167, 4.5),
    'week/0.5/regular': measured([45, 54], 5, 0, 0, 1555, 989, 1283, 1),
    'week/0.5/dedicado': measured([54, 60], 6, 0, 0, 1032, 742, 838, 0.5),
    'week/0.5/explorador': measured([45, 55], 5, 0, 0, 1168, 1005, 1025, 1.5),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 363, 516, 150, 60),
    'year/3/regular': measured([22, 29], 5, 0, 0, 781, 1076, 2836, 3),
    'year/3/dedicado': measured([53, 64], 6, 0, 0, 1905, 3616, 14831, 9),
    'year/3/explorador': measured([22, 37], 5, 0, 0, 1167, 1407, 1895, 3),
    'year/1/preguicoso': measured([31, 35], 5, 0, 0, 1273, 2825, 262, 18),
    'year/1/regular': measured([65, 77], 7, 0, 0, 4999, 5740, 23083, 8),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6500, 6500, 21901, 4),
    'year/1/explorador': measured([64, 80], 7, 0, 0, 5094, 5000, 24367, 9),
    'year/0.5/preguicoso': measured([60, 62], 7, 0, 0, 1149, 1233, 5517, 8.5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6500, 6500, 19800, 4),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6499, 6500, 35524, 2),
    'year/0.5/explorador': measured([84, 85], 8, 0, 0, 6500, 6500, 23119, 5),
  },
  lord: {
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 3400, 3400, 5918, 75),
    'week/3/regular': measured([75, 85], 7, 0, 0, 3889, 5200, 211754, 36),
    'week/3/dedicado': measured([85, 85], 8, 0, 0, 4225, 5200, 366691, 42),
    'week/3/explorador': measured([85, 85], 8, 0, 0, 4420, 5200, 286522, 39),
    'week/1/preguicoso': measured([31, 35], 5, 0, 0, 1068, 2270, 268, 28),
    'week/1/regular': measured([64, 75], 7, 0, 0, 4036, 4541, 23840, 10),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 19802, 3),
    'week/1/explorador': measured([66, 77], 7, 0, 0, 5200, 5200, 19874, 9),
    'week/0.5/preguicoso': measured([29, 29], 4, 0, 0, 116, 1225, 154, 8),
    'week/0.5/regular': measured([45, 54], 5, 0, 0, 1641, 1133, 1233, 1.5),
    'week/0.5/dedicado': measured([54, 59], 6, 0, 0, 1075, 694, 745, 1),
    'week/0.5/explorador': measured([45, 54], 5, 0, 0, 794, 897, 1219, 1.5),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 177, 516, 253, 63),
    'year/3/regular': measured([27, 30], 5, 0, 0, 778, 805, 3000, 9),
    'year/3/dedicado': measured([51, 63], 6, 0, 0, 1770, 2006, 13499, 18),
    'year/3/explorador': measured([23, 37], 5, 0, 0, 722, 1011, 3075, 3),
    'year/1/preguicoso': measured([31, 35], 5, 0, 0, 1068, 2270, 268, 28),
    'year/1/regular': measured([64, 75], 7, 0, 0, 4036, 4541, 23840, 10),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 19802, 3),
    'year/1/explorador': measured([66, 77], 7, 0, 0, 5200, 5200, 19874, 9),
    'year/0.5/preguicoso': measured([59, 66], 6, 0, 0, 4600, 2278, 10670, 8),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 5200, 5200, 20021, 5.5),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 32859, 5.5),
    'year/0.5/explorador': measured([84, 85], 8, 0, 0, 5200, 5200, 20652, 5.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 3200, 3200, 5951, 114),
    'week/3/regular': measured([75, 75], 7, 0, 0, 2780, 3680, 228153, 72),
    'week/3/dedicado': measured([75, 75], 7, 0, 0, 3423, 3680, 332386, 33),
    'week/3/explorador': measured([75, 75], 7, 0, 0, 3042, 3680, 277021, 63),
    'week/1/preguicoso': measured([28, 32], 4, 0, 0, 677, 1845, 1384, 21),
    'week/1/regular': measured([64, 73], 7, 0, 0, 3680, 2782, 22940, 9),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3672, 3680, 44570, 3),
    'week/1/explorador': measured([65, 75], 7, 0, 0, 3680, 3680, 23824, 9),
    'week/0.5/preguicoso': measured([27, 27], 3, 0, 0, 1280, 1280, 102, 8.5),
    'week/0.5/regular': measured([44, 54], 5, 0, 0, 1052, 925, 1033, 3),
    'week/0.5/dedicado': measured([54, 59], 5, 0, 0, 2625, 1011, 1335, 0),
    'week/0.5/explorador': measured([44, 55], 5, 0, 0, 1397, 793, 1026, 1),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 268, 517, 426, 66),
    'year/3/regular': measured([27, 30], 5, 0, 0, 632, 589, 2753, 6),
    'year/3/dedicado': measured([52, 61], 6, 0, 0, 1571, 1795, 16222, 12),
    'year/3/explorador': measured([29, 39], 5, 0, 0, 649, 904, 2693, 6),
    'year/1/preguicoso': measured([28, 32], 4, 0, 0, 677, 1845, 1384, 21),
    'year/1/regular': measured([64, 73], 7, 0, 0, 3680, 2782, 22940, 9),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3672, 3680, 44570, 3),
    'year/1/explorador': measured([65, 75], 7, 0, 0, 3680, 3680, 23824, 9),
    'year/0.5/preguicoso': measured([62, 64], 6, 0, 0, 1220, 470, 6456, 8.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3680, 3680, 43982, 3),
    'year/0.5/dedicado': measured([75, 75], 7, 0, 0, 3647, 3680, 55609, 2.5),
    'year/0.5/explorador': measured([74, 75], 7, 0, 0, 3680, 3680, 45031, 3),
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
