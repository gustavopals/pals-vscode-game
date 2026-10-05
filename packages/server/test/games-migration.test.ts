import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ApiError,
  Command,
  CommandAccepted,
  EventsResponse,
  GameRuleError,
  ListGamesResponse,
  ViewResponse,
} from '@lotg/protocol';
import {
  canonicalJson,
  CommandAcceptedSchema,
  GameRuleErrorSchema,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { lockGame, persistState } from '../src/games/repository';
import { advanceStaleGames } from '../src/jobs/advanceStaleGames';
import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  countRows,
  createTestApp,
  DAY,
  fakeClock,
  HOUR,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Testes derivados da documentação: roadmap da v0.2, V2B-T1 (migração de `GameState` por
// `schemaVersion`), GDD §14.8 e §15.4 e ADR 0013, decisão 4. As linhas de partida são gravadas
// direto no banco, a partir de retratos feitos pelo motor da v0.1 (`schema_version = 1`).

const REPLAYED = 'x-lords-replayed';
const CURRENT = 12;

type StoredState = {
  schemaVersion: number;
  seed: string;
  lastProcessedAt: number;
  migratedAtMs?: number | null;
  clock: { year: number };
  settings: Record<string, unknown>;
  settlement: {
    name: string;
    resources: Record<string, number>;
    population: { villagers: number };
    workers: Record<string, number>;
    buildings: Record<string, number>;
  };
  objectives: { active: string[]; completed: string[] };
  stats: Record<string, number>;
};

const FIXTURES = [
  ['fresh', 1],
  ['construction', 3],
  ['famine', 1],
  ['objectives', 0.5],
  ['week-scripted', 1],
  ['week-bot-3x', 3],
] as const;
type FixtureName = (typeof FIXTURES)[number][0];

/** Um retrato da versão 1, como o motor da v0.1 o gravou. Cada chamada lê uma cópia nova. */
function v1State(name: FixtureName): StoredState {
  const url = new URL(`../../engine/src/__fixtures__/state-v1-${name}.json`, import.meta.url);
  return JSON.parse(readFileSync(url, 'utf8')) as StoredState;
}

/**
 * O feudo de um retrato da versão 1 depois de migrado e antes de o tempo andar: o que o jogador
 * tinha, mais o que cada versão acrescentou vazio (o frio fechado, o Celeiro, o Armazém, a Torre
 * de Vigia e a Paliçada por construir, nenhum desperdício, a segunda fila de obras livre e as
 * planejadas como manuais). O estoque fica como estava, mesmo acima do limite. Só para os
 * retratos sem fome: a fome aberta ganha campos (ver "uma partida gravada na versão 11, em fome").
 */
function migratedSettlement(before: StoredState): Record<string, unknown> {
  const { constructionQueues, planned } = before.settlement as unknown as {
    constructionQueues: unknown[];
    planned: Array<Record<string, unknown>>;
  };
  return {
    ...before.settlement,
    cold: null,
    buildings: {
      ...before.settlement.buildings,
      granary: 0,
      warehouse: 0,
      watchtower: 0,
      palisade: 0,
    },
    wasted: { food: 0, wood: 0, stone: 0, gold: 0 },
    constructionQueues: [...constructionQueues, null],
    planned: planned.map((plan) => ({ ...plan, autoStart: false })),
    // Os ofícios (V2C-T3): experiência em zero e todo mundo já adaptado.
    craftExperience: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 },
    craftMasteredYear: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 },
    adaptation: [],
    // A moral (V2C-T4): a base, sem efeito temporário nenhum.
    morale: 50,
    moraleEffects: [],
    // As incursões (V2E-T3): ninguém estava ferido.
    injured: [],
    // A fome que reabre (V2G-T2): nenhuma fome acabada guardada.
    lastFamine: null,
  };
}

/** A resposta 200 de uma ordem, como o servidor da v0.1 a guardou em `commands.response_body`. */
const v1Receipt = JSON.parse(
  readFileSync(new URL('./__fixtures__/receipt-v1.json', import.meta.url), 'utf8'),
) as {
  command: Pick<Command, 'type' | 'payload'>;
  responseStatus: number;
  responseBody: Record<string, unknown>;
  stateAfter: StoredState;
};

type Row = {
  status: string;
  schemaVersion: number;
  stateVersion: number;
  timeScale: number;
  difficulty: string;
  lastProcessedAt: string;
  /** Muda a cada `UPDATE` da linha: serve de contador de escritas. */
  xmin: string;
  state: StoredState;
};

