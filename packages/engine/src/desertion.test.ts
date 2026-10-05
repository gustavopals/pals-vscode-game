import { balance } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { consumptionRate } from './economy';
import { famineDurationAt, famineResumeWindowMs } from './famine';
import { durationText } from './format';
import { addMoraleEffect, famineDesertionPace, famineDesertionsOwedAt } from './morale';
import { settleScarcity } from './scarcity';
import { cloneState } from './state';
import {
  accept,
  command,
  DAY,
  eventsOfType,
  famineSince,
  gameAt,
  HOUR,
  MINUTE,
  SUMMER,
  YEAR,
} from './test-helpers';
import type { DifficultyId, GameEvent, GameState } from './types';
import { realSecondsCeil } from './units';
import { deriveViewState } from './view';

/**
 * A deserção por fome em tempo real e a fome que reabre (GDD §5.6 e §12.1; ADR 0016, itens 2 e
 * 3; roadmap V2G-T2).
 *
 * - A carência é de 12 h **reais** e o passo, de um aldeão a cada 2 h **reais**, em qualquer
 *   ritmo; quem cobra é a virada do dia de jogo, que tira os aldeões que o prazo já deve.
 * - A fome que reabre menos de 2 h **reais** depois de acabar é a mesma: continua de onde
 *   parou, com a duração e os desertores que tinha.
 */

/** Os três ritmos oferecidos e o que as 12 h, as 2 h e as 2 h reais viram em cada um, em jogo. */
const PACES = [
  { timeScale: 3, graceMs: 36 * HOUR, stepMs: 6 * HOUR, windowMs: 6 * HOUR },
  { timeScale: 1, graceMs: 12 * HOUR, stepMs: 2 * HOUR, windowMs: 2 * HOUR },
  { timeScale: 0.5, graceMs: 6 * HOUR, stepMs: 1 * HOUR, windowMs: 1 * HOUR },
] as const;

/**
 * Verão, `phaseMs` depois do começo de um dia de jogo: 40 habitantes (as casas cheias: nenhum
 * colono chega), três lenhadores, ninguém na Fazenda e a despensa vazia: a fome abre no
 * primeiro instante. Um efeito de teste segura a moral acima de 25 por semanas: aqui só a fome
 * tira gente do feudo, sem sorteio nenhum.
 */
function hungry(
  timeScale: number,
  phaseMs = 30 * MINUTE,
  edit: (draft: GameState) => void = () => {},
): GameState {
  return gameAt(SUMMER + phaseMs, (draft) => {
    draft.settings.timeScale = timeScale;
    draft.settlement.population.villagers = 40;
    draft.settlement.workers = { farm: 0, lumberMill: 3, quarry: 0, goldMine: 0 };
    draft.settlement.resources.food = 0;
    addMoraleEffect(draft, {
      id: 'teste',
      label: 'efeito de teste',
      amount: 100,
      untilMs: draft.lastProcessedAt + YEAR,
    });
    edit(draft);
  });
}

/**
 * O mesmo feudo com pouca gente: `villagers` aldeões, todos sem ofício. Com vaga nas casas, a
 * moral alta traria colonos: aqui o efeito de teste é menor, e a moral fica entre a que faz
 * partir e a que faz chegar por mais de duas semanas de jogo.
 */
function fewHungry(timeScale: number, villagers: number): GameState {
  return hungry(timeScale, 30 * MINUTE, (draft) => {
    draft.settlement.population.villagers = villagers;
    draft.settlement.workers.lumberMill = 0;
    draft.settlement.moraleEffects = [];
    addMoraleEffect(draft, {
      id: 'teste',
      label: 'efeito de teste',
      amount: 30,
      untilMs: draft.lastProcessedAt + YEAR,
    });
  });
}

/** Os instantes das deserções, um por aldeão, na ordem em que aconteceram. */
const deserters = (events: GameEvent[]) =>
  eventsOfType(events, 'villagerDeserted').map((event) => event.atMs);

/** O dia de jogo de um instante, contado do começo do verão do cenário. */
const dayOf = (atMs: number) => (atMs - SUMMER) / DAY;

/**
 * Põe na despensa, agora, comida para exatamente `forMs` de consumo dos habitantes: um ganho
 * discreto, como o de uma carta, com o acerto do instante. A fome fecha aqui e, se nada mudar,
 * reabre `forMs` depois, nem um milissegundo antes.
 */
function feed(state: GameState, forMs: number): { state: GameState; events: GameEvent[] } {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const stock = consumptionRate(draft) * forMs;
  draft.settlement.resources.food = Math.floor(stock / HOUR);
  draft.settlement.accumulators.food = stock % HOUR;
  settleScarcity(draft, draft.lastProcessedAt, events);
  return { state: draft, events };
}

