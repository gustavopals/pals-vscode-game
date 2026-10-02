import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createInitialState, type GameState } from '@lotg/engine';
import type {
  ChronicleResponse,
  CommandAccepted,
  EventsResponse,
  GameEvent,
  GameRuleError,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// A Torre de Vigia, os tiles e a Ameaça (V2E-T1; GDD §8.2; ADR 0014, decisão 11) vistos pela
// API. O que importa aqui é a névoa: a Ameaça sobe no estado de todo feudo, mas só sai do
// servidor, na visão e nos eventos, para quem tem a Torre.

const PACE = 3;
/** Um dia de jogo, em tempo de jogo. */
const GAME_DAY = 2 * HOUR;
const REPLAYED = 'x-lords-replayed';

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

type Session = { token: string; refreshToken: string };

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, who: Session, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, who);
}

async function viewOf(server: TestApp, who: Session, gameId: string): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(server: TestApp, who: Session, gameId: string): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events?limit=500`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.events;
}

async function chronicleOf(server: TestApp, who: Session, gameId: string): Promise<string[]> {
  const reply = await call<ChronicleResponse>(server, 'GET', `/games/${gameId}/chronicle`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  return reply.body.entries.map((entry) => entry.text);
}

async function storedState(server: TestApp, gameId: string) {
  const { rows } = await server.pool.query<{ schema_version: number; state: GameState }>(
    'select schema_version, state from games where id = $1',
    [gameId],
  );
  const [row] = rows;
  if (row === undefined) {
    throw new Error('A partida do teste não está no banco.');
  }
  return row;
}

/**
 * Grava uma partida com o estado dado, com o relógio de jogo onde ele parou. É como o teste
 * chega a um feudo que já pode erguer a Torre sem jogar o caminho inteiro pela API.
 */
async function insertGame(
  server: TestApp,
  state: { schemaVersion: number; seed: string; lastProcessedAt: number },
  timeScale: number,
) {
  const auth = await signUp(server, 'Senhor da Torre');
  const now = server.clock.now().getTime();
  const id = randomUUID();
  await server.pool.query(
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

/** Um feudo novo com o Salão no nível 2 e o estoque para a Torre: só falta dar a ordem. */
function readyForTower(seed: string, timeScale: number): GameState {
  const state = createInitialState(seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale,
  });
  state.settlement.buildings.townHall = 2;
  state.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
  state.settlement.resources = { food: 400_000, wood: 450_000, stone: 450_000, gold: 300_000 };
  return state;
}

const BLIND = {
  known: false,
  text: 'Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo.',
  incoming: null,
  defense: {
    building: 'palisade',
    palisadeLevel: 0,
    text: 'Sem Paliçada, nada segura um ataque.',
    next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
  },
};

describe('sem a Torre de Vigia, a Ameaça não sai do servidor', () => {
  it('a visão diz só que ninguém sabe; o número fica no estado, e nenhum evento o conta', async () => {
    const who = await newPlayer(normal);
    const start = await viewOf(normal, who, who.game.id);
    expect(start.threat).toEqual({
      ...BLIND,
      watchtower: {
        building: 'watchtower',
        level: 0,
        text: 'Sem Torre de Vigia, ninguém vê a Ameaça crescer nem avisa de um ataque.',
        next: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
      },
    });

    // 30 h reais no ritmo 1 são 15 dias de jogo: a Ameaça passou dos 40 e dos 70.
    await wait(normal, who, 30 * HOUR);
    const later = await viewOf(normal, who, who.game.id);
    expect(later.threat).toEqual(start.threat);
    expect((await storedState(normal, who.game.id)).state.map.threat).toBe(75);

    const events = await eventsOf(normal, who, who.game.id);
    expect(events.filter((event) => event.type === 'threatRose')).toEqual([]);
    for (const event of events) {
      expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
    }
    expect((await chronicleOf(normal, who, who.game.id)).join('\n')).not.toMatch(/Ameaça|vigias/);
  });

  it('a Torre aparece na lista de obras presa ao Salão no nível 2, com o que ela dá', async () => {
    const who = await newPlayer(normal);
    const view = await viewOf(normal, who, who.game.id);
    const tower = view.constructions.available.find((entry) => entry.building === 'watchtower');
    expect(tower).toMatchObject({
      label: 'Torre de Vigia',
      fromLevel: 0,
      targetLevel: 1,
      blockedCode: 'GATE_LOCKED',
      effect: 'Mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência.',
    });
    const refused = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('startConstruction', { building: 'watchtower' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.code).toBe('GATE_LOCKED');
    expect(refused.body.message).toBe('Melhore antes o Salão do Senhor para o nível 2.');
  });
});

describe('com a Torre de Vigia', () => {
  it('a ordem passa pelo recibo; pronta a Torre, a visão mostra a Ameaça e a Crônica conta os uivos', async () => {
    const game = await insertGame(normal, readyForTower('torre-normal', 1), 1);
    const build = order('startConstruction', { building: 'watchtower' });
    const first = await send<CommandAccepted>(normal, game.token, game.id, build);
    expect(first.status).toBe(200);
    expect(first.body.view.threat.known).toBe(false);
    const stone = (view: ViewState) => view.resources.find((row) => row.id === 'stone')?.stock;
    expect(stone(first.body.view)).toBe(330);
    // Reenviar a mesma ordem devolve o recibo: a Torre não é paga duas vezes.
    const again = await send<CommandAccepted>(normal, game.token, game.id, build);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(stone(await viewOf(normal, game, game.id))).toBe(330);

    // 12 minutos depois a Torre está pronta, e a Ameaça ainda está em zero: o dia não virou.
    await wait(normal, game, 12 * MINUTE);
    const built = await viewOf(normal, game, game.id);
    expect(built.threat).toMatchObject({
      known: true,
      text: 'Ameaça 0 de 100.',
      level: 0,
      nextLevel: 5,
      risePerDay: 5,
      nextRiseInSeconds: (GAME_DAY - 12 * MINUTE) / 1000,
      trend: 'Sobe 5 a cada dia de jogo (2 h): na próxima virada, vai de 0 para 5.',
      sources: ['+5/dia: Covil de Lobos'],
      tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: true }],
      incoming: null,
      watchtower: { level: 1 },
    });

    // 16 h reais depois da fundação (8 dias de jogo) a Ameaça chega a 40: a primeira linha.
    await wait(normal, game, 16 * HOUR - 12 * MINUTE);
    const at40 = await viewOf(normal, game, game.id);
    expect(at40.threat).toMatchObject({ known: true, level: 40, nextLevel: 45 });
    const rose = (await eventsOf(normal, game, game.id)).filter(
      (event) => event.type === 'threatRose',
    );
    expect(rose.map((event) => event.data)).toEqual([{ threat: 40, previousThreat: 35, mark: 40 }]);
    expect(await chronicleOf(normal, game, game.id)).toContain(
      'No 9º dia da Primavera, os vigias de Pedra Alta contam mais uivos a cada noite. A Ameaça chegou a 40.',
    );
    expect((await storedState(normal, game.id)).state.settlement.buildings.watchtower).toBe(1);
  });

  it('no ritmo Rápido os prazos e as antecedências saem em tempo real', async () => {
    const game = await insertGame(fast, readyForTower('torre-rapida', PACE), PACE);
    const reply = await send<CommandAccepted>(
      fast,
      game.token,
      game.id,
      order('startConstruction', { building: 'watchtower' }),
    );
    expect(reply.status).toBe(200);
    const tower = (view: ViewState) =>
      view.constructions.available.find((entry) => entry.building === 'watchtower');
    // 12 min de jogo são 4 min reais.
    await wait(fast, game, 4 * MINUTE);
    const view = await viewOf(fast, game, game.id);
    expect(view.threat).toMatchObject({
      known: true,
      level: 0,
      nextRiseInSeconds: 36 * 60,
      trend: 'Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 0 para 5.',
      watchtower: {
        level: 1,
        text: 'Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 20 min de antecedência.',
        next: 'Torre de Vigia Nv2: avisa com 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão.',
      },
    });
    expect(tower(view)).toMatchObject({
      targetLevel: 2,
      durationSeconds: 6 * 60,
      effect:
        'Aviso de incursão: de 20 min para 40 min de antecedência. Os vigias passam a dizer o tamanho dela.',
    });

    // O nível 2 é o teto desta versão: sai da lista, e a recusa diz que o resto vem depois.
    const second = await send<CommandAccepted>(
      fast,
      game.token,
      game.id,
      order('startConstruction', { building: 'watchtower' }),
    );
    expect(second.status).toBe(200);
    await wait(fast, game, 6 * MINUTE);
    const top = await viewOf(fast, game, game.id);
    expect(tower(top)).toBeUndefined();
    expect(top.threat.watchtower).toEqual({
      building: 'watchtower',
      level: 2,
      text: 'Torre de Vigia Nv2: mostra a Ameaça com a explicação, avisa de uma incursão com 40 min de antecedência e diz o tamanho dela. Os níveis seguintes chegam em versões futuras do jogo.',
      next: null,
    });
    const refused = await send<GameRuleError>(
      fast,
      game.token,
      game.id,
      order('startConstruction', { building: 'watchtower' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body.details.code).toBe('MAX_LEVEL');
    expect(refused.body.message).toBe(
      'A Torre de Vigia já está no nível máximo. Os níveis seguintes chegam em versões futuras do jogo.',
    );
  });

  it('dois feudos no mesmo relógio: só o que tem a Torre vê o número', async () => {
    const blind = await newPlayer(normal);
    const watcher = await insertGame(normal, readyForTower('torre-vizinha', 1), 1);
    await send(
      normal,
      watcher.token,
      watcher.id,
      order('startConstruction', { building: 'watchtower' }),
    );
    await wait(normal, blind, 20 * HOUR);
    await renew(normal, watcher);
    const seen = await viewOf(normal, watcher, watcher.id);
    const unseen = await viewOf(normal, blind, blind.game.id);
    expect(seen.threat).toMatchObject({ known: true, level: 50 });
    expect(unseen.threat).toMatchObject(BLIND);
    expect(Object.keys(unseen.threat).sort()).toEqual([
      'defense',
      'incoming',
      'known',
      'text',
      'watchtower',
    ]);
    // Os dois estados têm a mesma Ameaça: a diferença é só o que sai do servidor.
    expect((await storedState(normal, blind.game.id)).state.map.threat).toBe(50);
    expect((await storedState(normal, watcher.id)).state.map.threat).toBe(50);
  });
});

describe('uma partida gravada antes da Ameaça (estado na versão 8)', () => {
  type StoredState = {
    schemaVersion: number;
    seed: string;
    lastProcessedAt: number;
    settings: { timeScale: number };
    settlement: { buildings: Record<string, number> };
  };

  function v8State(name: string): StoredState {
    const url = new URL(`../../engine/src/__fixtures__/state-v8-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as StoredState;
  }

  it('entra com a Torre por construir, o covil ativo e a Ameaça em zero, que sobe dali em diante', async () => {
    // O feudo que veio da v0.1, no ritmo 3, no ano 4: a ausência toda foi simulada sem a Ameaça.
    const before = v8State('migrated-3x');
    expect(before.schemaVersion).toBe(8);
    expect(before).not.toHaveProperty('map');
    expect(before.settlement.buildings).not.toHaveProperty('watchtower');
    const game = await insertGame(fast, before, before.settings.timeScale);
    const view = await viewOf(fast, game, game.id);
    expect(view.threat).toMatchObject(BLIND);

    const row = await storedState(fast, game.id);
    // Gravada na versão atual: a 9 trouxe a Ameaça, e a 10, a Paliçada por construir.
    expect(row.schema_version).toBe(10);
    expect(row.state.schemaVersion).toBe(10);
    expect(row.state.settlement.buildings.palisade).toBe(0);
    expect(row.state.map).toEqual({
      tiles: { wolfDen: { type: 'wolfDen', threatActive: true } },
      threat: 0,
    });
    expect(row.state.horde).toEqual({ scheduledRaids: [] });
    expect(row.state.settlement.buildings.watchtower).toBe(0);
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);

    // Um dia de jogo depois (40 min reais no ritmo 3), a primeira subida; e a Torre pode ser
    // erguida: o Salão desse feudo já passou do nível 2.
    await wait(fast, game, 40 * MINUTE);
    await viewOf(fast, game, game.id);
    expect([5, 8]).toContain((await storedState(fast, game.id)).state.map.threat);
    const tower = (await viewOf(fast, game, game.id)).constructions.available.find(
      (entry) => entry.building === 'watchtower',
    );
    expect(tower).toMatchObject({ fromLevel: 0, targetLevel: 1 });
    expect(tower?.blockedCode).not.toBe('GATE_LOCKED');
    const events = await eventsOf(fast, game, game.id);
    expect(events.filter((event) => event.type === 'threatRose')).toEqual([]);
  });
});
