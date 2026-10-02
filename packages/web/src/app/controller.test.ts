import { ApiClientError, NetworkError } from '@lotg/client-sdk';
import type { Command, GameEvent, ViewState } from '@lotg/protocol';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CACHE_VERSION, cacheKey, type GameCache, OfflineError } from '../game/gameSession';
import type { BrowserNotifier } from '../notifications/browserNotifications';
import { DEFAULT_PREFERENCES, type Preferences } from '../services/preferences';
import { PREFERENCES_KEY } from '../services/tabSync';
import {
  ACCOUNT_ID,
  activeConstruction,
  autumnView,
  catalogFixture,
  coldView,
  fakeApi,
  GAME_ID,
  gameEvent,
  goldenView,
  makeController,
  queuesView,
  settle,
  withPlanned,
  withQueues,
} from '../test-helpers';
import { type Controller, describeError, type Toast, type ToastAction } from './controller';

const HOUR = 3_600_000;
const NOON = Date.parse('2026-10-01T12:00:00.000Z');
const OTHER_GAME_ID = '33333333-3333-4333-8333-333333333333';
const OTHER_ACCOUNT_ID = '44444444-4444-4444-8444-444444444444';

const ACCOUNT_KEY = 'lords.account:self';
const REMINDER_KEY = `lords.linkReminder:${ACCOUNT_ID}`;
const target = { serverKey: 'self', accountId: ACCOUNT_ID, gameId: GAME_ID };
const VIEW_REQUEST = `GET /games/${GAME_ID}/view`;
const COMMANDS_REQUEST = `POST /games/${GAME_ID}/commands`;

const SESSION_ENDED = 'A sessão neste navegador terminou';
const OFFLINE_ORDER = 'Sua ordem não foi enviada';
const APP_TITLE = 'Lords of the Guild';

type Made = ReturnType<typeof makeController>;
type MakeOptions = Parameters<typeof makeController>[0];

const created: Controller[] = [];

/** Um controlador que é encerrado no fim do teste, para o ciclo não ficar rodando. */
function make(options: MakeOptions = {}): Made {
  const made = makeController(options);
  created.push(made.controller);
  return made;
}

/** Como um navegador que já jogou: conta guardada, feudo aberto e tudo assentado. */
async function opened(options: MakeOptions = {}): Promise<Made> {
  const made = make({ signedIn: true, ...options });
  await made.controller.start();
  await settle(made.controller);
  return made;
}

/** Só os temporizadores e o relógio são de mentira: `settle` continua funcionando. */
function useFakeClock(): void {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] });
  vi.setSystemTime(new Date(NOON));
}

afterEach(() => {
  for (const controller of created.splice(0)) {
    controller.dispose();
  }
  vi.useRealTimers();
});

const count = (requests: string[], request: string) =>
  requests.filter((entry) => entry === request).length;

/** Os avisos de acontecimentos do jogo: os que têm o botão "Ver". */
const gameToasts = (controller: Controller): Toast[] =>
  controller.toasts.filter((toast) => toast.actions.some((entry) => entry.label === 'Ver'));

const toastWith = (controller: Controller, fragment: string): Toast | undefined =>
  controller.toasts.find((toast) => toast.text.includes(fragment));

function actionOf(toast: Toast | undefined, label: string): ToastAction {
  const found = toast?.actions.find((entry) => entry.label === label);
  if (found === undefined) {
    throw new Error(`O aviso não tem o botão "${label}".`);
  }
  return found;
}

/** Entrega eventos novos pelo caminho de verdade: o servidor os tem e a sessão os busca. */
async function deliver(made: Made, ...events: GameEvent[]): Promise<void> {
  made.api.state.events.push(...events);
  await made.controller.session.syncNow();
  await settle(made.controller);
}

/** O servidor passa a mostrar outra visão (a versão muda junto, como numa escrita). */
async function serverShows(made: Made, view: ViewState): Promise<void> {
  made.api.state.view = view;
  made.api.state.stateVersion += 1;
  await made.controller.session.syncNow();
  await settle(made.controller);
}

const cachedAt = (lastSeenAt: number, lastSeq = 0): GameCache => ({
  version: CACHE_VERSION,
  view: goldenView,
  stateVersion: '1',
  etag: null,
  lastSeq,
  lastSeenAt,
});

function fakeNotifier(answer: boolean, supported = true) {
  const log = { requests: 0, shown: [] as Array<{ title: string; body: string }> };
  let granted = false;
  const notifier: BrowserNotifier = {
    supported,
    granted: () => granted,
    request: async () => {
      log.requests += 1;
      granted = answer;
      return answer;
    },
    show: (title, body) => {
      log.shown.push({ title, body });
    },
  };
  return {
    notifier,
    log,
    revoke: () => {
      granted = false;
    },
  };
}

describe('describeError', () => {
  it('ordem não enviada por falta de ligação: código NETWORK e a frase da recusa', () => {
    const described = describeError(new OfflineError());
    expect(described.code).toBe('NETWORK');
    expect(described.message).toContain(OFFLINE_ORDER);
  });

  it('falha de rede: código NETWORK e uma frase do jogo, não a mensagem técnica', () => {
    const described = describeError(new NetworkError('fetch failed'));
    expect(described.code).toBe('NETWORK');
    expect(described.message).toContain('Sem ligação com o reino');
    expect(described.message).not.toContain('fetch failed');
  });

  it('erro da API: o código e a frase que o servidor mandou', () => {
    const error = new ApiClientError(409, 'CONFLICT', 'Partida arquivada.', undefined);
    expect(describeError(error)).toEqual({ code: 'CONFLICT', message: 'Partida arquivada.' });
  });

  it('qualquer outra coisa vira INTERNAL com a mensagem disponível', () => {
    expect(describeError(new Error('quebrou'))).toEqual({ code: 'INTERNAL', message: 'quebrou' });
    expect(describeError('texto solto')).toEqual({ code: 'INTERNAL', message: 'texto solto' });
  });
});