/**
 * A manobra do furo de C-4: todos os aldeões sem ofício vão à Fazenda e voltam, em duas ordens
 * seguidas, no mesmo instante. A primeira fecha a fome (o saldo de comida fica positivo) e a
 * segunda a reabre, sem ninguém ter comido.
 */
function maneuver(state: GameState): { state: GameState; events: GameEvent[] } {
  const { villagers } = state.settlement.population;
  const idle = villagers - state.settlement.workers.lumberMill;
  const toFarm = accept(state, command('setWorkers', { building: 'farm', count: idle }));
  const back = accept(toFarm.state, command('setWorkers', { building: 'farm', count: 0 }));
  return { state: back.state, events: [...toFarm.events, ...back.events] };
}

describe('os prazos da deserção são tempo real, convertidos pelo ritmo', () => {
  it.each(PACES)(
    'ritmo $timeScale: 12 h reais de carência, 2 h reais de passo e 2 h reais de janela',
    ({ timeScale, graceMs, stepMs, windowMs }) => {
      const state = hungry(timeScale);
      expect(famineDesertionPace(state)).toEqual({ graceMs, stepMs });
      expect(famineResumeWindowMs(state)).toBe(windowMs);
      // É a conta do conteúdo, e não outra.
      expect(graceMs).toBe(balance.morale.famineDesertionAfterRealMs * timeScale);
      expect(stepMs).toBe(balance.morale.famineDesertionEveryRealMs * timeScale);
      expect(windowMs).toBe(balance.morale.famineResumeWithinRealMs * timeScale);
    },
  );

  it('um ritmo que não dá ms inteiros arredonda, e nenhum prazo vira zero', () => {
    const odd = hungry(0.7);
    expect(famineDesertionPace(odd)).toEqual({ graceMs: 30_240_000, stepMs: 5_040_000 });
    const tiny = hungry(0.000_000_01);
    expect(famineDesertionPace(tiny)).toEqual({ graceMs: 1, stepMs: 1 });
    expect(famineResumeWindowMs(tiny)).toBe(1);
  });
});

describe('o instante exato de cada deserção, nos três ritmos', () => {
  // A fome abre meia hora de jogo depois do começo de um dia. O primeiro aldeão é devido
  // quando ela completa a carência, e sai na primeira virada de dia a partir daí.
  it.each([
    // Rápido: devido às 36 h 30 de jogo (19º dia), e depois um a cada três viradas.
    { timeScale: 3, days: [19, 22, 25, 28] },
    // Normal: devido às 12 h 30 (7º dia), e depois um por virada, como sempre foi.
    { timeScale: 1, days: [7, 8, 9, 10] },
    // Tranquilo: devido às 6 h 30; a virada das 8 h já encontra dois, e são dois por virada.
    { timeScale: 0.5, days: [4, 4, 5, 5, 6, 6] },
  ])('ritmo $timeScale: desertam nas viradas dos dias $days', ({ timeScale, days }) => {
    const start = hungry(timeScale);
    const last = SUMMER + (days[days.length - 1] ?? 0) * DAY;
    const { state, events } = advanceTo(start, last);
    expect(eventsOfType(events, 'famineStarted').map((event) => event.atMs)).toEqual([
      SUMMER + 30 * MINUTE,
    ]);
    expect(deserters(events).map(dayOf)).toEqual(days);
    expect(state.settlement.population.villagers).toBe(40 - days.length);
    // A conta fecha no que era devido, e não houve sorteio nenhum: a deserção é certa.
    expect(state.settlement.famine).toEqual(famineSince(SUMMER + 30 * MINUTE, days.length));
    expect(state.rng).toEqual({});
    // Um milissegundo antes da primeira, ninguém saiu.
    const first = SUMMER + (days[0] ?? 0) * DAY;
    const before = advanceTo(start, first - 1);
    expect(deserters(before.events)).toEqual([]);
    expect(before.state.settlement.population.villagers).toBe(40);
  });

  it.each([
    // A carência se completa em cima de uma virada: o primeiro sai nela.
    { timeScale: 3, phaseMs: 0, days: [18, 21, 24] },
    { timeScale: 1, phaseMs: 0, days: [6, 7, 8] },
    // No Tranquilo a primeira virada cobra um, e as seguintes, dois (um a cada hora de jogo).
    { timeScale: 0.5, phaseMs: 0, days: [3, 4, 4, 5, 5] },
    // Um milissegundo depois da virada: a carência só se completa depois da virada seguinte.
    { timeScale: 3, phaseMs: 1, days: [19, 22, 25] },
    { timeScale: 1, phaseMs: 1, days: [7, 8, 9] },
    { timeScale: 0.5, phaseMs: 1, days: [4, 4, 5, 5] },
    // Um milissegundo antes do fim do dia.
    { timeScale: 3, phaseMs: DAY - 1, days: [19, 22, 25] },
    { timeScale: 0.5, phaseMs: DAY - 1, days: [4, 5, 5, 6, 6] },
  ])(
    'ritmo $timeScale, fome aberta $phaseMs ms depois de uma virada: dias $days',
    ({ timeScale, phaseMs, days }) => {
      const last = SUMMER + (days[days.length - 1] ?? 0) * DAY;
      expect(deserters(advanceTo(hungry(timeScale, phaseMs), last).events).map(dayOf)).toEqual(
        days,
      );
    },
  );

  it('em tempo real a primeira deserção vem entre 12 h e 12 h mais um dia de jogo, em qualquer ritmo', () => {
    for (const { timeScale } of PACES) {
      for (const phaseMs of [0, 1, 30 * MINUTE, DAY - 1]) {
        const start = hungry(timeScale, phaseMs);
        const { events } = advanceTo(start, start.lastProcessedAt + 40 * DAY);
        const [first] = deserters(events);
        const realMs = ((first ?? 0) - start.lastProcessedAt) / timeScale;
        expect(realMs).toBeGreaterThanOrEqual(12 * HOUR);
        expect(realMs).toBeLessThan(12 * HOUR + DAY / timeScale);
      }
    }
  });

  it('a deserção é o último passo da moral na virada: a moral do evento é a recém-calculada', () => {
    const start = hungry(1);
    const { events } = advanceTo(start, SUMMER + 7 * DAY);
    const [deserted] = eventsOfType(events, 'villagerDeserted');
    // 50 + 100 − 20 (fome) − 10 (casas cheias) − 12 (6 dias inteiros de fome) = 108, limitada.
    expect(deserted?.data).toMatchObject({ villagers: 39, morale: 100 });
    const order = events.filter((event) => event.atMs === SUMMER + 7 * DAY).map((e) => e.type);
    expect(order.indexOf('dayStarted')).toBeLessThan(order.indexOf('villagerDeserted'));
  });

  it('em Camponês ninguém deserta, em nenhum ritmo', () => {
    for (const { timeScale } of PACES) {
      const start = hungry(timeScale, 30 * MINUTE, (draft) => {
        draft.settings.difficulty = 'peasant';
      });
      const { state, events } = advanceTo(start, SUMMER + 40 * DAY);
      expect(deserters(events)).toEqual([]);
      expect(state.settlement.famine).toEqual(famineSince(SUMMER + 30 * MINUTE));
    }
  });
});

