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
  quietHorde,
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
  it('no ritmo Rápido, em 20 h reais a moral baixa leva o feudo ao piso sem ninguém ter desertado: a fome só cobra depois de 12 h reais', async () => {
    const who = await newPlayer(fast);
    // Só a fome e a moral: os lobos do roteiro levariam comida às 30 h de jogo e adiantariam
    // a fome (as incursões pela API estão em `raids.test.ts`).
    await quietHorde(fast, who.game.id);
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
      // 12 h reais de fome são 36 h de jogo: a primeira virada com elas completas é às 72 h de
      // jogo, 35 h de jogo depois desta leitura.
      notes: [
        'Depois de 12 h de fome, deserta um aldeão a cada 2 h, na virada do dia. Faltam 11 h 40 min para o primeiro.',
      ],
    });

    // 60 h de jogo (20 h reais, 8 de fome): a moral caiu duas faixas e levou dois aldeões, por
    // sorteio. Pela regra de antes (12 h de jogo de carência) um deles teria desertado na
    // virada das 48 h.
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
      ['villagerLeft', 29],
    ]);
    expect(moved.map((event) => event.text)).toEqual([
      'No 20º dia da Primavera, o povo de Pedra Alta anda inquieto. Há resmungos junto ao poço.',
      'No 22º dia da Primavera, o povo de Pedra Alta perdeu a esperança. Já se fala em ir embora.',
      'No 1º dia do Verão, um aldeão sem ofício juntou a trouxa e deixou Pedra Alta: o povo anda sem ânimo. Restam 4.',
      'No 6º dia do Verão, um aldeão sem ofício juntou a trouxa e deixou Pedra Alta: o povo anda sem ânimo. Restam 3.',
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
      'villagerLeft',
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

describe('a deserção por fome em tempo real, nos três ritmos (V2G-T2; ADR 0016, itens 2 e 3)', () => {
  type Starver = { id: string; token: string; refreshToken: string; createdAt: number };

  /**
   * Um feudo grande e sem lavradores, no ritmo pedido: 40 habitantes (as casas cheias: nenhum
   * colono chega), comida para meia hora de jogo, a Horda e o Conselho calados e um efeito de
   * teste que segura a moral acima de 25: aqui só a fome tira gente, sem sorteio. O estado é
   * reescrito direto no banco, logo depois de criada a partida, antes de qualquer leitura.
   */
  async function starvingFief(timeScale: number, difficulty = 'lord'): Promise<Starver> {
    const auth = await signUp(normal, 'Senhora da Fome');
    const game = await startGame(normal, auth.accessToken, {
      timeScale: timeScale as 3,
      difficulty: difficulty as 'lord',
    });
    await quietHorde(normal, game.id);
    const year = 84 * DAY;
    const { rowCount } = await normal.pool.query(
      `update games set state = state
          || jsonb_build_object('council', (state->'council') || '{"nextDrawAtMs": ${1000 * year}}'::jsonb)
          || jsonb_build_object('settlement', (state->'settlement') || $2::jsonb)
        where id = $1`,
      [
        game.id,
        JSON.stringify({
          population: { villagers: 40 },
          resources: { food: 20_000, wood: 0, stone: 0, gold: 0 },
          moraleEffects: [{ id: 'teste', label: 'efeito de teste', amount: 100, untilMs: year }],
        }),
      ],
    );
    expect(rowCount).toBe(1);
    return {
      id: game.id,
      token: auth.accessToken,
      refreshToken: auth.refreshToken,
      createdAt: new Date(game.createdAt).getTime(),
    };
  }

  /** Leva o relógio real até `realMs` depois da criação da partida. */
  async function at(who: Starver, realMs: number): Promise<void> {
    normal.clock.advance(who.createdAt + realMs - normal.clock.now().getTime());
    await renew(normal, who as unknown as Player);
  }

  const deserted = (events: GameEvent[]) =>
    events.filter((event) => event.type === 'villagerDeserted');

  it.each([
    // Em horas reais desde a criação. A fome abre com meia hora de jogo; a carência se completa
    // com 12 h reais de fome, e quem cobra é a primeira virada de dia a partir daí.
    // Rápido: fome aos 10 min reais; viradas a cada 40 min; um aldeão a cada três viradas.
    { timeScale: 3, famineAt: 1 / 6, hours: [12 + 2 / 3, 14 + 2 / 3, 16 + 2 / 3] },
    // Normal: fome aos 30 min; viradas a cada 2 h; um aldeão por virada, como sempre foi.
    { timeScale: 1, famineAt: 0.5, hours: [14, 16, 18] },
    // Tranquilo: fome com 1 h; viradas a cada 4 h; dois aldeões por virada.
    { timeScale: 0.5, famineAt: 1, hours: [16, 16, 20, 20, 24, 24] },
  ])(
    'ritmo $timeScale: os desertores saem nas horas reais $hours',
    async ({ timeScale, famineAt, hours }) => {
      const who = await starvingFief(timeScale);
      const [first] = hours as [number, ...number[]];
      const last = hours[hours.length - 1] as number;

      // Uma hora real depois de a fome abrir: a visão diz os prazos, os mesmos em todo ritmo.
      await at(who, (famineAt + 1) * HOUR);
      const early = await viewOf(normal, who, who.id);
      expect(early.famine?.secondsElapsed).toBe(3600);
      expect(early.population.villagers).toBe(40);
      const note = early.morale.notes.find((text) => text.includes('Faltam'));
      expect(note).toMatch(
        /^Depois de 12 h de fome, deserta um aldeão a cada 2 h, na virada do dia\. Faltam .+ para o primeiro\.$/,
      );

      // Um milissegundo real antes da primeira deserção, ninguém saiu.
      await at(who, first * HOUR - 1);
      expect((await viewOf(normal, who, who.id)).population.villagers).toBe(40);
      expect(deserted(await eventsOf(normal, who, who.id))).toEqual([]);

      // No instante dela, e até a última da lista.
      await at(who, first * HOUR);
      expect(deserted(await eventsOf(normal, who, who.id)).length).toBeGreaterThan(0);
      await at(who, last * HOUR);
      const events = await eventsOf(normal, who, who.id);
      const famine = events.filter((event) => event.type === 'famineStarted');
      expect(famine.map((event) => new Date(event.at).getTime() - who.createdAt)).toEqual([
        Math.round(famineAt * HOUR),
      ]);
      const gone = deserted(events);
      expect(gone.map((event) => new Date(event.at).getTime() - who.createdAt)).toEqual(
        hours.map((hour) => Math.round(hour * HOUR)),
      );
      // Todos em viradas de dia de jogo, e a primeira entre 12 h e 12 h mais um dia de jogo
      // depois de a fome abrir.
      for (const event of gone) {
        expect(event.atMs % DAY).toBe(0);
      }
      const waited = (first - famineAt) * HOUR;
      expect(waited).toBeGreaterThanOrEqual(12 * HOUR);
      expect(waited).toBeLessThan(12 * HOUR + DAY / timeScale);
      const view = await viewOf(normal, who, who.id);
      expect(view.population.villagers).toBe(40 - hours.length);
      expect(view.famine?.secondsElapsed).toBe(Math.round((last - famineAt) * 3600));
    },
  );

  it('em Camponês ninguém deserta, em nenhum ritmo', async () => {
    for (const timeScale of [3, 1, 0.5]) {
      const who = await starvingFief(timeScale, 'peasant');
      await at(who, 30 * HOUR);
      expect(deserted(await eventsOf(normal, who, who.id))).toEqual([]);
      expect((await viewOf(normal, who, who.id)).population.villagers).toBe(40);
    }
  });

  it('mandar todos à Fazenda e de volta, em duas ordens seguidas, não muda nenhum instante de deserção nem a moral', async () => {
    const plain = await starvingFief(1);
    const cheater = await starvingFief(1);
    // A manobra do furo de C-4, a cada 5 h reais: a fome fecha na primeira ordem e reabre na
    // segunda, sem ninguém ter comido.
    for (const hour of [5, 10, 13.5, 15]) {
      await at(cheater, hour * HOUR);
      const { villagers } = (await viewOf(normal, cheater, cheater.id)).population;
      const toFarm = await send<CommandAccepted>(
        normal,
        cheater.token,
        cheater.id,
        order('setWorkers', { building: 'farm', count: villagers }),
      );
      expect(toFarm.status).toBe(200);
      expect(toFarm.body.view.famine).toBeNull();
      const back = await send<CommandAccepted>(
        normal,
        cheater.token,
        cheater.id,
        order('setWorkers', { building: 'farm', count: 0 }),
      );
      expect(back.status).toBe(200);
      // A fome reabriu e continua contando o que já tinha durado: o tempo desde que abriu, aos
      // 30 min reais.
      expect(back.body.view.famine?.secondsElapsed).toBe((hour - 0.5) * 3600);
    }
    await at(cheater, 18 * HOUR);
    await at(plain, 18 * HOUR);
    const story = async (who: Starver) => {
      const events = await eventsOf(normal, who, who.id);
      return {
        deserted: deserted(events).map((event) => event.atMs / HOUR),
        morale: deserted(events).map((event) => event.data.morale),
        ended: events.filter((event) => event.type === 'famineEnded').length,
      };
    };
    const honest = await story(plain);
    const cheated = await story(cheater);
    expect(honest).toEqual({ deserted: [14, 16, 18], morale: [100, 100, 100], ended: 0 });
    expect(cheated).toEqual({ ...honest, ended: 4 });
    const views = await Promise.all([
      viewOf(normal, plain, plain.id),
      viewOf(normal, cheater, cheater.id),
    ]);
    expect(views[1].population.villagers).toBe(views[0].population.villagers);
    expect(views[1].morale.value).toBe(views[0].morale.value);
    expect(views[1].morale.terms).toEqual(views[0].morale.terms);
    expect(views[1].morale.notes).toEqual(views[0].morale.notes);
    expect(views[1].famine?.secondsElapsed).toBe(views[0].famine?.secondsElapsed);
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
    expect(row.schema_version).toBe(12);
    expect(row.state.schemaVersion).toBe(12);
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
    const warning = view.morale.notes.find((note) => note.startsWith('A fome já dura'));
    expect(warning).toMatch(
      /^A fome já dura 12 h ou mais: deserta um aldeão a cada 2 h de fome, na virada do dia, até a comida voltar\. Faltam .+ para o próximo\.$/,
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
