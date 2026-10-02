export const ENGINE_VERSION = '0.1.0';

export { createInitialState } from './state';
export {
  CURRENT_SCHEMA_VERSION,
  type MigrationContext,
  migrateState,
  StateMigrationError,
} from './migrations';
export { nextEventAt } from './timeline';
export { advanceTo } from './advance';
export { applyCommand } from './commands';
export { deriveViewState, type ViewOptions } from './view';
export { REJECTION_CODES } from './types';
export type {
  BuildingId,
  Command,
  CommandResult,
  CommandType,
  Construction,
  DifficultyId,
  GameEvent,
  GameEventType,
  GameSettings,
  GameState,
  ObjectiveView,
  PlannedConstruction,
  ProductionBuildingId,
  Rejection,
  RejectionCode,
  ResourceCostView,
  ResourceId,
  SeasonId,
  UpgradeView,
  ViewState,
} from './types';
