import {
  balance,
  buildings,
  type CouncilCard,
  type CouncilEffect,
  type CouncilOption,
  councilCards,
  type ResourceAmounts,
  RESOURCE_IDS,
} from '@lotg/content';

import { emit } from './chronicle';
import { DAY_MS, isYearBoundary, nextDayBoundary, seasonAt } from './clock';
import { amountsData, constructionOf, missingResources, payResources } from './construction';
import { thousands } from './format';
import { addMoraleEffect } from './morale';
import { reject } from './rejections';
import { storeResource } from './storage';
import type {
  GameEvent,
  GameState,
  PendingCard,
  Rejection,
  ResourceId,
  ScheduledCard,
} from './types';
import { MILLI, positiveEntries } from './units';

/**
 * O Conselho do Feudo (GDD §7; ADR 0014, decisões 1, 9, 18 e 20): as regras que não sorteiam.
 * A chegada de uma carta, a expiração, as continuações, os efeitos e a resposta do jogador
 * ficam aqui; quem sorteia é `councilTurn.ts`, na virada do dia; quem mostra, `councilView.ts`.
 * Este módulo não importa o gerador: serve às ordens e à visão, que nunca sorteiam.
 *
 * Toda função recebe o catálogo por parâmetro, e o padrão é o do conteúdo: os testes de unidade
 * jogam com cartas de mentira sem que o jogo tenha outra porta de entrada.
 */

const { council: rules } = balance;

export type Catalog = readonly CouncilCard[];

/** O catálogo do jogo: as cartas de `@lotg/content`, na ordem do conteúdo. */
export const CATALOG: Catalog = councilCards;

/** O intervalo entre dois sorteios, em tempo de jogo. */
export const DRAW_INTERVAL_MS = rules.drawIntervalDays * DAY_MS;

export function cardOf(catalog: Catalog, cardId: string): CouncilCard | null {
  return catalog.find((card) => card.id === cardId) ?? null;
}

export function optionOf(card: CouncilCard, optionId: unknown): CouncilOption | null {
  return card.options.find((option) => option.id === optionId) ?? null;
}

/**
 * A opção que o conselho aplica sozinho quando a carta expira: a da dificuldade da partida ou,
 * se a carta marca uma opção com requisito para este caso (`autoResolveIfUnlocked`) e o feudo
 * tem agora o que ela exige, essa. É como a Paliçada erguida cumpre a promessa sem o senhor na
 * sala. A visão usa a mesma conta para dizer o que acontece se ninguém responder: com a obra
 * pronta, a resposta muda no mesmo instante.
 */
export function defaultOption(state: GameState, card: CouncilCard): CouncilOption | null {
  const unlocked = optionOf(card, card.autoResolveIfUnlocked);
  if (unlocked !== null && optionLock(state, unlocked) === null) {
    return unlocked;
  }
  return optionOf(card, card.autoResolve[state.settings.difficulty]);
}

/**
 * O prazo de resposta em tempo de jogo: as 24 h reais do conteúdo no ritmo desta partida. É o
 * único prazo de tempo real do motor, e a conversão acontece uma vez, quando a carta chega
 * (roadmap da v0.2, §0.7, "Relógios explícitos"). Em um ritmo que não dê um número inteiro de
 * milissegundos, arredonda: o estado só guarda inteiros.
 */
export function expiryMs(state: GameState): number {
  return Math.max(1, Math.round(rules.expiryRealMs * state.settings.timeScale));
}

/** O dia de jogo do feudo a contar da fundação: o primeiro é 1. */
export function gameDayAt(atMs: number): number {
  return Math.floor(atMs / DAY_MS) + 1;
}

/** "ceder a madeira": o rótulo de uma opção no meio de uma frase. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** Quantas cartas ainda cabem entre as pendentes. */
export function freeSeats(state: GameState): number {
  return Math.max(0, rules.maxPending - state.council.pending.length);
}

