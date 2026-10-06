import { balance, councilCards, DIFFICULTY_IDS, namedHeroes } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { promiseHero } from './arrivals';
import { CATALOG, dueContinuations, freeSeats, gameDayAt, scriptedCard } from './council';
import { currentShape } from './migrations';
import { cloneState, createInitialState } from './state';
import {
  accept,
  addHero,
  attentiveLord,
  command,
  councilInSession,
  DAY,
  dealt,
  gameAt,
  HOUR,
  MINUTE,
  refuse,
  settings,
  YEAR,
  NO_TAVERN,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { DifficultyId, GameEvent, GameSettings, GameState } from './types';
import { deriveViewState } from './view';

/**
 * "Estrangeira ferida" de ponta a ponta (GDD §2.2, §7.1, §9.1 e Apêndice B; ADR 0017, decisões 5
 * e 6; roadmap da v0.3, V3C-T3): a primeira carta roteirizada do jogo entrega o primeiro herói,
 * sem custo, a quem responde, a quem está fora e a quem já passou do dia marcado. É o critério 1
 * do GDD §16.2 no motor.
 */

const STRANGER = 'woundedStranger';
const INTERVAL = balance.council.drawIntervalDays * DAY;
/** O começo do 13º dia de jogo: a terceira audiência de uma partida nova. */
const DAY_13 = 12 * DAY;
const DAY_REAL = 24 * HOUR;
const WAGE = balance.heroes.wagePerHour * 1000;

const of = (events: GameEvent[], ...types: string[]) =>
  events.filter((event) => types.includes(event.type));
const about = (events: GameEvent[]) =>
  events.filter((event) => event.data.cardId === STRANGER || event.type === 'heroJoined');
const told = (events: GameEvent[]) => about(events).map((event) => [event.type, event.atMs]);
const tableOf = (state: GameState) => state.council.pending.map((entry) => entry.cardId);
const strangerOnTable = (state: GameState) => {
  const pending = state.council.pending.find((entry) => entry.cardId === STRANGER);
  if (pending === undefined) {
    throw new Error('O cenário esperava a carta da estrangeira na mesa.');
  }
  return pending;
};
const answer = (state: GameState, optionId: string) =>
  command('answerCard', { instanceId: strangerOnTable(state).instanceId, optionId });

/**
 * Uma partida nova com um senhor atento, parada no instante exato da audiência do 13º dia: ele
 * respondeu às cartas dos dias 5 e 9, e a mesa está livre para a estrangeira.
 */
function atAudience(changed: Partial<GameSettings> = {}, seed = 'estrangeira') {
  const start = createInitialState(seed, { ...settings, ...changed });
  return attentiveLord(start, DAY_13);
}

describe('a carta chega pelo roteiro, na audiência do 13º dia de jogo', () => {
  it('o 13º dia de uma partida nova é dia de audiência: elas caem nos dias 5, 9 e 13', () => {
    const fresh = createInitialState('estrangeira', settings);
    expect(fresh.council.nextDrawAtMs).toBe(INTERVAL);
    expect(DAY_13 % INTERVAL).toBe(0);
    expect(gameDayAt(DAY_13)).toBe(13);
    expect(councilCards.find((card) => card.id === STRANGER)?.scripted).toEqual({ atGameDay: 13 });
  });

  it.each(DIFFICULTY_IDS)(
    '%s: chega no começo do 13º dia, uma vez, na frente do sorteio, sem gastar o gerador',
    (difficulty) => {
      const before = attentiveLord(
        createInitialState('estrangeira', { ...settings, difficulty }),
        DAY_13 - 1,
      );
      // Até a véspera, nada: nem carta, nem herói, nem identificador.
      expect(about(before.events)).toEqual([]);
      expect(before.state.ids).toEqual({});
      expect(scriptedCard(before.state, DAY_13 - 1, CATALOG)).toBeNull();
      expect(scriptedCard(before.state, DAY_13, CATALOG)?.id).toBe(STRANGER);

      const at = advanceTo(before.state, DAY_13);
      const drawn = of(at.events, 'cardDrawn');
      expect(drawn).toHaveLength(1);
      expect(drawn[0]).toMatchObject({
        atMs: DAY_13,
        text: 'No 13º dia da Primavera, o conselho de Pedra Alta pediu audiência: Estrangeira ferida.',
        data: { cardId: STRANGER, source: 'scripted' },
      });
      // Ela foi na frente: ninguém sorteou nesta audiência, e a cadência andou como sempre.
      expect(at.state.rng.council).toEqual(before.state.rng.council);
      expect(at.state.council.nextDrawAtMs).toBe(DAY_13 + INTERVAL);
      expect(at.state.stats[`cardsDrawn:${STRANGER}`]).toBe(1);
      // Ainda não há herói: a carta só pergunta.
      expect(at.state.guild).toEqual({
        heroes: [],
        arriving: [],
        wageArrears: null,
        lastWageArrears: null,
        ...NO_TAVERN,
      });
      expect(at.state.ids).toEqual({});
    },
  );

  it('chega antes dos lobos do roteiro, e o prazo de resposta é o de toda carta: 24 h reais', () => {
    for (const timeScale of [3, 1, 0.5]) {
      const { state } = atAudience({ timeScale });
      const pending = strangerOnTable(state);
      expect(pending.drawnAtMs).toBe(DAY_13);
      expect(pending.expiresAtMs).toBe(DAY_13 + DAY_REAL * timeScale);
      for (const raid of balance.raids.scripted) {
        expect(DAY_13).toBeLessThan((raid.atGameDay - 1) * DAY);
      }
    }
  });
});

describe('a visão da carta: quem cada opção traz, quando e o que passa a custar', () => {
  it.each([
    [1, '2 ouro/h', '2 h'],
    [3, '6 ouro/h', '40 min'],
    [0.5, '1 ouro/h', '4 h'],
  ])('no ritmo %s', (timeScale, wage, dayText) => {
    const { state } = atAudience({ timeScale });
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale });
    const card = view.council.pending.find((entry) => entry.title === 'Estrangeira ferida');
    expect(card?.options.map((option) => [option.id, option.label, option.effectsText])).toEqual([
      [
        'shelter',
        'Acolher a estrangeira',
        `Edda, Guerreira (Leal), entra para o feudo agora, com soldo de ${wage}`,
      ],
      [
        'tend',
        'Cuidar e deixar partir',
        `+40 ouro; +5 de moral por 1 dia de jogo (${dayText}); Rolf, Arqueiro (Prudente), chega em 1 dia de jogo (${dayText}), com soldo de ${wage}`,
      ],
    ]);
    // Nenhuma das duas custa nem está trancada.
    for (const option of card?.options ?? []) {
      expect(option).toMatchObject({ cost: [], affordable: true, locked: false });
    }
    expect(card?.expiresInSeconds).toBe(DAY_REAL / 1000);
    expect(view.pendingDecisions).toContainEqual({
      kind: 'card',
      id: card?.instanceId,
      title: 'Estrangeira ferida',
      expiresInSeconds: DAY_REAL / 1000,
    });
  });

  it.each<[DifficultyId, string, string]>([
    ['peasant', 'shelter', 'acolher a estrangeira'],
    ['lord', 'shelter', 'acolher a estrangeira'],
    ['ironKing', 'tend', 'cuidar e deixar partir'],
  ])('%s: sem resposta, o conselho aplica "%s"', (difficulty, optionId, label) => {
    const { state } = atAudience({ difficulty });
    const view = deriveViewState(state, state.lastProcessedAt);
    const card = view.council.pending.find((entry) => entry.title === 'Estrangeira ferida');
    expect(card?.defaultOptionId).toBe(optionId);
    expect(card?.expiryNote).toBe(
      `Sem resposta até o fim do prazo, o conselho decide sozinho: ${label}.`,
    );
  });
});

