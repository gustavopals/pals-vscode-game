import { type GameEvent as EngineEvent, type GameState, migrateState } from '@lotg/engine';
import type { GameEvent, GameSummary } from '@lotg/protocol';
import { and, desc, eq, gt, gte, lt, ne, sql } from 'drizzle-orm';

import { notFound } from '../api-error';
import type { Tx } from '../db/client';
import { commands, type GameEventRow, gameEvents, type GameRow, games } from '../db/schema';

/** Uma partida travada, com o estado já na versão que o motor desta imagem simula. */
export type LoadedGame = Omit<GameRow, 'state'> & {
  state: GameState;
  /**
   * Versão em que o estado estava gravado, quando era anterior à do motor; `null` se a linha já
   * está em dia. A migração aconteceu só em memória: a próxima escrita desta transação a grava.
   */
  migratedFrom: number | null;
};

/**
 * Leva o estado gravado até a versão do motor (GDD §15.4). Só é chamada com a linha travada.
 *
 * Um estado de versão **mais nova** que a do motor, ou que não tem a forma da versão que
 * declara, faz `migrateState` lançar `StateMigrationError`: a requisição termina em 500 e a
 * transação é desfeita, sem nada gravado por cima. É o que protege o banco quando alguém volta
 * a imagem da API para antes de uma migração (deploy/README.md, "Reverter depois de uma
 * migração de estado").
 */
export function loadGame(row: GameRow): LoadedGame {
  const state = migrateState(row.state, { timeScale: Number(row.timeScale) });
  const stored: unknown = row.state;
  return { ...row, state, migratedFrom: state === stored ? null : row.state.schemaVersion };
}

/**
 * Trava a partida com `SELECT … FOR UPDATE`, já filtrando pela conta: quem não é o dono recebe
 * 404 antes de qualquer consulta a recibos ou eventos. Leituras e comandos passam por aqui (o
 * job tem a própria trava, com `SKIP LOCKED`), então nunca dois deles avançam nem migram a
 * mesma partida ao mesmo tempo.
 */
export async function lockGame(tx: Tx, accountId: string, gameId: string): Promise<LoadedGame> {
  const [row] = await tx
    .select()
    .from(games)
    .where(and(eq(games.id, gameId), eq(games.accountId, accountId)))
    .for('update');
  if (row === undefined) {
    throw notFound('Partida');
  }
  return loadGame(row);
}

/** Tempo de jogo, em ms inteiros, no instante `now` do relógio do servidor. */
export function gameTimeAt(game: LoadedGame, now: Date): number {
  const elapsed = Math.max(0, now.getTime() - game.createdAt.getTime());
  const gameTime = Math.floor(elapsed * Number(game.timeScale));
  // O relógio nunca anda para trás do ponto de vista da partida.
  return Math.max(gameTime, game.state.lastProcessedAt);
}

/** Instante real em que um evento de jogo aconteceu. */
function wallTimeOf(game: LoadedGame, atMs: number): Date {
  return new Date(game.createdAt.getTime() + Math.round(atMs / Number(game.timeScale)));
}

export function toApiEvent(row: GameEventRow): GameEvent {
  return {
    seq: row.seq,
    type: row.kind as GameEvent['type'],
    at: row.at.toISOString(),
    atMs: row.payload.atMs,
    text: row.payload.text,
    data: row.payload.data,
  };
}

async function lastEventSeq(tx: Tx, gameId: string): Promise<number> {
  const [row] = await tx
    .select({ seq: sql<number>`coalesce(max(${gameEvents.seq}), 0)`.mapWith(Number) })
    .from(gameEvents)
    .where(eq(gameEvents.gameId, gameId));
  return row?.seq ?? 0;
}

export async function nextCommandSeq(tx: Tx, gameId: string): Promise<number> {
  const [row] = await tx
    .select({ seq: sql<number>`coalesce(max(${commands.seq}), 0)`.mapWith(Number) })
    .from(commands)
    .where(eq(commands.gameId, gameId));
  return (row?.seq ?? 0) + 1;
}

