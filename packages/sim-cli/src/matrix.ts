import { balance, type DifficultyId, expeditionModels, RESOURCE_IDS } from '@lotg/content';

import type { StrategyName } from './bots';
import { type Band, bandFor, type CellKey, cellKey, checkBand } from './bands';
import { IDENTITY, identityLine } from './identity';
import {
  formatDecimal,
  MILESTONES,
  refusedByCode,
  runMechanicColumns,
  summarize,
  type Summary,
  SURPLUS_RESOURCES,
  type SurplusResource,
  WASTE_RESOURCES,
  WASTE_STREAK_GOAL,
  type WasteResource,
  worstWasteStreak,
} from './report';
import {
  type ExpeditionCounts,
  type GoldIn,
  type GoldOut,
  noExpeditions,
  type OutcomeCounts,
  simulate,
} from './simulate';

const HOUR_MS = 3_600_000;
const WEEK_REAL_HOURS = 7 * 24;

/** As 50 sementes fixas da matriz (GDD §15.3): `pedra-alta-001` a `pedra-alta-050`. */
export const MATRIX_SEEDS: readonly string[] = Array.from(
  { length: 50 },
  (_, index) => `pedra-alta-${String(index + 1).padStart(3, '0')}`,
);

export type Profile = {
  readonly id: 'preguicoso' | 'regular' | 'dedicado' | 'explorador' | 'ousado' | 'especulador';
  readonly label: string;
  /** Visitas por dia real, a intervalos iguais, a primeira na criação da partida. */
  readonly sessionsPerDay: number;
  readonly strategy: StrategyName;
  /**
   * Em **metade das partidas** (as de semente de número ímpar na lista) o jogador faz uma visita
   * a mais quando uma equipe para em uma encruzilhada (`SimulationOptions.crossroadsVisit`). É
   * o que deixa a matriz medir, no mesmo perfil de visitas, as encruzilhadas que o jogador decide
   * e as que a Postura decide (revisão da Fase D, M-D2).
   */
  readonly crossroadsVisits?: 'half';
};

/**
 * O perfil da Guilda (GDD §15.3): 2 sessões por dia, como o Regular, com o bot `explorador`,
 * que além de cuidar do feudo contrata na Taverna e dá festival. **Entrou na rodada padrão com
 * a Taverna (V3C-T2)**, com faixa própria: a célula dele ao lado da do Regular, mesma cadência
 * de visitas e outro bot, é o que diz o que a Guilda muda na economia.
 */
export const EXPLORER_PROFILE: Profile = {
  id: 'explorador',
  label: 'Explorador',
  sessionsPerDay: 2,
  strategy: 'explorador',
  crossroadsVisits: 'half',
};

/**
 * O perfil que arrisca (revisão da Fase D, M-R2): 2 sessões por dia com o bot `ousado`, que
 * envia entre o risco e a folga, alterna as Posturas, patrulha até revelar um caminho e manda o
 * Resgate. **Fora da rodada padrão e sem faixa**: roda a pedido (`--profile ousado`), para medir
 * o Desastre, a captura e o Resgate, que o Explorador não vê.
 */
export const BOLD_PROFILE: Profile = {
  id: 'ousado',
  label: 'Ousado',
  sessionsPerDay: 2,
  strategy: 'ousado',
  crossroadsVisits: 'half',
};

/**
 * O perfil que especula (revisão da Fase E, R6): 2 sessões por dia com o bot `especulador`, que
 * compra no balcão para revender por caravana. **Fora da rodada padrão e sem faixa**: roda a
 * pedido (`--profile especulador`), para a matriz provar que a arbitragem do mesmo dia perde
 * ouro e medir quanto a especulação sazonal da comida rende.
 */
export const SPECULATOR_PROFILE: Profile = {
  id: 'especulador',
  label: 'Especulador',
  sessionsPerDay: 2,
  strategy: 'especulador',
};

/** A partida de uma semente joga com a visita extra da encruzilhada: metade delas, as ímpares. */
export function playsCrossroadsVisit(profile: Profile, seedIndex: number): boolean {
  return profile.crossroadsVisits === 'half' && seedIndex % 2 === 0;
}

/**
 * Os perfis de visita do GDD §15.2, cada um com o bot que joga as suas sessões, e o da Guilda.
 * O Preguiçoso, o Regular e o Dedicado não contratam: são o jogador que ergue a Taverna e não a
 * usa.
 */
export const PROFILES: readonly Profile[] = [
  { id: 'preguicoso', label: 'Preguiçoso', sessionsPerDay: 1, strategy: 'preguicoso' },
  { id: 'regular', label: 'Regular', sessionsPerDay: 2, strategy: 'economico' },
  { id: 'dedicado', label: 'Dedicado', sessionsPerDay: 4, strategy: 'economico' },
  EXPLORER_PROFILE,
];
export type ProfileId = Profile['id'];

/** Todo perfil que a matriz sabe jogar: os da rodada padrão e os que só rodam a pedido. */
export const KNOWN_PROFILES: readonly Profile[] = [...PROFILES, BOLD_PROFILE, SPECULATOR_PROFILE];

/**
 * As duas janelas de medida. Não se comparam entre si: em 7 dias reais o ritmo 3 atravessa três
 * anos de jogo e o 0,5, meio ano; em um ano de jogo, o ritmo 3 dura 56 h reais e o 0,5, 14 dias.
 */
export const WINDOWS = [
  { id: 'week', label: '7 dias reais' },
  { id: 'year', label: 'Um ano de jogo' },
] as const;
export type WindowId = (typeof WINDOWS)[number]['id'];

/** Horas de jogo de um ano, pelo calendário do conteúdo. */
export const YEAR_GAME_HOURS =
  (balance.calendar.dayMs *
    balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0)) /
  HOUR_MS;

/** Horas reais de uma janela em um ritmo. */
export function windowRealHours(window: WindowId, timeScale: number): number {
  if (window === 'week') {
    return WEEK_REAL_HOURS;
  }
  const hours = YEAR_GAME_HOURS / timeScale;
  if (!Number.isInteger(hours)) {
    throw new Error(
      `No ritmo ${formatDecimal(timeScale)}× um ano de jogo dura ${formatDecimal(hours)} h reais; o simulador anda em horas inteiras.`,
    );
  }
  return hours;
}

/** Anos de jogo atravessados em `realHours` horas reais. */
export function gameYearsIn(realHours: number, timeScale: number): number {
  return (realHours * timeScale) / YEAR_GAME_HOURS;
}

export type MatrixRun = {
  window: WindowId;
  timeScale: number;
  profile: Profile;
  seed: string;
  realHours: number;
  summary: Summary;
};

export type Range = { min: number; max: number };

/**
 * O menor e o maior valor de uma medida que pode não existir (a hora de um marco a que nem toda
 * partida chega, um percentual sem produção). `null` no `max` diz que ao menos uma semente ficou
 * sem a medida; no `min`, que nenhuma a teve.
 */
export type OptionalRange = { min: number | null; max: number | null };

