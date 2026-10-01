import type { Command, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { createClient } from './client';
import { ApiClientError, GameRuleClientError, isGameRuleError, NetworkError } from './errors';
import { withRetry } from './retry';
import { memoryTokenStore, type StoredTokens } from './tokens';

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };
type Reply = { status: number; body?: unknown; headers?: Record<string, string> } | 'network';
type Handler = (call: Call) => Reply | Promise<Reply>;

const gameId = '0b2f7d0e-6f0a-4c35-9f43-6f5a0c1d2e3f';
const view = { settlement: { name: 'Pedra Alta' } } as unknown as ViewState;
const tokens: StoredTokens = { accessToken: 'jwt-velho', refreshToken: 'R0' };
const order: Command = {
  commandId: '11111111-1111-4111-8111-111111111111',
  type: 'setWorkers',
  payload: { building: 'farm', count: 2 },
};

/** Servidor de mentira: registra as chamadas e responde o que o teste mandar. */
function setup(handler: Handler, initial: StoredTokens | null = tokens) {
  const calls: Call[] = [];
  const waits: number[] = [];
  const tokenStore = memoryTokenStore(initial);
  let unauthenticated = 0;
  const fakeFetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call: Call = {
      method: init?.method ?? 'GET',
      path: String(url).replace('http://servidor/v1', ''),
      headers: { ...(init?.headers as Record<string, string>) },
      body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
    };
    calls.push(call);
    const reply = await handler(call);
    if (reply === 'network') {
      throw new TypeError('fetch failed');
    }
    return new Response(reply.body === undefined ? null : JSON.stringify(reply.body), {
      status: reply.status,
      headers: reply.headers ?? {},
    });
  }) as typeof fetch;
  const client = createClient({
    baseUrl: 'http://servidor/',
    tokenStore,
    clientVersion: 'teste/0.1.0',
    fetch: fakeFetch,
    onUnauthenticated: () => {
      unauthenticated += 1;
    },
    sleep: async (ms) => {
      waits.push(ms);
    },
  });
  return {
    client,
    calls,
    waits,
    tokenStore,
    unauthenticatedCount: () => unauthenticated,
    callsTo: (path: string) => calls.filter((call) => call.path === path),
  };
}

const unauthorized = { status: 401, body: { code: 'UNAUTHORIZED', message: 'expirou' } };
const revoked = { status: 401, body: { code: 'SESSION_REVOKED', message: 'encerrada' } };
const renewed = {
  status: 200,
  body: { accessToken: 'jwt-novo', refreshToken: 'R1', expiresIn: 900 },
};
const account = {
  id: gameId,
  displayName: 'Gustavo',
  linked: { github: false },
  hasRecoveryCode: false,
  createdAt: '2026-10-01T12:00:00.000Z',
};

