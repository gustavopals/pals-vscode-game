import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { currentShape, migrateState } from './migrations';
import { readySiege, siegeYard } from './siege.test-helpers';
import { cloneState } from './state';
import { accept, command, HOUR, refuse, YEAR } from './test-helpers';
import { deriveViewState } from './view';
import { vigilAt } from './vigil';

const wave = (state: ReturnType<typeof readySiege>) => advanceTo(state, state.siege!.nextWaveAtMs!);

describe('V4G-T5.1 · limites do Cerco', () => {
  it.each([
    [0.5, 'peasant'],
    [1, 'lord'],
    [3, 'ironKing'],
  ] as const)('30 dias reais fora no ritmo %s e dificuldade %s', (pace, difficulty) => {
    const state = readySiege(difficulty, pace);
    const end = state.lastProcessedAt + 30 * 24 * HOUR * pace;
    const direct = advanceTo(state, end);
    let divided = state;
    const events = [];
    for (const cut of [state.siege!.atMs, state.siege!.atMs + HOUR * pace, YEAR, end]) {
      const part = advanceTo(divided, cut);
      divided = part.state;
      events.push(...part.events);
    }
    expect(divided).toEqual(direct.state);
    expect(events).toEqual(direct.events);
    expect(
      direct.events.filter((event) => event.type === 'siegeWaveFought' && event.data.year === 1),
    ).toHaveLength(3);
    expect(direct.events.filter((event) => event.type === 'yearEnded')).not.toHaveLength(0);
    expect(Object.keys(direct.state.rng).some((key) => key.startsWith('battle:'))).toBe(false);
    expect(currentShape(direct.state, '')).toBeNull();
  });

  it.each([0.5, 1, 3])(
    'resposta no último ms vale; no instante da onda %s não muda a onda seguinte',
    (pace) => {
      const first = wave(readySiege('lord', pace)).state;
      const beforeDeadline = advanceTo(first, first.siege!.nextWaveAtMs! - 1).state;
      const repaired = accept(beforeDeadline, command('emergencyRepair', { wave: 2 }));
      expect(repaired.events.some((event) => event.type === 'wallRepaired')).toBe(true);
      const second = wave(first).state;
      expect(second.siege!.current).toBe(2);
      const unchanged = cloneState(second);
      expect(refuse(second, command('emergencyRepair', { wave: 2 })).code).toBe('NO_WAVE_DECISION');
      expect(
        refuse(second, command('swapWaveFormation', { wave: 2, formationId: 'formation-1' })).code,
      ).toBe('NO_WAVE_DECISION');
      expect(second).toEqual(unchanged);
      expect(
        deriveViewState(second, second.lastProcessedAt).pendingDecisions.find(
          (entry) => entry.kind === 'siegeWave',
        ),
      ).toMatchObject({ wave: 3 });
    },
  );

  it('duas convocações não afastam aldeões nem incrementam o contador duas vezes', () => {
    const state = readySiege();
    state.army.formations[0]!.posts.center.front = null;
    const once = accept(state, command('callMilitia', { count: 5 }));
    expect(once.events.filter((event) => event.type === 'militiaCalled')).toHaveLength(1);
    const before = cloneState(once.state);
    expect(refuse(once.state, command('callMilitia', { count: 5 })).code).toBe('MILITIA_ACTIVE');
    expect(once.state).toEqual(before);
    expect(once.state.stats.militiaCalled).toBe(5);
    expect(once.state.settlement.militia!.count).toBe(5);
    expect(currentShape(once.state, '')).toBeNull();
  });

  it('migra v39 no inverno depois da Vigília, sem prazo retroativo ou sorteio no passo', () => {
    const template = siegeYard();
    template.settings.vigil.hourLocal = 6;
    template.settings.vigilHourLocal = 6;
    const at = vigilAt(template.settings, 144 * HOUR) + 1;
    template.lastProcessedAt = at;
    template.clock.gameTimeMs = at;
    const historical = JSON.parse(JSON.stringify(template));
    historical.schemaVersion = 39;
    delete historical.settlement.relics;
    delete historical.horde.previousYearFormation;
    delete historical.settlement.buildings.chapel;
    delete historical.siege;
    delete historical.settlement.militia;
    delete historical.settlement.reconstructionUntilMs;
    delete historical.council.bonuses;
    delete historical.map.expeditionUnlocks;
    const migrated = migrateState(historical, { timeScale: 1 });
    expect(migrated.siege).toBeNull();
    expect(migrated.rng).toEqual(template.rng);
    const marked = advanceTo(migrated, at + 2 * HOUR);
    expect(marked.events.filter((event) => event.type === 'siegeScheduled')).toHaveLength(1);
    expect(marked.state.siege!.atMs).toBeGreaterThan(marked.state.lastProcessedAt);
    expect(marked.events.some((event) => event.type === 'siegeWaveFought')).toBe(false);
    expect(currentShape(marked.state, '')).toBeNull();
  });

  it('o fuso alterado entre ondas não move o Cerco nem o prazo da decisão', () => {
    const first = wave(readySiege()).state;
    const before = cloneState(first).siege;
    const changed = applyCommand(
      first,
      command('setVigilHour', {
        hourLocal: 3,
        timezone: 'Asia/Tokyo',
      }),
      first.lastProcessedAt,
      { vigil: { utcOffsetMinutes: 540, timezoneResolved: true } },
    );
    expect(changed.ok).toBe(true);
    if (!changed.ok) throw new Error(changed.message);
    expect(changed.state.siege).toEqual(before);
    expect(changed.state.rng).toEqual(first.rng);
    expect(wave(changed.state).state.army.reports.at(-1)).toEqual(
      wave(first).state.army.reports.at(-1),
    );
    expect(currentShape(changed.state, '')).toBeNull();
  });

  it.each([1, 2, 5])(
    'a onda 3 oculta não altera a visão nem a prévia, com Torre %s sem presságio',
    (tower) => {
      const state = readySiege();
      state.settlement.buildings.watchtower = tower;
      state.horde.omens = [];
      const other = cloneState(state);
      for (const waves of [other.siege!.waves, other.horde.wavePlan!.waves]) {
        for (const post of waves[2]!.composition) {
          if (post.unit === 'warlord') continue;
          post.unit = post.line === 'front' ? 'wolf' : 'shaman';
          post.count += 1;
        }
      }
      expect(currentShape(other, '')).toBeNull();
      expect(deriveViewState(other, other.lastProcessedAt)).toEqual(
        deriveViewState(state, state.lastProcessedAt),
      );
      const order = command('simulateBattle', { formationId: 'formation-1', siegeWave: 3 });
      const preview = accept(state, order).state;
      const hidden = accept(other, order).state;
      expect(hidden.army.preview).toEqual(preview.army.preview);
      expect(preview.army.preview!.enemy).toEqual([]);
      expect(hidden.rng).toEqual(other.rng);
      expect(preview.rng).toEqual(state.rng);
    },
  );
});
