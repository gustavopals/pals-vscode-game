import { describe, expect, it } from 'vitest';

import type { Command, GameState } from '@lotg/engine';

import { economico } from './bots/economico';
import type { Act, Bot } from './bots/types';
import { formatSummary, summarize, toCsv } from './report';
import { simulate, type SimulationOptions } from './simulate';

const HOUR_MS = 3_600_000;

/** O estado sem o ritmo gravado nele: o que tem de coincidir entre duas partidas de ritmos diferentes. */
const world = (state: GameState) => ({
  ...state,
  settings: { ...state.settings, timeScale: null },
});
const base: SimulationOptions = {
  seed: 'pedra-alta-golden',
  days: 3,
  strategy: 'economico',
  sessionsPerDay: 3,
};

// 3 dias reais no ritmo 3 são 9 dias reais no ritmo 1: 216 h de jogo. Com 3 sessões por dia no
// ritmo 3 e 1 por dia no ritmo 1, as sessões caem nos mesmos instantes de jogo (a cada 24 h).
//
// O que tem de coincidir é o jogo: as mesmas ordens, nos mesmos instantes de jogo, dão o mesmo
// feudo em qualquer ritmo. O bot decide em tempo real (o depósito que "enche em menos de 8 horas
// reais" é outro no ritmo 3), e por isso a partida do ritmo 1 não pergunta de novo ao bot: ela
// repete, sessão a sessão, as ordens que ele deu no ritmo 3.
type Order = { type: Command['type']; payload: Command['payload'] };
type LooseAct = (type: Order['type'], payload: Order['payload']) => ReturnType<Act>;
const sessions: Order[][] = [];
const recording: Bot = async (view, act) => {
  const orders: Order[] = [];
  sessions.push(orders);
  const noted: LooseAct = (type, payload) => {
    orders.push({ type, payload });
    return (act as LooseAct)(type, payload);
  };
  await economico(view, noted as Act);
};
let replayed = 0;
const replaying: Bot = async (_view, act) => {
  const orders = sessions[replayed] ?? [];
  replayed += 1;
  for (const order of orders) {
    await (act as LooseAct)(order.type, order.payload);
  }
};
const fast = await simulate({ ...base, timeScale: 3, bot: recording });
const normal = await simulate({ ...base, days: 9, sessionsPerDay: 1, bot: replaying });

