import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { createInitialState, type GameState } from '@lotg/engine';
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

import { advanceStaleGames } from '../src/jobs/advanceStaleGames';
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

// A incursão de lobos (V2E-T3; GDD §8.2 e §12.3; ADR 0014, decisões 10, 11 e 20) vista pela API:
// o critério 4 da §16.2. A incursão acontece no instante marcado com o senhor fora, resolve-se
// sozinha (no avanço preguiçoso de quem volta, ou no job de quem não volta) e aparece em
// GET /events e na Crônica, com os números que o Relatório de Retorno mostra. A Torre avisa
// antes, a Paliçada muda o desfecho, e nada disso depende de alguém estar olhando.

const PACE = 3;
const SECOND = 1000;
/** Um dia de jogo, em tempo de jogo. */
const GAME_DAY = 2 * HOUR;
/** Os instantes do roteiro, em tempo de jogo: os uivos e os lobos do ano 1. */
const HOWL_AT = 9 * GAME_DAY;
const WOLVES_AT = 15 * GAME_DAY;
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

async function eventsOf(
  server: TestApp,
  who: Session,
  gameId: string,
  after = 0,
): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(
    server,
    'GET',
    `/games/${gameId}/events?after=${after}&limit=500`,
    { token: who.token },
  );
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
 * chega a um feudo com Torre e Paliçada sem jogar o caminho inteiro pela API.
 */
async function insertGame(
  server: TestApp,
  state: { schemaVersion: number; seed: string; lastProcessedAt: number },
  timeScale: number,
) {
  const auth = await signUp(server, 'Senhor dos Lobos');
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
  return { id, token: auth.accessToken, refreshToken: auth.refreshToken, createdAtMs: now };
}

/** Um feudo novo que se alimenta, com a Torre e a Paliçada nos níveis pedidos. */
function feud(
  seed: string,
  timeScale: number,
  levels: { watchtower?: number; palisade?: number } = {},
): GameState {
  const state = createInitialState(seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale,
  });
  state.settlement.buildings = {
    ...state.settlement.buildings,
    townHall: 3,
    watchtower: levels.watchtower ?? 0,
    palisade: levels.palisade ?? 0,
  };
  state.settlement.workers = { farm: 3, lumberMill: 1, quarry: 1, goldMine: 0 };
  state.settlement.resources = { food: 300_000, wood: 300_000, stone: 200_000, gold: 200_000 };
  return state;
}

const ofType = (events: GameEvent[], type: string) => events.filter((event) => event.type === type);
const raidStory = (events: GameEvent[]) =>
  events
    .filter((event) => /^(wolvesHowl|raid|villager(Injured|Recovered))/.test(event.type))
    .map((event) => event.type);
const stock = (view: ViewState, id: 'food' | 'wood') =>
  view.resources.find((row) => row.id === id)?.stock ?? 0;

