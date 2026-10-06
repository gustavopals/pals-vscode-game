import {
  type ApiError,
  type ChronicleResponse,
  type CommandAccepted,
  type EventsResponse,
  type ViewResponse,
  ViewResponseSchema,
} from '@lotg/protocol';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  call,
  councilRecess,
  countRows,
  createTestApp,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  quietHorde,
  renew,
  send,
  tavernSite,
  type TestApp,
} from './helpers/app';
import { resetTestDb } from './helpers/db';

// O Mercado pela API (roadmap da v0.3, V3E-T1.8; QA-09 e QA-18): negociar e reenviar, o volume
// do dia em duas abas, a compra no limite do depósito, a ordem que chega depois de o dia virar
// e o que não sai do servidor. O servidor de teste roda no ritmo 1: um dia de jogo são 2 h.

let server: TestApp;

beforeAll(async () => {
  await resetTestDb();
  server = await createTestApp();
});
afterAll(async () => {
  await server.close();
});

type View = ViewResponse['view'];
type Rejected = ApiError & { details: { code: string; message: string; view: View } };

const viewOf = async (token: string, gameId: string) => {
  const reply = await call<ViewResponse>(server, 'GET', `/games/${gameId}/view`, { token });
  expect(reply.status).toBe(200);
  expect(ViewResponseSchema.safeParse(reply.body).error).toBeUndefined();
  return reply.body.view;
};

const stockOf = (view: View, resource: string) =>
  view.resources.find((row) => row.id === resource)?.stock ?? Number.NaN;

const rowOf = (view: View, resource: string) => {
  const row = view.market.prices.find((entry) => entry.resource === resource);
  if (row === undefined) {
    throw new Error(`A visão não traz o preço de ${resource}.`);
  }
  return row;
};

const trade = (
  resource: 'food' | 'wood' | 'stone',
  direction: 'buy' | 'sell',
  amount: number,
  quoteDay: number,
) => order('trade', { resource, direction, amount, quoteDay });

/**
 * Uma partida com o Mercado recém-inaugurado: a obra é a do motor, pedida por ordem. O Conselho
 * fica em recesso e a Horda, calada, para os eventos e o ouro serem só os do Mercado. Sobram
 * 400 de comida, 250 de madeira, 300 de pedra e 1.850 de ouro, com a Despensa e o Pátio
 * guardando 500 de cada.
 */
async function openMarket(name: string) {
  const player = await newPlayer(server, name);
  const gameId = player.game.id;
  await quietHorde(server, gameId);
  await councilRecess(server, gameId);
  await tavernSite(server, gameId, 2_000);
  const before = await viewOf(player.token, gameId);
  expect(before.market).toMatchObject({ level: 0, prices: [], nextChangeInSeconds: null });
  const built = await send<CommandAccepted>(
    server,
    player.token,
    gameId,
    order('startConstruction', { building: 'market' }),
  );
  expect(built.status).toBe(200);
  // A obra leva 15 minutos; dezesseis depois o Mercado está aberto, ainda no primeiro dia.
  server.clock.advance(16 * MINUTE);
  await renew(server, player);
  return { player, gameId };
}

