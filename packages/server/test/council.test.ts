import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

import type {
  ApiError,
  ChronicleResponse,
  CommandAccepted,
  EventsResponse,
  GameEvent,
  GameRuleError,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { PROTOCOL_VERSION, ViewResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  countRows,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// O Conselho do Feudo (V2D-T1; GDD §7; ADR 0014, decisões 1, 9, 18 e 20) visto pela API: a
// carta chega na cadência, com 24 h reais de prazo em qualquer ritmo; a resposta passa pelo
// recibo (reenviar não paga de novo, responder de novo é recusa); a carta que expira é decidida
// pelo conselho, com o jogador presente ou não; o que a opção esconde só aparece quando
// acontece; e o app do protocolo 1, que não sabe ler cartas, recebe 426.

const PACE = 3;
const DAY = 2 * HOUR;
/** A cadência do Conselho: 4 dias de jogo. */
const AUDIENCE = 4 * DAY;
const REPLAYED = 'x-lords-replayed';
const PROTOCOL = 'x-lords-protocol';
const CARD_EVENTS = ['cardDrawn', 'cardAnswered', 'cardExpired', 'cardEffectApplied'];
/** A semente em que a primeira carta de um feudo recém-fundado é "O poço entulhado". */
const WELL_FIRST_SEED = 'pedra-alta-teste-16';

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
type Card = ViewState['council']['pending'][number];

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

const cardsOnly = (events: GameEvent[]) =>
  events.filter((event) => CARD_EVENTS.includes(event.type));
const stock = (view: ViewState, resource: string) =>
  view.resources.find((row) => row.id === resource)?.stock ?? 0;

/** Um jogador com a primeira carta na mesa: a primeira audiência é 4 dias de jogo depois da fundação. */
async function playerWithCard(server: TestApp, pace: number) {
  const who = await newPlayer(server);
  await wait(server, who, AUDIENCE / pace);
  const view = await viewOf(server, who, who.game.id);
  const [card] = view.council.pending;
  if (card === undefined) {
    throw new Error('O teste esperava a primeira carta na mesa.');
  }
  return { who, view, card };
}

/** A opção paga que o feudo alcança: é com ela que se vê se a ordem cobrou uma vez só. */
function paidOption(card: Card) {
  const option = card.options.find(
    (entry) => entry.cost.length > 0 && entry.affordable && !entry.locked,
  );
  const [cost] = option?.cost ?? [];
  if (option === undefined || cost === undefined) {
    throw new Error(`A carta "${card.title}" não tem opção paga ao alcance.`);
  }
  return { option, cost };
}

describe('a carta chega na cadência, em tempo real', () => {
  it.each([
    ['Normal', 1, () => normal, 8 * 3600, '8 h'],
    ['Rápido', PACE, () => fast, 9600, '2 h 40 min'],
  ] as const)(
    'no ritmo %s: a audiência, a carta com 24 h de prazo e a linha na Crônica',
    async (_label, pace, app, audienceSeconds, cadence) => {
      const server = app();
      const who = await newPlayer(server);
      const start = await viewOf(server, who, who.game.id);
      expect(start.pendingDecisions).toEqual([]);
      expect(start.council).toEqual({
        pending: [],
        nextCardInSeconds: audienceSeconds,
        blockedByPending: false,
        nextAudienceInSeconds: audienceSeconds,
        note: null,
        rulesText: `O conselho pede audiência a cada ${cadence} e traz no máximo 2 cartas por vez. Cada carta espera 24 h pela resposta; depois, o conselho decide sozinho.`,
      });

      // Um minuto real antes, nada; na hora, a carta.
      await wait(server, who, audienceSeconds * 1000 - MINUTE);
      const before = await viewOf(server, who, who.game.id);
      expect(before.council).toMatchObject({ pending: [], nextCardInSeconds: 60 });
      await wait(server, who, MINUTE);
      const view = await viewOf(server, who, who.game.id);
      expect(view.council.pending).toHaveLength(1);
      const [card] = view.council.pending;
      // O prazo é de tempo real: 24 h em qualquer ritmo.
      expect(card?.expiresInSeconds).toBe(24 * 3600);
      expect(card?.options.length).toBeGreaterThanOrEqual(2);
      const fallback = card?.options.find((option) => option.id === card.defaultOptionId);
      expect(fallback).toMatchObject({ label: card?.defaultOptionLabel, cost: [], locked: false });
      expect(view.pendingDecisions).toEqual([
        { kind: 'card', id: card?.instanceId, title: card?.title, expiresInSeconds: 24 * 3600 },
      ]);
      expect(view.council.nextAudienceInSeconds).toBe(audienceSeconds);

      // Uma linha, uma vez, por mais que o app consulte.
      await viewOf(server, who, who.game.id);
      const drawn = cardsOnly(await eventsOf(server, who, who.game.id));
      expect(drawn).toHaveLength(1);
      expect(drawn[0]).toMatchObject({
        type: 'cardDrawn',
        atMs: AUDIENCE,
        data: { instanceId: card?.instanceId, source: 'draw' },
      });
      expect(await chronicleOf(server, who, who.game.id)).toContain(
        `No 5º dia da Primavera, o conselho de Pedra Alta pediu audiência: ${card?.title}.`,
      );
    },
  );

  it('com o jogador fora, o job grava a carta e a expiração, uma vez cada, nos instantes de jogo', async () => {
    const reader = await newPlayer(fast);
    const sleeper = await newPlayer(fast);
    // 30 h reais no ritmo Rápido são 90 h de jogo: a 1ª carta chega com 8 h e expira com 80 h.
    // Com a mesa cheia, as audiências do caminho são puladas; a das 88 h já encontra o lugar
    // que a 1ª deixou, e traz carta antes de a 2ª expirar no mesmo instante.
    fast.clock.advance(30 * HOUR);
    await runJobsOnce(fast.ctx);
    await renew(fast, reader);
    await renew(fast, sleeper);
    await viewOf(fast, reader, reader.game.id);
    const read = cardsOnly(await eventsOf(fast, reader, reader.game.id));
    const slept = cardsOnly(await eventsOf(fast, sleeper, sleeper.game.id));
    const story = (events: GameEvent[]) =>
      events.map(({ type, atMs, text, data }) => ({ type, atMs, text, data }));
    // As duas partidas têm a mesma semente: as mesmas cartas, nos mesmos instantes.
    expect(story(slept)).toEqual(story(read));
    expect(slept.map((event) => [event.type, event.atMs / HOUR])).toEqual([
      ['cardDrawn', 8],
      ['cardDrawn', 16],
      ['cardExpired', 80],
      ['cardDrawn', 88],
      ['cardExpired', 88],
    ]);
    // O jogo de novo, e de novo: nada se repete.
    await runJobsOnce(fast.ctx);
    await viewOf(fast, sleeper, sleeper.game.id);
    expect(cardsOnly(await eventsOf(fast, sleeper, sleeper.game.id))).toHaveLength(5);
  });
});

describe('responder a uma carta passa pelo recibo', () => {
  it('responder paga uma vez; reenviar devolve o recibo; responder de novo é recusa', async () => {
    const { who, view, card } = await playerWithCard(normal, 1);
    const { option, cost } = paidOption(card);
    const before = stock(view, cost.resource);

    const answer = order('answerCard', { instanceId: card.instanceId, optionId: option.id });
    const first = await send<CommandAccepted>(normal, who.token, who.game.id, answer);
    expect(first.status, JSON.stringify(first.body)).toBe(200);
    expect(first.body.events.map((event) => event.type)).toEqual(['cardAnswered']);
    expect(first.body.events[0]?.data).toMatchObject({
      instanceId: card.instanceId,
      optionId: option.id,
      [`spent_${cost.resource}`]: cost.amount,
    });
    expect(stock(first.body.view, cost.resource)).toBe(before - cost.amount);
    expect(first.body.view.council.pending).toEqual([]);
    expect(first.body.view.pendingDecisions).toEqual([]);

    // Duplo clique, resposta atrasada, "Tentar de novo": o mesmo comando devolve o recibo.
    const again = await send<CommandAccepted>(normal, who.token, who.game.id, answer);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(first.body);
    expect(stock(await viewOf(normal, who, who.game.id), cost.resource)).toBe(before - cost.amount);
    expect(
      await countRows(
        normal.pool,
        'game_events',
        `game_id = '${who.game.id}' and kind = 'cardAnswered'`,
      ),
    ).toBe(1);

    // Outra ordem (outro UUID) para a mesma carta, dez minutos depois: ela já saiu da mesa. A
    // recusa não perde o avanço: a visão que volta já está dez minutos adiante.
    await wait(normal, who, 10 * MINUTE);
    const late = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('answerCard', { instanceId: card.instanceId, optionId: card.defaultOptionId }),
    );
    expect(late.status).toBe(422);
    const message = 'Essa carta já saiu da mesa do conselho: a decisão sobre ela já foi tomada.';
    expect(late.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'CARD_NOT_PENDING', message, events: [] },
    });
    expect(late.body.details.view.council.pending).toEqual([]);
    expect(late.body.details.view.council.nextAudienceInSeconds).toBe(
      view.council.nextAudienceInSeconds - 600,
    );
    expect(cardsOnly(await eventsOf(normal, who, who.game.id)).map((event) => event.type)).toEqual([
      'cardDrawn',
      'cardAnswered',
    ]);

    // O mesmo UUID com outra opção é outra ordem: conflito, e nada muda.
    const other = await send<ApiError>(normal, who.token, who.game.id, {
      ...order('answerCard', { instanceId: card.instanceId, optionId: card.defaultOptionId }),
      commandId: answer.commandId,
    });
    expect(other.status).toBe(409);
    expect(other.body.code).toBe('COMMAND_ID_CONFLICT');
  });

  it('a opção que não existe, a trancada e a cara demais são recusas com o motivo, e a carta fica', async () => {
    const { who, card } = await playerWithCard(normal, 1);
    const refused = async (optionId: string) => {
      const reply = await send<GameRuleError>(
        normal,
        who.token,
        who.game.id,
        order('answerCard', { instanceId: card.instanceId, optionId }),
      );
      expect(reply.status).toBe(422);
      return reply.body.details;
    };
    expect(await refused('fugir')).toMatchObject({
      code: 'INVALID_OPTION',
      message: `A carta "${card.title}" não tem essa opção.`,
    });
    // A forma errada nem chega ao motor.
    const malformed = await call<ApiError>(normal, 'POST', `/games/${who.game.id}/commands`, {
      token: who.token,
      body: {
        commandId: randomUUID(),
        type: 'answerCard',
        payload: { instanceId: card.instanceId },
      },
    });
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe('VALIDATION');
    // A carta continua na mesa, intacta.
    const view = await viewOf(normal, who, who.game.id);
    expect(view.council.pending.map((entry) => entry.instanceId)).toEqual([card.instanceId]);
    // Toda opção que a visão diz que não dá é recusada pelo motor com o motivo que ela mostra.
    for (const option of view.council.pending[0]?.options ?? []) {
      if (option.locked) {
        const details = await refused(option.id);
        expect(details.code).toBe('OPTION_LOCKED');
        expect(`${details.message}`).toContain(
          (option.lockedReason ?? '').replace(/^R/, 'r').replace(/\.$/, ''),
        );
      } else if (!option.affordable) {
        expect((await refused(option.id)).code).toBe('INSUFFICIENT_RESOURCES');
      }
    }
  });

  it('dois clientes respondem à mesma carta ao mesmo tempo: um vence, o outro é recusado, e nada é pago em dobro', async () => {
    const { who, view, card } = await playerWithCard(fast, PACE);
    const { option, cost } = paidOption(card);
    const before = stock(view, cost.resource);
    const seen = { 'x-lords-state-version': '1' };
    // Duas abas, a mesma visão velha, UUIDs diferentes e escolhas diferentes.
    const replies = await Promise.all([
      send<CommandAccepted | GameRuleError>(
        fast,
        who.token,
        who.game.id,
        order('answerCard', { instanceId: card.instanceId, optionId: option.id }),
        seen,
      ),
      send<CommandAccepted | GameRuleError>(
        fast,
        who.token,
        who.game.id,
        order('answerCard', { instanceId: card.instanceId, optionId: card.defaultOptionId }),
        seen,
      ),
    ]);
    expect(replies.map((reply) => reply.status).sort()).toEqual([200, 422]);
    const lost = replies.find((reply) => reply.status === 422)?.body as GameRuleError;
    expect(lost.details).toMatchObject({ code: 'CARD_NOT_PENDING', staleView: true });

    const answered = cardsOnly(await eventsOf(fast, who, who.game.id)).filter(
      (event) => event.type === 'cardAnswered',
    );
    expect(answered).toHaveLength(1);
    // Quem venceu decide o que foi pago: uma vez, ou nada.
    const paid = answered[0]?.data.optionId === option.id ? cost.amount : 0;
    const after = await viewOf(fast, who, who.game.id);
    expect(stock(after, cost.resource)).toBe(before - paid);
    expect(after.council.pending).toEqual([]);
  });
});

