import { BUILDING_IDS, RESOURCE_IDS } from '@lotg/content';

import type { HourRow, SimulationResult } from './simulate';

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
];

/** CSV com cabeçalho e uma linha por hora real. */
export function toCsv(rows: HourRow[]): string {
  const header = columns.map(([name]) => name).join(',');
  const lines = rows.map((row) => columns.map(([, pick]) => pick(row)).join(','));
  return `${[header, ...lines].join('\n')}\n`;
}

export type Summary = {
  hours: number;
  villagers: number;
  capacity: number;
  townHall: number;
  famineHours: number;
  firstFamineHour: number | null;
  commandsAccepted: number;
  commandsRefused: number;
};

export function summarize(result: SimulationResult): Summary {
  const last = result.rows[result.rows.length - 1];
  const hungry = result.rows.filter((row) => row.famine);
  return {
    hours: result.rows.length,
    villagers: last?.villagers ?? 0,
    capacity: last?.capacity ?? 0,
    townHall: last?.levels.townHall ?? 0,
    famineHours: hungry.length,
    firstFamineHour: hungry[0]?.hour ?? null,
    commandsAccepted: result.commands.accepted,
    commandsRefused: Object.values(result.commands.refused).reduce((sum, count) => sum + count, 0),
  };
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
  return [
    `Semente ${options.seed} · estratégia ${options.strategy} · ${options.days} dias · ${options.sessionsPerDay} sessões/dia`,
    `População: ${summary.villagers} de ${summary.capacity} vagas`,
    `Níveis: ${levels}`,
    `Estoque: ${stock}`,
    summary.famineHours === 0
      ? 'Fome: nenhuma'
      : `Fome: ${summary.famineHours} h, a primeira na hora ${summary.firstFamineHour}`,
    `Comandos: ${summary.commandsAccepted} aceitos, ${summary.commandsRefused} recusados${refused ? ` (${refused})` : ''}`,
    '',
  ].join('\n');
}
