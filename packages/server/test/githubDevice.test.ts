import type {
  ApiError,
  GithubAuthResponse,
  GithubDevicePollResponse,
  GithubDeviceStartResponse,
  ListGamesResponse,
  VersionResponse,
} from '@lotg/protocol';
import {
  GithubDevicePollResponseSchema,
  GithubDeviceStartResponseSchema,
  VersionResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { call, countRows, createTestApp, newPlayer, type TestApp } from './helpers/app';
import { resetTestDb } from './helpers/db';
import { fakeGithub } from './helpers/github';

// Contrato verificado aqui: GDD §14.5 e §14.7 (device flow do GitHub) e roadmap F3W-T8.
// O servidor só repassa as duas chamadas ao GitHub: sem segredo, sem guardar nada.

const GITHUB = 'https://github.test';
const CLIENT_ID = 'cliente-de-teste';
const TABLES = ['accounts', 'sessions', 'refresh_tokens', 'games', 'commands', 'game_events'];

describe('device flow do GitHub', () => {
  const github = fakeGithub({ api: GITHUB, oauth: GITHUB });
  let server: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    server = await createTestApp({
      fetch: github.fetch,
      config: { GITHUB_OAUTH_URL: GITHUB, GITHUB_CLIENT_ID: CLIENT_ID },
    });
  });
  afterAll(async () => {
    await server.close();
  });
  beforeEach(() => {
    github.reset();
  });

  const start = () => call<GithubDeviceStartResponse>(server, 'POST', '/auth/github/device');
  const poll = (deviceCode: string) =>
    call<GithubDevicePollResponse>(server, 'POST', '/auth/github/device/poll', {
      body: { deviceCode },
    });

  it('GET /version avisa que o vínculo está ligado', async () => {
    const version = await call<VersionResponse>(server, 'GET', '/version');
    expect(VersionResponseSchema.parse(version.body).features).toEqual({ githubDevice: true });
  });

  it('pede o código ao GitHub com o client_id e o escopo read:user, e nenhum segredo', async () => {
    const reply = await start();
    expect(reply.status).toBe(200);
    expect(GithubDeviceStartResponseSchema.parse(reply.body)).toEqual({
      deviceCode: 'dispositivo-1',
      userCode: 'LOTG-0001',
      verificationUri: `${GITHUB}/login/device`,
      expiresInSeconds: 900,
      intervalSeconds: 5,
    });
    expect(reply.headers['cache-control']).toBe('no-store');

    expect(github.calls).toHaveLength(1);
    const sent = github.calls[0]!;
    expect(sent.url).toBe(`${GITHUB}/login/device/code`);
    expect(sent.method).toBe('POST');
    expect(sent.headers.get('accept')).toBe('application/json');
    const form = new URLSearchParams(sent.body);
    expect(Object.fromEntries(form)).toEqual({ client_id: CLIENT_ID, scope: 'read:user' });
    expect(sent.body).not.toMatch(/secret/i);
    expect(sent.headers.get('authorization')).toBeNull();
  });

  it('a consulta repassa o device_code e traduz cada resposta do GitHub', async () => {
    const { body: device } = await start();
    expect((await poll(device.deviceCode)).body).toEqual({ status: 'pending' });

    const sent = github.calls.at(-1)!;
    expect(sent.url).toBe(`${GITHUB}/login/oauth/access_token`);
    expect(Object.fromEntries(new URLSearchParams(sent.body))).toEqual({
      client_id: CLIENT_ID,
      device_code: device.deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });

    github.slowDownNext(device.userCode);
    expect((await poll(device.deviceCode)).body).toEqual({
      status: 'slowDown',
      intervalSeconds: 10,
    });

    const user = github.approve(device.userCode);
    const authorized = await poll(device.deviceCode);
    expect(authorized.status).toBe(200);
    expect(GithubDevicePollResponseSchema.parse(authorized.body)).toEqual({
      status: 'authorized',
      githubAccessToken: user.token,
    });
    expect(authorized.headers['cache-control']).toBe('no-store');
  });

  it('recusa e expiração chegam como desfechos, não como erros', async () => {
    const first = (await start()).body;
    github.deny(first.userCode);
    expect((await poll(first.deviceCode)).body).toEqual({ status: 'denied' });

    const second = (await start()).body;
    github.expire(second.userCode);
    expect((await poll(second.deviceCode)).body).toEqual({ status: 'expired' });

    // Um código que o GitHub não conhece é tratado como vencido: pede-se outro.
    expect((await poll('inventado')).body).toEqual({ status: 'expired' });
  });

  it('o fluxo inteiro: código, confirmação, vínculo e a mesma conta em outro navegador', async () => {
    const player = await newPlayer(server);
    const device = (await start()).body;
    const user = github.approve(device.userCode);
    const token = (await poll(device.deviceCode)).body as { githubAccessToken: string };

    const linked = await call<GithubAuthResponse>(server, 'POST', '/auth/github', {
      token: player.token,
      body: { githubAccessToken: token.githubAccessToken },
    });
    expect(linked.status).toBe(200);
    expect(linked.body.account).toMatchObject({ id: player.accountId, linked: { github: true } });

    // Outro navegador, sem sessão: o mesmo GitHub devolve a mesma conta, com o mesmo feudo.
    const again = (await start()).body;
    github.approve(again.userCode, user);
    const second = (await poll(again.deviceCode)).body as { githubAccessToken: string };
    const signedIn = await call<GithubAuthResponse>(server, 'POST', '/auth/github', {
      body: { githubAccessToken: second.githubAccessToken },
    });
    expect(signedIn.status).toBe(200);
    expect(signedIn.body.account.id).toBe(player.accountId);
    expect(typeof signedIn.body.accessToken).toBe('string');
    const games = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: signedIn.body.accessToken,
    });
    expect(games.body.games.map((game) => game.id)).toEqual([player.game.id]);
  });

  it('nada do device flow é guardado: nenhuma linha muda no banco', async () => {
    const before = await Promise.all(TABLES.map((table) => countRows(server.pool, table)));
    const device = (await start()).body;
    github.approve(device.userCode);
    const authorized = (await poll(device.deviceCode)).body as { githubAccessToken: string };
    const after = await Promise.all(TABLES.map((table) => countRows(server.pool, table)));
    expect(after).toEqual(before);

    const { rows } = await server.pool.query<{ found: boolean }>(
      `select exists (
         select 1 from accounts where to_jsonb(accounts)::text like '%' || $1 || '%'
       ) as found`,
      [authorized.githubAccessToken],
    );
    expect(rows[0]?.found).toBe(false);
  });

  it('corpo inválido na consulta é 400, sem chamar o GitHub', async () => {
    for (const body of [{}, { deviceCode: '' }, { deviceCode: 'x', extra: 1 }, { deviceCode: 7 }]) {
      const reply = await call<ApiError>(server, 'POST', '/auth/github/device/poll', { body });
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
    }
    expect(github.calls).toHaveLength(0);
  });

  it('GitHub fora do ar ou respondendo lixo vira erro claro, sem derrubar o servidor', async () => {
    github.setDown(true);
    const down = await call<ApiError>(server, 'POST', '/auth/github/device');
    expect(down.status).toBe(500);
    expect(down.body.code).toBe('INTERNAL');
    expect(down.body.message).toContain('GitHub');
    const pollDown = await call<ApiError>(server, 'POST', '/auth/github/device/poll', {
      body: { deviceCode: 'x' },
    });
    expect(pollDown.status).toBe(500);
    github.setDown(false);
    expect((await start()).status).toBe(200);
  });
});

