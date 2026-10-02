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
import type { MigrationStep, StoredState } from './step';
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
 * O passo que sai daqui é o `v5ToV6`, abaixo; a forma da versão 6 está em `v6.ts`.
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

/** Os edifícios produtivos da versão 6: cada um guarda a experiência do seu ofício. */
const PRODUCTION_BUILDINGS_V6 = ['farm', 'lumberMill', 'quarry', 'goldMine'];

/**
 * Versão 5 → 6: troca de ofício e experiência do ofício (V2C-T3; ADR 0013, decisão 4).
 *
 * - `settlement.adaptation` entra vazia: **todo mundo que já trabalha é adaptado**. Ninguém
 *   passa a render metade por causa da migração; só as trocas feitas dali em diante custam.
 * - `settlement.craftExperience` entra em 0 para todos os edifícios produtivos, e
 *   `settlement.craftMasteredYear` em 0 ("nunca"). A experiência começa a contar na primeira
 *   virada de dia depois da fronteira, com os trabalhadores que o edifício tiver nela.
 *
 * Nada mais muda: nenhum prazo, nenhum estoque, nenhum trabalhador sai do lugar. O passo não
 * cria prazo nenhum.
 */
export const v5ToV6: MigrationStep = {
  from: 5,
  summary: 'experiência do ofício em zero e todos os trabalhadores já adaptados',
  shape: stateV5,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    const zeroes = () => Object.fromEntries(PRODUCTION_BUILDINGS_V6.map((id) => [id, 0]));
    return {
      ...state,
      schemaVersion: 6,
      settlement: {
        ...settlement,
        craftExperience: zeroes(),
        craftMasteredYear: zeroes(),
        adaptation: [],
      },
    };
  },
};
