import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';
import { setTimeout as sleep } from 'node:timers/promises';

import { createClient, isGameRuleError, memoryTokenStore } from '@lotg/client-sdk';
import type { Command, ViewState } from '@lotg/protocol';

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

function percentile(sorted: number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1);
  return Math.round((sorted[Math.max(0, index)] ?? 0) * 10) / 10;
}

/** Rótulo de um endpoint para o relatório: o método e a rota, sem ids nem parâmetros. */
function endpointLabel(method: string, url: string): string {
  const path = new URL(url).pathname.replace(/^\/v1/, '').replace(/\/games\/[0-9a-f-]{36}/, '');
  return `${method} ${path === '' ? '/games' : path}`;
}

/** Bots de carga: cada um cria conta e partida e joga pelo `client-sdk`, como o app web faz. */
export async function runRemote(options: RemoteOptions): Promise<RemoteReport> {
  const bot: Bot = strategies[options.strategy];
  const timings: Record<string, number[]> = {};
  const errors: Record<string, number> = {};
  const totals = { cycles: 0, accepted: 0, refused: 0 };

  // O SDK usa este fetch: é aqui que cada chamada é cronometrada.
  const timedFetch: typeof fetch = async (input, init) => {
    const label = endpointLabel(init?.method ?? 'GET', String(input));
    const startedAt = performance.now();
    const response = await fetch(input, init);
    // O corpo é lido aqui para o tempo incluir a resposta inteira.
    const text = await response.text();
    (timings[label] ??= []).push(performance.now() - startedAt);
    if (response.status >= 500 || response.status === 429) {
      errors[`${label} ${response.status}`] = (errors[`${label} ${response.status}`] ?? 0) + 1;
    }
    return new Response(response.status === 204 || response.status === 304 ? null : text, {
      status: response.status,
      headers: response.headers,
    });
  };

  async function runBot(index: number, deadline: number): Promise<void> {
    // Clientes reais não fazem polling no mesmo instante: cada bot começa em um ponto do ciclo.
    await sleep((index / options.bots) * options.pollMs);
    const client = createClient({
      baseUrl: options.baseUrl,
      tokenStore: memoryTokenStore(),
      clientVersion: 'sim-cli/0.2.0',
      fetch: timedFetch,
      retryAttempts: 1,
    });
    await client.signUpAnonymous({ displayName: `Bot ${index + 1}`, deviceLabel: 'sim-cli' });
    const game = await client.createGame({
      settlementName: `Feudo ${index + 1}`,
      timezone: 'UTC',
      vigilHourLocal: 20,
    });
    let view: ViewState | null = null;
    let stateVersion: string | null = null;
    let etag: string | null = null;
    let lastSeq = 0;

    const act: Act = async (type, payload) => {
      const command = { commandId: randomUUID(), type, payload } as Command;
      try {
        const result = await client.sendCommand(game.id, command, { stateVersion });
        totals.accepted += 1;
        view = result.view;
        stateVersion = result.stateVersion;
      } catch (error) {
        if (!isGameRuleError(error)) {
          throw error;
        }
        // Na recusa do motor, os detalhes trazem o estado avançado: o bot segue a partir dele.
        totals.refused += 1;
        view = error.details.view;
        stateVersion = error.details.stateVersion;
      }
      return view;
    };

    while (performance.now() < deadline) {
      const cycleStartedAt = performance.now();
      const read = await client.getView(game.id, { etag });
      if (read.status === 200) {
        view = read.view;
        stateVersion = read.stateVersion;
      }
      etag = read.etag;
      lastSeq = (await client.getEvents(game.id, lastSeq)).lastSeq;
      if (view !== null) {
        await bot(view, act);
      }
      totals.cycles += 1;
      const rest = options.pollMs - (performance.now() - cycleStartedAt);
      if (rest > 0) {
        await sleep(Math.min(rest, Math.max(0, deadline - performance.now())));
      }
    }
    // O bot não deixa a conta para trás: ela fica bloqueada na hora e some no expurgo.
    await client.deleteMe();
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