describe('opções de nova partida (GET /catalog)', () => {
  const CATALOG = 'GET /catalog';

  it('sem feudo, chegam junto com as boas-vindas, com o que o servidor manda marcar', async () => {
    const { controller, api } = make();
    expect(controller.newGameOptions).toBeNull();
    await controller.start();
    await settle(controller);
    expect(controller.catalog.status).toBe('ready');
    expect(controller.newGameOptions).toEqual(catalogFixture().newGame);
    expect(controller.newGameOptions?.defaults).toEqual({ difficulty: 'lord', timeScale: 3 });
    expect(count(api.state.requests, CATALOG)).toBe(1);
  });

  it('avisa a bancada quando chegam, para as boas-vindas ganharem as opções', async () => {
    const { controller } = make();
    const seen: Array<string> = [];
    controller.onChange(() => seen.push(controller.catalog.status));
    await controller.start();
    await settle(controller);
    expect(seen).toContain('loading');
    expect(seen.at(-1)).toBe('ready');
  });

  it('com feudo aberto não são pedidas: só ao ir às Preferências, e uma vez só', async () => {
    const { controller, api } = await opened();
    expect(count(api.state.requests, CATALOG)).toBe(0);
    expect(controller.newGameOptions).toBeNull();
    controller.navigate('settings');
    await settle(controller);
    expect(controller.newGameOptions).not.toBeNull();
    controller.navigate('fief');
    controller.navigate('settings');
    await controller.loadCatalog();
    await settle(controller);
    expect(count(api.state.requests, CATALOG)).toBe(1);
  });

  it('página aberta direto nas Preferências, com feudo: as opções vêm para dizer o que a dificuldade muda', async () => {
    const { controller, api } = make({ signedIn: true });
    await controller.start('settings');
    await settle(controller);
    expect(controller.route).toBe('settings');
    expect(count(api.state.requests, CATALOG)).toBe(1);
    expect(controller.newGameOptions).not.toBeNull();
  });

  it('página aberta em "Sobre", sem conta: só pede as opções ao ir às boas-vindas', async () => {
    const { controller, api } = make();
    await controller.start('about');
    await settle(controller);
    expect(count(api.state.requests, CATALOG)).toBe(0);
    controller.closeTab('about');
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(count(api.state.requests, CATALOG)).toBe(1);
  });

  it('pedidos simultâneos dividem a mesma leitura', async () => {
    const { controller, api } = await opened();
    await Promise.all([
      controller.loadCatalog(),
      controller.loadCatalog(),
      controller.loadCatalog(),
    ]);
    expect(count(api.state.requests, CATALOG)).toBe(1);
    expect(controller.catalog.status).toBe('ready');
  });

  it('servidor de uma versão anterior (404): sem opções, sem aviso, e "Jogar agora" funciona', async () => {
    const api = fakeApi();
    api.state.catalog = null;
    const { controller, logs } = make({ api });
    await controller.start();
    await settle(controller);
    expect(controller.catalog.status).toBe('error');
    expect(controller.newGameOptions).toBeNull();
    // Não é problema do jogador: fica no console, não na tela.
    expect(controller.toasts).toEqual([]);
    expect(logs.join(' ')).toContain('Opções de nova partida indisponíveis');

    await controller.playNow('Gustavo', 'Pedra Alta');
    await settle(controller);
    expect(controller.route).toBe('fief');
    expect(api.state.gameRequests).toEqual([
      { settlementName: 'Pedra Alta', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    ]);
  });

  it('resposta em formato desconhecido é tratada como ausência, mesmo sem a validação do SDK', async () => {
    const api = fakeApi();
    // Os padrões fora das opções: a tela não teria o que marcar.
    api.state.catalog = catalogFixture({ difficulty: 'lord', timeScale: 7 });
    const { controller } = make({ api, overrides: { validateResponses: false } });
    await controller.start();
    await settle(controller);
    expect(controller.catalog.status).toBe('error');
    expect(controller.newGameOptions).toBeNull();
    expect(controller.toasts).toEqual([]);
  });

  it('sem rede na abertura, são lidas quando a ligação volta', async () => {
    useFakeClock();
    const api = fakeApi();
    api.state.online = false;
    const { controller } = make({ api });
    const starting = controller.start();
    // O SDK tenta de novo algumas vezes antes de desistir.
    await vi.advanceTimersByTimeAsync(10_000);
    await starting;
    await settle(controller);
    expect(controller.catalog.status).toBe('error');

    api.state.online = true;
    controller.handleOnline();
    await settle(controller);
    expect(controller.catalog.status).toBe('ready');
    expect(controller.newGameOptions?.paces).toHaveLength(3);
  });

  it('se o servidor recusa a escolha (o conteúdo mudou com a aba aberta), as opções são lidas de novo', async () => {
    const { controller, api } = make();
    await controller.start();
    await settle(controller);
    api.state.failNext.set('/games', {
      status: 400,
      body: { code: 'VALIDATION', message: 'Ritmo fora dos oferecidos.' },
    });
    api.state.catalog = catalogFixture({ difficulty: 'lord', timeScale: 1 });
    await expect(
      controller.playNow('Gustavo', 'Pedra Alta', { difficulty: 'lord', timeScale: 3 }),
    ).rejects.toThrow('Ritmo fora dos oferecidos.');
    await settle(controller);
    expect(count(api.state.requests, CATALOG)).toBe(2);
    expect(controller.newGameOptions?.defaults.timeScale).toBe(1);
    // Outras falhas não mexem nas opções.
    api.state.failNext.set('/games', {
      status: 500,
      body: { code: 'INTERNAL', message: 'O servidor tropeçou.' },
    });
    await expect(controller.playNow('Gustavo', 'Pedra Alta')).rejects.toThrow();
    await settle(controller);
    expect(count(api.state.requests, CATALOG)).toBe(2);
  });

  it('sair da conta leva às boas-vindas já com as opções', async () => {
    const { controller, api } = await opened();
    expect(count(api.state.requests, CATALOG)).toBe(0);
    await controller.signOut();
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(controller.newGameOptions).not.toBeNull();
    expect(count(api.state.requests, CATALOG)).toBe(1);
  });

  it('"Nova partida" pelo controlador arquiva o feudo atual e leva a escolha', async () => {
    const { controller, api } = await opened();
    await controller.startNewGame('Vau Alto', { difficulty: 'peasant', timeScale: 1 });
    await settle(controller);
    expect(api.state.gameRequests).toEqual([
      {
        settlementName: 'Vau Alto',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        difficulty: 'peasant',
        timeScale: 1,
        replaceActive: true,
      },
    ]);
    expect(controller.busy).toBe(false);
  });
});

describe('abertura da página', () => {
  it('sem conta: boas-vindas, e nada é pedido ao servidor em nome de ninguém', async () => {
    const { controller, api } = make();
    await controller.start();
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(controller.account.state).toEqual({ kind: 'signedOut' });
    expect(controller.hasGame).toBe(false);
    expect(controller.view).toBeNull();
    expect(controller.tabs).toEqual(['welcome']);
    // Só o que é público: a versão do servidor e as opções de nova partida.
    expect([...api.state.requests].sort()).toEqual(['GET /catalog', 'GET /version']);
    expect(controller.toasts).toEqual([]);
  });

  it('"Jogar agora": cria a conta, funda o feudo e abre a aba Feudo', async () => {
    const { controller, api, store } = make();
    await controller.start();
    await controller.playNow('Gustavo', 'Vale Verde');
    await settle(controller);

    expect(controller.route).toBe('fief');
    expect(controller.account.state).toMatchObject({
      kind: 'anonymous',
      accountId: ACCOUNT_ID,
      displayName: 'Gustavo',
      gameId: GAME_ID,
    });
    expect(controller.hasGame).toBe(true);
    expect(controller.view?.settlement.name).toBe('Vale Verde');
    expect(controller.tabs).toEqual(['today', 'fief', 'council']);
    expect(controller.busy).toBe(false);
    // A conta fica guardada neste navegador para a próxima visita.
    expect(store.get(ACCOUNT_KEY)).toMatchObject({ accountId: ACCOUNT_ID, gameId: GAME_ID });
    // Do clique ao painel, uma conta e um feudo: nada em dobro.
    expect(count(api.state.requests, 'POST /auth/anonymous')).toBe(1);
    expect(count(api.state.requests, 'POST /games')).toBe(1);
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
  });

  it('"Jogar agora" marca a interface como ocupada enquanto corre', async () => {
    const { controller } = make();
    await controller.start();
    const busy: boolean[] = [];
    controller.onChange(() => busy.push(controller.busy));
    await controller.playNow('Gustavo', 'Pedra Alta');
    expect(busy[0]).toBe(true);
    expect(busy.at(-1)).toBe(false);
    expect(controller.busy).toBe(false);
  });

  it('se a fundação do feudo falha, a conta já criada é reaproveitada na nova tentativa', async () => {
    const { controller, api } = make();
    await controller.start();
    api.state.failNext.set('/games', {
      status: 500,
      body: { code: 'INTERNAL', message: 'O servidor tropeçou.' },
    });
    await expect(controller.playNow('Gustavo', 'Pedra Alta')).rejects.toThrow(
      'O servidor tropeçou.',
    );
    await settle(controller);
    expect(controller.busy).toBe(false);
    expect(controller.route).toBe('welcome');
    expect(controller.account.state).toMatchObject({ kind: 'anonymous', gameId: null });

    await controller.playNow('Gustavo', 'Pedra Alta');
    await settle(controller);
    expect(controller.route).toBe('fief');
    expect(count(api.state.requests, 'POST /auth/anonymous')).toBe(1);
  });

  it('envia o fuso deste navegador e a Hora da Vigília das preferências', async () => {
    const { controller } = make();
    await controller.setPreferences({ vigilHour: 7 });
    expect(controller.gameDefaults()).toEqual({
      timezone: 'America/Sao_Paulo',
      vigilHourLocal: 7,
    });
  });

  it('"Jogar agora" sem escolha manda o corpo da v0.1: valem os padrões do servidor', async () => {
    const { controller, api } = make();
    await controller.start();
    await controller.playNow('Gustavo', 'Vale Verde');
    expect(api.state.gameRequests).toEqual([
      { settlementName: 'Vale Verde', timezone: 'America/Sao_Paulo', vigilHourLocal: 20 },
    ]);
  });

  it('"Jogar agora" com a dificuldade e o ritmo marcados manda os dois', async () => {
    const { controller, api } = make();
    await controller.start();
    await controller.playNow('Gustavo', 'Vale Verde', { difficulty: 'ironKing', timeScale: 0.5 });
    await settle(controller);
    expect(api.state.gameRequests).toEqual([
      {
        settlementName: 'Vale Verde',
        timezone: 'America/Sao_Paulo',
        vigilHourLocal: 20,
        difficulty: 'ironKing',
        timeScale: 0.5,
      },
    ]);
    expect(controller.route).toBe('fief');
    expect(count(api.state.requests, 'POST /games')).toBe(1);
  });

  it('com conta guardada: abre a sessão e cai na aba Feudo', async () => {
    const { controller, api, store } = await opened();
    expect(controller.route).toBe('fief');
    expect(controller.view?.settlement.name).toBe('Pedra Alta');
    expect(controller.connection).toEqual({ kind: 'online' });
    expect(controller.tabs).toEqual(['today', 'fief', 'council']);
    expect(count(api.state.requests, VIEW_REQUEST)).toBe(1);
    // Nenhuma conta nova: a guardada foi retomada.
    expect(count(api.state.requests, 'POST /auth/anonymous')).toBe(0);
    expect(store.get<GameCache>(cacheKey(target))?.view.settlement.name).toBe('Pedra Alta');
    expect(controller.toasts).toEqual([]);
  });

  it('anota quando a visão chegou, para a contagem regressiva local', async () => {
    const { controller } = await opened({ now: () => NOON });
    expect(controller.viewReceivedAt).toBe(NOON);
  });

  it('traz as últimas 20 linhas da Crônica, cada uma só uma vez', async () => {
    const api = fakeApi();
    api.state.events = Array.from({ length: 25 }, (_, index) =>
      gameEvent(index + 1, 'constructionFinished'),
    );
    const { controller } = await opened({ api });
    expect(controller.chronicle.map((event) => event.seq)).toEqual(
      Array.from({ length: 20 }, (_, index) => index + 6),
    );
  });

  it('as viradas de dia não aparecem na Crônica recente da abertura (ADR 0007)', async () => {
    const api = fakeApi();
    api.state.events = [
      gameEvent(1, 'constructionFinished', 'A Serraria ficou pronta.'),
      gameEvent(2, 'dayStarted', 'Amanheceu.'),
      gameEvent(3, 'recruitmentFinished', 'Chegou um aldeão.'),
      gameEvent(4, 'dayStarted', 'Amanheceu de novo.'),
    ];
    const { controller } = await opened({ api });
    expect(controller.chronicle.map((event) => event.text)).toEqual([
      'A Serraria ficou pronta.',
      'Chegou um aldeão.',
    ]);
  });

  it('respeita a aba pedida pelo endereço', async () => {
    const withGame = make({ signedIn: true });
    await withGame.controller.start('settings');
    expect(withGame.controller.route).toBe('settings');
    expect(withGame.controller.tabs).toEqual(['today', 'fief', 'council', 'settings']);

    const today = make({ signedIn: true });
    await today.controller.start('today');
    expect(today.controller.route).toBe('today');

    const signedOut = make();
    await signedOut.controller.start('about');
    expect(signedOut.controller.route).toBe('about');
    expect(signedOut.controller.tabs).toEqual(['welcome', 'about']);
  });

  it('sem feudo, as abas do jogo pedidas pelo endereço levam às boas-vindas', async () => {
    for (const requested of ['today', 'fief', 'chronicle'] as const) {
      const { controller } = make();
      await controller.start(requested);
      expect(controller.route).toBe('welcome');
      expect(controller.tabs).toEqual(['welcome']);
    }
  });

  it('com feudo, o endereço das boas-vindas leva ao Feudo', async () => {
    const { controller } = make({ signedIn: true });
    await controller.start('welcome');
    expect(controller.route).toBe('fief');
  });

  // Recarregar a página em `#/cronica` (F3W-T2.3) precisa carregar o texto: quem cuida disso
  // não é só `navigate()`.
  it('abrir a página direto na Crônica carrega o texto dela', async () => {
    const { controller } = make({ signedIn: true });
    await controller.start('chronicle');
    await settle(controller);
    expect(controller.route).toBe('chronicle');
    expect(controller.tabs).toEqual(['today', 'fief', 'council', 'chronicle']);
    expect(controller.chronicleDocument.status).toBe('ready');
  });

  it('lê a versão do servidor e se o vínculo com o GitHub está ligado', async () => {
    const on = await opened();
    expect(on.controller.server.status).toBe('ready');
    expect(on.controller.githubAvailable).toBe(true);

    const api = fakeApi();
    api.state.githubDevice = false;
    const off = await opened({ api });
    expect(off.controller.githubAvailable).toBe(false);
  });

  it('a partida arquivada em outro navegador é trocada pela ativa, sem cache da antiga', async () => {
    const made = await opened();
    const { controller, api, store } = made;
    const game = api.state.game;
    if (game === null) {
      throw new Error('A API de mentira deveria ter uma partida.');
    }
    // Outro navegador fundou um feudo novo: o antigo deixou de existir para o servidor.
    api.state.game = { ...game, id: OTHER_GAME_ID };
    await controller.session.syncNow();
    await settle(controller);

    expect(controller.account.state).toMatchObject({
      accountId: ACCOUNT_ID,
      gameId: OTHER_GAME_ID,
    });
    expect(controller.session.gameId).toBe(OTHER_GAME_ID);
    expect(controller.route).toBe('fief');
    expect(controller.view).not.toBeNull();
    expect(store.get(cacheKey(target))).toBeUndefined();
    expect(store.get(cacheKey({ ...target, gameId: OTHER_GAME_ID }))).toBeDefined();
    // Continua na mesma conta: não é fim de sessão.
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
  });
});

describe('ordens ao feudo', () => {
  it('prepare fixa o commandId: enviar duas vezes manda a mesma ordem', async () => {
    const { controller, api } = await opened();
    const send = controller.prepare('setWorkers', { building: 'farm', count: 2 });
    // Preparar não envia nada.
    expect(api.state.commands).toEqual([]);
    await send();
    await send();
    expect(api.state.commands).toHaveLength(2);
    expect(api.state.commands[1]).toEqual(api.state.commands[0]);
    expect(api.state.commands[0]).toEqual({
      commandId: expect.stringMatching(/^[0-9a-f-]{36}$/) as string,
      type: 'setWorkers',
      payload: { building: 'farm', count: 2 },
    });
  });

  it('cada intenção nova do jogador tem o seu commandId', async () => {
    const { controller, api } = await opened();
    expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(true);
    expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(true);
    const ids = api.state.commands.map((command) => command.commandId);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toBe(ids[1]);
    expect(controller.toasts).toEqual([]);
  });

  it('uma ordem aceita atualiza a versão do estado guardado', async () => {
    const { controller } = await opened();
    const before = controller.session.stateVersion;
    await controller.order('setWorkers', { building: 'farm', count: 1 });
    expect(controller.session.stateVersion).not.toBe(before);
  });

  it('a recusa do motor vira um aviso com a frase do servidor, sem "Tentar de novo"', async () => {
    const { controller, api } = await opened();
    api.refuseNextCommand('Faltam 30 de madeira e 35 de pedra.');
    const ok = await controller.order('setWorkers', { building: 'farm', count: 99 });
    expect(ok).toBe(false);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({
      kind: 'warning',
      text: 'Faltam 30 de madeira e 35 de pedra.',
      actions: [],
      sticky: false,
    });
    // A recusa não derruba a ligação nem a sessão.
    expect(controller.connection).toEqual({ kind: 'online' });
    expect(controller.route).toBe('fief');
  });

  it('falha de rede: erro com "Tentar de novo", que reenvia a mesmíssima ordem', async () => {
    useFakeClock();
    const api = fakeApi();
    const bodies: Command[] = [];
    const recordingFetch: typeof fetch = (input, init) => {
      if (String(input).endsWith('/commands') && typeof init?.body === 'string') {
        bodies.push(JSON.parse(init.body) as Command);
      }
      return api.fetch(input, init);
    };
    const { controller } = await opened({ api, overrides: { fetch: recordingFetch } });

    api.state.online = false;
    const ordering = controller.order('setWorkers', { building: 'farm', count: 2 });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await ordering).toBe(false);

    const toast = toastWith(controller, 'Sem ligação com o reino');
    expect(toast).toMatchObject({ kind: 'error', sticky: true });
    const retry = actionOf(toast, 'Tentar de novo');
    expect(api.state.commands).toEqual([]);
    const attempts = bodies.length;
    expect(attempts).toBeGreaterThanOrEqual(1);

    // A ligação volta e o jogador aperta "Tentar de novo".
    api.state.online = true;
    controller.handleOnline();
    await settle(controller);
    expect(controller.connection).toEqual({ kind: 'online' });
    await retry.run();

    expect(api.state.commands).toHaveLength(1);
    expect(bodies).toHaveLength(attempts + 1);
    // Todas as tentativas, as do SDK e a do botão, levaram a mesma ordem.
    for (const body of bodies) {
      expect(body).toEqual(bodies[0]);
    }
    expect(api.state.commands[0]).toEqual(bodies[0]);
  });

  // O aviso de falta de rede fica à vista quando a ligação volta: é só então que o "Tentar de
  // novo" dele consegue reenviar a ordem (F3W-T6.3).
  it('o aviso com "Tentar de novo" continua à vista quando a ligação volta', async () => {
    useFakeClock();
    const made = await opened();
    const { controller, api } = made;
    api.state.online = false;
    const ordering = controller.order('setWorkers', { building: 'farm', count: 2 });
    await vi.advanceTimersByTimeAsync(2_000);
    expect(await ordering).toBe(false);

    api.state.online = true;
    controller.handleOnline();
    await settle(controller);
    expect(controller.connection).toEqual({ kind: 'online' });

    const toast = controller.toasts.find((entry) =>
      entry.actions.some((action) => action.label === 'Tentar de novo'),
    );
    expect(toast).toBeDefined();
    await actionOf(toast, 'Tentar de novo').run();
    expect(api.state.commands).toHaveLength(1);
  });

  it('"Tentar de novo" que falha de novo mantém o aviso, com a mesma ordem', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    api.state.online = false;
    const ordering = controller.order('setWorkers', { building: 'farm', count: 2 });
    await vi.advanceTimersByTimeAsync(2_000);
    await ordering;

    // Ainda sem ligação: a nova tentativa é recusada na hora e o botão continua lá.
    await actionOf(toastWith(controller, 'Sem ligação com o reino'), 'Tentar de novo').run();
    const again = toastWith(controller, OFFLINE_ORDER);
    expect(again).toMatchObject({ kind: 'error' });
    expect(again?.actions.map((entry) => entry.label)).toEqual(['Tentar de novo']);
    expect(api.state.commands).toEqual([]);
  });

  it('sem feudo aberto, a ordem é recusada sem tocar a rede', async () => {
    const { controller, api } = make();
    await controller.start();
    await settle(controller);
    const requests = api.state.requests.length;

    await expect(
      controller.prepare('setWorkers', { building: 'farm', count: 1 })(),
    ).rejects.toBeInstanceOf(OfflineError);
    expect(await controller.order('setWorkers', { building: 'farm', count: 1 })).toBe(false);

    expect(api.state.requests).toHaveLength(requests);
    expect(api.state.commands).toEqual([]);
    expect(toastWith(controller, OFFLINE_ORDER)).toMatchObject({ kind: 'error' });
  });

  it('attempt devolve verdadeiro quando a ação dá certo e não mostra aviso', async () => {
    const { controller } = make();
    expect(await controller.attempt(async () => {})).toBe(true);
    expect(controller.toasts).toEqual([]);
  });

  it('outra falha qualquer vira um erro com a mensagem, sem "Tentar de novo"', async () => {
    const { controller } = make();
    const ok = await controller.attempt(async () => {
      throw new ApiClientError(409, 'CONFLICT', 'A partida foi arquivada.', undefined);
    });
    expect(ok).toBe(false);
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]).toMatchObject({
      kind: 'error',
      text: 'A partida foi arquivada.',
      actions: [],
    });
  });
});

