import { exactObject, listOf, literal, natural, nullable, oneOf, type Shape } from './shape';
import { settlementV3Fields, stateV3Fields } from './v3';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje as listas coincidem com as de `@lotg/content`.
const RESOURCES = ['food', 'wood', 'stone', 'gold'];
const BUILDINGS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
];

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 4: o da versão 3 com o armazenamento (V2C-T2). Entram o Celeiro e o
 * Armazém em `settlement.buildings` (e nas obras em curso e planejadas) e `settlement.wasted`,
 * o desperdício que a Crônica ainda não contou.
 *
 * Quem subir `schemaVersion` para 5 acrescenta aqui o passo `v4ToV5`, com esta forma como
 * entrada, e escreve a forma nova em `v5.ts`.
 */
export const settlementV4Fields: Readonly<Record<string, Shape>> = {
  ...settlementV3Fields,
  buildings: each(BUILDINGS, natural),
  constructionQueues: listOf(
    nullable(
      exactObject({
        building: oneOf(BUILDINGS),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(exactObject({ building: oneOf(BUILDINGS), targetLevel: natural })),
  wasted: each(RESOURCES, natural),
};

export const stateV4Fields: Readonly<Record<string, Shape>> = {
  ...stateV3Fields,
  schemaVersion: literal(4),
  settlement: exactObject(settlementV4Fields),
};

export const stateV4: Shape = exactObject(stateV4Fields);
