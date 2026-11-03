import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { call, createTestApp, newPlayer, type TestApp } from './helpers/app';
import { resetTestDb } from './helpers/db';

// Crônica do Ano em Markdown vista pela API (V4G-T3; GDD §11.4; Apêndice E):
// GET /games/:id/years/:year/chronicle.md
// NOTA: Estes testes de integração foram escritos sem execução local direta,
// respeitando a instrução da tarefa ("Os testes de integração do endpoint: escreva, sem rodar, e diga isso").

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp({ config: { GAME_TIME_SCALE: '1' } });
});

afterAll(async () => {
  await server.close();
});

describe('GET /games/:id/years/:year/chronicle.md', () => {
  it('responde 404 se a Crônica do ano pedido ainda não foi concluída', async () => {
    const who = await newPlayer(server);
    const reply = await call<string>(server, 'GET', `/games/${who.game.id}/years/1/chronicle.md`, {
      token: who.token,
    });
    expect(reply.status).toBe(404);
  });

  it('responde 404 se o número do ano for inválido ou menor que 1', async () => {
    const who = await newPlayer(server);
    const zeroReply = await call<string>(
      server,
      'GET',
      `/games/${who.game.id}/years/0/chronicle.md`,
      { token: who.token },
    );
    expect(zeroReply.status).toBe(404);

    const textReply = await call<string>(
      server,
      'GET',
      `/games/${who.game.id}/years/invalido/chronicle.md`,
      { token: who.token },
    );
    expect(textReply.status).toBe(404);
  });

  it('responde 404 se a partida for de outro jogador', async () => {
    const owner = await newPlayer(server);
    const other = await newPlayer(server);

    const reply = await call<string>(
      server,
      'GET',
      `/games/${owner.game.id}/years/1/chronicle.md`,
      { token: other.token },
    );
    expect(reply.status).toBe(404);
  });

  it('responde 200 com Markdown estruturado quando o evento yearEnded existe', async () => {
    const who = await newPlayer(server);

    // Grava o evento yearEnded diretamente no banco para simular a virada do ano
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        100,
        now(),
        'yearEnded',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: 84 * 2 * 3600 * 1000,
          text: 'Encerra-se o ano 1 da Casa de Pedra Alta.',
          data: {
            year: 1,
            populationMax: 30,
            battles: 4,
            battlesWon: 4,
            expeditions: 3,
            cards: 5,
            siegeResult: 'victory',
            score: 285,
            feats: 'firstWinter,feint',
          },
        }),
      ],
    );

    const reply = await call<string>(server, 'GET', `/games/${who.game.id}/years/1/chronicle.md`, {
      token: who.token,
    });

    expect(reply.status).toBe(200);
    expect(reply.headers['content-type']).toContain('text/markdown');
    expect(reply.body).toContain('# Crônica do Ano 1 — Pedra Alta');
    expect(reply.body).toContain('## Primavera');
    expect(reply.body).toContain('## Verão');
    expect(reply.body).toContain('## Outono');
    expect(reply.body).toContain('## Inverno');
    expect(reply.body).toContain('## O Cerco do Inverno');
    expect(reply.body).toContain('Vitória — o feudo resistiu, apesar das brechas.');
    expect(reply.body).toContain('## O ano em números');
    expect(reply.body).toContain('| População máxima | 30 |');
    expect(reply.body).toContain('## Pontuação');
    expect(reply.body).toContain('285 pontos.');
    expect(reply.body).toContain('## Feitos do ano');
    expect(reply.body).toContain('Primeiro Inverno');
  });

  it('suporta query ?links=1 para marcas de expedição', async () => {
    const who = await newPlayer(server);

    // Evento de expedição no ano 1
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        50,
        now(),
        'expeditionSent',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: 10 * 2 * 3600 * 1000,
          text: 'No 5º dia da Primavera, a expedição partiu.',
          data: { expeditionId: 'expedition-99' },
        }),
      ],
    );

    // Evento yearEnded no ano 1
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        100,
        now(),
        'yearEnded',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: 84 * 2 * 3600 * 1000,
          text: 'Encerra-se o ano 1 da Casa de Pedra Alta.',
          data: {
            year: 1,
            populationMax: 20,
            battles: 0,
            battlesWon: 0,
            expeditions: 1,
            cards: 0,
            siegeResult: 'none',
            score: 25,
            feats: '',
          },
        }),
      ],
    );

    const replyLinked = await call<string>(
      server,
      'GET',
      `/games/${who.game.id}/years/1/chronicle.md?links=1`,
      { token: who.token },
    );
    expect(replyLinked.status).toBe(200);
    expect(replyLinked.body).toContain('<!-- expedition-99 -->');

    const replyClean = await call<string>(
      server,
      'GET',
      `/games/${who.game.id}/years/1/chronicle.md?links=0`,
      { token: who.token },
    );
    expect(replyClean.status).toBe(200);
    expect(replyClean.body).not.toContain('<!-- expedition-99 -->');
  });

  it('ano 2 não contém eventos do ano 1 duplicados', async () => {
    const who = await newPlayer(server);

    const yearMs = 84 * 2 * 3600 * 1000;

    // Evento ano 1
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        20,
        now(),
        'constructionFinished',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: 5 * 2 * 3600 * 1000,
          text: 'Obra concluída no ano 1.',
          data: {},
        }),
      ],
    );

    // yearEnded ano 1
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        100,
        now(),
        'yearEnded',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: yearMs,
          text: 'Encerra-se o ano 1 da Casa de Pedra Alta.',
          data: {
            year: 1,
            populationMax: 20,
            battles: 1,
            battlesWon: 1,
            expeditions: 1,
            cards: 1,
            siegeResult: 'victory',
            score: 150,
            feats: 'firstWinter',
          },
        }),
      ],
    );

    // Evento ano 2
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        120,
        now(),
        'constructionFinished',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: yearMs + 5 * 2 * 3600 * 1000,
          text: 'Obra concluída no ano 2.',
          data: {},
        }),
      ],
    );

    // yearEnded ano 2
    await server.pool.query(
      `insert into game_events (game_id, seq, at, kind, payload) values (
        $1,
        200,
        now(),
        'yearEnded',
        $2::jsonb
      )`,
      [
        who.game.id,
        JSON.stringify({
          atMs: 2 * yearMs,
          text: 'Encerra-se o ano 2 da Casa de Pedra Alta.',
          data: {
            year: 2,
            populationMax: 35,
            battles: 3,
            battlesWon: 3,
            expeditions: 2,
            cards: 4,
            siegeResult: 'glorious',
            score: 310,
            feats: 'firstWinter,intactWall',
          },
        }),
      ],
    );

    const replyYear2 = await call<string>(
      server,
      'GET',
      `/games/${who.game.id}/years/2/chronicle.md`,
      { token: who.token },
    );
    expect(replyYear2.status).toBe(200);
    expect(replyYear2.body).toContain('# Crônica do Ano 2 — Pedra Alta');
    expect(replyYear2.body).toContain('Obra concluída no ano 2.');
    expect(replyYear2.body).not.toContain('Obra concluída no ano 1.');
  });
});
