import type { ViewState } from '@lotg/protocol';

import { formatDuration, remainingNow } from '../ui/format';
import type { Actions } from './actions';
import { Icon } from './shared';

type Army = ViewState['army'];
type Campaign = NonNullable<Army['campaign']>;

/**
 * O painel da campanha militar (V4F-T3): o exército em marcha ou retornando do Acampamento.
 * Exibe a situação, o destino, a formação, os prazos de batalha e retorno, e o aviso de que
 * as tropas não defendem o feudo enquanto estão em campanha.
 */
export function CampaignPanel(props: { campaign: Campaign; elapsed: number; actions: Actions }) {
  const { campaign, elapsed } = props;
  const returnsLeft = remainingNow(campaign.returnsInSeconds, elapsed);
  const battleLeft = remainingNow(campaign.battleInSeconds, elapsed);

  return (
    <section
      class="campaign-panel"
      aria-labelledby="campaign-status-title"
      data-testid="campaign-panel"
    >
      <h3 id="campaign-status-title">Campanha militar</h3>
      <p class="campaign-text" data-testid="campaign-text">
        <Icon name="shield" /> <strong>{campaign.text}</strong>
      </p>
      <dl class="campaign-details">
        <div>
          <dt>Destino</dt>
          <dd data-testid="campaign-destination">{campaign.destination}</dd>
        </div>
        <div>
          <dt>Formação</dt>
          <dd data-testid="campaign-formation">{campaign.formationName}</dd>
        </div>
        {campaign.phase === 'marching' && battleLeft > 0 ? (
          <div>
            <dt>Batalha em</dt>
            <dd data-testid="campaign-battle-in">{formatDuration(battleLeft)}</dd>
          </div>
        ) : null}
        <div>
          <dt>Retorno em</dt>
          <dd data-testid="campaign-returns-in">
            {returnsLeft > 0 ? formatDuration(returnsLeft) : 'chegando ao feudo'}
          </dd>
        </div>
      </dl>
      <p class="muted" data-testid="campaign-warning">
        Soldados e comandantes em marcha não defendem o feudo até retornarem.
      </p>
      {campaign.reportId !== null ? (
        <p class="campaign-report-action">
          <button
            type="button"
            data-testid="campaign-see-report"
            onClick={() => props.actions.run('lords.openBattleReport', campaign.reportId)}
          >
            <Icon name="book" /> Ver relatório de batalha
          </button>
        </p>
      ) : null}
    </section>
  );
}
