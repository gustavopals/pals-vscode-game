import type { BuildingId, ResourceAmounts, ResourceId } from './ids';

export type BuildingDef = {
  readonly label: string;
  /** Artigo para montar "a Serraria" nas frases da Crônica. */
  readonly article: 'o' | 'a' | 'os' | 'as';
  /**
   * Custo da primeira obra do edifício: do nível 1 para o 2 em quem já nasce erguido, a
   * construção (0 → 1) em quem nasce no nível 0. As seguintes crescem pelo fator de custo.
   */
  readonly baseCost: ResourceAmounts;
  readonly baseDurationMs: number;
  /** Nível com que o edifício nasce em uma partida nova; 0 é "ainda não construído". */
  readonly initialLevel: number;
  readonly maxLevel: number;
  readonly produces: ResourceId | null;
  /**
   * Pré-requisito do GDD §6.1 ("Salão 2"): o nível mínimo de outros edifícios para a obra poder
   * começar. Vale além da regra geral de nunca passar do nível do Salão mais um.
   */
  readonly requires: Partial<Record<BuildingId, number>>;
};

const MINUTE_MS = 60_000;

// GDD §6.1 e §6.2: os seis edifícios da v0.1 e, da v0.2, o Celeiro e o Armazém (§5.5).
export const buildings: Record<BuildingId, BuildingDef> = {
  townHall: {
    label: 'Salão do Senhor',
    article: 'o',
    baseCost: { wood: 150, stone: 100, gold: 100 },
    baseDurationMs: 10 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 8,
    produces: null,
    requires: {},
  },
  farm: {
    label: 'Fazenda',
    article: 'a',
    baseCost: { wood: 80, gold: 40 },
    baseDurationMs: 5 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 10,
    produces: 'food',
    requires: {},
  },
  lumberMill: {
    label: 'Serraria',
    article: 'a',
    baseCost: { wood: 100, stone: 50 },
    baseDurationMs: 5 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 10,
    produces: 'wood',
    requires: {},
  },
  quarry: {
    label: 'Pedreira',
    article: 'a',
    baseCost: { wood: 120, gold: 30 },
    baseDurationMs: 6 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 10,
    produces: 'stone',
    requires: {},
  },
  goldMine: {
    label: 'Mina de Ouro',
    article: 'a',
    baseCost: { wood: 120, stone: 80 },
    baseDurationMs: 8 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 10,
    produces: 'gold',
    requires: {},
  },
  housing: {
    label: 'Habitações',
    article: 'as',
    baseCost: { wood: 80, stone: 20 },
    baseDurationMs: 4 * MINUTE_MS,
    initialLevel: 1,
    maxLevel: 10,
    produces: null,
    requires: {},
  },
  granary: {
    label: 'Celeiro',
    article: 'o',
    baseCost: { wood: 160, stone: 80 },
    baseDurationMs: 10 * MINUTE_MS,
    initialLevel: 0,
    maxLevel: 8,
    produces: null,
    requires: { townHall: 2 },
  },
  warehouse: {
    label: 'Armazém',
    article: 'o',
    baseCost: { wood: 160, stone: 80 },
    baseDurationMs: 10 * MINUTE_MS,
    initialLevel: 0,
    maxLevel: 8,
    produces: null,
    requires: { townHall: 2 },
  },
};
