import type {
  Command,
  CurrentSeasonResponse,
  GameSummary,
  LeaderboardResponse,
} from '@lotg/protocol';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CACHE_VERSION, cacheKey, type GameCache, StaleOrderError } from '../game/gameSession';
import {
  ACCOUNT_ID,
  fakeApi,
  GAME_ID,
  gameEvent,
  goldenView,
  makeController,
  settle,
} from '../test-helpers';
import type { Controller } from './controller';

const NOW = Date.parse('2026-11-23T15:00:00Z');
const SEASON = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const SEASON_GAME = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OTHER_ACCOUNT = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const KEY = `lords.activeFief:${ACCOUNT_ID}`;
const HISTORY = `lords.seasonHistory:${ACCOUNT_ID}`;
const target = (gameId: string) => ({ serverKey: 'self', accountId: ACCOUNT_ID, gameId });
const seasonView = {
  ...goldenView,
  settlement: { ...goldenView.settlement, name: 'Vigia da Lua' },
};
const cache = (view: GameCache['view'], lastSeq: number): GameCache => ({
  view,
  lastSeq,
  version: CACHE_VERSION,
  stateVersion: '1',
  etag: null,
  lastSeenAt: NOW,
});
const controllers: Controller[] = [];

afterEach(() => {
  for (const controller of controllers.splice(0)) controller.dispose();
  vi.useRealTimers();
});

function fixture(joined = true, preferred?: 'season' | 'personal', now = () => NOW) {
  const api = fakeApi();
  const requests: string[] = [];
  const seasonalEvents = [gameEvent(24, 'raidRepelled', 'Vitória da Vigia.')];
  let refusal: Response | Promise<Response> | null = null;
  let post: Response | null = null;
  let chronicle: Response | null = null;
  let failOrder = false;
  const bodies: Command[] = [];
  const season: CurrentSeasonResponse['season'] = {
    id: SEASON,
    code: '2026-W48',
    status: 'open',
    timezone: 'America/Sao_Paulo',
    startsAt: '2026-11-23T03:00:00Z',
    joinEndsAt: '2026-11-25T03:00:00Z',
    endsAt: '2026-11-30T02:59:00Z',
    rankingPublishedAt: null,
    difficulty: 'lord',
    timeScale: 3,
    joinOpen: true,
    seed: null,
  };
  const seasonsGame = (): GameSummary => ({
    ...api.state.game!,
    id: SEASON_GAME,
    seasonId: SEASON,
    settlementName: 'Vigia da Lua',
    createdAt: new Date(NOW).toISOString(),
  });
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const { pathname, search, searchParams } = new URL(String(input));
    const method = init?.method ?? 'GET';
    const path = pathname.replace(/^\/v1/, '');
    requests.push(`${method} ${path}${search}`);
    if (path === '/games' && method === 'GET') {
      return Response.json({
        games: [api.state.game, ...(joined ? [seasonsGame()] : [])].filter(Boolean),
      });
    }
    if (path === '/seasons/current') {
      return Response.json({ season, joined, game: joined ? seasonsGame() : null });
    }
    if (path === '/seasons/current/join' && post !== null) return post;
    if (path === `/seasons/${SEASON}/chronicles/1` && chronicle !== null) return chronicle;
    if (path === '/leaderboard') {
      return Response.json({
        season,
        published: season.status === 'closed',
        entries: [
          {
            position: 1,
            settlementName: 'Vigia da Lua',
            score: 100,
            siegeOutcome: 'victory',
            feats: 1,
            mine: true,
            chronicleAvailable: true,
          },
        ],
        me: { listed: true, position: 1 },
      } satisfies LeaderboardResponse);
    }
    if (path === `/games/${SEASON_GAME}/view`) {
      return Response.json({ view: seasonView, stateVersion: '1' });
    }
    if (path === `/games/${SEASON_GAME}/events`) {
      const after = Number(searchParams.get('after'));
      const events = seasonalEvents.filter(({ seq }) => seq > after);
      return Response.json({ events, lastSeq: events.at(-1)?.seq ?? after, hasMore: false });
    }
    if (path === `/games/${SEASON_GAME}/chronicle`) {
      return Response.json({ entries: seasonalEvents });
    }
    if (path === `/games/${GAME_ID}/commands`) {
      bodies.push(JSON.parse(String(init?.body)) as Command);
      if (refusal !== null) return refusal;
      if (failOrder) throw new TypeError('Sem rede');
    }
    return api.fetch(input, init);
  };
  const made = makeController({ api, signedIn: true, now, overrides: { fetch } });
  const saved = made.store.data['lords.account:self'] as object;
  if (joined) made.store.data['lords.account:self'] = { ...saved, seasonGames: [seasonsGame()] };
  if (preferred !== undefined) made.store.data[KEY] = preferred;
  controllers.push(made.controller);
  return {
    ...made,
    requests,
    bodies,
    season,
    fail: (enabled: boolean) => {
      failOrder = enabled;
    },
    refuse: (response: Response | Promise<Response>) => {
      refusal = response;
    },
    rejectJoin: (code: string) => {
      post = Response.json(
        {
          code: code === 'ACTIVE_GAME_EXISTS' ? code : 'CONFLICT',
          message: 'Recusa',
          details: { reason: code },
        },
        { status: 409 },
      );
    },
    rejectChronicle: (status: number, code: string) => {
      chronicle = Response.json({ code, message: 'Sem Crônica' }, { status });
    },
  };
}

