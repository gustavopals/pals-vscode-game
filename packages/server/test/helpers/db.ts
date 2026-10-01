import pg from 'pg';

import { guardPool } from '../../src/db/client';
import { runMigrations } from '../../src/db/migrate';

function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error('TEST_DATABASE_URL não definida: os testes de integração precisam do db_test.');
  }
  return url;
}

/** Pool novo para o banco de teste. Cada "instância" da API nos testes usa o seu. */
export function createTestPool(): pg.Pool {
  return guardPool(new pg.Pool({ connectionString: testDatabaseUrl(), max: 20 }));
}

/**
 * Recria o banco de teste do zero: derruba os schemas e aplica as migrações.
 * Chamado no início de cada arquivo de teste de integração.
 */
export async function resetTestDb(): Promise<void> {
  const pool = createTestPool();
  try {
    await pool.query('drop schema if exists public cascade');
    await pool.query('drop schema if exists drizzle cascade');
    await pool.query('create schema public');
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

/** Esvazia todas as tabelas, mantendo o esquema. Mais rápido que recriar entre testes. */
export async function truncateAll(pool: pg.Pool): Promise<void> {
  await pool.query(
    'truncate accounts, sessions, refresh_tokens, games, commands, game_events, chronicles cascade',
  );
}
