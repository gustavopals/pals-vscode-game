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
import { applyContinuous } from './economy';
import { settleFamine } from './famine';
import { evaluateObjectives } from './objectives';
import { finishRecruitments } from './population';
import { cloneState } from './state';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';

function processCalendar(draft: GameState, atMs: number, events: GameEvent[]): void {
  if (!isDayBoundary(atMs)) {
    return;
  }
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
}

/** Processa, sobre o rascunho, os eventos discretos de um instante. */
export type EventProcessor = (draft: GameState, atMs: number, events: GameEvent[]) => void;

/** Eventos discretos cujo instante é exatamente `atMs`, em ordem fixa. */
export function processEventsAt(draft: GameState, atMs: number, events: GameEvent[]): void {
  finishConstructions(draft, atMs, events);
  finishRecruitments(draft, atMs, events);
  processCalendar(draft, atMs, events);
  evaluateObjectives(draft, atMs, events);
  settleFamine(draft, atMs, events);
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
  while (draft.lastProcessedAt < gameTimeMs) {
    const next = Math.min(nextEventAt(draft) ?? gameTimeMs, gameTimeMs);
    applyContinuous(draft, next - draft.lastProcessedAt);
    draft.lastProcessedAt = next;
    draft.clock.gameTimeMs = next;
    processEvents(draft, next, events);
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
