import { BUILDING_IDS, RESOURCE_IDS, type ResourceId } from '@lotg/content';

import { strategyPolicies } from './bots';
import { identityLine } from './identity';
import { type HourRow, realHoursOf, type SimulationResult } from './simulate';

/** Os materiais em que se mede o excedente parado. A comida fica de fora: ela é consumida. */
export const SURPLUS_RESOURCES = RESOURCE_IDS.filter(
  (id): id is Exclude<ResourceId, 'food'> => id !== 'food',
);
export type SurplusResource = (typeof SURPLUS_RESOURCES)[number];

/**
 * Colunas que as Fases C a E do roadmap da v0.2 vão preencher. O cabeçalho já existe, para o
 * formato do CSV não mudar a cada mecânica; o valor sai **vazio** (e não zero: zero seria uma
 * medida) até a tarefa indicada tirar a coluna daqui e passar a lê-la da visão. Valem para o
 * CSV de uma partida (hora a hora) e para o da matriz (uma linha por partida, valor final).
 */
export const RESERVED_COLUMNS = [
  { name: 'wasted_food', task: 'V2C-T2', meaning: 'Comida desperdiçada no cap, acumulada' },
  { name: 'wasted_wood', task: 'V2C-T2', meaning: 'Madeira desperdiçada no cap, acumulada' },
  { name: 'wasted_stone', task: 'V2C-T2', meaning: 'Pedra desperdiçada no cap, acumulada' },
  { name: 'cold', task: 'V2C-T1', meaning: '`1` se o feudo passa frio naquela hora' },
  { name: 'morale', task: 'V2C-T4', meaning: 'Moral do feudo, de 0 a 100' },
  { name: 'cards_seen', task: 'V2D-T1', meaning: 'Cartas do Conselho recebidas, acumuladas' },
  { name: 'cards_answered', task: 'V2D-T1', meaning: 'Cartas respondidas pelo bot, acumuladas' },
  { name: 'cards_expired', task: 'V2D-T1', meaning: 'Cartas que expiraram, acumuladas' },
  { name: 'wolf_losses', task: 'V2E-T3', meaning: 'Perdas em incursões de lobos, acumuladas' },
] as const;

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
  ...RESERVED_COLUMNS.map(({ name }): [string, () => string] => [name, () => '']),
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
  /** Estoque final de cada recurso, em unidades. */
  stock: Record<ResourceId, number>;
};

export function summarize(result: SimulationResult): Summary {
  const { rows } = result;
  const last = rows[rows.length - 1];
  const hungry = rows.filter((row) => row.famine);
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
    stock,
  };
}

/** Um número com vírgula decimal: `3`, `0,5`. */
export function formatDecimal(value: number): string {
  return String(value).replace('.', ',');
}

export function formatSummary(result: SimulationResult): string {
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
    `Fila ociosa: ${summary.queueIdleHours} h com obra que podia começar (${summary.plannedIdleHours} h com obra planejada)`,
    `Aldeões sem ofício: ${summary.freeVillagerHours} aldeão-horas (${formatDecimal(summary.freePerHour)} por hora)`,
    `Excedente parado: ${SURPLUS_RESOURCES.map((id) => `${id} ${summary.surplus[id]}`).join(', ')}`,
    `Comandos: ${summary.commandsAccepted} aceitos, ${summary.commandsRefused} recusados${refused ? ` (${refused})` : ''}`,
    'Sem medida até as Fases C a E: desperdício por recurso, horas de frio, moral, cartas do Conselho, perdas por lobos',
    '',
  ].join('\n');
}
