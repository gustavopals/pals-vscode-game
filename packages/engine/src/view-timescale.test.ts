import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  command,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  objectivesScenario,
} from './test-helpers';
import type { GameState, ViewState } from './types';
import { deriveViewState } from './view';

const SECOND = 1000;

/** Segundos reais de uma duração em ms de jogo, arredondados para cima. */
const ceilReal = (gameMs: number, timeScale: number) => Math.ceil(gameMs / timeScale / SECOND);
const floorReal = (gameMs: number, timeScale: number) => Math.floor(gameMs / timeScale / SECOND);

const farmers = accept(newGame(), command('setWorkers', { building: 'farm', count: 2 })).state;

/** Obra na Fazenda (300 s de jogo), 3 aldeões a caminho (1200 s cada) e o Nv3 da Fazenda planejado. */
function busy(): GameState {
  let state = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
  state = accept(state, command('recruitVillagers', { quantity: 3 })).state;
  return accept(state, command('planConstruction', { building: 'farm' })).state;
}

/** Fome desde o minuto 12, com um aldeão na fila congelada (o mesmo cenário de view.test.ts). */
function starving(): GameState {
  return accept(
    gameWith((draft) => {
      draft.settlement.resources.food = 51_000;
      draft.settlement.workers.lumberMill = 1;
    }),
    command('recruitVillagers', { quantity: 1 }),
  ).state;
}

/** Nível 2 e 18 bocas: o cenário do GDD §13.3, com bônus de nível na explicação. */
function leveled(): GameState {
  return gameWith((draft) => {
    draft.settlement.population.villagers = 18;
    draft.settlement.workers.farm = 4;
    draft.settlement.buildings.farm = 2;
  });
}

function activeOf(view: ViewState) {
  const { active } = view.constructions;
  if (active === null) {
    throw new Error('O teste esperava uma obra em andamento.');
  }
  return active;
}

function foodOf(view: ViewState) {
  const food = view.resources.find((row) => row.id === 'food');
  if (food === undefined) {
    throw new Error('A visão não trouxe a comida.');
  }
  return food;
}

/** Número escrito com vírgula decimal nos textos de explicação. */
const written = (text: string | undefined) => Number((text ?? '').replace(',', '.'));

/** Lê "4 trabalhadores × 30 × 1,2 (Nv2) × 0,75 (fome) = 144/h". */
function readProduction(text: string) {
  const match =
    /^(\d+) trabalhador(?:es)? × ([\d,]+) × ([\d,]+) \(Nv\d+\)(?: × ([\d,]+) \(fome\))? = ([\d,]+)\/h$/.exec(
      text,
    );
  if (match === null) {
    throw new Error(`Explicação de produção fora do formato: ${text}`);
  }
  return {
    hands: Number(match[1]),
    perWorker: written(match[2]),
    bonus: written(match[3]),
    penalty: match[4] === undefined ? 1 : written(match[4]),
    total: written(match[5]),
  };
}

/** Lê "consumo 18 × 3 = 54/h". */
function readConsumption(text: string) {
  const match = /consumo (\d+) × ([\d,]+) = ([\d,]+)\/h$/.exec(text);
  if (match === null) {
    throw new Error(`Explicação de consumo fora do formato: ${text}`);
  }
  return { mouths: Number(match[1]), perVillager: written(match[2]), total: written(match[3]) };
}

describe('deriveViewState sem ritmo ou no ritmo 1', () => {
  const cases: Array<[string, GameState, number]> = [
    ['estado inicial', newGame(), 0],
    ['primeira alocação', farmers, 0],
    ['obra, fila e plano em um instante quebrado', busy(), 100_001],
    ['fome', starving(), HOUR + 1],
    ['fim do cenário dos objetivos', objectivesScenario().state, 7 * HOUR],
  ];

  it.each(cases)('%s: o resultado é o de antes', (_name, state, at) => {
    const plain = deriveViewState(state, at);
    expect(deriveViewState(state, at, {})).toStrictEqual(plain);
    expect(deriveViewState(state, at, { timeScale: 1 })).toStrictEqual(plain);
  });

  it('a opção não faz a entrada ser mutada', () => {
    const state = busy();
    const before = JSON.stringify(state);
    deriveViewState(state, 100_001, { timeScale: 3 });
    expect(JSON.stringify(state)).toBe(before);
  });
});