describe.each(DIFFICULTY_IDS)('responder à carta, em %s', (difficulty) => {
  const arrival = atAudience({ difficulty });
  // O senhor responde na visita daquele dia, sete minutos depois da audiência.
  const table = advanceTo(arrival.state, DAY_13 + 7 * MINUTE).state;

  it('"Acolher": Edda entra na hora, sem custo, e o soldo conta desde a chegada', () => {
    const { state, events } = accept(table, answer(table, 'shelter'));
    expect(events.map((event) => event.type).slice(0, 2)).toEqual(['cardAnswered', 'heroJoined']);
    expect(events[0]).toMatchObject({
      atMs: DAY_13 + 7 * MINUTE,
      text: 'No 13º dia da Primavera, o senhor de Pedra Alta deu teto à estrangeira ferida. Edda jurou a espada ao feudo que a acolheu.',
      data: { cardId: STRANGER, optionId: 'shelter', hero: 'edda', heroAfterDays: 0 },
    });
    expect(
      Object.keys(events[0]?.data ?? {}).filter((key) => /^(spent|gained|lost)/.test(key)),
    ).toEqual([]);
    expect(events[1]).toMatchObject({
      atMs: DAY_13 + 7 * MINUTE,
      text: 'No 13º dia da Primavera, Edda, guerreira, passou a servir a Pedra Alta.',
      data: { heroId: 'hero-1', namedHeroId: 'edda', classId: 'warrior' },
    });
    expect(state.guild.heroes).toEqual([
      {
        id: 'hero-1',
        name: 'Edda',
        gender: 'f',
        classId: 'warrior',
        level: 1,
        xp: 0,
        traits: ['loyal'],
        status: 'idle',
        joinedAtMs: DAY_13 + 7 * MINUTE,
        discontent: false,
      },
    ]);
    expect(state.guild.arriving).toEqual([]);
    expect(state.ids).toEqual({ hero: 1 });
    // Nada saiu do estoque na resposta.
    expect(state.settlement.resources).toEqual(table.settlement.resources);
    expect(tableOf(state)).not.toContain(STRANGER);
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();

    // A ficha concorda com ela, e o soldo aparece na linha do ouro.
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(
      view.guild.heroes.map((hero) => [hero.name, hero.classLabel, hero.traits[0]?.label]),
    ).toEqual([['Edda', 'Guerreira', 'Leal']]);
    expect(view.guild.wage.perHour).toBe(2);
    expect(view.resources.find((row) => row.id === 'gold')?.breakdown).toMatch(/soldo de 1 herói/);

    // O soldo conta desde a chegada: uma hora de jogo depois saíram 2 de ouro a mais do que
    // sairiam sem ela.
    const without = advanceTo(table, table.lastProcessedAt + HOUR).state;
    const after = advanceTo(state, state.lastProcessedAt + HOUR).state;
    expect(without.settlement.resources.gold - after.settlement.resources.gold).toBe(WAGE);
  });

  it('"Cuidar e deixar partir": ouro e moral agora, e Rolf chega um dia de jogo depois, no instante exato', () => {
    const { state, events } = accept(table, answer(table, 'tend'));
    const now = DAY_13 + 7 * MINUTE;
    expect(of(events, 'cardAnswered', 'heroJoined').map((event) => event.type)).toEqual([
      'cardAnswered',
    ]);
    expect(events[0]).toMatchObject({
      text: 'No 13º dia da Primavera, o senhor de Pedra Alta mandou tratar a estrangeira e a deixou seguir viagem. Edda pagou em moedas e prometeu mandar ao feudo o irmão, arqueiro de mão firme.',
      data: {
        optionId: 'tend',
        gained_gold: 40,
        morale: 5,
        moraleDays: 1,
        hero: 'rolf',
        heroAfterDays: 1,
      },
    });
    expect(state.settlement.resources.gold - table.settlement.resources.gold).toBe(40_000);
    expect(state.settlement.moraleEffects).toContainEqual({
      id: `card:${strangerOnTable(table).instanceId}`,
      label: 'Carta: Estrangeira ferida',
      amount: 5,
      untilMs: now + DAY,
    });
    // A promessa fica gravada, e não é segredo: a visão diz quem vem e quando.
    expect(state.guild.heroes).toEqual([]);
    expect(state.guild.arriving).toEqual([{ namedHeroId: 'rolf', atMs: now + DAY }]);
    expect(state.ids).toEqual({});
    expect(deriveViewState(state, now).guild.arriving).toEqual([
      {
        name: 'Rolf',
        classLabel: 'Arqueiro',
        traits: [{ label: 'Prudente', text: expect.stringContaining('cautela') as string }],
        arrivesInSeconds: DAY / 1000,
        blockedReason: null,
      },
    ]);
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();

    // A chegada é um instante da linha do tempo: um milissegundo antes ele não está.
    const eve = advanceTo(state, now + DAY - 1);
    expect(of(eve.events, 'heroJoined')).toEqual([]);
    expect(eve.state.guild.heroes).toEqual([]);
    expect(nextEventAt(eve.state)).toBe(now + DAY);
    expect(deriveViewState(eve.state, now + DAY - 1).guild.arriving[0]?.arrivesInSeconds).toBe(1);
    const there = advanceTo(eve.state, now + DAY);
    expect(of(there.events, 'heroJoined')).toEqual([
      {
        type: 'heroJoined',
        atMs: now + DAY,
        text: 'No 14º dia da Primavera, um arqueiro bateu ao portão de Pedra Alta: Rolf, irmão de Edda, vindo pagar a dívida dela. Passou a servir ao senhor.',
        data: { heroId: 'hero-1', namedHeroId: 'rolf', classId: 'archer' },
      },
    ]);
    expect(there.state.guild.heroes).toEqual([
      {
        id: 'hero-1',
        name: 'Rolf',
        gender: 'm',
        classId: 'archer',
        level: 1,
        xp: 0,
        traits: ['prudent'],
        status: 'idle',
        joinedAtMs: now + DAY,
        discontent: false,
      },
    ]);
    expect(there.state.guild.arriving).toEqual([]);
    expect(there.state.ids).toEqual({ hero: 1 });
    // O soldo só começa a contar na chegada, nem um instante antes.
    const hour = advanceTo(there.state, now + DAY + HOUR).state;
    const twin = cloneState(there.state);
    twin.guild.heroes = [];
    const free = advanceTo(twin, now + DAY + HOUR).state;
    expect(free.settlement.resources.gold - hour.settlement.resources.gold).toBe(WAGE);
    expect(eve.state.settlement.resources.gold).toBeGreaterThanOrEqual(
      state.settlement.resources.gold,
    );
  });

  it('responder de novo não dá outro herói: a carta já saiu da mesa', () => {
    const order = answer(table, 'shelter');
    const first = accept(table, order);
    expect(refuse(first.state, order).code).toBe('CARD_NOT_PENDING');
    expect(refuse(first.state, answer(table, 'tend')).code).toBe('CARD_NOT_PENDING');
    expect(first.state.guild.heroes).toHaveLength(1);
    // E a opção que não existe é recusada sem tirar a carta da mesa.
    expect(refuse(table, answer(table, 'recruit')).code).toBe('INVALID_OPTION');
  });
});

