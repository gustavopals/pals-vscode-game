import { CatalogResponseSchema } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { catalogFixture } from '../test-helpers';
import {
  choiceSummary,
  difficultyDescription,
  difficultyLine,
  isScenarioLocked,
  paceLine,
  resolveChoice,
  scenarioLine,
  scenarioLockedText,
} from './newGame';

const options = catalogFixture().newGame;
const [peasant, lord, ironKing] = options.difficulties;
const [fast, normal, calm] = options.paces;
const [standard, ironRidge] = options.scenarios ?? [];

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
    expect(resolveChoice(options)).toEqual({
      difficulty: 'lord',
      timeScale: 3,
      scenario: 'standard',
    });
    expect(resolveChoice(options, {})).toEqual({
      difficulty: 'lord',
      timeScale: 3,
      scenario: 'standard',
    });
  });

  it('o marcado é o padrão do servidor, não o recomendado', () => {
    // O servidor de testes roda no ritmo Normal: o Rápido continua recomendado, mas não marcado.
    const testServer = catalogFixture({ difficulty: 'lord', timeScale: 1 }).newGame;
    expect(resolveChoice(testServer)).toEqual({
      difficulty: 'lord',
      timeScale: 1,
      scenario: 'standard',
    });
    expect(testServer.paces.find((pace) => pace.recommended)?.timeScale).toBe(3);
  });

  it('a escolha do jogador vale, uma de cada vez', () => {
    expect(resolveChoice(options, { difficulty: 'ironKing' })).toEqual({
      difficulty: 'ironKing',
      timeScale: 3,
      scenario: 'standard',
    });
    expect(resolveChoice(options, { timeScale: 0.5 })).toEqual({
      difficulty: 'lord',
      timeScale: 0.5,
      scenario: 'standard',
    });
    expect(resolveChoice(options, { difficulty: 'peasant', timeScale: 1 })).toEqual({
      difficulty: 'peasant',
      timeScale: 1,
      scenario: 'standard',
    });
    // Cenário trancado volta ao padrão; com Legado suficiente, a escolha vale.
    expect(resolveChoice(options, { scenario: 'ironRidge' }, 0).scenario).toBe('standard');
    expect(resolveChoice(options, { scenario: 'ironRidge' }, 199).scenario).toBe('standard');
    expect(resolveChoice(options, { scenario: 'ironRidge' }, 200).scenario).toBe('ironRidge');
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
      scenario: 'standard',
    });
    // Um ritmo que nunca foi oferecido também não passa.
    expect(resolveChoice(options, { timeScale: 2 }).timeScale).toBe(3);
  });

  it('o resumo junta dificuldade, ritmo e cenário com os textos do servidor', () => {
    expect(choiceSummary(options, { difficulty: 'ironKing', timeScale: 0.5 })).toBe(
      'Rei de Ferro · Tranquilo: um ano em 14 dias',
    );
    expect(choiceSummary(options, resolveChoice(options))).toBe(
      'Senhor · Rápido: um ano em 56 horas · Terras do Feudo',
    );
    expect(
      choiceSummary(options, { difficulty: 'lord', timeScale: 3, scenario: 'ironRidge' }),
    ).toBe('Senhor · Rápido: um ano em 56 horas · Serra do Ferro');
  });

  it('cenários: linha, trava por Legado e servidor anterior sem cenários (V5E-T4)', () => {
    expect(standard && scenarioLine(standard)).toBe('Terras do Feudo (recomendado)');
    expect(ironRidge && scenarioLine(ironRidge)).toBe('Serra do Ferro (200 de Legado)');
    expect(standard && isScenarioLocked(standard, 0)).toBe(false);
    expect(standard && isScenarioLocked(standard, null)).toBe(false);
    expect(ironRidge && isScenarioLocked(ironRidge, null)).toBe(true);
    expect(ironRidge && isScenarioLocked(ironRidge, 0)).toBe(true);
    expect(ironRidge && isScenarioLocked(ironRidge, 199)).toBe(true);
    expect(ironRidge && isScenarioLocked(ironRidge, 200)).toBe(false);
    expect(ironRidge && scenarioLockedText(ironRidge, 0)).toBe(
      'Requer 200 pontos de Legado na conta.',
    );
    expect(ironRidge && scenarioLockedText(ironRidge, 50)).toBe(
      'Requer 200 pontos de Legado na conta. Legado atual: 50.',
    );
    expect(ironRidge && scenarioLockedText(ironRidge, 200)).toBeNull();

    const { scenarios: _s, ...legacyCatalog } = options;
    void _s;
    const oldServer = {
      ...legacyCatalog,
      defaults: { difficulty: options.defaults.difficulty, timeScale: options.defaults.timeScale },
    };
    expect(resolveChoice(oldServer, { scenario: 'ironRidge' }, 500)).toEqual({
      difficulty: 'lord',
      timeScale: 3,
    });
  });

  it('a frase da dificuldade de uma partida aberta vem do catálogo, quando ele chegou', () => {
    expect(difficultyDescription(options, 'peasant')).toBe(peasant?.description);
    expect(difficultyDescription(options, 'lord')).toBe(lord?.description);
    expect(difficultyDescription(null, 'lord')).toBeNull();
    expect(difficultyDescription({ ...options, difficulties: [] }, 'lord')).toBeNull();
    expect(calm?.hint).toContain('uma vez por dia');
  });
});
