import type { ColdRelief } from '@lotg/content';

import { seasonAt } from './clock';
import { woodCoversFirewood, woodRunsOutIn } from './economy';
import type { GameState } from './types';

/** A estação em vigor queima lenha (GDD §4.1): hoje, só o inverno. */
export function burnsFirewood(state: GameState): boolean {
  return seasonAt(state.lastProcessedAt).effects.firewoodPerVillagerPerHour.num > 0;
}

/**
 * Por que o frio passaria agora, ou `null` se ele continua: `thaw` quando a estação já não
 * queima lenha (o frio **sempre** termina na virada para a primavera), `firewood` quando há
 * madeira de novo, no estoque ou no saldo, já com a penalidade do frio na produção.
 */
export function coldRelief(state: GameState): ColdRelief | null {
  if (!burnsFirewood(state)) {
    return 'thaw';
  }
  return woodCoversFirewood(state) ? 'firewood' : null;
}

/**
 * Um passo do frio no instante `atMs`: abre ou encerra, conforme o estado de agora, e diz se
 * mexeu. Como `stepFamine`, só toca no indicador e no estoque.
 *
 * O frio começa no instante exato em que a madeira não cobre nem mais um milissegundo de lenha.
 * Enquanto dura, a madeira não fica negativa: só se queima o que existe. Fora da estação da
 * lenha a madeira nunca cai sozinha, então o frio só abre no inverno.
 */
export function stepCold(draft: GameState, atMs: number): boolean {
  const { settlement } = draft;
  if (settlement.cold) {
    if (coldRelief(draft) !== null) {
      settlement.cold = null;
      return true;
    }
    return false;
  }
  if (woodRunsOutIn(draft) === 0) {
    // O que sobra é menos de um milissegundo de lenha: zera para o frio ter um estado único.
    settlement.resources.wood = 0;
    settlement.accumulators.wood = 0;
    settlement.cold = { sinceMs: atMs };
    return true;
  }
  return false;
}
