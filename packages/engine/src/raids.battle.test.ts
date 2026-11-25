import { vigilAt } from './vigil';
import { balance, warRaids } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS } from './clock';
import { WAR_SCRIPTED_RAIDS_V33 } from './migrations/v32';
import { gameAt, newGame } from './test-helpers';
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
    // A Horda viu a tropa do começo da batalha, sem nomes, comandantes ou reserva.
    expect(state.horde.lastFormationSeen).toEqual({
      total: 60,
      byUnit: { spearman: 30, archer: 30 },
    });
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

  it('a contagem aproximada preserva o mínimo positivo e omite alas vazias', () => {
    const state = sighted(4);
    state.horde.scheduledRaids[0]!.composition = [
      { wing: 'left', line: 'front', unit: 'wolf', count: 1 },
    ];
    const threat = deriveViewState(state, WOLVES_AT - 1).threat;
    expect(threat.known && threat.incoming?.compositionText).toBe(
      'Os vigias contam cerca de 5 contra a ala esquerda.',
    );
  });
});

describe('as incursões-batalha do roteiro do ano 1 (V4E-T2.4)', () => {
  it('são marcadas 6 h de jogo antes da chegada, com o ensaio na Vigília e sem composição', () => {
    expect(newGame().horde.scheduledRaids.map((raid) => raid.id)).toEqual(['wolvesYear1']);
    const lead = balance.threat.raidLeadMs;
    const marked: Array<[string, number, string]> = [];
    for (const def of warRaids.scripted) {
      const base = (def.atGameDay - 1) * DAY_MS;
      const atMs = def.rehearsal ? vigilAt(newGame().settings, base) : base;
      let state = gameAt(atMs - lead - 1, (draft) => {
        draft.horde.scheduledRaids = [];
      });
      const justBefore = advanceTo(state, atMs - lead - 1).state;
      expect(justBefore.horde.scheduledRaids.some((raid) => raid.id === def.id)).toBe(false);
      state = advanceTo(justBefore, atMs - lead).state;
      const raid = state.horde.scheduledRaids.find((entry) => entry.id === def.id);
      expect(raid).toMatchObject({ kind: 'scripted', composition: null });
      marked.push([def.id, (raid?.atMs ?? 0) / DAY_MS + 1, raid?.size ?? '']);
      // A lista continua em ordem de chegada.
      const times = state.horde.scheduledRaids.map((entry) => entry.atMs);
      expect(times).toEqual([...times].sort((a, b) => a - b));
    }
    expect(marked).toEqual([
      ['raidersYear1Weak', 25, 'light'],
      ['raidersYear1Medium', 37, 'light'],
      ['raidersYear1Rehearsal', vigilAt(newGame().settings, 60 * DAY_MS) / DAY_MS + 1, 'strong'],
    ]);
  });

  it('o passo 32 → 33 escreve os mesmos ids, dias e tamanhos do conteúdo', () => {
    expect(WAR_SCRIPTED_RAIDS_V33).toEqual(
      warRaids.scripted.map((def) => ({
        id: def.id,
        atMs: (def.atGameDay - 1) * DAY_MS,
        size: def.size,
      })),
    );
  });

  it('a do 25º dia chega como batalha', () => {
    const before = advanceTo(newGame(), 24 * DAY_MS - 1).state;
    expect(before.horde.scheduledRaids[0]?.id).toBe('raidersYear1Weak');
    const { state, events } = advanceTo(before, 24 * DAY_MS);
    const here = at(events, 24 * DAY_MS);
    expect(here.some((event) => event.type === 'battleFought')).toBe(true);
    expect(
      here.some((event) => event.type === 'raidSuffered' || event.type === 'raidRepelled'),
    ).toBe(true);
    expect(state.horde.scheduledRaids.some((raid) => raid.id === 'raidersYear1Weak')).toBe(false);
  });

  it.each([
    ['raidersYear1Weak', 25],
    ['raidersYear1Medium', 37],
  ])(
    'a %s (dia %i), sofrida sem defesa nenhuma, leva do estoque e não fere ninguém (D-39)',
    (id, day) => {
      const atMs = (day - 1) * DAY_MS;
      const before = advanceTo(newGame(), atMs - 1).state;
      before.horde.scheduledRaids = [
        {
          id,
          atMs,
          kind: 'scripted',
          enemy: 'wolves',
          size: 'light',
          announcedAtMs: null,
          composition: null,
        },
      ];
      before.settlement.buildings.palisade = 0;
      before.settlement.wall.hp = { left: 0, center: 0, right: 0 };
      before.settlement.resources.food = 500_000;
      before.settlement.resources.wood = 500_000;
      const injuredBefore = before.settlement.injured.length;
      const { state, events } = advanceTo(before, atMs);
      const here = at(events, atMs);
      const suffered = here.find((event) => event.type === 'raidSuffered');
      expect(suffered?.data).toMatchObject({ size: 'light', injured: 0 });
      expect(Number(suffered?.data.raided_food ?? 0)).toBeGreaterThan(0);
      expect(suffered?.text).not.toMatch(/ferid|fere/);
      expect(here.some((event) => event.type === 'villagerInjured')).toBe(false);
      expect(state.settlement.injured.length).toBe(injuredBefore);
    },
  );

  it('a mesma incursão leve, sem ser a do roteiro, continua ferindo', () => {
    const atMs = 24 * DAY_MS;
    const before = advanceTo(newGame(), atMs - 1).state;
    before.horde.scheduledRaids = [
      {
        id: 'raid-x',
        atMs,
        kind: 'threat',
        enemy: 'wolves',
        size: 'light',
        announcedAtMs: null,
        composition: null,
      },
    ];
    before.settlement.buildings.palisade = 0;
    before.settlement.wall.hp = { left: 0, center: 0, right: 0 };
    const { events } = advanceTo(before, atMs);
    const suffered = at(events, atMs).find((event) => event.type === 'raidSuffered');
    expect(Number(suffered?.data.injured)).toBeGreaterThan(0);
  });

  it('a forte do 61º dia (o ensaio), sem defesa, leva no máximo a perda de `warRaids.losses.strong`', () => {
    const start = gameAt(57 * DAY_MS - 1, (draft) => {
      draft.horde.scheduledRaids = [];
    });
    const arrival = vigilAt(start.settings, 60 * DAY_MS);
    const before = advanceTo(start, arrival - 1).state;
    before.horde.scheduledRaids = before.horde.scheduledRaids.filter(
      (raid) => raid.id === 'raidersYear1Rehearsal',
    );
    before.settlement.buildings.palisade = 0;
    before.settlement.wall.hp = { left: 0, center: 0, right: 0 };
    const { events } = advanceTo(before, arrival);
    const suffered = at(events, arrival).find((event) => event.type === 'raidSuffered');
    expect(suffered?.data).toMatchObject({ size: 'strong' });
    expect(Number(suffered?.data.injured)).toBeLessThanOrEqual(warRaids.losses.strong.injuries);
  });
});

