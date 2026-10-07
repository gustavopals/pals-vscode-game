import type { GameEvent, ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import {
  caravanEscortView,
  caravanView,
  initialView,
  makeController,
  marketDayView,
  marketOpeningView,
  masterWaitingView,
  mastersView,
  openRoadView,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * Os comandos do Mercado, das caravanas e dos Mestres (roadmap da v0.3, V3E-T4; GDD §13.6): um
 * caminho só para cada ordem. O painel e a árvore chamam o mesmo comando que a paleta, que passa
 * por `controller.prepare`; cada fluxo roda um por vez por alvo, e **lê a conta e a visão depois
 * de cada diálogo** (§11.1, lição 9), inclusive o dia da cotação. O total que a tela mostra é o
 * que o servidor cobra: quantidade × preço de hoje.
 */

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

type Made = ReturnType<typeof makeController>;

async function setup(view: ViewState) {
  const made = makeController({ signedIn: true });
  controllers.push(made.controller);
  made.api.state.view = view;
  const scripted = scriptedDialogs();
  const revealed: string[] = [];
  const env: CommandEnv = {
    download: () => {},
    reload: () => {},
    sleep: async () => {},
    currentTheme: () => 'dark',
    openPalette: () => {},
    reveal: (elementId) => {
      revealed.push(elementId);
    },
  };
  const commands = createCommands(made.controller, scripted.dialogs, env);
  bindCommands(made.controller, commands);
  await made.controller.start();
  await settle(made.controller);
  const run = async (id: string, arg?: unknown) => {
    await commands.find((command) => command.id === id)?.run(arg);
    await settle(made.controller);
  };
  const orders = () => made.api.state.commands.map(({ type, payload }) => ({ type, payload }));
  const toasts = () => made.controller.toasts.map((toast) => toast.text);
  return { ...made, ...scripted, commands, run, orders, toasts, revealed };
}

/** O servidor passa a mostrar outra visão, e a página a lê. */
async function serverShows(made: Made, view: ViewState, ...events: GameEvent[]): Promise<void> {
  made.api.state.view = view;
  made.api.state.stateVersion += 1;
  made.api.state.events.push(...events);
  await made.controller.session.syncNow();
  await settle(made.controller);
}

/** O mesmo Mercado no dia seguinte: outro dia da cotação e outros preços. */
const nextDay = (view: ViewState): ViewState => ({
  ...view,
  market: {
    ...view.market,
    quoteDay: view.market.quoteDay + 1,
    prices: view.market.prices.map((row) => ({
      ...row,
      buy: row.buy + 100,
      sell: row.sell + 100,
      buyText: 'preço novo',
      sellText: 'preço novo',
    })),
  },
});

const sellWood = (amount: number, quoteDay = 0) => ({
  type: 'trade',
  payload: { resource: 'wood', direction: 'sell', amount, quoteDay },
});

describe('os comandos do Mercado na paleta (GDD §13.6)', () => {
  it('a paleta tem "Ir para o Mercado", "Comprar ou vender no Mercado…", "Mandar uma caravana…" e "Mover Mestre…"', async () => {
    const { commands } = await setup(marketOpeningView);
    const labels = paletteItems(commands).map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Lords: Ir para o Mercado',
        'Lords: Comprar ou vender no Mercado…',
        'Lords: Mandar uma caravana…',
        'Lords: Mover Mestre…',
      ]),
    );
  });

  it('"Ir para o Mercado" e `openPanel` abrem a aba; o Mercado e as caravanas são seções dela', async () => {
    const { run, controller, revealed } = await setup(marketOpeningView);
    await run('lords.openMarket');
    expect(controller.route).toBe('market');
    controller.navigate('fief');
    await run('lords.openPanel', 'market');
    expect(controller.route).toBe('market');
    controller.navigate('fief');
    await run('lords.openPanel', 'caravans');
    expect(controller.route).toBe('market');
    expect(revealed).toEqual(['market-title', 'caravans-title']);
  });
});

