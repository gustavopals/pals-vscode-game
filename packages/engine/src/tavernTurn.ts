import { balance, heroNames, tavernCandidates } from '@lotg/content';

import { emit } from './chronicle';
import { nextDayBoundary } from './clock';
import { namedHeroOf } from './heroes';
import { nextId } from './ids';
import { nextInt, pickWeighted } from './random';
import { offersPerRotation, tavernLevel } from './tavern';
import type { GameEvent, GameState, TavernOffer } from './types';

/**
 * A Taverna na linha do tempo (GDD §6.1 e §9.1; ADR 0017, decisões 4 e 10): a troca dos
 * candidatos e o fim do festival. É o único ponto da Taverna que sorteia e que dá identificador
 * a uma oferta, e só `advanceTo` chega aqui: as ordens (`tavernOrders.ts`) não sorteiam.
 */

const { rotationMs } = balance.tavern;

/**
 * Os candidatos de uma rotação, sorteados no fluxo `tavern`, um por vez: primeiro o modelo, por
 * peso, na ordem do conteúdo e **sem reposição** dentro da rotação (dois candidatos da mesma
 * lista nunca são o mesmo modelo); depois o nome, com a mesma chance entre os que ninguém usa,
 * na ordem do conteúdo. Ninguém usa: nenhum herói do feudo, nenhum prometido e nenhum candidato
 * já sorteado nesta lista. O preço é o do modelo, sem sorteio.
 *
 * Só se sorteia o que pode acontecer: sem modelo ou sem nome livre, a lista para ali.
 */
function drawOffers(draft: GameState): TavernOffer[] {
  const { guild } = draft;
  const taken = new Set(guild.heroes.map((hero) => hero.name));
  for (const promised of guild.arriving) {
    const named = namedHeroOf(promised.namedHeroId);
    if (named !== null) {
      taken.add(named.name);
    }
  }
  const offers: TavernOffer[] = [];
  let models = [...tavernCandidates];
  for (let seat = offersPerRotation(draft); seat > 0; seat -= 1) {
    const free = heroNames.filter((entry) => !taken.has(entry.name));
    if (free.length === 0) {
      break;
    }
    const model = pickWeighted(draft, 'tavern', models);
    if (model === null) {
      break;
    }
    models = models.filter((entry) => entry !== model);
    const named = free[nextInt(draft, 'tavern', free.length)];
    if (named === undefined) {
      throw new Error('Sorteio de nome sem resultado.');
    }
    taken.add(named.name);
    offers.push({
      offerId: nextId(draft, 'offer'),
      templateId: model.id,
      name: named.name,
      gender: named.gender,
      price: model.price,
    });
  }
  return offers;
}

/**
 * A rotação dos candidatos, **ancorada** como a cadência do Conselho.
 *
 * - **Inauguração.** No primeiro instante em que a Taverna existe e ainda não há rotação
 *   marcada (o da obra que a ergueu), nasce a primeira lista, e a próxima troca fica marcada
 *   para `rotationMs` depois.
 * - **Troca.** No instante marcado, `nextRotationAtMs` anda um intervalo, **sempre**: haja
 *   quem contratar ou não, haja lugar na equipe ou não. A lista inteira sai e entra outra:
 *   quem não foi contratado não volta. O número de candidatos é o do nível da Taverna **neste
 *   instante**: subir de nível no meio de uma rotação não mexe na lista que está na mesa.
 *
 * O resultado de uma ausência não depende de como o intervalo foi dividido: cada instante
 * marcado está em `nextEventAt`, e cada um sorteia uma vez. Um estado que chega atrasado (a
 * rotação vencida há mais de um intervalo) sorteia uma lista só, não uma por intervalo perdido.
 * A rotação não gera linha na Crônica: muda só a visão.
 */
function rotateOffers(draft: GameState, atMs: number): void {
  if (tavernLevel(draft) === 0) {
    return;
  }
  const { tavern } = draft.guild;
  if (tavern.nextRotationAtMs === null) {
    tavern.nextRotationAtMs = atMs + rotationMs;
  } else if (atMs < tavern.nextRotationAtMs) {
    return;
  } else {
    while (tavern.nextRotationAtMs <= atMs) {
      tavern.nextRotationAtMs += rotationMs;
    }
  }
  draft.guild.tavernOffers = drawOffers(draft);
}

/**
 * O fim do festival: a primeira virada de dia que já não conta o efeito de moral dele, que é a
 * primeira depois de `untilMs` (a mesma conta de `moraleEffectEndsAt`). É uma virada de dia, que já é um instante da linha do tempo: o fim não
 * precisa de um instante próprio.
 */
function endFestival(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { tavern } = draft.guild;
  if (tavern.festival === null || atMs < nextDayBoundary(tavern.festival.untilMs)) {
    return;
  }
  tavern.festival = null;
  emit(events, draft, atMs, 'festivalEnded', {});
}

/**
 * A Taverna em um instante da linha do tempo: primeiro o festival que acabou, depois a troca
 * dos candidatos. Roda depois das incursões e antes das planejadas e dos objetivos
 * (`processEventsAt`).
 */
export function settleTavern(draft: GameState, atMs: number, events: GameEvent[]): void {
  endFestival(draft, atMs, events);
  rotateOffers(draft, atMs);
}
