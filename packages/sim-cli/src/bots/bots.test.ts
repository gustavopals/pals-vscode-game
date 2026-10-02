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
  ampliarEstoque,
  comidaPrimeiro,
  guardarLenha,
  obraMaisBarata,
  ocuparLivres,
  planejarAutomaticas,
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
    durationNote: null,
    affordable: false,
    blockedCode,
    blockedReason: blockedCode === null ? null : 'Não pode começar agora.',
    planned: false,
    effect: null,
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
    // As obras vêm antes do recrutamento: o bot olha o painel como o encontrou, com o depósito
    // cheio e a produção indo ao chão, antes de gastar a comida em aldeões.
    expect(strategyPolicies.economico).toEqual([
      obraMaisBarata,
      ampliarEstoque,
      planejarAutomaticas,
      recrutar,
      alocarPorDemanda,
      guardarLenha,
    ]);
    expect(strategyPolicies.preguicoso).toEqual([
      obraMaisBarata,
      ampliarEstoque,
      planejarAutomaticas,
      recrutar,
      comidaPrimeiro,
      ocuparLivres,
      guardarLenha,
    ]);
    expect(Object.keys(strategies)).toEqual(Object.keys(strategyPolicies));
    const names = [
      recrutar,
      obraMaisBarata,
      ampliarEstoque,
      planejarAutomaticas,
      alocarPorDemanda,
      comidaPrimeiro,
      ocuparLivres,
      guardarLenha,
    ].map((policy) => policy.name);
    expect(names).toEqual([
      'recrutar',
      'obra mais barata',
      'ampliar o estoque',
      'planejar automáticas',
      'alocar por demanda',
      'comida primeiro',
      'ocupar os livres',
      'guardar lenha',
    ]);
  });

  it('uma política sem o que fazer não dá ordem nenhuma e devolve a mesma visão', async () => {
    const view = withUpgrades(freshView(), []);
    const { act, orders } = recorder(view);
    expect(await obraMaisBarata.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });
});