/** O que as sementes de uma célula (janela, ritmo, perfil) mediram: o menor e o maior valor. */
export type CellMeasure = {
  villagers: Range;
  /** A menor população de cada partida: cai quando alguém parte ou deserta. */
  villagersMin: Range;
  townHall: Range;
  /** A hora real de cada marco de `MILESTONES`, pelo `id`. */
  milestones: Record<string, OptionalRange>;
  /** A hora real em que as obras acabaram de vez; sem valor quando ainda havia o que construir. */
  exhaustedAtHour: OptionalRange;
  /** Obras que começaram sozinhas, entre as visitas. */
  autoStarted: Range;
  /** Objetivos do Senhor concluídos, e a hora real em que a sequência inteira ficou cumprida. */
  objectivesDone: Range;
  objectivesAllDoneAtHour: OptionalRange;
  famineHours: Range;
  coldHours: Range;
  /** A menor moral de cada partida, e as horas com ela nas faixas de baixo. */
  moraleMin: Range;
  lowMoraleHours: Range;
  /** Aldeões que foram embora (partidas e deserções), por partida. */
  villagersLost: Range;
  queueIdleHours: Range;
  plannedIdleHours: Range;
  freeVillagerHours: Range;
  commandsRefused: Range;
  surplus: Record<SurplusResource, Range>;
  wasted: Record<WasteResource, Range>;
  wasteHours: Range;
  /** Quanto da produção bruta de cada recurso foi ao chão, em por cento. */
  wastedPercent: Record<WasteResource, OptionalRange>;
  /** A maior sequência desperdiçando cada recurso, em horas de jogo. */
  wasteStreak: Record<WasteResource, Range>;
  /** A do pior recurso de cada partida: é a que a faixa e a meta do GDD §15.2 olham. */
  wasteStreakWorst: Range;
  /**
   * As incursões de cada partida (GDD §8.2): as sofridas, as repelidas, as que a Torre anunciou,
   * os feridos, a comida e a madeira que os lobos levaram, e a Ameaça no fim.
   */
  raids: {
    suffered: Range;
    repelled: Range;
    announced: Range;
    injured: Range;
    lostFood: Range;
    lostWood: Range;
    threatFinal: Range;
  };
  /**
   * Os heróis e a Taverna de cada partida (GDD §9.1): os heróis no fim, os contratados, os que
   * partiram sem soldo, as horas reais com o soldo em atraso, a hora real do primeiro herói, o
   * nível final da Taverna, a hora real em que ela ficou pronta e os festivais dados.
   */
  guild: {
    heroes: Range;
    hired: Range;
    departed: Range;
    arrearsHours: Range;
    firstHeroAtHour: OptionalRange;
    tavernLevel: Range;
    tavernAtHour: OptionalRange;
    festivals: Range;
  };
};

export type MatrixCell = {
  key: CellKey;
  window: WindowId;
  timeScale: number;
  paceLabel: string;
  profile: Profile;
  realHours: number;
  gameYears: number;
  seeds: number;
  measure: CellMeasure;
  /** As expedições da célula, somadas nas sementes: ver `ExpeditionTotals`. */
  expeditions: ExpeditionTotals;
  /** O Mercado da célula, somado nas sementes: ver `MarketTotals`. */
  market: MarketTotals;
  /** Os Mestres da célula, somados nas sementes: ver `MasterTotals`. */
  masters: MasterTotals;
  /** `null` quando não há faixa para a célula (outra dificuldade, ritmo fora do conteúdo). */
  band: Band | null;
  /** Uma frase por problema, com quantas sementes o tiveram; vazio quando a célula está dentro. */
  violations: string[];
};

export type MatrixOptions = {
  /** Sementes da rodada; o padrão são as 50 fixas. */
  seeds?: readonly string[];
  /** Dificuldade das partidas; o padrão, e a única com faixas, é `lord`. */
  difficulty?: DifficultyId;
  /** Ritmos da rodada; o padrão são os que o conteúdo oferece. */
  timeScales?: readonly number[];
  /** Perfis da rodada; o padrão são os três de `PROFILES`. */
  profiles?: readonly Profile[];
};

export type MatrixResult = {
  identity: typeof IDENTITY;
  difficulty: DifficultyId;
  difficultyLabel: string;
  seeds: readonly string[];
  runs: MatrixRun[];
  cells: MatrixCell[];
};

/**
 * As expedições de uma célula, **somadas** nas sementes (as faixas de menor a maior escondem o
 * que importa aqui: quantas vezes cada coisa aconteceu no total). As encruzilhadas saem também
 * separadas pelas partidas com e sem a visita extra do jogador.
 */
export type ExpeditionTotals = {
  sent: number;
  byModel: Record<string, { sent: number; outcomes: OutcomeCounts }>;
  crossroads: { player: number; posture: number };
  /** As partidas em que o jogador atende o aviso da encruzilhada, e as que só têm as sessões do dia. */
  crossroadsWithVisit: { player: number; posture: number; runs: number; extraVisits: number };
  crossroadsWithoutVisit: { player: number; posture: number; runs: number };
  fates: ExpeditionCounts['fates'];
  /** Herói-horas reais com herói parado no feudo, somadas. */
  heroIdleHours: number;
  /** Quantas partidas a célula somou. */
  runs: number;
};

/**
 * O Mercado de uma célula, **somado** nas sementes: quantas partidas o ergueram, o nível com
 * que terminaram, o que foi vendido e comprado de cada recurso, o ouro que isso moveu e o
 * volume oferecido (os dias de jogo com o Mercado de pé, os três recursos somados).
 */
export type MarketTotals = {
  runs: number;
  built: number;
  level: Range;
  sold: Record<'food' | 'wood' | 'stone', number>;
  bought: Record<'food' | 'wood' | 'stone', number>;
  goldEarned: number;
  goldSpent: number;
  offered: number;
  /** As caravanas da célula, somadas: enviadas, com escolta, emboscadas, e o ouro delas. */
  caravansSent: number;
  caravansEscorted: number;
  caravansAmbushed: number;
  caravanGold: number;
  /** Partidas com ao menos uma caravana enviada. */
  caravanRuns: number;
  /** O que a Mina de Ouro produziu, somado nas sementes: a comparação do ouro por fonte. */
  mineGold: number;
  /** O ouro por fonte e por destino, somado nas sementes (revisão da Fase E, R6). */
  goldIn: GoldIn;
  goldOut: GoldOut;
  /** O ouro pago nas compras e o recebido das caravanas, e as unidades delas, por recurso. */
  boughtGold: Record<'food' | 'wood' | 'stone', number>;
  caravanGoldBy: Record<'food' | 'wood' | 'stone', number>;
  caravanUnits: Record<'food' | 'wood' | 'stone', number>;
  /** O ouro parado no fim, somado nas sementes: o que as fontes deixaram sem destino. */
  goldLeft: number;
};

/**
 * Os Mestres de uma célula (GDD §5.4; V3E-T3), somados nas sementes: quantas partidas terminaram
 * com ao menos um, quantos Mestres ao todo, em que edifício cada um terminou (`idle` é sem
 * edifício), quantos esperavam à porta, a hora real da primeira chegada (a mediana entre as
 * partidas que tiveram uma) e as horas com Mestre sem edifício.
 */
