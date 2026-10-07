import { balance, chronicleTemplates, masters, masterTemplates } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { armsOf, handsOf, occupancyOf } from './craft';
import { consumptionRate, firewoodRate, productionFactors, productionRate } from './economy';
import { inhabitants, masterLabel } from './masters';
import { deliverMaster, masterCanArrive, settleMasterArrivals } from './masterTurn';
import { currentShape } from './migrations';
import { aboveFloor, moraleTermsAt } from './morale';
import { ableVillagers, freeVillagers, housingCapacity, housingVacancy } from './population';
import { cloneState } from './state';
import {
  accept,
  addHero,
  bringMaster,
  command,
  DAY,
  expeditionAtNode,
  famineSince,
  gameAt,
  guildHall,
  HOUR,
  masterOrder,
  mastersScenario,
  masterWaitingScenario,
  MINUTE,
  play,
  refuse,
  roomy,
  send,
  WINTER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

const ADAPT = balance.masters.adaptationMs;
const types = (events: GameEvent[]) => events.map((event) => event.type);
const ofType = (events: GameEvent[], type: GameEvent['type']) =>
  events.filter((event) => event.type === type);
const shaped = (state: GameState) => currentShape(JSON.parse(JSON.stringify(state)), '');

/**
 * Um feudo calmo na primavera (a pedra, a madeira e o ouro rendem × 1 nela), com a moral na
 * base, dez aldeões, casas para doze e depósitos grandes: as contas da produção ficam à vista.
 */
function fief(
  edit: (draft: GameState) => void = () => {},
  atMs = 3 * DAY + 10 * MINUTE,
): GameState {
  return gameAt(atMs, (draft) => {
    const { settlement } = draft;
    roomy(draft);
    settlement.population.villagers = 10;
    settlement.buildings.housing = 2;
    settlement.workers = { farm: 4, lumberMill: 2, quarry: 2, goldMine: 1 };
    settlement.resources = { food: 900_000, wood: 500_000, stone: 100_000, gold: 100_000 };
    edit(draft);
  });
}

/** O mesmo feudo com Odo já na Pedreira e adaptado: o bônus vale desde já. */
function withOdo(edit: (draft: GameState) => void = () => {}, atMs?: number): GameState {
  return fief((draft) => {
    bringMaster(draft, 'odo');
    Object.assign(draft.settlement.masters[0] as object, { building: 'quarry', worked: true });
    edit(draft);
  }, atMs);
}

describe('os números (ADR 0018, decisão 18)', () => {
  it('o Mestre soma 15%, cabe um por edifício e se adapta por um dia de jogo', () => {
    expect(balance.masters.bonus).toEqual({ num: 3, den: 20 });
    expect(balance.masters.maxPerBuilding).toBe(1);
    expect(ADAPT).toBe(DAY);
    expect(masterLabel('odo')).toBe('Mestre Odo');
    expect(masterLabel('berta')).toBe('Mestra Berta');
  });
});

describe('a chegada (V3E-T3.3)', () => {
  it('com vaga nas casas o Mestre entra na hora, sem edifício, com a linha na Crônica', () => {
    const start = fief();
    const draft = cloneState(start);
    const events = bringMaster(draft, 'odo');
    expect(draft.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'odo', building: null, adaptingUntilMs: null, worked: false },
    ]);
    expect(draft.settlement.mastersWaiting).toEqual([]);
    expect(draft.ids.master).toBe(1);
    expect(types(events)).toEqual(['masterArrived']);
    expect(events[0]?.data).toEqual({ masterId: 'master-1', master: 'odo', masters: 1 });
    expect(events[0]?.text).toBe(
      'No 4º dia da Primavera, Mestre Odo chegou a Pedra Alta para ficar. Espera que o senhor lhe dê um edifício.',
    );
    // Não é um dos aldeões: é um habitante a mais.
    expect(draft.settlement.population.villagers).toBe(10);
    expect(inhabitants(draft)).toBe(11);
    expect(housingVacancy(draft)).toBe(housingVacancy(start) - 1);
    expect(freeVillagers(draft)).toBe(freeVillagers(start));
    expect(ableVillagers(draft)).toBe(ableVillagers(start));
    // Chegar não gasta sorteio nenhum, e o estado continua na forma.
    expect(draft.rng).toStrictEqual(start.rng);
    expect(shaped(draft)).toBeNull();
  });

  it('o Mestre mora e come como um aldeão, e queima lenha no inverno', () => {
    const spring = fief();
    const fed = cloneState(spring);
    bringMaster(fed, 'odo');
    expect(consumptionRate(fed) - consumptionRate(spring)).toBe(
      balance.consumption.foodPerVillagerPerHour * MILLI,
    );
    expect(firewoodRate(fed)).toBe(0);
    const winter = fief(() => undefined, WINTER + DAY + 10 * MINUTE);
    const cold = cloneState(winter);
    bringMaster(cold, 'odo');
    expect(firewoodRate(winter)).toBeGreaterThan(0);
    expect(firewoodRate(cold) * 10).toBe(firewoodRate(winter) * 11);
  });

  it('as casas cheias pesam na moral com o Mestre dentro, e não com ele à porta', () => {
    const roomLeft = fief((draft) => (draft.settlement.population.villagers = 11));
    const has = (state: GameState) =>
      moraleTermsAt(state, state.lastProcessedAt).some((term) => term.id === 'housingFull');
    expect(housingCapacity(roomLeft)).toBe(15);
    const tight = fief((draft) => (draft.settlement.population.villagers = 14));
    expect(has(tight)).toBe(false);
    const full = cloneState(tight);
    bringMaster(full, 'odo');
    expect(inhabitants(full)).toBe(15);
    expect(has(full)).toBe(true);
    // O segundo já não cabe: espera à porta, e quem espera não mora.
    bringMaster(full, 'berta');
    expect(full.settlement.mastersWaiting).toEqual([{ id: 'master-2', masterId: 'berta' }]);
    expect(inhabitants(full)).toBe(15);
  });

  it('sem vaga o Mestre espera à porta: não mora, não come, não trabalha, e a Crônica diz por quê', () => {
    const start = fief((draft) => (draft.settlement.population.villagers = 15));
    expect(housingVacancy(start)).toBe(0);
    const draft = cloneState(start);
    const events = bringMaster(draft, 'gil');
    expect(draft.settlement.masters).toEqual([]);
    expect(draft.settlement.mastersWaiting).toEqual([{ id: 'master-1', masterId: 'gil' }]);
    expect(types(events)).toEqual(['masterWaiting']);
    expect(events[0]?.text).toBe(
      'No 4º dia da Primavera, Mestre Gil chegou aos portões de Pedra Alta, mas não há vaga nas casas. Espera à porta até haver uma.',
    );
    expect(consumptionRate(draft)).toBe(consumptionRate(start));
    expect(inhabitants(draft)).toBe(15);
    expect(refuse(draft, masterOrder('master-1', 'farm'))).toEqual({
      code: 'MASTER_WAITING',
      message:
        'Mestre Gil ainda espera uma vaga nas casas: só recebe ofício depois de entrar no feudo.',
    });
    expect(shaped(draft)).toBeNull();
    // Trinta dias sem vaga: continua à porta. A recompensa não se perde nem caduca.
    const later = advanceTo(draft, draft.lastProcessedAt + 30 * DAY);
    expect(later.state.settlement.mastersWaiting).toEqual([{ id: 'master-1', masterId: 'gil' }]);
    expect(ofType(later.events, 'masterArrived')).toEqual([]);
  });

  it('quem espera entra no instante exato em que as Habitações ficam prontas, depois da obra e antes da virada do dia', () => {
    // A obra termina em cima de uma virada de dia: a ordem do instante fica à vista.
    const turn = 4 * DAY;
    const start = fief((draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 15;
      bringMaster(draft, 'gil');
      settlement.constructionQueues[0] = {
        building: 'housing',
        targetLevel: 3,
        startedAtMs: draft.lastProcessedAt - MINUTE,
        finishesAtMs: turn,
      };
    });
    expect(nextEventAt(start)).toBeLessThanOrEqual(turn);
    const before = advanceTo(start, turn - 1);
    expect(before.state.settlement.mastersWaiting).toHaveLength(1);
    expect(ofType(before.events, 'masterArrived')).toEqual([]);
    const at = advanceTo(before.state, turn);
    expect(at.state.settlement.mastersWaiting).toEqual([]);
    expect(at.state.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'gil', building: null, adaptingUntilMs: null, worked: false },
    ]);
    const order = types(at.events);
    expect(order.indexOf('constructionFinished')).toBeLessThan(order.indexOf('masterArrived'));
    expect(order.indexOf('masterArrived')).toBeLessThan(order.indexOf('dayStarted'));
    const [arrival] = ofType(at.events, 'masterArrived');
    expect(arrival?.atMs).toBe(turn);
    expect(arrival?.text).toBe(
      'No 5º dia da Primavera, abriu-se uma vaga nas casas de Pedra Alta, e Mestre Gil, que esperava à porta, entrou para ficar.',
    );
    expect(arrival?.text).toBe(
      masterTemplates.admitted
        .replace('{dia}', '5')
        .replace('{daEstacao}', 'da Primavera')
        .replace('{feudo}', 'Pedra Alta')
        .replace('{mestre}', 'Mestre Gil'),
    );
    // De uma vez dá o mesmo que aos pedaços.
    const direct = advanceTo(start, turn + HOUR);
    const split = advanceTo(advanceTo(at.state, turn + 1).state, turn + HOUR);
    expect(split.state).toStrictEqual(direct.state);
  });

  it('o recruta tem a casa reservada: o Mestre à porta não a toma, e os dois entram juntos quando a obra abre mais vaga, o recruta primeiro', () => {
    const at = 3 * DAY + HOUR;
    const start = fief((draft) => {
      const { settlement } = draft;
      // 13 aldeões, um recruta a caminho e Odo: as quinze vagas estão tomadas ou reservadas.
      settlement.population.villagers = 13;
      settlement.recruitmentQueue = [{ finishesAtMs: at }];
      bringMaster(draft, 'odo');
      bringMaster(draft, 'gil');
    });
    expect(start.settlement.mastersWaiting.map((entry) => entry.masterId)).toEqual(['gil']);
    const arrived = advanceTo(start, at);
    // O recruta entrou na vaga dele; Gil continua à porta.
    expect(types(arrived.events)).toEqual(['recruitmentFinished']);
    expect(arrived.state.settlement.population.villagers).toBe(14);
    expect(arrived.state.settlement.mastersWaiting).toHaveLength(1);

    // Agora com a obra das Habitações terminando no mesmo instante do recruta.
    const both = cloneState(start);
    both.settlement.constructionQueues[0] = {
      building: 'housing',
      targetLevel: 3,
      startedAtMs: both.lastProcessedAt - MINUTE,
      finishesAtMs: at,
    };
    const together = advanceTo(both, at);
    expect(types(together.events)).toEqual([
      'constructionFinished',
      'recruitmentFinished',
      'masterArrived',
    ]);
    expect(together.state.settlement.mastersWaiting).toEqual([]);
    expect(inhabitants(together.state)).toBe(16);
  });

  it('o aldeão que deserta na virada do dia abre a vaga, e o Mestre à porta entra nesse mesmo instante', () => {
    const turn = 80 * DAY;
    const start = gameAt(turn - 20 * MINUTE, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 10;
      settlement.resources.food = 0;
      settlement.resources.wood = 900_000;
      // Fome velha: a virada cobra um desertor.
      settlement.famine = famineSince(turn - 40 * DAY);
      bringMaster(draft, 'gil');
    });
    expect(start.settlement.mastersWaiting).toHaveLength(1);
    const at = advanceTo(start, turn);
    const order = types(at.events);
    expect(order).toContain('villagerDeserted');
    expect(order.indexOf('villagerDeserted')).toBeLessThan(order.indexOf('masterArrived'));
    expect(ofType(at.events, 'masterArrived')).toHaveLength(1);
    expect(ofType(at.events, 'masterArrived')[0]?.atMs).toBe(turn);
    expect(at.state.settlement.mastersWaiting).toEqual([]);
    expect(at.state.settlement.masters.map((entry) => entry.masterId)).toEqual(['gil']);
    // Parar um milissegundo antes e seguir dá o mesmo: a vaga não espera outro instante.
    const split = advanceTo(advanceTo(start, turn - 1).state, turn + 1);
    expect(split.state).toStrictEqual(advanceTo(start, turn + 1).state);
  });

  it('um Mestre com nome é um só: quem já chegou, ou espera, não chega de novo, e o contador não anda', () => {
    const draft = cloneState(fief((state) => (state.settlement.population.villagers = 14)));
    bringMaster(draft, 'odo');
    bringMaster(draft, 'gil');
    expect(draft.settlement.masters).toHaveLength(1);
    expect(draft.settlement.mastersWaiting).toHaveLength(1);
    const before = JSON.stringify(draft);
    const events: GameEvent[] = [];
    for (const id of ['odo', 'gil', 'merlin', null, 7]) {
      expect(masterCanArrive(draft, id)).toBe(false);
      expect(deliverMaster(draft, id, draft.lastProcessedAt, events)).toBe(false);
    }
    expect(events).toEqual([]);
    expect(JSON.stringify(draft)).toBe(before);
    expect(masterCanArrive(draft, 'berta')).toBe(true);
  });

  it('o teto nunca descarta: os quatro Mestres do conteúdo cabem, no feudo e à porta, e entram todos, na ordem de chegada', () => {
    const draft = cloneState(fief((state) => (state.settlement.population.villagers = 14)));
    const ids = Object.keys(masters) as Array<keyof typeof masters>;
    expect(ids.length).toBeLessThanOrEqual(balance.masters.rosterCap);
    for (const id of ids) {
      bringMaster(draft, id);
    }
    expect(draft.settlement.masters.map((entry) => entry.masterId)).toEqual([ids[0]]);
    expect(draft.settlement.mastersWaiting.map((entry) => entry.masterId)).toEqual(ids.slice(1));
    expect(shaped(draft)).toBeNull();
    // As casas crescem: entram os três, na ordem em que chegaram.
    draft.settlement.buildings.housing = 4;
    const events: GameEvent[] = [];
    settleMasterArrivals(draft, draft.lastProcessedAt, events);
    expect(events.map((event) => event.data.master)).toEqual(ids.slice(1));
    expect(draft.settlement.masters.map((entry) => entry.id)).toEqual([
      'master-1',
      'master-2',
      'master-3',
      'master-4',
    ]);
    expect(draft.settlement.mastersWaiting).toEqual([]);
    expect(shaped(draft)).toBeNull();
  });
});

