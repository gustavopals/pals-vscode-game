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
 * regra de `SLACK`. **A rodada de agora é a dos objetivos 11 a 16 (V3F-T2), em
 * docs/balance-v0.3.md, seção 15**: todo bot passou a erguer a Guilda dos Aventureiros quando o
 * objetivo 12 a aponta, e as recompensas mudam o caminho de obras. Mudaram 67 das 72 células;
 * a soma do ouro parado quase não mexeu (de −2,5% a +0,5%), e a maior piora é o Preguiçoso da
 * semana do Tranquilo, que termina com o Salão no nível 3. A anterior é a da revisão da Fase E
 * (V3E-T5), na seção 14: a caravana que paga 15% sobre o balcão (era 40%), o soldo
 * que cresce com o nível, o piso de três aldeões, a primeira alocação do Mestre sem adaptação,
 * a cobrança do atraso na volta e as marcas da Crônica a 85% e 115%. Mudaram 28 das 72 células
 * (9 em Camponês, 9 em Senhor e 10 em Rei de Ferro), todas do Regular, do Dedicado e do
 * Explorador, e quase todas só no ouro parado, que cai menos de 3%; nenhuma do Preguiçoso. A
 * anterior é a das caravanas (V3E-T2), na seção
 * 12: as células do Preguiçoso não mudaram em nenhuma dificuldade (ele não manda
 * caravanas), e, das outras 54, mudaram 42 (14 por dificuldade; as quatro que ficaram iguais em
 * cada uma são as do Regular e do Explorador na semana do Tranquilo e no ano do Rápido, onde
 * nenhuma caravana parte): o Regular, o Dedicado e o Explorador levam o Mercado ao nível das
 * caravanas quando há folga e mandam o excedente a Porto do Rio, com um herói ocioso de escolta
 * ou, sem herói, com a Torre de Vigia no nível 2. A anterior é a do Mercado (V3E-T1), na seção
 * 11: as dos três perfis que negociam mudaram todas (18 por dificuldade): eles erguem o Mercado
 * quando o Salão deixa, vendem o que iria ao chão, até
 * o volume do dia, e compram lenha quando a conta do inverno não fecha. A anterior é a da
 * revisão da Fase D (V3D-T5), na seção 9: só as células do Explorador mudaram (o catálogo recalibrado,
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
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 4250, 4250, 5738, 63),
    'week/3/regular': measured([84, 85], 8, 0, 0, 6311, 6448, 231621, 33),
    'week/3/dedicado': measured([85, 85], 8, 0, 0, 6357, 6466, 368559, 15),
    'week/3/explorador': measured([85, 85], 8, 0, 0, 5482, 6500, 293621, 33),
    'week/1/preguicoso': measured([31, 35], 5, 0, 0, 1408, 3027, 644, 23),
    'week/1/regular': measured([67, 75], 7, 0, 0, 5000, 4982, 27920, 8),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 6499, 6500, 16531, 4),
    'week/1/explorador': measured([70, 85], 7, 0, 0, 5000, 5000, 24203, 8),
    'week/0.5/preguicoso': measured([25, 27], 3, 0, 0, 1704, 2000, 167, 4.5),
    'week/0.5/regular': measured([44, 54], 5, 0, 0, 1198, 941, 1452, 1),
    'week/0.5/dedicado': measured([54, 56], 5, 0, 0, 1887, 1138, 1074, 0.5),
    'week/0.5/explorador': measured([44, 54], 5, 0, 0, 1270, 837, 1137, 1),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 363, 516, 150, 60),
    'year/3/regular': measured([22, 29], 5, 0, 0, 724, 1338, 2320, 6),
    'year/3/dedicado': measured([51, 64], 6, 0, 0, 1922, 2009, 14396, 9),
    'year/3/explorador': measured([22, 37], 5, 0, 0, 999, 1407, 1895, 6),
    'year/1/preguicoso': measured([31, 35], 5, 0, 0, 1408, 3027, 644, 23),
    'year/1/regular': measured([67, 75], 7, 0, 0, 5000, 4982, 27920, 8),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 6499, 6500, 16531, 4),
    'year/1/explorador': measured([70, 85], 7, 0, 0, 5000, 5000, 24203, 8),
    'year/0.5/preguicoso': measured([59, 62], 7, 0, 0, 1973, 1144, 5228, 8.5),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 6500, 6500, 19543, 3),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 6492, 6500, 31086, 1.5),
    'year/0.5/explorador': measured([83, 85], 8, 0, 0, 6500, 6500, 20959, 5.5),
  },
  lord: {
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 3400, 3400, 5694, 75),
    'week/3/regular': measured([75, 85], 8, 0, 0, 5200, 5138, 200244, 30),
    'week/3/dedicado': measured([85, 85], 8, 0, 0, 4823, 5188, 368996, 15),
    'week/3/explorador': measured([85, 85], 8, 0, 0, 4180, 5091, 280429, 30),
    'week/1/preguicoso': measured([31, 35], 5, 0, 0, 869, 2115, 647, 31),
    'week/1/regular': measured([65, 75], 7, 0, 0, 3981, 3930, 25973, 10),
    'week/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 14064, 5),
    'week/1/explorador': measured([66, 77], 7, 0, 0, 5200, 4781, 17863, 9),
    'week/0.5/preguicoso': measured([29, 29], 3, 0, 0, 1032, 1600, 278, 8),
    'week/0.5/regular': measured([44, 54], 5, 0, 0, 1278, 966, 1140, 1),
    'week/0.5/dedicado': measured([54, 56], 5, 0, 0, 2172, 1226, 1269, 1),
    'week/0.5/explorador': measured([44, 55], 5, 0, 0, 1162, 934, 911, 1.5),
    'year/3/preguicoso': measured([16, 16], 3, 0, 0, 177, 516, 253, 63),
    'year/3/regular': measured([22, 30], 5, 0, 0, 744, 1033, 2587, 6),
    'year/3/dedicado': measured([48, 64], 6, 0, 0, 1734, 2284, 15744, 12),
    'year/3/explorador': measured([23, 37], 5, 0, 0, 606, 1037, 2925, 6),
    'year/1/preguicoso': measured([31, 35], 5, 0, 0, 869, 2115, 647, 31),
    'year/1/regular': measured([65, 75], 7, 0, 0, 3981, 3930, 25973, 10),
    'year/1/dedicado': measured([84, 85], 8, 0, 0, 5200, 5200, 14064, 5),
    'year/1/explorador': measured([66, 77], 7, 0, 0, 5200, 4781, 17863, 9),
    'year/0.5/preguicoso': measured([64, 66], 7, 0, 0, 1899, 2092, 3963, 8),
    'year/0.5/regular': measured([84, 85], 8, 0, 0, 5200, 5200, 17935, 4.5),
    'year/0.5/dedicado': measured([84, 85], 8, 0, 0, 5198, 5200, 34281, 2.5),
    'year/0.5/explorador': measured([83, 85], 8, 0, 0, 5200, 5200, 23435, 5.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([41, 60], 7, 0, 0, 3200, 3200, 5757, 114),
    'week/3/regular': measured([75, 75], 7, 0, 0, 2780, 3657, 227996, 39),
    'week/3/dedicado': measured([75, 75], 7, 0, 0, 3352, 3675, 329842, 15),
    'week/3/explorador': measured([75, 75], 7, 0, 0, 2780, 3680, 278335, 48),
    'week/1/preguicoso': measured([28, 32], 4, 0, 0, 859, 1936, 1135, 26),
    'week/1/regular': measured([64, 74], 6, 0, 0, 3272, 3442, 21944, 9),
    'week/1/dedicado': measured([74, 75], 7, 0, 0, 3679, 3677, 41788, 3),
    'week/1/explorador': measured([64, 75], 6, 0, 0, 3680, 3680, 21400, 8),
    'week/0.5/preguicoso': measured([27, 27], 3, 0, 0, 1280, 1280, 102, 8.5),
    'week/0.5/regular': measured([44, 54], 5, 0, 0, 1025, 917, 1051, 1.5),
    'week/0.5/dedicado': measured([54, 55], 5, 0, 0, 1760, 1186, 1276, 1),
    'week/0.5/explorador': measured([44, 54], 5, 0, 0, 1214, 809, 1084, 1.5),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 268, 517, 426, 66),
    'year/3/regular': measured([27, 30], 4, 0, 0, 628, 806, 4258, 6),
    'year/3/dedicado': measured([48, 63], 6, 0, 0, 1544, 1780, 15301, 12),
    'year/3/explorador': measured([29, 39], 4, 0, 0, 631, 825, 5225, 6),
    'year/1/preguicoso': measured([28, 32], 4, 0, 0, 859, 1936, 1135, 26),
    'year/1/regular': measured([64, 74], 6, 0, 0, 3272, 3442, 21944, 9),
    'year/1/dedicado': measured([74, 75], 7, 0, 0, 3679, 3677, 41788, 3),
    'year/1/explorador': measured([64, 75], 6, 0, 0, 3680, 3680, 21400, 8),
    'year/0.5/preguicoso': measured([57, 61], 6, 0, 0, 3200, 1864, 7160, 8.5),
    'year/0.5/regular': measured([74, 75], 7, 0, 0, 3680, 3680, 42224, 2),
    'year/0.5/dedicado': measured([75, 75], 7, 0, 0, 3678, 3678, 56188, 1.5),
    'year/0.5/explorador': measured([74, 75], 7, 0, 0, 3680, 3680, 45490, 5.5),
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
