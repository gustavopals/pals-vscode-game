import {
  balance,
  cutRewardTemplates,
  type ObjectiveCondition,
  type ObjectiveDef,
  objectives,
  type ResourceAmounts,
} from '@lotg/content';

import { emit } from './chronicle';
import { amountsData } from './construction';
import { decimal, joinList } from './format';
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
 * conteúdo: "desbloqueia o Celeiro, o Armazém e a Torre de Vigia".
 */
export function describeReward({ reward, rewardText }: ObjectiveDef): string {
  const parts = positiveEntries(reward).map(
    ([id, amount]) => `+${amount} ${balance.resources[id].label.toLowerCase()}`,
  );
  return joinList(rewardText === undefined ? parts : [...parts, rewardText]);
}

/** O que não coube de uma recompensa, com a fração: "25,2 de comida". */
function describeCut(lost: ResourceAmounts): string {
  return joinList(
    positiveEntries(lost).map(
      ([id, amount]) => `${decimal(amount, 3)} de ${balance.resources[id].label.toLowerCase()}`,
    ),
  );
}

/**
 * Conclui os objetivos ativos já cumpridos, credita a recompensa e revela os seguintes.
 * Roda depois de cada comando e de cada evento; nunca há mais de três ativos. Devolve se
 * concluiu algum: uma recompensa mexe no estoque, e quem espera recurso confere de novo.
 */
export function evaluateObjectives(draft: GameState, atMs: number, events: GameEvent[]): boolean {
  const tracker = draft.objectives;
  const completedBefore = tracker.completed.length;
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
      // A recompensa é um ganho discreto: entra o que cabe no depósito (GDD §5.5). O evento
      // diz o que entrou e o que não coube, e a linha da Crônica, o que foi ao chão.
      const stored = grantResources(draft, objective.reward);
      const gained: ResourceAmounts = {};
      const lost: ResourceAmounts = {};
      for (const [resource, amount] of positiveEntries(objective.reward)) {
        if (stored[resource] > 0) {
          gained[resource] = stored[resource] / MILLI;
        }
        if (stored[resource] < amount * MILLI) {
          lost[resource] = (amount * MILLI - stored[resource]) / MILLI;
        }
      }
      const cut = positiveEntries(lost).length > 0;
      emit(
        events,
        draft,
        atMs,
        'objectiveCompleted',
        { objective: objective.id, ...amountsData('gained', gained), ...amountsData('lost', lost) },
        {
          objetivo: objective.title,
          recompensa: describeReward(objective),
          ...(cut ? { perda: describeCut(lost) } : {}),
        },
        cut ? cutRewardTemplates.objectiveCompleted : undefined,
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
  return tracker.completed.length > completedBefore;
}
