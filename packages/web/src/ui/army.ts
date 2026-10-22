import type { ViewState } from '@lotg/protocol';

import { formatDuration, formatNumber, remainingNow } from './format';
import { parseAmount } from './market';

/**
 * O Quartel e o exército como texto (GDD §10.2; ADR 0019, decisão 7): o que a aba Exército, a
 * árvore, os avisos e a paleta dizem do treino. Nenhuma regra e nenhuma conta de jogo aqui: o
 * custo e o prazo de cada soldado, o que o cancelamento devolve, quem vence quem e o lote máximo
 * vêm da visão, já escritos. O app só repete o custo de um soldado "N vezes", sem somá-lo.
 */

export type Army = ViewState['army'];
export type ArmyUnit = Army['units'][number];
export type UnitId = ArmyUnit['id'];
export type ArmyOffer = Army['offer'][number];

/** O ícone do exército: o mesmo na aba, na árvore e nos avisos. */
export const ARMY_ICON = 'organization';

/** A âncora do painel do Quartel na aba Exército e o argumento de `lords.openPanel`. */
export const ARMY_ANCHOR = 'army-title';
export const ARMY_SECTION = 'army';

/** O prefixo das linhas da árvore. */
export const ARMY_NODE = 'army';

/** O Quartel está de pé. */
export const hasBarracks = (army: Army): boolean => army.built;

/** A quantidade digitada, a partir de 1; é só a forma: o lote máximo é conferido na visão. */
export const parseSoldiers = parseAmount;

/** A unidade na visão, ou `undefined`. */
export const unitOf = (army: Army, unit: UnitId): ArmyUnit | undefined =>
  army.units.find((entry) => entry.id === unit);

/** A oferta de treino de uma unidade (o lote máximo e o que a trava), ou `undefined`. */
export const offerOf = (army: Army, unit: UnitId): ArmyOffer | undefined =>
  army.offer.find((entry) => entry.unit === unit);

/**
 * A quantidade do lote, se a visão a aceita agora: de 1 até o máximo da unidade. `null` quando
 * não serve (zero, acima do máximo) ou a unidade não está na visão.
 */
export function batchAmount(army: Army, unit: UnitId, amount: number | null): number | null {
  const offer = offerOf(army, unit);
  if (amount === null || offer === undefined || amount < 1 || amount > offer.maxAmount) {
    return null;
  }
  return amount;
}

/**
 * "Treinar Lanceiro × 5: 5 × (30 de comida, 10 de ouro), cada um em 2 min": a linha que o
 * jogador confirma. O custo é o de um soldado, repetido; o total do lote é cobrado pelo servidor.
 */
export function trainLine(unit: ArmyUnit, amount: number): string {
  const each = amount === 1 ? unit.costText : `${formatNumber(amount)} × (${unit.costText})`;
  // O plural vem do conteúdo e não da visão: a frase leva o rótulo e a quantidade, sem flexionar.
  return `Treinar ${unit.label} × ${formatNumber(amount)}: ${each}, cada um em ${formatDuration(unit.secondsEach)}`;
}

/** "Dispensar Lanceiro × 3": a linha que o jogador confirma. */
export function disbandLine(unit: ArmyUnit, amount: number): string {
  return `Dispensar ${unit.label} × ${formatNumber(amount)}`;
}

/** "termina em 12 min": quando o lote em curso acaba, descontando o tempo desde a visão. */
export function trainingEndsLine(
  training: NonNullable<Army['training']>,
  elapsedSeconds: number,
): string {
  const left = remainingNow(training.endsInSeconds, elapsedSeconds);
  return left <= 0 ? 'termina agora' : `termina em ${formatDuration(left)}`;
}

/** Onde a unidade luta: "linha de frente" ou "retaguarda". */
export const lineLabel = (unit: ArmyUnit): string =>
  unit.line === 'front' ? 'linha de frente' : 'retaguarda';

/** A linha da árvore: o nível, os soldados e o lote em curso. */
export function armyTreeLine(army: Army, elapsedSeconds: number): string {
  if (!army.built) {
    return 'não erguido';
  }
  const soldiers = `${formatNumber(army.total)}/${formatNumber(army.cap)} ${army.total === 1 ? 'soldado' : 'soldados'}`;
  if (army.training === null) {
    return `Nv${army.level} · ${soldiers}`;
  }
  const doing = army.training.label.charAt(0).toLowerCase() + army.training.label.slice(1);
  return `Nv${army.level} · ${soldiers} · treinando ${doing} · ${trainingEndsLine(army.training, elapsedSeconds)}`;
}

/** Os segundos até o treino acabar (para o ciclo de leitura); `null` sem lote. */
export const trainingDeadline = (army: Army): number | null =>
  army.training === null ? null : army.training.endsInSeconds;
