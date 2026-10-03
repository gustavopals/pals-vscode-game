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

/**
 * Põe uma carta do catálogo na mesa do Conselho de todos os feudos, agora, com o prazo pedido
 * (24 horas de relógio, se nenhum for dado). Com o conselho em recesso, é como um teste escolhe
 * qual carta está à espera: o sorteio depende da semente e do catálogo, que cresce. A carta entra
 * como chegaria do sorteio, sem escolha anterior; daí em diante o motor cuida dela: a resposta,
 * a expiração e a continuação que a opção marcar são as de verdade. Só não há a linha da
 * chegada na Crônica, porque nenhum evento foi emitido.
 */
control.post('/__test/council-deal', async (request) => {
  const { cardId, expiresInMs = 24 * 3_600_000 } = request.body as {
    cardId: string;
    expiresInMs?: number;
  };
  const games = await pool.query<{ id: string; created_at: Date; time_scale: string }>(
    'select id, created_at, time_scale from games',
  );
  for (const game of games.rows) {
    const scale = Number(game.time_scale);
    // O instante de agora em tempo de jogo, como o servidor o calcula, e o prazo convertido.
    const nowMs = Math.floor((clock().getTime() - game.created_at.getTime()) * scale);
    const card = {
      instanceId: `${cardId}-posta-${nowMs}`,
      cardId,
      drawnAtMs: nowMs,
      expiresAtMs: nowMs + Math.round(expiresInMs * scale),
      origin: null,
    };
    await pool.query(
      `update games
          set state = jsonb_set(state, '{council,pending}',
                                (state -> 'council' -> 'pending') || $2::jsonb)
        where id = $1`,
      [game.id, JSON.stringify([card])],
    );
  }
  return { ok: true };
});

/**
 * Cala a Horda de todos os feudos: no lugar das incursões marcadas fica uma só, para daqui a mil
 * anos de jogo. Como só há uma incursão marcada por vez, os lobos do roteiro não vêm (nem os
 * uivos que os anunciam) e a Ameaça não sorteia outra; ela continua subindo como sempre. Toda
 * partida nova tem os uivos na hora 18 e os lobos na hora 30 de jogo, e eles mexem nos estoques,
 * na moral, nos braços e nos avisos; os cenários que não são sobre a incursão não podem depender
 * disso. Quem funda o feudo pela página chama isto antes de a resposta chegar a ela
 * (`helpers.ts`), a menos que o teste tenha soltado os lobos (`world.wolvesRoam()`). É o mesmo
 * que `quietHorde` faz nos testes de integração do servidor.
 */
const NEVER_GAME_MS = 1000 * 84 * 2 * 3_600_000;
control.post('/__test/horde-quiet', async () => {
  const never = {
    id: 'never',
    atMs: NEVER_GAME_MS,
    kind: 'threat',
    enemy: 'wolves',
    size: 'light',
    announcedAtMs: null,
  };
  await pool.query(
    `update games set state = jsonb_set(state, '{horde,scheduledRaids}', $1::jsonb)`,
    [JSON.stringify([never])],
  );
  return { ok: true };
});

/**
 * Põe um edifício de todos os feudos em um nível, sem obra: é como um teste da incursão tem a
 * Torre de Vigia ou a Paliçada de pé antes da hora dos lobos, sem jogar as dezenas de horas que
 * o Salão do Senhor leva para liberá-las (a obra de verdade é coberta pelos cenários da Torre e
 * pelos testes do servidor). Só o nível muda; daí em diante o aviso, a defesa e o desfecho são
 * os do motor.
 */
control.post('/__test/raise', async (request) => {
  const { building, level } = request.body as { building: string; level: number };
  await pool.query(
    `update games
        set state = jsonb_set(state, array['settlement', 'buildings', $1::text], to_jsonb($2::int))`,
    [building, level],
  );
  return { ok: true };
});

/**
 * Põe a Ameaça de todos os feudos em um valor, sem passar pelos dias: é como um teste tem a
 * Ameaça perto de uma marca da Crônica sem jogar as dezenas de horas que ela leva para subir
 * (a subida de verdade é coberta pelo cenário da Torre de Vigia e pelos testes do motor). Só o
 * número muda; daí em diante a subida, as marcas e o sorteio são os do motor.
 */
control.post('/__test/threat', async (request) => {
  const { level } = request.body as { level: number };
  await pool.query(`update games set state = jsonb_set(state, '{map,threat}', to_jsonb($1::int))`, [
    level,
  ]);
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
