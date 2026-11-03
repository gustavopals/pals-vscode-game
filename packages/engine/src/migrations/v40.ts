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
  text,
  type Shape,
} from './shape';
import type { MigrationStep, StoredState } from './step';
import { RESOURCE_IDS_V25 } from './v25';
import { BUILDING_IDS_V28 } from './v28';
import { raidPostV33 } from './v33';
import { stateV39 } from './v39';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const waveNumber: Shape = (value, path) =>
  [1, 2, 3].includes(value as number) ? null : `${path}: onda fora de 1 a 3`;
const current: Shape = (value, path) =>
  [0, 1, 2, 3].includes(value as number) ? null : `${path}: onda atual fora de 0 a 3`;
const amountsShape = keyedRecordOf(
  (key) => RESOURCE_IDS_V25.includes(key),
  'recurso válido',
  natural,
);
const constructionV40: Shape = (value, path) => {
  if (!object(value)) return `${path}: obra ausente`;
  const { costPaid, ...rest } = value;
  if (costPaid !== undefined) {
    const invalid = amountsShape(costPaid, `${path}.costPaid`);
    if (invalid !== null) return invalid;
  }
  return exactObject({
    building: oneOf(BUILDING_IDS_V28),
    targetLevel: natural,
    startedAtMs: natural,
    finishesAtMs: natural,
  })(rest, path);
};
const wave: Shape = (value, path) => {
  if (!object(value)) return `${path}: onda ausente`;
  const { reductionPercent, ...rest } = value;
  if (
    reductionPercent !== undefined &&
    (natural(reductionPercent, path) !== null || (reductionPercent as number) > 45)
  )
    return `${path}: redução fora de 0 a 45`;
  return exactObject({ number: waveNumber, composition: listOf(raidPostV33) })(rest, path);
};
const siege = nullable(
  exactObject({
    year: positive,
    atMs: natural,
    waves: listOf(wave),
    current,
    nextWaveAtMs: nullable(natural),
    plan: exactObject({ '1': nullable(text), '2': nullable(text), '3': nullable(text) }),
    result: nullable(oneOf(['glorious', 'victory', 'fall'])),
    breached: boolean,
    deaths: natural,
    endedAtMs: nullable(natural),
    aftermathUntilMs: nullable(natural),
  }),
);

