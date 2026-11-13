import { describe, expect, it } from 'vitest';

import type { Command, GameState } from '@lotg/engine';

import { botFor } from './bots';
import type { Act, Bot } from './bots/types';
import { formatSummary, summarize, toCsv } from './report';
import { simulate, type SimulationOptions } from './simulate';

const HOUR_MS = 3_600_000;

/**
 * O estado sem o que depende do ritmo: o que tem de coincidir entre duas partidas de ritmos
 * diferentes quando as ordens usam os mesmos tetos e não atravessam regras de prazo real.
 * São três campos retirados da comparação: o ritmo gravado nele; o prazo de resposta das cartas do
 * Conselho, que é de tempo real (24 h em qualquer ritmo) e por isso cai em outro instante de
 * jogo; e o instante em que os vigias avistaram a incursão que vem, porque a antecedência do
 * aviso da Torre também é tempo real (1 h e 2 h reais, ADR 0016). Enquanto as cartas são
 * respondidas nos mesmos instantes e ninguém passa fome, o resto do feudo coincide.
 */
const world = (state: GameState) => ({
  ...state,
  settings: { ...state.settings, timeScale: null },
  council: {
    ...state.council,
    pending: state.council.pending.map((card) => ({ ...card, expiresAtMs: null })),
  },
  horde: {
    ...state.horde,
    scheduledRaids: state.horde.scheduledRaids.map((raid) => ({ ...raid, announcedAtMs: null })),
  },
});

/** Os eventos sem o alarme dos vigias: ele soa em outro instante de jogo em cada ritmo. */
const withoutAlarms = <T extends { type: string }>(events: T[]) =>
  events.filter((event) => event.type !== 'raidAnnounced');
const alarms = <T extends { type: string }>(events: T[]) =>
  events.filter((event) => event.type === 'raidAnnounced');
const base: SimulationOptions = {
  seed: 'pedra-alta-golden',
  days: 3,
  strategy: 'economico',
  sessionsPerDay: 3,
  // A Vigília padrão marca o Cerco às 156 h no Rápido e às 164 h no Normal.
  // Meio-dia alinha ensaio e Cerco nos dois ritmos sem excluir seus efeitos ou
  // encurtar a janela comparada (docs/balance-v0.4.md, seção 20).
  vigilHourLocal: 12,
};

// 3 dias reais no ritmo 3 são 9 dias reais no ritmo 1: 216 h de jogo. Com 3 sessões por dia no
// ritmo 3 e 1 por dia no ritmo 1, as sessões caem nos mesmos instantes de jogo (a cada 24 h).
//
// O replay conserva as ordens nos mesmos instantes de jogo. Desde R2/R3, o Rápido
// pode ordenar lotes que o Normal recusa: esse par registra a divergência intencional.
// A equivalência de relógio fica no par de tetos compatíveis construído abaixo.
type Order = { type: Command['type']; payload: Command['payload'] };
type LooseAct = (type: Order['type'], payload: Order['payload']) => ReturnType<Act>;

/** O bot econômico com um gravador: anota, sessão a sessão, as ordens que ele deu. */
function recorder(sessionsPerDay = base.sessionsPerDay): { bot: Bot; sessions: Order[][] } {
  const sessions: Order[][] = [];
  const bot: Bot = async (view, act) => {
    const orders: Order[] = [];
    sessions.push(orders);
    const noted: LooseAct = (type, payload) => {
      orders.push({ type, payload });
      return (act as LooseAct)(type, payload);
    };
    // O mesmo econômico que simulate montaria para a cadência pedida no cenário.
    await botFor(base.strategy, sessionsPerDay)(view, noted as Act);
  };
  return { bot, sessions };
}

/** Um bot que não decide nada: repete, sessão a sessão, as ordens gravadas. */
function replayer(sessions: Order[][]): { bot: Bot; replayed: () => number } {
  let replayed = 0;
  const bot: Bot = async (_view, act) => {
    const orders = sessions[replayed] ?? [];
    replayed += 1;
    for (const order of orders) {
      await (act as LooseAct)(order.type, order.payload);
    }
  };
  return { bot, replayed: () => replayed };
}