/**
 * Escreve o estado completo e os eventos, sob o lock da partida, e incrementa `state_version`
 * exatamente uma vez. `last_processed_at` recebe o relógio de parede do avanço. O estado que
 * chega aqui já está na versão do motor: se a linha guardava uma versão anterior, é esta escrita
 * que grava a migração, junto com `schema_version`.
 */
export async function persistState(
  tx: Tx,
  game: LoadedGame,
  state: GameState,
  events: EngineEvent[],
  now: Date,
): Promise<{ stateVersion: number; events: GameEvent[] }> {
  let inserted: GameEventRow[] = [];
  if (events.length > 0) {
    const firstSeq = (await lastEventSeq(tx, game.id)) + 1;
    inserted = await tx
      .insert(gameEvents)
      .values(
        events.map((event, index) => ({
          gameId: game.id,
          seq: firstSeq + index,
          at: wallTimeOf(game, event.atMs),
          kind: event.type,
          payload: { atMs: event.atMs, text: event.text, data: event.data },
        })),
      )
      .returning();
  }
  const stateVersion = game.stateVersion + 1;
  await tx
    .update(games)
    .set({
      state,
      schemaVersion: state.schemaVersion,
      stateVersion,
      lastProcessedAt: now,
      updatedAt: now,
    })
    .where(eq(games.id, game.id));
  return {
    stateVersion,
    events: inserted.sort((a, b) => a.seq - b.seq).map(toApiEvent),
  };
}

export async function eventsAfter(
  tx: Tx,
  gameId: string,
  after: number,
  limit: number,
): Promise<GameEventRow[]> {
  return tx
    .select()
    .from(gameEvents)
    .where(and(eq(gameEvents.gameId, gameId), gt(gameEvents.seq, after)))
    .orderBy(gameEvents.seq)
    .limit(limit);
}

/** Sequência do evento que abriu um ano de jogo; `null` se esse ano ainda não começou. */
async function yearStartSeq(tx: Tx, gameId: string, year: number): Promise<number | null> {
  if (year <= 1) {
    return 0;
  }
  const [row] = await tx
    .select({ seq: gameEvents.seq })
    .from(gameEvents)
    .where(
      and(
        eq(gameEvents.gameId, gameId),
        eq(gameEvents.kind, 'yearStarted'),
        sql`${gameEvents.payload} -> 'data' ->> 'year' = ${String(year)}`,
      ),
    );
  return row?.seq ?? null;
}

/**
 * Linhas da Crônica, da mais antiga para a mais nova: uma por evento. Com `limit`, só as últimas;
 * com `year`, só as daquele ano de jogo. O ano não é calculado aqui: quem delimita os anos são
 * os eventos `yearStarted` que o motor emitiu.
 */
export async function chronicleRows(
  tx: Tx,
  gameId: string,
  options: { limit?: number | undefined; year?: number | undefined } = {},
): Promise<GameEventRow[]> {
  // As viradas de dia continuam em `GET /events`, mas não entram na Crônica (ADR 0007).
  const conditions = [eq(gameEvents.gameId, gameId), ne(gameEvents.kind, 'dayStarted')];
  if (options.year !== undefined) {
    const from = await yearStartSeq(tx, gameId, options.year);
    if (from === null) {
      return [];
    }
    conditions.push(gte(gameEvents.seq, from));
    const until = await yearStartSeq(tx, gameId, options.year + 1);
    if (until !== null) {
      conditions.push(lt(gameEvents.seq, until));
    }
  }
  const query = tx
    .select()
    .from(gameEvents)
    .where(and(...conditions))
    .orderBy(desc(gameEvents.seq));
  const rows = options.limit === undefined ? await query : await query.limit(options.limit);
  return rows.reverse();
}

export function toGameSummary(row: GameRow | LoadedGame): GameSummary {
  return {
    id: row.id,
    status: row.status,
    settlementName: row.state.settlement.name,
    difficulty: row.difficulty,
    timeScale: Number(row.timeScale),
    timezone: row.timezone,
    vigilHourLocal: row.vigilHour,
    stateVersion: String(row.stateVersion),
    createdAt: row.createdAt.toISOString(),
  };
}
