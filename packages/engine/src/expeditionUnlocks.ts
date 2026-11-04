import { DAY_MS } from './clock';
import type { GameState } from './types';

/** A janela da carta conta da escolha; não sorteia e não toca em equipes já na estrada. */
export function unlockExpedition(
  draft: GameState,
  modelId: string,
  forDays: number,
  atMs: number,
): void {
  if (!draft.map.discovered.includes(modelId)) draft.map.discovered.push(modelId);
  draft.map.expeditionUnlocks[modelId] = atMs + forDays * DAY_MS;
}

/** Some da lista no prazo exato. A jornada que partiu antes dele termina normalmente. */
export function expireExpeditionUnlocks(draft: GameState, atMs: number): void {
  for (const [modelId, untilMs] of Object.entries(draft.map.expeditionUnlocks)) {
    if (untilMs > atMs) continue;
    draft.map.discovered = draft.map.discovered.filter((id) => id !== modelId);
    delete draft.map.expeditionUnlocks[modelId];
  }
}

export function nextExpeditionUnlockAt(state: GameState): number | null {
  const instants = Object.values(state.map.expeditionUnlocks).filter(
    (untilMs) => untilMs > state.lastProcessedAt,
  );
  return instants.length === 0 ? null : Math.min(...instants);
}
