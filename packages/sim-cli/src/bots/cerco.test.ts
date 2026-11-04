import { advanceTo, deriveViewState, type GameState } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { revealWaveThree } from '../../../engine/src/hordePlan';
import { readySiege } from '../../../engine/src/siege.test-helpers';
import { HOUR } from '../../../engine/src/test-helpers';
import { applySimCommand, type SimCommand } from '../engine';
import { strategyPolicies } from './index';
import { responderCerco } from './policies';
import type { Act } from './types';

function scenario(initial = readySiege()) {
  let state = initial;
  const orders: SimCommand[] = [];
  const refused: string[] = [];
  const view = () => deriveViewState(state, state.lastProcessedAt);
  const act: Act = async (type, payload) => {
    const command = { commandId: `cerco-${orders.length}`, type, payload } as SimCommand;
    orders.push(command);
    const result = applySimCommand(state, command, state.lastProcessedAt);
    if (result.ok) state = result.state;
    else refused.push(result.code);
    return view();
  };
  return { state: () => state, view, act, orders, refused };
}

function afterFirstWave(): GameState {
  const state = readySiege();
  return advanceTo(state, state.siege!.nextWaveAtMs!).state;
}

describe('os bots atravessam o cerco (V4G-T2.10)', () => {
  it('todos os perfis respondem ao cerco depois de montar ou fintar a Defesa ativa', () => {
    for (const policies of Object.values(strategyPolicies)) {
      const index = policies.indexOf(responderCerco);
      expect(index).toBeGreaterThan(0);
      expect(['montar a formação', 'fintar a Horda']).toContain(policies[index - 1]?.name);
    }
  });

  it('salva a Defesa ativa nas três ondas e não repete o Plano na visita seguinte', async () => {
    const game = scenario();
    await responderCerco.run(game.view(), game.act);
    expect(game.orders.map(({ type, payload }) => ({ type, payload }))).toEqual(
      [1, 2, 3].map((wave) => ({
        type: 'setBattlePlan',
        payload: { wave, formationId: 'formation-1' },
      })),
    );
    expect(game.state().siege?.plan).toEqual({
      1: 'formation-1',
      2: 'formation-1',
      3: 'formation-1',
    });
    await responderCerco.run(game.view(), game.act);
    expect(game.orders).toHaveLength(3);
    expect(game.refused).toEqual([]);
  });

  it('antes do cerco acompanha a mudança da Defesa ativa', async () => {
    const state = readySiege();
    state.siege!.plan = { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' };
    state.army.formations.push({
      ...structuredClone(state.army.formations[0]!),
      id: 'formation-2',
    });
    state.ids.formation = 2;
    state.army.activeFormationId = 'formation-2';
    const game = scenario(state);
    await responderCerco.run(game.view(), game.act);
    expect(game.state().siege?.plan).toEqual({
      1: 'formation-2',
      2: 'formation-2',
      3: 'formation-2',
    });
    expect(game.refused).toEqual([]);
  });

  it('entre ondas repara e só troca a formação da onda seguinte', async () => {
    const state = afterFirstWave();
    state.settlement.wall.hp.left = 1;
    const game = scenario(state);
    const before = game.view().threat.defense.wall.repairOffer;
    expect(before.canRepair).toBe(true);
    const returned = await responderCerco.run(game.view(), game.act);
    expect(game.orders.map(({ type }) => type)).toEqual(['emergencyRepair', 'swapWaveFormation']);
    expect(game.state().siege?.plan).toEqual({ 1: null, 2: 'formation-1', 3: null });
    expect(returned).toEqual(game.view());
    expect(returned.threat.defense.wall.repairOffer.canRepair).toBe(false);
    expect(game.refused).toEqual([]);
    await responderCerco.run(game.view(), game.act);
    expect(game.orders).toHaveLength(2);
  });

  it('sem recursos para o reparo ainda salva a troca, sem ordem recusada', async () => {
    const state = afterFirstWave();
    state.settlement.wall.hp.left = 1;
    state.settlement.resources.stone = 0;
    state.settlement.resources.gold = 0;
    const game = scenario(state);
    await responderCerco.run(game.view(), game.act);
    expect(game.orders.map(({ type }) => type)).toEqual(['swapWaveFormation']);
    expect(game.refused).toEqual([]);
  });

  it.each(['sem cerco', 'sem Defesa ativa', 'cerco encerrado'] as const)(
    '%s: não manda Plano nem troca',
    async (condition) => {
      const state = readySiege();
      if (condition === 'sem cerco') state.siege = null;
      if (condition === 'sem Defesa ativa') state.army.activeFormationId = null;
      if (condition === 'cerco encerrado') state.siege!.result = 'fall';
      const game = scenario(state);
      await responderCerco.run(game.view(), game.act);
      expect(game.orders).toEqual([]);
      expect(game.refused).toEqual([]);
    },
  );

  it('convoca a milícia quando militiaOffer.canCall é verdadeiro e a prévia da onda 3 dá menos de 50%', async () => {
    const state = readySiege();
    state.siege!.plan = { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' };
    state.army.formations[0]!.posts.right.front = null;
    const now = state.siege!.nextWaveAtMs! - HOUR;
    state.lastProcessedAt = now;
    state.clock.gameTimeMs = now;

    const game = scenario(state);
    const offer = game.view().siege!.militiaOffer;
    expect(offer.canCall).toBe(true);

    await responderCerco.run(game.view(), game.act);
    expect(game.orders.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'simulateBattle', payload: { formationId: 'formation-1', siegeWave: 3 } },
      { type: 'callMilitia', payload: { count: offer.maxCount } },
    ]);
    expect(game.refused).toEqual([]);

    // Na visita seguinte a milícia já está ativa (`canCall: false`): não repete nem gera recusa.
    await responderCerco.run(game.view(), game.act);
    expect(game.orders).toHaveLength(2);
    expect(game.refused).toEqual([]);
  });

  it('não convoca a milícia quando a prévia da onda 3 dá 50% ou mais de vitória', async () => {
    const state = readySiege();
    state.siege!.plan = { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' };
    state.army.formations[0]!.posts.right.front = null;
    const now = state.siege!.nextWaveAtMs! - HOUR;
    state.lastProcessedAt = now;
    state.clock.gameTimeMs = now;
    state.horde.wavePlan!.waves[2]!.composition = [
      { wing: 'left', line: 'front', unit: 'wolf', count: 2 },
    ];
    state.siege!.waves[2]!.composition = [{ wing: 'left', line: 'front', unit: 'wolf', count: 2 }];
    revealWaveThree(state, now, []);

    const game = scenario(state);
    expect(game.view().siege!.militiaOffer.canCall).toBe(true);

    const after = await responderCerco.run(game.view(), game.act);
    expect(after.army.preview?.siegeWave).toBe(3);
    expect(after.army.preview?.winsPercent).toBeGreaterThanOrEqual(50);
    expect(game.orders.map(({ type }) => type)).toEqual(['simulateBattle']);
    expect(game.refused).toEqual([]);
  });

  it('não trata prévia de incursão como onda 3 e não tenta convocar quando canCall é falso', async () => {
    const state = readySiege();
    state.siege!.plan = { 1: 'formation-1', 2: 'formation-1', 3: 'formation-1' };
    // Todos os postos da frente ocupados -> militiaOffer.canCall é falso (NO_MILITIA_SLOT)
    const now = state.siege!.nextWaveAtMs! - HOUR;
    state.lastProcessedAt = now;
    state.clock.gameTimeMs = now;

    const blockedGame = scenario(state);
    expect(blockedGame.view().siege!.militiaOffer.canCall).toBe(false);
    await responderCerco.run(blockedGame.view(), blockedGame.act);
    expect(blockedGame.orders).toEqual([]);
    expect(blockedGame.refused).toEqual([]);

    // Libera um posto na frente e grava uma prévia de incursão (sem siegeWave) com 100% de vitória:
    // o bot não a confunde com a prévia da onda 3; simula a onda 3 e convoca a milícia.
    state.army.formations[0]!.posts.right.front = null;
    const raidPreviewGame = scenario(state);
    await raidPreviewGame.act('simulateBattle', { formationId: 'formation-1' });
    expect(raidPreviewGame.view().army.preview?.siegeWave).toBeNull();
    raidPreviewGame.orders.length = 0;

    await responderCerco.run(raidPreviewGame.view(), raidPreviewGame.act);
    expect(raidPreviewGame.orders.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'simulateBattle', payload: { formationId: 'formation-1', siegeWave: 3 } },
      { type: 'callMilitia', payload: { count: state.settlement.population.villagers / 2 } },
    ]);
    expect(raidPreviewGame.refused).toEqual([]);
  });
});
