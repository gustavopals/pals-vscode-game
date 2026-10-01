import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { cloneState, createInitialState } from './state';
import type { Command, CommandResult, GameEvent, GameSettings, GameState } from './types';

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const DAY = 2 * HOUR;

export const settings: GameSettings = {
  settlementName: 'Pedra Alta',
  timezone: 'America/Sao_Paulo',
  vigilHourLocal: 20,
  capsEnabled: false,
};

export function newGame(seed = 'pedra-alta'): GameState {
  return createInitialState(seed, settings);
}

/** Estado inicial com ajustes diretos, para montar cenários que os comandos não alcançam rápido. */
export function gameWith(edit: (draft: GameState) => void): GameState {
  const draft = cloneState(newGame());
  edit(draft);
  return draft;
}

let nextCommandId = 0;

export function command<T extends Command['type']>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
): Command {
  nextCommandId += 1;
  return { commandId: `test-${nextCommandId}`, type, payload } as Command;
}

/** Aplica um comando no instante atual do estado. */
export function apply(state: GameState, cmd: Command): CommandResult {
  return applyCommand(state, cmd, state.lastProcessedAt);
}

/** Aplica um comando que precisa ser aceito e devolve o novo estado e os eventos. */
export function accept(state: GameState, cmd: Command): { state: GameState; events: GameEvent[] } {
  const result = apply(state, cmd);
  if (!result.ok) {
    throw new Error(`Comando recusado no teste: ${result.code} (${result.message})`);
  }
  return { state: result.state, events: result.events };
}

/** Aplica um comando que precisa ser recusado e devolve a recusa. */
export function refuse(state: GameState, cmd: Command): { code: string; message: string } {
  const result = apply(state, cmd);
  if (result.ok) {
    throw new Error(`Comando aceito no teste, mas a recusa era esperada: ${cmd.type}`);
  }
  return { code: result.code, message: result.message };
}

/** Executa um roteiro de passos (avançar ou comandar) e junta todos os eventos. */
export function play(
  start: GameState,
  steps: Array<{ at: number } | Command>,
): { state: GameState; events: GameEvent[] } {
  let state = start;
  const events: GameEvent[] = [];
  for (const step of steps) {
    const result = 'at' in step ? advanceTo(state, step.at) : accept(state, step);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** Roteiro que cumpre os quatro objetivos da v0.1, na ordem. */
export function objectivesScenario() {
  return play(newGame('pedra-alta'), [
    command('setWorkers', { building: 'farm', count: 2 }),
    command('startConstruction', { building: 'housing' }),
    command('recruitVillagers', { quantity: 3 }),
    { at: HOUR },
    command('setWorkers', { building: 'lumberMill', count: 3 }),
    command('setWorkers', { building: 'quarry', count: 3 }),
    { at: 6 * HOUR },
    command('startConstruction', { building: 'townHall' }),
    { at: 6 * HOUR + 10 * MINUTE },
  ]);
}

export function eventsOfType(events: GameEvent[], type: GameEvent['type']): GameEvent[] {
  return events.filter((event) => event.type === type);
}
