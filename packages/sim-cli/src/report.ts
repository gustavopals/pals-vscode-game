import {
  balance,
  type BuildingId,
  BUILDING_IDS,
  buildings,
  type GameEventType,
  type MoraleBandId,
  RESOURCE_IDS,
  type ResourceId,
} from '@lotg/content';

import { strategyPolicies } from './bots';
import { identityLine } from './identity';
import { type HourRow, type RaidCounts, realHoursOf, type SimulationResult } from './simulate';

/** Os materiais em que se mede o excedente parado. A comida fica de fora: ela é consumida. */
export const SURPLUS_RESOURCES = RESOURCE_IDS.filter(
  (id): id is Exclude<ResourceId, 'food'> => id !== 'food',
);
export type SurplusResource = (typeof SURPLUS_RESOURCES)[number];

/** As faixas da moral em que o povo reclama: é nelas que se contam as horas de moral baixa. */
const LOW_MORALE_BANDS: readonly MoraleBandId[] = ['desperate', 'restless'];

/** Os recursos em que se mede o desperdício: os que têm limite de estoque (GDD §5.5). */
export const WASTE_RESOURCES = ['food', 'wood', 'stone'] as const satisfies readonly ResourceId[];
export type WasteResource = (typeof WASTE_RESOURCES)[number];

/**
 * A meta de desperdício do GDD §15.2, como o ADR 0013 (decisão 17) a lê: o perfil Regular (2
 * sessões por dia) não passa de tantas **horas de jogo contínuas** desperdiçando um recurso. É
 * uma meta de balanceamento, não uma regra do jogo: nada no motor a conhece.
 */
export const WASTE_STREAK_GOAL = { sessionsPerDay: 2, gameHours: 8 } as const;

/**
 * A maior sequência de horas reais seguidas em que o desperdício acumulado de um recurso subiu.
 * Sai das mesmas amostras do CSV (`wasted_<recurso>`, uma por hora real): quem tem o CSV refaz a
 * conta. A hora conta inteira quando o acumulado sobe ao menos uma unidade dentro dela, então a
 * medida arredonda para cima as pontas da sequência (até uma hora real em cada ponta) e não vê
 * um desperdício menor que uma unidade por hora.
 */
export function longestWasteStreak(rows: readonly HourRow[], resource: WasteResource): number {
  let longest = 0;
  let current = 0;
  let previous = 0;
  for (const row of rows) {
    current = row.wasted[resource] > previous ? current + 1 : 0;
    longest = Math.max(longest, current);
    previous = row.wasted[resource];
  }
  return longest;
}

/** O recurso com a maior sequência desperdiçando de uma partida; no empate, o primeiro da ordem. */
export function worstWasteStreak(summary: Pick<Summary, 'wasteStreakGameHours'>): {
  resource: WasteResource;
  gameHours: number;
} {
  return WASTE_RESOURCES.map((resource) => ({
    resource,
    gameHours: summary.wasteStreakGameHours[resource],
  })).reduce((worst, entry) => (entry.gameHours > worst.gameHours ? entry : worst));
}

/**
 * Os marcos de progresso que a rodada de balanceamento acompanha (roadmap da v0.2, §7.3,
 * "Progresso alcançável"): cada nível do Salão até o que abre a segunda fila de obras, e o
 * Celeiro e o Armazém erguidos. A hora de cada um diz se o caminho de compras existe e quanto
 * ele demora; `null` é "não chegou lá na partida".
 */
