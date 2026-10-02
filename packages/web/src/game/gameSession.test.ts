import { ApiClientError, type Client, GameRuleClientError, NetworkError } from '@lotg/client-sdk';
import {
  type Command,
  type GameEvent,
  PROTOCOL_VERSION,
  type ReturnReport,
  type ViewState,
} from '@lotg/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import golden from '../../../engine/src/__golden__/view-seed-pedra-alta.json';
import { memoryStore } from '../services/store';
import { type Connection, pollIntervalMs, retryDelayMs } from './connection';
import {
  CACHE_VERSION,
  cacheKey,
  clearAccountCaches,
  type GameCache,
  GameSession,
  OfflineError,
} from './gameSession';
import { pendingItems } from './returnReport';

const view = golden.initial as unknown as ViewState;
/** Um cache gravado agora por esta versão do app. */
const cachedNow = (): GameCache => ({
  version: CACHE_VERSION,
  view,
  stateVersion: '1',
  etag: 'W/"a"',
  lastSeq: 0,
  lastSeenAt: Date.now(),
});
const laterView = golden.afterObjectivesScenario as unknown as ViewState;
const target = { serverKey: 'http://servidor', accountId: 'conta-1', gameId: 'partida-1' };
const HOUR = 3_600_000;

const event = (seq: number, type: GameEvent['type'] = 'dayStarted'): GameEvent => ({
  seq,
  type,
  at: '2026-10-01T12:00:00.000Z',
  atMs: seq,
  text: `evento ${seq}`,
  data: {},
});

const order: Command = {
  commandId: '11111111-1111-4111-8111-111111111111',
  type: 'setWorkers',
  payload: { building: 'farm', count: 2 },
};

/** Servidor de mentira com o mínimo que a sessão usa. */
function fakeServer() {
  const state = {
    view,
    stateVersion: '1',
    etag: 'W/"a"',
    events: [] as GameEvent[],
    fail: null as Error | null,
    /** Só a leitura dos eventos falha: a visão chega, o cursor não anda. */
    failEvents: null as Error | null,
    calls: { view: 0, events: 0, commands: 0 },
    lastEtagSent: undefined as string | null | undefined,
    lastAfter: -1,
    command: null as null | (() => Promise<unknown>),
  };
  const client = {
    getView: async (_gameId: string, known: { etag?: string | null } = {}) => {
      state.calls.view += 1;
      state.lastEtagSent = known.etag;
      if (state.fail) {
        throw state.fail;
      }
      return known.etag === state.etag
        ? { status: 304 as const, etag: state.etag }
        : {
            status: 200 as const,
            view: state.view,
            stateVersion: state.stateVersion,
            etag: state.etag,
          };
    },
    getEvents: async (_gameId: string, after = 0) => {
      state.calls.events += 1;
      state.lastAfter = after;
      if (state.fail ?? state.failEvents) {
        throw state.fail ?? state.failEvents;
      }
      const fresh = state.events.filter((entry) => entry.seq > after);
      return { events: fresh, lastSeq: fresh.at(-1)?.seq ?? after, hasMore: false };
    },
    sendCommand: async () => {
      state.calls.commands += 1;
      if (state.command) {
        return state.command();
      }
      return { view: laterView, events: [], stateVersion: '2', staleView: false, replayed: false };
    },
  } as unknown as Client;
  return { state, client };
}

function setup(cached?: GameCache) {
  const server = fakeServer();
  const store = memoryStore(cached ? { [cacheKey(target)]: cached } : {});
  const session = new GameSession({ client: server.client, store, now: () => Date.now() });
  const seen = {
    views: [] as ViewState[],
    events: [] as GameEvent[][],
    connections: [] as Connection[],
    reports: [] as ReturnReport[],
  };
  session.onView((next) => seen.views.push(next));
  session.onEvents((batch) => seen.events.push(batch));
  session.onConnection((next) => seen.connections.push(next));
  session.onReturnReport((report) => seen.reports.push(report));
  return { ...server, store, session, seen };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-01T12:00:00.000Z'));
});
afterEach(() => {
  vi.useRealTimers();
});

describe('cadência', () => {
  it('30 s com o painel visível e 2 min com ele oculto', async () => {
    const { session, state } = setup();
    await session.start(target);
    expect(state.calls.view).toBe(1);

    // Oculto: nada antes de 2 minutos.
    await vi.advanceTimersByTimeAsync(119_000);
    expect(state.calls.view).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(state.calls.view).toBe(2);

    // Visível: sincroniza na hora e passa a 30 s.
    session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(state.calls.view).toBe(3);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.calls.view).toBe(4);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(state.calls.view).toBe(5);

    // Oculto de novo: volta aos 2 minutos.
    session.setVisible(false);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.calls.view).toBe(5);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(state.calls.view).toBe(6);
    expect(pollIntervalMs(true)).toBe(30_000);
    expect(pollIntervalMs(false)).toBe(120_000);
  });

  it('manda o ETag da última leitura e não reemite a visão num 304', async () => {
    const { session, state, seen } = setup();
    await session.start(target);
    expect(state.lastEtagSent).toBeNull();
    await session.syncNow();
    expect(state.lastEtagSent).toBe('W/"a"');
    expect(seen.views).toHaveLength(1);

    state.view = laterView;
    state.etag = 'W/"b"';
    await session.syncNow();
    expect(seen.views).toEqual([view, laterView]);
  });

  it('parar a sessão cancela o ciclo', async () => {
    const { session, state } = setup();
    await session.start(target);
    session.stop();
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(state.calls.view).toBe(1);
    expect(session.view).toBeNull();
  });
});

