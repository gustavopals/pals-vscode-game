import type { MigrationStep } from './step';
import { exactObject, literal, natural, nullable, positive, type Shape } from './shape';
import { rngWithinIds } from './v13';
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
import { armyWithinState, settlementV28Fields } from './v28';
import { formationsWithinState } from './v29';
import { battleReportsWithinState, STORED_RNG_FAMILIES_V30 } from './v30';
import { previewWithinState, stateV31Fields, wallHpV32 } from './v31';

// A vida de cada ala por nível (`WALL_HP_BY_LEVEL_V32`) está escrita em `v31.ts`, ao lado do passo
// que a usa, para os dois arquivos não se importarem um ao outro.

const hpByWing = exactObject({ left: natural, center: natural, right: natural });

/**
 * O `GameState` da versão 32: o da versão 31 com a muralha (V4E-T1.2): `settlement.wall.hp`, a
 * vida de cada ala, e `settlement.wallRepair`, o reparo em curso ou `null`. `rng` e `ids` não
 * mudam: o reparo não sorteia nem cria entidade.
 *
 * Para a versão 33, o passo `v32ToV33`, no fim deste arquivo.
 */
export const settlementV32Fields: Readonly<Record<string, Shape>> = {
  ...settlementV28Fields,
  wall: exactObject({ hp: hpByWing }),
  wallRepair: nullable(exactObject({ untilMs: positive, toHp: hpByWing })),
};

export const stateV32Fields: Readonly<Record<string, Shape>> = {
  ...stateV31Fields,
  schemaVersion: literal(32),
  settlement: exactObject(settlementV32Fields),
};

type WallWithin = {
  lastProcessedAt: number;
  settlement: {
    buildings: { palisade: number };
    wall: { hp: Record<string, number> };
    wallRepair: { untilMs: number; toHp: Record<string, number> } | null;
  };
};

/**
 * A conferência da muralha com o resto do estado: nenhuma ala acima da vida do nível da
 * Paliçada (sem Paliçada, zero); o reparo em curso termina depois do último instante processado
 * (o que terminou já foi aplicado), só leva cada ala para cima e nunca acima do nível.
 */
export const wallWithinState: Shape = (value, path) => {
  const { lastProcessedAt, settlement } = value as WallWithin;
  const at = (key: string) => (path === '' ? `settlement.${key}` : `${path}.settlement.${key}`);
  const full = wallHpV32(settlement.buildings.palisade);
  for (const [wing, hp] of Object.entries(settlement.wall.hp)) {
    if (hp > full) {
      return `${at('wall.hp')}.${wing}: acima da vida da Paliçada no nível dela`;
    }
  }
  const repair = settlement.wallRepair;
  if (repair === null) {
    return null;
  }
  if (repair.untilMs <= lastProcessedAt) {
    return `${at('wallRepair')}.untilMs: reparo que já devia ter terminado`;
  }
  for (const [wing, hp] of Object.entries(repair.toHp)) {
    if (hp > full || hp < (settlement.wall.hp[wing] ?? 0)) {
      return `${at('wallRepair')}.toHp.${wing}: fora do intervalo entre a vida de agora e a do nível`;
    }
  }
  return null;
};

const stateV32Form: Shape = exactObject(stateV32Fields);
const stateV32Streams: Shape = rngWithinIds(STORED_RNG_FAMILIES_V30);

export const stateV32: Shape = (value, path) =>
  stateV32Form(value, path) ??
  stateV32Streams(value, path) ??
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

/**
 * 32 → 33: a composição das incursões e a formação no relatório (V4E-T2.2; GDD §8.2; ADR 0019,
 * decisão 14; ADR 0020).
 *
 * - Cada incursão marcada ganha `composition: null`: **o passo não sorteia**, e a batalha dela
 *   usa a composição-base da estação em que chega (`baseRaidComposition`), sem gastar o fluxo.
 * - Cada relatório de batalha ganha `formationId: null` (não há relatório antes desta versão:
 *   nenhuma incursão lutava).
 * - `ids` e `rng` não mudam. O passo não cria prazo nem emite evento.
 */
export const v32ToV33: MigrationStep = {
  from: 32,
  summary: 'as incursões marcadas ficam sem composição sorteada e os relatórios, sem formação',
  shape: stateV32,
  migrate(state) {
    const horde = state.horde as { scheduledRaids: Array<Record<string, unknown>> };
    const army = state.army as Record<string, unknown> & {
      reports: Array<Record<string, unknown>>;
    };
    return {
      ...state,
      schemaVersion: 33,
      horde: {
        ...horde,
        scheduledRaids: horde.scheduledRaids.map((raid) => ({ ...raid, composition: null })),
      },
      army: {
        ...army,
        reports: army.reports.map((report) => ({ ...report, formationId: null })),
      },
    };
  },
};
