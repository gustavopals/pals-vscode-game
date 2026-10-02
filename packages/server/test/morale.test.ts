import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ChronicleResponse,
  CommandAccepted,
  EventsResponse,
  GameEvent,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  type Player,
  renew,
  send,
  signUp,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// A moral (V2C-T4; GDD §5.6 e §5.7; ADR 0013, decisões 1, 19 e 19a) vista pela API: o número, a
// faixa e a conta termo a termo chegam prontos na visão, em tempo real; a moral só muda na
// virada do dia de jogo, com o jogador presente ou não; quem parte e quem deserta vira evento e
// linha da Crônica, uma vez só; e uma partida gravada antes da moral entra nela com 50.

const PACE = 3;
const DAY = 2 * HOUR;
const REPLAYED = 'x-lords-replayed';
const MORALE_EVENTS = ['moraleBandChanged', 'villagerArrived', 'villagerLeft', 'villagerDeserted'];

/** Instância no ritmo Normal do GDD. */
let normal: TestApp;
/** Instância no ritmo Rápido: a hora real vale três de jogo. */
let fast: TestApp;

beforeAll(async () => {
  await resetTestDb();
  normal = await createTestApp({ config: { GAME_TIME_SCALE: '1' } });
  fast = await createTestApp({ config: { GAME_TIME_SCALE: String(PACE) } });
});
afterAll(async () => {
  await normal.close();
  await fast.close();
});

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, who: { token: string }, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, who as Player);
}

