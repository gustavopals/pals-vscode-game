import { balance, buildings, caravanTexts, type MarketResourceId } from '@lotg/content';

import { buildingWithArticle } from './construction';
import { departBlock } from './expeditions';
import { plural } from './format';
import { canDepart } from './heroes';
import { isMarketResource, marketLevel, quote } from './market';
import { reject } from './rejections';
import { watchtowerLevel } from './threat';
import type { Caravan, GameState, Hero, Rejection } from './types';
import { MILLI } from './units';

/**
 * As caravanas (GDD §5.9; ADR 0018, decisão 17): as contas, sem sorteio, sem identificador e sem
 * mudar nada. Quem cumpre a ordem de enviar é `caravanOrders.ts`, o único ponto que dá
 * identificador a uma caravana; quem a faz chegar, `caravanTurn.ts`, o único que sorteia; quem
 * mostra, `caravansView.ts`. Este módulo só lê o estado, e por isso serve aos três.
 *
 * **Uma caravana é uma venda adiada**: a carga sai do estoque no envio, o preço fica fixado
 * nele, e o ouro só entra na chegada, um prazo de jogo depois. Sem escolta, a chegada sorteia
 * uma emboscada, que leva parte da carga; o resto é vendido pelo preço fixado.
 */

const { caravan: rules } = balance.market;

/** O identificador de uma caravana, com o número: `caravan-12` → 12. */
const CARAVAN_ID = /^caravan-([1-9][0-9]*)$/;

/** O número do identificador de uma caravana: é a ordem em que duas chegam no mesmo instante. */
export function caravanNumber(caravan: Pick<Caravan, 'id'>): number {
  const digits = CARAVAN_ID.exec(caravan.id)?.[1];
  if (digits === undefined) {
    throw new Error(`Identificador de caravana inválido: ${caravan.id}.`);
  }
  return Number(digits);
}

/** Quantas caravanas um Mercado de um nível mantém na estrada; zero sem ele e abaixo do nível pedido. */
export function slotsAtLevel(level: number): number {
  if (level < 1) {
    return 0;
  }
  const { slotsByLevel } = rules;
  return slotsByLevel[Math.min(level, slotsByLevel.length) - 1] ?? 0;
}

/** Quantas caravanas o Mercado de agora mantém na estrada. */
export function caravanSlots(state: GameState): number {
  return slotsAtLevel(marketLevel(state));
}

/** O primeiro nível do Mercado que mantém mais caravanas na estrada que o de agora; `null` no teto. */
export function nextSlotLevel(level: number): number | null {
  const now = slotsAtLevel(level);
  for (let next = level + 1; next <= buildings.market.maxLevel; next += 1) {
    if (slotsAtLevel(next) > now) {
      return next;
    }
  }
  return null;
}

/** "1 caravana", "2 caravanas". */
export function caravansText(count: number): string {
  return plural(count, 'caravana', 'caravanas');
}

/**
 * O preço por unidade que uma caravana enviada agora fixaria, em milésimos de ouro: **o preço
 * de venda de agora** (o do Mercado, já com a margem, a estação e o arredondamento dele) vezes a
 * fração do conteúdo, arredondado para baixo. É a mesma conta que a tela mostra antes da ordem.
 */
export function caravanUnitPrice(state: GameState, resource: MarketResourceId): number {
  const { num, den } = rules.priceRatio;
  return Math.floor((quote(state, resource).sell * num) / den);
}

/**
 * A chance de emboscada de uma caravana sem escolta, em pontos percentuais inteiros, com a
 * Torre de Vigia em um nível: a base menos o tanto de cada nível, nunca menos que o piso.
 */
export function ambushPercent(towerLevel: number): number {
  const { basePercent, perWatchtowerLevel, floorPercent } = rules.ambush;
  return Math.max(floorPercent, basePercent - perWatchtowerLevel * towerLevel);
}

/** A chance de emboscada com a Torre que o feudo tem agora. */
export function ambushPercentNow(state: GameState): number {
  return ambushPercent(watchtowerLevel(state));
}

/** O que uma emboscada leva de uma carga: a fração do conteúdo, **arredondada para baixo**. */
export function ambushLoss(amount: number): number {
  const { num, den } = rules.ambush.lossRatio;
  return Math.floor((amount * num) / den);
}

/**
 * Instante, em ms de jogo, em que a próxima caravana chega; `null` sem nenhuma na estrada. É um
 * evento da linha do tempo: é nele, e só nele, que uma caravana sorteia.
 */
