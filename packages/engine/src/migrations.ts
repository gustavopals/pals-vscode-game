import type { Shape } from './migrations/shape';
import type { MigrationContext, MigrationStep, StoredState } from './migrations/step';
import { v1ToV2 } from './migrations/v1';
import { stateV2 } from './migrations/v2';
import type { GameState } from './types';
import { assertTimeScale } from './units';

export type { MigrationContext } from './migrations/step';

/** A versão do `GameState` que este motor escreve e sabe simular. */
export const CURRENT_SCHEMA_VERSION = 2 satisfies GameState['schemaVersion'];

/**
 * Um passo por versão, em ordem: o de índice `n` parte da versão `n + 1`. Cada tarefa que muda
 * a forma do estado sobe `schemaVersion` em um e acrescenta o seu passo no fim desta lista.
 */
export const migrationSteps: readonly MigrationStep[] = [v1ToV2];

/** A forma exata do estado na versão atual: é a entrada do próximo passo que alguém escrever. */
export const currentShape: Shape = stateV2;

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
 * Leva um estado gravado, de qualquer versão conhecida, até a versão atual. Função pura: não
 * altera a entrada e, para a mesma entrada, devolve sempre o mesmo estado. Um estado que já
 * está na versão atual volta como veio (o mesmo objeto), então migrar duas vezes é migrar uma.
 *
 * Os passos rodam em sequência (1 → 2 → 3 …) e cada um confere, antes de mexer, a forma exata
 * da versão de que parte; o resultado do último é conferido contra a forma da versão atual.
 * Forma inesperada ou versão mais nova que a do motor lançam `StateMigrationError`; a mensagem
 * cita o caminho do campo, nunca o valor.
 */
export function migrateState(stored: unknown, context: MigrationContext): GameState {
  assertTimeScale(context.timeScale);
  const version = storedVersion(stored);
  if (version > CURRENT_SCHEMA_VERSION) {
    throw new StateMigrationError(
      'future',
      `O estado está na versão ${version} e este motor só conhece até a ${CURRENT_SCHEMA_VERSION}: ele foi gravado por um motor mais novo.`,
    );
  }
  if (version === CURRENT_SCHEMA_VERSION) {
    return stored as GameState;
  }
  // Uma cópia só, no começo: daqui em diante os passos podem reaproveitar pedaços à vontade.
  let state = JSON.parse(JSON.stringify(stored)) as StoredState;
  for (let from = version; from < CURRENT_SCHEMA_VERSION; from += 1) {
    const step = migrationSteps[from - 1];
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
    state = step.migrate(state, context);
  }
  const found = currentShape(state, '');
  if (found !== null) {
    throw new StateMigrationError(
      'invalid',
      `A migração da versão ${version} para a ${CURRENT_SCHEMA_VERSION} produziu um estado fora da forma (${found}).`,
    );
  }
  return state as GameState;
}
