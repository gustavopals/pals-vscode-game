import {
  balance,
  buildings,
  heroTraits,
  type Ratio,
  tavernCandidates,
  type TavernCandidateDef,
} from '@lotg/content';

import { inSeason, seasonAt, seasonStartAt } from './clock';
import { buildingWithArticle, missingResources } from './construction';
import { plural } from './format';
import { heroLimit, isAtHome } from './heroes';
import { reject } from './rejections';
import type { GameState, Hero, HeroTraitId, Rejection, TavernOffer } from './types';
import { MILLI } from './units';

/**
 * A Taverna (GDD §5.7, §6.1 e §9.1; ADR 0017, decisões 4, 5 e 10): as contas, sem sorteio e sem
 * criar nada. Quem troca os candidatos e encerra o festival, em instantes da linha do tempo, é
 * `tavernTurn.ts`; quem cumpre as ordens, `tavernOrders.ts`; quem mostra, `tavernView.ts`. Este
 * módulo só lê o estado, e por isso serve aos três, à linha do tempo e à conta da moral.
 */

const { tavern: rules } = balance;

/** O nível da Taverna; zero enquanto ela não foi erguida. */
export function tavernLevel(state: GameState): number {
  return state.settlement.buildings.tavern;
}

/**
 * Quantos candidatos uma rotação feita agora traz: o número do nível de agora
 * (`offersByLevel`). Um nível além da lista vale o último número dela. Zero sem Taverna.
 */
export function offersPerRotation(state: GameState): number {
  const level = tavernLevel(state);
  if (level <= 0) {
    return 0;
  }
  const { offersByLevel } = rules;
  return offersByLevel[Math.min(level, offersByLevel.length) - 1] ?? 0;
}

/** O modelo de candidato do conteúdo; `null` para um identificador que o conteúdo não tem (ou já não tem). */
export function candidateOf(templateId: string): TavernCandidateDef | null {
  return tavernCandidates.find((entry) => entry.id === templateId) ?? null;
}

/**
 * Instante, em ms de jogo, da próxima troca de candidatos; `null` sem Taverna. A primeira lista
 * nasce no instante em que a obra da Taverna termina, que já é um instante da linha do tempo.
 */
export function nextTavernRotationAt(state: GameState): number | null {
  return state.guild.tavern.nextRotationAtMs;
}

/** O herói que barateia a Taverna, o traço que o faz e a fração que multiplica o preço. */
export type Bargainer = { hero: Hero; trait: HeroTraitId; ratio: Ratio };

/**
 * Quem barateia a Taverna: o primeiro herói no feudo, na ordem de chegada, com um traço que
 * mexe no preço (o Carismático), e a fração dele. `null` sem ninguém assim. Vale **uma vez**:
 * dois Carismáticos não somam (ADR 0017, decisão 4).
 */
export function bargainer(state: GameState): Bargainer | null {
  for (const hero of state.guild.heroes) {
    if (!isAtHome(hero)) {
      continue;
    }
    for (const trait of hero.traits) {
      const ratio = heroTraits[trait].effects.tavernPrice;
      if (ratio !== undefined) {
        return { hero, trait, ratio };
      }
    }
  }
  return null;
}

/** O que contratar um candidato custa agora, em ouro: o preço cheio e, com desconto, quem o deu. */
export type HirePrice = {
  /** O preço do modelo, como a rotação o gravou. */
  full: number;
  /** O que a ordem cobra: o cheio vezes a fração do desconto, arredondado para baixo. */
  price: number;
  discount: Bargainer | null;
};

export function hirePrice(state: GameState, offer: TavernOffer): HirePrice {
  const discount = bargainer(state);
  return {
    full: offer.price,
    price:
      discount === null
        ? offer.price
        : Math.floor((offer.price * discount.ratio.num) / discount.ratio.den),
    discount,
  };
}

/**
 * "Erga a Taverna primeiro: ela abre com o Salão do Senhor Nv3.", ou só "Erga a Taverna
 * primeiro." quando o Salão já chegou lá.
 */
