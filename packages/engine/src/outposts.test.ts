import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { seasonAt } from './clock';
import { netRates, productionRate } from './economy';
import { currentShape, migrateState } from './migrations';
import { storageCapacity } from './storage';
import { accept, apply, command, HOUR, MINUTE, SUMMER, outpostYard } from './test-helpers';
import { nextEventAt } from './timeline';
import { deriveViewState } from './view';
import v45 from './__fixtures__/state-v45-iron-ridge.json';

const ready = 45 * MINUTE;
const mine = '-3,0';
const order = (hex: string) => command('claimOutpost', { hex });

describe('postos avançados', () => {
  it('recusa pela névoa antes de revelar terreno, exige terreno produtivo, Salão, custo e vaga', () => {
    const start = outpostYard();
    for (const hex of ['2,-5', '0,1', '99,99', '__proto__'])
      expect(apply(start, order(hex))).toMatchObject({ ok: false, code: 'HEX_NOT_EXPLORED' });
    for (const hex of ['0,0', '3,-2'])
      expect(apply(start, order(hex))).toMatchObject({ ok: false, code: 'NOT_CLAIMABLE' });
    expect(
      deriveViewState(start, 0).map.hexes.find((hex) => hex.q === 0 && hex.r === 0),
    ).toMatchObject({ actions: [] });
    start.settlement.buildings.townHall = 4;
    expect(apply(start, order(mine))).toMatchObject({ ok: false, code: 'GATE_LOCKED' });
    start.settlement.buildings.townHall = 5;
    start.settlement.resources.wood = 249_999;
    expect(apply(start, order(mine))).toMatchObject({ ok: false, code: 'INSUFFICIENT_RESOURCES' });
    expect(start.map.outposts).toEqual([]);
    expect(start.ids.outpost).toBe(0);
    let state = outpostYard();
    for (const key of [mine, '1,0', '2,1']) state = accept(state, order(key)).state;
    expect(apply(state, order(mine))).toMatchObject({ ok: false, code: 'NOT_CLAIMABLE' });
    expect(apply(state, order('-2,1'))).toMatchObject({ ok: false, code: 'OUTPOST_LIMIT' });
    expect(state.ids.outpost).toBe(3);
    state = advanceTo(state, ready).state;
    state.map.outposts[0]!.status = 'damaged';
    expect(apply(state, order('-2,1'))).toMatchObject({ ok: false, code: 'OUTPOST_LIMIT' });
  });

  it('cobra uma vez, fora da fila, e ativa no prazo exato, com Crônica e visão em segundos reais', () => {
    const start = outpostYard();
    const cell = (state: typeof start) =>
      deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).map.hexes.find(
        (hex) => hex.q === -3 && hex.r === 0,
      );
    expect(cell(start)).toMatchObject({
      actions: expect.arrayContaining([{ type: 'claimOutpost', hex: mine }]),
    });
    const { state, events } = accept(start, order(mine));
    expect(events[0]).toMatchObject({
      type: 'outpostStarted',
      data: { spent_wood: 250, spent_stone: 150, spent_gold: 100 },
    });
    expect(state.settlement.resources).toMatchObject({
      wood: 550_000,
      stone: 450_000,
      gold: 300_000,
    });
    expect(state.settlement.constructionQueues).toEqual(start.settlement.constructionQueues);
    expect(state.rng).toEqual(start.rng);
    expect(nextEventAt(state)).toBe(ready);
    expect(cell(state)).toMatchObject({
      fog: 'explored',
      outpost: { id: 'outpost-1', status: 'building', readyInSeconds: 900 },
      actions: [],
    });
    const before = advanceTo(state, ready - 1);
    expect(netRates(before.state).iron).toBe(0);
    expect(cell(before.state)).toMatchObject({ outpost: { readyInSeconds: 1 } });
    expect(before.events.some((event) => event.type === 'outpostClaimed')).toBe(false);
    const active = advanceTo(before.state, ready);
    expect(active.events.filter((event) => event.type === 'outpostClaimed')).toMatchObject([
      { atMs: ready, data: { hex: mine, outpostId: 'outpost-1' } },
    ]);
    expect(cell(active.state)).toMatchObject({
      fog: 'claimed',
      outpost: { id: 'outpost-1', status: 'active', readyInSeconds: null },
    });
    expect(active.state.settlement.resources.iron).toBe(start.settlement.resources.iron);
    expect(advanceTo(active.state, ready + HOUR).state.settlement.resources.iron).toBe(
      start.settlement.resources.iron + 3000,
    );
    const iron = deriveViewState(active.state, ready, { timeScale: 3 }).resources.find(
      (row) => row.id === 'iron',
    );
    expect(iron).toMatchObject({ perHour: 9, breakdown: expect.stringContaining('9/h') });
    active.state.map.outposts[0]!.status = 'damaged';
    expect(netRates(active.state).iron).toBe(0);
    expect(cell(active.state)).toMatchObject({
      fog: 'claimed',
      outpost: { status: 'damaged', readyInSeconds: null },
      actions: [],
    });
    expect(currentShape(active.state, '')).toBeNull();
  });

  it('conclui a obra do feudo antes dos postos que vencem juntos, na ordem dos ids', () => {
    const start = accept(outpostYard(), command('startConstruction', { building: 'farm' })).state;
    start.settlement.constructionQueues[0]!.finishesAtMs = ready;
    const first = accept(start, order(mine)).state;
    const second = accept(first, order('-2,1')).state;
    const { events, state } = advanceTo(second, ready);
    expect(
      events
        .filter((event) => event.atMs === ready)
        .map((event) => [event.type, event.data.outpostId]),
    ).toEqual([
      ['constructionFinished', undefined],
      ['outpostClaimed', 'outpost-1'],
      ['outpostClaimed', 'outpost-2'],
    ]);
    expect(state.rng).toEqual(start.rng);
    expect(state.ids).toEqual({ outpost: 2 });
  });

  it('cada Veio ativo soma sua taxa, e só os ativos contribuem para o estoque', () => {
    const yard = outpostYard();
    const other = '-2,1';
    yard.map.hexes[other]!.terrain = 'ironVein';
    const first = advanceTo(accept(yard, order(mine)).state, ready).state;
    first.settlement.resources.iron = storageCapacity(first, 'iron')! - 6000;
    const second = accept(first, order(other)).state;
    const before = deriveViewState(second, ready).resources.find((row) => row.id === 'iron');
    expect(before).toMatchObject({
      perHour: 3,
      fullInSeconds: null,
      fullNote: expect.stringContaining(other),
    });
    const both = advanceTo(second, 2 * ready).state;
    expect(netRates(both).iron).toBe(6000);
    expect(
      deriveViewState(both, 2 * ready).resources.find((row) => row.id === 'iron')?.breakdown,
    ).toBe('Veio de Ferro (-3,0): 3/h + Veio de Ferro (-2,1): 3/h');
    both.map.outposts[0]!.status = 'damaged';
    expect(advanceTo(both, 2 * ready + HOUR).state.settlement.resources.iron).toBe(
      both.settlement.resources.iron + 3000,
    );
  });

  it.each([
    ['-2,1', 'lumberMill'],
    ['1,0', 'farm'],
    ['2,1', 'quarry'],
  ] as const)('aplica um fator por posto ativo em %s', (key, building) => {
    const start = outpostYard();
    start.settlement.workers[building] = 1;
    const base = advanceTo(start, ready).state;
    let state = accept(start, order(key)).state;
    if (building === 'lumberMill') state = accept(state, order('-1,-1')).state;
    expect(productionRate(state, building)).toBe(productionRate(start, building));
    state = advanceTo(state, ready).state;
    const count = state.map.outposts.length;
    expect(productionRate(state, building)).toBe(
      Math.floor((productionRate(base, building) * 23 ** count) / 20 ** count),
    );
    const resource = { lumberMill: 'wood', farm: 'food', quarry: 'stone' }[building];
    const line = deriveViewState(state, ready).resources.find(
      (row) => row.id === resource,
    )!.breakdown;
    expect(line.match(/1,15 \(Posto/g)).toHaveLength(count);
    for (const post of state.map.outposts) post.status = 'damaged';
    expect(productionRate(state, building)).toBe(productionRate(base, building));
  });

  it('combina três Florestas com Mestre, relíquia e verão, arredondando uma vez', () => {
    let state = outpostYard();
    state.map.hexes['-3,1']!.fog = 'explored';
    for (const key of ['-2,1', '-1,-1', '-3,1']) state = accept(state, order(key)).state;
    state = advanceTo(state, ready).state;
    state.settlement.buildings.lumberMill = 9;
    state.settlement.craftExperience.lumberMill = 96;
    state.settlement.morale = 73;
    state.settlement.relics = [{ defId: 'oakHeart', placed: true, effectiveFromMs: 0 }];
    const rate = productionRate(
      state,
      'lumberMill',
      { adapted: 65, adapting: 1, master: true },
      seasonAt(SUMMER),
    );
    // 65,5 braços × 8000 × 2,6 × 1,288 × 1,115 × (23/20)^6.
    expect(rate).toBe(Number(9_051_330_086_272_201n / 2_000_000_000n));
  });

  it('divide qualquer intervalo em obra ou em produção, incluindo Veio no cap e fator 23/20', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: HOUR }),
        fc.integer({ min: 0, max: ready + HOUR }),
        fc.integer({ min: 1, max: 3000 }),
        (elapsed, split, space) => {
          const initial = outpostYard();
          initial.settlement.workers.lumberMill = 2;
          initial.settlement.resources.iron = storageCapacity(initial, 'iron')! - space;
          const withVein = accept(initial, order(mine)).state;
          const state = accept(withVein, order('-2,1')).state;
          const end = ready + elapsed;
          const full = advanceTo(state, end);
          const first = advanceTo(state, Math.min(end, split));
          const rest = advanceTo(first.state, end);
          expect(rest.state).toStrictEqual(full.state);
          expect([...first.events, ...rest.events]).toStrictEqual(full.events);
          const produced = Math.floor((3000 * elapsed) / HOUR);
          expect(full.state.settlement.resources.iron).toBe(
            initial.settlement.resources.iron + Math.min(space, produced),
          );
          expect(full.state.settlement.accumulators.iron).toBe((3000 * elapsed) % HOUR);
          expect(full.state.settlement.wasted.iron).toBe(Math.max(0, produced - space));
        },
      ),
    );
  });

  it('migra o v45 por adição e só aceita postos com identidade, hexágono e prazo coerentes', () => {
    expect(migrateState(v45, { timeScale: 1 })).toEqual({
      ...v45,
      schemaVersion: 46,
      migratedAtMs: v45.lastProcessedAt,
      ids: { ...v45.ids, outpost: 0 },
      map: { ...v45.map, outposts: [] },
    });
    const state = accept(outpostYard(), order(mine)).state;
    expect(currentShape(state, '')).toBeNull();
    const snapshot = JSON.stringify(state);
    expect(nextEventAt(state)).toBe(ready);
    deriveViewState(state, state.lastProcessedAt);
    expect(JSON.stringify(state)).toBe(snapshot);
    for (const change of [
      { id: 'outpost-2' },
      { hex: '0,0' },
      { hex: '9,9' },
      { status: 'active' },
      { status: 'lost' },
      { readyAtMs: 0 },
      { extra: 1 },
    ]) {
      const outposts = [{ ...state.map.outposts[0], ...change }];
      expect(currentShape({ ...state, map: { ...state.map, outposts } }, '')).not.toBeNull();
    }
    expect(currentShape({ ...state, ids: {} }, '')).toMatch(/ids.outpost/);
    expect(currentShape({ ...state, map: { ...state.map, outposts: null } }, '')).toMatch(
      /map.outposts/,
    );
    state.ids.outpost = 2;
    state.map.outposts.push({ ...state.map.outposts[0]!, id: 'outpost-2' });
    expect(currentShape(state, '')).not.toBeNull();
    const two = accept(accept(outpostYard(), order(mine)).state, order('1,0')).state;
    expect(currentShape(two, '')).toBeNull();
    expect(
      currentShape({ ...two, map: { ...two.map, outposts: [...two.map.outposts].reverse() } }, ''),
    ).toMatch(/map\.outposts\.1\.id/);
  });
});
