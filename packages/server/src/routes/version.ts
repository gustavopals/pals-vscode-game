import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import { versionInfo } from '../version';

export function registerVersionRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/version', async () => versionInfo(ctx.config));
}