/**
 * Os requisitos de uma carta valem em `atMs`: estação, dia mínimo, edifícios, flags e faixa de
 * moral. A moral é a que está valendo (a virada do dia já a recalculou quando o sorteio roda).
 */
export function meetsRequirements(state: GameState, card: CouncilCard, atMs: number): boolean {
  const { requires } = card;
  if (requires === undefined) {
    return true;
  }
  const { settlement, council } = state;
  if (requires.seasons !== undefined && !requires.seasons.includes(seasonAt(atMs).id)) {
    return false;
  }
  if (requires.minDay !== undefined && gameDayAt(atMs) < requires.minDay) {
    return false;
  }
  for (const [building, level] of Object.entries(requires.buildings ?? {})) {
    if ((settlement.buildings[building as keyof typeof settlement.buildings] ?? 0) < level) {
      return false;
    }
  }
  if ((requires.flags ?? []).some((flag) => council.flags[flag] !== true)) {
    return false;
  }
  if ((requires.notFlags ?? []).some((flag) => council.flags[flag] === true)) {
    return false;
  }
  if (requires.moralRange !== undefined) {
    const [min, max] = requires.moralRange;
    if (settlement.morale < min || settlement.morale > max) {
      return false;
    }
  }
  return true;
}

/** Quantas vezes uma carta já chegou nesta partida, por sorteio, roteiro ou continuação. */
function timesDrawn(state: GameState, cardId: string): number {
  return state.stats[`cardsDrawn:${cardId}`] ?? 0;
}

const isPending = (state: GameState, cardId: string) =>
  state.council.pending.some((entry) => entry.cardId === cardId);

/**
 * As cartas que o sorteio de `atMs` pode tirar, **na ordem do catálogo** (a ordem faz parte do
 * sorteio): com peso, sem roteiro, com os requisitos em dia, que não estão na mesa nem
 * agendadas e que ainda não saíram neste ano, salvo as recorrentes. `seen` é a lista do ano;
 * quem pergunta por um instante depois da virada do ano passa a lista vazia.
 */
export function eligibleCards(
  state: GameState,
  atMs: number,
  catalog: Catalog,
  seen: readonly string[] = state.council.seenThisYear,
): CouncilCard[] {
  return catalog.filter(
    (card) =>
      card.weight > 0 &&
      card.scripted === undefined &&
      (card.recurring === true || !seen.includes(card.id)) &&
      !isPending(state, card.id) &&
      !state.council.scheduled.some((entry) => entry.cardId === card.id) &&
      meetsRequirements(state, card, atMs),
  );
}

/**
 * A carta roteirizada que fura o sorteio de `atMs`: a primeira do catálogo cujo dia chegou e
 * que ainda não saiu nesta partida. Nenhuma carta da v0.2 é roteirizada (ADR 0014, decisão 8).
 */
export function scriptedCard(state: GameState, atMs: number, catalog: Catalog): CouncilCard | null {
  return (
    catalog.find(
      (card) =>
        card.scripted !== undefined &&
        card.scripted.atGameDay <= gameDayAt(atMs) &&
        timesDrawn(state, card.id) === 0 &&
        meetsRequirements(state, card, atMs),
    ) ?? null
  );
}

/** As continuações cujo prazo já chegou em `atMs` e cuja carta ainda existe no catálogo. */
export function dueContinuations(
  state: GameState,
  atMs: number,
  catalog: Catalog,
): ScheduledCard[] {
  return state.council.scheduled.filter(
    (entry) => entry.atMs <= atMs && cardOf(catalog, entry.cardId) !== null,
  );
}

/**
 * O texto e a frase de chegada de uma carta, na variante que a história pede: a primeira cuja
 * flag está gravada. É como uma continuação lembra a escolha que a trouxe.
 */
export function cardReading(
  state: GameState,
  card: CouncilCard,
): { text: string; arrival: string | undefined } {
  const variant = (card.variants ?? []).find((entry) => state.council.flags[entry.flag] === true);
  return {
    text: variant?.text ?? card.text,
    arrival: variant?.arrival ?? card.arrival,
  };
}

