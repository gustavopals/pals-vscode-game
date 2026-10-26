import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS } from './clock';
import { newGame } from './test-helpers';
import { deriveViewState } from './view';
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

describe('a névoa da composição (V4E-T2.5)', () => {
  /** O feudo com a Torre no nível pedido e uma incursão sorteada à vista, com composição. */
  function sighted(tower: number): GameState {
    const state = beforeWolves();
    state.settlement.buildings.watchtower = tower;
    state.horde.scheduledRaids = [
      {
        id: 'threat-1',
        atMs: WOLVES_AT + 3 * DAY_MS,
        kind: 'threat',
        enemy: 'wolves',
        size: 'medium',
        announcedAtMs: WOLVES_AT - 1,
        composition: [
          { wing: 'left', line: 'front', unit: 'wolf', count: 9 },
          { wing: 'center', line: 'front', unit: 'raider', count: 12 },
          { wing: 'center', line: 'back', unit: 'banditArcher', count: 6 },
          { wing: 'right', line: 'front', unit: 'wolf', count: 10 },
        ],
      },
    ];
    return state;
  }
  const incomingAt = (tower: number) =>
    deriveViewState(sighted(tower), WOLVES_AT - 1, { timeScale: 1 }).threat;

  it('nos níveis 1 e 2 a Torre não diz nada do exército, e nenhum tipo de inimigo sai na visão', () => {
    for (const tower of [1, 2]) {
      const threat = incomingAt(tower);
      expect(threat.known && threat.incoming?.compositionText).toBeNull();
      const text = JSON.stringify(deriveViewState(sighted(tower), WOLVES_AT - 1));
      expect(text).not.toMatch(/banditArcher|raider|"wolf"|composition"/);
    }
  });

  it('no 3 os tipos; no 4 quantos por ala, em múltiplos de 5; no 5 a composição exata', () => {
    const text = (tower: number) => {
      const threat = incomingAt(tower);
      return threat.known ? (threat.incoming?.compositionText ?? null) : null;
    };
    expect(text(3)).toBe('Os vigias distinguem lobos, saqueadores e bandoleiros arqueiros.');
    expect(text(4)).toBe(
      'Os vigias contam cerca de 10 contra a ala esquerda, cerca de 20 contra o centro e cerca de 10 contra a ala direita.',
    );
    expect(text(5)).toMatch(/^Os vigias contam 9 lobos na frente contra a ala esquerda, 12 /);
  });
});
