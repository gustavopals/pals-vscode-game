import { relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vitest/config';

// O projeto de integração só enxerga arquivos de teste com TEST_DATABASE_URL definido:
// sem banco de teste, `pnpm test:integration` passa vazio em vez de falhar por conexão.
const hasTestDatabase = Boolean(process.env.TEST_DATABASE_URL);

// `pnpm --filter <pacote> test` roda com o diretório atual dentro de packages/<pacote>:
// nesse caso o projeto unit fica restrito a esse pacote, e um filtro extra
// (`-- construction`) escolhe arquivos só dentro dele.
const rootDir = fileURLToPath(new URL('.', import.meta.url));
const [scope, packageDir] = relative(rootDir, process.cwd()).split(sep);
const unitScope = scope === 'packages' && packageDir ? packageDir : '*';

export default defineConfig({
  // Fora do editor não existe o módulo `vscode`: os testes usam um substituto mínimo.
  resolve: { alias: { vscode: `${rootDir}packages/extension/test/fake-vscode.ts` } },
  test: {
    // Goldens (`__golden__/`) só são regravados a pedido: UPDATE_GOLDEN=1 pnpm test
    update: process.env.UPDATE_GOLDEN === '1',
    coverage: {
      provider: 'v8',
      include: [`packages/${unitScope}/src/**/*.{ts,tsx}`],
      exclude: ['**/*.test.{ts,tsx}', '**/test-helpers.ts', '**/*.d.ts'],
      reporter: ['text'],
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          // O teste de tema da Webview lê a folha de estilo de verdade.
          css: true,
          include: [`packages/${unitScope}/src/**/*.test.{ts,tsx}`],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: hasTestDatabase
            ? ['tests/**/*.test.ts', 'packages/server/test/**/*.test.ts']
            : [],
          fileParallelism: false,
        },
      },
    ],
  },
});
