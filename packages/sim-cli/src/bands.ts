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
 * regra de `SLACK`. **A rodada atual é o fechamento R1–R3 (2026-11-13), em
 * docs/balance-v0.4.md, seção 23**: Paliçada sem batalha quando segura (R1), lotes/fila
 * escalados (R2), vagas do Quartel escaladas (R3) e preparo militar desde o verão. A tropa
 * maior disputa braços e reservas, e as novas faixas registram também fome, frio e perdas
 * por moral; não aprovam esses desvios nem a taxa de Vitória. A anterior (§22) tinha Cerco com ondas
 * por ano (1/3 e 2/3), preparo militar dos bots,
 * milícia, Queda, Crônica do Ano e catálogo com 59 cartas (lote 3 e Lobo Branco), sobre a medição
 * provisória do Cerco sem preparo (seção 20) e a Segunda junção (seção 19: treze cartas adicionais
 * do lote 2, fatores de preço a partir da próxima virada, encontros de heróis e sabotagem da
 * Fortaleza). Nenhuma folga foi ampliada.
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
// Fechamento R1–R3 (2026-11-13): tropas preservadas e lotes/vagas pelo ritmo,
// sobre o Cerco com ondas por ano (1/3 e 2/3) e o preparo militar dos bots,
// milícia, Queda, Crônica do Ano e 59 cartas (lote 3 e Lobo Branco); 50 sementes por célula nas
// três dificuldades. A medição, as violações anteriores e os limites estão em docs/balance-v0.4.md,
// seção 23, "Fechamento após R1–R3".
const MEASURED: Record<DifficultyId, Partial<Record<CellKey, Baseline>>> = {
  peasant: {
    'week/3/preguicoso': measured([28, 39], 4, 0, 0, 4250, 4250, 15495, 66),
    'week/3/regular': measured([5, 32], 4, 8, 8, 4568, 5748, 25364, 54),
    'week/3/dedicado': measured([3, 6], 5, 0, 6, 6131, 2956, 37602, 15),
    'week/3/explorador': measured([3, 22], 4, 8, 14, 3241, 4660, 21126, 54),
    'week/1/preguicoso': measured([25, 27], 2, 0, 0, 753, 2356, 2295, 32),
    'week/1/regular': measured([14, 35], 5, 0, 0, 1328, 1585, 5909, 8),
    'week/1/dedicado': measured([6, 49], 5, 0, 0, 2447, 2247, 14607, 2),
    'week/1/explorador': measured([4, 44], 4, 0, 0, 3500, 1965, 6218, 8),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1511, 2000, 280, 4.5),
    'week/0.5/regular': measured([42, 43], 4, 0, 0, 931, 778, 2083, 2),
    'week/0.5/dedicado': measured([42, 47], 4, 0, 0, 1162, 784, 1927, 0),
    'week/0.5/explorador': measured([42, 45], 4, 0, 0, 736, 876, 1989, 0.5),
    'year/3/preguicoso': measured([13, 13], 1, 0, 0, 514, 403, 470, 51),
    'year/3/regular': measured([7, 31], 2, 4, 7, 300, 597, 2076, 24),
    'year/3/dedicado': measured([7, 53], 4, 0, 6, 1882, 1591, 5854, 15),
    'year/3/explorador': measured([7, 32], 2, 4, 7, 305, 858, 1265, 24),
    'year/1/preguicoso': measured([25, 27], 2, 0, 0, 753, 2356, 2295, 32),
    'year/1/regular': measured([14, 35], 5, 0, 0, 1328, 1585, 5909, 8),
    'year/1/dedicado': measured([6, 49], 5, 0, 0, 2447, 2247, 14607, 2),
    'year/1/explorador': measured([4, 44], 4, 0, 0, 3500, 1965, 6218, 8),
    'year/0.5/preguicoso': measured([42, 48], 4, 0, 0, 3391, 2010, 5709, 7),
    'year/0.5/regular': measured([14, 56], 5, 0, 0, 2765, 2292, 15533, 2.5),
    'year/0.5/dedicado': measured([4, 44], 5, 0, 0, 1725, 2114, 13840, 0),
    'year/0.5/explorador': measured([4, 54], 5, 0, 0, 2582, 2327, 15346, 3),
  },
  lord: {
    'week/3/preguicoso': measured([17, 35], 2, 0, 0, 3400, 3400, 10885, 126),
    'week/3/regular': measured([6, 55], 5, 13, 10, 3288, 4000, 34496, 69),
    'week/3/dedicado': measured([3, 12], 5, 0, 6, 4856, 3764, 52843, 21),
    'week/3/explorador': measured([5, 35], 4, 13, 9, 4000, 4600, 17595, 69),
    'week/1/preguicoso': measured([24, 28], 3, 0, 0, 1414, 1814, 1031, 31),
    'week/1/regular': measured([13, 51], 5, 0, 0, 2305, 1511, 8116, 6),
    'week/1/dedicado': measured([5, 53], 5, 0, 0, 1812, 1813, 14557, 2),
    'week/1/explorador': measured([5, 53], 4, 0, 0, 2339, 2116, 8789, 9),
    'week/0.5/preguicoso': measured([28, 29], 3, 0, 0, 1321, 1600, 268, 8),
    'week/0.5/regular': measured([42, 44], 4, 0, 0, 931, 764, 1983, 2),
    'week/0.5/dedicado': measured([42, 45], 4, 0, 0, 811, 670, 1867, 0.5),
    'week/0.5/explorador': measured([41, 45], 4, 0, 0, 764, 1000, 1992, 2),
    'year/3/preguicoso': measured([13, 13], 1, 0, 0, 500, 444, 427, 54),
    'year/3/regular': measured([12, 28], 3, 5, 7, 310, 954, 1907, 15),
    'year/3/dedicado': measured([13, 49], 5, 0, 6, 1100, 1676, 6146, 15),
    'year/3/explorador': measured([11, 28], 3, 7, 7, 630, 1001, 1605, 18),
    'year/1/preguicoso': measured([24, 28], 3, 0, 0, 1414, 1814, 1031, 31),
    'year/1/regular': measured([13, 51], 5, 0, 0, 2305, 1511, 8116, 6),
    'year/1/dedicado': measured([5, 53], 5, 0, 0, 1812, 1813, 14557, 2),
    'year/1/explorador': measured([5, 53], 4, 0, 0, 2339, 2116, 8789, 9),
    'year/0.5/preguicoso': measured([41, 49], 4, 0, 0, 3400, 1721, 6622, 8),
    'year/0.5/regular': measured([14, 57], 4, 0, 0, 2680, 2154, 17124, 2.5),
    'year/0.5/dedicado': measured([4, 43], 4, 0, 0, 1359, 1922, 15569, 2),
    'year/0.5/explorador': measured([5, 61], 4, 0, 0, 2681, 2350, 17350, 3.5),
  },
  ironKing: {
    'week/3/preguicoso': measured([16, 44], 2, 10, 0, 3200, 3200, 24932, 126),
    'week/3/regular': measured([5, 33], 4, 8, 7, 3680, 3680, 31659, 63),
    'week/3/dedicado': measured([5, 24], 5, 2, 4, 3340, 3624, 67526, 15),
    'week/3/explorador': measured([6, 33], 4, 9, 7, 3400, 3680, 35374, 63),
    'week/1/preguicoso': measured([24, 27], 2, 0, 0, 688, 1488, 2567, 36),
    'week/1/regular': measured([14, 44], 3, 0, 0, 1410, 1547, 5995, 9),
    'week/1/dedicado': measured([10, 43], 4, 0, 0, 1623, 1688, 11073, 1),
    'week/1/explorador': measured([5, 53], 4, 0, 0, 1727, 1531, 8932, 9),
    'week/0.5/preguicoso': measured([27, 28], 3, 0, 0, 1122, 1280, 266, 8.5),
    'week/0.5/regular': measured([39, 43], 4, 0, 0, 592, 651, 2098, 0.5),
    'week/0.5/dedicado': measured([42, 49], 4, 0, 0, 866, 704, 1827, 0),
    'week/0.5/explorador': measured([39, 45], 4, 0, 0, 679, 758, 1998, 0),
    'year/3/preguicoso': measured([13, 13], 2, 0, 0, 264, 510, 490, 60),
    'year/3/regular': measured([8, 36], 3, 4, 7, 297, 845, 1841, 15),
    'year/3/dedicado': measured([19, 53], 4, 2, 4, 1106, 1749, 5483, 15),
    'year/3/explorador': measured([8, 34], 3, 2, 7, 384, 822, 1706, 21),
    'year/1/preguicoso': measured([24, 27], 2, 0, 0, 688, 1488, 2567, 36),
    'year/1/regular': measured([14, 44], 3, 0, 0, 1410, 1547, 5995, 9),
    'year/1/dedicado': measured([10, 43], 4, 0, 0, 1623, 1688, 11073, 1),
    'year/1/explorador': measured([5, 53], 4, 0, 0, 1727, 1531, 8932, 9),
    'year/0.5/preguicoso': measured([40, 46], 4, 0, 0, 3180, 1971, 6233, 8.5),
    'year/0.5/regular': measured([9, 56], 4, 0, 0, 1938, 1949, 17517, 2),
    'year/0.5/dedicado': measured([4, 51], 4, 0, 0, 1864, 1556, 16202, 0),
    'year/0.5/explorador': measured([5, 57], 5, 0, 9, 2551, 1962, 15895, 3),
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
