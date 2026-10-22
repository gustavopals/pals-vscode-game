import type { ViewState } from '@lotg/protocol';

import type { Actions } from './actions';
import { formatNumber } from './format';
import { Icon } from './shared';

type Army = ViewState['army'];

/**
 * As formações salvas, na ordem em que foram criadas: a Defesa ativa marcada (com ícone e
 * texto), quantos soldados pedem, o que falta (`shortfallText`, da visão), e os botões de
 * editar, ativar e apagar. Apagar confirma na paleta (`lords.deleteFormation`).
 */
export function FormationList(props: {
  army: Army;
  editingId: string | null;
  disabled: boolean;
  busy: ReadonlySet<string>;
  onEdit: (id: string | null) => void;
  actions: Actions;
}) {
  const { army } = props;
  return (
    <section
      class="formation-list"
      aria-labelledby="formation-list-title"
      data-testid="formation-list"
    >
      <h3 id="formation-list-title">Formações salvas</h3>
      <div class="trade-review-actions">
        <button type="button" data-testid="formation-new" onClick={() => props.onEdit(null)}>
          Nova formação
        </button>
      </div>
      {army.formations.length === 0 ? (
        <p class="muted">Nenhuma formação salva. Monte uma no editor e salve.</p>
      ) : (
        <ul class="formation-saved">
          {army.formations.map((entry) => (
            <li key={entry.id} data-testid={`formation-${entry.id}`}>
              <p>
                <strong>{entry.name}</strong>
                {entry.isActive ? (
                  <span class="formation-active" data-testid="formation-active">
                    {' '}
                    <Icon name="shield" /> Defesa ativa
                  </span>
                ) : null}
                <span class="muted"> · {formatNumber(entry.total)} soldados</span>
              </p>
              <p class="muted" data-testid="formation-shortfall">
                {entry.shortfall.length === 0 ? 'Nada falta.' : entry.shortfallText}
              </p>
              <div class="trade-review-actions">
                <button
                  type="button"
                  data-testid="formation-edit"
                  aria-pressed={props.editingId === entry.id}
                  onClick={() => props.onEdit(entry.id)}
                >
                  Editar
                </button>
                <button
                  type="button"
                  data-testid="formation-set-active"
                  disabled={props.disabled || entry.isActive || props.busy.has('formation:active')}
                  onClick={() =>
                    props.actions.run('lords.setActiveFormation', { id: entry.id, confirmed: true })
                  }
                >
                  Ativar como Defesa
                </button>
                <button
                  type="button"
                  data-testid="formation-delete"
                  disabled={props.disabled || !entry.canDelete}
                  onClick={() => props.actions.run('lords.deleteFormation', { id: entry.id })}
                >
                  Apagar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
