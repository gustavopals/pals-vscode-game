import { STORAGE_PREFIX, TOKENS_KEY } from './browserStore';
import { NEWS_SEEN_PREFIX } from '../news/readState';

/** O que outra aba mudou no armazenamento, no que interessa a esta. */
export type TabChange =
  /** A sessão acabou em outra aba: saiu, excluiu a conta ou a sessão foi revogada. */
  | { kind: 'signedOut' }
  /** Outra aba entrou em uma conta, trocou de conta ou fundou outro feudo. */
  | { kind: 'account' }
  | { kind: 'preferences' }
  | { kind: 'newsRead'; accountId: string };

export const PREFERENCES_KEY = `${STORAGE_PREFIX}preferences`;
const ACCOUNT_KEY_PREFIX = `${STORAGE_PREFIX}account:`;

/**
 * Traduz um evento `storage` do navegador (que só chega às *outras* abas). `key` nulo é o
 * armazenamento inteiro apagado: a sessão foi junto.
 */
export function classifyStorageEvent(event: {
  key: string | null;
  newValue: string | null;
}): TabChange | null {
  if (event.key === null) {
    return { kind: 'signedOut' };
  }
  if (event.key === TOKENS_KEY) {
    // A renovação troca os tokens por outros; só o sumiço deles é o fim da sessão.
    return event.newValue === null ? { kind: 'signedOut' } : null;
  }
  if (event.key.startsWith(ACCOUNT_KEY_PREFIX)) {
    return event.newValue === null ? { kind: 'signedOut' } : { kind: 'account' };
  }
  if (event.key === PREFERENCES_KEY) {
    return { kind: 'preferences' };
  }
  if (event.key.startsWith(NEWS_SEEN_PREFIX)) {
    return { kind: 'newsRead', accountId: event.key.slice(NEWS_SEEN_PREFIX.length) };
  }
  return null;
}

type StorageTarget = {
  addEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
  removeEventListener(type: 'storage', listener: (event: StorageEvent) => void): void;
};

/** Avisa das mudanças feitas por outras abas. Devolve a função que cancela. */
export function watchOtherTabs(
  target: StorageTarget,
  onChange: (change: TabChange) => void,
): () => void {
  const listener = (event: StorageEvent) => {
    const change = classifyStorageEvent(event);
    if (change !== null) {
      onChange(change);
    }
  };
  target.addEventListener('storage', listener);
  return () => target.removeEventListener('storage', listener);
}
