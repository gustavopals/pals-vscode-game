import { and, eq } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';

import { sessionRevoked, unauthorized } from '../api-error';
import { verifyAccessToken } from '../auth/tokens';
import type { AppContext } from '../context';
import { accounts, sessions } from '../db/schema';

export type Identity = { accountId: string; sessionId: string };

const LAST_SEEN_EVERY_MS = 5 * 60 * 1000;

export function bearerToken(request: FastifyRequest): string | null {
  const header = request.headers.authorization;
  const match = header === undefined ? null : /^Bearer\s+(\S+)$/i.exec(header);
  return match?.[1] ?? null;
}

/**
 * Autoriza a requisição: valida o JWT e, em seguida, consulta conta e sessão no banco.
 *
 * Não há cache positivo de autorização na v0.1 (ADR 0005): depois do commit de um logout, de um
 * reuso de refresh token ou de uma exclusão, a próxima requisição é recusada em qualquer instância.
 * Token ausente, inválido ou expirado recebe `UNAUTHORIZED` (o cliente pode renovar); sessão
 * revogada ou conta excluída recebe `SESSION_REVOKED` (renovar não adianta).
 */
export async function requireIdentity(ctx: AppContext, request: FastifyRequest): Promise<Identity> {
  const token = bearerToken(request);
  if (token === null) {
    throw unauthorized();
  }
  const now = ctx.clock();
  const claims = await verifyAccessToken(ctx.config, token, now);
  if (claims === null) {
    throw unauthorized();
  }

  const [row] = await ctx.db
    .select({
      revokedAt: sessions.revokedAt,
      expiresAt: sessions.expiresAt,
      deletedAt: accounts.deletedAt,
      lastSeenAt: accounts.lastSeenAt,
    })
    .from(sessions)
    .innerJoin(accounts, eq(accounts.id, sessions.accountId))
    .where(and(eq(sessions.id, claims.sessionId), eq(sessions.accountId, claims.accountId)));
  if (row === undefined) {
    // Sessão de outra conta, ou já removida pelo expurgo.
    throw sessionRevoked();
  }
  if (row.deletedAt !== null || row.revokedAt !== null) {
    throw sessionRevoked();
  }
  if (row.expiresAt.getTime() <= now.getTime()) {
    throw unauthorized();
  }
  if (now.getTime() - row.lastSeenAt.getTime() >= LAST_SEEN_EVERY_MS) {
    await ctx.db.update(accounts).set({ lastSeenAt: now }).where(eq(accounts.id, claims.accountId));
  }
  return claims;
}

/** Como `requireIdentity`, mas aceita a ausência de credencial. Uma credencial inválida ainda falha. */
export async function optionalIdentity(
  ctx: AppContext,
  request: FastifyRequest,
): Promise<Identity | null> {
  return request.headers.authorization === undefined ? null : requireIdentity(ctx, request);
}
