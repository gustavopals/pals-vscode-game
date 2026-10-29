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
 * regra de `SLACK`. **A rodada atual é a Segunda junção (2026-10-29), em
 * docs/balance-v0.4.md, seção 19**: treze cartas adicionais do lote 2, fatores de preço a
 * partir da próxima virada, encontros de heróis e sabotagem da Fortaleza, sobre a junção
 * da seção 16 (Fortaleza sem Ameaça, Vigília e objetivos 17 a 21). Nenhuma folga foi ampliada.
 * Histórico: na resposta do autor à D-39 (2026-10-26), seção 10, as incursões dos dias 25 e 37 são leves
 * e não ferem ninguém (a do 61º fica como estava). Mudaram as 72 células; fome e frio seguem em
 * zero, e o Preguiçoso do Rápido volta perto da rodada da seção 8. A anterior é a das incursões
 * que viram batalha (V4E-T2), em docs/balance-v0.4.md, seção 9: toda incursão luta contra a Defesa ativa e a muralha, o roteiro
 * da guerra traz três incursões no ano 1 (dias 25, 37 e 61), o sorteio do fluxo `horde` mudou, e
 * o econômico e o preguiçoso passaram a manter uma Defesa ativa (decisão 25). Mudaram as 72
 * células; fome e frio seguem em zero, e a maior piora é o Preguiçoso do Rápido (pendência D-39).
 * A anterior é a da Muralha, da Torre e da Paliçada acima do nível 2 e
 * das oito cartas novas do lote 2 (V4E-T1), em docs/balance-v0.4.md, seção 8: as cartas mudam o
 * sorteio de toda semente, e as obras novas disputam a fila e o ouro. A anterior é a da política
 * mínima de guerra (V4C-T1.8), em docs/balance-v0.4.md, seção 5.1: o Quartel e o treino de Lanceiros e Arqueiros entraram no
 * econômico e no preguiçoso, o soldado sai da população e as faixas de população desceram
 * (64 das 72 células mudaram; fome e frio seguem em zero). A anterior é a dos objetivos 11 a 16 (V3F-T2), em
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
// Segunda junção (2026-10-29): 13 cartas adicionais do lote 2, market.effects a partir da
// próxima virada e sabotagem; 50 sementes por célula nas três dificuldades. A medição, as
// violações anteriores e os limites estão em docs/balance-v0.4.md, seção "Segunda junção".
const MEASURED: Record<DifficultyId, Partial<Record<CellKey, Baseline>>> = {
  peasant: {
    'week/3/preguicoso': measured([36, 51], 5, 0, 0, 4250, 4250, 17467, 63),
    'week/3/regular': measured([76, 85], 8, 0, 0, 5898, 6480, 122096, 33),
    'week/3/dedicado': measured([81, 85], 8, 0, 0, 6500, 6494, 288977, 27),
    'week/3/explorador': measured([78, 85], 8, 0, 0, 6024, 6461, 196155, 30),
    'week/1/preguicoso': measured([31, 35], 4, 0, 0, 765, 3265, 3300, 32),
    'week/1/regular': measured([55, 70], 6, 0, 0, 4426, 2508, 17444, 6),
    'week/1/dedicado': measured([59, 72], 7, 0, 0, 5309, 3356, 17078, 2),
    'week/1/explorador': measured([56, 71], 6, 0, 0, 3710, 2839, 14305, 4),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1496, 2000, 278, 5),
    'week/0.5/regular': measured([39, 54], 5, 0, 0, 1172, 904, 1069, 1),
    'week/0.5/dedicado': measured([45, 54], 5, 0, 0, 1880, 1165, 1279, 0),
    'week/0.5/explorador': measured([37, 54], 5, 0, 0, 1156, 939, 938, 1),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 1044, 853, 149, 51),
    'year/3/regular': measured([26, 29], 4, 0, 0, 669, 1453, 1741, 18),
    'year/3/dedicado': measured([39, 61], 5, 0, 0, 4250, 1979, 5947, 12),
    'year/3/explorador': measured([23, 36], 4, 0, 0, 1264, 1849, 2017, 15),
    'year/1/preguicoso': measured([31, 35], 4, 0, 0, 765, 3265, 3300, 32),
    'year/1/regular': measured([55, 70], 6, 0, 0, 4426, 2508, 17444, 6),
    'year/1/dedicado': measured([59, 72], 7, 0, 0, 5309, 3356, 17078, 2),
    'year/1/explorador': measured([56, 71], 6, 0, 0, 3710, 2839, 14305, 4),
    'year/0.5/preguicoso': measured([53, 63], 6, 0, 0, 5750, 2513, 7508, 5),
    'year/0.5/regular': measured([63, 72], 7, 0, 0, 4815, 3671, 18032, 3),
    'year/0.5/dedicado': measured([64, 74], 7, 0, 0, 2973, 2576, 18008, 0),
    'year/0.5/explorador': measured([55, 73], 7, 0, 0, 4971, 3601, 17912, 2.5),
  },
  lord: {
    'week/3/preguicoso': measured([36, 51], 5, 0, 0, 3400, 3400, 17343, 66),
    'week/3/regular': measured([71, 84], 7, 0, 0, 5200, 5180, 105123, 33),
    'week/3/dedicado': measured([81, 85], 8, 0, 0, 5200, 5173, 297416, 21),
    'week/3/explorador': measured([71, 85], 7, 0, 0, 4924, 5200, 161543, 33),
    'week/1/preguicoso': measured([31, 35], 4, 0, 0, 736, 2435, 1359, 30),
    'week/1/regular': measured([56, 68], 6, 0, 0, 4000, 2587, 15691, 7),
    'week/1/dedicado': measured([58, 72], 6, 0, 0, 3416, 2768, 18178, 2),
    'week/1/explorador': measured([55, 68], 6, 0, 0, 3498, 2505, 14514, 6),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1306, 1600, 265, 8),
    'week/0.5/regular': measured([38, 54], 5, 0, 0, 1172, 993, 1028, 3),
    'week/0.5/dedicado': measured([45, 53], 5, 0, 0, 1874, 1027, 1292, 1),
    'week/0.5/explorador': measured([37, 54], 5, 0, 0, 1406, 971, 776, 1.5),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 864, 851, 250, 54),
    'year/3/regular': measured([25, 30], 4, 0, 0, 553, 792, 2074, 6),
    'year/3/dedicado': measured([41, 58], 6, 0, 0, 3138, 1743, 5976, 15),
    'year/3/explorador': measured([26, 35], 4, 0, 0, 871, 1180, 2423, 6),
    'year/1/preguicoso': measured([31, 35], 4, 0, 0, 736, 2435, 1359, 30),
    'year/1/regular': measured([56, 68], 6, 0, 0, 4000, 2587, 15691, 7),
    'year/1/dedicado': measured([58, 72], 6, 0, 0, 3416, 2768, 18178, 2),
    'year/1/explorador': measured([55, 68], 6, 0, 0, 3498, 2505, 14514, 6),
    'year/0.5/preguicoso': measured([50, 59], 6, 0, 0, 4000, 2016, 7890, 8),
    'year/0.5/regular': measured([60, 72], 6, 0, 0, 3988, 2537, 17815, 3),
    'year/0.5/dedicado': measured([62, 74], 7, 0, 0, 3596, 2562, 17739, 1),
    'year/0.5/explorador': measured([54, 72], 6, 0, 0, 4677, 3058, 17386, 2.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([36, 53], 6, 0, 0, 3200, 3200, 16882, 69),
    'week/3/regular': measured([72, 75], 7, 0, 0, 2917, 3637, 119430, 33),
    'week/3/dedicado': measured([71, 75], 7, 0, 0, 3680, 3679, 245803, 15),
    'week/3/explorador': measured([68, 75], 7, 0, 0, 3680, 3680, 183529, 39),
    'week/1/preguicoso': measured([31, 34], 3, 0, 0, 1237, 1939, 3968, 36),
    'week/1/regular': measured([57, 65], 6, 0, 0, 2862, 2887, 16875, 6),
    'week/1/dedicado': measured([58, 71], 6, 0, 0, 2807, 2785, 17890, 3),
    'week/1/explorador': measured([47, 67], 5, 0, 0, 3199, 2517, 16473, 5),
    'week/0.5/preguicoso': measured([28, 28], 3, 0, 0, 1122, 1280, 266, 8.5),
    'week/0.5/regular': measured([37, 52], 5, 0, 0, 1166, 803, 1157, 2),
    'week/0.5/dedicado': measured([40, 55], 5, 0, 0, 1480, 1040, 1193, 0),
    'week/0.5/explorador': measured([36, 52], 5, 0, 0, 876, 890, 1088, 2),
    'year/3/preguicoso': measured([16, 16], 2, 0, 0, 489, 721, 428, 60),
    'year/3/regular': measured([27, 30], 4, 0, 0, 1280, 695, 3146, 6),
    'year/3/dedicado': measured([39, 60], 5, 0, 0, 1760, 1481, 9023, 12),
    'year/3/explorador': measured([29, 39], 4, 0, 0, 1280, 855, 1784, 9),
    'year/1/preguicoso': measured([31, 34], 3, 0, 0, 1237, 1939, 3968, 36),
    'year/1/regular': measured([57, 65], 6, 0, 0, 2862, 2887, 16875, 6),
    'year/1/dedicado': measured([58, 71], 6, 0, 0, 2807, 2785, 17890, 3),
    'year/1/explorador': measured([47, 67], 5, 0, 0, 3199, 2517, 16473, 5),
    'year/0.5/preguicoso': measured([50, 61], 6, 0, 0, 2474, 1482, 7443, 8.5),
    'year/0.5/regular': measured([58, 72], 6, 0, 0, 3552, 3573, 18240, 5.5),
    'year/0.5/dedicado': measured([56, 71], 6, 0, 0, 2774, 2649, 17803, 1.5),
    'year/0.5/explorador': measured([53, 70], 6, 0, 0, 3680, 3680, 17912, 3),
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
