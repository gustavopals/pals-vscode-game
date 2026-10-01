import type { StoredTokens, TokenStore } from '@lotg/client-sdk';

import type { SecretStore } from './store';

/**
 * Guarda as credenciais no `SecretStorage` do VS Code, e em nenhum outro lugar (GDD §14.14).
 * Uma entrada por servidor: trocar `lords.serverUrl` não mistura sessões.
 */
export function secretTokenStore(secrets: SecretStore, serverUrl: string): TokenStore {
  const key = `lords.tokens:${serverUrl}`;
  return {
    get: async () => {
      const raw = await secrets.get(key);
      if (raw === undefined) {
        return null;
      }
      try {
        const parsed = JSON.parse(raw) as Partial<StoredTokens>;
        return typeof parsed.accessToken === 'string' && typeof parsed.refreshToken === 'string'
          ? { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken }
          : null;
      } catch {
        return null;
      }
    },
    set: async (tokens) => {
      await secrets.store(key, JSON.stringify(tokens));
    },
    clear: async () => {
      await secrets.delete(key);
    },
  };
}
