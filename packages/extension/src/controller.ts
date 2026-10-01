import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

import { ApiClientError, type Client, createClient, NetworkError } from '@lotg/client-sdk';
import type {
  Command,
  CommandType,
  ExtensionToWebview,
  GameEvent,
  ReturnReport,
  ViewState,
  WebviewRoute,
  WebviewSession,
} from '@lotg/protocol';
import * as vscode from 'vscode';

import { type AccountState, AccountService } from './account/accountService';
import { shouldRemindToLink } from './account/linkReminder';
import type { Connection } from './game/connection';
import {
  clearAccountCaches,
  GameSession,
  OfflineError,
  type SessionTarget,
} from './game/gameSession';
import {
  decideNotifications,
  MUTE_DURATION_MS,
  type NotificationLevel,
} from './notifications/policy';
import { Emitter } from './services/store';
import { secretTokenStore } from './services/tokenStore';

export const EXTENSION_VERSION = '0.1.0';
const CHRONICLE_LINES = 20;
const REMINDER_KEY = 'lords.linkReminder';

export type Settings = {
  serverUrl: string;
  notifications: NotificationLevel;
  discreetMode: boolean;
  vigilHour: number;
};

export function readSettings(): Settings {
  const config = vscode.workspace.getConfiguration('lords');
  return {
    serverUrl: config.get<string>('serverUrl', 'http://localhost:3000').replace(/\/+$/, ''),
    notifications: config.get<NotificationLevel>('notifications', 'essential'),
    discreetMode: config.get<boolean>('discreetMode', false),
    vigilHour: config.get<number>('vigilHour', 20),
  };
}

type PanelErrorCode = Extract<ExtensionToWebview, { type: 'error' }>['code'];

