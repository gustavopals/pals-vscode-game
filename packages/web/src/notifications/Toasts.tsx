import { useEffect, useState } from 'preact/hooks';

import type { Toast } from '../app/controller';
import { Icon } from '../components/shared';

/** Um aviso sem botões some sozinho depois deste tempo. */
export const TOAST_TIMEOUT_MS = 8000;

const ICONS: Record<Toast['kind'], string> = { info: 'info', warning: 'warning', error: 'error' };

function ToastItem(props: { toast: Toast; onDismiss: (id: number) => void }) {
  const { toast } = props;
  // Quem está lendo (mouse em cima, foco dentro) não perde o aviso no meio da frase.
  const [reading, setReading] = useState(false);
  useEffect(() => {
    if (toast.sticky || reading) {
      return;
    }
    const timer = setTimeout(() => props.onDismiss(toast.id), TOAST_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [toast.id, toast.sticky, reading]);
  return (
    <div
      class={`toast toast-${toast.kind}`}
      onMouseEnter={() => setReading(true)}
      onMouseLeave={() => setReading(false)}
      onFocusIn={() => setReading(true)}
      onFocusOut={() => setReading(false)}
      // Um erro interrompe o leitor de tela; o resto espera a vez.
      role={toast.kind === 'error' ? 'alert' : 'status'}
    >
      <Icon name={ICONS[toast.kind]} />
      <span>{toast.text}</span>
      <button
        type="button"
        class="toast-close"
        aria-label="Dispensar aviso"
        title="Dispensar"
        onClick={() => props.onDismiss(toast.id)}
      >
        <Icon name="close" />
      </button>
      {toast.actions.length > 0 ? (
        <div class="toast-actions">
          {toast.actions.map((action) => (
            <button
              key={action.label}
              type="button"
              class="secondary"
              onClick={() => {
                props.onDismiss(toast.id);
                void action.run();
              }}
            >
              {action.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Os avisos no canto inferior direito, do mais antigo para o mais novo. */
export function Toasts(props: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div class="toasts" role="region" aria-label="Avisos">
      {props.toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={props.onDismiss} />
      ))}
    </div>
  );
}
