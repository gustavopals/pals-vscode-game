/** Estado da ligação com o servidor. Falha de autenticação não é modo sem conexão. */
export type Connection =
  | { kind: 'online' }
  | { kind: 'offline'; retryInMs: number; attempt: number }
  | { kind: 'unauthenticated' };

export const POLL_VISIBLE_MS = 30_000;
export const POLL_HIDDEN_MS = 2 * 60_000;

const FIRST_RETRY_MS = 5_000;
const MAX_RETRY_MS = 60_000;

/** Recuo exponencial das tentativas de reconexão: 5 s, 10 s, 20 s, 40 s e depois 60 s. */
export function retryDelayMs(attempt: number): number {
  return Math.min(MAX_RETRY_MS, FIRST_RETRY_MS * 2 ** Math.max(0, attempt - 1));
}

/** Intervalo do ciclo de atualização: 30 s com a aba à vista, 2 min em segundo plano. */
export function pollIntervalMs(visible: boolean): number {
  return visible ? POLL_VISIBLE_MS : POLL_HIDDEN_MS;
}
