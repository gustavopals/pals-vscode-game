import { balance } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { availableUnits } from './campaign';
import { YEAR_MS } from './clock';
import { currentShape } from './migrations';
import { accept, apply, AUTUMN, campaignYard, command, DAY, HOUR, SUMMER } from './test-helpers';
import type { GameEvent, GameState } from './types';

function divided(state: GameState, stops: number[]): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (const at of stops) {
    const step = advanceTo(current, at);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
}

describe('a campanha nas propriedades (V4F-T2)', () => {
  it('a divisão de intervalo conserva estado, eventos e gerador com incursão, baixa e virada de estação/ano', () => {
    const travel = balance.army.campaign.travelMs;
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.integer({ min: 1, max: 9999 }),
        fc.constantFrom(0.5, 1, 3),
        fc.constantFrom(0, SUMMER - HOUR, AUTUMN - HOUR, YEAR_MS - HOUR),
        fc.integer({ min: 0, max: travel * 2 }),
        fc.integer({ min: 0, max: travel * 2 }),
        (strong, seed, timeScale, begins, first, second) => {
          const yard = campaignYard(begins, strong, `campanha-propriedade-${seed}`);
          yard.settings.timeScale = timeScale;
          yard.settlement.resources.food = seed * 10;
          const state = accept(yard, command('attackCamp', { formationId: 'formation-1' })).state;
          state.horde.scheduledRaids = [
            {
              id: 'raid-campaign-property',
              kind: 'threat',
              atMs: begins + HOUR,
              enemy: 'raiders',
              size: 'light',
              announcedAtMs: null,
              composition: [{ wing: 'center', line: 'front', unit: 'raider', count: 3 }],
            },
          ];
          const end = begins + travel * 2 + DAY;
          const one = advanceTo(state, end);
          const cuts = [
            ...new Set([
              begins + first,
              begins + second,
              begins + travel,
              begins + travel * 2,
              end,
            ]),
          ].sort((a, b) => a - b);
          expect(divided(state, cuts)).toEqual(one);
          for (const at of cuts) {
            const point = advanceTo(state, at).state;
            expect(currentShape(point, '')).toBeNull();
            expect(
              Object.values(availableUnits(point)).every(
                (count) => Number.isInteger(count) && count >= 0,
              ),
            ).toBe(true);
          }
          expect(one.state.army.campaign).toBeNull();
          expect(one.events.filter((event) => event.type === 'campAssaulted')).toHaveLength(1);
          expect(one.events.filter((event) => event.type === 'armyReturned')).toHaveLength(1);
          expect(Object.keys(one.state.rng).some((key) => key.startsWith('battle:'))).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('dispensar só alcança a reserva do feudo, mesmo com ordens repetidas durante a viagem', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 15 }),
        fc.integer({ min: 1, max: 20 }),
        (extra, amount) => {
          const yard = campaignYard();
          yard.army.units.swordsman += extra;
          const state = accept(yard, command('attackCamp', { formationId: 'formation-1' })).state;
          const result = apply(state, command('disbandSoldiers', { unit: 'swordsman', amount }));
          if (amount > extra)
            expect(result).toMatchObject({ ok: false, code: 'NOT_ENOUGH_SOLDIERS' });
          else {
            expect(result.ok).toBe(true);
            if (result.ok) {
              expect(availableUnits(result.state).swordsman).toBe(extra - amount);
              expect(currentShape(result.state, '')).toBeNull();
            }
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
