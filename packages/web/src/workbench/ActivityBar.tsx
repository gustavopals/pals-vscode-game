import { Icon } from '../components/shared';

export const ACTIVITIES = ['fief', 'chronicle', 'account'] as const;
export type Activity = (typeof ACTIVITIES)[number];

export const ACTIVITY_LABELS: Record<Activity, string> = {
  fief: 'Feudo',
  chronicle: 'Crônica',
  account: 'Conta',
};

const ICONS: Record<Activity, string> = { fief: 'shield', chronicle: 'book', account: 'account' };

/** A barra de atividades: escolhe o que a barra lateral mostra; clicar na ativa a recolhe. */
export function ActivityBar(props: {
  active: Activity;
  sidebarOpen: boolean;
  /** Novidades ainda não vistas, no badge do Feudo. */
  unseen: number;
  onSelect: (activity: Activity) => void;
  onCommand: (id: string) => void;
}) {
  return (
    <nav class="activitybar" aria-label="Barra de atividades">
      <ul>
        {ACTIVITIES.map((activity) => {
          const pressed = props.sidebarOpen && props.active === activity;
          const badge = activity === 'fief' && props.unseen > 0 ? props.unseen : 0;
          const label =
            badge > 0
              ? `${ACTIVITY_LABELS[activity]}: ${badge} ${badge === 1 ? 'novidade' : 'novidades'}`
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
