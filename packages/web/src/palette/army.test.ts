import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import { intentOf } from '../game/intent';
import {
  armyIdleView,
  armyTrainingView,
  makeController,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * Os comandos do Quartel (V4C-T3.2; GDD §10.2): um caminho só para cada ordem. O painel e a árvore
 * chamam o mesmo comando que a paleta, que passa por `controller.prepare`; cada fluxo roda um por
 * vez e lê a visão depois de cada diálogo. O custo e o prazo são os da visão.
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

describe('a paleta e os comandos do Quartel', () => {
  it('a paleta tem os quatro comandos', async () => {
    const { commands } = await setup(armyIdleView);
    expect(paletteItems(commands).map((item) => item.label)).toEqual(
      expect.arrayContaining([
        'Lords: Ir para o Exército',
        'Lords: Treinar soldados…',
        'Lords: Cancelar o treino…',
        'Lords: Dispensar soldados…',
      ]),
    );
  });

  it('`openArmy` e `openPanel army` levam à aba Exército', async () => {
    const { run, controller, revealed } = await setup(armyIdleView);
    await run('lords.openArmy');
    expect(controller.route).toBe('army');
    controller.navigate('fief');
    await run('lords.openPanel', 'army');
    expect(controller.route).toBe('army');
    expect(revealed).toEqual(['army-title']);
  });
});

describe('treinar', () => {
  it('pela paleta: a unidade, o lote, a confirmação com a linha da visão e a ordem', async () => {
    const { run, answers, shown, orders } = await setup(armyIdleView);
    // O Arqueiro (terceiro da lista), 4 soldados (quarto da lista de 1 a 6; a lista responde por posição), confirma.
    answers.push(2, 3, true);
    await run('lords.trainSoldiers');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'confirm']);
    const confirm = shown[2];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.title).toContain('Treinar Arqueiro × 4');
    expect(orders()).toEqual([{ type: 'trainSoldiers', payload: { unit: 'archer', amount: 4 } }]);
  });

  it('desistir em qualquer diálogo não envia nada', async () => {
    for (const answers of [[undefined], [2, undefined], [2, 1, false]]) {
      const made = await setup(armyIdleView);
      made.answers.push(...answers);
      await made.run('lords.trainSoldiers');
      expect(made.orders()).toEqual([]);
    }
  });

  it('o painel manda a ordem já conferida: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(armyIdleView);
    await run('lords.trainSoldiers', { unit: 'knight', amount: 2, confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'trainSoldiers', payload: { unit: 'knight', amount: 2 } }]);
  });

  it('o duplo acionamento vale uma ordem só (a trava do treino)', async () => {
    const { commands, controller, orders } = await setup(armyIdleView);
    const train = commands.find((command) => command.id === 'lords.trainSoldiers');
    await Promise.all([
      train?.run({ unit: 'spearman', amount: 2, confirmed: true }),
      train?.run({ unit: 'spearman', amount: 2, confirmed: true }),
    ]);
    await settle(controller);
    expect(orders()).toHaveLength(1);
  });

  it('com lote no pátio ou sem Quartel: um aviso e nenhum diálogo', async () => {
    const busy = await setup(armyTrainingView);
    await busy.run('lords.trainSoldiers');
    expect(busy.shown).toEqual([]);
    expect(busy.toasts().join(' ')).toContain('É um lote por vez');
    expect(busy.orders()).toEqual([]);
    const none = await setup({ ...armyIdleView, army: { ...armyIdleView.army, built: false } });
    await none.run('lords.trainSoldiers');
    expect(none.shown).toEqual([]);
    expect(none.orders()).toEqual([]);
  });
});

describe('cancelar o treino', () => {
  it('pela paleta: a confirmação traz o que a visão diz que devolve', async () => {
    const { run, answers, shown, orders } = await setup(armyTrainingView);
    answers.push(true);
    await run('lords.cancelTraining');
    const confirm = shown[0];
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.detail).toContain(armyTrainingView.army.training?.cancelRefundText);
    expect(orders()).toEqual([{ type: 'cancelTraining', payload: {} }]);
  });

  it('o painel manda o cancelamento conferido; sem lote, um aviso', async () => {
    const sent = await setup(armyTrainingView);
    await sent.run('lords.cancelTraining', { confirmed: true });
    expect(sent.shown).toEqual([]);
    expect(sent.orders()).toEqual([{ type: 'cancelTraining', payload: {} }]);
    const none = await setup(armyIdleView);
    await none.run('lords.cancelTraining');
    expect(none.orders()).toEqual([]);
    expect(none.toasts().join(' ')).toContain('Não há lote');
  });

  it('manter o lote não envia nada', async () => {
    const kept = await setup(armyTrainingView);
    kept.answers.push(false);
    await kept.run('lords.cancelTraining');
    expect(kept.orders()).toEqual([]);
  });
});

describe('dispensar', () => {
  it('sempre confirma: a unidade, a quantidade e a frase', async () => {
    const { run, answers, shown, orders } = await setup(armyIdleView);
    answers.push(0, 1, true);
    await run('lords.disbandSoldiers');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick', 'confirm']);
    expect(orders()).toEqual([
      { type: 'disbandSoldiers', payload: { unit: 'spearman', amount: 2 } },
    ]);
  });

  it('sem soldados não há o que dispensar', async () => {
    const made = await setup({
      ...armyIdleView,
      army: {
        ...armyIdleView.army,
        units: armyIdleView.army.units.map((unit) => ({ ...unit, count: 0 })),
      },
    });
    await made.run('lords.disbandSoldiers');
    expect(made.shown).toEqual([]);
    expect(made.orders()).toEqual([]);
  });

  it('desistir na confirmação não envia nada', async () => {
    const made = await setup(armyIdleView);
    made.answers.push(0, 0, false);
    await made.run('lords.disbandSoldiers');
    expect(made.orders()).toEqual([]);
  });
});

describe('a intenção do treino', () => {
  it('treinar e cancelar são a mesma intenção; dispensar é por unidade', () => {
    expect(intentOf('trainSoldiers', { unit: 'archer', amount: 2 })).toBe(
      intentOf('cancelTraining', {}),
    );
    expect(intentOf('disbandSoldiers', { unit: 'archer', amount: 1 })).not.toBe(
      intentOf('disbandSoldiers', { unit: 'knight', amount: 1 }),
    );
    expect(intentOf('disbandSoldiers', { unit: 'archer', amount: 1 })).not.toBe(
      intentOf('cancelTraining', {}),
    );
  });
});