describe('cabeçalhos e sessão', () => {
  it('envia a versão do protocolo, a do cliente e o token nas chamadas autenticadas', async () => {
    const { client, calls } = setup(() => ({ status: 200, body: account }));
    await client.getMe();
    expect(calls[0]).toMatchObject({ method: 'GET', path: '/me' });
    expect(calls[0]?.headers).toMatchObject({
      'x-lords-protocol': '1',
      'x-lords-client': 'teste/0.1.0',
      authorization: 'Bearer jwt-velho',
    });
  });

  it('não envia credencial em rotas abertas', async () => {
    const { client, calls } = setup(() => ({ status: 200, body: { status: 'ok', db: 'ok' } }));
    await client.health();
    expect(calls[0]?.headers.authorization).toBeUndefined();
  });

  it('"Jogar agora" guarda os dois tokens juntos', async () => {
    const { client, tokenStore, calls } = setup(
      () => ({
        status: 201,
        body: { account, accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
      }),
      null,
    );
    const auth = await client.signUpAnonymous({ displayName: 'Gustavo' });
    expect(auth.account.displayName).toBe('Gustavo');
    expect(await tokenStore.get()).toEqual({ accessToken: 'a', refreshToken: 'r' });
    expect(calls[0]).toMatchObject({ path: '/auth/anonymous', body: { displayName: 'Gustavo' } });
  });

  it('sem sessão nesta máquina, uma chamada autenticada nem sai e avisa o chamador', async () => {
    const { client, calls, unauthenticatedCount } = setup(
      () => ({ status: 200, body: account }),
      null,
    );
    await expect(client.getMe()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 });
    expect(calls).toEqual([]);
    expect(unauthenticatedCount()).toBe(1);
  });

  it('sair revoga a sessão e apaga as credenciais, mesmo se o servidor falhar', async () => {
    const ok = setup(() => ({ status: 204 }));
    await ok.client.logout();
    expect(await ok.tokenStore.get()).toBeNull();

    const offline = setup(() => 'network');
    await expect(offline.client.logout()).rejects.toBeInstanceOf(NetworkError);
    expect(await offline.tokenStore.get()).toBeNull();
  });

  it('excluir a conta apaga as credenciais locais', async () => {
    const body = { deletedAt: '2026-10-01T12:00:00.000Z', purgeAfter: '2026-10-08T12:00:00.000Z' };
    const { client, tokenStore } = setup(() => ({ status: 202, body }));
    expect(await client.deleteMe()).toEqual(body);
    expect(await tokenStore.get()).toBeNull();
  });

  it('o vínculo GitHub vai autenticado quando há sessão e guarda tokens só se vierem', async () => {
    const linked = setup(() => ({ status: 200, body: { account } }));
    await linked.client.github({ githubAccessToken: 'gho' });
    expect(linked.calls[0]?.headers.authorization).toBe('Bearer jwt-velho');
    expect(await linked.tokenStore.get()).toEqual(tokens);

    const signedIn = setup(
      () => ({
        status: 200,
        body: { account, accessToken: 'a', refreshToken: 'r', expiresIn: 900 },
      }),
      null,
    );
    await signedIn.client.github({ githubAccessToken: 'gho' });
    expect(signedIn.calls[0]?.headers.authorization).toBeUndefined();
    expect(await signedIn.tokenStore.get()).toEqual({ accessToken: 'a', refreshToken: 'r' });
  });
});

