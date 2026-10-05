import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { coversIn, planWait } from './planned';
import {
  accept,
  command,
  eventsOfType,
  FED_MORALE,
  gameAt,
  gameWith,
  HOUR,
  masteryOnDay,
  MINUTE,
  newGame,
  play,
  reachedAt,
  refuse,
  SPRING,
  WINTER,
  withMorale,
} from './test-helpers';
import { nextAutoStartAt, nextEventAt } from './timeline';
import type { BuildingId, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

/**
 * Primavera, objetivos cumpridos, cinco lenhadores (40 de madeira por hora) e nada mais
 * produzindo: comida, pedra e ouro de sobra, madeira a escolher. O custo que falta é a madeira.
 * Os lenhadores são veteranos sem experiência: a Serraria, ocupada, ganha 4 a cada virada de
 * dia, e a primeira virada leva a moral a 60 (há comida guardada): a taxa passa a 40,48 × 1,05
 * = 42,504 no segundo dia de jogo, 40,96 × 1,05 = 43,008 no terceiro, e assim por diante.
 */
function lumberCamp(wood: number, edit: (draft: GameState) => void = () => {}): GameState {
  return gameAt(SPRING, (draft) => {
    draft.settlement.workers.lumberMill = 5;
    draft.settlement.resources = { food: 500_000, wood, stone: 400_000, gold: 400_000 };
    edit(draft);
  });
}

/** O mesmo acampamento com o Salão no nível 4: as duas filas abertas. */
function twoQueues(wood: number, edit: (draft: GameState) => void = () => {}): GameState {
  return lumberCamp(wood, (draft) => {
    draft.settlement.buildings.townHall = 4;
    edit(draft);
  });
}

const auto = (building: BuildingId) => command('planConstruction', { building, autoStart: true });
const autoStarted = (events: GameEvent[]) => eventsOfType(events, 'constructionAutoStarted');
const queueOf = (state: GameState) =>
  state.settlement.constructionQueues.map((slot) => slot?.building ?? null);
const plannedOf = (state: GameState) => state.settlement.planned.map((plan) => plan.building);
const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt).constructions;
const waitingOf = (state: GameState, building: BuildingId) =>
  view(state).planned.find((entry) => entry.building === building)?.waiting;

