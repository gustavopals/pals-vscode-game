import { randomUUID } from 'node:crypto';

import type {
  AuthResponse,
  Command,
  CommandType,
  CreateGameRequest,
  GameSummary,
  TokenPair,
} from '@lotg/protocol';
import type pg from 'pg';

import { type App, buildApp } from '../../src/app';
import { type Config, loadConfig } from '../../src/config';
import type { AppContext, FaultHooks } from '../../src/context';
import { createTestPool } from './db';

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const DAY = 24 * HOUR;

export const JWT_SECRET = Buffer.alloc(48, 1).toString('base64');
export const RECOVERY_CODE_SECRET = Buffer.alloc(48, 2).toString('base64');

/** Configuração de teste: limites de taxa altos, para só os testes de limite esbarrarem neles. */
export function testConfig(overrides: Record<string, string> = {}): Config {
  return loadConfig({
    NODE_ENV: 'test',
    DATABASE_URL: process.env.TEST_DATABASE_URL,
    JWT_SECRET,
    RECOVERY_CODE_SECRET,
    PUBLIC_URL: 'http://localhost:3000',
    LOG_LEVEL: 'silent',
    RATE_LIMIT_PER_MINUTE: '100000',
    ACCOUNT_CREATE_PER_HOUR_PER_IP: '100000',
    RECOVERY_ATTEMPTS_PER_HOUR_PER_IP: '100000',
    GITHUB_API_URL: 'https://github.test',
    // Os cenários foram escritos no ritmo Normal do GDD; o ritmo do servidor tem testes à parte.
    GAME_TIME_SCALE: '1',
    ...overrides,
  });
}

/** Relógio controlado: o tempo só anda quando o teste manda. */
export type FakeClock = {
  now: () => Date;
  set: (value: string | Date) => void;
  advance: (ms: number) => void;
};

export function fakeClock(start = '2026-10-01T12:00:00.000Z'): FakeClock {
  let current = new Date(start).getTime();
  return {
    now: () => new Date(current),
    set: (value) => {
      current = new Date(value).getTime();
    },
    advance: (ms) => {
      current += ms;
    },
  };
}

export type TestApp = {
  app: App;
  /** Contexto da instância: dá acesso direto a serviços e jobs. */
  ctx: AppContext;
  pool: pg.Pool;
  clock: FakeClock;
  hooks: FaultHooks;
  close: () => Promise<void>;
};

/**
 * Sobe uma instância da API contra o banco de teste, com pool próprio. Duas chamadas com o
 * mesmo `clock` simulam duas réplicas do servidor diante do mesmo banco.
 */
export async function createTestApp(
  options: {
    clock?: FakeClock;
    fetch?: typeof fetch;
    config?: Record<string, string>;
  } = {},
): Promise<TestApp> {
  const pool = createTestPool();
  const clock = options.clock ?? fakeClock();
  const hooks: FaultHooks = {};
  const { app, ctx } = await buildApp({
    config: testConfig(options.config),
    pool,
    clock: clock.now,
    hooks,
    logger: false,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  await app.ready();
  return {
    app,
    ctx,
    pool,
    clock,
    hooks,
    close: async () => {
      await app.close();
      await pool.end();
    },
  };
}

export type Reply<T = unknown> = {
  status: number;
  headers: Record<string, string | string[] | number | undefined>;
  body: T;
};

type CallOptions = {
  token?: string | undefined;
  body?: unknown;
  headers?: Record<string, string>;
  ip?: string;
};

/** Faz uma chamada HTTP à API em memória e devolve status, cabeçalhos e corpo já interpretado. */
export async function call<T = unknown>(
  target: TestApp | App,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  options: CallOptions = {},
): Promise<Reply<T>> {
  const app = 'app' in target ? target.app : target;
  const headers: Record<string, string> = { ...options.headers };
  if (options.token !== undefined) {
    headers.authorization = `Bearer ${options.token}`;
  }
  const response = await app.inject({
    method,
    url: `/v1${path}`,
    headers,
    ...(options.body !== undefined ? { payload: options.body as object } : {}),
    ...(options.ip !== undefined ? { remoteAddress: options.ip } : {}),
  });
  const text = response.body;
  const isJson = String(response.headers['content-type'] ?? '').includes('application/json');
  return {
    status: response.statusCode,
    headers: response.headers,
    body: (isJson && text !== '' ? JSON.parse(text) : text) as T,
  };
}

/** Cria uma conta anônima e devolve a resposta de autenticação. */
export async function signUp(
  target: TestApp | App,
  displayName = 'Gustavo',
): Promise<AuthResponse> {
  const reply = await call<AuthResponse>(target, 'POST', '/auth/anonymous', {
    body: { displayName, deviceLabel: 'máquina de teste' },
  });
  if (reply.status !== 201) {
    throw new Error(
      `Falha ao criar a conta de teste: ${reply.status} ${JSON.stringify(reply.body)}`,
    );
  }
  return reply.body;
}

/** Cria uma partida para o dono do token. */
export async function startGame(
  target: TestApp | App,
  token: string,
  overrides: Partial<CreateGameRequest> = {},
): Promise<GameSummary> {
  const reply = await call<{ game: GameSummary }>(target, 'POST', '/games', {
    token,
    body: {
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      seed: 'pedra-alta-teste',
      ...overrides,
    },
  });
  if (reply.status !== 201) {
    throw new Error(
      `Falha ao criar a partida de teste: ${reply.status} ${JSON.stringify(reply.body)}`,
    );
  }
  return reply.body.game;
}

export type Player = {
  auth: AuthResponse;
  accountId: string;
  /** Access token atual. Vale 15 minutos do relógio de teste: use `renew` depois de avançá-lo. */
  token: string;
  refreshToken: string;
  game: GameSummary;
};

/** Conta nova já com partida: o ponto de partida da maioria dos testes. */
export async function newPlayer(target: TestApp | App, displayName = 'Gustavo'): Promise<Player> {
  const auth = await signUp(target, displayName);
  return {
    auth,
    accountId: auth.account.id,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
    game: await startGame(target, auth.accessToken),
  };
}

/**
 * Renova os tokens de um jogador depois de o relógio de teste passar dos 15 minutos do access
 * token. Atualiza o próprio objeto e devolve o access token novo.
 */
export async function renew(
  target: TestApp | App,
  player: { token: string; refreshToken: string },
): Promise<string> {
  const reply = await call<TokenPair>(target, 'POST', '/auth/refresh', {
    body: { refreshToken: player.refreshToken },
  });
  if (reply.status !== 200) {
    throw new Error(
      `Falha ao renovar a sessão de teste: ${reply.status} ${JSON.stringify(reply.body)}`,
    );
  }
  player.token = reply.body.accessToken;
  player.refreshToken = reply.body.refreshToken;
  return player.token;
}

/** Monta um comando com `commandId` novo (ou o informado, para testar reenvios). */
export function order<T extends CommandType>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
  commandId: string = randomUUID(),
): Command {
  return { commandId, type, payload } as Command;
}

/** Envia um comando para a partida. */
export function send<T = unknown>(
  target: TestApp | App,
  token: string,
  gameId: string,
  command: Command,
  headers: Record<string, string> = {},
): Promise<Reply<T>> {
  return call<T>(target, 'POST', `/games/${gameId}/commands`, { token, body: command, headers });
}

/** Conta as linhas de uma tabela, opcionalmente filtradas. */
export async function countRows(pool: pg.Pool, table: string, where = 'true'): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `select count(*) as count from ${table} where ${where}`,
  );
  return Number(rows[0]?.count ?? 0);
}
