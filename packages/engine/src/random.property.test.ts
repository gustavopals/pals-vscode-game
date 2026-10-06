import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { applyCommand } from './commands';
import { DAY_MS } from './clock';
import { RNG_STREAM_FAMILIES } from './random';

/**
 * Os fluxos em que o cenário sintético sorteia: os três fixos da v0.2. O da Taverna (`tavern`,
 * V3C-T2) só nasce com a Taverna erguida, que estes cenários não têm.
 */
const RNG_STREAMS = ['council', 'morale', 'horde'] as const;
import {
  advanceWithDailyDraws,
  advanceWithEntities,
  command,
  eventsOfType,
  HOUR,
  newGame,
  SYNTHETIC_DRAW,
  SYNTHETIC_ENTITY,
  type SyntheticEntityPlan,
  syntheticEntitiesOf,
} from './test-helpers';
import type { BuildingId, Command, GameEvent, GameState } from './types';

/**
 * A divisão de intervalo com sorteios no caminho. Nenhuma regra sorteia ainda, então o cenário
 * é sintético (`advanceWithDailyDraws`): o laço de `advanceTo` de verdade, com uma virada de
 * dia que sorteia nos três fluxos e mexe no estoque. As mecânicas que sorteiam de verdade
 * repetem esta prova com os próprios eventos.
 */

const DAY_REAL = 24 * HOUR;
const MONTH = 30 * DAY_REAL;

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
];

const scenario = fc.record({
  seed: fc.string({ minLength: 1, maxLength: 12 }),
  workers: fc.tuple(fc.nat(5), fc.nat(5), fc.nat(5), fc.nat(5)),
  build: fc.option(fc.constantFrom(...buildingIds)),
  recruit: fc.nat(5),
  // Instantes em milissegundos quaisquer: o corte cai antes, em cima e depois das viradas.
  warmUpMs: fc.nat(3 * DAY_REAL),
});

type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

/** Um feudo de semente qualquer, já com sorteios feitos e com ordens dadas no meio de um dia. */
function prepare(plan: Scenario): GameState {
  let state = advanceWithDailyDraws(newGame(plan.seed), plan.warmUpMs).state;
  const [farm, lumberMill, quarry, goldMine] = plan.workers;
  const orders: Command[] = [
    command('setWorkers', { building: 'farm', count: farm }),
    command('setWorkers', { building: 'lumberMill', count: lumberMill }),
    command('setWorkers', { building: 'quarry', count: quarry }),
    command('setWorkers', { building: 'goldMine', count: goldMine }),
    command('recruitVillagers', { quantity: plan.recruit }),
  ];
  if (plan.build !== null) {
    orders.push(command('startConstruction', { building: plan.build }));
  }
  for (const order of orders) {
    const result = applyCommand(state, order, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
    }
  }
  return state;
}