export type MasterTotals = {
  runs: number;
  runsWithMaster: number;
  count: number;
  waiting: number;
  at: Record<'farm' | 'lumberMill' | 'quarry' | 'goldMine' | 'idle', number>;
  firstAtHour: number | null;
  idleHours: number;
};

function masterTotalsOf(summaries: Summary[]): MasterTotals {
  const totals: MasterTotals = {
    runs: summaries.length,
    runsWithMaster: 0,
    count: 0,
    waiting: 0,
    at: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0, idle: 0 },
    firstAtHour: null,
    idleHours: 0,
  };
  const hours: number[] = [];
  for (const { masters } of summaries) {
    totals.runsWithMaster += masters.count + masters.waiting > 0 ? 1 : 0;
    totals.count += masters.count;
    totals.waiting += masters.waiting;
    totals.idleHours += masters.idleHours;
    for (const building of masters.at) {
      totals.at[building ?? 'idle'] += 1;
    }
    if (masters.atHour !== null) {
      hours.push(masters.atHour);
    }
  }
  hours.sort((a, b) => a - b);
  totals.firstAtHour = hours[Math.floor(hours.length / 2)] ?? null;
  return totals;
}

/**
 * A tabela dos Mestres (V3E-T3): em quantas partidas um chegou, quando, e **onde o bot o pôs**.
 * É a medida que o ADR 0018 pede ("o bônus torna um edifício obrigatório?"): um edifício que
 * leva todos os Mestres de todas as partidas é a resposta "sim".
 */
export function mastersTable(cells: readonly MatrixCell[]): string {
  return table(
    [
      'Ritmo',
      'Perfil',
      'Partidas com Mestre',
      'Mestres no fim',
      'Primeiro Mestre (hora real, mediana)',
      'Onde terminaram (Fazenda · Serraria · Pedreira · Mina · sem edifício)',
      'À porta no fim',
      'Horas com Mestre sem edifício, por partida com Mestre',
    ],
    cells.map(({ paceLabel, profile, masters }) => [
      paceLabel,
      profile.label,
      `${masters.runsWithMaster} de ${masters.runs}`,
      formatInt(masters.count),
      masters.firstAtHour === null ? '—' : formatInt(masters.firstAtHour),
      [
        masters.at.farm,
        masters.at.lumberMill,
        masters.at.quarry,
        masters.at.goldMine,
        masters.at.idle,
      ]
        .map((total) => formatInt(total))
        .join(' · '),
      formatInt(masters.waiting),
      masters.runsWithMaster === 0
        ? '—'
        : formatDecimal(Math.round((masters.idleHours * 10) / masters.runsWithMaster) / 10),
    ]),
  );
}

function marketTotalsOf(summaries: Summary[]): MarketTotals {
  const levels = summaries.map(({ market }) => market.level);
  const totals: MarketTotals = {
    runs: summaries.length,
    built: levels.filter((level) => level > 0).length,
    level: { min: Math.min(...levels), max: Math.max(...levels) },
    sold: { food: 0, wood: 0, stone: 0 },
    bought: { food: 0, wood: 0, stone: 0 },
    goldEarned: 0,
    goldSpent: 0,
    offered: 0,
    caravansSent: 0,
    caravansEscorted: 0,
    caravansAmbushed: 0,
    caravanGold: 0,
    caravanRuns: 0,
    mineGold: 0,
    goldIn: { counter: 0, caravans: 0, loot: 0, other: 0 },
    goldOut: { wages: 0, tavern: 0, works: 0, recruits: 0, purchases: 0, other: 0 },
    boughtGold: { food: 0, wood: 0, stone: 0 },
    caravanGoldBy: { food: 0, wood: 0, stone: 0 },
    caravanUnits: { food: 0, wood: 0, stone: 0 },
    goldLeft: 0,
  };
  for (const { market, surplus } of summaries) {
    totals.goldLeft += surplus.gold;
    for (const key of Object.keys(totals.goldIn) as Array<keyof GoldIn>) {
      totals.goldIn[key] += market.goldIn[key];
    }
    for (const key of Object.keys(totals.goldOut) as Array<keyof GoldOut>) {
      totals.goldOut[key] += market.goldOut[key];
    }
    totals.caravansSent += market.caravansSent;
    totals.caravansEscorted += market.caravansEscorted;
    totals.caravansAmbushed += market.caravansAmbushed;
    totals.caravanGold += market.caravanGold;
    totals.caravanRuns += market.caravansSent > 0 ? 1 : 0;
    totals.mineGold += market.mineGold;
    for (const id of ['food', 'wood', 'stone'] as const) {
      totals.sold[id] += market.sold[id];
      totals.bought[id] += market.bought[id];
      totals.boughtGold[id] += market.boughtGold[id];
      totals.caravanGoldBy[id] += market.caravanGoldBy[id];
      totals.caravanUnits[id] += market.caravanUnits[id];
    }
    totals.goldEarned += market.goldEarned;
    totals.goldSpent += market.goldSpent;
    totals.offered += market.offered;
  }
  return totals;
}

/**
 * O Mercado de uma janela, **por partida** (a soma das sementes dividida pelo número delas): o
 * que cada perfil vendeu e comprou, o ouro que recebeu e a parcela do volume oferecido que usou;
 * e as caravanas (V3E-T2): quantas partidas mandaram alguma, quantas por partida (enviadas, com
 * escolta, emboscadas) e o ouro por fonte (o balcão, as caravanas e a Mina de Ouro).
 * O ouro parado no fim está na tabela de medidas, na coluna do excedente de ouro.
 */
export function marketTable(cells: readonly MatrixCell[]): string {
  const per = (total: number, runs: number) => formatInt(Math.round(total / Math.max(1, runs)));
  return table(
    [
      'Ritmo',
      'Perfil',
      'Partidas com Mercado',
      'Nível final',
      'Vendido por partida (comida · madeira · pedra)',
      'Comprado por partida (comida · madeira · pedra)',
      'Ouro recebido por partida',
      'Ouro pago por partida',
      'Volume usado',
      'Partidas com caravana',
      'Caravanas por partida (enviadas · com escolta · emboscadas)',
      'Ouro por partida (balcão · caravanas · Mina)',
    ],
    cells.map((cell) => {
      const { market } = cell;
      const traded = (['food', 'wood', 'stone'] as const).reduce(
        (sum, id) => sum + market.sold[id] + market.bought[id],
        0,
      );
      const list = (amounts: MarketTotals['sold']) =>
        (['food', 'wood', 'stone'] as const).map((id) => per(amounts[id], market.runs)).join(' · ');
      return [
        cell.paceLabel,
        cell.profile.label,
        `${market.built} de ${market.runs}`,
        formatRange(market.level),
        list(market.sold),
        list(market.bought),
        per(market.goldEarned, market.runs),
        per(market.goldSpent, market.runs),
        market.offered === 0
          ? '—'
          : `${formatDecimal(Math.round((traded * 1000) / market.offered) / 10)}%`,
        `${market.caravanRuns} de ${market.runs}`,
        [market.caravansSent, market.caravansEscorted, market.caravansAmbushed]
          .map((total) => formatDecimal(Math.round((total * 10) / Math.max(1, market.runs)) / 10))
          .join(' · '),
        [market.goldEarned, market.caravanGold, market.mineGold]
          .map((total) => per(total, market.runs))
          .join(' · '),
      ];
    }),
  );
}

