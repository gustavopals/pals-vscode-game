import { describe, expect, it } from 'vitest';

import {
  caravanEscortView,
  caravanView,
  initialView,
  marketDayView,
  marketOpeningView,
  masterWaitingView,
  mastersView,
  openRoadView,
} from '../test-helpers';
import {
  arrivalIn,
  caravanGold,
  caravanResource,
  caravanTreeLine,
  escortHeroes,
  freeMasters,
  goldText,
  hasMarket,
  marketDeadlines,
  marketLines,
  marketTreeLine,
  masterOptionLine,
  lostEscortLine,
  masterOf,
  parseAmount,
  priceMark,
  priceOf,
  remainingLine,
  reviewStillOpen,
  sellShortcut,
  stockLeftLine,
  tradeLine,
  tradeTotal,
} from './market';

/**
 * O Mercado como texto (roadmap da v0.3, V3E-T4): cada número e cada frase é o da visão do motor
 * (os goldens), e a única conta, o total de uma ordem, é a que o protocolo diz exata:
 * `unidades × preço de hoje`, em milésimos de ouro.
 */

/** "1,515" e "0,85" como número, para comparar com o `buyText` do motor sem o zero a mais. */
const parsed = (text: string) => Number(text.replace(/\./g, '').replace(',', '.'));

describe('o total de uma ordem', () => {
  it('uma unidade a preço de hoje é o preço que o motor escreveu, nas duas pontas e nas duas visões', () => {
    for (const view of [marketOpeningView, marketDayView, caravanView, caravanEscortView]) {
      for (const row of view.market.prices) {
        expect(parsed(goldText(row.buy)), `${row.resource} compra`).toBe(parsed(row.buyText));
        expect(parsed(goldText(row.sell)), `${row.resource} venda`).toBe(parsed(row.sellText));
      }
    }
  });

  it('quantidade × preço é a conta que o motor faz no ouro da caravana, escrita do mesmo jeito', () => {
    for (const view of [caravanView, caravanEscortView]) {
      for (const caravan of view.market.caravans) {
        // O texto do motor (`goldText`) é o total fixado no envio; o do app, o mesmo número.
        expect(goldText(caravan.amount * caravan.unitPrice)).toBe(caravan.goldText);
      }
    }
  });

  it('é exato, sem arredondar: 150 de madeira a 1,02 são 153 de ouro; 100 a 1,515 são 151,5', () => {
    const wood = priceOf(marketOpeningView.market, 'wood');
    if (wood === undefined) {
      throw new Error('o golden deixou de ter madeira');
    }
    // O golden do Mercado aberto: a madeira vale 1,20 na compra e 1,02 na venda.
    expect([wood.buy, wood.sell]).toEqual([1200, 1020]);
    expect(tradeTotal(wood, 'sell', 150)).toBe(153_000);
    expect(goldText(153_000)).toBe('153');
    const food = priceOf(marketDayView.market, 'food');
    expect(food?.buy).toBe(1515);
    expect(goldText(100 * 1515)).toBe('151,5');
    expect(goldText(1_904_000)).toBe('1.904');
    expect(goldText(850)).toBe('0,85');
  });

  it('sem quantidade, sem total; a quantidade é um inteiro a partir de 1', () => {
    const [row] = marketOpeningView.market.prices;
    if (row === undefined) {
      throw new Error('o golden deixou de ter preços');
    }
    expect(tradeTotal(row, 'buy', null)).toBeNull();
    expect(['10', ' 10 ', '140'].map(parseAmount)).toEqual([10, 10, 140]);
    for (const bad of ['', '0', '-5', '1,5', '1.5', '1e3', 'dez', '١٢']) {
      expect(parseAmount(bad), JSON.stringify(bad)).toBeNull();
    }
  });

  it('a linha da confirmação diz o que e quanto', () => {
    const wood = priceOf(marketOpeningView.market, 'wood');
    if (wood === undefined) {
      throw new Error('o golden deixou de ter madeira');
    }
    expect(tradeLine(wood, 'sell', 150, 153_000)).toBe('Vender 150 de madeira por 153 de ouro');
    expect(tradeLine(wood, 'buy', 10, 12_000)).toBe('Comprar 10 de madeira por 12 de ouro');
  });
});

