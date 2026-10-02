import type { GameEvent, ViewState } from '@lotg/protocol';

import { COUNCIL_ICON } from '../ui/council';
import { clockTime, formatDuration } from '../ui/format';
import { bandIcon } from '../ui/morale';
import { isObjectiveCompleted, OBJECTIVE_DONE_ICON } from '../ui/objectives';
import { DEFENSE_ICON, RAID_ICON, THREAT_ICON, THREAT_UNKNOWN_ICON } from '../ui/threat';

export type NotificationLevel = 'silent' | 'essential' | 'all';

export const MAX_NOTIFICATIONS_PER_HOUR = 3;
export const MUTE_DURATION_MS = 2 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * O que pede atenção de verdade: a fome, o frio, a gente que vai embora (o aldeão que parte
 * com a moral baixa e o que deserta na fome longa) e as incursões (GDD §13.5): o alarme dos
 * vigias, que só chega a quem tem a Torre e ainda dá tempo de agir, e o ataque que custou algo
 * ao feudo. A moral que desce de faixa também é alarme, mas isso depende do sentido da mudança:
 * ver `moraleBandDirection`.
 */
const ALARMS: ReadonlyArray<GameEvent['type']> = [
  'famineStarted',
  'coldStarted',
  'villagerLeft',
  'villagerDeserted',
  'raidAnnounced',
  'raidSuffered',
];
/**
 * O alívio de um alarme. Chega a quem recebeu o alarme, no mesmo nível, mas sem o tom de aviso:
 * quem soube que o frio entrou nas casas também fica sabendo que as lareiras voltaram a arder, e
 * quem ouviu o alarme dos vigias fica sabendo que os lobos recuaram diante da paliçada. É a
 * notícia que paga a Paliçada: chega também a quem não tem a Torre.
 */
const RELIEFS: ReadonlyArray<GameEvent['type']> = ['famineEnded', 'coldEnded', 'raidRepelled'];
/** O desfecho de uma incursão: depois dele, o alarme que a anunciou já não tem o que avisar. */
const RAID_OUTCOMES: ReadonlyArray<GameEvent['type']> = ['raidSuffered', 'raidRepelled'];
/**
 * A virada de estação: muda a produção e os prazos do feudo inteiro, e por isso chega a todos,
 * no nível "Essenciais", mas sem o tom de alarme. O aviso de uma hora antes é `seasonAhead`.
 */
const SEASON_TURN: GameEvent['type'] = 'seasonChanged';
/**
 * Uma carta nova do Conselho (GDD §13.5): espera uma decisão do jogador, com prazo. Chega no
 * nível "Essenciais", sem o tom de alarme: nada se quebrou, o feudo pede uma resposta. O aviso
 * leva o botão "Decidir", e a carta não entra no contador de novidades: enquanto espera, quem a
 * conta é o contador de decisões pendentes, que vem da visão.
 */
const DECISIONS: ReadonlyArray<GameEvent['type']> = ['cardDrawn'];
/**
 * O que se ouve da mata antes de qualquer ataque (GDD §8.2). O relato dos vigias: a Ameaça
 * cruzou uma marca; só chega a quem tem a Torre de Vigia, que foi erguida para isto: saber
 * antes. E os uivos do ano 1, que todo feudo ouve: um prenúncio, sem número, sem prazo e sem
 * tamanho, e o aviso não acrescenta nada à frase da Crônica. Os dois avisam no nível
 * "Essenciais", como a virada de estação, e sem o tom de alarme: nada se perdeu ainda, é hora de
 * se preparar. Não são a incursão, que tem os avisos dela.
 */
const WATCH: ReadonlyArray<GameEvent['type']> = ['threatRose', 'wolvesHowl'];
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
  // O prazo de uma carta acabou e o conselho decidiu sozinho: a frase diz o que foi feito.
  'cardExpired',
  // O que uma opção escondia aconteceu: é quando o jogador descobre a consequência da escolha.
  'cardEffectApplied',
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
  // Tudo o que vem do Conselho leva o ícone dele: a carta nova, a resposta, a que expirou e o
  // efeito tardio.
  cardDrawn: COUNCIL_ICON,
  cardAnswered: COUNCIL_ICON,
  cardExpired: COUNCIL_ICON,
  cardEffectApplied: COUNCIL_ICON,
  // O que os vigias contam leva o olho da Ameaça, o mesmo do painel e da árvore.
  threatRose: THREAT_ICON,
  // A incursão tem o ícone dela, do alarme dos vigias ao relato do ataque; a que a paliçada
  // deteve leva o escudo da defesa.
  raidAnnounced: RAID_ICON,
  raidSuffered: RAID_ICON,
  raidRepelled: DEFENSE_ICON,
  // O objetivo cumprido leva o visto, o mesmo da lista dos objetivos.
  objectiveCompleted: OBJECTIVE_DONE_ICON,
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
  /**
   * Eventos que viram notificação agora. Vários objetivos cumpridos no mesmo lote contam como
   * um aviso só: aqui sai o primeiro deles, e quem o mostra fala de todos.
   */
  show: GameEvent[];
  /**
   * Eventos que mereciam notificação, mas ficaram só como badge na árvore. Uma carta nova não
   * conta aqui: ela já é contada como decisão pendente enquanto espera.
   */
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
  if (event.type === 'moraleBandChanged') {
    return bandIcon(event.data.band);
  }
  if (event.type === 'wolvesHowl') {
    // Os uivos: o olho aberto de quem tem vigias, o fechado de quem não tem. O evento diz qual.
    return event.data.watched === 1 ? THREAT_ICON : THREAT_UNKNOWN_ICON;
  }
  return ICONS[event.type];
}

