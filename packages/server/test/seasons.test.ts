import { YearEndedDataSchema } from '@lotg/content';
import {
  type ApiError,
  type CommandAccepted,
  type CreateGameResponse,
  type CurrentSeasonResponse,
  CurrentSeasonResponseSchema,
  type EventsResponse,
  type GameRuleError,
  GameSummarySchema,
  type JoinSeasonResponse,
  JoinSeasonResponseSchema,
  type ListGamesResponse,
  type StatsResponse,
  StatsResponseSchema,
  type ViewResponse,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { PURGE_AFTER_MS } from '../src/auth/service';
import { advanceStaleGames } from '../src/jobs/advanceStaleGames';
import { purgeAccounts } from '../src/jobs/purgeAccounts';
import { runJobsOnce } from '../src/jobs/scheduler';
import { closeExpiredSeasons } from '../src/seasons/service';
import {
  call,
  councilRecess,
  countRows,
  createTestApp,
  fakeClock,
  type FakeClock,
  HOUR,
  newPlayer,
  order,
  quietHorde,
  renew,
  rewriteState,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// Contrato verificado aqui: V5G-T1 (GDD §11.6; ADR 0022, D-25 a D-27).
// Semana de referência em horário fixo de Brasília (UTC−3):
// - segunda 2026-11-23 00:00 BRT = 2026-11-23T03:00:00.000Z (`2026-W48`)
// - fim de terça (quarta 00:00 BRT) = 2026-11-25T03:00:00.000Z
// - fecho / ranking (domingo 23:59 BRT) = 2026-11-30T02:59:00.000Z
// - próxima semana (segunda 00:00 BRT) = 2026-11-30T03:00:00.000Z (`2026-W49`)
const MONDAY_OPEN = '2026-11-23T03:00:00.000Z';
const TUESDAY_LAST_SECOND = '2026-11-25T02:59:59.000Z';
const WEDNESDAY_START = '2026-11-25T03:00:00.000Z';
const SUNDAY_BEFORE_CLOSE = '2026-11-30T02:58:00.000Z';
const SUNDAY_CLOSE = '2026-11-30T02:59:00.000Z';
const NEXT_MONDAY_OPEN = '2026-11-30T03:00:00.000Z';

async function rawSeasonSeed(server: TestApp, seasonId: string): Promise<string> {
  const { rows } = await server.pool.query<{ seed: string }>(
    'select seed from seasons where id = $1',
    [seasonId],
  );
  const seed = rows[0]?.seed;
  if (seed === undefined) {
    throw new Error(`Temporada ${seasonId} não encontrada no banco.`);
  }
  return seed;
}

async function joinSeason(
  target: TestApp,
  token: string,
  settlementName = 'Vigia do Sul',
  overrides: Record<string, unknown> = {},
) {
  return call<JoinSeasonResponse & ApiError>(target, 'POST', '/seasons/current/join', {
    token,
    body: {
      settlementName,
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      ...overrides,
    },
  });
}

describe('Temporadas no servidor (V5G-T1)', () => {
  let clock: FakeClock;
  let server: TestApp;
  let replica: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    clock = fakeClock(MONDAY_OPEN);
    server = await createTestApp({ clock });
    replica = await createTestApp({ clock });
  });

  afterAll(async () => {
    await server.close();
    await replica.close();
  });

  beforeEach(async () => {
    await truncateAll(server.pool);
    clock.set(MONDAY_OPEN);
  });

  it('exige autenticação nas rotas da Temporada', async () => {
    expect((await call(server, 'GET', '/seasons/current')).status).toBe(401);
    expect(
      (
        await call(server, 'POST', '/seasons/current/join', {
          body: { settlementName: 'Vigia', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
        })
      ).status,
    ).toBe(401);
  });

  it('abre a Temporada da semana uma única vez sob chamadas simultâneas entre réplicas', async () => {
    const accounts = await Promise.all([
      signUp(server, 'Jogador 1'),
      signUp(server, 'Jogador 2'),
      signUp(server, 'Jogador 3'),
      signUp(server, 'Jogador 4'),
      signUp(server, 'Jogador 5'),
      signUp(server, 'Jogador 6'),
    ]);

    const replies = await Promise.all(
      accounts.map((auth, index) =>
        call<CurrentSeasonResponse>(index % 2 === 0 ? server : replica, 'GET', '/seasons/current', {
          token: auth.accessToken,
        }),
      ),
    );

    expect(await countRows(server.pool, 'seasons')).toBe(1);
    const ids = new Set<string>();
    for (const reply of replies) {
      expect(reply.status).toBe(200);
      expect(reply.headers['cache-control']).toContain('no-store');
      expect(CurrentSeasonResponseSchema.safeParse(reply.body).error).toBeUndefined();
      ids.add(reply.body.season.id);
      expect(reply.body.season).toMatchObject({
        code: '2026-W48',
        status: 'open',
        timezone: 'America/Sao_Paulo',
        difficulty: 'lord',
        timeScale: 3,
        startsAt: MONDAY_OPEN,
        joinEndsAt: WEDNESDAY_START,
        endsAt: SUNDAY_CLOSE,
        rankingPublishedAt: null,
        joinOpen: true,
        seed: null,
      });
      expect(reply.body.joined).toBe(false);
      expect(reply.body.game).toBeNull();
    }
    expect(ids.size).toBe(1);
  });

  it('aceita entrada até o fim de terça-feira em Brasília e recusa a partir de quarta 00:00 BRT', async () => {
    clock.set(TUESDAY_LAST_SECOND);
    const tuesdayPlayer = await signUp(server, 'Terça');
    const accepted = await joinSeason(server, tuesdayPlayer.accessToken, 'Passo da Terça');
    expect(accepted.status).toBe(201);
    expect(JoinSeasonResponseSchema.safeParse(accepted.body).error).toBeUndefined();
    expect(accepted.body.game).toMatchObject({
      status: 'active',
      settlementName: 'Passo da Terça',
      difficulty: 'lord',
      timeScale: 3,
      seasonId: accepted.body.season.id,
    });

    // Uma entrada por conta e Temporada: com a partida já arquivada, a recusa é outra.
    await server.pool.query(`update games set status = 'archived' where id = $1`, [
      accepted.body.game.id,
    ]);
    const again = await joinSeason(server, tuesdayPlayer.accessToken, 'Passo de Novo');
    expect(again.status).toBe(409);
    expect(again.body.code).toBe('CONFLICT');
    expect(again.body.message).toContain('já participou');

    // Exatamente quarta-feira 00:00:00 BRT: prazo de entrada encerrado.
    clock.set(WEDNESDAY_START);
    const wednesdayPlayer = await signUp(server, 'Quarta');
    const current = await call<CurrentSeasonResponse>(server, 'GET', '/seasons/current', {
      token: wednesdayPlayer.accessToken,
    });
    expect(current.status).toBe(200);
    expect(current.body.season.joinOpen).toBe(false);
    expect(current.body.season.status).toBe('open');
    expect(current.body.joined).toBe(false);

    const refused = await joinSeason(server, wednesdayPlayer.accessToken, 'Passo Tardio');
    expect(refused.status).toBe(409);
    expect(refused.body.code).toBe('CONFLICT');
    expect(refused.body.message).toContain('terça-feira');
    expect(refused.body.details).toMatchObject({
      reason: 'SEASON_JOIN_CLOSED',
      joinEndsAt: WEDNESDAY_START,
    });
    expect(
      await countRows(server.pool, 'games', `account_id = '${wednesdayPlayer.account.id}'`),
    ).toBe(0);
  });

  it('cria a partida da Temporada com semente, ritmo 3×, Senhor e cenário padrão iguais para todos', async () => {
    const first = await signUp(server, 'Ana');
    const second = await signUp(server, 'Bruno');

    // Recusa tentativa de escolher semente, dificuldade, ritmo ou cenário.
    for (const extra of [
      { seed: 'minha-semente' },
      { difficulty: 'peasant' },
      { timeScale: 1 },
      { scenario: 'ironRidge' },
      { replaceActive: true },
    ]) {
      const bad = await joinSeason(server, first.accessToken, 'Tentativa', extra);
      expect(bad.status, JSON.stringify(extra)).toBe(400);
    }

    const a = await joinSeason(server, first.accessToken, 'Feudo de Ana');
    const b = await joinSeason(server, second.accessToken, 'Feudo de Bruno');
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    expect(a.body.season.id).toBe(b.body.season.id);

    const seed = await rawSeasonSeed(server, a.body.season.id);
    const rows = await server.pool.query<{
      id: string;
      seed: string;
      difficulty: string;
      time_scale: string;
      scenario: string;
      season_id: string;
    }>(
      `select id, seed, difficulty, time_scale, state -> 'map' ->> 'scenario' as scenario, season_id
       from games where id = any($1::uuid[])`,
      [[a.body.game.id, b.body.game.id]],
    );
    expect(rows.rows).toHaveLength(2);
    for (const row of rows.rows) {
      expect(row.seed).toBe(seed);
      expect(row.difficulty).toBe('lord');
      expect(Number(row.time_scale)).toBe(3);
      expect(row.scenario).toBe('standard');
      expect(row.season_id).toBe(a.body.season.id);
    }

    // As duas partidas geram a mesma grade de mapa a partir da mesma semente (o hexágono central
    // leva o nome de cada feudo; o terreno, a névoa e os sítios são os mesmos).
    const [viewA, viewB] = await Promise.all([
      call<ViewResponse>(server, 'GET', `/games/${a.body.game.id}/view`, {
        token: first.accessToken,
      }),
      call<ViewResponse>(server, 'GET', `/games/${b.body.game.id}/view`, {
        token: second.accessToken,
      }),
    ]);
    expect(viewA.status).toBe(200);
    expect(viewB.status).toBe(200);
    const grid = (view: ViewResponse, settlement: string) =>
      JSON.stringify(view.view.map?.hexes ?? null).replaceAll(settlement, '{feudo}');
    expect(viewA.body.view.map?.hexes.length).toBeGreaterThan(1);
    expect(grid(viewA.body, 'Feudo de Ana')).toBe(grid(viewB.body, 'Feudo de Bruno'));
  });

  it('pessoal e Temporada convivem ativas, com ACTIVE_GAME_EXISTS em cada trilho e replaceActive só na pessoal', async () => {
    const player = await newPlayer(server, 'Senhora Dupla');
    expect(player.game.seasonId).toBeNull();

    // Entra na Temporada mantendo a pessoal ativa.
    const joined = await joinSeason(server, player.token, 'Bastião da Semana');
    expect(joined.status).toBe(201);
    const seasonGame = joined.body.game;
    expect(seasonGame.seasonId).toBe(joined.body.season.id);

    // GET /seasons/current agora devolve joined: true e o resumo da partida.
    const current = await call<CurrentSeasonResponse>(server, 'GET', '/seasons/current', {
      token: player.token,
    });
    expect(current.status).toBe(200);
    expect(current.body.joined).toBe(true);
    expect(current.body.game).toEqual(seasonGame);

    // GET /games lista as duas partidas ativas, distinguíveis por seasonId.
    const listed = await call<ListGamesResponse>(server, 'GET', '/games', { token: player.token });
    expect(listed.status).toBe(200);
    expect(listed.body.games).toHaveLength(2);
    for (const summary of listed.body.games) {
      expect(GameSummarySchema.safeParse(summary).error).toBeUndefined();
    }
    expect(listed.body.games.filter((g) => g.status === 'active')).toHaveLength(2);
    expect(listed.body.games.find((g) => g.id === player.game.id)?.seasonId).toBeNull();
    expect(listed.body.games.find((g) => g.id === seasonGame.id)?.seasonId).toBe(
      joined.body.season.id,
    );

    // ACTIVE_GAME_EXISTS no trilho da Temporada.
    const secondJoin = await joinSeason(server, player.token, 'Tentativa 2');
    expect(secondJoin.status).toBe(409);
    expect(secondJoin.body.code).toBe('ACTIVE_GAME_EXISTS');

    // ACTIVE_GAME_EXISTS no trilho pessoal.
    const secondPersonal = await call<ApiError>(server, 'POST', '/games', {
      token: player.token,
      body: { settlementName: 'Outro Feudo', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    });
    expect(secondPersonal.status).toBe(409);
    expect(secondPersonal.body.code).toBe('ACTIVE_GAME_EXISTS');

    // replaceActive em POST /games arquiva APENAS a partida pessoal; a da Temporada segue ativa.
    const replaced = await call<CreateGameResponse>(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Nova Pedra Alta',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        replaceActive: true,
      },
    });
    expect(replaced.status).toBe(201);
    expect(replaced.body.game.seasonId).toBeNull();

    const afterReplace = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: player.token,
    });
    const byId = new Map(afterReplace.body.games.map((g) => [g.id, g]));
    expect(byId.get(player.game.id)?.status).toBe('archived');
    expect(byId.get(replaced.body.game.id)?.status).toBe('active');
    expect(byId.get(seasonGame.id)?.status).toBe('active');

    // Quem entrou só na Temporada ainda cria a primeira partida pessoal sem replaceActive.
    const seasonOnly = await signUp(server, 'Só Temporada');
    const firstSeason = await joinSeason(server, seasonOnly.accessToken, 'Forte Semanal');
    expect(firstSeason.status).toBe(201);
    const firstPersonal = await call<CreateGameResponse>(server, 'POST', '/games', {
      token: seasonOnly.accessToken,
      body: { settlementName: 'Feudo Pessoal', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    });
    expect(firstPersonal.status).toBe(201);
    expect(firstPersonal.body.game.seasonId).toBeNull();
  });

  it('esconde a semente da Temporada em /seasons/current, /join, /view e /commands (200, 422 e recibo) até o fecho (D-27)', async () => {
    const player = await newPlayer(server, 'Vigia');
    const joined = await joinSeason(server, player.token, 'Forte Oculto');
    expect(joined.status).toBe(201);
    const seasonId = joined.body.season.id;
    const seasonGameId = joined.body.game.id;
    const realSeed = await rawSeasonSeed(server, seasonId);

    // 1. /seasons/current e /join nunca vazam a semente enquanto aberta.
    expect(joined.body.season.seed).toBeNull();
    expect(JSON.stringify(joined.body)).not.toContain(realSeed);
    const current = await call<CurrentSeasonResponse>(server, 'GET', '/seasons/current', {
      token: player.token,
    });
    expect(current.body.season.seed).toBeNull();
    expect(JSON.stringify(current.body)).not.toContain(realSeed);

    // 2. /view da partida pessoal continua trazendo `seed`; /view da Temporada a omite.
    const personalView = await call<ViewResponse>(server, 'GET', `/games/${player.game.id}/view`, {
      token: player.token,
    });
    expect(personalView.status).toBe(200);
    expect(personalView.body.view.seed).toBe('pedra-alta-teste');

    const seasonView = await call<ViewResponse>(server, 'GET', `/games/${seasonGameId}/view`, {
      token: player.token,
    });
    expect(seasonView.status).toBe(200);
    expect(ViewResponseSchema.safeParse(seasonView.body).error).toBeUndefined();
    expect(seasonView.body.view.seed).toBeUndefined();
    expect('seed' in seasonView.body.view).toBe(false);
    expect(JSON.stringify(seasonView.body)).not.toContain(realSeed);

    // 3. POST /commands aceito (200) e recusado (422 GAME_RULE) omitem `seed` e não a gravam no recibo.
    const okCmd = order('setWorkers', { building: 'farm', count: 2 });
    const accepted = await send<CommandAccepted>(server, player.token, seasonGameId, okCmd);
    expect(accepted.status).toBe(200);
    expect(accepted.body.view.seed).toBeUndefined();
    expect(JSON.stringify(accepted.body)).not.toContain(realSeed);

    const badCmd = order('startConstruction', { building: 'townHall' });
    const rejected = await send<GameRuleError>(server, player.token, seasonGameId, badCmd);
    expect(rejected.status).toBe(422);
    expect(rejected.body.details.view.seed).toBeUndefined();
    expect(JSON.stringify(rejected.body)).not.toContain(realSeed);

    const receipts = await server.pool.query<{ body: unknown }>(
      'select response_body as body from commands where game_id = $1',
      [seasonGameId],
    );
    expect(receipts.rows).toHaveLength(2);
    expect(JSON.stringify(receipts.rows)).not.toContain(realSeed);

    // 4. Depois do fecho no domingo 23:59 BRT pelo job, a semente é revelada em /seasons/current.
    clock.set(SUNDAY_CLOSE);
    const closed = await runJobsOnce(server.ctx);
    expect(closed).toMatchObject({ ran: true, closedSeasons: 1, archivedSeasonGames: 1 });
    await renew(server, player);

    const afterClose = await call<CurrentSeasonResponse>(server, 'GET', '/seasons/current', {
      token: player.token,
    });
    expect(afterClose.status).toBe(200);
    expect(afterClose.body.season.status).toBe('closed');
    expect(afterClose.body.season.rankingPublishedAt).toBe(SUNDAY_CLOSE);
    expect(afterClose.body.season.seed).toBe(realSeed);
    expect(afterClose.body.game?.status).toBe('archived');
  });

  it('arquiva a partida da Temporada ao fechar no domingo 23:59 BRT (avançando até o fecho e preservando a pessoal)', async () => {
    const player = await newPlayer(server, 'Cronista');
    const joined = await joinSeason(server, player.token, 'Vigia do Norte');
    expect(joined.status).toBe(201);
    const seasonGameId = joined.body.game.id;
    await quietHorde(server, seasonGameId);
    await councilRecess(server, seasonGameId);
    const savedCmd = order('setWorkers', { building: 'farm', count: 1 });
    expect((await send(server, player.token, seasonGameId, savedCmd)).status).toBe(200);

    // Um minuto antes do fecho: o job avança partidas paradas, mas NÃO fecha a Temporada.
    clock.set(SUNDAY_BEFORE_CLOSE);
    const beforeClose = await runJobsOnce(server.ctx);
    expect(beforeClose).toMatchObject({
      ran: true,
      closedSeasons: 0,
      archivedSeasonGames: 0,
      failed: 0,
    });

    // No instante do fecho (domingo 23:59 BRT), mesmo antes do job rodar, /view e novos comandos
    // já recusam com 409 CONFLICT (e reenvio do recibo anterior continua funcionando).
    clock.set(SUNDAY_CLOSE);
    await renew(server, player);
    const blockedView = await call<ApiError>(server, 'GET', `/games/${seasonGameId}/view`, {
      token: player.token,
    });
    expect(blockedView.status).toBe(409);
    expect(blockedView.body.code).toBe('CONFLICT');

    const blockedCmd = await send<ApiError>(
      server,
      player.token,
      seasonGameId,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(blockedCmd.status).toBe(409);
    expect(blockedCmd.body.code).toBe('CONFLICT');

    const replayed = await send<CommandAccepted>(server, player.token, seasonGameId, savedCmd);
    expect(replayed.status).toBe(200);
    expect(replayed.headers['x-lords-replayed']).toBe('true');

    // O job fecha a Temporada, arquiva a partida sazonal (com Year 1 encerrado e Legado creditado)
    // e mantém a partida pessoal ativa.
    const closed = await runJobsOnce(server.ctx);
    expect(closed).toMatchObject({
      ran: true,
      closedSeasons: 1,
      archivedSeasonGames: 1,
      failed: 0,
    });
    // Rodar de novo é idempotente.
    expect(await closeExpiredSeasons(server.ctx)).toMatchObject({
      closedSeasons: 0,
      archivedGames: 0,
      failed: 0,
    });

    const statuses = await server.pool.query<{ id: string; status: string }>(
      'select id, status from games where account_id = $1',
      [player.accountId],
    );
    const statusById = new Map(statuses.rows.map((r) => [r.id, r.status]));
    expect(statusById.get(player.game.id)).toBe('active');
    expect(statusById.get(seasonGameId)).toBe('archived');

    // Eventos, Crônica e Crônica do Ano 1 continuam legíveis após o arquivamento; Legado creditado.
    const events = await call<EventsResponse>(
      server,
      'GET',
      `/games/${seasonGameId}/events?limit=500`,
      { token: player.token },
    );
    expect(events.status).toBe(200);
    const yearEnded = events.body.events.find((e) => e.type === 'yearEnded');
    expect(yearEnded).toBeDefined();
    const endedData = YearEndedDataSchema.parse(yearEnded?.data);
    expect(endedData.year).toBe(1);

    const chronicle = await call<string>(
      server,
      'GET',
      `/games/${seasonGameId}/years/1/chronicle.md`,
      { token: player.token },
    );
    expect(chronicle.status).toBe(200);
    expect(chronicle.body).toContain('Vigia do Norte');

    const ledger = await server.pool.query<{ game_id: string; year: number; points: number }>(
      'select game_id, year, points from legacy_ledger where game_id = $1 and year = 1',
      [seasonGameId],
    );
    expect(ledger.rows).toEqual([
      { game_id: seasonGameId, year: 1, points: endedData.legacy ?? endedData.score },
    ]);
  });

  it('abre nova Temporada na segunda seguinte e permite entrar mesmo se o job ainda não fechou a anterior', async () => {
    const player = await signUp(server, 'Veterano');
    const week1 = await joinSeason(server, player.accessToken, 'Forte W48');
    expect(week1.status).toBe(201);
    await quietHorde(server, week1.body.game.id);
    await councilRecess(server, week1.body.game.id);

    // Pula direto para segunda 00:00 BRT da semana seguinte SEM rodar o job de fecho antes.
    clock.set(NEXT_MONDAY_OPEN);
    const tokens = { token: player.accessToken, refreshToken: player.refreshToken };
    await renew(server, tokens);

    const week2Current = await call<CurrentSeasonResponse>(server, 'GET', '/seasons/current', {
      token: tokens.token,
    });
    expect(week2Current.status).toBe(200);
    expect(week2Current.body.season.code).toBe('2026-W49');
    expect(week2Current.body.season.id).not.toBe(week1.body.season.id);
    expect(week2Current.body.joined).toBe(false);

    const week2Join = await joinSeason(server, tokens.token, 'Forte W49');
    expect(week2Join.status).toBe(201);
    expect(week2Join.body.game.seasonId).toBe(week2Current.body.season.id);

    // A partida da W48 foi arquivada automaticamente ao entrar na W49: só há uma ativa de Temporada.
    const { rows } = await server.pool.query<{ id: string; status: string }>(
      'select id, status from games where account_id = $1',
      [player.account.id],
    );
    const byId = new Map(rows.map((r) => [r.id, r.status]));
    expect(byId.get(week1.body.game.id)).toBe('archived');
    expect(byId.get(week2Join.body.game.id)).toBe('active');
    expect(await countRows(server.pool, 'seasons')).toBe(2);

    // Ao rodar o job agora, W48 (sem partidas ativas restantes) fecha; W49 continua aberta.
    const closed = await closeExpiredSeasons(server.ctx);
    expect(closed).toMatchObject({ closedSeasons: 1, archivedGames: 0, failed: 0 });
  });

  it('exclusão de conta arquiva pessoal e Temporada na hora, recusa entrada e expurga as duas sem apagar seasons', async () => {
    const player = await newPlayer(server, 'Partindo');
    const joined = await joinSeason(server, player.token, 'Forte Efêmero');
    expect(joined.status).toBe(201);
    const seasonId = joined.body.season.id;
    const seasonGameId = joined.body.game.id;

    // DELETE /me arquiva as duas partidas ativas imediatamente.
    const deleted = await call(server, 'DELETE', '/me', { token: player.token });
    expect(deleted.status).toBe(202);
    expect(
      await countRows(
        server.pool,
        'games',
        `account_id = '${player.accountId}' and status = 'archived'`,
      ),
    ).toBe(2);

    // Conta excluída é recusada em GET e POST /seasons/current(/join).
    const afterGet = await call<ApiError>(server, 'GET', '/seasons/current', {
      token: player.token,
    });
    expect(afterGet.status).toBe(401);
    expect(afterGet.body.code).toBe('SESSION_REVOKED');
    const afterJoin = await joinSeason(server, player.token, 'Não Entra');
    expect(afterJoin.status).toBe(401);
    expect(afterJoin.body.code).toBe('SESSION_REVOKED');

    // Após 7 dias, o expurgo apaga a conta e as duas partidas, mantendo a Temporada em `seasons`.
    clock.advance(PURGE_AFTER_MS);
    expect(await purgeAccounts(server.ctx)).toMatchObject({ accounts: 1 });
    expect(
      await countRows(server.pool, 'games', `id in ('${player.game.id}', '${seasonGameId}')`),
    ).toBe(0);
    expect(await countRows(server.pool, 'seasons', `id = '${seasonId}'`)).toBe(1);
  });

  it('stats do Reino contam apenas partidas pessoais (totais, ranking e me.fief); Legado soma todas', async () => {
    const dual = await newPlayer(server, 'Duplo');
    await rewriteState(server, dual.game.id, (state) => {
      state.settlement.resources.gold = 100 * 1000;
    });
    const dualSeason = await joinSeason(server, dual.token, 'Temporada Rica');
    expect(dualSeason.status).toBe(201);
    await rewriteState(server, dualSeason.body.game.id, (state) => {
      state.settlement.resources.gold = 999_000 * 1000;
    });

    const seasonOnlyAuth = await signUp(server, 'Apenas Temporada');
    const onlySeason = await joinSeason(server, seasonOnlyAuth.accessToken, 'Só Semanal');
    expect(onlySeason.status).toBe(201);
    await quietHorde(server, onlySeason.body.game.id);
    await councilRecess(server, onlySeason.body.game.id);
    await rewriteState(server, onlySeason.body.game.id, (state) => {
      state.settlement.resources.gold = 888_000 * 1000;
    });

    // O ranking de ouro e os totais do Reino ignoram as duas partidas da Temporada.
    const dualStats = await call<StatsResponse>(server, 'GET', '/stats', { token: dual.token });
    expect(dualStats.status).toBe(200);
    expect(StatsResponseSchema.safeParse(dualStats.body).error).toBeUndefined();
    expect(dualStats.body.kingdom).toMatchObject({ accounts: 2, fiefs: 1, gold: 100 });
    expect(dualStats.body.rankedFiefs).toBe(1);
    expect(dualStats.body.ranking).toEqual([
      { position: 1, settlementName: 'Pedra Alta', gold: 100, mine: true },
    ]);
    expect(dualStats.body.me.position).toBe(1);
    expect(dualStats.body.me.fief?.settlementName).toBe('Pedra Alta');
    expect(dualStats.body.me.fief?.gold).toBe(100);

    // Quem só tem partida da Temporada não aparece no ranking nem em me.fief.
    const onlyStats = await call<StatsResponse>(server, 'GET', '/stats', {
      token: seasonOnlyAuth.accessToken,
    });
    expect(onlyStats.status).toBe(200);
    expect(onlyStats.body.me).toMatchObject({
      listed: true,
      position: null,
      fief: null,
      legacy: 0,
    });
    expect(onlyStats.body.ranking.map((r) => r.settlementName)).toEqual(['Pedra Alta']);

    // Quando o Ano 1 da Temporada fecha (56 h reais a 3×), o Legado vai para a conta em me.legacy.
    clock.advance(60 * HOUR);
    await advanceStaleGames(server.ctx);
    const seasonOnlyTokens = {
      token: seasonOnlyAuth.accessToken,
      refreshToken: seasonOnlyAuth.refreshToken,
    };
    await renew(server, seasonOnlyTokens);
    const afterYear = await call<StatsResponse>(server, 'GET', '/stats', {
      token: seasonOnlyTokens.token,
    });
    expect(afterYear.status).toBe(200);
    expect(afterYear.body.me.fief).toBeNull();
    expect(afterYear.body.me.legacy).toBeGreaterThan(0);
  });

  it('valida o cabeçalho de protocolo e garante que uma conta excluída concorrentemente não entra', async () => {
    const auth = await signUp(server, 'Concorrente');
    // DELETE /me e POST /seasons/current/join ao mesmo tempo não travam (lock FOR NO KEY UPDATE).
    const [del, join] = await Promise.all([
      call(server, 'DELETE', '/me', { token: auth.accessToken }),
      joinSeason(server, auth.accessToken, 'Corrida'),
    ]);
    expect(del.status).toBe(202);
    // Ou a entrada ganhou antes e já foi arquivada pelo DELETE, ou perdeu e recebeu 401 SESSION_REVOKED.
    expect([201, 401]).toContain(join.status);
    if (join.status === 401) {
      expect(join.body.code).toBe('SESSION_REVOKED');
    } else {
      expect(
        await countRows(
          server.pool,
          'games',
          `account_id = '${auth.account.id}' and status = 'active'`,
        ),
      ).toBe(0);
    }
  });
});
