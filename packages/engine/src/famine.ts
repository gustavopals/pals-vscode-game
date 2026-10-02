import { foodRunsOutIn, netRates } from './economy';
import type { GameState } from './types';

/**
 * Um passo da fome no instante `atMs`: abre ou encerra, conforme o estado de agora, e diz se
 * mexeu. Só toca no indicador e no estoque; a Crônica e a fila de recrutamento ficam com
 * `settleScarcity`, que só registra a mudança que sobrar no fim do instante.
 *
 * Começa no instante exato em que a comida não cobre nem mais um milissegundo de consumo.
 * Termina no primeiro instante em que o saldo de comida, já com as penalidades de produção,
 * volta a ser positivo. O saldo só muda em comandos e eventos, então basta conferir neles.
 */
export function stepFamine(draft: GameState, atMs: number): boolean {
  const { settlement } = draft;
  if (settlement.famine) {
    if (netRates(draft).food > 0) {
      settlement.famine = null;
      return true;
    }
    return false;
  }
  if (foodRunsOutIn(draft) === 0) {
    // O que sobra é menos de um milissegundo de consumo: zera para a fome ter um estado único.
    settlement.resources.food = 0;
    settlement.accumulators.food = 0;
    settlement.famine = { sinceMs: atMs };
    return true;
  }
  return false;
}