describe('a carta que expira também entrega um herói', () => {
  it.each<[DifficultyId, number]>([
    ['peasant', 1],
    ['lord', 1],
    ['lord', 3],
    ['lord', 0.5],
  ])(
    '%s, ritmo %s: o conselho acolhe, e Edda entra no instante do prazo',
    (difficulty, timeScale) => {
      const { state } = atAudience({ difficulty, timeScale });
      const deadline = DAY_13 + DAY_REAL * timeScale;
      const eve = advanceTo(state, deadline - 1);
      expect(about(eve.events)).toEqual([]);
      expect(tableOf(eve.state)).toContain(STRANGER);
      const end = advanceTo(eve.state, deadline);
      expect(told(end.events)).toEqual([
        ['cardExpired', deadline],
        ['heroJoined', deadline],
      ]);
      const [expired] = about(end.events) as [GameEvent];
      expect(expired.text).toMatch(
        /sem palavra do senhor, o conselho de Pedra Alta deu teto à estrangeira ferida\./,
      );
      expect(expired.data).toMatchObject({ optionId: 'shelter', difficulty, hero: 'edda' });
      expect(end.state.guild.heroes.map((hero) => [hero.name, hero.joinedAtMs])).toEqual([
        ['Edda', deadline],
      ]);
      expect(end.state.ids).toEqual({ hero: 1 });
      expect(end.state.stats.cardsExpired).toBeGreaterThanOrEqual(1);
    },
  );

  it.each([1, 3, 0.5])(
    'Rei de Ferro, ritmo %s: o conselho cuida dela e a deixa partir; Rolf chega um dia de jogo depois do prazo',
    (timeScale) => {
      const { state } = atAudience({ difficulty: 'ironKing', timeScale });
      const deadline = DAY_13 + DAY_REAL * timeScale;
      const gold = advanceTo(state, deadline - 1).state.settlement.resources.gold;
      const end = advanceTo(state, deadline);
      expect(told(end.events)).toEqual([['cardExpired', deadline]]);
      const [expired] = about(end.events) as [GameEvent];
      expect(expired.text).toMatch(
        /sem palavra do senhor, as mulheres de Pedra Alta trataram a estrangeira/,
      );
      expect(expired.data).toMatchObject({
        optionId: 'tend',
        difficulty: 'ironKing',
        gained_gold: 40,
        morale: 5,
        hero: 'rolf',
        heroAfterDays: 1,
      });
      expect(end.state.settlement.resources.gold).toBeGreaterThanOrEqual(gold + 40_000);
      expect(end.state.guild.arriving).toEqual([{ namedHeroId: 'rolf', atMs: deadline + DAY }]);
      const later = advanceTo(end.state, deadline + DAY);
      expect(told(later.events)).toEqual([['heroJoined', deadline + DAY]]);
      expect(later.state.guild.heroes.map((hero) => hero.name)).toEqual(['Rolf']);
    },
  );
});

