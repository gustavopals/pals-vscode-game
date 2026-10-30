import { type RankingPreference, type StatsResponse, StatsResponseSchema } from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  DAY,
  MINUTE,
  newPlayer,
  type Player,
  renew,
  rewriteState,
  signUp,
  startGame,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Contrato verificado aqui: ADR 0021 (estatísticas do reino e ranking de ouro).

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await truncateAll(server.pool);
  // O cache de 60 s é da instância: entre um teste e outro o relógio passa dele.
  server.clock.advance(2 * MINUTE);
});

/** Um jogador com o feudo do nome pedido e o ouro gravado em unidades. */
async function fief(name: string, gold: number, displayName = `Conta de ${name}`): Promise<Player> {
  const auth = await signUp(server, displayName);
  const game = await startGame(server, auth.accessToken, { settlementName: name });
  await rewriteState(server, game.id, (state) => {
    state.settlement.resources.gold = gold * 1000 + 999;
  });
  return {
    auth,
    accountId: auth.account.id,
    token: auth.accessToken,
    refreshToken: auth.refreshToken,
    game,
  };
}

async function stats(player: Player) {
  const reply = await call<StatsResponse>(server, 'GET', '/stats', { token: player.token });
  expect(reply.status).toBe(200);
  expect(StatsResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body;
}

async function setListed(player: Player, listed: boolean) {
  const reply = await call<RankingPreference>(server, 'PUT', '/me/ranking', {
    token: player.token,
    body: { listed },
  });
  expect(reply.status).toBe(200);
  expect(reply.body).toEqual({ listed });
}

const names = (body: StatsResponse) => body.ranking.map((entry) => entry.settlementName);

describe('GET /v1/stats', () => {
  it('pede autenticação', async () => {
    expect((await call(server, 'GET', '/stats')).status).toBe(401);
    expect((await call(server, 'GET', '/me/ranking')).status).toBe(401);
    expect((await call(server, 'PUT', '/me/ranking', { body: { listed: false } })).status).toBe(
      401,
    );
  });

  it('ordena pelo ouro gravado, em unidades, e marca o feudo de quem lê', async () => {
    const pobre = await fief('Vau Raso', 10);
    await fief('Pedra Alta', 500);
    await fief('Monte Frio', 120);
    const body = await stats(pobre);
    expect(body.ranking).toEqual([
      { position: 1, settlementName: 'Pedra Alta', gold: 500, mine: false },
      { position: 2, settlementName: 'Monte Frio', gold: 120, mine: false },
      { position: 3, settlementName: 'Vau Raso', gold: 10, mine: true },
    ]);
    expect(body.rankedFiefs).toBe(3);
    expect(body.me.listed).toBe(true);
    expect(body.me.position).toBe(3);
    expect(body.me.fief).toMatchObject({ settlementName: 'Vau Raso', gold: 10, daysReigning: 0 });
    expect(body.kingdom).toMatchObject({ accounts: 3, fiefs: 3, activeLastWeek: 3, gold: 630 });
    expect(body.kingdom.villagers).toBeGreaterThan(0);
  });

  it('não leva nada pessoal: nem nome de conta, nem identificador, nem data de criação', async () => {
    const eu = await fief('Pedra Alta', 50, 'Gustavo Secreto');
    await fief('Monte Frio', 60, 'Maria Reservada');
    const reply = await call(server, 'GET', '/stats', { token: eu.token });
    const text = JSON.stringify(reply.body);
    for (const secret of ['Gustavo Secreto', 'Maria Reservada', eu.accountId, eu.game.id]) {
      expect(text).not.toContain(secret);
    }
    expect(text).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-/);
    expect(reply.headers['cache-control']).toContain('no-store');
  });

  it('quem sai do ranking some dele na hora, com o cache quente, e continua nos totais', async () => {
    const eu = await fief('Vau Raso', 10);
    const rico = await fief('Pedra Alta', 500);
    expect(names(await stats(eu))).toEqual(['Pedra Alta', 'Vau Raso']);

    // O rico sai: a consulta guardada ainda o tem, mas ele não aparece para ninguém.
    await setListed(rico, false);
    const after = await stats(eu);
    expect(names(after)).toEqual(['Vau Raso']);
    expect(after.ranking[0]?.position).toBe(1);
    expect(after.me.position).toBe(1);
    expect(after.rankedFiefs).toBe(1);
    expect(after.kingdom.fiefs).toBe(2);
    expect(after.kingdom.gold).toBe(510);

    // Ele mesmo vê a posição que teria, sem a linha dele no ranking.
    const own = await stats(rico);
    expect(own.me).toMatchObject({ listed: false, position: 1 });
    expect(own.ranking.some((entry) => entry.mine)).toBe(false);
    expect((await call(server, 'GET', '/me/ranking', { token: rico.token })).body).toEqual({
      listed: false,
    });

    // E volta.
    await setListed(rico, true);
    expect(names(await stats(eu))).toEqual(['Pedra Alta', 'Vau Raso']);
  });

  it('recusa um corpo fora da forma', async () => {
    const eu = await fief('Vau Raso', 10);
    const reply = await call(server, 'PUT', '/me/ranking', {
      token: eu.token,
      body: { listed: 'não' },
    });
    expect(reply.status).toBe(400);
  });

  it('a conta excluída some do ranking na hora e dos totais quando o cache se renova', async () => {
    const eu = await fief('Vau Raso', 10);
    const saindo = await fief('Pedra Alta', 500);
    expect(names(await stats(eu))).toContain('Pedra Alta');
    expect((await call(server, 'DELETE', '/me', { token: saindo.token })).status).toBe(202);
    expect(names(await stats(eu))).toEqual(['Vau Raso']);
    server.clock.advance(2 * MINUTE);
    await renew(server, eu);
    const later = await stats(eu);
    expect(later.kingdom).toMatchObject({ accounts: 1, fiefs: 1, gold: 10 });
  });

  it('deixa de fora as partidas arquivadas e as contas de teste ("Bot ")', async () => {
    const eu = await fief('Vau Raso', 10);
    await fief('Feudo 1', 9000, 'Bot 1');
    const outro = await fief('Pedra Antiga', 800);
    // Uma partida nova arquiva a anterior: só a nova conta.
    const nova = await startGame(server, outro.token, {
      settlementName: 'Pedra Nova',
      replaceActive: true,
    });
    await rewriteState(server, nova.id, (state) => {
      state.settlement.resources.gold = 20_000;
    });
    const body = await stats(eu);
    expect(names(body)).toEqual(['Pedra Nova', 'Vau Raso']);
    expect(body.kingdom).toMatchObject({ accounts: 2, fiefs: 2, gold: 30 });
  });

  it('mostra os 10 primeiros e, fora deles, a linha do jogador no fim', async () => {
    for (let index = 0; index < 11; index += 1) {
      await fief(`Feudo Rico ${index + 1}`, 1000 - index);
    }
    const eu = await fief('Vau Raso', 1);
    const body = await stats(eu);
    expect(body.ranking).toHaveLength(11);
    expect(body.ranking[9]).toMatchObject({ position: 10, settlementName: 'Feudo Rico 10' });
    expect(body.ranking[10]).toEqual({
      position: 12,
      settlementName: 'Vau Raso',
      gold: 1,
      mine: true,
    });
    expect(body.rankedFiefs).toBe(12);
    expect(body.me.position).toBe(12);
  });

  it('guarda os totais por um minuto e conta só as contas vistas nos últimos 7 dias', async () => {
    const eu = await fief('Vau Raso', 10);
    const first = await stats(eu);
    await fief('Pedra Alta', 500);
    const cached = await stats(eu);
    expect(cached.generatedAt).toBe(first.generatedAt);
    expect(cached.kingdom.fiefs).toBe(1);
    // A posição do jogador é de agora, contra a consulta guardada.
    expect(cached.me.position).toBe(1);

    server.clock.advance(8 * DAY);
    await renew(server, eu);
    const fresh = await stats(eu);
    expect(fresh.generatedAt).not.toBe(first.generatedAt);
    expect(fresh.kingdom).toMatchObject({ accounts: 2, fiefs: 2, activeLastWeek: 1 });
    expect(fresh.me.fief?.daysReigning).toBe(8);
  });

  it('sem feudo, o jogador vê os totais e o ranking, sem posição', async () => {
    await fief('Pedra Alta', 500);
    const auth = await signUp(server, 'Sem Feudo');
    const reply = await call<StatsResponse>(server, 'GET', '/stats', { token: auth.accessToken });
    expect(reply.status).toBe(200);
    expect(reply.body.me).toEqual({ listed: true, position: null, fief: null });
    expect(names(reply.body)).toEqual(['Pedra Alta']);
  });

  it('não grava nada nas partidas que lê', async () => {
    const eu = await fief('Vau Raso', 10);
    const other = await newPlayer(server, 'Outra');
    const before = await server.pool.query(
      'select id, state_version, last_processed_at from games order by id',
    );
    server.clock.advance(3 * DAY);
    await renew(server, eu);
    await stats(eu);
    const after = await server.pool.query(
      'select id, state_version, last_processed_at from games order by id',
    );
    expect(after.rows).toEqual(before.rows);
    expect(other.game.id).toBeDefined();
  });
});
