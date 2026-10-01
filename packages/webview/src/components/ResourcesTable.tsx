import type { ViewState } from '@lotg/protocol';

import { formatApprox, formatNumber, formatSigned } from '../format';
import { Explained } from '../theme';

export function ResourcesTable(props: { resources: ViewState['resources'] }) {
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
          {props.resources.map((row) => (
            <tr key={row.id}>
              <th scope="row">{row.label}</th>
              <td class="num">{formatNumber(row.stock)}</td>
              <td class="num">{row.cap === null ? '—' : formatNumber(row.cap)}</td>
              <td class={`num ${row.perHour < 0 ? 'negative' : ''}`}>
                <Explained why={row.breakdown}>{formatSigned(row.perHour)}</Explained>
              </td>
              <td>
                {row.depletesInSeconds !== null ? (
                  <span class="warning">acaba em {formatApprox(row.depletesInSeconds)}</span>
                ) : row.perHour > 0 ? (
                  <span class="muted">crescendo</span>
                ) : (
                  <span class="muted">estável</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
