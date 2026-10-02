import { useLayoutEffect, useRef, useState } from 'preact/hooks';

import { QuickPick } from '../palette/CommandPalette';
import { type DialogService, type DialogState, nextFocusIndex } from './dialogs';

const FOCUSABLE =
  'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]';

type Resolve = (value: unknown) => void;

function InputBody(props: { state: Extract<DialogState, { kind: 'input' }>; resolve: Resolve }) {
  const { state } = props;
  const [value, setValue] = useState(state.value ?? '');
  const validation = state.validate?.(value) ?? null;
  const invalid = validation?.severity === 'error';
  const submit = (event: Event) => {
    event.preventDefault();
    if (!invalid) {
      props.resolve(value);
    }
  };
  return (
    <form onSubmit={submit}>
      <h2 id="dialog-title">{state.title}</h2>
      {state.prompt ? <p id="dialog-prompt">{state.prompt}</p> : null}
      <input
        type="text"
        data-autofocus
        aria-labelledby="dialog-title"
        aria-describedby="dialog-prompt dialog-validation"
        aria-invalid={invalid}
        placeholder={state.placeholder}
        autocomplete="off"
        spellcheck={false}
        value={value}
        onInput={(event) => setValue((event.target as HTMLInputElement).value)}
      />
      {/* A validação é lida a cada tecla por leitores de tela, sem tirar o foco do campo. */}
      <div id="dialog-validation" aria-live="polite">
        {validation === null ? null : (
          <p class={invalid ? 'validation validation-error' : 'validation'}>{validation.message}</p>
        )}
      </div>
      <div class="dialog-actions">
        <button type="button" class="secondary" onClick={() => props.resolve(undefined)}>
          Cancelar
        </button>
        <button type="submit" disabled={invalid}>
          {state.confirmLabel ?? 'Confirmar'}
        </button>
      </div>
    </form>
  );
}

