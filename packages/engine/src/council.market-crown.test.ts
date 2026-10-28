import { councilCards, type DifficultyId, objectives } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { eligibleCards } from './council';
import { quote } from './market';
import { migrateState } from './migrations';
import { cloneState } from './state';
import {
  accept,
  addHero,
  AUTUMN,
  command,
  DAY,
  dealt,
  quietCouncil,
  quietHorde,
  settings,
  SUMMER,
  YEAR,
} from './test-helpers';
import { createInitialState } from './state';
import type { GameState } from './types';
import { deriveViewState } from './view';

function feud(difficulty: DifficultyId = 'lord', atMs = SUMMER + DAY / 3): GameState {
  const state = createInitialState('market-crown', { ...settings, difficulty, timeScale: 1 });
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  state.settlement.buildings = {
    ...state.settlement.buildings,
    townHall: 3,
    market: 1,
    guild: 2,
    granary: 3,
    warehouse: 3,
  };
  state.settlement.workers.farm = 3;
  state.settlement.resources = {
    food: 400_000,
    wood: 300_000,
    stone: 100_000,
    gold: 500_000,
    iron: 0,
  };
  state.objectives = { active: [], completed: objectives.map((entry) => entry.id) };
  quietCouncil(state);
  quietHorde(state);
  return state;
}
function choose(state: GameState, cardId: string, optionId: string) {
  const pending = state.council.pending.find((entry) => entry.cardId === cardId)!;
  return accept(state, command('answerCard', { instanceId: pending.instanceId, optionId }));
}
function expires(state: GameState, cardId: string) {
  return advanceTo(
    state,
    state.council.pending.find((entry) => entry.cardId === cardId)!.expiresAtMs,
  );
}
function continueTo(state: GameState, cardId: string) {
  return advanceTo(
    migrateState(JSON.parse(JSON.stringify(state)), { timeScale: 1 }),
    state.council.scheduled.find((entry) => entry.cardId === cardId)!.atMs,
  );
}

