import { balance, BUILDING_IDS, buildings, DIFFICULTY_IDS, RESOURCE_IDS } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { upgradeCost, upgradeQuote, upgradeStillPossible } from './construction';
import { netRates } from './economy';
import { fillsIn, fullStores, storageCapacity, storageFillsIn } from './storage';
import {
  accept,
  AUTUMN,
  command,
  DAY,
  eventsOfType,
  FED_MORALE,
  gameAt,
  gameWith,
  HOUR,
  masteryOnDay,
  MINUTE,
  newGame,
  play,
  reachedAt,
  refuse,
  SPRING,
  SUMMER,
  WINTER,
  withMorale,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { BuildingId, Command, DifficultyId, GameEvent, GameState, ResourceId } from './types';
import { deriveViewState } from './view';

const CAPPED: ResourceId[] = ['food', 'wood', 'stone'];

/**
 * Primavera, 5 habitantes: um na Fazenda (a comida sobe 7 por hora) e `lumberjacks` na Serraria.
 * O Celeiro está no nível máximo, para a comida não entrar na conta: o cenário é o da madeira.
 */
function woodcutters(lumberjacks: number, edit: (draft: GameState) => void = () => {}): GameState {
  return gameAt(SPRING, (draft) => {
    draft.settlement.workers = { farm: 1, lumberMill: lumberjacks, quarry: 0, goldMine: 0 };
    draft.settlement.buildings.granary = buildings.granary.maxLevel;
    edit(draft);
  });
}

/**
 * A moral do feudo de `woodcutters` em cada dia de jogo: a base no primeiro e, da primeira
 * virada em diante, 60 (há comida guardada e vaga nas casas). É um fator da produção.
 */
const moraleOn = (day: number) => (day === 0 ? 50 : FED_MORALE);

const row = (state: GameState, resource: ResourceId, timeScale?: number) => {
  const view = deriveViewState(
    state,
    state.lastProcessedAt,
    timeScale === undefined ? {} : { timeScale },
  );
  const found = view.resources.find((entry) => entry.id === resource);
  if (found === undefined) {
    throw new Error(`A visão não tem ${resource}.`);
  }
  return found;
};

const types = (events: GameEvent[]) => events.map((event) => event.type);
const storageEvents = (events: GameEvent[]) =>
  events.filter((event) => event.type === 'storageFilled' || event.type === 'storageWasted');

/** Soma, por recurso, das unidades que os eventos de desperdício relataram. */
function reported(events: GameEvent[], resource: ResourceId): number {
  return eventsOfType(events, 'storageWasted').reduce(
    (sum, event) => sum + Number(event.data[`wasted_${resource}`] ?? 0),
    0,
  );
}

/** O que foi relatado mais o que ainda não foi é o total de sempre, em milésimos. */
function expectWasteAccounted(state: GameState, events: GameEvent[], before?: GameState): void {
  for (const id of RESOURCE_IDS) {
    const total = (state.stats[`wasted_${id}`] ?? 0) - (before?.stats[`wasted_${id}`] ?? 0);
    const pending = state.settlement.wasted[id] - (before?.settlement.wasted[id] ?? 0);
    expect(reported(events, id) * 1000 + pending, id).toBe(total);
  }
}

describe('capacidade (GDD §5.5)', () => {
  const withDifficulty = (difficulty: DifficultyId, granary = 0, warehouse = 0) =>
    gameWith((draft) => {
      draft.settings.difficulty = difficulty;
      draft.settlement.buildings.granary = granary;
      draft.settlement.buildings.warehouse = warehouse;
    });

  it('antes do edifício são 500 por recurso, vezes o fator da dificuldade; o ouro não tem limite', () => {
    const caps = (difficulty: DifficultyId) =>
      RESOURCE_IDS.map((id) => storageCapacity(withDifficulty(difficulty), id));
    expect(caps('peasant')).toEqual([625_000, 625_000, 625_000, null]);
    expect(caps('lord')).toEqual([500_000, 500_000, 500_000, null]);
    expect(caps('ironKing')).toEqual([400_000, 400_000, 400_000, null]);
  });

  it.each([
    [1, 900_000, 1_125_000, 720_000],
    [2, 1_500_000, 1_875_000, 1_200_000],
    [3, 2_100_000, 2_625_000, 1_680_000],
    [8, 5_100_000, 6_375_000, 4_080_000],
  ])('no nível %i o depósito guarda 900 mais 600 por nível', (level, lord, peasant, ironKing) => {
    for (const [difficulty, expected] of [
      ['lord', lord],
      ['peasant', peasant],
      ['ironKing', ironKing],
    ] as const) {
      const state = withDifficulty(difficulty, level, level);
      expect(storageCapacity(state, 'food'), difficulty).toBe(expected);
      expect(storageCapacity(state, 'wood'), difficulty).toBe(expected);
      expect(storageCapacity(state, 'stone'), difficulty).toBe(expected);
    }
  });

  it('o Celeiro guarda a comida; o Armazém, a madeira e a pedra, cada uma com o seu limite', () => {
    const state = withDifficulty('lord', 2, 1);
    expect(RESOURCE_IDS.map((id) => storageCapacity(state, id))).toEqual([
      1_500_000,
      900_000,
      900_000,
      null,
    ]);
  });

  it('é derivada: o estado não guarda limite nenhum', () => {
    const text = JSON.stringify(newGame());
    expect(text).not.toMatch(/cap/i);
    expect(Object.keys(newGame().settlement)).not.toContain('storage');
    for (const difficulty of DIFFICULTY_IDS) {
      expect(storageCapacity(withDifficulty(difficulty), 'gold')).toBeNull();
    }
  });

  it('uma partida nova nasce sem Celeiro, sem Armazém e sem desperdício', () => {
    const { settlement, stats } = newGame();
    expect(settlement.buildings).toMatchObject({ granary: 0, warehouse: 0 });
    expect(settlement.wasted).toEqual({ food: 0, wood: 0, stone: 0, gold: 0 });
    expect(stats).toEqual({});
    expect(fullStores(newGame())).toEqual([]);
  });
});

describe('o instante em que o estoque enche', () => {
  // 120 de madeira e 3 lenhadores a 8 por hora: faltam 380, que a 24 por hora chegariam em
  // 15 h 50 min. A Serraria, ocupada, ganha 4 de experiência a cada virada de dia (× 1,012,
  // × 1,024...) e a moral vai a 60 na primeira (× 1,05): os 380 chegam antes, no 8º dia de
  // jogo, com 14 h 37 min.
  const FILLS_AT = reachedAt(SPRING, 380_000, (day) =>
    withMorale(24 * masteryOnDay(day), moraleOn(day)),
  );

  it('a conta do instante, com a experiência que sobe a cada dia e a moral da primeira virada', () => {
    expect(FILLS_AT).toBe(52_627_794);
    expect(Math.floor(FILLS_AT / DAY)).toBe(7);
  });

  it('é um evento da linha do tempo, no milissegundo exato', () => {
    const start = woodcutters(3);
    // Com a taxa de agora a conta dá 15 h 50 min: a linha do tempo a refaz a cada trecho.
    expect(fillsIn(start, 'wood', netRates(start).wood)).toBe(15 * HOUR + 50 * MINUTE);
    expect(storageFillsIn(start, netRates(start))).toBe(15 * HOUR + 50 * MINUTE);

    const before = advanceTo(start, FILLS_AT - 1);
    expect(before.state.settlement.resources.wood).toBe(499_999);
    expect(eventsOfType(before.events, 'storageFilled')).toEqual([]);
    expect(nextEventAt(before.state)).toBe(FILLS_AT);

    const { state, events } = advanceTo(before.state, FILLS_AT);
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(events).toEqual([
      {
        type: 'storageFilled',
        atMs: FILLS_AT,
        text: 'No 8º dia da Primavera, o Pátio de Pedra Alta encheu: não cabe mais madeira, e o que chegar se perde.',
        data: { resource: 'wood', building: 'warehouse', level: 0, cap: 500 },
      },
    ]);
    // Em repouso: o próximo evento é depois de agora.
    expect(nextEventAt(state)).toBeGreaterThan(FILLS_AT);
  });

  it('acontece uma vez por episódio: cheio por dias, uma linha só', () => {
    const { state, events } = advanceTo(woodcutters(3), 10 * DAY);
    expect(eventsOfType(events, 'storageFilled').map((event) => event.atMs)).toEqual([FILLS_AT]);
    expect(state.settlement.resources.wood).toBe(500_000);
  });

  it('com o depósito construído, a frase fala dele e o limite é o dele', () => {
    const start = woodcutters(3, (draft) => {
      draft.settlement.buildings.warehouse = 1;
      draft.settlement.resources.wood = 880_000;
    });
    const { events } = advanceTo(start, HOUR);
    const [filled] = eventsOfType(events, 'storageFilled');
    // Faltam 20 a 24 por hora: 50 minutos.
    expect(filled).toMatchObject({
      atMs: 50 * MINUTE,
      data: { resource: 'wood', building: 'warehouse', level: 1, cap: 900 },
    });
    expect(filled?.text).toBe(
      'No 1º dia da Primavera, o Armazém de Pedra Alta encheu: não cabe mais madeira, e o que chegar se perde.',
    );
  });

  it('a comida enche a Despensa, e depois o Celeiro', () => {
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.food = 445_000;
    });
    // 5 fazendeiros na primavera rendem 60 por hora e o feudo come 5: +55 por hora.
    const { events } = advanceTo(start, 2 * HOUR);
    expect(eventsOfType(events, 'storageFilled')).toMatchObject([
      {
        atMs: HOUR,
        text: 'No 1º dia da Primavera, a Despensa de Pedra Alta encheu: não cabe mais comida, e o que chegar se perde.',
      },
    ]);
  });

  it('um resto de produção guardado entra na conta do instante', () => {
    // Falta um milésimo; com o resto quase completo, ele chega no primeiro milissegundo.
    const start = woodcutters(3, (draft) => {
      draft.settlement.resources.wood = 499_999;
      draft.settlement.accumulators.wood = HOUR - 1;
    });
    expect(fillsIn(start, 'wood', 24_000)).toBe(1);
    const { state, events } = advanceTo(start, 1);
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(types(events)).toEqual(['storageFilled']);
  });

  it('sem saldo positivo, cheio ou sem limite, não há instante nenhum', () => {
    const idle = woodcutters(0);
    expect(fillsIn(idle, 'wood', 0)).toBeNull();
    expect(fillsIn(idle, 'wood', -5_000)).toBeNull();
    expect(fillsIn(idle, 'gold', 4_000)).toBeNull();
    const full = woodcutters(3, (draft) => {
      draft.settlement.resources.wood = 500_000;
    });
    expect(fillsIn(full, 'wood', 24_000)).toBeNull();
  });
});

