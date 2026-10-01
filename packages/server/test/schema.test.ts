import { randomUUID } from 'node:crypto';

import type pg from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runMigrations } from '../src/db/migrate';
import { countRows } from './helpers/app';
import { createTestPool, resetTestDb, truncateAll } from './helpers/db';

// Verificação independente da F2-T3: tudo aqui vem do GDD §14.6 e do MVP-ROADMAP (F2-T3),
// inserindo linhas direto por SQL, sem passar pela API.

const TABLES = [
  'accounts',
  'sessions',
  'refresh_tokens',
  'games',
  'commands',
  'game_events',
  'chronicles',
] as const;

const UNIQUE_VIOLATION = '23505';
const NOT_NULL_VIOLATION = '23502';

const NOW = '2026-10-01T12:00:00.000Z';

/** Executa a consulta e devolve o SQLSTATE do erro, ou `null` se ela passou. */
async function sqlState(run: () => Promise<unknown>): Promise<string | null> {
  try {
    await run();
    return null;
  } catch (error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code !== 'string') {
      throw error;
    }
    return code;
  }
}

async function insertAccount(
  pool: pg.Pool,
  fields: { githubId?: string | null; recoveryCodeHash?: string | null } = {},
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into accounts (id, display_name, github_id, recovery_code_hash, created_at, last_seen_at)
     values ($1, 'Teste', $2, $3, $4, $4)`,
    [id, fields.githubId ?? null, fields.recoveryCodeHash ?? null, NOW],
  );
  return id;
}

async function insertSession(pool: pg.Pool, accountId: string): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into sessions (id, account_id, device_label, created_at, expires_at)
     values ($1, $2, 'máquina', $3, $3::timestamptz + interval '30 days')`,
    [id, accountId, NOW],
  );
  return id;
}

async function insertRefreshToken(
  pool: pg.Pool,
  sessionId: string,
  used: boolean,
  tokenHash: string = randomUUID(),
): Promise<string> {
  await pool.query(
    `insert into refresh_tokens (token_hash, session_id, created_at, used_at)
     values ($1, $2, $3, $4)`,
    [tokenHash, sessionId, NOW, used ? NOW : null],
  );
  return tokenHash;
}

async function insertGame(
  pool: pg.Pool,
  accountId: string,
  status: 'active' | 'archived',
): Promise<string> {
  const id = randomUUID();
  await pool.query(
    `insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                        schema_version, state, state_version, last_processed_at, created_at, updated_at)
     values ($1, $2, $3, 'semente', 'normal', 1, 'America/Sao_Paulo', 20, 1, '{}'::jsonb, 1, $4, $4, $4)`,
    [id, accountId, status, NOW],
  );
  return id;
}

type CommandFields = {
  gameId: string;
  accountId: string;
  id?: string;
  seq: number;
  requestHash?: string | null;
  responseStatus?: number | null;
  responseBody?: string | null;
  result?: string | null;
  errorCode?: string | null;
};

async function insertCommand(pool: pg.Pool, fields: CommandFields): Promise<string> {
  const id = fields.id ?? randomUUID();
  const value = <T>(given: T | null | undefined, fallback: T): T | null =>
    given === undefined ? fallback : given;
  await pool.query(
    `insert into commands (game_id, id, account_id, seq, type, payload, request_hash, server_time,
                           result, error_code, response_status, response_body)
     values ($1, $2, $3, $4, 'setWorkers', '{}'::jsonb, $5, $6, $7, $8, $9, $10::jsonb)`,
    [
      fields.gameId,
      id,
      fields.accountId,
      fields.seq,
      value(fields.requestHash, 'a'.repeat(64)),
      NOW,
      value(fields.result, 'accepted'),
      fields.errorCode ?? null,
      value(fields.responseStatus, 200),
      value(fields.responseBody, '{}'),
    ],
  );
  return id;
}

