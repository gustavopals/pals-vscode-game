import { balance, type CouncilCard, councilCards, DIFFICULTY_IDS, objectives } from '@lotg/content';
import { CouncilCatalogSchema } from '@lotg/content/schemas';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  answerCard,
  type Catalog,
  DRAW_INTERVAL_MS,
  eligibleCards,
  expiryMs,
  nextCouncilEventAt,
  scriptedCard,
} from './council';
import { councilView } from './councilView';
import { cloneState, createInitialState } from './state';
import {
  accept,
  advanceWithCards,
  apply,
  command,
  DAY,
  dealt,
  eventsOfType,
  gameAt,
  gameWith,
  HOUR,
  MINUTE,
  newGame,
  quietHorde,
  refuse,
  settings,
  SUMMER,
  testCards,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { DifficultyId, GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const INTERVAL = 4 * DAY;
const card = (id: string): CouncilCard => {
  const found = testCards.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`Falta a carta de teste ${id}.`);
  }
  return found;
};
const only = (...ids: string[]): Catalog => ids.map(card);
/** Uma carta que pode sair sempre, de novo e de novo: para provar que a mesa cheia segura o sorteio. */
const vespers: CouncilCard = { ...card('alms'), id: 'vespers', title: 'Vésperas', recurring: true };
const matins: CouncilCard = { ...vespers, id: 'matins', title: 'Matinas' };

/**
 * Um feudo que se sustenta: três na Fazenda e os depósitos largos, para a fome não entrar na
 * conta, e a Horda calada, para os lobos também não.
 */
function fed(difficulty: DifficultyId = 'lord', timeScale = 1, seed = 'pedra-alta'): GameState {
  const state = createInitialState(seed, { ...settings, difficulty, timeScale });
  quietHorde(state);
  state.settlement.workers.farm = 3;
  state.settlement.buildings.granary = 3;
  state.settlement.buildings.warehouse = 3;
  // Os objetivos já cumpridos, para nenhuma recompensa cair no meio da conta.
  state.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  return state;
}

const cardEvents = (events: GameEvent[]) => events.filter((event) => event.type.startsWith('card'));
const drawn = (events: GameEvent[]) => eventsOfType(events, 'cardDrawn');

/** Responde a uma carta com o catálogo de teste, direto na regra (a ordem do jogo usa o do conteúdo). */
function answer(
  state: GameState,
  instanceId: string,
  optionId: string,
  catalog: Catalog = testCards,
): { state: GameState; events: GameEvent[]; rejection: { code: string; message: string } | null } {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const rejection = answerCard(draft, instanceId, optionId, draft.lastProcessedAt, events, catalog);
  return rejection === null
    ? { state: draft, events, rejection: null }
    : { state, events: [], rejection };
}

describe('o catálogo de teste', () => {
  it('passa pelo schema do conteúdo: os testes jogam com cartas que o jogo aceitaria', () => {
    expect(CouncilCatalogSchema.safeParse(testCards).error).toBeUndefined();
  });
});

describe('estado inicial do Conselho', () => {
  it('nasce vazio, com a primeira audiência 4 dias de jogo depois da fundação', () => {
    expect(newGame().council).toEqual({
      pending: [],
      flags: {},
      seenThisYear: [],
      nextDrawAtMs: 4 * DAY,
      scheduled: [],
      delayed: [],
      expired: [],
    });
    expect(DRAW_INTERVAL_MS).toBe(balance.council.drawIntervalDays * balance.calendar.dayMs);
  });

  it('o prazo de resposta são 24 h reais convertidas no ritmo da partida', () => {
    expect(expiryMs(fed('lord', 1))).toBe(24 * HOUR);
    expect(expiryMs(fed('lord', 3))).toBe(72 * HOUR);
    expect(expiryMs(fed('lord', 0.5))).toBe(12 * HOUR);
    // Um ritmo que não dá um número inteiro de milissegundos é arredondado: o estado só guarda inteiros.
    const odd = fed('lord', 1);
    odd.settings.timeScale = 0.7000001;
    expect(Number.isSafeInteger(expiryMs(odd))).toBe(true);
  });
});

describe('sorteio (fluxo council)', () => {
  it('a primeira carta chega no instante exato da cadência, nem um milissegundo antes', () => {
    const start = fed();
    const before = advanceWithCards(start, INTERVAL - 1);
    expect(cardEvents(before.events)).toEqual([]);
    expect(before.state.council.pending).toEqual([]);
    expect(before.state.rng.council).toBeUndefined();

    const { state, events } = advanceWithCards(start, INTERVAL);
    expect(drawn(events)).toHaveLength(1);
    const [arrival] = drawn(events);
    const [pending] = state.council.pending;
    expect(pending).toEqual({
      instanceId: `${pending?.cardId}-1`,
      cardId: pending?.cardId,
      drawnAtMs: INTERVAL,
      // 24 h reais no ritmo Normal: 12 dias de jogo.
      expiresAtMs: INTERVAL + 24 * HOUR,
      origin: null,
    });
    expect(['alms', 'toll']).toContain(pending?.cardId);
    expect(arrival).toMatchObject({
      atMs: INTERVAL,
      data: { cardId: pending?.cardId, instanceId: pending?.instanceId, source: 'draw' },
    });
    expect(arrival?.text).toBe(
      `No 5º dia da Primavera, o conselho de Pedra Alta pediu audiência: ${
        testCards.find((entry) => entry.id === pending?.cardId)?.title
      }.`,
    );
    expect(state.council.nextDrawAtMs).toBe(2 * INTERVAL);
    expect(state.council.seenThisYear).toEqual([pending?.cardId]);
    expect(state.rng.council).toHaveLength(4);
    expect(state.stats.cardsDrawn).toBe(1);
  });

  it('o sorteio vem depois da moral, na virada do dia', () => {
    const { events } = advanceWithCards(fed(), INTERVAL);
    const atTurn = events.filter((event) => event.atMs === INTERVAL).map((event) => event.type);
    expect(atTurn).toEqual(['dayStarted', 'cardDrawn']);
  });

  it('a segunda fica pendente junto com a primeira; a terceira não é sorteada, e a cadência anda', () => {
    const catalog = [...only('alms', 'toll'), vespers, matins];
    const second = advanceWithCards(fed(), 2 * INTERVAL, catalog);
    expect(second.state.council.pending).toHaveLength(2);
    expect(drawn(second.events).map((event) => event.atMs)).toEqual([INTERVAL, 2 * INTERVAL]);

    const third = advanceWithCards(second.state, 3 * INTERVAL, catalog);
    // Havia o que sortear (duas das quatro cartas ainda fora da mesa), mas a mesa estava
    // cheia: nada chega, o gerador não anda e o próximo sorteio é o do instante seguinte da
    // cadência.
    expect(eligibleCards(third.state, 3 * INTERVAL, catalog)).toHaveLength(2);
    expect(cardEvents(third.events)).toEqual([]);
    expect(third.state.council.pending).toEqual(second.state.council.pending);
    expect(third.state.rng.council).toEqual(second.state.rng.council);
    expect(third.state.council.nextDrawAtMs).toBe(4 * INTERVAL);
  });

  it('a cadência é ancorada: responder não a adianta nem a atrasa', () => {
    const catalog = [...only('alms', 'toll'), vespers];
    const waiting = advanceWithCards(fed(), 2 * INTERVAL + 37 * MINUTE + 11, catalog).state;
    const [first] = waiting.council.pending;
    const answered = answer(waiting, first?.instanceId ?? '', 'ignore', [
      ...catalog,
      { ...card('toll'), options: card('alms').options },
    ]).state;
    expect(answered.council.nextDrawAtMs).toBe(3 * INTERVAL);
    const next = advanceWithCards(answered, 3 * INTERVAL, catalog);
    expect(drawn(next.events).map((event) => event.atMs)).toEqual([3 * INTERVAL]);
    expect(next.state.council.nextDrawAtMs).toBe(4 * INTERVAL);
  });

  it('mesma semente, mesmas cartas; outra semente pode tirar outras', () => {
    const catalog = [...only('alms', 'toll'), vespers];
    const sequence = (seed: string) =>
      drawn(advanceWithCards(fed('lord', 1, seed), 20 * INTERVAL, catalog).events).map(
        (event) => `${event.atMs}:${String(event.data.cardId)}`,
      );
    expect(sequence('pedra-alta')).toEqual(sequence('pedra-alta'));
    const seeds = ['pedra-alta', 'vau-do-corvo', 'monte-claro', 'fonte-nova', 'serra-negra'];
    expect(new Set(seeds.map((seed) => sequence(seed).join(' '))).size).toBeGreaterThan(1);
  });

  it('o peso pesa: em muitas sementes a carta de peso 2 sai primeiro mais vezes que a de peso 1', () => {
    let alms = 0;
    for (let index = 0; index < 300; index += 1) {
      const { state } = advanceWithCards(fed('lord', 1, `semente-${index}`), INTERVAL);
      alms += state.council.pending[0]?.cardId === 'alms' ? 1 : 0;
    }
    // Esperado: 200 de 300. A faixa é larga o bastante para não depender da sorte.
    expect(alms).toBeGreaterThan(170);
    expect(alms).toBeLessThan(230);
  });

  it('conjunto elegível vazio por 30 dias: nada acontece, o gerador não anda e a simulação termina', () => {
    // Só uma carta, e ela é do inverno: na primavera e no começo do verão não há o que sortear.
    const frost: CouncilCard = { ...card('fair'), id: 'frost', requires: { seasons: ['winter'] } };
    const start = fed();
    const { state, events } = advanceWithCards(start, 30 * DAY, [frost]);
    expect(cardEvents(events)).toEqual([]);
    expect(state.rng.council).toBeUndefined();
    expect(state.council.pending).toEqual([]);
    // A cadência andou sozinha, de intervalo em intervalo: 30 dias são 7 audiências vazias.
    expect(state.council.nextDrawAtMs).toBe(8 * INTERVAL);
    expect(nextEventAt(state)).toBeGreaterThan(state.lastProcessedAt);
    // E dividir o intervalo não muda nada.
    const half = advanceWithCards(start, 13 * DAY + 5, [frost]);
    expect(advanceWithCards(half.state, 30 * DAY, [frost]).state).toStrictEqual(state);
    // No inverno ela sai: o conjunto só estava vazio, não quebrado.
    expect(drawn(advanceWithCards(state, YEAR, [frost]).events)).toHaveLength(1);
  });

  it('um estado com a audiência atrasada sorteia uma vez só e volta à cadência', () => {
    const late = gameAt(SUMMER + 10 * DAY + 5 * MINUTE, (draft) => {
      draft.settlement.workers.farm = 3;
      draft.council.nextDrawAtMs = 2 * INTERVAL;
    });
    const { state, events } = advanceWithCards(late, SUMMER + 11 * DAY, [vespers]);
    expect(drawn(events).map((event) => event.atMs)).toEqual([SUMMER + 11 * DAY]);
    // 35 dias de jogo: a audiência seguinte é a do 36º, na cadência de sempre.
    expect(state.council.nextDrawAtMs).toBe(9 * INTERVAL);
    expect(state.council.nextDrawAtMs).toBeGreaterThan(state.lastProcessedAt);
  });
});

