import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  autumnView,
  councilView,
  gameEvent,
  goldenView,
  mealCard,
  shareCard,
  withCards,
} from '../test-helpers';
import {
  cardDeadline,
  cardNotice,
  cardOverdue,
  cardSecondsLeft,
  councilRecord,
  councilSummary,
  type CouncilOption,
  deadlineAlert,
  expiresSoon,
  isDefaultOption,
  nextAudience,
  optionBlock,
  optionMissing,
  pendingCards,
  pendingDecisionsLabel,
  stockLine,
} from './council';
import { FULL_SOON_SECONDS } from './format';

const HOUR = 3600;
const feast = mealCard.options[0] as CouncilOption;
const bread = mealCard.options[1] as CouncilOption;

/** A mesma opção com o custo que o estoque não paga: falta `missing` de cada recurso. */
const short = (option: CouncilOption, missing: number[]): CouncilOption => ({
  ...option,
  affordable: false,
  cost: missing.map((amount, index) => ({
    resource: index === 0 ? 'stone' : 'gold',
    label: index === 0 ? 'Pedra' : 'Ouro',
    amount: 30,
    missing: amount,
  })),
});

describe('prazo de uma carta', () => {
  it('diz o prazo em tempo real, aproximado para baixo: nunca promete tempo que não há', () => {
    expect(cardDeadline({ expiresInSeconds: 24 * HOUR }, 0)).toBe('expira em 24 h');
    expect(cardDeadline({ expiresInSeconds: 14 * HOUR + 59 * 60 }, 0)).toBe('expira em 14 h');
    expect(cardDeadline({ expiresInSeconds: 25 * 60 }, 0)).toBe('expira em 25 min');
    expect(cardDeadline(mealCard, 0)).toBe('expira em 23 h');
  });

  it('desce com o relógio da página, sem nova leitura do servidor', () => {
    const card = { expiresInSeconds: 14 * HOUR };
    expect(cardDeadline(card, 4 * HOUR)).toBe('expira em 10 h');
    expect(cardSecondsLeft(card, 4 * HOUR)).toBe(10 * HOUR);
    expect(cardDeadline(card, 13 * HOUR + 30 * 60)).toBe('expira em 30 min');
  });

  it('com o prazo vencido nesta página, diz que ele acabou e a carta deixa de aceitar resposta', () => {
    const card = { expiresInSeconds: 600 };
    expect(cardOverdue(card, 599)).toBe(false);
    expect(cardOverdue(card, 600)).toBe(true);
    expect(cardDeadline(card, 600)).toBe('prazo encerrado');
    expect(cardDeadline(card, 9000)).toBe('prazo encerrado');
    expect(cardSecondsLeft(card, 9000)).toBe(0);
  });

  it('o destaque de "expira logo" usa o limiar de uma ausência comum, o mesmo de "cheio em"', () => {
    expect(expiresSoon({ expiresInSeconds: FULL_SOON_SECONDS }, 0)).toBe(false);
    expect(expiresSoon({ expiresInSeconds: FULL_SOON_SECONDS - 1 }, 0)).toBe(true);
    expect(expiresSoon({ expiresInSeconds: 24 * HOUR }, 17 * HOUR)).toBe(true);
    expect(expiresSoon(mealCard, 0)).toBe(false);
  });
});

describe('contagens por extenso', () => {
  it('singular e plural', () => {
    expect(pendingCards(1)).toBe('1 carta pendente');
    expect(pendingCards(2)).toBe('2 cartas pendentes');
    expect(pendingDecisionsLabel(1)).toBe('1 decisão pendente');
    expect(pendingDecisionsLabel(3)).toBe('3 decisões pendentes');
  });
});

describe('o que impede uma opção', () => {
  it('a opção que o estoque paga e nada tranca pode ser escolhida', () => {
    expect(optionBlock(feast)).toBeNull();
    expect(optionBlock(bread)).toBeNull();
    expect(optionMissing(bread)).toBeNull();
  });

  it('trancada: mostra o requisito, na frase do servidor', () => {
    const locked = { ...feast, locked: true, lockedReason: 'Requer o Celeiro.' };
    expect(optionBlock(locked)).toEqual({ kind: 'locked', text: 'Requer o Celeiro.' });
    // O requisito passa na frente do custo: sem ele, pagar não adianta.
    expect(
      optionBlock({ ...short(feast, [12]), locked: true, lockedReason: 'Requer o Celeiro.' }),
    ).toEqual({ kind: 'locked', text: 'Requer o Celeiro.' });
  });

  it('sem recursos: diz o que falta de cada um, com os números do servidor', () => {
    expect(optionBlock(short(feast, [12]))).toEqual({
      kind: 'unaffordable',
      text: 'Faltam 12 de pedra.',
    });
    expect(optionMissing(short(feast, [12, 5]))).toBe('Faltam 12 de pedra e 5 de ouro.');
    expect(optionMissing(short(feast, [1]))).toBe('Falta 1 de pedra.');
    // O recurso que o estoque cobre não entra na frase.
    expect(optionMissing(short(feast, [0, 7]))).toBe('Faltam 7 de ouro.');
  });

  it('a opção automática é a que o servidor aponta para esta partida', () => {
    expect(mealCard.options.map((option) => isDefaultOption(mealCard, option))).toEqual([
      false,
      true,
      false,
    ]);
  });
});

