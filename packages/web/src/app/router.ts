/** As abas da área central. */
export const ROUTES = ['welcome', 'today', 'fief', 'chronicle', 'settings', 'about'] as const;
export type Route = (typeof ROUTES)[number];

/** Abas que só existem com um feudo aberto. */
export const GAME_ROUTES: readonly Route[] = ['today', 'fief', 'chronicle'];
/** Abas que o jogador abre e fecha; as outras estão sempre lá. */
export const CLOSABLE_ROUTES: readonly Route[] = ['chronicle', 'settings', 'about'];

const PATHS: Record<Route, string> = {
  welcome: 'boas-vindas',
  today: 'hoje',
  fief: 'feudo',
  chronicle: 'cronica',
  settings: 'preferencias',
  about: 'sobre',
};

export const ROUTE_LABELS: Record<Route, string> = {
  welcome: 'Boas-vindas',
  today: 'Hoje',
  fief: 'Feudo',
  chronicle: 'Crônica',
  settings: 'Preferências',
  about: 'Sobre',
};

export const ROUTE_ICONS: Record<Route, string> = {
  welcome: 'home',
  today: 'calendar',
  fief: 'shield',
  chronicle: 'book',
  settings: 'gear',
  about: 'info',
};

/** `#/feudo` para a aba Feudo: o botão "voltar" e o recarregar da página funcionam. */
export function formatHash(route: Route): string {
  return `#/${PATHS[route]}`;
}

export function parseHash(hash: string): Route | null {
  const path = hash.replace(/^#\/?/, '').replace(/\/+$/, '');
  return ROUTES.find((route) => PATHS[route] === path) ?? null;
}

/**
 * A aba que de fato abre para um pedido: sem feudo, as abas do jogo levam às boas-vindas; com
 * feudo, as boas-vindas levam à aba padrão.
 */
export function resolveRoute(requested: Route, hasGame: boolean, fallback: Route): Route {
  if (!hasGame && GAME_ROUTES.includes(requested)) {
    return 'welcome';
  }
  if (hasGame && requested === 'welcome') {
    return fallback;
  }
  return requested;
}

/** As abas à vista, na ordem: as fixas e depois as que o jogador abriu. */
export function visibleTabs(hasGame: boolean, opened: readonly Route[]): Route[] {
  const fixed: Route[] = hasGame ? ['today', 'fief'] : ['welcome'];
  const extra = CLOSABLE_ROUTES.filter(
    (route) => opened.includes(route) && (hasGame || !GAME_ROUTES.includes(route)),
  );
  return [...fixed, ...extra];
}
