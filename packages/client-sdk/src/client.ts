import {
  type Account,
  AccountSchema,
  API_ERROR_CODES,
  API_PREFIX,
  type ApiErrorCode,
  type AuthResponse,
  AuthResponseSchema,
  type ChronicleResponse,
  ChronicleResponseSchema,
  type Command,
  type CommandAccepted,
  CommandAcceptedSchema,
  type CreateGameRequest,
  CreateGameResponseSchema,
  type DeleteMeResponse,
  DeleteMeResponseSchema,
  type EventsResponse,
  EventsResponseSchema,
  type GameRuleDetails,
  type GameSummary,
  type GithubAuthResponse,
  GithubAuthResponseSchema,
  type GithubDevicePollResponse,
  GithubDevicePollResponseSchema,
  type GithubDeviceStartResponse,
  GithubDeviceStartResponseSchema,
  HEADERS,
  type HealthResponse,
  HealthResponseSchema,
  ListGamesResponseSchema,
  PROTOCOL_VERSION,
  TokenPairSchema,
  type VersionResponse,
  VersionResponseSchema,
  type ViewResponse,
  ViewResponseSchema,
} from '@lotg/protocol';

import { ApiClientError, GameRuleClientError, NetworkError } from './errors';
import { withRetry } from './retry';
import type { TokenStore } from './tokens';

export type ClientOptions = {
  /** URL do servidor, sem o `/v1`. */
  baseUrl: string;
  tokenStore: TokenStore;
  /** Versão do cliente, enviada em `X-Lords-Client` (ex.: `web/0.1.0`). */
  clientVersion: string;
  fetch?: typeof fetch;
  /** A sessão acabou e não há como renová-la: o chamador deve voltar à tela de entrada. */
  onUnauthenticated?: () => void | Promise<void>;
  /** Valida as respostas com os schemas do protocolo. Ligue em desenvolvimento e nos testes. */
  validateResponses?: boolean;
  sleep?: (ms: number) => Promise<void>;
  /** Tentativas de leituras e comandos em falha de rede. Padrão: 3. */
  retryAttempts?: number;
  retryBaseDelayMs?: number;
  /**
   * Espera aleatória, até este valor, antes de renovar a sessão. Quando vários processos dividem
   * o mesmo `TokenStore` (duas abas do navegador), ela dá tempo de um deles renovar e o outro
   * encontrar os tokens novos em vez de apresentar o mesmo refresh token. Padrão: 0.
   */
  refreshJitterMs?: number;
  /**
   * Exclusão entre processos para a renovação da sessão. Quando informada, a releitura do
   * `TokenStore` e a troca do refresh token acontecem dentro dela: só um processo renova por
   * vez, e os outros encontram os tokens novos. O app web usa a Web Locks API do navegador.
   */
  refreshLock?: <T>(task: () => Promise<T>) => Promise<T>;
};

export type ViewResult =
  ({ status: 200; etag: string | null } & ViewResponse) | { status: 304; etag: string | null };

export type CommandResult = CommandAccepted & {
  /** O servidor devolveu o recibo de uma ordem já registrada. Busque a visão atual. */
  replayed: boolean;
};

type Schema<T> = { parse: (value: unknown) => T };

type RequestOptions = {
  auth: boolean;
  body?: unknown;
  headers?: Record<string, string>;
  /** Repetir em falha de rede. Só para operações idempotentes. */
  retry?: boolean;
};

type RawResponse = { status: number; headers: Headers; text: string };

const knownCodes: readonly string[] = API_ERROR_CODES;

function parseJson(text: string): unknown {
  if (text === '') {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new NetworkError('O servidor respondeu algo que não é JSON.');
  }
}

type ErrorBody = { code?: unknown; message?: unknown; details?: unknown };

function readErrorBody(text: string): ErrorBody | null {
  try {
    const parsed = parseJson(text);
    return typeof parsed === 'object' && parsed !== null ? (parsed as ErrorBody) : null;
  } catch {
    return null;
  }
}