describe('renovação da sessão', () => {
  it('401 UNAUTHORIZED renova e repete a chamada uma vez', async () => {
    const { client, calls, tokenStore } = setup((call) => {
      if (call.path === '/auth/refresh') {
        return renewed;
      }
      return call.headers.authorization === 'Bearer jwt-novo'
        ? { status: 200, body: account }
        : unauthorized;
    });
    expect(await client.getMe()).toEqual(account);
    expect(calls.map((call) => call.path)).toEqual(['/me', '/auth/refresh', '/me']);
    expect(calls[1]?.body).toEqual({ refreshToken: 'R0' });
    expect(await tokenStore.get()).toEqual({ accessToken: 'jwt-novo', refreshToken: 'R1' });
  });

  it('5 chamadas simultâneas com token expirado disparam exatamente 1 refresh', async () => {
    const { client, callsTo } = setup(async (call) => {
      if (call.path === '/auth/refresh') {
        await new Promise((resolve) => setTimeout(resolve, 20));
        return renewed;
      }
      return call.headers.authorization === 'Bearer jwt-novo'
        ? { status: 200, body: account }
        : unauthorized;
    });
    const results = await Promise.all(Array.from({ length: 5 }, () => client.getMe()));
    expect(results).toHaveLength(5);
    expect(callsTo('/auth/refresh')).toHaveLength(1);
    expect(callsTo('/me')).toHaveLength(10);
  });

  it('SESSION_REVOKED não tenta renovar: limpa e avisa', async () => {
    const { client, callsTo, tokenStore, unauthenticatedCount } = setup(() => revoked);
    await expect(client.getMe()).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(callsTo('/auth/refresh')).toEqual([]);
    expect(await tokenStore.get()).toBeNull();
    expect(unauthenticatedCount()).toBe(1);
  });

  it('refresh recusado limpa as credenciais e avisa, sem outra tentativa', async () => {
    const { client, callsTo, tokenStore, unauthenticatedCount } = setup((call) =>
      call.path === '/auth/refresh' ? revoked : unauthorized,
    );
    await expect(client.getMe()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(callsTo('/auth/refresh')).toHaveLength(1);
    expect(await tokenStore.get()).toBeNull();
    expect(unauthenticatedCount()).toBe(1);
  });

  it('falha de rede na rotação não é repetida às cegas e não apaga os tokens', async () => {
    // O token pode já ter sido consumido: reapresentá-lo revogaria a sessão inteira.
    // Vale também para as chamadas que repetem em falha de rede, como as leituras do ciclo.
    for (const operation of ['getView', 'getMe', 'sendCommand', 'createGame'] as const) {
      const { client, callsTo, tokenStore, unauthenticatedCount, waits } = setup((call) =>
        call.path === '/auth/refresh' ? 'network' : unauthorized,
      );
      const calls = {
        getView: () => client.getView(gameId),
        getMe: () => client.getMe(),
        sendCommand: () => client.sendCommand(gameId, order),
        createGame: () =>
          client.createGame({ settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 }),
      };
      const failure = await calls[operation]().catch((error: unknown) => error);
      expect(failure).toBeInstanceOf(NetworkError);
      expect((failure as NetworkError).retryable).toBe(false);
      expect(callsTo('/auth/refresh')).toHaveLength(1);
      expect(waits).toEqual([]);
      expect(await tokenStore.get()).toEqual(tokens);
      expect(unauthenticatedCount()).toBe(0);
    }
  });

  it('se outro processo já renovou, usa os tokens dele em vez de apresentar o antigo', async () => {
    // Duas abas do navegador dividem o mesmo armazenamento. A outra aba renovou primeiro.
    const { client, callsTo, tokenStore } = setup((call) =>
      call.headers.authorization === 'Bearer jwt-da-outra-janela'
        ? { status: 200, body: account }
        : unauthorized,
    );
    const original = tokenStore.get.bind(tokenStore);
    let reads = 0;
    tokenStore.get = async () => {
      reads += 1;
      // A primeira leitura ainda vê o token velho; depois, o que a outra janela gravou.
      return reads === 1
        ? original()
        : { accessToken: 'jwt-da-outra-janela', refreshToken: 'R1-da-outra-janela' };
    };
    expect(await client.getMe()).toEqual(account);
    expect(callsTo('/auth/refresh')).toEqual([]);
  });

  it('um 401 que não veio da API não apaga a sessão nem tenta renovar', async () => {
    const proxyFetch = (async () =>
      new Response('<html>Login do portal</html>', { status: 401 })) as typeof fetch;
    const tokenStore = memoryTokenStore(tokens);
    let unauthenticated = 0;
    const client = createClient({
      baseUrl: 'http://servidor',
      tokenStore,
      clientVersion: 't',
      fetch: proxyFetch,
      onUnauthenticated: () => {
        unauthenticated += 1;
      },
      sleep: async () => undefined,
    });
    await expect(client.getMe()).rejects.toMatchObject({ status: 401, code: 'INTERNAL' });
    expect(await tokenStore.get()).toEqual(tokens);
    expect(unauthenticated).toBe(0);
  });

  it('se a chamada repetida também der 401, desiste e avisa', async () => {
    const { client, callsTo, unauthenticatedCount } = setup((call) =>
      call.path === '/auth/refresh' ? renewed : unauthorized,
    );
    await expect(client.getMe()).rejects.toMatchObject({ status: 401 });
    expect(callsTo('/me')).toHaveLength(2);
    expect(unauthenticatedCount()).toBe(1);
  });
});

describe('getView', () => {
  it('200 devolve a visão, a versão e o ETag', async () => {
    const { client } = setup(() => ({
      status: 200,
      body: { view, stateVersion: '3' },
      headers: { etag: 'W/"abc"' },
    }));
    expect(await client.getView(gameId)).toEqual({
      status: 200,
      view,
      stateVersion: '3',
      etag: 'W/"abc"',
    });
  });

  it('manda If-None-Match e entende o 304', async () => {
    const { client, calls } = setup(() => ({ status: 304, headers: { etag: 'W/"abc"' } }));
    expect(await client.getView(gameId, { etag: 'W/"abc"' })).toEqual({
      status: 304,
      etag: 'W/"abc"',
    });
    expect(calls[0]?.headers['if-none-match']).toBe('W/"abc"');
  });

  it('ETag diferente com a mesma stateVersion é um 200 normal: a tela mudou sem escrita', async () => {
    const { client } = setup(() => ({
      status: 200,
      body: { view, stateVersion: '3' },
      headers: { etag: 'W/"def"' },
    }));
    const result = await client.getView(gameId, { etag: 'W/"abc"' });
    expect(result).toMatchObject({ status: 200, stateVersion: '3', etag: 'W/"def"' });
  });

  it('repete leituras em falha de rede, com recuo exponencial, até 3 tentativas', async () => {
    let attempts = 0;
    const { client, waits } = setup(() => {
      attempts += 1;
      return attempts < 3 ? 'network' : { status: 200, body: { view, stateVersion: '1' } };
    });
    expect((await client.getView(gameId)).status).toBe(200);
    expect(attempts).toBe(3);
    expect(waits).toEqual([500, 1000]);
  });

  it('desiste depois de 3 falhas de rede', async () => {
    const { client, calls } = setup(() => 'network');
    await expect(client.getView(gameId)).rejects.toBeInstanceOf(NetworkError);
    expect(calls).toHaveLength(3);
  });
});

describe('sendCommand', () => {
  const accepted = { view, events: [], stateVersion: '4', staleView: false };

  it('envia a ordem e a versão conhecida, e devolve o resultado', async () => {
    const { client, calls } = setup(() => ({ status: 200, body: accepted }));
    const result = await client.sendCommand(gameId, order, { stateVersion: '3' });
    expect(result).toEqual({ ...accepted, replayed: false });
    expect(calls[0]).toMatchObject({
      method: 'POST',
      path: `/games/${gameId}/commands`,
      body: order,
    });
    expect(calls[0]?.headers['x-lords-state-version']).toBe('3');
  });

  it('em falha de rede, repete com o mesmo commandId e o mesmo payload', async () => {
    let attempts = 0;
    const { client, calls } = setup(() => {
      attempts += 1;
      return attempts === 1
        ? 'network'
        : { status: 200, body: accepted, headers: { 'x-lords-replayed': 'true' } };
    });
    const result = await client.sendCommand(gameId, order);
    // A primeira tentativa tinha chegado: o servidor devolve o recibo, marcado só no cabeçalho.
    expect(result.replayed).toBe(true);
    expect(result).toMatchObject(accepted);
    expect(calls.map((call) => call.body)).toEqual([order, order]);
  });

  it('recusa do motor vira GameRuleClientError com o estado avançado nos detalhes', async () => {
    const details = {
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 30 madeira e 35 pedra.',
      view,
      events: [],
      stateVersion: '5',
      staleView: false,
    };
    const { client } = setup(() => ({
      status: 422,
      body: { code: 'GAME_RULE', message: details.message, details },
    }));
    const failure = await client.sendCommand(gameId, order).catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(GameRuleClientError);
    expect(isGameRuleError(failure)).toBe(true);
    if (isGameRuleError(failure)) {
      expect(failure.message).toBe('Faltam 30 madeira e 35 pedra.');
      expect(failure.details.view).toEqual(view);
      expect(failure.details.stateVersion).toBe('5');
      expect(failure.replayed).toBe(false);
    }
  });

  it('recibo repetido de uma recusa chega marcado como reenvio', async () => {
    const details = {
      code: 'FAMINE',
      message: 'Fome.',
      view,
      events: [],
      stateVersion: '5',
      staleView: false,
    };
    const { client } = setup(() => ({
      status: 422,
      body: { code: 'GAME_RULE', message: 'Fome.', details },
      headers: { 'x-lords-replayed': 'true' },
    }));
    await expect(client.sendCommand(gameId, order)).rejects.toMatchObject({
      code: 'GAME_RULE',
      replayed: true,
    });
  });

  it('uma recusa não é repetida', async () => {
    const { client, calls } = setup(() => ({
      status: 409,
      body: { code: 'COMMAND_ID_CONFLICT', message: 'já usado' },
    }));
    await expect(client.sendCommand(gameId, order)).rejects.toMatchObject({
      status: 409,
      code: 'COMMAND_ID_CONFLICT',
    });
    expect(calls).toHaveLength(1);
  });
});

describe('erros', () => {
  it('mapeia status, código, mensagem e detalhes', async () => {
    const { client } = setup(() => ({
      status: 409,
      body: {
        code: 'ACCOUNT_CONFLICT',
        message: 'Escolha qual manter.',
        details: { existingDisplayName: 'Edda', currentHasProgress: true },
      },
    }));
    const failure = await client
      .github({ githubAccessToken: 'gho' })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ApiClientError);
    expect(failure).toMatchObject({
      status: 409,
      code: 'ACCOUNT_CONFLICT',
      message: 'Escolha qual manter.',
      details: { existingDisplayName: 'Edda', currentHasProgress: true },
      replayed: false,
    });
  });

  it('servidor de outra versão do protocolo responde UPGRADE_REQUIRED', async () => {
    const { client } = setup(() => ({
      status: 426,
      body: { code: 'UPGRADE_REQUIRED', message: 'Recarregue a página.', details: { protocol: 2 } },
    }));
    await expect(client.version()).rejects.toMatchObject({ status: 426, code: 'UPGRADE_REQUIRED' });
  });

  it('limite de taxa chega como RATE_LIMITED e não é repetido', async () => {
    const { client, calls } = setup(() => ({
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'Muitas requisições.' },
    }));
    await expect(client.listGames()).rejects.toMatchObject({ status: 429, code: 'RATE_LIMITED' });
    expect(calls).toHaveLength(1);
  });

  it('resposta de erro sem o formato da API vira INTERNAL com o status', async () => {
    const { client } = setup(() => ({ status: 502, body: { erro: 'gateway' } }));
    await expect(client.version()).rejects.toMatchObject({
      status: 502,
      code: 'INTERNAL',
      message: 'O servidor respondeu 502.',
    });
  });

  it('corpo que não é JSON é falha de rede, não exceção solta', async () => {
    const htmlFetch = (async () =>
      new Response('<html>proxy</html>', { status: 200 })) as typeof fetch;
    const client = createClient({
      baseUrl: 'http://servidor',
      tokenStore: memoryTokenStore(tokens),
      clientVersion: 't',
      fetch: htmlFetch,
      sleep: async () => undefined,
    });
    await expect(client.version()).rejects.toBeInstanceOf(NetworkError);
  });
});

