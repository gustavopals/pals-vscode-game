import type { GameEvent, ViewState } from '@lotg/protocol';

import { formatDuration } from '../ui/format';
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
/**
 * A virada de estação: muda a produção e os prazos do feudo inteiro, e por isso chega a todos,
 * no nível "Essenciais", mas sem o tom de alarme. O aviso de uma hora antes é `seasonAhead`.
 */
const SEASON_TURN: GameEvent['type'] = 'seasonChanged';
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
/** O ícone dos dois avisos de estação: o de uma hora antes e o da virada. */
export const SEASON_ICON = 'calendar';
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
  // A estação que chega: o calendário, igual ao do aviso de uma hora antes.
  seasonChanged: SEASON_ICON,
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
  /**
   * A estação que vale agora (`calendar.season` da visão). Com ela, a virada para uma estação
   * que já passou não vira aviso: um salto longo com a aba ao fundo traz mais de uma virada, e
   * só a última é novidade. Sem ela, toda virada passa.
   */
  season?: string | null;
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

/** O evento é a virada de estação. */
export function isSeasonTurn(event: GameEvent): boolean {
  return event.type === SEASON_TURN;
}

function wanted(
  event: GameEvent,
  level: NotificationLevel,
  season: string | null | undefined,
): boolean {
  if (level === 'silent') {
    return false;
  }
  if (isSeasonTurn(event)) {
    // Só a estação que está valendo é novidade.
    return season === undefined || season === null || event.data.season === season;
  }
  return (
    isEssential(event) || isRelief(event) || (level === 'all' && INFORMATIVE.includes(event.type))
  );
}

/** Com pouco espaço: primeiro os alarmes, depois os alívios e a virada de estação, depois o resto. */
function rank(event: GameEvent): number {
  return isEssential(event) ? 0 : isRelief(event) || isSeasonTurn(event) ? 1 : 2;
}

/**
 * Decide o que notificar (GDD §13.5): avisar o essencial, nunca incomodar. No máximo 3 por
 * hora; o que passa do limite, ou chega durante o silêncio de 2 horas, vira badge. No modo
 * discreto e no nível silencioso nada aparece, nem como badge.
 */
export function decideNotifications(input: PolicyInput): PolicyOutput {
  const history = input.history.filter((at) => input.now - at < HOUR_MS);
  const candidates = input.events.filter((event) => wanted(event, input.level, input.season));
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

/**
 * Com quanto tempo de antecedência a virada de estação é anunciada: uma hora de relógio. É
 * escolha de apresentação, não regra: o prazo (`calendar.nextSeason.secondsUntil`) já vem do
 * servidor em tempo real, em qualquer ritmo, e o app não converte nada.
 */
export const SEASON_WARNING_SECONDS = 60 * 60;

/** O aviso de que uma estação está para chegar. */
export type SeasonNotice = {
  /** O ano e a estação anunciada ("1:winter"): um aviso por virada, nunca dois. */
  key: string;
  /** Alerta quando a lenha da estação que vem não chega, ou a comida acaba nela; no resto, notícia. */
  kind: 'info' | 'warning';
  /** "Inverno à vista: chega em 1 h, às 21:40." */
  text: string;
  /** Uma frase para cada coisa que muda na virada, como o servidor as escreveu. */
  details: string[];
};

/**
 * A hora do relógio de quem joga em que um prazo vence: "21:40". O aviso fica na tela até ser
 * dispensado, e "em 59 min" envelhece; a hora, não. `null` se o fuso não for conhecido.
 */
function clockTime(atMs: number, timeZone: string | undefined): string | null {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      // De 00 a 23: meia-noite e meia é "00:30", nunca "24:30".
      hourCycle: 'h23',
      ...(timeZone === undefined ? {} : { timeZone }),
    }).format(new Date(atMs));
  } catch {
    return null;
  }
}

/**
 * O aviso de uma hora antes da virada (GDD §13.5), ou `null` enquanto ela está mais longe. Diz
 * o que muda com as frases de `calendar.nextSeason.changes` e, quando a estação que vem queima
 * lenha e a conta não fecha, ou quando a comida acaba nela, a conta do servidor, que é o que
 * pede uma ação. Não prevê sorteio nem promete nada: só repete o que a visão já traz.
 *
 * `when` é o instante em que a visão chegou e o fuso de quem joga: com eles o aviso diz também a
 * hora do relógio em que a estação vira. É só a soma do prazo, que já vem em tempo real, ao
 * relógio do navegador.
 */
export function seasonAhead(
  view: ViewState,
  when?: { now: number; timeZone?: string },
): SeasonNotice | null {
  const { year, nextSeason } = view.calendar;
  if (nextSeason.secondsUntil > SEASON_WARNING_SECONDS) {
    return null;
  }
  const short = nextSeason.firewood !== null && nextSeason.firewood.missing > 0;
  // A comida que acaba na estação que vem: a previsão do servidor, que atravessa a virada.
  const hungry = nextSeason.food != null && nextSeason.food.depletesInSeconds !== null;
  const clock =
    when === undefined ? null : clockTime(when.now + nextSeason.secondsUntil * 1000, when.timeZone);
  return {
    key: `${year}:${nextSeason.id}`,
    kind: short || hungry ? 'warning' : 'info',
    text:
      `${nextSeason.label} à vista: chega em ${formatDuration(nextSeason.secondsUntil)}` +
      `${clock === null ? '' : `, às ${clock}`}.`,
    details: [
      ...nextSeason.changes,
      ...(short && nextSeason.firewood ? [nextSeason.firewood.text] : []),
      ...(hungry && nextSeason.food ? [nextSeason.food.text] : []),
    ],
  };
}

/**
 * O que o aviso da virada diz além da frase da Crônica: as mesmas frases do aviso de uma hora
 * antes, guardadas de quando a estação ainda era a próxima (`remembered`). Sem elas (página
 * aberta depois da virada), a frase do que a estação de agora muda; e, se a visão já é de outra
 * estação, nada.
 */
export function seasonArrival(
  event: GameEvent,
  remembered: readonly string[] | undefined,
  view: ViewState | null,
): string[] {
  if (remembered !== undefined && remembered.length > 0) {
    return [...remembered];
  }
  return view !== null && view.calendar.season === event.data.season
    ? [view.calendar.seasonEffects]
    : [];
}

/**
 * Decide o destino de um aviso essencial que não nasce de um evento (o de uma hora antes da
 * virada), com as mesmas regras de `decideNotifications`: nada no nível silencioso e no modo
 * discreto; contador durante o silêncio de 2 horas e quando as 3 da hora já foram exibidas.
 */
export function decideNotice(input: Omit<PolicyInput, 'events' | 'season'>): {
  outcome: 'show' | 'badge' | 'skip';
  history: number[];
} {
  const history = input.history.filter((at) => input.now - at < HOUR_MS);
  if (input.level === 'silent' || input.discreetMode) {
    return { outcome: 'skip', history };
  }
  if (
    (input.mutedUntil !== null && input.now < input.mutedUntil) ||
    history.length >= MAX_NOTIFICATIONS_PER_HOUR
  ) {
    return { outcome: 'badge', history };
  }
  return { outcome: 'show', history: [...history, input.now] };
}
