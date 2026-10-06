import { balance } from '@lotg/content';

import { emit } from './chronicle';
import { classLabel, namedHeroOf, rosterHasRoom } from './heroes';
import { nextId } from './ids';
import type { GameEvent, GameState, Hero } from './types';

/**
 * Os heróis que chegam ao feudo (GDD §9.1; ADR 0017, decisões 5 e 6): a promessa de uma carta,
 * a entrada na lista e, pela mesma porta (`admitHero`), o herói que a Taverna vende. É o único
 * lugar do motor que cria um herói; só uma ordem aceita e um evento da linha do tempo chegam
 * aqui, nunca a visão nem `nextEventAt`. Nada aqui sorteia.
 *
 * Toda chegada passa pela lista dos prometidos (`guild.arriving`), mesmo a de quem entra na
 * hora: a carta promete, e `settleHeroArrivals` entrega no mesmo instante. Assim há um caminho
 * só, e a linha da chegada vem depois da linha da carta que a causou.
 */

/** O que define um herói que entra no feudo: o resto (identificador, experiência, estado) nasce aqui. */
export type HeroSpec = Pick<Hero, 'name' | 'gender' | 'classId' | 'level'> & {
  readonly traits: readonly Hero['traits'][number][];
};

/**
 * Põe um herói na lista, com `nextId(draft, 'hero')` e o soldo contando desde `atMs`
 * (`joinedAtMs`). É o caminho de todo herói: o que uma carta entrega e o que a Taverna vende.
 * Quem chama já conferiu o lugar (o teto da lista, ou o limite de contratação) e emite o evento.
 */
export function admitHero(draft: GameState, spec: HeroSpec, atMs: number): Hero {
  const hero: Hero = {
    id: nextId(draft, 'hero'),
    name: spec.name,
    gender: spec.gender,
    classId: spec.classId,
    level: spec.level,
    xp: 0,
    traits: [...spec.traits],
    status: 'idle',
    injury: null,
    captivity: null,
    equipment: { weapon: null, armor: null, accessory: null },
    joinedAtMs: atMs,
    discontent: false,
  };
  draft.guild.heroes.push(hero);
  return hero;
}

/**
 * Promete um herói com nome para `atMs`: entra na lista em ordem de instante, e quem empata
 * fica depois de quem já estava. Diz se prometeu.
 *
 * **Um herói com nome é um só.** Quem já foi prometido, ou já serve ao feudo (os nomes dos
 * heróis de carta não são sorteados para candidato nenhum: teste de conteúdo), não é prometido
 * de novo. Com isso a lista nunca tem mais entradas do que heróis com nome, e eles cabem todos
 * em `balance.heroes.arrivingCap` (teste de conteúdo): **o teto nunca tira a recompensa de
 * ninguém**. A última guarda, a da lista cheia, só existe para o estado nunca sair da forma
 * (a guarda de forma recusaria gravá-lo, e a partida pararia); chegar a ela é defeito de
 * conteúdo, não de jogada.
 */
export function promiseHero(draft: GameState, namedHeroId: string, atMs: number): boolean {
  const { arriving, heroes } = draft.guild;
  const named = namedHeroOf(namedHeroId);
  if (
    arriving.some((entry) => entry.namedHeroId === namedHeroId) ||
    (named !== null && heroes.some((hero) => hero.name === named.name)) ||
    arriving.length >= balance.heroes.arrivingCap
  ) {
    return false;
  }
  const index = arriving.findIndex((entry) => entry.atMs > atMs);
  arriving.splice(index === -1 ? arriving.length : index, 0, {
    namedHeroId: namedHeroId as GameState['guild']['arriving'][number]['namedHeroId'],
    atMs,
  });
  return true;
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
    const hero = admitHero(draft, named, atMs);
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
