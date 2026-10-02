import { ApiClientError, type Client, isGameRuleError, NetworkError } from '@lotg/client-sdk';
import {
  type Command,
  type GameEvent,
  GameEventSchema,
  PROTOCOL_VERSION,
  type ReturnReport,
  type ViewState,
  ViewStateSchema,
} from '@lotg/protocol';

import { Emitter, type KeyValueStore } from '../services/store';
import { type Connection, pollIntervalMs, retryDelayMs } from './connection';
import { buildReturnReport, shouldShowReturnReport } from './returnReport';

/**
 * Formato da visão guardada. Sobe quando o `ViewState` muda de forma ou de sentido sem o
 * protocolo mudar: o schema pega a forma, mas não um campo que manteve o nome e passou a dizer
 * outra coisa. O cache da v0.1 não tinha marca; 2 é a visão com dificuldade e ritmo (V2B-T3).
 */
const VIEW_FORMAT = 2;

/**
 * A marca de versão gravada no cache: protocolo e formato da visão. Um cache com outra marca,
 * ou sem marca, foi gravado por outra versão do app e a visão dele não é exibida.
 */
export const CACHE_VERSION = `${PROTOCOL_VERSION}.${VIEW_FORMAT}`;

/**
 * Uma ausência com a aba aberta (roadmap da v0.2, V2D-T4.4): a aba saiu de vista em `since` e
 * o ciclo continuou lendo o servidor em segundo plano. `view` é a visão que correspondia ao
 * cursor naquele instante (`null` se não havia nenhuma) e `events`, o que chegou desde então. É
 * de onde sai o Relatório de Retorno de quem volta a uma aba que nunca fechou.
 */
export type Away = { since: number; view: ViewState | null; events: GameEvent[] };

/** O que fica guardado no navegador para exibir o feudo sem conexão. */
export type GameCache = {
  /** `CACHE_VERSION` de quem gravou. */
  version: string;
  view: ViewState;
  stateVersion: string;
  etag: string | null;
  /** Cursor dos eventos já entregues: evita notificar duas vezes o mesmo acontecimento. */
  lastSeq: number;
  /**
   * Só existe enquanto `view` está **à frente do cursor**: a visão chegou (de uma leitura ou da
   * resposta de uma ordem) e os eventos que levam até ela ainda não foram lidos. Guarda a última
   * visão que correspondia a `lastSeq`, ou `null` se não há nenhuma. É de onde o Relatório de
   * Retorno parte: comparar `view` com os eventos desde `lastSeq` contaria duas vezes o que ela
   * já traz (o custo de uma obra, descontado do estoque e somado de novo como gasto). Some
   * quando os eventos são lidos e a visão e o cursor voltam a andar juntos.
   */
  behind?: ViewState | null;
  /** Última vez em que o estado foi lido do servidor, em ms. */
  lastSeenAt: number;
  /**
   * Só existe enquanto a aba está fora de vista. Vai para o cache porque o navegador pode
   * descartar uma aba em segundo plano e recarregá-la na volta: sem isto, a última leitura em
   * segundo plano passaria por "última visita", e a noite inteira sumiria do relatório.
   */
  away?: Away;
  /**
   * Última vez em que uma aba **à vista** gravou este cache. As abas do mesmo navegador dividem
   * o cache: se outra esteve à vista depois de esta sair de vista, o jogador não esteve fora, e
   * a ausência desta não vira relatório.
   */
  attendedAt?: number;
  /**
   * A virada de estação que o aviso de uma hora antes já anunciou ("1:winter"): como o cursor
   * dos eventos, evita avisar duas vezes a mesma coisa, mesmo recarregando a página.
   */
  seasonWarned?: string | null;
};

export type SessionTarget = { serverKey: string; accountId: string; gameId: string };

/** Mesmo com um prazo vencendo, o app não lê o servidor mais de uma vez a cada dois segundos. */
const MIN_POLL_MS = 2000;

/** O cache é separado por servidor, conta e partida: nunca se mostra o feudo de outra conta. */
export function cacheKey(target: SessionTarget): string {
  return `lords.cache:${target.serverKey}:${target.accountId}:${target.gameId}`;
}