describe('a tabela e a árvore', () => {
  it('"cabem mais 140 hoje" e "hoje não cabe mais nada" saem do que resta no dia', () => {
    const [food] = marketDayView.market.prices;
    expect(food && remainingLine(food)).toBe('Cabem mais 50 hoje.');
    const spent = { ...(food as NonNullable<typeof food>), remainingToday: 0 };
    expect(remainingLine(spent)).toBe('Hoje não cabe mais nada.');
  });

  it('a linha do Mercado na árvore traz o preço de compra e a marca da tendência de cada recurso', () => {
    const { market } = marketDayView;
    expect(marketTreeLine(market)).toBe(
      market.prices.map((row) => `${row.label.toLowerCase()} ${priceMark(row)}`).join(' · '),
    );
    expect(priceMark({ buyText: '1,30', trend: 'up' })).toBe('1,30 ▲');
    expect(priceMark({ buyText: '1,184', trend: 'down' })).toBe('1,184 ▼');
    expect(priceMark({ buyText: '1,00', trend: 'flat' })).toBe('1,00 =');
  });

  it('sem o Mercado a linha diz que ele não foi erguido, e a explicação é a frase do servidor', () => {
    expect(hasMarket(initialView.market)).toBe(false);
    expect(marketTreeLine(initialView.market)).toBe('não erguido');
    expect(marketLines(initialView.market, 0)).toEqual([initialView.market.text]);
  });

  it('a explicação traz, por recurso, os dois preços, a tendência por extenso e o que cabe, e quando o preço muda', () => {
    const lines = marketLines(marketDayView.market, 60);
    expect(lines[0]).toBe(marketDayView.market.text);
    expect(lines[1]).toContain('Comida: compra 1,515, venda 1,287 (subindo). Cabem mais 50 hoje.');
    expect(lines.at(-1)).toMatch(/^O preço muda em \d+ (min|h)\.$/);
  });

  it('a caravana na estrada: a carga e a chegada com o relógio da página', () => {
    const [caravan] = caravanView.market.caravans;
    if (caravan === undefined) {
      throw new Error('o golden deixou de ter caravana');
    }
    expect(caravan.arrivesInSeconds).toBe(5998);
    expect(caravanTreeLine(caravan, 0)).toBe('300 de madeira · chega em 1 h');
    expect(arrivalIn(caravan, 0)).toBe('chega em 1 h 40 min');
    expect(arrivalIn(caravan, 1000)).toBe('chega em 1 h 24 min');
    expect(arrivalIn(caravan, 9999)).toBe('chegando');
  });
});

describe('o atalho "Vender" e a escolta', () => {
  it('o atalho leva quanto cabe no volume de hoje, da visão; sem Mercado ou sem o que vender, nada', () => {
    const food = priceOf(marketDayView.market, 'food');
    expect(sellShortcut(marketDayView, 'food')?.amount).toBe(food?.surplusSellable);
    expect(sellShortcut(marketDayView, 'gold')).toBeNull();
    expect(sellShortcut(initialView, 'food')).toBeNull();
    const spent = {
      ...marketDayView,
      market: {
        ...marketDayView.market,
        prices: marketDayView.market.prices.map((row) => ({
          ...row,
          maxSellable: 0,
          surplusSellable: 0,
        })),
      },
    };
    expect(sellShortcut(spent, 'food')).toBeNull();
  });

  it('o atalho vende o excedente da visão, não o volume nem o estoque inteiro', () => {
    const view = {
      ...marketDayView,
      market: {
        ...marketDayView.market,
        prices: marketDayView.market.prices.map((row) =>
          row.resource === 'food' ? { ...row, maxSellable: 400, surplusSellable: 120 } : row,
        ),
      },
    };
    expect(sellShortcut(view, 'food')?.amount).toBe(120);
    const none = {
      ...view,
      market: {
        ...view.market,
        prices: view.market.prices.map((row) => ({ ...row, surplusSellable: 0 })),
      },
    };
    expect(sellShortcut(none, 'food')).toBeNull();
  });

  it('a confirmação da venda diz quanto resta, com os números da visão', () => {
    const view = {
      ...marketDayView,
      resources: marketDayView.resources.map((row) =>
        row.id === 'food' ? { ...row, stock: 1062 } : row,
      ),
    };
    const food = priceOf(view.market, 'food');
    if (food === undefined) {
      throw new Error('o golden deixou de ter comida no Mercado');
    }
    expect(stockLeftLine(view, food, 'sell', 400)).toBe('Restam 662 de 1.062 de comida no feudo.');
    expect(stockLeftLine(view, food, 'buy', 400)).toBeNull();
    expect(stockLeftLine(view, food, 'sell', 2000)).toBeNull();
  });

  it('só escolta quem a visão lista; a carga rende o preço fixado vezes a quantidade', () => {
    expect(escortHeroes(caravanEscortView).map((hero) => hero.id)).toEqual(['hero-2']);
    expect(escortHeroes(caravanView)).toEqual([]);
    const road = openRoadView();
    expect(road.market.caravanOffer.available).toBe(true);
    expect(caravanResource(road.market.caravanOffer, 'food')?.maxSendable).toBe(200);
    const [row] = road.market.caravanOffer.resources;
    expect(row && goldText(caravanGold(row, 100))).toBe('127');
  });
});

