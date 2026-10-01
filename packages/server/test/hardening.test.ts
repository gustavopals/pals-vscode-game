import type { Account, CommandAccepted, GameRuleError } from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { runJobsOnce } from '../src/jobs/scheduler';
import { safeError } from '../src/safe-error';
import {
  call,
  countRows,
  createTestApp,
  DAY,
  HOUR,
  newPlayer,
  order,
  renew,
  send,
  signUp,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// Defeitos apontados pela revisão do servidor: cada teste reproduz o cenário que dava errado.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

/** Segura um comando no meio da transação até `release` ser chamado. */
function holdCommand(target: TestApp) {
  let release = () => {};
  let reached = () => {};
  const atReceipt = new Promise<void>((resolve) => {
    reached = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  target.hooks.beforeCommandReceipt = async () => {
    reached();
    await gate;
  };
  return {
    atReceipt,
    release: () => {
      delete target.hooks.beforeCommandReceipt;
      release();
    },
  };
}

describe('ordem de locks entre comando e conta', () => {
  it('um comando em andamento e DELETE /me ao mesmo tempo não se travam', async () => {
    const player = await newPlayer(server);
    const held = holdCommand(server);
    // O comando já travou a partida e está prestes a gravar o recibo, que referencia a conta.
    const command = send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 2 }),
    );
    await held.atReceipt;
    // A exclusão trava a conta e fica esperando a partida para arquivá-la.
    const deletion = call(server, 'DELETE', '/me', { token: player.token });
    await new Promise((resolve) => setTimeout(resolve, 150));
    held.release();

    const [commandReply, deletionReply] = await Promise.all([command, deletion]);
    expect(commandReply.status).toBe(200);
    expect(deletionReply.status).toBe(202);
    expect(await countRows(server.pool, 'commands', `game_id = '${player.game.id}'`)).toBe(1);
    expect(
      await countRows(server.pool, 'games', `id = '${player.game.id}' and status = 'archived'`),
    ).toBe(1);
  });

  it('um comando em andamento e uma nova partida com replaceActive não se travam', async () => {
    const player = await newPlayer(server);
    const held = holdCommand(server);
    const command = send<CommandAccepted>(
      server,
      player.token,
      player.game.id,
      order('setWorkers', { building: 'farm', count: 1 }),
    );
    await held.atReceipt;
    const replacement = call(server, 'POST', '/games', {
      token: player.token,
      body: {
        settlementName: 'Vau Alto',
        timezone: 'UTC',
        vigilHourLocal: 20,
        replaceActive: true,
      },
    });
    await new Promise((resolve) => setTimeout(resolve, 150));
    held.release();

    const [commandReply, replacementReply] = await Promise.all([command, replacement]);
    expect(commandReply.status).toBe(200);
    expect(replacementReply.status).toBe(201);
  });
});

describe('jobs com uma partida que falha', () => {
  it('as outras partidas avançam e o expurgo de contas acontece mesmo assim', async () => {
    const broken = await newPlayer(server, 'Estado Quebrado');
    const healthy = await newPlayer(server, 'Vizinho');
    const leaving = await newPlayer(server, 'De Partida');
    await call(server, 'DELETE', '/me', { token: leaving.token });
    // Um estado que o motor não sabe avançar, mais antigo que todos os outros.
    await server.pool.query(
      `update games set state = 'null'::jsonb,
              last_processed_at = last_processed_at - interval '1 hour' where id = $1`,
      [broken.game.id],
    );

    server.clock.advance(7 * DAY);
    const first = await runJobsOnce(server.ctx);
    expect(first).toMatchObject({ ran: true, failed: 1 });
    expect(await countRows(server.pool, 'accounts', `id = '${leaving.accountId}'`)).toBe(0);
    const dayTurns = await countRows(
      server.pool,
      'game_events',
      `game_id = '${healthy.game.id}' and kind = 'dayStarted'`,
    );
    expect(dayTurns).toBe(84);

    // Na rodada seguinte a partida quebrada continua falhando, sem segurar as demais.
    server.clock.advance(2 * HOUR);
    const second = await runJobsOnce(server.ctx);
    expect(second).toMatchObject({ ran: true, failed: 1 });
    const later = await countRows(
      server.pool,
      'game_events',
      `game_id = '${healthy.game.id}' and kind = 'dayStarted'`,
    );
    expect(later).toBe(85);
  });
});