describe('segunda fila de obras (GDD §6.3)', () => {
  const rich = (townHall: number) =>
    gameAt(SPRING, (draft) => {
      draft.settlement.buildings.townHall = townHall;
      draft.settlement.buildings.warehouse = 8;
      draft.settlement.resources = { food: 500_000, wood: 5e6, stone: 5e6, gold: 5e6 };
    });

  it('o estado guarda sempre duas filas, e a segunda nasce fechada', () => {
    expect(newGame().settlement.constructionQueues).toEqual([null, null]);
    expect(view(newGame())).toMatchObject({
      active: null,
      queues: [null],
      queuesUnlocked: 1,
      queuesNote: 'A segunda fila abre com o Salão do Senhor Nv4.',
    });
  });

  it.each([1, 2, 3])(
    'com o Salão no nível %i a segunda obra é recusada, com o que a libera',
    (hall) => {
      const busy = accept(rich(hall), command('startConstruction', { building: 'farm' })).state;
      expect(refuse(busy, command('startConstruction', { building: 'housing' }))).toEqual({
        code: 'QUEUE_LOCKED',
        message:
          'Os pedreiros já estão ocupados com outra obra. A segunda fila abre com o Salão do Senhor Nv4.',
      });
      expect(queueOf(busy)).toEqual(['farm', null]);
    },
  );

  it('com o Salão no nível 4 duas obras andam ao mesmo tempo, cada uma com o seu prazo', () => {
    const { state, events } = play(rich(4), [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
    ]);
    expect(state.settlement.constructionQueues).toEqual([
      { building: 'farm', targetLevel: 2, startedAtMs: 0, finishesAtMs: 5 * MINUTE },
      { building: 'quarry', targetLevel: 2, startedAtMs: 0, finishesAtMs: 6 * MINUTE },
    ]);
    expect(events.map((event) => event.type)).toEqual([
      'constructionStarted',
      'constructionStarted',
    ]);
    // Cada obra é paga uma vez: 80 + 120 de madeira, 40 + 30 de ouro.
    expect(state.settlement.resources).toMatchObject({ wood: 5e6 - 200_000, gold: 5e6 - 70_000 });

    const done = advanceTo(state, 6 * MINUTE);
    expect(eventsOfType(done.events, 'constructionFinished').map((event) => event.atMs)).toEqual([
      5 * MINUTE,
      6 * MINUTE,
    ]);
    expect(done.state.settlement.buildings).toMatchObject({ farm: 2, quarry: 2 });
    expect(queueOf(done.state)).toEqual([null, null]);
  });

  it('a terceira obra é recusada: não há mais fila para abrir', () => {
    const { state } = play(rich(4), [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
    ]);
    expect(refuse(state, command('startConstruction', { building: 'housing' }))).toEqual({
      code: 'QUEUE_BUSY',
      message: 'Os pedreiros já estão ocupados: não há fila de obras livre.',
    });
  });

  it('o mesmo edifício não entra em duas filas', () => {
    const busy = accept(rich(4), command('startConstruction', { building: 'farm' })).state;
    expect(refuse(busy, command('startConstruction', { building: 'farm' }))).toEqual({
      code: 'ALREADY_UPGRADING',
      message: 'A Fazenda já está em obras.',
    });
  });

  it('a obra que termina primeiro libera a fila dela, e a próxima entra ali', () => {
    const { state } = play(rich(4), [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
      { at: 5 * MINUTE },
      command('startConstruction', { building: 'housing' }),
    ]);
    expect(queueOf(state)).toEqual(['housing', 'quarry']);
  });

  it('cancelar uma das duas devolve 80% e deixa a outra em paz', () => {
    const { state, events } = play(rich(4), [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
      command('cancelConstruction', { building: 'farm' }),
    ]);
    expect(queueOf(state)).toEqual([null, 'quarry']);
    // Farm: pagos 80 de madeira e 40 de ouro; voltam 64 e 32.
    expect(state.settlement.resources).toMatchObject({
      wood: 5e6 - 200_000 + 64_000,
      gold: 5e6 - 70_000 + 32_000,
    });
    expect(events[events.length - 1]).toMatchObject({
      type: 'constructionCancelled',
      data: { building: 'farm', gained_wood: 64, gained_gold: 32 },
    });
  });

  it('a fila abre no instante exato em que o Salão chega ao nível 4', () => {
    const start = gameAt(SPRING, (draft) => {
      const { settlement } = draft;
      settlement.buildings.townHall = 3;
      settlement.buildings.warehouse = 8;
      settlement.resources = { food: 500_000, wood: 5e6, stone: 5e6, gold: 5e6 };
      settlement.constructionQueues = [
        { building: 'townHall', targetLevel: 4, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    const before = advanceTo(start, HOUR - 1).state;
    expect(view(before).queuesUnlocked).toBe(1);
    expect(refuse(before, command('startConstruction', { building: 'farm' })).code).toBe(
      'QUEUE_LOCKED',
    );
    const after = advanceTo(before, HOUR).state;
    expect(view(after)).toMatchObject({
      queuesUnlocked: 2,
      queues: [null, null],
      queuesNote: null,
    });
    const { state } = play(after, [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
    ]);
    expect(queueOf(state)).toEqual(['farm', 'quarry']);
  });

  it('a visão mostra uma linha por fila aberta, e `active` continua sendo a primeira obra', () => {
    const { state } = play(rich(4), [
      command('startConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'quarry' }),
      { at: 5 * MINUTE },
    ]);
    const constructions = view(state);
    expect(constructions.queues).toMatchObject([
      null,
      { building: 'quarry', label: 'Pedreira', targetLevel: 2, secondsRemaining: 60 },
    ]);
    expect(constructions.active).toEqual(constructions.queues[1]);
    expect(constructions.available.map((entry) => entry.building)).not.toContain('quarry');
    // Há fila livre: as outras obras podem começar.
    expect(constructions.available.find((entry) => entry.building === 'housing')).toMatchObject({
      blockedCode: null,
    });
  });
});

describe('planejar e marcar como automática', () => {
  it('sem a marca, a planejada é manual; com ela, automática', () => {
    const { state } = play(lumberCamp(0), [
      command('planConstruction', { building: 'farm' }),
      command('planConstruction', { building: 'quarry', autoStart: false }),
      command('planConstruction', { building: 'housing', autoStart: true }),
    ]);
    expect(state.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 2, autoStart: false },
      { building: 'quarry', targetLevel: 2, autoStart: false },
      { building: 'housing', targetLevel: 2, autoStart: true },
    ]);
  });

  it('planejar não cobra nada, nem a automática', () => {
    const start = lumberCamp(0);
    const { state, events } = accept(start, auto('lumberMill'));
    expect(state.settlement.resources).toEqual(start.settlement.resources);
    expect(queueOf(state)).toEqual([null, null]);
    expect(events).toEqual([]);
  });

  it('setAutoStart marca e desmarca sem tirar a planejada do lugar', () => {
    const planned = play(lumberCamp(0), [
      command('planConstruction', { building: 'farm' }),
      command('planConstruction', { building: 'quarry' }),
    ]).state;
    const marked = accept(planned, command('setAutoStart', { building: 'farm', autoStart: true }));
    expect(marked.state.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 2, autoStart: true },
      { building: 'quarry', targetLevel: 2, autoStart: false },
    ]);
    expect(marked.events).toEqual([]);
    // Marcar de novo não muda nada, nem é erro: um clique repetido não desfaz o anterior.
    const again = accept(
      marked.state,
      command('setAutoStart', { building: 'farm', autoStart: true }),
    );
    expect(again.state.settlement.planned).toEqual(marked.state.settlement.planned);
    const unmarked = accept(
      again.state,
      command('setAutoStart', { building: 'farm', autoStart: false }),
    );
    expect(unmarked.state.settlement.planned).toEqual(planned.settlement.planned);
  });

  it('setAutoStart recusa o que não está planejado e o edifício que não existe', () => {
    expect(
      refuse(newGame(), command('setAutoStart', { building: 'farm', autoStart: true })),
    ).toEqual({
      code: 'NOT_PLANNED',
      message: 'A Fazenda não está na lista de obras planejadas.',
    });
    const bogus = command('setAutoStart', { building: 'tower' as BuildingId, autoStart: true });
    expect(refuse(newGame(), bogus).code).toBe('INVALID_BUILDING');
  });

  it('o motor não confia no payload: marca que não é `true` é manual', () => {
    const odd = command('planConstruction', {
      building: 'farm',
      autoStart: 'sim' as unknown as boolean,
    });
    expect(accept(lumberCamp(500_000), odd).state.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 2, autoStart: false },
    ]);
  });

  it('desplanejar tira a automática da lista: ela não começa mais', () => {
    const { state } = play(lumberCamp(0), [
      auto('lumberMill'),
      command('unplanConstruction', { building: 'lumberMill' }),
    ]);
    expect(state.settlement.planned).toEqual([]);
    expect(autoStarted(advanceTo(state, 20 * HOUR).events)).toEqual([]);
  });
});

