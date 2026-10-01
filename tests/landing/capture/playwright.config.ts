import { resolve } from 'node:path';

import { defineConfig } from '@playwright/test';

const ROOT = resolve(import.meta.dirname, '../../..');
const API_PORT = 3190;
const GAME_PORT = 4190;
const LANDING_PORT = 4174;

/**
 * Não é uma suíte de testes: é o roteiro que refaz as capturas reais do jogo e a imagem da
 * prévia do link usadas pela página de apresentação (packages/landing/README.md). Sobe a API no
 * ritmo de produção, o app compilado e a página compilada. Usa o `db_test` (`pnpm dev:up`): não
 * rode junto com `pnpm test:e2e` nem com `pnpm test:integration`.
 */
export default defineConfig({
  testDir: '.',
  testMatch: '*.capture.ts',
  outputDir: resolve(ROOT, 'packages/landing/test-results/capture'),
  workers: 1,
  reporter: [['list']],
  timeout: 120_000,
  use: {
    baseURL: `http://localhost:${GAME_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    colorScheme: 'dark',
  },
  webServer: [
    {
      command: 'pnpm --filter @lotg/server exec tsx ../../tests/landing/capture/server.ts',
      cwd: ROOT,
      url: `http://127.0.0.1:${API_PORT}/v1/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        CAPTURE_API_PORT: String(API_PORT),
        TEST_DATABASE_URL:
          process.env.TEST_DATABASE_URL ?? 'postgres://lotg:lotg@localhost:5433/lotg_test',
      },
    },
    {
      command: `pnpm --filter @lotg/web build && pnpm --filter @lotg/web exec vite preview --port ${GAME_PORT} --strictPort`,
      cwd: ROOT,
      url: `http://localhost:${GAME_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: { LOTG_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
    {
      command: 'pnpm --filter @lotg/landing build && pnpm --filter @lotg/landing preview',
      cwd: ROOT,
      url: `http://localhost:${LANDING_PORT}`,
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
