import type { GameEvent, ReturnReport, ViewState } from '@lotg/protocol';

/** O Relatório de Retorno aparece depois de 4 horas ou mais de ausência (GDD §2.3). */
export const RETURN_REPORT_AFTER_MS = 4 * 60 * 60 * 1000;

export function shouldShowReturnReport(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt !== null && now - lastSeenAt >= RETURN_REPORT_AFTER_MS;
}

/**
 * Resume o que aconteceu na ausência: quanto cada estoque mudou entre a última visita e agora
 * e o que os eventos contam. Só soma e conta o que o servidor mandou; nenhuma regra de jogo.
 *
 * Sem a visão da última visita (`before` nula: o cache era de outra versão do app), o relatório
 * sai sem as linhas de estoque. Repetir o estoque de agora como "antes" diria que nada mudou.
 */
export function buildReturnReport(
  before: ViewState | null,
  after: ViewState,
  events: GameEvent[],
  awayMs: number,
): ReturnReport {
  const count = (type: GameEvent['type']) => events.filter((event) => event.type === type).length;
  const started = count('famineStarted') > 0;
  const ended = count('famineEnded') > 0;
  let famine: ReturnReport['famine'] = 'none';
  if (after.famine !== null) {
    famine = started ? 'started' : 'ongoing';
  } else if (ended) {
    famine = 'ended';
  }
  return {
    awaySeconds: Math.max(0, Math.floor(awayMs / 1000)),
    resources:
      before === null
        ? []
        : after.resources.map((row) => {
            const previous =
              before.resources.find((entry) => entry.id === row.id)?.stock ?? row.stock;
            return {
              id: row.id,
              label: row.label,
              before: previous,
              after: row.stock,
              delta: row.stock - previous,
            };
          }),
    counts: {
      daysPassed: count('dayStarted'),
      constructionsFinished: count('constructionFinished'),
      villagersArrived: count('recruitmentFinished'),
      objectivesCompleted: count('objectiveCompleted'),
    },
    famine,
    // A virada de dia só entra como número: a lista é do que vale a pena ler.
    highlights: events.filter((event) => event.type !== 'dayStarted').map((event) => event.text),
  };
}
