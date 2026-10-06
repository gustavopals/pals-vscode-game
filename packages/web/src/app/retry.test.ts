import { afterEach, describe, expect, it } from 'vitest';

import { makeController, settle, tavernOpenView } from '../test-helpers';
import type { Controller, Toast, ToastAction } from './controller';

/**
 * "Tentar de novo" (revisão da Fase C, A-D2 e A-D3): o aviso de falta de rede guarda uma ordem
 * que já tem `commandId`. Ele vale para o feudo e para a intenção em que nasceu, e para mais
 * nada: não sobrevive à troca de feudo ou de conta, e não convive com uma ordem nova da mesma
 * intenção. Vale para toda ordem, não só para as da Guilda.
 */

const OTHER_GAME = '33333333-3333-4333-8333-333333333333';

const created: Controller[] = [];
afterEach(() => {
  for (const controller of created.splice(0)) {
    controller.dispose();
  }
});

async function opened() {
  const made = makeController({ signedIn: true });
  created.push(made.controller);
  made.api.state.view = tavernOpenView;
  await made.controller.start();
  await settle(made.controller);
  return made;
}

type Made = Awaited<ReturnType<typeof opened>>;

const retries = (controller: Controller): Toast[] =>
  controller.toasts.filter((toast) =>
    toast.actions.some((action) => action.label === 'Tentar de novo'),
  );

function retryOf(controller: Controller): ToastAction {
  const action = retries(controller)[0]?.actions.find((entry) => entry.label === 'Tentar de novo');
  if (action === undefined) {
    throw new Error('Não há aviso com "Tentar de novo".');
  }
  return action;
}

/** Uma ordem dada sem rede: fica o aviso com "Tentar de novo". Depois a rede volta. */
async function failedOffline(made: Made, order: () => Promise<boolean>): Promise<void> {
  made.api.state.online = false;
  expect(await order()).toBe(false);
  expect(made.api.state.commands).toEqual([]);
  expect(retries(made.controller)).toHaveLength(1);
  made.api.state.online = true;
  await made.controller.session.syncNow();
  await settle(made.controller);
}

const sent = (made: Made) =>
  made.api.state.commands.map(({ type, payload }) => ({ type, payload }));

describe('"Tentar de novo" e a troca de feudo ou de conta', () => {
  it('fundar outro feudo tira de cena o aviso da ordem dada ao feudo anterior', async () => {
    const made = await opened();
    await failedOffline(made, () => made.controller.dismissHero('hero-1'));

    made.api.state.nextGameId = OTHER_GAME;
    await made.controller.startNewGame('Vau Alto');
    await settle(made.controller);
    expect(made.controller.session.gameId).toBe(OTHER_GAME);

    expect(retries(made.controller)).toEqual([]);
  });

  it('a ordem preparada para um feudo nunca é enviada a outro: o botão antigo recusa e diz por quê', async () => {
    const made = await opened();
    await failedOffline(made, () => made.controller.dismissHero('hero-1'));
    // Quem ainda tem o botão na mão (o clique que estava a caminho quando o feudo trocou).
    const stale = retryOf(made.controller);

    made.api.state.nextGameId = OTHER_GAME;
    await made.controller.startNewGame('Vau Alto');
    await settle(made.controller);

    await stale.run();
    await settle(made.controller);
    // O `hero-1` do feudo novo, se houver um, não é dispensado por uma ordem do feudo antigo.
    expect(sent(made)).toEqual([]);
    expect(retries(made.controller)).toEqual([]);
    expect(made.controller.toasts.map((toast) => toast.text)).toEqual([
      'Essa ordem era de outro feudo e não foi enviada.',
    ]);
  });

  it('vale para toda ordem, não só para as da Guilda', async () => {
    const made = await opened();
    await failedOffline(made, () =>
      made.controller.order('setWorkers', { building: 'farm', count: 2 }),
    );
    const stale = retryOf(made.controller);

    made.api.state.nextGameId = OTHER_GAME;
    await made.controller.startNewGame('Vau Alto');
    await settle(made.controller);
    expect(retries(made.controller)).toEqual([]);

    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toEqual([]);
  });

  it('sair da conta tira o aviso, e a ordem não segue para o feudo de quem entrar depois', async () => {
    const made = await opened();
    await failedOffline(made, () => made.controller.holdFestival());
    const stale = retryOf(made.controller);

    await made.controller.signOut();
    await settle(made.controller);
    expect(retries(made.controller)).toEqual([]);

    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toEqual([]);
  });

  it('no mesmo feudo, "Tentar de novo" continua reenviando a mesma ordem', async () => {
    const made = await opened();
    await failedOffline(made, () => made.controller.dismissHero('hero-1'));
    await retryOf(made.controller).run();
    await settle(made.controller);
    expect(sent(made)).toEqual([{ type: 'dismissHero', payload: { heroId: 'hero-1' } }]);
  });
});