function InfoBody(props: {
  state: Extract<DialogState, { kind: 'info' }>;
  resolve: Resolve;
  copy: (text: string) => Promise<void>;
}) {
  const { state } = props;
  const [copied, setCopied] = useState(false);
  return (
    <>
      <h2 id="dialog-title">{state.title}</h2>
      <div id="dialog-detail">
        {state.paragraphs.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      {state.code === undefined ? null : (
        <div class="dialog-code">
          <code>{state.code}</code>
          <button
            type="button"
            class="secondary"
            data-autofocus
            onClick={() => {
              void props.copy(state.code ?? '').then(
                () => setCopied(true),
                () => setCopied(false),
              );
            }}
          >
            {copied ? 'Copiado' : 'Copiar'}
          </button>
        </div>
      )}
      {state.link === undefined ? null : (
        <p>
          <a href={state.link.href} target="_blank" rel="noopener noreferrer">
            {state.link.label}
          </a>{' '}
          <span class="muted">(abre em outra aba)</span>
        </p>
      )}
      <p class="muted" role="status">
        {state.status ?? ''}
      </p>
      <div class="dialog-actions">
        <button
          type="button"
          data-autofocus={state.code === undefined ? true : undefined}
          onClick={() => props.resolve(undefined)}
        >
          {state.closeLabel ?? 'Fechar'}
        </button>
      </div>
    </>
  );
}

function ConfirmBody(props: {
  state: Extract<DialogState, { kind: 'confirm' }>;
  resolve: Resolve;
}) {
  const { state } = props;
  return (
    <>
      <h2 id="dialog-title">{state.title}</h2>
      <div id="dialog-detail">
        {(state.detail ?? []).map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>
      <div class="dialog-actions">
        {/* O foco começa em "Cancelar": Enter sem ler não confirma nada destrutivo. */}
        <button type="button" class="secondary" data-autofocus onClick={() => props.resolve(false)}>
          {state.cancelLabel ?? 'Cancelar'}
        </button>
        <button type="button" onClick={() => props.resolve(true)}>
          {state.confirmLabel}
        </button>
      </div>
    </>
  );
}

/**
 * Desenha o diálogo à vista. Acessível: `role="dialog"` modal, foco preso dentro dele, `Esc`
 * fecha, e o foco volta a quem o tinha antes.
 */
export function DialogHost(props: {
  dialogs: DialogService;
  copy: (text: string) => Promise<void>;
}) {
  const { dialogs } = props;
  const [, redraw] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const returnTo = useRef<Element | null>(null);
  const current = dialogs.current;

  // Ouve os diálogos desde o primeiro desenho (`useLayoutEffect`): com `useEffect` a assinatura
  // só existiria um quadro depois, e uma paleta aberta nesse intervalo (F1 logo ao carregar a
  // página) ficaria na fila sem aparecer, com o texto digitado caindo no campo que tem o foco.
  useLayoutEffect(() => dialogs.onChange(() => redraw((count) => count + 1)), [dialogs]);

  // Logo depois de desenhar (e não no próximo quadro): quem digita rápido, ou um leitor de
  // tela, já encontra o foco dentro do diálogo.
  useLayoutEffect(() => {
    if (current === null) {
      return;
    }
    // Guarda quem tinha o foco só quando o primeiro diálogo de uma sequência abre.
    returnTo.current ??= document.activeElement;
    const target =
      box.current?.querySelector<HTMLElement>('[data-autofocus]') ??
      box.current?.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
    if (target instanceof HTMLInputElement) {
      target.select();
    }

    // No documento, e não no diálogo: `Esc` e `Tab` valem mesmo se o foco escapou dele.
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        dialogs.cancel();
        return;
      }
      if (event.key !== 'Tab' || box.current === null) {
        return;
      }
      // Foco preso: Tab no último elemento volta ao primeiro, e vice-versa.
      const focusable = [...box.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const index = focusable.indexOf(document.activeElement as HTMLElement);
      const next = focusable[nextFocusIndex(focusable.length, index, event.shiftKey)];
      event.preventDefault();
      next?.focus();
    };
    document.addEventListener('keydown', onKeyDown, true);

    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      if (dialogs.current === null) {
        const previous = returnTo.current;
        returnTo.current = null;
        if (previous instanceof HTMLElement && previous.isConnected) {
          previous.focus();
        }
      }
    };
  }, [current?.id]);

  if (current === null) {
    return null;
  }
  const { id, state } = current;
  const resolve: Resolve = (value) => dialogs.resolve(id, value);

  const pick = state.kind === 'pick';
  return (
    <div
      class={pick ? 'backdrop backdrop-top' : 'backdrop'}
      onMouseDown={(event) => {
        // Um código que só aparece uma vez não se perde por um clique fora do diálogo.
        const oneTime = state.kind === 'info' && state.code !== undefined;
        if (event.target === event.currentTarget && !oneTime) {
          dialogs.cancel();
        }
      }}
    >
      <div
        // Um diálogo novo é um componente novo: o campo não herda o texto do anterior.
        key={id}
        ref={box}
        class={pick ? 'dialog quickpick' : 'dialog'}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        // O foco cai em um botão: sem isto, o leitor de tela pularia o texto que explica a
        // consequência (sair sem código, prazos da exclusão).
        aria-describedby={
          state.kind === 'confirm' || state.kind === 'info' ? 'dialog-detail' : undefined
        }
      >
        {state.kind === 'confirm' ? <ConfirmBody state={state} resolve={resolve} /> : null}
        {state.kind === 'input' ? <InputBody state={state} resolve={resolve} /> : null}
        {state.kind === 'info' ? (
          <InfoBody state={state} resolve={resolve} copy={props.copy} />
        ) : null}
        {state.kind === 'pick' ? (
          <QuickPick
            title={state.title}
            placeholder={state.placeholder}
            items={state.items}
            selected={state.selected}
            onPick={resolve}
          />
        ) : null}
      </div>
    </div>
  );
}
