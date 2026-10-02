import type { ViewState } from '@lotg/protocol';

import { runsOutIn } from '../ui/format';
import { formatApprox, formatNumber, formatSigned } from './format';
import { Explained } from './shared';

type Row = ViewState['resources'][number];

/** Para onde o estoque vai, por extenso: a cor só reforça o que o texto já diz. */
function Trend(props: { view: ViewState; row: Row }) {
  const { view, row } = props;
  const runsOut = runsOutIn(view, row);
  if (runsOut !== null) {
    return <span class="warning">acaba em {formatApprox(runsOut)}</span>;
  }
  if (row.perHour > 0) {
    return <span class="muted">crescendo</span>;
  }
  if (row.perHour < 0) {
    // Caindo sem prazo para acabar: ou já acabou (fome, frio), ou a queda para antes do fim
    // (a lareira apaga quando a estação vira).
    return row.stock === 0 ? (
      <span class="warning">em falta</span>
    ) : (
      <span class="muted">caindo</span>
    );
  }
  return <span class="muted">estável</span>;
}

export function ResourcesTable(props: { view: ViewState }) {
  const { view } = props;
  return (
    <section aria-labelledby="resources-title">
      <h2 id="resources-title">Recursos</h2>
      {/* Leitores de tela anunciam as mudanças sem interromper o que estão lendo. */}
      <table class="resources" aria-live="polite">
        <thead>
          <tr>
            <th scope="col">Recurso</th>
            <th scope="col" class="num">
              Estoque
            </th>
            <th scope="col" class="num">
              Cap
            </th>
            <th scope="col" class="num">
              Por hora
            </th>
            <th scope="col">Tendência</th>
          </tr>
        </thead>
        <tbody>
          {view.resources.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td class="num">{formatNumber(row.stock)}</td>
              <td class="num">{row.cap === null ? '—' : formatNumber(row.cap)}</td>
              <td class={`num ${row.perHour < 0 ? 'negative' : ''}`}>
                <Explained why={row.breakdown}>{formatSigned(row.perHour)}</Explained>
              </td>
              <td>
                <Trend view={view} row={row} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
