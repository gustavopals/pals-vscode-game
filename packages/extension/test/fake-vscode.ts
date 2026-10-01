// Um VS Code de mentira, com o mínimo da API que a extensão usa. Permite ativar a extensão
// inteira em um teste, roteirizar as respostas do jogador e observar o que ela mostrou.

type Listener<T> = (value: T) => unknown;

export class EventEmitter<T> {
  private listeners = new Set<Listener<T>>();
  event = (listener: Listener<T>) => {
    this.listeners.add(listener);
    return { dispose: () => this.listeners.delete(listener) };
  };
  fire(value: T): void {
    for (const listener of [...this.listeners]) {
      listener(value);
    }
  }
  dispose(): void {
    this.listeners.clear();
  }
}

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}
export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}
export enum ViewColumn {
  Active = -1,
}
export enum ConfigurationTarget {
  Global = 1,
}
export enum ExtensionMode {
  Production = 1,
  Development = 2,
  Test = 3,
}
export enum InputBoxValidationSeverity {
  Info = 1,
  Warning = 2,
  Error = 3,
}

export class ThemeIcon {
  constructor(readonly id: string) {}
}

export class TreeItem {
  id?: string;
  description?: string;
  tooltip?: string;
  iconPath?: unknown;
  contextValue?: string;
  command?: { command: string; title: string; arguments?: unknown[] };
  constructor(
    readonly label: string,
    readonly collapsibleState: TreeItemCollapsibleState = TreeItemCollapsibleState.None,
  ) {}
}

export const Uri = {
  joinPath: (base: { path: string }, ...parts: string[]) => ({
    path: [base.path, ...parts].join('/'),
    toString: () => [base.path, ...parts].join('/'),
  }),
};

type Message = {
  kind: 'info' | 'warning' | 'error';
  text: string;
  detail?: string | undefined;
  modal: boolean;
  buttons: string[];
};

export type FakePanel = {
  title: string;
  visible: boolean;
  disposed: boolean;
  /** Mensagens que a extensão mandou para a Webview. */
  posted: Array<Record<string, unknown>>;
  /** Simula uma mensagem vinda da Webview e espera a extensão terminar de tratá-la. */
  receive: (message: unknown) => Promise<void>;
  hide: () => void;
  webview: { html: string };
};

type TreeProvider = {
  getChildren: (node?: unknown) => unknown[];
  getTreeItem: (node: unknown) => TreeItem;
};

/** Estado observável do editor de mentira. `reset()` simula uma máquina nova. */
export const state = {
  config: {} as Record<string, unknown>,
  contexts: {} as Record<string, unknown>,
  commands: new Map<string, (...args: unknown[]) => unknown>(),
  messages: [] as Message[],
  /** Respostas roteirizadas: o próximo QuickPick, InputBox ou mensagem consome a primeira. */
  answers: [] as unknown[],
  inputBoxes: [] as Array<{ title?: string; prompt?: string; validation: unknown }>,
  quickPicks: [] as Array<{ title?: string; labels: string[] }>,
  panels: [] as FakePanel[],
  statusBar: { text: '', tooltip: '', command: '' as string | undefined, shown: false },
  tree: null as null | {
    provider: TreeProvider;
    view: { badge: unknown; title: string | undefined };
  },
  documents: [] as Array<{ language?: string; content?: string }>,
  clipboard: '',
  githubToken: 'gho_teste',
  output: [] as string[],
  configListeners: new Set<Listener<{ affectsConfiguration: (section: string) => boolean }>>(),
};

export function reset(): void {
  state.config = {};
  state.contexts = {};
  state.commands.clear();
  state.messages = [];
  state.answers = [];
  state.inputBoxes = [];
  state.quickPicks = [];
  state.panels = [];
  state.statusBar = { text: '', tooltip: '', command: undefined, shown: false };
  state.tree = null;
  state.documents = [];
  state.clipboard = '';
  state.output = [];
  state.configListeners.clear();
}

