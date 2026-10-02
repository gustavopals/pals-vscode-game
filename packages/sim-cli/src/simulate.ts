import {
  advanceTo,
  applyCommand,
  type BuildingId,
  type Command,
  createInitialState,
  deriveViewState,
  type GameEvent,
  type GameState,
  type ResourceId,
  type SeasonId,
} from '@lotg/engine';

import { economico } from './bots/economico';
import type { Act, Bot } from './bots/types';

const HOUR_MS = 3_600_000;
const HOURS_PER_REAL_DAY = 24;

export const strategies = { economico } satisfies Record<string, Bot>;
export type StrategyName = keyof typeof strategies;

export type SimulationOptions = {
  seed: string;
  /** Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo. */
  days: number;
  strategy: StrategyName;
  /** Sessões por dia real, a intervalos iguais. */
  sessionsPerDay: number;
  /**
   * Horas de jogo por hora real (ADR 0011). Padrão 1, o ritmo Normal em que as faixas de
   * balanceamento são definidas. O servidor cria as partidas no ritmo 3.
   */
  timeScale?: number;
};

/** Retrato do feudo ao fim de uma hora real. As taxas `perHour` são por hora real. */
export type HourRow = {
  hour: number;
  realDay: number;
  year: number;
  season: SeasonId;
  dayOfSeason: number;
  stock: Record<ResourceId, number>;
  perHour: Record<ResourceId, number>;
  villagers: number;
  capacity: number;
  free: number;
  inTraining: number;
  levels: Record<BuildingId, number>;
  famine: boolean;
};

export type SimulationResult = {
  options: SimulationOptions;
  rows: HourRow[];
  events: GameEvent[];
  finalState: GameState;
  commands: { accepted: number; refused: Record<string, number> };
};

function rowAt(state: GameState, hour: number, timeScale: number): HourRow {
  const view = deriveViewState(state, state.lastProcessedAt, { timeScale });
  const byResource = <T>(pick: (row: (typeof view.resources)[number]) => T) =>
    Object.fromEntries(view.resources.map((row) => [row.id, pick(row)])) as Record<ResourceId, T>;
  return {
    hour,
    realDay: Math.ceil(hour / HOURS_PER_REAL_DAY),
    year: view.calendar.year,
    season: view.calendar.season,
    dayOfSeason: view.calendar.dayOfSeason,
    stock: byResource((row) => row.stock),
    perHour: byResource((row) => row.perHour),
    villagers: view.population.villagers,
    capacity: view.population.capacity,
    free: view.population.free,
    inTraining: view.population.inTraining,
    levels: { ...state.settlement.buildings },
    famine: view.famine !== null,
  };
}

/**
 * Joga uma partida inteira em processo, só com o motor. As sessões começam na criação da partida
 * e se repetem a intervalos iguais de tempo real; entre elas o mundo anda sozinho. Uma linha por
 * hora real. No ritmo `N`, cada hora real são `N` horas de jogo: o bot joga as mesmas sessões por
 * dia e encontra `N` vezes mais mundo andado entre uma e outra.
 */
export async function simulate(options: SimulationOptions): Promise<SimulationResult> {
  const { seed, days, sessionsPerDay } = options;
  const timeScale = options.timeScale ?? 1;
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error(`Ritmo inválido: ${timeScale}.`);
  }
  /** Instante de jogo de um instante real, os dois em ms desde a criação da partida. */
  const gameMs = (realMs: number) => Math.round(realMs * timeScale);
  const bot: Bot = strategies[options.strategy];
  let state = createInitialState(seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale,
  });
  const events: GameEvent[] = [];
  const rows: HourRow[] = [];
  const commands: SimulationResult['commands'] = { accepted: 0, refused: {} };
  let commandCount = 0;

  const act: Act = async (type, payload) => {
    commandCount += 1;
    const command = { commandId: `${seed}-${commandCount}`, type, payload } as Command;
    const result = applyCommand(state, command, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
      events.push(...result.events);
      commands.accepted += 1;
    } else {
      commands.refused[result.code] = (commands.refused[result.code] ?? 0) + 1;
    }
    return deriveViewState(state, state.lastProcessedAt, { timeScale });
  };

  // Daqui em diante os instantes são reais; `gameMs` converte na hora de mover o motor.
  const sessionEveryMs = Math.round((HOURS_PER_REAL_DAY * HOUR_MS) / sessionsPerDay);
  const endMs = days * HOURS_PER_REAL_DAY * HOUR_MS;
  let nextSessionMs = 0;

  for (let hour = 1; hour <= days * HOURS_PER_REAL_DAY; hour += 1) {
    const hourEndMs = hour * HOUR_MS;
    while (nextSessionMs < hourEndMs && nextSessionMs < endMs) {
      const advanced = advanceTo(state, gameMs(nextSessionMs));
      state = advanced.state;
      events.push(...advanced.events);
      await bot(deriveViewState(state, state.lastProcessedAt, { timeScale }), act);
      nextSessionMs += sessionEveryMs;
    }
    const advanced = advanceTo(state, gameMs(hourEndMs));
    state = advanced.state;
    events.push(...advanced.events);
    rows.push(rowAt(state, hour, timeScale));
  }

  return { options, rows, events, finalState: state, commands };
}