describe('O Mercador Misterioso, de ponta a ponta', () => {
  it.each(['follow', 'sell'] as const)(
    'comprar → %s → último mapa revela Ruínas e Mina sem mexer em outro destino',
    (middle) => {
      const bought = choose(dealt(feud(), 'mysteriousMerchant').state, 'mysteriousMerchant', 'buy');
      expect(bought.state.map.discovered).toEqual(['ruins']);
      expect(bought.state.settlement.resources.gold).toBe(420_000);
      expect(bought.state.council.scheduled[0]?.atMs).toBe(bought.state.lastProcessedAt + 4 * DAY);
      const lead = continueTo(bought.state, 'merchantLead');
      expect(
        deriveViewState(lead.state, lead.state.lastProcessedAt).council.pending[0]?.text,
      ).toContain('marca a carvão');
      const pursued = choose(lead.state, 'merchantLead', middle);
      expect(pursued.state.council.flags['merchant.map']).toBeUndefined();
      const final = continueTo(pursued.state, 'merchantFinalOffer');
      expect(
        deriveViewState(final.state, final.state.lastProcessedAt).council.pending[0]?.text,
      ).toContain(middle === 'follow' ? 'depósito de caravana' : 'comprador da pista');
      const mapped = choose(final.state, 'merchantFinalOffer', 'destination');
      expect(mapped.state.map.discovered).toEqual(['ruins', 'abandonedMine']);
      expect(mapped.state.council.scheduled).toEqual([]);
      expect(mapped.state.council.flags['merchant.lead']).toBeUndefined();
      expect(mapped.state.council.flags['merchant.sold']).toBeUndefined();
    },
  );

  it('prender → seguir → paz preserva a variante hostil e apaga a causa do Boicote', () => {
    const jailed = choose(
      dealt(feud(), 'mysteriousMerchant').state,
      'mysteriousMerchant',
      'imprison',
    );
    expect(jailed.state.settlement.resources.gold).toBe(550_000);
    expect(jailed.state.market.effects).toHaveLength(4);
    expect(jailed.state.council.scheduled[0]?.atMs).toBe(jailed.state.lastProcessedAt + 3 * DAY);
    const lead = continueTo(jailed.state, 'merchantLead');
    expect(
      deriveViewState(lead.state, lead.state.lastProcessedAt).council.pending[0]?.text,
    ).toContain('escapou na calada');
    const final = continueTo(
      choose(lead.state, 'merchantLead', 'follow').state,
      'merchantFinalOffer',
    );
    const view = deriveViewState(final.state, final.state.lastProcessedAt);
    expect(view.council.pending[0]?.options.map((entry) => entry.id)).toContain('peace');
    const peaceful = choose(final.state, 'merchantFinalOffer', 'peace');
    expect(peaceful.state.council.flags['merchant.hostile']).toBeUndefined();
    expect(
      eligibleCards(peaceful.state, AUTUMN, councilCards).map((entry) => entry.id),
    ).not.toContain('merchantBoycott');
  });

  it.each(['buy', 'imprison'] as const)(
    '%s → largar fecha o ramo e só conserva a hostilidade quando houve prisão',
    (first) => {
      const lead = continueTo(
        choose(dealt(feud(), 'mysteriousMerchant').state, 'mysteriousMerchant', first).state,
        'merchantLead',
      );
      const dropped = choose(lead.state, 'merchantLead', 'drop');
      expect(dropped.state.council.scheduled).toEqual([]);
      expect(dropped.state.council.flags['merchant.map']).toBeUndefined();
      expect(dropped.state.council.flags['merchant.hostile'] === true).toBe(first === 'imprison');
      const nextYear = advanceTo(dropped.state, YEAR).state;
      expect(nextYear.council.flags['merchant.hostile'] === true).toBe(first === 'imprison');
    },
  );

  it.each(['peasant', 'lord', 'ironKing'] as const)(
    'expira em %s e termina a cadeia sem perder a continuação',
    (difficulty) => {
      let state = expires(
        dealt(feud(difficulty), 'mysteriousMerchant').state,
        'mysteriousMerchant',
      ).state;
      if (difficulty === 'ironKing') {
        state = expires(continueTo(state, 'merchantLead').state, 'merchantLead').state;
        const final = expires(continueTo(state, 'merchantFinalOffer').state, 'merchantFinalOffer');
        expect(final.events.find((entry) => entry.type === 'cardExpired')?.data.optionId).toBe(
          'profit',
        );
        state = final.state;
        expect(state.council.flags['merchant.hostile']).toBe(true);
      }
      expect(state.council.scheduled).toEqual([]);
      expect(state.council.pending).toEqual([]);
      expect(state.council.flags['merchant.map']).toBeUndefined();
      expect(state.council.flags['merchant.lead']).toBeUndefined();
      expect(state.council.flags['merchant.sold']).toBeUndefined();
    },
  );
});

