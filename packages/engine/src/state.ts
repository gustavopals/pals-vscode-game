import { balance, BUILDING_IDS, DIFFICULTY_IDS, objectives } from '@lotg/content';

import type { BuildingId, GameSettings, GameState } from './types';
import { amountsToMilli, assertTimeScale } from './units';

/** Cópia profunda: o estado é JSON puro, sem datas, mapas ou funções. */
export function cloneState(state: GameState): GameState {
  return JSON.parse(JSON.stringify(state)) as GameState;
}

/** Estado inicial reproduzível de um feudo: mesma semente e mesmas escolhas, mesmo estado. */
export function createInitialState(seed: string, settings: GameSettings): GameState {
  assertTimeScale(settings.timeScale);
  if (!DIFFICULTY_IDS.includes(settings.difficulty)) {
    throw new Error(`Dificuldade desconhecida: ${String(settings.difficulty)}.`);
  }
  const levels = Object.fromEntries(
    BUILDING_IDS.map((id) => [id, balance.initial.buildingLevel]),
  ) as Record<BuildingId, number>;

  return {
    schemaVersion: 3,
    seed,
    settings: {
      settlementName: settings.settlementName,
      timezone: settings.timezone,
      vigilHourLocal: settings.vigilHourLocal,
      difficulty: settings.difficulty,
      timeScale: settings.timeScale,
    },
    migratedAtMs: null,
    clock: { gameTimeMs: 0, yearStartMs: 0, year: 1 },
    lastProcessedAt: 0,
    rng: {},
    settlement: {
      name: settings.settlementName,
      resources: amountsToMilli(balance.initial.resources),
      accumulators: { food: 0, wood: 0, stone: 0, gold: 0 },
      population: { villagers: balance.initial.villagers },
      workers: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 },
      buildings: levels,
      constructionQueues: Array.from({ length: balance.construction.queues }, () => null),
      planned: [],
      recruitmentQueue: [],
      famine: null,
      cold: null,
    },
    objectives: {
      active: objectives.slice(0, balance.objectives.maxActive).map((objective) => objective.id),
      completed: [],
    },
    stats: {},
  };
}
