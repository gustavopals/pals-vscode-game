import { YearEndedDataSchema } from '@lotg/content';
import {
  type ApiError,
  type JoinSeasonResponse,
  type LeaderboardResponse,
  LeaderboardResponseSchema,
  type SeasonChronicleResponse,
  SeasonChronicleResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { runJobsOnce } from '../src/jobs/scheduler';
import {
  call,
  councilRecess,
  createTestApp,
  fakeClock,
  HOUR,
  quietHorde,
  renew,
  rewriteState,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

const MONDAY = '2026-11-23T03:00:00.000Z';
const SUNDAY_CLOSE = '2026-11-30T02:59:00.000Z';
const UNKNOWN_SEASON = '22222222-2222-4222-8222-222222222222';

describe('Ranking e Crônicas da Temporada (V5G-T2)', () => {
  const clock = fakeClock(MONDAY);
  let server: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    server = await createTestApp({ clock });
  });

  afterAll(async () => {
    await server?.close();
  });

  beforeEach(async () => {
    await truncateAll(server.pool);
    clock.set(MONDAY);
  });

  async function account(displayName: string) {
    const auth = await signUp(server, displayName);
    return { account: auth.account, token: auth.accessToken, refreshToken: auth.refreshToken };
  }

  async function join(token: string, settlementName: string) {
    const reply = await call<JoinSeasonResponse>(server, 'POST', '/seasons/current/join', {
      token,
      body: { settlementName, timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    });
    expect(reply.status).toBe(201);
    await quietHorde(server, reply.body.game.id);
    await councilRecess(server, reply.body.game.id);
    return reply.body;
  }

  it('publica no fecho pelo evento do Ano 1, desempata pela fundação e conserva o sigilo', async () => {
    const first = await account('Conta Reservada Um');
    const second = await account('Conta Reservada Dois');
    const unfinished = await account('Conta Sem Pontos');
    const lower = await account('Conta Menos Pontos');
    await join(lower.token, 'Vigia das Colinas');
    const firstJoin = await join(first.token, 'Vigia do Norte');
    // Mais um Feito em cada partida. O motor registra o Feito e a pontuação no fecho real.
    await rewriteState(server, firstJoin.game.id, (state) => {
      state.stats['chronicle:heroesRescued'] = 1;
    });
    clock.set(new Date(Date.parse(MONDAY) + 1_000).toISOString());
    const secondJoin = await join(second.token, 'Vigia do Sul');
    await rewriteState(server, secondJoin.game.id, (state) => {
      state.stats['chronicle:heroesRescued'] = 1;
    });
    const unfinishedJoin = await join(unfinished.token, 'Feudo Inacabado');
    await server.pool.query("update games set status = 'archived' where id = $1", [
      unfinishedJoin.game.id,
    ]);
    const path = `/leaderboard?season=${firstJoin.season.id}`;

    // O Ano 1 já acabou para os dois. Mesmo no horário previsto do fecho, a publicação espera
    // o job arquivar a última partida e marcar a Temporada como fechada.
    clock.set(new Date(Date.parse(MONDAY) + 60 * HOUR).toISOString());
    await renew(server, first);
    await renew(server, second);
    for (const [player, game] of [
      [first, firstJoin.game],
      [second, secondJoin.game],
    ] as const) {
      expect(
        (
          await call(server, 'GET', `/games/${game.id}/years/1/chronicle.md`, {
            token: player.token,
          })
        ).status,
      ).toBe(200);
    }
    clock.set(SUNDAY_CLOSE);
    await renew(server, first);
    const before = await call<LeaderboardResponse>(server, 'GET', path, { token: first.token });
    expect(before.status).toBe(200);
    expect(LeaderboardResponseSchema.parse(before.body)).toMatchObject({
      season: { seed: null, rankingPublishedAt: null },
      published: false,
      entries: [],
      me: { position: null, listed: true },
    });
    expect(await runJobsOnce(server.ctx)).toMatchObject({
      ran: true,
      closedSeasons: 1,
      archivedSeasonGames: 3,
      failed: 0,
    });

    const { rows } = await server.pool.query<{ data: unknown }>(
      `select payload -> 'data' as data from game_events
       where game_id = $1 and kind = 'yearEnded' and payload -> 'data' ->> 'year' = '1'`,
      [firstJoin.game.id],
    );
    const ended = YearEndedDataSchema.parse(rows[0]?.data);
    expect(ended.feats).toContain('rescue');
    const after = await call<LeaderboardResponse>(server, 'GET', path, { token: first.token });
    expect(after.status).toBe(200);
    expect(after.headers['cache-control']).toBe('private, no-store');
    const board = LeaderboardResponseSchema.parse(after.body);
    expect(board).toMatchObject({
      season: { rankingPublishedAt: SUNDAY_CLOSE, seed: expect.any(String) },
      published: true,
      me: { position: 1, listed: true },
    });
    const result = {
      score: ended.score,
      siegeOutcome: ended.siegeResult,
      siegeOutcomeText: expect.any(String) as string,
      feats: ended.feats.split(',').length,
      chronicleAvailable: true,
    };
    expect(board.entries).toEqual([
      { ...result, position: 1, settlementName: 'Vigia do Norte', mine: true },
      { ...result, position: 2, settlementName: 'Vigia do Sul', mine: false },
      expect.objectContaining({
        position: 3,
        settlementName: 'Vigia das Colinas',
        feats: result.feats - 1,
      }),
    ]);
    expect(board.entries[2]!.score).toBeLessThan(ended.score);
    for (const privateValue of [
      first.account.id,
      first.account.displayName,
      firstJoin.game.id,
      second.account.id,
      second.account.displayName,
      secondJoin.game.id,
    ]) {
      expect(JSON.stringify(after.body)).not.toContain(privateValue);
    }
    await renew(server, unfinished);
    expect(
      (await call<LeaderboardResponse>(server, 'GET', path, { token: unfinished.token })).body.me,
    ).toEqual({ position: null, listed: true });
  });

  it('autoriza só participantes, lê o mesmo Markdown anual e aplica a saída na hora', async () => {
    const owner = await account('Conta da Cronista');
    const member = await account('Conta da Vizinha');
    const outsider = await account('Conta de Fora');
    const { season, game } = await join(owner.token, 'Vigia do Leste');
    const { game: memberGame } = await join(member.token, 'Vigia do Oeste');
    const boardPath = `/leaderboard?season=${season.id}`;
    const chroniclePath = `/seasons/${season.id}/chronicles`;
    expect(
      (await call<ApiError>(server, 'GET', `${chroniclePath}/1`, { token: member.token })).status,
    ).toBe(404);

    clock.set(SUNDAY_CLOSE);
    expect(await runJobsOnce(server.ctx)).toMatchObject({ closedSeasons: 1, failed: 0 });
    await Promise.all([owner, member, outsider].map((player) => renew(server, player)));
    const board = await call<LeaderboardResponse>(server, 'GET', boardPath, { token: owner.token });
    const ownPosition = board.body.me.position;
    expect(ownPosition).toBe(game.id < memberGame.id ? 1 : 2);
    const ownPath = `${chroniclePath}/${ownPosition}`;
    const ownExport = await call<string>(server, 'GET', `/games/${game.id}/years/1/chronicle.md`, {
      token: owner.token,
    });
    const allowed = await call<SeasonChronicleResponse>(server, 'GET', ownPath, {
      token: member.token,
    });
    expect(allowed.status).toBe(200);
    expect(allowed.headers['cache-control']).toBe('private, no-store');
    expect(SeasonChronicleResponseSchema.parse(allowed.body)).toEqual({
      settlementName: 'Vigia do Leste',
      position: ownPosition,
      markdown: ownExport.body,
    });
    expect(allowed.body.markdown).toContain('Crônica do Ano 1');
    expect(allowed.body.markdown).not.toContain('Crônica do Ano 2');
    expect(allowed.body.markdown).not.toContain('<!-- expedition-');

    const outsiderBoard = await call<LeaderboardResponse>(server, 'GET', boardPath, {
      token: outsider.token,
    });
    expect(outsiderBoard.status).toBe(200);
    expect(outsiderBoard.body.entries).toHaveLength(2);
    expect(outsiderBoard.body.entries.every((entry) => !entry.chronicleAvailable)).toBe(true);
    const denied = await call<ApiError>(server, 'GET', ownPath, { token: outsider.token });
    expect(denied).toMatchObject({ status: 403, body: { code: 'FORBIDDEN' } });
    expect(denied.body.message).toMatch(/mesma Temporada/);

    expect(
      (await call(server, 'PUT', '/me/ranking', { token: owner.token, body: { listed: false } }))
        .status,
    ).toBe(200);
    const ownOptOut = await call<LeaderboardResponse>(server, 'GET', boardPath, {
      token: owner.token,
    });
    expect(ownOptOut.body.me).toEqual({ position: ownPosition, listed: false });
    const remaining = board.body.entries.filter((entry) => !entry.mine);
    expect(ownOptOut.body.entries).toEqual(remaining);
    const hidden = await call<ApiError>(server, 'GET', ownPath, { token: member.token });
    expect(hidden).toMatchObject({ status: 404, body: { code: 'NOT_FOUND' } });
    expect(hidden.body.message).toMatch(/Crônica/);

    expect(
      (await call(server, 'PUT', '/me/ranking', { token: owner.token, body: { listed: true } }))
        .status,
    ).toBe(200);
    expect((await call(server, 'GET', ownPath, { token: member.token })).body).toEqual(
      allowed.body,
    );

    expect((await call(server, 'DELETE', '/me', { token: owner.token })).status).toBe(202);
    expect((await call(server, 'GET', ownPath, { token: member.token })).status).toBe(404);
    const afterDelete = await call<LeaderboardResponse>(server, 'GET', boardPath, {
      token: member.token,
    });
    expect(afterDelete.body.entries).toEqual(remaining.map((entry) => ({ ...entry, mine: true })));
  });

  it('valida os parâmetros e exige sessão em ambas as rotas', async () => {
    const player = await account('Conta Autenticada');
    const chroniclePath = `/seasons/${UNKNOWN_SEASON}/chronicles`;
    for (const path of [`/leaderboard?season=${UNKNOWN_SEASON}`, `${chroniclePath}/1`]) {
      expect((await call(server, 'GET', path)).status).toBe(401);
      expect((await call(server, 'GET', path, { token: player.token })).status).toBe(404);
    }
    expect((await call(server, 'GET', '/leaderboard', { token: player.token })).status).toBe(400);
    expect((await call(server, 'GET', `${chroniclePath}/0`, { token: player.token })).status).toBe(
      404,
    );
  });
});
