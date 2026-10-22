import { describe, expect, it } from 'vitest';

import { armyIdleView, armyTrainingView } from '../test-helpers';
import {
  armyTreeLine,
  batchAmount,
  disbandLine,
  offerOf,
  parseSoldiers,
  trainLine,
  trainingDeadline,
  trainingEndsLine,
  unitOf,
} from './army';

/**
 * O Quartel como texto (V4C-T3.2). Nada aqui confere regra: o custo, o prazo e o lote máximo são
 * os da visão, e as linhas só os dispõem.
 */
const { army } = armyIdleView;
const spearman = unitOf(army, 'spearman');
if (spearman === undefined) {
  throw new Error('A visão de exemplo deixou de ter o Lanceiro.');
}

describe('as linhas do Quartel', () => {
  it('"Treinar": o custo de um soldado repetido, sem soma, e o prazo de cada um', () => {
    expect(trainLine(spearman, 1)).toBe(
      `Treinar Lanceiro × 1: ${spearman.costText}, cada um em 2 min`,
    );
    expect(trainLine(spearman, 5)).toBe(
      `Treinar Lanceiro × 5: 5 × (${spearman.costText}), cada um em 2 min`,
    );
  });

  it('"Dispensar" diz a unidade e a quantidade', () => {
    expect(disbandLine(spearman, 3)).toBe('Dispensar Lanceiro × 3');
  });

  it('o lote só vale de 1 até o máximo da visão', () => {
    expect(batchAmount(army, 'spearman', parseSoldiers('4'))).toBe(4);
    expect(batchAmount(army, 'spearman', parseSoldiers('0'))).toBeNull();
    expect(batchAmount(army, 'spearman', parseSoldiers('7'))).toBeNull();
    expect(batchAmount(army, 'spearman', parseSoldiers('abc'))).toBeNull();
    expect(offerOf(army, 'knight')?.batchMax).toBe(10);
  });

  it('a linha da árvore: sem Quartel, com soldados e com lote', () => {
    expect(armyTreeLine(armyIdleView.army, 0)).toBe('Nv2 · 3/40 soldados');
    expect(armyTreeLine({ ...army, built: false }, 0)).toBe('não erguido');
    const line = armyTreeLine(armyTrainingView.army, 0);
    expect(line).toContain('treinando 4 arqueiros');
    expect(line).toContain('termina em 10 min');
  });

  it('o fim do lote desconta o tempo desde a visão, e o prazo sai para o ciclo de leitura', () => {
    const training = armyTrainingView.army.training;
    if (training === null) {
      throw new Error('esperava o lote');
    }
    expect(trainingEndsLine(training, 590)).toBe('termina em 10 s');
    expect(trainingEndsLine(training, 700)).toBe('termina agora');
    expect(trainingDeadline(armyTrainingView.army)).toBe(600);
    expect(trainingDeadline(army)).toBeNull();
  });
});