/** Contexto de extensão novo: `globalState` e `secrets` vazios, como em uma máquina limpa. */
export function createContext() {
  const globals = new Map<string, unknown>();
  const secrets = new Map<string, string>();
  return {
    subscriptions: [] as Array<{ dispose: () => unknown }>,
    extensionUri: { path: '/extensao' },
    extensionMode: 1,
    globalState: {
      data: globals,
      keys: () => [...globals.keys()],
      get: <T>(key: string, fallback?: T) =>
        globals.has(key) ? (globals.get(key) as T) : fallback,
      update: async (key: string, value: unknown) => {
        if (value === undefined) {
          globals.delete(key);
        } else {
          globals.set(key, JSON.parse(JSON.stringify(value)));
        }
      },
    },
    secrets: {
      data: secrets,
      get: async (key: string) => secrets.get(key),
      store: async (key: string, value: string) => {
        secrets.set(key, value);
      },
      delete: async (key: string) => {
        secrets.delete(key);
      },
    },
  };
}

function showMessage(kind: Message['kind']) {
  return async (text: string, ...rest: unknown[]) => {
    const options =
      typeof rest[0] === 'object' && rest[0] !== null
        ? (rest.shift() as { modal?: boolean; detail?: string })
        : {};
    const buttons = rest as string[];
    state.messages.push({
      kind,
      text,
      detail: options.detail,
      modal: options.modal === true,
      buttons,
    });
    // Só mensagens com botões consomem uma resposta roteirizada.
    if (buttons.length === 0) {
      return undefined;
    }
    const answer = state.answers.shift();
    return typeof answer === 'string' && buttons.includes(answer) ? answer : undefined;
  };
}

export const window = {
  createOutputChannel: (name: string) => ({
    name,
    appendLine: (line: string) => state.output.push(line),
    dispose: () => undefined,
  }),
  createTreeView: (_id: string, options: { treeDataProvider: TreeProvider }) => {
    const view = {
      badge: undefined as unknown,
      title: undefined as string | undefined,
      dispose: () => undefined,
    };
    state.tree = { provider: options.treeDataProvider, view };
    return view;
  },
  createStatusBarItem: () => {
    const item = {
      name: '',
      command: undefined as string | undefined,
      show: () => {
        state.statusBar.shown = true;
      },
      dispose: () => undefined,
      set text(value: string) {
        state.statusBar.text = value;
      },
      get text() {
        return state.statusBar.text;
      },
      set tooltip(value: string) {
        state.statusBar.tooltip = value;
      },
      get tooltip() {
        return state.statusBar.tooltip;
      },
    };
    return item;
  },
  createWebviewPanel: (_type: string, title: string) => {
    const received = new EventEmitter<unknown>();
    const viewState = new EventEmitter<void>();
    const disposed = new EventEmitter<void>();
    let pending: Promise<unknown> = Promise.resolve();
    const fake: FakePanel = {
      title,
      visible: true,
      disposed: false,
      posted: [],
      webview: { html: '' },
      receive: async (message) => {
        received.fire(message);
        // A extensão trata a mensagem de forma assíncrona: dá tempo de ela terminar.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await pending;
        await settle();
      },
      hide: () => {
        fake.visible = false;
        viewState.fire();
      },
    };
    state.panels.push(fake);
    return {
      get visible() {
        return fake.visible;
      },
      iconPath: undefined as unknown,
      webview: {
        cspSource: 'vscode-resource:',
        get html() {
          return fake.webview.html;
        },
        set html(value: string) {
          fake.webview.html = value;
        },
        asWebviewUri: (uri: { toString: () => string }) => ({
          toString: () => `vscode-resource:${uri.toString()}`,
        }),
        postMessage: async (message: Record<string, unknown>) => {
          fake.posted.push(JSON.parse(JSON.stringify(message)));
          return true;
        },
        onDidReceiveMessage: (listener: Listener<unknown>) =>
          received.event((message) => {
            pending = Promise.resolve(listener(message));
          }),
      },
      reveal: () => {
        fake.visible = true;
        viewState.fire();
      },
      onDidChangeViewState: viewState.event,
      onDidDispose: disposed.event,
      dispose: () => {
        fake.disposed = true;
        disposed.fire();
      },
    };
  },
  showInformationMessage: showMessage('info'),
  showWarningMessage: showMessage('warning'),
  showErrorMessage: showMessage('error'),
  showQuickPick: async (items: Array<{ label: string }>, options: { title?: string } = {}) => {
    state.quickPicks.push({
      ...(options.title ? { title: options.title } : {}),
      labels: items.map((item) => item.label),
    });
    const answer = state.answers.shift();
    if (answer === undefined) {
      return undefined;
    }
    // A resposta roteirizada é um trecho do rótulo do item a escolher.
    return items.find((item) => item.label.includes(String(answer)));
  },
  showInputBox: async (
    options: {
      title?: string;
      prompt?: string;
      validateInput?: (value: string) => unknown;
    } = {},
  ) => {
    const answer = state.answers.shift();
    const validation = answer === undefined ? undefined : options.validateInput?.(String(answer));
    state.inputBoxes.push({
      ...(options.title ? { title: options.title } : {}),
      ...(options.prompt ? { prompt: options.prompt } : {}),
      validation,
    });
    // Um texto de validação é erro: o VS Code não deixa confirmar. Um objeto com severidade
    // informativa não impede.
    if (answer === undefined || typeof validation === 'string') {
      return undefined;
    }
    return String(answer);
  },
  setStatusBarMessage: () => ({ dispose: () => undefined }),
  showTextDocument: async (document: unknown) => document,
};

