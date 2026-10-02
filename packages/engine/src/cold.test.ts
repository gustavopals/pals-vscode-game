import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  foodCoversConsumption,
  netRates,
  productionRate,
  woodCoversFirewood,
  woodRunsOutIn,
} from './economy';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import {
  accept,
  AUTUMN,
  autumnScenario,
  command,
  DAY,
  eventsOfType,
  gameAt,
  HOUR,
  MINUTE,
  play,
  quiet,
  roomy,
  WINTER,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';

/**
 * Um feudo no primeiro instante do inverno: 5 habitantes, todos na Fazenda (a comida sobra:
 * 5 × 10 × 0,4 − 5), ninguém na Serraria. A lenha queima 2,5 de madeira por hora.
 */
const winter = (edit: (draft: GameState) => void = () => {}) =>
  gameAt(WINTER, (draft) => {
    draft.settlement.workers.farm = 5;
    edit(draft);
  });

const types = (events: GameEvent[]) => events.map((event) => event.type);

describe('lenha', () => {
  it('queima 0,5 de madeira por habitante por hora de jogo, exatamente', () => {
    const { state } = advanceTo(winter(), WINTER + 10 * HOUR);
    expect(state.settlement.resources.wood).toBe(120_000 - 25_000);
    expect(state.settlement.accumulators.wood).toBe(0);
    expect(state.settlement.cold).toBeNull();
  });

  it('a Serraria repõe: o saldo é a produção do inverno menos a lenha', () => {
    const state = winter((draft) => {
      draft.settlement.workers = { farm: 4, lumberMill: 1, quarry: 0, goldMine: 0 };
    });
    // 8 × 0,8 − 2,5 = +3,9 por hora, no primeiro dia de jogo (depois dele a experiência do
    // ofício começa a render).
    expect(netRates(state).wood).toBe(3_900);
    expect(advanceTo(state, WINTER + DAY).state.settlement.resources.wood).toBe(120_000 + 7_800);
  });

  it('um inverno inteiro com madeira no estoque: 12 por habitante, e nada de frio', () => {
    const { state, events } = advanceTo(winter(), YEAR);
    expect(state.settlement.resources.wood).toBe(120_000 - 60_000);
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
    expect(eventsOfType(events, 'coldEnded')).toEqual([]);
  });

  it('a lenha para na virada para a primavera', () => {
    const spring = advanceTo(winter(), YEAR).state;
    expect(netRates(spring).wood).toBe(0);
    expect(advanceTo(spring, YEAR + 5 * DAY).state.settlement.resources.wood).toBe(60_000);
  });
});

describe('início do frio', () => {
  // 10 de madeira a 2,5 por hora: quatro horas de lareira.
  const start = winter((draft) => {
    draft.settlement.resources.wood = 10_000;
  });
  const coldAt = WINTER + 4 * HOUR;

  it('começa no instante exato em que a madeira acaba', () => {
    const { state, events } = advanceTo(start, WINTER + 10 * HOUR);
    const [started] = eventsOfType(events, 'coldStarted');
    expect(eventsOfType(events, 'coldStarted')).toHaveLength(1);
    expect(started).toMatchObject({ atMs: coldAt, data: {} });
    expect(started?.text).toBe(
      'No 3º dia do Inverno, queimou-se a última acha de lenha em Pedra Alta. O frio entrou nas casas.',
    );
    expect(state.settlement.cold).toEqual({ sinceMs: coldAt });
    expect(state.settlement.resources.wood).toBe(0);
    expect(state.settlement.accumulators.wood).toBe(0);
  });

  it('um instante antes ainda não há frio', () => {
    const { state, events } = advanceTo(start, coldAt - 1);
    expect(state.settlement.cold).toBeNull();
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
    expect(nextEventAt(state)).toBe(coldAt);
  });

  it('a madeira nunca fica negativa, em nenhum corte do intervalo', () => {
    let state = start;
    for (let hour = 1; hour <= 23; hour += 1) {
      state = advanceTo(state, WINTER + hour * HOUR + 7 * hour).state;
      expect(state.settlement.resources.wood).toBeGreaterThanOrEqual(0);
    }
    expect(state.settlement.cold).toEqual({ sinceMs: coldAt });
  });

  it('gastar a última madeira em uma obra, com a lareira acesa, abre o frio na hora', () => {
    const state = winter((draft) => {
      draft.settlement.resources.wood = 80_000;
    });
    const result = accept(state, command('startConstruction', { building: 'housing' }));
    expect(result.state.settlement.cold).toEqual({ sinceMs: WINTER });
    expect(types(result.events)).toEqual(['constructionStarted', 'coldStarted']);
  });

  it('entrar no inverno sem madeira abre o frio na virada, depois do amanhecer', () => {
    const autumn = gameAt(AUTUMN + 23 * DAY, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
    });
    const { state, events } = advanceTo(autumn, WINTER + MINUTE);
    expect(types(events.filter((event) => event.atMs === WINTER))).toEqual([
      'seasonChanged',
      'dayStarted',
      'coldStarted',
    ]);
    expect(state.settlement.cold).toEqual({ sinceMs: WINTER });
  });

  it('fora do inverno ninguém passa frio, mesmo sem madeira nenhuma', () => {
    const autumn = gameAt(AUTUMN, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
    });
    const { state, events } = advanceTo(autumn, WINTER - 1);
    expect(state.settlement.cold).toBeNull();
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
  });

  it('com a Serraria rendendo exatamente a lenha, a madeira não acaba e o frio não vem', () => {
    // 16 habitantes queimam 8; um lenhador no nível 3 rende 8 × 1,4 × 0,8 = 8,96.
    // No nível 1, com 0,8 de inverno, 5 lenhadores rendem 32: a lenha de 64 habitantes.
    const even = winter((draft) => {
      draft.settlement.population.villagers = 64;
      draft.settlement.workers = { farm: 59, lumberMill: 5, quarry: 0, goldMine: 0 };
      draft.settlement.resources.wood = 0;
      draft.settlement.resources.food = 9_000_000;
    });
    expect(netRates(even).wood).toBe(0);
    const { state, events } = advanceTo(even, WINTER + 6 * HOUR);
    expect(state.settlement.cold).toBeNull();
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
  });
});

