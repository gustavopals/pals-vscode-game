import { balance, BUILDING_IDS, RESOURCE_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { applySiegeFall } from './siegeOutcome';
import { readySiege } from './siege.test-helpers';
import { cloneState } from './state';
import { HOUR } from './test-helpers';
import { resolveBattle, EVEN_LUCK } from './battle';
import { buildBattleReport } from './battleReport';
import { toHordePosts } from './raidArmy';

const complete = (state = readySiege()) => advanceTo(state, state.siege!.atMs + 2 * HOUR);

describe('Cerco: resultado e Queda', () => {
  it('declara Gloriosa sem frente rompida e remove a Fortaleza sem recriá-la', () => {
    const result = complete();
    expect(result.state.siege!.result).toBe('glorious');
    expect(result.events.filter((e) => e.type === 'siegeGlorious')).toHaveLength(1);
    expect(result.state.map.tiles.hordeFortress).toBeUndefined();
    expect(
      advanceTo(result.state, result.state.lastProcessedAt + HOUR * 2).state.map.tiles
        .hordeFortress,
    ).toBeUndefined();
    expect(result.state.stats['siegeResult:1']).toBe(2);
  });
  it('uma frente rompida numa onda anterior impede Gloriosa', () => {
    const state = readySiege();
    state.siege!.breached = true;
    const result = complete(state);
    expect(result.state.siege!.result).toBe('victory');
    expect(result.events.filter((e) => e.type === 'siegeWon')).toHaveLength(1);
    expect(result.events.filter((e) => e.type === 'siegeGlorious')).toHaveLength(0);
  });
  it('ala sem tropa na frente impede Vitória Gloriosa mesmo que vença o cerco', () => {
    const state = readySiege();
    state.army.formations[0]!.posts.left.front = null;
    const result = complete(state);
    expect(result.state.siege!.result).toBe('victory');
    expect(result.events.filter((e) => e.type === 'siegeGlorious')).toHaveLength(0);
    expect(result.events.filter((e) => e.type === 'siegeWon')).toHaveLength(1);
  });
  it('ala com retaguarda aniquilada impede Vitória Gloriosa', () => {
    const state = readySiege();
    state.army.formations[0]!.posts.left.front = null;
    state.army.formations[0]!.posts.left.back = { unit: 'archer', count: 1 };
    const result = complete(state);
    expect(result.state.siege!.result).toBe('victory');
    expect(result.events.filter((e) => e.type === 'siegeGlorious')).toHaveLength(0);
    expect(result.events.filter((e) => e.type === 'siegeWon')).toHaveLength(1);
  });
  it('perder a primeira onda encerra o cerco, sem enfrentar as duas restantes', () => {
    const state = readySiege();
    state.army.units = { spearman: 0, swordsman: 0, archer: 0, knight: 0, shieldbearer: 0 };
    const result = complete(state);
    expect(result.state.siege!.result).toBe('fall');
    expect(result.state.siege!.current).toBe(1);
    expect(result.events.filter((e) => e.type === 'siegeWaveFought')).toHaveLength(1);
    expect(result.events.filter((e) => e.type === 'siegeFell')).toHaveLength(1);
    expect(result.events.find((e) => e.type === 'siegeFell')!.text).toContain(
      'sobrevive em ruínas',
    );
    expect(result.state.settlement.wall.hp).toEqual({ left: 0, center: 0, right: 0 });
    expect(result.state.map.tiles.hordeFortress).toBeUndefined();
    expect(currentShape(result.state, '')).toBeNull();
  });
  it('aplica frações exatas, escolhe edifícios por nível/ordem e não toca Mestres/heróis', () => {
    const state = readySiege();
    for (const id of RESOURCE_IDS) state.settlement.resources[id] = 101_011;
    state.settlement.population.villagers = 17;
    for (const id of BUILDING_IDS)
      state.settlement.buildings[id] = Math.min(state.settlement.buildings[id], 4);
    state.settlement.buildings.townHall = 8;
    state.settlement.buildings.barracks = 7;
    state.settlement.workers = { farm: 7, lumberMill: 5, quarry: 3, goldMine: 2 };
    state.settlement.constructionQueues[0] = {
      building: 'townHall',
      targetLevel: 9,
      startedAtMs: state.lastProcessedAt - 10,
      finishesAtMs: state.lastProcessedAt + HOUR,
    };
    const heroes = cloneState(state).guild.heroes;
    const masters = cloneState(state).settlement.masters;
    const rng = cloneState(state).rng;
    const data = applySiegeFall(state, state.lastProcessedAt);
    for (const id of RESOURCE_IDS) expect(state.settlement.resources[id]).toBe(70_708);
    expect(state.settlement.population.villagers).toBe(14);
    expect(state.settlement.buildings.townHall).toBe(6);
    expect(state.settlement.buildings.barracks).toBe(5);
    expect(data).toMatchObject({ villagersLost: 3, building1: 'townHall', building2: 'barracks' });
    expect(state.settlement.constructionQueues[0]).toBeNull();
    expect(Object.values(state.settlement.workers).reduce((a, b) => a + b, 0)).toBe(14);
    expect(state.guild.heroes).toEqual(heroes);
    expect(state.settlement.masters).toEqual(masters);
    expect(state.rng).toEqual(rng);
  });
  it('piso de três e nível mínimo deixam a reconstrução possível; empates são estáveis', () => {
    const state = readySiege();
    state.settlement.population.villagers = 3;
    for (const id of BUILDING_IDS) state.settlement.buildings[id] = 1;
    const data = applySiegeFall(state, state.lastProcessedAt);
    expect(state.settlement.population.villagers).toBe(3);
    expect(data.building1).toBe(BUILDING_IDS[0]);
    expect(data.building2).toBe(BUILDING_IDS[1]);
    expect(Object.values(state.settlement.buildings).every((level) => level === 1)).toBe(true);
  });
  it('a guarda preserva soldados e planos anteriores acima do Quartel reduzido', () => {
    const result = complete();
    const state = cloneState(result.state);
    state.stats.siegesFallen = 1;
    state.settlement.buildings.barracks = 6;
    expect(Object.values(state.army.units).reduce((a, b) => a + b, 0)).toBe(80);
    expect(currentShape(state, '')).toBeNull();
    expect(migrateState(state, { timeScale: 1 })).toBe(state);
    state.army.units.archer = 100;
    expect(currentShape(state, '')).not.toBeNull();
  });
  it('matar o Senhor da Guerra encerra imediatamente a onda 3, mesmo com escolta viva', () => {
    const state = readySiege();
    const input = {
      mode: 'defense' as const,
      player: {
        posts: toHordePosts([{ wing: 'center', line: 'front', unit: 'raider', count: 1 }]),
        commanders: { left: null, center: null, right: null },
      },
      horde: {
        posts: toHordePosts([
          { wing: 'left', line: 'front', unit: 'ogre', count: 50 },
          { wing: 'center', line: 'front', unit: 'warlord', count: 1 },
        ]),
      },
      wall: {},
      watchtowerLevel: 5,
      heroCapture: balance.difficulties.lord.heroCapture,
    };
    // O chefe já tem este contrato na batalha. Montamos uma ala central forte para isolá-lo.
    const player = {
      ...input.player,
      posts: {
        left: { front: null, back: null },
        center: { front: { unit: 'knight' as const, count: 100 }, back: null },
        right: { front: null, back: null },
      },
    };
    const report = buildBattleReport(
      'battle-1',
      state.siege!.atMs,
      resolveBattle({ ...input, player }, EVEN_LUCK),
    );
    expect(report.ending).toBe('chiefFell');
    expect(report.outcome).toBe('victory');
    expect(
      report.casualties.some((c) => c.owner === 'horde' && c.unit === 'ogre' && c.lost < c.start),
    ).toBe(true);
    const result = complete();
    expect(result.events.filter((e) => e.type === 'warlordSlain')).toHaveLength(1);
    expect(result.state.stats.warlordsSlain).toBe(1);
  });
});