/** Forma congelada v40: identificadores e limites escritos, sem depender do conteúdo vivo. */
export const stateV40: Shape = (value, path) => {
  if (!object(value)) return stateV39(value, path);
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  const version = literal(40)(value.schemaVersion, at('schemaVersion'));
  if (version !== null) return version;
  const { siege: entry, ...rest } = value;
  if (!object(value.settlement)) return `${at('settlement')}: assentamento ausente`;
  const { militia, reconstructionUntilMs, ...settlement } = value.settlement;
  const checks: Array<[Shape, unknown, string]> = [
    [siege, entry, 'siege'],
    [nullable(exactObject({ count: positive, untilMs: natural })), militia, 'settlement.militia'],
    [nullable(natural), reconstructionUntilMs, 'settlement.reconstructionUntilMs'],
    [
      listOfLength(2, nullable(constructionV40)),
      value.settlement.constructionQueues,
      'settlement.constructionQueues',
    ],
  ];
  for (const [shape, field, key] of checks) {
    const invalid = shape(field, at(key));
    if (invalid !== null) return invalid;
  }
  // A Queda reduz o Quartel, sem matar sobreviventes nem apagar planos antes válidos (G-8).
  // A guarda congelada 39 ainda exige o teto antigo: só a fachada de validação recompõe o nível.
  const stats = value.stats as Record<string, number> | undefined;
  const cleanedQueues = Array.isArray(settlement.constructionQueues)
    ? settlement.constructionQueues.map((slot) => {
        if (!object(slot)) return slot;
        const rest = { ...slot };
        delete rest.costPaid;
        return rest;
      })
    : settlement.constructionQueues;
  let inheritedSettlement: StoredState = {
    ...settlement,
    constructionQueues: cleanedQueues,
  };
  if (
    (stats?.siegesFallen ?? 0) > 0 &&
    object(value.army) &&
    object(value.army.units) &&
    object(settlement.buildings)
  ) {
    const army = value.army;
    const total =
      Object.values(army.units as Record<string, number>).reduce((sum, count) => sum + count, 0) +
      (object(army.training) ? (army.training.amount as number) : 0);
    const postLevel =
      Array.isArray(army.formations) &&
      army.formations.some(
        (f) =>
          object(f) &&
          object(f.posts) &&
          Object.values(f.posts).some(
            (lines) =>
              object(lines) &&
              Object.values(lines).some((post) => object(post) && (post.count as number) > 20),
          ),
      )
        ? 5
        : 0;
    const level = settlement.buildings.barracks as number;
    if (level > 0 && Number.isSafeInteger(total) && total <= 80)
      inheritedSettlement = {
        ...inheritedSettlement,
        buildings: {
          ...(settlement.buildings as StoredState),
          barracks: Math.max(level, Math.ceil(total / 10), postLevel),
        },
      };
  }
  const inherited = stateV39({ ...rest, schemaVersion: 39, settlement: inheritedSettlement }, path);
  if (inherited !== null) return inherited;
  const now = value.lastProcessedAt as number;
  if (militia !== null) {
    const called = militia as { count: number; untilMs: number };
    const population = settlement.population as { villagers: number };
    const injured = settlement.injured as unknown[];
    if (called.untilMs < now || called.count > population.villagers - injured.length)
      return `${at('settlement.militia')}: efetivo ou prazo inválido`;
  }
  if (entry === null) return null;
  const plan = entry as {
    year: number;
    atMs: number;
    current: number;
    nextWaveAtMs: number | null;
    plan: Record<string, string | null>;
    result: string | null;
    waves: Array<{
      number: number;
      composition: Array<{ wing: string; line: string; count: number }>;
    }>;
    endedAtMs: number | null;
    aftermathUntilMs: number | null;
  };
  const army = value.army as { formations: Array<{ id: string }> };
  if (
    plan.waves.length !== 3 ||
    plan.waves.some(
      (w, index) =>
        w.number !== index + 1 ||
        w.composition.length === 0 ||
        w.composition.length > 6 ||
        new Set(w.composition.map((p) => `${p.wing}/${p.line}`)).size !== w.composition.length ||
        w.composition.reduce((sum, p) => sum + p.count, 0) > 105,
    )
  )
    return `${at('siege.waves')}: três ondas ordenadas com postos únicos são obrigatórias`;
  if (
    Object.values(plan.plan).some((id) => id !== null && !army.formations.some((f) => f.id === id))
  )
    return `${at('siege.plan')}: formação inexistente`;
  if (plan.result === null) {
    if (
      plan.current === 3 ||
      plan.nextWaveAtMs === null ||
      plan.nextWaveAtMs < now ||
      (plan.current === 0 && plan.nextWaveAtMs !== plan.atMs) ||
      plan.endedAtMs !== null ||
      plan.aftermathUntilMs !== null
    )
      return `${at('siege')}: cerco em curso com prazos incompatíveis`;
  } else if (
    plan.current === 0 ||
    plan.nextWaveAtMs !== null ||
    plan.endedAtMs === null ||
    plan.endedAtMs > now ||
    plan.aftermathUntilMs === null ||
    (plan.result !== 'fall' && plan.current !== 3)
  )
    return `${at('siege')}: resultado incompatível com as ondas`;
  return null;
};

/** O lote 3 não agenda prazos nem sorteia ao migrar uma partida. */
export const v40ToV41: MigrationStep = {
  from: 40,
  summary: 'Acrescenta os bônus do Conselho sem alterar lotes ou prazos existentes.',
  shape: stateV40,
  migrate: (state) => ({
    ...state,
    schemaVersion: 41,
    council: {
      ...(state.council as StoredState),
      bonuses: {
        smithySpeed: null,
        smithyBatch: null,
        repairDiscount: null,
        revealedRaidId: null,
      },
    },
  }),
};
