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

/** Fração exata: o motor só faz conta com inteiros, então 1,6 vira 16/10. */
export type Ratio = { readonly num: number; readonly den: number };

/** Quantidades em unidades inteiras de recurso (o motor converte para milésimos). */
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
