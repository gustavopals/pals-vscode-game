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
 * pronto: o número, a frase da tendência, as origens termo a termo, a chance de uma incursão, o
 * que cada tamanho de ataque custa e o aviso dos vigias, com o que o ataque que vem custa e o
 * que a Paliçada faz a ele. O app não conhece quanto a Ameaça sobe por dia, as marcas da Crônica,
 * a chance de uma incursão, a antecedência do aviso, o estrago de um ataque nem o que cada nível
 * da Paliçada segura; escolhe o ícone e as palavras de ligação.
 */

type Threat = ViewState['threat'];
/** A Ameaça de quem tem a Torre: é a única forma que traz o número. */
export type WatchedThreat = Extract<Threat, { known: true }>;
type Constructions = ViewState['constructions'];
type Upgrade = Constructions['available'][number];
type Queue = NonNullable<Constructions['queues'][number]>;
type Plan = Constructions['planned'][number];

/**
 * O painel "Ameaça" da aba Feudo, como destino: é o argumento de `lords.openPanel` que leva a
 * página e o foco até ele ("Ver a defesa", o clique na barra de status com uma incursão à vista,
 * o "Ver" de um aviso de incursão) e a âncora do título do painel.
 */
export const THREAT_SECTION = 'threat';
export const THREAT_ANCHOR = 'threat-title';

/** Com a Torre, os vigias veem: o olho aberto. Sem ela, o olho fechado. O texto diz o resto. */
export const THREAT_ICON = 'eye';
export const THREAT_UNKNOWN_ICON = 'eye-closed';
/**
 * A incursão, do alarme dos vigias ao relato do ataque: não é o ícone da fome nem o do frio. O
 * ataque que a paliçada deteve leva o da defesa.
 */
export const RAID_ICON = 'megaphone';
/** O que protege o feudo de um ataque. */
export const DEFENSE_ICON = 'shield';
/** Quem saiu ferido de um ataque e não trabalha até sarar. */
export const INJURED_ICON = 'pulse';

export function threatIcon(threat: Pick<Threat, 'known'>): string {
  return threat.known ? THREAT_ICON : THREAT_UNKNOWN_ICON;
}

/**
 * Em que pé está a obra de um edifício (os dois da Ameaça, a Torre de Vigia e a Paliçada, e o
 * que um objetivo pede), pelo que a visão diz das construções: em obras (uma fila a leva), à
 * espera de uma ordem (está na lista do que pode ser construído, talvez já planejada), ou sem
 * nada a ordenar (o edifício chegou ao teto desta versão).
 */
export type DefenseWork =
  | { kind: 'underway'; queue: Queue }
  | { kind: 'available'; upgrade: Upgrade; plan: Plan | null }
  | { kind: 'none' };

export function buildingWork(
  constructions: Constructions,
  building: Upgrade['building'],
): DefenseWork {
  const queue = busyQueues(constructions).find((entry) => entry.building === building);
  if (queue !== undefined) {
    return { kind: 'underway', queue };
  }
  const upgrade = constructions.available.find((entry) => entry.building === building);
  if (upgrade === undefined) {
    return { kind: 'none' };
  }
  const plan = constructions.planned.find((entry) => entry.building === building) ?? null;
  return { kind: 'available', upgrade, plan };
}

/** A obra da Torre de Vigia: o edifício é o que a visão diz (`threat.watchtower.building`). */
export function watchtowerWork(view: Pick<ViewState, 'threat' | 'constructions'>): DefenseWork {
  return buildingWork(view.constructions, view.threat.watchtower.building);
}

/** A obra da Paliçada: o edifício é o que a visão diz (`threat.defense.building`). */
export function palisadeWork(view: Pick<ViewState, 'threat' | 'constructions'>): DefenseWork {
  return buildingWork(view.constructions, view.threat.defense.building);
}

/** O custo e o prazo de uma obra, lado a lado: "120 madeira, 120 pedra, 50 ouro · 12 min". */
export function workTerms(upgrade: Pick<Upgrade, 'cost' | 'durationSeconds'>): string {
  return `${formatCost(upgrade.cost)} · ${formatDuration(upgrade.durationSeconds)}`;
}

/** "Planejada, com início automático · espera 30 de madeira: em 1 h 15 min." */
export function workPlanLine(plan: Plan, elapsedSeconds: number): string {
  const lead = plan.autoStart ? 'Planejada, com início automático' : 'Planejada';
  return `${lead} · ${planWaiting(plan, elapsedSeconds)}.`;
}

