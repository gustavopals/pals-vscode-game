import { balance, marketTemplates } from '@lotg/content';

import { emit } from './chronicle';
import { gameDay, marketLevel, priceZone, walkedPrice } from './market';
import { nextInt } from './random';
import type { GameEvent, GameState } from './types';

/**
 * O Mercado na linha do tempo (GDD §5.9; ADR 0018, decisão 16): o preço que anda e o volume que
 * volta, na virada de cada dia de jogo. É o único ponto do Mercado que sorteia, e só
 * `advanceTo` chega aqui: a ordem de negociar (`marketOrders.ts`) não sorteia.
 */

const { market: rules } = balance;

/**
 * A virada do dia no Mercado. **Só com o Mercado de pé**: sem ele nada se sorteia, o fluxo
 * `market` não anda e os preços ficam na base (só se sorteia o que pode acontecer). O Mercado
 * que fica pronto no meio de um dia negocia pelos preços da base até a primeira virada; o que
 * fica pronto no instante exato de uma virada já tem o preço dela, porque a obra termina antes
 * de o dia virar (`processEventsAt`).
 *
 * Um sorteio por recurso, na ordem do conteúdo: um passo inteiro de `−maxStepPerMille` a
 * `+maxStepPerMille` por mil. O preço novo sai de `walkedPrice`. No mesmo passo o volume do dia
 * zera e o dia da cotação passa a ser o de agora: quem tinha a tela de ontem é recusado com
 * `PRICE_CHANGED`.
 *
 * A mudança de todo dia não é notícia. A Crônica só conta o preço que **entra** em uma das
 * zonas das marcas do conteúdo (`balance.market.swing`): o que sobe até a marca de cima, ou
 * desce até a de baixo, vindo de fora dela. É o preço do passeio, sem o fator da estação: a
 * comida mais cara no outono é o calendário, e não uma surpresa das bancas.
 */
export function turnMarket(draft: GameState, atMs: number, events: GameEvent[]): void {
  if (marketLevel(draft) === 0) {
    return;
  }
  const { market } = draft;
  const span = 2 * rules.walk.maxStepPerMille + 1;
  for (const resource of rules.resources) {
    const before = market.prices[resource];
    const step = nextInt(draft, 'market', span) - rules.walk.maxStepPerMille;
    const after = walkedPrice(resource, before, step);
    market.previousPrices[resource] = before;
    market.prices[resource] = after;
    market.tradedToday[resource] = 0;
    const zone = priceZone(resource, after);
    if (zone !== 'mid' && zone !== priceZone(resource, before)) {
      emit(
        events,
        draft,
        atMs,
        'marketPriceSwing',
        { resource, mark: zone, price: after },
        { recurso: balance.resources[resource].label.toLowerCase() },
        marketTemplates[zone],
      );
    }
  }
  market.quoteDay = gameDay(atMs);
}
