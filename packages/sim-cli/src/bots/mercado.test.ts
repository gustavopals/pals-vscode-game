import {
  applyCommand,
  type Command,
  createInitialState,
  deriveViewState,
  type GameState,
  type ViewState,
} from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { simulate } from '../simulate';
import { summarize } from '../report';
import { economicoPolicies } from './economico';
import {
  comprarLenha,
  erguerMercado,
  especular,
  mandarCaravana,
  venderExcedente,
} from './policies';
import { preguicosoPolicies } from './preguicoso';
import type { Act } from './types';

type Order = { type: string; payload: unknown };

const HOUR = 3_600_000;
const DAY = 2 * HOUR;
const AUTUMN = 48 * DAY;

/** Um feudo com o Salão no nível 3, o Armazém e o Celeiro erguidos e o Mercado no nível pedido. */
function feud(edit: (state: GameState) => void = () => {}, atMs = 10 * DAY + HOUR): GameState {
  const state = createInitialState('mercado-bot', {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale: 1,
  });
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  Object.assign(state.settlement.buildings, { townHall: 3, granary: 1, warehouse: 1, market: 1 });
  Object.assign(state.settlement.resources, {
    food: 400_000,
    wood: 400_000,
    stone: 400_000,
    gold: 500_000,
  });
  state.settlement.population.villagers = 12;
  state.council.nextDrawAtMs = 1000 * 84 * DAY;
  edit(state);
  return state;
}

/** Um `act` que joga no motor de verdade e anota as ordens aceitas e as recusas. */
function player(start: GameState): {
  view: ViewState;
  act: Act;
  orders: Order[];
  refused: string[];
  state: () => GameState;
} {
  let state = start;
  const orders: Order[] = [];
  const refused: string[] = [];
  const look = () => deriveViewState(state, state.lastProcessedAt);
  const act: Act = async (type, payload) => {
    const command = { commandId: `t-${orders.length + refused.length}`, type, payload } as Command;
    const result = applyCommand(state, command, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
      orders.push({ type, payload });
    } else {
      refused.push(result.code);
    }
    return look();
  };
  return { view: look(), act, orders, refused, state: () => state };
}

describe('vender o excedente (V3E-T1.7)', () => {
  it('sem Mercado não dá ordem nenhuma', async () => {
    const game = player(feud((state) => (state.settlement.buildings.market = 0)));
    expect(game.view.market.prices).toEqual([]);
    await venderExcedente.run(game.view, game.act);
    expect([...game.orders, ...game.refused]).toEqual([]);
  });

  it('com o depósito longe de encher não vende nada', async () => {
    const game = player(feud());
    expect(game.view.resources.every((row) => !row.full)).toBe(true);
    await venderExcedente.run(game.view, game.act);
    expect(game.orders).toEqual([]);
  });

  it('vende o recurso que está no limite, até o volume do dia, com a cotação da visão, e nunca é recusado', async () => {
    // O Armazém Nv1 guarda 1.000 de madeira e está cheio, com seis lenhadores produzindo para
    // o chão (em 8 horas reais iria ao chão mais do que o volume do dia); a pedra está pela
    // metade.
    const game = player(
      feud((state) => {
        state.settlement.resources.wood = 1_000_000;
        state.settlement.workers.lumberMill = 6;
      }),
    );
    const wood = game.view.resources.find((row) => row.id === 'wood');
    expect(wood).toMatchObject({ full: true });
    expect(wood?.wastingPerHour).toBeGreaterThan(0);
    const after = await venderExcedente.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders).toEqual([
      {
        type: 'trade',
        payload: { resource: 'wood', direction: 'sell', amount: 200, quoteDay: 0 },
      },
    ]);
    // O volume de hoje acabou: outra passada não vende mais nada.
    expect(after.market.prices.find((row) => row.resource === 'wood')?.remainingToday).toBe(0);
    await venderExcedente.run(after, game.act);
    expect(game.orders).toHaveLength(1);
    expect(game.refused).toEqual([]);
  });

  it('da comida guarda metade do que o Celeiro guarda, e do que enche em menos de 8 horas vende só o que iria ao chão', async () => {
    // O Celeiro Nv1 guarda 1.000: com 900 e a Fazenda rendendo, enche em poucas horas.
    const game = player(
      feud((state) => {
        state.settlement.resources.food = 900_000;
        state.settlement.workers.farm = 6;
      }),
    );
    const food = game.view.resources.find((row) => row.id === 'food');
    expect(food?.full).toBe(false);
    expect(food?.fullInSeconds).toBeLessThan(8 * 3600);
    await venderExcedente.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders).toHaveLength(1);
    const [sale] = game.orders as Array<{ payload: { resource: string; amount: number } }>;
    expect(sale?.payload.resource).toBe('food');
    // 900 − 500 guardados = 400 de sobra, mas o volume do dia é de 200.
    expect(sale?.payload.amount).toBe(200);
    expect(game.state().settlement.resources.food).toBe(700_000);
  });
});

