/** As duas credenciais de uma sessão. São sempre guardadas e substituídas juntas. */
export type StoredTokens = { accessToken: string; refreshToken: string };

/**
 * Onde as credenciais ficam. O app web implementa com o armazenamento do navegador;
 * o `sim-cli` e os testes, em memória.
 */
export type TokenStore = {
  get(): Promise<StoredTokens | null>;
  set(tokens: StoredTokens): Promise<void>;
  clear(): Promise<void>;
};

export function memoryTokenStore(initial: StoredTokens | null = null): TokenStore {
  let current = initial;
  return {
    get: async () => current,
    set: async (tokens) => {
      current = tokens;
    },
    clear: async () => {
      current = null;
    },
  };
}