async function rowOf(app: TestApp, gameId: string): Promise<Row> {
  const { rows } = await app.pool.query<{
    status: string;
    schema_version: number;
    state_version: string;
    time_scale: string;
    difficulty: string;
    last_processed_at: Date;
    xmin: string;
    state: StoredState;
  }>(
    `select status, schema_version, state_version::text as state_version, time_scale, difficulty,
            last_processed_at, xmin::text as xmin, state
       from games where id = $1`,
    [gameId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Partida ${gameId} não está no banco.`);
  }
  return {
    status: row.status,
    schemaVersion: row.schema_version,
    stateVersion: Number(row.state_version),
    timeScale: Number(row.time_scale),
    difficulty: row.difficulty,
    lastProcessedAt: row.last_processed_at.toISOString(),
    xmin: row.xmin,
    state: row.state,
  };
}

type OldGame = { id: string; token: string; refreshToken: string; accountId: string };

/**
 * Grava uma partida como o servidor da v0.1 a deixou: `schema_version` e estado na versão
 * informada, criada há tempo bastante para o relógio de jogo estar exatamente onde o estado
 * parou. `staleForMs` empurra `last_processed_at` para o passado, para o job enxergá-la.
 */
async function insertGame(
  app: TestApp,
  state: StoredState,
  options: {
    timeScale?: number;
    stateVersion?: number;
    status?: 'active' | 'archived';
    staleForMs?: number;
    schemaVersion?: number;
  } = {},
): Promise<OldGame> {
  const auth = await signUp(app, 'Senhor Antigo');
  const timeScale = options.timeScale ?? 1;
  const now = app.clock.now().getTime();
  const id = randomUUID();
  await app.pool.query(
    `insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                        schema_version, state, state_version, last_processed_at, created_at, updated_at)
     values ($1, $2, $3, $4, 'lord', $5, 'America/Sao_Paulo', 20, $6, $7::jsonb, $8, $9, $10, $9)`,
    [
      id,
      auth.account.id,
      options.status ?? 'active',
      state.seed,
      String(timeScale),
      options.schemaVersion ?? state.schemaVersion,
      JSON.stringify(state),
      options.stateVersion ?? 7,
      new Date(now - (options.staleForMs ?? 0)),
      // Arredondado para baixo: o relógio de jogo nunca fica atrás do estado, então a primeira
      // leitura encontra a partida exatamente no instante do retrato.
      new Date(now - Math.floor(state.lastProcessedAt / timeScale)),
    ],
  );
  return {
    id,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
    accountId: auth.account.id,
  };
}

const getView = (app: TestApp, game: OldGame) =>
  call<ViewResponse>(app, 'GET', `/games/${game.id}/view`, { token: game.token });

function requestHash(command: Pick<Command, 'type' | 'payload'>): string {
  return createHash('sha256')
    .update(canonicalJson({ type: command.type, payload: command.payload }))
    .digest('hex');
}

async function insertReceipt(app: TestApp, game: OldGame, commandId: string): Promise<void> {
  await app.pool.query(
    `insert into commands (game_id, id, account_id, seq, type, payload, request_hash, server_time,
                           result, error_code, response_status, response_body)
     values ($1, $2, $3, 1, $4, $5::jsonb, $6, $7, 'accepted', null, $8, $9::jsonb)`,
    [
      game.id,
      commandId,
      game.accountId,
      v1Receipt.command.type,
      JSON.stringify(v1Receipt.command.payload),
      requestHash(v1Receipt.command),
      app.clock.now(),
      v1Receipt.responseStatus,
      JSON.stringify(v1Receipt.responseBody),
    ],
  );
}

function stock(view: ViewResponse['view'], id: string): number {
  const found = view.resources.find((resource) => resource.id === id);
  if (found === undefined) {
    throw new Error(`Recurso ${id} ausente da view.`);
  }
  return found.stock;
}

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

describe('partida nova', () => {
  it('nasce na versão atual do estado, com dificuldade e ritmo dentro dele e sem fronteira', async () => {
    const player = await newPlayer(server);
    const row = await rowOf(server, player.game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    expect(row.state.schemaVersion).toBe(CURRENT);
    expect(row.state.settings).toEqual({
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 1,
    });
    expect(row.state.migratedAtMs).toBeNull();
  });

  it('guarda no estado o ritmo com que o servidor a criou', async () => {
    const fast = await createTestApp({ config: { GAME_TIME_SCALE: '3' } });
    try {
      const player = await newPlayer(fast);
      const row = await rowOf(fast, player.game.id);
      expect(row.timeScale).toBe(3);
      expect(row.state.settings.timeScale).toBe(3);
    } finally {
      await fast.close();
    }
  });
});

describe('uma partida gravada na versão 1', () => {
  it('carrega na primeira leitura e é persistida na versão atual, com tudo o que o jogador tinha', async () => {
    const before = v1State('construction');
    const game = await insertGame(server, before, { timeScale: 3, stateVersion: 7 });
    expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 1, stateVersion: 7 });

    const reply = await getView(server, game);
    expect(reply.status).toBe(200);
    expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
    // A migração é uma escrita do estado: a versão persistida sobe uma vez.
    expect(reply.body.stateVersion).toBe('8');

    const row = await rowOf(server, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    expect(row.stateVersion).toBe(8);
    expect(row.state.schemaVersion).toBe(CURRENT);
    expect(row.state.settings).toEqual({
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 3,
    });
    // A fronteira é o instante de jogo até onde a v0.1 simulou, não o instante da leitura.
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
    // O feudo é o da v0.1, campo por campo; as versões seguintes só acrescentam o que não havia.
    expect(row.state.settlement).toEqual(migratedSettlement(before));
    expect(row.state.objectives).toEqual(before.objectives);
    expect(row.state.stats).toEqual(before.stats);
    expect(row.state.seed).toBe(before.seed);

    const { view } = reply.body;
    expect(view.settlement.name).toBe('Pedra Alta');
    // A partida da v0.1 aparece como o que sempre foi: Senhor, no ritmo em que nasceu.
    expect(view.settlement).toMatchObject({
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Rápido: um ano em 56 horas',
    });
    expect(stock(view, 'gold')).toBe(250);
    expect(view.population.villagers).toBe(5);
    expect(view.constructions.planned.map((plan) => plan.building)).toEqual(['farm', 'lumberMill']);
    // A obra do retrato acaba aos 240.000 ms de jogo e o estado está em 127.321 ms: no ritmo 3,
    // faltam 38 segundos reais (37,56 arredondados para cima).
    expect(view.constructions.active).toMatchObject({ building: 'housing', targetLevel: 2 });
    expect(view.constructions.active?.secondsRemaining).toBe(38);
  });

  it('em um ritmo que o jogo não oferece mais, segue nele, com um rótulo honesto', async () => {
    // O 2× saiu da lista (ADR 0013, decisão 2), mas uma partida criada nele não muda.
    const before = v1State('fresh');
    const game = await insertGame(server, before, { timeScale: 2 });
    const reply = await getView(server, game);
    expect(reply.status).toBe(200);
    expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.view.settlement).toMatchObject({
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Ritmo 2×: um ano em 3 dias e 12 horas',
    });
    // O dia de jogo de 2 h dura 1 h real no ritmo 2.
    const { calendar } = reply.body.view;
    expect(calendar.secondsToNextDay).toBe(Math.ceil((7_200_000 - before.lastProcessedAt) / 2000));
    const row = await rowOf(server, game.id);
    expect(row).toMatchObject({ timeScale: 2, difficulty: 'lord' });
    expect(row.state.settings).toMatchObject({ timeScale: 2, difficulty: 'lord' });
  });

  it('a leitura seguinte não migra nem escreve de novo', async () => {
    const game = await insertGame(server, v1State('fresh'));
    await getView(server, game);
    const migrated = await rowOf(server, game.id);

    const again = await getView(server, game);
    expect(again.status).toBe(200);
    const row = await rowOf(server, game.id);
    expect(row.xmin).toBe(migrated.xmin);
    expect(row.stateVersion).toBe(migrated.stateVersion);
    expect(row.state).toEqual(migrated.state);
  });

  it.each(FIXTURES)(
    'retrato %s (ritmo %s): carrega, avança 21 dias reais e aceita ordens',
    async (name, timeScale) => {
      const clock = fakeClock();
      const app = await createTestApp({ clock });
      try {
        const before = v1State(name);
        const game = await insertGame(app, before, { timeScale });

        const first = await getView(app, game);
        expect(first.status).toBe(200);
        expect(ViewResponseSchema.safeParse(first.body).error).toBeUndefined();
        expect(first.body.view.population.villagers).toBe(before.settlement.population.villagers);
        expect(first.body.view.calendar.year).toBe(before.clock.year);
        for (const [id, milli] of Object.entries(before.settlement.resources)) {
          expect(stock(first.body.view, id)).toBe(Math.floor(milli / 1000));
        }

        // Três semanas: a sessão do teste vale 30 dias no total.
        clock.advance(21 * DAY);
        await renew(app, game);
        const later = await getView(app, game);
        expect(later.status).toBe(200);
        expect(ViewResponseSchema.safeParse(later.body).error).toBeUndefined();
        // 21 dias reais são 21 × 12 × ritmo dias de jogo; o ano de jogo tem 84 dias.
        const gameDays = Math.floor((before.lastProcessedAt + 21 * DAY * timeScale) / (2 * HOUR));
        expect(later.body.view.calendar.year).toBe(Math.floor(gameDays / 84) + 1);

        const renamed = await send<CommandAccepted>(
          app,
          game.token,
          game.id,
          order('renameSettlement', { name: 'Vau do Corvo' }),
        );
        expect(renamed.status).toBe(200);
        expect(CommandAcceptedSchema.safeParse(renamed.body).error).toBeUndefined();
        expect(renamed.body.view.settlement.name).toBe('Vau do Corvo');
        const idle = await send<CommandAccepted>(
          app,
          game.token,
          game.id,
          order('setWorkers', { building: 'goldMine', count: 0 }),
        );
        expect(idle.status).toBe(200);

        const row = await rowOf(app, game.id);
        expect(row.schemaVersion).toBe(CURRENT);
        expect(row.state.schemaVersion).toBe(CURRENT);
        expect(row.state.settings.timeScale).toBe(timeScale);
        expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
        expect(row.state.settlement.name).toBe('Vau do Corvo');
      } finally {
        await app.close();
      }
    },
  );

  it('uma ordem como primeiro contato migra, aplica e grava tudo em uma escrita só', async () => {
    const before = v1State('objectives');
    const game = await insertGame(server, before, { stateVersion: 12 });

    const reply = await send<CommandAccepted>(
      server,
      game.token,
      game.id,
      order('setWorkers', { building: 'goldMine', count: 0 }),
    );
    expect(reply.status).toBe(200);
    expect(CommandAcceptedSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.stateVersion).toBe('13');

    const row = await rowOf(server, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    expect(row.stateVersion).toBe(13);
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
    expect(row.state.settlement.workers).toMatchObject({ farm: 2, lumberMill: 3, quarry: 3 });
  });

  it('quem concluiu os quatro objetivos na v0.1 recebe os da v0.2, sem prêmio repetido (QA-01)', async () => {
    // O retrato da v0.1 com os quatro objetivos concluídos: o quarto pagou +50 ouro na época.
    const before = v1State('objectives');
    expect(before.objectives.active).toEqual([]);
    expect(before.objectives.completed).toHaveLength(4);
    const game = await insertGame(server, before, { timeScale: 3, stateVersion: 5 });
    // Um minuto depois: a fronteira é acomodada antes de o tempo andar.
    server.clock.advance(60_000);

    const reply = await getView(server, game);
    expect(reply.status).toBe(200);
    expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
    const { view } = reply.body;
    expect(view.objectives.map((objective) => [objective.id, objective.status])).toEqual([
      ['allocateFarmers', 'completed'],
      ['upgradeHousing', 'completed'],
      ['recruitVillagers', 'completed'],
      ['townHallLevel2', 'completed'],
      ['buildWatchtower', 'active'],
      ['answerFirstCard', 'active'],
      ['buildGranaryOrWarehouse', 'active'],
    ]);
    // O ouro é o da v0.1, e o Salão no nível 2 já libera as obras dos objetivos novos.
    expect(stock(view, 'gold')).toBe(190);
    const tower = view.objectives.find((objective) => objective.id === 'buildWatchtower');
    expect(tower).toMatchObject({
      reward: '+40 pedra',
      target: { kind: 'building', building: 'watchtower' },
    });
    expect(tower?.missing).toMatch(/^Faltam .*\.$/);
    // No ritmo 3, um dia de jogo são 40 minutos de quem joga.
    expect(view.objectives.find((objective) => objective.id === 'answerFirstCard')?.reward).toBe(
      '+10 de moral por 1 dia de jogo (40 min)',
    );

    const row = await rowOf(server, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    expect(row.state.objectives).toEqual({
      active: ['buildWatchtower', 'answerFirstCard', 'buildGranaryOrWarehouse'],
      completed: before.objectives.completed,
    });
    // Nenhum objetivo foi concluído de novo: a Crônica não ganhou linha de recompensa.
    const events = await call<EventsResponse>(server, 'GET', `/games/${game.id}/events?after=0`, {
      token: game.token,
    });
    expect(events.status).toBe(200);
    expect(events.body.events.filter((event) => event.type === 'objectiveCompleted')).toEqual([]);

    // A primeira ordem depois da migração não paga nada outra vez.
    const renamed = await send<CommandAccepted>(
      server,
      game.token,
      game.id,
      order('renameSettlement', { name: 'Pedra Nova' }),
    );
    expect(renamed.status).toBe(200);
    expect(renamed.body.events.map((event) => event.type)).toEqual(['settlementRenamed']);
    expect(stock(renamed.body.view, 'gold')).toBe(190);
  });

  it('uma ordem recusada como primeiro contato também deixa a migração gravada', async () => {
    const before = v1State('famine');
    const game = await insertGame(server, before, { stateVersion: 4 });

    const reply = await send<GameRuleError>(
      server,
      game.token,
      game.id,
      order('recruitVillagers', { quantity: 1 }),
    );
    expect(reply.status).toBe(422);
    expect(GameRuleErrorSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.details.code).toBe('FAMINE');

    const row = await rowOf(server, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    expect(row.stateVersion).toBe(5);
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
  });

  it('leituras concorrentes, em duas réplicas, migram uma vez só', async () => {
    const clock = fakeClock();
    const first = await createTestApp({ clock });
    const second = await createTestApp({ clock });
    try {
      const before = v1State('week-scripted');
      const game = await insertGame(first, before, { stateVersion: 40 });

      const replies = await Promise.all([
        getView(first, game),
        getView(second, game),
        call(first, 'GET', `/games/${game.id}/events?after=0`, { token: game.token }),
        call(second, 'GET', `/games/${game.id}/chronicle`, { token: game.token }),
        getView(second, game),
        getView(first, game),
      ]);
      expect(replies.map((reply) => reply.status)).toEqual([200, 200, 200, 200, 200, 200]);

      // Uma escrita: a de quem pegou o lock primeiro. Os outros já encontraram a versão nova.
      const row = await rowOf(first, game.id);
      expect(row.schemaVersion).toBe(CURRENT);
      expect(row.stateVersion).toBe(41);
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(row.state.settlement).toEqual(migratedSettlement(before));
      const views = [replies[0], replies[1], replies[4], replies[5]] as Array<{
        body: ViewResponse;
      }>;
      for (const { body } of views) {
        expect(body).toEqual(views[0]?.body);
        expect(body.stateVersion).toBe('41');
      }
    } finally {
      await first.close();
      await second.close();
    }
  });

  it('uma ordem e uma leitura ao mesmo tempo gravam a migração uma vez e a ordem uma vez', async () => {
    const before = v1State('objectives');
    const game = await insertGame(server, before, { stateVersion: 20 });

    const [command, view] = await Promise.all([
      send<CommandAccepted>(
        server,
        game.token,
        game.id,
        order('renameSettlement', { name: 'Pedra Nova' }),
      ),
      getView(server, game),
    ]);
    expect(command.status).toBe(200);
    expect(view.status).toBe(200);

    const row = await rowOf(server, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    // Duas escritas, em qualquer ordem: a migração (pela leitura ou pela ordem) e a ordem.
    expect([21, 22]).toContain(row.stateVersion);
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
    expect(row.state.settlement.name).toBe('Pedra Nova');
  });

  it('o job migra quem não voltou e grava os eventos da ausência', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      // O job olha o banco inteiro: este teste começa com ele vazio.
      await truncateAll(app.pool);
      const before = v1State('construction');
      const game = await insertGame(app, before, { timeScale: 3 });
      clock.advance(2 * HOUR);

      const report = await advanceStaleGames(app.ctx);
      expect(report).toEqual({ advanced: 1, events: 6, failed: 0 });

      const row = await rowOf(app, game.id);
      expect(row.schemaVersion).toBe(CURRENT);
      expect(row.stateVersion).toBe(8);
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      // Duas horas reais no ritmo 3 são seis horas de jogo.
      expect(row.state.lastProcessedAt).toBe(
        (Math.floor(before.lastProcessedAt / 3) + 2 * HOUR) * 3,
      );
      expect(row.state.settlement.buildings.housing).toBe(2);
      expect(row.state.settlement.population.villagers).toBe(7);
      const { rows } = await app.pool.query<{ kind: string }>(
        'select kind from game_events where game_id = $1 order by seq',
        [game.id],
      );
      expect(rows.map((event) => event.kind)).toEqual([
        'constructionFinished',
        'recruitmentFinished',
        'recruitmentFinished',
        'dayStarted',
        'dayStarted',
        'dayStarted',
      ]);
    } finally {
      await app.close();
    }
  });

  it('arquivada: a Crônica continua legível e a linha fica como estava', async () => {
    const game = await insertGame(server, v1State('week-scripted'), { status: 'archived' });
    const before = await rowOf(server, game.id);

    const chronicle = await call<string>(server, 'GET', `/games/${game.id}/chronicle.md`, {
      token: game.token,
    });
    expect(chronicle.status).toBe(200);
    expect(chronicle.body).toContain('# Crônica de Pedra Alta do Norte');
    const view = await getView(server, game);
    expect(view.status).toBe(409);
    const list = await call<ListGamesResponse>(server, 'GET', '/games', { token: game.token });
    expect(list.body.games[0]).toMatchObject({
      id: game.id,
      status: 'archived',
      settlementName: 'Pedra Alta do Norte',
    });

    expect(await rowOf(server, game.id)).toEqual(before);
  });
});

describe('uma partida gravada na versão 11, em fome (V2G-T2; ADR 0016, itens 2 e 3)', () => {
  const GAME_DAY = 2 * HOUR;
  type Famine = { sinceMs: number; carriedMs?: number; deserted?: number } | null;
  type Starving = StoredState & {
    settings: { timeScale: number; difficulty: string };
    settlement: StoredState['settlement'] & { famine: Famine; lastFamine?: unknown };
  };

  /** Um retrato da versão 11, como o motor de antes da deserção em tempo real o gravou. */
  function v11State(name: string): Starving {
    const url = new URL(`../../engine/src/__fixtures__/state-v11-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as Starving;
  }

  async function insertV11(app: TestApp, state: Starving, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  async function deserters(app: TestApp, game: OldGame): Promise<number[]> {
    const reply = await call<EventsResponse>(app, 'GET', `/games/${game.id}/events?limit=500`, {
      token: game.token,
    });
    expect(reply.status).toBe(200);
    return reply.body.events
      .filter((event) => event.type === 'villagerDeserted')
      .map((event) => event.atMs / HOUR);
  }

  /**
   * Leva o relógio real até o instante de jogo `gameMs` desta partida (a criação mais o instante
   * de jogo dividido pelo ritmo), renova a sessão e lê a visão.
   */
  async function until(app: TestApp, game: OldGame, timeScale: number, gameMs: number) {
    const { rows } = await app.pool.query<{ created_at: Date }>(
      'select created_at from games where id = $1',
      [game.id],
    );
    const createdAt = rows[0]?.created_at.getTime() ?? 0;
    const target = createdAt + Math.ceil(gameMs / timeScale);
    app.clock.advance(target - app.clock.now().getTime());
    await renew(app, game);
    expect((await getView(app, game)).status).toBe(200);
  }

  it.each([
    // Rápido: 45 h 30 de fome na última virada; carência de 36 h de jogo e passo de 6 h.
    { name: 'famine-3x', timeScale: 3, villagers: 18, charged: 2, next: [50, 56, 62] },
    // Tranquilo: 6 h 20 de fome; carência de 6 h de jogo e passo de 1 h.
    { name: 'famine-half', timeScale: 0.5, villagers: 12, charged: 1, next: [10, 10, 12, 12] },
  ])(
    '$name: entra com os desertores que a regra nova já teria cobrado, ninguém sai na fronteira, e os seguintes saem no prazo novo',
    async ({ name, timeScale, villagers, charged, next }) => {
      const app = await createTestApp({ clock: fakeClock() });
      try {
        const before = v11State(name);
        expect(before.schemaVersion).toBe(11);
        expect(before.settings.timeScale).toBe(timeScale);
        expect(before.settlement.population.villagers).toBe(villagers);
        expect(before.settlement.famine).toEqual({ sinceMs: before.settlement.famine?.sinceMs });
        const game = await insertV11(app, before);

        const reply = await getView(app, game);
        expect(reply.status).toBe(200);
        expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
        const row = (await rowOf(app, game.id)) as Row & { state: Starving };
        expect(row.schemaVersion).toBe(CURRENT);
        expect(row.state.schemaVersion).toBe(CURRENT);
        expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
        expect(row.state.settlement.famine).toEqual({
          sinceMs: before.settlement.famine?.sinceMs,
          carriedMs: 0,
          deserted: charged,
        });
        expect(row.state.settlement.lastFamine).toBeNull();
        // Ninguém saiu na fronteira, e a migração não gravou evento nenhum.
        expect(row.state.settlement.population.villagers).toBe(villagers);
        expect(reply.body.view.population.villagers).toBe(villagers);
        expect(await countRows(app.pool, 'game_events', `game_id = '${game.id}'`)).toBe(0);

        // Até um milissegundo real antes do primeiro instante devido, ninguém deserta.
        const [first] = next as [number, ...number[]];
        await until(app, game, timeScale, first * HOUR - timeScale);
        expect(await deserters(app, game)).toEqual([]);
        // E os seguintes saem nas viradas que o prazo novo marca.
        await until(app, game, timeScale, (next[next.length - 1] as number) * HOUR);
        expect(await deserters(app, game)).toEqual(next);
        for (const hour of next) {
          expect((hour * HOUR) % GAME_DAY).toBe(0);
        }
      } finally {
        await app.close();
      }
    },
  );

  it('no ritmo Normal a partida em fome entra com os mesmos que a regra antiga cobrou, e sem fome nada muda', async () => {
    const before = v11State('famine');
    expect(before.settings.timeScale).toBe(1);
    const game = await insertV11(server, before);
    expect((await getView(server, game)).status).toBe(200);
    const row = (await rowOf(server, game.id)) as Row & { state: Starving };
    // Dois desertores levaram o feudo de 5 para 3 aldeões: é o que a conta nova também dá.
    expect(row.state.settlement.famine).toEqual({
      sinceMs: before.settlement.famine?.sinceMs,
      carriedMs: 0,
      deserted: 2,
    });
    expect(row.state.settlement.population.villagers).toBe(3);

    // Sem fome: o feudo é o mesmo, com os dois campos novos vazios.
    const calm = v11State('construction');
    const other = await insertV11(server, calm);
    expect((await getView(server, other)).status).toBe(200);
    const after = (await rowOf(server, other.id)) as Row & { state: Starving };
    expect(after.schemaVersion).toBe(CURRENT);
    expect(after.state.settlement).toEqual({ ...calm.settlement, lastFamine: null });
  });

  it('o job de avanço migra a partida em fome de quem não voltou, com a mesma contagem', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v11State('famine-half');
      // Parada há duas horas: o job a enxerga.
      const game = await insertV11(app, before, 2 * HOUR);
      // 40 minutos reais no ritmo Tranquilo: 20 minutos de jogo, até a virada das 10 h.
      const toTurn = (10 * HOUR - before.lastProcessedAt) / 0.5;
      clock.advance(Math.ceil(toTurn));
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: Starving };
      expect(row.schemaVersion).toBe(CURRENT);
      // Um cobrado na fronteira e os dois da virada das 10 h.
      expect(row.state.settlement.famine).toMatchObject({ carriedMs: 0, deserted: 3 });
      expect(row.state.settlement.population.villagers).toBe(10);
      await renew(app, game);
      expect(await deserters(app, game)).toEqual([10, 10]);
    } finally {
      await app.close();
    }
  });
});

