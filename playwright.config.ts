import { defineConfig, devices } from '@playwright/test';

const API_PORT = 3100;
const WEB_PORT = 4173;

/**
 * Testes em navegador real (MVP-ROADMAP.md F3W-T10): o app compilado, servido como em
 * produção (arquivos estáticos e `/v1` repassado), contra a API de verdade e o banco de teste.
 * Precisa do `db_test` de pé: `pnpm dev:up`.
 */
export default defineConfig({
  testDir: 'tests/e2e',
  outputDir: 'test-results',
  // Todos os testes dividem um servidor e um banco: um de cada vez.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
  },
  webServer: [
    {
      command: 'pnpm --filter @lotg/server exec tsx ../../tests/e2e/server.ts',
      url: `http://127.0.0.1:${API_PORT}/v1/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        E2E_API_PORT: String(API_PORT),
        TEST_DATABASE_URL:
          process.env.TEST_DATABASE_URL ?? 'postgres://lotg:lotg@localhost:5433/lotg_test',
      },
    },
    {
      command: 'pnpm --filter @lotg/web build && pnpm --filter @lotg/web preview',
      url: `http://localhost:${WEB_PORT}`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { LOTG_API_URL: `http://127.0.0.1:${API_PORT}` },
    },
  ],
});