describe('avisos de acontecimentos', () => {
  it('com "todas", 5 obras em uma hora dão 3 avisos e badge 2', async () => {
    let clock = NOON;
    const made = await opened({ now: () => clock });
    const { controller } = made;
    await controller.setPreferences({ notifications: 'all' });

    for (let seq = 1; seq <= 5; seq += 1) {
      await deliver(made, gameEvent(seq, 'constructionFinished', `Obra ${seq} concluída.`));
      clock += 10 * 60_000;
    }

    expect(gameToasts(controller).map((toast) => toast.text)).toEqual([
      'Obra 1 concluída.',
      'Obra 2 concluída.',
      'Obra 3 concluída.',
    ]);
    for (const toast of gameToasts(controller)) {
      expect(toast.actions.map((entry) => entry.label)).toEqual(['Ver', 'Silenciar 2h']);
      expect(toast.kind).toBe('info');
      expect(toast.sticky).toBe(true);
    }
    expect(controller.unseen).toBe(2);
    expect(controller.statusInput(0).pending).toBe(2);
  });

  it('as 5 chegando de uma vez dão o mesmo resultado', async () => {
    const made = await opened({ now: () => NOON });
    await made.controller.setPreferences({ notifications: 'all' });
    await deliver(
      made,
      ...[1, 2, 3, 4, 5].map((seq) => gameEvent(seq, 'constructionFinished', `Obra ${seq}.`)),
    );
    expect(gameToasts(made.controller)).toHaveLength(3);
    expect(made.controller.unseen).toBe(2);
  });

  it('passada uma hora, os avisos voltam a aparecer', async () => {
    let clock = NOON;
    const made = await opened({ now: () => clock });
    const { controller } = made;
    await controller.setPreferences({ notifications: 'all' });
    await deliver(
      made,
      ...[1, 2, 3, 4].map((seq) => gameEvent(seq, 'constructionFinished', `Obra ${seq}.`)),
    );
    expect(toastWith(controller, 'Obra 4.')).toBeUndefined();

    clock += HOUR + 1;
    await deliver(made, gameEvent(5, 'constructionFinished', 'Obra 5.'));
    expect(toastWith(controller, 'Obra 5.')).toBeDefined();
  });

  it('um evento nunca é avisado duas vezes', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    const [toast] = gameToasts(controller);
    expect(toast).toBeDefined();
    controller.dismissToast(toast?.id ?? -1);

    await controller.session.syncNow();
    await settle(controller);
    expect(gameToasts(controller)).toEqual([]);
  });

  it('no nível padrão (essencial) só a fome avisa, como alerta', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    expect(controller.preferences.notifications).toBe('essential');
    await deliver(
      made,
      gameEvent(1, 'constructionFinished', 'A serraria ficou pronta.'),
      gameEvent(2, 'dayStarted', 'Amanheceu.'),
      gameEvent(3, 'famineStarted', 'A fome chegou a Pedra Alta.'),
      gameEvent(4, 'objectiveCompleted', 'Objetivo cumprido.'),
    );
    expect(gameToasts(controller)).toHaveLength(1);
    expect(gameToasts(controller)[0]).toMatchObject({
      kind: 'warning',
      text: 'A fome chegou a Pedra Alta.',
    });
    expect(controller.unseen).toBe(0);
  });

  it('o frio avisa no nível padrão, como alerta e com o ícone dele; o fim do frio, como alívio', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    expect(controller.preferences.notifications).toBe('essential');
    const started =
      'No 4º dia do Inverno, queimou-se a última acha de lenha em Pedra Alta. O frio entrou nas casas.';
    const ended =
      'No 6º dia do Inverno, as lareiras voltaram a arder em Pedra Alta. O frio passou.';
    await deliver(
      made,
      gameEvent(1, 'seasonChanged', 'Chega o Inverno a Pedra Alta.'),
      gameEvent(2, 'coldStarted', started),
    );
    // O texto é a frase da Crônica, como veio no evento.
    expect(gameToasts(controller)).toHaveLength(1);
    expect(gameToasts(controller)[0]).toMatchObject({
      kind: 'warning',
      icon: 'flame',
      text: started,
      sticky: true,
    });
    expect(gameToasts(controller)[0]?.actions.map((action) => action.label)).toEqual([
      'Ver',
      'Silenciar 2h',
    ]);

    await deliver(made, gameEvent(3, 'coldEnded', ended));
    expect(gameToasts(controller)).toHaveLength(2);
    expect(toastWith(controller, 'as lareiras voltaram a arder')).toMatchObject({
      kind: 'info',
      icon: 'flame',
    });
    expect(controller.unseen).toBe(0);
  });

  it('a moral que desce de faixa e a gente que se vai avisam no nível padrão, como alerta; a que sobe, como alívio', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    expect(controller.preferences.notifications).toBe('essential');
    const fell = {
      ...gameEvent(1, 'moraleBandChanged', 'O povo de Pedra Alta anda inquieto.'),
      data: { morale: 30, band: 'restless', previousMorale: 60, previousBand: 'content' },
    };
    const deserted = {
      ...gameEvent(2, 'villagerDeserted', 'Um lavrador fugiu da fome de Pedra Alta.'),
      data: { villagers: 4, morale: 30, building: 'farm' },
    };
    // O colono que chega é boa notícia: no nível padrão não interrompe ninguém.
    await deliver(made, fell, deserted, gameEvent(3, 'villagerArrived', 'Um colono chegou.'));
    expect(gameToasts(controller)).toHaveLength(2);
    // O ícone da mudança de faixa é o da faixa nova; o texto é a frase da Crônica.
    expect(toastWith(controller, 'anda inquieto')).toMatchObject({
      kind: 'warning',
      icon: 'comment-discussion',
      sticky: true,
    });
    expect(toastWith(controller, 'fugiu da fome')).toMatchObject({
      kind: 'warning',
      icon: 'sign-out',
      sticky: true,
    });

    const rose = {
      ...gameEvent(4, 'moraleBandChanged', 'Os resmungos cessaram. O povo está contente.'),
      data: { morale: 50, band: 'content', previousMorale: 30, previousBand: 'restless' },
    };
    await deliver(made, rose);
    expect(toastWith(controller, 'Os resmungos cessaram')).toMatchObject({
      kind: 'info',
      icon: 'smiley',
    });
    expect(controller.unseen).toBe(0);
  });

  it('a fome continua com o ícone do tom, e o fim dela também avisa', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou a Pedra Alta.'));
    const alarm = toastWith(controller, 'A fome chegou');
    expect(alarm).toMatchObject({ kind: 'warning' });
    expect(alarm).not.toHaveProperty('icon');
    await deliver(made, gameEvent(2, 'famineEnded', 'Voltou a haver pão. A fome acabou.'));
    const relief = toastWith(controller, 'A fome acabou');
    expect(relief).toMatchObject({ kind: 'info' });
    expect(relief).not.toHaveProperty('icon');
  });

  it('no nível silencioso nada aparece, nem como badge', async () => {
    const made = await opened({ now: () => NOON });
    await made.controller.setPreferences({ notifications: 'silent' });
    await deliver(
      made,
      gameEvent(1, 'famineStarted', 'A fome chegou.'),
      gameEvent(2, 'constructionFinished', 'Obra concluída.'),
    );
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.unseen).toBe(0);
  });

  it('no modo discreto nada aparece, nem com "todas"', async () => {
    const made = await opened({ now: () => NOON });
    await made.controller.setPreferences({ notifications: 'all', discreetMode: true });
    await deliver(
      made,
      gameEvent(1, 'famineStarted', 'A fome chegou.'),
      gameEvent(2, 'constructionFinished', 'Obra concluída.'),
    );
    expect(made.controller.toasts).toEqual([]);
    expect(made.controller.unseen).toBe(0);
  });

  it('ligar o modo discreto tira da vista os avisos que já estavam lá', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    expect(gameToasts(controller)).toHaveLength(1);
    await controller.setPreferences({ discreetMode: true });
    expect(gameToasts(controller)).toEqual([]);
  });

  it('"Silenciar 2h" cala os avisos, guarda o prazo e o resto vira badge', async () => {
    let clock = NOON;
    const made = await opened({ now: () => clock });
    const { controller, store } = made;
    await controller.setPreferences({ notifications: 'all' });
    await deliver(made, gameEvent(1, 'constructionFinished', 'Obra 1.'));

    await actionOf(toastWith(controller, 'Obra 1.'), 'Silenciar 2h').run();
    await settle(controller);
    // Os avisos do jogo à vista somem junto.
    expect(gameToasts(controller)).toEqual([]);
    expect(controller.preferences.mutedUntil).toBe(NOON + 2 * HOUR);
    expect(store.get<Preferences>(PREFERENCES_KEY)?.mutedUntil).toBe(NOON + 2 * HOUR);

    clock = NOON + HOUR;
    await deliver(
      made,
      gameEvent(2, 'constructionFinished', 'Obra 2.'),
      gameEvent(3, 'famineStarted', 'A fome chegou.'),
    );
    expect(gameToasts(controller)).toEqual([]);
    expect(controller.unseen).toBe(2);

    // Passadas as duas horas, os avisos voltam.
    clock = NOON + 2 * HOUR + 1;
    await deliver(made, gameEvent(4, 'constructionFinished', 'Obra 4.'));
    expect(gameToasts(controller).map((toast) => toast.text)).toEqual(['Obra 4.']);
  });

  it('"Ver" leva ao Feudo e zera as novidades', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    await controller.setPreferences({ notifications: 'all' });
    controller.navigate('settings');
    await deliver(
      made,
      ...[1, 2, 3, 4].map((seq) => gameEvent(seq, 'constructionFinished', `Obra ${seq}.`)),
    );
    expect(controller.unseen).toBe(1);
    await actionOf(gameToasts(controller)[0], 'Ver').run();
    expect(controller.route).toBe('fief');
    expect(controller.unseen).toBe(0);
  });

  it('os eventos novos entram na Crônica recente, mesmo os que não avisam', async () => {
    const made = await opened({ now: () => NOON });
    // No nível padrão (essencial) a obra concluída não avisa.
    await deliver(made, gameEvent(1, 'constructionFinished', 'A Serraria ficou pronta.'));
    expect(made.controller.chronicle.map((event) => event.text)).toEqual([
      'A Serraria ficou pronta.',
    ]);
    expect(made.controller.toasts).toEqual([]);
  });

  it('a virada de dia não entra na Crônica recente (ADR 0007)', async () => {
    const made = await opened({ now: () => NOON });
    await deliver(made, gameEvent(1, 'dayStarted', 'Amanheceu.'));
    expect(made.controller.chronicle).toEqual([]);
    expect(made.controller.toasts).toEqual([]);

    // Misturada com outros eventos, só ela fica de fora, e a ordem dos demais se mantém.
    await deliver(
      made,
      gameEvent(2, 'constructionFinished', 'A Serraria ficou pronta.'),
      gameEvent(3, 'dayStarted', 'Amanheceu de novo.'),
      gameEvent(4, 'recruitmentFinished', 'Chegou um aldeão.'),
    );
    expect(made.controller.chronicle.map((event) => event.seq)).toEqual([2, 4]);
    expect(made.controller.chronicle.some((event) => event.type === 'dayStarted')).toBe(false);
  });

  it('o fecho diário do desperdício não entra na Crônica recente (ADR 0015)', async () => {
    const made = await opened({ now: () => NOON });
    await deliver(made, gameEvent(1, 'storageWasted', 'A produção não coube e foi ao chão.'));
    expect(made.controller.chronicle).toEqual([]);
    expect(made.controller.toasts).toEqual([]);
    // O depósito que encheu é linha da Crônica; o fecho de cada dia, não.
    await deliver(
      made,
      gameEvent(2, 'storageFilled', 'O Pátio encheu.'),
      gameEvent(3, 'storageWasted', 'Foi ao chão de novo.'),
      gameEvent(4, 'buildingFounded', 'Ergueu-se o Armazém.'),
    );
    expect(made.controller.chronicle.map((event) => event.text)).toEqual([
      'O Pátio encheu.',
      'Ergueu-se o Armazém.',
    ]);
  });

  it('a obra que começou sozinha é linha da Crônica recente e, em "todas", vira aviso', async () => {
    const text = 'Com as reservas cheias, os pedreiros começaram sozinhos a erguer a Pedreira.';
    const made = await opened({ now: () => NOON });
    await deliver(made, gameEvent(1, 'constructionAutoStarted', text));
    expect(made.controller.chronicle.map((event) => event.text)).toEqual([text]);
    // No nível padrão não é alarme: a linha fica na Crônica, sem interromper.
    expect(made.controller.toasts).toEqual([]);

    await made.controller.setPreferences({ notifications: 'all' });
    await deliver(made, gameEvent(2, 'constructionAutoStarted', text));
    expect(made.controller.toasts).toMatchObject([{ kind: 'info', text }]);
    expect(made.controller.toasts[0]?.actions.map((action) => action.label)).toEqual([
      'Ver',
      'Silenciar 2h',
    ]);
  });

  it('a virada de dia fora da Crônica não é pedida de novo ao servidor', async () => {
    const made = await opened({ now: () => NOON });
    await deliver(made, gameEvent(1, 'dayStarted', 'Amanheceu.'));
    // O evento foi consumido: o próximo que chega é só o novo, uma vez.
    await deliver(made, gameEvent(2, 'constructionFinished', 'A Serraria ficou pronta.'));
    await made.controller.session.syncNow();
    await settle(made.controller);
    expect(made.controller.chronicle.map((event) => event.seq)).toEqual([2]);
  });
});