describe('desperdício contado', () => {
  const full = (lumberjacks: number) =>
    woodcutters(lumberjacks, (draft) => {
      draft.settlement.resources.wood = 500_000;
    });

  it('cheio, o estoque para no limite e a produção vira desperdício, sem perder o resto', () => {
    const start = full(3);
    // Um corte quebrado: 1 h 23 min 45,678 s a 24 por hora são 33.502 milésimos e um resto.
    const cut = HOUR + 23 * MINUTE + 45_678;
    const { state } = advanceTo(start, cut);
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(state.stats.wasted_wood).toBe(Math.floor((24_000 * cut) / HOUR));
    expect(state.settlement.wasted.wood).toBe(state.stats.wasted_wood);
    expect(state.settlement.accumulators.wood).toBe((24_000 * cut) % HOUR);
    // O resto guardado completa o milésimo seguinte: em 2 horas, exatamente 48 unidades.
    const later = advanceTo(state, 2 * HOUR - 1).state;
    expect(later.stats.wasted_wood).toBe(47_999);
    expect(advanceTo(later, 2 * HOUR).state.stats.wasted_wood).toBe(48_000);
  });

  it('na virada do dia, um evento com as unidades do dia; o contador volta a zero', () => {
    const { state, events } = advanceTo(full(3), DAY);
    expect(storageEvents(events)).toEqual([
      {
        type: 'storageWasted',
        atMs: DAY,
        text: 'No 1º dia da Primavera, a produção de Pedra Alta não coube nos depósitos e foi ao chão: 48 de madeira.',
        data: { wasted_wood: 48 },
      },
    ]);
    // O fecho do dia vem antes de o novo amanhecer.
    expect(types(events)).toEqual(['storageWasted', 'dayStarted']);
    expect(state.settlement.wasted.wood).toBe(0);
    expect(state.stats.wasted_wood).toBe(48_000);
  });

  it('30 dias cheios geram 30 eventos de desperdício, e não um por hora', () => {
    const { state, events } = advanceTo(full(3), 30 * DAY);
    const wasted = eventsOfType(events, 'storageWasted');
    expect(wasted).toHaveLength(30);
    expect(wasted.map((event) => event.atMs)).toEqual(
      Array.from({ length: 30 }, (_, index) => (index + 1) * DAY),
    );
    expect(eventsOfType(events, 'storageFilled')).toEqual([]);
    // 24 dias de primavera a 24 por hora e 6 de verão a 27,6 (× 1,15), cada dia com a mestria
    // dele (a Serraria, ocupada, ganha 4 de experiência por virada, até 100 no 26º dia) e com
    // a moral dele (60 da primeira virada em diante): uma conta só, arredondada uma vez.
    const perDay = Array.from({ length: 30 }, (_, day) => {
      const season = day < 24 ? 100 : 115;
      const exact = 24 * masteryOnDay(day) * season * (150 + moraleOn(day));
      return 2 * Math.floor(exact / (100 * 200));
    });
    expect(perDay.slice(0, 2)).toEqual([48_000, 51_004]);
    expect(perDay.slice(24)).toEqual([74_652, 75_348, 75_348, 75_348, 75_348, 75_348]);
    expect(state.stats.wasted_wood).toBe(perDay.reduce((sum, day) => sum + day, 0));
    // A fração de unidade não some: passa para o dia seguinte e fecha a conta.
    let pending = 0;
    const units = perDay.map((day) => {
      pending += day;
      const whole = Math.floor(pending / 1000);
      pending -= whole * 1000;
      return whole;
    });
    expect(units.slice(0, 4)).toEqual([48, 51, 51, 52]);
    expect(wasted.map((event) => event.data.wasted_wood)).toEqual(units);
    expect(state.settlement.wasted.wood).toBe(pending);
    expectWasteAccounted(state, events);
  });

  it('um dia com menos de uma unidade perdida não vira linha: a fração espera', () => {
    // Um fazendeiro e 11 bocas na primavera: a comida sobe 1 por hora... e o dia tem 2 horas.
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.population.villagers = 11;
      draft.settlement.buildings.housing = 2;
      draft.settlement.workers.farm = 1;
      draft.settlement.resources.food = 500_000;
      draft.settlement.accumulators.food = 0;
    });
    expect(netRates(start).food).toBe(1_000);
    const half = advanceTo(start, 30 * MINUTE);
    expect(half.state.settlement.wasted.food).toBe(500);
    // Meio dia de jogo depois, na virada: 2 unidades, uma linha.
    const { events } = advanceTo(start, DAY);
    expect(eventsOfType(events, 'storageWasted').map((event) => event.data)).toEqual([
      { wasted_food: 2 },
    ]);
    // Com o contador abaixo de uma unidade na virada, nada é relatado e nada se perde.
    const almost = gameAt(DAY - 30 * MINUTE, (draft) => {
      Object.assign(draft.settlement, start.settlement);
    });
    const turned = advanceTo(almost, DAY);
    expect(eventsOfType(turned.events, 'storageWasted')).toEqual([]);
    expect(turned.state.settlement.wasted.food).toBe(500);
    expect(turned.state.stats.wasted_food).toBe(500);
    // No dia seguinte a Fazenda já tem 4 de experiência e a moral foi a 60 (a despensa está
    // cheia): 12 × 1,012 × 1,05 − 11 = 1,751 por hora. Com o meio que esperava, 4,002: quatro
    // unidades na linha e o resto de novo à espera.
    const next = advanceTo(turned.state, 2 * DAY);
    expect(eventsOfType(next.events, 'storageWasted').map((event) => event.data)).toEqual([
      { wasted_food: 4 },
    ]);
    expect(next.state.settlement.wasted.food).toBe(2);
  });

  it('dois depósitos cheios no mesmo dia: uma linha só, com os dois recursos', () => {
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.settlement.buildings.housing = 2;
      draft.settlement.workers = { farm: 5, lumberMill: 3, quarry: 2, goldMine: 0 };
      draft.settlement.resources = { food: 500_000, wood: 500_000, stone: 500_000, gold: 0 };
    });
    const { events } = advanceTo(start, DAY);
    const wasted = eventsOfType(events, 'storageWasted');
    // Comida: (5 × 12 − 10) × 2 h; madeira: 3 × 8 × 2 h; pedra: 2 × 5 × 2 h.
    expect(wasted).toHaveLength(1);
    expect(wasted[0]?.data).toEqual({ wasted_food: 100, wasted_wood: 48, wasted_stone: 20 });
    expect(wasted[0]?.text).toBe(
      'No 1º dia da Primavera, a produção de Pedra Alta não coube nos depósitos e foi ao chão: 100 de comida, 48 de madeira e 20 de pedra.',
    );
  });

  it('a linha leva a data do dia que acabou, também na virada de estação e de ano', () => {
    const start = gameAt(WINTER + 11 * DAY, (draft) => {
      draft.settlement.workers = { farm: 5, lumberMill: 0, quarry: 0, goldMine: 0 };
      draft.settlement.resources = { food: 500_000, wood: 500_000, stone: 0, gold: 0 };
      draft.settlement.population.villagers = 5;
    });
    const { events } = advanceTo(start, WINTER + 12 * DAY);
    // 5 fazendeiros no inverno rendem 20 e o feudo come 5: +15 por hora.
    expect(eventsOfType(events, 'storageWasted')[0]?.text).toBe(
      'No 12º dia do Inverno, a produção de Pedra Alta não coube nos depósitos e foi ao chão: 30 de comida.',
    );
    expect(types(events)).toEqual(['storageWasted', 'yearStarted', 'seasonChanged', 'dayStarted']);
  });

  it('o ouro nunca enche nem se perde', () => {
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.workers = { farm: 1, lumberMill: 0, quarry: 0, goldMine: 4 };
      draft.settlement.buildings.granary = 8;
      draft.settlement.resources.gold = 9_000_000;
    });
    const { state, events } = advanceTo(start, 30 * DAY);
    // 4 mineiros a 16 por hora, 2 h por dia, cada dia com a mestria e a moral dele.
    const mined = Array.from(
      { length: 30 },
      (_, day) => 2 * withMorale(16 * masteryOnDay(day), moraleOn(day)),
    );
    expect(state.settlement.resources.gold).toBe(
      9_000_000 + mined.reduce((sum, day) => sum + day, 0),
    );
    expect(state.settlement.craftExperience.goldMine).toBe(100);
    expect(storageEvents(events)).toEqual([]);
    expect(state.stats.wasted_gold).toBeUndefined();
    expect(row(state, 'gold')).toMatchObject({
      cap: null,
      capBreakdown: null,
      storageBuilding: null,
      storageLabel: null,
      full: false,
      fullInSeconds: null,
      fullNote: null,
      wastingPerHour: 0,
      wastedToday: 0,
    });
  });
});

