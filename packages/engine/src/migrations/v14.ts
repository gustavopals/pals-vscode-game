import {
  boolean,
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  type Shape,
  text,
} from './shape';
import { rngWithinIds, RNG_STREAM_FAMILIES_V13, stateV13Fields } from './v13';

// Os identificadores e os tetos ficam escritos aqui, como os das outras versões: a forma de uma
// versão não acompanha `@lotg/content`, que cresce. O teste confere que hoje eles coincidem com
// o conteúdo (`HERO_CLASS_IDS`, `HERO_TRAIT_IDS`, `balance.heroes.maxLevel` e `rosterCap`).
export const HERO_CLASS_IDS_V14: readonly string[] = ['warrior', 'archer', 'mage', 'cleric'];
export const HERO_TRAIT_IDS_V14: readonly string[] = [
  'brave',
  'prudent',
  'greedy',
  'charismatic',
  'devout',
  'veteran',
  'loyal',
  'tracker',
];
/** O nível máximo de um herói (`balance.heroes.maxLevel`). */
export const HERO_MAX_LEVEL_V14 = 10;
/**
 * O teto da lista de heróis (`balance.heroes.rosterCap`): nem a contratação nem uma recompensa
 * põem no feudo mais heróis do que isto. O estado tem tamanho limitado (roadmap da v0.3, §0.7).
 */
export const HERO_ROSTER_CAP_V14 = 12;

/** O identificador que o contador de identidades dá a um herói: `hero-<n>`, com `n` a partir de 1, sem zeros à esquerda. */
const HERO_ID = /^hero-([1-9][0-9]*)$/;

const where = (path: string) => (path === '' ? 'estado' : path);

const heroId: Shape = (value, path) =>
  typeof value === 'string' && HERO_ID.test(value) && Number.isSafeInteger(Number(value.slice(5)))
    ? null
    : `${where(path)}: esperado um identificador de herói (hero-<n>)`;

const heroName: Shape = (value, path) =>
  text(value, path) ??
  ((value as string).trim() === '' ? `${where(path)}: esperado um nome, veio texto vazio` : null);

const heroLevel: Shape = (value, path) =>
  Number.isSafeInteger(value) && (value as number) >= 1 && (value as number) <= HERO_MAX_LEVEL_V14
    ? null
    : `${where(path)}: esperado um nível de 1 a ${HERO_MAX_LEVEL_V14}`;

/** Os traços de um herói: identificadores conhecidos, sem repetição. */
const heroTraits: Shape = (value, path) => {
  const found = listOf(oneOf(HERO_TRAIT_IDS_V14))(value, path);
  if (found !== null) {
    return found;
  }
  const traits = value as string[];
  return new Set(traits).size === traits.length ? null : `${where(path)}: traço repetido`;
};

/**
 * Um herói no estado da versão 14: só o que a tarefa que o trouxe usa. Ferimento, equipamento e
 * os estados de quem está fora entram com as versões das tarefas deles.
 */
const hero: Shape = exactObject({
  id: heroId,
  name: heroName,
  classId: oneOf(HERO_CLASS_IDS_V14),
  level: heroLevel,
  xp: natural,
  traits: heroTraits,
  status: literal('idle'),
  joinedAtMs: natural,
  discontent: boolean,
});

/** A lista de heróis: cada um na forma, nunca mais do que o teto, nenhum identificador repetido. */
const heroes: Shape = (value, path) => {
  const found = listOf(hero)(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ id: string }>;
  if (list.length > HERO_ROSTER_CAP_V14) {
    return `${where(path)}: esperada lista de até ${HERO_ROSTER_CAP_V14} heróis, veio de ${list.length}`;
  }
  return new Set(list.map((entry) => entry.id)).size === list.length
    ? null
    : `${where(path)}: identificador de herói repetido`;
};

const guildV14Form: Shape = exactObject({
  heroes,
  wageArrears: nullable(exactObject({ sinceMs: natural, carriedMs: natural, departed: natural })),
  lastWageArrears: nullable(
    exactObject({ endedAtMs: natural, lastedMs: natural, departed: natural }),
  ),
});

