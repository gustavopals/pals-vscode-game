import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  autumnScenario,
  command,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  objectivesScenario,
  winterColdScenario,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const farmers = accept(newGame(), command('setWorkers', { building: 'farm', count: 2 })).state;

describe('deriveViewState', () => {
  it('estado inicial: 5 aldeões livres, 10 vagas e nada em andamento', () => {
    const initial = view(newGame());
    expect(initial.settlement).toEqual({
      name: 'Pedra Alta',
      townHallLevel: 1,
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Normal: um ano em 7 dias',
    });
    expect(initial.calendar).toEqual({
      year: 1,
      season: 'spring',
      seasonLabel: 'Primavera',
      dayOfSeason: 1,
      dayOfYear: 1,
      secondsToNextDay: 7200,
      secondsToNextSeason: 24 * 7200,
      seasonEffects: 'Primavera: comida × 1,2; recrutamento com prazo × 0,8.',
      nextSeason: {
        id: 'summer',
        label: 'Verão',
        secondsUntil: 24 * 7200,
        changes: [
          'A produção de comida passa de × 1,2 para × 1.',
          'A produção de madeira e pedra passa de × 1 para × 1,15.',
          'O recrutamento volta ao prazo de sempre.',
        ],
        firewood: null,
      },
    });
    expect(initial.population).toMatchObject({
      villagers: 5,
      capacity: 10,
      free: 5,
      inTraining: 0,
    });
    expect(initial.population.breakdown).toBe(
      'Salão do Senhor Nv1 × 5 + Habitações Nv1 × 5 = 10 vagas',
    );
    expect(initial.resources.map((row) => [row.id, row.stock, row.cap, row.perHour])).toEqual([
      ['food', 180, null, -5],
      ['wood', 120, null, 0],
      ['stone', 65, null, 0],
      ['gold', 250, null, 0],
    ]);
    expect(initial.resources[0]?.depletesInSeconds).toBe(36 * 3600);
    expect(initial.constructions.active).toBeNull();
    expect(initial.famine).toBeNull();
    expect(initial.winter).toBeNull();
    expect(initial.pendingDecisions).toEqual([]);
  });

  it('com 2 trabalhadores na Fazenda e 5 habitantes, a comida rende +19/h líquida na primavera', () => {
    const food = view(farmers).resources[0];
    expect(food).toMatchObject({ id: 'food', perHour: 19, depletesInSeconds: null });
    expect(food?.breakdown).toBe(
      'Fazenda: 2 trabalhadores × 10 × 1 (Nv1) × 1,2 (primavera) = 24/h; consumo 5 × 1 = 5/h',
    );
  });

  it('a explicação segue o formato do GDD §13.3', () => {
    const state = gameWith((draft) => {
      draft.settlement.population.villagers = 18;
      draft.settlement.workers.farm = 4;
      draft.settlement.buildings.farm = 2;
    });
    const derived = view(state);
    expect(derived.resources[0]?.breakdown).toBe(
      'Fazenda: 4 trabalhadores × 10 × 1,2 (Nv2) × 1,2 (primavera) = 57,6/h; consumo 18 × 1 = 18/h',
    );
    expect(derived.workers[0]).toMatchObject({
      building: 'farm',
      level: 2,
      assigned: 4,
      grossPerHour: 57.6,
      perWorkerPerHour: 14.4,
      breakdown: '4 trabalhadores × 10 × 1,2 (Nv2) × 1,2 (primavera) = 57,6/h',
    });
    // Um fator neutro (a madeira na primavera) não aparece na explicação.
    expect(derived.workers[1]?.breakdown).toBe('0 trabalhadores × 8 × 1 (Nv1) = 0/h');
  });

  it('lista as melhorias disponíveis com custos, duração e motivo de bloqueio', () => {
    const { available } = view(farmers).constructions;
    expect(available.map((entry) => entry.building)).toEqual([
      'townHall',
      'farm',
      'lumberMill',
      'quarry',
      'goldMine',
      'housing',
    ]);
    const byBuilding = Object.fromEntries(available.map((entry) => [entry.building, entry]));
    expect(byBuilding.lumberMill).toMatchObject({
      label: 'Serraria',
      fromLevel: 1,
      targetLevel: 2,
      durationSeconds: 300,
      durationNote: null,
      affordable: true,
      blockedCode: null,
      blockedReason: null,
      cost: [
        { resource: 'wood', label: 'Madeira', amount: 100, missing: 0 },
        { resource: 'stone', label: 'Pedra', amount: 50, missing: 0 },
      ],
    });
    expect(byBuilding.townHall).toMatchObject({
      affordable: false,
      blockedCode: 'INSUFFICIENT_RESOURCES',
      blockedReason: 'Faltam 30 madeira e 35 pedra.',
    });
    expect(byBuilding.townHall?.cost).toEqual([
      { resource: 'wood', label: 'Madeira', amount: 150, missing: 30 },
      { resource: 'stone', label: 'Pedra', amount: 100, missing: 35 },
      { resource: 'gold', label: 'Ouro', amount: 100, missing: 0 },
    ]);
    expect(available.filter((entry) => entry.affordable).map((entry) => entry.building)).toEqual([
      'farm',
      'lumberMill',
      'quarry',
      'housing',
    ]);
  });

  it('mostra a obra ativa com contagem regressiva e progresso, e a tira das disponíveis', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
    const derived = deriveViewState(started, 2 * MINUTE);
    expect(derived.constructions.active).toEqual({
      building: 'farm',
      label: 'Fazenda',
      targetLevel: 2,
      secondsRemaining: 180,
      totalSeconds: 300,
      progressPercent: 40,
      // 80% de 80 madeira e 40 ouro.
      refund: [
        { resource: 'wood', label: 'Madeira', amount: 64 },
        { resource: 'gold', label: 'Ouro', amount: 32 },
      ],
    });
    expect(derived.constructions.available.map((entry) => entry.building)).not.toContain('farm');
    expect(derived.constructions.available[0]?.blockedReason).toBe(
      'Os pedreiros já estão ocupados com outra obra.',
    );
  });

  it('mostra as obras planejadas com o custo do nível planejado', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
    const planned = accept(started, command('planConstruction', { building: 'farm' })).state;
    expect(view(planned).constructions.planned).toMatchObject([
      {
        building: 'farm',
        fromLevel: 2,
        targetLevel: 3,
        durationSeconds: 450,
        planned: true,
        affordable: false,
        cost: [
          { resource: 'wood', amount: 128, missing: 88 },
          { resource: 'gold', amount: 64, missing: 0 },
        ],
      },
    ]);
    const other = accept(newGame(), command('planConstruction', { building: 'housing' })).state;
    expect(view(other).constructions.available.at(-1)).toMatchObject({ planned: true });
    expect(view(other).constructions.planned[0]).toMatchObject({ affordable: true });
  });

  it('informa o recrutamento: custo, vagas e fila', () => {
    expect(view(newGame()).recruitment).toEqual({
      cost: [
        { resource: 'food', label: 'Comida', amount: 50, missing: 0 },
        { resource: 'gold', label: 'Ouro', amount: 10, missing: 0 },
      ],
      // Na primavera, 20 min × 0,8.
      secondsPerVillager: 960,
      durationNote: 'Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8.',
      maxQuantity: 5,
      blockedReason: null,
    });
    const queued = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    const derived = deriveViewState(queued, 5 * MINUTE);
    expect(derived.population).toMatchObject({ inTraining: 3, secondsToNextRecruit: 660 });
    expect(derived.recruitment).toMatchObject({
      maxQuantity: 2,
      blockedReason: 'Faltam 21 comida.',
    });
  });

  it('na fome, mostra o aviso, a penalidade na explicação e a fila congelada', () => {
    const queued = accept(
      gameWith((draft) => {
        draft.settlement.resources.food = 51_000;
        draft.settlement.workers.lumberMill = 1;
      }),
      command('recruitVillagers', { quantity: 1 }),
    ).state;
    const derived = deriveViewState(queued, HOUR);
    expect(derived.famine).toMatchObject({ sinceMs: 12 * MINUTE, secondsElapsed: 48 * 60 });
    expect(derived.population.secondsToNextRecruit).toBeNull();
    expect(derived.recruitment.blockedReason).toMatch(/fome/);
    expect(derived.workers[1]?.breakdown).toBe('1 trabalhador × 8 × 1 (Nv1) × 0,75 (fome) = 6/h');
    expect(derived.resources[0]).toMatchObject({ stock: 0, perHour: -5, depletesInSeconds: null });
  });

  it('lista os objetivos revelados com progresso', () => {
    const queued = accept(farmers, command('recruitVillagers', { quantity: 2 })).state;
    expect(deriveViewState(queued, HOUR).objectives).toEqual([
      {
        id: 'allocateFarmers',
        title: 'Aloque 2 aldeões na Fazenda',
        hint: 'Comida é o que mantém todo o resto.',
        reward: '+20 ouro',
        status: 'completed',
        progress: { current: 2, target: 2 },
      },
      expect.objectContaining({ id: 'upgradeHousing', status: 'active' }),
      expect.objectContaining({ id: 'recruitVillagers', progress: { current: 2, target: 3 } }),
      expect.objectContaining({ id: 'townHallLevel2', progress: { current: 1, target: 2 } }),
    ]);
  });

  it('avança sozinho até o instante pedido, sem mutar a entrada, e não volta no tempo', () => {
    const before = JSON.stringify(farmers);
    const derived = deriveViewState(farmers, 2 * HOUR);
    expect(derived.resources[0]?.stock).toBe(218);
    expect(derived.calendar).toMatchObject({ dayOfSeason: 2, secondsToNextDay: 7200 });
    expect(JSON.stringify(farmers)).toBe(before);
    expect(derived).toEqual(view(advanceTo(farmers, 2 * HOUR).state));
    expect(() => deriveViewState(advanceTo(farmers, HOUR).state, 0)).toThrow(/não volta no tempo/);
  });
});

describe('golden do ViewState', () => {
  it('estado inicial, primeira alocação e fim do cenário dos objetivos', async () => {
    const golden = {
      initial: view(newGame('pedra-alta')),
      afterFirstAllocation: view(farmers),
      afterObjectivesScenario: view(objectivesScenario().state),
      // As estações: o outono de quem ainda não guardou lenha e o inverno de quem ficou sem ela.
      autumnBeforeWinter: view(autumnScenario()),
      winterCold: view(winterColdScenario()),
    };
    await expect(`${JSON.stringify(golden, null, 2)}\n`).toMatchFileSnapshot(
      './__golden__/view-seed-pedra-alta.json',
    );
  });
});
