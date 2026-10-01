import type { StoredTokens, TokenStore } from '@lotg/client-sdk';

import type { KeyValueStore } from './store';

/** O que se usa do `Storage` do navegador. */
export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;

/** Tudo o que o app guarda no navegador começa com este prefixo. */
export const STORAGE_PREFIX = 'lords.';
export const TOKENS_KEY = `${STORAGE_PREFIX}tokens`;

const prefixed = (key: string) => (key.startsWith(STORAGE_PREFIX) ? key : STORAGE_PREFIX + key);

/** Um `Storage` em memória: vale só enquanto a aba estiver aberta. */
export function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    key: (index) => [...data.keys()][index] ?? null,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
    removeItem: (key) => {
      data.delete(key);
    },
  };
}

/**
 * O `localStorage`, ou um substituto em memória quando o navegador o nega (modo privado antigo,
 * armazenamento desligado). Só o acesso à propriedade já pode lançar.
 */
export function openStorage(open: () => StorageLike | undefined): {
  storage: StorageLike;
  persistent: boolean;
} {
  try {
    const storage = open();
    if (storage !== undefined) {
      const probe = `${STORAGE_PREFIX}probe`;
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return { storage, persistent: true };
    }
  } catch {
    // Cai no substituto abaixo.
  }
  return { storage: memoryStorage(), persistent: false };
}

/**
 * `KeyValueStore` sobre o armazenamento do navegador. Os valores vão como JSON. Uma gravação que
 * falha (cota cheia) não derruba o app: o valor fica em memória até a aba fechar.
 */
export function browserStore(storage: StorageLike): KeyValueStore {
  const overlay = new Map<string, string | null>();

  const read = (key: string): string | null => {
    if (overlay.has(key)) {
      return overlay.get(key) ?? null;
    }
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  return {
    keys: () => {
      const names = new Set<string>();
      try {
        for (let index = 0; index < storage.length; index += 1) {
          const name = storage.key(index);
          if (name !== null && name.startsWith(STORAGE_PREFIX)) {
            names.add(name);
          }
        }
      } catch {
        // Sem acesso ao armazenamento, vale só o que está em memória.
      }
      for (const [name, value] of overlay) {
        if (value === null) {
          names.delete(name);
        } else {
          names.add(name);
        }
      }
      return [...names];
    },
    get: <T>(key: string) => {
      const raw = read(prefixed(key));
      if (raw === null) {
        return undefined;
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        // Valor corrompido ou gravado por outra coisa: é como se não existisse.
        return undefined;
      }
    },
    update: async (key, value) => {
      const name = prefixed(key);
      try {
        if (value === undefined) {
          storage.removeItem(name);
        } else {
          storage.setItem(name, JSON.stringify(value));
        }
        overlay.delete(name);
      } catch {
        overlay.set(name, value === undefined ? null : JSON.stringify(value));
      }
    },
  };
}

function parseTokens(value: unknown): StoredTokens | null {
  const parsed = value as Partial<StoredTokens> | null | undefined;
  return typeof parsed?.accessToken === 'string' && typeof parsed.refreshToken === 'string'
    ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
    : null;
}

/**
 * As credenciais no armazenamento do navegador (ADR 0008, ponto 1). Cada leitura vai ao
 * armazenamento: é assim que uma aba encontra os tokens que outra acabou de renovar.
 */
export function browserTokenStore(storage: StorageLike): TokenStore {
  const store = browserStore(storage);
  return {
    get: async () => parseTokens(store.get(TOKENS_KEY)),
    set: async (tokens) => {
      await store.update(TOKENS_KEY, tokens);
    },
    clear: async () => {
      await store.update(TOKENS_KEY, undefined);
    },
  };
}
