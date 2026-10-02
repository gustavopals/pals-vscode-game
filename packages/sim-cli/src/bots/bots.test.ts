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

import { botFor, strategies, strategyPolicies } from './index';
import {
  alocarPorDemanda,
  alocarPorDemandaFor,
  ampliarEstoque,
  comidaPrimeiro,
  DEFAULT_AWAY_HOURS,
  erguerPalicada,
  erguerTorre,
  guardarLenha,
  nothingLeftToBuild,
  obraMaisBarata,
  ocuparLivres,
  planejarAutomaticas,
  recrutar,
  responderCartas,
  responderCartasSemGastar,
  seguirObjetivos,
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

/**
 * A visão com a comida em ordem no painel: o estoque não está caindo e a previsão da estação
 * que vem diz que ele atravessa a estação. `forecast` troca o que a previsão diz.
 */
function fedView(
  view: ViewState,
  forecast: Partial<NonNullable<ViewState['calendar']['nextSeason']['food']>> = {},
): ViewState {
  return {
    ...view,
    resources: view.resources.map((row) =>
      row.id === 'food' ? { ...row, depletesInSeconds: null } : row,
    ),
    calendar: {
      ...view.calendar,
      nextSeason: {
        ...view.calendar.nextSeason,
        food: { perHour: 1, stockAtTurn: 300, depletesInSeconds: null, text: '', ...forecast },
      },
    },
  };
}

/** A visão com o estoque de alguns recursos trocado. */
function withStock(view: ViewState, stock: Partial<Record<ResourceId, number>>): ViewState {
  return {
    ...view,
    resources: view.resources.map((row) => ({ ...row, stock: stock[row.id] ?? row.stock })),
  };
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
    // As obras antes do recrutamento: o bot olha o painel como o encontrou, com o depósito
    // cheio e a produção indo ao chão, antes de gastar a comida em aldeões. A Paliçada vem na
    // frente de tudo, e só quando os vigias dizem que há risco. Depois, os Objetivos do
    // Senhor: o passo que cada um pede. A Torre de Vigia, fora do objetivo dela, vem na frente
    // das outras obras, e só com folga: sem ela, a fila é das obras que rendem. O Conselho vem
    // depois: o que o bot gasta com uma carta é o que sobrou da visita. O econômico investe
    // com folga; o preguiçoso responde sem gastar.
    expect(strategyPolicies.economico).toEqual([
      erguerPalicada,
      seguirObjetivos,
      erguerTorre,
      obraMaisBarata,
      ampliarEstoque,
      planejarAutomaticas,
      recrutar,
      responderCartas,
      alocarPorDemanda,
      guardarLenha,
    ]);
    expect(strategyPolicies.preguicoso).toEqual([
      erguerPalicada,
      seguirObjetivos,
      erguerTorre,
      obraMaisBarata,
      ampliarEstoque,
      planejarAutomaticas,
      recrutar,
      responderCartasSemGastar,
      comidaPrimeiro,
      ocuparLivres,
      guardarLenha,
    ]);
    expect(Object.keys(strategies)).toEqual(Object.keys(strategyPolicies));
    const names = [
      responderCartas,
      responderCartasSemGastar,
      recrutar,
      obraMaisBarata,
      ampliarEstoque,
      erguerTorre,
      erguerPalicada,
      seguirObjetivos,
      planejarAutomaticas,
      alocarPorDemanda,
      comidaPrimeiro,
      ocuparLivres,
      guardarLenha,
    ].map((policy) => policy.name);
    expect(names).toEqual([
      'responder a carta',
      'responder a carta sem gastar',
      'recrutar',
      'obra mais barata',
      'ampliar o estoque',
      'erguer a Torre',
      'erguer a Paliçada',
      'seguir os objetivos',
      'planejar automáticas',
      'alocar por demanda',
      'comida primeiro',
      'ocupar os livres',
      'guardar lenha',
    ]);
  });

  it('o econômico prepara a ausência de quem o joga: o prazo sai das visitas por dia', async () => {
    // Um jogador sabe quando volta. No ritmo 3, dois lavradores enchem a Despensa do feudo novo
    // em menos de 6 horas reais: quem volta em 12 deixa um só; quem volta em 3 pode deixar os
    // dois. O preguiçoso decide o mínimo e não olha o relógio.
    const farmers = async (sessionsPerDay: number) => {
      const view = fedView(freshView(3));
      const orders: Order[] = [];
      const act: Act = async (type, payload) => {
        orders.push({ type, payload });
        return view;
      };
      await botFor('economico', sessionsPerDay)(view, act);
      const farm = orders.filter(
        (order) =>
          order.type === 'setWorkers' &&
          (order.payload as { building: string }).building === 'farm',
      );
      return (farm.at(-1)?.payload as { count: number }).count;
    };
    expect(await farmers(2)).toBe(1);
    expect(await farmers(8)).toBe(2);
    expect(24 / 2).toBe(DEFAULT_AWAY_HOURS);
    expect(botFor('preguicoso', 1)).toBe(strategies.preguicoso);
    expect(botFor('preguicoso', 4)).toBe(strategies.preguicoso);
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

  it('no ritmo 0,5 decide o mesmo que no ritmo 1: com folga na despensa, o ritmo não pesa', async () => {
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await alocarPorDemanda.run(view, act);
      return orders;
    };
    expect(await decide(freshView(0.5))).toEqual(await decide(freshView(1)));
  });

  it('no ritmo 3 a mesma ausência vale o triplo em horas de jogo: o segundo lavrador plantaria para o chão', async () => {
    // O bot arruma o feudo para 12 horas reais fora. No ritmo 1, dois lavradores põem 9 de
    // comida por hora na Despensa, e os 320 de espaço duram a ausência. No ritmo 3 eles põem 57
    // por hora real e a enchem em menos de 6 horas: fica um só, e o outro vai para a madeira.
    const decide = async (timeScale: number) => {
      const view = fedView(freshView(timeScale));
      const { act, orders } = recorder(view);
      await alocarPorDemanda.run(view, act);
      return targets(orders);
    };
    expect(DEFAULT_AWAY_HOURS).toBe(12);
    expect(await decide(1)).toEqual({ farm: 2, lumberMill: 1, quarry: 1, goldMine: 1 });
    expect(await decide(3)).toEqual({ farm: 1, lumberMill: 2, quarry: 1, goldMine: 1 });
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
      // O saldo de cada recurso é o que o edifício dele rende; a comida desconta as 12 bocas.
      const gross = (resource: ResourceId) =>
        workers.find((row) => row.resource === resource)?.grossPerHour ?? 0;
      return {
        ...view,
        workers,
        resources: view.resources.map((row) => ({
          ...row,
          perHour: gross(row.id) - (row.id === 'food' ? 12 : 0),
        })),
      };
    }
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await alocarPorDemanda.run(view, act);
      return targets(orders);
    };
    /**
     * O mesmo feudo com depósitos folgados: a madeira e a pedra de uma ausência inteira cabem,
     * e o que decide a partilha é só o que as obras pedem.
     */
    const roomy = (view: ViewState): ViewState => ({
      ...view,
      resources: view.resources.map((row) => (row.cap === null ? row : { ...row, cap: 5000 })),
    });
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
      const view = roomy(staffed({ farm: 2, lumberMill: 2, quarry: 3, goldMine: 2 }));
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
      const oneExtra = roomy(staffed({ farm: 3, lumberMill: 4, quarry: 3, goldMine: 2 }));
      expect(await decide(oneExtra)).toEqual({});
      const twoExtra = roomy(staffed({ farm: 4, lumberMill: 4, quarry: 2, goldMine: 2 }));
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

    describe('ninguém fica produzindo para o chão', () => {
      /** O feudo de 12 aldeões com a experiência de um ofício trocada. */
      const skilled = (view: ViewState, building: BuildingId, experience: number): ViewState => ({
        ...view,
        workers: view.workers.map((row) =>
          row.building === building ? { ...row, experience } : row,
        ),
      });
      const full = { wood: 500, stone: 500 };

      it('com o Armazém cheio e nada pedindo madeira nem pedra, os braços vão para o ouro', async () => {
        // Um lenhador rende 8 por hora e o Pátio guarda 500: cheio, nada do que ele corta cabe.
        // Fica um em cada ofício, para o edifício não esvaziar, e os outros seis vão para a Mina,
        // que não tem limite. Ninguém espera a troca "compensar": ficar é perder tudo.
        const view = withStock(staffed({ farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 }), full);
        expect(await decide(view)).toEqual({ lumberMill: 1, quarry: 1, goldMine: 8 });
      });

      it('com espaço no depósito ficam os braços cuja produção cabe na ausência', async () => {
        // 96 de espaço e 12 horas fora: 8 por hora, a produção de um lenhador. Com 200 de
        // espaço cabem dois (16 por hora). Com 500, a partilha de sempre não é tocada.
        const lumberjacks = async (wood: number) =>
          (
            await decide(
              withStock(staffed({ farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 }), {
                wood,
                stone: 500,
              }),
            )
          ).lumberMill;
        expect(await lumberjacks(404)).toBe(1);
        expect(await lumberjacks(300)).toBe(2);
        expect(await lumberjacks(0)).toBeUndefined();
      });

      it('quem volta antes pode deixar mais braços: o prazo da ausência é do bot, não do jogo', async () => {
        const view = withStock(staffed({ farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 }), {
          wood: 404,
          stone: 500,
        });
        const moved = async (awayHours: number) => {
          const { act, orders } = recorder(view);
          await alocarPorDemandaFor(awayHours).run(view, act);
          return targets(orders).lumberMill;
        };
        // 96 de espaço: um lenhador em 12 horas, dois em 6, e nenhum além do que guarda o
        // ofício em 24.
        expect(await moved(12)).toBe(1);
        expect(await moved(6)).toBe(2);
        expect(await moved(24)).toBe(1);
      });

      it('o que as obras da lista ainda levam conta como espaço', async () => {
        // O Pátio está cheio, mas a obra das Habitações vai levar 480 de madeira quando a pouca
        // pedra que falta chegar: 40 por hora de ausência, cinco lenhadores. Os cinco ficam.
        const waiting = [upgrade('housing', { wood: 380, stone: 10 })];
        const view = withStock(
          staffed({ farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 }, {}, waiting),
          { wood: 500, stone: 65 },
        );
        expect((await decide(view)).lumberMill).toBeUndefined();
        // Com sete lenhadores, dois passam do que a obra e o depósito comportam.
        const crowded = withStock(
          staffed({ farm: 2, lumberMill: 7, quarry: 3, goldMine: 0 }, {}, waiting),
          { wood: 500, stone: 65 },
        );
        expect((await decide(crowded)).lumberMill).toBe(5);
      });

      it('uma obra presa ao Salão só conta se o Salão ainda pode subir', async () => {
        const locked = upgrade('housing', { wood: 380 }, 'GATE_LOCKED');
        const staff = { farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 };
        const rising = withStock(
          staffed(staff, {}, [locked, upgrade('townHall', { gold: 10 })]),
          full,
        );
        const stuck = withStock(
          staffed(staff, {}, [locked, upgrade('townHall', { wood: 5000 }, 'EXCEEDS_STORAGE')]),
          full,
        );
        // Com o Salão a caminho, as Habitações vão destravar e levar os 480 de madeira.
        expect((await decide(rising)).lumberMill).toBeUndefined();
        // Com o Salão sem ter como subir, nada mais leva madeira: o feudo acabou.
        expect((await decide(stuck)).lumberMill).toBe(0);
      });

      it('um depósito que ninguém planejou não é motivo para juntar madeira', async () => {
        const depot = upgrade('granary', { wood: 380 });
        const staff = { farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 };
        const unplanned = withStock(staffed(staff, {}, [depot]), full);
        const planned = withStock(staffed(staff, {}, [{ ...depot, planned: true }]), full);
        // O Celeiro fora da lista é o único item: para o bot, as obras acabaram.
        expect(nothingLeftToBuild(unplanned)).toBe(true);
        expect((await decide(unplanned)).lumberMill).toBe(0);
        // Na lista das planejadas ele é obra como as outras, e os 480 que pede contam.
        expect(nothingLeftToBuild(planned)).toBe(false);
        expect((await decide(planned)).lumberMill).toBeUndefined();
        // O depósito que trava outra obra também conta, mesmo fora da lista: o Salão pede mais
        // madeira do que o Pátio guarda, e é o Armazém que resolve.
        const blocked = withStock(
          staffed(staff, {}, [
            upgrade('townHall', { wood: 800 }, 'EXCEEDS_STORAGE'),
            upgrade('warehouse', { wood: 380 }),
          ]),
          full,
        );
        expect(nothingLeftToBuild(blocked)).toBe(false);
        // Com o Armazém no teto, o Salão não tem mais como caber: as obras acabaram.
        const capped = withStock(
          staffed(staff, {}, [
            upgrade('townHall', { wood: 800 }, 'EXCEEDS_STORAGE'),
            upgrade('warehouse', { wood: 380 }, 'MAX_LEVEL'),
          ]),
          full,
        );
        expect(nothingLeftToBuild(capped)).toBe(true);
      });

      it('enquanto a experiência sobe fica o que o edifício pede; no máximo, basta um', async () => {
        const staff = { farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 };
        const view = withStock(staffed(staff, { lumberMill: 3 }), full);
        expect(view.workersRules.experienceMax).toBe(100);
        expect((await decide(skilled(view, 'lumberMill', 40))).lumberMill).toBe(3);
        expect((await decide(skilled(view, 'lumberMill', 100))).lumberMill).toBe(1);
      });

      it('quando o feudo não tem mais o que construir, nenhum ofício fica para o chão', async () => {
        const done = [
          upgrade('housing', { wood: 380 }, 'MAX_LEVEL'),
          upgrade('townHall', { wood: 5000 }, 'EXCEEDS_STORAGE'),
          upgrade('farm', { wood: 900 }, 'GATE_LOCKED'),
        ];
        const view = withStock(
          staffed({ farm: 2, lumberMill: 5, quarry: 3, goldMine: 2 }, { lumberMill: 3 }, done),
          full,
        );
        expect(nothingLeftToBuild(view)).toBe(true);
        // A experiência já não compra nada: a Serraria e a Pedreira ficam vazias.
        expect(await decide(view)).toEqual({ lumberMill: 0, quarry: 0, goldMine: 10 });
        // Com uma obra em curso, ou sem lista nenhuma, o feudo não acabou.
        const building = {
          ...view,
          constructions: {
            ...view.constructions,
            queues: [
              {
                building: 'farm' as const,
                label: 'Fazenda',
                targetLevel: 2,
                secondsRemaining: 60,
                totalSeconds: 300,
                progressPercent: 80,
                refund: [],
              },
            ],
          },
        };
        expect(nothingLeftToBuild(building)).toBe(false);
        expect(nothingLeftToBuild(withUpgrades(view, []))).toBe(false);
      });
    });

    describe('a fazenda não planta para o chão', () => {
      /** O feudo de 12 aldeões com a Despensa cheia e a comida em ordem no painel. */
      const fullPantry = (
        assigned: Parameters<typeof staffed>[0],
        forecast: Parameters<typeof fedView>[1] = {},
      ) => fedView(withStock(staffed(assigned), { food: 500 }), forecast);

      it('com a Despensa cheia, fica só quem alimenta as bocas; o outro lavrador troca de ofício', async () => {
        // 12 bocas a 12 por lavrador: um alimenta todos, e a colheita do segundo não cabe.
        const view = fullPantry({ farm: 2, lumberMill: 4, quarry: 4, goldMine: 2 });
        const moved = await decide(view);
        expect(moved.farm).toBe(1);
        expect(Object.values(moved).reduce((sum, count) => sum + count, 0)).toBeGreaterThan(1);
      });

      it('com espaço na despensa, a conta de sempre: a folga de duas bocas fica', async () => {
        const view = fedView(staffed({ farm: 2, lumberMill: 4, quarry: 4, goldMine: 2 }));
        expect(view.resources.find((row) => row.id === 'food')).toMatchObject({
          stock: 180,
          cap: 500,
        });
        expect((await decide(view)).farm).toBeUndefined();
      });

      it('não deixa a fazenda vazia: a comida tem de aguentar outra ausência depois desta', async () => {
        // Um lavrador rende 12 e as bocas comem 12: com ele a despensa fica cheia e nada se
        // perde. Se rendesse 13, a conta "sem desperdício" pediria nenhum lavrador, e a despensa
        // de 500 perderia 144 em uma ausência e mais 144 na seguinte. Com 1.500 de estoque isso
        // seria aceitável; com 200, não: fica o lavrador, e sobra um pouco.
        const rich = (stock: number) => {
          const view = fullPantry({ farm: 1, lumberMill: 5, quarry: 4, goldMine: 2 });
          return {
            ...view,
            workers: view.workers.map((row) =>
              row.building === 'farm' ? { ...row, perWorkerPerHour: 13, grossPerHour: 13 } : row,
            ),
            resources: view.resources.map((row) =>
              row.id === 'food' ? { ...row, stock, cap: stock, perHour: 1 } : row,
            ),
          };
        };
        expect((await decide(rich(1500))).farm).toBe(0);
        expect((await decide(rich(200))).farm).toBeUndefined();
      });

      it('com a estação virando no meio da ausência, usa o que a previsão diz que a fazenda vai render', async () => {
        // Inverno: um lavrador rende 5, e as 12 bocas pedem três (com a folga). A primavera
        // chega em 4 horas, e a previsão do painel diz que os três de agora vão dar +25,5 por
        // hora (12,5 por lavrador). Com os três a despensa transborda nas 8 horas seguintes; com
        // dois, o estoque cai um pouco até a virada e volta a encher sem perder nada.
        const view = fedView(staffed({ farm: 3, lumberMill: 4, quarry: 3, goldMine: 2 }), {
          perHour: 25.5,
          stockAtTurn: 412,
        });
        const winter: ViewState = {
          ...view,
          workers: view.workers.map((row) =>
            row.building === 'farm' ? { ...row, perWorkerPerHour: 5, grossPerHour: 15 } : row,
          ),
          resources: view.resources.map((row) =>
            row.id === 'food' ? { ...row, stock: 400, perHour: 3 } : row,
          ),
          calendar: {
            ...view.calendar,
            secondsToNextSeason: 4 * 3600,
            nextSeason: { ...view.calendar.nextSeason, secondsUntil: 4 * 3600 },
          },
        };
        expect((await decide(winter)).farm).toBe(2);
        // Com a virada longe, a ausência inteira é de inverno, e os três ficam.
        const deepWinter: ViewState = {
          ...winter,
          calendar: {
            ...winter.calendar,
            nextSeason: { ...winter.calendar.nextSeason, secondsUntil: 40 * 3600 },
          },
        };
        expect((await decide(deepWinter)).farm).toBeUndefined();
      });

      it('confere o painel depois da ordem: se a comida não chega à volta, devolve o lavrador', async () => {
        const view = fullPantry({ farm: 2, lumberMill: 4, quarry: 4, goldMine: 2 });
        // O painel depois da ordem diz que a comida acaba em 3 horas na estação que vem.
        const worse = fedView(view, { depletesInSeconds: 3 * 3600 });
        const orders: Order[] = [];
        const act: Act = async (type, payload) => {
          orders.push({ type, payload });
          return worse;
        };
        await alocarPorDemanda.run(view, act);
        // Tirou um lavrador, viu a previsão e o pôs de volta: a última ordem da fazenda é 2.
        const farm = orders
          .filter((order) => (order.payload as { building: string }).building === 'farm')
          .map((order) => (order.payload as { count: number }).count);
        expect(farm).toEqual([1, 2]);
      });

      it('com fome, a conta é a de sempre: comida primeiro', async () => {
        const view = fullPantry({ farm: 1, lumberMill: 5, quarry: 4, goldMine: 2 });
        const hungry: ViewState = {
          ...view,
          famine: { sinceMs: 0, secondsElapsed: 60, endsInSeconds: null, text: 'Fome.' },
        };
        // 12 bocas e 2 de folga a 12 por lavrador: dois, mesmo com a despensa "cheia".
        expect((await decide(hungry)).farm).toBe(2);
      });
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
      gathered: 0,
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
        cold: cold ? { secondsElapsed: 600, endsInSeconds: null, text: 'Frio.' } : null,
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
            gathered: 0,
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

describe('política "erguer a Torre"', () => {
  type Upgrade = ViewState['constructions']['available'][number];
  /** A obra da Torre como a lista a mostra: 120 de madeira, 120 de pedra e 50 de ouro. */
  const tower = (blockedCode: Upgrade['blockedCode'] = null): Upgrade => ({
    ...upgrade('watchtower', {}, blockedCode),
    fromLevel: 0,
    targetLevel: 1,
    cost: [
      { resource: 'wood', label: 'Madeira', amount: 120, missing: 0 },
      { resource: 'stone', label: 'Pedra', amount: 120, missing: 0 },
      { resource: 'gold', label: 'Ouro', amount: 50, missing: 0 },
    ],
  });
  const rich = { wood: 240, stone: 240, gold: 100 };
  const decide = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    const after = await erguerTorre.run(view, act);
    return { orders, untouched: after === view };
  };
  const build = { type: 'startConstruction', payload: { building: 'watchtower' } };

  it('a visão diz qual edifício é a Torre, e sem ela não mostra a Ameaça', () => {
    const view = freshView();
    expect(view.threat.known).toBe(false);
    expect(view.threat.watchtower).toMatchObject({ building: 'watchtower', level: 0 });
    // No feudo novo a Torre está na lista, presa ao Salão: o bot não dá ordem.
    expect(
      view.constructions.available.find((entry) => entry.building === 'watchtower'),
    ).toMatchObject({ blockedCode: 'GATE_LOCKED' });
  });

  it('com a Torre liberada, a fila livre e o dobro do custo em estoque, ergue', async () => {
    const view = withStock(withUpgrades(freshView(), [tower()]), rich);
    expect((await decide(view)).orders).toEqual([build]);
  });

  it('sem folga em um dos recursos, espera: a Torre não leva mais que metade do estoque', async () => {
    for (const short of [{ wood: 239 }, { stone: 239 }, { gold: 99 }]) {
      const view = withStock(withUpgrades(freshView(), [tower()]), { ...rich, ...short });
      expect(await decide(view), JSON.stringify(short)).toEqual({ orders: [], untouched: true });
    }
  });

  it('presa ao Salão, sem fila ou sem recurso, não dá ordem', async () => {
    for (const code of ['GATE_LOCKED', 'QUEUE_LOCKED', 'QUEUE_BUSY', 'INSUFFICIENT_RESOURCES']) {
      const view = withStock(
        withUpgrades(freshView(), [tower(code as Upgrade['blockedCode'])]),
        rich,
      );
      expect(await decide(view), code).toEqual({ orders: [], untouched: true });
    }
  });

  it('melhora a Torre pela mesma regra, e para quando ela sai da lista (o teto desta versão)', async () => {
    const second: Upgrade = {
      ...tower(),
      fromLevel: 1,
      targetLevel: 2,
      cost: [
        { resource: 'wood', label: 'Madeira', amount: 192, missing: 0 },
        { resource: 'stone', label: 'Pedra', amount: 192, missing: 0 },
        { resource: 'gold', label: 'Ouro', amount: 80, missing: 0 },
      ],
    };
    const view = withUpgrades(freshView(), [second]);
    expect((await decide(withStock(view, rich))).orders).toEqual([]);
    expect((await decide(withStock(view, { wood: 384, stone: 384, gold: 160 }))).orders).toEqual([
      build,
    ]);
    const noTower = withStock(withUpgrades(freshView(), [upgrade('farm', {}, null)]), rich);
    expect(await decide(noTower)).toEqual({ orders: [], untouched: true });
  });

  it('não gasta a madeira da lareira', async () => {
    const view = withStock(withUpgrades(freshView(), [tower()]), { ...rich, wood: 400 });
    const winterAhead: ViewState = {
      ...view,
      calendar: {
        ...view.calendar,
        nextSeason: {
          ...view.calendar.nextSeason,
          id: 'winter',
          firewood: {
            perHour: 9,
            winterTotal: 500,
            winterProduction: 200,
            stock: 400,
            gathered: 0,
            reserved: 0,
            missing: 0,
            text: 'A conta da lenha.',
          },
        },
      },
    };
    // A reserva é 300: com 400 em estoque sobram 100, e a Torre pede 120.
    expect(await decide(winterAhead)).toEqual({ orders: [], untouched: true });
    expect((await decide(withStock(winterAhead, { wood: 420 }))).orders).toEqual([build]);
  });

  it('"obra mais barata" e "planejar automáticas" deixam a Torre para esta política', async () => {
    // A Torre sai mais barata que a Fazenda, e mesmo assim a obra iniciada é a Fazenda.
    const farm: Upgrade = {
      ...upgrade('farm', {}, null),
      cost: [{ resource: 'wood', label: 'Madeira', amount: 400, missing: 0 }],
    };
    const view = withStock(withUpgrades(freshView(), [tower(), farm]), { wood: 500 });
    const cheapest = recorder(view);
    await obraMaisBarata.run(view, cheapest.act);
    expect(cheapest.orders).toEqual([{ type: 'startConstruction', payload: { building: 'farm' } }]);
    // A Torre que não pôde começar não vira planejada automática: começaria sem olhar a folga.
    const waiting = withUpgrades(freshView(), [tower('INSUFFICIENT_RESOURCES')]);
    const planner = recorder(waiting);
    await planejarAutomaticas.run(waiting, planner.act);
    expect(planner.orders).toEqual([]);
    // E não conta como obra por fazer: com o resto no teto, o feudo acabou de construir.
    const done = withUpgrades(freshView(), [
      tower('INSUFFICIENT_RESOURCES'),
      upgrade('farm', {}, 'MAX_LEVEL'),
    ]);
    expect(nothingLeftToBuild(done)).toBe(true);
  });
});

describe('política "erguer a Paliçada"', () => {
  type Upgrade = ViewState['constructions']['available'][number];
  /** A obra da Paliçada como a lista a mostra: 200 de madeira e 50 de pedra. */
  const palisade = (
    blockedCode: Upgrade['blockedCode'] = null,
    more: Partial<Upgrade> = {},
  ): Upgrade => ({
    ...upgrade('palisade', {}, blockedCode),
    fromLevel: 0,
    targetLevel: 1,
    cost: [
      { resource: 'wood', label: 'Madeira', amount: 200, missing: 0 },
      { resource: 'stone', label: 'Pedra', amount: 50, missing: 0 },
    ],
    ...more,
  });
  /** A visão de quem tem a Torre: a Ameaça conhecida, com a chance que a visão anuncia. */
  const watched = (
    raidChancePercent: number,
    incoming: Extract<ViewState['threat'], { known: true }>['incoming'] = null,
    available: Upgrade[] = [palisade()],
  ): ViewState => {
    const view = withUpgrades(freshView(), available);
    return {
      ...view,
      threat: {
        known: true,
        text: 'Ameaça 50 de 100.',
        level: 50,
        max: 100,
        risePerDay: 5,
        nextLevel: 55,
        nextRiseInSeconds: 3600,
        trend: 'Sobe 5 a cada dia de jogo.',
        sources: ['+5/dia: Covil de Lobos'],
        tiles: [{ id: 'wolfDen', label: 'Covil de Lobos', active: true }],
        raidChancePercent,
        raidRisk: 'A regra das incursões.',
        raidCosts: [],
        incoming,
        watchtower: { ...view.threat.watchtower, level: 1 },
        defense: view.threat.defense,
      },
    };
  };
  const wolves = {
    enemy: 'wolves' as const,
    enemyLabel: 'Lobos',
    inSeconds: 1200,
    sizeText: null,
    text: 'Lobos a caminho.',
    costText: 'O que custa.',
    defenseText: 'Sem Paliçada, nada segura este ataque.',
  };
  const decide = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    const after = await erguerPalicada.run(view, act);
    return { orders, untouched: after === view };
  };
  const build = { type: 'startConstruction', payload: { building: 'palisade' } };

  it('sem a Torre o bot não sabe de nada, como o jogador: não ergue', async () => {
    const blind = withUpgrades(freshView(), [palisade()]);
    expect(blind.threat.known).toBe(false);
    expect(blind.threat.defense).toMatchObject({ building: 'palisade', palisadeLevel: 0 });
    expect(await decide(blind)).toEqual({ orders: [], untouched: true });
  });

  it('com a Ameaça conhecida abaixo do limiar das incursões, espera', async () => {
    expect(await decide(watched(0))).toEqual({ orders: [], untouched: true });
  });

  it('quando a visão diz que a próxima virada pode marcar uma incursão, ergue, sem pedir folga', async () => {
    // O estoque paga o custo uma vez só: para a Torre não bastaria; para a Paliçada, basta.
    const view = withStock(watched(5), { wood: 200, stone: 50 });
    expect((await decide(view)).orders).toEqual([build]);
  });

  it('com os lobos à vista, ergue mesmo com a chance em zero (só há uma incursão por vez)', async () => {
    const view = withStock(watched(0, wolves), { wood: 200, stone: 50 });
    expect((await decide(view)).orders).toEqual([build]);
  });

  it('sem recurso ou sem fila, deixa a obra planejada como automática, uma vez', async () => {
    for (const code of ['INSUFFICIENT_RESOURCES', 'QUEUE_LOCKED', 'QUEUE_BUSY'] as const) {
      const view = watched(20, null, [palisade(code)]);
      expect((await decide(view)).orders, code).toEqual([
        {
          type: 'planConstruction',
          payload: { building: 'palisade', autoStart: true, targetLevel: 1 },
        },
      ]);
      // Já planejada: não repete a ordem.
      const planned = watched(20, null, [palisade(code, { planned: true })]);
      expect(await decide(planned), code).toEqual({ orders: [], untouched: true });
    }
  });

  it('presa ao Salão ou no teto, não há o que fazer', async () => {
    for (const code of ['GATE_LOCKED', 'MAX_LEVEL'] as const) {
      expect(await decide(watched(30, null, [palisade(code)])), code).toEqual({
        orders: [],
        untouched: true,
      });
    }
    // No teto desta versão a Paliçada sai da lista de obras.
    expect(await decide(watched(30, null, [upgrade('farm', {}, null)]))).toEqual({
      orders: [],
      untouched: true,
    });
  });

  it('melhora a Paliçada pela mesma regra: o nível 2 é o que segura os ataques médios', async () => {
    const second = palisade(null, {
      fromLevel: 1,
      targetLevel: 2,
      cost: [
        { resource: 'wood', label: 'Madeira', amount: 320, missing: 0 },
        { resource: 'stone', label: 'Pedra', amount: 80, missing: 0 },
      ],
    });
    const view = withStock(watched(55, null, [second]), { wood: 320, stone: 80 });
    expect((await decide(view)).orders).toEqual([build]);
  });

  it('não gasta a madeira da lareira', async () => {
    const view = withStock(watched(20), { wood: 400, stone: 100 });
    const winterAhead: ViewState = {
      ...view,
      calendar: {
        ...view.calendar,
        nextSeason: {
          ...view.calendar.nextSeason,
          id: 'winter',
          firewood: {
            perHour: 9,
            winterTotal: 500,
            winterProduction: 200,
            stock: 400,
            gathered: 0,
            reserved: 0,
            missing: 0,
            text: 'A conta da lenha.',
          },
        },
      },
    };
    // A reserva é 300: com 400 em estoque sobram 100, e a Paliçada pede 200.
    expect(await decide(winterAhead)).toEqual({ orders: [], untouched: true });
    expect((await decide(withStock(winterAhead, { wood: 500 }))).orders).toEqual([build]);
    // E, à espera de recurso, não a deixa automática: ela começaria sem olhar a lareira.
    const waiting = {
      ...winterAhead,
      constructions: watched(20, null, [palisade('INSUFFICIENT_RESOURCES')]).constructions,
    };
    expect(await decide(waiting)).toEqual({ orders: [], untouched: true });
  });

  it('"obra mais barata" e "planejar automáticas" deixam a Paliçada para esta política', async () => {
    const farm: Upgrade = {
      ...upgrade('farm', {}, null),
      cost: [{ resource: 'wood', label: 'Madeira', amount: 400, missing: 0 }],
    };
    const view = withStock(withUpgrades(freshView(), [palisade(), farm]), { wood: 500 });
    const cheapest = recorder(view);
    await obraMaisBarata.run(view, cheapest.act);
    expect(cheapest.orders).toEqual([{ type: 'startConstruction', payload: { building: 'farm' } }]);
    const waiting = withUpgrades(freshView(), [palisade('INSUFFICIENT_RESOURCES')]);
    const planner = recorder(waiting);
    await planejarAutomaticas.run(waiting, planner.act);
    expect(planner.orders).toEqual([]);
  });
});

describe('política "seguir os objetivos"', () => {
  type Objective = ViewState['objectives'][number];

  /** Um objetivo ativo, como a visão o mostra: o bot só lê `status`, `progress` e `target`. */
  function objective(
    id: string,
    target: Objective['target'],
    progress: Objective['progress'] = { current: 0, target: 1 },
  ): Objective {
    return {
      id,
      title: id,
      hint: 'Porque sim.',
      reward: '+1 ouro',
      status: 'active',
      progress,
      missing: null,
      target,
    };
  }

  const withObjectives = (view: ViewState, objectives: Objective[]): ViewState => ({
    ...view,
    objectives,
  });

  const decide = async (view: ViewState) => {
    const { act, orders } = recorder(view);
    await seguirObjetivos.run(view, act);
    return orders;
  };

  const ready = (building: BuildingId) => upgrade(building, {}, null);

  it('no feudo recém-criado: manda dois aldeões para a Fazenda e inicia a obra das Habitações', async () => {
    // Os três primeiros objetivos de verdade. O do recrutamento é da política `recrutar`.
    const view = freshView();
    expect(view.objectives.map((entry) => entry.target.kind)).toEqual([
      'workers',
      'building',
      'recruitment',
    ]);
    expect(await decide(view)).toEqual([
      { type: 'setWorkers', payload: { building: 'farm', count: 2 } },
      { type: 'startConstruction', payload: { building: 'housing' } },
    ]);
  });

  it('um ofício: completa o que falta com os aldeões livres; sem livres que bastem, não dá ordem', async () => {
    const short = objective(
      'farmers',
      { kind: 'workers', building: 'farm' },
      { current: 1, target: 3 },
    );
    const one = withObjectives(withWorkers(freshView(), { farm: 1 }), [short]);
    expect(await decide(one)).toEqual([
      { type: 'setWorkers', payload: { building: 'farm', count: 3 } },
    ]);
    const busy = withObjectives(withWorkers(freshView(), { farm: 1, quarry: 3 }), [short]);
    expect(busy.population.free).toBe(1);
    expect(await decide(busy)).toEqual([]);
  });

  it('um edifício: inicia a obra que pode começar; a que não pode fica planejada como automática', async () => {
    const tower = objective('tower', { kind: 'building', building: 'watchtower' });
    const can = withObjectives(withUpgrades(freshView(), [ready('watchtower')]), [tower]);
    expect(await decide(can)).toEqual([
      { type: 'startConstruction', payload: { building: 'watchtower' } },
    ]);
    const plan = {
      type: 'planConstruction',
      payload: { building: 'watchtower', autoStart: true, targetLevel: 2 },
    };
    for (const code of ['INSUFFICIENT_RESOURCES', 'QUEUE_LOCKED', 'GATE_LOCKED'] as const) {
      const blocked = withUpgrades(freshView(), [upgrade('watchtower', { stone: 40 }, code)]);
      expect(await decide(withObjectives(blocked, [tower])), code).toEqual([plan]);
    }
  });

  it('um edifício: no teto, já planejado, em obras ou fora da lista, não dá ordem', async () => {
    const tower = objective('tower', { kind: 'building', building: 'watchtower' });
    const atMax = withUpgrades(freshView(), [upgrade('watchtower', {}, 'MAX_LEVEL')]);
    expect(await decide(withObjectives(atMax, [tower]))).toEqual([]);
    const planned = withUpgrades(freshView(), [
      { ...upgrade('watchtower', { stone: 40 }), planned: true },
    ]);
    expect(await decide(withObjectives(planned, [tower]))).toEqual([]);
    // Em obras, o edifício sai da lista do que pode ser iniciado.
    expect(await decide(withObjectives(withUpgrades(freshView(), []), [tower]))).toEqual([]);
  });

  it('a lista de planejadas: marca como automática a obra mais barata; com uma já marcada, nada', async () => {
    const auto = objective('auto', { kind: 'planned' });
    const view = withObjectives(
      withUpgrades(freshView(), [
        upgrade('townHall', { wood: 200, stone: 100 }),
        upgrade('quarry', { wood: 20 }),
        upgrade('farm', {}, 'MAX_LEVEL'),
      ]),
      [auto],
    );
    expect(await decide(view)).toEqual([
      {
        type: 'planConstruction',
        payload: { building: 'quarry', autoStart: true, targetLevel: 2 },
      },
    ]);
    const marked: ViewState = {
      ...view,
      constructions: {
        ...view.constructions,
        planned: [
          { ...upgrade('housing', { wood: 10 }), planned: true, autoStart: true, waiting: null },
        ],
      },
    };
    expect(await decide(marked)).toEqual([]);
  });

  it('o recrutamento, o Conselho e a estação ficam com as políticas deles', async () => {
    const view = withObjectives(withUpgrades(freshView(), [ready('housing')]), [
      objective('recruit', { kind: 'recruitment' }, { current: 0, target: 3 }),
      objective('card', { kind: 'council' }),
      objective('winter', { kind: 'season', season: 'winter' }),
    ]);
    expect(await decide(view)).toEqual([]);
  });

  it('objetivo concluído não pede nada, e o bot nunca olha o id', async () => {
    const done: Objective = {
      ...objective('buildWatchtower', { kind: 'building', building: 'watchtower' }),
      status: 'completed',
    };
    const view = withObjectives(withUpgrades(freshView(), [ready('watchtower')]), [done]);
    expect(await decide(view)).toEqual([]);
    // O mesmo alvo com um id que o jogo não tem: a ordem é a mesma.
    const unknown = objective('xyz', { kind: 'building', building: 'watchtower' });
    expect(await decide(withObjectives(view, [unknown]))).toEqual([
      { type: 'startConstruction', payload: { building: 'watchtower' } },
    ]);
  });
});

describe('política "obra mais barata" com o inverno à vista', () => {
  const forecast = (winterTotal: number, winterProduction: number, stock: number) => ({
    perHour: 9,
    winterTotal,
    winterProduction,
    stock,
    gathered: 0,
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
    gathered: 0,
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

  it.each([1, 3, 0.5])(
    'no ritmo %d o econômico ergue a Torre de Vigia e a leva ao nível 2, sem ordem recusada',
    async (timeScale) => {
      const feudo = game(timeScale);
      const levels: number[] = [];
      // Duas visitas por dia real, por duas semanas reais.
      for (let visit = 0; visit < 28; visit += 1) {
        await strategies.economico(feudo.view(), feudo.act);
        feudo.pass(12 * timeScale);
        levels.push(feudo.view().threat.watchtower.level);
      }
      expect(feudo.refused).toEqual([]);
      expect(levels[levels.length - 1]).toBe(2);
      // Da Torre em diante a visão mostra a Ameaça; antes, não.
      const view = feudo.view();
      expect(view.threat.known).toBe(true);
      expect(view.threat.watchtower.next).toBeNull();
      expect(levels[0]).toBe(0);
      // Uma ordem por nível. O primeiro é o do objetivo: a Torre fica planejada como automática
      // antes de o Salão a liberar, e começa sozinha. O segundo é o de `erguer a Torre`, com
      // folga no estoque.
      const forTower = feudo.orders.filter(
        (order) => (order.payload as { building?: string }).building === 'watchtower',
      );
      expect(forTower.map((order) => order.type)).toEqual([
        'planConstruction',
        'startConstruction',
      ]);
      expect(forTower[0]?.payload).toEqual({
        building: 'watchtower',
        autoStart: true,
        targetLevel: 1,
      });
    },
  );

  it.each([
    ['economico', 1],
    ['economico', 3],
    ['economico', 0.5],
    ['preguicoso', 1],
    ['preguicoso', 3],
  ] as const)(
    'o %s, no ritmo %d, percorre a sequência inteira dos objetivos em um ano de jogo, na ordem',
    async (strategy, timeScale) => {
      const feudo = game(timeScale);
      const sessionsPerDay = strategy === 'economico' ? 2 : 1;
      const bot = botFor(strategy, sessionsPerDay);
      const betweenVisits = (24 / sessionsPerDay) * timeScale;
      const done = () =>
        feudo
          .view()
          .objectives.filter((entry) => entry.status === 'completed')
          .map((entry) => entry.id);
      const order: string[] = [];
      // Um ano de jogo são 168 horas de jogo.
      for (let hours = 0; hours < 168; hours += betweenVisits) {
        await bot(feudo.view(), feudo.act);
        feudo.pass(betweenVisits);
        const view = feudo.view();
        // Nunca mais de três ativos, e a visão nunca mostra objetivo escondido.
        expect(
          view.objectives.filter((entry) => entry.status === 'active').length,
        ).toBeLessThanOrEqual(3);
        for (const id of done()) {
          if (!order.includes(id)) {
            order.push(id);
          }
        }
      }
      expect(feudo.refused).toEqual([]);
      // A visão os lista na ordem da sequência: todos concluídos na virada do ano.
      const all = feudo.view().objectives;
      expect(all).toHaveLength(10);
      expect(all.every((entry) => entry.status === 'completed')).toBe(true);
      expect(all[all.length - 1]?.target).toEqual({ kind: 'season', season: 'winter' });
      // O último a cair é o do inverno, na virada para a primavera.
      expect(order[order.length - 1]).toBe(all[all.length - 1]?.id);
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
      // Fora a lista e as cartas que estavam na mesa (duas, no máximo, e a continuação que uma
      // resposta pode trazer), a visita cabe em meia dúzia de ordens.
      const answers = of(session, 'answerCard').length;
      expect(answers).toBeLessThanOrEqual(4);
      expect(session.length - planned.length - answers).toBeLessThanOrEqual(6);
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
    // A ordem pode ter sido a de iniciar ou a de deixar planejada como automática, conforme o
    // estoque da visita em que o bot quis o Armazém.
    expect(
      feudo.orders.filter(
        (order) =>
          (order.type === 'startConstruction' || order.type === 'planConstruction') &&
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
      const learned: Record<string, number> = {};
      const emptied: string[] = [];
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
        // Com as obras esgotadas (no ritmo 3 isso acontece dentro da semana) o bot esvazia os
        // ofícios que só encheriam o depósito, e a experiência deles cai: aí já não conta.
        if (!nothingLeftToBuild(feudo.view())) {
          for (const row of feudo.view().workers.filter((entry) => entry.resource !== 'food')) {
            learned[row.building] = Math.max(learned[row.building] ?? 0, row.experience);
            if (row.experienceTrend === 'falling') {
              emptied.push(`${row.building} na visita ${visit}`);
            }
          }
        }
        feudo.pass(12 * timeScale);
      }
      expect(feudo.refused).toEqual([]);
      // Em catorze visitas, menos de três trocas a cada dez trabalhadores por visita. Entram
      // na conta as trocas que o bot faz de propósito quando um depósito não comporta o que o
      // ofício renderia até a visita seguinte (ele tira os braços que produziriam para o chão,
      // e os devolve quando uma obra abre espaço). Com as cartas do Conselho o feudo cresce
      // mais depressa, e esse limite chega dentro da semana também no ritmo 1.
      //
      // O limite era de uma troca a cada quatro. Com a Torre de Vigia (V2E-T1) o caminho de
      // obras mudou e, no ritmo 1, as trocas da segunda metade da semana passaram de 109 para
      // 122 em 461 trabalhadores-visita (no ritmo 3, de 44 para 58 em 486). São as mesmas
      // trocas grandes de quando as obras rareiam, em visitas diferentes; a população e o
      // Salão do fim da semana não mudaram (docs/balance-v0.2.md, seção 12).
      expect(switched).toBeLessThan((3 * hands) / 10);
      // E os ofícios dos materiais ganharam experiência enquanto havia obra a fazer: nenhum
      // ficou vazio à toa. (A fazenda sobe de nível e pede menos braços do que níveis: lá a
      // experiência não é a meta.)
      expect(learned).toEqual({ lumberMill: 100, quarry: 100, goldMine: 100 });
      expect(emptied).toEqual([]);
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
      // 60 é o teto sem o Conselho (GDD §5.7). Com as cartas que o econômico paga quando tem
      // folga, o feudo fica orgulhoso e chega aos 80 que atraem um colono. O preguiçoso responde
      // sem gastar: só passa da base com o que uma carta dá de graça e com o prêmio de um
      // objetivo. O maior é o do inverno sem frio: +15 por um dia de jogo, 75.
      if (strategy === 'economico') {
        expect(Math.max(...morales)).toBeGreaterThanOrEqual(80);
      } else {
        expect(Math.max(...morales)).toBeLessThanOrEqual(75);
      }
      // Com o feudo crescido, a comida guardada vale o bônus quase sempre.
      const late = morales.slice(-90);
      expect(late.filter((value) => value >= 60).length).toBeGreaterThan(80);
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

describe('política "responder a carta"', () => {
  type Card = ViewState['council']['pending'][number];
  type Option = Card['options'][number];

  const option = (id: string, changes: Partial<Option> = {}): Option => ({
    id,
    label: id,
    cost: [],
    affordable: true,
    locked: false,
    lockedReason: null,
    effectsText: 'Sem custo e sem efeito imediato.',
    hint: 'Uma pista.',
    ...changes,
  });
  const costing = (resource: ResourceId, amount: number, missing = 0) => ({
    cost: [{ resource, label: resource, amount, missing }],
    affordable: missing === 0,
  });
  const card = (instanceId: string, options: Option[]): Card => ({
    instanceId,
    title: `Carta ${instanceId}`,
    text: 'Uma situação. O conselho espera.',
    expiresInSeconds: 3600,
    defaultOptionId: options[options.length - 1]?.id ?? '',
    defaultOptionLabel: 'Esperar',
    expiryNote: 'Sem resposta até o fim do prazo, o conselho decide sozinho: esperar.',
    followsFrom: null,
    options,
  });
  /**
   * O feudo recém-criado com as cartas na mesa e gente em todos os ofícios: os quatro recursos
   * com saldo positivo. `idle` deixa como nasce: ninguém trabalha, e nada entra.
   */
  const withCards = (cards: Card[], idle = false): ViewState => {
    const base = freshView();
    return {
      ...base,
      resources: idle ? base.resources : base.resources.map((row) => ({ ...row, perHour: 6 })),
      council: { ...base.council, pending: cards },
    };
  };

  it('sem carta na mesa, não dá ordem nenhuma', async () => {
    const view = freshView();
    const { act, orders } = recorder(view);
    expect(await responderCartas.run(view, act)).toBe(view);
    expect(orders).toEqual([]);
  });

  /** A mesma visão com o estoque de um recurso trocado. */
  const stocked = (view: ViewState, resource: ResourceId, stock: number): ViewState => ({
    ...view,
    resources: view.resources.map((row) => (row.id === resource ? { ...row, stock } : row)),
  });

  it('paga a opção mais cara que cabe três vezes no estoque; no empate, a primeira da carta', async () => {
    // O feudo recém-criado tem 180 de comida, 120 de madeira, 65 de pedra e 250 de ouro.
    const view = withCards([
      // 30 de pedra não cabem três vezes em 65: fica com a primeira sem custo.
      card('poço-1', [option('pedra', costing('stone', 30)), option('cavar'), option('esperar')]),
      // As duas cabem: a mais cara.
      card('festa-2', [
        option('moeda', costing('gold', 5)),
        option('banquete', costing('food', 40)),
        option('nada'),
      ]),
      // Empate no preço: a primeira da carta.
      card('ponte-3', [
        option('vigas', costing('wood', 40)),
        option('carpinteiros', costing('gold', 40)),
        option('adiar'),
      ]),
    ]);
    const { act, orders } = recorder(view);
    await responderCartas.run(view, act);
    expect(orders).toEqual([
      { type: 'answerCard', payload: { instanceId: 'poço-1', optionId: 'cavar' } },
      { type: 'answerCard', payload: { instanceId: 'festa-2', optionId: 'banquete' } },
      { type: 'answerCard', payload: { instanceId: 'ponte-3', optionId: 'vigas' } },
    ]);
  });

  it('sem folga em nenhuma opção paga, fica com a primeira sem custo: a que não arrisca', async () => {
    const view = withCards([
      card('tonel-1', [
        option('abrir', costing('gold', 100)),
        option('sino'),
        option('campo', { effectsText: '+25 comida; −5 de moral por 1 dia de jogo (2 h)' }),
      ]),
    ]);
    const { act, orders } = recorder(view);
    await responderCartas.run(view, act);
    expect(orders).toEqual([
      { type: 'answerCard', payload: { instanceId: 'tonel-1', optionId: 'sino' } },
    ]);
  });

  it('só paga com o recurso que está entrando: o que não volta não é sobra', async () => {
    // Ninguém trabalha no feudo recém-criado: o ouro não entra e a comida cai. Com 250 de ouro
    // e 180 de comida em estoque, o bot ainda assim não paga nenhuma das duas.
    const cards = [
      card('tonel-1', [option('abrir', costing('gold', 40)), option('sino')]),
      card('refeição-2', [option('servir', costing('food', 40)), option('pão')]),
    ];
    const idle = withCards(cards, true);
    const { act, orders } = recorder(idle);
    await responderCartas.run(idle, act);
    expect(orders.map((order) => (order.payload as { optionId: string }).optionId)).toEqual([
      'sino',
      'pão',
    ]);
    const working = withCards(cards);
    const second = recorder(working);
    await responderCartas.run(working, second.act);
    expect(second.orders.map((order) => (order.payload as { optionId: string }).optionId)).toEqual([
      'abrir',
      'servir',
    ]);
  });

  it('o preguiçoso responde sem gastar: a primeira opção sem custo, sempre', async () => {
    const view = withCards([
      card('tonel-1', [option('abrir', costing('gold', 5)), option('sino'), option('campo')]),
      card('ponte-2', [option('regatear', { locked: true }), option('adiar')]),
    ]);
    const { act, orders } = recorder(view);
    await responderCartasSemGastar.run(view, act);
    expect(orders.map((order) => (order.payload as { optionId: string }).optionId)).toEqual([
      'sino',
      'adiar',
    ]);
  });

  it('não gasta com carta a comida da reserva, a comida de um feudo com fome nem a madeira da lareira', async () => {
    const meal = [option('servir', costing('food', 25)), option('pão')];
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await responderCartas.run(view, act);
      return orders.map((order) => (order.payload as { optionId: string }).optionId);
    };
    // 80 de comida pagam três vezes os 25, mas sobrariam 55: menos que a reserva.
    const table = withCards([card('refeição-1', meal)]);
    expect(await decide(stocked(table, 'food', 80))).toEqual(['pão']);
    expect(await decide(stocked(table, 'food', 90))).toEqual(['servir']);
    // Com fome, nem com a despensa cheia: a comida que chegou é para acabar com ela.
    const starving = {
      ...stocked(table, 'food', 400),
      famine: { sinceMs: 0, secondsElapsed: 600, endsInSeconds: null },
    } as ViewState;
    expect(await decide(starving)).toEqual(['pão']);

    // A lareira vai queimar 200 e a Serraria repõe 50: 150 de madeira têm dono.
    const fires = withCards([
      card('vigília-2', [option('lenha', costing('wood', 30)), option('velar')]),
    ]);
    const beforeWinter = (stock: number): ViewState => {
      const base = stocked(fires, 'wood', stock);
      return {
        ...base,
        calendar: {
          ...base.calendar,
          nextSeason: {
            ...base.calendar.nextSeason,
            firewood: {
              perHour: 9,
              winterTotal: 200,
              winterProduction: 50,
              stock,
              gathered: 0,
              reserved: 0,
              missing: Math.max(0, 150 - stock),
              text: 'A conta da lenha.',
            },
          },
        },
      };
    };
    expect(await decide(beforeWinter(170))).toEqual(['velar']);
    expect(await decide(beforeWinter(180))).toEqual(['lenha']);
    // Sem conta de lenha na visão e sem obra à espera, a madeira só precisa da folga.
    expect(await decide(withUpgrades(stocked(fires, 'wood', 90), []))).toEqual(['lenha']);
  });

  it('não tira o material da próxima obra: a mais barata das que o feudo ainda pode fazer', async () => {
    const fires = withCards([
      card('vigília-1', [option('lenha', costing('wood', 30)), option('velar')]),
    ]);
    const decide = async (view: ViewState) => {
      const { act, orders } = recorder(view);
      await responderCartas.run(view, act);
      return orders.map((order) => (order.payload as { optionId: string }).optionId);
    };
    // No feudo recém-criado a obra mais barata são as Habitações: 80 de madeira e 20 de pedra.
    expect(await decide(stocked(fires, 'wood', 100))).toEqual(['velar']);
    expect(await decide(stocked(fires, 'wood', 110))).toEqual(['lenha']);
    // A obra que espera o Salão ou não cabe no depósito não segura nada: juntar para ela não
    // adianta.
    const gated = withUpgrades(stocked(fires, 'wood', 100), [
      upgrade('farm', { wood: 128 }, 'GATE_LOCKED'),
    ]);
    expect(await decide(gated)).toEqual(['lenha']);
  });

  it('não tenta a opção trancada nem a que o estoque não paga, por mais barata que seja', async () => {
    const view = withCards([
      card('ponte-1', [
        option('regatear', { locked: true, lockedReason: 'Requer o Celeiro.' }),
        option('fiado', costing('gold', 1, 1)),
        option('pagar', costing('gold', 20)),
      ]),
    ]);
    const { act, orders } = recorder(view);
    await responderCartas.run(view, act);
    expect(orders).toEqual([
      { type: 'answerCard', payload: { instanceId: 'ponte-1', optionId: 'pagar' } },
    ]);
    // Sem nenhuma opção ao alcance, a carta fica na mesa: o conselho decide quando o prazo acabar.
    const stuck = withCards([card('ponte-2', [option('pagar', costing('gold', 500, 250))])]);
    const quiet = recorder(stuck);
    await responderCartas.run(stuck, quiet.act);
    expect(quiet.orders).toEqual([]);
  });

  it('responde também à continuação que chega no lugar da carta respondida', async () => {
    const first = withCards([card('tábuas-1', [option('ceder')])]);
    const second = withCards([card('repartir-2', [option('guardar')])]);
    const done = withCards([]);
    const orders: Order[] = [];
    const act: Act = async (type, payload) => {
      orders.push({ type, payload });
      return orders.length === 1 ? second : done;
    };
    expect(await responderCartas.run(first, act)).toBe(done);
    expect(orders.map((order) => order.payload)).toEqual([
      { instanceId: 'tábuas-1', optionId: 'ceder' },
      { instanceId: 'repartir-2', optionId: 'guardar' },
    ]);
  });

  it('uma recusa não vira laço: cada carta é tentada uma vez por sessão', async () => {
    const view = withCards([card('poço-1', [option('cavar')])]);
    const { act, orders } = recorder(view);
    await responderCartas.run(view, act);
    expect(orders).toHaveLength(1);
  });

  it('no motor, o bot responde a toda carta que encontra e nenhuma expira', async () => {
    let state = createInitialState('cartas-do-bot', {
      settlementName: 'Pedra Alta',
      timezone: 'UTC',
      vigilHourLocal: 20,
      difficulty: 'lord',
      timeScale: 3,
    });
    const answered: string[] = [];
    const events: string[] = [];
    // Uma visita a cada 8 h reais, por 3 dias: o ritmo de quem joga três vezes por dia.
    for (let hour = 8; hour <= 72; hour += 8) {
      const advanced = advanceTo(state, hour * HOUR_MS * 3);
      state = advanced.state;
      events.push(...advanced.events.map((event) => event.type));
      const act: Act = async (type, payload) => {
        const result = applyCommand(
          state,
          { commandId: `bot-${hour}-${answered.length}`, type, payload } as Command,
          state.lastProcessedAt,
        );
        expect(result.ok).toBe(true);
        if (result.ok) {
          state = result.state;
          answered.push((payload as { instanceId: string }).instanceId);
        }
        return deriveViewState(state, state.lastProcessedAt);
      };
      await responderCartas.run(deriveViewState(state, state.lastProcessedAt), act);
      expect(state.council.pending).toEqual([]);
    }
    expect(answered.length).toBeGreaterThanOrEqual(2);
    expect(events.filter((type) => type === 'cardDrawn')).toHaveLength(answered.length);
    expect(events).not.toContain('cardExpired');
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
