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
    'week/3/preguicoso': measured([21, 36], 3, 0, 0, 4250, 3787, 10492, 60),
    'week/3/regular': measured([26, 66], 6, 0, 0, 6500, 6151, 55477, 30),
    'week/3/dedicado': measured([21, 69], 8, 0, 0, 5007, 4600, 144907, 15),
    'week/3/explorador': measured([29, 69], 4, 7, 0, 6500, 5991, 85977, 51),
    'week/1/preguicoso': measured([25, 28], 2, 0, 0, 711, 2368, 2295, 32),
    'week/1/regular': measured([25, 57], 5, 0, 0, 3618, 1719, 10757, 6),
    'week/1/dedicado': measured([8, 57], 5, 0, 0, 2116, 1589, 11529, 3),
    'week/1/explorador': measured([21, 57], 5, 0, 0, 2475, 2140, 10274, 5),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1511, 2000, 280, 4.5),
    'week/0.5/regular': measured([39, 54], 5, 0, 0, 1506, 867, 1031, 2),
    'week/0.5/dedicado': measured([46, 53], 5, 0, 0, 1851, 1182, 1127, 0),
    'week/0.5/explorador': measured([37, 53], 5, 0, 0, 1117, 936, 1201, 2),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 666, 642, 205, 51),
    'year/3/regular': measured([21, 24], 3, 0, 0, 1630, 1133, 1366, 15),
    'year/3/dedicado': measured([25, 49], 4, 0, 0, 1509, 1690, 4859, 12),
    'year/3/explorador': measured([13, 30], 3, 3, 0, 1915, 1394, 1590, 18),
    'year/1/preguicoso': measured([25, 28], 2, 0, 0, 711, 2368, 2295, 32),
    'year/1/regular': measured([25, 57], 5, 0, 0, 3618, 1719, 10757, 6),
    'year/1/dedicado': measured([8, 57], 5, 0, 0, 2116, 1589, 11529, 3),
    'year/1/explorador': measured([21, 57], 5, 0, 0, 2475, 2140, 10274, 5),
    'year/0.5/preguicoso': measured([41, 54], 4, 0, 0, 4250, 1982, 5787, 6.5),
    'year/0.5/regular': measured([30, 63], 5, 0, 0, 3303, 2890, 14270, 2),
    'year/0.5/dedicado': measured([15, 68], 5, 0, 0, 1758, 2764, 13664, 0),
    'year/0.5/explorador': measured([30, 67], 5, 0, 0, 3157, 2927, 13425, 2.5),
  },
  lord: {
    'week/3/preguicoso': measured([16, 36], 2, 0, 0, 3400, 3179, 11586, 126),
    'week/3/regular': measured([28, 66], 6, 0, 0, 5200, 4447, 41080, 27),
    'week/3/dedicado': measured([19, 71], 8, 0, 4, 4079, 3691, 132612, 15),
    'week/3/explorador': measured([30, 68], 6, 5, 0, 5200, 5200, 107025, 30),
    'week/1/preguicoso': measured([25, 29], 3, 0, 0, 1414, 1986, 1349, 31),
    'week/1/regular': measured([21, 57], 5, 0, 0, 3058, 2147, 13498, 6),
    'week/1/dedicado': measured([12, 55], 5, 0, 0, 3237, 2011, 10847, 3),
    'week/1/explorador': measured([25, 56], 4, 0, 0, 2195, 1975, 9750, 6),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1321, 1600, 268, 8),
    'week/0.5/regular': measured([38, 54], 5, 0, 0, 1492, 990, 1055, 3),
    'week/0.5/dedicado': measured([45, 53], 5, 0, 0, 1444, 1203, 1219, 1),
    'week/0.5/explorador': measured([38, 53], 5, 0, 0, 1014, 976, 739, 1.5),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 540, 641, 126, 54),
    'year/3/regular': measured([20, 24], 3, 0, 0, 1438, 831, 1486, 3),
    'year/3/dedicado': measured([25, 48], 4, 0, 0, 1914, 1583, 5448, 15),
    'year/3/explorador': measured([12, 29], 3, 1, 0, 1552, 1078, 1978, 3),
    'year/1/preguicoso': measured([25, 29], 3, 0, 0, 1414, 1986, 1349, 31),
    'year/1/regular': measured([21, 57], 5, 0, 0, 3058, 2147, 13498, 6),
    'year/1/dedicado': measured([12, 55], 5, 0, 0, 3237, 2011, 10847, 3),
    'year/1/explorador': measured([25, 56], 4, 0, 0, 2195, 1975, 9750, 6),
    'year/0.5/preguicoso': measured([41, 48], 5, 0, 0, 3400, 2021, 6132, 8),
    'year/0.5/regular': measured([25, 64], 5, 0, 0, 3201, 2709, 14127, 3),
    'year/0.5/dedicado': measured([13, 67], 5, 0, 0, 1815, 2554, 13727, 1),
    'year/0.5/explorador': measured([19, 67], 5, 0, 0, 3893, 2879, 13060, 2.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([21, 36], 3, 0, 0, 3200, 2720, 9861, 63),
    'week/3/regular': measured([22, 60], 7, 0, 0, 2408, 3624, 62778, 48),
    'week/3/dedicado': measured([18, 60], 7, 0, 0, 2984, 2929, 141226, 24),
    'week/3/explorador': measured([26, 62], 5, 0, 0, 3680, 3680, 113301, 54),
    'week/1/preguicoso': measured([25, 27], 2, 0, 0, 598, 1488, 2567, 36),
    'week/1/regular': measured([22, 53], 5, 0, 0, 2760, 1952, 9030, 5),
    'week/1/dedicado': measured([11, 50], 4, 0, 0, 1971, 1829, 10841, 4),
    'week/1/explorador': measured([22, 59], 5, 0, 0, 2401, 2195, 11241, 8),
    'week/0.5/preguicoso': measured([27, 28], 3, 0, 0, 1122, 1280, 266, 8.5),
    'week/0.5/regular': measured([37, 52], 4, 0, 0, 915, 766, 990, 2),
    'week/0.5/dedicado': measured([42, 52], 5, 0, 0, 1105, 805, 1177, 0),
    'week/0.5/explorador': measured([35, 52], 4, 0, 0, 1270, 793, 1023, 3),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 278, 549, 368, 60),
    'year/3/regular': measured([22, 24], 4, 0, 0, 1280, 495, 2521, 3),
    'year/3/dedicado': measured([25, 49], 4, 0, 0, 1553, 1403, 6069, 12),
    'year/3/explorador': measured([24, 32], 4, 0, 0, 1280, 892, 2487, 3),
    'year/1/preguicoso': measured([25, 27], 2, 0, 0, 598, 1488, 2567, 36),
    'year/1/regular': measured([22, 53], 5, 0, 0, 2760, 1952, 9030, 5),
    'year/1/dedicado': measured([11, 50], 4, 0, 0, 1971, 1829, 10841, 4),
    'year/1/explorador': measured([22, 59], 5, 0, 0, 2401, 2195, 11241, 8),
    'year/0.5/preguicoso': measured([41, 53], 4, 0, 0, 3075, 1166, 5893, 9.5),
    'year/0.5/regular': measured([29, 64], 5, 0, 0, 2325, 2514, 14312, 3.5),
    'year/0.5/dedicado': measured([14, 59], 5, 0, 0, 1720, 2638, 13762, 0.5),
    'year/0.5/explorador': measured([12, 66], 5, 0, 0, 2652, 2551, 13837, 3),
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
