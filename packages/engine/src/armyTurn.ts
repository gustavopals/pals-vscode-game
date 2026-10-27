import { balance, type UnitId } from '@lotg/content';

import { soldierCount, troopText } from './army';
import { emit } from './chronicle';
import { releaseExcessWorkers } from './population';
import type { GameEvent, GameState } from './types';

/**
 * O fim do treino (V4C-T1; ADR 0019, decisão 7). Resolvido junto das obras e dos recrutas que
 * chegam, antes dos Mestres à porta (`processEventsAt`): o soldado sai de um aldeão sem ofício
 * e, se todos trabalham, do edifício com mais gente (`releaseExcessWorkers`, a regra da
 * deserção). **Nada aqui sorteia.** O soldado continua morando nas casas, e por isso a vaga
 * habitacional não muda.
 *
 * O piso de `populationFloor` aldeões protege o feudo: se a população caiu depois da ordem
 * (deserção, partida) e já não sobram aldeões para todos, o lote termina com os que couberem, e
 * os outros ficam por treinar (o custo não volta).
 */
export function finishTraining(draft: GameState, atMs: number, events: GameEvent[]): void {
  const batch = draft.army.training;
  if (batch === null || batch.endsAtMs > atMs) {
    return;
  }
  draft.army.training = null;
  const { settlement } = draft;
  const spare = Math.max(0, settlement.population.villagers - balance.morale.populationFloor);
  const trained = Math.min(batch.amount, spare);
  const lost = batch.amount - trained;
  if (trained > 0) {
    // Quem chega do estado 34 ainda não tinha contador: os soldados presentes são o piso
    // comprovável do treino anterior (pendência H-1). Daqui em diante, baixas não apagam treino.
    draft.stats.soldiersTrained =
      Math.max(draft.stats.soldiersTrained ?? 0, soldierCount(draft)) + trained;
    settlement.population.villagers -= trained;
    draft.army.units[batch.unit] += trained;
    releaseExcessWorkers(draft);
    emit(
      events,
      draft,
      atMs,
      'soldiersTrained',
      {
        unit: batch.unit,
        amount: trained,
        lost,
        soldiers: draft.army.units[batch.unit],
        villagers: settlement.population.villagers,
      },
      { tropa: troopText(batch.unit, trained) },
    );
  }
  // A Crônica sempre diz o que o piso de aldeões tirou do lote (C-3: o custo não volta).
  if (lost > 0) {
    emit(
      events,
      draft,
      atMs,
      'trainingShortfall',
      { unit: batch.unit, ordered: batch.amount, amount: trained, lost },
      { tropa: troopText(batch.unit, lost) },
    );
  }
}

/**
 * Soldados que uma carta do Conselho entrega já treinados (V4H-T1): saem dos aldeões acima do
 * piso, como no fim do treino, e entram no Exército sem fila. Devolve quantos entraram; a opção
 * que os dá é trancada sem vaga (`requires.soldierRoom`), então aqui só se protege o piso.
 * Nada aqui sorteia, e a Crônica da carta é quem conta o que aconteceu.
 */
export function grantSoldiers(draft: GameState, unit: UnitId, amount: number): number {
  const { settlement } = draft;
  const spare = Math.max(0, settlement.population.villagers - balance.morale.populationFloor);
  const trained = Math.min(amount, spare);
  if (trained > 0) {
    settlement.population.villagers -= trained;
    draft.army.units[unit] += trained;
    releaseExcessWorkers(draft);
  }
  return trained;
}