describe('deriveViewState no ritmo 3: prazos em segundos reais, arredondados para cima', () => {
  // 100.001 ms de jogo: nenhum prazo restante é múltiplo de 3 s, então o arredondamento aparece.
  const at = 100_001;
  const state = busy();
  const game = deriveViewState(state, at);
  const real = deriveViewState(state, at, { timeScale: 3 });

  it('obra ativa: o que falta e o total', () => {
    expect(activeOf(game)).toMatchObject({ secondsRemaining: 200, totalSeconds: 300 });
    // (300.000 − 100.001) ms ÷ 3 = 66,67 s: para cima dá 67.
    expect(activeOf(real)).toMatchObject({ secondsRemaining: 67, totalSeconds: 100 });
  });

  it('melhorias disponíveis e planejadas: a duração é a de jogo dividida por 3', () => {
    expect(real.constructions.available.length).toBeGreaterThan(0);
    expect(real.constructions.available.map((entry) => entry.durationSeconds)).toEqual(
      game.constructions.available.map((entry) => ceilReal(entry.durationSeconds * SECOND, 3)),
    );
    expect(game.constructions.planned.map((entry) => entry.durationSeconds)).toEqual([450]);
    expect(real.constructions.planned.map((entry) => entry.durationSeconds)).toEqual([150]);
  });

  it('recrutamento: tempo por aldeão e chegada do próximo', () => {
    expect(game.recruitment.secondsPerVillager).toBe(1200);
    expect(real.recruitment.secondsPerVillager).toBe(400);
    const next = state.settlement.recruitmentQueue[0];
    expect(next?.finishesAtMs).toBe(20 * MINUTE);
    // (1.200.000 − 100.001) ms ÷ 3 = 366,67 s.
    expect(real.population.secondsToNextRecruit).toBe(367);
  });

  it('calendário: virada do dia e da estação', () => {
    expect(game.calendar).toMatchObject({ secondsToNextDay: 7100, secondsToNextSeason: 172_700 });
    // (7.200.000 − 100.001) ÷ 3 = 2.366,67 s; (172.800.000 − 100.001) ÷ 3 = 57.566,67 s.
    expect(real.calendar).toMatchObject({ secondsToNextDay: 2367, secondsToNextSeason: 57_567 });
  });

  it('em instantes redondos a divisão é exata', () => {
    const round = deriveViewState(state, 2 * MINUTE, { timeScale: 3 });
    expect(activeOf(round)).toMatchObject({ secondsRemaining: 60, totalSeconds: 100 });
    expect(round.population.secondsToNextRecruit).toBe(360);
    expect(round.calendar).toMatchObject({ secondsToNextDay: 2360, secondsToNextSeason: 57_560 });
  });

  it.each([3, 7, 2.5, 0.5])('ritmo %d: todo prazo sai do prazo de jogo, para cima', (timeScale) => {
    const scaled = deriveViewState(state, at, { timeScale });
    const active = state.settlement.constructionQueues[0];
    const next = state.settlement.recruitmentQueue[0];
    if (active === undefined || active === null || next === undefined) {
      throw new Error('O cenário perdeu a obra ou a fila.');
    }
    expect(activeOf(scaled).secondsRemaining).toBe(ceilReal(active.finishesAtMs - at, timeScale));
    expect(activeOf(scaled).totalSeconds).toBe(
      ceilReal(active.finishesAtMs - active.startedAtMs, timeScale),
    );
    expect(scaled.population.secondsToNextRecruit).toBe(
      ceilReal(next.finishesAtMs - at, timeScale),
    );
    expect(scaled.calendar.secondsToNextDay).toBe(ceilReal(2 * HOUR - at, timeScale));
    expect(scaled.calendar.secondsToNextSeason).toBe(ceilReal(48 * HOUR - at, timeScale));
    expect(scaled.recruitment.secondsPerVillager).toBe(ceilReal(20 * MINUTE, timeScale));
    expect(scaled.constructions.available.map((entry) => entry.durationSeconds)).toEqual(
      game.constructions.available.map((entry) =>
        ceilReal(entry.durationSeconds * SECOND, timeScale),
      ),
    );
    expect(scaled.constructions.planned.map((entry) => entry.durationSeconds)).toEqual(
      game.constructions.planned.map((entry) =>
        ceilReal(entry.durationSeconds * SECOND, timeScale),
      ),
    );
  });

  it('o que não é prazo nem taxa não muda com o ritmo', () => {
    expect(real.settlement).toEqual(game.settlement);
    expect(real.objectives).toEqual(game.objectives);
    expect(real.pendingDecisions).toEqual(game.pendingDecisions);
    expect(real.resources.map((row) => [row.id, row.stock, row.cap])).toEqual(
      game.resources.map((row) => [row.id, row.stock, row.cap]),
    );
    expect(real.workers.map((row) => [row.building, row.level, row.assigned])).toEqual(
      game.workers.map((row) => [row.building, row.level, row.assigned]),
    );
    expect({
      ...real.calendar,
      secondsToNextDay: 0,
      secondsToNextSeason: 0,
    }).toEqual({ ...game.calendar, secondsToNextDay: 0, secondsToNextSeason: 0 });
    expect(real.constructions.available.map((entry) => [entry.building, entry.cost])).toEqual(
      game.constructions.available.map((entry) => [entry.building, entry.cost]),
    );
    expect(activeOf(real).refund).toEqual(activeOf(game).refund);
    expect(real.recruitment.cost).toEqual(game.recruitment.cost);
    expect(real.recruitment.maxQuantity).toBe(game.recruitment.maxQuantity);
  });
});

