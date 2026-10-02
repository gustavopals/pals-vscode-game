import { balance } from '@lotg/content';

import { emit } from './chronicle';
import {
  cancelConstruction,
  planConstruction,
  setAutoStart,
  startConstruction,
  unplanConstruction,
} from './construction';
import { answerCard } from './council';
import { settlePlanned } from './planned';
import { recruitVillagers, setWorkers } from './population';
import { reject } from './rejections';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import { announceFilled, fullStores } from './storage';
import type { Command, CommandResult, GameEvent, GameState, Rejection } from './types';

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
  command: Command,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  // O servidor valida a forma com zod; o motor ainda assim não confia no payload.
  const payload: Record<string, unknown> = { ...(command.payload as object | undefined) };
  switch (command.type) {
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
export function applyCommand(state: GameState, command: Command, nowMs: number): CommandResult {
  if (state.lastProcessedAt !== nowMs) {
    throw new Error(
      `applyCommand exige o estado avançado até ${nowMs}, mas ele está em ${state.lastProcessedAt}.`,
    );
  }
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const wasFull = fullStores(draft);
  const rejection = dispatch(draft, command, nowMs, events);
  if (rejection !== null) {
    return { ok: false, code: rejection.code, message: rejection.message };
  }
  // Toda ordem pode liberar uma planejada automática (um cancelamento devolve recurso e fila,
  // uma recompensa paga um custo): a lista é conferida aqui, junto com os objetivos.
  settlePlanned(draft, nowMs, events);
  settleScarcity(draft, nowMs, events);
  // Uma recompensa ou uma devolução pode encher um depósito: a linha sai uma vez por episódio.
  announceFilled(draft, nowMs, events, wasFull);
  return { ok: true, state: draft, events };
}
