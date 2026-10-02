import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { accept, command, DAY, gameWith, HOUR, MINUTE, newGame, WINTER } from './test-helpers';
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
    // Na primavera o treinamento leva 16 minutos (20 × 0,8).
    expect(nextEventAt(state)).toBe(16 * MINUTE);
    expect(nextEventAt(advanceTo(state, 16 * MINUTE).state)).toBe(32 * MINUTE);
  });

  it('considera o instante em que a comida acaba', () => {
    // 1 de comida e 5 habitantes sem fazendeiros: 1 / 5 de hora.
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 1000;
    });
    expect(nextEventAt(state)).toBe(HOUR / 5);
  });

  it('no inverno, considera o instante em que a madeira acaba na lareira', () => {
    // 1 de madeira e 5 habitantes queimando 0,5 cada: 1 / 2,5 de hora.
    const state = gameWith((draft) => {
      draft.lastProcessedAt = WINTER;
      draft.clock.gameTimeMs = WINTER;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 1000;
    });
    expect(nextEventAt(state)).toBe(WINTER + (2 * HOUR) / 5);
  });

  it('fora do inverno a madeira não queima: o próximo evento é a virada de dia', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
      draft.settlement.resources.wood = 1000;
    });
    expect(nextEventAt(state)).toBe(DAY);
  });

  it('durante o frio a madeira não tem hora para acabar', () => {
    const state = gameWith((draft) => {
      draft.lastProcessedAt = WINTER;
      draft.clock.gameTimeMs = WINTER;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
      draft.settlement.cold = { sinceMs: WINTER };
    });
    expect(nextEventAt(state)).toBe(WINTER + DAY);
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