describe('critério 4: a incursão de lobos acontece com o senhor fora e aparece na volta', () => {
  it('no ritmo Normal: os uivos às 18 h, os lobos às 30 h; quem volta lê tudo em GET /events e na Crônica', async () => {
    const who = await newPlayer(normal);
    const createdAt = new Date(who.game.createdAt).getTime();
    const start = await viewOf(normal, who, who.game.id);
    expect(start.population).toMatchObject({ villagers: 5, injured: 0, injuredNote: null });
    const seenBefore = (await eventsOf(normal, who, who.game.id)).length;

    // O senhor some por 31 horas. Nenhuma leitura, nenhuma ordem: o mundo anda sozinho.
    await wait(normal, who, 31 * HOUR);
    const back = await viewOf(normal, who, who.game.id);
    const events = (await eventsOf(normal, who, who.game.id)).slice(seenBefore);

    expect(raidStory(events)).toEqual(['wolvesHowl', 'raidSuffered', 'villagerInjured']);
    const [howl] = ofType(events, 'wolvesHowl');
    const [raid] = ofType(events, 'raidSuffered');
    const [hurt] = ofType(events, 'villagerInjured');
    // Cada evento com o instante de jogo e o instante real em que aconteceu, não o da leitura.
    expect(howl).toMatchObject({
      atMs: HOWL_AT,
      at: new Date(createdAt + HOWL_AT).toISOString(),
      text: 'No 10º dia da Primavera, ouviram-se uivos na mata ao redor de Pedra Alta. Sem quem vigie, ninguém sabe quantos são.',
    });
    expect(raid).toMatchObject({
      atMs: WOLVES_AT,
      at: new Date(createdAt + WOLVES_AT).toISOString(),
      data: {
        raidId: 'wolvesYear1',
        enemy: 'wolves',
        size: 'light',
        warning: 'unwarned',
        palisadeLevel: 0,
        injured: 1,
        palisadeLevelNeeded: 1,
      },
    });
    // As três informações na mesma linha: como chegaram, o que custou, o que os teria detido.
    expect(raid?.text).toBe(
      'No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Nada os deteve: o ataque custou 3 de comida, 12 de madeira e um aldeão ferido. Uma paliçada os teria detido.',
    );
    expect(hurt).toMatchObject({
      atMs: WOLVES_AT,
      text: 'No 16º dia da Primavera, um aldeão sem ofício de Pedra Alta saiu ferido do ataque. Fica de cama até sarar.',
    });
    // Os totais do motor, em unidades: é deles que o Relatório de Retorno tira as perdas. Sem
    // lavradores, das 180 de comida restavam 30 às 30 h: os lobos levaram um décimo delas e um
    // décimo das 120 de madeira.
    expect(raid?.data).toMatchObject({ raided_food: 3, raided_wood: 12 });
    expect(stock(back, 'wood')).toBe(stock(start, 'wood') - 12);
    // 30 − 3 dos lobos − 5 da hora que passou desde então.
    expect(stock(back, 'food')).toBe(22);
    // Sem Torre, nada conta a Ameaça: nem a visão, nem os eventos.
    expect(back.threat.known).toBe(false);
    for (const event of events) {
      expect(Object.keys(event.data).filter((key) => /threat/i.test(key))).toEqual([]);
    }
    expect(ofType(events, 'raidAnnounced')).toEqual([]);

    // A visão de quem volta: um ferido de cama, e a moral que vai pagar por isso.
    expect(back.population).toMatchObject({
      villagers: 5,
      injured: 1,
      secondsToNextRecovery: 3600,
      injuredNote: '1 aldeão ferido na incursão: não trabalha até sarar, em 1 h.',
    });
    expect(back.morale.effects).toEqual([
      { label: 'Incursão sofrida', amount: -10, endsInSeconds: 5 * 3600 },
    ]);
    expect(back.morale.terms).toContainEqual({
      id: 'effect',
      label: 'Incursão sofrida',
      amount: -10,
    });

    // A Crônica conta a mesma história, com as mesmas frases.
    const chronicle = await chronicleOf(normal, who, who.game.id);
    expect(chronicle).toContain(howl?.text);
    expect(chronicle).toContain(raid?.text);
    expect(chronicle).toContain(hurt?.text);
    const markdown = await call<string>(normal, 'GET', `/games/${who.game.id}/chronicle.md`, {
      token: who.token,
    });
    expect(markdown.body).toContain('os lobos chegaram a Pedra Alta sem que ninguém os visse vir');

    // Uma hora depois o ferido sara, sozinho.
    await wait(normal, who, HOUR);
    const healed = await viewOf(normal, who, who.game.id);
    expect(healed.population).toMatchObject({ injured: 0, injuredNote: null });
    const later = await eventsOf(normal, who, who.game.id);
    expect(ofType(later, 'villagerRecovered')).toMatchObject([
      { atMs: WOLVES_AT + GAME_DAY, at: new Date(createdAt + WOLVES_AT + GAME_DAY).toISOString() },
    ]);
    // E a incursão não se repete: uma perda por ataque, por mais que se leia.
    for (let reads = 0; reads < 3; reads += 1) {
      await viewOf(normal, who, who.game.id);
    }
    expect(ofType(await eventsOf(normal, who, who.game.id), 'raidSuffered')).toHaveLength(
      ofType(later, 'raidSuffered').length,
    );
    expect((await storedState(normal, who.game.id)).state.stats.raids_suffered).toBe(1);
  });

  it('no ritmo Rápido os lobos chegam em 10 horas reais: o instante de jogo é o mesmo, o real se divide por 3', async () => {
    const who = await newPlayer(fast);
    const createdAt = new Date(who.game.createdAt).getTime();
    await send<CommandAccepted>(
      fast,
      who.token,
      who.game.id,
      order('setWorkers', { building: 'farm', count: 3 }),
    );
    await send<CommandAccepted>(
      fast,
      who.token,
      who.game.id,
      order('setWorkers', { building: 'lumberMill', count: 2 }),
    );

    // Um segundo real antes ainda não há incursão; no instante, há.
    await wait(fast, who, WOLVES_AT / PACE - SECOND);
    expect(ofType(await eventsOf(fast, who, who.game.id), 'raidSuffered')).toEqual([]);
    const before = await viewOf(fast, who, who.game.id);
    fast.clock.advance(SECOND);
    const after = await viewOf(fast, who, who.game.id);
    const events = await eventsOf(fast, who, who.game.id);
    const [raid] = ofType(events, 'raidSuffered');
    expect(raid).toMatchObject({
      atMs: WOLVES_AT,
      at: new Date(createdAt + 10 * HOUR).toISOString(),
    });
    expect(ofType(events, 'wolvesHowl')[0]?.at).toBe(new Date(createdAt + 6 * HOUR).toISOString());
    // Um décimo da comida e da madeira, em milésimos exatos no evento e em unidades na visão.
    const lostFood = Number(raid?.data.raided_food);
    const lostWood = Number(raid?.data.raided_wood);
    expect(lostFood).toBeGreaterThan(stock(before, 'food') / 10 - 1);
    expect(lostFood).toBeLessThanOrEqual((stock(before, 'food') + 1) / 10);
    expect(Math.abs(stock(before, 'food') - stock(after, 'food') - lostFood)).toBeLessThan(1.5);
    expect(Math.abs(stock(before, 'wood') - stock(after, 'wood') - lostWood)).toBeLessThan(1.5);
    // Todos tinham ofício: o ferido saiu da Fazenda, que tinha mais gente, e volta a ela.
    expect(ofType(events, 'villagerInjured')[0]).toMatchObject({
      data: { building: 'farm', injured: 1 },
      text: 'No 16º dia da Primavera, um lavrador de Pedra Alta saiu ferido do ataque. Larga o ofício até sarar.',
    });
    expect(after.workers.find((row) => row.building === 'farm')).toMatchObject({
      assigned: 2,
      injured: 1,
    });
    // O dia de jogo de cama são 40 minutos reais.
    expect(after.population).toMatchObject({
      injured: 1,
      secondsToNextRecovery: 40 * 60,
      injuredNote:
        '1 aldeão ferido na incursão: não trabalha até sarar, em 40 min, e então volta à Fazenda.',
    });
    await wait(fast, who, 40 * MINUTE);
    const healed = await viewOf(fast, who, who.game.id);
    expect(healed.workers.find((row) => row.building === 'farm')).toMatchObject({
      assigned: 3,
      injured: 0,
    });
    expect(ofType(await eventsOf(fast, who, who.game.id), 'villagerRecovered')[0]).toMatchObject({
      data: { building: 'farm', injured: 0 },
      text: 'No 17º dia da Primavera, um lavrador de Pedra Alta sarou das feridas e voltou ao ofício.',
    });
  });

  it('quem nunca mais volta: o job de avanço resolve a incursão, e os eventos ficam à espera', async () => {
    const who = await newPlayer(normal);
    const createdAt = new Date(who.game.createdAt).getTime();
    normal.clock.advance(40 * HOUR);
    const report = await advanceStaleGames(normal.ctx);
    expect(report.failed).toBe(0);
    expect(report.advanced).toBeGreaterThanOrEqual(1);
    // Ninguém pediu nada à API: o estado gravado já passou pelos lobos.
    const { state } = await storedState(normal, who.game.id);
    expect(state.stats.raids_suffered).toBeGreaterThanOrEqual(1);
    expect(state.horde.scheduledRaids.some((raid) => raid.id === 'wolvesYear1')).toBe(false);
    const { rows } = await normal.pool.query<{ kind: string; at: Date }>(
      `select kind, at from game_events where game_id = $1 and kind = 'raidSuffered' order by seq`,
      [who.game.id],
    );
    expect(rows[0]?.at.toISOString()).toBe(new Date(createdAt + WOLVES_AT).toISOString());
    // Quando o senhor enfim volta, a leitura não refaz nada: os eventos são os que o job gravou.
    await renew(normal, who);
    const events = await eventsOf(normal, who, who.game.id);
    expect(
      ofType(events, 'raidSuffered').filter((event) => event.data.raidId === 'wolvesYear1'),
    ).toHaveLength(1);
  });

  it('duas réplicas lendo no instante da incursão resolvem-na uma vez só', async () => {
    const who = await newPlayer(normal);
    normal.clock.advance(WOLVES_AT);
    await renew(normal, who);
    const reads = await Promise.all(
      Array.from({ length: 6 }, () =>
        call<ViewResponse>(normal, 'GET', `/games/${who.game.id}/view`, { token: who.token }),
      ),
    );
    expect(reads.map((reply) => reply.status)).toEqual([200, 200, 200, 200, 200, 200]);
    const events = await eventsOf(normal, who, who.game.id);
    expect(ofType(events, 'raidSuffered')).toHaveLength(1);
    expect(ofType(events, 'villagerInjured')).toHaveLength(1);
    expect((await storedState(normal, who.game.id)).state.settlement.injured).toHaveLength(1);
  });
});

