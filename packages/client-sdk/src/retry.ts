import { NetworkError } from './errors';

export type RetryOptions = {
  /** Total de tentativas, contando a primeira. */
  attempts: number;
  /** Espera antes da segunda tentativa; dobra a cada nova tentativa. */
  baseDelayMs: number;
  sleep: (ms: number) => Promise<void>;
};

/**
 * Repete uma operação enquanto ela falhar por rede, com recuo exponencial.
 * Só é seguro para operações idempotentes: leituras, e comandos com `commandId` fixo.
 */
export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions): Promise<T> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof NetworkError) || !error.retryable || attempt >= options.attempts) {
        throw error;
      }
      await options.sleep(options.baseDelayMs * 2 ** (attempt - 1));
    }
  }
}
