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
  type Player,
  renew,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Troca de ofício e experiência do ofício (V2C-T3; GDD §5.4; ADR 0013, decisões 1 e 13) vistas
// pela API: quem chega a um edifício rende metade por um dia de jogo, que são 2 h reais no ritmo
// Normal e 40 min no Rápido; a ordem reenviada não cria outra leva; a experiência sobe com o
// jogador fora, e o ofício dominado vira linha da Crônica. Os números são os do GDD: um
// lenhador rende 8 de madeira por hora de jogo.

const PACE = 3;
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
    { token: who.token },
  );
  expect(reply.status).toBe(200);
  return reply.body.events;
}

const rowOf = (view: ViewState, building: string) => {
  const row = view.workers.find((entry) => entry.building === building);
  if (row === undefined) {
    throw new Error(`A visão não trouxe ${building}.`);
  }
  return row;
};

describe.each([
  ['Normal', 1, () => normal],
  ['Rápido', PACE, () => fast],
] as const)('troca de ofício no ritmo %s', (_label, pace, app) => {
  // Um dia de jogo: 2 h reais no ritmo 1, 40 min no ritmo 3.
  const adaptation = (2 * HOUR) / pace;

  it('quem chega rende metade pelo prazo que a visão anuncia, e inteiro depois', async () => {
    const server = app();
    const who = await newPlayer(server);
    const before = await viewOf(server, who);
    // A regra chega antes da ordem, no ritmo da partida.
    expect(before.workersRules.adaptationSeconds).toBe(adaptation / 1000);
    expect(before.workersRules.adaptationText).toBe(
      pace === 1
        ? 'Quem troca de ofício produz metade por 2 h.'
        : 'Quem troca de ofício produz metade por 40 min.',
    );
    expect(rowOf(before, 'lumberMill')).toMatchObject({
      perWorkerPerHour: 8 * pace,
      perNewWorkerPerHour: 4 * pace,
    });

    const reply = await send<CommandAccepted>(
      server,
      who.token,
      who.game.id,
      order('setWorkers', { building: 'lumberMill', count: 2 }),
    );
    expect(reply.status).toBe(200);
    // A troca não é linha da Crônica: só a taxa muda.
    expect(reply.body.events).toEqual([]);
    expect(rowOf(reply.body.view, 'lumberMill')).toMatchObject({
      assigned: 2,
      adapting: 2,
      adaptationEndsInSeconds: adaptation / 1000,
      adaptingCohorts: [{ count: 2, endsInSeconds: adaptation / 1000 }],
      // Dois lenhadores pela metade: 8 de madeira por hora de jogo.
      grossPerHour: 8 * pace,
    });

    // Um minuto real antes do fim, ainda metade; no fim, os dois rendem inteiro, e a virada do
    // dia já deu 4 de experiência à Serraria (× 1,012).
    await wait(server, who, adaptation - MINUTE);
    const almost = rowOf(await viewOf(server, who), 'lumberMill');
    expect(almost).toMatchObject({ adapting: 2, adaptationEndsInSeconds: 60 });
    expect(almost.grossPerHour).toBe(8 * pace);

    await wait(server, who, MINUTE);
    const done = await viewOf(server, who);
    expect(rowOf(done, 'lumberMill')).toMatchObject({
      adapting: 0,
      adaptationEndsInSeconds: null,
      adaptingCohorts: [],
      experience: 4,
      masteryBonusPercent: 1.2,
    });
    // E a moral, com a comida guardada, foi a 60 na mesma virada: 16 × 1,012 × 1,05 = 17,0016,
    // 17,001 por hora de jogo depois do único arredondamento.
    expect(rowOf(done, 'lumberMill').grossPerHour).toBeCloseTo(17.001 * pace, 9);
    expect(done.morale).toMatchObject({ value: 60, multiplierPercent: 105 });
    // A madeira do período: 16 unidades em um dia de jogo, e não 32.
    expect(done.resources.find((row) => row.id === 'wood')?.stock).toBe(120 + 16);
    // O fim da adaptação não deixou evento nenhum além da virada do dia.
    const events = await eventsOf(server, who);
    expect(events.map((event) => event.type)).toEqual(['dayStarted']);
  });

  it('a ordem reenviada devolve o recibo e não cria outra leva', async () => {
    const server = app();
    const who = await newPlayer(server);
    const command = order('setWorkers', { building: 'quarry', count: 1 });
    const first = await send<CommandAccepted>(server, who.token, who.game.id, command);
    expect(first.status).toBe(200);
    // Meio prazo depois, a mesma ordem chega de novo (o clique duplo, a rede que caiu).
    await wait(server, who, adaptation / 2);
    const again = await send<CommandAccepted>(server, who.token, who.game.id, command);
    expect(again.status).toBe(200);
    expect(again.headers[REPLAYED]).toBe('true');
    expect(again.body).toEqual(first.body);
    // A leva é uma só, com o prazo contado da primeira vez.
    expect(rowOf(await viewOf(server, who), 'quarry')).toMatchObject({
      assigned: 1,
      adapting: 1,
      adaptationEndsInSeconds: adaptation / 2 / 1000,
      adaptingCohorts: [{ count: 1, endsInSeconds: adaptation / 2 / 1000 }],
    });
    // E pedir de novo o mesmo número, com outra ordem, também não recomeça a adaptação.
    const same = await send<CommandAccepted>(
      server,
      who.token,
      who.game.id,
      order('setWorkers', { building: 'quarry', count: 1 }),
    );
    expect(same.status).toBe(200);
    expect(rowOf(same.body.view, 'quarry').adaptationEndsInSeconds).toBe(adaptation / 2 / 1000);
  });

  it('tirar gente tira primeiro quem ainda se adapta; a recusa não mexe em ninguém', async () => {
    const server = app();
    const who = await newPlayer(server);
    const send1 = (building: 'farm' | 'quarry', count: number) =>
      send<CommandAccepted>(
        server,
        who.token,
        who.game.id,
        order('setWorkers', { building, count }),
      );
    expect((await send1('farm', 2)).status).toBe(200);
    await wait(server, who, adaptation);
    // Os dois lavradores já são veteranos; chega um terceiro.
    const grown = await send1('farm', 3);
    expect(rowOf(grown.body.view, 'farm')).toMatchObject({ assigned: 3, adapting: 1 });
    // Sai um: é o novato. Os veteranos ficam.
    const shrunk = await send1('farm', 2);
    expect(rowOf(shrunk.body.view, 'farm')).toMatchObject({
      assigned: 2,
      adapting: 0,
      adaptationEndsInSeconds: null,
    });
    // Mais gente do que há: a recusa vem com a frase do motor e o feudo fica como estava.
    const refused = await send<GameRuleError>(
      server,
      who.token,
      who.game.id,
      order('setWorkers', { building: 'quarry', count: 9 }),
    );
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'Só há 3 aldeões livres para esse ofício.',
      details: { code: 'NOT_ENOUGH_VILLAGERS' },
    });
    expect(rowOf(await viewOf(server, who), 'quarry')).toMatchObject({ assigned: 0, adapting: 0 });
  });
});

