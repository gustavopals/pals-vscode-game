import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { currentShape } from './migrations';
import { scheduleSiege } from './siegeTurn';
import { readySiege, siegeYard, WINTER } from './siege.test-helpers';
import { DAY, HOUR } from './test-helpers';
import { deriveEngineViewState, deriveViewState } from './view';
import { currentRepairQuote } from './wallRepair';
import type { GameState, SiegeCommand } from './types';

const order = (state: GameState, command: SiegeCommand) =>
  applyCommand(state, command, state.lastProcessedAt);
const wave = (state: GameState) => advanceTo(state, state.siege!.nextWaveAtMs!);
const golden = JSON.parse(
  Object.values(
    import.meta.glob<string>('./__golden__/siege-reference.json', {
      query: '?raw',
      import: 'default',
      eager: true,
    }),
  )[0]!,
);

describe('Cerco na linha do tempo e Plano de Batalha', () => {
  it('marca na primeira virada do outono e conserva a Vigília já marcada', () => {
    const initial = siegeYard();
    expect(initial.siege).toBeNull();
    const result = advanceTo(initial, initial.lastProcessedAt + DAY);
    expect(result.events.filter((e) => e.type === 'siegeScheduled')).toHaveLength(1);
    expect(result.state.siege!.atMs).toBe(golden.atMs);
    const next = advanceTo(result.state, result.state.lastProcessedAt + DAY);
    expect(next.events.filter((e) => e.type === 'siegeScheduled')).toHaveLength(0);
    expect(next.state.siege!.atMs).toBe(golden.atMs);
  });
  it('não marca cerco tardio que cairia após o fim do inverno na migração', () => {
    const state = siegeYard();
    // Final do inverno do ano 1 (inverno vai de 144h a 168h), a 1 minuto do ano 2
    const lateWinter = 168 * HOUR - 60_000;
    state.lastProcessedAt = lateWinter;
    state.clock.gameTimeMs = lateWinter;

    const events: GameEvent[] = [];
    scheduleSiege(state, lateWinter, events);

    expect(state.siege).toBeNull();
    expect(events.filter((e) => e.type === 'siegeScheduled')).toHaveLength(0);
  });
  it.each([0.5, 1, 3])('as ondas esperam 60 min reais no ritmo %s, com decisão interna', (pace) => {
    const before = readySiege('lord', pace);
    expect(advanceTo(before, before.siege!.atMs - 1).state.siege!.current).toBe(0);
    let state = wave(before).state;
    expect(state.siege!.current).toBe(1);
    const first = state.lastProcessedAt;
    expect(state.siege!.nextWaveAtMs).toBe(first + HOUR * pace);
    const view = deriveEngineViewState(state, state.lastProcessedAt);
    expect(view.pendingDecisions.find((d) => d.kind === 'siegeWave')).toMatchObject({
      wave: 2,
      expiresInSeconds: 3600,
    });
    expect(
      deriveViewState(state, state.lastProcessedAt).pendingDecisions.some(
        (d) => (d.kind as string) === 'siegeWave',
      ),
    ).toBe(false);
    state = wave(state).state;
    expect(state.siege!.current).toBe(2);
    expect(state.siege!.nextWaveAtMs).toBe(first + 2 * HOUR * pace);
    state = wave(state).state;
    expect(state.siege!.current).toBe(3);
    expect(state.siege!.nextWaveAtMs).toBeNull();
    expect(currentShape(state, '')).toBeNull();
    expect(Object.keys(state.rng).some((key) => key.startsWith('battle:'))).toBe(false);
  });
  it('reproduz os três relatórios do golden fixado antes do motor', () => {
    let state = readySiege();
    for (const expected of golden.reports) {
      const result = wave(state);
      state = result.state;
      const report = state.army.reports.at(-1)!;
      expect({
        wave: state.siege!.current,
        atMs: report.foughtAtMs,
        outcome: report.outcome,
        ending: report.ending,
        rounds: report.rounds,
        casualties: report.casualties,
        wall: report.wall,
      }).toEqual(expected);
    }
    expect(state.army.units).toEqual(golden.units);
    expect(state.ids).toEqual(golden.ids);
  });
  it('vale o Plano sem resposta e a troca só altera a onda seguinte, sem sorteio', () => {
    const before = readySiege();
    before.ids.formation = 2;
    before.army.formations.push({
      ...JSON.parse(JSON.stringify(before.army.formations[0]!)),
      id: 'formation-2',
      name: 'Outra defesa',
    });
    const planned = order(before, {
      commandId: 'plan',
      type: 'setBattlePlan',
      payload: { wave: 2, formationId: 'formation-2' },
    });
    expect(planned.ok).toBe(true);
    if (!planned.ok) throw new Error(planned.message);
    const first = wave(planned.state).state;
    expect(first.army.reports.at(-1)!.formationId).toBe('formation-1');
    expect(wave(first).state.army.reports.at(-1)!.formationId).toBe('formation-2');
    const swapped = order(first, {
      commandId: 'swap',
      type: 'swapWaveFormation',
      payload: { formationId: 'formation-1' },
    });
    if (!swapped.ok) throw new Error(swapped.message);
    expect(swapped.state.rng).toEqual(first.rng);
    expect(swapped.state.ids).toEqual(first.ids);
    expect(wave(swapped.state).state.army.reports.at(-1)!.formationId).toBe('formation-1');
    expect(
      order(first, {
        commandId: 'late-plan',
        type: 'setBattlePlan',
        payload: { wave: 3, formationId: null },
      }),
    ).toMatchObject({ ok: false, code: 'SIEGE_STARTED' });
  });
  it('o dano persiste, sem reparo automático; o reparo de emergência paga pedra e ouro', () => {
    const first = wave(readySiege()).state;
    const quote = currentRepairQuote(first);
    expect(quote.stone).toBeGreaterThan(0);
    const without = wave(first).state.army.reports.at(-1)!;
    for (const wing of without.wall) expect(wing.start).toBe(first.settlement.wall.hp[wing.wing]);
    const fixed = order(first, { commandId: 'repair', type: 'emergencyRepair', payload: {} });
    if (!fixed.ok) throw new Error(fixed.message);
    expect(fixed.state.settlement.resources.stone).toBe(
      first.settlement.resources.stone - quote.stone * 1000,
    );
    expect(fixed.state.settlement.resources.gold).toBe(
      first.settlement.resources.gold - quote.gold * 1000,
    );
    expect(fixed.state.settlement.wall.hp).toEqual({ left: 800, center: 800, right: 800 });
    expect(fixed.state.settlement.wallRepair).toBeNull();
    expect(
      order(readySiege(), { commandId: 'early', type: 'emergencyRepair', payload: {} }),
    ).toMatchObject({ ok: false, code: 'NO_WAVE_DECISION' });
  });
  it('a obra do mesmo instante precede a onda e a troca no prazo já chega tarde', () => {
    const before = readySiege();
    before.settlement.buildings.watchtower = 4;
    before.settlement.constructionQueues[0] = {
      building: 'watchtower',
      targetLevel: 5,
      startedAtMs: before.lastProcessedAt - HOUR,
      finishesAtMs: before.siege!.atMs,
    };
    const first = wave(before);
    expect(first.events.findIndex((e) => e.type === 'constructionFinished')).toBeLessThan(
      first.events.findIndex((e) => e.type === 'siegeWaveFought'),
    );
    const end = wave(wave(first.state).state).state;
    expect(
      order(end, { commandId: 'late', type: 'swapWaveFormation', payload: { formationId: null } }),
    ).toMatchObject({ ok: false, code: 'NO_WAVE_DECISION' });
  });
  it('migração tardia agenda no futuro e a visão não deixa escapar composição', () => {
    const before = siegeYard();
    before.lastProcessedAt = WINTER + 13 * HOUR;
    before.clock.gameTimeMs = before.lastProcessedAt;
    scheduleSiege(before, before.lastProcessedAt, []);
    expect(before.siege!.atMs).toBeGreaterThan(before.lastProcessedAt);
    expect(before.siege!.atMs).toBeLessThan(WINTER + 24 * HOUR);
    const copy = JSON.stringify(before);
    const view = deriveEngineViewState(before, before.lastProcessedAt);
    expect(JSON.stringify(before)).toBe(copy);
    expect(JSON.stringify(view.siege)).not.toMatch(
      /composition|blackKnight|warlord|reductionPercent/,
    );
  });
  it('a divisão de intervalo permanece exata antes e entre ondas', () => {
    const start = readySiege();
    const end = start.siege!.atMs + balance.siege.waveIntervalRealMs * 2 + 10;
    const whole = advanceTo(start, end);
    let state = start;
    const events = [];
    for (const cut of [
      start.siege!.atMs,
      start.siege!.atMs + HOUR - 1,
      start.siege!.atMs + HOUR,
      end,
    ]) {
      const result = advanceTo(state, cut);
      state = result.state;
      events.push(...result.events);
    }
    expect({ state, events }).toEqual(whole);
  });
});
