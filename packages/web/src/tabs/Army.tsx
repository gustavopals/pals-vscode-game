import type { ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { BarracksPanel } from '../components/BarracksPanel';
import { Header } from '../components/Header';
import { Icon } from '../components/shared';

/**
 * A aba Exército (GDD §10.2): o Quartel, os soldados e o treino. Sem o Quartel, a obra e a frase
 * do servidor que diz para que ele serve. Recebe o `ViewState` pronto e só o exibe. Sem ligação
 * fica em modo leitura: os soldados e os prazos são os do último estado conhecido, e nenhuma
 * ordem é enviada. (O editor de formação é da V4C-T3.3.)
 */
export function ArmyTab(props: {
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
          <Icon name="debug-disconnect" /> Sem ligação com o reino: os soldados e o treino são os do
          último estado conhecido do feudo. Dá para ler; para treinar, cancelar ou dispensar, é
          preciso a ligação.
        </p>
      )}
      <div class="fief army">
        <div class="column">
          <BarracksPanel
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