/** Código e mensagem para o jogador a partir de qualquer falha. */
export function describeError(error: unknown): { code: PanelErrorCode; message: string } {
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

/**
 * O estado da extensão em um lugar só: conta, partida aberta, Crônica recente e novidades.
 * A árvore, a barra de status, o painel e os comandos leem daqui e são avisados por `onChange`.
 */
export class Controller implements vscode.Disposable {
  settings: Settings;
  client!: Client;
  account!: AccountService;
  session!: GameSession;

  chronicle: GameEvent[] = [];
  report: ReturnReport | null = null;
  /** Novidades ainda não vistas: destaques do Relatório de Retorno e notificações em badge. */
  unseen = 0;
  busy = false;
  /** Instante em que a visão atual chegou: base da contagem regressiva local. */
  viewReceivedAt = Date.now();

  private mutedUntil: number | null = null;
  private notificationHistory: number[] = [];
  private previousAccount: AccountState = { kind: 'signedOut' };
  private subscriptions: Array<() => void> = [];
  private panelVisible = false;
  private warnedUpgrade = false;
  private queue: Promise<void> = Promise.resolve();

  private readonly changes = new Emitter<void>();
  private readonly notifications = new Emitter<GameEvent[]>();
  private readonly panelMessages = new Emitter<ExtensionToWebview>();
  /** Algo mudou: árvore e barra de status devem se redesenhar. */
  readonly onChange = this.changes.on;
  /** Eventos que a política decidiu notificar agora. */
  readonly onNotify = this.notifications.on;
  /** Mensagens para o painel, se ele estiver aberto. */
  readonly onPanelMessage = this.panelMessages.on;

  constructor(
    private readonly context: vscode.ExtensionContext,
    readonly output: vscode.OutputChannel,
  ) {
    this.settings = readSettings();
    this.build();
  }

  /** Monta cliente, conta e sessão para o servidor configurado. */
  private build(): void {
    const { serverUrl } = this.settings;
    const tokenStore = secretTokenStore(this.context.secrets, serverUrl);
    this.client = createClient({
      baseUrl: serverUrl,
      tokenStore,
      clientVersion: `vscode/${EXTENSION_VERSION}`,
      onUnauthenticated: () => this.account.handleUnauthenticated(),
      // Em desenvolvimento, toda resposta é conferida contra o protocolo.
      validateResponses: this.context.extensionMode === vscode.ExtensionMode.Development,
      // Várias janelas do VS Code dividem o SecretStorage: a espera dá tempo de uma renovar a
      // sessão e a outra encontrar os tokens novos.
      refreshJitterMs: 250,
    });
    this.account = new AccountService({
      client: this.client,
      store: this.context.globalState,
      serverKey: serverUrl,
      deviceLabel: `${vscode.env.appName} em ${hostname()}`.slice(0, 64),
    });
    this.session = new GameSession({ client: this.client, store: this.context.globalState });
    this.session.setVisible(this.panelVisible);

    this.subscriptions = [
      this.account.onDidChange((state) => this.enqueue(() => this.accountChanged(state))),
      this.session.onView((view) => this.viewChanged(view)),
      this.session.onEvents((events) => this.eventsArrived(events)),
      this.session.onConnection((connection) => this.connectionChanged(connection)),
      this.session.onReturnReport((report) => this.reportArrived(report)),
      this.session.onProblem((error) => this.problemArrived(error)),
    ];
  }

  /**
   * Mudanças de conta são tratadas uma de cada vez, na ordem em que aconteceram. "Jogar agora"
   * muda a conta duas vezes seguidas (conta criada, feudo fundado); sem a fila, o tratamento da
   * primeira poderia fechar a sessão que a segunda acabou de abrir.
   */
  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => {
      this.output.appendLine(
        `Falha ao aplicar a mudança de conta: ${describeError(error).message}`,
      );
    });
  }

  /** Espera as mudanças de conta pendentes terminarem de ser aplicadas. */
  settled(): Promise<void> {
    return this.queue;
  }

  /** Na ativação: retoma a conta guardada e, se houver partida, abre a sessão. */
  async start(): Promise<void> {
    this.previousAccount = this.account.restore();
    await this.applySignedInContext();
    this.changes.emit();
    await this.openGame();
    // A partida guardada pode ter sido arquivada em outra máquina: confere com o servidor.
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
      this.output.appendLine(`Conta não conferida: ${describeError(error).message}`);
    }
  }

  /** O painel ficou visível ou oculto: a sessão ajusta a cadência do ciclo. */
  setPanelVisible(visible: boolean): void {
    this.panelVisible = visible;
    this.session.setVisible(visible);
  }

  /** As configurações mudaram. Se foi `lords.serverUrl`, recomeça do zero com o outro servidor. */
  reconfigure(): Promise<void> {
    // Na fila: a tela de configurações dispara uma mudança a cada tecla digitada.
    this.enqueue(() => this.applySettings());
    return this.settled();
  }

  private async applySettings(): Promise<void> {
    const next = readSettings();
    const serverChanged = next.serverUrl !== this.settings.serverUrl;
    this.settings = next;
    if (serverChanged) {
      this.teardown();
      this.chronicle = [];
      this.report = null;
      this.unseen = 0;
      this.build();
      this.previousAccount = this.account.restore();
      await this.applySignedInContext();
      await this.openGame();
      this.postSession();
      this.panelMessages.emit({ type: 'navigate', route: this.defaultRoute() });
    }
    this.changes.emit();
  }

  private teardown(): void {
    for (const unsubscribe of this.subscriptions) {
      unsubscribe();
    }
    this.subscriptions = [];
    this.session.stop();
  }

  dispose(): void {
    this.teardown();
  }

  // --- Leitura do estado -----------------------------------------------------

  get view(): ViewState | null {
    return this.session.view;
  }

  get connection(): Connection {
    return this.session.connection;
  }

  get elapsedSeconds(): number {
    return (Date.now() - this.viewReceivedAt) / 1000;
  }

  /** Rota em que o painel deve abrir quando ninguém pediu outra. */
  defaultRoute(): WebviewRoute {
    const state = this.account.state;
    if (state.kind === 'signedOut' || state.gameId === null) {
      return 'welcome';
    }
    return this.report !== null ? 'today' : 'fief';
  }

  sessionInfo(): WebviewSession {
    const state = this.account.state;
    return {
      account:
        state.kind === 'signedOut' ? null : { displayName: state.displayName, kind: state.kind },
      hasGame: state.kind !== 'signedOut' && state.gameId !== null,
      defaults: {
        displayName: state.kind === 'signedOut' ? '' : state.displayName,
        settlementName: 'Pedra Alta',
      },
      busy: this.busy,
    };
  }

  /** Tudo que o painel precisa ao abrir, na ordem em que deve aplicar. */
  snapshot(route: WebviewRoute): ExtensionToWebview[] {
    const messages: ExtensionToWebview[] = [
      { type: 'session', session: this.sessionInfo() },
      this.connectionMessage(),
      { type: 'chronicle', entries: this.chronicle },
      { type: 'report', report: this.report },
    ];
    if (this.view !== null) {
      messages.push({ type: 'view', view: this.view });
    }
    messages.push({ type: 'navigate', route });
    return messages;
  }

  private connectionMessage(): ExtensionToWebview {
    const connection = this.connection;
    return connection.kind === 'offline'
      ? {
          type: 'connection',
          online: false,
          retryInSeconds: Math.ceil(connection.retryInMs / 1000),
        }
      : { type: 'connection', online: true };
  }

  private postSession(): void {
    this.panelMessages.emit({ type: 'session', session: this.sessionInfo() });
  }

  // --- Reações ---------------------------------------------------------------

  private async applySignedInContext(): Promise<void> {
    await vscode.commands.executeCommand(
      'setContext',
      'lords.signedIn',
      this.account.state.kind !== 'signedOut',
    );
  }

  private targetOf(state: AccountState): SessionTarget | null {
    return state.kind === 'signedOut' || state.gameId === null
      ? null
      : { serverKey: this.settings.serverUrl, accountId: state.accountId, gameId: state.gameId };
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

    await this.applySignedInContext();
    if (!sameGame) {
      const leftAccount =
        before.kind !== 'signedOut' &&
        (state.kind === 'signedOut' || state.accountId !== before.accountId);
      if (before.kind !== 'signedOut' && leftAccount) {
        // Saiu, foi excluída, perdeu a sessão ou trocou de conta: nada da conta anterior fica
        // nesta máquina, nem das partidas arquivadas, para um erro de autenticação nunca
        // parecer só falta de rede.
        this.session.stop();
        await clearAccountCaches(
          this.context.globalState,
          this.settings.serverUrl,
          before.accountId,
        );
      } else if (beforeTarget !== null) {
        // Mesma conta, outra partida: a anterior foi arquivada e o cache dela não serve mais.
        await this.session.clearCache(beforeTarget);
      }
      this.chronicle = [];
      this.report = null;
      this.unseen = 0;
      await this.openGame();
    }
    this.postSession();
    if (state.kind === 'signedOut' || state.gameId === null) {
      this.panelMessages.emit({ type: 'navigate', route: 'welcome' });
    } else if (!sameGame) {
      // Entrou em um feudo (por GitHub, Código do Reino ou "Jogar agora"): o painel sai das
      // boas-vindas.
      this.panelMessages.emit({ type: 'navigate', route: this.defaultRoute() });
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
    await this.session.start(target);
    if (this.session.connection.kind === 'online') {
      try {
        this.chronicle = (
          await this.client.getChronicle(target.gameId, { limit: CHRONICLE_LINES })
        ).entries;
        this.panelMessages.emit({ type: 'chronicle', entries: this.chronicle });
      } catch (error) {
        this.output.appendLine(`Crônica indisponível: ${describeError(error).message}`);
      }
    }
    this.changes.emit();
  }

  private viewChanged(view: ViewState): void {
    this.viewReceivedAt = Date.now();
    this.panelMessages.emit({ type: 'view', view });
    this.changes.emit();
    void this.maybeRemindToLink(view);
  }

  private eventsArrived(events: GameEvent[]): void {
    this.chronicle = [...this.chronicle, ...events]
      .filter((event, index, all) => all.findIndex((other) => other.seq === event.seq) === index)
      .slice(-CHRONICLE_LINES);
    this.panelMessages.emit({ type: 'chronicle', entries: this.chronicle });

    if (this.session.catchingUp) {
      // Eventos de uma ausência longa: quem os conta é o Relatório de Retorno, de uma vez só.
      this.changes.emit();
      return;
    }
    const decision = decideNotifications({
      events,
      level: this.settings.notifications,
      discreetMode: this.settings.discreetMode,
      mutedUntil: this.mutedUntil,
      now: Date.now(),
      history: this.notificationHistory,
    });
    this.notificationHistory = decision.history;
    this.unseen += decision.badge;
    if (decision.show.length > 0) {
      this.notifications.emit(decision.show);
    }
    this.changes.emit();
  }

  private connectionChanged(connection: Connection): void {
    this.panelMessages.emit(this.connectionMessage());
    if (connection.kind === 'unauthenticated') {
      void this.account.handleUnauthenticated();
    }
    this.changes.emit();
  }

  private reportArrived(report: ReturnReport): void {
    this.report = report;
    this.unseen += report.highlights.length;
    this.panelMessages.emit({ type: 'report', report });
    // O painel não se abre sozinho por cima do trabalho de ninguém: a árvore e a barra de status
    // mostram que há novidades. Se ele já está aberto, vai para a aba Hoje; ao ser aberto,
    // começa nela.
    this.panelMessages.emit({ type: 'navigate', route: 'today' });
    this.changes.emit();
  }

  private problemArrived(error: unknown): void {
    const { code, message } = describeError(error);
    this.output.appendLine(`O servidor recusou a leitura da partida: ${code} · ${message}`);
    if (code === 'UPGRADE_REQUIRED') {
      if (!this.warnedUpgrade) {
        this.warnedUpgrade = true;
        void vscode.window.showWarningMessage(message);
      }
      return;
    }
    // Partida arquivada ou inexistente: outra máquina começou um feudo novo. Confere a conta.
    void this.revalidateAccount();
  }

  private async maybeRemindToLink(view: ViewState): Promise<void> {
    const handled = this.context.globalState.get<boolean>(REMINDER_KEY, false);
    if (!shouldRemindToLink(view, this.account.state, handled) || this.settings.discreetMode) {
      return;
    }
    await this.context.globalState.update(REMINDER_KEY, true);
    const github = 'Vincular ao GitHub';
    const code = 'Gerar Código do Reino';
    const choice = await vscode.window.showInformationMessage(
      'Proteja seu reino: vincule a conta para continuar de outra máquina.',
      github,
      code,
      'Não lembrar mais',
    );
    if (choice === github) {
      await vscode.commands.executeCommand('lords.linkGithub');
    } else if (choice === code) {
      await vscode.commands.executeCommand('lords.generateRecoveryCode');
    }
  }

  // --- Ações -----------------------------------------------------------------

  /** Roda uma operação de conta marcando o painel como ocupado. */
  async whileBusy<T>(operation: () => Promise<T>): Promise<T> {
    this.busy = true;
    this.postSession();
    try {
      const result = await operation();
      // Só termina quando a sessão da conta nova estiver aberta.
      await this.settled();
      return result;
    } finally {
      this.busy = false;
      this.postSession();
    }
  }

  /** "Jogar agora", com o fuso desta máquina e a Hora da Vigília das configurações. */
  playNow(displayName: string, settlementName: string): Promise<unknown> {
    return this.whileBusy(() =>
      this.account.playNow({
        displayName,
        settlementName,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        vigilHourLocal: this.settings.vigilHour,
      }),
    );
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
    const command = { commandId: randomUUID(), type, payload } as Command;
    return () => this.send(command);
  }

  async send(command: Command): Promise<void> {
    if (this.session.gameId === null) {
      throw new OfflineError();
    }
    await this.session.send(command);
  }

  /** O jogador viu as novidades. */
  markSeen(): void {
    if (this.unseen !== 0 || this.report !== null) {
      this.unseen = 0;
      this.report = null;
      this.panelMessages.emit({ type: 'report', report: null });
      this.changes.emit();
    }
  }

  muteNotifications(): void {
    this.mutedUntil = Date.now() + MUTE_DURATION_MS;
  }
}
