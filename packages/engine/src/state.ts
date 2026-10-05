import {
  balance,
  BUILDING_IDS,
  buildings,
  DIFFICULTY_IDS,
  objectives,
  startingTiles,
} from '@lotg/content';

import { scriptedRaidsAfter } from './raids';
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
  // O Celeiro, o Armazém, a Torre de Vigia e a Paliçada nascem no nível 0: ainda não foram
  // construídos.
  const levels = Object.fromEntries(
    BUILDING_IDS.map((id) => [id, buildings[id].initialLevel]),
  ) as Record<BuildingId, number>;

  return {
    schemaVersion: 12,
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
      lastFamine: null,
      cold: null,
      wasted: { food: 0, wood: 0, stone: 0, gold: 0 },
      craftExperience: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 },
      craftMasteredYear: { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 },
      adaptation: [],
      // A moral nasce na base e é recalculada na primeira virada de dia (GDD §5.7).
      morale: balance.morale.base,
      moraleEffects: [],
      injured: [],
    },
    council: {
      pending: [],
      flags: {},
      seenThisYear: [],
      // A primeira audiência do Conselho é um intervalo depois da fundação (GDD §7.1).
      nextDrawAtMs: balance.council.drawIntervalDays * balance.calendar.dayMs,
      scheduled: [],
      delayed: [],
      expired: [],
    },
    // O Covil de Lobos está ativo desde o primeiro dia, e a Ameaça começa em zero (GDD §8.2).
    map: {
      tiles: Object.fromEntries(
        startingTiles.map((tile) => [
          tile.id,
          { type: tile.type, threatActive: tile.threatActive },
        ]),
      ),
      threat: 0,
    },
    // A incursão do roteiro do ano 1 nasce marcada; as outras são sorteadas pela Ameaça.
    horde: { scheduledRaids: scriptedRaidsAfter(0) },
    objectives: {
      active: objectives.slice(0, balance.objectives.maxActive).map((objective) => objective.id),
      completed: [],
    },
    stats: {},
  };
}
