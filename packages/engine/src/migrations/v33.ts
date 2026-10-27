import {
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
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { ironMarketWithinState } from './v25';
import { forgeWithinStateV27 } from './v27';
import { armyWithinState } from './v28';
import { armyV29, formationsWithinState, LINE_IDS_V29, WING_IDS_V29 } from './v29';
import {
  battleReportsWithinState,
  battleReportV30Fields,
  HORDE_UNIT_IDS_V30,
  STORED_RNG_FAMILIES_V30,
} from './v30';
import { armyPreviewV31, previewWithinState } from './v31';
import { stateV32Fields, wallWithinState } from './v32';
import type { MigrationStep, StoredState } from './step';

// Como nas outras versões, os identificadores ficam escritos aqui; o teste confere que hoje
// coincidem com o conteúdo (`ENEMY_IDS`, `WAR_RAID_SIZE_IDS`).
/** Os inimigos (`ENEMY_IDS`). */
export const ENEMIES_V33: readonly string[] = ['wolves'];
/** Os tamanhos de incursão (`WAR_RAID_SIZE_IDS`): a forte entra nesta versão. */
export const RAID_SIZES_V33: readonly string[] = ['light', 'medium', 'strong'];

/** Um posto do exército de uma incursão marcada. */
export const raidPostV33: Shape = exactObject({
  wing: oneOf(WING_IDS_V29),
  line: oneOf(LINE_IDS_V29),
  unit: oneOf(HORDE_UNIT_IDS_V30),
  count: positive,
});

/** O relatório de batalha da versão 33: o da 30 com a formação que lutou (`null` sem nenhuma). */
export const battleReportV33: Shape = exactObject({
  ...battleReportV30Fields,
  formationId: nullable(text),
});

/**
 * O `GameState` da versão 33: o da 32 com a composição de cada incursão marcada (V4E-T2.2):
 * `horde.scheduledRaids[].composition`, a lista dos postos ou `null` (a marcada antes desta
 * versão, e as do roteiro, lutam com a composição-base da estação, sem sorteio), e o tamanho
 * forte; e cada relatório de batalha com `formationId`, a formação que lutou (`null` sem
 * Defesa ativa). `rng` e `ids` não mudam de forma: a composição sai do fluxo fixo `horde`, e o
 * fluxo `battle:<id>` nunca fica gravado.
 *
 * Quem subir `schemaVersion` para 34 acrescenta aqui o passo `v33ToV34`.
 */
export const stateV33Fields: Readonly<Record<string, Shape>> = {
  ...stateV32Fields,
  schemaVersion: literal(33),
  horde: exactObject({
    scheduledRaids: listOf(
      exactObject({
        id: text,
        atMs: natural,
        kind: oneOf(['scripted', 'threat']),
        enemy: oneOf(ENEMIES_V33),
        size: oneOf(RAID_SIZES_V33),
        composition: nullable(listOf(raidPostV33)),
        announcedAtMs: nullable(natural),
      }),
    ),
  }),
  army: (value, path) => {
    // O exército da versão 32 com o relatório novo: a forma fechada recusaria a chave nova.
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
      listOf(battleReportV33)(reports, at('reports')) ??
      nullable(armyPreviewV31)(preview, at('preview'))
    );
  },
  rng: rngShape(RNG_FIXED_STREAMS_V21, STORED_RNG_FAMILIES_V30),
};

const stateV33Form: Shape = exactObject(stateV33Fields);
const stateV33Streams: Shape = rngWithinIds(STORED_RNG_FAMILIES_V30);

export const stateV33: Shape = (value, path) =>
  stateV33Form(value, path) ??
  stateV33Streams(value, path) ??
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
  previewWithinState(value, path) ??
  wallWithinState(value, path);

/** 33 → 34: a Horda começa sem memória, ondas ou presságios; tiles nascem na próxima virada. */
export const v33ToV34: MigrationStep = {
  from: 33,
  summary: 'Memória da Horda, preparação das ondas e presságios',
  shape: stateV33,
  migrate(state) {
    return {
      ...state,
      schemaVersion: 34,
      horde: {
        ...(state.horde as StoredState),
        lastFormationSeen: null,
        wavePlan: null,
        omens: [],
      },
    };
  },
};