describe('o bônus na conta única da produção (V3E-T3.4)', () => {
  /** A conta à mão, em inteiros: braços × base × 1000 × fatores, com um arredondamento. */
  const exact = (arms: [number, number], base: number, factors: Array<[number, number]>) => {
    let num = arms[0] * base * MILLI;
    let den = arms[1];
    for (const [n, d] of factors) {
      num *= n;
      den *= d;
    }
    return Math.floor(num / den);
  };

  it('sozinho: dois canteiros e o Mestre rendem 3 × 5 × 1,15 = 17,25 por hora de jogo, exatos em milésimos', () => {
    const state = withOdo();
    expect(handsOf(state, 'quarry')).toEqual({ adapted: 3, adapting: 0, master: true });
    expect(armsOf(state, 'quarry')).toBe(3);
    expect(productionRate(state, 'quarry')).toBe(17_250);
    expect(productionRate(fief(), 'quarry')).toBe(10_000);
    // Só o edifício dele: a Fazenda, a Serraria e a Mina rendem o mesmo de antes.
    for (const building of ['farm', 'lumberMill', 'goldMine'] as const) {
      expect(productionRate(state, building)).toBe(productionRate(fief(), building));
    }
    const factor = productionFactors(state, 'quarry').find((entry) => entry.id === 'master');
    expect(factor).toEqual({ id: 'master', ratio: { num: 23, den: 20 }, label: 'Mestre Odo' });
    expect(productionFactors(fief(), 'quarry').some((entry) => entry.id === 'master')).toBe(false);
  });

  it('o Mestre sem nenhum aldeão no edifício rende por um, com o bônus', () => {
    const state = withOdo((draft) => (draft.settlement.workers.quarry = 0));
    expect(productionRate(state, 'quarry')).toBe(5_750);
    expect(occupancyOf(state, 'quarry')).toBe('occupied');
    expect(
      occupancyOf(
        fief((draft) => (draft.settlement.workers.quarry = 0)),
        'quarry',
      ),
    ).toBe('empty');
  });

  it('com nível, mestria, estação, moral, fome e frio: uma conta só, um arredondamento', () => {
    // Inverno, Pedreira no nível 3, experiência 37, moral 43, fome e frio abertos.
    const state = withOdo(
      (draft) => {
        const { settlement } = draft;
        settlement.buildings.quarry = 3;
        settlement.craftExperience.quarry = 37;
        settlement.morale = 43;
        settlement.famine = famineSince(draft.lastProcessedAt - HOUR);
        settlement.cold = { sinceMs: draft.lastProcessedAt - HOUR };
        settlement.workers.quarry = 3;
      },
      WINTER + 2 * DAY + 7 * MINUTE,
    );
    const season = balance.calendar.seasons[3]?.effects.production.stone ?? { num: 1, den: 1 };
    const { productionMultiplier: famine } = balance.famine;
    const { productionMultiplier: cold } = balance.winter.cold;
    const factors: Array<[number, number]> = [
      [14, 10],
      [1000 + 3 * 37, 1000],
      [season.num, season.den],
      [150 + 43, 200],
      [famine.num, famine.den],
      [cold.num, cold.den],
    ];
    const without = exact([3, 1], 5, factors);
    const withMaster = exact([4, 1], 5, [...factors, [23, 20]]);
    expect(productionRate(state, 'quarry')).toBe(withMaster);
    // Não é a taxa sem ele vezes 1,15 arredondada duas vezes: é a conta inteira.
    expect(withMaster).not.toBe(Math.floor((Math.floor((without * 4) / 3) * 23) / 20));
    const bare = cloneState(state);
    bare.settlement.masters = [];
    expect(productionRate(bare, 'quarry')).toBe(without);
    expect(productionFactors(state, 'quarry').map((entry) => entry.id)).toEqual([
      'level',
      'mastery',
      'master',
      'season',
      'morale',
      'famine',
      'cold',
    ]);
  });

  it('na Fazenda, no outono, com aldeões em adaptação: o Mestre adaptado soma inteiro e o bônus vale para todos os braços', () => {
    const state = fief(
      (draft) => {
        bringMaster(draft, 'berta');
        Object.assign(draft.settlement.masters[0] as object, { building: 'farm', worked: true });
        draft.settlement.adaptation = [
          { building: 'farm', count: 2, untilMs: draft.lastProcessedAt + 30 * MINUTE },
        ];
      },
      50 * DAY + 5 * MINUTE,
    );
    const autumn = balance.calendar.seasons[2]?.effects.production.food ?? { num: 1, den: 1 };
    // Dois adaptados, dois a meio e a Mestra: 2 + 1 + 1 = 4 braços.
    expect(handsOf(state, 'farm')).toEqual({ adapted: 3, adapting: 2, master: true });
    expect(productionRate(state, 'farm')).toBe(
      exact([8, 2], 10, [
        [autumn.num, autumn.den],
        [23, 20],
      ]),
    );
  });

  it('o estoque anda com a taxa do Mestre, exato: uma hora de jogo de pedra', () => {
    const start = withOdo();
    const later = advanceTo(start, start.lastProcessedAt + HOUR).state;
    expect(later.settlement.resources.stone - start.settlement.resources.stone).toBe(17_250);
  });
});

