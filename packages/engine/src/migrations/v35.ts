import { boolean, exactObject, integer, literal, natural, type Shape } from './shape';
import type { StoredState } from './step';
import { stateV34 } from './v34';

const hour: Shape = (value, path) =>
  natural(value, path) ?? ((value as number) < 24 ? null : `${path}: hora fora de 0 a 23`);
const offset: Shape = (value, path) =>
  integer(value, path) ??
  (Math.abs(value as number) <= 840 ? null : `${path}: deslocamento fora de -840 a 840 minutos`);

const civil = exactObject({
  realOriginMs: integer,
  vigil: exactObject({ hourLocal: hour, utcOffsetMinutes: offset, timezoneResolved: boolean }),
});

/** Tira só os campos novos para conferir toda a forma congelada da versão 34. */
export const stateV35: Shape = (value, path) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    return stateV34(value, path);
  const state = value as StoredState;
  const versionError = literal(35)(
    state.schemaVersion,
    path ? `${path}.schemaVersion` : 'schemaVersion',
  );
  if (versionError !== null) return versionError;
  const settings = state.settings;
  if (settings === null || typeof settings !== 'object' || Array.isArray(settings))
    return stateV34(value, path);
  const { realOriginMs, vigil, ...oldSettings } = settings as StoredState;
  const settingsPath = path ? `${path}.settings` : 'settings';
  const error = civil({ realOriginMs, vigil }, settingsPath);
  if (error !== null) return error;
  const resolved = vigil as {
    hourLocal: number;
    utcOffsetMinutes: number;
    timezoneResolved: boolean;
  };
  if (resolved.hourLocal !== oldSettings.vigilHourLocal)
    return `${settingsPath}.vigil.hourLocal: difere de vigilHourLocal`;
  if (!resolved.timezoneResolved && resolved.utcOffsetMinutes !== 0)
    return `${settingsPath}.vigil.utcOffsetMinutes: fuso não resolvido exige zero`;
  return stateV34({ ...state, schemaVersion: 34, settings: oldSettings }, path);
};
