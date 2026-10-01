import { randomBytes, randomUUID } from 'node:crypto';

import { advanceTo, createInitialState, type GameState } from '@lotg/engine';
import type { CreateGameRequest, GameSummary } from '@lotg/protocol';
import { and, desc, eq, isNull } from 'drizzle-orm';

import { ApiError, sessionRevoked } from '../api-error';
import type { AppContext } from '../context';
import type { Tx } from '../db/client';
import { accounts, type GameRow, games } from '../db/schema';
import { gameTimeAt, lockGame, persistState, toGameSummary } from './repository';

/** Na v0.1 a dificuldade e o ritmo são fixos; os campos existem e são guardados. */
const DIFFICULTY = 'lord';
const TIME_SCALE = 1;

export async function listGames(ctx: AppContext, accountId: string): Promise<GameSummary[]> {
  const rows = await ctx.db
    .select()
    .from(games)
    .where(eq(games.accountId, accountId))
    .orderBy(desc(games.createdAt));
  return rows.map(toGameSummary);
}

/**
 * `POST /games`. Uma partida ativa por conta: com uma já ativa, recusa com `ACTIVE_GAME_EXISTS`,
 * a não ser que venha `replaceActive`, que arquiva a atual.
 */
export async function createGame(
  ctx: AppContext,
  accountId: string,
  input: CreateGameRequest,
): Promise<GameSummary> {
  const now = ctx.clock();
  return ctx.db.transaction(async (tx) => {
    // O lock da conta serializa duas criações simultâneas e impede criar para conta excluída.
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      // `NO KEY UPDATE`, como em toda trava de conta: não bloqueia a inserção de recibos de
      // comando, que referenciam a conta depois de travar a partida.
      .for('no key update');
    if (account === undefined) {
      throw sessionRevoked();
    }
    const [active] = await tx
      .select({ id: games.id })
      .from(games)
      .where(and(eq(games.accountId, accountId), eq(games.status, 'active')));
    if (active !== undefined) {
      if (input.replaceActive !== true) {
        throw new ApiError(
          'ACTIVE_GAME_EXISTS',
          'Você já governa um feudo. Para começar outro, o atual será arquivado.',
        );
      }
      await tx
        .update(games)
        .set({ status: 'archived', updatedAt: now })
        .where(eq(games.id, active.id));
    }

    const seed =
      ctx.config.allowGameSeed && input.seed !== undefined
        ? input.seed
        : randomBytes(12).toString('hex');
    const state = createInitialState(seed, {
      settlementName: input.settlementName,
      timezone: input.timezone,
      vigilHourLocal: input.vigilHourLocal,
      capsEnabled: false,
    });
    const [row] = await tx
      .insert(games)
      .values({
        id: randomUUID(),
        accountId,
        status: 'active',
        seed,
        difficulty: DIFFICULTY,
        timeScale: String(TIME_SCALE),
        timezone: input.timezone,
        vigilHour: input.vigilHourLocal,
        schemaVersion: state.schemaVersion,
        state,
        stateVersion: 1,
        lastProcessedAt: now,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (row === undefined) {
      throw new Error('A partida não foi criada.');
    }
    return toGameSummary(row);
  });
}

export type GameReading = {
  game: GameRow;
  state: GameState;
  /** Tempo de jogo até onde `state` foi avançado. */
  gameNowMs: number;
  stateVersion: number;
};

/**
 * Leitura de uma partida, já sob o lock: avança até agora e só escreve se o avanço produziu
 * eventos. Produção contínua sem evento não gera escrita nem muda `state_version`.
 * Uma partida arquivada não avança mais: é devolvida como ficou.
 */
export async function readLockedGame(ctx: AppContext, tx: Tx, game: GameRow): Promise<GameReading> {
  if (game.status !== 'active') {
    return {
      game,
      state: game.state,
      gameNowMs: game.state.lastProcessedAt,
      stateVersion: game.stateVersion,
    };
  }
  const now = ctx.clock();
  const gameNowMs = gameTimeAt(game, now);
  const advanced = advanceTo(game.state, gameNowMs);
  if (advanced.events.length === 0) {
    return { game, state: advanced.state, gameNowMs, stateVersion: game.stateVersion };
  }
  const persisted = await persistState(tx, game, advanced.state, advanced.events, now);
  return { game, state: advanced.state, gameNowMs, stateVersion: persisted.stateVersion };
}

/** Autentica a propriedade, trava, avança e entrega a leitura a `use`, tudo em uma transação. */
export async function withGameReading<T>(
  ctx: AppContext,
  accountId: string,
  gameId: string,
  use: (reading: GameReading, tx: Tx) => Promise<T> | T,
): Promise<T> {
  return ctx.db.transaction(async (tx) => {
    const game = await lockGame(tx, accountId, gameId);
    return use(await readLockedGame(ctx, tx, game), tx);
  });
}

export function assertActive(game: GameRow): void {
  if (game.status !== 'active') {
    throw new ApiError('CONFLICT', 'Esta partida foi arquivada e não aceita mais ordens.');
  }
}
