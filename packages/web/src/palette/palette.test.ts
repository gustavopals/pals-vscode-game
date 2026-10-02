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
  activeConstruction,
  autumnView,
  catalogFixture,
  coldView,
  councilView,
  craftsView,
  fakeApi,
  gameEvent,
  goldenView,
  unlockedView,
  makeController,
  mealCard,
  queuesView,
  scriptedDialogs,
  settle,
  shareCard,
  withCards,
  withPlanned,
  withQueues,
} from '../test-helpers';
import { buildTree, type TreeNode } from '../ui/treeModel';
import { rowActions } from '../workbench/Tree';
import { isPaletteShortcut, openPalette, QuickPick } from './CommandPalette';
import {
  type AppCommand,
  bindCommands,
  cardRequest,
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

const building = withQueues(goldenView, [activeConstruction()]);

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
  it('o texto para ler antes de escolher fica acima do campo, e é o que descreve o diálogo', () => {
    const reading = ['A boca do poço cedeu durante a noite.', 'Expira em 23 h.'];
    const markup = renderToString(
      h(QuickPick, { title: 'Carta', items, detail: reading, onPick: () => {} }),
    );
    expect(markup).toContain(
      '<div class="quickpick-reading" id="dialog-detail"><p>A boca do poço cedeu durante a noite.</p><p>Expira em 23 h.</p></div>',
    );
    expect(markup.indexOf('quickpick-reading')).toBeGreaterThan(markup.indexOf('quickpick-title'));
    expect(markup.indexOf('quickpick-reading')).toBeLessThan(markup.indexOf('<input'));
    // Sem texto, a lista é a de sempre.
    expect(draw()).not.toContain('quickpick-reading');
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
    // Duas filas ocupadas e planejadas automáticas e manuais.
    tree(queuesView, account()),
    // A mesa do conselho cheia: uma linha por carta, com o botão "Decidir".
    tree(councilView, account()),
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
      'lords.answerCard',
      'lords.build',
      'lords.cancelConstruction',
      'lords.toggleAutoStart',
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
      'lords.newBuilding',
      'lords.blockedUpgrade',
      'lords.activeConstruction',
      'lords.plannedAuto',
      'lords.plannedManual',
      'lords.card',
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
      // V2C-T5 (GDD §6.3): a marca "iniciar quando houver recursos" também tem comando.
      ['lords.toggleAutoStart', /início automático/],
      ['lords.recruit', /^Recrutar aldeões/],
      // V2D-T3 (GDD §13.6): a carta do Conselho se decide também pela paleta.
      ['lords.answerCard', /^Decidir carta do Conselho$/],
      ['lords.openCouncil', /^Ir para o Conselho/],
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
    // A barra de status e a árvore levam ao Conselho pelo mesmo comando.
    controller.runCommand('lords.openPanel', 'council');
    expect(controller.route).toBe('council');
    controller.runCommand('lords.openPanel', 'mercado');
    expect(controller.route).toBe('fief');
    controller.runCommand('lords.openCouncil');
    expect(controller.route).toBe('council');
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
  const rules = goldenView.workersRules;
  const ADAPTATION = 'Quem troca de ofício produz metade por 2 h.';
  const REMOVAL = 'Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação.';

  it('a validação mostra o custo da troca enquanto o jogador digita: agora, depois e a regra', () => {
    // Fazenda na primavera: um adaptado rende 12/h e um recém-chegado, 6/h. Há 2 lá, os dois em
    // adaptação, e 3 livres.
    expect(rules.adaptationText).toBe(ADAPTATION);
    expect(rules.removalText).toBe(REMOVAL);
    expect(workersValidation(farm, rules, free, '3')).toEqual({
      message: `+1: 18/h agora, 36/h depois da adaptação (2 h). ${ADAPTATION}`,
      severity: 'info',
    });
    expect(workersValidation(farm, rules, free, '5')).toEqual({
      message: `+3: 30/h agora, 60/h depois da adaptação (2 h). ${ADAPTATION}`,
      severity: 'info',
    });
    // Tirar: saem os que ainda se adaptam, e a frase do servidor diz isso.
    expect(workersValidation(farm, rules, free, '1')).toEqual({
      message: `−1: 6/h agora, 12/h depois da adaptação (2 h). ${REMOVAL}`,
      severity: 'info',
    });
    expect(workersValidation(farm, rules, free, '0')).toEqual({
      message: `−2: 0/h. ${REMOVAL}`,
      severity: 'info',
    });
    // O mesmo número de hoje: o que já rende e o que vai render.
    expect(workersValidation(farm, rules, free, '2')).toEqual({
      message: 'Como hoje: 12/h agora, 24/h depois da adaptação (2 h).',
      severity: 'info',
    });
    expect(workersPreview(farm, free, '5')).toBeNull();
  });

  it('no ritmo Rápido, o prazo da frase é o que o servidor mandou', () => {
    const fast = {
      ...rules,
      adaptationSeconds: 2400,
      adaptationText: 'Quem troca de ofício produz metade por 40 min.',
    };
    const mill = craftsView.workers[1] as ViewState['workers'][number];
    expect(workersValidation(mill, fast, 2, '6').message).toBe(
      '+2: 52/h agora, 62,4/h depois da adaptação (40 min). Quem troca de ofício produz metade por 40 min.',
    );
  });

  it('recusa o que não é um número inteiro de trabalhadores', () => {
    for (const input of ['', '   ', 'abc', '-1', '1.5', '2,5', '1e99x']) {
      expect(workersPreview(farm, free, input), `"${input}"`).toBe(
        'Digite um número inteiro de trabalhadores.',
      );
      expect(workersValidation(farm, rules, free, input).severity).toBe('error');
    }
  });

  it('recusa mais do que os já alocados somados aos livres, dizendo quantos há', () => {
    const problem = workersPreview(farm, free, '6');
    expect(problem).toContain('5');
    expect(problem).toContain('Fazenda');
    expect(problem).toContain('2 já lá');
    expect(problem).toContain('3 livres');
    expect(workersValidation(farm, rules, free, '6')).toEqual({
      message: problem,
      severity: 'error',
    });
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
    // Cada edifício mostra quantos trabalham lá, quanto rende e quem ainda se adapta.
    expect(pick.items[0]?.description).toBe('2 trabalhadores · 12/h · 2 em adaptação');
    expect(pick.items[1]?.description).toBe('0 trabalhadores · 0/h');
    // O custo da troca já está na lista, antes de escolher: o que um a mais rende em cada
    // edifício, agora e depois, e a conta da taxa de hoje.
    expect(pick.items[0]?.detail).toBe(`+1: +6/h agora, +12/h depois de 2 h. ${farm.breakdown}`);
    expect(pick.items[1]?.detail).toBe(
      '+1: +4/h agora, +8/h depois de 2 h. 0 trabalhadores × 8 × 1 (Nv1) = 0/h',
    );
    // Os livres e a regra, na frase do servidor, ficam à vista no campo de busca.
    expect(pick.placeholder).toBe(`3 aldeões livres. ${ADAPTATION}`);

    const input = shownAs(shown, 1, 'input');
    expect(input.title).toBe('Fazenda Nv1');
    expect(input.value).toBe('2');
    expect(input.prompt).toBe(
      `Quantos trabalhadores? Hoje são 2 (2 em adaptação); há 3 livres. Cada um rende 12/h aqui; quem chega agora, 6/h. ${ADAPTATION}`,
    );
    expect(input.validate?.('3')).toEqual({
      message: `+1: 18/h agora, 36/h depois da adaptação (2 h). ${ADAPTATION}`,
      severity: 'info',
    });
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
    // Ninguém lá, ninguém em adaptação: a pergunta não fala de adaptação em curso.
    expect(shownAs(shown, 0, 'input').prompt).toContain('Hoje são 0; há 3 livres.');
    expect(shownAs(shown, 0, 'input').validate?.('2')).toEqual({
      message: `+2: 8/h agora, 16/h depois da adaptação (2 h). ${ADAPTATION}`,
      severity: 'info',
    });
    expect(orders()).toEqual([
      { type: 'setWorkers', payload: { building: 'lumberMill', count: 2 } },
    ]);
  });

  it('a lista de um feudo com ofícios em andamento diz quem se adapta em cada edifício', async () => {
    const { run, answers, shown } = await setup({
      before: ({ api }) => {
        api.state.view = craftsView;
      },
    });
    answers.push(undefined);
    await run('lords.allocateWorkers');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.items.map((item) => item.description)).toEqual([
      '4 trabalhadores · 61,2/h · 2 em adaptação',
      '4 trabalhadores · 41,6/h',
      '2 trabalhadores · 11,1/h · 1 em adaptação',
      '0 trabalhadores · 0/h',
    ]);
    expect(pick.items[1]?.detail).toContain('+1: +5,2/h agora, +10,4/h depois de 2 h.');
    expect(pick.placeholder).toBe(`2 aldeões livres. ${ADAPTATION}`);
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

describe('prazos que a estação muda', () => {
  const inSeason = (view: typeof goldenView) =>
    setup({
      before: (made) => {
        made.api.state.view = view;
      },
    });

  it('no inverno, a lista de obras diz uma vez por que os prazos são maiores', async () => {
    const { run, answers, shown } = await inSeason(coldView);
    answers.push(undefined);
    await run('lords.build');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.placeholder).toBe(
      'Os pedreiros estão livres. No Inverno, o prazo de uma obra iniciada agora é × 1,5.',
    );
    expect(pick.items.find((item) => item.value === 'farm')).toMatchObject({
      icon: 'lock',
      // O prazo já é o de quem começa agora: o app não multiplica nada.
      description: '128 madeira, 64 ouro · 12 min',
      detail: 'Faltam 128 madeira.',
    });
  });

  it('fora do inverno, a lista não diz nada sobre o prazo', async () => {
    const { run, answers, shown } = await inSeason(autumnView);
    answers.push(undefined);
    await run('lords.build');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.placeholder).toBe('Os pedreiros estão livres.');
    expect(pick.items.find((item) => item.value === 'farm')?.detail).toBe('Faltam 68 madeira.');
  });

  it('na primavera, recrutar diz por que o prazo é menor; nas outras estações, não', async () => {
    const spring = await setup();
    spring.answers.push(undefined);
    await spring.run('lords.recruit');
    expect(shownAs(spring.shown, 0, 'input').prompt).toBe(
      'Cada aldeão custa 50 comida, 10 ouro e leva 16 min. Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8. Vagas: 5 de 10. ' +
        // O que a ordem custa à moral vem junto do custo em recursos, na frase do servidor.
        'Chamar aldeões agora gasta a comida guardada, que vale 10 de moral. Com as casas cheias a moral perde 10: para evitar, chame até 4.',
    );

    const autumn = await inSeason(autumnView);
    autumn.answers.push(undefined);
    await autumn.run('lords.recruit');
    expect(shownAs(autumn.shown, 0, 'input').prompt).toBe(
      'Cada aldeão custa 50 comida, 10 ouro e leva 20 min. Vagas: 12 de 30. Chamar mais de 2 aldeões agora gasta a comida guardada, que vale 10 de moral.',
    );
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

  it('o Celeiro e o Armazém entram na lista como "Construir", com o que a obra muda', async () => {
    const { run, answers, shown } = await setup();
    answers.push(undefined);
    await run('lords.build');
    const byLabel = new Map(shownAs(shown, 0, 'pick').items.map((item) => [item.label, item]));
    // Antes do Salão Nv2: cadeado, e o detalhe traz o efeito e o que libera a obra.
    expect(byLabel.get('Construir: Celeiro')).toMatchObject({
      icon: 'lock',
      description: '160 madeira, 80 pedra · 10 min',
      detail: 'Capacidade de comida: 500 → 900. Melhore antes o Salão do Senhor para o nível 2.',
      value: 'granary',
    });
    expect(byLabel.get('Construir: Armazém')?.detail).toBe(
      'Capacidade de madeira e de pedra: 500 → 900 cada. Melhore antes o Salão do Senhor para o nível 2.',
    );
    expect([...byLabel.keys()].some((label) => label.includes('Nv0'))).toBe(false);
  });

  it('o botão do aviso de depósito cheio manda o edifício: a obra começa sem abrir a lista', async () => {
    const { run, shown, orders } = await setup({
      before: ({ api }) => {
        api.state.view = unlockedView;
      },
    });
    await run('lords.build', 'warehouse');
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'startConstruction', payload: { building: 'warehouse' } }]);
  });

  it('"Construir" em um item da árvore começa a obra do edifício novo', async () => {
    const { run, shown, orders } = await setup({
      before: ({ api }) => {
        api.state.view = unlockedView;
      },
    });
    await run('lords.build', { id: 'construction:granary', label: 'Construir: Celeiro' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([{ type: 'startConstruction', payload: { building: 'granary' } }]);
  });

  it('um custo que não cabe no depósito é recusado com a frase do servidor', async () => {
    const reason =
      'A obra pede 875 de madeira e o Pátio só guarda 500: construa o Armazém primeiro.';
    const { run, api, controller } = await setup();
    api.refuseNextCommand(reason);
    await run('lords.build', 'townHall');
    expect(controller.toasts).toMatchObject([{ kind: 'warning', text: reason }]);
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

  it('cancelar com o depósito perto do limite diz quanto da devolução se perderia', async () => {
    const { run, answers, shown } = await setup({
      before: ({ api }) => {
        api.state.view = withQueues(goldenView, [
          activeConstruction({
            refund: [
              { resource: 'wood', label: 'Madeira', amount: 30, lost: 50 },
              { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
            ],
          }),
        ]);
      },
    });
    answers.push(false);
    await run('lords.cancelConstruction');
    expect(shownAs(shown, 0, 'confirm').detail).toEqual([
      'Voltam 30 madeira, 40 pedra. Não cabem no depósito e se perderiam: 50 madeira.',
    ]);
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

  it('planejar: escolhe uma melhoria e responde se ela começa sozinha', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(1, false);
    await run('lords.planConstruction');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.placeholder).toContain('Planejar não gasta nada');
    expect(pick.items).toHaveLength(goldenView.constructions.available.length);
    expect(pick.items.every((item) => item.label.startsWith('Planejar: '))).toBe(true);
    expect(pick.items[1]).toMatchObject({
      label: 'Planejar: Fazenda → Nv2',
      description: '80 madeira, 40 ouro · 5 min',
    });
    // A segunda pergunta: duas opções, cada uma com a sua frase.
    const question = shownAs(shown, 1, 'pick');
    expect(question.title).toBe('Planejar: Fazenda Nv1 → Nv2');
    expect(question.items.map((item) => [item.label, item.value])).toEqual([
      ['Iniciar quando houver recursos', true],
      ['Só deixar na lista', false],
    ]);
    expect(question.items[1]?.detail).toBe('A obra espera a sua ordem, com o custo à vista.');
    // A ordem leva o nível que a lista mostrou: a tela atrasada não planeja outro nível.
    expect(orders()).toEqual([
      { type: 'planConstruction', payload: { building: 'farm', autoStart: false, targetLevel: 2 } },
    ]);
  });

  it('planejar como automática manda a marca junto com o plano', async () => {
    const { run, answers, orders } = await setup();
    answers.push(1, 0);
    await run('lords.planConstruction');
    expect(orders()).toEqual([
      { type: 'planConstruction', payload: { building: 'farm', autoStart: true, targetLevel: 2 } },
    ]);
  });

  it('o que vem marcado nunca gasta: a automática para a obra que espera, a lista para a que já pode começar', async () => {
    const { run, answers, shown } = await setup();
    // O Salão espera recursos: a automática vem marcada, e Enter basta.
    answers.push(0, undefined);
    await run('lords.planConstruction');
    expect(shownAs(shown, 1, 'pick').selected).toBe(0);
    // A Fazenda pode começar agora: marcar a automática seria gastar na hora. Vem marcado o
    // que só a deixa na lista.
    answers.push(1, undefined);
    await run('lords.planConstruction');
    expect(shownAs(shown, 3, 'pick').selected).toBe(1);
  });

  it('a opção automática diz o que acontece agora: começa já, ou espera recursos e fila', async () => {
    const { run, answers, shown } = await setup();
    // A Fazenda pode começar agora: marcar como automática é gastar na hora, e a frase avisa.
    answers.push(1, undefined);
    await run('lords.planConstruction');
    expect(shownAs(shown, 1, 'pick').items[0]?.detail).toBe(
      'Há recursos e pedreiros livres: a obra começa agora mesmo.',
    );
    // O Salão espera recursos: a automática começa sozinha quando eles chegarem.
    answers.push(0, undefined);
    await run('lords.planConstruction');
    const blocked = shownAs(shown, 3, 'pick');
    expect(blocked.title).toBe('Planejar: Salão do Senhor Nv1 → Nv2');
    expect(blocked.items[0]?.detail).toBe(
      'Os pedreiros começam sozinhos assim que houver recursos e fila livre, mesmo com você longe.',
    );
  });

  it('desistir na pergunta da marca não planeja nada', async () => {
    const { run, answers, shown, orders } = await setup();
    answers.push(1, undefined);
    await run('lords.planConstruction');
    expect(shown).toHaveLength(2);
    expect(orders()).toEqual([]);
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
        planned: [{ ...farm, planned: true, autoStart: false, waiting: null }],
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
    // Tirar da lista não pergunta mais nada.
    expect(shown).toHaveLength(1);
    expect(orders()).toEqual([{ type: 'unplanConstruction', payload: { building: 'farm' } }]);
  });

  it('desistir do planejamento não manda nada', async () => {
    const { run, answers, orders } = await setup();
    answers.push(undefined);
    await run('lords.planConstruction');
    expect(orders()).toEqual([]);
  });
});

describe('duas filas de obras e a marca das planejadas (GDD §6.3)', () => {
  const queued = {
    before: ({ api }: ReturnType<typeof makeController>) => void (api.state.view = queuesView),
  };

  it('com duas obras em andamento, a lista de construir diz as duas e quando terminam', async () => {
    const { run, answers, shown } = await setup(queued);
    answers.push(undefined);
    await run('lords.build');
    expect(shownAs(shown, 0, 'pick').placeholder).toMatch(
      /^Em obras: Serraria → Nv2, termina em 00:0[23]; Mina de Ouro → Nv2, termina em 00:0[56]$/,
    );
  });

  it('cancelar pela paleta com duas obras pergunta qual, e só depois pede a confirmação', async () => {
    const { run, answers, shown, orders } = await setup(queued);
    answers.push(1, true);
    await run('lords.cancelConstruction');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.title).toBe('Cancelar qual obra?');
    expect(pick.items.map((item) => item.label)).toEqual(['Serraria → Nv2', 'Mina de Ouro → Nv2']);
    // Cada obra traz o que o cancelamento devolve, antes da escolha.
    expect(pick.items[1]?.detail).toBe('Cancelar devolve 96 madeira, 64 pedra.');
    const confirm = shownAs(shown, 1, 'confirm');
    expect(confirm.title).toBe('Cancelar a obra de Mina de Ouro?');
    expect(confirm.detail).toEqual(['Voltam 96 madeira, 64 pedra.']);
    expect(orders()).toEqual([{ type: 'cancelConstruction', payload: { building: 'goldMine' } }]);
  });

  it('desistir na escolha da obra não pede confirmação nem cancela nada', async () => {
    const { run, answers, shown, orders } = await setup(queued);
    answers.push(undefined);
    await run('lords.cancelConstruction');
    expect(shown).toHaveLength(1);
    expect(orders()).toEqual([]);
  });

  it('"Cancelar" em uma linha da árvore cancela a obra daquela linha, sem perguntar qual', async () => {
    const { run, answers, shown, orders } = await setup(queued);
    answers.push(true);
    await run('lords.cancelConstruction', { id: 'active:goldMine', label: 'Mina de Ouro → Nv2' });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['confirm']);
    expect(shownAs(shown, 0, 'confirm').title).toBe('Cancelar a obra de Mina de Ouro?');
    expect(orders()).toEqual([{ type: 'cancelConstruction', payload: { building: 'goldMine' } }]);
  });

  it('com a primeira fila livre, a obra da segunda é cancelada sem perguntar qual', async () => {
    const { run, answers, shown, orders } = await setup({
      before: ({ api }) => {
        api.state.view = withQueues(queuesView, [null, activeConstruction()]);
      },
    });
    answers.push(true);
    await run('lords.cancelConstruction');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['confirm']);
    expect(orders()).toEqual([{ type: 'cancelConstruction', payload: { building: 'lumberMill' } }]);
  });

  it('a marca pela paleta: a lista diz, de cada planejada, o que o clique faz e o que ela espera', async () => {
    const { run, answers, shown, orders } = await setup(queued);
    answers.push(1);
    await run('lords.toggleAutoStart');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.title).toBe('Início automático das planejadas');
    expect(pick.items.map((item) => item.label)).toEqual([
      'Esperar a sua ordem: Serraria Nv2 → Nv3',
      'Iniciar quando houver recursos: Habitações Nv1 → Nv2',
      'Esperar a sua ordem: Fazenda Nv1 → Nv2',
      'Esperar a sua ordem: Salão do Senhor Nv4 → Nv5',
      'Esperar a sua ordem: Pedreira Nv5 → Nv6',
    ]);
    expect(pick.items[1]).toMatchObject({
      description: '80 madeira, 20 pedra',
      detail: 'Hoje espera a sua ordem. Espera os pedreiros terminarem outra obra: em 3 min.',
    });
    expect(pick.items[2]?.detail).toMatch(
      /^Hoje começa sozinha\. Espera 15 de ouro: em 1 h 5[01] min\.$/,
    );
    expect(orders()).toEqual([
      { type: 'setAutoStart', payload: { building: 'housing', autoStart: true, targetLevel: 2 } },
    ]);
  });

  it('escolher uma automática desliga a marca', async () => {
    const { run, answers, orders } = await setup(queued);
    answers.push(2);
    await run('lords.toggleAutoStart');
    expect(orders()).toEqual([
      { type: 'setAutoStart', payload: { building: 'farm', autoStart: false, targetLevel: 2 } },
    ]);
  });

  it('o botão da linha da árvore troca a marca daquela obra, sem abrir a lista', async () => {
    const { run, shown, orders } = await setup(queued);
    await run('lords.toggleAutoStart', { id: 'planned:housing', label: 'Habitações → Nv2' });
    await run('lords.toggleAutoStart', { id: 'planned:quarry', label: 'Pedreira → Nv6' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([
      { type: 'setAutoStart', payload: { building: 'housing', autoStart: true, targetLevel: 2 } },
      { type: 'setAutoStart', payload: { building: 'quarry', autoStart: false, targetLevel: 6 } },
    ]);
  });

  it('desistir da lista da marca não manda nada', async () => {
    const { run, answers, orders } = await setup(queued);
    answers.push(undefined);
    await run('lords.toggleAutoStart');
    expect(orders()).toEqual([]);
  });

  it('sem planejadas, avisa e oferece planejar', async () => {
    const { run, shown, orders, controller, answers } = await setup();
    await run('lords.toggleAutoStart');
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(controller.toasts).toMatchObject([
      {
        kind: 'info',
        text: 'Não há obras planejadas. Planeje uma obra para ela poder começar sozinha.',
      },
    ]);
    // O botão do aviso abre a lista de planejar.
    answers.push(undefined);
    controller.toasts[0]?.actions[0]?.run();
    await settle(controller);
    expect(shownAs(shown, 0, 'pick').title).toBe('Obras planejadas');
  });

  it('a obra que deixou de estar planejada é recusada com a frase do servidor', async () => {
    const { run, api, controller } = await setup(queued);
    api.refuseNextCommand('A Fazenda não está na lista de obras planejadas.', 'NOT_PLANNED');
    await run('lords.toggleAutoStart', { id: 'planned:farm', label: 'Fazenda → Nv2' });
    expect(controller.toasts).toMatchObject([
      { kind: 'warning', text: 'A Fazenda não está na lista de obras planejadas.' },
    ]);
  });

  it('a marca dada com a tela atrasada é recusada com a frase do servidor', async () => {
    const { run, api, controller } = await setup(queued);
    const refusal =
      'Essa ordem ficou para trás: a obra da Fazenda agora é a do nível 3. Confira a lista e peça de novo.';
    api.refuseNextCommand(refusal, 'STALE_LEVEL');
    await run('lords.toggleAutoStart', { id: 'planned:farm', label: 'Fazenda → Nv2' });
    expect(controller.toasts).toMatchObject([{ kind: 'warning', text: refusal }]);
  });

  it('a marca é uma ordem como as outras: "Tentar de novo" reenvia o mesmo commandId', async () => {
    const { run, api, controller } = await setup({
      before: ({ api: fake }) => {
        fake.state.view = withPlanned(goldenView, [{ building: 'farm' }]);
      },
    });
    api.state.online = false;
    await run('lords.toggleAutoStart', 'farm');
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
      { type: 'setAutoStart', payload: { building: 'farm', autoStart: true, targetLevel: 2 } },
    ]);
    expect(api.state.commands[0]?.commandId).toBe('00000000-0000-4000-8000-000000000001');
  });
});

describe('decidir carta do Conselho (GDD §7 e §13.6)', () => {
  const seated = (view: ViewState) => ({
    before: ({ api }: ReturnType<typeof makeController>) => void (api.state.view = view),
  });
  const oneCard = withCards(goldenView, [mealCard]);
  const answer = (instanceId: string, optionId: string) => ({
    type: 'answerCard',
    payload: { instanceId, optionId },
  });
  const toastTexts = (controller: Controller) => controller.toasts.map((toast) => toast.text);

  it('pela paleta, com uma carta: a lista das opções traz o texto da carta, o prazo e o que acontece sem resposta', async () => {
    const { run, answers, shown, orders } = await setup(seated(oneCard));
    answers.push('feast');
    await run('lords.answerCard');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick']);
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.title).toBe('Carta do Conselho: A refeição dos pedreiros');
    expect(pick.detail).toEqual([
      mealCard.text,
      'Expira em 23 h. Sem resposta até o fim do prazo, o conselho decide sozinho: repartir o pão do dia.',
    ]);
    expect(pick.items.map((item) => item.label)).toEqual([
      'Servir a refeição',
      'Repartir o pão do dia',
      'Mandar voltar ao trabalho',
    ]);
    // O custo e a consequência conhecida ao lado do verbo; a pista, logo abaixo.
    expect(pick.items[0]).toMatchObject({
      icon: 'check',
      description: '−40 comida; +10 de moral por 2 dias de jogo (1 h 20 min)',
      detail: 'Barriga cheia, ânimo alto.',
      value: 'feast',
    });
    expect(pick.items[2]?.description).toBe(
      '+15 pedra; −5 de moral por 2 dias de jogo (1 h 20 min)',
    );
    expect(orders()).toEqual([answer('masonsMeal-4', 'feast')]);
  });

  it('o que já vem marcado é a opção que o conselho aplicaria sozinho: Enter sem ler não gasta', async () => {
    const { run, answers, shown } = await setup(seated(oneCard));
    answers.push(undefined);
    await run('lords.answerCard');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.selected).toBe(1);
    expect(pick.items[1]).toMatchObject({
      label: 'Repartir o pão do dia',
      description: 'Sem custo e sem efeito imediato.',
      detail: 'Nem festa, nem queixa. É o que o conselho faz sozinho, se o prazo acabar.',
    });
    // Só ela leva a marca.
    expect(pick.items.filter((item) => item.detail?.includes('faz sozinho'))).toHaveLength(1);
  });

  it('com duas cartas, pergunta qual, com o prazo e o texto de cada uma, e depois a opção', async () => {
    const { run, answers, shown, orders } = await setup(seated(councilView));
    answers.push(1, 'refuse');
    await run('lords.answerCard');
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick', 'pick']);
    const cards = shownAs(shown, 0, 'pick');
    expect(cards.title).toBe('Decidir carta do Conselho');
    expect(cards.items.map((item) => [item.label, item.description])).toEqual([
      ['A vez de repartir', 'expira em 23 h'],
      ['A refeição dos pedreiros', 'expira em 23 h'],
    ]);
    expect(cards.items[1]?.detail).toBe(mealCard.text);
    expect(shownAs(shown, 1, 'pick').title).toBe('Carta do Conselho: A refeição dos pedreiros');
    expect(orders()).toEqual([answer('masonsMeal-4', 'refuse')]);
  });

  it('a continuação diz de onde a história vem, antes do texto da carta', async () => {
    const { run, answers, shown } = await setup(seated(councilView));
    answers.push(0, undefined);
    await run('lords.answerCard');
    expect(shownAs(shown, 1, 'pick').detail?.slice(0, 2)).toEqual([
      'A história continua: em "Tábuas para as reservas", a decisão foi ceder a madeira.',
      shareCard.text,
    ]);
  });

  it('desistir na lista das cartas ou na das opções não envia nada', async () => {
    const first = await setup(seated(councilView));
    first.answers.push(undefined);
    await first.run('lords.answerCard');
    expect(first.shown).toHaveLength(1);
    expect(first.orders()).toEqual([]);

    const second = await setup(seated(councilView));
    second.answers.push(0, undefined);
    await second.run('lords.answerCard');
    expect(second.shown).toHaveLength(2);
    expect(second.orders()).toEqual([]);
    expect(second.controller.toasts).toEqual([]);
  });

  it('"Decidir" em uma linha da árvore abre as opções daquela carta, sem perguntar qual', async () => {
    const { run, answers, shown, orders } = await setup(seated(councilView));
    answers.push('share');
    await run('lords.answerCard', { id: 'card:commonGranaryShare-3', label: 'A vez de repartir' });
    expect(shown.map((dialog) => dialog.kind)).toEqual(['pick']);
    expect(shownAs(shown, 0, 'pick').title).toBe('Carta do Conselho: A vez de repartir');
    expect(orders()).toEqual([answer('commonGranaryShare-3', 'share')]);
  });

  it('o painel manda a carta e a opção do botão clicado: nenhum diálogo, a mesma ordem', async () => {
    const { run, shown, orders, controller } = await setup(seated(councilView));
    await run('lords.answerCard', { instanceId: 'masonsMeal-4', optionId: 'bread' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([answer('masonsMeal-4', 'bread')]);
    // Pelo controlador, como a árvore e o painel chamam.
    controller.runCommand('lords.answerCard', {
      instanceId: 'commonGranaryShare-3',
      optionId: 'reserve',
    });
    await settle(controller);
    expect(orders()).toEqual([
      answer('masonsMeal-4', 'bread'),
      answer('commonGranaryShare-3', 'reserve'),
    ]);
  });

  it('painel, árvore e paleta mandam a mesma ordem, cada uma com o seu commandId', async () => {
    const { run, answers, api } = await setup(seated(councilView));
    answers.push('bread', 1, 'bread');
    await run('lords.answerCard', { instanceId: 'masonsMeal-4', optionId: 'bread' });
    await run('lords.answerCard', { id: 'card:masonsMeal-4' });
    await run('lords.answerCard');
    expect(api.state.commands.map(({ type, payload }) => ({ type, payload }))).toEqual([
      answer('masonsMeal-4', 'bread'),
      answer('masonsMeal-4', 'bread'),
      answer('masonsMeal-4', 'bread'),
    ]);
    expect(new Set(api.state.commands.map((command) => command.commandId)).size).toBe(3);
  });

  it('opção trancada ou sem recursos: a lista mostra o requisito ou o que falta, com ícone', async () => {
    const blocked = withCards(goldenView, [
      {
        ...mealCard,
        options: mealCard.options.map((option) =>
          option.id === 'feast'
            ? { ...option, locked: true, lockedReason: 'Requer 100 de comida em estoque.' }
            : option.id === 'refuse'
              ? {
                  ...option,
                  affordable: false,
                  cost: [{ resource: 'gold' as const, label: 'Ouro', amount: 20, missing: 8 }],
                }
              : option,
        ),
      },
    ]);
    const { run, answers, shown, orders, api, controller } = await setup(seated(blocked));
    answers.push('feast');
    api.refuseNextCommand('Servir a refeição requer 100 de comida em estoque.', 'OPTION_LOCKED');
    await run('lords.answerCard');
    const pick = shownAs(shown, 0, 'pick');
    expect(pick.items.map((item) => item.icon)).toEqual(['lock', 'check', 'warning']);
    expect(pick.items[0]?.detail).toBe(
      'Requer 100 de comida em estoque. Barriga cheia, ânimo alto.',
    );
    expect(pick.items[2]?.detail).toBe(
      'Faltam 8 de ouro. A tarde rende mais pedra, e a obra guarda a mágoa.',
    );
    // Mesmo trancada, a escolha segue: quem recusa é o servidor, com o motivo de agora.
    expect(orders()).toEqual([]);
    expect(api.state.requests.filter((entry) => entry.endsWith('/commands'))).toHaveLength(1);
    expect(toastTexts(controller)).toEqual(['Servir a refeição requer 100 de comida em estoque.']);
  });

  it('sem cartas, diz que o conselho não tem nada a tratar e quando volta a se reunir', async () => {
    const { run, shown, orders, controller } = await setup();
    await run('lords.answerCard');
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({
      kind: 'info',
      text: 'O conselho não tem nada a tratar agora. Próxima audiência em 8 h.',
    });
    await controller.toasts[0]?.actions.find((action) => action.label === 'Ver o Conselho')?.run();
    expect(controller.route).toBe('council');
  });

  it('a linha da árvore de uma carta que já saiu da mesa avisa e não abre lista nenhuma', async () => {
    const { run, shown, orders, controller } = await setup(seated(oneCard));
    await run('lords.answerCard', { id: 'card:collapsedWell-9' });
    expect(shown).toEqual([]);
    expect(orders()).toEqual([]);
    expect(toastTexts(controller)).toEqual([
      'Esta carta já não espera resposta: foi respondida, ou o prazo acabou.',
    ]);
  });

  describe('a carta sai da mesa com a lista aberta: a tela avisa e fecha sem enviar', () => {
    /** Um relógio que o teste adianta. */
    const clock = () => {
      let now = Date.parse('2026-10-01T12:00:00.000Z');
      return { now: () => now, advance: (ms: number) => void (now += ms) };
    };

    it('o prazo acabou: diz que o conselho decidiu sozinho', async () => {
      const time = clock();
      const { run, answers, shown, orders, api, controller } = await setup({
        ...seated(oneCard),
        now: time.now,
      });
      answers.push(async () => {
        // Com a lista aberta, o prazo da carta acaba e a leitura seguinte a tira da mesa.
        time.advance((mealCard.expiresInSeconds + 1) * 1000);
        api.state.view = goldenView;
        api.state.stateVersion += 1;
        await controller.session.syncNow();
        return 'feast';
      });
      await run('lords.answerCard');
      expect(shown).toHaveLength(1);
      expect(shownAs(shown, 0, 'pick').signal?.aborted).toBe(true);
      expect(orders()).toEqual([]);
      expect(api.state.requests.filter((entry) => entry.endsWith('/commands'))).toEqual([]);
      expect(controller.toasts).toHaveLength(1);
      expect(controller.toasts[0]).toMatchObject({
        kind: 'warning',
        text: 'O prazo de "A refeição dos pedreiros" acabou antes da sua resposta, e o conselho decidiu sozinho. Nada foi enviado: a Crônica conta o que ele fez.',
      });
    });

    it('outra aba respondeu: diz isso, e não que o prazo acabou', async () => {
      const time = clock();
      const { run, answers, orders, api, controller } = await setup({
        ...seated(councilView),
        now: time.now,
      });
      answers.push(async () => {
        time.advance(60_000);
        api.state.view = withCards(councilView, [shareCard]);
        api.state.stateVersion += 1;
        await controller.session.syncNow();
        return 'feast';
      });
      await run('lords.answerCard', { id: 'card:masonsMeal-4' });
      expect(orders()).toEqual([]);
      expect(toastTexts(controller)).toEqual([
        '"A refeição dos pedreiros" saiu da mesa antes da sua resposta: foi respondida em outra aba ou em outro navegador. Nada foi enviado.',
      ]);
    });

    it('a outra carta que sai da mesa não fecha a lista desta', async () => {
      const { run, answers, shown, orders, api, controller } = await setup(seated(councilView));
      answers.push(async () => {
        api.state.view = withCards(councilView, [mealCard]);
        api.state.stateVersion += 1;
        await controller.session.syncNow();
        return 'feast';
      });
      await run('lords.answerCard', { id: 'card:masonsMeal-4' });
      expect(shownAs(shown, 0, 'pick').signal?.aborted).toBe(false);
      expect(orders()).toEqual([answer('masonsMeal-4', 'feast')]);
    });

    it('a sessão terminou: nada é enviado, e a tela diz por quê', async () => {
      const { run, answers, orders, controller } = await setup(seated(oneCard));
      answers.push(async () => {
        await controller.account.handleUnauthenticated();
        await settle(controller);
        return 'feast';
      });
      await run('lords.answerCard');
      expect(orders()).toEqual([]);
      expect(toastTexts(controller)).toContain(
        'A sessão terminou com "A refeição dos pedreiros" aberta: nada foi enviado ao conselho. Entre de novo para decidir.',
      );
    });

    it('a carta escolhida na lista das cartas já tinha saído da mesa: avisa e não pergunta a opção', async () => {
      const { run, answers, shown, orders, api, controller } = await setup(seated(councilView));
      answers.push(async () => {
        api.state.view = withCards(councilView, [shareCard]);
        api.state.stateVersion += 1;
        await controller.session.syncNow();
        return mealCard;
      });
      await run('lords.answerCard');
      expect(shown).toHaveLength(1);
      expect(orders()).toEqual([]);
      expect(toastTexts(controller)).toEqual([
        '"A refeição dos pedreiros" saiu da mesa antes da sua resposta: foi respondida em outra aba ou em outro navegador. Nada foi enviado.',
      ]);
    });

    it('depois de fechada a lista, o comando não fica ouvindo o controlador', async () => {
      const { run, answers, controller, api } = await setup(seated(oneCard));
      answers.push(undefined);
      await run('lords.answerCard');
      // A carta some depois: nenhum aviso atrasado.
      api.state.view = goldenView;
      api.state.stateVersion += 1;
      await controller.session.syncNow();
      await settle(controller);
      expect(controller.toasts).toEqual([]);
    });
  });

  it('o argumento do comando: o painel manda os dois, a árvore a linha, a paleta nada', () => {
    expect(cardRequest({ instanceId: 'a-1', optionId: 'x' })).toEqual({
      instanceId: 'a-1',
      optionId: 'x',
    });
    expect(cardRequest({ instanceId: 'a-1' })).toEqual({ instanceId: 'a-1' });
    expect(cardRequest({ id: 'card:a-1', label: 'A' })).toEqual({ instanceId: 'a-1' });
    expect(cardRequest({ id: 'worker:farm' })).toEqual({});
    expect(cardRequest(undefined)).toEqual({});
    expect(cardRequest('a-1')).toEqual({});
    expect(cardRequest({ instanceId: 3, optionId: 'x' })).toEqual({});
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
