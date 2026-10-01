/**
 * Os dois endereços que a página conhece: o do jogo, destino do botão "Jogar agora", e o da
 * própria página, usado na prévia que redes sociais e mensageiros mostram do link.
 */
export type Site = {
  readonly gameUrl: string;
  readonly siteUrl: string;
};

/** A instalação de produção (deploy/README.md). Outro endereço entra por variável no build. */
export const DEFAULT_SITE: Site = {
  gameUrl: 'https://lords.palsincomehub.com',
  siteUrl: 'https://lordsoftheguild.palsincomehub.com',
};

type Env = Readonly<Record<string, string | undefined>>;

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1']);

function origin(value: string | undefined, fallback: string, name: string): string {
  const text = value?.trim();
  if (!text) return fallback;
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${name} não é um endereço: "${text}". Exemplo: https://exemplo.com`);
  }
  const local = url.protocol === 'http:' && LOCAL_HOSTS.has(url.hostname);
  if (url.protocol !== 'https:' && !local) {
    throw new Error(`${name} precisa começar com https:// (http só para localhost): "${text}".`);
  }
  if (url.pathname !== '/' || url.search !== '' || url.hash !== '') {
    throw new Error(`${name} é só a origem do site, sem caminho nem parâmetros: "${text}".`);
  }
  return url.origin;
}

/** Lê `LOTG_GAME_URL` e `LOTG_LANDING_URL`; vazias ou ausentes, valem os endereços de produção. */
export function resolveSite(env: Env): Site {
  return {
    gameUrl: origin(env.LOTG_GAME_URL, DEFAULT_SITE.gameUrl, 'LOTG_GAME_URL'),
    siteUrl: origin(env.LOTG_LANDING_URL, DEFAULT_SITE.siteUrl, 'LOTG_LANDING_URL'),
  };
}

/** Troca `%GAME_URL%` e `%SITE_URL%` no HTML. Um marcador que sobra é erro de digitação. */
export function applySite(html: string, site: Site): string {
  const result = html.replaceAll('%GAME_URL%', site.gameUrl).replaceAll('%SITE_URL%', site.siteUrl);
  const leftover = /%[A-Z][A-Z_]*%/.exec(result);
  if (leftover) {
    throw new Error(
      `Marcador desconhecido no HTML: ${leftover[0]}. Existem %GAME_URL% e %SITE_URL%.`,
    );
  }
  return result;
}
