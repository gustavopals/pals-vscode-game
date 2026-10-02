import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { upgradeDurationMs } from './construction';
import {
  accept,
  AUTUMN,
  autumnScenario,
  command,
  DAY,
  gameAt,
  HOUR,
  MINUTE,
  SPRING,
  SUMMER,
  WINTER,
  winterColdScenario,
  YEAR,
} from './test-helpers';
import type { GameState, ViewState } from './types';
import { deriveViewState } from './view';

const view = (state: GameState, timeScale?: number) =>
  deriveViewState(state, state.lastProcessedAt, timeScale === undefined ? {} : { timeScale });

const woodOf = (derived: ViewState) => {
  const wood = derived.resources.find((row) => row.id === 'wood');
  if (wood === undefined) {
    throw new Error('A visão não trouxe a madeira.');
  }
  return wood;
};

/** 5 habitantes, todos na Fazenda, no primeiro instante de uma estação. */
const fedAt = (atMs: number, edit: (draft: GameState) => void = () => {}) =>
  gameAt(atMs, (draft) => {
    draft.settlement.workers.farm = 5;
    edit(draft);
  });

describe('calendário: o que a estação muda', () => {
  it.each([
    ['primavera', SPRING, 'Primavera: comida × 1,2; recrutamento com prazo × 0,8.'],
    ['verão', SUMMER, 'Verão: madeira e pedra × 1,15.'],
    ['outono', AUTUMN, 'Outono: comida × 1,3; ouro × 1,1.'],
    [
      'inverno',
      WINTER,
      'Inverno: comida × 0,4; madeira e pedra × 0,8; obras iniciadas com prazo × 1,5; a lareira queima 0,5 de madeira por habitante por hora.',
    ],
  ])('%s: uma frase com os efeitos da estação atual', (_, season, text) => {
    expect(view(fedAt(season)).calendar.seasonEffects).toBe(text);
  });

  it('a lenha da frase é por hora real', () => {
    expect(view(fedAt(WINTER), 3).calendar.seasonEffects).toContain(
      'a lareira queima 1,5 de madeira por habitante por hora.',
    );
    expect(view(fedAt(WINTER), 0.5).calendar.seasonEffects).toContain(
      'a lareira queima 0,25 de madeira por habitante por hora.',
    );
  });
});

describe('calendário: a próxima estação', () => {
  it('primavera → verão', () => {
    expect(view(fedAt(SPRING + 5 * DAY)).calendar.nextSeason).toEqual({
      id: 'summer',
      label: 'Verão',
      secondsUntil: 19 * 7200,
      changes: [
        'A produção de comida passa de × 1,2 para × 1.',
        'A produção de madeira e pedra passa de × 1 para × 1,15.',
        'O recrutamento volta ao prazo de sempre.',
      ],
      firewood: null,
      // 5 lavradores com a mestria e a moral que a virada encontra, sem o fator da primavera:
      // 64,47 por hora, contra 5 de consumo. A despensa já está cheia.
      food: {
        perHour: 59.5,
        stockAtTurn: 500,
        depletesInSeconds: null,
        text: 'Com a gente de agora na Fazenda, o saldo de comida no Verão será de +59,47/h.',
      },
    });
  });

  it('verão → outono', () => {
    expect(view(fedAt(SUMMER)).calendar.nextSeason).toMatchObject({
      id: 'autumn',
      label: 'Outono',
      secondsUntil: 24 * 7200,
      changes: [
        'A produção de comida passa de × 1 para × 1,3.',
        'A produção de madeira e pedra passa de × 1,15 para × 1.',
        'A produção de ouro passa de × 1 para × 1,1.',
      ],
      firewood: null,
    });
  });

  it('outono → inverno: produção, obras, lenha e a conta do que falta guardar', () => {
    const { nextSeason } = view(autumnScenario()).calendar;
    expect(nextSeason).toMatchObject({ id: 'winter', label: 'Inverno', secondsUntil: 2 * 7200 });
    expect(nextSeason.changes).toEqual([
      'A produção de comida passa de × 1,3 para × 0,4.',
      'A produção de madeira e pedra passa de × 1 para × 0,8.',
      'A produção de ouro passa de × 1,1 para × 1.',
      'O prazo de uma obra iniciada no Inverno é × 1,5.',
      'A lareira passa a queimar 0,5 de madeira por habitante por hora; sem madeira, vem o frio.',
    ]);
    // 18 habitantes × 0,5 × 24 horas de inverno = 216. Ninguém na Serraria; 60 no estoque.
    expect(nextSeason.firewood).toEqual({
      perHour: 9,
      winterTotal: 216,
      winterProduction: 0,
      stock: 60,
      gathered: 0,
      reserved: 0,
      missing: 156,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria repõe 0 e há 60 em estoque: faltam 156 de madeira.',
    });
  });

  it('inverno → primavera', () => {
    expect(view(fedAt(WINTER)).calendar.nextSeason).toMatchObject({
      id: 'spring',
      label: 'Primavera',
      secondsUntil: 12 * 7200,
      changes: [
        'A produção de comida passa de × 0,4 para × 1,2.',
        'A produção de madeira e pedra passa de × 0,8 para × 1.',
        'O prazo de um recrutamento ordenado na Primavera é × 0,8.',
        'As obras voltam ao prazo de sempre.',
        'Ninguém queima mais lenha: o frio, se houver, passa.',
      ],
      firewood: null,
    });
  });

  it('a previsão conta a Serraria com o rendimento do inverno, e some quando ela dá conta', () => {
    const state = autumnScenario();
    state.settlement.workers = { farm: 10, lumberMill: 1, quarry: 4, goldMine: 3 };
    state.settlement.resources.wood = 50_000;
    // Um lenhador no inverno rende 8 × 0,8 = 6,4 por hora, e a conta usa a moral que a próxima
    // virada vai calcular (60, com a comida guardada): 6,72 por hora, 161,28 em 24 horas, para
    // baixo. Sozinhos, os 161 e os 50 do estoque não cobrem os 216; mas nas 4 horas que faltam
    // para o inverno o mesmo lenhador junta mais 33 (duas horas a 8 e duas a 8,4, com a moral
    // nova), e com eles a conta fecha. É o que o motor faz: o frio não vem.
    expect(view(state).morale.next.value).toBe(60);
    expect(view(state).calendar.nextSeason.firewood).toEqual({
      perHour: 9,
      winterTotal: 216,
      winterProduction: 161,
      stock: 50,
      gathered: 33,
      reserved: 0,
      missing: 0,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. O estoque e a Serraria dão conta.',
    });
    expect(advanceTo(state, YEAR).events.some((event) => event.type === 'coldStarted')).toBe(false);
    // Com menos no estoque, as três parcelas aparecem.
    state.settlement.resources.wood = 10_000;
    expect(view(state).calendar.nextSeason.firewood).toMatchObject({
      stock: 10,
      gathered: 33,
      missing: 12,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria junta 33 até lá e repõe 161 no Inverno, e há 10 em estoque: faltam 12 de madeira.',
    });
    state.settlement.resources.wood = 50_000;
    state.settlement.workers = { farm: 10, lumberMill: 2, quarry: 3, goldMine: 3 };
    expect(view(state).calendar.nextSeason.firewood).toMatchObject({
      winterProduction: 322,
      missing: 0,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. O estoque e a Serraria dão conta.',
    });
  });

  it('no ritmo 3 a lenha por hora triplica; os totais do inverno são os mesmos', () => {
    const game = view(autumnScenario()).calendar.nextSeason;
    const real = view(autumnScenario(), 3).calendar.nextSeason;
    expect(real.secondsUntil).toBe(2 * 2400);
    expect(real.firewood).toEqual({ ...game.firewood, perHour: 27 });
    expect(real.changes.at(-1)).toBe(
      'A lareira passa a queimar 1,5 de madeira por habitante por hora; sem madeira, vem o frio.',
    );
    expect(real.changes.slice(0, -1)).toEqual(game.changes.slice(0, -1));
  });
});

