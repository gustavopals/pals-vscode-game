import {
  JoinSeasonRequestSchema,
  LeaderboardQuerySchema,
  SeasonChronicleParamsSchema,
} from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import { ApiError } from '../api-error';
import type { AppContext } from '../context';
import { requireIdentity } from '../plugins/auth';
import { readLeaderboard, readSeasonChronicle } from '../seasons/leaderboard';
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

  app.get('/leaderboard', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const { season } = LeaderboardQuerySchema.parse(request.query);
    void reply.header('cache-control', 'private, no-store');
    return readLeaderboard(ctx, identity.accountId, season);
  });

  app.get('/seasons/:id/chronicles/:position', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const params = SeasonChronicleParamsSchema.safeParse(request.params);
    if (!params.success) {
      throw new ApiError('NOT_FOUND', 'Não há Crônica publicada nesta posição.');
    }
    const { id, position } = params.data;
    void reply.header('cache-control', 'private, no-store');
    return readSeasonChronicle(ctx, identity.accountId, id, position);
  });
}
