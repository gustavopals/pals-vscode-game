import type { ViewState } from '@lotg/protocol';

import type { Actions } from './actions';

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
  actions: Actions;
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
      <button type="button" onClick={() => props.actions.run('lords.refresh')}>
        Tentar agora
      </button>
    </div>
  );
}
