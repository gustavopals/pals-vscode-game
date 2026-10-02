import type { FastifyBaseLogger } from 'fastify';

import type { AppContext } from '../context';
import { safeError } from '../safe-error';
import { type AdvanceReport, advanceStaleGames, failureCause } from './advanceStaleGames';
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
      purgedAccounts: number;
      expiredSessions: number;
      /**
       * Só existe quando o avanço de alguma partida falhou: a causa da primeira falha, já sem
       * dados de conta ou de partida. Sem ela, o log só diria quantas falharam.
       */
      firstFailure?: AdvanceReport['firstFailure'];
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
      // As duas etapas são independentes: uma falha no avanço não pode adiar o expurgo de uma
      // conta cujo prazo de sete dias já venceu, nem o contrário.
      const advance = await advanceStaleGames(ctx).catch((error: unknown): AdvanceReport => ({
        advanced: 0,
        events: 0,
        failed: 1,
        firstFailure: failureCause(error),
      }));
      const purge = await purgeAccounts(ctx).catch(() => null);
      return {
        ran: true,
        advanced: advance.advanced,
        events: advance.events,
        failed: advance.failed + (purge === null ? 1 : 0),
        purgedAccounts: purge?.accounts ?? 0,
        expiredSessions: purge?.sessions ?? 0,
        ...(advance.firstFailure !== undefined ? { firstFailure: advance.firstFailure } : {}),
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
        // Contagens e, se uma partida falhou, a causa da primeira (`failureCause`): nenhum
        // dado de conta ou de partida vai para o log.
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
