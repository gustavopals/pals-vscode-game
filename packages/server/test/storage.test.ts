import {
  CHRONICLE_HIDDEN_EVENT_TYPES,
  type ChronicleResponse,
  type CommandAccepted,
  type EventsResponse,
  type GameEvent,
  type GameRuleError,
  type ViewResponse,
  ViewResponseSchema,
  type ViewState,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  createTestApp,
  HOUR,
  MINUTE,
  order,
  type Player,
  renew,
  send,
  signUp,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Armazenamento (V2C-T2; GDD §5.5; ADR 0013, decisões 4 e 17) visto pela API: o limite e o
// "cheio em" na visão em tempo real, o instante exato de encher, o desperdício do dia em
// `GET /events` e fora da Crônica (ADR 0015), a recusa de uma obra que não cabe no depósito e a
// construção do Armazém com reenvio. Os números são os do GDD no ritmo Normal: 500 de limite
// inicial (400 em Rei de Ferro), 8 de madeira por lenhador por hora, dia de jogo de 2 h.

const SECOND = 1000;
const PACE = 3;

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

async function player(
  server: TestApp,
  difficulty: 'peasant' | 'lord' | 'ironKing' = 'lord',
): Promise<Player> {
  const auth = await signUp(server, 'Gustavo');
  return {
    auth,
    accountId: auth.account.id,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
    game: await startGame(server, auth.accessToken, { difficulty }),
  };
}

/** Avança o relógio real da instância e renova a sessão do jogador (o token vale 15 min). */
async function wait(server: TestApp, who: Player, ms: number): Promise<void> {
  server.clock.advance(ms);
  await renew(server, who);
}

async function viewOf(server: TestApp, who: Player): Promise<ViewState> {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${who.game.id}/view`, {
    token: who.token,
  });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
}

async function eventsOf(server: TestApp, who: Player): Promise<GameEvent[]> {
  const reply = await call<EventsResponse>(
    server,
    'GET',
    `/games/${who.game.id}/events?limit=500`,
    {
      token: who.token,
    },
  );
  expect(reply.status).toBe(200);
  return reply.body.events;
}

async function chronicleOf(server: TestApp, who: Player): Promise<GameEvent[]> {
  const reply = await call<ChronicleResponse>(
    server,
    'GET',
    `/games/${who.game.id}/chronicle?limit=500`,
    { token: who.token },
  );
  expect(reply.status).toBe(200);
  return reply.body.entries;
}

async function accepted(
  server: TestApp,
  who: Player,
  command: ReturnType<typeof order>,
): Promise<CommandAccepted> {
  const reply = await send<CommandAccepted>(server, who.token, who.game.id, command);
  expect(reply.status, JSON.stringify(reply.body)).toBe(200);
  return reply.body;
}

const resource = (view: ViewState, id: 'food' | 'wood' | 'stone' | 'gold') => {
  const found = view.resources.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`Recurso ${id} ausente da visão.`);
  }
  return found;
};

const upgradeOf = (view: ViewState, building: string) => {
  const found = view.constructions.available.find((entry) => entry.building === building);
  if (found === undefined) {
    throw new Error(`Obra de ${building} ausente da visão.`);
  }
  return found;
};

describe('o limite na visão, em tempo real', () => {
  it('partida nova: 500 por recurso, o ouro sem limite, e os depósitos na lista de obras', async () => {
    const who = await player(normal);
    const view = await viewOf(normal, who);
    expect(view.resources.map((row) => [row.id, row.cap, row.storageLabel, row.full])).toEqual([
      ['food', 500, 'Despensa', false],
      ['wood', 500, 'Pátio', false],
      ['stone', 500, 'Pátio', false],
      ['gold', null, null, false],
    ]);
    expect(upgradeOf(view, 'granary')).toMatchObject({
      fromLevel: 0,
      targetLevel: 1,
      blockedCode: 'GATE_LOCKED',
      blockedReason: 'Melhore antes o Salão do Senhor para o nível 2.',
      effect: 'Capacidade de comida: 500 → 900.',
    });
    expect(upgradeOf(view, 'warehouse').effect).toBe(
      'Capacidade de madeira e de pedra: 500 → 900 cada.',
    );
  });

  it('a dificuldade muda o limite: 625 em Camponês e 400 em Rei de Ferro, com a conta', async () => {
    const peasant = await viewOf(normal, await player(normal, 'peasant'));
    expect(resource(peasant, 'wood')).toMatchObject({
      cap: 625,
      capBreakdown: '500 iniciais × 1,25 (Camponês) = 625',
    });
    const iron = await viewOf(normal, await player(normal, 'ironKing'));
    expect(resource(iron, 'food')).toMatchObject({
      cap: 400,
      capBreakdown: '500 iniciais × 0,8 (Rei de Ferro) = 400',
    });
  });

  it('no ritmo 3, "cheio em" é um terço do prazo de jogo e o estoque enche no segundo exato', async () => {
    const who = await player(fast);
    await accepted(fast, who, order('setWorkers', { building: 'farm', count: 1 }));
    const first = await accepted(
      fast,
      who,
      order('setWorkers', { building: 'lumberMill', count: 3 }),
    );
    // 120 de madeira: faltam 380. Os três lenhadores, recém-chegados, rendem 12 por hora de jogo
    // no primeiro dia e 24 depois, com a experiência que a Serraria ganha a cada virada
    // (× 1,012, × 1,024...). A conta dá 58.129.928 ms de jogo, no 9º dia; no relógio do
    // jogador, um terço disso: 5 h 22 min 57 s. Por ora a Serraria rende 36 por hora real.
    const FILLS_AT = 58_129_928;
    const fillsInSeconds = Math.ceil(FILLS_AT / PACE / SECOND);
    expect(fillsInSeconds).toBe(19_377);
    expect(resource(first.view, 'wood')).toMatchObject({
      cap: 500,
      full: false,
      fullInSeconds: fillsInSeconds,
      fullNote: null,
      perHour: 36,
      wastingPerHour: 0,
    });

    await wait(fast, who, fillsInSeconds * SECOND - SECOND);
    const before = await viewOf(fast, who);
    expect(resource(before, 'wood')).toMatchObject({ stock: 499, full: false, fullInSeconds: 1 });

    await wait(fast, who, SECOND);
    const after = await viewOf(fast, who);
    expect(resource(after, 'wood')).toMatchObject({
      stock: 500,
      full: true,
      fullInSeconds: null,
      // 24 × 1,096 (32 de experiência) por hora de jogo, vistos por hora real.
      wastingPerHour: 78.9,
      // O Salão ainda está no nível 1: a frase diz o que libera o Armazém.
      fullNote:
        'Pátio cheio: 78,9/h de madeira indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, gaste madeira.',
    });
    const filled = (await eventsOf(fast, who)).filter((event) => event.type === 'storageFilled');
    expect(filled).toHaveLength(1);
    // O instante do evento é de jogo; o instante real é o da criação mais um terço dele.
    expect(filled[0]).toMatchObject({
      atMs: FILLS_AT,
      text: 'No 9º dia da Primavera, o Pátio de Pedra Alta encheu: não cabe mais madeira, e o que chegar se perde.',
      data: { resource: 'wood', building: 'warehouse', level: 0, cap: 500 },
    });
    expect(new Date(filled[0]?.at ?? 0).getTime()).toBe(
      new Date(who.game.createdAt).getTime() + Math.round(FILLS_AT / PACE),
    );
  });
});

describe('o desperdício do dia (ADR 0015)', () => {
  it('sai em GET /events com os totais, uma vez por dia de jogo, e fica fora da Crônica', async () => {
    const who = await player(normal);
    await accepted(normal, who, order('setWorkers', { building: 'farm', count: 1 }));
    await accepted(normal, who, order('setWorkers', { building: 'lumberMill', count: 3 }));
    // Os lenhadores rendem metade no primeiro dia de jogo e ganham experiência a cada virada: o
    // Pátio enche às 16 h 08 min 50 s, no 9º dia de jogo, que vira às 18 h. Dois dias cheios
    // depois: 22 h.
    await wait(normal, who, 22 * HOUR);
    const view = await viewOf(normal, who);
    expect(resource(view, 'wood')).toMatchObject({ stock: 500, full: true, wastedToday: 0 });

    const events = await eventsOf(normal, who);
    const wasted = events.filter((event) => event.type === 'storageWasted');
    // O resto do dia em que encheu (48,7 de madeira, a 26,3 por hora) e dois dias inteiros, a
    // 26,6 e 26,9 por hora; a fração de cada fecho passa para o seguinte.
    expect(wasted.map((event) => [event.atMs / HOUR, event.data])).toEqual([
      [18, { wasted_wood: 48 }],
      [20, { wasted_wood: 53 }],
      [22, { wasted_wood: 54 }],
    ]);
    expect(wasted[1]?.text).toBe(
      'No 10º dia da Primavera, a produção de Pedra Alta não coube nos depósitos e foi ao chão: 53 de madeira.',
    );
    expect(events.filter((event) => event.type === 'storageFilled')).toHaveLength(1);

    // A Crônica conta que o depósito encheu, e não repete o fecho de cada dia.
    expect(CHRONICLE_HIDDEN_EVENT_TYPES).toEqual(['dayStarted', 'storageWasted']);
    const chronicle = await chronicleOf(normal, who);
    expect(chronicle.map((event) => event.type)).toEqual(['storageFilled']);
    const markdown = await call<string>(normal, 'GET', `/games/${who.game.id}/chronicle.md`, {
      token: who.token,
    });
    expect(markdown.status).toBe(200);
    expect(markdown.body).toContain('o Pátio de Pedra Alta encheu');
    expect(markdown.body).not.toContain('foi ao chão');
    expect(markdown.body).not.toContain('Amanhece');
  });

  it('o job de avanço grava o desperdício de quem não voltou, e a leitura seguinte não o repete', async () => {
    const who = await player(normal);
    await accepted(normal, who, order('setWorkers', { building: 'farm', count: 1 }));
    await accepted(normal, who, order('setWorkers', { building: 'lumberMill', count: 3 }));
    normal.clock.advance(20 * HOUR);
    await runJobsOnce(normal.ctx);
    const { rows } = await normal.pool.query<{ kind: string }>(
      `select kind from game_events where game_id = $1 and kind like 'storage%' order by seq`,
      [who.game.id],
    );
    // Encheu às 16 h 08 min: os fechos das 18 h e das 20 h.
    expect(rows.map((row) => row.kind)).toEqual([
      'storageFilled',
      'storageWasted',
      'storageWasted',
    ]);
    // O jogador volta: duas leituras no mesmo instante não gravam nada de novo.
    await renew(normal, who);
    await viewOf(normal, who);
    await viewOf(normal, who);
    const wasted = (await eventsOf(normal, who)).filter((event) => event.type === 'storageWasted');
    expect(wasted.map((event) => event.atMs / HOUR)).toEqual([18, 20]);
    expect(new Set(wasted.map((event) => event.seq)).size).toBe(2);
  });
});

describe('obra que não cabe no depósito, e o Armazém que a destrava', () => {
  it('em Rei de Ferro o Salão no nível 3 pede o Armazém; construído, a obra volta a só faltar recurso', async () => {
    const who = await player(normal, 'ironKing');
    for (const [building, count] of [
      ['farm', 1],
      ['lumberMill', 2],
      ['quarry', 1],
      ['goldMine', 1],
    ] as const) {
      await accepted(normal, who, order('setWorkers', { building, count }));
    }
    // Salão 1→2 às 8 h: 150 de madeira, 100 de pedra (65 + 5 por hora) e 100 de ouro.
    await wait(normal, who, 8 * HOUR);
    await accepted(normal, who, order('startConstruction', { building: 'townHall' }));
    // Salão 2→3 às 44 h: 270 de madeira, 180 de pedra e 180 de ouro.
    await wait(normal, who, 36 * HOUR);
    await accepted(normal, who, order('startConstruction', { building: 'townHall' }));
    await wait(normal, who, HOUR);

    // Salão 3→4: 486 de madeira, e o Pátio de Rei de Ferro guarda 400.
    const blocked = await viewOf(normal, who);
    expect(blocked.settlement.townHallLevel).toBe(3);
    const message =
      'A obra pede 486 de madeira e o Pátio só guarda 400: construa o Armazém primeiro.';
    expect(upgradeOf(blocked, 'townHall')).toMatchObject({
      blockedCode: 'EXCEEDS_STORAGE',
      blockedReason: message,
    });
    const refused = await send<GameRuleError>(
      normal,
      who.token,
      who.game.id,
      order('startConstruction', { building: 'townHall' }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message,
      details: { code: 'EXCEEDS_STORAGE', message },
    });

    // O Armazém: 160 de madeira e 80 de pedra. A pedra chega às 60 h.
    await wait(normal, who, 15 * HOUR);
    const build = order('startConstruction', { building: 'warehouse' });
    const started = await accepted(normal, who, build);
    // A resposta traz também o que o mundo andou desde a última leitura; a ordem é o último.
    const founding = started.events.filter((event) => event.type === 'constructionStarted');
    expect(founding.map((event) => event.text)).toEqual([
      'No 7º dia do Verão, os pedreiros começaram a levantar o Armazém em Pedra Alta.',
    ]);
    expect(founding[0]?.data).toEqual({
      building: 'warehouse',
      level: 1,
      spent_wood: 160,
      spent_stone: 80,
    });
    const paid = resource(started.view, 'wood').stock;

    // O mesmo comando de novo é o recibo: nada é pago duas vezes.
    const again = await send<CommandAccepted>(normal, who.token, who.game.id, build);
    expect(again.status).toBe(200);
    expect(again.headers['x-lords-replayed']).toBe('true');
    expect(resource(await viewOf(normal, who), 'wood').stock).toBe(paid);

    await wait(normal, who, 10 * MINUTE);
    const built = await viewOf(normal, who);
    expect(resource(built, 'wood')).toMatchObject({
      cap: 720,
      capBreakdown: 'Armazém Nv1: 900 × 0,8 (Rei de Ferro) = 720',
      storageLabel: 'Armazém',
    });
    expect(resource(built, 'stone').cap).toBe(720);
    // A comida continua na Despensa: o Armazém não a guarda.
    expect(resource(built, 'food')).toMatchObject({ cap: 400, storageLabel: 'Despensa' });
    expect(upgradeOf(built, 'townHall').blockedCode).toBe('INSUFFICIENT_RESOURCES');
    expect(upgradeOf(built, 'warehouse')).toMatchObject({
      fromLevel: 1,
      effect: 'Capacidade de madeira e de pedra: 720 → 1.200 cada.',
    });
    const founded = (await eventsOf(normal, who)).filter(
      (event) => event.type === 'buildingFounded',
    );
    expect(founded.map((event) => event.text)).toEqual([
      'No 7º dia do Verão, ergueu-se o Armazém em Pedra Alta.',
    ]);
  });
});
