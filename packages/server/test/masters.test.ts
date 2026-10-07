import {
  type ApiError,
  type ChronicleResponse,
  type CommandAccepted,
  type EventsResponse,
  type ViewResponse,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  councilRecess,
  countRows,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  quietHorde,
  renew,
  rewriteState,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Os Mestres pela API (roadmap da v0.3, V3E-T3; QA-11): alocar e reenviar, a adaptação com o
// relógio adiantado, o segundo Mestre recusado no mesmo edifício, quem espera à porta e o que
// não sai do servidor. O servidor de teste roda no ritmo 1: um dia de jogo são 2 h.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

type View = ViewResponse['view'];
type Rejected = ApiError & { details: { code: string; message: string; view: View } };

const viewOf = async (token: string, gameId: string) => {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, { token });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
};

const quarryOf = (view: View) => {
  const row = view.workers.find((entry) => entry.building === 'quarry');
  if (row === undefined) {
    throw new Error('A visão não traz a Pedreira.');
  }
  return row;
};

/**
 * Uma partida com Mestres postos direto no estado gravado (no jogo eles chegam por expedição):
 * Odo e Berta no feudo, sem edifício, e, com `atDoor`, Gil à porta com as casas cheias. O
 * Conselho fica em recesso e a Horda, calada.
 */
async function withMasters(name: string, atDoor = false) {
  const player = await newPlayer(server, name);
  const gameId = player.game.id;
  await quietHorde(server, gameId);
  await councilRecess(server, gameId);
  await rewriteState(server, gameId, (state) => {
    const { settlement } = state;
    settlement.masters = [
      { id: 'master-1', masterId: 'odo', building: null, adaptingUntilMs: null, worked: true },
      { id: 'master-2', masterId: 'berta', building: null, adaptingUntilMs: null, worked: true },
    ];
    state.ids.master = 2;
    settlement.workers.quarry = 2;
    if (atDoor) {
      // Dez vagas: oito aldeões e os dois Mestres. Gil fica do lado de fora.
      settlement.population.villagers = 8;
      settlement.mastersWaiting = [{ id: 'master-3', masterId: 'gil' }];
      state.ids.master = 3;
      settlement.resources.wood = 400_000;
      settlement.resources.stone = 300_000;
    }
  });
  return { player, gameId };
}