describe('experiência do ofício com o jogador fora', () => {
  it('no ritmo Rápido, 25 dias de jogo ocupados dominam o ofício, e a Crônica conta', async () => {
    const who = await newPlayer(fast);
    for (const [building, count] of [
      ['farm', 2],
      ['lumberMill', 2],
    ] as const) {
      const reply = await send<CommandAccepted>(
        fast,
        who.token,
        who.game.id,
        order('setWorkers', { building, count }),
      );
      expect(reply.status).toBe(200);
    }
    // 25 dias de jogo são 50 h de jogo: 16 h 40 min reais no ritmo 3. O jogador não volta
    // até lá, e o estado é avançado de uma vez na leitura.
    await wait(fast, who, (25 * 2 * HOUR) / PACE);
    const view = await viewOf(fast, who);
    expect(rowOf(view, 'lumberMill')).toMatchObject({
      experience: 100,
      masteryBonusPercent: 30,
      experienceTrend: 'steady',
      experienceNote:
        'Ofício dominado: 30% a mais de produção. Só se perde se ninguém trabalhar na Serraria.',
    });
    // 2 lenhadores × 8 × 1,3 (mestria) × 1,15 (o verão já chegou) × 1,05 (a moral em 60, com a
    // comida guardada) por hora de jogo, vistos por hora real.
    expect(view.calendar.season).toBe('summer');
    expect(view.morale.value).toBe(60);
    expect(rowOf(view, 'lumberMill').grossPerHour).toBeCloseTo(16 * 1.3 * 1.15 * 1.05 * PACE, 9);
    // A Pedreira, sem ninguém, não ganhou nada.
    expect(rowOf(view, 'quarry')).toMatchObject({ experience: 0, experienceTrend: 'steady' });

    const mastered = (await eventsOf(fast, who)).filter((event) => event.type === 'craftMastered');
    expect(mastered.map((event) => event.data)).toEqual([
      { building: 'farm', experience: 100 },
      { building: 'lumberMill', experience: 100 },
    ]);
    // No 2º dia do Verão: o 26º dia de jogo.
    expect(mastered[1]?.text).toBe(
      'No 2º dia do Verão, os lenhadores de Pedra Alta dominaram o ofício: já nenhum machado erra o golpe.',
    );
    expect(mastered[1]?.atMs).toBe(25 * 2 * HOUR);

    const chronicle = await call<ChronicleResponse>(
      fast,
      'GET',
      `/games/${who.game.id}/chronicle?limit=200`,
      { token: who.token },
    );
    expect(chronicle.status).toBe(200);
    expect(JSON.stringify(chronicle.body)).toContain('os lavradores de Pedra Alta dominaram');
  });
});
