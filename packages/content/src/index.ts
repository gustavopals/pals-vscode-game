export const CONTENT_VERSION = '0.2.0';

export * from './ids';
export { balance } from './balance';
export type {
  Balance,
  CouncilDef,
  CraftDef,
  DifficultyDef,
  MoraleBandDef,
  MoraleDef,
  PaceDef,
  PalisadeLevelDef,
  RaidDamageDef,
  RaidsDef,
  ScriptedRaidDef,
  SeasonDef,
  SeasonEffects,
  StorageDef,
  ThreatDef,
  WatchtowerLevelDef,
} from './balance';
export { buildings } from './buildings';
export type { BuildingDef } from './buildings';
export { objectives, OBJECTIVE_CONDITION_TYPES } from './objectives';
export type { ObjectiveCondition, ObjectiveDef, ObjectiveMoraleReward } from './objectives';
export {
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  coldReliefs,
  craftGuilds,
  cutRewardTemplates,
  EVENT_TYPES,
  foundingTemplates,
  idleVillager,
  injuredLoss,
  injuryTemplates,
  moraleBandTemplates,
  raidTemplates,
  threatMarkTemplates,
} from './chronicle';
export type {
  ChroniclePlaceholder,
  ColdRelief,
  FoundingEventType,
  GameEventType,
  RaidTemplates,
} from './chronicle';
export { COUNCIL_EFFECT_TYPES } from './council';
export type {
  CouncilCard,
  CouncilCardRequires,
  CouncilCardVariant,
  CouncilEffect,
  CouncilEffectType,
  CouncilHiddenOutcome,
  CouncilOption,
  CouncilOptionRequires,
} from './council';
export { councilCards } from './cards';
export { enemies, raidSizes, startingTiles, tileTypes } from './tiles';
export type { EnemyDef, RaidSizeDef, TileTypeDef } from './tiles';
