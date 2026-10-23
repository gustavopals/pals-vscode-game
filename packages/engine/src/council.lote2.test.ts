import { type DifficultyId, objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { CATALOG, eligibleCards, scriptedCard } from './council';
import { createInitialState } from './state';
import {
  accept,
  command,
  DAY,
  dealt,
  eventsOfType,
  quietCouncil,
  quietHorde,
  settings,
  SUMMER,
  WINTER,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

/**
 * O lote 2 e o lote 3 do Conselho que o estado 31 comporta (roadmap da v0.4, V4H-T1): a cadeia
 * "Os Refugiados" (o efeito `addMaster`), "O mapa rasgado" (`revealDestination`), "O primeiro
 * recruta" (`addSoldiers` e o gatilho `onHallLevel`) e "O capitão veterano" (herói a preço).
 * O sorteio fica calado: as cartas são postas na mesa pelo teste.
 */

function feud(difficulty: DifficultyId = 'lord', atMs = SUMMER): GameState {
  const state = createInitialState('lote2', { ...settings, difficulty, timeScale: 1 });
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  state.settlement.buildings.granary = 3;
  state.settlement.buildings.warehouse = 3;
  state.settlement.resources = {
    food: 400_000,
    wood: 300_000,
    stone: 100_000,
    gold: 100_000,
    iron: 0,
  };
  state.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  quietCouncil(state);
  quietHorde(state);
  return state;
}

function choose(state: GameState, cardId: string, optionId: string) {
  const pending = state.council.pending.find((entry) => entry.cardId === cardId);
  if (pending === undefined) {
    throw new Error(`A carta ${cardId} não está na mesa.`);
  }
  return accept(state, command('answerCard', { instanceId: pending.instanceId, optionId }));
}

const masterIds = (state: GameState) => state.settlement.masters.map((entry) => entry.masterId);
const waitingIds = (state: GameState) =>
  state.settlement.mastersWaiting.map((entry) => entry.masterId);

describe('"Os Refugiados", de ponta a ponta', () => {
  it('abrigar e acolher traz Gil uma vez só, e a bancada da terceira carta já o encontra em casa', () => {
    const sheltered = choose(dealt(feud(), 'refugeesAtGates').state, 'refugeesAtGates', 'shelter');
    expect(sheltered.events[0]?.data).toMatchObject({ spent_food: 60, morale: 5, moraleDays: 2 });
    expect(masterIds(sheltered.state)).toEqual([]);

    const back = advanceTo(sheltered.state, SUMMER + 3 * DAY);
    expect(eventsOfType(back.events, 'cardDrawn')[0]?.data).toMatchObject({
      cardId: 'refugeesReturn',
      source: 'continuation',
    });
    const welcomed = choose(back.state, 'refugeesReturn', 'welcome');
    expect(welcomed.events[0]?.data).toMatchObject({ master: 'gil', spent_food: 40 });
    expect(masterIds(welcomed.state)).toEqual(['gil']);
    // A linha da escolha vem antes da linha da chegada do Mestre.
    expect(welcomed.events.map((event) => event.type).slice(0, 2)).toEqual([
      'cardAnswered',
      'masterArrived',
    ]);

    const craft = advanceTo(welcomed.state, SUMMER + 5 * DAY);
    const built = choose(craft.state, 'refugeesCraft', 'workshop');
    expect(masterIds(built.state)).toEqual(['gil']);
    expect(built.events[0]?.data).not.toHaveProperty('master');
    for (const flag of ['open', 'sheltered', 'provisioned', 'welcomed', 'passing']) {
      expect(built.state.council.flags[`refugees.${flag}`]).toBeUndefined();
    }
    expect(built.state.council.flags['refugees.settled']).toBe(true);
  });

  it('dar provisões e emprestar o celeiro só traz Ximena quando a bancada sai', () => {
    const provided = choose(dealt(feud(), 'refugeesAtGates').state, 'refugeesAtGates', 'provide');
    const back = advanceTo(provided.state, SUMMER + 4 * DAY);
    const view = deriveViewState(back.state, back.state.lastProcessedAt, { timeScale: 1 });
    expect(view.council.pending[0]?.text).toContain('Ximena');
    const lodged = choose(back.state, 'refugeesReturn', 'lodge');
    expect(masterIds(lodged.state)).toEqual([]);
    const craft = advanceTo(lodged.state, SUMMER + 6 * DAY);
    const options = deriveViewState(craft.state, craft.state.lastProcessedAt, { timeScale: 1 })
      .council.pending[0]?.options;
    expect(options?.[0]?.effectsText).toContain('Mestra Ximena');
    const built = choose(craft.state, 'refugeesCraft', 'workshop');
    expect(built.events[0]?.data).toMatchObject({ master: 'ximena', spent_wood: 50 });
    expect(masterIds(built.state)).toEqual(['ximena']);
  });

  it('agradecer depois de emprestar o celeiro não traz ninguém e fecha a cadeia sem o selo', () => {
    let state = choose(dealt(feud(), 'refugeesAtGates').state, 'refugeesAtGates', 'shelter').state;
    state = advanceTo(state, SUMMER + 3 * DAY).state;
    state = choose(state, 'refugeesReturn', 'lodge').state;
    state = advanceTo(state, SUMMER + 5 * DAY).state;
    const thanked = choose(state, 'refugeesCraft', 'thank');
    expect(masterIds(thanked.state)).toEqual([]);
    expect(waitingIds(thanked.state)).toEqual([]);
    expect(thanked.state.council.flags['refugees.open']).toBeUndefined();
    expect(thanked.state.council.flags['refugees.settled']).toBeUndefined();
  });

  it('mandar seguir viagem deixa a lenha, fecha a cadeia e nenhum Mestre chega', () => {
    let state = choose(dealt(feud(), 'refugeesAtGates').state, 'refugeesAtGates', 'provide').state;
    state = advanceTo(state, SUMMER + 4 * DAY).state;
    const wood = state.settlement.resources.wood;
    const sent = choose(state, 'refugeesReturn', 'dismiss');
    expect(sent.state.settlement.resources.wood).toBe(wood + 30_000);
    expect(masterIds(sent.state)).toEqual([]);
    expect(sent.state.council.flags['refugees.open']).toBeUndefined();
    expect(sent.state.council.scheduled).toEqual([]);
  });

  it('sem resposta, a segunda carta empresta o celeiro (Senhor) ou manda seguir viagem (Rei de Ferro)', () => {
    for (const difficulty of ['lord', 'ironKing'] as const) {
      let state = feud(difficulty);
      state = choose(dealt(state, 'refugeesAtGates').state, 'refugeesAtGates', 'shelter').state;
      // A segunda carta chega em 3 dias e expira 12 dias de jogo depois (24 h reais no ritmo 1).
      state = advanceTo(state, SUMMER + 3 * DAY + 12 * DAY).state;
      expect(state.council.pending).toEqual([]);
      if (difficulty === 'lord') {
        expect(state.council.flags['refugees.passing']).toBe(true);
        expect(state.council.scheduled.map((entry) => entry.cardId)).toEqual(['refugeesCraft']);
      } else {
        expect(state.council.flags['refugees.open']).toBeUndefined();
        expect(state.council.scheduled).toEqual([]);
      }
      expect(masterIds(state)).toEqual([]);
    }
  });

  it('a primeira carta só entra no sorteio do 20º dia em diante, fora do inverno, e nunca com a cadeia aberta', () => {
    const ids = (state: GameState, atMs: number) =>
      eligibleCards(state, atMs, CATALOG, []).map((card) => card.id);
    const base = feud('lord', 0);
    expect(ids(base, 18 * DAY)).not.toContain('refugeesAtGates');
    expect(ids(base, 19 * DAY)).toContain('refugeesAtGates');
    expect(ids(base, WINTER)).not.toContain('refugeesAtGates');
    for (const flag of ['refugees.open', 'refugees.settled', 'routine.moreMouths']) {
      const marked = feud('lord', 0);
      marked.council.flags[flag] = true;
      expect(ids(marked, SUMMER), flag).not.toContain('refugeesAtGates');
    }
  });

  it('abrigar pede 150 de comida em estoque, e fechar os portões não custa nada', () => {
    const poor = feud();
    poor.settlement.resources.food = 100_000;
    const pending = dealt(poor, 'refugeesAtGates');
    const view = deriveViewState(pending.state, pending.state.lastProcessedAt, { timeScale: 1 });
    expect(view.council.pending[0]?.options[0]?.locked).toBeTruthy();
  });
});

describe('Mestre de carta sem vaga', () => {
  it('com as casas cheias, o Mestre espera à porta em vez de se perder', () => {
    const state = feud();
    state.settlement.population.villagers = 999;
    const sheltered = choose(dealt(state, 'refugeesAtGates').state, 'refugeesAtGates', 'shelter');
    const back = advanceTo(sheltered.state, SUMMER + 3 * DAY);
    back.state.settlement.resources.food = 400_000;
    const welcomed = choose(back.state, 'refugeesReturn', 'welcome');
    expect(masterIds(welcomed.state).length + waitingIds(welcomed.state).length).toBe(1);
  });
});

describe('"O mapa rasgado"', () => {
  it('comprar revela o próximo destino oculto, só uma vez; recusar não revela nada', () => {
    const state = feud();
    state.settlement.buildings.guild = 1;
    const before = [...state.map.discovered];
    const bought = choose(dealt(state, 'tornMap').state, 'tornMap', 'buy');
    expect(bought.events[0]?.data).toMatchObject({ spent_gold: 70 });
    expect(bought.state.map.discovered).toHaveLength(before.length + 1);
    expect(bought.events[0]?.data.revealed).toBe(bought.state.map.discovered.at(-1));
    // Pagar em provisões é o mesmo efeito, a outro preço.
    const bartered = choose(dealt(state, 'tornMap').state, 'tornMap', 'barter');
    expect(bartered.events[0]?.data).toMatchObject({ spent_food: 40, spent_wood: 20 });
    expect(bartered.state.map.discovered).toEqual(bought.state.map.discovered);
    const refused = choose(dealt(state, 'tornMap').state, 'tornMap', 'refuse');
    expect(refused.state.map.discovered).toEqual(before);
  });

  it('só é sorteada com a Guilda e com algum destino ainda oculto', () => {
    const ids = (state: GameState) =>
      eligibleCards(state, SUMMER, CATALOG, []).map((card) => card.id);
    const state = feud();
    expect(ids(state)).not.toContain('tornMap');
    state.settlement.buildings.guild = 1;
    expect(ids(state)).toContain('tornMap');
    // Todos os destinos de descoberta já conhecidos: a carta não tem o que revelar.
    for (let step = 0; step < 10; step += 1) {
      const out = choose(dealt(state, 'tornMap').state, 'tornMap', 'buy');
      state.map.discovered = out.state.map.discovered;
    }
    expect(ids(state)).not.toContain('tornMap');
  });
});

describe('"O primeiro recruta" e "O capitão veterano"', () => {
  it('treinar pede o Quartel e a vaga; com ambos, um Lanceiro entra e sai dos aldeões', () => {
    const state = feud();
    state.settlement.buildings.barracks = 1;
    const villagers = state.settlement.population.villagers;
    const trained = choose(dealt(state, 'firstRecruit').state, 'firstRecruit', 'train');
    expect(trained.state.army.units.spearman).toBe(1);
    expect(trained.state.settlement.population.villagers).toBe(villagers - 1);
    expect(trained.events[0]?.data).toMatchObject({ soldiers: 'spearman:1' });
    // Sem o Quartel, a opção aparece trancada.
    const pending = dealt(feud(), 'firstRecruit');
    const view = deriveViewState(pending.state, pending.state.lastProcessedAt, { timeScale: 1 });
    expect(view.council.pending[0]?.options[0]?.locked).toBeTruthy();
  });

  it('o capitão veterano custa 240, chega como Osbert e a flag impede pagar duas vezes', () => {
    const state = feud();
    state.settlement.buildings.tavern = 2;
    state.settlement.resources.gold = 500_000;
    const hired = choose(dealt(state, 'veteranCaptain').state, 'veteranCaptain', 'hire');
    expect(hired.events[0]?.data).toMatchObject({ spent_gold: 240, hero: 'osbert' });
    expect(hired.state.guild.heroes.map((hero) => hero.name)).toContain('Osbert');
    expect(hired.state.council.flags['veteranCaptain.hired']).toBe(true);
    expect(eligibleCards(hired.state, SUMMER, CATALOG, []).map((card) => card.id)).not.toContain(
      'veteranCaptain',
    );
  });
});

describe('Roteirizadas do lote 2', () => {
  it('"O mercador itinerante" sai no 20º dia de jogo, na frente das sorteadas', () => {
    const state = feud('lord', 0);
    state.stats['cardsDrawn:woundedStranger'] = 1;
    expect(scriptedCard(state, 19 * DAY - 1, CATALOG)).toBeNull();
    expect(scriptedCard(state, 19 * DAY, CATALOG)?.id).toBe('itinerantMerchant');
  });

  it('"O primeiro recruta" sai quando o Salão chega ao nível 4, e só uma vez', () => {
    const state = feud('lord', 0);
    state.stats['cardsDrawn:woundedStranger'] = 1;
    state.stats['cardsDrawn:itinerantMerchant'] = 1;
    state.settlement.buildings.townHall = 3;
    expect(scriptedCard(state, 5 * DAY, CATALOG)).toBeNull();
    state.settlement.buildings.townHall = 4;
    expect(scriptedCard(state, 5 * DAY, CATALOG)?.id).toBe('firstRecruit');
    state.stats['cardsDrawn:firstRecruit'] = 1;
    expect(scriptedCard(state, 5 * DAY, CATALOG)).toBeNull();
  });

  it('vender madeira ao mercador itinerante troca 100 de madeira por 50 de ouro', () => {
    const state = feud('lord', 0);
    const gold = state.settlement.resources.gold;
    const out = choose(dealt(state, 'itinerantMerchant').state, 'itinerantMerchant', 'sellWood');
    expect(out.state.settlement.resources.gold).toBe(gold + 50_000);
    expect(out.state.settlement.resources.wood).toBe(state.settlement.resources.wood - 100_000);
  });
});
