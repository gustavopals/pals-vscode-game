import {
  balance,
  cutRewardTemplates,
  items,
  MARKET_RESOURCE_IDS,
  type ObjectiveCondition,
  type ObjectiveDef,
  objectives,
  type ResourceAmounts,
} from '@lotg/content';

import { soldierCount } from './army';
import { emit } from './chronicle';
import { DAY_MS } from './clock';
import { amountsData } from './construction';
import { stowItem } from './equipment';
import { decimal, durationText, joinList, plural } from './format';
import { durabilityOf } from './heroes';
import { revealOmen } from './hordePlan';
import { nextId } from './ids';
import { addMoraleEffect } from './morale';
import { grantXp } from './outcomes';
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
    case 'heroCount':
      // Quem está em expedição, ferido ou em recuperação continua na lista do feudo.
      return { current: state.guild.heroes.length, target: condition.count };
    case 'expeditionSent':
      return { current: stats[`expeditionsSent:${condition.model}`] ?? 0, target: condition.count };
    case 'tradeDone': {
      // As unidades vendidas de todo recurso (`sold_<recurso>`, gravadas pela ordem de venda).
      const sold = MARKET_RESOURCE_IDS.reduce((sum, id) => sum + (stats[`sold_${id}`] ?? 0), 0);
      return { current: sold, target: condition.count };
    }
    case 'crossroadsChosen':
      // Só a escolha do jogador: a da Postura conta em `crossroadsByPosture`.
      return { current: stats.crossroadsChosen ?? 0, target: condition.count };
    case 'expeditionCompleted':
      return {
        current: stats[`expeditionsReturned:${condition.model}`] ?? 0,
        target: condition.count,
      };
    case 'soldiersTrained':
      return {
        current: Math.max(stats.soldiersTrained ?? 0, soldierCount(state)),
        target: condition.count,
      };
    case 'formationSaved':
      return { current: (state.ids.formation ?? 0) > 0 ? 1 : 0, target: 1 };
    case 'battleSimulated':
      return { current: stats.battlesSimulated ?? 0, target: condition.count };
    case 'raidRepelled':
      return { current: stats.raids_repelled ?? 0, target: condition.count };
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
  { reward, morale, rewardText, item, weapons, omen, commanderXp }: ObjectiveDef,
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
  if (item !== undefined) {
    parts.push(`um item (${items[item].label})`);
  }
  if (weapons !== undefined) parts.push(plural(weapons, 'arma', 'armas'));
  if (omen !== undefined)
    parts.push('um presságio gratuito (quando as ondas estiverem preparadas)');
  if (commanderXp !== undefined)
    parts.push(
      `+${commanderXp} XP aos comandantes sobreviventes da última incursão repelida registrada`,
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
      if (objective.weapons !== undefined) draft.settlement.weapons += objective.weapons;
      if (objective.omen !== undefined) draft.stats.objectiveOmenPending = 1;
      if (objective.commanderXp !== undefined) {
        const report = [...draft.army.reports]
          .reverse()
          .find((entry) =>
            draft.stats.lastRaidRepelledBattle === undefined
              ? entry.mode === 'defense' && entry.outcome !== 'defeat'
              : entry.id === `battle-${draft.stats.lastRaidRepelledBattle}`,
          );
        const ids = new Set(
          report?.commanders.filter((entry) => entry.fate !== 'died').map((entry) => entry.heroId),
        );
        const team = draft.guild.heroes.filter((hero) => ids.has(hero.id));
        grantXp(draft, team, objective.commanderXp, atMs, events);
      }
      emit(
        events,
        draft,
        atMs,
        'objectiveCompleted',
        {
          objective: objective.id,
          ...(objective.weapons === undefined ? {} : { weapons: objective.weapons }),
          ...(objective.commanderXp === undefined ? {} : { commanderXp: objective.commanderXp }),
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
      // O item vai ao arsenal; com ele cheio, vira ouro pelo valor do conteúdo, com a linha
      // própria da Crônica (`stowItem`). O identificador nasce aqui, num instante da linha do tempo.
      if (objective.item !== undefined) {
        stowItem(
          draft,
          {
            id: nextId(draft, 'item'),
            defId: objective.item,
            condition: durabilityOf({ defId: objective.item }),
          },
          atMs,
          events,
        );
      }
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
  // A recompensa usa a primeira onda real, sem gastar o fluxo `horde`. Antes da preparação,
  // o recibo fica no mapa de estatísticas já existente; é consumido uma única vez.
  const wave = draft.horde.wavePlan?.waves[0];
  if (draft.stats.objectiveOmenPending === 1 && wave !== undefined) {
    delete draft.stats.objectiveOmenPending;
    revealOmen(draft, wave, atMs, events);
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
  if (state.stats.objectiveOmenPending === 1 && state.horde.wavePlan !== null) return true;
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
