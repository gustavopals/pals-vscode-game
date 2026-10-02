import type {
  ApiError,
  AuthResponse,
  CommandAccepted,
  DeleteMeResponse,
  ListGamesResponse,
  RecoveryCodeResponse,
  TokenPair,
} from '@lotg/protocol';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  call,
  createTestApp,
  fakeClock,
  type FakeClock,
  MINUTE,
  newPlayer,
  order,
  type Player,
  renew,
  type Reply,
  send,
  type TestApp,
} from './helpers/app';
import { resetTestDb, truncateAll } from './helpers/db';

// O que uma restauração de backup faz com quem jogou depois dele: é o que deploy/README.md
// promete em "Backup e restauração" e em "Reverter depois de uma migração de estado". O refresh
// token gira a cada renovação (ADR 0005) e o banco só guarda o hash dos que ele mesmo emitiu;
// o banco restaurado nunca viu os tokens emitidos depois do backup.
//
// O backup e a restauração são simulados com cópias das tabelas dentro do banco de teste, na
// ordem das chaves estrangeiras. O resultado é o de um `pg_restore --clean`: o banco volta a
// ser, linha por linha, o do instante do backup.

const TABLES = [
  'accounts',
  'sessions',
  'refresh_tokens',
  'games',
  'commands',
  'game_events',
  'chronicles',
];

async function backup(app: TestApp): Promise<void> {
  for (const table of TABLES) {
    await app.pool.query(`drop table if exists backup_${table}`);
    await app.pool.query(`create table backup_${table} as table ${table}`);
  }
}

async function restore(app: TestApp): Promise<void> {
  await truncateAll(app.pool);
  for (const table of TABLES) {
    await app.pool.query(`insert into ${table} select * from backup_${table}`);
  }
}

const refresh = (app: TestApp, refreshToken: string) =>
  call<TokenPair & ApiError>(app, 'POST', '/auth/refresh', { body: { refreshToken } });

const recover = (app: TestApp, code: string): Promise<Reply<AuthResponse & ApiError>> =>
  call<AuthResponse & ApiError>(app, 'POST', '/auth/recover', {
    body: { code, deviceLabel: 'máquina nova' },
  });

async function issueCode(app: TestApp, token: string): Promise<string> {
  const reply = await call<RecoveryCodeResponse>(app, 'POST', '/auth/recovery-code', { token });
  expect(reply.status).toBe(200);
  return reply.body.code;
}

async function settlementName(app: TestApp, gameId: string): Promise<string | undefined> {
  const { rows } = await app.pool.query<{ name: string }>(
    `select state -> 'settlement' ->> 'name' as name from games where id = $1`,
    [gameId],
  );
  return rows[0]?.name;
}

/** A jogadora volta depois do backup: o app renova a sessão e ela dá uma ordem. */
async function playAfterBackup(app: TestApp, clock: FakeClock, player: Player): Promise<void> {
  clock.advance(20 * MINUTE);
  await renew(app, player);
  const renamed = await send<CommandAccepted>(
    app,
    player.token,
    player.game.id,
    order('renameSettlement', { name: 'Vau do Corvo' }),
  );
  expect(renamed.status).toBe(200);
}

