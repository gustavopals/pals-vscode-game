import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import {
  initialView,
  makeController,
  scriptedDialogs,
  settle,
  smithyForgingView,
  smithyIdleView,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * Os comandos do Ferreiro (roadmap da v0.4, V4B-T4.3; GDD §6.1): um caminho só para cada ordem. O
 * painel e a árvore chamam o mesmo comando que a paleta, que passa por `controller.prepare`; cada
 * fluxo roda um por vez e **lê a visão depois de cada diálogo**. O custo e o prazo de cada lote
 * são os da visão: o app não faz conta.
 */

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

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

const FORGE = (amount: number) => ({ type: 'forgeWeapons', payload: { amount } });
const CANCEL = { type: 'cancelForge', payload: {} };

describe('os comandos do Ferreiro na paleta', () => {
  it('a paleta tem "Forjar armas…" e "Cancelar a forja…"', async () => {
    const { commands } = await setup(smithyIdleView);
    expect(paletteItems(commands).map((item) => item.label)).toEqual(
      expect.arrayContaining(['Lords: Forjar armas…', 'Lords: Cancelar a forja…']),
    );
  });

  it('`openPanel` leva ao painel do Ferreiro, na aba Feudo', async () => {
    const { run, controller, revealed } = await setup(smithyIdleView);
    controller.navigate('market');
    await run('lords.openPanel', 'smithy');
    expect(controller.route).toBe('fief');
    expect(revealed).toEqual(['smithy-title']);
  });
});

describe('forjar', () => {
  it('pela paleta: o tamanho do lote com o custo e o prazo da visão, e a confirmação antes de gastar', async () => {
    const { run, answers, shown, orders } = await setup(smithyIdleView);
    // O terceiro tamanho da lista (3 armas) e confirma.
    answers.push(2, true);
    await run('lords.forgeWeapons');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'confirm']);
    const [pick, confirm] = shown;
    if (pick?.kind !== 'pick' || confirm?.kind !== 'confirm') {
      throw new Error('esperava a lista e a confirmação');
    }
    const options = smithyIdleView.smithy.offer.options;
    expect(pick.items).toHaveLength(options.length);
    expect(pick.items[2]?.description).toContain(options[2]?.costText);
    expect(confirm.title).toContain('Forjar 3 armas');
    expect(confirm.title).toContain(options[2]?.costText ?? '?');
    expect(orders()).toEqual([FORGE(3)]);
  });

  it('desistir em qualquer diálogo não envia nada', async () => {
    for (const answers of [[undefined], [0, false]]) {
      const made = await setup(smithyIdleView);
      made.answers.push(...answers);
      await made.run('lords.forgeWeapons');
      expect(made.orders()).toEqual([]);
    }
  });

  it('o painel manda a ordem já conferida: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(smithyIdleView);
    await run('lords.forgeWeapons', { amount: 4, confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([FORGE(4)]);
  });

  it('o duplo acionamento vale uma ordem só (a trava da forja)', async () => {
    const { commands, controller, orders } = await setup(smithyIdleView);
    const forge = commands.find((command) => command.id === 'lords.forgeWeapons');
    await Promise.all([
      forge?.run({ amount: 2, confirmed: true }),
      forge?.run({ amount: 2, confirmed: true }),
    ]);
    await settle(controller);
    expect(orders()).toEqual([FORGE(2)]);
  });

  it('sem o Ferreiro, ou com lote na forja, o aviso diz por quê e nada é enviado', async () => {
    const none = await setup(initialView);
    await none.run('lords.forgeWeapons');
    expect(none.toasts()).toEqual([initialView.smithy.text]);
    expect(none.orders()).toEqual([]);
    const busy = await setup(smithyForgingView);
    await busy.run('lords.forgeWeapons');
    expect(busy.toasts()[0]).toContain('Já há um lote na forja');
    expect(busy.orders()).toEqual([]);
  });
});

