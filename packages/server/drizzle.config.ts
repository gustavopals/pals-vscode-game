import { defineConfig } from 'drizzle-kit';

// `pnpm --filter @lotg/server db:generate -- --name <nome>` compara o esquema com as
// migrações existentes e escreve o SQL novo em deploy/migrations. Não precisa de banco.
export default defineConfig({
  dialect: 'postgresql',
  schema: './src/db/schema.ts',
  out: '../../deploy/migrations',
});