describe('elegibilidade', () => {
  const ids = (state: GameState, atMs: number, catalog: Catalog = testCards) =>
    eligibleCards(state, atMs, catalog).map((entry) => entry.id);
  const ready = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(SUMMER + 8 * DAY, (draft) => {
      draft.settlement.buildings.granary = 1;
      draft.settlement.morale = 60;
      edit(draft);
    });

  it('na ordem do catálogo, só as que têm peso e os requisitos em dia', () => {
    // Verão, 33º dia de jogo, Celeiro erguido, moral 60: todas menos a que só chega como continuação.
    expect(ids(ready(), SUMMER + 8 * DAY)).toEqual(['alms', 'toll', 'fair', 'granaryFeast']);
  });

  it('a estação, o dia mínimo, o edifício, a flag proibida e a faixa de moral barram', () => {
    const at = SUMMER + 8 * DAY;
    // A feira é do verão.
    expect(ids(gameAt(10 * DAY), 10 * DAY)).toEqual(['alms', 'toll']);
    // A festa do celeiro pede o 30º dia de jogo…
    const early = gameAt(28 * DAY, (draft) => {
      draft.settlement.buildings.granary = 1;
      draft.settlement.morale = 60;
    });
    expect(ids(early, 28 * DAY)).not.toContain('granaryFeast');
    expect(ids(early, 29 * DAY)).toContain('granaryFeast');
    // …o Celeiro…
    expect(
      ids(
        ready((draft) => (draft.settlement.buildings.granary = 0)),
        at,
      ),
    ).not.toContain('granaryFeast');
    // …a ponte sem pedágio pago…
    expect(
      ids(
        ready((draft) => (draft.council.flags['toll.paid'] = true)),
        at,
      ),
    ).not.toContain('granaryFeast');
    // …e a moral de 50 a 100, as pontas inclusive.
    expect(
      ids(
        ready((draft) => (draft.settlement.morale = 49)),
        at,
      ),
    ).not.toContain('granaryFeast');
    expect(
      ids(
        ready((draft) => (draft.settlement.morale = 50)),
        at,
      ),
    ).toContain('granaryFeast');
    expect(
      ids(
        ready((draft) => (draft.settlement.morale = 100)),
        at,
      ),
    ).toContain('granaryFeast');
  });

  it('uma flag exigida só libera a carta depois de gravada', () => {
    const gated: CouncilCard = { ...card('alms'), id: 'gated', requires: { flags: ['toll.paid'] } };
    expect(ids(ready(), SUMMER + 8 * DAY, [gated])).toEqual([]);
    expect(
      ids(
        ready((draft) => (draft.council.flags['toll.paid'] = true)),
        SUMMER + 8 * DAY,
        [gated],
      ),
    ).toEqual(['gated']);
  });

  it('a carta já vista no ano não volta, salvo a recorrente; a que está na mesa ou agendada também não', () => {
    const at = SUMMER + 8 * DAY;
    const seen = ready((draft) => {
      draft.council.seenThisYear = ['alms', 'fair'];
    });
    expect(ids(seen, at)).toEqual(['toll', 'fair', 'granaryFeast']);
    const onTable = ready((draft) => {
      draft.council.pending = [
        {
          instanceId: 'fair-9',
          cardId: 'fair',
          drawnAtMs: at,
          expiresAtMs: at + DAY,
          origin: null,
        },
      ];
      draft.council.scheduled = [
        {
          cardId: 'toll',
          atMs: at + DAY,
          previousCardId: 'alms',
          previousOptionId: 'bless',
          previousInstanceId: 'alms-1',
        },
      ];
    });
    expect(ids(onTable, at)).toEqual(['alms', 'granaryFeast']);
  });

  it('a carta de peso zero nunca é sorteada', () => {
    const { events } = advanceWithCards(fed(), 60 * DAY, only('tollReturn'));
    expect(cardEvents(events)).toEqual([]);
  });
});

describe('carta roteirizada', () => {
  const scripted: CouncilCard = {
    ...card('alms'),
    id: 'stranger',
    title: 'Uma estrangeira',
    weight: 0,
    scripted: { atGameDay: 6 },
  };
  const catalog = [...only('alms', 'toll'), scripted];

  it('fura o sorteio na primeira audiência a partir do dia dela, uma vez por partida', () => {
    const first = advanceWithCards(fed(), INTERVAL, catalog);
    // 5º dia de jogo: o dia dela ainda não chegou, e o sorteio é o de sempre.
    expect(first.state.council.pending[0]?.cardId).not.toBe('stranger');
    const rngBefore = first.state.rng.council;

    const second = advanceWithCards(first.state, 2 * INTERVAL, catalog);
    expect(drawn(second.events)[0]).toMatchObject({
      atMs: 2 * INTERVAL,
      data: { cardId: 'stranger', source: 'scripted' },
    });
    // Ninguém sorteou: ela foi na frente.
    expect(second.state.rng.council).toEqual(rngBefore);

    // Não volta: nem no mesmo ano, nem depois da virada.
    const later = advanceWithCards(fed(), 3 * YEAR, catalog);
    expect(drawn(later.events).filter((event) => event.data.cardId === 'stranger')).toHaveLength(1);
    expect(scriptedCard(later.state, 3 * YEAR, catalog)).toBeNull();
  });

  it('nenhuma carta do jogo é roteirizada na v0.2', () => {
    expect(councilCards.filter((entry) => entry.scripted !== undefined)).toEqual([]);
  });
});

