// Empacota a extensão em dist/extension.js (CommonJS, como o VS Code carrega), com o SDK e o
// protocolo dentro. Só `vscode` fica de fora: quem o fornece é o editor.
import { build, context } from 'esbuild';

const options = {
  entryPoints: ['src/extension.ts'],
  outfile: 'dist/extension.js',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  external: ['vscode'],
  // O pacote publicado vai minificado e sem mapa; no watch, legível e com mapa para depurar.
  minify: !process.argv.includes('--watch'),
  sourcemap: process.argv.includes('--watch'),
  logLevel: 'info',
};

if (process.argv.includes('--watch')) {
  const watcher = await context(options);
  await watcher.watch();
} else {
  await build(options);
}
