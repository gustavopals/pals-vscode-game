import {
  balance,
  BUILDING_IDS,
  buildings,
  foundingTemplates,
  type Ratio,
  RESOURCE_IDS,
  type ResourceAmounts,
} from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import { sentenceCase } from './format';
import { reject } from './rejections';
import { costBeyondStorage, storagePlace, storeResource } from './storage';
import type {
  BuildingId,
  Construction,
  GameEvent,
  GameState,
  Rejection,
  ResourceId,
} from './types';
import { MILLI, positiveEntries, scaleDown } from './units';

export function isBuildingId(value: unknown): value is BuildingId {
  return (BUILDING_IDS as readonly unknown[]).includes(value);
}

/** "a Serraria", "as Habitações". */
export function buildingWithArticle(building: BuildingId): string {
  const def = buildings[building];
  return `${def.article} ${def.label}`;
}

/** arredondar(valor × fator^passos), só com inteiros. */
function growRounded(value: number, factor: Ratio, steps: number): number {
  const num = value * factor.num ** steps;
  const den = factor.den ** steps;
  return Math.floor((2 * num + den) / (2 * den));
}

/**
 * Quantas obras o edifício já teve quando está em `fromLevel`: é o expoente do custo e do prazo.
 * Conta a partir do nível com que ele nasce, então a primeira obra sai sempre pelo custo base: a
 * melhoria 1 → 2 de quem nasce erguido e a construção 0 → 1 do Celeiro e do Armazém (GDD §6.2).
 */
function upgradeSteps(building: BuildingId, fromLevel: number): number {
  return fromLevel - buildings[building].initialLevel;
}

/** A obra que parte de `fromLevel` ergue o edifício do zero. */
export function isFounding(fromLevel: number): boolean {
  return fromLevel === 0;
}

/** Custo, em unidades, de levar um edifício de `fromLevel` para o nível seguinte (GDD §6.2). */
export function upgradeCost(building: BuildingId, fromLevel: number): ResourceAmounts {
  const { costFactor, costFactorByBuilding } = balance.construction;
  const factor = costFactorByBuilding[building] ?? costFactor;
  const cost: ResourceAmounts = {};
  for (const [resource, base] of positiveEntries(buildings[building].baseCost)) {
    cost[resource] = growRounded(base, factor, upgradeSteps(building, fromLevel));
  }
  return cost;
}

/**
 * Duração da obra a partir de `fromLevel`. `seasonFactor` é o fator da estação em que ela começa
 * (no inverno, × 1,5); sem ele, sai o prazo de tabela. É uma conta só, com um arredondamento
 * para baixo, e o teto de 8 h vem **depois** do fator: nenhuma obra exige mais que uma noite,
 * nem no inverno. O prazo é fixado quando a obra começa e não muda na virada (GDD §4.1).
 */
export function upgradeDurationMs(
  building: BuildingId,
  fromLevel: number,
  seasonFactor: Ratio = { num: 1, den: 1 },
): number {
  const { timeFactor, maxDurationMs } = balance.construction;
  const steps = upgradeSteps(building, fromLevel);
  const duration = Math.floor(
    (buildings[building].baseDurationMs * timeFactor.num ** steps * seasonFactor.num) /
      (timeFactor.den ** steps * seasonFactor.den),
  );
  return Math.min(maxDurationMs, duration);
}