describe('a Torre avisa e a Paliçada muda o desfecho, com o senhor fora ou presente', () => {
  it('com Torre e Paliçada: o alarme soa 1 h real antes, e os lobos recuam sem levar nada', async () => {
    const game = await insertGame(
      fast,
      feud('lobos-repelidos', PACE, { watchtower: 1, palisade: 1 }),
      PACE,
    );
    const start = await viewOf(fast, game, game.id);
    expect(start.threat).toMatchObject({ known: true, incoming: null });

    await wait(fast, game, (WOLVES_AT + GAME_DAY) / PACE);
    const back = await viewOf(fast, game, game.id);
    const events = await eventsOf(fast, game, game.id);
    expect(raidStory(events)).toEqual(['wolvesHowl', 'raidAnnounced', 'raidRepelled']);
    expect(ofType(events, 'wolvesHowl')[0]?.text).toContain('Os vigias dobraram a ronda.');
    const [announced] = ofType(events, 'raidAnnounced');
    // Uma hora real antes dos lobos: no ritmo Rápido, três horas de jogo.
    expect(announced).toMatchObject({
      atMs: WOLVES_AT - 3 * HOUR,
      at: new Date(game.createdAtMs + WOLVES_AT / PACE - HOUR).toISOString(),
      data: { raidId: 'wolvesYear1', enemy: 'wolves', warning: 'warned' },
      text: 'No 14º dia da Primavera, os vigias de Pedra Alta deram o alarme: lobos a caminho. Da torre ainda não se distingue quantos são.',
    });
    // A Torre no nível 1 não distingue o tamanho: o evento não o leva.
    expect(announced?.data).not.toHaveProperty('size');
    const [repelled] = ofType(events, 'raidRepelled');
    expect(repelled).toMatchObject({
      atMs: WOLVES_AT,
      data: {
        raidId: 'wolvesYear1',
        warning: 'warned',
        palisadeLevel: 1,
        previousThreat: 30,
        threat: 0,
      },
      text: 'No 16º dia da Primavera, os lobos que os vigias tinham avistado chegaram a Pedra Alta. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.',
    });
    expect(back.population).toMatchObject({ injured: 0, injuredNote: null });
    expect(back.morale.effects).toEqual([]);
    expect(await chronicleOf(fast, game, game.id)).toContain(repelled?.text);
    const { state } = await storedState(fast, game.id);
    expect(state.stats).toMatchObject({ raids_repelled: 1 });
    expect(state.stats.raids_suffered).toBeUndefined();
    expect(state.settlement.injured).toEqual([]);
  });

  it('a mesma incursão, três feudos: sem defesa, só com a Torre, com Torre e Paliçada', async () => {
    const outcome = async (levels: { watchtower?: number; palisade?: number }) => {
      const game = await insertGame(normal, feud('lobos-iguais', 1, levels), 1);
      await wait(normal, game, WOLVES_AT);
      const events = await eventsOf(normal, game, game.id);
      const [raid] = [...ofType(events, 'raidSuffered'), ...ofType(events, 'raidRepelled')];
      return {
        story: raidStory(events),
        lostFood: Number(raid?.data.raided_food ?? 0),
        lostWood: Number(raid?.data.raided_wood ?? 0),
        injured: Number(raid?.data.injured ?? 0),
        text: raid?.text ?? '',
      };
    };
    const open = await outcome({});
    const watched = await outcome({ watchtower: 2 });
    const walled = await outcome({ watchtower: 2, palisade: 1 });
    // O aviso existe só com a Torre; a perda, só sem a Paliçada.
    expect(open.story).toEqual(['wolvesHowl', 'raidSuffered', 'villagerInjured']);
    expect(watched.story).toEqual([
      'wolvesHowl',
      'raidAnnounced',
      'raidSuffered',
      'villagerInjured',
    ]);
    expect(walled.story).toEqual(['wolvesHowl', 'raidAnnounced', 'raidRepelled']);
    // A Torre não muda o que se perde: o mesmo feudo, a mesma perda.
    expect(watched).toMatchObject({ lostFood: open.lostFood, lostWood: open.lostWood, injured: 1 });
    expect(open.lostFood).toBeGreaterThan(0);
    expect(open.lostWood).toBeGreaterThan(0);
    expect(walled).toMatchObject({ lostFood: 0, lostWood: 0, injured: 0 });
    // O relato de quem tinha a Torre no nível 2 diz o que os vigias viram antes.
    expect(open.text).toContain('sem que ninguém os visse vir');
    expect(watched.text).toContain('uma matilha pequena, como os vigias tinham contado');
    expect(watched.text).toContain('Uma paliçada os teria detido.');
    expect(walled.text).toContain('Recuaram diante da paliçada');
  });

  it('o aviso dá tempo: quem volta com o alarme e manda erguer a Paliçada repele o ataque, e o reenvio não a ergue duas vezes', async () => {
    const game = await insertGame(fast, feud('lobos-a-tempo', PACE, { watchtower: 2 }), PACE);
    // O senhor volta 1 h de jogo antes dos lobos (20 min reais): os vigias do nível 2 já os
    // contam, e a tela diz o que o ataque custa e que nada o segura.
    await wait(fast, game, (WOLVES_AT - HOUR) / PACE);
    const warned = await viewOf(fast, game, game.id);
    expect(warned.threat).toMatchObject({
      known: true,
      raidChancePercent: 0,
      incoming: {
        enemy: 'wolves',
        enemyLabel: 'Lobos',
        inSeconds: 20 * 60,
        sizeText: 'uma matilha pequena',
        text: 'Lobos a caminho. Os vigias contam uma matilha pequena.',
        defenseText: 'Sem Paliçada, nada segura este ataque.',
      },
    });
    const incoming = warned.threat.incoming;
    expect(incoming?.costText).toMatch(
      /^Sem defesa, uma matilha pequena leva 10% do estoque de comida e madeira \(hoje, .* de comida e .* de madeira\) e fere 1 aldeão, que fica 40 min sem trabalhar\.$/,
    );
    // A ordem, com o recibo; o reenvio devolve o mesmo corpo e não cobra de novo.
    const build = order('startConstruction', { building: 'palisade' });
    const first = await send<CommandAccepted>(fast, game.token, game.id, build);
    expect(first.status).toBe(200);
    expect(first.body.view.threat.incoming?.defenseText).toBe(
      'A Paliçada Nv1, que fica pronta a tempo, segura este ataque: sem perda nem ferido.',
    );
    const again = await send<CommandAccepted>(fast, game.token, game.id, build);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body.events).toEqual(first.body.events);

    await wait(fast, game, (HOUR + GAME_DAY) / PACE);
    const events = await eventsOf(fast, game, game.id);
    expect(raidStory(events)).toEqual(['wolvesHowl', 'raidAnnounced', 'raidRepelled']);
    // O nível 2 avisa 2 h reais antes: no ritmo Rápido, seis horas de jogo.
    expect(ofType(events, 'raidAnnounced')[0]).toMatchObject({
      atMs: WOLVES_AT - 6 * HOUR,
      at: new Date(game.createdAtMs + WOLVES_AT / PACE - 2 * HOUR).toISOString(),
      data: { warning: 'sized', size: 'light' },
      text: 'No 13º dia da Primavera, os vigias de Pedra Alta deram o alarme: lobos a caminho. Contam uma matilha pequena.',
    });
    expect(
      ofType(events, 'constructionStarted').filter((event) => event.data.building === 'palisade'),
    ).toHaveLength(1);
    expect((await storedState(fast, game.id)).state.settlement.buildings.palisade).toBe(1);
  });
});

