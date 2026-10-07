import type { ViewState } from '@lotg/protocol';
import type { ComponentChild } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { describe, expect, it } from 'vitest';
import { buildReturnReport } from '../game/returnReport';

import { MarketTab } from '../tabs/Market';
import {
  caravanEscortView,
  caravanView,
  initialView,
  marketDayView,
  marketOpeningView,
  masterWaitingView,
  mastersView,
  openRoadView,
  withResource,
} from '../test-helpers';
import type { Actions } from './actions';
import { ResourcesTable } from './ResourcesTable';
import { Today } from './Today';
import { WorkersPanel } from './WorkersPanel';

/**
 * A aba Mercado, o atalho "Vender" e os Mestres do painel dos trabalhadores (roadmap da v0.3,
 * V3E-T4), desenhados com as visões do golden do motor. O app só dispõe o que veio: cada preço,
 * prazo, risco e motivo conferido aqui é o da visão. O que depende de clique (a conferência com o
 * total, o preço que mudou) é provado em navegador, em `tests/e2e/10-mercado.spec.ts`.
 */

const noop = () => {};
const actions: Actions = { order: noop, run: noop, playNow: noop };
const NONE: ReadonlySet<string> = new Set();
const html = (node: ComponentChild) => renderToString(<>{node}</>);
const text = (markup: string) =>
  markup
    .replace(/<span class="sr-only">.*?<\/span>/g, '')
    .replace(/<\/(h1|h2|h3|p|li|button|div|td|th|tr)>/g, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
const buttons = (markup: string) =>
  [...markup.matchAll(/<button([^>]*)>(.*?)<\/button>/g)].map((match) => ({
    label: text(match[2] ?? ''),
    disabled: /\sdisabled/.test(match[1] ?? ''),
    direction: /data-direction="(\w+)"/.exec(match[1] ?? '')?.[1] ?? null,
  }));

const tab = (view: ViewState, online = true, elapsed = 0) =>
  html(
    <MarketTab
      view={view}
      elapsed={elapsed}
      online={online}
      retryInSeconds={online ? null : 30}
      busy={NONE}
      actions={actions}
    />,
  );

describe('a tabela de preços (V3E-T4.1)', () => {
  const page = tab(marketOpeningView);
  const rows = page.match(/<tr[^>]*data-resource="[^"]+".*?<\/tr>/g) ?? [];

  it('uma linha por recurso: compra, venda, base, tendência em palavra e o que cabe hoje', () => {
    expect(rows).toHaveLength(3);
    const food = text(rows[0] ?? '');
    expect(food).toContain('Comida 1,00 0,85 1,00');
    expect(food).toContain('estável');
    expect(food).toContain('Cabem mais 200 hoje.');
    expect(page).toContain(marketOpeningView.market.text);
  });

  it('a tendência é dita em palavra e ícone, nunca só pela cor', () => {
    const day = tab(marketDayView);
    const first = day.match(/<tr[^>]*data-resource="food".*?<\/tr>/)?.[0] ?? '';
    expect(text(first)).toContain('subindo');
    expect(first).toContain('codicon-arrow-up');
    expect(day).toContain('codicon-arrow-down');
    expect(text(day)).toContain('descendo');
  });

  it('o preço leva a conta do servidor, e o que cabe hoje é o da visão', () => {
    const day = tab(marketDayView);
    expect(day).toContain(marketDayView.market.prices[0]?.breakdown);
    expect(text(day)).toContain('Cabem mais 50 hoje.');
  });

  it('diz quando o preço muda, com o relógio da página', () => {
    expect(text(tab(marketDayView, true, 0))).toContain('mudam em 20 min');
    expect(text(tab(marketDayView, true, 600))).toContain('mudam em 10 min');
  });

  it('cada linha tem "Comprar" e "Vender", e a negociação começa vazia, sem ordem a enviar', () => {
    const all = buttons(page);
    const trade = all.filter((button) => button.direction !== null);
    expect(trade.map((button) => button.direction)).toEqual([
      'buy',
      'sell',
      'buy',
      'sell',
      'buy',
      'sell',
    ]);
    expect(trade.every((button) => !button.disabled)).toBe(true);
    // Sem quantidade, "Revisar" não está liberado, e o total pede o número.
    expect(all.find((button) => button.label.startsWith('Revisar'))?.disabled).toBe(true);
    expect(text(page)).toContain('Digite quantas unidades, de 1 em diante.');
    // O "máximo de hoje" é o da visão (o volume do dia, para a venda e a compra).
    expect(text(page)).toContain('O máximo de hoje (200)');
  });

  it('o campo da quantidade é rotulado, e o total é anunciado ao mudar', () => {
    expect(page).toContain('<label for="trade-amount-input">Quantidade</label>');
    expect(page).toMatch(/id="trade-total"[^>]*aria-live="polite"/);
  });
});

describe('os estados do Mercado', () => {
  it('sem o Mercado: a frase do servidor e a obra, sem tabela nem negociação', () => {
    const page = tab(initialView);
    expect(text(page)).toContain(initialView.market.text);
    expect(page).not.toContain('market-prices');
    expect(page).not.toContain('trade-form');
    const [raise] = buttons(page).filter((button) => button.label.includes('Mercado'));
    expect(raise?.label).toBe('Construir Mercado');
    // O Salão ainda não chegou ao nível pedido: a obra diz por quê, e o botão fica travado.
    expect(raise?.disabled).toBe(true);
    expect(text(page)).toContain('Melhore antes o Salão do Senhor para o nível 3.');
    // Sem Mercado não há estrada.
    expect(page).not.toContain('Caravanas');
  });

  it('com o volume do dia esgotado, a frase do servidor está com cadeado e "o máximo" não se oferece', () => {
    const spent = {
      ...marketDayView,
      market: {
        ...marketDayView.market,
        prices: marketDayView.market.prices.map((row) => ({
          ...row,
          remainingToday: 0,
          maxSellable: 0,
          maxBuyable: 0,
          buyBlockedReason: 'Hoje não cabe mais nada. O volume volta na virada do dia.',
          sellBlockedReason: 'Hoje não cabe mais nada. O volume volta na virada do dia.',
        })),
      },
    };
    const page = tab(spent);
    expect(text(page)).toContain('Hoje não cabe mais nada.');
    expect(buttons(page).find((button) => button.label.startsWith('O máximo'))?.disabled).toBe(
      true,
    );
    // A negociação segue de pé: o jogador vê o motivo, e a visão (e não o app) fecha o lado.
    expect(page).toContain('codicon-lock');
    expect(page).toContain('Hoje não cabe mais nada. O volume volta na virada do dia.');
  });

  it('sem ligação: leitura, com tudo desabilitado e a razão dita por extenso', () => {
    const page = tab(marketDayView, false);
    expect(text(page)).toContain('Sem ligação com o reino');
    const fieldset = /<fieldset([^>]*)>/.exec(page)?.[1] ?? '';
    expect(fieldset).toContain('disabled');
    expect(
      buttons(page)
        .filter((button) => button.direction !== null)
        .every((b) => b.disabled),
    ).toBe(true);
  });
});

describe('as caravanas (V3E-T4.3)', () => {
  it('Mercado Nv1: a frase do servidor diz o que falta, com cadeado, e não há formulário', () => {
    const page = tab(marketOpeningView);
    expect(page).toContain('data-testid="caravan-blocked"');
    expect(text(page)).toContain(marketOpeningView.market.caravanOffer.blockedReason ?? '');
    expect(page).not.toContain('caravan-form');
  });

  it('em trânsito: a linha da estrada com o destino, a carga e a chegada, e o que ela rende', () => {
    const page = tab(caravanView);
    const road = page.match(/<li[^>]*data-caravan="caravan-1".*?<\/li>/)?.[0] ?? '';
    expect(text(road)).toContain('Caravana a Porto do Rio · 300 de madeira · chega em 1 h 40 min');
    expect(text(road)).toContain('Rende 351,9 de ouro se chegar inteira');
    // A estrada está cheia: o motivo vem do servidor, e o desfecho não está em lugar nenhum.
    expect(text(page)).toContain(caravanView.market.caravanOffer.blockedReason ?? '');
    expect(page).not.toContain('emboscad');
  });

  it('duas caravanas, uma com escolta: cada uma com a sua linha', () => {
    const page = tab(caravanEscortView);
    expect(page.match(/data-caravan="/g)).toHaveLength(2);
    expect(text(page)).toContain('Escolta: Edda.');
    expect(text(page)).toContain('Sem escolta.');
  });

  it('com lugar na estrada: o preço fixado, a viagem e o risco com a conta, antes de qualquer clique', () => {
    const view = openRoadView();
    const page = tab(view);
    const offer = view.market.caravanOffer;
    expect(page).toContain('caravan-form');
    expect(text(page)).toContain(offer.priceRatioText);
    expect(text(page)).toContain(offer.riskText);
    expect(page).toContain(offer.riskBreakdown);
    expect(text(page)).toContain(offer.lossText);
    expect(text(page)).toContain('Viagem a Porto do Rio: 1 h 20 min');
    expect(text(page)).toContain('Preço fixado no envio: 1,27 de ouro por unidade de comida');
    // A escolta é opcional, e só quem a visão lista aparece.
    expect(page).toContain('data-escort="none"');
    expect(page).toContain('data-escort="hero-2"');
    expect(page).not.toContain('data-escort="hero-1"');
    expect(text(page)).toContain('Rolf');
    const review = buttons(page).find((button) => button.label === 'Revisar o envio');
    expect(review?.disabled).toBe(true);
  });

  it('sem herói livre, a escolta não se oferece, e o texto diz', () => {
    const view = openRoadView();
    const page = tab({
      ...view,
      market: {
        ...view.market,
        caravanOffer: { ...view.market.caravanOffer, eligibleEscortIds: [] },
      },
    });
    expect(page).not.toContain('data-escort="hero-2"');
    expect(text(page)).toContain('Nenhum herói livre para escoltar agora.');
  });
});

describe('o atalho "Vender" ao lado do depósito que enche (IDEIA-11)', () => {
  const resources = (view: ViewState) =>
    html(<ResourcesTable view={view} disabled={false} actions={actions} />);
  const filling = (view: ViewState) =>
    withResource(view, 'food', { stock: 1100, fullInSeconds: 3 * 3600 });

  it('com o Mercado e algo a vender, a saída fica ao lado: "Vender até 50", o que cabe hoje', () => {
    const page = resources(filling(marketDayView));
    expect(page).toContain('storage-notes');
    expect(page).toContain('data-sell="food"');
    expect(text(page)).toContain('Vender até 50');
  });

  it('sem o Mercado, ou sem nada que o volume de hoje aceite, não há atalho', () => {
    expect(resources(filling(initialView))).not.toContain('data-sell');
    const spent = filling({
      ...marketDayView,
      market: {
        ...marketDayView.market,
        prices: marketDayView.market.prices.map((row) => ({
          ...row,
          maxSellable: 0,
          surplusSellable: 0,
        })),
      },
    });
    expect(resources(spent)).not.toContain('data-sell');
  });
});

describe('os Mestres no painel dos trabalhadores (V3E-T4.4)', () => {
  const workers = (view: ViewState, disabled = false) =>
    html(
      <WorkersPanel
        workers={view.workers}
        rules={view.workersRules}
        population={view.population}
        elapsed={0}
        disabled={disabled}
        actions={actions}
        masters={view.masters}
        mastersWaiting={view.mastersWaiting}
      />,
    );

  it('cada edifício diz o seu Mestre e o que ele soma; o que ainda se adapta diz que está sem o bônus', () => {
    const page = workers(mastersView);
    const quarry =
      page.match(/<span class="worker-master" data-master="master-1">.*?<\/li>/)?.[0] ?? '';
    expect(text(quarry)).toContain('Mestre Odo: +15% na produção');
    expect(text(quarry)).toContain('Mover Mestre…');
    const farm =
      page.match(/<span class="worker-master" data-master="master-2">.*?<\/li>/)?.[0] ?? '';
    expect(text(farm)).toContain('Mestra Berta: em adaptação por 1 h 10 min: ainda sem o bônus');
  });

  it('as regras do Mestre, na frase do servidor, ficam à vista antes de qualquer botão', () => {
    expect(text(workers(mastersView))).toContain(mastersView.workersRules.masterText);
  });

  it('o Mestre sem edifício tem o "Alocar Mestre…", e o que espera uma vaga, a frase do servidor', () => {
    const page = workers(masterWaitingView);
    expect(text(page)).toContain('Mestre Odo: sem edifício.');
    expect(text(page)).toContain('Alocar Mestre…');
    expect(text(page)).toContain(
      'Mestre Gil espera uma vaga nas casas: entra assim que houver uma.',
    );
  });

  it('sem Mestre nenhum, o painel não fala deles; sem ligação, os botões ficam desabilitados', () => {
    expect(workers(initialView)).not.toContain('class="masters"');
    expect(workers(initialView)).not.toContain('Mover Mestre');
    const off = buttons(workers(mastersView, true)).filter((button) =>
      button.label.includes('Mestre'),
    );
    expect(off.length).toBeGreaterThan(0);
    expect(off.every((button) => button.disabled)).toBe(true);
  });
});

describe('o foco da conferência', () => {
  it('focusOnMount foca o botão que entra e ignora a saída (ref nulo)', async () => {
    const { focusOnMount } = await import('./shared');
    const calls: string[] = [];
    focusOnMount({ focus: () => calls.push('focus') });
    focusOnMount(null);
    expect(calls).toEqual(['focus']);
  });
});

describe('o Relatório de Retorno e o que se vende no Mercado', () => {
  it('com o Mercado de pé, a nota diz que a venda está em Gasto e o ouro, em Recebido', () => {
    const report = buildReturnReport(marketDayView, marketDayView, [], 9 * 3600 * 1000);
    const sheet = text(
      html(<Today report={report} view={marketDayView} online elapsed={0} actions={actions} />),
    );
    expect(sheet).toContain('vendido no balcão do Mercado');
    expect(sheet).toContain('o ouro que rendeu, em Recebido');
    const plain = buildReturnReport(initialView, initialView, [], 9 * 3600 * 1000);
    expect(
      text(html(<Today report={plain} view={initialView} online elapsed={0} actions={actions} />)),
    ).not.toContain('balcão');
  });
});
