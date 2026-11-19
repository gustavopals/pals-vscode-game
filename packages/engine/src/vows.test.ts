import { balance, VOW_IDS, YearEndedDataSchema } from '@lotg/content';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { emit } from './chronicle';
import { productionRate, consumptionRate } from './economy';
import { harmOf } from './outcomes';
import { currentShape, migrateState } from './migrations';
import { settleHordeTiles } from './hordePlan';
import { createInitialState, cloneState } from './state';
import { readySiege } from './siege.test-helpers';
import {
  accept,
  addHero,
  command,
  gameAt,
  newGame,
  refuse,
  settings,
  AUTUMN,
  HOUR,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';
import { heroCaptureRule, hordeCunning, legacyPoints, vowIsActive } from './vows';
import { wallForBattle } from './wallRepair';
import { palisadeLevel } from './threat';
import { endYear } from './yearEnd';

function choose(state: GameState, vows: readonly string[]) {
  return accept(state, command('takeVows', { vows: [...vows] })).state;
}

function productive() {
  const state = gameAt(0);
  state.settlement.workers.farm = 2;
  state.settlement.workers.lumberMill = 1;
  return state;
}

function fallenSiege(pace: number) {
  const state = readySiege('lord', pace);
  state.settlement.buildings.watchtower = 0;
  state.settlement.wall.hp = { left: 0, center: 0, right: 0 };
  for (const unit of Object.keys(state.army.units) as (keyof typeof state.army.units)[])
    state.army.units[unit] = 0;
  return advanceTo(state, state.siege!.atMs).state;
}

describe('Votos — efeitos limitados ao desafio escolhido', () => {
  it('Sem muralhas desativa a proteção da Paliçada e da batalha, preservando edifício, vida e torres', () => {
    const state = productive();
    state.settlement.buildings.townHall = 8;
    state.settlement.buildings.palisade = 2;
    state.settlement.wall.hp = { left: 100, center: 100, right: 100 };
    const normal = choose(state, []);
    const voted = choose(state, ['noWalls']);
    expect(palisadeLevel(normal)).toBe(2);
    expect(palisadeLevel(voted)).toBe(0);
    expect(wallForBattle(voted)).toEqual({});
    expect(voted.settlement.buildings).toEqual(normal.settlement.buildings);
    expect(voted.settlement.wall.hp).toEqual(normal.settlement.wall.hp);
    expect(productionRate(voted, 'farm')).toBe(productionRate(normal, 'farm'));
    expect(heroCaptureRule(voted)).toBe('capture');
    expect(hordeCunning(voted)).toEqual({ num: 1, den: 2 });
    expect(deriveViewState(voted, 0).threat.defense.text).toContain('Voto Sem muralhas');
    // A incursão roteirizada é repelida pelo nível sem Voto, mas exige batalha com ele.
    normal.horde.scheduledRaids = newGame().horde.scheduledRaids;
    voted.horde.scheduledRaids = newGame().horde.scheduledRaids;
    const arrives = normal.horde.scheduledRaids[0]!.atMs;
    const safe = advanceTo(normal, arrives);
    const exposed = advanceTo(voted, arrives);
    expect(safe.events.some((event) => event.type === 'battleFought')).toBe(false);
    expect(exposed.events.some((event) => event.type === 'battleFought')).toBe(true);
  });

  it('Horda astuta usa 4/5 sem aumentar o tamanho das ondas nem mudar a dificuldade', () => {
    for (let seed = 0; seed < 12; seed += 1) {
      const voted = choose(gameAt(0), ['cunningHorde']);
      const iron = gameAt(0);
      iron.settings.difficulty = 'ironKing';
      for (const state of [voted, iron]) {
        state.seed = `vow-cunning-${seed}`;
        state.lastProcessedAt = AUTUMN;
        state.clock.gameTimeMs = AUTUMN;
        state.horde.lastFormationSeen = { total: 20, byUnit: { archer: 20 } };
        settleHordeTiles(state, AUTUMN, []);
      }
      const units = (state: GameState) =>
        state.horde.wavePlan!.waves.map((wave) => wave.composition.map((post) => post.unit));
      expect(units(voted)).toEqual(units(iron));
      expect(
        voted.horde.wavePlan!.waves.map((wave) =>
          wave.composition.reduce((sum, post) => sum + post.count, 0),
        ),
      ).toEqual([13, 20, 27]);
      expect(voted.settings.difficulty).toBe('lord');
      expect(heroCaptureRule(voted)).toBe('capture');
      expect(vowIsActive(voted, 'noWalls')).toBe(false);
    }
  });

  it('Comida escassa corta apenas a produção de comida e aparece na explicação', () => {
    const normal = choose(productive(), []);
    const voted = choose(productive(), ['scarceFood']);
    expect(productionRate(voted, 'farm')).toBe(
      Math.floor((productionRate(normal, 'farm') * 4) / 5),
    );
    expect(productionRate(voted, 'lumberMill')).toBe(productionRate(normal, 'lumberMill'));
    expect(consumptionRate(voted)).toBe(consumptionRate(normal));
    expect(heroCaptureRule(voted)).toBe('capture');
    expect(
      deriveViewState(voted, 0).resources.find((row) => row.id === 'food')!.breakdown,
    ).toContain('Comida escassa');
  });

  it.each(['peasant', 'lord'] as const)(
    'Heróis mortais permite morte em %s só nas situações mortais de Rei de Ferro',
    (difficulty) => {
      const state = gameAt(0);
      state.settings.difficulty = difficulty;
      expect(harmOf(state, 'disaster', 'capture')!.kind).toBe(
        difficulty === 'peasant' ? 'severe' : 'captured',
      );
      const voted = choose(state, ['mortalHeroes']);
      expect(heroCaptureRule(voted)).toBe('death');
      expect(harmOf(voted, 'disaster', 'capture')).toEqual({ kind: 'died', spared: false });
      expect(harmOf(voted, 'disaster', 'injury')!.kind).toBe('severe');
      expect(harmOf(voted, 'setback', 'capture')!.kind).toBe('light');
      expect(hordeCunning(voted)).toEqual(balance.difficulties[difficulty].cunning);
      expect(productionRate(voted, 'farm')).toBe(productionRate(state, 'farm'));
    },
  );

  it('só o Voto torna mortal uma derrota real do comandante em Senhor', () => {
    const start = productive();
    start.settlement.buildings.barracks = 1;
    start.army.units.spearman = 1;
    start.army.units.archer = 2;
    const hero = addHero(start);
    const empty = { front: null, back: null };
    start.ids.formation = 1;
    start.army.formations = [
      {
        id: 'formation-1',
        name: 'Última guarda',
        posts: {
          left: empty,
          center: { front: { unit: 'spearman', count: 1 }, back: { unit: 'archer', count: 2 } },
          right: empty,
        },
        commanders: { left: null, center: hero.id, right: null },
      },
    ];
    start.army.activeFormationId = 'formation-1';
    start.horde.scheduledRaids = [
      {
        id: 'mortal-test',
        atMs: 1,
        kind: 'threat',
        enemy: 'raiders',
        size: 'strong',
        announcedAtMs: null,
        composition: [{ wing: 'center', line: 'front', unit: 'blackKnight', count: 30 }],
      },
    ];
    const normal = advanceTo(choose(start, []), 1);
    const mortal = advanceTo(choose(start, ['mortalHeroes']), 1);
    expect(normal.state.guild.heroes.find((entry) => entry.id === hero.id)?.status).toBe('injured');
    expect(normal.events.some((event) => event.type === 'commanderDied')).toBe(false);
    expect(mortal.state.guild.heroes.some((entry) => entry.id === hero.id)).toBe(false);
    expect(mortal.events.some((event) => event.type === 'commanderDied')).toBe(true);
  });

  it('Legado multiplica pontuação com Feitos uma só vez; os bônus somam e há piso inteiro', () => {
    const base = newGame();
    base.stats['siegeResult:1'] = 2;
    emit([], base, 1, 'warlordSlain');
    const normalEvents: GameEvent[] = [];
    endYear(cloneState(base), YEAR, normalEvents);
    expect(normalEvents[0]!.data).toMatchObject({
      score: 230,
      feats: 'firstWinter,intactWall,hordeKingslayer',
    });
    expect(normalEvents[0]!.data).not.toHaveProperty('vows');
    expect(normalEvents[0]!.data).not.toHaveProperty('legacy');
    for (const [id, expected] of [
      ['noWalls', 322],
      ['cunningHorde', 287],
      ['scarceFood', 276],
      ['mortalHeroes', 310],
    ] as const) {
      const state = choose(base, [id]);
      const events: GameEvent[] = [];
      endYear(state, YEAR, events);
      expect(events[0]!.data).toMatchObject({ score: 230, vows: id, legacy: expected });
      expect(YearEndedDataSchema.parse(events[0]!.data).legacy).toBe(expected);
    }
    expect(legacyPoints(230, VOW_IDS)).toBe(506);
    const voted = choose(base, [...VOW_IDS].reverse());
    const events: GameEvent[] = [];
    endYear(voted, YEAR, events);
    expect(events[0]!.data).toMatchObject({ score: 230, vows: VOW_IDS.join(','), legacy: 506 });
  });
});

describe('Votos — criação, rescaldo e prazo real', () => {
  it.each([0.5, 1, 3])(
    'oferece na criação e fecha 24 h reais depois da virada no ritmo %s',
    (pace) => {
      const fresh = createInitialState('vow-window', { ...settings, timeScale: pace });
      expect(fresh.vows.closesAtMs).toBe(24 * HOUR * pace);
      expect(deriveViewState(fresh, 0).vows.closesInSeconds).toBe(86400);
      const ended = fallenSiege(pace);
      expect(ended.siege!.result).toBe('fall');
      expect(ended.vows.closesAtMs).toBe(YEAR + 24 * HOUR * pace);
      expect(deriveViewState(ended, ended.lastProcessedAt).vows.offer).toHaveLength(4);
      const next = advanceTo(ended, YEAR).state;
      expect(next.vows.closesAtMs).toBe(YEAR + 24 * HOUR * pace);
      expect(deriveViewState(next, YEAR).vows.closesInSeconds).toBe(86400);
      expect(currentShape(next, '')).toBeNull();
    },
  );

  it('o fim da janela é um instante próprio, fechado inclusive na fronteira exata', () => {
    const pace = 0.7;
    const deadline = 24 * HOUR * pace;
    const state = gameAt(deadline - 1);
    state.settings.timeScale = pace;
    state.vows.closesAtMs = deadline;
    expect(nextEventAt(state)).toBe(deadline);
    expect(deriveViewState(state, state.lastProcessedAt).vows.closesInSeconds).toBe(1);
    const closed = advanceTo(state, deadline).state;
    expect(deriveViewState(closed, deadline).vows).toEqual({
      offer: [],
      taken: [],
      closesInSeconds: 0,
    });
    expect(refuse(closed, command('takeVows', { vows: [] })).code).toBe('VOWS_CLOSED');
    expect(nextEventAt(closed)).toBeGreaterThan(deadline);
  });

  it('é uma escolha por ano, inclusive a recusa explícita; ids inválidos não consomem a escolha', () => {
    const state = gameAt(0);
    for (const vows of [['missing'], ['noWalls', 'noWalls']])
      expect(refuse(state, command('takeVows', { vows })).code).toBe('VOW_UNAVAILABLE');
    const selected = choose(state, []);
    expect(refuse(selected, command('takeVows', { vows: ['noWalls'] })).code).toBe('VOWS_CLOSED');
    const iron = gameAt(0);
    iron.settings.difficulty = 'ironKing';
    expect(deriveViewState(iron, 0).vows.offer.map((entry) => entry.id)).toEqual([
      'noWalls',
      'scarceFood',
    ]);
    for (const id of ['cunningHorde', 'mortalHeroes'])
      expect(refuse(iron, command('takeVows', { vows: [id] })).code).toBe('VOW_UNAVAILABLE');
  });

  it('a escolha do próximo ano não muda os efeitos nem o Legado do ano que termina', () => {
    const ended = fallenSiege(3);
    ended.vows.taken = ['scarceFood'];
    const selected = choose(ended, ['mortalHeroes']);
    expect(vowIsActive(selected, 'scarceFood')).toBe(true);
    expect(vowIsActive(selected, 'mortalHeroes')).toBe(false);
    const before = JSON.stringify(selected);
    const whole = advanceTo(selected, YEAR + 1);
    const first = advanceTo(selected, YEAR - 1);
    const second = advanceTo(first.state, YEAR);
    const third = advanceTo(second.state, YEAR + 1);
    expect(third.state).toEqual(whole.state);
    expect([...first.events, ...second.events, ...third.events]).toEqual(whole.events);
    const types = whole.events.map((event) => event.type);
    expect(types.indexOf('yearEnded')).toBeLessThan(types.indexOf('yearStarted'));
    expect(whole.events.find((event) => event.type === 'yearEnded')!.data.vows).toBe('scarceFood');
    expect(whole.state.vows.taken).toEqual(['mortalHeroes']);
    expect(heroCaptureRule(whole.state)).toBe('death');
    expect(vowIsActive(whole.state, 'scarceFood')).toBe(false);
    expect(refuse(whole.state, command('takeVows', { vows: [] })).code).toBe('VOWS_CLOSED');
    expect(currentShape(whole.state, '')).toBeNull();
    expect(migrateState(JSON.parse(JSON.stringify(whole.state)), { timeScale: 3 })).toEqual(
      whole.state,
    );
    expect(JSON.stringify(selected)).toBe(before);
  });

  it('ordem e visão preservam sorteios e ids, sem criar decisão de protocolo', () => {
    const state = gameAt(0);
    const before = JSON.stringify(state);
    const result = accept(state, command('takeVows', { vows: ['scarceFood'] }));
    expect(result.state.rng).toEqual(state.rng);
    expect(result.state.ids).toEqual(state.ids);
    expect(result.events.find((event) => event.type === 'vowsTaken')?.data).toEqual({
      year: 1,
      vows: 'scarceFood',
    });
    const view = deriveViewState(result.state, 0);
    expect(view.vows.taken.map((entry) => entry.id)).toEqual(['scarceFood']);
    expect(view.pendingDecisions).toEqual([]);
    expect(JSON.stringify(state)).toBe(before);
  });
});
