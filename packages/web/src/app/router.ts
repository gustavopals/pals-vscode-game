import { GameSeedSchema } from '@lotg/protocol';

/** As abas da área central. */
export const ROUTES = [
  'welcome',
  'today',
  'fief',
  'council',
  'guild',
  'market',
  'army',
  'map',
  'chronicle',
  'kingdom',
  'settings',
  'news',
  'about',
] as const;
export type Route = (typeof ROUTES)[number];

/** Abas que só existem com um feudo aberto. */
export const GAME_ROUTES: readonly Route[] = [
  'today',
  'fief',
  'council',
  'guild',
  'market',
  'army',
  'map',
  'chronicle',
];
/** Abas que o jogador abre e fecha; as outras estão sempre lá. */
/** O Reino (estatísticas e ranking, ADR 0021) é da conta, e não do feudo: abre também sem um. */
export const CLOSABLE_ROUTES: readonly Route[] = [
  'chronicle',
  'kingdom',
  'settings',
  'news',
  'about',
];

const PATHS: Record<Route, string> = {
  welcome: 'boas-vindas',
  today: 'hoje',
  fief: 'feudo',
  council: 'conselho',
  guild: 'guilda',
  market: 'mercado',
  army: 'exercito',
  map: 'mapa',
  chronicle: 'cronica',
  kingdom: 'reino',
  settings: 'preferencias',
  news: 'novidades',
  about: 'sobre',
};

export const ROUTE_LABELS: Record<Route, string> = {
  welcome: 'Boas-vindas',
  today: 'Hoje',
  fief: 'Feudo',
  council: 'Conselho',
  guild: 'Guilda',
  market: 'Mercado',
  army: 'Exército',
  map: 'Mapa',
  chronicle: 'Crônica',
  kingdom: 'Reino',
  settings: 'Preferências',
  news: 'Novidades',
  about: 'Sobre',
};

export const ROUTE_ICONS: Record<Route, string> = {
  welcome: 'home',
  today: 'calendar',
  fief: 'shield',
  council: 'law',
  guild: 'compass',
  market: 'tag',
  army: 'organization',
  map: 'map',
  chronicle: 'book',
  kingdom: 'graph',
  settings: 'gear',
  news: 'megaphone',
  about: 'info',
};

/** `#/feudo` para a aba Feudo: o botão "voltar" e o recarregar da página funcionam. */
export function formatHash(route: Route): string {
  return `#/${PATHS[route]}`;
}

/** `#/nova?seed=…`: abre a criação de partida com a semente preenchida. */
export function formatNewGameHash(seed?: string | null): string {
  const trimmed = seed?.trim();
  return trimmed ? `#/nova?seed=${encodeURIComponent(trimmed)}` : '#/nova';
}

export type ParsedHash = { kind: 'route'; route: Route } | { kind: 'newGame'; seed: string | null };

/**
 * Lê o endereço da barra (`#/feudo`, `#/nova?seed=…`). Devolve `null` para caminhos
 * desconhecidos. A semente de `#/nova` é validada contra o protocolo: vazia ou inválida vira `null`.
 */
export function parseHashTarget(hash: string): ParsedHash | null {
  const raw = hash.replace(/^#\/?/, '');
  const queryIndex = raw.indexOf('?');
  const path = (queryIndex === -1 ? raw : raw.slice(0, queryIndex)).replace(/\/+$/, '');
  if (path === 'nova') {
    const query = queryIndex === -1 ? '' : raw.slice(queryIndex + 1);
    const seedParam = new URLSearchParams(query).get('seed');
    const parsed = seedParam === null ? null : GameSeedSchema.safeParse(seedParam);
    return { kind: 'newGame', seed: parsed?.success ? parsed.data : null };
  }
  if (queryIndex !== -1) {
    return null;
  }
  const route = ROUTES.find((candidate) => PATHS[candidate] === path) ?? null;
  return route === null ? null : { kind: 'route', route };
}

export function parseHash(hash: string): Route | null {
  const parsed = parseHashTarget(hash);
  return parsed?.kind === 'route' ? parsed.route : null;
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

/**
 * As abas à vista, na ordem: as fixas e depois as que o jogador abriu. O Conselho é fixo como o
 * feudo: é onde as cartas esperam, e o jogador não precisa lembrar de abri-lo. A Guilda também:
 * é onde a equipe e o soldo dela estão à vista. O Mercado também: sem ele, a aba diz como erguê-lo. O Exército também, pelo mesmo motivo (o Quartel).
 */
export function visibleTabs(hasGame: boolean, opened: readonly Route[]): Route[] {
  const fixed: Route[] = hasGame
    ? ['today', 'fief', 'council', 'guild', 'market', 'army', 'map']
    : ['welcome'];
  const extra = CLOSABLE_ROUTES.filter(
    (route) => opened.includes(route) && (hasGame || !GAME_ROUTES.includes(route)),
  );
  return [...fixed, ...extra];
}
