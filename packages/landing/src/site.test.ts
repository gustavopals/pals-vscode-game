import { describe, expect, it } from 'vitest';

import ci from '../../../.github/workflows/ci.yml?raw';
import health from '../../../.github/workflows/health.yml?raw';
import { applySite, DEFAULT_SITE, resolveSite } from './site';

describe('resolveSite', () => {
  it('sem variáveis, vale a instalação de produção', () => {
    expect(resolveSite({})).toEqual(DEFAULT_SITE);
    expect(DEFAULT_SITE.gameUrl).toBe('https://lords.palsincomehub.com');
  });

  it('variável vazia é o mesmo que ausente (ARG do Dockerfile sem valor)', () => {
    expect(resolveSite({ LOTG_GAME_URL: '', LOTG_LANDING_URL: '  ' })).toEqual(DEFAULT_SITE);
  });

  it('aceita outro endereço e devolve só a origem, sem barra no fim', () => {
    const site = resolveSite({
      LOTG_GAME_URL: 'https://jogo.exemplo.com/',
      LOTG_LANDING_URL: 'https://exemplo.com',
    });
    expect(site).toEqual({ gameUrl: 'https://jogo.exemplo.com', siteUrl: 'https://exemplo.com' });
  });

  it('http só para a própria máquina', () => {
    expect(resolveSite({ LOTG_GAME_URL: 'http://localhost:5173' }).gameUrl).toBe(
      'http://localhost:5173',
    );
    expect(resolveSite({ LOTG_GAME_URL: 'http://127.0.0.1:4173/' }).gameUrl).toBe(
      'http://127.0.0.1:4173',
    );
    expect(() => resolveSite({ LOTG_GAME_URL: 'http://jogo.exemplo.com' })).toThrow(
      /LOTG_GAME_URL.*https/,
    );
  });

  it('recusa o que não é um endereço de site, dizendo qual variável está errada', () => {
    expect(() => resolveSite({ LOTG_GAME_URL: 'lords.palsincomehub.com' })).toThrow(
      /LOTG_GAME_URL/,
    );
    expect(() => resolveSite({ LOTG_LANDING_URL: 'javascript:alert(1)' })).toThrow(
      /LOTG_LANDING_URL/,
    );
    expect(() => resolveSite({ LOTG_LANDING_URL: 'https://exemplo.com/pagina' })).toThrow(
      /LOTG_LANDING_URL.*caminho/,
    );
    expect(() => resolveSite({ LOTG_GAME_URL: 'https://exemplo.com/?a=1' })).toThrow(
      /LOTG_GAME_URL/,
    );
  });
});

describe('os endereços de produção', () => {
  it('o deploy e o monitor de saúde conferem a página no mesmo endereço do padrão', () => {
    // Trocar o endereço da página é trocar aqui, nos dois workflows e no recurso do Coolify.
    expect(ci).toContain(`LANDING_URL: ${DEFAULT_SITE.siteUrl}\n`);
    expect(health).toContain(`LANDING_URL: ${DEFAULT_SITE.siteUrl}\n`);
    expect(ci).toContain(`PUBLIC_URL: ${DEFAULT_SITE.gameUrl}\n`);
    expect(health).toContain(`PUBLIC_URL: ${DEFAULT_SITE.gameUrl}\n`);
  });
});

describe('applySite', () => {
  const site = { gameUrl: 'https://jogo.exemplo.com', siteUrl: 'https://exemplo.com' };

  it('troca todas as ocorrências dos dois marcadores', () => {
    const html =
      '<a href="%GAME_URL%">a</a><a href="%GAME_URL%/#/feudo">b</a><i>%SITE_URL%/og.jpg</i>';
    expect(applySite(html, site)).toBe(
      '<a href="https://jogo.exemplo.com">a</a><a href="https://jogo.exemplo.com/#/feudo">b</a><i>https://exemplo.com/og.jpg</i>',
    );
  });

  it('marcador desconhecido derruba o build em vez de ir ao ar', () => {
    expect(() => applySite('<a href="%GAME_URI%">a</a>', site)).toThrow(/%GAME_URI%/);
  });

  it('não confunde porcentagens do texto com marcadores', () => {
    expect(applySite('<p>100% de 50%</p>', site)).toBe('<p>100% de 50%</p>');
  });
});
