import type {
  CommandAccepted,
  DeleteMeResponse,
  EventsResponse,
  ViewResponse,
} from '@lotg/protocol';
import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { advanceStaleGames } from '../src/jobs/advanceStaleGames';
import { purgeAccounts } from '../src/jobs/purgeAccounts';
import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  countRows,
  createTestApp,
  DAY,
  fakeClock,
  type FakeClock,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  type Player,
  renew,
  send,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Verificação independente da F2-T7: cenários tirados do GDD §14.7 (exclusão), §14.9 (job de
// avanço), do ADR 0005 e do MVP-ROADMAP (F2-T7). Os jobs são chamados direto, com o contexto da
// instância, e o tempo só anda pelo relógio falso.

/** Chave do advisory lock dos jobs (F2-T7.1). */
const JOBS_LOCK = 7271;
/** Um dia de jogo dura 2 h reais e gera `dayStarted`. */
const GAME_DAY = 2 * HOUR;
const SECOND = 1000;

const TABLES = [
  'accounts',
  'sessions',
  'refresh_tokens',
  'games',
  'commands',
  'game_events',
  'chronicles',
] as const;
type Table = (typeof TABLES)[number];

type GameRow = {
  status: string;
  stateVersion: string;
  lastProcessedAt: Date;
  updatedAt: Date;
};

async function gameRow(pool: pg.Pool, gameId: string): Promise<GameRow> {
  const { rows } = await pool.query<GameRow>(
    `select status, state_version::text as "stateVersion", last_processed_at as "lastProcessedAt",
            updated_at as "updatedAt"
     from games where id = $1`,
    [gameId],
  );
  const row = rows[0];
  if (row === undefined) {
    throw new Error(`Partida ${gameId} não encontrada`);
  }
  return row;
}

type EventRow = { seq: number; kind: string; at: Date; payload: unknown };

async function eventRows(pool: pg.Pool, gameId: string): Promise<EventRow[]> {
  const { rows } = await pool.query<EventRow>(
    'select seq::int as seq, kind, at, payload from game_events where game_id = $1 order by seq',
    [gameId],
  );
  return rows;
}

/** Filtro SQL das linhas de cada tabela que pertencem à conta. */
function ownedBy(accountId: string): Record<Table, string> {
  const mine = `'${accountId}'`;
  const myGames = `(select id from games where account_id = ${mine})`;
  return {
    accounts: `id = ${mine}`,
    sessions: `account_id = ${mine}`,
    refresh_tokens: `session_id in (select id from sessions where account_id = ${mine})`,
    games: `account_id = ${mine}`,
    commands: `account_id = ${mine}`,
    game_events: `game_id in ${myGames}`,
    chronicles: `game_id in ${myGames}`,
  };
}

async function rowsOfAccount(pool: pg.Pool, accountId: string): Promise<Record<Table, number>> {
  const filters = ownedBy(accountId);
  const counts = {} as Record<Table, number>;
  for (const table of TABLES) {
    counts[table] = await countRows(pool, table, filters[table]);
  }
  return counts;
}

/** Todas as linhas da conta, tabela por tabela, para comparar antes e depois de um job. */
async function dumpAccount(pool: pg.Pool, accountId: string): Promise<Record<Table, unknown[]>> {
  const filters = ownedBy(accountId);
  const dump = {} as Record<Table, unknown[]>;
  for (const table of TABLES) {
    const { rows } = await pool.query<{ line: string }>(
      `select row_to_json(t)::text as line from ${table} t where ${filters[table]} order by 1`,
    );
    dump[table] = rows.map((row) => JSON.parse(row.line) as unknown);
  }
  return dump;
}

async function totals(pool: pg.Pool): Promise<Record<Table, number>> {
  const counts = {} as Record<Table, number>;
  for (const table of TABLES) {
    counts[table] = await countRows(pool, table);
  }
  return counts;
}

async function insertChronicle(pool: pg.Pool, gameId: string, at: Date): Promise<void> {
  await pool.query(
    `insert into chronicles (game_id, year, summary, score, result, created_at)
     values ($1, 1, '{}'::jsonb, 100, 'survived', $2)`,
    [gameId, at],
  );
}

/** Espera (em tempo real, poucos milissegundos) até alguma conexão segurar o lock dos jobs. */
async function waitForJobsLock(pool: pg.Pool): Promise<void> {
  for (let attempt = 0; attempt < 500; attempt += 1) {
    const { rows } = await pool.query(
      `select 1 from pg_locks
       where locktype = 'advisory' and granted and classid = 0 and objid = $1
         and database = (select oid from pg_database where datname = current_database())`,
      [JOBS_LOCK],
    );
    if (rows.length > 0) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Nenhuma instância pegou o advisory lock dos jobs em 5 s');
}

/** Um jogador que já fez algo: dois comandos (um aceito, um recusado). */
async function busyPlayer(server: TestApp, displayName: string): Promise<Player> {
  const player = await newPlayer(server, displayName);
  const accepted = await send(
    server,
    player.token,
    player.game.id,
    order('setWorkers', { building: 'farm', count: 2 }),
  );
  expect(accepted.status).toBe(200);
  const refused = await send(
    server,
    player.token,
    player.game.id,
    order('startConstruction', { building: 'townHall' }),
  );
  expect(refused.status).toBe(422);
  return player;
}

describe('jobs de avanço e exclusão definitiva (F2-T7)', () => {
  let clock: FakeClock;
  let server: TestApp;
  let replica: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    clock = fakeClock();
    server = await createTestApp({ clock });
    replica = await createTestApp({ clock });
  });
  afterAll(async () => {
    await server.close();
    await replica.close();
  });
  beforeEach(async () => {
    await truncateAll(server.pool);
  });

  describe('advanceStaleGames', () => {
    it('avança uma partida parada e grava a virada de dia sem nenhuma requisição do cliente', async () => {
      const player = await newPlayer(server);
      const before = await gameRow(server.pool, player.game.id);
      expect(before.stateVersion).toBe('1');
      expect(await eventRows(server.pool, player.game.id)).toEqual([]);

      clock.advance(GAME_DAY);
      const report = await advanceStaleGames(server.ctx);

      expect(report.advanced).toBe(1);
      expect(report.events).toBeGreaterThanOrEqual(1);
      const events = await eventRows(server.pool, player.game.id);
      expect(events).toHaveLength(report.events);
      expect(events.map((event) => event.kind)).toContain('dayStarted');
      expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1));

      const after = await gameRow(server.pool, player.game.id);
      expect(after.lastProcessedAt.toISOString()).toBe(clock.now().toISOString());
      expect(after.lastProcessedAt.getTime()).toBeGreaterThan(before.lastProcessedAt.getTime());
      expect(after.stateVersion).toBe('2');
      expect(after.status).toBe('active');
    });

    it('depois do job, o jogador vê os eventos uma única vez: o avanço preguiçoso não os duplica', async () => {
      const player = await newPlayer(server);
      clock.advance(GAME_DAY);
      await advanceStaleGames(server.ctx);
      const persisted = await eventRows(server.pool, player.game.id);
      expect(persisted.filter((event) => event.kind === 'dayStarted')).toHaveLength(1);

      const token = await renew(server, player);
      const path = `/games/${player.game.id}`;
      const first = await call<EventsResponse>(server, 'GET', `${path}/events`, { token });
      expect(first.status).toBe(200);
      expect(first.body.events.map((event) => [event.seq, event.type])).toEqual(
        persisted.map((event) => [event.seq, event.kind]),
      );

      // Leituras seguintes, no mesmo instante, não geram a virada de dia de novo.
      const view = await call<ViewResponse>(server, 'GET', `${path}/view`, { token });
      expect(view.status).toBe(200);
      expect(view.body.view.calendar.dayOfSeason).toBe(2);
      expect(view.body.stateVersion).toBe('2');
      const second = await call<EventsResponse>(replica, 'GET', `${path}/events`, { token });
      expect(second.body.events).toEqual(first.body.events);
      expect(await eventRows(server.pool, player.game.id)).toEqual(persisted);
      expect((await gameRow(server.pool, player.game.id)).stateVersion).toBe('2');
    });

    it('não toca em uma partida recente', async () => {
      const stale = await newPlayer(server, 'Antiga');
      clock.advance(GAME_DAY);
      const recent = await newPlayer(server, 'Recente');
      clock.advance(30 * MINUTE);
      const before = await gameRow(server.pool, recent.game.id);

      const report = await advanceStaleGames(server.ctx);

      expect(report.advanced).toBe(1);
      expect((await gameRow(server.pool, stale.game.id)).stateVersion).toBe('2');
      expect(await gameRow(server.pool, recent.game.id)).toEqual(before);
      expect(await eventRows(server.pool, recent.game.id)).toEqual([]);
    });

    it('só considera parada a partida sem estado persistido há mais de ADVANCE_STALE_AFTER_MS', async () => {
      const player = await newPlayer(server);
      const before = await gameRow(server.pool, player.game.id);

      // Exatamente no limite ainda não é "há mais de 1 h".
      clock.advance(HOUR);
      expect(await advanceStaleGames(server.ctx)).toEqual({ advanced: 0, events: 0, failed: 0 });
      expect(await gameRow(server.pool, player.game.id)).toEqual(before);

      // Passado o limite, o job escreve mesmo sem eventos, para `last_processed_at` andar.
      clock.advance(1);
      expect(await advanceStaleGames(server.ctx)).toEqual({ advanced: 1, events: 0, failed: 0 });
      const after = await gameRow(server.pool, player.game.id);
      expect(after.lastProcessedAt.toISOString()).toBe(clock.now().toISOString());
      expect(after.stateVersion).toBe('2');

      // Recém-avançada, deixa de estar parada: reexecutar não faz nada.
      expect(await advanceStaleGames(server.ctx)).toEqual({ advanced: 0, events: 0, failed: 0 });
      expect(await gameRow(server.pool, player.game.id)).toEqual(after);
    });

    it('respeita ADVANCE_STALE_AFTER_MS da configuração', async () => {
      const eager = await createTestApp({
        clock,
        config: { ADVANCE_STALE_AFTER_MS: String(10 * MINUTE) },
      });
      try {
        const player = await newPlayer(server);
        clock.advance(15 * MINUTE);

        // Com o padrão de 1 h a partida ainda não está parada; com 10 minutos, está.
        expect((await advanceStaleGames(server.ctx)).advanced).toBe(0);
        expect((await advanceStaleGames(eager.ctx)).advanced).toBe(1);
        expect((await gameRow(server.pool, player.game.id)).lastProcessedAt.toISOString()).toBe(
          clock.now().toISOString(),
        );
      } finally {
        await eager.close();
      }
    });

    it('não avança uma partida arquivada', async () => {
      const player = await newPlayer(server);
      const archivedId = player.game.id;
      clock.advance(10 * MINUTE);
      const current = await startGame(server, player.token, { replaceActive: true });
      const archivedBefore = await gameRow(server.pool, archivedId);
      expect(archivedBefore.status).toBe('archived');

      clock.advance(GAME_DAY);
      const report = await advanceStaleGames(server.ctx);

      expect(report.advanced).toBe(1);
      expect(await gameRow(server.pool, archivedId)).toEqual(archivedBefore);
      expect(await eventRows(server.pool, archivedId)).toEqual([]);
      expect((await gameRow(server.pool, current.id)).stateVersion).toBe('2');
      expect((await eventRows(server.pool, current.id)).map((event) => event.kind)).toContain(
        'dayStarted',
      );
    });

    it('avança mais de um lote de 100 partidas na mesma execução', async () => {
      const players: Player[] = [];
      for (let index = 0; index < 120; index += 1) {
        players.push(await newPlayer(server, `Senhor ${index}`));
      }
      clock.advance(GAME_DAY);

      const report = await advanceStaleGames(server.ctx);

      expect(report.advanced).toBe(120);
      expect(await countRows(server.pool, 'games', `state_version = 2`)).toBe(120);
      expect(await countRows(server.pool, 'game_events', `kind = 'dayStarted'`)).toBe(120);
      expect(await countRows(server.pool, 'game_events')).toBe(report.events);
    });
  });

  describe('duas instâncias e concorrência', () => {
    it('sem o advisory lock a instância sai em silêncio; com ele, executa', async () => {
      const player = await newPlayer(server);
      clock.advance(GAME_DAY);
      const before = await gameRow(server.pool, player.game.id);

      const holder = await server.pool.connect();
      try {
        await holder.query('select pg_advisory_lock($1)', [JOBS_LOCK]);
        try {
          // Enquanto "outra réplica" segura o lock, nenhuma das duas instâncias faz nada.
          expect(await runJobsOnce(server.ctx)).toEqual({ ran: false });
          expect(await runJobsOnce(replica.ctx)).toEqual({ ran: false });
          expect(await gameRow(server.pool, player.game.id)).toEqual(before);
          expect(await eventRows(server.pool, player.game.id)).toEqual([]);
        } finally {
          await holder.query('select pg_advisory_unlock($1)', [JOBS_LOCK]);
        }
      } finally {
        holder.release();
      }

      const report = await runJobsOnce(replica.ctx);
      expect(report).toMatchObject({ ran: true, advanced: 1 });
      expect((await gameRow(server.pool, player.game.id)).stateVersion).toBe('2');
      // A instância que saiu em silêncio não deixou o lock preso em nenhuma conexão.
      expect(
        await countRows(server.pool, 'pg_locks', `locktype = 'advisory' and objid = ${JOBS_LOCK}`),
      ).toBe(0);
    });

    it('com duas instâncias sobrepostas, só uma executa e nenhum evento é duplicado', async () => {
      const player = await newPlayer(server);
      clock.advance(GAME_DAY);

      // Segura a tabela de contas para a primeira instância ficar parada no meio da rodada,
      // ainda com o lock dos jobs: assim a sobreposição com a segunda é real.
      const blocker = await server.pool.connect();
      let running: ReturnType<typeof runJobsOnce> | undefined;
      try {
        await blocker.query('begin');
        await blocker.query('lock table accounts in access exclusive mode');
        running = runJobsOnce(server.ctx);
        await waitForJobsLock(replica.pool);

        expect(await runJobsOnce(replica.ctx)).toEqual({ ran: false });
      } finally {
        await blocker.query('rollback');
        blocker.release();
      }

      const report = await running;
      expect(report).toMatchObject({ ran: true, advanced: 1 });
      const events = await eventRows(server.pool, player.game.id);
      expect(events.filter((event) => event.kind === 'dayStarted')).toHaveLength(1);
      expect(events.map((event) => event.seq)).toEqual(events.map((_, index) => index + 1));
      expect((await gameRow(server.pool, player.game.id)).stateVersion).toBe('2');
    });

    it('duas instâncias disparando juntas avançam cada partida uma única vez', async () => {
      const players = [
        await newPlayer(server, 'Um'),
        await newPlayer(server, 'Dois'),
        await newPlayer(server, 'Três'),
      ];
      const rounds = 4;
      let advanced = 0;
      let events = 0;
      for (let round = 0; round < rounds; round += 1) {
        clock.advance(GAME_DAY);
        const reports = await Promise.all([runJobsOnce(server.ctx), runJobsOnce(replica.ctx)]);
        expect(reports.some((report) => report.ran)).toBe(true);
        for (const report of reports) {
          if (report.ran) {
            advanced += report.advanced;
            events += report.events;
          }
        }
      }

      expect(advanced).toBe(players.length * rounds);
      expect(await countRows(server.pool, 'game_events')).toBe(events);
      for (const player of players) {
        const rows = await eventRows(server.pool, player.game.id);
        expect(rows.filter((event) => event.kind === 'dayStarted')).toHaveLength(rounds);
        expect(rows.map((event) => event.seq)).toEqual(rows.map((_, index) => index + 1));
        expect((await gameRow(server.pool, player.game.id)).stateVersion).toBe(String(1 + rounds));
      }
    });

    it('job concorrente com leitura e comando na virada de dia não duplica eventos', async () => {
      const player = await newPlayer(server);
      const gameId = player.game.id;
      const rounds = 6;

      for (let round = 1; round <= rounds; round += 1) {
        clock.advance(GAME_DAY);
        const token = await renew(server, player);

        const [, , view, command] = await Promise.all([
          runJobsOnce(server.ctx),
          runJobsOnce(replica.ctx),
          call<ViewResponse>(replica, 'GET', `/games/${gameId}/view`, { token }),
          send<CommandAccepted>(
            server,
            token,
            gameId,
            order('setWorkers', { building: 'farm', count: 1 + (round % 2) }),
          ),
        ]);
        expect(view.status).toBe(200);
        expect(command.status).toBe(200);

        // A cada rodada: exatamente uma virada de dia a mais, sequência sem buracos.
        const rows = await eventRows(server.pool, gameId);
        expect(rows.filter((event) => event.kind === 'dayStarted')).toHaveLength(round);
        expect(rows.map((event) => event.seq)).toEqual(rows.map((_, index) => index + 1));
      }

      const rows = await eventRows(server.pool, gameId);
      const fingerprints = rows.map((event) =>
        JSON.stringify([event.kind, event.at, event.payload]),
      );
      expect(new Set(fingerprints).size).toBe(fingerprints.length);

      // O que o jogador lê pela API é o mesmo que está no banco, sem repetição.
      const listed = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
        token: player.token,
      });
      expect(listed.body.events.map((event) => [event.seq, event.type])).toEqual(
        rows.map((event) => [event.seq, event.kind]),
      );

      const { rows: commandSeqs } = await server.pool.query<{ seq: number }>(
        'select seq::int as seq from commands where game_id = $1 order by seq',
        [gameId],
      );
      expect(commandSeqs.map((row) => row.seq)).toEqual(
        Array.from({ length: rounds }, (_, index) => index + 1),
      );

      // A versão persistida é a que a API mostra, e cada comando contou uma única vez.
      const final = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, {
        token: player.token,
      });
      const persisted = await gameRow(server.pool, gameId);
      expect(final.body.stateVersion).toBe(persisted.stateVersion);
      expect(Number(persisted.stateVersion)).toBeGreaterThanOrEqual(1 + rounds);
      expect(Number(persisted.stateVersion)).toBeLessThanOrEqual(1 + 2 * rounds);
    });
  });

  describe('exclusão em duas etapas', () => {
    /** Conta a excluir e conta de controle, as duas com dados nas sete tabelas. */
    async function scenario() {
      const target = await busyPlayer(server, 'Vai embora');
      const control = await busyPlayer(server, 'Fica');
      clock.advance(GAME_DAY);
      for (const player of [target, control]) {
        const token = await renew(server, player);
        const view = await call(server, 'GET', `/games/${player.game.id}/view`, { token });
        expect(view.status).toBe(200);
        // As Crônicas só ganham linhas na v0.4: aqui entram por SQL, para cobrir a sétima tabela.
        await insertChronicle(server.pool, player.game.id, clock.now());
      }
      const { rows: sessions } = await server.pool.query<{ id: string }>(
        'select id from sessions where account_id = $1',
        [target.accountId],
      );
      return { target, control, targetSessionIds: sessions.map((row) => row.id) };
    }

    async function expectTargetGone(target: Player, sessionIds: string[]): Promise<void> {
      const { pool } = server;
      const gameId = `'${target.game.id}'`;
      const sessions = sessionIds.map((id) => `'${id}'`).join(', ');
      expect(await countRows(pool, 'accounts', `id = '${target.accountId}'`)).toBe(0);
      expect(await countRows(pool, 'sessions', `account_id = '${target.accountId}'`)).toBe(0);
      expect(await countRows(pool, 'refresh_tokens', `session_id in (${sessions})`)).toBe(0);
      expect(await countRows(pool, 'games', `account_id = '${target.accountId}'`)).toBe(0);
      expect(await countRows(pool, 'commands', `account_id = '${target.accountId}'`)).toBe(0);
      expect(await countRows(pool, 'commands', `game_id = ${gameId}`)).toBe(0);
      expect(await countRows(pool, 'game_events', `game_id = ${gameId}`)).toBe(0);
      expect(await countRows(pool, 'chronicles', `game_id = ${gameId}`)).toBe(0);
    }

    it('nega o acesso na hora, mas os registros internos continuam no banco', async () => {
      const { target, control } = await scenario();
      const before = await rowsOfAccount(server.pool, target.accountId);
      for (const table of TABLES) {
        expect(before[table], table).toBeGreaterThan(0);
      }

      const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: target.token,
      });
      expect(deleted.status).toBe(202);
      expect(deleted.body.deletedAt).toBe(clock.now().toISOString());
      expect(new Date(deleted.body.purgeAfter).getTime()).toBe(
        new Date(deleted.body.deletedAt).getTime() + 7 * DAY,
      );

      // Inacessível por qualquer credencial, também na outra instância.
      const path = `/games/${target.game.id}/view`;
      expect((await call(server, 'GET', '/me', { token: target.token })).status).toBe(401);
      expect((await call(replica, 'GET', path, { token: target.token })).status).toBe(401);
      const refreshed = await call(replica, 'POST', '/auth/refresh', {
        body: { refreshToken: target.refreshToken },
      });
      expect(refreshed.status).toBe(401);

      // O banco interno ainda contém tudo: a retenção de sete dias é operacional.
      expect(await rowsOfAccount(server.pool, target.accountId)).toEqual(before);
      expect(
        await countRows(
          server.pool,
          'accounts',
          `id = '${target.accountId}' and deleted_at is not null`,
        ),
      ).toBe(1);

      // O job rodando logo em seguida não remove nada.
      const report = await runJobsOnce(server.ctx);
      expect(report).toMatchObject({ ran: true, purgedAccounts: 0 });
      expect(await rowsOfAccount(server.pool, target.accountId)).toEqual(before);

      // A conta de controle segue jogando.
      expect((await call(server, 'GET', '/me', { token: control.token })).status).toBe(200);
    });

    it('antes de sete dias nada é removido; exatamente no prazo, some das sete tabelas', async () => {
      const { target, control, targetSessionIds } = await scenario();
      const before = await rowsOfAccount(server.pool, target.accountId);
      const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: target.token,
      });
      expect(deleted.status).toBe(202);
      const deletedAt = new Date(deleted.body.deletedAt).getTime();
      const purgeAfter = new Date(deleted.body.purgeAfter).getTime();
      expect(purgeAfter).toBe(deletedAt + 7 * DAY);

      // Um segundo antes do prazo: tanto o job isolado quanto a rodada completa preservam tudo.
      clock.set(new Date(purgeAfter - SECOND));
      expect((await purgeAccounts(server.ctx)).accounts).toBe(0);
      expect(await runJobsOnce(server.ctx)).toMatchObject({ ran: true, purgedAccounts: 0 });
      expect(await rowsOfAccount(server.pool, target.accountId)).toEqual(before);

      // Exatamente no prazo (`now = deletedAt + 7 dias`): hard delete em cascata.
      clock.set(new Date(purgeAfter));
      const controlBefore = await dumpAccount(server.pool, control.accountId);
      for (const table of TABLES) {
        expect(controlBefore[table].length, table).toBeGreaterThan(0);
      }
      const purge = await purgeAccounts(server.ctx);
      expect(purge.accounts).toBe(1);

      await expectTargetGone(target, targetSessionIds);

      // A conta de controle fica intacta, linha por linha, e é tudo o que resta no banco.
      const controlAfter = await dumpAccount(server.pool, control.accountId);
      expect(controlAfter).toEqual(controlBefore);
      const remaining = await totals(server.pool);
      for (const table of TABLES) {
        expect(remaining[table], table).toBe(controlBefore[table].length);
      }

      // E continua utilizável: a sessão de 30 dias ainda vale.
      const token = await renew(server, control);
      const view = await call<ViewResponse>(server, 'GET', `/games/${control.game.id}/view`, {
        token,
      });
      expect(view.status).toBe(200);
    });

    it('a rodada completa dos jobs também expurga no prazo, e reexecutar é idempotente', async () => {
      const { target, control, targetSessionIds } = await scenario();
      const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', {
        token: target.token,
      });
      const purgeAfter = new Date(deleted.body.purgeAfter).getTime();
      const controlCommands = (await dumpAccount(server.pool, control.accountId)).commands;

      clock.set(new Date(purgeAfter));
      const first = await runJobsOnce(server.ctx);
      expect(first).toMatchObject({ ran: true, purgedAccounts: 1 });
      await expectTargetGone(target, targetSessionIds);

      const afterFirst = await dumpAccount(server.pool, control.accountId);
      const second = await runJobsOnce(replica.ctx);
      expect(second).toMatchObject({ ran: true, purgedAccounts: 0, advanced: 0, events: 0 });
      expect(await purgeAccounts(server.ctx)).toMatchObject({ accounts: 0 });
      expect(await dumpAccount(server.pool, control.accountId)).toEqual(afterFirst);

      // A conta de controle manteve conta, sessão, histórico de refresh, partida, recibos e
      // Crônica; os eventos só podem ter crescido (o job avançou a partida dela).
      expect(afterFirst.accounts).toHaveLength(1);
      expect(afterFirst.sessions).toHaveLength(1);
      expect(afterFirst.refresh_tokens).toHaveLength(2);
      expect(afterFirst.games).toHaveLength(1);
      expect(afterFirst.commands).toEqual(controlCommands);
      expect(afterFirst.chronicles).toHaveLength(1);
      expect(afterFirst.game_events.length).toBeGreaterThan(0);
      await expectTargetGone(target, targetSessionIds);
    });

    it('recupera o atraso depois de uma indisponibilidade: expurga contas vencidas há mais tempo', async () => {
      const { target, control, targetSessionIds } = await scenario();
      await call<DeleteMeResponse>(server, 'DELETE', '/me', { token: target.token });

      // O job ficou fora do ar e só volta dez dias depois.
      clock.advance(10 * DAY);
      expect((await purgeAccounts(server.ctx)).accounts).toBe(1);
      await expectTargetGone(target, targetSessionIds);
      expect(await countRows(server.pool, 'accounts', `id = '${control.accountId}'`)).toBe(1);
    });
  });

  describe('histórico de refresh e recibos', () => {
    it('sessão válida mantém todos os hashes depois de várias rotações e do job', async () => {
      const player = await newPlayer(server);
      const firstRefreshToken = player.refreshToken;
      const rotations = 6;
      for (let index = 0; index < rotations; index += 1) {
        clock.advance(20 * MINUTE);
        await renew(server, player);
      }
      const mine = ownedBy(player.accountId).refresh_tokens;
      expect(await countRows(server.pool, 'refresh_tokens', mine)).toBe(rotations + 1);

      // Vários dias de jobs, sempre dentro dos 30 dias da sessão.
      for (const elapsed of [HOUR, DAY, 8 * DAY, 20 * DAY]) {
        clock.advance(elapsed);
        expect(await runJobsOnce(server.ctx)).toMatchObject({ ran: true, expiredSessions: 0 });
      }
      expect(await countRows(server.pool, 'refresh_tokens', mine)).toBe(rotations + 1);
      expect(
        await countRows(server.pool, 'refresh_tokens', `${mine} and used_at is not null`),
      ).toBe(rotations);
      expect(await countRows(server.pool, 'sessions', `account_id = '${player.accountId}'`)).toBe(
        1,
      );

      // O histórico continua servindo ao que ele existe: o token atual ainda roda, e o reuso do
      // antecessor mais antigo, mesmo após várias rotações e do job, revoga a família.
      await renew(server, player);
      expect(await countRows(server.pool, 'refresh_tokens', mine)).toBe(rotations + 2);
      const reused = await call<{ code: string }>(server, 'POST', '/auth/refresh', {
        body: { refreshToken: firstRefreshToken },
      });
      expect(reused.status).toBe(401);
      expect(reused.body.code).toBe('SESSION_REVOKED');
    });

    it('sessão com a validade absoluta vencida pode ter o histórico limpo; a válida, não', async () => {
      const old = await newPlayer(server, 'Sessão antiga');
      for (let index = 0; index < 3; index += 1) {
        clock.advance(20 * MINUTE);
        await renew(server, old);
      }
      clock.advance(29 * DAY);
      const fresh = await newPlayer(server, 'Sessão nova');
      for (let index = 0; index < 3; index += 1) {
        clock.advance(20 * MINUTE);
        await renew(server, fresh);
      }
      const oldTokens = ownedBy(old.accountId).refresh_tokens;
      const freshTokens = ownedBy(fresh.accountId).refresh_tokens;

      // Aos 29 dias e pouco a sessão antiga ainda vale: o job não apaga nenhum antecessor.
      expect(await runJobsOnce(server.ctx)).toMatchObject({ ran: true, expiredSessions: 0 });
      expect(await countRows(server.pool, 'refresh_tokens', oldTokens)).toBe(4);
      expect(await countRows(server.pool, 'refresh_tokens', freshTokens)).toBe(4);

      // Passados os 30 dias da sessão antiga, o histórico dela pode ir embora.
      clock.advance(DAY);
      const report = await runJobsOnce(server.ctx);
      expect(report).toMatchObject({ ran: true, expiredSessions: 1, purgedAccounts: 0 });
      expect(await countRows(server.pool, 'refresh_tokens', oldTokens)).toBe(0);
      // A sessão nova, ainda válida, mantém o histórico inteiro.
      expect(await countRows(server.pool, 'refresh_tokens', freshTokens)).toBe(4);
      // Expirar a sessão não apaga a conta nem a partida.
      expect(await countRows(server.pool, 'accounts', `id = '${old.accountId}'`)).toBe(1);
      expect(await countRows(server.pool, 'games', `account_id = '${old.accountId}'`)).toBe(1);
      // O token da sessão vencida não volta a valer.
      const refreshed = await call(server, 'POST', '/auth/refresh', {
        body: { refreshToken: old.refreshToken },
      });
      expect(refreshed.status).toBe(401);
    });

    it('recibos de comandos não são expurgados por idade', async () => {
      const player = await busyPlayer(server, 'Paciente');
      const archivedId = player.game.id;
      const current = await startGame(server, player.token, { replaceActive: true });
      const accepted = await send(
        server,
        player.token,
        current.id,
        order('setWorkers', { building: 'farm', count: 1 }),
      );
      expect(accepted.status).toBe(200);
      const before = (await dumpAccount(server.pool, player.accountId)).commands;
      expect(before).toHaveLength(3);
      expect(await countRows(server.pool, 'commands', `game_id = '${archivedId}'`)).toBe(2);

      clock.advance(100 * DAY);
      const report = await runJobsOnce(server.ctx);
      expect(report).toMatchObject({ ran: true, purgedAccounts: 0 });

      // Partida ativa ou arquivada: os recibos continuam lá, idênticos.
      expect((await dumpAccount(server.pool, player.accountId)).commands).toEqual(before);
      expect(await countRows(server.pool, 'games', `account_id = '${player.accountId}'`)).toBe(2);
    });
  });

  describe('relatório do job', () => {
    it('traz só contagens: nenhum nome, id ou token', async () => {
      const gone = await busyPlayer(server, 'Dom Sigiloso de Tal');
      const stays = await busyPlayer(server, 'Dona Reservada da Silva');
      await call(server, 'DELETE', '/me', { token: gone.token });
      clock.advance(7 * DAY);

      const report = await runJobsOnce(server.ctx);
      if (!report.ran) {
        throw new Error('O job deveria ter executado');
      }
      expect(Object.keys(report).sort()).toEqual([
        'advanced',
        'events',
        'expiredSessions',
        'failed',
        'purgedAccounts',
        'ran',
      ]);
      const { ran, ...counts } = report;
      expect(ran).toBe(true);
      for (const [name, value] of Object.entries(counts)) {
        expect(Number.isInteger(value), name).toBe(true);
        expect(value, name).toBeGreaterThanOrEqual(0);
      }
      expect(report.purgedAccounts).toBe(1);
      expect(report.advanced).toBe(1);

      const text = JSON.stringify(report);
      const secrets = [
        gone.accountId,
        stays.accountId,
        gone.game.id,
        stays.game.id,
        gone.token,
        stays.token,
        gone.refreshToken,
        stays.refreshToken,
        'Sigiloso',
        'Reservada',
        'Pedra Alta',
      ];
      for (const secret of secrets) {
        expect(text).not.toContain(secret);
      }

      // Os jobs isolados também só devolvem números.
      clock.advance(GAME_DAY);
      for (const partial of [
        await advanceStaleGames(server.ctx),
        await purgeAccounts(server.ctx),
      ]) {
        for (const value of Object.values(partial)) {
          expect(typeof value).toBe('number');
        }
      }
    });
  });
});