describe('a primeira alocação do Mestre é imediata (resposta do autor de 2026-10-07)', () => {
  const fresh = () => fief((draft) => void bringMaster(draft, 'odo'));

  it('o Mestre que nunca trabalhou rende inteiro e com o bônus no instante da ordem, sem adaptação', () => {
    const start = fresh();
    expect(start.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'odo', building: null, adaptingUntilMs: null, worked: false },
    ]);
    const ordered = accept(start, masterOrder('master-1', 'quarry'));
    expect(ordered.state.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'odo', building: 'quarry', adaptingUntilMs: null, worked: true },
    ]);
    expect(types(ordered.events)).toEqual(['masterAssigned']);
    // Dois canteiros e o Mestre, com o bônus, na hora: 3 × 5 × 1,15 = 17,25.
    expect(handsOf(ordered.state, 'quarry')).toEqual({ adapted: 3, adapting: 0, master: true });
    expect(productionRate(ordered.state, 'quarry')).toBe(17_250);
    // Nenhum prazo nasce: a linha do tempo não ganha instante.
    expect(nextEventAt(ordered.state)).toBe(nextEventAt(start));
    expect(shaped(ordered.state)).toBeNull();
    // A tela diz a verdade antes da ordem: não há adaptação a pagar em edifício nenhum.
    const view = deriveViewState(start, start.lastProcessedAt);
    const [odo] = view.masters;
    expect(odo?.firstAssignment).toBe(true);
    expect(odo?.assignText).toBe(
      'A primeira alocação é imediata: rende inteiro e com o bônus na hora. Depois, mudar de edifício custa 2 h de adaptação, sem o bônus.',
    );
    for (const option of odo?.options ?? []) {
      expect(option.gainWhileAdaptingPerHour).toBe(option.gainPerHour);
    }
    const after = deriveViewState(ordered.state, start.lastProcessedAt);
    expect(after.masters[0]).toMatchObject({
      firstAssignment: false,
      bonusActive: true,
      adaptationEndsInSeconds: null,
      assignText:
        'Chegar a outro edifício custa 2 h de adaptação: rende metade e não dá o bônus enquanto ela durar.',
    });
  });

  it('só a primeira: mudar de edifício depois custa a adaptação, e voltar a trabalhar depois de ficar livre também', () => {
    const start = fresh();
    const first = accept(start, masterOrder('master-1', 'quarry')).state;
    // Mudar: adaptação na Mina.
    const moved = accept(first, masterOrder('master-1', 'goldMine')).state;
    expect(moved.settlement.masters[0]).toMatchObject({
      building: 'goldMine',
      adaptingUntilMs: start.lastProcessedAt + ADAPT,
      worked: true,
    });
    // Ficar livre e voltar: quem já teve um edifício paga a adaptação, até no mesmo edifício.
    const freed = accept(first, masterOrder('master-1', null)).state;
    expect(freed.settlement.masters[0]).toEqual({
      id: 'master-1',
      masterId: 'odo',
      building: null,
      adaptingUntilMs: null,
      worked: true,
    });
    const back = accept(freed, masterOrder('master-1', 'quarry')).state;
    expect(back.settlement.masters[0]?.adaptingUntilMs).toBe(start.lastProcessedAt + ADAPT);
    expect(productionRate(back, 'quarry')).toBe(12_500);
    // E a tela de quem está livre, mas já trabalhou, mostra a adaptação.
    const view = deriveViewState(freed, freed.lastProcessedAt);
    expect(view.masters[0]?.firstAssignment).toBe(false);
    const quarry = view.masters[0]?.options.find((option) => option.building === 'quarry');
    expect(quarry?.gainWhileAdaptingPerHour).toBe(2.5);
    expect(quarry?.gainPerHour).toBe(7.25);
  });

  it('a guarda recusa o Mestre com edifício que nunca trabalhou', () => {
    const state = JSON.parse(JSON.stringify(withOdo())) as GameState;
    expect(currentShape(state, '')).toBeNull();
    (state.settlement.masters[0] as { worked: boolean }).worked = false;
    expect(currentShape(state, '')).toBe(
      'settlement.masters.0.worked: Mestre com edifício que nunca trabalhou',
    );
  });
});

