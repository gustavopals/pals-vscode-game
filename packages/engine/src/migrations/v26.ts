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
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { BUILDING_IDS_V21, marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { guildV25Fields, ironMarketWithinState, settlementV25Fields, stateV25Fields } from './v25';

// Como nas outras versões, os identificadores e os números ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`BUILDING_IDS` e `balance.smithy.batchMax`).
/** Os edifícios da versão 26: os da 21 e o Ferreiro (V4B-T2; ADR 0019, decisão 4). */
export const BUILDING_IDS_V26: readonly string[] = [...BUILDING_IDS_V21, 'smithy'];
/** O maior lote de uma ordem de forja (`balance.smithy.batchMax`). */
export const FORGE_BATCH_MAX_V26 = 10;
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 26: o da versão 25 com o Ferreiro (V4B-T2; ADR 0019, decisão 4).
 *
 * - `settlement.buildings` ganha `smithy`, e as obras e as planejadas aceitam o Ferreiro.
 * - `settlement.weapons` é a contagem das armas forjadas (um natural; sem teto nem depósito).
 * - `settlement.forge` é o lote em curso, ou `null`: um por vez.
 * - `rng` e `ids` não mudam de forma: a forja não sorteia nem cria entidade.
 *
 * Quem subir `schemaVersion` para 27 acrescenta aqui o passo `v26ToV27`, com esta forma como
 * entrada, e escreve a forma nova em `v27.ts`.
 */
export const settlementV26Fields: Readonly<Record<string, Shape>> = {
  ...settlementV25Fields,
  buildings: each(BUILDING_IDS_V26, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDING_IDS_V26),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDING_IDS_V26), targetLevel: natural, autoStart: boolean }),
  ),
  weapons: natural,
  forge: nullable(exactObject({ amount: positive, startedAtMs: natural, endsAtMs: natural })),
};

export const stateV26Fields: Readonly<Record<string, Shape>> = {
  ...stateV25Fields,
  schemaVersion: literal(26),
  settlement: exactObject(settlementV26Fields),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

export const guildV26Fields: Readonly<Record<string, Shape>> = guildV25Fields;

type ForgeWithin = {
  settlement: {
    buildings: { smithy: number };
    forge: { amount: number; startedAtMs: number; endsAtMs: number } | null;
  };
};

/**
 * A conferência da forja com o resto do estado, que uma guarda de campo não alcança: o lote só
 * existe com o Ferreiro erguido, cabe no lote máximo e termina depois de começar.
 */
export const forgeWithinState: Shape = (value, path) => {
  const { settlement } = value as ForgeWithin;
  const at = path === '' ? 'settlement.forge' : `${path}.settlement.forge`;
  const forge = settlement.forge;
  if (forge === null) {
    return null;
  }
  if (settlement.buildings.smithy === 0) {
    return `${at}: lote na forja sem Ferreiro`;
  }
  if (forge.amount > FORGE_BATCH_MAX_V26) {
    return `${at}.amount: lote acima do máximo`;
  }
  if (forge.endsAtMs < forge.startedAtMs) {
    return `${at}.endsAtMs: lote que termina antes de começar`;
  }
  return null;
};

const stateV26Form: Shape = exactObject(stateV26Fields);
const stateV26Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV26: Shape = (value, path) =>
  stateV26Form(value, path) ??
  stateV26Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  ironMarketWithinState(value, path) ??
  caravansWithinState(value, path) ??
  mastersWithinState(value, path) ??
  workedWithinState(value, path) ??
  marketLimitsWithinState(value, path) ??
  forgeWithinState(value, path);
