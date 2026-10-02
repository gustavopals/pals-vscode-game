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
  ActiveConstructionView,
  BuildingId,
  Command,
  CommandResult,
  CommandType,
  Construction,
  CouncilCardView,
  CouncilOptionView,
  CouncilView,
  DifficultyId,
  FirewoodView,
  FoodForecastView,
  GameEvent,
  GameEventType,
  GameSettings,
  GameState,
  MoraleBandId,
  MoraleEffect,
  MoraleLevelView,
  MoraleTermId,
  MoraleView,
  ObjectiveView,
  PendingDecisionView,
  PlannedConstruction,
  PlannedUpgradeView,
  PlannedWaitingView,
  ProductionBuildingId,
  Rejection,
  RejectionCode,
  ResourceCostView,
  ResourceId,
  SeasonId,
  UpgradeView,
  ViewState,
} from './types';
