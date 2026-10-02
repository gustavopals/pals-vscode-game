import type { ViewState } from '@lotg/protocol';

import type { Actions } from './actions';
import { formatCountdown, formatDuration, formatNumber, remaining } from './format';

type Upgrade = ViewState['constructions']['available'][number];

/** Custos em "chips"; o que falta fica destacado, com texto, não só com cor. */
function Cost(props: { cost: Upgrade['cost'] }) {
  return (
    <span class="chips">
      {props.cost.map((entry) => (
        <span key={entry.resource} class={entry.missing > 0 ? 'chip chip-missing' : 'chip'}>
          {formatNumber(entry.amount)} {entry.label.toLowerCase()}
          {entry.missing > 0 ? ` (faltam ${formatNumber(entry.missing)})` : ''}
        </span>
      ))}
    </span>
  );
}

export function ConstructionsPanel(props: {
  constructions: ViewState['constructions'];
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { constructions, elapsed, disabled, actions } = props;
  const { active, planned, available } = constructions;
  const left = active === null ? 0 : remaining(active.secondsRemaining, elapsed);
  // Por que os prazos são esses nesta estação: a frase vale para todas as obras, e é dita uma vez.
  const durationNotes = [...new Set(available.flatMap((upgrade) => upgrade.durationNote ?? []))];
  const progress =
    active === null || active.totalSeconds === 0
      ? 0
      : Math.min(100, Math.round(((active.totalSeconds - left) * 100) / active.totalSeconds));

  return (
    <section aria-labelledby="constructions-title">
      <h2 id="constructions-title">Construções</h2>
      {active === null ? (
        <p class="muted">Os pedreiros estão livres.</p>
      ) : (
        <div class="active-construction">
          <div class="row">
            <strong>
              {active.label} → Nv{active.targetLevel}
            </strong>
            <span class="num" aria-label={`Termina em ${formatCountdown(left)}`}>
              {formatCountdown(left)}
            </span>
            <button
              type="button"
              class="secondary"
              disabled={disabled}
              title={`Devolve ${active.refund.map((entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`).join(' e ')}`}
              onClick={() => actions.order('cancelConstruction', { building: active.building })}
            >
              Cancelar
            </button>
          </div>
          <progress max={100} value={progress} aria-label={`Obra ${progress}% concluída`} />
          <p class="muted hint">
            Cancelar devolve{' '}
            {active.refund
              .map((entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`)
              .join(' e ')}
            .
          </p>
        </div>
      )}

      {planned.length > 0 ? (
        <>
          <h3>Planejadas</h3>
          <ul class="upgrades">
            {planned.map((plan) => (
              <li key={plan.building} class="upgrade">
                <span class="upgrade-name">
                  {plan.label} Nv{plan.fromLevel} → Nv{plan.targetLevel}
                </span>
                <Cost cost={plan.cost} />
                <button
                  type="button"
                  class="link"
                  disabled={disabled}
                  aria-label={`Tirar da lista: ${plan.label}`}
                  onClick={() => actions.order('unplanConstruction', { building: plan.building })}
                >
                  Tirar da lista
                </button>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      <h3>Disponíveis</h3>
      {durationNotes.map((note) => (
        <p key={note} class="muted hint">
          {note}
        </p>
      ))}
      <ul class="upgrades">
        {available.map((upgrade) => {
          const blocked = upgrade.blockedReason !== null;
          return (
            <li key={upgrade.building} class="upgrade">
              <span class="upgrade-name">
                {upgrade.label} Nv{upgrade.fromLevel} → Nv{upgrade.targetLevel}
                <span class="muted"> · {formatDuration(upgrade.durationSeconds)}</span>
              </span>
              <Cost cost={upgrade.cost} />
              <span class="upgrade-actions">
                <button
                  type="button"
                  disabled={disabled || blocked}
                  aria-label={`Melhorar ${upgrade.label}`}
                  onClick={() => actions.order('startConstruction', { building: upgrade.building })}
                >
                  Melhorar
                </button>
                {upgrade.planned ? null : (
                  <button
                    type="button"
                    class="link"
                    disabled={disabled}
                    aria-label={`Planejar ${upgrade.label}`}
                    onClick={() =>
                      actions.order('planConstruction', { building: upgrade.building })
                    }
                  >
                    Planejar
                  </button>
                )}
              </span>
              {blocked ? <span class="blocked">{upgrade.blockedReason}</span> : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
