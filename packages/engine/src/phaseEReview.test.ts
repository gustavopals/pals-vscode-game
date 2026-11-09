import { balance, hordeUnits, omenTexts } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { nextDayBoundary, seasonAt, YEAR_MS } from './clock';
import { findFormation } from './formations';
import {
  alertHordeFortress,
  applyWaveSabotage,
  observeFormation,
  revealOmen,
  settleHordeTiles,
} from './hordePlan';
import { currentShape, migrateState } from './migrations';
import { stateV33 } from './migrations/v33';
import { baseRaidComposition } from './raidArmy';
import { cloneState } from './state';
import {
  accept,
  command,
  DAY,
  eventsOfType,
  formationYard,
  gameAt,
  HOUR,
  MINUTE,
  refuse,
  wallSite,
  WINTER,
  AUTUMN,
} from './test-helpers';
import type { GameState, ScheduledRaid } from './types';
import { deriveViewState } from './view';
import { formationSignature, previewInputFor } from './warCouncilOrders';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v{32,33}-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function raid(over: Partial<ScheduledRaid> = {}): ScheduledRaid {
  return {
    id: 'threat-secret',
    atMs: 10 * MINUTE,
    kind: 'threat',
    enemy: 'horde',
    size: 'strong',
    announcedAtMs: null,
    composition: [{ wing: 'left', line: 'front', unit: 'ogre', count: 12 }],
    ...over,
  };
}

function defense(): GameState {
  return formationYard(1, 0, (draft) => {
    draft.settlement.buildings.barracks = 2;
    draft.army.units.spearman = 5;
    draft.army.units.archer = 3;
    draft.army.units.swordsman = 4;
  });
}

