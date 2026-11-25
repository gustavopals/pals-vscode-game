import {
  ApiClientError,
  type Client,
  createClient,
  isGameRuleError,
  NetworkError,
  type TokenStore,
} from '@lotg/client-sdk';
import {
  type ApiErrorCode,
  CatalogResponseSchema,
  type Command,
  type CommandType,
  type CurrentSeasonResponse,
  type GameEvent,
  type LeaderboardResponse,
  type ReturnReport,
  type SeasonChronicleResponse,
  type StatsResponse,
  type VersionResponse,
  type ViewState,
} from '@lotg/protocol';

import { type AccountState, AccountService } from '../account/accountService';
import { readReminderRecord, shouldRemindToLink } from '../account/linkReminder';
import { type Connection, pollIntervalMs } from '../game/connection';
import {
  clearAccountCaches,
  GameSession,
  isSessionLoss,
  OfflineError,
  type SessionTarget,
  StaleOrderError,
} from '../game/gameSession';
import { intentsOf } from '../game/intent';
import type { NewGameChoice, NewGameOptions } from '../game/newGame';
import { isChronicleEvent } from '../game/returnReport';
import type { BrowserNotifier } from '../notifications/browserNotifications';
import { latestPublishedNews } from '../news/entries';
import { NewsReadState } from '../news/readState';
import {
  arrearsAhead,
  ambushNotice,
  discontentNotice,
  lossNotice,
  isHeroDiscontent,
  wageAhead,
  decideNotice,
  decideNotifications,
  eventIcon,
  crossroadsNotice,
  isCaravanAmbush,
  isCrossroadsArrival,
  isDecision,
  isEssential,
  isExpeditionEnd,
  isRaidAlarm,
  isRaidOutcome,
  isSeasonTurn,
  isWatchReport,
  isGuildEvent,
  isMarketEvent,
  isArmyEvent,
  isSmithyEvent,
  isWallEvent,
  isMapEvent,
  isSiegeEvent,
  siegeNotice,
  MUTE_DURATION_MS,
  raidAftermath,
  raidAhead,
  SEASON_ICON,
  seasonAhead,
  seasonArrival,
} from '../notifications/policy';
import { emergencySignature, SIEGE_SECTION, waveDecision } from '../ui/siege';
import { loadPreferences, type Preferences, savePreferences } from '../services/preferences';
import { Emitter, type KeyValueStore } from '../services/store';
import type { TabChange } from '../services/tabSync';
import {
  cardNotice,
  COUNCIL_RECORD_LINES,
  type CouncilLog,
  EMPTY_COUNCIL_LOG,
  isCouncilEvent,
} from '../ui/council';
import { waitingExpeditions } from '../ui/expeditions';
import { cardDecisions, documentTitle, formatAway, type StatusBarInput } from '../ui/format';
import { isObjectiveCompleted, OBJECTIVES_SECTION, objectivesCompleted } from '../ui/objectives';
import { SMITHY_SECTION } from '../ui/smithy';
import { THREAT_SECTION } from '../ui/threat';
import { type VowId, vowsOf, vowsReviewSignature } from '../ui/vows';
import { APP_NAME, APP_VERSION } from '../version';
import { CLOSABLE_ROUTES, resolveRoute, type Route, visibleTabs } from './router';

/** As linhas da Crônica recente (painel do feudo e árvore). */
const CHRONICLE_LINES = 20;
/**
 * Quantas linhas do fim da Crônica a abertura lê. As 20 da Crônica recente saem delas, e o que o
 * conselho registrou é procurado nelas todas: uma carta espera 24 h na mesa, e nesse tempo a
 * Crônica escreve bem mais que 20 linhas.
 */
const CHRONICLE_LOOKBACK = 200;

/** Os eventos anuais preservados fora da janela de 20 linhas da Crônica recente (V5C-T4). */
const isYearRecordEvent = (event: GameEvent): boolean =>
  event.type === 'yearEnded' || event.type === 'vowsTaken';

/** Junta duas listas de eventos sem repetir nenhum, na ordem da Crônica. */
function mergeBySeq(...lists: GameEvent[][]): GameEvent[] {
  const bySeq = new Map<number, GameEvent>();
  for (const event of lists.flat()) {
    bySeq.set(event.seq, event);
  }
  return [...bySeq.values()].sort((a, b) => a.seq - b.seq);
}
/** O lembrete do dia 3 é um por conta: outra conta no mesmo navegador recebe o seu. */
const reminderKey = (accountId: string) => `lords.linkReminder:${accountId}`;
/** No navegador o servidor é sempre a própria origem: uma chave só. */
const SERVER_KEY = 'self';

export type FiefChoice = 'personal' | 'season';
const fiefChoiceKey = (accountId: string) => `lords.activeFief:${accountId}`;
const seasonHistoryKey = (accountId: string) => `lords.seasonHistory:${accountId}`;
type SeasonReference = { id: string; at: string };
type SeasonHistory = {
  latest: SeasonReference;
  previous?: SeasonReference;
  published?: SeasonReference;
};

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
  /** Codicon próprio do aviso; sem ele, vale o do tom. */
  icon?: string;
  text: string;
  /** Frases que detalham o aviso, uma por linha (o que muda na virada de estação). */
  details?: string[];
  actions: ToastAction[];
  /** Avisos sem botões somem sozinhos; os com botões esperam o jogador. */
  sticky: boolean;
  /** Um aviso do jogo (um acontecimento do feudo): "Silenciar 2h" o tira da tela com os outros. */
  game?: true;
  /**
   * O aviso guarda uma ação para "Tentar de novo" (uma ordem que não chegou ao servidor). Ele
   * só vale para a conta e o feudo em que nasceu: a troca de um ou de outro o tira de cena.
   */
  retry?: true;
  /**
   * As intenções da ordem que o aviso guarda (`game/intent.ts`): uma ordem nova com alguma
   * delas o tira de cena.
   */
  intents?: readonly string[];
};

/** Como `attempt` trata uma ação que é uma ordem ao feudo. */
export type AttemptOptions = {
  /**
   * As intenções da ordem (`intentsOf`): o que ela disputa. Uma tentativa nova aposenta o
   * "Tentar de novo" que uma anterior com alguma intenção em comum deixou: o aviso sai de cena e
   * o botão dele, se ainda for acionado, não envia.
   */
  intents?: readonly string[];
  /**
   * A trava da ordem: enquanto devolver verdadeiro (a mesma ordem está a caminho), nem um
   * acionamento novo nem o "Tentar de novo" enviam outra.
   */
  busy?: () => boolean;
};

