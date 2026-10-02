import { memoryTokenStore, type TokenStore } from '@lotg/client-sdk';
import {
  type Account,
  type CatalogResponse,
  CHRONICLE_HIDDEN_EVENT_TYPES,
  type Command,
  type CreateGameRequest,
  type GameEvent,
  type GameSummary,
  type ViewState,
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

/** O feudo empobrecido (GDD §5.7): fome longa, frio, moral 0 e os 3 aldeões que o piso segura. */
export const impoverishedView = golden.impoverished as unknown as ViewState;
/** O feudo orgulhoso: moral 80 por um efeito passageiro, com colono a caminho de chegar. */
export const proudView = golden.proud as unknown as ViewState;

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

/**
 * O feudo com o Salão do Senhor no nível 2: o Celeiro e o Armazém já podem ser erguidos, e só
 * faltam recursos para isso.
 */
export const unlockedView = golden.afterObjectivesScenario as unknown as ViewState;

type ResourceRow = ViewState['resources'][number];
type UpgradeRow = ViewState['constructions']['available'][number];

/**
 * A mesma visão com campos de um recurso trocados. Limite, "cheio em" e desperdício são contas
 * do motor; aqui os números são postos à mão para o app mostrar cada caso.
 */
export function withResource(
  view: ViewState,
  id: ResourceRow['id'],
  patch: Partial<ResourceRow>,
): ViewState {
  return {
    ...view,
    resources: view.resources.map((row) => (row.id === id ? { ...row, ...patch } : row)),
  };
}

/**
 * A previsão da comida de uma estação que vem com a Fazenda rendendo menos: o saldo fica
 * negativo e a comida acaba 7 h 03 min depois da virada. São os números que o motor dá ao feudo
 * de 30 habitantes a uma hora do inverno (`seasonView.test.ts`).
 */
export const FOOD_RUNS_OUT_AHEAD: NonNullable<ViewState['calendar']['nextSeason']['food']> = {
  perHour: -18.5,
  stockAtTurn: 129,
  depletesInSeconds: 8 * 3600 + 196,
  text: 'Com a gente de agora na Fazenda, o saldo de comida no Inverno será de −18,46/h: o estoque de 129 que a virada encontra acaba 7 h 03 min depois dela. Mande mais gente para a Fazenda ou guarde comida antes.',
};

/**
 * A mesma visão a `secondsUntil` da virada de estação, com esta previsão da comida para a
 * estação que vem. A conta é do motor; aqui os números são postos à mão para o app mostrar
 * cada caso.
 */
export function withFoodAhead(
  view: ViewState,
  food: ViewState['calendar']['nextSeason']['food'],
  secondsUntil: number = view.calendar.nextSeason.secondsUntil,
): ViewState {
  return {
    ...view,
    calendar: {
      ...view.calendar,
      secondsToNextSeason: secondsUntil,
      nextSeason: { ...view.calendar.nextSeason, secondsUntil, food },
    },
  };
}

/** A mesma visão com campos de uma obra disponível trocados (bloqueio, custo, efeito). */
export function withUpgrade(
  view: ViewState,
  building: UpgradeRow['building'],
  patch: Partial<UpgradeRow>,
): ViewState {
  return {
    ...view,
    constructions: {
      ...view.constructions,
      available: view.constructions.available.map((upgrade) =>
        upgrade.building === building ? { ...upgrade, ...patch } : upgrade,
      ),
    },
  };
}

/**
 * Um feudo com um ofício em cada situação (GDD §5.3 e §5.4): a Fazenda com dois em adaptação e a
 * experiência subindo, a Serraria com o ofício dominado, a Pedreira com gente de menos para o
 * nível (um deles em adaptação) e a Mina de Ouro vazia, perdendo o ofício.
 */
export const craftsView = golden.crafts as unknown as ViewState;

/**
 * A mesa do conselho cheia (GDD §7), no ritmo Rápido: "A vez de repartir", continuação de
 * "Tábuas para as reservas", e "A refeição dos pedreiros", as duas com quase um dia de prazo.
 */
export const councilView = golden.councilTable as unknown as ViewState;

type CouncilCardRow = ViewState['council']['pending'][number];

/** As duas cartas de `councilView`, na ordem em que chegaram. */
export const [shareCard, mealCard] = councilView.council.pending as [
  CouncilCardRow,
  CouncilCardRow,
];

/**
 * A mesma visão com estas cartas na mesa, e as decisões pendentes de acordo, do prazo mais curto
 * ao mais longo, como o motor as ordena. `council` troca o resto do Conselho (a próxima
 * audiência, a nota). Quem sorteia e tranca é o motor; aqui as cartas são postas à mão para o
 * app mostrar cada caso.
 */
export function withCards(
  view: ViewState,
  pending: CouncilCardRow[],
  council: Partial<Omit<ViewState['council'], 'pending'>> = {},
): ViewState {
  return {
    ...view,
    council: { ...view.council, ...council, pending },
    pendingDecisions: pending
      .map((card) => ({
        kind: 'card' as const,
        id: card.instanceId,
        title: card.title,
        expiresInSeconds: card.expiresInSeconds,
      }))
      .sort((a, b) => a.expiresInSeconds - b.expiresInSeconds),
  };
}

/**
 * A Torre de Vigia no nível 1, no outono e no ritmo Rápido (GDD §8.2): a Ameaça à vista, com a
 * tendência, as origens e o Covil de Lobos. Todas as outras visões do golden são de feudos sem
 * Torre, e trazem a Ameaça na forma fechada da névoa (`known: false`).
 */
export const threatWatchedView = golden.threatWatched as unknown as ViewState;
/** A Torre no nível 2, o teto desta versão, com uma incursão à vista e o tamanho dela. */
export const threatIncomingView = golden.threatIncoming as unknown as ViewState;
/**
 * Logo depois de uma incursão média sem Paliçada (GDD §8.2): dois feridos, um da Fazenda e um da
 * Serraria, que saram em 20 minutos; a moral com o termo "Incursão sofrida"; a Ameaça dez pontos
 * abaixo, já com chance de marcar outra incursão; a Torre no nível 1 e o Salão no nível 2, e por
 * isso a obra da Paliçada ainda travada.
 */
export const raidAftermathView = golden.raidAftermath as unknown as ViewState;
/**
 * A mesma incursão à vista de `threatIncomingView`, com o Salão no nível 3 e a Paliçada no
 * nível 1: ela não segura um ataque médio, e a obra do nível 2 está liberada.
 */
export const palisadeRaisedView = golden.palisadeRaised as unknown as ViewState;

type Constructions = ViewState['constructions'];
type QueueRow = Constructions['queues'][number];
type PlannedRow = Constructions['planned'][number];

/**
 * O Salão no nível 4, com as duas filas de obras ocupadas e cinco planejadas, uma de cada espera
 * (obra anterior do edifício, fila, recurso, depósito e nível de outro edifício).
 */
export const queuesView = golden.queuesAndPlans as unknown as ViewState;

/** Uma obra em curso, como a visão a traz, para os testes porem em uma fila. */
export function activeConstruction(
  patch: Partial<NonNullable<QueueRow>> = {},
): NonNullable<QueueRow> {
  return {
    building: 'lumberMill',
    label: 'Serraria',
    targetLevel: 2,
    secondsRemaining: 2520,
    totalSeconds: 3000,
    progressPercent: 16,
    refund: [
      { resource: 'wood', label: 'Madeira', amount: 80, lost: 0 },
      { resource: 'stone', label: 'Pedra', amount: 40, lost: 0 },
    ],
    ...patch,
  };
}

/**
 * A mesma visão com estas filas de obras: uma entrada por fila aberta, `null` para a livre.
 * `active` acompanha, como no motor: é a primeira obra em curso. Com uma fila só, a frase do que
 * abre a segunda continua na visão.
 */
export function withQueues(view: ViewState, queues: QueueRow[]): ViewState {
  return {
    ...view,
    constructions: {
      ...view.constructions,
      queues,
      active: queues.find((queue) => queue !== null) ?? null,
      queuesUnlocked: queues.length,
      queuesNote: queues.length > 1 ? null : initialView.constructions.queuesNote,
    },
  };
}

/**
 * A mesma visão com estas obras na lista de planejadas, na ordem dada. O orçamento de cada uma é
 * o da obra disponível do mesmo edifício; a marca e a espera são as do teste.
 */
export function withPlanned(
  view: ViewState,
  plans: Array<Pick<PlannedRow, 'building'> & Partial<Pick<PlannedRow, 'autoStart' | 'waiting'>>>,
): ViewState {
  const planned = plans.map(({ building, autoStart = false, waiting = null }) => {
    const upgrade = view.constructions.available.find((entry) => entry.building === building);
    if (upgrade === undefined) {
      throw new Error(`A visão não oferece a obra de ${building}.`);
    }
    return { ...upgrade, planned: true, autoStart, waiting };
  });
  const names = new Set(planned.map((plan) => plan.building));
  return {
    ...view,
    constructions: {
      ...view.constructions,
      planned,
      available: view.constructions.available.map((upgrade) =>
        names.has(upgrade.building) ? { ...upgrade, planned: true } : upgrade,
      ),
    },
  };
}

type ObjectiveRow = ViewState['objectives'][number];

/**
 * A mesma visão com campos de um objetivo trocados (o que falta, o progresso, onde se cumpre).
 * Quem decide o que falta é o motor; aqui a frase é posta à mão para o app mostrar cada caso.
 */
export function withObjective(
  view: ViewState,
  id: string,
  patch: Partial<ObjectiveRow>,
): ViewState {
  if (!view.objectives.some((objective) => objective.id === id)) {
    throw new Error(`A visão não traz o objetivo ${id}.`);
  }
  return {
    ...view,
    objectives: view.objectives.map((objective) =>
      objective.id === id ? { ...objective, ...patch } : objective,
    ),
  };
}

/**
 * Os três últimos objetivos da v0.2 em aberto, depois dos sete primeiros cumpridos: marcar uma
 * obra para começar sozinha (só falta a ordem), a Paliçada (travada pelo Salão) e o inverno sem
 * frio (o que falta é a estação chegar). As frases são as que o motor escreve.
 */
export const lateObjectivesView: ViewState = {
  ...unlockedView,
  objectives: [
    ...unlockedView.objectives.map((objective) => ({
      ...objective,
      status: 'completed' as const,
      progress: { current: objective.progress.target, target: objective.progress.target },
      missing: null,
    })),
    {
      id: 'planAutoStart',
      title: 'Deixe uma obra marcada para começar sozinha',
      hint: 'A obra marcada começa assim que houver recursos, mesmo com o Senhor longe.',
      reward: '+30 ouro',
      status: 'active',
      progress: { current: 0, target: 1 },
      missing: null,
      target: { kind: 'planned' },
    },
    {
      id: 'buildPalisade',
      title: 'Construa a Paliçada',
      hint: 'Estaca firme faz o lobo recuar de barriga vazia.',
      reward: '+100 madeira',
      status: 'active',
      progress: { current: 0, target: 1 },
      missing: 'Melhore antes o Salão do Senhor para o nível 3.',
      target: { kind: 'building', building: 'palisade' },
    },
    {
      id: 'surviveWinterWithoutCold',
      title: 'Atravesse o inverno sem passar frio',
      hint: 'A lareira queima madeira o inverno inteiro: guarde lenha no outono.',
      reward: '+15 de moral por 1 dia de jogo (2 h)',
      status: 'active',
      progress: { current: 0, target: 1 },
      missing: 'Falta o Inverno chegar e passar sem frio.',
      target: { kind: 'season', season: 'winter' },
    },
  ],
};

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
      // Como no servidor: as viradas de dia e o fecho diário do desperdício não entram na
      // Crônica (ADRs 0007 e 0015), e vêm as últimas `limit` linhas (50 sem o parâmetro).
      const limit = Number(url.searchParams.get('limit') ?? 50);
      return json({
        entries: state.events
          .filter(
            (event) => !(CHRONICLE_HIDDEN_EVENT_TYPES as readonly string[]).includes(event.type),
          )
          .slice(-limit),
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
      let answer = next();
      // Uma função é o que acontece com a lista aberta (a carta expira, outra aba responde): ela
      // roda antes da escolha e devolve a resposta do jogador.
      if (typeof answer === 'function') {
        answer = await (answer as (shown: PickOptions<T>) => unknown)(options);
      }
      // A lista fechada pelo sinal é desistência, como no `DialogService`.
      if (options.signal?.aborted === true) {
        return undefined;
      }
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
