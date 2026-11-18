import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { applyHarm } from './outcomes';
import { cloneState } from './state';
import { accept, addHero, command, DAY, gameWith, MINUTE, refuse } from './test-helpers';
import type { Expedition, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const yard = () =>
  gameWith((state) => {
    state.settlement.buildings.townHall = 5;
    state.settlement.resources.wood = 1_000_000;
    state.settlement.resources.stone = 1_000_000;
    state.settlement.resources.gold = 1_000_000;
  });

describe('Capela — V5B-T1', () => {
  it('exige Salão Nv5, cobra o custo base e só concede moral ao terminar a obra de 30 min', () => {
    const state = yard();
    state.settlement.buildings.townHall = 4;
    expect(refuse(state, command('startConstruction', { building: 'chapel' })).message).toContain(
      '5',
    );
    state.settlement.buildings.townHall = 5;
    const started = accept(state, command('startConstruction', { building: 'chapel' })).state;
    expect(started.settlement.resources).toMatchObject({
      wood: 800_000,
      stone: 700_000,
      gold: 800_000,
    });
    expect(started.settlement.buildings.chapel).toBe(0);
    expect(currentShape(started, '')).toBeNull();
    const before = advanceTo(started, 30 * MINUTE - 1).state;
    expect(before.settlement.buildings.chapel).toBe(0);
    const done = advanceTo(before, 30 * MINUTE);
    expect(done.state.settlement.buildings.chapel).toBe(1);
    expect(done.events.find((event) => event.type === 'buildingFounded')?.text).toContain('Capela');
    const morale = deriveViewState(done.state, done.state.lastProcessedAt).morale;
    expect(morale.terms).toContainEqual(expect.objectContaining({ label: 'Capela', amount: 5 }));
    expect(morale.breakdown).toContain('capela');
    const next = advanceTo(done.state, DAY).state;
    expect(next.settlement.morale).toBe(morale.next.value);
  });

  it('o bônus de moral é fixo e o teto da Capela é Nv3', () => {
    const state = yard();
    state.settlement.buildings.chapel = 3;
    expect(refuse(state, command('startConstruction', { building: 'chapel' })).code).toBe(
      'MAX_LEVEL',
    );
    expect(
      deriveViewState(state, 0).morale.terms.find((term) => term.label === 'Capela')?.amount,
    ).toBe(5);
  });

  it.each(['light', 'severe'] as const)(
    'congela a cura %s ao marcar o ferimento, sem recontar o anterior',
    (kind) => {
      const original = yard();
      const hero = addHero(original, { classId: 'warrior' });
      const expedition = { id: 'expedition-1', modelId: 'patrol' } as Expedition;
      const events: GameEvent[] = [];
      applyHarm(original, expedition, hero, { kind, spared: false }, 'Patrulha', 0, events);
      expect(hero.injury?.untilMs).toBe(balance.injuries.durationMs[kind]);
      const state = cloneState(original);
      state.settlement.buildings.chapel = 1;
      expect(state.guild.heroes[0]?.injury).toEqual(hero.injury);
      const healed = state.guild.heroes[0]!;
      healed.injury = null;
      applyHarm(state, expedition, healed, { kind, spared: false }, 'Patrulha', 0, []);
      expect(state.guild.heroes[0]?.injury?.untilMs).toBe(
        (balance.injuries.durationMs[kind] * 3) / 4,
      );
      applyHarm(state, expedition, healed, { kind, spared: false }, 'Patrulha', 1, []);
      expect(state.guild.heroes[0]?.injury?.untilMs).toBe(
        1 + (balance.injuries.durationMs[kind] * 3) / 4,
      );
    },
  );

  it('42 → 43 só acrescenta a Capela por construir; confere versão atual e forma exata', () => {
    const fresh = yard();
    const buildings = Object.fromEntries(
      Object.entries(fresh.settlement.buildings).filter(([id]) => id !== 'chapel'),
    );
    const old = {
      ...fresh,
      schemaVersion: 42,
      settlement: {
        ...Object.fromEntries(Object.entries(fresh.settlement).filter(([key]) => key !== 'relics')),
        buildings,
      },
    };
    const snapshot = JSON.stringify(old);
    const migrated = migrateState(old, { timeScale: 1 });
    expect(migrated).toEqual({ ...fresh, migratedAtMs: fresh.lastProcessedAt });
    expect(JSON.stringify(old)).toBe(snapshot);
    expect(migrateState(migrated, { timeScale: 1 })).toBe(migrated);
    for (const chapel of [-1, 4, 1.5, undefined]) {
      const invalid: GameState = cloneState(migrated);
      Object.assign(invalid.settlement.buildings, { chapel });
      expect(() => migrateState(invalid, { timeScale: 1 })).toThrow();
    }
    expect(currentShape({ ...migrated, extra: true }, '')).not.toBeNull();
  });
});
