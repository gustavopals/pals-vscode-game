import { siegeTexts } from '@lotg/content';

import { waveDecisionOpen } from './siege';
import { realSecondsCeil } from './units';
import type { GameState, SiegeView, SiegeWaveDecisionView, SiegeWaveNumber } from './types';

/** Só fatos públicos: data, plano e os presságios da versão atual; nenhuma composição crua. */
export function siegeView(
  state: GameState,
  timeScale = state.settings.timeScale,
): { siege: SiegeView | null; pendingDecisions: SiegeWaveDecisionView[] } {
  const entry = state.siege;
  if (entry === null) return { siege: null, pendingDecisions: [] };
  const until = (atMs: number) =>
    Math.max(0, realSecondsCeil(atMs - state.lastProcessedAt, timeScale));
  const next = (entry.current + 1) as SiegeWaveNumber;
  return {
    siege: {
      year: entry.year,
      scheduledInSeconds: until(entry.atMs),
      current: entry.current,
      nextWaveInSeconds: entry.nextWaveAtMs === null ? null : until(entry.nextWaveAtMs),
      plan: { ...entry.plan },
      result: entry.result,
      resultText: entry.result === null ? null : siegeTexts.result[entry.result],
      waves: entry.waves.map((w) => ({
        number: w.number,
        title: siegeTexts.waves[w.number],
        omens: state.horde.omens
          // O presságio vago não revela a onda a que pertence, nem pelo agrupamento.
          .filter(
            (o) =>
              o.clarity !== 'vague' &&
              o.wave === w.number &&
              o.revision === state.horde.wavePlan?.revision,
          )
          .map((o) => o.text),
      })),
    },
    pendingDecisions: !waveDecisionOpen(state)
      ? []
      : (() => {
          const nextPlanned = entry.plan[next];
          const selectedId =
            nextPlanned !== null && state.army.formations.some((f) => f.id === nextPlanned)
              ? nextPlanned
              : null;
          return [
            {
              kind: 'siegeWave' as const,
              id: `siege-${entry.year}-${next}`,
              title: siegeTexts.decision,
              wave: next,
              expiresInSeconds: until(entry.nextWaveAtMs!),
              options: [
                {
                  formationId: null,
                  label: siegeTexts.defaultFormation,
                  selected: selectedId === null,
                },
                ...state.army.formations.map((f) => ({
                  formationId: f.id,
                  label: f.name,
                  selected: selectedId === f.id,
                })),
              ],
            },
          ];
        })(),
  };
}