describe('O Cobrador do Rei, de ponta a ponta', () => {
  it('pagar ou negociar lê o ouro da escolha; o Carismático livre fica nomeado na Crônica', () => {
    const start = feud('lord', 0);
    addHero(start, { name: 'Ada', traits: ['charismatic'] });
    const pending = dealt(start, 'kingsTax').state;
    const paid = choose(pending, 'kingsTax', 'pay');
    const negotiated = choose(pending, 'kingsTax', 'negotiate');
    expect(paid.state.settlement.resources.gold).toBe(425_000);
    expect(negotiated.state.settlement.resources.gold).toBe(465_000);
    expect(negotiated.events[0]?.text).toContain('Ada falou ao arauto');
    expect(negotiated.events[0]?.data).toMatchObject({
      heroId: 'hero-1',
      heroName: 'Ada',
      spent_gold: 35,
    });
    expect(negotiated.state.council.scheduled).toEqual([]);
  });

  it.each(['tribute', 'envoy', 'hold'] as const)(
    'recusar → soldados → %s: a fileira abre o acordo e toda saída apaga as flags',
    (last) => {
      const start = feud();
      start.settlement.buildings.barracks = 1;
      start.army.units.spearman = 6;
      start.army.units.archer = 4;
      const refused = choose(dealt(start, 'kingsTax').state, 'kingsTax', 'refuse');
      expect(refused.state.council.scheduled[0]?.atMs).toBe(
        refused.state.lastProcessedAt + 2 * DAY,
      );
      const collector = continueTo(refused.state, 'kingsCollector');
      const defied = choose(collector.state, 'kingsCollector', 'soldiers');
      expect(defied.state.council.flags['tax.refused']).toBeUndefined();
      expect(defied.state.council.flags['tax.defied']).toBe(true);
      expect(defied.state.council.scheduled[0]?.atMs).toBe(defied.state.lastProcessedAt + 4 * DAY);
      const answer = continueTo(defied.state, 'kingsAnswer');
      expect(
        deriveViewState(answer.state, answer.state.lastProcessedAt).council.pending[0]?.text,
      ).toContain('prefere conversa a guerra');
      const resolved = choose(answer.state, 'kingsAnswer', last);
      expect(
        Object.keys(resolved.state.council.flags).filter((flag) => flag.startsWith('tax.')),
      ).toEqual([]);
      expect(resolved.state.council.scheduled).toEqual([]);
      expect(
        eligibleCards(resolved.state, AUTUMN, councilCards).map((entry) => entry.id),
      ).toContain('kingsTax');
    },
  );

  it('recusar duas vezes leva à resposta em três dias e à requisição de comida e madeira', () => {
    const first = choose(dealt(feud(), 'kingsTax').state, 'kingsTax', 'refuse');
    const collector = continueTo(first.state, 'kingsCollector');
    const rejected = applyCommand(
      collector.state,
      command('answerCard', {
        instanceId: collector.state.council.pending[0]!.instanceId,
        optionId: 'soldiers',
      }),
      collector.state.lastProcessedAt,
    );
    expect(rejected).toMatchObject({ ok: false, code: 'OPTION_LOCKED' });
    const twice = choose(collector.state, 'kingsCollector', 'refuse');
    expect(twice.state.council.scheduled[0]?.atMs).toBe(twice.state.lastProcessedAt + 3 * DAY);
    const answer = continueTo(twice.state, 'kingsAnswer');
    expect(
      deriveViewState(answer.state, answer.state.lastProcessedAt).council.pending[0]?.text,
    ).toContain('Duas recusas');
    const held = choose(answer.state, 'kingsAnswer', 'hold');
    expect(held.events[0]?.data).toMatchObject({
      spent_food: 40,
      spent_wood: 40,
      morale: 10,
      moraleDays: 3,
    });
    expect(Object.keys(held.state.council.flags).filter((flag) => flag.startsWith('tax.'))).toEqual(
      [],
    );
  });

  it.each(['peasant', 'lord', 'ironKing'] as const)(
    'expira em %s conforme a dificuldade e libera o imposto do ano seguinte',
    (difficulty) => {
      let state = expires(dealt(feud(difficulty), 'kingsTax').state, 'kingsTax').state;
      if (difficulty === 'ironKing') {
        state = expires(continueTo(state, 'kingsCollector').state, 'kingsCollector').state;
        state = expires(continueTo(state, 'kingsAnswer').state, 'kingsAnswer').state;
      }
      expect(state.council.scheduled).toEqual([]);
      expect(Object.keys(state.council.flags).filter((flag) => flag.startsWith('tax.'))).toEqual(
        [],
      );
      const nextYear = advanceTo(state, YEAR).state;
      expect(eligibleCards(nextYear, YEAR, councilCards).map((entry) => entry.id)).toContain(
        'kingsTax',
      );
    },
  );
});

