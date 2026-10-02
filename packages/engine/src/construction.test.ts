import { balance, BUILDING_IDS, buildings } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { upgradeCost, upgradeDurationMs, upgradeQuote } from './construction';
import { housingCapacity } from './population';
import {
  accept,
  AUTUMN,
  command,
  eventsOfType,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  refuse,
  SPRING,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import type { BuildingId, GameState } from './types';

const rich = gameWith((draft) => {
  draft.settlement.resources = { food: 9e6, wood: 9e6, stone: 9e6, gold: 9e6 };
});

describe('fórmulas de custo e tempo (GDD §6.2)', () => {
  it.each([
    ['townHall', 1, { wood: 150, stone: 100, gold: 100 }, 600],
    ['townHall', 2, { wood: 270, stone: 180, gold: 180 }, 900],
    ['townHall', 3, { wood: 486, stone: 324, gold: 324 }, 1350],
    ['townHall', 4, { wood: 875, stone: 583, gold: 583 }, 2025],
    ['farm', 1, { wood: 80, gold: 40 }, 300],
    ['farm', 2, { wood: 128, gold: 64 }, 450],
    ['farm', 3, { wood: 205, gold: 102 }, 675],
    ['farm', 4, { wood: 328, gold: 164 }, 1012.5],
    ['lumberMill', 1, { wood: 100, stone: 50 }, 300],
    ['lumberMill', 2, { wood: 160, stone: 80 }, 450],
    ['lumberMill', 3, { wood: 256, stone: 128 }, 675],
    ['lumberMill', 4, { wood: 410, stone: 205 }, 1012.5],
    ['quarry', 1, { wood: 120, gold: 30 }, 360],
    ['quarry', 2, { wood: 192, gold: 48 }, 540],
    ['quarry', 3, { wood: 307, gold: 77 }, 810],
    ['quarry', 4, { wood: 492, gold: 123 }, 1215],
    ['goldMine', 1, { wood: 120, stone: 80 }, 480],
    ['goldMine', 2, { wood: 192, stone: 128 }, 720],
    ['goldMine', 3, { wood: 307, stone: 205 }, 1080],
    ['goldMine', 4, { wood: 492, stone: 328 }, 1620],
    ['housing', 1, { wood: 80, stone: 20 }, 240],
    ['housing', 2, { wood: 128, stone: 32 }, 360],
    ['housing', 3, { wood: 205, stone: 51 }, 540],
    ['housing', 4, { wood: 328, stone: 82 }, 810],
  ] as const)('%s do nível %i para o seguinte', (building, fromLevel, cost, seconds) => {
    expect(upgradeCost(building, fromLevel)).toEqual(cost);
    expect(upgradeDurationMs(building, fromLevel)).toBe(seconds * 1000);
  });

  it('a conta inteira bate com arredondar(base × fator^obras já feitas) em todos os níveis', () => {
    for (const building of BUILDING_IDS) {
      const factor = building === 'townHall' ? 1.8 : 1.6;
      const { initialLevel, maxLevel, baseCost } = buildings[building];
      for (let level = initialLevel; level < maxLevel; level += 1) {
        const cost = upgradeCost(building, level);
        for (const [resource, base] of Object.entries(baseCost)) {
          // O expoente conta as obras desde o nível com que o edifício nasce.
          const expected = Math.round(base * factor ** (level - initialLevel));
          expect(cost[resource as keyof typeof cost]).toBe(expected);
        }
      }
    }
  });

  it.each([
    ['granary', 0, { wood: 160, stone: 80 }, 600],
    ['granary', 1, { wood: 256, stone: 128 }, 900],
    ['granary', 2, { wood: 410, stone: 205 }, 1350],
    ['warehouse', 0, { wood: 160, stone: 80 }, 600],
    ['warehouse', 1, { wood: 256, stone: 128 }, 900],
    ['warehouse', 7, { wood: 4295, stone: 2147 }, 10251.5625],
  ] as const)(
    '%s do nível %i para o seguinte: construir sai pelo custo base',
    (building, fromLevel, cost, seconds) => {
      expect(upgradeCost(building, fromLevel)).toEqual(cost);
      expect(upgradeDurationMs(building, fromLevel)).toBe(Math.floor(seconds * 1000));
    },
  );

  it('nenhuma obra passa de 8 horas', () => {
    expect(upgradeDurationMs('goldMine', 30)).toBe(8 * HOUR);
    expect(balance.construction.maxDurationMs).toBe(8 * HOUR);
  });
});

describe('upgradeQuote', () => {
  it('Serraria 1→2 custa 100 madeira e 50 pedra e leva 300 s', () => {
    const quote = upgradeQuote(newGame(), 'lumberMill');
    expect(quote).toMatchObject({
      fromLevel: 1,
      targetLevel: 2,
      cost: { wood: 100, stone: 50 },
      durationMs: 300_000,
      missing: {},
      blocked: null,
    });
  });

  it('Habitações 2→3 custa 128 madeira e 32 pedra e leva 360 s', () => {
    const state = gameWith((draft) => {
      draft.settlement.buildings.housing = 2;
    });
    expect(upgradeQuote(state, 'housing')).toMatchObject({
      cost: { wood: 128, stone: 32 },
      durationMs: 360_000,
    });
  });

  it('informa o que falta para pagar', () => {
    const quote = upgradeQuote(newGame(), 'townHall');
    expect(quote.missing).toEqual({ wood: 30, stone: 35 });
    expect(quote.blocked).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 30 madeira e 35 pedra.',
    });
  });
});