describe('comprar e vender', () => {
  it('pela paleta: o recurso, o sentido e a quantidade, e a confirmação diz o total antes de gastar', async () => {
    const { run, answers, shown, orders } = await setup(marketOpeningView);
    // Madeira (a segunda linha), vender (o segundo lado), 150 unidades, confirma.
    answers.push(1, 1, '60', true);
    await run('lords.trade');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'input', 'confirm']);
    const [resource, side, amount, confirm] = shown;
    if (
      resource?.kind !== 'pick' ||
      side?.kind !== 'pick' ||
      amount?.kind !== 'input' ||
      confirm?.kind !== 'confirm'
    ) {
      throw new Error('esperava os quatro diálogos');
    }
    expect(resource.items.map((item) => item.label)).toEqual(['Comida', 'Madeira', 'Pedra']);
    expect(resource.items[1]?.description).toBe('compra 1,20 · venda 1,02 · estável');
    expect(side.items.map((item) => [item.label, item.description])).toEqual([
      ['Comprar', 'a 1,20 · cabem até 80'],
      ['Vender', 'a 1,02 · cabem até 80'],
    ]);
    // Enquanto digita: o total, conta exata; acima do que cabe, o aviso sem trava.
    expect(amount.validate?.('60')).toEqual({ message: 'Total: 61,2 de ouro.', severity: 'info' });
    expect(amount.validate?.('250')?.message).toContain('Mais do que cabe agora (80)');
    expect(amount.validate?.('0')?.severity).toBe('error');
    expect(amount.validate?.('um')?.severity).toBe('error');
    expect(confirm.title).toBe('Vender 60 de madeira por 61,2 de ouro?');
    expect(orders()).toEqual([sellWood(60)]);
  });

  it('desistir em qualquer diálogo não envia nada', async () => {
    for (const answers of [[undefined], [0, undefined], [0, 0, undefined], [0, 0, '10', false]]) {
      const made = await setup(marketOpeningView);
      made.answers.push(...answers);
      await made.run('lords.trade');
      expect(made.orders()).toEqual([]);
      expect(made.toasts()).toEqual([]);
    }
  });

  it('o painel manda a ordem já conferida, com o dia da cotação que o jogador viu: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(marketOpeningView);
    await run('lords.trade', {
      resource: 'wood',
      direction: 'sell',
      amount: 150,
      quoteDay: 0,
      confirmed: true,
    });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([sellWood(150)]);
  });

  it('o atalho "Vender" do depósito pede só a confirmação, com o total, e manda a quantidade dele', async () => {
    const { run, answers, shown, orders } = await setup(marketDayView);
    answers.push(true);
    await run('lords.trade', { resource: 'food', direction: 'sell', amount: 50 });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['confirm']);
    const [confirm] = shown;
    // 50 de comida a 1,287: 64,35 de ouro.
    expect(confirm?.kind === 'confirm' ? confirm.title : '').toBe(
      'Vender 50 de comida por 64,35 de ouro?',
    );
    expect(orders()).toEqual([
      {
        type: 'trade',
        payload: { resource: 'food', direction: 'sell', amount: 50, quoteDay: 51 },
      },
    ]);
  });

  it('sem o Mercado, a paleta responde com a frase do servidor', async () => {
    const { run, shown, orders, toasts } = await setup(initialView);
    await run('lords.trade');
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual([initialView.market.text]);
  });

  it('o dia virou com a lista aberta: o preço novo é dito, nada é enviado, e a ordem pede nova conferência', async () => {
    const made = await setup(marketOpeningView);
    made.answers.push(
      0,
      // A direção chega depois de a visão passar a outro dia.
      async () => {
        await serverShows(made, nextDay(marketOpeningView));
        return 'sell';
      },
      '10',
      true,
    );
    await made.run('lords.trade');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toEqual([
      'O dia virou e o preço do Mercado mudou enquanto você decidia: agora comida está a preço novo de ouro. Nada foi enviado: confira de novo.',
    ]);
    // "Negociar de novo" recomeça pelo que ele já tinha escolhido, e confirma outra vez.
    made.answers.push(true);
    const again = made.controller.toasts[0]?.actions.find(
      (action) => action.label === 'Negociar de novo',
    );
    await again?.run();
    await settle(made.controller);
    expect(made.orders()).toEqual([
      { type: 'trade', payload: { resource: 'food', direction: 'sell', amount: 10, quoteDay: 1 } },
    ]);
  });

  it('PRICE_CHANGED: a frase do servidor, a visão nova na tela, e nada reenviado sozinho', async () => {
    const made = await setup(marketOpeningView);
    made.api.state.view = nextDay(marketOpeningView);
    made.api.refuseNextCommand(
      'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
      'PRICE_CHANGED',
    );
    await made.run('lords.trade', {
      resource: 'wood',
      direction: 'sell',
      amount: 150,
      quoteDay: 0,
      confirmed: true,
    });
    expect(made.toasts()).toEqual([
      'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
    ]);
    // A visão que veio na recusa tomou a tela: o dia e o preço são os novos.
    expect(made.controller.view?.market.quoteDay).toBe(1);
    expect(made.controller.view?.market.prices[1]?.sellText).toBe('preço novo');
    // Nenhuma ordem saiu, nem sai depois: o jogador é quem confere e confirma de novo.
    await made.controller.session.syncNow();
    await settle(made.controller);
    expect(made.orders()).toEqual([]);
    expect(made.controller.toasts.some((toast) => toast.retry === true)).toBe(false);
  });

  it('sem rede: "Tentar de novo" reenvia a MESMA ordem, com o mesmo commandId, e o servidor vê uma só', async () => {
    const made = await setup(marketOpeningView);
    made.api.state.online = false;
    await made.run('lords.trade', {
      resource: 'wood',
      direction: 'sell',
      amount: 150,
      quoteDay: 0,
      confirmed: true,
    });
    expect(made.orders()).toEqual([]);
    const retry = made.controller.toasts
      .find((toast) => toast.retry === true)
      ?.actions.find((action) => action.label === 'Tentar de novo');
    expect(retry).toBeDefined();
    made.api.state.online = true;
    await made.controller.session.syncNow();
    await settle(made.controller);
    await retry?.run();
    await settle(made.controller);
    expect(made.orders()).toEqual([sellWood(150)]);
    // Uma tentativa nova do mesmo recurso aposenta a retentativa velha.
    expect(made.controller.toasts.filter((toast) => toast.retry === true)).toEqual([]);
  });

  it('duplo clique: um fluxo por recurso, uma ordem', async () => {
    const made = await setup(marketOpeningView);
    const arg = { resource: 'wood', direction: 'sell', amount: 150, quoteDay: 0, confirmed: true };
    const trade = made.commands.find((command) => command.id === 'lords.trade');
    await Promise.all([trade?.run(arg), trade?.run(arg)]);
    await settle(made.controller);
    expect(made.orders()).toEqual([sellWood(150)]);
    // Outro recurso não é o mesmo alvo: a trava não o segura.
    await Promise.all([
      trade?.run({ ...arg, resource: 'stone' }),
      trade?.run({ ...arg, resource: 'food' }),
    ]);
    await settle(made.controller);
    expect(made.orders()).toHaveLength(3);
  });

  it('a recusa do servidor (volume, depósito, ouro) vira aviso com a frase dele', async () => {
    for (const [phrase, code] of [
      [
        'O Mercado Nv1 negocia 200 de madeira por dia, entre compras e vendas: hoje ainda cabem 50.',
        'DAILY_VOLUME_EXCEEDED',
      ],
      ['O Armazém Nv1 guarda 2.800 de madeira, e a compra não cabe.', 'STORAGE_FULL'],
      ['Faltam 40 de ouro.', 'INSUFFICIENT_RESOURCES'],
    ] as const) {
      const made = await setup(marketOpeningView);
      made.api.refuseNextCommand(phrase, code);
      await made.run('lords.trade', {
        resource: 'wood',
        direction: 'buy',
        amount: 500,
        quoteDay: 0,
        confirmed: true,
      });
      expect(made.toasts()).toEqual([phrase]);
    }
  });
});

