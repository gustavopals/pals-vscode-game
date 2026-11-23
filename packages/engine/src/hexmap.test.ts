import {
  EXPEDITION_MODEL_IDS,
  mapScenarios,
  mapTexts,
  RELIC_IDS,
  relics,
  sanctuaryReward,
  TILE_TYPE_IDS,
} from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { generateHexMap, hexDistance, hexNeighbors, hexRing, siteDestination } from './hexmap';
import { revealExpedition, revealWatchtower } from './mapTurn';
import { currentShape, migrateState } from './migrations';
import { grantRelic } from './relics';
import { readySiege } from './siege.test-helpers';
import { cloneState, createInitialState } from './state';
import { campaignYard, heroesStart, HOUR, newGame, settings } from './test-helpers';
import type { GameEvent, ScenarioId } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';
import v42 from './__fixtures__/state-v42-fresh.json';
import v44 from './__fixtures__/state-v44-fresh.json';

describe('grade axial da Fase E', () => {
  it('seis vizinhos distintos e anéis que particionam o disco na ordem do mapa', () => {
    const center = { q: 0, r: 0 };
    const neighbors = hexNeighbors({ q: 2, r: -1 });
    expect(new Set(neighbors.map(({ q, r }) => `${q},${r}`)).size).toBe(6);
    expect(neighbors.every(({ q, r }) => hexDistance(q - 2, r + 1) === 1)).toBe(true);
    const rings = Array.from({ length: 6 }, (_, i) => hexRing(i));
    expect(rings.map((ring) => ring.length)).toEqual([1, 6, 12, 18, 24, 30]);
    expect(rings[0]).toEqual([center]);
    rings.forEach((ring, i) =>
      expect(ring.every(({ q, r }) => hexDistance(q, r) === i)).toBe(true),
    );
    expect(new Set(rings.flat().map(({ q, r }) => `${q},${r}`)).size).toBe(91);
  });

  it('cria o feudo explorado, o raio 3 avistado e o exterior desconhecido', () => {
    const { map, rng, ids } = newGame();
    expect(map.radius).toBe(5);
    const hexes = Object.values(map.hexes);
    expect(hexes).toHaveLength(91);
    expect(map.hexes['0,0']).toEqual({ terrain: 'fields', fog: 'explored' });
    for (let radius = 1; radius <= 5; radius++)
      for (const { q, r } of hexRing(radius))
        expect(map.hexes[`${q},${r}`]?.fog).toBe(radius <= 3 ? 'sighted' : 'unknown');
    expect(hexes.filter((hex) => hex.terrain === 'sanctuary')).toHaveLength(1);
    expect(map.hexes['2,-5']?.site).toBe('hordeFortress');
    const sites = hexes.flatMap((hex) => (hex.site ? [hex.site] : []));
    expect(sites).toEqual(expect.arrayContaining([...TILE_TYPE_IDS]));
    expect(sites.map(siteDestination).filter(Boolean).sort()).toEqual(
      [...EXPEDITION_MODEL_IDS].sort(),
    );
    expect(new Set(sites).size).toBe(sites.length);
    expect(rng).toEqual({});
    expect(ids).toEqual({});
    expect(newGame().map).toEqual(map);
    expect(newGame('outra semente').map.hexes).not.toEqual(map.hexes);
  });

  it.each(['pedra-alta', 'Serra do Ferro', 'pântano🌙', 'x:y', '\uD800'])(
    'criação e migração congelada produzem a mesma grade para %j',
    (seed) => {
      const fresh = newGame(seed);
      for (const before of [v42, v44]) {
        const migrated = migrateState({ ...before, seed }, { timeScale: 1 });
        expect(migrated.map).toEqual(fresh.map);
        expect(migrated.rng).toEqual(before.rng);
        expect(migrated.ids).toEqual(before.ids);
      }
      const discovered = ['swamp', 'ruins', 'sabotage', 'whiteWolfHunt'];
      const oldMap = { ...v44.map, discovered, expeditionUnlocks: { whiteWolfHunt: 1000 } };
      const state = migrateState({ ...v44, seed, map: oldMap }, { timeScale: 1 });
      expect(state.map).toEqual({ ...oldMap, ...generateHexMap(seed, discovered) });
      for (const id of discovered) {
        expect(
          Object.values(state.map.hexes).find((hex) => hex.site && siteDestination(hex.site) === id)
            ?.fog,
        ).toBe('explored');
      }
    },
  );

  it('a visão inteira independe dos terrenos e locais desconhecidos e da ordem das chaves JSONB', () => {
    const state = newGame();
    const view = deriveViewState(state, 0);
    const other = cloneState(state);
    for (const hex of Object.values(other.map.hexes)) {
      if (hex.fog === 'unknown') Object.assign(hex, { terrain: 'sanctuary', site: 'ruins' });
    }
    expect(deriveViewState(other, 0)).toEqual(view);
    for (const hex of Object.values(other.map.hexes)) {
      if (hex.fog === 'sighted') hex.site = 'raiderCamp';
    }
    other.map.hexes = Object.fromEntries(Object.entries(other.map.hexes).reverse());
    expect(deriveViewState(other, 0)).toEqual(view);
    expect(view.map.hexes.find((hex) => hex.r === -5 && hex.q === 2)).toEqual({ q: 2, r: -5 });
    expect(view.map.hexes.find((hex) => hex.r === 0 && hex.q === 1)).toEqual({
      q: 1,
      r: 0,
      fog: 'sighted',
      terrain: 'fields',
      terrainLabel: 'Campos',
    });
    expect(view.map.hexes[0]).toMatchObject({
      fog: 'explored',
      label: state.settlement.name,
      site: null,
      actions: [],
    });
  });

  it('mostra apenas as ações disponíveis nas fichas exploradas', () => {
    const state = heroesStart('cartografia', 100_000);
    state.settlement.buildings.guild = 4;
    state.map.hexes['1,0']!.fog = 'explored';
    state.map.hexes['2,-5']!.fog = 'explored';
    const first = deriveViewState(state, 0).map.hexes;
    expect(first.find((hex) => hex.q === 1 && hex.r === 0)).toMatchObject({
      site: 'patrol',
      actions: [{ type: 'sendExpedition', modelId: 'patrol' }],
    });
    expect(first.find((hex) => hex.q === 2 && hex.r === -5)).toMatchObject({
      site: null,
      actions: [],
    });
    const camp = campaignYard();
    camp.map.hexes['3,-4']!.fog = 'explored';
    expect(
      deriveViewState(camp, 0).map.hexes.find((hex) => hex.q === 3 && hex.r === -4),
    ).toMatchObject({ site: 'raiderCamp', actions: [{ type: 'attackCamp' }] });
  });

  it('a guarda exige todo o disco canônico e hexágonos de forma fechada', () => {
    const state = newGame();
    const invalid = (map: unknown) => expect(currentShape({ ...state, map }, '')).not.toBeNull();
    const hexes = { ...state.map.hexes };
    delete hexes['1,0'];
    invalid({ ...state.map, radius: 4 });
    invalid({ ...state.map, hexes });
    invalid({ ...state.map, hexes: { ...hexes, '01,0': { terrain: 'fields', fog: 'unknown' } } });
    for (const hex of [
      { terrain: 'ice', fog: 'unknown' },
      { terrain: 'fields', fog: 'lost' },
      { terrain: 'fields', fog: 'explored', site: 'castle' },
      { terrain: 'fields', fog: 'unknown', secret: 1 },
    ])
      invalid({ ...state.map, hexes: { ...hexes, '1,0': hex } });
    state.map.hexes['1,0']!.fog = 'claimed';
    expect(currentShape(state, '')).toBeNull();
    expect(
      deriveViewState(state, 0).map.hexes.find((hex) => hex.q === 1 && hex.r === 0),
    ).toMatchObject({ fog: 'claimed', site: 'patrol' });
    invalid({ ...state.map, scenario: 'unknown' });
    const withoutScenario = { ...state.map } as Record<string, unknown>;
    delete withoutScenario.scenario;
    invalid(withoutScenario);
  });
});