describe('próxima audiência', () => {
  it('com carta a caminho, só o prazo, que desce com o relógio da página', () => {
    expect(nextAudience(goldenView.council, 0)).toBe('Próxima audiência em 8 h.');
    expect(nextAudience(goldenView.council, 5 * HOUR + 50 * 60)).toBe(
      'Próxima audiência em 2 h 10 min.',
    );
  });

  it('com a mesa cheia, a frase do servidor: o conselho espera uma resposta antes de trazer outra', () => {
    expect(nextAudience(councilView.council, 0)).toBe(
      'Com 2 cartas à espera, o conselho não traz outra: responda uma antes da próxima audiência para ela trazer novidade. Próxima audiência em 2 h 34 min.',
    );
  });

  it('sem assunto para o feudo, a frase do servidor, e não a promessa de uma carta', () => {
    expect(nextAudience(autumnView.council, 0)).toContain(
      'O conselho não tem assunto novo para o feudo como ele está',
    );
  });
});

describe('resumo para a árvore', () => {
  it('quantas cartas esperam e o prazo da que vence primeiro', () => {
    expect(councilSummary(councilView, 0)).toBe('2 cartas pendentes (expira em 22 h)');
    const view = withCards(goldenView, [
      { ...shareCard, expiresInSeconds: 20 * HOUR },
      { ...mealCard, expiresInSeconds: 12 * HOUR },
    ]);
    expect(councilSummary(view, 0)).toBe('2 cartas pendentes (expira em 12 h)');
    expect(councilSummary(view, HOUR)).toBe('2 cartas pendentes (expira em 11 h)');
  });

  it('o prazo que acaba antes de uma ausência comum leva o sinal de alerta, com o texto', () => {
    const view = withCards(goldenView, [{ ...mealCard, expiresInSeconds: 3 * HOUR }]);
    expect(councilSummary(view, 0)).toBe('1 carta pendente (⚠ expira em 3 h)');
    expect(deadlineAlert({ expiresInSeconds: 3 * HOUR }, 0)).toBe('⚠ expira em 3 h');
    expect(deadlineAlert({ expiresInSeconds: 20 * HOUR }, 0)).toBe('expira em 20 h');
    expect(deadlineAlert({ expiresInSeconds: 20 * HOUR }, 13 * HOUR)).toBe('⚠ expira em 7 h');
  });

  it('sem cartas: a próxima audiência, ou que ela não traz assunto', () => {
    expect(councilSummary(goldenView, 0)).toBe('próxima audiência em 8 h');
    expect(councilSummary(autumnView, 0)).toBe('sem assunto por agora');
  });
});

describe('estoque ao lado dos custos', () => {
  it('uma linha com o que há de cada recurso, nos nomes do servidor', () => {
    expect(stockLine(councilView)).toBe('900 comida · 296 madeira · 85 pedra · 358 ouro');
  });
});

describe('aviso de carta nova', () => {
  it('"Nova carta do Conselho: <título>", com o prazo e o que o conselho faz sozinho', () => {
    expect(cardNotice({ ...mealCard, expiresInSeconds: 24 * HOUR })).toEqual({
      text: 'Nova carta do Conselho: A refeição dos pedreiros',
      details: [
        'Espera a sua resposta por 24 h.',
        'Sem resposta até o fim do prazo, o conselho decide sozinho: repartir o pão do dia.',
      ],
    });
  });

  it('não leva número de regra do app: o prazo é o da carta que o servidor mandou', () => {
    const card: ViewState['council']['pending'][number] = { ...mealCard, expiresInSeconds: 600 };
    expect(cardNotice(card).details[0]).toBe('Espera a sua resposta por 10 min.');
  });
});

describe('o que o conselho registrou', () => {
  const event = (seq: number, type: GameEvent['type']) => gameEvent(seq, type, `linha ${seq}`);
  const chronicle = [
    event(1, 'constructionFinished'),
    event(2, 'cardDrawn'),
    event(3, 'seasonChanged'),
    event(4, 'cardAnswered'),
    event(5, 'cardEffectApplied'),
    event(6, 'recruitmentFinished'),
    event(7, 'cardExpired'),
  ];

  it('só as linhas das cartas, da mais nova para a mais antiga', () => {
    expect(councilRecord(chronicle).map((entry) => entry.text)).toEqual([
      'linha 7',
      'linha 5',
      'linha 4',
      'linha 2',
    ]);
  });

  it('limita o tamanho, ficando com as mais novas', () => {
    expect(councilRecord(chronicle, 2).map((entry) => entry.seq)).toEqual([7, 5]);
    expect(councilRecord([])).toEqual([]);
  });
});
