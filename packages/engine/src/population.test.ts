import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { freeVillagers, housingCapacity, housingVacancy } from './population';
import {
  accept,
  command,
  eventsOfType,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  refuse,
} from './test-helpers';
import type { ProductionBuildingId } from './types';

describe('valores derivados', () => {
  it('capacidade inicial 10, com 5 aldeões livres', () => {
    const state = newGame();
    expect(housingCapacity(state)).toBe(10);
    expect(freeVillagers(state)).toBe(5);
    expect(housingVacancy(state)).toBe(5);
  });

  it('Salão e Habitações dão +5 de capacidade por nível', () => {
    const state = gameWith((draft) => {
      draft.settlement.buildings.townHall = 3;
      draft.settlement.buildings.housing = 4;
      draft.settlement.buildings.farm = 9;
    });
    expect(housingCapacity(state)).toBe(35);
  });

  it('nada disso é guardado no estado', () => {
    expect(Object.keys(newGame().settlement.population)).toEqual(['villagers']);
  });
});

describe('alocar trabalhadores', () => {
  it('um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres', () => {
    const one = accept(
      newGame(),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ).state;
    const two = accept(one, command('setWorkers', { building: 'lumberMill', count: 2 })).state;
    expect(freeVillagers(one)).toBe(4);
    expect(freeVillagers(two)).toBe(3);
    const wood = (state: typeof one) => advanceTo(state, HOUR).state.settlement.resources.wood;
    expect(wood(one) - 120_000).toBe(8_000);
    expect(wood(two) - 120_000).toBe(16_000);
  });

  it('realocar é imediato: o trecho recomeça com a taxa nova', () => {
    const start = accept(newGame(), command('setWorkers', { building: 'quarry', count: 2 })).state;
    const half = advanceTo(start, 30 * MINUTE).state;
    const moved = accept(half, command('setWorkers', { building: 'quarry', count: 4 })).state;
    // 30 min a 10/h e 30 min a 20/h.
    expect(advanceTo(moved, HOUR).state.settlement.resources.stone).toBe(65_000 + 5_000 + 10_000);
  });

  it('não aloca mais que a população', () => {
    const state = accept(newGame(), command('setWorkers', { building: 'farm', count: 3 })).state;
    expect(refuse(state, command('setWorkers', { building: 'quarry', count: 3 }))).toEqual({
      code: 'NOT_ENOUGH_VILLAGERS',
      message: 'Só há 2 aldeões livres para esse ofício.',
    });
    expect(refuse(state, command('setWorkers', { building: 'farm', count: 6 })).message).toBe(
      'Só há 5 aldeões livres para esse ofício.',
    );
    const full = accept(state, command('setWorkers', { building: 'quarry', count: 1 })).state;
    expect(refuse(full, command('setWorkers', { building: 'goldMine', count: 2 })).message).toBe(
      'Só há 1 aldeão livre para esse ofício.',
    );
  });

  it('pode reduzir e zerar', () => {
    const three = accept(newGame(), command('setWorkers', { building: 'farm', count: 3 })).state;
    const zero = accept(three, command('setWorkers', { building: 'farm', count: 0 })).state;
    expect(zero.settlement.workers.farm).toBe(0);
    expect(freeVillagers(zero)).toBe(5);
  });

  it.each([
    ['housing' as ProductionBuildingId, 1],
    ['townHall' as ProductionBuildingId, 1],
    ['farm' as const, -1],
    ['farm' as const, 1.5],
    ['farm' as const, Number.NaN],
  ])('recusa %s com %d trabalhadores', (building, count) => {
    expect(refuse(newGame(), command('setWorkers', { building, count })).code).toBe(
      'INVALID_WORKERS',
    );
  });
});

