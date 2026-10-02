import { memoryTokenStore, type TokenStore } from '@lotg/client-sdk';
import type {
  Account,
  CatalogResponse,
  Command,
  CreateGameRequest,
  GameEvent,
  GameSummary,
  ViewState,
} from '@lotg/protocol';

import golden from '../../engine/src/__golden__/view-seed-pedra-alta.json';
import { Controller, type ControllerOptions } from './app/controller';
import type {
  ConfirmOptions,
  Dialogs,
  InfoHandle,
  InfoOptions,
  InputOptions,
  PickOptions,
} from './app/dialogs';
import { memoryStore } from './services/store';

/** O `ViewState` de exemplo dos testes: o golden do motor (importar `@lotg/engine` é barrado). */
export const goldenView = golden.afterFirstAllocation as unknown as ViewState;
export const initialView = golden.initial as unknown as ViewState;
/** O outono a quatro horas do inverno, com lenha que não chega: a conta vem em `nextSeason`. */
export const autumnView = golden.autumnBeforeWinter as unknown as ViewState;
/** O inverno sem madeira nenhuma: o frio. */
export const coldView = golden.winterCold as unknown as ViewState;

/**
 * O mesmo inverno com a lareira acesa: `stock` de madeira no estoque, `missing` faltando para
 * chegar à primavera e `depletesInSeconds` para a madeira acabar. O motor é quem faz essas
 * contas; aqui os números são postos à mão para o app mostrar cada caso.
 */
export function winterWith(firewood: {
  stock: number;
  missing: number;
  depletesInSeconds: number | null;
}): ViewState {
  const { winter } = coldView;
  if (winter === null) {
    throw new Error('O golden `winterCold` deixou de ser um inverno.');
  }
  return {
    ...coldView,
    winter: {
      ...winter,
      cold: null,
      firewood: {
        ...winter.firewood,
        stock: firewood.stock,
        missing: firewood.missing,
        text:
          firewood.missing > 0
            ? `Até a Primavera a lareira ainda queima 149 de madeira. A Serraria repõe 0 e há ${firewood.stock} em estoque: faltam ${firewood.missing} de madeira.`
            : 'Até a Primavera a lareira ainda queima 149 de madeira. O estoque e a Serraria dão conta.',
      },
    },
    resources: coldView.resources.map((row) =>
      row.id === 'wood'
        ? { ...row, stock: firewood.stock, depletesInSeconds: firewood.depletesInSeconds }
        : row,
    ),
  };
}

export const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
export const GAME_ID = '22222222-2222-4222-8222-222222222222';
const CREATED_AT = '2026-10-01T12:00:00.000Z';

export function gameEvent(seq: number, type: GameEvent['type'], text = `Evento ${seq}.`) {
  return { seq, type, at: CREATED_AT, atMs: seq * 1000, text, data: {} } satisfies GameEvent;
}

type ErrorBody = { code: string; message: string; details?: unknown };

/**
 * O corpo de `GET /v1/catalog` como a produção o manda (GDD §13.9), com os textos do conteúdo.
 * `defaults` é o que vem marcado: o padrão do servidor, que pode não ser o recomendado.
 */
export function catalogFixture(
  defaults: CatalogResponse['newGame']['defaults'] = { difficulty: 'lord', timeScale: 3 },
): CatalogResponse {
  return {
    contentHash: '0123456789abcdef',
    newGame: {
      difficulties: [
        {
          id: 'peasant',
          label: 'Camponês',
          description:
            'O Celeiro e o Armazém guardam 25% a mais, ninguém deserta por fome e o Conselho, sem resposta sua, escolhe o melhor caminho.',
          recommended: false,
        },
        {
          id: 'lord',
          label: 'Senhor',
          description:
            'O feudo como foi pensado: a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, decide com cautela.',
          recommended: true,
        },
        {
          id: 'ironKing',
          label: 'Rei de Ferro',
          description:
            'O Celeiro e o Armazém guardam 20% a menos, a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, escolhe o pior caminho.',
          recommended: false,
        },
      ],
      paces: [
        {
          timeScale: 3,
          label: 'Rápido',
          description: 'um ano em 56 horas',
          hint: 'Para quem volta várias vezes ao dia e quer ver o inverno ainda nesta semana.',
          recommended: true,
        },
        {
          timeScale: 1,
          label: 'Normal',
          description: 'um ano em 7 dias',
          hint: 'Uma semana, um ano: para quem passa pelo feudo duas ou três vezes por dia.',
          recommended: false,
        },
        {
          timeScale: 0.5,
          label: 'Tranquilo',
          description: 'um ano em 14 dias',
          hint: 'Para quem abre o jogo uma vez por dia: o feudo anda devagar e espera por você.',
          recommended: false,
        },
      ],
      defaults,
    },
  };
}

