import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

import {
  ApiClientError,
  type Client,
  type CommandResult,
  createClient,
  type GameRuleClientError,
  isGameRuleError,
  memoryTokenStore,
} from '@lotg/client-sdk';
import type { Command, ViewState } from '@lotg/protocol';

export type SmokeOptions = {
  /** URL do servidor, sem o `/v1`. */
  baseUrl: string;
  /** Não excluir a conta criada, para olhar a partida depois. */
  keep: boolean;
  fetch?: typeof fetch;
  /** Gerador dos `commandId`. Precisa devolver UUIDs: é o que o protocolo aceita. */
  newId?: () => string;
};

export type SmokeCheck = {
  id: 'parallel' | 'replay' | 'conflict' | 'refusalReplay';
  title: string;
  ok: boolean;
  /** O que foi observado; numa falha, o que estava errado. */
  detail: string;
};

export type SmokeCleanup =
  | { status: 'deleted'; purgeAfter: string }
  | { status: 'kept' }
  | { status: 'failed'; reason: string }
  /** Nenhuma conta chegou a ser criada. */
  | { status: 'nothing' };

export type SmokeReport = {
  baseUrl: string;
  accountId: string | null;
  gameId: string | null;
  /** Falha antes das verificações: criar a conta ou a partida. */
  setupError: string | null;
  checks: SmokeCheck[];
  cleanup: SmokeCleanup;
  ok: boolean;
};

type Building = ViewState['workers'][number]['building'];
type SetWorkers = Extract<Command, { type: 'setWorkers' }>;

/**
 * As dez ordens em paralelo: todas diferentes e pedindo, somadas, mais gente do que o feudo tem.
 * Qualquer que seja a ordem em que o servidor as atenda, algumas precisam ser recusadas.
 */
const PARALLEL_ORDERS: Array<{ building: Building; count: number }> = [
  { building: 'farm', count: 1 },
  { building: 'farm', count: 2 },
  { building: 'farm', count: 3 },
  { building: 'lumberMill', count: 1 },
  { building: 'lumberMill', count: 2 },
  { building: 'lumberMill', count: 3 },
  { building: 'quarry', count: 1 },
  { building: 'quarry', count: 2 },
  { building: 'goldMine', count: 1 },
  { building: 'goldMine', count: 2 },
];

type Outcome =
  | { order: SetWorkers; kind: 'accepted'; result: CommandResult }
  | { order: SetWorkers; kind: 'refused'; error: GameRuleClientError }
  | { order: SetWorkers; kind: 'failed'; reason: string };

/** Uma verificação que não passou; a mensagem vai para o relatório. */
class SmokeFailure extends Error {}

function describeError(error: unknown): string {
  if (error instanceof ApiClientError) {
    return `${error.status} ${error.code}: ${error.message}`;
  }
  return error instanceof Error ? error.message : String(error);
}

function orderText(order: SetWorkers): string {
  return `${order.payload.building}=${order.payload.count}`;
}

function assignedIn(view: ViewState, building: Building): number {
  const row = view.workers.find((entry) => entry.building === building);
  if (row === undefined) {
    throw new SmokeFailure(`a visão não trouxe o edifício ${building}`);
  }
  return row.assigned;
}

/** Ninguém alocado além da população, e os livres fecham a conta. */
function checkAllocation(view: ViewState, where: string): number {
  const assigned = view.workers.reduce((sum, row) => sum + row.assigned, 0);
  const { villagers, free } = view.population;
  if (assigned > villagers) {
    throw new SmokeFailure(`${where}: ${assigned} alocados para ${villagers} aldeões`);
  }
  if (free !== villagers - assigned) {
    throw new SmokeFailure(
      `${where}: ${free} livres, mas ${villagers} aldeões menos ${assigned} alocados dá ${villagers - assigned}`,
    );
  }
  return assigned;
}

/** O corpo de um comando aceito, sem a marca `replayed` que o SDK acrescenta. */
function bodyOf(result: CommandResult) {
  return {
    view: result.view,
    events: result.events,
    stateVersion: result.stateVersion,
    staleView: result.staleView,
  };
}

/**
 * Fumaça de concorrência e idempotência contra um servidor de verdade. Cria UMA conta anônima e
 * UMA partida, confere as quatro garantias do caminho de um comando (GDD §14.5) e, no fim,
 * exclui a conta que criou, a menos que `keep` seja pedido. Nunca lança por causa do servidor:
 * o que deu errado sai no relatório.
 */
