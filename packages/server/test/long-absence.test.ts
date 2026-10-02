import { performance } from 'node:perf_hooks';

import type { EventsResponse, ViewResponse } from '@lotg/protocol';
import { EventsResponseSchema, ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  DAY,
  newPlayer,
  order,
  type Player,
  renew,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// A volta de uma ausência longa no ritmo Rápido, de uma vez só (roadmap da v0.2, V2C-T7.4 e
// cenário QA-02). Em produção o job `advance-stale-games` avança a partida a cada hora, e a
// volta encontra pouco por fazer; este é o pior caso, o do servidor que ficou parado: a
// primeira leitura atravessa a ausência inteira em uma transação e grava todos os eventos dela.
// Os tempos medidos estão em docs/balance-v0.2.md (seção 9.7); aqui só se cobra um teto folgado.

const PACE = 3;
/** Um dia de jogo dura 2 h de jogo: no ritmo 3, 36 viradas por dia real. */
const TURNS_PER_REAL_DAY = (24 * PACE) / 2;
/** Teto folgado para a leitura da volta, em qualquer máquina: a medida local fica em dezenas de ms. */
const CEILING_MS = 5_000;

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp({ config: { GAME_TIME_SCALE: String(PACE) } });
});
afterAll(async () => {
  await server.close();
});

/** Um feudo com gente trabalhando e obras planejadas para começar sozinhas. */
async function settle(player: Player): Promise<void> {
  const orders = [
    order('setWorkers', { building: 'farm', count: 2 }),
    order('setWorkers', { building: 'lumberMill', count: 1 }),
    order('setWorkers', { building: 'quarry', count: 1 }),
    order('setWorkers', { building: 'goldMine', count: 1 }),
    order('startConstruction', { building: 'housing' }),
    order('planConstruction', { building: 'farm', autoStart: true }),
    order('planConstruction', { building: 'lumberMill', autoStart: true }),
    order('planConstruction', { building: 'townHall', autoStart: true }),
  ];
  for (const command of orders) {
    const reply = await send(server, player.token, player.game.id, command);
    expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  }
}

describe('a volta de uma ausência longa no ritmo Rápido', () => {
  // A sessão vale 30 dias: 29 é a ausência mais longa que ainda volta sem novo login.
  it.each([1, 7, 29])(
    'depois de %i dias reais, a primeira leitura atravessa tudo de uma vez',
    async (days) => {
      const player = await newPlayer(server, `Ausente ${days}`);
      await settle(player);
      const game = `game_id = '${player.game.id}'`;
      const eventsBefore = await countRows(server.pool, 'game_events', game);
      const before = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
        token: player.token,
      });

      server.clock.advance(days * DAY);
      await renew(server, player);

      const start = performance.now();
      const back = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
        token: player.token,
      });
      const viewMs = performance.now() - start;
      expect(back.status).toBe(200);
      expect(ViewResponseSchema.safeParse(back.body).error).toBeUndefined();
      // Uma leitura, uma escrita: a ausência inteira cabe em um incremento de versão.
      expect(BigInt(back.body.stateVersion)).toBe(BigInt(before.body.stateVersion) + 1n);
      expect(viewMs).toBeLessThan(CEILING_MS);

      // Os eventos da ausência estão gravados: ao menos um por virada de dia de jogo.
      const emitted = (await countRows(server.pool, 'game_events', game)) - eventsBefore;
      expect(emitted).toBeGreaterThanOrEqual(days * TURNS_PER_REAL_DAY);

      // O cliente os busca em páginas, do cursor que tinha até não haver mais.
      let cursor = eventsBefore;
      let pages = 0;
      let fetched = 0;
      const pagingStart = performance.now();
      for (;;) {
        const page = await call<EventsResponse>(
          server,
          'GET',
          `/games/${player.game.id}/events?after=${cursor}&limit=500`,
          { token: player.token },
        );
        expect(page.status).toBe(200);
        expect(EventsResponseSchema.safeParse(page.body).error).toBeUndefined();
        pages += 1;
        fetched += page.body.events.length;
        cursor = page.body.lastSeq;
        if (!page.body.hasMore) {
          break;
        }
      }
      const pagingMs = performance.now() - pagingStart;
      expect(fetched).toBe(emitted);

      // Uma segunda leitura, sem tempo passado, não avança nem grava nada.
      const again = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
        token: player.token,
      });
      expect(again.body.stateVersion).toBe(back.body.stateVersion);

      console.info(
        `ausência de ${days} dias reais no ritmo ${PACE}: GET /view ${viewMs.toFixed(1)} ms, ` +
          `${emitted} eventos gravados, corpo de ${Buffer.byteLength(JSON.stringify(back.body))} bytes; ` +
          `GET /events em ${pages} páginas de até 500, ${pagingMs.toFixed(1)} ms`,
      );
    },
  );
});