describe('o piso de 3 aldeões e o que ele perdoa', () => {
  it('quem o piso impediu de sair fica perdoado: a população que sobe depois não sai em bloco', () => {
    // Tranquilo, 4 aldeões: a primeira virada deve dois, e só um pode sair.
    const start = fewHungry(0.5, 4);
    const first = advanceTo(start, SUMMER + 4 * DAY);
    expect(deserters(first.events)).toEqual([SUMMER + 4 * DAY]);
    expect(first.state.settlement.population.villagers).toBe(3);
    expect(first.state.settlement.famine?.deserted).toBe(2);
    // No piso, as viradas seguintes não tiram ninguém, e a conta continua fechando.
    const floor = advanceTo(first.state, SUMMER + 6 * DAY);
    expect(deserters(floor.events)).toEqual([]);
    expect(floor.state.settlement.famine?.deserted).toBe(6);
    // Dez aldeões a mais chegam ao feudo: a virada seguinte cobra só os dois dela.
    const grown = cloneState(floor.state);
    grown.settlement.population.villagers = 13;
    const next = advanceTo(grown, SUMMER + 7 * DAY);
    expect(deserters(next.events)).toEqual([SUMMER + 7 * DAY, SUMMER + 7 * DAY]);
    expect(next.state.settlement.population.villagers).toBe(11);
  });

  it('para no piso, em todo ritmo', () => {
    for (const { timeScale } of PACES) {
      // Com a moral segura só a fome tira gente: os três que estão acima do piso, e mais ninguém.
      const { state, events } = advanceTo(fewHungry(timeScale, 6), SUMMER + 12 * DAY);
      if (timeScale < 3) {
        expect(eventsOfType(events, 'villagerDeserted')).toHaveLength(3);
        expect(state.settlement.population.villagers).toBe(balance.morale.populationFloor);
      }
      // E, com a moral já no chão e os sorteios de partida no caminho, o piso continua valendo.
      const long = advanceTo(state, SUMMER + 60 * DAY);
      const all = [...events, ...long.events];
      expect(eventsOfType(all, 'villagerDeserted').length).toBeLessThanOrEqual(3);
      expect(long.state.settlement.population.villagers).toBe(balance.morale.populationFloor);
    }
  });
});

