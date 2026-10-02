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
import { calendarAt, nextDayBoundary, nextSeasonBoundary, seasonAfter } from './clock';
import {
  cancelRefund,
  constructionOf,
  queuesUnlocked,
  upgradeDurationAt,
  upgradeDurationMs,
  upgradeQuote,
} from './construction';
import {
  consumptionRate,
  firewoodRate,
  foodRunsOutIn,
  netRates,
  producedBy,
  producerOf,
  productionFactors,
  productionRate,
  woodRunsOutIn,
} from './economy';
import { decimal, plural } from './format';
import { describeReward, objectiveProgress } from './objectives';
import { paceLabel } from './pace';
import { planCost } from './planned';
import { plannedWaiting, queuesNote } from './plannedView';
import {
  freeVillagers,
  housingCapacity,
  housingVacancy,
  recruitmentBlock,
  recruitmentDurationMs,
} from './population';
import {
  constructionDurationNote,
  firewoodForecast,
  recruitmentDurationNote,
  seasonChanges,
  seasonEffectsText,
  winterView,
} from './seasonView';
import { storable } from './storage';
import { storageEffect, storageRow } from './storageView';
import type {
  ActiveConstructionView,
  BuildingId,
  Construction,
  GameState,
  ObjectiveView,
  PlannedConstruction,
  PlannedUpgradeView,
  ProductionBuildingId,
  ResourceCostView,
  ResourceId,
  UpgradeView,
  ViewState,
} from './types';
import { assertTimeScale, MILLI, positiveEntries, SECOND_MS } from './units';

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

/**
 * Como o tempo de jogo aparece para o jogador. O motor roda em tempo de jogo; no ritmo `N`, uma
 * hora real são `N` horas de jogo (GDD §4.2). A interface só fala em tempo real: prazos são
 * divididos pelo ritmo e taxas "por hora" são multiplicadas por ele.
 */
export type ViewOptions = {
  /** Horas de jogo por hora real. Sem ele, vale o ritmo gravado na partida (`settings.timeScale`). */
  readonly timeScale?: number;
};

/** Segundos reais (arredondados para cima) de uma duração em ms de jogo. */
function realSecondsCeil(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.ceil(gameMs / timeScale / SECOND_MS));
}

function realSecondsFloor(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.floor(gameMs / timeScale / SECOND_MS));
}

/**
 * "4 trabalhadores × 10 × 1,2 (Nv2) × 1,3 (outono) = 62,4/h", por hora real: um termo para cada
 * fator da conta de `productionRate`. O nível aparece sempre; os outros, só quando mexem.
 */
function productionBreakdown(
  state: GameState,
  building: ProductionBuildingId,
  timeScale: number,
): string {
  const { perWorkerPerHour } = balance.production;
  const factors = productionFactors(state, building)
    .filter(({ id, ratio }) => id === 'level' || ratio.num !== ratio.den)
    .map(({ ratio, label }) => ` × ${decimal(ratio.num / ratio.den)} (${label})`)
    .join('');
  const total = decimal((productionRate(state, building) * timeScale) / MILLI);
  const hands = plural(state.settlement.workers[building], 'trabalhador', 'trabalhadores');
  const perWorker = decimal(perWorkerPerHour[building] * timeScale);
  return `${hands} × ${perWorker}${factors} = ${total}/h`;
}

function resourceBreakdown(state: GameState, resource: ResourceId, timeScale: number): string {
  const producer = producerOf(resource);
  const parts = [
    `${buildings[producer].label}: ${productionBreakdown(state, producer, timeScale)}`,
  ];
  const { villagers } = state.settlement.population;
  if (resource === 'food') {
    const perVillager = decimal(balance.consumption.foodPerVillagerPerHour * timeScale);
    const consumed = decimal((consumptionRate(state) * timeScale) / MILLI);
    parts.push(`consumo ${villagers} × ${perVillager} = ${consumed}/h`);
  }
  const firewood = firewoodRate(state);
  if (resource === 'wood' && firewood > 0) {
    const burned = decimal((firewood * timeScale) / MILLI);
    parts.push(`−${burned}/h (lenha de ${plural(villagers, 'habitante', 'habitantes')})`);
  }
  return parts.join('; ');
}

/**
 * O que o cancelamento devolve agora, já com o limite do depósito: `amount` entra no estoque e
 * `lost` é o que não cabe e se perde.
 */
function refundView(state: GameState, building: BuildingId, fromLevel: number) {
  const refund = cancelRefund(building, fromLevel);
  return RESOURCE_IDS.filter((resource) => refund[resource] > 0).map((resource) => {
    const stored = storable(state, resource, refund[resource]);
    return {
      resource,
      label: balance.resources[resource].label,
      amount: stored / MILLI,
      lost: (refund[resource] - stored) / MILLI,
    };
  });
}