async function insertEvent(pool: pg.Pool, gameId: string, seq: number): Promise<void> {
  await pool.query(
    `insert into game_events (game_id, seq, at, kind, payload)
     values ($1, $2, $3, 'dayStarted', '{"atMs":0,"text":"","data":{}}'::jsonb)`,
    [gameId, seq, NOW],
  );
}

async function insertChronicle(pool: pg.Pool, gameId: string, year: number): Promise<void> {
  await pool.query(
    `insert into chronicles (game_id, year, summary, score, result, created_at)
     values ($1, $2, '{}'::jsonb, 100, 'survived', $3)`,
    [gameId, year, NOW],
  );
}

/** Conta completa: sessões, histórico de refresh, partidas, comandos, eventos e Crônicas. */
async function insertFullAccount(pool: pg.Pool) {
  const accountId = await insertAccount(pool, {
    githubId: randomUUID(),
    recoveryCodeHash: randomUUID(),
  });
  const sessionIds = [await insertSession(pool, accountId), await insertSession(pool, accountId)];
  for (const sessionId of sessionIds) {
    await insertRefreshToken(pool, sessionId, true);
    await insertRefreshToken(pool, sessionId, true);
    await insertRefreshToken(pool, sessionId, false);
  }
  const gameIds = [
    await insertGame(pool, accountId, 'active'),
    await insertGame(pool, accountId, 'archived'),
  ];
  for (const gameId of gameIds) {
    await insertCommand(pool, { gameId, accountId, seq: 1 });
    await insertCommand(pool, {
      gameId,
      accountId,
      seq: 2,
      result: 'rejected',
      errorCode: 'GAME_RULE',
      responseStatus: 422,
    });
    await insertEvent(pool, gameId, 1);
    await insertEvent(pool, gameId, 2);
    await insertChronicle(pool, gameId, 1);
  }
  return { accountId, sessionIds, gameIds };
}

/** Quantas linhas de cada uma das sete tabelas pertencem à conta. */
async function rowsOfAccount(pool: pg.Pool, accountId: string): Promise<Record<string, number>> {
  const mine = `'${accountId}'`;
  const myGames = `(select id from games where account_id = ${mine})`;
  return {
    accounts: await countRows(pool, 'accounts', `id = ${mine}`),
    sessions: await countRows(pool, 'sessions', `account_id = ${mine}`),
    refresh_tokens: await countRows(
      pool,
      'refresh_tokens',
      `session_id in (select id from sessions where account_id = ${mine})`,
    ),
    games: await countRows(pool, 'games', `account_id = ${mine}`),
    commands: await countRows(pool, 'commands', `account_id = ${mine}`),
    game_events: await countRows(pool, 'game_events', `game_id in ${myGames}`),
    chronicles: await countRows(pool, 'chronicles', `game_id in ${myGames}`),
  };
}

