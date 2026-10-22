import type { ViewState } from '@lotg/protocol';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import {
  type Draft,
  LINES,
  type Line,
  moveCell,
  postCount,
  savePayload,
  slotText,
  unitsOfLine,
  WINGS,
  type Wing,
  withCommander,
  withPost,
} from '../ui/formation';
import type { Actions } from './actions';
import { formatNumber } from './format';
import { Icon } from './shared';

type Army = ViewState['army'];

/**
 * O seletor de um posto: o tipo de soldado (só os da linha) e a quantidade, num diálogo modal. O
 * foco vai para o primeiro campo ao abrir (`useLayoutEffect`), fica preso dentro (`Tab`), `Esc`
 * desiste e o foco volta ao posto. O teto e quantos há vêm da visão.
 */
function PostDialog(props: {
  army: Army;
  wing: Wing;
  line: Line;
  current: Draft['posts'][Wing][Line];
  onApply: (slot: Draft['posts'][Wing][Line]) => void;
  onClose: () => void;
}) {
  const { army, line } = props;
  const options = unitsOfLine(army, line);
  const [unit, setUnit] = useState(props.current?.unit ?? options[0]?.id ?? 'spearman');
  const [amount, setAmount] = useState(props.current === null ? '' : String(props.current.count));
  const box = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLSelectElement>(null);
  useLayoutEffect(() => {
    first.current?.focus();
  }, []);
  const count = postCount(army, amount);
  const chosen = options.find((entry) => entry.id === unit);
  const apply = () => {
    if (count !== null && chosen !== undefined) {
      props.onApply({ unit: chosen.id, count });
    }
  };
  return (
    <div class="formation-modal">
      <div
        ref={box}
        class="formation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="post-dialog-title"
        data-testid="post-dialog"
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            event.stopPropagation();
            props.onClose();
            return;
          }
          if (event.key !== 'Tab' || box.current === null) {
            return;
          }
          const focusable = Array.from(
            box.current.querySelectorAll<HTMLElement>('button, select, input'),
          ).filter((element) => !(element as HTMLButtonElement).disabled);
          const head = focusable[0];
          const tail = focusable[focusable.length - 1];
          if (head === undefined || tail === undefined) {
            return;
          }
          if (event.shiftKey && document.activeElement === head) {
            event.preventDefault();
            tail.focus();
          } else if (!event.shiftKey && document.activeElement === tail) {
            event.preventDefault();
            head.focus();
          }
        }}
      >
        <h3 id="post-dialog-title">
          {army.editor.wingLabels[props.wing]} · {army.editor.lineLabels[line]}
        </h3>
        <div class="trade-amount">
          <label for="post-unit">Qual soldado</label>
          <select
            id="post-unit"
            ref={first}
            data-testid="post-unit"
            value={unit}
            onChange={(event) => setUnit(event.currentTarget.value as typeof unit)}
          >
            {options.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.label} ({formatNumber(entry.available)} no exército)
              </option>
            ))}
          </select>
        </div>
        <div class="trade-amount">
          <label for="post-amount">Quantos (de 1 a {formatNumber(army.editor.postMax)})</label>
          <input
            id="post-amount"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            data-testid="post-amount"
            value={amount}
            onInput={(event) => setAmount(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                apply();
              }
            }}
          />
        </div>
        <div class="trade-review-actions">
          <button
            type="button"
            data-testid="post-apply"
            disabled={count === null || chosen === undefined}
            onClick={apply}
          >
            Pôr no posto
          </button>
          <button type="button" data-testid="post-clear" onClick={() => props.onApply(null)}>
            Esvaziar o posto
          </button>
          <button type="button" data-testid="post-cancel" onClick={props.onClose}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * O editor de formação (GDD §13.4, sem a linha inimiga e sem a prévia): a grade de três alas por
 * duas linhas, o comandante de cada ala e "Salvar". O que está marcado é estado da tela; a ordem
 * só nasce em "Salvar" (e "Ativar como Defesa" é outra ordem, sobre a formação já salva).
 * Setas andam entre os postos e `Enter` abre o seletor; arrastar não existe.
 */
