import { describe, expect, it } from 'vitest';

import {
  CLOSABLE_ROUTES,
  formatHash,
  GAME_ROUTES,
  parseHash,
  resolveRoute,
  type Route,
  ROUTE_ICONS,
  ROUTE_LABELS,
  ROUTES,
  visibleTabs,
} from './router';

describe('endereço da aba (hash)', () => {
  it('toda aba vai para o endereço e volta dele', () => {
    for (const route of ROUTES) {
      const hash = formatHash(route);
      expect(hash.startsWith('#/')).toBe(true);
      expect(parseHash(hash)).toBe(route);
    }
  });

  it('cada aba tem um endereço só dela, em português', () => {
    const hashes = ROUTES.map(formatHash);
    expect(new Set(hashes).size).toBe(ROUTES.length);
    expect(formatHash('fief')).toBe('#/feudo');
    expect(formatHash('today')).toBe('#/hoje');
    expect(formatHash('council')).toBe('#/conselho');
    expect(formatHash('chronicle')).toBe('#/cronica');
    expect(formatHash('settings')).toBe('#/preferencias');
    expect(formatHash('about')).toBe('#/sobre');
    expect(formatHash('welcome')).toBe('#/boas-vindas');
  });

  it('aceita o endereço sem a barra inicial e com barra sobrando no fim', () => {
    expect(parseHash('#feudo')).toBe('fief');
    expect(parseHash('feudo')).toBe('fief');
    expect(parseHash('#/feudo/')).toBe('fief');
    expect(parseHash('#/hoje//')).toBe('today');
    expect(parseHash('#/conselho')).toBe('council');
  });

  it('endereço vazio ou desconhecido não é aba nenhuma', () => {
    expect(parseHash('')).toBeNull();
    expect(parseHash('#')).toBeNull();
    expect(parseHash('#/')).toBeNull();
    expect(parseHash('#/mercado')).toBeNull();
    expect(parseHash('#/feudo/obras')).toBeNull();
    // O nome interno da aba não é endereço.
    expect(parseHash('#/fief')).toBeNull();
    expect(parseHash('#/council')).toBeNull();
    expect(parseHash('#/feudos')).toBeNull();
  });

  it('toda aba tem rótulo e ícone', () => {
    for (const route of ROUTES) {
      expect(ROUTE_LABELS[route]).not.toBe('');
      expect(ROUTE_ICONS[route]).toMatch(/^[a-z-]+$/);
    }
  });
});

describe('resolveRoute', () => {
  it('sem feudo, as abas do jogo levam às boas-vindas', () => {
    for (const route of GAME_ROUTES) {
      expect(resolveRoute(route, false, 'welcome')).toBe('welcome');
    }
  });

  it('sem feudo, Preferências e Sobre continuam abrindo', () => {
    expect(resolveRoute('settings', false, 'welcome')).toBe('settings');
    expect(resolveRoute('about', false, 'welcome')).toBe('about');
    expect(resolveRoute('welcome', false, 'welcome')).toBe('welcome');
  });

  it('com feudo, as boas-vindas levam à aba padrão', () => {
    expect(resolveRoute('welcome', true, 'fief')).toBe('fief');
    expect(resolveRoute('welcome', true, 'today')).toBe('today');
  });

  it('com feudo, qualquer outra aba abre como pedida', () => {
    const others: Route[] = ['today', 'fief', 'council', 'chronicle', 'settings', 'about'];
    for (const route of others) {
      expect(resolveRoute(route, true, 'fief')).toBe(route);
    }
  });
});

describe('visibleTabs', () => {
  it('sem feudo, só as boas-vindas', () => {
    expect(visibleTabs(false, [])).toEqual(['welcome']);
  });

  it('com feudo, Hoje, Feudo e Conselho estão sempre lá, nessa ordem', () => {
    expect(visibleTabs(true, [])).toEqual(['today', 'fief', 'council']);
  });

  it('as abas abertas vêm depois das fixas, em ordem estável', () => {
    expect(visibleTabs(true, ['about', 'chronicle', 'settings'])).toEqual([
      'today',
      'fief',
      'council',
      'chronicle',
      'settings',
      'about',
    ]);
    expect(visibleTabs(true, ['settings'])).toEqual(['today', 'fief', 'council', 'settings']);
  });

  it('sem feudo, a Crônica aberta não aparece; Preferências e Sobre, sim', () => {
    expect(visibleTabs(false, ['chronicle', 'settings', 'about'])).toEqual([
      'welcome',
      'settings',
      'about',
    ]);
  });

  it('uma aba fixa na lista de abertas não aparece duas vezes', () => {
    expect(visibleTabs(true, ['fief', 'today', 'council'])).toEqual(['today', 'fief', 'council']);
    expect(visibleTabs(false, ['welcome'])).toEqual(['welcome']);
  });

  it('só Crônica, Preferências e Sobre podem ser fechadas', () => {
    expect([...CLOSABLE_ROUTES].sort()).toEqual(['about', 'chronicle', 'settings']);
    expect([...GAME_ROUTES].sort()).toEqual(['chronicle', 'council', 'fief', 'today']);
  });

  it('sem feudo, o Conselho não aparece nem abre: é aba do jogo', () => {
    expect(visibleTabs(false, [])).not.toContain('council');
    expect(resolveRoute('council', false, 'welcome')).toBe('welcome');
  });
});
