import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { stateV39 } from './migrations/v39';
import { readySiege } from './siege.test-helpers';
import { cloneState } from './state';
import { accept, command } from './test-helpers';
import { wallFullHp } from './wall';

describe('V4G-T5.1 · milícia e persistência da Queda com três aldeões', () => {
  it.each(['peasant', 'lord', 'ironKing'] as const)(
    'a Queda em %s protege o piso e gera estado que pode ser gravado e relido',
    (difficulty) => {
      const state = readySiege(difficulty);
      state.settlement.population.villagers = balance.morale.populationFloor;
      state.army.units = { spearman: 0, swordsman: 0, archer: 0, knight: 0, shieldbearer: 0 };
      state.settlement.wall.hp = { left: 0, center: 0, right: 0 };
      const called = accept(state, command('callMilitia', { count: 1 })).state;
      expect(currentShape(called, '')).toBeNull();
      const fallen = advanceTo(called, called.siege!.atMs);
      expect(fallen.state.siege!.result).toBe('fall');
      expect(fallen.state.settlement.population.villagers).toBe(balance.morale.populationFloor);
      expect(fallen.state.settlement.militia).toBeNull();
      expect(fallen.events.find((event) => event.type === 'siegeFell')!.data.villagersLost).toBe(0);
      expect(fallen.state.army.reports[0]!.casualties).toContainEqual(
        expect.objectContaining({
          owner: 'player',
          unit: 'militia',
          start: 1,
        }),
      );
      expect(currentShape(fallen.state, '')).toBeNull();
      const serialized = JSON.parse(JSON.stringify(fallen.state));
      expect(migrateState(serialized, { timeScale: 1 })).toEqual(fallen.state);
      // A adaptação da guarda da v40 não altera a aceitação da versão histórica.
      const old = cloneState(fallen.state) as unknown as Record<string, unknown>;
      old.schemaVersion = 39;
      delete old.vows;
      delete (old.horde as Record<string, unknown>).previousYearFormation;
      delete old.siege;
      const settlement = old.settlement as Record<string, unknown>;
      delete settlement.relics;
      delete (settlement.buildings as Record<string, unknown>).chapel;
      delete settlement.militia;
      delete settlement.reconstructionUntilMs;
      delete (old.council as Record<string, unknown>).bonuses;
      delete (old.map as Record<string, unknown>).expeditionUnlocks;
      delete (old.map as Record<string, unknown>).hexes;
      delete (old.map as Record<string, unknown>).radius;
      expect(stateV39(old, '')).toContain('casualties.0.unit');
      const invalid = cloneState(fallen.state);
      Object.assign(invalid.army.reports[0]!.casualties[0]!, { unit: 'unidade-inventada' });
      expect(currentShape(invalid, '')).not.toBeNull();
    },
  );

  it('preserva milícia nas baixas e ataques do relatório de uma onda vencida', () => {
    const state = readySiege();
    state.army.formations[0]!.posts.center.front = null;
    const called = accept(state, command('callMilitia', { count: 10 })).state;
    const after = advanceTo(called, called.siege!.atMs).state;
    const report = after.army.reports[0]!;
    expect(report.outcome).not.toBe('defeat');
    expect(
      report.log.flatMap((round) => round.attacks).some((attack) => attack.unit === 'militia'),
    ).toBe(true);
    const before = cloneState(after);
    expect(currentShape(after, '')).toBeNull();
    expect(migrateState(JSON.parse(JSON.stringify(after)), { timeScale: 1 })).toEqual(before);
    expect(after).toEqual(before);
    for (const changes of [
      { owner: 'horde' },
      { line: 'back' },
      { unit: 'militia-desconhecida' },
    ]) {
      const invalid = cloneState(after);
      Object.assign(
        invalid.army.reports[0]!.casualties.find((post) => post.unit === 'militia')!,
        changes,
      );
      expect(currentShape(invalid, '')).not.toBeNull();
    }
    const attacking = cloneState(after);
    attacking.army.reports[0] = { ...attacking.army.reports[0]!, mode: 'attack' };
    expect(currentShape(attacking, '')).not.toBeNull();
  });

  it('a mesma guarda aceita a milícia contra uma incursão forte', () => {
    const state = readySiege();
    const atMs = state.siege!.atMs;
    state.siege = null;
    // R1: a Paliçada Nv2+ do pátio do Cerco repele a incursão forte sem batalha nem relatório;
    // a Nv1 só segura a leve e deixa esta lutar, com a milícia no relatório.
    state.settlement.buildings.palisade = 1;
    state.settlement.wall.hp = wallFullHp(1);
    state.army.formations[0]!.posts.center.front = null;
    state.horde.scheduledRaids.push({
      id: 'review-militia-raid',
      kind: 'threat',
      enemy: 'raiders',
      size: 'strong',
      atMs,
      announcedAtMs: null,
      composition: [{ wing: 'center', line: 'front', unit: 'raider', count: 6 }],
    });
    const called = accept(state, command('callMilitia', { count: 10 })).state;
    const after = advanceTo(called, atMs).state;
    expect(after.army.reports[0]!.casualties.some((post) => post.unit === 'militia')).toBe(true);
    expect(currentShape(after, '')).toBeNull();
    expect(migrateState(JSON.parse(JSON.stringify(after)), { timeScale: 1 })).toEqual(after);
  });
});