describe('prioridade: a roteirizada espera lugar na mesa, sem se perder', () => {
  it('com a mesa cheia na audiência do 13º dia, ela espera a primeira audiência com lugar', () => {
    // Ninguém passa pelo feudo: as cartas dos dias 5 e 9 ficam na mesa até o prazo delas.
    const start = createInitialState('estrangeira', settings);
    const absent = advanceTo(start, 3 * DAY_REAL);
    expect(tableOf(advanceTo(start, DAY_13).state)).toHaveLength(balance.council.maxPending);
    const drawn = about(absent.events).filter((event) => event.type === 'cardDrawn');
    expect(drawn).toHaveLength(1);
    const arrivedAt = (drawn[0] as GameEvent).atMs;
    expect(arrivedAt).toBeGreaterThan(DAY_13);
    expect((arrivedAt - DAY_13) % INTERVAL).toBe(0);
    // Em cada audiência pulada a mesa estava cheia; na que a trouxe, havia lugar. (O sorteio vem
    // antes das expirações do mesmo instante: a carta que expira ali ainda ocupa o lugar.)
    for (let audience = DAY_13; audience <= arrivedAt; audience += INTERVAL) {
      const eve = advanceTo(start, audience - 1).state;
      const seats = freeSeats(eve, CATALOG) - dueContinuations(eve, audience, CATALOG).length;
      expect(seats > 0, `audiência das ${audience / HOUR} h`).toBe(audience === arrivedAt);
      expect(scriptedCard(eve, audience, CATALOG)?.id).toBe(STRANGER);
    }
    // No ritmo Normal isso é a audiência do 21º dia: as cartas dos dias 5 e 9 duram 12 dias de
    // jogo cada uma, e a do dia 5 ainda ocupa o lugar na audiência do 17º dia, em que expira. O
    // conselho acolhe a estrangeira no prazo, e o feudo de quem não apareceu tem a heroína 64 h
    // reais depois da fundação.
    expect(arrivedAt).toBe(20 * DAY);
    expect(told(absent.events)).toEqual([
      ['cardDrawn', 20 * DAY],
      ['cardExpired', 32 * DAY],
      ['heroJoined', 32 * DAY],
    ]);
  });

  it('ela consome a audiência em que chega: o sorteio daquela virada não acontece', () => {
    const { state } = atAudience();
    expect(
      of(advanceTo(advanceTo(state, DAY_13 - 1).state, DAY_13).events, 'cardDrawn'),
    ).toHaveLength(0);
    const before = attentiveLord(createInitialState('estrangeira', settings), DAY_13 - 1);
    const at = advanceTo(before.state, DAY_13);
    expect(of(at.events, 'cardDrawn').map((event) => event.data.cardId)).toEqual([STRANGER]);
    expect(at.state.stats.cardsDrawn).toBe((before.state.stats.cardsDrawn ?? 0) + 1);
  });

  it('uma continuação vencida reserva o lugar dela: a estrangeira fica para a audiência seguinte', () => {
    // Uma carta na mesa e uma continuação que vence na própria audiência do 13º dia: o único
    // lugar livre é dela.
    const base = gameAt(DAY_13 - HOUR, (draft) => {
      councilInSession(draft);
    });
    const seated = dealt(base, 'masonsMeal').state;
    seated.council.scheduled = [
      {
        cardId: 'commonGranaryShare',
        atMs: DAY_13,
        previousCardId: 'commonGranaryPlanks',
        previousOptionId: 'cede',
        previousInstanceId: 'commonGranaryPlanks-0',
      },
    ];
    expect(seated.council.nextDrawAtMs).toBe(DAY_13);
    const at = advanceTo(seated, DAY_13);
    expect(
      of(at.events, 'cardDrawn').map((event) => [event.data.cardId, event.data.source]),
    ).toEqual([['commonGranaryShare', 'continuation']]);
    expect(at.state.stats[`cardsDrawn:${STRANGER}`]).toBeUndefined();
    // Com um lugar aberto antes da audiência seguinte, ela chega nela.
    const freed = attentiveLord(at.state, DAY_13 + INTERVAL);
    expect(about(freed.events).map((event) => [event.type, event.atMs])).toEqual([
      ['cardDrawn', DAY_13 + INTERVAL],
    ]);
  });
});

