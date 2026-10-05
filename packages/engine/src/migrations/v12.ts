import { exactObject, literal, natural, nullable, type Shape } from './shape';
import { settlementV11Fields, stateV11Fields } from './v11';

/**
 * O `GameState` da versão 12: o da versão 11 com a deserção por fome em tempo real e a fome que
 * reabre (V2G-T2; ADR 0016, itens 2 e 3).
 *
 * - `settlement.famine` ganha `carriedMs` (o quanto a fome já tinha durado antes de reabrir;
 *   zero em uma fome nova) e `deserted` (quantos aldeões o prazo da deserção já cobrou nela).
 * - Entra `settlement.lastFamine`: a última fome que acabou (quando, quanto durou e quantos
 *   tinha cobrado), para a que reabrir dentro da janela continuar de onde ela parou.
 *
 * O aviso da Torre de Vigia em tempo real (V2G-T3) não mudou a forma: a antecedência é
 * derivada do nível da Torre e do ritmo, e `announcedAtMs` já dizia o que foi anunciado.
 *
 * Quem subir `schemaVersion` para 13 acrescenta aqui o passo `v12ToV13`, com esta forma como
 * entrada, e escreve a forma nova em `v13.ts`.
 */
export const settlementV12Fields: Readonly<Record<string, Shape>> = {
  ...settlementV11Fields,
  famine: nullable(exactObject({ sinceMs: natural, carriedMs: natural, deserted: natural })),
  lastFamine: nullable(exactObject({ endedAtMs: natural, lastedMs: natural, deserted: natural })),
};

export const stateV12Fields: Readonly<Record<string, Shape>> = {
  ...stateV11Fields,
  schemaVersion: literal(12),
  settlement: exactObject(settlementV12Fields),
};

export const stateV12: Shape = exactObject(stateV12Fields);