export function nextCaravanArrivalAt(state: GameState): number | null {
  let next: number | null = null;
  for (const caravan of state.market.caravans) {
    if (next === null || caravan.arrivesAtMs < next) {
      next = caravan.arrivesAtMs;
    }
  }
  return next;
}

/**
 * Por que nenhuma caravana pode partir agora, ou `null` quando pode. São as duas primeiras
 * recusas de `sendCaravan`, e o que a visão mostra em `caravanOffer.blockedReason`:
 *
 * 1. o Mercado abaixo do nível das caravanas (`MARKET_LEVEL_REQUIRED`, dizendo o nível e onde o
 *    do feudo está);
 * 2. todos os lugares na estrada ocupados (`CARAVAN_LIMIT`, dizendo quantas o Mercado mantém e,
 *    se houver, o nível que mantém mais uma).
 */
export function caravanBlock(state: GameState): Rejection | null {
  const level = marketLevel(state);
  if (level < rules.requiresLevel) {
    return reject('MARKET_LEVEL_REQUIRED', {
      label: buildingWithArticle('market'),
      level: rules.requiresLevel,
      count: level,
    });
  }
  const slots = slotsAtLevel(level);
  if (state.market.caravans.length >= slots) {
    const next = nextSlotLevel(level);
    return reject('CARAVAN_LIMIT', {
      label: `${buildings.market.label} Nv${level}`,
      count: slots,
      ...(next === null ? {} : { remedy: `no nível ${next}, ${caravansText(slotsAtLevel(next))}` }),
    });
  }
  return null;
}

/** Unidades inteiras de um recurso no estoque. */
function stockOf(state: GameState, resource: MarketResourceId): number {
  return Math.floor(Math.max(0, state.settlement.resources[resource]) / MILLI);
}

/**
 * Por que esta carga não serve, ou `null` quando serve: o que não é uma carga
 * (`INVALID_AMOUNT`: um recurso que o Mercado não negocia, uma quantidade que não é um inteiro
 * de 1 ao teto da caravana) e o que o estoque não tem (`INSUFFICIENT_RESOURCES`, com o que
 * falta).
 */
export function cargoBlock(state: GameState, resource: unknown, amount: unknown): Rejection | null {
  if (!isMarketResource(resource)) {
    return reject('INVALID_AMOUNT', { note: caravanTexts.cargoOnly });
  }
  if (
    typeof amount !== 'number' ||
    !Number.isSafeInteger(amount) ||
    amount < 1 ||
    amount > rules.maxUnits
  ) {
    return reject('INVALID_AMOUNT', {
      note: caravanTexts.cargoRange.replace('{maximo}', String(rules.maxUnits)),
    });
  }
  const shortfall = amount * MILLI - state.settlement.resources[resource];
  return shortfall > 0
    ? reject('INSUFFICIENT_RESOURCES', { missing: { [resource]: Math.ceil(shortfall / MILLI) } })
    : null;
}

/** A maior carga de um recurso que `sendCaravan` aceitaria agora; zero sem lugar na estrada. */
export function maxSendable(state: GameState, resource: MarketResourceId): number {
  return caravanBlock(state) === null ? Math.min(rules.maxUnits, stockOf(state, resource)) : 0;
}

/**
 * Por que este herói não pode escoltar agora, ou `null` quando pode: o que já não serve ao
 * feudo (`HERO_NOT_FOUND`) e o que não pode partir (`HERO_UNAVAILABLE`, com o nome e o motivo:
 * está em expedição, em cativeiro, ferido, ou já escolta outra caravana). É a mesma regra de
 * quem parte em expedição: um herói faz uma coisa por vez (GDD §9.1).
 */
export function escortBlock(state: GameState, heroId: unknown): Rejection | null {
  const hero = state.guild.heroes.find((entry) => entry.id === heroId);
  return hero === undefined ? reject('HERO_NOT_FOUND') : departBlock(hero);
}

/** Quem pode escoltar uma caravana agora, na ordem da lista do feudo. */
export function eligibleEscorts(state: GameState): Hero[] {
  return state.guild.heroes.filter(canDepart);
}

/** A caravana que um herói escolta; `null` para quem não está em escolta. */
export function caravanOf(state: GameState, hero: Pick<Hero, 'id'>): Caravan | null {
  return state.market.caravans.find((caravan) => caravan.escortHeroId === hero.id) ?? null;
}
