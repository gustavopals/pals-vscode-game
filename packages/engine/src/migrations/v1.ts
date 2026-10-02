import {
  exactObject,
  integer,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  recordOf,
  type Shape,
  text,
} from './shape';
import type { MigrationStep, StoredState } from './step';

// Os identificadores da versão 1 ficam escritos aqui, e não vêm de `@lotg/content`: as listas do
// conteúdo crescem a cada versão, e a forma de um estado antigo não muda nunca.
const RESOURCES = ['food', 'wood', 'stone', 'gold'];
const PRODUCTION_BUILDINGS = ['farm', 'lumberMill', 'quarry', 'goldMine'];
const BUILDINGS = ['townHall', ...PRODUCTION_BUILDINGS, 'housing'];

const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

const construction = exactObject({
  building: oneOf(BUILDINGS),
  targetLevel: natural,
  startedAtMs: natural,
  finishesAtMs: natural,
});

/**
 * Os campos do `GameState` da v0.1 (`schemaVersion: 1`), como o motor da tag `v0.1.0` o gravava.
 * A versão seguinte parte daqui e troca só o que mudou.
 */
export const stateV1Fields: Readonly<Record<string, Shape>> = {
  schemaVersion: literal(1),
  seed: text,
  settings: exactObject({
    settlementName: text,
    timezone: text,
    vigilHourLocal: natural,
    capsEnabled: literal(false),
  }),
  clock: exactObject({ gameTimeMs: natural, yearStartMs: natural, year: natural }),
  lastProcessedAt: natural,
  rng: recordOf(listOf(integer)),
  settlement: exactObject({
    name: text,
    resources: each(RESOURCES, natural),
    accumulators: each(RESOURCES, integer),
    population: exactObject({ villagers: natural }),
    workers: each(PRODUCTION_BUILDINGS, natural),
    buildings: each(BUILDINGS, natural),
    constructionQueues: listOf(nullable(construction)),
    planned: listOf(exactObject({ building: oneOf(BUILDINGS), targetLevel: natural })),
    recruitmentQueue: listOf(exactObject({ finishesAtMs: natural })),
    famine: nullable(exactObject({ sinceMs: natural })),
  }),
  objectives: exactObject({ active: listOf(text), completed: listOf(text) }),
  stats: recordOf(natural),
};

export const stateV1: Shape = exactObject(stateV1Fields);

/**
 * Versão 1 → 2: a fundação da v0.2 (ADR 0013, decisão 4). Preserva tudo o que o jogador tem.
 *
 * - `settings.capsEnabled` sai: os limites de estoque deixam de ser uma chave e passam a ser
 *   regra, com o Celeiro e o Armazém.
 * - `settings.difficulty` entra como `lord`: toda partida da v0.1 nasceu Senhor.
 * - `settings.timeScale` entra com o ritmo gravado na linha da partida, que não muda mais.
 * - `migratedAtMs` entra, com a fronteira deste passo: o instante de jogo até onde as regras
 *   antigas valeram. Partidas novas nascem com `null`. Cada passo seguinte tem a própria
 *   fronteira, e `migrateWith` a grava neste mesmo campo.
 */
export const v1ToV2: MigrationStep = {
  from: 1,
  summary: 'fundação da v0.2: dificuldade e ritmo no estado, fronteira da atualização',
  shape: stateV1,
  migrate(state, { timeScale, boundaryMs }) {
    const old = state.settings as StoredState;
    return {
      schemaVersion: 2,
      seed: state.seed,
      settings: {
        settlementName: old.settlementName,
        timezone: old.timezone,
        vigilHourLocal: old.vigilHourLocal,
        difficulty: 'lord',
        timeScale,
      },
      migratedAtMs: boundaryMs,
      clock: state.clock,
      lastProcessedAt: state.lastProcessedAt,
      rng: state.rng,
      settlement: state.settlement,
      objectives: state.objectives,
      stats: state.stats,
    };
  },
};