describe('iniciar', () => {
  it('desconta o custo uma única vez, ocupa a fila e registra o fim', () => {
    const { state, events } = accept(newGame(), command('startConstruction', { building: 'farm' }));
    expect(state.settlement.resources).toMatchObject({ wood: 40_000, gold: 210_000 });
    expect(state.settlement.constructionQueues).toEqual([
      { building: 'farm', targetLevel: 2, startedAtMs: 0, finishesAtMs: 5 * MINUTE },
      null,
    ]);
    expect(state.settlement.buildings.farm).toBe(1);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      type: 'constructionStarted',
      atMs: 0,
      data: { building: 'farm', level: 2 },
    });
    // Avançar não desconta de novo.
    const later = advanceTo(state, 4 * MINUTE).state;
    expect(later.settlement.resources).toMatchObject({ wood: 40_000, gold: 210_000 });
  });

  it('recusa com a fila ocupada, e diz o que abre a segunda', () => {
    const busy = accept(rich, command('startConstruction', { building: 'farm' })).state;
    expect(refuse(busy, command('startConstruction', { building: 'quarry' }))).toEqual({
      code: 'QUEUE_LOCKED',
      message:
        'Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4.',
    });
  });

  it('recusa o edifício que já está em obras', () => {
    const busy = accept(rich, command('startConstruction', { building: 'farm' })).state;
    expect(refuse(busy, command('startConstruction', { building: 'farm' }))).toEqual({
      code: 'ALREADY_UPGRADING',
      message: 'A Fazenda já está em obras.',
    });
  });

  it('recusa acima do nível máximo', () => {
    const maxed = gameWith((draft) => {
      Object.assign(draft.settlement, rich.settlement);
      draft.settlement.buildings = { ...draft.settlement.buildings, townHall: 8 };
    });
    expect(refuse(maxed, command('startConstruction', { building: 'townHall' }))).toEqual({
      code: 'MAX_LEVEL',
      message: 'O Salão do Senhor já está no nível máximo.',
    });
  });

  it('um edifício nunca ultrapassa o nível do Salão + 1', () => {
    const atGate = gameWith((draft) => {
      Object.assign(draft.settlement, rich.settlement);
      draft.settlement.buildings = { ...draft.settlement.buildings, farm: 2 };
    });
    expect(refuse(atGate, command('startConstruction', { building: 'farm' }))).toEqual({
      code: 'GATE_LOCKED',
      message: 'Melhore antes o Salão do Senhor para o nível 2.',
    });
    // O próprio Salão não tem trava.
    expect(upgradeQuote(atGate, 'townHall').blocked).toBeNull();
  });

  it('recusa sem recursos e diz quanto falta', () => {
    expect(refuse(newGame(), command('startConstruction', { building: 'goldMine' }))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 15 pedra.',
    });
  });

  it('recusa um edifício que não existe', () => {
    const bogus = command('startConstruction', { building: 'barracks' as BuildingId });
    expect(refuse(newGame(), bogus).code).toBe('INVALID_BUILDING');
  });
});

describe('concluir', () => {
  it('o nível sobe no instante exato, não antes', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'housing' })).state;
    const before = advanceTo(started, 4 * MINUTE - 1);
    expect(before.state.settlement.buildings.housing).toBe(1);
    expect(eventsOfType(before.events, 'constructionFinished')).toEqual([]);

    const { state, events } = advanceTo(before.state, 4 * MINUTE);
    expect(state.settlement.buildings.housing).toBe(2);
    expect(state.settlement.constructionQueues).toEqual([null, null]);
    const [finished] = eventsOfType(events, 'constructionFinished');
    expect(finished).toMatchObject({ atMs: 4 * MINUTE, data: { building: 'housing', level: 2 } });
    expect(finished?.text).toBe(
      'No 1º dia da Primavera, os pedreiros ergueram as Habitações ao 2º nível.',
    );
  });

  it('a capacidade habitacional derivada muda junto', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'housing' })).state;
    expect(housingCapacity(started)).toBe(10);
    expect(housingCapacity(advanceTo(started, 4 * MINUTE).state)).toBe(15);
  });

  it('o nível novo passa a valer na produção a partir da conclusão', () => {
    const start = gameWith((draft) => {
      draft.settlement.workers.lumberMill = 5;
    });
    const started = accept(start, command('startConstruction', { building: 'lumberMill' })).state;
    const wood = advanceTo(started, 65 * MINUTE).state.settlement.resources.wood;
    // 5 min a 40/h e 60 min a 48/h, depois de pagar 100 de madeira.
    expect(wood).toBe(20_000 + Math.floor((40_000 * 5 + 48_000 * 60) / 60));
  });
});

