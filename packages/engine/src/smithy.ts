import { balance, type ResourceAmounts } from '@lotg/content';

import { emit } from './chronicle';
import { amountsData } from './construction';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';

/**
 * O Ferreiro (GDD §5.1 e §6.1; ADR 0019, decisão 4): a forja de armas. Um lote por vez, com o
 * custo cobrado ao começar. A arma é uma contagem de unidades inteiras (`settlement.weapons`),
 * fora do estoque em milésimos: não tem depósito nem se vende. Nenhuma conta daqui sorteia.
 */

/** O nível do Ferreiro; 0 sem ele. */
export function smithyLevel(state: GameState): number {
  return state.settlement.buildings.smithy;
}

/**
 * O tempo de um lote no nível dado, em ms de jogo: `quantidade × tempo da arma`, com cada nível
 * acima do 1 somando `speedPerLevel` à produção. É uma conta só, com um arredondamento para
 * baixo, e o tempo é fixado quando o lote começa: subir o Ferreiro depois não o encurta.
 */
export function forgeDurationMs(level: number, amount: number): number {
  const { perWeaponMs, speedPerLevel } = balance.smithy;
  const steps = Math.max(0, level - 1);
  return Math.floor(
    (amount * perWeaponMs * speedPerLevel.den) / (speedPerLevel.den + steps * speedPerLevel.num),
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
 * Conclui o lote que vence até `atMs`: as armas entram sem teto. É resolvido junto das obras
 * concluídas, na ordem fixa de `processEventsAt`.
 */
export function finishForge(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  const forge = settlement.forge;
  if (forge === null || forge.endsAtMs > atMs) {
    return;
  }
  settlement.weapons += forge.amount;
  settlement.forge = null;
  emit(
    events,
    draft,
    atMs,
    'weaponsForged',
    { amount: forge.amount, weapons: settlement.weapons },
    { quantidade: forge.amount },
  );
}

/** O custo do lote nos dados de um evento: `spent_iron`, `spent_wood`. */
export function forgeSpentData(amount: number): Record<string, number> {
  return amountsData('spent', forgeCost(amount));
}
