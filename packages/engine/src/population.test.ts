import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { adaptingAt, handsOf } from './craft';
import { netRates, productionRate } from './economy';
import {
  assignedWorkers,
  freeVillagers,
  housingCapacity,
  housingVacancy,
  releaseExcessWorkers,
} from './population';
import { cloneState } from './state';
import {
  accept,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  play,
  refuse,
  SUMMER,
  WINTER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameState, ProductionBuildingId } from './types';
import { deriveViewState } from './view';

describe('valores derivados', () => {
  it('capacidade inicial 10, com 5 aldeões livres', () => {
    const state = newGame();
    expect(housingCapacity(state)).toBe(10);
    expect(freeVillagers(state)).toBe(5);
    expect(housingVacancy(state)).toBe(5);
  });

  it('Salão e Habitações dão +5 de capacidade por nível', () => {
    const state = gameWith((draft) => {
      draft.settlement.buildings.townHall = 3;
      draft.settlement.buildings.housing = 4;
      draft.settlement.buildings.farm = 9;
    });
    expect(housingCapacity(state)).toBe(35);
  });

  it('nada disso é guardado no estado', () => {
    expect(Object.keys(newGame().settlement.population)).toEqual(['villagers']);
  });
});

describe('alocar trabalhadores', () => {
  it('um trabalhador a mais na Serraria muda a taxa na hora e reduz os livres', () => {
    const one = accept(
      newGame(),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ).state;
    const two = accept(one, command('setWorkers', { building: 'lumberMill', count: 2 })).state;
    expect(freeVillagers(one)).toBe(4);
    expect(freeVillagers(two)).toBe(3);
    // Quem acabou de chegar rende metade: 4/h cada um, em vez de 8.
    const wood = (state: typeof one) => advanceTo(state, HOUR).state.settlement.resources.wood;
    expect(wood(one) - 120_000).toBe(4_000);
    expect(wood(two) - 120_000).toBe(8_000);
  });

  it('realocar vale na hora: o trecho recomeça com a taxa nova', () => {
    const start = accept(newGame(), command('setWorkers', { building: 'quarry', count: 2 })).state;
    const half = advanceTo(start, 30 * MINUTE).state;
    const moved = accept(half, command('setWorkers', { building: 'quarry', count: 4 })).state;
    // Todos ainda em adaptação: 30 min a 5/h e 30 min a 10/h.
    expect(advanceTo(moved, HOUR).state.settlement.resources.stone).toBe(65_000 + 2_500 + 5_000);
  });

  it('não aloca mais que a população', () => {
    const state = accept(newGame(), command('setWorkers', { building: 'farm', count: 3 })).state;
    expect(refuse(state, command('setWorkers', { building: 'quarry', count: 3 }))).toEqual({
      code: 'NOT_ENOUGH_VILLAGERS',
      message: 'Só há 2 aldeões livres para esse ofício.',
    });
    expect(refuse(state, command('setWorkers', { building: 'farm', count: 6 })).message).toBe(
      'Só há 5 aldeões livres para esse ofício.',
    );
    const full = accept(state, command('setWorkers', { building: 'quarry', count: 1 })).state;
    expect(refuse(full, command('setWorkers', { building: 'goldMine', count: 2 })).message).toBe(
      'Só há 1 aldeão livre para esse ofício.',
    );
  });

  it('pode reduzir e zerar', () => {
    const three = accept(newGame(), command('setWorkers', { building: 'farm', count: 3 })).state;
    const zero = accept(three, command('setWorkers', { building: 'farm', count: 0 })).state;
    expect(zero.settlement.workers.farm).toBe(0);
    expect(freeVillagers(zero)).toBe(5);
  });

  it.each([
    ['housing' as ProductionBuildingId, 1],
    ['townHall' as ProductionBuildingId, 1],
    ['farm' as const, -1],
    ['farm' as const, 1.5],
    ['farm' as const, Number.NaN],
  ])('recusa %s com %d trabalhadores', (building, count) => {
    expect(refuse(newGame(), command('setWorkers', { building, count })).code).toBe(
      'INVALID_WORKERS',
    );
  });
});

