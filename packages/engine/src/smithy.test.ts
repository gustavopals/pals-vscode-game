import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { cloneState } from './state';
import { accept, apply, command, HOUR, MINUTE, smithyStall } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const MILLI = 1000;

const refused = (state: GameState, ...args: Parameters<typeof command>) => {
  const result = apply(state, command(...args));
  if (result.ok) {
    throw new Error('A ordem devia ser recusada.');
  }
  return result;
};

describe('Ferreiro e forja (V4B-T2; ADR 0019, decisão 4)', () => {
  it('cobra o ferro e a madeira ao começar, fixa o fim e emite forgeStarted', () => {
    const start = smithyStall(0);
    const { state, events } = accept(start, command('forgeWeapons', { amount: 3 }));
    expect(state.settlement.resources.iron).toBe(start.settlement.resources.iron - 6 * MILLI);
    expect(state.settlement.resources.wood).toBe(start.settlement.resources.wood - 3 * MILLI);
    // 3 armas × 6 min, no nível 1.
    expect(state.settlement.forge).toEqual({ amount: 3, startedAtMs: 0, endsAtMs: 18 * MINUTE });
    expect(events.map((event) => event.type)).toEqual(['forgeStarted']);
    expect(events[0]?.data).toMatchObject({ amount: 3, spent_iron: 6, spent_wood: 3 });
    expect(nextEventAt(state)).toBe(18 * MINUTE);
    // A ordem não altera o estado de entrada.
    expect(start.settlement.forge).toBeNull();
  });

  it('o fim do lote é um instante da linha do tempo: um milissegundo antes não há arma, no instante há', () => {
    const { state } = accept(smithyStall(0), command('forgeWeapons', { amount: 2 }));
    const end = 12 * MINUTE;
    const before = advanceTo(state, end - 1);
    expect(before.state.settlement.weapons).toBe(0);
    expect(before.state.settlement.forge).not.toBeNull();
    const at = advanceTo(before.state, end);
    expect(at.state.settlement.weapons).toBe(2);
    expect(at.state.settlement.forge).toBeNull();
    const forged = at.events.filter((event) => event.type === 'weaponsForged');
    expect(forged).toHaveLength(1);
    expect(forged[0]?.atMs).toBe(end);
    expect(forged[0]?.data).toMatchObject({ amount: 2, weapons: 2 });
    expect(forged[0]?.text).toContain('2 armas');
  });

  it('cada nível encurta o tempo: o lote leva tempo × 10 / (10 + nível − 1), com um só arredondamento', () => {
    const expected: Record<number, number> = {};
    for (let level = 1; level <= 6; level += 1) {
      const { state } = accept(
        smithyStall(0, () => {}, { level }),
        command('forgeWeapons', { amount: 7 }),
      );
      expected[level] = state.settlement.forge?.endsAtMs ?? -1;
    }
    expect(expected).toEqual({
      1: 7 * 6 * MINUTE,
      2: Math.floor((7 * 360_000 * 10) / 11),
      3: Math.floor((7 * 360_000 * 10) / 12),
      4: Math.floor((7 * 360_000 * 10) / 13),
      5: Math.floor((7 * 360_000 * 10) / 14),
      6: Math.floor((7 * 360_000 * 10) / 15),
    });
  });

  it('as armas não têm teto: entram mesmo com muitas', () => {
    let state = smithyStall(0, (draft) => {
      draft.settlement.weapons = 5_000;
    });
    state = accept(state, command('forgeWeapons', { amount: 1 })).state;
    state = advanceTo(state, 6 * MINUTE).state;
    expect(state.settlement.weapons).toBe(5_001);
  });

  it('recusa sem Ferreiro, lote fora de 1 a 10, lote em curso e material que falta', () => {
    const none = smithyStall(0, (draft) => {
      draft.settlement.buildings.smithy = 0;
    });
    expect(refused(none, 'forgeWeapons', { amount: 1 }).code).toBe('SMITHY_REQUIRED');
    const start = smithyStall(0);
    for (const amount of [0, -1, 11, 1.5, Number.NaN]) {
      expect(refused(start, 'forgeWeapons', { amount }).code, String(amount)).toBe(
        'INVALID_AMOUNT',
      );
    }
    const busy = accept(start, command('forgeWeapons', { amount: 1 })).state;
    expect(refused(busy, 'forgeWeapons', { amount: 1 }).code).toBe('FORGE_BUSY');
    const poor = smithyStall(0, (draft) => {
      draft.settlement.resources.iron = 19_999;
    });
    expect(refused(poor, 'forgeWeapons', { amount: 10 }).code).toBe('INSUFFICIENT_RESOURCES');
    expect(refused(start, 'cancelForge', {}).code).toBe('NOT_FORGING');
  });

  it('cancelar devolve 80% do ferro e da madeira, arredondando para baixo, e apaga o lote', () => {
    const start = smithyStall(0);
    const forging = accept(start, command('forgeWeapons', { amount: 5 })).state;
    const { state, events } = accept(forging, command('cancelForge', {}));
    // 10 de ferro e 5 de madeira pagos; 80% = 8 e 4.
    expect(state.settlement.resources.iron).toBe(start.settlement.resources.iron - 2 * MILLI);
    expect(state.settlement.resources.wood).toBe(start.settlement.resources.wood - 1 * MILLI);
    expect(state.settlement.forge).toBeNull();
    expect(events.map((event) => event.type)).toEqual(['forgeCancelled']);
    expect(nextEventAt(state)).not.toBe(30 * MINUTE);
    // Cancelado, não há arma no fim do prazo.
    expect(advanceTo(state, HOUR).state.settlement.weapons).toBe(0);
  });

  it('o lote não sorteia: o gerador fica como estava', () => {
    const start = smithyStall(0);
    const { state } = accept(start, command('forgeWeapons', { amount: 4 }));
    expect(state.rng).toStrictEqual(start.rng);
    expect(advanceTo(state, 24 * MINUTE).state.ids).toStrictEqual(start.ids);
  });

  it('a visão diz quanto falta, o que cada arma custa e o maior lote', () => {
    const start = smithyStall(0);
    const idle = deriveViewState(start, 0, { timeScale: 1 });
    expect(idle.smithy.built).toBe(true);
    expect(idle.smithy.forge).toBeNull();
    expect(idle.smithy.offer.maxAmount).toBe(10);
    expect(idle.smithy.offer.costText).toBe('2 de ferro e 1 de madeira por arma');
    expect(idle.smithy.perWeaponSeconds).toBe(360);
    const forging = accept(start, command('forgeWeapons', { amount: 2 })).state;
    const view = deriveViewState(advanceTo(forging, 5 * MINUTE).state, 5 * MINUTE, {
      timeScale: 1,
    });
    expect(view.smithy.forge).toEqual({ amount: 2, endsInSeconds: 420, totalSeconds: 720 });
    expect(view.smithy.offer.maxAmount).toBe(0);
  });
});

