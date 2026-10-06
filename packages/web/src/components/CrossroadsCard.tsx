import {
  type Crossroads,
  type CrossroadsOption,
  CROSSROADS_ICON,
  crossroadsAnchor,
  crossroadsDeadline,
  crossroadsOverdue,
  crossroadsSoon,
  domId,
  type Expedition,
  isPostureOption,
  teamLine,
} from '../ui/expeditions';
import { capitalize } from '../ui/format';
import type { Actions } from './actions';
import { Icon } from './shared';

/**
 * Um caminho da encruzilhada: o botão com o nome e, logo abaixo, a pista (a voz de quem está
 * lá), o requisito que o tranca, quando há, e, na opção que a Postura toma sozinha, isso dito
 * por extenso. Nada é dito só pela cor: cada estado tem ícone e frase. O botão aponta para tudo
 * isso (`aria-describedby`): quem chega pelo teclado ouve a pista antes do `Enter`.
 */
function Path(props: {
  expedition: Expedition;
  crossroads: Crossroads;
  option: CrossroadsOption;
  disabled: boolean;
  actions: Actions;
}) {
  const { expedition, crossroads, option } = props;
  const about = domId('crossroads', expedition.id, `option-${option.id}`);
  return (
    <li class={option.locked ? 'card-option card-option-blocked' : 'card-option'}>
      <button
        type="button"
        class="card-choice"
        data-path={option.id}
        disabled={props.disabled || option.locked}
        aria-describedby={about}
        onClick={() =>
          props.actions.run('lords.chooseExpeditionPath', {
            expeditionId: expedition.id,
            optionId: option.id,
          })
        }
      >
        {option.label}
      </button>
      <div id={about} class="card-option-about">
        {option.locked ? (
          <p class="card-block warning">
            <Icon name="lock" /> {option.lockedReason ?? 'A equipe não pode tomar este caminho.'}
          </p>
        ) : null}
        <p class="card-hint">
          <Icon name="quote" /> {option.hint}
        </p>
        {isPostureOption(crossroads, option) ? (
          <p class="card-auto muted">
            <Icon name="watch" /> Sem resposta, é este o caminho da Postura{' '}
            {crossroads.postureLabel}.
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * A encruzilhada de uma expedição (GDD §9.2): a equipe parou e espera a palavra do senhor. A
 * folha é a mesma de uma carta do Conselho: de quem é e até quando espera, o título, a
 * situação, os caminhos lado a lado com a pista de cada um e, ao pé, o que a Postura faz se o
 * prazo acabar, na frase do servidor. O prazo é real, em qualquer ritmo: já vem assim da visão.
 *
 * Cada botão manda a escolha pelo comando `lords.chooseExpeditionPath`, o mesmo da árvore, do
 * aviso e da paleta. Enquanto a escolha não volta (`choosing`), sem ligação (`readOnly`) e
 * depois que o prazo acabou no relógio desta página, os botões ficam desabilitados, e a folha
 * diz por quê: nada é enviado depois do prazo.
 */
export function CrossroadsCard(props: {
  expedition: Expedition;
  elapsed: number;
  /** Sem ligação com o servidor: a encruzilhada se lê, mas não se responde. */
  readOnly: boolean;
  /** A escolha desta encruzilhada está a caminho do servidor. */
  choosing: boolean;
  actions: Actions;
}) {
  const { expedition, elapsed } = props;
  const { crossroads } = expedition;
  if (crossroads === null) {
    return null;
  }
  const overdue = crossroadsOverdue(crossroads, elapsed);
  const soon = !overdue && crossroadsSoon(crossroads, elapsed);
  const title = crossroadsAnchor(expedition.id);
  return (
    <article
      class="council-card crossroads-card"
      // Para quem procura a folha sem conhecer o título dela (que é frase do conteúdo).
      data-crossroads={expedition.id}
      aria-labelledby={title}
      aria-busy={props.choosing}
    >
      <p class="card-kicker">
        <span>
          <Icon name={CROSSROADS_ICON} /> Encruzilhada · {expedition.label}
        </span>
        <span class={soon || overdue ? 'card-deadline warning' : 'card-deadline'}>
          <Icon name={soon || overdue ? 'warning' : 'watch'} />{' '}
          {capitalize(crossroadsDeadline(crossroads, elapsed))}
        </span>
      </p>
      <h3 id={title} class="card-title" tabIndex={-1}>
        {crossroads.title}
      </h3>
      <p class="card-follows muted">
        <Icon name="person" /> {teamLine(expedition.teamNames)} · Postura {expedition.postureLabel}
      </p>
      <p class="card-text">{crossroads.text}</p>
      <ul class="card-options" aria-label={`Caminhos de ${crossroads.title}`}>
        {crossroads.options.map((option) => (
          <Path
            key={option.id}
            expedition={expedition}
            crossroads={crossroads}
            option={option}
            disabled={props.readOnly || props.choosing || overdue}
            actions={props.actions}
          />
        ))}
      </ul>
      {props.choosing ? (
        <p class="card-foot" role="status">
          <Icon name="sync" /> Levando a sua palavra à equipe…
        </p>
      ) : overdue ? (
        <p class="card-foot warning" role="status">
          <Icon name="warning" /> O prazo acabou: a Postura {crossroads.postureLabel} está
          decidindo, e a Crônica conta o caminho. Nada mais é enviado daqui.
        </p>
      ) : (
        <p class="card-foot muted">{crossroads.postureText}</p>
      )}
    </article>
  );
}
