import { objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { trainingLotKey } from './army';
import { currentShape, migrateState } from './migrations';
import { evaluateObjectives, hasUnsettledObjectives, objectiveProgress } from './objectives';
import { cloneState } from './state';
import {
  accept,
  addHero,
  AUTUMN,
  barracksYard,
  command,
  DAY,
  eventsOfType,
  gameAt,
  newGame,
  saveFormationOrder,
  tavernSite,
} from './test-helpers';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

const ids = objectives.map((entry) => entry.id);
const old = ids.slice(0, 16);
const added = ids.slice(16);
const afterV03 = (draft: GameState) => {
  draft.objectives = { completed: [...old], active: [] };
};
const completedIn = (events: GameEvent[]) =>
  eventsOfType(events, 'objectiveCompleted').map((event) => event.data.objective);

describe('objetivos da v0.4 (V4H-T3)', () => {
  it('conclui os cinco pelo caminho do jogo: Salão, treino, formação, prévia e incursão', () => {
    const events: GameEvent[] = [];
    const take = (step: { state: GameState; events: GameEvent[] }) => {
      events.push(...step.events);
      return step.state;
    };
    let state = tavernSite(0, afterV03);
    state = take(accept(state, command('startConstruction', { building: 'townHall' })));
    state = take(advanceTo(state, state.settlement.constructionQueues[0]!.finishesAtMs));
    expect(completedIn(events)).toEqual(['townHallLevel4']);
    expect(
      deriveViewState(state, state.lastProcessedAt)
        .constructions.available.filter((entry) => ['barracks', 'smithy'].includes(entry.building))
        .every((entry) => entry.blockedCode === null),
    ).toBe(true);
    state = take(accept(state, command('startConstruction', { building: 'barracks' })));
    state = take(advanceTo(state, state.settlement.constructionQueues[0]!.finishesAtMs));
    // O cenário põe aldeões suficientes antes de reservar dez para o treino.
    state = cloneState(state);
    state.settlement.buildings.housing = 6;
    state.settlement.population.villagers = 20;
    const weapons = state.settlement.weapons;
    state = take(accept(state, command('trainSoldiers', { unit: 'spearman', amount: 10 })));
    expect(completedIn(events)).not.toContain('trainTenSoldiers');
    state = take(advanceTo(state, state.army.training!.endsAtMs));
    expect(state.settlement.weapons).toBe(weapons + 1);
    state = take(accept(state, saveFormationOrder()));
    expect(state.stats.objectiveOmenPending).toBe(1);
    expect(state.horde.omens).toEqual([]);
    const rng = cloneState(state).rng;
    const gold = state.settlement.resources.gold;
    state = take(accept(state, command('simulateBattle', { formationId: 'formation-1' })));
    expect(state.settlement.resources.gold - gold).toBe(20 * MILLI);
    expect(state.rng).toEqual(rng);
    state = take(accept(state, command('setActiveFormation', { id: 'formation-1' })));
    // Muralha pronta para os lobos do roteiro; a batalha é a incursão real do dia 16.
    state = cloneState(state);
    state.settlement.buildings.palisade = 2;
    state.settlement.wall.hp = { left: 100, center: 100, right: 100 };
    state.horde.scheduledRaids = newGame().horde.scheduledRaids;
    state = take(advanceTo(state, 15 * DAY));
    expect(eventsOfType(events, 'raidRepelled').length).toBeGreaterThan(0);
    expect(completedIn(events)).toEqual(added);
    expect(state.objectives).toEqual({ completed: ids, active: [] });
  });

  it('acomoda uma partida do estado 34 na fronteira, paga uma vez e mantém a forma', () => {
    const before = barracksYard(0, (draft) => {
      afterV03(draft);
      draft.army.units.spearman = 10;
      draft.ids.formation = 1; // A formação antiga foi apagada; o contador não volta atrás.
      draft.stats.battlesSimulated = 1;
      draft.stats.raids_repelled = 1;
    });
    const migrated = migrateState(JSON.parse(JSON.stringify(before)) as unknown, { timeScale: 1 });
    expect(hasUnsettledObjectives(migrated)).toBe(true);
    const result = advanceTo(migrated, migrated.lastProcessedAt + 1);
    expect(result.events.every((event) => event.atMs === migrated.lastProcessedAt)).toBe(true);
    expect(completedIn(result.events)).toEqual(added);
    expect(result.state.schemaVersion).toBe(34);
    expect(currentShape(result.state, '')).toBeNull();
    expect(result.state.settlement.weapons - before.settlement.weapons).toBe(1);
    expect(result.state.settlement.resources.gold - before.settlement.resources.gold).toBe(
      20 * MILLI,
    );
    expect(result.state.rng).toEqual(before.rng);
    const again = advanceTo(result.state, result.state.lastProcessedAt);
    expect(again).toEqual({ state: result.state, events: [] });
    expect(hasUnsettledObjectives(again.state)).toBe(false);
  });

  it('não conta ordens canceladas nem perde o treino concluído quando soldados são dispensados', () => {
    const start = barracksYard(0, afterV03);
    const ordered = accept(start, command('trainSoldiers', { unit: 'spearman', amount: 6 })).state;
    const cancelled = accept(
      ordered,
      command('cancelTraining', { lotKey: trainingLotKey(ordered.army.training!) }),
    ).state;
    expect(objectiveProgress(cancelled, { type: 'soldiersTrained', count: 10 }).current).toBe(0);
    const sent = accept(cancelled, command('trainSoldiers', { unit: 'spearman', amount: 6 })).state;
    const trained = advanceTo(sent, sent.army.training!.endsAtMs).state;
    const disbanded = accept(
      trained,
      command('disbandSoldiers', { unit: 'spearman', amount: 6 }),
    ).state;
    expect(objectiveProgress(disbanded, { type: 'soldiersTrained', count: 10 }).current).toBe(6);
    const next = accept(disbanded, command('trainSoldiers', { unit: 'spearman', amount: 4 })).state;
    const finished = advanceTo(next, next.army.training!.endsAtMs);
    expect(completedIn(finished.events)).toContain('trainTenSoldiers');
  });

  it('treino incompleto pelo piso conta só quem se tornou soldado', () => {
    const start = barracksYard(0, afterV03);
    const ordered = accept(start, command('trainSoldiers', { unit: 'spearman', amount: 10 })).state;
    ordered.settlement.population.villagers = 8;
    const result = advanceTo(ordered, ordered.army.training!.endsAtMs);
    expect(result.state.stats.soldiersTrained).toBe(5);
    expect(completedIn(result.events)).not.toContain('trainTenSoldiers');
  });

  it('o presságio gratuito espera a preparação real, persiste e não altera sorteios ou ondas', () => {
    const start = gameAt(AUTUMN - 1);
    start.stats.objectiveOmenPending = 1;
    start.objectives = { completed: ids, active: [] };
    const restored = migrateState(JSON.parse(JSON.stringify(start)) as unknown, { timeScale: 1 });
    const control = cloneState(restored);
    delete control.stats.objectiveOmenPending;
    const result = advanceTo(restored, AUTUMN);
    const withoutReward = advanceTo(control, AUTUMN);
    expect(result.state.rng).toEqual(withoutReward.state.rng);
    expect(result.state.horde.wavePlan).toEqual(withoutReward.state.horde.wavePlan);
    expect(result.state.horde.omens).toHaveLength(1);
    expect(result.state.horde.omens[0]).toMatchObject({ clarity: 'vague', wave: 1 });
    expect(result.state.stats.objectiveOmenPending).toBeUndefined();
    expect(eventsOfType(result.events, 'omenSeen')).toHaveLength(1);
    expect(advanceTo(result.state, AUTUMN).events).toEqual([]);
    expect(currentShape(result.state, '')).toBeNull();
  });

  it('entrega de imediato um presságio da preparação existente com a clareza da Torre', () => {
    const start = advanceTo(gameAt(AUTUMN - 1), AUTUMN).state;
    afterV03(start);
    start.ids.formation = 1;
    start.settlement.buildings.watchtower = 5;
    const rng = cloneState(start).rng;
    const events: GameEvent[] = [];
    evaluateObjectives(start, AUTUMN, events);
    expect(start.horde.omens.at(-1)?.clarity).toBe('exact');
    expect(start.horde.omens.at(-1)?.reveals).toEqual(start.horde.wavePlan?.waves[0]?.composition);
    expect(start.rng).toEqual(rng);
  });

  it('a incursão real premia os comandantes que lutaram, sem dar XP a quem ficou fora', () => {
    let before = barracksYard(15 * DAY - 1, (draft) => {
      afterV03(draft);
      addHero(draft, { level: 4 });
      addHero(draft, { level: 4 });
      draft.army.units.spearman = 10;
      draft.settlement.buildings.palisade = 6;
      draft.settlement.wall.hp = { left: 800, center: 800, right: 800 };
      draft.horde.scheduledRaids = newGame().horde.scheduledRaids;
    });
    before = accept(
      before,
      saveFormationOrder('Comando', {
        commanders: { left: null, center: 'hero-1', right: null },
      }),
    ).state;
    before = accept(before, command('setActiveFormation', { id: 'formation-1' })).state;
    const control = cloneState(before);
    control.objectives = { completed: ids, active: [] };
    const result = advanceTo(before, 15 * DAY);
    const ordinary = advanceTo(control, 15 * DAY);
    expect(completedIn(result.events)).toContain('repelFirstRaid');
    expect(result.state.guild.heroes[0]!.xp - ordinary.state.guild.heroes[0]!.xp).toBe(20);
    expect(result.state.guild.heroes[1]!.xp).toBe(ordinary.state.guild.heroes[1]!.xp);
    expect(result.state.rng).toEqual(ordinary.state.rng);

    // A ação pode ter acontecido antes de revelar o objetivo. Trocar o comandante da
    // formação desde então não muda quem participou da incursão guardada no relatório.
    const delayed = cloneState(ordinary.state);
    afterV03(delayed);
    delayed.army.formations[0]!.commanders.center = 'hero-2';
    const paidLater = accept(delayed, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(paidLater.events)).toContain('repelFirstRaid');
    expect(paidLater.state.guild.heroes[0]!.xp - ordinary.state.guild.heroes[0]!.xp).toBe(20);
    expect(paidLater.state.guild.heroes[1]!.xp).toBe(ordinary.state.guild.heroes[1]!.xp);
  });

  it('entregar o presságio mantém a divisão exata do intervalo com persistência entre os cortes', () => {
    for (const timeScale of [0.5, 1, 3]) {
      for (const difficulty of ['peasant', 'lord', 'ironKing'] as const) {
        const start = gameAt(AUTUMN - 1);
        start.settings.timeScale = timeScale;
        start.settings.difficulty = difficulty;
        start.settlement.buildings.watchtower = 3;
        start.stats.objectiveOmenPending = 1;
        const whole = advanceTo(start, AUTUMN + DAY);
        const first = advanceTo(start, AUTUMN);
        const persisted = migrateState(JSON.parse(JSON.stringify(first.state)) as unknown, {
          timeScale,
        });
        const second = advanceTo(persisted, AUTUMN + DAY);
        expect(second.state).toEqual(whole.state);
        expect([...first.events, ...second.events]).toEqual(whole.events);
      }
    }
  });

  it('a visão aponta o Exército e mostra os bloqueios de treino e prévia', () => {
    const state = gameAt(0);
    afterV03(state);
    evaluateObjectives(state, 0, []);
    const rows = deriveViewState(state, 0).objectives;
    expect(rows.find((entry) => entry.id === 'townHallLevel4')?.target).toEqual({
      kind: 'building',
      building: 'townHall',
    });
    expect(rows.find((entry) => entry.id === 'trainTenSoldiers')).toMatchObject({
      target: { kind: 'army' },
      progress: { current: 0, target: 10 },
      reward: '1 arma',
    });
    expect(rows.find((entry) => entry.id === 'trainTenSoldiers')?.missing).toMatch(/Quartel/);
    state.objectives = { completed: ids.slice(0, 19), active: ids.slice(19) };
    expect(
      deriveViewState(state, 0).objectives.find((entry) => entry.id === 'simulateFirstBattle')
        ?.missing,
    ).toMatch(/Salve uma formação/);
  });
});
