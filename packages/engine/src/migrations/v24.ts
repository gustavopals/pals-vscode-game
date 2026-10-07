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
 * entra no feudo com `worked: false`. `rng` e `ids` não mudam de forma.
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
  workedWithinState(value, path);
