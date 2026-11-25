import { randomBytes, randomUUID } from 'node:crypto';

import type { DifficultyId } from '@lotg/content';
import { createInitialState } from '@lotg/engine';
import type {
  CurrentSeasonResponse,
  JoinSeasonRequest,
  JoinSeasonResponse,
  SeasonSummary,
} from '@lotg/protocol';
import { and, asc, eq, isNotNull, lte, ne, notInArray, isNull, sql } from 'drizzle-orm';

import { ApiError, sessionRevoked } from '../api-error';
import type { AppContext } from '../context';
import { accounts, games, type SeasonRow, seasons } from '../db/schema';
import { archiveGameAt, loadGame, toGameSummary } from '../games/repository';
import { resolveVigilTimezone } from '../games/vigil';
import { FAILED_IDS_IN_REPORT, type FailureCause, failureCause } from '../jobs/advanceStaleGames';
import {
  SEASON_DIFFICULTY,
  SEASON_SCENARIO,
  SEASON_TIME_SCALE,
  SEASON_TIMEZONE,
  seasonWindowAt,
} from './calendar';

/** Chave do advisory lock que serializa a abertura da Temporada da semana entre réplicas. */
const SEASON_OPEN_LOCK = 7272;
const CLOSE_BATCH_SIZE = 100;
const CLOSE_BUDGET_MS = 20_000;

export type CloseSeasonsReport = {
  closedSeasons: number;
  archivedGames: number;
  events: number;
  failed: number;
  firstFailure?: FailureCause;
  failedGameIds?: string[];
};

/**
 * Converte a linha do banco no contrato público da Temporada.
 * A semente só é revelada quando `status === 'closed'` (D-27): nunca antes do fecho do ranking.
 */
export function toSeasonSummary(row: SeasonRow, now: Date): SeasonSummary {
  const open = row.status === 'open';
  const beforeJoinEnd = now.getTime() < row.joinEndsAt.getTime();
  const beforeEnd = now.getTime() < row.endsAt.getTime();
  return {
    id: row.id,
    code: row.code,
    status: row.status,
    timezone: SEASON_TIMEZONE,
    difficulty: row.difficulty as DifficultyId,
    timeScale: Number(row.timeScale),
    startsAt: row.startsAt.toISOString(),
    joinEndsAt: row.joinEndsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    rankingPublishedAt: row.closedAt === null ? null : row.closedAt.toISOString(),
    joinOpen: open && beforeJoinEnd && beforeEnd,
    seed: row.status === 'closed' ? row.seed : null,
  };
}

/**
 * Garante que a Temporada da semana corrente (em Brasília UTC−3) exista no banco, abrindo-a sob
 * `pg_advisory_xact_lock` se faltar — sem agendador novo. Chamadas simultâneas de múltiplas
 * réplicas esperam o lock e encontram a mesma linha já gravada.
 */
