import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { DAY_MS, YEAR_MS } from './clock';
import { accept, command, eventsOfType, HOUR, newGame } from './test-helpers';
import type { GameEvent, GameState } from './types';

function steps(start: GameState, count: number, stepMs: number) {
  let state = start;
  const events: GameEvent[] = [];
  for (let index = 1; index <= count; index += 1) {
    const result = advanceTo(state, start.lastProcessedAt + index * stepMs);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('advanceTo', () => {
  it('avançar para o presente ou para o passado não faz nada', () => {
    const state = advanceTo(newGame(), 5 * HOUR).state;
    expect(advanceTo(state, 5 * HOUR)).toEqual({ state, events: [] });
    expect(advanceTo(state, HOUR)).toEqual({ state, events: [] });
    expect(advanceTo(state, HOUR).state).toBe(state);
  });

  it('não muta o estado de entrada', () => {
    const state = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;
    const before = JSON.stringify(state);
    advanceTo(state, 30 * 24 * HOUR);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('atualiza o relógio junto com lastProcessedAt', () => {
    const { state } = advanceTo(newGame(), 5 * HOUR + 17);
    expect(state.lastProcessedAt).toBe(5 * HOUR + 17);
    expect(state.clock).toEqual({ gameTimeMs: 5 * HOUR + 17, yearStartMs: 0, year: 1 });
  });

  it('emite a virada de dia no instante exato', () => {
    const before = advanceTo(newGame(), DAY_MS - 1);
    expect(eventsOfType(before.events, 'dayStarted')).toEqual([]);
    const { events } = advanceTo(before.state, DAY_MS);
    const [dayStarted] = eventsOfType(events, 'dayStarted');
    expect(dayStarted).toMatchObject({ atMs: DAY_MS, data: { dayOfYear: 2 } });
    expect(dayStarted?.text).toBe('Amanhece o 2º dia da Primavera em Pedra Alta.');
  });

  it('emite a virada de estação no instante exato, antes do amanhecer do dia', () => {
    const { events } = advanceTo(newGame(), 24 * DAY_MS);
    const atBoundary = events.filter((event) => event.atMs === 24 * DAY_MS);
    expect(atBoundary.map((event) => event.type)).toEqual(['seasonChanged', 'dayStarted']);
    expect(atBoundary[0]).toMatchObject({ data: { season: 'summer' } });
    expect(atBoundary[0]?.text).toBe('Chega o Verão a Pedra Alta.');
    expect(eventsOfType(events, 'seasonChanged')).toHaveLength(1);
  });

  it('vira o ano depois de 84 dias e registra na Crônica', () => {
    const { state, events } = advanceTo(newGame(), YEAR_MS);
    expect(state.clock).toEqual({ gameTimeMs: YEAR_MS, yearStartMs: YEAR_MS, year: 2 });
    const atBoundary = events.filter((event) => event.atMs === YEAR_MS);
    expect(atBoundary.map((event) => event.type)).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
    ]);
    expect(atBoundary[0]?.text).toBe('Começa o ano 2 da Casa de Pedra Alta.');
    expect(eventsOfType(events, 'dayStarted')).toHaveLength(84);
    expect(eventsOfType(events, 'seasonChanged')).toHaveLength(4);
  });

  it('30 dias de uma vez produzem os mesmos eventos e o mesmo estado que 720 passos de 1 h', () => {
    const start = accept(newGame(), command('setWorkers', { building: 'farm', count: 1 })).state;
    const atOnce = advanceTo(start, 720 * HOUR);
    const stepped = steps(start, 720, HOUR);
    expect(stepped.events).toStrictEqual(atOnce.events);
    expect(stepped.state).toStrictEqual(atOnce.state);
    expect(eventsOfType(atOnce.events, 'dayStarted')).toHaveLength(360);
  });

  it('os eventos saem em ordem de instante', () => {
    let state = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    state = accept(state, command('startConstruction', { building: 'lumberMill' })).state;
    const { events } = advanceTo(state, 3 * 24 * HOUR);
    const instants = events.map((event) => event.atMs);
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
  });
});
