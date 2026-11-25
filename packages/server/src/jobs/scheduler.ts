import type { FastifyBaseLogger } from 'fastify';

import type { AppContext } from '../context';
import { safeError } from '../safe-error';
import { closeExpiredSeasons, type CloseSeasonsReport } from '../seasons/service';
import {
  type AdvanceReport,
  advanceStaleGames,
  FAILED_IDS_IN_REPORT,
  failureCause,
} from './advanceStaleGames';
import { purgeAccounts } from './purgeAccounts';

/** Chave do advisory lock dos jobs: só uma réplica da API executa cada rodada. */
const JOBS_LOCK = 7271;

export type JobsReport =
  | { ran: false }
  | {
      ran: true;
      advanced: number;
      events: number;
      /** Partidas ou etapas que falharam nesta rodada; as demais seguiram normalmente. */
      failed: number;
      closedSeasons: number;
      archivedSeasonGames: number;
      purgedAccounts: number;
      expiredSessions: number;
      /**
       * Só existe quando o avanço ou fecho de alguma partida falhou: a causa da primeira falha, já
       * sem dados de conta ou de partida. Sem ela, o log só diria quantas falharam.
       */
      firstFailure?: AdvanceReport['firstFailure'];
      /**
       * Os ids das primeiras partidas cujo avanço ou fecho falhou (até `FAILED_IDS_IN_REPORT`); a
       * contagem inteira está em `failed`. Só o UUID da partida.
       */
      failedGameIds?: AdvanceReport['failedGameIds'];
    };

/**
 * Uma rodada dos jobs. Tenta o advisory lock em uma conexão dedicada; sem o lock, outra réplica
 * já está rodando e esta sai em silêncio.
 */
export async function runJobsOnce(ctx: AppContext): Promise<JobsReport> {
  const client = await ctx.pool.connect();
  try {
    const { rows } = await client.query<{ locked: boolean }>(
      'select pg_try_advisory_lock($1) as locked',
      [JOBS_LOCK],
    );
    if (rows[0]?.locked !== true) {
      return { ran: false };
    }
    try {
      // As três etapas são independentes: uma falha no fecho de Temporada, no avanço ou no
      // expurgo não pode adiar as demais. O fecho vem antes do avanço para que partidas de
      // Temporadas vencidas sejam arquivadas até `ends_at` antes da fila de paradas.
      const closed = await closeExpiredSeasons(ctx).catch((error: unknown): CloseSeasonsReport => ({
        closedSeasons: 0,
        archivedGames: 0,
        events: 0,
        failed: 1,
        firstFailure: failureCause(error),
      }));
      const advance = await advanceStaleGames(ctx).catch((error: unknown): AdvanceReport => ({
        advanced: 0,
        events: 0,
        failed: 1,
        firstFailure: failureCause(error),
      }));
      const purge = await purgeAccounts(ctx).catch(() => null);
      const firstFailure = closed.firstFailure ?? advance.firstFailure;
      const mergedFailedIds = [
        ...(closed.failedGameIds ?? []),
        ...(advance.failedGameIds ?? []),
      ].slice(0, FAILED_IDS_IN_REPORT);
      return {
        ran: true,
        advanced: advance.advanced,
        events: closed.events + advance.events,
        failed: closed.failed + advance.failed + (purge === null ? 1 : 0),
        closedSeasons: closed.closedSeasons,
        archivedSeasonGames: closed.archivedGames,
        purgedAccounts: purge?.accounts ?? 0,
        expiredSessions: purge?.sessions ?? 0,
        ...(firstFailure !== undefined ? { firstFailure } : {}),
        ...(mergedFailedIds.length > 0 ? { failedGameIds: mergedFailedIds } : {}),
      };
    } finally {
      await client.query('select pg_advisory_unlock($1)', [JOBS_LOCK]);
    }
  } finally {
    client.release();
  }
}

/**
 * Agenda os jobs a cada `ADVANCE_JOB_INTERVAL_MS`. Não há temporizador por partida: se o processo
 * reiniciar, a próxima rodada (ou a próxima requisição) calcula exatamente o mesmo resultado.
 */
export function startScheduler(
  ctx: AppContext,
  log: FastifyBaseLogger,
): { stop: () => Promise<void> } {
  let running: Promise<void> | null = null;

  const tick = () => {
    if (running !== null) {
      return;
    }
    running = runJobsOnce(ctx)
      .then((report) => {
        // Contagens e, se uma partida falhou, a causa da primeira (`failureCause`) e os ids
        // das primeiras que falharam: nenhum outro dado de conta ou de partida vai para o log.
        if (report.ran && report.failed > 0) {
          log.error({ jobs: report }, 'jobs executados com falhas');
        } else if (report.ran) {
          log.info({ jobs: report }, 'jobs executados');
        }
      })
      .catch((error: unknown) => {
        log.error({ failure: safeError(error) }, 'falha nos jobs');
      })
      .finally(() => {
        running = null;
      });
  };

  // Roda uma vez logo no arranque: um processo que reinicia mais vezes que o intervalo ainda
  // assim avança partidas e expurga contas.
  tick();
  const timer = setInterval(tick, ctx.config.advanceJobIntervalMs);
  timer.unref();
  return {
    stop: async () => {
      clearInterval(timer);
      await running;
    },
  };
}