describe('aviso de estação (GDD §13.5)', () => {
  /** O outono do golden, com a virada para o inverno a `seconds` de distância. */
  const autumnAt = (seconds: number): ViewState => ({
    ...autumnView,
    calendar: {
      ...autumnView.calendar,
      secondsToNextSeason: seconds,
      nextSeason: { ...autumnView.calendar.nextSeason, secondsUntil: seconds },
    },
  });
  const changes = autumnView.calendar.nextSeason.changes;
  const ahead = (controller: Controller) => toastWith(controller, 'à vista');
  const winterCame = (seq: number): GameEvent => ({
    ...gameEvent(seq, 'seasonChanged', 'Chega o Inverno a Pedra Alta.'),
    data: { season: 'winter' },
  });
  /** A visão muda e o evento chega na mesma leitura, como numa virada de verdade. */
  async function turns(made: Made, view: ViewState, ...events: GameEvent[]): Promise<void> {
    made.api.state.view = view;
    made.api.state.stateVersion += 1;
    await deliver(made, ...events);
  }

  describe('uma hora antes', () => {
    it('a mais de uma hora da virada, nada', async () => {
      const made = await opened({ now: () => NOON });
      await serverShows(made, autumnAt(3601));
      expect(ahead(made.controller)).toBeUndefined();
      expect(made.controller.session.seasonWarned).toBeNull();
    });

    it('a uma hora: o que muda, a conta da lenha e o caminho para a aba Hoje', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      expect(controller.preferences.notifications).toBe('essential');
      await serverShows(made, autumnAt(3600));
      const toast = ahead(controller);
      expect(toast).toMatchObject({
        // A lenha não chega: é um alerta, com o ícone do calendário.
        kind: 'warning',
        icon: 'calendar',
        // Meio-dia em UTC são 9 h em São Paulo, o fuso do navegador de teste.
        text: 'Inverno à vista: chega em 1 h, às 10:00.',
        sticky: true,
      });
      expect(toast?.details).toEqual([
        ...changes,
        'O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria repõe 0 e há 60 em estoque: faltam 156 de madeira.',
      ]);
      expect(toast?.actions.map((entry) => entry.label)).toEqual(['Ver', 'Silenciar 2h']);
      // "Ver" leva a Hoje, onde "Antes de partir" diz o que preparar.
      controller.navigate('fief');
      await actionOf(toast, 'Ver').run();
      expect(controller.route).toBe('today');
    });

    it('é um por virada: as leituras seguintes não repetem, nem recarregar a página', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      await serverShows(made, autumnAt(3000));
      expect(ahead(controller)?.text).toBe('Inverno à vista: chega em 50 min, às 09:50.');
      controller.dismissToast(ahead(controller)?.id ?? -1);
      await serverShows(made, autumnAt(2400));
      expect(ahead(controller)).toBeUndefined();
      expect(made.store.get<GameCache>(cacheKey(target))?.seasonWarned).toBe('1:winter');

      // A página recarregada lê a marca guardada.
      const reloaded = make({ api: made.api, signedIn: true, now: () => NOON });
      reloaded.store.data[cacheKey(target)] = made.store.data[cacheKey(target)];
      await reloaded.controller.start();
      await settle(reloaded.controller);
      expect(reloaded.controller.view?.calendar.nextSeason.secondsUntil).toBe(2400);
      expect(ahead(reloaded.controller)).toBeUndefined();
    });

    it('a visão guardada de horas atrás não anuncia nada: só a que veio do servidor agora', async () => {
      const api = fakeApi();
      api.state.view = coldView;
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = { ...cachedAt(NOON - 2 * HOUR), view: autumnAt(1800) };
      await made.controller.start();
      await settle(made.controller);
      expect(made.controller.view?.calendar.season).toBe('winter');
      expect(ahead(made.controller)).toBeUndefined();
      expect(made.controller.session.seasonWarned).toBeNull();
    });

    it('sem ligação, a visão guardada também não anuncia', async () => {
      const api = fakeApi();
      api.state.online = false;
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = { ...cachedAt(NOON - HOUR), view: autumnAt(1800) };
      await made.controller.start();
      await settle(made.controller);
      expect(made.controller.view?.calendar.nextSeason.secondsUntil).toBe(1800);
      expect(ahead(made.controller)).toBeUndefined();
    });

    it('quem volta de uma ausência longa a menos de uma hora da virada é avisado', async () => {
      const api = fakeApi();
      api.state.view = autumnAt(1200);
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = cachedAt(NOON - 6 * HOUR);
      await made.controller.start();
      await settle(made.controller);
      expect(made.controller.report).not.toBeNull();
      expect(ahead(made.controller)?.text).toBe('Inverno à vista: chega em 20 min, às 09:20.');
    });

    it('no nível silencioso e no modo discreto, nada; ligados os avisos dentro da hora, ele chega', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      await controller.setPreferences({ notifications: 'silent' });
      await serverShows(made, autumnAt(3000));
      expect(ahead(controller)).toBeUndefined();
      expect(controller.unseen).toBe(0);
      await controller.setPreferences({ notifications: 'essential', discreetMode: true });
      await serverShows(made, autumnAt(2400));
      expect(ahead(controller)).toBeUndefined();
      expect(controller.session.seasonWarned).toBeNull();

      await controller.setPreferences({ discreetMode: false });
      await serverShows(made, autumnAt(1800));
      expect(ahead(controller)?.text).toBe('Inverno à vista: chega em 30 min, às 09:30.');
    });

    it('durante o "Silenciar 2h" vira contador, e não volta depois', async () => {
      let clock = NOON;
      const made = await opened({ now: () => clock });
      const { controller } = made;
      await controller.muteNotifications();
      await serverShows(made, autumnAt(3000));
      expect(ahead(controller)).toBeUndefined();
      expect(controller.unseen).toBe(1);
      clock += 2 * HOUR + 1;
      await serverShows(made, autumnAt(60));
      expect(ahead(controller)).toBeUndefined();
      expect(controller.unseen).toBe(1);
    });

    it('conta no limite de três avisos por hora', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      await deliver(
        made,
        gameEvent(1, 'famineStarted', 'A fome chegou.'),
        gameEvent(2, 'famineEnded', 'A fome passou.'),
        gameEvent(3, 'coldStarted', 'O frio entrou.'),
      );
      expect(gameToasts(controller)).toHaveLength(3);
      await serverShows(made, autumnAt(3000));
      expect(ahead(controller)).toBeUndefined();
      expect(controller.unseen).toBe(1);
    });

    it('com a aba em segundo plano, conta no título e, a pedido, sai pelo navegador', async () => {
      const browser = fakeNotifier(true);
      const made = await opened({ now: () => NOON, overrides: { notifier: browser.notifier } });
      const { controller } = made;
      await controller.setBrowserNotifications(true);
      controller.setVisible(false);
      await serverShows(made, autumnAt(3000));
      expect(controller.unseen).toBe(1);
      expect(browser.log.shown).toHaveLength(1);
      expect(browser.log.shown[0]?.body).toContain('Inverno à vista: chega em 50 min, às 09:50.');
      expect(browser.log.shown[0]?.body).toContain(
        'A produção de comida passa de × 1,3 para × 0,4.',
      );
    });
  });

  describe('na virada', () => {
    it('o aviso é a frase da Crônica, com as mesmas frases do que muda, e "Ver" leva ao Feudo', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      await serverShows(made, autumnAt(3000));
      controller.dismissToast(ahead(controller)?.id ?? -1);
      await turns(made, coldView, winterCame(1));
      const toast = toastWith(controller, 'Chega o Inverno');
      expect(toast).toMatchObject({
        kind: 'info',
        icon: 'calendar',
        text: 'Chega o Inverno a Pedra Alta.',
        details: changes,
        sticky: true,
      });
      expect(toast?.actions.map((entry) => entry.label)).toEqual(['Ver', 'Silenciar 2h']);
      controller.navigate('today');
      await actionOf(toast, 'Ver').run();
      expect(controller.route).toBe('fief');
    });

    it('o aviso de uma hora antes, se ainda estiver à vista, sai de cena: a estação já chegou', async () => {
      const made = await opened({ now: () => NOON });
      const { controller } = made;
      await serverShows(made, autumnAt(3000));
      expect(ahead(controller)).toBeDefined();
      // Enquanto a estação anunciada for a mesma, ele fica.
      await serverShows(made, autumnAt(1200));
      expect(ahead(controller)?.text).toBe('Inverno à vista: chega em 50 min, às 09:50.');
      await turns(made, coldView, winterCame(1));
      expect(ahead(controller)).toBeUndefined();
      expect(gameToasts(controller).map((toast) => toast.text)).toEqual([
        'Chega o Inverno a Pedra Alta.',
      ]);
    });

    it('as frases valem também quando só a visão guardada viu a estação como próxima', async () => {
      const api = fakeApi();
      api.state.view = coldView;
      api.state.events = [winterCame(1)];
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = {
        ...cachedAt(NOON - HOUR),
        view: autumnAt(3000),
        seasonWarned: '1:winter',
      };
      await made.controller.start();
      await settle(made.controller);
      expect(toastWith(made.controller, 'Chega o Inverno')?.details).toEqual(changes);
    });

    it('sem as frases guardadas, diz o que a estação de agora muda', async () => {
      const made = await opened({ now: () => NOON });
      await turns(made, coldView, winterCame(1));
      expect(toastWith(made.controller, 'Chega o Inverno')?.details).toEqual([
        coldView.calendar.seasonEffects,
      ]);
    });

    it('a virada para uma estação que já passou não vira aviso', async () => {
      const made = await opened({ now: () => NOON });
      const summer: GameEvent = {
        ...gameEvent(1, 'seasonChanged', 'Chega o Verão a Pedra Alta.'),
        data: { season: 'summer' },
      };
      // Um salto longo: o verão e o inverno chegam juntos, e a visão já é a do inverno.
      await turns(made, coldView, summer, winterCame(2));
      expect(gameToasts(made.controller).map((toast) => toast.text)).toEqual([
        'Chega o Inverno a Pedra Alta.',
      ]);
      expect(made.controller.unseen).toBe(0);
      // Na Crônica recente as duas viradas continuam.
      expect(made.controller.chronicle.map((entry) => entry.text)).toEqual([
        'Chega o Verão a Pedra Alta.',
        'Chega o Inverno a Pedra Alta.',
      ]);
    });

    it('numa ausência longa, a virada fica para o Relatório de Retorno', async () => {
      const api = fakeApi();
      api.state.view = coldView;
      api.state.events = [winterCame(1)];
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = cachedAt(NOON - 6 * HOUR, 0);
      await made.controller.start();
      await settle(made.controller);
      expect(gameToasts(made.controller)).toEqual([]);
      expect(made.controller.report?.highlights).toEqual(['Chega o Inverno a Pedra Alta.']);
    });

    it('trocar de feudo esquece as frases guardadas do anterior', async () => {
      const made = await opened({ now: () => NOON });
      const { controller, api } = made;
      await serverShows(made, autumnAt(7200));
      const game = api.state.game;
      if (game === null) {
        throw new Error('A API de mentira deveria ter uma partida.');
      }
      // Outro feudo, que pode ter outro ritmo: as frases do anterior não servem para ele.
      api.state.game = { ...game, id: OTHER_GAME_ID };
      api.state.view = coldView;
      await controller.session.syncNow();
      await settle(controller);
      expect(controller.session.gameId).toBe(OTHER_GAME_ID);
      await deliver(made, winterCame(1));
      expect(toastWith(controller, 'Chega o Inverno')?.details).toEqual([
        coldView.calendar.seasonEffects,
      ]);
    });
  });
});

describe('avisos (toasts)', () => {
  it('avisos sem botão somem sozinhos; com botão, esperam o jogador', () => {
    const { controller } = make();
    controller.toast({ kind: 'info', text: 'Sem botão.' });
    controller.toast({ kind: 'info', text: 'Com botão.', actions: [{ label: 'Ok', run() {} }] });
    expect(controller.toasts.map((toast) => toast.sticky)).toEqual([false, true]);
  });

  it('um aviso igual a um que já está à vista o substitui', () => {
    const { controller } = make();
    const first = controller.toast({ kind: 'warning', text: 'Faltam 30 de madeira.' });
    controller.toast({ kind: 'info', text: 'Outro.' });
    const second = controller.toast({ kind: 'warning', text: 'Faltam 30 de madeira.' });
    expect(second).not.toBe(first);
    expect(controller.toasts.map((toast) => toast.text)).toEqual([
      'Outro.',
      'Faltam 30 de madeira.',
    ]);
  });

  it('ficam à vista no máximo quatro, os mais novos', () => {
    const { controller } = make();
    for (let index = 1; index <= 6; index += 1) {
      controller.toast({ kind: 'info', text: `Aviso ${index}.` });
    }
    expect(controller.toasts.map((toast) => toast.text)).toEqual([
      'Aviso 3.',
      'Aviso 4.',
      'Aviso 5.',
      'Aviso 6.',
    ]);
  });

  it('dispensar tira só o aviso pedido e avisa a bancada uma vez', () => {
    const { controller } = make();
    const first = controller.toast({ kind: 'info', text: 'Um.' });
    controller.toast({ kind: 'info', text: 'Dois.' });
    let changes = 0;
    controller.onChange(() => {
      changes += 1;
    });
    controller.dismissToast(first);
    expect(controller.toasts.map((toast) => toast.text)).toEqual(['Dois.']);
    expect(changes).toBe(1);
    // Dispensar de novo (o tempo do aviso acabou junto com o clique) não muda nada.
    controller.dismissToast(first);
    expect(changes).toBe(1);
  });
});