/** Cada hipótese da V4E-T5.1 compara também os caminhos indiretos da informação ou do evento. */
describe('V4E-T5.1: revisão adversarial da Fase E', () => {
  describe('1. composição sem Torre', () => {
    it.each([0, 1, 2])('no nível %s, trocar só a composição secreta não muda a visão', (tower) => {
      const state = defense();
      state.settlement.buildings.watchtower = tower;
      state.horde.scheduledRaids = [raid()];
      const other = cloneState(state);
      other.horde.scheduledRaids[0]!.composition = [
        { wing: 'center', line: 'back', unit: 'shaman', count: 8 },
      ];
      expect(currentShape(state, '')).toBeNull();
      expect(currentShape(other, '')).toBeNull();
      const before = JSON.stringify(state);
      const view = deriveViewState(state, 0);
      expect(deriveViewState(other, 0)).toEqual(view);
      expect(view.threat.incoming?.compositionText ?? null).toBeNull();
      if (tower === 0) expect(view.threat.incoming).toBeNull();
      expect(JSON.stringify(state)).toBe(before);
    });

    it('sem Torre, nem tamanho, prazo, Ameaça ou identidade escondidos alteram a visão e a prévia', () => {
      const state = defense();
      state.horde.scheduledRaids = [raid()];
      const other = cloneState(state);
      other.map.threat = balance.threat.max;
      other.horde.scheduledRaids = [raid({ id: 'outro-segredo', atMs: HOUR, size: 'light' })];
      const first = accept(state, command('simulateBattle', { formationId: 'formation-1' }));
      const second = accept(other, command('simulateBattle', { formationId: 'formation-1' }));
      expect(first.state.army.preview).toEqual(second.state.army.preview);
      expect(first.events).toEqual(second.events);
      expect(deriveViewState(first.state, 0)).toEqual(deriveViewState(second.state, 0));
      expect(first.state.rng).toEqual(state.rng);
      expect(first.state.ids).toEqual(state.ids);
    });
  });

  describe('2. memória da Horda lida pela prévia', () => {
    it.each([undefined, 1, 2, 3] as const)(
      'memória e ondas ocultas diferentes não alteram a prévia da onda %s',
      (siegeWave) => {
        const state = defense();
        state.lastProcessedAt = AUTUMN;
        state.clock.gameTimeMs = AUTUMN;
        settleHordeTiles(state, AUTUMN, []);
        state.settlement.buildings.watchtower = 5;
        const other = cloneState(state);
        other.horde.lastFormationSeen = { total: 30, byUnit: { archer: 30 } };
        other.horde.wavePlan!.waves[0]!.composition[0]!.count += 1;
        other.horde.wavePlan!.revision += 1;
        expect(currentShape(state, '')).toBeNull();
        expect(currentShape(other, '')).toBeNull();
        const formation = state.army.formations[0]!;
        expect(previewInputFor(other, formation, siegeWave)).toEqual(
          previewInputFor(state, formation, siegeWave),
        );
        expect(formationSignature(other, formation, siegeWave)).toBe(
          formationSignature(state, formation, siegeWave),
        );
        const payload = {
          formationId: formation.id,
          ...(siegeWave === undefined ? {} : { siegeWave }),
        };
        const first = accept(state, command('simulateBattle', payload));
        const second = accept(other, command('simulateBattle', payload));
        expect(first.state.army.preview).toEqual(second.state.army.preview);
        expect(deriveViewState(first.state, AUTUMN)).toEqual(deriveViewState(second.state, AUTUMN));
        expect(first.state.horde).toEqual(state.horde);
        expect(first.state.rng).toEqual(state.rng);
      },
    );
  });

  describe('3. Fortaleza migrada no inverno', () => {
    it.each([0.5, 1, 3])(
      'migração real no ritmo %s não sorteia nem cobra o passado',
      (timeScale) => {
        const old = JSON.parse(fixtures['./__fixtures__/state-v33-fresh.json']!) as GameState;
        const atMs = WINTER + DAY / 2;
        old.lastProcessedAt = atMs;
        old.clock.gameTimeMs = atMs;
        old.settings.timeScale = timeScale;
        old.settlement.buildings.watchtower = 2;
        old.horde.scheduledRaids = [];
        expect(stateV33(old, '')).toBeNull();
        const before = JSON.stringify(old);
        const migrated = migrateState(old, { timeScale });
        expect(JSON.stringify(old)).toBe(before);
        expect(migrated.rng).toEqual(old.rng);
        expect(migrated.horde.wavePlan).toBeNull();
        expect(migrated.siege).toBeNull();
        const justAfter = advanceTo(migrated, atMs + 1);
        expect(justAfter.state.map.tiles.hordeFortress).toBeUndefined();
        expect(justAfter.state.horde.wavePlan).toBeNull();
        const turn = nextDayBoundary(atMs);
        const whole = advanceTo(migrated, turn);
        const split = advanceTo(justAfter.state, turn);
        expect(split.state).toEqual(whole.state);
        expect([...justAfter.events, ...split.events]).toEqual(whole.events);
        expect(whole.state.map.tiles.hordeFortress?.threatActive).toBe(true);
        expect(whole.state.horde.wavePlan?.generatedAtMs).toBe(turn);
        expect(whole.state.horde.wavePlan?.waves).toHaveLength(3);
        expect(whole.state.siege?.atMs).toBeGreaterThan(turn);
        expect(eventsOfType(whole.events, 'fortressAppeared')).toHaveLength(1);
        expect(currentShape(whole.state, '')).toBeNull();
        const later = advanceTo(whole.state, turn + 1);
        expect(eventsOfType(later.events, 'fortressAppeared')).toHaveLength(0);
      },
    );

    it('o ano novo limpa memória e ondas e desativa a Fortaleza', () => {
      const state = gameAt(YEAR_MS - HOUR);
      settleHordeTiles(state, state.lastProcessedAt, []);
      state.horde.lastFormationSeen = { total: 10, byUnit: { archer: 10 } };
      const after = advanceTo(state, YEAR_MS).state;
      expect(after.horde.lastFormationSeen).toBeNull();
      expect(after.horde.wavePlan).toBeNull();
      expect(after.horde.omens).toEqual([]);
      expect(after.map.tiles.hordeFortress?.threatActive).toBe(false);
      expect(currentShape(after, '')).toBeNull();
    });
  });

  describe('4. incursão marcada antes da migração', () => {
    it('o retrato 32 anunciado mantém prazo e usa a mesma composição-base da batalha atual', () => {
      const old = JSON.parse(fixtures['./__fixtures__/state-v32-raid-announced.json']!);
      const migrated = migrateState(old, { timeScale: 1 });
      const marked = migrated.horde.scheduledRaids[0]!;
      expect(marked).toEqual({ ...old.horde.scheduledRaids[0], composition: null });
      expect(migrated.rng).toEqual(old.rng);
      const explicit = cloneState(migrated);
      explicit.horde.scheduledRaids[0]!.composition = baseRaidComposition(
        marked.size,
        seasonAt(marked.atMs).id,
      );
      const whole = advanceTo(migrated, marked.atMs);
      const spelled = advanceTo(explicit, marked.atMs);
      expect(spelled).toEqual(whole);
      expect(whole.state.army.reports).toHaveLength(1);
      expect(
        whole.events.filter((e) => e.type === 'raidRepelled' || e.type === 'raidSuffered'),
      ).toHaveLength(1);
      expect(whole.state.horde.scheduledRaids).toEqual([]);
      expect(currentShape(whole.state, '')).toBeNull();
    });
  });

  describe('5. reparo durante uma batalha', () => {
    it.each(['antes', 'junto'] as const)('a incursão chega %s do fim do reparo', (when) => {
      const state = wallSite(3, { left: 100 });
      const troops = defense();
      state.settlement.buildings.barracks = 2;
      state.army = troops.army;
      state.ids = troops.ids;
      const repairing = accept(state, command('repairWall', {})).state;
      const until = repairing.settlement.wallRepair!.untilMs;
      const hitAt = when === 'antes' ? until / 2 : until;
      repairing.horde.scheduledRaids = [raid({ atMs: hitAt })];
      const target = { ...repairing.settlement.wallRepair!.toHp };
      const first = advanceTo(repairing, hitAt);
      const report = first.state.army.reports[0]!;
      expect(report.wall.find((w) => w.wing === 'left')?.start).toBe(
        when === 'antes' ? state.settlement.wall.hp.left : target.left,
      );
      expect(report.wall.some((w) => w.end < w.start)).toBe(true);
      if (when === 'antes') {
        expect(first.state.settlement.wallRepair?.toHp).toEqual(target);
      } else {
        const types = first.events.map((e) => e.type);
        expect(types.indexOf('wallRepaired')).toBeLessThan(types.indexOf('battleFought'));
        expect(first.state.settlement.wallRepair).toBeNull();
      }
      const end = advanceTo(first.state, until + 1);
      const whole = advanceTo(repairing, until + 1);
      expect(end.state).toEqual(whole.state);
      expect([...first.events, ...end.events]).toEqual(whole.events);
      expect(end.state.settlement.wall.hp).toEqual(
        when === 'antes' ? target : first.state.settlement.wall.hp,
      );
      expect(currentShape(end.state, '')).toBeNull();
    });
  });

  describe('6. dois repairWall', () => {
    it('a segunda ordem não cobra nem empurra de novo a obra', () => {
      const state = wallSite(3, { left: 50 });
      const building = accept(state, command('startConstruction', { building: 'farm' })).state;
      const first = accept(building, command('repairWall', {}));
      const copy = cloneState(first.state);
      expect(refuse(first.state, command('repairWall', {})).code).toBe('WALL_REPAIRING');
      expect(first.state).toEqual(copy);
      expect(eventsOfType(first.events, 'wallRepairStarted')).toHaveLength(1);
      const done = advanceTo(first.state, first.state.settlement.wallRepair!.untilMs).state;
      expect(refuse(done, command('repairWall', {})).code).toBe('WALL_INTACT');
    });
  });

  describe('7. apagar Defesa ativa com incursão à vista', () => {
    it('recusa a ativa; desmarcar e apagar deixa só muralha e Torre, sem tropas fantasma', () => {
      const state = defense();
      state.settlement.buildings.watchtower = 1;
      state.horde.scheduledRaids = [raid()];
      expect(deriveViewState(state, 0).threat.incoming).not.toBeNull();
      expect(refuse(state, command('deleteFormation', { id: 'formation-1' })).code).toBe(
        'FORMATION_ACTIVE',
      );
      const unset = accept(state, command('setActiveFormation', { id: null })).state;
      const deleted = accept(unset, command('deleteFormation', { id: 'formation-1' })).state;
      expect(findFormation(deleted, 'formation-1')).toBeUndefined();
      const after = advanceTo(deleted, 10 * MINUTE).state;
      expect(after.army.reports[0]?.formationId).toBeNull();
      expect(after.army.reports[0]?.casualties.filter((c) => c.owner === 'player')).toEqual([]);
      expect(after.army.units).toEqual(state.army.units);
      expect(after.horde.lastFormationSeen).toBeNull();
      expect(currentShape(after, '')).toBeNull();
    });
  });

  describe('8. o presságio que mente', () => {
    it.each([1, 2, 3, 4, 5])(
      'a clareza no nível %s descreve a onda real e passa pela guarda',
      (tower) => {
        const state = gameAt(AUTUMN, (s) => {
          s.settlement.buildings.watchtower = tower;
        });
        settleHordeTiles(state, AUTUMN, []);
        for (const wave of state.horde.wavePlan!.waves) {
          const events: Parameters<typeof revealOmen>[3] = [];
          revealOmen(state, wave, AUTUMN, events);
          const omen = state.horde.omens.at(-1)!;
          if (tower < 3) {
            expect(omen.clarity).toBe('vague');
            expect(omen.reveals).toEqual([]);
            expect(events[0]?.data).not.toHaveProperty('wave');
            expect(deriveViewState(state, AUTUMN).army.omens.at(-1)?.wave).toBeNull();
          } else if (tower < 5) {
            const main = wave.composition.reduce((a, b) => (b.count > a.count ? b : a));
            const rounded = Math.max(
              balance.omens.roundTo,
              Math.round(main.count / balance.omens.roundTo) * balance.omens.roundTo,
            );
            expect(omen.reveals).toEqual([{ ...main, count: rounded }]);
            expect(omen.text).toContain(String(rounded));
            expect(omen.text).toContain(omenTexts.wings[main.wing]);
          } else {
            expect(omen.reveals).toEqual(wave.composition);
            for (const post of wave.composition) {
              const label =
                post.count === 1
                  ? hordeUnits[post.unit].label.toLowerCase()
                  : hordeUnits[post.unit].pluralLabel;
              expect(omen.text).toContain(`${post.count} ${label}`);
            }
          }
          expect(currentShape(state, '')).toBeNull();
        }
      },
    );

    it('sabotagem, alerta e nova formação retiram só a informação que ficou falsa', () => {
      const state = gameAt(AUTUMN, (s) => {
        s.settlement.buildings.watchtower = 5;
      });
      settleHordeTiles(state, AUTUMN, []);
      for (const wave of state.horde.wavePlan!.waves) revealOmen(state, wave, AUTUMN, []);
      applyWaveSabotage(state, 2, AUTUMN, [], 'expedition-1');
      expect(state.horde.omens.map((o) => o.wave)).toEqual([1, 3]);
      expect(currentShape(state, '')).toBeNull();
      alertHordeFortress(state, AUTUMN, [], 'expedition-1');
      expect(state.horde.omens.map((o) => o.wave)).toEqual([3]);
      expect(currentShape(state, '')).toBeNull();
      const revision = state.horde.wavePlan!.revision;
      observeFormation(state, [{ unit: 'archer', count: 20 }], AUTUMN);
      expect(state.horde.wavePlan!.revision).toBe(revision + 1);
      expect(state.horde.omens).toEqual([]);
      expect(currentShape(state, '')).toBeNull();
    });
  });
});
