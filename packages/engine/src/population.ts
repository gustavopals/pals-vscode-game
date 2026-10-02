import { balance, BUILDING_IDS, PRODUCTION_BUILDING_IDS, type SeasonDef } from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import { missingResources, payResources } from './construction';
import { beginAdaptation, leaveAdaptation } from './craft';
import { reject } from './rejections';
import type { GameEvent, GameState, ProductionBuildingId, Rejection } from './types';
import { positiveEntries } from './units';

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

/**
 * Os habitantes que podem trabalhar: todos, menos os feridos das incursões (GDD §8.2). O ferido
 * mora e come no feudo, mas não é braço de ofício nenhum até sarar.
 */
export function ableVillagers(state: GameState): number {
  const { population, injured } = state.settlement;
  return population.villagers - injured.length;
}

/** Aldeões sem ofício e em condição de trabalhar: derivado, nunca persistido. */
export function freeVillagers(state: GameState): number {
  return ableVillagers(state) - assignedWorkers(state);
}

/** Vagas ainda não ocupadas nem reservadas por quem está em treinamento. */
export function housingVacancy(state: GameState): number {
  const { population, recruitmentQueue } = state.settlement;
  return housingCapacity(state) - population.villagers - recruitmentQueue.length;
}

export function isProductionBuilding(value: unknown): value is ProductionBuildingId {
  return (PRODUCTION_BUILDING_IDS as readonly unknown[]).includes(value);
}

/**
 * Define quantos aldeões trabalham em um edifício. A ordem vale na hora, mas a troca de ofício
 * custa (GDD §5.4): quem chega entra em adaptação e rende uma fração por um dia de jogo; quem
 * sai, sai primeiro das levas mais novas. Pedir o número que já está lá não muda nada.
 */
export function setWorkers(
  draft: GameState,
  building: unknown,
  count: unknown,
  nowMs: number,
): Rejection | null {
  if (!isProductionBuilding(building) || !Number.isInteger(count) || (count as number) < 0) {
    return reject('INVALID_WORKERS');
  }
  const wanted = count as number;
  const { workers } = draft.settlement;
  const available = freeVillagers(draft) + workers[building];
  if (wanted > available) {
    return reject('NOT_ENOUGH_VILLAGERS', { count: available });
  }
  const arriving = wanted - workers[building];
  workers[building] = wanted;
  if (arriving > 0) {
    beginAdaptation(draft, building, arriving, nowMs);
  } else if (arriving < 0) {
    leaveAdaptation(draft, building, -arriving);
  }
  return null;
}

/**
 * Garante que a soma dos trabalhadores não passa dos habitantes que podem trabalhar: quando eles
 * diminuem (um aldeão parte, deserta ou se fere), quem falta sai do ofício, um a um, do edifício
 * com mais gente (no empate, o primeiro na ordem do conteúdo) e, dentro dele, primeiro de quem
 * ainda está em adaptação. Devolve quantos saíram de cada edifício; vazio quando ninguém
 * precisava sair. Quem tira gente do feudo, ou do trabalho, chama isto logo depois.
 *
 * Se o feudo ficou com menos habitantes do que feridos, quem partiu foi um ferido: o que
 * sararia por último sai da lista, e ninguém volta a um ofício no lugar de quem já não está.
 */
export function releaseExcessWorkers(
  draft: GameState,
): Partial<Record<ProductionBuildingId, number>> {
  const { workers, population, injured } = draft.settlement;
  while (injured.length > population.villagers) {
    injured.pop();
  }
  const released: Partial<Record<ProductionBuildingId, number>> = {};
  for (let excess = assignedWorkers(draft) - ableVillagers(draft); excess > 0; excess -= 1) {
    const fullest = PRODUCTION_BUILDING_IDS.reduce((best, id) =>
      workers[id] > workers[best] ? id : best,
    );
    workers[fullest] -= 1;
    leaveAdaptation(draft, fullest, 1);
    released[fullest] = (released[fullest] ?? 0) + 1;
  }
  return released;
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
 * Tempo de treinamento de cada aldeão de uma ordem dada na estação `season`: na primavera,
 * × 0,8 (GDD §4.1). Uma conta só, arredondada para baixo.
 */
export function recruitmentDurationMs(season: SeasonDef): number {
  const { num, den } = season.effects.recruitmentDuration;
  return Math.floor((balance.recruitment.durationMs * num) / den);
}

/**
 * Ordem de recrutamento: o custo é pago na hora e cada aldeão fica pronto um tempo de
 * treinamento depois do anterior, contando a partir do último que já está na fila. O tempo é o
 * da estação em que a ordem foi dada, para a ordem inteira: ele não muda se a estação virar
 * com a fila andando.
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
  const { cost } = balance.recruitment;
  const durationMs = recruitmentDurationMs(seasonAt(nowMs));
  const { recruitmentQueue } = draft.settlement;
  payResources(draft, cost, wanted);
  const startsAt = recruitmentQueue[recruitmentQueue.length - 1]?.finishesAtMs ?? nowMs;
  for (let index = 1; index <= wanted; index += 1) {
    recruitmentQueue.push({ finishesAtMs: startsAt + index * durationMs });
  }
  const spent = Object.fromEntries(
    positiveEntries(cost).map(([resource, amount]) => [`spent_${resource}`, amount * wanted]),
  );
  emit(
    events,
    draft,
    nowMs,
    'recruitmentStarted',
    { quantity: wanted, ...spent },
    { quantidade: wanted },
  );
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
