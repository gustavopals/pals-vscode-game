import {
  RELIC_IDS,
  type ExpeditionModelId,
  type RelicId,
  type ScenarioId,
  type TerrainId,
  type TileTypeId,
} from './ids';

export const mapRules = { radius: 5, sightedRadius: 3, watchtowerRingsPerLevel: 1 } as const;

/** Pesos em cem partes nos hexágonos livres. O Santuário tem uma posição única. */
export const terrains = {
  forest: { label: 'Floresta', detail: 'Árvores antigas cobrem este trecho do reino.', weight: 30 },
  hills: { label: 'Colinas', detail: 'Elevações de pedra se erguem sobre os campos.', weight: 22 },
  fields: { label: 'Campos', detail: 'A planície se abre entre os caminhos do feudo.', weight: 28 },
  lake: { label: 'Lago', detail: 'Águas tranquilas ocupam a baixada.', weight: 8 },
  swamp: { label: 'Pântano', detail: 'O caminho se perde entre juncos e água escura.', weight: 6 },
  ruins: { label: 'Ruínas', detail: 'Restos de muralhas marcam uma antiga povoação.', weight: 4 },
  ironVein: { label: 'Veio de Ferro', detail: 'O ferro aflora entre as rochas.', weight: 2 },
  sanctuary: { label: 'Santuário', detail: 'Um altar de pedra repousa em silêncio.', weight: 0 },
} as const satisfies Record<TerrainId, { label: string; detail: string; weight: number }>;

export type MapScenarioDef = {
  readonly label: string;
  readonly description: string;
  /** Pontos acumulados de Legado exigidos na conta para escolher este cenário (D-18). */
  readonly legacyCost: number;
  readonly recommended: boolean;
  /** Pesos em cem partes nos hexágonos livres; `sanctuary` permanece zero (posição única). */
  readonly terrainWeights: Readonly<Record<TerrainId, number>>;
};

/**
 * Cenários de mapa escolhidos na criação da partida (GDD §8.1 e §11.5; ADR 0022, D-18).
 * `standard` conserva os pesos publicados na V5E-T1; `ironRidge` (Serra do Ferro) aumenta
 * colinas (22 → 40) e veios de ferro (2 → 12), reduzindo campos (28 → 16), florestas (30 → 20),
 * lagos (8 → 4) e pântanos (6 → 4), desbloqueado na conta a partir de 200 pontos de Legado.
 */
export const mapScenarios = {
  standard: {
    label: 'Terras do Feudo',
    description: 'Equilíbrio entre campos, florestas e colinas ao redor do feudo.',
    legacyCost: 0,
    recommended: true,
    terrainWeights: {
      forest: 30,
      hills: 22,
      fields: 28,
      lake: 8,
      swamp: 6,
      ruins: 4,
      ironVein: 2,
      sanctuary: 0,
    },
  },
  ironRidge: {
    label: 'Serra do Ferro',
    description:
      'Mais colinas e veios de ferro espalhados pelo mapa, com menos campos e florestas.',
    legacyCost: 200,
    recommended: false,
    terrainWeights: {
      forest: 20,
      hills: 40,
      fields: 16,
      lake: 4,
      swamp: 4,
      ruins: 4,
      ironVein: 12,
      sanctuary: 0,
    },
  },
} as const satisfies Record<ScenarioId, MapScenarioDef>;

/**
 * Recompensa do Santuário quando o hexágono `sanctuary` é explorado pela primeira vez
 * (GDD §8.1; ADR 0022, D-6). Sem sorteio: entrega a próxima relíquia desta lista fixa que o feudo
 * ainda não possui; se o feudo já tiver todas as oito, entrega `consolationGold` de ouro (fixo).
 */
export const sanctuaryReward = {
  from: RELIC_IDS,
  consolationGold: 100,
} as const satisfies { readonly from: readonly RelicId[]; readonly consolationGold: number };

/** Frases do mapa e dos cenários usadas pela visão, pelo catálogo e pelas recusas do servidor. */
export const mapTexts = {
  hexNotExplored: 'Explore este hexágono antes de reivindicá-lo.',
  notClaimable: 'Não é possível erguer um posto avançado neste hexágono.',
  outpostLimit: 'O feudo já tem {limite} postos avançados, contando os que estão em obra.',
  outpostFactor: 'Posto avançado em {hex}',
  beforeOutpostReady: 'da conclusão do posto avançado em {hex}',
  veinRate: 'Veio de Ferro ({hex}): {taxa}/h',
  sanctuaryClaimedDetail: 'O altar antigo já entregou sua relíquia ao feudo.',
  scenarioCostLabel: '{custo} de Legado',
  scenarioLocked: 'Requer {custo} pontos de Legado na conta.',
  scenarioInsufficientLegacy:
    '{cenario} exige {custo} pontos de Legado na conta (você tem {legado}).',
} as const;

export type MapSiteId = TileTypeId | ExpeditionModelId;

/** A Fortaleza é o destino da Sabotagem; o Covil também é um único lugar. */
export const fixedHexes: Readonly<Record<string, { terrain: TerrainId; site?: MapSiteId }>> = {
  '0,0': { terrain: 'fields' },
  '1,0': { terrain: 'fields', site: 'patrol' },
  '-2,1': { terrain: 'forest', site: 'oldForest' },
  '-1,-1': { terrain: 'forest', site: 'wolfDen' },
  '-3,1': { terrain: 'forest', site: 'whiteWolfHunt' },
  '2,1': { terrain: 'hills', site: 'rescue' },
  '3,-2': { terrain: 'ruins', site: 'ruins' },
  '-3,0': { terrain: 'ironVein', site: 'abandonedMine' },
  '-4,3': { terrain: 'swamp', site: 'swamp' },
  '3,-4': { terrain: 'hills', site: 'raiderCamp' },
  '2,-5': { terrain: 'hills', site: 'hordeFortress' },
  '4,-1': { terrain: 'ruins', site: 'ancestralVault' },
  '-1,5': { terrain: 'forest', site: 'hermitsRefuge' },
  '0,4': { terrain: 'sanctuary' },
};