describe('a ordem assignMaster e a adaptação (V3E-T3.4 e T3.5)', () => {
  /** Odo no feudo, sem edifício, **já tendo trabalhado**: chegar a um edifício custa a adaptação. */
  const arrived = () =>
    fief((draft) => {
      bringMaster(draft, 'odo');
      Object.assign(draft.settlement.masters[0] as object, { worked: true });
    });

  it('dar um edifício ao Mestre que já trabalhou: ele chega em adaptação, rende metade e não dá o bônus até um dia de jogo depois', () => {
    const start = arrived();
    const ordered = accept(start, masterOrder('master-1', 'quarry'));
    const until = start.lastProcessedAt + ADAPT;
    expect(ordered.state.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'odo', building: 'quarry', adaptingUntilMs: until, worked: true },
    ]);
    expect(types(ordered.events)).toEqual(['masterAssigned']);
    expect(ordered.events[0]?.data).toEqual({
      masterId: 'master-1',
      master: 'odo',
      building: 'quarry',
    });
    expect(ordered.events[0]?.text).toBe(
      'No 4º dia da Primavera, Mestre Odo tomou a seu cargo a Pedreira de Pedra Alta.',
    );
    // A ordem não sorteia nem cria entidade.
    expect(ordered.state.rng).toStrictEqual(start.rng);
    expect(ordered.state.ids).toStrictEqual(start.ids);
    // Dois canteiros e meio braço, sem bônus: 2,5 × 5 = 12,5.
    expect(handsOf(ordered.state, 'quarry')).toEqual({ adapted: 2, adapting: 1, master: false });
    expect(productionRate(ordered.state, 'quarry')).toBe(12_500);
    expect(productionFactors(ordered.state, 'quarry').some((entry) => entry.id === 'master')).toBe(
      false,
    );
    // Os aldeões do ofício não mudam: a ordem de trabalhadores não conta o Mestre.
    expect(ordered.state.settlement.workers).toEqual(start.settlement.workers);
    expect(ordered.state.settlement.adaptation).toEqual([]);
    expect(freeVillagers(ordered.state)).toBe(freeVillagers(start));
    expect(shaped(ordered.state)).toBeNull();
  });

  it('o fim da adaptação é um instante da linha do tempo: um milissegundo antes ele ainda é meio braço sem bônus, nele passa a braço inteiro com o bônus, em qualquer divisão', () => {
    const start = arrived();
    const ordered = accept(start, masterOrder('master-1', 'quarry')).state;
    const until = start.lastProcessedAt + ADAPT;
    // Nenhum outro evento cai antes da virada do dia: a linha do tempo tem de trazer o prazo dele.
    const cuts: number[] = [];
    for (let state = ordered; state.lastProcessedAt < until;) {
      const next = nextEventAt(state) ?? until;
      cuts.push(next);
      state = advanceTo(state, next).state;
    }
    expect(cuts).toContain(until);
    const before = advanceTo(ordered, until - 1).state;
    expect(handsOf(before, 'quarry')).toEqual({ adapted: 2, adapting: 1, master: false });
    expect(before.settlement.masters[0]?.adaptingUntilMs).toBe(until);
    const at = advanceTo(before, until);
    expect(at.events.filter((event) => event.type.startsWith('master'))).toEqual([]);
    expect(at.state.settlement.masters[0]?.adaptingUntilMs).toBeNull();
    expect(handsOf(at.state, 'quarry')).toEqual({ adapted: 3, adapting: 0, master: true });
    // A virada do dia que caiu no caminho mexeu na moral e na mestria dos dois lados: o que o
    // instante muda é só o braço (de meio para inteiro) e o bônus, na mesma conta.
    const factors = productionFactors(before, 'quarry').map((entry) => entry.ratio);
    const rate = (arms: [number, number], extra: Array<{ num: number; den: number }>) =>
      Math.floor(
        [...factors, ...extra].reduce(
          (value, ratio) => (value * ratio.num) / ratio.den,
          (arms[0] * 5 * MILLI) / arms[1],
        ),
      );
    expect(productionRate(before, 'quarry')).toBe(rate([5, 2], []));
    expect(productionRate(at.state, 'quarry')).toBe(rate([3, 1], [{ num: 23, den: 20 }]));
    expect(productionRate(at.state, 'quarry')).toBeGreaterThan(productionRate(before, 'quarry'));
    // De uma vez, ou parando no meio da adaptação e no instante dela: o mesmo estado.
    const direct = advanceTo(ordered, until + HOUR);
    const split = advanceTo(
      advanceTo(advanceTo(ordered, until - 37 * MINUTE).state, until).state,
      until + HOUR,
    );
    expect(split.state).toStrictEqual(direct.state);
    expect(shaped(direct.state)).toBeNull();
  });

  it('reenviar a mesma alocação é aceito, sem evento, e não recomeça a adaptação', () => {
    const start = arrived();
    const ordered = accept(start, masterOrder('master-1', 'quarry')).state;
    const until = ordered.settlement.masters[0]?.adaptingUntilMs;
    const later = advanceTo(ordered, ordered.lastProcessedAt + 50 * MINUTE).state;
    const again = accept(later, masterOrder('master-1', 'quarry'));
    expect(again.events).toEqual([]);
    expect(again.state).toStrictEqual(later);
    expect(again.state.settlement.masters[0]?.adaptingUntilMs).toBe(until);
    // E deixar sem edifício quem já não tem também não muda nada.
    const idle = accept(start, masterOrder('master-1', null));
    expect(idle.events).toEqual([]);
    expect(idle.state).toStrictEqual(start);
  });

  it('trocar de edifício: sai do primeiro na hora, com o bônus, e recomeça a adaptação no segundo', () => {
    const start = withOdo();
    expect(productionRate(start, 'quarry')).toBe(17_250);
    const moved = accept(start, masterOrder('master-1', 'goldMine'));
    expect(moved.events[0]?.data).toEqual({
      masterId: 'master-1',
      master: 'odo',
      building: 'goldMine',
      from: 'quarry',
    });
    expect(productionRate(moved.state, 'quarry')).toBe(10_000);
    // A Mina: um mineiro e meio braço, sem bônus: 1,5 × 4 = 6.
    expect(productionRate(moved.state, 'goldMine')).toBe(6_000);
    expect(moved.state.settlement.masters[0]?.adaptingUntilMs).toBe(start.lastProcessedAt + ADAPT);
    // Voltar atrás não desfaz a troca de graça: a adaptação recomeça na Pedreira.
    const half = advanceTo(moved.state, start.lastProcessedAt + 30 * MINUTE).state;
    const back = accept(half, masterOrder('master-1', 'quarry')).state;
    expect(back.settlement.masters[0]).toEqual({
      id: 'master-1',
      masterId: 'odo',
      building: 'quarry',
      adaptingUntilMs: half.lastProcessedAt + ADAPT,
      worked: true,
    });
    expect(productionRate(back, 'quarry')).toBe(12_500);
  });

  it('deixar o Mestre sem edifício: o bônus e o braço saem na hora, e a volta paga a adaptação', () => {
    const start = withOdo();
    const freed = accept(start, masterOrder('master-1', null));
    expect(freed.state.settlement.masters[0]).toEqual({
      id: 'master-1',
      masterId: 'odo',
      building: null,
      adaptingUntilMs: null,
      worked: true,
    });
    expect(freed.events[0]?.text).toBe(
      'No 4º dia da Primavera, Mestre Odo deixou o ofício por ordem do senhor de Pedra Alta e aguarda outro.',
    );
    expect(freed.events[0]?.data).toEqual({ masterId: 'master-1', master: 'odo', from: 'quarry' });
    expect(productionRate(freed.state, 'quarry')).toBe(10_000);
    const back = accept(freed.state, masterOrder('master-1', 'quarry')).state;
    expect(back.settlement.masters[0]?.adaptingUntilMs).toBe(start.lastProcessedAt + ADAPT);
  });

  it('as recusas dizem o porquê, e nenhuma muda o estado', () => {
    const state = mastersScenario();
    const before = JSON.stringify(state);
    expect(refuse(state, masterOrder('master-9', 'farm'))).toEqual({
      code: 'MASTER_NOT_FOUND',
      message: 'Esse Mestre não está no feudo.',
    });
    expect(
      refuse(state, command('assignMaster', { masterId: 7 as unknown as string, building: 'farm' }))
        .code,
    ).toBe('MASTER_NOT_FOUND');
    // O segundo Mestre no mesmo edifício: o bônus não soma.
    expect(refuse(state, masterOrder('master-2', 'quarry'))).toEqual({
      code: 'BUILDING_HAS_MASTER',
      message: 'A Pedreira já tem Mestre Odo: cabe um Mestre por edifício, e o bônus não soma.',
    });
    expect(
      refuse(
        state,
        command('assignMaster', { masterId: 'master-1', building: 'tavern' as 'farm' }),
      ),
    ).toEqual({
      code: 'NOT_A_PRODUCTION_BUILDING',
      message:
        'Um Mestre só trabalha em edifício produtivo: a Fazenda, a Serraria, a Pedreira e a Mina de Ouro.',
    });
    expect(
      refuse(
        state,
        command('assignMaster', { masterId: 'master-1', building: 'housing' as 'farm' }),
      ).code,
    ).toBe('NOT_A_PRODUCTION_BUILDING');
    expect(JSON.stringify(state)).toBe(before);
    // O edifício produtivo que não está de pé (só existe posto à mão: todos nascem no nível 1).
    const razed = cloneState(state);
    razed.settlement.buildings.goldMine = 0;
    expect(refuse(razed, masterOrder('master-1', 'goldMine'))).toEqual({
      code: 'NOT_A_PRODUCTION_BUILDING',
      message:
        'Mina de Ouro: esse edifício ainda não foi erguido, e o Mestre não tem onde trabalhar.',
    });
  });

  it('a experiência do ofício conta o Mestre como trabalhador: o edifício só com ele não perde a mão', () => {
    const alone = withOdo((draft) => {
      draft.settlement.workers.quarry = 0;
      draft.settlement.craftExperience.quarry = 40;
    });
    const empty = fief((draft) => {
      draft.settlement.workers.quarry = 0;
      draft.settlement.craftExperience.quarry = 40;
    });
    const turn = 4 * DAY;
    expect(advanceTo(alone, turn).state.settlement.craftExperience.quarry).toBe(
      40 + balance.craft.experiencePerDay,
    );
    expect(advanceTo(empty, turn).state.settlement.craftExperience.quarry).toBe(
      40 - balance.craft.experienceLossPerDay,
    );
  });

  it('a ordem de trabalhadores não conta nem tira o Mestre', () => {
    const start = withOdo();
    const free = freeVillagers(start);
    const emptied = accept(start, command('setWorkers', { building: 'quarry', count: 0 })).state;
    expect(emptied.settlement.masters[0]?.building).toBe('quarry');
    expect(freeVillagers(emptied)).toBe(free + 2);
    expect(productionRate(emptied, 'quarry')).toBe(5_750);
    // Todos os aldeões podem ir para a Pedreira: o Mestre não ocupa a vez de nenhum.
    const filled = accept(
      emptied,
      command('setWorkers', { building: 'quarry', count: free + 2 }),
    ).state;
    expect(filled.settlement.workers.quarry).toBe(free + 2);
    expect(
      refuse(filled, command('setWorkers', { building: 'quarry', count: free + 3 })).code,
    ).toBe('NOT_ENOUGH_VILLAGERS');
  });
});