describe('partidas que já passaram do 13º dia (ADR 0017, decisão 6: "Sim, a todos")', () => {
  it.each([
    ['no ano 1, no verão', 40 * DAY + 3 * HOUR],
    ['no ano 2', YEAR + 5 * DAY + HOUR],
    ['no ano 4', 3 * YEAR + 70 * DAY + 30 * MINUTE],
  ])('%s: recebe a carta na primeira audiência, uma vez', (_, atMs) => {
    const old = gameAt(atMs, (draft) => {
      councilInSession(draft);
    });
    const firstAudience = old.council.nextDrawAtMs;
    expect(firstAudience).toBeGreaterThan(atMs);
    const span = advanceTo(old, atMs + 2 * YEAR);
    expect(told(span.events)).toEqual([
      ['cardDrawn', firstAudience],
      ['cardExpired', firstAudience + DAY_REAL],
      ['heroJoined', firstAudience + DAY_REAL],
    ]);
    expect(span.state.stats[`cardsDrawn:${STRANGER}`]).toBe(1);
    expect(span.state.guild.heroes.map((hero) => hero.name)).toEqual(['Edda']);
  });

  it('com a cadência fora dos dias 5, 9 e 13 (partida migrada), chega na primeira audiência a partir do 13º dia', () => {
    // A cadência de uma partida migrada conta da fronteira dela: aqui, 50 minutos depois do
    // começo do 7º dia. As audiências caem na primeira virada de dia depois de cada instante da
    // cadência.
    const boundary = 6 * DAY + 50 * MINUTE;
    const migrated = gameAt(boundary, (draft) => {
      draft.migratedAtMs = boundary;
      draft.council.nextDrawAtMs = boundary + INTERVAL;
    });
    const span = attentiveLord(migrated, 40 * DAY, {}, [STRANGER]);
    const audiences = of(span.events, 'cardDrawn').map((event) => event.atMs / DAY);
    // No começo do 12º dia (uma carta do sorteio), do 16º (a estrangeira: a primeira audiência
    // a partir do 13º dia) e do 20º.
    expect(audiences.slice(0, 3)).toEqual([11, 15, 19]);
    expect(about(span.events)[0]).toMatchObject({
      type: 'cardDrawn',
      atMs: 15 * DAY,
      data: { cardId: STRANGER, source: 'scripted' },
    });
    expect(told(span.events).map(([type]) => type)).toEqual([
      'cardDrawn',
      'cardExpired',
      'heroJoined',
    ]);
  });

  it('o ano 2 não repete: quem recebeu no ano 1 nunca mais recebe', () => {
    const start = createInitialState('estrangeira', settings);
    const years = attentiveLord(start, 2 * YEAR + 30 * DAY);
    expect(told(years.events).map(([type]) => type)).toEqual([
      'cardDrawn',
      'cardAnswered',
      'heroJoined',
    ]);
    expect(told(years.events)[0]).toEqual(['cardDrawn', DAY_13]);
    expect(years.state.stats[`cardsDrawn:${STRANGER}`]).toBe(1);
    expect(years.state.clock.year).toBe(3);
    expect(scriptedCard(years.state, years.state.lastProcessedAt, CATALOG)).toBeNull();
    // A virada do ano zera a lista das cartas vistas, e a estrangeira não depende dela.
    expect(years.state.council.seenThisYear).not.toContain(STRANGER);
    expect(years.state.ids).toEqual({ hero: 1 });
  });
});