describe('política "recrutar" e a moral', () => {
  /** Um feudo com comida e ouro de sobra, `villagers` habitantes e `vacancies` camas livres. */
  const housed = (villagers: number, vacancies: number): ViewState => {
    const view = freshView();
    return {
      ...view,
      population: { ...view.population, villagers, vacancies, capacity: villagers + vacancies },
      recruitment: { ...view.recruitment, maxQuantity: Math.min(5, vacancies) },
      resources: view.resources.map((row) =>
        row.id === 'food' || row.id === 'gold' ? { ...row, stock: 2_000 } : row,
      ),
    };
  };
  const recruited = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    await recrutar.run(view, act);
    return orders;
  };

  it('em um feudo pequeno enche as casas: cada par de braços rende mais do que a moral tira', async () => {
    expect(await recruited(housed(12, 3))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 3 } },
    ]);
    expect(await recruited(housed(19, 1))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 1 } },
    ]);
  });

  it('com 20 aldeões ou mais deixa uma cama vazia: as casas cheias derrubam a moral de todos', async () => {
    expect(await recruited(housed(22, 3))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 2 } },
    ]);
    // A última cama fica vazia: nenhuma ordem.
    expect(await recruited(housed(24, 1))).toEqual([]);
    // Com muitas camas, a ordem é a de sempre: o limite por ordem.
    expect(await recruited(housed(40, 9))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 5 } },
    ]);
  });

  it('continua guardando a reserva de comida e respeitando o ouro', async () => {
    const poor = (food: number, gold: number): ViewState => {
      const view = housed(22, 5);
      return {
        ...view,
        resources: view.resources.map((row) => {
          if (row.id === 'food') {
            return { ...row, stock: food };
          }
          return row.id === 'gold' ? { ...row, stock: gold } : row;
        }),
      };
    };
    // 50 de comida e 10 de ouro por aldeão; 60 de comida ficam na despensa.
    expect(await recruited(poor(170, 500))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 2 } },
    ]);
    expect(await recruited(poor(2_000, 15))).toEqual([
      { type: 'recruitVillagers', payload: { quantity: 1 } },
    ]);
    expect(await recruited(poor(100, 500))).toEqual([]);
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
    const view = { ...base, population: { ...base.population, inTraining: 8 } };
    const { act, orders } = recorder(view);
    await comidaPrimeiro.run(view, act);
    // 13 bocas a 1 por hora, 12 por fazendeiro na primavera: dois fazendeiros.
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'farm', count: 2 } }]);
  });

  it('decide igual em qualquer ritmo: só usa as taxas que a visão traz', async () => {
    const view = freshView(3);
    expect(view.workers.find((row) => row.building === 'farm')?.perWorkerPerHour).toBe(36);
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

describe('política "alocar por demanda"', () => {
  const targets = (orders: Order[]) =>
    Object.fromEntries(
      orders.map((order) => {
        const { building, count } = order.payload as { building: BuildingId; count: number };
        return [building, count];
      }),
    );

  /** O mesmo feudo com as Habitações cheias: sem vaga, o bot planta só para alimentar. */
  const housingFull = (view: ViewState): ViewState => ({
    ...view,
    population: { ...view.population, vacancies: 0 },
  });

  it('põe na fazenda quem alimenta todas as bocas e mais duas, e reparte o resto', async () => {
    const view = housingFull(withUpgrades(freshView(), []));
    const { act, orders } = recorder(view);
    await alocarPorDemanda.run(view, act);
    expect(orders.every((order) => order.type === 'setWorkers')).toBe(true);
    // 5 bocas e 2 de folga, 12 por fazendeiro na primavera: um basta. Dos outros quatro, um em
    // cada ofício, para os três contarem como ocupados, e o que sobra na madeira (3:2:1).
    expect(targets(orders)).toEqual({ farm: 1, lumberMill: 2, quarry: 1, goldMine: 1 });
  });

  it('com vaga nas Habitações, um lavrador a mais: a sobra de comida paga os recrutas', async () => {
    const view = withUpgrades(freshView(), []);
    expect(view.population.vacancies).toBe(5);
    const { act, orders } = recorder(view);
    await alocarPorDemanda.run(view, act);
    expect(targets(orders)).toEqual({ farm: 2, lumberMill: 1, quarry: 1, goldMine: 1 });
  });

  it('com a despensa cheia e a comida indo ao chão, a sobra já existe: sem lavrador a mais', async () => {
    const base = withUpgrades(freshView(), []);
    const view: ViewState = {
      ...base,
      resources: base.resources.map((row) =>
        row.id === 'food' ? { ...row, full: true, wastingPerHour: 4 } : row,
      ),
    };
    const { act, orders } = recorder(view);
    await alocarPorDemanda.run(view, act);
    expect(targets(orders).farm).toBe(1);
  });

  it('conta as bocas que ainda estão chegando', async () => {
    const base = housingFull(withUpgrades(freshView(), []));
    const view = { ...base, population: { ...base.population, inTraining: 6 } };
    const { act, orders } = recorder(view);
    await alocarPorDemanda.run(view, act);
    // 11 bocas e 2 de folga, a 12 por fazendeiro: um não basta.
    expect(targets(orders).farm).toBe(2);
  });

  it.each([3, 0.5])('decide no ritmo %d o mesmo que no ritmo 1', async (timeScale) => {
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await alocarPorDemanda.run(view, act);
      return orders;
    };
    expect(await decide(freshView(timeScale))).toEqual(await decide(freshView(1)));
  });

  it('com a fazenda rendendo menos (fome), põe mais fazendeiros', async () => {
    const base = housingFull(withUpgrades(freshView(), []));
    const view: ViewState = {
      ...base,
      population: { ...base.population, inTraining: 1 },
      workers: base.workers.map((row) =>
        row.building === 'farm' ? { ...row, perWorkerPerHour: 7.5 } : row,
      ),
    };
    const { act, orders } = recorder(view);
    await alocarPorDemanda.run(view, act);
    // 6 bocas e 2 de folga a 7,5 por fazendeiro: um não basta. Com 10, bastaria.
    expect(targets(orders).farm).toBe(2);
  });

  it('reparte os braços pelo que cada um rende na visão, e não por uma tabela', async () => {
    // Falta o mesmo de madeira e de pedra. A serraria rende 8 por braço e a pedreira, 5.
    const needs = (view: ViewState) =>
      housingFull(
        withUpgrades(view, [
          upgrade('housing', {
            wood: (view.resources.find((row) => row.id === 'wood')?.stock ?? 0) + 300,
            stone: (view.resources.find((row) => row.id === 'stone')?.stock ?? 0) + 300,
          }),
        ]),
      );
    const base = needs(freshView());
    const plain = recorder(base);
    await alocarPorDemanda.run(base, plain.act);
    // Um em cada ofício, para os três contarem como ocupados; o quarto vai para a pedra, que
    // demora mais a cobrir os 300 (60 horas de um canteiro contra 37,5 de um lenhador).
    expect(targets(plain.orders)).toEqual({ farm: 1, lumberMill: 1, quarry: 2, goldMine: 1 });

    // Um fator que só a visão conhece (estação, moral, ofício) faz a pedreira render o triplo:
    // a pedra passa a ser a que menos demora, e o braço que sobra vai para a madeira.
    const boosted: ViewState = {
      ...base,
      workers: base.workers.map((row) =>
        row.building === 'quarry' ? { ...row, perWorkerPerHour: row.perWorkerPerHour * 3 } : row,
      ),
    };
    const seen = recorder(boosted);
    await alocarPorDemanda.run(boosted, seen.act);
    expect(targets(seen.orders)).toEqual({ farm: 1, lumberMill: 2, quarry: 1, goldMine: 1 });
  });

  it('sem ninguém no feudo, não dá ordem', async () => {
    const base = freshView();
    const view: ViewState = {
      ...base,
      population: { ...base.population, villagers: 0, free: 0 },
    };
    const { act, orders } = recorder(view);
    expect(await alocarPorDemanda.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });

  describe('trocar de ofício custa: só quando o ganho compensa', () => {
    /**
     * Um feudo de 12 aldeões já trabalhando e sem vaga nas Habitações, com o que cada edifício
     * rende agora coerente com quem está nele, e `occupiedFrom` de cada material (o padrão é 1).
     */
    function staffed(
      assigned: Record<'farm' | 'lumberMill' | 'quarry' | 'goldMine', number>,
      occupiedFrom: Partial<Record<BuildingId, number>> = {},
      upgrades: ViewState['constructions']['available'] = [],
    ): ViewState {
      const base = withUpgrades(freshView(), upgrades);
      const view = withWorkers(
        { ...base, population: { ...base.population, villagers: 12, vacancies: 0 } },
        assigned,
      );
      const workers = view.workers.map((row) => ({
        ...row,
        grossPerHour: row.assigned * row.perWorkerPerHour,
        occupiedFrom: occupiedFrom[row.building] ?? 1,
      }));
      const farm = workers.find((row) => row.building === 'farm');
      return {
        ...view,
        workers,
        resources: view.resources.map((row) =>
          row.id === 'food' ? { ...row, perHour: (farm?.grossPerHour ?? 0) - 12 } : row,
        ),
      };
    }
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await alocarPorDemanda.run(view, act);
      return targets(orders);
    };
    /**
     * Uma obra que pede o estoque e mais `wood` de madeira e `stone` de pedra: é o que falta
     * juntar. (`upgrade` monta o custo como "o que falta + 100".)
     */
    const lacking = (wood: number, stone: number) => {
      const stock = (id: ResourceId) =>
        freshView().resources.find((row) => row.id === id)?.stock ?? 0;
      return [
        upgrade('housing', {
          ...(wood > 0 ? { wood: stock('wood') + wood - 100 } : {}),
          ...(stone > 0 ? { stone: stock('stone') + stone - 100 } : {}),
        }),
      ];
    };

    it('sem obra esperando recurso, ninguém troca de ofício: quem trabalha fica onde está', async () => {
      // 12 bocas e 2 de folga a 12 por fazendeiro: dois bastam. A partilha "ideal" dos outros
      // dez seria outra (3:2:1), mas nada falta, e a troca não paga a adaptação.
      const view = staffed({ farm: 2, lumberMill: 2, quarry: 6, goldMine: 2 });
      expect(await decide(view)).toEqual({});
    });

    it('quem está sem ofício vai para onde mais falta gente, sem mexer nos outros', async () => {
      const view = staffed({ farm: 2, lumberMill: 2, quarry: 3, goldMine: 2 });
      expect(view.population.free).toBe(3);
      // O ideal seria 5:3:2; os três livres vão para a madeira, e ninguém sai da pedra.
      expect(await decide(view)).toEqual({ lumberMill: 5 });
    });

    it('uma falta grande, que levaria muito mais que a adaptação, paga a troca', async () => {
      // Faltam 600 de madeira: dois lenhadores levariam 37,5 horas. A pedra não falta.
      const view = staffed({ farm: 2, lumberMill: 2, quarry: 6, goldMine: 2 }, {}, lacking(600, 0));
      const moved = await decide(view);
      // A pedreira e a mina ficam com um cada, para continuarem ocupadas; o resto vai à serraria.
      expect(moved).toEqual({ quarry: 1, goldMine: 1, lumberMill: 8 });
    });

    it('uma falta pequena, que se cobre antes de a adaptação pagar, não paga a troca', async () => {
      // Faltam 40 de madeira: dois lenhadores cobrem em 2,5 horas, e a adaptação leva 2.
      const view = staffed({ farm: 2, lumberMill: 2, quarry: 6, goldMine: 2 }, {}, lacking(40, 0));
      expect(view.workersRules.adaptationSeconds).toBe(7200);
      expect(await decide(view)).toEqual({});
    });

    it('com falta e ninguém no ofício, a troca compensa sempre', async () => {
      const view = staffed({ farm: 2, lumberMill: 0, quarry: 8, goldMine: 2 }, {}, lacking(40, 0));
      expect((await decide(view)).lumberMill).toBeGreaterThan(0);
    });

    it('quem cede braços continua ocupado: fica com o que o nível do edifício pede', async () => {
      // A Pedreira no nível 4 pede quatro para a experiência subir.
      const view = staffed(
        { farm: 2, lumberMill: 2, quarry: 6, goldMine: 2 },
        { quarry: 4 },
        lacking(600, 0),
      );
      expect(await decide(view)).toEqual({ quarry: 4, goldMine: 1, lumberMill: 5 });
    });

    it('um fazendeiro a mais fica onde está; dois a mais, a fazenda devolve', async () => {
      const oneExtra = staffed({ farm: 3, lumberMill: 4, quarry: 3, goldMine: 2 });
      expect(await decide(oneExtra)).toEqual({});
      const twoExtra = staffed({ farm: 4, lumberMill: 4, quarry: 2, goldMine: 2 });
      // Os dois que sobram vão para onde mais falta gente (o ideal dos dez é 5:3:2).
      expect(await decide(twoExtra)).toEqual({ farm: 2, lumberMill: 5, quarry: 3 });
    });

    it('quando a comida pede, a fazenda leva de quem mais passa do que deveria ter', async () => {
      // Um fazendeiro só não alimenta 12 bocas: falta um, e a pedreira é quem tem de sobra.
      const view = staffed({ farm: 1, lumberMill: 3, quarry: 6, goldMine: 2 });
      expect(await decide(view)).toEqual({ quarry: 5, farm: 2 });
    });

    it('o prazo da adaptação vem da visão: no ritmo 3 a mesma falta já paga a troca', async () => {
      // 40 de madeira a 48 por hora real (dois lenhadores no ritmo 3): 50 minutos reais, mais
      // que duas adaptações de 40 minutos? Não: 50 < 80. Com 80 de falta, 100 minutos: paga.
      const fast = (wood: number) => {
        const base = withUpgrades(freshView(3), lacking(wood, 0));
        const view = withWorkers(
          { ...base, population: { ...base.population, villagers: 12, vacancies: 0 } },
          { farm: 2, lumberMill: 2, quarry: 6, goldMine: 2 },
        );
        return {
          ...view,
          workers: view.workers.map((row) => ({
            ...row,
            grossPerHour: row.assigned * row.perWorkerPerHour,
          })),
          resources: view.resources.map((row) =>
            row.id === 'food' ? { ...row, perHour: 72 - 36 } : row,
          ),
        };
      };
      expect(fast(40).workersRules.adaptationSeconds).toBe(2400);
      expect(await decide(fast(40))).toEqual({});
      expect((await decide(fast(80))).lumberMill).toBeGreaterThan(2);
    });
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

describe('política "guardar lenha"', () => {
  type Firewood = NonNullable<ViewState['calendar']['nextSeason']['firewood']>;

  /** A conta da lenha como a visão a traz: o que vai queimar, o que a Serraria repõe e o que falta. */
  function firewood(winterTotal: number, winterProduction: number, stock: number): Firewood {
    return {
      perHour: 9,
      winterTotal,
      winterProduction,
      stock,
      reserved: 0,
      missing: Math.max(0, winterTotal - winterProduction - stock),
      text: 'A conta da lenha.',
    };
  }

  /** Outono a `hours` horas do inverno, com a previsão da lenha na próxima estação. */
  function autumn(view: ViewState, forecast: Firewood, hours: number): ViewState {
    return {
      ...view,
      calendar: {
        ...view.calendar,
        season: 'autumn',
        secondsToNextSeason: hours * 3600,
        nextSeason: { ...view.calendar.nextSeason, id: 'winter', firewood: forecast },
      },
    };
  }

  /** Inverno a `hours` horas da primavera, com a conta do que falta queimar. */
  function winter(view: ViewState, count: Firewood, hours: number, cold = false): ViewState {
    return {
      ...view,
      calendar: { ...view.calendar, season: 'winter', secondsToNextSeason: hours * 3600 },
      winter: {
        firewoodPerHour: count.perHour,
        firewood: count,
        cold: cold ? { secondsElapsed: 600, text: 'Frio.' } : null,
      },
    };
  }

  it('sem inverno à vista, ou com a lenha coberta, não dá ordem', async () => {
    const spring = freshView();
    expect(spring.calendar.nextSeason.firewood).toBeNull();
    expect(spring.winter).toBeNull();
    const first = recorder(spring);
    expect(await guardarLenha.run(spring, first.act)).toBe(spring);
    expect(first.orders).toEqual([]);

    const covered = autumn(freshView(), firewood(60, 0, 120), 10);
    const second = recorder(covered);
    expect(await guardarLenha.run(covered, second.act)).toBe(covered);
    expect(second.orders).toEqual([]);
  });

  it('no outono, manda para a Serraria os braços que cobrem o que falta até o inverno', async () => {
    // Faltam 96 de madeira; um lenhador rende 8 por hora e o inverno chega em 6 horas: 48 cada.
    const view = autumn(
      withWorkers(freshView(), { farm: 2, lumberMill: 1 }),
      firewood(216, 0, 120),
      6,
    );
    expect(view.population.free).toBe(2);
    const { act, orders } = recorder(view);
    await guardarLenha.run(view, act);
    expect(orders).toEqual([{ type: 'setWorkers', payload: { building: 'lumberMill', count: 3 } }]);
  });

  it('sem livres, busca nos outros materiais, a começar por quem tem mais gente, e nunca na fazenda', async () => {
    const view = autumn(
      withWorkers(freshView(), { farm: 2, quarry: 2, goldMine: 1 }),
      firewood(216, 0, 120),
      4,
    );
    expect(view.population.free).toBe(0);
    const { act, orders } = recorder(view);
    await guardarLenha.run(view, act);
    // Faltam 96 e cada lenhador rende 32 em 4 horas: três braços, e só há três fora da fazenda.
    expect(orders).toEqual([
      { type: 'setWorkers', payload: { building: 'quarry', count: 0 } },
      { type: 'setWorkers', payload: { building: 'goldMine', count: 0 } },
      { type: 'setWorkers', payload: { building: 'lumberMill', count: 3 } },
    ]);
    expect(
      orders.some((order) => (order.payload as { building: string }).building === 'farm'),
    ).toBe(false);
  });

  it('no inverno, com frio, usa a conta do que falta até a primavera e o que o lenhador rende agora', async () => {
    const base = withWorkers(freshView(), { farm: 2, quarry: 3 });
    const cold: ViewState = winter(
      {
        ...base,
        // No frio um lenhador rende 8 × 0,8 × 0,8.
        workers: base.workers.map((row) =>
          row.building === 'lumberMill' ? { ...row, perWorkerPerHour: 5.12 } : row,
        ),
      },
      firewood(40, 0, 0),
      16,
      true,
    );
    const { act, orders } = recorder(cold);
    await guardarLenha.run(cold, act);
    // 40 de madeira em 16 horas a 5,12 por hora: 81,92 por lenhador. Um basta.
    expect(orders).toEqual([
      { type: 'setWorkers', payload: { building: 'quarry', count: 2 } },
      { type: 'setWorkers', payload: { building: 'lumberMill', count: 1 } },
    ]);
  });

  it('decide igual em qualquer ritmo: horas reais vezes taxa por hora real', async () => {
    const decide = async (timeScale: number) => {
      const base = withWorkers(freshView(timeScale), { farm: 2, quarry: 3 });
      // As mesmas 6 horas de jogo até o inverno, no relógio de cada ritmo.
      const view = autumn(base, firewood(216, 0, 120), 6 / timeScale);
      const { act, orders } = recorder(view);
      await guardarLenha.run(view, act);
      return orders;
    };
    expect(await decide(3)).toEqual(await decide(1));
    expect(await decide(0.5)).toEqual(await decide(1));
  });
});

describe('política "ampliar o estoque"', () => {
  type Row = ViewState['resources'][number];

  /** A visão com os campos de limite de alguns recursos trocados. */
  function withStores(
    view: ViewState,
    changes: Partial<Record<ResourceId, Partial<Row>>>,
  ): ViewState {
    return {
      ...view,
      resources: view.resources.map((row) => ({ ...row, ...changes[row.id] })),
    };
  }
  /** A obra de um depósito, pronta para começar (ou travada por `blockedCode`). */
  const depot = (
    building: 'granary' | 'warehouse',
    blockedCode: Parameters<typeof upgrade>[2] = null,
  ) => upgrade(building, {}, blockedCode);
  const wasting = (perHour: number): Partial<Row> => ({ full: true, wastingPerHour: perHour });
  const fillsIn = (hours: number): Partial<Row> => ({ fullInSeconds: hours * 3600 });
  const decide = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    const after = await ampliarEstoque.run(view, act);
    return { orders, untouched: after === view };
  };
  const both = [depot('granary'), depot('warehouse')];

  it('a visão diz qual edifício amplia cada recurso, e o ouro não tem nenhum', () => {
    expect(freshView().resources.map((row) => [row.id, row.storageBuilding])).toEqual([
      ['food', 'granary'],
      ['wood', 'warehouse'],
      ['stone', 'warehouse'],
      ['gold', null],
    ]);
  });

  it('sem depósito enchendo nem obra travada pelo limite, não dá ordem', async () => {
    const view = withUpgrades(freshView(), both);
    expect(await decide(view)).toEqual({ orders: [], untouched: true });
  });

  it('constrói o depósito do recurso que está cheio e perdendo produção', async () => {
    const view = withStores(withUpgrades(freshView(), both), { wood: wasting(24) });
    expect((await decide(view)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'warehouse' } },
    ]);
  });

  it('entre dois depósitos cheios, o que perde mais por hora', async () => {
    const view = withStores(withUpgrades(freshView(), both), {
      food: wasting(55),
      stone: wasting(10),
    });
    expect((await decide(view)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'granary' } },
    ]);
  });

  it('cheio mas sem perder nada, não é urgência', async () => {
    const view = withStores(withUpgrades(freshView(), both), { wood: wasting(0) });
    expect(await decide(view)).toEqual({ orders: [], untouched: true });
  });

  it('amplia o que enche em menos de 8 horas reais; além disso, espera', async () => {
    const soon = withStores(withUpgrades(freshView(), both), { wood: fillsIn(7.9) });
    expect((await decide(soon)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'warehouse' } },
    ]);
    const later = withStores(withUpgrades(freshView(), both), { wood: fillsIn(8) });
    expect(await decide(later)).toEqual({ orders: [], untouched: true });
    // Dos que enchem logo, o que enche antes.
    const two = withStores(withUpgrades(freshView(), both), {
      food: fillsIn(2),
      wood: fillsIn(5),
    });
    expect((await decide(two)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'granary' } },
    ]);
  });

  it('o prazo é em horas reais: o mesmo estoque, no ritmo 3, enche em um terço do tempo', async () => {
    // 18 horas de jogo para encher: fora do horizonte no ritmo 1, dentro no ritmo 3.
    const slow = withStores(withUpgrades(freshView(1), both), { wood: fillsIn(18) });
    expect((await decide(slow)).orders).toEqual([]);
    const fast = withStores(withUpgrades(freshView(3), both), { wood: fillsIn(18 / 3) });
    expect((await decide(fast)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'warehouse' } },
    ]);
  });

  it('a obra que não cabe no limite vem primeiro: amplia o depósito do recurso que não cabe', async () => {
    // O Salão pede 875 de madeira e o Pátio guarda 500. A comida também está indo ao chão.
    const hall = {
      ...upgrade('townHall', { wood: 755 }, 'EXCEEDS_STORAGE'),
      cost: [
        { resource: 'wood' as const, label: 'Madeira', amount: 875, missing: 755 },
        { resource: 'gold' as const, label: 'Ouro', amount: 583, missing: 333 },
      ],
    };
    const view = withStores(withUpgrades(freshView(), [hall, ...both]), { food: wasting(55) });
    expect(view.resources.find((row) => row.id === 'wood')?.cap).toBe(500);
    expect((await decide(view)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'warehouse' } },
    ]);
  });

  it('se o depósito mais urgente não pode começar, tenta o seguinte; se nenhum pode, não dá ordem', async () => {
    const stores = { food: wasting(55), wood: fillsIn(3) };
    const granaryWaits = withStores(
      withUpgrades(freshView(), [depot('granary', 'INSUFFICIENT_RESOURCES'), depot('warehouse')]),
      stores,
    );
    expect((await decide(granaryWaits)).orders).toEqual([
      { type: 'startConstruction', payload: { building: 'warehouse' } },
    ]);
    const gated = withStores(
      withUpgrades(freshView(), [
        depot('granary', 'GATE_LOCKED'),
        depot('warehouse', 'GATE_LOCKED'),
      ]),
      stores,
    );
    expect(await decide(gated)).toEqual({ orders: [], untouched: true });
    // Com a fila ocupada pela obra que `obra mais barata` acabou de iniciar, também não.
    const busy = withStores(
      withUpgrades(freshView(), [depot('granary', 'QUEUE_BUSY'), depot('warehouse', 'QUEUE_BUSY')]),
      stores,
    );
    expect(await decide(busy)).toEqual({ orders: [], untouched: true });
  });

  it('não gasta a madeira da lareira', async () => {
    const warehouse = {
      ...depot('warehouse'),
      cost: [{ resource: 'wood' as const, label: 'Madeira', amount: 160, missing: 0 }],
    };
    const base = withStores(withUpgrades(freshView(), [warehouse]), { stone: wasting(10) });
    // 120 de madeira em estoque e o inverno pede 60 deles: os 160 da obra não sobram.
    const view: ViewState = {
      ...base,
      calendar: {
        ...base.calendar,
        nextSeason: {
          ...base.calendar.nextSeason,
          id: 'winter',
          firewood: {
            perHour: 9,
            winterTotal: 60,
            winterProduction: 0,
            stock: 120,
            reserved: 0,
            missing: 0,
            text: 'A conta da lenha.',
          },
        },
      },
    };
    expect(await decide(view)).toEqual({ orders: [], untouched: true });
  });

  it('"obra mais barata" deixa os depósitos para esta política', async () => {
    // O Armazém sai mais barato que a Fazenda, e mesmo assim a obra iniciada é a Fazenda.
    const farm = {
      ...upgrade('farm', {}, null),
      cost: [{ resource: 'wood' as const, label: 'Madeira', amount: 110, missing: 0 }],
    };
    const cheapDepot = {
      ...depot('warehouse'),
      cost: [{ resource: 'wood' as const, label: 'Madeira', amount: 10, missing: 0 }],
    };
    const view = withUpgrades(freshView(), [cheapDepot, farm]);
    const { act, orders } = recorder(view);
    await obraMaisBarata.run(view, act);
    expect(orders).toEqual([{ type: 'startConstruction', payload: { building: 'farm' } }]);
    const onlyDepots = withUpgrades(freshView(), both);
    const idle = recorder(onlyDepots);
    expect(await obraMaisBarata.run(onlyDepots, idle.act)).toBe(onlyDepots);
    expect(idle.orders).toEqual([]);
  });
});

