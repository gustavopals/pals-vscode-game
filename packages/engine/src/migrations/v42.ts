import { keyedRecordOf, natural, literal, type Shape } from './shape';
import type { StoredState } from './step';
import { stateV41 } from './v41';
import { ARMY_CAP_PER_LEVEL_V28, TRAINING_BATCH_MAX_V28 } from './v28';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Identificador e forma fixos desta versão, sem acompanhar o catálogo futuro. */
export const stateV42: Shape = (value, path) => {
  if (!object(value) || !object(value.map)) return `${path}.map: mapa ausente`;
  const version = literal(42)(value.schemaVersion, `${path}.schemaVersion`);
  if (version !== null) return version;
  const { expeditionUnlocks, ...map } = value.map;
  const invalid = keyedRecordOf(
    (key) => key === 'whiteWolfHunt',
    'destino especial da v42',
    natural,
  )(expeditionUnlocks, `${path}.map.expeditionUnlocks`);
  if (invalid !== null) return invalid;
  const deadlines = expeditionUnlocks as Record<string, number>;
  const discovered = map.discovered;
  if (Array.isArray(discovered)) {
    if (
      Object.keys(deadlines).some((id) => !discovered.includes(id)) ||
      (discovered.includes('whiteWolfHunt') && !Object.hasOwn(deadlines, 'whiteWolfHunt'))
    ) {
      return `${path}.map.expeditionUnlocks: destino e prazo não correspondem`;
    }
  }
  const inherited = { ...value, schemaVersion: 41, map };
  const armyPath = path === '' ? 'army' : `${path}.army`;
  const army = value.army;
  const settlement = value.settlement;
  if (!object(army) || !object(settlement) || !object(settlement.buildings))
    return stateV41(inherited, path);
  const level = settlement.buildings.barracks;
  const levelError = natural(
    level,
    `${path === '' ? '' : `${path}.`}settlement.buildings.barracks`,
  );
  if (levelError !== null) return levelError;
  const training = army.training;
  // A fachada conserva unidades, campanha e demais relações intactas. Só adapta
  // nível/lote para a guarda antiga; os tetos reais são conferidos abaixo.
  const factor = object(value.settings) && value.settings.timeScale === 3 ? 3 : 1;
  const amount = object(training) ? training.amount : 0;
  const validAmount = Number.isSafeInteger(amount) && (amount as number) > 0;
  const soldiers = object(army.units)
    ? Object.values(army.units).reduce<number>((sum, count) => sum + (count as number), 0)
    : NaN;
  const total = soldiers + (amount as number);
  const fallen = object(value.stats) && (value.stats.siegesFallen as number) > 0;
  const afterFall = fallen && (level as number) > 0 && total <= 8 * ARMY_CAP_PER_LEVEL_V28 * factor;
  const normalizedLevel = afterFall
    ? Math.max((level as number) * factor, Math.ceil(total / ARMY_CAP_PER_LEVEL_V28))
    : (level as number) * factor;
  const normalized = {
    ...inherited,
    settlement: {
      ...settlement,
      buildings: { ...settlement.buildings, barracks: normalizedLevel },
    },
    army: {
      ...army,
      training:
        object(training) && validAmount
          ? { ...training, amount: Math.min(amount as number, TRAINING_BATCH_MAX_V28) }
          : training,
    },
  };
  const error = stateV41(normalized, path);
  if (error !== null) return error;
  if ((amount as number) > TRAINING_BATCH_MAX_V28 * factor)
    return `${armyPath}.training.amount: lote acima do máximo`;
  if (total > (level as number) * ARMY_CAP_PER_LEVEL_V28 * factor && !afterFall)
    return `${armyPath}.training.amount: soldados e lote acima do limite do Quartel`;
  return null;
};
