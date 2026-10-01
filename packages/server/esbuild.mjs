// Empacota o servidor inteiro em dist/main.js: o código, os pacotes do workspace (@lotg/*, que
// são fontes TypeScript) e as dependências de produção, só com o que é de fato usado.
// A imagem de produção leva apenas este arquivo e as migrações, sem node_modules.
import { build } from 'esbuild';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  // Binding nativo opcional do `pg`; o servidor usa o driver em JavaScript.
  external: ['pg-native'],
  define: { __BUILT_AT__: JSON.stringify(new Date().toISOString()) },
  banner: {
    // Dependências em CommonJS chamam `require` e usam `__dirname`, que não existem em ESM.
    js: [
      "import { createRequire as __createRequire } from 'node:module';",
      "import { fileURLToPath as __fileURLToPath } from 'node:url';",
      "import { dirname as __pathDirname } from 'node:path';",
      'const require = __createRequire(import.meta.url);',
      'const __filename = __fileURLToPath(import.meta.url);',
      'const __dirname = __pathDirname(__filename);',
    ].join('\n'),
  },
  logLevel: 'info',
});
