import type { ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { CaravanPanel } from '../components/CaravanPanel';
import { Header } from '../components/Header';
import { MarketPanel } from '../components/MarketPanel';
import { Icon } from '../components/shared';

/**
 * A aba Mercado (GDD §13.1): do lado esquerdo, os preços de hoje e a negociação; do direito, as
 * caravanas na estrada e o envio de uma nova. Sem o Mercado, a obra e a frase do servidor que diz
 * para que ele serve. Recebe o `ViewState` pronto e só o exibe. Sem ligação fica em modo leitura:
 * os preços e os prazos são os do último estado conhecido, e nenhuma ordem é enviada.
 */
export function MarketTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  /** As ordens a caminho do servidor (`controller.guildOrders`). */
  busy: ReadonlySet<string>;
  actions: Actions;
}) {
  const { view, elapsed, actions } = props;
  const disabled = !props.online;
  return (
    <div class="panel">
      <Header view={view} elapsed={elapsed} />
      <OfflineBanner
        online={props.online}
        retryInSeconds={props.retryInSeconds}
        actions={actions}
      />
      {props.online ? null : (
        <p class="council-stale">
          <Icon name="debug-disconnect" /> Sem ligação com o reino: os preços, o que ainda cabe e as
          caravanas são os do último estado conhecido do feudo. Dá para ler; para negociar ou mandar
          uma caravana, é preciso a ligação.
        </p>
      )}
      <div class="fief market">
        <div class="column">
          <MarketPanel
            view={view}
            elapsed={elapsed}
            disabled={disabled}
            busy={props.busy}
            actions={actions}
          />
        </div>
        <div class="column">
          <CaravanPanel
            view={view}
            elapsed={elapsed}
            disabled={disabled}
            busy={props.busy}
            actions={actions}
          />
        </div>
      </div>
    </div>
  );
}
