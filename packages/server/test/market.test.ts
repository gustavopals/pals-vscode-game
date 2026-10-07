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
  enlistHeroes,
  HOUR,
  MINUTE,
  newPlayer,
  order,
  quietHorde,
  renew,
  rewriteState,
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

// As caravanas pela API (roadmap da v0.3, V3E-T2.6; QA-10 e QA-18): o envio e o reenvio, o lugar
// na estrada visto de outra aba, o herói da escolta fora do feudo, a chegada com o relógio
// adiantado e o que não sai do servidor antes dela.

const caravan = (
  resource: 'food' | 'wood' | 'stone',
  amount: number,
  escortHeroId: string | null = null,
  quoteDay = 0,
) => order('sendCaravan', { resource, amount, escortHeroId, quoteDay });

/**
 * Uma partida com o Mercado no nível 2, posto direto no banco, e Edda a serviço do feudo. O
 * Conselho fica em recesso e a Horda, calada. Sobram 400 de comida, de madeira e de pedra e
 * 2.000 de ouro; os preços estão na base.
 */
async function caravanPost(name: string, tower = 0) {
  const player = await newPlayer(server, name);
  const gameId = player.game.id;
  await quietHorde(server, gameId);
  await councilRecess(server, gameId);
  await tavernSite(server, gameId, 2_000);
  await enlistHeroes(server, gameId, [{ name: 'Edda', gender: 'f' }]);
  await rewriteState(server, gameId, (state) => {
    state.settlement.buildings.market = 2;
    state.settlement.buildings.watchtower = tower;
  });
  return { player, gameId };
}

