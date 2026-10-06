import type { GameEvent, ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import {
  gameEvent,
  guildArrearsView,
  guildPaidView,
  initialView,
  makeController,
  scriptedDialogs,
  settle,
  tavernBusyView,
  tavernOpenView,
  withWage,
} from '../test-helpers';
import { bindCommands, type CommandEnv, createCommands, paletteItems } from './commands';

/**
 * Os comandos da Guilda (roadmap da v0.3, V3C-T4.2; GDD §13.6): contratar, dispensar e dar
 * festival têm um caminho só. O painel, a árvore e a paleta chamam o mesmo comando, que passa
 * por `controller.prepare`; cada fluxo roda um por vez e lê a conta e a visão depois de qualquer
 * espera (§11.1, lição 9).
 */

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

type Made = ReturnType<typeof makeController>;

async function setup(view: ViewState, before?: (made: Made) => void) {
  const made = makeController({ signedIn: true });
  controllers.push(made.controller);
  made.api.state.view = view;
  before?.(made);
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

const hire = (offerId: string) => ({ type: 'hireHero', payload: { offerId } });
const dismiss = (heroId: string) => ({ type: 'dismissHero', payload: { heroId } });
const FESTIVAL = { type: 'holdFestival', payload: {} };

describe('os comandos da Guilda na paleta (GDD §13.6)', () => {
  it('a paleta tem "Ir para a Guilda", "Contratar herói…", "Dispensar herói…" e o festival', async () => {
    const { commands } = await setup(tavernOpenView);
    const labels = paletteItems(commands).map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Lords: Ir para a Guilda',
        'Lords: Contratar herói…',
        'Lords: Dispensar herói…',
        'Lords: Dar um festival na Taverna',
      ]),
    );
  });

  it('"Ir para a Guilda" e `openPanel` abrem a aba; a Taverna é uma seção dela', async () => {
    const { run, controller, revealed } = await setup(tavernOpenView);
    await run('lords.openGuild');
    expect(controller.route).toBe('guild');
    controller.navigate('fief');
    await run('lords.openPanel', 'guild');
    expect(controller.route).toBe('guild');
    controller.navigate('fief');
    await run('lords.openPanel', 'tavern');
    expect(controller.route).toBe('guild');
    expect(revealed).toEqual(['tavern-title']);
  });
});

