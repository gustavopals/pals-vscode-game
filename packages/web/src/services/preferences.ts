import type { NotificationLevel } from '../notifications/policy';
import type { KeyValueStore } from './store';
import { PREFERENCES_KEY } from './tabSync';

export const THEMES = ['dark', 'light', 'high-contrast'] as const;
export type ThemeId = (typeof THEMES)[number];

/** As escolhas do jogador neste navegador. Não vão para o servidor. */
export type Preferences = {
  notifications: NotificationLevel;
  /** Barra de status e título da aba mostram só um contador; nenhum aviso aparece. */
  discreetMode: boolean;
  /** Hora local (0 a 23) da Vigília, enviada ao fundar um feudo. */
  vigilHour: number;
  /** `null` enquanto o jogador não escolheu: vale a preferência do sistema. */
  theme: ThemeId | null;
  /** Avisos pelo sistema de notificações do navegador, com a aba em segundo plano. */
  browserNotifications: boolean;
  /** Instante até o qual os avisos estão silenciados ("Silenciar 2h"). */
  mutedUntil: number | null;
};

export const DEFAULT_PREFERENCES: Preferences = {
  notifications: 'essential',
  discreetMode: false,
  vigilHour: 20,
  theme: null,
  browserNotifications: false,
  mutedUntil: null,
};

const LEVELS: readonly NotificationLevel[] = ['silent', 'essential', 'all'];

/** Lê as preferências, trocando pelo padrão tudo o que não tiver a forma esperada. */
export function loadPreferences(store: KeyValueStore): Preferences {
  const raw = store.get<Partial<Record<keyof Preferences, unknown>>>(PREFERENCES_KEY);
  const saved = typeof raw === 'object' && raw !== null ? raw : {};
  const hour = saved.vigilHour;
  return {
    notifications: LEVELS.includes(saved.notifications as NotificationLevel)
      ? (saved.notifications as NotificationLevel)
      : DEFAULT_PREFERENCES.notifications,
    discreetMode: saved.discreetMode === true,
    vigilHour:
      typeof hour === 'number' && Number.isInteger(hour) && hour >= 0 && hour <= 23
        ? hour
        : DEFAULT_PREFERENCES.vigilHour,
    theme: THEMES.includes(saved.theme as ThemeId) ? (saved.theme as ThemeId) : null,
    browserNotifications: saved.browserNotifications === true,
    mutedUntil: typeof saved.mutedUntil === 'number' ? saved.mutedUntil : null,
  };
}

export async function savePreferences(store: KeyValueStore, preferences: Preferences) {
  await store.update(PREFERENCES_KEY, preferences);
}