describe('política "obra mais barata" com o inverno à vista', () => {
  const forecast = (winterTotal: number, winterProduction: number, stock: number) => ({
    perHour: 9,
    winterTotal,
    winterProduction,
    stock,
    reserved: 0,
    missing: Math.max(0, winterTotal - winterProduction - stock),
    text: 'A conta da lenha.',
  });
  const cheap: ViewState['constructions']['available'][number] = {
    ...upgrade('housing', {}, null),
    cost: [
      { resource: 'wood', label: 'Madeira', amount: 80, missing: 0 },
      { resource: 'stone', label: 'Pedra', amount: 20, missing: 0 },
    ],
    affordable: true,
    blockedReason: null,
  };
  const withForecast = (view: ViewState, firewood: ReturnType<typeof forecast>): ViewState => ({
    ...view,
    calendar: {
      ...view.calendar,
      nextSeason: { ...view.calendar.nextSeason, id: 'winter', firewood },
    },
  });

  it('não começa a obra que gastaria a madeira da lareira', async () => {
    // 120 de madeira; o inverno pede 60 do estoque. A obra de 80 deixaria 40.
    const view = withForecast(withUpgrades(freshView(), [cheap]), forecast(60, 0, 120));
    const { act, orders } = recorder(view);
    expect(await obraMaisBarata.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });

  it('começa quando a madeira que sobra depois da reserva paga a obra', async () => {
    // A Serraria repõe 30 dos 60: a reserva cai para 30, e sobram 90 para a obra de 80.
    const view = withForecast(withUpgrades(freshView(), [cheap]), forecast(60, 30, 120));
    const { act, orders } = recorder(view);
    await obraMaisBarata.run(view, act);
    expect(orders).toEqual([{ type: 'startConstruction', payload: { building: 'housing' } }]);
  });

  it('uma obra que não gasta madeira começa de qualquer jeito', async () => {
    const stoneOnly = {
      ...cheap,
      building: 'quarry' as const,
      cost: [{ resource: 'stone' as const, label: 'Pedra', amount: 50, missing: 0 }],
    };
    const view = withForecast(withUpgrades(freshView(), [cheap, stoneOnly]), forecast(600, 0, 120));
    const { act, orders } = recorder(view);
    await obraMaisBarata.run(view, act);
    expect(orders).toEqual([{ type: 'startConstruction', payload: { building: 'quarry' } }]);
  });
});

describe('política "planejar automáticas"', () => {
  type Upgrade = ViewState['constructions']['available'][number];
  type Planned = ViewState['constructions']['planned'][number];
  const forecast = (winterTotal: number, winterProduction: number, stock: number) => ({
    perHour: 9,
    winterTotal,
    winterProduction,
    stock,
    reserved: 0,
    missing: Math.max(0, winterTotal - winterProduction - stock),
    text: 'A conta da lenha.',
  });
  /** O outono com a conta da lenha: a reserva é o que o inverno queima menos o que a Serraria repõe. */
  const inAutumn = (view: ViewState, firewood: ReturnType<typeof forecast>): ViewState => ({
    ...view,
    calendar: {
      ...view.calendar,
      nextSeason: { ...view.calendar.nextSeason, id: 'winter', firewood },
    },
  });
  /** Uma obra que custa `wood` de madeira e não pôde começar. */
  const waiting = (
    building: BuildingId,
    wood: number,
    blockedCode: Upgrade['blockedCode'] = 'INSUFFICIENT_RESOURCES',
  ): Upgrade => ({
    ...upgrade(building, {}, blockedCode),
    cost: [{ resource: 'wood', label: 'Madeira', amount: wood, missing: wood }],
  });
  const stoneOnly = (building: BuildingId): Upgrade => ({
    ...upgrade(building, {}, 'QUEUE_LOCKED'),
    cost: [{ resource: 'stone', label: 'Pedra', amount: 50, missing: 0 }],
  });
  const inList = (entry: Upgrade, autoStart: boolean): Planned => ({
    ...entry,
    planned: true,
    autoStart,
    waiting: { reason: 'resources', text: 'espera madeira', etaSeconds: null },
  });
  const withPlanned = (view: ViewState, planned: Planned[]): ViewState => ({
    ...view,
    constructions: {
      ...view.constructions,
      planned,
      available: [
        ...planned.map((entry): Upgrade => ({ ...upgrade(entry.building, {}), planned: true })),
        ...view.constructions.available,
      ],
    },
  });
  const decide = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    await planejarAutomaticas.run(view, act);
    return orders;
  };
  const plan = (building: BuildingId) => ({
    type: 'planConstruction',
    // O bot manda o nível que a visão mostrou, como o app.
    payload: { building, autoStart: true, targetLevel: 2 },
  });

  it('planeja como automáticas as obras que não puderam começar, da mais barata à mais cara', async () => {
    const view = withUpgrades(freshView(), [
      waiting('townHall', 150),
      waiting('housing', 80, 'QUEUE_LOCKED'),
      waiting('quarry', 120),
    ]);
    expect(await decide(view)).toEqual([plan('housing'), plan('quarry'), plan('townHall')]);
  });

  it('a obra que espera o Salão ou um depósito maior também entra: começa quando destravar', async () => {
    const view = withUpgrades(freshView(), [
      waiting('farm', 128, 'GATE_LOCKED'),
      waiting('townHall', 875, 'EXCEEDS_STORAGE'),
    ]);
    expect(await decide(view)).toEqual([plan('farm'), plan('townHall')]);
  });

  it('a obra que podia começar e ficou para trás entra também: com fila, começa na hora', async () => {
    // Duas obras cabiam no estoque e a visita só iniciou uma: a outra não espera a próxima.
    const view = withUpgrades(freshView(), [waiting('housing', 80, null)]);
    expect(await decide(view)).toEqual([plan('housing')]);
  });

  it('não planeja de novo o que já está na lista, nem a obra que chegou ao teto', async () => {
    const view = withPlanned(
      withUpgrades(freshView(), [waiting('quarry', 120), waiting('goldMine', 120, 'MAX_LEVEL')]),
      [inList(waiting('housing', 80), true)],
    );
    expect(await decide(view)).toEqual([plan('quarry')]);
  });

  it('os depósitos só entram quando valem a obra, e entram na frente', async () => {
    const depots = [waiting('granary', 160, 'QUEUE_LOCKED'), waiting('warehouse', 160)];
    const idle = withUpgrades(freshView(), [waiting('housing', 80), ...depots]);
    expect(await decide(idle)).toEqual([plan('housing')]);
    // A madeira cheia e indo ao chão: o Armazém vale a obra, e é o primeiro da lista.
    const wasting: ViewState = {
      ...idle,
      resources: idle.resources.map((row) =>
        row.id === 'wood' ? { ...row, full: true, wastingPerHour: 24 } : row,
      ),
    };
    expect(await decide(wasting)).toEqual([plan('warehouse'), plan('housing')]);
  });

  it('com a lareira dependendo do estoque, nenhuma obra que gaste madeira fica automática', async () => {
    // O inverno queima 300 e a Serraria repõe 100: a lareira precisa de 200 do estoque.
    const view = inAutumn(
      withPlanned(withUpgrades(freshView(), [waiting('quarry', 120), stoneOnly('goldMine')]), [
        inList(waiting('housing', 80), true),
        inList(stoneOnly('farm'), true),
      ]),
      forecast(300, 100, 500),
    );
    expect(await decide(view)).toEqual([
      // A da lista que gasta madeira perde a marca; a que não gasta continua automática.
      { type: 'setAutoStart', payload: { building: 'housing', autoStart: false, targetLevel: 2 } },
      // Das novas, só a que não gasta madeira.
      plan('goldMine'),
    ]);
  });

  it('quando a Serraria sozinha cobre a lareira, marca de novo o que tinha desmarcado', async () => {
    const view = inAutumn(
      withPlanned(withUpgrades(freshView(), [waiting('quarry', 120)]), [
        inList(waiting('housing', 80), false),
      ]),
      forecast(300, 400, 20),
    );
    expect(await decide(view)).toEqual([
      { type: 'setAutoStart', payload: { building: 'housing', autoStart: true, targetLevel: 2 } },
      plan('quarry'),
    ]);
  });

  it('com tudo planejado e marcado, não dá ordem nenhuma', async () => {
    const view = withPlanned(withUpgrades(freshView(), []), [inList(waiting('housing', 80), true)]);
    expect(await decide(view)).toEqual([]);
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
    /** O teste mexe no estoque; o bot continua só com a visão. */
    const spendWoodDownTo = (units: number) => {
      const spent = structuredClone(state);
      spent.settlement.resources.wood = units * 1000;
      spent.settlement.accumulators.wood = 0;
      state = spent;
    };
    return { view, act, pass, orders, refused, spendWoodDownTo };
  }

  it.each([1, 3, 0.5])(
    'o preguiçoso, no ritmo %d, deixa a comida no positivo e ninguém sem ofício',
    async (timeScale) => {
      const feudo = game(timeScale);
      for (let visit = 0; visit < 10; visit += 1) {
        await strategies.preguicoso(feudo.view(), feudo.act);
        expect(feudo.view().population.free).toBe(0);
        // Quem acabou de ir para a fazenda rende metade por um dia de jogo: o bot faz a conta
        // com o que o lavrador rende adaptado. Passada a adaptação, o saldo cobre as bocas,
        // inclusive as de quem ainda estava chegando.
        feudo.pass(2);
        const food = feudo.view().resources.find((row) => row.id === 'food');
        expect(food?.perHour).toBeGreaterThanOrEqual(0);
        // Um dia real entre as visitas.
        feudo.pass(24 * timeScale - 2);
      }
      expect(feudo.refused).toEqual([]);
      expect(feudo.view().famine).toBeNull();
    },
  );

  it('o preguiçoso dá poucas ordens por visita: uma obra, um depósito, um recrutamento e a lista', async () => {
    const feudo = game(1);
    const of = (session: Order[], type: Command['type']) =>
      session.filter((order) => order.type === type);
    for (let visit = 0; visit < 7; visit += 1) {
      const before = feudo.orders.length;
      await strategies.preguicoso(feudo.view(), feudo.act);
      const session = feudo.orders.slice(before);
      // No máximo a obra mais barata e um depósito, iniciados por ordem.
      expect(of(session, 'startConstruction').length).toBeLessThanOrEqual(2);
      expect(of(session, 'recruitVillagers').length).toBeLessThan(2);
      // A lista de planejadas: cada edifício entra uma vez, e ninguém é desplanejado.
      const planned = of(session, 'planConstruction').map(
        (order) => (order.payload as { building: string }).building,
      );
      expect(new Set(planned).size).toBe(planned.length);
      expect(of(session, 'unplanConstruction')).toEqual([]);
      // Fora a lista, a visita cabe em meia dúzia de ordens.
      expect(session.length - planned.length).toBeLessThanOrEqual(6);
      feudo.pass(24);
    }
    expect(feudo.refused).toEqual([]);
  });

  it.each(['economico', 'preguicoso'] as const)(
    'o %s deixa obras planejadas, e elas começam sozinhas antes da visita seguinte',
    async (strategy) => {
      const feudo = game(1);
      const started: string[] = [];
      for (let visit = 0; visit < 4; visit += 1) {
        await strategies[strategy](feudo.view(), feudo.act);
        const planned = feudo.view().constructions.planned;
        // O que ficou na lista é automático e diz o que espera.
        for (const entry of planned) {
          expect(entry.autoStart).toBe(true);
          expect(entry.waiting).not.toBeNull();
        }
        const levels = new Map(
          feudo.view().constructions.available.map((entry) => [entry.building, entry.fromLevel]),
        );
        // Um dia real sem ninguém no feudo.
        feudo.pass(24);
        const after = feudo.view();
        for (const entry of planned) {
          const still = after.constructions.planned.some((row) => row.building === entry.building);
          const level =
            after.constructions.available.find((row) => row.building === entry.building)
              ?.fromLevel ?? Infinity;
          if (!still && level > (levels.get(entry.building) ?? 0)) {
            started.push(entry.building);
          }
        }
      }
      expect(feudo.refused).toEqual([]);
      // Em quatro dias, várias obras subiram de nível sem ordem nenhuma de início.
      expect(started.length).toBeGreaterThanOrEqual(3);
    },
  );

  it.each([1, 3, 0.5])(
    'o econômico, no ritmo %d, acode a fome mesmo com a fazenda rendendo menos',
    async (timeScale) => {
      const feudo = game(timeScale);
      // Três aldeões a mais, e ninguém na fazenda: a comida acaba com oito bocas no feudo.
      await feudo.act('recruitVillagers', { quantity: 3 });
      expect(feudo.refused).toEqual([]);
      // Dez horas de jogo: a fome já dura umas cinco, e ainda não levou ninguém embora.
      feudo.pass(10);
      expect(feudo.view().famine).not.toBeNull();
      expect(feudo.view().population.villagers).toBe(8);
      await alocarPorDemanda.run(feudo.view(), feudo.act);
      expect(feudo.refused).toEqual([]);
      // Na fome um fazendeiro rende três quartos: um só não alimenta oito bocas. São dois para
      // alimentar e, como há vaga nas Habitações, mais um para a comida pagar os recrutas.
      const after = feudo.view();
      expect(after.workers.find((row) => row.building === 'farm')?.assigned).toBe(3);
      // Os três chegam agora e rendem metade; ainda assim cobrem as oito bocas, e a fome acaba
      // na hora. Passada a adaptação, a comida sobra.
      expect(after.workers.find((row) => row.building === 'farm')?.adapting).toBe(3);
      expect(after.famine).toBeNull();
      feudo.pass(2);
      expect(feudo.view().famine).toBeNull();
      expect(feudo.view().resources.find((row) => row.id === 'food')?.perHour).toBeGreaterThan(0);
    },
  );

  it.each(['economico', 'preguicoso'] as const)(
    'o %s, avisado no outono de que falta lenha, atravessa o inverno sem frio',
    async (strategy) => {
      const feudo = game(1);
      // Primavera, verão e quase todo o outono com o bot jogando uma vez a cada dois dias reais.
      for (let visit = 0; visit < 3; visit += 1) {
        await strategies[strategy](feudo.view(), feudo.act);
        feudo.pass(46);
      }
      // 138 horas de jogo: faltam 6 para o inverno. O senhor tirou todos da Serraria e gastou
      // a madeira: restam 5.
      const row = (building: BuildingId) =>
        feudo.view().workers.find((entry) => entry.building === building)?.assigned ?? 0;
      const moved = row('lumberMill');
      await feudo.act('setWorkers', { building: 'lumberMill', count: 0 });
      await feudo.act('setWorkers', { building: 'quarry', count: row('quarry') + moved });
      feudo.spendWoodDownTo(5);
      const before = feudo.view();
      expect(row('lumberMill')).toBe(0);
      expect(before.calendar.season).toBe('autumn');
      expect(before.calendar.nextSeason.firewood?.missing).toBeGreaterThan(0);

      await strategies[strategy](feudo.view(), feudo.act);
      expect(feudo.refused).toEqual([]);
      const lumberjacks = feudo.view().workers.find((row) => row.building === 'lumberMill');
      expect(lumberjacks?.assigned).toBeGreaterThan(0);

      // O inverno inteiro, com uma visita por dia real.
      feudo.pass(6);
      let coldSeen = false;
      for (let hour = 0; hour < 24; hour += 1) {
        if (hour % 24 === 0) {
          await strategies[strategy](feudo.view(), feudo.act);
        }
        feudo.pass(1);
        coldSeen ||= feudo.view().winter?.cold != null;
      }
      expect(coldSeen).toBe(false);
      expect(feudo.refused).toEqual([]);
      expect(feudo.view().calendar.season).toBe('spring');
    },
  );

  it('o econômico destrava a obra que não cabe no Pátio: constrói o Armazém e o Salão segue', async () => {
    const feudo = game(1);
    let blocked = false;
    // Quatro visitas por dia real, uma semana.
    for (let visit = 0; visit < 28; visit += 1) {
      blocked ||= feudo
        .view()
        .constructions.available.some((entry) => entry.blockedCode === 'EXCEEDS_STORAGE');
      await strategies.economico(feudo.view(), feudo.act);
      feudo.pass(6);
    }
    expect(feudo.refused).toEqual([]);
    // No caminho, uma obra pediu mais do que o depósito guardava...
    expect(blocked).toBe(true);
    // ...o bot ergueu o Armazém, e o Salão passou do nível em que travaria (4 → 5 pede 875).
    // (O Armazém pode estar em obras de novo neste instante: quem diz que ele existe é o depósito
    // da madeira, que deixou de ser o Pátio.)
    const view = feudo.view();
    const wood = view.resources.find((row) => row.id === 'wood');
    expect(wood?.storageLabel).toBe('Armazém');
    expect(wood?.cap).toBeGreaterThan(500);
    expect(view.settlement.townHallLevel).toBeGreaterThanOrEqual(5);
    expect(
      feudo.orders.filter(
        (order) =>
          order.type === 'startConstruction' &&
          (order.payload as { building: string }).building === 'warehouse',
      ).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it.each([1, 3])(
    'o econômico, no ritmo %d, não troca todo mundo de ofício a cada visita',
    async (timeScale) => {
      const feudo = game(timeScale);
      const assigned = () =>
        Object.fromEntries(feudo.view().workers.map((row) => [row.building, row.assigned]));
      let switched = 0;
      let hands = 0;
      // Duas visitas por dia real, uma semana.
      for (let visit = 0; visit < 14; visit += 1) {
        const before = assigned();
        const free = feudo.view().population.free;
        await strategies.economico(feudo.view(), feudo.act);
        const after = assigned();
        const arrived = Object.keys(after).reduce(
          (sum, building) => sum + Math.max(0, (after[building] ?? 0) - (before[building] ?? 0)),
          0,
        );
        // Quem chegou a um edifício e não estava sem ofício veio de outro: trocou de ofício.
        switched += Math.max(0, arrived - free);
        hands += feudo.view().population.villagers;
        feudo.pass(12 * timeScale);
      }
      expect(feudo.refused).toEqual([]);
      // Em catorze visitas, menos de uma troca a cada dez trabalhadores por visita.
      expect(switched).toBeLessThan(hands / 10);
      // E os ofícios dos materiais ganharam experiência: nenhum ficou vazio à toa. (A fazenda
      // sobe de nível e pede menos braços do que níveis: lá a experiência não é a meta.)
      for (const row of feudo.view().workers.filter((entry) => entry.resource !== 'food')) {
        expect(row.experience, row.building).toBeGreaterThan(0);
        expect(row.experienceTrend, row.building).not.toBe('falling');
      }
    },
  );

  it.each(['economico', 'preguicoso'] as const)(
    'o %s, visitando duas vezes por dia no ritmo 3, não deixa a moral cair nem perde ninguém',
    async (strategy) => {
      const feudo = game(3);
      const morales: number[] = [];
      for (let visit = 0; visit < 14; visit += 1) {
        await strategies[strategy](feudo.view(), feudo.act);
        // 12 horas reais entre as visitas: 36 de jogo, 18 viradas de dia.
        for (let hour = 0; hour < 36; hour += 2) {
          feudo.pass(2);
          morales.push(feudo.view().morale.value);
        }
        // O bot deixa uma cama vazia quando o feudo é grande: as casas não ficam cheias.
        const { villagers, capacity } = feudo.view().population;
        if (villagers >= 20) {
          expect(villagers).toBeLessThan(capacity);
        }
      }
      expect(feudo.refused).toEqual([]);
      // A moral nunca sai das faixas de cima: o pior dia é o de casas cheias sem comida guardada.
      expect(Math.min(...morales)).toBeGreaterThanOrEqual(40);
      expect(Math.max(...morales)).toBe(60);
      // Com o feudo crescido, a comida guardada vale o bônus quase sempre.
      const late = morales.slice(-90);
      expect(late.filter((value) => value === 60).length).toBeGreaterThan(80);
      expect(feudo.view().population.villagers).toBeGreaterThan(20);
    },
  );

  it('o preguiçoso acode a fome quando ela chega', async () => {
    const feudo = game(1);
    // Ninguém na fazenda: a comida acaba e a fome se instala.
    feudo.pass(48);
    expect(feudo.view().famine).not.toBeNull();
    await strategies.preguicoso(feudo.view(), feudo.act);
    expect(feudo.refused).toEqual([]);
    // Quem foi para a fazenda rende metade por um dia de jogo: a fome acaba com a adaptação.
    feudo.pass(2);
    expect(feudo.view().famine).toBeNull();
    expect(feudo.view().resources.find((row) => row.id === 'food')?.perHour).toBeGreaterThan(0);
  });
});

describe('bot honesto', () => {
  const directory = fileURLToPath(new URL('.', import.meta.url));
  const sources = readdirSync(directory)
    .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map((name) => ({ name, text: readFileSync(`${directory}/${name}`, 'utf8') }));

  it('os bots só conhecem os tipos do motor: nunca o estado, o avanço, os sorteios nem o conteúdo', () => {
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
      // Nem o conteúdo: taxa, consumo, fator de estação ou efeito de carta que a visão não
      // mostra, o jogador não vê, e o bot também não. Dos pacotes do jogo, só os tipos do motor.
      expect(code, name).not.toMatch(/@lotg\/content/);
      const packages = [...code.matchAll(/from '(@lotg\/[^']+)'/g)].map((match) => match[1]);
      expect(
        [...new Set(packages)].filter((id) => id !== '@lotg/engine'),
        name,
      ).toEqual([]);
    }
    // A conferência enxerga os imports: os tipos do motor entram por `import type`.
    expect(sources.some(({ text }) => /import type [^;]*from '@lotg\/engine';/.test(text))).toBe(
      true,
    );
  });
});