describe('texto que o banco não guarda', () => {
  it.each([
    ['caractere nulo', 'a\u0000b'],
    ['quebra de linha', 'Pedra\nAlta'],
    ['metade solta de par substituto', 'Pedra \ud83d'],
  ])('nome com %s é recusado na validação, não no banco', async (_, name) => {
    const account = await call(server, 'POST', '/auth/anonymous', { body: { displayName: name } });
    expect(account.status).toBe(400);
    expect(account.body).toMatchObject({ code: 'VALIDATION' });

    const player = await signUp(server, 'Gustavo');
    const game = await call(server, 'POST', '/games', {
      token: player.accessToken,
      body: { settlementName: name, timezone: 'UTC', vigilHourLocal: 20 },
    });
    expect(game.status).toBe(400);
    const renamed = await call(server, 'PATCH', '/me', {
      token: player.accessToken,
      body: { displayName: name },
    });
    expect(renamed.status).toBe(400);
  });

  it('renomear o feudo com caractere nulo é VALIDATION e não gera recibo', async () => {
    const player = await newPlayer(server);
    const reply = await send(
      server,
      player.token,
      player.game.id,
      order('renameSettlement', { name: 'Vau\u0000Alto' }),
    );
    expect(reply.status).toBe(400);
    expect(await countRows(server.pool, 'commands', `game_id = '${player.game.id}'`)).toBe(0);
  });

  it('nomes com acentos e emoji continuam valendo', async () => {
    const player = await newPlayer(server, 'Açaí 🏰');
    const reply = await send<CommandAccepted | GameRuleError>(
      server,
      player.token,
      player.game.id,
      order('renameSettlement', { name: 'São João d’El-Rei' }),
    );
    expect(reply.status).toBe(200);
    const me = await call<Account>(server, 'GET', '/me', { token: await renew(server, player) });
    expect(me.body.displayName).toBe('Açaí 🏰');
  });
});

describe('vínculo GitHub simultâneo', () => {
  it('duas contas vinculando o mesmo GitHub: uma vincula, a outra recebe o conflito', async () => {
    const github = await createTestApp({
      clock: server.clock,
      fetch: async () => new Response(JSON.stringify({ id: 4242 }), { status: 200 }),
    });
    try {
      for (let round = 0; round < 5; round += 1) {
        await github.pool.query('update accounts set github_id = null');
        const [a, b] = await Promise.all([signUp(github, 'Edda'), signUp(github, 'Rolf')]);
        const replies = await Promise.all(
          [a, b].map((auth) =>
            call(github, 'POST', '/auth/github', {
              token: auth.accessToken,
              body: { githubAccessToken: 'gho_teste' },
            }),
          ),
        );
        expect(replies.map((reply) => reply.status).sort()).toEqual([200, 409]);
        expect(replies.find((reply) => reply.status === 409)?.body).toMatchObject({
          code: 'ACCOUNT_CONFLICT',
        });
      }
    } finally {
      await github.close();
    }
  });
});

describe('proxy reverso', () => {
  it('com TRUST_PROXY, vale o IP visto pelo proxy, não o que o cliente escreveu no cabeçalho', async () => {
    const proxied = await createTestApp({
      clock: server.clock,
      config: { TRUST_PROXY: 'true', ACCOUNT_CREATE_PER_HOUR_PER_IP: '2' },
    });
    try {
      const attempt = (forged: string) =>
        call(proxied, 'POST', '/auth/anonymous', {
          body: { displayName: 'Gustavo' },
          // O cliente inventa o primeiro endereço; o proxy acrescenta o IP real ao fim.
          headers: { 'x-forwarded-for': `${forged}, 203.0.113.7` },
        });
      expect((await attempt('10.0.0.1')).status).toBe(201);
      expect((await attempt('10.0.0.2')).status).toBe(201);
      expect((await attempt('10.0.0.3')).status).toBe(429);
    } finally {
      await proxied.close();
    }
  });
});

describe('erros no log', () => {
  it('um erro de consulta vai para o log sem o SQL e sem os parâmetros', async () => {
    const failure = await server.ctx.db
      .execute(`select 'Gustavo, o Secreto' from tabela_que_nao_existe`)
      .catch((error: unknown) => error);
    expect(String((failure as Error).message)).toContain('Secreto');

    const logged = JSON.stringify(safeError(failure));
    expect(logged).not.toContain('Secreto');
    expect(logged).not.toContain('select');
    expect(safeError(failure)).toMatchObject({ code: '42P01' });
    expect(safeError(new Error('falha comum'))).toMatchObject({ message: 'falha comum' });
    expect(safeError('texto solto')).toEqual({ name: 'Erro', message: 'texto solto' });
  });
});
