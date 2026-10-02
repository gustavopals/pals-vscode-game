import { emit } from './chronicle';
import {
  calendarAt,
  isDayBoundary,
  isSeasonBoundary,
  isYearBoundary,
  seasonWithArticle,
  yearOf,
} from './clock';
import { finishConstructions } from './construction';
import { finishAdaptations, tallyCraftExperience } from './craft';
import { applyContinuous } from './economy';
import { hasStartablePlan, settlePlanned } from './planned';
import { finishRecruitments } from './population';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import { announceFilled, fullStores, isStorageFull, reportWaste } from './storage';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';

function processCalendar(draft: GameState, atMs: number, events: GameEvent[]): void {
  if (!isDayBoundary(atMs)) {
    return;
  }
  // O fecho do dia que acabou vem antes de o novo amanhecer.
  reportWaste(draft, atMs, events);
  const date = calendarAt(atMs);
  if (isYearBoundary(atMs)) {
    draft.clock.year = yearOf(atMs);
    draft.clock.yearStartMs = atMs;
    emit(events, draft, atMs, 'yearStarted', { year: date.year });
  }
  if (isSeasonBoundary(atMs)) {
    emit(
      events,
      draft,
      atMs,
      'seasonChanged',
      { season: date.season.id },
      { aEstacao: seasonWithArticle(date.season) },
    );
  }
  emit(events, draft, atMs, 'dayStarted', { dayOfYear: date.dayOfYear });
  // O dia virou: cada ofício conta a experiência com quem está no edifício agora.
  tallyCraftExperience(draft, atMs, events);
}

/** Processa, sobre o rascunho, os eventos discretos de um instante. */
export type EventProcessor = (draft: GameState, atMs: number, events: GameEvent[]) => void;

/**
 * Eventos discretos cujo instante é exatamente `atMs`, em ordem fixa: obras concluídas, aldeões
 * que chegam, virada do dia (o desperdício do dia que acabou, o ano, a estação, o dia e a
 * experiência do ofício), fim de adaptação de quem trocou de ofício, início automático das
 * planejadas, objetivos (`settlePlanned`, que repete os dois enquanto um der motivo ao outro)
 * e, por fim, fome e frio. Os estoques que encheram são registrados depois de tudo, por
 * `advanceWith` e por `applyCommand` (`announceFilled`).
 */
export function processEventsAt(draft: GameState, atMs: number, events: GameEvent[]): void {
  finishConstructions(draft, atMs, events);
  finishRecruitments(draft, atMs, events);
  processCalendar(draft, atMs, events);
  finishAdaptations(draft, atMs);
  settlePlanned(draft, atMs, events);
  settleScarcity(draft, atMs, events);
}

/**
 * O laço de `advanceTo`, com o processador de eventos por parâmetro. O jogo só usa
 * `processEventsAt`; outro processador só existe em teste (`test-helpers.ts`), para provar a
 * divisão de intervalo com eventos que nenhuma regra tem ainda.
 */
export function advanceWith(
  state: GameState,
  gameTimeMs: number,
  processEvents: EventProcessor,
): { state: GameState; events: GameEvent[] } {
  if (gameTimeMs <= state.lastProcessedAt) {
    return { state, events: [] };
  }
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  // Um estado em repouso já passou por aqui e nada muda. Um estado que acabou de ser migrado
  // pode não estar em repouso pelas regras novas (inverno sem madeira, por exemplo): a fome e o
  // frio abrem ou fecham na fronteira, com a linha na Crônica, antes de o tempo andar. Sem isto
  // o próximo evento seria "agora" e o mesmo instante seria processado duas vezes. O mesmo vale
  // para uma planejada automática que já pode começar (um custo que o conteúdo baixou, por
  // exemplo): ela começa aqui, e não no primeiro instante em que alguém olhar.
  if (hasStartablePlan(draft)) {
    settlePlanned(draft, draft.lastProcessedAt, events);
  }
  settleScarcity(draft, draft.lastProcessedAt, events);
  while (draft.lastProcessedAt < gameTimeMs) {
    const next = Math.min(nextEventAt(draft) ?? gameTimeMs, gameTimeMs);
    // Cheio antes do trecho e ainda cheio depois dele: o episódio é o mesmo (`announceFilled`).
    const wasFull = fullStores(draft);
    applyContinuous(draft, next - draft.lastProcessedAt);
    const stillFull = wasFull.filter((resource) => isStorageFull(draft, resource));
    draft.lastProcessedAt = next;
    draft.clock.gameTimeMs = next;
    processEvents(draft, next, events);
    announceFilled(draft, next, events, stillFull);
  }
  return { state: draft, events };
}

/**
 * Avança o estado até `gameTimeMs`, trecho a trecho entre eventos discretos. Dentro de cada
 * trecho as taxas são constantes, então avançar de uma vez dá exatamente o mesmo estado e os
 * mesmos eventos que avançar em qualquer número de passos. Não muta a entrada.
 */
export function advanceTo(
  state: GameState,
  gameTimeMs: number,
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, processEventsAt);
}
