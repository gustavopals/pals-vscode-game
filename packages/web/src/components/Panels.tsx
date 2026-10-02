import type { GameEvent, ViewState } from '@lotg/protocol';

import { capitalize } from '../ui/format';
import { moraleBurdened, moraleIcon, reserveNote, termAmount } from '../ui/morale';
import type { Actions } from './actions';
import { formatCountdown, formatDuration, formatNumber, formatSigned, remaining } from './format';
import { Explained, Icon } from './shared';

/**
 * A moral, termo a termo (GDD §5.7). A moral só muda na virada do dia, e por isso o painel
 * separa duas coisas: o que ela vale e faz agora (`text`) e a conta que a próxima virada vai
 * fazer (`terms`, que somam `next.value`), com o prazo. Depois vêm o conselho do servidor (o que
 * mais pesa e o que fazer, ou como ganhar o bônus da comida), a comida guardada e o que as
 * viradas fazem com o povo. O app não escreve peso, limite nem chance: só dispõe o que veio.
 */
export function MoralePanel(props: {
  morale: ViewState['morale'];
  /** Segundos desde que a visão chegou, para a contagem regressiva local. */
  elapsed: number;
}) {
  const { morale, elapsed } = props;
  const burdened = moraleBurdened(morale);
  const reserve = reserveNote(morale);
  return (
    <section aria-labelledby="morale-title">
      <h2 id="morale-title">Moral</h2>
      <p class="morale-now">
        <Icon name={moraleIcon(morale.band)} /> {morale.text}
      </p>
      <p class="muted hint">
        {morale.nextText} Faltam{' '}
        <span class="num">{formatCountdown(remaining(morale.nextUpdateInSeconds, elapsed))}</span>.
      </p>
      <ul class="morale-terms" aria-label="A conta da próxima virada do dia">
        {morale.terms.map((term, index) => (
          <li key={`${term.id}:${index}`}>
            <span class={`num${term.amount < 0 ? ' negative' : ''}`}>
              {termAmount(term.amount, index)}
            </span>
            {/* O nome de um efeito passageiro vem em minúscula, pronto para o meio de uma frase. */}
            <span>{capitalize(term.label)}</span>
          </li>
        ))}
        <li class="morale-total">
          <span class="num">
            {/* A conta inteira em uma linha, com o limite que a segurou, quando segurou. */}
            <Explained why={morale.breakdown}>= {formatNumber(morale.next.value)}</Explained>
          </span>
          <span>{morale.next.bandLabel}, na próxima virada do dia</span>
        </li>
      </ul>
      {morale.effects.length > 0 ? (
        <p class="muted hint">
          Passageiro:{' '}
          {morale.effects
            .map(
              (effect) =>
                `${effect.label} (${formatSigned(effect.amount)}), por mais ` +
                formatDuration(remaining(effect.endsInSeconds, elapsed)),
            )
            .join('; ')}
          .
        </p>
      ) : null}
      {morale.advice !== null ? (
        // O que pesa leva o sinal de aviso; a dica de como ganhar um bônus, a lâmpada.
        <p class="morale-advice">
          <span class={burdened ? 'warning' : 'muted'}>
            <Icon name={burdened ? 'warning' : 'lightbulb'} />
          </span>{' '}
          {morale.advice}
        </p>
      ) : null}
      {reserve !== null ? <p class="muted hint">{reserve}</p> : null}
      {morale.notes.length > 0 ? (
        <ul class="morale-notes">
          {morale.notes.map((note) => (
            <li key={note}>{capitalize(note)}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

export function RecruitPanel(props: {
  recruitment: ViewState['recruitment'];
  population: ViewState['population'];
  /** Segundos desde que a visão chegou, para a contagem regressiva local. */
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { recruitment, population, disabled, actions } = props;
  const { inTraining, secondsToNextRecruit } = population;
  const cost = recruitment.cost
    .map((entry) => `${formatNumber(entry.amount)} ${entry.label.toLowerCase()}`)
    .join(' e ');
  const blocked = recruitment.blockedReason !== null || recruitment.maxQuantity < 1;
  return (
    <section aria-labelledby="recruit-title">
      <h2 id="recruit-title">Recrutar</h2>
      <p class="muted hint">
        Cada aldeão custa {cost} e leva {formatDuration(recruitment.secondsPerVillager)}.
        {/* Por que o prazo é esse nesta estação, quando ela mexe nele. */}
        {recruitment.durationNote !== null ? ` ${recruitment.durationNote}` : ''}
      </p>
      {/* O que chamar gente agora custa à moral, ao lado do custo em recursos. */}
      {recruitment.moraleNote !== null ? (
        <p class="hint recruit-morale">
          <Icon name="info" /> {recruitment.moraleNote}
        </p>
      ) : null}
      {inTraining > 0 ? (
        <p class="arrivals" role="status">
          {inTraining} a caminho.{' '}
          {secondsToNextRecruit === null ? (
            // Sem prazo com gente a caminho: a fome segura a fila (o servidor é quem diz).
            <span class="warning">A chegada está parada enquanto durar a fome.</span>
          ) : (
            <>
              {inTraining === 1 ? 'Chega em ' : 'O próximo chega em '}
              <strong class="num">
                {formatCountdown(remaining(secondsToNextRecruit, props.elapsed))}
              </strong>
              .
            </>
          )}
        </p>
      ) : null}
      <div class="row">
        <button
          type="button"
          disabled={disabled || blocked}
          onClick={() => actions.order('recruitVillagers', { quantity: 1 })}
        >
          Recrutar 1 aldeão
        </button>
        {recruitment.maxQuantity > 1 && recruitment.blockedReason === null ? (
          <button
            type="button"
            class="secondary"
            disabled={disabled}
            onClick={() => actions.order('recruitVillagers', { quantity: recruitment.maxQuantity })}
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

export function ChroniclePanel(props: { chronicle: GameEvent[]; actions: Actions }) {
  const lines = props.chronicle.slice(-10).reverse();
  return (
    <section aria-labelledby="chronicle-title">
      <div class="row">
        <h2 id="chronicle-title">Crônica</h2>
        <button type="button" class="link" onClick={() => props.actions.run('lords.openChronicle')}>
          Abrir a Crônica
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