describe('restauração de um backup', () => {
  let clock: FakeClock;
  let server: TestApp;

  beforeAll(async () => {
    await resetTestDb();
    clock = fakeClock();
    server = await createTestApp({ clock });
  });
  afterAll(async () => {
    await server.close();
  });
  beforeEach(async () => {
    await truncateAll(server.pool);
  });

  it('quem jogou depois do backup perde a sessão, e não só as ordens', async () => {
    const player = await newPlayer(server, 'Dona Beatriz');
    const beforeBackup = player.refreshToken;
    await backup(server);
    await playAfterBackup(server, clock, player);
    expect(player.refreshToken).not.toBe(beforeBackup);
    expect(await settlementName(server, player.game.id)).toBe('Vau do Corvo');

    await restore(server);

    // A ordem dada depois do backup se perdeu: é a perda que o README já dizia.
    expect(await settlementName(server, player.game.id)).toBe('Pedra Alta');
    // O access token ainda vale pelos minutos que lhe restam: a sessão existe no banco.
    const me = await call(server, 'GET', '/me', { token: player.token });
    expect(me.status).toBe(200);

    // Mas o refresh token que o navegador guarda é um sucessor que o banco restaurado nunca
    // viu. Na primeira renovação a resposta é 401, e o app apaga tokens, conta e cache.
    clock.advance(16 * MINUTE);
    expect((await call(server, 'GET', '/me', { token: player.token })).status).toBe(401);
    const renewed = await refresh(server, player.refreshToken);
    expect(renewed.status).toBe(401);
    expect(renewed.body.code).toBe('UNAUTHORIZED');

    // A conta e a partida continuam no banco, com a sessão intacta e sem ninguém que a use.
    const { rows } = await server.pool.query<{ accounts: string; games: string; live: string }>(
      `select (select count(*) from accounts where id = $1 and deleted_at is null) as accounts,
              (select count(*) from games where account_id = $1 and status = 'active') as games,
              (select count(*) from sessions where account_id = $1 and revoked_at is null) as live`,
      [player.accountId],
    );
    expect(rows[0]).toEqual({ accounts: '1', games: '1', live: '1' });
  });

  it('o Código do Reino gerado antes do backup é o caminho de volta', async () => {
    const player = await newPlayer(server, 'Dona Beatriz');
    const code = await issueCode(server, player.token);
    await backup(server);
    await playAfterBackup(server, clock, player);

    await restore(server);
    clock.advance(16 * MINUTE);
    expect((await refresh(server, player.refreshToken)).status).toBe(401);

    const recovered = await recover(server, code);
    expect(recovered.status).toBe(200);
    expect(recovered.body.account.id).toBe(player.accountId);
    const games = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: recovered.body.accessToken,
    });
    expect(games.body.games.map((game) => [game.id, game.status, game.settlementName])).toEqual([
      [player.game.id, 'active', 'Pedra Alta'],
    ]);
  });

  it('o Código do Reino gerado depois do backup some com a restauração: o feudo fica sem dono', async () => {
    const player = await newPlayer(server, 'Dona Beatriz');
    await backup(server);
    await playAfterBackup(server, clock, player);
    const code = await issueCode(server, player.token);

    await restore(server);
    clock.advance(16 * MINUTE);

    expect((await refresh(server, player.refreshToken)).status).toBe(401);
    const recovered = await recover(server, code);
    expect(recovered.status).toBe(401);
    expect(recovered.body.code).toBe('UNAUTHORIZED');
  });

  it('quem não abriu o jogo desde o backup continua dentro', async () => {
    const player = await newPlayer(server, 'Seu Anselmo');
    await backup(server);
    clock.advance(3 * 60 * MINUTE);

    await restore(server);

    const renewed = await refresh(server, player.refreshToken);
    expect(renewed.status).toBe(200);
    const games = await call<ListGamesResponse>(server, 'GET', '/games', {
      token: renewed.body.accessToken,
    });
    expect(games.body.games.map((game) => game.id)).toEqual([player.game.id]);
  });

  it('conta criada depois do backup deixa de existir', async () => {
    await backup(server);
    const late = await newPlayer(server, 'Recém-chegado');

    await restore(server);

    expect((await call(server, 'GET', '/me', { token: late.token })).status).toBe(401);
    expect((await refresh(server, late.refreshToken)).status).toBe(401);
  });

  it('conta excluída depois do backup volta a existir, com a sessão viva: a exclusão tem de ser refeita', async () => {
    const player = await newPlayer(server, 'Quem Pediu Para Sair');
    const code = await issueCode(server, player.token);
    await backup(server);
    const deleted = await call<DeleteMeResponse>(server, 'DELETE', '/me', { token: player.token });
    expect(deleted.status).toBe(202);
    expect((await refresh(server, player.refreshToken)).status).toBe(401);

    await restore(server);

    // O banco restaurado não sabe da exclusão: a credencial antiga e o código voltam a valer.
    expect((await refresh(server, player.refreshToken)).status).toBe(200);
    expect((await recover(server, code)).status).toBe(200);
    const { rows } = await server.pool.query<{ deleted_at: Date | null }>(
      'select deleted_at from accounts where id = $1',
      [player.accountId],
    );
    expect(rows[0]?.deleted_at).toBeNull();
  });

  it('reimportar as sessões do banco de antes da restauração devolve o acesso a quem jogou', async () => {
    // Não é o procedimento em vigor: é a prova de que ele é possível (deploy/README.md o
    // descreve como decisão pendente do autor). As sessões de contas que o backup não tem
    // ficam de fora; as demais voltam como estavam, inclusive as revogadas.
    const player = await newPlayer(server, 'Dona Beatriz');
    const quit = await newPlayer(server, 'Saiu Desta Máquina');
    await backup(server);
    await playAfterBackup(server, clock, player);
    const late = await newPlayer(server, 'Recém-chegado');
    await renew(server, quit);
    expect((await call(server, 'POST', '/auth/logout', { token: quit.token })).status).toBe(204);

    // Antes de restaurar: guardar as duas tabelas de sessão do banco atual.
    await server.pool.query('drop table if exists kept_sessions, kept_refresh_tokens');
    await server.pool.query('create table kept_sessions as table sessions');
    await server.pool.query('create table kept_refresh_tokens as table refresh_tokens');
    await restore(server);
    // Depois de restaurar: trocar as sessões do backup pelas guardadas.
    await server.pool.query('truncate sessions, refresh_tokens');
    await server.pool.query(
      `insert into sessions
         select * from kept_sessions where account_id in (select id from accounts)`,
    );
    await server.pool.query(
      `insert into refresh_tokens
         select * from kept_refresh_tokens where session_id in (select id from sessions)`,
    );

    clock.advance(16 * MINUTE);
    // Quem jogou depois do backup continua dentro; a ordem dada depois dele se perdeu.
    const renewed = await refresh(server, player.refreshToken);
    expect(renewed.status).toBe(200);
    expect(await settlementName(server, player.game.id)).toBe('Pedra Alta');
    // Quem saiu depois do backup continua fora.
    const gone = await refresh(server, quit.refreshToken);
    expect(gone.status).toBe(401);
    expect(gone.body.code).toBe('SESSION_REVOKED');
    // E a conta criada depois do backup não existe, com ou sem sessão guardada.
    expect((await refresh(server, late.refreshToken)).status).toBe(401);
  });
});