describe('enviar uma caravana e reenviar a ordem (QA-10)', () => {
  it('sem o Mercado no nível 2 a ordem é recusada dizendo o nível, e a forma errada nem chega ao motor', async () => {
    const player = await newPlayer(server, 'Florbela');
    const gameId = player.game.id;
    const refused = await send<Rejected>(server, player.token, gameId, caravan('wood', 10));
    expect(refused.status).toBe(422);
    expect(refused.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'As caravanas pedem o Mercado no nível 2: o feudo ainda não o tem.',
      details: { code: 'MARKET_LEVEL_REQUIRED' },
    });
    expect(refused.body.details.view.market.caravanOffer).toMatchObject({
      available: false,
      blockedReason: 'As caravanas pedem o Mercado no nível 2: o feudo ainda não o tem.',
    });
    for (const payload of [
      { resource: 'gold', amount: 10, escortHeroId: null, quoteDay: 0 },
      { resource: 'wood', amount: 1.5, escortHeroId: null, quoteDay: 0 },
      { resource: 'wood', amount: 10, quoteDay: 0 },
      { resource: 'wood', amount: 10, escortHeroId: null },
      { resource: 'wood', amount: 10, escortHeroId: null, quoteDay: 0, unitPrice: 9000 },
      { resource: 'wood', amount: 10, escortHeroId: null, quoteDay: 0, ambushed: false },
    ]) {
      const malformed = await send<ApiError>(server, player.token, gameId, {
        ...caravan('wood', 10),
        payload,
      } as never);
      expect(malformed.status, JSON.stringify(payload)).toBe(400);
    }
  });

  it('um envio, um recibo: o duplo clique manda uma caravana só, a outra aba encontra a estrada cheia, e a chegada devolve o ouro e a escolta', async () => {
    const { player, gameId } = await caravanPost('Guiomar', 1);
    const before = await viewOf(player.token, gameId);
    expect(before.market.caravans).toEqual([]);
    expect(before.market.caravanOffer).toMatchObject({
      available: true,
      blockedReason: null,
      destination: 'Porto do Rio',
      maxUnits: 300,
      tripSeconds: 4 * 3600,
      riskPercent: 5,
      riskBreakdown: '10% na estrada, −5 pela Torre de Vigia Nv1; com escolta, nenhum.',
      slots: 1,
      slotsInUse: 0,
      eligibleEscortIds: ['hero-1'],
    });
    expect(
      before.market.caravanOffer.resources.map((row) => [row.resource, row.unitPrice]),
    ).toEqual([
      ['food', 977],
      ['wood', 1173],
      ['stone', 1955],
    ]);

    const shipment = caravan('wood', 200, 'hero-1');
    const original = await send<CommandAccepted>(server, player.token, gameId, shipment);
    expect(original.status).toBe(200);
    expect(original.headers['x-lords-replayed']).toBeUndefined();
    expect(original.body.events.map((event) => event.type)).toEqual(['caravanSent']);
    expect(original.body.events[0]?.data).toMatchObject({
      caravanId: 'caravan-1',
      resource: 'wood',
      amount: 200,
      unitPrice: 1173,
      escorted: 1,
      heroId: 'hero-1',
      spent_wood: 200,
    });
    expect(original.body.events[0]?.text).toContain('rumo a Porto do Rio, com 200 de madeira');
    // A carga saiu do estoque; o ouro ainda não entrou (só o soldo saiu).
    expect(stockOf(before, 'wood') - stockOf(original.body.view, 'wood')).toBe(200);
    expect(stockOf(original.body.view, 'gold')).toBeLessThanOrEqual(stockOf(before, 'gold'));
    expect(original.body.view.market.caravans).toEqual([
      expect.objectContaining({
        id: 'caravan-1',
        cargoText: '200 de madeira',
        unitPrice: 1173,
        goldText: '285,6',
        arrivesInSeconds: 4 * 3600,
        escortName: 'Edda',
      }),
    ]);
    // A caravana não conta no volume do dia.
    expect(rowOf(original.body.view, 'wood')).toMatchObject({ tradedToday: 0 });
    const escort = original.body.view.guild.heroes[0];
    expect(escort).toMatchObject({ atHome: false, canDepart: false });
    expect(escort?.statusText).toBe('Escolta a caravana: volta em 4 h');

    // O duplo clique: a mesma ordem, com o mesmo commandId, devolve o recibo sem reaplicar.
    server.clock.advance(2 * MINUTE);
    const replay = await send<CommandAccepted>(server, player.token, gameId, shipment);
    expect(replay.status).toBe(200);
    expect(replay.headers['x-lords-replayed']).toBe('true');
    expect(replay.body).toEqual(original.body);
    const after = await viewOf(player.token, gameId);
    expect(after.market.caravans).toHaveLength(1);
    expect(stockOf(after, 'wood')).toBe(stockOf(original.body.view, 'wood'));

    // A outra aba, com a visão velha: outro commandId, e a estrada já está ocupada.
    const other = await send<Rejected>(server, player.token, gameId, caravan('stone', 50));
    expect(other.status).toBe(422);
    expect(other.body).toMatchObject({
      code: 'GAME_RULE',
      details: { code: 'CARAVAN_LIMIT' },
    });
    expect(other.body.message).toContain('O Mercado Nv2 mantém 1 caravana na estrada por vez');
    expect(other.body.details.view.market.caravanOffer).toMatchObject({
      available: false,
      slotsInUse: 1,
      eligibleEscortIds: [],
    });
    expect(stockOf(other.body.details.view, 'stone')).toBe(stockOf(before, 'stone'));
    // Quem escolta não é dispensado antes de voltar.
    const dismissed = await send<Rejected>(
      server,
      player.token,
      gameId,
      order('dismissHero', { heroId: 'hero-1' }),
    );
    expect(dismissed.status).toBe(422);
    expect(dismissed.body.details.code).toBe('HERO_BUSY');

    // Um minuto antes da chegada a carga ainda está na estrada.
    server.clock.advance(4 * HOUR - 3 * MINUTE);
    await renew(server, player);
    const almost = await viewOf(player.token, gameId);
    expect(almost.market.caravans).toHaveLength(1);
    expect(almost.market.caravans[0]?.arrivesInSeconds).toBe(60);
    // O relógio passa da chegada: a leitura seguinte a resolve, no instante dela.
    server.clock.advance(11 * MINUTE);
    const arrived = await viewOf(player.token, gameId);
    expect(arrived.market.caravans).toEqual([]);
    expect(arrived.market.caravanOffer).toMatchObject({ available: true, slotsInUse: 0 });
    expect(arrived.guild.heroes[0]).toMatchObject({ atHome: true, statusText: 'No feudo' });
    const events = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: player.token,
    });
    const arrivals = events.body.events.filter((event) => event.type.startsWith('caravan'));
    expect(arrivals.map((event) => event.type)).toEqual(['caravanSent', 'caravanArrived']);
    // O preço é o fixado no envio, com duas viradas de dia no caminho.
    expect(arrivals[1]?.data).toMatchObject({
      caravanId: 'caravan-1',
      amount: 200,
      sold: 200,
      unitPrice: 1173,
      gold: 285_600,
      gained_gold: 285.6,
      escorted: 1,
    });
    expect(arrived.market.quoteDay).toBe(3);
    expect(arrivals[1]?.text).toContain('Edda, que a escoltava, está de volta');

    // Um envio aceito, um recibo; o reenvio não gravou outro, e a recusa tem o dela.
    expect(
      await countRows(
        server.pool,
        'commands',
        `game_id = '${gameId}' and type = 'sendCaravan' and response_status = 200`,
      ),
    ).toBe(1);
    expect(
      await countRows(server.pool, 'commands', `game_id = '${gameId}' and type = 'sendCaravan'`),
    ).toBe(2);
    expect(
      await countRows(server.pool, 'game_events', `game_id = '${gameId}' and kind = 'caravanSent'`),
    ).toBe(1);
    expect(
      await countRows(
        server.pool,
        'game_events',
        `game_id = '${gameId}' and kind = 'caravanArrived'`,
      ),
    ).toBe(1);
  });
  it('o dia virou entre a tela e o envio (E-15): a ordem com a cotação de ontem é recusada com a visão de hoje, e nada sai do estoque; com a de hoje, vale', async () => {
    const { player, gameId } = await caravanPost('Teodora');
    const yesterday = await viewOf(player.token, gameId);
    server.clock.advance(2 * HOUR);
    await renew(server, player);
    const stale = await send<Rejected>(
      server,
      player.token,
      gameId,
      caravan('wood', 100, null, yesterday.market.quoteDay),
    );
    expect(stale.status).toBe(422);
    expect(stale.body).toMatchObject({
      code: 'GAME_RULE',
      message: 'O dia virou e o preço do Mercado mudou: confira o preço de hoje e peça de novo.',
      details: { code: 'PRICE_CHANGED' },
    });
    const today = stale.body.details.view;
    expect(today.market.quoteDay).toBeGreaterThan(yesterday.market.quoteDay);
    expect(today.market.caravans).toEqual([]);
    expect(stockOf(today, 'wood')).toBeGreaterThanOrEqual(stockOf(yesterday, 'wood'));
    const fresh = await send<CommandAccepted>(
      server,
      player.token,
      gameId,
      caravan('wood', 100, null, today.market.quoteDay),
    );
    expect(fresh.status).toBe(200);
    expect(fresh.body.view.market.caravans).toHaveLength(1);
  });
});

