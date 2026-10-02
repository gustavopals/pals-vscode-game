import type { Actions } from './actions';
import { Icon } from './shared';
import {
  cardDeadline,
  cardOverdue,
  type CouncilCard as Card,
  type CouncilOption,
  expiresSoon,
  isDefaultOption,
  optionBlock,
} from '../ui/council';
import { capitalize } from '../ui/format';

/** Um id de elemento a partir do `instanceId` da carta, para ligar rótulos e descrições. */
const elementId = (instanceId: string, suffix: string) =>
  `card-${instanceId.replace(/[^A-Za-z0-9_-]/g, '-')}-${suffix}`;

/**
 * Uma opção da carta: o botão com o verbo e, logo abaixo, o que ele custa e a consequência
 * conhecida (na frase do servidor), a pista do que pode vir depois e, se houver, o que impede a
 * escolha: o requisito que a tranca ou o que falta para pagá-la. A opção que o conselho aplica
 * sozinho, sem resposta, é dita por extenso. Nada é dito só por cor: cada estado tem ícone e
 * frase. O botão aponta para tudo isso (`aria-describedby`): quem chega a ele pelo teclado ouve
 * o preço antes de apertar `Enter`.
 */
function Option(props: { card: Card; option: CouncilOption; disabled: boolean; actions: Actions }) {
  const { card, option } = props;
  const block = optionBlock(option);
  const about = elementId(card.instanceId, `option-${option.id}`);
  return (
    <li class={block === null ? 'card-option' : 'card-option card-option-blocked'}>
      <button
        type="button"
        class="card-choice"
        disabled={props.disabled || block !== null}
        aria-describedby={about}
        onClick={() =>
          props.actions.run('lords.answerCard', {
            instanceId: card.instanceId,
            optionId: option.id,
          })
        }
      >
        {option.label}
      </button>
      <div id={about} class="card-option-about">
        <p class="card-effects">{option.effectsText}</p>
        {block === null ? null : (
          <p class="card-block warning">
            <Icon name={block.kind === 'locked' ? 'lock' : 'warning'} /> {block.text}
          </p>
        )}
        <p class="card-hint">
          <Icon name="quote" /> {option.hint}
        </p>
        {isDefaultOption(card, option) ? (
          <p class="card-auto muted">
            <Icon name="watch" /> Sem resposta, é isto que o conselho faz.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Uma carta do Conselho (GDD §7): o momento narrativo do jogo, para ler antes de decidir. O
 * título, de onde a história vem (quando é a continuação de outra carta), a situação, as opções
 * lado a lado e, ao pé, o prazo em tempo real e o que o conselho faz se ele acabar. Tudo o que é
 * regra vem pronto do servidor; aqui só se desenha.
 *
 * Cada botão manda a resposta pelo comando `lords.answerCard`, o mesmo da árvore e da paleta.
 * Enquanto a resposta não volta (`answering`), sem ligação (`readOnly`) e depois que o prazo
 * acabou no relógio desta página, os botões ficam desabilitados, e a carta diz por quê.
 */
export function CouncilCard(props: {
  card: Card;
  elapsed: number;
  /** Sem ligação com o servidor: a carta se lê, mas não se responde. */
  readOnly: boolean;
  /** A resposta desta carta está a caminho do servidor. */
  answering: boolean;
  actions: Actions;
}) {
  const { card, elapsed } = props;
  const overdue = cardOverdue(card, elapsed);
  const soon = !overdue && expiresSoon(card, elapsed);
  const title = elementId(card.instanceId, 'title');
  return (
    <article class="council-card" aria-labelledby={title} aria-busy={props.answering}>
      <p class="card-kicker">
        <span>
          <Icon name="mail" /> Carta do Conselho
        </span>
        <span class={soon || overdue ? 'card-deadline warning' : 'card-deadline'}>
          <Icon name={soon || overdue ? 'warning' : 'watch'} />{' '}
          {capitalize(cardDeadline(card, elapsed))}
        </span>
      </p>
      <h3 id={title} class="card-title">
        {card.title}
      </h3>
      {card.followsFrom === null ? null : (
        <p class="card-follows muted">
          <Icon name="history" /> {card.followsFrom.text}
        </p>
      )}
      <p class="card-text">{card.text}</p>
      <ul class="card-options" aria-label={`Opções de ${card.title}`}>
        {card.options.map((option) => (
          <Option
            key={option.id}
            card={card}
            option={option}
            disabled={props.readOnly || props.answering || overdue}
            actions={props.actions}
          />
        ))}
      </ul>
      {props.answering ? (
        <p class="card-foot" role="status">
          <Icon name="sync" /> Levando a sua decisão ao conselho…
        </p>
      ) : overdue ? (
        <p class="card-foot warning" role="status">
          <Icon name="warning" /> O prazo acabou: o conselho está decidindo sozinho, e a Crônica
          conta o que ele fizer.
        </p>
      ) : (
        <p class="card-foot muted">{card.expiryNote}</p>
      )}
    </article>
  );
}