/** Duração da obra a partir de `fromLevel` se ela começar no instante `atMs`. */
export function upgradeDurationAt(building: BuildingId, fromLevel: number, atMs: number): number {
  return upgradeDurationMs(building, fromLevel, seasonAt(atMs).effects.constructionDuration);
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

/**
 * O pré-requisito que falta a um edifício (`requires`, GDD §6.1: "Salão 2"): o primeiro, na
 * ordem do catálogo, cujo nível ainda não chegou ao pedido. `null` quando não falta nenhum.
 */
function unmetRequirement(
  state: GameState,
  building: BuildingId,
): { building: BuildingId; level: number } | null {
  const { requires } = buildings[building];
  for (const required of BUILDING_IDS) {
    const level = requires[required];
    if (level !== undefined && state.settlement.buildings[required] < level) {
      return { building: required, level };
    }
  }
  return null;
}

/**
 * A recusa de uma obra cujo custo não cabe no depósito: diz quanto ela pede, quanto o depósito
 * guarda e o que fazer. Quando o próprio depósito é a obra, ou ele já está no nível máximo, não
 * há o que ampliar, e a frase diz isso.
 */
function storageRejection(state: GameState, building: BuildingId, cost: ResourceAmounts) {
  const beyond = costBeyondStorage(state, cost);
  if (beyond === null) {
    return null;
  }
  const place = storagePlace(state, beyond.resource);
  const storeLevel = state.settlement.buildings[beyond.building];
  const canGrow = beyond.building !== building && storeLevel < buildings[beyond.building].maxLevel;
  const verb = storeLevel === 0 ? 'construa' : 'amplie';
  return reject('EXCEEDS_STORAGE', {
    amount: beyond.amount,
    resource: balance.resources[beyond.resource].label.toLowerCase(),
    label: place === null ? '' : `${place.article} ${place.label}`,
    capacity: beyond.capacity,
    ...(canGrow ? { remedy: `${verb} ${buildingWithArticle(beyond.building)} primeiro` } : {}),
  });
}

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
  const requirement = unmetRequirement(state, building);

  let blocked: Rejection | null;
  if (constructionOf(state, building) !== null) {
    blocked = reject('ALREADY_UPGRADING', { label });
  } else if (!settlement.constructionQueues.includes(null)) {
    blocked = reject('QUEUE_BUSY');
  } else if (fromLevel >= def.maxLevel) {
    blocked = reject('MAX_LEVEL', { label });
  } else if (requirement !== null) {
    blocked = reject('GATE_LOCKED', {
      label: buildingWithArticle(requirement.building),
      level: requirement.level,
    });
  } else if (building !== 'townHall' && targetLevel > gate) {
    blocked = reject('GATE_LOCKED', {
      label: buildingWithArticle('townHall'),
      level: targetLevel - balance.construction.gateLevelsAboveTownHall,
    });
  } else {
    // Falta recurso: ou ele nunca vai caber no depósito (e esperar não adianta), ou é só esperar.
    blocked =
      storageRejection(state, building, cost) ??
      (Object.keys(missing).length > 0 ? reject('INSUFFICIENT_RESOURCES', { missing }) : null);
  }

  return {
    building,
    fromLevel,
    targetLevel,
    cost,
    durationMs: upgradeDurationAt(building, fromLevel, state.lastProcessedAt),
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
    { building, level: quote.targetLevel, ...amountsData('spent', quote.cost) },
    { edificio: buildingWithArticle(building), nivel: quote.targetLevel },
    isFounding(quote.fromLevel) ? foundingTemplates.constructionStarted : undefined,
  );
  return null;
}

/**
 * Totais de um evento, em unidades, com uma chave por recurso: `spent_wood`, `gained_gold`. É
 * com eles que o Relatório de Retorno separa o que foi produzido do que foi gasto, recebido e
 * perdido, sem refazer conta nenhuma.
 */
export function amountsData(
  prefix: 'spent' | 'gained',
  amounts: ResourceAmounts,
): Record<string, number> {
  return Object.fromEntries(
    positiveEntries(amounts).map(([resource, amount]) => [`${prefix}_${resource}`, amount]),
  );
}

/**
 * Conclui as obras que vencem até `atMs`. O efeito do nível novo vale a partir daqui. A obra
 * que ergue um edifício do zero termina com evento próprio, `buildingFounded`, no lugar de
 * `constructionFinished`.
 */
export function finishConstructions(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  settlement.constructionQueues.forEach((slot, index) => {
    if (slot === null || slot.finishesAtMs > atMs) {
      return;
    }
    const founded = isFounding(settlement.buildings[slot.building]);
    settlement.buildings[slot.building] = slot.targetLevel;
    settlement.constructionQueues[index] = null;
    emit(
      events,
      draft,
      atMs,
      founded ? 'buildingFounded' : 'constructionFinished',
      { building: slot.building, level: slot.targetLevel },
      { edificio: buildingWithArticle(slot.building), nivel: slot.targetLevel },
    );
  });
}

/** O que volta, em milésimos, ao cancelar a obra que parte de `fromLevel`: 80% do que foi pago. */
export function cancelRefund(building: BuildingId, fromLevel: number): Record<ResourceId, number> {
  const paid = upgradeCost(building, fromLevel);
  const refundOf = (resource: ResourceId) =>
    scaleDown((paid[resource] ?? 0) * MILLI, balance.construction.cancelRefund);
  return {
    food: refundOf('food'),
    wood: refundOf('wood'),
    stone: refundOf('stone'),
    gold: refundOf('gold'),
  };
}

/**
 * Cancela a obra de um edifício e devolve 80% do que foi pago, arredondando para baixo. A
 * devolução é um ganho como outro qualquer: entra o que cabe no depósito, e o que não cabe é
 * desperdício contado (GDD §5.5).
 */
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
  const refund = cancelRefund(building, level);
  const gained: ResourceAmounts = {};
  for (const resource of RESOURCE_IDS) {
    const stored = storeResource(draft, resource, refund[resource]);
    if (stored > 0) {
      gained[resource] = stored / MILLI;
    }
  }
  settlement.constructionQueues[index] = null;
  emit(
    events,
    draft,
    nowMs,
    'constructionCancelled',
    { building, level, ...amountsData('gained', gained) },
    { edificio: buildingWithArticle(building), nivel: level },
    isFounding(level) ? foundingTemplates.constructionCancelled : undefined,
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