describe('o que a caravana não mostra antes de chegar (QA-18)', () => {
  it('sem escolta, o desfecho só existe na chegada: nem a visão, nem os eventos, nem a Crônica, nem o estado gravado o trazem antes', async () => {
    const { player, gameId } = await caravanPost('Honorata');
    const sent = await send<CommandAccepted>(server, player.token, gameId, caravan('stone', 300));
    expect(sent.status).toBe(200);
    expect(sent.body.view.market.caravans[0]).toMatchObject({ escortName: null, amount: 300 });
    server.clock.advance(3 * HOUR + 50 * MINUTE);
    await renew(server, player);
    const view = await viewOf(player.token, gameId);
    const events = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: player.token,
    });
    const chronicle = await call<ChronicleResponse>(server, 'GET', `/games/${gameId}/chronicle`, {
      token: player.token,
    });
    const stored = await server.pool.query<{
      state: {
        market: { caravans: Array<Record<string, unknown>> };
        rng: Record<string, unknown>;
        ids: Record<string, number>;
      };
    }>('select state from games where id = $1', [gameId]);
    const state = stored.rows[0]?.state;
    // O estado gravado tem a caravana e mais nada dela: nem o desfecho, nem o fluxo do sorteio.
    expect(state?.market.caravans).toHaveLength(1);
    expect(Object.keys(state?.market.caravans[0] ?? {}).sort()).toEqual([
      'amount',
      'arrivesAtMs',
      'escortHeroId',
      'id',
      'resource',
      'unitPrice',
    ]);
    expect(Object.keys(state?.rng ?? {}).filter((key) => key.startsWith('caravan:'))).toEqual([]);
    expect(state?.ids.caravan).toBe(1);
    for (const body of [view, events.body, chronicle.body]) {
      const text = JSON.stringify(body);
      expect(text).not.toMatch(/"(rng|ids|priceRatio|lossRatio|basePercent|ambushed|lost)"/);
      expect(text).not.toMatch(/caravanAmbushed|caravanArrived/);
    }
    expect(Object.keys(view.market.caravans[0] ?? {})).not.toEqual(
      expect.arrayContaining(['ambushed', 'outcome', 'lost']),
    );

    // Dez minutos depois, a chegada: uma linha só, a da venda inteira ou a da emboscada, com
    // as quantidades exatas, e a carga inteira ou a metade dela vendida pelo preço fixado.
    server.clock.advance(11 * MINUTE);
    const after = await viewOf(player.token, gameId);
    expect(after.market.caravans).toEqual([]);
    const later = await call<EventsResponse>(server, 'GET', `/games/${gameId}/events`, {
      token: player.token,
    });
    const endings = later.body.events.filter(
      (event) => event.type === 'caravanArrived' || event.type === 'caravanAmbushed',
    );
    expect(endings).toHaveLength(1);
    const [ending] = endings;
    if (ending?.type === 'caravanAmbushed') {
      expect(ending.data).toMatchObject({ lost: 150, sold: 150, gold: 150 * 1955 });
    } else {
      expect(ending?.data).toMatchObject({ sold: 300, gold: 300 * 1955, escorted: 0 });
    }
    const final = await server.pool.query<{ state: { rng: Record<string, unknown> } }>(
      'select state from games where id = $1',
      [gameId],
    );
    expect(
      Object.keys(final.rows[0]?.state.rng ?? {}).filter((key) => key.startsWith('caravan:')),
    ).toEqual([]);
  });
});