export function tavernRequired(state: GameState): Rejection {
  const level = buildings.tavern.requires.townHall;
  return reject('TAVERN_REQUIRED', {
    label: buildingWithArticle('tavern'),
    ...(level === undefined || state.settlement.buildings.townHall >= level
      ? {}
      : { remedy: `ela abre com ${buildingWithArticle('townHall')} Nv${level}` }),
  });
}

/**
 * Por que o feudo não pode contratar mais ninguém agora, ou `null` quando pode: o limite de
 * contratação (`heroLimit`) já foi alcançado, contando todos os heróis que servem ao feudo,
 * os que chegaram por carta também. A frase diz o que abre um lugar.
 */
export function heroLimitBlock(state: GameState): Rejection | null {
  const limit = heroLimit(state);
  if (state.guild.heroes.length < limit) {
    return null;
  }
  const level = tavernLevel(state);
  const canGrow = level < buildings.tavern.maxLevel;
  return reject('HERO_LIMIT', {
    label: `${buildings.tavern.label} Nv${level}`,
    count: limit,
    remedy: canGrow
      ? `melhore ${buildingWithArticle('tavern')} ou dispense um herói`
      : 'dispense um herói',
  });
}

/**
 * Por que a contratação de `offer` seria recusada agora, ou `null` quando pode: sem Taverna, o
 * modelo que o conteúdo já não tem, o limite de heróis e, por último, o ouro. É a ordem das
 * recusas de `hireHero`, e é o que a visão mostra em cada candidato.
 */
export function hireBlock(state: GameState, offer: TavernOffer): Rejection | null {
  if (tavernLevel(state) === 0) {
    return tavernRequired(state);
  }
  if (candidateOf(offer.templateId) === null) {
    return reject('OFFER_GONE');
  }
  const limit = heroLimitBlock(state);
  if (limit !== null) {
    return limit;
  }
  const missing = missingResources(state, { gold: hirePrice(state, offer).price });
  return missing === null ? null : reject('INSUFFICIENT_RESOURCES', { missing });
}

/** O cofre paga o preço de agora do candidato. */
export function canAffordHire(state: GameState, offer: TavernOffer): boolean {
  return state.settlement.resources.gold >= hirePrice(state, offer).price * MILLI;
}

/**
 * Já houve festival na estação em vigor em `atMs` (ADR 0017, decisão 10: um por estação). O
 * festival dado em cima da virada pertence à estação que começa.
 */
export function festivalHeldThisSeason(state: GameState, atMs: number): boolean {
  const { lastFestivalAtMs } = state.guild.tavern;
  return lastFestivalAtMs !== null && lastFestivalAtMs >= seasonStartAt(atMs);
}

/**
 * Por que o festival seria recusado agora, ou `null` quando pode: sem Taverna, um festival já
 * dado nesta estação e, por último, o custo.
 */
export function festivalBlock(state: GameState): Rejection | null {
  const now = state.lastProcessedAt;
  if (tavernLevel(state) === 0) {
    return tavernRequired(state);
  }
  if (festivalHeldThisSeason(state, now)) {
    return reject('FESTIVAL_ALREADY_HELD', { label: inSeason(seasonAt(now)) });
  }
  const missing = missingResources(state, rules.festival.cost);
  return missing === null ? null : reject('INSUFFICIENT_RESOURCES', { missing });
}

/**
 * O que a Taverna de um nível dá, em uma frase sem maiúscula nem ponto: "abriga 2 heróis, traz 2
 * candidatos a cada troca e soma 5 à moral". É o que a lista de obras e a aba mostram.
 */
export function tavernGivesText(level: number): string {
  const { offersByLevel, moralePerLevel, heroLimitPerLevel } = rules;
  const offers = offersByLevel[Math.min(level, offersByLevel.length) - 1] ?? 0;
  const limit = balance.heroes.limitBase + level * heroLimitPerLevel;
  return `abriga ${plural(limit, 'herói', 'heróis')}, traz ${plural(offers, 'candidato', 'candidatos')} a cada troca e soma ${moralePerLevel * level} à moral`;
}
