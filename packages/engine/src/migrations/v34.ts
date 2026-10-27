import {
  boolean,
  exactObject,
  keyedRecordOf,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  recordOf,
  text,
  type Shape,
} from './shape';
import { stateV33, stateV33Fields, raidPostV33 } from './v33';
import { UNIT_IDS_V28 } from './v28';
import type { StoredState } from './step';

export const TILE_TYPES_V34 = ['wolfDen', 'raiderCamp', 'hordeFortress'];
export const ENEMIES_V34 = ['wolves', 'raiders', 'horde'];
const waveNumber: Shape = (value, path) =>
  [1, 2, 3].includes(value as number) ? null : `${path}: onda fora de 1 a 3`;
const memory = nullable(
  exactObject({
    total: positive,
    byUnit: keyedRecordOf((key) => UNIT_IDS_V28.includes(key), 'unidade da formação', positive),
  }),
);
const wave = exactObject({ number: waveNumber, composition: listOf(raidPostV33) });
const plan = nullable(
  exactObject({
    year: positive,
    revision: positive,
    generatedAtMs: natural,
    waves: listOfLength(3, wave),
  }),
);
const omen = exactObject({
  atMs: natural,
  revision: positive,
  wave: waveNumber,
  clarity: oneOf(['vague', 'partial', 'exact']),
  text,
  reveals: listOf(raidPostV33),
});
const horde = exactObject({
  scheduledRaids: listOf(
    exactObject({
      id: text,
      atMs: natural,
      kind: oneOf(['scripted', 'threat']),
      enemy: oneOf(ENEMIES_V34),
      size: oneOf(['light', 'medium', 'strong']),
      composition: nullable(listOf(raidPostV33)),
      announcedAtMs: nullable(natural),
    }),
  ),
  lastFormationSeen: memory,
  wavePlan: plan,
  omens: listOf(omen),
});

/** A parte herdada é conferida pela forma congelada 33, depois de validar os campos novos. */
function predecessor(value: StoredState): StoredState {
  const oldHorde = value.horde as StoredState;
  const map = value.map as StoredState;
  const tiles = map.tiles as Record<string, StoredState>;
  return {
    ...value,
    schemaVersion: 33,
    map: {
      ...map,
      tiles: Object.fromEntries(
        Object.entries(tiles).map(([id, tile]) => [id, { ...tile, type: 'wolfDen' }]),
      ),
    },
    horde: {
      scheduledRaids: (oldHorde.scheduledRaids as StoredState[]).map((raid) => ({
        ...raid,
        enemy: 'wolves',
      })),
    },
  };
}

const form = exactObject({
  ...stateV33Fields,
  schemaVersion: literal(34),
  horde,
  map: (value, path) => {
    const tiles = recordOf(exactObject({ type: oneOf(TILE_TYPES_V34), threatActive: boolean }));
    if (value === null || typeof value !== 'object' || Array.isArray(value))
      return stateV33Fields.map!(value, path);
    const map = value as StoredState;
    const error = tiles(map.tiles, `${path}.tiles`);
    if (error !== null) return error;
    return stateV33Fields.map!(
      {
        ...map,
        tiles: Object.fromEntries(
          Object.entries(map.tiles as Record<string, StoredState>).map(([id, tile]) => [
            id,
            { ...tile, type: 'wolfDen' },
          ]),
        ),
      },
      path,
    );
  },
});

type HordeState = {
  lastProcessedAt: number;
  clock: { year: number };
  horde: {
    lastFormationSeen: { total: number; byUnit: Record<string, number> } | null;
    wavePlan: {
      year: number;
      revision: number;
      generatedAtMs: number;
      waves: Array<{
        number: number;
        composition: Array<{ wing: string; line: string; unit: string; count: number }>;
      }>;
    } | null;
    omens: Array<{
      atMs: number;
      revision: number;
      wave: number;
      clarity: string;
      reveals: Array<{ wing: string; line: string; unit: string; count: number }>;
    }>;
  };
};

/** Limites e referências que a forma sozinha não prova; números congelados nesta versão. */
export const hordeWithinStateV34: Shape = (value, path) => {
  const { horde, lastProcessedAt, clock } = value as HordeState;
  const fail = (message: string) => `${path ? `${path}.` : ''}horde: ${message}`;
  const seen = horde.lastFormationSeen;
  if (seen !== null && seen.total > 180) return fail('memória acima dos seis postos da formação');
  if (seen !== null && Object.values(seen.byUnit).reduce((a, b) => a + b, 0) !== seen.total)
    return fail('a soma da memória difere do total');
  if (horde.omens.length > 6) return fail('mais de seis presságios');
  const plan = horde.wavePlan;
  if (plan === null) return horde.omens.length === 0 ? null : fail('presságio sem preparação');
  if (plan.year !== clock.year || plan.generatedAtMs > lastProcessedAt)
    return fail('preparação fora do ano ou no futuro');
  if (
    plan.waves.some(
      (wave, index) =>
        wave.number !== index + 1 || wave.composition.length === 0 || wave.composition.length > 6,
    )
  )
    return fail('ondas fora de ordem ou sem composição');
  for (const wave of plan.waves) {
    if (wave.composition.reduce((sum, post) => sum + post.count, 0) > 105)
      return fail('onda acima do tamanho máximo desta versão');
    const keys = wave.composition.map((post) => `${post.wing}/${post.line}`);
    if (new Set(keys).size !== keys.length) return fail('dois esquadrões no mesmo posto');
  }
  for (const omen of horde.omens) {
    if (
      omen.revision !== plan.revision ||
      omen.atMs < plan.generatedAtMs ||
      omen.atMs > lastProcessedAt
    )
      return fail('presságio de outra preparação ou fora do tempo');
    const wave = plan.waves.find((entry) => entry.number === omen.wave)!;
    if (omen.clarity === 'vague' && omen.reveals.length !== 0)
      return fail('presságio vago com postos revelados');
    if (
      omen.clarity === 'partial' &&
      (omen.reveals.length !== 1 ||
        omen.reveals.some((post) => {
          const real = wave.composition.find(
            (entry) =>
              entry.wing === post.wing && entry.line === post.line && entry.unit === post.unit,
          );
          return real === undefined || post.count !== Math.max(5, Math.round(real.count / 5) * 5);
        }))
    )
      return fail('presságio parcial difere do posto observado');
    if (
      omen.clarity === 'exact' &&
      (omen.reveals.length !== wave.composition.length ||
        omen.reveals.some((post, index) => {
          const real = wave.composition[index];
          return (
            real === undefined ||
            ['wing', 'line', 'unit', 'count'].some(
              (key) => post[key as keyof typeof post] !== real[key as keyof typeof real],
            )
          );
        }))
    )
      return fail('presságio exato difere da onda');
  }
  return null;
};

export const stateV34: Shape = (value, path) =>
  form(value, path) ??
  stateV33(predecessor(value as StoredState), path) ??
  hordeWithinStateV34(value, path);