describe('o teto da lista de heróis não tira a recompensa de ninguém (ADR 0017, decisão 5)', () => {
  const crowded = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(20 * DAY + 10 * MINUTE, (draft) => {
      draft.settlement.resources.gold = 5_000_000;
      for (let index = 0; index < balance.heroes.rosterCap; index += 1) {
        addHero(draft, { name: `Guarda ${index + 1}` });
      }
      edit(draft);
    });

  it('o limite de contratação não barra a carta: com um herói no feudo, o segundo entra', () => {
    const one = gameAt(20 * DAY, (draft) => {
      draft.settlement.resources.gold = 500_000;
      addHero(draft, { name: 'Brann' });
    });
    expect(deriveViewState(one, one.lastProcessedAt).guild.heroLimit).toBe(1);
    const table = dealt(one, STRANGER).state;
    const { state } = accept(table, answer(table, 'shelter'));
    expect(state.guild.heroes.map((hero) => hero.name)).toEqual(['Brann', 'Edda']);
    expect(state.ids).toEqual({ hero: 2 });
  });

  it('com a lista no teto, o herói espera à porta e entra no instante em que um lugar abre por dispensa', () => {
    const table = dealt(crowded(), STRANGER).state;
    const now = table.lastProcessedAt;
    const answered = accept(table, answer(table, 'shelter'));
    expect(of(answered.events, 'heroJoined')).toEqual([]);
    expect(answered.state.guild.heroes).toHaveLength(balance.heroes.rosterCap);
    expect(answered.state.guild.arriving).toEqual([{ namedHeroId: 'edda', atMs: now }]);
    expect(currentShape(JSON.parse(JSON.stringify(answered.state)), '')).toBeNull();
    // Quem espera não é um instante da linha do tempo, e a tela diz por que ele não entrou.
    expect(nextEventAt(answered.state)).toBeGreaterThan(now);
    expect(deriveViewState(answered.state, now).guild.arriving).toEqual([
      {
        name: 'Edda',
        classLabel: 'Guerreira',
        traits: [{ label: 'Leal', text: expect.any(String) as string }],
        arrivesInSeconds: 0,
        blockedReason:
          'O feudo já abriga 12 heróis, e não cabe mais nenhum: Edda espera à porta até um lugar abrir.',
      },
    ]);
    // Dias depois ela continua à espera, do mesmo jeito de uma vez ou aos pedaços.
    const direct = advanceTo(answered.state, now + 3 * DAY + 11 * MINUTE);
    const split = advanceTo(
      advanceTo(answered.state, now + DAY + 1).state,
      now + 3 * DAY + 11 * MINUTE,
    );
    expect(split.state).toStrictEqual(direct.state);
    expect(of(direct.events, 'heroJoined')).toEqual([]);
    expect(direct.state.guild.arriving).toEqual([{ namedHeroId: 'edda', atMs: now }]);
    // A dispensa abre o lugar, e ela entra na mesma ordem.
    const target = direct.state.guild.heroes[3]?.id ?? '';
    const dismissed = accept(direct.state, command('dismissHero', { heroId: target }));
    expect(of(dismissed.events, 'heroDismissed', 'heroJoined').map((event) => event.type)).toEqual([
      'heroDismissed',
      'heroJoined',
    ]);
    expect(dismissed.state.guild.heroes).toHaveLength(balance.heroes.rosterCap);
    expect(dismissed.state.guild.heroes.at(-1)).toMatchObject({
      id: 'hero-13',
      name: 'Edda',
      joinedAtMs: direct.state.lastProcessedAt,
    });
    expect(dismissed.state.guild.arriving).toEqual([]);
  });

  it('o lugar que abre na virada do dia, com um herói que parte sem soldo, é dela no mesmo instante', () => {
    // Doze heróis e nenhum ouro: o atraso abre, e na virada em que o primeiro parte ela entra.
    const broke = crowded((draft) => {
      draft.settlement.resources.gold = 0;
    });
    const table = dealt(advanceTo(broke, broke.lastProcessedAt + 1).state, STRANGER).state;
    const answered = accept(table, answer(table, 'shelter')).state;
    const span = advanceTo(answered, answered.lastProcessedAt + 3 * DAY_REAL);
    const left = of(span.events, 'heroLeft');
    const joined = of(span.events, 'heroJoined');
    expect(left.length).toBeGreaterThan(0);
    expect(joined).toHaveLength(1);
    expect(joined[0]?.atMs).toBe(left[0]?.atMs);
    expect(span.events.indexOf(joined[0] as GameEvent)).toBeGreaterThan(
      span.events.indexOf(left[0] as GameEvent),
    );
    // A virada que a recebeu não cobra dela o atraso antigo: ela é Leal, e fica.
    expect(span.state.guild.heroes.some((hero) => hero.name === 'Edda')).toBe(true);
    expect(span.state.guild.arriving).toEqual([]);
  });

  it('o herói com nome que o conteúdo já não tem sai da lista sem chegar e sem linha', () => {
    const state = gameAt(20 * DAY, (draft) => {
      draft.guild.arriving = [
        { namedHeroId: 'alguemQueSaiu' as keyof typeof namedHeroes, atMs: 20 * DAY + HOUR },
      ];
    });
    expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
    expect(deriveViewState(state, state.lastProcessedAt).guild.arriving).toEqual([]);
    const later = advanceTo(state, 20 * DAY + HOUR);
    expect(later.events.filter((event) => event.type === 'heroJoined')).toEqual([]);
    expect(later.state.guild).toMatchObject({ heroes: [], arriving: [] });
    expect(later.state.ids).toEqual({});
  });
});