describe('troca de ofício (GDD §5.4; ADR 0013, decisões 1 e 13)', () => {
  const cohorts = (state: GameState) => state.settlement.adaptation;
  const order = (building: ProductionBuildingId, count: number) =>
    command('setWorkers', { building, count });
  /**
   * Um feudo no meio de um dia de primavera, com veteranos na Fazenda e a Pedreira e a Serraria
   * no nível 4: três trabalhadores não bastam para ocupá-las (pedem quatro), então a experiência
   * fica parada e as contas deste bloco são só da adaptação.
   */
  const midDay = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(30 * MINUTE, (draft) => {
      draft.settlement.population.villagers = 8;
      draft.settlement.workers.farm = 3;
      draft.settlement.buildings.quarry = 4;
      draft.settlement.buildings.lumberMill = 4;
      edit(draft);
    });

  it('sem ninguém não há adaptação nem produção; mandar zero para onde há zero não cria nada', () => {
    const state = accept(newGame(), order('lumberMill', 0)).state;
    expect(cohorts(state)).toEqual([]);
    expect(productionRate(state, 'lumberMill')).toBe(0);
    expect(handsOf(state, 'lumberMill')).toEqual({ adapted: 0, adapting: 0 });
  });

  it('um trabalhador novo entra em adaptação por um dia de jogo e rende metade até lá', () => {
    const { state, events } = accept(midDay(), order('quarry', 1));
    expect(events).toEqual([]);
    expect(cohorts(state)).toEqual([{ building: 'quarry', count: 1, untilMs: 30 * MINUTE + DAY }]);
    expect(handsOf(state, 'quarry')).toEqual({ adapted: 0, adapting: 1 });
    // 1 × 5 × 1,6 (Nv4) × metade.
    expect(productionRate(state, 'quarry')).toBe(4_000);
    const done = advanceTo(state, 30 * MINUTE + DAY);
    expect(cohorts(done.state)).toEqual([]);
    expect(handsOf(done.state, 'quarry')).toEqual({ adapted: 1, adapting: 0 });
    expect(productionRate(done.state, 'quarry')).toBe(8_000);
  });

  it('a troca reduz a produção à metade por exatamente 2 h de jogo (critério 5 da §16.2)', () => {
    // Três veteranos saem da Fazenda para a Pedreira no minuto 30.
    const moved = play(midDay(), [order('farm', 0), order('quarry', 3)]).state;
    expect(cohorts(moved)).toEqual([
      { building: 'quarry', count: 3, untilMs: 2 * HOUR + 30 * MINUTE },
    ]);
    // 3 × 5 × 1,6 (Nv4) = 24/h de pedra com gente adaptada; em adaptação, 12/h.
    expect(netRates(moved).stone).toBe(12_000);
    const lastMs = advanceTo(moved, 2 * HOUR + 30 * MINUTE - 1).state;
    expect(netRates(lastMs).stone).toBe(12_000);
    expect(cohorts(lastMs)).toHaveLength(1);

    const end = advanceTo(moved, 2 * HOUR + 30 * MINUTE);
    expect(cohorts(end.state)).toEqual([]);
    expect(netRates(end.state).stone).toBe(24_000);
    // Duas horas pela metade: 24 de pedra, e não 48.
    expect(end.state.settlement.resources.stone).toBe(65_000 + 24_000);
    // O fim da adaptação não é linha da Crônica: só a taxa muda.
    expect(end.events.filter((event) => event.type !== 'dayStarted')).toEqual([]);
    // Dali em diante, a taxa cheia.
    const later = advanceTo(end.state, 3 * HOUR + 30 * MINUTE).state;
    expect(later.settlement.resources.stone).toBe(65_000 + 24_000 + 24_000);
  });

  it('o prazo é tempo de jogo: no ritmo 3 são 40 minutos reais, e a visão diz isso', () => {
    const fast = midDay((draft) => {
      draft.settings.timeScale = 3;
    });
    const moved = play(fast, [order('farm', 0), order('quarry', 3)]).state;
    // O estado é o mesmo de qualquer ritmo: o prazo está em ms de jogo.
    expect(cohorts(moved)).toEqual([
      { building: 'quarry', count: 3, untilMs: 2 * HOUR + 30 * MINUTE },
    ]);
    const view = deriveViewState(moved, moved.lastProcessedAt);
    const quarry = view.workers.find((row) => row.building === 'quarry');
    expect(view.workersRules.adaptationSeconds).toBe(40 * 60);
    expect(quarry).toMatchObject({ adapting: 3, adaptationEndsInSeconds: 40 * 60 });
    // 20 minutos reais depois (uma hora de jogo), faltam 20.
    const later = deriveViewState(moved, moved.lastProcessedAt + HOUR);
    expect(later.workers.find((row) => row.building === 'quarry')).toMatchObject({
      adapting: 3,
      adaptationEndsInSeconds: 20 * 60,
    });
  });

  it('o fim de cada coorte é um evento da linha do tempo', () => {
    const moved = accept(midDay(), order('quarry', 2)).state;
    // Antes dele vem a virada do dia, às 2 h; depois dela, o fim da adaptação, às 2 h 30.
    expect(nextEventAt(moved)).toBe(DAY);
    const turned = advanceTo(moved, DAY).state;
    expect(nextEventAt(turned)).toBe(DAY + 30 * MINUTE);
    const done = advanceTo(turned, DAY + 30 * MINUTE).state;
    expect(nextEventAt(done)).toBe(2 * DAY);
  });

  it('coortes com cortes na metade: cada leva termina no seu instante, em qualquer divisão', () => {
    // Dois lenhadores no minuto 30 e mais um uma hora depois. Serraria Nv4: 12,8/h cada.
    const first = accept(midDay(), order('lumberMill', 2)).state;
    const second = accept(advanceTo(first, 90 * MINUTE).state, order('lumberMill', 3)).state;
    expect(cohorts(second)).toEqual([
      { building: 'lumberMill', count: 2, untilMs: 2 * HOUR + 30 * MINUTE },
      { building: 'lumberMill', count: 1, untilMs: 3 * HOUR + 30 * MINUTE },
    ]);
    const end = 4 * HOUR + 30 * MINUTE;
    const direct = advanceTo(second, end);
    // 1 h com dois pela metade (12,8), 1 h com três pela metade (19,2), 1 h com dois inteiros e
    // um pela metade (32) e 1 h com os três inteiros (38,4).
    expect(direct.state.settlement.resources.wood).toBe(
      120_000 + 12_800 + 19_200 + 32_000 + 38_400,
    );
    expect(cohorts(direct.state)).toEqual([]);
    for (const cut of [
      90 * MINUTE + 1,
      2 * HOUR,
      2 * HOUR + 30 * MINUTE - 1,
      2 * HOUR + 30 * MINUTE,
      2 * HOUR + 30 * MINUTE + 1,
      3 * HOUR,
      3 * HOUR + 30 * MINUTE,
      4 * HOUR,
    ]) {
      const half = advanceTo(second, cut);
      const split = advanceTo(half.state, end);
      expect(split.state, `corte em ${cut}`).toStrictEqual(direct.state);
      expect([...half.events, ...split.events]).toStrictEqual(direct.events);
    }
    // No meio do caminho, a segunda leva ainda se adapta.
    const between = advanceTo(second, 3 * HOUR).state;
    expect(handsOf(between, 'lumberMill')).toEqual({ adapted: 2, adapting: 1 });
    expect(adaptingAt(second, 'lumberMill', 3 * HOUR)).toBe(1);
    expect(adaptingAt(second, 'lumberMill', 3 * HOUR + 30 * MINUTE)).toBe(0);
  });

  it('diminuir tira primeiro das coortes mais novas, e só depois os veteranos', () => {
    // Três veteranos na Fazenda; chegam dois no minuto 30 e mais um às 1 h 30.
    const grown = play(midDay(), [order('farm', 5), { at: 90 * MINUTE }, order('farm', 6)]).state;
    expect(cohorts(grown)).toEqual([
      { building: 'farm', count: 2, untilMs: 2 * HOUR + 30 * MINUTE },
      { building: 'farm', count: 1, untilMs: 3 * HOUR + 30 * MINUTE },
    ]);
    // Saem dois: o da leva mais nova e um da anterior.
    const four = accept(grown, order('farm', 4)).state;
    expect(cohorts(four)).toEqual([
      { building: 'farm', count: 1, untilMs: 2 * HOUR + 30 * MINUTE },
    ]);
    expect(handsOf(four, 'farm')).toEqual({ adapted: 3, adapting: 1 });
    // Saem mais dois: o último novato e um veterano.
    const two = accept(four, order('farm', 2)).state;
    expect(cohorts(two)).toEqual([]);
    expect(handsOf(two, 'farm')).toEqual({ adapted: 2, adapting: 0 });
  });

  it('tirar gente de um edifício não mexe nas coortes dos outros', () => {
    const state = play(midDay(), [
      order('quarry', 2),
      order('lumberMill', 2),
      order('quarry', 0),
    ]).state;
    expect(cohorts(state)).toEqual([
      { building: 'lumberMill', count: 2, untilMs: 2 * HOUR + 30 * MINUTE },
    ]);
  });

  it('duas ordens no mesmo instante para o mesmo edifício são uma coorte só', () => {
    const state = play(midDay(), [order('quarry', 1), order('quarry', 3)]).state;
    expect(cohorts(state)).toEqual([
      { building: 'quarry', count: 3, untilMs: 2 * HOUR + 30 * MINUTE },
    ]);
  });

  it('repetir a ordem com o mesmo número não recomeça a adaptação', () => {
    const moved = accept(midDay(), order('quarry', 2)).state;
    const later = advanceTo(moved, 90 * MINUTE).state;
    expect(accept(later, order('quarry', 2)).state).toStrictEqual(later);
  });

  it('realocar o mesmo aldeão duas vezes no dia não zera nem dobra o prazo', () => {
    // Um aldeão vai para a Pedreira, sai uma hora depois e volta no mesmo instante: é uma
    // coorte só, de um aldeão, com um dia de jogo a contar da última troca.
    const there = accept(midDay(), order('quarry', 1)).state;
    const back = play(advanceTo(there, 90 * MINUTE).state, [
      order('quarry', 0),
      order('quarry', 1),
    ]).state;
    expect(cohorts(back)).toEqual([{ building: 'quarry', count: 1, untilMs: 90 * MINUTE + DAY }]);
    // E quem volta para o ofício antigo também recomeça: um veterano da Fazenda que foi à
    // Pedreira e voltou é um novato na Fazenda, e não deixa coorte na Pedreira.
    const round = play(midDay(), [
      order('farm', 2),
      order('quarry', 1),
      { at: 90 * MINUTE },
      order('quarry', 0),
      order('farm', 3),
    ]).state;
    expect(cohorts(round)).toEqual([{ building: 'farm', count: 1, untilMs: 90 * MINUTE + DAY }]);
    expect(handsOf(round, 'farm')).toEqual({ adapted: 2, adapting: 1 });
  });

  it('quem chega ao feudo e ganha ofício também se adapta', () => {
    const state = accept(newGame(), order('farm', 2)).state;
    expect(cohorts(state)).toEqual([{ building: 'farm', count: 2, untilMs: DAY }]);
    // 2 × 10 × 1,2 (primavera) × metade.
    expect(productionRate(state, 'farm')).toBe(12_000);
  });

  it('a recusa não cria coorte nem tira ninguém do lugar', () => {
    const state = accept(midDay(), order('quarry', 2)).state;
    const before = cloneState(state);
    expect(refuse(state, order('quarry', 9)).code).toBe('NOT_ENOUGH_VILLAGERS');
    expect(state).toStrictEqual(before);
  });

  describe('a soma dos trabalhadores nunca passa dos habitantes', () => {
    const crowded = () =>
      gameAt(30 * MINUTE, (draft) => {
        const { settlement } = draft;
        settlement.population.villagers = 10;
        settlement.workers = { farm: 4, lumberMill: 4, quarry: 2, goldMine: 0 };
        settlement.adaptation = [
          { building: 'lumberMill', count: 1, untilMs: HOUR },
          { building: 'farm', count: 1, untilMs: 90 * MINUTE },
          { building: 'farm', count: 1, untilMs: 2 * HOUR },
        ];
      });

    it('com gente para todos, ninguém sai', () => {
      const draft = crowded();
      const before = cloneState(draft);
      expect(releaseExcessWorkers(draft)).toEqual({});
      expect(draft).toStrictEqual(before);
    });

    it('quando a população cai, sai gente do edifício com mais trabalhadores, primeiro quem se adapta', () => {
      const draft = crowded();
      draft.settlement.population.villagers = 7;
      // Fazenda e Serraria empatam em 4: sai da Fazenda, a primeira na ordem do conteúdo, o
      // novato mais novo. A Serraria passa a ser a maior: sai o novato dela. De novo empate
      // em 3: sai o outro novato da Fazenda.
      expect(releaseExcessWorkers(draft)).toEqual({ farm: 2, lumberMill: 1 });
      expect(draft.settlement.workers).toEqual({ farm: 2, lumberMill: 3, quarry: 2, goldMine: 0 });
      expect(draft.settlement.adaptation).toEqual([]);
      expect(assignedWorkers(draft)).toBe(7);
      expect(freeVillagers(draft)).toBe(0);
    });

    it('sem novatos no edifício, sai um veterano', () => {
      const draft = crowded();
      draft.settlement.adaptation = [{ building: 'quarry', count: 2, untilMs: HOUR }];
      draft.settlement.population.villagers = 9;
      expect(releaseExcessWorkers(draft)).toEqual({ farm: 1 });
      expect(draft.settlement.workers.farm).toBe(3);
      // Os novatos da Pedreira, que não é a maior, ficam onde estão.
      expect(draft.settlement.adaptation).toEqual([
        { building: 'quarry', count: 2, untilMs: HOUR },
      ]);
    });

    it('um feudo que perde todo mundo fica sem trabalhadores e sem coortes', () => {
      const draft = crowded();
      draft.settlement.population.villagers = 0;
      releaseExcessWorkers(draft);
      expect(assignedWorkers(draft)).toBe(0);
      expect(draft.settlement.adaptation).toEqual([]);
    });
  });
});