describe('a fome que reabre logo é a mesma (o furo de C-4)', () => {
  /** Avança virada a virada e anota a moral e a população de cada uma. */
  function turns(
    start: GameState,
    untilDay: number,
    between: (state: GameState) => { state: GameState; events: GameEvent[] } = (state) => ({
      state,
      events: [],
    }),
    everyMs = DAY,
    offsetMs = 0,
  ) {
    let state = start;
    const events: GameEvent[] = [];
    const log: Array<{ day: number; morale: number; villagers: number }> = [];
    const end = SUMMER + untilDay * DAY;
    // Os instantes da manobra e as viradas, em ordem.
    const instants = new Set<number>();
    for (let at = SUMMER + DAY; at <= end; at += DAY) {
      instants.add(at);
    }
    const orders = new Set<number>();
    for (let at = start.lastProcessedAt + everyMs + offsetMs; at < end; at += everyMs) {
      orders.add(at);
      instants.add(at);
    }
    for (const at of [...instants].sort((a, b) => a - b)) {
      const advanced = advanceTo(state, at);
      state = advanced.state;
      events.push(...advanced.events);
      if (at % DAY === 0) {
        const { morale, population } = state.settlement;
        log.push({ day: dayOf(at), morale, villagers: population.villagers });
      }
      if (orders.has(at) && state.settlement.famine !== null) {
        const done = between(state);
        state = done.state;
        events.push(...done.events);
      }
    }
    return { state, events, log };
  }

  it('a manobra fecha e reabre a fome no mesmo instante, e a fome continua de onde estava', () => {
    const start = advanceTo(hungry(1), SUMMER + 5 * HOUR).state;
    expect(start.settlement.famine).toEqual(famineSince(SUMMER + 30 * MINUTE));
    const { state, events } = maneuver(start);
    expect(events.map((event) => [event.type, event.atMs])).toEqual([
      ['famineEnded', SUMMER + 5 * HOUR],
      ['famineStarted', SUMMER + 5 * HOUR],
    ]);
    // Reabriu agora, com as 4 h 30 que já tinha durado: a duração que conta não mudou.
    expect(state.settlement.famine).toEqual({
      sinceMs: SUMMER + 5 * HOUR,
      carriedMs: 4 * HOUR + 30 * MINUTE,
      deserted: 0,
    });
    expect(state.settlement.lastFamine).toBeNull();
    expect(famineDurationAt(state, SUMMER + 5 * HOUR)).toBe(
      famineDurationAt(start, SUMMER + 5 * HOUR),
    );
    // Fora o indicador da fome, o feudo é o mesmo de antes das duas ordens.
    expect({ ...state.settlement, famine: null }).toEqual({ ...start.settlement, famine: null });
  });

  it.each(PACES)(
    'ritmo $timeScale: repetir a manobra não muda nenhum instante de deserção nem a moral de nenhuma virada',
    ({ timeScale }) => {
      const start = hungry(timeScale);
      const plain = turns(start, 30);
      expect(deserters(plain.events).length).toBeGreaterThan(3);
      // A cada 5 h de jogo, a cada 10 h (como na medição do furo), e em cima de cada virada.
      for (const [everyMs, offsetMs] of [
        [5 * HOUR, 0],
        [10 * HOUR, 0],
        [DAY, DAY - 30 * MINUTE],
        [DAY, DAY - 30 * MINUTE - 1],
        [7 * MINUTE, 0],
      ] as const) {
        const cheated = turns(start, 30, maneuver, everyMs, offsetMs);
        // A manobra aconteceu mesmo: a Crônica tem a fome acabando e recomeçando.
        expect(eventsOfType(cheated.events, 'famineEnded').length).toBeGreaterThan(3);
        expect(deserters(cheated.events)).toEqual(deserters(plain.events));
        expect(cheated.log).toEqual(plain.log);
        expect(cheated.state.settlement.population).toEqual(plain.state.settlement.population);
        expect(cheated.state.settlement.morale).toBe(plain.state.settlement.morale);
        expect(cheated.state.settlement.famine?.deserted).toBe(
          plain.state.settlement.famine?.deserted,
        );
        expect(famineDurationAt(cheated.state, cheated.state.lastProcessedAt)).toBe(
          famineDurationAt(plain.state, plain.state.lastProcessedAt),
        );
      }
    },
  );

  it('a moral de quem repete a manobra leva o −2 de cada dia de fome, como a de quem não a faz', () => {
    // Sem o efeito de teste: a moral cai de verdade, e os dias de fome pesam.
    const bare = (draft: GameState) => {
      draft.settlement.moraleEffects = [];
      draft.settings.difficulty = 'peasant';
      draft.settlement.population.villagers = 3;
      draft.settlement.workers.lumberMill = 0;
    };
    const start = hungry(1, 30 * MINUTE, bare);
    const plain = turns(start, 8);
    const cheated = turns(start, 8, maneuver, 3 * HOUR);
    // 50 − 20 (fome) − 2 por dia inteiro de fome: a fome abriu meia hora depois de uma virada.
    expect(plain.log.map((entry) => entry.morale)).toEqual([30, 28, 26, 24, 22, 20, 18, 16]);
    expect(cheated.log).toEqual(plain.log);
  });
});

