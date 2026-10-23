import { describe, expect, it } from 'vitest';

import {
  ARCHETYPE_COUNTERS,
  ARCHETYPES,
  HORDE_UNIT_IDS,
  hordeUnits,
  UNIT_IDS,
  units,
} from './index';
import { HordeUnitsSchema } from './schemas';

describe('Inimigos da Horda (GDD §10.3; ADR 0019, decisão 11)', () => {
  it('são os oito da tabela, na ordem, e passam no schema', () => {
    expect(HORDE_UNIT_IDS).toEqual([
      'wolf',
      'raider',
      'banditArcher',
      'blackKnight',
      'ogre',
      'skeleton',
      'shaman',
      'warlord',
    ]);
    expect(HordeUnitsSchema.safeParse(hordeUnits).error).toBeUndefined();
  });

  it('os atributos são os do GDD', () => {
    const row = (id: (typeof HORDE_UNIT_IDS)[number]) => {
      const e = hordeUnits[id];
      return [e.attack, e.defense, e.health, e.initiative, e.line];
    };
    expect(row('wolf')).toEqual([7, 2, 14, 6, 'front']);
    expect(row('raider')).toEqual([6, 3, 18, 3, 'front']);
    expect(row('banditArcher')).toEqual([6, 2, 14, 4, 'back']);
    expect(row('blackKnight')).toEqual([10, 6, 30, 5, 'front']);
    expect(row('ogre')).toEqual([14, 6, 80, 1, 'front']);
    expect(row('skeleton')).toEqual([5, 4, 16, 2, 'front']);
    expect(row('shaman')).toEqual([4, 2, 14, 3, 'back']);
    expect(row('warlord')).toEqual([18, 8, 200, 4, 'front']);
  });

  it('todo arquétipo usado tem contra-ataque definido, e os do ciclo repetem units.ts', () => {
    expect(Object.keys(ARCHETYPE_COUNTERS).sort()).toEqual([...ARCHETYPES].sort());
    for (const id of HORDE_UNIT_IDS) {
      expect(ARCHETYPES).toContain(hordeUnits[id].archetype);
      expect(ARCHETYPE_COUNTERS).toHaveProperty(hordeUnits[id].archetype);
    }
    for (const id of UNIT_IDS) {
      expect(ARCHETYPE_COUNTERS[id]).toBe(units[id].counters);
    }
  });

  it('as regras especiais são dado', () => {
    expect(hordeUnits.wolf.alwaysLateral).toBe(true);
    expect(hordeUnits.wolf.bonusAgainst).toEqual({ archer: { num: 3, den: 2 } });
    expect(hordeUnits.ogre.ignoresWallHalf).toBe(true);
    expect(hordeUnits.ogre.takesBonusFrom).toEqual({ spearman: { num: 3, den: 2 } });
    expect(hordeUnits.skeleton.noMorale).toBe(true);
    expect(hordeUnits.skeleton.takesDoubleFrom).toEqual(['mage', 'cleric']);
    expect(hordeUnits.shaman.auraWing).toEqual({ num: 6, den: 5 });
    expect(hordeUnits.warlord.auraArmy).toEqual({ num: 5, den: 4 });
    expect(hordeUnits.warlord.noMorale).toBe(true);
    expect(hordeUnits.warlord.endsWaveOnDeath).toBe(true);
    const lateral = HORDE_UNIT_IDS.filter((id) => hordeUnits[id].alwaysLateral);
    expect(lateral).toEqual(['wolf']);
  });
});
