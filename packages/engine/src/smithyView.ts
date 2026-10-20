import { balance, buildings } from '@lotg/content';

import { missingResources } from './construction';
import {
  forgeCost,
  forgeDurationMs,
  forgeRefundMilli,
  perWeaponDurationMs,
  smithyLevel,
} from './smithy';
import type { BuildingId, GameState, SmithyView } from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * O Ferreiro na visão (GDD §6.1; ADR 0019, decisão 4). Só lê o estado: não sorteia, não dá
 * identificador e não anda o tempo. Os prazos saem em tempo real, no ritmo `timeScale`.
 */

const { smithy: rules } = balance;
const iron = balance.resources.iron.label.toLowerCase();
const wood = balance.resources.wood.label.toLowerCase();

/** "2 de ferro e 1 de madeira por arma". */
const costPerWeaponText = `${rules.recipe.iron} de ${iron} e ${rules.recipe.wood} de ${wood} por arma`;

/**
 * O que a obra do Ferreiro muda, para ficar ao lado do custo. No nível 1: o que ele passa a
 * fazer; nos seguintes: quanto do tempo de uma arma sobra. `null` para os outros edifícios.
 */
export function smithyEffect(building: BuildingId, targetLevel: number): string | null {
  if (building !== 'smithy') {
    return null;
  }
  if (targetLevel <= 1) {
    return `Forja armas: ${costPerWeaponText}, em lotes de até ${rules.batchMax}, um lote por vez.`;
  }
  const { num, den } = rules.speedPerLevel;
  const percent = Math.round((100 * den) / (den + (targetLevel - 1) * num));
  return `Cada arma leva ${percent}% do tempo do nível 1 para forjar.`;
}

/** O que o Ferreiro é agora: o que o nível dá ou, sem ele, o que o abre. */
function smithyText(state: GameState): string {
  const level = smithyLevel(state);
  const { label, requires } = buildings.smithy;
  if (level > 0) {
    return `${label} Nv${level}: ${costPerWeaponText}, em lotes de até ${rules.batchMax}.`;
  }
  const townHall = requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? `O Ferreiro abre com o Salão Nv${townHall}: forja armas com ${iron} e ${wood}.`
    : `Erga o Ferreiro: forja armas com ${iron} e ${wood}.`;
}

/** O maior lote que o estoque paga agora (0 se há um lote na forja ou não há Ferreiro). */
function maxAmount(state: GameState): number {
  if (smithyLevel(state) === 0 || state.settlement.forge !== null) {
    return 0;
  }
  let best = 0;
  for (let amount = 1; amount <= rules.batchMax; amount += 1) {
    if (missingResources(state, forgeCost(amount)) !== null) {
      break;
    }
    best = amount;
  }
  return best;
}

/** "20 de ferro e 10 de madeira": o custo de um lote de `amount` armas. */
function batchCostText(amount: number): string {
  const cost = forgeCost(amount);
  return `${cost.iron ?? 0} de ${iron} e ${cost.wood ?? 0} de ${wood}`;
}

/** A parte do custo que o cancelamento devolve, em por cento. */
function refundPercent(): number {
  const { num, den } = balance.construction.cancelRefund;
  return Math.round((100 * num) / den);
}

/** "Cancelar devolve 80%: 1 de ferro e 0 de madeira.": o que o cancelamento devolve ao lote. */
function refundText(amount: number): string {
  const refund = forgeRefundMilli(amount);
  return `Cancelar devolve ${refundPercent()}%: ${Math.floor(refund.iron / MILLI)} de ${iron} e ${Math.floor(refund.wood / MILLI)} de ${wood}.`;
}

export function smithyView(state: GameState, timeScale: number): SmithyView {
  const { settlement } = state;
  const level = smithyLevel(state);
  const forge = settlement.forge;
  return {
    building: 'smithy',
    built: level > 0,
    level,
    text: smithyText(state),
    weapons: settlement.weapons,
    weaponsLabel: rules.weaponsLabel,
    forge:
      forge === null
        ? null
        : {
            amount: forge.amount,
            endsInSeconds: realSecondsCeil(forge.endsAtMs - state.lastProcessedAt, timeScale),
            totalSeconds: realSecondsCeil(forge.endsAtMs - forge.startedAtMs, timeScale),
            refundText: refundText(forge.amount),
            cancelLabel: `Cancelar (devolve ${refundPercent()}%)`,
          },
    perWeaponSeconds: level > 0 ? realSecondsCeil(perWeaponDurationMs(level), timeScale) : 0,
    offer: {
      maxAmount: maxAmount(state),
      options: Array.from({ length: rules.batchMax }, (_, index) => {
        const amount = index + 1;
        return {
          amount,
          costText: batchCostText(amount),
          seconds: level > 0 ? realSecondsCeil(forgeDurationMs(level, amount), timeScale) : 0,
          affordable: missingResources(state, forgeCost(amount)) === null,
        };
      }),
      batchMax: rules.batchMax,
      costText: costPerWeaponText,
      batchSeconds:
        level > 0 ? realSecondsCeil(forgeDurationMs(level, rules.batchMax), timeScale) : 0,
      blockedReason:
        level > 0 && settlement.forge === null && maxAmount(state) === 0
          ? `O estoque não paga nem uma arma: ela pede ${costPerWeaponText.replace(' por arma', '')}.`
          : null,
    },
  };
}