describe('demais chamadas', () => {
  it('lista e cria partidas, lê eventos e Crônica', async () => {
    const game = { id: gameId, status: 'active' };
    const { client, calls } = setup((call) => {
      if (call.path === '/games' && call.method === 'GET') {
        return { status: 200, body: { games: [game] } };
      }
      if (call.path === '/games') {
        return { status: 201, body: { game } };
      }
      if (call.path.includes('/events')) {
        return { status: 200, body: { events: [], lastSeq: 7, hasMore: false } };
      }
      if (call.path.endsWith('chronicle.md')) {
        return { status: 200, body: '# Crônica' };
      }
      if (call.path.includes('/chronicle')) {
        return { status: 200, body: { entries: [] } };
      }
      return { status: 200, body: { code: 'PEDR-7F3A-K9QD-M2XW-4HTB' } };
    });
    expect(await client.listGames()).toEqual([game]);
    expect(
      await client.createGame({
        settlementName: 'Pedra Alta',
        timezone: 'UTC',
        vigilHourLocal: 20,
      }),
    ).toEqual(game);
    expect(await client.getEvents(gameId, 7, 50)).toMatchObject({ lastSeq: 7 });
    expect(await client.getChronicle(gameId, { limit: 10, year: 2 })).toEqual({ entries: [] });
    expect(await client.getChronicle(gameId)).toEqual({ entries: [] });
    expect(await client.getChronicleMarkdown(gameId)).toBe('"# Crônica"');
    expect(await client.createRecoveryCode()).toBe('PEDR-7F3A-K9QD-M2XW-4HTB');
    expect(calls.map((call) => call.path)).toEqual([
      '/games',
      '/games',
      `/games/${gameId}/events?after=7&limit=50`,
      `/games/${gameId}/chronicle?limit=10&year=2`,
      `/games/${gameId}/chronicle`,
      `/games/${gameId}/chronicle.md`,
      '/auth/recovery-code',
    ]);
  });

  it('valida as respostas contra o protocolo quando pedido', async () => {
    const client = createClient({
      baseUrl: 'http://servidor',
      tokenStore: memoryTokenStore(tokens),
      clientVersion: 't',
      validateResponses: true,
      fetch: (async () =>
        new Response(JSON.stringify({ status: 'talvez' }), { status: 200 })) as typeof fetch,
    });
    await expect(client.health()).rejects.toThrow();
  });
});

describe('withRetry', () => {
  it('não repete erros que não são de rede', async () => {
    let attempts = 0;
    const operation = async () => {
      attempts += 1;
      throw new Error('regra');
    };
    await expect(
      withRetry(operation, { attempts: 3, baseDelayMs: 1, sleep: async () => undefined }),
    ).rejects.toThrow('regra');
    expect(attempts).toBe(1);
  });
});
