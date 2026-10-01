import type { FastifyInstance } from 'fastify';

import { buildApp } from '../../../packages/server/src/app';
import { testConfig } from '../../../packages/server/test/helpers/app';
import { createTestPool, resetTestDb, truncateAll } from '../../../packages/server/test/helpers/db';

/**
 * A API de verdade para as capturas de tela da página de apresentação. É o servidor dos testes
 * em navegador (tests/e2e/server.ts) com duas diferenças, para a captura mostrar o que um
 * jogador novo vê em produção: o ritmo é o do servidor (ADR 0011), e não o do GDD, e o vínculo
 * GitHub fica desligado. Nada disto está no código de produção.
 */

process.env.TEST_DATABASE_URL ??= 'postgres://lotg:lotg@localhost:5433/lotg_test';

const PORT = Number(process.env.CAPTURE_API_PORT ?? 3190);

let offsetMs = 0;
const clock = () => new Date(Date.now() + offsetMs);

await resetTestDb();
const pool = createTestPool();
const { app } = await buildApp({
  config: testConfig({ PUBLIC_URL: `http://localhost:${PORT}`, GAME_TIME_SCALE: '3' }),
  pool,
  clock,
  logger: false,
});

// As rotas de controle ficam fora de `/v1`: o app nunca as alcança pelo repasse.
const control = app as unknown as FastifyInstance;

control.post('/__test/reset', async () => {
  await truncateAll(pool);
  offsetMs = 0;
  return { ok: true };
});

/** Adianta o relógio do servidor. A captura adianta o do navegador na mesma medida. */
control.post('/__test/advance', async (request) => {
  const { ms } = request.body as { ms: number };
  offsetMs += ms;
  return { now: clock().toISOString() };
});

await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`API das capturas em http://127.0.0.1:${PORT}`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void app
      .close()
      .then(() => pool.end())
      .finally(() => process.exit(0));
  });
}
