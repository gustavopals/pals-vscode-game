import { balance, PRODUCTION_BUILDING_IDS } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { experienceChange, masteryRatio, occupancyOf, occupiedFrom } from './craft';
import {
  applyContinuous,
  consumptionRate,
  effectiveWorkers,
  firewoodRate,
  foodRunsOutIn,
  netRates,
  producedBy,
  productionFactors,
  productionRate,
  woodRunsOutIn,
} from './economy';
import { cloneState } from './state';
import {
  accept,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  experienced,
  famineSince,
  FED_MORALE,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  play,
  spirited,
  SPRING,
  starve,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import type { GameEvent, GameState, ProductionBuildingId } from './types';

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
      starve(draft, 0);
    };
    expect(productionRate(gameAt(SUMMER, edit), 'farm')).toBe(7_500);
    expect(productionRate(gameAt(SPRING, edit), 'lumberMill')).toBe(6_000);
    expect(productionRate(gameAt(SPRING, edit), 'quarry')).toBe(3_750);
    expect(productionRate(gameAt(SUMMER, edit), 'goldMine')).toBe(3_000);
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

  it('é uma conta só: nível, mestria, estação, moral, fome e frio multiplicados e um arredondamento no fim', () => {
    const state = oneEach(WINTER, (draft) => {
      draft.settlement.workers.farm = 7;
      draft.settlement.population.villagers = 10;
      draft.settlement.buildings.farm = 3;
      starve(draft, WINTER);
      draft.settlement.cold = { sinceMs: WINTER };
    });
    // 7 × 10 × 1,4 (Nv3) × 0,4 (inverno) × 0,75 (fome) × 0,8 (frio) = 23,52.
    expect(productionRate(state, 'farm')).toBe(23_520);
    expect(productionFactors(state, 'farm')).toEqual([
      { id: 'level', ratio: { num: 14, den: 10 }, label: 'Nv3' },
      { id: 'mastery', ratio: { num: 1000, den: 1000 }, label: 'mestria 0' },
      { id: 'season', ratio: { num: 2, den: 5 }, label: 'inverno' },
      // Com a moral na base o fator é 1: está na lista e não muda a conta.
      { id: 'morale', ratio: { num: 800, den: 800 }, label: 'moral 50' },
      { id: 'famine', ratio: { num: 3, den: 4 }, label: 'fome' },
      { id: 'cold', ratio: { num: 4, den: 5 }, label: 'frio' },
    ]);
    // Com experiência 40 entra × 1,12: 26,3424, e o único arredondamento corta o que sobra de
    // um milésimo. Arredondar a cada fator daria outro número.
    const skilled = cloneState(state);
    skilled.settlement.craftExperience.farm = 40;
    expect(productionRate(skilled, 'farm')).toBe(26_342);
  });

  it('a taxa é o piso da fração exata, em qualquer combinação de fatores', () => {
    // Confere contra a conta em inteiros grandes: a ordem dos fatores não importa e nada é
    // arredondado no meio do caminho.
    // A experiência, a adaptação e a moral entram na mesma conta: a mestria e a moral são
    // fatores e quem se adapta vale meio trabalhador.
    for (const season of [SPRING, SUMMER, AUTUMN, WINTER]) {
      for (const famine of [false, true]) {
        for (const cold of [false, true]) {
          for (let level = 1; level <= 10; level += 1) {
            for (const building of PRODUCTION_BUILDING_IDS) {
              const workers = 1 + ((level * 7) % 13);
              const adapting = (level * 5) % (workers + 1);
              const experience = (level * 37 + workers * 11) % 101;
              const morale = (level * 13 + workers * 29) % 101;
              const state = gameAt(season, (draft) => {
                draft.settlement.morale = morale;
                draft.settlement.population.villagers = 20;
                draft.settlement.workers[building] = workers;
                draft.settlement.buildings[building] = level;
                draft.settlement.craftExperience[building] = experience;
                draft.settlement.adaptation =
                  adapting === 0 ? [] : [{ building, count: adapting, untilMs: season + DAY }];
                draft.settlement.famine = famine ? famineSince(season) : null;
                draft.settlement.cold = cold ? { sinceMs: season } : null;
              });
              const factors = productionFactors(state, building);
              const halves = 2 * (workers - adapting) + adapting;
              // Do último para o primeiro, de propósito.
              const exact = [...factors].reverse().reduce(
                (fraction, { ratio }) => ({
                  num: fraction.num * BigInt(ratio.num),
                  den: fraction.den * BigInt(ratio.den),
                }),
                {
                  num: BigInt(halves * balance.production.perWorkerPerHour[building] * 1000),
                  den: 2n,
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

    // A virada da estação é também uma virada de dia: os quatro ofícios, ocupados, ganham 4 de
    // experiência no mesmo instante, e a moral, com a comida guardada, vai a 60.
    const turned = (draft: GameState) => {
      experienced(4)(draft);
      spirited(FED_MORALE)(draft);
    };
    const at = advanceTo(before.state, SUMMER);
    expect(netRates(at.state)).toEqual(netRates(oneEach(SUMMER, turned)));
    expect(at.events.filter((event) => event.type === 'seasonChanged')).toMatchObject([
      { atMs: SUMMER, data: { season: 'summer' } },
    ]);

    const after = advanceTo(at.state, SUMMER + 1);
    expect(netRates(after.state)).toEqual(netRates(oneEach(SUMMER, turned)));
    expect(after.events).toEqual([]);
  });

  it('uma hora antes e uma hora depois da virada rendem, cada uma, a taxa da sua estação', () => {
    const start = oneEach(SUMMER - HOUR);
    const { resources } = advanceTo(start, SUMMER + HOUR).state.settlement;
    // Primavera: +8 comida, +8 madeira, +5 pedra, +4 ouro. Verão: 10, 9,2, 5,75 e 4 de
    // produção, cada uma × 1,012 (os 4 de experiência ganhos na virada) × 1,05 (a moral, que a
    // mesma virada leva a 60), para baixo, menos 4 de consumo.
    expect(resources).toEqual({
      food: 180_000 + 8_000 + 10_626 - 4_000,
      wood: 120_000 + 8_000 + 9_775,
      stone: 65_000 + 5_000 + 6_109,
      gold: 250_000 + 4_000 + 4_250,
    });
    // E o mesmo com o intervalo cortado em qualquer lugar, inclusive em cima da virada.
    for (const cut of [SUMMER - HOUR + 1, SUMMER - 1, SUMMER, SUMMER + 1, SUMMER + HOUR - 1]) {
      const split = advanceTo(advanceTo(start, cut).state, SUMMER + HOUR).state;
      expect(split).toStrictEqual(advanceTo(start, SUMMER + HOUR).state);
    }
  });

  it('sem experiência nenhuma taxa é truncada: o arredondamento só age com a mestria', () => {
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

describe('mestria e experiência do ofício (GDD §5.3 e §5.4)', () => {
  const DAYS = (count: number) => count * DAY;
  const experienceOf = (state: GameState, building: ProductionBuildingId = 'lumberMill') =>
    state.settlement.craftExperience[building];
  /** Uma Serraria com `workers` veteranos e a experiência `experience`, no começo do ano. */
  const mill = (workers: number, experience = 0, level = 1) =>
    gameAt(SPRING, (draft) => {
      roomyFor(draft);
      draft.settlement.population.villagers = 10;
      draft.settlement.workers.farm = 5;
      draft.settlement.workers.lumberMill = workers;
      draft.settlement.buildings.lumberMill = level;
      draft.settlement.craftExperience.lumberMill = experience;
    });
  // A Fazenda dá conta das dez bocas e os depósitos têm folga: nada além do ofício muda.
  const roomyFor = (draft: GameState) => {
    draft.settlement.buildings.granary = 5;
    draft.settlement.buildings.warehouse = 5;
    draft.settlement.buildings.farm = 6;
  };
  const staff = (state: GameState, count: number) =>
    accept(state, command('setWorkers', { building: 'lumberMill', count })).state;

  it('a mestria é 1 + 0,3 × experiência/100, em fração exata', () => {
    expect(masteryRatio(0)).toEqual({ num: 1000, den: 1000 });
    expect(masteryRatio(40)).toEqual({ num: 1120, den: 1000 });
    expect(masteryRatio(100)).toEqual({ num: 1300, den: 1000 });
  });

  it('o exemplo do GDD: 4 × 10 × 1,4 (Nv3) × 1,12 (mestria 40) × 1,3 (outono)', () => {
    const state = gameAt(AUTUMN, (draft) => {
      draft.settlement.population.villagers = 8;
      draft.settlement.workers.farm = 4;
      draft.settlement.buildings.farm = 3;
      draft.settlement.craftExperience.farm = 40;
    });
    expect(productionRate(state, 'farm')).toBe(81_536);
    // Dois dos quatro em adaptação valem um: 3 × 10 × 1,4 × 1,12 × 1,3.
    const adapting = cloneState(state);
    adapting.settlement.adaptation = [{ building: 'farm', count: 2, untilMs: AUTUMN + DAY }];
    expect(effectiveWorkers({ adapted: 2, adapting: 2 })).toEqual({ num: 6, den: 2 });
    expect(productionRate(adapting, 'farm')).toBe(61_152);
  });

  it('0, 1 e vários trabalhadores: adaptados rendem inteiro, em adaptação a metade', () => {
    const state = mill(0, 40);
    const rate = (adapted: number, adapting: number) =>
      productionRate(state, 'lumberMill', { adapted, adapting });
    expect(productionRate(state, 'lumberMill')).toBe(0);
    // 8 × 1,12 = 8,96 por lenhador adaptado.
    expect(rate(1, 0)).toBe(8_960);
    expect(rate(0, 1)).toBe(4_480);
    expect(rate(5, 0)).toBe(44_800);
    expect(rate(3, 2)).toBe(35_840);
    expect(rate(0, 5)).toBe(22_400);
  });

  it('um arredondamento só, com a adaptação e a mestria juntas', () => {
    const state = gameAt(WINTER, (draft) => {
      draft.settlement.workers.quarry = 1;
      draft.settlement.craftExperience.quarry = 7;
      draft.settlement.adaptation = [{ building: 'quarry', count: 1, untilMs: WINTER + DAY }];
      starve(draft, WINTER);
      draft.settlement.cold = { sinceMs: WINTER };
    });
    // 0,5 × 5 × 1,021 × 0,8 (inverno) × 0,75 (fome) × 0,8 (frio) = 1,2252.
    expect(productionRate(state, 'quarry')).toBe(1_225);
  });

  it('ocupado é ter ao menos um trabalhador por nível na virada do dia', () => {
    expect(occupiedFrom(mill(0, 0, 3), 'lumberMill')).toBe(3);
    expect(occupancyOf(mill(0, 0, 3), 'lumberMill')).toBe('empty');
    expect(occupancyOf(mill(2, 0, 3), 'lumberMill')).toBe('short');
    expect(occupancyOf(mill(3, 0, 3), 'lumberMill')).toBe('occupied');
    expect(occupancyOf(mill(5, 0, 3), 'lumberMill')).toBe('occupied');
    expect(occupancyOf(mill(1), 'lumberMill')).toBe('occupied');
  });

  it('ocupado por um dia e vazio por dois: +4, depois −8 e −8', () => {
    const busy = advanceTo(mill(1, 20), DAYS(1)).state;
    expect(experienceOf(busy)).toBe(24);
    const empty = staff(busy, 0);
    expect(experienceOf(advanceTo(empty, DAYS(2)).state)).toBe(16);
    expect(experienceOf(advanceTo(empty, DAYS(3)).state)).toBe(8);
    // A experiência só muda na virada: um milissegundo antes ainda é a de ontem.
    expect(experienceOf(advanceTo(empty, DAYS(2) - 1).state)).toBe(24);
  });

  it('com gente, mas menos do que o nível pede, a experiência nem sobe nem cai', () => {
    const short = advanceTo(mill(2, 20, 3), DAYS(5)).state;
    expect(experienceOf(short)).toBe(20);
    expect(experienceChange(mill(2, 20, 3), 'lumberMill')).toBe(0);
    const occupied = advanceTo(mill(3, 20, 3), DAYS(5)).state;
    expect(experienceOf(occupied)).toBe(40);
  });

  it('fica entre 0 e 100: não passa do máximo nem fica negativa', () => {
    expect(experienceOf(advanceTo(mill(1, 98), DAYS(1)).state)).toBe(100);
    expect(experienceOf(advanceTo(mill(1, 100), DAYS(3)).state)).toBe(100);
    expect(experienceOf(advanceTo(mill(0, 3), DAYS(1)).state)).toBe(0);
    expect(experienceOf(advanceTo(mill(0, 0), DAYS(3)).state)).toBe(0);
    expect(experienceChange(mill(1, 98), 'lumberMill')).toBe(2);
    expect(experienceChange(mill(0, 3), 'lumberMill')).toBe(-3);
  });

  it('parte do zero e leva 25 dias de jogo ocupados para chegar ao máximo', () => {
    const start = mill(1);
    expect(experienceOf(start)).toBe(0);
    expect(experienceOf(advanceTo(start, DAYS(24)).state)).toBe(96);
    expect(experienceOf(advanceTo(start, DAYS(25)).state)).toBe(100);
  });

  it('a mestria vale a partir do instante da virada: a taxa sobe 1,2% por dia ocupado', () => {
    const start = mill(1);
    // Um lenhador, primavera: 8/h no primeiro dia e 8,096/h no segundo.
    const twoDays = advanceTo(start, DAYS(2)).state;
    expect(twoDays.settlement.resources.wood).toBe(120_000 + 16_000 + 16_192);
    expect(productionRate(twoDays, 'lumberMill')).toBe(8_192);
  });

  it('conta quem está no edifício na virada, em adaptação ou não', () => {
    // O lenhador chega um minuto antes da virada: ainda se adapta, e o dia conta.
    const late = staff(advanceTo(mill(0), DAY - MINUTE).state, 1);
    expect(experienceOf(advanceTo(late, DAY).state)).toBe(4);
    // E quem saiu um minuto antes deixa o edifício vazio na virada.
    const left = staff(advanceTo(mill(1, 20), DAY - MINUTE).state, 0);
    expect(experienceOf(advanceTo(left, DAY).state)).toBe(12);
  });

  it('cada edifício tem a própria experiência', () => {
    const state = gameAt(SPRING, (draft) => {
      roomyFor(draft);
      draft.settlement.population.villagers = 10;
      draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 1 };
      draft.settlement.buildings.goldMine = 2;
      draft.settlement.craftExperience = { farm: 0, lumberMill: 50, quarry: 30, goldMine: 10 };
    });
    // Fazenda Nv6 com 6 e Serraria Nv1 com 1: ocupadas. Pedreira vazia. Mina Nv2 com 1: falta.
    expect(advanceTo(state, DAYS(2)).state.settlement.craftExperience).toEqual({
      farm: 8,
      lumberMill: 58,
      quarry: 14,
      goldMine: 10,
    });
  });

  describe('o ofício dominado', () => {
    const mastered = (events: GameEvent[]) => eventsOfType(events, 'craftMastered');

    it('chegar a 100 vira linha na Crônica, no instante da virada, com a frase do ofício', () => {
      const { state, events } = advanceTo(mill(1, 96), DAYS(1));
      expect(experienceOf(state)).toBe(100);
      expect(mastered(events)).toEqual([
        {
          type: 'craftMastered',
          atMs: DAY,
          text: 'No 2º dia da Primavera, os lenhadores de Pedra Alta dominaram o ofício: já nenhum machado erra o golpe.',
          data: { building: 'lumberMill', experience: 100 },
        },
      ]);
      expect(state.settlement.craftMasteredYear.lumberMill).toBe(1);
      // A linha vem depois do amanhecer do dia em que o ofício foi dominado.
      expect(events.map((event) => event.type)).toEqual(['dayStarted', 'craftMastered']);
    });

    it('cada ofício tem a sua frase', () => {
      const state = gameAt(SPRING, (draft) => {
        roomyFor(draft);
        draft.settlement.buildings.farm = 1;
        draft.settlement.population.villagers = 4;
        draft.settlement.workers = { farm: 1, lumberMill: 1, quarry: 1, goldMine: 1 };
        experienced(96)(draft);
      });
      expect(mastered(advanceTo(state, DAY).events).map((event) => event.text)).toEqual([
        'No 2º dia da Primavera, os lavradores de Pedra Alta dominaram o ofício: já não há sulco torto nos campos.',
        'No 2º dia da Primavera, os lenhadores de Pedra Alta dominaram o ofício: já nenhum machado erra o golpe.',
        'No 2º dia da Primavera, os canteiros de Pedra Alta dominaram o ofício: a rocha agora se parte onde eles querem.',
        'No 2º dia da Primavera, os mineiros de Pedra Alta dominaram o ofício: já nenhum veio lhes escapa.',
      ]);
    });

    it('ficar em 100 não repete a linha, nem no mesmo ano nem no seguinte', () => {
      const { events } = advanceTo(mill(1, 96), YEAR + DAYS(10));
      expect(mastered(events)).toHaveLength(1);
    });

    it('perder a mão e recuperá-la no mesmo ano não repete a festa; no ano seguinte, sim', () => {
      const first = advanceTo(mill(1, 96), DAYS(1));
      expect(mastered(first.events)).toHaveLength(1);
      // Um dia vazia (92) e dois ocupada (96, 100), ainda no ano 1.
      const emptied = advanceTo(staff(first.state, 0), DAYS(2)).state;
      expect(experienceOf(emptied)).toBe(92);
      const again = advanceTo(staff(emptied, 1), DAYS(4));
      expect(experienceOf(again.state)).toBe(100);
      expect(mastered(again.events)).toEqual([]);
      expect(again.state.settlement.craftMasteredYear.lumberMill).toBe(1);

      // No ano 2, a mesma queda e a mesma volta ganham a linha de novo.
      const nextYear = advanceTo(again.state, YEAR + DAYS(1)).state;
      const emptiedAgain = advanceTo(staff(nextYear, 0), YEAR + DAYS(2)).state;
      const back = advanceTo(staff(emptiedAgain, 1), YEAR + DAYS(4));
      expect(mastered(back.events)).toMatchObject([{ atMs: YEAR + DAYS(4) }]);
      expect(back.state.settlement.craftMasteredYear.lumberMill).toBe(2);
    });

    it('na virada do ano, o ofício dominado já conta para o ano que começa', () => {
      const start = gameAt(YEAR - DAY, (draft) => {
        roomyFor(draft);
        draft.settlement.population.villagers = 10;
        draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 0 };
        draft.settlement.craftExperience.lumberMill = 96;
      });
      const { state, events } = advanceTo(start, YEAR);
      expect(events.map((event) => event.type)).toEqual([
        'yearStarted',
        'seasonChanged',
        'dayStarted',
        'craftMastered',
      ]);
      expect(state.settlement.craftMasteredYear.lumberMill).toBe(2);
      expect(mastered(events)[0]?.text).toBe(
        'No 1º dia da Primavera, os lenhadores de Pedra Alta dominaram o ofício: já nenhum machado erra o golpe.',
      );
    });
  });

  it('o ganho diário é por dia de jogo: no ritmo 3, oito horas reais são doze viradas', () => {
    const fast = mill(1);
    fast.settings.timeScale = 3;
    const realHours = 8;
    const { state } = advanceTo(fast, realHours * HOUR * fast.settings.timeScale);
    expect(experienceOf(state)).toBe(48);
    // O mesmo feudo, no ritmo 1, leva 24 horas reais para o mesmo ganho.
    expect(experienceOf(advanceTo(mill(1), 24 * HOUR).state)).toBe(48);
  });

  it('fim de adaptação no mesmo instante em que a fome acabaria: a taxa nova já vale na conta', () => {
    // Cinco bocas e um lavrador novato na primavera: 10 × 1,2 × 0,5 × 0,75 (fome) = 4,5/h não
    // cobre os 5/h, nem com os 4 de experiência da virada do dia (4,55/h). Adaptado, rende mais
    // de 9/h: a fome acaba no instante em que a adaptação termina, e não na virada.
    const starving = gameAt(SPRING + 30 * MINUTE, (draft) => {
      draft.settlement.resources.food = 0;
      starve(draft, SPRING);
    });
    const hired = accept(starving, command('setWorkers', { building: 'farm', count: 1 })).state;
    expect(hired.settlement.famine).not.toBeNull();
    const { events } = advanceTo(hired, DAYS(1) + HOUR);
    expect(eventsOfType(events, 'famineEnded').map((event) => event.atMs)).toEqual([
      DAY + 30 * MINUTE,
    ]);
  });

  it('30 dias de uma vez ou de hora em hora: a mesma experiência e os mesmos eventos', () => {
    const start = play(mill(0, 80), [
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      { at: 45 * MINUTE },
      command('setWorkers', { building: 'quarry', count: 1 }),
    ]).state;
    const end = 45 * MINUTE + 30 * 24 * HOUR;
    const direct = advanceTo(start, end);
    let stepped = start;
    const events: GameEvent[] = [];
    for (let at = 45 * MINUTE + HOUR; at <= end; at += HOUR) {
      const result = advanceTo(stepped, at);
      stepped = result.state;
      events.push(...result.events);
    }
    expect(stepped).toStrictEqual(direct.state);
    expect(events).toStrictEqual(direct.events);
    expect(eventsOfType(direct.events, 'craftMastered')).toHaveLength(2);
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
      starve(state, 0);
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
      starve(draft, 0);
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