describe('Relatório de Retorno', () => {
  async function returning(hoursAway: number, events: GameEvent[] = [], requested = null) {
    const api = fakeApi();
    api.state.events = events;
    const made = make({ api, signedIn: true, now: () => NOON });
    made.store.data[cacheKey(target)] = cachedAt(NOON - hoursAway * HOUR);
    await made.controller.setPreferences({ notifications: 'all' });
    await made.controller.start(requested);
    await settle(made.controller);
    return made;
  }

  it('depois de 4 horas ou mais fora, o app abre na aba Hoje com o relatório', async () => {
    const { controller } = await returning(4);
    expect(controller.report).not.toBeNull();
    expect(controller.report?.awaySeconds).toBe(4 * 3600);
    expect(controller.route).toBe('today');
    expect(controller.defaultRoute()).toBe('today');
  });

  it('vale a aba Hoje mesmo com outra aba pedida pelo endereço', async () => {
    const made = make({ signedIn: true, now: () => NOON });
    made.store.data[cacheKey(target)] = cachedAt(NOON - 9 * HOUR);
    await made.controller.start('fief');
    expect(made.controller.report).not.toBeNull();
    expect(made.controller.route).toBe('today');
  });

  it('com menos de 4 horas, não há relatório e o app abre no Feudo', async () => {
    const { controller } = await returning(3.9);
    expect(controller.report).toBeNull();
    expect(controller.route).toBe('fief');
  });

  it('na primeira visita (sem nada guardado) não há relatório', async () => {
    const { controller } = await opened({ now: () => NOON });
    expect(controller.report).toBeNull();
    expect(controller.unseen).toBe(0);
  });

  it('os eventos da ausência vão para o relatório, e não viram avisos um a um', async () => {
    const made = await returning(6, [
      gameEvent(1, 'constructionFinished', 'A serraria ficou pronta.'),
      gameEvent(2, 'dayStarted', 'Amanheceu.'),
      gameEvent(3, 'famineStarted', 'A fome chegou a Pedra Alta.'),
      gameEvent(4, 'recruitmentFinished', 'Um aldeão chegou.'),
    ]);
    const { controller } = made;
    expect(gameToasts(controller)).toEqual([]);
    expect(controller.report?.highlights).toEqual([
      'A serraria ficou pronta.',
      'A fome chegou a Pedra Alta.',
      'Um aldeão chegou.',
    ]);
    expect(controller.report?.counts).toMatchObject({
      daysPassed: 1,
      constructionsFinished: 1,
      villagersArrived: 1,
    });
    // As novidades contam no badge e no título.
    expect(controller.unseen).toBe(3);
    expect(controller.title(0).startsWith('(3) ')).toBe(true);

    // Posta em dia a ausência, o que chegar depois volta a avisar normalmente.
    await deliver(made, gameEvent(5, 'constructionFinished', 'A fazenda ficou pronta.'));
    expect(gameToasts(controller).map((toast) => toast.text)).toEqual(['A fazenda ficou pronta.']);
  });

  it('o frio de uma ausência longa também fica para o relatório, sem avisos avulsos', async () => {
    const { controller } = await returning(6, [
      gameEvent(1, 'coldStarted', 'O frio entrou nas casas.'),
      gameEvent(2, 'coldEnded', 'O frio passou.'),
    ]);
    expect(gameToasts(controller)).toEqual([]);
    expect(controller.report?.highlights).toEqual(['O frio entrou nas casas.', 'O frio passou.']);
  });

  describe('a aba que ficou aberta e fora de vista (V2D-T4.4)', () => {
    /** O feudo aberto e à vista; `clock.now` é o relógio, que o teste adianta. */
    async function leftOpen(preferences: Partial<Preferences> = {}) {
      const clock = { now: NOON };
      const made = await opened({ now: () => clock.now });
      await made.controller.setPreferences({ notifications: 'all', ...preferences });
      return { ...made, clock };
    }
    const pointer = (controller: Controller) => toastWith(controller, 'Relatório de Retorno');

    it('na volta, o relatório está na aba Hoje e um aviso leva até ele, sem trocar de aba sozinho', async () => {
      const made = await leftOpen();
      const { controller, clock } = made;
      expect(controller.route).toBe('fief');
      controller.setVisible(false);
      // Em segundo plano, o que acontece é entregue como sempre: aviso e contador.
      clock.now += 2 * HOUR;
      await deliver(made, gameEvent(1, 'constructionFinished', 'A serraria ficou pronta.'));
      expect(controller.unseen).toBe(1);
      expect(controller.report).toBeNull();

      clock.now += 3 * HOUR;
      made.api.state.events.push(
        gameEvent(2, 'dayStarted', 'Amanheceu.'),
        gameEvent(3, 'cardExpired', 'O conselho decidiu sozinho.'),
      );
      controller.setVisible(true);
      await settle(controller);

      expect(controller.report?.awaySeconds).toBe(5 * 3600);
      expect(controller.report?.highlights).toEqual([
        'A serraria ficou pronta.',
        'O conselho decidiu sozinho.',
      ]);
      expect(controller.report?.blocks?.prospered.map((item) => item.text)).toEqual([
        'A serraria ficou pronta.',
      ]);
      expect(controller.report?.blocks?.cost.map((item) => item.text)).toEqual([
        'O conselho decidiu sozinho.',
      ]);
      // O contador não soma duas vezes o que já tinha virado aviso em segundo plano.
      expect(controller.unseen).toBe(2);
      // O que chegou na leitura da volta foi para o relatório, e não para um aviso avulso.
      expect(gameToasts(controller).map((toast) => toast.text)).not.toContain(
        'O conselho decidiu sozinho.',
      );
      // A aba em que o jogador estava continua sendo a dele.
      expect(controller.route).toBe('fief');
      expect(pointer(controller)?.text).toBe(
        'Você esteve fora por 5 horas. O Relatório de Retorno espera na aba Hoje.',
      );
      void actionOf(pointer(controller), 'Ver').run();
      expect(controller.route).toBe('today');
      // Lido, o relatório some, e não volta ao sair de vista e voltar em seguida.
      controller.markSeen();
      controller.setVisible(false);
      controller.setVisible(true);
      await settle(controller);
      expect(controller.report).toBeNull();
    });

    it('com menos de 4 horas fora de vista, nada muda: nem relatório, nem aviso', async () => {
      const made = await leftOpen();
      made.controller.setVisible(false);
      made.clock.now += 3 * HOUR;
      made.controller.setVisible(true);
      await settle(made.controller);
      expect(made.controller.report).toBeNull();
      expect(pointer(made.controller)).toBeUndefined();
    });

    it('quem já está na aba Hoje vê o relatório aparecer, sem aviso', async () => {
      const made = await leftOpen();
      made.controller.navigate('today');
      made.controller.setVisible(false);
      made.clock.now += 6 * HOUR;
      made.controller.setVisible(true);
      await settle(made.controller);
      expect(made.controller.report?.awaySeconds).toBe(6 * 3600);
      expect(pointer(made.controller)).toBeUndefined();
    });

    it('no modo discreto, o relatório fica na aba Hoje e nenhum aviso aparece', async () => {
      const made = await leftOpen({ discreetMode: true });
      made.controller.setVisible(false);
      made.clock.now += 6 * HOUR;
      made.controller.setVisible(true);
      await settle(made.controller);
      expect(made.controller.report).not.toBeNull();
      expect(made.controller.toasts).toEqual([]);
      expect(made.controller.route).toBe('fief');
    });
  });

  describe('na primeira abertura depois de uma atualização do jogo', () => {
    // O cache como a versão anterior do app o gravou: sem marca, e a visão em outro formato.
    const {
      difficulty: _difficulty,
      difficultyLabel: _difficultyLabel,
      paceLabel: _paceLabel,
      ...oldSettlement
    } = goldenView.settlement;
    void [_difficulty, _difficultyLabel, _paceLabel];
    const fromOlderApp = (lastSeenAt: number) => ({
      view: { ...goldenView, settlement: oldSettlement },
      stateVersion: '7',
      etag: null,
      lastSeq: 3,
      lastSeenAt,
    });
    const history = [
      gameEvent(1, 'constructionFinished', 'Obra antiga.'),
      gameEvent(2, 'dayStarted', 'Amanheceu.'),
      gameEvent(3, 'recruitmentFinished', 'Aldeão antigo.'),
      gameEvent(4, 'constructionFinished', 'A serraria ficou pronta.'),
      gameEvent(5, 'famineStarted', 'A fome chegou ao feudo.'),
      gameEvent(6, 'dayStarted', 'Amanheceu de novo.'),
      gameEvent(7, 'recruitmentFinished', 'Um aldeão chegou.'),
    ];
    async function updated(hoursAway: number, level: 'all' | 'padrão' = 'all') {
      const api = fakeApi();
      api.state.events = [...history];
      const made = make({ api, signedIn: true, now: () => NOON });
      made.store.data[cacheKey(target)] = fromOlderApp(NOON - hoursAway * HOUR);
      if (level === 'all') {
        await made.controller.setPreferences({ notifications: 'all' });
      }
      await made.controller.start();
      await settle(made.controller);
      return made;
    }

    it.each(['all', 'padrão'] as const)(
      'quem ficou horas fora cai na aba Hoje, sem avisos avulsos (avisos: %s)',
      async (level) => {
        const made = await updated(9, level);
        const { controller } = made;
        expect(gameToasts(controller)).toEqual([]);
        expect(controller.route).toBe('today');
        // O relatório conta a ausência pelo que veio depois do cursor guardado. Sem a visão
        // antiga não há estoques a comparar, e ele não inventa uma comparação.
        expect(controller.report).toMatchObject({
          awaySeconds: 9 * 3600,
          resources: [],
          counts: { daysPassed: 1, constructionsFinished: 1, villagersArrived: 1 },
          highlights: ['A serraria ficou pronta.', 'A fome chegou ao feudo.', 'Um aldeão chegou.'],
        });
        expect(controller.unseen).toBe(3);

        // Posta em dia a ausência, o que chegar depois volta a avisar normalmente.
        await deliver(made, gameEvent(8, 'famineStarted', 'A fome voltou.'));
        expect(gameToasts(controller).map((toast) => toast.text)).toEqual(['A fome voltou.']);
      },
    );

    it('quem saiu há pouco segue como em qualquer ausência curta: Feudo e avisos', async () => {
      const { controller } = await updated(1);
      expect(controller.report).toBeNull();
      expect(controller.route).toBe('fief');
      // Só o que veio depois do cursor guardado, com o essencial na frente.
      expect(gameToasts(controller).map((toast) => toast.text)).toEqual([
        'A fome chegou ao feudo.',
        'A serraria ficou pronta.',
        'Um aldeão chegou.',
      ]);
    });
  });

  it('numa ausência curta, os eventos avisam normalmente', async () => {
    const { controller } = await returning(1, [gameEvent(1, 'famineStarted', 'A fome chegou.')]);
    expect(controller.report).toBeNull();
    expect(gameToasts(controller).map((toast) => toast.text)).toEqual(['A fome chegou.']);
  });

  it('markSeen fecha o relatório e zera as novidades', async () => {
    const { controller } = await returning(6, [gameEvent(1, 'constructionFinished', 'Pronta.')]);
    expect(controller.unseen).toBe(1);
    let changes = 0;
    controller.onChange(() => {
      changes += 1;
    });
    controller.markSeen();
    expect(controller.report).toBeNull();
    expect(controller.unseen).toBe(0);
    expect(controller.defaultRoute()).toBe('fief');
    expect(changes).toBe(1);
    // Sem nada para marcar, a bancada não é redesenhada à toa.
    controller.markSeen();
    expect(changes).toBe(1);
  });

  it('ir ao Feudo zera o badge, mas o relatório continua na aba Hoje até ser lido', async () => {
    const { controller } = await returning(6, [gameEvent(1, 'constructionFinished', 'Pronta.')]);
    controller.navigate('fief');
    expect(controller.unseen).toBe(0);
    expect(controller.report).not.toBeNull();
  });

  it('abas que não são do feudo não contam como ter visto as novidades', async () => {
    const { controller } = await returning(6, [gameEvent(1, 'constructionFinished', 'Pronta.')]);
    controller.navigate('settings');
    controller.navigate('about');
    expect(controller.unseen).toBe(1);
    controller.navigate('today');
    expect(controller.unseen).toBe(0);
  });
});

describe('título da aba do navegador', () => {
  it('sem conta, só o nome do app', async () => {
    const { controller } = make();
    await controller.start();
    expect(controller.title(0)).toBe(APP_TITLE);
  });

  it('com feudo, o nome dele na frente', async () => {
    const { controller } = await opened();
    expect(controller.title(0)).toBe(`Pedra Alta · ${APP_TITLE}`);
    expect(controller.statusInput(12)).toMatchObject({
      signedIn: true,
      discreetMode: false,
      elapsedSeconds: 12,
      pending: 0,
      connection: { kind: 'online' },
    });
  });

  it('com novidades, o contador entre parênteses; visto o Feudo, ele some', async () => {
    const made = await opened({ now: () => NOON });
    const { controller } = made;
    await controller.setPreferences({ notifications: 'all' });
    controller.navigate('settings');
    await deliver(
      made,
      ...[1, 2, 3, 4, 5].map((seq) => gameEvent(seq, 'constructionFinished', `Obra ${seq}.`)),
    );
    expect(controller.title(0)).toBe(`(2) Pedra Alta · ${APP_TITLE}`);
    controller.navigate('fief');
    expect(controller.title(0)).toBe(`Pedra Alta · ${APP_TITLE}`);
  });

  it('no modo discreto, só um contador: nem o nome do feudo nem o do jogo', async () => {
    const { controller } = await opened();
    await controller.setPreferences({ discreetMode: true });
    const title = controller.title(0);
    expect(title).toMatch(/^(\d{2}:\d{2}|\d+d \d{2}h)$/);
    expect(title).not.toContain('Pedra Alta');
    expect(title).not.toContain('Lords');
  });

  it('depois de sair, volta a ser só o nome do app', async () => {
    const { controller } = await opened();
    await controller.signOut();
    expect(controller.title(0)).toBe(APP_TITLE);
  });
});

describe('abas e navegação', () => {
  it('abrir a Crônica cria uma aba que pode ser fechada e carrega o texto', async () => {
    const { controller, api } = await opened();
    controller.navigate('chronicle');
    expect(controller.route).toBe('chronicle');
    expect(controller.tabs).toEqual(['today', 'fief', 'council', 'chronicle']);
    expect(controller.chronicleDocument).toEqual({ status: 'loading' });
    await settle(controller);
    expect(controller.chronicleDocument).toEqual({
      status: 'ready',
      value: api.state.chronicleMarkdown,
    });

    controller.closeTab('chronicle');
    expect(controller.route).toBe('fief');
    expect(controller.tabs).toEqual(['today', 'fief', 'council']);
  });

  it('a Crônica aberta é lida de novo quando chegam eventos', async () => {
    const made = await opened({ now: () => NOON });
    const { controller, api } = made;
    controller.navigate('chronicle');
    await settle(controller);

    api.state.chronicleMarkdown = '# Crônica de Pedra Alta\n\n- Ergueu-se a Fazenda.\n';
    await deliver(made, gameEvent(1, 'constructionFinished', 'Ergueu-se a Fazenda.'));
    expect(controller.chronicleDocument).toEqual({
      status: 'ready',
      value: '# Crônica de Pedra Alta\n\n- Ergueu-se a Fazenda.\n',
    });
  });

  it('uma virada de dia não faz a Crônica aberta ser baixada de novo', async () => {
    const made = await opened({ now: () => NOON });
    const { controller, api } = made;
    controller.navigate('chronicle');
    await settle(controller);
    const reads = () =>
      api.state.requests.filter((request) => request.endsWith('/chronicle.md')).length;
    const before = reads();

    // As viradas de dia não entram na Crônica (ADR 0007): o texto dela não mudou.
    await deliver(made, gameEvent(1, 'dayStarted', 'Amanheceu.'));
    expect(reads()).toBe(before);
    expect(controller.chronicleDocument.status).toBe('ready');
  });

  it('se a leitura da Crônica falha, a aba mostra o erro em vez de travar', async () => {
    const { controller, api } = await opened();
    api.state.failNext.set('chronicle.md', {
      status: 409,
      body: { code: 'CONFLICT', message: 'A partida foi arquivada.' },
    });
    controller.navigate('chronicle');
    await settle(controller);
    expect(controller.chronicleDocument).toEqual({
      status: 'error',
      message: 'A partida foi arquivada.',
    });
    // Tentar de novo (o botão da aba) lê do servidor outra vez.
    expect(await controller.loadChronicle()).toBe(api.state.chronicleMarkdown);
    expect(controller.chronicleDocument.status).toBe('ready');
  });

  it('abrir a mesma aba duas vezes não a duplica', async () => {
    const { controller } = await opened();
    controller.navigate('settings');
    controller.navigate('fief');
    controller.navigate('settings');
    expect(controller.tabs).toEqual(['today', 'fief', 'council', 'settings']);
  });

  it('fechar uma aba que não é a ativa não muda de aba', async () => {
    const { controller } = await opened();
    controller.navigate('settings');
    controller.navigate('about');
    controller.closeTab('settings');
    expect(controller.route).toBe('about');
    expect(controller.tabs).toEqual(['today', 'fief', 'council', 'about']);
  });

  it('as abas fixas não fecham', async () => {
    const { controller } = await opened();
    let changes = 0;
    controller.onChange(() => {
      changes += 1;
    });
    controller.closeTab('fief');
    controller.closeTab('today');
    expect(controller.tabs).toEqual(['today', 'fief', 'council']);
    expect(controller.route).toBe('fief');
    expect(changes).toBe(0);
  });

  it('sem feudo: só as boas-vindas, mais Preferências e Sobre quando abertas', async () => {
    const { controller } = make();
    await controller.start();
    expect(controller.tabs).toEqual(['welcome']);

    controller.navigate('chronicle');
    expect(controller.route).toBe('welcome');
    expect(controller.tabs).toEqual(['welcome']);

    controller.navigate('settings');
    controller.navigate('about');
    expect(controller.tabs).toEqual(['welcome', 'settings', 'about']);
    controller.closeTab('about');
    expect(controller.route).toBe('welcome');
  });

  it('com feudo, pedir as boas-vindas leva à aba padrão', async () => {
    const { controller } = await opened();
    controller.navigate('settings');
    controller.navigate('welcome');
    expect(controller.route).toBe('fief');
  });

  it('navegar avisa a bancada para se redesenhar', async () => {
    const { controller } = await opened();
    let changes = 0;
    controller.onChange(() => {
      changes += 1;
    });
    controller.navigate('today');
    expect(changes).toBe(1);
  });
});