describe('deriveViewState com ritmo: o que arredonda para baixo', () => {
  it('depletesInSeconds: a comida acaba no ritmo do relógio do jogador', () => {
    const initial = newGame();
    expect(foodOf(deriveViewState(initial, 0)).depletesInSeconds).toBe(36 * 3600);
    expect(foodOf(deriveViewState(initial, 0, { timeScale: 3 })).depletesInSeconds).toBe(12 * 3600);
    // 129.600 s ÷ 7 = 18.514,29 s: para baixo.
    expect(foodOf(deriveViewState(initial, 0, { timeScale: 7 })).depletesInSeconds).toBe(18_514);
    // Um instante quebrado: restam 129.599.999 ms de jogo, ou 43.199,99 s reais no ritmo 3.
    expect(foodOf(deriveViewState(initial, 1, { timeScale: 3 })).depletesInSeconds).toBe(43_199);
    expect(foodOf(deriveViewState(farmers, 0, { timeScale: 3 })).depletesInSeconds).toBeNull();
  });

  it('famine.secondsElapsed: o tempo de fome em segundos reais', () => {
    const state = starving();
    expect(deriveViewState(state, HOUR).famine).toMatchObject({ secondsElapsed: 2880 });
    expect(deriveViewState(state, HOUR, { timeScale: 3 }).famine).toMatchObject({
      sinceMs: 12 * MINUTE,
      secondsElapsed: 960,
    });
    // 2.880.001 ms ÷ 3 = 960,0003 s e 2.882.999 ms ÷ 3 = 960,99 s: os dois dão 960.
    expect(deriveViewState(state, HOUR + 1, { timeScale: 3 }).famine?.secondsElapsed).toBe(960);
    expect(deriveViewState(state, HOUR + 2999, { timeScale: 3 }).famine?.secondsElapsed).toBe(960);
    expect(deriveViewState(state, HOUR + 3000, { timeScale: 3 }).famine?.secondsElapsed).toBe(961);
    expect(deriveViewState(state, HOUR, { timeScale: 7 }).famine?.secondsElapsed).toBe(
      floorReal(48 * MINUTE, 7),
    );
    // A fila congelada continua sem prazo, em qualquer ritmo.
    expect(
      deriveViewState(state, HOUR, { timeScale: 3 }).population.secondsToNextRecruit,
    ).toBeNull();
  });
});