describe('o aviso da Torre de Vigia em tempo real, nos três ritmos (V2G-T3; ADR 0016, item 4)', () => {
  const CELLS = [3, 1, 0.5].flatMap((timeScale) =>
    [1, 2].map((watchtower) => ({ timeScale, watchtower })),
  );

  it.each(CELLS)(
    'ritmo $timeScale, Torre Nv$watchtower: o alarme dos lobos soa $watchtower h reais antes, nem um milissegundo mais cedo',
    async ({ timeScale, watchtower }) => {
      const game = await insertGame(
        normal,
        feud(`aviso-${timeScale}-${watchtower}`, timeScale, { watchtower }),
        timeScale,
      );
      // Os lobos do roteiro chegam às 30 h de jogo: em horas reais, 10, 30 ou 60.
      const wolvesRealMs = WOLVES_AT / timeScale;
      const alarmRealMs = wolvesRealMs - watchtower * HOUR;
      const at = async (realMs: number) => {
        normal.clock.advance(game.createdAtMs + realMs - normal.clock.now().getTime());
        await renew(normal, game);
      };

      await at(alarmRealMs - 1);
      expect((await viewOf(normal, game, game.id)).threat).toMatchObject({
        known: true,
        incoming: null,
      });
      expect(ofType(await eventsOf(normal, game, game.id), 'raidAnnounced')).toEqual([]);

      await at(alarmRealMs);
      const view = await viewOf(normal, game, game.id);
      expect(view.threat.incoming).toMatchObject({
        inSeconds: watchtower * 3600,
        sizeText: watchtower === 2 ? 'uma matilha pequena' : null,
      });
      // A frase da Torre diz a mesma antecedência em todo ritmo.
      expect(view.threat.watchtower.text).toContain(
        `avisa de uma incursão com ${watchtower} h de antecedência`,
      );
      const [announced, ...more] = ofType(await eventsOf(normal, game, game.id), 'raidAnnounced');
      expect(more).toEqual([]);
      expect(announced).toMatchObject({
        atMs: WOLVES_AT - watchtower * HOUR * timeScale,
        at: new Date(game.createdAtMs + alarmRealMs).toISOString(),
        data: { raidId: 'wolvesYear1', warning: watchtower === 2 ? 'sized' : 'warned' },
      });

      // Os lobos chegam no instante de sempre, e o alarme não soa de novo.
      await at(wolvesRealMs + HOUR);
      const events = await eventsOf(normal, game, game.id);
      expect(ofType(events, 'raidAnnounced')).toHaveLength(1);
      expect(ofType(events, 'raidSuffered')[0]).toMatchObject({
        atMs: WOLVES_AT,
        data: { warning: watchtower === 2 ? 'sized' : 'warned' },
      });
    },
  );

  it('uma partida gravada com a antecedência de antes: o alarme que faltava soa na primeira leitura, uma vez; o que já soou não se repete', async () => {
    // Rápido, Torre Nv1, duas horas de jogo antes dos lobos: pela regra antiga (1 h de jogo)
    // ninguém tinha avisado; pela nova (1 h real, três horas de jogo), a incursão está à vista.
    const late = feud('aviso-atrasado', 3, { watchtower: 1 });
    const boundary = WOLVES_AT - 2 * HOUR;
    late.lastProcessedAt = boundary;
    late.clock.gameTimeMs = boundary;
    // Os uivos do 10º dia já soaram e o Conselho não entra nesta conta.
    late.council.nextDrawAtMs = 1000 * 84 * GAME_DAY;
    const game = await insertGame(normal, late, 3);
    // A primeira leitura depois da atualização vem um segundo real depois de a partida parar:
    // o alarme sai no primeiro instante processado, com o instante em que a partida estava.
    await wait(normal, game, SECOND);
    const first = await viewOf(normal, game, game.id);
    expect(first.threat.incoming).toMatchObject({ inSeconds: 40 * 60 - 1, sizeText: null });
    const events = await eventsOf(normal, game, game.id);
    expect(ofType(events, 'raidAnnounced').map((event) => event.atMs)).toEqual([boundary]);
    await wait(normal, game, 10 * MINUTE);
    await viewOf(normal, game, game.id);
    expect(ofType(await eventsOf(normal, game, game.id), 'raidAnnounced')).toHaveLength(1);

    // Tranquilo, Torre Nv1: o alarme soou uma hora de jogo antes, pela regra antiga; a partida
    // está a 45 minutos de jogo dos lobos, fora da antecedência nova (meia hora de jogo).
    const heard = feud('aviso-ouvido', 0.5, { watchtower: 1 });
    const stopped = WOLVES_AT - 45 * MINUTE;
    heard.lastProcessedAt = stopped;
    heard.clock.gameTimeMs = stopped;
    heard.council.nextDrawAtMs = 1000 * 84 * GAME_DAY;
    const [marked] = heard.horde.scheduledRaids;
    if (marked !== undefined) {
      marked.announcedAtMs = WOLVES_AT - HOUR;
    }
    const other = await insertGame(normal, heard, 0.5);
    // Continua à vista: 45 min de jogo são 1 h 30 reais.
    expect((await viewOf(normal, other, other.id)).threat.incoming).toMatchObject({
      inSeconds: 90 * 60,
    });
    await wait(normal, other, 3 * HOUR);
    const after = await eventsOf(normal, other, other.id);
    expect(ofType(after, 'raidAnnounced')).toEqual([]);
    expect(ofType(after, 'raidSuffered')[0]).toMatchObject({
      atMs: WOLVES_AT,
      data: { warning: 'warned' },
    });
  });
});

