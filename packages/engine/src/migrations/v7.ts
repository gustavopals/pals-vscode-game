import { exactObject, integer, listOf, literal, natural, type Shape, text } from './shape';
import { settlementV6Fields, stateV6Fields } from './v6';

/**
 * O `GameState` da versão 7: o da versão 6 com a moral (V2C-T4). Entram `settlement.morale`, um
 * número de 0 a 100, e `settlement.moraleEffects`, os efeitos temporários que cartas, incursões
 * e objetivos gravam: quem, com que nome, quanto (positivo ou negativo) e até quando.
 *
 * Quem subir `schemaVersion` para 8 acrescenta aqui o passo `v7ToV8`, com esta forma como
 * entrada, e escreve a forma nova em `v8.ts`.
 */
export const settlementV7Fields: Readonly<Record<string, Shape>> = {
  ...settlementV6Fields,
  morale: natural,
  moraleEffects: listOf(exactObject({ id: text, label: text, amount: integer, untilMs: natural })),
};

export const stateV7Fields: Readonly<Record<string, Shape>> = {
  ...stateV6Fields,
  schemaVersion: literal(7),
  settlement: exactObject(settlementV7Fields),
};

export const stateV7: Shape = exactObject(stateV7Fields);