/**
 * O ouro de uma janela, **por partida**: de onde veio (a Mina, o balcão, as caravanas, o saque
 * das expedições e o resto: prêmios de objetivo e cartas) e para onde foi (o soldo, a Taverna,
 * as obras, o recrutamento, as compras no balcão e o resto), e o que ficou parado no fim. É a
 * pergunta "o ouro tem destino?" (GDD §8.3; ADR 0016, C-5) em números (revisão da Fase E, R6).
 * O soldo é amostrado ao fim de cada hora real, como a Mina; o resto vem dos eventos.
 */
export function goldTable(cells: readonly MatrixCell[]): string {
  const per = (total: number, runs: number) => formatInt(Math.round(total / Math.max(1, runs)));
  return table(
    [
      'Ritmo',
      'Perfil',
      'Fontes por partida (Mina · balcão · caravanas · saque · prêmios e cartas)',
      'Destinos por partida (soldo · Taverna · obras · recrutamento · compras · cartas e outros)',
      'Ouro parado no fim, por partida',
    ],
    cells.map((cell) => {
      const { market } = cell;
      const { goldIn, goldOut } = market;
      return [
        cell.paceLabel,
        cell.profile.label,
        [market.mineGold, goldIn.counter, goldIn.caravans, goldIn.loot, goldIn.other]
          .map((total) => per(total, market.runs))
          .join(' · '),
        [
          goldOut.wages,
          goldOut.tavern,
          goldOut.works,
          goldOut.recruits,
          goldOut.purchases,
          goldOut.other,
        ]
          .map((total) => per(total, market.runs))
          .join(' · '),
        per(market.goldLeft, market.runs),
      ];
    }),
  );
}

/**
 * O que a especulação rendeu em uma janela, **por partida**, para o perfil que compra para
 * revender por caravana (`especulador`; revisão da Fase E, R6): por recurso, o ouro pago no
 * balcão, as unidades que chegaram e o ouro que as caravanas trouxeram, e o saldo. A madeira e a
 * pedra são a arbitragem do mesmo dia (comprar e enviar na mesma visita): o saldo tem de ser
 * negativo. A comida é a especulação sazonal: comprada no verão, enviada no outono e no inverno.
 * `null` sem nenhuma célula de especulador.
 */
export function speculationTable(cells: readonly MatrixCell[]): string | null {
  const speculators = cells.filter((cell) => cell.profile.strategy === 'especulador');
  if (speculators.length === 0) {
    return null;
  }
  const per = (total: number, runs: number) =>
    formatDecimal(Math.round((total * 10) / Math.max(1, runs)) / 10);
  const leg = (cell: MatrixCell, ids: ReadonlyArray<'food' | 'wood' | 'stone'>) => {
    const { market } = cell;
    const sum = (amounts: Record<'food' | 'wood' | 'stone', number>) =>
      ids.reduce((total, id) => total + amounts[id], 0);
    const paid = sum(market.boughtGold);
    const got = sum(market.caravanGoldBy);
    return `${per(sum(market.bought), market.runs)} · ${per(paid, market.runs)} · ${per(sum(market.caravanUnits), market.runs)} · ${per(got, market.runs)} · ${per(got - paid, market.runs)}`;
  };
  // O que a comida comprada rendeu, fora a colheita do feudo, que vai na mesma caravana: as
  // unidades compradas vezes a diferença entre o preço médio recebido e o preço médio pago.
  const seasonal = (cell: MatrixCell): string => {
    const { bought, boughtGold, caravanUnits, caravanGoldBy, runs } = cell.market;
    if (bought.food === 0 || caravanUnits.food === 0) {
      return '—';
    }
    const gain =
      bought.food * (caravanGoldBy.food / caravanUnits.food - boughtGold.food / bought.food);
    return per(gain, runs);
  };
  const columns = 'compradas · ouro pago · unidades vendidas por caravana · ouro recebido · saldo';
  return table(
    [
      'Ritmo',
      'Perfil',
      `Arbitragem do dia, madeira e pedra (${columns})`,
      `Comida: comprada no verão e enviada no outono e no inverno, com a colheita do feudo na mesma caravana (${columns} bruto)`,
      'Especulação sazonal: o ganho só da comida comprada, por partida',
    ],
    speculators.map((cell) => [
      cell.paceLabel,
      cell.profile.label,
      leg(cell, ['wood', 'stone']),
      leg(cell, ['food']),
      seasonal(cell),
    ]),
  );
}

function expeditionTotalsOf(profile: Profile, summaries: Summary[]): ExpeditionTotals {
  const totals: ExpeditionTotals = {
    sent: 0,
    byModel: {},
    crossroads: { player: 0, posture: 0 },
    crossroadsWithVisit: { player: 0, posture: 0, runs: 0, extraVisits: 0 },
    crossroadsWithoutVisit: { player: 0, posture: 0, runs: 0 },
    fates: noExpeditions().fates,
    heroIdleHours: 0,
    runs: summaries.length,
  };
  summaries.forEach(({ expeditions }, index) => {
    totals.sent += expeditions.sent;
    totals.heroIdleHours += expeditions.heroIdleHours;
    totals.crossroads.player += expeditions.crossroadsByPlayer;
    totals.crossroads.posture += expeditions.crossroadsByPosture;
    const side = playsCrossroadsVisit(profile, index)
      ? totals.crossroadsWithVisit
      : totals.crossroadsWithoutVisit;
    side.player += expeditions.crossroadsByPlayer;
    side.posture += expeditions.crossroadsByPosture;
    side.runs += 1;
    totals.crossroadsWithVisit.extraVisits += expeditions.extraVisits;
    for (const key of Object.keys(totals.fates) as Array<keyof ExpeditionCounts['fates']>) {
      totals.fates[key] += expeditions.fates[key];
    }
    for (const [id, counts] of Object.entries(expeditions.byModel)) {
      const model = (totals.byModel[id] ??= {
        sent: 0,
        outcomes: { full: 0, success: 0, setback: 0, disaster: 0 },
      });
      model.sent += counts.sent;
      for (const outcome of Object.keys(model.outcomes) as Array<keyof OutcomeCounts>) {
        model.outcomes[outcome] += counts.outcomes[outcome];
      }
    }
  });
  return totals;
}

/** "12 de 40 (30%)", ou "—" sem nenhuma. */
export function shareText(part: number, whole: number): string {
  return whole === 0 ? '—' : `${part} de ${whole} (${Math.round((part * 100) / whole)}%)`;
}

function rangeOf(values: number[]): Range {
  return { min: Math.min(...values), max: Math.max(...values) };
}

/** O menor e o maior valor entre as sementes que têm a medida; `null` no `max` se alguma não tem. */
function optionalRangeOf(values: Array<number | null>): OptionalRange {
  const present = values.filter((value): value is number => value !== null);
  return {
    min: present.length === 0 ? null : Math.min(...present),
    max: present.length < values.length ? null : Math.max(...present),
  };
}