describe('expiração', () => {
  const EXPIRES = INTERVAL + 24 * HOUR;
  const expected: Record<DifficultyId, { option: string; text: string }> = {
    peasant: {
      option: 'bless',
      text: 'No 17º dia da Primavera, o conselho abençoou o mendigo sem esperar pelo senhor em Pedra Alta.',
    },
    lord: {
      option: 'ignore',
      text: 'No 17º dia da Primavera, o conselho de Pedra Alta esperou em vão pelo senhor e decidiu sozinho sobre "Esmola à porta": ignorar a batida.',
    },
    ironKing: {
      option: 'curse',
      text: 'No 17º dia da Primavera, o conselho enxotou o mendigo sem esperar pelo senhor em Pedra Alta.',
    },
  };

  it.each(DIFFICULTY_IDS)(
    'em %s: a carta espera 24 h reais e o conselho aplica a opção marcada para a dificuldade',
    (difficulty) => {
      const start = fed(difficulty);
      const before = advanceWithCards(start, EXPIRES - 1, only('alms'));
      expect(before.state.council.pending).toHaveLength(1);
      expect(eventsOfType(before.events, 'cardExpired')).toEqual([]);

      const { state, events } = advanceWithCards(start, EXPIRES, only('alms'));
      const [expired] = eventsOfType(events, 'cardExpired');
      expect(eventsOfType(events, 'cardExpired')).toHaveLength(1);
      expect(expired).toMatchObject({
        atMs: EXPIRES,
        text: expected[difficulty].text,
        data: {
          cardId: 'alms',
          instanceId: 'alms-1',
          optionId: expected[difficulty].option,
          difficulty,
        },
      });
      expect(state.council.pending).toEqual([]);
      expect(state.council.expired).toEqual(['alms-1']);
      expect(state.stats.cardsExpired).toBe(1);
      expect(state.stats.cardsAnswered).toBeUndefined();

      const food = (at: GameState) => at.settlement.resources.food;
      const quiet = advanceWithCards(start, EXPIRES, []).state;
      if (difficulty === 'peasant') {
        // Camponês: a melhor. O ganho entra no estoque e vai no evento.
        expect(expired?.data).toMatchObject({ gained_food: 20 });
        expect(food(state) - food(quiet)).toBe(20_000);
        expect(state.settlement.moraleEffects).toEqual([]);
      } else if (difficulty === 'lord') {
        // Senhor: a conservadora. Nada muda.
        expect(Object.keys(expired?.data ?? {})).toEqual([
          'cardId',
          'instanceId',
          'optionId',
          'difficulty',
        ]);
        expect(state.settlement).toEqual(quiet.settlement);
      } else {
        // Rei de Ferro: a pior. A moral paga por dois dias de jogo.
        expect(expired?.data).toMatchObject({ morale: -5, moraleDays: 2 });
        expect(state.settlement.moraleEffects).toEqual([
          {
            id: 'card:alms-1',
            label: 'Carta: Esmola à porta',
            amount: -5,
            untilMs: EXPIRES + 2 * DAY,
          },
        ]);
        expect(food(state)).toBe(food(quiet));
      }
    },
  );

  it('o prazo é de tempo real: no ritmo Rápido são 72 h de jogo; no Tranquilo, 12', () => {
    for (const [timeScale, gameMs] of [
      [3, 72 * HOUR],
      [0.5, 12 * HOUR],
    ] as const) {
      const start = fed('lord', timeScale);
      const { state } = advanceWithCards(start, INTERVAL, only('alms'));
      expect(state.council.pending[0]?.expiresAtMs).toBe(INTERVAL + gameMs);
      // Na visão, sempre 24 h reais.
      expect(councilView(state, timeScale, only('alms')).council.pending[0]?.expiresInSeconds).toBe(
        24 * 3600,
      );
      const before = advanceWithCards(start, INTERVAL + gameMs - 1, only('alms'));
      expect(before.state.council.pending).toHaveLength(1);
      const after = advanceWithCards(start, INTERVAL + gameMs, only('alms'));
      expect(after.state.council.pending).toEqual([]);
      expect(eventsOfType(after.events, 'cardExpired')[0]?.atMs).toBe(INTERVAL + gameMs);
    }
  });

  it('a expiração nunca cobra: a opção automática não tem custo, e o estoque zerado não a impede', () => {
    const broke = fed();
    broke.settlement.resources = { food: 400_000, wood: 0, stone: 0, gold: 0 };
    const { state, events } = advanceWithCards(broke, INTERVAL + 24 * HOUR, only('toll'));
    const [expired] = eventsOfType(events, 'cardExpired');
    expect(expired?.data).toMatchObject({ optionId: 'refuse' });
    expect(Object.keys(expired?.data ?? {}).filter((key) => key.startsWith('spent_'))).toEqual([]);
    expect(state.settlement.resources.gold).toBe(0);
  });

  it('no mesmo instante, a expiração vem antes da ordem: a resposta encontra CARD_EXPIRED', () => {
    // Com o catálogo do jogo, pela porta do jogo: `applyCommand` exige o estado já avançado.
    const { state: waiting, instanceId } = dealt(fed(), 'collapsedWell');
    const expiresAt = waiting.council.pending[0]?.expiresAtMs ?? 0;
    expect(expiresAt).toBe(24 * HOUR);

    const justBefore = advanceTo(waiting, expiresAt - 1).state;
    expect(apply(justBefore, command('answerCard', { instanceId, optionId: 'dig' })).ok).toBe(true);

    const atDeadline = advanceTo(waiting, expiresAt);
    expect(eventsOfType(atDeadline.events, 'cardExpired')).toHaveLength(1);
    expect(
      refuse(atDeadline.state, command('answerCard', { instanceId, optionId: 'dig' })),
    ).toEqual({
      code: 'CARD_EXPIRED',
      message:
        'O prazo dessa carta acabou e o conselho decidiu sozinho. A Crônica conta o que foi feito.',
    });
  });

  it('o sorteio do mesmo instante ainda vê a carta que expira: a audiência é pulada', () => {
    // No ritmo Normal a carta da 1ª audiência expira em cima da 4ª.
    const catalog = [...only('alms', 'toll'), vespers];
    const { state, events } = advanceWithCards(fed(), 4 * INTERVAL, catalog);
    const atFourth = events.filter((event) => event.atMs === 4 * INTERVAL);
    expect(atFourth.map((event) => event.type)).toEqual(['dayStarted', 'cardExpired']);
    expect(state.council.pending).toHaveLength(1);
    expect(state.council.nextDrawAtMs).toBe(5 * INTERVAL);
  });

  describe('a opção marcada para o feudo que já tem o que ela exige (`autoResolveIfUnlocked`)', () => {
    // O pedágio com a opção de regatear marcada: só regateia quem tem o Celeiro.
    const kept: Catalog = [
      { ...card('toll'), autoResolveIfUnlocked: 'haggle' },
      card('tollReturn'),
    ];
    const without = (state: GameState) => {
      state.settlement.buildings.granary = 0;
      return state;
    };

    it('passa pelo schema do conteúdo', () => {
      expect(CouncilCatalogSchema.safeParse(kept).error).toBeUndefined();
    });

    it.each(DIFFICULTY_IDS)(
      'em %s: com o requisito, o conselho aplica a opção marcada; sem ele, a da dificuldade',
      (difficulty) => {
        const ready = dealt(fed(difficulty), 'toll', kept).state;
        const met = advanceWithCards(ready, 24 * HOUR, kept);
        expect(eventsOfType(met.events, 'cardExpired')[0]).toMatchObject({
          atMs: 24 * HOUR,
          data: { cardId: 'toll', optionId: 'haggle', difficulty, gained_gold: 10 },
          text: 'No 13º dia da Primavera, o conselho de Pedra Alta esperou em vão pelo senhor e decidiu sozinho sobre "Pedágio na ponte": regatear com grão.',
        });
        // A opção marcada não agenda a volta do barqueiro: a cadeia não continua.
        expect(met.state.council.scheduled).toEqual([]);

        const lacking = dealt(without(fed(difficulty)), 'toll', kept).state;
        const unmet = advanceWithCards(lacking, 24 * HOUR, kept);
        expect(eventsOfType(unmet.events, 'cardExpired')[0]?.data).toMatchObject({
          optionId: 'refuse',
        });
        expect(unmet.state.council.scheduled.map((entry) => entry.cardId)).toEqual(['tollReturn']);
      },
    );

    it('sem a marca, o requisito cumprido não muda nada: vale a opção da dificuldade', () => {
      const { state: waiting } = dealt(fed(), 'toll', testCards);
      const { events } = advanceWithCards(waiting, 24 * HOUR, testCards);
      expect(eventsOfType(events, 'cardExpired')[0]?.data).toMatchObject({ optionId: 'refuse' });
    });

    it('vale o feudo do instante em que a carta expira: a obra que termina na hora conta; um milissegundo depois, não', () => {
      const building = (finishesAtMs: number) => {
        const state = without(fed());
        state.settlement.buildings.townHall = 2;
        state.settlement.constructionQueues[0] = {
          building: 'granary',
          targetLevel: 1,
          startedAtMs: 0,
          finishesAtMs,
        };
        return dealt(state, 'toll', kept).state;
      };
      const onTime = advanceWithCards(building(24 * HOUR), 24 * HOUR, kept);
      expect(onTime.events.map((event) => event.type)).toEqual(
        expect.arrayContaining(['buildingFounded', 'cardExpired']),
      );
      const types = onTime.events.map((event) => event.type);
      expect(types.indexOf('buildingFounded')).toBeLessThan(types.indexOf('cardExpired'));
      expect(eventsOfType(onTime.events, 'cardExpired')[0]?.data.optionId).toBe('haggle');
      const late = advanceWithCards(building(24 * HOUR + 1), 24 * HOUR, kept);
      expect(eventsOfType(late.events, 'cardExpired')[0]?.data.optionId).toBe('refuse');
    });

    it('a visão diz o que o conselho faria agora, e muda quando o requisito chega', () => {
      const lacking = dealt(without(fed()), 'toll', kept).state;
      expect(councilView(lacking, 1, kept).council.pending[0]).toMatchObject({
        defaultOptionId: 'refuse',
        defaultOptionLabel: 'Recusar o pedágio',
      });
      const ready = dealt(fed(), 'toll', kept).state;
      expect(councilView(ready, 1, kept).council.pending[0]).toMatchObject({
        defaultOptionId: 'haggle',
        defaultOptionLabel: 'Regatear com grão',
      });
    });

    it('avançar de uma vez ou aos pedaços dá o mesmo estado e os mesmos eventos', () => {
      const ready = dealt(fed(), 'toll', kept).state;
      const direct = advanceWithCards(ready, 30 * HOUR, kept);
      for (const cut of [HOUR, 24 * HOUR - 1, 24 * HOUR, 24 * HOUR + 1]) {
        const first = advanceWithCards(ready, cut, kept);
        const second = advanceWithCards(first.state, 30 * HOUR, kept);
        expect(second.state, `corte em ${cut}`).toEqual(direct.state);
        expect([...first.events, ...second.events], `corte em ${cut}`).toEqual(direct.events);
      }
    });
  });

  it('uma carta que o catálogo já não tem sai da mesa sem efeito e sem linha', () => {
    const { state: waiting } = dealt(fed(), 'alms', testCards);
    const { state, events } = advanceWithCards(waiting, 24 * HOUR, only('toll'));
    expect(state.council.pending.map((entry) => entry.cardId)).not.toContain('alms');
    expect(eventsOfType(events, 'cardExpired')).toEqual([]);
    expect(councilView(waiting, 1, only('toll')).council.pending).toEqual([]);
  });

  describe('a carta que o catálogo já não tem não ocupa lugar', () => {
    // Duas cartas na mesa, e o conteúdo muda: o catálogo novo não tem nenhuma das duas.
    const stale = () => dealt(dealt(fed(), 'alms', testCards).state, 'toll', testCards).state;
    const renewed: Catalog = [vespers, matins];

    it('a visão não conta o lugar que ninguém vê: nem bloqueio, nem a nota que manda responder', () => {
      const state = stale();
      expect(state.council.pending).toHaveLength(2);
      const { council, pendingDecisions } = councilView(state, 1, renewed);
      expect(council.pending).toEqual([]);
      expect(pendingDecisions).toEqual([]);
      expect(council).toMatchObject({
        blockedByPending: false,
        nextCardInSeconds: 8 * 3600,
        note: null,
      });
    });

    it('o sorteio seguinte traz carta, sem esperar o prazo das que sumiram', () => {
      const { state, events } = advanceWithCards(stale(), INTERVAL, renewed);
      expect(drawn(events).map((event) => event.atMs)).toEqual([INTERVAL]);
      expect(councilView(state, 1, renewed).council.pending).toHaveLength(1);
      // As que sumiram saem caladas no prazo delas, e a mesa volta a ter só o que se vê.
      const later = advanceWithCards(state, 24 * HOUR, renewed);
      expect(cardEvents(later.events).map((event) => event.type)).not.toContain('cardExpired');
      expect(later.state.council.pending.map((entry) => entry.cardId)).not.toContain('alms');
      expect(later.state.council.pending.map((entry) => entry.cardId)).not.toContain('toll');
    });

    it('a continuação com o prazo vencido entra na mesa, sem esperar as que sumiram', () => {
      const waiting = stale();
      waiting.council.scheduled.push({
        cardId: 'vespers',
        atMs: HOUR,
        previousCardId: 'alms',
        previousOptionId: 'give',
        previousInstanceId: 'alms-0',
      });
      const { state, events } = advanceWithCards(waiting, HOUR, renewed);
      expect(drawn(events).map((event) => [event.atMs, event.data.cardId])).toEqual([
        [HOUR, 'vespers'],
      ]);
      expect(state.council.scheduled).toEqual([]);
    });

    it('avançar de uma vez ou aos pedaços dá o mesmo estado e os mesmos eventos', () => {
      const start = stale();
      const direct = advanceWithCards(start, 5 * INTERVAL, renewed);
      for (const cut of [HOUR, INTERVAL - 1, INTERVAL, 24 * HOUR, 24 * HOUR + 1]) {
        const first = advanceWithCards(start, cut, renewed);
        const second = advanceWithCards(first.state, 5 * INTERVAL, renewed);
        expect(second.state, `corte em ${cut}`).toEqual(direct.state);
        expect([...first.events, ...second.events], `corte em ${cut}`).toEqual(direct.events);
      }
    });
  });
});

