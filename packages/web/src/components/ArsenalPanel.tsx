import type { ViewState } from '@lotg/protocol';

import { armableHeroes, ARSENAL_ANCHOR, type Item, ITEM_ICON, itemLine } from '../ui/expeditions';
import type { Actions } from './actions';
import { Icon } from './shared';

/**
 * Um item sem dono (GDD §9.1): o nome, o espaço e a raridade em uma linha; embaixo, o que ele
 * soma, na frase do servidor, e a frase de crônica dele. "Equipar" pergunta quem o leva, pelo
 * comando `lords.equipItem`; com um herói só no feudo, é ele.
 */
function ArsenalItem(props: { item: Item; disabled: boolean; actions: Actions }) {
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
          aria-describedby={about}
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
 * frase do servidor que diz quantos cabem. Sem a Guilda dos Aventureiros e sem item, o painel
 * não aparece: não há de onde eles venham.
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
      {guild.inventory.length === 0 ? null : (
        <ul class="heroes" aria-label="Itens do arsenal">
          {guild.inventory.map((item) => (
            <ArsenalItem
              key={item.id}
              item={item}
              disabled={props.disabled || nobody}
              actions={props.actions}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
