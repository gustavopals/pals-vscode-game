import { and, isNotNull, lt, lte } from 'drizzle-orm';

import { PURGE_AFTER_MS } from '../auth/service';
import type { AppContext } from '../context';
import { accounts, sessions } from '../db/schema';

/**
 * Segunda etapa da exclusão: remove do banco as contas bloqueadas há sete dias ou mais.
 * O `ON DELETE CASCADE` leva junto sessões, hashes de refresh, partidas, comandos e recibos,
 * eventos e Crônicas. Reexecutar não tem efeito.
 *
 * Também limpa sessões cuja validade absoluta já passou, com todo o seu histórico de refresh.
 * Os antecessores de uma sessão ainda válida nunca são apagados: é com eles que o reuso é detectado.
 */
export async function purgeAccounts(
  ctx: AppContext,
): Promise<{ accounts: number; sessions: number }> {
  const now = ctx.clock();
  const purgeBefore = new Date(now.getTime() - PURGE_AFTER_MS);
  const purged = await ctx.db
    .delete(accounts)
    .where(and(isNotNull(accounts.deletedAt), lte(accounts.deletedAt, purgeBefore)))
    .returning({ id: accounts.id });
  const expired = await ctx.db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return { accounts: purged.length, sessions: expired.length };
}
