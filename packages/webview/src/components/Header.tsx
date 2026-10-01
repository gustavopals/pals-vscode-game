import type { ViewState, WebviewRoute } from '@lotg/protocol';

import { formatCountdown, remaining } from '../format';
import { Explained } from '../theme';

export function Header(props: {
  view: ViewState;
  elapsed: number;
  route: WebviewRoute;
  hasNews: boolean;
  onRoute: (route: WebviewRoute) => void;
}) {
  const { view, elapsed, route } = props;
  const { calendar, population, settlement } = view;
  // Abas: Tab chega à aba ativa; as setas trocam de aba, como em qualquer lista de abas.
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
      event.preventDefault();
      props.onRoute(route === 'today' ? 'fief' : 'today');
    }
  };
  const tab = (id: WebviewRoute, label: string) => (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={route === id}
      aria-controls="tabpanel"
      tabIndex={route === id ? 0 : -1}
      class={route === id ? 'tab tab-active' : 'tab'}
      onClick={() => props.onRoute(id)}
      onKeyDown={onKeyDown}
    >
      {label}
      {id === 'today' && props.hasNews ? <span class="dot" aria-label="há novidades" /> : null}
    </button>
  );
  return (
    <header class="header">
      <div class="title-row">
        <h1>{settlement.name}</h1>
        <p class="subtitle">
          Salão Nv{settlement.townHallLevel} · {calendar.seasonLabel}, dia {calendar.dayOfSeason} do
          Ano {calendar.year}
          <span class="muted">
            {' '}
            · próximo dia em {formatCountdown(remaining(calendar.secondsToNextDay, elapsed))}
          </span>
        </p>
      </div>
      <p class="population">
        Aldeões {population.villagers} ·{' '}
        <Explained why={population.breakdown}>
          Habitação {population.villagers + population.inTraining}/{population.capacity}
        </Explained>{' '}
        · Livres {population.free}
        {population.inTraining > 0 ? ` · A caminho ${population.inTraining}` : ''}
      </p>
      <nav class="tabs" role="tablist" aria-label="Seções do painel">
        {tab('today', 'Hoje')}
        {tab('fief', 'Feudo')}
      </nav>
    </header>
  );
}
