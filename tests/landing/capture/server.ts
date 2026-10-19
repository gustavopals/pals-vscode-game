import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../../packages/server/src/app';
import { testConfig } from '../../../packages/server/test/helpers/app';
import { createTestPool, resetTestDb, truncateAll } from '../../../packages/server/test/helpers/db';

/**
 * A API de verdade para as capturas de tela da página de apresentação. É o servidor dos testes
 * em navegador (tests/e2e/server.ts) com duas diferenças, para a captura mostrar o que um
 * jogador novo vê em produção: o ritmo é o do servidor (ADR 0011), e não o do GDD, e o vínculo
 * GitHub fica desligado. Nada disto está no código de produção.
 */

process.env.TEST_DATABASE_URL ??= 'postgres://lotg:lotg@localhost:5433/lotg_test';

const PORT = Number(process.env.CAPTURE_API_PORT ?? 3190);

let offsetMs = 0;
const clock = () => new Date(Date.now() + offsetMs);

await resetTestDb();
const pool = createTestPool();
const { app } = await buildApp({
  config: testConfig({ PUBLIC_URL: `http://localhost:${PORT}`, GAME_TIME_SCALE: '3' }),
  pool,
  clock,
  logger: false,
});

// As rotas de controle ficam fora de `/v1`: o app nunca as alcança pelo repasse.
const control = app as unknown as FastifyInstance;

control.post('/__test/reset', async () => {
  await truncateAll(pool);
  offsetMs = 0;
  return { ok: true };
});

/** Adianta o relógio do servidor. A captura adianta o do navegador na mesma medida. */
control.post('/__test/advance', async (request) => {
  const { ms } = request.body as { ms: number };
  offsetMs += ms;
  return { now: clock().toISOString() };
});

type StoredHero = { id: string; status: string };
type StoredState = {
  lastProcessedAt: number;
  ids: Record<string, number>;
  settlement: { buildings: Record<string, number> };
  guild: { heroes: StoredHero[]; expeditions: unknown[] };
};

/**
 * Põe um herói no feudo, pronto, sem carta nem Taverna: a equipe da captura da Guilda, com o
 * nome, a classe e o gênero pedidos, sem traço e sem item (a mesma rota de tests/e2e/server.ts).
 */
control.post('/__test/hero', async (request) => {
  const {
    name,
    classId = 'warrior',
    level = 1,
    gender = 'm',
  } = request.body as { name: string; classId?: string; level?: number; gender?: 'f' | 'm' };
  const games = await pool.query<{ id: string; state: StoredState }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    const number = (state.ids.hero ?? 0) + 1;
    state.ids.hero = number;
    state.guild.heroes.push({
      id: `hero-${number}`,
      name,
      gender,
      classId,
      level,
      xp: 0,
      traits: [],
      status: 'idle',
      injury: null,
      captivity: null,
      equipment: { weapon: null, armor: null, accessory: null },
      joinedAtMs: state.lastProcessedAt,
      freedAtMs: null,
      discontent: false,
    } as unknown as StoredHero);
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe a Guilda dos Aventureiros de pé e a equipe inteira que está no feudo (até dois heróis) na
 * encruzilhada da primeira variante da Floresta Antiga, com a Postura pedida e o prazo de 12 h
 * de relógio: é a folha que a página de apresentação mostra. Daí em diante tudo é do motor.
 */
control.post('/__test/crossroads', async (request) => {
  const { posture = 'balanced' } = (request.body ?? {}) as {
    posture?: 'cautious' | 'balanced' | 'bold';
  };
  const expiresInMs = 12 * 3_600_000;
  const games = await pool.query<{
    id: string;
    created_at: Date;
    time_scale: string;
    state: StoredState;
  }>('select id, created_at, time_scale, state from games');
  for (const game of games.rows) {
    const { state } = game;
    const team = state.guild.heroes.filter((entry) => entry.status === 'idle').slice(0, 2);
    if (team.length === 0) {
      continue;
    }
    const scale = Number(game.time_scale);
    const nowMs = Math.floor((clock().getTime() - game.created_at.getTime()) * scale);
    const number = (state.ids.expedition ?? 0) + 1;
    for (const hero of team) hero.status = 'expedition';
    state.ids.expedition = number;
    state.settlement.buildings.guild = Math.max(1, state.settlement.buildings.guild ?? 0);
    state.guild.expeditions.push({
      id: `expedition-${number}`,
      modelId: 'oldForest',
      variant: 0,
      heroIds: team.map((hero) => hero.id),
      posture,
      sentAtMs: state.lastProcessedAt,
      durationFactor: { num: 1, den: 1 },
      status: 'atCrossroads',
      nodeId: 'fork',
      nodeEndsAtMs: null,
      crossroads: { decidesAtMs: nowMs + Math.round(expiresInMs * scale) },
      loot: { resources: { food: 0, wood: 0, stone: 0, gold: 0 }, items: [] },
      log: [],
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`API das capturas em http://127.0.0.1:${PORT}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