describe('a janela da fome que reabre, dos dois lados', () => {
  it.each(PACES)(
    'ritmo $timeScale: a 1 ms do fim da janela é a mesma fome; no fim exato, é outra',
    ({ timeScale, windowMs }) => {
      // A fome abre meia hora depois de uma virada e a comida chega 3 h de jogo depois.
      const openedAt = SUMMER + 30 * MINUTE;
      const fedAt = openedAt + 3 * HOUR;
      const starving = advanceTo(hungry(timeScale), fedAt).state;

      const inside = feed(starving, windowMs - 1);
      expect(inside.events.map((event) => event.type)).toEqual(['famineEnded']);
      expect(inside.state.settlement.famine).toBeNull();
      expect(inside.state.settlement.lastFamine).toEqual({
        endedAtMs: fedAt,
        lastedMs: 3 * HOUR,
        deserted: 0,
      });
      const reopenedAt = fedAt + windowMs - 1;
      expect(advanceTo(inside.state, reopenedAt - 1).state.settlement.famine).toBeNull();
      const same = advanceTo(inside.state, reopenedAt);
      expect(eventsOfType(same.events, 'famineStarted').map((event) => event.atMs)).toEqual([
        reopenedAt,
      ]);
      // A mesma fome: abre de novo com as 3 h que já tinha, e o registro da anterior sai.
      expect(same.state.settlement.famine).toEqual({
        sinceMs: reopenedAt,
        carriedMs: 3 * HOUR,
        deserted: 0,
      });
      expect(same.state.settlement.lastFamine).toBeNull();

      const outside = feed(starving, windowMs);
      const freshAt = fedAt + windowMs;
      expect(advanceTo(outside.state, freshAt - 1).state.settlement.famine).toBeNull();
      const fresh = advanceTo(outside.state, freshAt);
      expect(eventsOfType(fresh.events, 'famineStarted').map((event) => event.atMs)).toEqual([
        freshAt,
      ]);
      // Outra fome: do zero.
      expect(fresh.state.settlement.famine).toEqual(famineSince(freshAt));
      expect(fresh.state.settlement.lastFamine).toBeNull();
    },
  );

  it.each(PACES)(
    'ritmo $timeScale: o tempo sem fome não conta, e a deserção anda exatamente esse tanto',
    ({ timeScale, graceMs, stepMs, windowMs }) => {
      const openedAt = SUMMER + 30 * MINUTE;
      const fedAt = openedAt + 3 * HOUR;
      const starving = advanceTo(hungry(timeScale), fedAt).state;
      // A virada que cobra cada um dos seis primeiros desertores de uma fome que conta de
      // `countedFrom`: o instante em que cada um é devido, e a primeira virada a partir dele.
      const expected = (countedFrom: number) =>
        [0, 1, 2, 3, 4, 5].map(
          (index) => Math.ceil((countedFrom + graceMs + index * stepMs) / DAY) * DAY,
        );
      const firstSix = (events: GameEvent[]) => deserters(events).slice(0, 6);
      // Sem pausa nenhuma, a referência.
      const plain = advanceTo(starving, SUMMER + 60 * DAY);
      expect(firstSix(plain.events)).toEqual(expected(openedAt));
      // Dentro da janela: os prazos andam exatamente o tempo que a despensa durou.
      const gap = windowMs - 1;
      const resumed = advanceTo(feed(starving, gap).state, SUMMER + 60 * DAY);
      expect(firstSix(resumed.events)).toEqual(expected(openedAt + gap));
      // No fim exato da janela: a fome nova conta do zero, a partir de quando reabriu.
      const restarted = advanceTo(feed(starving, windowMs).state, SUMMER + 60 * DAY);
      expect(firstSix(restarted.events)).toEqual(expected(fedAt + windowMs));
    },
  );

  it('a fome retomada leva os desertores que já tinha cobrado, e a seguinte começa do zero', () => {
    // Normal: a fome abre meia hora depois de uma virada e cobra dois (viradas dos dias 7 e 8).
    const fedAt = SUMMER + 8 * DAY + 20 * MINUTE;
    const starving = advanceTo(hungry(1), fedAt).state;
    expect(starving.settlement.famine).toEqual(famineSince(SUMMER + 30 * MINUTE, 2));
    expect(starving.settlement.population.villagers).toBe(38);
    // Comida para uma hora: a fome reabre dentro da janela de 2 h.
    const resumed = advanceTo(feed(starving, HOUR).state, fedAt + HOUR).state;
    expect(resumed.settlement.famine).toEqual({
      sinceMs: fedAt + HOUR,
      carriedMs: fedAt - (SUMMER + 30 * MINUTE),
      deserted: 2,
    });
    // O terceiro é devido com 16 h de fome contada: a hora de despensa cheia o empurra das
    // 16 h 30 para as 17 h 30, e a virada que o cobra continua sendo a do dia 9.
    const later = advanceTo(resumed, SUMMER + 10 * DAY);
    expect(deserters(later.events).map(dayOf)).toEqual([9, 10]);
    // Comida para três horas: a janela passa, e a fome seguinte não deve ninguém por 12 h.
    const fedAgain = feed(later.state, 3 * HOUR);
    const freshAt = SUMMER + 10 * DAY + 3 * HOUR;
    const fresh = advanceTo(fedAgain.state, freshAt + 11 * HOUR);
    expect(fresh.state.settlement.famine).toEqual(famineSince(freshAt));
    expect(deserters(fresh.events)).toEqual([]);
  });

  it('a fila de recrutamento só fica parada enquanto há fome: o tempo de cada trecho conta uma vez', () => {
    const openedAt = SUMMER + 30 * MINUTE;
    const start = hungry(1, 30 * MINUTE, (draft) => {
      draft.settlement.recruitmentQueue = [{ finishesAtMs: openedAt + 4 * HOUR }];
    });
    // 3 h de fome, 1 h de despensa cheia (dentro da janela), 2 h de fome, e comida de novo.
    const first = feed(advanceTo(start, openedAt + 3 * HOUR).state, HOUR).state;
    expect(first.settlement.recruitmentQueue).toEqual([{ finishesAtMs: openedAt + 7 * HOUR }]);
    const again = advanceTo(first, openedAt + 6 * HOUR).state;
    expect(again.settlement.famine).toMatchObject({ carriedMs: 3 * HOUR });
    const second = feed(again, 30 * HOUR).state;
    // Só as 2 h do segundo trecho entram: as 3 h do primeiro já tinham sido somadas.
    expect(second.settlement.recruitmentQueue).toEqual([{ finishesAtMs: openedAt + 9 * HOUR }]);
    expect(second.settlement.lastFamine).toEqual({
      endedAtMs: openedAt + 6 * HOUR,
      lastedMs: 5 * HOUR,
      deserted: 0,
    });
  });
});