describe('obras e estações (GDD §4.1)', () => {
  const richAt = (atMs: number) =>
    gameAt(atMs, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources = { food: 9e6, wood: 9e6, stone: 9e6, gold: 9e6 };
    });
  const finishOf = (state: GameState) => state.settlement.constructionQueues[0]?.finishesAtMs;

  it('a obra iniciada no inverno dura × 1,5', () => {
    const started = accept(richAt(WINTER), command('startConstruction', { building: 'housing' }));
    // Habitações 1→2: 4 min de tabela, 6 min no inverno.
    expect(started.state.settlement.constructionQueues).toEqual([
      {
        building: 'housing',
        targetLevel: 2,
        startedAtMs: WINTER,
        finishesAtMs: WINTER + 6 * MINUTE,
      },
      null,
    ]);
    const before = advanceTo(started.state, WINTER + 6 * MINUTE - 1);
    expect(before.state.settlement.buildings.housing).toBe(1);
    const { state, events } = advanceTo(before.state, WINTER + 6 * MINUTE);
    expect(state.settlement.buildings.housing).toBe(2);
    expect(eventsOfType(events, 'constructionFinished')).toMatchObject([
      { atMs: WINTER + 6 * MINUTE },
    ]);
  });

  it.each([
    ['primavera', SPRING],
    ['verão', SUMMER],
    ['outono', AUTUMN],
  ])('na %s a obra leva o prazo de tabela', (_, season) => {
    const started = accept(richAt(season), command('startConstruction', { building: 'housing' }));
    expect(finishOf(started.state)).toBe(season + 4 * MINUTE);
  });

  it('a obra em curso na virada para o inverno mantém o prazo com que começou', () => {
    const start = richAt(WINTER - 2 * MINUTE);
    const started = accept(start, command('startConstruction', { building: 'housing' })).state;
    expect(finishOf(started)).toBe(WINTER + 2 * MINUTE);
    const turned = advanceTo(started, WINTER + MINUTE);
    expect(eventsOfType(turned.events, 'seasonChanged')).toHaveLength(1);
    expect(finishOf(turned.state)).toBe(WINTER + 2 * MINUTE);
    expect(advanceTo(turned.state, WINTER + 2 * MINUTE).state.settlement.buildings.housing).toBe(2);
  });

  it('a obra iniciada no inverno não encurta quando a primavera chega', () => {
    const start = richAt(YEAR - 2 * MINUTE);
    const started = accept(start, command('startConstruction', { building: 'housing' })).state;
    expect(finishOf(started)).toBe(YEAR + 4 * MINUTE);
    const turned = advanceTo(started, YEAR + 2 * MINUTE + 1);
    expect(turned.state.settlement.buildings.housing).toBe(1);
    expect(advanceTo(turned.state, YEAR + 4 * MINUTE).state.settlement.buildings.housing).toBe(2);
  });

  it('cancelar no inverno devolve os mesmos 80%: a estação mexe no prazo, não no custo', () => {
    const start = gameAt(WINTER, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.wood = 400_000;
    });
    const started = accept(start, command('startConstruction', { building: 'quarry' }));
    const cancelled = accept(started.state, command('cancelConstruction', { building: 'quarry' }));
    expect(cancelled.state.settlement.resources.wood).toBe(400_000 - 120_000 + 96_000);
    expect(cancelled.state.settlement.resources.gold).toBe(250_000 - 30_000 + 24_000);
  });

  it('o orçamento de uma obra já traz o prazo da estação', () => {
    expect(upgradeQuote(richAt(WINTER), 'lumberMill').durationMs).toBe(450_000);
    expect(upgradeQuote(richAt(AUTUMN), 'lumberMill').durationMs).toBe(300_000);
  });
});

