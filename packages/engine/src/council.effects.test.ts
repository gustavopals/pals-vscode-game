import { type CouncilCard, type CouncilEffect } from '@lotg/content';
import { CouncilCardSchema } from '@lotg/content/schemas';
import { describe, expect, it } from 'vitest';

import { answerCard, deliverCard, meetsRequirements, optionLock } from './council';
import { councilView } from './councilView';
import { quote, priceBounds } from './market';
import { marketView } from './marketView';
import { migrateState } from './migrations';
import { chance } from './random';
import { cloneState } from './state';
import {
  addHero,
  advanceWithCards,
  DAY,
  newGame,
  quietCouncil,
  quietHorde,
  SUMMER,
  WINTER,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';

function card(effects: readonly CouncilEffect[]): CouncilCard {
  return {
    id: 'effectTest',
    title: 'A prova',
    text: 'A prova chegou. O conselho espera.',
    weight: 1,
    autoResolve: { peasant: 'choose', lord: 'choose', ironKing: 'choose' },
    options: [
      {
        id: 'choose',
        label: 'Escolher',
        effects,
        hint: 'A prova espera.',
        chronicle: 'No {dia}º dia, {feudo} escolheu.',
      },
      {
        id: 'wait',
        label: 'Esperar',
        effects: [],
        hint: 'O conselho espera.',
        chronicle: 'No {dia}º dia, {feudo} esperou.',
      },
    ],
  };
}

function feud(atMs = SUMMER + DAY / 3): GameState {
  const state = newGame('effect-test');
  quietCouncil(state);
  quietHorde(state);
  state.lastProcessedAt = atMs;
  state.clock.gameTimeMs = atMs;
  state.settlement.buildings.market = 1;
  state.settlement.buildings.granary = 3;
  state.settlement.workers.farm = 3;
  state.settlement.resources.food = 400_001;
  state.settlement.resources.gold = 100_001;
  return state;
}

function choose(state: GameState, def: CouncilCard) {
  const draft = cloneState(state);
  const events: GameEvent[] = [];
  const pending = deliverCard(draft, def, draft.lastProcessedAt, [], { source: 'draw' });
  const rejection = answerCard(draft, pending.instanceId, 'choose', draft.lastProcessedAt, events, [
    def,
  ]);
  expect(rejection).toBeNull();
  return { state: draft, events };
}

const risk: Extract<CouncilEffect, { type: 'rollEffect' }> = {
  type: 'rollEffect',
  chance: { num: 1, den: 2 },
  withHeroClass: { heroClass: 'cleric', chance: { num: 1, den: 5 } },
  onHit: {
    effects: [{ type: 'resourcesPercent', resource: 'food', ratio: { num: -1, den: 2 } }],
    chronicle: 'No {dia}º dia, a praga levou o grão de {feudo}.',
  },
  onMiss: {
    effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
    chronicle: 'No {dia}º dia, a praga cedeu em {feudo}.',
  },
};

describe('efeitos e requisitos do Mercado e da Coroa', () => {
  it('perde a fração do estoque do instante, em milésimos inteiros, e registra o gasto real', () => {
    const before = feud();
    const def = card([
      { type: 'resourcesPercent', resource: 'gold', ratio: { num: -15, den: 100 } },
    ]);
    const result = choose(before, def);
    expect(result.state.settlement.resources.gold).toBe(85_001);
    expect(result.events[0]?.data.spent_gold).toBe(15);
    expect(before.settlement.resources.gold).toBe(100_001);
    before.settlement.resources.gold = 0;
    expect(choose(before, def).state.settlement.resources.gold).toBe(0);
  });

  it('o ganho percentual respeita o depósito e conta o desperdício', () => {
    const before = feud();
    before.settlement.buildings.granary = 0;
    before.settlement.resources.food = 499_999;
    const result = choose(
      before,
      card([{ type: 'resourcesPercent', resource: 'food', ratio: { num: 1, den: 2 } }]),
    );
    expect(result.state.settlement.resources.food).toBe(500_000);
    expect(result.events[0]?.data).toMatchObject({ gained_food: 0.001, lost_food: 249.998 });
  });

  it('revela o destino pedido uma vez, mesmo se outro destino vier antes no catálogo', () => {
    const result = choose(feud(), card([{ type: 'revealDestination', modelId: 'abandonedMine' }]));
    expect(result.state.map.discovered).toEqual(['abandonedMine']);
    expect(
      choose(result.state, card([{ type: 'revealDestination', modelId: 'abandonedMine' }])).state
        .map.discovered,
    ).toEqual(['abandonedMine']);
  });

  it('a carta exige o estoque estritamente acima do limite e o destino ainda desconhecido', () => {
    const state = feud();
    const def = {
      ...card([]),
      requires: { resourcesAbove: { food: 200 }, undiscovered: 'ruins' as const },
    };
    state.settlement.resources.food = 200_000;
    expect(meetsRequirements(state, def, state.lastProcessedAt)).toBe(false);
    state.settlement.resources.food += 1;
    expect(meetsRequirements(state, def, state.lastProcessedAt)).toBe(true);
    state.map.discovered.push('ruins');
    expect(meetsRequirements(state, def, state.lastProcessedAt)).toBe(false);
  });

  it('a opção exige nível do edifício e destino ainda não revelado', () => {
    const state = feud();
    const option = {
      ...card([]).options[0]!,
      requires: { buildings: { guild: 2 }, undiscovered: 'abandonedMine' as const },
    };
    expect(optionLock(state, option)).toContain('Nv2');
    state.settlement.buildings.guild = 2;
    expect(optionLock(state, option)).toBeNull();
    state.map.discovered.push('abandonedMine');
    expect(optionLock(state, option)).toContain('ainda não revelado');
  });

  it('a flag esconde a opção e também barra uma ordem forjada', () => {
    const state = feud();
    const original = card([]);
    const def = {
      ...original,
      options: [
        { ...original.options[0]!, requires: { flags: ['merchant.hostile'] } },
        original.options[1]!,
      ],
    };
    const pending = deliverCard(state, def, state.lastProcessedAt, [], { source: 'draw' });
    expect(
      councilView(state, 1, [def]).council.pending[0]?.options.map((entry) => entry.id),
    ).toEqual(['wait']);
    expect(
      answerCard(state, pending.instanceId, 'choose', state.lastProcessedAt, [], [def])?.code,
    ).toBe('OPTION_LOCKED');
    state.council.flags['merchant.hostile'] = true;
    expect(optionLock(state, def.options[0]!)).toBeNull();
  });

  it('soma só soldados treinados, sem contar o lote no Quartel', () => {
    const state = feud();
    const option = { ...card([]).options[0]!, requires: { minSoldiers: 10 } };
    state.army.units.spearman = 5;
    state.army.units.archer = 4;
    state.army.training = {
      unit: 'spearman',
      amount: 2,
      startedAtMs: state.lastProcessedAt,
      endsAtMs: state.lastProcessedAt + DAY,
    };
    expect(optionLock(state, option)).toContain('10 soldados');
    state.army.units.archer += 1;
    expect(optionLock(state, option)).toBeNull();
  });

  it.each(['idle', 'injured', 'expedition', 'escort', 'captured'] as const)(
    'herói %s: só o livre negocia e o nome fica no evento',
    (status) => {
      const state = feud();
      const hero = addHero(state, { name: 'Ada', traits: ['charismatic'] });
      hero.status = status;
      const original = card([]);
      const option = {
        ...original.options[0]!,
        requires: { heroTrait: 'charismatic' as const },
        chronicle: 'No {dia}º dia, {heroi} falou por {feudo}.',
      };
      const def = { ...original, options: [option, original.options[1]!] };
      expect(optionLock(state, option) === null).toBe(status === 'idle');
      if (status === 'idle') {
        const result = choose(state, def);
        expect(result.events[0]?.data).toMatchObject({ heroId: hero.id, heroName: 'Ada' });
        expect(result.events[0]?.text).toContain('Ada');
      }
    },
  );
});

describe('market.effects: a mesma cotação na visão e na negociação', () => {
  it('multiplica fatores e estação, sem teto sobre o preço exibido nem mudança do passeio ou quoteDay', () => {
    const state = feud(WINTER + DAY / 3);
    state.market.prices.food = priceBounds('food').ceiling;
    const def = card([
      {
        type: 'marketPrice',
        resources: ['food', 'wood', 'stone', 'iron'],
        factor: { num: 6, den: 5 },
        durationDays: 2,
      },
      {
        type: 'marketPrice',
        resources: ['food', 'wood', 'stone'],
        factor: { num: 5, den: 4 },
        durationDays: 1,
      },
    ]);
    const result = choose(state, def).state;
    expect(result.market.prices).toEqual(state.market.prices);
    expect(result.market.quoteDay).toBe(state.market.quoteDay);
    expect(quote(result, 'food')).toEqual({ buy: 3120, sell: 2652 });
    expect(quote(result, 'iron')).toEqual({ buy: 9600, sell: 8160 });
    expect(marketView(result, 3).prices[0]).toMatchObject({ buy: 3120, sell: 2652 });
    expect(marketView(result, 3).prices[0]?.breakdown).toContain('Carta: A prova');
    expect(migrateState(JSON.parse(JSON.stringify(result)), { timeScale: 1 })).toEqual(result);
  });

  it('vence no instante exato entre viradas e preserva a divisão de intervalo, os eventos e o gerador', () => {
    const def = card([
      { type: 'marketPrice', resources: ['wood'], factor: { num: 6, den: 5 }, durationDays: 1 },
    ]);
    const start = choose(feud(), def).state;
    const end = start.lastProcessedAt + DAY;
    const before = advanceWithCards(start, end - 1, [def]);
    expect(nextEventAt(before.state)).toBe(end);
    expect(quote(before.state, 'wood').buy).toBeGreaterThan(before.state.market.prices.wood);
    const split = advanceWithCards(before.state, end, [def]);
    const direct = advanceWithCards(start, end, [def]);
    expect(split.state).toEqual(direct.state);
    expect([...before.events, ...split.events]).toEqual(direct.events);
    expect(direct.state.market.effects).toEqual([]);
    expect(quote(direct.state, 'wood').buy).toBe(direct.state.market.prices.wood);
  });
});

describe('rollEffect: risco à vista, sorteio só na virada', () => {
  it('a escolha e a visão não sorteiam; a recarga conserva o risco e só a virada aplica o resultado', () => {
    const def = card([risk]);
    const state = feud();
    const rng = cloneState(state).rng;
    const pending = deliverCard(state, def, state.lastProcessedAt, [], { source: 'draw' });
    const text = councilView(state, 1, [def]).council.pending[0]?.options[0]?.effectsText;
    expect(text).toContain('1 em 2');
    expect(text).toContain('50%');
    expect(state.rng).toEqual(rng);
    expect(
      answerCard(state, pending.instanceId, 'choose', state.lastProcessedAt, [], [def]),
    ).toBeNull();
    expect(state.rng).toEqual(rng);
    const dawn = SUMMER + DAY;
    expect(state.council.delayed[0]?.atMs).toBe(dawn);
    const loaded = migrateState(JSON.parse(JSON.stringify(state)), { timeScale: 1 });
    const before = advanceWithCards(loaded, dawn - 1, [def]);
    const split = advanceWithCards(before.state, dawn, [def]);
    const direct = advanceWithCards(state, dawn, [def]);
    expect(split.state).toEqual(direct.state);
    expect([...before.events, ...split.events]).toEqual(direct.events);
    expect(direct.events.filter((entry) => entry.type === 'cardEffectApplied')).toHaveLength(1);
    expect(direct.state.council.delayed).toEqual([]);
  });

  it.each(['idle', 'injured', 'expedition', 'escort', 'captured'] as const)(
    'a Clériga %s reduz a chance salvo em cativeiro',
    (status) => {
      const def = card([risk]);
      const state = feud();
      const hero = addHero(state, { classId: 'cleric' });
      hero.status = status;
      deliverCard(state, def, state.lastProcessedAt, [], { source: 'draw' });
      expect(councilView(state, 1, [def]).council.pending[0]?.options[0]?.effectsText).toContain(
        status === 'captured' ? '1 em 2' : '1 em 5',
      );
      // O mesmo fluxo e a chance do instante da resolução, sem nova semente nem sorteio na escolha.
      const chosen = choose(feud(), def).state;
      const cleric = addHero(chosen, { classId: 'cleric' });
      cleric.status = status;
      const expectedRng = cloneState(chosen);
      chance(
        expectedRng,
        'council',
        status === 'captured' ? risk.chance : risk.withHeroClass!.chance,
      );
      const result = advanceWithCards(chosen, SUMMER + DAY, [def]);
      expect(result.state.rng.council).toEqual(expectedRng.rng.council);
    },
  );

  it('o schema recusa chances inválidas, risco escondido ou aninhado e frações sem denominador', () => {
    expect(CouncilCardSchema.safeParse(card([risk])).success).toBe(true);
    for (const effect of [
      { ...risk, chance: { num: 2, den: 1 } },
      { ...risk, chance: { num: 1, den: 0 } },
      { ...risk, onHit: { ...risk.onHit, effects: [risk] } },
      { type: 'resourcesPercent', resource: 'gold', ratio: { num: -1, den: 0 } },
      {
        type: 'marketPrice',
        resources: ['food', 'food'],
        factor: { num: 6, den: 5 },
        durationDays: 2,
      },
    ])
      expect(CouncilCardSchema.safeParse(card([effect as CouncilEffect])).success).toBe(false);
  });
});
