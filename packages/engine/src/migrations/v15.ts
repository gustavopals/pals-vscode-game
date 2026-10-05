import { exactObject, listOf, literal, natural, oneOf, type Shape } from './shape';
import { rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import {
  guildOf,
  guildV14Fields,
  guildWithinState,
  heroRoster,
  heroV14Fields,
  stateV14Fields,
} from './v14';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`HERO_GENDER_IDS` e `balance.heroes.arrivingCap`).
export const HERO_GENDER_IDS_V15: readonly string[] = ['f', 'm'];
/** O teto da lista dos heróis prometidos (`balance.heroes.arrivingCap`). */
export const HERO_ARRIVING_CAP_V15 = 4;

const where = (path: string) => (path === '' ? 'estado' : path);

/**
 * O herói com nome que vem a caminho. A guarda confere a **forma** do identificador, e não a
 * lista de `NAMED_HERO_IDS`: os heróis com nome crescem com as cartas, e um herói novo no
 * conteúdo não é uma versão nova do estado. O que o conteúdo já não tiver sai da lista sem
 * chegar, como a carta que o catálogo deixou de ter.
 */
const namedHeroId: Shape = (value, path) =>
  typeof value === 'string' && /^[a-z][A-Za-z0-9]*$/.test(value)
    ? null
    : `${where(path)}: esperado o identificador de um herói com nome`;

/** Os heróis prometidos: cada um na forma, em ordem de instante, nunca mais do que o teto. */
const arriving: Shape = (value, path) => {
  const found = listOf(exactObject({ namedHeroId, atMs: natural }))(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ atMs: number }>;
  if (list.length > HERO_ARRIVING_CAP_V15) {
    return `${where(path)}: esperada lista de até ${HERO_ARRIVING_CAP_V15} heróis a caminho, veio de ${list.length}`;
  }
  const index = list.findIndex((entry, at) => at > 0 && entry.atMs < (list[at - 1]?.atMs ?? 0));
  return index === -1 ? null : `${where(path)}.${index}.atMs: lista fora da ordem de chegada`;
};

const guildV15: Shape = guildOf(
  exactObject({
    ...guildV14Fields,
    heroes: heroRoster(exactObject({ ...heroV14Fields, gender: oneOf(HERO_GENDER_IDS_V15) })),
    arriving,
  }),
);

/**
 * O `GameState` da versão 15: o da versão 14 com a forma de tratamento do herói e a lista dos
 * heróis prometidos (V3C-T3; ADR 0017, decisão 6).
 *
 * - `guild.heroes[].gender`: `'f'` ou `'m'`. É o que deixa a ficha concordar com o nome
 *   ("Edda — Guerreira").
 * - `guild.arriving`: os heróis com nome que uma carta prometeu e que ainda não chegaram, em
 *   ordem de instante. O instante vencido é de quem espera lugar na lista de heróis.
 * - `rng` e `ids` não mudam de forma.
 *
 * Quem subir `schemaVersion` para 16 acrescenta aqui o passo `v15ToV16`, com esta forma como
 * entrada, e escreve a forma nova em `v16.ts`.
 */
export const stateV15Fields: Readonly<Record<string, Shape>> = {
  ...stateV14Fields,
  schemaVersion: literal(15),
  guild: guildV15,
};

const stateV15Form: Shape = exactObject(stateV15Fields);
const stateV15Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV15: Shape = (value, path) =>
  stateV15Form(value, path) ?? stateV15Streams(value, path) ?? guildWithinState(value, path);
