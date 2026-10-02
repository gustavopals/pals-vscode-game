import { createHash, randomUUID } from 'node:crypto';

import type {
  ApiError,
  AuthResponse,
  ChronicleResponse,
  Command,
  CommandAccepted,
  CreateGameResponse,
  EventsResponse,
  GameEvent,
  GameRuleError,
  ListGamesResponse,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import {
  ChronicleResponseSchema,
  CommandAcceptedSchema,
  EventsResponseSchema,
  GameRuleErrorSchema,
  GameSummarySchema,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  DAY,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  type Player,
  renew,
  type Reply,
  send,
  signUp,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Testes derivados da documentação: MVP-ROADMAP F2-T6, GDD §14.5, §14.8 e §14.9, ADR 0004.

const SECOND = 1000;

// --- Apoio --------------------------------------------------------------------

/** JSON canônico escrito aqui, de propósito, sem reutilizar o do servidor (GDD §14.8). */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>;
    const entries = Object.keys(source)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(source[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

function expectedEtag(body: unknown): string {
  return `W/"${createHash('sha256').update(canonical(body)).digest('hex')}"`;
}

type GameSnapshot = {
  status: string;
  stateVersion: string;
  updatedAt: string;
  lastProcessedAt: string;
  createdAt: string;
  /** Muda a cada `UPDATE` da linha: serve de contador de escritas. */
  xmin: string;
  state: unknown;
};

/** Fotografia da linha da partida no banco. Qualquer `UPDATE` muda o `xmin`. */
async function snapshot(app: TestApp, gameId: string): Promise<GameSnapshot> {
  const { rows } = await app.pool.query<{
    status: string;
    state_version: string;
    updated_at: Date;
    last_processed_at: Date;
    created_at: Date;
    xmin: string;
    state: unknown;
  }>(
    `select status, state_version::text as state_version, updated_at, last_processed_at,
            created_at, xmin::text as xmin, state
       from games where id = $1`,
    [gameId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Partida ${gameId} não está no banco.`);
  }
  return {
    status: row.status,
    stateVersion: row.state_version,
    updatedAt: row.updated_at.toISOString(),
    lastProcessedAt: row.last_processed_at.toISOString(),
    createdAt: row.created_at.toISOString(),
    xmin: row.xmin,
    state: row.state,
  };
}

type ReceiptRow = {
  id: string;
  seq: number;
  type: string;
  payload: unknown;
  request_hash: string;
  server_time: Date;
  result: string;
  error_code: string | null;
  response_status: number;
  response_body: unknown;
};

/** Recibos da partida, na ordem em que foram gravados. */
async function receipts(app: TestApp, gameId: string): Promise<ReceiptRow[]> {
  const { rows } = await app.pool.query<ReceiptRow>(
    `select id, seq::int as seq, type, payload, request_hash, server_time, result, error_code,
            response_status::int as response_status, response_body
       from commands where game_id = $1 order by seq`,
    [gameId],
  );
  return rows;
}

type EventRow = { seq: number; kind: string; at: Date; payload: unknown };

async function eventRows(app: TestApp, gameId: string): Promise<EventRow[]> {
  const { rows } = await app.pool.query<EventRow>(
    'select seq::int as seq, kind, at, payload from game_events where game_id = $1 order by seq',
    [gameId],
  );
  return rows;
}

/** Tudo o que um reenvio não pode mexer: linha da partida, eventos e recibos. */
async function everything(app: TestApp, gameId: string) {
  return {
    game: await snapshot(app, gameId),
    events: await eventRows(app, gameId),
    receipts: await receipts(app, gameId),
  };
}

function getView(
  app: TestApp,
  token: string | undefined,
  gameId: string,
  headers: Record<string, string> = {},
): Promise<Reply<ViewResponse>> {
  return call<ViewResponse>(app, 'GET', `/games/${gameId}/view`, { token, headers });
}

function getEvents(
  app: TestApp,
  token: string,
  gameId: string,
  query = '',
): Promise<Reply<EventsResponse>> {
  return call<EventsResponse>(app, 'GET', `/games/${gameId}/events${query}`, { token });
}

function stock(view: ViewState, id: 'food' | 'wood' | 'stone' | 'gold'): number {
  const resource = view.resources.find((entry) => entry.id === id);
  if (resource === undefined) {
    throw new Error(`Recurso ${id} ausente da view.`);
  }
  return resource.stock;
}

function sequence(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

const REPLAYED = 'x-lords-replayed';
const STATE_VERSION = 'x-lords-state-version';

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

// --- Criação e listagem (F2-T6.1) ---------------------------------------------

describe('criação e listagem de partidas (F2-T6.1)', () => {
  it('cria a partida com stateVersion "1", dificuldade lord e o ritmo do servidor (1 nos testes)', async () => {
    const auth = await signUp(server);
    const reply = await call<CreateGameResponse>(server, 'POST', '/games', {
      token: auth.accessToken,
      body: { settlementName: 'Pedra Alta', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    });
    expect(reply.status).toBe(201);
    expect(GameSummarySchema.safeParse(reply.body.game).error).toBeUndefined();
    expect(reply.body.game).toMatchObject({
      status: 'active',
      settlementName: 'Pedra Alta',
      difficulty: 'lord',
      timeScale: 1,
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      stateVersion: '1',
    });

    const { rows } = await server.pool.query<{
      state_version: string;
      difficulty: string;
      time_scale: string;
      seed: string;
      vigil_hour: number;
      timezone: string;
    }>(
      'select state_version::text as state_version, difficulty, time_scale, seed, vigil_hour, timezone from games where id = $1',
      [reply.body.game.id],
    );
    expect(rows[0]).toMatchObject({
      state_version: '1',
      difficulty: 'lord',
      vigil_hour: 20,
      timezone: 'America/Sao_Paulo',
    });
    expect(Number(rows[0]?.time_scale)).toBe(1);
    // Sem semente informada, o servidor sorteia uma.
    expect(rows[0]?.seed.length).toBeGreaterThan(0);
  });

  it('sem escolha no corpo, a visão mostra os padrões: Senhor e o ritmo do servidor', async () => {
    const player = await newPlayer(server);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.body.view.settlement).toEqual({
      name: 'Pedra Alta',
      townHallLevel: 1,
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Normal: um ano em 7 dias',
    });
    const { rows } = await server.pool.query<{ settings: Record<string, unknown> }>(
      "select state -> 'settings' as settings from games where id = $1",
      [player.game.id],
    );
    expect(rows[0]?.settings).toMatchObject({ difficulty: 'lord', timeScale: 1 });
  });

  // Dificuldade e ritmo escolhidos na criação (V2B-T3; ADR 0013, decisões 2, 2a e 19a).
  const DIFFICULTIES = [
    ['peasant', 'Camponês'],
    ['lord', 'Senhor'],
    ['ironKing', 'Rei de Ferro'],
  ] as const;
  const PACES = [
    [3, 'Rápido: um ano em 56 horas'],
    [1, 'Normal: um ano em 7 dias'],
    [0.5, 'Tranquilo: um ano em 14 dias'],
  ] as const;
  const COMBINATIONS = DIFFICULTIES.flatMap(([difficulty, difficultyLabel]) =>
    PACES.map(([timeScale, paceLabel]) => ({ difficulty, difficultyLabel, timeScale, paceLabel })),
  );

  it.each(COMBINATIONS)(
    'cria com $difficulty no ritmo $timeScale: resposta, linha, estado e visão dizem o mesmo',
    async ({ difficulty, difficultyLabel, timeScale, paceLabel }) => {
      const auth = await signUp(server);
      const reply = await call<CreateGameResponse>(server, 'POST', '/games', {
        token: auth.accessToken,
        body: {
          settlementName: 'Vale Fundo',
          timezone: 'UTC',
          vigilHourLocal: 0,
          difficulty,
          timeScale,
        },
      });
      expect(reply.status).toBe(201);
      expect(GameSummarySchema.safeParse(reply.body.game).error).toBeUndefined();
      expect(reply.body.game).toMatchObject({ difficulty, timeScale, vigilHourLocal: 0 });

      // A coluna e o estado guardam a mesma escolha.
      const { rows } = await server.pool.query<{
        difficulty: string;
        time_scale: string;
        settings: Record<string, unknown>;
      }>(
        "select difficulty, time_scale, state -> 'settings' as settings from games where id = $1",
        [reply.body.game.id],
      );
      expect(rows[0]?.difficulty).toBe(difficulty);
      expect(Number(rows[0]?.time_scale)).toBe(timeScale);
      expect(rows[0]?.settings).toEqual({
        settlementName: 'Vale Fundo',
        timezone: 'UTC',
        vigilHourLocal: 0,
        difficulty,
        timeScale,
      });

      const listed = await call<ListGamesResponse>(server, 'GET', '/games', {
        token: auth.accessToken,
      });
      expect(listed.body.games).toEqual([reply.body.game]);

      // A visão mostra a escolha e já fala no tempo real desse ritmo: o dia de jogo tem 2 h.
      const view = await getView(server, auth.accessToken, reply.body.game.id);
      expect(ViewResponseSchema.safeParse(view.body).error).toBeUndefined();
      expect(view.body.view.settlement).toEqual({
        name: 'Vale Fundo',
        townHallLevel: 1,
        difficulty,
        difficultyLabel,
        paceLabel,
      });
      expect(view.body.view.calendar.secondsToNextDay).toBe(7200 / timeScale);
      // Toda partida nasce na primavera, e nela o recrutamento leva 20 min × 0,8.
      expect(view.body.view.recruitment.secondsPerVillager).toBe(960 / timeScale);
      // Nesta versão a dificuldade ainda não muda o feudo inicial.
      expect(view.body.view.population).toMatchObject({ villagers: 5, free: 5 });
      expect(stock(view.body.view, 'food')).toBe(180);
    },
  );

  it('duas partidas com ritmos diferentes mostram prazos diferentes para a mesma obra', async () => {
    const create = async (timeScale: number) => {
      const auth = await signUp(server);
      const game = await startGame(server, auth.accessToken, { timeScale });
      const started = await send<CommandAccepted>(
        server,
        auth.accessToken,
        game.id,
        order('startConstruction', { building: 'housing' }),
      );
      expect(started.status).toBe(200);
      return started.body.view.constructions.active?.secondsRemaining;
    };
    // A melhoria das Habitações leva 4 min de jogo.
    expect(await create(3)).toBe(80);
    expect(await create(1)).toBe(240);
    expect(await create(0.5)).toBe(480);
  });

  it('só a dificuldade no corpo: o ritmo é o do servidor; só o ritmo: a dificuldade é Senhor', async () => {
    const hard = await signUp(server);
    const onlyDifficulty = await startGame(server, hard.accessToken, { difficulty: 'ironKing' });
    expect(onlyDifficulty).toMatchObject({ difficulty: 'ironKing', timeScale: 1 });

    const calm = await signUp(server);
    const onlyPace = await startGame(server, calm.accessToken, { timeScale: 0.5 });
    expect(onlyPace).toMatchObject({ difficulty: 'lord', timeScale: 0.5 });
  });

  it.each([
    ['difficulty', 'normal'],
    ['difficulty', 'LORD'],
    ['difficulty', ''],
    ['difficulty', null],
    ['difficulty', 2],
    // O 2× saiu da lista; 7 é um GAME_TIME_SCALE aceito pelo servidor, mas não é oferecido.
    ['timeScale', 2],
    ['timeScale', 7],
    ['timeScale', 0],
    ['timeScale', -1],
    ['timeScale', '3'],
    ['timeScale', null],
  ])('%s: %j no corpo é 400 VALIDATION e não cria partida', async (field, value) => {
    const auth = await signUp(server);
    const reply = await call<ApiError>(server, 'POST', '/games', {
      token: auth.accessToken,
      body: { settlementName: 'Vale Fundo', timezone: 'UTC', vigilHourLocal: 20, [field]: value },
    });
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe('VALIDATION');
    expect((reply.body.details as { issues: Array<{ path: string }> }).issues[0]?.path).toBe(field);
    const listed = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: auth.accessToken,
    });
    expect(listed.body.games).toEqual([]);
  });

  it('uma escolha inválida junto com replaceActive não arquiva a partida que existe', async () => {
    const player = await newPlayer(server);
    const reply = await call<ApiError>(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Pedra Nova',
        timezone: 'UTC',
        vigilHourLocal: 20,
        replaceActive: true,
        timeScale: 2,
      },
    });
    expect(reply.status).toBe(400);
    const listed = await call<ListGamesResponse>(server, 'GET', '/games', { token: player.token });
    expect(listed.body.games).toEqual([player.game]);
  });

  it('a partida antiga fica como nasceu quando o dono começa outra com outras escolhas', async () => {
    const player = await newPlayer(server);
    const before = await server.pool.query<{
      difficulty: string;
      time_scale: string;
      state: unknown;
    }>('select difficulty, time_scale, state from games where id = $1', [player.game.id]);
    const replaced = await call<CreateGameResponse>(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Pedra Nova',
        timezone: 'UTC',
        vigilHourLocal: 20,
        replaceActive: true,
        difficulty: 'peasant',
        timeScale: 3,
      },
    });
    expect(replaced.status).toBe(201);
    expect(replaced.body.game).toMatchObject({ difficulty: 'peasant', timeScale: 3 });

    const after = await server.pool.query<{
      difficulty: string;
      time_scale: string;
      state: unknown;
    }>('select difficulty, time_scale, state from games where id = $1', [player.game.id]);
    expect(after.rows).toEqual(before.rows);
    const listed = await call<ListGamesResponse>(server, 'GET', '/games', { token: player.token });
    expect(
      listed.body.games
        .map((game) => [game.settlementName, game.status, game.difficulty, game.timeScale])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    ).toEqual([
      ['Pedra Alta', 'archived', 'lord', 1],
      ['Pedra Nova', 'active', 'peasant', 3],
    ]);
  });

  it('a partida nova começa com 5 aldeões livres e o estoque inicial', async () => {
    const player = await newPlayer(server);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(reply.body.stateVersion).toBe('1');
    expect(reply.body.view.population).toMatchObject({ villagers: 5, free: 5 });
    expect(stock(reply.body.view, 'food')).toBe(180);
    expect(stock(reply.body.view, 'wood')).toBe(120);
    expect(stock(reply.body.view, 'stone')).toBe(65);
    expect(stock(reply.body.view, 'gold')).toBe(250);
  });

  it('population.housed e vacancies: quem está a caminho já ocupa um lugar nas habitações', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    const first = await getView(server, player.token, game.id);
    expect(first.body.view.population).toMatchObject({
      villagers: 5,
      capacity: 10,
      inTraining: 0,
      housed: 5,
      vacancies: 5,
    });

    // Três aldeões chamados: ninguém chegou ainda, mas os lugares deles já estão ocupados.
    const recruited = await send<CommandAccepted>(
      server,
      player.token,
      game.id,
      order('recruitVillagers', { quantity: 3 }),
    );
    expect(recruited.status).toBe(200);
    expect(CommandAcceptedSchema.safeParse(recruited.body).error).toBeUndefined();
    expect(recruited.body.view.population).toMatchObject({
      villagers: 5,
      capacity: 10,
      inTraining: 3,
      housed: 8,
      vacancies: 2,
    });
    // Só cabem mais dois: pedir três é recusado, e a visão da recusa traz os mesmos números.
    const refused = await send<GameRuleError>(
      server,
      player.token,
      game.id,
      order('recruitVillagers', { quantity: 3 }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.view.population).toMatchObject({ housed: 8, vacancies: 2 });
    expect(refused.body.details.view.recruitment.maxQuantity).toBeLessThanOrEqual(2);

    // Cada chegada troca um "a caminho" por um morador: ocupados e vagas não mudam.
    const expected = [
      { villagers: 6, inTraining: 2 },
      { villagers: 7, inTraining: 1 },
      { villagers: 8, inTraining: 0 },
    ];
    for (const step of expected) {
      server.clock.advance(20 * MINUTE);
      await renew(server, player);
      const view = await getView(server, player.token, game.id);
      expect(view.body.view.population).toMatchObject({
        ...step,
        capacity: 10,
        housed: 8,
        vacancies: 2,
      });
    }

    // Habitações no 2º nível: cinco lugares a mais, todos vagos.
    await send(server, player.token, game.id, order('startConstruction', { building: 'housing' }));
    server.clock.advance(4 * MINUTE);
    const grown = await getView(server, player.token, game.id);
    expect(ViewResponseSchema.safeParse(grown.body).error).toBeUndefined();
    const { population } = grown.body.view;
    expect(population).toMatchObject({ villagers: 8, capacity: 15, housed: 8, vacancies: 7 });
    expect(population.housed + population.vacancies).toBe(population.capacity);
    expect(population.housed).toBe(population.villagers + population.inTraining);
  });

  it('segunda criação sem replaceActive responde 409 ACTIVE_GAME_EXISTS e não cria nada', async () => {
    const player = await newPlayer(server);
    const reply = await call<ApiError>(server, 'POST', '/games', {
      token: player.token,
      body: { settlementName: 'Outra Vila', timezone: 'UTC', vigilHourLocal: 8 },
    });
    expect(reply.status).toBe(409);
    expect(reply.body.code).toBe('ACTIVE_GAME_EXISTS');
    expect(await countRows(server.pool, 'games', `account_id = '${player.accountId}'`)).toBe(1);
    expect((await snapshot(server, player.game.id)).status).toBe('active');

    // replaceActive: false é o mesmo que não mandar.
    const explicit = await call<ApiError>(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Outra Vila',
        timezone: 'UTC',
        vigilHourLocal: 8,
        replaceActive: false,
      },
    });
    expect(explicit.status).toBe(409);
    expect(explicit.body.code).toBe('ACTIVE_GAME_EXISTS');
  });

  it('com replaceActive arquiva a anterior e GET /games lista as duas', async () => {
    const player = await newPlayer(server);
    const created = await call<CreateGameResponse>(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Nova Pedra',
        timezone: 'Europe/Lisbon',
        vigilHourLocal: 23,
        replaceActive: true,
      },
    });
    expect(created.status).toBe(201);
    expect(created.body.game).toMatchObject({
      status: 'active',
      settlementName: 'Nova Pedra',
      stateVersion: '1',
    });
    expect(created.body.game.id).not.toBe(player.game.id);
    expect((await snapshot(server, player.game.id)).status).toBe('archived');

    const list = await call<ListGamesResponse>(server, 'GET', '/games', { token: player.token });
    expect(list.status).toBe(200);
    expect(list.body.games).toHaveLength(2);
    for (const game of list.body.games) {
      expect(GameSummarySchema.safeParse(game).error).toBeUndefined();
    }
    const byId = new Map(list.body.games.map((game) => [game.id, game]));
    expect(byId.get(player.game.id)?.status).toBe('archived');
    expect(byId.get(created.body.game.id)?.status).toBe('active');
    expect(list.body.games.filter((game) => game.status === 'active')).toHaveLength(1);
  });

  it('GET /games exige sessão e só lista as partidas da própria conta', async () => {
    const anonymous = await call<ApiError>(server, 'GET', '/games');
    expect(anonymous.status).toBe(401);

    const empty = await signUp(server, 'Sem Feudo');
    const none = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: empty.accessToken,
    });
    expect(none.status).toBe(200);
    expect(none.body.games).toEqual([]);

    const player = await newPlayer(server);
    const mine = await call<ListGamesResponse>(server, 'GET', '/games', { token: player.token });
    expect(mine.body.games.map((game) => game.id)).toEqual([player.game.id]);
  });

  it('POST /games exige sessão', async () => {
    const reply = await call<ApiError>(server, 'POST', '/games', {
      body: { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 },
    });
    expect(reply.status).toBe(401);
  });

  const valid = { settlementName: 'Pedra Alta', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 };
  it.each([
    ['nome com 1 caractere', { ...valid, settlementName: 'A' }],
    ['nome com 25 caracteres', { ...valid, settlementName: 'A'.repeat(25) }],
    ['nome ausente', { timezone: valid.timezone, vigilHourLocal: 20 }],
    ['fuso que não é IANA', { ...valid, timezone: 'Marte/Olimpo' }],
    ['fuso vazio', { ...valid, timezone: '' }],
    ['fuso ausente', { settlementName: 'Pedra Alta', vigilHourLocal: 20 }],
    ['Hora da Vigília 24', { ...valid, vigilHourLocal: 24 }],
    ['Hora da Vigília -1', { ...valid, vigilHourLocal: -1 }],
    ['Hora da Vigília fracionária', { ...valid, vigilHourLocal: 7.5 }],
    ['Hora da Vigília como texto', { ...valid, vigilHourLocal: '20' }],
    ['Hora da Vigília ausente', { settlementName: 'Pedra Alta', timezone: valid.timezone }],
  ])('validação: %s → 400 VALIDATION', async (_label, body) => {
    const auth = await signUp(server);
    const reply = await call<ApiError>(server, 'POST', '/games', {
      token: auth.accessToken,
      body,
    });
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe('VALIDATION');
    expect(typeof reply.body.message).toBe('string');
    expect(await countRows(server.pool, 'games', `account_id = '${auth.account.id}'`)).toBe(0);
  });

  it('aceita os limites da Hora da Vigília (0 e 23) e do nome (2 e 24 caracteres)', async () => {
    for (const [name, hour] of [
      ['AB', 0],
      ['A'.repeat(24), 23],
    ] as const) {
      const auth = await signUp(server);
      const game = await startGame(server, auth.accessToken, {
        settlementName: name,
        vigilHourLocal: hour,
      });
      expect(game).toMatchObject({ settlementName: name, vigilHourLocal: hour });
    }
  });
});

// --- Propriedade ----------------------------------------------------------------

describe('propriedade da partida', () => {
  it('outra conta recebe 404 em view, commands, events e chronicle', async () => {
    const owner = await newPlayer(server, 'Dona');
    const intruder = await newPlayer(server, 'Intruso');
    const before = await everything(server, owner.game.id);
    const base = `/games/${owner.game.id}`;

    for (const path of ['/view', '/events', '/chronicle', '/chronicle.md']) {
      const reply = await call<ApiError>(server, 'GET', `${base}${path}`, {
        token: intruder.token,
      });
      expect(reply.status, path).toBe(404);
      expect(reply.body.code, path).toBe('NOT_FOUND');
    }
    const command = await send<ApiError>(
      server,
      intruder.token,
      owner.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(command.status).toBe(404);
    expect(command.body.code).toBe('NOT_FOUND');
    expect(await everything(server, owner.game.id)).toEqual(before);
  });

  it('reenvio de um commandId existente por outra conta é 404, sem recibo nem cabeçalho de reenvio', async () => {
    const owner = await newPlayer(server, 'Dona');
    const intruder = await newPlayer(server, 'Intruso');
    const accepted = order('setWorkers', { building: 'farm', count: 2 });
    const refused = order('startConstruction', { building: 'townHall' });
    expect((await send(server, owner.token, owner.game.id, accepted)).status).toBe(200);
    expect((await send(server, owner.token, owner.game.id, refused)).status).toBe(422);
    const before = await everything(server, owner.game.id);

    for (const command of [accepted, refused]) {
      const reply = await send<ApiError>(server, intruder.token, owner.game.id, command);
      expect(reply.status).toBe(404);
      expect(reply.body.code).toBe('NOT_FOUND');
      expect(reply.headers[REPLAYED]).toBeUndefined();
      expect(reply.body).not.toHaveProperty('view');
      expect(reply.body.details).toBeUndefined();
    }
    // Mesmo UUID com outro payload: continua 404, e não 409 (o recibo alheio não é consultado).
    const conflicting = await send<ApiError>(server, intruder.token, owner.game.id, {
      ...order('setWorkers', { building: 'farm', count: 1 }),
      commandId: accepted.commandId,
    });
    expect(conflicting.status).toBe(404);
    expect(await everything(server, owner.game.id)).toEqual(before);
    // A partida do intruso não ganhou nada com isso.
    expect(await receipts(server, intruder.game.id)).toEqual([]);
  });

  it('id que não é UUID responde 404 em todas as rotas da partida', async () => {
    const player = await newPlayer(server);
    for (const id of ['nao-e-uuid', '123', `${player.game.id}x`]) {
      for (const path of ['/view', '/events', '/chronicle', '/chronicle.md']) {
        const reply = await call<ApiError>(server, 'GET', `/games/${id}${path}`, {
          token: player.token,
        });
        expect(reply.status, `${id}${path}`).toBe(404);
        expect(reply.body.code).toBe('NOT_FOUND');
      }
      const command = await send<ApiError>(
        server,
        player.token,
        id,
        order('setWorkers', { building: 'farm', count: 2 }),
      );
      expect(command.status).toBe(404);
    }
  });

  it('UUID de partida inexistente responde 404', async () => {
    const player = await newPlayer(server);
    const ghost = randomUUID();
    expect((await getView(server, player.token, ghost)).status).toBe(404);
    expect((await getEvents(server, player.token, ghost)).status).toBe(404);
    const command = await send(
      server,
      player.token,
      ghost,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(command.status).toBe(404);
  });

  it('sem token, todas as rotas da partida respondem 401', async () => {
    const player = await newPlayer(server);
    const base = `/games/${player.game.id}`;
    for (const path of ['/view', '/events', '/chronicle', '/chronicle.md']) {
      expect((await call(server, 'GET', `${base}${path}`)).status, path).toBe(401);
    }
    const command = await call(server, 'POST', `${base}/commands`, {
      body: order('setWorkers', { building: 'farm', count: 2 }),
    });
    expect(command.status).toBe(401);
    expect(await receipts(server, player.game.id)).toEqual([]);
  });
});

// --- Persistência (F2-T6.3) -----------------------------------------------------

describe('regra de persistência (F2-T6.3)', () => {
  it('GET /view sem evento novo não escreve nada', async () => {
    const player = await newPlayer(server);
    const before = await snapshot(server, player.game.id);
    expect(before.stateVersion).toBe('1');

    server.clock.advance(10 * MINUTE);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(reply.body.stateVersion).toBe('1');

    expect(await snapshot(server, player.game.id)).toEqual(before);
    expect(await eventRows(server, player.game.id)).toEqual([]);
  });

  it('GET /view com virada de dia escreve uma vez e incrementa state_version em 1', async () => {
    const player = await newPlayer(server);
    const before = await snapshot(server, player.game.id);

    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(reply.body.stateVersion).toBe('2');
    expect(reply.body.view.calendar.dayOfSeason).toBe(2);

    const after = await snapshot(server, player.game.id);
    expect(after.stateVersion).toBe('2');
    expect(after.xmin).not.toBe(before.xmin);
    // last_processed_at recebe o relógio de parede do avanço.
    expect(after.lastProcessedAt).toBe(server.clock.now().toISOString());
    const events = await eventRows(server, player.game.id);
    expect(events.map((event) => [event.seq, event.kind])).toEqual([[1, 'dayStarted']]);

    // Ler de novo, sem evento novo, não escreve outra vez.
    const again = await getView(server, player.token, player.game.id);
    expect(again.body.stateVersion).toBe('2');
    server.clock.advance(5 * MINUTE);
    const later = await getView(server, player.token, player.game.id);
    expect(later.body.stateVersion).toBe('2');
    expect(await snapshot(server, player.game.id)).toEqual(after);
    expect(await eventRows(server, player.game.id)).toHaveLength(1);
  });

  it('uma leitura que atravessa várias viradas de dia incrementa a versão uma única vez', async () => {
    const player = await newPlayer(server);
    server.clock.advance(6 * HOUR + MINUTE);
    await renew(server, player);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.body.stateVersion).toBe('2');
    expect((await snapshot(server, player.game.id)).stateVersion).toBe('2');
    const events = await eventRows(server, player.game.id);
    expect(events.map((event) => [event.seq, event.kind])).toEqual([
      [1, 'dayStarted'],
      [2, 'dayStarted'],
      [3, 'dayStarted'],
    ]);
  });

  it('GET /events também avança a partida e persiste os eventos do avanço', async () => {
    const player = await newPlayer(server);
    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const reply = await getEvents(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(reply.body.events.map((event) => [event.seq, event.type])).toEqual([[1, 'dayStarted']]);
    expect((await snapshot(server, player.game.id)).stateVersion).toBe('2');
  });

  it('cada comando novo, aceito ou recusado, incrementa state_version exatamente uma vez; reenvio não', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const accepted = order('setWorkers', { building: 'farm', count: 2 });
    const refused = order('startConstruction', { building: 'townHall' });

    const first = await send<CommandAccepted>(server, token, game.id, accepted);
    expect(first.status).toBe(200);
    expect(first.body.stateVersion).toBe('2');
    expect((await snapshot(server, game.id)).stateVersion).toBe('2');

    const second = await send<GameRuleError>(server, token, game.id, refused);
    expect(second.status).toBe(422);
    expect(second.body.details.stateVersion).toBe('3');
    expect((await snapshot(server, game.id)).stateVersion).toBe('3');
    const afterBoth = await everything(server, game.id);

    // Reenvios: nenhuma escrita.
    expect((await send(server, token, game.id, accepted)).status).toBe(200);
    expect((await send(server, token, game.id, refused)).status).toBe(422);
    expect(await everything(server, game.id)).toEqual(afterBoth);

    // Conflito de UUID: nenhuma escrita.
    const conflict = await send<ApiError>(server, token, game.id, {
      ...order('setWorkers', { building: 'farm', count: 1 }),
      commandId: accepted.commandId,
    });
    expect(conflict.status).toBe(409);
    expect(await everything(server, game.id)).toEqual(afterBoth);

    const third = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('setWorkers', { building: 'lumberMill', count: 1 }),
    );
    expect(third.body.stateVersion).toBe('4');
    const final = await snapshot(server, game.id);
    expect(final.stateVersion).toBe('4');
    expect(final.lastProcessedAt).toBe(server.clock.now().toISOString());
    expect((await receipts(server, game.id)).map((row) => row.seq)).toEqual([1, 2, 3]);
  });

  it('GET /view repetido ao longo de 10 s sem eventos não gera UPDATE, mesmo devolvendo 200', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const allocated = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(allocated.status).toBe(200);

    const before = await everything(server, game.id);
    let previous = await getView(server, token, game.id);
    const etags = new Set([String(previous.headers.etag)]);
    for (let second = 1; second <= 10; second += 1) {
      server.clock.advance(SECOND);
      const reply = await getView(server, token, game.id, {
        'if-none-match': String(previous.headers.etag),
      });
      // A representação mudou (contagens regressivas): 200, e não 304.
      expect(reply.status, `segundo ${second}`).toBe(200);
      expect(reply.body.stateVersion).toBe(allocated.body.stateVersion);
      expect(reply.body.view.calendar.secondsToNextDay).toBe(
        previous.body.view.calendar.secondsToNextDay - 1,
      );
      etags.add(String(reply.headers.etag));
      previous = reply;
      // Contador de escritas: o xmin da linha só muda com UPDATE.
      expect(await snapshot(server, game.id), `segundo ${second}`).toEqual(before.game);
    }
    expect(etags.size).toBe(11);
    expect(await everything(server, game.id)).toEqual(before);
  });
});

// --- ETag (F2-T6.4 e F2-T6.10) --------------------------------------------------

describe('GET /view e ETag (F2-T6.4, F2-T6.10)', () => {
  it('responde { view, stateVersion } com ETag fraco W/"<sha256>" do JSON canônico do corpo', async () => {
    const player = await newPlayer(server);
    const reply = await getView(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(Object.keys(reply.body).sort()).toEqual(['stateVersion', 'view']);
    expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.stateVersion).toBe('1');
    expect(String(reply.headers.etag)).toMatch(/^W\/"[0-9a-f]{64}"$/);
    expect(reply.headers.etag).toBe(expectedEtag(reply.body));
    expect(reply.headers['cache-control']).toBe('private, no-cache');
    expect(String(reply.headers.vary).toLowerCase().split(/,\s*/)).toContain('authorization');
    // O ETag não é a stateVersion.
    expect(String(reply.headers.etag)).not.toContain('"1"');
  });

  it('relógio congelado: corpo e ETag idênticos, e If-None-Match igual devolve 304 sem corpo', async () => {
    const player = await newPlayer(server);
    const first = await getView(server, player.token, player.game.id);
    const second = await getView(server, player.token, player.game.id);
    // Nada de requestId ou horário da requisição no corpo.
    expect(second.body).toEqual(first.body);
    expect(second.headers.etag).toBe(first.headers.etag);

    const cached = await call<string>(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
      headers: { 'if-none-match': String(first.headers.etag) },
    });
    expect(cached.status).toBe(304);
    expect(cached.body).toBe('');
    expect(cached.headers.etag).toBe(first.headers.etag);
    expect(cached.headers['cache-control']).toBe('private, no-cache');
    expect(String(cached.headers.vary).toLowerCase().split(/,\s*/)).toContain('authorization');
  });

  it('If-None-Match diferente devolve 200 com o corpo', async () => {
    const player = await newPlayer(server);
    const reply = await getView(server, player.token, player.game.id, {
      'if-none-match': `W/"${'0'.repeat(64)}"`,
    });
    expect(reply.status).toBe(200);
    expect(reply.body.stateVersion).toBe('1');
    expect(reply.headers.etag).toBe(expectedEtag(reply.body));
  });

  it('10 s de produção na Fazenda mudam o ETag: 200 com a mesma stateVersion e sem escrita', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    await send(server, token, game.id, order('setWorkers', { building: 'farm', count: 5 }));
    const first = await getView(server, token, game.id);
    const before = await everything(server, game.id);

    server.clock.advance(10 * SECOND);
    const second = await getView(server, token, game.id, {
      'if-none-match': String(first.headers.etag),
    });
    expect(second.status).toBe(200);
    expect(second.headers.etag).not.toBe(first.headers.etag);
    expect(second.headers.etag).toBe(expectedEtag(second.body));
    expect(second.body.stateVersion).toBe(first.body.stateVersion);
    expect(second.body.view).not.toEqual(first.body.view);
    expect(second.body.view.calendar.secondsToNextDay).toBe(
      first.body.view.calendar.secondsToNextDay - 10,
    );
    expect(second.headers['cache-control']).toBe('private, no-cache');
    expect(await everything(server, game.id)).toEqual(before);

    // Com o relógio parado de novo, o ETag novo volta a valer 304.
    const third = await getView(server, token, game.id, {
      'if-none-match': String(second.headers.etag),
    });
    expect(third.status).toBe(304);
  });

  it('tempo restante de obra muda o ETag sem mudar a stateVersion', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const started = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('startConstruction', { building: 'housing' }),
    );
    expect(started.status).toBe(200);
    const first = await getView(server, token, game.id);
    expect(first.body.view.constructions.active).toMatchObject({
      building: 'housing',
      secondsRemaining: 240,
      totalSeconds: 240,
    });
    const before = await snapshot(server, game.id);

    server.clock.advance(SECOND);
    const second = await getView(server, token, game.id, {
      'if-none-match': String(first.headers.etag),
    });
    expect(second.status).toBe(200);
    expect(second.body.view.constructions.active?.secondsRemaining).toBe(239);
    expect(second.headers.etag).not.toBe(first.headers.etag);
    expect(second.body.stateVersion).toBe(first.body.stateVersion);
    expect(await snapshot(server, game.id)).toEqual(before);
  });

  it('mudança de versão muda a representação, mesmo com a view igual', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const first = await getView(server, token, game.id);

    // Recusa com o relógio congelado: a view não muda, mas o estado foi escrito.
    const refused = await send<GameRuleError>(
      server,
      token,
      game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(refused.status).toBe(422);

    const second = await getView(server, token, game.id, {
      'if-none-match': String(first.headers.etag),
    });
    expect(second.status).toBe(200);
    expect(second.body.view).toEqual(first.body.view);
    expect(second.body.stateVersion).toBe('2');
    expect(second.headers.etag).not.toBe(first.headers.etag);
    expect(second.headers.etag).toBe(expectedEtag(second.body));
  });

  it('autenticação é exigida mesmo quando o ETag coincide', async () => {
    const owner = await newPlayer(server, 'Dona');
    const intruder = await newPlayer(server, 'Intruso');
    const first = await getView(server, owner.token, owner.game.id);
    const headers = { 'if-none-match': String(first.headers.etag) };

    const anonymous = await getView(server, undefined, owner.game.id, headers);
    expect(anonymous.status).toBe(401);
    const forged = await getView(server, 'token-invalido', owner.game.id, headers);
    expect(forged.status).toBe(401);
    const curinga = await getView(server, undefined, owner.game.id, { 'if-none-match': '*' });
    expect(curinga.status).toBe(401);
    // Outra conta, com o ETag certo: 404, e não 304.
    const other = await getView(server, intruder.token, owner.game.id, headers);
    expect(other.status).toBe(404);

    // Token expirado (15 minutos) com ETag que coincide: 401.
    const stale = await getView(server, owner.token, owner.game.id);
    server.clock.advance(16 * MINUTE);
    const expired = await getView(server, owner.token, owner.game.id, {
      'if-none-match': String(stale.headers.etag),
    });
    expect(expired.status).toBe(401);
  });

  it('avança antes de comparar o If-None-Match: virada de dia invalida o ETag antigo', async () => {
    const player = await newPlayer(server);
    const first = await getView(server, player.token, player.game.id);
    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const second = await getView(server, player.token, player.game.id, {
      'if-none-match': String(first.headers.etag),
    });
    expect(second.status).toBe(200);
    expect(second.body.stateVersion).toBe('2');
    expect(second.body.view.calendar.dayOfSeason).toBe(2);
  });
});

// --- Comandos e recibos (F2-T6.5, F2-T6.8) --------------------------------------

describe('comandos e recibos idempotentes (F2-T6.5, F2-T6.8)', () => {
  /** Reenvia e confere: status e corpo originais, cabeçalho de reenvio, nenhuma escrita. */
  async function expectReplay(
    app: TestApp,
    player: Player,
    command: Command,
    original: Reply,
    headers: Record<string, string> = {},
  ): Promise<void> {
    const before = await everything(app, player.game.id);
    const replay = await send(app, player.token, player.game.id, command, headers);
    expect(replay.status).toBe(original.status);
    expect(replay.body).toEqual(original.body);
    expect(replay.headers[REPLAYED]).toBe('true');
    expect(replay.headers['cache-control']).toBe('no-store');
    expect(await everything(app, player.game.id)).toEqual(before);
  }

  it('sucesso: 200 { view, events, stateVersion, staleView } com Cache-Control: no-store', async () => {
    const player = await newPlayer(server);
    const command = order('setWorkers', { building: 'farm', count: 2 });
    const reply = await send<CommandAccepted>(server, player.token, player.game.id, command);
    expect(reply.status).toBe(200);
    expect(Object.keys(reply.body).sort()).toEqual(['events', 'staleView', 'stateVersion', 'view']);
    expect(CommandAcceptedSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.stateVersion).toBe('2');
    expect(reply.body.staleView).toBe(false);
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.headers[REPLAYED]).toBeUndefined();
    expect(reply.body.view.population.free).toBe(3);

    const rows = await receipts(server, player.game.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: command.commandId,
      seq: 1,
      type: 'setWorkers',
      payload: { building: 'farm', count: 2 },
      result: 'accepted',
      error_code: null,
      response_status: 200,
    });
    expect(rows[0]?.response_body).toEqual(reply.body);
    // request_hash = SHA-256 do JSON canônico de { type, payload }.
    expect(rows[0]?.request_hash).toBe(
      createHash('sha256')
        .update(canonical({ type: command.type, payload: command.payload }))
        .digest('hex'),
    );
    expect(rows[0]?.server_time.toISOString()).toBe(server.clock.now().toISOString());

    // A view do recibo é a que o jogador vê em seguida.
    const view = await getView(server, player.token, player.game.id);
    expect(view.body).toEqual({ view: reply.body.view, stateVersion: reply.body.stateVersion });
  });

  it('recusa: 422 GAME_RULE com details { code, message, view, events, stateVersion, staleView }', async () => {
    const player = await newPlayer(server);
    const before = await getView(server, player.token, player.game.id);
    const command = order('startConstruction', { building: 'townHall' });
    const reply = await send<GameRuleError>(server, player.token, player.game.id, command);
    expect(reply.status).toBe(422);
    expect(GameRuleErrorSchema.safeParse(reply.body).error).toBeUndefined();
    expect(Object.keys(reply.body).sort()).toEqual(['code', 'details', 'message']);
    expect(Object.keys(reply.body.details).sort()).toEqual([
      'code',
      'events',
      'message',
      'staleView',
      'stateVersion',
      'view',
    ]);
    expect(reply.body.code).toBe('GAME_RULE');
    expect(reply.body.details.code).toBe('INSUFFICIENT_RESOURCES');
    expect(reply.body.details.message).toBe(reply.body.message);
    expect(reply.body.message.length).toBeGreaterThan(0);
    expect(reply.body.details.stateVersion).toBe('2');
    expect(reply.body.details.staleView).toBe(false);
    expect(reply.body.details.events).toEqual([]);
    // A ação recusada não tem efeito nenhum.
    expect(reply.body.details.view).toEqual(before.body.view);
    expect(reply.headers['cache-control']).toBe('no-store');
    expect(reply.headers[REPLAYED]).toBeUndefined();

    const rows = await receipts(server, player.game.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      id: command.commandId,
      seq: 1,
      result: 'rejected',
      error_code: 'INSUFFICIENT_RESOURCES',
      response_status: 422,
    });
    expect(rows[0]?.response_body).toEqual(reply.body);
  });

  it('reenvio do mesmo commandId e payload devolve status e corpo originais com X-Lords-Replayed', async () => {
    const player = await newPlayer(server);
    const accepted = order('setWorkers', { building: 'farm', count: 2 });
    const refused = order('startConstruction', { building: 'townHall' });
    const ok = await send(server, player.token, player.game.id, accepted);
    const no = await send(server, player.token, player.game.id, refused);
    expect([ok.status, no.status]).toEqual([200, 422]);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await expectReplay(server, player, accepted, ok);
      await expectReplay(server, player, refused, no);
    }
    expect((await receipts(server, player.game.id)).map((row) => row.seq)).toEqual([1, 2]);
  });

  it('(a) reenvio concorrente de um comando aceito: aplicado uma única vez', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const command = order('recruitVillagers', { quantity: 1 });
    const replies = await Promise.all(
      Array.from({ length: 8 }, () => send<CommandAccepted>(server, token, game.id, command)),
    );
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.body).toEqual(replies[0]?.body);
    }
    // Exatamente uma resposta é a execução; as outras sete são o recibo.
    expect(replies.filter((reply) => reply.headers[REPLAYED] === undefined)).toHaveLength(1);
    expect(replies.filter((reply) => reply.headers[REPLAYED] === 'true')).toHaveLength(7);

    expect(await receipts(server, game.id)).toHaveLength(1);
    expect((await snapshot(server, game.id)).stateVersion).toBe('2');
    const view = await getView(server, token, game.id);
    // Um único aldeão em treinamento, uma única cobrança (50 de comida, 10 de ouro).
    expect(view.body.view.population.inTraining).toBe(1);
    expect(stock(view.body.view, 'food')).toBe(130);
    expect(stock(view.body.view, 'gold')).toBe(240);
    const events = await eventRows(server, game.id);
    expect(events.filter((event) => event.kind === 'recruitmentStarted')).toHaveLength(1);
    expect(events.map((event) => event.seq)).toEqual(sequence(1, events.length));
  });

  it('(a) reenvio concorrente de um comando recusado: um único recibo', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const command = order('startConstruction', { building: 'townHall' });
    const replies = await Promise.all(
      Array.from({ length: 8 }, () => send<GameRuleError>(server, token, game.id, command)),
    );
    for (const reply of replies) {
      expect(reply.status).toBe(422);
      expect(reply.body).toEqual(replies[0]?.body);
    }
    expect(replies.filter((reply) => reply.headers[REPLAYED] === undefined)).toHaveLength(1);
    expect(await receipts(server, game.id)).toHaveLength(1);
    expect((await snapshot(server, game.id)).stateVersion).toBe('2');
  });

  it('(b) depois de reiniciar o servidor, o recibo continua valendo', async () => {
    const first = await createTestApp({ clock: server.clock });
    let second: TestApp | undefined;
    try {
      const player = await newPlayer(first);
      const accepted = order('startConstruction', { building: 'housing' });
      const refused = order('startConstruction', { building: 'townHall' });
      const ok = await send(first, player.token, player.game.id, accepted);
      const no = await send(first, player.token, player.game.id, refused);
      expect([ok.status, no.status]).toEqual([200, 422]);
      await first.close();

      second = await createTestApp({ clock: server.clock });
      await expectReplay(second, player, accepted, ok);
      await expectReplay(second, player, refused, no);
      // A obra não foi iniciada duas vezes: os recursos foram cobrados uma só vez.
      const view = await getView(second, player.token, player.game.id);
      expect(view.body.view.constructions.active?.building).toBe('housing');
      expect(stock(view.body.view, 'stone')).toBe(45);
      expect(await receipts(second, player.game.id)).toHaveLength(2);
    } finally {
      await second?.close();
    }
  });

  it('(c) depois de outros comandos e de o tempo passar, o reenvio devolve a resposta original', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    const accepted = order('setWorkers', { building: 'farm', count: 2 });
    const refused = order('startConstruction', { building: 'townHall' });
    const ok = await send<CommandAccepted>(server, player.token, game.id, accepted);
    const no = await send<GameRuleError>(server, player.token, game.id, refused);
    expect([ok.status, no.status]).toEqual([200, 422]);

    // Outros comandos mudam o mundo, inclusive desfazendo o efeito do primeiro.
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 0 }));
    await send(server, player.token, game.id, order('renameSettlement', { name: 'Vila Nova' }));
    server.clock.advance(3 * HOUR);
    await renew(server, player);
    await send(server, player.token, game.id, order('startConstruction', { building: 'housing' }));
    server.clock.advance(HOUR);
    await renew(server, player);

    const before = await everything(server, game.id);
    await expectReplay(server, player, accepted, ok);
    await expectReplay(server, player, refused, no);
    // O recibo é uma fotografia do passado: o mundo atual segue como estava antes do reenvio.
    expect(ok.body.view.settlement.name).toBe('Pedra Alta');
    const after = await everything(server, game.id);
    expect(after).toEqual(before);
    expect(after.receipts.map((row) => row.seq)).toEqual([1, 2, 3, 4, 5]);
    // Uma hora passou desde o último comando sem leitura: o reenvio não avançou a partida.
    expect(after.game.lastProcessedAt).not.toBe(server.clock.now().toISOString());

    const view = await getView(server, player.token, game.id);
    expect(view.body.view.settlement.name).toBe('Vila Nova');
    expect(view.body.view.population.free).toBe(5);
  });

  it('(d) recibo com mais de 90 dias continua idempotente', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    const accepted = order('recruitVillagers', { quantity: 2 });
    const refused = order('startConstruction', { building: 'townHall' });
    const ok = await send(server, player.token, game.id, accepted);
    const no = await send(server, player.token, game.id, refused);
    expect([ok.status, no.status]).toEqual([200, 422]);
    // A sessão vale no máximo 30 dias (GDD §14.7): para voltar depois de 100 dias, o jogador
    // entra com o Código do Reino, que cria uma sessão nova.
    const code = await call<{ code: string }>(server, 'POST', '/auth/recovery-code', {
      token: player.token,
    });
    expect(code.status).toBe(200);
    const before = await everything(server, game.id);

    server.clock.advance(100 * DAY);
    const recovered = await call<AuthResponse>(server, 'POST', '/auth/recover', {
      body: { code: code.body.code },
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.account.id).toBe(player.accountId);
    player.token = recovered.body.accessToken;
    player.refreshToken = recovered.body.refreshToken;

    const age = server.clock.now().getTime() - (before.receipts[0]?.server_time.getTime() ?? 0);
    expect(age).toBeGreaterThan(90 * DAY);

    await expectReplay(server, player, accepted, ok);
    await expectReplay(server, player, refused, no);
    // Cem dias sem acesso e nada foi avançado, aplicado ou inserido pelo reenvio.
    expect(await everything(server, game.id)).toEqual(before);

    // O mesmo UUID com outro payload ainda é conflito: o registro antigo não foi expurgado.
    const conflict = await send<ApiError>(server, player.token, game.id, {
      ...order('recruitVillagers', { quantity: 1 }),
      commandId: accepted.commandId,
    });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe('COMMAND_ID_CONFLICT');
    expect(await everything(server, game.id)).toEqual(before);
  });

  it('recibos permanecem na partida arquivada', async () => {
    const player = await newPlayer(server);
    const accepted = order('setWorkers', { building: 'farm', count: 2 });
    const ok = await send(server, player.token, player.game.id, accepted);
    expect(ok.status).toBe(200);
    const before = await receipts(server, player.game.id);

    await startGame(server, player.token, { replaceActive: true });
    expect((await snapshot(server, player.game.id)).status).toBe('archived');
    expect(await receipts(server, player.game.id)).toEqual(before);

    const replay = await send(server, player.token, player.game.id, accepted);
    expect(replay.status).toBe(200);
    expect(replay.body).toEqual(ok.body);
    expect(replay.headers[REPLAYED]).toBe('true');
    expect(await receipts(server, player.game.id)).toEqual(before);
  });

  it('mesmo UUID com payload ou tipo diferente: 409 COMMAND_ID_CONFLICT sem alterar o recibo', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const original = order('setWorkers', { building: 'farm', count: 2 });
    const ok = await send(server, token, game.id, original);
    expect(ok.status).toBe(200);
    const before = await everything(server, game.id);

    const variants: Command[] = [
      { ...order('setWorkers', { building: 'farm', count: 3 }), commandId: original.commandId },
      { ...order('setWorkers', { building: 'quarry', count: 2 }), commandId: original.commandId },
      {
        ...order('startConstruction', { building: 'farm' }),
        commandId: original.commandId,
      },
    ];
    for (const variant of variants) {
      const reply = await send<ApiError>(server, token, game.id, variant);
      expect(reply.status).toBe(409);
      expect(reply.body.code).toBe('COMMAND_ID_CONFLICT');
      expect(reply.headers[REPLAYED]).toBeUndefined();
      expect(reply.body).not.toHaveProperty('view');
      expect(await everything(server, game.id)).toEqual(before);
    }
    // O recibo original segue intacto e respondendo.
    await expectReplay(server, player, original, ok);
  });

  it('conflito de UUID também vale para um recibo de recusa', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const refused = order('startConstruction', { building: 'townHall' });
    const no = await send(server, token, game.id, refused);
    expect(no.status).toBe(422);
    const before = await everything(server, game.id);

    const reply = await send<ApiError>(server, token, game.id, {
      ...order('startConstruction', { building: 'housing' }),
      commandId: refused.commandId,
    });
    expect(reply.status).toBe(409);
    expect(reply.body.code).toBe('COMMAND_ID_CONFLICT');
    expect(await everything(server, game.id)).toEqual(before);
    await expectReplay(server, player, refused, no);
  });

  it('o mesmo commandId em outra partida é um comando novo (escopo: partida)', async () => {
    const one = await newPlayer(server, 'Primeira');
    const two = await newPlayer(server, 'Segunda');
    const command = order('setWorkers', { building: 'farm', count: 2 });
    const first = await send(server, one.token, one.game.id, command);
    const second = await send(server, two.token, two.game.id, {
      ...order('setWorkers', { building: 'quarry', count: 1 }),
      commandId: command.commandId,
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(second.headers[REPLAYED]).toBeUndefined();
    expect(await receipts(server, two.game.id)).toHaveLength(1);
  });

  it('ordem das chaves e cabeçalho de versão não mudam a identidade do comando', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    const commandId = randomUUID();
    const ok = await call<CommandAccepted>(server, 'POST', `/games/${game.id}/commands`, {
      token,
      body: { commandId, type: 'setWorkers', payload: { building: 'farm', count: 2 } },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.staleView).toBe(false);
    const before = await everything(server, game.id);

    // Chaves em outra ordem, no payload e no envelope.
    const reordered = await call<CommandAccepted>(server, 'POST', `/games/${game.id}/commands`, {
      token,
      body: { payload: { count: 2, building: 'farm' }, type: 'setWorkers', commandId },
    });
    expect(reordered.status).toBe(200);
    expect(reordered.body).toEqual(ok.body);
    expect(reordered.headers[REPLAYED]).toBe('true');

    // Cabeçalho de versão diferente do da primeira tentativa (que não mandou nenhum).
    for (const version of ['1', '2', '999']) {
      const replay = await call<CommandAccepted>(server, 'POST', `/games/${game.id}/commands`, {
        token,
        body: { payload: { count: 2, building: 'farm' }, commandId, type: 'setWorkers' },
        headers: { [STATE_VERSION]: version },
      });
      expect(replay.status).toBe(200);
      expect(replay.body).toEqual(ok.body);
      expect(replay.headers[REPLAYED]).toBe('true');
    }
    expect(await everything(server, game.id)).toEqual(before);
  });

  it.each([
    ['sem commandId', { type: 'setWorkers', payload: { building: 'farm', count: 2 } }],
    [
      'commandId que não é UUID',
      { commandId: 'abc', type: 'setWorkers', payload: { building: 'farm', count: 2 } },
    ],
    ['tipo desconhecido', { commandId: randomUUID(), type: 'conquerWorld', payload: {} }],
    ['sem payload', { commandId: randomUUID(), type: 'setWorkers' }],
    [
      'payload com tipo errado',
      { commandId: randomUUID(), type: 'setWorkers', payload: { building: 'farm', count: '2' } },
    ],
    [
      'edifício inexistente',
      { commandId: randomUUID(), type: 'startConstruction', payload: { building: 'castle' } },
    ],
    [
      'chave a mais no payload',
      {
        commandId: randomUUID(),
        type: 'startConstruction',
        payload: { building: 'housing', free: true },
      },
    ],
    ['corpo que não é objeto', ['setWorkers']],
  ])('corpo inválido (%s) → 400 VALIDATION e não gera recibo', async (_label, body) => {
    const player = await newPlayer(server);
    const before = await everything(server, player.game.id);
    const reply = await call<ApiError>(server, 'POST', `/games/${player.game.id}/commands`, {
      token: player.token,
      body,
    });
    expect(reply.status).toBe(400);
    expect(reply.body.code).toBe('VALIDATION');
    expect(reply.headers[REPLAYED]).toBeUndefined();
    const after = await everything(server, player.game.id);
    expect(after).toEqual(before);
    expect(after.receipts).toEqual([]);
  });

  it('depois de um 400, o mesmo UUID pode ser usado com um corpo válido', async () => {
    const player = await newPlayer(server);
    const commandId = randomUUID();
    const invalid = await call<ApiError>(server, 'POST', `/games/${player.game.id}/commands`, {
      token: player.token,
      body: { commandId, type: 'setWorkers', payload: { building: 'farm' } },
    });
    expect(invalid.status).toBe(400);
    const valid = await send(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }, commandId),
    );
    expect(valid.status).toBe(200);
    expect(valid.headers[REPLAYED]).toBeUndefined();
  });
});

// --- staleView ------------------------------------------------------------------

describe('staleView e X-Lords-State-Version', () => {
  it('cabeçalho ausente → false', async () => {
    const player = await newPlayer(server);
    const ok = await send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(ok.body.staleView).toBe(false);
    const no = await send<GameRuleError>(
      server,
      player.token,
      player.game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(no.body.details.staleView).toBe(false);
  });

  it('cabeçalho igual à versão persistida → false, em sucesso e em recusa', async () => {
    const player = await newPlayer(server);
    const ok = await send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
      { [STATE_VERSION]: '1' },
    );
    expect(ok.status).toBe(200);
    expect(ok.body.staleView).toBe(false);
    expect(ok.body.stateVersion).toBe('2');
    const no = await send<GameRuleError>(
      server,
      player.token,
      player.game.id,
      order('startConstruction', { building: 'townHall' }),
      { [STATE_VERSION]: '2' },
    );
    expect(no.status).toBe(422);
    expect(no.body.details.staleView).toBe(false);
    expect(no.body.details.stateVersion).toBe('3');
  });

  it('cabeçalho diferente → true, e o comando é aplicado mesmo assim', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;
    await send(server, token, game.id, order('setWorkers', { building: 'farm', count: 2 }));

    // O cliente ainda conhecia a versão 1; a persistida já é a 2.
    const behind = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('setWorkers', { building: 'lumberMill', count: 1 }),
      { [STATE_VERSION]: '1' },
    );
    expect(behind.status).toBe(200);
    expect(behind.body.staleView).toBe(true);
    expect(behind.body.stateVersion).toBe('3');
    expect(behind.body.view.population.free).toBe(2);

    // Uma versão "do futuro" também difere.
    const ahead = await send<CommandAccepted>(
      server,
      token,
      game.id,
      order('setWorkers', { building: 'quarry', count: 1 }),
      { [STATE_VERSION]: '77' },
    );
    expect(ahead.status).toBe(200);
    expect(ahead.body.staleView).toBe(true);

    // Em recusa, o aviso vai nos detalhes.
    const refused = await send<GameRuleError>(
      server,
      token,
      game.id,
      order('startConstruction', { building: 'townHall' }),
      { [STATE_VERSION]: '1' },
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.staleView).toBe(true);

    const view = await getView(server, token, game.id);
    expect(view.body.view.population.free).toBe(1);
    expect(view.body.stateVersion).toBe('5');
  });

  it('a comparação usa a versão persistida antes do avanço do próprio comando', async () => {
    const player = await newPlayer(server);
    // Duas horas sem leitura: a virada de dia só será escrita pelo próprio comando.
    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const reply = await send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
      { [STATE_VERSION]: '1' },
    );
    expect(reply.status).toBe(200);
    expect(reply.body.staleView).toBe(false);
    expect(reply.body.stateVersion).toBe('2');
    expect(reply.body.events.map((event) => event.type)).toContain('dayStarted');
  });

  it.each(['abc', '0', '1.5', '-1', '01', '1e3', ' '])(
    'cabeçalho malformado (%j) → 400 VALIDATION, sem aplicar nem gerar recibo',
    async (value) => {
      const player = await newPlayer(server);
      const before = await everything(server, player.game.id);
      const reply = await send<ApiError>(
        server,
        player.token,
        player.game.id,
        order('setWorkers', { building: 'farm', count: 2 }),
        { [STATE_VERSION]: value },
      );
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
      expect(await everything(server, player.game.id)).toEqual(before);
    },
  );

  it('o recibo conserva o staleView da primeira tentativa', async () => {
    const player = await newPlayer(server);
    const { token, game } = player;

    // Primeira tentativa em dia (false); reenvio com cabeçalho agora defasado continua false.
    const fresh = order('setWorkers', { building: 'farm', count: 2 });
    const first = await send<CommandAccepted>(server, token, game.id, fresh, {
      [STATE_VERSION]: '1',
    });
    expect(first.body.staleView).toBe(false);
    const freshReplay = await send<CommandAccepted>(server, token, game.id, fresh, {
      [STATE_VERSION]: '1',
    });
    expect(freshReplay.headers[REPLAYED]).toBe('true');
    expect(freshReplay.body.staleView).toBe(false);

    // Primeira tentativa defasada (true); reenvio com a versão atual, ou sem cabeçalho, continua true.
    const stale = order('startConstruction', { building: 'townHall' });
    const second = await send<GameRuleError>(server, token, game.id, stale, {
      [STATE_VERSION]: '1',
    });
    expect(second.status).toBe(422);
    expect(second.body.details.staleView).toBe(true);
    for (const headers of [{ [STATE_VERSION]: '3' }, {}]) {
      const replay = await send<GameRuleError>(server, token, game.id, stale, headers);
      expect(replay.status).toBe(422);
      expect(replay.headers[REPLAYED]).toBe('true');
      expect(replay.body).toEqual(second.body);
      expect(replay.body.details.staleView).toBe(true);
    }
  });
});

// --- Recusa após avanço (F2-T6.9) -----------------------------------------------

describe('recusa após horas sem acesso (F2-T6.9)', () => {
  it('conclusão da obra e produção persistem; a recusa não desconta nada; eventos aparecem uma vez', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 2 }));
    const started = await send<CommandAccepted>(
      server,
      player.token,
      game.id,
      order('startConstruction', { building: 'housing' }),
    );
    expect(started.status).toBe(200);
    expect(started.body.stateVersion).toBe('3');
    const base = started.body.view;
    expect(base.constructions.active?.building).toBe('housing');
    const eventsBefore = (await eventRows(server, game.id)).length;

    // Cinco horas sem acesso: a obra (4 min) termina e o dia vira duas vezes (2 h e 4 h).
    server.clock.advance(5 * HOUR);
    await renew(server, player);

    const refusedCommand = order('startConstruction', { building: 'townHall' });
    const refused = await send<GameRuleError>(server, player.token, game.id, refusedCommand);
    expect(refused.status).toBe(422);
    expect(GameRuleErrorSchema.safeParse(refused.body).error).toBeUndefined();
    expect(refused.body.details.code).toBe('INSUFFICIENT_RESOURCES');
    expect(refused.body.details.stateVersion).toBe('4');
    expect((await snapshot(server, game.id)).stateVersion).toBe('4');

    // O recibo 422 traz a view nova: obra concluída, produção acumulada, dia 3.
    const advanced = refused.body.details.view;
    expect(advanced.constructions.active).toBeNull();
    expect(advanced.population.capacity).toBe(base.population.capacity + 5);
    expect(advanced.calendar.dayOfSeason).toBe(3);
    // 2 aldeões na Fazenda (10/h cada, × 1,2 na primavera) menos o consumo de 5 aldeões
    // (1/h cada). Recém-chegados, rendem metade no primeiro dia de jogo: +7/h por 2 h. Depois,
    // +19/h mais a experiência que a Fazenda ganha a cada virada (× 1,012 e × 1,024) e a moral,
    // que a primeira virada leva a 60 (× 1,05): 14 + 41,004 + 20,804.
    expect(stock(advanced, 'food')).toBe(stock(base, 'food') + 75);
    // A ação recusada não descontou nada.
    expect(stock(advanced, 'wood')).toBe(stock(base, 'wood'));
    expect(stock(advanced, 'stone')).toBe(stock(base, 'stone'));
    expect(stock(advanced, 'gold')).toBe(stock(base, 'gold'));
    expect(advanced.settlement.townHallLevel).toBe(base.settlement.townHallLevel);
    expect(refused.body.details.events.map((event) => event.type)).toEqual([
      'constructionFinished',
      'dayStarted',
      'dayStarted',
    ]);
    expect(refused.body.details.events.map((event) => event.seq)).toEqual(
      sequence(eventsBefore + 1, eventsBefore + 3),
    );

    // O que o recibo mostrou é o que ficou persistido.
    const view = await getView(server, player.token, game.id);
    expect(view.status).toBe(200);
    expect(view.body).toEqual({ view: advanced, stateVersion: '4' });

    // Os eventos do avanço aparecem uma única vez.
    const events = await getEvents(server, player.token, game.id);
    expect(events.body.events.map((event) => event.seq)).toEqual(sequence(1, eventsBefore + 3));
    expect(
      events.body.events.filter((event) => event.type === 'constructionFinished'),
    ).toHaveLength(1);
    expect(events.body.events.filter((event) => event.type === 'dayStarted')).toHaveLength(2);
    expect(events.body.events.slice(-3)).toEqual(refused.body.details.events);
    // Ler de novo não reinsere nada.
    await getView(server, player.token, game.id);
    expect(await eventRows(server, game.id)).toHaveLength(eventsBefore + 3);
    expect((await snapshot(server, game.id)).stateVersion).toBe('4');

    // --- Os recursos passam a bastar ---
    await send(
      server,
      player.token,
      game.id,
      order('setWorkers', { building: 'lumberMill', count: 1 }),
    );
    await send(
      server,
      player.token,
      game.id,
      order('setWorkers', { building: 'quarry', count: 2 }),
    );
    server.clock.advance(12 * HOUR);
    await renew(server, player);
    const rich = await getView(server, player.token, game.id);
    expect(stock(rich.body.view, 'wood')).toBeGreaterThanOrEqual(150);
    expect(stock(rich.body.view, 'stone')).toBeGreaterThanOrEqual(100);
    expect(stock(rich.body.view, 'gold')).toBeGreaterThanOrEqual(100);

    // Repetir o mesmo UUID mantém a recusa original, sem escrever nada.
    const before = await everything(server, game.id);
    const replay = await send<GameRuleError>(server, player.token, game.id, refusedCommand);
    expect(replay.status).toBe(422);
    expect(replay.body).toEqual(refused.body);
    expect(replay.headers[REPLAYED]).toBe('true');
    expect(await everything(server, game.id)).toEqual(before);

    // Um UUID novo é reavaliado contra o estado atual.
    const retried = await send<CommandAccepted>(
      server,
      player.token,
      game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(retried.status).toBe(200);
    expect(retried.headers[REPLAYED]).toBeUndefined();
    expect(retried.body.view.constructions.active?.building).toBe('townHall');
    expect(stock(retried.body.view, 'wood')).toBe(stock(rich.body.view, 'wood') - 150);
    expect(stock(retried.body.view, 'stone')).toBe(stock(rich.body.view, 'stone') - 100);
    expect(retried.body.events.map((event) => event.type)).toContain('constructionStarted');
  });
});

// --- Concorrência (F2-T6.7) -----------------------------------------------------

describe('concorrência (F2-T6.7)', () => {
  /** Dez intenções diferentes, cujo resultado depende da ordem em que forem aplicadas. */
  function tenCommands(): Command[] {
    return [
      order('setWorkers', { building: 'farm', count: 2 }),
      order('setWorkers', { building: 'lumberMill', count: 2 }),
      order('setWorkers', { building: 'quarry', count: 2 }),
      order('startConstruction', { building: 'housing' }),
      order('startConstruction', { building: 'farm' }),
      order('cancelConstruction', { building: 'housing' }),
      order('recruitVillagers', { quantity: 1 }),
      order('renameSettlement', { name: 'Vila Nova' }),
      order('planConstruction', { building: 'townHall' }),
      order('startConstruction', { building: 'townHall' }),
    ];
  }

  it(
    '10 comandos em paralelo: cada um aplicado uma vez, seq 1..10, estado igual ao sequencial',
    { repeats: 19 },
    async () => {
      const parallel = await newPlayer(server, 'Paralelo');
      const sequential = await newPlayer(server, 'Sequencial');
      const commands = tenCommands();

      const replies = await Promise.all(
        commands.map((command) => send(server, parallel.token, parallel.game.id, command)),
      );
      for (const reply of replies) {
        expect([200, 422]).toContain(reply.status);
        expect(reply.headers[REPLAYED]).toBeUndefined();
      }

      const rows = await receipts(server, parallel.game.id);
      expect(rows.map((row) => row.seq)).toEqual(sequence(1, 10));
      expect(rows.map((row) => row.id).sort()).toEqual(
        commands.map((command) => command.commandId).sort(),
      );
      // Cada resposta é exatamente o recibo gravado para o seu comando.
      commands.forEach((command, index) => {
        const row = rows.find((candidate) => candidate.id === command.commandId);
        expect(row?.response_status).toBe(replies[index]?.status);
        expect(row?.response_body).toEqual(replies[index]?.body);
      });
      // Uma escrita por comando: versão 1 + 10; as versões devolvidas são 2..11, sem repetição.
      expect((await snapshot(server, parallel.game.id)).stateVersion).toBe('11');
      const versions = rows.map((row) => {
        const body = row.response_body as CommandAccepted | GameRuleError;
        return 'details' in body ? body.details.stateVersion : body.stateVersion;
      });
      expect(versions).toEqual(sequence(2, 11).map(String));
      const parallelEvents = await eventRows(server, parallel.game.id);
      expect(parallelEvents.map((event) => event.seq)).toEqual(sequence(1, parallelEvents.length));

      // Reproduz a ordem gravada, um por vez, em outra partida com a mesma semente e o relógio parado.
      for (const row of rows) {
        const original = commands.find((command) => command.commandId === row.id);
        if (original === undefined) {
          throw new Error('Recibo de um comando que não foi enviado.');
        }
        const reply = await send(server, sequential.token, sequential.game.id, original);
        expect(reply.status, `seq ${row.seq}`).toBe(row.response_status);
        expect(reply.body, `seq ${row.seq}`).toEqual(row.response_body);
      }

      const [left, right] = await Promise.all([
        getView(server, parallel.token, parallel.game.id),
        getView(server, sequential.token, sequential.game.id),
      ]);
      expect(left.status).toBe(200);
      expect(left.body).toEqual(right.body);
      expect((await snapshot(server, parallel.game.id)).state).toEqual(
        (await snapshot(server, sequential.game.id)).state,
      );
      const strip = (events: EventRow[]) =>
        events.map((event) => ({ ...event, at: event.at.toISOString() }));
      expect(strip(parallelEvents)).toEqual(strip(await eventRows(server, sequential.game.id)));
    },
  );

  it('leituras e comandos concorrentes numa virada de dia não duplicam eventos', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 2 }));
    const eventsBefore = (await eventRows(server, game.id)).length;
    const versionBefore = Number((await snapshot(server, game.id)).stateVersion);

    server.clock.advance(2 * HOUR);
    const token = await renew(server, player);

    const commands = [
      order('setWorkers', { building: 'lumberMill', count: 1 }),
      order('startConstruction', { building: 'housing' }),
      order('startConstruction', { building: 'townHall' }),
      order('renameSettlement', { name: 'Vila Nova' }),
    ];
    const [views, lists, results] = await Promise.all([
      Promise.all(Array.from({ length: 8 }, () => getView(server, token, game.id))),
      Promise.all(Array.from({ length: 8 }, () => getEvents(server, token, game.id))),
      Promise.all(
        // Cada comando vai duas vezes: o reenvio concorrente também entra na disputa.
        [...commands, ...commands].map((command) =>
          send<CommandAccepted | GameRuleError>(server, token, game.id, command),
        ),
      ),
    ]);
    for (const reply of [...views, ...lists]) {
      expect(reply.status).toBe(200);
    }
    for (const view of views) {
      expect(view.body.view.calendar.dayOfSeason).toBe(2);
    }

    const rows = await eventRows(server, game.id);
    expect(rows.map((row) => row.seq)).toEqual(sequence(1, rows.length));
    expect(rows.filter((row) => row.kind === 'dayStarted')).toHaveLength(1);
    const identities = rows.map((row) => canonical({ kind: row.kind, payload: row.payload }));
    expect(new Set(identities).size).toBe(identities.length);

    // Pela API, cada seq aparece uma única vez e há um só dayStarted.
    const all = await getEvents(server, token, game.id);
    expect(all.body.events.map((event) => event.seq)).toEqual(sequence(1, rows.length));
    expect(all.body.events.filter((event) => event.type === 'dayStarted')).toHaveLength(1);
    for (const list of lists) {
      const seqs = list.body.events.map((event) => event.seq);
      expect(new Set(seqs).size).toBe(seqs.length);
      expect(
        list.body.events.filter((event) => event.type === 'dayStarted').length,
      ).toBeLessThanOrEqual(1);
    }

    // Nas respostas dos comandos (execuções, sem contar reenvios), cada evento sai uma vez.
    const executed = results.filter((reply) => reply.headers[REPLAYED] === undefined);
    expect(executed).toHaveLength(commands.length);
    const reported = executed.flatMap((reply): GameEvent[] =>
      'details' in reply.body ? reply.body.details.events : reply.body.events,
    );
    const reportedSeqs = reported.map((event) => event.seq);
    expect(new Set(reportedSeqs).size).toBe(reportedSeqs.length);
    expect(reported.filter((event) => event.type === 'dayStarted').length).toBeLessThanOrEqual(1);
    expect(Math.min(...reportedSeqs)).toBeGreaterThan(eventsBefore);

    // Quatro comandos novos escrevem quatro vezes; a virada de dia custa no máximo mais uma
    // escrita (se uma leitura chegou antes do primeiro comando).
    expect((await receipts(server, game.id)).map((row) => row.seq)).toEqual(sequence(1, 5));
    const versionAfter = Number((await snapshot(server, game.id)).stateVersion);
    expect([versionBefore + 4, versionBefore + 5]).toContain(versionAfter);
  });
});

// --- Falha transacional ---------------------------------------------------------

describe('falha entre a escrita do estado e o recibo (F2-T6.7)', () => {
  it('responde 500, desfaz tudo e o mesmo UUID pode ser tentado de novo', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 2 }));
    // Uma virada de dia pendente: o comando teria eventos do avanço para gravar.
    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const before = await everything(server, game.id);

    const accepted = order('startConstruction', { building: 'housing' });
    const refused = order('startConstruction', { building: 'townHall' });
    server.hooks.beforeCommandReceipt = () => {
      throw new Error('falha');
    };
    try {
      for (const command of [accepted, refused]) {
        const failed = await send<ApiError>(server, player.token, game.id, command);
        expect(failed.status).toBe(500);
        expect(failed.body.code).toBe('INTERNAL');
        expect(failed.headers[REPLAYED]).toBeUndefined();
        // Estado, versão, eventos e recibos intactos.
        expect(await everything(server, game.id)).toEqual(before);
      }
    } finally {
      delete server.hooks.beforeCommandReceipt;
    }

    // Sem a falha, o mesmo UUID é um comando novo e funciona.
    const retried = await send<CommandAccepted>(server, player.token, game.id, accepted);
    expect(retried.status).toBe(200);
    expect(retried.headers[REPLAYED]).toBeUndefined();
    expect(retried.body.stateVersion).toBe(String(Number(before.game.stateVersion) + 1));
    expect(retried.body.events.map((event) => event.type)).toContain('dayStarted');
    expect(retried.body.events.map((event) => event.type)).toContain('constructionStarted');
    const retriedRefusal = await send<GameRuleError>(server, player.token, game.id, refused);
    expect(retriedRefusal.status).toBe(422);
    expect(retriedRefusal.headers[REPLAYED]).toBeUndefined();

    const after = await everything(server, game.id);
    expect(after.receipts.map((row) => row.seq)).toEqual([1, 2, 3]);
    expect(after.events.filter((event) => event.kind === 'dayStarted')).toHaveLength(1);
    expect(after.events.map((event) => event.seq)).toEqual(sequence(1, after.events.length));
  });
});

// --- Eventos e Crônica (F2-T6.6) ------------------------------------------------

describe('eventos e Crônica (F2-T6.6)', () => {
  /** Uma partida com história: objetivos, obra iniciada e concluída e três viradas de dia. */
  async function seasonedPlayer(): Promise<{ player: Player; all: GameEvent[] }> {
    const player = await newPlayer(server);
    const { game } = player;
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 2 }));
    await send(server, player.token, game.id, order('startConstruction', { building: 'housing' }));
    server.clock.advance(6 * HOUR + MINUTE);
    await renew(server, player);
    await send(server, player.token, game.id, order('renameSettlement', { name: 'Vila Nova' }));
    const all = await getEvents(server, player.token, game.id, '?limit=500');
    expect(all.status).toBe(200);
    return { player, all: all.body.events };
  }

  it('GET /events devolve os eventos em ordem de sequência, com frase de Crônica', async () => {
    const { player, all } = await seasonedPlayer();
    const reply = await getEvents(server, player.token, player.game.id);
    expect(reply.status).toBe(200);
    expect(EventsResponseSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.events).toEqual(all);
    expect(all.length).toBeGreaterThanOrEqual(7);
    expect(all.map((event) => event.seq)).toEqual(sequence(1, all.length));
    expect(reply.body.lastSeq).toBe(all.length);
    expect(reply.body.hasMore).toBe(false);
    for (const event of all) {
      expect(event.text.length).toBeGreaterThan(0);
    }
    const types = all.map((event) => event.type);
    expect(types.filter((type) => type === 'dayStarted')).toHaveLength(3);
    expect(types).toContain('constructionStarted');
    expect(types).toContain('constructionFinished');
    expect(types).toContain('objectiveCompleted');
    expect(types[types.length - 1]).toBe('settlementRenamed');
    // Os instantes reais não andam para trás.
    const instants = all.map((event) => new Date(event.at).getTime());
    expect([...instants].sort((a, b) => a - b)).toEqual(instants);
  });

  it('GET /events?after=&limit= pagina sem repetir nem pular eventos', async () => {
    const { player, all } = await seasonedPlayer();
    const page = await getEvents(server, player.token, player.game.id, '?after=2&limit=2');
    expect(page.status).toBe(200);
    expect(page.body.events).toEqual(all.slice(2, 4));
    expect(page.body.lastSeq).toBe(4);
    expect(page.body.hasMore).toBe(true);

    // Segue o cursor até o fim.
    const collected: GameEvent[] = [];
    let after = 0;
    for (let guard = 0; guard < 50; guard += 1) {
      const next = await getEvents(server, player.token, player.game.id, `?after=${after}&limit=3`);
      expect(next.body.events.length).toBeLessThanOrEqual(3);
      collected.push(...next.body.events);
      after = next.body.lastSeq;
      if (!next.body.hasMore) {
        break;
      }
    }
    expect(collected).toEqual(all);

    // Nada de novo depois do último: lista vazia e o cursor fica onde estava.
    const tail = await getEvents(server, player.token, player.game.id, `?after=${all.length}`);
    expect(tail.body).toEqual({ events: [], lastSeq: all.length, hasMore: false });

    const exact = await getEvents(server, player.token, player.game.id, `?limit=${all.length}`);
    expect(exact.body.events).toHaveLength(all.length);
    expect(exact.body.hasMore).toBe(false);
  });

  it.each(['?after=-1', '?after=abc', '?limit=0', '?limit=abc', '?after=1.5'])(
    'GET /events%s → 400 VALIDATION',
    async (query) => {
      const player = await newPlayer(server);
      const reply = await call<ApiError>(server, 'GET', `/games/${player.game.id}/events${query}`, {
        token: player.token,
      });
      expect(reply.status).toBe(400);
      expect(reply.body.code).toBe('VALIDATION');
    },
  );

  it('GET /chronicle?limit= devolve as últimas linhas, da mais antiga para a mais recente', async () => {
    const { player, all } = await seasonedPlayer();
    const full = await call<ChronicleResponse>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle`,
      { token: player.token },
    );
    expect(full.status).toBe(200);
    expect(ChronicleResponseSchema.safeParse(full.body).error).toBeUndefined();
    const seqs = full.body.entries.map((entry) => entry.seq);
    expect([...seqs].sort((a, b) => a - b)).toEqual(seqs);
    expect(new Set(seqs).size).toBe(seqs.length);
    for (const entry of full.body.entries) {
      // Cada linha da Crônica é um evento da partida, com a mesma frase.
      expect(all.find((event) => event.seq === entry.seq)).toEqual(entry);
    }

    const limited = await call<ChronicleResponse>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle?limit=2`,
      { token: player.token },
    );
    expect(limited.status).toBe(200);
    expect(limited.body.entries).toEqual(full.body.entries.slice(-2));
    expect(limited.body.entries[1]?.type).toBe('settlementRenamed');

    const invalid = await call<ApiError>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle?limit=0`,
      { token: player.token },
    );
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe('VALIDATION');
  });

  it('GET /chronicle.md devolve Markdown com título, ano e as frases dos eventos', async () => {
    const { player, all } = await seasonedPlayer();
    const reply = await call<string>(server, 'GET', `/games/${player.game.id}/chronicle.md`, {
      token: player.token,
    });
    expect(reply.status).toBe(200);
    expect(String(reply.headers['content-type'])).toContain('text/markdown');
    const lines = reply.body.split('\n');
    // Título de nível 1 com o nome atual do feudo.
    expect(lines[0]).toMatch(/^# .*Vila Nova/);
    expect(reply.body).toMatch(/Ano 1/);
    const items = lines.filter((line) => line.startsWith('- '));
    // Cada item é a frase de exatamente um evento, na ordem em que aconteceram.
    const texts = all.map((event) => `- ${event.text}`);
    let cursor = -1;
    for (const item of items) {
      const index = texts.indexOf(item, cursor + 1);
      expect(index, item).toBeGreaterThan(cursor);
      cursor = index;
    }
    for (const event of all.filter((candidate) => candidate.type !== 'dayStarted')) {
      expect(items).toContain(`- ${event.text}`);
    }
  });

  it('GET /chronicle.md tem uma linha por evento da partida, menos as viradas de dia', async () => {
    // F2-T6.6: "Markdown com título, ano e uma linha por evento". O ADR 0007 tirou da Crônica
    // as viradas de dia, que continuam em GET /events.
    const { player, all } = await seasonedPlayer();
    expect(all.filter((event) => event.type === 'dayStarted')).toHaveLength(3);
    const told = all.filter((event) => event.type !== 'dayStarted');
    const reply = await call<string>(server, 'GET', `/games/${player.game.id}/chronicle.md`, {
      token: player.token,
    });
    const items = reply.body.split('\n').filter((line) => line.startsWith('- '));
    expect(items).toEqual(told.map((event) => `- ${event.text}`));
    expect(reply.body).not.toContain('Amanhece');
  });

  it('GET /chronicle traz os mesmos eventos de GET /events, menos as viradas de dia', async () => {
    const { player, all } = await seasonedPlayer();
    const told = all.filter((event) => event.type !== 'dayStarted');
    const full = await call<ChronicleResponse>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle`,
      { token: player.token },
    );
    expect(full.body.entries).toEqual(told);
    // O limite conta só o que entra na Crônica: as viradas de dia não gastam linhas.
    const limited = await call<ChronicleResponse>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle?limit=3`,
      { token: player.token },
    );
    expect(limited.body.entries).toEqual(told.slice(-3));
    expect(limited.body.entries.map((entry) => entry.type)).toEqual([
      'objectiveCompleted',
      'constructionFinished',
      'settlementRenamed',
    ]);
  });

  it('partida sem eventos: listas vazias e Markdown só com o título', async () => {
    const player = await newPlayer(server);
    const events = await getEvents(server, player.token, player.game.id);
    expect(events.body).toEqual({ events: [], lastSeq: 0, hasMore: false });
    const chronicle = await call<ChronicleResponse>(
      server,
      'GET',
      `/games/${player.game.id}/chronicle`,
      { token: player.token },
    );
    expect(chronicle.body).toEqual({ entries: [] });
    const markdown = await call<string>(server, 'GET', `/games/${player.game.id}/chronicle.md`, {
      token: player.token,
    });
    expect(markdown.status).toBe(200);
    expect(markdown.body.split('\n')[0]).toMatch(/^# .*Pedra Alta/);
    expect(markdown.body.split('\n').filter((line) => line.startsWith('- '))).toEqual([]);
  });
});

// --- Relógio (F2-T6.2) ----------------------------------------------------------

describe('relógio da partida (F2-T6.2)', () => {
  it('o tempo de jogo é (agora − created_at) × time_scale', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    const created = await snapshot(server, game.id);
    expect(created.createdAt).toBe(server.clock.now().toISOString());
    expect(game.createdAt).toBe(created.createdAt);

    const elapsed = 3 * HOUR + 20 * MINUTE + 7 * SECOND;
    server.clock.advance(elapsed);
    await renew(server, player);
    const view = await getView(server, player.token, game.id);
    // Dia de 2 h: 3 h 20 min 7 s depois é o 2º dia, faltando 39 min 53 s para o 3º.
    expect(view.body.view.calendar.dayOfSeason).toBe(2);
    expect(view.body.view.calendar.dayOfYear).toBe(2);
    expect(view.body.view.calendar.secondsToNextDay).toBe((4 * HOUR - elapsed) / SECOND);
    // 5 aldeões sem ninguém na Fazenda: −5 de comida por hora.
    expect(view.body.view.resources.find((entry) => entry.id === 'food')?.perHour).toBe(-5);

    // Um evento de comando acontece no instante de jogo do relógio do servidor.
    const renamed = await send<CommandAccepted>(
      server,
      player.token,
      game.id,
      order('renameSettlement', { name: 'Vila Nova' }),
    );
    const createdAtMs = new Date(created.createdAt).getTime();
    // A virada de dia foi gravada pela leitura acima, no instante exato em que aconteceu.
    const listed = await getEvents(server, player.token, game.id);
    const day = listed.body.events.find((event) => event.type === 'dayStarted');
    expect(day).toMatchObject({
      atMs: 2 * HOUR,
      at: new Date(createdAtMs + 2 * HOUR).toISOString(),
    });
    const rename = renamed.body.events.find((event) => event.type === 'settlementRenamed');
    expect(rename).toMatchObject({ atMs: elapsed, at: server.clock.now().toISOString() });
    expect((server.clock.now().getTime() - createdAtMs) * game.timeScale).toBe(elapsed);
  });

  it('fechar por horas e reabrir mostra o intervalo simulado, sem duplicar progresso', async () => {
    const player = await newPlayer(server);
    const { game } = player;
    await send(server, player.token, game.id, order('setWorkers', { building: 'farm', count: 2 }));

    server.clock.advance(6 * HOUR);
    await renew(server, player);
    const reopened = await getView(server, player.token, game.id);
    expect(reopened.status).toBe(200);
    // A partir de 180: +7 de comida por hora nas duas primeiras horas (os lavradores acabaram
    // de chegar e rendem metade) e +19 depois, com a experiência que a Fazenda ganha a cada
    // virada de dia (× 1,012 e × 1,024) e a moral que a primeira virada leva a 60 (× 1,05):
    // 14 + 41,004 + 41,608.
    expect(stock(reopened.body.view, 'food')).toBe(276);
    expect(reopened.body.view.calendar.dayOfSeason).toBe(4);
    const events = await getEvents(server, player.token, game.id);
    expect(events.body.events.filter((event) => event.type === 'dayStarted')).toHaveLength(3);

    // Reabrir de novo no mesmo instante não soma nada outra vez.
    const before = await everything(server, game.id);
    const again = await getView(server, player.token, game.id, {
      'if-none-match': String(reopened.headers.etag),
    });
    expect(again.status).toBe(304);
    expect(await everything(server, game.id)).toEqual(before);

    server.clock.advance(HOUR);
    await renew(server, player);
    const later = await getView(server, player.token, game.id);
    // Mais uma hora, já com 12 de experiência na Fazenda e a moral em 60:
    // 24 × 1,036 × 1,05 − 5 = 21,107.
    expect(stock(later.body.view, 'food')).toBe(297);
    expect(later.body.view.calendar.dayOfSeason).toBe(4);
    expect(await eventRows(server, game.id)).toHaveLength(before.events.length);
  });

  it('ler de hora em hora ou só no fim dá a mesma view e os mesmos eventos', async () => {
    const frequent = await newPlayer(server, 'Assídua');
    const absent = await newPlayer(server, 'Ausente');
    for (const player of [frequent, absent]) {
      await send(
        server,
        player.token,
        player.game.id,
        order('setWorkers', { building: 'farm', count: 2 }),
      );
      await send(
        server,
        player.token,
        player.game.id,
        order('startConstruction', { building: 'housing' }),
      );
    }

    for (let hour = 1; hour <= 7; hour += 1) {
      server.clock.advance(HOUR + 13 * SECOND);
      await renew(server, frequent);
      expect((await getView(server, frequent.token, frequent.game.id)).status).toBe(200);
    }
    await renew(server, absent);

    const [left, right] = [
      await getView(server, frequent.token, frequent.game.id),
      await getView(server, absent.token, absent.game.id),
    ];
    expect(left.body.view).toEqual(right.body.view);
    const [leftEvents, rightEvents] = [
      await getEvents(server, frequent.token, frequent.game.id),
      await getEvents(server, absent.token, absent.game.id),
    ];
    expect(leftEvents.body).toEqual(rightEvents.body);
    // A versão conta escritas, não tempo: quem leu mais vezes com eventos escreveu mais vezes.
    expect(Number(left.body.stateVersion)).toBeGreaterThan(Number(right.body.stateVersion));
  });
});
