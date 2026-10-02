import { advanceTo } from '@lotg/engine';
import { and, eq, lt, notInArray } from 'drizzle-orm';

import type { AppContext } from '../context';
import { games } from '../db/schema';
import { gameTimeAt, loadGame, persistState } from '../games/repository';
import { safeError } from '../safe-error';

const BATCH_SIZE = 100;
const BUDGET_MS = 20_000;

/** A causa de uma falha, no que pode ir para o log: nome e mensagem, já sem dados de partida. */
export type FailureCause = { name: string; message: string; code?: string };

export type AdvanceReport = {
  advanced: number;
  events: number;
  failed: number;
  /** Só existe quando `failed > 0`: a causa da primeira falha da rodada. */
  firstFailure?: FailureCause;
};

/** `safeError` sem a pilha: a causa cabe no relatório da rodada. */
export function failureCause(error: unknown): FailureCause {
  const { name, message, code } = safeError(error);
  return { name, message, ...(code !== undefined ? { code } : {}) };
}

/**
 * Avança as partidas ativas sem estado persistido há mais de `ADVANCE_STALE_AFTER_MS`, em lotes
 * de 100. Cada partida tem a própria transação, com `FOR UPDATE SKIP LOCKED`: a que alguém está
 * lendo ou comandando agora fica para a próxima rodada, e a que der erro é pulada sem impedir as
 * outras. Sempre escreve, para `last_processed_at` andar. Garante que eventos e Crônica existam
 * para quem sumiu (GDD §14.9).
 *
 * É também o job que migra o estado de quem não voltou: a linha travada passa por `loadGame`
 * e a escrita do avanço grava a versão nova. Um estado que o motor não sabe ler (versão mais
 * nova, forma inesperada) conta como falha e fica intocado.
 *
 * Uma partida que falha nunca é escrita, então `last_processed_at` não anda e ela fica para
 * sempre na cabeça da fila. Por isso a rodada segue enquanto o lote trouxer avanço **ou falha
 * nova**: as que falharam saem das consultas seguintes, e as partidas boas que vêm depois de
 * lotes inteiros de ilegíveis (o banco de depois de uma reversão de imagem) são alcançadas.
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
    let failedNow = 0;
    for (const { id } of candidates) {
      try {
        const events = await ctx.db.transaction(async (tx) => {
          const now = ctx.clock();
          const stillStaleBefore = new Date(now.getTime() - ctx.config.advanceStaleAfterMs);
          // Revalida sob o lock: outra requisição pode ter avançado a partida nesse meio-tempo.
          const [row] = await tx
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
          if (row === undefined) {
            return null;
          }
          const game = loadGame(row);
          const advanced = advanceTo(game.state, gameTimeAt(game, now));
          await persistState(tx, game, advanced.state, advanced.events, now);
          return advanced.events.length;
        });
        if (events !== null) {
          report.advanced += 1;
          report.events += events;
          progressed += 1;
        }
      } catch (error) {
        report.failed += 1;
        failedNow += 1;
        failedIds.push(id);
        // Só a primeira causa: depois de uma reversão de imagem todas falham pelo mesmo motivo.
        report.firstFailure ??= failureCause(error);
      }
    }
    // Lote incompleto: a fila acabou. Lote sem avanço nem falha nova (tudo travado por outros,
    // ou já em dia): a próxima consulta traria as mesmas linhas.
    if (candidates.length < BATCH_SIZE || (progressed === 0 && failedNow === 0)) {
      break;
    }
  }
  return report;
}
