import { describe, expect, it } from 'vitest';

import { armyIdleView, armyTrainingView } from '../test-helpers';
import {
  armyTreeLine,
  batchAmount,
  disbandLine,
  lacksDefense,
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
  it('"Treinar": a tropa, o custo do lote e o prazo vêm da visão, sem conta no app', () => {
    const offer = army.offer.find((entry) => entry.unit === 'spearman');
    const five = offer?.options.find((entry) => entry.amount === 5);
    if (five === undefined) {
      throw new Error('A visão de exemplo deixou de ter o lote de 5 Lanceiros.');
    }
    expect(trainLine(army, spearman, 5)).toBe(`Treinar ${five.label}: ${five.costText}, em 10 min`);
    // Fora da faixa da visão, só a unidade e a quantidade.
    expect(trainLine(army, spearman, 99)).toBe('Treinar Lanceiro × 99');
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
    expect(armyTreeLine(armyIdleView.army, 0)).toBe('Nv2 · 3/40 soldados · sem Defesa ativa');
    expect(armyTreeLine({ ...army, built: false }, 0)).toBe('não erguido');
    const line = armyTreeLine(armyTrainingView.army, 0);
    expect(line).toContain('treinando 4 arqueiros');
    expect(line).toContain('termina em 10 min');
  });

  it('a linha da árvore diz a Defesa ativa pelo nome da visão; sem soldados não avisa', () => {
    const formation = {
      id: 'f1',
      name: 'Muro',
      isActive: true,
      posts: [],
      commanders: [],
      total: 3,
      shortfall: [],
      shortfallText: '',
      canDelete: false,
      previewStale: false,
    };
    const withDefense = { ...army, formations: [formation] };
    expect(armyTreeLine(withDefense, 0)).toBe('Nv2 · 3/40 soldados · Defesa: Muro');
    expect(lacksDefense(withDefense)).toBe(false);
    expect(lacksDefense(army)).toBe(true);
    expect(lacksDefense({ ...army, total: 0 })).toBe(false);
    expect(armyTreeLine({ ...army, total: 0 }, 0)).toBe('Nv2 · 0/40 soldados');
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