describe('a carta que expira', () => {
  it('responder depois do prazo é CARD_EXPIRED: o conselho já decidiu, e a Crônica diz o quê', async () => {
    const { who, card } = await playerWithCard(normal, 1);
    // A um minuto do fim ela ainda espera.
    await wait(normal, who, 24 * HOUR - MINUTE);
    const waiting = await viewOf(normal, who, who.game.id);
    expect(
      waiting.council.pending.find((entry) => entry.instanceId === card.instanceId),
    ).toMatchObject({ expiresInSeconds: 60 });

    // No instante exato do prazo, a expiração vem antes da ordem.
    await wait(normal, who, MINUTE);
    const answer = order('answerCard', {
      instanceId: card.instanceId,
      optionId: card.defaultOptionId,
    });
    const late = await send<GameRuleError>(normal, who.token, who.game.id, answer);
    expect(late.status).toBe(422);
    const message =
      'O prazo dessa carta acabou e o conselho decidiu sozinho. A Crônica conta o que foi feito.';
    expect(late.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'CARD_EXPIRED', message },
    });
    // A recusa traz o que aconteceu no caminho: a expiração está entre os eventos.
    const expired = late.body.details.events.filter((event) => event.type === 'cardExpired');
    expect(expired).toHaveLength(1);
    expect(expired[0]).toMatchObject({
      atMs: AUDIENCE + 24 * HOUR,
      data: {
        instanceId: card.instanceId,
        // O conselho fez o que a carta dizia que faria, na dificuldade da partida.
        optionId: card.defaultOptionId,
        difficulty: 'lord',
      },
    });
    expect(late.body.details.view.council.pending.map((entry) => entry.instanceId)).not.toContain(
      card.instanceId,
    );
    expect(await chronicleOf(normal, who, who.game.id)).toContain(expired[0]?.text);

    // Reenviada, a recusa é o mesmo recibo; e a expiração não se repete.
    const again = await send<GameRuleError>(normal, who.token, who.game.id, answer);
    expect(again.status).toBe(422);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(late.body);
    expect(
      await countRows(
        normal.pool,
        'game_events',
        `game_id = '${who.game.id}' and kind = 'cardExpired'`,
      ),
    ).toBe(1);
  });

  it('com duas cartas na mesa a audiência seguinte é pulada, e a visão avisa antes', async () => {
    const who = await newPlayer(fast);
    await wait(fast, who, (2 * AUDIENCE) / PACE);
    const full = await viewOf(fast, who, who.game.id);
    expect(full.council.pending).toHaveLength(2);
    expect(full.council).toMatchObject({
      blockedByPending: true,
      nextCardInSeconds: null,
      nextAudienceInSeconds: 9600,
      note: 'Com 2 cartas à espera, o conselho não traz outra: responda uma antes da próxima audiência para ela trazer novidade.',
    });
    await wait(fast, who, AUDIENCE / PACE);
    const still = await viewOf(fast, who, who.game.id);
    expect(still.council.pending.map((entry) => entry.instanceId)).toEqual(
      full.council.pending.map((entry) => entry.instanceId),
    );
    expect(cardsOnly(await eventsOf(fast, who, who.game.id))).toHaveLength(2);
  });
});

