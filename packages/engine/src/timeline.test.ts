import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { accept, command, DAY, gameWith, HOUR, MINUTE, newGame } from './test-helpers';
import { nextEventAt } from './timeline';

describe('nextEventAt', () => {
  it('sem nada em andamento, o próximo evento é a virada de dia', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
    });
    expect(nextEventAt(state)).toBe(DAY);
  });

  it('considera o fim da obra', () => {
    const { state } = accept(newGame(), command('startConstruction', { building: 'housing' }));
    expect(nextEventAt(state)).toBe(4 * MINUTE);
  });

  it('considera a chegada do próximo aldeão', () => {
    const { state } = accept(newGame(), command('recruitVillagers', { quantity: 2 }));
    expect(nextEventAt(state)).toBe(20 * MINUTE);
    expect(nextEventAt(advanceTo(state, 20 * MINUTE).state)).toBe(40 * MINUTE);
  });

  it('considera o instante em que a comida acaba', () => {
    // 1 de comida e 5 habitantes sem fazendeiros: 1 / 5 de hora.
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 1000;
    });
    expect(nextEventAt(state)).toBe(HOUR / 5);
  });

  it('ignora a fila de recrutamento enquanto durar a fome', () => {
    const starving = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: 0 };
      draft.settlement.recruitmentQueue = [{ finishesAtMs: 20 * MINUTE }];
    });
    expect(nextEventAt(starving)).toBe(DAY);
  });

  it('nunca devolve um instante no passado ao longo de 10 dias', () => {
    let state = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    state = accept(state, command('startConstruction', { building: 'farm' })).state;
    while (state.lastProcessedAt < 10 * 24 * HOUR) {
      const next = nextEventAt(state);
      expect(next).not.toBeNull();
      expect(next!).toBeGreaterThanOrEqual(state.lastProcessedAt);
      state = advanceTo(state, Math.max(next!, state.lastProcessedAt + 1)).state;
    }
  });
});