describe('Santuário e Serra do Ferro (V5E-T4)', () => {
  const exploreSanctuary = (
    state: ReturnType<typeof newGame>,
    tracker = false,
    atMs = 0,
  ): GameEvent[] => {
    // Deixa (0,4) como único hexágono não explorado do mapa: a próxima Patrulha o alcança.
    for (const [key, hex] of Object.entries(state.map.hexes)) {
      hex.fog = key === '0,4' ? 'sighted' : 'explored';
    }
    const events: GameEvent[] = [];
    revealExpedition(
      state,
      atMs,
      events,
      { id: 'expedition-1', modelId: 'patrol' },
      'Patrulha dos Arredores',
      tracker,
    );
    return events;
  };

  it('explorar o Santuário entrega uma relíquia via grantRelic, emite Crônica e nunca repete', () => {
    const state = newGame('santuario-1');
    const initialRng = cloneState(state).rng;
    const initialIds = cloneState(state).ids;

    // Avistar com a Torre de Vigia não entrega relíquia.
    state.settlement.buildings.watchtower = 2;
    const towerEvents: GameEvent[] = [];
    revealWatchtower(state, 0, towerEvents);
    expect(state.map.hexes['0,4']?.fog).toBe('sighted');
    expect(state.settlement.relics).toEqual([]);
    expect(towerEvents.map((event) => event.type)).toEqual(['mapRevealed']);

    // Explorar entrega a primeira relíquia da lista fixa, sem sorteio.
    const events = exploreSanctuary(state);
    expect(state.map.hexes['0,4']?.fog).toBe('explored');
    expect(state.stats.sanctuaryClaimed).toBe(1);
    const firstRelic = sanctuaryReward.from[0]!;
    expect(state.settlement.relics).toEqual([
      { defId: firstRelic, placed: false, effectiveFromMs: null },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'mapRevealed',
      'sanctuaryExplored',
      'relicFound',
    ]);
    expect(events[1]).toMatchObject({
      type: 'sanctuaryExplored',
      data: { hex: '0,4', relicId: firstRelic },
    });
    expect(events[1]?.text).toContain('Santuário');
    expect(events[1]?.text).toContain(relics[firstRelic].label);
    expect(events[2]).toMatchObject({ type: 'relicFound', data: { relicId: firstRelic } });
    expect(state.rng).toEqual(initialRng);
    expect(state.ids).toEqual(initialIds);

    // A visão do Santuário passa a informar que a relíquia já foi entregue.
    const sheet = deriveViewState(state, 0).map.hexes.find((hex) => hex.q === 0 && hex.r === 4);
    expect(sheet).toMatchObject({
      fog: 'explored',
      terrain: 'sanctuary',
      detail: mapTexts.sanctuaryClaimedDetail,
    });

    // Repetir a expedição (mesmo forçando a névoa de volta) não entrega segunda relíquia.
    const again: GameEvent[] = [];
    revealExpedition(
      state,
      0,
      again,
      { id: 'expedition-2', modelId: 'patrol' },
      'Patrulha dos Arredores',
      false,
    );
    expect(again).toEqual([]);

    state.map.hexes['0,4']!.fog = 'sighted';
    const forced = exploreSanctuary(state);
    expect(forced.map((event) => event.type)).toEqual(['mapRevealed']);
    expect(state.settlement.relics).toHaveLength(1);
  });

  it('o Santuário entrega a próxima relíquia ausente da lista fixa e também dispara pelo hexágono extra do Rastreador', () => {
    const state = newGame('santuario-rastreador');
    grantRelic(state, sanctuaryReward.from[0]!, 0, []);
    grantRelic(state, sanctuaryReward.from[1]!, 0, []);
    // Deixa dois hexágonos por explorar: (-1,4) é visitado primeiro na fronteira, (0,4) é o extra do Rastreador.
    for (const [key, hex] of Object.entries(state.map.hexes)) {
      hex.fog = key === '-1,4' || key === '0,4' ? 'sighted' : 'explored';
    }
    const events: GameEvent[] = [];
    revealExpedition(
      state,
      0,
      events,
      { id: 'expedition-1', modelId: 'patrol' },
      'Patrulha dos Arredores',
      true,
    );
    const expected = sanctuaryReward.from[2]!;
    expect(state.map.hexes['0,4']?.fog).toBe('explored');
    expect(state.settlement.relics.map((entry) => entry.defId)).toEqual([
      sanctuaryReward.from[0],
      sanctuaryReward.from[1],
      expected,
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'mapRevealed',
      'sanctuaryExplored',
      'relicFound',
    ]);
    expect(events[1]?.data).toEqual({ hex: '0,4', relicId: expected });
  });

  it('com todas as oito relíquias já no feudo, o Santuário entrega o consolo fixo de ouro uma vez', () => {
    const state = newGame('santuario-todas');
    for (const id of RELIC_IDS) grantRelic(state, id, 0, []);
    const goldBefore = state.settlement.resources.gold;
    const events = exploreSanctuary(state);
    expect(state.settlement.relics).toHaveLength(RELIC_IDS.length);
    expect(state.settlement.resources.gold).toBe(
      goldBefore + sanctuaryReward.consolationGold * MILLI,
    );
    expect(events.map((event) => event.type)).toEqual(['mapRevealed', 'sanctuaryExplored']);
    expect(events[1]?.data).toEqual({
      hex: '0,4',
      gained_gold: sanctuaryReward.consolationGold,
    });
    expect(events[1]?.text).toContain(String(sanctuaryReward.consolationGold));
    expect(events[1]?.text).toContain('ouro');
  });

  it('Serra do Ferro é determinística pela semente, altera a proporção de terrenos e preserva os hexágonos fixos', () => {
    const standard = createInitialState('serra-semente', settings);
    const ridgeA = createInitialState('serra-semente', { ...settings, scenario: 'ironRidge' });
    const ridgeB = createInitialState('serra-semente', { ...settings, scenario: 'ironRidge' });
    const ridgeOther = createInitialState('outra-semente', { ...settings, scenario: 'ironRidge' });

    expect(standard.map.scenario).toBe('standard');
    expect(ridgeA.map.scenario).toBe('ironRidge');
    expect(ridgeA.map).toEqual(ridgeB.map);
    expect(ridgeA.map.hexes).not.toEqual(standard.map.hexes);
    expect(ridgeA.map.hexes).not.toEqual(ridgeOther.map.hexes);
    expect(currentShape(ridgeA, '')).toBeNull();
    expect(ridgeA.rng).toEqual({});
    expect(ridgeA.ids).toEqual({});

    // Hexágonos fixos permanecem intactos (1 Santuário, feudo e todos os destinos).
    expect(
      Object.values(ridgeA.map.hexes).filter((hex) => hex.terrain === 'sanctuary'),
    ).toHaveLength(1);
    expect(ridgeA.map.hexes['0,0']).toEqual({ terrain: 'fields', fog: 'explored' });
    expect(ridgeA.map.hexes['2,-5']?.site).toBe('hordeFortress');

    // A visão expõe cenário e rótulo do conteúdo.
    expect(deriveViewState(standard, 0).map).toMatchObject({
      scenario: 'standard',
      scenarioLabel: mapScenarios.standard.label,
    });
    expect(deriveViewState(ridgeA, 0).map).toMatchObject({
      scenario: 'ironRidge',
      scenarioLabel: mapScenarios.ironRidge.label,
    });

    // Proporção sobre 100 sementes: Serra do Ferro gera substancialmente mais colinas e veios de ferro.
    const countTerrain = (scenario: ScenarioId) => {
      const totals: Record<string, number> = {};
      for (let i = 0; i < 100; i += 1) {
        const { hexes } = generateHexMap(`dist-${i}`, [], scenario);
        for (const hex of Object.values(hexes)) {
          totals[hex.terrain] = (totals[hex.terrain] ?? 0) + 1;
        }
      }
      return totals;
    };
    const stdCounts = countTerrain('standard');
    const ridgeCounts = countTerrain('ironRidge');
    expect(ridgeCounts.hills!).toBeGreaterThan((stdCounts.hills ?? 0) * 1.4);
    expect(ridgeCounts.ironVein!).toBeGreaterThan((stdCounts.ironVein ?? 0) * 2.5);
    expect(ridgeCounts.fields!).toBeLessThan(stdCounts.fields!);
    expect(ridgeCounts.forest!).toBeLessThan(stdCounts.forest!);

    // Cenário desconhecido é recusado na criação; migração v44 → v45 recebe `standard`.
    expect(() =>
      createInitialState('invalido', { ...settings, scenario: 'coastal' as ScenarioId }),
    ).toThrow(/Cenário desconhecido/);
    expect(migrateState(v44, { timeScale: 1 }).map.scenario).toBe('standard');
  });
});

