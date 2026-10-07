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
const CURRENT = 23;
/**
 * A Taverna com que toda partida chega à versão atual (V3C-T2): sem candidato, sem rotação
 * marcada e sem festival, porque o edifício entra por construir.
 */
const EMPTY_TAVERN = {
  tavernOffers: [],
  tavern: { nextRotationAtMs: null, festival: null, lastFestivalAtMs: null },
  // E as expedições (V3D-T1, versão 17): nenhuma em curso, nenhum relatório.
  expeditions: [],
  reports: [],
};
/**
 * A guilda com que toda partida chega à versão atual: sem herói, sem ninguém prometido, sem
 * soldo em atraso e com a Taverna vazia.
 */
const EMPTY_GUILD = {
  heroes: [],
  arriving: [],
  wageArrears: null,
  lastWageArrears: null,
  ...EMPTY_TAVERN,
};

/**
 * Um estado gravado sem o que o passo 22 → 23 acrescenta a toda partida (V3E-T3): as duas listas
 * de Mestres e o Mestre de cada registro do percurso. É o que deixa os blocos dos passos
 * anteriores compararem o resto, campo por campo, com o retrato antigo; o que o passo escreve é
 * conferido no bloco dele.
 */
function beforeMasters<T>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as {
    settlement?: { masters?: unknown; mastersWaiting?: unknown };
    guild?: {
      expeditions?: Array<{ log?: Array<Record<string, unknown>> }>;
      reports?: Array<{ log?: Array<Record<string, unknown>> }>;
    };
  };
  delete copy.settlement?.masters;
  delete copy.settlement?.mastersWaiting;
  for (const journey of [...(copy.guild?.expeditions ?? []), ...(copy.guild?.reports ?? [])]) {
    for (const entry of journey.log ?? []) {
      delete entry.master;
    }
  }
  return copy as T;
}

/**
 * Um estado gravado sem o que o passo 17 → 18 acrescenta a toda partida (V3D-T2): os destinos
 * revelados, o arsenal e, em cada herói, o ferimento, o cativeiro e o equipamento. É o que deixa
 * os blocos dos passos anteriores compararem o resto, campo por campo, com o retrato antigo; o
 * que o passo escreve é conferido no bloco dele.
 */
function beforeOutcomes<T>(input: T): T {
  // E os Mestres, da versão 23 (V3E-T3).
  const state = beforeMasters(input);
  const copy = JSON.parse(JSON.stringify(state)) as {
    map?: { discovered?: unknown };
    guild?: { inventory?: unknown; heroes?: Array<Record<string, unknown>> };
    market?: unknown;
    settlement?: { buildings?: Record<string, unknown> };
  };
  // E o Mercado, da versão 21 (V3E-T1): o edifício por construir e os preços na base.
  delete copy.market;
  delete copy.settlement?.buildings?.market;
  delete copy.map?.discovered;
  delete copy.guild?.inventory;
  for (const hero of copy.guild?.heroes ?? []) {
    delete hero.injury;
    delete hero.captivity;
    delete hero.equipment;
    // E a volta do cativeiro, da versão 20 (revisão da Fase D).
    delete hero.freedAtMs;
  }
  return copy as T;
}

/**
 * O feudo de um estado anterior à versão 16, com a Taverna por construir a mais e, desde a
 * versão 17, a Guilda dos Aventureiros também.
 */
function withTavernSite<T extends { buildings: Record<string, number> }>(settlement: T): T {
  return { ...settlement, buildings: { ...settlement.buildings, tavern: 0, guild: 0 } };
}

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
 * de Vigia, a Paliçada e a Taverna por construir, nenhum desperdício, a segunda fila de obras livre e as
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
      tavern: 0,
      guild: 0,
      market: 0,
    },
    wasted: { food: 0, wood: 0, stone: 0, gold: 0 },
    // Os Mestres (V3E-T3): ninguém no feudo, ninguém à porta.
    masters: [],
    mastersWaiting: [],
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
    const site = withTavernSite(calm.settlement);
    expect(after.state.settlement).toEqual({
      ...site,
      // E o Mercado, da versão 21, também por construir.
      buildings: { ...site.buildings, market: 0 },
      lastFamine: null,
      // E os Mestres, da versão 23: nenhum.
      masters: [],
      mastersWaiting: [],
    });
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

