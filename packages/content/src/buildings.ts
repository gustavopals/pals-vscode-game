import type { BuildingId, ResourceAmounts, ResourceId } from './ids';

export type BuildingDef = {
  readonly label: string;
  /** Artigo para montar "a Serraria" nas frases da Crônica. */
  readonly article: 'o' | 'a' | 'os' | 'as';
  /** Custo da melhoria do nível 1 para o 2; os seguintes crescem pelo fator de custo. */
  readonly baseCost: ResourceAmounts;
  readonly baseDurationMs: number;
  readonly maxLevel: number;
  readonly produces: ResourceId | null;
};

const MINUTE_MS = 60_000;

// GDD §6.1 e §6.2: os seis edifícios da v0.1.
export const buildings: Record<BuildingId, BuildingDef> = {
  townHall: {
    label: 'Salão do Senhor',
    article: 'o',
    baseCost: { wood: 150, stone: 100, gold: 100 },
    baseDurationMs: 10 * MINUTE_MS,
    maxLevel: 8,
    produces: null,
  },
  farm: {
    label: 'Fazenda',
    article: 'a',
    baseCost: { wood: 80, gold: 40 },
    baseDurationMs: 5 * MINUTE_MS,
    maxLevel: 10,
    produces: 'food',
  },
  lumberMill: {
    label: 'Serraria',
    article: 'a',
    baseCost: { wood: 100, stone: 50 },
    baseDurationMs: 5 * MINUTE_MS,
    maxLevel: 10,
    produces: 'wood',
  },
  quarry: {
    label: 'Pedreira',
    article: 'a',
    baseCost: { wood: 120, gold: 30 },
    baseDurationMs: 6 * MINUTE_MS,
    maxLevel: 10,
    produces: 'stone',
  },
  goldMine: {
    label: 'Mina de Ouro',
    article: 'a',
    baseCost: { wood: 120, stone: 80 },
    baseDurationMs: 8 * MINUTE_MS,
    maxLevel: 10,
    produces: 'gold',
  },
  housing: {
    label: 'Habitações',
    article: 'as',
    baseCost: { wood: 80, stone: 20 },
    baseDurationMs: 4 * MINUTE_MS,
    maxLevel: 10,
    produces: null,
  },
};
