import {
  outcomeIcon,
  outcomeIsBad,
  type Report,
  REPORT_ICON,
  reportAnchor,
  type ReportStep,
  reportSummary,
  teamLine,
} from '../ui/expeditions';
import { Icon } from './shared';

/**
 * Um passo do percurso (GDD §9.4): o nó, o desfecho em palavra **e** ícone (nada é dito só pela
 * cor), a frase da Crônica, que já traz quem se destacou e, no Revés e no Desastre, o que teria
 * ajudado, e o que o passo fez à equipe e ao mundo, uma linha por fato. Quem se destacou e a
 * lição vêm também destacados, para quem passa os olhos.
 */
export function Step(props: { step: ReportStep }) {
  const { step } = props;
  const bad = outcomeIsBad(step.outcome);
  return (
    <li class="report-step">
      <p class="report-step-head">
        <strong>{step.title}</strong>{' '}
        <span class={bad ? 'report-outcome warning' : 'report-outcome'}>
          <Icon name={outcomeIcon(step.outcome)} /> {step.outcomeLabel}
        </span>
      </p>
      <p class="report-step-text">{step.text}</p>
      {step.standoutName === null ? null : (
        <p class="report-step-note muted">
          <Icon name="person" /> Destaque: {step.standoutName}
        </p>
      )}
      {step.lessonText === null ? null : (
        <p class="report-step-note">
          <Icon name="lightbulb" /> Lição: {step.lessonText}
        </p>
      )}
      {step.notes.map((note) => (
        <p key={note} class="report-step-note">
          <Icon name="note" /> {note}
        </p>
      ))}
    </li>
  );
}

/**
 * O relatório de uma expedição que voltou (GDD §9.4; critério 3 do §16.2): quem foi e com que
 * Postura, o percurso nó a nó e, no fim, o que a jornada trouxe e o que custou, nas frases do
 * servidor. Fica recolhido em uma linha (o destino, a equipe e o que trouxe) e abre com um
 * clique ou com `Enter`; o mais novo, e o que o jogador pediu para ver, já vêm abertos.
 */
export function ExpeditionReport(props: { report: Report; open: boolean }) {
  const { report } = props;
  const anchor = reportAnchor(report.expeditionId);
  return (
    <li class="expedition-report" data-report={report.expeditionId}>
      <details open={props.open}>
        <summary id={anchor}>
          <Icon name={report.lost ? 'error' : REPORT_ICON} /> <strong>{report.label}</strong> ·{' '}
          {teamLine(report.teamNames)} · Postura {report.postureLabel}
          <span class="muted"> · {reportSummary(report)}</span>
        </summary>
        <ol class="report-steps" aria-label={`O percurso de ${report.label}`}>
          {report.log.map((step, index) => (
            <Step key={`${index}:${step.title}`} step={step} />
          ))}
        </ol>
        <div class="report-close">
          <p>
            <Icon name="package" /> {report.lootText}
          </p>
          {report.itemsText === null ? null : (
            <p>
              <Icon name="package" /> {report.itemsText}
            </p>
          )}
          {report.deedsText === null ? null : (
            <p>
              <Icon name="star-full" /> {report.deedsText}
            </p>
          )}
          <p class={report.lost ? 'warning' : undefined}>
            <Icon name={report.lost ? 'error' : 'shield'} /> {report.lossesText}
          </p>
        </div>
      </details>
    </li>
  );
}
