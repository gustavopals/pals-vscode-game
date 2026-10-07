import {
  applyCommand,
  type Command,
  createInitialState,
  deriveViewState,
  type GameState,
  type ViewState,
} from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { economicoPolicies } from './economico';
import { exploradorPolicies } from './explorador';
import { alocarMestre, alocarPorDemanda } from './policies';
import { preguicosoPolicies } from './preguicoso';
import type { Act } from './types';

type Order = { type: string; payload: unknown };

const HOUR = 3_600_000;
const DAY = 2 * HOUR;

/** Um feudo com dez aldeões, dois deles sem ofício, e os Mestres pedidos, sem edifício. */
function feud(masters: string[], edit: (state: GameState) => void = () => {}): GameState {
  const state = createInitialState('mestre-bot', {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale: 1,
  });
  state.lastProcessedAt = 3 * DAY + HOUR;
  state.clock.gameTimeMs = 3 * DAY + HOUR;
  Object.assign(state.settlement.buildings, { townHall: 2, housing: 2, granary: 2, warehouse: 2 });
  Object.assign(state.settlement.resources, {
    food: 400_000,
    wood: 300_000,
    stone: 200_000,
    gold: 200_000,
  });
  state.settlement.population.villagers = 10;
  Object.assign(state.settlement.workers, { farm: 4, lumberMill: 2, quarry: 1, goldMine: 1 });
  state.council.nextDrawAtMs = 1000 * 84 * DAY;
  // No jogo o Mestre chega por expedição; aqui entra à mão, já com o identificador dele.
  state.settlement.masters = masters.map((masterId, index) => ({
    id: `master-${index + 1}`,
    masterId: masterId as GameState['settlement']['masters'][number]['masterId'],
    building: null,
    adaptingUntilMs: null,
    worked: false,
  }));
  state.ids.master = masters.length;
  edit(state);
  return state;
}

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

describe('alocar o Mestre (V3E-T3)', () => {
  it('sem Mestre não dá ordem nenhuma', async () => {
    const game = player(feud([]));
    await alocarMestre.run(game.view, game.act);
    expect(game.orders).toEqual([]);
  });

  it('põe o Mestre no edifício em que a visão diz que ele rende mais depois da adaptação', async () => {
    const game = player(feud(['odo']));
    const [master] = game.view.masters;
    const best = [...(master?.options ?? [])].sort((a, b) => b.gainPerHour - a.gainPerHour)[0];
    await alocarMestre.run(game.view, game.act);
    expect(game.orders).toEqual([
      { type: 'assignMaster', payload: { masterId: 'master-1', building: best?.building } },
    ]);
    // Na primavera, com quatro lavradores, é a Fazenda: é onde há mais braços para o bônus valer.
    expect(best?.building).toBe('farm');
    expect(game.refused).toEqual([]);
  });

  it('dois Mestres: o segundo vai para o melhor edifício que sobrou, e nenhuma ordem é recusada', async () => {
    const game = player(feud(['odo', 'berta']));
    const after = await alocarMestre.run(game.view, game.act);
    expect(game.refused).toEqual([]);
    expect(game.orders).toHaveLength(2);
    const places = after.masters.map((master) => master.building);
    expect(new Set(places).size).toBe(2);
    expect(places).not.toContain(null);
  });

  it('não muda de lugar quem já tem edifício: cada troca custa uma adaptação', async () => {
    const game = player(
      feud(['odo'], (state) => {
        Object.assign(state.settlement.masters[0] as object, { building: 'goldMine' });
      }),
    );
    await alocarMestre.run(game.view, game.act);
    expect(game.orders).toEqual([]);
  });

  it('a alocação dos aldeões conta a boca do Mestre e o braço dele na Fazenda', async () => {
    const bare = player(feud([]));
    await alocarPorDemanda.run(bare.view, bare.act);
    const fed = player(
      feud(['berta'], (state) => {
        Object.assign(state.settlement.masters[0] as object, { building: 'farm' });
      }),
    );
    await alocarPorDemanda.run(fed.view, fed.act);
    // Uma boca a mais e um braço a mais com o bônus: a Fazenda não pede mais lavradores do que antes.
    expect(fed.state().settlement.workers.farm).toBeLessThanOrEqual(
      bare.state().settlement.workers.farm,
    );
    expect(fed.refused).toEqual([]);
  });

  it('está no econômico e no explorador, depois da alocação dos aldeões; o preguiçoso deixa o Mestre sem edifício', () => {
    for (const policies of [economicoPolicies, exploradorPolicies]) {
      const names = policies.map((policy) => policy.name);
      expect(names.indexOf('alocar o Mestre')).toBe(names.indexOf('alocar por demanda') + 1);
    }
    expect(preguicosoPolicies.map((policy) => policy.name)).not.toContain('alocar o Mestre');
  });
});
