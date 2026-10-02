import type { GameEvent } from '@lotg/protocol';

import { bandIcon } from '../ui/morale';

export type NotificationLevel = 'silent' | 'essential' | 'all';

export const MAX_NOTIFICATIONS_PER_HOUR = 3;
export const MUTE_DURATION_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * O que pede atenção de verdade: a fome, o frio e a gente que vai embora (o aldeão que parte
 * com a moral baixa e o que deserta na fome longa). A moral que desce de faixa também é alarme,
 * mas isso depende do sentido da mudança: ver `moraleBandDirection`.
 */
const ALARMS: ReadonlyArray<GameEvent['type']> = [
  'famineStarted',
  'coldStarted',
  'villagerLeft',
  'villagerDeserted',
];
/**
 * O alívio de um alarme. Chega a quem recebeu o alarme, no mesmo nível, mas sem o tom de aviso:
 * quem soube que o frio entrou nas casas também fica sabendo que as lareiras voltaram a arder.
 */
const RELIEFS: ReadonlyArray<GameEvent['type']> = ['famineEnded', 'coldEnded'];
/** "Todas" acrescenta o que é bom saber, mas não pede ação imediata. */
const INFORMATIVE: ReadonlyArray<GameEvent['type']> = [
  'constructionFinished',
  // Uma planejada automática começou sem o jogador mandar: gastou recursos e ocupou uma fila.
  // É notícia como o fim de uma obra; a obra que o próprio jogador ordena não avisa.
  'constructionAutoStarted',
  // Um edifício erguido do zero (Celeiro, Armazém) sai com este tipo, no lugar do anterior.
  'buildingFounded',
  'recruitmentFinished',
  'objectiveCompleted',
  // O depósito encheu: nada se quebra, mas a produção passa a ir ao chão. Uma vez por episódio.
  'storageFilled',
  // Um ofício chegou ao máximo da experiência: boa notícia, uma vez por edifício e por ano.
  'craftMastered',
  // Um colono veio sozinho, atraído pela moral alta: boa notícia, como a chegada de um recrutado.
  'villagerArrived',
  // A mudança de faixa da moral só cai aqui quando o evento não diz o sentido; ver `wanted`.
  'moraleBandChanged',
];
/** O ícone próprio de um aviso; sem entrada aqui, vale o do tom (aviso ou informação). */
const ICONS: Partial<Record<GameEvent['type'], string>> = {
  coldStarted: 'flame',
  coldEnded: 'flame',
  // Uma conquista do feudo: a estrela a distingue de um aviso comum.
  craftMastered: 'star-full',
  // Gente que chega e gente que se vai: a perda não se confunde com a fome que a causou.
  villagerArrived: 'person-add',
  villagerLeft: 'sign-out',
  villagerDeserted: 'sign-out',
};

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

/**
 * Para que lado a moral mudou de faixa: o evento traz a moral de antes e a de agora, e basta
 * comparar as duas (o app não conhece os limites das faixas). `null` para outro evento, ou se os
 * números não vierem.
 */
export function moraleBandDirection(event: GameEvent): 'rose' | 'fell' | null {
  const { morale, previousMorale } = event.data;
  if (
    event.type !== 'moraleBandChanged' ||
    typeof morale !== 'number' ||
    typeof previousMorale !== 'number' ||
    morale === previousMorale
  ) {
    return null;
  }
  return morale > previousMorale ? 'rose' : 'fell';
}

/** O evento é um alarme: vira aviso com tom de aviso e passa na frente dos outros. */
export function isEssential(event: GameEvent): boolean {
  return ALARMS.includes(event.type) || moraleBandDirection(event) === 'fell';
}

/**
 * O evento encerra um alarme. A moral que sobe de faixa é o alívio da que desceu: quem soube dos
 * resmungos junto ao poço também fica sabendo que eles cessaram.
 */
export function isRelief(event: GameEvent): boolean {
  return RELIEFS.includes(event.type) || moraleBandDirection(event) === 'rose';
}

/**
 * O codicon do aviso de um evento, quando ele tem um só dele (o frio não se confunde com a
 * fome). A mudança de faixa da moral leva o ícone da faixa nova, o mesmo do cabeçalho.
 */
export function eventIcon(event: GameEvent): string | undefined {
  return event.type === 'moraleBandChanged' ? bandIcon(event.data.band) : ICONS[event.type];
}

function wanted(event: GameEvent, level: NotificationLevel): boolean {
  if (level === 'silent') {
    return false;
  }
  return (
    isEssential(event) || isRelief(event) || (level === 'all' && INFORMATIVE.includes(event.type))
  );
}

/** Com pouco espaço: primeiro os alarmes, depois os alívios, depois o resto. */
function rank(event: GameEvent): number {
  return isEssential(event) ? 0 : isRelief(event) ? 1 : 2;
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
  // Com pouco espaço, o essencial passa na frente. A ordenação é estável: dentro de cada grupo
  // vale a ordem em que as coisas aconteceram.
  const ordered = [...candidates].sort((a, b) => rank(a) - rank(b));
  const room = Math.max(0, MAX_NOTIFICATIONS_PER_HOUR - history.length);
  const show = ordered.slice(0, room);
  return {
    show,
    badge: ordered.length - show.length,
    history: [...history, ...show.map(() => input.now)],
  };
}
