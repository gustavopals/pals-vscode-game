import { setTimeout as sleep } from 'node:timers/promises';

import type { Pool } from 'pg';

import { buildApp } from './app';
import { ConfigError, loadConfig } from './config';
import { createPool } from './db/client';
import { runMigrations } from './db/migrate';
import { startScheduler } from './jobs/scheduler';

const MIGRATION_ATTEMPTS = 15;
const MIGRATION_RETRY_MS = 2000;

/** No arranque o banco pode ainda estar subindo: espera um pouco antes de desistir. */
async function migrateWhenDatabaseIsUp(pool: Pool): Promise<void> {
  for (let attempt = 1; ; attempt += 1) {
    try {
      await runMigrations(pool);
      return;
    } catch (error) {
      if (attempt >= MIGRATION_ATTEMPTS) {
        throw error;
      }
      console.error(`Banco indisponível (tentativa ${attempt} de ${MIGRATION_ATTEMPTS}).`);
      await sleep(MIGRATION_RETRY_MS);
    }
  }
}

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const pool = createPool(config.databaseUrl);

  await migrateWhenDatabaseIsUp(pool);
  const { app, ctx } = await buildApp({ config, pool });
  const scheduler = startScheduler(ctx, app.log);

  let closing = false;
  const shutdown = (signal: string) => {
    if (closing) {
      return;
    }
    closing = true;
    app.log.info({ signal }, 'encerrando');
    void (async () => {
      await scheduler.stop();
      await app.close();
      await pool.end();
    })().finally(() => process.exit(0));
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  await app.listen({ port: config.port, host: config.host });
}

main().catch((error: unknown) => {
  // Erros de configuração trazem só nomes de variáveis; os demais vão inteiros para o log.
  console.error(error instanceof ConfigError ? error.message : error);
  process.exit(1);
});