describe('answerCard', () => {
  it('paga o custo, aplica os efeitos conhecidos uma vez e tira a carta da mesa', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'toll', testCards);
    const gold = waiting.settlement.resources.gold;
    const { state, events, rejection } = answer(waiting, instanceId, 'pay');
    expect(rejection).toBeNull();
    expect(state.settlement.resources.gold).toBe(gold - 20_000);
    expect(state.council.pending).toEqual([]);
    expect(state.council.flags).toEqual({ 'toll.paid': true });
    expect(state.council.scheduled).toEqual([
      {
        cardId: 'tollReturn',
        atMs: 2 * DAY,
        previousCardId: 'toll',
        previousOptionId: 'pay',
        previousInstanceId: instanceId,
      },
    ]);
    expect(state.settlement.moraleEffects).toEqual([
      { id: `card:${instanceId}`, label: 'Carta: Pedágio na ponte', amount: 5, untilMs: DAY },
    ]);
    expect(state.stats.cardsAnswered).toBe(1);
    expect(events).toEqual([
      {
        type: 'cardAnswered',
        atMs: 0,
        text: 'No 1º dia da Primavera, o senhor pagou o pedágio da ponte em Pedra Alta.',
        data: {
          cardId: 'toll',
          instanceId,
          optionId: 'pay',
          spent_gold: 20,
          morale: 5,
          moraleDays: 1,
        },
      },
    ]);
  });

  it('a moral de uma carta entra como termo na conta das viradas, pelo prazo dela, e depois sai', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'toll', testCards);
    const paid = answer(waiting, instanceId, 'pay').state;
    // A moral não muda na hora: só na virada do dia.
    expect(paid.settlement.morale).toBe(50);
    const first = advanceWithCards(paid, DAY).state;
    expect(first.settlement.morale).toBe(65);
    const view = deriveViewState(paid, 30 * MINUTE);
    expect(view.morale.terms).toContainEqual({
      id: 'effect',
      label: 'Carta: Pedágio na ponte',
      amount: 5,
    });
    expect(view.morale.breakdown).toContain('+ 5 (carta: Pedágio na ponte)');
    expect(view.morale.effects).toEqual([
      { label: 'Carta: Pedágio na ponte', amount: 5, endsInSeconds: (2 * DAY) / 1000 - 1800 },
    ]);
    // "Por 1 dia": conta em uma virada só.
    const second = advanceWithCards(paid, 2 * DAY).state;
    expect(second.settlement.morale).toBe(60);
    expect(second.settlement.moraleEffects).toEqual([]);
  });

  it('recusa a carta que não está na mesa, a opção que não existe, a trancada e a que o estoque não paga', () => {
    const poor = fed();
    poor.settlement.buildings.granary = 0;
    poor.settlement.resources.gold = 5_000;
    const { state: waiting, instanceId } = dealt(poor, 'toll', testCards);
    const frozen = JSON.stringify(waiting);
    expect(answer(waiting, 'toll-99', 'pay').rejection).toEqual({
      code: 'CARD_NOT_PENDING',
      message: 'Essa carta já saiu da mesa do conselho: a decisão sobre ela já foi tomada.',
    });
    expect(answer(waiting, instanceId, 'flee').rejection).toEqual({
      code: 'INVALID_OPTION',
      message: 'A carta "Pedágio na ponte" não tem essa opção.',
    });
    expect(answer(waiting, instanceId, 'haggle').rejection).toEqual({
      code: 'OPTION_LOCKED',
      message: 'Essa opção ainda está fora do alcance do feudo: requer o Celeiro.',
    });
    expect(answer(waiting, instanceId, 'pay').rejection).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 15 ouro.',
    });
    expect(JSON.stringify(waiting)).toBe(frozen);
    // Com o Celeiro erguido a opção trancada abre.
    waiting.settlement.buildings.granary = 1;
    expect(answer(waiting, instanceId, 'haggle').rejection).toBeNull();
  });

  it('o payload torto é recusa de regra, não exceção', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'collapsedWell');
    const odd = (payload: unknown) =>
      refuse(waiting, { commandId: 'x', type: 'answerCard', payload } as never).code;
    expect(odd({})).toBe('CARD_NOT_PENDING');
    expect(odd({ instanceId: 7, optionId: 'dig' })).toBe('CARD_NOT_PENDING');
    expect(odd({ instanceId })).toBe('INVALID_OPTION');
    expect(odd({ instanceId, optionId: null })).toBe('INVALID_OPTION');
  });

  it('responder de novo a mesma carta é CARD_NOT_PENDING, e nada é pago duas vezes', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'collapsedWell');
    const order = command('answerCard', { instanceId, optionId: 'repair' });
    const first = accept(waiting, order).state;
    expect(first.settlement.resources.stone).toBe(waiting.settlement.resources.stone - 30_000);
    const again = refuse(first, command('answerCard', { instanceId, optionId: 'repair' }));
    expect(again.code).toBe('CARD_NOT_PENDING');
    expect(first.stats.cardsAnswered).toBe(1);
  });

  it('o ganho de uma carta é cortado no limite do depósito, e o corte é contado', () => {
    const start = newGame();
    start.settlement.workers.farm = 3;
    start.settlement.resources.wood = 300_000;
    const { state: waiting, instanceId } = dealt(start, 'tollReturn', testCards);
    const { state, events } = answer(waiting, instanceId, 'thank');
    // 450 de madeira em um pátio de 500 que já tem 300: entram 200, perdem-se 250.
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(events[0]?.data).toMatchObject({ gained_wood: 200, lost_wood: 250 });
    expect(state.stats.wasted_wood).toBe(250_000);
    expect(state.settlement.wasted.wood).toBe(250_000);
  });

  it('pela porta do jogo, o depósito que uma carta enche vira linha da Crônica uma vez', () => {
    const start = fed();
    start.settlement.buildings.granary = 1;
    start.settlement.resources.food = 880_000;
    start.council.flags = { 'commonGranary.open': true, 'commonGranary.shared': true };
    const { state: waiting, instanceId } = dealt(start, 'commonGranaryOutcome');
    const { state, events } = accept(
      waiting,
      command('answerCard', { instanceId, optionId: 'accept' }),
    );
    expect(events.map((event) => event.type)).toEqual(['cardAnswered', 'storageFilled']);
    expect(events[0]?.data).toMatchObject({ gained_food: 20, lost_food: 20 });
    expect(state.settlement.resources.food).toBe(900_000);
    // O desfecho apaga o que a cadeia gravou no caminho e deixa só como ela terminou.
    expect(state.council.flags).toEqual({ 'commonGranary.stocked': true });
  });
});

