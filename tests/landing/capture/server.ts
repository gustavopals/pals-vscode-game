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
      loot: { resources: { food: 0, wood: 0, stone: 0, iron: 0, gold: 0 }, items: [] },
      log: [],
    });
    await pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);
  }
  return { ok: true };
});

/**
 * Põe o feudo às vésperas do Cerco do Inverno, para a captura do painel do Cerco na aba
 * Exército: Quartel, Paliçada e Torre de Vigia de pé, a muralha inteira, soldados, duas
 * formações salvas (uma delas a Defesa ativa) e as três ondas marcadas para daqui a pouco.
 * É a preparação de `/__test/siege` de tests/e2e/server.ts; o painel, o Plano e o que a tela
 * diz são os do jogo.
 */
control.post('/__test/siege', async (request) => {
  const { inMinutes = 90 } = (request.body ?? {}) as { inMinutes?: number };
  type Post = { unit: string; count: number };
  type Wing = { front: Post; back: Post };
  type SiegeReady = {
    lastProcessedAt: number;
    ids: Record<string, number>;
    settings: { timeScale: number };
    settlement: { buildings: Record<string, number>; wall: { hp: Record<string, number> } };
    army: {
      units: Record<string, number>;
      formations: unknown[];
      activeFormationId: string | null;
    };
    siege: unknown;
  };
  const games = await pool.query<{ id: string; state: SiegeReady }>('select id, state from games');
  for (const game of games.rows) {
    const { state } = game;
    state.settlement.buildings.barracks = 5;
    state.settlement.buildings.palisade = 3;
    state.settlement.buildings.watchtower = 3;
    // A vida cheia da muralha no nível 3, como `/__test/raise` a deixaria.
    state.settlement.wall.hp = { left: 200, center: 200, right: 200 };
    state.army.units.spearman = 16;
    state.army.units.swordsman = 8;
    state.army.units.archer = 24;
    state.ids.formation = (state.ids.formation ?? 0) + 2;
    const wing = (front: string): Wing => ({
      front: { unit: front, count: 8 },
      back: { unit: 'archer', count: 8 },
    });
    const formations = [
      { number: state.ids.formation - 1, name: 'Muralha Firme', center: 'swordsman' },
      { number: state.ids.formation, name: 'Guarda do Inverno', center: 'spearman' },
    ].map((entry) => ({
      id: `formation-${entry.number}`,
      name: entry.name,
      posts: { left: wing('spearman'), center: wing(entry.center), right: wing('spearman') },
      commanders: { left: null, center: null, right: null },
    }));
    state.army.formations = formations;
    state.army.activeFormationId = formations[0]?.id ?? null;
    const atMs = state.lastProcessedAt + inMinutes * 60_000 * state.settings.timeScale;
    const waves = [
      ['raider', 'raider', 'banditArcher'],
      ['wolf', 'ogre', 'wolf'],
      ['blackKnight', 'warlord', 'skeleton'],
    ];
    state.siege = {
      year: 1,
      atMs,
      current: 0,
      nextWaveAtMs: atMs,
      plan: { 1: null, 2: null, 3: null },
      result: null,
      breached: false,
      deaths: 0,
      endedAtMs: null,
      aftermathUntilMs: null,
      waves: waves.map(([left, center, right], index) => ({
        number: index + 1,
        composition: [
          { wing: 'left', line: left === 'banditArcher' ? 'back' : 'front', unit: left, count: 6 },
          { wing: 'center', line: 'front', unit: center, count: center === 'warlord' ? 1 : 8 },
          {
            wing: 'right',
            line: right === 'banditArcher' ? 'back' : 'front',
            unit: right,
            count: 6,
          },
        ],
      })),
    };
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