describe('os Mestres', () => {
  it('o edifício que tem Mestre, o que está livre e o prazo da adaptação', () => {
    expect(masterOf(mastersView, 'quarry')?.name).toBe('Mestre Odo');
    expect(masterOf(mastersView, 'lumberMill')).toBeUndefined();
    expect(freeMasters(mastersView)).toEqual([]);
    expect(freeMasters(masterWaitingView).map((master) => master.name)).toEqual(['Mestre Odo']);
  });

  it('cada opção diz o que o edifício rende durante a adaptação e depois dela; ocupado ou fora de alcance, a frase do servidor', () => {
    const [odo] = masterWaitingView.masters;
    const lumber = odo?.options.find((option) => option.building === 'lumberMill');
    if (lumber === undefined) {
      throw new Error('o golden deixou de ter a Serraria');
    }
    // Odo nunca trabalhou: a primeira alocação é imediata (resposta do autor de 2026-10-07).
    expect(masterOptionLine(lumber)).toBe('Serraria Nv1: +34,8/h, na hora, sem adaptação.');
    // Quem já teve um edifício paga a adaptação, e a linha diz os dois números.
    expect(masterOptionLine({ ...lumber, gainWhileAdaptingPerHour: 12 })).toBe(
      'Serraria Nv1: +34,8/h depois da adaptação, +12/h durante ela.',
    );
    const [busy] = mastersView.masters;
    const farm = busy?.options.find((option) => option.building === 'farm');
    expect(farm && masterOptionLine(farm)).toBe('já tem Mestra Berta');
    const here = busy?.options.find((option) => option.current);
    expect(here && masterOptionLine(here)).toBe('É onde ele trabalha.');
  });

  it('os prazos do Mercado: o preço que muda, a caravana que chega e o Mestre que termina a adaptação', () => {
    expect(marketDeadlines(caravanView)).toEqual([7198, 5998]);
    expect(marketDeadlines(mastersView)).toEqual([
      ...(mastersView.market.nextChangeInSeconds === null
        ? []
        : [mastersView.market.nextChangeInSeconds]),
      ...mastersView.masters.flatMap((master) =>
        master.adaptationEndsInSeconds === null ? [] : [master.adaptationEndsInSeconds],
      ),
    ]);
    expect(marketDeadlines(initialView)).toEqual([]);
  });
});

describe('a conferência aberta', () => {
  const review = { resource: 'wood', direction: 'sell' as const, pick: 1 };
  it('vale no mesmo recurso, sentido e clique; escolher de novo o mesmo recurso a fecha', () => {
    expect(reviewStillOpen(review, review)).toBe(true);
    expect(reviewStillOpen(review, { ...review, pick: 2 })).toBe(false);
    expect(reviewStillOpen(review, { ...review, direction: 'buy' })).toBe(false);
    expect(reviewStillOpen(review, { ...review, resource: 'stone' })).toBe(false);
    expect(reviewStillOpen(null, review)).toBe(false);
  });
});

describe('a escolta que some com a tela aberta', () => {
  it('diz que a escolta marcada deixou de estar disponível, com o nome da visão', () => {
    expect(lostEscortLine(caravanEscortView, 'hero-2')).toBeNull();
    expect(lostEscortLine(caravanEscortView, null)).toBeNull();
    const line = lostEscortLine(caravanView, 'hero-2');
    expect(line).toMatch(
      /deixou de estar disponível para escoltar: a caravana sairia sem escolta\.$/,
    );
    expect(lostEscortLine(caravanView, 'hero-999')).toBe(
      'O herói marcado deixou de estar disponível para escoltar: a caravana sairia sem escolta.',
    );
  });
});