describe('contratar herói', () => {
  it('pela paleta: a lista traz cada candidato com a ficha, o preço, o soldo e os traços explicados', async () => {
    const { run, answers, shown, orders } = await setup(tavernOpenView);
    answers.push(1);
    await run('lords.hireHero');
    expect(shown).toHaveLength(1);
    const [pick] = shown;
    if (pick?.kind !== 'pick') {
      throw new Error('esperava a lista dos candidatos');
    }
    expect(pick.title).toBe('Contratar herói');
    expect(pick.placeholder).toBe('Quem? A lista troca em 7 h 47 min.');
    expect(pick.items.map((item) => [item.icon, item.label, item.description])).toEqual([
      ['check', 'Mécia · Arqueira Nv1 · Gananciosa', '80 de ouro · soldo de 6/h'],
      ['check', 'Gonçalo · Clérigo Nv1 · Devoto', '130 de ouro · soldo de 6/h'],
    ]);
    expect(pick.items[0]?.detail).toBe(
      'Gananciosa: Volta com mais saque, e às vezes o perde no caminho.',
    );
    expect(orders()).toEqual([hire('offer-2')]);
  });

  it('bloqueado, o candidato leva cadeado e o motivo do servidor; escolhido, a ordem segue e quem recusa é o servidor', async () => {
    const { run, answers, shown, orders, api, toasts } = await setup(tavernBusyView);
    api.refuseNextCommand('A Taverna Nv1 abriga 2 heróis, e o feudo já os tem.', 'HERO_LIMIT');
    answers.push(0);
    await run('lords.hireHero');
    const [pick] = shown;
    if (pick?.kind !== 'pick') {
      throw new Error('esperava a lista dos candidatos');
    }
    expect(pick.items[0]?.icon).toBe('lock');
    expect(pick.items[0]?.detail).toContain(tavernBusyView.tavern.offers[0]?.blockedReason);
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual(['A Taverna Nv1 abriga 2 heróis, e o feudo já os tem.']);
  });

  it('o painel e a árvore mandam o candidato: nenhum diálogo, a mesma ordem, cada uma com o seu commandId', async () => {
    const { run, shown, orders, api } = await setup(tavernOpenView);
    await run('lords.hireHero', { offerId: 'offer-1' });
    await run('lords.hireHero', { id: 'offer:offer-2', label: 'Gonçalo' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([hire('offer-1'), hire('offer-2')]);
    const ids = api.state.commands.map((command) => command.commandId);
    expect(new Set(ids).size).toBe(2);
  });

  it('desistir na lista não envia nada', async () => {
    const { run, answers, orders, toasts } = await setup(tavernOpenView);
    answers.push(undefined);
    await run('lords.hireHero');
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual([]);
  });

  it('sem Taverna, a paleta responde com a frase do servidor; sem candidatos, com a troca da lista', async () => {
    const none = await setup(initialView);
    await none.run('lords.hireHero');
    expect(none.shown).toEqual([]);
    expect(none.toasts()).toEqual([initialView.tavern.text]);
    const empty = await setup({
      ...tavernOpenView,
      tavern: { ...tavernOpenView.tavern, offers: [] },
    });
    await empty.run('lords.hireHero');
    expect(empty.toasts()).toEqual([
      'Nenhum candidato à mesa da Taverna agora: a lista troca em 7 h 47 min.',
    ]);
    expect(empty.orders()).toEqual([]);
  });

  it('duplo acionamento pela paleta: um fluxo por vez, uma lista e uma contratação', async () => {
    const made = await setup(tavernOpenView);
    let choose: (value: unknown) => void = () => {};
    made.answers.push(
      () =>
        new Promise((resolve) => {
          choose = resolve;
        }),
    );
    const first = made.commands.find((command) => command.id === 'lords.hireHero')?.run();
    const second = made.commands.find((command) => command.id === 'lords.hireHero')?.run();
    await settle(made.controller);
    // O segundo acionamento não abriu outra lista.
    expect(made.shown).toHaveLength(1);
    choose(0);
    await Promise.all([first, second]);
    await settle(made.controller);
    expect(made.orders()).toEqual([hire('offer-1')]);
  });

  it('duplo clique no painel: com a primeira ordem a caminho, a segunda não vira ordem', async () => {
    const made = makeController({ signedIn: true });
    controllers.push(made.controller);
    made.api.state.view = tavernOpenView;
    await made.controller.start();
    await settle(made.controller);
    // Direto no controlador, como dois cliques antes de a tela se redesenhar.
    const original = made.controller.session.send.bind(made.controller.session);
    let release: () => void = () => {};
    const waiting = new Promise<void>((resolve) => {
      release = resolve;
    });
    made.controller.session.send = async (command) => {
      await waiting;
      return original(command);
    };
    const first = made.controller.hireHero('offer-1');
    const second = made.controller.hireHero('offer-1');
    await settle();
    expect(made.controller.guildOrders.has('hire:offer-1')).toBe(true);
    expect(await second).toBe(false);
    release();
    expect(await first).toBe(true);
    await settle(made.controller);
    expect(made.api.state.commands.map(({ type, payload }) => ({ type, payload }))).toEqual([
      hire('offer-1'),
    ]);
    expect(made.controller.guildOrders.size).toBe(0);
  });

  it('lê a visão depois da espera: a lista que trocou com a escolha aberta fecha sem enviar nada', async () => {
    const made = await setup(tavernOpenView);
    made.answers.push(async () => {
      // Com a lista aberta, a Taverna troca os candidatos (ou outra aba contrata).
      await serverShows(made, tavernBusyView);
      return 0;
    });
    await made.run('lords.hireHero');
    expect(made.orders()).toEqual([]);
    expect(made.toasts()).toEqual([
      'A lista de candidatos da Taverna mudou com a escolha aberta: nada foi enviado.',
    ]);
  });

  it('o candidato de uma linha que já saiu da mesa não vira ordem', async () => {
    const { run, orders, toasts } = await setup(tavernOpenView);
    await run('lords.hireHero', { id: 'offer:offer-99', label: 'Ninguém' });
    expect(orders()).toEqual([]);
    expect(toasts()[0]).toContain('já não está à mesa da Taverna');
  });

  it('falha de rede: "Tentar de novo" reenvia a mesma ordem, com o mesmo commandId', async () => {
    const { run, api, controller } = await setup(tavernOpenView);
    api.state.online = false;
    await run('lords.hireHero', { offerId: 'offer-1' });
    expect(api.state.commands).toEqual([]);
    api.state.online = true;
    await controller.session.syncNow();
    await settle(controller);
    const retry = controller.toasts
      .flatMap((toast) => toast.actions)
      .find((action) => action.label === 'Tentar de novo');
    expect(retry).toBeDefined();
    await retry?.run();
    await settle(controller);
    expect(api.state.commands).toMatchObject([
      { ...hire('offer-1'), commandId: '00000000-0000-4000-8000-000000000001' },
    ]);
  });
});

describe('dispensar herói', () => {
  it('pela paleta, com um herói só, vai direto à confirmação, com a ficha e a frase do servidor: sem devolução', async () => {
    const { run, answers, shown, orders } = await setup(tavernOpenView);
    answers.push(true);
    await run('lords.dismissHero');
    expect(shown).toEqual([
      {
        kind: 'confirm',
        title: 'Dispensar Edda?',
        detail: ['Edda · Guerreira Nv1 · Leal · soldo de 6/h.', tavernOpenView.guild.dismissText],
        confirmLabel: 'Dispensar Edda',
        cancelLabel: 'Manter Edda',
      },
    ]);
    expect(tavernOpenView.guild.dismissText).toContain('não devolve nada');
    expect(orders()).toEqual([dismiss('hero-1')]);
  });

  it('com vários, pergunta quem, e marca o descontente; depois confirma', async () => {
    const { run, answers, shown, orders } = await setup(guildArrearsView);
    answers.push(1, true);
    await run('lords.dismissHero');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'confirm']);
    const [pick] = shown;
    if (pick?.kind !== 'pick') {
      throw new Error('esperava a lista dos heróis');
    }
    expect(pick.items.map((item) => [item.label, item.description])).toEqual([
      ['Edda · Guerreira Nv1 · Leal', 'soldo de 2/h'],
      ['Rolf · Arqueiro Nv1 · Prudente', 'soldo de 2/h · descontente'],
    ]);
    expect(orders()).toEqual([dismiss('hero-2')]);
  });

  it('o painel e a árvore mandam o herói, e a confirmação continua: recusada, nada é enviado', async () => {
    const { run, answers, shown, orders } = await setup(guildPaidView);
    answers.push(false, true);
    await run('lords.dismissHero', { heroId: 'hero-3' });
    expect(orders()).toEqual([]);
    await run('lords.dismissHero', { id: 'hero:hero-3', label: 'Isolda' });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['confirm', 'confirm']);
    expect(orders()).toEqual([dismiss('hero-3')]);
  });

  it('duplo acionamento: uma confirmação só, uma dispensa só', async () => {
    const made = await setup(tavernOpenView);
    made.answers.push(true, true);
    const command = made.commands.find((entry) => entry.id === 'lords.dismissHero');
    await Promise.all([command?.run({ heroId: 'hero-1' }), command?.run({ heroId: 'hero-1' })]);
    await settle(made.controller);
    expect(made.shown).toHaveLength(1);
    expect(made.orders()).toEqual([dismiss('hero-1')]);
  });

  it('lê a visão depois da confirmação: o herói que partiu com a pergunta aberta não é dispensado', async () => {
    const made = await setup(tavernOpenView);
    const dialogs = made.dialogs;
    const confirm = dialogs.confirm.bind(dialogs);
    dialogs.confirm = async (options) => {
      await serverShows(made, initialView);
      return confirm(options);
    };
    made.answers.push(true);
    // `createCommands` guardou o objeto `dialogs`: a troca acima vale para o comando.
    await made.run('lords.dismissHero', { heroId: 'hero-1' });
    expect(made.orders()).toEqual([]);
    expect(made.toasts()[0]).toContain('já não serve ao feudo');
  });

  it('sem herói, responde com a frase do servidor que diz como o primeiro chega', async () => {
    const { run, shown, toasts, orders } = await setup(initialView);
    await run('lords.dismissHero');
    expect(shown).toEqual([]);
    expect(toasts()).toEqual([initialView.guild.text]);
    expect(orders()).toEqual([]);
  });
});

