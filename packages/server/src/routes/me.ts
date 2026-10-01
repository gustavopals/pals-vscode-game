import { UpdateMeRequestSchema } from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import { deleteAccount, getAccount, renameAccount } from '../auth/service';
import type { AppContext } from '../context';
import { requireIdentity } from '../plugins/auth';

export function registerMeRoutes(app: FastifyInstance, ctx: AppContext): void {
  app.get('/me', async (request) => {
    const identity = await requireIdentity(ctx, request);
    return getAccount(ctx, identity.accountId);
  });

  app.patch('/me', async (request) => {
    const identity = await requireIdentity(ctx, request);
    const body = UpdateMeRequestSchema.parse(request.body);
    return renameAccount(ctx, identity.accountId, body.displayName);
  });

  // 202: a conta já está bloqueada; a remoção física vem com o job, depois de `purgeAfter`.
  app.delete('/me', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    const body = await deleteAccount(ctx, identity.accountId);
    return reply.status(202).header('cache-control', 'no-store').send(body);
  });
}