/**
 * Uma API `/v1` de mentira, em memória, para os testes de unidade do app. Guarda uma conta e
 * uma partida, registra as chamadas e deixa o teste mexer no que o servidor responde. Não
 * aplica regra de jogo nenhuma: a visão é a que o teste puser em `state.view`.
 */
export function fakeApi() {
  const state = {
    online: true,
    account: null as Account | null,
    game: null as GameSummary | null,
    view: goldenView,
    stateVersion: 1,
    events: [] as GameEvent[],
    chronicleMarkdown: '# Crônica de Pedra Alta\n\n## Ano 1\n\n*Ainda não há nada a contar.*\n',
    githubDevice: true,
    /** O que `GET /catalog` responde; `null` é um servidor de uma versão anterior (404). */
    catalog: catalogFixture() as CatalogResponse | null,
    /** Os corpos de `POST /games`, na ordem em que chegaram. */
    gameRequests: [] as CreateGameRequest[],
    recoveryCode: 'PEDR-7F3A-K9QD-M2XW-4HTB',
    /** Resposta forçada para a próxima chamada cujo caminho contenha a chave. */
    failNext: new Map<string, { status: number; body: ErrorBody }>(),
    requests: [] as string[],
    commands: [] as Command[],
    devicePolls: [] as unknown[],
  };

  const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
    new Response(status === 204 || status === 304 ? null : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json', ...headers },
    });
  const error = (status: number, code: string, message: string, details?: unknown) =>
    json({ code, message, ...(details === undefined ? {} : { details }) }, status);

  const account = (displayName: string): Account => ({
    id: ACCOUNT_ID,
    displayName,
    linked: { github: false },
    hasRecoveryCode: false,
    createdAt: CREATED_AT,
  });
  const tokens = () => ({ accessToken: 'acesso', refreshToken: 'renovacao', expiresIn: 900 });
  const game = (settlementName: string, request: Partial<CreateGameRequest> = {}): GameSummary => ({
    id: GAME_ID,
    status: 'active',
    settlementName,
    // Sem os campos no corpo, valem os padrões do servidor de mentira.
    difficulty: request.difficulty ?? 'lord',
    timeScale: request.timeScale ?? 1,
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    stateVersion: String(state.stateVersion),
    createdAt: CREATED_AT,
  });

  const fetchFn: typeof fetch = async (input, init) => {
    const url = new URL(String(input), 'http://app.test');
    const method = init?.method ?? 'GET';
    const path = url.pathname.replace(/^\/v1/, '');
    const body = typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined;
    state.requests.push(`${method} ${path}`);
    if (!state.online) {
      throw new TypeError('fetch failed');
    }
    for (const [fragment, failure] of state.failNext) {
      if (path.includes(fragment)) {
        state.failNext.delete(fragment);
        return json(failure.body, failure.status);
      }
    }
    const authorized = new Headers(init?.headers).get('authorization') === 'Bearer acesso';
    const needsAuth =
      !['/version', '/health', '/catalog'].includes(path) && !path.startsWith('/auth/');
    if (needsAuth && (!authorized || state.account === null)) {
      return error(401, 'SESSION_REVOKED', 'Esta sessão foi encerrada. Entre de novo.');
    }

    if (path === '/version') {
      return json({
        server: '0.1.0',
        protocol: 1,
        contentHash: '0123456789abcdef',
        builtAt: CREATED_AT,
        features: { githubDevice: state.githubDevice },
      });
    }
    if (path === '/catalog') {
      return state.catalog === null
        ? error(404, 'NOT_FOUND', 'Recurso não encontrado.')
        : json(state.catalog);
    }
    if (path === '/auth/anonymous') {
      state.account = account((body as { displayName: string }).displayName);
      return json({ account: state.account, ...tokens() }, 201);
    }
    if (path === '/auth/recover') {
      state.account ??= { ...account('Gustavo'), hasRecoveryCode: true };
      return json({ account: state.account, ...tokens() });
    }
    if (path === '/auth/recovery-code') {
      if (state.account !== null) {
        state.account = { ...state.account, hasRecoveryCode: true };
      }
      return json({ code: state.recoveryCode });
    }
    if (path === '/auth/logout') {
      return json(null, 204);
    }
    if (path === '/auth/github/device') {
      return state.githubDevice
        ? json({
            deviceCode: 'dispositivo-1',
            userCode: 'LOTG-0001',
            verificationUri: 'https://github.com/login/device',
            expiresInSeconds: 900,
            intervalSeconds: 5,
          })
        : error(404, 'NOT_FOUND', 'O vínculo com o GitHub não está ligado neste servidor.');
    }
    if (path === '/auth/github/device/poll') {
      return json(state.devicePolls.shift() ?? { status: 'pending' });
    }
    if (path === '/auth/github') {
      state.account = { ...(state.account ?? account('Gustavo')), linked: { github: true } };
      return json(
        authorized ? { account: state.account } : { account: state.account, ...tokens() },
      );
    }
    if (path === '/me' && method === 'GET') {
      return json(state.account);
    }
    if (path === '/me' && method === 'DELETE') {
      state.account = null;
      state.game = null;
      return json({ deletedAt: CREATED_AT, purgeAfter: '2026-10-08T12:00:00.000Z' }, 202);
    }
    if (path === '/games' && method === 'GET') {
      return json({ games: state.game === null ? [] : [state.game] });
    }
    if (path === '/games' && method === 'POST') {
      const request = body as CreateGameRequest;
      state.gameRequests.push(request);
      state.game = game(request.settlementName, request);
      state.view = {
        ...state.view,
        settlement: { ...state.view.settlement, name: request.settlementName },
      };
      return json({ game: state.game }, 201);
    }
    if (state.game === null || !path.startsWith(`/games/${state.game.id}/`)) {
      return error(404, 'NOT_FOUND', 'Partida não encontrada.');
    }
    const resource = path.slice(`/games/${state.game.id}/`.length);
    if (resource === 'view') {
      const etag = `W/"${state.stateVersion}-${JSON.stringify(state.view).length}"`;
      if (new Headers(init?.headers).get('if-none-match') === etag) {
        return json(null, 304, { etag });
      }
      return json({ view: state.view, stateVersion: String(state.stateVersion) }, 200, { etag });
    }
    if (resource === 'events') {
      const after = Number(url.searchParams.get('after') ?? 0);
      const events = state.events.filter((event) => event.seq > after);
      return json({ events, lastSeq: events.at(-1)?.seq ?? after, hasMore: false });
    }
    if (resource === 'chronicle') {
      // Como no servidor: as viradas de dia não entram na Crônica (ADR 0007).
      return json({
        entries: state.events.filter((event) => event.type !== 'dayStarted').slice(-20),
      });
    }
    if (resource === 'chronicle.md') {
      return new Response(state.chronicleMarkdown, {
        status: 200,
        headers: { 'content-type': 'text/markdown; charset=utf-8' },
      });
    }
    if (resource === 'commands' && method === 'POST') {
      state.commands.push(body as Command);
      state.stateVersion += 1;
      return json({
        view: state.view,
        events: [],
        stateVersion: String(state.stateVersion),
        staleView: false,
      });
    }
    return error(404, 'NOT_FOUND', 'Recurso não encontrado.');
  };

  return {
    state,
    fetch: fetchFn,
    /** A conta e a partida já existem no servidor, como depois de um "Jogar agora". */
    seed: (displayName = 'Gustavo', settlementName = 'Pedra Alta') => {
      state.account = account(displayName);
      state.game = game(settlementName);
    },
    /** A recusa do motor para a próxima ordem, com a visão avançada nos detalhes. */
    refuseNextCommand: (message: string, code = 'INSUFFICIENT_RESOURCES') => {
      state.failNext.set('/commands', {
        status: 422,
        body: {
          code: 'GAME_RULE',
          message,
          details: {
            code,
            message,
            view: state.view,
            events: [],
            stateVersion: String(state.stateVersion),
            staleView: false,
          },
        },
      });
    },
  };
}

