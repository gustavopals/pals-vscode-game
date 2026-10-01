import preact from '@preact/preset-vite';
import { defineConfig, loadEnv, type Plugin } from 'vite';

/**
 * A política de conteúdo de `index.html` vale como está no build. O servidor de desenvolvimento
 * injeta os estilos em elementos `<style>` e fala com a página por WebSocket: só nele a política
 * é afrouxada para isso.
 */
function devContentSecurityPolicy(): Plugin {
  return {
    name: 'lotg-dev-csp',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'")
        .replace("connect-src 'self'", "connect-src 'self' ws: wss:"),
  };
}

export default defineConfig(({ mode }) => {
  // LOTG_API_URL troca o destino do repasse de /v1 (os testes em navegador usam outra porta).
  const env = loadEnv(mode, import.meta.dirname, 'LOTG_');
  const proxy = { '/v1': { target: env.LOTG_API_URL ?? 'http://localhost:3000' } };
  return {
    plugins: [preact(), devContentSecurityPolicy()],
    server: { port: 5173, strictPort: true, proxy },
    preview: { port: 4173, strictPort: true, proxy },
    build: { outDir: 'dist', emptyOutDir: true, sourcemap: false },
  };
});
