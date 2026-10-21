import { balance, units } from '@lotg/content';

import {
  armyCap,
  barracksLevel,
  barracksRequiresText,
  isUnitId,
  soldierCount,
  trainingCost,
  trainingDurationMs,
  trainingRefund,
  trainingWeapons,
  troopText,
} from './army';
import { emit } from './chronicle';
import { amountsData, missingResources, payResources } from './construction';
import { reject } from './rejections';
import { storeResource } from './storage';
import type { GameEvent, GameState, Rejection } from './types';
import { MILLI } from './units';

/**
 * As ordens do Quartel (GDD §10.2; ADR 0019, decisão 7). **Nenhuma sorteia**: o lote termina no
 * instante marcado (`army.training.endsAtMs`), que `advanceTo` resolve (`armyTurn.ts`).
 */

/** O motivo de uma ordem de treino de `amount` soldados de `unit` ser recusada agora; `null` se seria aceita. */
export function trainingBlock(state: GameState, unit: unknown, amount: unknown): Rejection | null {
  if (!isUnitId(unit)) {
    return reject('INVALID_UNIT');
  }
  const level = barracksLevel(state);
  if (level === 0) {
    return reject('BARRACKS_REQUIRED', { note: barracksRequiresText(state) });
  }
  const { batchMax } = balance.army;
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1 || amount > batchMax) {
    return reject('INVALID_AMOUNT', {
      note: `Treine um número inteiro de soldados, de 1 a ${batchMax}.`,
    });
  }
  if (state.army.training !== null) {
    return reject('TRAINING_BUSY');
  }
  const room = armyCap(state) - soldierCount(state);
  if (amount > room) {
    return reject('ARMY_LIMIT', { count: Math.max(0, room), level });
  }
  const { populationFloor } = balance.morale;
  const spare = Math.max(0, state.settlement.population.villagers - populationFloor);
  if (amount > spare) {
    return reject('NOT_ENOUGH_VILLAGERS', {
      count: spare,
      note: `O soldado sai da população, e o feudo guarda ao menos ${populationFloor} aldeões.`,
    });
  }
  const weapons = trainingWeapons(unit, amount);
  if (weapons > state.settlement.weapons) {
    return reject('NOT_ENOUGH_WEAPONS', { count: weapons - state.settlement.weapons });
  }
  const missing = missingResources(state, trainingCost(unit), amount);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  return null;
}

/**
 * A ordem de treinar (`trainSoldiers`). As recusas, na ordem de `trainingBlock`: a unidade que
 * não existe, o Quartel que falta, a quantidade, um lote já no pátio, o limite do exército, os
 * aldeões que o piso protege, as armas e os recursos. Aceita, cobra o custo inteiro **agora** e
 * fixa o instante do fim com o nível que o Quartel tem neste momento.
 */
export function trainSoldiers(
  draft: GameState,
  unit: unknown,
  amount: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = trainingBlock(draft, unit, amount);
  if (blocked !== null) {
    return blocked;
  }
  const kind = unit as keyof typeof units;
  const count = amount as number;
  payResources(draft, trainingCost(kind), count);
  draft.settlement.weapons -= trainingWeapons(kind, count);
  draft.army.training = {
    unit: kind,
    amount: count,
    startedAtMs: nowMs,
    endsAtMs: nowMs + trainingDurationMs(barracksLevel(draft), kind, count),
  };
  emit(
    events,
    draft,
    nowMs,
    'trainingStarted',
    {
      unit: kind,
      amount: count,
      ...amountsData(
        'spent',
        Object.fromEntries(
          Object.entries(trainingCost(kind)).map(([resource, each]) => [resource, each * count]),
        ),
      ),
      spent_weapons: trainingWeapons(kind, count),
    },
    { tropa: troopText(kind, count) },
  );
  return null;
}

/**
 * A ordem de cancelar o lote em treino (`cancelTraining`): devolve 80% do custo, arredondando
 * para baixo, e as armas inteiras que couberem nos 80%. Os recursos entram no que cabe no
 * depósito; o resto é desperdício contado.
 */
export function cancelTraining(
  draft: GameState,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const batch = draft.army.training;
  if (batch === null) {
    return reject('NOT_TRAINING');
  }
  const refund = trainingRefund(batch.unit, batch.amount);
  const gained: Record<string, number> = {};
  const lost: Record<string, number> = {};
  for (const [resource, milli] of Object.entries(refund.resources)) {
    const stored = storeResource(draft, resource as 'food', milli);
    if (stored > 0) {
      gained[resource] = stored / MILLI;
    }
    if (stored < milli) {
      lost[resource] = (milli - stored) / MILLI;
    }
  }
  draft.settlement.weapons += refund.weapons;
  draft.army.training = null;
  emit(
    events,
    draft,
    nowMs,
    'trainingCancelled',
    {
      unit: batch.unit,
      amount: batch.amount,
      ...amountsData('gained', gained),
      ...amountsData('lost', lost),
      weapons_back: refund.weapons,
    },
    { tropa: troopText(batch.unit, batch.amount) },
  );
  return null;
}

/**
 * A ordem de dispensar (`disbandSoldiers`): `amount` soldados de `unit` viram aldeões sem
 * ofício, **sem devolver o custo**. As recusas: a unidade que não existe, a quantidade que não
 * é um inteiro de 1 até quantos há (`INVALID_AMOUNT`) e quem não há (`NOT_ENOUGH_SOLDIERS`).
 */
export function disbandSoldiers(
  draft: GameState,
  unit: unknown,
  amount: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isUnitId(unit)) {
    return reject('INVALID_UNIT');
  }
  if (typeof amount !== 'number' || !Number.isInteger(amount) || amount < 1) {
    return reject('INVALID_AMOUNT', {
      note: 'Dispense um número inteiro de soldados, a partir de 1.',
    });
  }
  const have = draft.army.units[unit];
  if (amount > have) {
    return reject('NOT_ENOUGH_SOLDIERS', { count: have });
  }
  draft.army.units[unit] -= amount;
  draft.settlement.population.villagers += amount;
  emit(
    events,
    draft,
    nowMs,
    'soldiersDisbanded',
    {
      unit,
      amount,
      soldiers: draft.army.units[unit],
      villagers: draft.settlement.population.villagers,
    },
    { tropa: troopText(unit, amount) },
  );
  return null;
}
