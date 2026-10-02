import type { ViewState } from '@lotg/protocol';

import { firewoodSeasonSoon } from '../game/beforeLeaving';
import type { Actions } from './actions';
import { formatApprox } from './format';
import { Icon } from './shared';

/**
 * A fome. Além do que ela custa agora, um segundo aviso diz o que as próximas viradas do dia vão
 * fazer com o povo (`notes`, as frases de `morale.notes`: em quanto tempo alguém deserta, a
 * chance de alguém partir, o piso que segura os últimos), para a perda ser anunciada antes de
 * acontecer. Esse segundo aviso não é região viva: os prazos dele mudam a cada leitura do
 * servidor, e um leitor de tela não deve repeti-los sozinho.
 */
export function FamineBanner(props: { famine: ViewState['famine']; notes?: readonly string[] }) {
  if (props.famine === null) {
    return null;
  }
  const notes = props.notes ?? [];
  return (
    <>
      <div class="banner banner-warning" role="status">
        <div>
          <Icon name="warning" /> <strong>Fome em andamento.</strong> {props.famine.text} Ponha
          aldeões na Fazenda.
        </div>
      </div>
      {notes.length > 0 ? (
        <div class="banner banner-warning" role="note">
          <div>
            <Icon name="organization" /> <strong>O povo e a fome.</strong> {notes.join(' ')}
          </div>
        </div>
      ) : null}
    </>
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
 * quanto guardar. Antes do outono ela só aparece quando o inverno chega em menos de um dia de
 * relógio e a madeira não basta (no ritmo Rápido, o fim do verão): é o mesmo caso em que "Antes
 * de partir" avisa. No inverno é o que falta até a estação virar. No frio, quem fala é o aviso
 * de frio, que já traz a conta. Não é região viva: os números mudam a cada leitura do servidor,
 * e um leitor de tela não deve repeti-los sozinho.
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
  const next =
    calendar.nextSeason.firewood === null
      ? null
      : { ...calendar.nextSeason, firewood: calendar.nextSeason.firewood };
  const season = next ?? firewoodSeasonSoon(props.view);
  if (season === null) {
    return null;
  }
  const ahead = season.firewood;
  return (
    <div class={`banner${ahead.missing > 0 ? ' banner-warning' : ''}`} role="note">
      <div>
        <Icon name="flame" />{' '}
        <strong>
          {season.label} em {formatApprox(season.secondsUntil)}.
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