describe('conta', () => {
  it('sair apaga os caches da conta, volta às boas-vindas e não avisa de sessão perdida', async () => {
    const { controller, api, store, tokenStore } = await opened();
    const otherAccount = cacheKey({ ...target, accountId: OTHER_ACCOUNT_ID });
    // Uma partida arquivada da mesma conta e o feudo de outra conta neste navegador.
    store.data[cacheKey({ ...target, gameId: OTHER_GAME_ID })] = cachedAt(NOON);
    store.data[otherAccount] = cachedAt(NOON);
    controller.navigate('chronicle');
    await settle(controller);

    await controller.signOut();
    await settle(controller);

    expect(store.keys().filter((key) => key.startsWith('lords.cache:'))).toEqual([otherAccount]);
    expect(store.get(ACCOUNT_KEY)).toBeUndefined();
    expect(await tokenStore.get()).toBeNull();
    expect(controller.account.state).toEqual({ kind: 'signedOut' });
    expect(controller.route).toBe('welcome');
    expect(controller.tabs).toEqual(['welcome']);
    expect(controller.view).toBeNull();
    expect(controller.session.gameId).toBeNull();
    expect(controller.chronicle).toEqual([]);
    expect(controller.chronicleDocument).toEqual({ status: 'idle' });
    expect(controller.busy).toBe(false);
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
    expect(count(api.state.requests, 'POST /auth/logout')).toBe(1);
  });

  it('depois de sair, o ciclo de atualização para', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    await controller.signOut();
    await settle(controller);
    const requests = api.state.requests.length;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(api.state.requests).toHaveLength(requests);
  });

  it('sessão perdida no servidor: boas-vindas COM o aviso, e os caches apagados', async () => {
    const { controller, api, store, tokenStore } = await opened();
    expect(store.get(cacheKey(target))).toBeDefined();

    // A sessão foi revogada: toda leitura autenticada passa a responder 401 SESSION_REVOKED.
    api.state.account = null;
    await controller.session.syncNow();
    await settle(controller);

    expect(controller.route).toBe('welcome');
    expect(controller.account.state).toEqual({ kind: 'signedOut' });
    expect(toastWith(controller, SESSION_ENDED)).toMatchObject({ kind: 'warning' });
    expect(store.keys().filter((key) => key.startsWith('lords.cache:'))).toEqual([]);
    expect(store.get(ACCOUNT_KEY)).toBeUndefined();
    expect(await tokenStore.get()).toBeNull();
    // Nada do feudo fica à vista como se fosse só falta de rede.
    expect(controller.view).toBeNull();
    expect(controller.title(0)).toBe(APP_TITLE);
  });

  it('sessão perdida ao dar uma ordem tem o mesmo desfecho', async () => {
    const { controller, api, store } = await opened();
    api.state.account = null;
    expect(await controller.order('setWorkers', { building: 'farm', count: 1 })).toBe(false);
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(toastWith(controller, SESSION_ENDED)).toBeDefined();
    expect(store.keys().filter((key) => key.startsWith('lords.cache:'))).toEqual([]);
    expect(api.state.commands).toEqual([]);
  });

  it('excluir a conta: boas-vindas, caches apagados e nenhum aviso de sessão perdida', async () => {
    const { controller, api, store, tokenStore } = await opened();
    await controller.deleteAccount();
    await settle(controller);

    expect(count(api.state.requests, 'DELETE /me')).toBe(1);
    expect(controller.route).toBe('welcome');
    expect(controller.account.state).toEqual({ kind: 'signedOut' });
    expect(store.keys().filter((key) => key.startsWith('lords.cache:'))).toEqual([]);
    expect(store.get(ACCOUNT_KEY)).toBeUndefined();
    expect(await tokenStore.get()).toBeNull();
    expect(controller.view).toBeNull();
    expect(controller.busy).toBe(false);
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
  });

  it('se a exclusão falha, a conta continua e uma sessão perdida depois volta a avisar', async () => {
    const { controller, api } = await opened();
    api.state.failNext.set('/me', {
      status: 500,
      body: { code: 'INTERNAL', message: 'O servidor tropeçou.' },
    });
    await expect(controller.deleteAccount()).rejects.toThrow('O servidor tropeçou.');
    await settle(controller);
    expect(controller.account.state).toMatchObject({ kind: 'anonymous', gameId: GAME_ID });
    expect(controller.route).toBe('fief');
    expect(controller.busy).toBe(false);

    api.state.account = null;
    await controller.session.syncNow();
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(toastWith(controller, SESSION_ENDED)).toBeDefined();
  });

  it('depois de sair, "Jogar agora" de novo abre um feudo e uma sessão perdida avisa', async () => {
    const { controller, api } = await opened();
    await controller.signOut();
    await controller.playNow('Gustavo', 'Pedra Alta');
    await settle(controller);
    expect(controller.route).toBe('fief');

    api.state.account = null;
    await controller.session.syncNow();
    await settle(controller);
    expect(toastWith(controller, SESSION_ENDED)).toBeDefined();
  });
});

describe('outras abas do navegador', () => {
  it('outra aba saiu: esta volta às boas-vindas junto, sem o aviso de sessão perdida', async () => {
    const { controller, store, tokenStore } = await opened();
    // O que a outra aba fez no armazenamento compartilhado.
    delete store.data[ACCOUNT_KEY];
    await tokenStore.clear();

    controller.handleTabChange({ kind: 'signedOut' });
    await settle(controller);

    expect(controller.route).toBe('welcome');
    expect(controller.account.state).toEqual({ kind: 'signedOut' });
    expect(controller.view).toBeNull();
    expect(store.keys().filter((key) => key.startsWith('lords.cache:'))).toEqual([]);
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
  });

  // Sair em outra aba apaga duas chaves e gera dois eventos `storage`; o segundo encontra esta
  // aba já sem conta e não pode deixar a marca de "saída esperada" ligada.
  it('depois de outra aba sair, uma sessão perdida mais tarde ainda merece o aviso', async () => {
    const { controller, api, store, tokenStore } = await opened();
    delete store.data[ACCOUNT_KEY];
    await tokenStore.clear();
    // Um evento `storage` por chave apagada.
    controller.handleTabChange({ kind: 'signedOut' });
    await settle(controller);
    controller.handleTabChange({ kind: 'signedOut' });
    await settle(controller);

    await controller.playNow('Gustavo', 'Pedra Alta');
    await settle(controller);
    expect(controller.route).toBe('fief');

    api.state.account = null;
    await controller.session.syncNow();
    await settle(controller);
    expect(controller.route).toBe('welcome');
    expect(toastWith(controller, SESSION_ENDED)).toBeDefined();
  });

  it('outra aba entrou em uma conta: esta a adota e abre o feudo', async () => {
    const { controller, api, store, tokenStore } = make();
    await controller.start();
    await settle(controller);
    expect(controller.route).toBe('welcome');

    // A outra aba fez "Jogar agora": conta, tokens e partida estão no armazenamento comum.
    api.seed('Gustavo', 'Pedra Alta');
    await tokenStore.set({ accessToken: 'acesso', refreshToken: 'renovacao' });
    store.data[ACCOUNT_KEY] = {
      kind: 'anonymous',
      accountId: ACCOUNT_ID,
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: GAME_ID,
    };
    controller.handleTabChange({ kind: 'account' });
    await settle(controller);

    expect(controller.account.state).toMatchObject({ accountId: ACCOUNT_ID, gameId: GAME_ID });
    expect(controller.route).toBe('fief');
    expect(controller.view?.settlement.name).toBe('Pedra Alta');
    expect(controller.tabs).toEqual(['today', 'fief', 'council']);
    // Adotar não cria conta nem funda feudo de novo.
    expect(count(api.state.requests, 'POST /auth/anonymous')).toBe(0);
    expect(count(api.state.requests, 'POST /games')).toBe(0);
  });

  it('um aviso de conta sem mudança nenhuma não reabre a sessão', async () => {
    const { controller, api } = await opened();
    const requests = api.state.requests.length;
    controller.handleTabChange({ kind: 'account' });
    await settle(controller);
    expect(api.state.requests).toHaveLength(requests);
    expect(controller.route).toBe('fief');
  });

  it('outra aba mudou as preferências: esta as relê do armazenamento', async () => {
    const { controller, store } = await opened();
    let changes = 0;
    controller.onChange(() => {
      changes += 1;
    });
    store.data[PREFERENCES_KEY] = {
      ...DEFAULT_PREFERENCES,
      discreetMode: true,
      notifications: 'silent',
      theme: 'light',
    };
    controller.handleTabChange({ kind: 'preferences' });
    expect(controller.preferences).toMatchObject({
      discreetMode: true,
      notifications: 'silent',
      theme: 'light',
    });
    expect(changes).toBe(1);
    expect(controller.statusInput(0).discreetMode).toBe(true);
  });
});

describe('preferências', () => {
  it('começam no padrão e são guardadas neste navegador', async () => {
    const { controller, store } = make();
    expect(controller.preferences).toEqual(DEFAULT_PREFERENCES);
    await controller.setPreferences({ theme: 'high-contrast', vigilHour: 6 });
    expect(controller.preferences).toEqual({
      ...DEFAULT_PREFERENCES,
      theme: 'high-contrast',
      vigilHour: 6,
    });
    expect(store.get(PREFERENCES_KEY)).toEqual(controller.preferences);
  });
});