describe('device flow: respostas inesperadas do GitHub', () => {
  it('device flow desligado no OAuth App, HTML no lugar de JSON e endereço de outro site', async () => {
    const answers: Array<() => Response> = [
      () => Response.json({ error: 'device_flow_disabled' }),
      () => new Response('<html>erro</html>', { status: 502 }),
      () =>
        Response.json({
          device_code: 'd',
          user_code: 'ABCD-1234',
          // Um endereço que não é o do GitHub configurado nunca vira link na tela do jogador.
          verification_uri: 'https://malicioso.test/login/device',
          expires_in: 900,
          interval: 5,
        }),
      () => Response.json({ error: 'unsupported_grant_type' }),
    ];
    const server = await createTestApp({
      fetch: async () => answers.shift()!(),
      config: { GITHUB_OAUTH_URL: GITHUB, GITHUB_CLIENT_ID: CLIENT_ID },
    });
    try {
      for (let index = 0; index < 3; index += 1) {
        const reply = await call<ApiError>(server, 'POST', '/auth/github/device');
        expect(reply.status).toBe(500);
        expect(reply.body.code).toBe('INTERNAL');
      }
      const poll = await call<ApiError>(server, 'POST', '/auth/github/device/poll', {
        body: { deviceCode: 'd' },
      });
      expect(poll.status).toBe(500);
    } finally {
      await server.close();
    }
  });
});