describe('postos avançados na incursão-batalha (V5F-T2)', () => {
  it('lobos do dia 16 sem defesa danificam o posto ativo mais distante e registram no relatório', () => {
    const before = beforeWolves();
    before.ids.outpost = 2;
    before.map.hexes['1,0']!.fog = 'claimed';
    before.map.hexes['-3,0']!.fog = 'claimed';
    before.map.outposts = [
      { id: 'outpost-1', hex: '1,0', status: 'active', readyAtMs: null },
      { id: 'outpost-2', hex: '-3,0', status: 'active', readyAtMs: null },
    ];
    const { state, events } = advanceTo(before, WOLVES_AT);
    const here = at(events, WOLVES_AT);
    expect(state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '1,0', status: 'active', readyAtMs: null },
      { id: 'outpost-2', hex: '-3,0', status: 'damaged', readyAtMs: null },
    ]);
    expect(here.find((event) => event.type === 'outpostDamaged')).toMatchObject({
      data: { outpostId: 'outpost-2', hex: '-3,0', battleId: 'battle-1' },
    });
    expect(deriveViewState(state, WOLVES_AT).army.reports[0]?.damagedOutpost).toMatchObject({
      outpostId: 'outpost-2',
      hex: '-3,0',
    });
  });

  it('Defesa ativa que vence os lobos do dia 16 preserva todos os postos ativos intactos', () => {
    const before = beforeWolves();
    before.ids.outpost = 1;
    before.map.hexes['-3,0']!.fog = 'claimed';
    before.map.outposts = [{ id: 'outpost-1', hex: '-3,0', status: 'active', readyAtMs: null }];
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
    expect(at(events, WOLVES_AT).some((event) => event.type === 'raidRepelled')).toBe(true);
    expect(at(events, WOLVES_AT).some((event) => event.type === 'outpostDamaged')).toBe(false);
    expect(state.map.outposts[0]?.status).toBe('active');
    expect(deriveViewState(state, WOLVES_AT).army.reports[0]).not.toHaveProperty('damagedOutpost');
  });
});
