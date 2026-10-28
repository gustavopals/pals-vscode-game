import { balance, ENEMY_IDS, hordeWaves, TILE_TYPE_IDS, WING_IDS, LINE_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { stateV34 } from './migrations/v34';
import { currentShape, migrateState } from './migrations';
import { v33ToV34 } from './migrations/v33';
import {
  ENEMIES_V34,
  MEMORY_MAX_V34,
  OMEN_ROUND_TO_V34,
  OMENS_KEPT_V34,
  TILE_TYPES_V34,
  WAVE_MAX_V34,
} from './migrations/v34';
import { AUTUMN, DAY, WINTER } from './test-helpers';
import type { GameState } from './types';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v33-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('33 → 34: memória, presságios e fronteira da Horda (V4E-T3)', () => {
  it('os números escritos na forma são os do conteúdo de hoje', () => {
    // Mudar um deles no conteúdo pede versão nova do estado (a forma 34 é congelada).
    expect(TILE_TYPES_V34).toEqual([...TILE_TYPE_IDS]);
    expect(ENEMIES_V34).toEqual([...ENEMY_IDS]);
    expect(OMENS_KEPT_V34).toBe(balance.omens.kept);
    expect(OMEN_ROUND_TO_V34).toBe(balance.omens.roundTo);
    const posts = WING_IDS.length * LINE_IDS.length;
    expect(MEMORY_MAX_V34).toBe(
      posts * Math.max(balance.army.postMax, balance.army.postMaxFromLevel.max),
    );
    const factors = Object.values(balance.difficulties).map((d) => d.siegeFactor);
    const largest = Math.max(
      ...hordeWaves.flatMap((wave) =>
        factors.map(
          ({ num, den }) =>
            Math.floor((wave.baseCount * num) / den) +
            wave.fixed.filter((post) => post.extra).reduce((sum, post) => sum + post.count, 0),
        ),
      ),
    );
    expect(WAVE_MAX_V34).toBe(largest);
  });

  it.each(Object.entries(fixtures))(
    '%s: só acrescenta a memória vazia, sem alterar a entrada, os recursos ou o sorteio',
    (_, raw) => {
      const before = JSON.parse(raw) as Record<string, unknown>;
      const copy = JSON.stringify(before);
      const state = v33ToV34.migrate(before, {
        boundaryMs: before.lastProcessedAt as number,
        timeScale: 1,
      });
      expect(state).toEqual({
        ...before,
        schemaVersion: 34,
        horde: { ...(before.horde as object), lastFormationSeen: null, omens: [], wavePlan: null },
      });
      expect(JSON.stringify(before)).toBe(copy);
      expect(state.rng).toEqual(before.rng);
      expect(state.ids).toEqual(before.ids);
      expect(stateV34(state, '')).toBeNull();
    },
  );

  it.each([AUTUMN + DAY / 2, WINTER + DAY / 2])(
    'a Fortaleza chega na primeira virada após a fronteira %s, sem recalcular o passado',
    (atMs) => {
      const raw = fixtures['./__fixtures__/state-v33-fresh.json']!;
      const before = JSON.parse(raw) as GameState;
      before.lastProcessedAt = atMs;
      before.clock.gameTimeMs = atMs;
      before.horde.scheduledRaids = [];
      before.settlement.buildings.watchtower = 1;
      const migrated = migrateState(before, { timeScale: 1 });
      expect(migrated.horde.wavePlan).toBeNull();
      const quiet = advanceTo(migrated, atMs + 1);
      expect(quiet.state.horde.wavePlan).toBeNull();
      expect(quiet.state.rng).toEqual(migrated.rng);
      const turn = (Math.floor(atMs / DAY) + 1) * DAY;
      const whole = advanceTo(migrated, turn);
      const split = advanceTo(quiet.state, turn);
      expect(split.state).toEqual(whole.state);
      expect([...quiet.events, ...split.events]).toEqual(whole.events);
      expect(whole.state.horde.wavePlan?.generatedAtMs).toBe(turn);
      expect(whole.events.filter((e) => e.type === 'fortressAppeared')).toHaveLength(1);
      expect(currentShape(whole.state, '')).toBeNull();
    },
  );

  it('recusa memória incoerente, presságios demais ou com outra revisão e alterações na onda revelada', () => {
    const raw = fixtures['./__fixtures__/state-v33-fresh.json']!;
    const state = migrateState(JSON.parse(raw), { timeScale: 1 });
    state.settlement.buildings.watchtower = 5;
    const prepared = advanceTo(state, AUTUMN + 12 * DAY).state;
    expect(prepared.horde.omens.length).toBeGreaterThan(0);
    const broken = (edit: (copy: GameState) => void) => {
      const copy = JSON.parse(JSON.stringify(prepared)) as GameState;
      edit(copy);
      return currentShape(copy, '');
    };
    expect(
      broken((s) => {
        s.horde.lastFormationSeen = { total: 3, byUnit: { archer: 2 } };
      }),
    ).not.toBeNull();
    expect(
      broken((s) => {
        while (s.horde.omens.length <= 6) s.horde.omens.push(s.horde.omens[0]!);
      }),
    ).not.toBeNull();
    expect(
      broken((s) => {
        s.horde.omens[0]!.revision += 1;
      }),
    ).not.toBeNull();
    expect(
      broken((s) => {
        s.horde.omens[0]!.reveals[0]!.count += 1;
      }),
    ).not.toBeNull();
    // O PostgreSQL pode reordenar as chaves de objetos; isso não muda um fato revelado.
    const reordered = JSON.parse(JSON.stringify(prepared), (_, value: unknown) => {
      if (value !== null && typeof value === 'object' && !Array.isArray(value))
        return Object.fromEntries(Object.entries(value).reverse());
      return value;
    }) as GameState;
    expect(currentShape(reordered, '')).toBeNull();
  });
});
