import type { ViewState } from '@lotg/protocol';

import type { Actions } from './actions';
import { formatApprox } from './format';
import { Icon } from './shared';

export function FamineBanner(props: { famine: ViewState['famine'] }) {
  if (props.famine === null) {
    return null;
  }
  return (
    <div class="banner banner-warning" role="status">
      <div>
        <Icon name="warning" /> <strong>Fome em andamento.</strong> {props.famine.text} Ponha
        aldeões na Fazenda.
      </div>
    </div>
  );
}

/**
 * O frio (GDD §4.1): a lenha acabou no inverno. Tem ícone e texto próprios, para não se
 * confundir com a fome; o que ele custa, a conta da lenha e quando passa vêm prontos do servidor.
 */
export function ColdBanner(props: { winter: ViewState['winter'] }) {
  const cold = props.winter?.cold ?? null;
  if (cold === null) {
    return null;
  }
  return (
    <div class="banner banner-warning" role="status">
      <div>
        <Icon name="flame" /> <strong>Frio em andamento.</strong> {cold.text} Ponha aldeões na
        Serraria.
      </div>
    </div>
  );
}

/**
 * A conta da lenha, à vista sem ninguém pedir. No outono é o inverno inteiro, visto de antes:
 * quanto guardar. No inverno é o que falta até a estação virar. No frio, quem fala é o aviso de
 * frio, que já traz a conta. Não é região viva: os números mudam a cada leitura do servidor, e
 * um leitor de tela não deve repeti-los sozinho.
 */
export function FirewoodNote(props: { view: ViewState }) {
  const { calendar, winter } = props.view;
  if (winter !== null) {
    if (winter.cold !== null) {
      return null;
    }
    return (
      <div class={`banner${winter.firewood.missing > 0 ? ' banner-warning' : ''}`} role="note">
        <div>
          <Icon name="flame" /> <strong>Lareira acesa.</strong> {winter.firewood.text}
        </div>
      </div>
    );
  }
  const ahead = calendar.nextSeason.firewood;
  if (ahead === null) {
    return null;
  }
  return (
    <div class={`banner${ahead.missing > 0 ? ' banner-warning' : ''}`} role="note">
      <div>
        <Icon name="flame" />{' '}
        <strong>
          {calendar.nextSeason.label} em {formatApprox(calendar.nextSeason.secondsUntil)}.
        </strong>{' '}
        {ahead.text}
      </div>
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
