import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import {
  makeController,
  palisadeRaisedView,
  scriptedDialogs,
  settle,
  threatIncomingView,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * O comando da muralha (roadmap da v0.4, V4E-T4): um caminho só. O painel manda a ordem já
 * conferida (`confirmed`); a paleta confirma com a frase do servidor e **lê a oferta de novo
 * depois do diálogo**. O custo e o prazo são os da visão: o app não faz conta.
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
  const env: CommandEnv = {
    download: () => {},
    reload: () => {},
    sleep: async () => {},
    currentTheme: () => 'dark',
    openPalette: () => {},
    reveal: () => {},
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
  return { ...made, ...scripted, commands, run, orders, toasts };
}

const REPAIR = { type: 'repairWall', payload: {} };

describe('reparar a muralha', () => {
  it('a paleta tem "Reparar a muralha…"', async () => {
    const { commands } = await setup(palisadeRaisedView);
    expect(paletteItems(commands).map((item) => item.label)).toContain('Lords: Reparar a muralha…');
  });

  it('pela paleta: a confirmação traz o custo e o prazo da visão, e a ordem só vai depois', async () => {
    const { run, answers, shown, orders } = await setup(palisadeRaisedView);
    answers.push(true);
    await run('lords.repairWall');
    const [confirm] = shown;
    if (confirm?.kind !== 'confirm') {
      throw new Error('esperava a confirmação');
    }
    expect(confirm.detail).toEqual([palisadeRaisedView.threat.defense.wall.repairOffer.text]);
    expect(orders()).toEqual([REPAIR]);
  });

  it('desistir não envia nada', async () => {
    const { run, answers, orders } = await setup(palisadeRaisedView);
    answers.push(false);
    await run('lords.repairWall');
    expect(orders()).toEqual([]);
  });

  it('o painel manda a ordem já conferida: nenhum diálogo', async () => {
    const { run, shown, orders } = await setup(palisadeRaisedView);
    await run('lords.repairWall', { confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([REPAIR]);
  });

  it('o duplo acionamento vale uma ordem só', async () => {
    const { commands, controller, orders } = await setup(palisadeRaisedView);
    const repair = commands.find((command) => command.id === 'lords.repairWall');
    await Promise.all([repair?.run({ confirmed: true }), repair?.run({ confirmed: true })]);
    await settle(controller);
    expect(orders()).toEqual([REPAIR]);
  });

  it('sem muralha ou sem como pagar, o aviso diz por quê e nada é enviado', async () => {
    const none = await setup(threatIncomingView);
    await none.run('lords.repairWall');
    expect(none.toasts()).toEqual([threatIncomingView.threat.defense.wall.repairOffer.blockedText]);
    expect(none.orders()).toEqual([]);
  });
});