describe('calendário: a comida da próxima estação', () => {
  /**
   * A uma hora do inverno: 30 habitantes nas casas cheias, 3 na Fazenda e 27 na Serraria, 120 de
   * comida e madeira de sobra. No outono a Fazenda rende 39 por hora e o saldo é de +9.
   */
  const beforeWinter = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(WINTER - HOUR, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 30;
      settlement.buildings.housing = 5;
      settlement.workers = { farm: 3, lumberMill: 27, quarry: 0, goldMine: 0 };
      settlement.resources = { ...settlement.resources, food: 120_000, wood: 400_000 };
      edit(draft);
    });
  const foodOf = (derived: ViewState) => {
    const food = derived.resources.find((row) => row.id === 'food');
    if (food === undefined) {
      throw new Error('A visão não trouxe a comida.');
    }
    return food;
  };
  /** O instante de jogo em que a fome começa, se ninguém fizer nada. */
  const famineAt = (state: GameState, withinMs: number) =>
    advanceTo(state, state.lastProcessedAt + withinMs).events.find(
      (event) => event.type === 'famineStarted',
    )?.atMs;

  it('saldo positivo no outono e negativo no inverno: a visão diz quando a comida acaba depois da virada', () => {
    const state = beforeWinter();
    const derived = view(state);
    // Com a estação de agora a comida cresce: o prazo de agora não tem o que dizer.
    expect(foodOf(derived)).toMatchObject({ stock: 120, perHour: 9, depletesInSeconds: null });
    // Na virada: 129 de comida; a moral cai a 40 (casas cheias) e a Fazenda ganha 4 de
    // experiência. 3 × 10 × 0,4 × 1,012 × 0,95 = 11,536 por hora, contra 30 de consumo: 129
    // durariam 6 h 59 min. A experiência sobe mais 4 a cada virada de dia, e a fome só chega
    // 7 h 03 min depois da virada. É o instante que o motor encontra, andando de verdade.
    const starved = famineAt(state, DAY + 12 * HOUR);
    expect(starved).toBe(WINTER + 7 * HOUR + 196_421);
    expect(derived.calendar.nextSeason.food).toEqual({
      perHour: -18.5,
      stockAtTurn: 129,
      // A uma hora da virada: 8 h 03 min 16 s, para baixo.
      depletesInSeconds: 8 * 3600 + 196,
      text: 'Com a gente de agora na Fazenda, o saldo de comida no Inverno será de −18,46/h: o estoque de 129 que a virada encontra acaba 7 h 03 min depois dela. Mande mais gente para a Fazenda ou guarde comida antes.',
    });
  });

  it('a comida não acaba antes do prazo anunciado, em nenhum ritmo e de nenhum ponto do outono', () => {
    for (const timeScale of [1, 3, 7, 0.5]) {
      for (const before of [HOUR, 3 * HOUR + 1, DAY + 999, 2 * DAY + 100_001]) {
        const state = gameAt(WINTER - before, (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = 30;
          settlement.buildings.housing = 5;
          settlement.workers = { farm: 3, lumberMill: 27, quarry: 0, goldMine: 0 };
          settlement.resources = { ...settlement.resources, food: 120_000, wood: 400_000 };
        });
        const seconds = view(state, timeScale).calendar.nextSeason.food?.depletesInSeconds;
        if (seconds === null || seconds === undefined) {
          throw new Error('O teste esperava a comida acabando no inverno.');
        }
        const gameMs = state.lastProcessedAt + seconds * 1000 * timeScale;
        expect(gameMs).toBeGreaterThan(WINTER);
        expect(advanceTo(state, gameMs - 1).state.settlement.famine).toBeNull();
        expect(advanceTo(state, gameMs + 1000 * timeScale).state.settlement.famine).not.toBeNull();
      }
    }
  });

  it('no ritmo 3 os prazos e o saldo são os do relógio de quem joga', () => {
    const game = view(beforeWinter()).calendar.nextSeason.food;
    const real = view(beforeWinter(), 3).calendar.nextSeason.food;
    expect(real).toMatchObject({ perHour: -55.4, stockAtTurn: 129 });
    expect(real?.depletesInSeconds).toBe(Math.floor((game?.depletesInSeconds ?? 0) / 3));
    expect(real?.text).toContain('será de −55,39/h');
    expect(real?.text).toContain('acaba 2 h 21 min depois dela');
  });

  it('com comida que atravessa a estação, a previsão diz o saldo e não dá prazo', () => {
    const stocked = beforeWinter((draft) => {
      draft.settlement.buildings.granary = 3;
      draft.settlement.resources.food = 700_000;
    });
    // 709 na virada, a −18,46 por hora: 24 horas de inverno levam 443.
    expect(view(stocked).calendar.nextSeason.food).toMatchObject({
      stockAtTurn: 709,
      depletesInSeconds: null,
      text: 'Com a gente de agora na Fazenda, o saldo de comida no Inverno será de −18,46/h: o estoque de 709 que a virada encontra atravessa a estação.',
    });
  });

  it('com a Fazenda cobrindo as bocas também na estação que vem, só o saldo', () => {
    const farmers = beforeWinter((draft) => {
      draft.settlement.workers = { farm: 30, lumberMill: 0, quarry: 0, goldMine: 0 };
    });
    const { food } = view(farmers).calendar.nextSeason;
    expect(food).toMatchObject({ depletesInSeconds: null });
    expect(food?.perHour).toBeGreaterThan(0);
    expect(food?.text).toMatch(
      /^Com a gente de agora na Fazenda, o saldo de comida no Inverno será de \+[\d,]+\/h\.$/,
    );
  });

  it('a despensa que a virada encontra vazia: a fome começa com ela', () => {
    // Ninguém na Fazenda e comida para exatamente a hora que falta: 30 bocas, 30 de comida.
    const empty = beforeWinter((draft) => {
      draft.settlement.workers = { farm: 0, lumberMill: 27, quarry: 0, goldMine: 0 };
      draft.settlement.resources.food = 30_000;
    });
    expect(famineAt(empty, DAY)).toBe(WINTER);
    // O prazo de agora e a previsão dizem o mesmo instante.
    expect(foodOf(view(empty)).depletesInSeconds).toBe(3600);
    expect(view(empty).calendar.nextSeason.food).toEqual({
      perHour: -30,
      stockAtTurn: 0,
      depletesInSeconds: 3600,
      text: 'Com a gente de agora na Fazenda, o saldo de comida no Inverno será de −30/h, e a virada encontra o estoque vazio: a fome começa com ela. Mande mais gente para a Fazenda ou guarde comida antes.',
    });
  });

  it('com a comida acabando antes da virada, ou com fome, a previsão sai de cena', () => {
    const short = beforeWinter((draft) => {
      draft.settlement.workers = { farm: 0, lumberMill: 27, quarry: 0, goldMine: 0 };
      draft.settlement.resources.food = 10_000;
    });
    expect(foodOf(view(short)).depletesInSeconds).toBe(1200);
    expect(view(short).calendar.nextSeason.food).toBeNull();
    const starving = advanceTo(short, WINTER - HOUR + 30 * MINUTE).state;
    expect(starving.settlement.famine).not.toBeNull();
    expect(view(starving).calendar.nextSeason.food).toBeNull();
  });

  it('do inverno para a primavera a previsão conta a Fazenda rendendo mais', () => {
    const winter = fedAt(WINTER + 11 * DAY, (draft) => {
      draft.settlement.resources.wood = 400_000;
    });
    // 5 lavradores: 5 × 10 × 0,4 = 20 por hora no inverno, contra 5 de consumo; na primavera,
    // × 1,2.
    const { food } = view(winter).calendar.nextSeason;
    expect(food).toMatchObject({ depletesInSeconds: null });
    expect(food?.perHour).toBeGreaterThan(foodOf(view(winter)).perHour);
    expect(food?.text).toMatch(/o saldo de comida na Primavera será de \+[\d,]+\/h\.$/);
  });

  it('pedir a visão não muda o estado', () => {
    const state = beforeWinter();
    const before = JSON.stringify(state);
    view(state);
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('inverno na visão', () => {
  it('fora do inverno não há lareira', () => {
    for (const season of [SPRING, SUMMER, AUTUMN, YEAR]) {
      expect(view(fedAt(season)).winter).toBeNull();
    }
  });

  it('a madeira ganha a lenha na explicação, o saldo e o prazo para acabar', () => {
    // 5 habitantes queimam 2,5 por hora; 120 de madeira duram 48 horas.
    const wood = woodOf(view(fedAt(WINTER)));
    expect(wood).toMatchObject({ stock: 120, perHour: -2.5, depletesInSeconds: 48 * 3600 });
    expect(wood.breakdown).toBe(
      'Serraria: 0 trabalhadores × 8 × 1 (Nv1) × 0,8 (inverno) = 0/h; −2,5/h (lenha de 5 habitantes)',
    );
    const real = woodOf(view(fedAt(WINTER), 3));
    expect(real).toMatchObject({ perHour: -7.5, depletesInSeconds: 16 * 3600 });
    expect(real.breakdown).toBe(
      'Serraria: 0 trabalhadores × 24 × 1 (Nv1) × 0,8 (inverno) = 0/h; −7,5/h (lenha de 5 habitantes)',
    );
  });

  it('com um habitante só, a explicação fala em "1 habitante"', () => {
    const alone = gameAt(WINTER, (draft) => {
      draft.settlement.population.villagers = 1;
      draft.settlement.workers.farm = 1;
    });
    expect(woodOf(view(alone)).breakdown).toMatch(/−0,5\/h \(lenha de 1 habitante\)$/);
  });

  it('com a Serraria cobrindo a lenha, a madeira não tem prazo para acabar', () => {
    const covered = fedAt(WINTER, (draft) => {
      draft.settlement.workers = { farm: 4, lumberMill: 1, quarry: 0, goldMine: 0 };
    });
    const wood = woodOf(view(covered));
    expect(wood).toMatchObject({ perHour: 3.9, depletesInSeconds: null });
    expect(wood.breakdown).toBe(
      'Serraria: 1 trabalhador × 8 × 1 (Nv1) × 0,8 (inverno) = 6,4/h; −2,5/h (lenha de 5 habitantes)',
    );
  });

  it('a madeira não acaba antes do prazo anunciado, em nenhum ritmo', () => {
    const start = fedAt(WINTER, (draft) => {
      draft.settlement.resources.wood = 7_000;
    });
    for (const timeScale of [1, 3, 7, 0.5]) {
      for (const at of [0, 1, 999, 100_001]) {
        const seconds = woodOf(
          deriveViewState(start, WINTER + at, { timeScale }),
        ).depletesInSeconds;
        if (seconds === null) {
          throw new Error('O teste esperava madeira acabando.');
        }
        const gameMs = WINTER + at + seconds * 1000 * timeScale;
        expect(advanceTo(start, gameMs - 1).state.settlement.cold).toBeNull();
        expect(advanceTo(start, gameMs + 1000 * timeScale).state.settlement.cold).not.toBeNull();
      }
    }
  });

  it('a conta do que falta queimar até a primavera, com a lareira ainda acesa', () => {
    // 4º dia do inverno: faltam 9 dias, 18 horas. 5 habitantes queimam 45; há 30.
    const state = fedAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.resources.wood = 30_000;
    });
    expect(view(state).winter).toEqual({
      firewoodPerHour: 2.5,
      firewood: {
        perHour: 2.5,
        winterTotal: 45,
        winterProduction: 0,
        stock: 30,
        gathered: 0,
        reserved: 0,
        missing: 15,
        text: 'Até a Primavera a lareira ainda queima 45 de madeira. A Serraria repõe 0 e há 30 em estoque: faltam 15 de madeira.',
      },
      cold: null,
    });
    state.settlement.resources.wood = 45_000;
    expect(view(state).winter?.firewood).toMatchObject({
      missing: 0,
      text: 'Até a Primavera a lareira ainda queima 45 de madeira. O estoque e a Serraria dão conta.',
    });
  });

  it('o frio diz o que custa, o que a lareira pede e quanto falta', () => {
    const cold = view(winterColdScenario());
    // Os 60 de madeira queimaram em 6 h 40 min; o estado está em 7 h 30 min de inverno.
    expect(cold.winter).toEqual({
      firewoodPerHour: 9,
      firewood: {
        perHour: 9,
        winterTotal: 149,
        winterProduction: 0,
        stock: 0,
        gathered: 0,
        reserved: 0,
        missing: 149,
        text: 'Até a Primavera a lareira ainda queima 149 de madeira. A Serraria repõe 0 e há 0 em estoque: faltam 149 de madeira.',
      },
      cold: {
        secondsElapsed: 50 * 60,
        endsInSeconds: null,
        text: 'Frio: sem lenha, a produção de todo o feudo cai para 80%. A lareira pede 9/h e a Serraria entrega 0/h: o frio passa quando sobrar madeira, ou na Primavera. Faltam 149 de madeira para atravessar o resto do Inverno.',
      },
    });
    expect(woodOf(cold)).toMatchObject({ stock: 0, perHour: -9, depletesInSeconds: null });
    // A penalidade aparece em toda explicação de produção.
    for (const row of cold.workers) {
      expect(row.breakdown).toContain('× 0,8 (frio)');
    }
    // A Fazenda, ocupada, ganhou 4 de experiência em cada uma das cinco viradas do caminho, e
    // a moral ainda é a da última virada, antes do frio: 60.
    expect(cold.workers[0]?.breakdown).toBe(
      '10 trabalhadores × 10 × 1,2 (Nv2) × 1,06 (mestria 20) × 0,4 (inverno) × 1,05 (moral 60) × 0,8 (frio) = 42,74/h',
    );
    // O frio só entra na moral na próxima virada, e a visão avisa antes.
    expect(cold.morale).toMatchObject({
      value: 60,
      next: { value: 40, band: 'restless' },
      breakdown: '50 (base) + 10 (comida guardada para 24 h) − 20 (frio) = 40',
      nextText: 'A moral só muda na virada do dia: na próxima, cai de 60 para 40 (Inquieto).',
    });
    expect(cold.famine).toBeNull();
  });

  it('no ritmo 3 o frio conta o tempo real e as taxas por hora real', () => {
    const cold = view(winterColdScenario(), 3);
    expect(cold.winter?.firewoodPerHour).toBe(27);
    expect(cold.winter?.firewood).toMatchObject({ perHour: 27, winterTotal: 149, missing: 149 });
    // 50 minutos de jogo são 16 min 40 s reais.
    expect(cold.winter?.cold?.secondsElapsed).toBe(1000);
    expect(cold.winter?.cold?.text).toContain('A lareira pede 27/h e a Serraria entrega 0/h');
    expect(cold.workers[0]?.breakdown).toBe(
      '10 trabalhadores × 30 × 1,2 (Nv2) × 1,06 (mestria 20) × 0,4 (inverno) × 1,05 (moral 60) × 0,8 (frio) = 128,22/h',
    );
    // Um instante quebrado arredonda para baixo, como a fome.
    const state = winterColdScenario();
    expect(
      deriveViewState(state, state.lastProcessedAt + 2999, { timeScale: 3 }).winter?.cold
        ?.secondsElapsed,
    ).toBe(1000);
    expect(
      deriveViewState(state, state.lastProcessedAt + 3000, { timeScale: 3 }).winter?.cold
        ?.secondsElapsed,
    ).toBe(1001);
  });

  it('com a Serraria rendendo, mas menos que a lareira, o frio diz os dois números', () => {
    const state = winterColdScenario();
    const moved = accept(
      accept(state, command('setWorkers', { building: 'quarry', count: 4 })).state,
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ).state;
    // Um lenhador recém-chegado, no frio, com a moral ainda em 60: 8 × 0,8 × 0,8 × metade ×
    // 1,05 = 2,688, contra 9 de lenha.
    expect(moved.settlement.cold).not.toBeNull();
    // Até a primavera faltam 16 h 30 min. A conta da lenha já sabe que a adaptação termina e
    // que a próxima virada, daqui a 30 min, leva a moral a 40 (o frio): 30 min a 2,688, 1 h 30
    // pela metade com a moral nova (2,432) e 14 h 30 min a 4,864. São 1,344 + 3,648 + 70,528:
    // repõe 75 dos 149.
    expect(view(moved).winter?.firewood).toMatchObject({
      winterTotal: 149,
      winterProduction: 75,
      missing: 74,
    });
    expect(view(moved).winter?.cold?.text).toBe(
      'Frio: sem lenha, a produção de todo o feudo cai para 80%. A lareira pede 9/h e a Serraria entrega 2,69/h: o frio passa quando sobrar madeira, ou na Primavera. Faltam 74 de madeira para atravessar o resto do Inverno.',
    );
  });
});

describe('calendário: a próxima estação que queima lenha', () => {
  /**
   * Fim do verão, 20º dia: 18 habitantes, ninguém na Serraria e 60 de madeira. Faltam 4 dias de
   * verão e o outono inteiro (24 dias) para o inverno: 56 horas de jogo. No ritmo Rápido são
   * menos de 19 horas de relógio, e a próxima estação ainda é o outono, que não queima nada.
   */
  const lateSummer = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(SUMMER + 20 * DAY, (draft) => {
      const { settlement } = draft;
      draft.settings.timeScale = 3;
      settlement.population.villagers = 18;
      settlement.buildings = { ...settlement.buildings, townHall: 2, housing: 4, granary: 2 };
      settlement.workers = { farm: 10, lumberMill: 0, quarry: 4, goldMine: 4 };
      settlement.resources = { ...settlement.resources, food: 600_000, wood: 60_000 };
      edit(draft);
    });
  const coldAt = (state: GameState) =>
    advanceTo(state, YEAR).events.find((event) => event.type === 'coldStarted')?.atMs;

  it('no verão, com o outono no meio: a conta do inverno já vem, com o prazo até ele', () => {
    const state = lateSummer();
    const { nextSeason, nextFirewoodSeason } = view(state).calendar;
    expect(nextSeason).toMatchObject({ id: 'autumn', firewood: null });
    // 56 horas de jogo, a três por hora de relógio: 18 h 40 min.
    expect(nextFirewoodSeason).toEqual({
      id: 'winter',
      label: 'Inverno',
      secondsUntil: (56 * 3600) / 3,
      firewood: {
        perHour: 27,
        winterTotal: 216,
        winterProduction: 0,
        stock: 60,
        gathered: 0,
        reserved: 0,
        missing: 156,
        text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria repõe 0 e há 60 em estoque: faltam 156 de madeira.',
      },
    });
    // É o que o motor faz se ninguém mexer: o frio abre no 4º dia do inverno.
    expect(coldAt(state)).toBe(WINTER + 3 * DAY + 40 * MINUTE);
  });

  it('no outono é a próxima estação; no inverno não há o que prever', () => {
    const autumn = view(autumnScenario()).calendar;
    expect(autumn.nextFirewoodSeason).toEqual({
      id: autumn.nextSeason.id,
      label: autumn.nextSeason.label,
      secondsUntil: autumn.nextSeason.secondsUntil,
      firewood: autumn.nextSeason.firewood,
    });
    expect(view(fedAt(WINTER)).calendar.nextFirewoodSeason).toBeNull();
    expect(view(winterColdScenario()).calendar.nextFirewoodSeason).toBeNull();
  });

  it('na primavera o inverno está a três estações, e a conta é a mesma', () => {
    const { nextFirewoodSeason } = view(fedAt(SPRING + 5 * DAY)).calendar;
    // 5 habitantes × 0,5 × 24 horas = 60; há 120 de madeira.
    expect(nextFirewoodSeason).toMatchObject({
      id: 'winter',
      secondsUntil: 67 * 7200,
      firewood: { winterTotal: 60, stock: 120, gathered: 0, missing: 0 },
    });
  });

  it('a conta soma o que a Serraria junta até o inverno, até onde o depósito guarda', () => {
    // Um lenhador: no inverno ele repõe menos do que a lareira queima, mas até lá junta
    // madeira o resto do verão e o outono inteiro, e o Pátio guarda até 500.
    const state = lateSummer((draft) => {
      draft.settlement.workers = { farm: 10, lumberMill: 1, quarry: 3, goldMine: 4 };
    });
    const firewood = view(state).calendar.nextFirewoodSeason?.firewood;
    expect(firewood).toMatchObject({
      winterTotal: 216,
      stock: 60,
      gathered: 440,
      reserved: 0,
      missing: 0,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. O estoque e a Serraria dão conta.',
    });
    expect(firewood?.winterProduction).toBeGreaterThan(150);
    expect(firewood?.winterProduction).toBeLessThan(216);
    expect(coldAt(state)).toBeUndefined();
    // Com a despensa do inverno quase toda por juntar, a frase mostra as três parcelas.
    const hungry = lateSummer((draft) => {
      draft.settlement.population.villagers = 60;
      draft.settlement.buildings.housing = 12;
      draft.settlement.workers = { farm: 55, lumberMill: 1, quarry: 0, goldMine: 4 };
      draft.settlement.resources.food = 2_000_000;
      draft.settlement.buildings.granary = 5;
    });
    const short = view(hungry).calendar.nextFirewoodSeason?.firewood;
    expect(short).toMatchObject({ winterTotal: 720, stock: 60, gathered: 440 });
    expect(short?.missing).toBe(720 - 500 - (short?.winterProduction ?? 0));
    expect(short?.text).toBe(
      `O Inverno vai queimar 720 de madeira com 60 habitantes. A Serraria junta 440 até lá e repõe ${short?.winterProduction} no Inverno, e há 60 em estoque: faltam ${short?.missing} de madeira.`,
    );
  });

  it('a obra automática que começa antes do inverno leva madeira do que a Serraria juntou', () => {
    const state = accept(
      lateSummer((draft) => {
        draft.settlement.workers = { farm: 10, lumberMill: 1, quarry: 3, goldMine: 4 };
        draft.settlement.resources.gold = 0;
      }),
      command('planConstruction', { building: 'farm', autoStart: true }),
    ).state;
    expect(view(state).calendar.nextFirewoodSeason?.firewood).toMatchObject({
      stock: 60,
      gathered: 440,
      reserved: 80,
      missing: 0,
      text: 'O Inverno vai queimar 216 de madeira com 18 habitantes. O estoque e a Serraria dão conta, mesmo com os 80 que a obra planejada da Fazenda leva.',
    });
  });
});

describe('a conta da lenha e as planejadas automáticas', () => {
  /**
   * 10 habitantes, ninguém na Serraria, 125 de madeira e nenhum ouro. A Fazenda fica planejada
   * como automática: custa 80 de madeira, que há, e 40 de ouro, que os dois mineiros juntam em
   * pouco menos de cinco horas. O motor inicia a obra sozinho, sem olhar a lenha (GDD §6.3).
   */
  const fief = (atMs: number, wood: number) =>
    gameAt(atMs, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 10;
      settlement.buildings.housing = 2;
      settlement.workers = { farm: 4, lumberMill: 0, quarry: 4, goldMine: 2 };
      settlement.resources = { food: 300_000, wood: wood * 1000, stone: 100_000, gold: 0 };
    });
  const planned = (state: GameState) =>
    accept(state, command('planConstruction', { building: 'farm', autoStart: true })).state;
  const coldAt = (state: GameState) =>
    advanceTo(state, YEAR).events.find((event) => event.type === 'coldStarted')?.atMs;

  it('no inverno: a conta desconta a madeira que a obra automática vai levar, e diz qual obra', () => {
    const start = fief(WINTER + HOUR, 125);
    // Sem a planejada, 125 de madeira cobrem as 23 horas que faltam a 5 por hora.
    expect(view(start).winter?.firewood).toMatchObject({
      winterTotal: 115,
      stock: 125,
      gathered: 0,
      reserved: 0,
      missing: 0,
      text: 'Até a Primavera a lareira ainda queima 115 de madeira. O estoque e a Serraria dão conta.',
    });
    expect(coldAt(start)).toBeUndefined();

    const state = planned(start);
    const derived = view(state);
    expect(derived.constructions.planned[0]?.waiting).toMatchObject({
      reason: 'resources',
      text: 'espera 40 de ouro',
    });
    // A obra começa sozinha na 6ª hora do inverno, e o frio abre na 10ª: é o que o motor faz.
    const events = advanceTo(state, YEAR).events;
    expect(events.find((event) => event.type === 'constructionAutoStarted')?.atMs).toBeLessThan(
      WINTER + 6 * HOUR,
    );
    expect(coldAt(state)).toBe(WINTER + 10 * HOUR);
    // A conta já diz isso antes: dos 125, a obra leva 80, e os 45 que sobram não cobrem 115.
    expect(derived.winter?.firewood).toEqual({
      perHour: 5,
      winterTotal: 115,
      winterProduction: 0,
      stock: 125,
      gathered: 0,
      reserved: 80,
      missing: 70,
      text: 'Até a Primavera a lareira ainda queima 115 de madeira. A Serraria repõe 0 e há 125 em estoque, mas a obra planejada da Fazenda leva 80 quando começar sozinha: faltam 70 de madeira. Mande gente para a Serraria ou desligue o início automático.',
    });
  });

  it('no inverno: "acaba em" conta com o que a obra automática leva, e o frio abre naquele segundo', () => {
    for (const timeScale of [1, 3, 7, 0.5]) {
      const state = planned(fief(WINTER + HOUR, 125));
      const seconds = woodOf(view(state, timeScale)).depletesInSeconds;
      if (seconds === null) {
        throw new Error('O teste esperava madeira acabando.');
      }
      const gameMs = state.lastProcessedAt + seconds * 1000 * timeScale;
      // Nove horas de jogo: sem a obra seriam vinte e cinco.
      expect(gameMs).toBeGreaterThan(WINTER + 10 * HOUR - 1000 * timeScale);
      expect(gameMs).toBeLessThanOrEqual(WINTER + 10 * HOUR);
      expect(advanceTo(state, gameMs - 1).state.settlement.cold).toBeNull();
      expect(advanceTo(state, gameMs + 1000 * timeScale).state.settlement.cold).not.toBeNull();
    }
  });

  it('no outono: a previsão do inverno desconta a obra que começa sozinha antes de ele acabar', () => {
    const start = fief(WINTER - DAY, 130);
    expect(view(start).calendar.nextSeason.firewood).toMatchObject({
      winterTotal: 120,
      stock: 130,
      gathered: 0,
      reserved: 0,
      missing: 0,
    });
    expect(coldAt(start)).toBeUndefined();

    const state = planned(start);
    expect(coldAt(state)).toBe(WINTER + 10 * HOUR);
    expect(view(state).calendar.nextSeason.firewood).toEqual({
      perHour: 5,
      winterTotal: 120,
      winterProduction: 0,
      stock: 130,
      gathered: 0,
      reserved: 80,
      missing: 70,
      text: 'O Inverno vai queimar 120 de madeira com 10 habitantes. A Serraria repõe 0 e há 130 em estoque, mas a obra planejada da Fazenda leva 80 quando começar sozinha: faltam 70 de madeira. Mande gente para a Serraria ou desligue o início automático.',
    });
  });

  it('com lenha de sobra, a conta fecha e ainda diz o que a obra leva', () => {
    const state = planned(fief(WINTER + HOUR, 200));
    expect(coldAt(state)).toBeUndefined();
    expect(view(state).winter?.firewood).toMatchObject({
      stock: 200,
      gathered: 0,
      reserved: 80,
      missing: 0,
      text: 'Até a Primavera a lareira ainda queima 115 de madeira. O estoque e a Serraria dão conta, mesmo com os 80 que a obra planejada da Fazenda leva.',
    });
  });

  it('a planejada manual, e a automática que não vai começar, não entram na conta', () => {
    const manual = accept(
      fief(WINTER + HOUR, 125),
      command('planConstruction', { building: 'farm' }),
    ).state;
    expect(view(manual).winter?.firewood).toMatchObject({ reserved: 0, missing: 0 });
    // Sem ninguém na Mina, o ouro não chega: a obra não começa, e a lenha fica onde está.
    const stalled = planned(
      gameAt(WINTER + HOUR, (draft) => {
        const { settlement } = draft;
        settlement.population.villagers = 10;
        settlement.buildings.housing = 2;
        settlement.workers = { farm: 6, lumberMill: 0, quarry: 4, goldMine: 0 };
        settlement.resources = { food: 300_000, wood: 125_000, stone: 100_000, gold: 0 };
      }),
    );
    expect(view(stalled).constructions.planned[0]?.waiting?.etaSeconds).toBeNull();
    expect(view(stalled).winter?.firewood).toMatchObject({ reserved: 0, missing: 0 });
    expect(coldAt(stalled)).toBeUndefined();
    // A que só começaria depois da primavera também não: até lá a lareira já apagou.
    const late = planned(fief(WINTER + 11 * DAY + HOUR, 125));
    expect(view(late).winter?.firewood).toMatchObject({ reserved: 0, missing: 0 });
    expect(coldAt(late)).toBeUndefined();
  });

  it('duas obras automáticas: a conta soma as que o estoque paga, na ordem em que começam', () => {
    const both = (wood: number) =>
      accept(
        planned(fief(WINTER + HOUR, wood)),
        command('planConstruction', { building: 'quarry', autoStart: true }),
      ).state;
    // Com 250 de madeira, as duas começam: a Pedreira leva 120 e a Fazenda, 80.
    const rich = view(both(250)).winter?.firewood;
    expect(rich).toMatchObject({ stock: 250, reserved: 200, missing: 65 });
    expect(rich?.text).toContain(
      'há 250 em estoque, mas as obras planejadas levam 200 quando começarem sozinhas: faltam 65 de madeira.',
    );
    expect(coldAt(both(250))).toBeDefined();
    // Com 150, a Pedreira começa primeiro (pede menos ouro) e leva 120; para a Fazenda não
    // sobra madeira, e ela não entra na conta.
    const short = view(both(150)).winter?.firewood;
    expect(short).toMatchObject({ stock: 150, reserved: 120, missing: 85 });
    expect(short?.text).toContain(
      'mas a obra planejada da Pedreira leva 120 quando começar sozinha: faltam 85 de madeira.',
    );
  });
});

