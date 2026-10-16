import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { cloneState } from './state';
import { storageCapacity } from './storage';
import { addHero, DAY, guildOpened, HOUR, send, SUMMER } from './test-helpers';
import type { GameEvent, GameState } from './types';

/**
 * O ferro e a divisão de intervalo (V4B-T1.7): uma equipe a caminho da Mina Abandonada, com o
 * Armazém quase cheio de ferro, no ritmo pedido. O ferro do veio chega no fim do nó, e o que
 * não cabe vai ao chão (`storageWasted`); o Mercado de pé anda o preço do ferro a cada virada.
 * Cortar o tempo em qualquer instante dá o mesmo estado, os mesmos eventos e o mesmo gerador.
 */
function mineRun(timeScale: number, ironLeft: number, withMarket: boolean): GameState {
  const { state } = guildOpened(
    SUMMER + 3 * DAY + HOUR,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', level: 8, traits: ['brave'] });
      addHero(draft, { name: 'Rolf', classId: 'archer', level: 8, traits: ['prudent'] });
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
    },
    { seed: 'ferro-na-mina', timeScale },
  );
  const start = cloneState(state);
  start.settlement.buildings.guild = 2;
  start.settlement.buildings.warehouse = 1;
  if (withMarket) {
    start.settlement.buildings.market = 1;
  }
  start.map.discovered.push('abandonedMine');
  const cap = storageCapacity(start, 'iron') ?? 0;
  start.settlement.resources.iron = Math.max(0, cap - ironLeft * 1000);
  return send(start, 'abandonedMine', ['hero-1', 'hero-2'], 'bold').state;
}

const run = (state: GameState, ...stops: number[]): { state: GameState; events: GameEvent[] } => {
  let current = state;
  const events: GameEvent[] = [];
  for (const at of stops) {
    const step = advanceTo(current, at);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
};

describe('o ferro na divisão de intervalo (V4B-T1.7)', () => {
  it('a Mina entrega ferro, o que não cabe vai ao chão, e cortar o tempo em qualquer instante não muda nada', () => {
    let overflowed = 0;
    fc.assert(
      fc.property(
        fc.constantFrom(3, 1, 0.5),
        fc.integer({ min: 0, max: 60 }),
        fc.boolean(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (timeScale, ironLeft, withMarket, share) => {
          const start = mineRun(timeScale, ironLeft, withMarket);
          const end = start.lastProcessedAt + 72 * HOUR;
          const cut = start.lastProcessedAt + Math.floor((end - start.lastProcessedAt) * share);
          const whole = run(start, end);
          const split = run(start, cut, end);
          expect(split.state).toStrictEqual(whole.state);
          expect(split.events).toStrictEqual(whole.events);
          if (whole.state.stats.wasted_iron !== undefined) {
            overflowed += 1;
          }
        },
      ),
      { numRuns: 40 },
    );
    // Em parte das partidas o veio dá mais ferro do que cabe: a propriedade passou pelo corte.
    expect(overflowed).toBeGreaterThan(0);
  });
});
