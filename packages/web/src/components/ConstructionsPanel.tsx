import type { ViewState } from '@lotg/protocol';

import { capitalize, isNewBuilding, planWaiting, refundSentence, upgradeName } from '../ui/format';
import type { Actions } from './actions';
import { formatCountdown, formatDuration, formatNumber, remaining } from './format';
import { Icon } from './shared';

type Constructions = ViewState['constructions'];
type Upgrade = Constructions['available'][number];
type Queue = Constructions['queues'][number];
type Plan = Constructions['planned'][number];

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
            onClick={() =>
              actions.order('planConstruction', {
                building: upgrade.building,
                targetLevel: upgrade.targetLevel,
              })
            }
          >
            Planejar
          </button>
        )}
      </span>
      {blocked ? <span class="blocked">{upgrade.blockedReason}</span> : null}
    </li>
  );
}

/**
 * Uma fila de obras (GDD §6.3). Ocupada, mostra a obra, a contagem regressiva, o progresso e o
 * que o cancelamento devolve; livre, diz que os pedreiros dela estão livres. Com duas filas
 * abertas cada linha leva o número da sua.
 */
function QueueRow(props: {
  queue: Queue;
  /** "Fila 1", "Fila 2"; `null` enquanto o feudo tem uma fila só. */
  name: string | null;
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { queue, name, elapsed, disabled, actions } = props;
  const tag = name === null ? null : <span class="queue-label muted">{name}</span>;
  if (queue === null) {
    return (
      <li class="queue-free muted">
        {tag}
        Os pedreiros estão livres.
      </li>
    );
  }
  const left = remaining(queue.secondsRemaining, elapsed);
  const progress =
    queue.totalSeconds === 0
      ? 0
      : Math.min(100, Math.round(((queue.totalSeconds - left) * 100) / queue.totalSeconds));
  return (
    <li class="active-construction">
      <div class="row">
        <strong>
          {tag}
          {queue.label} → Nv{queue.targetLevel}
        </strong>
        <span class="num" aria-label={`Termina em ${formatCountdown(left)}`}>
          {formatCountdown(left)}
        </span>
        <button
          type="button"
          class="secondary"
          disabled={disabled}
          // Com duas obras em curso, cada botão diz qual delas cancela.
          aria-label={`Cancelar a obra: ${queue.label}`}
          title={refundSentence(queue.refund, 'Devolve', 'sentence')}
          onClick={() => actions.order('cancelConstruction', { building: queue.building })}
        >
          Cancelar
        </button>
      </div>
      <progress
        max={100}
        value={progress}
        aria-label={`Obra de ${queue.label}: ${progress}% concluída`}
      />
      {/* O que volta e, com o depósito perto do limite, o que se perderia: antes do clique. */}
      <p class="muted hint">{refundSentence(queue.refund, 'Cancelar devolve', 'sentence')}</p>
    </li>
  );
}

/**
 * Uma obra planejada: o orçamento, a marca "Iniciar quando houver recursos" e o que a obra
 * espera, com o prazo quando há um. A frase da espera e o prazo vêm do servidor. A marca só
 * muda na tela quando o servidor confirma: o clique manda a ordem e não mexe na caixa.
 */
function PlannedItem(props: { plan: Plan; elapsed: number; disabled: boolean; actions: Actions }) {
  const { plan, elapsed, disabled, actions } = props;
  const ready = plan.waiting === null;
  return (
    <li class="upgrade plan">
      <span class="upgrade-name">
        {upgradeName(plan)}
        <span class="muted"> · {formatDuration(plan.durationSeconds)}</span>
      </span>
      <Cost cost={plan.cost} />
      <span class="upgrade-actions">
        {ready ? (
          <button
            type="button"
            disabled={disabled}
            aria-label={`Iniciar agora: ${plan.label}`}
            onClick={() => actions.order('startConstruction', { building: plan.building })}
          >
            Iniciar agora
          </button>
        ) : null}
        <button
          type="button"
          class="link"
          disabled={disabled}
          aria-label={`Tirar da lista: ${plan.label}`}
          onClick={() => actions.order('unplanConstruction', { building: plan.building })}
        >
          Tirar da lista
        </button>
      </span>
      <label class="plan-auto">
        <input
          type="checkbox"
          checked={plan.autoStart}
          disabled={disabled}
          aria-label={`Iniciar quando houver recursos: ${plan.label}`}
          onClick={(event) => {
            event.preventDefault();
            actions.order('setAutoStart', {
              building: plan.building,
              autoStart: !plan.autoStart,
              targetLevel: plan.targetLevel,
            });
          }}
        />
        Iniciar quando houver recursos
      </label>
      <span class="plan-waiting">
        <Icon name={ready ? 'check' : 'watch'} /> {capitalize(planWaiting(plan, elapsed))}.
      </span>
    </li>
  );
}

export function ConstructionsPanel(props: {
  constructions: Constructions;
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { constructions, elapsed, disabled, actions } = props;
  const { queues, queuesNote, planned, available } = constructions;
  // Por que os prazos são esses nesta estação: a frase vale para todas as obras, e é dita uma vez.
  const durationNotes = [...new Set(available.flatMap((upgrade) => upgrade.durationNote ?? []))];
  // O que já existe se melhora; o que ainda não existe se constrói (Celeiro e Armazém nascem no
  // nível 0). Cada grupo tem o seu título, e o botão diz o verbo certo.
  const upgrades = available.filter((upgrade) => !isNewBuilding(upgrade));
  const fresh = available.filter(isNewBuilding);

  return (
    <section aria-labelledby="constructions-title">
      <h2 id="constructions-title">Construções</h2>
      {/*
       * Uma linha por fila aberta. A fila que ainda não abriu aparece com o motivo que o servidor
       * dá, nunca como um botão morto.
       */}
      <ul class="queues" aria-label="Filas de obras">
        {queues.map((queue, index) => (
          <QueueRow
            key={index}
            queue={queue}
            name={queues.length > 1 ? `Fila ${index + 1}` : null}
            elapsed={elapsed}
            disabled={disabled}
            actions={actions}
          />
        ))}
        {queuesNote === null ? null : (
          <li class="queue-locked muted">
            <Icon name="lock" /> {queuesNote}
          </li>
        )}
      </ul>

      {planned.length > 0 ? (
        <>
          <h3 id="planned-title">Planejadas</h3>
          <p class="muted hint">
            As marcadas começam sozinhas, na ordem da lista, assim que houver recursos e pedreiros
            livres. Uma que não pode começar não segura as seguintes.
          </p>
          <ol class="upgrades" aria-labelledby="planned-title">
            {planned.map((plan) => (
              <PlannedItem
                key={plan.building}
                plan={plan}
                elapsed={elapsed}
                disabled={disabled}
                actions={actions}
              />
            ))}
          </ol>
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