export const commands = {
  registerCommand: (id: string, handler: (...args: unknown[]) => unknown) => {
    state.commands.set(id, handler);
    return { dispose: () => state.commands.delete(id) };
  },
  executeCommand: async (id: string, ...args: unknown[]) => {
    if (id === 'setContext') {
      state.contexts[String(args[0])] = args[1];
      return undefined;
    }
    const handler = state.commands.get(id);
    return handler === undefined ? undefined : handler(...args);
  },
};

export const workspace = {
  getConfiguration: (section: string) => ({
    get: <T>(key: string, fallback: T): T =>
      (`${section}.${key}` in state.config ? state.config[`${section}.${key}`] : fallback) as T,
    update: async (key: string, value: unknown) => {
      state.config[`${section}.${key}`] = value;
      for (const listener of state.configListeners) {
        listener({ affectsConfiguration: (name) => name === section });
      }
    },
  }),
  onDidChangeConfiguration: (
    listener: Listener<{ affectsConfiguration: (section: string) => boolean }>,
  ) => {
    state.configListeners.add(listener);
    return { dispose: () => state.configListeners.delete(listener) };
  },
  openTextDocument: async (options: { language?: string; content?: string }) => {
    state.documents.push(options);
    return options;
  },
};

export const env = {
  appName: 'VS Code de teste',
  clipboard: {
    writeText: async (text: string) => {
      state.clipboard = text;
    },
  },
};

export const authentication = {
  getSession: async () => ({ accessToken: state.githubToken }),
};

/** Espera as tarefas assíncronas pendentes da extensão terminarem. */
export async function settle(): Promise<void> {
  for (let round = 0; round < 5; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

/** A árvore como o jogador a vê: rótulo, descrição e filhos. */
export type SeenNode = {
  label: string;
  description?: string | undefined;
  contextValue?: string | undefined;
  command?: string | undefined;
  node: unknown;
  children: SeenNode[];
};

export function seeTree(): SeenNode[] {
  const tree = state.tree;
  if (tree === null) {
    return [];
  }
  const walk = (node?: unknown): SeenNode[] =>
    tree.provider.getChildren(node).map((child) => {
      const item = tree.provider.getTreeItem(child);
      return {
        label: item.label,
        description: item.description,
        contextValue: item.contextValue,
        command: item.command?.command,
        node: child,
        children: walk(child),
      };
    });
  return walk();
}

export function findNode(nodes: SeenNode[], label: string): SeenNode | undefined {
  for (const node of nodes) {
    if (node.label.includes(label)) {
      return node;
    }
    const inner = findNode(node.children, label);
    if (inner) {
      return inner;
    }
  }
  return undefined;
}