describe('efeito escondido', () => {
  const HIDDEN_TEXT = 'o barqueiro cortou as cordas da ponte';

  it('não sai no evento da ordem nem na visão; acontece na 2ª virada de dia e vira evento ali', () => {
    const start = advanceWithCards(fed(), 5 * HOUR + 123, []).state;
    start.settlement.resources.wood = 100_000;
    const { state: waiting, instanceId } = dealt(start, 'toll', testCards);
    const { state: answered, events } = answer(waiting, instanceId, 'refuse');
    // A ordem só diz o que o jogador já sabia.
    expect(events.map((event) => event.type)).toEqual(['cardAnswered']);
    expect(events[0]?.data).toEqual({ cardId: 'toll', instanceId, optionId: 'refuse' });
    expect(JSON.stringify(events)).not.toContain('cordas');
    // 5 h de jogo: o 3º dia. A 2ª virada depois da escolha é o começo do 5º dia.
    expect(answered.council.delayed).toEqual([
      { atMs: 4 * DAY, instanceId, cardId: 'toll', optionId: 'refuse' },
    ]);
    const shown = JSON.stringify(councilView(answered, 1, testCards));
    expect(shown).not.toContain('cordas');
    expect(shown).not.toContain('toll.');
    expect(nextCouncilEventAt(answered)).toBe(4 * DAY);

    const before = advanceWithCards(answered, 4 * DAY - 1, only('toll', 'tollReturn'));
    expect(eventsOfType(before.events, 'cardEffectApplied')).toEqual([]);
    const wood = before.state.settlement.resources.wood;

    const { state, events: later } = advanceWithCards(
      answered,
      4 * DAY,
      only('toll', 'tollReturn'),
    );
    const [applied] = eventsOfType(later, 'cardEffectApplied');
    expect(applied).toEqual({
      type: 'cardEffectApplied',
      atMs: 4 * DAY,
      text: `No 5º dia da Primavera, ${HIDDEN_TEXT} em Pedra Alta.`,
      data: {
        cardId: 'toll',
        instanceId,
        optionId: 'refuse',
        spent_wood: 30,
        morale: -10,
        moraleDays: 1,
      },
    });
    expect(state.settlement.resources.wood).toBe(wood - 30_000);
    expect(state.council.delayed).toEqual([]);
    // O efeito de moral escondido tem id próprio: soma com o conhecido da mesma carta.
    expect(state.settlement.moraleEffects.map((effect) => effect.id)).toEqual([
      `card:${instanceId}:later`,
    ]);
  });

  it('a previsão da moral não o adianta: até a virada dele, a visão não mostra o termo', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'toll', testCards);
    const answered = answer(waiting, instanceId, 'refuse').state;
    // Um minuto antes da virada em que o efeito acontece.
    const eve = advanceWithCards(answered, 2 * DAY - MINUTE, only('toll')).state;
    const view = deriveViewState(eve, eve.lastProcessedAt);
    expect(view.morale.terms.map((term) => term.label)).not.toContain('Carta: Pedágio na ponte');
    expect(JSON.stringify(view)).not.toContain('Pedágio');
  });

  it('a perda leva só o que há: o estoque nunca fica negativo', () => {
    const start = fed();
    start.settlement.resources.wood = 10_000;
    const { state: waiting, instanceId } = dealt(start, 'toll', testCards);
    const answered = answer(waiting, instanceId, 'refuse').state;
    const { state, events } = advanceWithCards(answered, 2 * DAY, only('toll'));
    expect(state.settlement.resources.wood).toBe(0);
    expect(eventsOfType(events, 'cardEffectApplied')[0]?.data).toMatchObject({ spent_wood: 10 });
  });

  it('escolhida em cima de uma virada, a contagem começa na virada seguinte', () => {
    const start = advanceWithCards(fed(), 3 * DAY, []).state;
    const { state: waiting, instanceId } = dealt(start, 'toll', testCards);
    const answered = answer(waiting, instanceId, 'refuse').state;
    expect(answered.council.delayed[0]?.atMs).toBe(5 * DAY);
  });
});

