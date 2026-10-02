import { type DifficultyId, DIFFICULTY_IDS, objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { cardOf, cardReading, CATALOG, eligibleCards } from './council';
import { cloneState, createInitialState } from './state';
import {
  accept,
  AUTUMN,
  command,
  DAY,
  dealt,
  eventsOfType,
  HOUR,
  MINUTE,
  quietCouncil,
  settings,
  SUMMER,
  YEAR,
} from './test-helpers';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

/**
 * As cadeias do jogo, de ponta a ponta (roadmap da v0.2, V2D-T2.4 e critério 3 da §16.2): "O
 * Celeiro Comum" e "A Ponte do Degelo", com as cartas de `@lotg/content`, em todas as
 * ramificações: aceitar, recusar e deixar expirar, nas três dificuldades e em um ritmo que não
 * é o 1. A continuação chega no prazo com a mesa cheia na frente e com um sorteio no mesmo
 * instante, e a história atravessa a estação e o ano.
 *
 * O sorteio fica calado (`quietCouncil`): a primeira carta de cada cadeia é posta na mesa pelo
 * teste, e daí em diante só as continuações falam. O sorteio com as cartas do jogo é do cenário
 * de 7 dias (`scenario.test.ts`) e da cobertura (`council.coverage.test.ts`).
 */

/** Um feudo que se sustenta, com os depósitos largos e folga de tudo: só a cadeia mexe nele. */
function feud(difficulty: DifficultyId = 'lord', timeScale = 1, atMs = 0): GameState {
  const state = createInitialState('cadeias', { ...settings, difficulty, timeScale });
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  state.clock.year = Math.floor(atMs / YEAR) + 1;
  state.clock.yearStartMs = Math.floor(atMs / YEAR) * YEAR;
  state.settlement.workers.farm = 3;
  state.settlement.buildings.granary = 3;
  state.settlement.buildings.warehouse = 3;
  state.settlement.resources = { food: 300_000, wood: 300_000, stone: 100_000, gold: 100_000 };
  state.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  quietCouncil(state);
  return state;
}

const cardEvents = (events: GameEvent[]) => events.filter((event) => event.type.startsWith('card'));
const story = (events: GameEvent[]) =>
  cardEvents(events).map((event) => [
    event.atMs / DAY,
    event.type,
    event.data.cardId,
    event.data.optionId,
  ]);
const units = (state: GameState, resource: 'food' | 'wood' | 'stone' | 'gold') =>
  Math.floor(state.settlement.resources[resource] / 1000);

/** Responde à carta `cardId` que está na mesa, agora. */
function choose(state: GameState, cardId: string, optionId: string) {
  const pending = state.council.pending.find((entry) => entry.cardId === cardId);
  if (pending === undefined) {
    throw new Error(`A carta ${cardId} não está na mesa.`);
  }
  return accept(state, command('answerCard', { instanceId: pending.instanceId, optionId }));
}

/** O texto da carta `cardId` como o jogador a lê agora, e de onde ela diz que a história vem. */
function shown(state: GameState, cardId: string) {
  const title = cardOf(CATALOG, cardId)?.title;
  const view = deriveViewState(state, state.lastProcessedAt, {
    timeScale: state.settings.timeScale,
  });
  return view.council.pending.find((entry) => entry.title === title);
}

/** A moral em cada virada de dia de `fromDay` a `toDay`, sem ninguém mexer no feudo. */
function moraleByDay(state: GameState, fromDay: number, toDay: number): number[] {
  const values: number[] = [];
  let current = state;
  for (let day = fromDay; day <= toDay; day += 1) {
    current = advanceTo(current, day * DAY).state;
    values.push(current.settlement.morale);
  }
  return values;
}

describe('"O Celeiro Comum", de ponta a ponta', () => {
  const opened = (difficulty: DifficultyId = 'lord', timeScale = 1) =>
    dealt(feud(difficulty, timeScale), 'commonGranaryPlanks').state;

  it('ceder, partilhar e deixar com as famílias: três cartas, a história ligada e um dia com a moral em 80', () => {
    const first = choose(opened(), 'commonGranaryPlanks', 'cede');
    expect(first.events[0]?.text).toBe(
      'No 1º dia da Primavera, o senhor de Pedra Alta cedeu madeira das obras ao celeiro. Os moradores pregaram tábuas até o anoitecer.',
    );
    expect(first.events[0]?.data).toMatchObject({ spent_wood: 40, morale: 5, moraleDays: 3 });
    expect(units(first.state, 'wood')).toBe(260);

    // Dois dias de jogo depois, a continuação, com a frase que lembra a madeira cedida.
    const second = advanceTo(first.state, 2 * DAY);
    expect(eventsOfType(second.events, 'cardDrawn')).toHaveLength(1);
    expect(eventsOfType(second.events, 'cardDrawn')[0]).toMatchObject({
      atMs: 2 * DAY,
      text: 'No 3º dia da Primavera, a madeira cedida ao celeiro de Pedra Alta virou prateleira, e o conselho voltou ao assunto: A vez de repartir.',
      data: {
        cardId: 'commonGranaryShare',
        source: 'continuation',
        previousCardId: 'commonGranaryPlanks',
        previousOptionId: 'cede',
        previousInstanceId: 'commonGranaryPlanks-1',
      },
    });
    const share = shown(second.state, 'commonGranaryShare');
    expect(share?.text).toContain('a madeira que o senhor cedeu');
    expect(share?.followsFrom?.text).toBe(
      'A história continua: em "Tábuas para as reservas", a decisão foi ceder a madeira.',
    );

    const shared = choose(second.state, 'commonGranaryShare', 'share');
    expect(shared.events[0]?.data).toMatchObject({ spent_food: 30, morale: 10, moraleDays: 3 });

    const third = advanceTo(shared.state, 4 * DAY);
    expect(eventsOfType(third.events, 'cardDrawn').at(-1)).toMatchObject({
      atMs: 4 * DAY,
      text: 'No 5º dia da Primavera, quem comeu à mesa comum de Pedra Alta voltou com sacos às costas: O que ficou da escolha.',
      data: { previousCardId: 'commonGranaryShare', previousOptionId: 'share' },
    });
    expect(shown(third.state, 'commonGranaryOutcome')?.text).toContain(
      'Quem comeu à mesa do senhor não esqueceu',
    );

    const end = choose(third.state, 'commonGranaryOutcome', 'leave');
    expect(end.events[0]?.data).toMatchObject({ morale: 10, moraleDays: 3 });
    // A cadeia fechou: fica só como ela terminou, e nada mais está agendado.
    expect(end.state.council.flags).toEqual({ 'commonGranary.gifted': true });
    expect(end.state.council.scheduled).toEqual([]);
    expect(end.state.council.pending).toEqual([]);

    // A moral, virada a virada, com a base e a comida guardada em 60: a madeira cedida vale do
    // 1º ao 3º dia; a mesa comum, do 3º ao 5º; a colheita deixada, do 5º ao 7º. No 3º dia o
    // feudo fica orgulhoso (75) e, no 5º, chega a 80: é a virada em que um colono pode vir.
    expect(moraleByDay(first.state, 1, 2)).toEqual([65, 65]);
    expect(moraleByDay(shared.state, 3, 4)).toEqual([75, 70]);
    expect(moraleByDay(end.state, 5, 8)).toEqual([80, 70, 70, 60]);
    const proud = advanceTo(end.state, 5 * DAY);
    expect(proud.state.rng.morale).toBeDefined();
  });

  it('pagar o conserto, guardar para o inverno e receber a contribuição: o outro caminho inteiro', () => {
    const first = choose(opened(), 'commonGranaryPlanks', 'pay');
    expect(first.events[0]?.data).toMatchObject({ spent_gold: 30, morale: 5, moraleDays: 3 });
    expect(units(first.state, 'wood')).toBe(300);

    const second = advanceTo(first.state, 2 * DAY + 30 * MINUTE);
    expect(eventsOfType(second.events, 'cardDrawn')[0]?.text).toBe(
      'No 3º dia da Primavera, o carpinteiro pago pelo senhor entregou as prateleiras do celeiro de Pedra Alta, e o conselho voltou ao assunto: A vez de repartir.',
    );
    expect(shown(second.state, 'commonGranaryShare')?.text).toContain(
      'O carpinteiro pago pelo senhor',
    );

    const reserved = choose(second.state, 'commonGranaryShare', 'reserve');
    expect(reserved.events[0]?.data).toEqual({
      cardId: 'commonGranaryShare',
      instanceId: 'commonGranaryShare-2',
      optionId: 'reserve',
    });
    // A continuação conta dois dias a partir da resposta, não da chegada.
    const third = advanceTo(reserved.state, 4 * DAY + 30 * MINUTE);
    expect(eventsOfType(third.events, 'cardDrawn').at(-1)).toMatchObject({
      atMs: 4 * DAY + 30 * MINUTE,
      text: 'No 5º dia da Primavera, o saco guardado para o frio seguia fechado em Pedra Alta, e as famílias vieram ao conselho: O que ficou da escolha.',
    });

    const food = units(third.state, 'food');
    const end = choose(third.state, 'commonGranaryOutcome', 'accept');
    expect(end.events[0]?.data).toMatchObject({ gained_food: 40 });
    expect(units(end.state, 'food')).toBe(food + 40);
    expect(end.state.council.flags).toEqual({ 'commonGranary.stocked': true });
    expect(end.state.council.scheduled).toEqual([]);
  });

  it('conservar as reservas encerra o ramo: nenhuma continuação, nenhuma flag, nada gasto', () => {
    const before = opened();
    const kept = choose(before, 'commonGranaryPlanks', 'keep');
    expect(kept.events[0]?.data).toEqual({
      cardId: 'commonGranaryPlanks',
      instanceId: 'commonGranaryPlanks-1',
      optionId: 'keep',
    });
    expect(kept.state.settlement.resources).toEqual(before.settlement.resources);
    expect(kept.state.council.scheduled).toEqual([]);
    expect(kept.state.council.flags).toEqual({});
    expect(cardEvents(advanceTo(kept.state, 40 * DAY).events)).toEqual([]);
  });

  it.each(DIFFICULTY_IDS)(
    'em %s, ninguém responde: a primeira expira sem mexer em nada, e a cadeia não começa',
    (difficulty) => {
      const { state, events } = advanceTo(opened(difficulty), 24 * HOUR);
      expect(eventsOfType(events, 'cardExpired')[0]).toMatchObject({
        atMs: 24 * HOUR,
        text: 'No 13º dia da Primavera, o conselho de Pedra Alta esperou em vão pelo senhor e não mexeu nas reservas. O celeiro segue escorado com o que havia.',
        data: { cardId: 'commonGranaryPlanks', optionId: 'keep', difficulty },
      });
      expect(state.council.flags).toEqual({});
      expect(state.council.scheduled).toEqual([]);
      expect(state.settlement.moraleEffects).toEqual([]);
    },
  );

  it.each([
    ['peasant', 'accept', { gained_food: 40 }, 'commonGranary.stocked'],
    ['lord', 'accept', { gained_food: 40 }, 'commonGranary.stocked'],
    ['ironKing', 'leave', { morale: 10, moraleDays: 3 }, 'commonGranary.gifted'],
  ] as const)(
    'em %s, pagar e depois sumir: as continuações chegam, expiram, e o desfecho fecha a cadeia sozinho',
    (difficulty, last, outcome, ending) => {
      const first = choose(opened(difficulty), 'commonGranaryPlanks', 'pay');
      const { state, events } = advanceTo(first.state, 60 * DAY);
      // 24 h reais no ritmo 1 são 12 dias de jogo: cada carta espera isso, e a seguinte chega
      // dois dias depois de o conselho decidir.
      expect(story(events)).toEqual([
        [2, 'cardDrawn', 'commonGranaryShare', undefined],
        [14, 'cardExpired', 'commonGranaryShare', 'reserve'],
        [16, 'cardDrawn', 'commonGranaryOutcome', undefined],
        [28, 'cardExpired', 'commonGranaryOutcome', last],
      ]);
      const closing = eventsOfType(events, 'cardExpired')[1]?.data ?? {};
      if ('gained_food' in outcome) {
        // Em 28 dias sem ninguém o Celeiro pode ter enchido: o que não coube é contado.
        expect(Number(closing.gained_food ?? 0) + Number(closing.lost_food ?? 0)).toBe(
          outcome.gained_food,
        );
      } else {
        expect(closing).toMatchObject(outcome);
      }
      expect(eventsOfType(events, 'cardDrawn')[1]?.text).toContain(
        'o saco guardado para o frio seguia fechado',
      );
      expect(state.council.flags).toEqual({ [ending]: true });
      expect(state.council.scheduled).toEqual([]);
      expect(state.council.pending).toEqual([]);
    },
  );

  it('no ritmo Rápido o prazo de cada carta são 36 dias de jogo, e a continuação segue contando 2', () => {
    const first = choose(opened('lord', 3), 'commonGranaryPlanks', 'cede');
    const { events } = advanceTo(first.state, 80 * DAY);
    expect(story(events)).toEqual([
      [2, 'cardDrawn', 'commonGranaryShare', undefined],
      [38, 'cardExpired', 'commonGranaryShare', 'reserve'],
      [40, 'cardDrawn', 'commonGranaryOutcome', undefined],
      [76, 'cardExpired', 'commonGranaryOutcome', 'accept'],
    ]);
    // Na tela, os mesmos prazos em tempo real: a carta espera 24 h e o efeito dura 2 h.
    const waiting = advanceTo(first.state, 2 * DAY).state;
    const share = shown(waiting, 'commonGranaryShare');
    expect(share?.expiresInSeconds).toBe(24 * 3600);
    expect(share?.options[0]?.effectsText).toBe(
      '−30 comida; +10 de moral por 3 dias de jogo (2 h)',
    );
  });

  it('a contribuição que não cabe no Celeiro é cortada, contada, e avisada antes da escolha', () => {
    const first = choose(opened(), 'commonGranaryPlanks', 'pay');
    let state = choose(
      advanceTo(first.state, 2 * DAY).state,
      'commonGranaryShare',
      'reserve',
    ).state;
    state = advanceTo(state, 4 * DAY).state;
    // O Celeiro no nível 3 guarda 2.100: com 2.080, só cabem 20 dos 40.
    state.settlement.resources.food = 2_080_000;
    expect(shown(state, 'commonGranaryOutcome')?.options[0]?.effectsText).toBe(
      '+40 comida (só cabem 20 no Celeiro: o resto se perde)',
    );
    const end = choose(state, 'commonGranaryOutcome', 'accept');
    expect(end.events[0]?.data).toMatchObject({ gained_food: 20, lost_food: 20 });
    expect(units(end.state, 'food')).toBe(2100);
  });
});

describe('a continuação chega no prazo (ADR 0014, decisão 18)', () => {
  /** A cadeia aberta com a madeira cedida no instante `atMs`: a continuação é para dois dias depois. */
  const chained = (atMs = 0) => {
    const start = dealt(feud('lord', 1, atMs), 'commonGranaryPlanks').state;
    return choose(start, 'commonGranaryPlanks', 'cede').state;
  };
  /** Duas cartas avulsas postas na mesa agora: o lugar da continuação fica ocupado. */
  const crowded = (state: GameState) =>
    dealt(dealt(state, 'collapsedWell').state, 'masonsMeal').state;

  it('com 2 pendentes na frente, espera o primeiro lugar: chega no instante em que o senhor responde uma', () => {
    const full = crowded(advanceTo(chained(), DAY).state);
    const waiting = advanceTo(full, 2 * DAY + 20 * MINUTE);
    // O prazo dela passou e a mesa está cheia: ela continua agendada, e nada se perdeu.
    expect(cardEvents(waiting.events)).toEqual([]);
    expect(waiting.state.council.scheduled.map((entry) => entry.cardId)).toEqual([
      'commonGranaryShare',
    ]);

    const answered = choose(waiting.state, 'collapsedWell', 'dig');
    expect(answered.events.map((event) => [event.type, event.data.cardId])).toEqual([
      ['cardAnswered', 'collapsedWell'],
      ['cardDrawn', 'commonGranaryShare'],
    ]);
    expect(answered.events[1]).toMatchObject({
      atMs: 2 * DAY + 20 * MINUTE,
      data: { source: 'continuation', previousCardId: 'commonGranaryPlanks' },
    });
    expect(answered.state.council.pending.map((entry) => entry.cardId)).toEqual([
      'masonsMeal',
      'commonGranaryShare',
    ]);
    expect(answered.state.council.scheduled).toEqual([]);
    // A carta que esperou tem o prazo inteiro, contado de quando chegou.
    expect(shown(answered.state, 'commonGranaryShare')?.expiresInSeconds).toBe(24 * 3600);
  });

  it('com 2 pendentes na frente e ninguém em casa, chega logo depois da expiração que abre o lugar', () => {
    const full = crowded(advanceTo(chained(), DAY).state);
    const { state, events } = advanceTo(full, 14 * DAY);
    // As duas avulsas chegaram no fim do 1º dia e expiram 12 dias de jogo depois.
    expect(story(events)).toEqual([
      [13, 'cardExpired', 'collapsedWell', 'dig'],
      [13, 'cardExpired', 'masonsMeal', 'bread'],
      [13, 'cardDrawn', 'commonGranaryShare', undefined],
    ]);
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['commonGranaryShare']);
    expect(state.council.pending[0]?.expiresAtMs).toBe(13 * DAY + 24 * HOUR);
  });

  it('avançar de uma vez ou aos pedaços, com a mesa cheia no caminho, dá o mesmo estado e os mesmos eventos', () => {
    const full = crowded(advanceTo(chained(), DAY).state);
    const direct = advanceTo(full, 30 * DAY);
    for (const cut of [2 * DAY, 2 * DAY + 1, 13 * DAY - 1, 13 * DAY, 13 * DAY + 1, 15 * DAY]) {
      const first = advanceTo(full, cut);
      const second = advanceTo(first.state, 30 * DAY);
      expect(second.state, `corte em ${cut}`).toEqual(direct.state);
      expect([...first.events, ...second.events], `corte em ${cut}`).toEqual(direct.events);
    }
  });

  it('com um lugar só e um sorteio na mesma virada, o lugar é da continuação e o sorteio é pulado', () => {
    // A madeira cedida no começo do 3º dia: a continuação cai na virada do 5º, a da audiência.
    let state = chained(2 * DAY);
    state = dealt(state, 'collapsedWell').state;
    state.council.nextDrawAtMs = 4 * DAY;
    const generator = cloneState(state).rng;

    const { state: after, events } = advanceTo(state, 4 * DAY);
    expect(eventsOfType(events, 'cardDrawn').map((event) => event.data)).toMatchObject([
      { cardId: 'commonGranaryShare', source: 'continuation' },
    ]);
    expect(after.council.pending.map((entry) => entry.cardId)).toEqual([
      'collapsedWell',
      'commonGranaryShare',
    ]);
    // A cadência andou e o gerador não foi gasto: o sorteio daquele instante não aconteceu.
    expect(after.council.nextDrawAtMs).toBe(8 * DAY);
    expect(after.rng).toEqual(generator);
  });

  it('com dois lugares, a continuação e o sorteio chegam na mesma virada', () => {
    const state = chained(2 * DAY);
    state.council.nextDrawAtMs = 4 * DAY;
    const { state: after, events } = advanceTo(state, 4 * DAY);
    const arrived = eventsOfType(events, 'cardDrawn').map((event) => event.data.source);
    expect(arrived.sort()).toEqual(['continuation', 'draw']);
    expect(after.council.pending).toHaveLength(2);
    expect(after.rng.council).toBeDefined();
  });
});

