import { balance, type CouncilOption, RESOURCE_IDS } from '@lotg/content';

import { DAY_MS, isYearBoundary } from './clock';
import { costView } from './costView';
import {
  cardOf,
  cardReading,
  CATALOG,
  type Catalog,
  defaultOption,
  DRAW_INTERVAL_MS,
  eligibleCards,
  lowerFirst,
  optionLock,
  optionOf,
  scriptedCard,
} from './council';
import { durationText, plural, sentenceCase, thousands } from './format';
import { storable, storagePlace } from './storage';
import type {
  CouncilCardView,
  CouncilOptionView,
  CouncilView,
  GameState,
  PendingCard,
  PendingDecisionView,
  ResourceId,
} from './types';
import { MILLI, positiveEntries, realSecondsCeil, SECOND_MS } from './units';

/**
 * O Conselho na visão (GDD §7): as cartas à espera, com o custo e a consequência **conhecida**
 * de cada opção lado a lado, o que o conselho faz se o prazo acabar e quando vem a próxima
 * audiência. Tudo em tempo real e em frases prontas.
 *
 * O que não sai daqui, nunca: as flags, o efeito escondido de uma opção (só a pista), as
 * continuações agendadas, os efeitos à espera e o estado do gerador (roadmap da v0.2, §0.7,
 * "Visão e privacidade narrativa"). Este módulo não sorteia nada.
 */

const { council: rules } = balance;

const resourceName = (resource: ResourceId) => balance.resources[resource].label.toLowerCase();
const signed = (amount: number) =>
  amount > 0 ? `+${thousands(amount)}` : `−${thousands(-amount)}`;

/**
 * "+40 comida", e o aviso quando o depósito não guarda tudo: o ganho de uma carta é cortado no
 * limite, e o jogador vê isso antes de escolher (GDD §5.5).
 */
function gainText(state: GameState, resource: ResourceId, amount: number): string {
  const text = `+${thousands(amount)} ${resourceName(resource)}`;
  const fits = Math.floor(storable(state, resource, amount * MILLI) / MILLI);
  const place = storagePlace(state, resource);
  if (fits >= amount || place === null) {
    return text;
  }
  return fits === 0
    ? `${text} (não cabe: ${place.article} ${place.label} está cheio, e tudo se perde)`
    : `${text} (só ${fits === 1 ? 'cabe' : 'cabem'} ${thousands(fits)} n${place.article} ${place.label}: o resto se perde)`;
}

/**
 * O custo e a consequência conhecida de uma opção, em uma frase: "−40 madeira; +5 de moral por
 * 2 dias de jogo (1 h 20 min)". A duração de um efeito de moral conta dias de jogo, e o tempo
 * real entre parênteses é o do ritmo da partida. Flags e continuações não aparecem.
 */
function effectsText(state: GameState, option: CouncilOption, timeScale: number): string {
  const parts = positiveEntries(option.cost ?? {}).map(
    ([resource, amount]) => `−${thousands(amount)} ${resourceName(resource)}`,
  );
  for (const effect of option.effects) {
    if (effect.type === 'resources') {
      for (const resource of RESOURCE_IDS) {
        const amount = effect.amounts[resource] ?? 0;
        if (amount > 0) {
          parts.push(gainText(state, resource, amount));
        } else if (amount < 0) {
          parts.push(`${signed(amount)} ${resourceName(resource)}`);
        }
      }
    } else if (effect.type === 'morale') {
      const real = durationText(realSecondsCeil(effect.durationDays * DAY_MS, timeScale));
      parts.push(
        `${signed(effect.amount)} de moral por ${plural(effect.durationDays, 'dia', 'dias')} de jogo (${real})`,
      );
    }
  }
  return parts.length === 0 ? 'Sem custo e sem efeito imediato.' : parts.join('; ');
}

function optionView(state: GameState, option: CouncilOption, timeScale: number): CouncilOptionView {
  const cost = costView(state, option.cost ?? {});
  const lock = optionLock(state, option);
  return {
    id: option.id,
    label: option.label,
    cost,
    affordable: cost.every((entry) => entry.missing === 0),
    locked: lock !== null,
    lockedReason: lock === null ? null : `${sentenceCase(lock)}.`,
    effectsText: effectsText(state, option, timeScale),
    hint: option.hint,
  };
}