export type FakeApi = ReturnType<typeof fakeApi>;

/**
 * Um controlador pronto para teste, com armazenamento em memória e a API de mentira. `signedIn`
 * deixa o navegador como depois de um "Jogar agora": conta e tokens guardados.
 */
export function makeController(
  options: {
    api?: FakeApi;
    signedIn?: boolean;
    now?: () => number;
    overrides?: Partial<ControllerOptions>;
  } = {},
) {
  const api = options.api ?? fakeApi();
  const store = memoryStore();
  let tokenStore: TokenStore = memoryTokenStore();
  if (options.signedIn) {
    api.seed();
    store.data['lords.account:self'] = {
      kind: 'anonymous',
      accountId: ACCOUNT_ID,
      displayName: 'Gustavo',
      hasRecoveryCode: false,
      gameId: GAME_ID,
    };
    tokenStore = memoryTokenStore({ accessToken: 'acesso', refreshToken: 'renovacao' });
  }
  let uuid = 0;
  const logs: string[] = [];
  const controller = new Controller({
    baseUrl: 'http://app.test',
    store,
    tokenStore,
    fetch: api.fetch,
    validateResponses: true,
    deviceLabel: 'Navegador de teste',
    timezone: () => 'America/Sao_Paulo',
    randomUUID: () => {
      uuid += 1;
      return `00000000-0000-4000-8000-${String(uuid).padStart(12, '0')}`;
    },
    log: (message) => logs.push(message),
    ...(options.now ? { now: options.now } : {}),
    ...options.overrides,
  });
  return { controller, api, store, tokenStore, logs };
}

