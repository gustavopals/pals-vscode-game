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
      if (state.fail) {
        throw state.fail;
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
      for (const version of [undefined, '1.1', `${PROTOCOL_VERSION + 1}.2`, 2]) {
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
          },
          famine: 'none',
          highlights: ['evento 4'],
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
