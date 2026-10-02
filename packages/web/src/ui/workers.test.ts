import type { ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { craftsView, goldenView, initialView } from '../test-helpers';
import {
  adaptationLine,
  allocationMessage,
  experienceNeedsAttention,
  experienceSummary,
  experienceTrendWord,
  isMastered,
  nextWorkerGain,
  previewAllocation,
  workersCount,
} from './workers';

type Row = ViewState['workers'][number];

const rules = craftsView.workersRules;
const row = (view: ViewState, building: Row['building']): Row => {
  const found = view.workers.find((entry) => entry.building === building);
  if (found === undefined) {
    throw new Error(`A visão não tem ${building}.`);
  }
  return found;
};
// O feudo dos ofícios (golden `crafts`): um edifício em cada situação.
const farm = row(craftsView, 'farm'); // 4 trabalhadores, 2 em adaptação por 38 min, experiência 40
const mill = row(craftsView, 'lumberMill'); // 4 trabalhadores, ofício dominado
const quarry = row(craftsView, 'quarry'); // 2 no nível 3 (pede 3), 1 em adaptação
const mine = row(craftsView, 'goldMine'); // vazia, perdendo o ofício

describe('troca de ofício: o custo antes do clique', () => {
  it('o que um trabalhador a mais rende agora e depois, com o prazo da visão', () => {
    expect(nextWorkerGain(farm, rules)).toBe('+10,2/h agora, +20,4/h depois de 2 h');
    expect(nextWorkerGain(mill, rules)).toBe('+5,2/h agora, +10,4/h depois de 2 h');
    // No ritmo Rápido o prazo vem menor do servidor; o app só o escreve.
    expect(nextWorkerGain(mill, { ...rules, adaptationSeconds: 2400 })).toBe(
      '+5,2/h agora, +10,4/h depois de 40 min',
    );
  });

  it('quem se adapta e por quanto tempo, descontado o tempo desde a leitura', () => {
    expect(adaptationLine(mill, 0)).toBeNull();
    expect(adaptationLine(farm, 0)).toBe('2 em adaptação por mais 38 min');
    expect(adaptationLine(farm, 600)).toBe('2 em adaptação por mais 28 min');
    // O prazo nunca fica negativo enquanto a leitura seguinte não chega.
    expect(adaptationLine(farm, 9999)).toBe('2 em adaptação por mais 1 s');
    // No painel, a contagem regressiva.
    const countdown = (seconds: number) => `<${seconds}>`;
    expect(adaptationLine(quarry, 80, countdown)).toBe('1 em adaptação por mais <5800>');
  });

  it('com várias levas, cada uma com o seu prazo, da que termina antes à que termina depois', () => {
    const staggered: Row = {
      ...farm,
      adapting: 3,
      adaptationEndsInSeconds: 2280,
      adaptingCohorts: [
        { count: 1, endsInSeconds: 720 },
        { count: 2, endsInSeconds: 2280 },
      ],
    };
    expect(adaptationLine(staggered, 0)).toBe(
      '3 em adaptação: 1 por mais 12 min e 2 por mais 38 min',
    );
    // Sem as levas (não acontece com o servidor de hoje), vale o prazo da última.
    expect(adaptationLine({ ...staggered, adaptingCohorts: [] }, 0)).toBe(
      '3 em adaptação por mais 38 min',
    );
    expect(
      adaptationLine({ ...staggered, adaptingCohorts: [], adaptationEndsInSeconds: null }, 0),
    ).toBe('3 em adaptação');
  });
});

describe('prévia da alocação', () => {
  it('aumentar: quem chega entra como uma leva nova, com o prazo inteiro', () => {
    // Fazenda: 2 adaptados a 20,384 e 2 em adaptação a 10,192. Mais 2 chegam a 10,192.
    const more = previewAllocation(farm, rules, 6);
    expect(more.adapting).toBe(4);
    expect(more.nowPerHour).toBeCloseTo(2 * 20.384 + 4 * 10.192, 6);
    expect(more.settledPerHour).toBeCloseTo(6 * 20.384, 6);
    expect(more.settlesInSeconds).toBe(rules.adaptationSeconds);
    // Em um edifício sem ninguém em adaptação, só os novos rendem menos.
    const fresh = previewAllocation(mill, rules, 5);
    expect(fresh).toMatchObject({ adapting: 1, settlesInSeconds: 7200 });
    expect(fresh.nowPerHour).toBeCloseTo(4 * 10.4 + 5.2, 6);
  });

  it('diminuir: saem primeiro os que ainda se adaptam, das levas mais novas para as mais velhas', () => {
    // Tirar 1 da Fazenda leva um dos dois em adaptação: sobram 2 adaptados e 1 em adaptação.
    const one = previewAllocation(farm, rules, 3);
    expect(one).toMatchObject({ adapting: 1, settlesInSeconds: 2280 });
    expect(one.nowPerHour).toBeCloseTo(2 * 20.384 + 10.192, 6);
    // Tirar 3: os dois em adaptação e um adaptado.
    const three = previewAllocation(farm, rules, 1);
    expect(three).toMatchObject({ adapting: 0, settlesInSeconds: null });
    expect(three.nowPerHour).toBeCloseTo(20.384, 6);
    expect(previewAllocation(farm, rules, 0)).toMatchObject({ nowPerHour: 0, settledPerHour: 0 });
    // Duas levas: a mais nova sai inteira antes de a mais velha perder alguém.
    const staggered: Row = {
      ...farm,
      adapting: 2,
      adaptingCohorts: [
        { count: 1, endsInSeconds: 720 },
        { count: 1, endsInSeconds: 2280 },
      ],
    };
    expect(previewAllocation(staggered, rules, 3)).toMatchObject({
      adapting: 1,
      settlesInSeconds: 720,
    });
  });

  it('sem mudança, o número é o da visão', () => {
    expect(previewAllocation(farm, rules, 4)).toMatchObject({
      nowPerHour: farm.grossPerHour,
      adapting: 2,
      settlesInSeconds: 2280,
    });
    expect(previewAllocation(mill, rules, 4)).toEqual({
      nowPerHour: 41.6,
      settledPerHour: 41.6,
      adapting: 0,
      settlesInSeconds: null,
    });
  });

  it('a soma das partes confere com a taxa que o servidor mandou, em todos os edifícios dos goldens', () => {
    for (const view of [initialView, goldenView, craftsView]) {
      for (const entry of view.workers) {
        const adapted = entry.assigned - entry.adapting;
        expect(
          adapted * entry.perWorkerPerHour + entry.adapting * entry.perNewWorkerPerHour,
          `${view.settlement.name} · ${entry.label}`,
        ).toBeCloseTo(entry.grossPerHour, 2);
      }
    }
  });

  it('a frase diz o que muda agora, o que vem depois da adaptação e a regra, nas palavras do servidor', () => {
    expect(allocationMessage(farm, rules, 6)).toBe(
      '+2: 81,5/h agora, 122,3/h depois da adaptação (2 h). Quem troca de ofício produz metade por 2 h.',
    );
    expect(allocationMessage(mill, rules, 5)).toBe(
      '+1: 46,8/h agora, 52/h depois da adaptação (2 h). Quem troca de ofício produz metade por 2 h.',
    );
    // Tirar de onde há gente em adaptação: a regra da saída explica por que a perda é menor.
    expect(allocationMessage(farm, rules, 3)).toBe(
      '−1: 51/h agora, 61,2/h depois da adaptação (38 min). Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação.',
    );
    expect(allocationMessage(farm, rules, 1)).toBe(
      '−3: 20,4/h. Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação.',
    );
    // Tirar de onde todos já são adaptados: só a conta.
    expect(allocationMessage(mill, rules, 3)).toBe('−1: 31,2/h.');
    expect(allocationMessage(mill, rules, 0)).toBe('−4: 0/h.');
    // O mesmo número de hoje.
    expect(allocationMessage(mill, rules, 4)).toBe('Como hoje: 41,6/h.');
    expect(allocationMessage(farm, rules, 4)).toBe(
      'Como hoje: 61,2/h agora, 81,5/h depois da adaptação (38 min).',
    );
  });
});

describe('experiência do ofício', () => {
  it('resume o número, para onde vai e o que rende', () => {
    expect(experienceSummary(farm, rules)).toBe('Experiência 40/100, subindo · +12% de produção');
    expect(experienceSummary(mill, rules)).toBe('Ofício dominado · +30% de produção');
    expect(experienceSummary(quarry, rules)).toBe('Experiência 20/100 · +6% de produção');
    // O bônus pode vir com uma casa decimal.
    expect(experienceSummary(mine, rules)).toBe('Experiência 16/100, caindo · +4,8% de produção');
    // Sem experiência não há bônus a anunciar.
    expect(experienceSummary(row(initialView, 'farm'), rules)).toBe('Experiência 0/100');
    expect(experienceSummary(row(goldenView, 'farm'), rules)).toBe('Experiência 0/100, subindo');
  });

  it('a tendência é dita com uma palavra, não só com um ícone ou uma cor', () => {
    expect(experienceTrendWord(farm)).toBe('subindo');
    expect(experienceTrendWord(mine)).toBe('caindo');
    expect(experienceTrendWord(mill)).toBeNull();
  });

  it('o fim da barra vem da visão', () => {
    expect(isMastered(mill, rules)).toBe(true);
    expect(isMastered(farm, rules)).toBe(false);
    expect(isMastered(farm, { ...rules, experienceMax: 40 })).toBe(true);
  });

  it('pede atenção quando cai, ou quando parou com gente trabalhando e a barra por encher', () => {
    // Vazia e perdendo o que tinha.
    expect(experienceNeedsAttention(mine, rules)).toBe(true);
    // Gente de menos para o nível: não sobe.
    expect(experienceNeedsAttention(quarry, rules)).toBe(true);
    // Subindo, ou dominado: nada a fazer.
    expect(experienceNeedsAttention(farm, rules)).toBe(false);
    expect(experienceNeedsAttention(mill, rules)).toBe(false);
    // Vazio e sem ofício nenhum (o começo do jogo): nada a perder, nenhum alarme.
    for (const entry of initialView.workers) {
      expect(experienceNeedsAttention(entry, rules), entry.label).toBe(false);
    }
  });

  it('"1 trabalhador", "3 trabalhadores"', () => {
    expect(workersCount(0)).toBe('0 trabalhadores');
    expect(workersCount(1)).toBe('1 trabalhador');
    expect(workersCount(3)).toBe('3 trabalhadores');
  });
});