describe('visibilidade da aba e rede', () => {
  it('30 s com a aba à vista, 2 min em segundo plano, e sincroniza ao voltar', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    const views = () => count(api.state.requests, VIEW_REQUEST);
    expect(views()).toBe(1);

    // À vista: uma leitura a cada 30 s.
    await vi.advanceTimersByTimeAsync(29_000);
    expect(views()).toBe(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(views()).toBe(2);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(views()).toBe(3);

    // Em segundo plano: só de 2 em 2 minutos.
    controller.setVisible(false);
    expect(controller.visible).toBe(false);
    await vi.advanceTimersByTimeAsync(119_000);
    expect(views()).toBe(3);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(views()).toBe(4);

    // De volta à vista: sincroniza na hora e retoma os 30 s.
    controller.setVisible(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(views()).toBe(5);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(views()).toBe(6);
  });

  it('uma página aberta já em segundo plano começa no ritmo de 2 min', async () => {
    useFakeClock();
    const { controller, api } = make({ signedIn: true });
    controller.setVisible(false);
    await controller.start();
    await settle(controller);
    const views = () => count(api.state.requests, VIEW_REQUEST);
    expect(views()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(views()).toBe(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(views()).toBe(2);
  });

  it('sem ligação: a última visão fica à vista e as ordens falham sem entrar em fila', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    const view = controller.view;

    api.state.online = false;
    const syncing = controller.session.syncNow();
    await vi.advanceTimersByTimeAsync(2_000);
    await syncing;

    expect(controller.connection.kind).toBe('offline');
    expect(controller.view).toEqual(view);
    expect(controller.route).toBe('fief');
    // Falta de rede não é fim de sessão.
    expect(controller.account.state.kind).toBe('anonymous');
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();

    const posts = count(api.state.requests, COMMANDS_REQUEST);
    expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(false);
    expect(toastWith(controller, OFFLINE_ORDER)).toMatchObject({ kind: 'error' });
    // A ordem nem saiu do navegador.
    expect(count(api.state.requests, COMMANDS_REQUEST)).toBe(posts);
    expect(api.state.commands).toEqual([]);

    // A ligação volta: nada é enviado sozinho.
    api.state.online = true;
    await vi.advanceTimersByTimeAsync(5_000);
    await settle(controller);
    expect(controller.connection).toEqual({ kind: 'online' });
    expect(api.state.commands).toEqual([]);
    expect(count(api.state.requests, COMMANDS_REQUEST)).toBe(posts);
  });

  it('o aviso do navegador de que a rede voltou sincroniza na hora', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    api.state.online = false;
    const syncing = controller.session.syncNow();
    await vi.advanceTimersByTimeAsync(2_000);
    await syncing;
    expect(controller.connection.kind).toBe('offline');

    api.state.online = true;
    const views = count(api.state.requests, VIEW_REQUEST);
    controller.handleOnline();
    // Nenhum temporizador avança: não esperou os 5 s do recuo.
    await settle(controller);
    expect(count(api.state.requests, VIEW_REQUEST)).toBe(views + 1);
    expect(controller.connection).toEqual({ kind: 'online' });
  });

  it('página aberta sem rede: mostra o feudo guardado; quando a rede volta, põe tudo em dia', async () => {
    useFakeClock();
    const api = fakeApi();
    const made = make({ api, signedIn: true });
    const { controller, store } = made;
    store.data[cacheKey(target)] = cachedAt(NOON - HOUR);
    api.state.online = false;

    const starting = controller.start();
    await vi.advanceTimersByTimeAsync(2_000);
    await starting;
    await settle(controller);

    expect(controller.route).toBe('fief');
    expect(controller.view?.settlement.name).toBe('Pedra Alta');
    expect(controller.connection.kind).toBe('offline');
    expect(controller.server.status).toBe('error');
    expect(controller.githubAvailable).toBe(false);
    expect(controller.account.state.kind).toBe('anonymous');

    api.state.online = true;
    controller.handleOnline();
    await settle(controller);
    expect(controller.connection).toEqual({ kind: 'online' });
    expect(controller.server.status).toBe('ready');
  });
});

describe('notificações do navegador', () => {
  it('a permissão só é pedida quando o jogador liga a opção', async () => {
    const { notifier, log } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    const { controller, store } = made;
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    expect(log.requests).toBe(0);

    expect(await controller.setBrowserNotifications(true)).toBe(true);
    expect(log.requests).toBe(1);
    expect(controller.preferences.browserNotifications).toBe(true);
    expect(store.get<Preferences>(PREFERENCES_KEY)?.browserNotifications).toBe(true);
    expect(controller.toasts.filter((toast) => toast.text.includes('permissão'))).toEqual([]);
  });

  it('permissão negada: a opção continua desligada e um aviso explica', async () => {
    const { notifier, log } = fakeNotifier(false);
    const { controller, store } = await opened({ overrides: { notifier } });
    expect(await controller.setBrowserNotifications(true)).toBe(false);
    expect(log.requests).toBe(1);
    expect(controller.preferences.browserNotifications).toBe(false);
    expect(store.get<Preferences>(PREFERENCES_KEY)?.browserNotifications).toBe(false);
    expect(toastWith(controller, 'não deu permissão')).toMatchObject({ kind: 'warning' });
  });

  it('navegador sem notificações: continua desligada, com outro aviso, sem pedir nada', async () => {
    const { notifier, log } = fakeNotifier(true, false);
    const unsupported = await opened({ overrides: { notifier } });
    expect(await unsupported.controller.setBrowserNotifications(true)).toBe(false);
    expect(log.requests).toBe(0);
    expect(unsupported.controller.preferences.browserNotifications).toBe(false);
    expect(toastWith(unsupported.controller, 'não tem notificações')).toMatchObject({
      kind: 'warning',
    });

    const absent = await opened();
    expect(await absent.controller.setBrowserNotifications(true)).toBe(false);
    expect(toastWith(absent.controller, 'não tem notificações')).toBeDefined();
  });

  it('desligar não pede permissão nem mostra aviso', async () => {
    const { notifier, log } = fakeNotifier(true);
    const { controller } = await opened({ overrides: { notifier } });
    await controller.setBrowserNotifications(true);
    expect(await controller.setBrowserNotifications(false)).toBe(true);
    expect(log.requests).toBe(1);
    expect(controller.preferences.browserNotifications).toBe(false);
    expect(controller.toasts).toEqual([]);
  });

  it('ligada e com a aba em segundo plano, o aviso também sai pelo navegador e conta no título', async () => {
    const { notifier, log } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    const { controller } = made;
    await controller.setBrowserNotifications(true);
    controller.setVisible(false);

    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou a Pedra Alta.'));
    expect(log.shown).toEqual([{ title: 'Pedra Alta', body: 'A fome chegou a Pedra Alta.' }]);
    expect(gameToasts(controller)).toHaveLength(1);
    expect(controller.unseen).toBe(1);
    expect(controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
  });

  it('com a aba à vista, o aviso fica só na página', async () => {
    const { notifier, log } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    await made.controller.setBrowserNotifications(true);
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    expect(gameToasts(made.controller)).toHaveLength(1);
    expect(log.shown).toEqual([]);
    expect(made.controller.unseen).toBe(0);
  });

  it('com a opção desligada, a aba em segundo plano só ganha o contador no título', async () => {
    const { notifier, log } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    made.controller.setVisible(false);
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    expect(log.shown).toEqual([]);
    expect(log.requests).toBe(0);
    expect(made.controller.title(0)).toBe(`(1) Pedra Alta · ${APP_TITLE}`);
  });

  it('se o jogador retirou a permissão no navegador, nada é exibido por ele', async () => {
    const { notifier, log, revoke } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    await made.controller.setBrowserNotifications(true);
    revoke();
    made.controller.setVisible(false);
    await deliver(made, gameEvent(1, 'famineStarted', 'A fome chegou.'));
    expect(log.shown).toEqual([]);
  });

  it('o que a política não mostra também não sai pelo navegador', async () => {
    const { notifier, log } = fakeNotifier(true);
    const made = await opened({ now: () => NOON, overrides: { notifier } });
    const { controller } = made;
    await controller.setBrowserNotifications(true);
    controller.setVisible(false);

    // Nível essencial: a obra não avisa.
    await deliver(made, gameEvent(1, 'constructionFinished', 'Obra concluída.'));
    expect(log.shown).toEqual([]);

    // Modo discreto: nem a fome.
    await controller.setPreferences({ discreetMode: true });
    await deliver(made, gameEvent(2, 'famineStarted', 'A fome chegou.'));
    expect(log.shown).toEqual([]);
  });
});

describe('servidor atualizado (426 UPGRADE_REQUIRED)', () => {
  const upgrade = {
    status: 426,
    body: { code: 'UPGRADE_REQUIRED', message: 'Atualize o cliente.' },
  };

  it('pede para recarregar a página, uma única vez', async () => {
    const { controller, api } = await opened();
    const reloads: string[] = [];
    controller.runCommand = (id) => {
      reloads.push(id);
    };

    api.state.failNext.set('/view', upgrade);
    await controller.session.syncNow();
    await settle(controller);

    const toast = toastWith(controller, 'Recarregue a página');
    expect(toast).toMatchObject({ kind: 'warning', sticky: true });
    await actionOf(toast, 'Recarregar').run();
    expect(reloads).toEqual(['lords.reload']);

    // O jogador dispensou o aviso; o ciclo seguinte recebe 426 de novo e não insiste.
    controller.dismissToast(toast?.id ?? -1);
    api.state.failNext.set('/view', upgrade);
    await controller.session.syncNow();
    await settle(controller);
    expect(toastWith(controller, 'Recarregue a página')).toBeUndefined();
  });

  it('não derruba a sessão: a conta e a última visão continuam', async () => {
    const { controller, api, logs } = await opened();
    api.state.failNext.set('/view', upgrade);
    await controller.session.syncNow();
    await settle(controller);
    expect(controller.account.state.kind).toBe('anonymous');
    expect(controller.view).not.toBeNull();
    expect(controller.route).toBe('fief');
    expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
    expect(logs.some((line) => line.includes('UPGRADE_REQUIRED'))).toBe(true);
  });

  describe('em uma ordem do jogador', () => {
    const RELOAD = 'Recarregue a página';

    it('mostra o aviso de recarregar, e não um erro genérico', async () => {
      const { controller, api } = await opened();
      const reloads: string[] = [];
      controller.runCommand = (id) => {
        reloads.push(id);
      };

      api.state.failNext.set('/commands', upgrade);
      const ok = await controller.order('setWorkers', { building: 'farm', count: 2 });
      await settle(controller);

      expect(ok).toBe(false);
      expect(controller.toasts).toHaveLength(1);
      const toast = toastWith(controller, RELOAD);
      expect(toast).toMatchObject({
        kind: 'warning',
        sticky: true,
        text: 'Há uma versão nova do jogo. Recarregue a página.',
      });
      // Nem a frase crua do servidor, nem um erro, nem "Tentar de novo" (repetir não adianta).
      expect(toastWith(controller, upgrade.body.message)).toBeUndefined();
      expect(controller.toasts.filter((entry) => entry.kind === 'error')).toEqual([]);
      expect(toast?.actions.map((entry) => entry.label)).toEqual(['Recarregar']);
      await actionOf(toast, 'Recarregar').run();
      expect(reloads).toEqual(['lords.reload']);
    });

    it('duas ordens recusadas com 426 dão um aviso só', async () => {
      const { controller, api } = await opened();
      api.state.failNext.set('/commands', upgrade);
      expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(false);
      api.state.failNext.set('/commands', upgrade);
      expect(await controller.order('setWorkers', { building: 'farm', count: 1 })).toBe(false);
      await settle(controller);
      expect(controller.toasts.filter((entry) => entry.text.includes(RELOAD))).toHaveLength(1);
      expect(controller.toasts).toHaveLength(1);
    });

    it('o aviso é um só entre o ciclo e as ordens', async () => {
      const { controller, api } = await opened();
      api.state.failNext.set('/view', upgrade);
      await controller.session.syncNow();
      await settle(controller);
      const first = toastWith(controller, RELOAD);
      expect(first).toBeDefined();

      api.state.failNext.set('/commands', upgrade);
      expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(false);
      await settle(controller);
      // Continua um aviso só: o da ordem substitui o que já estava à vista.
      expect(controller.toasts).toHaveLength(1);
      expect(toastWith(controller, RELOAD)).toBeDefined();
    });

    it('depois de dispensado, uma ordem recusada traz o aviso de volta', async () => {
      const { controller, api } = await opened();
      api.state.failNext.set('/view', upgrade);
      await controller.session.syncNow();
      await settle(controller);
      controller.dismissToast(toastWith(controller, RELOAD)?.id ?? -1);
      expect(controller.toasts).toEqual([]);

      // Uma ordem que não foi aceita nunca some em silêncio.
      api.state.failNext.set('/commands', upgrade);
      expect(await controller.order('setWorkers', { building: 'farm', count: 2 })).toBe(false);
      expect(toastWith(controller, RELOAD)).toBeDefined();
    });

    it('não derruba a sessão nem manda a ordem para uma fila', async () => {
      const { controller, api } = await opened();
      api.state.failNext.set('/commands', upgrade);
      await controller.order('setWorkers', { building: 'farm', count: 2 });
      await settle(controller);
      expect(controller.account.state.kind).toBe('anonymous');
      expect(controller.view).not.toBeNull();
      expect(controller.route).toBe('fief');
      expect(toastWith(controller, SESSION_ENDED)).toBeUndefined();
      expect(count(api.state.requests, COMMANDS_REQUEST)).toBe(1);
      expect(api.state.commands).toEqual([]);
    });

    it('vale também para uma ação que não é ordem ao feudo (attempt)', async () => {
      const { controller } = make();
      const ok = await controller.attempt(async () => {
        throw new ApiClientError(426, 'UPGRADE_REQUIRED', 'Atualize o cliente.', undefined);
      });
      expect(ok).toBe(false);
      expect(controller.toasts).toHaveLength(1);
      expect(controller.toasts[0]).toMatchObject({ kind: 'warning', sticky: true });
      expect(controller.toasts[0]?.text).toContain(RELOAD);
    });
  });
});

describe('lembrete "Proteja seu reino" (48 horas reais)', () => {
  const REMINDER = 'Proteja seu reino';
  const DAY = 24 * HOUR;
  const REMIND_AFTER = 48 * HOUR;
  const OTHER_REMINDER_KEY = `lords.linkReminder:${OTHER_ACCOUNT_ID}`;

  /** O relógio do navegador, que o teste adianta. */
  let clock = NOON;
  const now = () => clock;
  beforeEach(() => {
    clock = NOON;
  });

  /** O feudo aberto pela primeira vez neste navegador, ao meio-dia. */
  const firstOpen = (options: MakeOptions = {}) => opened({ now, ...options });

  /** O tempo real passa e o ciclo traz uma visão nova. */
  async function later(made: Made, ms: number): Promise<void> {
    clock += ms;
    await serverShows(made, made.api.state.view);
  }

  /** A página é recarregada: outro controlador, com o mesmo armazenamento do navegador. */
  async function reopened(made: Made): Promise<Made> {
    made.controller.dispose();
    const { store, tokenStore } = made;
    const again = await opened({ api: made.api, now, overrides: { store, tokenStore } });
    // `makeController` devolve o armazenamento que ele criou; o que vale aqui é o do navegador.
    return { ...again, store, tokenStore };
  }

  it('a primeira visão cria o registro com a hora de agora, sem mostrar nada', async () => {
    const { controller, store } = await firstOpen();
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
    expect(toastWith(controller, REMINDER)).toBeUndefined();
  });

  it('não aparece antes de 48 horas, e o prazo não recomeça a cada visão', async () => {
    const made = await firstOpen();
    const { controller, store } = made;
    await later(made, DAY);
    await later(made, DAY - 1);
    expect(toastWith(controller, REMINDER)).toBeUndefined();
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
  });

  it('aparece ao completar 48 horas, para conta anônima sem código', async () => {
    const made = await firstOpen();
    const { controller, store } = made;
    await later(made, REMIND_AFTER - 1);
    expect(toastWith(controller, REMINDER)).toBeUndefined();

    await later(made, 1);
    const toast = toastWith(controller, REMINDER);
    expect(toast).toMatchObject({ kind: 'info', sticky: true });
    // O texto avisa do risco próprio do navegador.
    expect(toast?.text).toContain('limpar os dados de navegação apaga o acesso');
    expect(toast?.actions.map((entry) => entry.label)).toContain('Não lembrar mais');
    expect(toast?.actions.map((entry) => entry.label)).toContain('Gerar Código do Reino');
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: true });
  });

  it('conta tempo real, e não o calendário do jogo', async () => {
    // Um feudo já no segundo ano, visto pela primeira vez neste navegador: ainda não é hora.
    const api = fakeApi();
    api.state.view = {
      ...goldenView,
      calendar: { ...goldenView.calendar, year: 2, dayOfYear: 40 },
    };
    const made = await firstOpen({ api });
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
    await later(made, REMIND_AFTER - 1);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();

    // E no primeiro dia do calendário, passadas as 48 horas, é hora.
    clock = NOON;
    const early = await firstOpen();
    expect(early.api.state.view.calendar).toMatchObject({ year: 1, dayOfYear: 1 });
    await later(early, REMIND_AFTER);
    expect(toastWith(early.controller, REMINDER)).toBeDefined();
  });

  it('o prazo atravessa o recarregar da página', async () => {
    const first = await firstOpen();
    clock += DAY;
    const second = await reopened(first);
    expect(second.store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
    expect(toastWith(second.controller, REMINDER)).toBeUndefined();

    clock += DAY;
    const third = await reopened(second);
    expect(toastWith(third.controller, REMINDER)).toBeDefined();
    expect(third.store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: true });
  });

  it('aparece uma vez só', async () => {
    const made = await firstOpen();
    const { controller, store } = made;
    await later(made, REMIND_AFTER);
    const toast = toastWith(controller, REMINDER);
    expect(toast).toBeDefined();

    controller.dismissToast(toast?.id ?? -1);
    await later(made, HOUR);
    await later(made, 10 * DAY);
    expect(toastWith(controller, REMINDER)).toBeUndefined();
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: true });

    // Nem depois de recarregar a página.
    const again = await reopened(made);
    await later(again, DAY);
    expect(toastWith(again.controller, REMINDER)).toBeUndefined();
  });

  it('o formato antigo guardado (`true`) é um lembrete que já apareceu', async () => {
    const made = make({ signedIn: true, now });
    made.store.data[REMINDER_KEY] = true;
    await made.controller.start();
    await settle(made.controller);
    await later(made, 10 * DAY);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
    // E o registro não vira um prazo novo.
    expect(made.store.get(REMINDER_KEY)).toBe(true);
  });

  it('lixo no armazenamento é tratado como primeira vez', async () => {
    const made = make({ signedIn: true, now });
    made.store.data[REMINDER_KEY] = { since: 'ontem' };
    await made.controller.start();
    await settle(made.controller);
    expect(made.store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
    await later(made, REMIND_AFTER);
    expect(toastWith(made.controller, REMINDER)).toBeDefined();
  });

  it('os botões levam aos comandos de vincular e de gerar o código', async () => {
    const made = await firstOpen();
    const { controller } = made;
    const ran: string[] = [];
    controller.runCommand = (id) => {
      ran.push(id);
    };
    await later(made, REMIND_AFTER);
    const toast = toastWith(controller, REMINDER);
    await actionOf(toast, 'Gerar Código do Reino').run();
    await actionOf(toast, 'Vincular ao GitHub').run();
    expect(ran).toEqual(['lords.generateRecoveryCode', 'lords.linkGithub']);
  });

  it('sem o vínculo com o GitHub no servidor, não oferece o que não existe', async () => {
    const api = fakeApi();
    api.state.githubDevice = false;
    const made = await firstOpen({ api });
    await later(made, REMIND_AFTER);
    const labels = toastWith(made.controller, REMINDER)?.actions.map((entry) => entry.label);
    expect(labels).toEqual(['Gerar Código do Reino', 'Não lembrar mais']);
  });

  it('não aparece no modo discreto; fica para quando o jogador sair dele', async () => {
    const made = make({ signedIn: true, now });
    const { controller, store } = made;
    await controller.setPreferences({ discreetMode: true });
    await controller.start();
    await settle(controller);
    // O prazo corre mesmo no modo discreto.
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });

    await later(made, REMIND_AFTER + HOUR);
    expect(toastWith(controller, REMINDER)).toBeUndefined();
    // Não foi dado como mostrado: senão nunca apareceria.
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });

    await controller.setPreferences({ discreetMode: false });
    await later(made, 60_000);
    expect(toastWith(controller, REMINDER)).toBeDefined();
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: true });
  });

  it('quem já tem Código do Reino não é lembrado', async () => {
    const api = fakeApi();
    const made = make({ api, signedIn: true, now });
    made.store.data[ACCOUNT_KEY] = {
      kind: 'anonymous',
      accountId: ACCOUNT_ID,
      displayName: 'Gustavo',
      hasRecoveryCode: true,
      gameId: GAME_ID,
    };
    if (api.state.account !== null) {
      api.state.account = { ...api.state.account, hasRecoveryCode: true };
    }
    await made.controller.start();
    await settle(made.controller);
    await later(made, 10 * DAY);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
  });

  it('conta vinculada ao GitHub não é lembrada', async () => {
    const api = fakeApi();
    const made = make({ api, signedIn: true, now });
    made.store.data[ACCOUNT_KEY] = {
      kind: 'linked',
      accountId: ACCOUNT_ID,
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: GAME_ID,
    };
    if (api.state.account !== null) {
      api.state.account = { ...api.state.account, linked: { github: true } };
    }
    await made.controller.start();
    await settle(made.controller);
    expect(made.controller.account.state.kind).toBe('linked');
    await later(made, 10 * DAY);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
  });

  it('gerar o Código do Reino antes do prazo dispensa o lembrete', async () => {
    const made = await firstOpen();
    await later(made, DAY);
    await made.controller.account.generateRecoveryCode();
    await settle(made.controller);
    await later(made, 10 * DAY);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
  });

  it('é por conta: o registro de outra conta neste navegador não vale para esta', async () => {
    const made = make({ signedIn: true, now });
    const other = { since: NOON - 30 * DAY, shown: true };
    made.store.data[OTHER_REMINDER_KEY] = other;
    await made.controller.start();
    await settle(made.controller);
    // Esta conta começa o próprio prazo, e o da outra fica como estava.
    expect(made.store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();

    await later(made, REMIND_AFTER);
    expect(toastWith(made.controller, REMINDER)).toBeDefined();
    expect(made.store.get(OTHER_REMINDER_KEY)).toEqual(other);
  });

  it('é por conta: o prazo vencido de outra conta não adianta o desta', async () => {
    const made = make({ signedIn: true, now });
    made.store.data[OTHER_REMINDER_KEY] = { since: NOON - 30 * DAY, shown: false };
    await made.controller.start();
    await settle(made.controller);
    await later(made, DAY);
    expect(toastWith(made.controller, REMINDER)).toBeUndefined();
    expect(made.store.get(OTHER_REMINDER_KEY)).toEqual({ since: NOON - 30 * DAY, shown: false });
  });

  it('sem conta, nada é guardado', async () => {
    const { controller, store } = make({ now });
    await controller.start();
    await settle(controller);
    expect(store.keys().filter((key) => key.startsWith('lords.linkReminder'))).toEqual([]);
  });
});