const townHallMilestones = Array.from(
  { length: balance.construction.secondQueueTownHallLevel - buildings.townHall.initialLevel },
  (_, index) => {
    const level = buildings.townHall.initialLevel + index + 1;
    return {
      id: `townHall${level}`,
      column: `town_hall_${level}_hour`,
      building: 'townHall' as BuildingId,
      level,
      label: `Salão Nv${level}`,
    };
  },
);
export const MILESTONES: ReadonlyArray<{
  id: string;
  /** Nome da coluna no CSV da matriz. */
  column: string;
  building: BuildingId;
  level: number;
  label: string;
}> = [
  ...townHallMilestones,
  { id: 'granary', column: 'granary_hour', building: 'granary', level: 1, label: 'Celeiro' },
  { id: 'warehouse', column: 'warehouse_hour', building: 'warehouse', level: 1, label: 'Armazém' },
  {
    id: 'watchtower',
    column: 'watchtower_hour',
    building: 'watchtower',
    level: 1,
    label: 'Torre de Vigia',
  },
  { id: 'palisade', column: 'palisade_hour', building: 'palisade', level: 1, label: 'Paliçada' },
];

/** A primeira hora real em que o edifício aparece no nível pedido; `null` se não chegou. */
function hourOfLevel(rows: readonly HourRow[], building: BuildingId, level: number): number | null {
  return rows.find((row) => row.levels[building] >= level)?.hour ?? null;
}

/**
 * A hora real em que as obras acabaram de vez: a primeira da sequência final de horas com o
 * feudo sem nada em obras e sem nada que ainda possa construir (`HourRow.exhausted`). `null`
 * quando a partida termina com obra em curso ou por fazer.
 */
export function exhaustedSince(rows: readonly HourRow[]): number | null {
  let since: number | null = null;
  for (const row of rows) {
    since = row.exhausted ? (since ?? row.hour) : null;
  }
  return since;
}

/**
 * Quanto da produção de um recurso foi ao chão, em por cento: o desperdício da partida sobre a
 * produção bruta do mesmo recurso, somada hora a hora (`HourRow.gross`, uma amostra ao fim de
 * cada hora). Cada recurso por si, nunca somados; `null` sem produção ("não se aplica").
 */
function wastedPercent(rows: readonly HourRow[], resource: WasteResource): number | null {
  const produced = rows.reduce((sum, row) => sum + row.gross[resource], 0);
  const wasted = rows[rows.length - 1]?.wasted[resource] ?? 0;
  // A amostra é do fim da hora: em uma partida curta o desperdício pode passar dela.
  return produced <= 0 ? null : Math.min(100, Math.round((wasted * 100) / produced));
}

/**
 * As colunas das mecânicas da v0.2, na ordem fixa em que fecham o cabeçalho dos dois CSVs: o de
 * uma partida (hora a hora) e o da matriz (uma linha por partida). O cabeçalho já existe, para
 * o formato não mudar a cada mecânica.
 */
const MECHANIC_COLUMNS = [
  { name: 'wasted_food', task: 'V2C-T2', meaning: 'Comida desperdiçada no cap, acumulada' },
  { name: 'wasted_wood', task: 'V2C-T2', meaning: 'Madeira desperdiçada no cap, acumulada' },
  { name: 'wasted_stone', task: 'V2C-T2', meaning: 'Pedra desperdiçada no cap, acumulada' },
  {
    name: 'cold',
    task: 'V2C-T1',
    meaning: '`1` se o feudo passa frio naquela hora; na matriz, as horas de frio da partida',
  },
  {
    name: 'morale',
    task: 'V2C-T4',
    meaning: 'Moral do feudo naquela hora, de 0 a 100; na matriz, a menor moral da partida',
  },
  { name: 'cards_seen', task: 'V2D-T1', meaning: 'Cartas do Conselho recebidas, acumuladas' },
  { name: 'cards_answered', task: 'V2D-T1', meaning: 'Cartas respondidas pelo bot, acumuladas' },
  { name: 'cards_expired', task: 'V2D-T1', meaning: 'Cartas que expiraram, acumuladas' },
  {
    name: 'threat',
    task: 'V2E-T1',
    meaning:
      'Ameaça do feudo naquela hora, de 0 a 100, lida do estado; na matriz, a maior da partida',
  },
  {
    name: 'wolf_losses',
    task: 'V2E-T3',
    meaning: 'Comida e madeira que as incursões de lobos levaram, somadas, em unidades, acumuladas',
  },
  { name: 'raids_suffered', task: 'V2E-T3', meaning: 'Incursões sofridas, acumuladas' },
  { name: 'raids_repelled', task: 'V2E-T3', meaning: 'Incursões repelidas, acumuladas' },
  {
    name: 'villagers_injured',
    task: 'V2E-T3',
    meaning: 'Aldeões feridos em incursões, acumulados',
  },
] as const;
type MechanicColumn = (typeof MECHANIC_COLUMNS)[number]['name'];

