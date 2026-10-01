import { balance, BUILDING_IDS, PRODUCTION_BUILDING_IDS } from '@lotg/content';

import { emit } from './chronicle';
import { missingResources, payResources } from './construction';
import { reject } from './rejections';
import type { GameEvent, GameState, ProductionBuildingId, Rejection } from './types';

/** Capacidade habitacional: derivada dos níveis do Salão e das Habitações, nunca persistida. */
export function housingCapacity(state: GameState): number {
  const { capacityPerLevel } = balance.housing;
  return BUILDING_IDS.reduce(
    (sum, id) => sum + (capacityPerLevel[id] ?? 0) * state.settlement.buildings[id],
    0,
  );
}

export function assignedWorkers(state: GameState): number {
  return PRODUCTION_BUILDING_IDS.reduce((sum, id) => sum + state.settlement.workers[id], 0);
}

/** Aldeões sem ofício: derivado, nunca persistido. */
export function freeVillagers(state: GameState): number {
  return state.settlement.population.villagers - assignedWorkers(state);
}

/** Vagas ainda não ocupadas nem reservadas por quem está em treinamento. */
export function housingVacancy(state: GameState): number {
  const { population, recruitmentQueue } = state.settlement;
  return housingCapacity(state) - population.villagers - recruitmentQueue.length;
}

export function isProductionBuilding(value: unknown): value is ProductionBuildingId {
  return (PRODUCTION_BUILDING_IDS as readonly unknown[]).includes(value);
}

/** Define quantos aldeões trabalham em um edifício. Imediato e gratuito na v0.1. */
export function setWorkers(draft: GameState, building: unknown, count: unknown): Rejection | null {
  if (!isProductionBuilding(building) || !Number.isInteger(count) || (count as number) < 0) {
    return reject('INVALID_WORKERS');
  }
  const wanted = count as number;
  const { workers } = draft.settlement;
  const available = freeVillagers(draft) + workers[building];
  if (wanted > available) {
    return reject('NOT_ENOUGH_VILLAGERS', { count: available });
  }
  workers[building] = wanted;
  return null;
}

/** Motivo pelo qual uma ordem de `quantity` aldeões seria recusada agora; `null` se seria aceita. */
export function recruitmentBlock(state: GameState, quantity: unknown): Rejection | null {
  const { cost, maxPerOrder, maxQueue } = balance.recruitment;
  if (
    !Number.isInteger(quantity) ||
    (quantity as number) < 1 ||
    (quantity as number) > maxPerOrder
  ) {
    return reject('INVALID_QUANTITY');
  }
  const wanted = quantity as number;
  if (state.settlement.famine) {
    return reject('FAMINE');
  }
  const queueRoom = maxQueue - state.settlement.recruitmentQueue.length;
  if (wanted > queueRoom) {
    return reject('RECRUIT_QUEUE_FULL', { count: queueRoom });
  }
  const vacancy = housingVacancy(state);
  if (wanted > vacancy) {
    return reject('HOUSING_FULL', { count: Math.max(0, vacancy) });
  }
  const missing = missingResources(state, cost, wanted);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  return null;
}

/**
 * Ordem de recrutamento: o custo é pago na hora e cada aldeão fica pronto 20 minutos
 * depois do anterior, contando a partir do último que já está na fila.
 */
export function recruitVillagers(
  draft: GameState,
  quantity: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const blocked = recruitmentBlock(draft, quantity);
  if (blocked !== null) {
    return blocked;
  }
  const wanted = quantity as number;
  const { cost, durationMs } = balance.recruitment;
  const { recruitmentQueue } = draft.settlement;
  payResources(draft, cost, wanted);
  const startsAt = recruitmentQueue[recruitmentQueue.length - 1]?.finishesAtMs ?? nowMs;
  for (let index = 1; index <= wanted; index += 1) {
    recruitmentQueue.push({ finishesAtMs: startsAt + index * durationMs });
  }
  emit(events, draft, nowMs, 'recruitmentStarted', { quantity: wanted }, { quantidade: wanted });
  return null;
}

/** Conclui os treinamentos que vencem até `atMs`. Um evento por aldeão. */
export function finishRecruitments(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement, stats } = draft;
  // A fila fica congelada durante a fome (GDD §5.6).
  while (!settlement.famine) {
    const next = settlement.recruitmentQueue[0];
    if (next === undefined || next.finishesAtMs > atMs) {
      return;
    }
    settlement.recruitmentQueue.shift();
    settlement.population.villagers += 1;
    stats.villagersRecruited = (stats.villagersRecruited ?? 0) + 1;
    const villagers = settlement.population.villagers;
    emit(events, draft, atMs, 'recruitmentFinished', { villagers }, { quantidade: villagers });
  }
}
