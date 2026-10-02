import { balance, DIFFICULTY_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { paceLabel, yearInRealTime } from './pace';
import { createInitialState } from './state';
import { accept, command, settings } from './test-helpers';
import { deriveViewState } from './view';

describe('yearInRealTime: quanto dura o ano de jogo no relógio do jogador', () => {
  it('nos ritmos oferecidos, a conta dá a frase que o conteúdo escreve', () => {
    for (const pace of balance.paces) {
      expect(yearInRealTime(pace.timeScale), pace.label).toBe(pace.description);
    }
  });

  it.each([
    // O ano de jogo tem 168 h. Múltiplo exato de 24 h sai em dias.
    [7, 'um ano em 1 dia'],
    [3.5, 'um ano em 2 dias'],
    [0.25, 'um ano em 28 dias'],
    // 0,7 não tem representação exata em ponto flutuante: 168 ÷ 0,7 ainda são 10 dias.
    [0.7, 'um ano em 10 dias'],
    // Menos de três dias, em horas e minutos; daí em diante, em dias e horas.
    [168, 'um ano em 1 hora'],
    [4, 'um ano em 42 horas'],
    [2.5, 'um ano em 67 horas e 12 minutos'],
    [10, 'um ano em 16 horas e 48 minutos'],
    [9, 'um ano em 18 horas e 40 minutos'],
    [2, 'um ano em 3 dias e 12 horas'],
    [1.5, 'um ano em 4 dias e 16 horas'],
    // Quando a frase arredonda (minutos quebrados, ou minutos em um prazo de dias), ela avisa.
    [11, 'um ano em cerca de 15 horas e 16 minutos'],
    [0.9, 'um ano em cerca de 7 dias e 19 horas'],
    [0.999, 'um ano em cerca de 7 dias'],
    // Ritmos de laboratório: menos de uma hora.
    [336, 'um ano em 30 minutos'],
    [10_080, 'um ano em 1 minuto'],
    [1_000_000, 'um ano em menos de 1 minuto'],
  ])('ritmo %s: %s', (timeScale, expected) => {
    expect(yearInRealTime(timeScale)).toBe(expected);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('recusa o ritmo %s', (timeScale) => {
    expect(() => yearInRealTime(timeScale)).toThrow(/Ritmo inválido/);
  });
});

describe('paceLabel', () => {
  it('ritmo oferecido: o rótulo e a descrição do conteúdo', () => {
    expect(balance.paces.map((pace) => paceLabel(pace.timeScale))).toEqual([
      'Rápido: um ano em 56 horas',
      'Normal: um ano em 7 dias',
      'Tranquilo: um ano em 14 dias',
    ]);
  });

  it('ritmo fora da lista (partida antiga, outro GAME_TIME_SCALE): rótulo honesto, pela conta', () => {
    expect(paceLabel(2)).toBe('Ritmo 2×: um ano em 3 dias e 12 horas');
    expect(paceLabel(7)).toBe('Ritmo 7×: um ano em 1 dia');
    expect(paceLabel(0.75)).toBe('Ritmo 0,75×: um ano em 9 dias e 8 horas');
    expect(paceLabel(10)).toBe('Ritmo 10×: um ano em 16 horas e 48 minutos');
  });
});

describe('ViewState.settlement: dificuldade e ritmo da partida', () => {
  it('partida padrão dos testes: Senhor, ritmo Normal', () => {
    expect(deriveViewState(createInitialState('s', settings), 0).settlement).toEqual({
      name: 'Pedra Alta',
      townHallLevel: 1,
      difficulty: 'lord',
      difficultyLabel: 'Senhor',
      paceLabel: 'Normal: um ano em 7 dias',
    });
  });

  it.each(DIFFICULTY_IDS)('dificuldade %s: o id e o rótulo do conteúdo', (difficulty) => {
    const view = deriveViewState(createInitialState('s', { ...settings, difficulty }), 0);
    expect(view.settlement.difficulty).toBe(difficulty);
    expect(view.settlement.difficultyLabel).toBe(balance.difficulties[difficulty].label);
  });

  it('o ritmo vem do estado quando ninguém informa outro', () => {
    const labelAt = (timeScale: number) =>
      deriveViewState(createInitialState('s', { ...settings, timeScale }), 0).settlement.paceLabel;
    expect(labelAt(3)).toBe('Rápido: um ano em 56 horas');
    expect(labelAt(1)).toBe('Normal: um ano em 7 dias');
    expect(labelAt(0.5)).toBe('Tranquilo: um ano em 14 dias');
    expect(labelAt(7)).toBe('Ritmo 7×: um ano em 1 dia');
  });

  it('o rótulo acompanha o ritmo em que os prazos da visão foram escritos', () => {
    const fast = createInitialState('s', { ...settings, timeScale: 3 });
    const seen = deriveViewState(fast, 0, { timeScale: 0.5 });
    // Quem pede a visão em outro ritmo recebe prazos e rótulo desse ritmo, coerentes entre si.
    expect(seen.settlement.paceLabel).toBe('Tranquilo: um ano em 14 dias');
    expect(seen.calendar.secondsToNextDay).toBe(4 * 3600);
  });

  it('dificuldade e ritmo não mudam com o tempo nem com ordens', () => {
    const start = createInitialState('s', { ...settings, difficulty: 'ironKing', timeScale: 3 });
    const before = deriveViewState(start, 0).settlement;
    expect(before).toMatchObject({
      difficulty: 'ironKing',
      difficultyLabel: 'Rei de Ferro',
      paceLabel: 'Rápido: um ano em 56 horas',
    });
    const renamed = accept(start, command('renameSettlement', { name: 'Vale Fundo' })).state;
    const later = deriveViewState(renamed, 400 * 3_600_000).settlement;
    expect(later).toEqual({ ...before, name: 'Vale Fundo' });
  });
});
