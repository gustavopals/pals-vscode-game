import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  command,
  eventsOfType,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  play,
  refuse,
  roomy,
} from './test-helpers';

const THIRTY_DAYS = 30 * 24 * HOUR;

describe('início da fome', () => {
  it('30 dias fora com consumo maior que a produção: a fome começa no instante previsto', () => {
    // Recrutar 2 aldeões leva a comida de 180 a 80 e o consumo de 5 para 6 (16 min) e 7 (32 min):
    // na primavera cada aldeão leva 16 minutos para chegar.
    const start = accept(newGame(), command('recruitVillagers', { quantity: 2 })).state;

    // Conta à mão, em milésimos × ms: 80.000 de comida, 16 min a 5.000/h, 16 min a 6.000/h
    // e o resto a 7.000/h.
    const balance = 80_000 * HOUR - 5_000 * 16 * MINUTE - 6_000 * 16 * MINUTE;
    const expectedAt = 32 * MINUTE + Math.floor(balance / 7_000);
    expect(expectedAt).toBe(41_554_285);

    const { state, events } = advanceTo(start, THIRTY_DAYS);
    const famines = eventsOfType(events, 'famineStarted');
    expect(famines).toHaveLength(1);
    expect(famines[0]).toMatchObject({ atMs: expectedAt });
    expect(famines[0]?.text).toBe(
      'No 6º dia da Primavera, as despensas de Pedra Alta ficaram vazias. A fome começou.',
    );
    expect(state.settlement.famine).toEqual({ sinceMs: expectedAt });
    expect(state.settlement.resources.food).toBe(0);
    expect(state.settlement.accumulators.food).toBe(0);
    expect(eventsOfType(events, 'famineEnded')).toEqual([]);
  });

  it('a comida nunca fica negativa, em nenhum corte do intervalo', () => {
    let state = newGame();
    for (let hour = 1; hour <= 100; hour += 1) {
      state = advanceTo(state, hour * HOUR + 7 * hour).state;
      expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
    }
    expect(state.settlement.famine).toEqual({ sinceMs: 36 * HOUR });
  });

  it('um instante antes ainda não há fome', () => {
    const { state, events } = advanceTo(newGame(), 36 * HOUR - 1);
    expect(state.settlement.famine).toBeNull();
    expect(eventsOfType(events, 'famineStarted')).toEqual([]);
  });

  it('gastar a última comida com consumo maior que a produção abre a fome na hora', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 50_000;
    });
    const result = accept(state, command('recruitVillagers', { quantity: 1 }));
    expect(result.state.settlement.famine).toEqual({ sinceMs: 0 });
    expect(result.events.map((event) => event.type)).toEqual([
      'recruitmentStarted',
      'famineStarted',
    ]);
  });
});

describe('durante a fome', () => {
  const starving = advanceTo(
    gameWith((draft) => {
      draft.settlement.workers = { farm: 0, lumberMill: 2, quarry: 0, goldMine: 0 };
      // Com o Armazém, a madeira das 36 horas tem onde ficar.
      roomy(draft);
    }),
    36 * HOUR,
  ).state;

  it('a produção cai para 75%', () => {
    expect(starving.settlement.famine).toEqual({ sinceMs: 36 * HOUR });
    const before = starving.settlement.resources.wood;
    const after = advanceTo(starving, 37 * HOUR).state.settlement.resources.wood;
    // 2 trabalhadores × 8 × 1,216 (mestria 72, de 18 dias de ofício) × 0,75 = 14,592 madeira/h.
    expect(starving.settlement.craftExperience.lumberMill).toBe(72);
    expect(after - before).toBe(14_592);
  });

  it('novas ordens de recrutamento são recusadas', () => {
    const fed = gameWith((draft) => {
      Object.assign(draft, starving);
      draft.settlement.resources.gold = 500_000;
    });
    expect(refuse(fed, command('recruitVillagers', { quantity: 1 })).code).toBe('FAMINE');
  });

  it('as obras continuam', () => {
    const building = accept(starving, command('startConstruction', { building: 'housing' })).state;
    const { state, events } = advanceTo(building, 36 * HOUR + 4 * MINUTE);
    expect(state.settlement.buildings.housing).toBe(2);
    expect(eventsOfType(events, 'constructionFinished')).toHaveLength(1);
  });
});

describe('fila de recrutamento congelada e fim da fome', () => {
  // 51 de comida: recrutar 1 aldeão deixa 1, que acaba em 12 min, antes de ele chegar (16 min).
  const start = accept(
    gameWith((draft) => {
      draft.settlement.resources.food = 51_000;
    }),
    command('recruitVillagers', { quantity: 1 }),
  ).state;
  const famineAt = 12 * MINUTE;

  it('o aldeão em treinamento não chega enquanto durar a fome', () => {
    // Seis horas: a moral cai a 26 em três viradas, e ainda ninguém parte por causa dela.
    const { state, events } = advanceTo(start, 6 * HOUR);
    expect(state.settlement.famine).toEqual({ sinceMs: famineAt });
    expect(state.settlement.population.villagers).toBe(5);
    expect(state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: 16 * MINUTE }]);
    expect(eventsOfType(events, 'recruitmentFinished')).toEqual([]);
  });

  it('realocar para a Fazenda encerra a fome e retoma a fila de onde parou', () => {
    const endAt = 2 * HOUR + 3 * MINUTE;
    const { state, events } = play(start, [
      { at: endAt },
      command('setWorkers', { building: 'farm', count: 2 }),
    ]);
    expect(state.settlement.famine).toBeNull();
    const ended = eventsOfType(events, 'famineEnded');
    expect(ended).toHaveLength(1);
    expect(ended[0]).toMatchObject({ atMs: endAt });

    // Faltavam 4 minutos de treinamento quando a fome começou.
    const arrivesAt = endAt + 4 * MINUTE;
    expect(state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: arrivesAt }]);
    const later = advanceTo(state, arrivesAt);
    expect(later.state.settlement.population.villagers).toBe(6);
    expect(eventsOfType(later.events, 'recruitmentFinished')[0]).toMatchObject({ atMs: arrivesAt });
  });

  it('um saldo positivo só com a penalidade ainda mantém a fome', () => {
    // 1 fazendeiro recém-chegado rende, na primavera, 6 (metade de 12); com a fome,
    // 6 × 0,75 = 4,5, que não alimenta 5 bocas. Sem a penalidade bastaria.
    const hungry = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: 0 };
    });
    const one = accept(hungry, command('setWorkers', { building: 'farm', count: 1 }));
    expect(one.state.settlement.famine).toEqual({ sinceMs: 0 });
    // 2 fazendeiros: 9 contra 5.
    const two = accept(one.state, command('setWorkers', { building: 'farm', count: 2 }));
    expect(two.state.settlement.famine).toBeNull();
    expect(two.events.map((event) => event.type)).toContain('famineEnded');
  });

  it('depois da fome a comida volta a acumular sem a penalidade', () => {
    const { state } = play(start, [
      { at: HOUR },
      command('setWorkers', { building: 'farm', count: 2 }),
      { at: 2 * HOUR },
    ]);
    // 2 × 10 × 1,2 (primavera) × metade (recém-chegados) = 12, sem os 75% da fome; menos 5
    // habitantes por 4 min, depois menos 6 pelo resto da hora.
    const expected = Math.floor((7_000 * 4 * MINUTE + 6_000 * 56 * MINUTE) / HOUR);
    expect(state.settlement.resources.food).toBe(expected);
  });
});