/** Prefixo das chaves de cache de todas as partidas de uma conta em um servidor. */
export function accountCachePrefix(serverKey: string, accountId: string): string {
  return `lords.cache:${serverKey}:${accountId}:`;
}

/**
 * Apaga o que esta máquina guardou de todas as partidas de uma conta, inclusive as arquivadas.
 * Sair, excluir a conta e perder a sessão passam por aqui: nenhum progresso fica para trás.
 */
export async function clearAccountCaches(
  store: KeyValueStore,
  serverKey: string,
  accountId: string,
): Promise<void> {
  const prefix = accountCachePrefix(serverKey, accountId);
  for (const key of store.keys().filter((entry) => entry.startsWith(prefix))) {
    await store.update(key, undefined);
  }
}

/**
 * Lê o cache e confere a marca de versão e a forma da visão. Um cache gravado por outra versão
 * do app (marca diferente ou ausente, ou outro formato de `ViewState`) perde a visão em vez de
 * quebrar a árvore e as abas, mas o cursor dos eventos e o instante da última visita continuam
 * valendo: sem o cursor, a partida inteira voltaria como "novidade" depois de cada atualização
 * do jogo; sem o instante, quem volta depois de horas não teria Relatório de Retorno e receberia
 * a ausência em avisos avulsos. A primeira leitura do servidor grava por cima, já com a marca
 * atual.
 *
 * `reportBase` é a visão de onde o Relatório de Retorno parte: a que corresponde ao cursor. Em
 * regra é a própria visão guardada; quando ela ficou à frente do cursor (`behind`), é a que foi
 * guardada ao lado, e `null` se não há nenhuma que sirva.
 */
function loadCache(
  store: KeyValueStore,
  target: SessionTarget,
): {
  cache: GameCache | null;
  reportBase: ViewState | null;
  lastSeq: number | null;
  lastSeenAt: number | null;
  seasonWarned: string | null;
  away: Away | null;
} {
  const stored = store.get<Partial<GameCache>>(cacheKey(target));
  // A ausência com a aba aberta é lida à parte e não fica no cache em memória: quem a regrava é
  // a sessão, enquanto ela durar. Como o cursor, vale mesmo quando a visão é descartada. Se uma
  // aba esteve à vista depois de ela começar, o jogador não esteve fora: não vale.
  const left = loadAway(stored?.away);
  const away = left !== null && attendedAtOf(stored) <= left.since ? left : null;
  const cached = stored === undefined ? undefined : { ...stored };
  delete cached?.away;
  // Como o cursor, a marca do aviso de estação vale mesmo quando a visão é descartada.
  const seasonWarned = typeof cached?.seasonWarned === 'string' ? cached.seasonWarned : null;
  const lastSeq =
    typeof cached?.lastSeq === 'number' && cached.lastSeq >= 0 ? cached.lastSeq : null;
  const lastSeenAt = typeof cached?.lastSeenAt === 'number' ? cached.lastSeenAt : null;
  const valid =
    cached !== undefined &&
    cached.version === CACHE_VERSION &&
    lastSeq !== null &&
    lastSeenAt !== null &&
    typeof cached.stateVersion === 'string' &&
    ViewStateSchema.safeParse(cached.view).success;
  if (!valid) {
    return { cache: null, reportBase: null, lastSeq, lastSeenAt, seasonWarned, away };
  }
  const cache = cached as GameCache;
  if (cache.behind === undefined) {
    return { cache, reportBase: cache.view, lastSeq, lastSeenAt, seasonWarned, away };
  }
  // A visão guardada está à frente do cursor. A base em outro formato vira "nenhuma", também
  // na memória: é o que o relatório pode usar.
  const behind = ViewStateSchema.safeParse(cache.behind);
  const reportBase = behind.success ? cache.behind : null;
  return {
    cache: { ...cache, behind: reportBase },
    reportBase,
    lastSeq,
    lastSeenAt,
    seasonWarned,
    away,
  };
}

/** Última vez em que uma aba à vista gravou o cache; 0 se nenhuma gravou. */
function attendedAtOf(stored: Partial<GameCache> | undefined): number {
  return typeof stored?.attendedAt === 'number' ? stored.attendedAt : 0;
}

