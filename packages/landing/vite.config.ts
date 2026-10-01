import { defineConfig, loadEnv, type Plugin } from 'vite';

import { applySite, resolveSite, type Site } from './src/site.ts';

/** Troca `%GAME_URL%` e `%SITE_URL%` das páginas pelos endereços da instalação (src/site.ts). */
function siteUrls(site: Site): Plugin {
  return {
    name: 'lotg-landing-site',
    transformIndexHtml: { order: 'pre', handler: (html) => applySite(html, site) },
  };
}

/**
 * A política de conteúdo das páginas vale como está no build. O servidor de desenvolvimento
 * injeta os estilos em elementos `<style>` e fala com a página por WebSocket: só nele a política
 * é afrouxada para isso, como em packages/web.
 */
function devContentSecurityPolicy(): Plugin {
  return {
    name: 'lotg-landing-dev-csp',
    apply: 'serve',
    transformIndexHtml: (html) =>
      html
        .replace("default-src 'none'", "default-src 'none'; connect-src 'self' ws: wss:")
        .replace("style-src 'self'", "style-src 'self' 'unsafe-inline'"),
  };
}

export default defineConfig(({ mode }) => {
  // LOTG_GAME_URL e LOTG_LANDING_URL trocam os endereços de produção (src/site.ts).
  const site = resolveSite(loadEnv(mode, import.meta.dirname, 'LOTG_'));
  return {
    // Duas páginas e nenhuma rota de aplicativo: endereço desconhecido é 404, não index.html.
    appType: 'mpa',
    plugins: [siteUrls(site), devContentSecurityPolicy()],
    server: { port: 5174, strictPort: true },
    preview: { port: 4174, strictPort: true },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      sourcemap: false,
      // A política de conteúdo não aceita `data:`: nenhum arquivo pequeno vira texto embutido.
      assetsInlineLimit: 0,
      modulePreload: { polyfill: false },
      rolldownOptions: { input: ['index.html', '404.html'] },
    },
  };
});
