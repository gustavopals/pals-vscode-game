import type {
  CatalogResponse,
  CreateGameResponse,
  VersionResponse,
  ViewResponse,
} from '@lotg/protocol';
import { CatalogResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, createTestApp, signUp, type TestApp } from './helpers/app';
import { resetTestDb } from './helpers/db';

// GET /v1/catalog (GDD §14.5; ADR 0013, decisão 2a): as opções de nova partida que as
// boas-vindas mostram. O app não importa o conteúdo: tudo o que ele oferece vem daqui.

/** Instância dos testes: GAME_TIME_SCALE=1. */
let server: TestApp;
/** Instância com o ritmo da produção. */
let production: TestApp;
/** Instância com um ritmo padrão que não está entre os oferecidos. */
let odd: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
  production = await createTestApp({ config: { GAME_TIME_SCALE: '3' } });
  odd = await createTestApp({ config: { GAME_TIME_SCALE: '7' } });
});
afterAll(async () => {
  await server.close();
  await production.close();
  await odd.close();
});

describe('GET /catalog', () => {
  it('responde sem autenticação, na forma do protocolo, com o hash de /version', async () => {
    const reply = await call<CatalogResponse>(server, 'GET', '/catalog');
    expect(reply.status).toBe(200);
    expect(CatalogResponseSchema.safeParse(reply.body).error).toBeUndefined();
    const version = await call<VersionResponse>(server, 'GET', '/version');
    expect(reply.body.contentHash).toBe(version.body.contentHash);

    expect(reply.body.newGame).toEqual({
      difficulties: [
        {
          id: 'peasant',
          label: 'Camponês',
          description:
            'O Celeiro e o Armazém guardam 25% a mais, ninguém deserta por fome e o Conselho, sem resposta sua, decide sem cobrar nada do feudo.',
          recommended: false,
        },
        {
          id: 'lord',
          label: 'Senhor',
          description:
            'O feudo como foi pensado: a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, decide sem cobrar nada do feudo.',
          recommended: true,
        },
        {
          id: 'ironKing',
          label: 'Rei de Ferro',
          description:
            'O Celeiro e o Armazém guardam 20% a menos, a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, escolhe o caminho mais duro.',
          recommended: false,
        },
      ],
      paces: [
        {
          timeScale: 3,
          label: 'Rápido',
          description: 'um ano em 56 horas',
          hint: 'Para quem volta várias vezes ao dia e quer ver o inverno ainda nesta semana.',
          recommended: true,
        },
        {
          timeScale: 1,
          label: 'Normal',
          description: 'um ano em 7 dias',
          hint: 'Uma semana, um ano: para quem passa pelo feudo duas ou três vezes por dia.',
          recommended: false,
        },
        {
          timeScale: 0.5,
          label: 'Tranquilo',
          description: 'um ano em 14 dias',
          hint: 'Para quem abre o jogo uma vez por dia: o feudo anda devagar e espera por você.',
          recommended: false,
        },
      ],
      // O servidor dos testes roda com GAME_TIME_SCALE=1.
      defaults: { difficulty: 'lord', timeScale: 1 },
    });
  });

  it('ETag: a mesma leitura volta 304 sem corpo; sem If-None-Match, 200', async () => {
    const first = await call<CatalogResponse>(server, 'GET', '/catalog');
    const etag = String(first.headers.etag);
    expect(etag).toMatch(/^W\/"[0-9a-f]{64}"$/);
    expect(first.headers['cache-control']).toBe('no-cache');

    const cached = await call(server, 'GET', '/catalog', { headers: { 'if-none-match': etag } });
    expect(cached.status).toBe(304);
    expect(cached.body).toBe('');
    expect(cached.headers.etag).toBe(etag);

    // Comparação fraca e lista de ETags, como em /view.
    const listed = await call(server, 'GET', '/catalog', {
      headers: { 'if-none-match': `"velho", ${etag.replace(/^W\//, '')}` },
    });
    expect(listed.status).toBe(304);

    const stale = await call<CatalogResponse>(server, 'GET', '/catalog', {
      headers: { 'if-none-match': 'W/"0000"' },
    });
    expect(stale.status).toBe(200);
    expect(stale.body).toEqual(first.body);
    expect(stale.headers.etag).toBe(etag);
  });

  it('um token inválido não atrapalha: a rota não olha a sessão', async () => {
    const reply = await call<CatalogResponse>(server, 'GET', '/catalog', { token: 'não-é-um-jwt' });
    expect(reply.status).toBe(200);
  });

  it('o ritmo padrão é o GAME_TIME_SCALE do servidor quando ele é um dos oferecidos', async () => {
    const normal = await call<CatalogResponse>(server, 'GET', '/catalog');
    const fast = await call<CatalogResponse>(production, 'GET', '/catalog');
    expect(fast.body.newGame.defaults).toEqual({ difficulty: 'lord', timeScale: 3 });
    // O conteúdo é o mesmo; só o padrão muda, e com ele o ETag.
    expect({ ...fast.body.newGame, defaults: null }).toEqual({
      ...normal.body.newGame,
      defaults: null,
    });
    expect(fast.body.contentHash).toBe(normal.body.contentHash);
    expect(fast.headers.etag).not.toBe(normal.headers.etag);
  });

  it('GAME_TIME_SCALE fora da lista: as boas-vindas marcam o ritmo recomendado', async () => {
    const reply = await call<CatalogResponse>(odd, 'GET', '/catalog');
    expect(CatalogResponseSchema.safeParse(reply.body).error).toBeUndefined();
    expect(reply.body.newGame.defaults).toEqual({ difficulty: 'lord', timeScale: 3 });
    expect(reply.body.newGame.paces.map((pace) => pace.timeScale)).toEqual([3, 1, 0.5]);
  });
});

describe('o catálogo e a criação de partida dizem o mesmo', () => {
  it('toda opção do catálogo é aceita por POST /games e aparece na visão com o mesmo rótulo', async () => {
    const { newGame } = (await call<CatalogResponse>(production, 'GET', '/catalog')).body;
    for (const difficulty of newGame.difficulties) {
      for (const pace of newGame.paces) {
        const auth = await signUp(production);
        const created = await call<CreateGameResponse>(production, 'POST', '/games', {
          token: auth.accessToken,
          body: {
            settlementName: 'Pedra Alta',
            timezone: 'UTC',
            vigilHourLocal: 20,
            difficulty: difficulty.id,
            timeScale: pace.timeScale,
          },
        });
        expect(created.status, `${difficulty.id} × ${pace.timeScale}`).toBe(201);
        expect(created.body.game).toMatchObject({
          difficulty: difficulty.id,
          timeScale: pace.timeScale,
        });
        const view = await call<ViewResponse>(
          production,
          'GET',
          `/games/${created.body.game.id}/view`,
          { token: auth.accessToken },
        );
        expect(view.body.view.settlement).toMatchObject({
          difficulty: difficulty.id,
          difficultyLabel: difficulty.label,
          paceLabel: `${pace.label}: ${pace.description}`,
        });
      }
    }
  });

  it('quem cria sem escolher recebe os padrões que o catálogo anuncia', async () => {
    for (const instance of [server, production]) {
      const { defaults } = (await call<CatalogResponse>(instance, 'GET', '/catalog')).body.newGame;
      const auth = await signUp(instance);
      const created = await call<CreateGameResponse>(instance, 'POST', '/games', {
        token: auth.accessToken,
        body: { settlementName: 'Pedra Alta', timezone: 'UTC', vigilHourLocal: 20 },
      });
      expect(created.status).toBe(201);
      expect(created.body.game).toMatchObject(defaults);
    }
  });
});
