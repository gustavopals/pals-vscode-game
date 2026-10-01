// Empacota a interface em packages/extension/media/webview.{js,css}: é de lá que a extensão a
// carrega no painel, e é o que vai dentro do .vsix.
import { build, context } from 'esbuild';

const options = {
  entryPoints: { webview: 'src/main.tsx' },
  outdir: '../extension/media',
  bundle: true,
  platform: 'browser',
  target: 'es2022',
  format: 'esm',
  jsx: 'automatic',
  jsxImportSource: 'preact',
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