/** De onde uma carta veio: do sorteio, do roteiro, ou da escolha que a agendou. */
export type CardOrigin = { source: 'draw' | 'scripted' } | ScheduledCard;

/**
 * Põe uma carta na mesa em `atMs`: uma ocorrência nova, com o prazo de resposta convertido
 * agora, e a linha da chegada na Crônica. A de uma continuação leva a escolha que a trouxe
 * (`previousCardId`, `previousOptionId`, `previousInstanceId`), para a Crônica ligar as duas.
 */
export function deliverCard(
  draft: GameState,
  card: CouncilCard,
  atMs: number,
  events: GameEvent[],
  origin: CardOrigin,
): PendingCard {
  const { council, stats } = draft;
  // A ocorrência é o modelo e a ordem de chegada na partida: determinística, sem sorteio.
  stats.cardsDrawn = (stats.cardsDrawn ?? 0) + 1;
  stats[`cardsDrawn:${card.id}`] = timesDrawn(draft, card.id) + 1;
  const pending: PendingCard = {
    instanceId: `${card.id}-${stats.cardsDrawn}`,
    cardId: card.id,
    drawnAtMs: atMs,
    expiresAtMs: atMs + expiryMs(draft),
    origin:
      'source' in origin
        ? null
        : {
            cardId: origin.previousCardId,
            optionId: origin.previousOptionId,
            instanceId: origin.previousInstanceId,
          },
  };
  council.pending.push(pending);
  if (!council.seenThisYear.includes(card.id)) {
    council.seenThisYear.push(card.id);
  }
  emit(
    events,
    draft,
    atMs,
    'cardDrawn',
    'source' in origin
      ? { cardId: card.id, instanceId: pending.instanceId, source: origin.source }
      : {
          cardId: card.id,
          instanceId: pending.instanceId,
          source: 'continuation',
          previousCardId: origin.previousCardId,
          previousOptionId: origin.previousOptionId,
          previousInstanceId: origin.previousInstanceId,
        },
    { carta: card.title },
    cardReading(draft, card).arrival,
  );
  return pending;
}

/** O que uma opção mexeu no estoque e na moral: vai no evento, para o Relatório não refazer conta. */
type Outcome = {
  /** O que saiu do estoque: o custo e as perdas. Em milésimos. */
  spent: Record<ResourceId, number>;
  /** O que entrou de fato. */
  gained: Record<ResourceId, number>;
  /** O que o limite do depósito cortou de um ganho. */
  lost: Record<ResourceId, number>;
  morale: { amount: number; durationDays: number } | null;
};

const noOutcome = (): Outcome => ({
  spent: { food: 0, wood: 0, stone: 0, gold: 0 },
  gained: { food: 0, wood: 0, stone: 0, gold: 0 },
  lost: { food: 0, wood: 0, stone: 0, gold: 0 },
  morale: null,
});

const toUnits = (milli: Record<ResourceId, number>): ResourceAmounts =>
  Object.fromEntries(RESOURCE_IDS.map((id) => [id, milli[id] / MILLI]));

function outcomeData(outcome: Outcome): Record<string, number> {
  return {
    ...amountsData('spent', toUnits(outcome.spent)),
    ...amountsData('gained', toUnits(outcome.gained)),
    ...amountsData('lost', toUnits(outcome.lost)),
    ...(outcome.morale === null
      ? {}
      : { morale: outcome.morale.amount, moraleDays: outcome.morale.durationDays }),
  };
}

/** A primeira virada de dia depois de `atMs` e mais `days − 1` dias: a `days`-ésima virada. */
function dayTurnAfter(atMs: number, days: number): number {
  return nextDayBoundary(atMs) + (days - 1) * DAY_MS;
}

