import type {
  Account,
  AccountConflictDetails,
  ApiError,
  CommandAccepted,
  GithubAuthResponse,
  ListGamesResponse,
} from '@lotg/protocol';
import { AccountConflictDetailsSchema } from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  newPlayer,
  order,
  type Player,
  renew,
  type Reply,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Contrato verificado aqui: GDD §14.7 ("Vínculo GitHub", "Sair desta máquina", "Excluir conta"),
// ADR 0005 e roadmap F2-T5.3 e F2-T5.4.

// O mesmo valor que `testConfig` põe em GITHUB_API_URL.
const GITHUB_API_URL = 'https://github.test';
const TABLES = [
  'accounts',
  'sessions',
  'refresh_tokens',
  'games',
  'commands',
  'game_events',
  'chronicles',
];

type GithubCall = { url: string; method: string; headers: Headers };

/** GitHub falso: conhece alguns tokens e responde 401 para todos os outros. */
function fakeGithub() {
  const users = new Map<string, number>();
  const calls: GithubCall[] = [];
  let nextId = 5_000_001;

  const fetchFn: typeof fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined),
    );
    calls.push({ url, method: (init?.method ?? 'GET').toUpperCase(), headers });

    const token = /^Bearer (.+)$/.exec(headers.get('authorization') ?? '')?.[1];
    const id = token === undefined ? undefined : users.get(token);
    if (url !== `${GITHUB_API_URL}/user` || id === undefined) {
      return Promise.resolve(
        new Response(JSON.stringify({ message: 'Bad credentials' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      );
    }
    return Promise.resolve(
      new Response(JSON.stringify({ id, login: `senhor-${id}`, name: 'Nome no GitHub' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
  };

  return {
    fetch: fetchFn,
    calls,
    /** Registra uma pessoa nova no GitHub e devolve o token e o id dela. */
    newUser(): { token: string; id: number } {
      const id = nextId;
      nextId += 1;
      const token = `gho_token_secreto_${id}_${'x'.repeat(20)}`;
      users.set(token, id);
      return { token, id };
    },
  };
}

function sessionIdOf(accessToken: string): string {
  const payload = accessToken.split('.')[1] ?? '';
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { sid: string };
  return claims.sid;
}

describe('vínculo com o GitHub', () => {
  let server: TestApp;
  const github = fakeGithub();

  beforeAll(async () => {
    await resetTestDb();
    server = await createTestApp({ fetch: github.fetch });
  });
  afterAll(async () => {
    await server.close();
  });
  beforeEach(() => {
    github.calls.length = 0;
  });

  function githubAuth<T = GithubAuthResponse>(
    githubAccessToken: string,
    options: { token?: string; resolve?: 'useExisting' | 'keepCurrent' } = {},
  ): Promise<Reply<T>> {
    return call<T>(server, 'POST', '/auth/github', {
      ...(options.token !== undefined ? { token: options.token } : {}),
      body: {
        githubAccessToken,
        deviceLabel: 'outra máquina',
        ...(options.resolve !== undefined ? { resolve: options.resolve } : {}),
      },
    });
  }

  async function githubIdOf(accountId: string): Promise<string | null> {
    const { rows } = await server.pool.query<{ github_id: string | null }>(
      'select github_id from accounts where id = $1',
      [accountId],
    );
    return rows[0]?.github_id ?? null;
  }

  async function dumpDatabase(): Promise<string> {
    const parts: string[] = [];
    for (const table of TABLES) {
      const { rows } = await server.pool.query<{ dump: string }>(
        `select coalesce(string_agg(row_to_json(t)::text, E'\\n'), '') as dump from ${table} t`,
      );
      parts.push(rows[0]?.dump ?? '');
    }
    return parts.join('\n');
  }

  async function gamesOf(accountId: string): Promise<[string, string][]> {
    const { rows } = await server.pool.query<{ id: string; status: string }>(
      'select id, status from games where account_id = $1 order by created_at, id',
      [accountId],
    );
    return rows.map((row) => [row.id, row.status]);
  }

  /** Uma conta já vinculada ao GitHub, com partida: a "conta existente" dos casos de conflito. */
  async function linkedPlayer(displayName: string) {
    const player = await newPlayer(server, displayName);
    const user = github.newUser();
    const reply = await githubAuth(user.token, { token: player.token });
    if (reply.status !== 200) {
      throw new Error(`Falha ao vincular a conta de teste: ${reply.status}`);
    }
    return { player, user };
  }

  /** Dá progresso a uma conta: um comando aceito na partida dela. */
  async function play(player: Player): Promise<void> {
    const reply = await send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    if (reply.status !== 200) {
      throw new Error(`Falha ao dar progresso à conta de teste: ${reply.status}`);
    }
  }

  describe('validação do token no GitHub', () => {
    it('chama ${GITHUB_API_URL}/user com os cabeçalhos do contrato', async () => {
      const player = await newPlayer(server);
      const user = github.newUser();
      const reply = await githubAuth(user.token, { token: player.token });
      expect(reply.status).toBe(200);

      expect(github.calls).toHaveLength(1);
      const [request] = github.calls;
      expect(request?.url).toBe(`${GITHUB_API_URL}/user`);
      expect(request?.method).toBe('GET');
      expect(request?.headers.get('authorization')).toBe(`Bearer ${user.token}`);
      expect(request?.headers.get('accept')).toBe('application/vnd.github+json');
      expect(request?.headers.get('user-agent')).toBe('lords-of-the-guild-server');
    });

    it('guarda só o github_id: o token do GitHub não aparece em nenhuma coluna', async () => {
      const player = await newPlayer(server);
      const user = github.newUser();
      const linked = await githubAuth(user.token, { token: player.token });
      expect(linked.status).toBe(200);
      // Também depois de um login, que cria sessão e refresh token.
      const signedIn = await githubAuth(user.token);
      expect(signedIn.status).toBe(200);

      expect(await githubIdOf(player.accountId)).toBe(String(user.id));
      const dump = await dumpDatabase();
      expect(dump).not.toContain(user.token);
      expect(dump).not.toContain('gho_token_secreto');
      // Nada mais do perfil do GitHub é guardado.
      expect(dump).not.toContain(`senhor-${user.id}`);
      expect(dump).not.toContain('Nome no GitHub');
      // E o token não volta em nenhuma resposta.
      expect(JSON.stringify(linked.body)).not.toContain(user.token);
      expect(JSON.stringify(signedIn.body)).not.toContain(user.token);
    });

    it('token recusado pelo GitHub → 401 GITHUB_TOKEN_INVALID, sem sessão', async () => {
      const accountsBefore = await countRows(server.pool, 'accounts');
      const sessionsBefore = await countRows(server.pool, 'sessions');
      const reply = await githubAuth<ApiError>('gho_token_que_o_github_recusa');
      expect(reply.status).toBe(401);
      expect(reply.body.code).toBe('GITHUB_TOKEN_INVALID');
      expect(github.calls).toHaveLength(1);
      expect(await countRows(server.pool, 'accounts')).toBe(accountsBefore);
      expect(await countRows(server.pool, 'sessions')).toBe(sessionsBefore);
    });

    it('token recusado com chamador autenticado → 401 GITHUB_TOKEN_INVALID e nada é vinculado', async () => {
      const player = await newPlayer(server);
      const reply = await githubAuth<ApiError>('gho_outro_token_recusado', {
        token: player.token,
      });
      expect(reply.status).toBe(401);
      expect(reply.body.code).toBe('GITHUB_TOKEN_INVALID');

      // A sessão do jogador segue válida: o erro é do token do GitHub, não da sessão.
      const me = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(me.status).toBe(200);
      expect(me.body.linked.github).toBe(false);
      expect(await githubIdOf(player.accountId)).toBeNull();
    });
  });

  describe('caso (a): autenticado e github_id livre', () => {
    it('vincula a conta atual: linked.github vira true em GET /me', async () => {
      const player = await newPlayer(server, 'Dona Ana');
      const before = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(before.body.linked.github).toBe(false);

      const user = github.newUser();
      const reply = await githubAuth(user.token, { token: player.token });
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.body.account.id).toBe(player.accountId);
      expect(reply.body.account.linked.github).toBe(true);
      // O nome continua o do jogo, não o do perfil do GitHub.
      expect(reply.body.account.displayName).toBe('Dona Ana');

      const after = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(after.status).toBe(200);
      expect(after.body.linked.github).toBe(true);
      expect(await githubIdOf(player.accountId)).toBe(String(user.id));
      // Vincular não mexe na partida.
      expect(await gamesOf(player.accountId)).toEqual([[player.game.id, 'active']]);
    });
  });

  describe('caso (b): não autenticado e github_id conhecido', () => {
    it('entra na conta existente com tokens novos, e a mesma partida aparece', async () => {
      const { player, user } = await linkedPlayer('Dom Bento');
      const sessionsBefore = await countRows(
        server.pool,
        'sessions',
        `account_id = '${player.accountId}'`,
      );
      const accountsBefore = await countRows(server.pool, 'accounts');

      const reply = await githubAuth(user.token);
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.body.account.id).toBe(player.accountId);
      expect(reply.body.account.displayName).toBe('Dom Bento');
      expect(reply.body.account.linked.github).toBe(true);

      const { accessToken, refreshToken } = reply.body;
      expect(accessToken).toEqual(expect.any(String));
      expect(refreshToken).toEqual(expect.any(String));
      expect(reply.body.expiresIn).toBeGreaterThan(0);
      expect(accessToken).not.toBe(player.token);
      expect(refreshToken).not.toBe(player.refreshToken);
      expect(sessionIdOf(accessToken ?? '')).not.toBe(sessionIdOf(player.token));

      // Sessão nova na mesma conta; nenhuma conta nova nasceu.
      expect(await countRows(server.pool, 'accounts')).toBe(accountsBefore);
      expect(await countRows(server.pool, 'sessions', `account_id = '${player.accountId}'`)).toBe(
        sessionsBefore + 1,
      );

      const games = await call<ListGamesResponse>(server, 'GET', '/games', { token: accessToken });
      expect(games.status).toBe(200);
      expect(games.body.games.map((game) => [game.id, game.status])).toEqual([
        [player.game.id, 'active'],
      ]);

      // A máquina antiga continua dentro, e o refresh token novo funciona.
      const old = await call<Account>(server, 'GET', '/me', { token: player.token });
      expect(old.status).toBe(200);
      const fresh = { token: accessToken ?? '', refreshToken: refreshToken ?? '' };
      await renew(server, fresh);
      const me = await call<Account>(server, 'GET', '/me', { token: fresh.token });
      expect(me.body.id).toBe(player.accountId);
    });
  });

  describe('caso (c): autenticado, conta anônima, github_id de outra conta', () => {
    it('409 ACCOUNT_CONFLICT com currentHasProgress verdadeiro quando a conta atual jogou', async () => {
      const { player: existing, user } = await linkedPlayer('Feudo Antigo');
      const current = await newPlayer(server, 'Feudo Novo');
      await play(current);

      const reply = await githubAuth<ApiError>(user.token, { token: current.token });
      expect(reply.status).toBe(409);
      expect(reply.body.code).toBe('ACCOUNT_CONFLICT');
      expect(AccountConflictDetailsSchema.safeParse(reply.body.details).error).toBeUndefined();
      expect(reply.body.details).toEqual({
        existingDisplayName: 'Feudo Antigo',
        currentHasProgress: true,
      } satisfies AccountConflictDetails);
      // Só o nome de exibição da outra conta é revelado.
      expect(JSON.stringify(reply.body)).not.toContain(existing.accountId);

      // Sem `resolve`, nada muda em nenhuma das duas contas.
      expect(await githubIdOf(existing.accountId)).toBe(String(user.id));
      expect(await githubIdOf(current.accountId)).toBeNull();
      expect(
        await countRows(
          server.pool,
          'accounts',
          `id = '${current.accountId}' and deleted_at is null`,
        ),
      ).toBe(1);
      expect((await call(server, 'GET', '/me', { token: current.token })).status).toBe(200);
      expect((await call(server, 'GET', '/me', { token: existing.token })).status).toBe(200);
      expect(await gamesOf(current.accountId)).toEqual([[current.game.id, 'active']]);
      expect(await gamesOf(existing.accountId)).toEqual([[existing.game.id, 'active']]);
    });

    it('409 ACCOUNT_CONFLICT com currentHasProgress falso quando a conta atual acabou de nascer', async () => {
      const { user } = await linkedPlayer('Feudo Velho');
      // Conta anônima recém-criada, sem partida e sem nenhum comando.
      const current = await signUp(server, 'Recém Chegado');

      const reply = await githubAuth<ApiError>(user.token, { token: current.accessToken });
      expect(reply.status).toBe(409);
      expect(reply.body.code).toBe('ACCOUNT_CONFLICT');
      expect(reply.body.details).toEqual({
        existingDisplayName: 'Feudo Velho',
        currentHasProgress: false,
      } satisfies AccountConflictDetails);
    });

    it("resolve 'useExisting': a conta atual sofre a exclusão do DELETE /me e a resposta traz sessão da existente", async () => {
      const { player: existing, user } = await linkedPlayer('Feudo Mantido');
      const current = await newPlayer(server, 'Feudo Descartado');
      await play(current);
      // A conta descartada tem duas sessões e um Código do Reino: tudo isso cai junto.
      const code = await call<{ code: string }>(server, 'POST', '/auth/recovery-code', {
        token: current.token,
      });
      expect(code.status).toBe(200);
      const secondMachine = await call<GithubAuthResponse>(server, 'POST', '/auth/recover', {
        body: { code: code.body.code },
      });
      expect(secondMachine.status).toBe(200);

      expect((await githubAuth(user.token, { token: current.token })).status).toBe(409);
      const reply = await githubAuth(user.token, { token: current.token, resolve: 'useExisting' });
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toBe('no-store');
      expect(reply.body.account.id).toBe(existing.accountId);
      expect(reply.body.account.displayName).toBe('Feudo Mantido');
      expect(reply.body.account.linked.github).toBe(true);
      expect(reply.body.accessToken).toEqual(expect.any(String));
      expect(reply.body.refreshToken).toEqual(expect.any(String));

      // A mesma exclusão transacional de F2-T4.4 na conta descartada (§14.7, "Excluir conta"):
      // deleted_at gravado, todas as sessões revogadas, HMAC apagado e partidas arquivadas.
      const { rows } = await server.pool.query<{
        deleted_at: Date | null;
        recovery_code_hash: string | null;
      }>('select deleted_at, recovery_code_hash from accounts where id = $1', [current.accountId]);
      expect(rows[0]?.deleted_at).toEqual(server.clock.now());
      expect(rows[0]?.recovery_code_hash).toBeNull();
      expect(await countRows(server.pool, 'sessions', `account_id = '${current.accountId}'`)).toBe(
        2,
      );
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${current.accountId}' and revoked_at is null`,
        ),
      ).toBe(0);
      expect(await gamesOf(current.accountId)).toEqual([[current.game.id, 'archived']]);

      // A conta descartada fica inacessível por qualquer credencial.
      for (const token of [current.token, secondMachine.body.accessToken]) {
        expect((await call(server, 'GET', '/me', { token })).status).toBe(401);
      }
      const refreshed = await call(server, 'POST', '/auth/refresh', {
        body: { refreshToken: current.refreshToken },
      });
      expect(refreshed.status).toBe(401);
      const recovered = await call<ApiError>(server, 'POST', '/auth/recover', {
        body: { code: code.body.code },
      });
      expect(recovered.status).toBe(401);
      expect(recovered.body.code).toBe('UNAUTHORIZED');

      // A sessão devolvida é da conta existente, com a partida dela e só a dela: nada foi mesclado.
      const token = reply.body.accessToken;
      const me = await call<Account>(server, 'GET', '/me', { token });
      expect(me.status).toBe(200);
      expect(me.body.id).toBe(existing.accountId);
      const games = await call<ListGamesResponse>(server, 'GET', '/games', { token });
      expect(games.body.games.map((game) => [game.id, game.status])).toEqual([
        [existing.game.id, 'active'],
      ]);
      expect(await gamesOf(existing.accountId)).toEqual([[existing.game.id, 'active']]);
      expect(await countRows(server.pool, 'commands', `account_id = '${existing.accountId}'`)).toBe(
        0,
      );
      expect(await countRows(server.pool, 'commands', `account_id = '${current.accountId}'`)).toBe(
        1,
      );
      expect(await githubIdOf(existing.accountId)).toBe(String(user.id));

      // A sessão antiga da conta existente não foi tocada.
      expect((await call(server, 'GET', '/me', { token: existing.token })).status).toBe(200);
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${existing.accountId}' and revoked_at is not null`,
        ),
      ).toBe(0);
    });

    it("resolve 'keepCurrent': o vínculo migra para a conta atual e a outra fica sem vínculo", async () => {
      const { player: existing, user } = await linkedPlayer('Feudo Deixado');
      await play(existing);
      const current = await newPlayer(server, 'Feudo Escolhido');
      await play(current);

      expect((await githubAuth(user.token, { token: current.token })).status).toBe(409);
      const reply = await githubAuth(user.token, { token: current.token, resolve: 'keepCurrent' });
      expect(reply.status).toBe(200);
      expect(reply.body.account.id).toBe(current.accountId);
      expect(reply.body.account.displayName).toBe('Feudo Escolhido');
      expect(reply.body.account.linked.github).toBe(true);

      expect(await githubIdOf(current.accountId)).toBe(String(user.id));
      expect(await githubIdOf(existing.accountId)).toBeNull();

      // Nenhuma das duas contas foi excluída; as duas sessões seguem válidas.
      expect(
        await countRows(
          server.pool,
          'accounts',
          `id in ('${current.accountId}', '${existing.accountId}') and deleted_at is null`,
        ),
      ).toBe(2);
      const mine = await call<Account>(server, 'GET', '/me', { token: current.token });
      expect(mine.status).toBe(200);
      expect(mine.body.linked.github).toBe(true);
      const theirs = await call<Account>(server, 'GET', '/me', { token: existing.token });
      expect(theirs.status).toBe(200);
      expect(theirs.body.id).toBe(existing.accountId);
      expect(theirs.body.linked.github).toBe(false);

      // Estados não se mesclam: cada partida e cada comando continuam na sua conta.
      expect(await gamesOf(current.accountId)).toEqual([[current.game.id, 'active']]);
      expect(await gamesOf(existing.accountId)).toEqual([[existing.game.id, 'active']]);
      expect(await countRows(server.pool, 'commands', `account_id = '${current.accountId}'`)).toBe(
        1,
      );
      expect(await countRows(server.pool, 'commands', `account_id = '${existing.accountId}'`)).toBe(
        1,
      );
      const games = await call<ListGamesResponse>(server, 'GET', '/games', {
        token: existing.token,
      });
      expect(games.body.games.map((game) => game.id)).toEqual([existing.game.id]);

      // Daqui em diante, entrar pelo GitHub em outra máquina leva à conta que ficou com o vínculo.
      const signedIn = await githubAuth(user.token);
      expect(signedIn.status).toBe(200);
      expect(signedIn.body.account.id).toBe(current.accountId);
    });
  });

  describe('conta excluída', () => {
    it('depois de DELETE /me em uma conta vinculada, o login pelo GitHub não a restaura', async () => {
      const { player, user } = await linkedPlayer('Feudo Extinto');
      // O login funcionava antes da exclusão.
      expect((await githubAuth(user.token)).status).toBe(200);

      const deleted = await call(server, 'DELETE', '/me', { token: player.token });
      expect(deleted.status).toBe(202);
      const sessionsBefore = await countRows(
        server.pool,
        'sessions',
        `account_id = '${player.accountId}'`,
      );

      const reply = await githubAuth<ApiError>(user.token);
      // A documentação só garante que a conta não volta; o código do erro não é definido.
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.status).toBeLessThan(500);
      expect(reply.body).not.toHaveProperty('accessToken');
      expect(reply.body).not.toHaveProperty('refreshToken');
      expect(reply.body).not.toHaveProperty('account');
      expect(JSON.stringify(reply.body)).not.toContain(player.accountId);
      expect(JSON.stringify(reply.body)).not.toContain('Feudo Extinto');

      expect(
        await countRows(
          server.pool,
          'accounts',
          `id = '${player.accountId}' and deleted_at is not null`,
        ),
      ).toBe(1);
      expect(await countRows(server.pool, 'sessions', `account_id = '${player.accountId}'`)).toBe(
        sessionsBefore,
      );
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${player.accountId}' and revoked_at is null`,
        ),
      ).toBe(0);
      expect(await gamesOf(player.accountId)).toEqual([[player.game.id, 'archived']]);
      expect((await call(server, 'GET', '/me', { token: player.token })).status).toBe(401);
    });

    it('uma conta nova com o mesmo GitHub não herda nem reativa a conta excluída', async () => {
      const { player: gone, user } = await linkedPlayer('Feudo Apagado');
      expect((await call(server, 'DELETE', '/me', { token: gone.token })).status).toBe(202);

      const fresh = await newPlayer(server, 'Feudo Recomeço');
      const reply = await githubAuth<GithubAuthResponse | ApiError>(user.token, {
        token: fresh.token,
      });
      // Seja qual for a resposta, ela nunca entrega a conta excluída.
      expect(JSON.stringify(reply.body)).not.toContain(gone.accountId);
      expect(JSON.stringify(reply.body)).not.toContain('Feudo Apagado');
      expect(
        await countRows(
          server.pool,
          'accounts',
          `id = '${gone.accountId}' and deleted_at is not null`,
        ),
      ).toBe(1);
      expect(
        await countRows(
          server.pool,
          'sessions',
          `account_id = '${gone.accountId}' and revoked_at is null`,
        ),
      ).toBe(0);
      expect(await gamesOf(gone.accountId)).toEqual([[gone.game.id, 'archived']]);
      expect(await gamesOf(fresh.accountId)).toEqual([[fresh.game.id, 'active']]);

      // Depois disso, um login pelo GitHub também não chega à conta excluída.
      const signedIn = await githubAuth<GithubAuthResponse | ApiError>(user.token);
      expect(JSON.stringify(signedIn.body)).not.toContain(gone.accountId);
    });

    it('o access token de uma conta excluída não serve para vincular nem para resolver conflito', async () => {
      const { player: existing, user } = await linkedPlayer('Feudo Intacto');
      const doomed = await newPlayer(server, 'Feudo Perdido');
      expect((await call(server, 'DELETE', '/me', { token: doomed.token })).status).toBe(202);

      for (const resolve of [undefined, 'useExisting', 'keepCurrent'] as const) {
        const reply = await githubAuth<ApiError>(user.token, {
          token: doomed.token,
          ...(resolve !== undefined ? { resolve } : {}),
        });
        expect(reply.status).toBe(401);
        expect(reply.body).not.toHaveProperty('accessToken');
      }
      expect(await githubIdOf(existing.accountId)).toBe(String(user.id));
      expect(await githubIdOf(doomed.accountId)).toBeNull();
    });
  });

  describe('ambiguidade da documentação', () => {
    it('não autenticado com github_id desconhecido: registra a resposta, sem criar conta nem sessão', async () => {
      // GDD §14.7 e F2-T5.3 definem os casos (a), (b) e (c), mas não este. Aqui só se exige o que
      // decorre do restante do contrato: nenhuma conta nasce por este caminho (contas anônimas
      // nascem em POST /auth/anonymous) e nenhuma sessão é entregue.
      const user = github.newUser();
      const accountsBefore = await countRows(server.pool, 'accounts');
      const sessionsBefore = await countRows(server.pool, 'sessions');

      const reply = await githubAuth<ApiError>(user.token);

      // Comportamento observado em 2026-10-01: 404 NOT_FOUND.
      expect(reply.status).toBeGreaterThanOrEqual(400);
      expect(reply.status).toBeLessThan(500);
      expect(reply.body.code).toEqual(expect.any(String));
      expect(reply.body).not.toHaveProperty('accessToken');
      expect(await countRows(server.pool, 'accounts')).toBe(accountsBefore);
      expect(await countRows(server.pool, 'sessions')).toBe(sessionsBefore);
      expect(await countRows(server.pool, 'accounts', `github_id = '${user.id}'`)).toBe(0);
    });
  });
});