/**
 * As colunas que já são medidas: o valor de uma hora (CSV de uma partida) e o de uma partida
 * inteira (CSV da matriz). Cada tarefa acrescenta a sua aqui, lendo da visão.
 */
const MEASURED_COLUMNS: Partial<
  Record<
    MechanicColumn,
    { hour: (row: HourRow) => string | number; run: (summary: Summary) => string | number }
  >
> = {
  wasted_food: { hour: (row) => row.wasted.food, run: (summary) => summary.wasted.food },
  wasted_wood: { hour: (row) => row.wasted.wood, run: (summary) => summary.wasted.wood },
  wasted_stone: { hour: (row) => row.wasted.stone, run: (summary) => summary.wasted.stone },
  cold: { hour: (row) => (row.cold ? 1 : 0), run: (summary) => summary.coldHours },
  // No CSV de uma partida, a moral daquela hora; no da matriz, a menor da partida: é a que diz
  // se o feudo chegou perto de perder gente.
  morale: { hour: (row) => row.morale, run: (summary) => summary.moraleMin },
  // O Conselho, contado dos eventos: acumulado até a hora, e o total da partida na matriz.
  cards_seen: { hour: (row) => row.cards.seen, run: (summary) => summary.cards.drawn },
  cards_answered: { hour: (row) => row.cards.answered, run: (summary) => summary.cards.answered },
  cards_expired: { hour: (row) => row.cards.expired, run: (summary) => summary.cards.expired },
  // A Ameaça, lida do estado (a visão só a mostra com a Torre de Vigia): a daquela hora e, na
  // matriz, a maior da partida.
  threat: { hour: (row) => row.threat, run: (summary) => summary.threat.max },
  // As incursões, contadas dos eventos: acumuladas até a hora, e o total da partida na matriz.
  wolf_losses: {
    hour: (row) => raidLosses(row.raids),
    run: (summary) => summary.raids.losses,
  },
  raids_suffered: { hour: (row) => row.raids.suffered, run: (summary) => summary.raids.suffered },
  raids_repelled: { hour: (row) => row.raids.repelled, run: (summary) => summary.raids.repelled },
  villagers_injured: { hour: (row) => row.raids.injured, run: (summary) => summary.raids.injured },
};

/** O que as incursões levaram, somados os recursos, em unidades inteiras. */
function raidLosses(raids: RaidCounts): number {
  return Math.round(RESOURCE_IDS.reduce((sum, id) => sum + raids.lost[id], 0));
}

/**
 * Colunas que as tarefas seguintes do roadmap da v0.2 vão preencher. O valor sai **vazio** (e
 * não zero: zero seria uma medida) até a tarefa indicada medir a coluna em `MEASURED_COLUMNS`.
 */
export const RESERVED_COLUMNS = MECHANIC_COLUMNS.filter(
  (column) => MEASURED_COLUMNS[column.name] === undefined,
);

/** Os nomes das colunas das mecânicas, na ordem do cabeçalho. */
export const MECHANIC_COLUMN_NAMES: readonly string[] = MECHANIC_COLUMNS.map(({ name }) => name);