describe('continuação agendada', () => {
  const chain = only('toll', 'tollReturn');

  it('chega no prazo exato, lembra a escolha no texto e leva a escolha anterior no evento', () => {
    const start = advanceWithCards(fed(), 5 * HOUR + 123, []).state;
    const { state: waiting, instanceId } = dealt(start, 'toll', testCards);
    const paid = answer(waiting, instanceId, 'pay').state;
    const due = 5 * HOUR + 123 + 2 * DAY;
    expect(nextCouncilEventAt(paid)).toBe(due);

    expect(drawn(advanceWithCards(paid, due - 1, chain).events)).toEqual([]);
    const { state, events } = advanceWithCards(paid, due, chain);
    expect(drawn(events)).toEqual([
      {
        type: 'cardDrawn',
        atMs: due,
        text: 'No 5º dia da Primavera, o barqueiro pago voltou com um presente: O barqueiro volta em Pedra Alta.',
        data: {
          cardId: 'tollReturn',
          instanceId: 'tollReturn-2',
          source: 'continuation',
          previousCardId: 'toll',
          previousOptionId: 'pay',
          previousInstanceId: instanceId,
        },
      },
    ]);
    expect(state.council.scheduled).toEqual([]);
    expect(state.council.pending).toEqual([
      {
        instanceId: 'tollReturn-2',
        cardId: 'tollReturn',
        drawnAtMs: due,
        expiresAtMs: due + 24 * HOUR,
        // A carta guarda a escolha que a trouxe.
        origin: { cardId: 'toll', optionId: 'pay', instanceId },
      },
    ]);
    // O texto da carta é o da variante que lembra quem pagou, e a visão diz de onde ela vem.
    const [shown] = councilView(state, 1, testCards).council.pending;
    expect(shown?.text).toBe(
      'O barqueiro que o senhor pagou voltou com madeira de presente. O conselho quer saber como recebê-lo.',
    );
    expect(shown?.followsFrom).toEqual({
      title: 'Pedágio na ponte',
      optionLabel: 'Pagar o pedágio',
      text: 'A história continua: em "Pedágio na ponte", a decisão foi pagar o pedágio.',
    });
    // Se o catálogo já não tem a carta anterior, a visão só não diz de onde ela vem.
    expect(councilView(state, 1, only('tollReturn')).council.pending[0]?.followsFrom).toBeNull();
    // Sem a flag, o texto é o de sempre.
    const plain = cloneState(state);
    plain.council.flags = {};
    expect(councilView(plain, 1, testCards).council.pending[0]?.text).toBe(
      'O barqueiro voltou à ponte. O conselho quer saber como recebê-lo.',
    );
  });

  it('não consome a cadência nem o gerador', () => {
    const { state: waiting, instanceId } = dealt(fed(), 'toll', testCards);
    const paid = answer(waiting, instanceId, 'pay').state;
    const { state } = advanceWithCards(paid, 2 * DAY, only('tollReturn'));
    expect(state.council.pending).toHaveLength(1);
    expect(state.council.nextDrawAtMs).toBe(INTERVAL);
    expect(state.rng.council).toBeUndefined();
  });

  it('com a mesa cheia, espera; chega no instante em que uma resposta abre lugar', () => {
    let state = dealt(fed(), 'toll', testCards).state;
    const tollId = state.council.pending[0]?.instanceId ?? '';
    state = answer(state, tollId, 'pay').state;
    // Duas cartas ocupam a mesa antes de o prazo da continuação chegar.
    state = dealt(dealt(state, 'alms', testCards).state, 'fair', testCards).state;
    const full = advanceWithCards(state, 3 * DAY + 17);
    expect(drawn(full.events)).toEqual([]);
    expect(full.state.council.scheduled).toHaveLength(1);
    // Uma continuação vencida que espera lugar não é evento da linha do tempo.
    expect(nextCouncilEventAt(full.state)).toBe(24 * HOUR);

    const almsId = full.state.council.pending[0]?.instanceId ?? '';
    const { state: after, events } = answer(full.state, almsId, 'ignore');
    expect(events.map((event) => event.type)).toEqual(['cardAnswered', 'cardDrawn']);
    expect(events[1]).toMatchObject({
      atMs: 3 * DAY + 17,
      data: { cardId: 'tollReturn', source: 'continuation', previousOptionId: 'pay' },
    });
    expect(after.council.pending.map((entry) => entry.cardId)).toEqual(['fair', 'tollReturn']);
    expect(after.council.scheduled).toEqual([]);
    // O prazo de resposta conta de quando ela chegou, não de quando devia ter chegado.
    expect(after.council.pending[1]?.expiresAtMs).toBe(3 * DAY + 17 + 24 * HOUR);
  });

  it('com a mesa cheia, chega no instante em que uma expiração abre lugar', () => {
    let state = dealt(dealt(fed(), 'alms', testCards).state, 'fair', testCards).state;
    state = advanceWithCards(state, 9 * DAY).state;
    const waiting = dealt(state, 'toll', testCards);
    // Três na mesa só para montar o cenário: a ordem tira o pedágio e agenda a volta.
    state = answer(waiting.state, waiting.instanceId, 'pay').state;
    const { state: after, events } = advanceWithCards(state, 12 * DAY - 1);
    expect(drawn(events)).toEqual([]);
    expect(after.council.scheduled).toHaveLength(1);
    expect(after.council.scheduled[0]?.atMs).toBe(11 * DAY);
    // As duas cartas antigas expiram juntas em 24 h de jogo (o 13º dia, que é também uma
    // audiência: o sorteio é pulado, porque o lugar é da continuação); ela entra logo depois.
    const expiry = advanceWithCards(state, 24 * HOUR);
    expect(cardEvents(expiry.events.filter((event) => event.atMs === 24 * HOUR))).toMatchObject([
      { type: 'cardExpired', data: { cardId: 'alms' } },
      { type: 'cardExpired', data: { cardId: 'fair' } },
      { type: 'cardDrawn', data: { cardId: 'tollReturn', source: 'continuation' } },
    ]);
    expect(expiry.state.council.pending.map((entry) => entry.cardId)).toEqual(['tollReturn']);
  });

  it('tem prioridade sobre o sorteio do mesmo instante: com um lugar só, ele é dela', () => {
    const catalog = [...only('toll', 'tollReturn', 'alms'), vespers];
    // Uma carta na mesa e a continuação marcada para a mesma virada da audiência.
    let state = dealt(advanceWithCards(fed(), 2 * DAY, []).state, 'toll', testCards).state;
    state = answer(state, state.council.pending[0]?.instanceId ?? '', 'pay').state;
    state = dealt(state, 'alms', testCards).state;
    expect(state.council.scheduled[0]?.atMs).toBe(INTERVAL);
    const { state: after, events } = advanceWithCards(state, INTERVAL, catalog);
    expect(drawn(events).map((event) => event.data.source)).toEqual(['continuation']);
    expect(after.council.pending.map((entry) => entry.cardId)).toEqual(['alms', 'tollReturn']);
    // O sorteio foi pulado, e a cadência andou.
    expect(after.rng.council).toBeUndefined();
    expect(after.council.nextDrawAtMs).toBe(2 * INTERVAL);
  });

  it('com dois lugares, chegam as duas: a sorteada e a continuação', () => {
    const catalog = [...only('toll', 'tollReturn'), vespers];
    let state = dealt(advanceWithCards(fed(), 2 * DAY, []).state, 'toll', testCards).state;
    state = answer(state, state.council.pending[0]?.instanceId ?? '', 'pay').state;
    const { state: after, events } = advanceWithCards(state, INTERVAL, catalog);
    expect(drawn(events).map((event) => event.data.source)).toEqual(['draw', 'continuation']);
    expect(after.council.pending).toHaveLength(2);
  });

  it('a expiração também continua a cadeia: a opção automática agenda a volta e esconde o efeito', () => {
    const { state, events } = advanceWithCards(fed(), INTERVAL + 24 * HOUR + 3 * DAY, chain);
    const expiresAt = INTERVAL + 24 * HOUR;
    expect(cardEvents(events).map((event) => [event.type, event.atMs, event.data.cardId])).toEqual([
      ['cardDrawn', INTERVAL, 'toll'],
      ['cardExpired', expiresAt, 'toll'],
      ['cardEffectApplied', expiresAt + 2 * DAY, 'toll'],
      ['cardDrawn', expiresAt + 2 * DAY, 'tollReturn'],
    ]);
    expect(state.council.pending.map((entry) => entry.cardId)).toEqual(['tollReturn']);
  });
});

