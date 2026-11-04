import { exactObject, literal, natural, nullable, positive, text, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV40 } from './v40';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const waveNumber: Shape = (value, path) =>
  [1, 2, 3].includes(value as number) ? null : `${path}: onda fora de 1 a 3`;
const bonuses = exactObject({
  smithySpeed: nullable(
    exactObject({ factor: exactObject({ num: positive, den: positive }), untilMs: natural }),
  ),
  smithyBatch: nullable(exactObject({ extra: positive, untilMs: natural })),
  repairDiscount: nullable(exactObject({ points: positive, untilMs: natural })),
  revealedRaidId: nullable(text),
});
/** Guarda congelada v41; o item novo tem os mesmos limites da lâmina rara anterior. */
export const stateV41: Shape = (value, path) => {
  if (!object(value) || !object(value.council) || !object(value.settlement))
    return `${path}: estado incompleto`;
  const version = literal(41)(value.schemaVersion, `${path}.schemaVersion`);
  if (version !== null) return version;
  const { bonuses: bonus, ...council } = value.council;
  const invalid = bonuses(bonus, `${path}.council.bonuses`);
  if (invalid !== null) return invalid;
  const b = bonus as {
    smithyBatch: { extra: number } | null;
    repairDiscount: { points: number } | null;
  };
  if ((b.smithyBatch?.extra ?? 0) > 10 || (b.repairDiscount?.points ?? 0) > 100)
    return `${path}.council.bonuses: bônus acima do limite`;
  const settlement = { ...value.settlement };
  if (object(settlement.forge) && settlement.forge.kind === 'weapons') {
    const { extra, ...forge } = settlement.forge;
    if (
      extra !== undefined &&
      (natural(extra, path) !== null || (extra as number) + (forge.amount as number) > 10)
    )
      return `${path}.settlement.forge.extra: rendimento inválido`;
    settlement.forge = forge;
  }
  const army = object(value.army) ? { ...value.army } : value.army;
  if (object(army) && object(army.preview) && army.preview.siegeWave !== undefined) {
    const { siegeWave, ...preview } = army.preview;
    const waveError = waveNumber(siegeWave, `${path}.army.preview.siegeWave`);
    if (waveError !== null) return waveError;
    army.preview = preview;
  }
  // A fachada adapta só o identificador novo, sem aceitar campos extras na forma antiga.
  const inherited = JSON.parse(
    JSON.stringify({ ...value, schemaVersion: 40, council, settlement, army }),
  ) as StoredState;
  const adapt = (entry: unknown): void => {
    if (Array.isArray(entry)) entry.forEach(adapt);
    else if (object(entry)) {
      if (entry.defId === 'lordsSword') entry.defId = 'veltharBlade';
      Object.values(entry).forEach(adapt);
    }
  };
  adapt(inherited);
  return stateV40(inherited, path);
};

/** O prazo só nasce quando uma carta é respondida; a migração não abre destino. */
export const v41ToV42: MigrationStep = {
  from: 41,
  summary: 'Acrescenta os prazos dos destinos liberados por carta, sem abrir uma caçada.',
  shape: stateV41,
  migrate: (state) => ({
    ...state,
    schemaVersion: 42,
    map: { ...(state.map as StoredState), expeditionUnlocks: {} },
  }),
};
