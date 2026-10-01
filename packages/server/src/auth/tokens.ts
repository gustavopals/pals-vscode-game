import { createHash, randomBytes } from 'node:crypto';

import { jwtVerify, SignJWT } from 'jose';

import type { Config } from '../config';

export const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000;
/** Validade absoluta de uma sessão. A rotação do refresh token não a prorroga. */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type AccessClaims = { accountId: string; sessionId: string };

/**
 * Access token: JWT HS256 com `sub` = conta, `sid` = sessão e `iss` = PUBLIC_URL.
 * Vale até 15 minutos e nunca passa da expiração da sessão.
 */
export async function signAccessToken(
  config: Config,
  claims: AccessClaims,
  now: Date,
  sessionExpiresAt: Date,
): Promise<{ accessToken: string; expiresIn: number }> {
  const issuedAt = Math.floor(now.getTime() / 1000);
  const expiresAtMs = Math.min(now.getTime() + ACCESS_TOKEN_TTL_MS, sessionExpiresAt.getTime());
  const expiresAt = Math.floor(expiresAtMs / 1000);
  const accessToken = await new SignJWT({ sid: claims.sessionId })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.accountId)
    .setIssuer(config.publicUrl)
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(config.jwtSecret);
  return { accessToken, expiresIn: Math.max(1, expiresAt - issuedAt) };
}

/** Confere assinatura, emissor e expiração. Devolve `null` para qualquer token inválido. */
export async function verifyAccessToken(
  config: Config,
  token: string,
  now: Date,
): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, config.jwtSecret, {
      algorithms: ['HS256'],
      issuer: config.publicUrl,
      currentDate: now,
      requiredClaims: ['sub', 'sid', 'exp'],
    });
    if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
      return null;
    }
    return { accountId: payload.sub, sessionId: payload.sid };
  } catch {
    return null;
  }
}

/** Refresh token: 32 bytes aleatórios em base64url. O banco só guarda o SHA-256. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url');
  return { token, hash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
