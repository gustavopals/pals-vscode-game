import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { goldCoversWages, goldRunsOutIn, netRates } from './economy';
import {
  accept,
  addHero,
  command,
  DAY,
  gameAt,
  HOUR,
  MINUTE,
  refuse,
  roomy,
  starve,
  NO_TAVERN,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';
import {
  nextDiscontentAt,
  nextWageDepartureAt,
  wageArrearsDurationAt,
  wageArrearsPace,
  wageDeparturesOwedAt,
} from './wages';

const PACES = [3, 1, 0.5] as const;
const DAY_REAL = 24 * HOUR;

/** Só o que é do soldo e dos heróis: o resto do feudo segue a vida dele. */
const guildEvents = (events: GameEvent[]): GameEvent[] =>
  events.filter((event) => /^(wageArrears|hero)/.test(event.type));

const brief = (events: GameEvent[]) =>
  guildEvents(events).map((event) => [
    event.type,
    event.atMs,
    ...(event.data.heroId === undefined ? [] : [event.data.heroId]),
  ]);

/** A primeira virada de dia de jogo em `atMs` ou depois dele. */
const turnFrom = (atMs: number): number => Math.ceil(atMs / DAY) * DAY;

/**
 * Um feudo calado (sem carta, sem lobo, sem objetivo por cumprir), com comida sobrando e sem
 * ninguém na Mina: o saldo de ouro é só o soldo, e as contas dos testes são exatas. `atMs` é o
 * instante em que o feudo está; os heróis entram por `edit`.
 */
function court(timeScale: number, edit: (draft: GameState) => void, atMs = 0): GameState {
  return gameAt(atMs, (draft) => {
    draft.settings.timeScale = timeScale;
    roomy(draft);
    draft.settlement.workers.farm = 2;
    draft.settlement.resources.gold = 0;
    edit(draft);
  });
}

/** O mesmo estado com outro tanto de ouro no cofre, em milésimos: o que uma carta ou um prêmio dariam. */
function withGold(state: GameState, gold: number): GameState {
  const draft = JSON.parse(JSON.stringify(state)) as GameState;
  draft.settlement.resources.gold = gold;
  draft.settlement.accumulators.gold = 0;
  return draft;
}

describe('soldo: consumo contínuo de ouro (GDD §9.1; ADR 0017, decisão 3)', () => {
  it('sai do ouro exato em milésimos, com o resto guardado, 2 por hora de jogo por herói', () => {
    const start = court(1, (draft) => {
      draft.settlement.resources.gold = 250_000;
      addHero(draft);
      addHero(draft);
    });
    expect(netRates(start).gold).toBe(-4_000);
    const hour = advanceTo(start, HOUR).state;
    expect(hour.settlement.resources.gold).toBe(246_000);
    expect(hour.settlement.accumulators.gold).toBe(0);
    // Um instante qualquer: 4.000 × 1.234.567 ms = 1.371 milésimos inteiros e um resto.
    const odd = advanceTo(start, 1_234_567).state;
    expect(odd.settlement.resources.gold).toBe(250_000 - 1_371);
    expect(odd.settlement.accumulators.gold).toBe(-2_668_000);
    // Aos pedaços, o mesmo par (estoque, resto).
    const pieces = advanceTo(advanceTo(advanceTo(start, 7).state, 600_001).state, 1_234_567).state;
    expect(pieces).toStrictEqual(odd);
    expect(guildEvents(advanceTo(start, 1_234_567).events)).toEqual([]);
  });

  it('é tempo de jogo: no ritmo 3 o estado gasta o mesmo por hora de jogo, e a tela diz o triplo por hora real', () => {
    for (const timeScale of PACES) {
      const start = court(timeScale, (draft) => {
        draft.settlement.resources.gold = 250_000;
        addHero(draft);
        addHero(draft);
      });
      expect(advanceTo(start, HOUR).state.settlement.resources.gold).toBe(246_000);
      const gold = deriveViewState(start, 0).resources.find((row) => row.id === 'gold');
      expect(gold?.perHour).toBe(-4 * timeScale);
      expect(gold?.breakdown).toMatch(
        new RegExp(`; −${String(4 * timeScale).replace('.', ',')}/h \\(soldo de 2 heróis\\)$`),
      );
      // 250 de ouro a 4 por hora de jogo: 62,5 h de jogo, no relógio de quem joga.
      expect(gold?.depletesInSeconds).toBe((62.5 * 3600) / timeScale);
    }
    const one = court(3, (draft) => void addHero(draft));
    expect(deriveViewState(one, 0).resources.find((row) => row.id === 'gold')?.breakdown).toMatch(
      /; −6\/h \(soldo de 1 herói\)$/,
    );
  });

  it('sem herói o ouro não tem consumo, prazo nem linha de soldo', () => {
    const start = court(1, (draft) => {
      draft.settlement.resources.gold = 10_000;
    });
    expect(netRates(start).gold).toBe(0);
    expect(goldRunsOutIn(start)).toBeNull();
    const gold = deriveViewState(start, 0).resources.find((row) => row.id === 'gold');
    expect(gold?.breakdown).not.toMatch(/soldo/);
    expect(gold?.depletesInSeconds).toBeNull();
    const later = advanceTo(start, 400 * HOUR);
    expect(later.state.settlement.resources.gold).toBe(10_000);
    expect(guildEvents(later.events)).toEqual([]);
  });

  it('quem trabalha na Mina paga parte do soldo: o saldo é a produção menos o soldo', () => {
    const start = court(1, (draft) => {
      draft.settlement.resources.gold = 100_000;
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
      addHero(draft);
    });
    // Um mineiro no nível 1, com a moral na base: 4 por hora contra 6 de soldo.
    expect(netRates(start).gold).toBe(4_000 - 6_000);
    expect(advanceTo(start, HOUR).state.settlement.resources.gold).toBe(98_000);
    expect(deriveViewState(start, 0).resources.find((row) => row.id === 'gold')?.breakdown).toBe(
      'Mina de Ouro: 1 trabalhador × 4 × 1 (Nv1) = 4/h; −6/h (soldo de 3 heróis)',
    );
  });
});

describe('o ouro que acaba abre o atraso no instante exato', () => {
  const start = court(1, (draft) => {
    draft.settlement.resources.gold = 10_000;
    addHero(draft);
  });
  const OUT = 5 * HOUR;

  it('10 de ouro e um herói: o instante é um evento da linha do tempo, 5 h de jogo depois', () => {
    expect(goldRunsOutIn(start)).toBe(OUT);
    // Até lá só há viradas de dia; depois da última, o próximo evento é o ouro acabando.
    const before = advanceTo(start, 4 * HOUR).state;
    expect(nextEventAt(before)).toBe(OUT);
    const edge = advanceTo(start, OUT - 1);
    expect(edge.state.guild.wageArrears).toBeNull();
    expect(edge.state.settlement.resources.gold).toBe(1);
    expect(edge.state.settlement.accumulators.gold).toBe(-3_598_000);
    expect(goldRunsOutIn(edge.state)).toBe(1);
    expect(guildEvents(edge.events)).toEqual([]);
  });

  it('abre ali, com o cofre zerado, uma linha na Crônica e nenhum prazo cobrado', () => {
    const at = advanceTo(start, OUT);
    expect(at.state.guild.wageArrears).toEqual({ sinceMs: OUT, carriedMs: 0, departed: 0 });
    expect(at.state.guild.lastWageArrears).toBeNull();
    expect(at.state.settlement.resources.gold).toBe(0);
    expect(at.state.settlement.accumulators.gold).toBe(0);
    expect(guildEvents(at.events)).toEqual([
      {
        type: 'wageArrearsStarted',
        atMs: OUT,
        text: 'No 3º dia da Primavera, o cofre de Pedra Alta ficou vazio: já não há com que pagar o soldo dos heróis.',
        data: { heroes: 1 },
      },
    ]);
    // De uma vez ou aos pedaços, o mesmo instante e o mesmo estado.
    const late = advanceTo(start, 6 * HOUR + 17);
    expect(brief(late.events)).toEqual([['wageArrearsStarted', OUT]]);
    expect(advanceTo(advanceTo(start, OUT - 1).state, 6 * HOUR + 17).state).toStrictEqual(
      late.state,
    );
    expect(advanceTo(at.state, 6 * HOUR + 17).state).toStrictEqual(late.state);
  });

  it('a tela anuncia o instante: o atraso abre no segundo dito, nos três ritmos e com a Mina e a moral no caminho', () => {
    for (const timeScale of PACES) {
      const mined = court(timeScale, (draft) => {
        draft.settlement.resources.gold = 20_000;
        draft.settlement.workers.goldMine = 1;
        addHero(draft);
        addHero(draft);
        addHero(draft);
      });
      const seconds = deriveViewState(mined, 0).resources.find((row) => row.id === 'gold')
        ?.depletesInSeconds as number;
      // Mais do que as 10 h de jogo da conta parada: a moral sobe na primeira virada e a
      // mestria a cada dia, e a Mina passa a pagar uma parte maior.
      expect(seconds * 1000 * timeScale).toBeGreaterThan(10 * HOUR);
      const justBefore = Math.ceil(seconds * 1000 * timeScale) - 1;
      const justAfter = Math.ceil((seconds + 1) * 1000 * timeScale);
      expect(advanceTo(mined, justBefore).state.guild.wageArrears, `ritmo ${timeScale}`).toBeNull();
      expect(
        advanceTo(mined, justAfter).state.guild.wageArrears,
        `ritmo ${timeScale}`,
      ).not.toBeNull();
    }
  });

  it('gastar o ouro de propósito abre o atraso na hora da ordem', () => {
    const rich = court(1, (draft) => {
      draft.settlement.resources.gold = 10_000;
      draft.settlement.resources.food = 600_000;
      addHero(draft);
    });
    // O recrutamento custa 10 de ouro: o cofre zera com soldo a pagar.
    const { state, events } = accept(rich, command('recruitVillagers', { quantity: 1 }));
    expect(state.settlement.resources.gold).toBe(0);
    expect(state.guild.wageArrears).toEqual({ sinceMs: 0, carriedMs: 0, departed: 0 });
    expect(events.map((event) => event.type)).toEqual(['recruitmentStarted', 'wageArrearsStarted']);
  });

  it('não há dívida: o ouro que chega depois não paga o que ficou para trás', () => {
    const open = advanceTo(start, 9 * HOUR).state;
    expect(open.settlement.resources.gold).toBe(0);
    // 4 de ouro chegam às 9 h: o atraso fecha ali, e a hora seguinte custa só o soldo dela.
    const paid = advanceTo(withGold(open, 4_000), 10 * HOUR);
    expect(paid.state.settlement.resources.gold).toBe(2_000);
    expect(paid.state.guild.wageArrears).toBeNull();
    expect(paid.state.guild.lastWageArrears).toEqual({
      endedAtMs: 9 * HOUR,
      lastedMs: 4 * HOUR,
      departed: 0,
    });
    expect(guildEvents(paid.events)).toEqual([
      {
        type: 'wageArrearsEnded',
        atMs: 9 * HOUR,
        text: 'No 5º dia da Primavera, voltou a haver ouro no cofre de Pedra Alta. O soldo está em dia.',
        data: { reason: 'paid', sinceMs: OUT, departed: 0 },
      },
    ]);
  });

  it('enquanto dura, o que a Mina entrega vai para o soldo: o cofre fica em zero e nada se acumula', () => {
    const mined = court(1, (draft) => {
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
      addHero(draft);
    });
    const open = advanceTo(mined, 1).state;
    expect(open.guild.wageArrears).toEqual({ sinceMs: 0, carriedMs: 0, departed: 0 });
    const later = advanceTo(open, 9 * HOUR).state;
    expect(netRates(later).gold).toBeLessThan(0);
    expect(later.settlement.resources.gold).toBe(0);
    expect(later.settlement.accumulators.gold).toBe(0);
    expect(goldCoversWages(later)).toBe(false);
    expect(goldRunsOutIn(later)).toBeNull();
  });

  it('fecha quando o saldo volta a ser positivo: um herói a menos e a Mina cobre o soldo', () => {
    const mined = court(1, (draft) => {
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
      addHero(draft);
    });
    const open = advanceTo(mined, 3 * HOUR).state;
    const draft = JSON.parse(JSON.stringify(open)) as GameState;
    draft.guild.heroes.splice(1, 2);
    const closed = advanceTo(draft, 3 * HOUR + 1);
    expect(netRates(closed.state).gold).toBeGreaterThan(0);
    expect(brief(closed.events)).toEqual([['wageArrearsEnded', 3 * HOUR]]);
    expect(closed.state.guild.wageArrears).toBeNull();
  });
});

describe('as consequências do atraso contam tempo real e são cobradas na virada do dia', () => {
  // Quatro heróis, postos às 0 h 30 de jogo com o cofre vazio: o atraso abre ali. Edda e Mirela
  // chegaram juntas, Brann antes delas, e Rolf é Leal.
  const SINCE = 30 * MINUTE;
  const band = (timeScale: number) =>
    court(
      timeScale,
      (draft) => {
        addHero(draft, { name: 'Edda', joinedAtMs: 10 * MINUTE });
        addHero(draft, { name: 'Rolf', traits: ['loyal'], joinedAtMs: 20 * MINUTE });
        addHero(draft, { name: 'Brann', joinedAtMs: 5 * MINUTE });
        addHero(draft, { name: 'Mirela', joinedAtMs: 10 * MINUTE });
      },
      SINCE,
    );

  it.each(PACES)(
    'ritmo %s: os prazos em ms de jogo são os do conteúdo vezes o ritmo',
    (timeScale) => {
      expect(wageArrearsPace(band(timeScale))).toEqual({
        discontentAfterMs: 12 * HOUR * timeScale,
        leaveAfterMs: 24 * HOUR * timeScale,
        leaveEveryMs: 2 * HOUR * timeScale,
        resumeWithinMs: 2 * HOUR * timeScale,
      });
    },
  );

  it.each(PACES)(
    'ritmo %s: Descontentes na primeira virada com 12 h reais de atraso; nem um milissegundo antes',
    (timeScale) => {
      const start = band(timeScale);
      const due = SINCE + 12 * HOUR * timeScale;
      const turn = turnFrom(due);
      // A virada que cobra cai entre as 12 h reais e um dia de jogo depois delas.
      expect((turn - SINCE) / timeScale).toBeGreaterThanOrEqual(12 * HOUR);
      expect((turn - SINCE) / timeScale).toBeLessThan(12 * HOUR + DAY / timeScale);

      const before = advanceTo(start, turn - 1);
      expect(before.state.guild.wageArrears).toEqual({ sinceMs: SINCE, carriedMs: 0, departed: 0 });
      expect(brief(before.events)).toEqual([['wageArrearsStarted', SINCE]]);
      expect(before.state.guild.heroes.map((hero) => hero.discontent)).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(nextDiscontentAt(before.state)).toBe(turn);

      const at = advanceTo(before.state, turn);
      // Na ordem do identificador, e nunca o Leal.
      expect(guildEvents(at.events).map((event) => [event.type, event.data.heroId])).toEqual([
        ['heroDiscontent', 'hero-1'],
        ['heroDiscontent', 'hero-3'],
        ['heroDiscontent', 'hero-4'],
      ]);
      expect(guildEvents(at.events)[0]?.text).toMatch(
        /^No \d+º dia d[ao] \S+, Edda cobrou o soldo atrasado diante de todo o salão de Pedra Alta\. Anda descontente\.$/,
      );
      expect(at.state.guild.heroes.map((hero) => [hero.name, hero.discontent])).toEqual([
        ['Edda', true],
        ['Rolf', false],
        ['Brann', true],
        ['Mirela', true],
      ]);
      expect(nextDiscontentAt(at.state)).toBeNull();
      // A virada seguinte não repete a linha.
      expect(brief(advanceTo(at.state, turn + DAY).events)).toEqual([]);
    },
  );

  it.each(PACES)(
    'ritmo %s: a partir de 24 h reais parte um herói a cada 2 h reais: o que chegou por último, nunca o Leal',
    (timeScale) => {
      const start = band(timeScale);
      const leaveAfter = 24 * HOUR * timeScale;
      const leaveEvery = 2 * HOUR * timeScale;
      // A conta refeita à mão, virada a virada: os devidos menos os que já partiram.
      const order = ['hero-4', 'hero-1', 'hero-3'];
      const expected: Array<[string, number, string]> = [];
      let turn = DAY;
      for (; expected.length < order.length; turn += DAY) {
        const lasted = turn - SINCE;
        const owed = lasted < leaveAfter ? 0 : Math.floor((lasted - leaveAfter) / leaveEvery) + 1;
        while (expected.length < Math.min(owed, order.length)) {
          expected.push(['heroLeft', turn, order[expected.length] as string]);
        }
      }
      const lastTurn = turn - DAY;
      // O primeiro parte na primeira virada com 24 h reais de atraso, e não antes.
      expect(expected[0]?.[1]).toBe(turnFrom(SINCE + leaveAfter));
      expect(nextWageDepartureAt(advanceTo(start, DAY).state)).toBe(expected[0]?.[1]);

      const end = advanceTo(start, lastTurn + 3 * DAY);
      expect(brief(end.events).filter(([type]) => type === 'heroLeft')).toEqual(expected);
      expect(guildEvents(end.events).find((event) => event.type === 'heroLeft')?.text).toMatch(
        /, Mirela cansou de esperar o soldo, juntou as armas e deixou Pedra Alta\.$/,
      );
      // Quem partiu não volta, e o contador de identidades não anda para trás.
      expect(end.state.guild.heroes.map((hero) => hero.id)).toEqual(['hero-2']);
      expect(end.state.ids).toEqual({ hero: 4 });
      // Só resta o Leal: continua sem soldo, sem ficar Descontente e sem partir. O que o prazo
      // deve dali em diante fica perdoado a cada virada, e a conta não cresce escondida.
      expect(end.state.guild.heroes[0]).toMatchObject({ name: 'Rolf', discontent: false });
      expect(end.state.guild.wageArrears).toEqual({
        sinceMs: SINCE,
        carriedMs: 0,
        departed: wageDeparturesOwedAt(end.state, lastTurn + 3 * DAY),
      });
      expect(end.state.guild.wageArrears?.departed).toBeGreaterThan(3);
      expect(nextWageDepartureAt(end.state)).toBeNull();
      expect(nextDiscontentAt(end.state)).toBeNull();
      expect(brief(end.events).filter(([type]) => type === 'wageArrearsEnded')).toEqual([]);
    },
  );

  it('no ritmo 1 é a regra do GDD até no instante: Descontentes às 14 h, o primeiro parte às 26 h e o segundo às 28 h', () => {
    const end = advanceTo(band(1), 30 * HOUR);
    expect(brief(end.events)).toEqual([
      ['wageArrearsStarted', SINCE],
      ['heroDiscontent', 14 * HOUR, 'hero-1'],
      ['heroDiscontent', 14 * HOUR, 'hero-3'],
      ['heroDiscontent', 14 * HOUR, 'hero-4'],
      ['heroLeft', 26 * HOUR, 'hero-4'],
      ['heroLeft', 28 * HOUR, 'hero-1'],
      ['heroLeft', 30 * HOUR, 'hero-3'],
    ]);
  });

  it('no ritmo 0,5 o passo é de meia virada: partem dois heróis por virada', () => {
    const end = advanceTo(band(0.5), 14 * HOUR);
    expect(brief(end.events).filter(([type]) => type === 'heroLeft')).toEqual([
      ['heroLeft', 14 * HOUR, 'hero-4'],
      ['heroLeft', 14 * HOUR, 'hero-1'],
    ]);
  });

  it('fechado o atraso, ninguém fica Descontente, e o registro guarda quanto ele durou', () => {
    for (const timeScale of PACES) {
      const turn = turnFrom(SINCE + 12 * HOUR * timeScale);
      const sour = advanceTo(band(timeScale), turn + 7 * MINUTE).state;
      expect(sour.guild.heroes.filter((hero) => hero.discontent)).toHaveLength(3);
      const paid = advanceTo(withGold(sour, 500_000), turn + 8 * MINUTE);
      expect(brief(paid.events)).toEqual([['wageArrearsEnded', turn + 7 * MINUTE]]);
      expect(paid.state.guild.heroes.map((hero) => hero.discontent)).toEqual([
        false,
        false,
        false,
        false,
      ]);
      expect(paid.state.guild.wageArrears).toBeNull();
      expect(paid.state.guild.lastWageArrears).toEqual({
        endedAtMs: turn + 7 * MINUTE,
        lastedMs: turn + 7 * MINUTE - SINCE,
        departed: 0,
      });
    }
  });

  it('só Leais: o atraso abre e fica, ninguém fica Descontente nem parte, e nada fica devido', () => {
    const start = court(1, (draft) => void addHero(draft, { traits: ['veteran', 'loyal'] }));
    const end = advanceTo(start, 40 * HOUR);
    expect(brief(end.events)).toEqual([['wageArrearsStarted', 0]]);
    expect(end.state.guild.heroes).toHaveLength(1);
    expect(end.state.guild.heroes[0]?.discontent).toBe(false);
    // Às 40 h o prazo "deve" 9 heróis; a conta fechou em cada virada.
    expect(end.state.guild.wageArrears).toEqual({ sinceMs: 0, carriedMs: 0, departed: 9 });

    // Quem chega no meio de um atraso antigo não sai em bloco com o que ficou perdoado: na
    // virada seguinte fica Descontente e paga um passo do prazo, não os nove.
    const joined = JSON.parse(JSON.stringify(advanceTo(end.state, 41 * HOUR).state)) as GameState;
    addHero(joined, { name: 'Brann' });
    addHero(joined, { name: 'Mirela' });
    const next = advanceTo(joined, 42 * HOUR);
    expect(brief(next.events)).toEqual([
      ['heroDiscontent', 42 * HOUR, 'hero-2'],
      ['heroDiscontent', 42 * HOUR, 'hero-3'],
      ['heroLeft', 42 * HOUR, 'hero-3'],
    ]);
    expect(next.state.guild.wageArrears?.departed).toBe(10);
  });
});

describe('o atraso que reabre logo é o mesmo', () => {
  /**
   * Um herói, o atraso aberto desde o zero, e ele já Descontente; uma hora de jogo depois da
   * virada chega ouro que dura `lastsMs`. Devolve o estado logo antes de o ouro chegar e o
   * instante em que ele acaba.
   */
  function reopening(timeScale: number, lastsMs: number) {
    const turn = turnFrom(12 * HOUR * timeScale);
    const paidAt = turn + HOUR;
    const open = advanceTo(
      court(timeScale, (draft) => void addHero(draft)),
      paidAt,
    ).state;
    expect(open.guild.heroes[0]?.discontent).toBe(true);
    // Um herói gasta 2.000 milésimos por hora de jogo: um milésimo dura 1.800 ms.
    expect(lastsMs % 1_800).toBe(0);
    return { paid: withGold(open, lastsMs / 1_800), paidAt, reopensAt: paidAt + lastsMs };
  }

  it.each(PACES)(
    'ritmo %s: dentro da janela de 2 h reais continua de onde parou, e o Descontente volta na virada seguinte',
    (timeScale) => {
      const window = 2 * HOUR * timeScale;
      const { paid, paidAt, reopensAt } = reopening(timeScale, window - 1_800);
      const back = advanceTo(paid, reopensAt);
      expect(brief(back.events)).toEqual([
        ['wageArrearsEnded', paidAt],
        ['wageArrearsStarted', reopensAt],
      ]);
      expect(back.state.guild.wageArrears).toEqual({
        sinceMs: reopensAt,
        carriedMs: paidAt,
        departed: 0,
      });
      expect(back.state.guild.lastWageArrears).toBeNull();
      // O tempo com o soldo em dia não conta; o que já tinha contado não se perde.
      expect(wageArrearsDurationAt(back.state, reopensAt)).toBe(paidAt);
      expect(back.state.guild.heroes[0]?.discontent).toBe(false);
      // Na virada seguinte ele volta a estar Descontente, sem esperar de novo as 12 h.
      const turn = turnFrom(reopensAt + 1);
      const sour = advanceTo(back.state, turn);
      expect(brief(sour.events)).toEqual([['heroDiscontent', turn, 'hero-1']]);
      expect(sour.state.guild.heroes[0]?.discontent).toBe(true);
    },
  );

  it.each(PACES)(
    'ritmo %s: no fim exato da janela é um atraso novo, e os prazos contam do zero',
    (timeScale) => {
      const window = 2 * HOUR * timeScale;
      const { paid, paidAt, reopensAt } = reopening(timeScale, window);
      expect(reopensAt - paidAt).toBe(window);
      const back = advanceTo(paid, reopensAt);
      expect(back.state.guild.wageArrears).toEqual({
        sinceMs: reopensAt,
        carriedMs: 0,
        departed: 0,
      });
      expect(back.state.guild.lastWageArrears).toBeNull();
      const turn = turnFrom(reopensAt + 1);
      const calm = advanceTo(back.state, turn);
      expect(brief(calm.events)).toEqual([]);
      expect(calm.state.guild.heroes[0]?.discontent).toBe(false);
      expect(nextDiscontentAt(calm.state)).toBe(turnFrom(reopensAt + 12 * HOUR * timeScale));
    },
  );

  it('o atraso retomado traz os heróis que já tinha cobrado: o seguinte só parte quando o prazo o dever', () => {
    // Ritmo 1, dois heróis, atraso desde o zero: o primeiro parte às 24 h.
    const start = court(1, (draft) => {
      addHero(draft);
      addHero(draft);
    });
    const open = advanceTo(start, 25 * HOUR).state;
    expect(open.guild.heroes.map((hero) => hero.id)).toEqual(['hero-1']);
    expect(open.guild.wageArrears).toEqual({ sinceMs: 0, carriedMs: 0, departed: 1 });
    // Às 25 h chega 1 de ouro: meia hora de soldo. O atraso fecha e reabre às 25 h 30.
    const back = advanceTo(withGold(open, 1_000), 26 * HOUR);
    expect(brief(back.events)).toEqual([
      ['wageArrearsEnded', 25 * HOUR],
      ['wageArrearsStarted', 25 * HOUR + 30 * MINUTE],
      // A virada das 26 h encontra 25 h 30 de atraso contado: Descontente de novo, e ninguém parte.
      ['heroDiscontent', 26 * HOUR, 'hero-1'],
    ]);
    expect(back.state.guild.wageArrears).toEqual({
      sinceMs: 25 * HOUR + 30 * MINUTE,
      carriedMs: 25 * HOUR,
      departed: 1,
    });
    // O segundo é devido com 26 h de atraso contado: 25 h + 1 h depois de reabrir, às 26 h 30.
    // A virada que cobra é a das 28 h.
    expect(nextWageDepartureAt(back.state)).toBe(28 * HOUR);
    const gone = advanceTo(back.state, 28 * HOUR);
    expect(brief(gone.events)).toEqual([
      ['heroLeft', 28 * HOUR, 'hero-1'],
      ['wageArrearsEnded', 28 * HOUR],
    ]);
  });

  it('duas mudanças no mesmo instante que fecham e reabrem o atraso deixam a duração e os cobrados como estavam', () => {
    const start = court(1, (draft) => {
      addHero(draft);
      addHero(draft);
    });
    const open = advanceTo(start, 25 * HOUR).state;
    const lasted = wageArrearsDurationAt(open, 25 * HOUR);
    // O ouro chega e uma ordem qualquer acomoda o feudo: o atraso fecha.
    const paid = accept(withGold(open, 50_000), command('renameSettlement', { name: 'Vau' }));
    expect(brief(paid.events)).toEqual([['wageArrearsEnded', 25 * HOUR]]);
    // No mesmo instante o ouro sai, e a ordem seguinte o reabre: é o mesmo atraso.
    const spent = accept(withGold(paid.state, 0), command('renameSettlement', { name: 'Vau 2' }));
    expect(brief(spent.events)).toEqual([['wageArrearsStarted', 25 * HOUR]]);
    expect(spent.state.guild.wageArrears).toEqual({
      sinceMs: 25 * HOUR,
      carriedMs: lasted,
      departed: 1,
    });
    expect(wageArrearsDurationAt(spent.state, 25 * HOUR)).toBe(lasted);
  });
});

describe('dispensar um herói (dismissHero)', () => {
  const start = court(1, (draft) => {
    draft.settlement.resources.gold = 30_000;
    addHero(draft, { name: 'Edda', traits: ['loyal'] });
    addHero(draft, { name: 'Rolf' });
    addHero(draft, { name: 'Brann' });
  });

  it('tira o herói do feudo na hora, sem devolver ouro, e o soldo cai no mesmo instante', () => {
    const at = advanceTo(start, 90 * MINUTE).state;
    const gold = at.settlement.resources.gold;
    const { state, events } = accept(at, command('dismissHero', { heroId: 'hero-2' }));
    expect(events).toEqual([
      {
        type: 'heroDismissed',
        atMs: 90 * MINUTE,
        text: 'No 1º dia da Primavera, o senhor de Pedra Alta dispensou Rolf.',
        data: { heroId: 'hero-2', heroes: 2 },
      },
    ]);
    expect(state.guild.heroes.map((hero) => hero.id)).toEqual(['hero-1', 'hero-3']);
    expect(state.settlement.resources.gold).toBe(gold);
    expect(netRates(state).gold).toBe(-4_000);
    // O identificador não volta: o próximo herói é o quarto.
    expect(state.ids).toEqual({ hero: 3 });
    // A Leal pode ser dispensada como qualquer outro.
    const alone = accept(state, command('dismissHero', { heroId: 'hero-1' }));
    expect(alone.state.guild.heroes.map((hero) => hero.name)).toEqual(['Brann']);
  });

  it('recusa o herói que não está a serviço do feudo, sem mexer em nada, e não confia no payload', () => {
    const expected = {
      code: 'HERO_NOT_FOUND',
      message: 'Esse herói já não está a serviço do feudo.',
    };
    expect(refuse(start, command('dismissHero', { heroId: 'hero-9' }))).toEqual(expected);
    expect(refuse(start, command('dismissHero', { heroId: 'Rolf' }))).toEqual(expected);
    const bogus = { heroId: 2 } as unknown as { heroId: string };
    expect(refuse(start, command('dismissHero', bogus))).toEqual(expected);
    const empty = {} as unknown as { heroId: string };
    expect(refuse(start, command('dismissHero', empty))).toEqual(expected);
    // Dispensado uma vez, a segunda ordem (outra aba, com outro commandId) é recusada.
    const once = accept(start, command('dismissHero', { heroId: 'hero-2' })).state;
    expect(refuse(once, command('dismissHero', { heroId: 'hero-2' }))).toEqual(expected);
  });

  it('durante o atraso: dispensar não conta como herói cobrado, e o prazo continua para os outros', () => {
    // O ouro acaba às 5 h de jogo; às 18 h os dois que não são Leais já estão Descontentes.
    const open = advanceTo(start, 18 * HOUR + 7 * MINUTE).state;
    expect(open.guild.wageArrears).toEqual({ sinceMs: 5 * HOUR, carriedMs: 0, departed: 0 });
    expect(open.guild.heroes.map((hero) => hero.discontent)).toEqual([false, true, true]);
    const { state, events } = accept(open, command('dismissHero', { heroId: 'hero-3' }));
    expect(brief(events)).toEqual([['heroDismissed', 18 * HOUR + 7 * MINUTE, 'hero-3']]);
    expect(state.guild.wageArrears).toEqual({ sinceMs: 5 * HOUR, carriedMs: 0, departed: 0 });
    // Com 24 h de atraso (às 29 h; a virada é a das 30 h) parte o primeiro devido: Rolf.
    expect(nextWageDepartureAt(state)).toBe(30 * HOUR);
    const end = advanceTo(state, 30 * HOUR);
    expect(brief(end.events)).toEqual([['heroLeft', 30 * HOUR, 'hero-2']]);
    expect(end.state.guild.wageArrears?.departed).toBe(1);
    expect(end.state.guild.heroes.map((hero) => hero.name)).toEqual(['Edda']);
  });

  it('durante o atraso: dispensar o último herói fecha a conta, e dispensar até a Mina cobrir o soldo também', () => {
    const open = advanceTo(start, 18 * HOUR + 7 * MINUTE).state;
    let state = open;
    const types: string[] = [];
    for (const heroId of ['hero-1', 'hero-2', 'hero-3']) {
      const step = accept(state, command('dismissHero', { heroId }));
      state = step.state;
      types.push(...step.events.map((event) => event.type));
    }
    expect(types).toEqual(['heroDismissed', 'heroDismissed', 'heroDismissed', 'wageArrearsEnded']);
    expect(state.guild).toEqual({
      heroes: [],
      arriving: [],
      wageArrears: null,
      lastWageArrears: {
        endedAtMs: 18 * HOUR + 7 * MINUTE,
        lastedMs: 13 * HOUR + 7 * MINUTE,
        departed: 0,
      },
      ...NO_TAVERN,
    });
    // Sem herói não há soldo: nada mais acontece, por mais que o tempo passe.
    expect(guildEvents(advanceTo(state, 200 * HOUR).events)).toEqual([]);

    // Com um mineiro (uns 4 por hora), três heróis não se pagam; dispensado um, o saldo fica
    // positivo e o atraso fecha na hora, pago, com os outros dois de volta ao ânimo.
    const mined = court(1, (draft) => {
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
      addHero(draft);
    });
    const sour = advanceTo(mined, 13 * HOUR).state;
    expect(sour.guild.heroes.map((hero) => hero.discontent)).toEqual([true, true, true]);
    const relieved = accept(sour, command('dismissHero', { heroId: 'hero-1' }));
    expect(brief(relieved.events)).toEqual([
      ['heroDismissed', 13 * HOUR, 'hero-1'],
      ['wageArrearsEnded', 13 * HOUR],
    ]);
    expect(guildEvents(relieved.events).at(-1)?.data).toMatchObject({ reason: 'paid' });
    expect(relieved.state.guild.heroes.map((hero) => hero.discontent)).toEqual([false, false]);
  });
});

describe('trinta dias sem acesso, dois heróis e ouro que não basta (QA-04)', () => {
  // Ritmo 3: 100 de ouro pagam 25 h de jogo de dois heróis. Depois, 36 h de jogo até o
  // Descontente, 72 h até o primeiro partir e mais 6 h até o segundo.
  const start = court(3, (draft) => {
    draft.settlement.resources.gold = 100_000;
    addHero(draft);
    addHero(draft);
  });
  const MONTH = 30 * DAY_REAL * 3;
  const OUT = 25 * HOUR;

  it('o atraso abre, os dois ficam Descontentes, partem um a um e a conta fecha sozinha', () => {
    const end = advanceTo(start, MONTH);
    expect(brief(end.events)).toEqual([
      ['wageArrearsStarted', OUT],
      ['heroDiscontent', 62 * HOUR, 'hero-1'],
      ['heroDiscontent', 62 * HOUR, 'hero-2'],
      ['heroLeft', 98 * HOUR, 'hero-2'],
      ['heroLeft', 104 * HOUR, 'hero-1'],
      ['wageArrearsEnded', 104 * HOUR],
    ]);
    expect(guildEvents(end.events).at(-1)).toMatchObject({
      text: 'No 5º dia do Outono, já não há herói a quem Pedra Alta deva soldo. A conta está fechada.',
      data: { reason: 'noHeroes', sinceMs: OUT, departed: 2 },
    });
    expect(end.state.guild).toEqual({
      heroes: [],
      arriving: [],
      wageArrears: null,
      lastWageArrears: { endedAtMs: 104 * HOUR, lastedMs: 79 * HOUR, departed: 2 },
      ...NO_TAVERN,
    });
    expect(end.state.settlement.resources.gold).toBe(0);
    // Em tempo real: 20 h 40 até o Descontente, 32 h 40 até a primeira partida.
    expect((62 * HOUR - OUT) / 3).toBeGreaterThanOrEqual(12 * HOUR);
    expect((98 * HOUR - OUT) / 3).toBeGreaterThanOrEqual(24 * HOUR);
  });

  it('dia real a dia real, hora a hora ou de uma vez: o mesmo estado e os mesmos eventos', () => {
    const direct = advanceTo(start, MONTH);
    for (const stepMs of [3 * DAY_REAL, 3 * HOUR + 7]) {
      let state = start;
      const events: GameEvent[] = [];
      for (let at = stepMs; state.lastProcessedAt < MONTH; at += stepMs) {
        const step = advanceTo(state, Math.min(at, MONTH));
        state = step.state;
        events.push(...step.events);
      }
      expect(state).toStrictEqual(direct.state);
      expect(events).toStrictEqual(direct.events);
    }
  });
});

describe('a ordem dentro do mesmo instante', () => {
  it('o ouro que acaba em uma virada de dia abre o atraso depois dela: a virada não cobra o que ainda não abriu', () => {
    // 8 de ouro e um herói: 4 h de jogo, a segunda virada de dia.
    const start = court(1, (draft) => {
      draft.settlement.resources.gold = 8_000;
      addHero(draft);
    });
    const at = advanceTo(start, 4 * HOUR);
    expect(at.events.filter((event) => event.atMs === 4 * HOUR).map((event) => event.type)).toEqual(
      ['dayStarted', 'wageArrearsStarted'],
    );
    expect(at.state.guild.wageArrears).toEqual({ sinceMs: 4 * HOUR, carriedMs: 0, departed: 0 });
  });

  it('na virada: a deserção por fome, depois o Descontente e quem parte, depois o Conselho; o atraso fecha no fim do instante', () => {
    const start = court(1, (draft) => {
      addHero(draft);
      draft.settlement.population.villagers = 18;
      draft.settlement.workers.farm = 0;
      draft.settlement.resources.food = 0;
      starve(draft, 0);
      // A audiência do Conselho cai na mesma virada em que o herói parte.
      draft.council.nextDrawAtMs = 24 * HOUR;
    });
    const before = advanceTo(start, 24 * HOUR - 1).state;
    expect(before.guild.wageArrears?.sinceMs).toBe(0);
    const types = advanceTo(before, 24 * HOUR).events.map((event) => event.type);
    const position = (type: GameEvent['type']) => {
      expect(types, type).toContain(type);
      return types.indexOf(type);
    };
    expect(position('dayStarted')).toBeLessThan(position('villagerDeserted'));
    expect(position('villagerDeserted')).toBeLessThan(position('heroLeft'));
    expect(position('heroLeft')).toBeLessThan(position('cardDrawn'));
    expect(position('cardDrawn')).toBeLessThan(position('wageArrearsEnded'));
    expect(types.filter((type) => type === 'heroDiscontent')).toEqual([]);
  });

  it('o herói que parte na virada alivia o soldo: se a Mina passa a cobrir, o atraso fecha no mesmo instante, pago', () => {
    const start = court(1, (draft) => {
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft);
      addHero(draft);
    });
    const end = advanceTo(start, 26 * HOUR);
    // Com três, 6 de soldo contra uns 4 da Mina; às 24 h parte um, e com dois a Mina cobre.
    expect(brief(end.events).filter(([type]) => type !== 'heroDiscontent')).toEqual([
      ['wageArrearsStarted', 0],
      ['heroLeft', 24 * HOUR, 'hero-3'],
      ['wageArrearsEnded', 24 * HOUR],
    ]);
    expect(guildEvents(end.events).at(-1)?.data).toMatchObject({ reason: 'paid', departed: 1 });
    expect(end.state.guild.heroes.map((hero) => hero.discontent)).toEqual([false, false]);
    expect(end.state.settlement.resources.gold).toBeGreaterThan(0);
  });
});

describe('ler não gasta nada', () => {
  it('a visão e a linha do tempo não mudam o estado, o gerador nem os contadores, com heróis e atraso', () => {
    const start = court(3, (draft) => {
      draft.settlement.resources.gold = 30_000;
      draft.settlement.workers.goldMine = 1;
      addHero(draft);
      addHero(draft, { traits: ['loyal'] });
      addHero(draft);
    });
    for (const atMs of [0, 20 * HOUR, 70 * HOUR, 110 * HOUR, 200 * HOUR]) {
      const state = advanceTo(start, atMs).state;
      const frozen = JSON.stringify(state);
      nextEventAt(state);
      deriveViewState(state, state.lastProcessedAt);
      deriveViewState(state, state.lastProcessedAt + 5 * HOUR, { timeScale: 1 });
      expect(JSON.stringify(state)).toBe(frozen);
      expect(state.ids).toEqual({ hero: 3 });
    }
  });

  it('os números do conteúdo são os que o motor usa', () => {
    expect(balance.heroes.wagePerHour).toBe(2);
    expect(balance.heroes.arrears.leaveEveryRealMs).toBe(2 * HOUR);
  });
});