describe('o que a opção esconde', () => {
  it('não sai na resposta da ordem nem na visão; vira evento e linha da Crônica quando acontece', async () => {
    // Uma semente escolhida pela primeira carta que tira: o poço entulhado. O catálogo é
    // conteúdo; quando a ordem do sorteio mudar, é preciso procurar outra.
    const auth = await signUp(normal);
    const game = await startGame(normal, auth.accessToken, { seed: WELL_FIRST_SEED });
    const who = { token: auth.accessToken, refreshToken: auth.refreshToken, game };
    await wait(normal, who, AUDIENCE);
    const view = await viewOf(normal, who, who.game.id);
    const well = view.council.pending.find((entry) => entry.title === 'O poço entulhado');
    if (well === undefined) {
      throw new Error('O teste esperava o poço entulhado na primeira audiência.');
    }
    const wait_ = well.options.find((option) => option.label === 'Deixar para depois');
    expect(wait_).toMatchObject({
      cost: [],
      effectsText: 'Sem custo e sem efeito imediato.',
      hint: 'O riacho fica longe, e o povo tem memória. Dizem que no entulho ainda há pedra boa.',
    });
    const stone = stock(view, 'stone');
    const answered = await send<CommandAccepted>(
      normal,
      who.token,
      who.game.id,
      order('answerCard', { instanceId: well.instanceId, optionId: wait_?.id ?? '' }),
    );
    expect(answered.status).toBe(200);
    expect(answered.body.events.map((event) => event.type)).toEqual(['cardAnswered']);
    // Nem a resposta, nem a visão, nem os eventos dizem o que vem.
    const secret =
      /desabou|cantaria|commonGranary|thawBridge|routine|flags|delayed|scheduled|hidden/;
    expect(JSON.stringify(answered.body)).not.toMatch(secret);
    await wait(normal, who, DAY);
    const between = await viewOf(normal, who, who.game.id);
    expect(JSON.stringify(between)).not.toMatch(secret);
    expect(between.morale.effects).toEqual([]);
    expect(JSON.stringify(await eventsOf(normal, who, who.game.id))).not.toMatch(secret);

    // Na 2ª virada de dia depois da escolha, acontece: pedra do entulho e a moral que paga.
    await wait(normal, who, DAY);
    const after = await viewOf(normal, who, who.game.id);
    const applied = cardsOnly(await eventsOf(normal, who, who.game.id)).filter(
      (event) => event.type === 'cardEffectApplied',
    );
    expect(applied).toHaveLength(1);
    expect(applied[0]).toMatchObject({
      atMs: AUDIENCE + 2 * DAY,
      text: 'No 7º dia da Primavera, o poço de Pedra Alta desabou de vez. Do entulho saiu pedra de cantaria; da fila do riacho, só queixa.',
      data: { instanceId: well.instanceId, gained_stone: 20, morale: -10, moraleDays: 2 },
    });
    expect(stock(after, 'stone')).toBe(stone + 20);
    expect(after.morale.effects).toEqual([
      { label: 'Carta: O poço entulhado', amount: -10, endsInSeconds: (3 * DAY) / 1000 },
    ]);
    expect(await chronicleOf(normal, who, who.game.id)).toContain(applied[0]?.text);
  });
});

