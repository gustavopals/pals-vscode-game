import { randomUUID } from 'node:crypto';

import sensible from '@fastify/sensible';
import { API_PREFIX } from '@lotg/protocol';
import fastify, { type FastifyServerOptions } from 'fastify';
import type { Pool } from 'pg';

import type { Config } from './config';
import type { AppContext, Clock, FaultHooks } from './context';
import { createDb } from './db/client';
import { registerErrorHandling } from './plugins/errors';
import { registerRateLimit } from './plugins/ratelimit';
import { registerAuthRoutes } from './routes/auth';
import { registerGameRoutes } from './routes/games';
import { registerHealthRoutes } from './routes/health';
import { registerMeRoutes } from './routes/me';
import { registerVersionRoutes } from './routes/version';

export type AppDeps = {
  config: Config;
  pool: Pool;
  /** Relógio do servidor; os testes injetam um relógio controlado. */
  clock?: Clock;
  /** `fetch` usado para falar com o GitHub; os testes injetam um substituto sem rede. */
  fetch?: typeof fetch;
  hooks?: FaultHooks;
  logger?: boolean;
};

/** Corpo de até 64 KB (GDD §14.5). */
const BODY_LIMIT_BYTES = 64 * 1024;

// Nada disto pode aparecer em um log, nem por engano.
const REDACTED = [
  'req.headers.authorization',
  'req.headers.cookie',
  'authorization',
  'accessToken',
  'refreshToken',
  'githubAccessToken',
  'code',
  '*.authorization',
  '*.accessToken',
  '*.refreshToken',
  '*.githubAccessToken',
  '*.code',
];

export function createContext(deps: AppDeps): AppContext {
  return {
    config: deps.config,
    pool: deps.pool,
    db: createDb(deps.pool),
    clock: deps.clock ?? (() => new Date()),
    fetch: deps.fetch ?? globalThis.fetch,
    hooks: deps.hooks ?? {},
  };
}

/**
 * Monta a API `/v1`. O servidor orquestra: autentica, trava, chama o motor e persiste.
 * Nenhuma regra de jogo vive aqui.
 */
export async function buildApp(deps: AppDeps) {
  const ctx = createContext(deps);
  const options: FastifyServerOptions = {
    logger:
      deps.logger === false
        ? false
        : { level: ctx.config.logLevel, redact: { paths: REDACTED, censor: '[oculto]' } },
    bodyLimit: BODY_LIMIT_BYTES,
    // Um salto: o IP do cliente é o que o proxy reverso viu, não o que o cliente escreveu no
    // X-Forwarded-For. Confiar na cadeia inteira deixaria o cliente escolher o próprio IP.
    trustProxy: ctx.config.trustProxy ? (_address: string, hop: number) => hop < 1 : false,
    genReqId: () => randomUUID(),
  };
  const app = fastify(options);

  await app.register(sensible);
  registerErrorHandling(app);
  await registerRateLimit(app, ctx);

  await app.register(
    async (api) => {
      registerHealthRoutes(api, ctx);
      registerVersionRoutes(api, ctx);
      registerAuthRoutes(api, ctx);
      registerMeRoutes(api, ctx);
      registerGameRoutes(api, ctx);
    },
    { prefix: API_PREFIX },
  );

  // A instância do Fastify é "thenable": devolvê-la direto de uma função async a desembrulharia.
  return { app, ctx };
}

export type App = Awaited<ReturnType<typeof buildApp>>['app'];