describe('negociar no Mercado e reenviar a ordem', () => {
  it('sem Mercado a ordem é recusada com o que o abre, e a forma errada nem chega ao motor', async () => {
    const player = await newPlayer(server, 'Aldonça');
    const gameId = player.game.id;
    const refused = await send<Rejected>(
      server,
      player.token,
      gameId,
      trade('wood', 'sell', 10, 0),
    );
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'Erga o Mercado primeiro: ele abre com o Salão do Senhor Nv3.',
      details: { code: 'MARKET_REQUIRED' },
    });
    for (const payload of [
      { resource: 'gold', direction: 'sell', amount: 10, quoteDay: 0 },
      { resource: 'wood', direction: 'barter', amount: 10, quoteDay: 0 },
      { resource: 'wood', direction: 'sell', amount: 1.5, quoteDay: 0 },
      { resource: 'wood', direction: 'sell', amount: 10 },
      { resource: 'wood', direction: 'sell', amount: 10, quoteDay: 0, unitPrice: 9000 },
    ]) {
      const malformed = await send<ApiError>(
        server,
        player.token,
        gameId,
        order('trade', payload as never),
      );
      expect(malformed.status, JSON.stringify(payload)).toBe(400);
    }
    expect(await countRows(server.pool, 'commands', `game_id = '${gameId}'`)).toBe(1);
  });

  it('uma venda, um recibo: o duplo clique não vende duas vezes, e a outra aba encontra o volume gasto, com o que ainda cabe', async () => {
    const { player, gameId } = await openMarket('Briolanja');
    const before = await viewOf(player.token, gameId);
    expect(before.market).toMatchObject({ level: 1, quoteDay: 0, dailyVolume: 200 });
    expect(before.market.prices.map((row) => [row.resource, row.buy, row.sell])).toEqual([
      ['food', 1000, 850],
      ['wood', 1200, 1020],
      ['stone', 2000, 1700],
    ]);
    // Falta 1 h 44 min para o dia virar.
    expect(before.market.nextChangeInSeconds).toBe(104 * 60);
    expect(rowOf(before, 'wood')).toMatchObject({
      remainingToday: 200,
      maxSellable: 200,
      trend: 'flat',
    });

    const sale = trade('wood', 'sell', 150, before.market.quoteDay);
    const original = await send<CommandAccepted>(server, player.token, gameId, sale);
    expect(original.status).toBe(200);
    expect(original.headers['x-lords-replayed']).toBeUndefined();
    expect(original.body.events.map((event) => event.type)).toEqual(['marketTraded']);
    expect(original.body.events[0]?.data).toEqual({
      resource: 'wood',
      direction: 'sell',
      amount: 150,
      unitPrice: 1020,
      gold: 153_000,
      quoteDay: 0,
      remainingToday: 50,
      spent_wood: 150,
      gained_gold: 153,
    });
    expect(original.body.events[0]?.text).toContain('vendeu no Mercado 150 de madeira, por 153');
    expect(stockOf(original.body.view, 'gold') - stockOf(before, 'gold')).toBe(153);
    expect(stockOf(before, 'wood') - stockOf(original.body.view, 'wood')).toBe(150);
    expect(rowOf(original.body.view, 'wood')).toMatchObject({
      tradedToday: 150,
      remainingToday: 50,
    });

    // O duplo clique: a mesma ordem, com o mesmo commandId, devolve o recibo sem reaplicar.
    server.clock.advance(2 * MINUTE);
    const replay = await send<CommandAccepted>(server, player.token, gameId, sale);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);
    const after = await viewOf(player.token, gameId);
    expect(stockOf(after, 'gold')).toBe(stockOf(original.body.view, 'gold'));
    expect(rowOf(after, 'wood').tradedToday).toBe(150);

    // A outra aba, com a visão velha: outro commandId, e o volume do dia já foi quase todo.
    const other = await send<Rejected>(
      server,
      player.token,
      gameId,
      trade('wood', 'sell', 100, before.market.quoteDay),
    );
    expect(other.status).toBe(422);
    expect(other.body).toMatchObject({
      code: 'GAME_RULE',
      message:
        'O Mercado Nv1 negocia 200 de madeira por dia, entre compras e vendas: hoje ainda cabem 50.',
      details: { code: 'DAILY_VOLUME_EXCEEDED' },
    });
    // A recusa traz a visão de agora: é dela que a tela tira o que ainda cabe.
    expect(rowOf(other.body.details.view, 'wood')).toMatchObject({
      remainingToday: 50,
      maxSellable: 50,
    });
    // O que cabe passa, e a unidade seguinte já não: a compra conta no mesmo volume.
    const rest = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      trade('wood', 'sell', 50, 0),
    );
    expect(rest.status).toBe(200);
    const oneMore = await send<Rejected>(server, player.token, gameId, trade('wood', 'buy', 1, 0));
    expect(oneMore.status).toBe(422);
    expect(oneMore.body.details.code).toBe('DAILY_VOLUME_EXCEEDED');
    expect(oneMore.body.message).toContain('hoje não cabe mais nada');

    // Duas vendas aceitas, duas recusas: os recibos estão todos no banco.
    expect(
      await countRows(
        server.pool,
        'commands',
        `game_id = '${gameId}' and type = 'trade' and response_status = 200`,
      ),
    ).toBe(2);
    expect(
      await countRows(server.pool, 'commands', `game_id = '${gameId}' and type = 'trade'`),
    ).toBe(4);
    expect(
      await countRows(
        server.pool,
        'game_events',
        `game_id = '${gameId}' and kind = 'marketTraded'`,
      ),
    ).toBe(2);
  });

  it('a compra até o limite do depósito passa, e a que não cabe é recusada inteira', async () => {
    const { player, gameId } = await openMarket('Constança');
    const before = await viewOf(player.token, gameId);
    // O Pátio guarda 500 de pedra e o feudo tem 300: cabem 200, que é também o volume do dia.
    expect(stockOf(before, 'stone')).toBe(300);
    expect(rowOf(before, 'stone').maxBuyable).toBe(200);
    // A comida: a Despensa guarda 500, e o feudo tem quase 400.
    const food = rowOf(before, 'food');
    expect(food.maxBuyable).toBeLessThan(200);
    const tooMuch = await send<Rejected>(
      server,
      player.token,
      gameId,
      trade('food', 'buy', food.maxBuyable + 1, 0),
    );
    expect(tooMuch.status).toBe(422);
    expect(tooMuch.body.details.code).toBe('STORAGE_FULL');
    expect(tooMuch.body.message).toBe(
      `A compra não cabe: a Despensa guarda 500 de comida, e só cabem mais ${food.maxBuyable}.`,
    );
    // Nada foi comprado: nem um pedaço.
    expect(rowOf(tooMuch.body.details.view, 'food').tradedToday).toBe(0);
    const fits = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      trade('food', 'buy', food.maxBuyable, 0),
    );
    expect(fits.status).toBe(200);
    expect(fits.body.events[0]?.data).toMatchObject({
      direction: 'buy',
      amount: food.maxBuyable,
      spent_gold: food.maxBuyable,
      gained_food: food.maxBuyable,
    });
    expect(stockOf(before, 'gold') - stockOf(fits.body.view, 'gold')).toBe(food.maxBuyable);
    expect(rowOf(fits.body.view, 'food').maxBuyable).toBe(0);
  });
});

