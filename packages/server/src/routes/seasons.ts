import { JoinSeasonRequestSchema } from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import { requireIdentity } from '../plugins/auth';
import { getCurrentSeason, joinCurrentSeason } from '../seasons/service';

export function registerSeasonRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/seasons/current', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    void reply.header('cache-control', 'no-store');
    return getCurrentSeason(ctx, identity.accountId);
  });

  app.post('/seasons/current/join', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const input = JoinSeasonRequestSchema.parse(request.body);
    const body = await joinCurrentSeason(ctx, identity.accountId, input);
    return reply.status(201).header('cache-control', 'no-store').send(body);
  });
}
