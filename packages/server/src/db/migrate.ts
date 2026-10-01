import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Pool } from 'pg';

/** Chave do advisory lock que serializa as migrações entre réplicas da API. */
const MIGRATION_LOCK = 727;

/**
 * Localiza `deploy/migrations` subindo a partir deste arquivo: funciona no código-fonte
 * (packages/server/src/db), no bundle (dist/) e na imagem (/app/dist).
 */
export function findMigrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) {
    return resolve(process.env.MIGRATIONS_DIR);
  }
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, 'deploy', 'migrations');
    if (existsSync(join(candidate, 'meta', '_journal.json'))) {
      return candidate;
    }
    dir = dirname(dir);
  }
  throw new Error('Pasta deploy/migrations não encontrada. Defina MIGRATIONS_DIR.');
}

/**
 * Aplica as migrações pendentes. Idempotente e segura com várias réplicas subindo juntas:
 * quem chega depois espera o lock e encontra tudo já aplicado.
 */
export async function runMigrations(pool: Pool, folder = findMigrationsFolder()): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('select pg_advisory_lock($1)', [MIGRATION_LOCK]);
    try {
      await migrate(drizzle(client), { migrationsFolder: folder });
    } finally {
      await client.query('select pg_advisory_unlock($1)', [MIGRATION_LOCK]);
    }
  } finally {
    client.release();
  }
}
