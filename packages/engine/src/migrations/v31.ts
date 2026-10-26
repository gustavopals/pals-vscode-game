import {
  boolean,
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  text,
  type Shape,
} from './shape';
import { rngShape, rngWithinIds } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { ironMarketWithinState } from './v25';
import { forgeWithinStateV27 } from './v27';
import { armyWithinState, UNIT_IDS_V28 } from './v28';
import { armyV29, formationsWithinState, LINE_IDS_V29, WING_IDS_V29 } from './v29';
import {
  BATTLE_FACTORS_V30,
  battleReportV30,
  battleReportsWithinState,
  HORDE_UNIT_IDS_V30,
  STORED_RNG_FAMILIES_V30,
  stateV30Fields,
} from './v30';
import { RNG_FIXED_STREAMS_V21 } from './v21';
import type { MigrationStep } from './step';

// Como nas outras versões, os identificadores e os números ficam escritos aqui; o teste confere
// que hoje coincidem com o conteúdo e o motor (`BATTLE_FACTOR_IDS`, `balance.battle.previewRuns`).
/** Quantas batalhas a prévia roda (`balance.battle.previewRuns`). */
export const PREVIEW_RUNS_V31 = 200;

// Como nas outras versões, os identificadores e os números ficam escritos aqui; o teste confere
// que hoje coincidem com o conteúdo (`balance.wall.hpByLevel`, `WING_IDS`).
/** A vida de cada ala por nível da Paliçada, a partir do nível 1 (`balance.wall.hpByLevel`). */
export const WALL_HP_BY_LEVEL_V32: readonly number[] = [60, 100, 200, 320, 500, 800];

/** A vida de cada ala no nível pedido; zero sem Paliçada. */
export function wallHpV32(level: number): number {
  if (level <= 0) {
    return 0;
  }
  return WALL_HP_BY_LEVEL_V32[Math.min(level, WALL_HP_BY_LEVEL_V32.length) - 1] ?? 0;
}

const wing = oneOf(WING_IDS_V29);
const line = oneOf(LINE_IDS_V29);

/**
 * A prévia do Conselho de Guerra (`ArmyPreview`, V4D-T2.2): só inteiros, textos e nulos.
 * `signature` é o `hashText` (32 bits sem sinal) da formação na hora da prévia.
 */
export const armyPreviewV31: Shape = exactObject({
  formationId: text,
  atMs: natural,
  signature: natural,
  runs: positive,
  wins: natural,
  glorious: natural,
  losses: natural,
  risk: nullable(
    exactObject({
      factor: oneOf(BATTLE_FACTORS_V30),
      wing: nullable(wing),
      amount: positive,
    }),
  ),
  expectedLosses: listOf(
    exactObject({ wing, line, unit: oneOf(UNIT_IDS_V28), start: positive, expected: natural }),
  ),
  enemy: listOf(
    exactObject({ wing, line, known: boolean, unit: oneOf(HORDE_UNIT_IDS_V30), count: positive }),
  ),
});

/**
 * O `GameState` da versão 31: o da versão 30 com `army.preview` (V4D-T2.2), a última prévia do
 * Conselho de Guerra, ou `null`. O contador `stats.battlesSimulated` mora em `stats`, que é um
 * registro livre de números: não muda de forma. `rng` e `ids` também não mudam.
 *
 * Para a versão 32, o passo `v31ToV32`, no fim deste arquivo.
 */
export const stateV31Fields: Readonly<Record<string, Shape>> = {
  ...stateV30Fields,
  schemaVersion: literal(31),
  army: (value, path) => {
    // O exército da versão 30 mais `preview`: a forma fechada da 30 recusaria a chave nova.
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      return armyV29(value, path);
    }
    const { reports, preview, ...rest } = value as Record<string, unknown>;
    const at = (key: string) => (path === '' ? key : `${path}.${key}`);
    if (reports === undefined) {
      return `${at('reports')}: campo ausente`;
    }
    if (preview === undefined) {
      return `${at('preview')}: campo ausente`;
    }
    return (
      armyV29(rest, path) ??
      listOf(battleReportV30)(reports, at('reports')) ??
      nullable(armyPreviewV31)(preview, at('preview'))
    );
  },
  rng: rngShape(RNG_FIXED_STREAMS_V21, STORED_RNG_FAMILIES_V30),
};

type PreviewWithin = {
  army: {
    formations: Array<{ id: string }>;
    preview: {
      formationId: string;
      runs: number;
      wins: number;
      glorious: number;
      losses: number;
    } | null;
  };
};

/**
 * A conferência da prévia com o resto do estado: a formação dela existe; as simulações
 * fecham (`wins + losses = runs`, `glorious ≤ wins`) e são as 200 do conteúdo.
 */
export const previewWithinState: Shape = (value, path) => {
  const { army } = value as PreviewWithin;
  const { preview } = army;
  if (preview === null) {
    return null;
  }
  const at = path === '' ? 'army.preview' : `${path}.army.preview`;
  if (!army.formations.some((formation) => formation.id === preview.formationId)) {
    return `${at}.formationId: formação que não está entre as salvas`;
  }
  if (preview.runs !== PREVIEW_RUNS_V31) {
    return `${at}.runs: a prévia roda ${String(PREVIEW_RUNS_V31)} simulações`;
  }
  if (preview.wins + preview.losses !== preview.runs || preview.glorious > preview.wins) {
    return `${at}: as vitórias, as derrotas e as gloriosas não fecham com as simulações`;
  }
  return null;
};

const stateV31Form: Shape = exactObject(stateV31Fields);
const stateV31Streams: Shape = rngWithinIds(STORED_RNG_FAMILIES_V30);

export const stateV31: Shape = (value, path) =>
  stateV31Form(value, path) ??
  stateV31Streams(value, path) ??
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
  armyWithinState(value, path) ??
  formationsWithinState(value, path) ??
  battleReportsWithinState(value, path) ??
  previewWithinState(value, path);

/**
 * 31 → 32: a muralha (V4E-T1.2; GDD §6.1 a §6.3; ADR 0020).
 *
 * - `settlement.wall.hp` nasce **cheio pelo nível de hoje da Paliçada** (60 ou 100 por ala; zero
 *   nas três sem Paliçada): nada danificou a Paliçada antes desta versão.
 * - `settlement.wallRepair` nasce `null`: não há reparo antes da ordem `repairWall`.
 * - `ids` e `rng` não mudam: o reparo não sorteia nem cria entidade.
 *
 * **O passo não cria prazo**, não emite evento e não toca o gerador. Uma obra da Paliçada em
 * curso na fronteira soma a vida do nível novo quando termina, como toda obra dela.
 */
export const v31ToV32: MigrationStep = {
  from: 31,
  summary: 'a muralha ganha a vida de cada ala, cheia pelo nível da Paliçada, e nenhum reparo',
  shape: stateV31,
  migrate(state) {
    const settlement = state.settlement as Record<string, unknown> & {
      buildings: { palisade: number };
    };
    const hp = wallHpV32(settlement.buildings.palisade);
    return {
      ...state,
      schemaVersion: 32,
      settlement: {
        ...settlement,
        wall: { hp: { left: hp, center: hp, right: hp } },
        wallRepair: null,
      },
    };
  },
};
