import type { HealthResponse } from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import { pingDatabase } from '../plugins/db';

export function registerHealthRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/health', { config: { rateLimit: false } }, async (_request, reply) => {
    const dbUp = await pingDatabase(ctx.pool);
    const body: HealthResponse = { status: 'ok', db: dbUp ? 'ok' : 'down' };
    return reply
      .status(dbUp ? 200 : 503)
      .header('cache-control', 'no-store')
      .send(body);
  });
}