/**
 * A ausência com a aba aberta que o cache guardou, conferida: o instante e os eventos têm de ter
 * a forma certa, ou ela não vale. A visão em outro formato vira "nenhuma", como a do relatório
 * comum: a ausência é a mesma, só não há estoques a comparar.
 */
function loadAway(stored: unknown): Away | null {
  if (typeof stored !== 'object' || stored === null) {
    return null;
  }
  const { since, view, events } = stored as Partial<Away>;
  const parsed = GameEventSchema.array().safeParse(events);
  if (typeof since !== 'number' || !parsed.success) {
    return null;
  }
  return {
    since,
    view: ViewStateSchema.safeParse(view).success ? (view as ViewState) : null,
    events: parsed.data,
  };
}

/** O mesmo cache com a visão e o cursor andando juntos: sem a base guardada ao lado. */
function settled(cache: GameCache): GameCache {
  const next = { ...cache };
  delete next.behind;
  return next;
}

/**
 * A API disse que a sessão acabou. Um 401 sem o corpo de erro da API (proxy, portal cativo)
 * não conta: o SDK guarda as credenciais nesse caso, e apagar a conta local aqui deixaria uma
 * conta anônima sem volta.
 */
export function isSessionLoss(error: unknown): boolean {
  return (
    error instanceof ApiClientError &&
    error.status === 401 &&
    (error.code === 'UNAUTHORIZED' || error.code === 'SESSION_REVOKED')
  );
}

/** O comando não foi enviado porque não há ligação com o servidor. Nada fica em fila. */
export class OfflineError extends Error {
  constructor() {
    super('Sem ligação com o reino. Sua ordem não foi enviada; tente quando a ligação voltar.');
    this.name = 'OfflineError';
  }
}

/**
 * A partida aberta nesta máquina: ciclo de atualização, cache para o modo sem conexão e envio
 * de comandos (GDD §14.10). Não conhece o navegador; usa só temporizadores e o `client-sdk`.
 */
export class GameSession {
  private target: SessionTarget | null = null;
  private cache: GameCache | null = null;
  private connectionState: Connection = { kind: 'online' };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private visible = false;
  private syncing: Promise<void> | null = null;
  private generation = 0;
  /** Conta as visões adotadas de comandos: uma leitura iniciada antes não pode sobrescrevê-las. */
  private adoptions = 0;
  /** Cursor guardado de uma visita anterior, quando a visão do cache não pôde ser aproveitada. */
  private resumeSeq: number | null = null;
  /** A primeira leitura de uma partida sem cursor: os eventos dela são história, não novidade. */
  private seeding = false;
  /** A visão à vista veio do servidor nesta abertura, e não do que estava guardado. */
  private fresh = false;
  /** A virada de estação já anunciada pelo aviso de uma hora antes; ver `GameCache`. */
  private seasonMark: string | null = null;
  /**
   * O que se sabia antes desta abertura, enquanto o Relatório de Retorno ainda não saiu. `view`
   * é a visão que corresponde ao cursor guardado (`loadCache`). É nula quando não há nenhuma: a
   * visão guardada era de outra versão do app, ou estava à frente do cursor sem outra que
   * servisse. A ausência é a mesma, só não há estoques a comparar.
   */
  private baseline: { view: ViewState | null; lastSeenAt: number; events: GameEvent[] } | null =
    null;
  /** A aba está fora de vista: desde quando, e o que chegou desde então. Ver `Away`. */
  private away: Away | null = null;
  /** O relatório que está para sair é o de uma aba que ficou aberta, e não o de uma reabertura. */
  private stayedOpen = false;

