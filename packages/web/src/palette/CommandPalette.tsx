import { useEffect, useRef, useState } from 'preact/hooks';

import { type Dialogs, filterItems, moveSelection, type PickItem } from '../app/dialogs';
import { Icon } from '../components/shared';
import { type AppCommand, paletteItems } from './commands';

/**
 * A paleta abre com `F1` e com `Ctrl+K` (ou `Cmd+K`). `Ctrl+Shift+P` e `Ctrl+P` ficam de fora:
 * o navegador os reserva.
 */
export function isPaletteShortcut(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}): boolean {
  if (event.key === 'F1') {
    return !event.ctrlKey && !event.metaKey && !event.altKey;
  }
  return (
    event.key.toLowerCase() === 'k' &&
    (event.ctrlKey || event.metaKey) &&
    !event.shiftKey &&
    !event.altKey
  );
}

/** Abre a paleta com os comandos que fazem sentido agora e executa o escolhido. */
export async function openPalette(dialogs: Dialogs, commands: AppCommand[]): Promise<void> {
  const command = await dialogs.pick({
    title: 'Paleta de comandos',
    placeholder: 'Digite o nome de um comando',
    items: paletteItems(commands),
  });
  await command?.run();
}

/**
 * Lista de escolha com busca: é a paleta de comandos e também as listas dos comandos (edifícios,
 * obras, conflito de conta). Busca por texto, setas, `Enter` e `Esc`.
 */
export function QuickPick(props: {
  title: string;
  placeholder?: string | undefined;
  items: PickItem<unknown>[];
  /** Posição do item que já vem marcado. Digitar na busca volta a marcar o primeiro. */
  selected?: number | undefined;
  onPick: (value: unknown) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(props.selected ?? 0);
  const list = useRef<HTMLUListElement>(null);
  const matches = filterItems(props.items, query);
  const index = matches.length === 0 ? -1 : Math.min(Math.max(selected, 0), matches.length - 1);

  useEffect(() => {
    list.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }, [index, query]);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      const item = matches[index];
      if (item !== undefined) {
        props.onPick(item.value);
      }
      return;
    }
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp'].includes(event.key)) {
      event.preventDefault();
      setSelected(moveSelection(matches.length, index, event.key));
    }
  };

  return (
    <>
      <div class="quickpick-title" id="dialog-title">
        {props.title}
      </div>
      <input
        type="text"
        role="combobox"
        data-autofocus
        aria-labelledby="dialog-title"
        aria-expanded="true"
        aria-controls="quickpick-list"
        aria-autocomplete="list"
        aria-activedescendant={index >= 0 ? `quickpick-${index}` : undefined}
        placeholder={props.placeholder}
        autocomplete="off"
        spellcheck={false}
        value={query}
        onInput={(event) => {
          setQuery((event.target as HTMLInputElement).value);
          setSelected(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul
        class="quickpick-list"
        id="quickpick-list"
        role="listbox"
        aria-label={props.title}
        ref={list}
      >
        {matches.map((item, position) => (
          <li
            key={position}
            id={`quickpick-${position}`}
            role="option"
            class="quickpick-item"
            aria-selected={position === index}
            onMouseMove={() => setSelected(position)}
            onClick={() => props.onPick(item.value)}
          >
            {item.icon === undefined ? null : <Icon name={item.icon} />}
            <span>{item.label}</span>
            {item.description ? <span class="muted">{item.description}</span> : null}
            {item.detail ? <span class="quickpick-detail muted">{item.detail}</span> : null}
          </li>
        ))}
      </ul>
      {matches.length === 0 ? (
        <p class="quickpick-empty muted" role="status">
          Nada encontrado.
        </p>
      ) : null}
    </>
  );
}
