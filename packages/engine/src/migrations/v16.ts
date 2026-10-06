import {
  boolean,
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  type Shape,
  text,
} from './shape';
import { settlementV12Fields } from './v12';
import { rngShape, rngWithinIds, RNG_FIXED_STREAMS_V13, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState } from './v14';
import { guildV15Fields, HERO_GENDER_IDS_V15, stateV15Fields } from './v15';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content` nem `random.ts`. O teste confere que hoje coincidem com
// o conteúdo (`BUILDING_IDS`, `RNG_STREAMS` e a maior lista de `balance.tavern.offersByLevel`).
export const BUILDING_IDS_V16: readonly string[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
  'tavern',
];
/** Os fluxos fixos: os da versão 13 e o da Taverna. */
export const RNG_FIXED_STREAMS_V16: readonly string[] = [...RNG_FIXED_STREAMS_V13, 'tavern'];
/** Quantos candidatos a Taverna oferece de uma vez, no máximo (`balance.tavern.offersByLevel`). */
export const TAVERN_OFFERS_CAP_V16 = 3;
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

/** O identificador que o contador de identidades dá a uma oferta: `offer-<n>`, com `n` a partir de 1. */
const OFFER_ID = /^offer-([1-9][0-9]*)$/;

const where = (path: string) => (path === '' ? 'estado' : path);

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

const offerId: Shape = (value, path) =>
  typeof value === 'string' && OFFER_ID.test(value) && Number.isSafeInteger(Number(value.slice(6)))
    ? null
    : `${where(path)}: esperado um identificador de oferta (offer-<n>)`;

/**
 * O modelo do candidato. Como o herói com nome da versão 15, a guarda confere a **forma** do
 * identificador, e não a lista de `TAVERN_CANDIDATE_IDS`: os modelos crescem com o conteúdo, e
 * um modelo novo não é uma versão nova do estado. A oferta de um modelo que o conteúdo já não
 * tem não aparece na visão e não pode ser contratada; sai na rotação seguinte.
 */
const templateId: Shape = (value, path) =>
  typeof value === 'string' && /^[a-z][A-Za-z0-9]*$/.test(value)
    ? null
    : `${where(path)}: esperado o identificador de um modelo de candidato`;

const offerName: Shape = (value, path) =>
  text(value, path) ??
  ((value as string).trim() === '' ? `${where(path)}: esperado um nome, veio texto vazio` : null);

/** Os candidatos da rotação: cada um na forma, nunca mais do que o teto, nenhum repetido. */
const tavernOffers: Shape = (value, path) => {
  const found = listOf(
    exactObject({
      offerId,
      templateId,
      name: offerName,
      gender: oneOf(HERO_GENDER_IDS_V15),
      price: positive,
    }),
  )(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ offerId: string }>;
  if (list.length > TAVERN_OFFERS_CAP_V16) {
    return `${where(path)}: esperada lista de até ${TAVERN_OFFERS_CAP_V16} candidatos, veio de ${list.length}`;
  }
  return new Set(list.map((entry) => entry.offerId)).size === list.length
    ? null
    : `${where(path)}: identificador de oferta repetido`;
};

const guildV16: Shape = guildOf(
  exactObject({
    ...guildV15Fields,
    tavernOffers,
    tavern: exactObject({
      nextRotationAtMs: nullable(natural),
      festival: nullable(exactObject({ untilMs: natural })),
      lastFestivalAtMs: nullable(natural),
    }),
  }),
);

type TavernState = {
  settlement: { buildings: { tavern: number } };
  guild: {
    tavernOffers: Array<{ offerId: string }>;
    tavern: {
      nextRotationAtMs: number | null;
      festival: { untilMs: number } | null;
      lastFestivalAtMs: number | null;
    };
  };
  ids: Record<string, number>;
  lastProcessedAt: number;
};

/**
 * A conferência da Taverna com o resto do estado, que uma guarda de campo não alcança:
 *
 * - sem o edifício não há candidato, rotação marcada nem festival em curso;
 * - toda oferta tem um identificador que `nextId` já deu (`1 ≤ n ≤ ids.offer`);
 * - a rotação marcada é futura: a que venceu já foi processada no instante dela;
 * - o festival em curso é de um festival dado, e nenhum festival foi dado depois de agora.
 */
export const tavernWithinState: Shape = (value, path) => {
  const { settlement, guild, ids, lastProcessedAt } = value as TavernState;
  const at = path === '' ? 'guild' : `${path}.guild`;
  const { tavern, tavernOffers: offers } = guild;
  if (settlement.buildings.tavern === 0) {
    if (offers.length > 0) {
      return `${at}.tavernOffers: candidatos sem Taverna`;
    }
    if (tavern.nextRotationAtMs !== null) {
      return `${at}.tavern.nextRotationAtMs: rotação marcada sem Taverna`;
    }
    if (tavern.festival !== null || tavern.lastFestivalAtMs !== null) {
      return `${at}.tavern.festival: festival sem Taverna`;
    }
  }
  const issued = Object.hasOwn(ids, 'offer') ? (ids.offer as number) : 0;
  for (const [index, entry] of offers.entries()) {
    if (Number(entry.offerId.slice(6)) > issued) {
      return `${at}.tavernOffers.${index}.offerId: oferta além do contador de ids.offer`;
    }
  }
  if (tavern.nextRotationAtMs !== null && tavern.nextRotationAtMs <= lastProcessedAt) {
    return `${at}.tavern.nextRotationAtMs: rotação vencida e não processada`;
  }
  if (tavern.festival !== null && tavern.lastFestivalAtMs === null) {
    return `${at}.tavern.festival: festival em curso sem festival dado`;
  }
  if (tavern.lastFestivalAtMs !== null && tavern.lastFestivalAtMs > lastProcessedAt) {
    return `${at}.tavern.lastFestivalAtMs: festival dado depois de agora`;
  }
  return null;
};

/**
 * O `GameState` da versão 16: o da versão 15 com a Taverna (V3C-T2; ADR 0017, decisões 4, 5 e
 * 10).
 *
 * - `settlement.buildings` ganha a Taverna (`tavern`), e ela pode estar em obra e na lista das
 *   planejadas.
 * - Entra `guild.tavernOffers`: os candidatos desta rotação, cada um com o identificador da
 *   oferta (`offer-<n>`, do contador `ids.offer`), o modelo, o nome, a forma de tratamento e o
 *   preço cheio.
 * - Entra `guild.tavern`: o instante da próxima rotação, o festival em curso e o instante do
 *   último festival dado.
 * - `rng` aceita o fluxo fixo `tavern`, o dos candidatos. `ids` não muda de forma.
 *
 * Quem subir `schemaVersion` para 17 acrescenta aqui o passo `v16ToV17`, com esta forma como
 * entrada, e escreve a forma nova em `v17.ts`.
 */
export const settlementV16Fields: Readonly<Record<string, Shape>> = {
  ...settlementV12Fields,
  buildings: each(BUILDING_IDS_V16, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDING_IDS_V16),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDING_IDS_V16), targetLevel: natural, autoStart: boolean }),
  ),
};

export const stateV16Fields: Readonly<Record<string, Shape>> = {
  ...stateV15Fields,
  schemaVersion: literal(16),
  settlement: exactObject(settlementV16Fields),
  rng: rngShape(RNG_FIXED_STREAMS_V16, RNG_STREAM_FAMILIES_V13),
  guild: guildV16,
};

const stateV16Form: Shape = exactObject(stateV16Fields);
const stateV16Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV16: Shape = (value, path) =>
  stateV16Form(value, path) ??
  stateV16Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path);
