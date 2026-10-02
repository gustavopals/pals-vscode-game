import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  advanceTo,
  applyCommand,
  type BuildingId,
  type Command,
  createInitialState,
  deriveViewState,
  type ResourceId,
  type ViewState,
} from '@lotg/engine';
import { describe, expect, it } from 'vitest';

import { strategies, strategyPolicies } from './index';
import {
  alocarPorDemanda,
  comidaPrimeiro,
  obraMaisBarata,
  ocuparLivres,
  recrutar,
} from './policies';
import { type Act, botOf, type Policy } from './types';

const HOUR_MS = 3_600_000;

type Order = { type: Command['type']; payload: unknown };

/** A visão de um feudo recém-criado: 5 aldeões sem ofício, comida caindo. */
function freshView(timeScale = 1): ViewState {
  const state = createInitialState('bots', {
    settlementName: 'Pedra Alta',
    timezone: 'UTC',
    vigilHourLocal: 20,
    difficulty: 'lord',
    timeScale,
  });
  return deriveViewState(state, 0, { timeScale });
}

/** Um `act` que só anota as ordens e devolve a mesma visão: para olhar a decisão da política. */
function recorder(view: ViewState): { act: Act; orders: Order[] } {
  const orders: Order[] = [];
  const act: Act = async (type, payload) => {
    orders.push({ type, payload });
    return view;
  };
  return { act, orders };
}

/** A visão com os trabalhadores de cada edifício trocados; os livres são o que sobra. */
function withWorkers(view: ViewState, assigned: Partial<Record<BuildingId, number>>): ViewState {
  const workers = view.workers.map((row) => ({
    ...row,
    assigned: assigned[row.building] ?? row.assigned,
  }));
  const busy = workers.reduce((sum, row) => sum + row.assigned, 0);
  return {
    ...view,
    workers,
    population: { ...view.population, free: view.population.villagers - busy },
  };
}

/** Uma obra a que falta `missing` de cada recurso. */
function upgrade(
  building: BuildingId,
  missing: Partial<Record<ResourceId, number>>,
  blockedCode: ViewState['constructions']['available'][number]['blockedCode'] = 'INSUFFICIENT_RESOURCES',
): ViewState['constructions']['available'][number] {
  return {
    building,
    label: building,
    fromLevel: 1,
    targetLevel: 2,
    cost: Object.entries(missing).map(([resource, amount]) => ({
      resource: resource as ResourceId,
      label: resource,
      amount: amount + 100,
      missing: amount,
    })),
    durationSeconds: 600,
    affordable: false,
    blockedCode,
    blockedReason: blockedCode === null ? null : 'Não pode começar agora.',
    planned: false,
  };
}

function withUpgrades(
  view: ViewState,
  available: ViewState['constructions']['available'],
): ViewState {
  return { ...view, constructions: { ...view.constructions, available } };
}

