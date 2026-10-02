import { exactObject, literal, natural, nullable, type Shape } from './shape';
import { settlementV1Fields } from './v1';
import { stateV2Fields } from './v2';

/**
 * O `GameState` da versão 3: o da versão 2 com `settlement.cold`, o frio (V2C-T1).
 *
 * Quem subir `schemaVersion` para 4 acrescenta aqui o passo `v3ToV4`, com esta forma como
 * entrada, e escreve a forma nova em `v4.ts`.
 */
export const settlementV3Fields: Readonly<Record<string, Shape>> = {
  ...settlementV1Fields,
  cold: nullable(exactObject({ sinceMs: natural })),
};

export const stateV3Fields: Readonly<Record<string, Shape>> = {
  ...stateV2Fields,
  schemaVersion: literal(3),
  settlement: exactObject(settlementV3Fields),
};

export const stateV3: Shape = exactObject(stateV3Fields);