describe('nenhuma regra de perda alcança o Mestre (V3E-T3.6; QA-11)', () => {
  /** O fundo do poço: inverno, sem comida nem madeira, moral no chão, fome velha. */
  const doomed = (villagers: number, masterIds: Array<keyof typeof masters>, seed?: string) => {
    const base = gameAt(WINTER + 2 * DAY + 20 * MINUTE, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = villagers;
      settlement.buildings.housing = 3;
      settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
      settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
      settlement.morale = 0;
      settlement.famine = famineSince(draft.lastProcessedAt - 30 * DAY);
      settlement.cold = { sinceMs: WINTER };
      for (const id of masterIds) {
        bringMaster(draft, id);
      }
      for (const [index, entry] of settlement.masters.entries()) {
        entry.building = (['quarry', 'goldMine', 'lumberMill', 'farm'] as const)[index] ?? null;
        entry.worked = entry.building !== null;
      }
    });
    return seed === undefined ? base : { ...base, seed };
  };

  it('o piso protege 3 aldeões, com quantos Mestres houver (resposta do autor de 2026-10-07): com três aldeões e um Mestre ninguém sai', () => {
    const state = doomed(3, ['odo']);
    expect(balance.morale.populationFloor).toBe(3);
    expect(aboveFloor(state)).toBe(false);
    const later = advanceTo(state, state.lastProcessedAt + 40 * DAY);
    const lost = [
      ...ofType(later.events, 'villagerDeserted'),
      ...ofType(later.events, 'villagerLeft'),
    ];
    expect(lost).toEqual([]);
    expect(later.state.settlement.population.villagers).toBe(3);
    expect(inhabitants(later.state)).toBe(4);
    expect(later.state.settlement.masters).toHaveLength(1);
    expect(later.state.settlement.masters[0]?.building).toBe('quarry');
    // Com quatro aldeões e o Mestre, um aldeão sai, e depois ninguém.
    const four = advanceTo(doomed(4, ['odo']), state.lastProcessedAt + 40 * DAY);
    expect(four.state.settlement.population.villagers).toBe(3);
    expect(aboveFloor(four.state)).toBe(false);
  });

  it('a reprodução do risco: fome de 60 dias, seis aldeões e de zero a quatro Mestres: restam sempre 3 aldeões', () => {
    const all = ['odo', 'berta', 'gil', 'ximena'] as const;
    const left = [0, 1, 2, 3, 4].map((count) => {
      const state = doomed(6, all.slice(0, count));
      const later = advanceTo(state, state.lastProcessedAt + 60 * DAY).state;
      expect(later.settlement.masters).toHaveLength(count);
      return later.settlement.population.villagers;
    });
    // Antes da resposta, com o piso contando habitantes: 3, 2, 1, 0 e 0.
    expect(left).toEqual([3, 3, 3, 3, 3]);
  });

  it('a fome longa e a moral no chão, por quarenta dias, em vinte sementes: saem aldeões, nunca um Mestre, e ele continua no edifício', () => {
    let gone = 0;
    for (let index = 0; index < 20; index += 1) {
      const state = doomed(9, ['odo', 'berta'], `fome-${index}`);
      const later = advanceTo(state, state.lastProcessedAt + 40 * DAY);
      gone += 9 - later.state.settlement.population.villagers;
      expect(
        later.state.settlement.masters.map((entry) => [entry.masterId, entry.building]),
      ).toEqual([
        ['odo', 'quarry'],
        ['berta', 'goldMine'],
      ]);
      expect(later.state.settlement.mastersWaiting).toEqual([]);
      // O piso são três aldeões: sobram os três e os dois Mestres.
      expect(later.state.settlement.population.villagers).toBe(3);
      expect(inhabitants(later.state)).toBe(5);
      for (const event of later.events) {
        if (event.type === 'villagerLeft' || event.type === 'villagerDeserted') {
          expect(event.text).not.toMatch(/Mestr/);
        }
      }
      expect(shaped(later.state)).toBeNull();
    }
    expect(gone).toBe(20 * 6);
  });

  it('todos os aldeões fora e só os Mestres trabalhando: ninguém parte, ninguém deserta, e o feudo segue produzindo', () => {
    const state = doomed(0, ['odo', 'berta', 'gil', 'ximena']);
    expect(aboveFloor(state)).toBe(false);
    expect(shaped(state)).toBeNull();
    const later = advanceTo(state, state.lastProcessedAt + 40 * DAY);
    expect(later.state.settlement.population.villagers).toBe(0);
    expect(later.state.settlement.masters).toHaveLength(4);
    expect(
      later.events.filter((event) => /villager(Left|Deserted|Injured)/.test(event.type)),
    ).toEqual([]);
    // A Mestra da Fazenda alimenta os quatro, e a fome acaba.
    expect(later.state.settlement.famine).toBeNull();
    // O Mestre não conta para o piso: com quatro Mestres e um aldeão, o aldeão fica.
    const one = doomed(1, ['odo', 'berta', 'gil', 'ximena']);
    expect(aboveFloor(one)).toBe(false);
    const after = advanceTo(one, one.lastProcessedAt + 40 * DAY).state;
    expect(after.settlement.population.villagers).toBe(1);
    expect(after.settlement.masters).toHaveLength(4);
  });

  it('a incursão com mais feridos do que aldeões: fere quem há, e o Mestre continua de pé no edifício', () => {
    const at = 10 * DAY + 50 * MINUTE;
    const start = gameAt(10 * DAY, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 1;
      settlement.workers = { farm: 0, lumberMill: 0, quarry: 1, goldMine: 0 };
      settlement.resources = { food: 400_000, wood: 300_000, stone: 0, gold: 0 };
      bringMaster(draft, 'odo');
      bringMaster(draft, 'berta');
      Object.assign(settlement.masters[0] as object, { building: 'quarry', worked: true });
      Object.assign(settlement.masters[1] as object, { building: 'farm', worked: true });
      draft.horde.scheduledRaids = [
        {
          id: 'threat-1',
          atMs: at,
          kind: 'threat',
          enemy: 'wolves',
          size: 'medium',
          announcedAtMs: null,
        },
      ];
    });
    expect(balance.raids.damage.wolves.medium.injuries).toBe(2);
    const raided = advanceTo(start, at);
    const [suffered] = ofType(raided.events, 'raidSuffered');
    expect(suffered?.data.injured).toBe(1);
    expect(raided.state.settlement.injured).toHaveLength(1);
    expect(raided.state.settlement.workers.quarry).toBe(0);
    expect(ableVillagers(raided.state)).toBe(0);
    // Os dois Mestres trabalham como antes: a Pedreira rende um braço com o bônus.
    expect(raided.state.settlement.masters.map((entry) => entry.building)).toEqual([
      'quarry',
      'farm',
    ]);
    expect(handsOf(raided.state, 'quarry')).toEqual({ adapted: 1, adapting: 0, master: true });
    expect(suffered?.text).not.toMatch(/Mestr/);
    expect(shaped(raided.state)).toBeNull();
    // Só Mestres no feudo: a incursão não tem quem ferir.
    const alone = cloneState(start);
    alone.settlement.population.villagers = 0;
    alone.settlement.workers.quarry = 0;
    const spared = advanceTo(alone, at);
    expect(ofType(spared.events, 'raidSuffered')[0]?.data.injured).toBe(0);
    expect(spared.state.settlement.injured).toEqual([]);
    expect(spared.state.settlement.masters).toHaveLength(2);
  });

  it('a fome com Mestre: ele come, o edifício dele leva a penalidade como os outros, e o bônus continua', () => {
    const state = withOdo((draft) => {
      draft.settlement.resources.food = 0;
      draft.settlement.workers.farm = 0;
      draft.settlement.famine = famineSince(draft.lastProcessedAt - HOUR);
    });
    const { num, den } = balance.famine.productionMultiplier;
    expect(productionRate(state, 'quarry')).toBe(Math.floor((17_250 * num) / den));
    expect(consumptionRate(state)).toBe(11 * balance.consumption.foodPerVillagerPerHour * MILLI);
  });
});