export async function ensureCurrentSeason(
  ctx: AppContext,
  now: Date = ctx.clock(),
): Promise<SeasonRow> {
  const window = seasonWindowAt(now);
  const [existing] = await ctx.db
    .select()
    .from(seasons)
    .where(eq(seasons.startsAt, window.startsAt));
  if (existing !== undefined) {
    return existing;
  }

  return ctx.db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${SEASON_OPEN_LOCK})`);
    const [found] = await tx.select().from(seasons).where(eq(seasons.startsAt, window.startsAt));
    if (found !== undefined) {
      return found;
    }
    const alreadyEnded = now.getTime() >= window.endsAt.getTime();
    const [created] = await tx
      .insert(seasons)
      .values({
        id: randomUUID(),
        code: window.code,
        startsAt: window.startsAt,
        joinEndsAt: window.joinEndsAt,
        endsAt: window.endsAt,
        seed: randomBytes(12).toString('hex'),
        difficulty: SEASON_DIFFICULTY,
        timeScale: String(SEASON_TIME_SCALE),
        status: alreadyEnded ? 'closed' : 'open',
        closedAt: alreadyEnded ? now : null,
        createdAt: now,
      })
      .returning();
    if (created === undefined) {
      throw new Error('A Temporada não foi criada.');
    }
    return created;
  });
}

/**
 * `GET /v1/seasons/current`: abre a Temporada da semana se faltar e devolve o calendário dela,
 * se a conta autenticada já entrou e o resumo da partida dela. Nunca expõe a semente antes do
 * fecho (D-27).
 */
export async function getCurrentSeason(
  ctx: AppContext,
  accountId: string,
): Promise<CurrentSeasonResponse> {
  const now = ctx.clock();
  const season = await ensureCurrentSeason(ctx, now);
  const [game] = await ctx.db
    .select()
    .from(games)
    .where(and(eq(games.accountId, accountId), eq(games.seasonId, season.id)));
  return {
    season: toSeasonSummary(season, now),
    joined: game !== undefined,
    game: game === undefined ? null : toGameSummary(game),
  };
}

/**
 * `POST /v1/seasons/current/join`: cria a partida da Temporada atual usando a semente, a
 * dificuldade (`lord`), o ritmo (`3×`) e o cenário (`standard`) da linha (D-26).
 *
 * Convive com a partida pessoal ativa (`games.season_id is null`): `replaceActive` não existe
 * aqui, e `ACTIVE_GAME_EXISTS` vale no trilho da Temporada.
 */
export async function joinCurrentSeason(
  ctx: AppContext,
  accountId: string,
  input: JoinSeasonRequest,
): Promise<JoinSeasonResponse> {
  const now = ctx.clock();
  const ensured = await ensureCurrentSeason(ctx, now);

  return ctx.db.transaction(async (tx) => {
    // Mesma trava `FOR NO KEY UPDATE` de toda operação na conta: serializa duas entradas
    // simultâneas, impede entrada em conta excluída e não bloqueia recibos de comandos.
    const [account] = await tx
      .select({ id: accounts.id })
      .from(accounts)
      .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)))
      .for('no key update');
    if (account === undefined) {
      throw sessionRevoked();
    }

    const [season] = await tx.select().from(seasons).where(eq(seasons.id, ensured.id));
    if (season === undefined) {
      throw new Error('A Temporada atual não foi encontrada.');
    }
    if (season.status === 'closed' || now.getTime() >= season.endsAt.getTime()) {
      throw new ApiError(
        'CONFLICT',
        'Esta Temporada já foi encerrada. A próxima abre na segunda-feira às 00:00 (horário de Brasília).',
        { reason: 'SEASON_CLOSED', endsAt: season.endsAt.toISOString() },
      );
    }

    const [existingInSeason] = await tx
      .select({ id: games.id, status: games.status })
      .from(games)
      .where(and(eq(games.accountId, accountId), eq(games.seasonId, season.id)));
    if (existingInSeason !== undefined) {
      if (existingInSeason.status === 'active') {
        throw new ApiError('ACTIVE_GAME_EXISTS', 'Você já governa um feudo nesta Temporada.');
      }
      throw new ApiError('CONFLICT', 'Você já participou desta Temporada.');
    }

    if (now.getTime() >= season.joinEndsAt.getTime()) {
      throw new ApiError(
        'CONFLICT',
        'O prazo de entrada desta Temporada encerrou na terça-feira. A próxima abre na segunda-feira às 00:00 (horário de Brasília).',
        { reason: 'SEASON_JOIN_CLOSED', joinEndsAt: season.joinEndsAt.toISOString() },
      );
    }

    // Se a conta ainda tem uma partida ativa de uma Temporada anterior cujo prazo já venceu e
    // cujo job de fecho ainda não rodou, avança até o fecho dela e arquiva antes de abrir a nova.
    const leftover = await tx
      .select({ id: games.id, seasonId: games.seasonId })
      .from(games)
      .where(
        and(
          eq(games.accountId, accountId),
          eq(games.status, 'active'),
          isNotNull(games.seasonId),
          ne(games.seasonId, season.id),
        ),
      );
    for (const previous of leftover) {
      if (previous.seasonId === null) {
        continue;
      }
      const [oldSeason] = await tx
        .select({ status: seasons.status, endsAt: seasons.endsAt })
        .from(seasons)
        .where(eq(seasons.id, previous.seasonId));
      if (
        oldSeason === undefined ||
        (oldSeason.status !== 'closed' && now.getTime() < oldSeason.endsAt.getTime())
      ) {
        throw new ApiError(
          'ACTIVE_GAME_EXISTS',
          'Você já governa um feudo em outra Temporada ativa.',
        );
      }
      const [oldRow] = await tx
        .select()
        .from(games)
        .where(and(eq(games.id, previous.id), eq(games.status, 'active')))
        .for('update');
      if (oldRow !== undefined) {
        await archiveGameAt(tx, loadGame(oldRow), oldSeason.endsAt, now);
      }
    }

    const difficulty = season.difficulty as DifficultyId;
    const timeScale = Number(season.timeScale);
    const state = createInitialState(season.seed, {
      settlementName: input.settlementName,
      timezone: input.timezone,
      vigilHourLocal: input.vigilHourLocal,
      difficulty,
      timeScale,
      scenario: SEASON_SCENARIO,
      realOriginMs: now.getTime(),
      vigil: {
        hourLocal: input.vigilHourLocal,
        ...resolveVigilTimezone(input.timezone, now),
      },
    });
    const [row] = await tx
      .insert(games)
      .values({
        id: randomUUID(),
        accountId,
        seasonId: season.id,
        status: 'active',
        seed: season.seed,
        difficulty: season.difficulty,
        timeScale: season.timeScale,
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
      throw new Error('A partida da Temporada não foi criada.');
    }
    return {
      season: toSeasonSummary(season, now),
      game: toGameSummary(row),
    };
  });
}

/**
 * Fecha as Temporadas abertas cujo `ends_at` já venceu (domingo 23:59 de Brasília):
 * avança cada partida ativa dela até `ends_at` (garantindo `yearEnded` e crédito de Legado) e
 * arquiva em transações individuais com `FOR UPDATE SKIP LOCKED`. A Temporada só passa para
 * `closed` (revelando a semente, D-27) quando não resta nenhuma partida ativa vinculada a ela.
 */
export async function closeExpiredSeasons(ctx: AppContext): Promise<CloseSeasonsReport> {
  const startedAt = Date.now();
  const report: CloseSeasonsReport = {
    closedSeasons: 0,
    archivedGames: 0,
    events: 0,
    failed: 0,
  };
  const failedIds: string[] = [];

  const now = ctx.clock();
  const expired = await ctx.db
    .select({ id: seasons.id, endsAt: seasons.endsAt })
    .from(seasons)
    .where(and(eq(seasons.status, 'open'), lte(seasons.endsAt, now)))
    .orderBy(asc(seasons.endsAt));

  for (const season of expired) {
    while (Date.now() - startedAt < CLOSE_BUDGET_MS) {
      const candidates = await ctx.db
        .select({ id: games.id })
        .from(games)
        .where(
          and(
            eq(games.seasonId, season.id),
            eq(games.status, 'active'),
            failedIds.length > 0 ? notInArray(games.id, failedIds) : undefined,
          ),
        )
        .orderBy(games.lastProcessedAt)
        .limit(CLOSE_BATCH_SIZE);

      let progressed = 0;
      let failedNow = 0;
      for (const { id } of candidates) {
        try {
          const outcome = await ctx.db.transaction(async (tx) => {
            const [row] = await tx
              .select()
              .from(games)
              .where(and(eq(games.id, id), eq(games.status, 'active')))
              .for('update', { skipLocked: true });
            if (row === undefined) {
              return null;
            }
            return archiveGameAt(tx, loadGame(row), season.endsAt, ctx.clock());
          });
          if (outcome !== null) {
            report.archivedGames += 1;
            report.events += outcome.events;
            progressed += 1;
          }
        } catch (error) {
          report.failed += 1;
          failedNow += 1;
          failedIds.push(id);
          report.firstFailure ??= failureCause(error);
          report.failedGameIds ??= [];
          if (report.failedGameIds.length < FAILED_IDS_IN_REPORT) {
            report.failedGameIds.push(id);
          }
        }
      }

      if (candidates.length < CLOSE_BATCH_SIZE || (progressed === 0 && failedNow === 0)) {
        break;
      }
    }

    const closed = await ctx.db.transaction(async (tx) => {
      const [locked] = await tx
        .select({ id: seasons.id })
        .from(seasons)
        .where(and(eq(seasons.id, season.id), eq(seasons.status, 'open')))
        .for('update');
      if (locked === undefined) {
        return false;
      }
      const [remaining] = await tx
        .select({ count: sql<number>`count(*)`.mapWith(Number) })
        .from(games)
        .where(and(eq(games.seasonId, season.id), eq(games.status, 'active')));
      if ((remaining?.count ?? 0) > 0) {
        return false;
      }
      await tx
        .update(seasons)
        .set({ status: 'closed', closedAt: ctx.clock() })
        .where(eq(seasons.id, season.id));
      return true;
    });
    if (closed) {
      report.closedSeasons += 1;
    }
  }

  return report;
}