describe('continuação com mesa cheia', () => {
  it.each([
    ['mysteriousMerchant', 'buy', 'merchantLead'],
    ['kingsTax', 'refuse', 'kingsCollector'],
  ])(
    '%s espera lugar e chega no mesmo instante em que a resposta abre a vaga',
    (first, option, next) => {
      let state = choose(dealt(feud(), first!).state, first!, option!).state;
      state = dealt(dealt(state, 'tavernBard').state, 'royalCaravan').state;
      const atMs = state.council.scheduled[0]!.atMs;
      const full = advanceTo(state, atMs);
      expect(full.state.council.pending).toHaveLength(2);
      expect(full.state.council.scheduled[0]?.cardId).toBe(next);
      const freed = choose(full.state, 'tavernBard', 'dismiss');
      expect(
        freed.state.council.pending.some(
          (entry) => entry.cardId === next && entry.drawnAtMs === atMs,
        ),
      ).toBe(true);
      expect(freed.state.council.scheduled).toEqual([]);
    },
  );
});

describe('praga e choques de preço', () => {
  it('a praga queima 30% ou aceita o alquimista sem perda', () => {
    const pending = dealt(feud(), 'fieldBlight').state;
    const burnt = choose(pending, 'fieldBlight', 'burn');
    expect(burnt.state.settlement.resources.food).toBe(280_000);
    expect(burnt.events[0]?.data).toMatchObject({ spent_food: 120, morale: -5, moraleDays: 2 });
    const saved = choose(pending, 'fieldBlight', 'alchemist');
    expect(saved.state.settlement.resources.food).toBe(400_000);
    expect(saved.state.settlement.resources.gold).toBe(380_000);
    expect(saved.state.council.delayed).toEqual([]);
  });

  it('a oração chega aos dois desfechos e lê a comida da virada, sem sorteio ao responder', () => {
    const outcomes = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      const start = feud();
      start.seed = `praga-${seed}`;
      const prayed = choose(dealt(start, 'fieldBlight').state, 'fieldBlight', 'pray');
      expect(prayed.state.rng.council).toEqual(start.rng.council);
      const before = cloneState(prayed.state);
      before.council.delayed = [];
      const dawn = SUMMER + DAY;
      const baseline = advanceTo(before, dawn).state;
      const result = advanceTo(prayed.state, dawn);
      const effect = result.events.find((entry) => entry.type === 'cardEffectApplied')!;
      if (effect.data.spent_food !== undefined) {
        outcomes.add('loss');
        expect(result.state.settlement.resources.food).toBe(
          baseline.settlement.resources.food - Math.floor(baseline.settlement.resources.food / 2),
        );
      } else {
        outcomes.add('relief');
        expect(effect.data).toMatchObject({ morale: 5, moraleDays: 2 });
      }
    }
    expect([...outcomes].sort()).toEqual(['loss', 'relief']);
  });

  it.each(['yield', 'resist', 'route'] as const)(
    'o Boicote/%s apaga a hostilidade e só aplica a alta prevista',
    (option) => {
      const start = feud();
      start.council.flags['merchant.hostile'] = true;
      const result = choose(dealt(start, 'merchantBoycott').state, 'merchantBoycott', option);
      expect(result.state.council.flags['merchant.hostile']).toBeUndefined();
      expect(result.state.market.effects).toHaveLength(option === 'yield' ? 0 : 4);
    },
  );

  it('a caravana real deixa o ferro fora da alta e compra seguida de venda usa o mesmo fator', () => {
    const start = choose(dealt(feud(), 'royalCaravan').state, 'royalCaravan', 'sellNow').state;
    expect(quote(start, 'wood')).toEqual({ buy: 1500, sell: 1275 });
    expect(quote(start, 'iron')).toEqual({ buy: 8000, sell: 6800 });
    const bought = accept(
      start,
      command('trade', {
        resource: 'wood',
        direction: 'buy',
        amount: 5,
        quoteDay: start.market.quoteDay,
      }),
    ).state;
    const sold = accept(
      bought,
      command('trade', {
        resource: 'wood',
        direction: 'sell',
        amount: 5,
        quoteDay: start.market.quoteDay,
      }),
    ).state;
    expect(sold.settlement.resources.gold).toBe(
      start.settlement.resources.gold - 5 * (1500 - 1275),
    );
    expect(sold.market.tradedToday.wood).toBe(10);
    expect(start.market.tradedToday.wood).toBe(0);
  });
});
