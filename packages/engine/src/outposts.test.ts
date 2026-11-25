import { balance } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { seasonAt } from './clock';
import { netRates, productionRate } from './economy';
import { currentShape, migrateState } from './migrations';
import { readySiege } from './siege.test-helpers';
import { storageCapacity } from './storage';
import { accept, apply, command, DAY, HOUR, MINUTE, SUMMER, outpostYard } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState } from './types';
import { deriveViewState } from './view';
import v45 from './__fixtures__/state-v45-iron-ridge.json';

const ready = 45 * MINUTE;
const mine = '-3,0';
const order = (hex: string) => command('claimOutpost', { hex });
const repairOrder = (outpostId: string) => command('repairOutpost', { outpostId });

function scheduleBreachingRaid(state: GameState, atMs: number, id = 'raid-test'): void {
  state.settlement.buildings.palisade = 0;
  state.settlement.wall.hp = { left: 0, center: 0, right: 0 };
  state.horde.scheduledRaids = [
    {
      id,
      atMs,
      kind: 'threat',
      enemy: 'wolves',
      size: 'light',
      announcedAtMs: null,
      composition: null,
    },
  ];
}

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
      detail: expect.stringContaining('125 madeira e 75 pedra'),
      outpost: {
        id: 'outpost-1',
        status: 'damaged',
        readyInSeconds: null,
        detail: expect.stringContaining('danificado'),
        repairBlockedReason: null,
      },
      actions: [{ type: 'repairOutpost', outpostId: 'outpost-1' }],
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

  it('incursão que rompe a defesa danifica o posto ativo mais distante, com aviso, Crônica e relatório', () => {
    let state = outpostYard();
    state.settlement.resources.wood = 1_000_000;
    state.settlement.buildings.watchtower = 2;
    state.settlement.workers.lumberMill = 2;
    state.settlement.workers.farm = 2;
    // Distâncias: 1,0 = 1; -2,1 = 2; -3,0 = 3 (mais distante).
    for (const hex of ['1,0', '-2,1', mine]) state = accept(state, order(hex)).state;
    state = advanceTo(state, ready).state;
    const raidAt = ready + HOUR;
    scheduleBreachingRaid(state, raidAt, 'raid-breach-1');
    const sighted = advanceTo(state, raidAt - 30 * MINUTE).state;
    const incomingView = deriveViewState(sighted, sighted.lastProcessedAt).threat;
    expect(incomingView.known && incomingView.incoming?.outpostRiskText).toContain(
      'Veio de Ferro (-3,0)',
    );

    const struck = advanceTo(sighted, raidAt);
    expect(struck.state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '1,0', status: 'active', readyAtMs: null },
      { id: 'outpost-2', hex: '-2,1', status: 'active', readyAtMs: null },
      { id: 'outpost-3', hex: mine, status: 'damaged', readyAtMs: null },
    ]);
    expect(struck.state.map.hexes[mine]!.fog).toBe('claimed');
    expect(netRates(struck.state).iron).toBe(0);

    const damaged = struck.events.find((event) => event.type === 'outpostDamaged');
    expect(damaged).toMatchObject({
      atMs: raidAt,
      data: { outpostId: 'outpost-3', hex: mine, battleId: 'battle-1' },
    });
    expect(damaged?.text).toContain('Veio de Ferro (-3,0)');

    const suffered = struck.events.find((event) => event.type === 'raidSuffered');
    expect(suffered?.data).toMatchObject({
      damagedOutpostId: 'outpost-3',
      damagedOutpostHex: mine,
    });
    expect(suffered?.text).toContain('Veio de Ferro (-3,0)');

    const view = deriveViewState(struck.state, raidAt);
    expect(view.army.reports[0]?.damagedOutpost).toEqual({
      outpostId: 'outpost-3',
      hex: mine,
      text: expect.stringContaining('Veio de Ferro (-3,0)'),
    });
    expect(view.map.hexes.find((hex) => hex.q === -3 && hex.r === 0)).toMatchObject({
      fog: 'claimed',
      detail: expect.stringContaining('125 madeira e 75 pedra'),
      outpost: {
        id: 'outpost-3',
        status: 'damaged',
        readyInSeconds: null,
        repairBlockedReason: null,
      },
      actions: [{ type: 'repairOutpost', outpostId: 'outpost-3' }],
    });

    // Estado com relatório referenciando posto danificado passa na guarda v46 após roundtrip JSON.
    const serialized = JSON.parse(JSON.stringify(struck.state)) as GameState;
    expect(currentShape(serialized, '')).toBeNull();
    // Guarda v46 rejeita referência a posto desconhecido ou em batalha vencida.
    const badId = JSON.parse(JSON.stringify(struck.state)) as GameState;
    badId.army.reports[0] = {
      ...badId.army.reports[0]!,
      damagedOutpost: { id: 'outpost-9', hex: mine },
    };
    expect(currentShape(badId, '')).toMatch(/damagedOutpost/);
    const badOutcome = JSON.parse(JSON.stringify(struck.state)) as GameState;
    badOutcome.army.reports[0] = { ...badOutcome.army.reports[0]!, outcome: 'victory' };
    expect(currentShape(badOutcome, '')).toMatch(/damagedOutpost/);

    // Segunda incursão que rompe ignora o já danificado (-3,0) e atinge o próximo ativo mais distante (-2,1).
    const raid2At = raidAt + 2 * HOUR;
    scheduleBreachingRaid(struck.state, raid2At, 'raid-breach-2');
    const struck2 = advanceTo(struck.state, raid2At);
    expect(struck2.state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '1,0', status: 'active', readyAtMs: null },
      { id: 'outpost-2', hex: '-2,1', status: 'damaged', readyAtMs: null },
      { id: 'outpost-3', hex: mine, status: 'damaged', readyAtMs: null },
    ]);
    expect(struck2.events.find((event) => event.type === 'outpostDamaged')).toMatchObject({
      data: { outpostId: 'outpost-2', hex: '-2,1' },
    });
  });

  it('desempata postos ativos à mesma distância pelo menor id numérico e ignora postos em obra', () => {
    // Distância 2: -2,1 e -1,-1. Quem foi criado primeiro (menor id) é atingido primeiro.
    const buildPair = (firstHex: string, secondHex: string) => {
      let state = outpostYard();
      state = accept(state, order(firstHex)).state;
      state = accept(state, order(secondHex)).state;
      state = advanceTo(state, ready).state;
      // Posto mais distante (distância 3) ainda em obra NÃO deve ser escolhido.
      state = accept(state, order(mine)).state;
      const raidAt = ready + 10 * MINUTE;
      scheduleBreachingRaid(state, raidAt, 'raid-tie');
      return advanceTo(state, raidAt);
    };

    const orderA = buildPair('-2,1', '-1,-1');
    expect(orderA.state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '-2,1', status: 'damaged', readyAtMs: null },
      { id: 'outpost-2', hex: '-1,-1', status: 'active', readyAtMs: null },
      { id: 'outpost-3', hex: mine, status: 'building', readyAtMs: 2 * ready },
    ]);
    expect(orderA.events.find((event) => event.type === 'outpostDamaged')?.data).toMatchObject({
      outpostId: 'outpost-1',
      hex: '-2,1',
    });

    const orderB = buildPair('-1,-1', '-2,1');
    expect(orderB.state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '-1,-1', status: 'damaged', readyAtMs: null },
      { id: 'outpost-2', hex: '-2,1', status: 'active', readyAtMs: null },
      { id: 'outpost-3', hex: mine, status: 'building', readyAtMs: 2 * ready },
    ]);
    expect(orderB.events.find((event) => event.type === 'outpostDamaged')?.data).toMatchObject({
      outpostId: 'outpost-1',
      hex: '-1,-1',
    });
  });

  it('sem posto ativo ou com incursão repelida, nada muda nas incursões nem nos relatórios', () => {
    const withoutPost = outpostYard();
    withoutPost.settlement.buildings.watchtower = 2;
    const raidAt = HOUR;
    scheduleBreachingRaid(withoutPost, raidAt, 'raid-none');
    const incoming = deriveViewState(withoutPost, 0).threat;
    expect(incoming.known && incoming.incoming).not.toHaveProperty('outpostRiskText');

    const hit = advanceTo(withoutPost, raidAt);
    expect(hit.events.some((event) => event.type === 'outpostDamaged')).toBe(false);
    const suffered = hit.events.find((event) => event.type === 'raidSuffered');
    expect(suffered?.data).not.toHaveProperty('damagedOutpostId');
    expect(suffered?.data).not.toHaveProperty('damagedOutpostHex');
    expect(hit.state.army.reports[0]).not.toHaveProperty('damagedOutpost');
    expect(deriveViewState(hit.state, raidAt).army.reports[0]).not.toHaveProperty('damagedOutpost');

    // Paliçada que segura a incursão mantém o posto ativo intacto.
    let defended = accept(outpostYard(), order(mine)).state;
    defended = advanceTo(defended, ready).state;
    scheduleBreachingRaid(defended, ready + HOUR, 'raid-held');
    defended.settlement.buildings.palisade = 1;
    defended.settlement.wall.hp = { left: 60, center: 60, right: 60 };
    const held = advanceTo(defended, ready + HOUR);
    expect(held.events.some((event) => event.type === 'raidRepelled')).toBe(true);
    expect(held.events.some((event) => event.type === 'outpostDamaged')).toBe(false);
    expect(held.state.map.outposts[0]?.status).toBe('active');
  });

  it('repara posto danificado imediatamente em madeira e pedra, retoma produção e recusa usos inválidos', () => {
    const building = accept(outpostYard(), order(mine)).state;
    expect(apply(building, repairOrder('outpost-1'))).toMatchObject({
      ok: false,
      code: 'OUTPOST_NOT_DAMAGED',
    });
    expect(apply(building, repairOrder('outpost-99'))).toMatchObject({
      ok: false,
      code: 'OUTPOST_NOT_DAMAGED',
    });

    const active = advanceTo(building, ready).state;
    expect(apply(active, repairOrder('outpost-1'))).toMatchObject({
      ok: false,
      code: 'OUTPOST_NOT_DAMAGED',
    });

    const raidAt = ready + HOUR;
    scheduleBreachingRaid(active, raidAt, 'raid-for-repair');
    const damaged = advanceTo(active, raidAt).state;
    expect(damaged.map.outposts[0]?.status).toBe('damaged');
    expect(netRates(damaged).iron).toBe(0);

    // Sem madeira suficiente: recusa INSUFFICIENT_RESOURCES e ficha oculta ação mas mostra motivo.
    const poor = JSON.parse(JSON.stringify(damaged)) as GameState;
    poor.settlement.resources.wood = (balance.outposts.repairCost.wood! - 1) * 1000;
    expect(apply(poor, repairOrder('outpost-1'))).toMatchObject({
      ok: false,
      code: 'INSUFFICIENT_RESOURCES',
    });
    const poorCell = deriveViewState(poor, raidAt).map.hexes.find(
      (hex) => hex.q === -3 && hex.r === 0,
    );
    expect(poorCell).toMatchObject({
      fog: 'claimed',
      actions: [],
      outpost: {
        id: 'outpost-1',
        status: 'damaged',
        repairBlockedReason: expect.stringContaining('madeira'),
        repairCost: [
          expect.objectContaining({ resource: 'wood', amount: 125, missing: 1 }),
          expect.objectContaining({ resource: 'stone', amount: 75, missing: 0 }),
        ],
      },
    });

    // Com recursos: cobra madeira e pedra (não cobra ouro), volta a active e emite outpostRepaired.
    const woodBefore = damaged.settlement.resources.wood;
    const stoneBefore = damaged.settlement.resources.stone;
    const goldBefore = damaged.settlement.resources.gold;
    const rngBefore = JSON.stringify(damaged.rng);
    const idsBefore = JSON.stringify(damaged.ids);
    const repaired = accept(damaged, repairOrder('outpost-1'));

    expect(repaired.state.map.outposts[0]).toEqual({
      id: 'outpost-1',
      hex: mine,
      status: 'active',
      readyAtMs: null,
    });
    expect(repaired.state.map.hexes[mine]!.fog).toBe('claimed');
    expect(repaired.state.settlement.resources.wood).toBe(woodBefore - 125_000);
    expect(repaired.state.settlement.resources.stone).toBe(stoneBefore - 75_000);
    expect(repaired.state.settlement.resources.gold).toBe(goldBefore);
    expect(JSON.stringify(repaired.state.rng)).toBe(rngBefore);
    expect(JSON.stringify(repaired.state.ids)).toBe(idsBefore);
    expect(repaired.events).toMatchObject([
      {
        type: 'outpostRepaired',
        atMs: raidAt,
        data: { outpostId: 'outpost-1', hex: mine, spent_wood: 125, spent_stone: 75 },
      },
    ]);
    expect(repaired.events[0]?.text).toContain('Veio de Ferro (-3,0)');
    expect(netRates(repaired.state).iron).toBe(3000);
    expect(advanceTo(repaired.state, raidAt + HOUR).state.settlement.resources.iron).toBe(
      repaired.state.settlement.resources.iron + 3000,
    );
    expect(apply(repaired.state, repairOrder('outpost-1'))).toMatchObject({
      ok: false,
      code: 'OUTPOST_NOT_DAMAGED',
    });
    expect(
      deriveViewState(repaired.state, raidAt).map.hexes.find((hex) => hex.q === -3 && hex.r === 0),
    ).toMatchObject({
      fog: 'claimed',
      actions: [],
      outpost: { id: 'outpost-1', status: 'active', readyInSeconds: null },
    });
    expect(currentShape(repaired.state, '')).toBeNull();
  });

  it('Queda do Cerco danifica o posto ativo mais distante; Vitória com brecha não danifica', () => {
    const setupSiegeWithOutposts = () => {
      const state = readySiege();
      state.settlement.buildings.townHall = 5;
      Object.assign(state.settlement.resources, { wood: 800_000, stone: 600_000, gold: 400_000 });
      state.map.hexes['1,0']!.fog = 'explored';
      state.map.hexes[mine]!.fog = 'explored';
      let withPosts = accept(state, order('1,0')).state;
      withPosts = accept(withPosts, order(mine)).state;
      return advanceTo(withPosts, withPosts.lastProcessedAt + ready).state;
    };

    // Vitória com brecha: a Horda foi repelida, nenhum posto é danificado.
    const wonState = setupSiegeWithOutposts();
    wonState.siege!.breached = true;
    const won = advanceTo(wonState, wonState.siege!.atMs + 2 * HOUR);
    expect(won.state.siege!.result).toBe('victory');
    expect(won.events.some((event) => event.type === 'outpostDamaged')).toBe(false);
    expect(won.state.map.outposts.every((post) => post.status === 'active')).toBe(true);

    // Queda do Cerco: danifica o posto ativo mais distante (-3,0), anota no relatório e permite reparo mesmo se o Salão cair.
    const fallState = setupSiegeWithOutposts();
    fallState.army.units = { spearman: 0, swordsman: 0, archer: 0, knight: 0, shieldbearer: 0 };
    const fell = advanceTo(fallState, fallState.siege!.atMs + 2 * HOUR);
    expect(fell.state.siege!.result).toBe('fall');
    expect(fell.state.map.outposts).toEqual([
      { id: 'outpost-1', hex: '1,0', status: 'active', readyAtMs: null },
      { id: 'outpost-2', hex: mine, status: 'damaged', readyAtMs: null },
    ]);
    expect(fell.events.find((event) => event.type === 'outpostDamaged')).toMatchObject({
      data: { outpostId: 'outpost-2', hex: mine },
    });
    expect(
      deriveViewState(fell.state, fell.state.lastProcessedAt).army.reports[0]?.damagedOutpost,
    ).toMatchObject({ outpostId: 'outpost-2', hex: mine });
    expect(currentShape(fell.state, '')).toBeNull();
    // Reparo não exige Salão Nv5 (a Queda pode derrubar o Salão abaixo de 5).
    fell.state.settlement.buildings.townHall = 3;
    fell.state.settlement.resources.wood = 200_000;
    fell.state.settlement.resources.stone = 200_000;
    expect(accept(fell.state, repairOrder('outpost-2')).state.map.outposts[1]?.status).toBe(
      'active',
    );
  });

  it('divide qualquer intervalo atravessando uma incursão que danifica posto sem diferença em estado ou eventos', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 2 * HOUR }),
        fc.integer({ min: 0, max: DAY }),
        (afterRaid, split) => {
          let state = outpostYard();
          state.settlement.workers.lumberMill = 2;
          state = accept(state, order('-2,1')).state;
          state = accept(state, order(mine)).state;
          state = advanceTo(state, ready).state;
          const raidAt = ready + 30 * MINUTE;
          scheduleBreachingRaid(state, raidAt, 'raid-prop');
          const end = raidAt + afterRaid;
          const cut = Math.min(end, ready + (split % (end - ready + 1)));
          const full = advanceTo(state, end);
          const first = advanceTo(state, cut);
          const rest = advanceTo(first.state, end);
          expect(rest.state).toStrictEqual(full.state);
          expect([...first.events, ...rest.events]).toStrictEqual(full.events);
          // O Veio (-3,0, distância 3) foi danificado na incursão e produziu só até raidAt (30 min = 1,5 ferro).
          expect(full.state.map.outposts[1]?.status).toBe('damaged');
          expect(full.state.map.outposts[0]?.status).toBe('active');
          expect(full.state.settlement.resources.iron).toBe(1500);
        },
      ),
    );
  });
});
