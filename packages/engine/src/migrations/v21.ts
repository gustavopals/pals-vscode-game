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
} from './shape';
import { settlementV12Fields } from './v12';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { RNG_FIXED_STREAMS_V16, tavernWithinState } from './v16';
import { BUILDING_IDS_V17, expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState, stateV20Fields } from './v20';

// Como nas outras versões, os identificadores ficam escritos aqui: a forma de uma versão não
// acompanha `@lotg/content` nem `random.ts`. O teste confere que hoje coincidem com o conteúdo
// (`BUILDING_IDS`, `MARKET_RESOURCE_IDS` e `RNG_STREAMS`).
export const BUILDING_IDS_V21: readonly string[] = [...BUILDING_IDS_V17, 'market'];
/** O que o Mercado negocia: as chaves de `market.prices`, `previousPrices` e `tradedToday`. */
export const MARKET_RESOURCE_IDS_V21: readonly string[] = ['food', 'wood', 'stone'];
/** Os fluxos fixos: os da versão 16 e o do Mercado. */
export const RNG_FIXED_STREAMS_V21: readonly string[] = [...RNG_FIXED_STREAMS_V16, 'market'];
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O Mercado da versão 21. Os preços são inteiros positivos, em milésimos de ouro por unidade; o
 * piso e o teto são do conteúdo, que pode mudar sem que a forma mude, e por isso a guarda não
 * os confere (um preço fora deles volta para dentro no passeio seguinte).
 */
const market: Shape = exactObject({
  prices: each(MARKET_RESOURCE_IDS_V21, positive),
  previousPrices: each(MARKET_RESOURCE_IDS_V21, positive),
  quoteDay: natural,
  tradedToday: each(MARKET_RESOURCE_IDS_V21, natural),
});

type MarketWithin = {
  settlement: { buildings: { market: number } };
  market: {
    prices: Record<string, number>;
    previousPrices: Record<string, number>;
    quoteDay: number;
    tradedToday: Record<string, number>;
  };
  rng: Record<string, unknown>;
};

/**
 * A conferência do Mercado com o resto do estado, que uma guarda de campo não alcança:
 *
 * - sem o edifício os preços nunca andaram: não há dia de cotação, nada foi negociado e o preço
 *   de ontem é o de hoje;
 * - o fluxo `market` só existe depois do primeiro passeio, e todo passeio o abre: ele está em
 *   `rng` se, e só se, há dia de cotação.
 */
export const marketWithinState: Shape = (value, path) => {
  const { settlement, market: stored, rng } = value as MarketWithin;
  const at = path === '' ? 'market' : `${path}.market`;
  if (settlement.buildings.market === 0) {
    if (stored.quoteDay !== 0) {
      return `${at}.quoteDay: cotação sem Mercado`;
    }
    for (const resource of MARKET_RESOURCE_IDS_V21) {
      if (stored.tradedToday[resource] !== 0) {
        return `${at}.tradedToday.${resource}: negociação sem Mercado`;
      }
      if (stored.previousPrices[resource] !== stored.prices[resource]) {
        return `${at}.previousPrices.${resource}: preço que andou sem Mercado`;
      }
    }
  }
  const drew = Object.hasOwn(rng, 'market');
  if (drew !== stored.quoteDay > 0) {
    const where = path === '' ? 'rng.market' : `${path}.rng.market`;
    return drew
      ? `${where}: fluxo do Mercado sem cotação feita`
      : `${at}.quoteDay: cotação feita sem o fluxo do Mercado`;
  }
  return null;
};

/**
 * O `GameState` da versão 21: o da versão 20 com o Mercado (V3E-T1; ADR 0018, decisão 16).
 *
 * - `settlement.buildings` ganha o Mercado (`market`), e ele pode estar em obra e na lista das
 *   planejadas.
 * - Entra `market`: o preço de hoje e o de ontem de cada recurso (milésimos de ouro por
 *   unidade), o dia de jogo da cotação e o que já foi negociado nele.
 * - `rng` aceita o fluxo fixo `market`, o do preço de cada dia. `ids` não muda de forma.
 *
 * Quem subir `schemaVersion` para 22 acrescenta aqui o passo `v21ToV22`, com esta forma como
 * entrada, e escreve a forma nova em `v22.ts`.
 */
export const settlementV21Fields: Readonly<Record<string, Shape>> = {
  ...settlementV12Fields,
  buildings: each(BUILDING_IDS_V21, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDING_IDS_V21),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDING_IDS_V21), targetLevel: natural, autoStart: boolean }),
  ),
};

export const stateV21Fields: Readonly<Record<string, Shape>> = {
  ...stateV20Fields,
  schemaVersion: literal(21),
  settlement: exactObject(settlementV21Fields),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
  market,
};

const stateV21Form: Shape = exactObject(stateV21Fields);
const stateV21Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV21: Shape = (value, path) =>
  stateV21Form(value, path) ??
  stateV21Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path);
