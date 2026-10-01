import { randomUUID } from 'node:crypto';

import type {
  Account,
  AccountConflictDetails,
  AuthResponse,
  DeleteMeResponse,
  GithubAuthResponse,
  TokenPair,
} from '@lotg/protocol';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { ApiError, notFound, sessionRevoked, unauthorized } from '../api-error';
import type { AppContext } from '../context';
import { isUniqueViolation, type Tx } from '../db/client';
import { type AccountRow, accounts, commands, games, refreshTokens, sessions } from '../db/schema';
import {
  formatRecoveryCode,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from './recovery';
import { hashRefreshToken, newRefreshToken, SESSION_TTL_MS, signAccessToken } from './tokens';

/** Carência entre o bloqueio da conta e a remoção física dos dados. */
export const PURGE_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

export function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    displayName: row.displayName,
    linked: { github: row.githubId !== null },
    hasRecoveryCode: row.recoveryCodeHash !== null,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Trava a linha da conta. Devolve `null` se não existe ou se já foi excluída.
 *
 * O lock é `FOR NO KEY UPDATE`: serializa tudo que mexe na conta, mas não bloqueia o `KEY SHARE`
 * que o PostgreSQL toma ao inserir um comando que referencia a conta. Um comando trava a partida
 * e depois insere o recibo; uma exclusão trava a conta e depois arquiva as partidas. Com
 * `FOR UPDATE` aqui, os dois se esperariam para sempre.
 */
async function lockLiveAccount(tx: Tx, accountId: string): Promise<AccountRow | null> {
  const [row] = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.id, accountId))
    .for('no key update');
  return row === undefined || row.deletedAt !== null ? null : row;
}

type NewSession = { sessionId: string; expiresAt: Date; refreshToken: string };

/** Abre uma sessão (uma família de refresh tokens) para uma conta já travada e viva. */
async function createSession(
  tx: Tx,
  accountId: string,
  deviceLabel: string | undefined,
  now: Date,
): Promise<NewSession> {
  const sessionId = randomUUID();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const refresh = newRefreshToken();
  await tx.insert(sessions).values({
    id: sessionId,
    accountId,
    deviceLabel: deviceLabel ?? null,
    createdAt: now,
    expiresAt,
  });
  await tx.insert(refreshTokens).values({ tokenHash: refresh.hash, sessionId, createdAt: now });
  return { sessionId, expiresAt, refreshToken: refresh.token };
}

async function tokenPair(
  ctx: AppContext,
  accountId: string,
  session: NewSession,
  now: Date,
): Promise<TokenPair> {
  const access = await signAccessToken(
    ctx.config,
    { accountId, sessionId: session.sessionId },
    now,
    session.expiresAt,
  );
  return { ...access, refreshToken: session.refreshToken };
}

/** `POST /auth/anonymous`: conta, sessão e primeiro refresh token nascem na mesma transação. */
export async function createAnonymousAccount(
  ctx: AppContext,
  input: { displayName: string; deviceLabel?: string | undefined },
): Promise<AuthResponse> {
  const now = ctx.clock();
  const { account, session } = await ctx.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(accounts)
      .values({ id: randomUUID(), displayName: input.displayName, createdAt: now, lastSeenAt: now })
      .returning();
    if (row === undefined) {
      throw new Error('A conta não foi criada.');
    }
    return { account: row, session: await createSession(tx, row.id, input.deviceLabel, now) };
  });
  return { account: toAccount(account), ...(await tokenPair(ctx, account.id, session, now)) };
}

type RotationOutcome =
  | { kind: 'rotated'; accountId: string; session: NewSession }
  | { kind: 'unauthorized' }
  | { kind: 'revoked' };

/**
 * `POST /auth/refresh`: troca o refresh token pelo sucessor, na mesma sessão.
 *
 * Trava conta e sessão, nessa ordem, e revalida tudo dentro da transação. Apresentar um token
 * já utilizado, mesmo depois de várias rotações, é sinal de roubo: a sessão inteira é revogada
 * e a revogação recebe commit antes do 401, por isso o desfecho sai da transação como valor
 * e não como exceção (ADR 0005).
 */
