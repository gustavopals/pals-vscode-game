import type {
  Account,
  AuthResponse,
  CommandAccepted,
  DeleteMeResponse,
  EventsResponse,
  ListGamesResponse,
  RecoveryCodeResponse,
  ViewResponse,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  countRows,
  createTestApp,
  DAY,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  renew,
  send,
  type TestApp,
} from '../../packages/server/test/helpers/app';
import { resetTestDb } from '../../packages/server/test/helpers/db';
import { runJobsOnce } from '../../packages/server/src/jobs/scheduler';

// Cenários de ponta a ponta da v0.1 (MVP-ROADMAP.md F2-T8.1): a história de um jogador
// contada só pela API, como o app web faz.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

const viewOf = async (target: TestApp, token: string, gameId: string) => {
  const reply = await call<ViewResponse>(target, 'GET', `/games/${gameId}/view`, { token });
  expect(reply.status).toBe(200);
  return reply.body;
};

describe('primeira hora de um jogador novo', () => {
  it('conta, partida, seis comandos e a visão do feudo crescendo', async () => {
    const player = await newPlayer(server, 'Gustavo');
    const { game } = player;

    // Primeira sessão: os três primeiros objetivos entram em andamento.
    const orders = [
      order('setWorkers', { building: 'farm', count: 2 }),
      order('startConstruction', { building: 'housing' }),
      order('recruitVillagers', { quantity: 3 }),
    ];
    for (const command of orders) {
      const reply = await send<CommandAccepted>(server, player.token, game.id, command);
      expect(reply.status).toBe(200);
    }

    // Vinte minutos depois: a obra das Habitações terminou e o primeiro aldeão chegou.
    server.clock.advance(20 * MINUTE);
    await renew(server, player);
    const afterTwenty = await viewOf(server, player.token, game.id);
    expect(afterTwenty.view.population).toMatchObject({
      villagers: 6,
      capacity: 15,
      inTraining: 2,
    });
    expect(afterTwenty.view.constructions.active).toBeNull();

    // Fim da hora: os três chegaram; os novos braços vão para a madeira e a pedra.
    server.clock.advance(40 * MINUTE);
    await renew(server, player);
    const more = [
      order('setWorkers', { building: 'lumberMill', count: 3 }),
      order('setWorkers', { building: 'quarry', count: 3 }),
      order('planConstruction', { building: 'townHall' }),
    ];
    for (const command of more) {
      const reply = await send<CommandAccepted>(server, player.token, game.id, command);
      expect(reply.status).toBe(200);
    }

    const { view, stateVersion } = await viewOf(server, player.token, game.id);
    expect(view.population).toMatchObject({ villagers: 8, free: 0, inTraining: 0 });
    expect(view.objectives.filter((objective) => objective.status === 'completed')).toHaveLength(3);
    expect(view.constructions.planned.map((plan) => plan.building)).toEqual(['townHall']);
    // Todos acabaram de ganhar ofício e rendem metade por um dia de jogo (2 h no ritmo 1): os
    // lavradores, 12 contra 8 bocas; os lenhadores, 12; os canteiros, 7,5.
    expect(view.resources.map((row) => [row.id, row.perHour])).toEqual([
      ['food', 4],
      ['wood', 12],
      ['stone', 7.5],
      ['gold', 0],
    ]);
    expect(
      view.workers.map((row) => [row.building, row.adapting, row.adaptationEndsInSeconds]),
    ).toEqual([
      ['farm', 2, 3600],
      ['lumberMill', 3, 7200],
      ['quarry', 3, 7200],
      ['goldMine', 0, null],
    ]);
    // Seis comandos e uma leitura com eventos (a dos 20 minutos): cada escrita incrementou a
    // versão uma vez. Os eventos do fim da hora foram persistidos pelo comando seguinte.
    expect(Number(stateVersion)).toBe(1 + 6 + 1);

    const chronicle = await call<string>(server, 'GET', `/games/${game.id}/chronicle.md`, {
      token: player.token,
    });
    expect(chronicle.body).toContain('os pedreiros ergueram as Habitações ao 2º nível');
    expect(chronicle.body).toContain('cumpriu-se um objetivo: Recrute 3 aldeões');
  });
});