describe('dar um festival', () => {
  it('pela paleta e pela árvore, a confirmação mostra o custo e o efeito, nas frases do servidor', async () => {
    const { run, answers, shown, orders } = await setup(tavernOpenView);
    answers.push(false, true);
    await run('lords.holdFestival');
    expect(orders()).toEqual([]);
    await run('lords.holdFestival', { id: 'tavern', label: 'Taverna' });
    expect(shown[1]).toEqual({
      kind: 'confirm',
      title: 'Dar um festival na Taverna?',
      detail: ['Custa 100 comida, 50 ouro.', tavernOpenView.tavern.festival.effectText],
      confirmLabel: 'Dar o festival',
      cancelLabel: 'Agora não',
    });
    expect(orders()).toEqual([FESTIVAL]);
  });

  it('o painel já mostrou o custo ao lado do botão: a ordem segue sem outra pergunta', async () => {
    const { run, shown, orders } = await setup(tavernOpenView);
    await run('lords.holdFestival', { confirmed: true });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([FESTIVAL]);
  });

  it('bloqueado, a paleta responde com o motivo do servidor e não pergunta nada', async () => {
    const busy = await setup(tavernBusyView);
    await busy.run('lords.holdFestival');
    expect(busy.shown).toEqual([]);
    expect(busy.toasts()).toEqual(['Um festival por estação: no Verão o feudo já festejou.']);
    const none = await setup(initialView);
    await none.run('lords.holdFestival');
    expect(none.toasts()).toEqual([initialView.tavern.festival.blockedReason]);
    expect(none.orders()).toEqual([]);
  });

  it('duplo acionamento: uma confirmação e um festival', async () => {
    const made = await setup(tavernOpenView);
    made.answers.push(true, true);
    const command = made.commands.find((entry) => entry.id === 'lords.holdFestival');
    await Promise.all([command?.run(), command?.run()]);
    await settle(made.controller);
    expect(made.shown).toHaveLength(1);
    expect(made.orders()).toEqual([FESTIVAL]);
  });
});

