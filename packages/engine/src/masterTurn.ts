import { type MasterId, masterTemplates } from '@lotg/content';

import { emit } from './chronicle';
import { nextId } from './ids';
import { hasMaster, isMasterId, masterLabel, mastersHaveRoom } from './masters';
import { housingVacancy } from './population';
import type { GameEvent, GameState } from './types';

/**
 * Os Mestres que chegam ao feudo (GDD §5.4; ADR 0018, decisão 18). É o único lugar do motor que
 * cria um Mestre; só um evento da linha do tempo e uma ordem aceita chegam aqui (a recompensa de
 * uma expedição hoje, o efeito de uma carta na V3F-T1), nunca a visão nem `nextEventAt`. **Nada
 * aqui sorteia**: a chance de encontrar um Mestre é de quem chama (`expeditionTurn.ts`).
 *
 * Toda chegada passa pela porta (`settlement.mastersWaiting`), mesmo a de quem entra na hora:
 * há um caminho só, e quem chegou antes entra antes.
 */

/**
 * Entrega o Mestre `masterId` ao feudo no instante `atMs`: ele ganha o identificador
 * (`nextId(draft, 'master')`) e vai para a porta; havendo vaga nas casas, entra neste mesmo
 * instante, sem edifício (`masterArrived`); sem vaga, fica à espera (`masterWaiting`) e entra no
 * primeiro instante em que houver uma. Diz se o Mestre foi entregue.
 *
 * **Um Mestre com nome é um só**: quem já está no feudo ou à porta não é entregue de novo. Com
 * isso a soma dos dois nunca passa dos Mestres com nome, e eles cabem todos em
 * `balance.masters.rosterCap` (teste de conteúdo): **o teto nunca tira a recompensa de
 * ninguém**. A guarda do teto só existe para o estado nunca sair da forma; chegar a ela é
 * defeito de conteúdo, não de jogada. Quem chama confere antes (`masterCanArrive`) para não
 * anunciar nem sortear o que não pode acontecer.
 */
export function deliverMaster(
  draft: GameState,
  masterId: unknown,
  atMs: number,
  events: GameEvent[],
): boolean {
  if (!masterCanArrive(draft, masterId)) {
    return false;
  }
  const { settlement } = draft;
  const id = nextId(draft, 'master');
  settlement.mastersWaiting.push({ id, masterId });
  settleMasterArrivals(draft, atMs, events, true);
  if (settlement.mastersWaiting.some((waiting) => waiting.id === id)) {
    emit(
      events,
      draft,
      atMs,
      'masterWaiting',
      { masterId: id, master: masterId, waiting: settlement.mastersWaiting.length },
      { mestre: masterLabel(masterId) },
    );
  }
  return true;
}

/** Este Mestre ainda pode chegar: existe no conteúdo, não chegou e cabe no estado. */
export function masterCanArrive(state: GameState, masterId: unknown): masterId is MasterId {
  return isMasterId(masterId) && !hasMaster(state, masterId) && mastersHaveRoom(state);
}

/**
 * Quem espera à porta entra, na ordem de chegada, enquanto houver vaga nas casas. A vaga é a
 * que sobra depois dos habitantes **e de quem está em treinamento** (`housingVacancy`): o
 * recruta já pagou e tem a casa reservada, e o Mestre à espera nunca a toma. Entra sem
 * edifício; pô-lo para trabalhar é ordem do senhor (`assignMaster`).
 *
 * Roda em todo instante processado, logo depois dos aldeões que chegam (a obra que amplia as
 * casas neste instante já terminou) e de novo depois da virada do dia (o aldeão que partiu ou
 * desertou nela abriu uma vaga). Como a vaga só abre nesses dois pontos, quem espera nunca
 * precisa de um instante próprio na linha do tempo, e um estado em repouso nunca tem Mestre à
 * porta com vaga aberta.
 *
 * `fresh` diz que quem entra acabou de chegar (a frase é a da chegada); sem ele, esperava.
 */
export function settleMasterArrivals(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  fresh = false,
): void {
  const { settlement } = draft;
  while (settlement.mastersWaiting.length > 0 && housingVacancy(draft) > 0) {
    const [next] = settlement.mastersWaiting;
    if (next === undefined) {
      return;
    }
    settlement.mastersWaiting.shift();
    settlement.masters.push({
      id: next.id,
      masterId: next.masterId,
      building: null,
      adaptingUntilMs: null,
    });
    draft.stats.mastersArrived = (draft.stats.mastersArrived ?? 0) + 1;
    // Só quem acabou de chegar, e é o último da fila, entra com a frase da chegada.
    const waited = !fresh || settlement.mastersWaiting.length > 0;
    emit(
      events,
      draft,
      atMs,
      'masterArrived',
      { masterId: next.id, master: next.masterId, masters: settlement.masters.length },
      { mestre: masterLabel(next.masterId) },
      waited ? masterTemplates.admitted : undefined,
    );
  }
}
