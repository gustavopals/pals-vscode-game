import { siegeTexts } from '@lotg/content';

import { waveDecisionOpen } from './siege';
import { seasonAt } from './clock';
import { checkMilitiaCall } from './siegeOrders';
import { realSecondsCeil } from './units';
import type { GameState, SiegeView, SiegeWaveDecisionView, SiegeWaveNumber } from './types';
import { wavePublicOmens } from './warCouncilOrders';

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
  const militia = checkMilitiaCall(state, undefined, state.lastProcessedAt);
  const aftermathSeconds = entry.aftermathUntilMs === null ? 0 : until(entry.aftermathUntilMs);
  const repairDiscount = aftermathSeconds > 0 && seasonAt(state.lastProcessedAt).id === 'winter';
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
        omens: wavePublicOmens(state, w.number).map((o) => o.text),
      })),
      militiaOffer: {
        targetId: militia.untilMs === null ? null : `battle-at-${militia.untilMs}`,
        termsText: siegeTexts.militiaTerms,
        activeCount: state.settlement.militia?.count ?? 0,
        maxCount: militia.maxCount,
        canCall: militia.rejection === null,
        blockedReason: militia.rejection?.message ?? null,
        untilInSeconds: militia.untilMs === null ? null : until(militia.untilMs),
        warningSeconds: realSecondsCeil(militia.warningMs, timeScale),
      },
      aftermath:
        entry.result === null
          ? null
          : {
              summary: siegeTexts.aftermath.summary
                .replace('{ondas}', String(entry.current))
                .replace('{mortos}', String(entry.deaths)),
              endsInSeconds: aftermathSeconds,
              repairText: repairDiscount ? siegeTexts.aftermath.repair : null,
              repairEndsInSeconds: repairDiscount ? aftermathSeconds : null,
              reconstructionText:
                state.settlement.reconstructionUntilMs === null ? null : siegeTexts.reconstruction,
              reconstructionEndsInSeconds:
                state.settlement.reconstructionUntilMs === null
                  ? null
                  : until(state.settlement.reconstructionUntilMs),
            },
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