/** As colunas das mecânicas para o CSV de uma partida: vazio enquanto ninguém as mede. */
const hourMechanicColumns = MECHANIC_COLUMNS.map(
  ({ name }): [string, (row: HourRow) => string | number] => [
    name,
    (row) => MEASURED_COLUMNS[name]?.hour(row) ?? '',
  ],
);

/** As colunas das mecânicas para o CSV da matriz: o valor da partida inteira. */
export const runMechanicColumns = MECHANIC_COLUMNS.map(
  ({ name }): [string, (summary: Summary) => string | number] => [
    name,
    (summary) => MEASURED_COLUMNS[name]?.run(summary) ?? '',
  ],
);

/** `QUEUE_BUSY:2;HOUSING_FULL:1`, em ordem alfabética de código; vazio sem recusas. */
export function refusedByCode(refused: Record<string, number>): string {
  return Object.keys(refused)
    .sort()
    .map((code) => `${code}:${refused[code]}`)
    .join(';');
}

function total(counts: Record<string, number>): number {
  return Object.values(counts).reduce((sum, count) => sum + count, 0);
}

const columns: Array<[string, (row: HourRow) => string | number]> = [
  ['hour', (row) => row.hour],
  ['real_day', (row) => row.realDay],
  ['year', (row) => row.year],
  ['season', (row) => row.season],
  ['day_of_season', (row) => row.dayOfSeason],
  ...RESOURCE_IDS.map((id): [string, (row: HourRow) => number] => [id, (row) => row.stock[id]]),
  ...RESOURCE_IDS.map((id): [string, (row: HourRow) => number] => [
    `${id}_per_hour`,
    (row) => row.perHour[id],
  ]),
  ['villagers', (row) => row.villagers],
  ['capacity', (row) => row.capacity],
  ['free', (row) => row.free],
  ['in_training', (row) => row.inTraining],
  ...BUILDING_IDS.map((id): [string, (row: HourRow) => number] => [id, (row) => row.levels[id]]),
  ['famine', (row) => (row.famine ? 1 : 0)],
  ['queue_idle', (row) => (row.queueIdle ? 1 : 0)],
  ['planned_idle', (row) => (row.plannedIdle ? 1 : 0)],
  ['commands_accepted', (row) => row.commandsAccepted],
  ['commands_refused', (row) => total(row.commandsRefused)],
  ['refused_by_code', (row) => refusedByCode(row.commandsRefused)],
  ...hourMechanicColumns,
];

/** CSV com cabeçalho e uma linha por hora real; as colunas `*_per_hour` são por hora real. */
export function toCsv(rows: HourRow[]): string {
  const header = columns.map(([name]) => name).join(',');
  const lines = rows.map((row) => columns.map(([, pick]) => pick(row)).join(','));
  return `${[header, ...lines].join('\n')}\n`;
}

