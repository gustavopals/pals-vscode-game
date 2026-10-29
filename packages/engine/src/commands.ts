import { balance } from '@lotg/content';

import { setBattlePlan, swapWaveFormation, emergencyRepair } from './siegeOrders';
import { settleHeroArrivals } from './arrivals';
import { emit } from './chronicle';
import {
  cancelConstruction,
  planConstruction,
  setAutoStart,
  startConstruction,
  unplanConstruction,
} from './construction';
import { sendCaravan } from './caravanOrders';
import { answerCard } from './council';
import { equipItem, unequipItem } from './equipment';
import { chooseExpeditionPath, sendExpedition } from './expeditionOrders';
import { trade } from './marketOrders';
import { assignMaster } from './masterOrders';
import { settlePlanned } from './planned';
import { repairItem } from './repairOrders';
import { cancelForge, forgeWeapons } from './smithyOrders';
import { attackCamp, cancelTraining, disbandSoldiers, trainSoldiers } from './armyOrders';
import { deleteFormation, saveFormation, setActiveFormation } from './formationOrders';
import { simulateBattle } from './warCouncilOrders';
import { repairWall } from './wallRepair';
import { recruitVillagers, setWorkers } from './population';
import { reject } from './rejections';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import { announceFilled, fullStores } from './storage';
import { hireHero, holdFestival } from './tavernOrders';
import type {
  Command,
  CommandResult,
  GameEvent,
  GameState,
  Rejection,
  SiegeCommand,
  SiegeCommandResult,
  SiegeRejection,
} from './types';
import { dismissHero } from './wages';
import { announceRaids, markRehearsalAfterVigilChange } from './raids';

/** Contexto resolvido pelo servidor e guardado com a ordem para replay. */
export type CommandContext = {
  vigil?: { utcOffsetMinutes: number; timezoneResolved: boolean };
};

function renameSettlement(
  draft: GameState,
  name: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { nameMinLength, nameMaxLength } = balance.settlement;
  const trimmed = typeof name === 'string' ? name.trim() : '';
  if (trimmed.length < nameMinLength || trimmed.length > nameMaxLength) {
    return reject('INVALID_NAME');
  }
  draft.settlement.name = trimmed;
  emit(events, draft, nowMs, 'settlementRenamed', { name: trimmed });
  return null;
}