describe('um bot é uma lista de políticas', () => {
  it('aplica as políticas em ordem, cada uma com a visão que a anterior deixou', async () => {
    const start = freshView();
    const seen: string[] = [];
    const policy = (name: string): Policy => ({
      name,
      run: async (view) => {
        seen.push(`${name} viu ${view.settlement.name}`);
        return { ...view, settlement: { ...view.settlement, name: `depois de ${name}` } };
      },
    });
    await botOf([policy('a'), policy('b'), policy('c')])(start, recorder(start).act);
    expect(seen).toEqual(['a viu Pedra Alta', 'b viu depois de a', 'c viu depois de b']);
  });

  it('o econômico e o preguiçoso são listas de políticas com nome', () => {
    expect(strategyPolicies.economico).toEqual([recrutar, obraMaisBarata, alocarPorDemanda]);
    expect(strategyPolicies.preguicoso).toEqual([
      recrutar,
      obraMaisBarata,
      comidaPrimeiro,
      ocuparLivres,
    ]);
    expect(Object.keys(strategies)).toEqual(Object.keys(strategyPolicies));
    const names = [recrutar, obraMaisBarata, alocarPorDemanda, comidaPrimeiro, ocuparLivres].map(
      (policy) => policy.name,
    );
    expect(names).toEqual([
      'recrutar',
      'obra mais barata',
      'alocar por demanda',
      'comida primeiro',
      'ocupar os livres',
    ]);
  });

  it('uma política sem o que fazer não dá ordem nenhuma e devolve a mesma visão', async () => {
    const view = withUpgrades(freshView(), []);
    const { act, orders } = recorder(view);
    expect(await obraMaisBarata.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });
});

describe('política "comida primeiro"', () => {
  it('põe na fazenda só os braços que a comida pede', async () => {
    const view = freshView();
    expect(view.resources.find((row) => row.id === 'food')?.perHour).toBe(-5);
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 1 } }]);
  });

  it('conta as bocas que ainda estão chegando', async () => {
    const base = freshView();
    const view = { ...base, population: { ...base.population, inTraining: 6 } };
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    // 11 bocas a 1 por hora, 10 por fazendeiro: dois fazendeiros.
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 2 } }]);
  });

  it('decide igual em qualquer ritmo: só usa as taxas que a visão traz', async () => {
    const view = freshView(3);
    expect(view.workers.find((row) => row.building === 'farm')?.perWorkerPerHour).toBe(30);
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 1 } }]);
  });

  it('com a fazenda rendendo menos (fome), pede mais fazendeiros', async () => {
    const base = freshView();
    const view: ViewState = {
      ...base,
      population: { ...base.population, inTraining: 3 },
      workers: base.workers.map((row) =>
        row.building === 'farm' ? { ...row, perWorkerPerHour: 7.5 } : row,
      ),
    };
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    // 8 bocas e 7,5 por fazendeiro: um não basta.
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 2 } }]);
  });

  it('sem aldeão livre, busca em quem tem mais gente antes de mandar para a fazenda', async () => {
    const view = withWorkers(freshView(), { lumberMill: 3, quarry: 2 });
    expect(view.population.free).toBe(0);
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    expect(orders).toEqual([
      { type: 'setWorkers', payload: { building: 'lumberMill', count: 2 } },
      { type: 'setWorkers', payload: { building: 'farm', count: 1 } },
    ]);
  });

  it('nunca tira ninguém da fazenda', async () => {
    const base = withWorkers(freshView(), { farm: 3 });
    const view: ViewState = {
      ...base,
      workers: base.workers.map((row) =>
        row.building === 'farm' ? { ...row, grossPerHour: 30 } : row,
      ),
      resources: base.resources.map((row) => (row.id === 'food' ? { ...row, perHour: 25 } : row)),
    };
    const { act, orders } = recorder(view);
    expect(await comidaPrimeiro.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });
});

describe('política "ocupar os livres"', () => {
  it('manda todos os livres, em uma ordem só, para o material que mais demora a cobrir', async () => {
    // Faltam 120 de madeira (15 h de um lenhador) e 100 de pedra (20 h de um pedreiro).
    const view = withUpgrades(withWorkers(freshView(), { farm: 1, quarry: 1 }), [
      upgrade('townHall', { wood: 120, stone: 60 }),
      upgrade('goldMine', { stone: 40 }),
    ]);
    expect(view.population.free).toBe(3);
    const { act, orders } = recorder(view);
    await ocuparLivres.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'quarry', count: 4 } }]);
  });

  it('não conta o que falta a uma obra que o Salão ainda não libera', async () => {
    const view = withUpgrades(withWorkers(freshView(), { farm: 1 }), [
      upgrade('quarry', { stone: 900 }, 'GATE_LOCKED'),
      upgrade('farm', { wood: 10 }),
    ]);
    const { act, orders } = recorder(view);
    await ocuparLivres.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'lumberMill', count: 4 } }]);
  });

  it('se nada falta às obras, reforça o ofício com menos gente', async () => {
    const view = withUpgrades(withWorkers(freshView(), { farm: 1, lumberMill: 2, quarry: 1 }), [
      upgrade('farm', {}, null),
    ]);
    const { act, orders } = recorder(view);
    await ocuparLivres.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'goldMine', count: 1 } }]);
  });

  it('nunca manda ninguém para a fazenda e não dá ordem sem aldeão livre', async () => {
    const hungry = withUpgrades(withWorkers(freshView(), { lumberMill: 2 }), [
      upgrade('farm', { food: 500 }),
    ]);
    const first = recorder(hungry);
    await ocuparLivres.run(hungry, first.act);
    expect(first.orders).toEqual([
      { type: 'setWorkers', payload: { building: 'quarry', count: 3 } },
    ]);

    const busy = withWorkers(freshView(), { farm: 1, lumberMill: 4 });
    const second = recorder(busy);
    expect(await ocuparLivres.run(busy, second.act)).toBe(busy);
    expect(second.orders).toEqual([]);
  });
});