describe('a promessa nunca passa do teto nem se repete (revisão da Fase C, M-R3)', () => {
  it('o mesmo herói com nome não é prometido duas vezes, nem a quem já o tem no feudo', () => {
    const draft = cloneState(gameAt(HOUR));
    expect(promiseHero(draft, 'rolf', 3 * HOUR)).toBe(true);
    expect(promiseHero(draft, 'rolf', 2 * HOUR)).toBe(false);
    expect(draft.guild.arriving).toEqual([{ namedHeroId: 'rolf', atMs: 3 * HOUR }]);
    // Edda já serve ao feudo: a promessa não cria outra.
    const served = advanceTo(
      (() => {
        const start = cloneState(gameAt(HOUR));
        promiseHero(start, 'edda', HOUR);
        return start;
      })(),
      HOUR + 1,
    ).state;
    expect(served.guild.heroes.map((hero) => hero.name)).toEqual([namedHeroes.edda.name]);
    const again = cloneState(served);
    expect(promiseHero(again, 'edda', 5 * HOUR)).toBe(false);
    expect(again.guild.arriving).toEqual([]);
  });

  it('a lista dos prometidos nunca passa de arrivingCap, e o estado continua na forma', () => {
    const draft = cloneState(gameAt(HOUR));
    for (let round = 0; round < balance.heroes.arrivingCap + 3; round += 1) {
      promiseHero(draft, 'edda', (round + 2) * HOUR);
      promiseHero(draft, 'rolf', (round + 2) * HOUR);
    }
    expect(draft.guild.arriving.length).toBeLessThanOrEqual(balance.heroes.arrivingCap);
    expect(currentShape(JSON.parse(JSON.stringify(draft)), '')).toBeNull();
    // Os heróis com nome cabem todos na lista: o teto nunca tira a recompensa de ninguém.
    expect(Object.keys(namedHeroes).length).toBeLessThanOrEqual(balance.heroes.arrivingCap);
  });
});

