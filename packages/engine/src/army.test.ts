import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { netRates } from './economy';
import { inhabitants } from './masters';
import { accept, apply, barracksYard, command, DAY, HOUR, MINUTE } from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState } from './types';
import { deriveViewState } from './view';

const MILLI = 1000;

const refused = (state: GameState, ...args: Parameters<typeof command>) => {
  const result = apply(state, command(...args));
  if (result.ok) {
    throw new Error('A ordem devia ser recusada.');
  }
  return result;
};

describe('Quartel e treino (V4C-T1; ADR 0019, decisão 7)', () => {
  it('cobra os recursos e as armas ao começar, fixa o fim e emite trainingStarted', () => {
    const start = barracksYard(0);
    const { state, events } = accept(
      start,
      command('trainSoldiers', { unit: 'swordsman', amount: 3 }),
    );
    expect(state.settlement.resources.food).toBe(start.settlement.resources.food - 120 * MILLI);
    expect(state.settlement.resources.gold).toBe(start.settlement.resources.gold - 60 * MILLI);
    expect(state.settlement.resources.iron).toBe(start.settlement.resources.iron);
    expect(state.settlement.weapons).toBe(3);
    // 3 espadachins × 12 min, no nível 1.
    expect(state.army.training).toEqual({
      unit: 'swordsman',
      amount: 3,
      startedAtMs: 0,
      endsAtMs: 36 * MINUTE,
    });
    expect(events.map((event) => event.type)).toEqual(['trainingStarted']);
    expect(events[0]?.text).toContain('3 espadachins');
    expect(nextEventAt(state)).toBe(36 * MINUTE);
    // A ordem não altera o estado de entrada.
    expect(start.army.training).toBeNull();
    expect(start.settlement.weapons).toBe(6);
  });

  it('o fim do treino é um instante da linha do tempo: um milissegundo antes não há soldado, no instante há', () => {
    const { state } = accept(
      barracksYard(0),
      command('trainSoldiers', { unit: 'spearman', amount: 2 }),
    );
    const end = 20 * MINUTE;
    const before = advanceTo(state, end - 1);
    expect(before.state.army.units.spearman).toBe(0);
    expect(before.state.army.training).not.toBeNull();
    const at = advanceTo(before.state, end);
    expect(at.state.army.units.spearman).toBe(2);
    expect(at.state.army.training).toBeNull();
    const done = at.events.filter((event) => event.type === 'soldiersTrained');
    expect(done).toHaveLength(1);
    expect(done[0]?.atMs).toBe(end);
    expect(done[0]?.text).toContain('2 lanceiros');
    // O soldado sai da população, mas continua morando (e comendo) nas casas.
    expect(at.state.settlement.population.villagers).toBe(18);
    expect(inhabitants(at.state)).toBe(inhabitants(before.state));
  });

  it('cada nível encurta o tempo: o lote leva tempo × 20 / (20 + nível − 1)', () => {
    const ends = [1, 2, 3, 8].map(
      (level) =>
        accept(
          barracksYard(0, () => {}, { level }),
          command('trainSoldiers', { unit: 'archer', amount: 7 }),
        ).state.army.training?.endsAtMs,
    );
    expect(ends).toEqual([
      7 * 10 * MINUTE,
      Math.floor((7 * 600_000 * 20) / 21),
      Math.floor((7 * 600_000 * 20) / 22),
      Math.floor((7 * 600_000 * 20) / 27),
    ]);
  });

  it('o soldado sai de um aldeão sem ofício; com todos ocupados, do edifício com mais gente', () => {
    const idle = accept(
      barracksYard(0),
      command('trainSoldiers', { unit: 'spearman', amount: 1 }),
    ).state;
    expect(advanceTo(idle, 10 * MINUTE).state.settlement.workers).toEqual(idle.settlement.workers);
    const busy = barracksYard(0, (draft) => {
      draft.settlement.population.villagers = 8;
      draft.settlement.workers = { farm: 5, lumberMill: 2, quarry: 1, goldMine: 0 };
    });
    const ordered = accept(busy, command('trainSoldiers', { unit: 'spearman', amount: 2 })).state;
    const trained = advanceTo(ordered, 20 * MINUTE).state;
    expect(trained.settlement.population.villagers).toBe(6);
    expect(trained.settlement.workers).toEqual({ farm: 3, lumberMill: 2, quarry: 1, goldMine: 0 });
  });

  it('o piso de 3 aldeões protege: a ordem que o quebraria é recusada, e o lote que o piso encolhe termina com os que couberam', () => {
    const start = barracksYard(0, (draft) => {
      draft.settlement.population.villagers = 5;
    });
    expect(refused(start, 'trainSoldiers', { unit: 'spearman', amount: 3 }).code).toBe(
      'NOT_ENOUGH_VILLAGERS',
    );
    const ordered = accept(start, command('trainSoldiers', { unit: 'spearman', amount: 2 })).state;
    // Dois aldeões a menos no meio do treino (a população cai a 3): ninguém mais vira soldado.
    const thinned = JSON.parse(JSON.stringify(ordered)) as GameState;
    thinned.settlement.population.villagers = 3;
    const result = advanceTo(thinned, 20 * MINUTE);
    const done = result.state;
    expect(done.army.units.spearman).toBe(0);
    expect(done.settlement.population.villagers).toBe(3);
    // Nenhum treinado: a Crônica diz que o lote ficou por treinar, no instante exato.
    expect(result.events.filter((event) => event.type === 'soldiersTrained')).toEqual([]);
    const short = result.events.filter((event) => event.type === 'trainingShortfall');
    expect(short).toHaveLength(1);
    expect(short[0]?.atMs).toBe(20 * MINUTE);
    expect(short[0]?.text).toContain('2 lanceiros');
    expect(short[0]?.text).toContain('o custo não volta');
  });

  it('o lote que o piso encolhe em parte emite soldiersTrained e trainingShortfall', () => {
    const start = barracksYard(0, (draft) => {
      draft.settlement.population.villagers = 6;
    });
    const ordered = accept(start, command('trainSoldiers', { unit: 'spearman', amount: 3 })).state;
    const thinned = JSON.parse(JSON.stringify(ordered)) as GameState;
    thinned.settlement.population.villagers = 4;
    const result = advanceTo(thinned, 30 * MINUTE);
    expect(result.state.army.units.spearman).toBe(1);
    expect(result.events.filter((event) => event.type === 'soldiersTrained')).toHaveLength(1);
    const short = result.events.filter((event) => event.type === 'trainingShortfall');
    expect(short).toHaveLength(1);
    expect(short[0]?.text).toContain('2 lanceiros');
  });

  it('o soldado come 1,5 por hora de jogo, contra 1 do aldeão', () => {
    const without = barracksYard(0);
    const withSoldiers = barracksYard(0, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.army.units.spearman = 6;
      draft.army.units.knight = 4;
    });
    // 20 aldeões comiam 20/h; 10 aldeões e 10 soldados comem 10 + 15.
    expect(netRates(without).food).toBe(-20 * MILLI);
    expect(netRates(withSoldiers).food).toBe(-25 * MILLI);
    const view = deriveViewState(withSoldiers, 1);
    expect(view.population.soldiers).toBe(10);
    expect(view.population.villagers).toBe(10);
    expect(view.army.foodText).toBe('15/h (10 soldados)');
  });

  it('cancelar devolve 80% do custo e as armas inteiras que couberem', () => {
    const start = barracksYard(0);
    const ordered = accept(start, command('trainSoldiers', { unit: 'knight', amount: 5 })).state;
    expect(ordered.settlement.weapons).toBe(1);
    const { state, events } = accept(ordered, command('cancelTraining', {}));
    expect(state.army.training).toBeNull();
    // 80% de 5 cavaleiros: 240 de comida, 240 de ouro e 4 armas.
    expect(state.settlement.resources.food).toBe(
      start.settlement.resources.food - 300 * MILLI + 240 * MILLI,
    );
    expect(state.settlement.resources.gold).toBe(
      start.settlement.resources.gold - 300 * MILLI + 240 * MILLI,
    );
    expect(state.settlement.weapons).toBe(1 + 4);
    expect(events.map((event) => event.type)).toEqual(['trainingCancelled']);
    // O lote cancelado não deixa instante marcado na linha do tempo.
    expect(nextEventAt(state)).not.toBe(20 * MINUTE + 0);
  });

  it('dispensar devolve aldeões sem ofício e não devolve o custo', () => {
    const start = barracksYard(0);
    const trained = advanceTo(
      accept(start, command('trainSoldiers', { unit: 'swordsman', amount: 4 })).state,
      48 * MINUTE,
    ).state;
    expect(trained.army.units.swordsman).toBe(4);
    const { state, events } = accept(
      trained,
      command('disbandSoldiers', { unit: 'swordsman', amount: 4 }),
    );
    expect(state.army.units.swordsman).toBe(0);
    expect(state.settlement.population.villagers).toBe(20);
    expect(state.settlement.weapons).toBe(2);
    expect(state.settlement.resources.gold).toBeLessThan(start.settlement.resources.gold);
    expect(state.settlement.resources.food).toBeLessThan(start.settlement.resources.food);
    expect(events.map((event) => event.type)).toEqual(['soldiersDisbanded']);
    expect(refused(state, 'disbandSoldiers', { unit: 'swordsman', amount: 1 }).code).toBe(
      'NOT_ENOUGH_SOLDIERS',
    );
  });

  it('recusa o lote acima do limite do nível, o fora da faixa e o segundo lote', () => {
    const full = barracksYard(0, (draft) => {
      draft.army.units.archer = 8;
    });
    expect(refused(full, 'trainSoldiers', { unit: 'archer', amount: 3 }).code).toBe('ARMY_LIMIT');
    expect(refused(full, 'trainSoldiers', { unit: 'archer', amount: 0 }).code).toBe(
      'INVALID_AMOUNT',
    );
    expect(refused(full, 'trainSoldiers', { unit: 'archer', amount: 11 }).code).toBe(
      'INVALID_AMOUNT',
    );
    expect(refused(full, 'trainSoldiers', { unit: 'archer', amount: 1.5 }).code).toBe(
      'INVALID_AMOUNT',
    );
    const busy = accept(full, command('trainSoldiers', { unit: 'archer', amount: 1 })).state;
    expect(refused(busy, 'trainSoldiers', { unit: 'archer', amount: 1 }).code).toBe(
      'TRAINING_BUSY',
    );
  });

  it('o soldado não deserta: a fome longa tira aldeões, nunca soldados', () => {
    const start = barracksYard(0, (draft) => {
      draft.settlement.population.villagers = 12;
      draft.army.units.spearman = 10;
      draft.settlement.resources.food = 0;
    });
    const after = advanceTo(start, 3 * DAY + 5 * HOUR).state;
    expect(after.settlement.famine).not.toBeNull();
    expect(after.army.units.spearman).toBe(10);
    expect(after.settlement.population.villagers).toBeGreaterThanOrEqual(3);
  });

  it('a visão traz as cinco unidades, o lote em treino e por que não dá para treinar', () => {
    const yard = barracksYard(0);
    const { state } = accept(yard, command('trainSoldiers', { unit: 'spearman', amount: 2 }));
    const view = deriveViewState(state, 1);
    expect(view.army.built).toBe(true);
    expect(view.army.cap).toBe(10);
    expect(view.army.units.map((unit) => unit.id)).toEqual([
      'spearman',
      'swordsman',
      'archer',
      'knight',
      'shieldbearer',
    ]);
    expect(view.army.units[0]).toMatchObject({
      label: 'Lanceiro',
      attack: 6,
      defense: 4,
      health: 20,
      initiative: 3,
      line: 'front',
      counters: 'Vence o Cavaleiro.',
    });
    expect(view.army.training).toMatchObject({
      unitLabel: 'Lanceiro',
      amount: 2,
      endsInSeconds: 1200,
    });
    expect(view.army.offer.every((entry) => entry.maxAmount === 0)).toBe(true);
    expect(view.army.offer[0]?.blockedReason).toContain('lote em treino');
    const idle = deriveViewState(yard, 1);
    expect(idle.army.offer.find((entry) => entry.unit === 'spearman')?.maxAmount).toBe(10);
    expect(idle.army.offer.find((entry) => entry.unit === 'swordsman')?.maxAmount).toBe(6);
    // Os lotes que a ordem aceitaria, de 1 até o máximo, com o custo do lote inteiro e o prazo:
    // o app mostra o total na conferência sem somar nada.
    const swordsmen = idle.army.offer.find((entry) => entry.unit === 'swordsman')?.options ?? [];
    expect(swordsmen.map((entry) => entry.amount)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(swordsmen[2]).toMatchObject({
      label: '3 espadachins',
      costText: '120 de comida, 60 de ouro, 3 armas',
    });
    expect(swordsmen[0]?.costText).toBe('40 de comida, 20 de ouro, 1 arma');
    expect(view.army.offer.every((entry) => entry.options.length === 0)).toBe(true);
    const none = deriveViewState(
      barracksYard(0, (draft) => {
        draft.settlement.weapons = 0;
      }),
      1,
    );
    expect(none.army.offer.find((entry) => entry.unit === 'knight')).toMatchObject({
      maxAmount: 0,
      blockedReason: 'Falta 1 arma: o Ferreiro a forja.',
    });
  });

  it('sem o Quartel a visão diz o que o abre e as ordens são recusadas', () => {
    const fresh = barracksYard(0, (draft) => {
      draft.settlement.buildings.barracks = 0;
      draft.settlement.buildings.townHall = 3;
    });
    const view = deriveViewState(fresh, 1);
    expect(view.army.built).toBe(false);
    expect(view.army.text).toContain('Salão Nv4');
    expect(refused(fresh, 'trainSoldiers', { unit: 'spearman', amount: 1 }).message).toContain(
      'Quartel',
    );
  });
});
