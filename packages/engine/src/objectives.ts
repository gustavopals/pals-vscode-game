import { balance, type ObjectiveCondition, objectives, type ResourceAmounts } from '@lotg/content';

import { emit } from './chronicle';
import { grantResources } from './construction';
import type { GameEvent, GameState } from './types';
import { positiveEntries } from './units';

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

/** "+20 ouro", "+20 ouro e +30 madeira". */
export function describeReward(reward: ResourceAmounts): string {
  return positiveEntries(reward)
    .map(([id, amount]) => `+${amount} ${balance.resources[id].label.toLowerCase()}`)
    .join(' e ');
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
      grantResources(draft, objective.reward);
      const reward = describeReward(objective.reward);
      emit(
        events,
        draft,
        atMs,
        'objectiveCompleted',
        { objective: objective.id },
        { objetivo: objective.title, recompensa: reward },
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
