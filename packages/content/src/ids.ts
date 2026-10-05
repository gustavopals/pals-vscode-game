export const RESOURCE_IDS = ['food', 'wood', 'stone', 'gold'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const BUILDING_IDS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export const PRODUCTION_BUILDING_IDS = ['farm', 'lumberMill', 'quarry', 'goldMine'] as const;
export type ProductionBuildingId = (typeof PRODUCTION_BUILDING_IDS)[number];

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** Dificuldades do GDD §12.1, da mais branda à mais dura. Os fatores estão em `balance.difficulties`. */
export const DIFFICULTY_IDS = ['peasant', 'lord', 'ironKing'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

/** Faixas da moral (GDD §5.7), da mais baixa à mais alta. Os limites estão em `balance.morale.bands`. */
export const MORALE_BAND_IDS = ['desperate', 'restless', 'content', 'proud'] as const;
export type MoraleBandId = (typeof MORALE_BAND_IDS)[number];

/**
 * Os termos da conta da moral (GDD §5.7), na ordem em que a explicação os mostra: a base, a
 * comida guardada, a fome (e cada dia inteiro dela), as casas cheias, o frio e os efeitos
 * temporários (cartas do Conselho, incursões, objetivos).
 */
export const MORALE_TERM_IDS = [
  'base',
  'foodReserve',
  'famine',
  'famineDays',
  'housingFull',
  'cold',
  'effect',
] as const;
export type MoraleTermId = (typeof MORALE_TERM_IDS)[number];

/** Os tipos de tile do mapa (GDD §8.1). Na v0.2 só existe o tile de ameaça, em lista: `tiles.ts`. */
export const TILE_TYPE_IDS = ['wolfDen'] as const;
export type TileTypeId = (typeof TILE_TYPE_IDS)[number];

/** Quem ataca o feudo em uma incursão (GDD §8.2). Na v0.2, só os lobos. */
export const ENEMY_IDS = ['wolves'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

/** Os tamanhos de uma incursão (GDD §8.2), da menor à maior. */
export const RAID_SIZE_IDS = ['light', 'medium'] as const;
export type RaidSizeId = (typeof RAID_SIZE_IDS)[number];

/** As classes de herói da v0.3 (GDD §9.1). Os atributos-base estão em `heroClasses`. */
export const HERO_CLASS_IDS = ['warrior', 'archer', 'mage', 'cleric'] as const;
export type HeroClassId = (typeof HERO_CLASS_IDS)[number];

/** Os seis atributos de um herói (GDD §9.1), na ordem em que a ficha os mostra. */
export const HERO_ATTRIBUTE_IDS = [
  'health',
  'attack',
  'defense',
  'speed',
  'skill',
  'will',
] as const;
export type HeroAttributeId = (typeof HERO_ATTRIBUTE_IDS)[number];

/** Os traços de herói (GDD, Apêndice D; ADR 0017, "Os oito traços"). */
export const HERO_TRAIT_IDS = [
  'brave',
  'prudent',
  'greedy',
  'charismatic',
  'devout',
  'veteran',
  'loyal',
  'tracker',
] as const;
export type HeroTraitId = (typeof HERO_TRAIT_IDS)[number];

/**
 * O que um herói está fazendo. Na Fase C só existe "no feudo": expedição, escolta, ferimento e
 * captura entram com as tarefas que os usam.
 */
export const HERO_STATUS_IDS = ['idle'] as const;
export type HeroStatusId = (typeof HERO_STATUS_IDS)[number];

/** Fração exata: o motor só faz conta com inteiros, então 1,6 vira 16/10. */
export type Ratio = { readonly num: number; readonly den: number };

/** Quantidades em unidades inteiras de recurso (o motor converte para milésimos). */
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
