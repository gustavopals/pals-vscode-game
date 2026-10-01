import type { WebviewRoute } from '@lotg/protocol';

import type { Send } from './bridge';
import { ErrorToast, FamineBanner, OfflineBanner } from './components/Banners';
import { ConstructionsPanel } from './components/ConstructionsPanel';
import { Header } from './components/Header';
import { ResourcesTable } from './components/ResourcesTable';
import { ChroniclePanel, ObjectivesPanel, RecruitPanel } from './components/Sidebar';
import { Today } from './components/Today';
import { Welcome } from './components/Welcome';
import { WorkersPanel } from './components/WorkersPanel';
import type { AppState } from './state';
import { useElapsedSeconds } from './theme';

/**
 * O painel inteiro. Recebe o estado pronto e só o exibe: toda regra e toda conta vêm do
 * servidor, dentro do `ViewState`.
 */
export function App(props: {
  state: AppState;
  send: Send;
  onRoute: (route: WebviewRoute) => void;
  onDismissError: () => void;
}) {
  const { state, send } = props;
  const elapsed = useElapsedSeconds(state.viewReceivedAt);
  const { view } = state;
  const offline = (
    <OfflineBanner online={state.online} retryInSeconds={state.retryInSeconds} send={send} />
  );
  const error = <ErrorToast error={state.error} onDismiss={props.onDismissError} />;

  if (state.route === 'welcome' || state.session?.hasGame === false) {
    return (
      <>
        {error}
        <Welcome session={state.session} online={state.online} send={send} />
      </>
    );
  }
  if (view === null) {
    return (
      <main class="loading">
        {offline}
        {error}
        <p role="status">
          {state.online
            ? 'Abrindo os portões de Pedra Alta…'
            : 'Ainda não há um estado guardado nesta máquina.'}
        </p>
      </main>
    );
  }
  // Sem ligação o painel fica em modo leitura: nenhuma ordem é enviada nem guardada em fila.
  const disabled = !state.online;
  return (
    <div class="panel">
      <Header
        view={view}
        elapsed={elapsed}
        route={state.route}
        hasNews={state.report !== null}
        onRoute={props.onRoute}
      />
      {offline}
      {error}
      <FamineBanner famine={view.famine} />
      {state.route === 'today' ? (
        <div id="tabpanel" role="tabpanel" aria-labelledby="tab-today">
          <Today report={state.report} send={send} onGoToFief={() => props.onRoute('fief')} />
        </div>
      ) : (
        <div class="fief" id="tabpanel" role="tabpanel" aria-labelledby="tab-fief">
          <div class="column">
            <ResourcesTable resources={view.resources} />
            <WorkersPanel
              workers={view.workers}
              population={view.population}
              disabled={disabled}
              send={send}
            />
            <RecruitPanel
              recruitment={view.recruitment}
              population={view.population}
              disabled={disabled}
              send={send}
            />
          </div>
          <div class="column">
            <ConstructionsPanel
              constructions={view.constructions}
              elapsed={elapsed}
              disabled={disabled}
              send={send}
            />
            <ObjectivesPanel objectives={view.objectives} />
            <ChroniclePanel chronicle={state.chronicle} send={send} />
          </div>
        </div>
      )}
    </div>
  );
}
