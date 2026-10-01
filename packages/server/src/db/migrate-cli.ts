// `pnpm db:migrate`: aplica as migrações no banco de DATABASE_URL e sai.
import { createPool } from './client';
import { runMigrations } from './migrate';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL é obrigatória. Rode `pnpm secrets:gen` para criar deploy/.env.');
  process.exit(1);
}

const pool = createPool(databaseUrl);
try {
  await runMigrations(pool);
  console.log('Migrações aplicadas.');
} finally {
  await pool.end();
}
