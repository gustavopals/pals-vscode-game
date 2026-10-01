export const RESOURCE_IDS = ['food', 'wood', 'stone', 'gold'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const BUILDING_IDS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

export const PRODUCTION_BUILDING_IDS = ['farm', 'lumberMill', 'quarry', 'goldMine'] as const;
export type ProductionBuildingId = (typeof PRODUCTION_BUILDING_IDS)[number];

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** Fração exata: o motor só faz conta com inteiros, então 1,6 vira 16/10. */
export type Ratio = { readonly num: number; readonly den: number };

/** Quantidades em unidades inteiras de recurso (o motor converte para milésimos). */
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
