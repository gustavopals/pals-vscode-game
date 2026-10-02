import { balance, PRODUCTION_BUILDING_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  applyContinuous,
  consumptionRate,
  firewoodRate,
  foodRunsOutIn,
  netRates,
  producedBy,
  productionFactors,
  productionRate,
  storageCap,
  woodRunsOutIn,
} from './economy';
import { cloneState } from './state';
import {
  AUTUMN,
  DAY,
  gameAt,
  gameWith,
  HOUR,
  newGame,
  SPRING,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import type { GameState } from './types';

describe('taxas', () => {
  // Cada conta é feita na estação em que o recurso rende o de tabela (× 1): a comida e o ouro no
  // verão, a madeira e a pedra na primavera. Os fatores das estações estão logo abaixo.
  it('2 trabalhadores na Fazenda Nv1 com 5 habitantes dão +15 comida/h líquida', () => {
    const state = gameAt(SUMMER, (draft) => {
      draft.settlement.workers.farm = 2;
    });
    expect(productionRate(state, 'farm')).toBe(20_000);
    expect(consumptionRate(state)).toBe(5_000);
    expect(netRates(state)).toEqual({ food: 15_000, wood: 0, stone: 0, gold: 0 });
  });

  it('1 hora produz exatamente 15.000 milésimos de comida', () => {
    const state = gameAt(SUMMER, (draft) => {
      draft.settlement.workers.farm = 2;
    });
    const after = advanceTo(state, SUMMER + HOUR).state;
    expect(after.settlement.resources.food).toBe(180_000 + 15_000);
    expect(after.settlement.accumulators.food).toBe(0);
  });

  it('cada nível acima do primeiro soma 20% à produção', () => {
    const edit = (draft: GameState) => {
      draft.settlement.workers = { farm: 4, lumberMill: 1, quarry: 0, goldMine: 0 };
      draft.settlement.buildings.farm = 2;
      draft.settlement.buildings.lumberMill = 6;
    };
    expect(productionRate(gameAt(SUMMER, edit), 'farm')).toBe(48_000);
    expect(productionRate(gameAt(SPRING, edit), 'lumberMill')).toBe(16_000);
  });

  it('as taxas base por trabalhador são 10, 8, 5 e 4', () => {
    const edit = (draft: GameState) => {
      draft.settlement.population.villagers = 4;
      draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
    };
    expect(productionRate(gameAt(SUMMER, edit), 'farm')).toBe(10_000);
    expect(productionRate(gameAt(SPRING, edit), 'lumberMill')).toBe(8_000);
    expect(productionRate(gameAt(SPRING, edit), 'quarry')).toBe(5_000);
    expect(productionRate(gameAt(SUMMER, edit), 'goldMine')).toBe(4_000);
  });

  it('a fome multiplica a produção de todos os edifícios por 0,75', () => {
    const edit = (draft: GameState) => {
      draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
      draft.settlement.famine = { sinceMs: 0 };
    };
    expect(productionRate(gameAt(SUMMER, edit), 'farm')).toBe(7_500);
    expect(productionRate(gameAt(SPRING, edit), 'lumberMill')).toBe(6_000);
    expect(productionRate(gameAt(SPRING, edit), 'quarry')).toBe(3_750);
    expect(productionRate(gameAt(SUMMER, edit), 'goldMine')).toBe(3_000);
  });

  it('ainda não há limite de estoque', () => {
    expect(storageCap()).toBeNull();
  });
});

describe('estações (GDD §4.1)', () => {
  /** Um trabalhador em cada edifício, todos no nível 1, com 4 habitantes. */
  const oneEach = (atMs: number, edit: (draft: GameState) => void = () => {}) =>
    gameAt(atMs, (draft) => {
      draft.settlement.population.villagers = 4;
      draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
      edit(draft);
    });
  const production = (state: GameState) =>
    Object.fromEntries(
      PRODUCTION_BUILDING_IDS.map((building) => [building, productionRate(state, building)]),
    );

  it.each([
    ['primavera', SPRING, { farm: 12_000, lumberMill: 8_000, quarry: 5_000, goldMine: 4_000 }],
    ['verão', SUMMER, { farm: 10_000, lumberMill: 9_200, quarry: 5_750, goldMine: 4_000 }],
    ['outono', AUTUMN, { farm: 13_000, lumberMill: 8_000, quarry: 5_000, goldMine: 4_400 }],
    ['inverno', WINTER, { farm: 4_000, lumberMill: 6_400, quarry: 4_000, goldMine: 4_000 }],
  ])('%s: a produção de um trabalhador, em milésimos por hora', (_, season, expected) => {
    expect(production(oneEach(season))).toEqual(expected);
    // No último milissegundo da estação a taxa ainda é a dela.
    const lastDay = season === WINTER ? 12 : 24;
    expect(production(oneEach(season + lastDay * DAY - 1))).toEqual(expected);
    // E a tabela se repete no ano seguinte.
    expect(production(oneEach(YEAR + season))).toEqual(expected);
  });

  it('o saldo de cada estação desconta a comida e, no inverno, a lenha', () => {
    expect(netRates(oneEach(SPRING))).toEqual({
      food: 8_000,
      wood: 8_000,
      stone: 5_000,
      gold: 4_000,
    });
    expect(netRates(oneEach(SUMMER))).toEqual({
      food: 6_000,
      wood: 9_200,
      stone: 5_750,
      gold: 4_000,
    });
    expect(netRates(oneEach(AUTUMN))).toEqual({
      food: 9_000,
      wood: 8_000,
      stone: 5_000,
      gold: 4_400,
    });
    // Inverno: 4 − 4 de comida; 6,4 − 4 × 0,5 de lenha.
    expect(netRates(oneEach(WINTER))).toEqual({ food: 0, wood: 4_400, stone: 4_000, gold: 4_000 });
  });

  it('a lenha é 0,5 de madeira por habitante por hora, só no inverno', () => {
    const crowd = (atMs: number) =>
      gameAt(atMs, (draft) => {
        draft.settlement.population.villagers = 18;
      });
    expect(firewoodRate(crowd(WINTER))).toBe(9_000);
    expect(firewoodRate(crowd(WINTER + 12 * DAY - 1))).toBe(9_000);
    for (const season of [SPRING, SUMMER, AUTUMN, YEAR]) {
      expect(firewoodRate(crowd(season))).toBe(0);
    }
    expect(netRates(crowd(WINTER)).wood).toBe(-9_000);
  });

  it('o frio multiplica a produção de todos os edifícios por 0,8', () => {
    const cold = oneEach(WINTER, (draft) => {
      draft.settlement.cold = { sinceMs: WINTER };
    });
    // Inverno × frio: 10 × 0,4 × 0,8; 8 × 0,8 × 0,8; 5 × 0,8 × 0,8; 4 × 0,8.
    expect(production(cold)).toEqual({
      farm: 3_200,
      lumberMill: 5_120,
      quarry: 3_200,
      goldMine: 3_200,
    });
  });

  it('é uma conta só: nível, estação, fome e frio multiplicados e um arredondamento no fim', () => {
    const state = oneEach(WINTER, (draft) => {
      draft.settlement.workers.farm = 7;
      draft.settlement.population.villagers = 10;
      draft.settlement.buildings.farm = 3;
      draft.settlement.famine = { sinceMs: WINTER };
      draft.settlement.cold = { sinceMs: WINTER };
    });
    // 7 × 10 × 1,4 (Nv3) × 0,4 (inverno) × 0,75 (fome) × 0,8 (frio) = 23,52.
    expect(productionRate(state, 'farm')).toBe(23_520);
    expect(productionFactors(state, 'farm')).toEqual([
      { id: 'level', ratio: { num: 14, den: 10 }, label: 'Nv3' },
      { id: 'season', ratio: { num: 2, den: 5 }, label: 'inverno' },
      { id: 'famine', ratio: { num: 3, den: 4 }, label: 'fome' },
      { id: 'cold', ratio: { num: 4, den: 5 }, label: 'frio' },
    ]);
  });

  it('a taxa é o piso da fração exata, em qualquer combinação de fatores', () => {
    // Confere contra a conta em inteiros grandes: a ordem dos fatores não importa e nada é
    // arredondado no meio do caminho.
    for (const season of [SPRING, SUMMER, AUTUMN, WINTER]) {
      for (const famine of [false, true]) {
        for (const cold of [false, true]) {
          for (let level = 1; level <= 10; level += 1) {
            for (const building of PRODUCTION_BUILDING_IDS) {
              const workers = 1 + ((level * 7) % 13);
              const state = gameAt(season, (draft) => {
                draft.settlement.population.villagers = 20;
                draft.settlement.workers[building] = workers;
                draft.settlement.buildings[building] = level;
                draft.settlement.famine = famine ? { sinceMs: season } : null;
                draft.settlement.cold = cold ? { sinceMs: season } : null;
              });
              const factors = productionFactors(state, building);
              // Do último para o primeiro, de propósito.
              const exact = [...factors].reverse().reduce(
                (fraction, { ratio }) => ({
                  num: fraction.num * BigInt(ratio.num),
                  den: fraction.den * BigInt(ratio.den),
                }),
                {
                  num: BigInt(workers * balance.production.perWorkerPerHour[building] * 1000),
                  den: 1n,
                },
              );
              expect(BigInt(productionRate(state, building))).toBe(exact.num / exact.den);
            }
          }
        }
      }
    }
  });

  it('a virada vale no instante exato: um milissegundo antes ainda é a estação anterior', () => {
    const start = oneEach(SUMMER - HOUR);
    const before = advanceTo(start, SUMMER - 1);
    expect(netRates(before.state)).toEqual(netRates(oneEach(SPRING)));
    expect(before.events.filter((event) => event.type === 'seasonChanged')).toEqual([]);

    const at = advanceTo(before.state, SUMMER);
    expect(netRates(at.state)).toEqual(netRates(oneEach(SUMMER)));
    expect(at.events.filter((event) => event.type === 'seasonChanged')).toMatchObject([
      { atMs: SUMMER, data: { season: 'summer' } },
    ]);

    const after = advanceTo(at.state, SUMMER + 1);
    expect(netRates(after.state)).toEqual(netRates(oneEach(SUMMER)));
    expect(after.events).toEqual([]);
  });

  it('uma hora antes e uma hora depois da virada rendem, cada uma, a taxa da sua estação', () => {
    const start = oneEach(SUMMER - HOUR);
    const { resources } = advanceTo(start, SUMMER + HOUR).state.settlement;
    // Primavera: +8 comida, +8 madeira, +5 pedra, +4 ouro. Verão: +6, +9,2, +5,75 e +4.
    expect(resources).toEqual({
      food: 180_000 + 8_000 + 6_000,
      wood: 120_000 + 8_000 + 9_200,
      stone: 65_000 + 5_000 + 5_750,
      gold: 250_000 + 4_000 + 4_000,
    });
    // E o mesmo com o intervalo cortado em qualquer lugar, inclusive em cima da virada.
    for (const cut of [SUMMER - HOUR + 1, SUMMER - 1, SUMMER, SUMMER + 1, SUMMER + HOUR - 1]) {
      const split = advanceTo(advanceTo(start, cut).state, SUMMER + HOUR).state;
      expect(split).toStrictEqual(advanceTo(start, SUMMER + HOUR).state);
    }
  });

  it('nenhuma taxa de hoje é truncada: o arredondamento só existe para os fatores que vêm', () => {
    for (const season of balance.calendar.seasons) {
      for (const building of PRODUCTION_BUILDING_IDS) {
        const { num, den } = season.effects.production[producedBy(building)];
        const famine = balance.famine.productionMultiplier;
        const cold = balance.winter.cold.productionMultiplier;
        const base = balance.production.perWorkerPerHour[building] * 1000;
        for (let level = 1; level <= 10; level += 1) {
          const bonus =
            balance.production.levelBonus.den + balance.production.levelBonus.num * (level - 1);
          const top = base * bonus * num * famine.num * cold.num;
          const bottom = balance.production.levelBonus.den * den * famine.den * cold.den;
          expect(top % bottom, `${season.id} ${building} Nv${level}`).toBe(0);
        }
      }
    }
  });
});

describe('acumuladores', () => {
  it('guardam o resto que ainda não completou um milésimo', () => {
    const state = gameWith((draft) => {
      draft.settlement.workers.goldMine = 1;
    });
    const draft = cloneState(state);
    applyContinuous(draft, 1);
    // 4.000 milésimos/h × 1 ms: nada chega ao estoque ainda.
    expect(draft.settlement.resources.gold).toBe(250_000);
    expect(draft.settlement.accumulators.gold).toBe(4_000);
    applyContinuous(draft, 899);
    expect(draft.settlement.resources.gold).toBe(250_001);
    expect(draft.settlement.accumulators.gold).toBe(0);
  });

  it('duração zero ou negativa não altera nada', () => {
    const draft = cloneState(newGame());
    applyContinuous(draft, 0);
    applyContinuous(draft, -5);
    expect(draft).toEqual(newGame());
  });

  it('na fome a comida fica em zero em vez de ficar negativa', () => {
    const draft = gameWith((state) => {
      state.settlement.resources.food = 0;
      state.settlement.famine = { sinceMs: 0 };
    });
    applyContinuous(draft, 10 * HOUR);
    expect(draft.settlement.resources.food).toBe(0);
    expect(draft.settlement.accumulators.food).toBe(0);
  });

  it('no frio a madeira fica em zero em vez de ficar negativa', () => {
    const draft = gameAt(WINTER, (state) => {
      state.settlement.workers.farm = 5;
      state.settlement.resources.wood = 0;
      state.settlement.cold = { sinceMs: WINTER };
    });
    applyContinuous(draft, 10 * HOUR);
    expect(draft.settlement.resources.wood).toBe(0);
    expect(draft.settlement.accumulators.wood).toBe(0);
  });
});

describe('woodRunsOutIn', () => {
  const winter = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(WINTER, (draft) => {
      draft.settlement.workers.farm = 5;
      edit(draft);
    });

  it('120 de madeira com 5 habitantes sem lenhadores duram exatamente 48 horas de inverno', () => {
    expect(woodRunsOutIn(winter())).toBe(48 * HOUR);
  });

  it('é nulo fora do inverno, com a Serraria cobrindo a lenha e depois que o frio começou', () => {
    expect(woodRunsOutIn(gameAt(AUTUMN))).toBeNull();
    expect(woodRunsOutIn(gameAt(SPRING))).toBeNull();
    // Um lenhador rende 6,4 no inverno; a lenha de 5 habitantes é 2,5.
    const covered = winter((draft) => {
      draft.settlement.workers = { farm: 4, lumberMill: 1, quarry: 0, goldMine: 0 };
    });
    expect(woodRunsOutIn(covered)).toBeNull();
    const cold = winter((draft) => {
      draft.settlement.resources.wood = 0;
      draft.settlement.cold = { sinceMs: WINTER };
    });
    expect(woodRunsOutIn(cold)).toBeNull();
  });

  it('desconta o tempo já avançado, ao milissegundo, e nunca é negativo', () => {
    const later = advanceTo(winter(), WINTER + 1_234_567).state;
    expect(woodRunsOutIn(later)).toBe(48 * HOUR - 1_234_567);
    const owing = winter((draft) => {
      draft.settlement.resources.wood = 0;
      draft.settlement.accumulators.wood = -100;
    });
    expect(woodRunsOutIn(owing)).toBe(0);
  });
});

describe('foodRunsOutIn', () => {
  it('é nulo quando a comida não cai ou a fome já começou', () => {
    const fed = gameWith((draft) => {
      draft.settlement.workers.farm = 1;
    });
    expect(foodRunsOutIn(fed)).toBeNull();
    const starving = gameWith((draft) => {
      draft.settlement.famine = { sinceMs: 0 };
    });
    expect(foodRunsOutIn(starving)).toBeNull();
  });

  it('180 de comida com 5 habitantes sem fazendeiros duram exatamente 36 horas', () => {
    expect(foodRunsOutIn(newGame())).toBe(36 * HOUR);
  });

  it('desconta o tempo já avançado, ao milissegundo', () => {
    const later = advanceTo(newGame(), 1_234_567).state;
    expect(foodRunsOutIn(later)).toBe(36 * HOUR - 1_234_567);
  });

  it('nunca é negativo, mesmo com o acumulador devedor', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.accumulators.food = -100;
    });
    expect(foodRunsOutIn(state)).toBe(0);
  });
});
