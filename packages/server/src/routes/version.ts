import type { FastifyInstance } from 'fastify';

import { versionInfo } from '../version';

export function registerVersionRoutes(app: FastifyInstance): void {
  app.get('/version', async () => versionInfo());
}