  private readonly viewChanges = new Emitter<ViewState>();
  private readonly eventBatches = new Emitter<GameEvent[]>();
  private readonly connectionChanges = new Emitter<Connection>();
  private readonly reports = new Emitter<ReturnReport>();
  private readonly openTabReports = new Emitter<ReturnReport>();
  private readonly problems = new Emitter<unknown>();
  readonly onView = this.viewChanges.on;
  /** Eventos novos, cada um entregue uma única vez. */
  readonly onEvents = this.eventBatches.on;
  readonly onConnection = this.connectionChanges.on;
  readonly onReturnReport = this.reports.on;
  /**
   * O Relatório de Retorno de quem voltou a uma aba que ficou aberta e fora de vista por 4 horas
   * ou mais. Sai à parte do de quem reabre a página: aqui o jogador já estava em uma aba do app,
   * e quem escuta decide se o leva à aba Hoje ou só avisa.
   */
  readonly onReturnWhileOpen = this.openTabReports.on;
  /** O servidor recusou o ciclo por algo que não é rede nem sessão (partida arquivada, 426…). */
  readonly onProblem = this.problems.on;

  constructor(
    private readonly deps: { client: Client; store: KeyValueStore; now?: () => number },
  ) {}

  private now(): number {
    return this.deps.now?.() ?? Date.now();
  }

  get view(): ViewState | null {
    return this.cache?.view ?? null;
  }

  get stateVersion(): string | null {
    return this.cache?.stateVersion ?? null;
  }

  get connection(): Connection {
    return this.connectionState;
  }

  get gameId(): string | null {
    return this.target?.gameId ?? null;
  }

  /**
   * A sessão está pondo em dia uma ausência longa: os eventos que chegam agora vão para o
   * Relatório de Retorno, e não para notificações uma a uma.
   */
  get catchingUp(): boolean {
    return this.baseline !== null || this.seeding;
  }

  /**
   * A visão à vista foi lida do servidor nesta abertura da partida. A que vem do cache pode ter
   * horas: serve para desenhar o feudo, mas não para anunciar um prazo como se fosse de agora.
   */
  get live(): boolean {
    return this.fresh;
  }

  /** A virada de estação que o aviso de uma hora antes já anunciou ("1:winter"), ou `null`. */
  get seasonWarned(): string | null {
    return this.seasonMark;
  }

  /** Anota a virada anunciada e grava: recarregar a página não repete o aviso. */
  async markSeasonWarned(key: string): Promise<void> {
    this.seasonMark = key;
    if (this.target !== null) {
      await this.persist(this.target);
    }
  }

  /**
   * Abre a partida: mostra na hora o último estado conhecido e sincroniza em seguida. Se o
   * jogador ficou 4 horas ou mais fora, a primeira sincronização gera o Relatório de Retorno.
   */
  async start(target: SessionTarget): Promise<void> {
    this.stop();
    this.target = target;
    const stored = loadCache(this.deps.store, target);
    this.cache = stored.cache;
    this.seasonMark = stored.seasonWarned;
    this.resumeSeq = stored.lastSeq;
    // Sem cursor (navegador novo, cache apagado), a primeira leitura traz a história inteira da
    // partida: ela põe a Crônica em dia, mas não é novidade para avisar.
    this.seeding = stored.lastSeq === null;
    if (this.cache !== null) {
      this.viewChanges.emit(this.cache.view);
    }
    // A ausência se mede pelo instante e pelo cursor guardados, que valem mesmo quando a visão
    // foi descartada: quem volta horas depois de uma atualização do jogo também tem a ausência
    // posta em dia de uma vez, e não em avisos avulsos. Sem cursor não há ausência a contar: a
    // primeira leitura traz a história inteira.
    if (stored.lastSeq !== null && stored.away !== null) {
      // A página anterior terminou com a aba fora de vista (o navegador a descartou, ou ela foi
      // recarregada): a ausência começou quando a aba saiu de vista, e não na última leitura em
      // segundo plano, e os eventos dela já estão guardados.
      if (!this.visible) {
        // Esta página também nasceu fora de vista: a ausência continua.
        this.away = stored.away;
      } else if (shouldShowReturnReport(stored.away.since, this.now())) {
        const { view, since, events } = stored.away;
        this.baseline = { view, lastSeenAt: since, events: [...events] };
      }
    } else if (
      stored.lastSeq !== null &&
      stored.lastSeenAt !== null &&
      shouldShowReturnReport(stored.lastSeenAt, this.now())
    ) {
      // Fica guardado até a primeira leitura bem-sucedida, mesmo que ela só venha depois de
      // a ligação voltar.
      this.baseline = { view: stored.reportBase, lastSeenAt: stored.lastSeenAt, events: [] };
    }
    await this.syncNow();
  }