describe('o Mestre na visão (V3E-T3.7)', () => {
  it('a lista dos Mestres: quem são, onde trabalham, o bônus e a adaptação em tempo real', () => {
    const state = mastersScenario();
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.masters.map((master) => ({ ...master, options: undefined }))).toEqual([
      {
        id: 'master-1',
        name: 'Mestre Odo',
        originText: 'canteiro das pedreiras velhas',
        building: 'quarry',
        buildingLabel: 'Pedreira',
        adaptationEndsInSeconds: null,
        bonusPercent: 15,
        bonusActive: true,
        firstAssignment: false,
        assignText:
          'Chegar a outro edifício custa 2 h de adaptação: rende metade e não dá o bônus enquanto ela durar.',
      },
      {
        id: 'master-2',
        name: 'Mestra Berta',
        originText: 'lavradora das terras alagadas',
        building: 'farm',
        buildingLabel: 'Fazenda',
        adaptationEndsInSeconds: Math.ceil((70 * MINUTE - 1_234) / 1000),
        bonusPercent: 15,
        bonusActive: false,
        firstAssignment: false,
        assignText:
          'Chegar a outro edifício custa 2 h de adaptação: rende metade e não dá o bônus enquanto ela durar.',
      },
    ]);
    expect(view.mastersWaiting).toEqual({ count: 0, names: [], note: null });
    expect(view.population.masters).toBe(2);
    expect(view.population.villagers).toBe(10);
    expect(view.population.housed).toBe(12);
    // No ritmo Rápido o prazo é um terço: a visão é sempre em tempo real.
    const fast = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(fast.masters[1]?.adaptationEndsInSeconds).toBe(Math.ceil((70 * MINUTE - 1_234) / 3000));
  });

  it('a linha do edifício: o Mestre, o que soma agora e o termo "× 1,15 (Mestre Odo)" na explicação, que fecha com o total', () => {
    const state = withOdo();
    const view = deriveViewState(state, state.lastProcessedAt);
    const quarry = view.workers.find((row) => row.building === 'quarry');
    expect(quarry?.master).toEqual({
      id: 'master-1',
      name: 'Mestre Odo',
      adapting: false,
      bonusText: '+15% na produção',
    });
    expect(quarry?.assigned).toBe(2);
    expect(quarry?.grossPerHour).toBe(17.25);
    expect(quarry?.breakdown).toBe(
      '2 trabalhadores e Mestre Odo × 5 × 1 (Nv1) × 1,15 (Mestre Odo) = 17,25/h',
    );
    expect(view.workers.find((row) => row.building === 'farm')?.master).toBeNull();
    expect(view.resources.find((row) => row.id === 'stone')?.breakdown).toContain(
      '× 1,15 (Mestre Odo)',
    );
    // A comida: o consumo conta o Mestre.
    expect(view.resources.find((row) => row.id === 'food')?.breakdown).toContain('consumo 11 × 1');
  });

  it('em adaptação: a linha diz o prazo, a explicação conta meio braço e não traz o bônus', () => {
    const start = fief((draft) => {
      bringMaster(draft, 'odo');
      Object.assign(draft.settlement.masters[0] as object, { worked: true });
    });
    const state = advanceTo(
      accept(start, masterOrder('master-1', 'quarry')).state,
      start.lastProcessedAt + 80 * MINUTE,
    ).state;
    const view = deriveViewState(state, state.lastProcessedAt);
    const quarry = view.workers.find((row) => row.building === 'quarry');
    expect(quarry?.master).toEqual({
      id: 'master-1',
      name: 'Mestre Odo',
      adapting: true,
      bonusText: 'em adaptação por 40 min: ainda sem o bônus',
    });
    expect(quarry?.breakdown).toBe(
      '2 trabalhadores e Mestre Odo (1 em adaptação por 40 min, valendo metade: contam como 2,5) × 5 × 1 (Nv1) = 12,5/h',
    );
    // As levas dos aldeões continuam sendo só as deles.
    expect(quarry?.adapting).toBe(0);
    expect(quarry?.adaptingCohorts).toEqual([]);
  });

  it('antes de confirmar: o que cada edifício renderia a mais com este Mestre (que já trabalhou), por hora real, durante a adaptação e depois dela', () => {
    const state = fief((draft) => {
      bringMaster(draft, 'odo');
      Object.assign(draft.settlement.masters[0] as object, { worked: true });
    });
    const view = deriveViewState(state, state.lastProcessedAt);
    const [odo] = view.masters;
    expect(odo?.buildingLabel).toBe('Sem edifício');
    expect(odo?.options).toEqual([
      // Fazenda (primavera × 1,2): 4 lavradores rendem 48; com ele, 5 × 10 × 1,2 × 1,15 = 69.
      {
        building: 'farm',
        label: 'Fazenda',
        level: 1,
        resource: 'food',
        current: false,
        gainPerHour: 21,
        gainWhileAdaptingPerHour: 6,
        blockedReason: null,
      },
      // Serraria: 2 × 8 = 16; com ele, 3 × 8 × 1,15 = 27,6.
      {
        building: 'lumberMill',
        label: 'Serraria',
        level: 1,
        resource: 'wood',
        current: false,
        gainPerHour: 11.6,
        gainWhileAdaptingPerHour: 4,
        blockedReason: null,
      },
      {
        building: 'quarry',
        label: 'Pedreira',
        level: 1,
        resource: 'stone',
        current: false,
        gainPerHour: 7.25,
        gainWhileAdaptingPerHour: 2.5,
        blockedReason: null,
      },
      // Mina: 1 × 4 = 4; com ele, 2 × 4 × 1,15 = 9,2.
      {
        building: 'goldMine',
        label: 'Mina de Ouro',
        level: 1,
        resource: 'gold',
        current: false,
        gainPerHour: 5.2,
        gainWhileAdaptingPerHour: 2,
        blockedReason: null,
      },
    ]);
    // A promessa bate com o que acontece: depois da ordem e da adaptação, a Pedreira rende isso a mais.
    const ordered = accept(state, masterOrder('master-1', 'quarry')).state;
    const during = deriveViewState(ordered, ordered.lastProcessedAt);
    const row = (v: typeof view) => v.workers.find((entry) => entry.building === 'quarry');
    expect((row(during)?.grossPerHour ?? 0) - (row(view)?.grossPerHour ?? 0)).toBe(2.5);
    // No ritmo Rápido, os mesmos ganhos por hora real valem o triplo.
    const fast = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    expect(fast.masters[0]?.options[2]?.gainPerHour).toBe(21.75);
  });

  it('o edifício em que ele já trabalha e o que já tem outro Mestre', () => {
    const state = mastersScenario();
    const view = deriveViewState(state, state.lastProcessedAt);
    const [odo, berta] = view.masters;
    const quarryOfOdo = odo?.options.find((option) => option.building === 'quarry');
    expect(quarryOfOdo).toMatchObject({ current: true, blockedReason: null });
    // Onde ele já rende inteiro não há adaptação a pagar: os dois números são o de agora.
    expect(quarryOfOdo?.gainWhileAdaptingPerHour).toBe(quarryOfOdo?.gainPerHour);
    expect(quarryOfOdo?.gainPerHour).toBeGreaterThan(0);
    expect(odo?.options.find((option) => option.building === 'farm')?.blockedReason).toBe(
      'já tem Mestra Berta',
    );
    // Berta ainda se adapta na Fazenda: lá ela rende menos agora do que renderá.
    const farmOfBerta = berta?.options.find((option) => option.building === 'farm');
    expect(farmOfBerta).toMatchObject({ current: true, blockedReason: null });
    expect(farmOfBerta?.gainWhileAdaptingPerHour).toBeLessThan(farmOfBerta?.gainPerHour ?? 0);
    expect(berta?.options.find((option) => option.building === 'quarry')?.blockedReason).toBe(
      'já tem Mestre Odo',
    );
    // O que a visão diz bloqueado é o que a ordem recusa.
    expect(refuse(state, masterOrder('master-1', 'farm')).code).toBe('BUILDING_HAS_MASTER');
  });

  it('quem espera à porta: quantos, quem e por quê', () => {
    const state = masterWaitingScenario();
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.mastersWaiting).toEqual({
      count: 1,
      names: ['Mestre Gil'],
      note: 'Mestre Gil espera uma vaga nas casas: entra assim que houver uma.',
    });
    expect(view.masters.map((entry) => entry.name)).toEqual(['Mestre Odo']);
    expect(view.population.masters).toBe(1);
    expect(view.population.vacancies).toBe(0);
    // Olhar para a frente: a visão em um instante depois da obra já o mostra dentro.
    const after = deriveViewState(state, state.lastProcessedAt + HOUR);
    expect(after.mastersWaiting.count).toBe(0);
    expect(after.masters.map((entry) => entry.name)).toEqual(['Mestre Odo', 'Mestre Gil']);
  });

  it('as regras em uma frase, no ritmo da partida, sem número escrito no conteúdo', () => {
    const view = deriveViewState(fief(), fief().lastProcessedAt);
    expect(view.workersRules.masterBonusPercent).toBe(15);
    expect(view.workersRules.masterAdaptationSeconds).toBe(2 * 3600);
    expect(view.workersRules.masterText).toBe(
      'Um Mestre conta como um trabalhador do edifício e soma 15% à produção dele. Cabe um Mestre por edifício. A primeira alocação é imediata; daí em diante, ao chegar a um edifício ele se adapta por 2 h: rende metade e não dá o bônus.',
    );
    const fast = deriveViewState(fief(), fief().lastProcessedAt, { timeScale: 3 });
    expect(fast.workersRules.masterAdaptationSeconds).toBe(40 * 60);
    expect(fast.workersRules.masterText).toContain('por 40 min');
  });

  it('a visão e a linha do tempo não tocam o estado, o gerador nem os contadores', () => {
    for (const state of [mastersScenario(), masterWaitingScenario()]) {
      const frozen = JSON.stringify(state);
      deriveViewState(state, state.lastProcessedAt);
      deriveViewState(state, state.lastProcessedAt + 3 * DAY);
      nextEventAt(state);
      expect(JSON.stringify(state)).toBe(frozen);
    }
  });

  it('a nota do piso diz que ele é de aldeões e que o Mestre nunca parte', () => {
    const state = gameAt(WINTER + 2 * DAY + 20 * MINUTE, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 2;
      settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
      settlement.morale = 0;
      settlement.famine = famineSince(draft.lastProcessedAt - 30 * DAY);
      bringMaster(draft, 'odo');
    });
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.morale.notes.join(' ')).toContain(
      'Restam 2 aldeões e 1 Mestre: com 3 aldeões ou menos, ninguém mais parte nem deserta, e um Mestre nunca parte.',
    );
  });
});