/**
 * A frase que explica o prazo de uma obra iniciada agora, quando a estação mexe nele. Se o teto
 * de 8 h absorve o fator inteiro, o prazo é o de tabela e não há o que explicar.
 */
function durationNote(state: GameState, building: BuildingId, fromLevel: number): string | null {
  const now = state.lastProcessedAt;
  return upgradeDurationAt(building, fromLevel, now) === upgradeDurationMs(building, fromLevel)
    ? null
    : constructionDurationNote(calendarAt(now).season);
}

function upgradeView(state: GameState, building: BuildingId, timeScale: number): UpgradeView {
  const quote = upgradeQuote(state, building);
  return {
    building,
    label: buildings[building].label,
    fromLevel: quote.fromLevel,
    targetLevel: quote.targetLevel,
    cost: costView(state, quote.cost),
    durationSeconds: realSecondsCeil(quote.durationMs, timeScale),
    durationNote: durationNote(state, building, quote.fromLevel),
    affordable: Object.keys(quote.missing).length === 0,
    blockedCode: quote.blocked?.code ?? null,
    blockedReason: quote.blocked?.message ?? null,
    planned: state.settlement.planned.some((plan) => plan.building === building),
    effect: storageEffect(state, building, quote.targetLevel),
  };
}

function plannedView(
  state: GameState,
  plan: PlannedConstruction,
  rates: Record<ResourceId, number>,
  timeScale: number,
): PlannedUpgradeView {
  const { building, targetLevel } = plan;
  const costs = costView(state, planCost(plan));
  return {
    building,
    label: buildings[building].label,
    fromLevel: targetLevel - 1,
    targetLevel,
    cost: costs,
    durationSeconds: realSecondsCeil(
      upgradeDurationAt(building, targetLevel - 1, state.lastProcessedAt),
      timeScale,
    ),
    durationNote: durationNote(state, building, targetLevel - 1),
    affordable: costs.every((entry) => entry.missing === 0),
    blockedCode: null,
    blockedReason: null,
    planned: true,
    effect: storageEffect(state, building, targetLevel),
    autoStart: plan.autoStart,
    waiting: plannedWaiting(state, plan, rates, timeScale),
  };
}

/** Uma obra em curso, como a fila a mostra: prazo, andamento e o que o cancelamento devolve. */
function activeView(
  state: GameState,
  slot: Construction,
  timeScale: number,
): ActiveConstructionView {
  const now = state.lastProcessedAt;
  return {
    building: slot.building,
    label: buildings[slot.building].label,
    targetLevel: slot.targetLevel,
    secondsRemaining: realSecondsCeil(slot.finishesAtMs - now, timeScale),
    totalSeconds: realSecondsCeil(slot.finishesAtMs - slot.startedAtMs, timeScale),
    progressPercent: Math.floor(
      ((now - slot.startedAtMs) * 100) / (slot.finishesAtMs - slot.startedAtMs),
    ),
    refund: refundView(state, slot.building, slot.targetLevel - 1),
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
        reward: describeReward(objective),
        status: done ? 'completed' : 'active',
        progress: { current: done ? target : Math.min(current, target), target },
      };
    });
}

/**
 * Tudo que a interface precisa, já calculado, com o "por quê" de cada número.
 * A formatação de números para exibição fica com a UI; aqui saem números e textos de explicação.
 * Aceita um instante futuro: avança uma cópia do estado antes de derivar, sem mutar a entrada.
 * Prazos e taxas saem em tempo real, conforme o ritmo da partida (`settings.timeScale`, ou
 * `options.timeScale` quando quem chama quer ver o mesmo estado em outro ritmo).
 */
