import { exactObject, listOf, literal, natural, oneOf, positive, text, type Shape } from './shape';
import type { StoredState } from './step';
import { stateV35 } from './v35';

// Identificadores da forma 36, congelados: o conteúdo pode crescer sem reescrever esta guarda.
const effects = listOf(
  exactObject({
    resource: oneOf(['food', 'wood', 'stone', 'iron']),
    factor: exactObject({ num: positive, den: positive }),
    untilMs: natural,
    label: (value, path) =>
      text(value, path) ?? ((value as string).trim().length > 0 ? null : `${path}: texto vazio`),
  }),
);

export const stateV36: Shape = (value, path) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return stateV35(value, path);
  const state = value as StoredState;
  const error = literal(36)(state.schemaVersion, path ? `${path}.schemaVersion` : 'schemaVersion');
  if (error !== null) return error;
  const market = state.market;
  if (market === null || typeof market !== 'object' || Array.isArray(market))
    return stateV35({ ...state, schemaVersion: 35 }, path);
  const { effects: live, ...oldMarket } = market as StoredState;
  return (
    effects(live, path ? `${path}.market.effects` : 'market.effects') ??
    stateV35({ ...state, schemaVersion: 35, market: oldMarket }, path)
  );
};