describe('uma partida gravada na versão 12 (V3B-T1; ADR 0017, decisão 9)', () => {
  type V12State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids?: Record<string, number>;
  };

  /** Um retrato da versão 12, como o motor da v0.2 publicada o gravou. */
  function v12State(name: string): V12State {
    const url = new URL(`../../engine/src/__fixtures__/state-v12-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V12State;
  }

  async function insertV12(app: TestApp, state: V12State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // As três dificuldades e os três ritmos; partidas migradas (uma com estoque herdado acima do
  // limite) e nascidas na versão 12; os três fluxos de sorteio em uso.
  it.each([
    ['week-scripted'],
    ['migrated-3x'],
    ['migrated-peasant-3x'],
    ['migrated-iron-king-half'],
    ['raid-announced'],
    ['famine-resumed'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com os contadores de identidade e a guilda vazia a mais',
    async (name) => {
      const before = v12State(name);
      expect(before.ids).toBeUndefined();
      const game = await insertV12(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 12, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V12State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 12, campo por campo, com a fronteira nova e os contadores vazios:
      // nenhum estoque, prazo, carta, incursão ou sorteio muda.
      expect(beforeOutcomes(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        ids: {},
        // A guilda é dos passos seguintes (13 → 14 e 15 → 16), conferidos nos blocos deles,
        // abaixo; a Taverna por construir é do 15 → 16.
        guild: EMPTY_GUILD,
        settlement: withTavernSite(before.settlement),
      });
      expect(row.state.rng).toEqual(before.rng);

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
      // Nada do gerador nem dos contadores sai na visão.
      expect(Object.keys(reply.body.view)).not.toContain('ids');
      expect(Object.keys(reply.body.view)).not.toContain('rng');
    },
  );

  it('uma ordem como primeiro contato migra, aplica e grava tudo em uma escrita só', async () => {
    const before = v12State('migrated-peasant-3x');
    const game = await insertV12(server, before);
    const reply = await send<CommandAccepted>(
      server,
      game.token,
      game.id,
      order('renameSettlement', { name: 'Vau do Corvo' }),
    );
    expect(reply.status).toBe(200);
    expect(reply.body.stateVersion).toBe('8');
    const row = (await rowOf(server, game.id)) as Row & { state: V12State };
    expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
    expect(row.state.ids).toEqual({});
    expect(row.state.settlement.name).toBe('Vau do Corvo');
    // O estoque herdado acima do limite continua como estava.
    expect(row.state.settlement.resources.food).toBe(before.settlement.resources.food);
  });

  it('o job de avanço migra a partida de quem não voltou, e um dia real depois nada da v0.3 apareceu', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v12State('migrated-iron-king-half');
      // Parada há duas horas: o job a enxerga.
      const game = await insertV12(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V12State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      // Um dia real no ritmo Tranquilo: doze horas de jogo depois do retrato.
      expect(row.state.lastProcessedAt).toBe(before.lastProcessedAt + DAY / 2);
      // Nenhuma regra de hoje cria entidade: contadores vazios e só os fluxos fixos no gerador.
      expect(row.state.ids).toEqual({});
      for (const stream of Object.keys(row.state.rng)) {
        expect(['council', 'morale', 'horde']).toContain(stream);
      }
    } finally {
      await app.close();
    }
  });

  // A guarda da versão 13 confere os nomes dos fluxos, e a da 12 não conferia. Um estado da
  // versão 12 com um fluxo que nenhum motor escreveu (`siege`, de uma imagem futura revertida
  // ou de uma edição à mão) é recusado no fim da migração, sem ser gravado por cima.
  it.each([
    ['um fluxo desconhecido', 'siege', /rng\.siege: chave fora do esperado/],
    [
      'um fluxo de entidade que nenhum contador deu',
      'expedition:expedition-5',
      /rng\.expedition:expedition-5: fluxo de uma entidade além do contador/,
    ],
  ])(
    'com %s no gerador: a leitura responde 500 sem gravar, e o job segue com as outras e diz a causa',
    async (_, stream, cause) => {
      const clock = fakeClock();
      const app = await createTestApp({ clock });
      try {
        await truncateAll(app.pool);
        const strange = v12State('week-scripted');
        strange.settlement.name = 'Nome Que Não Vai Para o Log';
        strange.rng = { ...strange.rng, [stream]: [1, 2, 3, 4] };
        const bad = await insertV12(app, strange, 2 * HOUR);
        const good = await insertV12(app, v12State('migrated-3x'), 2 * HOUR);
        const before = await rowOf(app, bad.id);
        expect(before).toMatchObject({ schemaVersion: 12, stateVersion: 7 });

        const view = await call<ApiError>(app, 'GET', `/games/${bad.id}/view`, {
          token: bad.token,
        });
        expect(view.status).toBe(500);
        expect(view.body.code).toBe('INTERNAL');
        expect(JSON.stringify(view.body)).not.toContain('Nome Que');
        const command = await send<ApiError>(
          app,
          bad.token,
          bad.id,
          order('setWorkers', { building: 'farm', count: 0 }),
        );
        expect(command.status).toBe(500);
        expect(await rowOf(app, bad.id)).toEqual(before);
        expect(await countRows(app.pool, 'commands', `game_id = '${bad.id}'`)).toBe(0);

        clock.advance(HOUR);
        const report = await advanceStaleGames(app.ctx);
        expect(report).toMatchObject({ advanced: 1, failed: 1, failedGameIds: [bad.id] });
        expect(report.firstFailure?.name).toBe('StateMigrationError');
        expect(report.firstFailure?.message).toMatch(cause);
        expect(JSON.stringify(report)).not.toContain('Nome Que');
        // A ilegível fica como estava; a outra foi migrada e avançada.
        expect(await rowOf(app, bad.id)).toEqual(before);
        expect(await rowOf(app, good.id)).toMatchObject({
          schemaVersion: CURRENT,
          stateVersion: 8,
        });
      } finally {
        await app.close();
      }
    },
  );
});

describe('uma partida gravada na versão 13 (V3C-T1; ADR 0017, decisões 3 e 5)', () => {
  type V13State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    guild?: unknown;
  };

  /** Um retrato da versão 13, como o motor da Fase B o gravou. */
  function v13State(name: string): V13State {
    const url = new URL(`../../engine/src/__fixtures__/state-v13-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V13State;
  }

  async function insertV13(app: TestApp, state: V13State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  it.each([['week-scripted'], ['migrated-3x'], ['migrated-iron-king-half'], ['famine-resumed']])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com a guilda vazia a mais',
    async (name) => {
      const before = v13State(name);
      expect(before.guild).toBeUndefined();
      const game = await insertV13(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 13, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V13State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 13, campo por campo, com a fronteira nova, a guilda vazia e a
      // Taverna por construir:
      // nenhum estoque, prazo, carta, incursão, contador ou sorteio muda.
      expect(beforeOutcomes(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        guild: EMPTY_GUILD,
        // A Taverna por construir é do passo 15 → 16, conferido no bloco dele, abaixo.
        settlement: withTavernSite(before.settlement),
      });

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois não há herói, soldo nem atraso', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v13State('migrated-peasant-3x');
      const game = await insertV13(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V13State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(beforeOutcomes(row.state).guild).toEqual(EMPTY_GUILD);
      expect(row.state.ids).toEqual({});
      expect(
        await countRows(
          app.pool,
          'game_events',
          `game_id = '${game.id}' and (kind like 'wageArrears%' or kind like 'hero%')`,
        ),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 15 (V3C-T2; ADR 0017, decisões 4, 5 e 10)', () => {
  type V15State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    guild: { heroes: Array<{ id: string }>; arriving: unknown[]; tavern?: unknown };
  };

  /** Um retrato da versão 15, como o motor da carta da estrangeira o gravou. */
  function v15State(name: string): V15State {
    const url = new URL(`../../engine/src/__fixtures__/state-v15-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V15State;
  }

  async function insertV15(app: TestApp, state: V15State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // As três dificuldades e os três ritmos; a guilda vazia, com heróis, com um herói prometido
  // e com o soldo em atraso; partidas nascidas na versão 15 e migradas até ela.
  it.each([
    ['week-scripted'],
    ['guild'],
    ['hero-promised'],
    ['wage-arrears'],
    ['migrated-iron-king-half'],
    ['migrated-peasant-3x'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com a Taverna por construir a mais',
    async (name) => {
      const before = v15State(name);
      expect(before.guild.tavern).toBeUndefined();
      expect(before.settlement.buildings.tavern).toBeUndefined();
      const game = await insertV15(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 15, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V15State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 15, campo por campo, com a fronteira nova, o edifício no nível
      // zero e a Taverna vazia: nenhum herói, prometido, atraso, estoque, contador ou sorteio
      // muda, e o fluxo da Taverna só nasce com a primeira rotação.
      expect(beforeOutcomes(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        settlement: withTavernSite(before.settlement),
        guild: { ...before.guild, ...EMPTY_TAVERN },
      });
      expect(Object.keys(row.state.rng)).not.toContain('tavern');

      // A visão traz a Taverna por erguer: sem candidato, sem rotação e sem festival em curso.
      expect(reply.body.view.tavern).toMatchObject({
        level: 0,
        offers: [],
        nextRotationInSeconds: null,
        festival: { available: false, activeForSeconds: null },
      });

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois a Taverna continua por erguer e os heróis são os mesmos', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v15State('week-scripted');
      expect(before.guild.heroes).toHaveLength(1);
      const game = await insertV15(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V15State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(row.state.lastProcessedAt).toBe(before.lastProcessedAt + DAY);
      // Ninguém mandou erguer a Taverna: nada dela acontece sozinho.
      expect(row.state.settlement.buildings.tavern).toBe(0);
      expect(row.state.guild).toMatchObject(EMPTY_TAVERN);
      expect(row.state.guild.heroes.map((hero) => hero.id)).toEqual(
        before.guild.heroes.map((hero) => hero.id),
      );
      expect(row.state.ids).toEqual(before.ids);
      expect(Object.keys(row.state.rng)).not.toContain('tavern');
      expect(
        await countRows(
          app.pool,
          'game_events',
          `game_id = '${game.id}' and kind in ('heroHired', 'festivalHeld', 'festivalEnded')`,
        ),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 16 (V3D-T1; ADR 0018, decisões 11 a 13)', () => {
  type V16State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    guild: { heroes: Array<{ id: string; status: string }>; expeditions?: unknown };
  };

  /** Um retrato da versão 16, como o motor da Taverna o gravou. */
  function v16State(name: string): V16State {
    const url = new URL(`../../engine/src/__fixtures__/state-v16-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V16State;
  }

  async function insertV16(app: TestApp, state: V16State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // As três dificuldades e os três ritmos; com heróis, com a Taverna aberta e em festa, com o
  // soldo em atraso; partidas nascidas na versão 16 e migradas até ela.
  it.each([
    ['week-scripted'],
    ['guild'],
    ['tavern'],
    ['tavern-busy'],
    ['wage-arrears'],
    ['migrated-iron-king-half'],
    ['migrated-peasant-3x'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com a Guilda por construir a mais',
    async (name) => {
      const before = v16State(name);
      expect(before.guild.expeditions).toBeUndefined();
      expect(before.settlement.buildings.guild).toBeUndefined();
      const game = await insertV16(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 16, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V16State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 16, campo por campo, com a fronteira nova, o edifício no nível
      // zero e as duas listas vazias: nenhum herói, oferta, festival, estoque, contador ou
      // sorteio muda, e todos continuam no feudo.
      expect(beforeOutcomes(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        settlement: {
          ...before.settlement,
          buildings: { ...before.settlement.buildings, guild: 0 },
        },
        guild: { ...before.guild, expeditions: [], reports: [] },
      });
      expect(Object.keys(row.state.rng).filter((key) => key.includes(':'))).toEqual([]);
      expect(row.state.guild.heroes.every((hero) => hero.status === 'idle')).toBe(true);

      // A visão traz a Guilda por erguer: sem lugar, sem destino, sem expedição, e só cartas
      // entre as decisões à espera.
      expect(reply.body.view.guild).toMatchObject({
        built: false,
        level: 0,
        slots: 0,
        available: [],
        expeditions: [],
        reports: [],
      });
      expect(reply.body.view.pendingDecisions.every((entry) => entry.kind === 'card')).toBe(true);

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois a Guilda continua por erguer e ninguém saiu em expedição', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v16State('tavern');
      expect(before.guild.heroes).toHaveLength(1);
      const game = await insertV16(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V16State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      // Ninguém mandou erguer a Guilda: nada dela acontece sozinho.
      expect(row.state.settlement.buildings.guild).toBe(0);
      expect(row.state.guild).toMatchObject({ expeditions: [], reports: [] });
      expect(row.state.guild.heroes.map((hero) => [hero.id, hero.status])).toEqual(
        before.guild.heroes.map((hero) => [hero.id, 'idle']),
      );
      expect(row.state.ids.expedition).toBeUndefined();
      expect(
        await countRows(
          app.pool,
          'game_events',
          `game_id = '${game.id}' and kind like 'expedition%'`,
        ),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 20 (V3E-T1; ADR 0018, decisão 16)', () => {
  type V20State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    market?: unknown;
  };
  const NO_MARKET = {
    prices: { food: 1000, wood: 1200, stone: 2000 },
    previousPrices: { food: 1000, wood: 1200, stone: 2000 },
    quoteDay: 0,
    tradedToday: { food: 0, wood: 0, stone: 0 },
    // As caravanas são da versão 22 (V3E-T2): toda partida antiga chega sem nenhuma na estrada.
    caravans: [],
  };

  /** Um retrato da versão 20, como o motor do fim da Fase D o gravou. */
  function v20State(name: string): V20State {
    const url = new URL(`../../engine/src/__fixtures__/state-v20-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V20State;
  }

  async function insertV20(app: TestApp, state: V20State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // As três dificuldades e os três ritmos; com heróis, com a Taverna, com uma expedição em
  // curso e com um cativo; partidas nascidas na versão 20 e migradas até ela.
  it.each([
    ['week-scripted'],
    ['guild'],
    ['tavern-busy'],
    ['expedition-crossroads'],
    ['hero-captured'],
    ['migrated-iron-king-half'],
    ['migrated-peasant-3x'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com o Mercado por construir a mais',
    async (name) => {
      const before = v20State(name);
      expect(before.market).toBeUndefined();
      expect(before.settlement.buildings.market).toBeUndefined();
      const game = await insertV20(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 20, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V20State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 20, campo por campo, com a fronteira nova, o edifício no nível
      // zero e o Mercado com os preços na base: nenhum estoque, contador ou sorteio muda.
      expect(beforeMasters(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        settlement: {
          ...before.settlement,
          buildings: { ...before.settlement.buildings, market: 0 },
        },
        market: NO_MARKET,
      });
      expect(row.state.rng.market).toBeUndefined();

      // A visão traz o Mercado por erguer, sem preço nenhum.
      expect(reply.body.view.market).toMatchObject({
        level: 0,
        quoteDay: 0,
        nextChangeInSeconds: null,
        dailyVolume: 0,
        prices: [],
      });

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois o Mercado continua por erguer e os preços não andaram', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v20State('tavern');
      const game = await insertV20(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V20State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      // Ninguém mandou erguer o Mercado: nada dele acontece sozinho, por mais dias que passem.
      expect(row.state.settlement.buildings.market).toBe(0);
      expect(row.state.market).toEqual(NO_MARKET);
      expect(row.state.rng.market).toBeUndefined();
      expect(
        await countRows(app.pool, 'game_events', `game_id = '${game.id}' and kind like 'market%'`),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 17 (V3D-T2; ADR 0017, decisão 8; ADR 0018, decisões 14 e 15)', () => {
  type V17Hero = { id: string; status: string; injury?: unknown; equipment?: unknown };
  type V17State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    map: { tiles: unknown; threat: number; discovered?: unknown };
    guild: {
      heroes: V17Hero[];
      inventory?: unknown;
      expeditions: Array<{ id: string; loot: { items?: unknown }; log: unknown[] }>;
      reports: Array<{ expeditionId: string; sold?: unknown; lost?: unknown }>;
    };
  };

  /** Um retrato da versão 17, como o motor das expedições o gravou. */
  function v17State(name: string): V17State {
    const url = new URL(`../../engine/src/__fixtures__/state-v17-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V17State;
  }

  async function insertV17(app: TestApp, state: V17State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // Os três ritmos e as três dificuldades; com heróis no feudo, com uma expedição em viagem, com
  // uma parada na encruzilhada e um relatório guardado, e com duas de uma vez.
  it.each([
    ['week-scripted'],
    ['guild'],
    ['tavern-busy'],
    ['expedition'],
    ['expedition-crossroads'],
    ['expedition-returning'],
    ['migrated-peasant-3x'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com o arsenal e os destinos vazios a mais',
    async (name) => {
      const before = v17State(name);
      expect(before.guild.inventory).toBeUndefined();
      expect(before.map.discovered).toBeUndefined();
      const game = await insertV17(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 17, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V17State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(row.state.guild.inventory).toEqual([]);
      expect(row.state.map.discovered).toEqual([]);
      // Ninguém ganha identificador, e o gerador fica palavra por palavra como estava.
      expect(row.state.rng).toEqual(before.rng);
      expect(row.state.ids).toEqual(before.ids);
      // Os heróis são os mesmos, no mesmo estado, sem ferimento nem equipamento.
      expect(row.state.guild.heroes.map((hero) => [hero.id, hero.status])).toEqual(
        before.guild.heroes.map((hero) => [hero.id, hero.status]),
      );
      for (const hero of row.state.guild.heroes) {
        expect(hero).toMatchObject({
          injury: null,
          captivity: null,
          equipment: { weapon: null, armor: null, accessory: null },
        });
      }
      // As expedições em curso continuam de onde estavam, com o saque sem item nenhum.
      expect(row.state.guild.expeditions.map((entry) => entry.id)).toEqual(
        before.guild.expeditions.map((entry) => entry.id),
      );
      for (const expedition of row.state.guild.expeditions) {
        expect(expedition.loot.items).toEqual([]);
      }
      for (const report of row.state.guild.reports) {
        expect(report).toMatchObject({ sold: [], lost: false });
      }

      // A visão: o arsenal vazio, ninguém ferido nem em cativeiro, e nenhum destino por
      // descoberta nem o Resgate na lista.
      const { guild, threat } = reply.body.view;
      expect(guild.inventory).toEqual([]);
      expect(guild.captiveText).toBeNull();
      expect(guild.heroes.every((hero) => hero.injury === null && !hero.captive)).toBe(true);
      expect(guild.available.map((offer) => offer.modelId)).not.toContain('rescue');
      expect(guild.available.map((offer) => offer.modelId)).not.toContain('ruins');
      expect(threat.clearedText).toBeNull();

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: a equipe parada na encruzilhada segue pela Postura e volta pelas regras novas', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v17State('expedition-crossroads');
      expect(before.guild.expeditions).toHaveLength(1);
      const game = await insertV17(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V17State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      // Um dia real depois a expedição acabou: voltou (ou se perdeu), e o relatório dela ficou.
      expect(row.state.guild.expeditions).toEqual([]);
      expect(row.state.guild.reports.map((entry) => entry.expeditionId)).toContain(
        before.guild.expeditions[0]?.id,
      );
      expect(
        await countRows(
          app.pool,
          'game_events',
          `game_id = '${game.id}' and kind in ('expeditionReturned', 'expeditionLost')`,
        ),
      ).toBe(1);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 19 (revisão da Fase D, M-D1; ADR 0017, decisão 3)', () => {
  type V19Hero = { id: string; status: string; joinedAtMs: number; freedAtMs?: unknown };
  type V19State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    guild: { heroes: V19Hero[] };
  };

  /** Um retrato da versão 19, como o motor do catálogo de expedições o gravou. */
  function v19State(name: string): V19State {
    const url = new URL(`../../engine/src/__fixtures__/state-v19-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V19State;
  }

  // Com um cativo, com um ferido, com o soldo em atraso e com uma expedição na encruzilhada.
  it.each([['hero-captured'], ['hero-injured'], ['wage-arrears'], ['expedition-crossroads']])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com a volta do cativeiro vazia em cada herói',
    async (name) => {
      const before = v19State(name);
      expect(before.guild.heroes.length).toBeGreaterThan(0);
      expect(before.guild.heroes.every((hero) => hero.freedAtMs === undefined)).toBe(true);
      const game = await insertGame(server, before, {
        timeScale: before.settings.timeScale,
        stateVersion: 7,
      });
      await server.pool.query('update games set difficulty = $2 where id = $1', [
        game.id,
        before.settings.difficulty,
      ]);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 19, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      // A migração é uma escrita do estado: a versão persistida sobe uma vez.
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V19State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // Nada é reconstituído: ninguém ganha um instante de volta que a versão 19 não guardava.
      expect(row.state.guild.heroes.map((hero) => [hero.id, hero.status, hero.freedAtMs])).toEqual(
        before.guild.heroes.map((hero) => [hero.id, hero.status, null]),
      );
      // O passo não dá identificador a ninguém e não toca o gerador.
      expect(row.state.ids).toEqual(before.ids);
      expect(row.state.rng).toEqual(before.rng);
      // A segunda leitura não grava de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.stateVersion).toBe('8');
    },
  );
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
      // O relatório diz quais: os ids das vinte primeiras que falharam, e a contagem inteira.
      const failedIds = report.failedGameIds ?? [];
      expect(failedIds).toHaveLength(20);
      expect(new Set(failedIds).size).toBe(20);
      expect(failedIds).not.toContain(old.id);
      const { rows: unreadable } = await app.pool.query<{ id: string }>(
        'select id from games where schema_version = $1',
        [CURRENT + 1],
      );
      const unreadableIds = new Set(unreadable.map((row) => row.id));
      expect(failedIds.every((id) => unreadableIds.has(id))).toBe(true);
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

  it('o job diz a causa da primeira falha e qual partida falhou, sem nada do que o jogador escreveu', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const state = futureState();
      state.settlement.name = 'Nome Que Não Vai Para o Log';
      const unreadable = await insertGame(app, state);
      const healthy = await insertGame(app, v1State('fresh'));
      clock.advance(3 * HOUR);

      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 1 });
      // Só o id da partida que falhou: é com ele que se acha a linha no banco.
      expect(report.failedGameIds).toEqual([unreadable.id]);
      expect(report.failedGameIds).not.toContain(healthy.id);
      expect(Object.keys(report).sort()).toEqual([
        'advanced',
        'events',
        'failed',
        'failedGameIds',
        'firstFailure',
      ]);
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
        failedGameIds: [unreadable.id],
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

describe('uma partida gravada na versão 21 (V3E-T2; ADR 0018, decisão 17)', () => {
  type V21State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    market: Record<string, unknown>;
  };

  /** Um retrato da versão 21, como o motor do Mercado o gravou. */
  function v21State(name: string): V21State {
    const url = new URL(`../../engine/src/__fixtures__/state-v21-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V21State;
  }

  async function insertV21(app: TestApp, state: V21State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // Com o Mercado de pé e sem ele, com heróis, com uma expedição em curso, nos três ritmos.
  it.each([
    ['market'],
    ['market-opening'],
    ['guild'],
    ['expedition-crossroads'],
    ['week-scripted'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com a lista de caravanas, vazia, a mais',
    async (name) => {
      const before = v21State(name);
      expect(before.market.caravans).toBeUndefined();
      const game = await insertV21(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 21, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V21State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 21, campo por campo, com a fronteira nova e a lista vazia:
      // nenhum estoque, herói, contador ou sorteio muda.
      expect(beforeMasters(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
        market: { ...before.market, caravans: [] },
      });
      expect(row.state.ids.caravan).toBeUndefined();
      expect(reply.body.view.market.caravans).toEqual([]);

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois não há caravana nenhuma, nem evento dela', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v21State('market');
      const game = await insertV21(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V21State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(row.state.market.caravans).toEqual([]);
      expect(row.state.ids.caravan).toBeUndefined();
      expect(
        await countRows(app.pool, 'game_events', `game_id = '${game.id}' and kind like 'caravan%'`),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});

describe('uma partida gravada na versão 22 (V3E-T3; ADR 0018, decisão 18)', () => {
  type Journey = { log: Array<Record<string, unknown>> };
  type V22State = StoredState & {
    settings: { timeScale: number; difficulty: string };
    rng: Record<string, number[]>;
    ids: Record<string, number>;
    settlement: StoredState['settlement'] & {
      masters?: unknown[];
      mastersWaiting?: unknown[];
      population: { villagers: number };
    };
    guild: { expeditions: Journey[]; reports: Journey[] };
  };

  /** Um retrato da versão 22, como o motor das caravanas o gravou. */
  function v22State(name: string): V22State {
    const url = new URL(`../../engine/src/__fixtures__/state-v22-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as V22State;
  }

  async function insertV22(app: TestApp, state: V22State, staleForMs = 0): Promise<OldGame> {
    const game = await insertGame(app, state, {
      timeScale: state.settings.timeScale,
      stateVersion: 7,
      staleForMs,
    });
    await app.pool.query('update games set difficulty = $2 where id = $1', [
      game.id,
      state.settings.difficulty,
    ]);
    return game;
  }

  // Com caravana na estrada, com expedição em curso e com relatório guardado, com gente em
  // adaptação, nos três ritmos.
  it.each([
    ['caravan-escort'],
    ['expedition-returning'],
    ['expedition-crossroads'],
    ['crafts'],
    ['week-scripted'],
    ['migrated-iron-king-half'],
  ])(
    '%s: a primeira leitura a persiste na versão atual, uma vez, só com as duas listas de Mestres, vazias, e o Mestre de cada registro, nulo, a mais',
    async (name) => {
      const before = v22State(name);
      expect(before.settlement.masters).toBeUndefined();
      const game = await insertV22(server, before);
      expect(await rowOf(server, game.id)).toMatchObject({ schemaVersion: 22, stateVersion: 7 });

      const reply = await getView(server, game);
      expect(reply.status).toBe(200);
      expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
      expect(reply.body.stateVersion).toBe('8');

      const row = (await rowOf(server, game.id)) as Row & { state: V22State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      // O estado é o da versão 22, campo por campo, com a fronteira nova: nenhum aldeão,
      // estoque, herói, contador ou sorteio muda.
      expect(row.state.settlement.masters).toEqual([]);
      expect(row.state.settlement.mastersWaiting).toEqual([]);
      for (const journey of [...row.state.guild.expeditions, ...row.state.guild.reports]) {
        for (const entry of journey.log) {
          expect(entry.master).toBeNull();
        }
      }
      expect(beforeMasters(row.state)).toEqual({
        ...before,
        schemaVersion: CURRENT,
        migratedAtMs: before.lastProcessedAt,
      });
      expect(row.state.ids.master).toBeUndefined();
      expect(reply.body.view.masters).toEqual([]);
      expect(reply.body.view.mastersWaiting).toEqual({ count: 0, names: [], note: null });
      expect(reply.body.view.population.masters).toBe(0);

      // A leitura seguinte não migra nem escreve de novo.
      const again = await getView(server, game);
      expect(again.status).toBe(200);
      expect(again.body.view).toEqual(reply.body.view);
      expect((await rowOf(server, game.id)).xmin).toBe(row.xmin);
    },
  );

  it('o job de avanço migra a partida de quem não voltou: um dia real depois não há Mestre nenhum, nem evento dele', async () => {
    const clock = fakeClock();
    const app = await createTestApp({ clock });
    try {
      await truncateAll(app.pool);
      const before = v22State('crafts');
      const game = await insertV22(app, before, 2 * HOUR);
      clock.advance(DAY);
      const report = await advanceStaleGames(app.ctx);
      expect(report).toMatchObject({ advanced: 1, failed: 0 });
      const row = (await rowOf(app, game.id)) as Row & { state: V22State };
      expect(row).toMatchObject({ schemaVersion: CURRENT, stateVersion: 8 });
      expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
      expect(row.state.settlement.masters).toEqual([]);
      expect(row.state.settlement.mastersWaiting).toEqual([]);
      expect(row.state.ids.master).toBeUndefined();
      expect(
        await countRows(app.pool, 'game_events', `game_id = '${game.id}' and kind like 'master%'`),
      ).toBe(0);
    } finally {
      await app.close();
    }
  });
});
