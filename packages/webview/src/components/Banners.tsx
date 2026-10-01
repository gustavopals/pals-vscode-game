import type { ViewState } from '@lotg/protocol';

import type { Send } from '../bridge';

export function FamineBanner(props: { famine: ViewState['famine'] }) {
  if (props.famine === null) {
    return null;
  }
  return (
    <div class="banner banner-warning" role="status">
      <strong>Fome em andamento.</strong> {props.famine.text} Ponha aldeões na Fazenda.
    </div>
  );
}

export function OfflineBanner(props: {
  online: boolean;
  retryInSeconds: number | null;
  send: Send;
}) {
  if (props.online) {
    return null;
  }
  return (
    <div class="banner banner-offline" role="status">
      <div>
        <strong>Sem ligação com o reino.</strong> O mundo continua andando. Seus comandos voltam
        quando a ligação voltar.
        {props.retryInSeconds !== null ? (
          <span class="muted"> Nova tentativa em {props.retryInSeconds} s.</span>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => props.send({ type: 'action', action: 'retryConnection' })}
      >
        Tentar agora
      </button>
    </div>
  );
}

export function ErrorToast(props: {
  error: { code: string; message: string } | null;
  onDismiss: () => void;
}) {
  if (props.error === null) {
    return null;
  }
  return (
    <div class="banner banner-error" role="alert">
      <span>{props.error.message}</span>
      <button type="button" class="link" onClick={props.onDismiss} aria-label="Dispensar aviso">
        Entendi
      </button>
    </div>
  );
}