/** Cliente HTTP tipado da API `/v1`. Não depende de nenhuma plataforma além do `fetch`. */
export function createClient(options: ClientOptions) {
  const base = `${options.baseUrl.replace(/\/+$/, '')}${API_PREFIX}`;
  const doFetch = options.fetch ?? globalThis.fetch;
  const sleep =
    options.sleep ?? ((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));
  const retry = {
    attempts: options.retryAttempts ?? 3,
    baseDelayMs: options.retryBaseDelayMs ?? 500,
    sleep,
  };
  const { tokenStore } = options;

  const check = <T>(schema: Schema<T>, value: unknown): T =>
    options.validateResponses ? schema.parse(value) : (value as T);

  async function rawRequest(
    method: string,
    path: string,
    init: { token?: string | null; body?: unknown; headers?: Record<string, string> },
  ): Promise<RawResponse> {
    const headers: Record<string, string> = {
      [HEADERS.protocol]: String(PROTOCOL_VERSION),
      [HEADERS.client]: options.clientVersion,
      ...init.headers,
    };
    if (init.token) {
      headers.authorization = `Bearer ${init.token}`;
    }
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    try {
      const response = await doFetch(`${base}${path}`, {
        method,
        headers,
        ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
      });
      return { status: response.status, headers: response.headers, text: await response.text() };
    } catch (error) {
      throw new NetworkError('Sem ligação com o servidor.', { cause: error });
    }
  }

  /** A resposta tem o formato de erro da API, com um código conhecido. */
  function isApiError(response: RawResponse): boolean {
    const code = readErrorBody(response.text)?.code;
    return typeof code === 'string' && knownCodes.includes(code);
  }

  function toError(response: RawResponse): ApiClientError {
    const replayed = response.headers.get(HEADERS.replayed) === 'true';
    const body = readErrorBody(response.text);
    const code: ApiErrorCode =
      typeof body?.code === 'string' && knownCodes.includes(body.code)
        ? (body.code as ApiErrorCode)
        : 'INTERNAL';
    const message =
      typeof body?.message === 'string' ? body.message : `O servidor respondeu ${response.status}.`;
    if (code === 'GAME_RULE' && body?.details !== undefined) {
      return new GameRuleClientError(message, body.details as GameRuleDetails, replayed);
    }
    return new ApiClientError(response.status, code, message, body?.details, replayed);
  }

  // --- Renovação da sessão ---------------------------------------------------

  async function unauthenticated(): Promise<void> {
    await tokenStore.clear();
    await options.onUnauthenticated?.();
  }

  let refreshing: Promise<string | null> | null = null;

  /**
   * Troca o refresh token pelo sucessor. Uma renovação por vez: chamadas simultâneas esperam a
   * mesma. Não há retentativa em falha de rede, porque o token pode já ter sido consumido e
   * reapresentá-lo revogaria a sessão inteira (ADR 0005); nesse caso o erro de rede sobe.
   */
  function refreshOnce(staleAccessToken: string): Promise<string | null> {
    refreshing ??= (async () => {
      const jitter = options.refreshJitterMs ?? 0;
      if (jitter > 0) {
        await sleep(Math.floor(Math.random() * jitter));
      }
      const lock = options.refreshLock ?? (<T>(task: () => Promise<T>) => task());
      return lock(() => renew(staleAccessToken));
    })().finally(() => {
      refreshing = null;
    });
    return refreshing;
  }

  async function renew(staleAccessToken: string): Promise<string | null> {
    const tokens = await tokenStore.get();
    if (tokens === null) {
      await unauthenticated();
      return null;
    }
    // Outro processo com o mesmo TokenStore já renovou: usa os tokens dele. Apresentar de novo
    // o refresh token antigo seria lido pelo servidor como reuso e revogaria a sessão.
    if (tokens.accessToken !== staleAccessToken) {
      return tokens.accessToken;
    }
    let response: RawResponse;
    try {
      response = await rawRequest('POST', '/auth/refresh', {
        body: { refreshToken: tokens.refreshToken },
      });
    } catch (error) {
      throw new NetworkError('Sem ligação com o servidor ao renovar a sessão.', {
        cause: error,
        retryable: false,
      });
    }
    if (response.status === 200) {
      const pair = check(TokenPairSchema, parseJson(response.text));
      await tokenStore.set({ accessToken: pair.accessToken, refreshToken: pair.refreshToken });
      return pair.accessToken;
    }
    if (response.status === 401 && isApiError(response)) {
      await unauthenticated();
      return null;
    }
    throw toError(response);
  }

  async function send(method: string, path: string, request: RequestOptions): Promise<RawResponse> {
    const attempt = async (): Promise<RawResponse> => {
      if (!request.auth) {
        return rawRequest(method, path, request);
      }
      const tokens = await tokenStore.get();
      if (tokens === null) {
        await unauthenticated();
        throw new ApiClientError(401, 'UNAUTHORIZED', 'Nenhuma sessão nesta máquina.', undefined);
      }
      const first = await rawRequest(method, path, { ...request, token: tokens.accessToken });
      if (first.status !== 401) {
        return first;
      }
      const failure = toError(first);
      if (!isApiError(first)) {
        // Um 401 que não veio da API (proxy, portal cativo) não diz nada sobre a sessão:
        // não se apaga a credencial de ninguém por causa dele.
        throw failure;
      }
      if (failure.code !== 'UNAUTHORIZED') {
        // Sessão revogada ou conta excluída: renovar não adianta.
        await unauthenticated();
        throw failure;
      }
      const renewed = await refreshOnce(tokens.accessToken);
      if (renewed === null) {
        throw failure;
      }
      const second = await rawRequest(method, path, { ...request, token: renewed });
      if (second.status === 401 && isApiError(second)) {
        await unauthenticated();
      }
      return second;
    };
    return request.retry ? withRetry(attempt, retry) : attempt();
  }

  async function json<T>(
    schema: Schema<T>,
    method: string,
    path: string,
    request: RequestOptions,
  ): Promise<T> {
    const response = await send(method, path, request);
    if (response.status < 200 || response.status >= 300) {
      throw toError(response);
    }
    return check(schema, parseJson(response.text));
  }

  const get = <T>(schema: Schema<T>, path: string, auth = true) =>
    json(schema, 'GET', path, { auth, retry: true });

  /** Guarda as credenciais de uma resposta que abriu uma sessão. */
  async function keep<
    T extends { accessToken?: string | undefined; refreshToken?: string | undefined },
  >(response: T): Promise<T> {
    if (response.accessToken !== undefined && response.refreshToken !== undefined) {
      await tokenStore.set({
        accessToken: response.accessToken,
        refreshToken: response.refreshToken,
      });
    }
    return response;
  }

  return {
    health: (): Promise<HealthResponse> => get(HealthResponseSchema, '/health', false),
    version: (): Promise<VersionResponse> => get(VersionResponseSchema, '/version', false),

    /** Cria a conta anônima e guarda a sessão. É o "Jogar agora". */
    signUpAnonymous: async (input: {
      displayName: string;
      deviceLabel?: string;
    }): Promise<AuthResponse> =>
      keep(await json(AuthResponseSchema, 'POST', '/auth/anonymous', { auth: false, body: input })),

    /** Entra com o Código do Reino e guarda a sessão nova. */
    recover: async (input: { code: string; deviceLabel?: string }): Promise<AuthResponse> =>
      keep(await json(AuthResponseSchema, 'POST', '/auth/recover', { auth: false, body: input })),

    /**
     * Vincula a conta atual ao GitHub ou entra em uma conta já vinculada. Com sessão nesta
     * máquina a chamada vai autenticada. Um `ACCOUNT_CONFLICT` pede a escolha de `resolve`.
     */
    github: async (input: {
      githubAccessToken: string;
      deviceLabel?: string;
      resolve?: 'useExisting' | 'keepCurrent';
    }): Promise<GithubAuthResponse> => {
      const auth = (await tokenStore.get()) !== null;
      return keep(
        await json(GithubAuthResponseSchema, 'POST', '/auth/github', { auth, body: input }),
      );
    },

    /**
     * Começa o *device flow* do GitHub: devolve o código que o jogador confirma em
     * `github.com/login/device`. Um servidor sem `GITHUB_CLIENT_ID` responde `404 NOT_FOUND`.
     */
    startGithubDevice: (): Promise<GithubDeviceStartResponse> =>
      json(GithubDeviceStartResponseSchema, 'POST', '/auth/github/device', { auth: false }),

    /** Consulta se o jogador já confirmou. Com `authorized`, o token segue para `github()`. */
    pollGithubDevice: (deviceCode: string): Promise<GithubDevicePollResponse> =>
      json(GithubDevicePollResponseSchema, 'POST', '/auth/github/device/poll', {
        auth: false,
        body: { deviceCode },
      }),

    createRecoveryCode: async (): Promise<string> => {
      const response = await send('POST', '/auth/recovery-code', { auth: true });
      if (response.status !== 200) {
        throw toError(response);
      }
      return (parseJson(response.text) as { code: string }).code;
    },

    /** Revoga a sessão desta máquina e apaga as credenciais locais. */
    logout: async (): Promise<void> => {
      try {
        const response = await send('POST', '/auth/logout', { auth: true });
        if (response.status !== 204 && response.status !== 401) {
          throw toError(response);
        }
      } finally {
        await tokenStore.clear();
      }
    },

    getMe: (): Promise<Account> => get(AccountSchema, '/me'),

    renameMe: (displayName: string): Promise<Account> =>
      json(AccountSchema, 'PATCH', '/me', { auth: true, body: { displayName } }),

    /** Bloqueia a conta na hora; o servidor remove os dados depois de `purgeAfter`. */
    deleteMe: async (): Promise<DeleteMeResponse> => {
      const response = await json(DeleteMeResponseSchema, 'DELETE', '/me', { auth: true });
      await tokenStore.clear();
      return response;
    },

    listGames: async (): Promise<GameSummary[]> =>
      (await get(ListGamesResponseSchema, '/games')).games,

    createGame: async (input: CreateGameRequest): Promise<GameSummary> =>
      (await json(CreateGameResponseSchema, 'POST', '/games', { auth: true, body: input })).game,

    /** Lê o estado da partida. Com o `etag` da última leitura, um corpo igual volta como 304. */
    getView: async (gameId: string, known: { etag?: string | null } = {}): Promise<ViewResult> => {
      const response = await send('GET', `/games/${gameId}/view`, {
        auth: true,
        retry: true,
        ...(known.etag ? { headers: { 'if-none-match': known.etag } } : {}),
      });
      const etag = response.headers.get('etag');
      if (response.status === 304) {
        return { status: 304, etag };
      }
      if (response.status !== 200) {
        throw toError(response);
      }
      return { status: 200, etag, ...check(ViewResponseSchema, parseJson(response.text)) };
    },

    /**
     * Envia uma ordem. Em falha de rede repete com o mesmo `commandId` e o mesmo payload: se a
     * primeira tentativa chegou, o servidor devolve o recibo original (`replayed`). Uma intenção
     * nova do jogador exige outro `commandId`. A recusa do motor sai como `GameRuleClientError`.
     */
    sendCommand: async (
      gameId: string,
      command: Command,
      known: { stateVersion?: string | null } = {},
    ): Promise<CommandResult> => {
      const response = await send('POST', `/games/${gameId}/commands`, {
        auth: true,
        retry: true,
        body: command,
        ...(known.stateVersion ? { headers: { [HEADERS.stateVersion]: known.stateVersion } } : {}),
      });
      if (response.status !== 200) {
        throw toError(response);
      }
      return {
        ...check(CommandAcceptedSchema, parseJson(response.text)),
        replayed: response.headers.get(HEADERS.replayed) === 'true',
      };
    },

    getEvents: (gameId: string, after = 0, limit = 100): Promise<EventsResponse> =>
      get(EventsResponseSchema, `/games/${gameId}/events?after=${after}&limit=${limit}`),

    getChronicle: (
      gameId: string,
      query: { limit?: number; year?: number } = {},
    ): Promise<ChronicleResponse> => {
      const params = new URLSearchParams();
      if (query.limit !== undefined) {
        params.set('limit', String(query.limit));
      }
      if (query.year !== undefined) {
        params.set('year', String(query.year));
      }
      const suffix = params.size > 0 ? `?${params.toString()}` : '';
      return get(ChronicleResponseSchema, `/games/${gameId}/chronicle${suffix}`);
    },

    getChronicleMarkdown: async (gameId: string): Promise<string> => {
      const response = await send('GET', `/games/${gameId}/chronicle.md`, {
        auth: true,
        retry: true,
      });
      if (response.status !== 200) {
        throw toError(response);
      }
      return response.text;
    },
  };
}

export type Client = ReturnType<typeof createClient>;