describe('durante o frio', () => {
  const freezing = advanceTo(
    winter((draft) => {
      draft.settlement.workers = { farm: 3, lumberMill: 0, quarry: 1, goldMine: 1 };
      draft.settlement.resources.wood = 0;
    }),
    WINTER + HOUR,
  ).state;

  it('a produção de todos os recursos cai para 80%', () => {
    expect(freezing.settlement.cold).toEqual({ sinceMs: WINTER });
    // Inverno × frio: 3 × 10 × 0,4 × 0,8; 5 × 0,8 × 0,8; 4 × 0,8.
    expect(productionRate(freezing, 'farm')).toBe(9_600);
    expect(productionRate(freezing, 'quarry')).toBe(3_200);
    expect(productionRate(freezing, 'goldMine')).toBe(3_200);
    const before = freezing.settlement.resources;
    const after = advanceTo(freezing, WINTER + 2 * HOUR).state.settlement.resources;
    expect(after.stone - before.stone).toBe(3_200);
    expect(after.gold - before.gold).toBe(3_200);
    expect(after.food - before.food).toBe(9_600 - 5_000);
  });

  it('a madeira fica em zero: só se queima o que existe', () => {
    const later = advanceTo(freezing, WINTER + 20 * HOUR).state;
    expect(later.settlement.resources.wood).toBe(0);
    expect(later.settlement.accumulators.wood).toBe(0);
    expect(woodRunsOutIn(later)).toBeNull();
  });

  it('as obras e o recrutamento continuam: o frio não congela nada', () => {
    const rich = cloneState(freezing);
    rich.settlement.resources = { food: 900_000, wood: 0, stone: 900_000, gold: 900_000 };
    const ordered = accept(rich, command('recruitVillagers', { quantity: 1 })).state;
    const { state, events } = advanceTo(ordered, WINTER + HOUR + 20 * MINUTE);
    expect(state.settlement.population.villagers).toBe(6);
    expect(eventsOfType(events, 'recruitmentFinished')).toHaveLength(1);
  });
});

