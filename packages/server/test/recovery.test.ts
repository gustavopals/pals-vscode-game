import { createHmac } from 'node:crypto';

import type {
  Account,
  ApiError,
  AuthResponse,
  DeleteMeResponse,
  ListGamesResponse,
  RecoveryCodeResponse,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  DAY,
  fakeClock,
  newPlayer,
  type Player,
  RECOVERY_CODE_SECRET,
  renew,
  type Reply,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Contrato verificado aqui: GDD §14.7 ("Código do Reino", "Sair desta máquina", "Excluir conta"),
// ADR 0003 e roadmap F2-T5.1, F2-T5.2 e F2-T5.4.

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DISPLAY_FORMAT = new RegExp(`^[${ALPHABET}]{4}(-[${ALPHABET}]{4}){4}$`);
const TABLES = [
  'accounts',
  'sessions',
  'refresh_tokens',
  'games',
  'commands',
  'game_events',
  'chronicles',
];

/** HMAC-SHA256 hexadecimal do código normalizado, recalculado sem usar o código do servidor. */
function expectedHmac(displayedCode: string, secretBase64 = RECOVERY_CODE_SECRET): string {
  return createHmac('sha256', Buffer.from(secretBase64, 'base64'))
    .update(displayedCode.replace(/-/g, ''))
    .digest('hex');
}

/** Tudo o que o banco guarda, como texto: serve para procurar um segredo em qualquer coluna. */
async function dumpDatabase(server: TestApp): Promise<string> {
  const parts: string[] = [];
  for (const table of TABLES) {
    const { rows } = await server.pool.query<{ dump: string }>(
      `select coalesce(string_agg(row_to_json(t)::text, E'\\n'), '') as dump from ${table} t`,
    );
    parts.push(rows[0]?.dump ?? '');
  }
  return parts.join('\n');
}

async function storedHash(server: TestApp, accountId: string): Promise<string | null> {
  const { rows } = await server.pool.query<{ recovery_code_hash: string | null }>(
    'select recovery_code_hash from accounts where id = $1',
    [accountId],
  );
  return rows[0]?.recovery_code_hash ?? null;
}

/** O `sid` do access token: identifica a sessão (a "máquina") que o emitiu. */
function sessionIdOf(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sid: string };
  return claims.sid;
}

async function issueCode(server: TestApp, token: string): Promise<string> {
  const reply = await call<RecoveryCodeResponse>(server, 'POST', '/auth/recovery-code', { token });
  if (reply.status !== 200) {
    throw new Error(`Falha ao gerar o Código do Reino: ${reply.status}`);
  }
  return reply.body.code;
}

function recover(server: TestApp, code: string, ip?: string): Promise<Reply<AuthResponse>> {
  return call<AuthResponse>(server, 'POST', '/auth/recover', {
    body: { code, deviceLabel: 'máquina nova' },
    ...(ip !== undefined ? { ip } : {}),
  });
}

function expectUnauthorized(reply: Reply): void {
  expect(reply.status).toBe(401);
  expect((reply.body as ApiError).code).toBe('UNAUTHORIZED');
}