describe('comprar lenha (V3E-T1.7)', () => {
  it('fora do outono e do inverno, ou com a conta da lenha fechando, não compra', async () => {
    const spring = player(feud());
    await comprarLenha.run(spring.view, spring.act);
    expect(spring.orders).toEqual([]);
    const stocked = player(
      feud(
        (state) => {
          state.settlement.buildings.warehouse = 5;
          state.settlement.resources.wood = 3_000_000;
        },
        AUTUMN + 20 * DAY + HOUR,
      ),
    );
    expect(stocked.view.calendar.nextSeason.firewood?.missing).toBe(0);
    await comprarLenha.run(stocked.view, stocked.act);
    expect(stocked.orders).toEqual([]);
  });

  it('no outono, com a lenha do inverno faltando, compra o que falta até o volume do dia, o ouro e o depósito', async () => {
    const game = player(
      feud(
        (state) => {
          state.settlement.resources.wood = 20_000;
        },
        AUTUMN + 20 * DAY + HOUR,
      ),
    );
    const missing = game.view.calendar.nextSeason.firewood?.missing ?? 0;
    expect(missing).toBeGreaterThan(0);
    const wood = game.view.market.prices.find((row) => row.resource === 'wood');
    await comprarLenha.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders).toEqual([
      {
        type: 'trade',
        payload: {
          resource: 'wood',
          direction: 'buy',
          amount: Math.min(wood?.maxBuyable ?? 0, Math.ceil(missing)),
          quoteDay: 0,
        },
      },
    ]);
    expect(game.state().settlement.resources.wood).toBeGreaterThan(20_000);
  });

  it('sem ouro não dá ordem: a visão diz que não cabe nada', async () => {
    const game = player(
      feud(
        (state) => {
          Object.assign(state.settlement.resources, { wood: 20_000, gold: 0 });
        },
        AUTUMN + 20 * DAY + HOUR,
      ),
    );
    await comprarLenha.run(game.view, game.act);
    expect([...game.orders, ...game.refused]).toEqual([]);
  });
});

describe('erguer o Mercado (V3E-T1.7)', () => {
  it('ergue o Mercado assim que o jogo deixa, e antes do Salão no nível 3 o deixa planejado', async () => {
    const open = player(feud((state) => (state.settlement.buildings.market = 0)));
    await erguerMercado.run(open.view, open.act);
    expect(open.orders).toEqual([{ type: 'startConstruction', payload: { building: 'market' } }]);
    const early = player(
      feud((state) => Object.assign(state.settlement.buildings, { townHall: 2, market: 0 })),
    );
    await erguerMercado.run(early.view, early.act);
    expect(early.refused).toEqual([]);
    expect(early.orders).toEqual([
      {
        type: 'planConstruction',
        payload: { building: 'market', autoStart: true, targetLevel: 1 },
      },
    ]);
  });

  it('só o melhora quando o volume do dia acabou em algum recurso', async () => {
    const idle = player(feud());
    await erguerMercado.run(idle.view, idle.act);
    expect(idle.orders).toEqual([]);
    const spent = player(feud((state) => (state.market.tradedToday.wood = 200)));
    await erguerMercado.run(spent.view, spent.act);
    expect(spent.refused).toEqual([]);
    expect(spent.orders).toEqual([{ type: 'startConstruction', payload: { building: 'market' } }]);
  });

  it('o econômico tem as três políticas do Mercado, e o preguiçoso, nenhuma', () => {
    const names = (policies: typeof economicoPolicies) => policies.map((policy) => policy.name);
    for (const name of ['vender o excedente', 'erguer o Mercado', 'comprar lenha']) {
      expect(names(economicoPolicies)).toContain(name);
      expect(names(preguicosoPolicies)).not.toContain(name);
    }
  });
});

