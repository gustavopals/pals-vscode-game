import { literal, natural, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
import { stateV42 } from './v42';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Forma congelada da Fase B; não acompanha ids nem conteúdo futuros. */
export const stateV43: Shape = (value, path) => {
  if (!object(value) || !object(value.settlement) || !object(value.settlement.buildings))
    return `${path}.settlement.buildings: edifícios ausentes`;
  const version = literal(43)(value.schemaVersion, `${path}.schemaVersion`);
  if (version !== null) return version;
  const { chapel, ...buildings } = value.settlement.buildings;
  const invalid = natural(chapel, `${path}.settlement.buildings.chapel`);
  if (invalid !== null) return invalid;
  if ((chapel as number) > 3) return `${path}.settlement.buildings.chapel: nível acima de 3`;
  // As obras/planejadas do edifício novo precisam da mesma forma das demais.
  const inherited = JSON.parse(
    JSON.stringify({
      ...value,
      schemaVersion: 42,
      settlement: { ...value.settlement, buildings },
    }),
  ) as StoredState;
  const adapt = (entry: unknown): void => {
    if (Array.isArray(entry)) entry.forEach(adapt);
    else if (object(entry)) {
      if (entry.building === 'chapel') entry.building = 'tavern';
      Object.values(entry).forEach(adapt);
    }
  };
  adapt(inherited);
  return stateV42(inherited, path);
};

/** D-4: um só passo 42 → 43 para toda a Fase B, sem eventos ou sorteios. */
export const v42ToV43: MigrationStep = {
  from: 42,
  summary: 'Acrescenta a Capela por construir, preservando ferimentos e demais prazos.',
  shape: stateV42,
  migrate: (state) => {
    const settlement = state.settlement as StoredState;
    return {
      ...state,
      schemaVersion: 43,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as StoredState), chapel: 0 },
      },
    };
  },
};
