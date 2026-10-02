import { exactObject, listOf, literal, natural, nullable, oneOf, type Shape } from './shape';
import type { MigrationStep, StoredState } from './step';
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
 * O passo que sai daqui é o `v4ToV5`, abaixo; a forma da versão 5 está em `v5.ts`.
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

/** As filas de obras da versão 5: a que sempre existiu e a segunda, que o Salão abre. */
const QUEUES_V5 = 2;

/**
 * Versão 4 → 5: segunda fila de obras e início automático das planejadas (V2C-T5; ADR 0013,
 * decisões 4 e 18).
 *
 * - `settlement.constructionQueues` passa a ter sempre duas posições: a obra em curso continua
 *   na primeira e a segunda entra vazia. Ela só recebe obra com o Salão no nível que a abre, e
 *   isso é derivado do nível do Salão: uma partida que já o tem ganha a fila na fronteira, sem
 *   linha nenhuma na Crônica.
 * - Cada item de `settlement.planned` ganha `autoStart: false`: **as planejadas antigas
 *   continuam manuais**. Nenhuma obra começa sozinha por causa da migração; quem quiser marca.
 *
 * Nada mais muda: nenhum prazo, nenhum estoque. O passo não cria prazo nenhum.
 */
export const v4ToV5: MigrationStep = {
  from: 4,
  summary: 'segunda fila de obras, vazia, e as planejadas antigas marcadas como manuais',
  shape: stateV4,
  migrate(state) {
    const settlement = state.settlement as StoredState;
    const queues = settlement.constructionQueues as unknown[];
    const planned = settlement.planned as StoredState[];
    return {
      ...state,
      schemaVersion: 5,
      settlement: {
        ...settlement,
        // Só completa: uma lista mais longa que as filas sai como veio e a forma da versão 5 a
        // recusa, em vez de uma obra sumir calada.
        constructionQueues: [
          ...queues,
          ...Array.from({ length: Math.max(0, QUEUES_V5 - queues.length) }, () => null),
        ],
        planned: planned.map((plan) => ({ ...plan, autoStart: false })),
      },
    };
  },
};