describe('troca de máquina', () => {
  it('o Código do Reino abre o mesmo feudo em outra máquina, em segundos', async () => {
    const player = await newPlayer(server, 'Edda');
    await send(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );

    const generated = await call<RecoveryCodeResponse>(server, 'POST', '/auth/recovery-code', {
      token: player.token,
    });
    expect(generated.body.code).toMatch(/^([A-Z2-9]{4}-){4}[A-Z2-9]{4}$/);

    // Na outra máquina não há token nenhum: só o código, digitado em minúsculas.
    const recovered = await call<AuthResponse>(server, 'POST', '/auth/recover', {
      body: { code: generated.body.code.toLowerCase(), deviceLabel: 'notebook' },
    });
    expect(recovered.status).toBe(200);
    expect(recovered.body.account.id).toBe(player.accountId);

    const games = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: recovered.body.accessToken,
    });
    expect(games.body.games.map((game) => game.id)).toEqual([player.game.id]);
    const there = await viewOf(server, recovered.body.accessToken, player.game.id);
    const here = await viewOf(server, player.token, player.game.id);
    expect(there).toEqual(here);
    expect(there.view.workers[0]).toMatchObject({ building: 'farm', assigned: 2 });
  });
});

describe('duas máquinas ao mesmo tempo', () => {
  it('sessões distintas, comandos intercalados e visões sempre iguais', async () => {
    const desktop = await newPlayer(server, 'Rolf');
    const code = await call<RecoveryCodeResponse>(server, 'POST', '/auth/recovery-code', {
      token: desktop.token,
    });
    const laptop = (
      await call<AuthResponse>(server, 'POST', '/auth/recover', { body: { code: code.body.code } })
    ).body;
    const gameId = desktop.game.id;

    const turns: Array<[string, ReturnType<typeof order>]> = [
      [desktop.token, order('setWorkers', { building: 'farm', count: 2 })],
      [laptop.accessToken, order('startConstruction', { building: 'housing' })],
      [desktop.token, order('recruitVillagers', { quantity: 2 })],
      [laptop.accessToken, order('setWorkers', { building: 'lumberMill', count: 3 })],
    ];
    let knownByDesktop = '1';
    for (const [token, command] of turns) {
      const reply = await send<CommandAccepted>(server, token, gameId, command, {
        'x-lords-state-version': token === desktop.token ? knownByDesktop : '1',
      });
      expect(reply.status).toBe(200);
      if (token === desktop.token) {
        knownByDesktop = reply.body.stateVersion;
      }
      // Depois de cada ordem, as duas máquinas veem exatamente o mesmo feudo.
      const a = await viewOf(server, desktop.token, gameId);
      const b = await viewOf(server, laptop.accessToken, gameId);
      expect(a).toEqual(b);
    }

    // A outra máquina agiu enquanto esta decidia: o servidor aplica e avisa.
    const stale = await send<CommandAccepted>(
      server,
      desktop.token,
      gameId,
      order('setWorkers', { building: 'quarry', count: 0 }),
      { 'x-lords-state-version': knownByDesktop },
    );
    expect(stale.status).toBe(200);
    expect(stale.body.staleView).toBe(true);

    // Cada ordem foi aplicada uma única vez, na ordem em que chegou.
    const { rows } = await server.pool.query<{ seq: string; type: string }>(
      'select seq, type from commands where game_id = $1 order by seq',
      [gameId],
    );
    expect(rows.map((row) => [Number(row.seq), row.type])).toEqual([
      [1, 'setWorkers'],
      [2, 'startConstruction'],
      [3, 'recruitVillagers'],
      [4, 'setWorkers'],
      [5, 'setWorkers'],
    ]);

    // As duas máquinas recebem os mesmos eventos pelo cursor, sem repetição.
    const first = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: desktop.token,
    });
    const second = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: laptop.accessToken,
    });
    expect(second.body).toEqual(first.body);
    const seqs = first.body.events.map((event) => event.seq);
    expect(seqs).toEqual(seqs.map((_, index) => index + 1));
  });
});

