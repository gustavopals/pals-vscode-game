import {
  applyCommand,
  createInitialState,
  deriveViewState,
  type Command,
  type GameState,
  type EngineViewState as ViewState,
} from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { BAIT_FORMATION_NAME, prepararFinta } from './finta';
import type { Act } from './types';

function scenario(tower = 2, size: 'light' | 'strong' = 'strong') {
  let state: GameState = createInitialState('finta-publica', {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale: 1,
  });
  const now = 48 * 2 * 3_600_000 + 1;
  state.lastProcessedAt = now;
  state.clock.gameTimeMs = now;
  Object.assign(state.settlement.buildings, { townHall: 5, barracks: 2, watchtower: tower });
  state.settlement.population.villagers = 40;
  state.settlement.resources.food = 1_000_000;
  state.army.units.archer = 12;
  state.army.units.spearman = 8;
  state.horde.scheduledRaids = [
    {
      id: 'threat-1',
      kind: 'threat',
      enemy: 'horde',
      size,
      atMs: now + 1000,
      announcedAtMs: null,
      composition: null,
    },
  ];
  const refused: string[] = [];
  const act: Act = async (type, payload) => {
    const command = { commandId: 'finta', type, payload } as Command;
    const result = applyCommand(state, command, state.lastProcessedAt);
    if (result.ok) state = result.state;
    else refused.push(result.code);
    return deriveViewState(state, state.lastProcessedAt);
  };
  const view = (): ViewState => deriveViewState(state, state.lastProcessedAt);
  return { state: () => state, view, act, refused };
}

describe('finta do militar, só com informação pública (V4E-T3)', () => {
  it('ativa uma isca só de arqueiros na incursão forte visível do outono', async () => {
    const game = scenario();
    await prepararFinta.run(game.view(), game.act);
    const state = game.state();
    const bait = state.army.formations.find((formation) => formation.name === BAIT_FORMATION_NAME)!;
    expect(bait).toBeDefined();
    expect(state.army.activeFormationId).toBe(bait.id);
    expect(Object.values(bait.posts).map((posts) => posts.front)).toEqual([null, null, null]);
    expect(Object.values(bait.posts).map((posts) => posts.back)).toEqual([
      { unit: 'archer', count: 4 },
      { unit: 'archer', count: 4 },
      { unit: 'archer', count: 4 },
    ]);
    await prepararFinta.run(game.view(), game.act);
    expect(
      game.state().army.formations.filter((formation) => formation.name === BAIT_FORMATION_NAME),
    ).toHaveLength(1);
    expect(game.refused).toEqual([]);
  });

  it.each([0, 1])('Torre Nv%s: sem tamanho revelado, não inventa uma isca', async (tower) => {
    const game = scenario(tower);
    await prepararFinta.run(game.view(), game.act);
    expect(
      game.state().army.formations.some((formation) => formation.name === BAIT_FORMATION_NAME),
    ).toBe(false);
    expect(game.refused).toEqual([]);
  });

  it('uma incursão leve não aciona a isca', async () => {
    const game = scenario(2, 'light');
    await prepararFinta.run(game.view(), game.act);
    expect(
      game.state().army.formations.some((formation) => formation.name === BAIT_FORMATION_NAME),
    ).toBe(false);
  });

  it('no inverno volta a uma formação de defesa', async () => {
    const game = scenario();
    await prepararFinta.run(game.view(), game.act);
    const winter = game.view();
    winter.calendar = { ...winter.calendar, season: 'winter' };
    await prepararFinta.run(winter, game.act);
    const state = game.state();
    expect(
      state.army.formations.find((formation) => formation.id === state.army.activeFormationId)
        ?.name,
    ).not.toBe(BAIT_FORMATION_NAME);
    expect(game.refused).toEqual([]);
  });
});