describe('prazos com o fator da estação', () => {
  const rich = (atMs: number) =>
    fedAt(atMs, (draft) => {
      draft.settlement.resources = { food: 9e6, wood: 9e6, stone: 9e6, gold: 9e6 };
    });
  const upgrade = (derived: ViewState, building: string) =>
    derived.constructions.available.find((entry) => entry.building === building);

  it('no inverno a obra iniciada dura × 1,5, e a visão diz por quê', () => {
    expect(upgrade(view(rich(WINTER)), 'farm')).toMatchObject({
      durationSeconds: 450,
      durationNote: 'No Inverno, o prazo de uma obra iniciada agora é × 1,5.',
    });
    expect(upgrade(view(rich(WINTER), 3), 'farm')).toMatchObject({ durationSeconds: 150 });
    for (const season of [SPRING, SUMMER, AUTUMN]) {
      expect(upgrade(view(rich(season)), 'farm')).toMatchObject({
        durationSeconds: 300,
        durationNote: null,
      });
    }
  });

  it('as planejadas mostram o prazo de quem começasse agora', () => {
    const planned = accept(rich(WINTER), command('planConstruction', { building: 'housing' }));
    expect(view(planned.state).constructions.planned).toMatchObject([
      {
        building: 'housing',
        durationSeconds: 360,
        durationNote: 'No Inverno, o prazo de uma obra iniciada agora é × 1,5.',
      },
    ]);
  });

  it('o prazo anunciado é o que a obra leva', () => {
    const started = accept(rich(WINTER), command('startConstruction', { building: 'farm' }));
    expect(view(started.state).constructions.active).toMatchObject({
      secondsRemaining: 450,
      totalSeconds: 450,
    });
    expect(advanceTo(started.state, WINTER + 450_000 - 1).state.settlement.buildings.farm).toBe(1);
    expect(advanceTo(started.state, WINTER + 450_000).state.settlement.buildings.farm).toBe(2);
  });

  it('só na primavera o recrutamento tem prazo próprio e a frase que o explica', () => {
    expect(view(rich(SPRING)).recruitment).toMatchObject({
      secondsPerVillager: 960,
      durationNote: 'Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8.',
    });
    for (const season of [SUMMER, AUTUMN, WINTER]) {
      expect(view(rich(season)).recruitment).toMatchObject({
        secondsPerVillager: 1200,
        durationNote: null,
      });
    }
    expect(view(rich(SPRING), 3).recruitment.secondsPerVillager).toBe(320);
  });

  it('o teto de 8 horas vem depois do fator: nem no inverno uma obra passa de uma noite', () => {
    const winterFactor = { num: 3, den: 2 };
    // Mina de Ouro 9→10: 480 s × 1,5⁸ = 12.301 s; no inverno, 18.452 s (5 h 7 min), ainda abaixo do teto.
    expect(upgradeDurationMs('goldMine', 9)).toBe(12_301_875);
    expect(upgradeDurationMs('goldMine', 9, winterFactor)).toBe(18_452_812);
    // Um nível que a tabela ainda não tem: o fator levaria a mais de 8 h, e o teto segura.
    expect(upgradeDurationMs('goldMine', 11)).toBe(27_679_218);
    expect(upgradeDurationMs('goldMine', 11, winterFactor)).toBe(8 * HOUR);
    expect(upgradeDurationMs('goldMine', 30, winterFactor)).toBe(8 * HOUR);
    // É uma conta só: 240 s × 1,5 (nível) × 1,5 (inverno), com um arredondamento.
    expect(upgradeDurationMs('housing', 2, winterFactor)).toBe(540_000);
    expect(upgradeDurationMs('farm', 4, winterFactor)).toBe(1_518_750);
    expect(upgradeDurationMs('farm', 1, winterFactor)).toBe(5 * MINUTE * 1.5);
  });
});