  /** Para o ciclo, sem apagar o cache. Sem partida aberta não há "sem ligação" a mostrar. */
  stop(): void {
    this.generation += 1;
    this.clearTimer();
    this.target = null;
    this.cache = null;
    this.syncing = null;
    this.baseline = null;
    this.away = null;
    this.stayedOpen = false;
    this.resumeSeq = null;
    this.seeding = false;
    this.fresh = false;
    this.seasonMark = null;
    this.setConnection({ kind: 'online' });
  }

  /** Apaga o que esta máquina guardou da partida: logout, exclusão ou sessão revogada. */
  async clearCache(target: SessionTarget | null = this.target): Promise<void> {
    if (target !== null) {
      await this.deps.store.update(cacheKey(target), undefined);
    }
    if (target === this.target) {
      this.stop();
    }
  }

  /**
   * A aba do navegador ficou à vista ou em segundo plano: muda a cadência do ciclo.
   *
   * Sair de vista também começa a contar uma ausência (`Away`): o ciclo continua em segundo
   * plano, e o que chega vai sendo guardado. Na volta, com 4 horas ou mais fora de vista, essa
   * ausência vira Relatório de Retorno (`onReturnWhileOpen`), como a de quem fechou a aba; com
   * menos, é esquecida. Uma aba que ficou **à vista** o tempo todo não tem como saber que o
   * jogador saiu: essa não recebe relatório.
   */
  setVisible(visible: boolean): void {
    if (this.visible === visible) {
      return;
    }
    this.visible = visible;
    if (this.target !== null) {
      if (!visible) {
        this.leave(this.target);
      } else {
        this.comeBack(this.target);
      }
    }
    if (this.target !== null && this.connectionState.kind === 'online') {
      if (visible) {
        void this.syncNow();
      } else {
        this.schedule(pollIntervalMs(false));
      }
    }
  }

  /** A aba saiu de vista: guarda o que se sabe agora, de onde o relatório da volta vai partir. */
  private leave(target: SessionTarget): void {
    // Com um relatório ainda por sair (a abertura sem ligação), a ausência em curso é a dele.
    if (this.cache === null || this.away !== null || this.baseline !== null) {
      return;
    }
    this.away = { since: this.now(), view: this.viewOfCursor(), events: [] };
    void this.persist(target);
  }

  /** A aba voltou à vista: depois de 4 horas ou mais, a ausência vira Relatório de Retorno. */
  private comeBack(target: SessionTarget): void {
    const { away } = this;
    if (away === null) {
      return;
    }
    this.away = null;
    // Outra aba deste navegador esteve à vista nesse meio-tempo: o jogador não esteve fora.
    const attended = attendedAtOf(this.deps.store.get<Partial<GameCache>>(cacheKey(target)));
    if (
      this.baseline === null &&
      attended <= away.since &&
      shouldShowReturnReport(away.since, this.now())
    ) {
      // Sai depois da próxima leitura bem-sucedida, com o que ela ainda trouxer.
      this.baseline = { view: away.view, lastSeenAt: away.since, events: away.events };
      this.stayedOpen = true;
    }
    // O cache deixa de dizer que a aba está fora de vista, mesmo que a leitura a seguir falhe.
    void this.persist(target);
  }

  /** Sincroniza agora e reagenda o ciclo. Chamadas simultâneas compartilham a mesma leitura. */
  syncNow(): Promise<void> {
    if (this.target === null) {
      return Promise.resolve();
    }
    if (this.syncing === null) {
      const running: Promise<void> = this.cycle().finally(() => {
        // Só o ciclo corrente se desmarca: o de uma sessão já fechada não apaga o da nova.
        if (this.syncing === running) {
          this.syncing = null;
        }
      });
      this.syncing = running;
    }
    return this.syncing;
  }

  private async cycle(): Promise<void> {
    const generation = this.generation;
    this.clearTimer();
    try {
      await this.pull();
      if (generation !== this.generation) {
        return;
      }
      this.setConnection({ kind: 'online' });
      this.emitReturnReport();
      this.seeding = false;
      this.schedule(this.nextPollMs());
    } catch (error) {
      if (generation !== this.generation) {
        return;
      }
      this.handleFailure(error);
    }
  }

