import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  applyContinuous,
  consumptionRate,
  foodRunsOutIn,
  netRates,
  productionRate,
  storageCap,
} from './economy';
import { cloneState } from './state';
import { gameWith, HOUR, newGame } from './test-helpers';

describe('taxas', () => {
  it('2 trabalhadores na Fazenda Nv1 com 5 habitantes dão +15 comida/h líquida', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
    });
    expect(productionRate(state, 'farm')).toBe(20_000);
    expect(consumptionRate(state)).toBe(5_000);
    expect(netRates(state)).toEqual({ food: 15_000, wood: 0, stone: 0, gold: 0 });
  });

  it('1 hora produz exatamente 15.000 milésimos de comida', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.farm = 2;
    });
    const after = advanceTo(state, HOUR).state;
    expect(after.settlement.resources.food).toBe(180_000 + 15_000);
    expect(after.settlement.accumulators.food).toBe(0);
  });

  it('cada nível acima do primeiro soma 20% à produção', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers = { farm: 4, lumberMill: 1, quarry: 0, goldMine: 0 };
      draft.settlement.buildings.farm = 2;
      draft.settlement.buildings.lumberMill = 6;
    });
    expect(productionRate(state, 'farm')).toBe(48_000);
    expect(productionRate(state, 'lumberMill')).toBe(16_000);
  });

  it('as taxas base por trabalhador são 10, 8, 5 e 4', () => {
    const state = gameWith((draft) => {
      draft.settlement.population.villagers = 4;
      draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
    });
    expect(netRates(state)).toEqual({ food: 6_000, wood: 8_000, stone: 5_000, gold: 4_000 });
  });

  it('a fome multiplica a produção de todos os edifícios por 0,75', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
      draft.settlement.famine = { sinceMs: 0 };
    });
    expect(productionRate(state, 'farm')).toBe(7_500);
    expect(productionRate(state, 'lumberMill')).toBe(6_000);
    expect(productionRate(state, 'quarry')).toBe(3_750);
    expect(productionRate(state, 'goldMine')).toBe(3_000);
  });

  it('ainda não há limite de estoque', () => {
    expect(storageCap()).toBeNull();
  });
});

describe('acumuladores', () => {
  it('guardam o resto que ainda não completou um milésimo', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.goldMine = 1;
    });
    const draft = cloneState(state);
    applyContinuous(draft, 1);
    // 4.000 milésimos/h × 1 ms: nada chega ao estoque ainda.
    expect(draft.settlement.resources.gold).toBe(250_000);
    expect(draft.settlement.accumulators.gold).toBe(4_000);
    applyContinuous(draft, 899);
    expect(draft.settlement.resources.gold).toBe(250_001);
    expect(draft.settlement.accumulators.gold).toBe(0);
  });

  it('duração zero ou negativa não altera nada', () => {
    const draft = cloneState(newGame());
    applyContinuous(draft, 0);
    applyContinuous(draft, -5);
    expect(draft).toEqual(newGame());
  });

  it('na fome a comida fica em zero em vez de ficar negativa', () => {
    const draft = gameWith((state) => {
      state.settlement.resources.food = 0;
      state.settlement.famine = { sinceMs: 0 };
    });
    applyContinuous(draft, 10 * HOUR);
    expect(draft.settlement.resources.food).toBe(0);
    expect(draft.settlement.accumulators.food).toBe(0);
  });
});

describe('foodRunsOutIn', () => {
  it('é nulo quando a comida não cai ou a fome já começou', () => {
    const fed = gameWith((draft) => {
      draft.settlement.workers.farm = 1;
    });
    expect(foodRunsOutIn(fed)).toBeNull();
    const starving = gameWith((draft) => {
      draft.settlement.famine = { sinceMs: 0 };
    });
    expect(foodRunsOutIn(starving)).toBeNull();
  });

  it('180 de comida com 5 habitantes sem fazendeiros duram exatamente 36 horas', () => {
    expect(foodRunsOutIn(newGame())).toBe(36 * HOUR);
  });

  it('desconta o tempo já avançado, ao milissegundo', () => {
    const later = advanceTo(newGame(), 1_234_567).state;
    expect(foodRunsOutIn(later)).toBe(36 * HOUR - 1_234_567);
  });

  it('nunca é negativo, mesmo com o acumulador devedor', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.accumulators.food = -100;
    });
    expect(foodRunsOutIn(state)).toBe(0);
  });
});
