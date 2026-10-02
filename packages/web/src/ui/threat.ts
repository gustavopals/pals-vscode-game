import type { ViewState } from '@lotg/protocol';

import {
  busyQueues,
  capitalize,
  formatApprox,
  formatCost,
  formatDuration,
  formatNumber,
  formatRemaining,
  planWaiting,
  remainingNow,
} from './format';

/**
 * A Ameaça como texto (GDD §8.2). Sem a Torre de Vigia o servidor não manda o número, a
 * tendência, as origens, os tiles nem a incursão: a visão vem em outra forma (`known: false`), e
 * aqui só há a frase da névoa, o que a Torre daria e o que protege o feudo. Com a Torre, tudo vem
 * pronto: o número, a frase da tendência, as origens termo a termo e o aviso dos vigias. O app
 * não conhece quanto a Ameaça sobe por dia, as marcas da Crônica, a chance de uma incursão nem a
 * antecedência do aviso; escolhe o ícone e as palavras de ligação.
 */

type Threat = ViewState['threat'];
/** A Ameaça de quem tem a Torre: é a única forma que traz o número. */
export type WatchedThreat = Extract<Threat, { known: true }>;
type Constructions = ViewState['constructions'];
type Upgrade = Constructions['available'][number];
type Queue = NonNullable<Constructions['queues'][number]>;
type Plan = Constructions['planned'][number];

/** Com a Torre, os vigias veem: o olho aberto. Sem ela, o olho fechado. O texto diz o resto. */
export const THREAT_ICON = 'eye';
export const THREAT_UNKNOWN_ICON = 'eye-closed';
/** O aviso dos vigias de que há uma incursão a caminho: não é o ícone da fome nem o do frio. */
export const RAID_ICON = 'megaphone';
/** O que protege o feudo de um ataque. */
export const DEFENSE_ICON = 'shield';

export function threatIcon(threat: Pick<Threat, 'known'>): string {
  return threat.known ? THREAT_ICON : THREAT_UNKNOWN_ICON;
}

/**
 * Em que pé está a obra da Torre, pelo que a visão diz das construções: em obras (uma fila a
 * leva), à espera de uma ordem (está na lista do que pode ser construído, talvez já planejada),
 * ou sem nada a ordenar (a Torre chegou ao teto desta versão).
 */
export type WatchtowerWork =
  | { kind: 'underway'; queue: Queue }
  | { kind: 'available'; upgrade: Upgrade; plan: Plan | null }
  | { kind: 'none' };

export function watchtowerWork(view: Pick<ViewState, 'threat' | 'constructions'>): WatchtowerWork {
  const { building } = view.threat.watchtower;
  const queue = busyQueues(view.constructions).find((entry) => entry.building === building);
  if (queue !== undefined) {
    return { kind: 'underway', queue };
  }
  const upgrade = view.constructions.available.find((entry) => entry.building === building);
  if (upgrade === undefined) {
    return { kind: 'none' };
  }
  const plan = view.constructions.planned.find((entry) => entry.building === building) ?? null;
  return { kind: 'available', upgrade, plan };
}

/** O custo e o prazo da obra da Torre, lado a lado: "120 madeira, 120 pedra, 50 ouro · 12 min". */
export function watchtowerTerms(upgrade: Pick<Upgrade, 'cost' | 'durationSeconds'>): string {
  return `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`;
}

/** "Planejada, com início automático · espera 30 de madeira: em 1 h 15 min." */
export function watchtowerPlanLine(plan: Plan, elapsedSeconds: number): string {
  const lead = plan.autoStart ? 'Planejada, com início automático' : 'Planejada';
  return `${lead} · ${planWaiting(plan, elapsedSeconds)}.`;
}

/**
 * A Ameaça sobe na próxima virada do dia. O servidor manda zero quando ela já está no máximo, e
 * a frase da tendência diz isso por extenso.
 */
export function threatRising(threat: Pick<WatchedThreat, 'risePerDay'>): boolean {
  return threat.risePerDay > 0;
}