describe('o Mercado em uma partida inteira', () => {
  it('o econômico ergue o Mercado, negocia sem recusa e o resumo mede o que foi vendido; o preguiçoso não o ergue', async () => {
    const economico = await simulate({
      seed: 'pedra-alta-003',
      days: 7,
      strategy: 'economico',
      sessionsPerDay: 4,
      timeScale: 1,
    });
    const summary = summarize(economico);
    expect(economico.commands.refused).toEqual({});
    expect(summary.market.level).toBeGreaterThanOrEqual(1);
    expect(summary.market.atHour).not.toBeNull();
    const traded = economico.events.filter((event) => event.type === 'marketTraded');
    expect(traded.length).toBeGreaterThan(0);
    const sold = traded
      .filter((event) => event.data.direction === 'sell')
      .reduce((sum, event) => sum + Number(event.data.amount), 0);
    expect(summary.market.sold.food + summary.market.sold.wood + summary.market.sold.stone).toBe(
      sold,
    );
    expect(summary.market.offered).toBeGreaterThan(0);
    expect(summary.market.volumeUsedPercent).toBeGreaterThan(0);
    expect(summary.market.volumeUsedPercent).toBeLessThanOrEqual(100);
    // Nunca mais do que o volume de um dia por visita e por recurso.
    for (const event of traded) {
      expect(Number(event.data.amount)).toBeLessThanOrEqual(200 * summary.market.level);
    }

    const preguicoso = await simulate({
      seed: 'pedra-alta-003',
      days: 7,
      strategy: 'preguicoso',
      sessionsPerDay: 1,
      timeScale: 1,
    });
    expect(summarize(preguicoso).market).toMatchObject({
      level: 0,
      atHour: null,
      offered: 0,
      volumeUsedPercent: null,
    });
    expect(preguicoso.events.filter((event) => event.type.startsWith('market'))).toEqual([]);
  });
});

/** Põe Edda a serviço do feudo, pronta. */
function enlist(state: GameState, name = 'Edda'): void {
  const number = state.guild.heroes.length + 1;
  state.ids.hero = number;
  state.guild.heroes.push({
    id: `hero-${number}`,
    name,
    gender: 'f',
    classId: 'warrior',
    level: 1,
    xp: 0,
    traits: [],
    status: 'idle',
    injury: null,
    captivity: null,
    equipment: { weapon: null, armor: null, accessory: null },
    joinedAtMs: 0,
    freedAtMs: null,
    discontent: false,
  });
}

/** O Armazém cheio de madeira, com seis lenhadores produzindo para o chão, e o Mercado no nível 2. */
const woodToSpare = (edit: (state: GameState) => void = () => {}) =>
  feud((state) => {
    state.settlement.buildings.market = 2;
    state.settlement.resources.wood = 1_000_000;
    state.settlement.workers.lumberMill = 6;
    edit(state);
  });