describe('os avisos da equipe no controlador (GDD §13.5)', () => {
  const event = (seq: number, type: GameEvent['type'], text: string) => gameEvent(seq, type, text);

  it('o soldo em atraso que abre vira aviso de alarme, com os prazos da visão, e "Ver" leva à aba Guilda', async () => {
    const made = await setup(guildPaidView);
    await serverShows(made, guildArrearsView, event(1, 'wageArrearsStarted', 'O cofre secou.'));
    const toast = made.controller.toasts.find((entry) => entry.text === 'O cofre secou.');
    expect(toast).toMatchObject({ kind: 'warning', icon: 'compass' });
    expect(toast?.details).toEqual(['Um herói parte em 47 min.']);
    made.controller.navigate('fief');
    await toast?.actions.find((action) => action.label === 'Ver')?.run();
    expect(made.controller.route).toBe('guild');
  });

  it('o herói que partiu e o que chegou por uma carta avisam; o contratado nesta aba, não', async () => {
    const made = await setup(guildPaidView);
    await serverShows(
      made,
      guildPaidView,
      event(1, 'heroLeft', 'Isolda deixou o feudo.'),
      event(2, 'heroJoined', 'Edda passou a servir.'),
      event(3, 'heroHired', 'Mécia aceitou o soldo.'),
    );
    expect(made.controller.toasts.map((toast) => [toast.kind, toast.text])).toEqual([
      ['warning', 'Isolda deixou o feudo.'],
      ['info', 'Edda passou a servir.'],
    ]);
  });

  // Revisão da Fase C (A-R1): a boa notícia que não é a história toda diz o resto.
  it('o atraso que fecha devendo uma partida avisa com tom de alerta e diz quem parte; o herói que chega com o cofre curto leva o prazo', async () => {
    const lingering = {
      text: 'O soldo voltou a ser pago, mas Isolda parte na próxima virada do dia.',
      departureInSeconds: 40 * 60,
    };
    const made = await setup(guildArrearsView);
    await serverShows(
      made,
      withWage(guildPaidView, { lingering }),
      event(1, 'wageArrearsEnded', 'O soldo voltou a ser pago.'),
      event(2, 'heroJoined', 'Rolf passou a servir.'),
    );
    expect(
      made.controller.toasts.map((toast) => [toast.kind, toast.text, toast.details ?? []]),
    ).toEqual([
      ['warning', 'O soldo voltou a ser pago.', [`${lingering.text} A virada vem em 40 min.`]],
      [
        'info',
        'Rolf passou a servir.',
        ['O ouro paga a equipe por mais 23 h: depois disso o soldo atrasa.'],
      ],
    ]);
  });

  it('a barra de status e o título passam a dizer o atraso', async () => {
    const made = await setup(guildPaidView);
    await serverShows(made, guildArrearsView);
    expect(made.controller.title(0)).toContain('Soldo em atraso em Pedra Alta');
  });
});