function dispatch(
  draft: GameState,
  command: Command | SiegeCommand,
  nowMs: number,
  events: GameEvent[],
  context: CommandContext,
): SiegeRejection | null {
  // O servidor valida a forma com zod; o motor ainda assim não confia no payload.
  const payload: Record<string, unknown> = { ...(command.payload as object | undefined) };
  switch (command.type) {
    case 'setBattlePlan':
      return setBattlePlan(draft, payload.wave, payload.formationId, nowMs, events);
    case 'swapWaveFormation':
      return swapWaveFormation(draft, payload.formationId, nowMs, events);
    case 'emergencyRepair':
      return emergencyRepair(draft, nowMs, events);
    case 'setVigilHour': {
      const { hourLocal, timezone } = payload;
      const civil = context.vigil;
      if (
        !Number.isSafeInteger(hourLocal) ||
        (hourLocal as number) < 0 ||
        (hourLocal as number) > 23 ||
        typeof timezone !== 'string' ||
        timezone.length === 0 ||
        timezone.length > 64 ||
        civil === undefined ||
        !civil.timezoneResolved ||
        !Number.isSafeInteger(civil.utcOffsetMinutes) ||
        Math.abs(civil.utcOffsetMinutes) > 840
      )
        return reject('INVALID_VIGIL');
      draft.settings.timezone = timezone;
      draft.settings.vigilHourLocal = hourLocal as number;
      draft.settings.vigil = { hourLocal: hourLocal as number, ...civil };
      markRehearsalAfterVigilChange(draft, nowMs);
      emit(events, draft, nowMs, 'vigilChanged', { hourLocal: hourLocal as number, timezone });
      announceRaids(draft, nowMs, events);
      return null;
    }
    case 'setWorkers':
      return setWorkers(draft, payload.building, payload.count, nowMs);
    case 'startConstruction':
      return startConstruction(draft, payload.building, nowMs, events);
    case 'cancelConstruction':
      return cancelConstruction(draft, payload.building, nowMs, events);
    case 'planConstruction':
      return planConstruction(draft, payload.building, payload.autoStart, payload.targetLevel);
    case 'unplanConstruction':
      return unplanConstruction(draft, payload.building);
    case 'setAutoStart':
      return setAutoStart(draft, payload.building, payload.autoStart, payload.targetLevel);
    case 'recruitVillagers':
      return recruitVillagers(draft, payload.quantity, nowMs, events);
    case 'renameSettlement':
      return renameSettlement(draft, payload.name, nowMs, events);
    case 'answerCard':
      return answerCard(draft, payload.instanceId, payload.optionId, nowMs, events);
    case 'dismissHero':
      return dismissHero(draft, payload.heroId, nowMs, events);
    case 'hireHero':
      return hireHero(draft, payload.offerId, nowMs, events);
    case 'holdFestival':
      return holdFestival(draft, nowMs, events);
    case 'sendExpedition':
      return sendExpedition(
        draft,
        payload.modelId,
        payload.heroIds,
        payload.posture,
        nowMs,
        events,
      );
    case 'chooseExpeditionPath':
      return chooseExpeditionPath(draft, payload.expeditionId, payload.optionId, nowMs, events);
    case 'equipItem':
      return equipItem(draft, payload.heroId, payload.itemId, nowMs, events);
    case 'unequipItem':
      return unequipItem(draft, payload.heroId, payload.slot, nowMs, events);
    case 'trade':
      return trade(
        draft,
        payload.resource,
        payload.direction,
        payload.amount,
        payload.quoteDay,
        nowMs,
        events,
      );
    case 'sendCaravan':
      return sendCaravan(
        draft,
        payload.resource,
        payload.amount,
        payload.escortHeroId,
        payload.quoteDay,
        nowMs,
        events,
      );
    case 'assignMaster':
      return assignMaster(draft, payload.masterId, payload.building, nowMs, events);
    case 'forgeWeapons':
      return forgeWeapons(draft, payload.amount, nowMs, events);
    case 'cancelForge':
      return cancelForge(draft, nowMs, events);
    case 'attackCamp':
      return attackCamp(draft, payload.formationId, nowMs, events);
    case 'trainSoldiers':
      return trainSoldiers(draft, payload.unit, payload.amount, nowMs, events);
    case 'cancelTraining':
      return cancelTraining(draft, payload.lotKey, nowMs, events);
    case 'disbandSoldiers':
      return disbandSoldiers(draft, payload.unit, payload.amount, nowMs, events);
    case 'saveFormation':
      return saveFormation(
        draft,
        payload.id,
        payload.name,
        payload.posts,
        payload.commanders,
        nowMs,
        events,
      );
    case 'deleteFormation':
      return deleteFormation(draft, payload.id, nowMs, events);
    case 'setActiveFormation':
      return setActiveFormation(draft, payload.id, nowMs, events);
    case 'simulateBattle':
      return simulateBattle(draft, payload.formationId, nowMs, events);
    case 'repairWall':
      return repairWall(draft, nowMs, events);
    case 'repairItem':
      return repairItem(draft, payload.itemId, nowMs, events);
    default:
      return reject('UNKNOWN_COMMAND');
  }
}

/**
 * Única porta de entrada para mudar o estado além de `advanceTo`.
 *
 * O chamador avança o estado até `nowMs` antes de aplicar; violar isso é erro de programação.
 * Uma recusa de regra nunca lança exceção nem altera o estado recebido: o chamador continua
 * com o resultado de `advanceTo` e pode persisti-lo mesmo quando a ação é recusada.
 */
export function applyCommand(
  state: GameState,
  command: Command,
  nowMs: number,
  context?: CommandContext,
): CommandResult;
export function applyCommand(
  state: GameState,
  command: SiegeCommand,
  nowMs: number,
  context?: CommandContext,
): SiegeCommandResult;
export function applyCommand(
  state: GameState,
  command: Command | SiegeCommand,
  nowMs: number,
  context: CommandContext = {},
): SiegeCommandResult {
  if (state.lastProcessedAt !== nowMs) {
    throw new Error(
      `applyCommand exige o estado avançado até ${nowMs}, mas ele está em ${state.lastProcessedAt}.`,
    );
  }
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const wasFull = fullStores(draft);
  const rejection = dispatch(draft, command, nowMs, events, context);
  if (rejection !== null) {
    return { ok: false, ...rejection };
  }
  // O herói que a resposta a uma carta acabou de dar entra agora, e o que esperava lugar na
  // lista entra no lugar de quem foi dispensado.
  settleHeroArrivals(draft, nowMs, events);
  // Toda ordem pode liberar uma planejada automática (um cancelamento devolve recurso e fila,
  // uma recompensa paga um custo): a lista é conferida aqui, junto com os objetivos.
  settlePlanned(draft, nowMs, events);
  settleScarcity(draft, nowMs, events);
  // Uma recompensa ou uma devolução pode encher um depósito: a linha sai uma vez por episódio.
  announceFilled(draft, nowMs, events, wasFull);
  return { ok: true, state: draft, events };
}