describe('mandar caravana (V3E-T2.5)', () => {
  it('sem o Mercado no nível das caravanas não dá ordem nenhuma', async () => {
    const game = player(
      woodToSpare((state) => {
        state.settlement.buildings.market = 1;
        enlist(state);
      }),
    );
    expect(game.view.market.caravanOffer.available).toBe(false);
    await mandarCaravana.run(game.view, game.act);
    expect([...game.orders, ...game.refused]).toEqual([]);
  });

  it('com um herói ocioso, manda o excedente com ele de escolta, até o que a visão diz que cabe, e nunca é recusado', async () => {
    const game = player(woodToSpare(enlist));
    expect(game.view.market.caravanOffer).toMatchObject({
      available: true,
      eligibleEscortIds: ['hero-1'],
    });
    const after = await mandarCaravana.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders).toEqual([
      {
        type: 'sendCaravan',
        payload: { resource: 'wood', amount: 300, escortHeroId: 'hero-1', quoteDay: 0 },
      },
    ]);
    expect(after.market.caravans).toHaveLength(1);
    expect(after.market.caravans[0]).toMatchObject({ amount: 300, escortName: 'Edda' });
    // A estrada está cheia: outra passada não manda mais nada, e não é recusada.
    await mandarCaravana.run(after, game.act);
    expect(game.orders).toHaveLength(1);
    expect(game.refused).toEqual([]);
  });

  it('sem herói, só manda com a Torre de Vigia no nível 2, e sem escolta', async () => {
    for (const tower of [0, 1]) {
      const game = player(woodToSpare((state) => (state.settlement.buildings.watchtower = tower)));
      await mandarCaravana.run(game.view, game.act);
      expect([...game.orders, ...game.refused], `Torre ${tower}`).toEqual([]);
    }
    const watched = player(woodToSpare((state) => (state.settlement.buildings.watchtower = 2)));
    await mandarCaravana.run(watched.view, watched.act);
    expect(watched.refused).toEqual([]);
    expect(watched.orders).toEqual([
      {
        type: 'sendCaravan',
        payload: { resource: 'wood', amount: 300, escortHeroId: null, quoteDay: 0 },
      },
    ]);
  });

  it('o herói que não pode partir não escolta: sem a Torre no nível 2, a caravana não sai', async () => {
    const game = player(
      woodToSpare((state) => {
        enlist(state);
        Object.assign(state.guild.heroes[0] ?? {}, {
          status: 'injured',
          injury: { severity: 'light', untilMs: state.lastProcessedAt + HOUR },
        });
      }),
    );
    expect(game.view.market.caravanOffer.eligibleEscortIds).toEqual([]);
    await mandarCaravana.run(game.view, game.act);
    expect([...game.orders, ...game.refused]).toEqual([]);
  });

  it('com o depósito longe de encher, ou com excedente pequeno demais para a viagem, não manda nada', async () => {
    const calm = player(
      feud((state) => {
        state.settlement.buildings.market = 2;
        enlist(state);
      }),
    );
    await mandarCaravana.run(calm.view, calm.act);
    expect(calm.orders).toEqual([]);
    // A comida a 30 unidades do que o feudo guarda, com o Celeiro quase cheio e a Fazenda
    // rendendo pouco: sobra menos do que vale uma caravana.
    const little = player(
      feud((state) => {
        state.settlement.buildings.market = 2;
        state.settlement.resources.food = 990_000;
        state.settlement.workers.farm = 1;
        state.settlement.population.villagers = 4;
        state.settlement.buildings.granary = 3;
        enlist(state);
      }),
    );
    const before = little.orders.length;
    await mandarCaravana.run(little.view, little.act);
    for (const order of little.orders.slice(before) as Array<{ payload: { amount: number } }>) {
      expect(order.payload.amount).toBeGreaterThanOrEqual(40);
    }
  });

  it('entre dois excedentes, leva o que rende mais ouro pelo preço que a caravana fixaria; com dois lugares, manda um e depois o outro', async () => {
    const both = (level: number) =>
      woodToSpare((state) => {
        state.settlement.buildings.market = level;
        state.settlement.resources.stone = 1_000_000;
        state.settlement.workers.quarry = 4;
        enlist(state);
        enlist(state, 'Rolf');
      });
    const one = player(both(2));
    await mandarCaravana.run(one.view, one.act);
    // 300 de pedra a 2,38 rendem mais do que 300 de madeira a 1,428.
    expect(one.orders).toEqual([
      {
        type: 'sendCaravan',
        payload: { resource: 'stone', amount: 300, escortHeroId: 'hero-1', quoteDay: 0 },
      },
    ]);
    const two = player(both(4));
    await mandarCaravana.run(two.view, two.act);
    expect(two.refused).toEqual([]);
    expect(two.orders.map((order) => order.payload)).toEqual([
      { resource: 'stone', amount: 300, escortHeroId: 'hero-1', quoteDay: 0 },
      // A pedra que sobrou já não é excedente; a madeira, sim, e vai com quem ficou.
      { resource: 'wood', amount: 300, escortHeroId: 'hero-2', quoteDay: 0 },
    ]);
  });

  it('vem antes de `vender o excedente`: a caravana leva o que cabe nela, e o balcão fica com o resto', async () => {
    const names = economicoPolicies.map((policy) => policy.name);
    expect(names.indexOf('mandar caravana')).toBe(names.indexOf('vender o excedente') - 1);
    expect(names.indexOf('mandar caravana')).toBeGreaterThan(names.indexOf('alocar por demanda'));
    expect(preguicosoPolicies.map((policy) => policy.name)).not.toContain('mandar caravana');
    const game = player(woodToSpare(enlist));
    const sent = await mandarCaravana.run(game.view, game.act);
    await venderExcedente.run(sent, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders.map((order) => order.type)).toEqual(['sendCaravan', 'trade']);
    // A carga da caravana não gastou o volume do dia: o balcão ainda vende.
    expect(sent.market.prices.find((row) => row.resource === 'wood')?.tradedToday).toBe(0);
  });

  it('`erguer o Mercado` o leva ao nível das caravanas quando o bot as mandaria e há folga: com um herói pronto, ou com a Torre no nível 2', async () => {
    /** O estoque paga duas vezes a obra do nível 2 (240 de madeira, 160 de pedra, 240 de ouro). */
    const stocked = (state: GameState) => {
      Object.assign(state.settlement.resources, { wood: 600_000, stone: 600_000 });
    };
    const alone = player(feud(stocked));
    await erguerMercado.run(alone.view, alone.act);
    expect(alone.orders).toEqual([]);
    const withHero = player(
      feud((state) => {
        stocked(state);
        enlist(state);
      }),
    );
    expect(withHero.view.market.caravanOffer.slots).toBe(0);
    await erguerMercado.run(withHero.view, withHero.act);
    expect(withHero.refused).toEqual([]);
    expect(withHero.orders).toEqual([
      { type: 'startConstruction', payload: { building: 'market' } },
    ]);
    const watched = player(
      feud((state) => {
        stocked(state);
        state.settlement.buildings.watchtower = 2;
      }),
    );
    await erguerMercado.run(watched.view, watched.act);
    expect(watched.orders).toEqual([
      { type: 'startConstruction', payload: { building: 'market' } },
    ]);
    // Sem folga (400 de madeira não pagam duas vezes os 240), espera: nem começa, nem planeja.
    const tight = player(feud(enlist));
    await erguerMercado.run(tight.view, tight.act);
    expect([...tight.orders, ...tight.refused]).toEqual([]);
    // No nível das caravanas, não insiste: um nível a mais já não rende.
    const there = player(
      feud((state) => {
        stocked(state);
        state.settlement.buildings.market = 2;
        enlist(state);
      }),
    );
    await erguerMercado.run(there.view, there.act);
    expect(there.orders).toEqual([]);
  });
});

