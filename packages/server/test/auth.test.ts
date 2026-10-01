import { createHash, randomBytes } from 'node:crypto';

import type {
  Account,
  ApiError,
  AuthResponse,
  DeleteMeResponse,
  RecoveryCodeResponse,
  TokenPair,
} from '@lotg/protocol';
import {
  AccountSchema,
  ApiErrorSchema,
  AuthResponseSchema,
  DeleteMeResponseSchema,
  TokenPairSchema,
} from '@lotg/protocol';
import { decodeJwt, decodeProtectedHeader, SignJWT } from 'jose';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  DAY,
  fakeClock,
  type FakeClock,
  MINUTE,
  newPlayer,
  type Reply,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Verificação independente de F2-T4 (GDD §14.5 e §14.7, ADR 0005): os cenários abaixo saem da
// documentação, não do código do servidor.

const PUBLIC_URL = 'http://localhost:3000';
const SECOND = 1000;
const ACCESS_TTL_S = 15 * 60;

type SessionRow = {
  id: string;
  account_id: string;
  created_at: Date;
  expires_at: Date;
  revoked_at: Date | null;
};
type RefreshRow = {
  token_hash: string;
  session_id: string;
  created_at: Date;
  used_at: Date | null;
};
type AccountRow = {
  id: string;
  display_name: string;
  recovery_code_hash: string | null;
  last_seen_at: Date;
  deleted_at: Date | null;
};

const sha256Hex = (value: string): string => createHash('sha256').update(value).digest('hex');

/** `sid` do access token: a sessão (família) a que ele pertence. */
function sessionIdOf(accessToken: string): string {
  const { sid } = decodeJwt(accessToken);
  if (typeof sid !== 'string') {
    throw new Error('O access token não trouxe o claim `sid`.');
  }
  return sid;
}

async function sessionRow(server: TestApp, sessionId: string): Promise<SessionRow> {
  const { rows } = await server.pool.query<SessionRow>('select * from sessions where id = $1', [
    sessionId,
  ]);
  const row = rows[0];
  if (!row) {
    throw new Error(`Sessão ${sessionId} não encontrada.`);
  }
  return row;
}

async function accountRow(server: TestApp, accountId: string): Promise<AccountRow> {
  const { rows } = await server.pool.query<AccountRow>('select * from accounts where id = $1', [
    accountId,
  ]);
  const row = rows[0];
  if (!row) {
    throw new Error(`Conta ${accountId} não encontrada.`);
  }
  return row;
}

async function refreshRows(server: TestApp, sessionId: string): Promise<RefreshRow[]> {
  const { rows } = await server.pool.query<RefreshRow>(
    'select * from refresh_tokens where session_id = $1 order by created_at, token_hash',
    [sessionId],
  );
  return rows;
}

/** Fotografia de sessões e refresh tokens, para provar que uma chamada não alterou nada. */
async function authSnapshot(server: TestApp): Promise<string> {
  const sessions = await server.pool.query('select * from sessions order by id');
  const tokens = await server.pool.query('select * from refresh_tokens order by token_hash');
  return JSON.stringify({ sessions: sessions.rows, tokens: tokens.rows });
}

function refresh(
  target: TestApp,
  refreshToken: string,
): Promise<Reply<TokenPair & Partial<ApiError>>> {
  return call(target, 'POST', '/auth/refresh', { body: { refreshToken } });
}

function me(target: TestApp, token: string): Promise<Reply<Account & Partial<ApiError>>> {
  return call(target, 'GET', '/me', { token });
}

