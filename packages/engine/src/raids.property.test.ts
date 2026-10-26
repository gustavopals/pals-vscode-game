import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS } from './clock';
import { newGame } from './test-helpers';
import type { GameState } from './types';

/**
 * A divisão de intervalo com a incursão que vira batalha (V4E-T2.6): no mesmo instante, a virada
 * do dia, o fim do reparo da muralha, a incursão e a batalha (com o fluxo `battle:<id>` que nasce
 * e morre ali). Avançar de uma vez ou em pedaços quaisquer dá o mesmo estado, os mesmos eventos e
 * o mesmo gerador, com ou sem Defesa ativa.
 */

const WOLVES_AT = 15 * DAY_MS;
const START = WOLVES_AT - 2 * DAY_MS;
const END = WOLVES_AT + 4 * DAY_MS;

function feud(withArmy: boolean, repairing: boolean): GameState {
  const state = advanceTo(newGame(), START).state;
  state.settlement.buildings.palisade = 1;
  state.settlement.wall.hp = { left: 20, center: 60, right: 35 };
  if (repairing) {
    // O reparo termina no instante exato da virada e da incursão.
    state.settlement.wallRepair = { untilMs: WOLVES_AT, toHp: { left: 60, center: 60, right: 60 } };
  }
  if (withArmy) {
    state.army.units.spearman = 12;
    state.army.units.archer = 9;
    state.ids.formation = 1;
    state.army.formations = [
      {
        id: 'formation-1',
        name: 'Defesa',
        posts: {
          left: { front: { unit: 'spearman', count: 4 }, back: { unit: 'archer', count: 3 } },
          center: { front: { unit: 'spearman', count: 4 }, back: { unit: 'archer', count: 3 } },
          right: { front: { unit: 'spearman', count: 4 }, back: { unit: 'archer', count: 3 } },
        },
        commanders: { left: null, center: null, right: null },
      },
    ];
    state.army.activeFormationId = 'formation-1';
  }
  return state;
}

describe('divisão de intervalo com incursão, batalha, reparo e virada no mesmo instante', () => {
  it('o cenário tem mesmo a batalha e o reparo no instante da virada', () => {
    const { state, events } = advanceTo(feud(true, true), END);
    expect(state.settlement.wallRepair).toBeNull();
    const here = events.filter((event) => event.atMs === WOLVES_AT).map((event) => event.type);
    expect(here).toContain('dayStarted');
    expect(here).toContain('battleFought');
  });

  it('estado, eventos e gerador iguais em até cinco pedaços quaisquer', () => {
    const whole = new Map<string, ReturnType<typeof advanceTo>>();
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.uniqueArray(fc.integer({ min: START + 1, max: END - 1 }), { maxLength: 4 }),
        fc.boolean(),
        (withArmy, repairing, cuts, onTheInstant) => {
          const key = `${String(withArmy)}:${String(repairing)}`;
          const start = feud(withArmy, repairing);
          if (!whole.has(key)) {
            whole.set(key, advanceTo(start, END));
          }
          const direct = whole.get(key)!;
          const points = [...cuts, ...(onTheInstant ? [WOLVES_AT, WOLVES_AT - 1] : [])]
            .filter((point, index, all) => all.indexOf(point) === index)
            .sort((a, b) => a - b);
          let state = start;
          const events: ReturnType<typeof advanceTo>['events'] = [];
          for (const point of [...points, END]) {
            const step = advanceTo(state, point);
            state = step.state;
            events.push(...step.events);
          }
          expect(JSON.stringify(state)).toBe(JSON.stringify(direct.state));
          expect(events).toEqual(direct.events);
        },
      ),
      { numRuns: 60 },
    );
  });
});
