import { balance, marketTemplates } from '@lotg/content';

import { emit } from './chronicle';
import { decimal, thousands } from './format';
import {
  isMarketResource,
  isTradeDirection,
  marketLevel,
  marketRequired,
  quote,
  remainingToday,
  tradeBlock,
} from './market';
import { reject } from './rejections';
import { storeResource } from './storage';
import type { GameEvent, GameState, Rejection } from './types';
import { MILLI } from './units';

/**
 * A ordem do Mercado (GDD §5.9; ADR 0018, decisão 16): comprar e vender por ouro. **Não
 * sorteia**: o preço do dia já foi sorteado na virada, que é um instante da linha do tempo.
 */

/**
 * A ordem de negociar (`trade`). As recusas, na ordem:
 *
 * 1. sem Mercado (`MARKET_REQUIRED`);
 * 2. o que não é uma negociação (`INVALID_AMOUNT`): um recurso que o Mercado não negocia, um
 *    sentido que não é compra nem venda, uma quantidade que não é um inteiro a partir de 1;
 * 3. a cotação que ficou para trás (`PRICE_CHANGED`): o dia de jogo virou entre a tela e a
 *    ordem. A virada de um instante é resolvida por `advanceTo` **antes** de a ordem daquele
 *    instante chegar aqui, então a ordem dada na virada já encontra o preço novo;
 * 4. o volume do dia, o que a ordem gasta e o lugar no depósito (`tradeBlock`).
 *
 * Aceita, a compra cobra `unidades × preço de compra` e guarda as unidades (cabem todas: a que
 * não cabe foi recusada inteira); a venda tira as unidades e paga `unidades × preço de venda`.
 * As unidades contam no volume do dia, compra e venda somadas. O evento leva as quantidades
 * exatas e os totais (`spent_<recurso>`, `gained_<recurso>`, como toda ordem que cobra ou paga):
 * é com eles que o Relatório de Retorno separa o gasto e o recebido da produção.
 */
export function trade(
  draft: GameState,
  resource: unknown,
  direction: unknown,
  amount: unknown,
  quoteDay: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (marketLevel(draft) === 0) {
    return marketRequired(draft);
  }
  if (!isMarketResource(resource)) {
    return reject('INVALID_AMOUNT', {
      note: 'O Mercado só negocia comida, madeira e pedra, por ouro.',
    });
  }
  if (!isTradeDirection(direction)) {
    return reject('INVALID_AMOUNT', { note: 'No Mercado se compra ou se vende.' });
  }
  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount < 1) {
    return reject('INVALID_AMOUNT');
  }
  if (quoteDay !== draft.market.quoteDay) {
    return reject('PRICE_CHANGED');
  }
  const blocked = tradeBlock(draft, resource, direction, amount);
  if (blocked !== null) {
    return blocked;
  }
  const { settlement, market, stats } = draft;
  const unitPrice = quote(draft, resource)[direction];
  const gold = amount * unitPrice;
  if (direction === 'buy') {
    settlement.resources.gold -= gold;
    storeResource(draft, resource, amount * MILLI);
  } else {
    settlement.resources[resource] -= amount * MILLI;
    storeResource(draft, 'gold', gold);
  }
  market.tradedToday[resource] += amount;
  const stat = `${direction === 'buy' ? 'bought' : 'sold'}_${resource}`;
  stats[stat] = (stats[stat] ?? 0) + amount;
  const paid = direction === 'buy' ? 'spent' : 'gained';
  const moved = direction === 'buy' ? 'gained' : 'spent';
  emit(
    events,
    draft,
    nowMs,
    'marketTraded',
    {
      resource,
      direction,
      amount,
      unitPrice,
      gold,
      quoteDay: market.quoteDay,
      remainingToday: remainingToday(draft, resource),
      [`${moved}_${resource}`]: amount,
      [`${paid}_gold`]: gold / MILLI,
    },
    {
      quantidade: thousands(amount),
      recurso: balance.resources[resource].label.toLowerCase(),
      preco: decimal(gold / MILLI, 3),
    },
    marketTemplates[direction],
  );
  return null;
}
