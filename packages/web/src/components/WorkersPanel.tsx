import type { ViewState } from '@lotg/protocol';

import {
  adaptationLine,
  experienceNeedsAttention,
  experienceSummary,
  experienceTrendWord,
  isMastered,
  nextWorkerGain,
  workersCount,
} from '../ui/workers';
import type { Actions } from './actions';
import { formatCountdown, formatNumber } from './format';
import { Explained, Icon } from './shared';

type Row = ViewState['workers'][number];
type Rules = ViewState['workersRules'];

const TREND_ICONS: Record<Row['experienceTrend'], string | null> = {
  rising: 'arrow-up',
  steady: null,
  falling: 'arrow-down',
};

/**
 * A experiência do ofício de um edifício (GDD §5.3): o número com a explicação, a barra e o que
 * ela rende. A palavra diz para onde vai ("subindo", "caindo"); o ícone só acompanha.
 */
function Craft(props: { row: Row; rules: Rules }) {
  const { row, rules } = props;
  const icon = TREND_ICONS[row.experienceTrend];
  return (
    <span class="worker-craft">
      {icon === null ? null : <Icon name={icon} />}{' '}
      {/*
        O porquê da tendência deste edifício e, em seguida, a regra geral. Quando a frase do
        edifício já está à vista na linha (pede uma ação), a explicação é só a regra.
      */}
      <Explained
        why={
          experienceNeedsAttention(row, rules)
            ? rules.experienceText
            : `${row.experienceNote} ${rules.experienceText}`
        }
      >
        {experienceSummary(row, rules)}
      </Explained>
      <progress
        class="craft-bar"
        max={rules.experienceMax}
        value={row.experience}
        aria-label={`Experiência do ofício em ${row.label}: ${formatNumber(row.experience)} de ${formatNumber(rules.experienceMax)}`}
      />
    </span>
  );
}

/** O que os leitores de tela ouvem ao chegar à linha: o mesmo que a linha mostra. */
function rowLabel(row: Row, rules: Rules): string {
  const trend = experienceTrendWord(row);
  return [
    `${row.label} nível ${row.level}: ${workersCount(row.assigned)}, ${formatNumber(row.grossPerHour)} por hora`,
    row.adapting > 0 ? `${row.adapting} em adaptação` : null,
    isMastered(row, rules)
      ? 'ofício dominado'
      : `experiência ${formatNumber(row.experience)} de ${formatNumber(rules.experienceMax)}${trend === null ? '' : `, ${trend}`}`,
  ]
    .filter((part) => part !== null)
    .join('; ');
}

export function WorkersPanel(props: {
  workers: ViewState['workers'];
  rules: Rules;
  population: ViewState['population'];
  /** Segundos desde que a visão chegou: a contagem da adaptação desce com o relógio da página. */
  elapsed: number;
  disabled: boolean;
  actions: Actions;
}) {
  const { workers, rules, population, elapsed, disabled, actions } = props;
  const set = (row: Row, count: number) => {
    if (!disabled && count >= 0 && count <= row.assigned + population.free) {
      actions.order('setWorkers', { building: row.building, count });
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
      {/* O custo da troca fica à vista antes de qualquer clique: as duas frases são do servidor. */}
      <p class="muted hint craft-rules">
        {rules.adaptationText} {rules.removalText}
      </p>
      <ul class="workers">
        {workers.map((row) => {
          const adapting = adaptationLine(row, elapsed, formatCountdown);
          const gainId = `worker-gain-${row.building}`;
          return (
            <li
              key={row.building}
              class="worker"
              tabIndex={0}
              onKeyDown={onKeyDown(row)}
              aria-label={rowLabel(row, rules)}
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
                  // O que o clique custa e rende: a mesma frase que a linha mostra.
                  aria-describedby={gainId}
                  disabled={disabled || population.free === 0}
                  onClick={() => set(row, row.assigned + 1)}
                >
                  +
                </button>
              </span>
              <span class="num rate">
                <Explained why={row.breakdown}>{formatNumber(row.grossPerHour)}/h</Explained>
              </span>
              <span class="worker-details">
                <Craft row={row} rules={rules} />
                <span class="worker-gain" id={gainId}>
                  +1 aqui: {nextWorkerGain(row, rules)}
                </span>
              </span>
              {adapting === null ? null : (
                <span class="worker-adapting">
                  <Icon name="history" /> {adapting}, rendendo{' '}
                  {formatNumber(row.perNewWorkerPerHour)}/h cada
                </span>
              )}
              {experienceNeedsAttention(row, rules) ? (
                <span class="worker-note warning">
                  <Icon name="warning" /> {row.experienceNote}
                </span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
