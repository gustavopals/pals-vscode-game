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