/** Insere mantendo a lista em ordem de instante; quem empata fica depois de quem já estava. */
function insertByTime<T extends { atMs: number }>(list: T[], entry: T): void {
  const index = list.findIndex((existing) => existing.atMs > entry.atMs);
  list.splice(index === -1 ? list.length : index, 0, entry);
}

/**
 * Aplica uma lista de efeitos de uma opção, uma vez, em `atMs`.
 *
 * - **Recursos:** o ganho passa pelo depósito (entra o que cabe; o resto é desperdício contado,
 *   GDD §5.5); a perda leva o que houver, e o estoque nunca fica negativo.
 * - **Moral:** um efeito temporário com o nome da carta, que conta em `durationDays` viradas do
 *   dia. Não mexe na moral na hora (GDD §5.7).
 * - **Flags:** gravadas e apagadas; só outras cartas as leem.
 * - **Continuação:** entra na lista de agendadas, com a escolha que a pediu.
 */
function applyEffects(
  draft: GameState,
  effects: readonly CouncilEffect[],
  source: { card: CouncilCard; option: CouncilOption; instanceId: string; hidden: boolean },
  atMs: number,
  outcome: Outcome,
): void {
  const { settlement, council } = draft;
  const { card, option, instanceId, hidden } = source;
  for (const effect of effects) {
    switch (effect.type) {
      case 'resources':
        for (const resource of RESOURCE_IDS) {
          const amount = (effect.amounts[resource] ?? 0) * MILLI;
          if (amount > 0) {
            const stored = storeResource(draft, resource, amount);
            outcome.gained[resource] += stored;
            outcome.lost[resource] += amount - stored;
          } else if (amount < 0) {
            const taken = Math.min(settlement.resources[resource], -amount);
            settlement.resources[resource] -= taken;
            outcome.spent[resource] += taken;
          }
        }
        break;
      case 'morale':
        addMoraleEffect(draft, {
          // Um id por ocorrência e por momento: o efeito conhecido e o escondido da mesma
          // carta somam, e duas cartas diferentes também.
          id: `card:${instanceId}${hidden ? ':later' : ''}`,
          label: `Carta: ${card.title}`,
          amount: effect.amount,
          untilMs: atMs + effect.durationDays * DAY_MS,
        });
        outcome.morale = { amount: effect.amount, durationDays: effect.durationDays };
        break;
      case 'setFlag':
        council.flags[effect.flag] = true;
        break;
      case 'clearFlag':
        delete council.flags[effect.flag];
        break;
      case 'scheduleCard':
        insertByTime(council.scheduled, {
          cardId: effect.cardId,
          atMs: atMs + effect.afterDays * DAY_MS,
          previousCardId: card.id,
          previousOptionId: option.id,
          previousInstanceId: instanceId,
        });
        break;
    }
  }
}

/**
 * Aplica uma opção a uma carta que já saiu da mesa: os efeitos conhecidos agora, e o escondido,
 * se houver, fica marcado para a virada de dia dele. O custo é de quem chamou: a expiração não
 * cobra nada.
 *
 * O efeito escondido acontece sempre em uma virada de dia, depois da moral: a visão, que prevê
 * a próxima virada sem processá-la, nunca o vê antes da hora.
 */
function resolveCard(
  draft: GameState,
  pending: PendingCard,
  card: CouncilCard,
  option: CouncilOption,
  atMs: number,
  outcome: Outcome,
): void {
  const { instanceId } = pending;
  applyEffects(draft, option.effects, { card, option, instanceId, hidden: false }, atMs, outcome);
  if (option.hidden !== undefined) {
    insertByTime(draft.council.delayed, {
      atMs: dayTurnAfter(atMs, option.hidden.afterDays),
      instanceId,
      cardId: card.id,
      optionId: option.id,
    });
  }
}