export async function runSmoke(options: SmokeOptions): Promise<SmokeReport> {
  const newId = options.newId ?? randomUUID;
  const client: Client = createClient({
    baseUrl: options.baseUrl,
    tokenStore: memoryTokenStore(),
    clientVersion: 'sim-cli/0.1.0',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const report: SmokeReport = {
    baseUrl: options.baseUrl,
    accountId: null,
    gameId: null,
    setupError: null,
    checks: [],
    cleanup: { status: 'nothing' },
    ok: false,
  };

  const setWorkers = (building: Building, count: number): SetWorkers => ({
    commandId: newId(),
    type: 'setWorkers',
    payload: { building, count },
  });

  async function check(
    id: SmokeCheck['id'],
    title: string,
    run: () => Promise<string>,
  ): Promise<void> {
    try {
      report.checks.push({ id, title, ok: true, detail: await run() });
    } catch (error) {
      const detail = error instanceof SmokeFailure ? error.message : describeError(error);
      report.checks.push({ id, title, ok: false, detail });
    }
  }

  async function send(gameId: string, order: SetWorkers): Promise<Outcome> {
    try {
      return { order, kind: 'accepted', result: await client.sendCommand(gameId, order) };
    } catch (error) {
      return isGameRuleError(error)
        ? { order, kind: 'refused', error }
        : { order, kind: 'failed', reason: describeError(error) };
    }
  }

  async function currentView(gameId: string): Promise<ViewState> {
    const read = await client.getView(gameId);
    if (read.status !== 200) {
      throw new SmokeFailure(`GET /view respondeu ${read.status} sem If-None-Match`);
    }
    return read.view;
  }

  async function verify(gameId: string): Promise<void> {
    await check('parallel', '10 ordens setWorkers diferentes em paralelo', async () => {
      const orders = PARALLEL_ORDERS.map((order) => setWorkers(order.building, order.count));
      const outcomes = await Promise.all(orders.map((order) => send(gameId, order)));
      const failed = outcomes.filter((outcome) => outcome.kind === 'failed');
      if (failed.length > 0) {
        const list = failed.map((outcome) => `${orderText(outcome.order)} → ${outcome.reason}`);
        throw new SmokeFailure(
          `${failed.length} ordens sem aceite nem recusa do motor: ${list.join('; ')}`,
        );
      }
      const accepted = outcomes.filter((outcome) => outcome.kind === 'accepted');
      if (accepted.length === 0) {
        throw new SmokeFailure('nenhuma das 10 ordens foi aceita');
      }
      for (const { order, result } of accepted) {
        const where = `resposta de ${orderText(order)}`;
        checkAllocation(result.view, where);
        const seen = assignedIn(result.view, order.payload.building);
        if (seen !== order.payload.count) {
          throw new SmokeFailure(`${where}: a visão devolvida traz ${seen} no edifício`);
        }
      }
      // A versão do estado dá a ordem em que o servidor aplicou as ordens aceitas.
      const byVersion = [...accepted].sort((a, b) =>
        BigInt(a.result.stateVersion) < BigInt(b.result.stateVersion) ? -1 : 1,
      );
      const versions = new Set(accepted.map((outcome) => outcome.result.stateVersion));
      if (versions.size !== accepted.length) {
        throw new SmokeFailure(
          'duas ordens aceitas devolveram a mesma stateVersion: uma escrita pode ter sido perdida',
        );
      }
      const expected = new Map<Building, number>();
      for (const { order } of byVersion) {
        expected.set(order.payload.building, order.payload.count);
      }
      const view = await currentView(gameId);
      const assigned = checkAllocation(view, 'visão final');
      for (const row of view.workers) {
        const want = expected.get(row.building) ?? 0;
        if (row.assigned !== want) {
          throw new SmokeFailure(
            `visão final: ${row.building} tem ${row.assigned}, mas a última ordem aceita pedia ${want}`,
          );
        }
      }
      return `${accepted.length} aceitas e ${outcomes.length - accepted.length} recusadas pelo motor; ${assigned} de ${view.population.villagers} aldeões alocados, como na última ordem aceita de cada edifício`;
    });

    // Fazenda em 0 é sempre aceita: não depende de quantos aldeões estão livres.
    const original = setWorkers('farm', 0);
    let first: CommandResult | null = null;

    await check('replay', 'a mesma ordem reenviada devolve o mesmo recibo', async () => {
      first = await client.sendCommand(gameId, original);
      if (first.replayed) {
        throw new SmokeFailure('a primeira entrega já veio marcada como reenvio');
      }
      const again = await client.sendCommand(gameId, original);
      if (!again.replayed) {
        throw new SmokeFailure('o reenvio não veio marcado com X-Lords-Replayed');
      }
      if (!isDeepStrictEqual(bodyOf(again), bodyOf(first))) {
        throw new SmokeFailure(
          `o reenvio devolveu outro corpo (stateVersion ${again.stateVersion}, a original era ${first.stateVersion})`,
        );
      }
      return `mesmo corpo (stateVersion ${first.stateVersion}) e marca de reenvio`;
    });

    await check('conflict', 'o mesmo commandId com outro payload recebe 409', async () => {
      if (first === null) {
        throw new SmokeFailure('a ordem original não foi aceita; nada a comparar');
      }
      const other: SetWorkers = { ...original, payload: { building: 'farm', count: 1 } };
      const outcome = await client.sendCommand(gameId, other).then(
        () => 'aceita' as const,
        (error: unknown) => error,
      );
      if (outcome === 'aceita') {
        throw new SmokeFailure('a ordem com outro payload foi aceita');
      }
      if (
        !(outcome instanceof ApiClientError) ||
        outcome.status !== 409 ||
        outcome.code !== 'COMMAND_ID_CONFLICT'
      ) {
        throw new SmokeFailure(`esperava 409 COMMAND_ID_CONFLICT, veio ${describeError(outcome)}`);
      }
      const farm = assignedIn(await currentView(gameId), 'farm');
      if (farm !== 0) {
        throw new SmokeFailure(`o conflito mudou o estado: a Fazenda ficou com ${farm}`);
      }
      return '409 COMMAND_ID_CONFLICT, sem efeito no estado';
    });

    await check(
      'refusalReplay',
      'uma recusa do motor reenviada devolve a mesma recusa',
      async () => {
        const { villagers } = (await currentView(gameId)).population;
        const impossible = setWorkers('farm', villagers + 1);
        const refusedFirst = await send(gameId, impossible);
        if (refusedFirst.kind !== 'refused') {
          throw new SmokeFailure(
            refusedFirst.kind === 'accepted'
              ? `o motor aceitou ${villagers + 1} na Fazenda com ${villagers} aldeões`
              : `esperava 422 GAME_RULE, veio ${refusedFirst.reason}`,
          );
        }
        if (refusedFirst.error.replayed) {
          throw new SmokeFailure('a primeira recusa já veio marcada como reenvio');
        }
        const refusedAgain = await send(gameId, impossible);
        if (refusedAgain.kind !== 'refused') {
          throw new SmokeFailure(
            refusedAgain.kind === 'accepted'
              ? 'o reenvio da ordem recusada foi aceito'
              : `o reenvio esperava 422 GAME_RULE, veio ${refusedAgain.reason}`,
          );
        }
        if (!refusedAgain.error.replayed) {
          throw new SmokeFailure('o reenvio da recusa não veio marcado com X-Lords-Replayed');
        }
        if (
          refusedAgain.error.message !== refusedFirst.error.message ||
          !isDeepStrictEqual(refusedAgain.error.details, refusedFirst.error.details)
        ) {
          throw new SmokeFailure('o reenvio da recusa devolveu outro corpo');
        }
        return `422 ${refusedFirst.error.details.code} nas duas vezes, com o mesmo corpo`;
      },
    );
  }

  try {
    const { account } = await client.signUpAnonymous({
      // O prefixo "Bot " tira a conta das métricas de playtest (deploy/analytics/ops.sql).
      displayName: 'Bot de fumaça',
      deviceLabel: 'sim-cli --smoke',
    });
    report.accountId = account.id;
    const game = await client.createGame({
      settlementName: 'Feudo de Fumaça',
      timezone: 'UTC',
      vigilHourLocal: 20,
    });
    report.gameId = game.id;
    await verify(game.id);
  } catch (error) {
    report.setupError = describeError(error);
  }

  if (report.accountId !== null) {
    if (options.keep) {
      report.cleanup = { status: 'kept' };
    } else {
      try {
        const { purgeAfter } = await client.deleteMe();
        report.cleanup = { status: 'deleted', purgeAfter };
      } catch (error) {
        report.cleanup = { status: 'failed', reason: describeError(error) };
      }
    }
  }

  report.ok =
    report.setupError === null &&
    report.checks.length === 4 &&
    report.checks.every((entry) => entry.ok) &&
    report.cleanup.status !== 'failed';
  return report;
}

function cleanupLine(report: SmokeReport): string {
  const { cleanup } = report;
  switch (cleanup.status) {
    case 'deleted':
      return `Conta excluída; o servidor remove os dados depois de ${cleanup.purgeAfter}.`;
    case 'kept':
      return `Conta mantida (--keep): ${report.accountId}. Ela continua no servidor.`;
    case 'failed':
      return `A conta ${report.accountId} NÃO foi excluída: ${cleanup.reason}. Ela continua no servidor.`;
    case 'nothing':
      return 'Nenhuma conta foi criada.';
  }
}

export function formatSmokeReport(report: SmokeReport): string {
  const passed = report.checks.filter((entry) => entry.ok).length;
  const lines = [`Fumaça de concorrência em ${report.baseUrl}`];
  if (report.accountId !== null) {
    lines.push(`Conta ${report.accountId} · partida ${report.gameId ?? 'não criada'}`);
  }
  if (report.setupError !== null) {
    lines.push(`[FALHOU] preparação (conta e partida): ${report.setupError}`);
  }
  for (const entry of report.checks) {
    lines.push(`${entry.ok ? '[ok]    ' : '[FALHOU]'} ${entry.title}: ${entry.detail}`);
  }
  lines.push(cleanupLine(report));
  lines.push(
    report.ok
      ? `Resultado: ${passed} de 4 verificações passaram.`
      : `Resultado: FALHOU (${passed} de 4 verificações passaram).`,
  );
  return `${lines.join('\n')}\n`;
}
