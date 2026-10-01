import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../packages/server/src/app';
import { runJobsOnce } from '../../packages/server/src/jobs/scheduler';
import { testConfig } from '../../packages/server/test/helpers/app';
import { createTestPool, resetTestDb, truncateAll } from '../../packages/server/test/helpers/db';
import { fakeGithub } from '../../packages/server/test/helpers/github';

/**
 * A API de verdade para os testes em navegador, contra o banco de teste, com três coisas que só
 * existem aqui: um relógio que os testes adiantam, um GitHub de mentira e rotas `/__test` para
 * comandar os dois. Nada disto está no código de produção.
 */

process.env.TEST_DATABASE_URL ??= 'postgres://lotg:lotg@localhost:5433/lotg_test';

const PORT = Number(process.env.E2E_API_PORT ?? 3100);
const GITHUB = 'https://github.test';

let offsetMs = 0;
const clock = () => new Date(Date.now() + offsetMs);
const github = fakeGithub({ api: GITHUB, oauth: GITHUB });

await resetTestDb();
const pool = createTestPool();
const { app, ctx } = await buildApp({
  config: testConfig({
    PUBLIC_URL: `http://localhost:${PORT}`,
    GITHUB_OAUTH_URL: GITHUB,
    GITHUB_CLIENT_ID: 'cliente-e2e',
  }),
  pool,
  clock,
  fetch: github.fetch,
  logger: false,
});

// As rotas de controle ficam fora de `/v1`: o app nunca as alcança pelo repasse.
const control = app as unknown as FastifyInstance;

/** Esvazia o reino e volta o relógio e o GitHub ao começo. */
control.post('/__test/reset', async () => {
  await truncateAll(pool);
  offsetMs = 0;
  github.reset();
  return { ok: true };
});

/** Adianta o relógio do servidor. O teste adianta o do navegador na mesma medida. */
control.post('/__test/advance', async (request) => {
  const { ms } = request.body as { ms: number };
  offsetMs += ms;
  return { now: clock().toISOString() };
});

control.post('/__test/jobs', async () => runJobsOnce(ctx));

/** Encerra no servidor todas as sessões, como uma revogação por reuso de refresh token. */
control.post('/__test/revoke-sessions', async () => {
  await pool.query('update sessions set revoked_at = $1 where revoked_at is null', [clock()]);
  return { ok: true };
});

control.post('/__test/github', async (request) => {
  const { action, userCode, githubId } = request.body as {
    action: 'approve' | 'deny' | 'expire' | 'slowDown' | 'down' | 'up';
    userCode?: string;
    githubId?: number;
  };
  switch (action) {
    case 'approve': {
      const user = githubId === undefined ? github.newUser() : github.userWithId(githubId);
      return github.approve(userCode ?? '', user);
    }
    case 'deny':
      github.deny(userCode ?? '');
      break;
    case 'expire':
      github.expire(userCode ?? '');
      break;
    case 'slowDown':
      github.slowDownNext(userCode ?? '');
      break;
    case 'down':
      github.setDown(true);
      break;
    case 'up':
      github.setDown(false);
      break;
  }
  return { ok: true };
});

await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`API de teste em http://127.0.0.1:${PORT}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