/**
 * As cartas cujo prazo acabou em `atMs`: o conselho aplica a opção da dificuldade, sem custo, e
 * a Crônica diz o que foi feito (`cardExpired`). Roda antes de qualquer ordem do mesmo
 * instante: a resposta que chega junto encontra a carta já decidida (`CARD_EXPIRED`).
 *
 * Uma carta que o catálogo já não tem (o conteúdo mudou com ela na mesa) sai sem efeito e sem
 * linha: não há o que aplicar nem o que dizer.
 */
export function expireCards(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council, stats } = draft;
  const due = council.pending.filter((entry) => entry.expiresAtMs <= atMs);
  if (due.length === 0) {
    return;
  }
  council.pending = council.pending.filter((entry) => entry.expiresAtMs > atMs);
  for (const pending of due) {
    const card = cardOf(catalog, pending.cardId);
    const option = card === null ? null : defaultOption(draft, card);
    if (card === null || option === null) {
      continue;
    }
    const outcome = noOutcome();
    resolveCard(draft, pending, card, option, atMs, outcome);
    council.expired.push(pending.instanceId);
    stats.cardsExpired = (stats.cardsExpired ?? 0) + 1;
    emit(
      events,
      draft,
      atMs,
      'cardExpired',
      {
        cardId: card.id,
        instanceId: pending.instanceId,
        optionId: option.id,
        difficulty: draft.settings.difficulty,
        ...outcomeData(outcome),
      },
      { carta: card.title, opcao: lowerFirst(option.label) },
      option.expiredChronicle,
    );
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
    if (card === null || option === null || option.hidden === undefined) {
      continue;
    }
    const outcome = noOutcome();
    const { instanceId } = entry;
    const source = { card, option, instanceId, hidden: true };
    applyEffects(draft, option.hidden.effects, source, atMs, outcome);
    emit(
      events,
      draft,
      atMs,
      'cardEffectApplied',
      { cardId: card.id, instanceId, optionId: option.id, ...outcomeData(outcome) },
      { carta: card.title, opcao: lowerFirst(option.label) },
      option.hidden.chronicle,
    );
  }
}

/**
 * As continuações cujo prazo chegou entram na mesa enquanto houver lugar, na ordem do prazo. A
 * que não cabe fica na lista e chega no primeiro instante em que uma pendente sair: uma
 * expiração (este mesmo passo, logo depois dela) ou uma resposta do jogador.
 */