describe('os bots jogando contra o motor', () => {
  /** Uma partida de verdade, com um `act` que aplica a ordem no motor e anota a resposta. */
  function game(timeScale: number) {
    let state = createInitialState('bots', {
      settlementName: 'Pedra Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale,
    });
    const refused: string[] = [];
    const orders: Order[] = [];
    const view = () => deriveViewState(state, state.lastProcessedAt, { timeScale });
    const act: Act = async (type, payload) => {
      const command = { commandId: `bots-${orders.length}`, type, payload } as Command;
      const result = applyCommand(state, command, state.lastProcessedAt);
      orders.push({ type, payload });
      if (result.ok) {
        state = result.state;
      } else {
        refused.push(`${type}: ${result.code}`);
      }
      return view();
    };
    const pass = (gameHours: number) => {
      state = advanceTo(state, state.lastProcessedAt + gameHours * HOUR_MS).state;
    };
    return { view, act, pass, orders, refused };
  }

  it.each([1, 3, 0.5])(
    'o preguiçoso, no ritmo %d, deixa a comida no positivo e ninguém sem ofício',
    async (timeScale) => {
      const feudo = game(timeScale);
      for (let visit = 0; visit < 10; visit += 1) {
        await strategies.preguicoso(feudo.view(), feudo.act);
        const after = feudo.view();
        expect(after.population.free).toBe(0);
        // Quem ainda está chegando já foi contado: o saldo de agora cobre as bocas novas.
        const food = after.resources.find((row) => row.id === 'food');
        expect(food?.perHour).toBeGreaterThanOrEqual(0);
        // Um dia real entre as visitas.
        feudo.pass(24 * timeScale);
      }
      expect(feudo.refused).toEqual([]);
      expect(feudo.view().famine).toBeNull();
    },
  );

  it('o preguiçoso dá poucas ordens por visita: no máximo uma obra e um recrutamento', async () => {
    const feudo = game(1);
    for (let visit = 0; visit < 7; visit += 1) {
      const before = feudo.orders.length;
      await strategies.preguicoso(feudo.view(), feudo.act);
      const session = feudo.orders.slice(before);
      expect(session.filter((order) => order.type === 'startConstruction').length).toBeLessThan(2);
      expect(session.filter((order) => order.type === 'recruitVillagers').length).toBeLessThan(2);
      expect(session.length).toBeLessThanOrEqual(6);
      feudo.pass(24);
    }
  });

  it('o preguiçoso acode a fome quando ela chega', async () => {
    const feudo = game(1);
    // Ninguém na fazenda: a comida acaba e a fome se instala.
    feudo.pass(48);
    expect(feudo.view().famine).not.toBeNull();
    await strategies.preguicoso(feudo.view(), feudo.act);
    expect(feudo.refused).toEqual([]);
    expect(feudo.view().resources.find((row) => row.id === 'food')?.perHour).toBeGreaterThan(0);
    feudo.pass(2);
    expect(feudo.view().famine).toBeNull();
  });
});

describe('bot honesto', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url));
  const sources = readdirSync(directory)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(`${directory}/${name}`, 'utf8') }));

  it('os bots só conhecem os tipos do motor: nunca o estado, o avanço nem os sorteios', () => {
    expect(sources.map((source) => source.name).sort()).toEqual([
      'economico.ts',
      'index.ts',
      'policies.ts',
      'preguicoso.ts',
      'types.ts',
    ]);
    for (const { name, text } of sources) {
      // Os comentários explicam a regra e citam o que é proibido; a conferência é no código.
      const code = text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      const engineImports = code.match(/import\s[^;]*from '@lotg\/engine';/g) ?? [];
      for (const statement of engineImports) {
        expect(statement, name).toMatch(/^import type /);
      }
      expect(code, name).not.toMatch(
        /GameState|createInitialState|advanceTo|applyCommand|deriveViewState|\brng\b/,
      );
    }
    // A conferência enxerga os imports: os tipos do motor entram por `import type`.
    expect(sources.some(({ text }) => /import type [^;]*from '@lotg\/engine';/.test(text))).toBe(
      true,
    );
  });
});
