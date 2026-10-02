import { Icon } from '../components/shared';
import { joinList, pendingDecisionsLabel } from '../ui/format';

export const ACTIVITIES = ['fief', 'chronicle', 'account'] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  fief: 'Feudo',
  chronicle: 'Crônica',
  account: 'Conta',
};

const ICONS: Record<Activity, string> = { fief: 'shield', chronicle: 'book', account: 'account' };

/**
 * O que o badge do Feudo diz por extenso: "1 decisão pendente", "2 novidades", ou os dois. As
 * decisões vêm primeiro: têm prazo.
 */
export function badgeLabel(decisions: number, unseen: number): string {
  return joinList([
    ...(decisions > 0 ? [pendingDecisionsLabel(decisions)] : []),
    ...(unseen > 0 ? [`${unseen} ${unseen === 1 ? 'novidade' : 'novidades'}`] : []),
  ]);
}

/** A barra de atividades: escolhe o que a barra lateral mostra; clicar na ativa a recolhe. */
export function ActivityBar(props: {
  active: Activity;
  sidebarOpen: boolean;
  /** Novidades ainda não vistas, no badge do Feudo. */
  unseen: number;
  /** Decisões à espera do jogador (as cartas do Conselho): entram no mesmo badge. */
  decisions?: number;
  onSelect: (activity: Activity) => void;
  onCommand: (id: string) => void;
}) {
  const decisions = props.decisions ?? 0;
  return (
    <nav class="activitybar" aria-label="Barra de atividades">
      <ul>
        {ACTIVITIES.map((activity) => {
          const pressed = props.sidebarOpen && props.active === activity;
          const badge = activity === 'fief' ? props.unseen + decisions : 0;
          const label =
            badge > 0
              ? `${ACTIVITY_LABELS[activity]}: ${badgeLabel(decisions, props.unseen)}`
              : ACTIVITY_LABELS[activity];
          return (
            <li key={activity}>
              <button
                type="button"
                class="activity"
                aria-pressed={pressed}
                aria-label={label}
                title={ACTIVITY_LABELS[activity]}
                onClick={() => props.onSelect(activity)}
              >
                <Icon name={ICONS[activity]} />
                {badge > 0 ? (
                  <span class="activity-badge" aria-hidden="true">
                    {badge > 99 ? '99+' : badge}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
      <ul>
        <li>
          <button
            type="button"
            class="activity"
            aria-label="Preferências"
            title="Preferências"
            onClick={() => props.onCommand('lords.openSettings')}
          >
            <Icon name="gear" />
          </button>
        </li>
      </ul>
    </nav>
  );
}
