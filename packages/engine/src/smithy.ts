import { balance, buildings, type ResourceAmounts } from '@lotg/content';

import { emit } from './chronicle';
import { amountsData, buildingWithArticle } from './construction';
import { stowItem } from './equipment';
import { plural } from './format';
import { durabilityOf, itemDefOf } from './heroes';
import { reject } from './rejections';
import type { GameEvent, GameState, Item, Rejection } from './types';
import { MILLI } from './units';

/**
 * O Ferreiro (GDD §5.1 e §6.1; ADR 0019, decisão 4): a forja de armas. Um lote por vez, com o
 * custo cobrado ao começar. A arma é uma contagem de unidades inteiras (`settlement.weapons`),
 * fora do estoque em milésimos: não tem depósito nem se vende. Nenhuma conta daqui sorteia.
 */

/** "1 arma", "3 armas": a quantidade de um lote, nas frases da Crônica e da visão. */
export function weaponsText(amount: number): string {
  return plural(amount, 'arma', 'armas');
}

/**
 * A recusa de quem pede a forja ou o reparo sem o Ferreiro de pé. Só lembra o Salão quando ele
 * ainda não chegou ao nível que o Ferreiro pede (revisão da Fase B da v0.4, achado 4), como a
 * recusa do Mercado.
 */
export function smithyRequired(state: GameState): Rejection {
  const level = buildings.smithy.requires.townHall;
  return reject(
    'SMITHY_REQUIRED',
    level === undefined || state.settlement.buildings.townHall >= level
      ? {}
      : { remedy: `a forja pede ${buildingWithArticle('townHall')} no nível ${level}` },
  );
}

/** O nível do Ferreiro; 0 sem ele. */
export function smithyLevel(state: GameState): number {
  return state.settlement.buildings.smithy;
}

/**
 * O tempo de um lote no nível dado, em ms de jogo: `quantidade × tempo da arma`, com cada nível
 * acima do 1 somando `speedPerLevel` à produção. É uma conta só, com um arredondamento para
 * baixo, e o tempo é fixado quando o lote começa: subir o Ferreiro depois não o encurta.
 */
export function forgeDurationMs(level: number, amount: number, factor = { num: 1, den: 1 }): number {
  const { perWeaponMs, speedPerLevel } = balance.smithy;
  const steps = Math.max(0, level - 1);
  return Math.floor(
    (amount * perWeaponMs * speedPerLevel.den * factor.den) / ((speedPerLevel.den + steps * speedPerLevel.num) * factor.num),
  );
}

/** O tempo de uma arma no nível dado, em ms de jogo. */
export function perWeaponDurationMs(level: number): number {
  return forgeDurationMs(level, 1);
}

/** O que um lote de `amount` armas custa, em unidades. */
export function forgeCost(amount: number): ResourceAmounts {
  const { recipe } = balance.smithy;
  return { iron: recipe.iron * amount, wood: recipe.wood * amount };
}

/** O que cancelar devolve, em milésimos, de cada recurso do custo (80%, como as obras). */
export function forgeRefundMilli(amount: number): { iron: number; wood: number } {
  const { cancelRefund } = balance.construction;
  const cost = forgeCost(amount);
  const refundOf = (units: number) =>
    Math.floor((units * MILLI * cancelRefund.num) / cancelRefund.den);
  return { iron: refundOf(cost.iron ?? 0), wood: refundOf(cost.wood ?? 0) };
}

/** O instante em que o lote em curso termina; `null` sem lote. */
export function nextForgeEndAt(state: GameState): number | null {
  return state.settlement.forge?.endsAtMs ?? null;
}

/**
 * Conclui o trabalho que vence até `atMs`: as armas entram sem teto, e o item reparado volta ao
 * arsenal com a condição cheia. É resolvido junto das obras
 * concluídas, na ordem fixa de `processEventsAt`.
 */
export function finishForge(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  const forge = settlement.forge;
  if (forge === null || forge.endsAtMs > atMs) {
    return;
  }
  settlement.forge = null;
  if (forge.kind === 'repair') {
    // O item volta ao arsenal inteiro; o lugar dele estava guardado, mas `stowItem` cobre o resto.
    const item = { ...forge.item, condition: durabilityOf(forge.item) };
    stowItem(draft, item, atMs, events);
    emit(
      events,
      draft,
      atMs,
      'itemRepaired',
      { itemId: item.id, defId: item.defId, points: forge.points },
      { item: itemDefOf(item)?.label ?? 'um item' },
    );
    return;
  }
  const yielded = forge.amount + (forge.extra ?? 0);
  settlement.weapons += yielded;
  emit(
    events,
    draft,
    atMs,
    'weaponsForged',
    { amount: yielded, weapons: settlement.weapons },
    { armas: weaponsText(yielded) },
  );
}

/** O custo do lote nos dados de um evento: `spent_iron`, `spent_wood`. */
export function forgeSpentData(amount: number): Record<string, number> {
  return amountsData('spent', forgeCost(amount));
}

/** Quantos pontos faltam a um item para ficar inteiro; 0 para o que o conteúdo já não tem. */
export function repairPoints(item: Item): number {
  return Math.max(0, durabilityOf(item) - item.condition);
}

/** O ferro que `points` pontos de reparo custam a um item: o preço por ponto é o da raridade dele. */
export function repairIronCost(item: Item, points = repairPoints(item)): number {
  const def = itemDefOf(item);
  return def === null ? 0 : points * balance.equipment.repair.ironPerPoint[def.rarity];
}

/** O tempo de jogo de um reparo de `points` pontos: fixo por ponto, sem efeito do nível do Ferreiro. */
export function repairDurationMs(points: number): number {
  return points * balance.equipment.repair.msPerPoint;
}

/** Bônus lidos na encomenda: expirar não altera um lote já pago. */
export function smithySpeedFactor(state: GameState): { num: number; den: number } {
  const bonus = state.council.bonuses.smithySpeed;
  return bonus !== null && bonus.untilMs > state.lastProcessedAt ? bonus.factor : { num: 1, den: 1 };
}
export function smithyBatchExtra(state: GameState, amount: number): number {
  const bonus = state.council.bonuses.smithyBatch;
  return bonus !== null && bonus.untilMs > state.lastProcessedAt ? Math.max(0, Math.min(bonus.extra, balance.smithy.batchMax - amount)) : 0;
}
