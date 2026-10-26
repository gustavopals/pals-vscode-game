import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS } from './clock';
import { newGame } from './test-helpers';
import type { GameEvent, GameState } from './types';

/**
 * A incursão vira batalha (V4E-T2.3; GDD §8.2; ADR 0019, decisão 14): a defesa é a Defesa
 * ativa, a muralha e as torres, e a perda da v0.2 é cobrada na proporção do que passou, nunca
 * maior que a que a Paliçada deixava passar.
 */

/** Os lobos do roteiro do ano 1: o início do 16º dia de jogo. */
const WOLVES_AT = 15 * DAY_MS;

function beforeWolves(seed = 'pedra-alta'): GameState {
  return advanceTo(newGame(seed), WOLVES_AT - 1).state;
}

function at(events: readonly GameEvent[], atMs: number): GameEvent[] {
  return events.filter((event) => event.atMs === atMs);
}

describe('os lobos do dia 16 como batalha', () => {
  it('sem soldados e sem Paliçada, o desfecho é o da v0.2: a perda inteira do tamanho leve', () => {
    for (const seed of ['pedra-alta', 'pedra-alta-001', 'pedra-alta-golden']) {
      const before = beforeWolves(seed);
      expect(before.horde.scheduledRaids[0]).toMatchObject({
        id: 'wolvesYear1',
        composition: null,
      });
      expect(before.settlement.buildings.palisade).toBe(0);
      const damage = balance.raids.damage.wolves.light;
      const expected: Record<string, number> = {};
      for (const resource of damage.resources) {
        const taken = Math.floor(
          (before.settlement.resources[resource] * damage.lossRatio.num) / damage.lossRatio.den,
        );
        if (taken > 0) {
          expected[`raided_${resource}`] = taken / 1000;
        }
      }
      const { state, events } = advanceTo(before, WOLVES_AT);
      const here = at(events, WOLVES_AT);
      const suffered = here.find((event) => event.type === 'raidSuffered');
      expect(suffered?.data, seed).toMatchObject({ ...expected, injured: damage.injuries });
      // A batalha aconteceu, sem ninguém na defesa, e o relatório guarda que não houve formação.
      expect(here.some((event) => event.type === 'battleFought')).toBe(true);
      expect(state.army.reports).toHaveLength(1);
      expect(state.army.reports[0]).toMatchObject({ formationId: null, outcome: 'defeat' });
      // O fluxo da batalha nasceu e morreu no instante.
      expect(Object.keys(state.rng).some((key) => key.startsWith('battle:'))).toBe(false);
    }
  });

  it('com a Paliçada Nv1 os lobos leves continuam repelidos, como na v0.2', () => {
    const before = beforeWolves();
    before.settlement.buildings.palisade = 1;
    before.settlement.wall.hp = { left: 60, center: 60, right: 60 };
    const { state, events } = advanceTo(before, WOLVES_AT);
    expect(at(events, WOLVES_AT).some((event) => event.type === 'raidRepelled')).toBe(true);
    expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
    expect(state.settlement.injured).toHaveLength(before.settlement.injured.length);
  });

  it('uma Defesa ativa que vence repele os lobos sem perda, e o relatório guarda a formação', () => {
    const before = beforeWolves();
    before.army.units.spearman = 30;
    before.army.units.archer = 30;
    before.ids.formation = 1;
    before.army.formations = [
      {
        id: 'formation-1',
        name: 'Muro de lanças',
        posts: {
          left: { front: { unit: 'spearman', count: 10 }, back: { unit: 'archer', count: 10 } },
          center: { front: { unit: 'spearman', count: 10 }, back: { unit: 'archer', count: 10 } },
          right: { front: { unit: 'spearman', count: 10 }, back: { unit: 'archer', count: 10 } },
        },
        commanders: { left: null, center: null, right: null },
      },
    ];
    before.army.activeFormationId = 'formation-1';
    const { state, events } = advanceTo(before, WOLVES_AT);
    const here = at(events, WOLVES_AT);
    expect(state.army.reports[0]?.formationId).toBe('formation-1');
    expect(['victory', 'held']).toContain(state.army.reports[0]?.outcome);
    expect(here.some((event) => event.type === 'raidRepelled')).toBe(true);
    expect(here.some((event) => event.type === 'raidSuffered')).toBe(false);
    // As baixas saem do exército.
    const lost = (state.army.reports[0]?.casualties ?? [])
      .filter((entry) => entry.owner === 'player')
      .reduce((sum, entry) => sum + entry.lost, 0);
    expect(state.army.units.spearman + state.army.units.archer).toBe(60 - lost);
  });

  it('avançar de uma vez ou aos pedaços dá a mesma batalha', () => {
    const before = beforeWolves();
    const whole = advanceTo(before, WOLVES_AT + DAY_MS);
    const first = advanceTo(before, WOLVES_AT);
    const second = advanceTo(first.state, WOLVES_AT + DAY_MS);
    expect(second.state).toEqual(whole.state);
    expect([...first.events, ...second.events]).toEqual(whole.events);
  });
});
