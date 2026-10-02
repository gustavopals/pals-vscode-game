import { objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { describeReward, objectiveProgress } from './objectives';
import {
  accept,
  command,
  eventsOfType,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  objectivesScenario,
  play,
} from './test-helpers';

describe('objetivos', () => {
  it('começa com três ativos e o quarto escondido', () => {
    expect(newGame().objectives).toEqual({
      active: ['allocateFarmers', 'upgradeHousing', 'recruitVillagers'],
      completed: [],
    });
  });

  it('concluir um revela o próximo e credita a recompensa', () => {
    const { state, events } = accept(
      newGame(),
      command('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(state.objectives).toEqual({
      active: ['upgradeHousing', 'recruitVillagers', 'townHallLevel2'],
      completed: ['allocateFarmers'],
    });
    expect(state.settlement.resources.gold).toBe(250_000 + 20_000);
    expect(events).toMatchObject([
      { type: 'objectiveCompleted', atMs: 0, data: { objective: 'allocateFarmers' } },
    ]);
    expect(events[0]?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Aloque 2 aldeões na Fazenda. Recompensa: +20 ouro.',
    );
  });

  it('um fazendeiro só não cumpre o primeiro objetivo', () => {
    const { state, events } = accept(
      newGame(),
      command('setWorkers', { building: 'farm', count: 1 }),
    );
    expect(state.objectives.completed).toEqual([]);
    expect(events).toEqual([]);
  });

  it('o objetivo de recrutamento conta os aldeões que chegaram, não os encomendados', () => {
    const ordered = accept(newGame(), command('recruitVillagers', { quantity: 3 }));
    expect(ordered.state.objectives.completed).toEqual([]);
    const arrived = play(ordered.state, [{ at: HOUR }]);
    expect(arrived.state.objectives.completed).toEqual(['recruitVillagers']);
    // Na primavera cada aldeão leva 16 minutos: o terceiro chega aos 48.
    expect(eventsOfType(arrived.events, 'objectiveCompleted')[0]).toMatchObject({
      atMs: 48 * MINUTE,
    });
    // 180 − 150 do recrutamento, menos o consumo de 5, 6 e 7 habitantes por 16 min e de 8 por
    // 12 min, mais os 40 da recompensa.
    expect(arrived.state.settlement.resources.food).toBe(30_000 - 6_400 + 40_000);
  });

  it('um objetivo só é avaliado depois de revelado', () => {
    // Salão já no nível 2, mas o quarto objetivo ainda está escondido.
    const ahead = gameWith((draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const renamed = accept(ahead, command('renameSettlement', { name: 'Vau Alto' }));
    expect(renamed.state.objectives.completed).toEqual([]);
    // Ao concluir o primeiro, o quarto é revelado e cumprido no mesmo instante.
    const { state, events } = accept(
      renamed.state,
      command('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(state.objectives.completed).toEqual(['allocateFarmers', 'townHallLevel2']);
    expect(eventsOfType(events, 'objectiveCompleted')).toHaveLength(2);
    expect(state.objectives.active).toEqual(['upgradeHousing', 'recruitVillagers']);
  });

  it('o cenário roteirizado conclui os quatro, com +20 ouro, +30 madeira, +40 comida e +50 ouro', () => {
    const { state, events } = objectivesScenario();
    expect(state.objectives).toEqual({
      active: [],
      completed: ['allocateFarmers', 'upgradeHousing', 'recruitVillagers', 'townHallLevel2'],
    });
    const completed = eventsOfType(events, 'objectiveCompleted');
    expect(completed.map((event) => event.data.objective)).toEqual(state.objectives.completed);
    expect(completed.map((event) => event.text.split('Recompensa: ')[1])).toEqual([
      '+20 ouro.',
      '+30 madeira.',
      '+40 comida.',
      '+50 ouro.',
    ]);
    expect(state.settlement.buildings.townHall).toBe(2);
  });

  it('informa o progresso de cada condição', () => {
    const state = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;
    const later = play(state, [{ at: HOUR }]).state;
    const progress = objectives.map((objective) => objectiveProgress(later, objective.condition));
    expect(progress).toEqual([
      { current: 0, target: 2 },
      { current: 0, target: 1 },
      { current: 2, target: 3 },
      { current: 1, target: 2 },
    ]);
  });

  it('descreve recompensas com mais de um recurso', () => {
    expect(describeReward({ gold: 20 })).toBe('+20 ouro');
    expect(describeReward({ gold: 20, wood: 30 })).toBe('+30 madeira e +20 ouro');
  });
});
