import {
  CATALOG,
  type Catalog,
  deliverCard,
  DRAW_INTERVAL_MS,
  dueContinuations,
  eligibleCards,
  freeSeats,
  scriptedCard,
} from './council';
import { pickWeighted } from './random';
import type { GameEvent, GameState } from './types';

/**
 * O sorteio do Conselho (GDD §7.1; ADR 0014, decisões 1 e 18), na virada do dia de jogo, depois
 * da moral. É o único ponto do Conselho que sorteia, e só `advanceTo` chega aqui.
 *
 * 1. **Cadência ancorada.** Se o instante do sorteio chegou, `nextDrawAtMs` anda um intervalo,
 *    **sempre**: haja carta ou não, haja lugar ou não. O resultado de uma ausência não depende
 *    de como o intervalo foi dividido nem de quando o jogador respondeu.
 * 2. **Lugar.** Com a mesa cheia, o sorteio é pulado. Uma continuação cujo prazo já chegou tem
 *    prioridade: o lugar dela está reservado, e o sorteio só tira carta se sobrar outro. (As
 *    cartas que expiram neste mesmo instante ainda contam: a expiração vem depois da virada.)
 * 3. **Carta.** Uma roteirizada cujo dia chegou vai na frente; senão, sorteio por peso entre as
 *    elegíveis, no fluxo `council`. Sem nenhuma elegível, nada acontece e o fluxo não anda.
 */
export function drawCard(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council } = draft;
  if (atMs < council.nextDrawAtMs) {
    return;
  }
  // Um intervalo por vez até passar de agora: em uma partida em dia é um passo só. O laço só
  // roda mais em um estado que chegou atrasado, e mesmo esse sorteia uma vez, não uma por
  // intervalo perdido.
  while (council.nextDrawAtMs <= atMs) {
    council.nextDrawAtMs += DRAW_INTERVAL_MS;
  }
  if (freeSeats(draft) - dueContinuations(draft, atMs, catalog).length <= 0) {
    return;
  }
  const scripted = scriptedCard(draft, atMs, catalog);
  if (scripted !== null) {
    deliverCard(draft, scripted, atMs, events, { source: 'scripted' });
    return;
  }
  const card = pickWeighted(draft, 'council', eligibleCards(draft, atMs, catalog));
  if (card !== null) {
    deliverCard(draft, card, atMs, events, { source: 'draw' });
  }
}
