import { balance, objectives, type WarRaidSizeId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { emptyPosts } from './formations';
import { currentShape } from './migrations';
import { readySiege } from './siege.test-helpers';
import { addHero, barracksYard, MINUTE } from './test-helpers';
import { yearStat } from './yearStats';

const AT = MINUTE;

function approaching(timeScale: number, level: number, size: WarRaidSizeId) {
  return barracksYard(AT - 2, (draft) => {
    draft.settings.timeScale = timeScale;
    draft.settlement.buildings.barracks = 8;
    draft.settlement.buildings.palisade = level;
    // A regra de segurar é pelo nível, inclusive com a muralha danificada.
    draft.settlement.wall.hp = { left: 0, center: 15, right: 30 };
    draft.army.units.spearman = 30;
    draft.army.units.archer = 30;
    const hero = addHero(draft, { level: 4 });
    draft.ids.item = 1;
    hero.equipment.weapon = { id: 'item-1', defId: 'huntingSpear', condition: 8 };
    draft.ids.formation = 1;
    const posts = emptyPosts();
    for (const wing of ['left', 'center', 'right'] as const) {
      posts[wing] = {
        front: { unit: 'spearman', count: 10 },
        back: { unit: 'archer', count: 10 },
      };
    }
    draft.army.formations = [
      {
        id: 'formation-1',
        name: 'Guarda',
        posts,
        commanders: { left: null, center: hero.id, right: null },
      },
    ];
    draft.army.activeFormationId = 'formation-1';
    draft.horde.lastFormationSeen = { total: 4, byUnit: { archer: 4 } };
    draft.map.threat = 50;
    draft.horde.scheduledRaids = [
      {
        id: 'raid-r1',
        kind: 'threat',
        enemy: 'wolves',
        size,
        atMs: AT,
        announcedAtMs: null,
        composition: null,
      },
    ];
  });
}

describe.each([0.5, 1, 3])('Paliçada segura sem batalha, ritmo %s (R1)', (timeScale) => {
  for (const size of ['light', 'medium', 'strong'] as const) {
    it.each([0, 1, 2, 3, 4, 5, 6])(
      `Nv%i contra ${size}: o nível decide antes da batalha`,
      (level) => {
        const before = approaching(timeScale, level, size);
        const held = level >= (size === 'light' ? 1 : 2);
        const justBefore = advanceTo(before, AT - 1);
        expect(justBefore.events.some((event) => event.type === 'raidRepelled')).toBe(false);
        expect(justBefore.state.army.reports).toEqual([]);
        const result = advanceTo(justBefore.state, AT);
        expect(result.state.horde.scheduledRaids).toEqual([]);
        expect(result.events.filter((event) => event.type === 'battleFought')).toHaveLength(
          held ? 0 : 1,
        );
        expect(result.state.army.reports).toHaveLength(held ? 0 : 1);
        if (!held) return;
        expect(result.state.army.units).toEqual(before.army.units);
        expect(result.state.settlement.wall).toEqual(before.settlement.wall);
        expect(result.state.settlement.injured).toEqual(before.settlement.injured);
        expect(result.state.guild.heroes).toEqual(before.guild.heroes);
        expect(result.state.horde.lastFormationSeen).toEqual(before.horde.lastFormationSeen);
        expect(result.state.rng).toEqual(before.rng);
        expect(result.state.ids).toEqual(before.ids);
        expect(result.state.map.threat).toBe(50 - balance.threat.raidDrop);
        expect(result.state.stats.raids_repelled).toBe(1);
        expect(result.state.stats.lastRaidRepelledBattle).toBe(0);
        expect(result.state.stats.raids_suffered).toBeUndefined();
        expect(yearStat(result.state, 'battles')).toBe(0);
        expect(yearStat(result.state, 'battlesWon')).toBe(0);
        const repelled = result.events.find((event) => event.type === 'raidRepelled')!;
        expect(repelled.data).not.toHaveProperty('battleId');
        expect(repelled.text).toMatch(/Recuaram diante da paliçada/);
        expect(
          result.events.some((event) =>
            /battleFought|wallDamaged|commanderInjured|commanderDied|itemWorn/.test(event.type),
          ),
        ).toBe(false);
        expect(currentShape(result.state, '')).toBeNull();
      },
    );
  }

  it('mantém estado, eventos e gerador ao cortar antes e no instante da incursão', () => {
    const before = approaching(timeScale, 2, 'strong');
    const whole = advanceTo(before, AT + 1);
    const first = advanceTo(before, AT - 1);
    const middle = advanceTo(first.state, AT);
    const last = advanceTo(JSON.parse(JSON.stringify(middle.state)), AT + 1);
    expect(last.state).toEqual(whole.state);
    expect([...first.events, ...middle.events, ...last.events]).toEqual(whole.events);
    expect(advanceTo(middle.state, AT).events).toEqual([]);
  });

  it('dissolve a milícia sem baixas e não registra formação do ensaio que não lutou', () => {
    const before = approaching(timeScale, 2, 'strong');
    before.horde.scheduledRaids[0]!.id = 'raidersYear1Rehearsal';
    before.settlement.militia = { count: 5, untilMs: AT };
    const result = advanceTo(before, AT);
    expect(result.state.settlement.militia).toBeNull();
    expect(result.state.settlement.population).toEqual(before.settlement.population);
    expect(result.state.stats.vigilRehearsalMarked).toBe(1);
    expect(Object.keys(result.state.stats).some((key) => key.includes('rehearsal:'))).toBe(false);
    expect(result.events.filter((event) => event.type === 'militiaDisbanded')).toHaveLength(1);
  });

  it('conclui o objetivo sem dar XP aos comandantes de uma batalha anterior', () => {
    const first = advanceTo(approaching(timeScale, 0, 'light'), AT).state;
    expect(first.army.reports[0]!.outcome).not.toBe('defeat');
    first.settlement.buildings.palisade = 2;
    first.horde.scheduledRaids = [
      {
        id: 'raid-r1-next',
        kind: 'threat',
        enemy: 'wolves',
        size: 'strong',
        atMs: AT + 1,
        announcedAtMs: null,
        composition: null,
      },
    ];
    first.stats.raids_repelled = 0;
    first.objectives = {
      completed: objectives
        .filter((entry) => entry.id !== 'repelFirstRaid')
        .map((entry) => entry.id),
      active: ['repelFirstRaid'],
    };
    const reports = first.army.reports;
    const heroes = first.guild.heroes;
    const result = advanceTo(first, AT + 1);
    expect(result.state.objectives.completed).toContain('repelFirstRaid');
    expect(result.state.guild.heroes).toEqual(heroes);
    expect(result.state.army.reports).toEqual(reports);
    expect(result.state.stats.lastRaidRepelledBattle).toBe(0);
  });

  it('o Cerco continua sendo batalha mesmo com a Paliçada Nv6', () => {
    const before = readySiege('lord', timeScale);
    const result = advanceTo(before, before.siege!.nextWaveAtMs!);
    expect(result.events.filter((event) => event.type === 'battleFought')).toHaveLength(1);
    expect(result.state.army.reports).toHaveLength(1);
  });
});
