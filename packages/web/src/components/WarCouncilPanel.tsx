import type { ViewState } from '@lotg/protocol';

import type { Actions } from './actions';
import { formatNumber } from './format';
import { Icon } from './shared';

type Army = ViewState['army'];

/**
 * O Conselho de Guerra de uma formação salva (GDD §13.4): a prévia mais recente que o servidor
 * guardou, em percentual, o risco em uma frase e as perdas esperadas por posto. Nada é calculado
 * aqui: os números e as frases vêm da visão. "Simular" é uma ordem (trava `preview:<formação>`),
 * e a prévia de uma formação que mudou depois fica marcada como desatualizada.
 */
export function WarCouncilPanel(props: {
  army: Army;
  formationId: string | null;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { army, formationId } = props;
  const saved = army.formations.find((entry) => entry.id === formationId);
  const preview =
    army.preview !== null && army.preview.formationId === formationId ? army.preview : null;
  const working = formationId !== null && props.busy.has(`preview:${formationId}`);
  return (
    <section class="war-council" aria-labelledby="war-council-title" data-testid="war-council">
      <h3 id="war-council-title">Conselho de Guerra</h3>
      {saved === undefined ? (
        <p class="muted" data-testid="war-council-unsaved">
          Salve a formação para ouvir o Conselho de Guerra.
        </p>
      ) : (
        <div class="trade-review-actions">
          <button
            type="button"
            data-testid="war-simulate"
            disabled={props.disabled || working}
            aria-busy={working}
            onClick={() => props.actions.run('lords.simulateBattle', { id: saved.id })}
          >
            <Icon name="law" /> Simular
          </button>
        </div>
      )}
      {saved !== undefined && preview === null ? (
        <p class="muted" data-testid="war-council-empty">
          Nenhuma prévia desta formação ainda.
        </p>
      ) : null}
      {saved !== undefined && preview !== null ? (
        <div data-testid="war-preview">
          {saved.previewStale ? (
            <p class="blocked" data-testid="war-stale">
              <Icon name="warning" /> Prévia desatualizada: a formação mudou depois dela. Simule de
              novo.
            </p>
          ) : null}
          <dl class="war-odds">
            <div>
              <dt>Vitória</dt>
              <dd data-testid="war-wins">{formatNumber(preview.winsPercent)}%</dd>
            </div>
            <div>
              <dt>Gloriosa</dt>
              <dd data-testid="war-glorious">{formatNumber(preview.gloriousPercent)}%</dd>
            </div>
            <div>
              <dt>Derrota</dt>
              <dd data-testid="war-losses">{formatNumber(preview.lossesPercent)}%</dd>
            </div>
          </dl>
          <p data-testid="war-risk">{preview.riskText}</p>
          {preview.expectedLosses.length === 0 ? null : (
            <>
              <h4>Perdas esperadas</h4>
              <ul class="war-losses" data-testid="war-expected">
                {preview.expectedLosses.map((entry) => (
                  <li key={`${entry.wing}:${entry.line}`}>{entry.text}</li>
                ))}
              </ul>
            </>
          )}
          <p class="muted">Baseada em {formatNumber(preview.runs)} simulações.</p>
        </div>
      ) : null}
    </section>
  );
}