describe('recibos da versão anterior', () => {
  it('o reenvio devolve o corpo original, sem migrar, avançar nem reescrever o recibo', async () => {
    const game = await insertGame(server, v1Receipt.stateAfter, { timeScale: 3 });
    const commandId = randomUUID();
    await insertReceipt(server, game, commandId);
    const before = await rowOf(server, game.id);
    server.clock.advance(3 * HOUR);
    await renew(server, game);

    const replay = await send<Record<string, unknown>>(server, game.token, game.id, {
      commandId,
      ...v1Receipt.command,
    } as Command);
    expect(replay.status).toBe(200);
    expect(replay.headers[REPLAYED]).toBe('true');
    expect(replay.body).toEqual(v1Receipt.responseBody);

    // Um recibo é uma resposta antes do avanço: a linha da partida nem foi tocada.
    expect(await rowOf(server, game.id)).toEqual(before);
    const { rows } = await server.pool.query<{ response_body: unknown }>(
      'select response_body from commands where game_id = $1 and id = $2',
      [game.id, commandId],
    );
    expect(rows[0]?.response_body).toEqual(v1Receipt.responseBody);
  });

  it('depois de migrada a partida, o recibo antigo continua valendo e o UUID continua preso à ordem', async () => {
    const game = await insertGame(server, v1Receipt.stateAfter, { timeScale: 3 });
    const commandId = randomUUID();
    await insertReceipt(server, game, commandId);

    expect((await getView(server, game)).status).toBe(200);
    expect((await rowOf(server, game.id)).schemaVersion).toBe(CURRENT);

    const replay = await send<Record<string, unknown>>(server, game.token, game.id, {
      commandId,
      ...v1Receipt.command,
    } as Command);
    expect(replay.status).toBe(200);
    expect(replay.headers[REPLAYED]).toBe('true');
    expect(replay.body).toEqual(v1Receipt.responseBody);

    const conflict = await send<ApiError>(
      server,
      game.token,
      game.id,
      order('startConstruction', { building: 'quarry' }, commandId),
    );
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('COMMAND_ID_CONFLICT');

    // Uma ordem nova, com outro UUID, segue numerada depois do recibo antigo.
    const fresh = await send<CommandAccepted>(
      server,
      game.token,
      game.id,
      order('setWorkers', { building: 'farm', count: 1 }),
    );
    expect(fresh.status).toBe(200);
    const { rows } = await server.pool.query<{ seq: number }>(
      'select seq::int as seq from commands where game_id = $1 order by seq',
      [game.id],
    );
    expect(rows.map((row) => row.seq)).toEqual([1, 2]);
  });
});

