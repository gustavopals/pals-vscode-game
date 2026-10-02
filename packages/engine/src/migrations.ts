import type { Shape } from './migrations/shape';
import type { MigrationContext, MigrationStep, StoredState } from './migrations/step';
import { v1ToV2 } from './migrations/v1';
import { v2ToV3 } from './migrations/v2';
import { v3ToV4 } from './migrations/v3';
import { v4ToV5 } from './migrations/v4';
import { v5ToV6 } from './migrations/v5';
import { v6ToV7 } from './migrations/v6';
import { v7ToV8 } from './migrations/v7';
import { v8ToV9 } from './migrations/v8';
import { v9ToV10 } from './migrations/v9';
import { v10ToV11 } from './migrations/v10';
import { stateV11 } from './migrations/v11';
import type { GameState } from './types';
import { assertTimeScale } from './units';

export type { MigrationContext } from './migrations/step';

/** A versão do `GameState` que este motor escreve e sabe simular. */
export const CURRENT_SCHEMA_VERSION = 11 satisfies GameState['schemaVersion'];

/**
 * Um passo por versão, em ordem: o de índice `n` parte da versão `n + 1`. Cada tarefa que muda
 * a forma do estado sobe `schemaVersion` em um e acrescenta o seu passo no fim desta lista.
 */
export const migrationSteps: readonly MigrationStep[] = [
  v1ToV2,
  v2ToV3,
  v3ToV4,
  v4ToV5,
  v5ToV6,
  v6ToV7,
  v7ToV8,
  v8ToV9,
  v9ToV10,
  v10ToV11,
];

/** A forma exata do estado na versão atual: é a entrada do próximo passo que alguém escrever. */
export const currentShape: Shape = stateV11;

/**
 * Uma cadeia de migração: os passos, em ordem, e a forma da versão a que o último leva (a de
 * número `steps.length + 1`). O jogo só tem uma, a de `migrateState`; outra só existe em teste,
 * para provar o contrato dos passos antes de o próximo passo de verdade existir.
 */
export type MigrationChain = { steps: readonly MigrationStep[]; shape: Shape };

/**
 * Um estado gravado que este motor não pode usar. `future`: a versão é mais nova que a do
 * motor (uma imagem antiga diante de um banco já migrado). `invalid`: o JSON não tem a forma da
 * versão que declara. Em nenhum dos dois casos quem chamou deve gravar por cima.
 */
export class StateMigrationError extends Error {
  constructor(
    readonly reason: 'future' | 'invalid',
    message: string,
  ) {
    super(message);
    this.name = 'StateMigrationError';
  }
}

function storedVersion(stored: unknown): number {
  const version =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as StoredState).schemaVersion
      : undefined;
  if (!Number.isSafeInteger(version) || (version as number) < 1) {
    throw new StateMigrationError(
      'invalid',
      'O estado gravado não é um objeto com `schemaVersion` inteiro: não dá para saber de que versão ele é.',
    );
  }
  return version as number;
}

/**
 * O laço de `migrateState`, com a cadeia por parâmetro. O jogo só usa a cadeia de verdade
 * (`migrationSteps` e `currentShape`).
 */
export function migrateWith(
  stored: unknown,
  context: MigrationContext,
  chain: MigrationChain,
): StoredState {
  assertTimeScale(context.timeScale);
  const current = chain.steps.length + 1;
  const version = storedVersion(stored);
  if (version > current) {
    throw new StateMigrationError(
      'future',
      `O estado está na versão ${version} e este motor só conhece até a ${current}: ele foi gravado por um motor mais novo.`,
    );
  }
  if (version === current) {
    // O número da versão não é salvo-conduto: um estado que diz ser da versão atual é conferido
    // como o de qualquer outra. Sem isto, um campo a menos virava `NaN` no primeiro avanço e
    // `null` no banco. A conferência só lê; o estado bom volta como veio, o mesmo objeto.
    const found = chain.shape(stored, '');
    if (found !== null) {
      throw new StateMigrationError(
        'invalid',
        `O estado diz ser da versão ${current}, mas não tem a forma dela (${found}).`,
      );
    }
    return stored as StoredState;
  }
  // Uma cópia só, no começo: daqui em diante os passos podem reaproveitar pedaços à vontade.
  let state = JSON.parse(JSON.stringify(stored)) as StoredState;
  for (let from = version; from < current; from += 1) {
    const step = chain.steps[from - 1];
    if (step === undefined || step.from !== from) {
      throw new StateMigrationError('invalid', `Não há migração a partir da versão ${from}.`);
    }
    const found = step.shape(state, '');
    if (found !== null) {
      throw new StateMigrationError(
        'invalid',
        `O estado diz ser da versão ${from}, mas não tem a forma dela (${found}). Passo: ${step.summary}.`,
      );
    }
    // A fronteira é de cada passo: o instante em que este encontrou a partida. A guarda acabou
    // de conferir que `lastProcessedAt` é um inteiro, e nenhum passo mexe no relógio. Gravá-la
    // aqui, e não em cada passo, é o que impede um passo de deixar valendo a fronteira de uma
    // migração anterior (ou o `null` de quem nasceu na versão de partida).
    const boundaryMs = state.lastProcessedAt as number;
    state = { ...step.migrate(state, { ...context, boundaryMs }), migratedAtMs: boundaryMs };
  }
  const found = chain.shape(state, '');
  if (found !== null) {
    throw new StateMigrationError(
      'invalid',
      `A migração da versão ${version} para a ${current} produziu um estado fora da forma (${found}).`,
    );
  }
  return state;
}

/**
 * Leva um estado gravado, de qualquer versão conhecida, até a versão atual. Função pura: não
 * altera a entrada e, para a mesma entrada, devolve sempre o mesmo estado. Um estado que já
 * está na versão atual é conferido contra a forma dela e volta como veio (o mesmo objeto),
 * então migrar duas vezes é migrar uma.
 *
 * Os passos rodam em sequência (1 → 2 → 3 …) e cada um confere, antes de mexer, a forma exata
 * da versão de que parte; o resultado do último é conferido contra a forma da versão atual.
 * Forma inesperada, **em qualquer versão, inclusive a atual**, ou versão mais nova que a do
 * motor lançam `StateMigrationError`; a mensagem cita o caminho do campo, nunca o valor.
 */
export function migrateState(stored: unknown, context: MigrationContext): GameState {
  return migrateWith(stored, context, {
    steps: migrationSteps,
    shape: currentShape,
  }) as unknown as GameState;
}