describe('revelação da grade', () => {
  it.each([
    [1, 4],
    [2, 5],
    [5, 5],
  ])('a Torre Nv%i já concluída avista até o anel %i na migração', (watchtower, sightedRadius) => {
    const migrated = migrateState(
      {
        ...v44,
        settlement: { ...v44.settlement, buildings: { ...v44.settlement.buildings, watchtower } },
        map: { ...v44.map, discovered: ['sabotage'] },
      },
      { timeScale: 1 },
    );
    for (let radius = 1; radius <= 5; radius++) {
      for (const { q, r } of hexRing(radius)) {
        const expected =
          q === 2 && r === -5 ? 'explored' : radius <= sightedRadius ? 'sighted' : 'unknown';
        expect(migrated.map.hexes[`${q},${r}`]?.fog).toBe(expected);
      }
    }
    expect(migrated.rng).toEqual(v44.rng);
  });

  it('a Patrulha avança pela fronteira mais próxima sem depender da ordem das chaves', () => {
    const initial = newGame();
    const state = cloneState(initial);
    state.map.hexes = Object.fromEntries(Object.entries(state.map.hexes).reverse());
    const patrol = { id: 'expedition-1', modelId: 'patrol' };
    const expected = ['-1,1', '0,1', '1,0', '1,-1', '0,-1', '-1,0', '-2,2'] as const;
    for (const key of expected) {
      const events: GameEvent[] = [];
      expect(state.map.hexes[key]?.fog).toBe('sighted');
      revealExpedition(state, 0, events, patrol, 'Patrulha dos Arredores', false);
      expect(events).toMatchObject([{ type: 'mapRevealed', data: { count: 1 } }]);
      expect(state.map.hexes[key]?.fog).toBe('explored');
    }
    expect(state.rng).toEqual(initial.rng);
    expect(state.ids).toEqual(initial.ids);
  });

  it('a Patrulha com Rastreador agrupa dois hexágonos em uma linha e cala quando o mapa acaba', () => {
    const state = newGame();
    const patrol = { id: 'expedition-1', modelId: 'patrol' };
    const events: GameEvent[] = [];
    revealExpedition(state, 0, events, patrol, 'Patrulha dos Arredores', true);
    expect(events).toMatchObject([
      {
        type: 'mapRevealed',
        text: 'No 1º dia da Primavera, a expedição "Patrulha dos Arredores" trouxe novos detalhes para o mapa.',
        data: { source: 'expedition', expeditionId: 'expedition-1', modelId: 'patrol', count: 2 },
      },
    ]);
    expect(state.map.hexes['-1,1']?.fog).toBe('explored');
    expect(state.map.hexes['0,1']?.fog).toBe('explored');
    expect(state.map.hexes['1,0']?.fog).toBe('sighted');

    // Com um único hexágono restante, o Rastreador não inventa outro nem repete depois.
    for (const [key, hex] of Object.entries(state.map.hexes)) {
      if (key !== '2,-5') hex.fog = 'explored';
    }
    const last: GameEvent[] = [];
    revealExpedition(state, 0, last, patrol, 'Patrulha dos Arredores', true);
    expect(last).toMatchObject([{ type: 'mapRevealed', data: { count: 1 } }]);
    expect(state.map.hexes['2,-5']?.fog).toBe('explored');

    const none: GameEvent[] = [];
    revealExpedition(state, 0, none, patrol, 'Patrulha dos Arredores', true);
    expect(none).toEqual([]);
  });

  it('a Queda danifica a Torre e a reconstrução conserva o mapa gravado', () => {
    const state = readySiege();
    state.settlement.buildings.watchtower = 2;
    state.settlement.buildings.barracks = 0;
    state.settlement.buildings.palisade = 0;
    state.settlement.buildings.granary = 0;
    state.settlement.buildings.warehouse = 0;
    state.army = newGame().army;
    revealWatchtower(state, state.lastProcessedAt, []);
    const before = state.map.hexes;
    const fallen = advanceTo(state, state.siege!.atMs + 3 * HOUR);
    expect(fallen.state.siege?.result).toBe('fall');
    expect(fallen.state.settlement.buildings.watchtower).toBe(1);
    const saved = migrateState(JSON.parse(JSON.stringify(fallen.state)), { timeScale: 1 });
    expect(saved.map.hexes).toEqual(before);
    saved.settlement.buildings.watchtower = 2;
    const events: GameEvent[] = [];
    revealWatchtower(saved, saved.lastProcessedAt, events);
    expect(saved.map.hexes).toEqual(before);
    expect(events).toEqual([]);
  });

  it('propriedade: nenhuma sequência de revelações baixa o estado de névoa', () => {
    const fog = ['unknown', 'sighted', 'explored', 'claimed'] as const;
    const actions = fc.oneof(
      fc.integer({ min: 0, max: 5 }).map((level) => ({ kind: 'tower' as const, level })),
      fc.record({
        kind: fc.constant('expedition' as const),
        modelId: fc.constantFrom(...EXPEDITION_MODEL_IDS),
        tracker: fc.boolean(),
      }),
    );
    fc.assert(
      fc.property(fc.string(), fc.array(actions, { minLength: 1 }), (seed, sequence) => {
        const state = newGame(seed);
        const initialRng = cloneState(state).rng;
        const initialIds = cloneState(state).ids;
        state.map.hexes['0,4']!.fog = 'claimed';
        for (const action of sequence) {
          const before = Object.values(state.map.hexes).map((hex) => fog.indexOf(hex.fog));
          const events: GameEvent[] = [];
          if (action.kind === 'tower') {
            state.settlement.buildings.watchtower = action.level;
            revealWatchtower(state, 0, events);
          } else {
            const expedition = { id: 'expedition-1', modelId: action.modelId };
            revealExpedition(state, 0, events, expedition, action.modelId, action.tracker);
          }
          let changed = 0;
          for (const [index, hex] of Object.values(state.map.hexes).entries()) {
            const after = fog.indexOf(hex.fog);
            expect(after).toBeGreaterThanOrEqual(before[index]!);
            if (after > before[index]!) changed += 1;
          }
          expect(events).toHaveLength(changed > 0 ? 1 : 0);
          if (changed > 0) expect(events[0]?.data.count).toBe(changed);
          expect(state.rng).toEqual(initialRng);
          expect(state.ids).toEqual(initialIds);
        }
      }),
    );
  });
});
