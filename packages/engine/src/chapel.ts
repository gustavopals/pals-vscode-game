import { balance } from '@lotg/content';
import type { GameState } from './types';

/** Congelado no instante do ferimento: erguer a Capela não reconta curas em curso. */
export function healingDurationMs(state: GameState, durationMs: number): number {
  const { num, den } = balance.chapel.healingDuration;
  return state.settlement.buildings.chapel > 0 ? Math.ceil((durationMs * num) / den) : durationMs;
}