type GuildV14 = {
  heroes: Array<{ id: string; joinedAtMs: number; discontent: boolean }>;
  wageArrears: { sinceMs: number } | null;
  lastWageArrears: { endedAtMs: number } | null;
};

/**
 * `guild` na versão 14: a forma dos campos e o que só se vê olhando dois deles. Atraso aberto e
 * registro de atraso fechado nunca andam juntos (o que abre consome o registro), e só há herói
 * Descontente com o atraso aberto.
 */
const guildV14: Shape = (value, path) => {
  const found = guildV14Form(value, path);
  if (found !== null) {
    return found;
  }
  const guild = value as GuildV14;
  const at = path === '' ? '' : `${path}.`;
  if (guild.wageArrears !== null && guild.lastWageArrears !== null) {
    return `${at}lastWageArrears: registro de atraso fechado com um atraso aberto`;
  }
  const index = guild.heroes.findIndex((entry) => entry.discontent);
  if (index !== -1 && guild.wageArrears === null) {
    return `${at}heroes.${index}.discontent: herói Descontente sem soldo em atraso`;
  }
  return null;
};

/**
 * A conferência de `guild` com o resto do estado, que uma guarda de campo não alcança: todo
 * herói tem um identificador que `nextId` já deu (`1 ≤ n ≤ ids.hero`) e chegou até agora
 * (`joinedAtMs ≤ lastProcessedAt`), e nenhum atraso começou ou acabou no futuro.
 */
const guildWithinState: Shape = (value, path) => {
  const { guild, ids, lastProcessedAt } = value as {
    guild: GuildV14;
    ids: Record<string, number>;
    lastProcessedAt: number;
  };
  const at = path === '' ? 'guild' : `${path}.guild`;
  const issued = Object.hasOwn(ids, 'hero') ? (ids.hero as number) : 0;
  for (const [index, entry] of guild.heroes.entries()) {
    if (Number(entry.id.slice(5)) > issued) {
      return `${at}.heroes.${index}.id: herói além do contador de ids.hero`;
    }
    if (entry.joinedAtMs > lastProcessedAt) {
      return `${at}.heroes.${index}.joinedAtMs: herói que chegou depois de agora`;
    }
  }
  if (guild.wageArrears !== null && guild.wageArrears.sinceMs > lastProcessedAt) {
    return `${at}.wageArrears.sinceMs: atraso que abriu depois de agora`;
  }
  if (guild.lastWageArrears !== null && guild.lastWageArrears.endedAtMs > lastProcessedAt) {
    return `${at}.lastWageArrears.endedAtMs: atraso que fechou depois de agora`;
  }
  return null;
};

/**
 * O `GameState` da versão 14: o da versão 13 com os heróis no feudo e o soldo em atraso
 * (V3C-T1; ADR 0017, decisões 3, 5 e 7).
 *
 * - Entra `guild.heroes`: a lista dos heróis, cada um com identificador, nome, classe, nível,
 *   experiência, traços, o que está fazendo (só `idle` nesta versão), quando chegou e se está
 *   Descontente. Atributos e poder são derivados, nunca gravados.
 * - Entram `guild.wageArrears` e `guild.lastWageArrears`, no molde de `settlement.famine` e
 *   `settlement.lastFamine`: o atraso aberto (quando abriu ou reabriu, o quanto já tinha durado
 *   e quantos heróis o prazo já cobrou) e o último que fechou, para o que reabrir dentro da
 *   janela continuar de onde ele parou.
 * - `rng` e `ids` não mudam de forma. O herói não tem fluxo de sorteio próprio.
 *
 * Quem subir `schemaVersion` para 15 acrescenta aqui o passo `v14ToV15`, com esta forma como
 * entrada, e escreve a forma nova em `v15.ts`.
 */
export const stateV14Fields: Readonly<Record<string, Shape>> = {
  ...stateV13Fields,
  schemaVersion: literal(14),
  guild: guildV14,
};

const stateV14Form: Shape = exactObject(stateV14Fields);
const stateV14Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV14: Shape = (value, path) =>
  stateV14Form(value, path) ?? stateV14Streams(value, path) ?? guildWithinState(value, path);
