import type { Actions } from './actions';
import { Icon } from './shared';

/** O documento anual vem pronto do servidor; o seletor apenas escolhe o ano solicitado. */
export function YearChronicle(props: {
  currentYear: number;
  selected: number | null;
  loading: boolean;
  actions: Actions;
}) {
  return (
    <section class="year-chronicle" aria-labelledby="year-chronicle-title">
      <div>
        <h2 id="year-chronicle-title">
          <Icon name="book" /> Crônica do Ano
        </h2>
        <p class="muted" id="year-chronicle-note">
          Cada ano encerrado reúne as estações, o Cerco, a pontuação e os Feitos. Anos sem registro
          de encerramento ficam indisponíveis.
        </p>
      </div>
      <div class="year-chronicle-controls">
        <label for="chronicle-year">Leitura</label>
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
          {Array.from({ length: props.currentYear }, (_, index) => (
            <option key={index} value={index + 1}>
              Ano {index + 1}
            </option>
          ))}
        </select>
        <button
          type="button"
          class="secondary"
          disabled={props.selected === null || props.loading}
          aria-busy={props.loading}
          onClick={() => props.actions.run('lords.downloadYearChronicle', props.selected)}
        >
          <Icon name="desktop-download" /> Baixar a Crônica do Ano
        </button>
      </div>
    </section>
  );
}
