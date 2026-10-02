import { DIFFICULTY_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from './migrations';
import { createInitialState } from './state';
import { settings } from './test-helpers';
import type { GameSettings } from './types';
import { deriveViewState } from './view';

describe('createInitialState', () => {
  it('grava as escolhas da criação, na versão atual e sem fronteira de atualização', () => {
    const state = createInitialState('semente', {
      ...settings,
      difficulty: 'ironKing',
      timeScale: 3,
    });
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.migratedAtMs).toBeNull();
    expect(state.settings).toStrictEqual({
      settlementName: 'Pedra Alta',
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 20,
      difficulty: 'ironKing',
      timeScale: 3,
    });
    expect(state.settlement.name).toBe('Pedra Alta');
  });

  it('mesma semente e mesmas escolhas, mesmo estado', () => {
    expect(createInitialState('semente', settings)).toStrictEqual(
      createInitialState('semente', settings),
    );
  });

  it.each(DIFFICULTY_IDS)('aceita a dificuldade %s', (difficulty) => {
    expect(createInitialState('s', { ...settings, difficulty }).settings.difficulty).toBe(
      difficulty,
    );
  });

  it('só guarda os campos que conhece', () => {
    const noisy = { ...settings, capsEnabled: false, vows: ['ferro'] } as GameSettings;
    expect(Object.keys(createInitialState('s', noisy).settings).sort()).toEqual([
      'difficulty',
      'settlementName',
      'timeScale',
      'timezone',
      'vigilHourLocal',
    ]);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, '3'])('recusa o ritmo %s', (timeScale) => {
    expect(() => createInitialState('s', { ...settings, timeScale: timeScale as number })).toThrow(
      /Ritmo inválido/,
    );
  });

  it('recusa uma dificuldade desconhecida', () => {
    expect(() =>
      createInitialState('s', { ...settings, difficulty: 'normal' as GameSettings['difficulty'] }),
    ).toThrow(/Dificuldade desconhecida/);
  });
});

describe('o ritmo gravado na partida', () => {
  it('é o que a visão usa quando ninguém informa outro', () => {
    const normal = createInitialState('s', settings);
    const fast = createInitialState('s', { ...settings, timeScale: 3 });
    const slow = createInitialState('s', { ...settings, timeScale: 0.5 });
    // O dia de jogo dura 2 h de jogo: 2 h reais no ritmo 1, 40 min no 3 e 4 h no 0,5.
    expect(deriveViewState(normal, 0).calendar.secondsToNextDay).toBe(7200);
    expect(deriveViewState(fast, 0).calendar.secondsToNextDay).toBe(2400);
    expect(deriveViewState(slow, 0).calendar.secondsToNextDay).toBe(14_400);
    // O estado de jogo é o mesmo nos três: só o ritmo gravado difere.
    expect({ ...fast, settings: normal.settings }).toStrictEqual(normal);
  });

  it('cede a `options.timeScale`, para ver o mesmo estado em outro ritmo', () => {
    const fast = createInitialState('s', { ...settings, timeScale: 3 });
    expect(deriveViewState(fast, 0, { timeScale: 1 })).toStrictEqual(
      deriveViewState(createInitialState('s', settings), 0),
    );
  });

  it('um ritmo inválido informado à visão é recusado', () => {
    const state = createInitialState('s', settings);
    expect(() => deriveViewState(state, 0, { timeScale: 0 })).toThrow(/Ritmo inválido/);
  });
});