describe('eventos', () => {
  it('entrega cada evento uma única vez, pelo cursor', async () => {
    const { session, state, seen, store } = setup();
    state.events = [event(1), event(2)];
    await session.start(target);
    expect(seen.events).toEqual([[event(1), event(2)]]);

    await session.syncNow();
    expect(seen.events).toHaveLength(1);
    expect(state.lastAfter).toBe(2);

    state.events.push(event(3, 'constructionFinished'));
    await session.syncNow();
    expect(seen.events[1]).toEqual([event(3, 'constructionFinished')]);
    expect(store.get<GameCache>(cacheKey(target))?.lastSeq).toBe(3);
  });

  it('uma página de eventos que falha não leva as anteriores: o cursor andou, e elas são entregues', async () => {
    const { session, state, seen, client, store } = setup();
    await session.start(target);
    state.events = [event(1), event(2), event(3), event(4)];
    state.etag = 'W/"b"';
    // Duas páginas de dois eventos; a segunda leitura cai.
    let reads = 0;
    client.getEvents = async (_gameId: string, after = 0) => {
      reads += 1;
      if (reads === 2) {
        throw new NetworkError('fora');
      }
      const page = state.events.filter((entry) => entry.seq > after).slice(0, 2);
      return {
        events: page,
        lastSeq: page.at(-1)?.seq ?? after,
        hasMore: (page.at(-1)?.seq ?? after) < 4,
      };
    };
    await vi.advanceTimersByTimeAsync(pollIntervalMs(false));
    expect(session.connection.kind).toBe('offline');
    expect(seen.events).toEqual([[event(1), event(2)]]);
    // A ligação volta: o resto chega, e nada se repete.
    await vi.advanceTimersByTimeAsync(retryDelayMs(1));
    expect(seen.events).toEqual([
      [event(1), event(2)],
      [event(3), event(4)],
    ]);
    expect(store.get<GameCache>(cacheKey(target))?.lastSeq).toBe(4);
  });

  it('o cursor sobrevive ao reinício do editor', async () => {
    const first = setup();
    first.state.events = [event(1), event(2)];
    await first.session.start(target);

    const cached = first.store.get<GameCache>(cacheKey(target));
    const second = setup(cached);
    second.state.events = [event(1), event(2), event(3)];
    await second.session.start(target);
    expect(second.seen.events).toEqual([[event(3)]]);
  });
});

describe('conexão', () => {
  it('sem rede, mostra o cache e tenta de novo em 5, 10, 20, 40 e 60 s', async () => {
    const cached: GameCache = {
      version: CACHE_VERSION,
      view,
      stateVersion: '1',
      etag: 'W/"a"',
      lastSeq: 0,
      lastSeenAt: Date.now(),
    };
    const { session, state, seen } = setup(cached);
    state.fail = new NetworkError('fora');
    await session.start(target);

    // O último estado conhecido aparece mesmo sem conexão.
    expect(seen.views).toEqual([view]);
    expect(session.view).toEqual(view);
    expect(session.connection).toEqual({ kind: 'offline', retryInMs: 5_000, attempt: 1 });

    for (const [attempt, delay] of [
      [2, 5_000],
      [3, 10_000],
      [4, 20_000],
      [5, 40_000],
      [6, 60_000],
    ] as const) {
      await vi.advanceTimersByTimeAsync(delay);
      expect(session.connection).toMatchObject({ kind: 'offline', attempt });
    }
    expect(session.connection).toMatchObject({ retryInMs: 60_000 });
    expect([1, 2, 3, 4, 5, 6].map(retryDelayMs)).toEqual([
      5_000, 10_000, 20_000, 40_000, 60_000, 60_000,
    ]);
  });

  it('quando o servidor volta, sincroniza e retoma o ciclo normal', async () => {
    const { session, state, seen } = setup();
    state.fail = new NetworkError('fora');
    await session.start(target);
    state.fail = null;
    state.view = laterView;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(session.connection).toEqual({ kind: 'online' });
    expect(seen.views).toEqual([laterView]);
    expect(seen.connections.map((entry) => entry.kind)).toEqual(['offline', 'online']);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.calls.view).toBe(3);
  });

  it('erro 5xx e limite de taxa também são tratados como falta de ligação', async () => {
    const { session, state } = setup();
    state.fail = new ApiClientError(503, 'INTERNAL', 'fora', undefined);
    await session.start(target);
    expect(session.connection.kind).toBe('offline');
  });

  it('falha de autenticação não é modo sem conexão: para o ciclo', async () => {
    const { session, state } = setup();
    state.fail = new ApiClientError(401, 'SESSION_REVOKED', 'encerrada', undefined);
    await session.start(target);
    expect(session.connection).toEqual({ kind: 'unauthenticated' });
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(state.calls.view).toBe(1);
  });
});

describe('comandos', () => {
  it('sem ligação, nenhum comando é enviado nem fica em fila', async () => {
    const { session, state } = setup();
    state.fail = new NetworkError('fora');
    await session.start(target);
    await expect(session.send(order)).rejects.toBeInstanceOf(OfflineError);
    expect(state.calls.commands).toBe(0);

    // A ligação volta e nada é enviado sozinho.
    state.fail = null;
    await vi.advanceTimersByTimeAsync(5_000);
    expect(session.connection.kind).toBe('online');
    expect(state.calls.commands).toBe(0);
  });

  it('um comando aceito atualiza a visão e busca os eventos pelo cursor', async () => {
    const { session, state, seen, store } = setup();
    await session.start(target);
    state.events = [event(1, 'objectiveCompleted')];
    await session.send(order);
    expect(session.view).toEqual(laterView);
    expect(session.stateVersion).toBe('2');
    expect(seen.events).toEqual([[event(1, 'objectiveCompleted')]]);
    expect(store.get<GameCache>(cacheKey(target))).toMatchObject({
      stateVersion: '2',
      lastSeq: 1,
      etag: null,
    });
  });

  it('numa recusa do motor, mostra o estado avançado e repassa o motivo', async () => {
    const { session, state, seen } = setup();
    await session.start(target);
    state.command = async () => {
      throw new GameRuleClientError(
        'Faltam 30 madeira e 35 pedra.',
        {
          code: 'INSUFFICIENT_RESOURCES',
          message: 'Faltam 30 madeira e 35 pedra.',
          view: laterView,
          events: [],
          stateVersion: '2',
          staleView: false,
        },
        false,
      );
    };
    await expect(session.send(order)).rejects.toThrow('Faltam 30 madeira e 35 pedra.');
    expect(seen.views.at(-1)).toEqual(laterView);
    expect(session.stateVersion).toBe('2');
  });

  it('um recibo repetido não leva a tela ao passado: lê a visão atual', async () => {
    const { session, state, seen } = setup();
    await session.start(target);
    const viewsBefore = state.calls.view;
    // O recibo traz a visão de quando a ordem foi dada pela primeira vez.
    state.command = async () => ({
      view: laterView,
      events: [event(9)],
      stateVersion: '2',
      staleView: false,
      replayed: true,
    });
    await session.send(order);
    expect(state.calls.view).toBe(viewsBefore + 1);
    expect(session.view).toEqual(view);
    expect(seen.views).toEqual([view]);
    expect(seen.events).toEqual([]);
  });

  it('recusa repetida também lê a visão atual em vez de usar a do recibo', async () => {
    const { session, state } = setup();
    await session.start(target);
    state.command = async () => {
      throw new GameRuleClientError(
        'Fome.',
        {
          code: 'FAMINE',
          message: 'Fome.',
          view: laterView,
          events: [],
          stateVersion: '9',
          staleView: false,
        },
        true,
      );
    };
    await expect(session.send(order)).rejects.toThrow('Fome.');
    expect(session.view).toEqual(view);
    expect(session.stateVersion).toBe('1');
  });

  it('falha de rede no envio derruba a ligação e o erro sobe', async () => {
    const { session, state } = setup();
    await session.start(target);
    state.command = async () => {
      throw new NetworkError('fora');
    };
    await expect(session.send(order)).rejects.toBeInstanceOf(NetworkError);
    expect(session.connection.kind).toBe('offline');
  });
});

