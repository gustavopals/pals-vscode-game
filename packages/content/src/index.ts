export const CONTENT_VERSION = '0.4.0';

export * from './ids';
export { vows, vowRules, vowTexts } from './vows';
export { relics, relicTexts } from './relics';
export { balance } from './balance';
export type {
  Balance,
  CouncilDef,
  CraftDef,
  DifficultyDef,
  EquipmentDef,
  ExpeditionsDef,
  HeroesDef,
  InjuriesDef,
  CaravanDef,
  MarketDef,
  MastersDef,
  SmithyDef,
  ArmyDef,
  BattleDef,
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
  TavernDef,
  ThreatDef,
  WallDef,
  WatchtowerLevelDef,
  HordeMindDef,
  OmenClarityId,
  OmensDef,
} from './balance';
export { buildings } from './buildings';
export type { BuildingDef, BuildingLevelDef } from './buildings';
export { objectives, OBJECTIVE_CONDITION_TYPES } from './objectives';
export type { ObjectiveCondition, ObjectiveDef, ObjectiveMoraleReward } from './objectives';
export { caravanTexts, marketTexts } from './caravans';
export { masters, masterTexts } from './masters';
export {
  battleReportTexts,
  formationTexts,
  lineLabels,
  warCouncilTexts,
  wingLabels,
  wingPhrases,
  wingLocatives,
} from './formations';
export { omenTexts } from './omens';
export {
  hordeTiles,
  hordeWaveYearFactors,
  hordeWaves,
  siegeWaveYearFactor,
  siegeWaveGrowthFactor,
  previousYearMemoryFactor,
  hordeWaveMix,
} from './horde';
export type { HordeWaveDef } from './horde';
export { COUNTER_CYCLE, militiaUnit, unitTexts, units } from './units';
export type { UnitDef, UnitLine } from './units';
export { ARCHETYPES, ARCHETYPE_COUNTERS, hordeBaseMix, hordeUnits } from './enemies';
export type { Archetype, DoubleDamageSource, HordeUnitDef } from './enemies';
export type { MasterDef } from './masters';
export {
  caravanTemplates,
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  coldReliefs,
  craftGuilds,
  cutRewardTemplates,
  EVENT_TYPES,
  foundingTemplates,
  heroDismissalTemplates,
  heroHarmTemplates,
  battleFactorLabels,
  battleNoFactorText,
  battleOutcomeLabels,
  idleVillager,
  injuredLoss,
  injuryTemplates,
  marketTemplates,
  masterTemplates,
  moraleBandTemplates,
  raidTemplates,
  threatMarkTemplates,
  wageArrearsReliefs,
} from './chronicle';
export type {
  CaravanTemplate,
  ChroniclePlaceholder,
  ColdRelief,
  FoundingEventType,
  GameEventType,
  HeroDismissalTemplate,
  HeroHarmTemplate,
  MarketTemplate,
  MasterTemplate,
  RaidTemplates,
  WageArrearsRelief,
} from './chronicle';
export {
  guildTexts,
  heroAttributes,
  heroClasses,
  heroNames,
  heroStatuses,
  heroTraits,
  injurySeverities,
  namedHeroes,
  tavernCandidates,
  wageArrearsTexts,
} from './heroes';
export type {
  HeroAura,
  HeroClassDef,
  HeroTraitDef,
  HeroTraitEffects,
  NamedHeroDef,
  TavernCandidateDef,
} from './heroes';
export {
  expeditionModels,
  expeditionOutcomes,
  expeditionPostures,
  expeditionTemplates,
  expeditionTexts,
} from './expeditions';
export type {
  ExpeditionAccess,
  ExpeditionCrossroadsNode,
  ExpeditionModelDef,
  ExpeditionNode,
  ExpeditionItemDrop,
  ExpeditionMasterDrop,
  ExpeditionOption,
  ExpeditionOptionRequires,
  ExpeditionRequires,
  ExpeditionReturnNode,
  ExpeditionReward,
  ExpeditionStageKind,
  ExpeditionStageNode,
  ExpeditionTrial,
  ExpeditionVariant,
} from './expeditions';
export { equipmentTexts, itemRarities, items, itemSlots } from './items';
export type { ItemDef } from './items';
export { COUNCIL_EFFECT_TYPES, councilHeroTexts } from './council';
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
export { WAR_RAID_SIZE_IDS, warRaids } from './raidWar';
export { vigilRules, vigilTexts } from './vigil';
export type { WarRaidLossDef, WarRaidSizeId, WarRaidsDef, WarScriptedRaidDef } from './raidWar';
export { enemies, prowlingTileOrder, raidSizes, startingTiles, tileTypes } from './tiles';
export type { EnemyDef, RaidSizeDef, TileTypeDef } from './tiles';

export { campaignTexts } from './campaign';

export { siegeTexts } from './siege';
export {
  feats,
  featRules,
  yearChronicleTexts,
  YearEndedDataSchema,
  type YearEndedData,
} from './feats';
export type { FeatId } from './feats';
export { mapRules, terrains, fixedHexes, type MapSiteId } from './map';
