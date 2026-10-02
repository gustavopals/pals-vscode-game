import type { Shape } from './shape';

/** JSON de um estado em uma versão qualquer: só a guarda de forma sabe o que há dentro. */
export type StoredState = Record<string, unknown>;

/** O que a migração precisa saber e que não está no estado gravado. */
export type MigrationContext = {
  /** Ritmo da partida (`games.time_scale`): horas de jogo por hora real. */
  timeScale: number;
};

/** O que cada passo recebe: o contexto de quem chamou e a fronteira que é só dele. */
export type StepContext = MigrationContext & {
  /**
   * A fronteira **deste** passo: o instante de jogo em que a partida estava (`lastProcessedAt`)
   * quando ele rodou. Todo prazo que o passo criar (a primeira carta, a primeira incursão)
   * conta a partir daqui, nunca do `migratedAtMs` que veio gravado: aquele é a fronteira de uma
   * migração anterior, ou `null` em uma partida que nasceu na versão de que este passo parte.
   */
  boundaryMs: number;
};

/**
 * Um passo leva o estado de uma versão para a seguinte. A lista de passos fica em
 * `migrations.ts`; o passo de índice `n` parte da versão `n + 1`.
 */
export type MigrationStep = {
  from: number;
  /** O que muda, em uma frase: aparece no erro quando o passo falha. */
  summary: string;
  /** A forma exata do estado na versão `from`, congelada. */
  shape: Shape;
  /**
   * Recebe um estado que passou pela guarda e não o altera: devolve o da versão seguinte. Não
   * mexe em `lastProcessedAt`. A partir da versão 2 não precisa escrever `migratedAtMs`:
   * `migrateWith` grava a fronteira do passo no que ele devolve.
   */
  migrate: (state: StoredState, context: StepContext) => StoredState;
};
