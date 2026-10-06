import {
  balance,
  buildings,
  MARKET_RESOURCE_IDS,
  type MarketResourceId,
  type Ratio,
  TRADE_DIRECTION_IDS,
  type TradeDirectionId,
} from '@lotg/content';

import { DAY_MS, seasonAt } from './clock';
import { buildingWithArticle } from './construction';
import { reject } from './rejections';
import { storageCapacity, storagePlace } from './storage';
import type { GameState, Rejection } from './types';
import { MILLI } from './units';

/**
 * O Mercado (GDD §4.1, §5.9 e §6.1; ADR 0018, decisão 16): as contas, sem sorteio e sem mudar
 * nada. Quem faz o preço andar, na virada de cada dia de jogo, é `marketTurn.ts`; quem cumpre a
 * ordem de comprar e vender, `marketOrders.ts`; quem mostra, `marketView.ts`. Este módulo só lê
 * o estado, e por isso serve aos três.
 *
 * **Todo preço é inteiro, em milésimos de ouro por unidade.** O estado guarda o preço do
 * passeio; o que o jogador paga e recebe sai dele por uma conta só, com um arredondamento: a
 * compra para cima, a venda para baixo. Uma ordem é `unidades × preço da unidade`, sem outro
 * arredondamento: dividir uma ordem em muitas pequenas dá exatamente o mesmo ouro.
 */

const { market: rules } = balance;

const SAME: Ratio = { num: 1, den: 1 };

/** O nível do Mercado; zero enquanto ele não foi erguido. */
export function marketLevel(state: GameState): number {
  return state.settlement.buildings.market;
}

export function isMarketResource(value: unknown): value is MarketResourceId {
  return (MARKET_RESOURCE_IDS as readonly unknown[]).includes(value);
}

export function isTradeDirection(value: unknown): value is TradeDirectionId {
  return (TRADE_DIRECTION_IDS as readonly unknown[]).includes(value);
}

/** O dia de jogo de um instante, contado do começo da partida: o primeiro é o 1. */
export function gameDay(ms: number): number {
  return Math.floor(ms / DAY_MS) + 1;
}

/** Unidades por recurso que o Mercado negocia por dia de jogo, em um nível; zero sem ele. */
export function dailyVolume(state: GameState, level = marketLevel(state)): number {
  return rules.dailyVolumePerLevel * level;
}

/** Unidades de um recurso que ainda cabem no volume de hoje, compra e venda somadas. */
export function remainingToday(state: GameState, resource: MarketResourceId): number {
  return Math.max(0, dailyVolume(state) - state.market.tradedToday[resource]);
}

/** Uma fração de um preço-base, em milésimos inteiros: o schema do conteúdo garante a conta exata. */
function shareOfBase(resource: MarketResourceId, { num, den }: Ratio): number {
  return (rules.basePrice[resource] * num) / den;
}

/** O piso e o teto do preço de um recurso, e as duas marcas que a Crônica anuncia. */
export function priceBounds(resource: MarketResourceId): {
  floor: number;
  ceiling: number;
  low: number;
  high: number;
} {
  return {
    floor: shareOfBase(resource, rules.walk.floor),
    ceiling: shareOfBase(resource, rules.walk.ceiling),
    low: shareOfBase(resource, rules.swing.low),
    high: shareOfBase(resource, rules.swing.high),
  };
}

/**
 * O preço de amanhã a partir do de hoje e do passo sorteado (em milésimos do preço, de
 * `−maxStepPerMille` a `+maxStepPerMille`): o passo e a volta de uma fração da distância até a
 * base, **em uma conta só, com um arredondamento para baixo**, e o resultado posto entre o piso
 * e o teto.
 *
 *   preço + preço × passo / 1000 + (base − preço) × reversão
 */
export function walkedPrice(
  resource: MarketResourceId,
  price: number,
  stepPerMille: number,
): number {
  const { num, den } = rules.walk.reversion;
  const base = rules.basePrice[resource];
  const { floor, ceiling } = priceBounds(resource);
  const walked = Math.floor(
    (price * (1000 + stepPerMille) * den + (base - price) * num * 1000) / (1000 * den),
  );
  return Math.min(ceiling, Math.max(floor, walked));
}

/** Onde um preço está em relação às marcas da Crônica: até a de baixo, a partir da de cima, ou entre as duas. */
export function priceZone(resource: MarketResourceId, price: number): 'low' | 'mid' | 'high' {
  const { low, high } = priceBounds(resource);
  if (price >= high) {
    return 'high';
  }
  return price <= low ? 'low' : 'mid';
}

/**
 * O fator da estação sobre o preço negociado de um recurso em um instante (GDD §4.1): a comida
 * custa mais no outono e no inverno. Na virada, já é o da estação nova. Multiplica o que o
 * jogador paga e recebe; o preço guardado não muda.
 */
export function seasonalFactor(resource: MarketResourceId, atMs: number): Ratio {
  return rules.seasonal[resource]?.[seasonAt(atMs).id] ?? SAME;
}

/** O que uma unidade custa e o que ela rende, em milésimos de ouro. */
export type Quote = { buy: number; sell: number };

/**
 * O preço negociado de uma unidade, a partir do preço do passeio e do fator da estação: a
 * compra é `preço × fator`, arredondada **para cima**; a venda, `preço × fator × sellRatio`,
 * arredondada **para baixo**. Como a venda paga menos que a compra cobra, e cada uma arredonda
 * contra o jogador, comprar e vender no mesmo dia nunca rende ouro.
 */
