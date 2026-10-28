import { describe, expect, it } from 'vitest';

import { currentShape, migrateState, StateMigrationError } from './migrations';
import { stateV36, v36ToV37 } from './migrations/v36';
import { addHero, quietGame, DAY } from './test-helpers';

const fixtures = import.meta.glob<string>('./__fixtures__/state-v36-*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

describe('36 → 37: encontros e próxima rotação da Taverna', () => {
  it.each(Object.entries(fixtures))(
    '%s: só acrescenta o marcador desligado, sem sortear ou criar prazo',
    (_, raw) => {
      const before = JSON.parse(raw);
      expect(stateV36(before, '')).toBeNull();
      const after = v36ToV37.migrate(before, { timeScale: 1, boundaryMs: before.lastProcessedAt });
      expect(after).toEqual({
        ...before,
        schemaVersion: 37,
        guild: { ...before.guild, tavern: { ...before.guild.tavern, extraOffer: false } },
      });
      expect(currentShape(after, '')).toBeNull();
      expect(JSON.stringify(before)).toBe(JSON.stringify(JSON.parse(raw)));
      const loaded = migrateState(before, { timeScale: 1 });
      expect(loaded.migratedAtMs).toBe(before.lastProcessedAt);
      expect(migrateState(loaded, { timeScale: 1 })).toBe(loaded);
    },
  );

  it('recusa marcador ausente ou inválido e valida participantes mesmo depois da partida do herói', () => {
    const state = quietGame();
    addHero(state, { name: 'Ada' });
    state.council.pending = [
      {
        instanceId: 'gamblingDebt-1',
        cardId: 'gamblingDebt',
        drawnAtMs: 0,
        expiresAtMs: DAY,
        origin: null,
        heroes: [{ id: 'hero-1', name: 'Ada' }],
      },
    ];
    state.guild.heroes = [];
    expect(currentShape(state, '')).toBeNull();
    expect(
      currentShape(
        { ...state, guild: { ...state.guild, tavern: { ...state.guild.tavern, extraOffer: 1 } } },
        '',
      ),
    ).not.toBeNull();
    expect(
      currentShape(
        {
          ...state,
          guild: { ...state.guild, tavern: { ...state.guild.tavern, extraOffer: true } },
        },
        '',
      ),
    ).not.toBeNull();
    for (const targets of [
      undefined,
      [],
      null,
      [{ id: 'hero-2', name: 'Ada' }],
      [{ id: 'hero-1', name: '' }],
      [{ id: 'hero-1', name: 'Ada', extra: 1 }],
      [
        { id: 'hero-1', name: 'Ada' },
        { id: 'hero-1', name: 'Ada' },
      ],
    ]) {
      const pending = { ...state.council.pending[0], heroes: targets };
      const bad = { ...state, council: { ...state.council, pending: [pending] } };
      expect(() => migrateState(bad, { timeScale: 1 })).toThrow(StateMigrationError);
    }
    const missing = JSON.parse(JSON.stringify(state));
    delete missing.guild.tavern.extraOffer;
    expect(() => migrateState(missing, { timeScale: 1 })).toThrow(StateMigrationError);
    delete missing.council.pending[0].heroes;
    missing.guild.tavern.extraOffer = false;
    expect(() => migrateState(missing, { timeScale: 1 })).toThrow(StateMigrationError);
  });
});