export function deriveViewState(
  input: GameState,
  gameTimeMs: number,
  options: ViewOptions = {},
): ViewState {
  const timeScale = options.timeScale ?? input.settings.timeScale;
  assertTimeScale(timeScale);
  const perRealHour = (milliPerGameHour: number) => (milliPerGameHour * timeScale) / MILLI;
  if (gameTimeMs < input.lastProcessedAt) {
    throw new Error(
      `deriveViewState não volta no tempo: o estado está em ${input.lastProcessedAt} e o pedido é ${gameTimeMs}.`,
    );
  }
  const state = advanceTo(input, gameTimeMs).state;
  const now = state.lastProcessedAt;
  const until = (gameMs: number) => realSecondsCeil(gameMs - now, timeScale);
  const { settlement } = state;
  const date = calendarAt(now);
  const rates = netRates(state);
  const capacity = housingCapacity(state);
  const { villagers } = settlement.population;
  const runsOutIn: Partial<Record<ResourceId, number | null>> = {
    food: foodRunsOutIn(state, rates),
    wood: woodRunsOutIn(state, rates),
  };
  const nextSeason = seasonAfter(date.season);

  // Uma entrada por fila aberta; a fila que o Salão ainda não abriu não aparece.
  const queues = Array.from({ length: queuesUnlocked(state) }, (_, index) => {
    const slot = settlement.constructionQueues[index] ?? null;
    return slot === null ? null : activeView(state, slot, timeScale);
  });
  const nextRecruit = settlement.recruitmentQueue[0];
  const { cost: recruitCost, maxPerOrder, maxQueue } = balance.recruitment;
  const maxQuantity = Math.max(
    0,
    Math.min(maxPerOrder, maxQueue - settlement.recruitmentQueue.length, housingVacancy(state)),
  );

  return {
    settlement: {
      name: settlement.name,
      townHallLevel: settlement.buildings.townHall,
      difficulty: state.settings.difficulty,
      difficultyLabel: balance.difficulties[state.settings.difficulty].label,
      // O rótulo é o do ritmo em que os prazos desta visão foram escritos.
      paceLabel: paceLabel(timeScale),
    },
    calendar: {
      year: date.year,
      season: date.season.id,
      seasonLabel: date.season.label,
      dayOfSeason: date.dayOfSeason,
      dayOfYear: date.dayOfYear,
      secondsToNextDay: until(nextDayBoundary(now)),
      secondsToNextSeason: until(nextSeasonBoundary(now)),
      seasonEffects: seasonEffectsText(date.season, timeScale),
      nextSeason: {
        id: nextSeason.id,
        label: nextSeason.label,
        secondsUntil: until(nextSeasonBoundary(now)),
        changes: seasonChanges(date.season, nextSeason, timeScale),
        firewood: firewoodForecast(state, timeScale),
      },
    },
    population: {
      villagers,
      capacity,
      free: freeVillagers(state),
      inTraining: settlement.recruitmentQueue.length,
      housed: capacity - housingVacancy(state),
      vacancies: housingVacancy(state),
      secondsToNextRecruit:
        nextRecruit === undefined || settlement.famine ? null : until(nextRecruit.finishesAtMs),
      breakdown: BUILDING_IDS.flatMap((id) => {
        const perLevel = balance.housing.capacityPerLevel[id];
        return perLevel === undefined
          ? []
          : [`${buildings[id].label} Nv${settlement.buildings[id]} × ${perLevel}`];
      })
        .join(' + ')
        .concat(` = ${capacity} vagas`),
    },
    resources: RESOURCE_IDS.map((id) => {
      const runsOut = runsOutIn[id] ?? null;
      return {
        id,
        label: balance.resources[id].label,
        stock: Math.floor(settlement.resources[id] / MILLI),
        ...storageRow(state, id, rates, timeScale),
        perHour: Math.round((rates[id] * timeScale) / 100) / 10,
        depletesInSeconds: runsOut === null ? null : realSecondsFloor(runsOut, timeScale),
        breakdown: resourceBreakdown(state, id, timeScale),
      };
    }),
    workers: PRODUCTION_BUILDING_IDS.map((building) => ({
      building,
      label: buildings[building].label,
      level: settlement.buildings[building],
      resource: producedBy(building),
      assigned: settlement.workers[building],
      grossPerHour: perRealHour(productionRate(state, building)),
      perWorkerPerHour: perRealHour(productionRate(state, building, 1)),
      breakdown: productionBreakdown(state, building, timeScale),
    })),
    constructions: {
      active: queues.find((entry) => entry !== null) ?? null,
      queues,
      queuesUnlocked: queues.length,
      queuesNote: queuesNote(state),
      planned: settlement.planned.map((plan) => plannedView(state, plan, rates, timeScale)),
      available: BUILDING_IDS.filter(
        (id) =>
          constructionOf(state, id) === null && settlement.buildings[id] < buildings[id].maxLevel,
      ).map((id) => upgradeView(state, id, timeScale)),
    },
    recruitment: {
      cost: costView(state, recruitCost),
      secondsPerVillager: realSecondsCeil(recruitmentDurationMs(date.season), timeScale),
      durationNote: recruitmentDurationNote(date.season),
      maxQuantity,
      blockedReason: recruitmentBlock(state, 1)?.message ?? null,
    },
    famine:
      settlement.famine === null
        ? null
        : {
            sinceMs: settlement.famine.sinceMs,
            secondsElapsed: realSecondsFloor(now - settlement.famine.sinceMs, timeScale),
            text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar.',
          },
    winter: winterView(state, timeScale),
    objectives: objectivesView(state),
    pendingDecisions: [],
  };
}
