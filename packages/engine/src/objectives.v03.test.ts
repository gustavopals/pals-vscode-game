import { balance, items, objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { evaluateObjectives, hasUnsettledObjectives, objectiveProgress } from './objectives';
import { cloneState } from './state';
import {
  accept,
  addHero,
  command,
  DAY,
  eventsOfType,
  giveItem,
  HOUR,
  newGame,
  send,
  tavernScenario,
  tavernSite,
  throughCrossroads,
  tradeOrder,
} from './test-helpers';
import type { GameEvent, GameState } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

const ids = objectives.map((objective) => objective.id);
const v02 = ids.slice(0, 10);
const v03 = ids.slice(10);

const completedIn = (events: GameEvent[]) =>
  eventsOfType(events, 'objectiveCompleted').map((event) => event.data.objective);

const viewOf = (state: GameState, id: string) => {
  const found = deriveViewState(state, state.lastProcessedAt).objectives.find(
    (objective) => objective.id === id,
  );
  if (found === undefined) {
    throw new Error(`A visão não mostra o objetivo ${id}.`);
  }
  return found;
};

/** Os dez da v0.2 cumpridos e nenhum ativo: o ponto em que os da v0.3 começam a ser revelados. */
const afterV02 = (draft: GameState) => {
  draft.objectives = { completed: [...v02], active: [] };
  draft.map.discovered = ['ruins'];
};

describe('objetivos da v0.3 (V3F-T2)', () => {
  it('o cenário roteirizado conclui os seis, na ordem, em uma partida nova', () => {
    const events: GameEvent[] = [];
    const take = (step: { state: GameState; events: GameEvent[] }) => {
      events.push(...step.events);
      return step.state;
    };
    // 11: a Taverna abre, e o primeiro herói é contratado.
    const opened = tavernScenario(0, afterV02);
    events.push(...opened.events);
    let state = opened.state;
    const offer = state.guild.tavernOffers[0];
    if (offer === undefined) {
      throw new Error('A Taverna abriu sem candidatos.');
    }
    state = take(accept(state, command('hireHero', { offerId: offer.offerId })));
    expect(completedIn(events)).toEqual(['welcomeFirstHero']);
    expect(viewOf(state, 'welcomeFirstHero').status).toBe('completed');
    expect(state.guild.inventory.map((item) => item.defId)).toEqual(['huntingSpear']);
    // 12: a Guilda.
    state = take(accept(state, command('startConstruction', { building: 'guild' })));
    state = take(advanceTo(state, state.settlement.constructionQueues[0]?.finishesAtMs ?? 0));
    expect(completedIn(events)).toEqual(['welcomeFirstHero', 'buildGuild']);
    // 13: a Patrulha, com +50 de ouro no ato da ordem.
    const goldBefore = state.settlement.resources.gold;
    const patrol = send(state, 'patrol', ['hero-1']);
    events.push(...patrol.events);
    state = patrol.state;
    expect(completedIn(events).at(-1)).toBe('sendPatrol');
    expect(state.settlement.resources.gold - goldBefore).toBe(50 * MILLI);
    state = take(advanceTo(state, state.lastProcessedAt + 2 * HOUR));
    // 14: o Mercado e a primeira venda.
    state = take(accept(state, command('startConstruction', { building: 'market' })));
    state = take(advanceTo(state, state.settlement.constructionQueues[0]?.finishesAtMs ?? 0));
    expect(viewOf(state, 'sellSurplus').target).toEqual({ kind: 'market' });
    const woodBefore = state.settlement.resources.wood;
    state = take(accept(state, tradeOrder(state, 'wood', 'sell', 10)));
    expect(completedIn(events).at(-1)).toBe('sellSurplus');
    expect(state.settlement.resources.wood).toBe(woodBefore - 10 * MILLI + 40 * MILLI);
    // 15: a escolha do jogador em uma encruzilhada (a da Postura não conta).
    const forest = send(state, 'oldForest', ['hero-1'], 'cautious', 0);
    events.push(...forest.events);
    expect(objectiveProgress(forest.state, { type: 'crossroadsChosen', count: 1 }).current).toBe(0);
    const chosen = throughCrossroads(forest.state);
    events.push(...chosen.events);
    state = chosen.state;
    expect(completedIn(events).at(-1)).toBe('chooseAtCrossroads');
    expect(state.settlement.moraleEffects.map((effect) => effect.id)).toContain(
      'objective:chooseAtCrossroads',
    );
    state = take(advanceTo(state, state.lastProcessedAt + DAY));
    expect(state.guild.expeditions).toEqual([]);
    // 16: as Ruínas, com dois heróis de nível 4 que o cenário põe no feudo.
    state = cloneState(state);
    addHero(state, { name: 'Brann', level: 4 });
    addHero(state, { name: 'Isolda', level: 4, classId: 'mage' });
    const ruins = send(state, 'ruins', ['hero-2', 'hero-3'], 'cautious', 0);
    events.push(...ruins.events);
    const middle = throughCrossroads(ruins.state);
    events.push(...middle.events);
    state = take(advanceTo(middle.state, middle.state.lastProcessedAt + 3 * DAY));
    expect(state.stats['expeditionsReturned:ruins']).toBe(1);
    expect(completedIn(events)).toEqual(v03);
    expect(state.objectives.completed).toEqual(ids);
    expect(state.objectives.active).toEqual([]);
    expect(state.guild.inventory.some((item) => item.defId === 'ashBow')).toBe(true);
  });

  it('partida migrada: o que já foi feito conta ao ser revelado, na ordem, e paga uma vez', () => {
    const start = tavernSite(0, (draft) => {
      afterV02(draft);
      addHero(draft, { name: 'Edda' });
      draft.settlement.buildings.guild = 1;
      draft.settlement.buildings.market = 1;
      Object.assign(draft.stats, {
        'expeditionsSent:patrol': 1,
        sold_wood: 5,
        crossroadsChosen: 1,
        'expeditionsReturned:ruins': 1,
      });
    });
    expect(hasUnsettledObjectives(start)).toBe(true);
    const gold = start.settlement.resources.gold;
    const { state, events } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(events)).toEqual(v03);
    expect(state.objectives).toEqual({ active: [], completed: ids });
    expect(hasUnsettledObjectives(state)).toBe(false);
    expect(state.settlement.resources.gold - gold).toBe(50 * MILLI);
    expect(state.guild.inventory.map((item) => item.defId)).toEqual(['huntingSpear', 'ashBow']);
    expect(state.settlement.moraleEffects.map((effect) => effect.id)).toEqual([
      'objective:chooseAtCrossroads',
    ]);
    // Reavaliar não paga de novo.
    const again = cloneState(state);
    const extra: GameEvent[] = [];
    expect(evaluateObjectives(again, again.lastProcessedAt, extra)).toBe(false);
    expect(extra).toEqual([]);
    expect(again).toStrictEqual(state);
  });

  it('nunca mais de três ativos, e só os próximos da sequência', () => {
    for (let done = 10; done <= ids.length; done += 1) {
      const start = cloneState(newGame());
      start.objectives = { completed: ids.slice(0, done), active: [] };
      const { state } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
      expect(state.objectives.active.length).toBeLessThanOrEqual(balance.objectives.maxActive);
      expect(state.objectives.active).toEqual(ids.slice(done, done + 3));
    }
  });

  it('o prêmio em item com o arsenal cheio vira ouro pelo valor do item', () => {
    const start = cloneState(newGame());
    start.objectives = { completed: [...v02], active: [] };
    addHero(start, { name: 'Edda' });
    for (let count = 0; count < balance.equipment.inventoryCap; count += 1) {
      giveItem(start, 'luckyCharm');
    }
    const gold = start.settlement.resources.gold;
    const { state, events } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
    expect(completedIn(events)).toEqual(['welcomeFirstHero']);
    expect(state.guild.inventory).toHaveLength(balance.equipment.inventoryCap);
    expect(state.guild.inventory.some((item) => item.defId === 'huntingSpear')).toBe(false);
    expect(eventsOfType(events, 'itemSold')).toHaveLength(1);
    expect(state.stats.itemsSold).toBe(1);
    expect(state.settlement.resources.gold - gold).toBe(items.huntingSpear.value * MILLI);
  });

  it('a visão diz o que falta e onde se cumpre', () => {
    const start = cloneState(newGame());
    start.objectives = { completed: [...v02], active: [] };
    const { state } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
    expect(viewOf(state, 'welcomeFirstHero')).toMatchObject({
      status: 'active',
      reward: 'um item (Lança de caça)',
      target: { kind: 'tavern' },
    });
    expect(viewOf(state, 'welcomeFirstHero').missing).toMatch(/Taverna/);
    expect(viewOf(state, 'buildGuild').target).toEqual({ kind: 'building', building: 'guild' });
    expect(viewOf(state, 'sendPatrol')).toMatchObject({
      reward: '+50 ouro',
      target: { kind: 'expeditions' },
    });
    expect(viewOf(state, 'sendPatrol').missing).not.toBeNull();
  });

  it('estado de risco: as Ruínas pedem uma equipe que o feudo não tem, e o objetivo diz o que falta', () => {
    // As Ruínas pedem de 2 a 3 heróis de nível 2 ou mais. Com a Guilda de pé, o destino
    // revelado e um herói de nível 1 livre, a ordem de envio seria recusada: o objetivo não
    // pode dizer que só falta a ordem (`missing: null`), e diz o mesmo que o envio na visão.
    const start = cloneState(newGame());
    start.objectives = { completed: [...v02, ...v03.slice(0, 5)], active: [] };
    start.map.discovered = ['ruins'];
    start.settlement.buildings.guild = 1;
    addHero(start, { level: 1 });
    const { state } = accept(start, command('renameSettlement', { name: 'Vau Alto' }));
    const ruins = deriveViewState(state, state.lastProcessedAt).guild.available.find(
      (offer) => offer.modelId === 'ruins',
    );
    expect(ruins?.canSend).toBe(false);
    expect(viewOf(state, 'exploreRuins').status).toBe('active');
    expect(viewOf(state, 'exploreRuins').missing).toBe(ruins?.sendBlockedReason);
    // Com a equipe que serve, só falta a ordem.
    const ready = cloneState(state);
    addHero(ready, { level: 2 });
    ready.guild.heroes[0]!.level = 2;
    expect(viewOf(ready, 'exploreRuins').missing).toBeNull();
  });
});