describe('leituras em voo', () => {
  it('uma leitura iniciada antes de um comando não põe a tela no passado', async () => {
    const { session, state, seen, client } = setup();
    await session.start(target);
    // A leitura do ciclo fica pendurada enquanto o comando é aplicado.
    let release = () => {};
    const original = client.getView.bind(client);
    client.getView = async (...args: Parameters<typeof client.getView>) => {
      const stale = await original(...args);
      await new Promise<void>((resolve) => {
        release = resolve;
      });
      return stale;
    };
    state.etag = 'W/"b"';
    const reading = session.syncNow();
    await vi.advanceTimersByTimeAsync(0);
    await session.send(order);
    expect(session.view).toEqual(laterView);

    release();
    await reading;
    expect(session.view).toEqual(laterView);
    expect(session.stateVersion).toBe('2');
    expect(seen.views.at(-1)).toEqual(laterView);
  });

  it('um problema que não é rede nem sessão é avisado e o ciclo continua', async () => {
    const { session, state } = setup();
    const problems: unknown[] = [];
    session.onProblem((error) => problems.push(error));
    state.fail = new ApiClientError(409, 'CONFLICT', 'Partida arquivada.', undefined);
    await session.start(target);
    expect(problems).toHaveLength(1);
    expect(session.connection.kind).toBe('online');
    await vi.advanceTimersByTimeAsync(120_000);
    expect(state.calls.view).toBe(2);
  });

  it('parar a sessão sem ligação não deixa "sem ligação" para trás', async () => {
    const { session, state } = setup();
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(session.connection.kind).toBe('offline');
    session.stop();
    expect(session.connection).toEqual({ kind: 'online' });
  });
});