function measureOf(summaries: Summary[]): CellMeasure {
  const range = (pick: (summary: Summary) => number) => rangeOf(summaries.map(pick));
  const optional = (pick: (summary: Summary) => number | null) =>
    optionalRangeOf(summaries.map(pick));
  return {
    villagers: range((summary) => summary.villagers),
    villagersMin: range((summary) => summary.villagersMin),
    townHall: range((summary) => summary.townHall),
    milestones: Object.fromEntries(
      MILESTONES.map(({ id }) => [id, optional((summary) => summary.milestones[id] ?? null)]),
    ),
    exhaustedAtHour: optional((summary) => summary.exhaustedAtHour),
    autoStarted: range((summary) => summary.autoStarted),
    objectivesDone: range((summary) => summary.objectives.done),
    objectivesAllDoneAtHour: optional((summary) => summary.objectives.allDoneAtHour),
    famineHours: range((summary) => summary.famineHours),
    coldHours: range((summary) => summary.coldHours),
    moraleMin: range((summary) => summary.moraleMin),
    lowMoraleHours: range((summary) => summary.lowMoraleHours),
    villagersLost: range((summary) => summary.villagersLeft + summary.villagersDeserted),
    queueIdleHours: range((summary) => summary.queueIdleHours),
    plannedIdleHours: range((summary) => summary.plannedIdleHours),
    freeVillagerHours: range((summary) => summary.freeVillagerHours),
    commandsRefused: range((summary) => summary.commandsRefused),
    surplus: Object.fromEntries(
      SURPLUS_RESOURCES.map((id) => [id, range((summary) => summary.surplus[id])]),
    ) as Record<SurplusResource, Range>,
    wasted: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, range((summary) => summary.wasted[id])]),
    ) as Record<WasteResource, Range>,
    wasteHours: range((summary) => summary.wasteHours),
    wastedPercent: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, optional((summary) => summary.wastedPercent[id])]),
    ) as Record<WasteResource, OptionalRange>,
    wasteStreak: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, range((summary) => summary.wasteStreakGameHours[id])]),
    ) as Record<WasteResource, Range>,
    wasteStreakWorst: range((summary) => worstWasteStreak(summary).gameHours),
    raids: {
      suffered: range((summary) => summary.raids.suffered),
      repelled: range((summary) => summary.raids.repelled),
      announced: range((summary) => summary.raids.announced),
      injured: range((summary) => summary.raids.injured),
      lostFood: range((summary) => summary.raids.lost.food),
      lostWood: range((summary) => summary.raids.lost.wood),
      threatFinal: range((summary) => summary.threat.final),
    },
    guild: {
      heroes: range((summary) => summary.guild.heroes),
      hired: range((summary) => summary.guild.hired),
      departed: range((summary) => summary.guild.departed),
      arrearsHours: range((summary) => summary.guild.arrearsHours),
      firstHeroAtHour: optional((summary) => summary.guild.firstHeroAtHour),
      tavernLevel: range((summary) => summary.guild.tavernLevel),
      tavernAtHour: optional((summary) => summary.guild.tavernAtHour),
      festivals: range((summary) => summary.guild.festivals),
    },
  };
}

/**
 * O perfil que a meta de desperdício do GDD §15.2 cobra: o Regular. O Explorador visita o feudo
 * com a mesma cadência, mas é outro jogador (contrata, dá festival), e a célula dele não entra
 * na meta: tem a faixa dela.
 */
const WASTE_GOAL_PROFILE: ProfileId = 'regular';

/**
 * As células que a meta de desperdício cobra (`WASTE_STREAK_GOAL`: o perfil de 2 sessões por
 * dia) e o que cada uma mediu: a maior sequência desperdiçando um recurso, em horas de jogo, e
 * se ela cabe na meta.
 */
export function wasteGoalCells(
  cells: readonly MatrixCell[],
): Array<{ cell: MatrixCell; gameHours: number; met: boolean }> {
  return cells
    .filter(
      (cell) =>
        cell.profile.id === WASTE_GOAL_PROFILE &&
        cell.profile.sessionsPerDay === WASTE_STREAK_GOAL.sessionsPerDay,
    )
    .map((cell) => {
      const gameHours = cell.measure.wasteStreakWorst.max;
      return { cell, gameHours, met: gameHours <= WASTE_STREAK_GOAL.gameHours };
    });
}

/**
 * Os problemas de uma célula, um por frase: o mesmo problema em várias sementes sai uma vez só,
 * com a contagem e a primeira semente em que apareceu.
 */
export function violationsOf(
  key: CellKey,
  band: Band,
  summaries: Summary[],
  seeds: readonly string[],
): string[] {
  const seedsByProblem = new Map<string, string[]>();
  summaries.forEach((summary, index) => {
    for (const problem of checkBand(band, summary)) {
      seedsByProblem.set(problem, [...(seedsByProblem.get(problem) ?? []), seeds[index] ?? '?']);
    }
  });
  return [...seedsByProblem].map(
    ([problem, found]) =>
      `${key}: ${problem} (${found.length} de ${seeds.length} sementes, a primeira ${found[0]})`,
  );
}

function paceLabelOf(timeScale: number): string {
  const pace = balance.paces.find((entry) => entry.timeScale === timeScale);
  return `${pace?.label ?? 'Ritmo'} ${formatDecimal(timeScale)}×`;
}

/**
 * Joga a matriz de balanceamento (roadmap da v0.2, §7.3): cada janela × cada ritmo × cada
 * perfil × cada semente, na dificuldade pedida, e confere cada partida contra a faixa da sua
 * célula. Uma partida que serve a duas janelas (no ritmo 1, 7 dias reais são um ano de jogo) é
 * jogada uma vez só.
 */
export async function runMatrix(options: MatrixOptions = {}): Promise<MatrixResult> {
  const seeds = options.seeds ?? MATRIX_SEEDS;
  const difficulty = options.difficulty ?? 'lord';
  const timeScales = options.timeScales ?? balance.paces.map((pace) => pace.timeScale);
  const profiles = options.profiles ?? PROFILES;
  const played = new Map<string, Summary>();
  const runs: MatrixRun[] = [];
  const cells: MatrixCell[] = [];

  for (const window of WINDOWS) {
    for (const timeScale of timeScales) {
      const realHours = windowRealHours(window.id, timeScale);
      for (const profile of profiles) {
        const summaries: Summary[] = [];
        for (const [seedIndex, seed] of seeds.entries()) {
          const id = `${timeScale}/${profile.id}/${realHours}/${seed}`;
          let summary = played.get(id);
          if (summary === undefined) {
            summary = summarize(
              await simulate({
                seed,
                days: Math.ceil(realHours / 24),
                hours: realHours,
                strategy: profile.strategy,
                sessionsPerDay: profile.sessionsPerDay,
                timeScale,
                difficulty,
                crossroadsVisit: playsCrossroadsVisit(profile, seedIndex),
              }),
            );
            played.set(id, summary);
          }
          summaries.push(summary);
          runs.push({ window: window.id, timeScale, profile, seed, realHours, summary });
        }
        const key = cellKey(window.id, timeScale, profile.id);
        const band = bandFor(key, difficulty);
        cells.push({
          key,
          window: window.id,
          timeScale,
          paceLabel: paceLabelOf(timeScale),
          profile,
          realHours,
          gameYears: gameYearsIn(realHours, timeScale),
          seeds: seeds.length,
          measure: measureOf(summaries),
          expeditions: expeditionTotalsOf(profile, summaries),
          market: marketTotalsOf(summaries),
          masters: masterTotalsOf(summaries),
          band,
          violations: band === null ? [] : violationsOf(key, band, summaries, seeds),
        });
      }
    }
  }

  return {
    identity: IDENTITY,
    difficulty,
    difficultyLabel: balance.difficulties[difficulty].label,
    seeds,
    runs,
    cells,
  };
}

