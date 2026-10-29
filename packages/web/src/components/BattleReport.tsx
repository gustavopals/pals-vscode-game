import type { ViewState } from '@lotg/protocol';

import { BATTLE_REPORTS_ANCHOR, battleReportAnchor } from '../ui/army';
import { Icon } from './shared';

type Report = ViewState['army']['reports'][number];

/**
 * O relatório de uma batalha (GDD §10.7 e §13.4; V4D-T4.3): o desfecho e os fatores decisivos no
 * topo, as baixas por posto, a muralha, a experiência dos comandantes e as rodadas, cada uma
 * colapsável (`<details>`, que abre e fecha pelo teclado com Enter e Espaço). Tudo vem da visão,
 * já em frase; nada é calculado aqui. "Ajustar formação" leva ao editor com a formação usada.
 */
export function BattleReport(props: { report: Report; onAdjust: (formationId: string) => void }) {
  const { report } = props;
  const adjust = report.adjustFormationId;
  return (
    <article class="battle-report" data-testid="battle-report" aria-label={report.modeLabel}>
      <h4 id={battleReportAnchor(report.id)} tabIndex={-1}>
        {report.modeLabel}: {report.outcomeLabel}
      </h4>
      <p class="muted">
        {report.endingText} {report.roundsCount} {report.roundsCount === 1 ? 'rodada' : 'rodadas'}.
      </p>
      <h5>O que decidiu</h5>
      {report.factors.length === 0 ? (
        <p data-testid="battle-no-factor">{report.noFactorText}</p>
      ) : (
        <ol class="battle-factors" data-testid="battle-factors">
          {report.factors.map((entry) => (
            <li key={`${entry.factor}:${entry.owner}`} class={entry.owner}>
              <Icon name={entry.owner === 'player' ? 'shield' : 'flame'} /> {entry.text}
              {entry.wingLabel === null ? '' : ` (${entry.wingLabel})`}
            </li>
          ))}
        </ol>
      )}
      {report.casualties.length === 0 ? null : (
        <>
          <h5>Baixas</h5>
          <ul class="battle-casualties" data-testid="battle-casualties">
            {report.casualties.map((entry) => (
              <li key={`${entry.owner}:${entry.wing}:${entry.line}`}>{entry.text}</li>
            ))}
          </ul>
        </>
      )}
      {report.wall.length === 0 ? null : (
        <>
          <h5>Muralha</h5>
          <ul class="battle-wall" data-testid="battle-wall">
            {report.wall.map((entry) => (
              <li key={entry.wing}>{entry.text}</li>
            ))}
          </ul>
        </>
      )}
      {report.commanders.length === 0 ? null : (
        <>
          <h5>Comandantes</h5>
          <ul class="battle-commanders" data-testid="battle-commanders">
            {report.commanders.map((entry) => (
              <li key={entry.heroId}>{entry.text}</li>
            ))}
          </ul>
        </>
      )}
      {report.rounds.length === 0 ? null : (
        <>
          <h5>Rodadas</h5>
          {report.rounds.map((round) => (
            <details key={round.round} class="battle-round" data-testid="battle-round">
              <summary>
                Rodada {round.round}: baixas do feudo {round.casualtiesPlayer}, da Horda{' '}
                {round.casualtiesHorde}
              </summary>
              <ul>
                {round.attacks.map((text, index) => (
                  <li key={index}>{text}</li>
                ))}
              </ul>
              <p class="muted">
                {round.moraleText}
                {round.wallText === null ? '' : ` ${round.wallText}`}
              </p>
            </details>
          ))}
        </>
      )}
      {adjust === null ? null : (
        <div class="trade-review-actions">
          <button type="button" data-testid="battle-adjust" onClick={() => props.onAdjust(adjust)}>
            <Icon name="edit" /> Ajustar formação
          </button>
        </div>
      )}
    </article>
  );
}

/** Os relatórios guardados, do mais novo ao mais antigo; nada se a lista é vazia. */
export function BattleReports(props: {
  reports: ViewState['army']['reports'];
  onAdjust: (formationId: string) => void;
}) {
  if (props.reports.length === 0) {
    return null;
  }
  return (
    <section class="battle-reports" aria-labelledby={BATTLE_REPORTS_ANCHOR}>
      <h3 id={BATTLE_REPORTS_ANCHOR} tabIndex={-1}>
        Relatórios de batalha
      </h3>
      {props.reports.map((report) => (
        <BattleReport key={report.id} report={report} onAdjust={props.onAdjust} />
      ))}
    </section>
  );
}
