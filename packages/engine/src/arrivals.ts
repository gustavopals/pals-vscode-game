import { emit } from './chronicle';
import { classLabel, namedHeroOf, rosterHasRoom } from './heroes';
import { nextId } from './ids';
import type { GameEvent, GameState, Hero } from './types';

/**
 * Os heróis que chegam ao feudo por recompensa (GDD §9.1; ADR 0017, decisões 5 e 6): a promessa
 * de uma carta e a entrada na lista. É o único lugar do motor que cria um herói; só uma ordem
 * aceita e um evento da linha do tempo chegam aqui, nunca a visão nem `nextEventAt`. Nada aqui
 * sorteia.
 *
 * Toda chegada passa pela lista dos prometidos (`guild.arriving`), mesmo a de quem entra na
 * hora: a carta promete, e `settleHeroArrivals` entrega no mesmo instante. Assim há um caminho
 * só, e a linha da chegada vem depois da linha da carta que a causou.
 */

/**
 * Promete um herói com nome para `atMs`: entra na lista em ordem de instante, e quem empata
 * fica depois de quem já estava.
 */
export function promiseHero(draft: GameState, namedHeroId: string, atMs: number): void {
  const { arriving } = draft.guild;
  const index = arriving.findIndex((entry) => entry.atMs > atMs);
  arriving.splice(index === -1 ? arriving.length : index, 0, {
    namedHeroId: namedHeroId as GameState['guild']['arriving'][number]['namedHeroId'],
    atMs,
  });
}

/**
 * Os prometidos cujo instante chegou entram no feudo, na ordem da lista, enquanto houver lugar
 * na lista de heróis. O limite de **contratação** não os barra (uma recompensa nunca é barrada
 * por ele); o teto da lista, `balance.heroes.rosterCap`, é o único número que os faz esperar, e
 * quem espera não se perde: entra no primeiro instante em que um lugar abrir. Um lugar só abre
 * em uma virada de dia (o herói que parte por soldo, que vem antes daqui na ordem do instante)
 * ou por uma ordem (a dispensa, que chama esta função em seguida): por isso quem espera nunca
 * precisa de um instante próprio na linha do tempo.
 *
 * O herói nasce com `nextId(draft, 'hero')`, no nível e com os traços do conteúdo, e o soldo
 * dele conta desde este instante (`joinedAtMs`). O que o conteúdo já não tem sai da lista sem
 * chegar e sem linha.
 */
export function settleHeroArrivals(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { guild } = draft;
  for (;;) {
    const index = guild.arriving.findIndex((entry) => entry.atMs <= atMs);
    const entry = guild.arriving[index];
    if (entry === undefined) {
      return;
    }
    const named = namedHeroOf(entry.namedHeroId);
    if (named !== null && !rosterHasRoom(draft)) {
      return;
    }
    guild.arriving.splice(index, 1);
    if (named === null) {
      continue;
    }
    const hero: Hero = {
      id: nextId(draft, 'hero'),
      name: named.name,
      gender: named.gender,
      classId: named.classId,
      level: named.level,
      xp: 0,
      traits: [...named.traits],
      status: 'idle',
      joinedAtMs: atMs,
      discontent: false,
    };
    guild.heroes.push(hero);
    emit(
      events,
      draft,
      atMs,
      'heroJoined',
      { heroId: hero.id, namedHeroId: entry.namedHeroId, classId: hero.classId },
      { heroi: hero.name, classe: classLabel(hero).toLowerCase() },
      named.arrival,
    );
  }
}