describe('fim do frio', () => {
  const freezing = advanceTo(
    winter((draft) => {
      draft.settlement.resources.wood = 0;
    }),
    WINTER + 3 * HOUR,
  ).state;

  it('termina sempre na virada para a primavera, depois do amanhecer', () => {
    const { state, events } = advanceTo(freezing, YEAR);
    expect(state.settlement.cold).toBeNull();
    // A moral é recalculada antes de o frio fechar, e já não o conta: o povo, inquieto desde a
    // primeira virada do inverno, volta a ficar contente no mesmo instante em que o gelo cede.
    expect(types(events.filter((event) => event.atMs === YEAR))).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
      'moraleBandChanged',
      'coldEnded',
    ]);
    const [ended] = eventsOfType(events, 'coldEnded');
    expect(ended).toMatchObject({ atMs: YEAR, data: { reason: 'thaw', sinceMs: WINTER } });
    expect(ended?.text).toBe('No 1º dia da Primavera, o gelo cedeu em Pedra Alta. O frio passou.');
    expect(eventsOfType(events, 'coldStarted')).toEqual([]);
  });

  it('um inverno inteiro sem madeira: um frio só, da primeira à última hora', () => {
    const autumn = gameAt(WINTER - HOUR, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
      // Com o Celeiro, a comida do inverno inteiro tem onde ficar.
      roomy(draft);
    });
    const { state, events } = advanceTo(autumn, YEAR + HOUR);
    expect(eventsOfType(events, 'coldStarted').map((event) => event.atMs)).toEqual([WINTER]);
    expect(eventsOfType(events, 'coldEnded').map((event) => event.atMs)).toEqual([YEAR]);
    expect(state.settlement.cold).toBeNull();
    expect(state.settlement.resources.wood).toBe(0);
    // Uma hora de outono (5 × 13 − 5). Doze dias de inverno com frio, de 2 h cada um, e a cada
    // virada a Fazenda ganha 4 de experiência: 5 × 10 × 0,4 × 0,8 × mestria × moral − 5 por
    // hora. A moral é 60 no primeiro dia (a virada do inverno a calculou antes de o frio abrir,
    // com a comida guardada) e 40 nos outros onze (o frio pesa 20). E uma hora de primavera, já
    // com 52 de experiência e a moral de volta a 60: 5 × 12 × 1,156 × 1,05 − 5.
    const winterDays = Array.from({ length: 12 }, (_, index) => {
      const experience = 4 * (index + 1);
      const morale = index === 0 ? 60 : 40;
      const farm = Math.floor((16_000 * (1000 + 3 * experience) * (150 + morale)) / 200_000);
      return 2 * (farm - 5_000);
    });
    expect(state.settlement.craftExperience.farm).toBe(52);
    expect(state.settlement.morale).toBe(60);
    expect(state.settlement.resources.food).toBe(
      180_000 + 60_000 + winterDays.reduce((sum, day) => sum + day, 0) + (72_828 - 5_000),
    );
  });

  it('termina quando o saldo de madeira volta a ser positivo, já com a penalidade', () => {
    // Um lenhador recém-chegado rende, no frio, 8 × 0,8 × 0,8 × metade = 2,56: mais que os 2,5
    // da lenha. A conta é com a moral na base: a virada das 2 h, com o frio, a tinha levado a
    // 40, e com ela (× 0,95) um lenhador só não bastaria.
    const calm = cloneState(freezing);
    calm.settlement.morale = 50;
    const { state, events } = accept(
      accept(calm, command('setWorkers', { building: 'farm', count: 4 })).state,
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    );
    expect(state.settlement.cold).toBeNull();
    expect(types(events)).toEqual(['coldEnded']);
    expect(events[0]).toMatchObject({
      atMs: WINTER + 3 * HOUR,
      data: { reason: 'firewood', sinceMs: WINTER },
    });
    expect(events[0]?.text).toBe(
      'No 2º dia do Inverno, as lareiras voltaram a arder em Pedra Alta. O frio passou.',
    );
    // Sem o frio ele rende 3,2: o saldo passa a +0,7. Um dia de jogo depois, adaptado, com os
    // 4 de experiência da virada e a moral em 60 (sem frio e com comida guardada), rende
    // 6,4 × 1,012 × 1,05.
    expect(netRates(state).wood).toBe(700);
    expect(netRates(advanceTo(state, WINTER + 3 * HOUR + DAY).state).wood).toBe(6_800 - 2_500);
  });

  it('um saldo positivo só sem a penalidade ainda mantém o frio', () => {
    // 6 habitantes queimam 3. Um lenhador recém-chegado renderia 3,2, mas com o frio rende 2,56.
    const crowded = cloneState(freezing);
    crowded.settlement.population.villagers = 6;
    crowded.settlement.workers.farm = 4;
    const one = accept(crowded, command('setWorkers', { building: 'lumberMill', count: 1 }));
    expect(one.state.settlement.cold).toEqual({ sinceMs: WINTER });
    expect(one.events).toEqual([]);
    // Dois lenhadores: 5,12 contra 3.
    const two = accept(one.state, command('setWorkers', { building: 'lumberMill', count: 2 }));
    expect(two.state.settlement.cold).toBeNull();
    expect(types(two.events)).toEqual(['coldEnded']);
  });

  it('termina quando volta a haver madeira no estoque, e recomeça quando ela acaba de novo', () => {
    // Uma obra em andamento, paga antes do inverno. Cancelá-la devolve 64 de madeira, que a
    // lareira de 5 habitantes queima em 25,6 horas: mais do que o inverno ainda tem. Com 40
    // habitantes (20 por hora), a madeira volta e acaba de novo 3,2 horas depois.
    const building = cloneState(freezing);
    building.settlement.population.villagers = 40;
    building.settlement.workers.farm = 40;
    building.settlement.resources.food = 900_000;
    building.settlement.constructionQueues = [
      { building: 'farm', targetLevel: 2, startedAtMs: WINTER, finishesAtMs: WINTER + 7 * HOUR },
      null,
    ];
    const now = WINTER + 3 * HOUR;
    const cancelled = accept(building, command('cancelConstruction', { building: 'farm' }));
    // No mesmo instante, uma mudança só: o frio termina e não recomeça.
    expect(types(cancelled.events)).toEqual(['constructionCancelled', 'coldEnded']);
    expect(cancelled.state.settlement.cold).toBeNull();
    expect(cancelled.state.settlement.resources.wood).toBe(64_000);

    const again = now + (64_000 * HOUR) / 20_000;
    const { state, events } = advanceTo(cancelled.state, YEAR - 1);
    expect(eventsOfType(events, 'coldStarted').map((event) => event.atMs)).toEqual([again]);
    expect(eventsOfType(events, 'coldEnded')).toEqual([]);
    expect(state.settlement.cold).toEqual({ sinceMs: again });
    expect(state.settlement.resources.wood).toBe(0);
  });

  it('lenha acabando e voltando várias vezes: cada volta é um frio que termina e outro que começa', () => {
    // A recompensa de um objetivo e três cancelamentos devolvem madeira em instantes diferentes.
    let state = cloneState(freezing);
    state.settlement.population.villagers = 40;
    state.settlement.workers.farm = 40;
    state.settlement.resources = { food: 900_000, wood: 0, stone: 900_000, gold: 900_000 };
    const events: GameEvent[] = [];
    for (let round = 0; round < 3; round += 1) {
      state.settlement.constructionQueues = [
        {
          building: 'quarry',
          targetLevel: 2,
          startedAtMs: state.lastProcessedAt,
          finishesAtMs: YEAR + DAY,
        },
        null,
      ];
      const result = play(state, [
        command('cancelConstruction', { building: 'quarry' }),
        { at: state.lastProcessedAt + 6 * HOUR },
      ]);
      state = cloneState(result.state);
      events.push(...result.events);
    }
    const scarcity = events.filter(
      (event) => event.type === 'coldStarted' || event.type === 'coldEnded',
    );
    expect(types(scarcity)).toEqual([
      'coldEnded',
      'coldStarted',
      'coldEnded',
      'coldStarted',
      'coldEnded',
      'coldStarted',
    ]);
    // Nunca dois no mesmo instante, e sempre em ordem.
    const instants = scarcity.map((event) => event.atMs);
    expect(new Set(instants).size).toBe(instants.length);
    expect(instants).toEqual([...instants].sort((a, b) => a - b));
    // 96 de madeira devolvidos a 20 por hora: 4,8 horas de lareira a cada volta.
    expect(instants[1]! - instants[0]!).toBe((96_000 * HOUR) / 20_000);
  });
});