describe('esquema do banco (F2-T3, GDD §14.6)', () => {
  let pool: pg.Pool;

  beforeAll(async () => {
    await resetTestDb();
    pool = createTestPool();
  });
  afterAll(async () => {
    await pool.end();
  });

  describe('tabelas e migração', () => {
    it('cria as sete tabelas do GDD e a tabela de controle do Drizzle', async () => {
      const { rows } = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
      );
      expect(rows.map((row) => row.table_name)).toEqual([...TABLES].sort());

      const control = await pool.query<{ table_schema: string; table_name: string }>(
        `select table_schema, table_name from information_schema.tables
         where table_name = '__drizzle_migrations'`,
      );
      expect(control.rows).toHaveLength(1);
      expect(await countRows(pool, `"${control.rows[0]?.table_schema}".__drizzle_migrations`)).toBe(
        1,
      );
    });

    it('aplicar a migração de novo não dá erro nem registra a migração duas vezes', async () => {
      await insertAccount(pool);
      await expect(runMigrations(pool)).resolves.toBeUndefined();
      await expect(runMigrations(pool)).resolves.toBeUndefined();
      expect(await countRows(pool, 'drizzle.__drizzle_migrations')).toBe(1);
      // Os dados que já estavam lá não são perdidos.
      expect(await countRows(pool, 'accounts')).toBe(1);
      await truncateAll(pool);
    });

    it('dois processos migrando ao mesmo tempo um banco vazio terminam sem erro', async () => {
      await pool.query('drop schema if exists public cascade');
      await pool.query('drop schema if exists drizzle cascade');
      await pool.query('create schema public');

      const first = createTestPool();
      const second = createTestPool();
      try {
        const outcomes = await Promise.allSettled([runMigrations(first), runMigrations(second)]);
        expect(outcomes.map((outcome) => outcome.status)).toEqual(['fulfilled', 'fulfilled']);
      } finally {
        await first.end();
        await second.end();
      }

      const { rows } = await pool.query<{ table_name: string }>(
        `select table_name from information_schema.tables
         where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
      );
      expect(rows.map((row) => row.table_name)).toEqual([...TABLES].sort());
      expect(await countRows(pool, 'drizzle.__drizzle_migrations')).toBe(1);
    });
  });

  describe('unicidade e índices', () => {
    beforeEach(async () => {
      await truncateAll(pool);
    });

    it('comando é único por (game_id, id), e o mesmo id vale em outra partida', async () => {
      const accountId = await insertAccount(pool);
      const gameA = await insertGame(pool, accountId, 'active');
      const gameB = await insertGame(pool, accountId, 'archived');
      const commandId = await insertCommand(pool, { gameId: gameA, accountId, seq: 1 });

      const repeated = await sqlState(() =>
        insertCommand(pool, { gameId: gameA, accountId, id: commandId, seq: 2 }),
      );
      expect(repeated).toBe(UNIQUE_VIOLATION);

      // O escopo do commandId é a partida: outra partida aceita o mesmo UUID.
      const elsewhere = await sqlState(() =>
        insertCommand(pool, { gameId: gameB, accountId, id: commandId, seq: 1 }),
      );
      expect(elsewhere).toBeNull();
      expect(await countRows(pool, 'commands')).toBe(2);
    });

    it('a sequência de comandos é única por partida', async () => {
      const accountId = await insertAccount(pool);
      const gameA = await insertGame(pool, accountId, 'active');
      const gameB = await insertGame(pool, accountId, 'archived');
      await insertCommand(pool, { gameId: gameA, accountId, seq: 1 });

      expect(await sqlState(() => insertCommand(pool, { gameId: gameA, accountId, seq: 1 }))).toBe(
        UNIQUE_VIOLATION,
      );
      expect(
        await sqlState(() => insertCommand(pool, { gameId: gameA, accountId, seq: 2 })),
      ).toBeNull();
      expect(
        await sqlState(() => insertCommand(pool, { gameId: gameB, accountId, seq: 1 })),
      ).toBeNull();
    });

    it('game_events tem chave primária (game_id, seq)', async () => {
      const accountId = await insertAccount(pool);
      const gameA = await insertGame(pool, accountId, 'active');
      const gameB = await insertGame(pool, accountId, 'archived');
      await insertEvent(pool, gameA, 1);

      expect(await sqlState(() => insertEvent(pool, gameA, 1))).toBe(UNIQUE_VIOLATION);
      expect(await sqlState(() => insertEvent(pool, gameA, 2))).toBeNull();
      expect(await sqlState(() => insertEvent(pool, gameB, 1))).toBeNull();

      const { rows } = await pool.query<{ columns: string[] }>(
        `select array_agg(a.attname::text order by k.ord) as columns
         from pg_constraint c
         cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
         where c.conrelid = 'game_events'::regclass and c.contype = 'p'`,
      );
      expect(rows[0]?.columns).toEqual(['game_id', 'seq']);
    });

    it('chaves primárias compostas e simples batem com o GDD', async () => {
      const { rows } = await pool.query<{ table_name: string; columns: string[] }>(
        `select c.conrelid::regclass::text as table_name,
                array_agg(a.attname::text order by k.ord) as columns
         from pg_constraint c
         cross join lateral unnest(c.conkey) with ordinality as k(attnum, ord)
         join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
         where c.contype = 'p' and c.connamespace = 'public'::regnamespace
         group by c.conrelid`,
      );
      const primaryKeys = Object.fromEntries(rows.map((row) => [row.table_name, row.columns]));
      expect(primaryKeys).toEqual({
        accounts: ['id'],
        sessions: ['id'],
        refresh_tokens: ['token_hash'],
        games: ['id'],
        commands: ['game_id', 'id'],
        game_events: ['game_id', 'seq'],
        chronicles: ['game_id', 'year'],
      });
    });

    it('permite no máximo uma partida ativa por conta, e várias arquivadas', async () => {
      const accountId = await insertAccount(pool);
      const other = await insertAccount(pool);
      await insertGame(pool, accountId, 'active');

      expect(await sqlState(() => insertGame(pool, accountId, 'active'))).toBe(UNIQUE_VIOLATION);
      expect(await sqlState(() => insertGame(pool, accountId, 'archived'))).toBeNull();
      expect(await sqlState(() => insertGame(pool, accountId, 'archived'))).toBeNull();
      // Outra conta tem a sua própria partida ativa.
      expect(await sqlState(() => insertGame(pool, other, 'active'))).toBeNull();

      // Reativar uma arquivada enquanto há outra ativa também esbarra no índice.
      const reactivated = await sqlState(() =>
        pool.query(`update games set status = 'active' where account_id = $1`, [accountId]),
      );
      expect(reactivated).toBe(UNIQUE_VIOLATION);
    });

    it('permite no máximo um refresh token não utilizado por sessão, e vários utilizados', async () => {
      const accountId = await insertAccount(pool);
      const sessionA = await insertSession(pool, accountId);
      const sessionB = await insertSession(pool, accountId);

      await insertRefreshToken(pool, sessionA, true);
      await insertRefreshToken(pool, sessionA, true);
      await insertRefreshToken(pool, sessionA, true);
      await insertRefreshToken(pool, sessionA, false);

      expect(await sqlState(() => insertRefreshToken(pool, sessionA, false))).toBe(
        UNIQUE_VIOLATION,
      );
      // Outra sessão (outra família) tem o seu próprio token não utilizado.
      expect(await sqlState(() => insertRefreshToken(pool, sessionB, false))).toBeNull();
      expect(await countRows(pool, 'refresh_tokens', `session_id = '${sessionA}'`)).toBe(4);
    });

    it('o hash do refresh token é chave primária', async () => {
      const accountId = await insertAccount(pool);
      const sessionA = await insertSession(pool, accountId);
      const sessionB = await insertSession(pool, accountId);
      const hash = await insertRefreshToken(pool, sessionA, true);

      expect(await sqlState(() => insertRefreshToken(pool, sessionB, true, hash))).toBe(
        UNIQUE_VIOLATION,
      );
    });

    it('accounts.github_id é único, com vários nulos permitidos', async () => {
      await insertAccount(pool, { githubId: '4242' });
      expect(await sqlState(() => insertAccount(pool, { githubId: '4242' }))).toBe(
        UNIQUE_VIOLATION,
      );
      expect(await sqlState(() => insertAccount(pool, { githubId: '4343' }))).toBeNull();
      expect(await sqlState(() => insertAccount(pool, { githubId: null }))).toBeNull();
      expect(await sqlState(() => insertAccount(pool, { githubId: null }))).toBeNull();
      expect(await countRows(pool, 'accounts', 'github_id is null')).toBe(2);
    });

    it('accounts.recovery_code_hash é único, com vários nulos permitidos', async () => {
      const hash = 'b'.repeat(64);
      await insertAccount(pool, { recoveryCodeHash: hash });
      expect(await sqlState(() => insertAccount(pool, { recoveryCodeHash: hash }))).toBe(
        UNIQUE_VIOLATION,
      );
      expect(
        await sqlState(() => insertAccount(pool, { recoveryCodeHash: 'c'.repeat(64) })),
      ).toBeNull();
      expect(await sqlState(() => insertAccount(pool, { recoveryCodeHash: null }))).toBeNull();
      expect(await sqlState(() => insertAccount(pool, { recoveryCodeHash: null }))).toBeNull();
      expect(await countRows(pool, 'accounts', 'recovery_code_hash is null')).toBe(2);
    });

    it('existem os índices de consulta pedidos na F2-T3.2', async () => {
      const { rows } = await pool.query<{ tablename: string; indexdef: string }>(
        `select tablename, indexdef from pg_indexes where schemaname = 'public'`,
      );
      const has = (table: string, pattern: RegExp) =>
        rows.some((row) => row.tablename === table && pattern.test(row.indexdef));

      // games(last_processed_at) where status = 'active': a consulta do job horário.
      expect(has('games', /\(last_processed_at\) WHERE \(?status = 'active'/)).toBe(true);
      expect(has('games', /UNIQUE INDEX .*\(account_id\) WHERE \(?status = 'active'/)).toBe(true);
      expect(has('sessions', /\(account_id\)/)).toBe(true);
      expect(has('refresh_tokens', /^CREATE INDEX .*\(session_id\)$/)).toBe(true);
      expect(has('refresh_tokens', /UNIQUE INDEX .*\(session_id\) WHERE \(?used_at IS NULL/)).toBe(
        true,
      );
      expect(has('accounts', /\(deleted_at\)/)).toBe(true);
      expect(has('commands', /UNIQUE INDEX .*\(game_id, seq\)/)).toBe(true);
    });
  });

  describe('recibo de comando obrigatório', () => {
    beforeEach(async () => {
      await truncateAll(pool);
    });

    it.each([
      ['request_hash', { requestHash: null }],
      ['response_status', { responseStatus: null }],
      ['response_body', { responseBody: null }],
      ['result', { result: null }],
    ] as const)('commands.%s não aceita nulo', async (column, missing) => {
      const accountId = await insertAccount(pool);
      const gameId = await insertGame(pool, accountId, 'active');

      let failure: { code?: string; column?: string } | null = null;
      try {
        await insertCommand(pool, { gameId, accountId, seq: 1, ...missing });
      } catch (error) {
        failure = error as { code?: string; column?: string };
      }
      expect(failure?.code).toBe(NOT_NULL_VIOLATION);
      expect(failure?.column).toBe(column);
      expect(await countRows(pool, 'commands')).toBe(0);
    });

    it('error_code é opcional: um comando aceito não tem código de erro', async () => {
      const accountId = await insertAccount(pool);
      const gameId = await insertGame(pool, accountId, 'active');
      expect(
        await sqlState(() => insertCommand(pool, { gameId, accountId, seq: 1, errorCode: null })),
      ).toBeNull();
    });

    it('as colunas do recibo são NOT NULL no catálogo', async () => {
      const { rows } = await pool.query<{ column_name: string; is_nullable: string }>(
        `select column_name, is_nullable from information_schema.columns
         where table_schema = 'public' and table_name = 'commands'`,
      );
      const nullable = Object.fromEntries(rows.map((row) => [row.column_name, row.is_nullable]));
      expect(nullable).toMatchObject({
        request_hash: 'NO',
        response_status: 'NO',
        response_body: 'NO',
        result: 'NO',
        error_code: 'YES',
      });
    });
  });

  describe('cascatas', () => {
    beforeEach(async () => {
      await truncateAll(pool);
    });

    it('toda chave estrangeira de propriedade usa ON DELETE CASCADE', async () => {
      const { rows } = await pool.query<{ child: string; parent: string; rule: string }>(
        `select conrelid::regclass::text as child, confrelid::regclass::text as parent,
                confdeltype::text as rule
         from pg_constraint
         where contype = 'f' and connamespace = 'public'::regnamespace
         order by 1, 2`,
      );
      // conta → sessões → refresh tokens; conta → partidas → comandos/eventos/Crônicas;
      // conta → comandos. No catálogo, 'c' é CASCADE.
      expect(rows).toEqual([
        { child: 'chronicles', parent: 'games', rule: 'c' },
        { child: 'commands', parent: 'accounts', rule: 'c' },
        { child: 'commands', parent: 'games', rule: 'c' },
        { child: 'game_events', parent: 'games', rule: 'c' },
        { child: 'games', parent: 'accounts', rule: 'c' },
        { child: 'refresh_tokens', parent: 'sessions', rule: 'c' },
        { child: 'sessions', parent: 'accounts', rule: 'c' },
      ]);
    });

    it('apagar uma conta remove tudo o que é dela e não toca na conta de controle', async () => {
      const target = await insertFullAccount(pool);
      const control = await insertFullAccount(pool);

      const full = {
        accounts: 1,
        sessions: 2,
        refresh_tokens: 6,
        games: 2,
        commands: 4,
        game_events: 4,
        chronicles: 2,
      };
      expect(await rowsOfAccount(pool, target.accountId)).toEqual(full);
      expect(await rowsOfAccount(pool, control.accountId)).toEqual(full);

      const deleted = await pool.query('delete from accounts where id = $1', [target.accountId]);
      expect(deleted.rowCount).toBe(1);

      // Nada da conta apagada sobra em nenhuma das sete tabelas...
      for (const sessionId of target.sessionIds) {
        expect(await countRows(pool, 'sessions', `id = '${sessionId}'`)).toBe(0);
        expect(await countRows(pool, 'refresh_tokens', `session_id = '${sessionId}'`)).toBe(0);
      }
      for (const gameId of target.gameIds) {
        expect(await countRows(pool, 'games', `id = '${gameId}'`)).toBe(0);
        expect(await countRows(pool, 'commands', `game_id = '${gameId}'`)).toBe(0);
        expect(await countRows(pool, 'game_events', `game_id = '${gameId}'`)).toBe(0);
        expect(await countRows(pool, 'chronicles', `game_id = '${gameId}'`)).toBe(0);
      }
      expect(await countRows(pool, 'accounts', `id = '${target.accountId}'`)).toBe(0);
      expect(await countRows(pool, 'commands', `account_id = '${target.accountId}'`)).toBe(0);

      // ...e a conta de controle continua inteira: o banco só tem as linhas dela.
      expect(await rowsOfAccount(pool, control.accountId)).toEqual(full);
      for (const table of TABLES) {
        expect(await countRows(pool, table)).toBe(full[table]);
      }
    });

    it('apagar uma sessão leva só o histórico de refresh dela', async () => {
      const { accountId, sessionIds } = await insertFullAccount(pool);
      const [gone, kept] = sessionIds;

      await pool.query('delete from sessions where id = $1', [gone]);

      expect(await countRows(pool, 'refresh_tokens', `session_id = '${gone}'`)).toBe(0);
      expect(await countRows(pool, 'refresh_tokens', `session_id = '${kept}'`)).toBe(3);
      expect(await countRows(pool, 'accounts', `id = '${accountId}'`)).toBe(1);
      expect(await countRows(pool, 'games', `account_id = '${accountId}'`)).toBe(2);
    });

    it('apagar uma partida leva comandos, eventos e Crônicas só dela', async () => {
      const { accountId, gameIds } = await insertFullAccount(pool);
      const [gone, kept] = gameIds;

      await pool.query('delete from games where id = $1', [gone]);

      for (const table of ['commands', 'game_events', 'chronicles']) {
        expect(await countRows(pool, table, `game_id = '${gone}'`)).toBe(0);
      }
      expect(await countRows(pool, 'commands', `game_id = '${kept}'`)).toBe(2);
      expect(await countRows(pool, 'game_events', `game_id = '${kept}'`)).toBe(2);
      expect(await countRows(pool, 'chronicles', `game_id = '${kept}'`)).toBe(1);
      expect(await countRows(pool, 'accounts', `id = '${accountId}'`)).toBe(1);
      expect(await countRows(pool, 'sessions', `account_id = '${accountId}'`)).toBe(2);
    });
  });
});
