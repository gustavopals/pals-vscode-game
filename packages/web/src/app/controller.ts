import {
  ApiClientError,
  type Client,
  createClient,
  isGameRuleError,
  NetworkError,
  type TokenStore,
} from '@lotg/client-sdk';
import type {
  ApiErrorCode,
  Command,
  CommandType,
  GameEvent,
  ReturnReport,
  VersionResponse,
  ViewState,
} from '@lotg/protocol';

import { type AccountState, AccountService } from '../account/accountService';
import { shouldRemindToLink } from '../account/linkReminder';
import type { Connection } from '../game/connection';
import {
  clearAccountCaches,
  GameSession,
  OfflineError,
  type SessionTarget,
} from '../game/gameSession';
import type { BrowserNotifier } from '../notifications/browserNotifications';
import { decideNotifications, isEssential, MUTE_DURATION_MS } from '../notifications/policy';
import { loadPreferences, type Preferences, savePreferences } from '../services/preferences';
import { Emitter, type KeyValueStore } from '../services/store';
import type { TabChange } from '../services/tabSync';
import { documentTitle, type StatusBarInput } from '../ui/format';
import { APP_NAME, APP_VERSION } from '../version';
import { CLOSABLE_ROUTES, resolveRoute, type Route, visibleTabs } from './router';

const CHRONICLE_LINES = 20;
/** O lembrete do dia 3 é um por conta: outra conta no mesmo navegador recebe o seu. */
const reminderKey = (accountId: string) => `lords.linkReminder:${accountId}`;
/** No navegador o servidor é sempre a própria origem: uma chave só. */
const SERVER_KEY = 'self';

export type ErrorCode = ApiErrorCode | 'NETWORK';

/** Código e mensagem para o jogador a partir de qualquer falha. */
export function describeError(error: unknown): { code: ErrorCode; message: string } {
  if (error instanceof OfflineError || error instanceof NetworkError) {
    return {
      code: 'NETWORK',
      message:
        error instanceof OfflineError
          ? error.message
          : 'Sem ligação com o reino. O mundo continua andando; tente de novo em instantes.',
    };
  }
  if (error instanceof ApiClientError) {
    return { code: error.code, message: error.message };
  }
  return { code: 'INTERNAL', message: error instanceof Error ? error.message : String(error) };
}