describe('Crônica do inverno', () => {
  it('o outono sem lenha guardada, o frio, a volta da madeira e o degelo', async () => {
    // O feudo do outono (18 habitantes, 60 de madeira, ninguém na Serraria) atravessa o
    // inverno: o frio chega no 4º dia; no 6º o senhor manda três para a Serraria, mas
    // recém-chegados eles rendem metade (7,68 por hora, contra 9 de lenha): a lareira só volta
    // um dia de jogo depois, quando pegam o ofício. No 9º ele os tira de novo.
    // Sem o Conselho: esta é a Crônica do frio, e as cartas têm a delas.
    const { events } = play(quiet(autumnScenario()), [
      { at: WINTER + 5 * DAY + 30 * MINUTE },
      command('setWorkers', { building: 'quarry', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 3 }),
      { at: WINTER + 8 * DAY },
      command('setWorkers', { building: 'lumberMill', count: 0 }),
      { at: YEAR + DAY },
    ]);
    const lines = events
      .filter((event) => event.type !== 'dayStarted')
      .map((event) => `${event.atMs}\t${event.type}\t${event.text}`);
    expect(types(events.filter((event) => event.type.startsWith('cold')))).toEqual([
      'coldStarted',
      'coldEnded',
      'coldStarted',
      'coldEnded',
    ]);
    await expect(`${lines.join('\n')}\n`).toMatchFileSnapshot('./__golden__/chronicle-winter.txt');
  });
});

