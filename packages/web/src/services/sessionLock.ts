import { TOKENS_KEY } from './browserStore';

/** O que se usa da Web Locks API (`navigator.locks`). */
export type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
};

export const REFRESH_LOCK = 'lords.refresh';

/**
 * Exclusão entre abas para a renovação da sessão (ADR 0008). Todas as abas dividem o mesmo
 * refresh token, que só pode ser usado uma vez: com o lock, uma aba renova e as outras, ao
 * entrarem, encontram os tokens novos no armazenamento. `settle` roda já dentro do lock, antes
 * de a tarefa reler os tokens (ver `storageSettle`). Sem a Web Locks API, a tarefa roda direto,
 * e vale a releitura do `TokenStore` que o SDK já faz.
 */
export function refreshLock(
  locks: LockManagerLike | undefined,
  settle: () => Promise<void> = async () => {},
): <T>(task: () => Promise<T>) => Promise<T> {
  if (locks === undefined) {
    return (task) => task();
  }
  return (task) =>
    locks.request(REFRESH_LOCK, async () => {
      await settle();
      return task();
    });
}

type StorageTarget = {
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
};

/** Quanto esperar, no máximo, pela gravação de outra aba. */
export const STORAGE_SETTLE_MS = 200;

/**
 * Espera a gravação dos tokens feita por outra aba chegar a esta. O navegador entrega o lock
 * e as mudanças do `localStorage` por caminhos diferentes: a aba que acabou de receber o lock
 * pode ainda ler os tokens antigos e reapresentar um refresh token já usado, o que o servidor
 * trata como reuso e encerra a sessão de todas as abas. A espera termina assim que o evento
 * `storage` dos tokens chega, ou depois de `maxMs` (ninguém mais renovou).
 */
export function storageSettle(
  target: StorageTarget,
  timers: {
    setTimeout: (callback: () => void, ms: number) => unknown;
    clearTimeout: (handle: never) => void;
  },
  maxMs = STORAGE_SETTLE_MS,
): () => Promise<void> {
  return () =>
    new Promise<void>((resolve) => {
      const done = () => {
        target.removeEventListener('storage', listener);
        timers.clearTimeout(timer as never);
        resolve();
      };
      const listener = (event: StorageEvent) => {
        if (event.key === TOKENS_KEY || event.key === null) {
          done();
        }
      };
      target.addEventListener('storage', listener);
      const timer = timers.setTimeout(done, maxMs);
    });
}