describe('cache', () => {
  it('é separado por servidor, conta e partida', () => {
    expect(cacheKey(target)).toBe('lords.cache:http://servidor:conta-1:partida-1');
    expect(cacheKey({ ...target, accountId: 'conta-2' })).not.toBe(cacheKey(target));
    expect(cacheKey({ ...target, serverKey: 'https://outro' })).not.toBe(cacheKey(target));
  });

  it('guarda visão, versão, ETag, cursor e o instante da última leitura', async () => {
    const { session, store, state } = setup();
    state.events = [event(4)];
    await session.start(target);
    expect(store.get<GameCache>(cacheKey(target))).toEqual({
      version: CACHE_VERSION,
      view,
      stateVersion: '1',
      etag: 'W/"a"',
      lastSeq: 4,
      lastSeenAt: Date.now(),
    });
  });

  describe('a visão é de agora, ou do que estava guardado', () => {
    it('a que vem do cache não é de agora; a primeira leitura do servidor é', async () => {
      const { session, state } = setup(cachedNow());
      const live: boolean[] = [];
      session.onView(() => live.push(session.live));
      state.etag = 'W/"b"';
      await session.start(target);
      expect(live).toEqual([false, true]);
    });

    it('sem ligação, a visão guardada continua sendo só a guardada', async () => {
      const { session, state } = setup(cachedNow());
      state.fail = new NetworkError('fora');
      await session.start(target);
      expect(session.view).not.toBeNull();
      expect(session.live).toBe(false);
    });

    it('a visão que vem na resposta de uma ordem é de agora; fechar a partida esquece', async () => {
      const { session, state } = setup(cachedNow());
      state.fail = new NetworkError('fora');
      await session.start(target);
      state.fail = null;
      await vi.advanceTimersByTimeAsync(5_000);
      expect(session.connection.kind).toBe('online');
      await session.send(order);
      expect(session.live).toBe(true);
      session.stop();
      expect(session.live).toBe(false);
    });
  });

  describe('a virada de estação já anunciada', () => {
    it('começa sem marca, e o cache não ganha o campo à toa', async () => {
      const { session, store } = setup();
      await session.start(target);
      expect(session.seasonWarned).toBeNull();
      expect(store.get<GameCache>(cacheKey(target))).not.toHaveProperty('seasonWarned');
    });

    it('a marca é gravada com o cache e sobrevive às leituras seguintes', async () => {
      const { session, store, state } = setup();
      await session.start(target);
      await session.markSeasonWarned('1:summer');
      expect(session.seasonWarned).toBe('1:summer');
      expect(store.get<GameCache>(cacheKey(target))?.seasonWarned).toBe('1:summer');
      state.etag = 'W/"b"';
      await session.syncNow();
      await session.send(order);
      expect(store.get<GameCache>(cacheKey(target))?.seasonWarned).toBe('1:summer');
    });

    it('recarregar a página a encontra; outra partida, não', async () => {
      const first = setup();
      await first.session.start(target);
      await first.session.markSeasonWarned('1:summer');
      const reopened = new GameSession({ client: first.client, store: first.store });
      await reopened.start(target);
      expect(reopened.seasonWarned).toBe('1:summer');
      await reopened.start({ ...target, gameId: 'partida-2' });
      expect(reopened.seasonWarned).toBeNull();
      reopened.stop();
    });

    it('vale mesmo quando a visão guardada é descartada por ser de outra versão do app', async () => {
      const { session } = setup({
        ...cachedNow(),
        version: 'outra',
        seasonWarned: '1:winter',
      });
      await session.start(target);
      expect(session.seasonWarned).toBe('1:winter');
    });
  });

  it('a marca de versão junta o protocolo e o formato da visão', () => {
    expect(CACHE_VERSION).toBe(`${PROTOCOL_VERSION}.2`);
  });

  it('um cache com formato antigo de ViewState é descartado ao carregar', async () => {
    const outdated = {
      version: CACHE_VERSION,
      view: { settlement: { name: 'Pedra Alta' } },
      stateVersion: '1',
      etag: null,
      lastSeq: 0,
      lastSeenAt: Date.now(),
    };
    const { session, state, seen } = setup(outdated as unknown as GameCache);
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(session.view).toBeNull();
    expect(seen.views).toEqual([]);
  });

  it('a visão de antes das duas filas de obras (V2C-T5) é descartada: faltam campos que a tela usa', async () => {
    // Como o app a gravava antes de a visão ganhar `queues`, a marca e a espera das planejadas.
    const {
      queues: _queues,
      queuesUnlocked: _unlocked,
      queuesNote: _note,
      ...oldConstructions
    } = view.constructions;
    void [_queues, _unlocked, _note];
    const outdated = {
      version: CACHE_VERSION,
      view: { ...view, constructions: oldConstructions },
      stateVersion: '7',
      etag: 'W/"antes"',
      lastSeq: 3,
      lastSeenAt: Date.now(),
    };
    const { session, state, seen } = setup(outdated as unknown as GameCache);
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(session.view).toBeNull();
    expect(seen.views).toEqual([]);
    session.stop();

    // O mesmo vale para uma planejada sem a marca: a lista não pode mostrar uma caixa sem estado.
    const [upgrade] = view.constructions.available;
    const unmarked = {
      ...outdated,
      view: {
        ...view,
        constructions: { ...view.constructions, planned: [{ ...upgrade, planned: true }] },
      },
    };
    const second = setup(unmarked as unknown as GameCache);
    second.state.fail = new NetworkError('fora');
    await second.session.start(target);
    expect(second.session.view).toBeNull();
  });

  it('a visão de antes da troca de ofício (V2C-T3) é descartada: o painel usa as regras e a experiência', async () => {
    // Como o app a gravava antes de a visão ganhar `workersRules` e a experiência de cada ofício.
    const { workersRules: _rules, ...withoutRules } = view;
    void _rules;
    const outdated = {
      version: CACHE_VERSION,
      view: withoutRules,
      stateVersion: '7',
      etag: 'W/"antes"',
      lastSeq: 3,
      lastSeenAt: Date.now(),
    };
    const { session, state, seen } = setup(outdated as unknown as GameCache);
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(session.view).toBeNull();
    expect(seen.views).toEqual([]);
    session.stop();

    // O mesmo vale para um edifício sem a experiência nem as levas em adaptação.
    const bare = {
      ...outdated,
      view: {
        ...view,
        workers: view.workers.map(({ building, label, level, resource, assigned, breakdown }) => ({
          building,
          label,
          level,
          resource,
          assigned,
          grossPerHour: 0,
          perWorkerPerHour: 0,
          breakdown,
        })),
      },
    };
    const second = setup(bare as unknown as GameCache);
    second.state.fail = new NetworkError('fora');
    await second.session.start(target);
    expect(second.session.view).toBeNull();
  });

  it('a visão de antes da Ameaça (V2E-T1) é descartada: o painel confere `threat.known` antes de tudo', async () => {
    // Como o app a gravava antes de a visão ganhar a Ameaça e a Torre de Vigia.
    const { threat, ...withoutThreat } = view;
    const outdated = {
      version: CACHE_VERSION,
      view: withoutThreat,
      stateVersion: '7',
      etag: 'W/"antes"',
      lastSeq: 3,
      lastSeenAt: Date.now(),
    };
    const { session, state, seen } = setup(outdated as unknown as GameCache);
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(session.view).toBeNull();
    expect(seen.views).toEqual([]);
    session.stop();

    // A névoa é uma forma fechada: uma visão sem Torre que trouxesse o número não é exibida.
    expect(threat.known).toBe(false);
    const leaking = { ...outdated, view: { ...view, threat: { ...threat, level: 46 } } };
    const second = setup(leaking as unknown as GameCache);
    second.state.fail = new NetworkError('fora');
    await second.session.start(target);
    expect(second.session.view).toBeNull();
  });

  describe('gravado por outra versão do app', () => {
    // A visão como a v0.1 a gravava: sem dificuldade nem ritmo, e o cache sem marca de versão.
    const {
      difficulty: _difficulty,
      difficultyLabel: _difficultyLabel,
      paceLabel: _paceLabel,
      ...oldSettlement
    } = view.settlement;
    void [_difficulty, _difficultyLabel, _paceLabel];
    // É uma função: o relógio de mentira só vale dentro de cada teste.
    const fromV01 = () => ({
      view: { ...view, settlement: oldSettlement },
      stateVersion: '7',
      etag: 'W/"v01"',
      lastSeq: 3,
      lastSeenAt: Date.now() - 5 * HOUR,
    });

    it('o cache da v0.1 não é exibido: sem rede, a tela não mostra uma visão de outro formato', async () => {
      const { session, state, seen } = setup(fromV01() as unknown as GameCache);
      state.fail = new NetworkError('fora');
      await session.start(target);
      expect(session.view).toBeNull();
      expect(seen.views).toEqual([]);
      expect(session.connection.kind).toBe('offline');
    });

    it('a visão em forma válida, mas com outra marca (ou sem marca), também é descartada', async () => {
      // '1.2' é a marca do app do protocolo 1, de antes do Conselho: a visão dele não tinha
      // cartas nem decisões pendentes, e o cache dele é descartado pela marca (protocolo 2).
      expect(CACHE_VERSION).not.toBe('1.2');
      for (const version of [undefined, '1.1', '1.2', `${PROTOCOL_VERSION + 1}.2`, 2]) {
        const stale = { ...cachedNow(), ...(version === undefined ? {} : { version }) };
        if (version === undefined) {
          delete (stale as Partial<GameCache>).version;
        }
        const { session, state, seen } = setup(stale as unknown as GameCache);
        state.fail = new NetworkError('fora');
        await session.start(target);
        expect(session.view, String(version)).toBeNull();
        expect(seen.views, String(version)).toEqual([]);
        session.stop();
      }
    });

    it('com a marca atual e a forma atual, o cache é exibido', async () => {
      const { session, state, seen } = setup(cachedNow());
      state.fail = new NetworkError('fora');
      await session.start(target);
      expect(seen.views).toEqual([view]);
    });

    it('o cursor dos eventos sobrevive: a partida não volta inteira como novidade', async () => {
      const { session, state, seen, store } = setup(fromV01() as unknown as GameCache);
      state.events = [event(1), event(2), event(3), event(4, 'constructionFinished')];
      await session.start(target);
      // A leitura pediu só o que veio depois do cursor guardado pela versão anterior.
      expect(state.lastEtagSent).toBeNull();
      expect(seen.events).toEqual([[event(4, 'constructionFinished')]]);
      // E a primeira leitura grava por cima, já no formato e com a marca desta versão.
      expect(store.get<GameCache>(cacheKey(target))).toEqual({
        version: CACHE_VERSION,
        view,
        stateVersion: '1',
        etag: 'W/"a"',
        lastSeq: 4,
        lastSeenAt: Date.now(),
      });
      expect(session.view).toEqual(view);
    });

    it('depois de horas fora, a ausência é posta em dia: relatório sem comparação de estoques', async () => {
      const { session, state, seen } = setup(fromV01() as unknown as GameCache);
      state.events = [
        event(1),
        event(2, 'constructionFinished'),
        event(3),
        event(4, 'constructionFinished'),
        event(5),
      ];
      const catchingUp: boolean[] = [];
      session.onEvents(() => catchingUp.push(session.catchingUp));
      await session.start(target);
      // Os eventos da ausência chegam com a sessão ainda pondo a ausência em dia.
      expect(catchingUp).toEqual([true]);
      expect(session.catchingUp).toBe(false);
      // Sem a visão antiga não há o que comparar: o relatório conta o que aconteceu, e só.
      expect(seen.reports).toEqual([
        {
          awaySeconds: 5 * 3600,
          resources: [],
          counts: {
            daysPassed: 1,
            constructionsFinished: 1,
            villagersArrived: 0,
            objectivesCompleted: 0,
            settlersArrived: 0,
            villagersLeft: 0,
            villagersDeserted: 0,
            raidsSuffered: 0,
            raidsRepelled: 0,
            villagersInjured: 0,
            villagersRecovered: 0,
          },
          // A moral de agora vem da visão nova; a de antes não existe para comparar.
          morale: { value: 50, band: 'content', bandLabel: 'Contente' },
          famine: 'none',
          highlights: ['evento 4'],
          // Os três blocos saem do mesmo jeito: o que aconteceu, e o que a visão nova pede.
          blocks: {
            prospered: [{ text: 'evento 4', topic: 'construction' }],
            cost: [],
            pending: pendingItems(view),
          },
        },
      ]);
    });

    it('sem ligação na abertura, o relatório espera a primeira leitura', async () => {
      const { session, state, seen } = setup(fromV01() as unknown as GameCache);
      state.fail = new NetworkError('fora');
      await session.start(target);
      expect(seen.reports).toEqual([]);
      expect(session.catchingUp).toBe(true);
      state.fail = null;
      await session.syncNow();
      expect(seen.reports).toHaveLength(1);
      expect(session.catchingUp).toBe(false);
    });

    it('com menos de 4 horas fora, não há relatório', async () => {
      const recent = { ...fromV01(), lastSeenAt: Date.now() - HOUR };
      const { session, seen } = setup(recent as unknown as GameCache);
      await session.start(target);
      expect(session.catchingUp).toBe(false);
      expect(seen.reports).toEqual([]);
    });

    it('sem cursor guardado não há relatório: a primeira leitura traz a história inteira', async () => {
      const { lastSeq: _lastSeq, ...noCursor } = fromV01();
      void _lastSeq;
      const { session, state, seen } = setup(noCursor as unknown as GameCache);
      state.events = [event(1, 'constructionFinished'), event(2, 'constructionFinished')];
      await session.start(target);
      expect(seen.reports).toEqual([]);
    });
  });

  it('apagar os caches da conta leva todas as partidas dela, e só as dela', async () => {
    const store = memoryStore({
      [cacheKey(target)]: { view },
      [cacheKey({ ...target, gameId: 'partida-arquivada' })]: { view },
      [cacheKey({ ...target, accountId: 'conta-2' })]: { view },
      [cacheKey({ ...target, serverKey: 'https://outro' })]: { view },
      'lords.account:http://servidor': { kind: 'anonymous' },
    });
    await clearAccountCaches(store, target.serverKey, target.accountId);
    expect([...store.keys()].sort()).toEqual(
      [
        'lords.account:http://servidor',
        cacheKey({ ...target, accountId: 'conta-2' }),
        cacheKey({ ...target, serverKey: 'https://outro' }),
      ].sort(),
    );
  });

  it('sair, excluir ou perder a sessão apaga o cache da conta local', async () => {
    const { session, store } = setup();
    await session.start(target);
    expect(store.get(cacheKey(target))).toBeDefined();
    await session.clearCache();
    expect(store.get(cacheKey(target))).toBeUndefined();
    expect(session.view).toBeNull();
    expect(session.gameId).toBeNull();
  });
});