describe('encerramento', () => {
  it('dispose para o ciclo e deixa de ouvir a sessão', async () => {
    useFakeClock();
    const { controller, api } = await opened();
    controller.dispose();
    const requests = api.state.requests.length;
    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(api.state.requests).toHaveLength(requests);
  });
});

describe('servidor de uma versão anterior', () => {
  it('sem `features` em /version, o vínculo GitHub fica desligado e nada quebra', async () => {
    const api = fakeApi();
    const legacy: typeof fetch = async (input, init) => {
      if (String(input).endsWith('/v1/version')) {
        // A API publicada antes do device flow não informava o que tinha ligado.
        return Response.json({
          server: '0.1.0',
          protocol: 1,
          contentHash: '0123456789abcdef',
          builtAt: '2026-10-01T12:00:00.000Z',
        });
      }
      return api.fetch(input, init);
    };
    const { controller } = makeController({
      api,
      overrides: { fetch: legacy, validateResponses: false },
    });
    await controller.start();
    await settle(controller);
    expect(controller.server.status).toBe('ready');
    expect(controller.githubAvailable).toBe(false);
    controller.dispose();
  });
});

describe('achados da revisão independente', () => {
  it('um 401 que não veio da API (proxy, portal cativo) não desloga nem apaga a conta', async () => {
    const { controller, api, store, tokenStore } = makeController({ signedIn: true });
    await controller.start();
    await settle(controller);
    // Um proxy no caminho responde 401 com um corpo que não é o erro da API.
    api.state.failNext.set('/view', { status: 401, body: {} as never });
    await controller.session.syncNow();
    await settle(controller);

    expect(controller.account.state.kind).toBe('anonymous');
    expect(controller.route).toBe('fief');
    // É tratado como servidor fora do ar: último estado à vista, credenciais e conta intactas.
    expect(controller.connection.kind).toBe('offline');
    expect(controller.view).not.toBeNull();
    expect(await tokenStore.get()).not.toBeNull();
    expect(store.get('lords.account:self')).toBeDefined();
    controller.dispose();
  });

  it('no modo discreto, a recusa de uma ordem do próprio jogador continua visível', async () => {
    const { controller, api } = makeController({ signedIn: true });
    await controller.start();
    await controller.setPreferences({ discreetMode: true });
    api.refuseNextCommand('Faltam 30 madeira e 35 pedra.');
    await controller.order('startConstruction', { building: 'townHall' });
    expect(controller.toasts.map((toast) => toast.text)).toEqual(['Faltam 30 madeira e 35 pedra.']);
    controller.dispose();
  });

  it('sair sem rede não mostra erro: as credenciais daqui já sumiram', async () => {
    const { controller, api, tokenStore } = makeController({ signedIn: true });
    await controller.start();
    await settle(controller);
    api.state.online = false;
    await controller.attempt(() => controller.signOut());
    await settle(controller);
    expect(controller.account.state.kind).toBe('signedOut');
    expect(await tokenStore.get()).toBeNull();
    expect(controller.toasts).toEqual([]);
    controller.dispose();
  });

  it('a Crônica que chega depois de o jogador sair não aparece para a conta seguinte', async () => {
    const { controller, api } = makeController({ signedIn: true });
    await controller.start();
    await settle(controller);
    const loading = controller.loadChronicle();
    // A resposta ainda está em voo quando a partida fecha.
    controller.session.stop();
    expect(await loading).toBeNull();
    expect(controller.chronicleDocument.status).not.toBe('ready');
    expect(api.state.requests).toContain(`GET /games/${GAME_ID}/chronicle.md`);
    controller.dispose();
  });

  it('armazenamento negado pelo navegador: avisa que a conta se perde ao fechar a aba', async () => {
    const { controller } = makeController({ overrides: { persistentStorage: false } });
    await controller.start();
    expect(controller.toasts).toHaveLength(1);
    expect(controller.toasts[0]?.text).toContain('ao fechar a aba a conta se perde');
    expect(controller.toasts[0]?.sticky).toBe(true);
    controller.dispose();
  });

  it('o lembrete do dia 3 é por conta e some do navegador quando ela sai', async () => {
    const { controller, store } = makeController({ signedIn: true, now: () => NOON });
    await controller.start();
    await settle(controller);
    expect(store.get(REMINDER_KEY)).toEqual({ since: NOON, shown: false });
    await controller.signOut();
    await settle(controller);
    expect(store.keys().filter((key) => key.startsWith('lords.linkReminder'))).toEqual([]);
    controller.dispose();
  });
});

describe('cursor, cache e prazos (achados da revisão do ritmo)', () => {
  it('cache de uma versão anterior do app: a visão é descartada, o cursor não', async () => {
    const { controller, api, store } = makeController({ signedIn: true });
    const key = `lords.cache:self:${ACCOUNT_ID}:${GAME_ID}`;
    // Um cache gravado antes de a visão ganhar campos novos: a forma não confere mais.
    const { housed: _housed, vacancies: _vacancies, ...oldPopulation } = goldenView.population;
    void _housed;
    void _vacancies;
    await store.update(key, {
      version: CACHE_VERSION,
      view: { ...goldenView, population: oldPopulation },
      stateVersion: '7',
      etag: 'W/"antigo"',
      lastSeq: 40,
      lastSeenAt: Date.now() - 60_000,
    });
    api.state.events = Array.from({ length: 42 }, (_, index) =>
      gameEvent(index + 1, 'constructionFinished'),
    );
    await controller.setPreferences({ notifications: 'all' });
    await controller.start();
    await settle(controller);

    // Só os dois eventos além do cursor são novidade; os 40 antigos não viram aviso.
    expect(api.state.requests).toContain(`GET /games/${GAME_ID}/events`);
    expect(controller.toasts).toHaveLength(2);
    expect(controller.view?.population.vacancies).toBe(goldenView.population.vacancies);
    controller.dispose();
  });

  it('navegador sem cache nenhum: a história da partida não chega como novidade', async () => {
    const { controller, api } = makeController({ signedIn: true });
    api.state.events = Array.from({ length: 12 }, (_, index) =>
      gameEvent(index + 1, 'constructionFinished'),
    );
    await controller.setPreferences({ notifications: 'all' });
    await controller.start();
    await settle(controller);
    expect(controller.toasts).toEqual([]);
    expect(controller.unseen).toBe(0);

    // A partir daí, o que acontecer é novidade.
    api.state.events.push(gameEvent(13, 'constructionFinished', 'Ergueu-se a Serraria.'));
    await controller.session.syncNow();
    await settle(controller);
    expect(controller.toasts.map((toast) => toast.text)).toEqual(['Ergueu-se a Serraria.']);
    controller.dispose();
  });

  it('com uma obra perto do fim, o app lê o servidor quando o prazo vence, sem esperar 30 s', async () => {
    vi.useFakeTimers();
    try {
      const { controller, api } = makeController({ signedIn: true });
      api.state.view = withQueues(goldenView, [
        activeConstruction({
          building: 'housing',
          label: 'Habitações',
          secondsRemaining: 5,
          totalSeconds: 80,
          progressPercent: 90,
          refund: [],
        }),
      ]);
      controller.setVisible(true);
      await controller.start();
      await vi.advanceTimersByTimeAsync(0);
      const reads = () => api.state.requests.filter((request) => request.endsWith('/view')).length;
      const before = reads();

      await vi.advanceTimersByTimeAsync(5_000);
      expect(reads()).toBe(before);
      // Um segundo depois do prazo, a leitura acontece.
      await vi.advanceTimersByTimeAsync(1_500);
      expect(reads()).toBe(before + 1);
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('com duas filas, o prazo que vale é o da obra que termina primeiro, esteja em que fila estiver', async () => {
    vi.useFakeTimers();
    try {
      const { controller, api } = makeController({ signedIn: true });
      // A primeira fila termina em 42 min; a segunda, em 5 s.
      api.state.view = withQueues(queuesView, [
        activeConstruction(),
        activeConstruction({ building: 'housing', label: 'Habitações', secondsRemaining: 5 }),
      ]);
      api.state.view = withPlanned(api.state.view, []);
      controller.setVisible(true);
      await controller.start();
      await vi.advanceTimersByTimeAsync(0);
      const reads = () => api.state.requests.filter((request) => request.endsWith('/view')).length;
      const before = reads();
      await vi.advanceTimersByTimeAsync(5_000);
      expect(reads()).toBe(before);
      await vi.advanceTimersByTimeAsync(1_500);
      expect(reads()).toBe(before + 1);
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('com uma planejada prestes a começar sozinha, o app lê o servidor quando a espera acaba', async () => {
    vi.useFakeTimers();
    try {
      const { controller, api } = makeController({ signedIn: true });
      api.state.view = withPlanned(goldenView, [
        {
          building: 'townHall',
          autoStart: true,
          waiting: { reason: 'resources', text: 'espera 30 de madeira', etaSeconds: 8 },
        },
        // Uma espera sem prazo não marca hora nenhuma.
        {
          building: 'goldMine',
          autoStart: true,
          waiting: { reason: 'gate', text: 'espera o Salão do Senhor', etaSeconds: null },
        },
      ]);
      controller.setVisible(true);
      await controller.start();
      await vi.advanceTimersByTimeAsync(0);
      const reads = () => api.state.requests.filter((request) => request.endsWith('/view')).length;
      const before = reads();
      await vi.advanceTimersByTimeAsync(8_000);
      expect(reads()).toBe(before);
      await vi.advanceTimersByTimeAsync(1_500);
      expect(reads()).toBe(before + 1);
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('com alguém em adaptação, o app lê o servidor quando a primeira leva termina: a taxa sobe na hora', async () => {
    vi.useFakeTimers();
    try {
      const { controller, api } = makeController({ signedIn: true });
      // Duas levas na Fazenda: a que marca a hora é a que termina antes.
      api.state.view = {
        ...goldenView,
        workers: goldenView.workers.map((row) =>
          row.building === 'farm'
            ? {
                ...row,
                adaptationEndsInSeconds: 20,
                adaptingCohorts: [
                  { count: 1, endsInSeconds: 7 },
                  { count: 1, endsInSeconds: 20 },
                ],
              }
            : row,
        ),
      };
      controller.setVisible(true);
      await controller.start();
      await vi.advanceTimersByTimeAsync(0);
      const reads = () => api.state.requests.filter((request) => request.endsWith('/view')).length;
      const before = reads();
      await vi.advanceTimersByTimeAsync(7_000);
      expect(reads()).toBe(before);
      await vi.advanceTimersByTimeAsync(1_500);
      expect(reads()).toBe(before + 1);
      controller.dispose();
    } finally {
      vi.useRealTimers();
    }
  });

  it('lembrete com o registro no futuro (relógio do aparelho estava adiantado) é reancorado', async () => {
    const now = Date.now();
    const { controller, store } = makeController({ signedIn: true, now: () => now });
    const key = `lords.linkReminder:${ACCOUNT_ID}`;
    await store.update(key, { since: now + 365 * 24 * 3600 * 1000, shown: false });
    await controller.start();
    await settle(controller);
    expect(store.get(key)).toEqual({ since: now, shown: false });
    controller.dispose();
  });
});