  private handleFailure(error: unknown): void {
    if (error instanceof NetworkError || (!isSessionLoss(error) && this.isServerTrouble(error))) {
      const attempt =
        this.connectionState.kind === 'offline' ? this.connectionState.attempt + 1 : 1;
      const retryInMs = retryDelayMs(attempt);
      this.setConnection({ kind: 'offline', retryInMs, attempt });
      this.schedule(retryInMs);
      return;
    }
    if (isSessionLoss(error)) {
      // Não é falta de rede: o cache não deve ser exibido como se fosse.
      this.clearTimer();
      this.setConnection({ kind: 'unauthenticated' });
      return;
    }
    // Outro erro do servidor (partida arquivada, protocolo antigo): quem cuida da conta decide
    // o que fazer; o ciclo normal segue tentando.
    this.problems.emit(error);
    this.schedule(pollIntervalMs(this.visible));
  }

  /**
   * Quando ler o servidor de novo. Com a aba à vista, não espera o ciclo inteiro se um prazo da
   * visão (obra, planejada à espera, fim de adaptação, aldeão a caminho, virada do dia, carta do
   * Conselho que expira, próxima audiência, incursão à vista, ferido que sara) vence antes: a
   * contagem regressiva chegaria a zero e a tela ficaria parada nela. O segundo a mais dá ao
   * servidor tempo de virar o prazo.
   */
  private nextPollMs(): number {
    const poll = pollIntervalMs(this.visible);
    const view = this.cache?.view;
    if (!this.visible || view === undefined) {
      return poll;
    }
    const deadlines = [
      // Cada fila de obras tem o seu prazo, e cada planejada, o instante em que a espera acaba
      // (é quando uma automática começa sozinha).
      ...view.constructions.queues.map((queue) => queue?.secondsRemaining),
      ...view.constructions.planned.map((plan) => plan.waiting?.etaSeconds),
      // O fim da primeira leva em adaptação de cada edifício: a taxa sobe nesse instante, sem
      // evento que avise (GDD §5.4).
      ...view.workers.map((row) => row.adaptingCohorts[0]?.endsInSeconds),
      view.population.secondsToNextRecruit,
      view.calendar.secondsToNextDay,
      // O prazo de cada carta do Conselho (é quando ela sai da mesa e a Crônica conta o que o
      // conselho fez) e a próxima audiência, que pode trazer outra.
      ...view.council.pending.map((card) => card.expiresInSeconds),
      view.council.nextAudienceInSeconds,
      // A chegada da incursão que os vigias avistaram (é quando a Crônica conta o desfecho) e o
      // instante em que o próximo ferido sara e volta ao ofício.
      view.threat.incoming?.inSeconds,
      view.population.secondsToNextRecovery,
    ].filter((seconds): seconds is number => typeof seconds === 'number' && seconds >= 0);
    const soonest = Math.min(...deadlines, Number.POSITIVE_INFINITY);
    return Math.max(MIN_POLL_MS, Math.min(poll, (soonest + 1) * 1000));
  }

  private isServerTrouble(error: unknown): boolean {
    if (!(error instanceof ApiClientError)) {
      return false;
    }
    // Um 401 que não veio da API (proxy, portal cativo) é problema de caminho, não de sessão.
    return error.status >= 500 || error.status === 429 || error.status === 401;
  }