/** O que uma partida simulada mediu. As horas são reais, uma amostra ao fim de cada hora. */
export type Summary = {
  hours: number;
  villagers: number;
  /** A menor população que o feudo teve, entre as amostras de cada hora. */
  villagersMin: number;
  capacity: number;
  townHall: number;
  famineHours: number;
  firstFamineHour: number | null;
  /** Horas com o feudo passando frio: a lenha acabou no inverno. */
  coldHours: number;
  firstColdHour: number | null;
  /** A moral no fim da partida, de 0 a 100. */
  morale: number;
  /** A menor moral que o feudo teve, entre as amostras de cada hora. */
  moraleMin: number;
  /** Horas com a moral nas duas faixas de baixo: o povo inquieto ou desesperado. */
  lowMoraleHours: number;
  /** Colonos que chegaram sozinhos, atraídos pela moral alta. */
  settlersArrived: number;
  /** Aldeões que foram embora: os que partiram com a moral baixa e os que desertaram na fome. */
  villagersLeft: number;
  villagersDeserted: number;
  commandsAccepted: number;
  commandsRefused: number;
  refusedByCode: Record<string, number>;
  /** Horas com a fila de obras livre e ao menos uma obra que poderia começar. */
  queueIdleHours: number;
  /** Idem, contando só as obras planejadas. */
  plannedIdleHours: number;
  /** Soma, hora a hora, dos aldeões sem ofício: aldeão-horas. */
  freeVillagerHours: number;
  /** Média de aldeões sem ofício por hora, com uma casa decimal. */
  freePerHour: number;
  /** Excedente parado: o estoque final de cada material, em unidades. Nunca somado. */
  surplus: Record<SurplusResource, number>;
  /** Desperdício da partida inteira: o que não coube no depósito, em unidades, por recurso. */
  wasted: Record<WasteResource, number>;
  /** Horas com ao menos um depósito cheio e perdendo produção. */
  wasteHours: number;
  /**
   * A maior sequência desperdiçando cada recurso, em **horas de jogo**: as horas reais seguidas
   * de `longestWasteStreak` vezes o ritmo da partida. É a medida da meta de `WASTE_STREAK_GOAL`.
   */
  wasteStreakGameHours: Record<WasteResource, number>;
  /**
   * Quanto da produção bruta de cada recurso foi ao chão, em por cento; `null` sem produção.
   * Cada recurso por si: nunca se somam recursos diferentes em um percentual.
   */
  wastedPercent: Record<WasteResource, number | null>;
  /** A hora real de cada marco de `MILESTONES`, pelo `id`; `null` se a partida não chegou lá. */
  milestones: Record<string, number | null>;
  /** A hora real em que as obras acabaram de vez (`exhaustedSince`); `null` se não acabaram. */
  exhaustedAtHour: number | null;
  /** Obras que começaram sozinhas, entre as visitas: as planejadas automáticas (GDD §6.3). */
  autoStarted: number;
  /**
   * O Conselho (GDD §7): cartas que chegaram (e, delas, as que vieram como continuação de uma
   * escolha), as que o bot respondeu, as que expiraram e os efeitos escondidos que aconteceram.
   */
  cards: {
    drawn: number;
    continuations: number;
    answered: number;
    expired: number;
    hidden: number;
  };
  /**
   * A Ameaça (GDD §8.2), lida do estado: a do fim da partida, a maior entre as amostras de cada
   * hora, e o nível final da Torre de Vigia. A hora em que a Torre ficou pronta é um marco.
   */
  threat: { final: number; max: number; watchtower: number };
  /**
   * As incursões (GDD §8.2), contadas dos eventos: as sofridas, as repelidas, as que a Torre
   * anunciou, os feridos, o que os lobos levaram de cada recurso (em unidades inteiras) e a
   * soma disso; e o nível final da Paliçada. A hora em que ela ficou pronta é um marco.
   */
  raids: {
    suffered: number;
    repelled: number;
    announced: number;
    injured: number;
    lost: Record<ResourceId, number>;
    losses: number;
    palisade: number;
  };
  /** Estoque final de cada recurso, em unidades. */
  stock: Record<ResourceId, number>;
};

