import type { GameEvent, ViewState } from '@lotg/protocol';

import type { Actions } from '../components/actions';
import { FamineBanner, OfflineBanner } from '../components/Banners';
import { ConstructionsPanel } from '../components/ConstructionsPanel';
import { Header } from '../components/Header';
import { ChroniclePanel, ObjectivesPanel, RecruitPanel } from '../components/Panels';
import { ResourcesTable } from '../components/ResourcesTable';
import { WorkersPanel } from '../components/WorkersPanel';

/**
 * A aba Feudo (GDD §13.3). Recebe o `ViewState` pronto e só o exibe: toda regra e toda conta
 * vêm do servidor. Sem ligação fica em modo leitura: nenhuma ordem é enviada nem guardada.
 */
export function FiefTab(props: {
  view: ViewState;
  elapsed: number;
  online: boolean;
  retryInSeconds: number | null;
  chronicle: GameEvent[];
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
      <FamineBanner famine={view.famine} />
      <div class="fief">
        <div class="column">
          <ResourcesTable resources={view.resources} />
          <WorkersPanel
            workers={view.workers}
            population={view.population}
            disabled={disabled}
            actions={actions}
          />
          <RecruitPanel
            recruitment={view.recruitment}
            population={view.population}
            elapsed={elapsed}
            disabled={disabled}
            actions={actions}
          />
        </div>
        <div class="column">
          <ConstructionsPanel
            constructions={view.constructions}
            elapsed={elapsed}
            disabled={disabled}
            actions={actions}
          />
          <ObjectivesPanel objectives={view.objectives} />
          <ChroniclePanel chronicle={props.chronicle} actions={actions} />
        </div>
      </div>
    </div>
  );
}
