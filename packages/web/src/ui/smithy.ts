import type { ViewState } from '@lotg/protocol';

import { formatDuration, formatNumber, remainingNow } from './format';
import { parseAmount } from './market';

/**
 * O Ferreiro como texto (GDD §6.1; ADR 0019, decisão 4): o que o painel da aba Feudo, a árvore, os
 * avisos e a paleta dizem da forja. Nenhuma regra e nenhuma conta aqui: o custo e o prazo de cada
 * tamanho de lote, o que o cancelamento devolve e o rótulo do botão vêm da visão, já escritos.
 */

export type Smithy = ViewState['smithy'];
export type SmithyOption = Smithy['offer']['options'][number];

/** O ícone do Ferreiro: o mesmo no painel, na árvore e nos avisos. */
export const SMITHY_ICON = 'zap';

/** A âncora do painel na aba Feudo e o argumento de `lords.openPanel` que leva a ela. */
export const SMITHY_ANCHOR = 'smithy-title';
export const SMITHY_SECTION = 'smithy';

/** O prefixo da linha da árvore. */
export const SMITHY_NODE = 'smithy';

/** O Ferreiro está de pé. */
export const hasSmithy = (smithy: Smithy): boolean => smithy.built;

export type RepairOffer = Smithy['repairOffer']['items'][number];

/** A quantidade digitada, a partir de 1; é só a forma: o tamanho do lote é conferido na visão. */
export const parseBatch = parseAmount;

/** O lote de `amount` armas na visão (de 1 até o máximo de uma ordem), ou `undefined`. */
export function batchOption(smithy: Smithy, amount: number | null): SmithyOption | undefined {
  return amount === null
    ? undefined
    : smithy.offer.options.find((entry) => entry.amount === amount);
}

/** "Forjar 4 armas: 8 de ferro e 4 de madeira, em 24 min": a linha que o jogador confirma. */
export function forgeLine(smithy: Smithy, option: SmithyOption): string {
  const what = `${formatNumber(option.amount)} ${option.amount === 1 ? 'arma' : smithy.weaponsLabel.toLowerCase()}`;
  return `Forjar ${what}: ${option.costText}, em ${formatDuration(option.seconds)}`;
}

/** O reparo que a visão oferece para um item (do arsenal ou na mão de um herói); `undefined` sem. */
export function repairFor(smithy: Smithy, itemId: string): RepairOffer | undefined {
  return smithy.repairOffer.items.find((entry) => entry.itemId === itemId);
}

/** "Reparar Lança de caça: 4 de ferro, em 8 min": a linha que o jogador confirma. */
export function repairLine(repair: RepairOffer): string {
  return `Reparar ${repair.label}: ${repair.costText}, em ${formatDuration(repair.seconds)}`;
}

/** Há reparo a oferecer (um item gasto ou riscado, mesmo que travado agora). */
export const hasRepairs = (smithy: Smithy): boolean => smithy.repairOffer.items.length > 0;

/** Os itens que o reparo pode refazer agora (o Ferreiro livre, o item no arsenal, o ferro). */
export const repairable = (smithy: Smithy): RepairOffer[] =>
  smithy.repairOffer.items.filter((entry) => entry.canRepair);

/** "termina em 12 min": quando o lote em curso acaba, descontando o tempo desde a visão. */
export function forgeEndsLine(forge: NonNullable<Smithy['forge']>, elapsedSeconds: number): string {
  const left = remainingNow(forge.endsInSeconds, elapsedSeconds);
  return left <= 0 ? 'termina agora' : `termina em ${formatDuration(left)}`;
}

/** A linha da árvore: o nível e as armas, ou o lote em curso. */
export function smithyTreeLine(smithy: Smithy, elapsedSeconds: number): string {
  if (!smithy.built) {
    return 'não erguido';
  }
  const weapons = `${formatNumber(smithy.weapons)} ${smithy.weaponsLabel.toLowerCase()}`;
  if (smithy.forge === null) {
    const worn = smithy.repairOffer.items.length;
    return worn === 0
      ? `Nv${smithy.level} · ${weapons}`
      : `Nv${smithy.level} · ${weapons} · ${worn} ${worn === 1 ? 'item a reparar' : 'itens a reparar'}`;
  }
  // O reparo ocupa a mesma fila: a linha diz o que a forja faz, na frase da visão.
  const doing =
    smithy.forge.kind === 'repair'
      ? smithy.forge.label.charAt(0).toLowerCase() + smithy.forge.label.slice(1)
      : `forjando ${formatNumber(smithy.forge.amount)}`;
  return `Nv${smithy.level} · ${doing} · ${forgeEndsLine(smithy.forge, elapsedSeconds)}`;
}

/** Os segundos até a forja acabar (para o ciclo de leitura); `null` sem lote. */
export const forgeDeadline = (smithy: Smithy): number | null =>
  smithy.forge === null ? null : smithy.forge.endsInSeconds;
