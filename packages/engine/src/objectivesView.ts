import {
  balance,
  buildings,
  type ObjectiveCondition,
  type ObjectiveDef,
  objectives,
} from '@lotg/content';

import { seasonAt, seasonWithArticle } from './clock';
import { constructionOf, ofBuilding, upgradeQuote } from './construction';
import { sentenceCase } from './format';
import { describeReward, objectiveProgress } from './objectives';
import { freeVillagers, recruitmentBlock } from './population';
import { seasonWatch } from './seasonWatch';
import type { BuildingId, GameState, ObjectiveTarget, ObjectiveView } from './types';

/**
 * Os Objetivos do Senhor na visão (GDD §12.2): o tutorial vivo. Cada um sai com a ação (o
 * título), o porquê, a recompensa, o progresso, **o que falta agora** e onde ele se cumpre. A
 * interface não conhece nenhum objetivo pelo id: mostra o que vem aqui.
 */

/** "na Fazenda", "nas Habitações". */
function inBuilding(building: BuildingId): string {
  const { article, label } = buildings[building];
  return `n${article} ${label}`;
}

/**
 * O que falta para um edifício chegar a `level`. Com a obra que o leva até lá já em curso, é só
 * esperar; sem ela, é o motivo pelo qual a obra não pode começar agora, o mesmo que a recusa da
 * ordem diria. `null` quando ela pode começar: falta só mandar.
 */
function buildingMissing(state: GameState, building: BuildingId, level: number): string | null {
  const underway = constructionOf(state, building);
  if (underway !== null && underway.targetLevel >= level) {
    return `A obra ${ofBuilding(building)} já começou: o objetivo se cumpre quando ela terminar.`;
  }
  return upgradeQuote(state, building).blocked?.message ?? null;
}

/** Dos edifícios que servem, o que está mais perto: em obras, depois o que já pode começar. */
function nearestBuilding(
  state: GameState,
  candidates: readonly BuildingId[],
  level: number,
): BuildingId {
  const [first] = candidates;
  if (first === undefined) {
    throw new Error('Objetivo de edifício sem edifício nenhum.');
  }
  return (
    candidates.find((id) => (constructionOf(state, id)?.targetLevel ?? 0) >= level) ??
    candidates.find((id) => upgradeQuote(state, id).blocked === null) ??
    first
  );
}

/**
 * O que falta agora para cumprir a condição, em uma frase pronta, com o motivo e, quando há, o
 * que fazer. `null` quando só falta uma ordem que o jogador já pode dar. Nenhum prazo entra na
 * frase: os prazos andam sozinhos na tela, nos campos de cada mecânica.
 */
function missingText(state: GameState, condition: ObjectiveCondition): string | null {
  const { settlement } = state;
  const { current, target } = objectiveProgress(state, condition);
  const short = target - current;
  switch (condition.type) {
    case 'workersAtLeast': {
      const lead = `${short === 1 ? 'Falta 1 aldeão' : `Faltam ${short} aldeões`} ${inBuilding(condition.building)}.`;
      return freeVillagers(state) >= short
        ? lead
        : `${lead} Não há aldeão livre que baste: tire de outro ofício ou recrute.`;
    }
    case 'constructionStarted':
      return upgradeQuote(state, condition.building).blocked?.message ?? null;
    case 'villagersRecruited': {
      const coming = settlement.recruitmentQueue.length;
      if (coming >= short) {
        return short === 1
          ? 'O aldeão que falta já está a caminho.'
          : `Os ${short} aldeões que faltam já estão a caminho.`;
      }
      const toCall = short - coming;
      const lead = `Falta recrutar ${toCall === 1 ? '1 aldeão' : `${toCall} aldeões`}.`;
      const blocked = recruitmentBlock(state, 1);
      return blocked === null ? lead : `${lead} ${blocked.message}`;
    }
    case 'buildingLevel':
      return buildingMissing(state, condition.building, condition.level);
    case 'anyBuildingLevel':
      return buildingMissing(
        state,
        nearestBuilding(state, condition.buildings, condition.level),
        condition.level,
      );
    case 'cardAnswered':
      return state.council.pending.length > 0
        ? null
        : 'Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer.';
    case 'plannedAutoStart':
      return null;
    case 'seasonSurvived': {
      const season = balance.calendar.seasons.find((entry) => entry.id === condition.season);
      if (season === undefined) {
        throw new Error(`Estação fora do calendário: ${condition.season}`);
      }
      if (seasonAt(state.lastProcessedAt).id !== season.id) {
        return `Falta ${seasonWithArticle(season)} chegar e passar sem frio.`;
      }
      // "o Inverno" e "a Primavera": o demonstrativo e o "próximo" concordam com a estação.
      const feminine = season.article === 'a';
      const next = feminine ? 'vale a próxima, inteira' : 'vale o próximo, inteiro';
      switch (seasonWatch(state)) {
        case 'clean':
          return `Ninguém passou frio até aqui: falta ${seasonWithArticle(season)} terminar assim.`;
        case 'cold':
          return `O feudo já passou frio ${feminine ? 'nesta' : 'neste'} ${season.label}: ${next}.`;
        case 'unwatched':
          return `${sentenceCase(seasonWithArticle(season))} já corria quando este objetivo chegou: ${next}.`;
      }
    }
  }
}

/** Onde o objetivo se cumpre: é para lá que a interface leva quem quer cumpri-lo. */
function targetOf(state: GameState, condition: ObjectiveCondition): ObjectiveTarget {
  switch (condition.type) {
    case 'workersAtLeast':
      return { kind: 'workers', building: condition.building };
    case 'constructionStarted':
    case 'buildingLevel':
      return { kind: 'building', building: condition.building };
    case 'anyBuildingLevel':
      return {
        kind: 'building',
        building: nearestBuilding(state, condition.buildings, condition.level),
      };
    case 'villagersRecruited':
      return { kind: 'recruitment' };
    case 'cardAnswered':
      return { kind: 'council' };
    case 'plannedAutoStart':
      return { kind: 'planned' };
    case 'seasonSurvived':
      return { kind: 'season', season: condition.season };
  }
}

function objectiveView(
  state: GameState,
  objective: ObjectiveDef,
  timeScale: number,
): ObjectiveView {
  const { current, target } = objectiveProgress(state, objective.condition);
  const done = state.objectives.completed.includes(objective.id);
  return {
    id: objective.id,
    title: objective.title,
    hint: objective.hint,
    reward: describeReward(objective, timeScale),
    status: done ? 'completed' : 'active',
    progress: { current: done ? target : Math.min(current, target), target },
    missing: done ? null : missingText(state, objective.condition),
    target: targetOf(state, objective.condition),
  };
}

/**
 * Os objetivos concluídos e os ativos (nunca mais de `balance.objectives.maxActive`), na ordem
 * da sequência. Os que ainda não foram revelados não saem: concluir um revela o próximo.
 */
export function objectivesView(state: GameState, timeScale: number): ObjectiveView[] {
  const { active, completed } = state.objectives;
  return objectives
    .filter((objective) => active.includes(objective.id) || completed.includes(objective.id))
    .map((objective) => objectiveView(state, objective, timeScale));
}