describe('as caravanas em uma partida inteira', () => {
  it('o econômico manda caravanas sem recusa, e o resumo conta as enviadas, as escoltadas, as emboscadas e o ouro delas', async () => {
    const result = await simulate({
      seed: 'pedra-alta-001',
      days: 7,
      strategy: 'economico',
      sessionsPerDay: 2,
      timeScale: 3,
    });
    const summary = summarize(result);
    expect(result.commands.refused).toEqual({});
    const sent = result.events.filter((event) => event.type === 'caravanSent');
    const ambushed = result.events.filter((event) => event.type === 'caravanAmbushed');
    const arrived = result.events.filter((event) => event.type === 'caravanArrived');
    expect(sent.length).toBeGreaterThan(0);
    expect(summary.market).toMatchObject({
      caravansSent: sent.length,
      caravansEscorted: sent.filter((event) => event.data.escorted === 1).length,
      caravansAmbushed: ambushed.length,
      caravansArrived: arrived.length + ambushed.length,
    });
    expect(summary.market.caravanGold).toBeGreaterThan(0);
    expect(summary.market.mineGold).toBeGreaterThan(0);
    // Toda caravana com escolta chega inteira.
    for (const event of ambushed) {
      const origin = sent.find((entry) => entry.data.caravanId === event.data.caravanId);
      expect(origin?.data.escorted).toBe(0);
    }
    // Nenhuma caravana leva mais do que o teto que a visão mostra.
    for (const event of sent) {
      expect(Number(event.data.amount)).toBeLessThanOrEqual(300);
      expect(Number(event.data.amount)).toBeGreaterThanOrEqual(40);
    }
  });
});