export function summarize(result: SimulationResult): Summary {
  const { rows, options } = result;
  const last = rows[rows.length - 1];
  const hungry = rows.filter((row) => row.famine);
  const freezing = rows.filter((row) => row.cold);
  const uneasy = rows.filter((row) => LOW_MORALE_BANDS.includes(row.moraleBand));
  const happened = (type: GameEventType) =>
    result.events.filter((event) => event.type === type).length;
  const freeVillagerHours = rows.reduce((sum, row) => sum + row.free, 0);
  const stock = Object.fromEntries(RESOURCE_IDS.map((id) => [id, last?.stock[id] ?? 0])) as Record<
    ResourceId,
    number
  >;
  return {
    hours: rows.length,
    villagers: last?.villagers ?? 0,
    villagersMin: rows.reduce(
      (lowest, row) => Math.min(lowest, row.villagers),
      last?.villagers ?? 0,
    ),
    capacity: last?.capacity ?? 0,
    townHall: last?.levels.townHall ?? 0,
    famineHours: hungry.length,
    firstFamineHour: hungry[0]?.hour ?? null,
    coldHours: freezing.length,
    firstColdHour: freezing[0]?.hour ?? null,
    morale: last?.morale ?? 0,
    moraleMin: rows.reduce((lowest, row) => Math.min(lowest, row.morale), last?.morale ?? 0),
    lowMoraleHours: uneasy.length,
    settlersArrived: happened('villagerArrived'),
    villagersLeft: happened('villagerLeft'),
    villagersDeserted: happened('villagerDeserted'),
    commandsAccepted: result.commands.accepted,
    commandsRefused: total(result.commands.refused),
    refusedByCode: { ...result.commands.refused },
    queueIdleHours: rows.filter((row) => row.queueIdle).length,
    plannedIdleHours: rows.filter((row) => row.plannedIdle).length,
    freeVillagerHours,
    freePerHour: rows.length === 0 ? 0 : Math.round((freeVillagerHours * 10) / rows.length) / 10,
    surplus: Object.fromEntries(SURPLUS_RESOURCES.map((id) => [id, stock[id]])) as Record<
      SurplusResource,
      number
    >,
    wasted: Object.fromEntries(WASTE_RESOURCES.map((id) => [id, last?.wasted[id] ?? 0])) as Record<
      WasteResource,
      number
    >,
    wasteHours: rows.filter((row) => row.wasting).length,
    wasteStreakGameHours: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, longestWasteStreak(rows, id) * (options.timeScale ?? 1)]),
    ) as Record<WasteResource, number>,
    wastedPercent: Object.fromEntries(
      WASTE_RESOURCES.map((id) => [id, wastedPercent(rows, id)]),
    ) as Record<WasteResource, number | null>,
    milestones: Object.fromEntries(
      MILESTONES.map(({ id, building, level }) => [id, hourOfLevel(rows, building, level)]),
    ),
    exhaustedAtHour: exhaustedSince(rows),
    autoStarted: happened('constructionAutoStarted'),
    cards: {
      drawn: happened('cardDrawn'),
      continuations: result.events.filter(
        (event) => event.type === 'cardDrawn' && event.data.source === 'continuation',
      ).length,
      answered: happened('cardAnswered'),
      expired: happened('cardExpired'),
      hidden: happened('cardEffectApplied'),
    },
    threat: {
      final: last?.threat ?? 0,
      max: rows.reduce((highest, row) => Math.max(highest, row.threat), 0),
      watchtower: last?.levels.watchtower ?? 0,
    },
    raids: {
      suffered: last?.raids.suffered ?? 0,
      repelled: last?.raids.repelled ?? 0,
      announced: last?.raids.announced ?? 0,
      injured: last?.raids.injured ?? 0,
      lost: Object.fromEntries(
        RESOURCE_IDS.map((id) => [id, Math.round(last?.raids.lost[id] ?? 0)]),
      ) as Record<ResourceId, number>,
      losses: last === undefined ? 0 : raidLosses(last.raids),
      palisade: last?.levels.palisade ?? 0,
    },
    stock,
  };
}

/** Um número com vírgula decimal: `3`, `0,5`. */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

/** "35 h com obra que podia começar (0 h com obra planejada)". */
function idleLine(summary: Summary): string {
  return `${summary.queueIdleHours} h com obra que podia começar (${summary.plannedIdleHours} h com obra planejada)`;
}

/**
 * "Moral: 60 no fim, mínima 40 (12 h com o povo inquieto ou desesperado) · 1 colono, 0
 * partidas, 2 deserções". As horas e a população movida só aparecem quando há o que contar.
 */
