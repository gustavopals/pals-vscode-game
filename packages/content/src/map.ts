import type { ExpeditionModelId, TerrainId, TileTypeId } from './ids';

export const mapRules = { radius: 5, sightedRadius: 3 } as const;

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
