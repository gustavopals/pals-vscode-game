import type { GameEvent, ViewState } from '@lotg/protocol';
import { afterEach, describe, expect, it } from 'vitest';

import type { Controller } from '../app/controller';
import type { PickOptions } from '../app/dialogs';
import {
  CLASS_MISSING_REASON,
  denClearedView,
  expeditionCrossroadsView,
  expeditionTravelingView,
  gameEvent,
  heroCapturedView,
  heroInjuredView,
  makeController,
  scriptedDialogs,
  settle,
  tavernOpenView,
  withoutTheClass,
} from '../test-helpers';
import {
  bindCommands,
  type CommandEnv,
  createCommands,
  equipRequest,
  expeditionRequest,
  paletteItems,
  sendRequest,
} from './commands';

/**
 * Os comandos das expedições (roadmap da v0.3, V3D-T4; GDD §13.6): enviar, escolher o caminho,
 * equipar e desequipar têm um caminho só. O painel, a árvore, o aviso, a aba Hoje e a paleta
 * chamam o mesmo comando, que passa por `controller.prepare`; cada fluxo roda um por vez e lê a
 * conta e a visão depois de qualquer espera (§11.1, lição 9).
 */

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

type Made = ReturnType<typeof makeController>;

async function setup(view: ViewState, options: { now?: () => number } = {}) {
  const made = makeController({ signedIn: true, ...options });
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
  const posts = () => made.api.state.requests.filter((entry) => entry.endsWith('/commands'));
  const toasts = () => made.controller.toasts.map((toast) => toast.text);
  const picks = () =>
    scripted.shown.filter((entry) => entry.kind === 'pick') as Array<
      { kind: 'pick' } & PickOptions<unknown>
    >;
  return { ...made, ...scripted, commands, run, orders, posts, toasts, picks, revealed };
}

/** O servidor passa a mostrar outra visão, e a página a lê. */
async function serverShows(made: Made, view: ViewState, ...events: GameEvent[]): Promise<void> {
  made.api.state.view = view;
  made.api.state.stateVersion += 1;
  made.api.state.events.push(...events);
  await made.controller.session.syncNow();
  await settle(made.controller);
}

/** Um relógio que o teste adianta. */
const clock = () => {
  let now = Date.parse('2026-10-06T12:00:00.000Z');
  return { now: () => now, advance: (ms: number) => void (now += ms) };
};

const path = (expeditionId: string, optionId: string) => ({
  type: 'chooseExpeditionPath',
  payload: { expeditionId, optionId },
});
const sent = (modelId: string, heroIds: string[], posture: string) => ({
  type: 'sendExpedition',
  payload: { modelId, heroIds, posture },
});

describe('os comandos das expedições na paleta (GDD §13.6)', () => {
  it('a paleta tem "Enviar expedição…", "Escolher caminho da expedição…", "Equipar herói…" e "Desequipar herói…"', async () => {
    const { commands } = await setup(heroInjuredView);
    const labels = paletteItems(commands).map((item) => item.label);
    expect(labels).toEqual(
      expect.arrayContaining([
        'Lords: Enviar expedição…',
        'Lords: Escolher caminho da expedição…',
        'Lords: Equipar herói…',
        'Lords: Desequipar herói…',
      ]),
    );
    // "Ver o relatório" é de uso interno: não aparece na paleta.
    expect(labels.some((label) => label.includes('openReport'))).toBe(false);
  });

  it('`openPanel` leva às seções da aba Guilda: expedições, relatórios e arsenal', async () => {
    const { run, controller, revealed } = await setup(heroInjuredView);
    for (const section of ['expeditions', 'reports', 'arsenal']) {
      controller.navigate('fief');
      await run('lords.openPanel', section);
      expect(controller.route).toBe('guild');
    }
    expect(revealed).toEqual(['expeditions-title', 'reports-title', 'arsenal-title']);
  });

  it('o que cada superfície manda é lido do mesmo jeito', () => {
    expect(expeditionRequest({ expeditionId: 'expedition-2', optionId: 'stream' })).toEqual({
      expeditionId: 'expedition-2',
      optionId: 'stream',
    });
    expect(expeditionRequest({ id: 'expedition:expedition-2' })).toEqual({
      expeditionId: 'expedition-2',
    });
    expect(expeditionRequest('expedition-2')).toEqual({ expeditionId: 'expedition-2' });
    expect(expeditionRequest({ id: 'hero:hero-1' })).toEqual({});
    expect(expeditionRequest(undefined)).toEqual({});
    expect(sendRequest('rescue')).toEqual({ modelId: 'rescue' });
    expect(sendRequest({ modelId: 'patrol', heroIds: ['hero-1'], posture: 'bold' })).toEqual({
      modelId: 'patrol',
      heroIds: ['hero-1'],
      posture: 'bold',
    });
    // Uma Postura que não existe, ou uma equipe que não é lista de nomes, não segue.
    expect(sendRequest({ modelId: 'patrol', heroIds: [1], posture: 'reckless' })).toEqual({
      modelId: 'patrol',
    });
    expect(sendRequest({ id: 'guild' })).toEqual({});
    expect(equipRequest({ heroId: 'hero-1', slot: 'weapon' })).toEqual({
      heroId: 'hero-1',
      slot: 'weapon',
    });
    expect(equipRequest({ itemId: 'item-2', slot: 'boots' })).toEqual({ itemId: 'item-2' });
  });
});

