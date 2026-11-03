import type { KeyValueStore } from '../services/store';
import { compareNewsVersions } from './entries';

export const NEWS_SEEN_PREFIX = 'lords.newsSeen:';
export const newsSeenKey = (accountId: string) => `${NEWS_SEEN_PREFIX}${accountId}`;

/** Marca local por conta. A memória mantém a leitura nesta aba se o armazenamento falhar. */
export class NewsReadState {
  private seen = new Map<string, string>();

  constructor(private readonly store: KeyValueStore) {}

  private lastSeen(accountId: string): string | null {
    let saved: unknown;
    try {
      saved = this.store.get<unknown>(newsSeenKey(accountId));
    } catch {
      // O navegador pode negar até uma leitura; a página continua disponível.
    }
    const stored =
      typeof saved === 'string' && compareNewsVersions(saved, saved) === 0 ? saved : null;
    const memory = this.seen.get(accountId) ?? null;
    if (memory === null) return stored;
    return stored !== null && (compareNewsVersions(stored, memory) ?? 0) > 0 ? stored : memory;
  }

  hasUnread(accountId: string, version: string): boolean {
    const seen = this.lastSeen(accountId);
    return seen === null || (compareNewsVersions(seen, version) ?? -1) < 0;
  }

  async markRead(accountId: string, version: string): Promise<boolean> {
    if (!this.hasUnread(accountId, version)) return false;
    this.seen.set(accountId, version);
    try {
      await this.store.update(newsSeenKey(accountId), version);
    } catch {
      // A marca em memória basta até fechar esta aba.
    }
    return true;
  }

  /** Sair, excluir ou perder a sessão limpa os dados locais da conta, como o cache. */
  async forget(accountId: string): Promise<void> {
    this.seen.delete(accountId);
    try {
      await this.store.update(newsSeenKey(accountId), undefined);
    } catch {
      // Sem acesso ao armazenamento, nada mais pode ser apagado nesta aba.
    }
  }
}
