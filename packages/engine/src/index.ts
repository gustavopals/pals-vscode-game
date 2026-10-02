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
  EnemyId,
  FirewoodView,
  FoodForecastView,
  GameEvent,
  GameEventType,
  GameSettings,
  GameState,
  InjuredVillager,
  MapTile,
  MoraleBandId,
  MoraleEffect,
  MoraleLevelView,
  MoraleTermId,
  MoraleView,
  ObjectiveTarget,
  ObjectiveView,
  PendingDecisionView,
  PlannedConstruction,
  PlannedUpgradeView,
  PlannedWaitingView,
  ProductionBuildingId,
  RaidSizeId,
  Rejection,
  RejectionCode,
  ResourceCostView,
  ResourceId,
  ScheduledRaid,
  SeasonId,
  ThreatDefenseView,
  ThreatIncomingView,
  ThreatView,
  ThreatWatchtowerView,
  TileTypeId,
  UpgradeView,
  ViewState,
} from './types';
