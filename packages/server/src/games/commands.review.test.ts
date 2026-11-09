import { advanceTo, deriveViewState, migrateState, type GameState } from '@lotg/engine';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';

import { readySiege } from '../../../engine/src/siege.test-helpers';
import { accept, command, saveFormationOrder } from '../../../engine/src/test-helpers';
import type { AppContext } from '../context';
import { buildApp } from '../app';
import { loadConfig } from '../config';
import type { Tx } from '../db/client';
import { executeCommand, requestHash } from './commands';
import { lockGame, nextCommandSeq, persistState, type LoadedGame } from './repository';

vi.mock('./repository', async (original) => ({
  ...(await original<typeof import('./repository')>()),
  lockGame: vi.fn(),
  nextCommandSeq: vi.fn(),
  persistState: vi.fn(),
}));

/** Fronteira transacional em memória; não afirma testar a trava do PostgreSQL. */
function serviceAt(state: GameState) {
  vi.mocked(lockGame).mockReset();
  vi.mocked(persistState).mockReset();
  vi.mocked(nextCommandSeq).mockReset();
  const game = {
    id: 'partida',
    status: 'active',
    state,
    stateVersion: 1,
    createdAt: new Date(0),
    timeScale: String(state.settings.timeScale),
  } as LoadedGame;
  const rows: Array<Record<string, unknown>> = [];
  const where = vi.fn().mockResolvedValue([]);
  const tx = {
    select: () => ({ from: () => ({ where }) }),
    insert: () => ({
      values: (row: Record<string, unknown>) => {
        rows.push(row);
        return Promise.resolve();
      },
    }),
  } as unknown as Tx;
  vi.mocked(lockGame).mockImplementation(async () => ({ ...game }));
  vi.mocked(nextCommandSeq).mockImplementation(async () => rows.length + 1);
  vi.mocked(persistState).mockImplementation(async (_tx, _game, next, events) => {
    // Mesma conferência JSON que precede a escrita real, sem acessar banco.
    game.state = migrateState(JSON.parse(JSON.stringify(next)), {
      timeScale: next.settings.timeScale,
    });
    game.stateVersion += 1;
    return {
      stateVersion: game.stateVersion,
      events: events.map((event, index) => ({
        ...event,
        seq: index + 1,
        at: new Date(event.atMs).toISOString(),
      })),
    };
  });
  let turn: Promise<unknown> = Promise.resolve();
  const ctx = {
    db: {
      transaction: (run: (transaction: Tx) => Promise<unknown>) => {
        const result = turn.then(() => run(tx));
        turn = result.catch(() => undefined);
        return result;
      },
    },
    clock: vi.fn(() => new Date(state.lastProcessedAt / state.settings.timeScale)),
    hooks: {},
  } as unknown as AppContext;
  return { ctx, game, rows, where };
}

describe('V4G-T5.1 · ordens concorrentes e recibo histórico, sem banco', () => {
  it.each([0.5, 1, 3])(
    'serializa duas trocas distintas para a mesma onda no ritmo %s',
    async (pace) => {
      const initial = readySiege('lord', pace);
      const formation = initial.army.formations[0]!;
      const withSecond = accept(
        initial,
        saveFormationOrder('Segunda defesa', {
          posts: formation.posts,
          commanders: formation.commanders,
        }),
      ).state;
      const state = advanceTo(withSecond, withSecond.siege!.atMs).state;
      const { ctx, game, rows } = serviceAt(state);
      const first = command('swapWaveFormation', { wave: 2, formationId: 'formation-2' });
      const second = command('swapWaveFormation', { wave: 2, formationId: 'formation-1' });
      const outcomes = await Promise.all([
        executeCommand(ctx, 'dono', 'partida', first, '1'),
        executeCommand(ctx, 'dono', 'partida', second, '1'),
      ]);
      expect(outcomes.map((result) => result.status)).toEqual([200, 200]);
      expect(outcomes.map((result) => result.body)).toMatchObject([
        { stateVersion: '2', staleView: false, view: { siege: { plan: { 2: 'formation-2' } } } },
        { stateVersion: '3', staleView: true, view: { siege: { plan: { 2: 'formation-1' } } } },
      ]);
      expect(rows.map((row) => row.id)).toEqual([first.commandId, second.commandId]);
      expect(rows.map((row) => row.seq)).toEqual([1, 2]);
      expect(rows.map((row) => row.responseBody)).toEqual(outcomes.map((result) => result.body));
      expect(game.state.siege!.plan[2]).toBe('formation-1');
      expect(game.state.siege!.plan[3]).toBeNull();
      expect(game.state.rng).toEqual(state.rng);
      const fought = advanceTo(game.state, game.state.siege!.nextWaveAtMs!).state;
      expect(fought.army.reports.at(-1)!.formationId).toBe('formation-1');
    },
  );

  it.each([200, 422])(
    'devolve o recibo do protocolo 3 (%s) intacto, sem avanço nem nova escrita',
    async (status) => {
      const state = readySiege();
      const { ctx, game, rows, where } = serviceAt(state);
      const intent = command('setActiveFormation', { id: 'formation-1' });
      const oldView = JSON.parse(JSON.stringify(deriveViewState(state, state.lastProcessedAt)));
      delete oldView.siege;
      const oldAccepted = { view: oldView, events: [], stateVersion: '7', staleView: false };
      const oldBody =
        status === 200
          ? oldAccepted
          : {
              code: 'GAME_RULE',
              message: 'Recusa da época.',
              details: { code: 'FORMATION_NOT_FOUND', message: 'Recusa da época.', ...oldAccepted },
            };
      const frozen = JSON.stringify(oldBody);
      where.mockResolvedValue([
        { requestHash: requestHash(intent), responseStatus: status, responseBody: oldBody },
      ]);
      const replay = await executeCommand(ctx, 'dono', 'partida', intent, '1');
      expect(replay).toEqual({ status, body: oldBody, replayed: true });
      expect(JSON.stringify(oldBody)).toBe(frozen);
      expect(game.state).toBe(state);
      expect(game.stateVersion).toBe(1);
      expect(rows).toEqual([]);
      expect(persistState).not.toHaveBeenCalled();
      expect(nextCommandSeq).not.toHaveBeenCalled();
      expect(ctx.clock).not.toHaveBeenCalled();
    },
  );

  it('o cliente do protocolo 3 recebe 426 antes de procurar seu recibo', async () => {
    const query = vi.fn().mockResolvedValue({ rows: [] });
    const config = loadConfig({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://nao-usado',
      JWT_SECRET: Buffer.alloc(48, 1).toString('base64'),
      RECOVERY_CODE_SECRET: Buffer.alloc(48, 2).toString('base64'),
      LOG_LEVEL: 'silent',
    });
    const { app } = await buildApp({ config, pool: { query } as unknown as Pool, logger: false });
    try {
      await app.ready();
      query.mockClear();
      const response = await app.inject({
        method: 'POST',
        url: '/v1/games/11111111-1111-4111-8111-111111111111/commands',
        headers: { 'x-lords-protocol': '3' },
        payload: {
          commandId: '22222222-2222-4222-8222-222222222222',
          type: 'setActiveFormation',
          payload: { id: 'formation-1' },
        },
      });
      expect(response.statusCode).toBe(426);
      expect(response.json()).toMatchObject({ code: 'UPGRADE_REQUIRED', details: { protocol: 4 } });
      expect(response.headers['x-lords-replayed']).toBeUndefined();
      expect(query).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});