describe('a história atravessa a estação e o ano (ADR 0014, decisão 20)', () => {
  it('uma cadeia aberta no último dia do ano continua no ano seguinte, com as flags e o texto', () => {
    const eve = YEAR - DAY;
    const first = choose(
      dealt(feud('lord', 1, eve), 'commonGranaryPlanks').state,
      'commonGranaryPlanks',
      'cede',
    );
    expect(first.state.council.seenThisYear).toEqual(['commonGranaryPlanks']);

    const { state, events } = advanceTo(first.state, YEAR + DAY);
    expect(eventsOfType(events, 'yearStarted')).toHaveLength(1);
    expect(eventsOfType(events, 'cardDrawn')[0]).toMatchObject({
      atMs: YEAR + DAY,
      text: 'No 2º dia da Primavera, a madeira cedida ao celeiro de Pedra Alta virou prateleira, e o conselho voltou ao assunto: A vez de repartir.',
    });
    // A lista do ano zerou na virada e já tem a continuação; as flags e o efeito seguem.
    expect(state.council.seenThisYear).toEqual(['commonGranaryShare']);
    expect(state.council.flags).toEqual({
      'commonGranary.open': true,
      'commonGranary.supported': true,
    });
    expect(state.settlement.moraleEffects).toHaveLength(1);
    // Com a cadeia em curso, as tábuas não voltam, nem com a lista do ano zerada.
    expect(eligibleCards(state, YEAR + 4 * DAY, CATALOG).map((entry) => entry.id)).not.toContain(
      'commonGranaryPlanks',
    );
  });

  it('o efeito de moral de uma carta atravessa a virada da estação e termina no dia marcado', () => {
    const first = choose(
      dealt(feud('lord', 1, SUMMER - DAY), 'commonGranaryPlanks').state,
      'commonGranaryPlanks',
      'cede',
    );
    const days = SUMMER / DAY;
    expect(moraleByDay(first.state, days, days + 3)).toEqual([65, 65, 65, 60]);
  });

  it('no ano seguinte as tábuas voltam e lembram como a cadeia terminou', () => {
    for (const [last, remembered, arrival] of [
      ['leave', 'não esqueceram a colheita deixada com eles', 'veio de martelo na mão'],
      ['accept', 'sob o peso do que as famílias lhe entregaram', 'cederam sob a contribuição'],
    ] as const) {
      let state = choose(
        dealt(feud(), 'commonGranaryPlanks').state,
        'commonGranaryPlanks',
        'pay',
      ).state;
      state = choose(advanceTo(state, 2 * DAY).state, 'commonGranaryShare', 'reserve').state;
      state = choose(advanceTo(state, 4 * DAY).state, 'commonGranaryOutcome', last).state;
      // Neste ano elas não voltam: já saíram. No seguinte, sim, e com outro texto.
      expect(eligibleCards(state, 8 * DAY, CATALOG).map((entry) => entry.id)).not.toContain(
        'commonGranaryPlanks',
      );
      state = advanceTo(state, YEAR + DAY).state;
      expect(eligibleCards(state, YEAR + 4 * DAY, CATALOG).map((entry) => entry.id)).toContain(
        'commonGranaryPlanks',
      );
      const again = dealt(state, 'commonGranaryPlanks');
      expect(shown(again.state, 'commonGranaryPlanks')?.text).toContain(remembered);
      const planks = cardOf(CATALOG, 'commonGranaryPlanks');
      expect(planks === null ? '' : cardReading(state, planks).arrival).toContain(arrival);
    }
  });
});