describe('Feudo pessoal e da Temporada', () => {
  it('mantém visão, avisos, cursor e cache de cada feudo separados', async () => {
    const { api, controller, requests, store } = fixture();
    const personalKey = cacheKey(target(GAME_ID));
    const seasonKey = cacheKey(target(SEASON_GAME));
    store.data[personalKey] = cache(goldenView, 7);
    store.data[seasonKey] = cache(seasonView, 23);
    api.state.events = [gameEvent(8, 'raidRepelled', 'Vitória de Pedra Alta.')];

    await controller.start();
    await settle(controller);
    expect(controller.chronicle.map((event) => event.text)).toEqual(['Vitória de Pedra Alta.']);
    expect(controller.toasts.some((toast) => toast.game)).toBe(true);
    expect(requests).toContain(`GET /games/${GAME_ID}/events?after=7&limit=100`);
    expect(requests.some((url) => url.startsWith(`GET /games/${SEASON_GAME}/`))).toBe(false);
    const personalToasts = controller.toasts.map((toast) => toast.id);
    const prepared = controller.prepare('setWorkers', { building: 'farm', count: 1 });

    requests.length = 0;
    await controller.switchFief('season');
    expect(controller.view?.settlement.name).toBe('Vigia da Lua');
    expect(controller.chronicle.map((event) => event.text)).toEqual(['Vitória da Vigia.']);
    expect(controller.toasts.every((toast) => !personalToasts.includes(toast.id))).toBe(true);
    expect(requests).toContain(`GET /games/${SEASON_GAME}/events?after=23&limit=100`);
    expect(requests.some((url) => url.startsWith(`GET /games/${GAME_ID}/`))).toBe(false);
    expect(store.get<GameCache>(personalKey)).toMatchObject({ lastSeq: 8, view: goldenView });
    expect(store.get<GameCache>(seasonKey)).toMatchObject({ lastSeq: 24, view: seasonView });
    await expect(prepared()).rejects.toBeInstanceOf(StaleOrderError);

    await controller.switchFief('personal');
    expect(controller.view?.settlement.name).toBe('Pedra Alta');
    expect(requests).toContain(`GET /games/${GAME_ID}/events?after=8&limit=100`);
    expect(controller.chronicle.map((event) => event.text)).toEqual(['Vitória de Pedra Alta.']);
    expect(api.state.commands).toHaveLength(0);
  });

  it('mantém UUID na retentativa local e invalida retentativa e resposta em voo após trocar', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const { controller, requests, bodies, fail, refuse } = fixture();
    await controller.start();
    await settle(controller);
    fail(true);
    const order = controller.order('setWorkers', { building: 'farm', count: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(await order).toBe(false);
    const retry = controller.toasts.find((toast) => toast.retry)?.actions[0];
    fail(false);
    await controller.session.syncNow();
    await retry?.run();
    expect(bodies.length).toBeGreaterThanOrEqual(2);
    expect(bodies.every((body) => body.commandId === bodies[0]?.commandId)).toBe(true);

    fail(true);
    const next = controller.order('setWorkers', { building: 'farm', count: 2 });
    await vi.advanceTimersByTimeAsync(2000);
    await next;
    const stale = controller.toasts.find((toast) => toast.retry)?.actions[0];
    fail(false);
    await controller.session.syncNow();

    let finish!: (response: Response) => void;
    refuse(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    const late = controller.order('setWorkers', { building: 'farm', count: 3 });
    await controller.switchFief('season');
    finish(Response.json({ code: 'INTERNAL', message: 'Falha do feudo antigo' }, { status: 500 }));
    expect(await late).toBe(false);
    const sent = requests.filter((url) => url.endsWith('/commands')).length;
    await stale?.run();
    expect(requests.filter((url) => url.endsWith('/commands'))).toHaveLength(sent);
    expect(controller.connection.kind).toBe('online');
    expect(
      controller.toasts.some((toast) => toast.retry || toast.text === 'Falha do feudo antigo'),
    ).toBe(false);
  });

  it('restaura só a preferência da conta e sair apaga os dois caches', async () => {
    const { controller, store } = fixture(true, 'season');
    const otherKey = `lords.activeFief:${OTHER_ACCOUNT}`;
    store.data[otherKey] = 'personal';
    store.data[cacheKey(target(GAME_ID))] = cache(goldenView, 4);
    store.data[cacheKey(target(SEASON_GAME))] = cache(seasonView, 20);
    await controller.start();
    await settle(controller);
    expect(controller.session.gameId).toBe(SEASON_GAME);
    expect(controller.activeFief).toBe('season');
    expect(store.get(HISTORY)).toBeDefined();

    await controller.signOut();
    expect(controller.session.gameId).toBeNull();
    expect(controller.view).toBeNull();
    expect(controller.currentSeason.status).toBe('idle');
    expect(store.get(KEY)).toBeUndefined();
    expect(store.get(HISTORY)).toBeUndefined();
    expect(store.get(cacheKey(target(GAME_ID)))).toBeUndefined();
    expect(store.get(cacheKey(target(SEASON_GAME)))).toBeUndefined();
    expect(store.get(otherKey)).toBe('personal');
  });

  it('antecipa a leitura quando o prazo de entrada vence antes do próximo ciclo', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
    vi.setSystemTime(new Date(NOW));
    const { controller, requests, season } = fixture(false, undefined, Date.now);
    season.joinEndsAt = new Date(NOW + 3000).toISOString();
    await controller.start();
    controller.navigate('kingdom');
    await settle(controller);
    requests.length = 0;
    season.joinOpen = false;

    await vi.advanceTimersByTimeAsync(4001);
    await settle(controller);
    expect(requests).toContain('GET /seasons/current');
    expect(controller.currentSeason).toMatchObject({ value: { season: { joinOpen: false } } });
  });

  it.each([
    ['SEASON_JOIN_CLOSED', 'As inscrições desta Temporada foram encerradas.'],
    ['SEASON_CLOSED', 'Esta Temporada já terminou.'],
    ['ACTIVE_GAME_EXISTS', 'Você já tem um feudo nesta Temporada.'],
  ])('exibe a recusa de entrada %s', async (code, message) => {
    const made = fixture(false);
    await made.controller.start();
    made.controller.navigate('kingdom');
    made.rejectJoin(code);
    await made.controller.joinSeason(SEASON, 'Vigia da Lua');
    expect(made.controller.seasonJoinError).toBe(message);
    expect(made.controller.session.gameId).toBe(GAME_ID);
  });

  it.each([
    [403, 'FORBIDDEN', 'Só quem disputou esta Temporada pode ler suas Crônicas.'],
    [404, 'NOT_FOUND', 'A Crônica deste feudo não está mais disponível nesta posição.'],
  ])('exibe a recusa de leitura %s', async (status, code, message) => {
    const made = fixture(false);
    made.season.status = 'closed';
    made.season.joinOpen = false;
    await made.controller.start();
    made.controller.navigate('kingdom');
    await made.controller.loadSeason();
    made.rejectChronicle(status, code);
    await made.controller.openSeasonChronicle(1);
    expect(made.controller.seasonChronicle?.document).toEqual({ status: 'error', message });
    made.controller.navigate('fief');
    expect(made.controller.seasonChronicle).toBeNull();
  });
});
