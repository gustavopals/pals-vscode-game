import { balance } from '@lotg/content';

import { emit } from './chronicle';
import {
  cancelConstruction,
  planConstruction,
  startConstruction,
  unplanConstruction,
} from './construction';
import { settleFamine } from './famine';
import { evaluateObjectives } from './objectives';
import { recruitVillagers, setWorkers } from './population';
import { reject } from './rejections';
import { cloneState } from './state';
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
      return setWorkers(draft, payload.building, payload.count);
    case 'startConstruction':
      return startConstruction(draft, payload.building, nowMs, events);
    case 'cancelConstruction':
      return cancelConstruction(draft, payload.building, nowMs, events);
    case 'planConstruction':
      return planConstruction(draft, payload.building);
    case 'unplanConstruction':
      return unplanConstruction(draft, payload.building);
    case 'recruitVillagers':
      return recruitVillagers(draft, payload.quantity, nowMs, events);
    case 'renameSettlement':
      return renameSettlement(draft, payload.name, nowMs, events);
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
  const rejection = dispatch(draft, command, nowMs, events);
  if (rejection !== null) {
    return { ok: false, code: rejection.code, message: rejection.message };
  }
  evaluateObjectives(draft, nowMs, events);
  settleFamine(draft, nowMs, events);
  return { ok: true, state: draft, events };
}