describe('virada de ano', () => {
  it('a lista das cartas vistas zera; flags, cartas na mesa, continuações e efeitos continuam', () => {
    const eve = gameAt(YEAR - DAY, (draft) => {
      draft.settlement.workers.farm = 3;
      draft.settlement.buildings.granary = 3;
      draft.council.nextDrawAtMs = YEAR;
      draft.council.seenThisYear = ['alms', 'toll'];
      draft.council.flags = { 'toll.paid': true };
      draft.council.expired = ['alms-1'];
      draft.council.pending = [
        {
          instanceId: 'toll-2',
          cardId: 'toll',
          drawnAtMs: YEAR - 5 * DAY,
          expiresAtMs: YEAR + 7 * DAY,
          origin: null,
        },
      ];
      draft.council.scheduled = [
        {
          cardId: 'tollReturn',
          atMs: YEAR + 3 * DAY,
          previousCardId: 'toll',
          previousOptionId: 'pay',
          previousInstanceId: 'toll-1',
        },
      ];
      draft.council.delayed = [
        { atMs: YEAR + 2 * DAY, instanceId: 'toll-1', cardId: 'toll', optionId: 'refuse' },
      ];
      draft.settlement.moraleEffects = [
        { id: 'card:toll-1', label: 'Carta: Pedágio na ponte', amount: 5, untilMs: YEAR + 2 * DAY },
      ];
      draft.stats.cardsDrawn = 2;
    });
    const before = advanceWithCards(eve, YEAR - 1, only('alms'));
    expect(before.state.council.seenThisYear).toEqual(['alms', 'toll']);

    const { state, events } = advanceWithCards(eve, YEAR, only('alms'));
    // A esmola, já vista no ano que acabou, volta a ser sorteada na audiência da virada.
    expect(drawn(events)).toMatchObject([{ atMs: YEAR, data: { cardId: 'alms', source: 'draw' } }]);
    expect(state.council.seenThisYear).toEqual(['alms']);
    expect(state.council.expired).toEqual([]);
    expect(state.council.flags).toEqual({ 'toll.paid': true });
    expect(state.council.pending.map((entry) => entry.instanceId)).toEqual(['toll-2', 'alms-3']);
    expect(state.council.scheduled).toEqual(eve.council.scheduled);
    expect(state.council.delayed).toEqual(eve.council.delayed);
    expect(state.settlement.moraleEffects).toEqual(eve.settlement.moraleEffects);
    expect(state.clock.year).toBe(2);
  });

  it('em uma partida nova a virada do ano é uma audiência: 84 dias são 21 intervalos', () => {
    const { state, events } = advanceWithCards(fed(), YEAR, [vespers]);
    expect(drawn(events).at(-1)?.atMs).toBe(YEAR);
    expect(state.council.nextDrawAtMs).toBe(YEAR + INTERVAL);
  });
});

describe('linha do tempo', () => {
  it('a expiração, o efeito escondido e a continuação por vir são instantes; a continuação à espera, não', () => {
    const state = gameWith((draft) => {
      draft.council.pending = [
        { instanceId: 'a-1', cardId: 'alms', drawnAtMs: 0, expiresAtMs: 9 * HOUR, origin: null },
      ];
      draft.council.delayed = [
        { atMs: 7 * HOUR, instanceId: 'b-2', cardId: 'toll', optionId: 'refuse' },
      ];
      draft.council.scheduled = [
        {
          cardId: 'tollReturn',
          atMs: 5 * HOUR,
          previousCardId: 'toll',
          previousOptionId: 'pay',
          previousInstanceId: 'b-2',
        },
      ];
    });
    expect(nextCouncilEventAt(state)).toBe(5 * HOUR);
    state.council.scheduled = [];
    expect(nextCouncilEventAt(state)).toBe(7 * HOUR);
    state.council.delayed = [];
    expect(nextCouncilEventAt(state)).toBe(9 * HOUR);
    state.council.pending = [];
    expect(nextCouncilEventAt(state)).toBeNull();
  });

  it('o próximo evento do motor nunca é agora, com o Conselho em qualquer situação', () => {
    let state = fed();
    for (let step = 0; step < 400; step += 1) {
      const next = nextEventAt(state);
      expect(next).not.toBeNull();
      expect(next).toBeGreaterThan(state.lastProcessedAt);
      state = advanceWithCards(state, next ?? 0).state;
    }
    expect(state.stats.cardsDrawn).toBeGreaterThan(3);
    expect(state.stats.cardsExpired).toBeGreaterThan(1);
  });
});