describe('protocolo 2: o app antigo não sabe ler cartas', () => {
  it('o cliente do protocolo 1 recebe 426 com o aviso de recarregar, em leitura e em ordem', async () => {
    expect(PROTOCOL_VERSION).toBe(2);
    const { who, card } = await playerWithCard(normal, 1);
    const old = { [PROTOCOL]: '1' };
    const expected = {
      code: 'UPGRADE_REQUIRED',
      message: 'Há uma versão nova do jogo. Recarregue a página.',
      details: { protocol: 2 },
    };

    const read = await call<ApiError>(normal, 'GET', `/games/${who.game.id}/view`, {
      token: who.token,
      headers: old,
    });
    expect(read.status).toBe(426);
    expect(read.body).toEqual(expected);
    // A visão com a carta nunca chega a quem não a entenderia.
    expect(JSON.stringify(read.body)).not.toContain(card.title);

    const answer = order('answerCard', {
      instanceId: card.instanceId,
      optionId: card.defaultOptionId,
    });
    const refused = await send<ApiError>(normal, who.token, who.game.id, answer, old);
    expect(refused.status).toBe(426);
    expect(refused.body).toEqual(expected);
    expect(await countRows(normal.pool, 'commands', `game_id = '${who.game.id}'`)).toBe(0);

    // O mesmo vale para as rotas sem sessão.
    const version = await call<ApiError>(normal, 'GET', '/version', { headers: old });
    expect(version.status).toBe(426);

    // O app novo (e quem não diz o protocolo, como o monitor de saúde) é atendido.
    const current = await send<CommandAccepted>(normal, who.token, who.game.id, answer, {
      [PROTOCOL]: String(PROTOCOL_VERSION),
    });
    expect(current.status).toBe(200);
    expect((await call(normal, 'GET', '/version')).status).toBe(200);
    expect((await call<{ protocol: number }>(normal, 'GET', '/version')).body.protocol).toBe(2);
  });
});

