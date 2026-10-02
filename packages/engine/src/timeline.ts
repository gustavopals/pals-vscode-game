import { nextDayBoundary } from './clock';
import { foodRunsOutIn, netRates, woodRunsOutIn } from './economy';
import { storageFillsIn } from './storage';
import type { GameState } from './types';

/**
 * Instante, em ms de jogo, do próximo evento discreto: fim de obra, chegada de aldeão,
 * virada de dia (que cobre estação e ano), o momento em que a comida acaba, aquele em que a
 * madeira acaba na lareira ou aquele em que um estoque chega ao limite. Nunca devolve um
 * instante anterior a `lastProcessedAt`.
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
  const rates = netRates(state);
  const foodRunsOut = foodRunsOutIn(state, rates);
  if (foodRunsOut !== null) {
    candidates.push(now + foodRunsOut);
  }
  // No inverno a lenha come a madeira: o instante em que ela acaba abre o frio.
  const woodRunsOut = woodRunsOutIn(state, rates);
  if (woodRunsOut !== null) {
    candidates.push(now + woodRunsOut);
  }
  // O instante em que um estoque enche: dali em diante a produção dele é desperdício.
  const fills = storageFillsIn(state, rates);
  if (fills !== null) {
    candidates.push(now + fills);
  }
  return Math.max(now, Math.min(...candidates));
}