describe('as incursões por Ameaça em uma ausência longa', () => {
  it('um ano de jogo fora: uma incursão de cada vez, cada uma uma vez, e a leitura por cursor não repete nem pula', async () => {
    const game = await insertGame(
      normal,
      feud('lobos-do-ano', 1, { watchtower: 2, palisade: 1 }),
      1,
    );
    const YEAR = 84 * GAME_DAY;
    await wait(normal, game, YEAR);
    const all = await eventsOf(normal, game, game.id);
    const resolved = all.filter((event) => /^raid(Suffered|Repelled)$/.test(event.type));
    // A primeira é a do roteiro, leve, que a Paliçada no nível 1 repele. Das da Ameaça, as leves
    // também recuam diante dela; as médias, que vêm com o outono, passam com a metade do estrago
    // e um ferido cada. São umas seis no ano (eram mais de oito, quase todas médias, antes de a
    // Ameaça ser reequilibrada na revisão das Fases D e E).
    expect(resolved[0]).toMatchObject({ type: 'raidRepelled', data: { raidId: 'wolvesYear1' } });
    expect(resolved.length).toBeGreaterThanOrEqual(5);
    for (const event of resolved.filter((entry) => entry.type === 'raidRepelled')) {
      expect(event.data).toMatchObject({ size: 'light', palisadeLevel: 1 });
    }
    expect(resolved.filter((event) => event.type === 'raidRepelled').length).toBeGreaterThan(1);
    const ids = resolved.map((event) => event.data.raidId);
    expect(new Set(ids).size).toBe(ids.length);
    resolved.slice(1).forEach((event, index) => {
      expect(event.data.raidId).toBe(`threat-${index + 2}`);
      // Entre duas incursões passam ao menos quatro dias de jogo.
      expect(event.atMs - (resolved[index]?.atMs ?? 0)).toBeGreaterThanOrEqual(4 * GAME_DAY);
    });
    const breached = resolved.filter((event) => event.type === 'raidSuffered');
    expect(breached.length).toBeGreaterThan(0);
    for (const event of breached) {
      expect(event.data).toMatchObject({ size: 'medium', palisadeLevel: 1, injured: 1 });
      expect(event.text).toContain('A paliçada lhes quebrou o ímpeto, mas não os deteve');
      expect(event.text).toContain('Uma paliçada no nível 2 os teria detido.');
    }
    // Com a Torre no nível 2, toda incursão foi anunciada antes, com o tamanho.
    expect(ofType(all, 'raidAnnounced')).toHaveLength(resolved.length);
    // Quem se feriu sarou (ou está de cama agora): nenhum ferido se perde no caminho.
    const { state } = await storedState(normal, game.id);
    expect(ofType(all, 'villagerInjured')).toHaveLength(
      ofType(all, 'villagerRecovered').length + state.settlement.injured.length,
    );
    expect(state.stats.raids_suffered).toBe(breached.length);
    expect(state.stats.raids_repelled).toBe(resolved.length - breached.length);
    expect(state.settlement.population.villagers).toBeGreaterThanOrEqual(3);

    // A leitura por cursor, de 50 em 50, entrega os mesmos eventos, uma vez cada.
    const paged: GameEvent[] = [];
    for (let after = 0; ;) {
      const reply = await call<EventsResponse>(
        normal,
        'GET',
        `/games/${game.id}/events?after=${after}&limit=50`,
        { token: game.token },
      );
      expect(reply.status).toBe(200);
      paged.push(...reply.body.events);
      const last = reply.body.events.at(-1);
      if (last === undefined || reply.body.events.length < 50) {
        break;
      }
      after = last.seq;
    }
    expect(paged.map((event) => event.seq)).toEqual(all.map((event) => event.seq));
    expect(paged.filter((event) => /^raid(Suffered|Repelled)$/.test(event.type))).toHaveLength(
      resolved.length,
    );
    // A Ameaça, que a Torre mostra, caiu a cada incursão e voltou a subir: oscila longe do
    // teto, e o ano acaba logo depois de uma incursão (até a revisão das Fases D e E ela ficava
    // entre 90 e 100).
    const view = await viewOf(normal, game, game.id);
    expect(view.threat.known).toBe(true);
    if (view.threat.known) {
      expect(view.threat.level).toBeLessThan(70);
      expect(view.threat.raidRisk).toContain(
        'Toda incursão, repelida ou sofrida, baixa a Ameaça em 35.',
      );
    }
  });
});