export function quoteOf(price: number, factor: Ratio): Quote {
  const { num, den } = rules.sellRatio;
  return {
    buy: Math.ceil((price * factor.num) / factor.den),
    sell: Math.floor((price * factor.num * num) / (factor.den * den)),
  };
}

/** O preço negociado de um recurso agora: o do passeio de hoje com o fator da estação de agora. */
export function quote(state: GameState, resource: MarketResourceId): Quote {
  return quoteOf(state.market.prices[resource], seasonalFactor(resource, state.lastProcessedAt));
}

/**
 * O preço negociado de ontem, para a tendência; `null` enquanto os preços não andaram. Ontem é
 * a véspera do dia da cotação: o preço de antes do último passeio, com o fator da estação da
 * véspera (na virada para o outono a comida sobe pelo fator, e a tendência diz isso).
 */
export function yesterdayQuote(state: GameState, resource: MarketResourceId): Quote | null {
  const { quoteDay, previousPrices } = state.market;
  if (quoteDay <= 1) {
    return null;
  }
  const dawn = (quoteDay - 1) * DAY_MS;
  return quoteOf(previousPrices[resource], seasonalFactor(resource, dawn - 1));
}

/**
 * "Erga o Mercado primeiro: ele abre com o Salão do Senhor Nv3.", ou só "Erga o Mercado
 * primeiro." quando o Salão já chegou lá.
 */
export function marketRequired(state: GameState): Rejection {
  const level = buildings.market.requires.townHall;
  return reject('MARKET_REQUIRED', {
    label: buildingWithArticle('market'),
    ...(level === undefined || state.settlement.buildings.townHall >= level
      ? {}
      : { remedy: `ele abre com ${buildingWithArticle('townHall')} Nv${level}` }),
  });
}

const resourceLabel = (resource: MarketResourceId): string =>
  balance.resources[resource].label.toLowerCase();

/** Unidades inteiras de um recurso que ainda cabem no depósito dele; `null` para o que não tem limite. */
export function roomFor(state: GameState, resource: MarketResourceId): number | null {
  const cap = storageCapacity(state, resource);
  return cap === null
    ? null
    : Math.max(0, Math.floor((cap - state.settlement.resources[resource]) / MILLI));
}

/**
 * Por que uma negociação de `amount` unidades seria recusada agora, ou `null` quando pode. É a
 * ordem das recusas de `trade` depois da cotação conferida, e é o que a visão usa para dizer
 * por que nem uma unidade passa:
 *
 * 1. o volume do dia (`DAILY_VOLUME_EXCEEDED`, com o que ainda cabe hoje);
 * 2. o que a ordem gasta (`INSUFFICIENT_RESOURCES`): o ouro, na compra; o estoque, na venda;
 * 3. o lugar no depósito, na compra (`STORAGE_FULL`): a que não cabe é recusada **inteira**,
 *    nunca cortada no limite.
 */
export function tradeBlock(
  state: GameState,
  resource: MarketResourceId,
  direction: TradeDirectionId,
  amount: number,
): Rejection | null {
  const left = remainingToday(state, resource);
  if (amount > left) {
    return reject('DAILY_VOLUME_EXCEEDED', {
      label: `${buildings.market.label} Nv${marketLevel(state)}`,
      count: dailyVolume(state),
      amount: left,
      resource: resourceLabel(resource),
    });
  }
  const { resources } = state.settlement;
  if (direction === 'sell') {
    const shortfall = amount * MILLI - resources[resource];
    return shortfall > 0
      ? reject('INSUFFICIENT_RESOURCES', { missing: { [resource]: Math.ceil(shortfall / MILLI) } })
      : null;
  }
  const shortfall = amount * quote(state, resource).buy - resources.gold;
  if (shortfall > 0) {
    return reject('INSUFFICIENT_RESOURCES', { missing: { gold: Math.ceil(shortfall / MILLI) } });
  }
  const room = roomFor(state, resource);
  if (room !== null && amount > room) {
    const place = storagePlace(state, resource);
    return reject('STORAGE_FULL', {
      label: place === null ? 'o depósito' : `${place.article} ${place.label}`,
      capacity: Math.floor((storageCapacity(state, resource) ?? 0) / MILLI),
      amount: room,
      resource: resourceLabel(resource),
    });
  }
  return null;
}

/** A maior compra que `trade` aceitaria agora: o volume do dia, o ouro do cofre e o lugar no depósito. */
export function maxBuyable(state: GameState, resource: MarketResourceId): number {
  if (marketLevel(state) === 0) {
    return 0;
  }
  const { buy } = quote(state, resource);
  const affordable = Math.floor(Math.max(0, state.settlement.resources.gold) / buy);
  const room = roomFor(state, resource);
  return Math.min(remainingToday(state, resource), affordable, room ?? affordable);
}

/** A maior venda que `trade` aceitaria agora: o volume do dia e o estoque, em unidades inteiras. */
export function maxSellable(state: GameState, resource: MarketResourceId): number {
  if (marketLevel(state) === 0) {
    return 0;
  }
  const stock = Math.floor(Math.max(0, state.settlement.resources[resource]) / MILLI);
  return Math.min(remainingToday(state, resource), stock);
}
