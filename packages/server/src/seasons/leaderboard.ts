import { YearEndedDataSchema } from '@lotg/content';
import type { LeaderboardResponse, SeasonChronicleResponse } from '@lotg/protocol';
import { and, asc, eq, exists, isNull, lte, or, sql } from 'drizzle-orm';

import { ApiError, sessionRevoked } from '../api-error';
import type { AppContext } from '../context';
import type { Tx } from '../db/client';
import { accounts, gameEvents, games, type SeasonRow, seasons } from '../db/schema';
import { buildYearChronicleMarkdown, readYearChronicleRows } from '../games/chronicle';
import { toSeasonSummary } from './service';

// Leem calendário, preferência e eventos gravados na mesma fotografia, sem avançar partidas.
const READ_SNAPSHOT = { isolationLevel: 'repeatable read', accessMode: 'read only' } as const;

async function findSeason(tx: Tx, seasonId: string): Promise<SeasonRow> {
  const [season] = await tx.select().from(seasons).where(eq(seasons.id, seasonId));
  if (season === undefined) {
    throw new ApiError('NOT_FOUND', 'Temporada não encontrada.');
  }
  return season;
}

async function readViewer(tx: Tx, seasonId: string, accountId: string) {
  const membership = tx
    .select({ id: games.id })
    .from(games)
    .where(and(eq(games.seasonId, seasonId), eq(games.accountId, accountId)));
  const [viewer] = await tx
    .select({ listed: accounts.rankingListed, joined: exists(membership).mapWith(Boolean) })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), isNull(accounts.deletedAt)));
  if (viewer === undefined) {
    throw sessionRevoked();
  }
  return viewer;
}

/** O fecho arquiva as partidas. Só vale o primeiro `yearEnded` do Ano 1 até o prazo. */
function rankedSeasonGames(tx: Tx, season: SeasonRow) {
  const yearEnd = tx
    .select({
      seq: gameEvents.seq,
      data: sql<unknown>`${gameEvents.payload} -> 'data'`.as('data'),
    })
    .from(gameEvents)
    .where(
      and(
        eq(gameEvents.gameId, games.id),
        eq(gameEvents.kind, 'yearEnded'),
        sql`${gameEvents.payload} -> 'data' ->> 'year' = '1'`,
        lte(gameEvents.at, season.endsAt),
      ),
    )
    .orderBy(gameEvents.seq)
    .limit(1)
    .as('year_end');

  // A saída do ranking oculta a linha, sem fazer um endereço de Crônica apontar a outro feudo.
  return tx
    .select({
      gameId: games.id,
      accountId: games.accountId,
      settlementName: sql<string>`${games.state} -> 'settlement' ->> 'name'`.as('settlement_name'),
      position: sql<number>`row_number() over (
        order by (${yearEnd.data} ->> 'score')::bigint desc, ${games.createdAt}, ${games.id}
      )`
        .mapWith(Number)
        .as('position'),
      endSeq: yearEnd.seq,
      data: yearEnd.data,
      visible: sql<boolean>`(${accounts.rankingListed} and ${accounts.deletedAt} is null)`.as(
        'visible',
      ),
    })
    .from(games)
    .innerJoin(accounts, eq(accounts.id, games.accountId))
    .innerJoinLateral(yearEnd, sql`true`)
    .where(and(eq(games.seasonId, season.id), eq(games.status, 'archived')))
    .as('ranked');
}

export async function readLeaderboard(
  ctx: AppContext,
  accountId: string,
  seasonId: string,
): Promise<LeaderboardResponse> {
  return ctx.db.transaction(async (tx) => {
    const season = await findSeason(tx, seasonId);
    const viewer = await readViewer(tx, seasonId, accountId);
    const summary = toSeasonSummary(season, ctx.clock());
    const me: LeaderboardResponse['me'] = { position: null, listed: viewer.listed };
    if (season.status !== 'closed') {
      return { season: summary, published: false, entries: [], me };
    }

    const ranked = rankedSeasonGames(tx, season);
    const rows = await tx
      .select({
        position: ranked.position,
        settlementName: ranked.settlementName,
        visible: ranked.visible,
        data: ranked.data,
        mine: sql<boolean>`${ranked.accountId} = ${accountId}`,
      })
      .from(ranked)
      .where(or(ranked.visible, eq(ranked.accountId, accountId)))
      .orderBy(asc(ranked.position));

    me.position = rows.find((row) => row.mine)?.position ?? null;
    const entries = rows
      .filter((row) => row.visible)
      .map((row) => {
        const ended = YearEndedDataSchema.parse(row.data);
        return {
          position: row.position,
          settlementName: row.settlementName,
          score: ended.score,
          siegeOutcome: ended.siegeResult,
          feats: ended.feats.split(',').filter(Boolean).length,
          mine: row.mine,
          chronicleAvailable: viewer.joined,
        };
      });
    return { season: summary, published: true, entries, me };
  }, READ_SNAPSHOT);
}

export async function readSeasonChronicle(
  ctx: AppContext,
  accountId: string,
  seasonId: string,
  position: number,
): Promise<SeasonChronicleResponse> {
  return ctx.db.transaction(async (tx) => {
    const season = await findSeason(tx, seasonId);
    if (season.status !== 'closed') {
      throw new ApiError('NOT_FOUND', 'As Crônicas da Temporada saem quando o ranking fecha.');
    }
    const viewer = await readViewer(tx, seasonId, accountId);
    if (!viewer.joined) {
      throw new ApiError('FORBIDDEN', 'Só quem jogou na mesma Temporada pode ler suas Crônicas.');
    }

    const ranked = rankedSeasonGames(tx, season);
    const [entry] = await tx
      .select({
        gameId: ranked.gameId,
        settlementName: ranked.settlementName,
        endSeq: ranked.endSeq,
        data: ranked.data,
      })
      .from(ranked)
      .where(and(eq(ranked.position, position), ranked.visible));
    if (entry === undefined) {
      throw new ApiError('NOT_FOUND', 'Não há Crônica publicada nesta posição.');
    }

    const ended = YearEndedDataSchema.parse(entry.data);
    const rows = await readYearChronicleRows(tx, entry.gameId, entry.endSeq);
    const markdown = buildYearChronicleMarkdown(entry.settlementName, ended.year, rows, ended);
    return { settlementName: entry.settlementName, position, markdown };
  }, READ_SNAPSHOT);
}