async function viewOf(server: TestApp, who: { token: string }, gameId: string): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(
  server: TestApp,
  who: { token: string },
  gameId: string,
): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events?limit=500`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.events;
}

const moraleOnly = (events: GameEvent[]) =>
  events.filter((event) => MORALE_EVENTS.includes(event.type));
const story = (events: GameEvent[]) =>
  events.map(({ type, atMs, text, data }) => ({ type, atMs, text, data }));

describe('a moral na visão, em tempo real', () => {
  it.each([
    ['Normal', 1, () => normal, 'Comida guardada para 24 h'],
    ['Rápido', PACE, () => fast, 'Comida guardada para 8 h'],
  ] as const)(
    'no ritmo %s: nasce em 50, diz para onde vai e muda na virada do dia',
    async (_label, pace, app, reserve) => {
      const server = app();
      const who = await newPlayer(server);
      const day = DAY / pace;
      const start = await viewOf(server, who, who.game.id);
      expect(start.morale).toMatchObject({
        value: 50,
        band: 'content',
        bandLabel: 'Contente',
        multiplierPercent: 100,
        text: 'Moral 50 (Contente): não mexe na produção.',
        terms: [
          { id: 'base', label: 'Base', amount: 50 },
          { id: 'foodReserve', label: reserve, amount: 10 },
        ],
        // O prazo é o da virada do dia de jogo, em segundos reais.
        nextUpdateInSeconds: day / 1000,
        next: { value: 60, band: 'content', bandLabel: 'Contente', multiplierPercent: 105 },
        nextText: 'A moral só muda na virada do dia: na próxima, sobe de 50 para 60 (Contente).',
        advice: null,
        notes: [],
        effects: [],
      });

      // Um minuto real antes da virada, ainda 50; na virada, 60, e a produção já a leva.
      await send<CommandAccepted>(
        server,
        who.token,
        who.game.id,
        order('setWorkers', { building: 'lumberMill', count: 2 }),
      );
      await wait(server, who, day - MINUTE);
      const before = await viewOf(server, who, who.game.id);
      expect(before.morale).toMatchObject({ value: 50, nextUpdateInSeconds: 60 });
      await wait(server, who, MINUTE);
      const after = await viewOf(server, who, who.game.id);
      expect(after.morale).toMatchObject({
        value: 60,
        multiplierPercent: 105,
        text: 'Moral 60 (Contente): produção × 1,05.',
        nextUpdateInSeconds: day / 1000,
        nextText: 'A moral só muda na virada do dia: na próxima, continua em 60.',
      });
      expect(after.workers.find((row) => row.building === 'lumberMill')?.breakdown).toContain(
        '× 1,05 (moral 60)',
      );
      // Subir dentro da mesma faixa não é notícia: nenhum evento de moral.
      expect(moraleOnly(await eventsOf(server, who, who.game.id))).toEqual([]);
    },
  );

  it('o estado do gerador de sorteios nunca sai do servidor', async () => {
    const who = await newPlayer(fast);
    // Um dia real sem ninguém: a moral despenca e o fluxo `morale` sorteia a cada virada.
    await wait(fast, who, 24 * HOUR);
    const reply = await call<ViewResponse>(fast, 'GET', `/games/${who.game.id}/view`, {
      token: who.token,
    });
    const { rows } = await fast.pool.query<{ state: { rng: Record<string, number[]> } }>(
      'select state from games where id = $1',
      [who.game.id],
    );
    const words = rows[0]?.state.rng.morale ?? [];
    expect(words).toHaveLength(4);
    const body = JSON.stringify(reply.body);
    expect(body).not.toContain('"rng"');
    for (const word of words) {
      expect(body).not.toContain(String(word));
    }
  });
});

describe('o feudo abandonado: fome, moral baixa e quem vai embora', () => {
  it('no ritmo Rápido, em 16 h reais o feudo está no piso, e a visão diz o porquê e o que fazer', async () => {
    const who = await newPlayer(fast);
    const created = new Date(who.game.createdAt).getTime();
    // 37 h de jogo: a fome abriu às 36 h, e a moral ainda é a da última virada.
    await wait(fast, who, (37 * HOUR) / PACE);
    const hungry = await viewOf(fast, who, who.game.id);
    expect(hungry.famine).not.toBeNull();
    expect(hungry.morale).toMatchObject({
      value: 50,
      next: { value: 28, band: 'restless', bandLabel: 'Inquieto', multiplierPercent: 89 },
      breakdown: '50 (base) − 20 (fome) − 2 (1 dia inteiro de fome) = 28',
      nextText: 'A moral só muda na virada do dia: na próxima, cai de 50 para 28 (Inquieto).',
      advice:
        'O que mais pesa é a fome (−22). Ponha mais gente na Fazenda: quando a comida voltar a sobrar, a fome acaba e a moral sobe na virada seguinte.',
      // 12 h de jogo de fome são 4 h reais; a primeira virada com elas completas é às 48 h.
      notes: [
        'Depois de 4 h de fome, um aldeão deserta a cada virada do dia. Faltam 3 h 40 min para o primeiro.',
      ],
    });

    // 60 h de jogo (20 h reais): a moral caiu duas faixas e dois aldeões se foram.
    await wait(fast, who, (23 * HOUR) / PACE);
    const view = await viewOf(fast, who, who.game.id);
    expect(view.population.villagers).toBe(3);
    expect(view.morale).toMatchObject({ value: 6, band: 'desperate', bandLabel: 'Desesperado' });
    expect(view.morale.notes).toEqual([
      'Restam 3 aldeões: com 3 ou menos, ninguém mais parte nem deserta.',
    ]);

    const events = await eventsOf(fast, who, who.game.id);
    const moved = moraleOnly(events);
    expect(moved.map((event) => [event.type, event.atMs / DAY])).toEqual([
      ['moraleBandChanged', 19],
      ['moraleBandChanged', 21],
      ['villagerLeft', 24],
      ['villagerDeserted', 24],
    ]);
    expect(moved.map((event) => event.text)).toEqual([
      'No 20º dia da Primavera, o povo de Pedra Alta anda inquieto. Há resmungos junto ao poço.',
      'No 22º dia da Primavera, o povo de Pedra Alta perdeu a esperança. Já se fala em ir embora.',
      'No 1º dia do Verão, um aldeão sem ofício juntou a trouxa e deixou Pedra Alta: o povo anda sem ânimo. Restam 4.',
      'No 1º dia do Verão, um aldeão sem ofício fugiu da fome de Pedra Alta na calada da noite. Restam 3.',
    ]);
    expect(moved[0]?.data).toEqual({
      morale: 28,
      band: 'restless',
      previousMorale: 50,
      previousBand: 'content',
    });
    expect(moved[2]?.data).toEqual({ villagers: 4, morale: 18 });
    // O instante real de cada evento é o da criação mais um terço do instante de jogo.
    for (const event of moved) {
      expect(new Date(event.at).getTime(), event.type).toBe(created + event.atMs / PACE);
    }

    // São notícia: linhas da Crônica.
    const chronicle = await call<ChronicleResponse>(
      fast,
      'GET',
      `/games/${who.game.id}/chronicle?limit=500`,
      { token: who.token },
    );
    expect(story(moraleOnly(chronicle.body.entries))).toEqual(story(moved));

    // Ler de novo, no mesmo instante, não grava nem sorteia nada.
    const again = await eventsOf(fast, who, who.game.id);
    expect(again).toEqual(events);
  });

  it('o job de avanço encontra o mesmo mundo que a leitura: os mesmos eventos, uma vez', async () => {
    const reader = await newPlayer(fast);
    const sleeper = await newPlayer(fast);
    fast.clock.advance(20 * HOUR);
    // O job grava a ausência de quem não voltou; a leitura, a de quem voltou.
    await runJobsOnce(fast.ctx);
    await renew(fast, reader);
    await renew(fast, sleeper);
    await viewOf(fast, reader, reader.game.id);
    const read = await eventsOf(fast, reader, reader.game.id);
    const slept = await eventsOf(fast, sleeper, sleeper.game.id);
    // As duas partidas têm a mesma semente: o mesmo sorteio, na mesma virada.
    expect(story(moraleOnly(slept))).toEqual(story(moraleOnly(read)));
    expect(moraleOnly(slept).map((event) => event.type)).toEqual([
      'moraleBandChanged',
      'moraleBandChanged',
      'villagerLeft',
      'villagerDeserted',
    ]);
    // A leitura depois do job não repete nenhum.
    await viewOf(fast, sleeper, sleeper.game.id);
    expect(await eventsOf(fast, sleeper, sleeper.game.id)).toEqual(slept);
  });

  it('em Camponês a fome não faz ninguém desertar', async () => {
    const auth = await signUp(fast, 'Camponesa');
    const game = await startGame(fast, auth.accessToken, { difficulty: 'peasant' });
    const who = { token: auth.accessToken, refreshToken: auth.refreshToken };
    fast.clock.advance(20 * HOUR);
    await renew(fast, who as Player);
    const view = await viewOf(fast, who, game.id);
    expect(view.settlement.difficultyLabel).toBe('Camponês');
    expect(view.morale.notes).toContain('Em Camponês, ninguém deserta por fome.');
    const events = await eventsOf(fast, who, game.id);
    expect(events.filter((event) => event.type === 'villagerDeserted')).toEqual([]);
    // A moral baixa ainda pode levar alguém, mas nunca abaixo do piso.
    expect(view.population.villagers).toBeGreaterThanOrEqual(3);
    expect(events.filter((event) => event.type === 'villagerLeft')).toHaveLength(
      5 - view.population.villagers,
    );
  });

  it('a ordem reenviada depois de alguém partir devolve o recibo, sem sortear de novo', async () => {
    const who = await newPlayer(fast);
    // 46 h de jogo: a moral está em 24 e cada virada sorteia uma partida.
    await wait(fast, who, (46 * HOUR) / PACE);
    const command = order('setWorkers', { building: 'farm', count: 2 });
    const first = await send<CommandAccepted>(fast, who.token, who.game.id, command);
    expect(first.status).toBe(200);
    const rngOf = async () => {
      const { rows } = await fast.pool.query<{ state: { rng: Record<string, number[]> } }>(
        'select state from games where id = $1',
        [who.game.id],
      );
      return rows[0]?.state.rng;
    };
    const before = await rngOf();
    // O reenvio chega depois de mais viradas terem passado no relógio: o recibo volta como
    // foi, antes de qualquer avanço, e o gerador fica onde estava.
    await wait(fast, who, 10 * MINUTE);
    const again = await send<CommandAccepted>(fast, who.token, who.game.id, command);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(first.body);
    expect(await rngOf()).toEqual(before);
  });
});

describe('uma partida gravada antes da moral (versão 6 do estado)', () => {
  type StoredState = {
    schemaVersion: number;
    seed: string;
    lastProcessedAt: number;
    settings: { timeScale: number };
    settlement: Record<string, unknown> & {
      population: { villagers: number };
      famine: { sinceMs: number } | null;
    };
  };

  function v6State(name: string): StoredState {
    const url = new URL(`../../engine/src/__fixtures__/state-v6-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as StoredState;
  }

  /**
   * Grava a partida como o servidor anterior a deixou, no ritmo que o estado diz, com o relógio
   * de jogo onde ela parou.
   */
  async function insertGame(app: TestApp, state: StoredState) {
    const auth = await signUp(app, 'Senhor Antigo');
    const now = app.clock.now().getTime();
    const id = randomUUID();
    const { timeScale } = state.settings;
    await app.pool.query(
      `insert into games (id, account_id, status, seed, difficulty, time_scale, timezone, vigil_hour,
                          schema_version, state, state_version, last_processed_at, created_at, updated_at)
       values ($1, $2, 'active', $3, 'lord', $4, 'America/Sao_Paulo', 20, $5, $6::jsonb, 7, $7, $8, $7)`,
      [
        id,
        auth.account.id,
        state.seed,
        String(timeScale),
        state.schemaVersion,
        JSON.stringify(state),
        new Date(now),
        // Para baixo: o relógio de jogo nunca fica atrás do estado.
        new Date(now - Math.floor(state.lastProcessedAt / timeScale)),
      ],
    );
    return { id, token: auth.accessToken, refreshToken: auth.refreshToken };
  }

  async function rowOf(app: TestApp, id: string) {
    const { rows } = await app.pool.query<{ schema_version: number; state: StoredState }>(
      'select schema_version, state from games where id = $1',
      [id],
    );
    const [row] = rows;
    if (row === undefined) {
      throw new Error('Partida não encontrada.');
    }
    return row;
  }

  it('entra na moral com 50, sem evento nenhum na fronteira, e é gravada na versão atual', async () => {
    // O feudo que veio da v0.1, no ritmo 3, com estoque alto.
    const before = v6State('migrated-3x');
    expect(before.schemaVersion).toBe(6);
    expect(before.settings.timeScale).toBe(3);
    expect(before.settlement).not.toHaveProperty('morale');
    const game = await insertGame(normal, before);
    const view = await viewOf(normal, game, game.id);
    // A produção de ninguém muda na fronteira: com 50 o fator é × 1.
    expect(view.morale).toMatchObject({ value: 50, band: 'content', multiplierPercent: 100 });
    for (const row of view.workers) {
      expect(row.breakdown).not.toContain('moral');
    }
    const row = await rowOf(normal, game.id);
    expect(row.schema_version).toBe(10);
    expect(row.state.schemaVersion).toBe(10);
    expect(row.state.settlement).toMatchObject({ morale: 50, moraleEffects: [] });
    expect(row.state.settlement.population).toEqual(before.settlement.population);
    expect(moraleOnly(await eventsOf(normal, game, game.id))).toEqual([]);

    // Na primeira virada de dia depois da fronteira a moral é recalculada: é a que a visão
    // prometia.
    await wait(normal, game, view.morale.nextUpdateInSeconds * 1000);
    const turned = await viewOf(normal, game, game.id);
    expect(turned.morale.value).toBe(view.morale.next.value);
  });

  it('fome antiga: ninguém deserta na fronteira; o primeiro vai na primeira virada depois dela', async () => {
    // O retrato tem fome há mais de 12 h de jogo. Nas regras antigas ninguém desertava.
    const before = v6State('famine');
    const sinceMs = before.settlement.famine?.sinceMs ?? 0;
    expect(before.lastProcessedAt - sinceMs).toBeGreaterThan(12 * HOUR);
    const game = await insertGame(normal, before);
    const view = await viewOf(normal, game, game.id);
    expect(view.population.villagers).toBe(before.settlement.population.villagers);
    expect(moraleOnly(await eventsOf(normal, game, game.id))).toEqual([]);
    // A visão avisa antes de acontecer.
    expect(view.morale.notes).toContain(
      'A fome já dura 12 h ou mais: um aldeão deserta a cada virada do dia, até a comida voltar.',
    );

    await wait(normal, game, view.morale.nextUpdateInSeconds * 1000);
    const turned = await viewOf(normal, game, game.id);
    const moved = moraleOnly(await eventsOf(normal, game, game.id));
    const turnMs = (Math.floor(before.lastProcessedAt / DAY) + 1) * DAY;
    expect(moved.map((event) => event.atMs)).toEqual(moved.map(() => turnMs));
    expect(moved.map((event) => event.type)).toContain('villagerDeserted');
    expect(turned.population.villagers).toBeLessThan(before.settlement.population.villagers);
    expect(turned.population.villagers).toBeGreaterThanOrEqual(3);
  });
});
