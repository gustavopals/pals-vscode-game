import {
  boolean,
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  recordOf,
  type Shape,
  text,
} from './shape';
import { settlementV7Fields } from './v7';
import { stateV8Fields } from './v8';

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
  'watchtower',
];
const TILE_TYPES = ['wolfDen'];
const ENEMIES = ['wolves'];
const RAID_SIZES = ['light', 'medium'];
/** Quantas filas de obras o estado guarda, abertas ou não. */
const QUEUES = 2;

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

/**
 * O `GameState` da versão 9: o da versão 8 com a Torre de Vigia, os tiles de ameaça e a Ameaça
 * (V2E-T1). Entram a Torre em `settlement.buildings` (e nas obras em curso e planejadas), `map`
 * (os tiles, pela chave de cada um, e a Ameaça) e `horde` (as incursões marcadas; nada as marca
 * nesta versão).
 *
 * As chaves dos tiles são texto livre, como os ids das cartas: o mapa cresce sem a forma do
 * estado mudar. O tipo de cada tile é de uma lista fechada.
 *
 * Quem subir `schemaVersion` para 10 acrescenta aqui o passo `v9ToV10`, com esta forma como
 * entrada, e escreve a forma nova em `v10.ts`.
 */
export const settlementV9Fields: Readonly<Record<string, Shape>> = {
  ...settlementV7Fields,
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

export const mapV9Fields: Readonly<Record<string, Shape>> = {
  tiles: recordOf(exactObject({ type: oneOf(TILE_TYPES), threatActive: boolean })),
  threat: natural,
};

export const hordeV9Fields: Readonly<Record<string, Shape>> = {
  scheduledRaids: listOf(
    exactObject({
      id: text,
      atMs: natural,
      kind: oneOf(['scripted', 'threat']),
      enemy: oneOf(ENEMIES),
      size: oneOf(RAID_SIZES),
      // O instante em que a Torre avisou; `null` enquanto ninguém avisou.
      announcedAtMs: nullable(natural),
    }),
  ),
};

export const stateV9Fields: Readonly<Record<string, Shape>> = {
  ...stateV8Fields,
  schemaVersion: literal(9),
  settlement: exactObject(settlementV9Fields),
  map: exactObject(mapV9Fields),
  horde: exactObject(hordeV9Fields),
};

export const stateV9: Shape = exactObject(stateV9Fields);