describe('mandar uma caravana', () => {
  const send = (resource: string, amount: number, escortHeroId: string | null, quoteDay = 0) => ({
    type: 'sendCaravan',
    payload: { resource, amount, escortHeroId, quoteDay },
  });

  it('pela paleta: a carga, a quantidade e a escolta; a confirmação diz o preço fixado, a viagem e o risco', async () => {
    const { run, answers, shown, orders } = await setup(openRoadView());
    // Comida, 100 unidades, Rolf de escolta, confirma.
    answers.push(0, '100', 1, true);
    await run('lords.sendCaravan');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'input', 'pick', 'confirm']);
    const [cargo, amount, escort, confirm] = shown;
    if (
      cargo?.kind !== 'pick' ||
      amount?.kind !== 'input' ||
      escort?.kind !== 'pick' ||
      confirm?.kind !== 'confirm'
    ) {
      throw new Error('esperava os quatro diálogos');
    }
    expect(cargo.detail).toEqual([
      'O preço de venda do dia × 1,15, fixado no envio.',
      '10% de chance de emboscada sem escolta; com escolta, nenhuma. Conta a Torre de Vigia que o feudo tiver na chegada.',
      'A emboscada leva 50% da carga, arredondada para baixo; o resto é vendido pelo preço fixado.',
    ]);
    expect(cargo.items[0]?.description).toBe('a 1,27 de ouro · até 200');
    expect(amount.validate?.('100')?.message).toBe('Rende 127 de ouro se chegar inteira.');
    expect(escort.items.map((item) => item.label)).toEqual([
      'Sem escolta',
      'Rolf · Arqueiro Nv1 · Prudente',
    ]);
    expect(confirm.title).toBe('Mandar 100 de comida a Porto do Rio?');
    expect(confirm.detail?.[0]).toBe(
      'Preço fixado: 1,27 de ouro por unidade: 127 de ouro se chegar inteira.',
    );
    expect(confirm.detail?.[1]).toBe('Viagem de 1 h 20 min. Escolta: Rolf.');
    expect(orders()).toEqual([send('food', 100, 'hero-2')]);
  });

  it('sem herói livre, a escolta nem é perguntada; a ordem vai sem escolta', async () => {
    const view = openRoadView();
    const { run, answers, shown, orders } = await setup({
      ...view,
      market: {
        ...view.market,
        caravanOffer: { ...view.market.caravanOffer, eligibleEscortIds: [] },
      },
    });
    answers.push(1, '10', true);
    await run('lords.sendCaravan');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'input', 'confirm']);
    expect(orders()).toEqual([send('wood', 10, null)]);
  });

  it('o painel manda a ordem conferida, com o dia da cotação: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(openRoadView());
    await run('lords.sendCaravan', {
      resource: 'stone',
      amount: 40,
      escortHeroId: null,
      quoteDay: 0,
      confirmed: true,
    });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([send('stone', 40, null)]);
  });

  it('estrada cheia ou Mercado Nv1: a frase do servidor, sem diálogo e sem ordem', async () => {
    for (const view of [caravanView, caravanEscortView, marketOpeningView]) {
      const made = await setup(view);
      await made.run('lords.sendCaravan');
      expect(made.shown).toEqual([]);
      expect(made.orders()).toEqual([]);
      expect(made.toasts()).toEqual([view.market.caravanOffer.blockedReason]);
    }
    const none = await setup(initialView);
    await none.run('lords.sendCaravan');
    expect(none.toasts()).toEqual([initialView.market.text]);
  });

  it('o dia virou com a lista aberta: nada é enviado, o preço novo é dito e a ordem pede nova conferência', async () => {
    const view = openRoadView();
    const made = await setup(view);
    made.answers.push(
      async () => {
        await serverShows(made, {
          ...view,
          market: {
            ...view.market,
            quoteDay: view.market.quoteDay + 1,
            caravanOffer: {
              ...view.market.caravanOffer,
              resources: view.market.caravanOffer.resources.map((row) => ({
                ...row,
                unitPriceText: 'preço novo',
              })),
            },
          },
        });
        return 'food';
      },
      '100',
      null,
      true,
    );
    // O herói da escolta ainda está disponível, mas o dia mudou.
    await made.run('lords.sendCaravan');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()[0]).toContain('O dia virou e o preço mudou enquanto você decidia');
    expect(made.toasts()[0]).toContain('preço novo');
  });

  it('a escolta que deixou de poder ir com a lista aberta não vira ordem', async () => {
    const view = openRoadView();
    const made = await setup(view);
    made.answers.push(
      0,
      '100',
      async () => {
        await serverShows(made, {
          ...view,
          market: {
            ...view.market,
            caravanOffer: { ...view.market.caravanOffer, eligibleEscortIds: [] },
          },
        });
        return 'hero-2';
      },
      true,
    );
    await made.run('lords.sendCaravan');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()[0]).toContain('já não pode escoltar');
  });

  it('PRICE_CHANGED no envio: a frase do servidor e a visão de hoje; nada sai sozinho', async () => {
    const made = await setup(openRoadView());
    made.api.state.view = nextDay(openRoadView());
    made.api.refuseNextCommand(
      'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
      'PRICE_CHANGED',
    );
    await made.run('lords.sendCaravan', {
      resource: 'stone',
      amount: 40,
      escortHeroId: null,
      quoteDay: 0,
      confirmed: true,
    });
    expect(made.toasts()).toEqual([
      'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
    ]);
    expect(made.controller.view?.market.quoteDay).toBe(1);
    expect(made.orders()).toEqual([]);
  });

  it('sem rede, "Tentar de novo" reenvia a mesma caravana, e o duplo clique manda uma só', async () => {
    const made = await setup(openRoadView());
    const arg = {
      resource: 'stone',
      amount: 40,
      escortHeroId: 'hero-2',
      quoteDay: 0,
      confirmed: true,
    };
    made.api.state.online = false;
    await made.run('lords.sendCaravan', arg);
    const retry = made.controller.toasts
      .find((toast) => toast.retry === true)
      ?.actions.find((action) => action.label === 'Tentar de novo');
    made.api.state.online = true;
    await made.controller.session.syncNow();
    await settle(made.controller);
    await retry?.run();
    await settle(made.controller);
    expect(made.orders()).toEqual([send('stone', 40, 'hero-2')]);
    const command = made.commands.find((entry) => entry.id === 'lords.sendCaravan');
    await Promise.all([
      command?.run({ ...arg, resource: 'wood' }),
      command?.run({ ...arg, resource: 'wood' }),
    ]);
    await settle(made.controller);
    expect(made.orders()).toHaveLength(2);
  });
});

