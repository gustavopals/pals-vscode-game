import { keyedRecordOf, natural, literal, type Shape } from './shape';
import type { StoredState } from './step';
import { stateV41 } from './v41';

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
  return stateV41({ ...value, schemaVersion: 41, map }, path);
};