describe('uma partida gravada antes do Conselho (versão 7 do estado)', () => {
  type StoredState = {
    schemaVersion: number;
    seed: string;
    lastProcessedAt: number;
    settings: { timeScale: number };
    council?: { nextDrawAtMs: number; pending: unknown[] };
  };

  function v7State(name: string): StoredState {
    const url = new URL(`../../engine/src/__fixtures__/state-v7-${name}.json`, import.meta.url);
    return JSON.parse(readFileSync(url, 'utf8')) as StoredState;
  }

  /** Grava a partida como o servidor anterior a deixou, com o relógio de jogo onde ela parou. */
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

  it('entra no Conselho sem carta nenhuma; a primeira chega um intervalo depois da fronteira', async () => {
    // O feudo que veio da v0.1, no ritmo 3, no ano 4: a ausência toda foi simulada sem cartas.
    const before = v7State('migrated-3x');
    expect(before.schemaVersion).toBe(7);
    expect(before).not.toHaveProperty('council');
    const game = await insertGame(normal, before);
    const view = await viewOf(normal, game, game.id);
    expect(view.council.pending).toEqual([]);
    expect(view.pendingDecisions).toEqual([]);
    expect(cardsOnly(await eventsOf(normal, game, game.id))).toEqual([]);

    const { rows } = await normal.pool.query<{ schema_version: number; state: StoredState }>(
      'select schema_version, state from games where id = $1',
      [game.id],
    );
    expect(rows[0]?.schema_version).toBe(12);
    const nextDrawAtMs = rows[0]?.state.council?.nextDrawAtMs ?? 0;
    // A primeira virada de dia a partir de um intervalo inteiro depois da fronteira.
    expect(nextDrawAtMs % DAY).toBe(0);
    expect(nextDrawAtMs).toBeGreaterThanOrEqual(before.lastProcessedAt + AUDIENCE);
    expect(nextDrawAtMs).toBeLessThan(before.lastProcessedAt + AUDIENCE + DAY);
    const seconds = view.council.nextCardInSeconds ?? 0;
    expect(seconds).toBe(Math.ceil((nextDrawAtMs - before.lastProcessedAt) / PACE / 1000));

    // Um segundo antes, nada; na hora, a primeira carta, com 24 h reais de prazo.
    await wait(normal, game, (seconds - 1) * 1000);
    expect((await viewOf(normal, game, game.id)).council.pending).toEqual([]);
    await wait(normal, game, 1000);
    const arrived = await viewOf(normal, game, game.id);
    expect(arrived.council.pending).toHaveLength(1);
    expect(arrived.council.pending[0]?.expiresInSeconds).toBe(24 * 3600);
    const drawn = cardsOnly(await eventsOf(normal, game, game.id));
    expect(drawn.map((event) => [event.type, event.atMs])).toEqual([['cardDrawn', nextDrawAtMs]]);
  });
});