describe('fome e frio no mesmo instante', () => {
  it('abrem na ordem fixa: primeiro a fome, depois o frio', () => {
    // Ninguém trabalha: 5 de comida e 2,5 de madeira por hora. 5 e 2,5 acabam juntos, em 1 h.
    const start = gameAt(WINTER, (draft) => {
      draft.settlement.resources.food = 5_000;
      draft.settlement.resources.wood = 2_500;
    });
    const at = WINTER + HOUR;
    const { state, events } = advanceTo(start, at + HOUR);
    expect(types(events.filter((event) => event.atMs === at))).toEqual([
      'famineStarted',
      'coldStarted',
    ]);
    expect(state.settlement.famine).toEqual({ sinceMs: at });
    expect(state.settlement.cold).toEqual({ sinceMs: at });
    // O estado parou na virada do dia seguinte; o próximo evento é a virada depois dela.
    expect(nextEventAt(state)).toBe(WINTER + 2 * DAY);
  });

  it('a fome que corta a Serraria pode abrir o frio no mesmo instante, uma vez só', () => {
    // 64 habitantes queimam 32 de madeira, exatamente o que 5 lenhadores rendem no inverno
    // (5 × 8 × 0,8): o estoque fica em zero sem faltar lenha. A comida acaba em uma hora; com a
    // fome a Serraria rende 24 e deixa de cobrir a lareira.
    const start = gameAt(WINTER, (draft) => {
      draft.settlement.population.villagers = 64;
      draft.settlement.workers.lumberMill = 5;
      draft.settlement.resources.food = 64_000;
      draft.settlement.resources.wood = 0;
    });
    expect(start.settlement.cold).toBeNull();
    expect(woodRunsOutIn(start)).toBeNull();
    const at = WINTER + HOUR;
    const before = advanceTo(start, at - 1);
    expect(before.events).toEqual([]);
    const { state, events } = advanceTo(before.state, at);
    expect(types(events)).toEqual(['famineStarted', 'coldStarted']);
    expect(state.settlement.famine).toEqual({ sinceMs: at });
    expect(state.settlement.cold).toEqual({ sinceMs: at });
    expect(state.settlement.resources.wood).toBe(0);
    // Fome e frio juntos: 5 × 8 × 0,8 × 0,75 × 0,8.
    expect(productionRate(state, 'lumberMill')).toBe(19_200);
    // Em repouso: o próximo evento é a virada do dia, não este instante de novo.
    expect(nextEventAt(state)).toBe(WINTER + DAY);
  });

  it('o fim do frio que devolve a comida à Fazenda encerra a fome no mesmo instante', () => {
    // 5 fazendeiros no inverno: 20 de comida. Com fome e frio, 12, para 13 bocas. A virada
    // para a primavera tira o frio e triplica a colheita: os dois acabam de uma vez. Antes
    // deles vem a moral, que depois de doze dias de fome leva gente embora; aqui só importa a
    // ordem do calendário e do fim da escassez.
    const start = gameAt(YEAR - HOUR, (draft) => {
      draft.settlement.population.villagers = 13;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.food = 0;
      draft.settlement.resources.wood = 0;
      draft.settlement.famine = { sinceMs: WINTER };
      draft.settlement.cold = { sinceMs: WINTER };
    });
    const { state, events } = advanceTo(start, YEAR);
    const moraleTypes = ['moraleBandChanged', 'villagerLeft', 'villagerDeserted'];
    expect(types(events.filter((event) => !moraleTypes.includes(event.type)))).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
      'famineEnded',
      'coldEnded',
    ]);
    expect(types(events).indexOf('villagerDeserted')).toBeLessThan(
      types(events).indexOf('famineEnded'),
    );
    expect(state.settlement.famine).toBeNull();
    expect(state.settlement.cold).toBeNull();
  });
});

