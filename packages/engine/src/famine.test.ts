import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import { grantResources } from './storage';
import {
  accept,
  command,
  DAY,
  eventsOfType,
  famineSince,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  play,
  quietHorde,
  refuse,
  roomy,
  starve,
} from './test-helpers';
import type { GameEvent, GameState } from './types';

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
    // Em 30 dias a fome deveu 349 desertores ((708 h de fome − 12 h) ÷ 2 h, mais um): o piso
    // de 3 aldeões perdoou quase todos.
    expect(state.settlement.famine).toEqual(famineSince(expectedAt, 349));
    expect(state.settlement.resources.food).toBe(0);
    expect(state.settlement.accumulators.food).toBe(0);
    expect(eventsOfType(events, 'famineEnded')).toEqual([]);
  });

  it('a comida nunca fica negativa, em nenhum corte do intervalo', () => {
    // Com a Horda calada: os lobos do roteiro levariam comida às 30 h e adiantariam a fome.
    let state = gameWith(quietHorde);
    for (let hour = 1; hour <= 100; hour += 1) {
      state = advanceTo(state, hour * HOUR + 7 * hour).state;
      expect(state.settlement.resources.food).toBeGreaterThanOrEqual(0);
    }
    // Às 100 h a fome tem 64 h: (64 − 12) ÷ 2, mais um, cobrados nas viradas (o piso perdoa).
    expect(state.settlement.famine).toEqual(famineSince(36 * HOUR, 27));
  });

  it('um instante antes ainda não há fome', () => {
    const { state, events } = advanceTo(gameWith(quietHorde), 36 * HOUR - 1);
    expect(state.settlement.famine).toBeNull();
    expect(eventsOfType(events, 'famineStarted')).toEqual([]);
  });

  it('gastar a última comida com consumo maior que a produção abre a fome na hora', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 50_000;
    });
    const result = accept(state, command('recruitVillagers', { quantity: 1 }));
    expect(result.state.settlement.famine).toEqual(famineSince(0));
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
      quietHorde(draft);
    }),
    36 * HOUR,
  ).state;

  it('a produção cai para 75%', () => {
    expect(starving.settlement.famine).toEqual(famineSince(36 * HOUR));
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
    expect(state.settlement.famine).toEqual(famineSince(famineAt));
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
      starve(draft, 0);
    });
    const one = accept(hungry, command('setWorkers', { building: 'farm', count: 1 }));
    expect(one.state.settlement.famine).toEqual(famineSince(0));
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

describe('comida que chega durante a fome (GDD §5.6)', () => {
  // Dez aldeões, todos na Serraria, sem comida: a fome abre na hora e nada a encerra sozinha.
  const famineAt = 10 * DAY;
  const starving = advanceTo(
    gameAt(famineAt, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.settlement.buildings.housing = 3;
      draft.settlement.workers = { farm: 0, lumberMill: 10, quarry: 0, goldMine: 0 };
      draft.settlement.resources.food = 0;
      roomy(draft);
    }),
    famineAt + 3 * HOUR,
  ).state;
  const giftAt = starving.lastProcessedAt;

  /** Um ganho discreto de comida, como o de uma recompensa, e o acerto do instante. */
  function gift(state: GameState, food: number): { state: GameState; events: GameEvent[] } {
    const draft = cloneState(state);
    const events: GameEvent[] = [];
    grantResources(draft, { food });
    settleScarcity(draft, draft.lastProcessedAt, events);
    return { state: draft, events };
  }

  it('o cenário: fome aberta, saldo de comida negativo, despensa vazia', () => {
    expect(starving.settlement.famine).toEqual(famineSince(famineAt));
    expect(starving.settlement.resources.food).toBe(0);
  });

  it('é comida: a fome termina no instante, e recomeça no instante exato em que ela acaba', () => {
    const fed = gift(starving, 300);
    expect(fed.events.map((event) => event.type)).toEqual(['famineEnded']);
    expect(fed.state.settlement.famine).toBeNull();
    expect(fed.state.settlement.resources.food).toBe(300_000);

    // 300 de comida para 10 bocas: 30 horas de jogo, nem um milissegundo a mais.
    const again = giftAt + 30 * HOUR;
    const before = advanceTo(fed.state, again - 1);
    expect(before.state.settlement.famine).toBeNull();
    expect(eventsOfType(before.events, 'famineStarted')).toEqual([]);
    // A comida guardada foi sendo comida: resta o último milissegundo de consumo de 10 bocas
    // (10.000 milésimos por hora), na escala do acumulador.
    const { resources, accumulators } = before.state.settlement;
    expect(resources.food * HOUR + accumulators.food).toBe(10_000);

    const { state, events } = advanceTo(fed.state, again + 20 * HOUR);
    expect(eventsOfType(events, 'famineStarted').map((event) => event.atMs)).toEqual([again]);
    expect(eventsOfType(events, 'famineEnded')).toEqual([]);
    // A fome nova abre 30 h depois de a outra acabar, bem além da janela de 2 h: conta do zero.
    expect(state.settlement.famine).toMatchObject({ sinceMs: again, carriedMs: 0 });
    expect(state.settlement.resources.food).toBe(0);
  });

  it('ninguém deserta com a despensa cheia: o prazo da deserção recomeça com a fome nova', () => {
    // Sem o presente, a fome completa 12 h de jogo e leva um aldeão por virada.
    const unfed = advanceTo(starving, giftAt + 20 * HOUR);
    expect(eventsOfType(unfed.events, 'villagerDeserted').length).toBeGreaterThan(0);
    // Com ele, as 20 horas seguintes são de despensa cheia.
    const fed = advanceTo(gift(starving, 300).state, giftAt + 20 * HOUR);
    expect(eventsOfType(fed.events, 'villagerDeserted')).toEqual([]);
    expect(fed.state.settlement.resources.food).toBe(100_000);
  });

  it('a fila de recrutamento, congelada pela fome, anda enquanto a comida durar', () => {
    const queued = cloneState(starving);
    // Faltavam 5 minutos de treinamento quando a fome abriu.
    queued.settlement.recruitmentQueue = [{ finishesAtMs: famineAt + 5 * MINUTE }];
    const fed = gift(queued, 300);
    expect(fed.state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: giftAt + 5 * MINUTE }]);
    const { events } = advanceTo(fed.state, giftAt + HOUR);
    expect(eventsOfType(events, 'recruitmentFinished').map((event) => event.atMs)).toEqual([
      giftAt + 5 * MINUTE,
    ]);
  });

  it('a divisão de intervalo é exata com o corte em qualquer milissegundo', () => {
    const fed = gift(starving, 300).state;
    const end = giftAt + 40 * HOUR;
    const direct = advanceTo(fed, end);
    fc.assert(
      fc.property(fc.integer({ min: giftAt + 1, max: end - 1 }), (cut) => {
        const half = advanceTo(fed, cut);
        const split = advanceTo(half.state, end);
        expect(split.state).toStrictEqual(direct.state);
        expect([...half.events, ...split.events]).toStrictEqual(direct.events);
        // Fome aberta é despensa vazia, em qualquer corte.
        if (half.state.settlement.famine !== null) {
          expect(half.state.settlement.resources.food).toBe(0);
        }
      }),
      { numRuns: 500 },
    );
  });
});