export async function rotateRefreshToken(
  ctx: AppContext,
  refreshToken: string,
): Promise<TokenPair> {
  const now = ctx.clock();
  const tokenHash = hashRefreshToken(refreshToken);

  const outcome = await ctx.db.transaction(async (tx): Promise<RotationOutcome> => {
    const [found] = await tx
      .select({ sessionId: refreshTokens.sessionId, accountId: sessions.accountId })
      .from(refreshTokens)
      .innerJoin(sessions, eq(sessions.id, refreshTokens.sessionId))
      .where(eq(refreshTokens.tokenHash, tokenHash));
    if (found === undefined) {
      return { kind: 'unauthorized' };
    }

    const account = await lockLiveAccount(tx, found.accountId);
    const [session] = await tx
      .select()
      .from(sessions)
      .where(eq(sessions.id, found.sessionId))
      .for('update');
    const [token] = await tx
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, tokenHash))
      .for('update');
    if (session === undefined || token === undefined) {
      return { kind: 'unauthorized' };
    }
    if (account === null || session.revokedAt !== null) {
      return { kind: 'revoked' };
    }
    if (session.expiresAt.getTime() <= now.getTime()) {
      return { kind: 'unauthorized' };
    }
    if (token.usedAt !== null) {
      await tx.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, session.id));
      return { kind: 'revoked' };
    }

    const successor = newRefreshToken();
    await tx
      .update(refreshTokens)
      .set({ usedAt: now })
      .where(eq(refreshTokens.tokenHash, tokenHash));
    await ctx.hooks.afterRefreshTokenUsed?.();
    await tx
      .insert(refreshTokens)
      .values({ tokenHash: successor.hash, sessionId: session.id, createdAt: now });
    return {
      kind: 'rotated',
      accountId: session.accountId,
      session: {
        sessionId: session.id,
        expiresAt: session.expiresAt,
        refreshToken: successor.token,
      },
    };
  });

  if (outcome.kind === 'unauthorized') {
    throw unauthorized();
  }
  if (outcome.kind === 'revoked') {
    throw sessionRevoked();
  }
  return tokenPair(ctx, outcome.accountId, outcome.session, now);
}

/** `POST /auth/logout`: revoga só a sessão desta máquina. */
export async function revokeSession(ctx: AppContext, sessionId: string): Promise<void> {
  await ctx.db
    .update(sessions)
    .set({ revokedAt: ctx.clock() })
    .where(and(eq(sessions.id, sessionId), isNull(sessions.revokedAt)));
}

export async function getAccount(ctx: AppContext, accountId: string): Promise<Account> {
  const [row] = await ctx.db
    .select()
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
  if (row === undefined) {
    throw notFound('Conta');
  }
  return toAccount(row);
}

export async function renameAccount(
  ctx: AppContext,
  accountId: string,
  displayName: string,
): Promise<Account> {
  const [row] = await ctx.db
    .update(accounts)
    .set({ displayName })
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
    .returning();
  if (row === undefined) {
    throw notFound('Conta');
  }
  return toAccount(row);
}

/**
 * Primeira etapa da exclusão, sobre uma conta já travada: grava `deleted_at`, revoga todas as
 * sessões, apaga as credenciais de recuperação e de vínculo e arquiva as partidas. A partir do
 * commit a conta não entra por nenhuma credencial. A remoção física fica para o job (§14.7).
 */
async function markAccountDeleted(tx: Tx, accountId: string, now: Date): Promise<void> {
  await tx
    .update(accounts)
    .set({ deletedAt: now, recoveryCodeHash: null, githubId: null })
    .where(eq(accounts.id, accountId));
  await tx
    .update(sessions)
    .set({ revokedAt: now })
    .where(and(eq(sessions.accountId, accountId), isNull(sessions.revokedAt)));
  await tx
    .update(games)
    .set({ status: 'archived', updatedAt: now })
    .where(and(eq(games.accountId, accountId), eq(games.status, 'active')));
}