/**
 * A próxima audiência pode trazer carta: há uma roteirizada com o dia chegado ou ao menos uma
 * elegível, com o feudo como ele está agora e a estação que estará valendo. É uma previsão, não
 * o sorteio: não gasta o gerador nem diz qual carta.
 */
function mayBringCard(state: GameState, atMs: number, catalog: Catalog): boolean {
  // Uma audiência em cima da virada do ano encontra a lista das cartas vistas já zerada.
  const seen = isYearBoundary(atMs) ? [] : state.council.seenThisYear;
  return (
    scriptedCard(state, atMs, catalog) !== null ||
    eligibleCards(state, atMs, catalog, seen).length > 0
  );
}

/**
 * De onde vem uma continuação: a carta anterior e a opção aplicada nela, em uma frase. A opção
 * pode ter sido escolhida pelo senhor ou aplicada pelo conselho, sem resposta: a frase vale para
 * os dois. `null` na carta do sorteio, e quando o catálogo já não tem a carta ou a opção.
 */
function followsFrom(pending: PendingCard, catalog: Catalog): CouncilCardView['followsFrom'] {
  const previous = pending.origin === null ? null : cardOf(catalog, pending.origin.cardId);
  const option = previous === null ? null : optionOf(previous, pending.origin?.optionId);
  if (previous === null || option === null) {
    return null;
  }
  return {
    title: previous.title,
    optionLabel: option.label,
    text: `A história continua: em "${previous.title}", a decisão foi ${lowerFirst(option.label)}.`,
  };
}

export function councilView(
  state: GameState,
  timeScale: number,
  catalog: Catalog = CATALOG,
): { council: CouncilView; pendingDecisions: PendingDecisionView[] } {
  const now = state.lastProcessedAt;
  const { council } = state;
  const until = (gameMs: number) => realSecondsCeil(gameMs - now, timeScale);

  const pending: CouncilCardView[] = [];
  for (const entry of council.pending) {
    const card = cardOf(catalog, entry.cardId);
    const fallback = card === null ? null : defaultOption(state, card);
    // Uma carta que o catálogo já não tem não aparece: ela sai da mesa sozinha quando expira.
    if (card === null || fallback === null) {
      continue;
    }
    pending.push({
      instanceId: entry.instanceId,
      title: card.title,
      text: cardReading(state, card).text,
      expiresInSeconds: until(entry.expiresAtMs),
      defaultOptionId: fallback.id,
      defaultOptionLabel: fallback.label,
      expiryNote: `Sem resposta até o fim do prazo, o conselho decide sozinho: ${lowerFirst(fallback.label)}.`,
      followsFrom: followsFrom(entry, catalog),
      options: card.options.map((option) => optionView(state, option, timeScale)),
    });
  }

  const nextDraw = council.nextDrawAtMs;
  // As pendentes que ainda vão estar na mesa na próxima audiência: a que expira no mesmo
  // instante ainda conta, porque o sorteio vem antes da expiração.
  const seated = council.pending.filter((entry) => entry.expiresAtMs >= nextDraw).length;
  const blockedByPending = seated >= rules.maxPending;
  const brings = !blockedByPending && mayBringCard(state, nextDraw, catalog);
  const cards = plural(rules.maxPending, 'carta', 'cartas');

  return {
    council: {
      pending,
      nextCardInSeconds: brings ? until(nextDraw) : null,
      blockedByPending,
      nextAudienceInSeconds: until(nextDraw),
      note: blockedByPending
        ? `Com ${cards} à espera, o conselho não traz outra: responda uma antes da próxima audiência para ela trazer novidade.`
        : brings
          ? null
          : 'O conselho não tem assunto novo para o feudo como ele está: a próxima audiência não traz carta.',
      rulesText: `O conselho pede audiência a cada ${durationText(
        realSecondsCeil(DRAW_INTERVAL_MS, timeScale),
      )} e traz no máximo ${cards} por vez. Cada carta espera ${durationText(
        rules.expiryRealMs / SECOND_MS,
      )} pela resposta; depois, o conselho decide sozinho.`,
    },
    pendingDecisions: pending
      .map((card) => ({
        kind: 'card' as const,
        id: card.instanceId,
        title: card.title,
        expiresInSeconds: card.expiresInSeconds,
      }))
      .sort((a, b) => a.expiresInSeconds - b.expiresInSeconds),
  };
}