describe('deriveViewState no ritmo 3: taxas por hora real', () => {
  it('perHour, grossPerHour e perWorkerPerHour são o triplo', () => {
    const state = leveled();
    const game = deriveViewState(state, 0);
    const real = deriveViewState(state, 0, { timeScale: 3 });
    expect(game.workers[0]).toMatchObject({ grossPerHour: 48, perWorkerPerHour: 12 });
    expect(real.workers[0]).toMatchObject({ grossPerHour: 144, perWorkerPerHour: 36 });
    expect(foodOf(game).perHour).toBe(30);
    expect(foodOf(real).perHour).toBe(90);
    for (const [index, row] of real.workers.entries()) {
      expect(row.grossPerHour).toBe((game.workers[index]?.grossPerHour ?? NaN) * 3);
      expect(row.perWorkerPerHour).toBe((game.workers[index]?.perWorkerPerHour ?? NaN) * 3);
    }
    for (const [index, row] of real.resources.entries()) {
      expect(row.perHour).toBe((game.resources[index]?.perHour ?? NaN) * 3);
    }
  });

  it('o estado inicial perde 15 de comida por hora real', () => {
    const real = deriveViewState(newGame(), 0, { timeScale: 3 });
    expect(real.resources.map((row) => [row.id, row.perHour])).toEqual([
      ['food', -15],
      ['wood', 0],
      ['stone', 0],
      ['gold', 0],
    ]);
  });

  it('os textos de explicação falam em horas reais', () => {
    const real = deriveViewState(leveled(), 0, { timeScale: 3 });
    expect(foodOf(real).breakdown).toBe(
      'Fazenda: 4 trabalhadores × 30 × 1,2 (Nv2) = 144/h; consumo 18 × 3 = 54/h',
    );
    expect(real.workers[0]?.breakdown).toBe('4 trabalhadores × 30 × 1,2 (Nv2) = 144/h');
    expect(real.workers[1]?.breakdown).toBe('0 trabalhadores × 24 × 1 (Nv1) = 0/h');
    expect(deriveViewState(starving(), HOUR, { timeScale: 3 }).workers[1]?.breakdown).toBe(
      '1 trabalhador × 24 × 1 (Nv1) × 0,75 (fome) = 18/h',
    );
  });

  const states: Array<[string, GameState, number]> = [
    ['inicial', newGame(), 0],
    ['fazendeiros', farmers, 0],
    ['nível 2', leveled(), 0],
    ['fome', starving(), HOUR],
    ['objetivos', objectivesScenario().state, 7 * HOUR],
  ];
  const scenarios = states.flatMap(([name, state, at]) =>
    [1, 3, 0.5, 2].map((timeScale): [string, number, GameState, number] => [
      name,
      timeScale,
      state,
      at,
    ]),
  );

  it.each(scenarios)(
    '%s no ritmo %d: os textos batem com os números',
    (_name, timeScale, state, at) => {
      const derived = deriveViewState(state, at, { timeScale });
      for (const row of derived.workers) {
        const text = readProduction(row.breakdown);
        expect(text.hands).toBe(row.assigned);
        expect(text.total).toBeCloseTo(row.grossPerHour, 2);
        // Os fatores escritos, multiplicados, dão o total escrito.
        expect(text.hands * text.perWorker * text.bonus * text.penalty).toBeCloseTo(text.total, 1);
        // Sem fome, "por trabalhador × bônus" é o que a visão diz que um trabalhador rende.
        if (text.penalty === 1) {
          expect(text.perWorker * text.bonus).toBeCloseTo(row.perWorkerPerHour, 1);
        }
        const resource = derived.resources.find((entry) => entry.id === row.resource);
        expect(resource?.breakdown.startsWith(`${row.label}: ${row.breakdown}`)).toBe(true);
        if (row.resource !== 'food') {
          expect(resource?.perHour).toBeCloseTo(row.grossPerHour, 1);
        }
      }
      const food = foodOf(derived);
      const consumption = readConsumption(food.breakdown);
      const farm = derived.workers.find((row) => row.resource === 'food');
      expect(consumption.mouths).toBe(derived.population.villagers);
      expect(consumption.mouths * consumption.perVillager).toBeCloseTo(consumption.total, 2);
      // A taxa líquida da comida é a produção menos o consumo que o texto anuncia.
      expect((farm?.grossPerHour ?? NaN) - consumption.total).toBeCloseTo(food.perHour, 1);
    },
  );
});

