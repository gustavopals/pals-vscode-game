import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { compositionWeights } from './hordeMind';
import { observeFormation } from './hordePlan';
import { buildRaidComposition } from './raidArmy';
import { nextInt } from './random';
import { cloneState } from './state';
import { AUTUMN, DAY, gameAt, newGame, SUMMER, WINTER, YEAR } from './test-helpers';
import { deriveViewState } from './view';

describe('a Horda ligada à partida (V4E-T3)', () => {
  it('a astúcia mora na dificuldade, sem mudar as opções públicas do catálogo', () => {
    expect(balance.difficulties.peasant.cunning).toEqual({ num: 3, den: 10 });
    expect(balance.difficulties.lord.cunning).toEqual({ num: 1, den: 2 });
    expect(balance.difficulties.ironKing.cunning).toEqual({ num: 4, den: 5 });
  });

  it('o Acampamento nasce no dia 25 e a Fortaleza na virada que abre o outono', () => {
    const start = newGame('tiles-v4');
    start.settlement.buildings.watchtower = 1;
    const before = advanceTo(start, SUMMER - 1);
    expect(before.state.map.tiles.raiderCamp).toBeUndefined();
    const summer = advanceTo(before.state, SUMMER);
    expect(summer.state.map.tiles.raiderCamp).toEqual({ type: 'raiderCamp', threatActive: true });
    expect(summer.events.filter((e) => e.type === 'campAppeared')).toHaveLength(1);
    const autumn = advanceTo(summer.state, AUTUMN);
    expect(autumn.state.map.tiles.hordeFortress).toEqual({
      type: 'hordeFortress',
      threatActive: true,
    });
    expect(autumn.events.filter((e) => e.type === 'fortressAppeared')).toHaveLength(1);
    expect(autumn.state.horde.wavePlan?.waves.map((w) => w.number)).toEqual([1, 2, 3]);
    expect(currentShape(autumn.state, '')).toBeNull();
  });

  it('sem Torre, os tiles existem mas não saem em eventos nem na visão da Ameaça', () => {
    const { state, events } = advanceTo(newGame('horde-fog'), AUTUMN + DAY);
    expect(state.map.tiles.raiderCamp?.threatActive).toBe(true);
    expect(state.map.tiles.hordeFortress?.threatActive).toBe(true);
    expect(
      events.some((event) => ['campAppeared', 'fortressAppeared', 'omenSeen'].includes(event.type)),
    ).toBe(false);
    expect(deriveViewState(state, state.lastProcessedAt).threat.known).toBe(false);
    expect(state.horde.omens).toEqual([]);
  });

  it('a Horda lembra os soldados vistos, substitui a memória e não guarda nomes nem heróis', () => {
    const state = advanceTo(gameAt(AUTUMN - 1), AUTUMN).state;
    observeFormation(state, [{ unit: 'archer', count: 12 }], AUTUMN);
    expect(state.horde.lastFormationSeen).toEqual({ total: 12, byUnit: { archer: 12 } });
    const revision = state.horde.wavePlan?.revision;
    observeFormation(state, [{ unit: 'archer', count: 12 }], AUTUMN + 1);
    expect(state.horde.wavePlan?.revision).toBe(revision);
    observeFormation(state, [{ unit: 'spearman', count: 3 }], AUTUMN + 2);
    expect(state.horde.lastFormationSeen).toEqual({ total: 3, byUnit: { spearman: 3 } });
    expect(state.horde.wavePlan?.revision).toBe((revision ?? 0) + 1);
    // Sem formação vista (a incursão contra um feudo sem Defesa ativa) a memória e as ondas
    // ficam: apagar a memória regerava as ondas no outono, uma finta de graça (D-45c).
    const plan = state.horde.wavePlan;
    observeFormation(state, [], AUTUMN + 3);
    expect(state.horde.lastFormationSeen).toEqual({ total: 3, byUnit: { spearman: 3 } });
    expect(state.horde.wavePlan).toEqual(plan);
    observeFormation(state, [{ unit: 'spearman', count: 0 }], AUTUMN + 4);
    expect(state.horde.lastFormationSeen).toEqual({ total: 3, byUnit: { spearman: 3 } });
    expect(state.horde.wavePlan?.revision).toBe((revision ?? 0) + 1);
  });

  it('a mesma memória e semente geram a mesma incursão adaptada, com mais cavalaria contra arqueiros', () => {
    const draw = (memory: { total: number; byUnit: { archer: number } } | null) => {
      const state = newGame('horde-adapted');
      return Array.from({ length: 100 }, () =>
        buildRaidComposition(
          'strong',
          'autumn',
          (max) => nextInt(state, 'horde', max),
          compositionWeights('autumn', 'lord', memory),
        ),
      ).flat();
    };
    const memory = { total: 20, byUnit: { archer: 20 } };
    const adapted = draw(memory);
    expect(draw(memory)).toEqual(adapted);
    const cavalry = (posts: typeof adapted) => posts.filter((p) => p.unit === 'blackKnight').length;
    expect(cavalry(adapted)).toBeGreaterThan(cavalry(draw(null)));
  });

  it('depois do inverno a memória muda, mas as ondas ficam fixas', () => {
    const state = advanceTo(gameAt(AUTUMN - 1), WINTER).state;
    const waves = cloneState(state).horde.wavePlan;
    observeFormation(state, [{ unit: 'archer', count: 20 }], WINTER);
    expect(state.horde.lastFormationSeen).toEqual({ total: 20, byUnit: { archer: 20 } });
    expect(state.horde.wavePlan).toEqual(waves);
  });

  it('a virada do ano esquece a memória e os presságios e encerra a Fortaleza', () => {
    const state = advanceTo(gameAt(AUTUMN - 1), WINTER).state;
    state.horde.lastFormationSeen = { total: 2, byUnit: { archer: 2 } };
    state.map.tiles.raiderCamp = { type: 'raiderCamp', threatActive: false };
    const next = advanceTo(state, YEAR).state;
    expect(next.horde.lastFormationSeen).toBeNull();
    expect(next.horde.omens).toEqual([]);
    expect(next.horde.wavePlan).toBeNull();
    // O Cerco remove a Fortaleza ao terminar, antes da virada anual.
    expect(next.map.tiles.hordeFortress).toBeUndefined();
    expect(next.map.tiles.raiderCamp?.threatActive).toBe(true);
  });

  it('o presságio vago não diz de qual onda fala, nem na visão nem no evento (névoa, revisão da V4E-T3)', () => {
    // Torre Nv1: todo presságio é vago.
    const start = gameAt(AUTUMN - 1, (state) => {
      state.settlement.buildings.watchtower = 1;
    });
    const { state, events } = advanceTo(start, AUTUMN + 20 * DAY);
    const vague = state.horde.omens.filter((omen) => omen.clarity === 'vague');
    expect(vague.length).toBeGreaterThan(0);
    const view = deriveViewState(state, state.lastProcessedAt);
    state.horde.omens.forEach((omen, index) => {
      expect(view.army.omens[index]?.wave).toBe(omen.clarity === 'vague' ? null : omen.wave);
    });
    const seen = events.filter((event) => event.type === 'omenSeen');
    expect(seen.length).toBeGreaterThan(0);
    for (const event of seen) {
      if (event.data.clarity === 'vague') expect(event.data).not.toHaveProperty('wave');
    }
    // Duas partidas que só diferem na onda dos presságios vagos dão a mesma visão.
    const other = cloneState(state);
    for (const omen of other.horde.omens) {
      if (omen.clarity === 'vague') omen.wave = omen.wave === 1 ? 2 : 1;
    }
    expect(deriveViewState(other, other.lastProcessedAt)).toEqual(view);
  });

  it('presságios leem ondas reais e a visão nunca leva memória nem a preparação escondida', () => {
    const start = gameAt(AUTUMN - 1, (state) => {
      state.settlement.buildings.watchtower = 5;
    });
    const { state, events } = advanceTo(start, AUTUMN + 12 * DAY);
    expect(state.horde.omens.length).toBeGreaterThan(0);
    expect(state.horde.omens.length).toBeLessThanOrEqual(balance.omens.kept);
    expect(events.some((event) => event.type === 'omenSeen')).toBe(true);
    for (const omen of state.horde.omens) {
      expect(omen.revision).toBe(state.horde.wavePlan?.revision);
      const wave = state.horde.wavePlan?.waves.find((entry) => entry.number === omen.wave);
      expect(omen.reveals).toEqual(wave?.composition);
    }
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.army.omens.length).toBe(state.horde.omens.length);
    const hidden = cloneState(state);
    hidden.horde.lastFormationSeen = { total: 50, byUnit: { knight: 50 } };
    expect(deriveViewState(hidden, hidden.lastProcessedAt)).toEqual(view);
    expect(JSON.stringify(view)).not.toMatch(/wavePlan|lastFormationSeen|revision/);
    expect(currentShape(state, '')).toBeNull();
    expect(migrateState(state, { timeScale: 1 })).toBe(state);
  });

  it.each([0.5, 1, 3])(
    'o avanço dividido preserva ondas, presságios, eventos e sorteios no ritmo %s',
    (timeScale) => {
      const start = gameAt(AUTUMN - 1, (state) => {
        state.settings.timeScale = timeScale;
        state.settlement.buildings.watchtower = 3;
      });
      const whole = advanceTo(start, AUTUMN + 3 * DAY);
      const first = advanceTo(start, AUTUMN);
      const second = advanceTo(first.state, AUTUMN + 3 * DAY);
      expect(second.state).toEqual(whole.state);
      expect([...first.events, ...second.events]).toEqual(whole.events);
    },
  );
});
