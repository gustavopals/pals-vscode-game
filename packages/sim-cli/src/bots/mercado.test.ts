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
import { comprarLenha, erguerMercado, venderExcedente } from './policies';
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
