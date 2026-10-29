import type { GameEvent, ViewState } from '@lotg/protocol';

import {
  activeFormation,
  formatDuration,
  formatNumber,
  lacksDefense,
  remainingNow,
} from './format';
import { parseAmount } from './market';
import { domId } from './expeditions';

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
export const BATTLE_REPORTS_ANCHOR = 'battle-reports-title';
export const battleReportAnchor = (battleId: string): string =>
  domId('battle-report', battleId, 'title');

/** O prefixo das linhas da árvore. */
export const ARMY_NODE = 'army';

/** O relato específico do Acampamento não repete a mesma batalha já contada neste lote. */
export const isCampAssaultDuplicate = (event: GameEvent, events: readonly GameEvent[]): boolean =>
  event.type === 'campAssaulted' &&
  typeof event.data.battleId === 'string' &&
  events.some(
    (entry) => entry.type === 'battleFought' && entry.data.battleId === event.data.battleId,
  );

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
 * "Treinar 5 lanceiros: 150 de comida, 50 de ouro, 25 de madeira, em 10 min": a linha que o
 * jogador confirma. A tropa, o custo do lote inteiro e o prazo vêm prontos da visão
 * (`army.offer[].options`); o app não soma nada. Sem a opção na visão (o lote fora da faixa),
 * a frase diz só a unidade e a quantidade.
 */
export function trainLine(army: Army, unit: ArmyUnit, amount: number): string {
  const option = offerOf(army, unit.id)?.options.find((entry) => entry.amount === amount);
  if (option === undefined) {
    return `Treinar ${unit.label} × ${formatNumber(amount)}`;
  }
  return `Treinar ${option.label}: ${option.costText}, em ${formatDuration(option.seconds)}`;
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

export { activeFormation, lacksDefense };

/** A linha da árvore: o nível, os soldados, a Defesa ativa e o lote em curso. */
export function armyTreeLine(army: Army, elapsedSeconds: number): string {
  if (!army.built) {
    return 'não erguido';
  }
  const soldiers = `${formatNumber(army.total)}/${formatNumber(army.cap)} ${army.total === 1 ? 'soldado' : 'soldados'}`;
  const active = activeFormation(army);
  const defense =
    active !== null ? ` · Defesa: ${active.name}` : army.total > 0 ? ' · sem Defesa ativa' : '';
  if (army.training === null) {
    return `Nv${army.level} · ${soldiers}${defense}`;
  }
  const doing = army.training.label.charAt(0).toLowerCase() + army.training.label.slice(1);
  return `Nv${army.level} · ${soldiers}${defense} · treinando ${doing} · ${trainingEndsLine(army.training, elapsedSeconds)}`;
}

/** Os segundos até o treino acabar (para o ciclo de leitura); `null` sem lote. */
export const trainingDeadline = (army: Army): number | null =>
  army.training === null ? null : army.training.endsInSeconds;
