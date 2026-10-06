import type { ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import {
  councilView,
  denClearedView,
  fakeApi,
  makeController,
  settle,
  tavernOpenView,
} from '../test-helpers';
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

/** Uma API cujas respostas a `POST /commands` esperam `release()`: a ordem fica a caminho. */
function gatedApi() {
  const api = fakeApi();
  let gate: Promise<void> | null = null;
  let open = () => {};
  const gated: typeof fetch = async (input, init) => {
    if (gate !== null && String(input).endsWith('/commands')) {
      await gate;
    }
    return api.fetch(input, init);
  };
  return {
    api,
    fetch: gated,
    hold: () => {
      gate = new Promise<void>((resolve) => {
        open = resolve;
      });
    },
    release: () => {
      gate = null;
      open();
    },
  };
}

async function opened(view: ViewState = tavernOpenView, gate?: ReturnType<typeof gatedApi>) {
  const made = makeController({
    signedIn: true,
    ...(gate === undefined ? {} : { api: gate.api, overrides: { fetch: gate.fetch } }),
  });
  created.push(made.controller);
  made.api.state.view = view;
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
    expect(retries(made.controller)).toEqual([]);
  });
});

describe('"Tentar de novo" e uma ordem nova da mesma intenção', () => {
  it('o festival aceito pelo painel tira de cena a retentativa antiga, e o botão antigo já não envia outra', async () => {
    const made = await opened();
    await failedOffline(made, () => made.controller.holdFestival());
    const stale = retryOf(made.controller);

    // A rede voltou e o jogador clica no painel: é uma ordem nova, com outro `commandId`.
    expect(await made.controller.holdFestival()).toBe(true);
    expect(sent(made)).toEqual([{ type: 'holdFestival', payload: {} }]);
    expect(retries(made.controller)).toEqual([]);

    // O clique que ainda estivesse a caminho no aviso antigo não vira um segundo festival.
    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toHaveLength(1);
    expect(made.controller.toasts).toEqual([]);
  });

  it('vale para as obras: a ordem nova para o mesmo edifício aposenta a retentativa da anterior', async () => {
    const made = await opened();
    await failedOffline(made, () =>
      made.controller.order('startConstruction', { building: 'farm' }),
    );
    const stale = retryOf(made.controller);

    expect(await made.controller.order('planConstruction', { building: 'farm' })).toBe(true);
    expect(retries(made.controller)).toEqual([]);
    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toEqual([{ type: 'planConstruction', payload: { building: 'farm' } }]);
  });

  it('vale para os trabalhadores: a contagem antiga não volta por cima da nova', async () => {
    const made = await opened();
    await failedOffline(made, () =>
      made.controller.order('setWorkers', { building: 'farm', count: 2 }),
    );
    const stale = retryOf(made.controller);

    expect(await made.controller.order('setWorkers', { building: 'farm', count: 3 })).toBe(true);
    expect(retries(made.controller)).toEqual([]);
    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 3 } }]);
  });

  it('vale para as cartas: a resposta nova à mesma carta aposenta a retentativa da outra opção', async () => {
    const made = await opened(councilView);
    await failedOffline(made, () => made.controller.answerCard('masonsMeal-4', 'bread'));
    const stale = retryOf(made.controller);

    expect(await made.controller.answerCard('masonsMeal-4', 'feast')).toBe(true);
    expect(retries(made.controller)).toEqual([]);
    await stale.run();
    await settle(made.controller);
    expect(sent(made)).toEqual([
      { type: 'answerCard', payload: { instanceId: 'masonsMeal-4', optionId: 'feast' } },
    ]);
  });

  it('vale para os envios que dividem um herói: [Rolf → Patrulha] sem rede não parte depois de [Rolf → Floresta] (revisão, A12)', async () => {
    const made = await opened(denClearedView);
    const send = (modelId: string, heroIds: string[]) =>
      made.controller.sendExpedition(modelId, heroIds, 'balanced');
    await failedOffline(made, () => send('patrol', ['hero-2']));
    const stale = retryOf(made.controller);

    // O jogador muda de ideia: Rolf vai à Floresta, com Edda. É outro destino, o mesmo herói.
    expect(await send('oldForest', ['hero-1', 'hero-2'])).toBe(true);
    expect(retries(made.controller)).toEqual([]);
    await stale.run();
    await settle(made.controller);
    expect(sent(made).map((order) => order.payload)).toEqual([
      { modelId: 'oldForest', heroIds: ['hero-1', 'hero-2'], posture: 'balanced' },
    ]);
  });

  it('o envio de outra equipe a outro destino não mexe na retentativa', async () => {
    const made = await opened(denClearedView);
    const send = (modelId: string, heroIds: string[]) =>
      made.controller.sendExpedition(modelId, heroIds, 'balanced');
    await failedOffline(made, () => send('patrol', ['hero-2']));
    expect(await send('oldForest', ['hero-1'])).toBe(true);
    expect(retries(made.controller)).toHaveLength(1);
    await retryOf(made.controller).run();
    await settle(made.controller);
    expect(sent(made).map((order) => order.payload)).toEqual([
      { modelId: 'oldForest', heroIds: ['hero-1'], posture: 'balanced' },
      { modelId: 'patrol', heroIds: ['hero-2'], posture: 'balanced' },
    ]);
  });

  it('a ordem para outro alvo não mexe na retentativa: cada intenção tem a sua', async () => {
    const made = await opened();
    await failedOffline(made, () =>
      made.controller.order('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(await made.controller.order('setWorkers', { building: 'quarry', count: 1 })).toBe(true);
    expect(retries(made.controller)).toHaveLength(1);
    await retryOf(made.controller).run();
    await settle(made.controller);
    expect(sent(made)).toEqual([
      { type: 'setWorkers', payload: { building: 'quarry', count: 1 } },
      { type: 'setWorkers', payload: { building: 'farm', count: 2 } },
    ]);
  });

  it('a ordem nova que também falha deixa um aviso só, com a ordem nova', async () => {
    const made = await opened();
    await failedOffline(made, () =>
      made.controller.order('setWorkers', { building: 'farm', count: 2 }),
    );
    await failedOffline(made, () =>
      made.controller.order('setWorkers', { building: 'farm', count: 3 }),
    );
    await retryOf(made.controller).run();
    await settle(made.controller);
    expect(sent(made)).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 3 } }]);
  });

  it('a retentativa respeita a trava: com ela a caminho, nem o painel nem um segundo clique no aviso enviam outra', async () => {
    const gate = gatedApi();
    const made = await opened(tavernOpenView, gate);
    await failedOffline(made, () => made.controller.hireHero('offer-1'));
    const retry = retryOf(made.controller);

    const posts = () =>
      made.api.state.requests.filter((entry) => entry.endsWith('/commands')).length;
    const before = posts();
    gate.hold();
    const first = retry.run();
    await settle();
    expect(made.controller.guildOrders.has('hire:offer-1')).toBe(true);
    // O botão do painel está ocupado, e o aviso clicado duas vezes não manda duas.
    expect(await made.controller.hireHero('offer-1')).toBe(false);
    await retry.run();
    gate.release();
    await first;
    await settle(made.controller);

    expect(posts() - before).toBe(1);
    expect(sent(made)).toEqual([{ type: 'hireHero', payload: { offerId: 'offer-1' } }]);
    expect(made.controller.guildOrders.size).toBe(0);
    expect(made.controller.toasts).toEqual([]);
  });
});