describe('a forja e a divisão de intervalo, e o ciclo ferro → arma', () => {
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

  it('cortar o tempo em qualquer instante dá o mesmo estado, os mesmos eventos e o mesmo gerador, com o lote terminando no meio e em qualquer ritmo', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(3, 1, 0.5),
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 6 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (timeScale, amount, level, share) => {
          const base = smithyStall(0, () => {}, { timeScale, level, seed: 'forja-divisao' });
          const start = accept(base, command('forgeWeapons', { amount })).state;
          const end = start.lastProcessedAt + 3 * HOUR;
          const cut = start.lastProcessedAt + Math.floor((end - start.lastProcessedAt) * share);
          const whole = run(start, end);
          const split = run(start, cut, end);
          expect(split.state).toStrictEqual(whole.state);
          expect(split.events).toStrictEqual(whole.events);
          expect(whole.state.settlement.weapons).toBe(amount);
        },
      ),
      { numRuns: 30 },
    );
  });

  it('não há caminho de volta: nenhuma ordem troca arma por ferro, madeira ou ouro, e forjar nunca dá lucro', () => {
    const start = smithyStall(0, (draft) => {
      draft.settlement.buildings.market = 3;
      draft.settlement.weapons = 7;
    });
    // A arma não se vende: nem no Mercado, nem em caravana.
    const sell = applyCommand(
      start,
      command('trade', {
        resource: 'weapons' as 'iron',
        direction: 'sell',
        amount: 1,
        quoteDay: start.market.quoteDay,
      }),
      0,
    );
    expect(sell.ok).toBe(false);
    const caravan = applyCommand(
      start,
      command('sendCaravan', {
        resource: 'weapons' as 'iron',
        amount: 1,
        escortHeroId: null,
        quoteDay: start.market.quoteDay,
      }),
      0,
    );
    expect(caravan.ok).toBe(false);
    // Um lote só tira material: ferro e madeira nunca sobem ao forjar nem ao cancelar.
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 10 }), fc.boolean(), (amount, cancel) => {
        const before = cloneState(start);
        let after = accept(start, command('forgeWeapons', { amount })).state;
        if (cancel) {
          after = accept(after, command('cancelForge', {})).state;
        } else {
          after = advanceTo(after, 3 * HOUR).state;
        }
        expect(after.settlement.resources.iron).toBeLessThanOrEqual(
          before.settlement.resources.iron,
        );
        expect(after.settlement.resources.wood).toBeLessThanOrEqual(
          before.settlement.resources.wood,
        );
        expect(after.settlement.resources.gold).toBeLessThanOrEqual(
          before.settlement.resources.gold,
        );
        if (cancel) {
          // O cancelamento devolve no máximo 80%: nunca o custo inteiro.
          expect(after.settlement.resources.iron).toBeLessThan(before.settlement.resources.iron);
        }
      }),
      { numRuns: 30 },
    );
  });
});