function moraleLine(summary: Summary): string {
  const low =
    summary.lowMoraleHours === 0
      ? ''
      : ` (${summary.lowMoraleHours} h com o povo inquieto ou desesperado)`;
  const moved = summary.settlersArrived + summary.villagersLeft + summary.villagersDeserted;
  const people =
    moved === 0
      ? ''
      : ` · colonos ${summary.settlersArrived}, partidas ${summary.villagersLeft}, deserções ${summary.villagersDeserted}`;
  return `Moral: ${summary.morale} no fim, mínima ${summary.moraleMin}${low}${people}`;
}

/**
 * "Conselho: 6 cartas (2 continuações) · 5 respondidas, 1 expirada · 1 efeito escondido". Sem
 * carta nenhuma, diz isso: é o sinal de um catálogo sem assunto para aquele feudo.
 */
function councilLine({ cards }: Summary): string {
  if (cards.drawn === 0) {
    return 'Conselho: nenhuma carta chegou';
  }
  const plural = (count: number, one: string, many: string) =>
    `${count} ${count === 1 ? one : many}`;
  const chained =
    cards.continuations === 0
      ? ''
      : ` (${plural(cards.continuations, 'continuação', 'continuações')})`;
  return [
    `Conselho: ${plural(cards.drawn, 'carta', 'cartas')}${chained}`,
    `${plural(cards.answered, 'respondida', 'respondidas')}, ${plural(cards.expired, 'expirada', 'expiradas')}`,
    plural(cards.hidden, 'efeito escondido', 'efeitos escondidos'),
  ].join(' · ');
}

/**
 * "Ameaça: 100 no fim (máxima 100) · Torre de Vigia Nv2, erguida na hora 61". Sem a Torre, a
 * linha diz que o jogador nunca viu o número que o simulador mede.
 */
function threatLine({ threat, milestones }: Summary): string {
  const level = `Ameaça: ${threat.final} no fim (máxima ${threat.max})`;
  return threat.watchtower === 0
    ? `${level} · sem Torre de Vigia: o jogador nunca a viu`
    : `${level} · Torre de Vigia Nv${threat.watchtower}, erguida na hora ${milestones.watchtower ?? '?'}`;
}

/**
 * "Lobos: 8 incursões sofridas, 9 repelidas (17 anunciadas pela Torre) · levaram comida 360,
 * madeira 590 · 13 feridos · Paliçada Nv2, erguida na hora 76". Sem incursão nenhuma, diz isso.
 */
function raidsLine({ raids, milestones }: Summary): string {
  const wall =
    raids.palisade === 0
      ? 'sem Paliçada'
      : `Paliçada Nv${raids.palisade}, erguida na hora ${milestones.palisade ?? '?'}`;
  if (raids.suffered + raids.repelled === 0) {
    return `Lobos: nenhuma incursão · ${wall}`;
  }
  const taken = RESOURCE_IDS.filter((id) => raids.lost[id] > 0)
    .map((id) => `${id} ${raids.lost[id]}`)
    .join(', ');
  return [
    `Lobos: ${raids.suffered} incursões sofridas, ${raids.repelled} repelidas (${raids.announced} anunciadas pela Torre)`,
    taken === '' ? 'não levaram nada' : `levaram ${taken}`,
    `${raids.injured} feridos`,
    wall,
  ].join(' · ');
}

/**
 * "Progresso: Salão Nv2 na hora 3, Salão Nv3 na hora 9, Salão Nv4 na hora 20, Celeiro na hora
 * 30, Armazém não alcançado · 46 obras começaram sozinhas · as obras acabaram na hora 113: nada
 * mais a construir". As horas são reais, desde a fundação.
 */
function progressLine(summary: Summary): string {
  const marks = MILESTONES.map(({ id, label }) => {
    const hour = summary.milestones[id] ?? null;
    return hour === null ? `${label} não alcançado` : `${label} na hora ${hour}`;
  }).join(', ');
  const end =
    summary.exhaustedAtHour === null
      ? 'ainda há obra por fazer no fim'
      : `as obras acabaram na hora ${summary.exhaustedAtHour}: nada mais a construir`;
  return `Progresso: ${marks} · ${summary.autoStarted} obras começaram sozinhas · ${end}`;
}

