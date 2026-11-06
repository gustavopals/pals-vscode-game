import { advanceTo, deriveViewState, type GameState } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { revealWaveThree } from '../../../engine/src/hordePlan';
import { readySiege } from '../../../engine/src/siege.test-helpers';
import { HOUR } from '../../../engine/src/test-helpers';
import { applySimCommand, type SimCommand } from '../engine';
import { strategyPolicies } from './index';
import { responderCerco, planejarAutomaticas } from './policies';
import { prepareSiege, respondPreparedSiege, trainForSiege } from './siegePreparation';
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
      const index = policies.findIndex((policy) =>
        [responderCerco, respondPreparedSiege].includes(policy),
      );
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
    expect(game.orders.map(({ type, payload }) => ({ type, payload }))).toEqual([
      { type: 'emergencyRepair', payload: { wave: 2 } },
      { type: 'swapWaveFormation', payload: { wave: 2, formationId: 'formation-1' } },
    ]);
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
      // Sem Defesa ativa ainda pode haver oferta para a milícia defender sozinha (§21).
      expect(game.orders.map(({ type }) => type)).toEqual(
        condition === 'sem Defesa ativa' ? ['callMilitia'] : [],
      );
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

describe('preparo do Cerco pela visão (V4G-T5.3)', () => {
  it('só os bots preparados ampliam a infraestrutura e o treino de outono', () => {
    expect(strategyPolicies.preguicoso).not.toContain(prepareSiege);
    expect(strategyPolicies.preguicoso).not.toContain(trainForSiege);
    for (const name of ['economico', 'explorador', 'militar'] as const) {
      expect(strategyPolicies[name]).toContain(prepareSiege);
      expect(strategyPolicies[name]).toContain(respondPreparedSiege);
    }
  });

  it('melhora Quartel, Torre e Muralha já existentes sem depender da Ameaça escondida', async () => {
    const state = readySiege();
    state.settlement.buildings.barracks = 1;
    state.settlement.buildings.watchtower = 1;
    state.settlement.buildings.palisade = 1;
    state.army.units = { spearman: 5, archer: 5, swordsman: 0, knight: 0, shieldbearer: 0 };
    const game = scenario(state);
    await prepareSiege.run(game.view(), game.act);
    expect(game.orders).toContainEqual(
      expect.objectContaining({ type: 'startConstruction', payload: { building: 'barracks' } }),
    );
    for (const building of ['watchtower', 'palisade']) {
      expect(
        game.orders.some(
          ({ type, payload }) =>
            ['startConstruction', 'planConstruction'].includes(type) &&
            'building' in payload &&
            payload.building === building,
        ),
      ).toBe(true);
    }
    expect(game.refused).toEqual([]);
  });

  it('não duplica planejada de nível alto conservada após a Queda', async () => {
    const state = readySiege();
    state.settlement.buildings.barracks = 2;
    state.settlement.planned = [{ building: 'barracks', targetLevel: 6, autoStart: false }];
    state.settlement.resources.wood = 0;
    const game = scenario(state);
    expect(
      game.view().constructions.available.find(({ building }) => building === 'barracks')?.planned,
    ).toBe(false);
    await prepareSiege.run(game.view(), game.act);
    await planejarAutomaticas.run(game.view(), game.act);
    expect(
      game.orders.filter(
        ({ type, payload }) =>
          type === 'planConstruction' && 'building' in payload && payload.building === 'barracks',
      ),
    ).toEqual([]);
    expect(game.refused).toEqual([]);
  });

  it('não prepara obras na primavera, com fome ou depois do desfecho', async () => {
    for (const condition of ['spring', 'famine', 'fall']) {
      const game = scenario();
      const view = game.view();
      if (condition === 'spring') view.calendar.season = 'spring';
      if (condition === 'famine')
        view.famine = { sinceMs: 0, secondsElapsed: 1, endsInSeconds: null, text: 'Fome.' };
      if (condition === 'fall') view.siege!.result = 'fall';
      await prepareSiege.run(view, game.act);
      expect(game.orders).toEqual([]);
    }
  });

  it.each([responderCerco, respondPreparedSiege])(
    '$name: convoca a milícia mesmo sem soldados nem Defesa ativa',
    async (policy) => {
      const state = readySiege();
      state.army.units = { spearman: 0, archer: 0, swordsman: 0, knight: 0, shieldbearer: 0 };
      state.army.formations = [];
      state.army.activeFormationId = null;
      const game = scenario(state);
      const offer = game.view().siege!.militiaOffer;
      expect(offer.canCall).toBe(true);
      await policy.run(game.view(), game.act);
      expect(game.orders).toEqual([
        expect.objectContaining({ type: 'callMilitia', payload: { count: offer.maxCount } }),
      ]);
      await policy.run(game.view(), game.act);
      expect(game.orders).toHaveLength(1);
      expect(game.refused).toEqual([]);
    },
  );

  it('treina o lote ofertado além do antigo limite de um quarto, respeitando o teto do Quartel', async () => {
    const state = readySiege();
    state.army.units = { spearman: 10, archer: 10, swordsman: 0, knight: 0, shieldbearer: 0 };
    state.settlement.population.villagers = 80;
    const game = scenario(state);
    const view = game.view();
    view.resources.find(({ id }) => id === 'food')!.perHour = 100;
    const offer = view.army.offer.find(({ unit }) => unit === 'spearman')!;
    await trainForSiege.run(view, game.act);
    expect(game.orders).toEqual([
      expect.objectContaining({
        type: 'trainSoldiers',
        payload: { unit: 'spearman', amount: offer.maxAmount },
      }),
    ]);
    expect(game.refused).toEqual([]);
  });

  it('usa todos os tipos disponíveis, revê baixas e salva o Plano com prévias das três ondas', async () => {
    const state = readySiege();
    state.army.formations[0]!.name = 'Defesa do bot';
    const game = scenario(state);
    await respondPreparedSiege.run(game.view(), game.act);
    expect(
      game.orders.filter(({ type }) => type === 'simulateBattle').map(({ payload }) => payload),
    ).toEqual(
      expect.arrayContaining([1, 2, 3].map((siegeWave) => expect.objectContaining({ siegeWave }))),
    );
    const plannedIds = Object.values(game.state().siege!.plan);
    expect(
      plannedIds.every((id) =>
        game.state().army.formations.some((formation) => formation.id === id),
      ),
    ).toBe(true);
    const prepared = game
      .view()
      .army.formations.filter(({ name }) => name.startsWith('Defesa do bot'));
    expect(prepared.every(({ shortfall }) => shortfall.length === 0)).toBe(true);
    expect(prepared[0]!.total).toBe(game.view().army.total);
    expect(game.refused).toEqual([]);
  });
});
