import { memoryTokenStore } from '@lotg/client-sdk';
import { DisplayNameSchema, type ViewState } from '@lotg/protocol';
import { h } from 'preact';
import { renderToString } from 'preact-render-to-string';
import { afterEach, describe, expect, it } from 'vitest';

import type { AccountState } from '../account/accountService';
import type { Controller } from '../app/controller';
import { DialogService, type DialogState, filterItems } from '../app/dialogs';
import { loadPreferences, type ThemeId } from '../services/preferences';
import {
  ACCOUNT_ID,
  catalogFixture,
  fakeApi,
  gameEvent,
  goldenView,
  makeController,
  scriptedDialogs,
  settle,
} from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { isPaletteShortcut, openPalette, QuickPick } from './CommandPalette';
import {
  type AppCommand,
  bindCommands,
  type CommandEnv,
  createCommands,
  NAME_RULE,
  PALETTE_PREFIX,
  paletteItems,
  PRIVACY_PARAGRAPHS,
  workersPreview,
  workersValidation,
} from './commands';

// O código-fonte é lido como texto pelo Vitest, para achar os comandos que a interface usa.
const sources = import.meta.glob<string>('../**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const building: ViewState = {
  ...goldenView,
  constructions: {
    ...goldenView.constructions,
    active: {
      building: 'lumberMill',
      label: 'Serraria',
      targetLevel: 2,
      secondsRemaining: 2520,
      totalSeconds: 3000,
      progressPercent: 16,
      refund: [
        { resource: 'wood', label: 'Madeira', amount: 80, lost: 0 },
        { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
      ],
    },
  },
};

const VALID_CODE = 'PEDR-7F3A-K9QD-M2XW-4HTB';
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

const controllers: Controller[] = [];
afterEach(() => {
  for (const controller of controllers.splice(0)) {
    controller.dispose();
  }
});

type SetupOptions = {
  signedIn?: boolean;
  /** Mexe na API de mentira e no armazenamento antes de o app abrir. */
  before?: (made: ReturnType<typeof makeController>) => void;
  api?: ReturnType<typeof fakeApi>;
  overrides?: NonNullable<Parameters<typeof makeController>[0]>['overrides'];
  now?: () => number;
};

/** O app aberto, com os comandos ligados, diálogos por roteiro e um navegador de mentira. */
async function setup(options: SetupOptions = {}) {
  const made = makeController({
    signedIn: options.signedIn ?? true,
    ...(options.api ? { api: options.api } : {}),
    ...(options.overrides ? { overrides: options.overrides } : {}),
    ...(options.now ? { now: options.now } : {}),
  });
  controllers.push(made.controller);
  options.before?.(made);
  const scripted = scriptedDialogs();
  const browser = {
    downloads: [] as Array<{ filename: string; content: string }>,
    reloads: 0,
    sleeps: [] as number[],
    paletteOpened: 0,
    theme: 'dark' as ThemeId,
  };
  const env: CommandEnv = {
    download: (filename, content) => browser.downloads.push({ filename, content }),
    reload: () => {
      browser.reloads += 1;
    },
    sleep: async (ms) => {
      browser.sleeps.push(ms);
    },
    currentTheme: () => browser.theme,
    openPalette: () => {
      browser.paletteOpened += 1;
    },
  };
  const commands = createCommands(made.controller, scripted.dialogs, env);
  bindCommands(made.controller, commands);
  await made.controller.start();
  await settle(made.controller);
  const command = (id: string): AppCommand => {
    const found = commands.find((candidate) => candidate.id === id);
    if (found === undefined) {
      throw new Error(`Comando ${id} não existe.`);
    }
    return found;
  };
  const run = async (id: string, arg?: unknown) => {
    await command(id).run(arg);
    await settle(made.controller);
  };
  /** As ordens que chegaram ao servidor, sem o `commandId`. */
  const orders = () => made.api.state.commands.map(({ type, payload }) => ({ type, payload }));
  const requested = (request: string) =>
    made.api.state.requests.filter((entry) => entry === request).length;
  const labels = () => paletteItems(commands).map((item) => item.label);
  return { ...made, ...scripted, browser, env, commands, command, run, orders, requested, labels };
}

/** O diálogo de número `index` na ordem em que foram mostrados, do tipo esperado. */
function shownAs<K extends 'confirm' | 'input' | 'pick' | 'info'>(
  shown: ReturnType<typeof scriptedDialogs>['shown'],
  index: number,
  kind: K,
) {
  const entry = shown[index];
  if (entry === undefined || entry.kind !== kind) {
    throw new Error(`O diálogo ${index} deveria ser "${kind}", mas é "${entry?.kind}".`);
  }
  return entry as Extract<(typeof shown)[number], { kind: K }>;
}

const key = (
  name: string,
  modifiers: Partial<{
    ctrlKey: boolean;
    metaKey: boolean;
    shiftKey: boolean;
    altKey: boolean;
  }> = {},
) => ({ key: name, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false, ...modifiers });

const everyNode = (nodes: TreeNode[]): TreeNode[] =>
  nodes.flatMap((node) => [node, ...everyNode(node.children ?? [])]);

describe('atalho da paleta (isPaletteShortcut)', () => {
  it('abre com F1 e com Ctrl+K ou Cmd+K', () => {
    expect(isPaletteShortcut(key('F1'))).toBe(true);
    expect(isPaletteShortcut(key('k', { ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(key('k', { metaKey: true }))).toBe(true);
    // Com o Caps Lock ligado a tecla chega em maiúscula.
    expect(isPaletteShortcut(key('K', { ctrlKey: true }))).toBe(true);
  });

  it('não toma os atalhos que o navegador reserva', () => {
    expect(isPaletteShortcut(key('p', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('P', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('p', { ctrlKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('p', { metaKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('w', { ctrlKey: true }))).toBe(false);
  });

  it('não abre com a letra k sozinha nem com outras combinações', () => {
    expect(isPaletteShortcut(key('k'))).toBe(false);
    expect(isPaletteShortcut(key('K', { shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('k', { ctrlKey: true, shiftKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('k', { ctrlKey: true, altKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('k', { altKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('F1', { altKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('F1', { ctrlKey: true }))).toBe(false);
    expect(isPaletteShortcut(key('F2'))).toBe(false);
    expect(isPaletteShortcut(key('Enter'))).toBe(false);
  });
});

describe('lista de escolha (QuickPick)', () => {
  const items = ['Camponês', 'Senhor', 'Rei de Ferro'].map((label) => ({
    label,
    detail: `Frase de ${label}.`,
    value: label,
  }));
  const draw = (selected?: number) =>
    renderToString(h(QuickPick, { title: 'Dificuldade', items, selected, onPick: () => {} }));
  const marked = (markup: string) =>
    (markup.match(/<li[^>]*>/g) ?? []).map((tag) => /aria-selected="true"/.test(tag));

  it('sem padrão, o primeiro item vem marcado', () => {
    const markup = draw();
    expect(marked(markup)).toEqual([true, false, false]);
    expect(markup).toContain('aria-activedescendant="quickpick-0"');
  });

  it('com padrão, o item indicado já vem marcado: Enter sem mexer em nada o escolhe', () => {
    const markup = draw(1);
    expect(marked(markup)).toEqual([false, true, false]);
    expect(markup).toContain('aria-activedescendant="quickpick-1"');
  });

  it('um padrão fora da lista não quebra: vale o item mais próximo', () => {
    expect(marked(draw(9))).toEqual([false, false, true]);
    expect(marked(draw(-1))).toEqual([true, false, false]);
  });

  it('a frase de cada opção fica à vista na lista', () => {
    const markup = draw(1);
    for (const item of items) {
      expect(markup).toContain(item.detail);
    }
  });
});

describe('itens da paleta (paletteItems)', () => {
  it('todo item começa com "Lords: " e nenhum mostra um id interno', async () => {
    for (const signedIn of [false, true]) {
      const { labels } = await setup({ signedIn });
      expect(labels().length).toBeGreaterThan(5);
      for (const label of labels()) {
        expect(label.startsWith('Lords: ')).toBe(true);
        expect(label).not.toContain('lords.');
        expect(label.length).toBeGreaterThan(PALETTE_PREFIX.length + 3);
      }
      expect(new Set(labels()).size).toBe(labels().length);
    }
  });

  it('sem conta: jogar, entrar e o que não depende de feudo', async () => {
    const { labels } = await setup({ signedIn: false });
    expect(labels()).toEqual(
      expect.arrayContaining([
        'Lords: Jogar agora',
        'Lords: Conta: entrar com GitHub',
        'Lords: Conta: entrar com Código do Reino',
        'Lords: Trocar tema',
        'Lords: Ligar ou desligar o modo discreto',
        'Lords: Privacidade',
        'Lords: Preferências',
        'Lords: Sobre',
      ]),
    );
    for (const hidden of [
      'Lords: Ir para o Feudo',
      'Lords: Ir para Hoje',
      'Lords: Alocar trabalhadores',
      'Lords: Construir ou melhorar',
      'Lords: Cancelar a obra em andamento',
      'Lords: Planejar obras',
      'Lords: Recrutar aldeões',
      'Lords: Renomear o feudo',
      'Lords: Nova partida',
      'Lords: Abrir a Crônica',
      'Lords: Baixar Crônica (Markdown)',
      'Lords: Atualizar agora',
      'Lords: Conta: vincular ao GitHub',
      'Lords: Conta: gerar Código do Reino',
      'Lords: Conta: sair desta máquina',
      'Lords: Conta: excluir conta',
    ]) {
      expect(labels()).not.toContain(hidden);
    }
  });

  it('com feudo: os comandos do jogo e da conta; nada de entrar ou jogar agora', async () => {
    const { labels } = await setup();
    expect(labels()).toEqual(
      expect.arrayContaining([
        'Lords: Ir para o Feudo',
        'Lords: Ir para Hoje',
        'Lords: Alocar trabalhadores',
        'Lords: Construir ou melhorar',
        'Lords: Cancelar a obra em andamento',
        'Lords: Planejar obras',
        'Lords: Recrutar aldeões',
        'Lords: Renomear o feudo',
        'Lords: Nova partida',
        'Lords: Abrir a Crônica',
        'Lords: Baixar Crônica (Markdown)',
        'Lords: Atualizar agora',
        'Lords: Conta: vincular ao GitHub',
        'Lords: Conta: gerar Código do Reino',
        'Lords: Conta: sair desta máquina',
        'Lords: Conta: excluir conta',
      ]),
    );
    for (const hidden of [
      'Lords: Jogar agora',
      'Lords: Conta: entrar com GitHub',
      'Lords: Conta: entrar com Código do Reino',
      'Lords: Marcar o Relatório de Retorno como lido',
    ]) {
      expect(labels()).not.toContain(hidden);
    }
  });

  it('conta sem feudo: pode fundar um, mas não dá ordens a um feudo que não existe', async () => {
    const api = fakeApi();
    api.seed();
    api.state.game = null;
    const { labels } = await setup({
      signedIn: false,
      api,
      overrides: {
        tokenStore: memoryTokenStore({ accessToken: 'acesso', refreshToken: 'renovacao' }),
      },
      before: ({ store }) => {
        store.data['lords.account:self'] = {
          kind: 'anonymous',
          accountId: ACCOUNT_ID,
          displayName: 'Gustavo',
          hasRecoveryCode: false,
          gameId: null,
        };
      },
    });
    expect(labels()).toEqual(
      expect.arrayContaining([
        'Lords: Jogar agora',
        'Lords: Nova partida',
        'Lords: Conta: sair desta máquina',
      ]),
    );
    expect(labels()).not.toContain('Lords: Alocar trabalhadores');
    expect(labels()).not.toContain('Lords: Ir para o Feudo');
    expect(labels()).not.toContain('Lords: Conta: entrar com Código do Reino');
  });

  it('servidor sem o vínculo com o GitHub: os comandos do GitHub somem', async () => {
    for (const signedIn of [false, true]) {
      const { labels, api, controller } = await setup({ signedIn });
      expect(labels().some((label) => label.includes('GitHub'))).toBe(true);
      api.state.githubDevice = false;
      await controller.loadServerInfo();
      expect(labels().filter((label) => label.includes('GitHub'))).toEqual([]);
      // O Código do Reino continua sendo um caminho.
      expect(labels().some((label) => label.includes('Código do Reino'))).toBe(true);
    }
  });

  it('enquanto o servidor não respondeu, não oferece o GitHub', async () => {
    const { labels } = await setup({
      signedIn: false,
      before: ({ api }) => {
        api.state.online = false;
      },
    });
    expect(labels().filter((label) => label.includes('GitHub'))).toEqual([]);
  });

  it('conta já vinculada não oferece vincular de novo', async () => {
    const { labels, controller } = await setup({
      before: ({ api, store }) => {
        if (api.state.account !== null) {
          api.state.account = { ...api.state.account, linked: { github: true } };
        }
        store.data['lords.account:self'] = {
          ...(store.data['lords.account:self'] as object),
          kind: 'linked',
        };
      },
    });
    expect(controller.account.state.kind).toBe('linked');
    expect(labels()).not.toContain('Lords: Conta: vincular ao GitHub');
    expect(labels()).toContain('Lords: Conta: sair desta máquina');
  });

  it('os comandos internos (árvore, barra de status, avisos) não aparecem na paleta', async () => {
    const { commands, labels } = await setup();
    const internal = commands.filter((command) => !command.palette).map((command) => command.id);
    expect(internal).toEqual(
      expect.arrayContaining(['lords.openPanel', 'lords.workersIncrease', 'lords.workersDecrease']),
    );
    expect(paletteItems(commands).some((item) => !item.value.palette)).toBe(false);
    expect(labels().some((label) => /openPanel|workersIncrease|showCommands/.test(label))).toBe(
      false,
    );
  });

  it('a busca da paleta acha os comandos por pedaços do nome, sem depender de acentos', async () => {
    const { commands } = await setup();
    const search = (query: string) =>
      filterItems(paletteItems(commands), query).map((item) => item.label);
    expect(search('cronica')).toEqual([
      'Lords: Abrir a Crônica',
      'Lords: Baixar Crônica (Markdown)',
    ]);
    expect(search('codigo reino')).toEqual(['Lords: Conta: gerar Código do Reino']);
    expect(search('ALOCAR')).toEqual(['Lords: Alocar trabalhadores']);
    expect(search('dragão')).toEqual([]);
    expect(search('   ')).toHaveLength(paletteItems(commands).length);
  });

  it('abrir a paleta mostra os comandos de agora e executa o escolhido', async () => {
    const { commands, dialogs, answers, shown, controller, api } = await setup();
    const about = paletteItems(commands).findIndex((item) => item.label === 'Lords: Sobre');
    answers.push(about);
    await openPalette(dialogs, commands);
    const palette = shownAs(shown, 0, 'pick');
    expect(palette.items.map((item) => item.label)).toEqual(
      paletteItems(commands).map((item) => item.label),
    );
    expect(controller.route).toBe('about');
    // Fechar a paleta com Esc não faz nada.
    answers.push(undefined);
    await openPalette(dialogs, commands);
    expect(controller.route).toBe('about');
    expect(api.state.commands).toEqual([]);
  });
});

describe('toda ação da interface tem um comando', () => {
  const account = (overrides: Partial<Exclude<AccountState, { kind: 'signedOut' }>> = {}) =>
    ({
      kind: 'anonymous',
      accountId: 'conta-1',
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: 'partida-1',
      ...overrides,
    }) satisfies AccountState;
  const tree = (view: ViewState | null, state: AccountState) =>
    buildTree({
      view,
      account: state,
      connection: { kind: 'online' },
      chronicle: [gameEvent(1, 'constructionFinished'), gameEvent(2, 'constructionFinished')],
      unseen: 1,
      elapsedSeconds: 0,
    });
  const trees = [
    tree(building, account()),
    tree(goldenView, account({ kind: 'linked', hasRecoveryCode: true })),
    tree(null, account()),
    tree(null, account({ gameId: null })),
    tree(null, { kind: 'signedOut' }),
  ];

  it('todo clique em um item da árvore, com e sem feudo carregado, leva a um comando que existe', async () => {
    const { commands } = await setup();
    const known = new Set(commands.map((command) => command.id));
    const used = new Set(
      trees.flatMap((nodes) =>
        everyNode(nodes)
          .map((node) => node.command?.id)
          .filter((id) => id !== undefined),
      ),
    );
    expect(used.size).toBeGreaterThanOrEqual(8);
    expect([...used].filter((id) => !known.has(id))).toEqual([]);
  });

  it('todo botão de ordem das linhas da árvore leva a um comando que existe', async () => {
    const { commands } = await setup();
    const known = new Set(commands.map((command) => command.id));
    const used = new Set(
      trees.flatMap((nodes) =>
        everyNode(nodes).flatMap((node) => rowActions(node).map((action) => action.command)),
      ),
    );
    expect([...used].sort()).toEqual([
      'lords.build',
      'lords.cancelConstruction',
      'lords.workersDecrease',
      'lords.workersIncrease',
    ]);
    expect([...used].filter((id) => !known.has(id))).toEqual([]);
  });

  it("todo 'lords.…' usado pelos componentes, abas, bancada e controlador é um comando", async () => {
    const { commands } = await setup();
    const known = new Set(commands.map((command) => command.id));
    // Não são comandos: os tipos de linha da árvore e a chave do lembrete no armazenamento.
    const notCommands = new Set([
      'lords.worker',
      'lords.upgrade',
      'lords.blockedUpgrade',
      'lords.activeConstruction',
      'lords.linkReminder',
    ]);
    const scanned = Object.entries(sources).filter(
      ([path]) =>
        !/\.test\.tsx?$/.test(path) &&
        (/^\.\.\/(components|tabs|workbench|notifications)\//.test(path) ||
          path === '../app/controller.ts' ||
          path === '../app/actions.ts' ||
          path === '../main.tsx'),
    );
    expect(scanned.length).toBeGreaterThan(15);
    const used = new Map<string, string>();
    for (const [path, source] of scanned) {
      for (const match of source.matchAll(/'(lords\.[A-Za-z]+)'/g)) {
        const id = match[1] ?? '';
        if (!notCommands.has(id)) {
          used.set(id, path);
        }
      }
    }
    // A varredura de fato achou os usos conhecidos.
    for (const id of [
      'lords.refresh',
      'lords.signInGithub',
      'lords.signInRecoveryCode',
      'lords.openChronicle',
      'lords.downloadChronicle',
      'lords.privacy',
      'lords.openSettings',
      'lords.showCommands',
      'lords.playNow',
      'lords.reload',
    ]) {
      expect([...used.keys()]).toContain(id);
    }
    const missing = [...used].filter(([id]) => !known.has(id));
    expect(missing).toEqual([]);
  });

  it('os comandos da v0.1 (GDD §13.6) estão todos na paleta', async () => {
    const { commands } = await setup();
    const expected: Array<[string, RegExp]> = [
      ['lords.goToFief', /^Ir para o Feudo/],
      ['lords.goToToday', /^Ir para Hoje/],
      ['lords.allocateWorkers', /^Alocar trabalhadores/],
      ['lords.build', /^Construir ou melhorar/],
      ['lords.cancelConstruction', /Cancelar a obra/],
      ['lords.planConstruction', /Planejar/],
      ['lords.recruit', /^Recrutar aldeões/],
      ['lords.renameSettlement', /Renomear o feudo/],
      ['lords.newGame', /^Nova partida/],
      ['lords.openChronicle', /^Abrir a? ?Crônica/],
      ['lords.downloadChronicle', /^Baixar Crônica \(Markdown\)/],
      ['lords.refresh', /Atualizar agora/],
      ['lords.toggleDiscreetMode', /modo discreto/i],
      ['lords.muteNotifications', /Silenciar notificações/],
      ['lords.toggleTheme', /^Trocar tema/],
      ['lords.linkGithub', /vincular.*GitHub/i],
      ['lords.signInGithub', /entrar com GitHub/i],
      ['lords.generateRecoveryCode', /gerar Código do Reino/i],
      ['lords.signInRecoveryCode', /entrar com Código do Reino/i],
      ['lords.signOut', /sair desta máquina/i],
      ['lords.deleteAccount', /excluir conta/i],
      ['lords.privacy', /^Privacidade/],
      ['lords.about', /^Sobre/],
      ['lords.openSettings', /^Preferências/],
    ];
    for (const [id, title] of expected) {
      const command = commands.find((candidate) => candidate.id === id);
      expect(command, id).toBeDefined();
      expect(command?.palette, id).toBe(true);
      expect(command?.title, id).toMatch(title);
    }
    expect(new Set(commands.map((command) => command.id)).size).toBe(commands.length);
  });

  it('os títulos não usam o nome do Visual Studio Code', async () => {
    const { commands } = await setup();
    for (const command of commands) {
      expect(command.title).not.toMatch(/Visual Studio Code|VS ?Code/i);
    }
  });
});

describe('controller.runCommand', () => {
  it('executa o comando pelo id, com o argumento', async () => {
    const { controller, browser } = await setup();
    controller.runCommand('lords.showCommands');
    controller.runCommand('lords.reload');
    await settle(controller);
    expect(browser.paletteOpened).toBe(1);
    expect(browser.reloads).toBe(1);
    controller.runCommand('lords.openPanel', 'today');
    expect(controller.route).toBe('today');
    controller.runCommand('lords.openPanel', 'fief');
    expect(controller.route).toBe('fief');
  });

  it('um id desconhecido não faz nada e não quebra', async () => {
    const { controller, api } = await setup();
    expect(() => controller.runCommand('lords.naoExiste')).not.toThrow();
    await settle(controller);
    expect(controller.toasts).toEqual([]);
    expect(api.state.commands).toEqual([]);
  });

  it('a falha de um comando vira um aviso de erro, não uma promessa rejeitada solta', async () => {
    const { controller } = await setup();
    bindCommands(controller, [
      {
        id: 'lords.falha',
        title: 'Falha',
        palette: false,
        run: async () => {
          throw new Error('Deu errado no caminho.');
        },
      },
    ]);
    controller.runCommand('lords.falha');
    await settle(controller);
    expect(controller.toasts).toMatchObject([{ kind: 'error', text: 'Deu errado no caminho.' }]);
  });

  // Uma falha síncrona de um comando não pode estourar em quem clicou: vira aviso, como as
  // assíncronas.
  it('a falha síncrona de um comando também vira aviso, em vez de estourar em quem clicou', async () => {
    const { controller } = await setup();
    bindCommands(controller, [
      {
        id: 'lords.falha',
        title: 'Falha',
        palette: false,
        run: () => {
          throw new Error('Deu errado na hora.');
        },
      },
    ]);
    expect(() => controller.runCommand('lords.falha')).not.toThrow();
    await settle(controller);
    expect(controller.toasts).toMatchObject([{ kind: 'error', text: 'Deu errado na hora.' }]);
  });

  it('navegar pelos comandos abre a aba certa', async () => {
    const { run, controller } = await setup();
    await run('lords.goToToday');
    expect(controller.route).toBe('today');
    await run('lords.goToFief');
    expect(controller.route).toBe('fief');
    await run('lords.openChronicle');
    expect(controller.route).toBe('chronicle');
    expect(controller.tabs).toContain('chronicle');
    await run('lords.openSettings');
    expect(controller.route).toBe('settings');
    await run('lords.about');
    expect(controller.route).toBe('about');
  });

  it('"Jogar agora" sem conta leva às boas-vindas', async () => {
    const { run, controller } = await setup({ signedIn: false });
    controller.navigate('about');
    await run('lords.playNow');
    expect(controller.route).toBe('welcome');
  });

  it('"Atualizar agora" busca o estado no servidor', async () => {
    const { run, requested, api } = await setup();
    const before = requested(`GET /games/${api.state.game?.id}/view`);
    await run('lords.refresh');
    expect(requested(`GET /games/${api.state.game?.id}/view`)).toBeGreaterThan(before);
  });
});

describe('alocar trabalhadores', () => {
  const farm = goldenView.workers[0] as ViewState['workers'][number];
  const free = goldenView.population.free;

  it('a validação mostra a taxa resultante enquanto o jogador digita', () => {
    // Fazenda: cada trabalhador rende 12/h na primavera; há 2 lá e 3 livres.
    expect(workersValidation(farm, free, '3')).toEqual({
      message: '3 × 12 = 36/h',
      severity: 'info',
    });
    expect(workersValidation(farm, free, '0')).toEqual({
      message: '0 × 12 = 0/h',
      severity: 'info',
    });
    expect(workersValidation(farm, free, '5')).toEqual({
      message: '5 × 12 = 60/h',
      severity: 'info',
    });
    expect(workersPreview(farm, free, '5')).toBeNull();
  });

  it('recusa o que não é um número inteiro de trabalhadores', () => {
    for (const input of ['', '   ', 'abc', '-1', '1.5', '2,5', '1e99x']) {
      expect(workersPreview(farm, free, input), `"${input}"`).toBe(
        'Digite um número inteiro de trabalhadores.',
      );
      expect(workersValidation(farm, free, input).severity).toBe('error');
    }
  });

  it('recusa mais do que os já alocados somados aos livres, dizendo quantos há', () => {
    const problem = workersPreview(farm, free, '6');
    expect(problem).toContain('5');
    expect(problem).toContain('Fazenda');
    expect(problem).toContain('2 já lá');
    expect(problem).toContain('3 livres');
    expect(workersValidation(farm, free, '6')).toEqual({ message: problem, severity: 'error' });
    expect(workersPreview(farm, 0, '3')).not.toBeNull();
    expect(workersPreview(farm, 0, '2')).toBeNull();
  });

  it('pela paleta: escolhe o edifício, digita o número e a ordem segue', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(0, '3');
    await run('lords.allocateWorkers');

    const pick = shownAs(shown, 0, 'pick');
    expect(pick.items.map((item) => item.label)).toEqual([
      'Fazenda Nv1',
      'Serraria Nv1',
      'Pedreira Nv1',
      'Mina de Ouro Nv1',
    ]);
    // Cada edifício mostra quantos trabalham lá e quanto rende; os livres ficam à vista.
    expect(pick.items[0]?.description).toBe('2 trabalhadores · 24/h');
    expect(pick.items[1]?.description).toBe('0 trabalhadores · 0/h');
    expect(pick.items[0]?.detail).toBe(farm.breakdown);
    expect(pick.placeholder).toBe('3 aldeões livres');

    const input = shownAs(shown, 1, 'input');
    expect(input.title).toBe('Fazenda Nv1');
    expect(input.value).toBe('2');
    expect(input.prompt).toContain('3 livres');
    expect(input.validate?.('3')).toEqual({ message: '3 × 12 = 36/h', severity: 'info' });
    expect(input.validate?.('9')?.severity).toBe('error');
    expect(input.validate?.('x')?.severity).toBe('error');

    expect(orders()).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 3 } }]);
  });

  it('o mesmo número de antes não manda ordem nenhuma', async () => {
    const { run, answers, orders, controller } = await setup();
    answers.push(0, '2');
    await run('lords.allocateWorkers');
    expect(orders()).toEqual([]);
    expect(controller.toasts).toEqual([]);
  });

  it('desistir na lista ou no campo não manda nada', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(undefined);
    await run('lords.allocateWorkers');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick']);
    answers.push(1, undefined);
    await run('lords.allocateWorkers');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick', 'pick', 'input']);
    expect(orders()).toEqual([]);
  });

  it('vindo de um item da árvore, pula a lista e já pergunta o número', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push('2');
    await run('lords.allocateWorkers', { id: 'worker:lumberMill', label: 'Serraria Nv1' });
    expect(shown.map((entry) => entry.kind)).toEqual(['input']);
    expect(shownAs(shown, 0, 'input').title).toBe('Serraria Nv1');
    expect(shownAs(shown, 0, 'input').validate?.('2')).toEqual({
      message: '2 × 8 = 16/h',
      severity: 'info',
    });
    expect(orders()).toEqual([
      { type: 'setWorkers', payload: { building: 'lumberMill', count: 2 } },
    ]);
  });

  it('+ e − da árvore mudam um trabalhador por vez, sem diálogo', async () => {
    const { run, shown, orders } = await setup();
    await run('lords.workersIncrease', { id: 'worker:farm', label: 'Fazenda Nv1' });
    await run('lords.workersDecrease', { id: 'worker:farm', label: 'Fazenda Nv1' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([
      { type: 'setWorkers', payload: { building: 'farm', count: 3 } },
      { type: 'setWorkers', payload: { building: 'farm', count: 1 } },
    ]);
  });

  it('− em um edifício vazio nunca pede um número negativo', async () => {
    const { run, api } = await setup();
    await run('lords.workersDecrease', { id: 'worker:quarry', label: 'Pedreira Nv1' });
    for (const command of api.state.commands) {
      expect(command.type).toBe('setWorkers');
      expect((command.payload as { count: number }).count).toBeGreaterThanOrEqual(0);
    }
  });

  // Uma ordem que não muda nada não vai ao servidor: não gasta `commandId` nem versão.
  it('− em um edifício já vazio não manda uma ordem que não muda nada', async () => {
    const { run, orders } = await setup();
    await run('lords.workersDecrease', { id: 'worker:quarry', label: 'Pedreira Nv1' });
    expect(orders()).toEqual([]);
  });

  it('cada clique é uma ordem nova, com commandId próprio', async () => {
    const { run, api } = await setup();
    await run('lords.workersIncrease', { id: 'worker:farm' });
    await run('lords.workersIncrease', { id: 'worker:farm' });
    const ids = api.state.commands.map((command) => command.commandId);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
  });

  it('+ sem um item da árvore cai no diálogo de alocação', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(undefined);
    await run('lords.workersIncrease');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick']);
    expect(orders()).toEqual([]);
  });

  it('a recusa do servidor aparece como aviso, com a frase que veio dele', async () => {
    const { run, api, controller, orders } = await setup();
    api.refuseNextCommand('Não há aldeões livres para a Fazenda.', 'NOT_ENOUGH_WORKERS');
    await run('lords.workersIncrease', { id: 'worker:farm' });
    expect(orders()).toEqual([]);
    expect(controller.toasts).toMatchObject([
      { kind: 'warning', text: 'Não há aldeões livres para a Fazenda.' },
    ]);
  });

  it('sem rede, a ordem não é enviada nem guardada, e o aviso oferece tentar de novo', async () => {
    const { run, api, controller, orders } = await setup();
    api.state.online = false;
    await run('lords.workersIncrease', { id: 'worker:farm' });
    expect(orders()).toEqual([]);
    const [toast] = controller.toasts;
    expect(toast).toMatchObject({ kind: 'error' });
    expect(toast?.text).toMatch(/Sem ligação com o reino/);
    expect(toast?.actions.map((action) => action.label)).toEqual(['Tentar de novo']);
  });
});

describe('construir, cancelar e planejar', () => {
  it('a lista mostra custo, prazo e cadeado nas melhorias bloqueadas', async () => {
    const { run, answers, shown } = await setup();
    answers.push(undefined);
    await run('lords.build');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.placeholder).toBe('Os pedreiros estão livres.');
    expect(pick.items).toHaveLength(goldenView.constructions.available.length);
    const byLabel = new Map(pick.items.map((item) => [item.label, item]));
    // Salão do Senhor: bloqueado por falta de recursos.
    expect(byLabel.get('Salão do Senhor Nv1 → Nv2')).toMatchObject({
      icon: 'lock',
      description: '150 madeira, 100 pedra, 100 ouro · 10 min',
      detail: 'Faltam 30 madeira e 35 pedra.',
      value: 'townHall',
    });
    // Fazenda: pode começar.
    const farm = byLabel.get('Fazenda Nv1 → Nv2');
    expect(farm).toMatchObject({ description: '80 madeira, 40 ouro · 5 min', value: 'farm' });
    expect(farm?.icon).not.toBe('lock');
    // O cadeado aparece exatamente nas bloqueadas.
    const locked = pick.items.filter((item) => item.icon === 'lock').map((item) => item.value);
    expect(locked).toEqual(
      goldenView.constructions.available
        .filter((upgrade) => upgrade.blockedReason !== null)
        .map((upgrade) => upgrade.building),
    );
  });

  it('escolher uma melhoria manda a ordem de começar a obra', async () => {
    const { run, answers, orders } = await setup();
    answers.push(1);
    await run('lords.build');
    expect(orders()).toEqual([{ type: 'startConstruction', payload: { building: 'farm' } }]);
  });

  it('uma melhoria bloqueada também é enviada: quem recusa, com o motivo de agora, é o servidor', async () => {
    const { run, answers, api, controller } = await setup();
    api.refuseNextCommand('Faltam 12 madeira e 35 pedra.');
    const before = api.state.requests.length;
    answers.push(0);
    await run('lords.build');
    expect(api.state.requests.slice(before)).toContain(
      `POST /games/${api.state.game?.id}/commands`,
    );
    // O aviso traz a frase atualizada do servidor, não a do estado guardado.
    expect(controller.toasts).toMatchObject([
      { kind: 'warning', text: 'Faltam 12 madeira e 35 pedra.' },
    ]);
  });

  it('com uma obra em andamento, a lista diz qual é e quando termina', async () => {
    const { run, answers, shown } = await setup({
      before: ({ api }) => {
        api.state.view = building;
      },
    });
    answers.push(undefined);
    await run('lords.build');
    expect(shownAs(shown, 0, 'pick').placeholder).toMatch(
      /^Em obras: Serraria → Nv2, termina em 00:4[12]$/,
    );
  });

  it('"Melhorar" em um item da árvore começa a obra sem abrir a lista', async () => {
    const { run, shown, orders } = await setup();
    await run('lords.build', { id: 'construction:housing', label: 'Habitações Nv1 → Nv2' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'startConstruction', payload: { building: 'housing' } }]);
  });

  it('desistir da lista não manda nada', async () => {
    const { run, answers, orders } = await setup();
    answers.push(undefined);
    await run('lords.build');
    expect(orders()).toEqual([]);
  });

  it('cancelar a obra pede confirmação e mostra o que volta', async () => {
    const { run, answers, shown, orders } = await setup({
      before: ({ api }) => {
        api.state.view = building;
      },
    });
    answers.push(true);
    await run('lords.cancelConstruction');
    const confirm = shownAs(shown, 0, 'confirm');
    expect(confirm.title).toContain('Serraria');
    expect(confirm.detail?.join(' ')).toContain('80 madeira, 40 pedra');
    // Os dois botões dizem o que fazem: "Cancelar" sozinho seria ambíguo aqui.
    expect(confirm.confirmLabel).toBe('Cancelar a obra');
    expect(confirm.cancelLabel).toBe('Manter a obra');
    expect(orders()).toEqual([{ type: 'cancelConstruction', payload: { building: 'lumberMill' } }]);
  });

  it('sem confirmar, a obra continua', async () => {
    const { run, answers, orders } = await setup({
      before: ({ api }) => {
        api.state.view = building;
      },
    });
    answers.push(false);
    await run('lords.cancelConstruction');
    expect(orders()).toEqual([]);
  });

  it('sem obra em andamento, só avisa', async () => {
    const { run, shown, orders, controller } = await setup();
    await run('lords.cancelConstruction');
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(controller.toasts).toMatchObject([{ kind: 'info', text: 'Não há obra em andamento.' }]);
  });

  it('planejar: escolhe uma melhoria e ela entra na lista, sem gastar nada', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(1);
    await run('lords.planConstruction');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.placeholder).toContain('Planejar não gasta nada');
    expect(pick.items).toHaveLength(goldenView.constructions.available.length);
    expect(pick.items.every((item) => item.label.startsWith('Planejar: '))).toBe(true);
    expect(pick.items[1]).toMatchObject({
      label: 'Planejar: Fazenda → Nv2',
      description: '80 madeira, 40 ouro · 5 min',
    });
    expect(orders()).toEqual([{ type: 'planConstruction', payload: { building: 'farm' } }]);
  });

  it('o que já está planejado pode sair da lista e não é oferecido de novo', async () => {
    const farm = goldenView.constructions.available.find((upgrade) => upgrade.building === 'farm');
    if (farm === undefined) {
      throw new Error('O golden não tem a melhoria da Fazenda.');
    }
    const planned: ViewState = {
      ...goldenView,
      constructions: {
        ...goldenView.constructions,
        planned: [{ ...farm, planned: true }],
        available: goldenView.constructions.available.map((upgrade) =>
          upgrade.building === 'farm' ? { ...upgrade, planned: true } : upgrade,
        ),
      },
    };
    const { run, answers, shown, orders } = await setup({
      before: ({ api }) => {
        api.state.view = planned;
      },
    });
    answers.push(0);
    await run('lords.planConstruction');
    const labels = shownAs(shown, 0, 'pick').items.map((item) => item.label);
    expect(labels[0]).toBe('Tirar da lista: Fazenda → Nv2');
    expect(labels).not.toContain('Planejar: Fazenda → Nv2');
    expect(labels).toHaveLength(goldenView.constructions.available.length);
    expect(orders()).toEqual([{ type: 'unplanConstruction', payload: { building: 'farm' } }]);
  });

  it('desistir do planejamento não manda nada', async () => {
    const { run, answers, orders } = await setup();
    answers.push(undefined);
    await run('lords.planConstruction');
    expect(orders()).toEqual([]);
  });
});

describe('recrutar, renomear e nova partida', () => {
  it('recrutar diz o custo, o prazo e as vagas, e valida a quantidade', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push('2');
    await run('lords.recruit');
    const input = shownAs(shown, 0, 'input');
    // 10 vagas no feudo, 5 aldeões, ninguém em treino: 5 vagas.
    expect(input.prompt).toContain('Vagas: 5 de 10');
    expect(input.prompt).toContain('50 comida, 10 ouro');
    // Na primavera o treinamento leva 16 minutos (o prazo vem da visão).
    expect(input.prompt).toContain('16 min');
    expect(input.placeholder).toBe('de 1 a 5');
    expect(input.value).toBe('1');
    for (const invalid of ['', '0', '-2', '1.5', 'dois']) {
      expect(input.validate?.(invalid)?.severity, `"${invalid}"`).toBe('error');
    }
    expect(input.validate?.('6')).toEqual({
      message: 'Agora cabem no máximo 5.',
      severity: 'error',
    });
    expect(input.validate?.('1')).toBeNull();
    expect(input.validate?.('5')).toBeNull();
    expect(orders()).toEqual([{ type: 'recruitVillagers', payload: { quantity: 2 } }]);
  });

  it('as vagas são as que vieram na visão, já sem quem está a caminho', async () => {
    const { run, answers, shown } = await setup({
      before: ({ api }) => {
        api.state.view = {
          ...goldenView,
          population: { ...goldenView.population, inTraining: 2, housed: 7, vacancies: 3 },
          recruitment: { ...goldenView.recruitment, maxQuantity: 3 },
        };
      },
    });
    answers.push(undefined);
    await run('lords.recruit');
    const input = shownAs(shown, 0, 'input');
    expect(input.prompt).toContain('Vagas: 3 de 10');
    expect(input.validate?.('4')?.severity).toBe('error');
    expect(input.validate?.('3')).toBeNull();
  });

  it('o app não refaz a conta das vagas: mostra o número do servidor', async () => {
    const { run, answers, shown } = await setup({
      before: ({ api }) => {
        // Números que não fecham entre si de propósito: pela conta antiga
        // (capacidade − aldeões − a caminho) seriam 4 vagas.
        api.state.view = {
          ...goldenView,
          population: {
            ...goldenView.population,
            villagers: 5,
            capacity: 10,
            inTraining: 1,
            housed: 9,
            vacancies: 1,
          },
        };
      },
    });
    answers.push(undefined);
    await run('lords.recruit');
    const input = shownAs(shown, 0, 'input');
    expect(input.prompt).toContain('Vagas: 1 de 10.');
    expect(input.prompt).not.toContain('Vagas: 4');
  });

  it('desistir de recrutar não manda nada', async () => {
    const { run, answers, orders } = await setup();
    answers.push(undefined);
    await run('lords.recruit');
    expect(orders()).toEqual([]);
  });

  it('renomear o feudo manda o nome novo, sem espaços nas pontas', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push('  Vila Nova  ');
    await run('lords.renameSettlement');
    const input = shownAs(shown, 0, 'input');
    expect(input.value).toBe('Pedra Alta');
    expect(input.validate?.('a')?.severity).toBe('error');
    expect(input.validate?.('   ')?.severity).toBe('error');
    expect(input.validate?.('x'.repeat(25))?.severity).toBe('error');
    expect(input.validate?.('ab')).toBeNull();
    expect(input.validate?.('x'.repeat(24))).toBeNull();
    expect(orders()).toEqual([{ type: 'renameSettlement', payload: { name: 'Vila Nova' } }]);
  });

  it('a regra dos nomes é a do protocolo (DisplayNameSchema), com a frase do app', async () => {
    const { run, answers, shown } = await setup();
    answers.push(undefined);
    await run('lords.renameSettlement');
    const validate = shownAs(shown, 0, 'input').validate;
    const refused = { message: NAME_RULE, severity: 'error' };
    expect(NAME_RULE).toBe('De 2 a 24 caracteres.');
    // Um caractere, 25, só espaços, e espaços que não contam para o tamanho.
    expect(validate?.('a')).toEqual(refused);
    expect(validate?.('x'.repeat(25))).toEqual(refused);
    expect(validate?.('')).toEqual(refused);
    expect(validate?.('      ')).toEqual(refused);
    expect(validate?.('  a  ')).toEqual(refused);
    // Os dois limites valem, e os espaços nas pontas não contam.
    expect(validate?.('ab')).toBeNull();
    expect(validate?.('x'.repeat(24))).toBeNull();
    expect(validate?.(`  ${'x'.repeat(24)}  `)).toBeNull();
    // O que o servidor recusaria por não poder guardar, o app recusa antes.
    expect(validate?.('Vila\u0000Nova')).toEqual(refused);
    // O app aceita exatamente o que o protocolo aceita.
    for (const name of ['a', 'ab', 'Vila Nova', ' x ', 'x'.repeat(24), 'x'.repeat(25), '\t\t\t']) {
      expect(validate?.(name) === null, JSON.stringify(name)).toBe(
        DisplayNameSchema.safeParse(name).success,
      );
    }
  });

  it('o mesmo nome, ou desistir, não manda nada', async () => {
    const { run, answers, orders } = await setup();
    answers.push(' Pedra Alta ');
    await run('lords.renameSettlement');
    answers.push(undefined);
    await run('lords.renameSettlement');
    expect(orders()).toEqual([]);
  });

  it('nova partida pergunta dificuldade e ritmo, com o padrão do servidor já marcado', async () => {
    const { run, answers, shown, requested } = await setup();
    // Desiste na confirmação: até ali, nada foi pedido ao servidor além das opções.
    answers.push(1, 0, false);
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick', 'pick', 'confirm']);

    const difficulty = shownAs(shown, 0, 'pick');
    expect(difficulty.title).toBe('Nova partida: dificuldade');
    expect(difficulty.placeholder).toMatch(/não muda durante o ano/);
    expect(difficulty.items.map((item) => item.label)).toEqual([
      'Camponês',
      'Senhor (recomendado)',
      'Rei de Ferro',
    ]);
    expect(difficulty.items.map((item) => item.value)).toEqual(['peasant', 'lord', 'ironKing']);
    // Cada opção leva a frase do servidor, à vista na lista.
    expect(difficulty.items.every((item) => (item.detail ?? '').length > 20)).toBe(true);
    // O padrão (Senhor) já vem marcado: Enter sem mexer em nada o escolhe.
    expect(difficulty.selected).toBe(1);

    const pace = shownAs(shown, 1, 'pick');
    expect(pace.title).toBe('Nova partida: ritmo');
    expect(pace.placeholder).toMatch(/não muda durante o ano/);
    expect(pace.items.map((item) => item.label)).toEqual([
      'Rápido: um ano em 56 horas (recomendado)',
      'Normal: um ano em 7 dias',
      'Tranquilo: um ano em 14 dias',
    ]);
    expect(pace.items.map((item) => item.value)).toEqual([3, 1, 0.5]);
    expect(pace.items.map((item) => item.detail)).toEqual([
      'Para quem volta várias vezes ao dia e quer ver o inverno ainda nesta semana.',
      'Uma semana, um ano: para quem passa pelo feudo duas ou três vezes por dia.',
      'Para quem abre o jogo uma vez por dia: o feudo anda devagar e espera por você.',
    ]);
    expect(pace.selected).toBe(0);
    expect(requested('GET /catalog')).toBe(1);
    expect(requested('POST /games')).toBe(0);
  });

  it('o ritmo marcado é o padrão do servidor, mesmo quando o recomendado é outro', async () => {
    const api = fakeApi();
    // Como o servidor de testes: roda no Normal, e o Rápido continua sendo o recomendado.
    api.state.catalog = catalogFixture({ difficulty: 'lord', timeScale: 1 });
    const { run, answers, shown } = await setup({ api });
    answers.push(1, undefined);
    await run('lords.newGame');
    const pace = shownAs(shown, 1, 'pick');
    expect(pace.selected).toBe(1);
    expect(pace.items[pace.selected ?? -1]?.label).toBe('Normal: um ano em 7 dias');
  });

  it('nova partida pede confirmação antes de mudar qualquer coisa, e diz como o feudo nasce', async () => {
    const { run, answers, shown, requested, api } = await setup();
    answers.push(2, 2, false);
    await run('lords.newGame');
    const confirm = shownAs(shown, 2, 'confirm');
    expect(confirm.title).toBe('Começar uma nova partida?');
    expect(confirm.detail?.join(' ')).toMatch(/arquivado/);
    // O custo (o feudo atual) e a escolha ficam lado a lado na mesma pergunta.
    expect(confirm.detail?.join(' ')).toContain('Rei de Ferro · Tranquilo: um ano em 14 dias');
    expect(requested('POST /games')).toBe(0);
    expect(api.state.game?.settlementName).toBe('Pedra Alta');
  });

  it('confirmada, pergunta o nome e funda o outro feudo no lugar do atual, com a escolha', async () => {
    const { run, answers, shown, requested, api, controller } = await setup();
    controller.navigate('today');
    answers.push(2, 2, true, 'Vila Nova');
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick', 'pick', 'confirm', 'input']);
    const input = shownAs(shown, 3, 'input');
    expect(input.validate?.('a')?.severity).toBe('error');
    expect(input.validate?.('   ')?.severity).toBe('error');
    expect(input.validate?.('x'.repeat(25))?.severity).toBe('error');
    expect(input.validate?.('ab')).toBeNull();
    expect(input.validate?.('x'.repeat(24))).toBeNull();
    expect(input.validate?.('Vila Nova')).toBeNull();
    expect(requested('POST /games')).toBe(1);
    expect(api.state.gameRequests).toEqual([
      {
        settlementName: 'Vila Nova',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        difficulty: 'ironKing',
        timeScale: 0.5,
        replaceActive: true,
      },
    ]);
    expect(api.state.game?.settlementName).toBe('Vila Nova');
    expect(controller.route).toBe('fief');
    expect(controller.toasts.filter((toast) => toast.kind === 'error')).toEqual([]);
  });

  it('aceitar os padrões nas duas listas manda exatamente o que estava marcado', async () => {
    const { run, answers, shown, api } = await setup();
    // Uma primeira passada só para ver as duas listas; desiste na segunda.
    answers.push(0, undefined);
    await run('lords.newGame');
    const [difficulty, pace] = [shownAs(shown, 0, 'pick'), shownAs(shown, 1, 'pick')];
    shown.length = 0;
    // Enter, Enter: o item marcado de cada lista.
    answers.push(difficulty.selected, pace.selected, true, 'Vila Nova');
    await run('lords.newGame');
    expect(api.state.gameRequests.at(-1)).toMatchObject({ difficulty: 'lord', timeScale: 3 });
  });

  it('desistir em qualquer das duas listas não pergunta mais nada nem muda o feudo', async () => {
    const { run, answers, shown, requested } = await setup();
    answers.push(undefined);
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick']);
    shown.length = 0;
    answers.push(0, undefined);
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick', 'pick']);
    expect(requested('POST /games')).toBe(0);
  });

  it('confirmada mas sem nome (desistiu no campo), nada muda', async () => {
    const { run, answers, requested } = await setup();
    answers.push(1, 0, true, undefined);
    await run('lords.newGame');
    expect(requested('POST /games')).toBe(0);
  });

  it('servidor sem as opções (versão anterior): nova partida funciona como na v0.1', async () => {
    const api = fakeApi();
    api.state.catalog = null;
    const { run, answers, shown, api: used, controller } = await setup({ api });
    answers.push(true, 'Vila Nova');
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['confirm', 'input']);
    const confirm = shownAs(shown, 0, 'confirm');
    expect(confirm.detail).toEqual(['O feudo atual é arquivado e não pode mais receber ordens.']);
    // Sem dificuldade nem ritmo no corpo: valem os padrões do servidor.
    expect(used.state.gameRequests).toEqual([
      {
        settlementName: 'Vila Nova',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        replaceActive: true,
      },
    ]);
    expect(controller.route).toBe('fief');
    expect(controller.toasts.filter((toast) => toast.kind === 'error')).toEqual([]);
  });

  it('conta sem feudo: escolhe e funda, sem a pergunta de arquivar', async () => {
    const { run, answers, shown, api, controller } = await setup({
      before: ({ api: fake, store }) => {
        fake.state.game = null;
        store.data['lords.account:self'] = {
          ...(store.data['lords.account:self'] as object),
          gameId: null,
        };
      },
    });
    expect(controller.hasGame).toBe(false);
    answers.push(0, 1, 'Vau Alto');
    await run('lords.newGame');
    expect(shown.map((entry) => entry.kind)).toEqual(['pick', 'pick', 'input']);
    expect(api.state.gameRequests.at(-1)).toMatchObject({
      settlementName: 'Vau Alto',
      difficulty: 'peasant',
      timeScale: 1,
    });
    expect(controller.route).toBe('fief');
  });

  describe('enquanto as opções não chegam (diálogos de verdade, em fila)', () => {
    const env: CommandEnv = {
      download: () => {},
      reload: () => {},
      sleep: async () => {},
      currentTheme: () => 'dark',
      openPalette: () => {},
    };

    /** O app aberto com o feudo, e `GET /catalog` preso até `release()`. */
    async function waitingForCatalog() {
      const api = fakeApi();
      let release: () => void = () => {};
      const held = new Promise<void>((resolve) => {
        release = resolve;
      });
      const slowCatalog: typeof fetch = async (input, init) => {
        if (new URL(String(input), 'http://app.test').pathname.endsWith('/catalog')) {
          await held;
        }
        return api.fetch(input, init);
      };
      const made = makeController({ api, signedIn: true, overrides: { fetch: slowCatalog } });
      controllers.push(made.controller);
      const dialogs = new DialogService();
      bindCommands(made.controller, createCommands(made.controller, dialogs, env));
      await made.controller.start();
      await settle(made.controller);
      // Feudo aberto sem passar pelas boas-vindas nem pelas Preferências: nada leu as opções.
      expect(made.controller.catalog.status).toBe('idle');
      return { ...made, dialogs, release };
    }

    /** Responde cada diálogo à vista com o que já vem marcado, como quem só aperta Enter. */
    async function acceptEverything(controller: Controller, dialogs: DialogService) {
      const accept = (state: DialogState): unknown => {
        switch (state.kind) {
          case 'pick':
            return state.items[state.selected ?? 0]?.value;
          case 'confirm':
            return true;
          case 'input':
            return state.value;
          case 'info':
            return undefined;
        }
      };
      const titles: string[] = [];
      for (let turn = 0; turn < 12; turn += 1) {
        await settle(controller);
        const current = dialogs.current;
        if (current === null) {
          break;
        }
        titles.push(current.state.title);
        dialogs.resolve(current.id, accept(current.state));
      }
      return titles;
    }

    it('acionada duas vezes, abre um fluxo só e funda um feudo só', async () => {
      const { controller, api, dialogs, release } = await waitingForCatalog();
      // Duplo clique no botão das Preferências, ou um segundo clique porque nada apareceu.
      controller.runCommand('lords.newGame');
      controller.runCommand('lords.newGame');
      await settle(controller);
      expect(dialogs.current).toBeNull();
      controller.runCommand('lords.newGame');
      release();

      expect(await acceptEverything(controller, dialogs)).toEqual([
        'Nova partida: dificuldade',
        'Nova partida: ritmo',
        'Começar uma nova partida?',
        'Nova partida',
      ]);
      expect(api.state.gameRequests).toHaveLength(1);
      expect(api.state.requests.filter((entry) => entry === 'GET /catalog')).toHaveLength(1);
      expect(controller.toasts.filter((toast) => toast.kind === 'error')).toEqual([]);

      // Terminado o fluxo, o comando volta a valer.
      controller.runCommand('lords.newGame');
      await settle(controller);
      expect(dialogs.current?.state.title).toBe('Nova partida: dificuldade');
      dialogs.cancel();
    });

    it('desistir no meio libera o comando para a próxima vez', async () => {
      const { controller, api, dialogs, release } = await waitingForCatalog();
      release();
      controller.runCommand('lords.newGame');
      await settle(controller);
      expect(dialogs.current?.state.title).toBe('Nova partida: dificuldade');
      dialogs.cancel();
      await settle(controller);
      expect(dialogs.current).toBeNull();

      controller.runCommand('lords.newGame');
      expect(await acceptEverything(controller, dialogs)).toHaveLength(4);
      expect(api.state.gameRequests).toHaveLength(1);
    });

    it('a conta é lida depois da espera: quem perdeu a sessão nesse meio vai às boas-vindas', async () => {
      const { controller, api, dialogs, release } = await waitingForCatalog();
      controller.navigate('settings');
      controller.runCommand('lords.newGame');
      await settle(controller);
      // A sessão termina com a leitura das opções ainda em voo.
      await controller.account.handleUnauthenticated();
      await settle(controller);
      expect(controller.account.state.kind).toBe('signedOut');
      release();

      expect(await acceptEverything(controller, dialogs)).toEqual([]);
      expect(controller.route).toBe('welcome');
      expect(api.state.gameRequests).toEqual([]);
    });
  });

  it('sem conta, "Nova partida" leva às boas-vindas', async () => {
    const { run, shown, controller } = await setup({ signedIn: false });
    controller.navigate('about');
    await run('lords.newGame');
    expect(shown).toEqual([]);
    expect(controller.route).toBe('welcome');
  });
});

describe('baixar a Crônica', () => {
  it('entrega ao navegador um arquivo .md com o Markdown do servidor', async () => {
    const { run, browser, api, controller } = await setup();
    await run('lords.downloadChronicle');
    expect(browser.downloads).toEqual([
      { filename: 'cronica-pedra-alta.md', content: api.state.chronicleMarkdown },
    ]);
    expect(controller.toasts).toEqual([]);
  });

  it('o nome do arquivo vem do nome do feudo, sem acentos nem símbolos', async () => {
    const { run, browser } = await setup({
      before: ({ api }) => {
        api.state.view = {
          ...goldenView,
          settlement: { ...goldenView.settlement, name: "São João d'El-Rei!" },
        };
      },
    });
    await run('lords.downloadChronicle');
    expect(browser.downloads.map((download) => download.filename)).toEqual([
      'cronica-sao-joao-d-el-rei.md',
    ]);
  });

  it('um nome só de símbolos ainda dá um nome de arquivo válido', async () => {
    const { run, browser } = await setup({
      before: ({ api }) => {
        api.state.view = { ...goldenView, settlement: { ...goldenView.settlement, name: '★☆★' } };
      },
    });
    await run('lords.downloadChronicle');
    expect(browser.downloads).toHaveLength(1);
    expect(browser.downloads[0]?.filename).toMatch(/^cronica-[a-z0-9-]+\.md$/);
  });

  it('se a Crônica não pôde ser lida, avisa e não baixa um arquivo vazio', async () => {
    const { run, browser, api, controller } = await setup();
    api.state.failNext.set('chronicle.md', {
      status: 500,
      body: { code: 'INTERNAL', message: 'O escriba derrubou o tinteiro.' },
    });
    await run('lords.downloadChronicle');
    expect(browser.downloads).toEqual([]);
    expect(controller.toasts).toMatchObject([
      { kind: 'error', text: 'O escriba derrubou o tinteiro.' },
    ]);
  });
});

describe('conta: Código do Reino', () => {
  it('entrar: um código malformado é barrado pela validação, antes de qualquer pedido', async () => {
    const { run, answers, shown, requested } = await setup({ signedIn: false });
    answers.push(undefined);
    await run('lords.signInRecoveryCode');
    const input = shownAs(shown, 0, 'input');
    for (const malformed of [
      '',
      'abc',
      'PEDR-7F3A',
      `${VALID_CODE}-XXXX`,
      'PEDR-7F3A-K9QD-M2XW-4HT0',
    ]) {
      const result = input.validate?.(malformed);
      expect(result?.severity, `"${malformed}"`).toBe('error');
      expect(result?.message.length).toBeGreaterThan(10);
    }
    // 0, O, 1 e I não aparecem em código nenhum: a mensagem diz isso.
    expect(input.validate?.('PEDR-7F3A-K9QD-M2XW-4HT0')?.message).toContain('0');
    expect(input.validate?.(VALID_CODE)).toBeNull();
    // Minúsculas, espaços nas pontas e falta de hífens não são erro.
    expect(input.validate?.('  pedr7f3ak9qdm2xw4htb ')).toBeNull();
    expect(requested('POST /auth/recover')).toBe(0);
  });

  it('entrar: com um código válido, assume a conta e abre o feudo dela', async () => {
    const api = fakeApi();
    api.seed();
    const { run, answers, requested, controller, tokenStore } = await setup({
      signedIn: false,
      api,
    });
    expect(controller.account.state.kind).toBe('signedOut');
    answers.push(VALID_CODE);
    await run('lords.signInRecoveryCode');
    expect(requested('POST /auth/recover')).toBe(1);
    expect(controller.account.state).toMatchObject({ kind: 'anonymous', displayName: 'Gustavo' });
    expect(await tokenStore.get()).not.toBeNull();
    expect(controller.route).toBe('fief');
    expect(controller.view?.settlement.name).toBe('Pedra Alta');
  });

  it('entrar: o código recusado pelo servidor vira aviso de erro e ninguém entra', async () => {
    const { run, answers, api, controller } = await setup({ signedIn: false });
    api.state.failNext.set('/auth/recover', {
      status: 401,
      body: { code: 'UNAUTHORIZED', message: 'Código do Reino inválido.' },
    });
    answers.push(VALID_CODE);
    await run('lords.signInRecoveryCode');
    expect(controller.account.state.kind).toBe('signedOut');
    expect(controller.toasts.some((toast) => toast.kind === 'error')).toBe(true);
    // O código digitado nunca aparece em um aviso.
    expect(controller.toasts.some((toast) => toast.text.includes('PEDR'))).toBe(false);
  });

  it('gerar: mostra o código uma vez, em um diálogo, e não em avisos nem no log', async () => {
    const { run, shown, requested, controller, logs } = await setup();
    await run('lords.generateRecoveryCode');
    expect(shown.map((entry) => entry.kind)).toEqual(['info']);
    const info = shownAs(shown, 0, 'info');
    expect(info.code).toBe(VALID_CODE);
    expect(info.paragraphs.join(' ')).toMatch(/só desta vez/);
    expect(info.paragraphs.join(' ')).toMatch(/Guarde/);
    expect(requested('POST /auth/recovery-code')).toBe(1);
    expect(controller.account.state).toMatchObject({ hasRecoveryCode: true });
    expect(controller.toasts.some((toast) => toast.text.includes(VALID_CODE))).toBe(false);
    expect(logs.join('\n')).not.toContain(VALID_CODE);
  });

  it('gerar com um código já existente: pergunta antes de invalidar o anterior', async () => {
    const { run, answers, shown, requested } = await setup();
    await run('lords.generateRecoveryCode');
    expect(requested('POST /auth/recovery-code')).toBe(1);

    answers.push(false);
    await run('lords.generateRecoveryCode');
    const confirm = shownAs(shown, 1, 'confirm');
    expect(confirm.detail?.join(' ')).toMatch(/invalida o anterior/);
    expect(requested('POST /auth/recovery-code')).toBe(1);
    expect(shown.map((entry) => entry.kind)).toEqual(['info', 'confirm']);

    answers.push(true);
    await run('lords.generateRecoveryCode');
    expect(requested('POST /auth/recovery-code')).toBe(2);
    expect(shown.map((entry) => entry.kind)).toEqual(['info', 'confirm', 'confirm', 'info']);
  });

  it('gerar: se o servidor falhar, avisa e não mostra código nenhum', async () => {
    const { run, api, shown, controller } = await setup();
    api.state.failNext.set('/auth/recovery-code', {
      status: 429,
      body: { code: 'RATE_LIMITED', message: 'Muitas tentativas. Espere um pouco.' },
    });
    await run('lords.generateRecoveryCode');
    expect(shown).toEqual([]);
    expect(controller.toasts).toMatchObject([
      { kind: 'error', text: 'Muitas tentativas. Espere um pouco.' },
    ]);
    expect(controller.account.state).toMatchObject({ hasRecoveryCode: false });
  });
});

describe('conta: sair e excluir', () => {
  it('sair de uma conta anônima sem Código do Reino avisa que não há volta', async () => {
    const { run, answers, shown, controller } = await setup();
    answers.push(false);
    await run('lords.signOut');
    const confirm = shownAs(shown, 0, 'confirm');
    expect(confirm.detail?.join(' ')).toMatch(/anônima/);
    expect(confirm.detail?.join(' ')).toMatch(/não poderá mais voltar/);
    // Sem confirmar, continua dentro.
    expect(controller.account.state.kind).toBe('anonymous');
  });

  it('com Código do Reino (ou GitHub), o aviso é outro: dá para voltar', async () => {
    const { run, answers, shown } = await setup();
    await run('lords.generateRecoveryCode');
    answers.push(false);
    await run('lords.signOut');
    const withCode = shownAs(shown, 1, 'confirm').detail?.join(' ') ?? '';
    expect(withCode).toMatch(/poderá voltar/);
    expect(withCode).not.toMatch(/não poderá/);

    const linked = await setup({
      before: ({ api, store }) => {
        if (api.state.account !== null) {
          api.state.account = { ...api.state.account, linked: { github: true } };
        }
        store.data['lords.account:self'] = {
          ...(store.data['lords.account:self'] as object),
          kind: 'linked',
        };
      },
    });
    linked.answers.push(false);
    await linked.run('lords.signOut');
    const withGithub = shownAs(linked.shown, 0, 'confirm').detail?.join(' ') ?? '';
    expect(withGithub).toMatch(/poderá voltar/);
    expect(withGithub).not.toMatch(/não poderá/);
  });

  it('confirmado, sai: credenciais e estado guardado somem, sem aviso de "sessão terminou"', async () => {
    const { run, answers, requested, controller, tokenStore, store } = await setup();
    expect(store.keys().some((entry) => entry.startsWith('lords.cache:'))).toBe(true);
    answers.push(true);
    await run('lords.signOut');
    expect(requested('POST /auth/logout')).toBe(1);
    expect(controller.account.state.kind).toBe('signedOut');
    expect(await tokenStore.get()).toBeNull();
    expect(store.keys().filter((entry) => entry.startsWith('lords.cache:'))).toEqual([]);
    expect(store.get('lords.account:self')).toBeUndefined();
    expect(controller.route).toBe('welcome');
    expect(controller.view).toBeNull();
    expect(controller.toasts).toEqual([]);
  });

  it('excluir explica o bloqueio imediato, os sete dias e os 14 dias de cópias, sem oferecer desfazer', async () => {
    const { run, answers, shown, requested } = await setup();
    answers.push(false);
    await run('lords.deleteAccount');
    expect(shown.map((entry) => entry.kind)).toEqual(['confirm']);
    const confirm = shownAs(shown, 0, 'confirm');
    const text = [confirm.title, ...(confirm.detail ?? [])].join(' ');
    expect(text).toMatch(/bloqueada na hora/);
    expect(text).toMatch(/não pode ser recuperada/);
    expect(text).toMatch(/sete dias/);
    expect(text).toMatch(/14 dias/);
    expect(text).toMatch(/cópias de segurança/);
    expect(`${text} ${confirm.confirmLabel} ${confirm.cancelLabel ?? ''}`).not.toMatch(/desfazer/i);
    // Não promete remoção imediata dos dados.
    expect(text).not.toMatch(/removid[oa]s? (na hora|imediatamente|agora)/i);
    expect(requested('DELETE /me')).toBe(0);
  });

  it('excluir exige também digitar o nome do feudo', async () => {
    const { run, answers, shown, requested, controller } = await setup();
    answers.push(true, undefined);
    await run('lords.deleteAccount');
    expect(shown.map((entry) => entry.kind)).toEqual(['confirm', 'input']);
    const input = shownAs(shown, 1, 'input');
    expect(input.prompt).toContain('Pedra Alta');
    expect(input.value ?? '').toBe('');
    expect(input.validate?.('')?.severity).toBe('error');
    expect(input.validate?.('Pedra')?.severity).toBe('error');
    expect(input.validate?.('pedra alta')?.severity).toBe('error');
    expect(input.validate?.('Pedra Alta')).toBeNull();
    // Desistiu de digitar: nada foi excluído.
    expect(requested('DELETE /me')).toBe(0);
    expect(controller.account.state.kind).toBe('anonymous');
  });

  it('confirmada e com o nome digitado, exclui e limpa tudo deste navegador', async () => {
    const { run, answers, requested, controller, tokenStore, store } = await setup();
    answers.push(true, 'Pedra Alta');
    await run('lords.deleteAccount');
    expect(requested('DELETE /me')).toBe(1);
    expect(controller.account.state.kind).toBe('signedOut');
    expect(await tokenStore.get()).toBeNull();
    expect(store.keys().filter((entry) => entry.startsWith('lords.cache:'))).toEqual([]);
    expect(controller.route).toBe('welcome');
    // Um aviso só, de informação, sem botão de desfazer.
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({ kind: 'info', actions: [] });
    expect(controller.toasts[0]?.text).toMatch(/^Conta excluída\./);
    expect(controller.toasts[0]?.text).not.toMatch(/desfazer/i);
  });

  it('se o servidor recusar a exclusão, a conta continua aqui e o erro aparece', async () => {
    const { run, answers, api, controller, tokenStore } = await setup();
    api.state.failNext.set('/me', {
      status: 500,
      body: { code: 'INTERNAL', message: 'Não foi possível excluir agora.' },
    });
    answers.push(true, 'Pedra Alta');
    await run('lords.deleteAccount');
    expect(controller.account.state.kind).toBe('anonymous');
    expect(await tokenStore.get()).not.toBeNull();
    expect(controller.toasts).toMatchObject([
      { kind: 'error', text: 'Não foi possível excluir agora.' },
    ]);
  });

  it('sem conta, sair e excluir não fazem nada', async () => {
    const { run, shown, api } = await setup({ signedIn: false });
    const before = api.state.requests.length;
    await run('lords.signOut');
    await run('lords.deleteAccount');
    await run('lords.generateRecoveryCode');
    expect(shown).toEqual([]);
    expect(api.state.requests).toHaveLength(before);
  });
});

describe('conta: GitHub (device flow)', () => {
  const TOKEN = 'gho_token_de_teste';

  it('vincular: mostra o código, espera a confirmação e vincula a conta', async () => {
    const { run, answers, shown, infos, api, requested, controller, browser, logs } = await setup();
    answers.push('manter aberto');
    api.state.devicePolls.push(
      { status: 'pending' },
      { status: 'authorized', githubAccessToken: TOKEN },
    );
    await run('lords.linkGithub');

    const info = shownAs(shown, 0, 'info');
    expect(info.title).toBe('Vincular ao GitHub');
    expect(info.code).toBe('LOTG-0001');
    expect(info.link).toEqual({
      href: 'https://github.com/login/device',
      label: 'Abrir github.com',
    });
    expect(info.status).toMatch(/Aguardando/);
    // O segredo da tentativa nunca é mostrado ao jogador.
    expect(JSON.stringify(info)).not.toContain('dispositivo-1');
    expect(info.paragraphs.join(' ')).toMatch(/não é guardado/);

    expect(requested('POST /auth/github/device')).toBe(1);
    expect(requested('POST /auth/github/device/poll')).toBe(2);
    expect(requested('POST /auth/github')).toBe(1);
    // Respeita o intervalo que o GitHub pediu entre as consultas.
    expect(browser.sleeps).toEqual([5000, 5000]);
    expect(controller.account.state).toMatchObject({ kind: 'linked', displayName: 'Gustavo' });
    // O diálogo fecha sozinho e um aviso confirma.
    expect(infos[0]?.open).toBe(false);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.kind).toBe('info');
    expect(controller.toasts[0]?.text).toMatch(/vinculada ao GitHub/);
    // O token do GitHub não fica em avisos, no log nem no armazenamento.
    expect(controller.toasts.some((toast) => toast.text.includes(TOKEN))).toBe(false);
    expect(logs.join('\n')).not.toContain(TOKEN);
  });

  it('o token do GitHub não é guardado neste navegador', async () => {
    const { run, answers, api, store } = await setup();
    answers.push('manter aberto');
    api.state.devicePolls.push({ status: 'authorized', githubAccessToken: TOKEN });
    await run('lords.linkGithub');
    expect(JSON.stringify(store.data)).not.toContain(TOKEN);
  });

  it('entrar: sem conta, o mesmo fluxo abre a conta já vinculada', async () => {
    const api = fakeApi();
    api.seed();
    const { run, answers, shown, controller, tokenStore } = await setup({ signedIn: false, api });
    answers.push('manter aberto');
    api.state.devicePolls.push({ status: 'authorized', githubAccessToken: TOKEN });
    await run('lords.signInGithub');
    expect(shownAs(shown, 0, 'info').title).toBe('Entrar com GitHub');
    expect(controller.account.state).toMatchObject({ kind: 'linked', displayName: 'Gustavo' });
    expect(await tokenStore.get()).not.toBeNull();
    expect(controller.toasts).toMatchObject([
      { kind: 'info', text: 'Bem-vindo de volta, Gustavo.' },
    ]);
    expect(controller.route).toBe('fief');
  });

  it('um pedido para ir mais devagar aumenta o intervalo das consultas', async () => {
    const { run, answers, api, browser, controller } = await setup();
    answers.push('manter aberto');
    api.state.devicePolls.push(
      { status: 'slowDown', intervalSeconds: 10 },
      { status: 'authorized', githubAccessToken: TOKEN },
    );
    await run('lords.linkGithub');
    expect(browser.sleeps).toEqual([5000, 10000]);
    expect(controller.account.state.kind).toBe('linked');
  });

  it('código vencido: avisa, fecha o diálogo e nada muda na conta', async () => {
    const { run, answers, infos, api, requested, controller } = await setup();
    answers.push('manter aberto');
    api.state.devicePolls.push({ status: 'expired' });
    await run('lords.linkGithub');
    expect(requested('POST /auth/github')).toBe(0);
    expect(controller.account.state.kind).toBe('anonymous');
    expect(infos[0]?.open).toBe(false);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.kind).toBe('warning');
    expect(controller.toasts[0]?.text).toMatch(/venceu/);
  });

  it('o prazo do código também encerra a espera, mesmo sem resposta do GitHub', async () => {
    let now = Date.parse('2026-10-01T12:00:00.000Z');
    const { run, answers, env, requested, controller } = await setup({ now: () => now });
    answers.push('manter aberto');
    // Cada espera consome dez minutos do relógio: o código vale quinze.
    env.sleep = async () => {
      now += 10 * 60_000;
    };
    await run('lords.linkGithub');
    expect(requested('POST /auth/github/device/poll')).toBe(1);
    expect(requested('POST /auth/github')).toBe(0);
    expect(controller.toasts[0]?.text).toMatch(/venceu/);
    expect(controller.account.state.kind).toBe('anonymous');
  });

  it('autorização recusada no GitHub: avisa que nada mudou', async () => {
    const { run, answers, infos, api, requested, controller } = await setup();
    answers.push('manter aberto');
    api.state.devicePolls.push({ status: 'pending' }, { status: 'denied' });
    await run('lords.linkGithub');
    expect(requested('POST /auth/github')).toBe(0);
    expect(controller.account.state.kind).toBe('anonymous');
    expect(infos[0]?.open).toBe(false);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.kind).toBe('warning');
    expect(controller.toasts[0]?.text).toMatch(/recusada/);
    expect(controller.toasts[0]?.text).toMatch(/Nada mudou/);
  });

  it('o jogador fechou o diálogo: cancelado, sem consultas, sem avisos, nada muda', async () => {
    const { run, shown, api, requested, controller } = await setup();
    api.state.devicePolls.push({ status: 'authorized', githubAccessToken: TOKEN });
    // Por padrão o roteiro fecha o diálogo na hora, como o jogador que desiste.
    await run('lords.linkGithub');
    expect(shown.map((entry) => entry.kind)).toEqual(['info']);
    expect(requested('POST /auth/github/device/poll')).toBe(0);
    expect(requested('POST /auth/github')).toBe(0);
    expect(controller.account.state.kind).toBe('anonymous');
    expect(controller.toasts).toEqual([]);
  });

  it('servidor sem o vínculo com o GitHub: avisa e aponta o Código do Reino', async () => {
    const { run, shown, requested, controller } = await setup({
      before: ({ api }) => {
        api.state.githubDevice = false;
      },
    });
    await run('lords.linkGithub');
    expect(shown).toEqual([]);
    expect(requested('POST /auth/github/device')).toBe(0);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.kind).toBe('info');
    expect(controller.toasts[0]?.text).toMatch(/não está ligado neste servidor/);
    expect(controller.toasts[0]?.text).toMatch(/Código do Reino/);
  });

  it('falha de rede no meio da espera: fecha o diálogo e mostra o erro', async () => {
    const { run, answers, infos, api, env, controller } = await setup();
    answers.push('manter aberto');
    env.sleep = async () => {
      api.state.online = false;
    };
    await run('lords.linkGithub');
    expect(infos[0]?.open).toBe(false);
    expect(controller.account.state.kind).toBe('anonymous');
    expect(controller.toasts.some((toast) => toast.kind === 'error')).toBe(true);
  });
});

describe('modo discreto, silenciar e tema', () => {
  it('ligar o modo discreto não mostra aviso nenhum e tira os que estavam à vista', async () => {
    const { run, controller, store } = await setup();
    controller.toast({ kind: 'info', text: 'A Fazenda chegou ao nível 2.' });
    await run('lords.toggleDiscreetMode');
    expect(controller.preferences.discreetMode).toBe(true);
    expect(controller.toasts).toEqual([]);
    // A escolha fica guardada no navegador.
    expect(loadPreferences(store).discreetMode).toBe(true);
  });

  it('desligar o modo discreto confirma com um aviso', async () => {
    const { run, controller, store } = await setup();
    await run('lords.toggleDiscreetMode');
    await run('lords.toggleDiscreetMode');
    expect(controller.preferences.discreetMode).toBe(false);
    expect(loadPreferences(store).discreetMode).toBe(false);
    expect(controller.toasts).toMatchObject([{ kind: 'info', text: 'Modo discreto desligado.' }]);
  });

  it('silenciar vale por 2 horas a partir de agora', async () => {
    const now = Date.parse('2026-10-01T12:00:00.000Z');
    const { run, controller, store } = await setup({ now: () => now });
    expect(controller.preferences.mutedUntil).toBeNull();
    await run('lords.muteNotifications');
    expect(controller.preferences.mutedUntil).toBe(now + TWO_HOURS_MS);
    expect(loadPreferences(store).mutedUntil).toBe(now + TWO_HOURS_MS);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.kind).toBe('info');
    expect(controller.toasts[0]?.text).toMatch(/2 horas/);
  });

  it('trocar tema anda em ciclo a partir do tema em uso: escuro → claro → alto contraste', async () => {
    const { run, controller, browser, store } = await setup();
    // Sem escolha guardada, parte do tema que o sistema escolheu.
    expect(controller.preferences.theme).toBeNull();
    const seen: Array<ThemeId | null> = [];
    for (let step = 0; step < 3; step += 1) {
      await run('lords.toggleTheme');
      seen.push(controller.preferences.theme);
      browser.theme = controller.preferences.theme ?? 'dark';
    }
    expect(seen).toEqual(['light', 'high-contrast', 'dark']);
    expect(loadPreferences(store).theme).toBe('dark');
    expect(controller.toasts.at(-1)).toMatchObject({ kind: 'info', text: 'Tema: Escuro.' });
  });

  it('partindo do tema claro do sistema, o primeiro passo é o alto contraste', async () => {
    const { run, controller, browser } = await setup();
    browser.theme = 'light';
    await run('lords.toggleTheme');
    expect(controller.preferences.theme).toBe('high-contrast');
    expect(controller.toasts.at(-1)?.text).toBe('Tema: Alto contraste.');
  });

  it('esses comandos funcionam sem conta', async () => {
    const { run, controller } = await setup({ signedIn: false });
    await run('lords.toggleTheme');
    await run('lords.muteNotifications');
    await run('lords.toggleDiscreetMode');
    expect(controller.preferences).toMatchObject({ theme: 'light', discreetMode: true });
    expect(controller.preferences.mutedUntil).not.toBeNull();
  });
});

describe('privacidade', () => {
  it('abre um diálogo de informação com o texto de privacidade', async () => {
    const { run, shown, api } = await setup();
    const before = api.state.requests.length;
    await run('lords.privacy');
    const info = shownAs(shown, 0, 'info');
    expect(info.title).toMatch(/privacidade/i);
    expect(info.paragraphs).toEqual(PRIVACY_PARAGRAPHS);
    expect(info.closeLabel).toBe('Entendi');
    expect(api.state.requests).toHaveLength(before);
  });

  it('funciona sem conta: quem ainda não jogou pode ler antes', async () => {
    const { run, shown } = await setup({ signedIn: false });
    await run('lords.privacy');
    expect(shown.map((entry) => entry.kind)).toEqual(['info']);
  });

  it('diz o que fica no navegador e que limpar os dados de navegação apaga', () => {
    const text = PRIVACY_PARAGRAPHS.join(' ');
    expect(text).toMatch(/[Nn]este navegador/);
    expect(text).toMatch(/armazenamento local/);
    expect(text).toMatch(/credenciais/);
    expect(text).toMatch(/último estado do feudo/);
    expect(text).toMatch(/Limpar os dados de navegação os apaga/);
    // E o que isso custa a uma conta sem vínculo.
    expect(text).toMatch(/sem GitHub nem Código do Reino, isso também apaga o acesso à conta/);
  });

  it('diz que o token do GitHub passa pelo servidor e não é guardado', () => {
    const text = PRIVACY_PARAGRAPHS.join(' ');
    expect(text).toMatch(/token do GitHub passa pelo servidor/);
    expect(text).toMatch(/não é guardado/);
  });

  it('diz o que o servidor guarda e os prazos da exclusão', () => {
    const text = PRIVACY_PARAGRAPHS.join(' ');
    expect(text).toMatch(/nome de exibição/);
    expect(text).toMatch(/identificador do GitHub/);
    expect(text).toMatch(/hashes das credenciais/);
    expect(text).toMatch(/bloqueia o acesso na hora/);
    expect(text).toMatch(/sete dias/);
    expect(text).toMatch(/14 dias/);
    expect(text).toMatch(/sem anúncios, sem rastreadores/);
  });

  it('não fala em editor, extensão nem Visual Studio Code', () => {
    const text = PRIVACY_PARAGRAPHS.join(' ');
    expect(text).not.toMatch(/Visual Studio Code|VS ?Code|extensão|SecretStorage|globalState/i);
  });
});

describe('sem feudo aberto', () => {
  it('os comandos do feudo avisam em vez de abrir um diálogo vazio', async () => {
    const { run, shown, orders, controller, browser } = await setup({ signedIn: false });
    for (const id of [
      'lords.allocateWorkers',
      'lords.workersIncrease',
      'lords.build',
      'lords.cancelConstruction',
      'lords.planConstruction',
      'lords.recruit',
      'lords.renameSettlement',
      'lords.downloadChronicle',
    ]) {
      await run(id);
    }
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(browser.downloads).toEqual([]);
    // Avisos iguais não se empilham: fica um só, com o caminho para jogar.
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({ kind: 'info' });
    expect(controller.toasts[0]?.text).toMatch(/Ainda não há um feudo aberto/);
    expect(controller.toasts[0]?.actions.map((action) => action.label)).toEqual(['Jogar agora']);
  });
});
