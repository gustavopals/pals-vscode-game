import { performance } from 'node:perf_hooks';

import { advanceTo, deriveViewState, type GameState } from '@lotg/engine';

import type { Bot } from './bots/types';
import { identityLine } from './identity';
import { formatDecimal } from './report';
import { simulate, type SimulationOptions } from './simulate';

const HOUR_MS = 3_600_000;
const DAY_HOURS = 24;

/**
 * Medida de desempenho do motor para a volta de uma ausência longa (roadmap da v0.2, V2C-T7.4):
 * quanto custa um `advanceTo` que atravessa dias reais de uma vez, e quanto pesam o estado e a
 * visão. No ritmo 3 um dia real são 36 viradas de dia de jogo, cada uma com experiência do
 * ofício, moral, sorteios e o fecho do desperdício.
 */
export type PerfOptions = {
  /** Ritmo das partidas medidas; o padrão é o recomendado pelo jogo. */
  timeScale?: number;
  /** As ausências medidas, em dias reais. */
  absencesInDays?: readonly number[];
  /** Repetições de cada medida; o relatório traz a mediana e a pior. */
  runs?: number;
};

const DEFAULTS = { timeScale: 3, absencesInDays: [1, 7, 30], runs: 9 } as const;

type Scenario = {
  id: string;
  label: string;
  /** Dias reais jogados pelo bot antes da ausência; 0 é o feudo recém-fundado, sem ordens. */
  playedDays: number;
};

/** Os feudos medidos: o que ninguém tocou, o do meio do jogo e o que já esgotou as obras. */
export const PERF_SCENARIOS: readonly Scenario[] = [
  { id: 'novo', label: 'Feudo novo, sem nenhuma ordem', playedDays: 0 },
  { id: 'meio', label: 'Feudo de 2 dias reais (bot econômico, 2 visitas por dia)', playedDays: 2 },
  { id: 'fim', label: 'Feudo de 7 dias reais (bot econômico, 2 visitas por dia)', playedDays: 7 },
];

export type PerfMeasure = {
  scenario: string;
  absenceDays: number;
  /** Viradas de dia de jogo atravessadas pela ausência. */
  gameDays: number;
  /** Milissegundos de um `advanceTo` só, do começo ao fim da ausência. */
  advanceMs: { median: number; max: number };
  /** Milissegundos de um `deriveViewState` no estado da volta. */
  viewMs: { median: number; max: number };
  /** Eventos emitidos pela ausência: são linhas a gravar em `events`. */
  events: number;
  /** Tamanho do estado e da visão da volta, em bytes de JSON (UTF-8). */
  stateBytes: number;
  viewBytes: number;
  /** Habitantes na volta. */
  villagers: number;
};

export type PerfReport = {
  timeScale: number;
  runs: number;
  node: string;
  platform: string;
  measures: PerfMeasure[];
};

const noOrders: Bot = async () => {};

/** O estado de um cenário: a partida jogada pelo bot por `playedDays` dias reais. */
async function stateOf(scenario: Scenario, timeScale: number): Promise<GameState> {
  const base: SimulationOptions = {
    seed: 'pedra-alta-001',
    days: Math.max(1, scenario.playedDays),
    strategy: 'economico',
    sessionsPerDay: 2,
    timeScale,
  };
  // O feudo novo é o de uma hora real depois da fundação, sem ordem nenhuma.
  const result =
    scenario.playedDays === 0
      ? await simulate({ ...base, hours: 1, bot: noOrders })
      : await simulate(base);
  return result.finalState;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

function timed<T>(runs: number, work: () => T): { median: number; max: number; value: T } {
  // Duas voltas de aquecimento, fora da medida: o primeiro `advanceTo` paga a compilação.
  work();
  work();
  const times: number[] = [];
  let value = work();
  for (let run = 0; run < runs; run += 1) {
    const start = performance.now();
    value = work();
    times.push(performance.now() - start);
  }
  return { median: median(times), max: Math.max(...times), value };
}

const bytes = (value: unknown) => Buffer.byteLength(JSON.stringify(value), 'utf8');

export async function runPerf(options: PerfOptions = {}): Promise<PerfReport> {
  const timeScale = options.timeScale ?? DEFAULTS.timeScale;
  const absences = options.absencesInDays ?? DEFAULTS.absencesInDays;
  const runs = options.runs ?? DEFAULTS.runs;
  const measures: PerfMeasure[] = [];
  for (const scenario of PERF_SCENARIOS) {
    const state = await stateOf(scenario, timeScale);
    for (const absenceDays of absences) {
      const gameMs = Math.round(absenceDays * DAY_HOURS * HOUR_MS * timeScale);
      const target = state.lastProcessedAt + gameMs;
      const advance = timed(runs, () => advanceTo(state, target));
      const back = advance.value.state;
      const view = timed(runs, () => deriveViewState(back, back.lastProcessedAt, { timeScale }));
      measures.push({
        scenario: scenario.id,
        absenceDays,
        gameDays: Math.round(gameMs / (2 * HOUR_MS)),
        advanceMs: { median: advance.median, max: advance.max },
        viewMs: { median: view.median, max: view.max },
        events: advance.value.events.length,
        stateBytes: bytes(back),
        viewBytes: bytes(view.value),
        villagers: view.value.population.villagers,
      });
    }
  }
  return {
    timeScale,
    runs,
    node: process.version,
    platform: `${process.platform} ${process.arch}`,
    measures,
  };
}

/** Milissegundos com uma casa: `12,3`. */
const ms = (value: number) => formatDecimal(Math.round(value * 10) / 10);
/** Milhar com ponto: `12.345`. */
const int = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** O relatório em Markdown, pronto para docs/balance-v0.2.md. */
export function formatPerf(report: PerfReport): string {
  const label = (id: string) => PERF_SCENARIOS.find((entry) => entry.id === id)?.label ?? id;
  const header = [
    'Feudo',
    'Ausência (dias reais)',
    'Viradas de dia de jogo',
    '`advanceTo` (ms, mediana)',
    '`advanceTo` (ms, pior)',
    '`deriveViewState` (ms, mediana)',
    'Eventos emitidos',
    'Estado (bytes)',
    'Visão (bytes)',
    'Habitantes na volta',
  ];
  const line = (cells: string[]) => `| ${cells.join(' | ')} |`;
  const rows = report.measures.map((measure) =>
    line([
      label(measure.scenario),
      String(measure.absenceDays),
      int(measure.gameDays),
      ms(measure.advanceMs.median),
      ms(measure.advanceMs.max),
      ms(measure.viewMs.median),
      int(measure.events),
      int(measure.stateBytes),
      int(measure.viewBytes),
      String(measure.villagers),
    ]),
  );
  return [
    '# Desempenho do motor em ausências longas',
    '',
    `${identityLine()} · ritmo ${formatDecimal(report.timeScale)}× · Node ${report.node} · ${report.platform} · ${report.runs} repetições por medida`,
    '',
    'Cada linha é um `advanceTo` só, do instante em que o jogador saiu ao da volta, seguido de um `deriveViewState`. O tempo é de processo, sem banco nem rede; estado e visão são o JSON que o servidor grava e responde.',
    '',
    line(header),
    line(header.map(() => '---')),
    ...rows,
    '',
  ].join('\n');
}
