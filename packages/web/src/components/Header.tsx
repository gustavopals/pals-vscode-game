import type { ViewState } from '@lotg/protocol';

import { formatCountdown, remaining } from './format';
import { Explained } from './shared';

/** O cabeçalho da aba Feudo: nome, calendário e população. */
export function Header(props: { view: ViewState; elapsed: number }) {
  const { view, elapsed } = props;
  const { calendar, population, settlement } = view;
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
    </header>
  );
}