/** Avança parando em cada instante da lista, na ordem, e junta os eventos. */
function advanceThrough(start: GameState, instants: number[]) {
  let state = start;
  const events: GameEvent[] = [];
  for (const instant of instants) {
    const result = advanceWithDailyDraws(state, instant);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

describe('divisão de intervalo com sorteios no caminho', () => {
  it('o cenário sintético sorteia a cada virada de dia, nos três fluxos, e muda o estoque', () => {
    const { state, events } = advanceWithDailyDraws(newGame('pedra-alta'), 10 * DAY_MS);
    const draws = eventsOfType(events, SYNTHETIC_DRAW);

    expect(draws.map((event) => event.atMs)).toEqual(
      Array.from({ length: 10 }, (_, index) => (index + 1) * DAY_MS),
    );
    expect(Object.keys(state.rng).sort()).toEqual([...RNG_STREAMS].sort());
    expect(new Set(draws.map((event) => event.data.gift)).size).toBeGreaterThan(1);

    // Mesma semente, mesmo passado; outra semente, outros sorteios.
    expect(advanceWithDailyDraws(newGame('pedra-alta'), 10 * DAY_MS).events).toStrictEqual(events);
    const other = advanceWithDailyDraws(newGame('pedra-baixa'), 10 * DAY_MS);
    expect(other.state.rng).not.toEqual(state.rng);
    expect(eventsOfType(other.events, SYNTHETIC_DRAW)).not.toEqual(draws);
  });

  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3), no estado, no RNG e nos eventos', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        (plan, firstMs, secondMs) => {
          const start = prepare(plan);
          const frozen = JSON.stringify(start);
          const t2 = start.lastProcessedAt + firstMs;
          const t3 = t2 + secondMs;

          const direct = advanceWithDailyDraws(start, t3);
          const split = advanceThrough(start, [t2, t3]);

          expect(split.state).toStrictEqual(direct.state);
          expect(split.state.rng).toStrictEqual(direct.state.rng);
          expect(split.events).toStrictEqual(direct.events);
          expect(JSON.stringify(start)).toBe(frozen);
        },
      ),
      { numRuns: 500 },
    );
    // Sozinho, este teste leva uns 10 s; no `pnpm verify`, com a matriz do simulador e as outras
    // propriedades disputando a máquina, já passou dos 30 s do limite padrão duas vezes (V3D-T1
    // e V3D-T2) sem que nada nele tivesse mudado. O limite próprio é para a carga, não para a
    // regra: as 500 execuções continuam as mesmas.
  }, 90_000);

  it('um mês de uma vez ou em até dez pedaços quaisquer consome o gerador igual', () => {
    fc.assert(
      fc.property(
        scenario,
        fc.array(fc.integer({ min: 1, max: MONTH - 1 }), { minLength: 1, maxLength: 9 }),
        (plan, cuts) => {
          const start = prepare(plan);
          const end = start.lastProcessedAt + MONTH;
          const instants = [...cuts]
            .sort((a, b) => a - b)
            .map((cut) => start.lastProcessedAt + cut);

          const direct = advanceWithDailyDraws(start, end);
          const pieces = advanceThrough(start, [...instants, end]);

          expect(pieces.state).toStrictEqual(direct.state);
          expect(pieces.events).toStrictEqual(direct.events);
          // 360 viradas de dia, cada uma com o seu sorteio, nem uma a mais.
          expect(eventsOfType(direct.events, SYNTHETIC_DRAW)).toHaveLength(MONTH / DAY_MS);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('consultar a cada hora, como quem deixa a aba aberta, não rerrola nada', () => {
    const start = prepare({
      seed: 'pedra-alta',
      workers: [2, 3, 1, 0],
      build: 'housing',
      recruit: 3,
      warmUpMs: 5 * HOUR + 1234,
    });
    const end = start.lastProcessedAt + MONTH;
    const hourly = Array.from(
      { length: 720 },
      (_, index) => start.lastProcessedAt + (index + 1) * HOUR,
    );

    const direct = advanceWithDailyDraws(start, end);
    const polled = advanceThrough(start, hourly);
    expect(polled.state).toStrictEqual(direct.state);
    expect(polled.events).toStrictEqual(direct.events);

    // Olhar o futuro e jogar o resultado fora não gasta o gerador de quem ficou no presente.
    const frozen = JSON.stringify(start);
    advanceWithDailyDraws(start, end);
    advanceWithDailyDraws(start, end + DAY_MS);
    expect(JSON.stringify(start)).toBe(frozen);
    expect(advanceWithDailyDraws(start, end)).toStrictEqual(direct);
  });

  it('avançar para o mesmo instante de novo não sorteia de novo', () => {
    const atTurn = advanceWithDailyDraws(newGame('pedra-alta'), 3 * DAY_MS);
    const again = advanceWithDailyDraws(atTurn.state, 3 * DAY_MS);
    expect(again.events).toEqual([]);
    expect(again.state).toBe(atTurn.state);
  });
});

/**
 * A divisão de intervalo com fluxos que nascem e morrem no caminho (V3B-T1). O motor ainda não
 * tem expedição nem caravana: o cenário é sintético (`advanceWithEntities`), com entidades que
 * nascem em viradas de dia marcadas por um roteiro, sorteiam no próprio fluxo, mexem no estoque
 * e terminam, com o fluxo apagado. As mecânicas de verdade repetem esta prova com as suas.
 */
describe('divisão de intervalo com fluxos de entidade que nascem e morrem', () => {
  const entityPlan = fc.array(
    fc.record({
      bornOnDay: fc.integer({ min: 1, max: 380 }),
      family: fc.constantFrom(...RNG_STREAM_FAMILIES),
      lifeDays: fc.integer({ min: 1, max: 60 }),
    }),
    { maxLength: 14 },
  );

  /** O estado como volta do banco: é o que o servidor faz entre dois avanços. */
  const throughBank = (state: GameState) => JSON.parse(JSON.stringify(state)) as GameState;

  function advanceEntitiesThrough(
    start: GameState,
    instants: number[],
    plan: readonly SyntheticEntityPlan[],
    reload = false,
  ) {
    let state = start;
    const events: GameEvent[] = [];
    for (const instant of instants) {
      const result = advanceWithEntities(state, instant, plan);
      state = reload ? throughBank(result.state) : result.state;
      events.push(...result.events);
    }
    return { state, events };
  }

  const steps = (events: GameEvent[], step: string) =>
    eventsOfType(events, SYNTHETIC_ENTITY).filter((event) => event.data.step === step);
  /** Os sorteios de uma entidade, em ordem: o dado e o achado de cada virada. */
  const drawsOf = (events: GameEvent[], entity: string) =>
    steps(events, 'drew')
      .filter((event) => event.data.entity === entity)
      .map((event) => [event.atMs, event.data.roll, event.data.found]);

  const twoTeams: SyntheticEntityPlan[] = [
    { bornOnDay: 2, family: 'expedition', lifeDays: 20 },
    { bornOnDay: 5, family: 'expedition', lifeDays: 12 },
  ];

  it('o cenário cria entidades, sorteia no fluxo de cada uma e apaga o fluxo de quem terminou', () => {
    const plan: SyntheticEntityPlan[] = [
      ...twoTeams,
      { bornOnDay: 5, family: 'caravan', lifeDays: 3 },
    ];
    const start = newGame('pedra-alta');

    // No dia 6 as três vivem, cada uma com o próprio fluxo, ao lado dos três fixos.
    const middle = advanceWithEntities(start, 6 * DAY_MS, plan);
    expect(syntheticEntitiesOf(middle.state).map((entity) => entity.id)).toEqual([
      'caravan-1',
      'expedition-1',
      'expedition-2',
    ]);
    expect(Object.keys(middle.state.rng).sort()).toEqual(
      [
        ...RNG_STREAMS,
        'caravan:caravan-1',
        'expedition:expedition-1',
        'expedition:expedition-2',
      ].sort(),
    );
    expect(middle.state.ids).toEqual({ expedition: 2, caravan: 1 });

    // No dia 30 todas terminaram: os fluxos delas saíram do estado, e os contadores ficaram.
    const { state, events } = advanceWithEntities(start, 30 * DAY_MS, plan);
    expect(syntheticEntitiesOf(state)).toEqual([]);
    expect(Object.keys(state.rng).sort()).toEqual([...RNG_STREAMS].sort());
    expect(state.ids).toEqual({ expedition: 2, caravan: 1 });
    expect(steps(events, 'born').map((event) => [event.atMs / DAY_MS, event.data.entity])).toEqual([
      [2, 'expedition-1'],
      [5, 'expedition-2'],
      [5, 'caravan-1'],
    ]);
    expect(steps(events, 'ended').map((event) => [event.atMs / DAY_MS, event.data.entity])).toEqual(
      [
        [7, 'caravan-1'],
        [16, 'expedition-2'],
        [21, 'expedition-1'],
      ],
    );
    // Uma virada por dia de vida, nem uma a mais; e os sorteios mexeram mesmo no estoque.
    expect(drawsOf(events, 'expedition-1')).toHaveLength(20);
    expect(drawsOf(events, 'expedition-2')).toHaveLength(12);
    expect(drawsOf(events, 'caravan-1')).toHaveLength(3);
    expect(steps(events, 'drew').some((event) => Number(event.data.found) > 0)).toBe(true);
    expect(new Set(steps(events, 'drew').map((event) => event.data.roll)).size).toBeGreaterThan(10);

    // Mesma semente, mesmo passado; outra semente, outros sorteios com os mesmos identificadores.
    expect(advanceWithEntities(start, 30 * DAY_MS, plan).events).toStrictEqual(events);
    const other = advanceWithEntities(newGame('pedra-baixa'), 30 * DAY_MS, plan);
    expect(steps(other.events, 'born')).toStrictEqual(steps(events, 'born'));
    expect(drawsOf(other.events, 'expedition-1')).not.toEqual(drawsOf(events, 'expedition-1'));
  });

  it('advanceTo(t3) é idêntico a advanceTo(t2) seguido de advanceTo(t3), no estado, nos fluxos vivos e apagados, nos contadores e nos eventos', () => {
    fc.assert(
      fc.property(
        scenario,
        entityPlan,
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        fc.integer({ min: 1, max: 15 * DAY_REAL }),
        (plan, entities, firstMs, secondMs) => {
          const start = advanceWithEntities(prepare(plan), plan.warmUpMs + HOUR, entities).state;
          const frozen = JSON.stringify(start);
          const t2 = start.lastProcessedAt + firstMs;
          const t3 = t2 + secondMs;

          const direct = advanceWithEntities(start, t3, entities);
          const split = advanceEntitiesThrough(start, [t2, t3], entities);
          const reloaded = advanceEntitiesThrough(start, [t2, t3], entities, true);

          expect(split.state).toStrictEqual(direct.state);
          expect(split.state.rng).toStrictEqual(direct.state.rng);
          expect(split.state.ids).toStrictEqual(direct.state.ids);
          expect(split.events).toStrictEqual(direct.events);
          // Passar pelo banco no corte não muda nada, nem a ordem das chaves do gerador.
          expect(reloaded.events).toStrictEqual(direct.events);
          expect(JSON.stringify(reloaded.state)).toBe(JSON.stringify(direct.state));
          expect(JSON.stringify(start)).toBe(frozen);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('um mês em até dez pedaços quaisquer cria, sorteia e encerra as mesmas entidades, e nenhum identificador se repete', () => {
    fc.assert(
      fc.property(
        scenario,
        entityPlan,
        fc.array(fc.integer({ min: 1, max: MONTH - 1 }), { minLength: 1, maxLength: 9 }),
        (plan, entities, cuts) => {
          const start = prepare(plan);
          const end = start.lastProcessedAt + MONTH;
          const instants = [...cuts]
            .sort((a, b) => a - b)
            .map((cut) => start.lastProcessedAt + cut);

          const direct = advanceWithEntities(start, end, entities);
          const pieces = advanceEntitiesThrough(start, [...instants, end], entities, true);

          expect(pieces.events).toStrictEqual(direct.events);
          expect(JSON.stringify(pieces.state)).toBe(JSON.stringify(direct.state));

          // Cada entidade do roteiro que caiu no mês nasceu uma vez, com um identificador só dela,
          // mesmo com o estado salvo e recarregado em cada corte e com fluxos já apagados.
          const firstDay = Math.floor(start.lastProcessedAt / DAY_MS) + 1;
          const lastDay = Math.floor(end / DAY_MS);
          const expected = entities.filter(
            (entity) => entity.bornOnDay >= firstDay && entity.bornOnDay <= lastDay,
          );
          const born = steps(pieces.events, 'born').map((event) => event.data.entity);
          expect(born).toHaveLength(expected.length);
          expect(new Set(born).size).toBe(born.length);
          for (const family of RNG_STREAM_FAMILIES) {
            expect(pieces.state.ids[family] ?? 0).toBe(
              expected.filter((entity) => entity.family === family).length,
            );
          }
          // No fim só ficam no gerador os fluxos fixos e os de quem ainda vive: quem terminou
          // não deixa nada, e o estado não cresce com o passado.
          const alive = syntheticEntitiesOf(pieces.state).map((entity) => entity.stream as string);
          expect(Object.keys(pieces.state.rng).sort()).toEqual([...RNG_STREAMS, ...alive].sort());
          const ended = steps(pieces.events, 'ended').map((event) => event.data.entity);
          expect(
            new Set([...ended, ...syntheticEntitiesOf(pieces.state).map((e) => e.id)]),
          ).toEqual(new Set(born));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('uma terceira entidade da mesma família, criada com as duas vivas, não desloca os sorteios de nenhuma', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 6, max: 16 }),
        fc.integer({ min: 1, max: 30 }),
        (seed, bornOnDay, lifeDays) => {
          const start = newGame(seed);
          const end = 40 * DAY_MS;
          const third: SyntheticEntityPlan = { bornOnDay, family: 'expedition', lifeDays };
          const two = advanceWithEntities(start, end, twoTeams);
          const three = advanceWithEntities(start, end, [...twoTeams, third]);

          // A terceira existiu, sorteou no fluxo dela e recebeu o identificador seguinte.
          expect(drawsOf(three.events, 'expedition-3').length).toBe(
            Math.min(lifeDays, 40 - bornOnDay + 1),
          );
          // As duas primeiras sortearam exatamente o que sorteariam sem ela, virada por virada.
          expect(drawsOf(three.events, 'expedition-1')).toEqual(
            drawsOf(two.events, 'expedition-1'),
          );
          expect(drawsOf(three.events, 'expedition-2')).toEqual(
            drawsOf(two.events, 'expedition-2'),
          );
          // E os fluxos fixos também: o Conselho, a moral e a Horda não sentem a terceira equipe.
          for (const stream of RNG_STREAMS) {
            expect(three.state.rng[stream]).toStrictEqual(two.state.rng[stream]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('uma entidade de outra família, criada entre as duas, não muda o identificador nem os sorteios delas', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 12 }),
        fc.integer({ min: 3, max: 4 }),
        fc.integer({ min: 1, max: 30 }),
        (seed, bornOnDay, lifeDays) => {
          const start = newGame(seed);
          const end = 40 * DAY_MS;
          const [first, second] = twoTeams as [SyntheticEntityPlan, SyntheticEntityPlan];
          const between: SyntheticEntityPlan = { bornOnDay, family: 'caravan', lifeDays };
          const two = advanceWithEntities(start, end, twoTeams);
          const three = advanceWithEntities(start, end, [first, between, second]);

          expect(steps(three.events, 'born').map((event) => event.data.entity)).toEqual([
            'expedition-1',
            'caravan-1',
            'expedition-2',
          ]);
          expect(drawsOf(three.events, 'caravan-1')).toHaveLength(lifeDays);
          expect(drawsOf(three.events, 'expedition-1')).toEqual(
            drawsOf(two.events, 'expedition-1'),
          );
          expect(drawsOf(three.events, 'expedition-2')).toEqual(
            drawsOf(two.events, 'expedition-2'),
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it('a ordem do roteiro no mesmo dia decide o identificador, não a sorte de quem já existia', () => {
    // Duas equipes nascem no mesmo dia: quem vem primeiro no roteiro é a expedition-2. A que já
    // existia (expedition-1) sorteia o mesmo nas duas ordens.
    const start = newGame('pedra-alta');
    const elder: SyntheticEntityPlan = { bornOnDay: 1, family: 'expedition', lifeDays: 25 };
    const short: SyntheticEntityPlan = { bornOnDay: 4, family: 'expedition', lifeDays: 2 };
    const long: SyntheticEntityPlan = { bornOnDay: 4, family: 'expedition', lifeDays: 9 };
    const one = advanceWithEntities(start, 30 * DAY_MS, [elder, short, long]);
    const other = advanceWithEntities(start, 30 * DAY_MS, [elder, long, short]);
    expect(drawsOf(one.events, 'expedition-1')).toEqual(drawsOf(other.events, 'expedition-1'));
    expect(drawsOf(one.events, 'expedition-2')).toHaveLength(2);
    expect(drawsOf(other.events, 'expedition-2')).toHaveLength(9);
    // O mesmo nome de fluxo dá a mesma sequência, pelo tempo que cada uma viveu.
    expect(
      drawsOf(other.events, 'expedition-2')
        .slice(0, 2)
        .map(([, roll]) => roll),
    ).toEqual(drawsOf(one.events, 'expedition-2').map(([, roll]) => roll));
  });

  it('consultar a cada hora, salvando a cada consulta, não rerrola nem recria nada', () => {
    const plan: SyntheticEntityPlan[] = [
      ...twoTeams,
      { bornOnDay: 9, family: 'caravan', lifeDays: 40 },
      { bornOnDay: 30, family: 'expedition', lifeDays: 500 },
    ];
    const start = prepare({
      seed: 'pedra-alta',
      workers: [2, 3, 1, 0],
      build: 'housing',
      recruit: 3,
      warmUpMs: 5 * HOUR + 1234,
    });
    const end = start.lastProcessedAt + 10 * DAY_REAL;
    const hourly = Array.from(
      { length: 240 },
      (_, index) => start.lastProcessedAt + (index + 1) * HOUR,
    );
    const direct = advanceWithEntities(start, end, plan);
    const polled = advanceEntitiesThrough(start, hourly, plan, true);
    expect(polled.events).toStrictEqual(direct.events);
    expect(JSON.stringify(polled.state)).toBe(JSON.stringify(direct.state));
    // O feudo foi preparado depois da virada do dia 2: a primeira equipe do roteiro ficou no
    // passado e não nasce. As outras três nasceram, e só a última ainda vive. No caminho o feudo
    // recebeu a carta da estrangeira, que ninguém respondeu: o conselho a acolheu, e o herói
    // dela tem o identificador dele, igual nos dois caminhos.
    expect(direct.state.ids).toEqual({ expedition: 2, caravan: 1, hero: 1 });
    expect(syntheticEntitiesOf(direct.state).map((entity) => entity.id)).toEqual(['expedition-2']);
    expect(Object.keys(direct.state.rng).sort()).toEqual(
      [...RNG_STREAMS, 'expedition:expedition-2'].sort(),
    );
  });
});
