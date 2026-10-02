import { exactObject, listOf, literal, natural, oneOf, positive, type Shape } from './shape';
import { settlementV5Fields, stateV5Fields } from './v5';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje a lista coincide com a de `@lotg/content`.
const PRODUCTION_BUILDINGS = ['farm', 'lumberMill', 'quarry', 'goldMine'];

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 6: o da versão 5 com a troca de ofício e a experiência do ofício
 * (V2C-T3). Entram `settlement.craftExperience` e `settlement.craftMasteredYear`, um número por
 * edifício produtivo, e `settlement.adaptation`, as coortes de quem ainda se adapta.
 *
 * Quem subir `schemaVersion` para 7 acrescenta aqui o passo `v6ToV7`, com esta forma como
 * entrada, e escreve a forma nova em `v7.ts`.
 */
export const settlementV6Fields: Readonly<Record<string, Shape>> = {
  ...settlementV5Fields,
  craftExperience: each(PRODUCTION_BUILDINGS, natural),
  craftMasteredYear: each(PRODUCTION_BUILDINGS, natural),
  // Uma coorte vazia não existe: ela sai da lista quando o último trabalhador dela sai.
  adaptation: listOf(
    exactObject({ building: oneOf(PRODUCTION_BUILDINGS), count: positive, untilMs: natural }),
  ),
};

export const stateV6Fields: Readonly<Record<string, Shape>> = {
  ...stateV5Fields,
  schemaVersion: literal(6),
  settlement: exactObject(settlementV6Fields),
};

export const stateV6: Shape = exactObject(stateV6Fields);