/** Rotaciona e exige sucesso. */
async function rotate(target: TestApp, refreshToken: string): Promise<TokenPair> {
  const reply = await refresh(target, refreshToken);
  if (reply.status !== 200) {
    throw new Error(`Rotação recusada: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
  return reply.body;
}

/** Gera o Código do Reino da conta dona do token. */
async function recoveryCode(target: TestApp, token: string): Promise<string> {
  const reply = await call<RecoveryCodeResponse>(target, 'POST', '/auth/recovery-code', { token });
  if (reply.status >= 300 || typeof reply.body.code !== 'string') {
    throw new Error(`Falha ao gerar o Código do Reino: ${reply.status}`);
  }
  return reply.body.code;
}

/** "Outra máquina": abre uma segunda sessão da mesma conta pelo Código do Reino. */
async function secondSession(target: TestApp, token: string): Promise<AuthResponse> {
  const code = await recoveryCode(target, token);
  const reply = await call<AuthResponse>(target, 'POST', '/auth/recover', {
    body: { code, deviceLabel: 'outra máquina' },
  });
  if (reply.status >= 300 || typeof reply.body.accessToken !== 'string') {
    throw new Error(`Falha ao recuperar a conta: ${reply.status} ${JSON.stringify(reply.body)}`);
  }
  return reply.body;
}

function expectError(reply: Reply<unknown>, status: number, code: string): void {
  expect(reply.status).toBe(status);
  expect(ApiErrorSchema.safeParse(reply.body).error).toBeUndefined();
  expect((reply.body as ApiError).code).toBe(code);
}

/** Forja um JWT com a chave do servidor de teste, para exercitar a conferência de claims. */
function forge(
  server: TestApp,
  claims: { sub?: string; sid?: string; iss?: string; expMs: number },
  secret: Uint8Array = server.ctx.config.jwtSecret,
): Promise<string> {
  const builder = new SignJWT(claims.sid === undefined ? {} : { sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt(Math.floor(server.clock.now().getTime() / 1000))
    .setExpirationTime(Math.floor(claims.expMs / 1000));
  if (claims.sub !== undefined) {
    builder.setSubject(claims.sub);
  }
  if (claims.iss !== undefined) {
    builder.setIssuer(claims.iss);
  }
  return builder.sign(secret);
}

describe('autenticação: conta anônima, JWT, refresh rotativo e /me (F2-T4)', () => {
  let clock: FakeClock;
  let server: TestApp;
  /** Segunda réplica da API diante do mesmo banco e do mesmo relógio. */
  let replica: TestApp;

  beforeAll(async () => {
    await resetTestDb();
  });

  beforeEach(async () => {
    clock = fakeClock();
    server = await createTestApp({ clock });
    replica = await createTestApp({ clock });
    await truncateAll(server.pool);
  });

  afterEach(async () => {
    await server.close();
    await replica.close();
  });

  describe('criação de conta anônima', () => {
    it('responde 201 com conta e tokens, sem permitir cache', async () => {
      const reply = await call<AuthResponse>(server, 'POST', '/auth/anonymous', {
        body: { displayName: 'Gustavo', deviceLabel: 'notebook' },
      });
      expect(reply.status).toBe(201);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(AuthResponseSchema.safeParse(reply.body).error).toBeUndefined();
      expect(Object.keys(reply.body).sort()).toEqual([
        'accessToken',
        'account',
        'expiresIn',
        'refreshToken',
      ]);
      expect(reply.body.account).toEqual({
        id: reply.body.account.id,
        displayName: 'Gustavo',
        linked: { github: false },
        hasRecoveryCode: false,
        createdAt: clock.now().toISOString(),
      });
      expect(reply.body.expiresIn).toBe(ACCESS_TTL_S);
    });

    it('cria conta, sessão e o primeiro refresh token', async () => {
      const auth = await signUp(server);
      expect(await countRows(server.pool, 'accounts')).toBe(1);
      expect(await countRows(server.pool, 'sessions')).toBe(1);
      expect(await countRows(server.pool, 'refresh_tokens')).toBe(1);

      const account = await accountRow(server, auth.account.id);
      expect(account.display_name).toBe('Gustavo');
      expect(account.deleted_at).toBeNull();

      const session = await sessionRow(server, sessionIdOf(auth.accessToken));
      expect(session.account_id).toBe(auth.account.id);
      expect(session.revoked_at).toBeNull();
      expect(session.created_at.toISOString()).toBe(clock.now().toISOString());

      const [token] = await refreshRows(server, session.id);
      expect(token?.used_at).toBeNull();
    });

    it('o refresh token tem 32 bytes em base64url e o banco guarda só o SHA-256', async () => {
      const auth = await signUp(server);
      expect(auth.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Buffer.from(auth.refreshToken, 'base64url')).toHaveLength(32);

      const [row] = await refreshRows(server, sessionIdOf(auth.accessToken));
      expect(row?.token_hash).toBe(sha256Hex(auth.refreshToken));

      // Nenhuma coluna das tabelas de autenticação guarda o token em claro (nem o JWT).
      const dump = await server.pool.query<{ text: string }>(
        `select row_to_json(a)::text as text from accounts a
         union all select row_to_json(s)::text from sessions s
         union all select row_to_json(r)::text from refresh_tokens r`,
      );
      for (const { text } of dump.rows) {
        expect(text).not.toContain(auth.refreshToken);
        expect(text).not.toContain(auth.accessToken);
      }
    });

    it('recusa nomes fora de 2 a 24 caracteres sem criar nada', async () => {
      for (const displayName of ['A', ' A ', 'x'.repeat(25), '']) {
        const reply = await call(server, 'POST', '/auth/anonymous', { body: { displayName } });
        expectError(reply, 400, 'VALIDATION');
      }
      const missing = await call(server, 'POST', '/auth/anonymous', { body: {} });
      expectError(missing, 400, 'VALIDATION');
      expect(await countRows(server.pool, 'accounts')).toBe(0);
      expect(await countRows(server.pool, 'sessions')).toBe(0);

      for (const displayName of ['Ab', 'x'.repeat(24)]) {
        const reply = await call(server, 'POST', '/auth/anonymous', { body: { displayName } });
        expect(reply.status).toBe(201);
      }
    });

    it('cada conta nova recebe identidade, sessão e tokens próprios', async () => {
      const first = await signUp(server, 'Primeiro');
      const second = await signUp(server, 'Segundo');
      expect(second.account.id).not.toBe(first.account.id);
      expect(second.refreshToken).not.toBe(first.refreshToken);
      expect(sessionIdOf(second.accessToken)).not.toBe(sessionIdOf(first.accessToken));
    });
  });

  describe('access token (JWT)', () => {
    it('é HS256 com sub = conta, sid = sessão, iss = PUBLIC_URL e validade de 15 min', async () => {
      const auth = await signUp(server);
      expect(decodeProtectedHeader(auth.accessToken).alg).toBe('HS256');
      const claims = decodeJwt(auth.accessToken);
      expect(claims.sub).toBe(auth.account.id);
      expect(claims.iss).toBe(PUBLIC_URL);
      expect(await countRows(server.pool, 'sessions', `id = '${String(claims.sid)}'`)).toBe(1);
      const nowS = Math.floor(clock.now().getTime() / 1000);
      expect(claims.exp).toBe(nowS + ACCESS_TTL_S);
    });

    it('o emissor acompanha o PUBLIC_URL configurado', async () => {
      const other = await createTestApp({ clock, config: { PUBLIC_URL: 'https://lotg.exemplo' } });
      try {
        const auth = await signUp(other);
        expect(decodeJwt(auth.accessToken).iss).toBe('https://lotg.exemplo');
        expect((await me(other, auth.accessToken)).status).toBe(200);
        // Emitido para outro PUBLIC_URL: a instância padrão não aceita, mesmo com a mesma chave.
        expectError(await me(server, auth.accessToken), 401, 'UNAUTHORIZED');
      } finally {
        await other.close();
      }
    });

    it('vale até os 15 minutos e depois responde 401 UNAUTHORIZED', async () => {
      const auth = await signUp(server);
      clock.advance(14 * MINUTE + 59 * SECOND);
      expect((await me(server, auth.accessToken)).status).toBe(200);
      clock.advance(2 * SECOND);
      expectError(await me(server, auth.accessToken), 401, 'UNAUTHORIZED');
      expectError(await me(replica, auth.accessToken), 401, 'UNAUTHORIZED');

      // Expirar não revoga nada: o refresh token devolve o acesso.
      const renewed = await rotate(server, auth.refreshToken);
      expect((await me(server, renewed.accessToken)).status).toBe(200);
      expect((await sessionRow(server, sessionIdOf(auth.accessToken))).revoked_at).toBeNull();
    });

    it('a sessão expira em 30 dias exatos desde a criação', async () => {
      const createdAt = clock.now().getTime();
      const auth = await signUp(server);
      const session = await sessionRow(server, sessionIdOf(auth.accessToken));
      expect(session.expires_at.getTime()).toBe(createdAt + 30 * DAY);
    });

    it('a rotação não prorroga a sessão e o JWT nunca passa de sessions.expires_at', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const expiresAt = (await sessionRow(server, sessionId)).expires_at.getTime();

      // Dez dias depois, uma rotação: o prazo absoluto continua o mesmo.
      clock.advance(10 * DAY);
      const mid = await rotate(server, auth.refreshToken);
      expect(mid.expiresIn).toBe(ACCESS_TTL_S);
      expect((await sessionRow(server, sessionId)).expires_at.getTime()).toBe(expiresAt);

      // A cinco minutos do fim, o JWT novo é encurtado para caber na sessão.
      clock.set(new Date(expiresAt - 5 * MINUTE));
      const last = await rotate(server, mid.refreshToken);
      expect(sessionIdOf(last.accessToken)).toBe(sessionId);
      expect(decodeJwt(last.accessToken).exp).toBe(Math.floor(expiresAt / 1000));
      expect(last.expiresIn).toBe(5 * 60);
      expect((await sessionRow(server, sessionId)).expires_at.getTime()).toBe(expiresAt);
      expect((await me(server, last.accessToken)).status).toBe(200);

      // Passado o prazo absoluto, nem o JWT nem o refresh mais recente servem.
      clock.set(new Date(expiresAt + SECOND));
      expectError(await me(server, last.accessToken), 401, 'UNAUTHORIZED');
      expectError(await refresh(server, last.refreshToken), 401, 'UNAUTHORIZED');
      expectError(await refresh(replica, last.refreshToken), 401, 'UNAUTHORIZED');
    });

    it('refresh nunca usado também deixa de valer quando a sessão expira', async () => {
      const auth = await signUp(server);
      clock.advance(30 * DAY - MINUTE);
      const before = await authSnapshot(server);
      clock.advance(2 * MINUTE);
      expectError(await refresh(server, auth.refreshToken), 401, 'UNAUTHORIZED');
      // Sessão expirada não é reuso: nada é revogado nem consumido.
      expect(await authSnapshot(server)).toBe(before);
    });

    it('JWT com exp além da sessão não sobrevive à expiração da sessão', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const forged = await forge(server, {
        sub: auth.account.id,
        sid: sessionId,
        iss: PUBLIC_URL,
        expMs: clock.now().getTime() + 60 * DAY,
      });
      clock.advance(30 * DAY + MINUTE);
      const reply = await me(server, forged);
      expect(reply.status).toBe(401);
    });

    it('recusa requisição sem token, com esquema errado ou com lixo', async () => {
      expectError(await call(server, 'GET', '/me'), 401, 'UNAUTHORIZED');
      expectError(await me(server, 'isto-nao-e-um-jwt'), 401, 'UNAUTHORIZED');
      const auth = await signUp(server);
      const basic = await call(server, 'GET', '/me', {
        headers: { authorization: `Basic ${auth.accessToken}` },
      });
      expectError(basic, 401, 'UNAUTHORIZED');
      // O refresh token não serve como access token.
      expectError(await me(server, auth.refreshToken), 401, 'UNAUTHORIZED');
    });

    it('recusa token com assinatura inválida', async () => {
      const auth = await signUp(server);
      const [header, payload, signature] = auth.accessToken.split('.') as [string, string, string];

      // Assinatura adulterada.
      const flipped = Buffer.from(signature, 'base64url');
      flipped[0] = (flipped[0] ?? 0) ^ 0xff;
      const tampered = `${header}.${payload}.${flipped.toString('base64url')}`;
      expectError(await me(server, tampered), 401, 'UNAUTHORIZED');

      // Mesmos claims, assinados com outra chave.
      const claims = decodeJwt(auth.accessToken);
      const wrongKey = await forge(
        server,
        {
          sub: String(claims.sub),
          sid: String(claims.sid),
          iss: PUBLIC_URL,
          expMs: clock.now().getTime() + 10 * MINUTE,
        },
        new Uint8Array(randomBytes(48)),
      );
      expectError(await me(server, wrongKey), 401, 'UNAUTHORIZED');

      // Sem assinatura (alg none).
      const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      expectError(await me(server, `${none}.${payload}.`), 401, 'UNAUTHORIZED');

      // Conteúdo trocado mantendo a assinatura original.
      const other = await signUp(server, 'Invasor');
      const swapped = Buffer.from(JSON.stringify({ ...claims, sub: other.account.id })).toString(
        'base64url',
      );
      expectError(await me(server, `${header}.${swapped}.${signature}`), 401, 'UNAUTHORIZED');

      // O token legítimo continua valendo.
      expect((await me(server, auth.accessToken)).status).toBe(200);
    });

    it('recusa token bem assinado com emissor errado ou sem sub/sid', async () => {
      const auth = await signUp(server);
      const sid = sessionIdOf(auth.accessToken);
      const expMs = clock.now().getTime() + 10 * MINUTE;
      const cases = [
        { sub: auth.account.id, sid, iss: 'https://outro.exemplo', expMs },
        { sub: auth.account.id, sid, expMs },
        { sid, iss: PUBLIC_URL, expMs },
        { sub: auth.account.id, iss: PUBLIC_URL, expMs },
      ];
      for (const claims of cases) {
        const reply = await me(server, await forge(server, claims));
        expectError(reply, 401, 'UNAUTHORIZED');
      }
      // Controle: com todos os claims corretos, a mesma forja é aceita.
      const valid = await forge(server, { sub: auth.account.id, sid, iss: PUBLIC_URL, expMs });
      expect((await me(server, valid)).status).toBe(200);
    });

    it('a sessão de uma conta não autoriza com o sub de outra', async () => {
      const alice = await signUp(server, 'Alice');
      const bob = await signUp(server, 'Roberto');
      const expMs = clock.now().getTime() + 10 * MINUTE;

      // Sessão da Alice com o `sub` do Roberto, assinado com a chave correta.
      const crossed = await forge(server, {
        sub: bob.account.id,
        sid: sessionIdOf(alice.accessToken),
        iss: PUBLIC_URL,
        expMs,
      });
      for (const target of [server, replica]) {
        const reply = await me(target, crossed);
        expect(reply.status).toBe(401);
        expect(reply.body.displayName).toBeUndefined();
      }
      const renamed = await call(server, 'PATCH', '/me', {
        token: crossed,
        body: { displayName: 'Invadido' },
      });
      expect(renamed.status).toBe(401);
      expect((await accountRow(server, bob.account.id)).display_name).toBe('Roberto');
      expect((await accountRow(server, alice.account.id)).display_name).toBe('Alice');

      // Sessão inexistente também não autoriza.
      const ghost = await forge(server, {
        sub: bob.account.id,
        sid: '00000000-0000-4000-8000-000000000000',
        iss: PUBLIC_URL,
        expMs,
      });
      expect((await me(server, ghost)).status).toBe(401);

      // As duas sessões legítimas seguem intactas.
      expect((await me(server, alice.accessToken)).body.displayName).toBe('Alice');
      expect((await me(server, bob.accessToken)).body.displayName).toBe('Roberto');
    });
  });

  describe('rotação e reuso do refresh token', () => {
    it('rotaciona na mesma sessão: marca o usado, insere o sucessor e não permite cache', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      clock.advance(MINUTE);

      const reply = await refresh(server, auth.refreshToken);
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(TokenPairSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body.refreshToken).not.toBe(auth.refreshToken);
      expect(reply.body.refreshToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(reply.body.expiresIn).toBe(ACCESS_TTL_S);

      const claims = decodeJwt(reply.body.accessToken);
      expect(claims.sub).toBe(auth.account.id);
      expect(claims.sid).toBe(sessionId);
      expect(claims.iss).toBe(PUBLIC_URL);
      expect(claims.exp).toBe(Math.floor(clock.now().getTime() / 1000) + ACCESS_TTL_S);

      const rows = await refreshRows(server, sessionId);
      const used = rows.find((row) => row.token_hash === sha256Hex(auth.refreshToken));
      const successor = rows.find((row) => row.token_hash === sha256Hex(reply.body.refreshToken));
      expect(rows).toHaveLength(2);
      expect(used?.used_at?.toISOString()).toBe(clock.now().toISOString());
      expect(successor?.used_at).toBeNull();
      expect(await countRows(server.pool, 'sessions')).toBe(1);
    });

    it('reuso de R0 depois de R0 → R1 → R2 revoga a família e preserva a outra sessão', async () => {
      const r0 = await signUp(server);
      const sessionId = sessionIdOf(r0.accessToken);
      const other = await secondSession(server, r0.accessToken);
      const otherSessionId = sessionIdOf(other.accessToken);
      expect(other.account.id).toBe(r0.account.id);
      expect(otherSessionId).not.toBe(sessionId);

      const r1 = await rotate(server, r0.refreshToken);
      const r2 = await rotate(server, r1.refreshToken);
      for (const jwt of [r0.accessToken, r1.accessToken, r2.accessToken]) {
        expect((await me(server, jwt)).status).toBe(200);
      }

      clock.advance(MINUTE);
      const reused = await refresh(server, r0.refreshToken);
      expectError(reused, 401, 'SESSION_REVOKED');
      expect(reused.body.accessToken).toBeUndefined();
      expect(reused.body.refreshToken).toBeUndefined();

      // A revogação ficou gravada apesar do 401.
      const revoked = await sessionRow(server, sessionId);
      expect(revoked.revoked_at?.toISOString()).toBe(clock.now().toISOString());

      // R2 (o token vigente), R1 e todos os JWTs da família deixam de valer.
      expectError(await refresh(server, r2.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(server, r1.refreshToken), 401, 'SESSION_REVOKED');
      for (const jwt of [r0.accessToken, r1.accessToken, r2.accessToken]) {
        expectError(await me(server, jwt), 401, 'SESSION_REVOKED');
      }
      // Nenhum sucessor foi emitido para a família revogada.
      expect(await refreshRows(server, sessionId)).toHaveLength(3);

      // A sessão da outra máquina continua válida: JWT e rotação.
      expect((await sessionRow(server, otherSessionId)).revoked_at).toBeNull();
      expect((await me(server, other.accessToken)).status).toBe(200);
      const otherNext = await rotate(server, other.refreshToken);
      expect((await me(server, otherNext.accessToken)).status).toBe(200);
      expect((await accountRow(server, r0.account.id)).deleted_at).toBeNull();
    });

    it('reuso do antecessor imediato também revoga a sessão', async () => {
      const r0 = await signUp(server);
      const r1 = await rotate(server, r0.refreshToken);
      expectError(await refresh(server, r0.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(server, r1.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await me(server, r1.accessToken), 401, 'SESSION_REVOKED');
      expect((await sessionRow(server, sessionIdOf(r0.accessToken))).revoked_at).not.toBeNull();
    });

    it('reuso não afeta sessões de outras contas', async () => {
      const victim = await signUp(server, 'Vítima');
      const bystander = await signUp(server, 'Vizinho');
      await rotate(server, victim.refreshToken);
      expectError(await refresh(server, victim.refreshToken), 401, 'SESSION_REVOKED');

      expect((await me(server, bystander.accessToken)).status).toBe(200);
      expect((await refresh(server, bystander.refreshToken)).status).toBe(200);
      expect(await countRows(server.pool, 'sessions', 'revoked_at is not null')).toBe(1);
    });

    it('token desconhecido responde 401 UNAUTHORIZED sem alterar nenhuma sessão', async () => {
      const auth = await signUp(server);
      await secondSession(server, auth.accessToken);
      const before = await authSnapshot(server);

      const unknown = randomBytes(32).toString('base64url');
      expectError(await refresh(server, unknown), 401, 'UNAUTHORIZED');
      // O hash de um token válido não é aceito no lugar do token.
      expectError(await refresh(server, sha256Hex(auth.refreshToken)), 401, 'UNAUTHORIZED');
      // Nem o access token.
      expectError(await refresh(server, auth.accessToken.slice(0, 200)), 401, 'UNAUTHORIZED');

      expect(await authSnapshot(server)).toBe(before);
      expect((await me(server, auth.accessToken)).status).toBe(200);
      expect((await refresh(server, auth.refreshToken)).status).toBe(200);
    });

    it('corpo inválido no refresh é erro de validação, não de autenticação', async () => {
      expectError(await call(server, 'POST', '/auth/refresh', { body: {} }), 400, 'VALIDATION');
      const empty = await call(server, 'POST', '/auth/refresh', { body: { refreshToken: '' } });
      expectError(empty, 400, 'VALIDATION');
    });

    it('guarda o histórico inteiro da família, com um único token não utilizado', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const issued = [auth.refreshToken];
      let current = auth.refreshToken;
      for (let turn = 0; turn < 6; turn += 1) {
        clock.advance(20 * MINUTE);
        current = (await rotate(turn % 2 === 0 ? server : replica, current)).refreshToken;
        issued.push(current);
        expect(await countRows(server.pool, 'refresh_tokens', 'used_at is null')).toBe(1);
      }
      expect(new Set(issued).size).toBe(7);

      const rows = await refreshRows(server, sessionId);
      expect(rows.map((row) => row.token_hash).sort()).toEqual(issued.map(sha256Hex).sort());
      const unused = rows.filter((row) => row.used_at === null);
      expect(unused.map((row) => row.token_hash)).toEqual([sha256Hex(current)]);

      // O antecessor mais antigo segue identificável: reusá-lo revoga a família.
      expectError(await refresh(server, auth.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(server, current), 401, 'SESSION_REVOKED');
      // A revogação não apaga o histórico.
      expect(await refreshRows(server, sessionId)).toHaveLength(7);
    });

    it('o histórico é por sessão: no máximo um não utilizado em cada família', async () => {
      const auth = await signUp(server);
      const other = await secondSession(server, auth.accessToken);
      let mine = auth.refreshToken;
      let theirs = other.refreshToken;
      for (let turn = 0; turn < 3; turn += 1) {
        mine = (await rotate(server, mine)).refreshToken;
        theirs = (await rotate(server, theirs)).refreshToken;
      }
      const { rows } = await server.pool.query<{
        session_id: string;
        unused: string;
        total: string;
      }>(
        `select session_id, count(*) filter (where used_at is null) as unused, count(*) as total
           from refresh_tokens group by session_id`,
      );
      expect(rows).toHaveLength(2);
      for (const row of rows) {
        expect(Number(row.unused)).toBe(1);
        expect(Number(row.total)).toBe(4);
      }
    });
  });

  describe('refresh concorrente', () => {
    /** Dispara refreshes simultâneos do mesmo token e confere o desfecho documentado. */
    async function race(targets: TestApp[]): Promise<void> {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const r1 = await rotate(server, auth.refreshToken);

      const replies = await Promise.all(targets.map((target) => refresh(target, r1.refreshToken)));
      const winners = replies.filter((reply) => reply.status === 200);
      const losers = replies.filter((reply) => reply.status !== 200);

      // Só uma requisição encontra o token ainda não utilizado; as demais são reuso.
      expect(winners).toHaveLength(1);
      for (const loser of losers) {
        expectError(loser, 401, 'SESSION_REVOKED');
      }

      // Nunca dois sucessores válidos: um único token não utilizado, e a família está revogada.
      const rows = await refreshRows(server, sessionId);
      expect(rows.filter((row) => row.used_at === null).length).toBeLessThanOrEqual(1);
      expect(rows).toHaveLength(3);
      expect((await sessionRow(server, sessionId)).revoked_at).not.toBeNull();

      // O reuso revoga inclusive o sucessor recém-emitido e o JWT que veio com ele.
      const winner = winners[0]?.body;
      if (!winner) {
        throw new Error('Nenhum refresh concorrente teve sucesso.');
      }
      expectError(await refresh(server, winner.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(replica, winner.refreshToken), 401, 'SESSION_REVOKED');
      expectError(await me(server, winner.accessToken), 401, 'SESSION_REVOKED');
      expectError(await me(replica, winner.accessToken), 401, 'SESSION_REVOKED');
      expectError(await me(server, auth.accessToken), 401, 'SESSION_REVOKED');
    }

    it('dois refreshes do mesmo token na mesma instância não deixam dois sucessores', async () => {
      await race([server, server]);
    });

    it('dois refreshes do mesmo token em instâncias diferentes não deixam dois sucessores', async () => {
      await race([server, replica]);
    });

    it('uma rajada de oito refreshes do mesmo token tem um único vencedor', async () => {
      await race([server, replica, server, replica, server, replica, server, replica]);
    });

    it('a corrida se repete com o mesmo desfecho', async () => {
      for (let round = 0; round < 5; round += 1) {
        await race([server, replica]);
      }
    });

    it('refreshes concorrentes de sessões diferentes não interferem entre si', async () => {
      const auth = await signUp(server);
      const other = await secondSession(server, auth.accessToken);
      const [mine, theirs] = await Promise.all([
        refresh(server, auth.refreshToken),
        refresh(replica, other.refreshToken),
      ]);
      expect(mine.status).toBe(200);
      expect(theirs.status).toBe(200);
      expect(await countRows(server.pool, 'sessions', 'revoked_at is not null')).toBe(0);
      expect((await me(server, mine.body.accessToken)).status).toBe(200);
      expect((await me(server, theirs.body.accessToken)).status).toBe(200);
    });
  });

  describe('rollback em falha de rotação', () => {
    it('falha no meio da rotação não consome o token nem deixa sucessor órfão', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const r1 = await rotate(server, auth.refreshToken);
      const before = await authSnapshot(server);

      let fired = 0;
      server.hooks.afterRefreshTokenUsed = () => {
        fired += 1;
        throw new Error('falha');
      };
      try {
        const failed = await refresh(server, r1.refreshToken);
        expectError(failed, 500, 'INTERNAL');
        expect(failed.body.accessToken).toBeUndefined();
        expect(failed.body.refreshToken).toBeUndefined();
        // O erro interno não vaza a mensagem da falha.
        expect(JSON.stringify(failed.body)).not.toContain('falha');
      } finally {
        delete server.hooks.afterRefreshTokenUsed;
      }
      expect(fired).toBe(1);

      // Nada mudou no banco: R1 segue como o único não utilizado e a sessão não foi revogada.
      expect(await authSnapshot(server)).toBe(before);
      const rows = await refreshRows(server, sessionId);
      expect(rows).toHaveLength(2);
      expect(rows.filter((row) => row.used_at === null).map((row) => row.token_hash)).toEqual([
        sha256Hex(r1.refreshToken),
      ]);
      expect((await me(server, r1.accessToken)).status).toBe(200);

      // O token original ainda funciona, e a rotação seguinte é normal.
      const r2 = await rotate(server, r1.refreshToken);
      expect((await me(server, r2.accessToken)).status).toBe(200);
      expect(await refreshRows(server, sessionId)).toHaveLength(3);
      expect((await sessionRow(server, sessionId)).revoked_at).toBeNull();
    });

    it('falhas repetidas não acumulam sucessores nem revogam a sessão', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      server.hooks.afterRefreshTokenUsed = () => {
        throw new Error('falha');
      };
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          expect((await refresh(server, auth.refreshToken)).status).toBe(500);
        }
      } finally {
        delete server.hooks.afterRefreshTokenUsed;
      }
      expect(await refreshRows(server, sessionId)).toHaveLength(1);
      // A outra réplica, sem a falha, rotaciona o mesmo token normalmente.
      expect((await refresh(replica, auth.refreshToken)).status).toBe(200);
      expect((await sessionRow(server, sessionId)).revoked_at).toBeNull();
    });
  });

  describe('logout', () => {
    it('responde 204 e revoga só a sessão atual', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      const other = await secondSession(server, auth.accessToken);
      const bystander = await signUp(server, 'Vizinho');
      clock.advance(MINUTE);

      const reply = await call(server, 'POST', '/auth/logout', { token: auth.accessToken });
      expect(reply.status).toBe(204);
      expect(reply.body).toBe('');
      expect(reply.headers['cache-control']).toBe('no-store');

      const revoked = await sessionRow(server, sessionId);
      expect(revoked.revoked_at?.toISOString()).toBe(clock.now().toISOString());
      expect(await countRows(server.pool, 'sessions', 'revoked_at is not null')).toBe(1);

      // JWT e refresh da sessão encerrada são recusados.
      expectError(await me(server, auth.accessToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(server, auth.refreshToken), 401, 'SESSION_REVOKED');
      // Recusar o refresh não cria sucessor.
      expect(await refreshRows(server, sessionId)).toHaveLength(1);

      // A outra máquina e as outras contas seguem válidas; a conta não foi excluída.
      expect((await me(server, other.accessToken)).status).toBe(200);
      expect((await refresh(server, other.refreshToken)).status).toBe(200);
      expect((await me(server, bystander.accessToken)).status).toBe(200);
      expect((await accountRow(server, auth.account.id)).deleted_at).toBeNull();
    });

    it('exige autenticação por JWT', async () => {
      const auth = await signUp(server);
      expectError(await call(server, 'POST', '/auth/logout'), 401, 'UNAUTHORIZED');
      // O refresh token no corpo não autentica o logout.
      const withBody = await call(server, 'POST', '/auth/logout', {
        body: { refreshToken: auth.refreshToken },
      });
      expect(withBody.status).toBe(401);
      expect(await countRows(server.pool, 'sessions', 'revoked_at is not null')).toBe(0);
    });

    it('logout repetido é recusado e mantém o instante da primeira revogação', async () => {
      const auth = await signUp(server);
      const sessionId = sessionIdOf(auth.accessToken);
      expect((await call(server, 'POST', '/auth/logout', { token: auth.accessToken })).status).toBe(
        204,
      );
      const first = (await sessionRow(server, sessionId)).revoked_at;
      clock.advance(MINUTE);
      const again = await call(server, 'POST', '/auth/logout', { token: auth.accessToken });
      expectError(again, 401, 'SESSION_REVOKED');
      expect((await sessionRow(server, sessionId)).revoked_at?.toISOString()).toBe(
        first?.toISOString(),
      );
    });
  });

  describe('/me', () => {
    it('GET /me devolve o perfil da conta', async () => {
      const auth = await signUp(server, 'Gustavo');
      const reply = await me(server, auth.accessToken);
      expect(reply.status).toBe(200);
      expect(AccountSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body).toEqual({
        id: auth.account.id,
        displayName: 'Gustavo',
        linked: { github: false },
        hasRecoveryCode: false,
        createdAt: clock.now().toISOString(),
      });

      await recoveryCode(server, auth.accessToken);
      expect((await me(server, auth.accessToken)).body.hasRecoveryCode).toBe(true);
    });

    it('GET /me devolve a conta do token, não a de outro jogador', async () => {
      const alice = await signUp(server, 'Alice');
      const bob = await signUp(server, 'Roberto');
      expect((await me(server, alice.accessToken)).body.id).toBe(alice.account.id);
      expect((await me(server, bob.accessToken)).body.id).toBe(bob.account.id);
    });

    it('PATCH /me renomeia a conta com nomes de 2 a 24 caracteres', async () => {
      const auth = await signUp(server, 'Gustavo');
      const bystander = await signUp(server, 'Vizinho');
      for (const displayName of ['Zé', 'x'.repeat(24), 'Dona Urraca']) {
        const reply = await call<Account>(server, 'PATCH', '/me', {
          token: auth.accessToken,
          body: { displayName },
        });
        expect(reply.status).toBe(200);
        expect((await me(server, auth.accessToken)).body.displayName).toBe(displayName);
        expect((await accountRow(server, auth.account.id)).display_name).toBe(displayName);
      }
      expect((await me(replica, auth.accessToken)).body.displayName).toBe('Dona Urraca');
      expect((await me(server, bystander.accessToken)).body.displayName).toBe('Vizinho');
    });

    it('PATCH /me recusa nomes fora do limite e não altera nada', async () => {
      const auth = await signUp(server, 'Gustavo');
      for (const body of [
        { displayName: 'A' },
        { displayName: 'x'.repeat(25) },
        { displayName: '   ' },
        { displayName: 42 },
        {},
      ]) {
        const reply = await call(server, 'PATCH', '/me', { token: auth.accessToken, body });
        expectError(reply, 400, 'VALIDATION');
      }
      expect((await accountRow(server, auth.account.id)).display_name).toBe('Gustavo');
    });

    it('PATCH e DELETE /me exigem sessão', async () => {
      const auth = await signUp(server, 'Gustavo');
      const patch = await call(server, 'PATCH', '/me', { body: { displayName: 'Outro' } });
      expectError(patch, 401, 'UNAUTHORIZED');
      expectError(await call(server, 'DELETE', '/me'), 401, 'UNAUTHORIZED');
      const row = await accountRow(server, auth.account.id);
      expect(row.display_name).toBe('Gustavo');
      expect(row.deleted_at).toBeNull();
    });
  });

  describe('exclusão de conta', () => {
    it('DELETE /me responde 202 com deletedAt e purgeAfter = deletedAt + 7 dias', async () => {
      const auth = await signUp(server);
      clock.advance(3 * MINUTE);
      const reply = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: auth.accessToken,
      });
      expect(reply.status).toBe(202);
      expect(DeleteMeResponseSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body.deletedAt).toBe(clock.now().toISOString());
      // Instantes em UTC.
      expect(reply.body.deletedAt.endsWith('Z')).toBe(true);
      expect(reply.body.purgeAfter.endsWith('Z')).toBe(true);
      expect(new Date(reply.body.purgeAfter).getTime()).toBe(
        new Date(reply.body.deletedAt).getTime() + 7 * DAY,
      );
      const row = await accountRow(server, auth.account.id);
      expect(row.deleted_at?.toISOString()).toBe(reply.body.deletedAt);
    });

    it('revoga todas as sessões, limpa o hash de recuperação e arquiva as partidas', async () => {
      const player = await newPlayer(server);
      const other = await secondSession(server, player.token);
      const control = await newPlayer(server, 'Controle');
      const controlCode = await recoveryCode(server, control.token);
      expect((await accountRow(server, player.accountId)).recovery_code_hash).not.toBeNull();
      expect(await countRows(server.pool, 'games', "status = 'active'")).toBe(2);

      const reply = await call(server, 'DELETE', '/me', { token: other.accessToken });
      expect(reply.status).toBe(202);

      const row = await accountRow(server, player.accountId);
      expect(row.deleted_at).not.toBeNull();
      expect(row.recovery_code_hash).toBeNull();
      const mine = `account_id = '${player.accountId}'`;
      expect(await countRows(server.pool, 'sessions', mine)).toBe(2);
      expect(await countRows(server.pool, 'sessions', `${mine} and revoked_at is null`)).toBe(0);
      expect(await countRows(server.pool, 'games', mine)).toBe(1);
      expect(await countRows(server.pool, 'games', `${mine} and status <> 'archived'`)).toBe(0);
      // Soft delete: os registros internos ainda existem durante a retenção.
      expect(await countRows(server.pool, 'refresh_tokens')).toBe(3);

      // A conta de controle não é afetada.
      const controlRow = await accountRow(server, control.accountId);
      expect(controlRow.deleted_at).toBeNull();
      expect(controlRow.recovery_code_hash).not.toBeNull();
      expect((await me(server, control.token)).status).toBe(200);
      expect((await refresh(server, control.refreshToken)).status).toBe(200);
      expect(
        await countRows(
          server.pool,
          'games',
          `account_id = '${control.accountId}' and status = 'active'`,
        ),
      ).toBe(1);
      const recovered = await call(server, 'POST', '/auth/recover', {
        body: { code: controlCode },
      });
      expect(recovered.status).toBeLessThan(300);
    });

    it('depois da exclusão, JWT e refresh de qualquer sessão da conta são recusados', async () => {
      const player = await newPlayer(server);
      const code = await recoveryCode(server, player.token);
      const recovered = await call<AuthResponse>(server, 'POST', '/auth/recover', {
        body: { code },
      });
      const other = recovered.body;
      expect((await call(server, 'DELETE', '/me', { token: player.token })).status).toBe(202);
      const before = await authSnapshot(server);

      for (const jwt of [player.token, other.accessToken]) {
        expectError(await me(server, jwt), 401, 'SESSION_REVOKED');
        const rename = await call(server, 'PATCH', '/me', {
          token: jwt,
          body: { displayName: 'Fantasma' },
        });
        expectError(rename, 401, 'SESSION_REVOKED');
        expectError(await call(server, 'GET', '/games', { token: jwt }), 401, 'SESSION_REVOKED');
        const view = await call(server, 'GET', `/games/${player.game.id}/view`, { token: jwt });
        expectError(view, 401, 'SESSION_REVOKED');
        const logout = await call(server, 'POST', '/auth/logout', { token: jwt });
        expectError(logout, 401, 'SESSION_REVOKED');
        const newCode = await call(server, 'POST', '/auth/recovery-code', { token: jwt });
        expectError(newCode, 401, 'SESSION_REVOKED');
        expectError(await call(server, 'DELETE', '/me', { token: jwt }), 401, 'SESSION_REVOKED');
      }
      for (const token of [player.refreshToken, other.refreshToken]) {
        expectError(await refresh(server, token), 401, 'SESSION_REVOKED');
      }
      // O Código do Reino antigo não restaura a conta, sem revelar que ela existiu.
      const recover = await call(server, 'POST', '/auth/recover', { body: { code } });
      expectError(recover, 401, 'UNAUTHORIZED');

      // Nenhuma tentativa criou sessão, sucessor ou credencial nova, nem mexeu no nome.
      expect(await authSnapshot(server)).toBe(before);
      const row = await accountRow(server, player.accountId);
      expect(row.recovery_code_hash).toBeNull();
      expect(row.display_name).toBe('Gustavo');
      expect(row.deleted_at).not.toBeNull();
    });

    it('a conta excluída continua bloqueada com o passar do tempo', async () => {
      const auth = await signUp(server);
      const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: auth.accessToken,
      });
      expect(deleted.status).toBe(202);
      clock.advance(DAY);
      // Refresh ainda dentro dos 30 dias da sessão: a recusa é pela exclusão, não por expiração.
      expectError(await refresh(server, auth.refreshToken), 401, 'SESSION_REVOKED');
      expect((await me(server, auth.accessToken)).status).toBe(401);
      expect((await accountRow(server, auth.account.id)).deleted_at?.toISOString()).toBe(
        deleted.body.deletedAt,
      );
    });
  });

  describe('duas instâncias diante do mesmo banco (sem cache positivo de autorização)', () => {
    it('uma sessão criada na instância A vale imediatamente na B', async () => {
      const auth = await signUp(server);
      expect((await me(replica, auth.accessToken)).body.id).toBe(auth.account.id);
      const next = await rotate(replica, auth.refreshToken);
      expect((await me(server, next.accessToken)).status).toBe(200);
    });

    it('logout na instância A bloqueia a requisição seguinte na B', async () => {
      const auth = await signUp(server);
      const other = await secondSession(server, auth.accessToken);
      // A instância B acabou de autorizar este mesmo JWT: se houvesse cache, ele passaria.
      expect((await me(replica, auth.accessToken)).status).toBe(200);

      const logout = await call(server, 'POST', '/auth/logout', { token: auth.accessToken });
      expect(logout.status).toBe(204);

      expectError(await me(replica, auth.accessToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(replica, auth.refreshToken), 401, 'SESSION_REVOKED');
      expect((await me(replica, other.accessToken)).status).toBe(200);
    });

    it('reuso de R0 na instância A revoga R2 e seus JWTs na B', async () => {
      const r0 = await signUp(server);
      const other = await secondSession(replica, r0.accessToken);
      const r1 = await rotate(replica, r0.refreshToken);
      const r2 = await rotate(server, r1.refreshToken);
      expect((await me(replica, r2.accessToken)).status).toBe(200);
      expect((await me(replica, r1.accessToken)).status).toBe(200);

      expectError(await refresh(server, r0.refreshToken), 401, 'SESSION_REVOKED');

      expectError(await me(replica, r2.accessToken), 401, 'SESSION_REVOKED');
      expectError(await me(replica, r1.accessToken), 401, 'SESSION_REVOKED');
      expectError(await me(replica, r0.accessToken), 401, 'SESSION_REVOKED');
      expectError(await refresh(replica, r2.refreshToken), 401, 'SESSION_REVOKED');
      // A revogação está no banco, visível para as duas instâncias.
      const fromReplica = await sessionRow(replica, sessionIdOf(r0.accessToken));
      expect(fromReplica.revoked_at).not.toBeNull();

      // A outra sessão da conta segue válida nas duas instâncias.
      expect((await me(replica, other.accessToken)).status).toBe(200);
      expect((await me(server, other.accessToken)).status).toBe(200);
      expect((await refresh(replica, other.refreshToken)).status).toBe(200);
    });

    it('exclusão na instância A bloqueia JWT, refresh e partidas na B', async () => {
      const player = await newPlayer(server);
      const other = await secondSession(server, player.token);
      const control = await signUp(server, 'Controle');
      for (const jwt of [player.token, other.accessToken]) {
        expect((await me(replica, jwt)).status).toBe(200);
      }

      expect((await call(server, 'DELETE', '/me', { token: player.token })).status).toBe(202);

      for (const jwt of [player.token, other.accessToken]) {
        expectError(await me(replica, jwt), 401, 'SESSION_REVOKED');
        const view = await call(replica, 'GET', `/games/${player.game.id}/view`, { token: jwt });
        expectError(view, 401, 'SESSION_REVOKED');
      }
      for (const token of [player.refreshToken, other.refreshToken]) {
        expectError(await refresh(replica, token), 401, 'SESSION_REVOKED');
      }
      expect((await me(replica, control.accessToken)).status).toBe(200);
    });

    it('requisições intercaladas nas duas instâncias veem a revogação no mesmo instante', async () => {
      const auth = await signUp(server);
      for (let turn = 0; turn < 3; turn += 1) {
        expect((await me(server, auth.accessToken)).status).toBe(200);
        expect((await me(replica, auth.accessToken)).status).toBe(200);
      }
      expect(
        (await call(replica, 'POST', '/auth/logout', { token: auth.accessToken })).status,
      ).toBe(204);
      // O relógio não andou: nenhuma espera é necessária em nenhuma das duas.
      expectError(await me(server, auth.accessToken), 401, 'SESSION_REVOKED');
      expectError(await me(replica, auth.accessToken), 401, 'SESSION_REVOKED');
    });
  });

  describe('last_seen_at', () => {
    const lastSeen = async (accountId: string): Promise<string> =>
      (await accountRow(server, accountId)).last_seen_at.toISOString();

    it('é atualizado no máximo a cada 5 minutos', async () => {
      const auth = await signUp(server);
      const createdAt = clock.now().toISOString();
      expect(await lastSeen(auth.account.id)).toBe(createdAt);

      // Requisições dentro dos 5 minutos não escrevem.
      clock.advance(2 * MINUTE);
      expect((await me(server, auth.accessToken)).status).toBe(200);
      clock.advance(2 * MINUTE + 59 * SECOND);
      expect((await me(replica, auth.accessToken)).status).toBe(200);
      expect(await lastSeen(auth.account.id)).toBe(createdAt);

      // Passados os 5 minutos, a requisição seguinte atualiza.
      clock.advance(MINUTE);
      expect((await me(server, auth.accessToken)).status).toBe(200);
      const second = clock.now().toISOString();
      expect(await lastSeen(auth.account.id)).toBe(second);

      // A janela recomeça do último registro, também para a outra instância.
      clock.advance(4 * MINUTE);
      expect((await me(replica, auth.accessToken)).status).toBe(200);
      expect((await me(server, auth.accessToken)).status).toBe(200);
      expect(await lastSeen(auth.account.id)).toBe(second);

      clock.advance(90 * SECOND);
      expect((await me(replica, auth.accessToken)).status).toBe(200);
      expect(await lastSeen(auth.account.id)).toBe(clock.now().toISOString());
    });

    it('requisição recusada não conta como presença', async () => {
      const auth = await signUp(server);
      const createdAt = clock.now().toISOString();
      clock.advance(20 * MINUTE);
      // JWT expirado.
      expect((await me(server, auth.accessToken)).status).toBe(401);
      expect(await lastSeen(auth.account.id)).toBe(createdAt);

      const next = await rotate(server, auth.refreshToken);
      expect((await call(server, 'POST', '/auth/logout', { token: next.accessToken })).status).toBe(
        204,
      );
      const afterLogout = await lastSeen(auth.account.id);
      clock.advance(10 * MINUTE);
      // Sessão revogada.
      expect((await me(server, next.accessToken)).status).toBe(401);
      expect(await lastSeen(auth.account.id)).toBe(afterLogout);
    });

    it('a presença de uma conta não mexe na de outra', async () => {
      const alice = await signUp(server, 'Alice');
      const bob = await signUp(server, 'Roberto');
      const createdAt = clock.now().toISOString();
      clock.advance(6 * MINUTE);
      expect((await me(server, alice.accessToken)).status).toBe(200);
      expect(await lastSeen(alice.account.id)).toBe(clock.now().toISOString());
      expect(await lastSeen(bob.account.id)).toBe(createdAt);
    });
  });

  describe('limites de taxa', () => {
    const create = (target: TestApp, ip: string, displayName = 'Gustavo') =>
      call<AuthResponse & Partial<ApiError>>(target, 'POST', '/auth/anonymous', {
        body: { displayName },
        ip,
      });

    it('criação de contas por IP: passa do limite e recebe 429 RATE_LIMITED', async () => {
      const limited = await createTestApp({
        clock,
        config: { ACCOUNT_CREATE_PER_HOUR_PER_IP: '3' },
      });
      try {
        for (let attempt = 0; attempt < 3; attempt += 1) {
          expect((await create(limited, '203.0.113.7')).status).toBe(201);
        }
        const blocked = await create(limited, '203.0.113.7');
        expectError(blocked, 429, 'RATE_LIMITED');
        expect(blocked.body.accessToken).toBeUndefined();
        expectError(await create(limited, '203.0.113.7'), 429, 'RATE_LIMITED');
        // A requisição barrada não cria conta.
        expect(await countRows(limited.pool, 'accounts')).toBe(3);
        expect(await countRows(limited.pool, 'sessions')).toBe(3);

        // Outro IP não é afetado.
        expect((await create(limited, '198.51.100.9')).status).toBe(201);
        expect(await countRows(limited.pool, 'accounts')).toBe(4);
      } finally {
        await limited.close();
      }
    });

    it('o limite de criação não bloqueia quem já tem conta naquele IP', async () => {
      const limited = await createTestApp({
        clock,
        config: { ACCOUNT_CREATE_PER_HOUR_PER_IP: '3' },
      });
      try {
        const ip = '203.0.113.8';
        const first = await create(limited, ip);
        await create(limited, ip);
        await create(limited, ip);
        expectError(await create(limited, ip), 429, 'RATE_LIMITED');

        const profile = await call(limited, 'GET', '/me', { token: first.body.accessToken, ip });
        expect(profile.status).toBe(200);
        const renewed = await call(limited, 'POST', '/auth/refresh', {
          body: { refreshToken: first.body.refreshToken },
          ip,
        });
        expect(renewed.status).toBe(200);
      } finally {
        await limited.close();
      }
    });

    it('o padrão documentado é de 10 criações de conta por hora por IP', async () => {
      const limited = await createTestApp({
        clock,
        config: { ACCOUNT_CREATE_PER_HOUR_PER_IP: '10' },
      });
      try {
        for (let attempt = 0; attempt < 10; attempt += 1) {
          expect((await create(limited, '203.0.113.10')).status).toBe(201);
        }
        expectError(await create(limited, '203.0.113.10'), 429, 'RATE_LIMITED');
      } finally {
        await limited.close();
      }
    });

    it('limite por sessão: 60 requisições por minuto, sem afetar outra sessão', async () => {
      const limited = await createTestApp({ clock, config: { RATE_LIMIT_PER_MINUTE: '60' } });
      try {
        const alice = await signUp(limited, 'Alice');
        const bob = await signUp(limited, 'Roberto');
        for (let attempt = 0; attempt < 60; attempt += 1) {
          expect((await me(limited, alice.accessToken)).status).toBe(200);
        }
        expectError(await me(limited, alice.accessToken), 429, 'RATE_LIMITED');
        expect((await me(limited, bob.accessToken)).status).toBe(200);
      } finally {
        await limited.close();
      }
    });
  });
});
