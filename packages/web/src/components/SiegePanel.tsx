import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useState } from 'preact/hooks';

import { formatDuration, remainingNow } from '../ui/format';
import {
  emergencyTerms,
  planFormation,
  SIEGE_ANCHOR,
  siegeSummary,
  waveDeadline,
  waveDecision,
  type Wave,
} from '../ui/siege';
import type { Actions } from './actions';
import { formatCountdown } from './format';
import { WallPanel } from './WallPanel';
import { Icon } from './shared';

function WavePlan(props: {
  view: ViewState;
  wave: Wave;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { view, wave } = props;
  const saved = view.siege?.plan[wave] ?? null;
  const [choice, setChoice] = useState<string | null>(saved);
  useLayoutEffect(() => setChoice(saved), [saved]);
  const formation = view.army.formations.find((entry) => entry.id === choice);
  const missing = choice !== null && formation === undefined;
  return (
    <div class="siege-wave-plan" aria-busy={props.busy}>
      <label for={`siege-plan-${wave}`}>Formação da onda {wave}</label>
      <select
        id={`siege-plan-${wave}`}
        data-testid={`siege-plan-${wave}`}
        value={choice ?? ''}
        disabled={props.disabled || props.busy}
        onChange={(event) => setChoice(event.currentTarget.value || null)}
      >
        <option value="">{planFormation(view, null)}</option>
        {view.army.formations.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      <p class={missing ? 'blocked' : 'muted'} id={`siege-plan-note-${wave}`}>
        {missing
          ? 'A formação escolhida não está mais disponível.'
          : formation?.shortfallText || planFormation(view, choice)}
      </p>
      <button
        type="button"
        class="secondary"
        disabled={props.disabled || props.busy || missing || choice === saved}
        aria-describedby={`siege-plan-note-${wave}`}
        onClick={() => props.actions.run('lords.setBattlePlan', { wave, formationId: choice })}
      >
        <Icon name="save" /> {props.busy ? 'Salvando…' : `Salvar onda ${wave}`}
      </button>
    </div>
  );
}

/** Só fatos públicos: plano, prazo real, ondas enfrentadas e resultado; nunca composição presumida. */
export function SiegePanel(props: {
  view: ViewState;
  elapsed: number;
  disabled: boolean;
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const siege = view.siege;
  if (siege === null) return null;
  const decision = waveDecision(view);
  const ended = siege.result !== null;
  const planning = !ended && siege.current === 0;
  const late = decision !== undefined && remainingNow(decision.expiresInSeconds, elapsed) <= 0;
  const icon = siege.result === 'fall' ? 'warning' : ended ? 'verified' : 'shield';
  return (
    <section
      class={`siege-panel${siege.result === 'fall' ? ' siege-fallen' : ''}`}
      aria-labelledby={SIEGE_ANCHOR}
      data-testid="siege-panel"
    >
      <div class="siege-heading">
        <div>
          <p class="siege-eyebrow">Ano {siege.year} · Inverno</p>
          <h2 id={SIEGE_ANCHOR} tabIndex={-1}>
            <Icon name="shield" /> Cerco do Inverno
          </h2>
        </div>
        <p class="siege-state">
          <Icon name={icon} /> {siegeSummary(view, elapsed)}
        </p>
      </div>
      {planning ? (
        <p class="hint">
          Prepare o Plano de Batalha por onda. Sem uma escolha, vale a Defesa ativa no instante da
          batalha. O plano vale também durante a sua ausência.
        </p>
      ) : null}
      {planning ? (
        <p class="siege-countdown">
          <Icon name="watch" /> Primeira onda em{' '}
          <strong>{formatCountdown(remainingNow(siege.scheduledInSeconds, elapsed))}</strong>
        </p>
      ) : null}
      {decision === undefined ? null : (
        <div
          class="siege-decision"
          aria-labelledby="siege-decision-title"
          data-testid="siege-decision"
          aria-busy={props.busy.has('siege:swap') || props.busy.has('wall')}
        >
          <div>
            <h3 id="siege-decision-title">
              <Icon name="git-compare" /> {decision.title} · onda {decision.wave}
            </h3>
            <p class="siege-countdown">
              {waveDeadline(decision, elapsed)} ·{' '}
              <strong>{formatCountdown(remainingNow(decision.expiresInSeconds, elapsed))}</strong>
            </p>
            <p>
              Formação marcada:{' '}
              <strong>{decision.options.find((option) => option.selected)?.label}</strong>. Sem nova
              ordem, o Plano vale.
            </p>
            {late ? (
              <p class="blocked">
                <Icon name="watch" /> O prazo acabou. Aguardando o relato da onda.
              </p>
            ) : null}
          </div>
          <div class="trade-review-actions">
            <button
              type="button"
              disabled={props.disabled || late || props.busy.has('siege:swap')}
              onClick={() => actions.run('lords.swapWaveFormation', { decisionId: decision.id })}
            >
              <Icon name="git-compare" />{' '}
              {props.busy.has('siege:swap') ? 'Trocando…' : 'Trocar formação…'}
            </button>
            <button
              type="button"
              class="secondary"
              disabled={
                props.disabled ||
                late ||
                props.busy.has('wall') ||
                !view.threat.defense.wall.repairOffer.canRepair
              }
              aria-describedby="siege-repair-terms"
              onClick={() => actions.run('lords.emergencyRepair')}
            >
              <Icon name="tools" /> Reparar agora…
            </button>
          </div>
          <p id="siege-repair-terms" class="muted">
            {view.threat.defense.wall.repairOffer.blockedText ??
              emergencyTerms(view.threat.defense.wall.repairOffer)}
          </p>
          <ul class="threat-wall-hp" aria-label="A vida da muralha, por ala">
            {Object.entries(view.threat.defense.wall.hpText).map(([wing, text]) => (
              <li key={wing}>{text}</li>
            ))}
          </ul>
        </div>
      )}
      <ol class="siege-waves" aria-label="O Cerco onda a onda">
        {siege.waves.map((wave) => {
          const fought = wave.number <= siege.current;
          const stopped = ended && !fought;
          const next = !ended && wave.number === siege.current + 1;
          return (
            <li
              key={wave.number}
              class={`siege-wave${next ? ' siege-wave-next' : ''}`}
              data-wave={wave.number}
              aria-current={next ? 'step' : undefined}
            >
              <div class="siege-wave-title">
                <span class="siege-wave-number">{wave.number}</span>
                <h3>{wave.title}</h3>
              </div>
              <p class="siege-wave-status">
                <Icon
                  name={
                    fought ? 'check' : stopped ? 'circle-slash' : next ? 'watch' : 'circle-outline'
                  }
                />{' '}
                {fought
                  ? 'Enfrentada'
                  : stopped
                    ? 'Não ocorreu'
                    : next
                      ? 'Próxima onda'
                      : 'À espera'}
              </p>
              {planning ? (
                <WavePlan
                  view={view}
                  wave={wave.number}
                  disabled={props.disabled || remainingNow(siege.scheduledInSeconds, elapsed) <= 0}
                  busy={props.busy.has(`siege:plan:${wave.number}`)}
                  actions={actions}
                />
              ) : (
                <p class="muted">Plano: {planFormation(view, siege.plan[wave.number])}</p>
              )}
              {wave.omens.length === 0 ? null : (
                <ul class="siege-omens">
                  {wave.omens.map((text, index) => (
                    <li key={index}>
                      <Icon name="eye" /> {text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ol>
      {ended ? (
        <div class="siege-aftermath" data-testid="siege-aftermath">
          <h3>
            <Icon name={icon} /> {siege.resultText} · Rescaldo
          </h3>
          <p>O feudo segue. Consulte a muralha, a moral e as obras para preparar o próximo ano.</p>
          {view.morale.effects.length === 0 ? null : (
            <details>
              <summary>Efeitos atuais na moral</summary>
              <ul>
                {view.morale.effects.map((effect, index) => (
                  <li key={index}>
                    {effect.label}: {effect.amount > 0 ? '+' : ''}
                    {effect.amount} · termina em{' '}
                    {formatDuration(remainingNow(effect.endsInSeconds, elapsed))}
                  </li>
                ))}
              </ul>
            </details>
          )}
          <div class="trade-review-actions">
            <button
              type="button"
              class="secondary"
              onClick={() => actions.run('lords.openPanel', 'constructions')}
            >
              <Icon name="tools" /> Ver as obras
            </button>
            <button
              type="button"
              class="secondary"
              onClick={() => actions.run('lords.openPanel', 'chronicle')}
            >
              <Icon name="book" /> Ler a Crônica
            </button>
          </div>
        </div>
      ) : null}
      {decision === undefined ? (
        <WallPanel
          defense={view.threat.defense}
          elapsed={elapsed}
          disabled={props.disabled || props.busy.has('wall')}
          actions={actions}
        />
      ) : null}
    </section>
  );
}
