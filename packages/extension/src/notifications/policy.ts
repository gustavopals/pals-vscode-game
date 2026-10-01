import type { GameEvent } from '@lotg/protocol';

export type NotificationLevel = 'silent' | 'essential' | 'all';

export const MAX_NOTIFICATIONS_PER_HOUR = 3;
export const MUTE_DURATION_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** O que pede atenção de verdade. Na v0.1, só a fome. */
const ESSENTIAL: ReadonlyArray<GameEvent['type']> = ['famineStarted'];
/** "Todas" acrescenta o que é bom saber, mas não pede ação imediata. */
const INFORMATIVE: ReadonlyArray<GameEvent['type']> = [
  'constructionFinished',
  'recruitmentFinished',
  'objectiveCompleted',
];

export type PolicyInput = {
  events: GameEvent[];
  level: NotificationLevel;
  discreetMode: boolean;
  /** Instante até o qual o jogador pediu silêncio ("Silenciar 2h"); `null` sem silêncio. */
  mutedUntil: number | null;
  now: number;
  /** Instantes das notificações já exibidas. */
  history: number[];
};

export type PolicyOutput = {
  /** Eventos que viram notificação agora. */
  show: GameEvent[];
  /** Eventos que mereciam notificação, mas ficaram só como badge na árvore. */
  badge: number;
  history: number[];
};

export function isEssential(event: GameEvent): boolean {
  return ESSENTIAL.includes(event.type);
}

function wanted(event: GameEvent, level: NotificationLevel): boolean {
  if (level === 'silent') {
    return false;
  }
  return isEssential(event) || (level === 'all' && INFORMATIVE.includes(event.type));
}

/**
 * Decide o que notificar (GDD §13.5): avisar o essencial, nunca incomodar. No máximo 3 por
 * hora; o que passa do limite, ou chega durante o silêncio de 2 horas, vira badge. No modo
 * discreto e no nível silencioso nada aparece, nem como badge.
 */
export function decideNotifications(input: PolicyInput): PolicyOutput {
  const history = input.history.filter((at) => input.now - at < HOUR_MS);
  const candidates = input.events.filter((event) => wanted(event, input.level));
  if (input.discreetMode || candidates.length === 0) {
    return { show: [], badge: 0, history };
  }
  if (input.mutedUntil !== null && input.now < input.mutedUntil) {
    return { show: [], badge: candidates.length, history };
  }
  // Com pouco espaço, o essencial passa na frente.
  const ordered = [...candidates.filter(isEssential), ...candidates.filter((e) => !isEssential(e))];
  const room = Math.max(0, MAX_NOTIFICATIONS_PER_HOUR - history.length);
  const show = ordered.slice(0, room);
  return {
    show,
    badge: ordered.length - show.length,
    history: [...history, ...show.map(() => input.now)],
  };
}
