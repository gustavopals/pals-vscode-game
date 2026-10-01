import {
  balance,
  BUILDING_IDS,
  buildings,
  type Ratio,
  RESOURCE_IDS,
  type ResourceAmounts,
} from '@lotg/content';

import { emit } from './chronicle';
import { reject } from './rejections';
import type { BuildingId, Construction, GameEvent, GameState, Rejection } from './types';
import { MILLI, positiveEntries, scaleDown } from './units';

export function isBuildingId(value: unknown): value is BuildingId {
  return (BUILDING_IDS as readonly unknown[]).includes(value);
}

/** "a Serraria", "as Habitações". */
export function buildingWithArticle(building: BuildingId): string {
  const def = buildings[building];
  return `${def.article} ${def.label}`;
}

function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** arredondar(valor × fator^passos), só com inteiros. */
function growRounded(value: number, factor: Ratio, steps: number): number {
  const num = value * factor.num ** steps;
  const den = factor.den ** steps;
  return Math.floor((2 * num + den) / (2 * den));
}

/** Custo, em unidades, de levar um edifício de `fromLevel` para o nível seguinte (GDD §6.2). */
export function upgradeCost(building: BuildingId, fromLevel: number): ResourceAmounts {
  const { costFactor, costFactorByBuilding } = balance.construction;
  const factor = costFactorByBuilding[building] ?? costFactor;
  const cost: ResourceAmounts = {};
  for (const [resource, base] of positiveEntries(buildings[building].baseCost)) {
    cost[resource] = growRounded(base, factor, fromLevel - 1);
  }
  return cost;
}

/** Duração da obra a partir de `fromLevel`, limitada a 8 h: nenhuma obra exige mais que uma noite. */
export function upgradeDurationMs(building: BuildingId, fromLevel: number): number {
  const { timeFactor, maxDurationMs } = balance.construction;
  const steps = fromLevel - 1;
  const duration = Math.floor(
    (buildings[building].baseDurationMs * timeFactor.num ** steps) / timeFactor.den ** steps,
  );
  return Math.min(maxDurationMs, duration);
}

/** O que falta, em unidades, para pagar `quantity` vezes `cost`; `null` quando há o bastante. */
export function missingResources(
  state: GameState,
  cost: ResourceAmounts,
  quantity = 1,
): ResourceAmounts | null {
  const missing: ResourceAmounts = {};
  for (const [resource, amount] of positiveEntries(cost)) {
    const shortfall = amount * quantity * MILLI - state.settlement.resources[resource];
    if (shortfall > 0) {
      missing[resource] = Math.ceil(shortfall / MILLI);
    }
  }
  return Object.keys(missing).length > 0 ? missing : null;
}

export function payResources(draft: GameState, cost: ResourceAmounts, quantity = 1): void {
  for (const [resource, amount] of positiveEntries(cost)) {
    draft.settlement.resources[resource] -= amount * quantity * MILLI;
  }
}

export function grantResources(draft: GameState, amounts: ResourceAmounts): void {
  for (const [resource, amount] of positiveEntries(amounts)) {
    draft.settlement.resources[resource] += amount * MILLI;
  }
}

export function constructionOf(state: GameState, building: BuildingId): Construction | null {
  return state.settlement.constructionQueues.find((slot) => slot?.building === building) ?? null;
}

export type UpgradeQuote = {
  building: BuildingId;
  fromLevel: number;
  targetLevel: number;
  cost: ResourceAmounts;
  durationMs: number;
  /** Quanto falta de cada recurso, em unidades; vazio quando há o bastante. */
  missing: ResourceAmounts;
  /** Motivo pelo qual a obra não pode começar agora; `null` quando pode. */
  blocked: Rejection | null;
};

/** Orçamento da próxima melhoria de um edifício: custos, duração e bloqueios. */
export function upgradeQuote(state: GameState, building: BuildingId): UpgradeQuote {
  const { settlement } = state;
  const def = buildings[building];
  const fromLevel = settlement.buildings[building];
  const targetLevel = fromLevel + 1;
  const cost = upgradeCost(building, fromLevel);
  const missing = missingResources(state, cost) ?? {};
  const label = sentenceCase(buildingWithArticle(building));
  const gate = settlement.buildings.townHall + balance.construction.gateLevelsAboveTownHall;

  let blocked: Rejection | null = null;
  if (constructionOf(state, building) !== null) {
    blocked = reject('ALREADY_UPGRADING', { label });
  } else if (!settlement.constructionQueues.includes(null)) {
    blocked = reject('QUEUE_BUSY');
  } else if (fromLevel >= def.maxLevel) {
    blocked = reject('MAX_LEVEL', { label });
  } else if (building !== 'townHall' && targetLevel > gate) {
    blocked = reject('GATE_LOCKED', {
      level: targetLevel - balance.construction.gateLevelsAboveTownHall,
    });
  } else if (Object.keys(missing).length > 0) {
    blocked = reject('INSUFFICIENT_RESOURCES', { missing });
  }

  return {
    building,
    fromLevel,
    targetLevel,
    cost,
    durationMs: upgradeDurationMs(building, fromLevel),
    missing,
    blocked,
  };
}