describe('estado que este servidor não sabe ler', () => {
  /** Um estado de uma versão que ainda não existe: o que uma imagem antiga encontraria. */
  function futureState(): StoredState {
    const state = v1State('objectives');
    return {
      ...state,
      schemaVersion: CURRENT + 1,
      settings: { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 },
      stats: { ...state.stats },
      // Um campo de uma mecânica que este servidor desconhece.
      ...({ council: { pending: [{ cardId: 'carta-do-futuro' }] } } as object),
    };
  }

  it('versão mais nova: leitura e ordem respondem 500 sem gravar por cima', async () => {
    const game = await insertGame(server, futureState(), { stateVersion: 9 });
    const before = await rowOf(server, game.id);
    server.clock.advance(5 * HOUR);
    await renew(server, game);

    const view = await call<ApiError>(server, 'GET', `/games/${game.id}/view`, {
      token: game.token,
    });
    expect(view.status).toBe(500);
    expect(view.body.code).toBe('INTERNAL');
    // O corpo não descreve o estado nem a causa: só o protocolo de erro e o requestId.
    expect(JSON.stringify(view.body)).not.toContain('carta-do-futuro');
    expect(JSON.stringify(view.body)).not.toContain('versão');

    const command = await send<ApiError>(
      server,
      game.token,
      game.id,
      order('setWorkers', { building: 'farm', count: 0 }),
    );
    expect(command.status).toBe(500);
    const events = await call<ApiError>(server, 'GET', `/games/${game.id}/events?after=0`, {
      token: game.token,
    });
    expect(events.status).toBe(500);

    expect(await rowOf(server, game.id)).toEqual(before);
    const { rows } = await server.pool.query<{ total: string }>(
      `select (select count(*) from commands where game_id = $1)
            + (select count(*) from game_events where game_id = $1) as total`,
      [game.id],
    );
    expect(Number(rows[0]?.total)).toBe(0);
  });

  it('versão mais nova: o job conta a falha, deixa a linha intacta e avança as outras', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const future = await insertGame(app, futureState());
      const old = await insertGame(app, v1State('fresh'));
      const before = await rowOf(app, future.id);
      clock.advance(3 * HOUR);

      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 1 });
      expect(await rowOf(app, future.id)).toEqual(before);
      expect((await rowOf(app, old.id)).schemaVersion).toBe(CURRENT);
    } finally {
      await app.close();
    }
  });

  /** Grava `count` partidas ativas com o mesmo estado, uma por conta, paradas há `staleForMs`. */
  async function insertMany(
    app: TestApp,
    state: StoredState,
    count: number,
    staleForMs: number,
  ): Promise<void> {
    const now = app.clock.now().getTime();
    await app.pool.query(
      `with owners as (
         insert into accounts (id, display_name, created_at, last_seen_at)
         select gen_random_uuid(), 'Senhor ' || n, $1, $1 from generate_series(1, $2::int) as n
         returning id
       )
       insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                          schema_version, state, state_version, last_processed_at, created_at, updated_at)
       select gen_random_uuid(), id, 'active', $3, 'lord', '1', 'America/Sao_Paulo', 20,
              $4, $5::jsonb, 7, $6, $7, $6
         from owners`,
      [
        new Date(now),
        count,
        state.seed,
        state.schemaVersion,
        JSON.stringify(state),
        new Date(now - staleForMs),
        new Date(now - state.lastProcessedAt),
      ],
    );
  }

  it('o job passa por lotes inteiros de partidas ilegíveis e avança as que vêm depois', async () => {
    // É o banco de depois de uma reversão de imagem: as partidas migradas ficam para sempre na
    // cabeça da fila (nunca são escritas, então `last_processed_at` não anda), e são mais de
    // dois lotes de 100. A partida saudável, mais recente, vem depois de todas.
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      await insertMany(app, futureState(), 201, 10 * HOUR);
      const old = await insertGame(app, v1State('fresh'), { staleForMs: 5 * HOUR });
      clock.advance(3 * HOUR);

      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 201 });
      expect((await rowOf(app, old.id)).schemaVersion).toBe(CURRENT);
      expect(await countRows(app.pool, 'games', `schema_version = ${CURRENT + 1}`)).toBe(201);
      expect(await countRows(app.pool, 'games', 'state_version <> 7')).toBe(1);

      // Na rodada seguinte as ilegíveis falham de novo, e uma partida nova não fica para trás.
      const late = await insertGame(app, v1State('construction'), { timeScale: 3 });
      clock.advance(2 * HOUR);
      expect(await advanceStaleGames(app.ctx)).toMatchObject({ advanced: 2, failed: 201 });
      expect((await rowOf(app, late.id)).schemaVersion).toBe(CURRENT);
    } finally {
      await app.close();
    }
  });

  it('o job diz a causa da primeira falha, sem nada do que o jogador escreveu', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const state = futureState();
      state.settlement.name = 'Nome Que Não Vai Para o Log';
      await insertGame(app, state);
      await insertGame(app, v1State('fresh'));
      clock.advance(3 * HOUR);

      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 1 });
      expect(report.firstFailure).toEqual({
        name: 'StateMigrationError',
        message: expect.stringContaining(
          `está na versão ${CURRENT + 1} e este motor só conhece até a ${CURRENT}`,
        ) as string,
      });
      expect(JSON.stringify(report)).not.toContain('Nome Que');

      // O relatório da rodada inteira leva a causa adiante: é o que vai para o log.
      clock.advance(2 * HOUR);
      const round = await runJobsOnce(app.ctx);
      expect(round).toMatchObject({
        ran: true,
        failed: 1,
        firstFailure: { name: 'StateMigrationError' },
      });
      expect(JSON.stringify(round)).not.toContain('Nome Que');
    } finally {
      await app.close();
    }
  });

  it('versão 1 com um campo estranho: 500, e o original fica preservado', async () => {
    const state = v1State('construction');
    (state.settlement as Record<string, unknown>).morale = 50;
    const game = await insertGame(server, state);
    const before = await rowOf(server, game.id);

    const view = await call<ApiError>(server, 'GET', `/games/${game.id}/view`, {
      token: game.token,
    });
    expect(view.status).toBe(500);
    expect(view.body.code).toBe('INTERNAL');
    expect(await rowOf(server, game.id)).toEqual(before);
  });

  /** Uma partida já na versão atual, gravada pelo próprio servidor, e o estado dela. */
  async function currentGame(app: TestApp): Promise<{ game: OldGame; state: StoredState }> {
    const game = await insertGame(app, v1State('construction'));
    expect((await getView(app, game)).status).toBe(200);
    const row = await rowOf(app, game.id);
    expect(row.schemaVersion).toBe(CURRENT);
    return { game, state: row.state };
  }

  const overwrite = (app: TestApp, game: OldGame, state: unknown) =>
    app.pool.query('update games set state = $2::jsonb where id = $1', [
      game.id,
      JSON.stringify(state),
    ]);

  // O número da versão não é salvo-conduto (GDD §15.4): um estado que diz ser da versão atual
  // e não tem a forma dela é recusado como o de qualquer outra, e nunca regravado.
  it.each<[string, (state: StoredState) => void]>([
    [
      'sem um campo',
      (state) => {
        // Sem a recusa, a madeira virava `NaN` no primeiro avanço e `null` no banco.
        state.settlement.workers.lumberMill = 3;
        delete (state.settlement as Record<string, unknown>).accumulators;
      },
    ],
    [
      'com um estoque nulo',
      (state) => {
        (state.settlement.resources as Record<string, unknown>).wood = null;
      },
    ],
    [
      'com um campo de uma mecânica que não existe',
      (state) => {
        (state.settlement as Record<string, unknown>).mood = 50;
      },
    ],
    [
      'sem o ritmo',
      (state) => {
        delete state.settings.timeScale;
      },
    ],
  ])('versão atual %s: 500 em tudo, e a linha fica como estava', async (_, damage) => {
    const { game, state } = await currentGame(server);
    damage(state);
    await overwrite(server, game, state);
    const before = await rowOf(server, game.id);
    server.clock.advance(5 * HOUR);
    await renew(server, game);

    const view = await call<ApiError>(server, 'GET', `/games/${game.id}/view`, {
      token: game.token,
    });
    expect(view.status).toBe(500);
    expect(view.body.code).toBe('INTERNAL');
    const command = await send<ApiError>(
      server,
      game.token,
      game.id,
      order('setWorkers', { building: 'farm', count: 0 }),
    );
    expect(command.status).toBe(500);
    const events = await call<ApiError>(server, 'GET', `/games/${game.id}/events?after=0`, {
      token: game.token,
    });
    expect(events.status).toBe(500);

    expect(await rowOf(server, game.id)).toEqual(before);
    expect(await countRows(server.pool, 'commands', `game_id = '${game.id}'`)).toBe(0);
  });

  it('versão atual fora da forma: o job conta a falha e não grava por cima', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const { game, state } = await currentGame(app);
      delete (state.settlement as Record<string, unknown>).accumulators;
      await overwrite(app, game, state);
      const before = await rowOf(app, game.id);
      clock.advance(3 * HOUR);

      expect(await advanceStaleGames(app.ctx)).toMatchObject({ advanced: 0, failed: 1 });
      expect(await rowOf(app, game.id)).toEqual(before);
    } finally {
      await app.close();
    }
  });

  it('ritmo do estado diferente do da linha: 500, e a linha fica como estava', async () => {
    // O servidor converte o relógio pela coluna e o motor converte prazos reais pelo estado:
    // os dois têm de ser o mesmo número.
    const { game } = await currentGame(server);
    await server.pool.query(`update games set time_scale = '3' where id = $1`, [game.id]);
    const before = await rowOf(server, game.id);
    expect(before.state.settings.timeScale).toBe(1);

    const view = await call<ApiError>(server, 'GET', `/games/${game.id}/view`, {
      token: game.token,
    });
    expect(view.status).toBe(500);
    expect(view.body.code).toBe('INTERNAL');
    const command = await send<ApiError>(
      server,
      game.token,
      game.id,
      order('setWorkers', { building: 'farm', count: 0 }),
    );
    expect(command.status).toBe(500);
    expect(await rowOf(server, game.id)).toEqual(before);
  });

  it('o servidor não grava um estado que ele mesmo não leria de volta', async () => {
    // Um defeito de regra que produza `NaN` não pode chegar ao banco: lá ele viraria `null`, e
    // a partida ficaria ilegível com o último estado bom já apagado.
    const { game } = await currentGame(server);
    const before = await rowOf(server, game.id);

    const write = server.ctx.db.transaction(async (tx) => {
      const locked = await lockGame(tx, game.accountId, game.id);
      const broken = JSON.parse(JSON.stringify(locked.state)) as typeof locked.state;
      broken.settlement.resources.wood = Number.NaN;
      await persistState(tx, locked, broken, [], server.clock.now());
    });
    await expect(write).rejects.toThrow(/settlement\.resources\.wood/);
    expect(await rowOf(server, game.id)).toEqual(before);
  });

  it('a lista de partidas continua respondendo, com o nome do feudo', async () => {
    const game = await insertGame(server, futureState());
    const list = await call<ListGamesResponse>(server, 'GET', '/games', { token: game.token });
    expect(list.status).toBe(200);
    expect(list.body.games[0]).toMatchObject({ id: game.id, settlementName: 'Pedra Alta' });
  });
});
