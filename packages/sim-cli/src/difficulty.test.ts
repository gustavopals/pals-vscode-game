import { DIFFICULTY_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { parseCli } from './cli';
import { formatSummary } from './report';
import { simulate } from './simulate';

const base = {
  seed: 'pedra-alta-golden',
  days: 1,
  strategy: 'economico',
  sessionsPerDay: 2,
} as const;

describe('dificuldade da simulação', () => {
  it('sem a opção, a partida é de Senhor', async () => {
    const result = await simulate(base);
    expect(result.finalState.settings.difficulty).toBe('lord');
    expect(result.game).toEqual({
      difficultyLabel: 'Senhor',
      paceLabel: 'Normal: um ano em 7 dias',
    });
  });

  it.each(DIFFICULTY_IDS)('%s fica gravada na partida simulada', async (difficulty) => {
    const result = await simulate({ ...base, difficulty });
    expect(result.finalState.settings.difficulty).toBe(difficulty);
  });

  it.each([
    ['peasant', 625],
    ['lord', 500],
    ['ironKing', 400],
  ] as const)(
    '%s: o estoque de madeira para no limite da dificuldade (%i)',
    async (difficulty, cap) => {
      // Três dias reais com o bot econômico: ninguém ergueu o Armazém, e a madeira encheu o Pátio.
      const result = await simulate({ ...base, days: 3, difficulty });
      const last = result.rows.at(-1);
      expect(last?.levels.warehouse).toBe(0);
      expect(Math.max(...result.rows.map((row) => row.stock.wood))).toBe(cap);
      expect(result.rows.every((row) => row.stock.wood <= cap && row.stock.stone <= cap)).toBe(
        true,
      );
      expect(last?.wasted.wood).toBeGreaterThan(0);
    },
  );

  it('o resumo diz a dificuldade e o ritmo como o jogo os mostra ao jogador', async () => {
    const result = await simulate({ ...base, difficulty: 'ironKing', timeScale: 3 });
    const lines = formatSummary(result).split('\n');
    expect(lines[0]).toBe(
      'Semente pedra-alta-golden · estratégia economico · 1 dias · 2 sessões/dia · ritmo 3×',
    );
    expect(lines[1]).toBe('Partida: Rei de Ferro · Rápido: um ano em 56 horas');
    // Um ritmo que o jogo não oferece aparece com o rótulo honesto que a visão dá.
    const odd = await simulate({ ...base, timeScale: 2 });
    expect(formatSummary(odd)).toContain(
      'Partida: Senhor · Ritmo 2×: um ano em 3 dias e 12 horas\n',
    );
  });

  it('uma dificuldade desconhecida é recusada pelo motor', async () => {
    await expect(simulate({ ...base, difficulty: 'normal' as 'lord' })).rejects.toThrow(
      /Dificuldade desconhecida/,
    );
  });
});

describe('linha de comando: --difficulty', () => {
  it('o padrão é lord; as três do conteúdo são aceitas', () => {
    expect(parseCli(['--seed', 's'])).toMatchObject({ options: { difficulty: 'lord' } });
    for (const difficulty of DIFFICULTY_IDS) {
      expect(parseCli(['--seed', 's', '--difficulty', difficulty])).toMatchObject({
        mode: 'simulate',
        options: { difficulty },
      });
    }
  });

  it('recusa uma dificuldade desconhecida, dizendo quais existem', () => {
    expect(() => parseCli(['--seed', 's', '--difficulty', 'normal'])).toThrow(
      'Dificuldade desconhecida: normal. Disponíveis: peasant, lord, ironKing.',
    );
    expect(() => parseCli(['--seed', 's', '--difficulty'])).toThrow(
      'A opção --difficulty pede um valor.',
    );
  });

  it('não vale nos modos que falam com um servidor', () => {
    expect(() => parseCli(['--remote', 'http://localhost:3000', '--difficulty', 'lord'])).toThrow(
      '--difficulty não vale com --remote.',
    );
    expect(() => parseCli(['--smoke', 'http://localhost:3000', '--difficulty', 'lord'])).toThrow(
      '--difficulty não vale com --smoke.',
    );
  });
});
