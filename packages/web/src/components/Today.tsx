import type { ReturnReport } from '@lotg/protocol';

import type { Actions } from './actions';
import { formatAway, formatNumber, formatSigned } from './format';

const FAMINE_TEXT: Record<ReturnReport['famine'], string | null> = {
  none: null,
  started: 'A comida acabou enquanto você esteve fora: a fome começou.',
  ongoing: 'A fome continua. A produção segue reduzida até a comida voltar.',
  ended: 'Houve fome na sua ausência, mas ela já acabou.',
};

/** Aba "Hoje": o Relatório de Retorno e as decisões pendentes (GDD §2.3). */
export function Today(props: { report: ReturnReport | null; actions: Actions }) {
  const { report } = props;
  return (
    <div class="today">
      <section aria-labelledby="report-title">
        <h2 id="report-title">Relatório de Retorno</h2>
        {report === null ? (
          <p class="muted">
            Nada de novo desde a sua última visita. O relatório aparece quando você volta depois de
            quatro horas ou mais.
          </p>
        ) : (
          <>
            <p>
              Você esteve fora por <strong>{formatAway(report.awaySeconds)}</strong>. O mundo andou{' '}
              {report.counts.daysPassed}{' '}
              {report.counts.daysPassed === 1 ? 'dia de jogo' : 'dias de jogo'}.
            </p>
            {FAMINE_TEXT[report.famine] !== null ? (
              <p class="warning" role="status">
                {FAMINE_TEXT[report.famine]}
              </p>
            ) : null}
            <table class="resources">
              <thead>
                <tr>
                  <th scope="col">Recurso</th>
                  <th scope="col" class="num">
                    Antes
                  </th>
                  <th scope="col" class="num">
                    Agora
                  </th>
                  <th scope="col" class="num">
                    Mudança
                  </th>
                </tr>
              </thead>
              <tbody>
                {report.resources.map((row) => (
                  <tr key={row.id}>
                    <th scope="row">{row.label}</th>
                    <td class="num">{formatNumber(row.before)}</td>
                    <td class="num">{formatNumber(row.after)}</td>
                    <td class={`num ${row.delta < 0 ? 'negative' : ''}`}>
                      {formatSigned(row.delta)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p class="muted">
              Obras concluídas: {report.counts.constructionsFinished} · Aldeões que chegaram:{' '}
              {report.counts.villagersArrived} · Objetivos cumpridos:{' '}
              {report.counts.objectivesCompleted}
            </p>
            {report.highlights.length > 0 ? (
              <ul class="chronicle">
                {report.highlights.map((line, index) => (
                  <li key={index}>{line}</li>
                ))}
              </ul>
            ) : null}
            <button type="button" class="link" onClick={() => props.actions.run('lords.markRead')}>
              Marcar como lido
            </button>
          </>
        )}
      </section>
      <section aria-labelledby="decisions-title">
        <h2 id="decisions-title">Decisões pendentes</h2>
        <p class="muted">
          Nenhuma por agora. Cartas do Conselho e encruzilhadas de expedições aparecerão aqui nas
          próximas versões.
        </p>
      </section>
      <button
        type="button"
        class="primary"
        onClick={() => props.actions.run('lords.openPanel', 'fief')}
      >
        Ir para o feudo
      </button>
    </div>
  );
}
