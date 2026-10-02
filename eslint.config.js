import { builtinModules } from 'node:module';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// GDD §14.2: engine, content e protocol não importam nada do servidor nem do Node.
const serverModules = ['fastify', 'pg'];
const purePackageRestrictions = {
  paths: [...serverModules, ...builtinModules].map((name) => ({
    name,
    message: 'engine, content e protocol são puros: sem servidor nem Node (GDD §14.2).',
  })),
  patterns: [
    {
      group: ['node:*', 'fastify/*', '@fastify/*', 'pg/*', 'pg-*', 'drizzle-orm', 'drizzle-orm/*'],
      message: 'engine, content e protocol são puros: sem servidor nem Node (GDD §14.2).',
    },
  ],
};

// O app web roda no navegador e só exibe o ViewState: sem motor, sem servidor, sem Node.
const webMessage = 'O app web não importa o motor, o servidor nem módulos do Node (GDD §14.2).';
// O conteúdo de jogo também não vai para o navegador: cartas (com os efeitos escondidos e as
// flags), números de regra e frases só chegam pelo ViewState e por GET /catalog (roadmap da
// v0.2, §0.7). `contentHash` lê o conteúdo inteiro: é do servidor e do simulador. Quem prova que
// nada disso foi empacotado é `packages/web/src/bundle.test.ts`; o lint avisa antes.
const webContentMessage =
  'O app web não leva o conteúdo de jogo para o navegador: ele só exibe o ViewState (roadmap da v0.2, §0.7).';
const webRestrictions = {
  paths: [
    ...['@lotg/engine', '@lotg/server', ...serverModules, ...builtinModules].map((name) => ({
      name,
      message: webMessage,
    })),
    { name: '@lotg/content', message: webContentMessage },
    { name: '@lotg/protocol', importNames: ['contentHash'], message: webContentMessage },
  ],
  patterns: [
    {
      group: ['node:*', 'fastify/*', '@fastify/*', 'pg/*', 'pg-*', 'drizzle-orm', 'drizzle-orm/*'],
      message: webMessage,
    },
    {
      group: ['@lotg/content/*', '**/content/src', '**/content/src/*'],
      message: webContentMessage,
    },
  ],
};

// A página de apresentação é estática e independente do jogo: nenhum pacote do monorepo,
// nenhum servidor, nenhum módulo do Node. Os testes podem ler o conteúdo para conferir citações.
const landingMessage =
  'A página de apresentação não importa pacotes do jogo, o servidor nem módulos do Node (ADR 0012).';
const landingRestrictions = {
  paths: [...serverModules, ...builtinModules].map((name) => ({ name, message: landingMessage })),
  patterns: [
    {
      group: [
        '@lotg/*',
        'node:*',
        'fastify/*',
        '@fastify/*',
        'pg/*',
        'pg-*',
        'drizzle-orm',
        'drizzle-orm/*',
      ],
      message: landingMessage,
    },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{js,mjs}'],
    languageOptions: {
      globals: { process: 'readonly', console: 'readonly' },
    },
  },
  {
    files: ['packages/{engine,content,protocol}/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', purePackageRestrictions],
    },
  },
  {
    // O motor é determinístico: sem relógio do sistema, sem sorteio sem semente, sem ambiente.
    files: ['packages/engine/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-properties': [
        'error',
        {
          object: 'Date',
          property: 'now',
          message: 'O motor recebe o tempo de jogo por parâmetro.',
        },
        {
          object: 'Math',
          property: 'random',
          message: 'Sorteios usam o RNG com semente do estado.',
        },
      ],
      'no-restricted-globals': ['error', 'process', 'require', 'fetch'],
      'no-restricted-syntax': [
        'error',
        {
          selector: "NewExpression[callee.name='Date']",
          message: 'O motor recebe o tempo de jogo por parâmetro.',
        },
      ],
    },
  },
  {
    files: ['packages/web/src/**/*.{ts,tsx}'],
    ignores: ['**/*.test.{ts,tsx}'],
    rules: {
      'no-restricted-imports': ['error', webRestrictions],
    },
  },
  {
    files: ['packages/landing/src/**/*.ts'],
    ignores: ['**/*.test.ts'],
    rules: {
      'no-restricted-imports': ['error', landingRestrictions],
    },
  },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@lotg/web',
              message: 'O servidor nunca depende do app web (GDD §14.2).',
            },
          ],
        },
      ],
    },
  },
);
