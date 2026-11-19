import type { GameEvent, ViewState } from '@lotg/protocol';

import { VOW_ICON, yearEndedVowsSummary } from '../ui/vows';
import type { Actions } from './actions';
import { formatNumber } from './format';
import { Icon } from './shared';

/** O documento anual vem pronto do servidor; o seletor apenas escolhe o ano solicitado. */
export function YearChronicle(props: {
  completedYears: readonly number[];
  selected: number | null;
  loading: boolean;
  events?: readonly GameEvent[] | undefined;
  vows?: ViewState['vows'] | undefined;
  vowLabels?: ReadonlyMap<string, string> | undefined;
  actions: Actions;
}) {
  const years =
    props.selected !== null
      ? [props.selected]
      : props.completedYears.length > 0
        ? props.completedYears
        : [
            ...new Set(
              (props.events ?? [])
                .filter((event) => event.type === 'yearEnded')
                .map((event) => Number(event.data.year ?? 1)),
            ),
          ];
  const summaries = years.flatMap((year) => {
    const summary = yearEndedVowsSummary(year, props.events, props.vows, props.vowLabels);
    return summary === null ? [] : [{ year, ...summary }];
  });
  return (
    <section class="year-chronicle" aria-labelledby="year-chronicle-title">
      <div>
        <h2 id="year-chronicle-title">
          <Icon name="book" /> Crônica do Ano
        </h2>
        <p class="muted" id="year-chronicle-note">
          {props.completedYears.length === 0
            ? 'Ainda não há anos encerrados para ler. A Crônica completa continua disponível.'
            : 'Cada ano encerrado reúne as estações, o Cerco, a pontuação e os Feitos. Anos sem registro de encerramento ficam indisponíveis.'}
        </p>
      </div>
      {summaries.length === 0 ? null : (
        <div class="year-chronicle-legacy" data-testid="year-chronicle-legacy">
          {summaries.map((entry) => (
            <p key={entry.year} data-testid={`year-legacy-${entry.year}`}>
              <Icon name={VOW_ICON} /> <strong>Ano {entry.year}</strong> — Votos:{' '}
              <span data-testid={`year-vows-${entry.year}`}>{entry.vowsText}</span> · Legado:{' '}
              <strong data-testid={`year-legacy-points-${entry.year}`}>
                {formatNumber(entry.legacy)} pontos
              </strong>
              {entry.score === null ? null : ` (pontuação base: ${formatNumber(entry.score)})`}.
            </p>
          ))}
        </div>
      )}
      <div class="year-chronicle-controls">
        <label for="chronicle-year">Ano</label>
        <select
          id="chronicle-year"
          value={props.selected ?? ''}
          aria-describedby="year-chronicle-note"
          onChange={(event) =>
            props.actions.run(
              'lords.selectChronicleYear',
              event.currentTarget.value === '' ? null : Number(event.currentTarget.value),
            )
          }
        >
          <option value="">Crônica completa</option>
          {props.completedYears.map((year) => (
            <option key={year} value={year}>
              Ano {year}
            </option>
          ))}
        </select>
        <button
          type="button"
          class="secondary"
          disabled={
            props.selected === null ||
            !props.completedYears.includes(props.selected) ||
            props.loading
          }
          aria-busy={props.loading}
          onClick={() => props.actions.run('lords.downloadYearChronicle', props.selected)}
        >
          <Icon name="desktop-download" /> Baixar a Crônica do Ano
        </button>
      </div>
    </section>
  );
}
