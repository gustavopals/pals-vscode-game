import type { ViewState } from '@lotg/protocol';

import { isNewBuilding, refundSentence, upgradeName } from '../ui/format';
import type { Actions } from './actions';
import { formatCountdown, formatDuration, formatNumber, remaining } from './format';

type Upgrade = ViewState['constructions']['available'][number];

/** Custos em "chips"; o que falta fica destacado, com texto, não só com cor. */
export function Cost(props: { cost: Upgrade['cost'] }) {
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

/**
 * Uma obra que pode ser ordenada: o nome, o prazo, o custo e, ao lado dele, o que a obra muda
 * (a capacidade de um depósito). Bloqueada, diz o motivo que veio do servidor, seja o Salão que
 * falta, o recurso que falta ou um custo que não cabe no depósito. O que ainda não existe é
 * "Construir"; o resto é "Melhorar".
 */
function UpgradeItem(props: { upgrade: Upgrade; disabled: boolean; actions: Actions }) {
  const { upgrade, disabled, actions } = props;
  const blocked = upgrade.blockedReason !== null;
  const fresh = isNewBuilding(upgrade);
  const verb = fresh ? 'Construir' : 'Melhorar';
  return (
    <li class="upgrade">
      <span class="upgrade-name">
        {fresh ? upgrade.label : upgradeName(upgrade)}
        <span class="muted"> · {formatDuration(upgrade.durationSeconds)}</span>
      </span>
      <Cost cost={upgrade.cost} />
      {upgrade.effect !== null ? <span class="upgrade-effect">{upgrade.effect}</span> : null}
      <span class="upgrade-actions">
        <button
          type="button"
          disabled={disabled || blocked}
          aria-label={`${verb} ${upgrade.label}`}
          onClick={() => actions.order('startConstruction', { building: upgrade.building })}
        >
          {verb}
        </button>
        {upgrade.planned ? null : (
          <button
            type="button"
            class="link"
            disabled={disabled}
            aria-label={`Planejar ${upgrade.label}`}
            onClick={() => actions.order('planConstruction', { building: upgrade.building })}
          >
            Planejar
          </button>
        )}
      </span>
      {blocked ? <span class="blocked">{upgrade.blockedReason}</span> : null}
    </li>
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
  // O que já existe se melhora; o que ainda não existe se constrói (Celeiro e Armazém nascem no
  // nível 0). Cada grupo tem o seu título, e o botão diz o verbo certo.
  const upgrades = available.filter((upgrade) => !isNewBuilding(upgrade));
  const fresh = available.filter(isNewBuilding);

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
              title={refundSentence(active.refund, 'Devolve', 'sentence')}
              onClick={() => actions.order('cancelConstruction', { building: active.building })}
            >
              Cancelar
            </button>
          </div>
          <progress max={100} value={progress} aria-label={`Obra ${progress}% concluída`} />
          {/* O que volta e, com o depósito perto do limite, o que se perderia: antes do clique. */}
          <p class="muted hint">{refundSentence(active.refund, 'Cancelar devolve', 'sentence')}</p>
        </div>
      )}

      {planned.length > 0 ? (
        <>
          <h3>Planejadas</h3>
          <ul class="upgrades">
            {planned.map((plan) => (
              <li key={plan.building} class="upgrade">
                <span class="upgrade-name">{upgradeName(plan)}</span>
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

      {durationNotes.map((note) => (
        <p key={note} class="muted hint construction-note">
          {note}
        </p>
      ))}
      {upgrades.length > 0 ? (
        <>
          <h3>Melhorar</h3>
          <ul class="upgrades">
            {upgrades.map((upgrade) => (
              <UpgradeItem
                key={upgrade.building}
                upgrade={upgrade}
                disabled={disabled}
                actions={actions}
              />
            ))}
          </ul>
        </>
      ) : null}
      {fresh.length > 0 ? (
        <>
          <h3>Construir</h3>
          <ul class="upgrades">
            {fresh.map((upgrade) => (
              <UpgradeItem
                key={upgrade.building}
                upgrade={upgrade}
                disabled={disabled}
                actions={actions}
              />
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
