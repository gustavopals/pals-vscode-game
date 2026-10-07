import {
  boolean,
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  type Shape,
} from './shape';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import {
  guildV23Fields,
  MASTER_IDS_V23,
  masterEntityId,
  mastersWithinState,
  PRODUCTION_BUILDING_IDS_V23,
  settlementV23Fields,
  stateV23Fields,
  waitingMasterV23,
} from './v23';

/** Um Mestre do feudo na versão 24: o da 23 e se já trabalhou em algum edifício. */
const master: Shape = exactObject({
  id: masterEntityId,
  masterId: oneOf(MASTER_IDS_V23),
  building: nullable(oneOf(PRODUCTION_BUILDING_IDS_V23)),
  adaptingUntilMs: nullable(natural),
  worked: boolean,
});

// Como nas outras versões, os números ficam escritos aqui: a forma de uma versão não acompanha
// `@lotg/content`. O teste confere que hoje coincidem com o conteúdo (`balance.market` e
// `balance.calendar.dayMs`). **Quem mudar um destes números no conteúdo sobe a versão do estado**
// e escreve os novos na forma nova: o estado gravado com os antigos continua valendo na 24.
/** Unidades de cada recurso que o Mercado negocia por dia de jogo, por nível (`dailyVolumePerLevel`). */
export const DAILY_VOLUME_PER_LEVEL_V24 = 200;
/** Um dia de jogo, em ms de jogo (`calendar.dayMs`): é com ele que se conta o dia da cotação. */
export const DAY_MS_V24 = 2 * 60 * 60_000;
/** O máximo de unidades de uma caravana (`market.caravan.maxUnits`). */
export const CARAVAN_MAX_UNITS_V24 = 300;
/** Quanto dura a viagem de uma caravana, em ms de jogo (`market.caravan.tripMs`). */
export const CARAVAN_TRIP_MS_V24 = 4 * 60 * 60_000;
/** Caravanas na estrada por nível do Mercado, a partir do 1 (`market.caravan.slotsByLevel`). */
export const CARAVAN_SLOTS_BY_LEVEL_V24: readonly number[] = [0, 1, 1, 2, 2];

type MarketLimitsState = {
  settlement: { buildings: { market: number } };
  market: {
    quoteDay: number;
    tradedToday: Record<string, number>;
    caravans: Array<{ amount: number; arrivesAtMs: number }>;
  };
  lastProcessedAt: number;
};

/**
 * Os limites do Mercado e das caravanas que as guardas das versões 21 a 23 deixavam passar
 * (revisão da Fase E, R5). Só o que se confere com o próprio estado e com os números acima:
 *
 * - o que foi negociado hoje, de cada recurso, cabe no volume do dia do nível de agora (o nível
 *   só sobe, e a ordem que passaria do volume é recusada);
 * - o dia da cotação não é futuro: no máximo o dia de jogo de `lastProcessedAt`;
 * - há caravana na estrada só com o Mercado no nível que as mantém, e nunca mais do que os
 *   lugares desse nível;
 * - nenhuma caravana leva mais do que o máximo, e nenhuma chega depois de uma viagem inteira
 *   contada de agora.
 *
 * O que fica de fora, porque depende do que o estado não guarda: o preço fixado de cada
 * caravana (viria do preço e da estação do instante do envio) e o piso e o teto do preço do
 * passeio (um preço fora deles volta para dentro no passeio seguinte).
 */
export const marketLimitsWithinState: Shape = (value, path) => {
  const { settlement, market, lastProcessedAt } = value as MarketLimitsState;
  const at = path === '' ? 'market' : `${path}.market`;
  const level = settlement.buildings.market;
  const volume = DAILY_VOLUME_PER_LEVEL_V24 * level;
  for (const [resource, traded] of Object.entries(market.tradedToday)) {
    if (traded > volume) {
      return `${at}.tradedToday.${resource}: negociado além do volume do dia (${volume})`;
    }
  }
  if (market.quoteDay > Math.floor(lastProcessedAt / DAY_MS_V24) + 1) {
    return `${at}.quoteDay: cotação de um dia que ainda não chegou`;
  }
  const slots =
    level < 1
      ? 0
      : (CARAVAN_SLOTS_BY_LEVEL_V24[Math.min(level, CARAVAN_SLOTS_BY_LEVEL_V24.length) - 1] ?? 0);
  if (market.caravans.length > slots) {
    return `${at}.caravans: ${market.caravans.length} na estrada, e o Mercado Nv${level} mantém ${slots}`;
  }
  for (const [index, entry] of market.caravans.entries()) {
    const here = `${at}.caravans.${index}`;
    if (entry.amount > CARAVAN_MAX_UNITS_V24) {
      return `${here}.amount: carga além do máximo de uma caravana (${CARAVAN_MAX_UNITS_V24})`;
    }
    if (entry.arrivesAtMs > lastProcessedAt + CARAVAN_TRIP_MS_V24) {
      return `${here}.arrivesAtMs: chegada além de uma viagem inteira`;
    }
  }
  return null;
};

type WorkedState = {
  settlement: { masters: Array<{ building: string | null; worked: boolean }> };
};

/**
 * A conferência de `worked` com o resto do Mestre: **quem tem edifício já trabalhou** (e, com
 * isso, quem está em adaptação também: `mastersWithinState` já exige edifício de quem se
 * adapta). O contrário é possível: o Mestre que já trabalhou e ficou livre.
 */
export const workedWithinState: Shape = (value, path) => {
  const { settlement } = value as WorkedState;
  const at = path === '' ? 'settlement' : `${path}.settlement`;
  for (const [index, entry] of settlement.masters.entries()) {
    if (entry.building !== null && !entry.worked) {
      return `${at}.masters.${index}.worked: Mestre com edifício que nunca trabalhou`;
    }
  }
  return null;
};

/**
 * O `GameState` da versão 24: o da versão 23 com `worked` em cada Mestre do feudo (revisão da
 * Fase E; resposta do autor de 2026-10-07: a primeira alocação do Mestre é imediata, e só quem
 * já teve um edifício paga a adaptação ao chegar a outro). Quem espera à porta não tem o campo:
 * entra no feudo com `worked: false`. `rng` e `ids` não mudam de forma. A guarda desta versão
 * confere também os limites do Mercado e das caravanas (`marketLimitsWithinState`; R5).
 *
 * Quem subir `schemaVersion` para 25 acrescenta aqui o passo `v24ToV25`, com esta forma como
 * entrada, e escreve a forma nova em `v25.ts`.
 */
export const settlementV24Fields: Readonly<Record<string, Shape>> = {
  ...settlementV23Fields,
  masters: listOf(master),
  mastersWaiting: listOf(waitingMasterV23),
};

export const guildV24Fields: Readonly<Record<string, Shape>> = guildV23Fields;

export const stateV24Fields: Readonly<Record<string, Shape>> = {
  ...stateV23Fields,
  schemaVersion: literal(24),
  settlement: exactObject(settlementV24Fields),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

const stateV24Form: Shape = exactObject(stateV24Fields);
const stateV24Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV24: Shape = (value, path) =>
  stateV24Form(value, path) ??
  stateV24Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  caravansWithinState(value, path) ??
  mastersWithinState(value, path) ??
  workedWithinState(value, path) ??
  marketLimitsWithinState(value, path);
