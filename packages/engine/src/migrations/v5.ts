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
import { settlementV4Fields, stateV4Fields } from './v4';

// Os identificadores ficam escritos aqui, como nas outras versões: a forma de uma versão não
// acompanha o conteúdo. O teste confere que hoje as listas coincidem com as de `@lotg/content`.
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
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

/**
 * O `GameState` da versão 5: o da versão 4 com a segunda fila de obras e o início automático
 * (V2C-T5). `settlement.constructionQueues` tem sempre duas posições e cada planejada diz se é
 * automática (`autoStart`).
 *
 * Quem subir `schemaVersion` para 6 acrescenta aqui o passo `v5ToV6`, com esta forma como
 * entrada, e escreve a forma nova em `v6.ts`.
 */
export const settlementV5Fields: Readonly<Record<string, Shape>> = {
  ...settlementV4Fields,
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

export const stateV5Fields: Readonly<Record<string, Shape>> = {
  ...stateV4Fields,
  schemaVersion: literal(5),
  settlement: exactObject(settlementV5Fields),
};

export const stateV5: Shape = exactObject(stateV5Fields);