/** `DELETE /me`: bloqueio imediato e expurgo agendado para sete dias depois. */
export async function deleteAccount(ctx: AppContext, accountId: string): Promise<DeleteMeResponse> {
  const now = ctx.clock();
  await ctx.db.transaction(async (tx) => {
    if ((await lockLiveAccount(tx, accountId)) === null) {
      throw sessionRevoked();
    }
    await markAccountDeleted(tx, accountId, now);
  });
  return {
    deletedAt: now.toISOString(),
    purgeAfter: new Date(now.getTime() + PURGE_AFTER_MS).toISOString(),
  };
}

/**
 * `POST /auth/recovery-code`: gera ou rotaciona o Código do Reino. O código em claro só existe
 * nesta resposta; o banco guarda o HMAC. O código anterior deixa de valer; as sessões continuam.
 */
export async function rotateRecoveryCode(ctx: AppContext, accountId: string): Promise<string> {
  // Uma colisão de HMAC é improvável a ponto de nunca acontecer; ainda assim, gera outro código.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = generateRecoveryCode();
    const hash = hashRecoveryCode(ctx.config.recoveryCodeSecret, code);
    try {
      await ctx.db.transaction(async (tx) => {
        if ((await lockLiveAccount(tx, accountId)) === null) {
          throw sessionRevoked();
        }
        await tx.update(accounts).set({ recoveryCodeHash: hash }).where(eq(accounts.id, accountId));
      });
      return formatRecoveryCode(code);
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
    }
  }
  throw new ApiError('INTERNAL', 'Não foi possível gerar o Código do Reino. Tente de novo.');
}

/**
 * `POST /auth/recover`: entra em outra máquina com o Código do Reino. Código malformado,
 * desconhecido ou de conta excluída recebem a mesma resposta, sem revelar qual foi o caso.
 */
export async function recoverAccount(
  ctx: AppContext,
  input: { code: string; deviceLabel?: string | undefined },
): Promise<AuthResponse> {
  const normalized = normalizeRecoveryCode(input.code);
  if (normalized === null) {
    throw unauthorized();
  }
  const hash = hashRecoveryCode(ctx.config.recoveryCodeSecret, normalized);
  const now = ctx.clock();

  const result = await ctx.db.transaction(async (tx) => {
    const [found] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(eq(accounts.recoveryCodeHash, hash));
    if (found === undefined) {
      return null;
    }
    // Revalida sob lock: o código pode ter sido rotacionado, ou a conta excluída, nesse meio-tempo.
    const account = await lockLiveAccount(tx, found.id);
    if (account === null || account.recoveryCodeHash !== hash) {
      return null;
    }
    return { account, session: await createSession(tx, account.id, input.deviceLabel, now) };
  });

  if (result === null) {
    throw unauthorized();
  }
  return {
    account: toAccount(result.account),
    ...(await tokenPair(ctx, result.account.id, result.session, now)),
  };
}

