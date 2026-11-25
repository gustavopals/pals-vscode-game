import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { CURRENT_SCHEMA_VERSION, currentShape, migrateState } from './migrations';
import { v38ToV39 } from './migrations/v38';
import { accept, campaignYard, command } from './test-helpers';
import type { GameState } from './types';

const frozen = import.meta.glob<string>('./__fixtures__/state-v38-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});
const fixture = (scenario: string): Record<string, unknown> =>
  JSON.parse(frozen[`./__fixtures__/state-v38-${scenario}.json`]!) as Record<string, unknown>;
const clone = (state: GameState): GameState => JSON.parse(JSON.stringify(state)) as GameState;

const marching = () =>
  accept(campaignYard(), command('attackCamp', { formationId: 'formation-1' })).state;

function rejected(edit: (state: GameState) => void, state = marching()): void {
  const altered = clone(state);
  edit(altered);
  expect(currentShape(altered, '')).not.toBeNull();
  expect(() => migrateState(altered, { timeScale: 1 })).toThrow();
}

describe('campanha: migração 38 → 39 e guarda persistida', () => {
  it.each(['fresh', 'horde-omens-exact', 'hero-injured', 'migrated-3x'])(
    'migra %s sem mover tropas, alterar sorteios ou criar prazo',
    (scenario) => {
      const before = fixture(scenario);
      const copy = JSON.stringify(before);
      const result = migrateState(before, { timeScale: 1 });
      expect(result.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(result.army.campaign).toBeNull();
      expect(result.army).toEqual({ ...(before.army as object), campaign: null });
      expect(result.rng).toEqual(before.rng);
      expect(result.ids).toEqual({ ...(before.ids as object), outpost: 0 });
      expect(result.guild).toEqual(before.guild);
      expect(result.lastProcessedAt).toBe(before.lastProcessedAt);
      expect(JSON.stringify(before)).toBe(copy);
      expect(migrateState(result, { timeScale: 1 })).toBe(result);
      expect(
        v38ToV39.migrate(before, { timeScale: 1, boundaryMs: Number(before.lastProcessedAt) }),
      ).toEqual({
        ...before,
        schemaVersion: 39,
        army: { ...(before.army as object), campaign: null },
      });
    },
  );

  it('aceita a ida, a volta com vitória ou derrota e o retorno já concluído após JSON', () => {
    for (const strong of [true, false]) {
      const state = accept(
        campaignYard(0, strong),
        command('attackCamp', { formationId: 'formation-1' }),
      ).state;
      const at = state.army.campaign!.battleAtMs;
      for (const point of [state, advanceTo(state, at).state, advanceTo(state, at * 2).state]) {
        expect(currentShape(clone(point), '')).toBeNull();
        expect(migrateState(clone(point), { timeScale: 1 })).toEqual(point);
      }
    }
  });

  it('recusa ausência do campo, reserva exagerada, comandante solto, órfão e posto inválido', () => {
    rejected((state) => {
      delete (state.army as Partial<GameState['army']>).campaign;
    });
    rejected((state) => {
      state.army.units.swordsman = 1;
    });
    rejected((state) => {
      state.guild.heroes[0]!.status = 'idle';
    });
    rejected((state) => {
      state.army.campaign = null;
    });
    rejected((state) => {
      state.army.campaign!.formation.posts.center.front!.unit = 'archer';
    });
    rejected((state) => {
      state.army.campaign!.formation.commanders.left = 'hero-1';
    });
    rejected((state) => {
      state.army.campaign!.formationId = 'formation-999';
    });
    rejected((state) => {
      state.army.campaign!.tile = 'wolfDen';
    });
  });

  it('recusa prazos vencidos, relatório adiantado e baixas que não são da tropa enviada', () => {
    rejected((state) => {
      state.army.campaign!.battleAtMs = 0;
    });
    rejected((state) => {
      state.army.campaign!.returnsAtMs = 0;
    });
    const state = marching();
    const at = advanceTo(state, state.army.campaign!.battleAtMs).state;
    rejected((state) => {
      state.army.campaign!.report = null;
    }, at);
    rejected((state) => {
      state.army.campaign!.battleAtMs += 1;
    }, at);
    rejected((state) => {
      state.army.campaign!.report = { ...state.army.campaign!.report!, mode: 'defense' };
    }, at);
    rejected((state) => {
      state.army.campaign!.report = { ...state.army.campaign!.report!, casualties: [] };
    }, at);
  });
});