describe('limite com consumo contínuo (comida)', () => {
  it('cheia, só o saldo se perde: o que o feudo come não é desperdício', () => {
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.food = 500_000;
    });
    const { state } = advanceTo(start, HOUR);
    // Produz 60 e come 5: perdem-se 55, e o estoque fica no limite.
    expect(state.settlement.resources.food).toBe(500_000);
    expect(state.stats.wasted_food).toBe(55_000);
  });

  it('o saldo negativo esvazia o depósito cheio e encerra o episódio; encher de novo é outro', () => {
    // Cheia e subindo; chegam dois aldeões e o senhor tira gente da Fazenda: a comida desce.
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.workers.farm = 1;
      draft.settlement.resources.food = 499_000;
    });
    const filled = advanceTo(start, HOUR);
    // 12 − 5 = +7 por hora: enche em 1/7 de hora.
    expect(eventsOfType(filled.events, 'storageFilled')).toHaveLength(1);
    const emptied = play(filled.state, [
      command('setWorkers', { building: 'farm', count: 0 }),
      { at: 2 * HOUR },
    ]);
    expect(emptied.state.settlement.resources.food).toBe(495_000);
    expect(fullStores(emptied.state)).toEqual([]);
    const again = play(emptied.state, [
      command('setWorkers', { building: 'farm', count: 5 }),
      { at: 3 * HOUR },
    ]);
    // Cinco lavradores recém-chegados rendem metade, 30, e a virada das 2 h levou a moral a
    // 60: 31,5. Faltam 5 a 26,5 por hora.
    expect(eventsOfType(again.events, 'storageFilled').map((event) => event.atMs)).toEqual([
      2 * HOUR + Math.ceil((5_000 * HOUR) / 26_500),
    ]);
  });

  it('acima do limite, a comida com saldo negativo cai normalmente', () => {
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.resources.food = 800_000;
    });
    const { state, events } = advanceTo(start, HOUR);
    expect(state.settlement.resources.food).toBe(795_000);
    expect(state.stats.wasted_food).toBeUndefined();
    expect(storageEvents(events)).toEqual([]);
  });

  it('não entra em laço: lenha, fome e limite no mesmo feudo, um ano inteiro', () => {
    const start = gameAt(AUTUMN, (draft) => {
      draft.settlement.population.villagers = 12;
      draft.settlement.buildings.housing = 3;
      draft.settlement.workers = { farm: 3, lumberMill: 2, quarry: 4, goldMine: 3 };
      draft.settlement.resources = { food: 499_000, wood: 499_000, stone: 499_000, gold: 0 };
    });
    const { state, events } = advanceTo(start, AUTUMN + 84 * DAY);
    expect(state.lastProcessedAt).toBe(AUTUMN + 84 * DAY);
    // Cada instante é processado uma vez: nenhum par de eventos iguais no mesmo instante.
    const keys = events.map((event) => `${event.atMs}:${event.type}:${JSON.stringify(event.data)}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(eventsOfType(events, 'dayStarted')).toHaveLength(84);
    expectWasteAccounted(state, events);
  });
});

describe('ganhos discretos cortados no limite', () => {
  it('a recompensa de um objetivo entra até o limite; o corte é desperdício e o depósito enche', () => {
    // O terceiro aldeão chega aos 48 min e cumpre o objetivo, que rende +40 de comida.
    const start = gameWith((draft) => {
      draft.settlement.resources.food = 640_000;
    });
    const ordered = accept(start, command('recruitVillagers', { quantity: 3 })).state;
    expect(ordered.settlement.resources.food).toBe(490_000);
    const { state, events } = advanceTo(ordered, 48 * MINUTE);
    // 16 min a 5, a 6 e a 7 por hora: 4,8 de comida. Cabem 14,8 dos 40.
    expect(state.settlement.resources.food).toBe(500_000);
    expect(state.stats.wasted_food).toBe(25_200);
    expect(state.settlement.wasted.food).toBe(25_200);
    const atArrival = events.filter((event) => event.atMs === 48 * MINUTE);
    expect(types(atArrival)).toEqual([
      'recruitmentFinished',
      'objectiveCompleted',
      'storageFilled',
    ]);
    // O evento diz o que entrou e o que não coube: é o que separa, no Relatório de Retorno, a
    // recompensa cortada da produção que foi ao chão.
    expect(atArrival[1]?.data).toEqual({
      objective: 'recruitVillagers',
      gained_food: 14.8,
      lost_food: 25.2,
    });
    // A linha da Crônica promete a recompensa inteira e diz o que se perdeu dela.
    expect(atArrival[1]?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Recrute 3 aldeões. Recompensa: +40 comida. Faltou lugar no depósito, e foi ao chão: 25,2 de comida.',
    );
    // O corte entra na conta do dia.
    const day = advanceTo(state, DAY);
    expect(eventsOfType(day.events, 'storageWasted')[0]?.data).toEqual({ wasted_food: 25 });
  });

  it('estoque que caiu do limite no meio do trecho e voltou por um ganho: outro episódio, com ou sem corte', () => {
    // A Despensa está cheia e a comida desce 5 por hora. Aos 48 min chega o terceiro aldeão, e
    // a recompensa do objetivo (+40) leva o estoque de volta ao limite.
    const start = gameWith((draft) => {
      draft.settlement.resources.food = 500_000;
      draft.settlement.recruitmentQueue = [{ finishesAtMs: 48 * MINUTE }];
      draft.stats.villagersRecruited = 2;
      draft.objectives = { active: ['recruitVillagers'], completed: [] };
    });
    expect(fullStores(start)).toEqual(['food']);
    const direct = advanceTo(start, HOUR);
    expect(types(direct.events)).toEqual([
      'recruitmentFinished',
      'objectiveCompleted',
      'storageFilled',
    ]);
    // Desceu 4 em 48 min; dos 40 da recompensa cabem 4.
    expect(direct.events[1]?.data).toEqual({
      objective: 'recruitVillagers',
      gained_food: 4,
      lost_food: 36,
    });
    expect(direct.state.stats.wasted_food).toBe(36_000);
    for (const cut of [1, 30 * MINUTE, 48 * MINUTE - 1, 48 * MINUTE, 48 * MINUTE + 1]) {
      const half = advanceTo(start, cut);
      const split = advanceTo(half.state, HOUR);
      expect(split.state, String(cut)).toStrictEqual(direct.state);
      expect([...half.events, ...split.events], String(cut)).toStrictEqual(direct.events);
    }
  });

  it('recompensa que cabe inteira não perde nada', () => {
    const { state, events } = accept(
      newGame(),
      command('startConstruction', { building: 'housing' }),
    );
    // 120 − 80 da obra + 30 da recompensa.
    expect(state.settlement.resources.wood).toBe(70_000);
    expect(state.stats.wasted_wood).toBeUndefined();
    const [completed] = eventsOfType(events, 'objectiveCompleted');
    expect(completed?.data).toEqual({ objective: 'upgradeHousing', gained_wood: 30 });
    // Sem corte, a linha da Crônica é a de sempre.
    expect(completed?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Inicie a melhoria das Habitações. Recompensa: +30 madeira.',
    );
  });

  it('recompensa em ouro entra inteira, com o ouro que houver', () => {
    const rich = gameWith((draft) => {
      draft.settlement.resources.gold = 9_000_000;
    });
    const { state } = accept(rich, command('setWorkers', { building: 'farm', count: 2 }));
    expect(state.settlement.resources.gold).toBe(9_020_000);
  });

  /** Habitações em obra (pagos 80 de madeira e 20 de pedra), com `wood` de madeira no pátio. */
  const cancelling = (wood: number) =>
    gameAt(SPRING, (draft) => {
      draft.settlement.resources.wood = wood;
      draft.settlement.constructionQueues = [
        { building: 'housing', targetLevel: 2, startedAtMs: 0, finishesAtMs: DAY },
        null,
      ];
    });

  it('a devolução de um cancelamento entra até o limite, e a visão já avisava do corte', () => {
    const start = cancelling(470_000);
    expect(deriveViewState(start, 0).constructions.active?.refund).toEqual([
      { resource: 'wood', label: 'Madeira', amount: 30, lost: 34 },
      { resource: 'stone', label: 'Pedra', amount: 16, lost: 0 },
    ]);
    const { state, events } = accept(start, command('cancelConstruction', { building: 'housing' }));
    expect(state.settlement.resources).toMatchObject({ wood: 500_000, stone: 81_000 });
    expect(state.stats.wasted_wood).toBe(34_000);
    expect(types(events)).toEqual(['constructionCancelled', 'storageFilled']);
    expect(events[0]?.data).toEqual({
      building: 'housing',
      level: 1,
      gained_wood: 30,
      lost_wood: 34,
      gained_stone: 16,
    });
  });

  it('com o estoque já no limite, a devolução se perde inteira e não abre outro episódio', () => {
    const start = cancelling(500_000);
    expect(deriveViewState(start, 0).constructions.active?.refund[0]).toEqual({
      resource: 'wood',
      label: 'Madeira',
      amount: 0,
      lost: 64,
    });
    const { state, events } = accept(start, command('cancelConstruction', { building: 'housing' }));
    expect(state.settlement.resources.wood).toBe(500_000);
    expect(state.stats.wasted_wood).toBe(64_000);
    expect(types(events)).toEqual(['constructionCancelled']);
    expect(events[0]?.data).toEqual({
      building: 'housing',
      level: 1,
      lost_wood: 64,
      gained_stone: 16,
    });
  });

  it('com folga, a devolução volta inteira', () => {
    const { state } = accept(
      cancelling(100_000),
      command('cancelConstruction', { building: 'housing' }),
    );
    expect(state.settlement.resources.wood).toBe(164_000);
    expect(state.stats.wasted_wood).toBeUndefined();
  });
});

describe('estoque herdado acima do limite (ADR 0013, decisão 4)', () => {
  const inherited = woodcutters(3, (draft) => {
    draft.settlement.resources.wood = 2_000_000;
  });

  it('fica como está, não recebe produção e a produção conta como desperdício', () => {
    const { state, events } = advanceTo(inherited, DAY);
    expect(state.settlement.resources.wood).toBe(2_000_000);
    expect(state.stats.wasted_wood).toBe(48_000);
    // Não encheu: já estava lá. Só o desperdício do dia aparece.
    expect(eventsOfType(events, 'storageFilled')).toEqual([]);
    expect(eventsOfType(events, 'storageWasted').map((event) => event.data)).toEqual([
      { wasted_wood: 48 },
    ]);
  });

  it('pode ser gasto, inclusive em obra que pede mais do que o limite', () => {
    const state = gameWith((draft) => {
      draft.settlement.buildings.townHall = 4;
      draft.settlement.resources = { food: 0, wood: 2_000_000, stone: 2_000_000, gold: 2_000_000 };
      draft.settlement.workers.farm = 5;
    });
    // Salão 4→5: 875 de madeira, com 500 de limite. Quem tem, pode gastar.
    const started = accept(state, command('startConstruction', { building: 'townHall' })).state;
    expect(started.settlement.resources.wood).toBe(2_000_000 - 875_000);
  });

  it('gasto até abaixo do limite, volta a receber produção e enche de novo: aí sim, uma linha', () => {
    const state = woodcutters(3, (draft) => {
      draft.settlement.resources.wood = 560_000;
      draft.settlement.buildings.housing = 1;
    });
    // Habitações: 80 de madeira. 560 − 80 = 480; faltam 20 a 24 por hora: 50 minutos.
    const started = accept(state, command('startConstruction', { building: 'housing' }));
    expect(eventsOfType(started.events, 'storageFilled')).toEqual([]);
    const { events } = advanceTo(started.state, HOUR);
    expect(eventsOfType(events, 'storageFilled').map((event) => event.atMs)).toEqual([50 * MINUTE]);
  });

  it('a visão diz que está cheio e por que nada entra', () => {
    expect(row(inherited, 'wood')).toMatchObject({
      stock: 2000,
      cap: 500,
      full: true,
      fullInSeconds: null,
      wastingPerHour: 24,
      // O Salão ainda está no nível 1: a frase diz o que libera o Armazém.
      fullNote:
        'Pátio cheio: 24/h de madeira indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, gaste madeira.',
    });
    const idle = woodcutters(0, (draft) => {
      draft.settlement.resources.wood = 2_000_000;
    });
    expect(row(idle, 'wood')).toMatchObject({
      full: true,
      wastingPerHour: 0,
      fullNote:
        'Pátio cheio: há mais madeira do que cabe, e nada entra até o estoque baixar de 500.',
    });
  });
});

describe('construir o Celeiro e o Armazém', () => {
  /** Salão no nível 2, com madeira e pedra para as primeiras obras. */
  const hall2 = (edit: (draft: GameState) => void = () => {}) =>
    gameAt(SPRING, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.workers.farm = 1;
      draft.settlement.resources = { food: 200_000, wood: 450_000, stone: 300_000, gold: 100_000 };
      edit(draft);
    });

  it('antes do Salão no nível 2 a obra não começa, e o motivo diz o que fazer', () => {
    const rich = gameWith((draft) => {
      draft.settlement.resources = { food: 0, wood: 450_000, stone: 300_000, gold: 0 };
      draft.settlement.workers.farm = 5;
    });
    for (const building of ['granary', 'warehouse'] as const) {
      expect(refuse(rich, command('startConstruction', { building }))).toEqual({
        code: 'GATE_LOCKED',
        message: 'Melhore antes o Salão do Senhor para o nível 2.',
      });
    }
  });

  it('construir é a obra 0 → 1, pelo custo base, e termina com evento próprio', () => {
    const started = accept(hall2(), command('startConstruction', { building: 'granary' }));
    expect(started.state.settlement.resources).toMatchObject({ wood: 290_000, stone: 220_000 });
    expect(started.state.settlement.constructionQueues).toEqual([
      { building: 'granary', targetLevel: 1, startedAtMs: 0, finishesAtMs: 10 * MINUTE },
      null,
    ]);
    expect(started.events).toEqual([
      {
        type: 'constructionStarted',
        atMs: 0,
        text: 'No 1º dia da Primavera, os pedreiros começaram a levantar o Celeiro em Pedra Alta.',
        data: { building: 'granary', level: 1, spent_wood: 160, spent_stone: 80 },
      },
    ]);
    const { state, events } = advanceTo(started.state, 10 * MINUTE);
    expect(state.settlement.buildings.granary).toBe(1);
    expect(events).toEqual([
      {
        type: 'buildingFounded',
        atMs: 10 * MINUTE,
        text: 'No 1º dia da Primavera, ergueu-se o Celeiro em Pedra Alta.',
        data: { building: 'granary', level: 1 },
      },
    ]);
    expect(storageCapacity(state, 'food')).toBe(900_000);
    // A madeira e a pedra continuam com o limite inicial: o Celeiro só guarda comida.
    expect(storageCapacity(state, 'wood')).toBe(500_000);
  });

  it('a melhoria seguinte custa o base × 1,6 e termina como qualquer melhoria', () => {
    const built = hall2((draft) => {
      draft.settlement.buildings.warehouse = 1;
    });
    const started = accept(built, command('startConstruction', { building: 'warehouse' }));
    expect(started.state.settlement.resources).toMatchObject({ wood: 194_000, stone: 172_000 });
    expect(started.events[0]?.text).toBe(
      'No 1º dia da Primavera, os pedreiros começaram a erguer o Armazém ao 2º nível.',
    );
    const { state, events } = advanceTo(started.state, 15 * MINUTE);
    expect(types(events)).toEqual(['constructionFinished']);
    expect(storageCapacity(state, 'wood')).toBe(1_500_000);
    expect(storageCapacity(state, 'stone')).toBe(1_500_000);
  });

  it('cancelar a construção devolve 80% e deixa o edifício no chão, com frase própria', () => {
    const started = accept(hall2(), command('startConstruction', { building: 'warehouse' })).state;
    const { state, events } = accept(
      started,
      command('cancelConstruction', { building: 'warehouse' }),
    );
    expect(state.settlement.buildings.warehouse).toBe(0);
    expect(state.settlement.resources).toMatchObject({ wood: 418_000, stone: 284_000 });
    expect(events[0]).toMatchObject({
      type: 'constructionCancelled',
      text: 'No 1º dia da Primavera, os pedreiros largaram as ferramentas: o Armazém ficou só nos alicerces.',
      data: { building: 'warehouse', level: 0, gained_wood: 128, gained_stone: 64 },
    });
  });

  it('o depósito segue a regra do Salão mais um, como os outros', () => {
    const built = hall2((draft) => {
      draft.settlement.buildings.granary = 3;
      draft.settlement.buildings.warehouse = 8;
      draft.settlement.resources.wood = 3_000_000;
      draft.settlement.resources.stone = 3_000_000;
    });
    expect(refuse(built, command('startConstruction', { building: 'granary' }))).toEqual({
      code: 'GATE_LOCKED',
      message: 'Melhore antes o Salão do Senhor para o nível 3.',
    });
    expect(refuse(built, command('startConstruction', { building: 'warehouse' })).code).toBe(
      'MAX_LEVEL',
    );
  });

  it('planejar a construção guarda o nível 1 e mostra o custo base', () => {
    const { state } = accept(newGame(), command('planConstruction', { building: 'granary' }));
    expect(state.settlement.planned).toEqual([
      { building: 'granary', targetLevel: 1, autoStart: false },
    ]);
    expect(deriveViewState(state, 0).constructions.planned[0]).toMatchObject({
      building: 'granary',
      fromLevel: 0,
      targetLevel: 1,
      durationSeconds: 600,
      effect: 'Capacidade de comida: 500 → 900.',
      cost: [
        { resource: 'wood', amount: 160, missing: 40 },
        { resource: 'stone', amount: 80, missing: 15 },
      ],
    });
  });

  it('a obra que amplia o depósito no instante em que o estoque chegaria ao limite: ele não enche', () => {
    // 6 habitantes e 2 fazendeiros: +18 por hora. Faltam 3 de comida: 10 minutos, que é quando
    // o Celeiro fica pronto. A obra vem primeiro no instante, e o limite passa a 900.
    const start = hall2((draft) => {
      draft.settlement.population.villagers = 6;
      draft.settlement.workers.farm = 2;
      draft.settlement.resources.food = 497_000;
    });
    const started = accept(start, command('startConstruction', { building: 'granary' })).state;
    expect(storageFillsIn(started, netRates(started))).toBe(10 * MINUTE);
    const { state, events } = advanceTo(started, 10 * MINUTE);
    expect(state.settlement.resources.food).toBe(500_000);
    expect(types(events)).toEqual(['buildingFounded']);
    expect(fullStores(state)).toEqual([]);
    // Sem a obra, no mesmo instante, a Despensa enche.
    const without = advanceTo(start, 10 * MINUTE);
    expect(types(without.events)).toEqual(['storageFilled']);
    // E o Celeiro novo enche mais tarde, no limite dele: faltam 400, a 18 por hora no primeiro
    // dia e um pouco mais a cada virada, com a experiência da Fazenda e a moral em 60
    // (24 × mestria × moral − 6).
    const fillsAt = reachedAt(
      10 * MINUTE,
      400_000,
      (day) => withMorale(24 * masteryOnDay(day), moraleOn(day)) - 6_000,
    );
    expect(fillsAt).toBeLessThan(10 * MINUTE + Math.ceil((400_000 * HOUR) / 18_000));
    const later = advanceTo(state, 30 * HOUR);
    expect(eventsOfType(later.events, 'storageFilled')).toMatchObject([
      { atMs: fillsAt, data: { cap: 900, level: 1 } },
    ]);
  });

  it('cheio de madeira, ampliar o Armazém encerra o episódio na conclusão da obra', () => {
    const start = hall2((draft) => {
      draft.settlement.workers.lumberMill = 3;
      draft.settlement.buildings.granary = 8;
      draft.settlement.resources.wood = 660_000;
    });
    // 660 − 160 da obra = 500: cheio. Dez minutos de desperdício (4 de madeira) até a obra acabar.
    const started = accept(start, command('startConstruction', { building: 'warehouse' }));
    expect(fullStores(started.state)).toEqual(['wood']);
    const { state, events } = advanceTo(started.state, DAY);
    expect(types(events)).toEqual(['buildingFounded', 'storageWasted', 'dayStarted']);
    expect(state.stats.wasted_wood).toBe(4_000);
    expect(state.settlement.resources.wood).toBe(500_000 + 24_000 * 2 - 4_000);
  });
});

describe('custo que não cabe no depósito', () => {
  const hall = (level: number, edit: (draft: GameState) => void = () => {}) =>
    gameWith((draft) => {
      draft.settlement.buildings.townHall = level;
      draft.settlement.workers.farm = 5;
      edit(draft);
    });

  it('a obra não começa, e o motivo diz quanto pede, quanto cabe e o que fazer', () => {
    // Salão 4→5: 875 de madeira, 583 de pedra e 583 de ouro; sem Armazém cabem 500.
    const state = hall(4);
    const refusal = refuse(state, command('startConstruction', { building: 'townHall' }));
    expect(refusal).toEqual({
      code: 'EXCEEDS_STORAGE',
      message: 'A obra pede 875 de madeira e o Pátio só guarda 500: construa o Armazém primeiro.',
    });
    const upgrade = deriveViewState(state, 0).constructions.available.find(
      (entry) => entry.building === 'townHall',
    );
    expect(upgrade).toMatchObject({
      blockedCode: 'EXCEEDS_STORAGE',
      blockedReason: refusal.message,
      affordable: false,
    });
  });

  it('com o Armazém que guarda o bastante, volta a ser só falta de recurso', () => {
    const state = hall(4, (draft) => {
      draft.settlement.buildings.warehouse = 1;
    });
    expect(refuse(state, command('startConstruction', { building: 'townHall' }))).toEqual({
      code: 'INSUFFICIENT_RESOURCES',
      message: 'Faltam 755 madeira, 518 pedra e 333 ouro.',
    });
  });

  it('com o Armazém pequeno demais, a frase manda ampliá-lo', () => {
    // Salão 5→6: 1.575 de madeira; o Armazém no nível 1 guarda 900.
    const state = hall(5, (draft) => {
      draft.settlement.buildings.warehouse = 1;
    });
    expect(refuse(state, command('startConstruction', { building: 'townHall' })).message).toBe(
      'A obra pede 1.575 de madeira e o Armazém só guarda 900: amplie o Armazém primeiro.',
    );
  });

  it('em Rei de Ferro o limite inicial é 400, e o Salão no nível 3 já pede o Armazém', () => {
    const state = hall(3, (draft) => {
      draft.settings.difficulty = 'ironKing';
    });
    // Salão 3→4: 486 de madeira.
    expect(refuse(state, command('startConstruction', { building: 'townHall' })).message).toBe(
      'A obra pede 486 de madeira e o Pátio só guarda 400: construa o Armazém primeiro.',
    );
    const lord = hall(3);
    expect(refuse(lord, command('startConstruction', { building: 'townHall' })).code).toBe(
      'INSUFFICIENT_RESOURCES',
    );
  });

  it('quando o que não cabe é a obra do próprio depósito, a frase não manda ampliá-lo', () => {
    // Armazém 7→8 em Rei de Ferro: 4.295 de madeira, e no nível 7 ele guarda 3.600.
    const state = hall(8, (draft) => {
      draft.settings.difficulty = 'ironKing';
      draft.settlement.buildings.warehouse = 7;
    });
    expect(refuse(state, command('startConstruction', { building: 'warehouse' }))).toEqual({
      code: 'EXCEEDS_STORAGE',
      message:
        'A obra pede 4.295 de madeira e o Armazém só guarda 3.600: não há como juntar tanto.',
    });
  });

  it('o orçamento continua dizendo o que falta, para a tela mostrar o custo inteiro', () => {
    const quote = upgradeQuote(hall(4), 'townHall');
    expect(quote.blocked?.code).toBe('EXCEEDS_STORAGE');
    expect(quote.missing).toEqual({ wood: 755, stone: 518, gold: 333 });
  });

  it('as outras recusas vêm antes: fila ocupada e Salão continuam mandando', () => {
    // Com o Salão no nível 4 as filas são duas: a recusa da fila só vem com as duas ocupadas.
    const oneBusy = hall(4, (draft) => {
      draft.settlement.constructionQueues = [
        { building: 'farm', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    expect(refuse(oneBusy, command('startConstruction', { building: 'townHall' })).code).toBe(
      'EXCEEDS_STORAGE',
    );
    const busy = hall(4, (draft) => {
      draft.settlement.constructionQueues = [
        { building: 'farm', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
        { building: 'quarry', targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
      ];
    });
    expect(refuse(busy, command('startConstruction', { building: 'townHall' })).code).toBe(
      'QUEUE_BUSY',
    );
  });
});

describe('a visão do armazenamento', () => {
  it('estoque e limite lado a lado, com a explicação do limite', () => {
    const view = deriveViewState(newGame(), 0);
    expect(
      view.resources.map((entry) => [
        entry.id,
        entry.stock,
        entry.cap,
        entry.capBreakdown,
        entry.storageBuilding,
        entry.storageLabel,
      ]),
    ).toEqual([
      ['food', 180, 500, '500 iniciais', 'granary', 'Despensa'],
      ['wood', 120, 500, '500 iniciais', 'warehouse', 'Pátio'],
      ['stone', 65, 500, '500 iniciais', 'warehouse', 'Pátio'],
      ['gold', 250, null, null, null, null],
    ]);
  });

  it.each([
    ['lord', 0, 500, '500 iniciais', 'Despensa'],
    ['ironKing', 0, 400, '500 iniciais × 0,8 (Rei de Ferro) = 400', 'Despensa'],
    ['peasant', 0, 625, '500 iniciais × 1,25 (Camponês) = 625', 'Despensa'],
    ['lord', 2, 1500, 'Celeiro Nv2: 1.500', 'Celeiro'],
    ['ironKing', 2, 1200, 'Celeiro Nv2: 1.500 × 0,8 (Rei de Ferro) = 1.200', 'Celeiro'],
    ['peasant', 2, 1875, 'Celeiro Nv2: 1.500 × 1,25 (Camponês) = 1.875', 'Celeiro'],
  ] as const)('%s com o Celeiro no nível %i: %i', (difficulty, level, cap, breakdown, label) => {
    const state = gameWith((draft) => {
      draft.settings.difficulty = difficulty;
      draft.settlement.buildings.granary = level;
    });
    expect(row(state, 'food')).toMatchObject({
      cap,
      capBreakdown: breakdown,
      storageLabel: label,
      storageBuilding: 'granary',
    });
  });

  it('"cheio em" sai em segundos reais, no ritmo da partida', () => {
    const start = woodcutters(3);
    // 14 h 37 min 7,794 s de jogo: já com a experiência que a Serraria ganha no caminho e com
    // a moral que a primeira virada leva a 60.
    const fillsAt = reachedAt(SPRING, 380_000, (day) =>
      withMorale(24 * masteryOnDay(day), moraleOn(day)),
    );
    expect(row(start, 'wood')).toMatchObject({
      full: false,
      fullInSeconds: Math.ceil(fillsAt / 1000),
      fullNote: null,
    });
    expect(row(start, 'wood').fullInSeconds).toBe(52_628);
    expect(row(start, 'wood', 3).fullInSeconds).toBe(Math.ceil(fillsAt / 3 / 1000));
    expect(row(start, 'wood', 0.5).fullInSeconds).toBe(Math.ceil((fillsAt * 2) / 1000));
    // O ritmo gravado na partida vale sem ninguém informar.
    const fast = woodcutters(3, (draft) => {
      draft.settings.timeScale = 3;
    });
    expect(row(fast, 'wood').fullInSeconds).toBe(Math.ceil(fillsAt / 3 / 1000));
    // Arredonda para cima: faltando um milissegundo de jogo, ainda falta um segundo.
    const almost = advanceTo(start, fillsAt - 1).state;
    expect(row(almost, 'wood').fullInSeconds).toBe(1);
  });

  it('sem subir, não há previsão; cheio, não há previsão', () => {
    expect(row(newGame(), 'food')).toMatchObject({ full: false, fullInSeconds: null });
    expect(row(woodcutters(0), 'wood')).toMatchObject({ fullInSeconds: null, fullNote: null });
    const full = woodcutters(0, (draft) => {
      draft.settlement.resources.wood = 500_000;
    });
    // No limite exato e sem perda: cheio, e nada a acrescentar.
    expect(row(full, 'wood')).toMatchObject({
      full: true,
      fullInSeconds: null,
      fullNote: null,
      wastingPerHour: 0,
    });
  });

  it('cheio e produzindo: o que vai ao chão por hora real e o que fazer', () => {
    const full = (edit: (draft: GameState) => void = () => {}) =>
      woodcutters(3, (draft) => {
        draft.settlement.buildings.townHall = 2;
        draft.settlement.resources.wood = 5_100_000;
        edit(draft);
      });
    expect(row(full(), 'wood')).toMatchObject({
      full: true,
      wastingPerHour: 24,
      fullNote: 'Pátio cheio: 24/h de madeira indo ao chão. Construa o Armazém ou gaste madeira.',
    });
    expect(row(full(), 'wood', 3)).toMatchObject({
      wastingPerHour: 72,
      fullNote: 'Pátio cheio: 72/h de madeira indo ao chão. Construa o Armazém ou gaste madeira.',
    });
    const built = full((draft) => {
      draft.settlement.buildings.warehouse = 2;
    });
    expect(row(built, 'wood').fullNote).toBe(
      'Armazém cheio: 24/h de madeira indo ao chão. Amplie o Armazém ou gaste madeira.',
    );
    const maxed = full((draft) => {
      draft.settlement.buildings.warehouse = 8;
    });
    expect(row(maxed, 'wood').fullNote).toBe(
      'Armazém cheio: 24/h de madeira indo ao chão. Gaste madeira.',
    );
    const underway = full((draft) => {
      draft.settlement.constructionQueues = [
        { building: 'warehouse', targetLevel: 1, startedAtMs: 0, finishesAtMs: HOUR },
        null,
      ];
    });
    expect(row(underway, 'wood').fullNote).toBe(
      'Pátio cheio: 24/h de madeira indo ao chão. A obra do Armazém já vai abrir espaço.',
    );
    // A comida não paga obra nenhuma: quem a gasta é o recrutamento. A frase diz isso, e a
    // outra saída que está sempre à mão, em vez de mandar "gastar comida".
    const pantry = gameAt(SPRING, (draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.workers.farm = 5;
      draft.settlement.resources.food = 500_000;
    });
    expect(row(pantry, 'food').fullNote).toBe(
      'Despensa cheia: 55/h de comida indo ao chão. Construa o Celeiro, recrute aldeões ou ponha parte dos lavradores em outro ofício.',
    );
    // Com o Salão no nível 1 o depósito ainda não pode ser erguido: a frase diz o que o
    // libera, em vez de mandar construir o que a lista de obras recusaria.
    const early = full((draft) => {
      draft.settlement.buildings.townHall = 1;
    });
    expect(row(early, 'wood').fullNote).toBe(
      'Pátio cheio: 24/h de madeira indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, gaste madeira.',
    );
  });

  it('sem obra por fazer que leve o material, a frase manda trocar de ofício, e não "gastar"', () => {
    // O fim das obras em Senhor: o Salão no nível 7 (o nível 8 pede 5.102 de madeira, e o
    // Armazém no nível máximo guarda 5.100) e todo o resto no nível 8, preso à regra "nível do
    // Salão mais um". Nenhum botão gasta madeira: a saída que resta é tirar gente da Serraria.
    const ended = (edit: (draft: GameState) => void = () => {}) =>
      woodcutters(3, (draft) => {
        draft.settlement.buildings = {
          townHall: 7,
          farm: 8,
          lumberMill: 8,
          quarry: 8,
          goldMine: 8,
          housing: 8,
          granary: 8,
          warehouse: 8,
        };
        edit(draft);
        draft.settlement.resources.wood = storageCapacity(draft, 'wood') ?? 0;
      });
    const moveHands =
      /^Armazém cheio: [\d.,]+\/h de madeira indo ao chão\. Ponha parte dos lenhadores em outro ofício\.$/;
    const none = ended();
    expect(BUILDING_IDS.filter((building) => upgradeStillPossible(none, building))).toEqual([]);
    expect(row(none, 'wood')).toMatchObject({ full: true, cap: 5100 });
    expect(row(none, 'wood').fullNote).toMatch(moveHands);

    // Com o Armazém um nível abaixo ainda há obra: a dele, e depois dela a do Salão.
    const oneLeft = ended((draft) => {
      draft.settlement.buildings.warehouse = 7;
    });
    expect(upgradeStillPossible(oneLeft, 'warehouse')).toBe(true);
    expect(upgradeStillPossible(oneLeft, 'townHall')).toBe(true);
    expect(upgradeStillPossible(oneLeft, 'farm')).toBe(true);
    expect(row(oneLeft, 'wood').fullNote).toMatch(/Amplie o Armazém ou gaste madeira\.$/);

    // Com a última obra em curso, o feudo ainda está construindo.
    const lastOne = ended((draft) => {
      draft.settlement.buildings.farm = 7;
      draft.settlement.constructionQueues = [
        { building: 'farm', targetLevel: 8, startedAtMs: 0, finishesAtMs: SPRING + HOUR },
        null,
      ];
    });
    expect(upgradeStillPossible(lastOne, 'farm')).toBe(true);
    expect(row(lastOne, 'wood').fullNote).toMatch(/Gaste madeira\.$/);

    // Em Rei de Ferro o Armazém para no nível 7: a obra do nível 8 pede 4.295 e ele guarda
    // 3.600. A frase não manda ampliar o que a lista de obras recusa. Com o Salão no nível 6
    // ainda há o que pagar (o nível 7 pede 2.834); no nível 7, mais nada.
    const ironKing = (townHall: number) =>
      ended((draft) => {
        draft.settings.difficulty = 'ironKing';
        draft.settlement.buildings.warehouse = 7;
        draft.settlement.buildings.granary = 7;
        draft.settlement.buildings.townHall = townHall;
      });
    expect(row(ironKing(6), 'wood').cap).toBe(3600);
    expect(upgradeStillPossible(ironKing(6), 'warehouse')).toBe(false);
    expect(row(ironKing(6), 'wood').fullNote).toMatch(/indo ao chão\. Gaste madeira\.$/);
    expect(row(ironKing(7), 'wood').fullNote).toMatch(moveHands);

    // A pedra segue a mesma regra, com os canteiros.
    const stone = ended((draft) => {
      draft.settlement.workers = { farm: 1, lumberMill: 0, quarry: 3, goldMine: 0 };
      draft.settlement.resources.stone = storageCapacity(draft, 'stone') ?? 0;
    });
    expect(row(stone, 'stone').fullNote).toMatch(
      /^Armazém cheio: [\d.,]+\/h de pedra indo ao chão\. Ponha parte dos canteiros em outro ofício\.$/,
    );
  });

  describe('a despensa cheia antes de o Celeiro existir', () => {
    /**
     * Verão, o Salão ainda no nível 1 (o Celeiro pede o nível 2): 10 habitantes nas 10 vagas,
     * seis deles na Fazenda, e a despensa no limite.
     */
    const packed = (edit: (draft: GameState) => void = () => {}) =>
      gameAt(SUMMER + 2 * DAY, (draft) => {
        const { settlement } = draft;
        settlement.population.villagers = 10;
        settlement.workers = { farm: 6, lumberMill: 2, quarry: 1, goldMine: 1 };
        settlement.resources = { ...settlement.resources, food: 500_000 };
        edit(draft);
      });
    const viewOf = (state: GameState) => deriveViewState(state, state.lastProcessedAt);

    it('com as casas cheias não há como gastar comida: a frase aponta os lavradores', () => {
      const state = packed();
      expect(viewOf(state).recruitment).toMatchObject({
        maxQuantity: 0,
        blockedReason: 'Não há vaga nas Habitações. Melhore as Habitações ou o Salão.',
      });
      const granary = viewOf(state).constructions.available.find(
        (entry) => entry.building === 'granary',
      );
      expect(granary?.blockedCode).toBe('GATE_LOCKED');
      expect(row(state, 'food')).toMatchObject({
        full: true,
        wastingPerHour: 50,
        fullNote:
          'Despensa cheia: 50/h de comida indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, ponha parte dos lavradores em outro ofício.',
      });
    });

    it('com vaga nas casas e ouro para a ordem, recrutar também é saída', () => {
      const state = packed((draft) => {
        draft.settlement.population.villagers = 8;
        draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 1 };
        draft.settlement.resources.gold = 30_000;
      });
      expect(viewOf(state).recruitment.blockedReason).toBeNull();
      expect(row(state, 'food').fullNote).toBe(
        'Despensa cheia: 52/h de comida indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, recrute aldeões ou ponha parte dos lavradores em outro ofício.',
      );
      // Sem ouro para a ordem, recrutar não é saída agora.
      const broke = packed((draft) => {
        draft.settlement.population.villagers = 8;
        draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 1 };
        draft.settlement.resources.gold = 0;
      });
      expect(row(broke, 'food').fullNote).toBe(
        'Despensa cheia: 52/h de comida indo ao chão. Melhore antes o Salão do Senhor para o nível 2. Até lá, ponha parte dos lavradores em outro ofício.',
      );
    });

    it('nenhuma frase da comida manda "gastar comida", em nenhuma situação do depósito', () => {
      for (const townHall of [1, 2]) {
        for (const granary of [0, 1, buildings.granary.maxLevel]) {
          for (const villagers of [8, 10]) {
            const state = packed((draft) => {
              draft.settlement.buildings.townHall = townHall;
              draft.settlement.buildings.granary = granary;
              draft.settlement.population.villagers = villagers;
              draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 1 };
              draft.settlement.resources.food = 9_000_000;
              draft.settlement.resources.gold = 30_000;
            });
            const note = row(state, 'food').fullNote;
            expect(note).not.toBeNull();
            expect(note).not.toMatch(/gaste comida/i);
            expect(note).toMatch(/ponha parte dos lavradores em outro ofício\.$/i);
          }
        }
      }
      // Com o Celeiro no teto, sobram as duas saídas que não são obra.
      const maxed = packed((draft) => {
        draft.settlement.buildings.townHall = 2;
        draft.settlement.buildings.granary = buildings.granary.maxLevel;
        draft.settlement.population.villagers = 8;
        draft.settlement.workers = { farm: 6, lumberMill: 1, quarry: 0, goldMine: 1 };
        draft.settlement.resources.food = 9_000_000;
        draft.settlement.resources.gold = 30_000;
      });
      expect(row(maxed, 'food').fullNote).toMatch(
        /^Celeiro cheio: [\d,]+\/h de comida indo ao chão\. Recrute aldeões ou ponha parte dos lavradores em outro ofício\.$/,
      );
    });
  });

  it('o desperdício ainda não relatado aparece, e some na virada do dia', () => {
    const start = woodcutters(3, (draft) => {
      draft.settlement.resources.wood = 500_000;
    });
    expect(row(advanceTo(start, HOUR).state, 'wood').wastedToday).toBe(24);
    expect(row(advanceTo(start, DAY - 1).state, 'wood').wastedToday).toBe(47);
    expect(row(advanceTo(start, DAY).state, 'wood').wastedToday).toBe(0);
  });

  describe('a previsão não olha além do que muda a taxa', () => {
    it('a virada de estação', () => {
      // A duas horas do verão, com 15 h 50 min para encher: a serraria muda de ritmo antes.
      const start = gameAt(SUMMER - DAY, (draft) => {
        draft.settlement.workers = { farm: 1, lumberMill: 3, quarry: 0, goldMine: 0 };
        draft.settlement.buildings.granary = 8;
      });
      expect(row(start, 'wood')).toMatchObject({
        full: false,
        fullInSeconds: null,
        fullNote: 'Não enche antes da virada para o Verão.',
      });
      // Enchendo antes da virada, a previsão vale.
      const close = gameAt(SUMMER - DAY, (draft) => {
        draft.settlement.workers = { farm: 1, lumberMill: 3, quarry: 0, goldMine: 0 };
        draft.settlement.buildings.granary = 8;
        draft.settlement.resources.wood = 476_000;
      });
      expect(row(close, 'wood')).toMatchObject({ fullInSeconds: 3600, fullNote: null });
      // E em cima da virada também: a taxa de agora vale até o instante dela, inclusive.
      const onTheLine = gameAt(SUMMER - DAY, (draft) => {
        draft.settlement.workers = { farm: 1, lumberMill: 3, quarry: 0, goldMine: 0 };
        draft.settlement.buildings.granary = 8;
        draft.settlement.resources.wood = 452_000;
      });
      expect(row(onTheLine, 'wood')).toMatchObject({ fullInSeconds: 7200, fullNote: null });
    });

    it('o fim da obra do edifício que produz o recurso, ou do depósito dele', () => {
      const building = (id: BuildingId) =>
        woodcutters(3, (draft) => {
          draft.settlement.constructionQueues = [
            { building: id, targetLevel: 2, startedAtMs: 0, finishesAtMs: HOUR },
            null,
          ];
        });
      expect(row(building('lumberMill'), 'wood')).toMatchObject({
        fullInSeconds: null,
        fullNote: 'Não enche antes do fim da obra da Serraria.',
      });
      expect(row(building('warehouse'), 'wood')).toMatchObject({
        fullInSeconds: null,
        fullNote: 'Não enche antes do fim da obra do Armazém.',
      });
      // Uma obra que não mexe na madeira nem no depósito dela não interrompe a previsão.
      expect(row(building('housing'), 'wood')).toMatchObject({
        fullInSeconds: 52_628,
        fullNote: null,
      });
      expect(row(building('granary'), 'wood').fullInSeconds).toBe(52_628);
    });

    it('a chegada de um aldeão, para a comida', () => {
      const start = gameAt(SPRING, (draft) => {
        draft.settlement.workers.farm = 2;
        draft.settlement.recruitmentQueue = [{ finishesAtMs: HOUR }];
      });
      // 24 − 5 = +19 por hora: 320 de comida levam quase 17 horas, e o aldeão chega em uma.
      expect(row(start, 'food')).toMatchObject({
        fullInSeconds: null,
        fullNote: 'Não enche antes da chegada do próximo aldeão.',
      });
      // A madeira não depende de quantas bocas há (fora do inverno).
      const lumber = woodcutters(3, (draft) => {
        draft.settlement.recruitmentQueue = [{ finishesAtMs: HOUR }];
      });
      expect(row(lumber, 'wood').fullInSeconds).toBe(52_628);
    });

    it('a comida acabando: a fome corta toda a produção', () => {
      const start = gameAt(SPRING, (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 3, quarry: 0, goldMine: 0 };
        draft.settlement.resources.food = 10_000;
      });
      // 10 de comida a 5 por hora: a fome chega em 2 horas, e a madeira levaria 15 h 50 min.
      expect(row(start, 'wood')).toMatchObject({
        fullInSeconds: null,
        fullNote: 'Não enche antes de a comida acabar.',
      });
    });

    it('a lenha acabando, no inverno: o frio corta toda a produção', () => {
      const start = gameAt(WINTER, (draft) => {
        draft.settlement.workers = { farm: 0, lumberMill: 0, quarry: 5, goldMine: 0 };
        draft.settlement.resources = { food: 400_000, wood: 5_000, stone: 400_000, gold: 0 };
      });
      // 5 de madeira a 2,5 por hora de lenha: o frio chega em 2 horas; a pedra levaria 5.
      expect(row(start, 'stone')).toMatchObject({
        fullInSeconds: null,
        fullNote: 'Não enche antes de a lenha acabar.',
      });
    });

    it('a previsão bate com o que acontece, com a experiência subindo no caminho', () => {
      const start = woodcutters(3);
      const seconds = row(start, 'wood').fullInSeconds ?? 0;
      const { events } = advanceTo(start, seconds * 1000);
      const filledAt = eventsOfType(events, 'storageFilled').map((event) => event.atMs);
      expect(filledAt).toHaveLength(1);
      // Ao segundo: a visão arredonda o milissegundo exato para cima.
      expect(Math.ceil((filledAt[0] ?? 0) / 1000)).toBe(seconds);
      expect(eventsOfType(advanceTo(start, (seconds - 1) * 1000).events, 'storageFilled')).toEqual(
        [],
      );
    });

    it('a previsão bate com o que acontece, com gente em adaptação no caminho', () => {
      // Quatro lenhadores recém-chegados: metade no primeiro dia de jogo, inteiros depois.
      const start = accept(
        woodcutters(0),
        command('setWorkers', { building: 'lumberMill', count: 4 }),
      ).state;
      const fillsAt = reachedAt(SPRING, 380_000, (day) =>
        day === 0 ? 16_000 : withMorale(32 * masteryOnDay(day), moraleOn(day)),
      );
      const seconds = row(start, 'wood').fullInSeconds;
      expect(seconds).toBe(Math.ceil(fillsAt / 1000));
      const { events } = advanceTo(start, fillsAt);
      expect(eventsOfType(events, 'storageFilled').map((event) => event.atMs)).toEqual([fillsAt]);
      // Com a taxa de agora, sem contar o fim da adaptação, a conta daria quase o dobro.
      expect(fillsAt).toBeLessThan(fillsIn(start, 'wood', netRates(start).wood) ?? 0);
    });

    it('a previsão não promete o que a experiência sozinha não entrega', () => {
      // Ninguém na Serraria: a madeira não sobe, com ou sem ofício.
      expect(row(woodcutters(0), 'wood').fullInSeconds).toBeNull();
      expect(row(woodcutters(0), 'wood').fullNote).toBeNull();
    });
  });

  it('a obra do depósito mostra o que ela muda, ao lado do custo', () => {
    const effects = (state: GameState) =>
      Object.fromEntries(
        deriveViewState(state, 0).constructions.available.map((entry) => [
          entry.building,
          entry.effect,
        ]),
      );
    expect(effects(newGame())).toEqual({
      townHall: null,
      farm: null,
      lumberMill: null,
      quarry: null,
      goldMine: null,
      housing: null,
      granary: 'Capacidade de comida: 500 → 900.',
      warehouse: 'Capacidade de madeira e de pedra: 500 → 900 cada.',
    });
    const iron = gameWith((draft) => {
      draft.settings.difficulty = 'ironKing';
      draft.settlement.buildings.warehouse = 1;
      draft.settlement.buildings.granary = 2;
    });
    expect(effects(iron)).toMatchObject({
      granary: 'Capacidade de comida: 1.200 → 1.680.',
      warehouse: 'Capacidade de madeira e de pedra: 720 → 1.200 cada.',
    });
  });

  it('o Celeiro e o Armazém aparecem na lista de obras desde o começo, com o motivo do bloqueio', () => {
    const available = deriveViewState(newGame(), 0).constructions.available;
    expect(available.filter((entry) => entry.fromLevel === 0)).toMatchObject([
      {
        building: 'granary',
        label: 'Celeiro',
        targetLevel: 1,
        durationSeconds: 600,
        blockedCode: 'GATE_LOCKED',
        blockedReason: 'Melhore antes o Salão do Senhor para o nível 2.',
        cost: [
          { resource: 'wood', amount: 160, missing: 40 },
          { resource: 'stone', amount: 80, missing: 15 },
        ],
      },
      { building: 'warehouse', label: 'Armazém', blockedCode: 'GATE_LOCKED' },
    ]);
  });
});

describe('objetivo 4: a recompensa é o desbloqueio', () => {
  it('concluir não credita recurso nenhum, e a frase diz o que foi liberado', () => {
    const start = gameWith((draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.objectives = { active: ['townHallLevel2'], completed: [] };
    });
    const { state, events } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
    expect(state.settlement.resources).toEqual(start.settlement.resources);
    const [completed] = eventsOfType(events, 'objectiveCompleted');
    expect(completed?.data).toEqual({ objective: 'townHallLevel2' });
    expect(completed?.text).toBe(
      'No 1º dia da Primavera, cumpriu-se um objetivo: Alcance o Salão do Senhor Nv2. Recompensa: desbloqueia o Celeiro e o Armazém.',
    );
    const view = deriveViewState(state, 0);
    expect(view.objectives.find((entry) => entry.id === 'townHallLevel2')).toMatchObject({
      status: 'completed',
      reward: 'desbloqueia o Celeiro e o Armazém',
    });
    // E o que a frase promete é verdade: as duas obras deixam de estar presas ao Salão.
    const blocked = Object.fromEntries(
      view.constructions.available.map((entry) => [entry.building, entry.blockedCode]),
    );
    expect(blocked.granary).not.toBe('GATE_LOCKED');
    expect(blocked.warehouse).not.toBe('GATE_LOCKED');
  });

  it('quem libera a obra é o Salão, não o objetivo', () => {
    const state = gameWith((draft) => {
      draft.settlement.buildings.townHall = 2;
      draft.settlement.resources = { food: 100_000, wood: 400_000, stone: 400_000, gold: 0 };
      draft.settlement.workers.farm = 5;
    });
    // O quarto objetivo nem foi revelado ainda.
    expect(state.objectives.active).not.toContain('townHallLevel2');
    expect(applyCommand(state, command('startConstruction', { building: 'granary' }), 0).ok).toBe(
      true,
    );
  });
});

describe('propriedades do armazenamento (GDD §15.4)', () => {
  const storageBuildings = ['granary', 'warehouse'] as const;
  const anyBuilding: BuildingId[] = [
    'townHall',
    'farm',
    'lumberMill',
    'quarry',
    'goldMine',
    'housing',
    ...storageBuildings,
  ];

  const scenario = fc.record({
    startMs: fc.nat(84 * DAY),
    difficulty: fc.constantFrom<DifficultyId>(...DIFFICULTY_IDS),
    villagers: fc.integer({ min: 3, max: 30 }),
    workers: fc.tuple(fc.nat(12), fc.nat(10), fc.nat(10), fc.nat(6)),
    levels: fc.tuple(fc.nat(3), fc.nat(3), fc.integer({ min: 1, max: 4 })),
    // Perto do limite muitas vezes, para o enchimento cair dentro do intervalo.
    stocks: fc.tuple(
      fc.oneof(fc.integer({ min: 300_000, max: 520_000 }), fc.nat(2_500_000)),
      fc.oneof(fc.integer({ min: 300_000, max: 520_000 }), fc.nat(2_500_000)),
      fc.oneof(fc.integer({ min: 300_000, max: 520_000 }), fc.nat(2_500_000)),
    ),
    rests: fc.tuple(
      fc.integer({ min: -3_599_999, max: 3_599_999 }),
      fc.integer({ min: -3_599_999, max: 3_599_999 }),
      fc.integer({ min: -3_599_999, max: 3_599_999 }),
    ),
    orders: fc.array(
      fc.oneof(
        fc.record({ build: fc.constantFrom(...anyBuilding) }),
        fc.record({ cancel: fc.constantFrom(...anyBuilding) }),
        fc.record({ recruit: fc.integer({ min: 1, max: 3 }) }),
      ),
      { maxLength: 4 },
    ),
    cuts: fc.array(fc.integer({ min: 1, max: 120 * HOUR }), { minLength: 2, maxLength: 5 }),
  });
  type Scenario = typeof scenario extends fc.Arbitrary<infer T> ? T : never;

  function prepare(plan: Scenario, clamp: boolean): GameState {
    let state = gameAt(plan.startMs, (draft) => {
      const { settlement } = draft;
      draft.settings.difficulty = plan.difficulty;
      settlement.population.villagers = plan.villagers;
      settlement.buildings.townHall = 4;
      settlement.buildings.housing = 6;
      settlement.buildings.granary = plan.levels[0];
      settlement.buildings.warehouse = plan.levels[1];
      settlement.buildings.farm = plan.levels[2];
      settlement.resources.gold = 2_000_000;
      CAPPED.forEach((id, index) => {
        const cap = storageCapacity(draft, id) ?? 0;
        const stock = plan.stocks[index] ?? 0;
        // `clamp`: uma partida que nasceu com os limites nunca tem mais do que cabe.
        settlement.resources[id] = clamp ? Math.min(stock, cap) : stock;
        settlement.accumulators[id] = plan.rests[index] ?? 0;
      });
    });
    const [farm, lumberMill, quarry, goldMine] = plan.workers;
    const orders: Command[] = [
      command('setWorkers', { building: 'farm', count: farm }),
      command('setWorkers', { building: 'lumberMill', count: lumberMill }),
      command('setWorkers', { building: 'quarry', count: quarry }),
      command('setWorkers', { building: 'goldMine', count: goldMine }),
      ...plan.orders.map((order) => {
        if ('build' in order) {
          return command('startConstruction', { building: order.build });
        }
        if ('cancel' in order) {
          return command('cancelConstruction', { building: order.cancel });
        }
        return command('recruitVillagers', { quantity: order.recruit });
      }),
    ];
    for (const order of orders) {
      const result = applyCommand(state, order, state.lastProcessedAt);
      if (result.ok) {
        state = result.state;
      }
    }
    return state;
  }

  it('recurso limitado nunca passa do limite; o herdado nunca cresce enquanto está acima', () => {
    const seen = { filled: 0, wasted: 0, inherited: 0 };
    fc.assert(
      fc.property(scenario, fc.boolean(), (plan, clamp) => {
        let state = prepare(plan, clamp);
        const events: GameEvent[] = [];
        const start = state;
        for (const instant of [...plan.cuts].sort((a, b) => a - b)) {
          const before = state;
          const result = advanceTo(state, plan.startMs + instant);
          state = result.state;
          events.push(...result.events);
          for (const id of CAPPED) {
            const cap = storageCapacity(state, id) ?? 0;
            const stock = state.settlement.resources[id];
            const previous = before.settlement.resources[id];
            // Ou cabe, ou já estava acima e não cresceu.
            expect(stock <= cap || stock <= previous, `${id}: ${stock} de ${cap}`).toBe(true);
            if (clamp) {
              expect(stock, id).toBeLessThanOrEqual(cap);
            } else if (previous > cap) {
              seen.inherited += 1;
            }
            expect(stock).toBeGreaterThanOrEqual(0);
            expect(state.settlement.wasted[id]).toBeGreaterThanOrEqual(0);
          }
          // Em repouso: nada mais a processar neste instante.
          expect(nextEventAt(state)).toBeGreaterThan(state.lastProcessedAt);
        }
        // O que a Crônica relatou mais o que falta relatar é o total, sem perder um milésimo.
        expectWasteAccounted(state, events, start);
        // O ouro não tem limite e nunca se perde.
        expect(state.stats.wasted_gold).toBeUndefined();
        seen.filled += eventsOfType(events, 'storageFilled').length;
        seen.wasted += eventsOfType(events, 'storageWasted').length;
      }),
      { numRuns: 300 },
    );
    expect(seen.filled).toBeGreaterThan(50);
    expect(seen.wasted).toBeGreaterThan(200);
    expect(seen.inherited).toBeGreaterThan(20);
  });

  it('a divisão de intervalo é exata com o enchimento no caminho: estado, desperdício e eventos', () => {
    const seen = { filled: 0, wasted: 0 };
    fc.assert(
      fc.property(scenario, fc.boolean(), (plan, clamp) => {
        const start = prepare(plan, clamp);
        const frozen = JSON.stringify(start);
        const instants = [...plan.cuts].sort((a, b) => a - b).map((cut) => plan.startMs + cut);
        const end = instants[instants.length - 1] as number;

        const direct = advanceTo(start, end);
        let stepped = start;
        const events: GameEvent[] = [];
        for (const instant of instants) {
          const result = advanceTo(stepped, instant);
          stepped = result.state;
          events.push(...result.events);
        }
        expect(stepped).toStrictEqual(direct.state);
        expect(events).toStrictEqual(direct.events);
        expect(stepped.stats).toStrictEqual(direct.state.stats);
        expect(stepped.settlement.wasted).toStrictEqual(direct.state.settlement.wasted);
        expect(JSON.stringify(start)).toBe(frozen);

        // Um episódio, uma linha: entre dois "encheu" do mesmo recurso o estoque saiu do limite,
        // então nunca há dois no mesmo instante.
        const filled = eventsOfType(direct.events, 'storageFilled');
        const keys = filled.map((event) => `${event.atMs}:${String(event.data.resource)}`);
        expect(new Set(keys).size).toBe(keys.length);
        // No máximo um relato de desperdício por virada de dia, e só em virada de dia.
        const wasted = eventsOfType(direct.events, 'storageWasted');
        expect(new Set(wasted.map((event) => event.atMs)).size).toBe(wasted.length);
        expect(wasted.every((event) => event.atMs % DAY === 0)).toBe(true);
        seen.filled += filled.length;
        seen.wasted += wasted.length;
      }),
      { numRuns: 400 },
    );
    expect(seen.filled).toBeGreaterThan(80);
    expect(seen.wasted).toBeGreaterThan(300);
  });

  it('vale com o corte em qualquer milissegundo em volta do instante de encher', () => {
    // 3 lenhadores, 120 de madeira: enche em 15 h 50 min; a comida enche a Despensa mais tarde.
    const start = gameAt(SPRING, (draft) => {
      draft.settlement.workers = { farm: 1, lumberMill: 3, quarry: 1, goldMine: 0 };
    });
    const end = 4 * 24 * HOUR;
    const direct = advanceTo(start, end);
    expect(
      eventsOfType(direct.events, 'storageFilled').map((event) => event.data.resource),
    ).toEqual(['wood', 'food', 'stone']);
    const fills = eventsOfType(direct.events, 'storageFilled').map((event) => event.atMs);
    const check = (cut: number) => {
      const half = advanceTo(start, cut);
      const split = advanceTo(half.state, end);
      expect(split.state).toStrictEqual(direct.state);
      expect([...half.events, ...split.events]).toStrictEqual(direct.events);
    };
    fc.assert(
      fc.property(fc.integer({ min: 1, max: end - 1 }), (cut) => {
        check(cut);
      }),
      { numRuns: 300 },
    );
    for (const at of fills) {
      for (const cut of [at - 1, at, at + 1]) {
        check(cut);
      }
    }
  });

  it('nenhum comando cria recurso além do limite nem some com desperdício', () => {
    fc.assert(
      fc.property(scenario, (plan) => {
        const state = prepare(plan, true);
        for (const id of CAPPED) {
          expect(state.settlement.resources[id]).toBeLessThanOrEqual(
            storageCapacity(state, id) ?? 0,
          );
          // Sem evento de dia, tudo o que se perdeu ainda está no contador.
          expect(state.settlement.wasted[id]).toBe(state.stats[`wasted_${id}`] ?? 0);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('alcançabilidade: o custo de cada obra cabe em algum depósito? (roadmap V2C-T2.5)', () => {
  const builders = BUILDING_IDS;

  /** O nível mais alto a que o Armazém chega: cada obra dele precisa caber no limite anterior. */
  function warehouseReach(difficulty: DifficultyId): number {
    let level = 0;
    while (level < buildings.warehouse.maxLevel) {
      const state = gameWith((draft) => {
        draft.settings.difficulty = difficulty;
        draft.settlement.buildings.warehouse = level;
      });
      const cost = upgradeCost('warehouse', level);
      const cap = (storageCapacity(state, 'wood') ?? 0) / 1000;
      if (Math.max(cost.wood ?? 0, cost.stone ?? 0) > cap) {
        break;
      }
      level += 1;
    }
    return level;
  }

  /** O menor nível do Armazém em que a madeira e a pedra de uma obra cabem; `null` se nenhum. */
  function warehouseNeeded(
    difficulty: DifficultyId,
    building: BuildingId,
    fromLevel: number,
  ): number | null {
    const cost = upgradeCost(building, fromLevel);
    const need = Math.max(cost.wood ?? 0, cost.stone ?? 0);
    for (let level = 0; level <= warehouseReach(difficulty); level += 1) {
      const state = gameWith((draft) => {
        draft.settings.difficulty = difficulty;
        draft.settlement.buildings.warehouse = level;
      });
      if (need <= (storageCapacity(state, 'wood') ?? 0) / 1000) {
        return level;
      }
    }
    return null;
  }

  it('nenhuma obra custa comida: o Celeiro nunca trava uma construção', () => {
    for (const building of builders) {
      expect(buildings[building].baseCost.food, building).toBeUndefined();
    }
  });

  it('o caminho até o Salão no nível 4 e os depósitos no nível 2 cabe em toda dificuldade', () => {
    const path: Array<[BuildingId, number]> = [
      ['townHall', 1],
      ['townHall', 2],
      ['townHall', 3],
      ['granary', 0],
      ['granary', 1],
      ['warehouse', 0],
      ['warehouse', 1],
    ];
    const needed = (difficulty: DifficultyId) =>
      path.map(([building, fromLevel]) => warehouseNeeded(difficulty, building, fromLevel));
    // Em Camponês e Senhor, tudo cabe no limite inicial.
    expect(needed('peasant')).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(needed('lord')).toEqual([0, 0, 0, 0, 0, 0, 0]);
    // Em Rei de Ferro o Salão 3→4 (486 de madeira) pede o Armazém no nível 1, que cabe nos 400.
    expect(needed('ironKing')).toEqual([0, 0, 1, 0, 0, 0, 0]);
  });

  it('as obras que nenhum depósito comporta são as conhecidas (docs/balance-v0.2.md, seção 4)', () => {
    // Não é a regra desejada: é o retrato das travas que a auditoria achou, para que mexer em
    // custo ou em capacidade mude esta lista de propósito. Todas ficam além do Salão no nível 7.
    const deadEnds = (difficulty: DifficultyId) =>
      builders.flatMap((building) => {
        const { initialLevel, maxLevel } = buildings[building];
        const levels = Array.from({ length: maxLevel - initialLevel }, (_, i) => initialLevel + i);
        return levels
          .filter((fromLevel) => warehouseNeeded(difficulty, building, fromLevel) === null)
          .map((fromLevel) => `${building} ${fromLevel}→${fromLevel + 1}`);
      });
    expect(warehouseReach('peasant')).toBe(8);
    expect(deadEnds('peasant')).toEqual([]);
    expect(warehouseReach('lord')).toBe(8);
    expect(deadEnds('lord')).toEqual(['townHall 7→8', 'quarry 9→10', 'goldMine 9→10']);
    // O Armazém de Rei de Ferro para no nível 7: o nível 8 custa 4.295 e ele guarda 3.600.
    expect(warehouseReach('ironKing')).toBe(7);
    expect(deadEnds('ironKing')).toEqual([
      'townHall 7→8',
      'lumberMill 9→10',
      'quarry 9→10',
      'goldMine 9→10',
      'granary 7→8',
      'warehouse 7→8',
    ]);
  });

  /**
   * O nível mais alto a que cada edifício chega em uma dificuldade, pelas regras do próprio
   * motor: a partir do feudo novo, com os depósitos sempre cheios e ouro de sobra, inicia toda
   * obra que `upgradeQuote` deixa começar, até nenhuma mais poder. É o caminho de compras mais
   * favorável que existe: o que ele não alcança, ninguém alcança.
   */
  function ceilings(difficulty: DifficultyId): Record<BuildingId, number> {
    const levels = { ...newGame().settlement.buildings };
    for (let changed = true; changed;) {
      changed = false;
      for (const building of builders) {
        const state = gameWith((draft) => {
          draft.settings.difficulty = difficulty;
          draft.settlement.buildings = { ...levels };
        });
        for (const resource of RESOURCE_IDS) {
          state.settlement.resources[resource] =
            storageCapacity(state, resource) ?? Number.MAX_SAFE_INTEGER;
        }
        if (upgradeQuote(state, building).blocked === null) {
          levels[building] += 1;
          changed = true;
        }
      }
    }
    return levels;
  }

  /** Os níveis que o catálogo anuncia e a dificuldade não alcança: "Salão 8", "Fazenda 9–10". */
  function unreachable(difficulty: DifficultyId): string[] {
    const reached = ceilings(difficulty);
    return builders.flatMap((building) => {
      const { maxLevel } = buildings[building];
      const from = reached[building] + 1;
      if (from > maxLevel) {
        return [];
      }
      return [`${building} ${from === maxLevel ? from : `${from}–${maxLevel}`}`];
    });
  }

  it('os desbloqueios da Fase C são alcançáveis em toda dificuldade (roadmap V2C-T7.3)', () => {
    // O Celeiro e o Armazém (Salão no nível 2), a segunda fila de obras (Salão no nível 4) e os
    // depósitos no nível máximo que a dificuldade comporta.
    for (const difficulty of DIFFICULTY_IDS) {
      const reached = ceilings(difficulty);
      expect(reached.townHall, difficulty).toBeGreaterThanOrEqual(
        balance.construction.secondQueueTownHallLevel,
      );
      expect(reached.granary, difficulty).toBeGreaterThanOrEqual(1);
      expect(reached.warehouse, difficulty).toBeGreaterThanOrEqual(1);
    }
  });

  it('o teto de cada edifício em cada dificuldade, e o que o catálogo anuncia além dele', () => {
    // Também não é a regra desejada: é o retrato que vai ao autor (docs/balance-v0.2.md, seção
    // 9.5). Só em Camponês o catálogo inteiro é alcançável. Em Senhor o Salão para no nível 7
    // por 2 de madeira (a obra do nível 8 pede 5.102 e o Armazém no máximo guarda 5.100), e com
    // ele param no nível 8 os cinco edifícios presos à regra "nível do Salão mais um".
    expect(ceilings('peasant')).toEqual({
      townHall: 8,
      farm: 9,
      lumberMill: 9,
      quarry: 9,
      goldMine: 9,
      housing: 9,
      granary: 8,
      warehouse: 8,
    });
    expect(unreachable('peasant')).toEqual([
      'farm 10',
      'lumberMill 10',
      'quarry 10',
      'goldMine 10',
      'housing 10',
    ]);
    const stuckAtSeven = {
      townHall: 7,
      farm: 8,
      lumberMill: 8,
      quarry: 8,
      goldMine: 8,
      housing: 8,
    };
    expect(ceilings('lord')).toEqual({ ...stuckAtSeven, granary: 8, warehouse: 8 });
    expect(ceilings('ironKing')).toEqual({ ...stuckAtSeven, granary: 7, warehouse: 7 });
    const beyondSeven = [
      'townHall 8',
      'farm 9–10',
      'lumberMill 9–10',
      'quarry 9–10',
      'goldMine 9–10',
      'housing 9–10',
    ];
    expect(unreachable('lord')).toEqual(beyondSeven);
    expect(unreachable('ironKing')).toEqual([...beyondSeven, 'granary 8', 'warehouse 8']);
  });
});

describe('o instante de encher e as outras regras', () => {
  it('o cenário dos objetivos não enche nada: o começo do jogo cabe nos 500', () => {
    const state = play(newGame(), [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('startConstruction', { building: 'housing' }),
      command('recruitVillagers', { quantity: 3 }),
      { at: HOUR },
    ]).state;
    expect(fullStores(state)).toEqual([]);
    expect(Object.keys(state.stats).filter((key) => key.startsWith('wasted_'))).toEqual([]);
    expect(balance.storage.baseCapacity).toBe(500);
  });
});
