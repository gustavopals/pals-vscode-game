import {
  CHRONICLE_HIDDEN_EVENT_TYPES,
  type GameEvent,
  type ReturnReport,
  type ViewState,
} from '@lotg/protocol';

/** O Relatório de Retorno aparece depois de 4 horas ou mais de ausência (GDD §2.3). */
export const RETURN_REPORT_AFTER_MS = 4 * 60 * 60 * 1000;

export function shouldShowReturnReport(lastSeenAt: number | null, now: number): boolean {
  return lastSeenAt !== null && now - lastSeenAt >= RETURN_REPORT_AFTER_MS;
}

/** O evento conta para a Crônica; os outros só servem de número ao relatório (ADRs 0007 e 0015). */
export function isChronicleEvent(event: GameEvent): boolean {
  return !(CHRONICLE_HIDDEN_EVENT_TYPES as readonly string[]).includes(event.type);
}

/** Uma casa decimal: as somas de totais fracionários não mostram ruído de ponto flutuante. */
const tidy = (value: number) => Math.round(value * 10) / 10;

/**
 * A soma de um total que os eventos trazem em `data`, em unidades: `spent_wood`, `gained_food`,
 * `wasted_stone`. Quem calcula é o motor; aqui só se soma o que veio.
 */
function total(events: GameEvent[], key: string): number {
  return tidy(
    events.reduce((sum, event) => {
      const value = event.data[key];
      return typeof value === 'number' ? sum + value : sum;
    }, 0),
  );
}

/**
 * Resume o que aconteceu na ausência: quanto cada estoque mudou entre a última visita e agora
 * e o que os eventos contam. Só soma e conta o que o servidor mandou; nenhuma regra de jogo.
 *
 * A variação de estoque não é produção: obras e recrutamento gastam, recompensas e devoluções
 * entram, e o que não coube no depósito nunca chegou ao estoque. Cada linha separa essas partes
 * pelos totais dos eventos da ausência:
 *
 * - `spent`: o que foi pago (`spent_<recurso>`);
 * - `received`: o que entrou por recompensa e devolução (`gained_<recurso>`);
 * - `wasted`: o que foi ao chão. Os fechos diários (`storageWasted`, um por dia de jogo, com
 *   unidades inteiras) mais o que a visão de agora ainda não relatou (`wastedToday`), menos o
 *   que a visão de antes já contava como perdido: o primeiro fecho da ausência inclui essa parte;
 * - `produced`: o saldo da produção e do consumo, que é a variação mais o gasto menos o recebido.
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
  const count = (...types: GameEvent['type'][]) =>
    events.filter((event) => types.includes(event.type)).length;
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
            const previous = before.resources.find((entry) => entry.id === row.id);
            const stockBefore = previous?.stock ?? row.stock;
            const delta = row.stock - stockBefore;
            const spent = total(events, `spent_${row.id}`);
            const received = total(events, `gained_${row.id}`);
            const wasted = Math.max(
              0,
              tidy(
                total(events, `wasted_${row.id}`) + row.wastedToday - (previous?.wastedToday ?? 0),
              ),
            );
            return {
              id: row.id,
              label: row.label,
              before: stockBefore,
              after: row.stock,
              delta,
              spent,
              received,
              wasted,
              produced: tidy(delta + spent - received),
            };
          }),
    counts: {
      daysPassed: count('dayStarted'),
      // Um edifício erguido do zero sai como `buildingFounded`, no lugar de `constructionFinished`.
      constructionsFinished: count('constructionFinished', 'buildingFounded'),
      villagersArrived: count('recruitmentFinished'),
      objectivesCompleted: count('objectiveCompleted'),
    },
    famine,
    // A lista é do que vale a pena ler: a virada de dia entra só como número, e o fecho diário
    // do desperdício, como total na linha de cada recurso (nunca uma linha por dia perdido).
    highlights: events.filter(isChronicleEvent).map((event) => event.text),
  };
}
