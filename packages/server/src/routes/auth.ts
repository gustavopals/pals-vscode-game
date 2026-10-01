import {
  AnonymousRequestSchema,
  GithubAuthRequestSchema,
  type RecoveryCodeResponse,
  RecoverRequestSchema,
  RefreshRequestSchema,
} from '@lotg/protocol';
import type { FastifyInstance } from 'fastify';

import { fetchGithubId } from '../auth/github';
import {
  createAnonymousAccount,
  linkOrSignInWithGithub,
  recoverAccount,
  revokeSession,
  rotateRecoveryCode,
  rotateRefreshToken,
} from '../auth/service';
import type { AppContext } from '../context';
import { optionalIdentity, requireIdentity } from '../plugins/auth';
import { perIpLimit } from '../plugins/ratelimit';

export function registerAuthRoutes(app: FastifyInstance, ctx: AppContext): void {
  // Respostas com credenciais nunca podem ser guardadas por caches.
  app.addHook('onSend', async (request, reply) => {
    if (request.url.includes('/auth/')) {
      void reply.header('cache-control', 'no-store');
    }
  });

  app.post(
    '/auth/anonymous',
    { config: perIpLimit('anonymous', ctx.config.accountCreatePerHourPerIp, '1 hour') },
    async (request, reply) => {
      const body = AnonymousRequestSchema.parse(request.body);
      return reply.status(201).send(await createAnonymousAccount(ctx, body));
    },
  );

  app.post('/auth/refresh', async (request) => {
    const body = RefreshRequestSchema.parse(request.body);
    return rotateRefreshToken(ctx, body.refreshToken);
  });

  app.post('/auth/logout', async (request, reply) => {
    const identity = await requireIdentity(ctx, request);
    await revokeSession(ctx, identity.sessionId);
    return reply.status(204).send();
  });

  app.post('/auth/recovery-code', async (request) => {
    const identity = await requireIdentity(ctx, request);
    const body: RecoveryCodeResponse = { code: await rotateRecoveryCode(ctx, identity.accountId) };
    return body;
  });

  app.post(
    '/auth/recover',
    { config: perIpLimit('recover', ctx.config.recoveryAttemptsPerHourPerIp, '1 hour') },
    async (request) => {
      const body = RecoverRequestSchema.parse(request.body);
      return recoverAccount(ctx, body);
    },
  );

  app.post('/auth/github', async (request) => {
    const body = GithubAuthRequestSchema.parse(request.body);
    const identity = await optionalIdentity(ctx, request);
    const githubId = await fetchGithubId(ctx, body.githubAccessToken);
    return linkOrSignInWithGithub(ctx, {
      githubId,
      currentAccountId: identity?.accountId ?? null,
      deviceLabel: body.deviceLabel,
      resolve: body.resolve,
    });
  });
}