describe('escolher o caminho', () => {
  it('pelo painel: a expedição e a opção do botão seguem direto, em uma ordem só', async () => {
    const { run, orders, shown } = await setup(expeditionCrossroadsView);
    await run('lords.chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'stream' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([path('expedition-2', 'stream')]);
  });

  it('pela paleta: a lista traz a situação, o prazo real, o que a Postura fará e cada caminho com a pista', async () => {
    const { run, answers, picks, orders } = await setup(expeditionCrossroadsView);
    const [expedition] = expeditionCrossroadsView.guild.expeditions;
    const crossroads = expedition?.crossroads;
    answers.push(0);
    await run('lords.chooseExpeditionPath');
    // Uma equipe só espera: a paleta vai direto aos caminhos.
    const [list] = picks();
    expect(picks()).toHaveLength(1);
    expect(list?.title).toBe('Encruzilhada: Floresta Antiga');
    expect(list?.detail).toEqual([
      'A trilha se divide · Edda e Rolf',
      crossroads?.text,
      'Expira em 5 h. Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.',
    ]);
    expect(list?.items.map((item) => item.label)).toEqual(
      crossroads?.options.map((option) => option.label),
    );
    for (const [index, option] of (crossroads?.options ?? []).entries()) {
      expect(list?.items[index]?.detail).toContain(option.hint);
    }
    // O que já vem marcado é a opção da Postura, dita por extenso.
    expect(list?.selected).toBe(1);
    expect(list?.items[1]?.detail).toContain(
      'É o que a Postura Equilibrada escolhe, se o prazo acabar.',
    );
    expect(orders()).toEqual([path('expedition-2', 'thicket')]);
  });

  it('pela árvore, pelo aviso e pela aba Hoje: a expedição vem dada, e a lista pergunta o caminho', async () => {
    for (const arg of [
      { id: 'expedition:expedition-2' },
      { expeditionId: 'expedition-2' },
      'expedition-2',
    ]) {
      const { run, answers, picks, orders } = await setup(expeditionCrossroadsView);
      answers.push(2);
      await run('lords.chooseExpeditionPath', arg);
      expect(picks()).toHaveLength(1);
      expect(orders()).toEqual([path('expedition-2', 'turnBack')]);
    }
  });

  it('a opção bloqueada vem com cadeado e o requisito; desistir da lista não envia nada', async () => {
    const [expedition] = expeditionCrossroadsView.guild.expeditions;
    if (expedition === undefined || expedition.crossroads === null) {
      throw new Error('Sem equipe na encruzilhada.');
    }
    const locked: ViewState = {
      ...expeditionCrossroadsView,
      guild: {
        ...expeditionCrossroadsView.guild,
        expeditions: [
          {
            ...expedition,
            crossroads: {
              ...expedition.crossroads,
              options: expedition.crossroads.options.map((option, index) =>
                index === 0
                  ? { ...option, locked: true, lockedReason: 'Requer um Guerreiro na equipe.' }
                  : option,
              ),
            },
          },
        ],
      },
    };
    const { run, answers, picks, orders } = await setup(locked);
    answers.push(undefined);
    await run('lords.chooseExpeditionPath');
    expect(picks()[0]?.items[0]).toMatchObject({ icon: 'lock' });
    expect(picks()[0]?.items[0]?.detail).toContain('Requer um Guerreiro na equipe.');
    expect(orders()).toEqual([]);
  });

  it('sem equipe na encruzilhada, a paleta diz isso e não abre lista', async () => {
    const { run, shown, toasts, orders } = await setup(expeditionTravelingView);
    await run('lords.chooseExpeditionPath');
    expect(shown).toEqual([]);
    expect(toasts()).toEqual(['Nenhuma equipe espera em uma encruzilhada agora.']);
    expect(orders()).toEqual([]);
  });

  it('a linha de uma encruzilhada que já foi decidida avisa, sem enviar', async () => {
    const { run, shown, toasts, orders } = await setup(expeditionTravelingView);
    await run('lords.chooseExpeditionPath', { id: 'expedition:expedition-9' });
    expect(shown).toEqual([]);
    expect(toasts()).toEqual([
      'Esta equipe já não espera na encruzilhada: o caminho foi escolhido, ou o prazo acabou e a Postura decidiu.',
    ]);
    expect(orders()).toEqual([]);
  });

  it('o prazo vence com a lista aberta: a lista fecha sozinha, avisa e não envia', async () => {
    const time = clock();
    const made = await setup(expeditionCrossroadsView, { now: time.now });
    const { run, answers, picks, orders, posts, controller } = made;
    answers.push(async () => {
      // Com a lista aberta, o prazo acaba e a leitura seguinte traz a equipe já a caminho.
      time.advance((19_198 + 1) * 1000);
      await serverShows(made, expeditionTravelingView);
      return 'thicket';
    });
    await run('lords.chooseExpeditionPath');
    expect(picks()[0]?.signal?.aborted).toBe(true);
    expect(orders()).toEqual([]);
    expect(posts()).toEqual([]);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({
      kind: 'warning',
      text: 'O prazo da encruzilhada de "Floresta Antiga" acabou antes da sua palavra, e a Postura Equilibrada decidiu. Nada foi enviado: a Crônica conta o caminho.',
    });
  });

  it('outra aba escolheu com a lista aberta: diz isso, e não que o prazo acabou', async () => {
    const time = clock();
    const made = await setup(expeditionCrossroadsView, { now: time.now });
    const { run, answers, orders, controller } = made;
    answers.push(async () => {
      time.advance(60_000);
      await serverShows(made, expeditionTravelingView);
      return 'thicket';
    });
    await run('lords.chooseExpeditionPath');
    expect(orders()).toEqual([]);
    expect(controller.toasts[0]?.text).toBe(
      'A encruzilhada de "Floresta Antiga" já foi decidida: em outra aba ou em outro navegador. Nada foi enviado.',
    );
  });

  it('a recusa CROSSROADS_DECIDED vira aviso com a frase do servidor, e a visão nova toma a tela', async () => {
    const { run, api, controller, toasts } = await setup(expeditionCrossroadsView);
    // O servidor já decidiu: a recusa traz a visão de agora, sem a encruzilhada.
    api.state.view = expeditionTravelingView;
    api.refuseNextCommand(
      'Essa encruzilhada já foi decidida: a equipe seguiu viagem.',
      'CROSSROADS_DECIDED',
    );
    await run('lords.chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'stream' });
    expect(toasts()).toEqual(['Essa encruzilhada já foi decidida: a equipe seguiu viagem.']);
    expect(controller.view?.pendingDecisions).toEqual([]);
    expect(controller.view?.guild.expeditions.every((entry) => entry.crossroads === null)).toBe(
      true,
    );
    // A trava da encruzilhada foi solta: nada fica "a caminho".
    expect(controller.guildOrders.size).toBe(0);
  });

  it('duplo acionamento do mesmo caminho envia uma ordem só', async () => {
    const { commands, controller, orders, posts } = await setup(expeditionCrossroadsView);
    const choose = commands.find((command) => command.id === 'lords.chooseExpeditionPath');
    const arg = { expeditionId: 'expedition-2', optionId: 'stream' };
    await Promise.all([choose?.run(arg), choose?.run(arg)]);
    await settle(controller);
    expect(orders()).toEqual([path('expedition-2', 'stream')]);
    expect(posts()).toHaveLength(1);
  });

  it('com duas equipes esperando, a paleta pergunta qual, com o prazo de cada uma', async () => {
    const [expedition] = expeditionCrossroadsView.guild.expeditions;
    if (expedition === undefined) {
      throw new Error('Sem equipe na encruzilhada.');
    }
    const two: ViewState = {
      ...expeditionCrossroadsView,
      guild: {
        ...expeditionCrossroadsView.guild,
        expeditions: [expedition, { ...expedition, id: 'expedition-3', label: 'Covil de Lobos' }],
      },
    };
    const { run, answers, picks, orders } = await setup(two);
    answers.push(1, 0);
    await run('lords.chooseExpeditionPath');
    expect(picks()[0]?.title).toBe('Escolher caminho da expedição');
    expect(picks()[0]?.items.map((item) => [item.label, item.description])).toEqual([
      ['Floresta Antiga', 'expira em 5 h'],
      ['Covil de Lobos', 'expira em 5 h'],
    ]);
    expect(orders()).toEqual([path('expedition-3', 'thicket')]);
  });
});

describe('enviar expedição', () => {
  it('pelo painel: o destino, a equipe e a Postura seguem direto, em uma ordem só', async () => {
    const { run, orders, shown } = await setup(heroInjuredView);
    await run('lords.sendExpedition', {
      modelId: 'patrol',
      heroIds: ['hero-2'],
      posture: 'cautious',
    });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([sent('patrol', ['hero-2'], 'cautious')]);
  });

  it('pela paleta: pergunta o destino, a equipe e a Postura, em listas, e envia uma vez', async () => {
    const { run, answers, picks, orders, posts } = await setup(heroInjuredView);
    // A Patrulha, Rolf (o único que pode partir) e a Postura Ousada.
    answers.push(0, 0, 2);
    await run('lords.sendExpedition');
    const [destinations, team, postures] = picks();
    expect(picks()).toHaveLength(3);
    // Os destinos: o risco, a duração real, o que a equipe precisa e o primeiro trecho.
    expect(destinations?.title).toBe('Enviar expedição');
    expect(destinations?.detail).toEqual([heroInjuredView.guild.text]);
    const [patrol, , den] = heroInjuredView.guild.available;
    expect(destinations?.items[0]).toMatchObject({ icon: 'check', label: patrol?.label });
    expect(destinations?.items[0]?.description).toMatch(/^Risco baixo · dura \d+ min$/);
    expect(destinations?.items[0]?.detail).toContain(patrol?.firstStretchText);
    // O Covil pede dois e só há um: cadeado, com o motivo.
    expect(destinations?.items[2]).toMatchObject({ icon: 'lock', label: den?.label });
    expect(destinations?.items[2]?.detail).toContain(den?.sendBlockedReason);
    // A equipe: quem pode partir, com o que vale contra o primeiro trecho.
    expect(team?.title).toBe('Enviar expedição: Patrulha dos Arredores');
    expect(team?.placeholder).toBe('Quem vai? A equipe leva 1 herói.');
    expect(team?.detail).toEqual([
      patrol?.requirementsText,
      patrol?.firstStretchText,
      patrol?.fit?.text,
    ]);
    expect(team?.items.map((item) => item.label)).toEqual(['Rolf · Arqueiro Nv1 · Prudente']);
    expect(team?.items[0]?.description).toMatch(/^vale [\d,]+ contra o primeiro trecho$/);
    // A Postura: as três, cada uma com o que faz na encruzilhada, na frase do servidor.
    expect(postures?.items.map((item) => [item.label, item.detail])).toEqual(
      heroInjuredView.guild.postures.map((posture) => [posture.label, posture.text]),
    );
    expect(postures?.selected).toBe(1);
    expect(orders()).toEqual([sent('patrol', ['hero-2'], 'bold')]);
    expect(posts()).toHaveLength(1);
  });

  it('a equipe de mais de um: a lista volta até a equipe fechar, ou até "Partir com…"', async () => {
    // A Floresta leva de 1 a 2: Edda, depois Rolf, e a equipe está cheia.
    const full = await setup(denClearedView);
    full.answers.push(1, 1, 1, 1);
    await full.run('lords.sendExpedition');
    expect(full.picks()).toHaveLength(4);
    // Com gente bastante marcada, a primeira linha é partir com quem já foi escolhido.
    expect(full.picks()[2]?.items.map((item) => item.label)).toEqual([
      'Partir com Edda',
      'Rolf · Arqueiro Nv10 · Ganancioso',
    ]);
    expect(full.picks()[2]?.placeholder).toBe('Mais alguém? A equipe leva de 1 a 2 heróis.');
    expect(full.orders()).toEqual([sent('oldForest', ['hero-1', 'hero-2'], 'balanced')]);
    // Ou só com Edda.
    const alone = await setup(denClearedView);
    alone.answers.push(1, 1, 0, 0);
    await alone.run('lords.sendExpedition');
    expect(alone.orders()).toEqual([sent('oldForest', ['hero-1'], 'cautious')]);
  });

  it('havendo escolha, a primeira lista abre com a equipe que a visão sugere, pronta para partir', async () => {
    // Na Patrulha de quem tem Rolf e Brann prontos, a visão sugere Brann, o segundo da ficha.
    const { run, answers, picks, orders } = await setup(heroCapturedView);
    answers.push(0, 0, 1);
    await run('lords.sendExpedition');
    expect(picks()[1]?.items.map((item) => [item.label, item.description])[0]).toEqual([
      'Partir com Brann',
      'a equipe sugerida',
    ]);
    expect(picks()[1]?.items).toHaveLength(3);
    expect(orders()).toEqual([sent('patrol', ['hero-3'], 'balanced')]);
  });

  it('o destino que pede uma classe que o feudo não tem: cadeado, o motivo do servidor e nenhuma lista de equipe (revisão, A1)', async () => {
    const view = withoutTheClass(denClearedView, 'oldForest');
    // Pela paleta: o destino vem com cadeado e o motivo; escolhido mesmo assim, nada se pergunta.
    const palette = await setup(view);
    palette.answers.push(1);
    await palette.run('lords.sendExpedition');
    expect(palette.picks()).toHaveLength(1);
    expect(palette.picks()[0]?.items[1]).toMatchObject({ icon: 'lock' });
    expect(palette.picks()[0]?.items[1]?.detail).toContain(CLASS_MISSING_REASON);
    expect(palette.toasts()).toEqual([`"Floresta Antiga": ${CLASS_MISSING_REASON}`]);
    expect(palette.orders()).toEqual([]);
    // Com o destino dado (um botão, a árvore): o mesmo aviso, sem lista.
    const direct = await setup(view);
    await direct.run('lords.sendExpedition', 'oldForest');
    expect(direct.picks()).toEqual([]);
    expect(direct.toasts()).toEqual([`"Floresta Antiga": ${CLASS_MISSING_REASON}`]);
    // Sem nenhum destino que possa partir, a paleta diz o motivo do servidor e não abre lista.
    const none = await setup(withoutTheClass(withoutTheClass(view, 'patrol'), 'wolfDen'));
    await none.run('lords.sendExpedition');
    expect(none.picks()).toEqual([]);
    expect(none.toasts()).toEqual([CLASS_MISSING_REASON]);
  });

  it('"Enviar o Resgate" já traz o destino: a lista começa pela equipe', async () => {
    const { run, answers, picks, orders } = await setup(heroCapturedView);
    answers.push(0, 0, 1);
    await run('lords.sendExpedition', 'rescue');
    expect(picks()[0]?.title).toBe('Enviar expedição: Resgate');
    // O Resgate pede dois: a segunda lista só tem quem sobrou, sem "Partir com…".
    expect(picks()[1]?.items.map((item) => item.label)).toEqual([
      expect.stringMatching(/^Brann · /),
    ]);
    expect(orders()).toEqual([sent('rescue', ['hero-2', 'hero-3'], 'balanced')]);
  });

  it('desistir em qualquer lista não envia nada', async () => {
    for (const script of [[undefined], [0, undefined], [0, 0, undefined]]) {
      const { run, answers, orders } = await setup(heroInjuredView);
      answers.push(...script);
      await run('lords.sendExpedition');
      expect(orders()).toEqual([]);
    }
  });

  it('sem a Guilda dos Aventureiros, diz o que a abre, na frase do servidor', async () => {
    const { run, shown, toasts, orders } = await setup(tavernOpenView);
    await run('lords.sendExpedition');
    expect(shown).toEqual([]);
    expect(toasts()).toEqual([tavernOpenView.guild.text]);
    expect(orders()).toEqual([]);
  });

  it('com todos os lugares ocupados, diz o motivo do servidor e não abre lista', async () => {
    const { run, shown, toasts } = await setup(expeditionTravelingView);
    await run('lords.sendExpedition');
    expect(shown).toEqual([]);
    expect(toasts()).toEqual([expeditionTravelingView.guild.available[0]?.lockedReason]);
  });

  it('o destino some com a lista aberta: nada é enviado', async () => {
    const made = await setup(heroCapturedView);
    const { run, answers, orders, toasts } = made;
    answers.push(async () => {
      // O cativo foi resgatado em outra aba: o Resgate sai da lista da Guilda.
      await serverShows(made, heroInjuredView);
      return 'hero-2';
    });
    await run('lords.sendExpedition', 'rescue');
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual(['Este destino já não está na lista da Guilda. Nada foi enviado.']);
  });

  it('a sessão termina com a lista aberta: nada é enviado', async () => {
    const made = await setup(heroInjuredView);
    const { run, answers, orders, controller } = made;
    answers.push(async () => {
      await controller.signOut();
      return 0;
    });
    await run('lords.sendExpedition');
    expect(orders()).toEqual([]);
  });

  it('duplo acionamento do mesmo envio manda uma ordem só', async () => {
    const { commands, controller, orders, posts } = await setup(heroInjuredView);
    const send = commands.find((command) => command.id === 'lords.sendExpedition');
    const arg = { modelId: 'patrol', heroIds: ['hero-2'], posture: 'balanced' };
    await Promise.all([send?.run(arg), send?.run(arg)]);
    await settle(controller);
    expect(orders()).toEqual([sent('patrol', ['hero-2'], 'balanced')]);
    expect(posts()).toHaveLength(1);
  });

  it('a recusa do servidor vira aviso com a frase dele', async () => {
    const { run, api, toasts } = await setup(heroInjuredView);
    api.refuseNextCommand('Rolf está fora do feudo.', 'HERO_BUSY');
    await run('lords.sendExpedition', {
      modelId: 'patrol',
      heroIds: ['hero-2'],
      posture: 'balanced',
    });
    expect(toasts()).toEqual(['Rolf está fora do feudo.']);
  });
});

describe('equipar e desequipar', () => {
  const [item] = heroInjuredView.guild.inventory;
  const itemId = item?.id ?? '';
  const equip = (heroId: string) => ({ type: 'equipItem', payload: { heroId, itemId } });

  it('com o herói e o item dados, a ordem segue direto', async () => {
    const { run, orders, shown } = await setup(heroInjuredView);
    await run('lords.equipItem', { heroId: 'hero-1', itemId });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([equip('hero-1')]);
  });

  it('pelo arsenal: o item vem dado, e a lista pergunta quem leva, com o que cada um tem hoje', async () => {
    const { run, answers, picks, orders } = await setup(heroInjuredView);
    answers.push(1);
    await run('lords.equipItem', { itemId });
    const [who] = picks();
    expect(who?.title).toBe(`Equipar: ${item?.label}`);
    expect(who?.placeholder).toBe(`Quem leva? ${item?.bonusText}`);
    expect(who?.items.map((entry) => [entry.label, entry.detail])).toEqual([
      ['Edda · Guerreira Nv2 · Leal', 'Acessório: vazio.'],
      ['Rolf · Arqueiro Nv1 · Prudente', 'Acessório: vazio.'],
    ]);
    expect(orders()).toEqual([equip('hero-2')]);
  });

  it('pela ficha: o herói e o espaço vêm dados, e a lista traz os itens daquele espaço', async () => {
    const { run, answers, picks, orders } = await setup(heroInjuredView);
    answers.push(0);
    await run('lords.equipItem', { heroId: 'hero-1', slot: 'accessory' });
    expect(picks()[0]?.title).toBe('Equipar Edda');
    expect(picks()[0]?.items.map((entry) => [entry.description, entry.detail])).toEqual([
      [item?.bonusText, item?.text],
    ]);
    expect(orders()).toEqual([equip('hero-1')]);
    // Sem item para o espaço, diz isso e não abre lista.
    const none = await setup(heroInjuredView);
    await none.run('lords.equipItem', { heroId: 'hero-1', slot: 'armor' });
    expect(none.shown).toEqual([]);
    expect(none.toasts()).toEqual(['O arsenal não tem item para este espaço.']);
  });

  it('pela paleta: pergunta o item e depois o herói', async () => {
    const { run, answers, picks, orders } = await setup(heroInjuredView);
    answers.push(0, 0);
    await run('lords.equipItem');
    expect(picks().map((pick) => pick.title)).toEqual(['Equipar herói', `Equipar: ${item?.label}`]);
    expect(picks()[0]?.detail).toEqual([heroInjuredView.guild.inventoryText]);
    expect(orders()).toEqual([equip('hero-1')]);
  });

  it('com o arsenal vazio, diz a frase do servidor', async () => {
    const { run, shown, toasts } = await setup(denClearedView);
    await run('lords.equipItem');
    expect(shown).toEqual([]);
    expect(toasts()).toEqual([denClearedView.guild.inventoryText]);
  });

  it('o item sai do arsenal com a lista aberta: nada é enviado', async () => {
    const made = await setup(heroInjuredView);
    const { run, answers, orders, toasts } = made;
    answers.push(async () => {
      await serverShows(made, {
        ...heroInjuredView,
        guild: { ...heroInjuredView.guild, inventory: [] },
      });
      return 0;
    });
    await run('lords.equipItem', { itemId });
    expect(orders()).toEqual([]);
    expect(toasts()).toEqual(['Este item já não está no arsenal. Nada foi enviado.']);
  });

  it('desequipar pela ficha segue direto; pela paleta, a lista traz o que cada um leva', async () => {
    const direct = await setup(heroInjuredView);
    await direct.run('lords.unequipItem', { heroId: 'hero-2', slot: 'weapon' });
    expect(direct.orders()).toEqual([
      { type: 'unequipItem', payload: { heroId: 'hero-2', slot: 'weapon' } },
    ]);
    const { run, answers, picks, orders } = await setup(heroInjuredView);
    answers.push(0);
    await run('lords.unequipItem');
    expect(picks()[0]?.items.map((entry) => entry.label)).toEqual(['Rolf · Arco de freixo']);
    expect(orders()).toEqual([
      { type: 'unequipItem', payload: { heroId: 'hero-2', slot: 'weapon' } },
    ]);
    // Ninguém no feudo leva item: diz isso.
    const none = await setup(denClearedView);
    await none.run('lords.unequipItem');
    expect(none.toasts()).toEqual(['Nenhum herói no feudo leva item agora.']);
  });

  it('duas trocas do mesmo herói ao mesmo tempo: só a primeira vira ordem', async () => {
    const { commands, controller, orders } = await setup(heroInjuredView);
    const equipCommand = commands.find((command) => command.id === 'lords.equipItem');
    const arg = { heroId: 'hero-1', itemId };
    await Promise.all([equipCommand?.run(arg), equipCommand?.run(arg)]);
    await settle(controller);
    expect(orders()).toEqual([equip('hero-1')]);
  });
});

describe('"Ver o relatório"', () => {
  it('abre a aba Guilda na folha da expedição, se ela ainda está guardada', async () => {
    const { run, controller, revealed } = await setup(heroInjuredView);
    const [report] = heroInjuredView.guild.reports;
    await run('lords.openReport', report?.expeditionId);
    expect(controller.route).toBe('guild');
    expect(controller.reportInFocus).toBe(report?.expeditionId);
    expect(revealed).toEqual([`report-${report?.expeditionId}`]);
  });

  it('o relatório que já saiu da lista leva só à seção dos relatórios', async () => {
    const { run, controller, revealed } = await setup(heroInjuredView);
    await run('lords.openReport', 'expedition-0');
    expect(controller.route).toBe('guild');
    expect(controller.reportInFocus).toBeNull();
    expect(revealed).toEqual(['reports-title']);
  });
});

describe('os avisos das expedições (GDD §13.5)', () => {
  const arrived = (seq: number): GameEvent => ({
    ...gameEvent(seq, 'expeditionAtCrossroads', 'A expedição chegou a uma encruzilhada.'),
    data: { expeditionId: 'expedition-2' },
  });

  it('a encruzilhada chega como aviso essencial, com o prazo, o que a Postura fará e "Escolher caminho"', async () => {
    const made = await setup(expeditionTravelingView);
    const { controller, answers, orders, picks } = made;
    await serverShows(made, expeditionCrossroadsView, arrived(1));
    const [toast] = controller.toasts;
    expect(controller.toasts).toHaveLength(1);
    expect(toast).toMatchObject({
      kind: 'info',
      icon: 'git-compare',
      text: 'Encruzilhada em Floresta Antiga: A trilha se divide',
    });
    expect(toast?.details?.[0]).toMatch(/^A equipe espera a sua palavra por 5 h, até /);
    expect(toast?.details?.[1]).toBe(
      'Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho.',
    );
    expect(toast?.actions.map((action) => action.label)).toEqual([
      'Escolher caminho',
      'Silenciar 2h',
    ]);
    // O botão abre a lista dos caminhos, pelo mesmo comando da paleta.
    answers.push(1);
    await toast?.actions[0]?.run();
    await settle(controller);
    expect(controller.route).toBe('guild');
    expect(picks()[0]?.title).toBe('Encruzilhada: Floresta Antiga');
    expect(orders()).toEqual([path('expedition-2', 'stream')]);
  });

  it('o aviso sai de cena quando a equipe deixa de esperar', async () => {
    const made = await setup(expeditionTravelingView);
    await serverShows(made, expeditionCrossroadsView, arrived(1));
    expect(made.controller.toasts).toHaveLength(1);
    await serverShows(made, expeditionTravelingView);
    expect(made.controller.toasts).toEqual([]);
  });

  it('quem já está na aba Guilda, com ela à vista, não recebe o aviso por cima', async () => {
    const made = await setup(expeditionTravelingView);
    made.controller.setVisible(true);
    made.controller.navigate('guild');
    await serverShows(made, expeditionCrossroadsView, arrived(1));
    expect(made.controller.toasts).toEqual([]);
  });

  it('a volta de uma expedição, em "Todas", leva ao relatório dela', async () => {
    const made = await setup(expeditionTravelingView);
    const { controller, revealed } = made;
    await controller.setPreferences({ notifications: 'all' });
    const [report] = heroInjuredView.guild.reports;
    await serverShows(made, heroInjuredView, {
      ...gameEvent(1, 'expeditionReturned', 'A expedição voltou com madeira.'),
      data: { expeditionId: report?.expeditionId ?? '' },
    });
    const [toast] = controller.toasts;
    expect(toast).toMatchObject({ kind: 'info', text: 'A expedição voltou com madeira.' });
    expect(toast?.actions[0]?.label).toBe('Ver o relatório');
    await toast?.actions[0]?.run();
    await settle(controller);
    expect(controller.route).toBe('guild');
    expect(controller.reportInFocus).toBe(report?.expeditionId);
    expect(revealed).toEqual([`report-${report?.expeditionId}`]);
  });
});