/** A obra pode ser ordenada agora: está na lista e nada a impede. */
function orderable(work: DefenseWork): Upgrade | null {
  return work.kind === 'available' && work.upgrade.blockedReason === null ? work.upgrade : null;
}

/**
 * A obra que o botão da linha "Ameaça" da árvore ordena, se houver uma que possa começar agora.
 * Sem a Torre de Vigia, a Torre: é a saída da névoa. Com ela (ou enquanto a obra dela não pode
 * ser ordenada), a da Paliçada: é o que muda o desfecho do próximo ataque. `null` quando nenhuma
 * das duas pode começar: a explicação da linha diz o que as impede.
 */
export function threatRowWork(view: Pick<ViewState, 'threat' | 'constructions'>): Upgrade | null {
  const tower = view.threat.known ? null : orderable(watchtowerWork(view));
  return tower ?? orderable(palisadeWork(view));
}

/**
 * O prazo da obra da Paliçada ao lado do prazo do ataque que os vigias avistaram: "A obra leva
 * 20 min; o ataque chega em 15 min 40 s." Os dois números vêm do servidor e ficam lado a lado
 * para o jogador pesar antes de gastar; se dá tempo, quem diz é o servidor, na frase da defesa,
 * assim que a obra começa. `null` sem incursão à vista.
 */
export function palisadeRace(
  view: Pick<ViewState, 'threat'>,
  upgrade: Pick<Upgrade, 'durationSeconds'>,
  elapsedSeconds: number,
  time: (seconds: number) => string = formatDuration,
): string | null {
  const { incoming } = view.threat;
  if (incoming === null) {
    return null;
  }
  const left = remainingNow(incoming.inSeconds, elapsedSeconds);
  return `A obra leva ${formatDuration(upgrade.durationSeconds)}; o ataque chega em ${time(left)}.`;
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

/** Em que pé está a obra de um edifício, em uma frase, para a explicação da linha da árvore. */
function workLine(work: DefenseWork, elapsedSeconds: number): string | null {
  if (work.kind === 'underway') {
    const left = formatRemaining(remainingNow(work.queue.secondsRemaining, elapsedSeconds));
    return `${work.queue.label} → Nv${work.queue.targetLevel} em obras: termina em ${left}.`;
  }
  if (work.kind === 'none') {
    return null;
  }
  const { upgrade, plan } = work;
  return [
    `${capitalize(workTerms(upgrade))}.`,
    ...(plan === null ? [] : [workPlanLine(plan, elapsedSeconds)]),
    ...(upgrade.blockedReason === null ? [] : [upgrade.blockedReason]),
  ].join(' ');
}

/**
 * A explicação da Ameaça, frase a frase, como o servidor a escreveu. Sem a Torre: a névoa, o que
 * a Torre daria, o que a obra custa (ou o que a impede), o que protege o feudo, o que a próxima
 * obra da Paliçada mudaria e o custo dela. Com a Torre: o número, a tendência com o prazo da
 * próxima virada, as origens, a chance de uma incursão, a incursão à vista com o que ela custa e
 * o que a Paliçada faz a ela, a defesa com a sua obra, e por fim a Torre e o que o próximo nível
 * dela acrescenta.
 */
export function threatLines(
  view: Pick<ViewState, 'threat' | 'constructions'>,
  elapsedSeconds: number,
): string[] {
  const { threat } = view;
  const { watchtower, defense } = threat;
  const towerWork = workLine(watchtowerWork(view), elapsedSeconds);
  const tower = [
    ...(watchtower.next === null ? [] : [watchtower.next]),
    ...(towerWork === null ? [] : [towerWork]),
  ];
  const fenceWork = workLine(palisadeWork(view), elapsedSeconds);
  const fence = [
    defense.text,
    ...(defense.next === null ? [] : [defense.next]),
    ...(fenceWork === null ? [] : [fenceWork]),
  ];
  if (!threat.known) {
    return [threat.text, ...tower, ...fence];
  }
  const due = formatDuration(remainingNow(threat.nextRiseInSeconds, elapsedSeconds));
  const { incoming } = threat;
  return [
    threat.text,
    threatRising(threat) ? `${threat.trend} Faltam ${due}.` : threat.trend,
    ...threat.sources,
    threat.raidRisk,
    ...(incoming === null
      ? threat.raidCosts
      : [
          `${incoming.text} Chegada em ${formatDuration(remainingNow(incoming.inSeconds, elapsedSeconds))}.`,
          incoming.costText,
          incoming.defenseText,
        ]),
    ...fence,
    watchtower.text,
    ...tower,
  ];
}