/** Um documento carregado sob demanda (Crônica, dados do servidor). */
/** O Reino lê `/stats` no máximo uma vez por este intervalo (ADR 0021). */
export const STATS_EVERY_MS = 60_000;

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
  private readonly newsRead: NewsReadState;

  private fiefChoice: FiefChoice = 'personal';
  /** Marca cada abertura, inclusive ao voltar ao mesmo feudo. */
  gameOpening = 0;
  currentSeason: Loadable<CurrentSeasonResponse> = { status: 'idle' };
  seasonRanking: Loadable<LeaderboardResponse> = { status: 'idle' };
  seasonChronicle: {
    seasonId: string;
    position: number;
    name: string;
    document: Loadable<SeasonChronicleResponse>;
  } | null = null;
  seasonJoinError: string | null = null;
  joiningSeason = false;
  private seasonRead: Promise<void> | null = null;
  private seasonTimer: ReturnType<typeof setTimeout> | null = null;
  private accountOpening = 0;
  private unavailableSeasonGame: string | null = null;

  preferences: Preferences;
  route: Route = 'welcome';
  /** Abas que o jogador abriu (Crônica, Preferências, Novidades, Sobre). */
  opened: Route[] = [];
  chronicle: GameEvent[] = [];
  /** Os fechos anuais e escolhas de Votos preservados para a Crônica do Ano. */
  yearEvents: GameEvent[] = [];
  /** Rótulos de Votos já recebidos na visão desta partida, para exibir anos anteriores sem duplicar texto de regra. */
  vowLabels = new Map<string, string>();
  /** O que o conselho registrou na Crônica, para a aba do Conselho (`CouncilLog`). */
  councilLog: CouncilLog = EMPTY_COUNCIL_LOG;
  report: ReturnReport | null = null;
  /** Novidades ainda não vistas: destaques do Relatório de Retorno e avisos que viraram badge. */
  unseen = 0;
  busy = false;
  /** Instante em que a visão atual chegou: base da contagem regressiva local. */
  viewReceivedAt = 0;
  toasts: Toast[] = [];
  chronicleDocument: Loadable<string> = { status: 'idle' };
  selectedChronicleYear: number | null = null;
  yearChronicleDocument: Loadable<string> = { status: 'idle' };
  private yearChronicleRequest = 0;
  server: Loadable<VersionResponse> = { status: 'idle' };
  /** A aba Reino: os totais, o ranking de ouro e o jogador (`GET /stats`, ADR 0021). */
  stats: Loadable<StatsResponse> = { status: 'idle' };
  /**
   * Se os feudos da conta aparecem no ranking (`GET /me/ranking`), para as Preferências; `null`
   * enquanto não foi lido. `rankingSaving` marca a mudança a caminho do servidor.
   */
  rankingListed: boolean | null = null;
  rankingSaving = false;
  /** Quando a última leitura de `/stats` saiu: no máximo uma por minuto (`STATS_EVERY_MS`). */
  private statsReadAt = Number.NEGATIVE_INFINITY;
  /**
   * As opções de nova partida (`GET /catalog`): dificuldades, ritmos e o que vem marcado. Sem
   * elas (sem ligação, servidor de uma versão anterior), as boas-vindas ficam como na v0.1 e o
   * feudo nasce com os padrões do servidor.
   */
  catalog: Loadable<NewGameOptions> = { status: 'idle' };
  /** Semente pedida pelo endereço (`#/nova?seed=…`) para preencher a tela de boas-vindas. */
  pendingSeed: string | null = null;
  /** Campo de semente aberto nas boas-vindas (ex.: ao chegar por `#/nova`). */
  openSeedField = false;
  /** A aba do navegador está à vista. */
  visible = true;
  /** Executa um comando da paleta pelo id. Ligado por `palette/commands.ts`. */
  runCommand: (id: string, ...args: unknown[]) => void = () => {};
  /**
   * As cartas do Conselho com uma resposta a caminho do servidor (pelo `instanceId`): enquanto
   * ela não volta, os botões da carta ficam desabilitados e um segundo clique não vira ordem.
   */
  answering: ReadonlySet<string> = new Set();
  /**
   * As ordens da Guilda a caminho do servidor: `hire:<offerId>`, `dismiss:<heroId>` e `festival`.
   * Enquanto uma está aqui, o botão dela fica ocupado e um segundo acionamento não vira ordem.
   */
  guildOrders: ReadonlySet<string> = new Set();
  /**
   * O relatório que o jogador pediu para ver, e qual era o mais novo quando ele pediu; ver
   * `showReport` e `reportInFocus`.
   */
  private reportAsked: { expeditionId: string; newestThen: string | null } | null = null;

  private notificationHistory: number[] = [];
  /**
   * O que muda na chegada de cada estação, guardado enquanto ela ainda é a próxima
   * (`calendar.nextSeason.changes`): depois da virada a visão já fala da estação seguinte, e o
   * aviso da virada repete estas frases.
   */
  private seasonChanges = new Map<string, string[]>();
  /** O aviso de uma hora antes que está à vista: sai de cena quando a estação vira. */
  private seasonToast: { id: number; key: string } | null = null;
  /**
   * Os avisos de carta nova que estão à vista, pelo `instanceId`: quando a carta sai da mesa
   * (respondida aqui ou em outra aba, ou expirada), "Decidir" deixou de fazer sentido e o aviso
   * sai de cena.
   */
  private cardToasts = new Map<string, number>();
  /**
   * Os avisos de encruzilhada que estão à vista, pelo identificador da expedição: quando a
   * equipe deixa de esperar (o caminho foi escolhido, aqui ou em outra aba, ou o prazo acabou e
   * a Postura decidiu), "Escolher caminho" deixou de fazer sentido e o aviso sai de cena.
   */
  private crossroadsToasts = new Map<string, number>();
  private siegeToast: { phase: string; id: number } | null = null;
  /**
   * O alarme dos vigias que está à vista ("lobos a caminho"): quando a incursão chega, ou a
   * visão deixa de trazê-la, ele não tem mais o que avisar e sai de cena. Quem fala depois é o
   * desfecho.
   */
  private raidToast: number | null = null;
  /**
   * O relato dos vigias que está à vista (os uivos, ou a marca que a Ameaça cruzou): o relato
   * seguinte toma o lugar dele. "A Ameaça chegou a 40" não fica na tela com a Ameaça em 70.
   */
  private watchToast: number | null = null;
  private previousAccount: AccountState = { kind: 'signedOut' };
  private subscriptions: Array<() => void> = [];
  private warnedUpgrade = false;
  private expectedSignOut = false;
  private queue: Promise<void> = Promise.resolve();
  private nextToastId = 1;
  /**
   * A tentativa mais nova de cada intenção (`game/intent.ts`). O "Tentar de novo" de uma
   * tentativa só envia enquanto ela for a mais nova de todas as intenções da ordem.
   */
  private intentTurns = new Map<string, number>();
  /** O número da última tentativa: cada `attempt` é uma tentativa nova. */
  private attemptTurn = 0;
  /** A consulta de versão em andamento: quem depende do que o servidor tem ligado espera por ela. */
  private serverInfo: Promise<void> = Promise.resolve();
  /** A leitura do catálogo em andamento: quem a pede de novo espera pela mesma. */
  private catalogRequest: Promise<void> | null = null;

  private readonly changes = new Emitter<void>();
  /** Algo mudou: a bancada deve se redesenhar. */
  readonly onChange = this.changes.on;

  constructor(private readonly options: ControllerOptions) {
    this.preferences = loadPreferences(options.store);
    this.newsRead = new NewsReadState(options.store);
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
      deadline: () => this.seasonDeadline(),
    });
    this.subscriptions = [
      this.account.onDidChange((state) => this.enqueue(() => this.accountChanged(state))),
      this.session.onView(() => this.viewChanged()),
      this.session.onEvents((events) => this.eventsArrived(events)),
      this.session.onConnection((connection) => this.connectionChanged(connection)),
      this.session.onReturnReport((report) => this.reportArrived(report)),
      this.session.onReturnWhileOpen((report) => this.reportArrivedWhileOpen(report)),
      this.session.onProblem((error) => this.problemArrived(error)),
      this.session.onCycle(() => {
        this.refreshStatsIfShown();
        this.refreshSeasonIfNeeded();
      }),
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

  /** Define a semente pré-preenchida para a tela de boas-vindas (`#/nova?seed=…`). */
  setPendingSeed(seed: string | null, open = seed !== null): void {
    this.pendingSeed = seed;
    this.openSeedField = open;
    this.changes.emit();
  }

  /**
   * Ao abrir a página: retoma a conta guardada e, se houver partida, abre a sessão. `requested`
   * é a aba pedida pelo endereço (`#/feudo`); depois de uma ausência longa vale a aba Hoje.
   */
  async start(requested: Route | null = null, newGame?: { seed: string | null }): Promise<void> {
    this.previousAccount = this.account.restore();
    this.fiefChoice = this.restoreFiefChoice(this.previousAccount);
    if (newGame !== undefined && !this.hasGame) {
      this.pendingSeed = newGame.seed;
      this.openSeedField = true;
      requested = 'welcome';
    }
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
    this.serverInfo = this.loadServerInfo();
    // As boas-vindas mostram as opções assim que chegarem; "Jogar agora" não espera por elas.
    this.loadCatalogIfShown();
    await this.openGame(this.targetOf(this.account.state));
    this.refreshSeasonIfNeeded();
    if (this.report !== null && this.route !== 'kingdom') {
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
    this.accountOpening += 1;
    this.seasonRead = null;
    this.clearSeasonTimer();
    this.session.stop();
  }

  // --- O que vem do navegador ----------------------------------------------------

  /** A aba ficou à vista ou em segundo plano: a sessão ajusta a cadência do ciclo. */
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.session.setVisible(visible);
    this.refreshStatsIfShown();
    if (visible) this.refreshSeasonIfNeeded();
    else this.clearSeasonTimer();
    this.changes.emit();
  }

  /** O navegador avisou que a rede voltou: sincroniza na hora, sem esperar o recuo. */
  handleOnline(): void {
    void this.session.syncNow();
    this.refreshSeasonIfNeeded();
    if (this.server.status === 'error') {
      void this.loadServerInfo();
    }
    if (this.catalog.status === 'error') {
      void this.loadCatalog();
    }
  }

  /** Outra aba mudou o armazenamento. */
  handleTabChange(change: TabChange): void {
    if (change.kind === 'preferences') {
      this.preferences = loadPreferences(this.options.store);
      this.changes.emit();
    } else if (change.kind === 'newsRead') {
      const account = this.account.state;
      if (account.kind !== 'signedOut' && account.accountId === change.accountId) {
        this.changes.emit();
      }
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
    return this.targetOf(state) !== null;
  }

  get tabs(): Route[] {
    return visibleTabs(this.hasGame, this.opened);
  }

  /** A edição do servidor, sem usar a versão compilada do app como substituta. */
  get serverVersion(): string | null {
    return this.server.status === 'ready' ? this.server.value.server : null;
  }

  get hasUnreadNews(): boolean {
    const account = this.account.state;
    const latest = latestPublishedNews(this.serverVersion);
    return (
      account.kind !== 'signedOut' &&
      latest !== null &&
      this.newsRead.hasUnread(account.accountId, latest.version)
    );
  }

  /** Só a página desenhada e à vista confirma a leitura; navegar sozinho não basta. */
  async markNewsRead(): Promise<void> {
    const account = this.account.state;
    const latest = latestPublishedNews(this.serverVersion);
    if (this.route !== 'news' || !this.visible || account.kind === 'signedOut' || latest === null) {
      return;
    }
    if (await this.newsRead.markRead(account.accountId, latest.version)) {
      this.changes.emit();
    }
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
    if (this.route === 'guild' && route !== 'guild') {
      // Saiu da aba Guilda: o relatório pedido para ver já foi visto.
      this.reportAsked = null;
    }
    if (this.route === 'kingdom' && route !== 'kingdom') {
      this.seasonChronicle = null;
      this.clearSeasonTimer();
    }
    this.route = route;
    if (route === 'army') this.dropSiegeToast();
    if (route === 'today' || route === 'fief') {
      this.unseen = 0;
    }
    if (route === 'council') {
      // Na aba do Conselho as cartas estão à vista: os avisos que as anunciavam saem da frente.
      this.dropCardToasts(() => true);
      this.retryCouncilLog();
    }
    if (route === 'chronicle') {
      void this.loadChronicle();
    }
    if ((route === 'about' || route === 'news') && this.server.status !== 'ready') {
      void this.loadServerInfo();
    }
    if (route === 'kingdom') {
      void this.loadStats();
      this.refreshSeasonIfNeeded();
    }
    if (route === 'settings') {
      void this.loadRankingPreference();
    }
    this.loadCatalogIfShown();
    this.changes.emit();
  }

  /**
   * Lê as opções de nova partida quando a aba à vista as usa: as boas-vindas as oferecem e as
   * Preferências dizem o que a dificuldade do feudo muda. Quem tem feudo e não passa por essas
   * abas nunca as pede.
   */
  private loadCatalogIfShown(): void {
    if (this.route === 'welcome' || this.route === 'settings') {
      void this.loadCatalog();
    }
    if (this.route === 'welcome' && this.account.state.kind !== 'signedOut') {
      void this.loadStats();
    }
  }

  closeTab(route: Route): void {
    if (!this.opened.includes(route)) {
      return;
    }
    this.opened = this.opened.filter((entry) => entry !== route);
    if (this.route === route) {
      if (route === 'kingdom') {
        this.seasonChronicle = null;
        this.clearSeasonTimer();
      }
      this.route = this.defaultRoute();
      this.loadCatalogIfShown();
    }
    this.changes.emit();
  }

  // --- Reações -------------------------------------------------------------------

  private restoreFiefChoice(state: AccountState): FiefChoice {
    return state.kind !== 'signedOut' &&
      this.options.store.get(fiefChoiceKey(state.accountId)) === 'season'
      ? 'season'
      : 'personal';
  }

  private seasonFiefOf(state: AccountState): string | null {
    if (state.kind === 'signedOut') return null;
    const current = this.currentSeason.status === 'ready' ? this.currentSeason.value.season : null;
    return (
      state.seasonGames?.find(
        (game) =>
          game.status === 'active' &&
          game.id !== this.unavailableSeasonGame &&
          (current === null || (current.id === game.seasonId && current.status === 'open')),
      )?.id ?? null
    );
  }

  get seasonFief(): string | null {
    return this.seasonFiefOf(this.account.state);
  }

  get activeFief(): FiefChoice {
    const displayed = this.session.gameId ?? this.targetOf(this.account.state)?.gameId;
    return this.seasonFief !== null && displayed === this.seasonFief ? 'season' : 'personal';
  }

  private targetOf(state: AccountState): SessionTarget | null {
    if (state.kind === 'signedOut') return null;
    const season = this.seasonFiefOf(state);
    const gameId =
      this.fiefChoice === 'season' ? (season ?? state.gameId) : (state.gameId ?? season);
    return gameId === null ? null : { serverKey: SERVER_KEY, accountId: state.accountId, gameId };
  }

  async switchFief(choice: FiefChoice): Promise<void> {
    this.enqueue(async () => {
      const state = this.account.state;
      if (state.kind === 'signedOut' || this.busy) return;
      if ((choice === 'season' ? this.seasonFief : state.gameId) === null) return;
      if (this.activeFief === choice) return;
      this.fiefChoice = choice;
      const saved = this.options.store.update(fiefChoiceKey(state.accountId), choice);
      const target = this.targetOf(state);
      this.resetFief();
      this.route = 'fief';
      await this.openGame(target);
      await saved;
    });
    await this.settled();
  }

  private resetFief(): void {
    this.gameOpening += 1;
    this.session.stop();
    this.chronicle = [];
    this.yearEvents = [];
    this.vowLabels = new Map();
    this.councilLog = EMPTY_COUNCIL_LOG;
    this.chronicleDocument = { status: 'idle' };
    this.selectedChronicleYear = null;
    this.yearChronicleDocument = { status: 'idle' };
    this.yearChronicleRequest += 1;
    this.seasonChronicle = null;
    this.report = null;
    this.unseen = 0;
    this.viewReceivedAt = 0;
    this.seasonChanges.clear();
    this.notificationHistory = [];
    this.answering = new Set();
    this.guildOrders = new Set();
    this.reportAsked = null;
    this.intentTurns.clear();
    this.dropGameToasts();
    this.dropRetryToasts();
  }

  private async accountChanged(state: AccountState): Promise<void> {
    const before = this.previousAccount;
    this.previousAccount = state;
    const beforeId = before.kind === 'signedOut' ? null : before.accountId;
    const accountId = state.kind === 'signedOut' ? null : state.accountId;
    const changedAccount = beforeId !== accountId;
    const beforeGame = this.session.gameId;
    if (changedAccount) {
      this.accountOpening += 1;
      this.clearSeasonTimer();
      this.currentSeason = { status: 'idle' };
      this.seasonRanking = { status: 'idle' };
      this.seasonRead = null;
      this.seasonJoinError = null;
      this.joiningSeason = false;
      this.unavailableSeasonGame = null;
      this.fiefChoice = this.restoreFiefChoice(state);
      this.rankingListed = null;
    }
    const target = this.targetOf(state);
    const changedGame = changedAccount || beforeGame !== (target?.gameId ?? null);
    if (changedGame) {
      this.resetFief();
      this.stats = { status: 'idle' };
      this.statsReadAt = Number.NEGATIVE_INFINITY;
      if (beforeId !== null && changedAccount) {
        // Sair, excluir, perder sessão ou trocar de conta também apaga os caches arquivados.
        await clearAccountCaches(this.options.store, SERVER_KEY, beforeId);
        await this.options.store.update(reminderKey(beforeId), undefined);
        await this.options.store.update(fiefChoiceKey(beforeId), undefined);
        await this.options.store.update(seasonHistoryKey(beforeId), undefined);
        await this.newsRead.forget(beforeId);
      }
      await this.openGame(target);
    }
    if (
      !changedAccount &&
      before.kind !== 'signedOut' &&
      state.kind !== 'signedOut' &&
      before.gameId !== null &&
      before.gameId !== state.gameId
    ) {
      // O servidor substituiu a partida pessoal, mesmo se a Temporada estiver à vista.
      await this.session.clearCache({
        serverKey: SERVER_KEY,
        accountId: before.accountId,
        gameId: before.gameId,
      });
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
    } else if (changedGame && (this.route !== 'kingdom' || changedAccount)) {
      this.route = this.defaultRoute();
    }
    this.loadCatalogIfShown();
    if (this.route === 'kingdom') void this.loadStats();
    if (changedAccount || changedGame) this.refreshSeasonIfNeeded();
    this.changes.emit();
  }

  /** Abre só a partida à vista. A troca cancela o ciclo anterior e preserva seu cache. */
  private async openGame(target: SessionTarget | null): Promise<void> {
    const account = this.account.state;
    if (target === null || account.kind === 'signedOut' || target.accountId !== account.accountId)
      return;
    this.clearSeasonTimer();
    this.session.setVisible(this.visible);
    const opening = this.session.start(target);
    this.changes.emit();
    await opening;
    if (this.session.connection.kind === 'online') {
      await this.loadRecentChronicle();
    }
    this.changes.emit();
  }

  /**
   * Lê o fim da Crônica: a Crônica recente e, num trecho maior, o que o conselho registrou
   * (`CHRONICLE_LOOKBACK`). Sem ligação na abertura, ou com a leitura falhando, a aba do Conselho
   * diz isso, em vez de "Nada ainda"; a leitura se repete quando a ligação volta e quando a aba
   * do Conselho é aberta.
   */
  private async loadRecentChronicle(): Promise<void> {
    const gameId = this.session.gameId;
    const opening = this.gameOpening;
    if (gameId === null || this.councilLog.status === 'loading') {
      return;
    }
    this.councilLog = { ...this.councilLog, status: 'loading' };
    try {
      const { entries } = await this.client.getChronicle(gameId, { limit: CHRONICLE_LOOKBACK });
      // A resposta só vale se a partida aberta ainda for a mesma: nada da conta anterior
      // aparece na seguinte.
      if (this.gameOpening !== opening || this.session.gameId !== gameId) {
        return;
      }
      // Os eventos que chegaram enquanto a leitura vinha ficam: a lista é a soma das duas.
      this.chronicle = mergeBySeq(entries, this.chronicle).slice(-CHRONICLE_LINES);
      const yearRecords = entries.filter(isYearRecordEvent);
      if (yearRecords.length > 0) {
        this.yearEvents = mergeBySeq(yearRecords, this.yearEvents);
      }
      this.councilLog = {
        status: 'ready',
        lines: mergeBySeq(entries.filter(isCouncilEvent), this.councilLog.lines).slice(
          -COUNCIL_RECORD_LINES,
        ),
        complete: entries.length < CHRONICLE_LOOKBACK,
      };
    } catch (error) {
      if (this.gameOpening !== opening || this.session.gameId !== gameId) {
        return;
      }
      this.log(`Crônica indisponível: ${describeError(error).message}`);
      this.councilLog = { ...this.councilLog, status: 'error' };
    }
    this.changes.emit();
  }

  /** O registro do conselho ainda não foi lido, ou a leitura falhou: vale tentar de novo. */
  private retryCouncilLog(): void {
    const { status } = this.councilLog;
    if ((status === 'idle' || status === 'error') && this.connection.kind === 'online') {
      void this.loadRecentChronicle();
    }
  }

  private viewChanged(): void {
    this.viewReceivedAt = this.now();
    const view = this.view;
    if (view !== null) {
      const vows = vowsOf(view);
      for (const entry of [...vows.offer, ...vows.taken]) {
        this.vowLabels.set(entry.id, entry.label);
      }
      const { id, changes } = view.calendar.nextSeason;
      this.seasonChanges.set(id, changes);
      // A carta que já não espera resposta leva embora o aviso que a anunciou.
      const pending = new Set(cardDecisions(view).map((decision) => decision.id));
      this.dropCardToasts((instanceId) => !pending.has(instanceId));
      // E a encruzilhada que já foi decidida, o aviso que a anunciou.
      const waiting = new Set(waitingExpeditions(view.guild).map((expedition) => expedition.id));
      this.dropCrossroadsToasts((expeditionId) => !waiting.has(expeditionId));
      const phase =
        waveDecision(view)?.id ??
        (view.siege?.current === 0 && view.siege.result === null
          ? `scheduled:${view.siege.year}`
          : null);
      if (this.siegeToast !== null && phase !== this.siegeToast.phase) this.dropSiegeToast();
      if (view.threat.incoming === null) {
        // A incursão anunciada já chegou: "a caminho" deixou de ser verdade.
        this.dropRaidToast();
      }
    }
    this.changes.emit();
    this.warnOfSeasonAhead();
    void this.maybeRemindToLink();
  }

  /**
   * O aviso de uma hora antes da virada de estação (GDD §13.5): o que muda, nas frases do
   * servidor, e o caminho para a aba Hoje, onde "Antes de partir" diz o que preparar. É um por
   * virada (a marca fica guardada com o cache da partida) e segue a política dos outros avisos:
   * nível, silêncio de 2 horas, limite por hora e modo discreto. Só uma visão lida do servidor
   * nesta abertura conta: a guardada pode ter horas, e o prazo dela já não vale.
   */
  private warnOfSeasonAhead(): void {
    const { view, session } = this;
    if (view === null || !session.live) {
      return;
    }
    const notice = seasonAhead(view, { now: this.viewReceivedAt, timeZone: this.timezone() });
    if (this.seasonToast !== null && this.seasonToast.key !== notice?.key) {
      // A estação anunciada já chegou: "à vista" deixou de ser verdade.
      this.dropSeasonToast();
    }
    if (notice === null || session.seasonWarned === notice.key) {
      return;
    }
    const decision = decideNotice({
      level: this.preferences.notifications,
      discreetMode: this.preferences.discreetMode,
      mutedUntil: this.preferences.mutedUntil,
      now: this.now(),
      history: this.notificationHistory,
    });
    if (decision.outcome === 'skip') {
      // Nada foi dito: se o jogador ligar os avisos ainda dentro da hora, este chega.
      return;
    }
    this.notificationHistory = decision.history;
    void session.markSeasonWarned(notice.key);
    if (decision.outcome === 'badge') {
      this.unseen += 1;
      this.changes.emit();
      return;
    }
    const id = this.announce({
      kind: notice.kind,
      icon: SEASON_ICON,
      text: notice.text,
      details: notice.details,
      action: { label: 'Ver', route: 'today' },
    });
    this.seasonToast = { id, key: notice.key };
  }

  private dropSeasonToast(): void {
    if (this.seasonToast !== null) {
      this.dismissToast(this.seasonToast.id);
      this.seasonToast = null;
    }
  }

  private dropRaidToast(): void {
    if (this.raidToast !== null) {
      this.dismissToast(this.raidToast);
      this.raidToast = null;
    }
  }

  private dropWatchToast(): void {
    if (this.watchToast !== null) {
      this.dismissToast(this.watchToast);
      this.watchToast = null;
    }
  }

  /** Tira de cena os avisos de carta nova das cartas que `gone` aponta. */
  private dropCardToasts(gone: (instanceId: string) => boolean): void {
    for (const [instanceId, toastId] of [...this.cardToasts]) {
      if (gone(instanceId)) {
        this.cardToasts.delete(instanceId);
        this.dismissToast(toastId);
      }
    }
  }

  private eventsArrived(events: GameEvent[]): void {
    // As viradas de dia provam que o mundo andou e o fecho diário do desperdício dá o total ao
    // Relatório, mas nenhum dos dois é linha da Crônica (ADRs 0007 e 0015).
    this.chronicle = [...this.chronicle, ...events.filter(isChronicleEvent)]
      .filter((event, index, all) => all.findIndex((other) => other.seq === event.seq) === index)
      .slice(-CHRONICLE_LINES);
    const yearRecords = events.filter(isYearRecordEvent);
    if (yearRecords.length > 0) {
      this.yearEvents = mergeBySeq(this.yearEvents, yearRecords);
    }
    const council = events.filter(isCouncilEvent);
    if (council.length > 0) {
      // O registro do conselho tem a sua própria conta: as linhas dele não saem com as 20 da
      // Crônica recente.
      this.councilLog = {
        ...this.councilLog,
        lines: mergeBySeq(this.councilLog.lines, council).slice(-COUNCIL_RECORD_LINES),
      };
    }
    // Um lote só desses eventos não muda a Crônica: não há por que baixá-la de novo.
    const changesChronicle = events.some(isChronicleEvent);
    if (changesChronicle && this.chronicleDocument.status === 'ready') {
      // A Crônica aberta ficou para trás: a próxima visita à aba a lê de novo.
      this.chronicleDocument = { status: 'idle' };
      if (this.route === 'chronicle') {
        void this.loadChronicle();
      }
    }

    this.tellOwnAnswers(events);

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
      // A visão chega antes dos eventos: a estação dela é a que vale agora.
      season: this.view?.calendar.season ?? null,
      // A decisão que não vai virar aviso aqui não ocupa um dos avisos da hora.
      unshown: (event) =>
        (isDecision(event) && !this.decisionAnnounced(event)) ||
        (isSiegeEvent(event) &&
          (siegeNotice(event, this.view, this.viewReceivedAt) === null ||
            ((event.type === 'siegeScheduled' || event.type === 'siegeWaveFought') &&
              this.visible &&
              this.route === 'army'))),
    });
    this.notificationHistory = decision.history;
    this.unseen += decision.badge;
    for (const event of decision.show) {
      this.notify(event, events);
    }
    this.changes.emit();
  }

  /**
   * O desfecho de uma carta que o jogador acabou de responder nesta aba: a frase da Crônica que
   * a escolha escreveu aparece na hora, por alguns segundos. Não é notificação (não tem botões,
   * não conta no limite por hora nem depende do nível escolhido): é a resposta à ação dele, como
   * a recusa de uma ordem. A resposta dada em outra aba não avisa aqui; a carta só some. No modo
   * discreto, nada do jogo vai para a tela.
   */
  private tellOwnAnswers(events: GameEvent[]): void {
    if (this.preferences.discreetMode) {
      return;
    }
    for (const event of events) {
      if (event.type === 'cardAnswered' && this.answering.has(String(event.data.instanceId))) {
        this.toast({ kind: 'info', icon: eventIcon(event), text: event.text });
      }
    }
  }

  /**
   * Um evento que a política liberou vira aviso, com a frase da Crônica que veio nele. `batch` é
   * o lote em que ele chegou: vários objetivos cumpridos de uma vez saem em um aviso só.
   */
  private notify(event: GameEvent, batch: GameEvent[]): void {
    if (isSiegeEvent(event)) {
      const view = this.view;
      const notice = siegeNotice(event, view, this.viewReceivedAt, this.timezone());
      if (notice === null) return;
      this.dropSiegeToast();
      const id = this.announce({
        ...notice,
        kind: event.type === 'siegeFell' ? 'warning' : 'info',
        icon: eventIcon(event),
        ...(event.type === 'siegeWaveFought' ? { counted: false } : {}),
        action: {
          label: event.type === 'siegeWaveFought' ? 'Ver a próxima onda' : 'Ver o Cerco',
          route: 'army',
          section: SIEGE_SECTION,
        },
      });
      if (
        view?.siege != null &&
        (event.type === 'siegeWaveFought' || event.type === 'siegeScheduled')
      ) {
        this.siegeToast = {
          phase: waveDecision(view)?.id ?? `scheduled:${view.siege.year}`,
          id,
        };
      }
      return;
    }
    if (isCrossroadsArrival(event)) {
      this.notifyCrossroads(event);
      return;
    }
    if (isDecision(event)) {
      this.notifyCard(event);
      return;
    }
    if (isRaidAlarm(event)) {
      this.notifyRaid(event);
      return;
    }
    if (isObjectiveCompleted(event)) {
      this.notifyObjectives(event, batch);
      return;
    }
    // Os heróis que ficaram descontentes na mesma virada saem em um aviso só.
    const discontent = isHeroDiscontent(event) ? discontentNotice(batch) : null;
    if (discontent !== null) {
      this.announce({
        kind: 'warning',
        icon: eventIcon(event),
        ...discontent,
        action: { label: 'Ver', route: 'guild' },
      });
      return;
    }
    // As caravanas emboscadas no mesmo lote também.
    const ambush = isCaravanAmbush(event) ? ambushNotice(batch) : null;
    if (ambush !== null) {
      this.announce({
        kind: 'warning',
        icon: eventIcon(event),
        ...ambush,
        action: { label: 'Ver', route: 'market' },
      });
      return;
    }
    // Os heróis que uma mesma expedição perdeu também: a primeira perda fala por todas.
    const loss = lossNotice(event, batch);
    if (loss !== null) {
      this.announce({
        kind: 'warning',
        icon: eventIcon(event),
        ...loss,
        action: { label: 'Ver', route: 'guild' },
      });
      return;
    }
    // A virada de estação repete o que muda, como o aviso de uma hora antes; o ataque sofrido
    // diz quem ficou ferido e quando sara.
    const details = isSeasonTurn(event)
      ? seasonArrival(event, this.seasonChanges.get(String(event.data.season)), this.view)
      : event.type === 'raidSuffered'
        ? raidAftermath(this.view)
        : event.type === 'wageArrearsStarted'
          ? arrearsAhead(this.view)
          : // O herói que chega com o cofre curto e o atraso que fecha devendo uma partida.
            wageAhead(event, this.view);
    if (isRaidOutcome(event)) {
      // O desfecho toma o lugar do alarme que o anunciou.
      this.dropRaidToast();
    }
    if (isWatchReport(event)) {
      // Um relato novo dos vigias toma o lugar do anterior: o de antes já é notícia velha.
      this.dropWatchToast();
    }
    const id = this.announce({
      // A boa notícia que traz uma perda a caminho (o atraso fechou, mas alguém ainda parte)
      // não sai com tom de alívio.
      kind:
        isEssential(event) || (event.type === 'wageArrearsEnded' && details.length > 0)
          ? 'warning'
          : 'info',
      icon: eventIcon(event),
      text: event.text,
      details,
      // O que vem da mata (os uivos, o relato dos vigias, o desfecho de um ataque) leva ao
      // painel da Ameaça, que fica abaixo da dobra da aba Feudo.
      // O que é da equipe (o soldo em atraso, o herói que chegou ou partiu) leva à aba Guilda.
      // A expedição que voltou, ou que se perdeu, leva ao relatório dela.
      action: isExpeditionEnd(event)
        ? {
            label: 'Ver o relatório',
            route: 'guild',
            command: { id: 'lords.openReport', arg: String(event.data.expeditionId) },
          }
        : {
            label: 'Ver',
            route:
              event.type === 'yearEnded'
                ? 'chronicle'
                : isGuildEvent(event)
                  ? 'guild'
                  : isMarketEvent(event)
                    ? 'market'
                    : isArmyEvent(event)
                      ? 'army'
                      : isMapEvent(event)
                        ? 'map'
                        : 'fief',
            ...(isWatchReport(event) || isRaidOutcome(event) || isWallEvent(event)
              ? { section: THREAT_SECTION }
              : {}),
            ...(isSmithyEvent(event) ? { section: SMITHY_SECTION } : {}),
          },
    });
    if (isWatchReport(event)) {
      this.watchToast = id;
    }
  }

  /**
   * O objetivo cumprido (GDD §12.2): a frase da Crônica, que diz qual foi e a recompensa. Quando
   * o lote traz vários (o que o feudo já tinha feito conta de uma vez), um aviso só: "3 objetivos
   * cumpridos.", com uma linha para cada um e a recompensa como a visão a diz. "Ver" leva à lista
   * dos objetivos, onde os seguintes acabaram de aparecer.
   */
  private notifyObjectives(event: GameEvent, batch: GameEvent[]): void {
    const summary = objectivesCompleted(batch, this.view);
    this.announce({
      kind: 'info',
      icon: eventIcon(event),
      text: summary === null ? event.text : `${summary.title}.`,
      details: summary === null ? [] : summary.lines.map((line) => `${line}.`),
      action: { label: 'Ver', route: 'fief', section: OBJECTIVES_SECTION },
    });
  }

  /**
   * O alarme dos vigias (GDD §8.2 e §13.5): "lobos a caminho", com o prazo e a hora do relógio em
   * que o ataque chega, o que ele custa a um feudo sem defesa e o que a Paliçada faz a ele, nas
   * frases do servidor. "Ver" leva ao painel da Ameaça, no feudo, onde a obra da Paliçada está
   * logo abaixo do aviso, e recolhe os outros avisos do jogo (`announce`), que ficariam por cima
   * da coluna do painel. A incursão é a da visão, que chega antes dos eventos: se ela já não está
   * a caminho (a página leu tarde, e o ataque já passou), o alarme não sai; quem conta é o
   * desfecho.
   */
  private notifyRaid(event: GameEvent): void {
    const details = raidAhead(this.view, { now: this.viewReceivedAt, timeZone: this.timezone() });
    if (details.length === 0) {
      return;
    }
    this.dropRaidToast();
    this.raidToast = this.announce({
      kind: 'warning',
      icon: eventIcon(event),
      text: event.text,
      details,
      action: { label: 'Ver', route: 'fief', section: THREAT_SECTION },
    });
  }

  /**
   * A carta nova ou a encruzilhada vira aviso nesta página? Só se ainda espera na visão (que
   * chega antes dos eventos) e o jogador não a tem à vista, na aba dela: lá ela apareceu na
   * frente dele, e um aviso por cima só atrapalharia a leitura. É perguntado antes da conta dos
   * avisos da hora (`decideNotifications`, `unshown`): o que não vai aparecer não ocupa lugar.
   */
  private decisionAnnounced(event: GameEvent): boolean {
    if (isCrossroadsArrival(event)) {
      const waits = this.view?.guild.expeditions.some(
        (entry) => entry.id === event.data.expeditionId && entry.crossroads !== null,
      );
      return waits === true && !(this.visible && this.route === 'guild');
    }
    const pending = this.view?.council.pending.some(
      (entry) => entry.instanceId === event.data.instanceId,
    );
    return pending === true && !(this.visible && this.route === 'council');
  }

  /**
   * "Nova carta do Conselho: <título>", com o prazo (e a hora do relógio em que ele acaba: o
   * aviso fica na tela, e "por 23 h" envelhece), o que o conselho faz sozinho e o botão
   * "Decidir", que leva à aba do Conselho (GDD §13.5). A carta é a da visão, que chega antes dos
   * eventos: se ela já não está na mesa (foi respondida em outra aba, ou o prazo acabou antes
   * de esta página ler), não há o que decidir e o aviso não sai. Também não sai para quem já está
   * na aba do Conselho, com ela à vista. O aviso não entra no contador de novidades: enquanto a
   * carta espera, quem a conta é o contador de decisões pendentes.
   */
  private notifyCard(event: GameEvent): void {
    const card = this.view?.council.pending.find(
      (entry) => entry.instanceId === event.data.instanceId,
    );
    if (card === undefined || !this.decisionAnnounced(event)) {
      return;
    }
    const id = this.announce({
      kind: 'info',
      icon: eventIcon(event),
      ...cardNotice(card, { now: this.viewReceivedAt, timeZone: this.timezone() }),
      action: { label: 'Decidir', route: 'council' },
      counted: false,
    });
    this.cardToasts.set(card.instanceId, id);
  }

  /**
   * "Encruzilhada em <expedição>: <título>", com o prazo real (e a hora do relógio em que ele
   * acaba), o que a Postura faz sem resposta, na frase do servidor, e o botão "Escolher caminho"
   * (GDD §13.5), que abre a lista das opções pelo comando `lords.chooseExpeditionPath`. A
   * expedição é a da visão, que chega antes dos eventos: se a equipe já não espera (outra aba
   * escolheu, ou o prazo acabou antes de esta página ler), não há o que escolher e o aviso não
   * sai. Também não sai para quem já está na aba Guilda, com a encruzilhada à vista. O aviso não
   * entra no contador de novidades: quem a conta é o contador de decisões pendentes.
   */
  private notifyCrossroads(event: GameEvent): void {
    const expedition = this.view?.guild.expeditions.find(
      (entry) => entry.id === event.data.expeditionId,
    );
    const notice =
      expedition === undefined
        ? null
        : crossroadsNotice(expedition, { now: this.viewReceivedAt, timeZone: this.timezone() });
    if (expedition === undefined || notice === null || !this.decisionAnnounced(event)) {
      return;
    }
    const id = this.announce({
      kind: 'info',
      icon: eventIcon(event),
      ...notice,
      action: {
        label: 'Escolher caminho',
        route: 'guild',
        command: { id: 'lords.chooseExpeditionPath', arg: { expeditionId: expedition.id } },
      },
      counted: false,
    });
    this.crossroadsToasts.set(expedition.id, id);
  }

  /** Tira de cena os avisos de encruzilhada das expedições que `gone` aponta. */
  private dropCrossroadsToasts(gone: (expeditionId: string) => boolean): void {
    for (const [expeditionId, toastId] of [...this.crossroadsToasts]) {
      if (gone(expeditionId)) {
        this.crossroadsToasts.delete(expeditionId);
        this.dismissToast(toastId);
      }
    }
  }

  private dropSiegeToast(): void {
    if (this.siegeToast !== null) {
      const { id } = this.siegeToast;
      this.siegeToast = null;
      this.dismissToast(id);
    }
  }

  /**
   * Um aviso do jogo: no canto da página, com o botão que leva ao assunto ("Ver" ou "Decidir")
   * e "Silenciar 2h", e, com a aba em segundo plano, no contador do título e (se o jogador
   * pediu) pelo navegador.
   *
   * Seguir um aviso ("Ver", "Decidir") recolhe todos os avisos do jogo, como "Silenciar 2h",
   * mas sem silenciar os seguintes. Um aviso com botões não some sozinho, e os que sobrassem no
   * canto ficariam por cima do que o botão prometeu mostrar: o painel da Ameaça e a obra da
   * Paliçada estão na coluna da direita, debaixo deles. Nada do que diziam se perde: a Crônica
   * recente tem cada frase; as cartas à espera estão no contador de decisões, na árvore e na
   * barra de status; o que a estação muda, em "Antes de partir"; a incursão a caminho, no painel
   * e na barra de status.
   */
  private announce(notice: {
    kind: Toast['kind'];
    icon: string | undefined;
    text: string;
    details: string[];
    /**
     * O botão do aviso e a aba a que ele leva. Com `section`, a página e o foco vão também até
     * essa seção da aba (um argumento de `lords.openPanel`).
     */
    action: {
      label: string;
      route: 'today' | 'fief' | 'council' | 'guild' | 'market' | 'army' | 'map' | 'chronicle';
      section?: string;
      /**
       * Em vez de só navegar, o botão executa este comando do app (que leva à aba e abre o que
       * for preciso): "Escolher caminho" abre a lista das opções; "Ver o relatório", a folha.
       */
      command?: { id: string; arg?: unknown };
    };
    /**
     * O aviso entra no contador de novidades com a aba em segundo plano. A carta nova não entra:
     * ela já é contada como decisão pendente.
     */
    counted?: boolean;
  }): number {
    const id = this.toast({
      kind: notice.kind,
      icon: notice.icon,
      text: notice.text,
      details: notice.details,
      game: true,
      actions: [
        {
          label: notice.action.label,
          run: () => {
            this.dropGameToasts();
            this.navigate(notice.action.route);
            if (notice.action.command !== undefined) {
              this.runCommand(notice.action.command.id, notice.action.command.arg);
            } else if (notice.action.section !== undefined) {
              this.runCommand('lords.openPanel', notice.action.section);
            }
          },
        },
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
      if (notice.counted !== false) {
        this.unseen += 1;
      }
      const notifier = this.options.notifier;
      if (this.preferences.browserNotifications && notifier?.granted()) {
        notifier.show(
          this.view?.settlement.name ?? APP_NAME,
          [notice.text, ...notice.details].join(' '),
        );
      }
    }
    return id;
  }

  /** Tira de cena todos os avisos do jogo, e esquece quais eram os de carta, estação e vigias. */
  private dropGameToasts(): void {
    this.cardToasts.clear();
    this.crossroadsToasts.clear();
    this.siegeToast = null;
    this.seasonToast = null;
    this.raidToast = null;
    this.watchToast = null;
    if (this.toasts.some((toast) => toast.game === true)) {
      this.toasts = this.toasts.filter((toast) => toast.game !== true);
      this.changes.emit();
    }
  }

  /** Tira de cena os avisos com "Tentar de novo": a ação que guardam era de outro feudo. */
  private dropRetryToasts(): void {
    if (this.toasts.some((toast) => toast.retry === true)) {
      this.toasts = this.toasts.filter((toast) => toast.retry !== true);
      this.changes.emit();
    }
  }

  /** Tira de cena o "Tentar de novo" que uma ordem com alguma destas intenções deixou. */
  private dropRetryOf(intents: readonly string[]): void {
    const disputed = (toast: Toast) =>
      toast.intents?.some((intent) => intents.includes(intent)) === true;
    if (this.toasts.some(disputed)) {
      this.toasts = this.toasts.filter((toast) => !disputed(toast));
      this.changes.emit();
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
    if (connection.kind === 'online' && this.catalog.status === 'error') {
      void this.loadCatalog();
    }
    // A página abriu sem ligação, ou a leitura da Crônica falhou: a aba do Conselho espera ela.
    this.retryCouncilLog();
    // Os avisos de falta de rede ficam: é com a ligação de volta que o "Tentar de novo" deles
    // consegue reenviar a ordem.
    this.changes.emit();
  }

  private reportArrived(report: ReturnReport): void {
    this.report = report;
    this.unseen += report.highlights.length;
    // No Reino, o relatório espera em Hoje sem tirar a leitura da Temporada da tela.
    if (this.hasGame && this.route !== 'kingdom') {
      this.route = 'today';
    }
    this.changes.emit();
  }

  /**
   * O jogador voltou a uma aba que ficou aberta e fora de vista por 4 horas ou mais (V2D-T4.4):
   * o relatório fica na aba Hoje, com os três blocos. Aqui a aba em que ele estava não muda
   * debaixo do cursor (ao reabrir a página não há onde ele estivesse; aqui há): um aviso diz que
   * o relatório existe e leva até ele. No modo discreto, nada do jogo vai para a tela, e a
   * marca na aba Hoje basta.
   */
  private reportArrivedWhileOpen(report: ReturnReport): void {
    this.report = report;
    // Os avisos que viraram contador com a aba fora de vista falam dos mesmos acontecimentos.
    this.unseen = Math.max(this.unseen, report.highlights.length);
    if (this.hasGame && this.route !== 'today' && !this.preferences.discreetMode) {
      this.toast({
        kind: 'info',
        icon: 'home',
        game: true,
        text: `Você esteve fora por ${formatAway(report.awaySeconds)}. O Relatório de Retorno espera na aba Hoje.`,
        actions: [{ label: 'Ver', run: () => this.navigate('today') }],
      });
    }
    this.changes.emit();
  }

  private problemArrived(error: unknown): void {
    const { code, message } = describeError(error);
    this.log(`O servidor recusou a leitura da partida: ${code} · ${message}`);
    if (code === 'UPGRADE_REQUIRED') {
      // O ciclo avisa uma vez só: repetir a cada 30 s seria ruído.
      if (!this.warnedUpgrade) {
        this.warnedUpgrade = true;
        this.askToReload();
      }
      return;
    }
    // O fecho pode barrar a visão antes de o job arquivar a partida.
    if (
      this.session.gameId !== null &&
      this.session.gameId === this.seasonFief &&
      (code === 'CONFLICT' || code === 'NOT_FOUND')
    ) {
      this.unavailableSeasonGame = this.session.gameId;
      this.enqueue(() => this.accountChanged(this.account.state));
      void this.loadSeason();
    }
    void this.revalidateAccount();
  }

  /** A aba ficou para trás de uma atualização do servidor: o remédio é recarregar a página. */
  private askToReload(): void {
    this.toast({
      kind: 'warning',
      text: 'Há uma versão nova do jogo. Recarregue a página.',
      actions: [{ label: 'Recarregar', run: () => this.runCommand('lords.reload') }],
    });
  }

  private async maybeRemindToLink(): Promise<void> {
    const { store } = this.options;
    const account = this.account.state;
    if (account.kind === 'signedOut') {
      return;
    }
    const key = reminderKey(account.accountId);
    let record = readReminderRecord(store.get(key));
    if (record === null || record.since > this.now()) {
      // Primeira vez desta conta neste navegador (ou um registro "no futuro", de quando o relógio
      // do aparelho estava adiantado): o prazo do lembrete começa agora.
      record = { since: this.now(), shown: record?.shown ?? false };
      await store.update(key, record);
    }
    if (!shouldRemindToLink(record, account, this.now()) || this.preferences.discreetMode) {
      return;
    }
    await store.update(key, { ...record, shown: true });
    // O botão do GitHub depende de saber se o servidor tem o vínculo ligado.
    await this.serverInfo;
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
  toast(input: {
    kind: Toast['kind'];
    text: string;
    actions?: ToastAction[];
    icon?: string | undefined;
    details?: string[];
    /** Um aviso do jogo: sai de cena com "Silenciar 2h". */
    game?: boolean;
    /** Um aviso com "Tentar de novo": sai de cena com a troca de feudo ou de conta. */
    retry?: boolean;
    /** As intenções da ordem que o aviso guarda. */
    intents?: readonly string[] | undefined;
  }): number {
    const id = this.nextToastId;
    this.nextToastId += 1;
    const actions = input.actions ?? [];
    const details = input.details ?? [];
    this.toasts = [
      ...this.toasts.filter((toast) => toast.text !== input.text),
      {
        id,
        kind: input.kind,
        ...(input.icon === undefined ? {} : { icon: input.icon }),
        text: input.text,
        ...(details.length === 0 ? {} : { details }),
        actions,
        sticky: actions.length > 0,
        ...(input.game === true ? { game: true as const } : {}),
        ...(input.retry === true ? { retry: true as const } : {}),
        ...(input.intents === undefined ? {} : { intents: input.intents }),
      },
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
   *
   * Com `intents`, a ação é uma ordem ao feudo, e cada chamada daqui é uma **tentativa nova** do
   * jogador: ela aposenta o "Tentar de novo" que uma tentativa anterior da mesma intenção
   * deixou. Sem isso, a ordem refeita pelo painel e a retentativa antiga seriam duas ordens,
   * com dois `commandId`, para um pedido só.
   */
  async attempt(action: () => Promise<void>, options: AttemptOptions = {}): Promise<boolean> {
    if (options.busy?.() === true) {
      return false;
    }
    // Esta tentativa passa a ser a mais nova de cada intenção que a ordem disputa.
    this.attemptTurn += 1;
    const turn = this.attemptTurn;
    for (const intent of options.intents ?? []) {
      this.intentTurns.set(intent, turn);
    }
    return this.runAttempt(action, options, turn);
  }

  /** Uma tentativa ou a retentativa dela: `turn` diz de qual tentativa da intenção se trata. */
  private async runAttempt(
    action: () => Promise<void>,
    options: AttemptOptions,
    turn: number,
  ): Promise<boolean> {
    const intents = options.intents ?? [];
    const opening = this.gameOpening;
    if (options.busy?.() === true) {
      return false;
    }
    this.dropRetryOf(intents);
    try {
      await action();
      return true;
    } catch (error) {
      if (intents.length > 0 && opening !== this.gameOpening) return false;
      const { code, message } = describeError(error);
      if (code === 'UPGRADE_REQUIRED') {
        // Uma ordem que não foi aceita sempre tem resposta na tela, mesmo que o aviso do ciclo
        // já tenha sido dispensado (um aviso igual ao que está à vista só o substitui).
        this.warnedUpgrade = true;
        this.askToReload();
      } else if (isGameRuleError(error) || error instanceof StaleOrderError) {
        // A ordem de outro feudo não tem "Tentar de novo": repetir não a faria valer aqui.
        this.toast({ kind: 'warning', text: message, game: intents.length > 0 });
      } else if (code === 'NETWORK') {
        this.toast({
          kind: 'error',
          text: message,
          retry: true,
          intents,
          actions: [
            {
              label: 'Tentar de novo',
              run: async () => {
                // Uma tentativa mais nova de alguma das intenções já tomou o lugar desta.
                if (opening !== this.gameOpening) {
                  if (intents.length > 0) {
                    this.toast({
                      kind: 'warning',
                      text: new StaleOrderError().message,
                      game: true,
                    });
                  }
                  return;
                }
                if (intents.every((intent) => this.intentTurns.get(intent) === turn)) {
                  await this.runAttempt(action, options, turn);
                }
              },
            },
          ],
        });
      } else {
        this.toast({ kind: 'error', text: message, game: intents.length > 0 });
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
    return {
      timezone: this.preferences.vigilTimezone ?? this.timezone(),
      vigilHourLocal: this.preferences.vigilHour,
    };
  }

  /**
   * "Jogar agora". `choice` é a dificuldade e o ritmo marcados nas boas-vindas; sem ela (as
   * opções não chegaram), o feudo nasce com os padrões do servidor.
   */
  playNow(
    displayName: string,
    settlementName: string,
    choice?: NewGameChoice,
    seed?: string,
  ): Promise<unknown> {
    const trimmedSeed = seed?.trim();
    return this.founding(async () => {
      const result = await this.account.playNow({
        displayName,
        settlementName,
        ...this.gameDefaults(),
        ...choice,
        ...(trimmedSeed ? { seed: trimmedSeed } : {}),
      });
      this.pendingSeed = null;
      this.openSeedField = false;
      return result;
    });
  }

  /** "Nova partida": arquiva o feudo atual e funda outro, com a dificuldade e o ritmo escolhidos. */
  startNewGame(settlementName: string, choice?: NewGameChoice, seed?: string): Promise<unknown> {
    const trimmedSeed = seed?.trim();
    return this.founding(async () => {
      const result = await this.account.startNewGame({
        settlementName,
        ...this.gameDefaults(),
        ...choice,
        ...(trimmedSeed ? { seed: trimmedSeed } : {}),
      });
      this.pendingSeed = null;
      this.openSeedField = false;
      if (this.fiefChoice === 'season') {
        this.fiefChoice = 'personal';
        await this.options.store.update(fiefChoiceKey(result.accountId), 'personal');
        this.enqueue(() => this.accountChanged(this.account.state));
      }
      return result;
    });
  }

  /** Funda um feudo marcando a interface como ocupada. */
  private async founding<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await this.whileBusy(operation);
    } catch (error) {
      if (describeError(error).code === 'VALIDATION') {
        // O servidor não aceita mais o que a tela ofereceu (o conteúdo mudou com a aba aberta):
        // as opções são lidas de novo, para a próxima tentativa partir do que vale agora.
        this.catalog = { status: 'idle' };
        void this.loadCatalog();
      }
      throw error;
    }
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
   *
   * A ordem é do feudo que estava aberto quando foi preparada. Se a partida ou a conta trocarem
   * antes do envio (um "Tentar de novo" que ficou para trás), ela não segue para o feudo novo:
   * o envio recusa com `StaleOrderError`, sem tocar a rede.
   */
  prepare<T extends CommandType>(
    type: T,
    payload: Extract<Command, { type: T }>['payload'],
  ): () => Promise<void> {
    const commandId = (this.options.randomUUID ?? randomUUID)();
    const command = { commandId, type, payload } as Command;
    const origin = this.gameOpening;
    const target = this.session.targetKey;
    return async () => {
      if (this.gameOpening !== origin || this.session.targetKey !== target) {
        throw new StaleOrderError();
      }
      await this.send(command);
    };
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
    return this.attempt(this.prepare(type, payload as never), {
      intents: intentsOf(type, payload),
    });
  }

  /**
   * Responde uma carta do Conselho (GDD §7). É o único caminho da resposta: o painel, a árvore e
   * a paleta chegam aqui por `lords.answerCard`. O `commandId` nasce uma vez, em `prepare`, e
   * "Tentar de novo", depois de uma falha de rede, reenvia a mesma ordem: a carta não é paga
   * nem resolvida duas vezes. Enquanto a resposta não volta, a carta fica em `answering` e um
   * segundo clique nela não vira ordem. A recusa do servidor (carta expirada, já respondida em
   * outra aba, opção trancada, falta de recursos) vira aviso com a frase dele, e a visão que
   * veio na recusa toma a tela: a carta que saiu da mesa some.
   */
  async answerCard(instanceId: string, optionId: string): Promise<boolean> {
    const send = this.prepare('answerCard', { instanceId, optionId });
    let answered = false;
    const options: AttemptOptions = {
      intents: intentsOf('answerCard', { instanceId, optionId }),
      busy: () => this.answering.has(instanceId),
    };
    const attempted = await this.attempt(async () => {
      answered = false;
      const opening = this.gameOpening;
      this.setAnswering(instanceId, true);
      try {
        await send();
        answered = true;
      } catch (error) {
        if (!isSessionLoss(error)) {
          throw error;
        }
        // A sessão acabou com a resposta a caminho. Quem cuida da conta já avisa que ela
        // terminou; aqui se diz o que foi feito da ordem, que nunca some em silêncio.
        this.toast({
          kind: 'warning',
          text: 'A sessão terminou antes de a resposta chegar ao conselho. A carta continua à espera: entre de novo para decidir.',
        });
      } finally {
        if (this.gameOpening === opening) this.setAnswering(instanceId, false);
      }
    }, options);
    return attempted && answered;
  }

  /**
   * Uma ordem da Guilda (contratar, dispensar, festival). É o único caminho delas: o painel, a
   * árvore e a paleta chegam aqui pelos comandos `lords.hireHero`, `lords.dismissHero` e
   * `lords.holdFestival`. O `commandId` nasce uma vez, em `prepare`: "Tentar de novo", depois de
   * uma falha de rede, reenvia a mesma ordem, e o herói não é contratado nem pago duas vezes.
   * Enquanto a resposta não volta, a ordem fica em `guildOrders` e um segundo acionamento dela
   * (o duplo clique) não vira ordem. A recusa do servidor vira aviso com a frase dele.
   *
   * Do Mercado, das caravanas e dos Mestres também (`trade`, `sendCaravan`, `assignMaster`): a
   * trava é por alvo (o recurso, o Mestre), e `where` diz a quem a ordem não chegou, se a sessão
   * acabar com ela a caminho.
   */
  private async guildOrder<T extends CommandType>(
    key: string,
    type: T,
    payload: Extract<Command, { type: T }>['payload'],
    where = 'à Guilda',
    stillValid?: () => boolean,
    invalidText?: string,
  ): Promise<boolean> {
    const options: AttemptOptions = {
      intents: intentsOf(type, payload),
      busy: () => this.guildOrders.has(key),
    };
    if (options.busy?.() === true) {
      // Antes de `prepare`: o acionamento que a trava segura não gasta um `commandId`.
      return false;
    }
    // O TypeScript não relaciona `T` entre duas funções genéricas; os tipos são os mesmos.
    const send = this.prepare(type, payload as never);
    let done = false;
    const attempted = await this.attempt(async () => {
      done = false;
      // A retentativa conserva o recibo, mas uma intenção com validade (como a decisão entre ondas
      // ou um orçamento conferido) avisa e não reenvia se o contexto já mudou.
      if (stillValid !== undefined && !stillValid()) {
        this.toast({
          kind: 'warning',
          text:
            invalidText ??
            'A ordem antiga já não é válida e não foi reenviada. Confira o estado atual.',
        });
        return;
      }
      const opening = this.gameOpening;
      this.setGuildOrder(key, true);
      try {
        await send();
        done = true;
      } catch (error) {
        if (!isSessionLoss(error)) {
          throw error;
        }
        // Quem cuida da conta já avisa que a sessão terminou; aqui se diz o que foi da ordem.
        this.toast({
          kind: 'warning',
          text: `A sessão terminou antes de a ordem chegar ${where}: nada foi feito. Entre de novo para repetir.`,
        });
      } finally {
        if (this.gameOpening === opening) this.setGuildOrder(key, false);
      }
    }, options);
    return attempted && done;
  }

  /** Contrata o candidato `offerId` da Taverna (GDD §9.1). */
  hireHero(offerId: string): Promise<boolean> {
    return this.guildOrder(`hire:${offerId}`, 'hireHero', { offerId });
  }

  /** Dispensa o herói `heroId`. Quem confirma com o jogador é o comando, antes de chegar aqui. */
  dismissHero(heroId: string): Promise<boolean> {
    return this.guildOrder(`dismiss:${heroId}`, 'dismissHero', { heroId });
  }

  /** Dá um festival na Taverna (ADR 0017, decisão 10). */
  holdFestival(): Promise<boolean> {
    return this.guildOrder('festival', 'holdFestival', {});
  }

  /**
   * Envia uma expedição (GDD §9.2): o destino, a equipe e a Postura que o comando
   * `lords.sendExpedition` juntou. A trava é a do destino: o duplo clique em "Enviar" não manda
   * duas equipes ao mesmo lugar.
   */
  sendExpedition(
    modelId: string,
    heroIds: string[],
    posture: Extract<Command, { type: 'sendExpedition' }>['payload']['posture'],
  ): Promise<boolean> {
    return this.guildOrder(`send:${modelId}`, 'sendExpedition', { modelId, heroIds, posture });
  }

  /**
   * Escolhe o caminho de uma expedição parada na encruzilhada. É o único caminho da escolha: o
   * painel, a árvore, o aviso, a aba Hoje e a paleta chegam aqui por
   * `lords.chooseExpeditionPath`. A trava é a da expedição: enquanto uma escolha está a caminho,
   * outra para a mesma encruzilhada não vira ordem. A recusa do servidor (o prazo acabou e a
   * Postura decidiu, ou outra aba escolheu) vira aviso com a frase dele, e a visão que veio na
   * recusa toma a tela: a encruzilhada que já foi decidida some.
   */
  chooseExpeditionPath(expeditionId: string, optionId: string): Promise<boolean> {
    return this.guildOrder(`path:${expeditionId}`, 'chooseExpeditionPath', {
      expeditionId,
      optionId,
    });
  }

  /** Equipa o herói com um item do arsenal; o espaço é o do item. */
  equipItem(heroId: string, itemId: string): Promise<boolean> {
    return this.guildOrder(`equipment:${heroId}`, 'equipItem', { heroId, itemId });
  }

  /** Devolve ao arsenal o que o herói leva em um espaço. */
  unequipItem(
    heroId: string,
    slot: Extract<Command, { type: 'unequipItem' }>['payload']['slot'],
  ): Promise<boolean> {
    return this.guildOrder(`equipment:${heroId}`, 'unequipItem', { heroId, slot });
  }

  /** Coloca uma relíquia do feudo na Capela; passa a valer na próxima virada de dia. */
  placeRelic(relicId: string): Promise<boolean> {
    const id = relicId as Extract<Command, { type: 'placeRelic' }>['payload']['relicId'];
    return this.guildOrder(`relic:${relicId}`, 'placeRelic', { relicId: id }, 'à Capela');
  }

  /** Retira uma relíquia colocada na Capela. */
  removeRelic(relicId: string): Promise<boolean> {
    const id = relicId as Extract<Command, { type: 'removeRelic' }>['payload']['relicId'];
    return this.guildOrder(`relic:${relicId}`, 'removeRelic', { relicId: id }, 'à Capela');
  }

  /** Reivindica um posto avançado no hexágono explorado (`claimOutpost`, V5F-T3). */
  claimOutpost(hex: string): Promise<boolean> {
    return this.guildOrder(`claimOutpost:${hex}`, 'claimOutpost', { hex }, 'ao Mapa');
  }

  /** Repara um posto avançado danificado (`repairOutpost`, V5F-T3). */
  repairOutpost(outpostId: string): Promise<boolean> {
    return this.guildOrder(`repairOutpost:${outpostId}`, 'repairOutpost', { outpostId }, 'ao Mapa');
  }

  /**
   * Compra ou vende no Mercado (GDD §5.9). `quoteDay` é o dia da cotação que o jogador conferiu:
   * se o dia virou, o servidor recusa com `PRICE_CHANGED` e a visão que vem na recusa traz o
   * preço novo; a tela pede a confirmação de novo, e nada é reenviado sozinho. A trava é a do
   * recurso: o duplo clique em "Vender" não vende duas vezes.
   */
  trade(
    resource: Extract<Command, { type: 'trade' }>['payload']['resource'],
    direction: Extract<Command, { type: 'trade' }>['payload']['direction'],
    amount: number,
    quoteDay: number,
  ): Promise<boolean> {
    return this.guildOrder(
      `trade:${resource}`,
      'trade',
      { resource, direction, amount, quoteDay },
      'ao Mercado',
    );
  }

  /** Manda uma caravana a vender longe (GDD §5.9), com o preço da cotação que o jogador viu. */
  sendCaravan(
    resource: Extract<Command, { type: 'sendCaravan' }>['payload']['resource'],
    amount: number,
    escortHeroId: string | null,
    quoteDay: number,
  ): Promise<boolean> {
    return this.guildOrder(
      `caravan:${resource}`,
      'sendCaravan',
      { resource, amount, escortHeroId, quoteDay },
      'ao Mercado',
    );
  }

  /** Põe um Mestre para trabalhar em um edifício, ou o deixa sem edifício (`building: null`). */
  assignMaster(
    masterId: string,
    building: Extract<Command, { type: 'assignMaster' }>['payload']['building'],
  ): Promise<boolean> {
    return this.guildOrder(
      `master:${masterId}`,
      'assignMaster',
      { masterId, building },
      'aos trabalhadores',
    );
  }

  /** Manda forjar um lote de armas (GDD §6.1). A trava é a da forja: um lote por vez. */
  forgeWeapons(amount: number): Promise<boolean> {
    return this.guildOrder('forge', 'forgeWeapons', { amount }, 'ao Ferreiro');
  }

  /** Cancela o lote em curso na forja: o servidor devolve a parte do custo que a visão diz. */
  cancelForge(): Promise<boolean> {
    return this.guildOrder('forge', 'cancelForge', {}, 'ao Ferreiro');
  }

  /**
   * Manda o Ferreiro refazer um item do arsenal. A trava é a da forja, a mesma do lote de armas:
   * a fila é uma só, e o reparo não se cancela.
   */
  repairItem(itemId: string): Promise<boolean> {
    return this.guildOrder('forge', 'repairItem', { itemId }, 'ao Ferreiro');
  }

  /**
   * Manda os pedreiros refazerem a muralha inteira (GDD §6.3): o custo e o prazo são os que a
   * visão mostrou na conferência. A trava é uma só, e o reparo não se cancela.
   */
  repairWall(): Promise<boolean> {
    return this.guildOrder('wall', 'repairWall', {}, 'aos pedreiros');
  }

  setBattlePlan(wave: 1 | 2 | 3, formationId: string | null): Promise<boolean> {
    const year = this.view?.siege?.year;
    return this.guildOrder(
      `siege:plan:${wave}`,
      'setBattlePlan',
      { wave, formationId },
      'ao Cerco',
      () =>
        this.view?.siege?.year === year &&
        this.view?.siege?.current === 0 &&
        this.view.siege.result === null &&
        this.view.siege.scheduledInSeconds > (this.now() - this.viewReceivedAt) / 1000,
      'O Cerco mudou ou o prazo acabou: a ordem antiga não foi reenviada. Confira a próxima onda.',
    );
  }

  /** A retentativa pertence ao mesmo embate e à oferta que foi conferida. */
  callMilitia(count: number): Promise<boolean> {
    const original = this.view?.siege?.militiaOffer;
    return this.guildOrder(
      'siege:militia',
      'callMilitia',
      { count },
      'à milícia',
      () => {
        const offer = this.view?.siege?.militiaOffer;
        return (
          original?.targetId != null &&
          offer?.targetId === original.targetId &&
          offer.canCall &&
          offer.maxCount === original.maxCount &&
          offer.termsText === original.termsText &&
          offer.untilInSeconds !== null &&
          offer.untilInSeconds > (this.now() - this.viewReceivedAt) / 1000
        );
      },
      'A oferta da milícia mudou ou o prazo acabou: confira de novo antes de convocar.',
    );
  }

  /**
   * `wave` é a onda da decisão que o jogador conferiu: vai na ordem, e o motor recusa se a onda
   * já foi lutada quando ela chega (revisão da Fase G). Outra onda na visão também não envia.
   */
  swapWaveFormation(wave: 1 | 2 | 3, formationId: string | null): Promise<boolean> {
    const decision = this.view === null ? undefined : waveDecision(this.view);
    return this.guildOrder(
      'siege:swap',
      'swapWaveFormation',
      { wave, formationId },
      'ao Cerco',
      () => decision?.wave === wave && this.sameWave(decision.id),
      'O Cerco mudou ou o prazo acabou: a ordem antiga não foi reenviada. Confira a próxima onda.',
    );
  }

  /** Reparo de emergência antes da onda `wave`, a da decisão conferida (como a troca). */
  emergencyRepair(wave: 1 | 2 | 3): Promise<boolean> {
    const view = this.view;
    const decision = view === null ? undefined : waveDecision(view);
    const quote =
      view === null || decision === undefined
        ? null
        : emergencySignature(decision, view.threat.defense.wall.repairOffer);
    return this.guildOrder(
      'wall',
      'emergencyRepair',
      { wave },
      'aos pedreiros',
      () => {
        const now = this.view;
        const current = now === null ? undefined : waveDecision(now);
        return (
          decision?.wave === wave &&
          this.sameWave(decision.id) &&
          now !== null &&
          current !== undefined &&
          emergencySignature(current, now.threat.defense.wall.repairOffer) === quote
        );
      },
      'O Cerco mudou ou o prazo acabou: a ordem antiga não foi reenviada. Confira a próxima onda.',
    );
  }

  private sameWave(id: string | undefined): boolean {
    const current = this.view === null ? undefined : waveDecision(this.view);
    return (
      id !== undefined &&
      current?.id === id &&
      current.expiresInSeconds > (this.now() - this.viewReceivedAt) / 1000
    );
  }

  /**
   * Manda treinar um lote de soldados no Quartel (GDD §10.2). A trava é a do treino, e o treino e
   * o cancelamento dividem a intenção (`intentOf`): é um lote por vez.
   */
  trainSoldiers(
    unit: Extract<Command, { type: 'trainSoldiers' }>['payload']['unit'],
    amount: number,
  ): Promise<boolean> {
    return this.guildOrder('train', 'trainSoldiers', { unit, amount }, 'ao Quartel');
  }

  /** Cancela o lote em treino: o servidor devolve a parte do custo que a visão diz. */
  cancelTraining(lotKey: string): Promise<boolean> {
    return this.guildOrder('train', 'cancelTraining', { lotKey }, 'ao Quartel');
  }

  /** Dispensa soldados de uma unidade: voltam a ser aldeões. A trava é por unidade. */
  disbandSoldiers(
    unit: Extract<Command, { type: 'disbandSoldiers' }>['payload']['unit'],
    amount: number,
  ): Promise<boolean> {
    return this.guildOrder(`disband:${unit}`, 'disbandSoldiers', { unit, amount }, 'ao Quartel');
  }

  /** Salva uma formação (nova, com `id: null`, ou a existente): a ordem nasce em "Salvar". */
  saveFormation(payload: Extract<Command, { type: 'saveFormation' }>['payload']): Promise<boolean> {
    return this.guildOrder(
      `formation:${payload.id ?? 'new'}`,
      'saveFormation',
      payload,
      'ao Exército',
    );
  }

  /** Apaga uma formação salva. */
  deleteFormation(id: string): Promise<boolean> {
    return this.guildOrder(`formation:${id}`, 'deleteFormation', { id }, 'ao Exército');
  }

  /** Pede a prévia do Conselho de Guerra para uma formação salva; a trava é `preview:<formação>`. */
  simulateBattle(formationId: string, siegeWave?: 1 | 2 | 3): Promise<boolean> {
    return this.guildOrder(
      `preview:${formationId}`,
      'simulateBattle',
      { formationId, ...(siegeWave === undefined ? {} : { siegeWave }) },
      'ao Exército',
    );
  }

  /** Ataca o Acampamento de Saqueadores com uma formação salva; a trava é `campaign`. */
  attackCamp(formationId: string): Promise<boolean> {
    return this.guildOrder('campaign', 'attackCamp', { formationId }, 'ao Exército');
  }

  /** Põe uma formação como a Defesa ativa (`null` tira a Defesa). */
  setActiveFormation(id: string | null): Promise<boolean> {
    return this.guildOrder('formation:active', 'setActiveFormation', { id }, 'ao Exército');
  }

  /** Firma os Votos do ano (ou fecha a janela sem Votos); a trava é `vows`. */
  takeVows(vows: Extract<Command, { type: 'takeVows' }>['payload']['vows']): Promise<boolean> {
    const originSig =
      this.view === null ? null : vowsReviewSignature(vowsOf(this.view).offer, vows as VowId[]);
    return this.guildOrder(
      'vows',
      'takeVows',
      { vows },
      'aos Votos',
      () =>
        this.view !== null &&
        originSig !== null &&
        this.view.vows.closesInSeconds > (this.now() - this.viewReceivedAt) / 1000 &&
        vowsReviewSignature(vowsOf(this.view).offer, vows as VowId[]) === originSig,
      'A janela de Votos mudou ou já fechou: a ordem antiga não foi reenviada.',
    );
  }

  /**
   * O relatório de expedição que o jogador pediu para ver (a linha da Crônica, o aviso da volta):
   * a aba Guilda o mostra aberto. Não é estado do jogo: só diz à aba qual folha abrir.
   */
  showReport(expeditionId: string): void {
    this.navigate('guild');
    this.reportAsked = { expeditionId, newestThen: this.newestReport() };
    this.changes.emit();
  }

  private newestReport(): string | null {
    return this.view?.guild.reports[0]?.expeditionId ?? null;
  }

  /**
   * O relatório de expedição que a aba Guilda mostra aberto, a pedido do jogador. O pedido vale
   * enquanto o relatório mais novo for o mesmo de quando ele foi feito e o jogador não sair da
   * aba: quando outra jornada volta, é o relatório dela que vem aberto, como sem pedido nenhum.
   */
  get reportInFocus(): string | null {
    const asked = this.reportAsked;
    return asked !== null && asked.newestThen === this.newestReport() ? asked.expeditionId : null;
  }

  private setGuildOrder(key: string, busy: boolean): void {
    const next = new Set(this.guildOrders);
    if (busy) {
      next.add(key);
    } else {
      next.delete(key);
    }
    this.guildOrders = next;
    this.changes.emit();
  }

  private setAnswering(instanceId: string, busy: boolean): void {
    const next = new Set(this.answering);
    if (busy) {
      next.add(instanceId);
    } else {
      next.delete(instanceId);
    }
    this.answering = next;
    this.changes.emit();
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
    const next = { ...this.preferences, ...patch };
    if (
      (patch.vigilHour !== undefined || patch.vigilTimezone !== undefined) &&
      this.session.gameId !== null
    ) {
      const accepted = await this.order('setVigilHour', {
        hourLocal: patch.vigilHour ?? this.view?.settlement.vigil.hourLocal ?? next.vigilHour,
        timezone:
          patch.vigilTimezone ??
          this.view?.settlement.vigil.timezone ??
          next.vigilTimezone ??
          this.timezone(),
      });
      if (!accepted) return;
    }
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
    this.dropGameToasts();
    return this.setPreferences({ mutedUntil: this.now() + MUTE_DURATION_MS });
  }

  async selectChronicleYear(year: number | null): Promise<void> {
    this.selectedChronicleYear = year;
    this.yearChronicleRequest += 1;
    this.yearChronicleDocument = { status: 'idle' };
    this.changes.emit();
    if (year !== null) await this.loadYearChronicle(year);
  }

  async loadYearChronicle(year: number): Promise<string | null> {
    const gameId = this.session.gameId;
    if (gameId === null) return null;
    const request = ++this.yearChronicleRequest;
    this.selectedChronicleYear = year;
    this.yearChronicleDocument = { status: 'loading' };
    this.changes.emit();
    const current = () => this.session.gameId === gameId && this.yearChronicleRequest === request;
    try {
      const markdown = await this.client.getYearChronicleMarkdown(gameId, year);
      if (!current()) return null;
      this.yearChronicleDocument = { status: 'ready', value: markdown };
      this.changes.emit();
      return markdown;
    } catch (error) {
      if (!current()) return null;
      this.yearChronicleDocument = {
        status: 'error',
        message:
          error instanceof ApiClientError && error.status === 404
            ? 'A Crônica deste ano ainda não foi registrada. Escolha outro ano ou tente após o encerramento.'
            : describeError(error).message,
      };
      this.changes.emit();
      return null;
    }
  }

  /**
   * Lê a Crônica inteira em Markdown, para a aba Crônica e para o download. O documento vem com
   * a marca de expedição em cada linha que tem uma (`links`): é por ela que a aba liga a linha
   * ao relatório. Quem baixa o arquivo tira as marcas antes (`stripChronicleLinks`).
   */
  async loadChronicle(): Promise<string | null> {
    const gameId = this.session.gameId;
    const opening = this.gameOpening;
    if (gameId === null) {
      this.chronicleDocument = { status: 'idle' };
      return null;
    }
    if (this.chronicleDocument.status !== 'ready') {
      this.chronicleDocument = { status: 'loading' };
      this.changes.emit();
    }
    try {
      const markdown = await this.client.getChronicleMarkdown(gameId, { links: true });
      if (this.gameOpening !== opening || this.session.gameId !== gameId) {
        // O jogador saiu ou trocou de feudo enquanto a Crônica vinha: ela não é mais a dele.
        return null;
      }
      this.chronicleDocument = { status: 'ready', value: markdown };
      this.changes.emit();
      return markdown;
    } catch (error) {
      if (this.gameOpening !== opening || this.session.gameId !== gameId) {
        return null;
      }
      this.chronicleDocument = { status: 'error', message: describeError(error).message };
      this.changes.emit();
      return null;
    }
  }

  /**
   * Lê as opções de nova partida (`GET /catalog`), uma vez. Nunca lança: uma falha só deixa as
   * boas-vindas sem as opções. A resposta é sempre conferida com o schema, mesmo em produção: é
   * ela que decide o que a tela oferece e o que vai no corpo de `POST /games`.
   */
  loadCatalog(): Promise<void> {
    if (this.catalog.status === 'ready') {
      return Promise.resolve();
    }
    this.catalogRequest ??= this.fetchCatalog().finally(() => {
      this.catalogRequest = null;
    });
    return this.catalogRequest;
  }

  private async fetchCatalog(): Promise<void> {
    this.catalog = { status: 'loading' };
    this.changes.emit();
    try {
      const parsed = CatalogResponseSchema.safeParse(await this.client.catalog());
      this.catalog = parsed.success
        ? { status: 'ready', value: parsed.data.newGame }
        : {
            status: 'error',
            message: 'O servidor mandou opções de partida em um formato que este app não conhece.',
          };
    } catch (error) {
      this.catalog = { status: 'error', message: describeError(error).message };
    }
    if (this.catalog.status === 'error') {
      this.log(`Opções de nova partida indisponíveis: ${this.catalog.message}`);
    }
    this.changes.emit();
  }

  /** As opções de nova partida, se já chegaram. */
  get newGameOptions(): NewGameOptions | null {
    return this.catalog.status === 'ready' ? this.catalog.value : null;
  }

  /** Legado acumulado da conta; `0` sem conta, `null` enquanto ainda não foi lido. */
  get accountLegacy(): number | null {
    if (this.account.state.kind === 'signedOut') {
      return 0;
    }
    return this.stats.status === 'ready' ? this.stats.value.me.legacy : null;
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

  private seasonDeadline(): number {
    if (this.currentSeason.status !== 'ready') return Number.POSITIVE_INFINITY;
    const { season } = this.currentSeason.value;
    if (season.status === 'closed' || (this.route !== 'kingdom' && this.seasonFief === null)) {
      return Number.POSITIVE_INFINITY;
    }
    const ends = Date.parse(season.endsAt);
    const joinEnds = Date.parse(season.joinEndsAt);
    const now = this.now();
    if (this.route === 'kingdom' && season.joinOpen && joinEnds > now) return joinEnds;
    return ends > now ? ends : Number.POSITIVE_INFINITY;
  }

  private clearSeasonTimer(): void {
    if (this.seasonTimer !== null) {
      clearTimeout(this.seasonTimer);
      this.seasonTimer = null;
    }
  }

  private refreshSeasonIfNeeded(): void {
    if (!this.visible || this.account.state.kind === 'signedOut') return;
    const current = this.currentSeason.status === 'ready' ? this.currentSeason.value.season : null;
    if (
      this.route === 'kingdom' ||
      (this.seasonFief !== null && (current === null || this.now() >= Date.parse(current.endsAt)))
    ) {
      void this.loadSeason();
    }
  }

  loadSeason(): Promise<void> {
    const account = this.account.state;
    if (account.kind === 'signedOut') return Promise.resolve();
    if (this.seasonRead !== null) return this.seasonRead;
    this.clearSeasonTimer();
    const opening = this.accountOpening;
    const read = this.readSeason(account.accountId, opening).finally(() => {
      if (this.seasonRead !== read) return;
      this.seasonRead = null;
      this.session.deadlineChanged();
      // O Reino também abre para quem ainda não tem feudo, sem ciclo de /view.
      if (this.visible && this.route === 'kingdom' && this.session.gameId === null) {
        const delay = Math.max(
          2000,
          Math.min(pollIntervalMs(true), this.seasonDeadline() - this.now() + 1000),
        );
        this.seasonTimer = setTimeout(() => this.refreshSeasonIfNeeded(), delay);
        (this.seasonTimer as { unref?: () => void }).unref?.();
      }
    });
    this.seasonRead = read;
    return read;
  }

  private async readSeason(accountId: string, opening: number): Promise<void> {
    const stillHere = () => {
      const account = this.account.state;
      return (
        this.accountOpening === opening &&
        account.kind !== 'signedOut' &&
        account.accountId === accountId
      );
    };
    if (this.currentSeason.status !== 'ready') {
      this.currentSeason = { status: 'loading' };
      this.changes.emit();
    }
    let value: CurrentSeasonResponse;
    try {
      value = await this.client.getCurrentSeason();
    } catch (error) {
      if (stillHere() && this.currentSeason.status !== 'ready') {
        this.currentSeason = {
          status: 'error',
          message:
            error instanceof ApiClientError && error.status === 404
              ? 'As Temporadas ainda não chegaram a este reino.'
              : describeError(error).message,
        };
        this.changes.emit();
      }
      return;
    }
    if (!stillHere()) return;
    const old = this.currentSeason.status === 'ready' ? this.currentSeason.value.season : null;
    this.currentSeason = { status: 'ready', value };
    if (old !== null && old.id !== value.season.id) {
      this.seasonJoinError = null;
      this.seasonChronicle = null;
    }
    if (value.game !== null) await this.account.rememberSeasonGame(accountId, value.game);
    if (!stillHere()) return;
    if (this.session.gameId !== (this.targetOf(this.account.state)?.gameId ?? null)) {
      this.enqueue(() => this.accountChanged(this.account.state));
    }
    this.changes.emit();

    const { season } = value;
    const key = seasonHistoryKey(accountId);
    const history = this.options.store.get<SeasonHistory>(key);
    const latest = { id: season.id, at: season.startsAt };
    const previous = history?.latest?.id === latest.id ? history.previous : history?.latest;
    const published = history?.published;
    const remembered: SeasonHistory = {
      latest,
      ...(previous === undefined ? {} : { previous }),
      ...(published === undefined ? {} : { published }),
    };
    if (history?.latest?.id !== latest.id) await this.options.store.update(key, remembered);
    if (!stillHere() || this.route !== 'kingdom') return;
    if (this.catalog.status === 'idle') void this.loadCatalog();

    const state = this.account.state;
    const known = state.kind === 'signedOut' ? [] : (state.seasonGames ?? []);
    const candidates =
      season.status === 'closed'
        ? [latest]
        : [
            ...(previous === undefined ? [] : [previous]),
            ...(published === undefined ? [] : [published]),
            ...known.map((game) => ({ id: game.seasonId, at: game.createdAt })),
          ]
            .filter((item) => item.id !== latest.id && Date.parse(item.at) < Date.parse(latest.at))
            .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
    if (candidates.length === 0) {
      this.seasonRanking = { status: 'idle' };
      this.changes.emit();
      return;
    }
    if (
      this.seasonRanking.status !== 'ready' ||
      (season.status === 'closed' && this.seasonRanking.value.season.id !== season.id)
    ) {
      this.seasonRanking = { status: 'loading' };
      this.changes.emit();
    }
    try {
      for (const id of new Set(candidates.map((item) => item.id))) {
        const ranking = await this.client.getLeaderboard(id);
        if (!stillHere()) return;
        if (ranking.published) {
          this.seasonRanking = { status: 'ready', value: ranking };
          if (published?.id !== id) {
            await this.options.store.update(key, {
              ...remembered,
              published: { id, at: ranking.season.startsAt },
            });
          }
          if (!stillHere()) return;
          this.changes.emit();
          return;
        }
      }
      if (stillHere()) this.seasonRanking = { status: 'idle' };
    } catch (error) {
      if (!stillHere()) return;
      this.seasonRanking = { status: 'error', message: describeError(error).message };
    }
    this.changes.emit();
  }

  async joinSeason(seasonId: string, settlementName: string): Promise<void> {
    const state = this.account.state;
    const opening = this.accountOpening;
    if (state.kind === 'signedOut' || this.joiningSeason) return;
    this.joiningSeason = true;
    this.seasonJoinError = null;
    this.changes.emit();
    const stillHere = () => {
      const account = this.account.state;
      return (
        this.accountOpening === opening &&
        account.kind !== 'signedOut' &&
        account.accountId === state.accountId
      );
    };
    try {
      await this.loadSeason();
      if (!stillHere()) return;
      if (
        this.currentSeason.status !== 'ready' ||
        this.currentSeason.value.season.id !== seasonId
      ) {
        this.seasonJoinError = 'A semana mudou. Confira a Temporada antes de entrar.';
        return;
      }
      const current = this.currentSeason.value;
      if (current.joined) {
        this.seasonJoinError = 'Você já tem um feudo nesta Temporada.';
        return;
      }
      if (!current.season.joinOpen) {
        this.seasonJoinError =
          current.season.status === 'closed'
            ? 'Esta Temporada já terminou.'
            : 'As inscrições desta Temporada foram encerradas.';
        return;
      }
      const { game } = await this.client.joinCurrentSeason({
        settlementName: settlementName.trim(),
        ...this.gameDefaults(),
      });
      if (!stillHere()) return;
      this.fiefChoice = 'season';
      await this.options.store.update(fiefChoiceKey(state.accountId), 'season');
      if (!stillHere()) return;
      await this.account.rememberSeasonGame(state.accountId, game);
      await this.settled();
      if (stillHere()) this.navigate('fief');
    } catch (error) {
      if (!stillHere()) return;
      const { code, message } = describeError(error);
      const details = error instanceof ApiClientError ? error.details : null;
      const reason =
        typeof details === 'object' && details !== null && 'reason' in details
          ? details.reason
          : code;
      this.seasonJoinError =
        reason === 'SEASON_JOIN_CLOSED'
          ? 'As inscrições desta Temporada foram encerradas.'
          : reason === 'SEASON_CLOSED'
            ? 'Esta Temporada já terminou.'
            : code === 'ACTIVE_GAME_EXISTS'
              ? 'Você já tem um feudo nesta Temporada.'
              : message;
    } finally {
      if (stillHere()) {
        this.joiningSeason = false;
        this.changes.emit();
        void this.loadSeason();
      }
    }
  }

  async openSeasonChronicle(position: number): Promise<void> {
    if (this.route !== 'kingdom' || this.seasonRanking.status !== 'ready') return;
    const ranking = this.seasonRanking.value;
    const entry = ranking.entries.find(
      (row) => row.position === position && row.chronicleAvailable,
    );
    if (entry === undefined) return;
    const selected = {
      seasonId: ranking.season.id,
      position,
      name: entry.settlementName,
      document: { status: 'loading' } as Loadable<SeasonChronicleResponse>,
    };
    this.seasonChronicle = selected;
    this.changes.emit();
    try {
      const value = await this.client.getSeasonChronicle(selected.seasonId, position);
      selected.document = { status: 'ready', value };
    } catch (error) {
      const status = error instanceof ApiClientError ? error.status : null;
      selected.document = {
        status: 'error',
        message:
          status === 403
            ? 'Só quem disputou esta Temporada pode ler suas Crônicas.'
            : status === 404
              ? 'A Crônica deste feudo não está mais disponível nesta posição.'
              : describeError(error).message,
      };
    }
    if (this.seasonChronicle === selected) this.changes.emit();
  }

  closeSeasonChronicle(): void {
    this.seasonChronicle = null;
    this.changes.emit();
  }

  // --- Reino: estatísticas e ranking (ADR 0021) ------------------------------------

  /**
   * Com a aba Reino aberta e à vista, a leitura de `/stats` acompanha o ciclo das leituras do
   * feudo, no máximo uma vez por minuto (o servidor guarda a consulta pelo mesmo minuto). Fora
   * dela, nada é lido.
   */
  private refreshStatsIfShown(): void {
    if (
      this.route === 'kingdom' &&
      this.visible &&
      this.now() - this.statsReadAt >= STATS_EVERY_MS
    ) {
      void this.loadStats();
    }
  }

  /** Lê os totais do reino, o ranking e o que é do jogador. `force` ignora o minuto. */
  async loadStats(force = false): Promise<void> {
    if (this.account.state.kind === 'signedOut' || this.stats.status === 'loading') {
      return;
    }
    if (!force && this.stats.status === 'ready' && this.now() - this.statsReadAt < STATS_EVERY_MS) {
      return;
    }
    this.statsReadAt = this.now();
    if (this.stats.status !== 'ready') {
      this.stats = { status: 'loading' };
      this.changes.emit();
    }
    try {
      const value = await this.client.getStats();
      this.stats = { status: 'ready', value };
      this.rankingListed = value.me.listed;
    } catch (error) {
      if (this.stats.status !== 'ready') {
        this.stats = { status: 'error', message: describeError(error).message };
      }
    }
    this.changes.emit();
  }

  /** Lê se a conta está no ranking, para a opção das Preferências. */
  async loadRankingPreference(): Promise<void> {
    if (this.account.state.kind === 'signedOut' || this.rankingSaving) {
      return;
    }
    try {
      const { listed } = await this.client.getRankingPreference();
      if (!this.rankingSaving) {
        this.rankingListed = listed;
        this.changes.emit();
      }
    } catch (error) {
      this.log(`Preferência do ranking não lida: ${describeError(error).message}`);
    }
  }

  /**
   * Sai do ranking de ouro ou volta a ele. Vale para todos os feudos da conta, na hora; o
   * Reino aberto lê de novo para mostrar a lista sem o feudo.
   */
  async setRankingListed(listed: boolean): Promise<void> {
    if (this.account.state.kind === 'signedOut' || this.rankingSaving) {
      return;
    }
    const before = this.rankingListed;
    this.rankingSaving = true;
    this.rankingListed = listed;
    this.changes.emit();
    try {
      const saved = await this.client.setRankingListed(listed);
      this.rankingListed = saved.listed;
      this.toast({
        kind: 'info',
        text: saved.listed
          ? 'Seu feudo voltou ao ranking de ouro.'
          : 'Seu feudo saiu do ranking de ouro. Os totais do reino continuam anônimos.',
      });
    } catch (error) {
      this.rankingListed = before;
      this.toast({
        kind: 'error',
        text: `Não deu para mudar o ranking: ${describeError(error).message}`,
      });
    } finally {
      this.rankingSaving = false;
      this.changes.emit();
    }
    if (this.stats.status === 'ready' || this.route === 'kingdom') {
      await this.loadStats(true);
    }
  }
}
