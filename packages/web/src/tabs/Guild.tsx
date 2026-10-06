import type { ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { Header } from '../components/Header';
import { HeroesPanel } from '../components/HeroesPanel';
import { Icon } from '../components/shared';
import { TavernPanel } from '../components/TavernPanel';

/**
 * A aba Guilda (GDD §13.1): a equipe e o soldo de um lado, a Taverna do outro. Recebe o
 * `ViewState` pronto e só o exibe. Sem ligação fica em modo leitura: a equipe e os candidatos
 * são os do último estado conhecido, e nenhuma ordem é enviada nem guardada.
 */
export function GuildTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  /** As ordens da Guilda a caminho do servidor (`controller.guildOrders`). */
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
          <Icon name="debug-disconnect" /> Sem ligação com o reino: a equipe, os candidatos e os
          prazos são os do último estado conhecido do feudo. Dá para ler; para contratar, dispensar
          ou dar um festival, é preciso a ligação.
        </p>
      )}
      <div class="fief guild">
        <div class="column">
          <HeroesPanel
            view={view}
            elapsed={elapsed}
            disabled={disabled}
            busy={props.busy}
            actions={actions}
          />
        </div>
        <div class="column">
          <TavernPanel
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
