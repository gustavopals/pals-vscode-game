import type { ViewState } from '@lotg/protocol';

import { order, type Send } from '../bridge';
import { formatNumber } from '../format';
import { Explained } from '../theme';

type Row = ViewState['workers'][number];

export function WorkersPanel(props: {
  workers: ViewState['workers'];
  population: ViewState['population'];
  disabled: boolean;
  send: Send;
}) {
  const { workers, population, disabled, send } = props;
  const set = (row: Row, count: number) => {
    if (!disabled && count >= 0 && count <= row.assigned + population.free) {
      send(order('setWorkers', { building: row.building, count }));
    }
  };
  // Teclado: + e − mudam a alocação; as setas andam entre os edifícios.
  const onKeyDown = (row: Row) => (event: KeyboardEvent) => {
    const current = event.currentTarget as HTMLElement;
    if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      set(row, row.assigned + 1);
    } else if (event.key === '-') {
      event.preventDefault();
      set(row, row.assigned - 1);
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const sibling =
        event.key === 'ArrowDown' ? current.nextElementSibling : current.previousElementSibling;
      (sibling as HTMLElement | null)?.focus();
    }
  };
  return (
    <section aria-labelledby="workers-title">
      <h2 id="workers-title">
        Trabalhadores ({population.villagers - population.free}/{population.villagers})
      </h2>
      <p class="muted hint">
        {population.free === 0
          ? 'Todos têm ofício.'
          : `${population.free} ${population.free === 1 ? 'aldeão livre' : 'aldeões livres'}.`}{' '}
        Use + e − no teclado.
      </p>
      <ul class="workers">
        {workers.map((row) => (
          <li
            key={row.building}
            class="worker"
            tabIndex={0}
            onKeyDown={onKeyDown(row)}
            aria-label={`${row.label} nível ${row.level}: ${row.assigned} trabalhadores, ${formatNumber(row.grossPerHour)} por hora`}
          >
            <span class="worker-name">
              {row.label} <span class="muted">Nv{row.level}</span>
            </span>
            <span class="stepper">
              <button
                type="button"
                aria-label={`Tirar um trabalhador de ${row.label}`}
                disabled={disabled || row.assigned === 0}
                onClick={() => set(row, row.assigned - 1)}
              >
                −
              </button>
              <span class="count" aria-hidden="true">
                {row.assigned}
              </span>
              <button
                type="button"
                aria-label={`Pôr mais um trabalhador em ${row.label}`}
                disabled={disabled || population.free === 0}
                onClick={() => set(row, row.assigned + 1)}
              >
                +
              </button>
            </span>
            <span class="num rate">
              <Explained why={row.breakdown}>{formatNumber(row.grossPerHour)}/h</Explained>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
