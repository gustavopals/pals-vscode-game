import { balance, buildings, type MarketResourceId } from '@lotg/content';

import { nextDayBoundary, seasonAt } from './clock';
import { buildingWithArticle } from './construction';
import { decimal, joinList, sentenceCase, thousands } from './format';
import {
  dailyVolume,
  marketLevel,
  maxBuyable,
  maxSellable,
  quote,
  remainingToday,
  seasonalFactor,
  tradeBlock,
  yesterdayQuote,
} from './market';
import type { BuildingId, GameState, MarketPriceView, MarketView } from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * O Mercado na visão (GDD §5.9; ADR 0018, decisão 16). Só lê o estado: não sorteia, não dá
 * identificador e não anda o tempo. Sai o preço **de hoje**; o de amanhã ainda não existe (o
 * sorteio é da virada do dia), o de ontem só aparece como tendência, e o estado do fluxo
 * `market` nunca sai. Os prazos saem em tempo real, no ritmo `timeScale`.
 */

const { market: rules } = balance;

/** "1,30", "1,105": um preço em ouro por unidade, com duas casas, e a terceira quando ela existe. */
export function priceText(milli: number): string {
  const whole = Math.trunc(milli / MILLI);
  const thousandths = String(milli % MILLI).padStart(3, '0');
  return `${thousands(whole)},${thousandths.endsWith('0') ? thousandths.slice(0, 2) : thousandths}`;
}

/** "comida, madeira e pedra". */
const goods = joinList(rules.resources.map((id) => balance.resources[id].label.toLowerCase()));
const gold = balance.resources.gold.label.toLowerCase();
const sellPercent = decimal((rules.sellRatio.num * 100) / rules.sellRatio.den);

/** "negocia até 400 de cada recurso por dia de jogo, entre compras e vendas". */
function marketGivesText(level: number): string {
  return `negocia até ${thousands(rules.dailyVolumePerLevel * level)} de cada recurso por dia de jogo, entre compras e vendas`;
}

/** O que o Mercado é agora: o que o nível dá ou, sem ele, o que o abre. */
function marketText(state: GameState): string {
  const level = marketLevel(state);
  const { label, requires } = buildings.market;
  if (level > 0) {
    return `${label} Nv${level}: ${marketGivesText(level)}.`;
  }
  const purpose = `nele o feudo compra e vende ${goods} por ${gold}`;
  const townHall = requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? `${sentenceCase(buildingWithArticle('market'))} abre com ${buildingWithArticle('townHall')} Nv${townHall}: ${purpose}.`
    : `Erga ${buildingWithArticle('market')}: ${purpose}.`;
}

/**
 * O que a obra do Mercado muda, para ficar ao lado do custo: "Negocia até 400 de cada recurso
 * por dia de jogo, entre compras e vendas." `null` para os outros edifícios.
 */
export function marketEffect(building: BuildingId, targetLevel: number): string | null {
  return building === 'market' ? `${sentenceCase(marketGivesText(targetLevel))}.` : null;
}

/**
 * De onde vem o preço de hoje: "1,30 = 1,00 (cotação de hoje; a base é 1,00) × 1,3 (Outono). A
 * venda paga 85%: 1,105." Sem fator da estação, só a cotação.
 */
function breakdown(state: GameState, resource: MarketResourceId): string {
  const { buy, sell } = quote(state, resource);
  const walked = `${priceText(state.market.prices[resource])} (cotação de hoje; a base é ${priceText(rules.basePrice[resource])})`;
  const { num, den } = seasonalFactor(resource, state.lastProcessedAt);
  const price =
    num === den
      ? walked
      : `${priceText(buy)} = ${walked} × ${decimal(num / den)} (${seasonAt(state.lastProcessedAt).label})`;
  return `${price}. A venda paga ${sellPercent}%: ${priceText(sell)}.`;
}

function trendOf(state: GameState, resource: MarketResourceId): MarketPriceView['trend'] {
  const yesterday = yesterdayQuote(state, resource);
  if (yesterday === null) {
    return 'flat';
  }
  const { buy } = quote(state, resource);
  if (buy === yesterday.buy) {
    return 'flat';
  }
  return buy > yesterday.buy ? 'up' : 'down';
}

function priceView(state: GameState, resource: MarketResourceId): MarketPriceView {
  const { buy, sell } = quote(state, resource);
  return {
    resource,
    label: balance.resources[resource].label,
    buy,
    sell,
    buyText: priceText(buy),
    sellText: priceText(sell),
    baseText: priceText(rules.basePrice[resource]),
    trend: trendOf(state, resource),
    breakdown: breakdown(state, resource),
    tradedToday: state.market.tradedToday[resource],
    remainingToday: remainingToday(state, resource),
    maxBuyable: maxBuyable(state, resource),
    maxSellable: maxSellable(state, resource),
    buyBlockedReason: tradeBlock(state, resource, 'buy', 1)?.message ?? null,
    sellBlockedReason: tradeBlock(state, resource, 'sell', 1)?.message ?? null,
  };
}

export function marketView(state: GameState, timeScale: number): MarketView {
  const now = state.lastProcessedAt;
  const level = marketLevel(state);
  return {
    level,
    text: marketText(state),
    quoteDay: state.market.quoteDay,
    nextChangeInSeconds:
      level === 0 ? null : realSecondsCeil(nextDayBoundary(now) - now, timeScale),
    dailyVolume: dailyVolume(state),
    // Sem Mercado não há preço a mostrar: ele aparece com o edifício (descoberta gradual).
    prices: level === 0 ? [] : rules.resources.map((resource) => priceView(state, resource)),
  };
}
