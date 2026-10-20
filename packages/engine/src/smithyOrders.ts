import { balance } from '@lotg/content';

import { emit } from './chronicle';
import { amountsData, missingResources, payResources } from './construction';
import { reject } from './rejections';
import {
  forgeCost,
  forgeDurationMs,
  forgeRefundMilli,
  forgeSpentData,
  smithyLevel,
  smithyRequired,
  weaponsText,
} from './smithy';
import { storeResource } from './storage';
import type { GameEvent, GameState, Rejection } from './types';
import { MILLI } from './units';

/**
 * As ordens do Ferreiro (GDD §6.1; ADR 0019, decisão 4). **Nenhuma sorteia**: o lote termina no
 * instante marcado (`settlement.forge.endsAtMs`), que `advanceTo` resolve.
 */

/**
 * A ordem de forjar (`forgeWeapons`). As recusas, na ordem:
 *
 * 1. sem Ferreiro (`SMITHY_REQUIRED`);
 * 2. a quantidade que não é um inteiro de 1 até o lote máximo (`INVALID_AMOUNT`);
 * 3. um lote já na forja (`FORGE_BUSY`): é um lote por vez;
 * 4. ferro ou madeira que faltam (`INSUFFICIENT_RESOURCES`).
 *
 * Aceita, cobra o custo inteiro **agora**, como uma obra, e fixa o instante do fim com o nível
 * que o Ferreiro tem neste momento.
 */
export function forgeWeapons(
  draft: GameState,
  amount: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const level = smithyLevel(draft);
  if (level === 0) {
    return smithyRequired(draft);
  }
  const { batchMax } = balance.smithy;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > batchMax) {
    return reject('INVALID_AMOUNT', { count: batchMax });
  }
  if (draft.settlement.forge !== null) {
    return reject('FORGE_BUSY');
  }
  const cost = forgeCost(amount);
  const missing = missingResources(draft, cost);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  payResources(draft, cost);
  draft.settlement.forge = {
    kind: 'weapons',
    amount,
    startedAtMs: nowMs,
    endsAtMs: nowMs + forgeDurationMs(level, amount),
  };
  emit(
    events,
    draft,
    nowMs,
    'forgeStarted',
    { amount, ...forgeSpentData(amount) },
    { armas: weaponsText(amount) },
  );
  return null;
}

/**
 * A ordem de cancelar o lote em curso (`cancelForge`): devolve 80% do custo, arredondando para
 * baixo, como as obras. A devolução é um ganho como outro qualquer: entra o que cabe no
 * depósito, e o que não cabe é desperdício contado.
 */
export function cancelForge(
  draft: GameState,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const forge = draft.settlement.forge;
  if (forge === null) {
    return reject('NOT_FORGING');
  }
  if (forge.kind === 'repair') {
    return reject('NOT_FORGING', {
      note: 'A forja está refazendo um item, e um reparo não se cancela: espere ele terminar.',
    });
  }
  const refund = forgeRefundMilli(forge.amount);
  const gained: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const resource of ['iron', 'wood'] as const) {
    const stored = storeResource(draft, resource, refund[resource]);
    if (stored > 0) {
      gained[resource] = stored / MILLI;
    }
    if (stored < refund[resource]) {
      lost[resource] = (refund[resource] - stored) / MILLI;
    }
  }
  draft.settlement.forge = null;
  emit(
    events,
    draft,
    nowMs,
    'forgeCancelled',
    { amount: forge.amount, ...amountsData('gained', gained), ...amountsData('lost', lost) },
    { armas: weaponsText(forge.amount) },
  );
  return null;
}