describe('"A Ponte do Degelo", de ponta a ponta', () => {
  const opened = (difficulty: DifficultyId = 'lord', timeScale = 1, atMs = 0) =>
    dealt(feud(difficulty, timeScale, atMs), 'thawBridgePlea').state;
  const pleaIsEligible = (state: GameState, atMs: number) =>
    eligibleCards(state, atMs, CATALOG).some((entry) => entry.id === 'thawBridgePlea');

  it('ceder as vigas, assentar os pilares e abrir com festa: a ponte de pedra, o grão do campo de lá e o fim da cadeia', () => {
    const first = choose(opened(), 'thawBridgePlea', 'timber');
    expect(first.events[0]).toMatchObject({
      text: 'No 1º dia da Primavera, o senhor de Pedra Alta cedeu vigas das obras para a ponte do riacho. Os lavradores as levaram no ombro até a margem.',
      data: { spent_wood: 40, morale: 5, moraleDays: 3 },
    });

    const second = advanceTo(first.state, 2 * DAY);
    expect(eventsOfType(second.events, 'cardDrawn')[0]).toMatchObject({
      atMs: 2 * DAY,
      text: 'No 3º dia da Primavera, as vigas cedidas pelo senhor de Pedra Alta pararam no meio do riacho, e o conselho voltou ao assunto: A laje no leito do riacho.',
      data: {
        source: 'continuation',
        previousCardId: 'thawBridgePlea',
        previousOptionId: 'timber',
      },
    });
    const slab = shown(second.state, 'thawBridgeSlab');
    expect(slab?.text).toContain('As vigas que o senhor cedeu');
    expect(slab?.followsFrom?.text).toBe(
      'A história continua: em "A ponte que o degelo levou", a decisão foi ceder as vigas.',
    );
    // O que os pilares rendem não aparece: só o custo e a pista.
    expect(slab?.options[0]).toMatchObject({
      label: 'Assentar pilares de pedra',
      effectsText: '−30 pedra',
      hint: 'Ponte de pedra aguenta carroça carregada, e mais de um degelo.',
    });

    const piers = choose(second.state, 'thawBridgeSlab', 'piers');
    expect(piers.events[0]?.data).toEqual({
      cardId: 'thawBridgeSlab',
      instanceId: 'thawBridgeSlab-2',
      optionId: 'piers',
      spent_stone: 30,
    });

    const third = advanceTo(piers.state, 4 * DAY);
    expect(eventsOfType(third.events, 'cardDrawn').at(-1)?.text).toBe(
      'No 5º dia da Primavera, a ponte de Pedra Alta ficou pronta sobre os pilares de pedra que o senhor mandou assentar: A passagem volta a servir.',
    );
    expect(shown(third.state, 'thawBridgeCrossing')?.text).toContain(
      'Os pilares de pedra que o senhor mandou assentar',
    );
    const feast = choose(third.state, 'thawBridgeCrossing', 'feast');
    expect(feast.events[0]?.data).toMatchObject({ spent_food: 40, morale: 15, moraleDays: 3 });
    // A obra fechou; fica gravado que a ponte é de pedra.
    expect(feast.state.council.flags).toEqual({ 'thawBridge.piers': true });
    expect(feast.state.council.scheduled).toEqual([]);

    // Na 4ª virada depois dos pilares, o que a opção escondia: a carroça carregada.
    const food = units(advanceTo(feast.state, 6 * DAY - 1).state, 'food');
    const later = advanceTo(feast.state, 6 * DAY);
    expect(eventsOfType(later.events, 'cardEffectApplied')).toMatchObject([
      {
        atMs: 6 * DAY,
        text: 'No 7º dia da Primavera, a primeira carroça carregada cruzou a ponte de pedra de Pedra Alta. O grão do campo de lá chegou inteiro.',
        data: { cardId: 'thawBridgeSlab', optionId: 'piers', gained_food: 90 },
      },
    ]);
    expect(units(later.state, 'food')).toBe(food + 90);
    // A festa: +15 por três viradas, do 5º ao 7º dia.
    expect(moraleByDay(feast.state, 5, 8)).toEqual([75, 75, 75, 60]);

    // A ponte de pedra não cai: a primeira carta não volta, neste ano nem em outro.
    expect(pleaIsEligible(later.state, 8 * DAY)).toBe(false);
    const nextYear = advanceTo(later.state, YEAR + DAY).state;
    expect(nextYear.council.flags).toEqual({ 'thawBridge.piers': true });
    expect(pleaIsEligible(nextYear, YEAR + 4 * DAY)).toBe(false);
  });

  it('pagar carpinteiros, estender a pinguela e abrir sem cerimônia: barato, e o degelo seguinte a leva', () => {
    const first = choose(opened(), 'thawBridgePlea', 'hire');
    expect(first.events[0]?.data).toMatchObject({ spent_gold: 40, morale: 5, moraleDays: 3 });

    const second = advanceTo(first.state, 2 * DAY);
    expect(shown(second.state, 'thawBridgeSlab')?.text).toContain(
      'Os carpinteiros pagos pelo senhor',
    );
    const plank = choose(second.state, 'thawBridgeSlab', 'plank');
    expect(plank.events[0]?.data).toEqual({
      cardId: 'thawBridgeSlab',
      instanceId: 'thawBridgeSlab-2',
      optionId: 'plank',
    });

    const third = advanceTo(plank.state, 4 * DAY);
    expect(eventsOfType(third.events, 'cardDrawn').at(-1)?.text).toBe(
      'No 5º dia da Primavera, a pinguela de Pedra Alta ficou pronta, estreita como foi pedida: A passagem volta a servir.',
    );
    expect(shown(third.state, 'thawBridgeCrossing')?.text).toContain('passa gente em fila');
    const quiet = choose(third.state, 'thawBridgeCrossing', 'quiet');
    expect(quiet.events[0]?.data).toMatchObject({ morale: 5, moraleDays: 2 });
    expect(quiet.state.council.flags).toEqual({ 'thawBridge.plank': true });
    // Nada escondido neste caminho: o resto do ano passa sem notícia da ponte.
    expect(cardEvents(advanceTo(quiet.state, 40 * DAY).events)).toEqual([]);

    // No ano seguinte o riacho leva a pinguela, e a primeira carta volta lembrando disso.
    const nextYear = advanceTo(quiet.state, YEAR + DAY).state;
    expect(pleaIsEligible(nextYear, YEAR + 4 * DAY)).toBe(true);
    const again = dealt(nextYear, 'thawBridgePlea');
    expect(shown(again.state, 'thawBridgePlea')?.text).toContain(
      'A pinguela não resistiu às águas do degelo',
    );
    // Desta vez, pedra: a flag da pinguela sai e a da ponte entra.
    let state = choose(again.state, 'thawBridgePlea', 'timber').state;
    state = choose(advanceTo(state, YEAR + 3 * DAY).state, 'thawBridgeSlab', 'piers').state;
    state = choose(advanceTo(state, YEAR + 5 * DAY).state, 'thawBridgeCrossing', 'quiet').state;
    expect(state.council.flags).toEqual({ 'thawBridge.piers': true });
  });

  it('largar a obra no meio devolve madeira, custa ânimo e fecha a cadeia', () => {
    const first = choose(opened(), 'thawBridgePlea', 'timber');
    const second = advanceTo(first.state, 2 * DAY).state;
    const wood = units(second, 'wood');
    const dropped = choose(second, 'thawBridgeSlab', 'abandon');
    expect(dropped.events[0]?.data).toMatchObject({ gained_wood: 30, morale: -5, moraleDays: 2 });
    expect(units(dropped.state, 'wood')).toBe(wood + 30);
    expect(dropped.state.council.flags).toEqual({});
    expect(dropped.state.council.scheduled).toEqual([]);
    expect(cardEvents(advanceTo(dropped.state, 40 * DAY).events)).toEqual([]);
  });

  it('adiar a obra não custa nada, agora nem depois, e a cadeia não começa', () => {
    const before = opened();
    const postponed = choose(before, 'thawBridgePlea', 'postpone');
    expect(postponed.events[0]?.data).toEqual({
      cardId: 'thawBridgePlea',
      instanceId: 'thawBridgePlea-1',
      optionId: 'postpone',
    });
    expect(postponed.state.settlement.resources).toEqual(before.settlement.resources);
    expect(postponed.state.council).toMatchObject({ flags: {}, scheduled: [], delayed: [] });
    const { state, events } = advanceTo(postponed.state, 40 * DAY);
    expect(cardEvents(events)).toEqual([]);
    expect(state.settlement.moraleEffects).toEqual([]);
  });

  it.each(DIFFICULTY_IDS)(
    'em %s, ninguém responde à primeira carta: a ponte fica para depois, sem custo',
    (difficulty) => {
      const { state, events } = advanceTo(opened(difficulty), 24 * HOUR);
      expect(eventsOfType(events, 'cardExpired')[0]).toMatchObject({
        text: 'No 13º dia da Primavera, o conselho de Pedra Alta esperou em vão pelo senhor, e a ponte ficou para depois. Os lavradores seguiram pelo vau.',
        data: { cardId: 'thawBridgePlea', optionId: 'postpone', difficulty },
      });
      expect(state.council).toMatchObject({ flags: {}, scheduled: [], delayed: [] });
      expect(state.settlement.moraleEffects).toEqual([]);
    },
  );

  it.each(['peasant', 'lord'] as const)(
    'em %s, ceder as vigas e sumir: o conselho estende a pinguela e abre a passagem sozinho',
    (difficulty) => {
      const first = choose(opened(difficulty), 'thawBridgePlea', 'timber');
      const { state, events } = advanceTo(first.state, 60 * DAY);
      expect(story(events)).toEqual([
        [2, 'cardDrawn', 'thawBridgeSlab', undefined],
        [14, 'cardExpired', 'thawBridgeSlab', 'plank'],
        [16, 'cardDrawn', 'thawBridgeCrossing', undefined],
        [28, 'cardExpired', 'thawBridgeCrossing', 'quiet'],
      ]);
      expect(eventsOfType(events, 'cardExpired').map((event) => event.text)).toEqual([
        'No 15º dia da Primavera, sem palavra do senhor, o mestre de obras de Pedra Alta contornou a laje com uma pinguela. Mais barata que a ponte, e mais estreita.',
        'No 5º dia do Verão, sem palavra do senhor, o conselho de Pedra Alta abriu a passagem do riacho, sem festa nem discurso.',
      ]);
      // Quem sumiu não perdeu nada: a passagem abriu, e a moral só subiu.
      expect(eventsOfType(events, 'cardExpired')[1]?.data).toMatchObject({
        morale: 5,
        moraleDays: 2,
      });
      expect(state.council.flags).toEqual({ 'thawBridge.plank': true });
      expect(state.council.scheduled).toEqual([]);
    },
  );

  it('em Rei de Ferro, ceder as vigas e sumir: o conselho larga a obra, e a cadeia acaba ali', () => {
    const first = choose(opened('ironKing'), 'thawBridgePlea', 'timber');
    const { state, events } = advanceTo(first.state, 60 * DAY);
    expect(story(events)).toEqual([
      [2, 'cardDrawn', 'thawBridgeSlab', undefined],
      [14, 'cardExpired', 'thawBridgeSlab', 'abandon'],
    ]);
    expect(eventsOfType(events, 'cardExpired')[0]).toMatchObject({
      text: 'No 15º dia da Primavera, sem palavra do senhor, o conselho de Pedra Alta largou a obra da ponte. Recolheu-se a madeira; os lavradores voltaram ao vau.',
      data: { gained_wood: 30, morale: -5, moraleDays: 2 },
    });
    expect(state.council.flags).toEqual({});
    expect(state.council.scheduled).toEqual([]);
  });

  it('a cadeia aberta no fim do verão termina no outono: as continuações não pedem estação', () => {
    const first = choose(opened('lord', 1, AUTUMN - DAY), 'thawBridgePlea', 'hire');
    let state = advanceTo(first.state, AUTUMN + DAY).state;
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['thawBridgeSlab']);
    state = choose(state, 'thawBridgeSlab', 'piers').state;
    const { events } = advanceTo(state, AUTUMN + 6 * DAY);
    expect(eventsOfType(events, 'cardDrawn')[0]?.text).toBe(
      'No 4º dia do Outono, a ponte de Pedra Alta ficou pronta sobre os pilares de pedra que o senhor mandou assentar: A passagem volta a servir.',
    );
    expect(eventsOfType(events, 'cardEffectApplied')[0]?.text).toContain('No 6º dia do Outono');
    // E a primeira carta, que é da primavera e do verão, já não sairia no outono.
    expect(pleaIsEligible(feud('lord', 1, AUTUMN), AUTUMN + 4 * DAY)).toBe(false);
    expect(pleaIsEligible(feud('lord', 1, SUMMER), SUMMER + 4 * DAY)).toBe(true);
  });

  it('o grão do campo de lá que não cabe no Celeiro é cortado e contado', () => {
    let state = choose(opened(), 'thawBridgePlea', 'timber').state;
    state = choose(advanceTo(state, 2 * DAY).state, 'thawBridgeSlab', 'piers').state;
    state = advanceTo(state, 6 * DAY - 1).state;
    state.settlement.resources.food = 2_050_000;
    const { state: after, events } = advanceTo(state, 6 * DAY);
    const applied = eventsOfType(events, 'cardEffectApplied')[0];
    const gained = Number(applied?.data.gained_food);
    const lost = Number(applied?.data.lost_food);
    expect(gained + lost).toBe(90);
    expect(lost).toBeGreaterThan(0);
    expect(units(after, 'food')).toBe(2100);
  });
});