describe('cancelar', () => {
  it('devolve 80% do que foi pago e libera a fila', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'quarry' })).state;
    const { state, events } = accept(
      started,
      command('cancelConstruction', { building: 'quarry' }),
    );
    // Pagou 120 madeira e 30 ouro; voltam 96 e 24.
    expect(state.settlement.resources).toMatchObject({ wood: 96_000, gold: 244_000 });
    expect(state.settlement.constructionQueues).toEqual([null, null]);
    expect(state.settlement.buildings.quarry).toBe(1);
    expect(events[0]).toMatchObject({
      type: 'constructionCancelled',
      data: { building: 'quarry' },
    });
    expect(
      accept(state, command('startConstruction', { building: 'housing' })).state,
    ).toBeDefined();
  });

  it('arredonda o reembolso para baixo, em milésimos', () => {
    const state = gameWith((draft) => {
      draft.settlement.resources = { food: 400_000, wood: 400_000, stone: 400_000, gold: 400_000 };
      draft.settlement.buildings = { ...draft.settlement.buildings, townHall: 4, housing: 4 };
    });
    // Habitações 4→5: 328 madeira e 82 pedra; 80% = 262,4 e 65,6.
    // Iniciar a obra cumpre o objetivo das Habitações, que rende +30 madeira.
    const started = accept(state, command('startConstruction', { building: 'housing' })).state;
    const cancelled = accept(started, command('cancelConstruction', { building: 'housing' })).state;
    expect(cancelled.settlement.resources.wood).toBe(400_000 - 328_000 + 30_000 + 262_400);
    expect(cancelled.settlement.resources.stone).toBe(400_000 - 82_000 + 65_600);
  });

  it('recusa quando não há obra daquele edifício', () => {
    expect(refuse(newGame(), command('cancelConstruction', { building: 'farm' }))).toEqual({
      code: 'NOT_IN_CONSTRUCTION',
      message: 'A Fazenda não está em obras.',
    });
    const bogus = command('cancelConstruction', { building: 'tower' as BuildingId });
    expect(refuse(newGame(), bogus).code).toBe('INVALID_BUILDING');
  });
});

describe('planejar', () => {
  it('entra na lista sem gastar nada nem ocupar a fila', () => {
    const { state, events } = accept(
      newGame(),
      command('planConstruction', { building: 'townHall' }),
    );
    expect(state.settlement.planned).toEqual([
      { building: 'townHall', targetLevel: 2, autoStart: false },
    ]);
    expect(state.settlement.resources).toEqual(newGame().settlement.resources);
    expect(state.settlement.constructionQueues).toEqual([null, null]);
    expect(events).toEqual([]);
    // Sem a marca de automática, a planejada espera a ordem do jogador, por mais que sobre.
    const later = gameWith((draft) => {
      Object.assign(draft.settlement, rich.settlement);
      draft.settlement.planned = state.settlement.planned;
    });
    expect(advanceTo(later, 24 * HOUR).state.settlement.buildings.townHall).toBe(1);
  });

  it('planeja o nível seguinte ao da obra em andamento', () => {
    const started = accept(newGame(), command('startConstruction', { building: 'farm' })).state;
    const { state } = accept(started, command('planConstruction', { building: 'farm' }));
    expect(state.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 3, autoStart: false },
    ]);
  });

  it('recusa plano repetido, acima do nível máximo ou de edifício inexistente', () => {
    const planned = accept(newGame(), command('planConstruction', { building: 'farm' })).state;
    expect(refuse(planned, command('planConstruction', { building: 'farm' }))).toEqual({
      code: 'ALREADY_PLANNED',
      message: 'A Fazenda já está na lista de obras planejadas.',
    });
    const maxed = gameWith((draft) => {
      draft.settlement.buildings.townHall = 8;
    });
    expect(refuse(maxed, command('planConstruction', { building: 'townHall' })).code).toBe(
      'MAX_LEVEL',
    );
    const bogus = command('planConstruction', { building: 'tower' as BuildingId });
    expect(refuse(newGame(), bogus).code).toBe('INVALID_BUILDING');
  });

  it('iniciar a obra tira o edifício da lista de planejadas', () => {
    const planned = accept(newGame(), command('planConstruction', { building: 'farm' })).state;
    const started = accept(planned, command('startConstruction', { building: 'farm' })).state;
    expect(started.settlement.planned).toEqual([]);
  });

  it('desplanejar remove da lista e recusa o que não está nela', () => {
    const planned = accept(newGame(), command('planConstruction', { building: 'farm' })).state;
    const { state } = accept(planned, command('unplanConstruction', { building: 'farm' }));
    expect(state.settlement.planned).toEqual([]);
    expect(refuse(state, command('unplanConstruction', { building: 'farm' }))).toEqual({
      code: 'NOT_PLANNED',
      message: 'A Fazenda não está na lista de obras planejadas.',
    });
    const bogus = command('unplanConstruction', { building: 'tower' as BuildingId });
    expect(refuse(newGame(), bogus).code).toBe('INVALID_BUILDING');
  });
});
