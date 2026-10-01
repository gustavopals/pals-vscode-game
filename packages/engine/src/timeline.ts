import { nextDayBoundary } from './clock';
import { foodRunsOutIn } from './economy';
import type { GameState } from './types';

/**
 * Instante, em ms de jogo, do próximo evento discreto: fim de obra, chegada de aldeão,
 * virada de dia (que cobre estação e ano) ou o momento em que a comida acaba.
 * Nunca devolve um instante anterior a `lastProcessedAt`.
 */
export function nextEventAt(state: GameState): number | null {
  const now = state.lastProcessedAt;
  const { constructionQueues, recruitmentQueue, famine } = state.settlement;
  const candidates = [nextDayBoundary(now)];

  for (const slot of constructionQueues) {
    if (slot !== null) {
      candidates.push(slot.finishesAtMs);
    }
  }
  // Durante a fome a fila de recrutamento fica congelada.
  const nextRecruit = recruitmentQueue[0];
  if (nextRecruit !== undefined && !famine) {
    candidates.push(nextRecruit.finishesAtMs);
  }
  const foodRunsOut = foodRunsOutIn(state);
  if (foodRunsOut !== null) {
    candidates.push(now + foodRunsOut);
  }
  return Math.max(now, Math.min(...candidates));
}