export function FormationEditor(props: {
  army: Army;
  draft: Draft;
  onChange: (draft: Draft) => void;
  disabled: boolean;
  busy: boolean;
  actions: Actions;
}) {
  const { army, draft } = props;
  const [cell, setCell] = useState({ wing: 0, line: 0 });
  const [editing, setEditing] = useState<{ wing: Wing; line: Line } | null>(null);
  const cells = useRef(new Map<string, HTMLButtonElement>());
  const returnTo = useRef<string | null>(null);
  useLayoutEffect(() => {
    // Ao fechar o seletor o foco volta ao posto de onde ele saiu.
    if (editing === null && returnTo.current !== null) {
      cells.current.get(returnTo.current)?.focus();
      returnTo.current = null;
    }
  }, [editing]);

  const isNew = draft.id === null;
  const blockedNew = isNew && !army.editor.canSaveNew;
  const name = draft.name.trim();
  const canSave = !props.disabled && !props.busy && !blockedNew && name !== '';
  const saved = army.formations.find((entry) => entry.id === draft.id);

  return (
    <section
      class="formation-editor"
      aria-labelledby="formation-editor-title"
      data-testid="formation-editor"
    >
      <h3 id="formation-editor-title">
        {isNew ? 'Nova formação' : `Editando: ${saved?.name ?? draft.name}`}
      </h3>
      <div class="trade-amount">
        <label for="formation-name">Nome da formação</label>
        <input
          id="formation-name"
          type="text"
          autoComplete="off"
          maxLength={200}
          data-testid="formation-name"
          value={draft.name}
          disabled={props.disabled}
          onInput={(event) => props.onChange({ ...draft, name: event.currentTarget.value })}
        />
      </div>
      <div
        role="grid"
        aria-label="Postos da formação: alas na horizontal, linhas na vertical"
        class="formation-grid"
        data-testid="formation-grid"
      >
        <div role="row" class="formation-row">
          <span role="presentation" class="formation-corner" />
          {WINGS.map((wing) => (
            <span key={wing} role="columnheader" class="formation-head">
              {army.editor.wingLabels[wing]}
            </span>
          ))}
        </div>
        {LINES.map((line, lineIndex) => (
          <div role="row" class="formation-row" key={line}>
            <span role="rowheader" class="formation-head">
              {army.editor.lineLabels[line]}
            </span>
            {WINGS.map((wing, wingIndex) => {
              const slot = draft.posts[wing][line];
              const key = `${wing}:${line}`;
              const current = cell.wing === wingIndex && cell.line === lineIndex;
              return (
                <button
                  key={key}
                  type="button"
                  role="gridcell"
                  class={`formation-post${slot === null ? ' empty' : ''}`}
                  data-testid={`post-${wing}-${line}`}
                  tabIndex={current ? 0 : -1}
                  disabled={props.disabled}
                  aria-label={`${army.editor.wingLabels[wing]}, ${army.editor.lineLabels[line]}: ${slotText(army, slot)}. Enter para editar.`}
                  ref={(element) => {
                    if (element === null) {
                      cells.current.delete(key);
                    } else {
                      cells.current.set(key, element);
                    }
                  }}
                  onFocus={() => setCell({ wing: wingIndex, line: lineIndex })}
                  onKeyDown={(event) => {
                    if (event.key.startsWith('Arrow')) {
                      event.preventDefault();
                      const next = moveCell({ wing: wingIndex, line: lineIndex }, event.key);
                      const target = `${WINGS[next.wing]}:${LINES[next.line]}`;
                      setCell(next);
                      cells.current.get(target)?.focus();
                    }
                  }}
                  onClick={() => {
                    returnTo.current = key;
                    setEditing({ wing, line });
                  }}
                >
                  {slotText(army, slot)}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <fieldset class="formation-commanders" disabled={props.disabled}>
        <legend>Comandante de cada ala</legend>
        {WINGS.map((wing) => (
          <div class="trade-amount" key={wing}>
            <label for={`commander-${wing}`}>{army.editor.wingLabels[wing]}</label>
            <select
              id={`commander-${wing}`}
              data-testid={`commander-${wing}`}
              value={draft.commanders[wing] ?? ''}
              onChange={(event) =>
                props.onChange(
                  withCommander(
                    draft,
                    wing,
                    event.currentTarget.value === '' ? null : event.currentTarget.value,
                  ),
                )
              }
            >
              <option value="">Sem comandante</option>
              {army.editor.heroes.map((hero) => (
                <option
                  key={hero.heroId}
                  value={hero.heroId}
                  disabled={hero.reason !== null && draft.commanders[wing] !== hero.heroId}
                >
                  {hero.name} ({hero.classLabel}){hero.reason === null ? '' : ` — ${hero.reason}`}
                </option>
              ))}
            </select>
          </div>
        ))}
        {army.editor.heroes.some((hero) => hero.reason !== null) ? (
          <ul class="muted formation-reasons" data-testid="commander-reasons">
            {army.editor.heroes
              .filter((hero) => hero.reason !== null)
              .map((hero) => (
                <li key={hero.heroId}>
                  {hero.name} não pode comandar: {hero.reason}
                </li>
              ))}
          </ul>
        ) : null}
      </fieldset>

      {blockedNew ? (
        <p class="blocked">
          <Icon name="lock" /> Há {formatNumber(army.formations.length)} formações, o limite de{' '}
          {formatNumber(army.editor.formationsCap)}: apague uma para salvar outra.
        </p>
      ) : null}
      <div class="trade-review-actions">
        <button
          type="button"
          data-testid="formation-save"
          disabled={!canSave}
          aria-busy={props.busy}
          onClick={() => props.actions.run('lords.saveFormation', savePayload(draft))}
        >
          Salvar
        </button>
        {saved === undefined ? null : (
          <button
            type="button"
            data-testid="formation-activate"
            disabled={props.disabled || saved.isActive}
            onClick={() =>
              props.actions.run('lords.setActiveFormation', { id: saved.id, confirmed: true })
            }
          >
            {saved.isActive ? 'É a Defesa ativa' : 'Ativar como Defesa'}
          </button>
        )}
      </div>
      {name === '' ? <p class="muted">Dê um nome à formação para salvar.</p> : null}

      {editing === null ? null : (
        <PostDialog
          army={army}
          wing={editing.wing}
          line={editing.line}
          current={draft.posts[editing.wing][editing.line]}
          onApply={(slot) => {
            props.onChange(withPost(draft, editing.wing, editing.line, slot));
            setEditing(null);
          }}
          onClose={() => setEditing(null)}
        />
      )}
    </section>
  );
}
