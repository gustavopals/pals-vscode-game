import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;
/** Transação aberta: o mesmo vocabulário de consulta do `Db`. */
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

export function createPool(databaseUrl: string): pg.Pool {
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 20,
    // Com o banco fora do ar, falhar logo: /v1/health precisa responder 503 em menos de 2 s.
    connectionTimeoutMillis: 1500,
  });
  return guardPool(pool);
}

/**
 * Se o banco cai, o `pg` emite `'error'` na conexão; sem ouvinte, o Node encerra o processo.
 * O pool só ouve as conexões ociosas, então cada conexão ganha um ouvinte próprio: a consulta
 * em andamento falha (e vira 500), mas a API continua de pé e `/v1/health` responde 503.
 */
export function guardPool(pool: pg.Pool): pg.Pool {
  pool.on('error', () => undefined);
  pool.on('connect', (client) => {
    client.on('error', () => undefined);
  });
  return pool;
}

export function createDb(pool: pg.Pool): Db {
  return drizzle(pool, { schema });
}

/** Violação de unicidade do PostgreSQL (o Drizzle pode embrulhar o erro original em `cause`). */
export function isUniqueViolation(error: unknown): boolean {
  const codeOf = (value: unknown) =>
    typeof value === 'object' && value !== null && 'code' in value ? value.code : undefined;
  return codeOf(error) === '23505' || codeOf((error as { cause?: unknown })?.cause) === '23505';
}