describe('o estado em repouso', () => {
  const scenario = fc.record({
    atMs: fc.integer({ min: AUTUMN + 20 * DAY, max: YEAR + 2 * DAY }),
    villagers: fc.integer({ min: 0, max: 40 }),
    farm: fc.nat(20),
    lumberMill: fc.nat(20),
    farmLevel: fc.integer({ min: 1, max: 10 }),
    lumberLevel: fc.integer({ min: 1, max: 10 }),
    // Estoques e restos perto de zero: é onde a fome e o frio abrem e fecham.
    food: fc.oneof(fc.nat(3), fc.nat(50_000)),
    wood: fc.oneof(fc.nat(3), fc.nat(50_000)),
    foodRest: fc.integer({ min: -3_599_999, max: 3_599_999 }),
    woodRest: fc.integer({ min: -3_599_999, max: 3_599_999 }),
    famine: fc.boolean(),
    cold: fc.boolean(),
  });

  it('depois de acomodar fome e frio, nada mais muda no mesmo instante', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const state = gameAt(plan.atMs, (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = plan.villagers;
          settlement.workers.farm = Math.min(plan.farm, plan.villagers);
          settlement.workers.lumberMill = Math.min(
            plan.lumberMill,
            plan.villagers - settlement.workers.farm,
          );
          settlement.buildings.farm = plan.farmLevel;
          settlement.buildings.lumberMill = plan.lumberLevel;
          settlement.resources.food = plan.food;
          settlement.resources.wood = plan.wood;
          settlement.accumulators.food = plan.foodRest;
          settlement.accumulators.wood = plan.woodRest;
          settlement.famine = plan.famine ? { sinceMs: plan.atMs - HOUR } : null;
          settlement.cold = plan.cold ? { sinceMs: plan.atMs - HOUR } : null;
        });
        const draft = cloneState(state);
        const events: GameEvent[] = [];
        settleScarcity(draft, plan.atMs, events);

        // No máximo uma linha de fome e uma de frio: nenhum dos dois abre e fecha no instante.
        const kinds = types(events);
        expect(kinds.filter((type) => type.startsWith('famine')).length).toBeLessThanOrEqual(1);
        expect(kinds.filter((type) => type.startsWith('cold')).length).toBeLessThanOrEqual(1);
        // A linha é a da mudança que ficou.
        expect(kinds.includes('famineStarted')).toBe(
          !plan.famine && draft.settlement.famine !== null,
        );
        expect(kinds.includes('famineEnded')).toBe(plan.famine && draft.settlement.famine === null);
        expect(kinds.includes('coldStarted')).toBe(!plan.cold && draft.settlement.cold !== null);
        expect(kinds.includes('coldEnded')).toBe(plan.cold && draft.settlement.cold === null);
        // Quem continua com fome ou frio continua desde quando começou.
        if (plan.famine && draft.settlement.famine !== null) {
          expect(draft.settlement.famine).toEqual({ sinceMs: plan.atMs - HOUR });
        }
        if (plan.cold && draft.settlement.cold !== null) {
          expect(draft.settlement.cold).toEqual({ sinceMs: plan.atMs - HOUR });
        }

        // Repouso: acomodar de novo não muda nada, e o próximo evento é depois de agora.
        const again = cloneState(draft);
        const more: GameEvent[] = [];
        settleScarcity(again, plan.atMs, more);
        expect(more).toEqual([]);
        expect(again).toStrictEqual(draft);
        expect(nextEventAt(draft)).toBeGreaterThan(plan.atMs);
        expect(draft.settlement.resources.food).toBeGreaterThanOrEqual(0);
        expect(draft.settlement.resources.wood).toBeGreaterThanOrEqual(0);
        // Escassez aberta é estoque que não cobre nem um instante: ninguém passa fome com a
        // despensa cheia, nem frio com madeira no Pátio.
        if (draft.settlement.famine !== null) {
          expect(foodCoversConsumption(draft)).toBe(false);
        }
        if (draft.settlement.cold !== null) {
          expect(woodCoversFirewood(draft)).toBe(false);
        }
      }),
      { numRuns: 2000 },
    );
  });

  it('um estado que não está em repouso se acomoda antes de o tempo andar, sem repetir o dia', () => {
    // É o que a migração entrega quando encontra a partida no inverno e sem madeira: o frio
    // abre no instante em que a partida estava, e a virada de dia desse instante não se repete.
    const stale = gameAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 0;
    });
    expect(stale.settlement.cold).toBeNull();
    const { state, events } = advanceTo(stale, WINTER + 3 * DAY + 1);
    expect(events).toMatchObject([{ type: 'coldStarted', atMs: WINTER + 3 * DAY }]);
    expect(state.settlement.cold).toEqual({ sinceMs: WINTER + 3 * DAY });
  });
});