/** Diálogos respondidos por roteiro: cada pergunta consome a próxima resposta da fila. */
export function scriptedDialogs() {
  const answers: unknown[] = [];
  const shown: Array<
    | ({ kind: 'confirm' } & ConfirmOptions)
    | ({ kind: 'input' } & InputOptions)
    | ({ kind: 'pick' } & PickOptions<unknown>)
    | ({ kind: 'info' } & InfoOptions)
  > = [];
  const infos: Array<{ options: InfoOptions; open: boolean }> = [];
  const next = () => answers.shift();
  const dialogs: Dialogs = {
    confirm: async (options) => {
      shown.push({ kind: 'confirm', ...options });
      return next() === true;
    },
    input: async (options) => {
      shown.push({ kind: 'input', ...options });
      return next() as string | undefined;
    },
    pick: async <T>(options: PickOptions<T>) => {
      shown.push({ kind: 'pick', ...options } as (typeof shown)[number]);
      const answer = next();
      // Um número escolhe o item pela posição; qualquer outra coisa é o próprio valor.
      return (typeof answer === 'number' ? options.items[answer]?.value : answer) as T | undefined;
    },
    info: (options): InfoHandle => {
      shown.push({ kind: 'info', ...options });
      const entry = { options, open: true };
      infos.push(entry);
      let close: () => void = () => {};
      const closed = new Promise<void>((resolve) => {
        close = () => {
          entry.open = false;
          resolve();
        };
      });
      // Por padrão o jogador fecha o diálogo na hora; `answers.push('manter aberto')` o segura.
      if (answers[0] === 'manter aberto') {
        answers.shift();
      } else {
        close();
      }
      return {
        closed,
        isOpen: () => entry.open,
        close,
        update: (patch) => {
          entry.options = { ...entry.options, ...patch };
        },
      };
    },
  };
  return { dialogs, answers, shown, infos };
}

/** Espera as promessas pendentes (várias voltas da fila de microtarefas) terminarem. */
export async function settle(controller?: Controller): Promise<void> {
  for (let turn = 0; turn < 20; turn += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setImmediate(resolve));
    await controller?.settled();
  }
}
