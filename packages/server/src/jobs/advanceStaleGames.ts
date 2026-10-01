import { advanceTo } from '@lotg/engine';
import { and, eq, lt, notInArray } from 'drizzle-orm';

import type { AppContext } from '../context';
import { games } from '../db/schema';
import { gameTimeAt, persistState } from '../games/repository';

const BATCH_SIZE = 100;
const BUDGET_MS = 20_000;

export type AdvanceReport = { advanced: number; events: number; failed: number };

/**
 * Avança as partidas ativas sem estado persistido há mais de `ADVANCE_STALE_AFTER_MS`, em lotes
 * de 100. Cada partida tem a própria transação, com `FOR UPDATE SKIP LOCKED`: a que alguém está
 * lendo ou comandando agora fica para a próxima rodada, e a que der erro é pulada sem impedir as
 * outras. Sempre escreve, para `last_processed_at` andar. Garante que eventos e Crônica existam
 * para quem sumiu (GDD §14.9).
 */
export async function advanceStaleGames(ctx: AppContext): Promise<AdvanceReport> {
  const startedAt = Date.now();
  const report: AdvanceReport = { advanced: 0, events: 0, failed: 0 };
  const failedIds: string[] = [];

  while (Date.now() - startedAt < BUDGET_MS) {
    const staleBefore = new Date(ctx.clock().getTime() - ctx.config.advanceStaleAfterMs);
    const candidates = await ctx.db
      .select({ id: games.id })
      .from(games)
      .where(
        and(
          eq(games.status, 'active'),
          lt(games.lastProcessedAt, staleBefore),
          failedIds.length > 0 ? notInArray(games.id, failedIds) : undefined,
        ),
      )
      .orderBy(games.lastProcessedAt)
      .limit(BATCH_SIZE);

    let progressed = 0;
    for (const { id } of candidates) {
      try {
        const events = await ctx.db.transaction(async (tx) => {
          const now = ctx.clock();
          const stillStaleBefore = new Date(now.getTime() - ctx.config.advanceStaleAfterMs);
          // Revalida sob o lock: outra requisição pode ter avançado a partida nesse meio-tempo.
          const [game] = await tx
            .select()
            .from(games)
            .where(
              and(
                eq(games.id, id),
                eq(games.status, 'active'),
                lt(games.lastProcessedAt, stillStaleBefore),
              ),
            )
            .for('update', { skipLocked: true });
          if (game === undefined) {
            return null;
          }
          const advanced = advanceTo(game.state, gameTimeAt(game, now));
          await persistState(tx, game, advanced.state, advanced.events, now);
          return advanced.events.length;
        });
        if (events !== null) {
          report.advanced += 1;
          report.events += events;
          progressed += 1;
        }
      } catch {
        report.failed += 1;
        failedIds.push(id);
      }
    }
    // Nada avançou neste lote (tudo travado por outros, ou já em dia): a rodada terminou.
    if (candidates.length < BATCH_SIZE || progressed === 0) {
      break;
    }
  }
  return report;
}