describe('Relatório de Retorno', () => {
  const cachedAt = (hoursAgo: number): GameCache => ({
    version: CACHE_VERSION,
    view,
    stateVersion: '1',
    etag: 'W/"velho"',
    lastSeq: 2,
    lastSeenAt: Date.now() - hoursAgo * HOUR,
  });

  it('aparece depois de 4 horas ou mais fora, com os eventos desde o cursor', async () => {
    const { session, state, seen } = setup(cachedAt(5));
    state.view = laterView;
    state.events = [event(1), event(2), event(3, 'constructionFinished'), event(4, 'dayStarted')];
    await session.start(target);
    expect(seen.reports).toHaveLength(1);
    const [report] = seen.reports;
    expect(report?.awaySeconds).toBe(5 * 3600);
    expect(report?.counts).toMatchObject({ constructionsFinished: 1, daysPassed: 1 });
    expect(report?.highlights).toEqual(['evento 3']);
    expect(report?.resources.find((row) => row.id === 'food')).toMatchObject({
      before: 180,
      after: 148,
      delta: -32,
    });
  });

  it('não aparece com menos de 4 horas nem na primeira vez', async () => {
    const recent = setup(cachedAt(3.9));
    await recent.session.start(target);
    expect(recent.seen.reports).toEqual([]);

    const first = setup();
    await first.session.start(target);
    expect(first.seen.reports).toEqual([]);
  });

  it('sem conexão não inventa relatório; ele sai quando a ligação volta', async () => {
    const { session, state, seen } = setup(cachedAt(8));
    state.fail = new NetworkError('fora');
    await session.start(target);
    expect(seen.reports).toEqual([]);
    expect(session.connection.kind).toBe('offline');
    expect(session.catchingUp).toBe(true);

    state.fail = null;
    state.view = laterView;
    state.events = [event(3, 'constructionFinished')];
    await vi.advanceTimersByTimeAsync(5_000);
    expect(seen.reports).toHaveLength(1);
    expect(seen.reports[0]?.counts.constructionsFinished).toBe(1);
    expect(seen.reports[0]?.awaySeconds).toBe(8 * 3600 + 5);
    expect(session.catchingUp).toBe(false);
  });
});

