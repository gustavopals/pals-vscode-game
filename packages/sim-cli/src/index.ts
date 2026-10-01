export const SIM_CLI_VERSION = '0.1.0';

export { simulate, strategies } from './simulate';
export type { HourRow, SimulationOptions, SimulationResult, StrategyName } from './simulate';
export { formatSummary, summarize, toCsv } from './report';
export type { Summary } from './report';
export type { Act, Bot } from './bots/types';
export { formatRemoteReport, runRemote } from './remote';
export type { EndpointStats, RemoteOptions, RemoteReport } from './remote';
