import { balance, BUILDING_IDS, buildings } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { upgradeCost, upgradeDurationMs, upgradeQuote } from './construction';
import { housingCapacity } from './population';
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
  refuse,
  SPRING,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import type { BuildingId, GameState } from './types';
import { deriveViewState } from './view';

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

  it('a recusa concorda com o edifício: o verbo vai no plural quando o artigo do conteúdo é plural', () => {
    // O número vem do artigo que o conteúdo guarda ("as Habitações"), não do nome do edifício.
    const plural = BUILDING_IDS.filter((id) => buildings[id].article.endsWith('s'));
    expect(plural).toEqual(['housing']);
    for (const id of BUILDING_IDS) {
      const { article, label } = buildings[id];
      const subject = `${article.charAt(0).toUpperCase()}${article.slice(1)} ${label}`;
      const verb = plural.includes(id) ? 'estão' : 'está';
      expect(refuse(newGame(), command('cancelConstruction', { building: id }))).toEqual({
        code: 'NOT_IN_CONSTRUCTION',
        message: `${subject} não ${verb} em obras.`,
      });
      expect(refuse(newGame(), command('unplanConstruction', { building: id }))).toEqual({
        code: 'NOT_PLANNED',
        message: `${subject} não ${verb} na lista de obras planejadas.`,
      });
    }

    const busy = accept(rich, command('startConstruction', { building: 'housing' })).state;
    expect(refuse(busy, command('startConstruction', { building: 'housing' })).message).toBe(
      'As Habitações já estão em obras.',
    );
    expect(refuse(newGame(), command('cancelConstruction', { building: 'housing' })).message).toBe(
      'As Habitações não estão em obras.',
    );
    const planned = accept(newGame(), command('planConstruction', { building: 'housing' })).state;
    expect(refuse(planned, command('planConstruction', { building: 'housing' })).message).toBe(
      'As Habitações já estão na lista de obras planejadas.',
    );
    const auto = command('setAutoStart', { building: 'housing', autoStart: true });
    expect(refuse(newGame(), auto).message).toBe(
      'As Habitações não estão na lista de obras planejadas.',
    );
    const maxed = gameWith((draft) => {
      draft.settlement.buildings.housing = buildings.housing.maxLevel;
    });
    const top = 'As Habitações já estão no nível máximo.';
    expect(refuse(maxed, command('startConstruction', { building: 'housing' })).message).toBe(top);
    expect(refuse(maxed, command('planConstruction', { building: 'housing' })).message).toBe(top);
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

describe('a Paliçada como obra (GDD §6.1 e §6.2)', () => {
  /** Um feudo com o Salão no nível `townHall`, estoque de sobra e a Paliçada no nível pedido. */
  const feud = (townHall: number, palisade = 0, atMs = 10 * DAY) =>
    gameAt(atMs, (draft) => {
      draft.settlement.buildings.townHall = townHall;
      draft.settlement.buildings.palisade = palisade;
      draft.settlement.resources = { food: 400_000, wood: 450_000, stone: 400_000, gold: 400_000 };
    });
  const palisade = (state: GameState) =>
    deriveViewState(state, state.lastProcessedAt).constructions.available.find(
      (upgrade) => upgrade.building === 'palisade',
    );
  const start = command('startConstruction', { building: 'palisade' });

  it('aparece na lista desde o começo, presa ao Salão no nível 3, com o que ela segura ao lado do custo', () => {
    expect(palisade(newGame())).toMatchObject({
      label: 'Paliçada',
      fromLevel: 0,
      targetLevel: 1,
      blockedCode: 'GATE_LOCKED',
      blockedReason: 'Melhore antes o Salão do Senhor para o nível 3.',
      durationSeconds: 20 * 60,
      effect:
        'Segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
    });
    expect(palisade(newGame())?.cost.map((cost) => [cost.resource, cost.amount])).toEqual([
      ['wood', 200],
      ['stone', 50],
    ]);
  });

  it('o gate é o Salão no nível 3: com 1 ou 2 a ordem é recusada, de iniciar e de começar sozinha', () => {
    for (const townHall of [1, 2]) {
      expect(refuse(feud(townHall), start)).toEqual({
        code: 'GATE_LOCKED',
        message: 'Melhore antes o Salão do Senhor para o nível 3.',
      });
    }
    expect(palisade(feud(3))).toMatchObject({ blockedCode: null, affordable: true });
    // Planejar pode, em qualquer nível do Salão: a obra espera o que falta.
    const planned = accept(
      feud(2),
      command('planConstruction', { building: 'palisade', autoStart: true }),
    ).state;
    expect(planned.settlement.planned).toEqual([
      { building: 'palisade', targetLevel: 1, autoStart: true },
    ]);
    expect(advanceTo(planned, 40 * DAY).state.settlement.buildings.palisade).toBe(0);
    const view = deriveViewState(planned, planned.lastProcessedAt);
    expect(view.constructions.planned[0]?.waiting).toEqual({
      reason: 'gate',
      text: 'espera o Salão do Senhor chegar ao nível 3: melhore-o',
      etaSeconds: null,
    });
  });

  it('com o Salão no nível 3 é erguida por 200 de madeira e 50 de pedra, em 20 min, com as frases de quem nasce do zero', () => {
    const started = accept(feud(3), start);
    expect(started.state.settlement.resources).toEqual({
      food: 400_000,
      wood: 250_000,
      stone: 350_000,
      gold: 400_000,
    });
    expect(started.events.map((event) => [event.type, event.data, event.text])).toEqual([
      [
        'constructionStarted',
        { building: 'palisade', level: 1, spent_wood: 200, spent_stone: 50 },
        'No 11º dia da Primavera, os pedreiros começaram a levantar a Paliçada em Pedra Alta.',
      ],
    ]);
    const early = advanceTo(started.state, 10 * DAY + 20 * MINUTE - 1);
    expect(early.state.settlement.buildings.palisade).toBe(0);
    const done = advanceTo(started.state, 10 * DAY + 20 * MINUTE);
    expect(done.state.settlement.buildings.palisade).toBe(1);
    expect(done.state.settlement.constructionQueues).toEqual([null, null]);
    expect(eventsOfType(done.events, 'buildingFounded').map((event) => event.text)).toEqual([
      'No 11º dia da Primavera, ergueu-se a Paliçada em Pedra Alta.',
    ]);
  });

  it('o nível 2 custa o base × 1,6 (320 de madeira e 80 de pedra) e leva 30 min; a frase diz só o que muda', () => {
    const state = feud(3, 1);
    expect(palisade(state)).toMatchObject({
      fromLevel: 1,
      targetLevel: 2,
      blockedCode: null,
      durationSeconds: 30 * 60,
      effect: 'Passa a segurar também os ataques médios, sem perda nem ferido.',
    });
    expect(palisade(state)?.cost.map((cost) => cost.amount)).toEqual([320, 80]);
    expect(upgradeCost('palisade', 0)).toEqual({ wood: 200, stone: 50 });
    expect(upgradeCost('palisade', 1)).toEqual({ wood: 320, stone: 80 });
    expect(upgradeDurationMs('palisade', 0)).toBe(20 * MINUTE);
    expect(upgradeDurationMs('palisade', 1)).toBe(30 * MINUTE);
    const { state: after, events } = advanceTo(accept(state, start).state, 10 * DAY + 30 * MINUTE);
    expect(after.settlement.buildings.palisade).toBe(2);
    expect(eventsOfType(events, 'constructionFinished').map((event) => event.text)).toEqual([
      'No 11º dia da Primavera, os pedreiros ergueram a Paliçada ao 2º nível.',
    ]);
  });

  it('o custo dos dois níveis cabe no Pátio de um feudo sem Armazém, em toda dificuldade', () => {
    for (const difficulty of ['peasant', 'lord', 'ironKing'] as const) {
      for (const level of [0, 1]) {
        const state = gameWith((draft) => {
          draft.settings.difficulty = difficulty;
          draft.settlement.buildings.townHall = 3;
          draft.settlement.buildings.palisade = level;
        });
        expect(palisade(state)?.blockedCode, `${difficulty}/${level}`).not.toBe('EXCEEDS_STORAGE');
      }
    }
  });

  it('no nível 2 sai da lista, e a recusa diz que a Muralha de Pedra fica para outra versão', () => {
    const state = feud(4, 2);
    expect(buildings.palisade.maxLevel).toBe(2);
    expect(palisade(state)).toBeUndefined();
    const message =
      'A Paliçada já está no nível máximo. A Muralha de Pedra chega em uma versão futura.';
    expect(refuse(state, start)).toEqual({ code: 'MAX_LEVEL', message });
    expect(refuse(state, command('planConstruction', { building: 'palisade' }))).toEqual({
      code: 'MAX_LEVEL',
      message,
    });
    // Com a obra do nível 2 em curso, planejar o nível 3 recebe a mesma recusa.
    const upgrading = accept(feud(3, 1), start).state;
    expect(refuse(upgrading, command('planConstruction', { building: 'palisade' }))).toEqual({
      code: 'MAX_LEVEL',
      message,
    });
    // E nem com o Salão no nível mais alto: o teto é o desta versão, não o do Salão.
    const high = gameWith((draft) => {
      draft.settlement.buildings.townHall = buildings.townHall.maxLevel;
      draft.settlement.buildings.palisade = 2;
      draft.settlement.resources = { food: 9e6, wood: 9e6, stone: 9e6, gold: 9e6 };
    });
    expect(refuse(high, start).code).toBe('MAX_LEVEL');
  });

  it('cancelar a obra devolve 80%, com a frase de quem desiste de erguer, e a Paliçada continua sem existir', () => {
    const started = accept(feud(3), start).state;
    const midway = advanceTo(started, 10 * DAY + 7 * MINUTE).state;
    const wood = midway.settlement.resources.wood;
    const stone = midway.settlement.resources.stone;
    const cancelled = accept(midway, command('cancelConstruction', { building: 'palisade' }));
    expect(cancelled.events.map((event) => [event.type, event.data])).toEqual([
      [
        'constructionCancelled',
        { building: 'palisade', level: 0, gained_wood: 160, gained_stone: 40 },
      ],
    ]);
    expect(cancelled.events[0]?.text).toContain('a Paliçada');
    expect(cancelled.state.settlement.resources.wood).toBe(wood + 160_000);
    expect(cancelled.state.settlement.resources.stone).toBe(stone + 40_000);
    expect(cancelled.state.settlement.buildings.palisade).toBe(0);
    expect(cancelled.state.settlement.constructionQueues).toEqual([null, null]);
    // Nada fica para trás: o prazo antigo passa e a Paliçada não aparece.
    const later = advanceTo(cancelled.state, 11 * DAY);
    expect(later.state.settlement.buildings.palisade).toBe(0);
    expect(eventsOfType(later.events, 'buildingFounded')).toEqual([]);
    expect(deriveViewState(later.state, 11 * DAY).threat.defense.text).toBe(
      'Sem Paliçada, nada segura um ataque.',
    );
    // E a obra pode recomeçar, pelo custo inteiro.
    expect(palisade(cancelled.state)).toMatchObject({ fromLevel: 0, blockedCode: null });
  });

  it('cancelar a melhoria devolve 80% do custo do nível 2 e mantém o nível 1', () => {
    const upgrading = accept(feud(3, 1), start).state;
    const cancelled = accept(upgrading, command('cancelConstruction', { building: 'palisade' }));
    expect(cancelled.events[0]?.data).toEqual({
      building: 'palisade',
      level: 1,
      gained_wood: 256,
      gained_stone: 64,
    });
    expect(cancelled.state.settlement.buildings.palisade).toBe(1);
  });

  it('no inverno a obra leva uma vez e meia o prazo, como as outras', () => {
    const state = feud(3, 0, WINTER + HOUR);
    expect(palisade(state)).toMatchObject({ durationSeconds: 30 * 60 });
    expect(palisade(state)?.durationNote).toContain('Inverno');
  });

  it('o prazo sai em tempo real: no ritmo Rápido, 20 min de jogo são 6 min 40 s', () => {
    const state = feud(3);
    const fast = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(
      fast.constructions.available.find((upgrade) => upgrade.building === 'palisade')
        ?.durationSeconds,
    ).toBe(400);
  });

  it('planejada como automática, começa sozinha no instante em que o Salão chega ao nível 3', () => {
    const waiting = gameAt(3 * DAY, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.resources = { food: 400_000, wood: 450_000, stone: 400_000, gold: 400_000 };
      draft.settlement.constructionQueues[0] = {
        building: 'townHall',
        targetLevel: 3,
        startedAtMs: 3 * DAY - 5 * MINUTE,
        finishesAtMs: 3 * DAY + 10 * MINUTE,
      };
    });
    const planned = accept(
      waiting,
      command('planConstruction', { building: 'palisade', autoStart: true }),
    ).state;
    const { state, events } = advanceTo(planned, 3 * DAY + 40 * MINUTE);
    expect(
      eventsOfType(events, 'constructionAutoStarted').map((event) => [event.atMs, event.text]),
    ).toEqual([
      [
        3 * DAY + 10 * MINUTE,
        'No 4º dia da Primavera, com as reservas cheias, os pedreiros começaram sozinhos a levantar a Paliçada em Pedra Alta.',
      ],
    ]);
    expect(state.settlement.buildings.palisade).toBe(1);
    expect(state.settlement.planned).toEqual([]);
  });

  it('é uma obra como as outras: ocupa a fila, e o edifício em obras recusa outra ordem', () => {
    const started = accept(feud(3), start).state;
    expect(refuse(started, start).code).toBe('ALREADY_UPGRADING');
    expect(refuse(started, command('startConstruction', { building: 'farm' })).code).toBe(
      'QUEUE_LOCKED',
    );
    expect(started.stats['constructionsStarted:palisade']).toBe(1);
  });
});