describe('a ordem que diz o nível (duas abas, tela atrasada)', () => {
  // Habitações no nível 1, com recurso e fila para a obra do nível 2 começar na hora.
  const ready = () => lumberCamp(300_000);
  const planLevel = (building: BuildingId, targetLevel: number, autoStart = true) =>
    command('planConstruction', { building, autoStart, targetLevel });

  it('com o nível que a tela mostrava, a ordem vale como sempre', () => {
    const { state, events } = accept(ready(), planLevel('housing', 2));
    expect(autoStarted(events)).toMatchObject([{ data: { building: 'housing', level: 2 } }]);
    expect(state.settlement.planned).toEqual([]);
    const manual = accept(ready(), planLevel('housing', 2, false)).state;
    expect(manual.settlement.planned).toEqual([
      { building: 'housing', targetLevel: 2, autoStart: false },
    ]);
  });

  it('a mesma ordem repetida por outra aba não planeja o nível seguinte: a obra pedida já começou', () => {
    const first = accept(ready(), planLevel('housing', 2));
    const wood = first.state.settlement.resources.wood;
    expect(refuse(first.state, planLevel('housing', 2))).toEqual({
      code: 'ALREADY_UPGRADING',
      message: 'As Habitações já estão em obras.',
    });
    // Nada ficou na lista: a obra do nível 2 termina e a do nível 3 não começa sozinha.
    const { state, events } = advanceTo(first.state, first.state.lastProcessedAt + 10 * HOUR);
    expect(autoStarted(events)).toEqual([]);
    expect(state.settlement.buildings.housing).toBe(2);
    expect(state.settlement.resources.wood).toBeGreaterThanOrEqual(wood);
  });

  it('sem o nível, a ordem repetida planeja o nível seguinte, como sempre fez', () => {
    const { state } = play(ready(), [auto('housing'), auto('housing')]);
    expect(state.settlement.planned).toEqual([
      { building: 'housing', targetLevel: 3, autoStart: true },
    ]);
  });

  it('a obra pedida já terminou: a recusa diz qual é a obra de agora', () => {
    const built = play(ready(), [planLevel('housing', 2), { at: SPRING + HOUR }]).state;
    expect(built.settlement.buildings.housing).toBe(2);
    expect(refuse(built, planLevel('housing', 2))).toEqual({
      code: 'STALE_LEVEL',
      message:
        'Essa ordem ficou para trás: a obra das Habitações agora é a do nível 3. Confira a lista e peça de novo.',
    });
    expect(accept(built, planLevel('housing', 3, false)).state.settlement.planned).toEqual([
      { building: 'housing', targetLevel: 3, autoStart: false },
    ]);
  });

  it('planejar o nível seguinte ao da obra em curso continua valendo, dito o nível certo', () => {
    const { state } = play(ready(), [planLevel('housing', 2), planLevel('housing', 3)]);
    expect(state.settlement.planned).toEqual([
      { building: 'housing', targetLevel: 3, autoStart: true },
    ]);
  });

  it('no teto, a ordem atrasada ouve que o edifício já está no nível máximo', () => {
    const maxed = lumberCamp(0, (draft) => {
      draft.settlement.buildings.farm = 10;
    });
    expect(refuse(maxed, planLevel('farm', 10)).code).toBe('MAX_LEVEL');
  });

  it('setAutoStart com o nível: marca a planejada que a tela mostrava, e só ela', () => {
    const planned = accept(lumberCamp(0), command('planConstruction', { building: 'farm' })).state;
    const mark = (targetLevel: number) =>
      command('setAutoStart', { building: 'farm', autoStart: true, targetLevel });
    expect(accept(planned, mark(2)).state.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 2, autoStart: true },
    ]);
    // A outra aba iniciou a obra do nível 2 e planejou a do 3: a marca era para a do 2.
    const moved = play(lumberCamp(300_000), [
      command('startConstruction', { building: 'farm' }),
      command('planConstruction', { building: 'farm' }),
    ]).state;
    expect(refuse(moved, mark(2))).toEqual({
      code: 'STALE_LEVEL',
      message:
        'Essa ordem ficou para trás: a obra da Fazenda agora é a do nível 3. Confira a lista e peça de novo.',
    });
    expect(moved.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 3, autoStart: false },
    ]);
    // Sem planejada nenhuma, a recusa continua sendo a de sempre.
    expect(refuse(lumberCamp(0), mark(2)).code).toBe('NOT_PLANNED');
  });

  it('o motor não confia no payload: nível que não é o da vez é recusado, seja o que for', () => {
    const odd = command('planConstruction', {
      building: 'farm',
      targetLevel: '2' as unknown as number,
    });
    expect(refuse(lumberCamp(0), odd).code).toBe('STALE_LEVEL');
  });
});