describe('a visão diz os prazos da deserção em tempo real', () => {
  const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
  /** As frases da moral que falam da deserção por fome (as outras são dos sorteios). */
  const desertionNotes = (state: GameState) =>
    view(state).morale.notes.filter((text) => text.includes('Faltam'));

  it.each([
    // Rápido: 2 h de jogo de fome são 40 min reais; o primeiro sai na virada do dia 19.
    { timeScale: 3, elapsed: 2400, left: '11 h 50 min' },
    // Normal: a virada do dia 7.
    { timeScale: 1, elapsed: 7200, left: '11 h 30 min' },
    // Tranquilo: 2 h de jogo são 4 h reais; a virada do dia 4.
    { timeScale: 0.5, elapsed: 14_400, left: '11 h' },
  ])(
    'ritmo $timeScale: 12 h de carência e um aldeão a cada 2 h, com o prazo até a virada que cobra',
    ({ timeScale, elapsed, left }) => {
      const state = advanceTo(hungry(timeScale), SUMMER + 2 * HOUR + 30 * MINUTE).state;
      expect(view(state).famine?.secondsElapsed).toBe(elapsed);
      expect(desertionNotes(state)).toEqual([
        `Depois de 12 h de fome, deserta um aldeão a cada 2 h, na virada do dia. Faltam ${left} para o primeiro.`,
      ]);
    },
  );

  it('passada a carência, a frase diz quando sai o próximo, no ritmo da partida', () => {
    // Rápido, dois minutos de jogo depois da virada do 19º dia: o primeiro já saiu, e o
    // próximo sai na virada do 22º (três dias de jogo menos dois minutos: 1 h 59 min 20 s).
    const fast = advanceTo(hungry(3), SUMMER + 19 * DAY + 2 * MINUTE).state;
    expect(desertionNotes(fast)).toEqual([
      'A fome já dura 12 h ou mais: deserta um aldeão a cada 2 h de fome, na virada do dia, até a comida voltar. Faltam 2 h para o próximo.',
    ]);
    // Normal: a próxima virada, daqui a 1 h 58 min.
    const normal = advanceTo(hungry(1), SUMMER + 7 * DAY + 2 * MINUTE).state;
    expect(desertionNotes(normal)).toEqual([
      'A fome já dura 12 h ou mais: deserta um aldeão a cada 2 h de fome, na virada do dia, até a comida voltar. Faltam 1 h 58 min para o próximo.',
    ]);
    // Tranquilo: a próxima virada, daqui a 3 h 56 min reais.
    const slow = advanceTo(hungry(0.5), SUMMER + 4 * DAY + 2 * MINUTE).state;
    expect(desertionNotes(slow)).toEqual([
      'A fome já dura 12 h ou mais: deserta um aldeão a cada 2 h de fome, na virada do dia, até a comida voltar. Faltam 3 h 56 min para o próximo.',
    ]);
  });

  it('o prazo anunciado é o da virada que cobra: o motor confirma', () => {
    let checked = 0;
    for (const { timeScale } of PACES) {
      let state = hungry(timeScale);
      for (let step = 0; step < 14; step += 1) {
        state = advanceTo(state, state.lastProcessedAt + 5 * HOUR + 7 * MINUTE).state;
        const [note] = desertionNotes(state);
        const { famine } = state.settlement;
        if (note === undefined || famine === null) {
          continue;
        }
        // A primeira virada, daqui em diante, em que a fome deve mais do que já cobrou.
        let turn = (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;
        while (famineDesertionsOwedAt(state, turn) <= famine.deserted) {
          turn += DAY;
        }
        const left = durationText(realSecondsCeil(turn - state.lastProcessedAt, timeScale));
        expect(note).toContain(`Faltam ${left} para o `);
        const before = advanceTo(state, turn - 1);
        expect(deserters(before.events)).toEqual([]);
        expect(deserters(advanceTo(before.state, turn).events).length).toBeGreaterThan(0);
        checked += 1;
      }
    }
    // No Tranquilo o feudo chega ao piso antes do fim, e ali a frase é a da proteção.
    expect(checked).toBeGreaterThan(30);
  });

  it('a fome retomada mostra a duração que conta, e não o tempo desde que reabriu', () => {
    const fedAt = SUMMER + 30 * MINUTE + 3 * HOUR;
    const starving = advanceTo(hungry(1), fedAt).state;
    const resumed = advanceTo(feed(starving, HOUR).state, fedAt + HOUR + 10 * MINUTE).state;
    const { famine } = view(resumed);
    // 3 h antes de a comida chegar e 10 min depois de reabrir.
    expect(famine?.secondsElapsed).toBe((3 * HOUR + 10 * MINUTE) / 1000);
    expect(famine?.sinceMs).toBe(fedAt + HOUR);
  });
});

describe('divisão de intervalo com fome, deserção e reabertura no caminho', () => {
  const difficulties: DifficultyId[] = ['peasant', 'lord', 'ironKing'];
  const step = fc.record({
    afterMs: fc.oneof(fc.constant(0), fc.integer({ min: 1, max: 9 * HOUR })),
    kind: fc.constantFrom('maneuver', 'feed', 'farm', 'idle'),
    feedMs: fc.oneof(
      fc.integer({ min: 1, max: 8 * HOUR }),
      // Em volta do fim da janela de cada ritmo.
      fc.constantFrom(HOUR - 1, HOUR, 2 * HOUR - 1, 2 * HOUR, 6 * HOUR - 1, 6 * HOUR),
    ),
    cuts: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 3 }),
  });
  const plan = fc.record({
    seed: fc.string({ minLength: 1, maxLength: 12 }),
    timeScale: fc.constantFrom(3, 1, 0.5),
    difficulty: fc.constantFrom(...difficulties),
    villagers: fc.integer({ min: 3, max: 30 }),
    phaseMs: fc.nat(DAY - 1),
    // Com o efeito, só a fome tira gente; sem ele, a moral cai e o fluxo `morale` sorteia.
    steady: fc.boolean(),
    steps: fc.array(step, { minLength: 1, maxLength: 6 }),
    tail: fc.record({
      afterMs: fc.integer({ min: 1, max: 60 * HOUR }),
      cuts: fc.array(fc.double({ min: 0, max: 1, noNaN: true }), { maxLength: 4 }),
    }),
  });

  /** Uma ordem ou um ganho do roteiro, no instante em que o estado está. */
  function act(state: GameState, kind: string, feedMs: number) {
    const order = (count: number) => {
      const result = applyCommand(
        state,
        command('setWorkers', { building: 'farm', count }),
        state.lastProcessedAt,
      );
      return result.ok
        ? { state: result.state, events: result.events }
        : { state, events: [] as GameEvent[] };
    };
    const { settlement } = state;
    const idle =
      settlement.population.villagers -
      settlement.injured.length -
      settlement.workers.lumberMill -
      settlement.workers.quarry -
      settlement.workers.goldMine;
    switch (kind) {
      case 'feed':
        return feed(state, feedMs);
      case 'farm':
        return order(Math.max(0, idle));
      case 'idle':
        return order(0);
      default: {
        const toFarm = order(Math.max(0, idle));
        const back = applyCommand(
          toFarm.state,
          command('setWorkers', { building: 'farm', count: 0 }),
          toFarm.state.lastProcessedAt,
        );
        return back.ok ? { state: back.state, events: [...toFarm.events, ...back.events] } : toFarm;
      }
    }
  }

  it('avançar de uma vez ou aos pedaços dá o mesmo estado, os mesmos eventos e o mesmo gerador', () => {
    const seen = { deserted: 0, resumed: 0, restarted: 0, left: 0, ended: 0 };
    fc.assert(
      fc.property(plan, (scenario) => {
        const start = gameAt(SUMMER + scenario.phaseMs, (draft) => {
          draft.seed = scenario.seed;
          draft.settings.timeScale = scenario.timeScale;
          draft.settings.difficulty = scenario.difficulty;
          draft.settlement.population.villagers = scenario.villagers;
          draft.settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
          draft.settlement.resources.food = 0;
          if (scenario.steady) {
            addMoraleEffect(draft, {
              id: 'teste',
              label: 'efeito de teste',
              amount: 100,
              untilMs: draft.lastProcessedAt + YEAR,
            });
          }
        });
        const frozen = JSON.stringify(start);

        /** Roda o roteiro; com `split`, cada avanço é cortado nos pontos sorteados. */
        const run = (split: boolean) => {
          let state = start;
          const events: GameEvent[] = [];
          const advance = (toMs: number, cuts: readonly number[]) => {
            const from = state.lastProcessedAt;
            const stops = split
              ? [...new Set(cuts.map((cut) => from + Math.floor(cut * (toMs - from))))]
                  .filter((at) => at > from && at < toMs)
                  .sort((a, b) => a - b)
              : [];
            for (const at of [...stops, toMs]) {
              const result = advanceTo(state, at);
              state = result.state;
              events.push(...result.events);
            }
          };
          for (const entry of scenario.steps) {
            advance(state.lastProcessedAt + entry.afterMs, entry.cuts);
            const done = act(state, entry.kind, entry.feedMs);
            state = done.state;
            events.push(...done.events);
          }
          advance(state.lastProcessedAt + scenario.tail.afterMs, scenario.tail.cuts);
          return { state, events };
        };

        const direct = run(false);
        const stepped = run(true);
        expect(stepped.state).toStrictEqual(direct.state);
        expect(stepped.state.rng).toStrictEqual(direct.state.rng);
        expect(stepped.events).toStrictEqual(direct.events);
        expect(JSON.stringify(start)).toBe(frozen);

        const { settlement } = direct.state;
        // O piso nunca é furado, e quem deserta o faz em uma virada de dia.
        expect(settlement.population.villagers).toBeGreaterThanOrEqual(
          Math.min(scenario.villagers, balance.morale.populationFloor),
        );
        for (const event of eventsOfType(direct.events, 'villagerDeserted')) {
          expect(event.atMs % DAY).toBe(0);
        }
        if (scenario.difficulty === 'peasant') {
          expect(eventsOfType(direct.events, 'villagerDeserted')).toEqual([]);
        }
        // Fome aberta não deixa registro de fome acabada, e a conta dela nunca anda para trás.
        if (settlement.famine !== null) {
          expect(settlement.lastFamine).toBeNull();
          expect(settlement.famine.deserted).toBeGreaterThanOrEqual(0);
          expect(settlement.famine.carriedMs).toBeGreaterThanOrEqual(0);
        }
        seen.deserted += eventsOfType(direct.events, 'villagerDeserted').length;
        seen.left += eventsOfType(direct.events, 'villagerLeft').length;
        seen.ended += eventsOfType(direct.events, 'famineEnded').length;
        if (settlement.famine !== null && eventsOfType(direct.events, 'famineEnded').length > 0) {
          if (settlement.famine.carriedMs > 0) {
            seen.resumed += 1;
          } else {
            seen.restarted += 1;
          }
        }
      }),
      { numRuns: 400 },
    );
    // O gerador passa mesmo pelo que o teste diz atravessar.
    expect(seen.ended).toBeGreaterThan(200);
    expect(seen.deserted).toBeGreaterThan(100);
    expect(seen.resumed).toBeGreaterThan(40);
    expect(seen.restarted).toBeGreaterThan(20);
    expect(seen.left).toBeGreaterThan(10);
  });
});
