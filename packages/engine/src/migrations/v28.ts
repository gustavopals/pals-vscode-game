import {
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  boolean,
  type Shape,
} from './shape';
import type { MigrationStep } from './step';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { ironMarketWithinState } from './v25';
import { BUILDING_IDS_V26 } from './v26';
import { forgeWithinStateV27, guildV27Fields, settlementV27Fields, stateV27Fields } from './v27';

// Como nas outras versões, os identificadores e os números ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`BUILDING_IDS`, `UNIT_IDS`, `balance.army`).
/** Os edifícios da versão 28: os da 26 e o Quartel (V4C-T1; ADR 0019, decisão 7). */
export const BUILDING_IDS_V28: readonly string[] = [...BUILDING_IDS_V26, 'barracks'];
/** As unidades da versão 28, na ordem do conteúdo (`UNIT_IDS`). */
export const UNIT_IDS_V28: readonly string[] = [
  'spearman',
  'swordsman',
  'archer',
  'knight',
  'shieldbearer',
];
/** O limite de soldados por nível do Quartel (`balance.army.capPerLevel`). */
export const ARMY_CAP_PER_LEVEL_V28 = 10;
/** O maior lote de uma ordem de treino (`balance.army.batchMax`). */
export const TRAINING_BATCH_MAX_V28 = 10;
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 28: o da versão 27 com o Quartel e o exército (V4C-T1; ADR 0019,
 * decisão 7).
 *
 * - `settlement.buildings` ganha `barracks`, e as obras e as planejadas aceitam o Quartel.
 * - `army.units` é a contagem de soldados por unidade (naturais; a soma cabe no limite do
 *   Quartel); `army.training` é o lote em curso, ou `null`: um por vez.
 * - `rng` e `ids` não mudam de forma: o treino não sorteia nem cria entidade, e o soldado não
 *   tem identificador (é uma contagem).
 *
 * Quem subir `schemaVersion` para 29 acrescenta em `v28.ts` o passo `v28ToV29`, com esta forma
 * como entrada, e escreve a forma nova em `v29.ts`.
 */
export const settlementV28Fields: Readonly<Record<string, Shape>> = {
  ...settlementV27Fields,
  buildings: each(BUILDING_IDS_V28, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDING_IDS_V28),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDING_IDS_V28), targetLevel: natural, autoStart: boolean }),
  ),
};

export const guildV28Fields: Readonly<Record<string, Shape>> = guildV27Fields;

export const armyV28: Shape = exactObject({
  units: each(UNIT_IDS_V28, natural),
  training: nullable(
    exactObject({
      unit: oneOf(UNIT_IDS_V28),
      amount: positive,
      startedAtMs: natural,
      endsAtMs: natural,
    }),
  ),
});

export const stateV28Fields: Readonly<Record<string, Shape>> = {
  ...stateV27Fields,
  schemaVersion: literal(28),
  settlement: exactObject(settlementV28Fields),
  army: armyV28,
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

type ArmyWithin = {
  settlement: { buildings: { barracks: number } };
  army: {
    units: Record<string, number>;
    training: { unit: string; amount: number; startedAtMs: number; endsAtMs: number } | null;
  };
};

/**
 * A conferência do exército com o resto do estado, que uma guarda de campo não alcança: sem o
 * Quartel não há soldado nem lote; a soma dos soldados cabe no limite do nível; o lote cabe no
 * lote máximo, termina depois de começar e, somado aos soldados, não passa do limite.
 */
export const armyWithinState: Shape = (value, path) => {
  const { settlement, army } = value as ArmyWithin;
  const at = path === '' ? 'army' : `${path}.army`;
  const cap = ARMY_CAP_PER_LEVEL_V28 * settlement.buildings.barracks;
  const soldiers = Object.values(army.units).reduce((sum, count) => sum + count, 0);
  if (settlement.buildings.barracks === 0 && (soldiers > 0 || army.training !== null)) {
    return `${at}: soldados ou treino sem Quartel`;
  }
  if (soldiers > cap) {
    return `${at}.units: soldados acima do limite do Quartel`;
  }
  const batch = army.training;
  if (batch === null) {
    return null;
  }
  if (batch.amount > TRAINING_BATCH_MAX_V28) {
    return `${at}.training.amount: lote acima do máximo`;
  }
  if (batch.endsAtMs < batch.startedAtMs) {
    return `${at}.training.endsAtMs: lote que termina antes de começar`;
  }
  if (soldiers + batch.amount > cap) {
    return `${at}.training.amount: soldados e lote acima do limite do Quartel`;
  }
  return null;
};

const stateV28Form: Shape = exactObject(stateV28Fields);
const stateV28Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV28: Shape = (value, path) =>
  stateV28Form(value, path) ??
  stateV28Streams(value, path) ??
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
  forgeWithinStateV27(value, path) ??
  armyWithinState(value, path);

/**
 * 28 → 29: as formações salvas e a Defesa ativa (V4C-T2; ADR 0019, decisões 8 e 9).
 *
 * - `army.formations` nasce vazia e `army.activeFormationId`, `null`: ninguém muda de estado.
 * - `ids` não muda: o contador `formation` só nasce na primeira formação salva.
 *
 * **O passo não cria prazo**, não emite evento, não dá identificador a ninguém e não toca o
 * gerador.
 */
export const v28ToV29: MigrationStep = {
  from: 28,
  summary: 'o exército ganha a lista de formações salvas, vazia, e nenhuma Defesa ativa',
  shape: stateV28,
  migrate(state) {
    const army = state.army as Record<string, unknown>;
    return {
      ...state,
      schemaVersion: 29,
      army: { ...army, formations: [], activeFormationId: null },
    };
  },
};
