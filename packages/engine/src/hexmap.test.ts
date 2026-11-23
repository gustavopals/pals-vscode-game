import { EXPEDITION_MODEL_IDS, TILE_TYPE_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';
import { generateHexMap, hexDistance, hexNeighbors, hexRing, siteDestination } from './hexmap';
import { currentShape, migrateState } from './migrations';
import { cloneState } from './state';
import { campaignYard, heroesStart, newGame } from './test-helpers';
import { deriveViewState } from './view';
import v42 from './__fixtures__/state-v42-fresh.json';
import v44 from './__fixtures__/state-v44-fresh.json';

describe('grade axial da Fase E', () => {
  it('seis vizinhos distintos e anéis que particionam o disco na ordem do mapa', () => {
    const center = { q: 0, r: 0 };
    const neighbors = hexNeighbors({ q: 2, r: -1 });
    expect(new Set(neighbors.map(({ q, r }) => `${q},${r}`)).size).toBe(6);
    expect(neighbors.every(({ q, r }) => hexDistance(q - 2, r + 1) === 1)).toBe(true);
    const rings = Array.from({ length: 6 }, (_, i) => hexRing(i));
    expect(rings.map((ring) => ring.length)).toEqual([1, 6, 12, 18, 24, 30]);
    expect(rings[0]).toEqual([center]);
    rings.forEach((ring, i) =>
      expect(ring.every(({ q, r }) => hexDistance(q, r) === i)).toBe(true),
    );
    expect(new Set(rings.flat().map(({ q, r }) => `${q},${r}`)).size).toBe(91);
  });

  it('cria o feudo explorado, o raio 3 avistado e o exterior desconhecido', () => {
    const { map, rng, ids } = newGame();
    expect(map.radius).toBe(5);
    const hexes = Object.values(map.hexes);
    expect(hexes).toHaveLength(91);
    expect(map.hexes['0,0']).toEqual({ terrain: 'fields', fog: 'explored' });
    for (let radius = 1; radius <= 5; radius++)
      for (const { q, r } of hexRing(radius))
        expect(map.hexes[`${q},${r}`]?.fog).toBe(radius <= 3 ? 'sighted' : 'unknown');
    expect(hexes.filter((hex) => hex.terrain === 'sanctuary')).toHaveLength(1);
    expect(map.hexes['2,-5']?.site).toBe('hordeFortress');
    const sites = hexes.flatMap((hex) => (hex.site ? [hex.site] : []));
    expect(sites).toEqual(expect.arrayContaining([...TILE_TYPE_IDS]));
    expect(sites.map(siteDestination).filter(Boolean).sort()).toEqual(
      [...EXPEDITION_MODEL_IDS].sort(),
    );
    expect(new Set(sites).size).toBe(sites.length);
    expect(rng).toEqual({});
    expect(ids).toEqual({});
    expect(newGame().map).toEqual(map);
    expect(newGame('outra semente').map.hexes).not.toEqual(map.hexes);
  });

  it.each(['pedra-alta', 'Serra do Ferro', 'pântano🌙', 'x:y', '\uD800'])(
    'criação e migração congelada produzem a mesma grade para %j',
    (seed) => {
      const fresh = newGame(seed);
      for (const before of [v42, v44]) {
        const migrated = migrateState({ ...before, seed }, { timeScale: 1 });
        expect(migrated.map).toEqual(fresh.map);
        expect(migrated.rng).toEqual(before.rng);
        expect(migrated.ids).toEqual(before.ids);
      }
      const discovered = ['swamp', 'ruins', 'sabotage', 'whiteWolfHunt'];
      const oldMap = { ...v44.map, discovered, expeditionUnlocks: { whiteWolfHunt: 1000 } };
      const state = migrateState({ ...v44, seed, map: oldMap }, { timeScale: 1 });
      expect(state.map).toEqual({ ...oldMap, ...generateHexMap(seed, discovered) });
      for (const id of discovered) {
        expect(
          Object.values(state.map.hexes).find((hex) => hex.site && siteDestination(hex.site) === id)
            ?.fog,
        ).toBe('explored');
      }
    },
  );

  it('a visão inteira independe dos terrenos e locais desconhecidos e da ordem das chaves JSONB', () => {
    const state = newGame();
    const view = deriveViewState(state, 0);
    const other = cloneState(state);
    for (const hex of Object.values(other.map.hexes)) {
      if (hex.fog === 'unknown') Object.assign(hex, { terrain: 'sanctuary', site: 'ruins' });
    }
    expect(deriveViewState(other, 0)).toEqual(view);
    for (const hex of Object.values(other.map.hexes)) {
      if (hex.fog === 'sighted') hex.site = 'raiderCamp';
    }
    other.map.hexes = Object.fromEntries(Object.entries(other.map.hexes).reverse());
    expect(deriveViewState(other, 0)).toEqual(view);
    expect(view.map.hexes.find((hex) => hex.r === -5 && hex.q === 2)).toEqual({ q: 2, r: -5 });
    expect(view.map.hexes.find((hex) => hex.r === 0 && hex.q === 1)).toEqual({
      q: 1,
      r: 0,
      fog: 'sighted',
      terrain: 'fields',
      terrainLabel: 'Campos',
    });
    expect(view.map.hexes[0]).toMatchObject({
      fog: 'explored',
      label: state.settlement.name,
      site: null,
      actions: [],
    });
  });

  it('mostra apenas as ações disponíveis nas fichas exploradas', () => {
    const state = heroesStart('cartografia', 100_000);
    state.settlement.buildings.guild = 4;
    state.map.hexes['1,0']!.fog = 'explored';
    state.map.hexes['2,-5']!.fog = 'explored';
    const first = deriveViewState(state, 0).map.hexes;
    expect(first.find((hex) => hex.q === 1 && hex.r === 0)).toMatchObject({
      site: 'patrol',
      actions: [{ type: 'sendExpedition', modelId: 'patrol' }],
    });
    expect(first.find((hex) => hex.q === 2 && hex.r === -5)).toMatchObject({
      site: null,
      actions: [],
    });
    const camp = campaignYard();
    camp.map.hexes['3,-4']!.fog = 'explored';
    expect(
      deriveViewState(camp, 0).map.hexes.find((hex) => hex.q === 3 && hex.r === -4),
    ).toMatchObject({ site: 'raiderCamp', actions: [{ type: 'attackCamp' }] });
  });

  it('a guarda exige todo o disco canônico e hexágonos de forma fechada', () => {
    const state = newGame();
    const invalid = (map: unknown) => expect(currentShape({ ...state, map }, '')).not.toBeNull();
    const hexes = { ...state.map.hexes };
    delete hexes['1,0'];
    invalid({ ...state.map, radius: 4 });
    invalid({ ...state.map, hexes });
    invalid({ ...state.map, hexes: { ...hexes, '01,0': { terrain: 'fields', fog: 'unknown' } } });
    for (const hex of [
      { terrain: 'ice', fog: 'unknown' },
      { terrain: 'fields', fog: 'lost' },
      { terrain: 'fields', fog: 'explored', site: 'castle' },
      { terrain: 'fields', fog: 'unknown', secret: 1 },
    ])
      invalid({ ...state.map, hexes: { ...hexes, '1,0': hex } });
    state.map.hexes['1,0']!.fog = 'claimed';
    expect(currentShape(state, '')).toBeNull();
    expect(
      deriveViewState(state, 0).map.hexes.find((hex) => hex.q === 1 && hex.r === 0),
    ).toMatchObject({ fog: 'claimed', site: 'patrol' });
  });
});
