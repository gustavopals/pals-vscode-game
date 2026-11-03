import { applyCommand, type Command, type GameState } from '@lotg/engine';

/** Ponte da T2.10 até a T2.7 incorporar as ordens do cerco ao protocolo público. */
export type SimCommand = Command | Parameters<typeof applyCommand>[1];

/** Mantém os overloads do motor, sem duplicar o contrato das ordens internas do cerco. */
export function applySimCommand(state: GameState, command: SimCommand, nowMs: number) {
  switch (command.type) {
    case 'setBattlePlan':
    case 'swapWaveFormation':
    case 'emergencyRepair':
    case 'callMilitia':
      return applyCommand(state, command, nowMs);
    default:
      return applyCommand(state, command, nowMs);
  }
}
