import { useEffect, useLayoutEffect, useState } from 'preact/hooks';

import type { Controller } from '../app/controller';
import type { Route } from '../app/router';
import type { Actions } from '../components/actions';
import { OfflineBanner } from '../components/Banners';
import { useElapsedSeconds } from '../components/shared';
import { Welcome } from '../components/Welcome';
import type { ThemeId } from '../services/preferences';
import { AboutTab } from '../tabs/About';
import { ChronicleTab } from '../tabs/Chronicle';
import { FiefTab } from '../tabs/Fief';
import { SettingsTab } from '../tabs/Settings';
import { TodayTab } from '../tabs/Today';
import { buildTree } from '../ui/treeModel';
import { type Activity, ActivityBar } from './ActivityBar';
import { EditorTabs } from './EditorTabs';
import { SideBar } from './SideBar';
import { StatusBar } from './StatusBar';

/**
 * Redesenha o componente a cada mudança do controlador. A assinatura é feita com
 * `useLayoutEffect`, junto com o primeiro desenho: `useEffect` só roda depois do próximo quadro,
 * e uma mudança que chegasse nesse intervalo (a resposta de `/version`, uma tecla) não
 * redesenharia nada.
 */
export function useController(controller: Controller): void {
  const [, redraw] = useState(0);
  useLayoutEffect(() => controller.onChange(() => redraw((count) => count + 1)), [controller]);
}

function TabContent(props: {
  controller: Controller;
  route: Route;
  elapsed: number;
  theme: ThemeId;
  actions: Actions;
  browserNotificationsSupported: boolean;
}) {
  const { controller, route, actions, elapsed } = props;
  const { view, connection } = controller;
  const online = connection.kind !== 'offline';
  const retryInSeconds =
    connection.kind === 'offline' ? Math.ceil(connection.retryInMs / 1000) : null;
  const account = controller.account.state;

  switch (route) {
    case 'welcome':
      return (
        <Welcome
          account={account.kind === 'signedOut' ? null : { displayName: account.displayName }}
          busy={controller.busy}
          online={online}
          githubAvailable={controller.githubAvailable}
          actions={actions}
        />
      );
    case 'settings':
      return (
        <SettingsTab
          preferences={controller.preferences}
          theme={props.theme}
          browserNotificationsSupported={props.browserNotificationsSupported}
          onChange={(patch) => void controller.setPreferences(patch)}
          onBrowserNotifications={(enabled) => void controller.setBrowserNotifications(enabled)}
        />
      );
    case 'about':
      return <AboutTab server={controller.server} actions={actions} />;
    case 'chronicle':
      return <ChronicleTab document={controller.chronicleDocument} actions={actions} />;
    case 'today':
    case 'fief':
      if (view === null) {
        return (
          <main class="loading">
            <OfflineBanner online={online} retryInSeconds={retryInSeconds} actions={actions} />
            <p role="status">
              {online
                ? 'Abrindo os portões do feudo…'
                : 'Ainda não há um estado guardado neste navegador.'}
            </p>
          </main>
        );
      }
      return route === 'today' ? (
        <TodayTab
          view={view}
          elapsed={elapsed}
          online={online}
          retryInSeconds={retryInSeconds}
          report={controller.report}
          actions={actions}
        />
      ) : (
        <FiefTab
          view={view}
          elapsed={elapsed}
          online={online}
          retryInSeconds={retryInSeconds}
          chronicle={controller.chronicle}
          actions={actions}
        />
      );
  }
}

/**
 * A bancada (GDD §13.1): barra de atividades, barra lateral com a árvore, área central em abas
 * e barra de status, nesta ordem no documento, que é também a ordem do `Tab`.
 */
export function Workbench(props: {
  controller: Controller;
  actions: Actions;
  theme: ThemeId;
  /** A janela tem menos de 720 px: a barra lateral começa recolhida e abre por cima. */
  narrow: boolean;
  browserNotificationsSupported: boolean;
}) {
  const { controller, actions } = props;
  useController(controller);
  const [activity, setActivity] = useState<Activity>('fief');
  const [sidebarOpen, setSidebarOpen] = useState(!props.narrow);
  const elapsed = useElapsedSeconds(controller.viewReceivedAt);
  const account = controller.account.state;
  const signedIn = account.kind !== 'signedOut';
  const title = controller.title(elapsed);

  useEffect(() => {
    document.title = title;
  }, [title]);

  const nodes = buildTree({
    view: controller.view,
    account,
    connection: controller.connection,
    chronicle: controller.chronicle,
    unseen: controller.unseen,
    elapsedSeconds: elapsed,
    githubAvailable: controller.githubAvailable,
  });

  const run = (id: string, arg?: unknown) => {
    controller.runCommand(id, arg);
  };
  const runFromSidebar = (id: string, arg?: unknown) => {
    run(id, arg);
    // Em tela estreita a barra lateral cobre o conteúdo: sai da frente depois de navegar.
    const order = ['lords.workersIncrease', 'lords.workersDecrease'].includes(id);
    if (props.narrow && !order) {
      setSidebarOpen(false);
    }
  };

  return (
    <div class="workbench">
      <ActivityBar
        active={activity}
        sidebarOpen={sidebarOpen}
        unseen={controller.preferences.discreetMode ? 0 : controller.unseen}
        onSelect={(next) => {
          setSidebarOpen(next === activity ? !sidebarOpen : true);
          setActivity(next);
        }}
        onCommand={run}
      />
      <SideBar
        open={sidebarOpen}
        activity={activity}
        nodes={nodes}
        signedIn={signedIn}
        readOnly={controller.connection.kind !== 'online'}
        onCommand={runFromSidebar}
      />
      <div class="editor">
        <EditorTabs
          tabs={controller.tabs}
          active={controller.route}
          hasNews={controller.report !== null}
          onSelect={(route) => controller.navigate(route)}
          onClose={(route) => controller.closeTab(route)}
        />
        <div
          class="editor-content"
          id="tabpanel"
          role="tabpanel"
          aria-labelledby={`tab-${controller.route}`}
        >
          <TabContent
            controller={controller}
            route={controller.route}
            elapsed={elapsed}
            theme={props.theme}
            actions={actions}
            browserNotificationsSupported={props.browserNotificationsSupported}
          />
        </div>
      </div>
      <StatusBar
        input={controller.statusInput(elapsed)}
        muted={
          controller.preferences.mutedUntil !== null &&
          controller.now() < controller.preferences.mutedUntil
        }
        onCommand={run}
      />
    </div>
  );
}
