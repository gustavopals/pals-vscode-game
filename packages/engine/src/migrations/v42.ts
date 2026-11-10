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
  const training = object(army) ? army.training : null;
  if (
    !object(army) ||
    !object(training) ||
    !Number.isInteger(training.amount) ||
    (training.amount as number) <= TRAINING_BATCH_MAX_V28
  ) {
    return stateV41(inherited, path);
  }
  // Valida todas as demais propriedades pela guarda histórica antes de lê-las.
  const normalized = {
    ...inherited,
    army: { ...army, training: { ...training, amount: TRAINING_BATCH_MAX_V28 } },
  };
  const error = stateV41(normalized, path);
  if (error !== null) return error;
  const amount = training.amount as number;
  const settings = value.settings as StoredState;
  // Ritmos fixados na v42: 0,5 e 1 conservam a base; 3 a triplica.
  const maximum = settings.timeScale === 3 ? 3 * TRAINING_BATCH_MAX_V28 : TRAINING_BATCH_MAX_V28;
  if (amount > maximum) return `${armyPath}.training.amount: lote acima do máximo`;
  const settlement = value.settlement as StoredState;
  const level = (settlement.buildings as StoredState).barracks as number;
  const total =
    Object.values(army.units as Record<string, number>).reduce((sum, count) => sum + count, 0) +
    amount;
  const stats = value.stats as Record<string, number>;
  // Mesma exceção da Queda na guarda v40: sobreviventes/lote podem exceder o Quartel
  // reduzido, preservando o teto absoluto de oito níveis. A R2 não cria vagas.
  const afterFall =
    (stats.siegesFallen ?? 0) > 0 && level > 0 && total <= 8 * ARMY_CAP_PER_LEVEL_V28;
  if (total > level * ARMY_CAP_PER_LEVEL_V28 && !afterFall)
    return `${armyPath}.training.amount: soldados e lote acima do limite do Quartel`;
  return null;
};