describe('deriveViewState com ritmo: o prazo anunciado é cumprido', () => {
  const scales = [3, 7, 2.5, 0.5, 1];
  const instants = [0, 1, 999, 100_001, 2 * MINUTE, 299_999];

  it.each(scales)('ritmo %d: a obra termina em N segundos reais e não antes', (timeScale) => {
    const state = busy();
    for (const at of instants) {
      const seen = deriveViewState(state, at, { timeScale });
      const n = activeOf(seen).secondsRemaining;
      expect(n).toBeGreaterThan(0);
      // N segundos reais são N × ritmo segundos de jogo.
      const done = advanceTo(state, at + n * SECOND * timeScale).state;
      expect(done.settlement.buildings.farm).toBe(2);
      const almost = advanceTo(state, at + (n - 1) * SECOND * timeScale).state;
      expect(almost.settlement.buildings.farm).toBe(1);
      expect(
        deriveViewState(almost, almost.lastProcessedAt, { timeScale }).constructions.active,
      ).toMatchObject({ building: 'farm', targetLevel: 2 });
    }
  });

  it.each(scales)('ritmo %d: o aldeão chega em N segundos reais e não antes', (timeScale) => {
    const state = busy();
    for (const at of instants) {
      const n = deriveViewState(state, at, { timeScale }).population.secondsToNextRecruit;
      if (n === null) {
        throw new Error('O teste esperava um aldeão a caminho.');
      }
      expect(advanceTo(state, at + n * SECOND * timeScale).state.settlement.population).toEqual({
        villagers: 6,
      });
      expect(
        advanceTo(state, at + (n - 1) * SECOND * timeScale).state.settlement.population,
      ).toEqual({ villagers: 5 });
    }
  });

  it.each(scales)('ritmo %d: o dia vira em N segundos reais e não antes', (timeScale) => {
    for (const at of instants) {
      const n = deriveViewState(newGame(), at, { timeScale }).calendar.secondsToNextDay;
      const after = deriveViewState(newGame(), at + n * SECOND * timeScale, { timeScale });
      const before = deriveViewState(newGame(), at + (n - 1) * SECOND * timeScale, { timeScale });
      expect(after.calendar.dayOfSeason).toBe(2);
      expect(before.calendar.dayOfSeason).toBe(1);
    }
  });

  it('a comida não acaba antes do prazo anunciado', () => {
    for (const timeScale of scales) {
      for (const at of instants) {
        const n = foodOf(deriveViewState(newGame(), at, { timeScale })).depletesInSeconds;
        if (n === null) {
          throw new Error('O teste esperava comida acabando.');
        }
        // Arredondado para baixo: em N segundos reais ainda não há fome; um segundo depois, há.
        const gameMs = at + n * SECOND * timeScale;
        expect(advanceTo(newGame(), gameMs - 1).state.settlement.famine).toBeNull();
        expect(
          advanceTo(newGame(), gameMs + SECOND * timeScale).state.settlement.famine,
        ).not.toBeNull();
      }
    }
  });

  it('progressPercent não depende do ritmo', () => {
    const state = busy();
    for (const at of instants) {
      const percent = activeOf(deriveViewState(state, at)).progressPercent;
      for (const timeScale of scales) {
        expect(activeOf(deriveViewState(state, at, { timeScale })).progressPercent).toBe(percent);
      }
    }
    expect(activeOf(deriveViewState(state, 2 * MINUTE, { timeScale: 3 })).progressPercent).toBe(40);
  });
});

