import {
  BUILDING_IDS,
  type GameEventType,
  type MoraleBandId,
  RESOURCE_IDS,
  type ResourceId,
} from '@lotg/content';

import { strategyPolicies } from './bots';
import { identityLine } from './identity';
import { type HourRow, realHoursOf, type SimulationResult } from './simulate';

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
  { name: 'wolf_losses', task: 'V2E-T3', meaning: 'Perdas em incursões de lobos, acumuladas' },
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
};

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
    `População: ${summary.villagers} de ${summary.capacity} vagas`,
    `Níveis: ${levels}`,
    `Estoque: ${stock}`,
    summary.famineHours === 0
      ? 'Fome: nenhuma'
      : `Fome: ${summary.famineHours} h, a primeira na hora ${summary.firstFamineHour}`,
    summary.coldHours === 0
      ? 'Frio: nenhum'
      : `Frio: ${summary.coldHours} h, a primeira na hora ${summary.firstColdHour}`,
    moraleLine(summary),
    `Fila ociosa: ${idleLine(summary)}`,
    ...(control === undefined
      ? []
      : [
          `Sem o início automático (as mesmas planejadas, manuais): ${idleLine(summarize(control))}`,
        ]),
    `Aldeões sem ofício: ${summary.freeVillagerHours} aldeão-horas (${formatDecimal(summary.freePerHour)} por hora)`,
    `Excedente parado: ${SURPLUS_RESOURCES.map((id) => `${id} ${summary.surplus[id]}`).join(', ')}`,
    `Desperdício: ${WASTE_RESOURCES.map((id) => `${id} ${summary.wasted[id]}`).join(', ')} (${summary.wasteHours} h com depósito cheio perdendo produção)`,
    `Maior sequência desperdiçando, em horas de jogo: ${WASTE_RESOURCES.map((id) => `${id} ${formatDecimal(summary.wasteStreakGameHours[id])}`).join(', ')} (meta do GDD §15.2 para ${WASTE_STREAK_GOAL.sessionsPerDay} sessões por dia: até ${WASTE_STREAK_GOAL.gameHours})`,
    `Comandos: ${summary.commandsAccepted} aceitos, ${summary.commandsRefused} recusados${refused ? ` (${refused})` : ''}`,
    'Sem medida até as Fases D e E: cartas do Conselho, perdas por lobos',
    '',
  ].join('\n');
}