describe('início automático (GDD §6.3; ADR 0013, decisão 18)', () => {
  it('com recurso e fila na hora da ordem, a planejada automática começa ali mesmo', () => {
    const { state, events } = accept(lumberCamp(300_000), auto('lumberMill'));
    expect(events).toEqual([
      {
        type: 'constructionAutoStarted',
        atMs: 0,
        text: 'No 1º dia da Primavera, com as reservas cheias, os pedreiros começaram sozinhos a erguer a Serraria ao 2º nível.',
        data: { building: 'lumberMill', level: 2, spent_wood: 100, spent_stone: 50 },
      },
    ]);
    // Cobrou uma vez, ocupou a fila e saiu da lista.
    expect(state.settlement.resources).toMatchObject({ wood: 200_000, stone: 350_000 });
    expect(state.settlement.constructionQueues[0]).toEqual({
      building: 'lumberMill',
      targetLevel: 2,
      startedAtMs: 0,
      finishesAtMs: 5 * MINUTE,
    });
    expect(state.settlement.planned).toEqual([]);
    // E conta para o que conta uma obra iniciada por ordem.
    expect(state.stats['constructionsStarted:lumberMill']).toBe(1);
    const later = advanceTo(state, 5 * MINUTE);
    expect(later.state.settlement.resources.stone).toBe(350_000);
    expect(eventsOfType(later.events, 'constructionFinished')).toHaveLength(1);
  });

  it('a obra que ergue um edifício do zero tem a frase dela', () => {
    const start = lumberCamp(300_000, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const { events } = accept(start, auto('warehouse'));
    expect(events.map((event) => event.text)).toEqual([
      'No 1º dia da Primavera, com as reservas cheias, os pedreiros começaram sozinhos a levantar o Armazém em Pedra Alta.',
    ]);
  });

  it('a produção que completa o custo inicia a obra no milissegundo exato', () => {
    // Serraria: 100 de madeira e 50 de pedra. Há 60 de madeira e entram 40 por hora: 1 hora.
    const waiting = accept(lumberCamp(60_000), auto('lumberMill')).state;
    expect(nextAutoStartAt(waiting)).toBe(HOUR);
    expect(nextEventAt(waiting)).toBe(HOUR);

    const before = advanceTo(waiting, HOUR - 1);
    expect(before.events).toEqual([]);
    expect(plannedOf(before.state)).toEqual(['lumberMill']);
    expect(before.state.settlement.resources.wood).toBe(99_999);

    const { state, events } = advanceTo(before.state, HOUR);
    expect(events).toMatchObject([
      {
        type: 'constructionAutoStarted',
        atMs: HOUR,
        data: { building: 'lumberMill', level: 2, spent_wood: 100, spent_stone: 50 },
      },
    ]);
    expect(state.settlement.resources).toMatchObject({ wood: 0, stone: 350_000 });
    expect(state.settlement.constructionQueues[0]).toMatchObject({
      building: 'lumberMill',
      startedAtMs: HOUR,
      finishesAtMs: HOUR + 5 * MINUTE,
    });
    expect(plannedOf(state)).toEqual([]);
    // Quem voltou só no dia seguinte encontra a mesma obra, começada na mesma hora.
    const away = advanceTo(waiting, 30 * HOUR);
    expect(autoStarted(away.events)).toEqual(events);
  });

  it('o resto de produção guardado entra na conta do instante', () => {
    // Meio milésimo de madeira já produzido: com 40.000 milésimos por hora, são 45 ms a menos.
    const start = lumberCamp(60_000, (draft) => {
      draft.settlement.accumulators.wood = 1_800_000;
    });
    const waiting = accept(start, auto('lumberMill')).state;
    expect(nextAutoStartAt(waiting)).toBe(HOUR - 45);
    expect(autoStarted(advanceTo(waiting, HOUR - 46).events)).toEqual([]);
    expect(autoStarted(advanceTo(waiting, HOUR - 45).events)).toMatchObject([{ atMs: HOUR - 45 }]);
  });

  it('o instante é de jogo: o ritmo só muda o prazo que a visão mostra', () => {
    // A mesma espera de 1 hora de jogo, em três ritmos.
    for (const [timeScale, seconds] of [
      [1, 3600],
      [3, 1200],
      [0.5, 7200],
    ] as const) {
      const start = lumberCamp(60_000, (draft) => {
        draft.settings.timeScale = timeScale;
      });
      const waiting = accept(start, auto('lumberMill')).state;
      expect(nextAutoStartAt(waiting)).toBe(HOUR);
      expect(waitingOf(waiting, 'lumberMill')).toEqual({
        reason: 'resources',
        text: 'espera 40 de madeira',
        etaSeconds: seconds,
      });
      expect(autoStarted(advanceTo(waiting, HOUR).events)).toMatchObject([{ atMs: HOUR }]);
    }
  });

  it('a manual não começa sozinha, por mais que sobre', () => {
    const waiting = accept(
      lumberCamp(60_000),
      command('planConstruction', { building: 'lumberMill' }),
    ).state;
    expect(nextAutoStartAt(waiting)).toBeNull();
    const { state, events } = advanceTo(waiting, 30 * HOUR);
    expect(autoStarted(events)).toEqual([]);
    expect(plannedOf(state)).toEqual(['lumberMill']);
    // Pronta para a ordem: não espera nada.
    expect(waitingOf(state, 'lumberMill')).toBeNull();
  });

  describe('a ordem da lista', () => {
    // Os 150 de madeira do Salão, contados do zero a partir das 2 h: 85,008 no segundo dia de
    // jogo (42,504 por hora) e os 64,992 que faltam no terceiro, a 43,008 por hora.
    const TOWN_HALL_AT = 4 * HOUR + Math.ceil((64_992 * HOUR) / 43_008);

    it('planejada cara atrás de uma barata: a barata começa primeiro e a cara espera a conta de novo', () => {
      // Habitações: 80 de madeira. Salão: 150. Do zero, a 40 por hora no primeiro dia.
      const waiting = play(lumberCamp(0), [auto('housing'), auto('townHall')]).state;
      const { events } = advanceTo(waiting, 10 * HOUR);
      expect(autoStarted(events).map((event) => [event.data.building, event.atMs])).toEqual([
        ['housing', 2 * HOUR],
        // As Habitações levaram os 80: os 150 do Salão contam do zero.
        ['townHall', TOWN_HALL_AT],
      ]);
    });

    it('planejada cara na frente de uma barata: a que não pode começar não segura a seguinte', () => {
      const waiting = play(lumberCamp(0), [auto('townHall'), auto('housing')]).state;
      const { events } = advanceTo(waiting, 10 * HOUR);
      // A mesma sequência: o Salão é o primeiro da lista, mas a madeira chega antes para as
      // Habitações, e elas não esperam por ele.
      expect(autoStarted(events).map((event) => [event.data.building, event.atMs])).toEqual([
        ['housing', 2 * HOUR],
        ['townHall', TOWN_HALL_AT],
      ]);
    });

    it('quando duas podem começar no mesmo instante e só há uma fila, vale a ordem da lista', () => {
      // A fila está ocupada até 1 h; as duas planejadas já têm o que custam.
      const busy = (first: BuildingId, second: BuildingId) =>
        play(
          lumberCamp(300_000, (draft) => {
            draft.settlement.constructionQueues = [
              { building: 'goldMine', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
              null,
            ];
          }),
          [auto(first), auto(second)],
        ).state;
      const quarryFirst = advanceTo(busy('quarry', 'farm'), HOUR);
      expect(autoStarted(quarryFirst.events).map((event) => event.data.building)).toEqual([
        'quarry',
      ]);
      expect(plannedOf(quarryFirst.state)).toEqual(['farm']);
      const farmFirst = advanceTo(busy('farm', 'quarry'), HOUR);
      expect(autoStarted(farmFirst.events).map((event) => event.data.building)).toEqual(['farm']);
      expect(plannedOf(farmFirst.state)).toEqual(['quarry']);
    });
  });

  describe('duas filas disputando recursos', () => {
    it('com as duas filas livres e madeira para uma obra só, começa a primeira da lista que cabe', () => {
      // Pedreira: 120 de madeira. Fazenda: 80. Há 100.
      const { state, events } = play(twoQueues(100_000), [auto('quarry'), auto('farm')]);
      expect(autoStarted(events).map((event) => event.data.building)).toEqual(['farm']);
      expect(queueOf(state)).toEqual(['farm', null]);
      expect(state.settlement.resources.wood).toBe(20_000);
      // A Pedreira espera os 100 que faltam e entra na fila que estiver livre: 80 chegam no
      // primeiro dia de jogo (40 por hora) e os outros 20 no segundo, a 42,504 por hora.
      const startsAt = 2 * HOUR + Math.ceil((20_000 * HOUR) / 42_504);
      const later = advanceTo(state, 3 * HOUR);
      expect(autoStarted(later.events)).toMatchObject([
        { atMs: startsAt, data: { building: 'quarry', spent_wood: 120 } },
      ]);
      expect(later.state.settlement.resources.wood).toBe(20_000 + 80_000 + 42_504 - 120_000);
    });

    it('com madeira para as duas, as duas começam no mesmo instante, na ordem da lista', () => {
      const waiting = play(
        twoQueues(0, (draft) => {
          draft.settlement.resources.wood = 199_999;
        }),
        [command('planConstruction', { building: 'quarry' }), auto('farm')],
      );
      // A Fazenda (80) começou; a Pedreira é manual. Marcada, começa na segunda fila.
      expect(queueOf(waiting.state)).toEqual(['farm', null]);
      const marked = accept(
        waiting.state,
        command('setAutoStart', { building: 'quarry', autoStart: true }),
      );
      // Sobraram 119.999: falta um milésimo para os 120 da Pedreira.
      expect(autoStarted(marked.events)).toEqual([]);
      expect(waitingOf(marked.state, 'quarry')).toMatchObject({ reason: 'resources' });

      const both = play(twoQueues(200_000), [
        command('planConstruction', { building: 'quarry' }),
        command('planConstruction', { building: 'farm' }),
        command('setAutoStart', { building: 'farm', autoStart: true }),
      ]);
      expect(queueOf(both.state)).toEqual(['farm', null]);
      const second = accept(
        both.state,
        command('setAutoStart', { building: 'quarry', autoStart: true }),
      );
      expect(queueOf(second.state)).toEqual(['farm', 'quarry']);
      expect(second.state.settlement.resources.wood).toBe(0);
    });

    it('a abertura da segunda fila inicia as duas primeiras da lista no mesmo instante', () => {
      const start = lumberCamp(400_000, (draft) => {
        draft.settlement.buildings.townHall = 3;
        draft.settlement.constructionQueues = [
          { building: 'townHall', targetLevel: 4, startedAtMs: 0, finishesAtMs: HOUR },
          null,
        ];
      });
      const waiting = play(start, [auto('farm'), auto('quarry'), auto('housing')]).state;
      expect(plannedOf(waiting)).toEqual(['farm', 'quarry', 'housing']);
      const { state, events } = advanceTo(waiting, HOUR);
      expect(events.map((event) => [event.type, event.data.building])).toEqual([
        ['constructionFinished', 'townHall'],
        ['constructionAutoStarted', 'farm'],
        ['constructionAutoStarted', 'quarry'],
      ]);
      expect(queueOf(state)).toEqual(['farm', 'quarry']);
      expect(plannedOf(state)).toEqual(['housing']);
      expect(waitingOf(state, 'housing')).toEqual({
        reason: 'queue',
        text: 'espera os pedreiros terminarem outra obra',
        etaSeconds: 5 * 60,
      });
    });
  });

  it('cancelamento seguido de início automático: a fila e a devolução liberam a planejada', () => {
    // A Mina de Ouro em obra (120 de madeira, 80 de pedra pagos) e a Serraria planejada: há
    // pedra, faltam 30 de madeira e a fila está ocupada.
    const building = accept(
      lumberCamp(190_000, (draft) => {
        draft.settlement.workers.lumberMill = 0;
      }),
      command('startConstruction', { building: 'goldMine' }),
    ).state;
    const waiting = accept(building, auto('lumberMill')).state;
    expect(waiting.settlement.resources.wood).toBe(70_000);
    expect(plannedOf(waiting)).toEqual(['lumberMill']);

    const { state, events } = accept(
      waiting,
      command('cancelConstruction', { building: 'goldMine' }),
    );
    // Voltam 96 de madeira: 166, e a Serraria leva 100.
    expect(events.map((event) => event.type)).toEqual([
      'constructionCancelled',
      'constructionAutoStarted',
    ]);
    expect(state.settlement.resources.wood).toBe(70_000 + 96_000 - 100_000);
    expect(queueOf(state)).toEqual(['lumberMill', null]);
    expect(plannedOf(state)).toEqual([]);
  });

  it('recompensa de objetivo que destrava um início: a obra começa na mesma ordem', () => {
    // Partida nova, com os objetivos por cumprir e 25 de ouro: a Fazenda custa 40.
    const poor = gameWith((draft) => {
      draft.settlement.resources.gold = 25_000;
    });
    const waiting = accept(poor, auto('farm')).state;
    expect(waitingOf(waiting, 'farm')).toEqual({
      reason: 'resources',
      text: 'espera 15 de ouro, mas o estoque de ouro não está subindo: mande aldeões para a Mina de Ouro',
      etaSeconds: null,
    });
    // Dois fazendeiros cumprem o primeiro objetivo: +20 de ouro, e os 45 pagam a Fazenda.
    const { state, events } = accept(
      waiting,
      command('setWorkers', { building: 'farm', count: 2 }),
    );
    expect(events.map((event) => event.type)).toEqual([
      'objectiveCompleted',
      'constructionAutoStarted',
    ]);
    expect(state.settlement.resources.gold).toBe(5_000);
    expect(queueOf(state)).toEqual(['farm', null]);
  });

  it('fim de obra e enchimento no mesmo instante: a obra começa uma vez, e o depósito não chega a encher', () => {
    // A fila fica livre em 1 h, e em 1 h a madeira (460 + 40) chegaria ao limite de 500.
    const start = lumberCamp(460_000, (draft) => {
      draft.settlement.constructionQueues = [
        { building: 'goldMine', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    const waiting = accept(start, auto('lumberMill')).state;
    expect(waitingOf(waiting, 'lumberMill')).toEqual({
      reason: 'queue',
      text: 'espera os pedreiros terminarem outra obra',
      etaSeconds: 3600,
    });
    const direct = advanceTo(waiting, 2 * HOUR);
    expect(direct.events.filter((event) => event.atMs === HOUR).map((event) => event.type)).toEqual(
      ['constructionFinished', 'constructionAutoStarted'],
    );
    // A madeira bateu nos 500 e a obra levou 100 no mesmo instante: ninguém anuncia "encheu".
    expect(eventsOfType(direct.events, 'storageFilled')).toEqual([]);
    expect(direct.state.stats.wasted_wood).toBeUndefined();
    // Na segunda hora: 5 minutos a 40 por hora e, com a Serraria no nível 2, 55 a 48.
    expect(direct.state.settlement.resources.wood).toBe(
      400_000 + Math.floor((40_000 * 5 + 48_000 * 55) / 60),
    );
    // Com o corte em cima do instante, antes e depois dele, o resultado é o mesmo.
    for (const cut of [HOUR - 1, HOUR, HOUR + 1]) {
      const half = advanceTo(waiting, cut);
      const rest = advanceTo(half.state, 2 * HOUR);
      expect(rest.state).toStrictEqual(direct.state);
      expect([...half.events, ...rest.events]).toStrictEqual(direct.events);
    }
  });

  it('o custo completo no mesmo instante em que a fila fica livre também começa uma vez só', () => {
    // A fila fica livre em 1 h, e é em 1 h que a madeira chega aos 100 da Serraria.
    const start = lumberCamp(60_000, (draft) => {
      draft.settlement.constructionQueues = [
        { building: 'goldMine', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    const waiting = accept(start, auto('lumberMill')).state;
    const { state, events } = advanceTo(waiting, 2 * HOUR);
    expect(autoStarted(events)).toMatchObject([{ atMs: HOUR }]);
    // Os 100 foram pagos no instante em que se completaram; o resto é a segunda hora.
    expect(state.settlement.resources.wood).toBe(Math.floor((40_000 * 5 + 48_000 * 55) / 60));
  });

  it('a obra anterior do mesmo edifício: a planejada começa no instante em que ela termina', () => {
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const { state: waiting } = play(start, [
      command('startConstruction', { building: 'farm' }),
      auto('farm'),
    ]);
    expect(waiting.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 3, autoStart: true },
    ]);
    expect(waitingOf(waiting, 'farm')).toEqual({
      reason: 'upgrading',
      text: 'espera a obra da Fazenda terminar',
      etaSeconds: 300,
    });
    const { state, events } = advanceTo(waiting, 5 * MINUTE);
    expect(events.map((event) => [event.type, event.data.level])).toEqual([
      ['constructionFinished', 2],
      ['constructionAutoStarted', 3],
    ]);
    // Fazenda 2 → 3: 128 de madeira e 64 de ouro.
    expect(autoStarted(events)[0]?.data).toEqual({
      building: 'farm',
      level: 3,
      spent_wood: 128,
      spent_gold: 64,
    });
    expect(state.settlement.constructionQueues[0]).toMatchObject({
      building: 'farm',
      targetLevel: 3,
    });
  });

  it('a obra anterior cancelada: a planejada do nível seguinte espera, e diz o que falta', () => {
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const { state } = play(start, [
      command('startConstruction', { building: 'farm' }),
      auto('farm'),
      command('cancelConstruction', { building: 'farm' }),
    ]);
    // Cancelar não reinicia a obra cancelada por conta da planejada.
    expect(queueOf(state)).toEqual([null, null]);
    expect(waitingOf(state, 'farm')).toEqual({
      reason: 'upgrading',
      text: 'espera a Fazenda chegar ao nível 2: inicie essa obra primeiro',
      etaSeconds: null,
    });
    expect(autoStarted(advanceTo(state, 30 * HOUR).events)).toEqual([]);
  });

  it('a obra cancelada, iniciada de novo: a planejada do nível seguinte continua e começa no fim dela', () => {
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const { state: resumed } = play(start, [
      command('startConstruction', { building: 'farm' }),
      auto('farm'),
      command('cancelConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'farm' }),
    ]);
    // Iniciar a obra do nível 2 não leva junto a planejada do nível 3: ela volta a esperar.
    expect(resumed.settlement.planned).toEqual([
      { building: 'farm', targetLevel: 3, autoStart: true },
    ]);
    expect(waitingOf(resumed, 'farm')).toEqual({
      reason: 'upgrading',
      text: 'espera a obra da Fazenda terminar',
      etaSeconds: 300,
    });
    const { state, events } = advanceTo(resumed, 10 * HOUR);
    expect(
      events
        .filter((event) => event.data.building === 'farm')
        .map((event) => [event.type, event.data.level]),
    ).toEqual([
      ['constructionFinished', 2],
      ['constructionAutoStarted', 3],
      ['constructionFinished', 3],
    ]);
    // Fazenda 2 → 3: 128 de madeira e 64 de ouro, pagos uma vez só.
    expect(autoStarted(events).map((event) => event.data)).toEqual([
      { building: 'farm', level: 3, spent_wood: 128, spent_gold: 64 },
    ]);
    expect(state.settlement.buildings.farm).toBe(3);
    expect(state.settlement.planned).toEqual([]);
  });

  it('a planejada do próprio nível sai da lista quando a obra é iniciada à mão', () => {
    const start = lumberCamp(400_000);
    const { state } = play(start, [
      command('planConstruction', { building: 'farm' }),
      command('startConstruction', { building: 'farm' }),
    ]);
    expect(state.settlement.planned).toEqual([]);
    expect(queueOf(state)).toEqual(['farm', null]);
  });

  it('o nível do Salão: a planejada começa no instante em que a obra dele termina', () => {
    // Fazenda no nível 2 com o Salão no 1: o nível 3 pede o Salão no 2.
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.farm = 2;
    });
    const gated = accept(start, auto('farm')).state;
    expect(waitingOf(gated, 'farm')).toEqual({
      reason: 'gate',
      text: 'espera o Salão do Senhor chegar ao nível 2: melhore-o',
      etaSeconds: null,
    });
    expect(nextAutoStartAt(gated)).toBeNull();

    const upgrading = accept(gated, command('startConstruction', { building: 'townHall' })).state;
    expect(waitingOf(upgrading, 'farm')).toEqual({
      reason: 'gate',
      text: 'espera o Salão do Senhor chegar ao nível 2',
      etaSeconds: 600,
    });
    const { events } = advanceTo(upgrading, 10 * MINUTE);
    expect(events.map((event) => [event.type, event.data.building])).toEqual([
      ['constructionFinished', 'townHall'],
      ['constructionAutoStarted', 'farm'],
    ]);
  });

  it('custo que não cabe no depósito: a planejada não espera recurso que nunca vai juntar', () => {
    // O Salão 4 → 5 pede 875 de madeira, e sem Armazém o Pátio guarda 500. Pedra e ouro há.
    const start = twoQueues(500_000, (draft) => {
      draft.settlement.resources.stone = 700_000;
      draft.settlement.resources.gold = 700_000;
    });
    const waiting = accept(start, auto('townHall')).state;
    expect(waitingOf(waiting, 'townHall')).toEqual({
      reason: 'capacity',
      text: 'não cabe no Pátio: construa o Armazém',
      etaSeconds: null,
    });
    expect(nextAutoStartAt(waiting)).toBeNull();
    expect(autoStarted(advanceTo(waiting, 60 * HOUR).events)).toEqual([]);

    // Com o Armazém em obra, a espera tem prazo: o nível 1 guarda 900.
    const building = accept(waiting, command('startConstruction', { building: 'warehouse' })).state;
    expect(waitingOf(building, 'townHall')).toEqual({
      reason: 'capacity',
      text: 'não cabe no Pátio: a obra do Armazém já vai abrir espaço',
      etaSeconds: 600,
    });
    // Erguido o Armazém, a planejada passa a esperar a madeira, e começa quando ela chega.
    const built = advanceTo(building, 10 * MINUTE).state;
    expect(waitingOf(built, 'townHall')).toMatchObject({ reason: 'resources' });
    const { events } = advanceTo(built, 40 * HOUR);
    expect(autoStarted(events)).toMatchObject([
      { data: { building: 'townHall', level: 5, spent_wood: 875 } },
    ]);
  });

  it('o depósito erguido e ainda pequeno: "amplie-o"', () => {
    // O Salão 5 → 6 pede 1.575 de madeira; o Armazém no nível 1 guarda 900.
    const start = twoQueues(900_000, (draft) => {
      draft.settlement.buildings.townHall = 5;
      draft.settlement.buildings.warehouse = 1;
    });
    const waiting = accept(start, auto('townHall')).state;
    expect(waitingOf(waiting, 'townHall')).toEqual({
      reason: 'capacity',
      text: 'não cabe no Armazém: amplie-o',
      etaSeconds: null,
    });
  });

  it('no inverno, a madeira do custo que a lareira queima antes não deixa a obra começar', () => {
    // Habitações: 80 de madeira e 20 de pedra. Há 100 de madeira, e 10 habitantes queimam 5 por
    // hora: a madeira cobre o custo por 4 horas. A pedra vem a 4 por hora no inverno: 5 horas.
    const cold = (quarrymen: number) =>
      accept(
        gameAt(WINTER, (draft) => {
          const { settlement } = draft;
          settlement.population.villagers = 10;
          settlement.workers.quarry = quarrymen;
          settlement.resources = { food: 500_000, wood: 100_000, stone: 0, gold: 0 };
        }),
        auto('housing'),
      ).state;
    const slow = cold(1);
    expect(nextAutoStartAt(slow)).toBeNull();
    expect(waitingOf(slow, 'housing')).toEqual({
      reason: 'resources',
      text: 'espera 20 de pedra, mas o estoque de madeira cai antes disso',
      etaSeconds: null,
    });
    expect(autoStarted(advanceTo(slow, WINTER + 20 * HOUR).events)).toEqual([]);

    // Com dois na Pedreira a pedra chega em 2 h 30 min pela taxa de agora (8 por hora), com a
    // madeira ainda acima do custo: começa. A virada do dia, às 2 h, dá 4 de experiência à
    // Pedreira, e os 4 de pedra que faltam chegam a 8,096 por hora, um pouco antes.
    const fast = cold(2);
    expect(nextAutoStartAt(fast)).toBe(WINTER + 150 * MINUTE);
    const startsAt = WINTER + 2 * HOUR + Math.ceil((4_000 * HOUR) / 8_096);
    expect(startsAt).toBeLessThan(WINTER + 150 * MINUTE);
    expect(autoStarted(advanceTo(fast, startsAt - 1).events)).toEqual([]);
    const { state, events } = advanceTo(fast, startsAt);
    expect(autoStarted(events)).toMatchObject([{ atMs: startsAt }]);
    // A lareira queimou 12,47 de madeira até ali (5 por hora).
    expect(state.settlement.resources.wood).toBe(100_000 - 12_470 - 80_000);
    // No inverno a obra iniciada sozinha também leva × 1,5: 6 minutos.
    expect(state.settlement.constructionQueues[0]).toMatchObject({
      startedAtMs: startsAt,
      finishesAtMs: startsAt + 6 * MINUTE,
    });
  });

  it('no mesmo instante a ordem é fixa: obra concluída, virada do dia, início automático, objetivos', () => {
    // Na virada do 2º dia termina a obra do Salão, que ocupava a fila; as Habitações, planejadas
    // como automáticas, começam; e os dois objetivos que isso cumpre saem depois, na ordem do
    // conteúdo: iniciar as Habitações e chegar ao Salão no nível 2.
    const DAY = 2 * HOUR;
    const start = gameWith((draft) => {
      const { settlement } = draft;
      draft.lastProcessedAt = DAY - HOUR;
      draft.clock.gameTimeMs = DAY - HOUR;
      settlement.workers.farm = 5;
      settlement.constructionQueues = [
        { building: 'townHall', targetLevel: 2, startedAtMs: 0, finishesAtMs: DAY },
        null,
      ];
      settlement.planned = [{ building: 'housing', targetLevel: 2, autoStart: true }];
      draft.objectives = {
        active: ['upgradeHousing', 'townHallLevel2'],
        completed: ['allocateFarmers', 'recruitVillagers'],
      };
    });
    const { state, events } = advanceTo(start, DAY);
    expect(events.map((event) => event.type)).toEqual([
      'constructionFinished',
      'dayStarted',
      'constructionAutoStarted',
      'objectiveCompleted',
      'objectiveCompleted',
    ]);
    expect(events.slice(3).map((event) => event.data.objective)).toEqual([
      'upgradeHousing',
      'townHallLevel2',
    ]);
    expect(events.every((event) => event.atMs === DAY)).toBe(true);
    // As Habitações levaram 80 de madeira, e a recompensa devolveu 30.
    expect(state.settlement.resources.wood).toBe(120_000 - 80_000 + 30_000);
  });

  it('um estado que chega fora do repouso se acomoda antes de o tempo andar', () => {
    // Uma automática que já pode começar, posta direto no estado: é o que sobra quando o
    // conteúdo baixa um custo. Ela começa no instante em que o estado está, não no seguinte.
    const start = lumberCamp(300_000, (draft) => {
      draft.settlement.planned = [{ building: 'lumberMill', targetLevel: 2, autoStart: true }];
    });
    const { events } = advanceTo(start, 7 * HOUR + 13);
    expect(autoStarted(events)).toMatchObject([{ atMs: 0 }]);
    const half = advanceTo(start, 1);
    expect(autoStarted(half.events)).toMatchObject([{ atMs: 0 }]);
  });
});

describe('a conta do instante (coversIn)', () => {
  const still = { food: 0, wood: 0, stone: 0, gold: 0 };
  const stock = (resources: Partial<GameState['settlement']['resources']>, rests = still) =>
    gameAt(SPRING, (draft) => {
      draft.settlement.resources = { ...still, ...resources };
      draft.settlement.accumulators = rests;
    });

  it('é o maior dos prazos dos recursos que faltam', () => {
    const state = stock({ wood: 60_000, stone: 10_000 });
    // 40 de madeira a 40/h: 1 h. 40 de pedra a 10/h: 4 h.
    expect(
      coversIn(state, { wood: 100, stone: 50 }, { ...still, wood: 40_000, stone: 10_000 }),
    ).toBe(4 * HOUR);
  });

  it('não chega nunca sem saldo positivo em um recurso que falta', () => {
    const state = stock({ wood: 60_000, stone: 10_000 });
    expect(coversIn(state, { wood: 100, stone: 50 }, { ...still, wood: 40_000 })).toBeNull();
    expect(
      coversIn(state, { wood: 100, stone: 50 }, { ...still, wood: 40_000, stone: -5 }),
    ).toBeNull();
  });

  it('o recurso que já basta e não cai não entra na conta', () => {
    const state = stock({ wood: 60_000, stone: 900_000 });
    expect(coversIn(state, { wood: 100, stone: 50 }, { ...still, wood: 40_000 })).toBe(HOUR);
  });

  it('arredonda para cima: o milésimo que falta só existe quando a produção o completa', () => {
    // Falta 1 de madeira (1.000 milésimos) a 7 por hora: 1.000 × 3.600.000 ÷ 7.000 = 514.285,7.
    const state = stock({ wood: 99_000 });
    expect(coversIn(state, { wood: 100 }, { ...still, wood: 7_000 })).toBe(514_286);
    const { resources, accumulators } = state.settlement;
    const after = (ms: number) =>
      resources.wood + Math.trunc((accumulators.wood + 7_000 * ms) / HOUR);
    expect(after(514_285)).toBe(99_999);
    expect(after(514_286)).toBe(100_000);
  });

  it('o recurso que basta e está caindo tem prazo de validade, no milissegundo', () => {
    // 100 de madeira para um custo de 80, caindo 5 por hora: no instante 14.400.719 ainda há 80;
    // no seguinte, 79,999.
    const state = stock({ wood: 100_000, stone: 281 });
    const falling = { ...still, wood: -5_000, stone: HOUR };
    // A pedra anda um milésimo por milissegundo: falta exatamente o que couber no prazo.
    expect(coversIn(state, { wood: 80, stone: 14_401 }, falling)).toBe(14_400_719);
    const late = stock({ wood: 100_000, stone: 280 });
    expect(coversIn(late, { wood: 80, stone: 14_401 }, falling)).toBeNull();
  });

  it('na fome e no frio o estoque em zero não anda: quem espera por ele não tem prazo', () => {
    const freezing = gameAt(WINTER, (draft) => {
      draft.settlement.resources = { ...still, food: 100_000, stone: 900_000 };
      draft.settlement.cold = { sinceMs: WINTER };
    });
    expect(coversIn(freezing, { wood: 80 }, { ...still, wood: -2_500 })).toBeNull();
    // Com saldo positivo o frio não segura a madeira.
    expect(coversIn(freezing, { wood: 80 }, { ...still, wood: 40_000 })).toBe(2 * HOUR);
  });
});

describe('o que a planejada espera (planWait)', () => {
  it('quando há mais de um motivo, diz o que mais demora a se resolver sozinho', () => {
    // A fila ocupada e a madeira faltando: a planejada espera a madeira.
    const start = lumberCamp(0, (draft) => {
      draft.settlement.constructionQueues = [
        { building: 'goldMine', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    const state = accept(start, auto('lumberMill')).state;
    const [plan] = state.settlement.planned;
    expect(plan && planWait(state, plan)).toMatchObject({ reason: 'resources' });
    // A linha do tempo não marca instante para quem também espera a fila: quando a fila
    // liberar, a lista é conferida ali.
    expect(nextAutoStartAt(state)).toBeNull();
  });

  it('a visão diz o mesmo que a regra: sem espera, a automática já teria começado', () => {
    const waiting = play(twoQueues(100_000), [auto('quarry'), auto('lumberMill')]).state;
    for (const plan of waiting.settlement.planned) {
      expect(planWait(waiting, plan)).not.toBeNull();
    }
    for (const entry of view(waiting).planned) {
      expect(entry.autoStart).toBe(true);
      expect(entry.waiting).not.toBeNull();
    }
  });

  it('o depósito que ainda não foi erguido: a planejada do nível seguinte espera ele ficar de pé', () => {
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.townHall = 2;
    });
    const { state } = play(start, [
      command('startConstruction', { building: 'warehouse' }),
      auto('warehouse'),
      command('cancelConstruction', { building: 'warehouse' }),
    ]);
    expect(state.settlement.planned).toEqual([
      { building: 'warehouse', targetLevel: 2, autoStart: true },
    ]);
    expect(waitingOf(state, 'warehouse')).toEqual({
      reason: 'upgrading',
      text: 'espera o Armazém ficar de pé: inicie essa obra primeiro',
      etaSeconds: null,
    });
  });

  it('o depósito que é a própria obra e não cabe em si mesmo: não há o que ampliar', () => {
    // O Armazém 7 → 8 pede 4.295 de madeira em Rei de Ferro, e o nível 7 guarda 3.600.
    const start = lumberCamp(3_000_000, (draft) => {
      draft.settings.difficulty = 'ironKing';
      draft.settlement.buildings.townHall = 8;
      draft.settlement.buildings.warehouse = 7;
    });
    const waiting = accept(start, auto('warehouse')).state;
    expect(waitingOf(waiting, 'warehouse')).toEqual({
      reason: 'capacity',
      text: 'não cabe no Armazém: não há como juntar tanto',
      etaSeconds: null,
    });
    expect(nextAutoStartAt(waiting)).toBeNull();
  });

  it('uma planejada além do nível máximo (o conteúdo baixou o teto) diz isso e nunca começa', () => {
    const start = lumberCamp(400_000, (draft) => {
      draft.settlement.buildings.townHall = 8;
      draft.settlement.planned = [{ building: 'townHall', targetLevel: 9, autoStart: true }];
    });
    expect(waitingOf(start, 'townHall')).toEqual({
      reason: 'gate',
      text: 'o Salão do Senhor já está no nível máximo',
      etaSeconds: null,
    });
    expect(autoStarted(advanceTo(start, 30 * HOUR).events)).toEqual([]);
  });

  it('o prazo da espera conta com a adaptação que termina e a experiência que sobe', () => {
    // Cinco lenhadores recém-chegados, do zero: 20 por hora no primeiro dia de jogo, 42,504 no
    // segundo (adaptados, com 4 de experiência e a moral em 60). As Habitações pedem 80 de
    // madeira: 40 chegam em 2 h e os outros 40 depois.
    const camp = play(
      lumberCamp(0, (draft) => {
        draft.settlement.workers.lumberMill = 0;
      }),
      [command('setWorkers', { building: 'lumberMill', count: 5 }), auto('housing')],
    ).state;
    const startsAt = 2 * HOUR + Math.ceil((40_000 * HOUR) / 42_504);
    expect(waitingOf(camp, 'housing')).toEqual({
      reason: 'resources',
      text: 'espera 80 de madeira',
      etaSeconds: Math.ceil(startsAt / 1000),
    });
    // Com a taxa de agora, sem contar o fim da adaptação, seriam 4 horas.
    expect(startsAt).toBeLessThan(4 * HOUR);
    // E é quando a obra começa de fato.
    expect(autoStarted(advanceTo(camp, 5 * HOUR).events)).toMatchObject([
      { atMs: startsAt, data: { building: 'housing' } },
    ]);
    // No ritmo 3, o mesmo prazo em tempo real.
    const fast = deriveViewState(camp, camp.lastProcessedAt, { timeScale: 3 });
    expect(fast.constructions.planned[0]?.waiting?.etaSeconds).toBe(Math.ceil(startsAt / 3000));
  });

  it('a previsão de "cheio em" não promete o que a obra automática vai levar', () => {
    // Do zero, a 40 por hora: a Serraria começa sozinha em 2 h 30 min e leva os 100.
    const waiting = accept(lumberCamp(0), auto('lumberMill')).state;
    const wood = deriveViewState(waiting, 0).resources.find((row) => row.id === 'wood');
    expect(wood).toMatchObject({
      fullInSeconds: null,
      fullNote: 'Não enche antes do início da obra da Serraria.',
    });
    // Sem a planejada, a previsão é a de sempre: 500, a 40 por hora no primeiro dia e um pouco
    // mais a cada virada, com a experiência da Serraria e a moral que a primeira virada leva a
    // 60. Menos que as 12 h 30 min da taxa de hoje.
    const idle = deriveViewState(lumberCamp(0), 0).resources.find((row) => row.id === 'wood');
    const fillsAt = reachedAt(SPRING, 500_000, (day) =>
      withMorale(40 * masteryOnDay(day), day === 0 ? 50 : FED_MORALE),
    );
    expect(fillsAt).toBeLessThan(12.5 * HOUR);
    expect(idle).toMatchObject({ fullInSeconds: Math.ceil(fillsAt / 1000), fullNote: null });
  });
});
