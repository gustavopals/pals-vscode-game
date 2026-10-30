import { RankingPreferenceSchema } from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import type { AppContext } from '../context';
import { requireIdentity } from '../plugins/auth';
import { readRankingPreference, readStats, setRankingPreference } from '../stats/service';

/** Estatísticas do reino, ranking de ouro e a saída do ranking (ADR 0021). */
export function registerStatsRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/stats', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const body = await readStats(ctx, identity.accountId);
    return reply.header('cache-control', 'private, no-store').send(body);
  });

  app.get('/me/ranking', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const body = await readRankingPreference(ctx, identity.accountId);
    return reply.header('cache-control', 'private, no-store').send(body);
  });

  app.put('/me/ranking', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const { listed } = RankingPreferenceSchema.parse(request.body);
    const body = await setRankingPreference(ctx, identity.accountId, listed);
    return reply.header('cache-control', 'no-store').send(body);
  });
}
