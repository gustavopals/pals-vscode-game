export const CONTENT_VERSION = '0.1.0';

export * from './ids';
export { balance } from './balance';
export type {
  Balance,
  CraftDef,
  DifficultyDef,
  MoraleBandDef,
  MoraleDef,
  PaceDef,
  SeasonDef,
  SeasonEffects,
  StorageDef,
} from './balance';
export { buildings } from './buildings';
export type { BuildingDef } from './buildings';
export { objectives, OBJECTIVE_CONDITION_TYPES } from './objectives';
export type { ObjectiveCondition, ObjectiveDef } from './objectives';
export {
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  coldReliefs,
  craftGuilds,
  EVENT_TYPES,
  foundingTemplates,
  idleVillager,
  moraleBandTemplates,
} from './chronicle';
export type {
  ChroniclePlaceholder,
  ColdRelief,
  FoundingEventType,
  GameEventType,
} from './chronicle';
