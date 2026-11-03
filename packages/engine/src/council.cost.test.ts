import { describe, expect, it } from 'vitest';

import { councilOptionCost } from './councilWar';
import { currentRepairQuote } from './wallRepair';
import { upgradeQuote } from './construction';
import { siegeYard } from './siege.test-helpers';
import { dealt } from './test-helpers';
import { deriveViewState } from './view';

describe('custos fixos e dinâmicos do Conselho', () => {
  it('soma custo fixo ao custo da obra, inclusive para o mesmo recurso', () => {
    const state = siegeYard();
    const quote = upgradeQuote(state, 'farm', { num: 1, den: 1 }).cost;
    expect(
      councilOptionCost(state, {
        id: 'build',
        label: 'Erguer',
        hint: '',
        chronicle: '',
        cost: { wood: 5, gold: 7 },
        effects: [
          { type: 'startBuilding', building: 'farm', level: 2, discount: { num: 0, den: 1 } },
        ],
      }),
    ).toEqual({ ...quote, wood: (quote.wood ?? 0) + 5, gold: (quote.gold ?? 0) + 7 });
  });

  it('soma reparos repetidos e custo fixo, sem perder o desconto', () => {
    const state = siegeYard();
    state.settlement.wall.hp.left -= 10;
    const quote = currentRepairQuote(state);
    const repair = { type: 'repairWall' as const, discount: { num: 1, den: 5 } };
    expect(
      councilOptionCost(state, {
        id: 'repair',
        label: 'Reparar',
        hint: '',
        chronicle: '',
        cost: { stone: 3, gold: 4 },
        effects: [repair, repair],
      }),
    ).toEqual({
      stone: 3 + 2 * Math.floor((quote.stone * 4) / 5),
      gold: 4 + 2 * Math.floor((quote.gold * 4) / 5),
    });
  });
});

it('a visão mostra o custo da obra e o recurso que falta antes da resposta', () => {
  const state = siegeYard();
  state.settlement.buildings.watchtower = 2;
  const quote = upgradeQuote(state, 'watchtower', { num: 3, den: 4 }).cost;
  state.settlement.resources.wood = (quote.wood! - 1) * 1000;
  const pending = dealt(state, 'northernCrows').state;
  const option = deriveViewState(pending, pending.lastProcessedAt)
    .council.pending.find((card) => card.instanceId === pending.council.pending[0]!.instanceId)
    ?.options.find((entry) => entry.id === 'raise');
  expect(option?.cost).toContainEqual({
    resource: 'wood',
    label: 'Madeira',
    amount: quote.wood,
    missing: 1,
  });
  expect(option?.affordable).toBe(false);
  expect(option?.effectsText).not.toContain('Sem custo');
});
