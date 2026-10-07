import {
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  type Shape,
} from './shape';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState, heroRoster } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState, heroIdRef } from './v17';
import { HERO_STATUS_IDS_V18, heroShapeOf, outcomesWithinState } from './v18';
import { freedWithinState, guildV20Fields } from './v20';
import {
  MARKET_RESOURCE_IDS_V21,
  marketV21Fields,
  marketWithinState,
  RNG_FIXED_STREAMS_V21,
  stateV21Fields,
} from './v21';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`HERO_STATUS_IDS` e o maior valor de `balance.market.caravan.slotsByLevel`).
export const HERO_STATUS_IDS_V22: readonly string[] = [...HERO_STATUS_IDS_V18, 'escort'];
/** Quantas caravanas o Mercado mantém na estrada, no máximo (`market.caravan.slotsByLevel`). */
export const CARAVAN_SLOTS_CAP_V22 = 2;

const CARAVAN_ID = /^caravan-([1-9][0-9]*)$/;
const CARAVAN_STREAM = /^caravan:(caravan-[1-9][0-9]*)$/;

const where = (path: string) => (path === '' ? 'estado' : path);

const caravanId: Shape = (value, path) =>
  typeof value === 'string' &&
  CARAVAN_ID.test(value) &&
  Number.isSafeInteger(Number(value.slice(8)))
    ? null
    : `${where(path)}: esperado um identificador de caravana (caravan-<n>)`;

type CaravanV22 = {
  id: string;
  arrivesAtMs: number;
  escortHeroId: string | null;
};

/**
 * Uma caravana na estrada: o que leva, o preço fixado e a chegada. O teto da carga é do
 * conteúdo, que pode mudar sem que a forma mude, e por isso a guarda só exige uma carga e um
 * preço positivos. **Não há campo de desfecho**: ele é sorteado na chegada.
 */
const caravan: Shape = exactObject({
  id: caravanId,
  resource: oneOf(MARKET_RESOURCE_IDS_V21),
  amount: positive,
  unitPrice: positive,
  arrivesAtMs: natural,
  escortHeroId: nullable(heroIdRef),
});

/** As caravanas na estrada: cada uma na forma, nunca mais do que o teto, em ordem de identificador. */
const caravans: Shape = (value, path) => {
  const found = listOf(caravan)(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as CaravanV22[];
  if (list.length > CARAVAN_SLOTS_CAP_V22) {
    return `${where(path)}: esperada lista de até ${CARAVAN_SLOTS_CAP_V22} caravanas, veio de ${list.length}`;
  }
  const numbers = list.map((entry) => Number(entry.id.slice(8)));
  const index = numbers.findIndex((number, at) => at > 0 && number <= (numbers[at - 1] ?? 0));
  return index === -1
    ? null
    : `${where(path)}.${index}.id: caravanas fora da ordem de identificador`;
};

/** Um herói da versão 22: o da 20, que pode estar em escolta. */
const hero: Shape = heroShapeOf({ freedAtMs: nullable(natural) }, HERO_STATUS_IDS_V22);

type CaravansState = {
  settlement: { buildings: { market: number } };
  guild: { heroes: Array<{ id: string; status: string }> };
  market: { caravans: CaravanV22[] };
  rng: Record<string, unknown>;
  ids: Record<string, number>;
  lastProcessedAt: number;
};

/**
 * A conferência das caravanas com o resto do estado, que uma guarda de campo não alcança:
 *
 * - sem o Mercado não há caravana na estrada;
 * - toda caravana tem um identificador que `nextId` já deu (`1 ≤ n ≤ ids.caravan`);
 * - a chegada é futura: a que venceu já foi processada no instante dela;
 * - quem escolta serve ao feudo com o estado `escort` e escolta uma caravana só, e quem está em
 *   escolta escolta alguma;
 * - **todo fluxo de sorteio da família `caravan` em `rng` é de uma caravana na estrada** (R2):
 *   o fluxo nasce e é apagado na chegada, e um que sobrasse (ou renascesse) repetiria a sorte.
 *   No jogo nenhum chega a ser gravado: a guarda só deixa passar o de uma caravana viva.
 */
export const caravansWithinState: Shape = (value, path) => {
  const { settlement, guild, market, rng, ids, lastProcessedAt } = value as CaravansState;
  const at = path === '' ? 'market' : `${path}.market`;
  const guildAt = path === '' ? 'guild' : `${path}.guild`;
  const issued = Object.hasOwn(ids, 'caravan') ? (ids.caravan as number) : 0;
  if (settlement.buildings.market === 0 && market.caravans.length > 0) {
    return `${at}.caravans: caravana sem Mercado`;
  }
  const escorts = new Set<string>();
  for (const [index, entry] of market.caravans.entries()) {
    const here = `${at}.caravans.${index}`;
    if (Number(entry.id.slice(8)) > issued) {
      return `${here}.id: caravana além do contador de ids.caravan`;
    }
    if (entry.arrivesAtMs <= lastProcessedAt) {
      return `${here}.arrivesAtMs: chegada vencida e não processada`;
    }
    if (entry.escortHeroId === null) {
      continue;
    }
    if (escorts.has(entry.escortHeroId)) {
      return `${here}.escortHeroId: herói em duas escoltas`;
    }
    escorts.add(entry.escortHeroId);
    const escort = guild.heroes.find((candidate) => candidate.id === entry.escortHeroId);
    if (escort === undefined || escort.status !== 'escort') {
      return `${here}.escortHeroId: herói que não serve ao feudo em escolta`;
    }
  }
  for (const [index, entry] of guild.heroes.entries()) {
    if (entry.status === 'escort' && !escorts.has(entry.id)) {
      return `${guildAt}.heroes.${index}.status: herói em escolta sem caravana`;
    }
  }
  const live = new Set(market.caravans.map((entry) => entry.id));
  for (const key of Object.keys(rng)) {
    const id = CARAVAN_STREAM.exec(key)?.[1];
    if (id !== undefined && !live.has(id)) {
      const here = path === '' ? `rng.${key}` : `${path}.rng.${key}`;
      return `${here}: fluxo de uma caravana que não está na estrada`;
    }
  }
  return null;
};

/**
 * O `GameState` da versão 22: o da versão 21 com as caravanas (V3E-T2; ADR 0018, decisão 17).
 *
 * - `market` ganha `caravans`: as que estão na estrada, com a carga, o preço fixado no envio, a
 *   chegada e a escolta. Em ordem de identificador, nunca mais do que os lugares do Mercado.
 * - O herói pode estar em escolta (`escort`).
 * - `rng` e `ids` não mudam de forma: a família `caravan` já era aceita desde a versão 13, e a
 *   conferência cruzada passa a exigir que o fluxo seja de uma caravana na estrada.
 *
 * Quem subir `schemaVersion` para 23 acrescenta aqui o passo `v22ToV23`, com esta forma como
 * entrada, e escreve a forma nova em `v23.ts`.
 */
export const marketV22Fields: Readonly<Record<string, Shape>> = { ...marketV21Fields, caravans };

export const guildV22Fields: Readonly<Record<string, Shape>> = {
  ...guildV20Fields,
  heroes: heroRoster(hero),
};

export const stateV22Fields: Readonly<Record<string, Shape>> = {
  ...stateV21Fields,
  schemaVersion: literal(22),
  guild: guildOf(exactObject(guildV22Fields)),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
  market: exactObject(marketV22Fields),
};

const stateV22Form: Shape = exactObject(stateV22Fields);
const stateV22Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV22: Shape = (value, path) =>
  stateV22Form(value, path) ??
  stateV22Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  caravansWithinState(value, path);