  /** Lê a visão (com ETag) e os eventos novos, e grava o cache. */
  private async pull(): Promise<void> {
    const target = this.target;
    if (target === null) {
      return;
    }
    const { client } = this.deps;
    const adoptions = this.adoptions;
    const read = await client.getView(target.gameId, { etag: this.cache?.etag ?? null });
    if (this.target !== target) {
      return;
    }
    if (adoptions !== this.adoptions) {
      // Um comando foi aplicado enquanto esta leitura estava em voo: ela é mais antiga que a
      // visão que veio na resposta do comando e não pode pôr a tela no passado.
      await this.pullEvents(target);
      await this.persist(target);
      return;
    }
    if (read.status === 200) {
      this.cache = {
        version: CACHE_VERSION,
        view: read.view,
        stateVersion: read.stateVersion,
        etag: read.etag,
        lastSeq: this.cache?.lastSeq ?? this.resumeSeq ?? 0,
        lastSeenAt: this.now(),
        // A visão nova chega antes dos eventos que levam até ela.
        behind: this.viewOfCursor(),
      };
      this.fresh = true;
      this.viewChanges.emit(read.view);
      // Grava já: se a aba fechar antes de os eventos chegarem, a visão nova não se perde. A
      // que corresponde ao cursor vai junto (`behind`), para o Relatório de Retorno.
      await this.persist(target);
    } else if (this.cache !== null) {
      this.cache = { ...this.cache, etag: read.etag ?? this.cache.etag, lastSeenAt: this.now() };
    }
    await this.pullEvents(target);
    await this.persist(target);
  }

  /**
   * A visão que corresponde ao cursor de agora, para guardar ao lado de uma visão nova que
   * chega antes dos eventos (`GameCache.behind`). Com a visão e o cursor andando juntos, é a
   * própria visão guardada; se ela já estava à frente, a base continua a mesma; sem visão
   * nenhuma (primeira leitura, cache de outra versão), não há.
   */
  private viewOfCursor(): ViewState | null {
    if (this.cache === null) {
      return null;
    }
    return this.cache.behind === undefined ? this.cache.view : this.cache.behind;
  }

  /** Entrega eventos novos, uma única vez: ao Relatório de Retorno pendente e a quem escuta. */
  private deliver(fresh: GameEvent[]): void {
    if (fresh.length > 0) {
      this.baseline?.events.push(...fresh);
      // Com a aba fora de vista, o que chega também fica guardado para o relatório da volta.
      this.away?.events.push(...fresh);
      this.eventBatches.emit(fresh);
    }
  }

  /**
   * Lê os eventos além do cursor. Quando a leitura chega ao fim, a visão e o cursor voltam a
   * andar juntos: a base guardada ao lado (`behind`) não é mais precisa.
   */
  private async pullEvents(target: SessionTarget): Promise<void> {
    if (this.cache === null) {
      return;
    }
    const fresh: GameEvent[] = [];
    let hasMore = true;
    try {
      while (hasMore && this.target === target && this.cache !== null) {
        const page = await this.deps.client.getEvents(target.gameId, this.cache.lastSeq);
        if (this.target !== target || this.cache === null) {
          return;
        }
        // Só o que está além do cursor: um evento nunca é entregue duas vezes.
        fresh.push(...page.events.filter((event) => event.seq > (this.cache?.lastSeq ?? 0)));
        this.cache = { ...this.cache, lastSeq: Math.max(this.cache.lastSeq, page.lastSeq) };
        hasMore = page.hasMore;
      }
      if (this.target === target && this.cache !== null) {
        this.cache = settled(this.cache);
      }
    } finally {
      // Uma página que falha não desfaz as anteriores: o cursor já andou por elas, e os eventos
      // delas são entregues agora, ou nunca seriam. Com a partida fechada no meio, nada sai.
      if (this.target === target && this.cache !== null) {
        this.deliver(fresh);
      }
    }
  }

  private async persist(target: SessionTarget): Promise<void> {
    if (this.target === target && this.cache !== null) {
      const key = cacheKey(target);
      // À vista, esta aba é quem está sendo olhada agora. Fora de vista, vale o que outra aba
      // tiver gravado: as abas dividem o cache, e esta não pode apagar a marca da outra.
      const attendedAt = this.visible
        ? this.now()
        : attendedAtOf(this.deps.store.get<Partial<GameCache>>(key));
      await this.deps.store.update(key, {
        ...this.cache,
        ...(this.seasonMark === null ? {} : { seasonWarned: this.seasonMark }),
        ...(this.away === null ? {} : { away: this.away }),
        ...(attendedAt === 0 ? {} : { attendedAt }),
      });
    }
  }

