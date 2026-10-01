import { defineConfig, devices } from '@playwright/test';

const PORT = 4174;

/**
 * Testes em navegador da página de apresentação (packages/landing): a página compilada, servida
 * como arquivos estáticos. Não usa a API nem o banco, então roda sem `pnpm dev:up` e pode rodar
 * ao lado de `pnpm test:e2e`.
 */
export default defineConfig({
  testDir: 'tests/landing',
  // Pasta própria: o Playwright esvazia a pasta de saída a cada execução, e a do jogo guarda
  // as capturas dos temas.
  outputDir: 'packages/landing/test-results',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 7_000 },
  reporter: process.env.CI
    ? [['list'], ['html', { open: 'never', outputFolder: 'packages/landing/playwright-report' }]]
    : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'computador', use: { ...devices['Desktop Chrome'] } },
    { name: 'celular', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'pnpm --filter @lotg/landing build && pnpm --filter @lotg/landing preview',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
