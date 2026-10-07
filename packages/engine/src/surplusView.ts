import { balance, type MarketResourceId, marketTexts } from '@lotg/content';

import { fillText, joinList, thousands } from './format';
import { marketReserve } from './market';
import type { GameState } from './types';

const RESERVE_REASONS = {
  foodReserve: marketTexts.reasonFoodReserve,
  firewood: marketTexts.reasonFirewood,
  planned: marketTexts.reasonPlanned,
} as const;

/**
 * O que o feudo guarda de um recurso e por quê, para a tela dizer ao lado do atalho "Vender até
 * N": "O feudo guarda 180 de comida: a comida guardada que sustenta a moral e o custo das obras
 * automáticas." É a mesma reserva do balcão e das caravanas.
 */
export function reserveView(
  state: GameState,
  resource: MarketResourceId,
): { reserve: number; surplusText: string } {
  const { units, reasons } = marketReserve(state, resource);
  const recurso = balance.resources[resource].label.toLowerCase();
  return {
    reserve: units,
    surplusText:
      units === 0
        ? fillText(marketTexts.surplusFree, { recurso })
        : fillText(marketTexts.surplusKept, {
            reserva: thousands(units),
            recurso,
            motivos: joinList(reasons.map((reason) => RESERVE_REASONS[reason])),
          }),
  };
}