describe('uma partida gravada antes das incursões (estado na versão 10)', () => {
  const fixture = (name: string) =>
    JSON.parse(
      readFileSync(
        new URL(`../../engine/src/__fixtures__/state-v10-${name}.json`, import.meta.url),
        'utf8',
      ),
    ) as { schemaVersion: number; seed: string; lastProcessedAt: number };

  it('quem ainda não passou do 16º dia recebe os lobos do roteiro; ninguém entra ferido', async () => {
    const before = fixture('fresh');
    expect(before.schemaVersion).toBe(10);
    const game = await insertGame(normal, before, 1);
    const view = await viewOf(normal, game, game.id);
    expect(view.population).toMatchObject({ injured: 0, injuredNote: null });
    const row = await storedState(normal, game.id);
    expect(row.schema_version).toBe(12);
    expect(row.state.schemaVersion).toBe(12);
    expect(row.state.settlement.injured).toEqual([]);
    expect(row.state.horde.scheduledRaids).toEqual([
      {
        id: 'wolvesYear1',
        atMs: WOLVES_AT,
        kind: 'scripted',
        enemy: 'wolves',
        size: 'light',
        announcedAtMs: null,
      },
    ]);
    // Nada aconteceu na fronteira; os lobos chegam na hora deles.
    expect(raidStory(await eventsOf(normal, game, game.id))).toEqual([]);
    await wait(normal, game, WOLVES_AT);
    expect(raidStory(await eventsOf(normal, game, game.id))).toEqual([
      'wolvesHowl',
      'raidSuffered',
      'villagerInjured',
    ]);
  });

  it('quem já passou do 16º dia não os recebe; as incursões da Ameaça contam da fronteira', async () => {
    // O cenário de 7 dias da versão 10: ano 2, Ameaça em 100, Torre no nível 2, Paliçada no 1.
    const before = fixture('week-scripted');
    const game = await insertGame(normal, before, 1);
    await viewOf(normal, game, game.id);
    const row = await storedState(normal, game.id);
    expect(row.state.horde.scheduledRaids).toEqual([]);
    expect(row.state.migratedAtMs).toBe(before.lastProcessedAt);
    expect(raidStory(await eventsOf(normal, game, game.id))).toEqual([]);
    // Nas viradas seguintes a Ameaça sorteia: em vinte dias de jogo há incursão, e nenhuma
    // delas é a do roteiro.
    await wait(normal, game, 20 * GAME_DAY);
    const events = await eventsOf(normal, game, game.id);
    const resolved = events.filter((event) => /^raid(Suffered|Repelled)$/.test(event.type));
    expect(resolved.length).toBeGreaterThan(0);
    for (const event of resolved) {
      expect(String(event.data.raidId)).toMatch(/^threat-\d+$/);
      // A incursão sorteada na primeira virada depois da fronteira chega 6 h de jogo depois.
      expect(event.atMs).toBeGreaterThanOrEqual(before.lastProcessedAt + 3 * GAME_DAY);
    }
    expect(ofType(events, 'wolvesHowl')).toEqual([]);
  });
});
