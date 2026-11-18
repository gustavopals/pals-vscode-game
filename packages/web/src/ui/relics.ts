import type { ViewState } from '@lotg/protocol';

import {
  busyQueues,
  formatDuration,
  formatNumber,
  formatRemaining,
  joinList,
  remainingNow,
} from './format';
import { workTerms } from './threat';

/**
 * A Capela e as relíquias como texto (v0.5, Fase B; ADR 0022): o que o painel na aba da Guilda, a
 * árvore, a paleta e o ciclo de leitura dizem dos espaços da Capela e dos tesouros guardados pelo
 * feudo. Nenhuma regra nem frase de conteúdo mora aqui: limites, efeitos, prazos de vigência e
 * motivos de bloqueio vêm prontos em `view.relics` e `view.constructions`.
 */

export type Relics = ViewState['relics'];
export type Relic = Relics['items'][number];

/** O ícone da Capela e das relíquias na aba, na árvore e na paleta. */
export const RELIC_ICON = 'sparkle';

/** A âncora do painel na aba Guilda e o argumento de `lords.openPanel` que leva a ela. */
export const RELICS_ANCHOR = 'relics-title';
export const RELICS_SECTION = 'relics';

/** Os nós da árvore para a Capela e para cada relíquia. */
export const CHAPEL_NODE = 'chapel';
export const RELIC_NODE = 'relic:';

/** Lê `view.relics` com fallback seguro para visões sintéticas antigas de teste. */
export function relicsOf(view: Pick<ViewState, 'relics'>): Relics {
  return view.relics ?? { slots: 0, items: [] };
}

/** Quantas relíquias estão colocadas na Capela agora. */
export function placedRelicsCount(relics: Relics): number {
  return relics.items.filter((item) => item.placed).length;
}

/** Quantas relíquias colocadas já estão em vigor. */
export function activeRelicsCount(relics: Relics): number {
  return relics.items.filter((item) => item.active).length;
}

/** A Capela está em obras numa das filas de construção. */
export function chapelInWorks(
  constructions: ViewState['constructions'],
): ReturnType<typeof busyQueues>[number] | undefined {
  return busyQueues(constructions).find((queue) => queue.building === 'chapel');
}

/**
 * Sem Capela (`slots === 0`), a linha curta dizendo o que falta para erguê-la, lida da visão
 * (`constructions.queues`, `constructions.available` ou o bloqueio da própria relíquia). `null`
 * quando a Capela já está de pé.
 */
export function chapelMissingLine(
  view: Pick<ViewState, 'relics' | 'constructions'>,
  elapsedSeconds = 0,
): string | null {
  const relics = relicsOf(view);
  if (relics.slots > 0) {
    return null;
  }
  const active = chapelInWorks(view.constructions);
  if (active !== undefined) {
    const left = remainingNow(active.secondsRemaining, elapsedSeconds);
    return `${active.label} → Nv${active.targetLevel} em obras: termina em ${formatRemaining(left)}.`;
  }
  const upgrade = view.constructions.available.find((entry) => entry.building === 'chapel');
  if (upgrade !== undefined) {
    if (upgrade.blockedReason !== null) {
      return `${upgrade.label}: ${upgrade.blockedReason}`;
    }
    const missing = upgrade.cost
      .filter((entry) => entry.missing > 0)
      .map((entry) => `${formatNumber(entry.missing)} de ${entry.label.toLowerCase()}`);
    const suffix = missing.length > 0 ? ` (faltam ${joinList(missing)})` : '';
    return `${upgrade.label} → Nv${upgrade.targetLevel}: ${workTerms(upgrade)}${suffix}.`;
  }
  const itemBlock = relics.items.find((item) => item.blockedReason !== null)?.blockedReason ?? null;
  if (itemBlock !== null) {
    return itemBlock;
  }
  return (
    view.constructions.available.find((entry) => entry.blockedReason !== null)?.blockedReason ??
    'Sem Capela erguida no feudo.'
  );
}

