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
import type { MigrationStep } from './step';
import { durabilityOfV27 } from './v27items';
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

type Piece = { id: string; defId: string };

/** O item com a condição cheia da raridade dele (a do Comum, para a chave que o conteúdo já não tem). */
const whole = (piece: Piece): Piece & { condition: number } => ({
  ...piece,
  condition: durabilityOfV27(piece.defId),
});

/**
 * 26 → 27: o desgaste e o reparo do equipamento (V4B-T3; ADR 0019, decisão 5).
 *
 * - Todo item que já existe (no arsenal, com um herói, no saque de uma expedição em curso ou de um
 *   relatório) entra com a **condição cheia** da raridade dele: ninguém perde nada por ter jogado
 *   antes do desgaste, e nenhum reparo é devido.
 * - O lote que estava na forja ganha o tipo `weapons`; a forja vazia continua vazia.
 *
 * **O passo não cria prazo** (e por isso não usa a fronteira), não emite evento, não dá
 * identificador a ninguém e não toca o gerador.
 */
export const v26ToV27: MigrationStep = {
  from: 26,
  summary: 'todo item entra com a condição cheia e o lote da forja ganha o tipo',
  shape: stateV26,
  migrate(state) {
    const settlement = state.settlement as Record<string, unknown>;
    const guild = state.guild as Record<string, unknown>;
    const forge = settlement.forge as Record<string, unknown> | null;
    const heroes = (guild.heroes as Array<Record<string, unknown>>).map((hero) => ({
      ...hero,
      equipment: Object.fromEntries(
        Object.entries(hero.equipment as Record<string, Piece | null>).map(([slot, piece]) => [
          slot,
          piece === null ? null : whole(piece),
        ]),
      ),
    }));
    const withLoot = (entries: unknown): unknown =>
      (entries as Array<{ loot: { items: Piece[] } }>).map((entry) => ({
        ...entry,
        loot: { ...entry.loot, items: entry.loot.items.map(whole) },
      }));
    return {
      ...state,
      schemaVersion: 27,
      settlement: { ...settlement, forge: forge === null ? null : { kind: 'weapons', ...forge } },
      guild: {
        ...guild,
        heroes,
        inventory: (guild.inventory as Piece[]).map(whole),
        expeditions: withLoot(guild.expeditions),
        reports: withLoot(guild.reports),
      },
    };
  },
};
