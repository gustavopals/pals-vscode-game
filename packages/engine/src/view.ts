import {
  balance,
  BUILDING_IDS,
  buildings,
  objectives,
  PRODUCTION_BUILDING_IDS,
  type ResourceAmounts,
  RESOURCE_IDS,
} from '@lotg/content';

import { advanceTo } from './advance';
import { calendarAt, nextDayBoundary, nextSeasonBoundary } from './clock';
import { constructionOf, upgradeCost, upgradeDurationMs, upgradeQuote } from './construction';
import { consumptionRate, foodRunsOutIn, netRates, productionRate, storageCap } from './economy';
import { describeReward, objectiveProgress } from './objectives';
import { freeVillagers, housingCapacity, housingVacancy, recruitmentBlock } from './population';
import type {
  BuildingId,
  GameState,
  ObjectiveView,
  ProductionBuildingId,
  ResourceCostView,
  ResourceId,
  UpgradeView,
  ViewState,
} from './types';
import { MILLI, positiveEntries, SECOND_MS, secondsUntil } from './units';

/** Número com vírgula decimal e até duas casas, para os textos de explicação. */
function decimal(value: number): string {
  return String(Math.round(value * 100) / 100).replace('.', ',');
}

function plural(count: number, singular: string, pluralForm: string): string {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

function costView(state: GameState, cost: ResourceAmounts, quantity = 1): ResourceCostView[] {
  return positiveEntries(cost).map(([resource, amount]) => {
    const total = amount * quantity;
    const shortfall = total * MILLI - state.settlement.resources[resource];
    return {
      resource,
      label: balance.resources[resource].label,
      amount: total,
      missing: shortfall > 0 ? Math.ceil(shortfall / MILLI) : 0,
    };
  });
}

/** "4 trabalhadores × 10 × 1,2 (Nv2) = 48/h". */
function productionBreakdown(state: GameState, building: ProductionBuildingId): string {
  const { levelBonus, perWorkerPerHour } = balance.production;
  const { workers, buildings: levels, famine } = state.settlement;
  const level = levels[building];
  const bonus = (levelBonus.den + levelBonus.num * (level - 1)) / levelBonus.den;
  const { num, den } = balance.famine.productionMultiplier;
  const penalty = famine ? ` × ${decimal(num / den)} (fome)` : '';
  const total = decimal(productionRate(state, building) / MILLI);
  const hands = plural(workers[building], 'trabalhador', 'trabalhadores');
  return `${hands} × ${perWorkerPerHour[building]} × ${decimal(bonus)} (Nv${level})${penalty} = ${total}/h`;
}

function producerOf(resource: ResourceId): ProductionBuildingId {
  const producer = PRODUCTION_BUILDING_IDS.find((id) => buildings[id].produces === resource);
  if (producer === undefined) {
    throw new Error(`Nenhum edifício produz ${resource}.`);
  }
  return producer;
}

function resourceBreakdown(state: GameState, resource: ResourceId): string {
  const producer = producerOf(resource);
  const parts = [`${buildings[producer].label}: ${productionBreakdown(state, producer)}`];
  if (resource === 'food') {
    const { villagers } = state.settlement.population;
    const perVillager = balance.consumption.foodPerVillagerPerHour;
    const consumed = decimal(consumptionRate(state) / MILLI);
    parts.push(`consumo ${villagers} × ${perVillager} = ${consumed}/h`);
  }
  return parts.join('; ');
}

function upgradeView(state: GameState, building: BuildingId): UpgradeView {
  const quote = upgradeQuote(state, building);
  return {
    building,
    label: buildings[building].label,
    fromLevel: quote.fromLevel,
    targetLevel: quote.targetLevel,
    cost: costView(state, quote.cost),
    durationSeconds: Math.ceil(quote.durationMs / SECOND_MS),
    affordable: Object.keys(quote.missing).length === 0,
    blockedCode: quote.blocked?.code ?? null,
    blockedReason: quote.blocked?.message ?? null,
    planned: state.settlement.planned.some((plan) => plan.building === building),
  };
}

function plannedView(state: GameState, building: BuildingId, targetLevel: number): UpgradeView {
  const cost = upgradeCost(building, targetLevel - 1);
  const costs = costView(state, cost);
  return {
    building,
    label: buildings[building].label,
    fromLevel: targetLevel - 1,
    targetLevel,
    cost: costs,
    durationSeconds: Math.ceil(upgradeDurationMs(building, targetLevel - 1) / SECOND_MS),
    affordable: costs.every((entry) => entry.missing === 0),
    blockedCode: null,
    blockedReason: null,
    planned: true,
  };
}

function objectivesView(state: GameState): ObjectiveView[] {
  const { active, completed } = state.objectives;
  return objectives
    .filter((objective) => active.includes(objective.id) || completed.includes(objective.id))
    .map((objective) => {
      const { current, target } = objectiveProgress(state, objective.condition);
      const done = completed.includes(objective.id);
      return {
        id: objective.id,
        title: objective.title,
        hint: objective.hint,
        reward: describeReward(objective.reward),
        status: done ? 'completed' : 'active',
        progress: { current: done ? target : Math.min(current, target), target },
      };
    });
}

/**
 * Tudo que a interface precisa, já calculado, com o "por quê" de cada número.
 * A formatação de números para exibição fica com a UI; aqui saem números e textos de explicação.
 * Aceita um instante futuro: avança uma cópia do estado antes de derivar, sem mutar a entrada.
 */
export function deriveViewState(input: GameState, gameTimeMs: number): ViewState {
  if (gameTimeMs < input.lastProcessedAt) {
    throw new Error(
      `deriveViewState não volta no tempo: o estado está em ${input.lastProcessedAt} e o pedido é ${gameTimeMs}.`,
    );
  }
  const state = advanceTo(input, gameTimeMs).state;
  const now = state.lastProcessedAt;
  const { settlement } = state;
  const date = calendarAt(now);
  const rates = netRates(state);
  const capacity = housingCapacity(state);
  const { villagers } = settlement.population;
  const foodRunsOut = foodRunsOutIn(state);

  const active = settlement.constructionQueues.find((slot) => slot !== null) ?? null;
  const nextRecruit = settlement.recruitmentQueue[0];
  const { cost: recruitCost, durationMs, maxPerOrder, maxQueue } = balance.recruitment;
  const maxQuantity = Math.max(
    0,
    Math.min(maxPerOrder, maxQueue - settlement.recruitmentQueue.length, housingVacancy(state)),
  );

  return {
    settlement: { name: settlement.name, townHallLevel: settlement.buildings.townHall },
    calendar: {
      year: date.year,
      season: date.season.id,
      seasonLabel: date.season.label,
      dayOfSeason: date.dayOfSeason,
      dayOfYear: date.dayOfYear,
      secondsToNextDay: secondsUntil(now, nextDayBoundary(now)),
      secondsToNextSeason: secondsUntil(now, nextSeasonBoundary(now)),
    },
    population: {
      villagers,
      capacity,
      free: freeVillagers(state),
      inTraining: settlement.recruitmentQueue.length,
      secondsToNextRecruit:
        nextRecruit === undefined || settlement.famine
          ? null
          : secondsUntil(now, nextRecruit.finishesAtMs),
      breakdown: BUILDING_IDS.flatMap((id) => {
        const perLevel = balance.housing.capacityPerLevel[id];
        return perLevel === undefined
          ? []
          : [`${buildings[id].label} Nv${settlement.buildings[id]} × ${perLevel}`];
      })
        .join(' + ')
        .concat(` = ${capacity} vagas`),
    },
    resources: RESOURCE_IDS.map((id) => ({
      id,
      label: balance.resources[id].label,
      stock: Math.floor(settlement.resources[id] / MILLI),
      cap: storageCap(),
      perHour: Math.round(rates[id] / 100) / 10,
      depletesInSeconds:
        id === 'food' && foodRunsOut !== null ? Math.floor(foodRunsOut / SECOND_MS) : null,
      breakdown: resourceBreakdown(state, id),
    })),
    workers: PRODUCTION_BUILDING_IDS.map((building) => ({
      building,
      label: buildings[building].label,
      level: settlement.buildings[building],
      resource: buildings[building].produces as ResourceId,
      assigned: settlement.workers[building],
      grossPerHour: productionRate(state, building) / MILLI,
      breakdown: productionBreakdown(state, building),
    })),
    constructions: {
      active:
        active === null
          ? null
          : {
              building: active.building,
              label: buildings[active.building].label,
              targetLevel: active.targetLevel,
              secondsRemaining: secondsUntil(now, active.finishesAtMs),
              totalSeconds: Math.ceil((active.finishesAtMs - active.startedAtMs) / SECOND_MS),
              progressPercent: Math.floor(
                ((now - active.startedAtMs) * 100) / (active.finishesAtMs - active.startedAtMs),
              ),
            },
      planned: settlement.planned.map((plan) =>
        plannedView(state, plan.building, plan.targetLevel),
      ),
      available: BUILDING_IDS.filter(
        (id) =>
          constructionOf(state, id) === null && settlement.buildings[id] < buildings[id].maxLevel,
      ).map((id) => upgradeView(state, id)),
    },
    recruitment: {
      cost: costView(state, recruitCost),
      secondsPerVillager: Math.ceil(durationMs / SECOND_MS),
      maxQuantity,
      blockedReason: recruitmentBlock(state, 1)?.message ?? null,
    },
    famine:
      settlement.famine === null
        ? null
        : {
            sinceMs: settlement.famine.sinceMs,
            secondsElapsed: Math.floor((now - settlement.famine.sinceMs) / SECOND_MS),
            text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar.',
          },
    objectives: objectivesView(state),
    pendingDecisions: [],
  };
}