describe('a ordem do instante: o herói chega depois da virada do dia e antes da conta do ouro', () => {
  it('o herói que chega em uma virada de dia vem depois do amanhecer, e o soldo sem ouro abre o atraso no mesmo instante', () => {
    // Rei de Ferro, sem resposta: o prazo da carta cai em uma virada de dia, e Rolf chega na
    // virada seguinte. O cofre está vazio e ninguém trabalha na Mina.
    const { state } = atAudience({ difficulty: 'ironKing' });
    const deadline = DAY_13 + DAY_REAL;
    const tended = advanceTo(state, deadline + DAY - 1).state;
    const empty = cloneState(tended);
    empty.settlement.resources.gold = 0;
    empty.settlement.accumulators.gold = 0;
    empty.settlement.workers.goldMine = 0;
    const at = advanceTo(empty, deadline + DAY);
    const order = at.events.map((event) => event.type);
    expect(order.indexOf('dayStarted')).toBeGreaterThan(-1);
    expect(order.indexOf('heroJoined')).toBeGreaterThan(order.indexOf('dayStarted'));
    expect(order.indexOf('wageArrearsStarted')).toBeGreaterThan(order.indexOf('heroJoined'));
    expect(at.events.every((event) => event.atMs === deadline + DAY)).toBe(true);
    expect(at.state.guild.wageArrears).toEqual({
      sinceMs: deadline + DAY,
      carriedMs: 0,
      departed: 0,
    });
    expect(at.state.guild.heroes.map((hero) => [hero.name, hero.discontent])).toEqual([
      ['Rolf', false],
    ]);
  });

  it('o ouro da estrangeira paga o soldo do arqueiro por 20 h de jogo, e não vira dívida depois', () => {
    const { state } = atAudience({ difficulty: 'ironKing' });
    const table = advanceTo(state, DAY_13 + 7 * MINUTE).state;
    const poor = cloneState(table);
    poor.settlement.resources.gold = 0;
    poor.settlement.accumulators.gold = 0;
    poor.settlement.workers.goldMine = 0;
    const tended = accept(poor, answer(poor, 'tend')).state;
    expect(tended.settlement.resources.gold).toBe(40_000);
    const arrival = tended.lastProcessedAt + DAY;
    const view = deriveViewState(advanceTo(tended, arrival).state, arrival);
    expect(view.guild.wage).toMatchObject({ perHour: 2, coveredForSeconds: 20 * 3600 });
  });
});