/** Os tiles de ameaça que os vigias conhecem: "Covil de Lobos (ativo)". */
export function tileLine(tile: WatchedThreat['tiles'][number]): string {
  return `${tile.label} (${tile.active ? 'ativo' : 'inativo'})`;
}

/**
 * O que a linha "Ameaça" da árvore diz depois do nome (GDD §13.2): "46 · Covil de Lobos". Com
 * uma incursão à vista, o aviso toma o lugar dos tiles, com o sinal ao lado do texto: "46 · ⚠
 * Lobos em 16 min". Sem a Torre não há número: "desconhecida · sem Torre de Vigia" (o nome é o
 * que a lista de obras traz) ou, com ela em obras, "desconhecida · Torre de Vigia em obras".
 */
export function threatTreeLine(
  view: Pick<ViewState, 'threat' | 'constructions'>,
  elapsedSeconds: number,
): string {
  const { threat } = view;
  if (!threat.known) {
    const work = watchtowerWork(view);
    if (work.kind === 'underway') {
      return `desconhecida · ${work.queue.label} em obras`;
    }
    return work.kind === 'available' ? `desconhecida · sem ${work.upgrade.label}` : 'desconhecida';
  }
  const level = formatNumber(threat.level);
  if (threat.incoming !== null) {
    const left = remainingNow(threat.incoming.inSeconds, elapsedSeconds);
    return `${level} · ⚠ ${threat.incoming.enemyLabel} em ${formatApprox(left)}`;
  }
  const active = threat.tiles.filter((tile) => tile.active).map((tile) => tile.label);
  return active.length === 0 ? level : `${level} · ${active.join(', ')}`;
}

/** Em que pé está a obra da Torre, em uma frase, para a explicação da linha da árvore. */
function workLine(work: WatchtowerWork, elapsedSeconds: number): string | null {
  if (work.kind === 'underway') {
    const left = formatRemaining(remainingNow(work.queue.secondsRemaining, elapsedSeconds));
    return `${work.queue.label} → Nv${work.queue.targetLevel} em obras: termina em ${left}.`;
  }
  if (work.kind === 'none') {
    return null;
  }
  const { upgrade, plan } = work;
  return [
    `${capitalize(watchtowerTerms(upgrade))}.`,
    ...(plan === null ? [] : [watchtowerPlanLine(plan, elapsedSeconds)]),
    ...(upgrade.blockedReason === null ? [] : [upgrade.blockedReason]),
  ].join(' ');
}

/**
 * A explicação da Ameaça, frase a frase, como o servidor a escreveu. Sem a Torre: a névoa, o que
 * a Torre daria, o que a obra custa (ou o que a impede) e o que protege o feudo. Com ela: o
 * número, a tendência com o prazo da próxima virada, as origens, a incursão à vista, o que a
 * Torre faz, o que o próximo nível acrescenta e o que protege o feudo.
 */
export function threatLines(
  view: Pick<ViewState, 'threat' | 'constructions'>,
  elapsedSeconds: number,
): string[] {
  const { threat } = view;
  const { watchtower, defense } = threat;
  const work = workLine(watchtowerWork(view), elapsedSeconds);
  const ahead = [
    ...(watchtower.next === null ? [] : [watchtower.next]),
    ...(work === null ? [] : [work]),
  ];
  if (!threat.known) {
    return [threat.text, ...ahead, defense.text];
  }
  const due = formatDuration(remainingNow(threat.nextRiseInSeconds, elapsedSeconds));
  const { incoming } = threat;
  return [
    threat.text,
    threatRising(threat) ? `${threat.trend} Faltam ${due}.` : threat.trend,
    ...threat.sources,
    ...(incoming === null
      ? []
      : [
          `${incoming.text} Chegada em ${formatDuration(remainingNow(incoming.inSeconds, elapsedSeconds))}.`,
        ]),
    watchtower.text,
    ...ahead,
    defense.text,
  ];
}