/** Milhar com ponto, como no resto dos documentos: `40.872`. */
function formatInt(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatRange({ min, max }: Range): string {
  return min === max ? formatInt(min) : `${formatInt(min)} a ${formatInt(max)}`;
}

/** Horas de jogo, que no ritmo 0,5 saem com meia hora: `165`, `1,5`, `0 a 1,5`. */
function formatHoursRange({ min, max }: Range): string {
  return min === max ? formatDecimal(min) : `${formatDecimal(min)} a ${formatDecimal(max)}`;
}

/**
 * Uma medida que pode faltar: `—` quando nenhuma semente a tem, e "12 a —" quando só algumas
 * (um marco a que nem toda partida chegou).
 */
function formatOptional({ min, max }: OptionalRange, suffix = ''): string {
  if (min === null) {
    return '—';
  }
  if (max === null) {
    return `${formatInt(min)}${suffix} a —`;
  }
  return min === max
    ? `${formatInt(min)}${suffix}`
    : `${formatInt(min)}${suffix} a ${formatInt(max)}${suffix}`;
}

const STREAK_TITLE = 'Maior sequência desperdiçando (h de jogo)';

function table(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  return [line(header), line(header.map(() => '---')), ...rows.map(line)].join('\n');
}

/** Título da coluna de excedente parado de um material: "Excedente de madeira". */
function surplusTitle(id: SurplusResource): string {
  return `Excedente de ${balance.resources[id].label.toLowerCase()}`;
}

/** Título da coluna da sequência desperdiçando um recurso: "Comida (h de jogo)". */
function streakTitle(id: WasteResource): string {
  return `${balance.resources[id].label} (h de jogo)`;
}

/** Título da coluna da parte da produção perdida: "Comida perdida (% da produção)". */
function wasteShareTitle(id: WasteResource): string {
  return `${balance.resources[id].label} perdida (% da produção)`;
}

/** Um marco a que nenhuma semente chegou. */
const NEVER: OptionalRange = { min: null, max: null };

/** Título da coluna de desperdício de um recurso: "Desperdício de comida". */
function wasteTitle(id: WasteResource): string {
  return `Desperdício de ${balance.resources[id].label.toLowerCase()}`;
}

/**
 * As linhas da tabela `MEASURED` de `src/bands.ts` com o que esta rodada mediu. Servem para
 * atualizar a linha de base de propósito, depois de conferir o que mudou; nada as grava sozinho.
 */
function baselineLines(cells: MatrixCell[]): string {
  return cells
    .map(({ key, measure }) => {
      const { villagers, townHall, famineHours, coldHours, surplus, wasteStreakWorst } = measure;
      const values = [
        `[${villagers.min}, ${villagers.max}]`,
        townHall.min,
        famineHours.max,
        coldHours.max,
        ...SURPLUS_RESOURCES.map((id) => surplus[id].max),
        wasteStreakWorst.max,
      ];
      return `  '${key}': measured(${values.join(', ')}),`;
    })
    .join('\n');
}

function seedsLine(seeds: readonly string[]): string {
  const [first] = seeds;
  const last = seeds[seeds.length - 1];
  return seeds.length === 1
    ? `1 semente (${first})`
    : `${seeds.length} sementes (${first} a ${last})`;
}

/** Como a tabela chama cada destino: o nome do conteúdo, pela chave que os eventos trazem. */
function modelLabel(modelId: string): string {
  return expeditionModels.find((model) => model.id === modelId)?.label ?? modelId;
}

/**
 * As expedições de uma janela, **somadas nas sementes de cada célula** (revisão da Fase D,
 * M-D2): o que aconteceu a quem partiu, quem decidiu nas encruzilhadas (com e sem a visita extra
 * do jogador) e os desfechos dos nós com prova, por destino. Só as células em que alguém enviou
 * uma expedição aparecem.
 */
export function expeditionTables(cells: readonly MatrixCell[]): string {
  const sending = cells.filter((cell) => cell.expeditions.sent > 0);
  if (sending.length === 0) {
    return 'Nenhuma expedição enviada nesta janela.';
  }
  const who = (cell: MatrixCell) => [cell.paceLabel, cell.profile.label];
  const totals = table(
    [
      'Ritmo',
      'Perfil',
      'Partidas',
      'Expedições',
      'Encruzilhadas: jogador ÷ todas',
      'Com a visita extra',
      'Só as sessões do dia',
      'Visitas extras',
      'Feridos',
      'Cativos',
      'Mortos',
      'Resgatados',
      'Covil limpo',
      'Equipes perdidas',
      'Herói ocioso (herói-h)',
    ],
    sending.map((cell) => {
      const { expeditions: all } = cell;
      const { crossroads, crossroadsWithVisit: withVisit, crossroadsWithoutVisit: without } = all;
      return [
        ...who(cell),
        String(all.runs),
        formatInt(all.sent),
        shareText(crossroads.player, crossroads.player + crossroads.posture),
        withVisit.runs === 0
          ? '—'
          : shareText(withVisit.player, withVisit.player + withVisit.posture),
        shareText(without.player, without.player + without.posture),
        formatInt(withVisit.extraVisits),
        formatInt(all.fates.injured),
        formatInt(all.fates.captured),
        formatInt(all.fates.died),
        formatInt(all.fates.rescued),
        formatInt(all.fates.tilesCleared),
        formatInt(all.fates.lost),
        formatInt(all.heroIdleHours),
      ];
    }),
  );
  const models = expeditionModels
    .map((model) => model.id)
    .filter((id) => sending.some((cell) => cell.expeditions.byModel[id] !== undefined));
  const outcomes = table(
    ['Ritmo', 'Perfil', ...models.map((id) => `${modelLabel(id)}: envios · P/S/R/D`)],
    sending.map((cell) => [
      ...who(cell),
      ...models.map((id) => {
        const model = cell.expeditions.byModel[id];
        if (model === undefined) {
          return '—';
        }
        const { full, success, setback, disaster } = model.outcomes;
        return `${model.sent} · ${full}/${success}/${setback}/${disaster}`;
      }),
    ]),
  );
  return [
    'Somas das sementes de cada célula. As encruzilhadas: quantas o jogador decidiu, de todas as decididas; nas partidas "com a visita extra" ele volta quando a equipe para (metade das sementes dos perfis da Guilda), e nas outras só tem as sessões do dia.',
    '',
    totals,
    '',
    'Por destino, os envios e os desfechos dos nós com prova (Sucesso Pleno / Sucesso / Revés / Desastre):',
    '',
    outcomes,
  ].join('\n');
}

/**
 * O relatório da matriz, em Markdown, pronto para colar em `docs/balance-v0.2.md`: a
 * identificação da rodada, uma tabela de medidas e uma de faixas por janela, e o veredito.
 */
export function formatMatrix(result: MatrixResult): string {
  const violations = result.cells.flatMap((cell) => cell.violations);
  const unbanded = result.cells.filter((cell) => cell.band === null).length;
  const sections = WINDOWS.map((window) => {
    const cells = result.cells.filter((cell) => cell.window === window.id);
    // O que varia com o ritmo em cada janela: os anos atravessados, ou as horas que o ano dura.
    const span =
      window.id === 'week'
        ? { title: 'Anos de jogo', of: (cell: MatrixCell) => formatDecimal(cell.gameYears) }
        : { title: 'Horas reais', of: (cell: MatrixCell) => formatInt(cell.realHours) };
    const measures = table(
      [
        'Ritmo',
        'Perfil',
        span.title,
        'População',
        'Salão',
        'Fome (h)',
        'Frio (h)',
        'Moral mínima',
        'Moral baixa (h)',
        'Foram embora',
        'Fila ociosa (h)',
        'Sem ofício (aldeão-h)',
        ...SURPLUS_RESOURCES.map(surplusTitle),
        ...WASTE_RESOURCES.map(wasteTitle),
        'Desperdiçando (h)',
        STREAK_TITLE,
        'Recusas',
        'Faixa',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        `${cell.profile.label} (${cell.profile.sessionsPerDay}/dia, ${cell.profile.strategy})`,
        span.of(cell),
        formatRange(cell.measure.villagers),
        formatRange(cell.measure.townHall),
        formatRange(cell.measure.famineHours),
        formatRange(cell.measure.coldHours),
        formatRange(cell.measure.moraleMin),
        formatRange(cell.measure.lowMoraleHours),
        formatRange(cell.measure.villagersLost),
        formatRange(cell.measure.queueIdleHours),
        formatRange(cell.measure.freeVillagerHours),
        ...SURPLUS_RESOURCES.map((id) => formatRange(cell.measure.surplus[id])),
        ...WASTE_RESOURCES.map((id) => formatRange(cell.measure.wasted[id])),
        formatRange(cell.measure.wasteHours),
        formatHoursRange(cell.measure.wasteStreakWorst),
        formatRange(cell.measure.commandsRefused),
        cell.band === null ? 'sem faixa' : cell.violations.length === 0 ? 'dentro' : '**fora**',
      ]),
    );
    const banded = cells.filter((cell) => cell.band !== null);
    const bands =
      banded.length === 0
        ? ''
        : `\n\nFaixas cobradas:\n\n${table(
            [
              'Ritmo',
              'Perfil',
              'População',
              'Salão',
              'Fome (h)',
              'Frio (h)',
              ...SURPLUS_RESOURCES.map(surplusTitle),
              STREAK_TITLE,
              'Recusas',
            ],
            banded.flatMap(({ band, paceLabel, profile }) =>
              band === null
                ? []
                : [
                    [
                      paceLabel,
                      profile.label,
                      `${band.villagers.min} a ${band.villagers.max}`,
                      `≥ ${band.townHallMin}`,
                      `≤ ${formatInt(band.famineHoursMax)}`,
                      `≤ ${formatInt(band.coldHoursMax)}`,
                      ...SURPLUS_RESOURCES.map((id) => `≤ ${formatInt(band.surplusMax[id])}`),
                      `≤ ${formatInt(band.wasteStreakMax)}`,
                      '0',
                    ],
                  ],
            ),
          )}`;
    const profileOf = (cell: MatrixCell) => cell.profile.label;
    const progress = table(
      [
        'Ritmo',
        'Perfil',
        ...MILESTONES.map(({ label }) => `${label} (h)`),
        'Fim das obras (h)',
        'Obras que começaram sozinhas',
        'População mínima',
        'Objetivos concluídos',
        'Último objetivo (h)',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        ...MILESTONES.map(({ id }) => formatOptional(cell.measure.milestones[id] ?? NEVER)),
        formatOptional(cell.measure.exhaustedAtHour),
        formatRange(cell.measure.autoStarted),
        formatRange(cell.measure.villagersMin),
        formatRange(cell.measure.objectivesDone),
        formatOptional(cell.measure.objectivesAllDoneAtHour),
      ]),
    );
    const waste = table(
      [
        'Ritmo',
        'Perfil',
        ...WASTE_RESOURCES.map(wasteShareTitle),
        ...WASTE_RESOURCES.map(streakTitle),
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        ...WASTE_RESOURCES.map((id) => formatOptional(cell.measure.wastedPercent[id], '%')),
        ...WASTE_RESOURCES.map((id) => formatHoursRange(cell.measure.wasteStreak[id])),
      ]),
    );
    const raids = table(
      [
        'Ritmo',
        'Perfil',
        'Incursões sofridas',
        'Incursões repelidas',
        'Anunciadas pela Torre',
        'Feridos',
        'Comida levada',
        'Madeira levada',
        'Ameaça no fim',
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        formatRange(cell.measure.raids.suffered),
        formatRange(cell.measure.raids.repelled),
        formatRange(cell.measure.raids.announced),
        formatRange(cell.measure.raids.injured),
        formatRange(cell.measure.raids.lostFood),
        formatRange(cell.measure.raids.lostWood),
        formatRange(cell.measure.raids.threatFinal),
      ]),
    );
    const guild = table(
      [
        'Ritmo',
        'Perfil',
        'Heróis no fim',
        'Contratados',
        'Partiram sem soldo',
        'Soldo em atraso (h)',
        'Primeiro herói (h)',
        'Taverna (nível)',
        'Taverna pronta (h)',
        'Festivais',
        surplusTitle('gold'),
      ],
      cells.map((cell) => [
        cell.paceLabel,
        profileOf(cell),
        formatRange(cell.measure.guild.heroes),
        formatRange(cell.measure.guild.hired),
        formatRange(cell.measure.guild.departed),
        formatRange(cell.measure.guild.arrearsHours),
        formatOptional(cell.measure.guild.firstHeroAtHour),
        formatRange(cell.measure.guild.tavernLevel),
        formatOptional(cell.measure.guild.tavernAtHour),
        formatRange(cell.measure.guild.festivals),
        formatRange(cell.measure.surplus.gold),
      ]),
    );
    return [
      `## ${window.label}\n\n${measures}${bands}`,
      `### Progresso: ${window.label.toLowerCase()}\n\n${progress}`,
      `### Desperdício por recurso: ${window.label.toLowerCase()}\n\n${waste}`,
      `### Lobos: ${window.label.toLowerCase()}\n\n${raids}`,
      `### Guilda: ${window.label.toLowerCase()}\n\n${guild}`,
      `### Expedições: ${window.label.toLowerCase()}\n\n${expeditionTables(cells)}`,
      `### Mercado: ${window.label.toLowerCase()}\n\n${marketTable(cells)}`,
      `### Ouro por fonte e por destino: ${window.label.toLowerCase()}\n\n${goldTable(cells)}`,
      ...(speculationTable(cells) === null
        ? []
        : [`### Especulação: ${window.label.toLowerCase()}\n\n${speculationTable(cells) ?? ''}`]),
      `### Mestres: ${window.label.toLowerCase()}\n\n${mastersTable(cells)}`,
    ].join('\n\n');
  });

  const verdict =
    violations.length === 0
      ? unbanded === result.cells.length
        ? 'Nenhuma faixa definida para esta rodada.'
        : 'Todas as partidas dentro das faixas.'
      : [
          '**Fora da faixa:**',
          '',
          ...violations.map((text) => `- ${text}`),
          '',
          'Se a mudança não era para mexer na economia, é uma regressão: o ajuste é nos números de `@lotg/content`, nunca no bot. Se era, confira o que mudou, copie a linha de base abaixo para `MEASURED` e registre a rodada em `docs/balance-v0.2.md`.',
        ].join('\n');

  const goal = wasteGoalCells(result.cells);
  const windowLabel = (id: WindowId) => WINDOWS.find((window) => window.id === id)?.label ?? id;
  const goalSection = [
    '## Meta de desperdício',
    '',
    `GDD §15.2, na leitura do ADR 0013 (decisão 17): com ${WASTE_STREAK_GOAL.sessionsPerDay} sessões por dia, nenhum recurso passa de ${WASTE_STREAK_GOAL.gameHours} h de jogo seguidas indo ao chão. A medida é a maior sequência de horas reais em que o desperdício acumulado do recurso subiu, vezes o ritmo; cada hora conta inteira. É uma meta, não uma faixa: uma célula acima dela não reprova a rodada, e fica aqui à vista até o balanceamento a trazer para dentro.`,
    '',
    table(
      ['Janela', 'Ritmo', 'Perfil', ...WASTE_RESOURCES.map(streakTitle), 'Meta', 'Veredito'],
      goal.map(({ cell, met }) => [
        windowLabel(cell.window),
        cell.paceLabel,
        cell.profile.label,
        ...WASTE_RESOURCES.map((id) => formatHoursRange(cell.measure.wasteStreak[id])),
        `≤ ${WASTE_STREAK_GOAL.gameHours}`,
        met ? 'dentro' : '**acima**',
      ]),
    ),
  ].join('\n');

  return [
    '# Matriz de balanceamento',
    '',
    `${identityLine()} · dificuldade ${result.difficultyLabel} (${result.difficulty}) · ${seedsLine(result.seeds)}`,
    '',
    'Cada célula traz o menor e o maior valor entre as sementes (um número só quando são iguais). Horas são reais, amostradas ao fim de cada hora; estoques e desperdício em unidades, cada recurso por si. O desperdício é o que não coube no depósito na partida inteira; "Desperdiçando" são as horas com ao menos um depósito cheio e perdendo produção; "Maior sequência desperdiçando" é, do pior recurso de cada partida, a maior sequência de horas seguidas indo ao chão, em horas de jogo. "Moral mínima" é a menor moral de cada partida; "Moral baixa", as horas com o povo inquieto ou desesperado; "Foram embora", os aldeões que partiram ou desertaram.',
    '',
    'Nas tabelas de progresso, cada marco traz a hora real, desde a fundação, em que o edifício chegou ao nível (— é "não chegou na partida"); "Fim das obras" é a hora em que o feudo ficou sem nada em obras e sem nada que ainda possa construir, até o fim da partida (— é "ainda havia o que construir"). Nas de desperdício por recurso, a parte perdida é o desperdício sobre a produção bruta do mesmo recurso (— sem produção), e a sequência é a maior de cada recurso, em horas de jogo.',
    '',
    sections.join('\n\n'),
    '',
    verdict,
    '',
    goalSection,
    '',
    '## Linha de base medida nesta rodada',
    '',
    'No formato da tabela `MEASURED` de `packages/sim-cli/src/bands.ts`:',
    '',
    '```ts',
    baselineLines(result.cells),
    '```',
    '',
  ].join('\n');
}