describe('cancelar a forja', () => {
  it('pela paleta: confirma com o que devolve (a frase da visão) e manda a ordem', async () => {
    const { run, answers, shown, orders } = await setup(smithyForgingView);
    answers.push(true);
    await run('lords.cancelForge');
    const [confirm] = shown;
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    const forge = smithyForgingView.smithy.forge;
    expect(confirm.detail).toContain(forge?.refundText);
    expect(confirm.confirmLabel).toBe(forge?.cancelLabel);
    expect(orders()).toEqual([CANCEL]);
  });

  it('o painel manda a ordem já confirmada; "Manter o lote" não manda nada', async () => {
    const sent = await setup(smithyForgingView);
    await sent.run('lords.cancelForge', { confirmed: true });
    expect(sent.shown).toEqual([]);
    expect(sent.orders()).toEqual([CANCEL]);
    const kept = await setup(smithyForgingView);
    kept.answers.push(false);
    await kept.run('lords.cancelForge');
    expect(kept.orders()).toEqual([]);
  });

  it('o lote que muda com a pergunta aberta não é cancelado: o aviso pede para conferir de novo (revisão da Fase B, achado 5)', async () => {
    const made = await setup(smithyForgingView);
    const forge = smithyForgingView.smithy.forge;
    if (forge === null) {
      throw new Error('o cenário pede um lote na forja');
    }
    made.answers.push(async () => {
      // Com a pergunta aberta, o lote termina e outra aba põe um maior.
      made.api.state.view = {
        ...smithyForgingView,
        smithy: {
          ...smithyForgingView.smithy,
          forge: {
            ...forge,
            amount: 10,
            label: 'Lote de 10 armas',
            totalSeconds: forge.totalSeconds * 2,
          },
        },
      };
      made.api.state.stateVersion += 1;
      await made.controller.session.syncNow();
      return true;
    });
    await made.run('lords.cancelForge');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toContain(
      'O lote da forja mudou com a pergunta aberta: nada foi enviado. Confira de novo.',
    );
  });

  it('sem lote na forja o aviso diz que não há o que cancelar', async () => {
    const made = await setup(smithyIdleView);
    await made.run('lords.cancelForge');
    expect(made.toasts()).toEqual(['Não há lote na forja para cancelar.']);
    expect(made.orders()).toEqual([]);
  });
});

describe('reparar um item (V4B-T4.3)', () => {
  const entry = (over: Record<string, unknown> = {}) => ({
    itemId: 'item-1',
    label: 'Lança de caça',
    rarityLabel: 'Comum',
    condition: 0,
    durability: 8,
    points: 8,
    ironCost: 8,
    costText: '8 de ferro',
    seconds: 960,
    heroName: null,
    canRepair: true,
    blockedReason: null,
    ...over,
  });
  const viewWith = (items: unknown[]): ViewState =>
    ({
      ...smithyIdleView,
      smithy: { ...smithyIdleView.smithy, repairOffer: { items } },
    }) as ViewState;
  const REPAIR = { type: 'repairItem', payload: { itemId: 'item-1' } };

  it('a paleta tem "Reparar um item…"', async () => {
    const { commands } = await setup(smithyIdleView);
    expect(paletteItems(commands).map((item) => item.label)).toContain('Lords: Reparar um item…');
  });

  it('pela paleta: a lista, a confirmação com o custo e o prazo da visão, e a ordem', async () => {
    const { run, answers, shown, orders } = await setup(viewWith([entry()]));
    answers.push(0, true);
    await run('lords.repairItem');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'confirm']);
    const confirm = shown[1];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.title).toContain('Reparar Lança de caça: 8 de ferro');
    expect(orders()).toEqual([REPAIR]);
  });

  it('o painel manda a ordem já conferida: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(viewWith([entry()]));
    await run('lords.repairItem', { itemId: 'item-1', confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([REPAIR]);
  });

  it('o item travado não vira ordem: o aviso traz o motivo da visão', async () => {
    const { run, answers, orders, toasts } = await setup(
      viewWith([entry({ canRepair: false, blockedReason: 'Devolva-o ao arsenal.' })]),
    );
    answers.push(0);
    await run('lords.repairItem');
    expect(orders()).toEqual([]);
    expect(toasts()).toContain('Devolva-o ao arsenal.');
  });

  it('cancelar a forja com um reparo em curso não envia nada e diz por quê', async () => {
    const forge = {
      kind: 'repair',
      amount: 8,
      label: 'Reparo de Lança de caça: 8 pontos',
      endsInSeconds: 600,
      totalSeconds: 960,
      cancelable: false,
      refundText: 'Um reparo não se cancela: espere o item voltar.',
      cancelLabel: '',
    };
    const view = {
      ...smithyIdleView,
      smithy: { ...smithyIdleView.smithy, forge },
    } as ViewState;
    const { run, orders, toasts } = await setup(view);
    await run('lords.cancelForge');
    expect(orders()).toEqual([]);
    expect(toasts()).toContain(forge.refundText);
  });
});
