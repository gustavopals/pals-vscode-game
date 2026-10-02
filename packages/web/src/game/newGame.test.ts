import { CatalogResponseSchema } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { catalogFixture } from '../test-helpers';
import {
  choiceSummary,
  difficultyDescription,
  difficultyLine,
  paceLine,
  resolveChoice,
} from './newGame';

const options = catalogFixture().newGame;
const [peasant, lord, ironKing] = options.difficulties;
const [fast, normal, calm] = options.paces;

describe('opções de nova partida', () => {
  it('o catálogo de exemplo dos testes tem a forma que o protocolo exige', () => {
    expect(CatalogResponseSchema.safeParse(catalogFixture()).success).toBe(true);
    expect(
      CatalogResponseSchema.safeParse(catalogFixture({ difficulty: 'lord', timeScale: 1 })).success,
    ).toBe(true);
  });

  it('a linha de cada opção é o rótulo do servidor, com a marca de recomendada', () => {
    expect(options.difficulties.map(difficultyLine)).toEqual([
      'Camponês',
      'Senhor (recomendado)',
      'Rei de Ferro',
    ]);
    // GDD §13.9: "Rápido: um ano em 56 horas (recomendado)".
    expect(options.paces.map(paceLine)).toEqual([
      'Rápido: um ano em 56 horas (recomendado)',
      'Normal: um ano em 7 dias',
      'Tranquilo: um ano em 14 dias',
    ]);
  });

  it('sem escolha do jogador, vale o que o servidor traz marcado', () => {
    expect(resolveChoice(options)).toEqual({ difficulty: 'lord', timeScale: 3 });
    expect(resolveChoice(options, {})).toEqual({ difficulty: 'lord', timeScale: 3 });
  });

  it('o marcado é o padrão do servidor, não o recomendado', () => {
    // O servidor de testes roda no ritmo Normal: o Rápido continua recomendado, mas não marcado.
    const testServer = catalogFixture({ difficulty: 'lord', timeScale: 1 }).newGame;
    expect(resolveChoice(testServer)).toEqual({ difficulty: 'lord', timeScale: 1 });
    expect(testServer.paces.find((pace) => pace.recommended)?.timeScale).toBe(3);
  });

  it('a escolha do jogador vale, uma de cada vez', () => {
    expect(resolveChoice(options, { difficulty: 'ironKing' })).toEqual({
      difficulty: 'ironKing',
      timeScale: 3,
    });
    expect(resolveChoice(options, { timeScale: 0.5 })).toEqual({
      difficulty: 'lord',
      timeScale: 0.5,
    });
    expect(resolveChoice(options, { difficulty: 'peasant', timeScale: 1 })).toEqual({
      difficulty: 'peasant',
      timeScale: 1,
    });
  });

  it('uma escolha que saiu das opções volta ao padrão: nada fora da lista vai ao servidor', () => {
    const fewer = {
      ...options,
      difficulties: [lord, ironKing].filter((entry) => entry !== undefined),
      paces: [fast, normal].filter((entry) => entry !== undefined),
    };
    expect(resolveChoice(fewer, { difficulty: 'peasant', timeScale: 0.5 })).toEqual({
      difficulty: 'lord',
      timeScale: 3,
    });
    // Um ritmo que nunca foi oferecido também não passa.
    expect(resolveChoice(options, { timeScale: 2 }).timeScale).toBe(3);
  });

  it('o resumo junta a dificuldade e o ritmo com os textos do servidor', () => {
    expect(choiceSummary(options, { difficulty: 'ironKing', timeScale: 0.5 })).toBe(
      'Rei de Ferro · Tranquilo: um ano em 14 dias',
    );
    expect(choiceSummary(options, resolveChoice(options))).toBe(
      'Senhor · Rápido: um ano em 56 horas',
    );
  });

  it('a frase da dificuldade de uma partida aberta vem do catálogo, quando ele chegou', () => {
    expect(difficultyDescription(options, 'peasant')).toBe(peasant?.description);
    expect(difficultyDescription(options, 'lord')).toBe(lord?.description);
    expect(difficultyDescription(null, 'lord')).toBeNull();
    expect(difficultyDescription({ ...options, difficulties: [] }, 'lord')).toBeNull();
    expect(calm?.hint).toContain('uma vez por dia');
  });
});