const runColumns: Array<[string, (run: MatrixRun, difficulty: DifficultyId) => string | number]> = [
  ['window', (run) => run.window],
  ['time_scale', (run) => run.timeScale],
  ['profile', (run) => run.profile.id],
  ['strategy', (run) => run.profile.strategy],
  ['sessions_per_day', (run) => run.profile.sessionsPerDay],
  ['difficulty', (_, difficulty) => difficulty],
  ['seed', (run) => run.seed],
  ['real_hours', (run) => run.realHours],
  ['game_years', (run) => gameYearsIn(run.realHours, run.timeScale)],
  ['villagers', (run) => run.summary.villagers],
  ['capacity', (run) => run.summary.capacity],
  ['town_hall', (run) => run.summary.townHall],
  ['famine_hours', (run) => run.summary.famineHours],
  ['queue_idle_hours', (run) => run.summary.queueIdleHours],
  ['planned_idle_hours', (run) => run.summary.plannedIdleHours],
  ['free_villager_hours', (run) => run.summary.freeVillagerHours],
  // A maior sequência desperdiçando um recurso (o pior deles), em horas de jogo.
  ['waste_streak_game_hours', (run) => worstWasteStreak(run.summary).gameHours],
  // A de cada recurso, e a parte da produção bruta dele que foi ao chão (vazio sem produção).
  ...WASTE_RESOURCES.map((id): [string, (run: MatrixRun) => string | number] => [
    `waste_streak_${id}`,
    (run) => run.summary.wasteStreakGameHours[id],
  ]),
  ...WASTE_RESOURCES.map((id): [string, (run: MatrixRun) => string | number] => [
    `wasted_${id}_percent`,
    (run) => run.summary.wastedPercent[id] ?? '',
  ]),
  // Progresso: a menor população, a hora real de cada marco e a do fim das obras (vazio é "não
  // chegou"), e as obras que começaram sozinhas.
  ['villagers_min', (run) => run.summary.villagersMin],
  ...MILESTONES.map(({ id, column }): [string, (run: MatrixRun) => string | number] => [
    column,
    (run) => run.summary.milestones[id] ?? '',
  ]),
  ['exhausted_hour', (run) => run.summary.exhaustedAtHour ?? ''],
  ['auto_started', (run) => run.summary.autoStarted],
  ['objectives_done_hour', (run) => run.summary.objectives.allDoneAtHour ?? ''],
  ['villagers_lost', (run) => run.summary.villagersLeft + run.summary.villagersDeserted],
  ...RESOURCE_IDS.map((id): [string, (run: MatrixRun) => number] => [
    id,
    (run) => run.summary.stock[id],
  ]),
  ['commands_accepted', (run) => run.summary.commandsAccepted],
  ['commands_refused', (run) => run.summary.commandsRefused],
  ['refused_by_code', (run) => refusedByCode(run.summary.refusedByCode)],
  ...runMechanicColumns.map(([name, pick]): [string, (run: MatrixRun) => string | number] => [
    name,
    (run) => pick(run.summary),
  ]),
];

/** CSV da matriz: uma linha por partida (janela, ritmo, perfil, semente), com os valores finais. */
export function matrixCsv(result: MatrixResult): string {
  const header = runColumns.map(([name]) => name).join(',');
  const lines = result.runs.map((run) =>
    runColumns.map(([, pick]) => pick(run, result.difficulty)).join(','),
  );
  return `${[header, ...lines].join('\n')}\n`;
}
