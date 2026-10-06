import { exactObject, listOf, literal, natural, oneOf, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
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

export const guildV15Fields: Readonly<Record<string, Shape>> = {
  ...guildV14Fields,
  heroes: heroRoster(exactObject({ ...heroV14Fields, gender: oneOf(HERO_GENDER_IDS_V15) })),
  arriving,
};

const guildV15: Shape = guildOf(exactObject(guildV15Fields));

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
 * O passo que sai daqui é o `v15ToV16`, abaixo; a forma da versão 16 está em `v16.ts`.
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

/**
 * Versão 15 → 16: a Taverna (V3C-T2; ADR 0017, decisões 4, 5 e 10).
 *
 * - `settlement.buildings` ganha a Taverna (`tavern`) no nível 0: ninguém a tinha. Quem já tem
 *   o Salão no nível 3 pode erguê-la logo depois da migração.
 * - `guild.tavernOffers` entra vazia e `guild.tavern`, sem rotação marcada, sem festival em
 *   curso e sem festival dado: a lista de candidatos nasce quando a Taverna ficar pronta, e a
 *   rotação conta dali.
 *
 * **O passo não cria prazo nenhum**, e por isso não usa a fronteira. Não emite evento, não dá
 * identificador a ninguém e não toca o gerador: o fluxo `tavern` nasce no primeiro sorteio, na
 * inauguração. O limite de contratação continua em um herói até a Taverna existir, e a moral
 * de ninguém muda: os termos novos só valem com a Taverna erguida ou com um herói Devoto, que
 * nenhuma regra anterior dava.
 */
export const v15ToV16: MigrationStep = {
  from: 15,
  summary: 'Taverna no nível 0, sem candidatos, sem rotação marcada e sem festival',
  shape: stateV15,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    const guild = state.guild as StoredState;
    return {
      ...state,
      schemaVersion: 16,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as StoredState), tavern: 0 },
      },
      guild: {
        ...guild,
        tavernOffers: [],
        tavern: { nextRotationAtMs: null, festival: null, lastFestivalAtMs: null },
      },
    };
  },
};
