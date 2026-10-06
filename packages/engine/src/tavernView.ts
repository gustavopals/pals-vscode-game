import { balance, buildings, heroTraits } from '@lotg/content';

import { nextDayBoundary } from './clock';
import { buildingWithArticle } from './construction';
import { costView } from './costView';
import { decimal, durationText, sentenceCase, thousands } from './format';
import { classLabel, traitLabel } from './heroes';
import {
  canAffordHire,
  candidateOf,
  festivalBlock,
  hireBlock,
  hirePrice,
  nextTavernRotationAt,
  tavernGivesText,
  tavernLevel,
} from './tavern';
import type { BuildingId, GameState, TavernOffer, TavernOfferView, TavernView } from './types';
import { realSecondsCeil } from './units';

/**
 * A Taverna na visão (GDD §6.1 e §9.1; ADR 0017, decisões 4, 5 e 10). Só lê o estado: não
 * sorteia, não dá identificador e não anda o tempo. Saem os candidatos **desta** rotação; os da
 * próxima ainda não existem (o sorteio é do instante da troca), e o estado do fluxo `tavern`
 * nunca sai. Tudo o que é prazo ou taxa sai em tempo real, no ritmo `timeScale`.
 */

const { tavern: rules, heroes } = balance;
const gold = balance.resources.gold.label.toLowerCase();

/** "110 de ouro", ou "88 de ouro: 110, menos 20% por Mécia, Carismática". */
function priceText(state: GameState, offer: TavernOffer): string {
  const { price, full, discount } = hirePrice(state, offer);
  if (discount === null) {
    return `${thousands(price)} de ${gold}`;
  }
  const { hero, trait, ratio } = discount;
  const cut = decimal(((ratio.den - ratio.num) * 100) / ratio.den);
  return `${thousands(price)} de ${gold}: ${thousands(full)}, menos ${cut}% por ${hero.name}, ${traitLabel(trait, hero.gender)}`;
}

function offerView(state: GameState, offer: TavernOffer, timeScale: number): TavernOfferView[] {
  const template = candidateOf(offer.templateId);
  if (template === null) {
    // O modelo que o conteúdo já não tem não aparece: a oferta sai na rotação seguinte.
    return [];
  }
  return [
    {
      offerId: offer.offerId,
      name: offer.name,
      classLabel: classLabel({ classId: template.classId, gender: offer.gender }),
      level: template.level,
      traits: template.traits.map((trait) => ({
        label: traitLabel(trait, offer.gender),
        text: heroTraits[trait].text,
      })),
      price: hirePrice(state, offer).price,
      priceText: priceText(state, offer),
      wagePerHour: heroes.wagePerHour * timeScale,
      affordable: canAffordHire(state, offer),
      blockedReason: hireBlock(state, offer)?.message ?? null,
    },
  ];
}

/** O que a Taverna é agora: o que o nível dá ou, sem ela, o que a abre. */
function tavernText(state: GameState): string {
  const level = tavernLevel(state);
  const { label, requires } = buildings.tavern;
  if (level > 0) {
    return `${label} Nv${level}: ${tavernGivesText(level)}.`;
  }
  const purpose = 'nela o feudo contrata heróis e dá festivais';
  const townHall = requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? `${sentenceCase(buildingWithArticle('tavern'))} abre com ${buildingWithArticle('townHall')} Nv${townHall}: ${purpose}.`
    : `Erga ${buildingWithArticle('tavern')}: ${purpose}.`;
}

/**
 * O que a obra da Taverna muda, para ficar ao lado do custo: "Abriga 2 heróis, traz 2
 * candidatos a cada troca e soma 5 à moral." `null` para os outros edifícios.
 */
export function tavernEffect(building: BuildingId, targetLevel: number): string | null {
  return building === 'tavern' ? `${sentenceCase(tavernGivesText(targetLevel))}.` : null;
}

export function tavernView(state: GameState, timeScale: number): TavernView {
  const now = state.lastProcessedAt;
  const { tavern, tavernOffers } = state.guild;
  const rotation = nextTavernRotationAt(state);
  const blocked = festivalBlock(state);
  const lasts = durationText(realSecondsCeil(rules.festival.durationMs, timeScale));
  return {
    level: tavernLevel(state),
    text: tavernText(state),
    offers: tavernOffers.flatMap((offer) => offerView(state, offer, timeScale)),
    nextRotationInSeconds: rotation === null ? null : realSecondsCeil(rotation - now, timeScale),
    festival: {
      available: blocked === null,
      cost: costView(state, rules.festival.cost),
      effectText: `+${rules.festival.morale} de moral por ${lasts}, a partir da próxima virada do dia. Um festival por estação.`,
      blockedReason: blocked?.message ?? null,
      activeForSeconds:
        tavern.festival === null
          ? null
          : realSecondsCeil(nextDayBoundary(tavern.festival.untilMs) - now, timeScale),
    },
  };
}
