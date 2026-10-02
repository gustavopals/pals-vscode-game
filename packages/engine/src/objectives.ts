import {
  balance,
  cutRewardTemplates,
  type ObjectiveCondition,
  type ObjectiveDef,
  objectives,
  type ResourceAmounts,
} from '@lotg/content';

import { emit } from './chronicle';
import { DAY_MS } from './clock';
import { amountsData } from './construction';
import { decimal, durationText, joinList, plural } from './format';
import { addMoraleEffect } from './morale';
import { seasonsSurvived } from './seasonWatch';
import { grantResources } from './storage';
import type { GameEvent, GameState } from './types';
import { MILLI, positiveEntries, realSecondsCeil } from './units';

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
    case 'anyBuildingLevel':
      // O que mais avançou: basta um deles chegar ao nível.
      return {
        current: Math.max(...condition.buildings.map((building) => settlement.buildings[building])),
        target: condition.level,
      };
    case 'cardAnswered':
      // Só as respostas do jogador: a carta que expira conta em `cardsExpired`.
      return { current: stats.cardsAnswered ?? 0, target: condition.count };
    case 'plannedAutoStart': {
      // A marca dada desde que o motor a conta, ou a que já está na lista (a de uma partida que
      // chegou de uma versão sem o contador): as duas se veem no estado.
      const marked =
        (stats.plansMarkedAuto ?? 0) > 0 || settlement.planned.some((plan) => plan.autoStart);
      return { current: marked ? 1 : 0, target: 1 };
    }
    case 'seasonSurvived':
      return { current: seasonsSurvived(state, condition.season), target: condition.count };
  }
}

/** O efeito temporário de moral que um objetivo deixa: um por objetivo, com o id dele. */
export function objectiveMoraleEffectId(objectiveId: string): string {
  return `objective:${objectiveId}`;
}

/**
 * "+20 ouro", "+20 ouro e +30 madeira"; a moral, com o prazo: "+10 de moral por 1 dia de jogo";
 * para a recompensa que não é recurso nem moral, o texto do conteúdo: "desbloqueia o Celeiro, o
 * Armazém e a Torre de Vigia".
 *
 * O prazo da moral conta dias de jogo. Com `timeScale` (a visão), a frase diz também quanto isso
 * dura no relógio de quem joga: "+10 de moral por 1 dia de jogo (40 min)". A Crônica, que é a
 * mesma em qualquer ritmo, fica só com os dias de jogo.
 */
export function describeReward(
  { reward, morale, rewardText }: ObjectiveDef,
  timeScale?: number,
): string {
  const parts = positiveEntries(reward).map(
    ([id, amount]) => `+${amount} ${balance.resources[id].label.toLowerCase()}`,
  );
  if (morale !== undefined) {
    const days = plural(morale.durationDays, 'dia', 'dias');
    const real =
      timeScale === undefined
        ? ''
        : ` (${durationText(realSecondsCeil(morale.durationDays * DAY_MS, timeScale))})`;
    parts.push(`+${morale.amount} de moral por ${days} de jogo${real}`);
  }
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
 * Conclui os objetivos ativos já cumpridos, credita a recompensa e revela os seguintes, na
 * ordem do conteúdo. Roda depois de cada comando e de cada evento; nunca há mais de três
 * ativos. O estado que sai daqui está acomodado: nenhum ativo está cumprido, e só sobra lugar
 * entre os ativos quando não há mais objetivo a revelar. Devolve se concluiu algum: uma
 * recompensa mexe no estoque, e quem espera recurso confere de novo.
 */
export function evaluateObjectives(draft: GameState, atMs: number, events: GameEvent[]): boolean {
  const tracker = draft.objectives;
  const completedBefore = tracker.completed.length;
  // Enquanto algo mudar: um objetivo concluído abre lugar para o seguinte, e o que acaba de ser
  // revelado pode já estar cumprido (a Torre erguida antes de o objetivo dela aparecer).
  let changed = true;
  while (changed) {
    changed = false;
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
      // A moral não muda na hora (GDD §5.7): o prêmio entra na conta das próximas viradas de
      // dia, como o de uma carta. Um efeito por objetivo: concluir dois soma os dois.
      const { morale } = objective;
      if (morale !== undefined) {
        addMoraleEffect(draft, {
          id: objectiveMoraleEffectId(objective.id),
          label: morale.label,
          amount: morale.amount,
          untilMs: atMs + morale.durationDays * DAY_MS,
        });
      }
      emit(
        events,
        draft,
        atMs,
        'objectiveCompleted',
        {
          objective: objective.id,
          ...amountsData('gained', gained),
          ...amountsData('lost', lost),
          ...(morale === undefined
            ? {}
            : { morale: morale.amount, moraleDays: morale.durationDays }),
        },
        {
          objetivo: objective.title,
          recompensa: describeReward(objective),
          ...(cut ? { perda: describeCut(lost) } : {}),
        },
        cut ? cutRewardTemplates.objectiveCompleted : undefined,
      );
      changed = true;
    }
    for (const objective of objectives) {
      if (tracker.active.length >= balance.objectives.maxActive) {
        break;
      }
      if (!tracker.active.includes(objective.id) && !tracker.completed.includes(objective.id)) {
        tracker.active.push(objective.id);
        changed = true;
      }
    }
  }
  return tracker.completed.length > completedBefore;
}

/**
 * Os objetivos não estão acomodados: há um ativo já cumprido, ou lugar entre os ativos para um
 * que ainda não foi revelado. Depois de todo comando e de todo instante com eventos isto é
 * falso (`evaluateObjectives` roda ali). Só é verdadeiro em uma partida gravada antes de a lista
 * do conteúdo crescer: `advanceTo` a acomoda na fronteira, antes de o tempo andar.
 */
export function hasUnsettledObjectives(state: GameState): boolean {
  const { active, completed } = state.objectives;
  const known = (id: string) => active.includes(id) || completed.includes(id);
  if (
    active.length < balance.objectives.maxActive &&
    objectives.some((objective) => !known(objective.id))
  ) {
    return true;
  }
  return objectives.some((objective) => {
    if (!active.includes(objective.id)) {
      return false;
    }
    const { current, target } = objectiveProgress(state, objective.condition);
    return current >= target;
  });
}