export function deliverContinuations(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council } = draft;
  for (;;) {
    const index = council.scheduled.findIndex((entry) => entry.atMs <= atMs);
    if (index === -1) {
      return;
    }
    const entry = council.scheduled[index] as ScheduledCard;
    const card = cardOf(catalog, entry.cardId);
    if (card !== null && freeSeats(draft) === 0) {
      return;
    }
    council.scheduled.splice(index, 1);
    // A carta que o catálogo já não tem sai da lista sem chegar.
    if (card !== null) {
      deliverCard(draft, card, atMs, events, entry);
    }
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

/**
 * A virada do ano no Conselho (ADR 0014, decisão 20): só a lista das cartas vistas no ano zera
 * (e, com ela, a das expiradas, que só serve às recusas). Flags, cartas na mesa, continuações
 * agendadas e efeitos em curso continuam.
 */
export function turnCouncilYear(draft: GameState, atMs: number): void {
  if (isYearBoundary(atMs)) {
    draft.council.seenThisYear = [];
    draft.council.expired = [];
  }
}

/**
 * Instante, em ms de jogo, do próximo evento do Conselho com hora marcada: uma carta que
 * expira, um efeito escondido que acontece ou uma continuação cujo prazo ainda não chegou.
 * `null` sem nenhum. O sorteio não entra: ele é da virada do dia, que já é um instante da linha
 * do tempo. A continuação vencida que espera lugar também não: quem abre o lugar é uma
 * expiração (que está aqui) ou uma ordem.
 */
export function nextCouncilEventAt(state: GameState): number | null {
  const now = state.lastProcessedAt;
  const { pending, delayed, scheduled } = state.council;
  const instants = [
    ...pending.map((entry) => entry.expiresAtMs),
    ...delayed.map((entry) => entry.atMs),
    ...scheduled.map((entry) => entry.atMs).filter((atMs) => atMs > now),
  ];
  return instants.length === 0 ? null : Math.min(...instants);
}

/**
 * O que tranca uma opção, em um pedaço de frase: "requer o Celeiro"; com a obra do edifício em
 * curso, "requer a Paliçada, que ainda está em obras". `null` quando o feudo tem o que ela
 * exige. O custo não entra aqui: quem não pode pagar vê o que falta, não uma tranca.
 */
export function optionLock(state: GameState, option: CouncilOption): string | null {
  const { requires } = option;
  if (requires === undefined) {
    return null;
  }
  const { settlement } = state;
  if (requires.building !== undefined && settlement.buildings[requires.building] < 1) {
    const def = buildings[requires.building];
    // Com a obra em curso a frase diz que falta pouco: quem já mandou erguer sabe o que esperar.
    return constructionOf(state, requires.building) === null
      ? `requer ${def.article} ${def.label}`
      : `requer ${def.article} ${def.label}, que ainda está em obras`;
  }
  const short = positiveEntries(requires.resources ?? {}).find(
    ([resource, amount]) => settlement.resources[resource] < amount * MILLI,
  );
  if (short !== undefined) {
    const [resource, amount] = short;
    return `requer ${thousands(amount)} de ${balance.resources[resource].label.toLowerCase()} em estoque`;
  }
  return null;
}

/**
 * A resposta do jogador a uma carta (GDD §7.1). Recusas, na ordem: a carta não está na mesa
 * (`CARD_EXPIRED` se o prazo dela acabou neste ano, `CARD_NOT_PENDING` no resto), a opção não
 * existe (`INVALID_OPTION`), está trancada (`OPTION_LOCKED`) ou custa mais do que há
 * (`INSUFFICIENT_RESOURCES`, com o que falta).
 *
 * Aceita, a ordem paga o custo e aplica os efeitos conhecidos uma vez; o que a opção esconde
 * fica marcado para depois e **não** aparece no evento desta ordem. A carta sai da mesa, e uma
 * continuação que esperava lugar chega no mesmo instante. Não sorteia nada.
 */
export function answerCard(
  draft: GameState,
  instanceId: unknown,
  optionId: unknown,
  nowMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): Rejection | null {
  const { council, stats } = draft;
  const index = council.pending.findIndex((entry) => entry.instanceId === instanceId);
  const pending = council.pending[index];
  const card = pending === undefined ? null : cardOf(catalog, pending.cardId);
  if (pending === undefined || card === null) {
    return reject(
      typeof instanceId === 'string' && council.expired.includes(instanceId)
        ? 'CARD_EXPIRED'
        : 'CARD_NOT_PENDING',
    );
  }
  const option = optionOf(card, optionId);
  if (option === null) {
    return reject('INVALID_OPTION', { label: card.title });
  }
  const lock = optionLock(draft, option);
  if (lock !== null) {
    return reject('OPTION_LOCKED', { remedy: lock });
  }
  const cost = option.cost ?? {};
  const missing = missingResources(draft, cost);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  payResources(draft, cost);
  council.pending.splice(index, 1);
  const outcome = noOutcome();
  for (const [resource, amount] of positiveEntries(cost)) {
    outcome.spent[resource] += amount * MILLI;
  }
  resolveCard(draft, pending, card, option, nowMs, outcome);
  stats.cardsAnswered = (stats.cardsAnswered ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'cardAnswered',
    {
      cardId: card.id,
      instanceId: pending.instanceId,
      optionId: option.id,
      ...outcomeData(outcome),
    },
    { carta: card.title, opcao: lowerFirst(option.label) },
    option.chronicle,
  );
  // O lugar que a carta deixou pode ser de uma continuação que já esperava.
  deliverContinuations(draft, nowMs, events, catalog);
  return null;
}