describe('recrutar', () => {
  it('desconta o custo na ordem e cada aldeão chega 20 minutos depois do anterior', () => {
    const { state, events } = accept(newGame(), command('recruitVillagers', { quantity: 3 }));
    expect(state.settlement.resources).toMatchObject({ food: 30_000, gold: 220_000 });
    expect(state.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 20 * MINUTE },
      { finishesAtMs: 40 * MINUTE },
      { finishesAtMs: 60 * MINUTE },
    ]);
    expect(state.settlement.population.villagers).toBe(5);
    expect(events).toMatchObject([{ type: 'recruitmentStarted', data: { quantity: 3 } }]);

    const first = advanceTo(state, 20 * MINUTE);
    expect(first.state.settlement.population.villagers).toBe(6);
    const all = advanceTo(first.state, HOUR);
    expect(all.state.settlement.population.villagers).toBe(8);
    expect(eventsOfType(all.events, 'recruitmentFinished').map((event) => event.atMs)).toEqual([
      40 * MINUTE,
      60 * MINUTE,
    ]);
    expect(all.state.stats.villagersRecruited).toBe(3);
  });

  it('uma segunda ordem entra depois do último da fila', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 500_000;
    });
    const first = accept(state, command('recruitVillagers', { quantity: 2 })).state;
    const later = advanceTo(first, 25 * MINUTE).state;
    const second = accept(later, command('recruitVillagers', { quantity: 1 })).state;
    expect(second.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 40 * MINUTE },
      { finishesAtMs: 60 * MINUTE },
    ]);
  });

  it('com a fila vazia, conta os 20 minutos a partir de agora', () => {
    const later = advanceTo(newGame(), 7 * MINUTE).state;
    const { state } = accept(later, command('recruitVillagers', { quantity: 1 }));
    expect(state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: 27 * MINUTE }]);
  });

  it('recrutar 3 com 1 vaga é recusado e nenhum recurso é descontado', () => {
    const crowded = gameWith((draft) => {
      draft.settlement.population.villagers = 9;
      draft.settlement.resources.food = 900_000;
    });
    const refusal = refuse(crowded, command('recruitVillagers', { quantity: 3 }));
    expect(refusal).toEqual({
      code: 'HOUSING_FULL',
      message: 'Só há vaga para mais 1 nas Habitações.',
    });
    expect(crowded.settlement.resources.food).toBe(900_000);
    expect(crowded.settlement.recruitmentQueue).toEqual([]);
  });

  it('quem está em treinamento já ocupa vaga', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 900_000;
    });
    const queued = accept(state, command('recruitVillagers', { quantity: 5 })).state;
    expect(housingVacancy(queued)).toBe(0);
    const arrived = advanceTo(queued, 2 * HOUR).state;
    expect(refuse(arrived, command('recruitVillagers', { quantity: 1 }))).toEqual({
      code: 'HOUSING_FULL',
      message: 'Não há vaga nas Habitações. Melhore as Habitações ou o Salão.',
    });
  });

  it('a fila aceita no máximo 5 aldeões', () => {
    const roomy = gameWith((draft) => {
      draft.settlement.resources.food = 900_000;
      draft.settlement.buildings.housing = 5;
    });
    const queued = accept(roomy, command('recruitVillagers', { quantity: 3 })).state;
    expect(refuse(queued, command('recruitVillagers', { quantity: 3 }))).toEqual({
      code: 'RECRUIT_QUEUE_FULL',
      message: 'Só cabem mais 2 na fila de recrutamento.',
    });
    const full = accept(queued, command('recruitVillagers', { quantity: 2 })).state;
    expect(refuse(full, command('recruitVillagers', { quantity: 1 })).message).toBe(
      'Já há 5 aldeões a caminho. Espere algum chegar.',
    );
  });

  it('recusa sem comida ou ouro para a ordem inteira', () => {
    expect(refuse(newGame(), command('recruitVillagers', { quantity: 4 }))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 20 comida.',
    });
  });

  it.each([0, 6, -1, 2.5])('recusa a quantidade %d', (quantity) => {
    expect(refuse(newGame(), command('recruitVillagers', { quantity }))).toEqual({
      code: 'INVALID_QUANTITY',
      message: 'Recrute de 1 a 5 aldeões por ordem.',
    });
  });

  it('com fome, a ordem é recusada e a fila em andamento congela', () => {
    const starving = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.resources.gold = 900_000;
      draft.settlement.famine = { sinceMs: 0 };
      draft.settlement.recruitmentQueue = [{ finishesAtMs: 10 * MINUTE }];
    });
    expect(refuse(starving, command('recruitVillagers', { quantity: 1 })).code).toBe('FAMINE');
    const later = advanceTo(starving, 5 * HOUR);
    expect(later.state.settlement.population.villagers).toBe(5);
    expect(eventsOfType(later.events, 'recruitmentFinished')).toEqual([]);
  });
});
