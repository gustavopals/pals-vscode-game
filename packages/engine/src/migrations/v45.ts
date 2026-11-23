import { exactObject, literal, oneOf, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV44 } from './v44';

// Receita congelada da versão 45, independente do catálogo e do gerador atuais.
const weights: Record<string, number> = {
  forest: 30,
  hills: 22,
  fields: 28,
  lake: 8,
  swamp: 6,
  ruins: 4,
  ironVein: 2,
  sanctuary: 0,
};
const fixed: Record<string, { terrain: string; site?: string }> = {
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

function utf8Bytes(text: string): number[] {
  const bytes: number[] = [];
  for (const symbol of text) {
    const code = symbol.codePointAt(0) ?? 0;
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >>> 18),
        0x80 | ((code >>> 12) & 0x3f),
        0x80 | ((code >>> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return bytes;
}

/** FNV-1a de 32 bits sobre os bytes UTF-8 do texto. */
function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (const byte of utf8Bytes(text)) {
    hash = Math.imul(hash ^ byte, 0x01000193);
  }
  return hash >>> 0;
}

const coordinates: { key: string; distance: number }[] = [];
for (let q = -5; q <= 5; q++) {
  for (let r = -5; r <= 5; r++) {
    const distance = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r));
    if (distance <= 5) coordinates.push({ key: `${q},${r}`, distance });
  }
}
function terrainAt(seed: string, key: string): string {
  let part = hashText(`${seed}:map:${key}`) % 100;
  for (const [terrain, weight] of Object.entries(weights)) {
    part -= weight;
    if (part < 0) return terrain;
  }
  throw new Error('Pesos de terreno inválidos na versão 45.');
}

const fields = {
  terrain: oneOf(Object.keys(weights)),
  fog: oneOf(['unknown', 'sighted', 'explored', 'claimed']),
};
const bare = exactObject(fields);
const withSite = exactObject({
  ...fields,
  site: oneOf([...Object.values(fixed).flatMap((hex) => (hex.site ? [hex.site] : [])), 'sabotage']),
});
const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const hex: Shape = (value, path) =>
  object(value) && Object.hasOwn(value, 'site') ? withSite(value, path) : bare(value, path);
const grid = exactObject(Object.fromEntries(coordinates.map(({ key }) => [key, hex])));

export const stateV45: Shape = (value, path) => {
  const at = (field: string) => (path ? `${path}.${field}` : field);
  if (!object(value) || !object(value.map)) return `${at('map')}: mapa ausente`;
  const { radius, hexes, ...map } = value.map;
  return (
    literal(45)(value.schemaVersion, at('schemaVersion')) ??
    literal(5)(radius, at('map.radius')) ??
    grid(hexes, at('map.hexes')) ??
    stateV44({ ...value, map, schemaVersion: 44 }, path)
  );
};

export const v44ToV45: MigrationStep = {
  from: 44,
  summary: 'Posiciona terrenos e destinos pela semente e preserva as descobertas na névoa.',
  shape: stateV44,
  migrate: (state) => {
    const map = state.map as StoredState;
    const discovered = map.discovered as string[];
    const buildings = (state.settlement as StoredState).buildings as StoredState;
    const sightedRadius = Math.min(5, 3 + (buildings.watchtower as number));
    const hexes = Object.fromEntries(
      coordinates.map(({ key, distance }) => {
        const place = fixed[key];
        const destination = place?.site === 'hordeFortress' ? 'sabotage' : place?.site;
        const explored =
          distance === 0 ||
          (destination && destination !== 'raiderCamp' && discovered.includes(destination));
        return [
          key,
          {
            ...(place ?? { terrain: terrainAt(state.seed as string, key) }),
            fog: explored ? 'explored' : distance <= sightedRadius ? 'sighted' : 'unknown',
          },
        ];
      }),
    );
    return { ...state, schemaVersion: 45, map: { ...map, radius: 5, hexes } };
  },
};