describe('mover um Mestre', () => {
  const assign = (masterId: string, building: string | null) => ({
    type: 'assignMaster',
    payload: { masterId, building },
  });

  it('pela paleta: o Mestre, o edifício com o que cada um renderia, e a confirmação repete as regras', async () => {
    const { run, answers, shown, orders } = await setup(mastersView);
    // Dois Mestres: Odo (o primeiro), a Serraria (o segundo item), confirma.
    answers.push(0, 1, true);
    await run('lords.assignMaster');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'confirm']);
    const [who, where, confirm] = shown;
    if (who?.kind !== 'pick' || where?.kind !== 'pick' || confirm?.kind !== 'confirm') {
      throw new Error('esperava os três diálogos');
    }
    expect(who.items.map((item) => [item.label, item.description])).toEqual([
      ['Mestre Odo', 'Pedreira'],
      ['Mestra Berta', 'Fazenda'],
    ]);
    expect(where.detail).toEqual([mastersView.workersRules.masterText]);
    expect(where.items.map((item) => [item.icon, item.label])).toEqual([
      ['lock', 'Fazenda'],
      ['tools', 'Serraria'],
      ['check', 'Pedreira'],
      ['tools', 'Mina de Ouro'],
      ['close', 'Deixar sem edifício'],
    ]);
    // O que cada edifício muda, ou o motivo do servidor, na linha: nada é escondido do jogador.
    expect(where.items[0]?.description).toBe('já tem Mestra Berta');
    expect(where.items[1]?.description).toBe(
      'Serraria Nv1: +14,2/h depois da adaptação, +4,9/h durante ela.',
    );
    expect(confirm.title).toBe('Mover Mestre Odo para Serraria?');
    expect(confirm.detail).toEqual([
      'Serraria Nv1: +14,2/h depois da adaptação, +4,9/h durante ela.',
      mastersView.workersRules.masterText,
    ]);
    expect(orders()).toEqual([assign('master-1', 'lumberMill')]);
  });

  it('o painel e a árvore mandam o Mestre; o Mestre sem edifício vai direto à lista dos edifícios', async () => {
    const { run, answers, shown, orders } = await setup(masterWaitingView);
    answers.push(0, true);
    await run('lords.assignMaster', { masterId: 'master-1' });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'confirm']);
    expect(orders()).toEqual([assign('master-1', 'farm')]);
  });

  it('a linha da árvore (`master:<id>`) e o identificador sozinho valem como o Mestre', async () => {
    const a = await setup(mastersView);
    a.answers.push(1, true);
    await a.run('lords.assignMaster', { id: 'master:master-1', label: 'Mestre Odo' });
    expect(a.orders()).toEqual([assign('master-1', 'lumberMill')]);
    const b = await setup(mastersView);
    b.answers.push(1, true);
    await b.run('lords.assignMaster', 'master-1');
    expect(b.orders()).toEqual([assign('master-1', 'lumberMill')]);
  });

  it('o edifício que a visão diz estar ocupado só recebe o motivo, sem ordem', async () => {
    const { run, answers, orders, toasts } = await setup(mastersView);
    answers.push(0);
    await run('lords.assignMaster', { masterId: 'master-1' });
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual(['já tem Mestra Berta']);
  });

  it('sem Mestre, a paleta responde com as regras do servidor; o Mestre que partiu não vira ordem', async () => {
    const none = await setup(initialView);
    await none.run('lords.assignMaster');
    expect(none.toasts()).toEqual([initialView.workersRules.masterText]);
    const gone = await setup(mastersView);
    await gone.run('lords.assignMaster', { masterId: 'master-9' });
    expect(gone.orders()).toEqual([]);
    expect(gone.toasts()).toEqual(['Este Mestre já não serve ao feudo. Nada foi enviado.']);
  });

  it('depois da confirmação a visão é lida de novo: o edifício que foi tomado com o diálogo aberto não vira ordem', async () => {
    const made = await setup(masterWaitingView);
    made.answers.push(async () => {
      // Outra aba pôs a Berta na Fazenda e o Odo na Pedreira com a lista aberta.
      await serverShows(made, mastersView);
      return 'farm';
    }, true);
    // Depois da confirmação a visão é a de agora: a Fazenda já é de Berta.
    await made.run('lords.assignMaster', { masterId: 'master-1' });
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toEqual(['já tem Mestra Berta Nada foi enviado.']);
  });
});