describe('o Conselho na visão', () => {
  it('sem carta: a próxima audiência, as regras em tempo real e nada à espera', () => {
    const view = deriveViewState(newGame(), 0);
    expect(view.council).toEqual({
      pending: [],
      nextCardInSeconds: 8 * 3600,
      blockedByPending: false,
      nextAudienceInSeconds: 8 * 3600,
      note: null,
      rulesText:
        'O conselho pede audiência a cada 8 h e traz no máximo 2 cartas por vez. Cada carta espera 24 h pela resposta; depois, o conselho decide sozinho.',
    });
    expect(view.pendingDecisions).toEqual([]);
    // No ritmo Rápido a cadência é de 2 h 40 min; o prazo de resposta continua de 24 h.
    const fast = deriveViewState(createInitialState('x', { ...settings, timeScale: 3 }), 0);
    expect(fast.council.nextCardInSeconds).toBe(9600);
    expect(fast.council.rulesText).toBe(
      'O conselho pede audiência a cada 2 h 40 min e traz no máximo 2 cartas por vez. Cada carta espera 24 h pela resposta; depois, o conselho decide sozinho.',
    );
  });

  it('uma carta do jogo: custo e consequência conhecida lado a lado, a pista e o que o conselho faz sozinho', () => {
    const start = newGame();
    start.settlement.resources.stone = 20_000;
    const { state, instanceId } = dealt(start, 'collapsedWell');
    const view = deriveViewState(state, 0);
    expect(view.council.pending).toEqual([
      {
        instanceId,
        title: 'O poço entulhado',
        text: 'A boca do poço da praça cedeu durante a noite. As mulheres já descem ao riacho com os baldes, e a fila cresce. O mestre de obras pede pedra para refazer a mureta.',
        expiresInSeconds: 24 * 3600,
        defaultOptionId: 'dig',
        defaultOptionLabel: 'Mandar o povo cavar',
        expiryNote:
          'Sem resposta até o fim do prazo, o conselho decide sozinho: mandar o povo cavar.',
        followsFrom: null,
        options: [
          {
            id: 'repair',
            label: 'Ceder a pedra',
            cost: [{ resource: 'stone', label: 'Pedra', amount: 30, missing: 10 }],
            affordable: false,
            locked: false,
            lockedReason: null,
            effectsText: '−30 pedra; +10 de moral por 3 dias de jogo (6 h)',
            hint: 'Mureta bem assentada dura mais que a queixa.',
          },
          {
            id: 'dig',
            label: 'Mandar o povo cavar',
            cost: [],
            affordable: true,
            locked: false,
            lockedReason: null,
            effectsText: 'Sem custo e sem efeito imediato.',
            hint: 'Sem pedra nova, a mureta fica como der. A água volta, e é só.',
          },
          {
            id: 'wait',
            label: 'Deixar para depois',
            cost: [],
            affordable: true,
            locked: false,
            lockedReason: null,
            effectsText: 'Sem custo e sem efeito imediato.',
            hint: 'O riacho fica longe, e o povo tem memória. Dizem que no entulho ainda há pedra boa.',
          },
        ],
      },
    ]);
    expect(view.pendingDecisions).toEqual([
      { kind: 'card', id: instanceId, title: 'O poço entulhado', expiresInSeconds: 24 * 3600 },
    ]);
    // Em Rei de Ferro o conselho, sozinho, deixa para depois.
    const iron = cloneState(state);
    iron.settings.difficulty = 'ironKing';
    expect(deriveViewState(iron, 0).council.pending[0]).toMatchObject({
      defaultOptionId: 'wait',
      defaultOptionLabel: 'Deixar para depois',
    });
  });

  it('os prazos e as durações saem em tempo real, no ritmo da partida', () => {
    const fast = createInitialState('x', { ...settings, timeScale: 3 });
    const { state } = dealt(fast, 'collapsedWell');
    const [shown] = deriveViewState(state, 36 * HOUR).council.pending;
    // 36 h de jogo no ritmo 3 são 12 h reais: metade do prazo.
    expect(shown?.expiresInSeconds).toBe(12 * 3600);
    expect(shown?.options[0]?.effectsText).toBe('−30 pedra; +10 de moral por 3 dias de jogo (2 h)');
  });

  it('a opção trancada diz o que falta; o ganho que não cabe avisa antes da escolha', () => {
    const start = newGame();
    start.settlement.resources.food = 60_000;
    const meal = deriveViewState(dealt(start, 'masonsMeal').state, 0).council.pending[0];
    expect(meal?.options[0]).toMatchObject({
      id: 'feast',
      affordable: true,
      locked: true,
      lockedReason: 'Requer 100 de comida em estoque.',
    });
    expect(meal?.options[2]?.effectsText).toBe('+15 pedra; −5 de moral por 2 dias de jogo (4 h)');

    const full = fed();
    full.settlement.buildings.granary = 1;
    full.settlement.resources.food = 880_000;
    const outcome = (state: GameState) =>
      deriveViewState(dealt(state, 'commonGranaryOutcome').state, 0).council.pending[0]?.options[0]
        ?.effectsText;
    expect(outcome(full)).toBe('+40 comida (só cabem 20 no Celeiro: o resto se perde)');
    full.settlement.resources.food = 900_000;
    expect(outcome(full)).toBe('+40 comida (não cabe: o Celeiro está cheio, e tudo se perde)');
    full.settlement.resources.food = 100_000;
    expect(outcome(full)).toBe('+40 comida');
  });

  it('com a mesa cheia na próxima audiência, avisa que ela não traz carta e o que fazer', () => {
    let state = dealt(dealt(fed(), 'alms', testCards).state, 'toll', testCards).state;
    const full = councilView(state, 1, testCards).council;
    expect(full).toMatchObject({
      blockedByPending: true,
      nextCardInSeconds: null,
      nextAudienceInSeconds: 8 * 3600,
      note: 'Com 2 cartas à espera, o conselho não traz outra: responda uma antes da próxima audiência para ela trazer novidade.',
    });
    // As duas expiram antes da audiência seguinte: a mesa vai estar livre, e a visão sabe.
    state = advanceWithCards(state, 23 * HOUR, []).state;
    expect(state.council.nextDrawAtMs).toBe(24 * HOUR);
    expect(councilView(state, 1, testCards).council.blockedByPending).toBe(true);
    state.council.pending.forEach((entry) => (entry.expiresAtMs -= 1));
    expect(councilView(state, 1, [...testCards, vespers]).council).toMatchObject({
      blockedByPending: false,
      nextCardInSeconds: 3600,
      note: null,
    });
  });

  it('sem nada elegível, diz que o conselho não tem assunto, em vez de prometer carta', () => {
    const state = fed();
    state.council.seenThisYear = ['alms', 'toll'];
    expect(councilView(state, 1, testCards).council).toMatchObject({
      blockedByPending: false,
      nextCardInSeconds: null,
      nextAudienceInSeconds: 8 * 3600,
      note: 'O conselho não tem assunto novo para o feudo como ele está: a próxima audiência não traz carta.',
    });
    // Na audiência da virada do ano a lista das vistas já zerou.
    const eve = gameAt(YEAR - DAY, (draft) => {
      draft.council.nextDrawAtMs = YEAR;
      draft.council.seenThisYear = ['alms', 'toll'];
    });
    expect(councilView(eve, 1, testCards).council.nextCardInSeconds).toBe(2 * 3600);
  });

  it('as decisões pendentes saem do prazo mais curto ao mais longo', () => {
    let state = dealt(fed(), 'alms', testCards).state;
    state = advanceWithCards(state, 3 * HOUR, []).state;
    state = dealt(state, 'toll', testCards).state;
    state.council.pending.reverse();
    expect(councilView(state, 1, testCards).pendingDecisions).toEqual([
      { kind: 'card', id: 'alms-1', title: 'Esmola à porta', expiresInSeconds: 21 * 3600 },
      { kind: 'card', id: 'toll-2', title: 'Pedágio na ponte', expiresInSeconds: 24 * 3600 },
    ]);
  });

  it('nada do que é segredo sai: flags, efeitos escondidos, continuações e o gerador', () => {
    // A cadeia do jogo em andamento, um efeito escondido à espera e o gerador já usado.
    let state = advanceTo(fed('lord', 1, 'segredo'), 5 * DAY).state;
    expect(state.rng.council).toHaveLength(4);
    const choose = (instanceId: string, optionId: string) => {
      state = accept(state, command('answerCard', { instanceId, optionId })).state;
    };
    // O que o sorteio pôs na mesa sai com a opção que o conselho aplicaria sozinho.
    for (const pending of deriveViewState(state, state.lastProcessedAt).council.pending) {
      choose(pending.instanceId, pending.defaultOptionId);
    }
    const well = dealt(state, 'collapsedWell');
    state = well.state;
    choose(well.instanceId, 'wait');
    const granary = dealt(state, 'commonGranaryPlanks');
    state = granary.state;
    choose(granary.instanceId, 'cede');
    expect(state.council.delayed).toHaveLength(1);
    expect(state.council.scheduled).toHaveLength(1);
    expect(Object.keys(state.council.flags)).toEqual(
      expect.arrayContaining(['commonGranary.open', 'commonGranary.supported']),
    );
    const shown = JSON.stringify(deriveViewState(state, state.lastProcessedAt));
    for (const secret of [
      'commonGranary',
      'thawBridge',
      'routine',
      'desabou',
      'cantaria',
      'flags',
      'scheduled',
      'delayed',
      'hidden',
      'seenThisYear',
      'rng',
      String(state.rng.council?.[0]),
    ]) {
      expect(shown, secret).not.toContain(secret);
    }
  });
});