async function hasProgress(tx: Tx, accountId: string): Promise<boolean> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)`.mapWith(Number) })
    .from(commands)
    .where(eq(commands.accountId, accountId));
  return (row?.count ?? 0) > 0;
}

type GithubOutcome =
  | { kind: 'linked'; account: AccountRow }
  | { kind: 'signedIn'; account: AccountRow; session: NewSession }
  | { kind: 'conflict'; details: AccountConflictDetails }
  | { kind: 'unknown' }
  | { kind: 'revoked' };

/**
 * `POST /auth/github`: vincula a conta atual ao GitHub ou entra em uma conta já vinculada.
 *
 * - com sessão e `github_id` livre: vincula;
 * - sem sessão e `github_id` conhecido: abre uma sessão nessa conta;
 * - com sessão e `github_id` de outra conta: `409 ACCOUNT_CONFLICT`, até o jogador escolher
 *   `useExisting` (a conta atual é excluída) ou `keepCurrent` (o vínculo migra para a atual).
 *
 * Os estados das duas contas nunca são mesclados.
 */
export async function linkOrSignInWithGithub(
  ctx: AppContext,
  input: {
    githubId: string;
    currentAccountId: string | null;
    deviceLabel?: string | undefined;
    resolve?: 'useExisting' | 'keepCurrent' | undefined;
  },
): Promise<GithubAuthResponse> {
  const now = ctx.clock();
  const { githubId, currentAccountId } = input;

  const attempt = () =>
    ctx.db.transaction(async (tx): Promise<GithubOutcome> => {
      const [owner] = await tx
        .select({ id: accounts.id })
        .from(accounts)
        .where(and(eq(accounts.githubId, githubId), isNull(accounts.deletedAt)));

      // Trava as contas envolvidas em ordem de id, para duas chamadas cruzadas não se travarem.
      const ids = [...new Set([currentAccountId, owner?.id ?? null])]
        .filter((id): id is string => id !== null)
        .sort();
      const locked = new Map<string, AccountRow | null>();
      for (const id of ids) {
        locked.set(id, await lockLiveAccount(tx, id));
      }

      const current = currentAccountId === null ? null : (locked.get(currentAccountId) ?? null);
      const lockedOwner = owner === undefined ? null : (locked.get(owner.id) ?? null);
      // O vínculo pode ter mudado entre a busca e o lock.
      const existing = lockedOwner?.githubId === githubId ? lockedOwner : null;

      if (currentAccountId === null) {
        if (existing === null) {
          return { kind: 'unknown' };
        }
        const session = await createSession(tx, existing.id, input.deviceLabel, now);
        return { kind: 'signedIn', account: existing, session };
      }
      if (current === null) {
        return { kind: 'revoked' };
      }
      if (existing === null || existing.id === current.id) {
        const [updated] = await tx
          .update(accounts)
          .set({ githubId })
          .where(eq(accounts.id, current.id))
          .returning();
        return { kind: 'linked', account: updated ?? current };
      }

      if (input.resolve === 'useExisting') {
        await markAccountDeleted(tx, current.id, now);
        const session = await createSession(tx, existing.id, input.deviceLabel, now);
        return { kind: 'signedIn', account: existing, session };
      }
      if (input.resolve === 'keepCurrent') {
        await tx.update(accounts).set({ githubId: null }).where(eq(accounts.id, existing.id));
        const [updated] = await tx
          .update(accounts)
          .set({ githubId })
          .where(eq(accounts.id, current.id))
          .returning();
        return { kind: 'linked', account: updated ?? current };
      }
      return {
        kind: 'conflict',
        details: {
          existingDisplayName: existing.displayName,
          currentHasProgress: await hasProgress(tx, current.id),
        },
      };
    });

  // Duas contas vinculando o mesmo GitHub ao mesmo tempo: a segunda esbarra na unicidade de
  // `github_id`. Na nova tentativa ela já enxerga a dona do vínculo e recebe o conflito normal.
  const outcome = await attempt().catch((error: unknown) => {
    if (isUniqueViolation(error)) {
      return attempt();
    }
    throw error;
  });

  switch (outcome.kind) {
    case 'linked':
      return { account: toAccount(outcome.account) };
    case 'signedIn':
      return {
        account: toAccount(outcome.account),
        ...(await tokenPair(ctx, outcome.account.id, outcome.session, now)),
      };
    case 'conflict':
      throw new ApiError(
        'ACCOUNT_CONFLICT',
        'Este GitHub já está vinculado a outro feudo. Escolha qual manter.',
        outcome.details,
      );
    case 'unknown':
      throw new ApiError('NOT_FOUND', 'Nenhum feudo está vinculado a esta conta do GitHub.');
    case 'revoked':
      throw sessionRevoked();
  }
}
