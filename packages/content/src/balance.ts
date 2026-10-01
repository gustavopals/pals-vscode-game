import type {
  BuildingId,
  ProductionBuildingId,
  Ratio,
  ResourceAmounts,
  ResourceId,
  SeasonId,
} from './ids';

export type SeasonDef = {
  readonly id: SeasonId;
  readonly label: string;
  /** Artigo para montar "a Primavera" e "da Primavera" nas frases. */
  readonly article: 'a' | 'o';
  /** Duração em dias de jogo. */
  readonly days: number;
};

export type Balance = {
  readonly resources: Record<ResourceId, { readonly label: string }>;
  readonly initial: {
    readonly villagers: number;
    readonly resources: Record<ResourceId, number>;
    readonly buildingLevel: number;
  };
  readonly production: {
    /** Unidades por trabalhador por hora no nível 1. */
    readonly perWorkerPerHour: Record<ProductionBuildingId, number>;
    /** Bônus somado a cada nível acima do primeiro: 2/10 = +20%. */
    readonly levelBonus: Ratio;
  };
  readonly consumption: { readonly foodPerVillagerPerHour: number };
  readonly housing: { readonly capacityPerLevel: Partial<Record<BuildingId, number>> };
  readonly recruitment: {
    readonly cost: ResourceAmounts;
    readonly durationMs: number;
    readonly maxQueue: number;
    readonly maxPerOrder: number;
  };
  readonly construction: {
    readonly costFactor: Ratio;
    readonly costFactorByBuilding: Partial<Record<BuildingId, Ratio>>;
    readonly timeFactor: Ratio;
    readonly maxDurationMs: number;
    readonly cancelRefund: Ratio;
    readonly queues: number;
    /** Um edifício nunca ultrapassa o nível do Salão mais este valor. */
    readonly gateLevelsAboveTownHall: number;
  };
  readonly famine: { readonly productionMultiplier: Ratio };
  readonly calendar: { readonly dayMs: number; readonly seasons: readonly SeasonDef[] };
  readonly settlement: { readonly nameMinLength: number; readonly nameMaxLength: number };
  readonly objectives: { readonly maxActive: number };
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

// GDD §5.2, §5.3, §5.6 e §6.2. Todo número de jogo da v0.1 vive aqui ou em buildings.ts.
export const balance: Balance = {
  resources: {
    food: { label: 'Comida' },
    wood: { label: 'Madeira' },
    stone: { label: 'Pedra' },
    gold: { label: 'Ouro' },
  },
  initial: {
    villagers: 5,
    resources: { food: 180, wood: 120, stone: 65, gold: 250 },
    buildingLevel: 1,
  },
  production: {
    perWorkerPerHour: { farm: 10, lumberMill: 8, quarry: 5, goldMine: 4 },
    levelBonus: { num: 2, den: 10 },
  },
  consumption: { foodPerVillagerPerHour: 1 },
  housing: { capacityPerLevel: { townHall: 5, housing: 5 } },
  recruitment: {
    cost: { food: 50, gold: 10 },
    durationMs: 20 * MINUTE_MS,
    maxQueue: 5,
    maxPerOrder: 5,
  },
  construction: {
    costFactor: { num: 16, den: 10 },
    costFactorByBuilding: { townHall: { num: 18, den: 10 } },
    timeFactor: { num: 3, den: 2 },
    maxDurationMs: 8 * HOUR_MS,
    cancelRefund: { num: 8, den: 10 },
    queues: 1,
    gateLevelsAboveTownHall: 1,
  },
  famine: { productionMultiplier: { num: 3, den: 4 } },
  calendar: {
    dayMs: 2 * HOUR_MS,
    seasons: [
      { id: 'spring', label: 'Primavera', article: 'a', days: 24 },
      { id: 'summer', label: 'Verão', article: 'o', days: 24 },
      { id: 'autumn', label: 'Outono', article: 'o', days: 24 },
      { id: 'winter', label: 'Inverno', article: 'o', days: 12 },
    ],
  },
  settlement: { nameMinLength: 2, nameMaxLength: 24 },
  objectives: { maxActive: 3 },
};
