import type { ReturnReport, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { coldView, impoverishedView, initialView, proudView, unlockedView } from '../test-helpers';
import {
  bandIcon,
  moraleBurdened,
  moraleEffect,
  moraleExplanation,
  moraleHurts,
  moraleIcon,
  moraleLines,
  moraleNextSummary,
  moraleSince,
  moraleTitle,
  moraleTreeLine,
  moraleTrend,
  peopleMoved,
  reserveNote,
  termAmount,
} from './morale';

type Morale = ViewState['morale'];
const withMorale = (morale: Morale, patch: Partial<Morale>): Morale => ({ ...morale, ...patch });

describe('moral: o número, a faixa e o ícone', () => {
  it('o título é o número e a faixa que a visão traz', () => {
    expect(moraleTitle(initialView.morale)).toBe('Moral 50 (Contente)');
    expect(moraleTitle(impoverishedView.morale)).toBe('Moral 0 (Desesperado)');
    expect(moraleTitle(proudView.morale)).toBe('Moral 80 (Orgulhoso)');
    expect(moraleTitle({ value: 28, bandLabel: 'Inquieto' })).toBe('Moral 28 (Inquieto)');
  });

  it('cada faixa tem o seu ícone, e nenhum se repete', () => {
    const icons = (['desperate', 'restless', 'content', 'proud'] as const).map(moraleIcon);
    expect(icons).toEqual(['thumbsdown', 'comment-discussion', 'smiley', 'star-full']);
    expect(new Set(icons).size).toBe(4);
    // Nenhum é o da fome nem o do frio: a moral não se confunde com o que a derruba.
    expect(icons).not.toContain('warning');
    expect(icons).not.toContain('flame');
  });

  it('a faixa que vem em um evento só vira ícone se for uma faixa', () => {
    expect(bandIcon('restless')).toBe('comment-discussion');
    expect(bandIcon('proud')).toBe('star-full');
    expect(bandIcon('toString')).toBeUndefined();
    expect(bandIcon(undefined)).toBeUndefined();
    expect(bandIcon(3)).toBeUndefined();
  });

  it('o que a moral faz com a produção é o resto da frase do servidor', () => {
    expect(moraleEffect(initialView.morale)).toBe('não mexe na produção');
    expect(moraleEffect(coldView.morale)).toBe('produção × 1,05');
    expect(moraleEffect(impoverishedView.morale)).toBe('produção × 0,75');
    // Uma frase de outra forma não é adivinhada: fica só o número e a faixa.
    expect(moraleEffect(withMorale(coldView.morale, { text: 'O povo anda bem.' }))).toBeNull();
  });

  it('a moral tira produção quando o fator da visão é menor que um', () => {
    expect(moraleHurts(impoverishedView.morale)).toBe(true);
    expect(moraleHurts(initialView.morale)).toBe(false);
    expect(moraleHurts(proudView.morale)).toBe(false);
    expect(moraleHurts({ multiplierPercent: 99.5 })).toBe(true);
  });
});

describe('moral: a próxima virada do dia', () => {
  it('sobe, cai ou fica, comparando o número de agora com o da próxima virada', () => {
    expect(moraleTrend(initialView.morale)).toBe('rising');
    expect(moraleTrend(coldView.morale)).toBe('falling');
    expect(moraleTrend(impoverishedView.morale)).toBe('steady');
  });

  it('em poucas palavras, com a faixa só quando ela muda', () => {
    // 50 → 60, as duas em "Contente".
    expect(moraleNextSummary(initialView.morale)).toBe('sobe para 60');
    // 60 → 40: outra faixa.
    expect(moraleNextSummary(coldView.morale)).toBe('cai para 40 (Inquieto)');
    expect(moraleNextSummary(impoverishedView.morale)).toBeNull();
    expect(moraleNextSummary(proudView.morale)).toBeNull();
  });

  it('a árvore diz o número, a faixa e, quando muda, para onde: a queda leva o sinal', () => {
    expect(moraleTreeLine(impoverishedView.morale)).toBe('0 (Desesperado)');
    expect(moraleTreeLine(initialView.morale)).toBe('50 (Contente) · sobe para 60');
    expect(moraleTreeLine(coldView.morale)).toBe('60 (Contente) · ⚠ cai para 40 (Inquieto)');
  });

  it('a explicação junta as frases do servidor e o prazo da virada, que desce com o relógio', () => {
    expect(moraleLines(coldView.morale, 0)).toEqual([
      'Moral 60 (Contente): produção × 1,05.',
      'A moral só muda na virada do dia: na próxima, cai de 60 para 40 (Inquieto).',
      'A conta dessa virada, daqui a 30 min: 50 (base) + 10 (comida guardada para 24 h) − 20 (frio) = 40.',
      'O que mais pesa é o frio (−20). Ponha gente na Serraria: com lenha na lareira o frio passa, e a moral sobe na virada seguinte.',
    ]);
    expect(moraleExplanation(coldView.morale, 0)).toBe(moraleLines(coldView.morale, 0).join(' '));
    expect(moraleExplanation(coldView.morale, 600)).toContain('daqui a 20 min:');
    // Sem conselho, a explicação acaba na conta.
    expect(moraleLines(initialView.morale, 0)).toEqual([
      'Moral 50 (Contente): não mexe na produção.',
      'A moral só muda na virada do dia: na próxima, sobe de 50 para 60 (Contente).',
      'A conta dessa virada, daqui a 2 h: 50 (base) + 10 (comida guardada para 24 h) = 60.',
    ]);
    // A soma que passa do limite vem com o limite que a segurou.
    expect(moraleExplanation(impoverishedView.morale, 0)).toContain(
      '= −32; a moral não desce de 0.',
    );
  });

  it('o prazo é o da visão: em outro ritmo, o app não converte nada', () => {
    const fast = withMorale(coldView.morale, {
      nextUpdateInSeconds: 600,
      breakdown: '50 (base) + 10 (comida guardada para 8 h) − 20 (frio) = 40',
    });
    expect(moraleLines(fast, 0)[2]).toBe(
      'A conta dessa virada, daqui a 10 min: 50 (base) + 10 (comida guardada para 8 h) − 20 (frio) = 40.',
    );
  });
});

describe('moral: a conta e o conselho', () => {
  it('o primeiro termo é a base e vai sem sinal; os outros, com o sinal à frente', () => {
    expect(coldView.morale.terms.map((term, index) => termAmount(term.amount, index))).toEqual([
      '50',
      '+10',
      '−20',
    ]);
    expect(
      impoverishedView.morale.terms.map((term, index) => termAmount(term.amount, index)),
    ).toEqual(['50', '−20', '−42', '−20']);
  });

  it('algo pesa na conta quando há um termo negativo', () => {
    expect(moraleBurdened(coldView.morale)).toBe(true);
    expect(moraleBurdened(impoverishedView.morale)).toBe(true);
    expect(moraleBurdened(initialView.morale)).toBe(false);
    // Aqui o conselho é só o caminho para o bônus da comida.
    expect(moraleBurdened(unlockedView.morale)).toBe(false);
  });

  it('a frase da comida guardada não se repete quando o conselho já é ela', () => {
    expect(unlockedView.morale.advice).toBe(unlockedView.morale.foodReserve.text);
    expect(reserveNote(unlockedView.morale)).toBeNull();
    expect(reserveNote(proudView.morale)).toBeNull();
    // Com outro conselho, ou sem conselho, a frase aparece.
    expect(reserveNote(coldView.morale)).toBe(
      'Há comida guardada para 24 h (432 para 18 habitantes): a moral ganha 10.',
    );
    expect(reserveNote(initialView.morale)).toBe(
      'Há comida guardada para 24 h (120 para 5 habitantes): a moral ganha 10.',
    );
  });
});

describe('moral: o Relatório de Retorno', () => {
  const now = { value: 28, band: 'restless', bandLabel: 'Inquieto' } as const;
  const content = { value: 60, band: 'content', bandLabel: 'Contente' } as const;

  it('diz a faixa de agora e de onde ela veio', () => {
    expect(moraleSince({ ...now, before: content })).toBe(
      'Moral 28 (Inquieto): caiu de 60 (Contente).',
    );
    expect(moraleSince({ ...content, before: now })).toBe(
      'Moral 60 (Contente): subiu de 28 (Inquieto).',
    );
    expect(moraleSince({ ...content, before: content })).toBe(
      'Moral 60 (Contente), como na sua última visita.',
    );
    // Sem a visão guardada não há de onde: só a de agora.
    expect(moraleSince(content)).toBe('Moral 60 (Contente).');
  });

  it('quem chegou sozinho e quem se foi, cada frase com o seu porquê', () => {
    const counts = (patch: Partial<ReturnReport['counts']>): ReturnReport['counts'] => ({
      daysPassed: 3,
      constructionsFinished: 0,
      villagersArrived: 2,
      objectivesCompleted: 0,
      ...patch,
    });
    // Os recrutados não entram aqui: têm a sua linha nas contagens.
    expect(peopleMoved(counts({}))).toEqual({ gained: [], lost: [] });
    expect(
      peopleMoved(counts({ settlersArrived: 0, villagersLeft: 0, villagersDeserted: 0 })),
    ).toEqual({ gained: [], lost: [] });
    expect(peopleMoved(counts({ settlersArrived: 1 }))).toEqual({
      gained: ['Chegou 1 colono sem ninguém chamar: a moral alta atrai gente.'],
      lost: [],
    });
    expect(peopleMoved(counts({ settlersArrived: 2 })).gained).toEqual([
      'Chegaram 2 colonos sem ninguém chamar: a moral alta atrai gente.',
    ]);
    expect(peopleMoved(counts({ villagersLeft: 1, villagersDeserted: 2 }))).toEqual({
      gained: [],
      lost: [
        'Partiu 1 aldeão: a moral estava baixa.',
        'Desertaram 2 aldeões: a fome durou demais.',
      ],
    });
    expect(peopleMoved(counts({ villagersLeft: 3, villagersDeserted: 1 })).lost).toEqual([
      'Partiram 3 aldeões: a moral estava baixa.',
      'Desertou 1 aldeão: a fome durou demais.',
    ]);
  });
});
