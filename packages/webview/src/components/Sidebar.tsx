import type { GameEvent, ViewState } from '@lotg/protocol';

import { order, type Send } from '../bridge';
import { formatDuration, formatNumber } from '../format';

export function RecruitPanel(props: {
  recruitment: ViewState['recruitment'];
  population: ViewState['population'];
  disabled: boolean;
  send: Send;
}) {
  const { recruitment, population, disabled, send } = props;
  const cost = recruitment.cost
    .map((entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`)
    .join(' e ');
  const blocked = recruitment.blockedReason !== null || recruitment.maxQuantity < 1;
  return (
    <section aria-labelledby="recruit-title">
      <h2 id="recruit-title">Recrutar</h2>
      <p class="muted hint">
        Cada aldeão custa {cost} e leva {formatDuration(recruitment.secondsPerVillager)}.
        {population.inTraining > 0 ? ` ${population.inTraining} a caminho.` : ''}
      </p>
      <div class="row">
        <button
          type="button"
          disabled={disabled || blocked}
          onClick={() => send(order('recruitVillagers', { quantity: 1 }))}
        >
          Recrutar 1 aldeão
        </button>
        {recruitment.maxQuantity > 1 && recruitment.blockedReason === null ? (
          <button
            type="button"
            class="secondary"
            disabled={disabled}
            onClick={() => send(order('recruitVillagers', { quantity: recruitment.maxQuantity }))}
          >
            Recrutar {recruitment.maxQuantity}
          </button>
        ) : null}
      </div>
      {recruitment.blockedReason !== null ? (
        <p class="blocked">{recruitment.blockedReason}</p>
      ) : null}
    </section>
  );
}

export function ObjectivesPanel(props: { objectives: ViewState['objectives'] }) {
  return (
    <section aria-labelledby="objectives-title">
      <h2 id="objectives-title">Objetivos</h2>
      {props.objectives.length === 0 ? (
        <p class="muted">Nenhum objetivo por agora.</p>
      ) : (
        <ul class="objectives">
          {props.objectives.map((objective) => {
            const done = objective.status === 'completed';
            return (
              <li key={objective.id} class={done ? 'objective objective-done' : 'objective'}>
                <span aria-hidden="true">{done ? '☑' : '☐'}</span>
                <span>
                  <span class="sr-only">{done ? 'Cumprido: ' : 'Em aberto: '}</span>
                  {objective.title}
                  {done ? null : (
                    <span class="muted">
                      {' '}
                      ({objective.progress.current}/{objective.progress.target})
                    </span>
                  )}
                  <span class="objective-why">
                    {objective.hint} Recompensa: {objective.reward}.
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export function ChroniclePanel(props: { chronicle: GameEvent[]; send: Send }) {
  const lines = props.chronicle.slice(-10).reverse();
  return (
    <section aria-labelledby="chronicle-title">
      <div class="row">
        <h2 id="chronicle-title">Crônica</h2>
        <button
          type="button"
          class="link"
          onClick={() => props.send({ type: 'action', action: 'exportChronicle' })}
        >
          Abrir em Markdown
        </button>
      </div>
      {lines.length === 0 ? (
        <p class="muted">Ainda não há nada a contar.</p>
      ) : (
        <ol class="chronicle" reversed>
          {lines.map((event) => (
            <li key={event.seq}>{event.text}</li>
          ))}
        </ol>
      )}
    </section>
  );
}
