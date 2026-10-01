import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance, FastifyRequest } from 'fastify';

import { ApiError } from '../api-error';
import { verifyAccessToken } from '../auth/tokens';
import type { AppContext } from '../context';
import { bearerToken } from './auth';

const tooMany = (_request: FastifyRequest, context: { after: string }) =>
  new ApiError('RATE_LIMITED', `Muitas requisições. Tente de novo em ${context.after}.`);

/**
 * Limite geral: 60 requisições por minuto por sessão ou, sem sessão válida, por IP.
 * A chave por sessão só vale para um JWT com assinatura válida: um `sid` forjado cai no IP.
 */
export async function registerRateLimit(app: FastifyInstance, ctx: AppContext): Promise<void> {
  await app.register(rateLimit, {
    global: true,
    max: ctx.config.rateLimitPerMinute,
    timeWindow: '1 minute',
    keyGenerator: async (request) => {
      const token = bearerToken(request);
      const claims =
        token === null ? null : await verifyAccessToken(ctx.config, token, ctx.clock());
      return claims === null ? `ip:${request.ip}` : `session:${claims.sessionId}`;
    },
    errorResponseBuilder: tooMany,
  });
}

/** Limite por IP de uma rota sensível, com contador próprio. */
export function perIpLimit(name: string, max: number, timeWindow: string) {
  return {
    rateLimit: {
      max,
      timeWindow,
      keyGenerator: (request: FastifyRequest) => `${name}:${request.ip}`,
      errorResponseBuilder: tooMany,
    },
  };
}
