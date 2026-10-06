import { balance } from '@lotg/content';

import { admitHero } from './arrivals';
import { emit } from './chronicle';
import { DAY_MS } from './clock';
import { payResources } from './construction';
import { classLabel } from './heroes';
import { addMoraleEffect } from './morale';
import { reject } from './rejections';
import {
  candidateOf,
  festivalBlock,
  hireBlock,
  hirePrice,
  tavernRequired,
  tavernLevel,
} from './tavern';
import type { GameEvent, GameState, Rejection } from './types';

/**
 * As ordens da Taverna (GDD §6.1 e §9.1; ADR 0017, decisões 4, 5 e 10): contratar um candidato
 * e dar um festival. **Nenhuma sorteia**: o candidato já foi sorteado na rotação, que é um
 * instante da linha do tempo, e o festival não tem acaso. Contratar cria um herói, pela mesma
 * porta dos que chegam por carta (`admitHero`).
 */

const { festival } = balance.tavern;

/** O identificador do efeito de moral do festival: gravar de novo troca o efeito, não soma. */
export const FESTIVAL_EFFECT_ID = 'festival';

/**
 * A ordem de contratar (`hireHero`). As recusas, na ordem: sem Taverna (`TAVERN_REQUIRED`); a
 * oferta que já não está na lista, porque a rotação a levou ou porque alguém a contratou
 * (`OFFER_GONE`; a rotação de um instante é resolvida por `advanceTo` **antes** de a ordem
 * daquele instante chegar aqui); o limite de heróis (`HERO_LIMIT`); e o ouro
 * (`INSUFFICIENT_RESOURCES`).
 *
 * Aceita, cobra o preço de agora (com o desconto de um Carismático no feudo), tira a oferta da
 * lista e põe o herói no feudo, com o soldo contando desde este instante. O evento leva o preço
 * pago e o cheio, e **não leva o modelo do candidato**: o servidor entrega `data` inteiro a quem
 * joga, e o modelo é o que diria os pesos do sorteio.
 */
export function hireHero(
  draft: GameState,
  offerId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (tavernLevel(draft) === 0) {
    return tavernRequired(draft);
  }
  const { guild } = draft;
  const offer = guild.tavernOffers.find((entry) => entry.offerId === offerId);
  const template = offer === undefined ? null : candidateOf(offer.templateId);
  if (offer === undefined || template === null) {
    return reject('OFFER_GONE');
  }
  const blocked = hireBlock(draft, offer);
  if (blocked !== null) {
    return blocked;
  }
  const { price, full } = hirePrice(draft, offer);
  payResources(draft, { gold: price });
  guild.tavernOffers = guild.tavernOffers.filter((entry) => entry.offerId !== offer.offerId);
  const hero = admitHero(
    draft,
    {
      name: offer.name,
      gender: offer.gender,
      classId: template.classId,
      level: template.level,
      traits: [...template.traits],
    },
    nowMs,
  );
  emit(
    events,
    draft,
    nowMs,
    'heroHired',
    {
      heroId: hero.id,
      offerId: offer.offerId,
      classId: hero.classId,
      price,
      fullPrice: full,
      heroes: guild.heroes.length,
    },
    { heroi: hero.name, classe: classLabel(hero).toLowerCase(), preco: price },
  );
  return null;
}

/**
 * A ordem de dar um festival (`holdFestival`). As recusas, na ordem: sem Taverna
 * (`TAVERN_REQUIRED`), um festival já dado nesta estação (`FESTIVAL_ALREADY_HELD`) e o custo
 * (`INSUFFICIENT_RESOURCES`).
 *
 * Aceita, cobra o custo e grava o efeito temporário de moral, pelo mecanismo de sempre
 * (`addMoraleEffect`): ele **não mexe na moral na hora**, entra na conta das viradas de dia
 * seguintes, uma por dia de jogo da duração, e a virada que já não o conta encerra o festival
 * (`tavernTurn.ts`). Um festival dado com o da estação anterior ainda em curso troca o efeito:
 * o prazo recomeça, e a moral não soma os dois.
 */
export function holdFestival(
  draft: GameState,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = festivalBlock(draft);
  if (blocked !== null) {
    return blocked;
  }
  payResources(draft, festival.cost);
  const untilMs = nowMs + festival.durationMs;
  addMoraleEffect(draft, {
    id: FESTIVAL_EFFECT_ID,
    label: festival.moraleLabel,
    amount: festival.morale,
    untilMs,
  });
  draft.guild.tavern = { ...draft.guild.tavern, festival: { untilMs }, lastFestivalAtMs: nowMs };
  emit(events, draft, nowMs, 'festivalHeld', {
    morale: festival.morale,
    days: festival.durationMs / DAY_MS,
  });
  return null;
}
