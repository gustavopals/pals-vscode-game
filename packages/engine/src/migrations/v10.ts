import {
  boolean,
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  type Shape,
} from './shape';
import { settlementV9Fields, stateV9Fields } from './v9';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje a lista coincide com a de `@lotg/content`.
const BUILDINGS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
];
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 10: o da versão 9 com a Paliçada (V2E-T2) em `settlement.buildings`,
 * nas obras em curso e nas planejadas. Nenhum campo novo: o que a Paliçada segura é derivado do
 * nível dela, e a cadeia de cartas "A Promessa da Paliçada" usa o que o Conselho já guardava
 * (os ids de carta e de flag são texto livre).
 *
 * Quem subir `schemaVersion` para 11 acrescenta aqui o passo `v10ToV11`, com esta forma como
 * entrada, e escreve a forma nova em `v11.ts`.
 */
export const settlementV10Fields: Readonly<Record<string, Shape>> = {
  ...settlementV9Fields,
  buildings: each(BUILDINGS, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDINGS),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDINGS), targetLevel: natural, autoStart: boolean }),
  ),
};

export const stateV10Fields: Readonly<Record<string, Shape>> = {
  ...stateV9Fields,
  schemaVersion: literal(10),
  settlement: exactObject(settlementV10Fields),
};

export const stateV10: Shape = exactObject(stateV10Fields);