describe('reiniciar o servidor no meio do dia', () => {
  it('não perde nem duplica nada, e o mundo andou enquanto ele esteve fora', async () => {
    const player = await newPlayer(server, 'Mira');
    const building = order('startConstruction', { building: 'housing' });
    const original = await send<CommandAccepted>(server, player.token, player.game.id, building);
    expect(original.status).toBe(200);

    // O processo cai. Três horas depois, outra instância sobe diante do mesmo banco.
    const clock = server.clock;
    await server.close();
    clock.advance(3 * HOUR);
    server = await createTestApp({ clock });
    await renew(server, player);

    // O cliente não soube se a ordem tinha chegado e a reenvia: recebe o recibo original.
    const replay = await send<CommandAccepted>(server, player.token, player.game.id, building);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);

    const { view } = await viewOf(server, player.token, player.game.id);
    expect(view.settlement.name).toBe('Pedra Alta');
    expect(view.population.capacity).toBe(15);
    expect(view.calendar.dayOfSeason).toBe(2);
    // A madeira foi descontada uma única vez: 120 − 80, mais os 30 do objetivo.
    expect(view.resources[1]).toMatchObject({ id: 'wood', stock: 70 });
    expect(await countRows(server.pool, 'commands', `game_id = '${player.game.id}'`)).toBe(1);
    const finished = await countRows(
      server.pool,
      'game_events',
      `game_id = '${player.game.id}' and kind = 'constructionFinished'`,
    );
    expect(finished).toBe(1);
  });
});

describe('excluir a conta', () => {
  it('bloqueia na hora por todas as credenciais e some do banco depois de sete dias', async () => {
    const player = await newPlayer(server, 'Senhor Efêmero');
    const control = await newPlayer(server, 'Vizinho');
    await send(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 1 }),
    );
    await send(
      server,
      control.token,
      control.game.id,
      order('setWorkers', { building: 'farm', count: 1 }),
    );
    const code = await call<RecoveryCodeResponse>(server, 'POST', '/auth/recovery-code', {
      token: player.token,
    });

    const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', { token: player.token });
    expect(deleted.status).toBe(202);
    expect(Date.parse(deleted.body.purgeAfter) - Date.parse(deleted.body.deletedAt)).toBe(7 * DAY);

    // Bloqueio imediato: JWT, refresh e Código do Reino.
    const me = await call<Account>(server, 'GET', '/me', { token: player.token });
    expect(me.status).toBe(401);
    const refresh = await call(server, 'POST', '/auth/refresh', {
      body: { refreshToken: player.refreshToken },
    });
    expect(refresh.status).toBe(401);
    const recover = await call(server, 'POST', '/auth/recover', { body: { code: code.body.code } });
    expect(recover.status).toBe(401);
    const view = await call(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
    });
    expect(view.status).toBe(401);

    // Antes do prazo o job não remove nada; no prazo, remove tudo que era da conta.
    const mine = `account_id = '${player.accountId}'`;
    server.clock.advance(7 * DAY - 1000);
    await runJobsOnce(server.ctx);
    expect(await countRows(server.pool, 'accounts', `id = '${player.accountId}'`)).toBe(1);
    expect(await countRows(server.pool, 'games', mine)).toBe(1);

    server.clock.advance(1000);
    await runJobsOnce(server.ctx);
    expect(await countRows(server.pool, 'accounts', `id = '${player.accountId}'`)).toBe(0);
    for (const table of ['sessions', 'games', 'commands']) {
      expect(await countRows(server.pool, table, mine)).toBe(0);
    }
    expect(await countRows(server.pool, 'game_events', `game_id = '${player.game.id}'`)).toBe(0);

    // O vizinho segue governando.
    expect(await countRows(server.pool, 'accounts', `id = '${control.accountId}'`)).toBe(1);
    expect(await countRows(server.pool, 'commands', `account_id = '${control.accountId}'`)).toBe(1);
  });
});
