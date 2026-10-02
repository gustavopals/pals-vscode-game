import type { ViewState } from '@lotg/protocol';

import { firewoodRunsOutIn } from '../ui/format';
import { formatApprox, formatCountdown, formatNumber, remaining } from './format';
import { Explained, Icon } from './shared';

/**
 * A lareira, só no inverno: quanto queima por hora e, quando a lenha não chega até a estação
 * virar, em quanto tempo acaba; no frio, há quanto tempo ele dura. A conta inteira (o que falta,
 * o que a Serraria repõe) fica logo abaixo, na nota da lenha ou no aviso de frio. Os prazos são
 * aproximados e não descem com o relógio local: são os mesmos números da tabela de recursos e
 * da árvore, e mudam junto com eles.
 */
function Hearth(props: { view: ViewState }) {
  const { view } = props;
  const { winter } = view;
  if (winter === null) {
    return null;
  }
  const wood = view.resources.find((row) => row.id === 'wood')?.label.toLowerCase() ?? 'lenha';
  const runsOut = firewoodRunsOutIn(view);
  return (
    <p class="hearth">
      <Icon name="flame" /> Lareira: {formatNumber(winter.firewoodPerHour)} de {wood} por hora
      {winter.cold !== null ? (
        <span class="warning">
          {' '}
          · sem lenha, frio há {formatApprox(winter.cold.secondsElapsed)}
        </span>
      ) : runsOut !== null ? (
        <span class="warning">
          {' '}
          · {wood} acaba em {formatApprox(runsOut)}
        </span>
      ) : null}
    </p>
  );
}

/** O cabeçalho da aba Feudo: nome, calendário, o que a estação muda e população. */
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
      {/* O que a estação muda fica à vista, por extenso: é o porquê das taxas e dos prazos. */}
      <p class="season muted">{calendar.seasonEffects}</p>
      <Hearth view={view} />
      <p class="population">
        Aldeões {population.villagers} ·{' '}
        <Explained why={population.breakdown}>
          Habitação {population.housed}/{population.capacity}
        </Explained>{' '}
        · Livres {population.free}
        {population.inTraining > 0 ? ` · A caminho ${population.inTraining}` : ''}
        {population.inTraining > 0 && population.secondsToNextRecruit !== null ? (
          <span class="muted">
            {' '}
            (próximo em {formatCountdown(remaining(population.secondsToNextRecruit, elapsed))})
          </span>
        ) : null}
      </p>
    </header>
  );
}
