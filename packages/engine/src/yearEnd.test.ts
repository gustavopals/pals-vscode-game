import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { emit } from './chronicle';
import { DAY_MS, YEAR_MS } from './clock';
import { CURRENT_SCHEMA_VERSION, migrateState } from './migrations';
import { cloneState } from './state';
import { gameAt, newGame } from './test-helpers';
import type { GameEvent } from './types';
import { endYear } from './yearEnd';
import { recordYearFeint, recordYearPopulation, recordYearRehearsal, yearStat } from './yearStats';
import { siegeYard } from './siege.test-helpers';

describe('Crônica do Ano no motor (V4G-T3.1)', () => {
  it('fecha após restoreTiles e antes da Ameaça, no instante exato e uma única vez', () => {
    const state = gameAt(YEAR_MS - 1);
    state.settlement.buildings.watchtower = 1;
    state.map.tiles.wolfDen!.threatActive = false;
    state.map.threat = 39;
    state.stats['siegeResult:1'] = 1;
    const before = cloneState(state);
    const advanced = advanceTo(state, YEAR_MS);
    const types = advanced.events.map((event) => event.type);
    expect(types.indexOf('threatTileRestored')).toBeLessThan(types.indexOf('yearEnded'));
    expect(types.indexOf('yearEnded')).toBeLessThan(types.indexOf('threatRose'));
    expect(advanced.events.filter((event) => event.type === 'yearEnded')).toMatchObject([
      { atMs: YEAR_MS, data: { year: 1, siegeResult: 'victory', feats: 'firstWinter' } },
    ]);
    expect(advanced.events.find((event) => event.type === 'yearEnded')?.text).toMatch(
      /^Encerra-se o ano 1 da Casa de Pedra Alta\./,
    );
    expect(advanceTo(advanced.state, YEAR_MS).events).toEqual([]);
    expect(state).toEqual(before);
    expect(advanced.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(migrateState(JSON.parse(JSON.stringify(advanced.state)), { timeScale: 1 })).toEqual(
      advanced.state,
    );
  });

  it('conta população máxima, batalhas reais, envios e cartas resolvidas; concede os seis Feitos', () => {
    const state = siegeYard();
    const events: GameEvent[] = [];
    recordYearPopulation(state); // 30 aldeões + 80 soldados.
    state.settlement.population.villagers = 3;
    emit(events, state, 1, 'battleFought', { outcome: 'victory' });
    emit(events, state, 2, 'battleFought', { outcome: 'held' });
    emit(events, state, 3, 'battleFought', { outcome: 'defeat' });
    emit(events, state, 4, 'battleSimulated');
    for (let i = 0; i < 3; i++)
      emit(events, state, 5 + i, 'expeditionSent', { modelId: 'sabotage' });
    emit(events, state, 8, 'expeditionSent', { modelId: 'rescue' });
    emit(events, state, 9, 'expeditionNodeResolved');
    emit(events, state, 10, 'cardDrawn');
    emit(events, state, 11, 'cardAnswered');
    emit(events, state, 12, 'cardExpired');
    emit(events, state, 13, 'warlordSlain');
    emit(events, state, 14, 'heroRescued');
    state.stats['chronicle:feint'] = 1;
    state.stats['siegeResult:1'] = 2;
    const rng = JSON.parse(JSON.stringify(state.rng));
    endYear(state, YEAR_MS, events);
    expect(events.at(-1)?.data).toEqual({
      year: 1,
      populationMax: 110,
      battles: 3,
      battlesWon: 2,
      expeditions: 4,
      cards: 2,
      siegeResult: 'glorious',
      score: 452,
      feats: 'firstWinter,intactWall,hordeKingslayer,feint,saboteur,rescue',
    });
    expect(state.rng).toEqual(rng);
    expect(state.stats.yearScore).toBe(452);
    expect(yearStat(state, 'battles')).toBe(0);
  });

  it('o ano 2 começa com contadores e Feitos limpos e não reutiliza o resultado do cerco 1', () => {
    const state = newGame();
    state.stats['siegeResult:1'] = 0;
    emit([], state, 1, 'heroRescued');
    const events: GameEvent[] = [];
    endYear(state, YEAR_MS, events);
    expect(events[0]?.data).toMatchObject({ siegeResult: 'fall', feats: 'rescue' });
    emit([], state, YEAR_MS + 1, 'battleFought', { outcome: 'defeat' });
    endYear(state, 2 * YEAR_MS, events);
    expect(events[1]?.data).toMatchObject({
      year: 2,
      battles: 1,
      battlesWon: 0,
      expeditions: 0,
      cards: 0,
      siegeResult: 'none',
      feats: '',
    });
    expect(state.stats.yearsEnded).toBe(2);
  });

  it('não cria fechamento retroativo para um ano já passado', () => {
    const state = gameAt(YEAR_MS + 1);
    expect(
      advanceTo(state, YEAR_MS + DAY_MS).events.some((event) => event.type === 'yearEnded'),
    ).toBe(false);
  });

  it('preserva estado, eventos e gerador ao dividir o avanço na virada anual', () => {
    const state = gameAt(YEAR_MS - DAY_MS);
    const direct = advanceTo(state, YEAR_MS + DAY_MS);
    const first = advanceTo(state, YEAR_MS - 1);
    const second = advanceTo(first.state, YEAR_MS);
    const third = advanceTo(second.state, YEAR_MS + DAY_MS);
    expect(third.state).toEqual(direct.state);
    expect([...first.events, ...second.events, ...third.events]).toEqual(direct.events);
  });
});

describe('A Finta: estritamente mais de 60% dos postos efetivos do ensaio', () => {
  it.each([
    [12, false],
    [13, true],
  ])('trocar %i de 20 combatentes: %s', (changed, earned) => {
    const state = newGame();
    const posts = {
      left: { front: null, back: null },
      center: { front: { unit: 'spearman' as const, count: 20 }, back: null },
      right: { front: null, back: null },
    };
    recordYearRehearsal(state, posts);
    recordYearFeint(state, {
      ...posts,
      center: { front: { unit: 'spearman', count: 20 - changed }, back: null },
    });
    expect(yearStat(state, 'feint') === 1).toBe(earned);
  });

  it('sem ensaio ou sem tropa no cerco não concede A Finta', () => {
    const state = newGame();
    const posts = siegeYard().army.formations[0]!.posts;
    recordYearFeint(state, posts);
    expect(yearStat(state, 'feint')).toBe(0);
    recordYearRehearsal(state, posts);
    recordYearFeint(state, {
      left: { front: null, back: null },
      center: { front: null, back: null },
      right: { front: null, back: null },
    });
    expect(yearStat(state, 'feint')).toBe(0);
  });
});
