import { builtinModules } from 'node:module';

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

// GDD §14.2: engine, content e protocol não importam nada do VS Code, do servidor nem do Node.
const serverAndEditorModules = ['vscode', 'fastify', 'pg'];
const purePackageRestrictions = {
  paths: [...serverAndEditorModules, ...builtinModules].map((name) => ({
    name,
    message: 'engine, content e protocol são puros: sem VS Code, servidor ou Node (GDD §14.2).',
  })),
  patterns: [
    {
      group: ['node:*', 'fastify/*', '@fastify/*', 'pg/*', 'pg-*', 'drizzle-orm', 'drizzle-orm/*'],
      message: 'engine, content e protocol são puros: sem VS Code, servidor ou Node (GDD §14.2).',
    },
  ],
};

export default tseslint.config(
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/media/**', '**/coverage/**'],
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
    // A extensão não contém o motor e nunca depende do servidor: só exibe o ViewState.
    files: ['packages/{extension,webview}/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['@lotg/engine', '@lotg/server', 'fastify', 'pg'].map((name) => ({
            name,
            message: 'A extensão e a Webview não importam o motor nem o servidor (GDD §14.2).',
          })),
        },
      ],
    },
  },
  {
    files: ['packages/server/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: ['vscode', 'lords-of-the-guild', '@lotg/webview'].map((name) => ({
            name,
            message: 'O servidor nunca depende da extensão nem do VS Code (GDD §14.2).',
          })),
        },
      ],
    },
  },
);