describe('recrutar', () => {
  it('desconta o custo na ordem e cada aldeão chega 20 minutos depois do anterior', () => {
    // No verão o prazo é o de tabela: 20 minutos por aldeão.
    const { state, events } = accept(gameAt(SUMMER), command('recruitVillagers', { quantity: 3 }));
    expect(state.settlement.resources).toMatchObject({ food: 30_000, gold: 220_000 });
    expect(state.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: SUMMER + 20 * MINUTE },
      { finishesAtMs: SUMMER + 40 * MINUTE },
      { finishesAtMs: SUMMER + 60 * MINUTE },
    ]);
    expect(state.settlement.population.villagers).toBe(5);
    expect(events).toMatchObject([{ type: 'recruitmentStarted', data: { quantity: 3 } }]);

    const first = advanceTo(state, SUMMER + 20 * MINUTE);
    expect(first.state.settlement.population.villagers).toBe(6);
    const all = advanceTo(first.state, SUMMER + HOUR);
    expect(all.state.settlement.population.villagers).toBe(8);
    expect(eventsOfType(all.events, 'recruitmentFinished').map((event) => event.atMs)).toEqual([
      SUMMER + 40 * MINUTE,
      SUMMER + 60 * MINUTE,
    ]);
    expect(all.state.stats.villagersRecruited).toBe(3);
  });

  it('ordenado na primavera, o treinamento leva × 0,8: 16 minutos por aldeão', () => {
    const { state } = accept(newGame(), command('recruitVillagers', { quantity: 3 }));
    expect(state.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 16 * MINUTE },
      { finishesAtMs: 32 * MINUTE },
      { finishesAtMs: 48 * MINUTE },
    ]);
    const all = advanceTo(state, HOUR);
    expect(eventsOfType(all.events, 'recruitmentFinished').map((event) => event.atMs)).toEqual([
      16 * MINUTE,
      32 * MINUTE,
      48 * MINUTE,
    ]);
  });

  it.each([
    ['verão', SUMMER],
    ['outono', AUTUMN],
    ['inverno', WINTER],
  ])('ordenado no %s, o treinamento leva os 20 minutos de tabela', (_, season) => {
    const rich = gameAt(season, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 900_000;
    });
    const { state } = accept(rich, command('recruitVillagers', { quantity: 1 }));
    expect(state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: season + 20 * MINUTE }]);
  });

  it('o prazo é o da estação da ordem: não muda quando a estação vira com a fila andando', () => {
    // Ordem dada 20 minutos antes do verão: os três chegam de 16 em 16 minutos, dois deles já
    // no verão. E a ordem dada no verão conta 20 minutos, mesmo atrás de uma fila da primavera.
    const before = gameAt(SUMMER - 20 * MINUTE, (draft) => {
      draft.settlement.resources.food = 900_000;
    });
    const spring = accept(before, command('recruitVillagers', { quantity: 3 })).state;
    expect(spring.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: SUMMER - 4 * MINUTE },
      { finishesAtMs: SUMMER + 12 * MINUTE },
      { finishesAtMs: SUMMER + 28 * MINUTE },
    ]);
    const turned = advanceTo(spring, SUMMER + MINUTE);
    expect(eventsOfType(turned.events, 'seasonChanged')).toHaveLength(1);
    expect(turned.state.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: SUMMER + 12 * MINUTE },
      { finishesAtMs: SUMMER + 28 * MINUTE },
    ]);
    const summer = accept(turned.state, command('recruitVillagers', { quantity: 1 })).state;
    expect(summer.settlement.recruitmentQueue[2]).toEqual({ finishesAtMs: SUMMER + 48 * MINUTE });
    const all = advanceTo(summer, SUMMER + HOUR);
    expect(eventsOfType(all.events, 'recruitmentFinished').map((event) => event.atMs)).toEqual([
      SUMMER + 12 * MINUTE,
      SUMMER + 28 * MINUTE,
      SUMMER + 48 * MINUTE,
    ]);
  });

  it('uma segunda ordem entra depois do último da fila', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 500_000;
    });
    const first = accept(state, command('recruitVillagers', { quantity: 2 })).state;
    const later = advanceTo(first, 25 * MINUTE).state;
    const second = accept(later, command('recruitVillagers', { quantity: 1 })).state;
    // Primavera: 16 minutos cada. O primeiro chegou aos 16; o da segunda ordem entra atrás do
    // que ainda falta, aos 32.
    expect(second.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 32 * MINUTE },
      { finishesAtMs: 48 * MINUTE },
    ]);
  });

  it('com a fila vazia, conta o prazo a partir de agora', () => {
    const later = advanceTo(newGame(), 7 * MINUTE).state;
    const { state } = accept(later, command('recruitVillagers', { quantity: 1 }));
    expect(state.settlement.recruitmentQueue).toEqual([{ finishesAtMs: 23 * MINUTE }]);
  });

  it('recrutar 3 com 1 vaga é recusado e nenhum recurso é descontado', () => {
    const crowded = gameWith((draft) => {
      draft.settlement.population.villagers = 9;
      draft.settlement.resources.food = 900_000;
    });
    const refusal = refuse(crowded, command('recruitVillagers', { quantity: 3 }));
    expect(refusal).toEqual({
      code: 'HOUSING_FULL',
      message: 'Só há vaga para mais 1 nas Habitações.',
    });
    expect(crowded.settlement.resources.food).toBe(900_000);
    expect(crowded.settlement.recruitmentQueue).toEqual([]);
  });

  it('quem está em treinamento já ocupa vaga', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources.food = 900_000;
    });
    const queued = accept(state, command('recruitVillagers', { quantity: 5 })).state;
    expect(housingVacancy(queued)).toBe(0);
    const arrived = advanceTo(queued, 2 * HOUR).state;
    expect(refuse(arrived, command('recruitVillagers', { quantity: 1 }))).toEqual({
      code: 'HOUSING_FULL',
      message: 'Não há vaga nas Habitações. Melhore as Habitações ou o Salão.',
    });
  });

  it('a fila aceita no máximo 5 aldeões', () => {
    const roomy = gameWith((draft) => {
      draft.settlement.resources.food = 900_000;
      draft.settlement.buildings.housing = 5;
    });
    const queued = accept(roomy, command('recruitVillagers', { quantity: 3 })).state;
    expect(refuse(queued, command('recruitVillagers', { quantity: 3 }))).toEqual({
      code: 'RECRUIT_QUEUE_FULL',
      message: 'Só cabem mais 2 na fila de recrutamento.',
    });
    const full = accept(queued, command('recruitVillagers', { quantity: 2 })).state;
    expect(refuse(full, command('recruitVillagers', { quantity: 1 })).message).toBe(
      'Já há 5 aldeões a caminho. Espere algum chegar.',
    );
  });

  it('recusa sem comida ou ouro para a ordem inteira', () => {
    expect(refuse(newGame(), command('recruitVillagers', { quantity: 4 }))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 20 comida.',
    });
  });

  it.each([0, 6, -1, 2.5])('recusa a quantidade %d', (quantity) => {
    expect(refuse(newGame(), command('recruitVillagers', { quantity }))).toEqual({
      code: 'INVALID_QUANTITY',
      message: 'Recrute de 1 a 5 aldeões por ordem.',
    });
  });

  it('com fome, a ordem é recusada e a fila em andamento congela', () => {
    const starving = gameWith((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.resources.gold = 900_000;
      draft.settlement.famine = { sinceMs: 0 };
      draft.settlement.recruitmentQueue = [{ finishesAtMs: 10 * MINUTE }];
    });
    expect(refuse(starving, command('recruitVillagers', { quantity: 1 })).code).toBe('FAMINE');
    const later = advanceTo(starving, 5 * HOUR);
    expect(later.state.settlement.population.villagers).toBe(5);
    expect(eventsOfType(later.events, 'recruitmentFinished')).toEqual([]);
  });
});
