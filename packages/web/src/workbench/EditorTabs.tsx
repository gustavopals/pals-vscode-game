import { CLOSABLE_ROUTES, ROUTE_ICONS, ROUTE_LABELS, type Route } from '../app/router';
import { Icon } from '../components/shared';

/** As abas da área central. `Tab` chega à aba ativa; as setas trocam de aba. */
export function EditorTabs(props: {
  tabs: Route[];
  active: Route;
  /** Há um Relatório de Retorno por ler: a aba Hoje ganha um ponto. */
  hasNews: boolean;
  onSelect: (route: Route) => void;
  onClose: (route: Route) => void;
}) {
  const { tabs, active } = props;
  const onKeyDown = (event: KeyboardEvent) => {
    const index = tabs.indexOf(active);
    const move = { ArrowRight: 1, ArrowLeft: -1 }[event.key];
    let next: Route | undefined;
    if (move !== undefined) {
      next = tabs[(index + move + tabs.length) % tabs.length];
    } else if (event.key === 'Home') {
      next = tabs[0];
    } else if (event.key === 'End') {
      next = tabs[tabs.length - 1];
    }
    if (next !== undefined) {
      event.preventDefault();
      props.onSelect(next);
      const list = (event.currentTarget as HTMLElement).closest('[role="tablist"]');
      // O foco acompanha a aba escolhida, depois que ela for redesenhada.
      queueMicrotask(() => list?.querySelector<HTMLElement>(`#tab-${next}`)?.focus());
    }
  };
  return (
    <div class="editor-tabs" role="tablist" aria-label="Abas">
      {tabs.map((route) => {
        const selected = route === active;
        return (
          <div key={route} class={selected ? 'editor-tab editor-tab-active' : 'editor-tab'}>
            <button
              type="button"
              role="tab"
              id={`tab-${route}`}
              aria-selected={selected}
              aria-controls="tabpanel"
              tabIndex={selected ? 0 : -1}
              onClick={() => props.onSelect(route)}
              onKeyDown={onKeyDown}
            >
              <Icon name={ROUTE_ICONS[route]} />
              {ROUTE_LABELS[route]}
              {route === 'today' && props.hasNews ? (
                <span class="dot" role="img" aria-label="há novidades" />
              ) : null}
            </button>
            {CLOSABLE_ROUTES.includes(route) ? (
              <button
                type="button"
                class="tab-close"
                aria-label={`Fechar a aba ${ROUTE_LABELS[route]}`}
                title="Fechar"
                tabIndex={selected ? 0 : -1}
                onClick={() => props.onClose(route)}
              >
                <Icon name="close" />
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