describe('Relatório de Retorno: a aba que ficou aberta (V2D-T4.4)', () => {
  /** A sessão aberta e à vista, com o que se escuta de cada relatório. */
  async function openTab(cached?: GameCache) {
    const context = setup(cached);
    const whileOpen: ReturnReport[] = [];
    context.session.onReturnWhileOpen((report) => whileOpen.push(report));
    context.session.setVisible(true);
    await context.session.start(target);
    return { ...context, whileOpen };
  }
  const stored = (store: ReturnType<typeof setup>['store']) =>
    store.get<GameCache>(cacheKey(target));

  it('fora de vista por 4 horas ou mais: na volta, a ausência inteira vira relatório, uma vez só', async () => {
    const { session, state, seen, whileOpen, store } = await openTab();
    session.setVisible(false);
    await vi.advanceTimersByTimeAsync(0);
    // O cache passa a dizer desde quando a aba está fora de vista, e de que visão partiu.
    expect(stored(store)?.away).toEqual({ since: Date.now(), view, events: [] });

    // Em segundo plano o ciclo continua, de 2 em 2 minutos: os eventos chegam e são entregues.
    state.events = [event(1, 'constructionFinished')];
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    state.events.push(event(2, 'dayStarted'), event(3, 'cardExpired'));
    state.view = laterView;
    state.etag = 'W/"b"';
    await vi.advanceTimersByTimeAsync(3 * HOUR);
    expect(seen.events.flat().map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(session.catchingUp).toBe(false);
    expect(stored(store)?.away?.events.map((entry) => entry.seq)).toEqual([1, 2, 3]);
    expect(whileOpen).toEqual([]);

    // O jogador volta: o que chegar nesta leitura entra no relatório, e não em aviso avulso.
    state.events.push(event(4, 'objectiveCompleted'));
    const catchingUp: boolean[] = [];
    session.onEvents(() => catchingUp.push(session.catchingUp));
    session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(catchingUp).toEqual([true]);
    expect(session.catchingUp).toBe(false);

    expect(whileOpen).toHaveLength(1);
    // Não é o relatório de quem reabriu a página: sai pelo outro caminho.
    expect(seen.reports).toEqual([]);
    const [report] = whileOpen;
    expect(report?.awaySeconds).toBe(5 * 3600);
    // Cada evento uma vez, dos que chegaram em segundo plano ao desta leitura.
    expect(report?.highlights).toEqual(['evento 1', 'evento 3', 'evento 4']);
    expect(report?.counts).toMatchObject({ daysPassed: 1, constructionsFinished: 1 });
    expect(report?.blocks?.prospered.map((item) => item.text)).toEqual(['evento 1', 'evento 4']);
    expect(report?.blocks?.cost.map((item) => item.text)).toEqual(['evento 3']);
    // Os estoques partem da visão de quando a aba saiu de vista.
    expect(report?.resources.find((row) => row.id === 'food')).toMatchObject({
      before: 180,
      after: 148,
    });
    // E a ausência acabou: o cache não a guarda mais, e ela não volta numa segunda vez.
    expect(stored(store)?.away).toBeUndefined();
    session.setVisible(false);
    session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(whileOpen).toHaveLength(1);
  });

  it('com menos de 4 horas fora de vista, nada: os eventos já foram entregues um a um', async () => {
    const { session, state, seen, whileOpen, store } = await openTab();
    session.setVisible(false);
    state.events = [event(1, 'constructionFinished')];
    await vi.advanceTimersByTimeAsync(4 * HOUR - 1000);
    session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(whileOpen).toEqual([]);
    expect(seen.reports).toEqual([]);
    expect(seen.events.flat()).toHaveLength(1);
    expect(stored(store)?.away).toBeUndefined();
  });

  it('a aba que ficou à vista o tempo todo não recebe relatório: não há como saber que o jogador saiu', async () => {
    const { state, seen, whileOpen } = await openTab();
    state.events = [event(1, 'constructionFinished')];
    await vi.advanceTimersByTimeAsync(9 * HOUR);
    expect(whileOpen).toEqual([]);
    expect(seen.reports).toEqual([]);
  });

  it('sem ligação na volta, o relatório espera a leitura e não repete o que já tinha chegado', async () => {
    const { session, state, whileOpen } = await openTab();
    session.setVisible(false);
    state.events = [event(1, 'constructionFinished')];
    await vi.advanceTimersByTimeAsync(5 * HOUR);
    state.fail = new NetworkError('fora');
    session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(session.connection.kind).toBe('offline');
    expect(whileOpen).toEqual([]);
    expect(session.catchingUp).toBe(true);

    // A ligação volta: a leitura dos eventos parte do cursor, que já passou pelo evento 1.
    state.fail = null;
    state.events.push(event(2, 'cardExpired'));
    await vi.advanceTimersByTimeAsync(5_000);
    expect(state.lastAfter).toBe(1);
    expect(whileOpen).toHaveLength(1);
    expect(whileOpen[0]?.highlights).toEqual(['evento 1', 'evento 2']);
    expect(whileOpen[0]?.awaySeconds).toBe(5 * 3600 + 5);
  });

  it('a aba descartada em segundo plano e recarregada na volta: o relatório parte de quando ela saiu de vista', async () => {
    const first = await openTab();
    first.session.setVisible(false);
    first.state.events = [event(1, 'constructionFinished'), event(2, 'dayStarted')];
    await vi.advanceTimersByTimeAsync(5 * HOUR);
    // A última leitura em segundo plano foi há instantes: sem a marca, pareceria "última visita".
    const cached = stored(first.store);
    expect(Date.now() - (cached?.lastSeenAt ?? 0)).toBeLessThan(3 * 60_000);
    expect(cached?.away?.since).toBe(Date.now() - 5 * HOUR);
    first.session.stop();

    // A página recarregada, à vista: é uma reabertura como as outras, com a ausência inteira.
    const reloaded = setup(cached);
    reloaded.state.events = [...first.state.events, event(3, 'cardExpired')];
    reloaded.state.view = laterView;
    reloaded.state.etag = 'W/"b"';
    reloaded.session.setVisible(true);
    await reloaded.session.start(target);
    expect(reloaded.seen.reports).toHaveLength(1);
    const [report] = reloaded.seen.reports;
    expect(report?.awaySeconds).toBe(5 * 3600);
    expect(report?.highlights).toEqual(['evento 1', 'evento 3']);
    expect(report?.counts.daysPassed).toBe(1);
    expect(report?.resources.find((row) => row.id === 'food')).toMatchObject({ before: 180 });
    expect(stored(reloaded.store)?.away).toBeUndefined();
    // Recarregar de novo não traz o relatório de volta.
    const again = setup(stored(reloaded.store));
    again.session.setVisible(true);
    await again.session.start(target);
    expect(again.seen.reports).toEqual([]);
  });

  it('recarregada antes das 4 horas, não há relatório; a marca some do cache', async () => {
    const first = await openTab();
    first.session.setVisible(false);
    await vi.advanceTimersByTimeAsync(HOUR);
    const cached = stored(first.store);
    expect(cached?.away).toBeDefined();
    first.session.stop();
    const reloaded = setup(cached);
    reloaded.session.setVisible(true);
    await reloaded.session.start(target);
    expect(reloaded.seen.reports).toEqual([]);
    expect(stored(reloaded.store)?.away).toBeUndefined();
  });

  it('outra aba do mesmo navegador esteve à vista: o jogador não esteve fora, e não há relatório', async () => {
    const hidden = await openTab();
    hidden.session.setVisible(false);
    await vi.advanceTimersByTimeAsync(3 * HOUR);
    // A outra aba divide o cache e o grava enquanto está à vista.
    const other = new GameSession({
      client: fakeServer().client,
      store: hidden.store,
      now: () => Date.now(),
    });
    other.setVisible(true);
    await other.start(target);
    expect(stored(hidden.store)?.attendedAt).toBe(Date.now());
    other.stop();
    // A aba escondida continua lendo em segundo plano e não apaga a marca da outra.
    await vi.advanceTimersByTimeAsync(2 * HOUR);
    expect(stored(hidden.store)?.attendedAt).toBe(Date.now() - 2 * HOUR);
    expect(stored(hidden.store)?.away).toBeDefined();

    hidden.session.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(hidden.whileOpen).toEqual([]);
    // Nem na página recarregada: a marca de quem esteve à vista é posterior à saída.
    const cached = {
      ...stored(hidden.store),
      away: { since: Date.now() - 5 * HOUR, view, events: [] },
    };
    const reloaded = setup(cached as GameCache);
    reloaded.session.setVisible(true);
    await reloaded.session.start(target);
    expect(reloaded.seen.reports).toEqual([]);
  });

  it('uma marca de ausência estragada no cache é ignorada, sem quebrar a abertura', async () => {
    for (const away of [
      'ontem',
      { since: 'cedo', view, events: [] },
      { since: Date.now() - 6 * HOUR, view, events: [{ seq: 'um' }] },
    ]) {
      const broken = setup({ ...cachedNow(), away } as unknown as GameCache);
      broken.session.setVisible(true);
      await broken.session.start(target);
      expect(broken.seen.reports).toEqual([]);
      expect(broken.session.view).toEqual(view);
    }
    // A visão de base em outro formato vira "nenhuma": o relatório sai sem a tabela de estoques.
    const noBase = setup({
      ...cachedNow(),
      away: { since: Date.now() - 6 * HOUR, view: { velha: true }, events: [] },
    } as unknown as GameCache);
    noBase.session.setVisible(true);
    await noBase.session.start(target);
    expect(noBase.seen.reports).toHaveLength(1);
    expect(noBase.seen.reports[0]?.resources).toEqual([]);
    expect(noBase.seen.reports[0]?.awaySeconds).toBe(6 * 3600);
  });
});

describe('Relatório de Retorno: a visão guardada à frente do cursor', () => {
  /** A visão inicial com outro estoque de madeira. */
  const withWood = (stock: number): ViewState => ({
    ...view,
    resources: view.resources.map((row) => (row.id === 'wood' ? { ...row, stock } : row)),
  });
  const started = (seq: number, type: GameEvent['type'] = 'constructionStarted'): GameEvent => ({
    ...event(seq, type),
    text: 'Começou a obra da Serraria.',
    data: { building: 'lumberMill', level: 2, spent_wood: 80 },
  });
  const woodOf = (report: ReturnReport | undefined) =>
    report?.resources.find((row) => row.id === 'wood');
  const stored = (store: ReturnType<typeof setup>['store']) =>
    store.get<GameCache>(cacheKey(target));

  /** Reabre a partida em outra sessão, com o mesmo servidor e o mesmo navegador. */
  function reopen(server: ReturnType<typeof setup>) {
    const session = new GameSession({
      client: server.client,
      store: server.store,
      now: () => Date.now(),
    });
    const reports: ReturnReport[] = [];
    const events: GameEvent[][] = [];
    session.onReturnReport((report) => reports.push(report));
    session.onEvents((batch) => events.push(batch));
    return { session, reports, events };
  }

  /** Cinco horas de ausência: o feudo produziu 60 de madeira e um dia virou. */
  async function fiveHoursLater(server: ReturnType<typeof setup>, wood: number, seq: number) {
    await vi.advanceTimersByTimeAsync(5 * HOUR);
    server.state.failEvents = null;
    server.state.view = withWood(wood);
    server.state.etag = 'W/"volta"';
    server.state.events.push(event(seq, 'dayStarted'));
  }

  it('a ordem dada antes de sair, com a leitura dos eventos falhando: o gasto dela não é da ausência', async () => {
    const first = setup();
    const { state } = first;
    state.view = withWood(100);
    await first.session.start(target);
    // A resposta da ordem traz a visão já com o custo pago e o evento que o conta.
    state.command = async () => {
      state.events.push(started(1));
      state.view = withWood(20);
      state.etag = 'W/"b"';
      return {
        view: withWood(20),
        events: [started(1)],
        stateVersion: '2',
        staleView: false,
        replayed: false,
      };
    };
    state.failEvents = new NetworkError('fora');
    await first.session.send(order);
    // O evento veio na resposta, logo depois do cursor: é entregue dali, uma vez, e o cursor
    // anda junto com a visão.
    expect(first.seen.events).toEqual([[started(1)]]);
    expect(stored(first.store)).toMatchObject({ view: withWood(20), lastSeq: 1 });
    expect(stored(first.store)).not.toHaveProperty('behind');
    first.session.stop();

    await fiveHoursLater(first, 80, 2);
    const back = reopen(first);
    await back.session.start(target);
    expect(state.lastAfter).toBe(1);
    expect(back.reports).toHaveLength(1);
    expect(woodOf(back.reports[0])).toEqual({
      id: 'wood',
      label: 'Madeira',
      before: 20,
      after: 80,
      delta: 60,
      spent: 0,
      received: 0,
      cut: 0,
      wasted: 0,
      raided: 0,
      produced: 60,
    });
    // A ordem não reaparece como novidade.
    expect(back.reports[0]?.highlights).toEqual([]);
    expect(back.events.flat().map((entry) => entry.seq)).toEqual([2]);
  });

  it('a recusa do motor também traz eventos: o cursor anda com a visão avançada', async () => {
    const first = setup();
    const { state } = first;
    state.view = withWood(100);
    await first.session.start(target);
    // O mundo avançou até a ordem: uma planejada começou sozinha e pagou 80 de madeira.
    state.command = async () => {
      state.events.push(started(1, 'constructionAutoStarted'));
      state.view = withWood(20);
      state.etag = 'W/"b"';
      throw new GameRuleClientError(
        'Os pedreiros já estão ocupados com outra obra.',
        {
          code: 'QUEUE_LOCKED',
          message: 'Os pedreiros já estão ocupados com outra obra.',
          view: withWood(20),
          events: [started(1, 'constructionAutoStarted')],
          stateVersion: '2',
          staleView: false,
        },
        false,
      );
    };
    state.failEvents = new NetworkError('fora');
    await expect(first.session.send(order)).rejects.toThrow('ocupados');
    expect(stored(first.store)).toMatchObject({ view: withWood(20), lastSeq: 1 });
    first.session.stop();

    await fiveHoursLater(first, 80, 2);
    const back = reopen(first);
    await back.session.start(target);
    expect(woodOf(back.reports[0])).toMatchObject({
      before: 20,
      delta: 60,
      spent: 0,
      produced: 60,
    });
  });

  it('a leitura do ciclo que traz a visão e perde os eventos: o relatório parte da visão que o cursor conhece', async () => {
    const first = setup();
    const { state } = first;
    state.view = withWood(100);
    await first.session.start(target);
    // Na leitura seguinte uma planejada já começou sozinha; a leitura dos eventos falha.
    state.events.push(started(1, 'constructionAutoStarted'));
    state.view = withWood(20);
    state.etag = 'W/"b"';
    state.failEvents = new NetworkError('fora');
    await vi.advanceTimersByTimeAsync(pollIntervalMs(false));
    // A tela mostra a visão nova, e é ela que fica guardada para o modo sem ligação; ao lado
    // vai a visão que corresponde ao cursor.
    expect(first.session.view).toEqual(withWood(20));
    expect(stored(first.store)).toMatchObject({
      view: withWood(20),
      lastSeq: 0,
      behind: withWood(100),
    });
    first.session.stop();

    await fiveHoursLater(first, 80, 2);
    const back = reopen(first);
    await back.session.start(target);
    // 100 → 80: a obra pagou 80 e o feudo produziu 60. Nada contado duas vezes.
    expect(woodOf(back.reports[0])).toMatchObject({
      before: 100,
      after: 80,
      delta: -20,
      spent: 80,
      produced: 60,
    });
    expect(back.reports[0]?.highlights).toEqual(['Começou a obra da Serraria.']);
    // Com os eventos lidos, a visão e o cursor voltam a andar juntos.
    expect(stored(first.store)).toMatchObject({ view: withWood(80), lastSeq: 2 });
    expect(stored(first.store)).not.toHaveProperty('behind');
  });

  it('a resposta da ordem com um salto no cursor: outra aba agiu antes, e a conta continua fechando', async () => {
    const first = setup();
    const { state } = first;
    state.view = withWood(100);
    await first.session.start(target);
    // Outra aba cumpriu um objetivo (+30 de madeira, evento 1) que esta ainda não leu.
    const reward: GameEvent = {
      ...event(1, 'objectiveCompleted'),
      text: 'Cumpriu-se um objetivo.',
      data: { objective: 'upgradeHousing', gained_wood: 30 },
    };
    state.command = async () => {
      state.events.push(reward, started(2));
      state.view = withWood(50);
      state.etag = 'W/"b"';
      return {
        view: withWood(50),
        events: [started(2)],
        stateVersion: '3',
        staleView: true,
        replayed: false,
      };
    };
    state.failEvents = new NetworkError('fora');
    await first.session.send(order);
    // O evento 1 não veio na resposta: o cursor não pode pular por cima dele.
    expect(first.seen.events).toEqual([]);
    expect(stored(first.store)).toMatchObject({
      view: withWood(50),
      lastSeq: 0,
      behind: withWood(100),
    });
    first.session.stop();

    await fiveHoursLater(first, 110, 3);
    const back = reopen(first);
    await back.session.start(target);
    expect(woodOf(back.reports[0])).toMatchObject({
      before: 100,
      after: 110,
      delta: 10,
      spent: 80,
      received: 30,
      produced: 60,
    });
    expect(back.events.flat().map((entry) => entry.seq)).toEqual([1, 2, 3]);
  });

  it('sem visão que corresponda ao cursor, o relatório sai sem as linhas de estoque', async () => {
    // O cache de outra versão do app perdeu a visão e guardou o cursor; a primeira leitura
    // trouxe a visão nova e perdeu os eventos.
    const first = setup({ ...cachedNow(), version: 'antiga', lastSeq: 4 });
    const { state } = first;
    state.view = withWood(20);
    state.failEvents = new NetworkError('fora');
    await first.session.start(target);
    expect(stored(first.store)).toMatchObject({ view: withWood(20), lastSeq: 4, behind: null });
    first.session.stop();

    await fiveHoursLater(first, 80, 5);
    const back = reopen(first);
    await back.session.start(target);
    expect(back.reports).toHaveLength(1);
    expect(back.reports[0]?.resources).toEqual([]);
    expect(back.reports[0]?.counts.daysPassed).toBe(1);
  });

  it('uma visão de base em outro formato não é usada: o relatório sai sem as linhas de estoque', async () => {
    const first = setup({
      ...cachedNow(),
      lastSeenAt: Date.now() - 5 * HOUR,
      behind: { settlement: { name: 'Pedra Alta' } } as unknown as ViewState,
    });
    first.state.view = withWood(80);
    first.state.etag = 'W/"volta"';
    await first.session.start(target);
    expect(first.seen.reports[0]?.resources).toEqual([]);
  });
});
