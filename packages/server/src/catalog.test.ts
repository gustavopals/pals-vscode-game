import { balance, DIFFICULTY_IDS } from '@lotg/content';
import { CatalogResponseSchema } from '@lotg/protocol';
import type { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { type App, buildApp } from './app';
import { catalogInfo, defaultDifficulty } from './catalog';
import { loadConfig } from './config';
import { CONTENT_HASH } from './version';

describe('catalogInfo', () => {
  it('traz as três dificuldades e os três ritmos do conteúdo, na ordem dele', () => {
    const { newGame, contentHash } = catalogInfo({ gameTimeScale: 3 });
    expect(contentHash).toBe(CONTENT_HASH);
    expect(newGame.difficulties.map((entry) => [entry.id, entry.label, entry.recommended])).toEqual(
      [
        ['peasant', 'Camponês', false],
        ['lord', 'Senhor', true],
        ['ironKing', 'Rei de Ferro', false],
      ],
    );
    expect(newGame.paces.map((entry) => [entry.timeScale, entry.label, entry.recommended])).toEqual(
      [
        [3, 'Rápido', true],
        [1, 'Normal', false],
        [0.5, 'Tranquilo', false],
      ],
    );
    expect(newGame.paces.map((entry) => entry.description)).toEqual([
      'um ano em 56 horas',
      'um ano em 7 dias',
      'um ano em 14 dias',
    ]);
    for (const entry of newGame.difficulties) {
      expect(entry.description).toBe(balance.difficulties[entry.id].description);
    }
    for (const [index, entry] of newGame.paces.entries()) {
      expect(entry.hint).toBe(balance.paces[index]?.hint);
    }
  });

  it('tem a forma do protocolo e não leva nenhum fator de regra', () => {
    const catalog = catalogInfo({ gameTimeScale: 3 });
    expect(CatalogResponseSchema.safeParse(catalog).error).toBeUndefined();
    const text = JSON.stringify(catalog);
    expect(text).not.toContain('storageCapacity');
    expect(text).not.toContain('famineDesertion');
    expect(Object.keys(catalog.newGame.difficulties[0] ?? {}).sort()).toEqual([
      'description',
      'id',
      'label',
      'recommended',
    ]);
  });

  it('a dificuldade padrão é Senhor, a recomendada do conteúdo', () => {
    expect(defaultDifficulty()).toBe('lord');
    expect(DIFFICULTY_IDS.filter((id) => balance.difficulties[id].recommended)).toEqual(['lord']);
    expect(catalogInfo({ gameTimeScale: 1 }).newGame.defaults.difficulty).toBe('lord');
  });

  it.each([3, 1, 0.5])('GAME_TIME_SCALE %s é oferecido: é o ritmo padrão', (gameTimeScale) => {
    expect(catalogInfo({ gameTimeScale }).newGame.defaults.timeScale).toBe(gameTimeScale);
  });

  it.each([2, 7, 0.75, 10])(
    'GAME_TIME_SCALE %s não é oferecido: o padrão das boas-vindas é o ritmo recomendado',
    (gameTimeScale) => {
      const catalog = catalogInfo({ gameTimeScale });
      expect(catalog.newGame.defaults.timeScale).toBe(3);
      // E o ritmo de fora da lista não vira opção.
      expect(catalog.newGame.paces.map((entry) => entry.timeScale)).toEqual([3, 1, 0.5]);
      expect(CatalogResponseSchema.safeParse(catalog).error).toBeUndefined();
    },
  );
});

describe('GET /v1/catalog', () => {
  const env = {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgres://nada',
    JWT_SECRET: Buffer.alloc(48, 1).toString('base64'),
    RECOVERY_CODE_SECRET: Buffer.alloc(48, 2).toString('base64'),
    LOG_LEVEL: 'silent',
    RATE_LIMIT_PER_MINUTE: '6',
  };
  // O catálogo não toca o banco: uma consulta aqui derruba o teste.
  const pool = {
    query: () => Promise.reject(new Error('o catálogo não consulta o banco')),
  } as unknown as Pool;

  let app: App;
  let slow: App;

  beforeAll(async () => {
    ({ app } = await buildApp({ config: loadConfig(env), pool, logger: false }));
    ({ app: slow } = await buildApp({
      config: loadConfig({ ...env, GAME_TIME_SCALE: '0.5' }),
      pool,
      logger: false,
    }));
    await app.ready();
    await slow.ready();
  });
  afterAll(async () => {
    await app.close();
    await slow.close();
  });

  it('responde sem autenticação, com ETag, e o mesmo ETag devolve 304 sem corpo', async () => {
    const first = await app.inject({ url: '/v1/catalog' });
    expect(first.statusCode).toBe(200);
    expect(CatalogResponseSchema.safeParse(first.json()).error).toBeUndefined();
    // Sem GAME_TIME_SCALE, o servidor usa 3: é o que vem marcado.
    expect(first.json().newGame.defaults).toEqual({ difficulty: 'lord', timeScale: 3 });
    expect(first.headers['cache-control']).toBe('no-cache');
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/);

    const again = await app.inject({ url: '/v1/catalog', headers: { 'if-none-match': etag } });
    expect(again.statusCode).toBe(304);
    expect(again.body).toBe('');
    expect(again.headers.etag).toBe(etag);

    const other = await app.inject({
      url: '/v1/catalog',
      headers: { 'if-none-match': 'W/"outra-coisa"' },
    });
    expect(other.statusCode).toBe(200);
    expect(other.json()).toEqual(first.json());
  });

  it('o ETag muda quando o ritmo padrão do servidor muda, com o mesmo conteúdo', async () => {
    const fast = await app.inject({ url: '/v1/catalog' });
    const calm = await slow.inject({ url: '/v1/catalog' });
    expect(calm.json().contentHash).toBe(fast.json().contentHash);
    expect(calm.json().newGame.defaults).toEqual({ difficulty: 'lord', timeScale: 0.5 });
    expect(calm.headers.etag).not.toBe(fast.headers.etag);
    // O ETag de uma configuração não vale na outra: a resposta vem inteira.
    const crossed = await slow.inject({
      url: '/v1/catalog',
      headers: { 'if-none-match': String(fast.headers.etag) },
    });
    expect(crossed.statusCode).toBe(200);
  });

  it('entra no limite geral de requisições, como /version', async () => {
    const statuses: number[] = [];
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const response = await slow.inject({ url: '/v1/catalog', remoteAddress: '10.9.8.7' });
      statuses.push(response.statusCode);
    }
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200]);
    expect(statuses.slice(6)).toEqual([429, 429]);
    const version = await slow.inject({ url: '/v1/version', remoteAddress: '10.9.8.7' });
    expect(version.statusCode).toBe(429);
    expect(version.json()).toMatchObject({ code: 'RATE_LIMITED' });
  });

  it('um cliente de outro protocolo recebe 426, como em qualquer rota', async () => {
    const response = await app.inject({
      url: '/v1/catalog',
      headers: { 'x-lords-protocol': '999' },
    });
    expect(response.statusCode).toBe(426);
    expect(response.json()).toMatchObject({ code: 'UPGRADE_REQUIRED' });
  });
});