describe('Código do Reino', () => {
  let server: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    server = await createTestApp();
  });
  afterAll(async () => {
    await server.close();
  });

  describe('geração', () => {
    it('exige autenticação', async () => {
      const reply = await call<ApiError>(server, 'POST', '/auth/recovery-code');
      expect(reply.status).toBe(401);
      expect(reply.body.code).toBe('UNAUTHORIZED');
    });

    it('devolve o código em claro no formato XXXX-XXXX-XXXX-XXXX-XXXX, com no-store', async () => {
      const player = await newPlayer(server);
      const reply = await call<RecoveryCodeResponse>(server, 'POST', '/auth/recovery-code', {
        token: player.token,
      });
      expect(reply.status).toBe(200);
      expect(Object.keys(reply.body)).toEqual(['code']);
      expect(reply.body.code).toMatch(DISPLAY_FORMAT);
      expect(reply.headers['cache-control']).toBe('no-store');
    });

    it('guarda só o HMAC-SHA256 hexadecimal com a chave RECOVERY_CODE_SECRET, nunca o código', async () => {
      const player = await newPlayer(server);
      const code = await issueCode(server, player.token);

      const hash = await storedHash(server, player.accountId);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(expectedHmac(code));

      const dump = await dumpDatabase(server);
      expect(dump).toContain(expectedHmac(code));
      expect(dump).not.toContain(code);
      expect(dump).not.toContain(code.replace(/-/g, ''));
      expect(dump.toUpperCase()).not.toContain(code.replace(/-/g, ''));
    });

    it('o código aparece uma única vez: GET /me só informa que ele existe', async () => {
      const player = await newPlayer(server);
      const before = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(before.body.hasRecoveryCode).toBe(false);

      const code = await issueCode(server, player.token);
      const after = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(after.status).toBe(200);
      expect(after.body.hasRecoveryCode).toBe(true);
      expect(JSON.stringify(after.body)).not.toContain(code);
      expect(JSON.stringify(after.body)).not.toContain(code.replace(/-/g, ''));
    });

    it('códigos de contas diferentes são diferentes', async () => {
      const codes = new Set<string>();
      for (let index = 0; index < 5; index += 1) {
        const auth = await signUp(server, `Senhor ${index}`);
        codes.add(await issueCode(server, auth.accessToken));
      }
      expect(codes.size).toBe(5);
    });
  });

  describe('trocar de máquina', () => {
    it('recuperar devolve a mesma accountId, com sessão nova, e a partida é a mesma', async () => {
      const player = await newPlayer(server, 'Dona Beatriz');
      const code = await issueCode(server, player.token);
      const sessionsBefore = await countRows(
        server.pool,
        'sessions',
        `account_id = '${player.accountId}'`,
      );

      const recovered = await recover(server, code);
      expect(recovered.status).toBe(200);
      expect(recovered.headers['cache-control']).toBe('no-store');
      expect(recovered.body.account.id).toBe(player.accountId);
      expect(recovered.body.account.displayName).toBe('Dona Beatriz');
      expect(recovered.body.account.hasRecoveryCode).toBe(true);

      // Sessão nova: outra família de tokens, não uma cópia da sessão antiga.
      expect(recovered.body.accessToken).not.toBe(player.token);
      expect(recovered.body.refreshToken).not.toBe(player.refreshToken);
      expect(sessionIdOf(recovered.body.accessToken)).not.toBe(sessionIdOf(player.token));
      expect(await countRows(server.pool, 'sessions', `account_id = '${player.accountId}'`)).toBe(
        sessionsBefore + 1,
      );

      const me = await call<Account>(server, 'GET', '/me', { token: recovered.body.accessToken });
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(player.accountId);

      const games = await call<ListGamesResponse>(server, 'GET', '/games', {
        token: recovered.body.accessToken,
      });
      expect(games.status).toBe(200);
      expect(games.body.games.map((game) => [game.id, game.status])).toEqual([
        [player.game.id, 'active'],
      ]);
      expect(await countRows(server.pool, 'games', `account_id = '${player.accountId}'`)).toBe(1);
    });

    it('as sessões antigas continuam válidas depois da recuperação', async () => {
      const clock = fakeClock('2026-11-01T08:00:00.000Z');
      const instance = await createTestApp({ clock });
      try {
        const player: Player = await newPlayer(instance);
        const code = await issueCode(instance, player.token);

        // Dias depois, em outra máquina.
        clock.advance(3 * DAY);
        const recovered = await recover(instance, code);
        expect(recovered.status).toBe(200);
        expect(recovered.body.account.id).toBe(player.accountId);

        // A máquina antiga ainda renova a sessão dela e continua jogando.
        const token = await renew(instance, player);
        const old = await call<Account>(instance, 'GET', '/me', { token });
        expect(old.status).toBe(200);
        expect(old.body.id).toBe(player.accountId);
        expect(
          await countRows(
            instance.pool,
            'sessions',
            `account_id = '${player.accountId}' and revoked_at is not null`,
          ),
        ).toBe(0);

        // E a máquina nova também.
        const fresh = await call<Account>(instance, 'GET', '/me', {
          token: recovered.body.accessToken,
        });
        expect(fresh.status).toBe(200);
      } finally {
        await instance.close();
      }
    });

    it('o código pode ser usado de novo: cada uso cria outra sessão da mesma conta', async () => {
      const player = await newPlayer(server);
      const code = await issueCode(server, player.token);
      const first = await recover(server, code);
      const second = await recover(server, code);
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.body.account.id).toBe(player.accountId);
      expect(sessionIdOf(second.body.accessToken)).not.toBe(sessionIdOf(first.body.accessToken));
    });
  });

  describe('normalização', () => {
    let player: Player;
    let code: string;
    let bare: string;

    beforeAll(async () => {
      player = await newPlayer(server, 'Normaliza');
      code = await issueCode(server, player.token);
      bare = code.replace(/-/g, '');
    });

    const accepted: [string, (displayed: string, normalized: string) => string][] = [
      ['como foi exibido', (displayed) => displayed],
      ['em minúsculas', (displayed) => displayed.toLowerCase()],
      ['sem hífens', (_displayed, normalized) => normalized],
      ['sem hífens e em minúsculas', (_displayed, normalized) => normalized.toLowerCase()],
      ['com hífens a mais', (_displayed, normalized) => normalized.split('').join('-')],
      ['com hífens dobrados e nas pontas', (displayed) => `-${displayed.replace(/-/g, '--')}-`],
      ['com hífens a menos', (displayed) => displayed.replace('-', '')],
      ['com espaços nas pontas', (displayed) => `   ${displayed}  `],
      [
        'com espaços nas pontas, minúsculas e sem hífens',
        (_displayed, normalized) => `  ${normalized.toLowerCase()} `,
      ],
    ];

    it.each(accepted)('aceita o código %s', async (_label, variant) => {
      const reply = await recover(server, variant(code, bare));
      expect(reply.status).toBe(200);
      expect(reply.body.account.id).toBe(player.accountId);
    });

    const malformed: [string, (displayed: string, normalized: string) => string][] = [
      ['vazio', () => ''],
      ['só com hífens e espaços', () => ' ---- '],
      ['com 19 caracteres', (_displayed, normalized) => normalized.slice(0, 19)],
      ['com 21 caracteres', (_displayed, normalized) => `${normalized}A`],
      [
        'com o caractere 0, fora do alfabeto',
        (_displayed, normalized) => `0${normalized.slice(1)}`,
      ],
      [
        'com o caractere O, fora do alfabeto',
        (_displayed, normalized) => `O${normalized.slice(1)}`,
      ],
      [
        'com o caractere 1, fora do alfabeto',
        (_displayed, normalized) => `1${normalized.slice(1)}`,
      ],
      [
        'com o caractere I, fora do alfabeto',
        (_displayed, normalized) => `I${normalized.slice(1)}`,
      ],
      // Só os espaços externos são removidos (§14.7): um espaço no meio invalida o código.
      ['com espaço no meio', (displayed) => displayed.replace('-', ' ')],
      ['com outro separador', (displayed) => displayed.replace(/-/g, '_')],
    ];

    it.each(malformed)('recusa com 401 UNAUTHORIZED o código %s', async (_label, variant) => {
      const sessionsBefore = await countRows(server.pool, 'sessions');
      const reply = await recover(server, variant(code, bare));
      expectUnauthorized(reply);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(await countRows(server.pool, 'sessions')).toBe(sessionsBefore);
    });

    it('formato inválido, código inexistente e conta excluída recebem a mesma resposta', async () => {
      const doomed = await newPlayer(server, 'Vai Embora');
      const doomedCode = await issueCode(server, doomed.token);
      const deleted = await call(server, 'DELETE', '/me', { token: doomed.token });
      expect(deleted.status).toBe(202);

      const invalidFormat = await recover(server, 'não é um código');
      const unknown = await recover(server, 'AAAA-AAAA-AAAA-AAAA-AAAA');
      const ofDeleted = await recover(server, doomedCode);

      for (const reply of [invalidFormat, unknown, ofDeleted]) {
        expectUnauthorized(reply);
        // Nada na resposta identifica a conta.
        const text = JSON.stringify(reply.body);
        expect(text).not.toContain(doomed.accountId);
        expect(text).not.toContain('Vai Embora');
        expect(reply.body).not.toHaveProperty('account');
        expect(reply.body).not.toHaveProperty('accessToken');
      }
      // Os três casos são indistinguíveis para quem chama.
      expect(unknown.body).toEqual(invalidFormat.body);
      expect(ofDeleted.body).toEqual(invalidFormat.body);
    });
  });

  describe('rotação', () => {
    it('gerar de novo invalida o código anterior e não revoga sessões', async () => {
      const player = await newPlayer(server, 'Rotaciona');
      const first = await issueCode(server, player.token);
      // Uma segunda máquina, que entrou pelo primeiro código.
      const otherMachine = await recover(server, first);
      expect(otherMachine.status).toBe(200);

      const second = await issueCode(server, player.token);
      expect(second).toMatch(DISPLAY_FORMAT);
      expect(second).not.toBe(first);
      expect(await storedHash(server, player.accountId)).toBe(expectedHmac(second));

      expectUnauthorized(await recover(server, first));
      const withNew = await recover(server, second);
      expect(withNew.status).toBe(200);
      expect(withNew.body.account.id).toBe(player.accountId);

      // Nenhuma sessão foi revogada: as duas máquinas continuam dentro.
      for (const token of [player.token, otherMachine.body.accessToken]) {
        const me = await call<Account>(server, 'GET', '/me', { token });
        expect(me.status).toBe(200);
        expect(me.body.id).toBe(player.accountId);
      }
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${player.accountId}' and revoked_at is not null`,
        ),
      ).toBe(0);
      // E os refresh tokens antigos continuam rotacionando.
      await renew(server, player);
    });

    it('rotacionar o código de uma conta não afeta o código de outra', async () => {
      const one = await newPlayer(server, 'Primeira');
      const two = await newPlayer(server, 'Segunda');
      const codeOne = await issueCode(server, one.token);
      const codeTwo = await issueCode(server, two.token);
      await issueCode(server, one.token);

      expectUnauthorized(await recover(server, codeOne));
      const reply = await recover(server, codeTwo);
      expect(reply.status).toBe(200);
      expect(reply.body.account.id).toBe(two.accountId);
    });
  });

  describe('independência das chaves', () => {
    it('trocar JWT_SECRET não invalida o Código do Reino', async () => {
      const player = await newPlayer(server, 'Chave JWT');
      const code = await issueCode(server, player.token);

      const rotated = await createTestApp({
        config: { JWT_SECRET: Buffer.alloc(48, 7).toString('base64') },
      });
      try {
        // A troca aconteceu de fato: o access token antigo não vale nesta instância.
        const oldToken = await call(rotated, 'GET', '/me', { token: player.token });
        expect(oldToken.status).toBe(401);

        const recovered = await recover(rotated, code);
        expect(recovered.status).toBe(200);
        expect(recovered.body.account.id).toBe(player.accountId);

        const me = await call<Account>(rotated, 'GET', '/me', {
          token: recovered.body.accessToken,
        });
        expect(me.status).toBe(200);
        expect(me.body.id).toBe(player.accountId);
        const games = await call<ListGamesResponse>(rotated, 'GET', '/games', {
          token: recovered.body.accessToken,
        });
        expect(games.body.games.map((game) => game.id)).toEqual([player.game.id]);
      } finally {
        await rotated.close();
      }
    });

    it('trocar RECOVERY_CODE_SECRET invalida os códigos emitidos', async () => {
      const player = await newPlayer(server, 'Chave Código');
      const code = await issueCode(server, player.token);
      const otherSecret = Buffer.alloc(48, 9).toString('base64');

      const rotated = await createTestApp({ config: { RECOVERY_CODE_SECRET: otherSecret } });
      try {
        expectUnauthorized(await recover(rotated, code));

        // O jogador ainda autenticado emite um código novo, já com a chave nova (ADR 0003).
        const reissued = await issueCode(rotated, player.token);
        expect(await storedHash(rotated, player.accountId)).toBe(
          expectedHmac(reissued, otherSecret),
        );
        const recovered = await recover(rotated, reissued);
        expect(recovered.status).toBe(200);
        expect(recovered.body.account.id).toBe(player.accountId);
      } finally {
        await rotated.close();
      }
    });
  });

  describe('limite de tentativas', () => {
    let limited: TestApp;

    beforeAll(async () => {
      limited = await createTestApp({ config: { RECOVERY_ATTEMPTS_PER_HOUR_PER_IP: '5' } });
    });
    afterAll(async () => {
      await limited.close();
    });

    it('o código errado 6 vezes seguidas devolve 429 RATE_LIMITED', async () => {
      const ip = '203.0.113.10';
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        expectUnauthorized(await recover(limited, 'BBBB-BBBB-BBBB-BBBB-BBBB', ip));
      }
      const sixth = await call<ApiError>(limited, 'POST', '/auth/recover', {
        body: { code: 'BBBB-BBBB-BBBB-BBBB-BBBB' },
        ip,
      });
      expect(sixth.status).toBe(429);
      expect(sixth.body.code).toBe('RATE_LIMITED');
    });

    it('o limite é por IP: o bloqueio de um endereço não atinge outro', async () => {
      const player = await newPlayer(limited, 'Outro IP');
      const code = await issueCode(limited, player.token);
      const blocked = '203.0.113.20';
      for (let attempt = 1; attempt <= 5; attempt += 1) {
        expectUnauthorized(await recover(limited, 'CCCC-CCCC-CCCC-CCCC-CCCC', blocked));
      }

      // Bloqueado, o endereço não entra nem com o código certo.
      const stillBlocked = await recover(limited, code, blocked);
      expect(stillBlocked.status).toBe(429);
      expect((stillBlocked.body as unknown as ApiError).code).toBe('RATE_LIMITED');

      const elsewhere = await recover(limited, code, '203.0.113.21');
      expect(elsewhere.status).toBe(200);
      expect(elsewhere.body.account.id).toBe(player.accountId);
    });

    it('cinco tentativas na hora ainda são atendidas', async () => {
      const player = await newPlayer(limited, 'Cinco Vezes');
      const code = await issueCode(limited, player.token);
      const ip = '203.0.113.30';
      for (let attempt = 1; attempt <= 4; attempt += 1) {
        expectUnauthorized(await recover(limited, 'DDDD-DDDD-DDDD-DDDD-DDDD', ip));
      }
      const fifth = await recover(limited, code, ip);
      expect(fifth.status).toBe(200);
      expect(fifth.body.account.id).toBe(player.accountId);
    });
  });

  describe('conta excluída', () => {
    it('DELETE /me bloqueia a recuperação imediatamente e apaga o HMAC', async () => {
      const player = await newPlayer(server, 'Excluída');
      const code = await issueCode(server, player.token);
      // O código funcionava antes da exclusão.
      const before = await recover(server, code);
      expect(before.status).toBe(200);

      const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: player.token,
      });
      expect(deleted.status).toBe(202);

      const sessionsBefore = await countRows(
        server.pool,
        'sessions',
        `account_id = '${player.accountId}'`,
      );
      expectUnauthorized(await recover(server, code));
      expectUnauthorized(await recover(server, code.toLowerCase().replace(/-/g, '')));

      expect(await storedHash(server, player.accountId)).toBeNull();
      // A tentativa não criou sessão nem desfez a exclusão.
      expect(await countRows(server.pool, 'sessions', `account_id = '${player.accountId}'`)).toBe(
        sessionsBefore,
      );
      expect(
        await countRows(
          server.pool,
          'accounts',
          `id = '${player.accountId}' and deleted_at is not null`,
        ),
      ).toBe(1);
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${player.accountId}' and revoked_at is null`,
        ),
      ).toBe(0);
    });

    it('a recuperação também é bloqueada em outra instância da API', async () => {
      const player = await newPlayer(server, 'Duas Réplicas');
      const code = await issueCode(server, player.token);
      const replica = await createTestApp({ clock: server.clock });
      try {
        expect((await call(server, 'DELETE', '/me', { token: player.token })).status).toBe(202);
        expectUnauthorized(await recover(replica, code));
      } finally {
        await replica.close();
      }
    });

    it('uma conta excluída não gera código novo com um access token ainda não expirado', async () => {
      const player = await newPlayer(server, 'Sem Volta');
      expect((await call(server, 'DELETE', '/me', { token: player.token })).status).toBe(202);
      const reply = await call(server, 'POST', '/auth/recovery-code', { token: player.token });
      expect(reply.status).toBe(401);
      expect(await storedHash(server, player.accountId)).toBeNull();
    });
  });
});
