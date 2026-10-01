import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import type {
  AuthResponse,
  Command,
  CommandAccepted,
  CreateGameResponse,
  EventsResponse,
  GameRuleError,
  TokenPair,
  ViewResponse,
  ViewState,
} from '@lotg/protocol';
import { HEADERS, PROTOCOL_VERSION } from '@lotg/protocol';

import type { Act, Bot } from './bots/types';
import { strategies, type StrategyName } from './simulate';

export type RemoteOptions = {
  /** URL do servidor, sem o `/v1`. */
  baseUrl: string;
  bots: number;
  minutes: number;
  /** Intervalo entre os ciclos de cada bot. O cliente real usa 30 s; aqui o ciclo é acelerado. */
  pollMs: number;
  strategy: StrategyName;
};

export type EndpointStats = { count: number; p50: number; p95: number; max: number };

export type RemoteReport = {
  options: RemoteOptions;
  elapsedSeconds: number;
  cycles: number;
  commandsAccepted: number;
  commandsRefused: number;
  errors: Record<string, number>;
  endpoints: Record<string, EndpointStats>;
};

type Reply<T> = { status: number; body: T; headers: Headers };

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return Math.round((sorted[Math.max(0, index)] ?? 0) * 10) / 10;
}

/** Bots de carga: cada um cria conta e partida e joga pela API, como a extensão faria. */
export async function runRemote(options: RemoteOptions): Promise<RemoteReport> {
  const api = `${options.baseUrl.replace(/\/+$/, '')}/v1`;
  const bot: Bot = strategies[options.strategy];
  const timings: Record<string, number[]> = {};
  const errors: Record<string, number> = {};
  const totals = { cycles: 0, accepted: 0, refused: 0 };

  async function request<T>(
    label: string,
    method: string,
    path: string,
    init: { token?: string; body?: unknown; headers?: Record<string, string> } = {},
  ): Promise<Reply<T>> {
    const headers: Record<string, string> = {
      [HEADERS.protocol]: String(PROTOCOL_VERSION),
      [HEADERS.client]: 'sim-cli',
      ...init.headers,
    };
    if (init.token !== undefined) {
      headers.authorization = `Bearer ${init.token}`;
    }
    if (init.body !== undefined) {
      headers['content-type'] = 'application/json';
    }
    const startedAt = performance.now();
    const response = await fetch(`${api}${path}`, {
      method,
      headers,
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
    const text = await response.text();
    (timings[label] ??= []).push(performance.now() - startedAt);
    if (response.status >= 500 || response.status === 429) {
      errors[`${label} ${response.status}`] = (errors[`${label} ${response.status}`] ?? 0) + 1;
    }
    return {
      status: response.status,
      body: (text === '' ? null : JSON.parse(text)) as T,
      headers: response.headers,
    };
  }

  async function runBot(index: number, deadline: number): Promise<void> {
    // Clientes reais não fazem polling no mesmo instante: cada bot começa em um ponto do ciclo.
    await sleep((index / options.bots) * options.pollMs);
    const signUp = await request<AuthResponse>('POST /auth/anonymous', 'POST', '/auth/anonymous', {
      body: { displayName: `Bot ${index + 1}`, deviceLabel: 'sim-cli' },
    });
    if (signUp.status !== 201) {
      throw new Error(`Bot ${index + 1} não conseguiu criar a conta (${signUp.status}).`);
    }
    let tokens: TokenPair = signUp.body;
    const created = await request<CreateGameResponse>('POST /games', 'POST', '/games', {
      token: tokens.accessToken,
      body: { settlementName: `Feudo ${index + 1}`, timezone: 'UTC', vigilHourLocal: 20 },
    });
    if (created.status !== 201) {
      throw new Error(`Bot ${index + 1} não conseguiu criar a partida (${created.status}).`);
    }
    const gameId = created.body.game.id;
    let view: ViewState | null = null;
    let stateVersion: string | null = null;
    let etag: string | null = null;
    let lastSeq = 0;

    const refresh = async () => {
      const renewed = await request<TokenPair>('POST /auth/refresh', 'POST', '/auth/refresh', {
        body: { refreshToken: tokens.refreshToken },
      });
      if (renewed.status === 200) {
        tokens = renewed.body;
      }
    };

    const act: Act = async (type, payload) => {
      const command = { commandId: randomUUID(), type, payload } as Command;
      const reply = await request<CommandAccepted | GameRuleError>(
        'POST /commands',
        'POST',
        `/games/${gameId}/commands`,
        {
          token: tokens.accessToken,
          body: command,
          ...(stateVersion !== null ? { headers: { [HEADERS.stateVersion]: stateVersion } } : {}),
        },
      );
      // Na recusa do motor, o corpo também traz o estado avançado: o bot segue a partir dele.
      const outcome =
        reply.status === 200
          ? (reply.body as CommandAccepted)
          : reply.status === 422
            ? (reply.body as GameRuleError).details
            : null;
      if (reply.status === 200) {
        totals.accepted += 1;
      } else if (reply.status === 422) {
        totals.refused += 1;
      }
      if (outcome !== null) {
        view = outcome.view;
        stateVersion = outcome.stateVersion;
      }
      if (view === null) {
        throw new Error(`Comando sem resposta utilizável (${reply.status}).`);
      }
      return view;
    };

    while (performance.now() < deadline) {
      const cycleStartedAt = performance.now();
      const read: Reply<ViewResponse> = await request<ViewResponse>(
        'GET /view',
        'GET',
        `/games/${gameId}/view`,
        {
          token: tokens.accessToken,
          ...(etag !== null ? { headers: { 'if-none-match': etag } } : {}),
        },
      );
      if (read.status === 401) {
        await refresh();
        continue;
      }
      if (read.status === 200) {
        view = read.body.view;
        stateVersion = read.body.stateVersion;
        etag = read.headers.get('etag');
      }
      const events = await request<EventsResponse>(
        'GET /events',
        'GET',
        `/games/${gameId}/events?after=${lastSeq}`,
        { token: tokens.accessToken },
      );
      if (events.status === 200) {
        lastSeq = events.body.lastSeq;
      }
      if (view !== null) {
        await bot(view, act);
      }
      totals.cycles += 1;
      const rest = options.pollMs - (performance.now() - cycleStartedAt);
      if (rest > 0) {
        await sleep(Math.min(rest, Math.max(0, deadline - performance.now())));
      }
    }
  }

  const startedAt = performance.now();
  const deadline = startedAt + options.minutes * 60_000;
  const results = await Promise.allSettled(
    Array.from({ length: options.bots }, (_, index) => runBot(index, deadline)),
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
      errors[reason] = (errors[reason] ?? 0) + 1;
    }
  }

  const endpoints: Record<string, EndpointStats> = {};
  for (const [label, values] of Object.entries(timings)) {
    const sorted = [...values].sort((a, b) => a - b);
    endpoints[label] = {
      count: sorted.length,
      p50: percentile(sorted, 0.5),
      p95: percentile(sorted, 0.95),
      max: percentile(sorted, 1),
    };
  }
  return {
    options,
    elapsedSeconds: Math.round((performance.now() - startedAt) / 100) / 10,
    cycles: totals.cycles,
    commandsAccepted: totals.accepted,
    commandsRefused: totals.refused,
    errors,
    endpoints,
  };
}

export function formatRemoteReport(report: RemoteReport): string {
  const { options } = report;
  const rows = Object.entries(report.endpoints)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(
      ([label, stats]) =>
        `| ${label} | ${stats.count} | ${stats.p50} | ${stats.p95} | ${stats.max} |`,
    );
  const errors = Object.entries(report.errors).map(([label, count]) => `${label}: ${count}`);
  return [
    `Servidor ${options.baseUrl} · ${options.bots} bots · ${options.minutes} min · ciclo de ${options.pollMs} ms · estratégia ${options.strategy}`,
    `Duração: ${report.elapsedSeconds} s · ciclos: ${report.cycles} · comandos: ${report.commandsAccepted} aceitos, ${report.commandsRefused} recusados`,
    '',
    '| Endpoint | Chamadas | p50 (ms) | p95 (ms) | máx (ms) |',
    '|---|---:|---:|---:|---:|',
    ...rows,
    '',
    errors.length === 0 ? 'Erros: nenhum' : `Erros: ${errors.join('; ')}`,
    '',
  ].join('\n');
}
