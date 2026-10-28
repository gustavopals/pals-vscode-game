import { boolean, exactObject, literal, natural, type Shape } from './shape';
import type { StoredState } from './step';
import { stateV37 } from './v37';

const object = (value: unknown): value is StoredState =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

const sabotages = exactObject({
  attempts: natural,
  successes: natural,
  alerted: boolean,
});

export const stateV38: Shape = (value, path) => {
  if (!object(value)) return stateV37(value, path);
  const at = (key: string) => (path === '' ? key : `${path}.${key}`);
  const version = literal(38)(value.schemaVersion, at('schemaVersion'));
  if (version !== null) return version;
  const old = { ...value, schemaVersion: 37 };
  const horde = value.horde;
  if (!object(horde)) return stateV37(old, path);
  const { sabotages: entry, ...oldHorde } = horde;
  const error = sabotages(entry, at('horde.sabotages'));
  if (error !== null) return error;

  // Limpa campos opcionais das ondas que a forma anterior não conhecia
  let strippedHorde = oldHorde;
  if (object(oldHorde.wavePlan) && Array.isArray(oldHorde.wavePlan.waves)) {
    for (const [index, wave] of oldHorde.wavePlan.waves.entries()) {
      if (object(wave) && Object.hasOwn(wave, 'reductionPercent')) {
        // Limite da forma v38, independente de futuras mudanças no conteúdo.
        const invalid = natural(
          wave.reductionPercent,
          at(`horde.wavePlan.waves.${index}.reductionPercent`),
        );
        if (invalid !== null) return invalid;
        if ((wave.reductionPercent as number) > 45)
          return `${at(`horde.wavePlan.waves.${index}.reductionPercent`)}: redução acima de 45`;
      }
    }
    const waves = oldHorde.wavePlan.waves.map((w) => {
      if (object(w) && Object.hasOwn(w, 'reductionPercent')) {
        const { reductionPercent, ...rest } = w;
        void reductionPercent;
        return rest;
      }
      return w;
    });
    strippedHorde = {
      ...oldHorde,
      wavePlan: { ...oldHorde.wavePlan, waves },
    };
  }

  const inherited = {
    ...old,
    horde: strippedHorde,
  };
  return stateV37(inherited, path);
};
