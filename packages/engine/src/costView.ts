import { balance, type ResourceAmounts } from '@lotg/content';

import type { GameState, ResourceCostView } from './types';
import { MILLI, positiveEntries } from './units';

/**
 * Um custo como a tela o mostra: quanto de cada recurso e quanto falta no estoque para pagar.
 * `quantity` multiplica o custo (recrutar vários aldeões de uma vez).
 */
export function costView(
  state: GameState,
  cost: ResourceAmounts,
  quantity = 1,
): ResourceCostView[] {
  return positiveEntries(cost).map(([resource, amount]) => {
    const total = amount * quantity;
    const shortfall = total * MILLI - state.settlement.resources[resource];
    return {
      resource,
      label: balance.resources[resource].label,
      amount: total,
      missing: shortfall > 0 ? Math.ceil(shortfall / MILLI) : 0,
    };
  });
}