  /**
   * Envia uma ordem. Sem ligação, recusa na hora com `OfflineError`: comandos nunca ficam em
   * fila. Numa recusa do motor, a tela passa a mostrar o estado avançado que veio na resposta
   * e o erro sobe para a interface exibir o motivo.
   */
  async send(command: Command): Promise<void> {
    const target = this.target;
    if (target === null || this.connectionState.kind !== 'online') {
      throw new OfflineError();
    }
    try {
      const result = await this.deps.client.sendCommand(target.gameId, command, {
        stateVersion: this.cache?.stateVersion ?? null,
      });
      if (result.replayed) {
        // Recibo de uma ordem antiga: a visão dele pode estar no passado. Lê a atual.
        await this.syncNow();
        return;
      }
      await this.adopt(target, result.view, result.stateVersion, result.events);
    } catch (error) {
      if (isGameRuleError(error)) {
        if (error.replayed) {
          await this.syncNow();
        } else {
          const { view, stateVersion, events } = error.details;
          await this.adopt(target, view, stateVersion, events);
        }
      } else if (error instanceof NetworkError) {
        this.handleFailure(error);
      } else if (isSessionLoss(error) || this.isServerTrouble(error)) {
        this.handleFailure(error);
      }
      throw error;
    }
  }

  /**
   * Adota a visão que veio na resposta de um comando e busca os eventos pelo cursor.
   *
   * A resposta traz os eventos que levaram o mundo até essa visão (o avanço e a própria ordem).
   * Quando eles começam logo depois do cursor, são entregues daqui mesmo, e o cursor anda junto
   * com a visão, na mesma gravação: fechar a aba em seguida deixa um cache coerente. Quando há
   * um salto (outra aba ou o servidor agiram antes e esta sessão ainda não leu), o cursor fica
   * onde está e a visão que lhe corresponde vai guardada ao lado, até a leitura dos eventos.
   */
  private async adopt(
    target: SessionTarget,
    view: ViewState,
    stateVersion: string,
    events: readonly GameEvent[],
  ): Promise<void> {
    if (this.target !== target) {
      return;
    }
    this.adoptions += 1;
    const cursor = this.cache?.lastSeq ?? this.resumeSeq ?? 0;
    const fresh = [...events].sort((a, b) => a.seq - b.seq);
    const inOrder = fresh.every((entry, index) => entry.seq === cursor + 1 + index);
    const follows = fresh.length > 0 && inOrder;
    this.cache = {
      version: CACHE_VERSION,
      view,
      stateVersion,
      // O ETag é do corpo de /view; depois de um comando, a próxima leitura vem inteira.
      etag: null,
      lastSeq: follows ? cursor + fresh.length : cursor,
      lastSeenAt: this.now(),
      ...(follows ? {} : { behind: this.viewOfCursor() }),
    };
    this.fresh = true;
    this.viewChanges.emit(view);
    if (follows) {
      this.deliver(fresh);
    }
    // Grava já: fechar a aba logo depois de uma ordem não pode deixar o cache no passado.
    await this.persist(target);
    try {
      await this.pullEvents(target);
    } catch {
      // Os eventos chegam no próximo ciclo; a ordem em si já foi aplicada.
    }
    await this.persist(target);
  }

  /** Depois da primeira leitura bem-sucedida de uma ausência longa, emite o relatório. */
  private emitReturnReport(): void {
    const { baseline, cache } = this;
    if (baseline === null || cache === null) {
      return;
    }
    this.baseline = null;
    const { stayedOpen } = this;
    this.stayedOpen = false;
    (stayedOpen ? this.openTabReports : this.reports).emit(
      buildReturnReport(
        baseline.view,
        cache.view,
        baseline.events,
        this.now() - baseline.lastSeenAt,
      ),
    );
  }

  private setConnection(next: Connection): void {
    const previous = this.connectionState;
    this.connectionState = next;
    if (
      previous.kind !== next.kind ||
      (previous.kind === 'offline' && next.kind === 'offline' && previous.attempt !== next.attempt)
    ) {
      this.connectionChanges.emit(next);
    }
  }

  private schedule(delayMs: number): void {
    this.clearTimer();
    const generation = this.generation;
    this.timer = setTimeout(() => {
      if (generation === this.generation) {
        void this.syncNow();
      }
    }, delayMs);
    // Nos testes (Node), o ciclo não deve segurar o processo aberto.
    (this.timer as { unref?: () => void }).unref?.();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