describe('especular (revisão da Fase E, R6): comprar no balcão para revender por caravana', () => {
  /** Um feudo com lugar no depósito, ouro no cofre e o Mercado no nível das caravanas. */
  const room = (edit: (state: GameState) => void = () => {}, atMs?: number) =>
    feud((state) => {
      state.settlement.buildings.market = 2;
      Object.assign(state.settlement.resources, { wood: 100_000, stone: 100_000, gold: 900_000 });
      enlist(state);
      edit(state);
    }, atMs);

  it('a arbitragem do dia: compra madeira ou pedra e envia na mesma visita exatamente o que comprou; o ouro que a caravana fixa é menos do que o que a compra custou', async () => {
    const game = player(room());
    const gold = game.state().settlement.resources.gold;
    await especular.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders.map((order) => order.type)).toEqual(['trade', 'sendCaravan']);
    const [bought, sent] = game.orders as Array<{
      payload: { resource: string; amount: number; direction?: string };
    }>;
    expect(bought?.payload.direction).toBe('buy');
    expect(sent?.payload.resource).toBe(bought?.payload.resource);
    expect(sent?.payload.amount).toBe(bought?.payload.amount);
    const state = game.state();
    const [caravan] = state.market.caravans;
    const spent = gold - state.settlement.resources.gold;
    expect(spent).toBeGreaterThan(0);
    // O que a caravana vai render, se chegar inteira, não paga a compra.
    expect((caravan?.amount ?? 0) * (caravan?.unitPrice ?? 0)).toBeLessThan(spent);
  });

  it('a comida do verão: no verão compra comida e a guarda; no outono manda por caravana o que está acima do que o feudo guarda', async () => {
    const SUMMER = 24 * DAY;
    const summer = player(
      room(
        (state) => {
          state.settlement.resources.food = 100_000;
        },
        SUMMER + DAY + HOUR,
      ),
    );
    await especular.run(summer.view, summer.act);
    const [first] = summer.orders as Array<{ type: string; payload: Record<string, unknown> }>;
    expect(first).toMatchObject({ type: 'trade', payload: { resource: 'food', direction: 'buy' } });
    expect(
      summer.orders.some(
        (order) =>
          order.type === 'sendCaravan' &&
          (order.payload as { resource: string }).resource === 'food',
      ),
    ).toBe(false);
    const autumn = player(
      room(
        (state) => {
          state.settlement.resources.food = 600_000;
        },
        AUTUMN + DAY + HOUR,
      ),
    );
    await especular.run(autumn.view, autumn.act);
    const [sent] = autumn.orders as Array<{ type: string; payload: Record<string, unknown> }>;
    expect(sent).toMatchObject({ type: 'sendCaravan', payload: { resource: 'food' } });
    // Só o que está acima da reserva: o que a visão diz que sobra para mandar.
    const offered = autumn.view.market.caravanOffer.resources.find(
      (row) => row.resource === 'food',
    );
    expect(sent?.payload.amount).toBe(offered?.surplusSendable);
    expect(offered?.surplusSendable).toBeLessThanOrEqual(offered?.maxSendable ?? 0);
  });

  it('sem o Mercado no nível das caravanas não compra nada para revender', async () => {
    const game = player(
      room((state) => {
        state.settlement.buildings.market = 1;
      }),
    );
    await especular.run(game.view, game.act);
    expect(game.orders).toEqual([]);
  });
});