function unplan(draft: GameState, building: BuildingId): void {
  const { settlement } = draft;
  settlement.planned = settlement.planned.filter((plan) => plan.building !== building);
}

/** Inicia uma melhoria: desconta o custo uma única vez e ocupa a fila. */
export function startConstruction(
  draft: GameState,
  building: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const quote = upgradeQuote(draft, building);
  if (quote.blocked !== null) {
    return quote.blocked;
  }
  const { settlement, stats } = draft;
  payResources(draft, quote.cost);
  settlement.constructionQueues[settlement.constructionQueues.indexOf(null)] = {
    building,
    targetLevel: quote.targetLevel,
    startedAtMs: nowMs,
    finishesAtMs: nowMs + quote.durationMs,
  };
  unplan(draft, building);
  const stat = `constructionsStarted:${building}`;
  stats[stat] = (stats[stat] ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'constructionStarted',
    { building, level: quote.targetLevel },
    { edificio: buildingWithArticle(building), nivel: quote.targetLevel },
  );
  return null;
}

/** Conclui as obras que vencem até `atMs`. O efeito do nível novo vale a partir daqui. */
export function finishConstructions(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  settlement.constructionQueues.forEach((slot, index) => {
    if (slot === null || slot.finishesAtMs > atMs) {
      return;
    }
    settlement.buildings[slot.building] = slot.targetLevel;
    settlement.constructionQueues[index] = null;
    emit(
      events,
      draft,
      atMs,
      'constructionFinished',
      { building: slot.building, level: slot.targetLevel },
      { edificio: buildingWithArticle(slot.building), nivel: slot.targetLevel },
    );
  });
}

/** Cancela a obra de um edifício e devolve 80% do que foi pago, arredondando para baixo. */
export function cancelConstruction(
  draft: GameState,
  building: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const { settlement } = draft;
  const index = settlement.constructionQueues.findIndex((slot) => slot?.building === building);
  if (index === -1) {
    return reject('NOT_IN_CONSTRUCTION', { label: sentenceCase(buildingWithArticle(building)) });
  }
  const level = settlement.buildings[building];
  const paid = upgradeCost(building, level);
  for (const resource of RESOURCE_IDS) {
    const refund = scaleDown((paid[resource] ?? 0) * MILLI, balance.construction.cancelRefund);
    settlement.resources[resource] += refund;
  }
  settlement.constructionQueues[index] = null;
  emit(
    events,
    draft,
    nowMs,
    'constructionCancelled',
    { building, level },
    { edificio: buildingWithArticle(building), nivel: level },
  );
  return null;
}

/** Nível que a próxima obra de um edifício alcançaria, contando a que já está em andamento. */
function nextPlannableLevel(state: GameState, building: BuildingId): number {
  const underway = constructionOf(state, building);
  return (underway?.targetLevel ?? state.settlement.buildings[building]) + 1;
}

/** Põe uma melhoria na lista de planejadas. Não gasta nada nem começa sozinha na v0.1. */
export function planConstruction(draft: GameState, building: unknown): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  const label = sentenceCase(buildingWithArticle(building));
  if (draft.settlement.planned.some((plan) => plan.building === building)) {
    return reject('ALREADY_PLANNED', { label });
  }
  const targetLevel = nextPlannableLevel(draft, building);
  if (targetLevel > buildings[building].maxLevel) {
    return reject('MAX_LEVEL', { label });
  }
  draft.settlement.planned.push({ building, targetLevel });
  return null;
}

export function unplanConstruction(draft: GameState, building: unknown): Rejection | null {
  if (!isBuildingId(building)) {
    return reject('INVALID_BUILDING');
  }
  if (!draft.settlement.planned.some((plan) => plan.building === building)) {
    return reject('NOT_PLANNED', { label: sentenceCase(buildingWithArticle(building)) });
  }
  unplan(draft, building);
  return null;
}
