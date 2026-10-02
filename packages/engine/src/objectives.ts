import {
  balance,
  type ObjectiveCondition,
  type ObjectiveDef,
  objectives,
  RESOURCE_IDS,
} from '@lotg/content';

import { emit } from './chronicle';
import { joinList } from './format';
import { grantResources } from './storage';
import type { GameEvent, GameState } from './types';
import { MILLI, positiveEntries } from './units';

/** Quanto falta para cumprir uma condição: o objetivo está cumprido quando `current ≥ target`. */
export function objectiveProgress(
  state: GameState,
  condition: ObjectiveCondition,
): { current: number; target: number } {
  const { settlement, stats } = state;
  switch (condition.type) {
    case 'workersAtLeast':
      return { current: settlement.workers[condition.building], target: condition.count };
    case 'constructionStarted':
      return { current: stats[`constructionsStarted:${condition.building}`] ?? 0, target: 1 };
    case 'villagersRecruited':
      return { current: stats.villagersRecruited ?? 0, target: condition.count };
    case 'buildingLevel':
      return { current: settlement.buildings[condition.building], target: condition.level };
  }
}

/**
 * "+20 ouro", "+20 ouro e +30 madeira"; para a recompensa que não é recurso, o texto do
 * conteúdo: "desbloqueia o Celeiro e o Armazém".
 */
export function describeReward({ reward, rewardText }: ObjectiveDef): string {
  const parts = positiveEntries(reward).map(
    ([id, amount]) => `+${amount} ${balance.resources[id].label.toLowerCase()}`,
  );
  return joinList(rewardText === undefined ? parts : [...parts, rewardText]);
}

/**
 * Conclui os objetivos ativos já cumpridos, credita a recompensa e revela os seguintes.
 * Roda depois de cada comando e de cada evento; nunca há mais de três ativos.
 */
export function evaluateObjectives(draft: GameState, atMs: number, events: GameEvent[]): void {
  const tracker = draft.objectives;
  let completedSomething = true;
  while (completedSomething) {
    completedSomething = false;
    for (const objective of objectives) {
      if (!tracker.active.includes(objective.id)) {
        continue;
      }
      const { current, target } = objectiveProgress(draft, objective.condition);
      if (current < target) {
        continue;
      }
      tracker.active = tracker.active.filter((id) => id !== objective.id);
      tracker.completed.push(objective.id);
      // A recompensa é um ganho discreto: entra o que cabe no depósito (GDD §5.5).
      const stored = grantResources(draft, objective.reward);
      const gained = Object.fromEntries(
        RESOURCE_IDS.filter((id) => stored[id] > 0).map((id) => [
          `gained_${id}`,
          stored[id] / MILLI,
        ]),
      );
      emit(
        events,
        draft,
        atMs,
        'objectiveCompleted',
        { objective: objective.id, ...gained },
        { objetivo: objective.title, recompensa: describeReward(objective) },
      );
      completedSomething = true;
    }
    for (const objective of objectives) {
      if (tracker.active.length >= balance.objectives.maxActive) {
        break;
      }
      if (!tracker.active.includes(objective.id) && !tracker.completed.includes(objective.id)) {
        tracker.active.push(objective.id);
      }
    }
  }
}