/** UUID v4. `crypto.randomUUID` só existe em contexto seguro; `getRandomValues`, sempre. */
export function randomUUID(): string {
  if (typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type ToastAction = { label: string; run: () => void | Promise<void> };

/** Um aviso no canto inferior direito. */
export type Toast = {
  id: number;
  kind: 'info' | 'warning' | 'error';
  text: string;
  actions: ToastAction[];
  /** Avisos sem botões somem sozinhos; os com botões esperam o jogador. */
  sticky: boolean;
};

/** Um documento carregado sob demanda (Crônica, dados do servidor). */
export type Loadable<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; value: T }
  | { status: 'error'; message: string };

export type ControllerOptions = {
  /** Endereço do servidor, sem o `/v1`. No navegador é a própria origem (`''`). */
  baseUrl: string;
  store: KeyValueStore;
  tokenStore: TokenStore;
  fetch?: typeof fetch;
  /** Exclusão entre abas para a renovação da sessão (`services/sessionLock.ts`). */
  refreshLock?: <T>(task: () => Promise<T>) => Promise<T>;
  /** Atraso aleatório antes de renovar a sessão, para quando não há Web Locks. */
  refreshJitterMs?: number;
  validateResponses?: boolean;
  deviceLabel?: string;
  now?: () => number;
  randomUUID?: () => string;
  timezone?: () => string;
  notifier?: BrowserNotifier;
  /** `false` quando o navegador negou o armazenamento: nada sobrevive ao fechar a aba. */
  persistentStorage?: boolean;
  /** Escreve no console do navegador; nunca recebe tokens nem códigos. */
  log?: (message: string) => void;
};

/**
 * O estado do app em um lugar só: conta, partida aberta, abas, Crônica recente, novidades e
 * avisos. A bancada inteira lê daqui e é avisada por `onChange`. Não conhece o navegador: o
 * que vem dele (visibilidade, rede, outras abas) entra pelos métodos `set…` e `handle…`.
 */
export class Controller {
  readonly client: Client;
  readonly account: AccountService;
  readonly session: GameSession;

  preferences: Preferences;
  route: Route = 'welcome';
  /** Abas que o jogador abriu (Crônica, Preferências, Sobre). */
  opened: Route[] = [];
  chronicle: GameEvent[] = [];
  report: ReturnReport | null = null;
  /** Novidades ainda não vistas: destaques do Relatório de Retorno e avisos que viraram badge. */
  unseen = 0;
  busy = false;
  /** Instante em que a visão atual chegou: base da contagem regressiva local. */
  viewReceivedAt = 0;
  toasts: Toast[] = [];
  chronicleDocument: Loadable<string> = { status: 'idle' };
  server: Loadable<VersionResponse> = { status: 'idle' };
  /** A aba do navegador está à vista. */
  visible = true;
  /** Executa um comando da paleta pelo id. Ligado por `palette/commands.ts`. */
  runCommand: (id: string, ...args: unknown[]) => void = () => {};

  private notificationHistory: number[] = [];
  private previousAccount: AccountState = { kind: 'signedOut' };
  private subscriptions: Array<() => void> = [];
  private warnedUpgrade = false;
  private expectedSignOut = false;
  private queue: Promise<void> = Promise.resolve();
  private nextToastId = 1;

  private readonly changes = new Emitter<void>();
  /** Algo mudou: a bancada deve se redesenhar. */
  readonly onChange = this.changes.on;

  constructor(private readonly options: ControllerOptions) {
    this.preferences = loadPreferences(options.store);
    this.client = createClient({
      baseUrl: options.baseUrl,
      tokenStore: options.tokenStore,
      clientVersion: `web/${APP_VERSION}`,
      onUnauthenticated: () => this.account.handleUnauthenticated(),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(options.refreshLock ? { refreshLock: options.refreshLock } : {}),
      ...(options.refreshJitterMs ? { refreshJitterMs: options.refreshJitterMs } : {}),
      validateResponses: options.validateResponses ?? false,
    });
    this.account = new AccountService({
      client: this.client,
      store: options.store,
      serverKey: SERVER_KEY,
      deviceLabel: (options.deviceLabel ?? 'Navegador').slice(0, 64),
    });
    this.session = new GameSession({
      client: this.client,
      store: options.store,
      now: () => this.now(),
    });
    this.subscriptions = [
      this.account.onDidChange((state) => this.enqueue(() => this.accountChanged(state))),
      this.session.onView((view) => this.viewChanged(view)),
      this.session.onEvents((events) => this.eventsArrived(events)),
      this.session.onConnection((connection) => this.connectionChanged(connection)),
      this.session.onReturnReport((report) => this.reportArrived(report)),
      this.session.onProblem((error) => this.problemArrived(error)),
    ];
  }

  now(): number {
    return this.options.now?.() ?? Date.now();
  }

  private log(message: string): void {
    this.options.log?.(message);
  }

  /**
   * Mudanças de conta são tratadas uma de cada vez, na ordem em que aconteceram. "Jogar agora"
   * muda a conta duas vezes seguidas (conta criada, feudo fundado); sem a fila, o tratamento da
   * primeira poderia fechar a sessão que a segunda acabou de abrir.
   */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => {
      this.log(`Falha ao aplicar a mudança de conta: ${describeError(error).message}`);
    });
  }

  /** Espera as mudanças de conta pendentes terminarem de ser aplicadas. */
  settled(): Promise<void> {
    return this.queue;
  }

  /**
   * Ao abrir a página: retoma a conta guardada e, se houver partida, abre a sessão. `requested`
   * é a aba pedida pelo endereço (`#/feudo`); depois de uma ausência longa vale a aba Hoje.
   */
  async start(requested: Route | null = null): Promise<void> {
    this.previousAccount = this.account.restore();
    this.route = resolveRoute(requested ?? this.defaultRoute(), this.hasGame, this.defaultRoute());
    this.openIfClosable(this.route);
    if (this.options.persistentStorage === false) {
      this.toast({
        kind: 'warning',
        text: 'Este navegador não deixa o site guardar dados. Dá para jogar, mas ao fechar a aba a conta se perde, a menos que você gere um Código do Reino.',
        actions: [{ label: 'Entendi', run: () => {} }],
      });
    }
    this.changes.emit();
    void this.loadServerInfo();
    await this.openGame();
    if (this.report !== null) {
      this.route = 'today';
    }
    if (this.route === 'chronicle') {
      // Página recarregada em `#/cronica`: a aba precisa do texto, como em `navigate`.
      void this.loadChronicle();
    }
    this.changes.emit();
    // A partida guardada pode ter sido arquivada em outro navegador: confere com o servidor.
    void this.revalidateAccount();
  }

  /** Confere conta e partida ativa com o servidor. Sem rede, fica para a próxima vez. */
  private async revalidateAccount(): Promise<void> {
    if (this.account.state.kind === 'signedOut' || this.connection.kind !== 'online') {
      return;
    }
    try {
      await this.account.sync();
      await this.settled();
    } catch (error) {
      this.log(`Conta não conferida: ${describeError(error).message}`);
    }
  }

  dispose(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this.session.stop();
  }

  // --- O que vem do navegador ----------------------------------------------------

  /** A aba ficou à vista ou em segundo plano: a sessão ajusta a cadência do ciclo. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.session.setVisible(visible);
  }

  /** O navegador avisou que a rede voltou: sincroniza na hora, sem esperar o recuo. */
  handleOnline(): void {
    void this.session.syncNow();
    if (this.server.status === 'error') {
      void this.loadServerInfo();
    }
  }

  /** Outra aba mudou o armazenamento. */
  handleTabChange(change: TabChange): void {
    if (change.kind === 'preferences') {
      this.preferences = loadPreferences(this.options.store);
      this.changes.emit();
    } else if (change.kind === 'signedOut') {
      // Saiu, excluiu ou perdeu a sessão em outra aba: esta volta às boas-vindas junto. Sair
      // apaga duas chaves e gera dois eventos: só o primeiro encontra a conta aqui.
      if (this.account.state.kind !== 'signedOut') {
        this.expectedSignOut = true;
        void this.account.handleUnauthenticated();
      }
    } else {
      this.account.adoptStored();
    }
  }

  // --- Leitura do estado -------------------------------------------------------

  get view(): ViewState | null {
    return this.session.view;
  }

  get connection(): Connection {
    return this.session.connection;
  }

  get hasGame(): boolean {
    const state = this.account.state;
    return state.kind !== 'signedOut' && state.gameId !== null;
  }

  get tabs(): Route[] {
    return visibleTabs(this.hasGame, this.opened);
  }

  /** O servidor tem o vínculo com o GitHub ligado (há `GITHUB_CLIENT_ID`). */
  get githubAvailable(): boolean {
    // Um servidor de uma versão anterior não informa `features`: o vínculo fica desligado.
    return this.server.status === 'ready' && this.server.value.features?.githubDevice === true;
  }

  /** Aba em que o app abre quando ninguém pediu outra. */
  defaultRoute(): Route {
    if (!this.hasGame) {
      return 'welcome';
    }
    return this.report !== null ? 'today' : 'fief';
  }

  statusInput(elapsedSeconds: number): StatusBarInput {
    return {
      view: this.view,
      connection: this.connection,
      discreetMode: this.preferences.discreetMode,
      signedIn: this.account.state.kind !== 'signedOut',
      elapsedSeconds,
      pending: this.unseen,
    };
  }

  /** O título da aba do navegador. */
  title(elapsedSeconds: number): string {
    return documentTitle(this.statusInput(elapsedSeconds));
  }

  // --- Navegação -----------------------------------------------------------------

  private openIfClosable(route: Route): void {
    if (CLOSABLE_ROUTES.includes(route) && !this.opened.includes(route)) {
      this.opened = [...this.opened, route];
    }
  }

  /** Vai para uma aba. Ir ao feudo ou a Hoje conta como ter visto as novidades em badge. */
  navigate(requested: Route): void {
    const route = resolveRoute(requested, this.hasGame, this.defaultRoute());
    this.openIfClosable(route);
    this.route = route;
    if (route === 'today' || route === 'fief') {
      this.unseen = 0;
    }
    if (route === 'chronicle') {
      void this.loadChronicle();
    }
    if (route === 'about' && this.server.status !== 'ready') {
      void this.loadServerInfo();
    }
    this.changes.emit();
  }

  closeTab(route: Route): void {
    if (!this.opened.includes(route)) {
      return;
    }
    this.opened = this.opened.filter((entry) => entry !== route);
    if (this.route === route) {
      this.route = this.defaultRoute();
    }
    this.changes.emit();
  }

  // --- Reações -------------------------------------------------------------------

  private targetOf(state: AccountState): SessionTarget | null {
    return state.kind === 'signedOut' || state.gameId === null
      ? null
      : { serverKey: SERVER_KEY, accountId: state.accountId, gameId: state.gameId };
  }

  private async accountChanged(state: AccountState): Promise<void> {
    const before = this.previousAccount;
    this.previousAccount = state;
    const beforeTarget = this.targetOf(before);
    const target = this.targetOf(state);
    const sameGame =
      beforeTarget !== null &&
      target !== null &&
      beforeTarget.accountId === target.accountId &&
      beforeTarget.gameId === target.gameId;

    if (!sameGame) {
      const leftAccount =
        before.kind !== 'signedOut' &&
        (state.kind === 'signedOut' || state.accountId !== before.accountId);
      if (before.kind !== 'signedOut' && leftAccount) {
        // Saiu, foi excluída, perdeu a sessão ou trocou de conta: nada da conta anterior fica
        // neste navegador, nem das partidas arquivadas, para um erro de autenticação nunca
        // parecer só falta de rede.
        this.session.stop();
        await clearAccountCaches(this.options.store, SERVER_KEY, before.accountId);
        await this.options.store.update(reminderKey(before.accountId), undefined);
      } else if (beforeTarget !== null) {
        // Mesma conta, outra partida: a anterior foi arquivada e o cache dela não serve mais.
        await this.session.clearCache(beforeTarget);
      }
      this.chronicle = [];
      this.chronicleDocument = { status: 'idle' };
      this.report = null;
      this.unseen = 0;
      await this.openGame();
    }
    if (state.kind === 'signedOut') {
      this.opened = this.opened.filter((route) => route !== 'chronicle');
      this.route = 'welcome';
      if (before.kind !== 'signedOut' && !this.expectedSignOut) {
        this.toast({
          kind: 'warning',
          text: 'A sessão neste navegador terminou. Entre de novo com o GitHub ou com o Código do Reino.',
        });
      }
      this.expectedSignOut = false;
    } else if (state.gameId === null) {
      this.route = 'welcome';
    } else if (!sameGame) {
      // Entrou em um feudo (por GitHub, Código do Reino ou "Jogar agora"): sai das boas-vindas.
      this.route = this.defaultRoute();
    }
    this.changes.emit();
  }

  /** Abre a sessão da partida ativa da conta, se houver. */
  private async openGame(): Promise<void> {
    const target = this.targetOf(this.account.state);
    if (target === null) {
      this.session.stop();
      return;
    }
    this.session.setVisible(this.visible);
    await this.session.start(target);
    if (this.session.connection.kind === 'online') {
      try {
        const { entries } = await this.client.getChronicle(target.gameId, {
          limit: CHRONICLE_LINES,
        });
        // A resposta só vale se a partida aberta ainda for a mesma: nada da conta anterior
        // aparece na seguinte.
        if (this.session.gameId === target.gameId) {
          this.chronicle = entries;
        }
      } catch (error) {
        this.log(`Crônica indisponível: ${describeError(error).message}`);
      }
    }
    this.changes.emit();
  }

  private viewChanged(view: ViewState): void {
    this.viewReceivedAt = this.now();
    this.changes.emit();
    void this.maybeRemindToLink(view);
  }

  private eventsArrived(events: GameEvent[]): void {
    this.chronicle = [...this.chronicle, ...events]
      .filter((event, index, all) => all.findIndex((other) => other.seq === event.seq) === index)
      .slice(-CHRONICLE_LINES);
    if (this.chronicleDocument.status === 'ready') {
      // A Crônica aberta ficou para trás: a próxima visita à aba a lê de novo.
      this.chronicleDocument = { status: 'idle' };
      if (this.route === 'chronicle') {
        void this.loadChronicle();
      }
    }

    if (this.session.catchingUp) {
      // Eventos de uma ausência longa: quem os conta é o Relatório de Retorno, de uma vez só.
      this.changes.emit();
      return;
    }
    const decision = decideNotifications({
      events,
      level: this.preferences.notifications,
      discreetMode: this.preferences.discreetMode,
      mutedUntil: this.preferences.mutedUntil,
      now: this.now(),
      history: this.notificationHistory,
    });
    this.notificationHistory = decision.history;
    this.unseen += decision.badge;
    for (const event of decision.show) {
      this.notify(event);
    }
    this.changes.emit();
  }

  /** Um aviso que a política liberou: no canto da página e, se pedido, pelo navegador. */
  private notify(event: GameEvent): void {
    this.toast({
      kind: isEssential(event) ? 'warning' : 'info',
      text: event.text,
      actions: [
        { label: 'Ver', run: () => this.navigate('fief') },
        {
          label: 'Silenciar 2h',
          run: () => {
            this.muteNotifications();
          },
        },
      ],
    });
    if (!this.visible) {
      // Com a aba em segundo plano, o que avisa é o contador no título.
      this.unseen += 1;
      const notifier = this.options.notifier;
      if (this.preferences.browserNotifications && notifier?.granted()) {
        notifier.show(this.view?.settlement.name ?? APP_NAME, event.text);
      }
    }
  }

  private connectionChanged(connection: Connection): void {
    if (connection.kind === 'unauthenticated') {
      void this.account.handleUnauthenticated();
    }
    if (connection.kind === 'online' && this.server.status === 'error') {
      // A consulta de versão falhou na abertura: sem ela o vínculo GitHub ficaria escondido.
      void this.loadServerInfo();
    }
    // Os avisos de falta de rede ficam: é com a ligação de volta que o "Tentar de novo" deles
    // consegue reenviar a ordem.
    this.changes.emit();
  }

  private reportArrived(report: ReturnReport): void {
    this.report = report;
    this.unseen += report.highlights.length;
    // Depois de uma ausência longa, o app abre na aba Hoje.
    if (this.hasGame) {
      this.route = 'today';
    }
    this.changes.emit();
  }

  private problemArrived(error: unknown): void {
    const { code, message } = describeError(error);
    this.log(`O servidor recusou a leitura da partida: ${code} · ${message}`);
    if (code === 'UPGRADE_REQUIRED') {
      if (!this.warnedUpgrade) {
        this.warnedUpgrade = true;
        this.toast({
          kind: 'warning',
          text: 'O jogo foi atualizado no servidor. Recarregue a página para continuar.',
          actions: [{ label: 'Recarregar', run: () => this.runCommand('lords.reload') }],
        });
      }
      return;
    }
    // Partida arquivada ou inexistente: outro navegador começou um feudo novo. Confere a conta.
    void this.revalidateAccount();
  }

  private async maybeRemindToLink(view: ViewState): Promise<void> {
    const { store } = this.options;
    const account = this.account.state;
    if (account.kind === 'signedOut') {
      return;
    }
    const key = reminderKey(account.accountId);
    const handled = store.get<boolean>(key) ?? false;
    if (!shouldRemindToLink(view, this.account.state, handled) || this.preferences.discreetMode) {
      return;
    }
    await store.update(key, true);
    const actions: ToastAction[] = [];
    if (this.githubAvailable) {
      actions.push({ label: 'Vincular ao GitHub', run: () => this.runCommand('lords.linkGithub') });
    }
    actions.push(
      { label: 'Gerar Código do Reino', run: () => this.runCommand('lords.generateRecoveryCode') },
      { label: 'Não lembrar mais', run: () => {} },
    );
    this.toast({
      kind: 'info',
      text: 'Proteja seu reino: esta conta só existe neste navegador, e limpar os dados de navegação apaga o acesso a ela. Vincule-a para continuar de outro lugar.',
      actions,
    });
  }

  // --- Avisos --------------------------------------------------------------------

  /** Mostra um aviso no canto. Um aviso igual a um que já está à vista o substitui. */
  toast(input: { kind: Toast['kind']; text: string; actions?: ToastAction[] }): number {
    const id = this.nextToastId;
    this.nextToastId += 1;
    const actions = input.actions ?? [];
    this.toasts = [
      ...this.toasts.filter((toast) => toast.text !== input.text),
      { id, kind: input.kind, text: input.text, actions, sticky: actions.length > 0 },
    ].slice(-4);
    this.changes.emit();
    return id;
  }

  dismissToast(id: number): void {
    if (this.toasts.some((toast) => toast.id === id)) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id);
      this.changes.emit();
    }
  }

  /**
   * Roda uma ação do jogador e mostra o que deu errado: a recusa do motor é um aviso, com a
   * frase que veio do servidor; falta de rede é um erro com "Tentar de novo", que repete a
   * mesma ação (a mesma ordem, com o mesmo `commandId`).
   */
  async attempt(action: () => Promise<void>): Promise<boolean> {
    try {
      await action();
      return true;
    } catch (error) {
      const { code, message } = describeError(error);
      if (isGameRuleError(error)) {
        this.toast({ kind: 'warning', text: message });
      } else if (code === 'NETWORK') {
        this.toast({
          kind: 'error',
          text: message,
          actions: [{ label: 'Tentar de novo', run: () => this.attempt(action).then(() => {}) }],
        });
      } else {
        this.toast({ kind: 'error', text: message });
      }
      return false;
    }
  }

  // --- Ações ---------------------------------------------------------------------

  /** Roda uma operação de conta marcando a interface como ocupada. */
  async whileBusy<T>(operation: () => Promise<T>): Promise<T> {
    this.busy = true;
    this.changes.emit();
    try {
      const result = await operation();
      // Só termina quando a sessão da conta nova estiver aberta.
      await this.settled();
      return result;
    } finally {
      this.busy = false;
      this.changes.emit();
    }
  }

  private timezone(): string {
    return this.options.timezone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  /** O fuso deste navegador e a Hora da Vigília das preferências, para fundar um feudo. */
  gameDefaults(): { timezone: string; vigilHourLocal: number } {
    return { timezone: this.timezone(), vigilHourLocal: this.preferences.vigilHour };
  }

  /** "Jogar agora". */
  playNow(displayName: string, settlementName: string): Promise<unknown> {
    return this.whileBusy(() =>
      this.account.playNow({ displayName, settlementName, ...this.gameDefaults() }),
    );
  }

  /** Sair e excluir são pedidos do jogador: não merecem o aviso de "sessão terminou". */
  signOut(): Promise<void> {
    this.expectedSignOut = true;
    return this.whileBusy(async () => {
      try {
        await this.account.signOut();
      } catch (error) {
        // Sem rede o servidor não foi avisado, mas as credenciais daqui já sumiram: para o
        // jogador, a saída aconteceu. Não há o que tentar de novo.
        if (!(error instanceof NetworkError)) {
          throw error;
        }
      }
    });
  }

  async deleteAccount(): Promise<void> {
    this.expectedSignOut = true;
    try {
      await this.whileBusy(() => this.account.deleteAccount());
    } catch (error) {
      // A conta continua aqui: uma perda de sessão depois disto volta a merecer aviso.
      this.expectedSignOut = false;
      throw error;
    }
  }

  /**
   * Prepara uma ordem ao feudo e devolve a função que a envia. O `commandId` nasce aqui, uma vez:
   * chamar a função de novo ("Tentar de novo" depois de uma falha de rede) reenvia a mesma
   * ordem, e o servidor responde com o recibo se ela já tinha chegado. Uma intenção nova do
   * jogador pede outra chamada a `prepare`.
   */
  prepare<T extends CommandType>(
    type: T,
    payload: Extract<Command, { type: T }>['payload'],
  ): () => Promise<void> {
    const commandId = (this.options.randomUUID ?? randomUUID)();
    const command = { commandId, type, payload } as Command;
    return () => this.send(command);
  }

  async send(command: Command): Promise<void> {
    if (this.session.gameId === null) {
      throw new OfflineError();
    }
    await this.session.send(command);
  }

  /** Uma ordem nova do jogador, com os avisos de `attempt`. */
  order<T extends CommandType>(
    type: T,
    payload: Extract<Command, { type: T }>['payload'],
  ): Promise<boolean> {
    // O TypeScript não relaciona `T` entre duas funções genéricas; os tipos são os mesmos.
    return this.attempt(this.prepare(type, payload as never));
  }

  /** O jogador leu o Relatório de Retorno. */
  markSeen(): void {
    if (this.unseen !== 0 || this.report !== null) {
      this.unseen = 0;
      this.report = null;
      this.changes.emit();
    }
  }

  async setPreferences(patch: Partial<Preferences>): Promise<void> {
    this.preferences = { ...this.preferences, ...patch };
    if (this.preferences.discreetMode) {
      // No modo discreto nenhum aviso aparece, nem os que já estavam à vista.
      this.toasts = this.toasts.filter((toast) => toast.kind === 'error');
    }
    this.changes.emit();
    await savePreferences(this.options.store, this.preferences);
  }

  /**
   * Liga ou desliga as notificações do navegador. A permissão só é pedida aqui, quando o
   * jogador liga a opção; se ele a negar, a opção continua desligada.
   */
  async setBrowserNotifications(enabled: boolean): Promise<boolean> {
    const notifier = this.options.notifier;
    if (!enabled) {
      await this.setPreferences({ browserNotifications: false });
      return true;
    }
    const granted = notifier !== undefined && notifier.supported && (await notifier.request());
    await this.setPreferences({ browserNotifications: granted });
    if (!granted) {
      this.toast({
        kind: 'warning',
        text:
          notifier?.supported === true
            ? 'O navegador não deu permissão para notificações. Os avisos continuam aparecendo aqui na página.'
            : 'Este navegador não tem notificações. Os avisos continuam aparecendo aqui na página.',
      });
    }
    return granted;
  }

  muteNotifications(): Promise<void> {
    // Os avisos do jogo à vista somem junto: foi isso que o jogador pediu.
    this.toasts = this.toasts.filter((toast) => !toast.actions.some((a) => a.label === 'Ver'));
    return this.setPreferences({ mutedUntil: this.now() + MUTE_DURATION_MS });
  }

  /** Lê a Crônica inteira em Markdown, para a aba Crônica e para o download. */
  async loadChronicle(): Promise<string | null> {
    const gameId = this.session.gameId;
    if (gameId === null) {
      this.chronicleDocument = { status: 'idle' };
      return null;
    }
    if (this.chronicleDocument.status !== 'ready') {
      this.chronicleDocument = { status: 'loading' };
      this.changes.emit();
    }
    try {
      const markdown = await this.client.getChronicleMarkdown(gameId);
      if (this.session.gameId !== gameId) {
        // O jogador saiu ou trocou de feudo enquanto a Crônica vinha: ela não é mais a dele.
        return null;
      }
      this.chronicleDocument = { status: 'ready', value: markdown };
      this.changes.emit();
      return markdown;
    } catch (error) {
      if (this.session.gameId !== gameId) {
        return null;
      }
      this.chronicleDocument = { status: 'error', message: describeError(error).message };
      this.changes.emit();
      return null;
    }
  }

  /** Versão do servidor e o que ele tem ligado (`GET /version`). */
  async loadServerInfo(): Promise<void> {
    if (this.server.status === 'loading') {
      return;
    }
    if (this.server.status !== 'ready') {
      this.server = { status: 'loading' };
      this.changes.emit();
    }
    try {
      this.server = { status: 'ready', value: await this.client.version() };
    } catch (error) {
      this.server = { status: 'error', message: describeError(error).message };
    }
    this.changes.emit();
  }
}