describe('device flow: limite por IP', () => {
  it('o começo do fluxo tem limite por hora por IP, separado para cada IP', async () => {
    const github = fakeGithub({ api: GITHUB, oauth: GITHUB });
    const server = await createTestApp({
      fetch: github.fetch,
      config: {
        GITHUB_OAUTH_URL: GITHUB,
        GITHUB_CLIENT_ID: CLIENT_ID,
        GITHUB_DEVICE_STARTS_PER_HOUR_PER_IP: '2',
      },
    });
    try {
      const from = (ip: string) => call<ApiError>(server, 'POST', '/auth/github/device', { ip });
      expect((await from('203.0.113.7')).status).toBe(200);
      expect((await from('203.0.113.7')).status).toBe(200);
      const limited = await from('203.0.113.7');
      expect(limited.status).toBe(429);
      expect(limited.body.code).toBe('RATE_LIMITED');
      expect((await from('203.0.113.8')).status).toBe(200);
      expect(github.calls).toHaveLength(3);
    } finally {
      await server.close();
    }
  });

  it('a consulta tem limite por minuto por IP', async () => {
    const github = fakeGithub({ api: GITHUB, oauth: GITHUB });
    const server = await createTestApp({
      fetch: github.fetch,
      config: { GITHUB_OAUTH_URL: GITHUB, GITHUB_CLIENT_ID: CLIENT_ID },
    });
    try {
      const statuses: number[] = [];
      for (let attempt = 0; attempt < 31; attempt += 1) {
        const reply = await call(server, 'POST', '/auth/github/device/poll', {
          body: { deviceCode: 'x' },
          ip: '203.0.113.9',
        });
        statuses.push(reply.status);
      }
      expect(statuses.slice(0, 30).every((status) => status === 200)).toBe(true);
      expect(statuses[30]).toBe(429);
    } finally {
      await server.close();
    }
  });
});

describe('servidor sem GITHUB_CLIENT_ID', () => {
  it('as duas rotas respondem 404, /version avisa e o GitHub nunca é chamado', async () => {
    const github = fakeGithub({ api: GITHUB, oauth: GITHUB });
    const server = await createTestApp({ fetch: github.fetch });
    try {
      const startReply = await call<ApiError>(server, 'POST', '/auth/github/device');
      expect(startReply.status).toBe(404);
      expect(startReply.body.code).toBe('NOT_FOUND');
      const pollReply = await call<ApiError>(server, 'POST', '/auth/github/device/poll', {
        body: { deviceCode: 'x' },
      });
      expect(pollReply.status).toBe(404);
      const version = await call<VersionResponse>(server, 'GET', '/version');
      expect(version.body.features).toEqual({ githubDevice: false });
      expect(github.calls).toHaveLength(0);
    } finally {
      await server.close();
    }
  });
});
