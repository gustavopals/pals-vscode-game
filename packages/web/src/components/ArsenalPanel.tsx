import type { ViewState } from '@lotg/protocol';

import { armableHeroes, ARSENAL_ANCHOR, type Item, ITEM_ICON, itemLine } from '../ui/expeditions';
import type { Actions } from './actions';
import { Icon } from './shared';

/** O `id` da linha que diz por que ninguém pode ser equipado agora. */
const NOBODY = 'arsenal-nobody';

/**
 * Um item sem dono (GDD §9.1): o nome, o espaço e a raridade em uma linha; embaixo, o que ele
 * soma, na frase do servidor, e a frase de crônica dele. "Equipar" pergunta quem o leva, pelo
 * comando `lords.equipItem`; com um herói só no feudo, é ele.
 */
function ArsenalItem(props: {
  item: Item;
  disabled: boolean;
  /** O `id` do motivo que trava o botão, quando há um à vista no painel. */
  why: string | null;
  actions: Actions;
}) {
  const { item } = props;
  const about = `item-${item.id.replace(/[^A-Za-z0-9_-]/g, '-')}-about`;
  return (
    <li class="hero">
      <p class="hero-name">
        <Icon name={ITEM_ICON} /> <strong>{itemLine(item)}</strong>
      </p>
      <p id={about} class="hero-sheet muted">
        {item.bonusText}. {item.text}
      </p>
      <div class="hero-actions">
        <button
          type="button"
          disabled={props.disabled}
          aria-describedby={props.why === null ? about : `${about} ${props.why}`}
          onClick={() => props.actions.run('lords.equipItem', { itemId: item.id })}
        >
          Equipar<span class="sr-only"> {item.label}</span>
        </button>
      </div>
    </li>
  );
}

/**
 * O painel "Arsenal" da aba Guilda: os itens que as expedições trouxeram e ninguém leva, com a
 * frase do servidor que diz quantos cabem. Com item e ninguém no feudo, "Equipar" fica
 * desabilitado e o painel diz por quê. Sem a Guilda dos Aventureiros e sem item, o painel não
 * aparece: não há de onde eles venham.
 */
export function ArsenalPanel(props: { view: ViewState; disabled: boolean; actions: Actions }) {
  const { guild } = props.view;
  if (!guild.built && guild.inventory.length === 0) {
    return null;
  }
  const nobody = armableHeroes(guild).length === 0;
  return (
    <section aria-labelledby={ARSENAL_ANCHOR}>
      <h2 id={ARSENAL_ANCHOR} tabIndex={-1}>
        Arsenal
      </h2>
      <p class="muted hint">{guild.inventoryText}</p>
      {/* Ninguém no feudo para levar um item: o botão trava, e o painel diz por quê. */}
      {nobody && guild.inventory.length > 0 ? (
        <p id={NOBODY} class="blocked">
          <Icon name="lock" />{' '}
          {guild.heroes.length === 0
            ? guild.text
            : 'Nenhum herói está no feudo agora: quem está fora só troca de equipamento na volta.'}
        </p>
      ) : null}
      {guild.inventory.length === 0 ? null : (
        <ul class="heroes" aria-label="Itens do arsenal">
          {guild.inventory.map((item) => (
            <ArsenalItem
              key={item.id}
              item={item}
              disabled={props.disabled || nobody}
              why={nobody ? NOBODY : null}
              actions={props.actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
