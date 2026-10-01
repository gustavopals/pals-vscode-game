import { emit } from './chronicle';
import { foodRunsOutIn, netRates } from './economy';
import type { GameEvent, GameState } from './types';

/**
 * Abre ou encerra a fome no instante `atMs`, depois de qualquer mudança no estado.
 *
 * Começa no instante exato em que a comida não cobre nem mais um milissegundo de consumo.
 * Termina no primeiro instante em que o saldo de comida, já com a penalidade de produção,
 * volta a ser positivo. O saldo só muda em comandos e eventos, então basta conferir neles.
 */
export function settleFamine(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  if (settlement.famine) {
    if (netRates(draft).food > 0) {
      // A fila de recrutamento ficou congelada durante a fome: retoma de onde parou.
      const frozenFor = atMs - settlement.famine.sinceMs;
      for (const recruit of settlement.recruitmentQueue) {
        recruit.finishesAtMs += frozenFor;
      }
      settlement.famine = null;
      emit(events, draft, atMs, 'famineEnded');
    }
    return;
  }
  if (foodRunsOutIn(draft) === 0) {
    // O que sobra é menos de um milissegundo de consumo: zera para a fome ter um estado único.
    settlement.resources.food = 0;
    settlement.accumulators.food = 0;
    settlement.famine = { sinceMs: atMs };
    emit(events, draft, atMs, 'famineStarted');
  }
}