/**
 * O texto de vigência de uma relíquia colocada ("Já está em vigor." ou "Vale a partir da próxima
 * virada de dia de jogo: em …"), descontando o tempo corrido desde a leitura sem trazer a frase do
 * pacote de conteúdo para o código do navegador.
 */
export function relicEffectiveLine(item: Relic, elapsedSeconds = 0): string | null {
  if (item.effectiveText === null) {
    return null;
  }
  if (item.active || item.effectiveInSeconds === null || elapsedSeconds <= 0) {
    return item.effectiveText;
  }
  const marker = ': em ';
  const at = item.effectiveText.lastIndexOf(marker);
  if (at === -1) {
    return item.effectiveText;
  }
  const left = remainingNow(item.effectiveInSeconds, elapsedSeconds);
  return `${item.effectiveText.slice(0, at)}${marker}${formatDuration(left)}.`;
}

/** O estado curto de uma relíquia para o selo do cartão e a linha da árvore. */
export function relicStateBadge(item: Relic): string {
  if (item.active) {
    return 'Colocada · Ativa';
  }
  if (item.placed) {
    return 'Colocada · Aguardando a virada do dia';
  }
  return 'Guardada';
}

/** A descrição curta de uma relíquia na árvore do explorador. */
export function relicTreeLine(item: Relic, elapsedSeconds = 0): string {
  if (item.active) {
    return 'ativa';
  }
  if (item.placed) {
    if (item.effectiveInSeconds !== null) {
      const left = remainingNow(item.effectiveInSeconds, elapsedSeconds);
      return `vale em ${formatDuration(left)}`;
    }
    return 'na Capela';
  }
  return 'guardada';
}

/** O resumo da linha "Capela" na árvore: espaços ocupados/totais e quantas estão em vigor. */
export function chapelTreeLine(relics: Relics): string {
  const used = placedRelicsCount(relics);
  const active = activeRelicsCount(relics);
  if (relics.slots === 0) {
    return relics.items.length === 0
      ? 'não erguida'
      : `sem Capela · ${formatNumber(relics.items.length)} ${relics.items.length === 1 ? 'relíquia' : 'relíquias'}`;
  }
  const slotsText = `${formatNumber(used)}/${formatNumber(relics.slots)} ${relics.slots === 1 ? 'espaço' : 'espaços'}`;
  if (active > 0) {
    return `${slotsText} · ${formatNumber(active)} ${active === 1 ? 'ativa' : 'ativas'}`;
  }
  if (used > 0) {
    return `${slotsText} · aguarda a virada`;
  }
  return relics.items.length === 0
    ? slotsText
    : `${slotsText} · ${formatNumber(relics.items.length)} ${relics.items.length === 1 ? 'guardada' : 'guardadas'}`;
}

/** As linhas de explicação (tooltip) do nó "Capela" na árvore. */
export function chapelLines(
  view: Pick<ViewState, 'relics' | 'constructions'>,
  elapsedSeconds = 0,
): string[] {
  const relics = relicsOf(view);
  const used = placedRelicsCount(relics);
  const missing = chapelMissingLine(view, elapsedSeconds);
  return [
    `Espaços na Capela: ${formatNumber(used)}/${formatNumber(relics.slots)}.`,
    ...(missing === null ? [] : [missing]),
    ...relics.items.map((item) => {
      const effective = relicEffectiveLine(item, elapsedSeconds);
      return `${item.label} (${relicStateBadge(item)}): ${item.effectText}${effective === null ? '' : ` ${effective}`}`;
    }),
  ];
}

/**
 * Os prazos (em segundos) das relíquias colocadas que ainda aguardam a virada do dia para entrar
 * em vigor (`effectiveInSeconds > 0`). Quando já estão ativas, `effectiveInSeconds` é `0` (estado
 * permanente) e fica de fora para não agendar releitura em laço.
 */
export function relicDeadlines(view: Pick<ViewState, 'relics'>): number[] {
  return relicsOf(view)
    .items.map((item) => item.effectiveInSeconds)
    .filter((seconds): seconds is number => typeof seconds === 'number' && seconds > 0);
}