/** "food 12%, wood 40%, stone n/a": a parte da produção de cada recurso que foi ao chão. */
function wastedPercentText(summary: Summary): string {
  return WASTE_RESOURCES.map((id) => {
    const percent = summary.wastedPercent[id];
    return `${id} ${percent === null ? 'não se aplica' : `${percent}%`}`;
  }).join(', ');
}

/**
 * O resumo de uma partida. Com `control`, a mesma partida jogada com as planejadas manuais
 * (`manualPlans`), a linha da fila ociosa ganha a comparação: o que o início automático mudou.
 */
export function formatSummary(result: SimulationResult, control?: SimulationResult): string {
  const { options, rows, commands } = result;
  const summary = summarize(result);
  const last = rows[rows.length - 1];
  const levels = last
    ? BUILDING_IDS.map((id) => `${id} ${last.levels[id]}`).join(', ')
    : 'sem dados';
  const stock = last ? RESOURCE_IDS.map((id) => `${id} ${last.stock[id]}`).join(', ') : 'sem dados';
  const refused = Object.entries(commands.refused)
    .map(([code, count]) => `${code} ${count}`)
    .join(', ');
  const duration =
    options.hours === undefined ? `${options.days} dias` : `${realHoursOf(options)} horas reais`;
  return [
    `Semente ${options.seed} · estratégia ${options.strategy} · ${duration} · ${options.sessionsPerDay} sessões/dia · ritmo ${formatDecimal(options.timeScale ?? 1)}×`,
    `Partida: ${result.game.difficultyLabel} · ${result.game.paceLabel}`,
    identityLine(),
    `Políticas: ${strategyPolicies[options.strategy].map((policy) => policy.name).join(', ')}`,
    `População: ${summary.villagers} de ${summary.capacity} vagas (mínima ${summary.villagersMin})`,
    `Níveis: ${levels}`,
    progressLine(summary),
    `Estoque: ${stock}`,
    summary.famineHours === 0
      ? 'Fome: nenhuma'
      : `Fome: ${summary.famineHours} h, a primeira na hora ${summary.firstFamineHour}`,
    summary.coldHours === 0
      ? 'Frio: nenhum'
      : `Frio: ${summary.coldHours} h, a primeira na hora ${summary.firstColdHour}`,
    moraleLine(summary),
    councilLine(summary),
    threatLine(summary),
    raidsLine(summary),
    `Fila ociosa: ${idleLine(summary)}`,
    ...(control === undefined
      ? []
      : [
          `Sem o início automático (as mesmas planejadas, manuais): ${idleLine(summarize(control))}`,
        ]),
    `Aldeões sem ofício: ${summary.freeVillagerHours} aldeão-horas (${formatDecimal(summary.freePerHour)} por hora)`,
    `Excedente parado: ${SURPLUS_RESOURCES.map((id) => `${id} ${summary.surplus[id]}`).join(', ')}`,
    `Desperdício: ${WASTE_RESOURCES.map((id) => `${id} ${summary.wasted[id]}`).join(', ')} (${summary.wasteHours} h com depósito cheio perdendo produção)`,
    `Da produção de cada recurso, foi ao chão: ${wastedPercentText(summary)}`,
    `Maior sequência desperdiçando, em horas de jogo: ${WASTE_RESOURCES.map((id) => `${id} ${formatDecimal(summary.wasteStreakGameHours[id])}`).join(', ')} (meta do GDD §15.2 para ${WASTE_STREAK_GOAL.sessionsPerDay} sessões por dia: até ${WASTE_STREAK_GOAL.gameHours})`,
    `Comandos: ${summary.commandsAccepted} aceitos, ${summary.commandsRefused} recusados${refused ? ` (${refused})` : ''}`,
    '',
  ].join('\n');
}
