import { nextDayBoundary } from './clock';
import { nextAdaptationEndAt } from './craft';
import { foodRunsOutIn, netRates, woodRunsOutIn } from './economy';
import { autoStartsIn } from './planned';
import { storageFillsIn } from './storage';
import type { GameState } from './types';

/**
 * Instante, em ms de jogo, em que a produção contínua completa o custo de uma planejada
 * automática que só espera recurso: nele a obra começa sozinha (GDD §6.3). `null` quando nenhuma
 * chega lá com as taxas de agora. Vale até o próximo evento que muda as taxas; `nextEventAt` o
 * refaz a cada trecho.
 */
export function nextAutoStartAt(state: GameState, rates = netRates(state)): number | null {
  const starts = autoStartsIn(state, rates);
  return starts === null ? null : state.lastProcessedAt + starts;
}

/**
 * Instante, em ms de jogo, do próximo evento discreto: fim de obra, chegada de aldeão,
 * virada de dia (que cobre estação, ano e a contagem da experiência do ofício), o fim da
 * adaptação de quem trocou de ofício, o momento em que a comida acaba, aquele em que a madeira
 * acaba na lareira, aquele em que um estoque chega ao limite ou aquele em que uma planejada
 * automática junta o custo. Nunca devolve um instante anterior a `lastProcessedAt`.
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
  // Quem trocou de ofício passa a render inteiro: a taxa do edifício muda nesse instante.
  const adaptationEnds = nextAdaptationEndAt(state);
  if (adaptationEnds !== null) {
    candidates.push(adaptationEnds);
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
  // O instante em que a produção completa o custo de uma planejada automática.
  const autoStart = nextAutoStartAt(state, rates);
  if (autoStart !== null) {
    candidates.push(autoStart);
  }
  return Math.max(now, Math.min(...candidates));
}