describe('o Mestre que uma expedição encontra (V3E-T3.3)', () => {
  /** Três Guerreiros fortes diante do guardião de pedra das Ruínas, na semente dada. */
  function atGuardian(seed: string, edit: (draft: GameState) => void = () => {}) {
    const start = guildHall(
      0,
      (draft) => {
        addHero(draft, { name: 'Edda', gender: 'f', level: 6 });
        addHero(draft, { name: 'Rolf', level: 6 });
        addHero(draft, { name: 'Brann', level: 6 });
        draft.map.discovered = ['ruins'];
        edit(draft);
      },
      { seed },
    );
    const sent = send(start, 'ruins', ['hero-1', 'hero-2', 'hero-3'], 'balanced', 0).state;
    return expeditionAtNode(sent, 'stoneGuardian');
  }
  const SEEDS = Array.from({ length: 60 }, (_, index) => `ruinas-${index}`);
  const outcomeOf = (events: GameEvent[]) =>
    events.find((event) => event.type.startsWith('expeditionNode'))?.data.outcome;

  it('em sessenta sementes: só quem vence o guardião o encontra, e a equipe forte o encontra em dez das sessenta vitórias', () => {
    let won = 0;
    let found = 0;
    for (const seed of SEEDS) {
      const { state, endsAt } = atGuardian(seed);
      const done = advanceTo(state, endsAt);
      const arrived = ofType(done.events, 'masterArrived');
      const outcome = outcomeOf(done.events);
      if (outcome === 'full' || outcome === 'success') {
        won += 1;
      } else {
        expect(arrived).toEqual([]);
      }
      found += arrived.length;
      if (arrived.length > 0) {
        expect(done.state.settlement.masters).toEqual([
          { id: 'master-1', masterId: 'odo', building: null, adaptingUntilMs: null, worked: false },
        ]);
        expect(arrived[0]?.atMs).toBe(endsAt);
      } else {
        expect(done.state.settlement.masters).toEqual([]);
        expect(done.state.ids.master).toBeUndefined();
      }
    }
    // Os dois números estão fixados: a equipe forte vence sempre, e o sorteio do Mestre é o
    // último do nó. Mudar o gerador, o nome do fluxo ou a ordem dos sorteios os muda, e é
    // mudança de regra. Dez em sessenta fica a um desvio-padrão e meio dos quinze esperados.
    expect(won).toBe(60);
    expect(found).toBe(10);
  });

  it('o Mestre toma a estrada na hora do nó: a linha dele vem depois da do guardião, o relatório o registra, e ele não espera a volta da equipe', () => {
    const seed = SEEDS.find((candidate) => {
      const { state, endsAt } = atGuardian(candidate);
      return ofType(advanceTo(state, endsAt).events, 'masterArrived').length > 0;
    });
    expect(seed).toBeDefined();
    const { state, endsAt } = atGuardian(seed as string);
    const done = advanceTo(state, endsAt);
    const order = types(done.events);
    expect(order.indexOf('expeditionNodeResolved')).toBeLessThan(order.indexOf('masterArrived'));
    expect(ofType(done.events, 'masterArrived')[0]?.text).toBe(
      chronicleTemplates.masterArrived
        .replace('{dia}', '1')
        .replace('{daEstacao}', 'da Primavera')
        .replace('{feudo}', 'Pedra Alta')
        .replace('{mestre}', 'Mestre Odo'),
    );
    // A equipe ainda está na estrada de volta; o Mestre já mora no feudo.
    expect(done.state.guild.expeditions).toHaveLength(1);
    expect(done.state.guild.expeditions[0]?.log.at(-1)?.master).toBe('odo');
    expect(shaped(done.state)).toBeNull();
    const home = advanceTo(done.state, endsAt + 2 * HOUR);
    expect(home.state.guild.reports.at(-1)?.log.at(-1)?.master).toBe('odo');
    const view = deriveViewState(home.state, home.state.lastProcessedAt);
    expect(JSON.stringify(view.guild.reports.at(-1))).toContain(
      'Mestre Odo tomou a estrada do feudo.',
    );
    // O fluxo da expedição foi apagado com ela, e nenhum fluxo de Mestre nasceu.
    expect(Object.keys(home.state.rng).filter((key) => /master|expedition:/.test(key))).toEqual([]);

    // Quem já tem Odo não o sorteia de novo: o mesmo nó, na mesma semente, gasta um sorteio a menos.
    const again = atGuardian(seed as string, (draft) => void bringMaster(draft, 'odo'));
    const second = advanceTo(again.state, again.endsAt);
    expect(ofType(second.events, 'masterArrived')).toEqual([]);
    expect(second.state.settlement.masters).toHaveLength(1);
    expect(second.state.guild.expeditions[0]?.log.at(-1)?.master).toBeNull();
    const stream = `expedition:${state.guild.expeditions[0]?.id ?? ''}`;
    expect(second.state.rng[stream]).not.toEqual(done.state.rng[stream]);
    // E o que veio antes dele na ordem dos sorteios não mudou: o mesmo desfecho, o mesmo saque.
    const node = (events: GameEvent[]) =>
      events.find((event) => event.type === 'expeditionNodeResolved')?.data;
    expect(node(second.events)).toEqual(node(done.events));
    expect(ofType(second.events, 'itemFound').map((event) => event.data.defId)).toEqual(
      ofType(done.events, 'itemFound').map((event) => event.data.defId),
    );
  });

  it('com as casas cheias o Mestre achado espera à porta: a recompensa não se perde', () => {
    const seed = SEEDS.find((candidate) => {
      const { state, endsAt } = atGuardian(candidate);
      return ofType(advanceTo(state, endsAt).events, 'masterArrived').length > 0;
    });
    const { state, endsAt } = atGuardian(seed as string, (draft) => {
      draft.settlement.population.villagers = housingCapacity(draft);
    });
    const done = advanceTo(state, endsAt);
    expect(ofType(done.events, 'masterWaiting')).toHaveLength(1);
    expect(done.state.settlement.mastersWaiting).toEqual([{ id: 'master-1', masterId: 'odo' }]);
    expect(done.state.guild.expeditions[0]?.log.at(-1)?.master).toBe('odo');
    expect(shaped(done.state)).toBeNull();
  });

  it('o roteiro do "Pronto quando": um Mestre chega por expedição, trabalha, soma 15% com a explicação, e nenhuma regra de perda o alcança', () => {
    const seed = SEEDS.find((candidate) => {
      const { state, endsAt } = atGuardian(candidate);
      return ofType(advanceTo(state, endsAt).events, 'masterArrived').length > 0;
    }) as string;
    const { state, endsAt } = atGuardian(seed, (draft) => {
      draft.settlement.workers = { farm: 4, lumberMill: 2, quarry: 2, goldMine: 1 };
    });
    // 1. Chega.
    const arrived = advanceTo(state, endsAt).state;
    const [odo] = deriveViewState(arrived, endsAt).masters;
    expect(odo).toMatchObject({
      id: 'master-1',
      name: 'Mestre Odo',
      buildingLabel: 'Sem edifício',
    });
    // 2. O senhor vê o que ele somaria e o põe na Pedreira.
    const promised = odo?.options.find((option) => option.building === 'quarry')?.gainPerHour ?? 0;
    const before = deriveViewState(arrived, endsAt).workers.find(
      (row) => row.building === 'quarry',
    );
    const working = play(arrived, [
      masterOrder('master-1', 'quarry'),
      { at: endsAt + ADAPT },
    ]).state;
    // 3. Passada a adaptação, soma 15%, com a explicação.
    const view = deriveViewState(working, working.lastProcessedAt);
    const quarry = view.workers.find((row) => row.building === 'quarry');
    expect(quarry?.master).toMatchObject({ name: 'Mestre Odo', adapting: false });
    expect(quarry?.breakdown).toContain('× 1,15 (Mestre Odo)');
    const bare = cloneState(working);
    bare.settlement.masters = [];
    const armsWithout = bare.settlement.workers.quarry;
    // A mesma conta, sem ele: (braços + 1) / braços × 23/20.
    expect(productionRate(working, 'quarry')).toBe(
      Math.floor((productionRate(bare, 'quarry') * (armsWithout + 1) * 23) / (armsWithout * 20)),
    );
    expect(promised).toBeGreaterThan(0);
    expect(before?.master).toBeNull();
    // 4. Fome, moral no chão e uma incursão: saem e se ferem aldeões, o Mestre fica onde está.
    const cursed = cloneState(working);
    cursed.settlement.resources.food = 0;
    cursed.settlement.workers.farm = 0;
    cursed.settlement.morale = 0;
    cursed.settlement.famine = famineSince(0);
    cursed.horde.scheduledRaids = [
      {
        id: 'threat-1',
        atMs: cursed.lastProcessedAt + 3 * DAY,
        kind: 'threat',
        enemy: 'wolves',
        size: 'medium',
        announcedAtMs: null,
      },
    ];
    const villagers = cursed.settlement.population.villagers;
    const end = advanceTo(cursed, cursed.lastProcessedAt + 40 * DAY);
    expect(end.state.settlement.population.villagers).toBeLessThan(villagers);
    expect(ofType(end.events, 'raidSuffered').length).toBeGreaterThanOrEqual(1);
    expect(end.state.settlement.masters).toEqual([
      { id: 'master-1', masterId: 'odo', building: 'quarry', adaptingUntilMs: null, worked: true },
    ]);
    expect(shaped(end.state)).toBeNull();
  });
});