describe('simulação no ritmo 3', () => {
  it('3 dias no ritmo 3 terminam no mesmo estado de jogo que 9 dias no ritmo 1', () => {
    // Nove sessões em cada partida, com as mesmas ordens; e há obras que começaram sozinhas no
    // caminho, nos mesmos instantes de jogo nos dois ritmos.
    expect(sessions).toHaveLength(9);
    expect(replayed).toBe(9);
    expect(
      fast.events.filter((event) => event.type === 'constructionAutoStarted').length,
    ).toBeGreaterThan(3);
    expect(fast.finalState.lastProcessedAt).toBe(216 * HOUR_MS);
    expect(fast.finalState.settings.timeScale).toBe(3);
    expect(normal.finalState.settings.timeScale).toBe(1);
    expect(world(fast.finalState)).toStrictEqual(world(normal.finalState));
    expect(fast.events).toStrictEqual(normal.events);
    expect(fast.commands).toStrictEqual(normal.commands);
  });

  it('uma linha por hora real: 72 em 3 dias, cada uma com 3 horas de jogo', () => {
    expect(fast.rows).toHaveLength(72);
    expect(normal.rows).toHaveLength(216);
    expect(fast.rows.map((row) => row.hour)).toEqual(
      Array.from({ length: 72 }, (_, index) => index + 1),
    );
    expect(fast.rows[23]).toMatchObject({ hour: 24, realDay: 1 });
    expect(fast.rows[24]).toMatchObject({ hour: 25, realDay: 2 });
    expect(fast.rows[71]).toMatchObject({ hour: 72, realDay: 3 });
    // O dia de jogo dura 2 h de jogo: 40 minutos reais. Na 1ª hora real já é o dia 2.
    expect(fast.rows[0]).toMatchObject({ year: 1, season: 'spring', dayOfSeason: 2 });
  });

  it('a hora real h no ritmo 3 é o retrato da hora 3h no ritmo 1, com taxas por hora real', () => {
    for (const [index, row] of fast.rows.entries()) {
      const same = normal.rows[3 * (index + 1) - 1];
      if (same === undefined) {
        throw new Error(`Falta a hora ${3 * (index + 1)} no ritmo 1.`);
      }
      // O retrato de jogo é o mesmo; só mudam a hora real e as taxas.
      expect({ ...row, hour: 0, realDay: 0, perHour: null }).toStrictEqual({
        ...same,
        hour: 0,
        realDay: 0,
        perHour: null,
      });
      // A visão arredonda cada taxa a uma casa: o triplo de um valor arredondado pode ficar a
      // até três meias casas do valor de verdade, que por sua vez é arredondado a meia casa.
      for (const [resource, value] of Object.entries(row.perHour)) {
        const tripled = same.perHour[resource as keyof typeof same.perHour] * 3;
        expect(Math.abs(value - tripled)).toBeLessThanOrEqual(0.2 + 1e-9);
      }
    }
  });

  it('é determinística: a mesma semente e o mesmo ritmo dão o mesmo CSV', async () => {
    // O gravador do roteiro não muda nada: o bot econômico, sozinho, joga a mesma partida.
    const again = await simulate({ ...base, timeScale: 3 });
    expect(toCsv(again.rows)).toBe(toCsv(fast.rows));
    expect(again.finalState).toStrictEqual(fast.finalState);
    expect(again.events).toStrictEqual(fast.events);
  });

  it('com as mesmas sessões por dia real, o ritmo muda a partida', async () => {
    const sameHabits = await simulate({ ...base, sessionsPerDay: 1, timeScale: 3 });
    const slow = await simulate({ ...base, sessionsPerDay: 1 });
    expect(sameHabits.finalState.lastProcessedAt).toBe(3 * slow.finalState.lastProcessedAt);
    expect(toCsv(sameHabits.rows)).not.toBe(toCsv(slow.rows));
  });

  it('o resumo diz o ritmo e conta a fome em horas reais', () => {
    expect(formatSummary(fast)).toContain(
      'Semente pedra-alta-golden · estratégia economico · 3 dias · 3 sessões/dia · ritmo 3×',
    );
    expect(summarize(fast).hours).toBe(72);
    expect(summarize(fast)).toMatchObject({
      villagers: summarize(normal).villagers,
      capacity: summarize(normal).capacity,
      townHall: summarize(normal).townHall,
    });
  });
});

describe('ritmo da simulação: padrão e limites', () => {
  it('sem a opção, o ritmo é 1: o resultado é o de sempre', async () => {
    const implicit = await simulate(base);
    const explicit = await simulate({ ...base, timeScale: 1 });
    expect(toCsv(explicit.rows)).toBe(toCsv(implicit.rows));
    expect(explicit.finalState).toStrictEqual(implicit.finalState);
    expect(explicit.events).toStrictEqual(implicit.events);
    expect(formatSummary(implicit)).toContain('3 sessões/dia · ritmo 1×\n');
  });

  it('ritmo 0,5: 2 dias reais são 24 h de jogo, e o resumo usa vírgula', async () => {
    const slow = await simulate({ ...base, days: 2, sessionsPerDay: 1, timeScale: 0.5 });
    const reference = await simulate({ ...base, days: 1, sessionsPerDay: 2 });
    expect(slow.rows).toHaveLength(48);
    expect(slow.finalState.settings.timeScale).toBe(0.5);
    expect(world(slow.finalState)).toStrictEqual(world(reference.finalState));
    expect(formatSummary(slow)).toContain('ritmo 0,5×');
  });

  it.each([0, -3, NaN, Infinity])('ritmo %d é recusado', async (timeScale) => {
    await expect(simulate({ ...base, timeScale })).rejects.toThrow(/Ritmo inválido/);
  });
});