/** O evento é a virada de estação. */
export function isSeasonTurn(event: GameEvent): boolean {
  return event.type === SEASON_TURN;
}

/** O evento é um prenúncio: o relato dos vigias (a Ameaça cruzou uma marca) ou os uivos. */
export function isWatchReport(event: GameEvent): boolean {
  return WATCH.includes(event.type);
}

/** O evento é o alarme dos vigias: há uma incursão a caminho. */
export function isRaidAlarm(event: GameEvent): boolean {
  return event.type === 'raidAnnounced';
}

/** O evento é o desfecho de uma incursão: o ataque sofrido ou o que a paliçada deteve. */
export function isRaidOutcome(event: GameEvent): boolean {
  return RAID_OUTCOMES.includes(event.type);
}

/**
 * O que o alarme dos vigias diz além da frase da Crônica (GDD §8.2): quando o ataque chega (o
 * prazo e a hora do relógio de quem joga: o aviso fica na tela, e "em 20 min" envelhece), o que
 * ele custa a um feudo sem defesa e o que a Paliçada faz a ele. Tudo é da visão, que chega antes
 * dos eventos; sem incursão à vista nela, nada.
 */
export function raidAhead(
  view: ViewState | null,
  when?: { now: number; timeZone?: string },
): string[] {
  const incoming = view?.threat.incoming ?? null;
  if (incoming === null) {
    return [];
  }
  const clock =
    when === undefined ? null : clockTime(when.now + incoming.inSeconds * 1000, when.timeZone);
  return [
    `Chegada em ${formatDuration(incoming.inSeconds)}${clock === null ? '' : `, às ${clock}`}.`,
    incoming.costText,
    incoming.defenseText,
  ];
}

/**
 * O que o aviso de um ataque sofrido diz além da frase da Crônica, que já conta como o bando
 * chegou, o que levou e o que o teria detido: os feridos de agora, na frase do servidor, com o
 * prazo para sararem. Sem feridos na visão, nada.
 */
export function raidAftermath(view: ViewState | null): string[] {
  const note = view?.population.injuredNote ?? null;
  return note === null ? [] : [note];
}

/** O evento traz uma decisão à espera do jogador: hoje, uma carta nova do Conselho. */
export function isDecision(event: GameEvent): boolean {
  return DECISIONS.includes(event.type);
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
    isEssential(event) ||
    isRelief(event) ||
    isDecision(event) ||
    isWatchReport(event) ||
    (level === 'all' && INFORMATIVE.includes(event.type))
  );
}

/**
 * Com pouco espaço: primeiro os alarmes; depois as cartas novas, os alívios, a virada de
 * estação e o relato dos vigias; depois o resto.
 */
function rank(event: GameEvent): number {
  if (isEssential(event)) {
    return 0;
  }
  return isDecision(event) || isRelief(event) || isSeasonTurn(event) || isWatchReport(event)
    ? 1
    : 2;
}

/** Quantos eventos sem aviso viram badge de novidade: as cartas novas ficam de fora. */
const badgeCount = (events: GameEvent[]) => events.filter((event) => !isDecision(event)).length;

/**
 * Decide o que notificar (GDD §13.5): avisar o essencial, nunca incomodar. No máximo 3 por
 * hora; o que passa do limite, ou chega durante o silêncio de 2 horas, vira badge. No modo
 * discreto e no nível silencioso nada aparece, nem como badge.
 */
export function decideNotifications(input: PolicyInput): PolicyOutput {
  const history = input.history.filter((at) => input.now - at < HOUR_MS);
  // A incursão que o mesmo lote já conta como resolvida não tem mais o que avisar: o alarme dos
  // vigias sai de cena, e quem fala é o desfecho.
  const settled = new Set(input.events.filter(isRaidOutcome).map((event) => event.data.raidId));
  // Vários objetivos cumpridos de uma vez (o que o feudo já tinha feito conta quando o objetivo
  // aparece, e concluir um revela o seguinte) são uma notícia só: o primeiro fala por todos, e
  // os outros não gastam os avisos da hora nem entram no contador.
  const firstObjective = input.events.find(isObjectiveCompleted);
  const candidates = input.events.filter(
    (event) =>
      wanted(event, input.level, input.season) &&
      !(isRaidAlarm(event) && settled.has(event.data.raidId)) &&
      !(isObjectiveCompleted(event) && event !== firstObjective),
  );
  if (input.discreetMode || candidates.length === 0) {
    return { show: [], badge: 0, history };
  }
  if (input.mutedUntil !== null && input.now < input.mutedUntil) {
    return { show: [], badge: badgeCount(candidates), history };
  }
  // Com pouco espaço, o essencial passa na frente. A ordenação é estável: dentro de cada grupo
  // vale a ordem em que as coisas aconteceram.
  const ordered = [...candidates].sort((a, b) => rank(a) - rank(b));
  const room = Math.max(0, MAX_NOTIFICATIONS_PER_HOUR - history.length);
  const show = ordered.slice(0, room);
  return {
    show,
    badge: badgeCount(ordered.slice(room)),
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