describe('alocar um Mestre e reenviar a ordem', () => {
  it('uma ordem, um recibo: o duplo clique não recomeça a adaptação, e a outra aba encontra o edifício ocupado', async () => {
    const { player, gameId } = await withMasters('Aldara');
    const before = await viewOf(player.token, gameId);
    expect(before.masters.map((master) => [master.id, master.name, master.buildingLabel])).toEqual([
      ['master-1', 'Mestre Odo', 'Sem edifício'],
      ['master-2', 'Mestra Berta', 'Sem edifício'],
    ]);
    expect(before.population).toMatchObject({ villagers: 5, masters: 2, housed: 7 });
    expect(quarryOf(before)).toMatchObject({ assigned: 2, master: null, grossPerHour: 10 });
    // Antes de confirmar, a tela já diz o que a Pedreira renderia a mais com ele.
    const promised = before.masters[0]?.options.find((option) => option.building === 'quarry');
    expect(promised).toMatchObject({
      gainPerHour: 7.25,
      gainWhileAdaptingPerHour: 2.5,
      blockedReason: null,
    });

    const assign = order('assignMaster', { masterId: 'master-1', building: 'quarry' });
    const original = await send<CommandAccepted>(server, player.token, gameId, assign);
    expect(original.status).toBe(200);
    expect(original.headers['x-lords-replayed']).toBeUndefined();
    expect(original.body.events.map((event) => event.type)).toEqual(['masterAssigned']);
    expect(original.body.events[0]?.data).toEqual({
      masterId: 'master-1',
      masterDefId: 'odo',
      building: 'quarry',
    });
    expect(original.body.events[0]?.text).toContain('Mestre Odo tomou a seu cargo a Pedreira');
    const adapting = original.body.view;
    expect(adapting.masters[0]).toMatchObject({
      building: 'quarry',
      bonusActive: false,
      adaptationEndsInSeconds: 2 * 3600,
    });
    expect(quarryOf(adapting)).toMatchObject({
      assigned: 2,
      grossPerHour: 12.5,
      master: { name: 'Mestre Odo', adapting: true },
    });

    // O duplo clique, meia hora depois: o mesmo commandId devolve o recibo sem reaplicar, e a
    // adaptação continua de onde estava.
    server.clock.advance(30 * MINUTE);
    await renew(server, player);
    const replay = await send<CommandAccepted>(server, player.token, gameId, assign);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);
    const later = await viewOf(player.token, gameId);
    expect(later.masters[0]?.adaptationEndsInSeconds).toBe(90 * 60);
    expect(
      await countRows(
        server.pool,
        'game_events',
        `game_id = '${gameId}' and kind = 'masterAssigned'`,
      ),
    ).toBe(1);

    // A mesma alocação com outro commandId (a outra aba): aceita, sem evento, sem recomeçar.
    const same = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-1', building: 'quarry' }),
    );
    expect(same.status).toBe(200);
    expect(same.body.events).toEqual([]);
    expect(same.body.view.masters[0]?.adaptationEndsInSeconds).toBe(90 * 60);

    // O segundo Mestre no mesmo edifício é recusado, com a frase e a visão de agora.
    const second = await send<Rejected>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-2', building: 'quarry' }),
    );
    expect(second.status).toBe(422);
    expect(second.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'A Pedreira já tem Mestre Odo: cabe um Mestre por edifício, e o bônus não soma.',
      details: { code: 'BUILDING_HAS_MASTER' },
    });
    expect(
      second.body.details.view.masters[1]?.options.find((option) => option.building === 'quarry')
        ?.blockedReason,
    ).toBe('já tem Mestre Odo');
    const unknown = await send<Rejected>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-9', building: 'farm' }),
    );
    expect(unknown.body).toMatchObject({ details: { code: 'MASTER_NOT_FOUND' } });
  });

  it('passado um dia de jogo o Mestre dá o bônus, com a explicação, e a Crônica conta a alocação', async () => {
    const { player, gameId } = await withMasters('Mécia');
    const sent = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-1', building: 'quarry' }),
    );
    expect(sent.status).toBe(200);
    server.clock.advance(2 * HOUR + MINUTE);
    await renew(server, player);
    const view = await viewOf(player.token, gameId);
    expect(view.masters[0]).toMatchObject({ bonusActive: true, adaptationEndsInSeconds: null });
    const quarry = quarryOf(view);
    expect(quarry.master).toEqual({
      id: 'master-1',
      name: 'Mestre Odo',
      adapting: false,
      bonusText: '+15% na produção',
    });
    expect(quarry.breakdown).toContain('2 trabalhadores e Mestre Odo');
    expect(quarry.breakdown).toContain('× 1,15 (Mestre Odo)');
    const chronicle = await call<ChronicleResponse>(server, 'GET', `/games/${gameId}/chronicle`, {
      token: player.token,
    });
    expect(
      chronicle.body.entries.some((entry) => entry.text.includes('Mestre Odo tomou a seu cargo')),
    ).toBe(true);
    // Deixá-lo sem edifício tira o braço e o bônus na hora.
    const freed = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-1', building: null }),
    );
    expect(freed.status).toBe(200);
    expect(quarryOf(freed.body.view).master).toBeNull();
    expect(freed.body.view.masters[0]?.buildingLabel).toBe('Sem edifício');
  });

  it('quem espera à porta não recebe ofício, entra quando as Habitações ficam prontas, e o estado e o gerador não saem do servidor', async () => {
    const { player, gameId } = await withMasters('Guiomar', true);
    const before = await viewOf(player.token, gameId);
    expect(before.mastersWaiting).toEqual({
      count: 1,
      names: ['Mestre Gil'],
      note: 'Mestre Gil espera uma vaga nas casas: entra assim que houver uma.',
    });
    expect(before.population).toMatchObject({ villagers: 8, masters: 2, vacancies: 0 });
    const early = await send<Rejected>(
      server,
      player.token,
      gameId,
      order('assignMaster', { masterId: 'master-3', building: 'farm' }),
    );
    expect(early.status).toBe(422);
    expect(early.body).toMatchObject({ details: { code: 'MASTER_WAITING' } });
    // A forma errada nem chega ao motor.
    const malformed = await call<ApiError>(server, 'POST', `/games/${gameId}/commands`, {
      token: player.token,
      body: {
        commandId: '6f1c1f0e-5d1b-4c58-9a35-1f3f1c2b7d10',
        type: 'assignMaster',
        payload: { masterId: 'master-1', building: 'tavern' },
      },
    });
    expect(malformed.status).toBe(400);

    const built = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      order('startConstruction', { building: 'housing' }),
    );
    expect(built.status).toBe(200);
    const wait = built.body.view.constructions.active?.secondsRemaining ?? 0;
    expect(wait).toBeGreaterThan(0);
    server.clock.advance((wait + 60) * 1000);
    await renew(server, player);
    const after = await viewOf(player.token, gameId);
    expect(after.mastersWaiting).toEqual({ count: 0, names: [], note: null });
    expect(after.masters.map((master) => master.name)).toEqual([
      'Mestre Odo',
      'Mestra Berta',
      'Mestre Gil',
    ]);
    const events = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: player.token,
    });
    const arrived = events.body.events.filter((event) => event.type === 'masterArrived');
    expect(arrived).toHaveLength(1);
    expect(arrived[0]?.text).toContain('Mestre Gil, que esperava à porta, entrou para ficar');
    // Nada do que o estado guarda e a visão não mostra sai na resposta.
    const raw = JSON.stringify(after);
    for (const secret of ['adaptingUntilMs', 'masterId', '"rng"', '"ids"']) {
      expect(raw.includes(secret), secret).toBe(false);
    }
  });
});
