import { advanceTo, deriveViewState, type GameState } from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { revealWaveThree } from '../../../engine/src/hordePlan';
import { readySiege } from '../../../engine/src/siege.test-helpers';
import { HOUR } from '../../../engine/src/test-helpers';
import { applySimCommand, type SimCommand } from '../engine';
import { strategyPolicies } from './index';
import { responderCerco, planejarAutomaticas, erguerQuartel, montarFormacao } from './policies';
import {
  prepareSiege,
  preparingSiege,
  respondPreparedSiege,
  trainForSiege,
  treinarNoInverno,
} from './siegePreparation';
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
  it('vincula o reparo e a troca à onda da decisão pública', async () => {
    const state = afterFirstWave();
    state.settlement.wall.hp.left = 1;
    const game = scenario(state);
    const decision = game.view().pendingDecisions.find((entry) => entry.kind === 'siegeWave');
    expect(decision?.wave).toBe(2);
    await respondPreparedSiege.run(game.view(), game.act);
    expect(
      game.orders
        .filter(({ type }) => ['emergencyRepair', 'swapWaveFormation'].includes(type))
        .map(({ type, payload }) => ({ type, payload })),
    ).toEqual([
      { type: 'emergencyRepair', payload: { wave: decision!.wave } },
      {
        type: 'swapWaveFormation',
        payload: { wave: decision!.wave, formationId: game.state().siege!.plan[2] },
      },
    ]);
    expect(game.state().siege!.plan[1]).toBeNull();
    expect(game.state().siege!.plan[3]).toBeNull();
    expect(game.refused).toEqual([]);
  });

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

  describe('preparação militar refinada do bot (Proposta 1)', () => {
    it('preparingSiege ativa no verão, outono e inverno, e desativa na primavera', () => {
      const state = readySiege();
      const game = scenario(state);
      const view = game.view();
      view.calendar.season = 'summer';
      expect(preparingSiege(view)).toBe(true);
      view.calendar.season = 'autumn';
      expect(preparingSiege(view)).toBe(true);
      view.calendar.season = 'winter';
      expect(preparingSiege(view)).toBe(true);
      view.calendar.season = 'spring';
      expect(preparingSiege(view)).toBe(false);
    });

    it('prepareSiege prioriza Salão até Nv4 no verão e infraestrutura mínima', async () => {
      const state = readySiege();
      state.lastProcessedAt = 60 * HOUR;
      state.clock.gameTimeMs = 60 * HOUR;
      state.settlement.buildings.townHall = 2;
      state.settlement.buildings.barracks = 0;
      state.settlement.buildings.palisade = 0;
      state.settlement.buildings.watchtower = 0;
      // Estoque farto para pagar qualquer obra
      Object.assign(state.settlement.resources, { wood: 500_000, stone: 500_000, gold: 500_000 });
      const game = scenario(state);
      expect(game.view().calendar.season).toBe('summer');

      await prepareSiege.run(game.view(), game.act);
      // Deve iniciar townHall 2 -> 3 primeiro
      expect(game.orders[0]).toEqual(
        expect.objectContaining({ type: 'startConstruction', payload: { building: 'townHall' } }),
      );
    });

    it('prepareSiege planeja o Quartel com autoStart quando bloqueado por GATE_LOCKED', async () => {
      const state = readySiege();
      state.lastProcessedAt = 60 * HOUR;
      state.clock.gameTimeMs = 60 * HOUR;
      state.settlement.buildings.townHall = 3;
      state.settlement.buildings.barracks = 0;
      state.settlement.planned = [];
      const game = scenario(state);
      const barracksUpgrade = game
        .view()
        .constructions.available.find((b) => b.building === 'barracks');
      expect(barracksUpgrade?.blockedCode).toBe('GATE_LOCKED');

      await prepareSiege.run(game.view(), game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'planConstruction',
          payload: expect.objectContaining({ building: 'barracks', autoStart: true }),
        }),
      );
      expect(game.refused).toEqual([]);
    });

    it.each([
      { pace: 0.5, level: 1, training: 0, improves: false },
      { pace: 1, level: 1, training: 0, improves: false },
      { pace: 3, level: 1, training: 0, improves: false },
      { pace: 3, level: 1, training: 10, improves: true },
      { pace: 3, level: 3, training: 0, improves: false },
      { pace: 3, level: 3, training: 10, improves: false },
    ])(
      'prepara vagas para o lote público: ritmo $pace, Quartel $level, treino $training',
      async ({ pace, level, training, improves }) => {
        const state = readySiege();
        state.settings.timeScale = pace;
        state.lastProcessedAt = 100 * HOUR;
        state.clock.gameTimeMs = 100 * HOUR;
        state.settlement.buildings.barracks = level;
        state.settlement.buildings.townHall = 4;
        state.army.units = { spearman: 0, archer: 0, swordsman: 0, knight: 0, shieldbearer: 0 };
        state.army.training =
          training === 0
            ? null
            : {
                unit: 'spearman',
                amount: training,
                startedAtMs: 100 * HOUR,
                endsAtMs: 101 * HOUR,
              };
        Object.assign(state.settlement.resources, {
          wood: 5_000_000,
          stone: 5_000_000,
          gold: 5_000_000,
        });
        const game = scenario(state);
        // O lote ofertado agora é limitado pelas vagas; batchMax continua revelando o teto do ritmo.
        expect(game.view().army.offer[0]?.batchMax).toBe(pace === 3 ? 30 : 10);

        await prepareSiege.run(game.view(), game.act);
        expect(
          game.orders.some(
            (o) =>
              ['startConstruction', 'planConstruction'].includes(o.type) &&
              'building' in o.payload &&
              o.payload.building === 'barracks',
          ),
        ).toBe(improves);
        expect(game.refused).toEqual([]);
      },
    );

    it('erguerQuartel planeja o Quartel com autoStart quando o Salão for Nv3+ e estiver bloqueado', async () => {
      const state = readySiege();
      state.lastProcessedAt = 60 * HOUR;
      state.clock.gameTimeMs = 60 * HOUR;
      state.settlement.buildings.townHall = 3;
      state.settlement.buildings.barracks = 0;
      state.settlement.population.villagers = 20;
      state.settlement.planned = [];
      const game = scenario(state);
      const upgrade = game.view().constructions.available.find((b) => b.building === 'barracks')!;
      expect(upgrade.blockedCode).toBe('GATE_LOCKED');

      await erguerQuartel.run(game.view(), game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'planConstruction',
          payload: expect.objectContaining({ building: 'barracks', autoStart: true }),
        }),
      );
      expect(game.refused).toEqual([]);
    });

    it('montarFormacao considera o lote em treino ao montar e salvar a formação', async () => {
      const state = readySiege();
      state.army.units = { spearman: 0, archer: 0, swordsman: 0, knight: 0, shieldbearer: 0 };
      state.army.formations = [];
      state.army.activeFormationId = null;
      state.army.training = {
        unit: 'spearman',
        amount: 8,
        startedAtMs: 0,
        endsAtMs: 3_600_000,
      };
      const game = scenario(state);
      expect(game.view().army.total).toBe(0);
      expect(game.view().army.training?.amount).toBe(8);

      await montarFormacao.run(game.view(), game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'saveFormation',
          payload: expect.objectContaining({
            posts: expect.objectContaining({
              center: expect.objectContaining({
                front: { unit: 'spearman', count: 8 },
              }),
            }),
          }),
        }),
      );
      expect(game.refused).toEqual([]);
    });

    it('respondPreparedSiege nomeia herói ocioso como comandante central no inverno', async () => {
      const state = readySiege();
      state.lastProcessedAt = 150 * HOUR;
      state.clock.gameTimeMs = 150 * HOUR;
      state.guild.heroes = [
        {
          id: 'hero-1',
          name: 'Gareth',
          gender: 'm',
          classId: 'warrior',
          level: 1,
          xp: 0,
          traits: [],
          status: 'idle',
          injury: null,
          captivity: null,
          equipment: { weapon: null, armor: null, accessory: null },
          discontent: false,
          joinedAtMs: 0,
          freedAtMs: null,
        },
      ];
      state.army.formations[0]!.commanders = { left: null, center: null, right: null };
      const game = scenario(state);
      expect(game.view().calendar.season).toBe('winter');
      expect(game.view().army.editor.heroes.find((h) => h.heroId === 'hero-1')?.reason).toBeNull();

      await respondPreparedSiege.run(game.view(), game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'saveFormation',
          payload: expect.objectContaining({
            commanders: { left: null, center: 'hero-1', right: null },
          }),
        }),
      );
      expect(game.refused).toEqual([]);
    });

    it('respondPreparedSiege não nomeia comandante no outono', async () => {
      const state = readySiege();
      state.lastProcessedAt = 100 * HOUR;
      state.clock.gameTimeMs = 100 * HOUR;
      state.guild.heroes = [
        {
          id: 'hero-1',
          name: 'Gareth',
          gender: 'm',
          classId: 'warrior',
          level: 1,
          xp: 0,
          traits: [],
          status: 'idle',
          injury: null,
          captivity: null,
          equipment: { weapon: null, armor: null, accessory: null },
          discontent: false,
          joinedAtMs: 0,
          freedAtMs: null,
        },
      ];
      state.army.formations[0]!.commanders = { left: null, center: null, right: null };
      const game = scenario(state);
      expect(game.view().calendar.season).toBe('autumn');

      await respondPreparedSiege.run(game.view(), game.act);
      const saves = game.orders.filter((o) => o.type === 'saveFormation');
      for (const save of saves) {
        expect(save.payload.commanders.center).toBeNull();
      }
    });

    it('siegeTrainingPolicy prioriza lanceiros enquanto houver menos de 12 ou menos que 2x arqueiros', async () => {
      const state = readySiege();
      state.army.units = { spearman: 2, archer: 2, swordsman: 0, knight: 0, shieldbearer: 0 };
      state.settlement.population.villagers = 80;
      const game = scenario(state);
      const view = game.view();
      view.resources.find(({ id }) => id === 'food')!.perHour = 100;

      await trainForSiege.run(view, game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'trainSoldiers',
          payload: expect.objectContaining({ unit: 'spearman' }),
        }),
      );
    });

    it('siegeTrainingPolicy treina arqueiros quando há lanceiros suficientes (>= 12 e >= 2x)', async () => {
      const state = readySiege();
      state.army.units = { spearman: 16, archer: 2, swordsman: 0, knight: 0, shieldbearer: 0 };
      state.settlement.population.villagers = 80;
      const game = scenario(state);
      const view = game.view();
      view.resources.find(({ id }) => id === 'food')!.perHour = 100;

      await trainForSiege.run(view, game.act);
      expect(game.orders).toContainEqual(
        expect.objectContaining({
          type: 'trainSoldiers',
          payload: expect.objectContaining({ unit: 'archer' }),
        }),
      );
    });

    it('treinarNoInverno só executa o treino no inverno', async () => {
      const state = readySiege();
      state.lastProcessedAt = 100 * HOUR;
      state.clock.gameTimeMs = 100 * HOUR;
      const game = scenario(state);
      await treinarNoInverno.run(game.view(), game.act);
      expect(game.orders).toEqual([]);

      state.lastProcessedAt = 150 * HOUR;
      state.clock.gameTimeMs = 150 * HOUR;
      state.army.units = { spearman: 2, archer: 2, swordsman: 0, knight: 0, shieldbearer: 0 };
      state.settlement.population.villagers = 80;
      const winterGame = scenario(state);
      const view = winterGame.view();
      view.resources.find(({ id }) => id === 'food')!.perHour = 100;
      await treinarNoInverno.run(view, winterGame.act);
      expect(winterGame.orders.some((o) => o.type === 'trainSoldiers')).toBe(true);
    });
  });
});