const recorded = recorder();
const { sessions } = recorded;
const fast = await simulate({ ...base, timeScale: 3, bot: recorded.bot });
const replay = replayer(sessions);
const normal = await simulate({ ...base, days: 9, sessionsPerDay: 1, bot: replay.bot });

// R2/R3 tornam legítima a divergência do replay Rápido/Normal: ordens de quinze
// recrutas ou trinta soldados não são aceitas no Normal. A equivalência do relógio
// usa ritmos com os mesmos tetos (1 e 0,5), visitas a cada seis horas de jogo e uma
// janela de 72 h de jogo, anterior ao Cerco cujos intervalos também são reais.
const compatibleTape = recorder(4);
const compatibleOne = await simulate({
  ...base,
  days: 3,
  sessionsPerDay: 4,
  timeScale: 1,
  bot: compatibleTape.bot,
});
const compatibleHalf = await simulate({
  ...base,
  days: 6,
  sessionsPerDay: 2,
  timeScale: 0.5,
  bot: replayer(compatibleTape.sessions).bot,
});

describe('ritmos da simulação e limites R2/R3', () => {
  it('preserva o relógio com tetos iguais e explicita a divergência intencional de R2/R3', () => {
    expect(sessions).toHaveLength(9);
    expect(replay.replayed()).toBe(9);
    expect(fast.finalState.lastProcessedAt).toBe(216 * HOUR_MS);
    expect(normal.finalState.lastProcessedAt).toBe(216 * HOUR_MS);
    expect(fast.finalState.settings.timeScale).toBe(3);
    expect(normal.finalState.settings.timeScale).toBe(1);
    expect(fast.commands.refused).toEqual({});
    expect(normal.commands.refused).not.toEqual({});
    expect(world(fast.finalState)).not.toStrictEqual(world(normal.finalState));

    expect(compatibleTape.sessions).toHaveLength(12);
    expect(compatibleOne.finalState.lastProcessedAt).toBe(72 * HOUR_MS);
    expect(compatibleHalf.finalState.lastProcessedAt).toBe(72 * HOUR_MS);
    expect(compatibleOne.commands.refused).toEqual({});
    expect(compatibleHalf.commands).toStrictEqual(compatibleOne.commands);
    expect(world(compatibleOne.finalState)).toStrictEqual(world(compatibleHalf.finalState));
    expect(withoutAlarms(compatibleOne.events)).toStrictEqual(withoutAlarms(compatibleHalf.events));
  });

  it('com o mesmo mundo, a Torre respeita a antecedência real nos ritmos Normal e Tranquilo', () => {
    // Para cada incursão anunciada e já resolvida: quantas horas de jogo antes o alarme soou.
    const gaps = (events: typeof fast.events) =>
      new Map(
        alarms(events).flatMap((alarm) => {
          const raid = events.find(
            (event) =>
              /^raid(Suffered|Repelled)$/.test(event.type) &&
              event.data.raidId === alarm.data.raidId,
          );
          return raid === undefined
            ? []
            : [[String(alarm.data.raidId), (raid.atMs - alarm.atMs) / HOUR_MS] as const];
        }),
      );
    const inNormal = gaps(compatibleHalf.events);
    const inFast = gaps(compatibleOne.events);
    expect(inNormal.size).toBeGreaterThan(0);
    expect([...inFast.keys()]).toEqual([...inNormal.keys()]);
    let earlier = 0;
    for (const [raidId, hours] of inNormal) {
      const fastHours = inFast.get(raidId) ?? 0;
      // No máximo a antecedência do nível 5 (V4E-T1: o bot leva a Torre além do 2 e o conteúdo
      // tem os níveis 3 a 5, de 3 a 5 h reais): 5 h reais são 5 h de jogo no Normal e
      // 2,5 h de jogo no Tranquilo. A Torre que fica
      // pronta com a incursão já à vista avisa com menos.
      expect(hours).toBeLessThanOrEqual(2.5);
      expect(fastHours).toBeLessThanOrEqual(5);
      expect(fastHours).toBeGreaterThanOrEqual(hours);
      earlier += fastHours > hours ? 1 : 0;
    }
    expect(earlier).toBeGreaterThan(0);
    // A incursão futura pode já ter sido avistada no Normal, antes do Tranquilo em tempo de jogo.
    const count = (events: typeof fast.events) => alarms(events).length;
    expect(count(compatibleOne.events)).toBeGreaterThanOrEqual(count(compatibleHalf.events));
    expect(count(compatibleOne.events) - count(compatibleHalf.events)).toBeLessThanOrEqual(1);
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

  it('a hora real h no Normal é o retrato da hora 2h no Tranquilo, com taxas por hora real', () => {
    for (const [index, row] of compatibleOne.rows.entries()) {
      const same = compatibleHalf.rows[2 * (index + 1) - 1];
      if (same === undefined) {
        throw new Error(`Falta a hora ${2 * (index + 1)} no ritmo 1.`);
      }
      // O retrato de jogo é o mesmo; mudam hora real, taxas e a contagem dos alarmes,
      // que no Normal soam
      // mais cedo em tempo de jogo (a antecedência é tempo real).
      const pictured = (entry: typeof row) => ({
        ...entry,
        hour: 0,
        realDay: 0,
        perHour: null,
        armyFood: null,
        gross: null,
        raids: { ...entry.raids, announced: 0 },
        // A equipe parada é uma amostra por hora real: no Normal há metade das amostras.
        expeditions: { ...entry.expeditions, heroIdleHours: 0 },
        // O volume que o Mercado ofereceu também é uma amostra por hora real: o nível que sobe
        // entre duas amostras entra na conta em dias diferentes.
        market: { ...entry.market, offered: 0 },
      });
      expect(pictured(row)).toStrictEqual(pictured(same));
      expect(row.raids.announced).toBeGreaterThanOrEqual(same.raids.announced);
      // A visão arredonda cada taxa a uma casa: o dobro do arredondado acumula duas
      // meias casas, além da meia casa do valor de referência.
      for (const [resource, value] of Object.entries(row.perHour)) {
        const tripled = same.perHour[resource as keyof typeof same.perHour] * 2;
        expect(Math.abs(value - tripled)).toBeLessThanOrEqual(0.2 + 1e-9);
      }
      for (const [resource, value] of Object.entries(row.gross)) {
        const tripled = same.gross[resource as keyof typeof same.gross] * 2;
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
    // A contagem de horas é real; aldeões/capacidade já podem divergir por R2/R3.
    expect(summarize(compatibleOne)).toMatchObject({
      villagers: summarize(compatibleHalf).villagers,
      capacity: summarize(compatibleHalf).capacity,
      townHall: summarize(compatibleHalf).townHall,
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
    // As mesmas ordens nos mesmos instantes de jogo: a partida do ritmo 1 repete as que o bot
    // deu no ritmo 0,5, porque ele decide em tempo real (o depósito que "enche em menos de 8
    // horas reais" é outro em cada ritmo).
    const tape = recorder();
    const slow = await simulate({
      ...base,
      days: 2,
      sessionsPerDay: 1,
      timeScale: 0.5,
      bot: tape.bot,
    });
    const reference = await simulate({
      ...base,
      days: 1,
      sessionsPerDay: 2,
      bot: replayer(tape.sessions).bot,
    });
    expect(tape.sessions).toHaveLength(2);
    expect(slow.rows).toHaveLength(48);
    expect(slow.finalState.settings.timeScale).toBe(0.5);
    expect(world(slow.finalState)).toStrictEqual(world(reference.finalState));
    expect(formatSummary(slow)).toContain('ritmo 0,5×');
  });

  it.each([0, -3, NaN, Infinity])('ritmo %d é recusado', async (timeScale) => {
    await expect(simulate({ ...base, timeScale })).rejects.toThrow(/Ritmo inválido/);
  });
});