describe('deriveViewState no ritmo 0,5', () => {
  it('prazos dobram e taxas caem pela metade', () => {
    const state = accept(farmers, command('startConstruction', { building: 'farm' })).state;
    const slow = deriveViewState(state, 2 * MINUTE, { timeScale: 0.5 });
    expect(activeOf(slow)).toMatchObject({
      secondsRemaining: 360,
      totalSeconds: 600,
      progressPercent: 40,
    });
    expect(slow.recruitment.secondsPerVillager).toBe(2400);
    expect(slow.calendar).toMatchObject({ secondsToNextDay: 14_160 });
    expect(slow.workers[0]).toMatchObject({ grossPerHour: 10, perWorkerPerHour: 5 });
    expect(foodOf(slow)).toMatchObject({ perHour: 7.5, depletesInSeconds: null });
    expect(foodOf(slow).breakdown).toBe(
      'Fazenda: 2 trabalhadores × 5 × 1 (Nv1) = 10/h; consumo 5 × 0,5 = 2,5/h',
    );
    expect(foodOf(deriveViewState(newGame(), 0, { timeScale: 0.5 })).depletesInSeconds).toBe(
      72 * 3600,
    );
  });
});

describe('deriveViewState com ritmo inválido', () => {
  it.each([0, -1, -0.5, NaN, Infinity, -Infinity])('ritmo %d lança', (timeScale) => {
    expect(() => deriveViewState(newGame(), 0, { timeScale })).toThrow(/Ritmo inválido/);
  });
});

describe('população: lugares ocupados e vagas', () => {
  const check = (view: ViewState) => {
    const { housed, vacancies, capacity, villagers, inTraining } = view.population;
    expect(housed + vacancies).toBe(capacity);
    expect(housed).toBe(villagers + inTraining);
    expect(vacancies).toBeGreaterThanOrEqual(0);
  };

  it('sem ninguém a caminho: ocupados são os moradores', () => {
    const initial = deriveViewState(newGame(), 0);
    expect(initial.population).toMatchObject({ housed: 5, vacancies: 5, capacity: 10 });
    check(initial);
  });

  it('com aldeões a caminho: eles já ocupam lugar', () => {
    const queued = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    const waiting = deriveViewState(queued, 5 * MINUTE);
    expect(waiting.population).toMatchObject({
      villagers: 5,
      inTraining: 3,
      housed: 8,
      vacancies: 2,
      capacity: 10,
    });
    check(waiting);
    // Um chegou: muda quem mora e quem está a caminho, não os lugares ocupados.
    const oneArrived = deriveViewState(queued, 20 * MINUTE);
    expect(oneArrived.population).toMatchObject({
      villagers: 6,
      inTraining: 2,
      housed: 8,
      vacancies: 2,
    });
    check(oneArrived);
    const allArrived = deriveViewState(queued, HOUR);
    expect(allArrived.population).toMatchObject({ villagers: 8, inTraining: 0, housed: 8 });
    check(allArrived);
  });

  it('com a casa cheia e depois de ampliar as Habitações', () => {
    const full = accept(
      gameWith((draft) => {
        draft.settlement.resources.food = 400_000;
      }),
      command('recruitVillagers', { quantity: 5 }),
    ).state;
    expect(deriveViewState(full, 0).population).toMatchObject({ housed: 10, vacancies: 0 });
    check(deriveViewState(full, 0));
    const end = objectivesScenario().state;
    check(deriveViewState(end, end.lastProcessedAt));
  });

  it('os lugares não dependem do ritmo', () => {
    const queued = accept(newGame(), command('recruitVillagers', { quantity: 3 })).state;
    const game = deriveViewState(queued, 5 * MINUTE).population;
    const real = deriveViewState(queued, 5 * MINUTE, { timeScale: 3 }).population;
    expect([real.housed, real.vacancies, real.capacity]).toEqual([
      game.housed,
      game.vacancies,
      game.capacity,
    ]);
    expect(real.breakdown).toBe(game.breakdown);
  });
});
