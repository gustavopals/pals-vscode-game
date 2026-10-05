export const SIM_CLI_VERSION = '0.2.0';

export { idleQueue, simulate, strategies } from './simulate';
export type { HourRow, SimulationOptions, SimulationResult, StrategyName } from './simulate';
export { formatSummary, RESERVED_COLUMNS, summarize, SURPLUS_RESOURCES, toCsv } from './report';
export type { Summary, SurplusResource } from './report';
export { botOf } from './bots/types';
export type { Act, Bot, Policy } from './bots/types';
export { botFor, strategyPolicies } from './bots';
export { IDENTITY, identityLine } from './identity';
export {
  formatMatrix,
  MATRIX_SEEDS,
  matrixCsv,
  PROFILES,
  runMatrix,
  windowRealHours,
  WINDOWS,
} from './matrix';
export type {
  CellMeasure,
  MatrixCell,
  MatrixOptions,
  MatrixResult,
  MatrixRun,
  Profile,
  ProfileId,
  Range,
  WindowId,
} from './matrix';
export { formatCoverage, measureCoverage } from './coverage';
export type { Coverage } from './coverage';
export { bandFor, cellKey, checkBand, SLACK } from './bands';
export type { Band, CellKey } from './bands';
export { formatPerf, PERF_SCENARIOS, runPerf } from './perf';
export type { PerfMeasure, PerfOptions, PerfReport } from './perf';
export { formatRemoteReport, runRemote } from './remote';
export type { EndpointStats, RemoteOptions, RemoteReport } from './remote';
export { parseCli, USAGE } from './cli';
export type { CliCommand } from './cli';
export { formatSmokeReport, runSmoke } from './smoke';
export type { SmokeCheck, SmokeCleanup, SmokeOptions, SmokeReport } from './smoke';
