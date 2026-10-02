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
/**
 * O ritmo com que as partidas nascem quando o jogador não escolhe outro. A suíte foi escrita no
 * ritmo Normal (1) e é nele que roda. `GAME_TIME_SCALE=3` sobe este servidor como o da produção
 * (ADR 0011): o Rápido vem marcado nas boas-vindas. Só os cenários de "ritmo da produção" de
 * `03-retorno-e-conexao.spec.ts` valem nos dois casos, porque fundam o feudo no Rápido de
 * qualquer jeito; os outros esperam os prazos do ritmo 1.
 */
const TIME_SCALE = process.env.GAME_TIME_SCALE?.trim() || '1';

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
    GAME_TIME_SCALE: TIME_SCALE,
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

/**
 * Põe o Conselho de todos os feudos em recesso: a próxima audiência vai para um futuro que
 * teste nenhum alcança. As cartas chegam por sorteio, de 8 em 8 horas no ritmo Normal, e mexem
 * na moral, nos avisos e na barra de status; os cenários que não são sobre o Conselho não podem
 * depender de qual carta a semente tirou. Quem funda o feudo pela página chama isto antes de a
 * resposta chegar a ela (`helpers.ts`), a menos que o teste tenha convocado o conselho. Só o
 * instante do próximo sorteio muda; o resto do estado é o que o motor criou.
 */
const RECESS_UNTIL_GAME_MS = 100 * 365 * 24 * 3_600_000;
control.post('/__test/council-recess', async () => {
  await pool.query(
    `update games set state = jsonb_set(state, '{council,nextDrawAtMs}', to_jsonb($1::bigint))`,
    [RECESS_UNTIL_GAME_MS],
  );
  return { ok: true };
});

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
console.log(`API de teste em http://127.0.0.1:${PORT} (ritmo ${ctx.config.gameTimeScale})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
