import { balance } from '@lotg/content';
import { DAY_MS, YEAR_MS } from './clock';
import type { GameState, SiegeWave } from './types';

/** Cópia da preparação vigente: a batalha nunca gera outra composição. */
export function preparedSiegeWaves(state: GameState): SiegeWave[] {
  return (
    state.horde.wavePlan?.waves.map((wave) => ({
      ...wave,
      composition: wave.composition.map((post) => ({ ...post })),
    })) ?? []
  );
}

/** Mantém o retrato do cerco em acordo com as ondas que os presságios leem. Sem sorteio. */
export function syncSiegeWaves(draft: GameState): void {
  const siege = draft.siege;
  if (
    siege !== null &&
    siege.current === 0 &&
    siege.result === null &&
    siege.year === draft.horde.wavePlan?.year
  )
    siege.waves = preparedSiegeWaves(draft);
}

/** Início do inverno do ano indicado, derivado do calendário de conteúdo. */
export function winterStartsAt(year: number): number {
  let days = 0;
  for (const season of balance.calendar.seasons) {
    if (season.id === 'winter') break;
    days += season.days;
  }
  return (year - 1) * YEAR_MS + days * DAY_MS;
}

export function nextSiegeEventAt(state: GameState): number | null {
  return state.siege?.result === null ? state.siege.nextWaveAtMs : null;
}

export function waveDecisionOpen(state: GameState, nowMs = state.lastProcessedAt): boolean {
  const siege = state.siege;
  return (
    siege !== null &&
    siege.result === null &&
    siege.current > 0 &&
    siege.current < 3 &&
    siege.nextWaveAtMs !== null &&
    nowMs < siege.nextWaveAtMs
  );
}