describe('o dia virou entre a cotação e a ordem (QA-09)', () => {
  it('o reenvio depois da virada devolve o recibo original, e a ordem nova com a cotação de ontem é recusada com a visão de hoje', async () => {
    const { player, gameId } = await openMarket('Dulce');
    const yesterday = await viewOf(player.token, gameId);
    const sale = trade('stone', 'sell', 200, yesterday.market.quoteDay);
    const original = await send<CommandAccepted>(server, player.token, gameId, sale);
    expect(original.status).toBe(200);
    expect(rowOf(original.body.view, 'stone').remainingToday).toBe(0);

    // Duas horas depois o dia de jogo virou: o preço andou, e o volume voltou.
    server.clock.advance(2 * HOUR);
    await renew(server, player);

    // O reenvio da ordem de ontem, com o mesmo commandId: o recibo de ontem, sem negociar de novo.
    const replay = await send<CommandAccepted>(server, player.token, gameId, sale);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);

    // Uma ordem nova com a tela de ontem: recusada, com a visão de hoje nos detalhes.
    const stale = await send<Rejected>(
      server,
      player.token,
      gameId,
      trade('stone', 'sell', 50, yesterday.market.quoteDay),
    );
    expect(stale.status).toBe(422);
    expect(stale.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
      details: { code: 'PRICE_CHANGED' },
    });
    const today = stale.body.details.view;
    expect(today.market.quoteDay).toBe(2);
    expect(rowOf(today, 'stone')).toMatchObject({ tradedToday: 0, remainingToday: 200 });
    // O preço de hoje fica a até 5% do de ontem (2,00): entre 1,90 e 2,10.
    const { buy, sell } = rowOf(today, 'stone');
    expect(buy).toBeGreaterThanOrEqual(1900);
    expect(buy).toBeLessThanOrEqual(2100);
    expect(sell).toBe(Math.floor((buy * 17) / 20));
    expect(await viewOf(player.token, gameId)).toEqual(today);

    // A mesma venda com a cotação de hoje vale, pelo preço de hoje.
    const fresh = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      trade('stone', 'sell', 50, today.market.quoteDay),
    );
    expect(fresh.status).toBe(200);
    expect(fresh.body.events[0]?.data).toMatchObject({
      quoteDay: 2,
      unitPrice: sell,
      gold: 50 * sell,
      remainingToday: 150,
    });
    // Só duas vendas aconteceram: a de ontem e a de hoje.
    expect(
      await countRows(
        server.pool,
        'game_events',
        `game_id = '${gameId}' and kind = 'marketTraded'`,
      ),
    ).toBe(2);
  });
});

describe('o que o Mercado não mostra (QA-18)', () => {
  it('nem o preço de ontem, nem o de amanhã, nem o gerador saem pela API; a Crônica conta as negociações e não a mudança de todo dia', async () => {
    const { player, gameId } = await openMarket('Elvira');
    await send(server, player.token, gameId, trade('wood', 'sell', 30, 0));
    // Cinco dias de jogo: cinco passeios do preço.
    server.clock.advance(10 * HOUR + 5 * MINUTE);
    await renew(server, player);
    const view = await viewOf(player.token, gameId);
    expect(view.market.quoteDay).toBe(6);
    await send(server, player.token, gameId, trade('stone', 'buy', 5, view.market.quoteDay));
    const events = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: player.token,
    });
    const chronicle = await call<ChronicleResponse>(server, 'GET', `/games/${gameId}/chronicle`, {
      token: player.token,
    });
    const stored = await server.pool.query<{
      state: { market: unknown; rng: { market: number[] } };
    }>('select state from games where id = $1', [gameId]);
    const state = stored.rows[0]?.state;
    expect(state?.rng.market).toHaveLength(4);
    for (const body of [view, events.body, chronicle.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toMatch(/"(previousPrices|rng|ids|basePrice|sellRatio)"/);
      for (const word of state?.rng.market ?? []) {
        expect(text).not.toContain(String(word));
      }
    }
    const types = events.body.events.map((event) => event.type);
    expect(types.filter((type) => type === 'marketTraded')).toHaveLength(2);
    // Cinco viradas, e nenhuma linha por causa do preço: ele ficou longe das marcas.
    expect(types.filter((type) => type === 'marketPriceSwing')).toEqual([]);
    const lines = chronicle.body.entries.map((entry) => entry.text).join('\n');
    expect(lines).toContain('vendeu no Mercado 30 de madeira');
    expect(lines).toContain('comprou no Mercado 5 de pedra');
  });
});
