import {
  fixedHexes,
  mapRules,
  mapScenarios,
  TERRAIN_IDS,
  type ExpeditionModelId,
  type MapSiteId,
  type ScenarioId,
  type TerrainId,
} from '@lotg/content';
import { hashText } from './hash';
import type { GameState } from './types';

export type Axial = { readonly q: number; readonly r: number };
const directions = [
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, 1],
  [0, 1],
] as const;

export function hexDistance(q: number, r: number): number {
  return Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
}

export function hexNeighbors({ q, r }: Axial): Axial[] {
  return directions.map(([dq, dr]) => ({ q: q + dq, r: r + dr }));
}

/** Do sudoeste para leste, em seis lados. O centro é o anel zero. */
export function hexRing(radius: number): Axial[] {
  if (radius === 0) return [{ q: 0, r: 0 }];
  const ring: Axial[] = [];
  let q = -radius;
  let r = radius;
  for (const [dq, dr] of directions) {
    for (let i = 0; i < radius; i++) {
      ring.push({ q, r });
      q += dq;
      r += dr;
    }
  }
  return ring;
}

export const mapCoordinates: readonly Axial[] = Array.from(
  { length: mapRules.radius + 1 },
  (_, radius) => hexRing(radius),
).flat();

export function siteDestination(site: MapSiteId): ExpeditionModelId | null {
  if (site === 'raiderCamp') return null;
  return site === 'hordeFortress' ? 'sabotage' : site;
}

function terrainAt(
  seed: string,
  key: string,
  weights: Readonly<Record<TerrainId, number>>,
): TerrainId {
  let part = hashText(`${seed}:map:${key}`) % 100;
  for (const terrain of TERRAIN_IDS) {
    part -= weights[terrain];
    if (part < 0) return terrain;
  }
  throw new Error('Os pesos dos terrenos devem somar 100.');
}

/** A semente, o cenário e a coordenada bastam para cada terreno livre. */
export function generateHexMap(
  seed: string,
  discovered: readonly string[],
  scenario: ScenarioId = 'standard',
): Pick<GameState['map'], 'hexes' | 'radius' | 'scenario'> {
  const weights = mapScenarios[scenario].terrainWeights;
  const hexes: GameState['map']['hexes'] = {};
  for (const { q, r } of mapCoordinates) {
    const key = `${q},${r}` as const;
    const fixed = fixedHexes[key];
    const distance = hexDistance(q, r);
    const destination = fixed?.site && siteDestination(fixed.site);
    const explored = distance === 0 || (destination && discovered.includes(destination));
    hexes[key] = {
      ...(fixed ?? { terrain: terrainAt(seed, key, weights) }),
      fog: explored ? 'explored' : distance <= mapRules.sightedRadius ? 'sighted' : 'unknown',
    };
  }
  return { radius: mapRules.radius, scenario, hexes };
}
