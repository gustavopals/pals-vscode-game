export const CONTENT_VERSION = '0.1.0';

export * from './ids';
export { balance } from './balance';
export type { Balance, DifficultyDef, PaceDef, SeasonDef } from './balance';
export { buildings } from './buildings';
export type { BuildingDef } from './buildings';
export { objectives, OBJECTIVE_CONDITION_TYPES } from './objectives';
export type { ObjectiveCondition, ObjectiveDef } from './objectives';
export { CHRONICLE_PLACEHOLDERS, chronicleTemplates, EVENT_TYPES } from './chronicle';
export type { ChroniclePlaceholder, GameEventType } from './chronicle';
