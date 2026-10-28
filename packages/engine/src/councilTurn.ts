import {
  applyEffects,
  cardOf,
  expireCards,
  deliverContinuations,
  lowerFirst,
  noOutcome,
  optionOf,
  outcomeData,
  CATALOG,
  type Catalog,
  deliverCard,
  DRAW_INTERVAL_MS,
  dueContinuations,
  eligibleCards,
  freeSeats,
  scriptedCard,
} from './council';
import { chance, nextInt, pickWeighted } from './random';
import { emit } from './chronicle';
import type { CouncilCard } from '@lotg/content';
import {
  councilHeroCandidates,
  councilHeroData,
  councilHeroWords,
  freeCouncilHero,
} from './councilHeroes';
import type { CouncilHero, GameEvent, GameState } from './types';

/** Escolha sem reposição na chegada; guarda identidade e nome, nunca o desfecho. */
export function drawCouncilHeroes(draft: GameState, card: CouncilCard): CouncilHero[] {
  const count = card.requires?.heroPresent ?? (card.requires?.injuredHero === true ? 1 : 0);
  const candidates = councilHeroCandidates(draft, card);
  const heroes: CouncilHero[] = [];
  for (let seat = 0; seat < count && candidates.length > 0; seat++) {
    const [hero] = candidates.splice(nextInt(draft, 'council', candidates.length), 1);
    if (hero !== undefined) heroes.push({ id: hero.id, name: hero.name });
  }
  return heroes;
}

/**
 * O sorteio do Conselho (GDD §7.1; ADR 0014, decisões 1 e 18), na virada do dia de jogo, depois
 * da moral. É o único ponto do Conselho que sorteia, e só `advanceTo` chega aqui.
 *
 * 1. **Cadência ancorada.** Se o instante do sorteio chegou, `nextDrawAtMs` anda um intervalo,
 *    **sempre**: haja carta ou não, haja lugar ou não. O resultado de uma ausência não depende
 *    de como o intervalo foi dividido nem de quando o jogador respondeu.
 * 2. **Lugar.** Com a mesa cheia, o sorteio é pulado. Uma continuação cujo prazo já chegou tem
 *    prioridade: o lugar dela está reservado, e o sorteio só tira carta se sobrar outro. (As
 *    cartas que expiram neste mesmo instante ainda contam: a expiração vem depois da virada.)
 * 3. **Carta.** Uma roteirizada cujo dia chegou vai na frente; senão, sorteio por peso entre as
 *    elegíveis, no fluxo `council`. Sem nenhuma elegível, nada acontece e o fluxo não anda.
 */
export function drawCard(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council } = draft;
  if (atMs < council.nextDrawAtMs) {
    return;
  }
  // Um intervalo por vez até passar de agora: em uma partida em dia é um passo só. O laço só
  // roda mais em um estado que chegou atrasado, e mesmo esse sorteia uma vez, não uma por
  // intervalo perdido.
  while (council.nextDrawAtMs <= atMs) {
    council.nextDrawAtMs += DRAW_INTERVAL_MS;
  }
  if (freeSeats(draft, catalog) - dueContinuations(draft, atMs, catalog).length <= 0) {
    return;
  }
  const scripted = scriptedCard(draft, atMs, catalog);
  if (scripted !== null) {
    deliverCard(
      draft,
      scripted,
      atMs,
      events,
      { source: 'scripted' },
      drawCouncilHeroes(draft, scripted),
    );
    return;
  }
  const card = pickWeighted(draft, 'council', eligibleCards(draft, atMs, catalog));
  if (card !== null) {
    deliverCard(draft, card, atMs, events, { source: 'draw' }, drawCouncilHeroes(draft, card));
  }
}

/**
 * Os efeitos escondidos cujo instante chegou: acontecem agora, e é aqui que o jogador os
 * descobre (`cardEffectApplied`). Antes disso nada deles sai na visão nem na resposta da ordem.
 */
export function applyDelayedEffects(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council } = draft;
  const due = council.delayed.filter((entry) => entry.atMs <= atMs);
  if (due.length === 0) {
    return;
  }
  council.delayed = council.delayed.filter((entry) => entry.atMs > atMs);
  for (const entry of due) {
    const card = cardOf(catalog, entry.cardId);
    const option = card === null ? null : optionOf(card, entry.optionId);
    if (card === null || option === null) {
      continue;
    }
    const outcome = noOutcome();
    const { instanceId } = entry;
    const source = {
      card,
      option,
      instanceId,
      hidden: true,
      heroes: entry.heroes,
      injuredHeroId: undefined as string | undefined,
    };
    const roll = option.effects.find((effect) => effect.type === 'rollEffect');
    const relief = roll?.withHeroClass;
    const probability =
      relief !== undefined &&
      draft.guild.heroes.some(
        (hero) => hero.classId === relief.heroClass && hero.status !== 'captured',
      )
        ? relief.chance
        : roll?.chance;
    const injures = roll?.onHit.effects.some((effect) => effect.type === 'injureHero') === true;
    const available = (entry.heroes ?? []).filter((target) =>
      draft.guild.heroes.some((hero) => hero.id === target.id && freeCouncilHero(hero)),
    );
    const branch =
      roll === undefined || probability === undefined
        ? option.hidden
        : (!injures || available.length > 0) && chance(draft, 'council', probability)
          ? roll.onHit
          : roll.onMiss;
    if (branch === undefined) continue;
    if (branch.effects.some((effect) => effect.type === 'injureHero') && available.length > 0) {
      source.injuredHeroId =
        available.length === 1
          ? available[0]!.id
          : available[nextInt(draft, 'council', available.length)]!.id;
    }
    applyEffects(draft, branch.effects, source, atMs, outcome);
    emit(
      events,
      draft,
      atMs,
      'cardEffectApplied',
      {
        cardId: card.id,
        instanceId,
        optionId: option.id,
        ...councilHeroData(entry.heroes),
        ...outcomeData(outcome),
      },
      {
        carta: card.title,
        opcao: lowerFirst(option.label),
        ...councilHeroWords(entry.heroes),
        ...(outcome.injuredHero === null ? {} : { heroiFerido: outcome.injuredHero.name }),
      },
      branch.chronicle,
    );
  }
}

/**
 * O que o Conselho faz em um instante, fora o sorteio (que é da virada do dia, antes daqui), em
 * ordem fixa: as cartas que expiram, os efeitos escondidos que acontecem e as continuações que
 * chegam (ADR 0013, "Ordem dos eventos no mesmo instante").
 */
export function settleCouncil(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  expireCards(draft, atMs, events, catalog);
  applyDelayedEffects(draft, atMs, events, catalog);
  deliverContinuations(draft, atMs, events, catalog);
}
