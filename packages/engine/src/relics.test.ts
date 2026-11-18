import { expireCards } from './council';
import { fightBattle } from './battleTurn';
import { previewInputFor, formationSignature } from './warCouncilOrders';
import { previewRun } from './warCouncil';
import { settleRelicSlots } from './relicOrders';
import { readySiege } from './siege.test-helpers';
import { relics, type RelicId } from '@lotg/content';
import { describe, expect, it } from 'vitest';
import { advanceTo } from './advance';
import { resolveBattle } from './battle';
import { battleRelicModifiers, grantRelic } from './relics';
import { productionRate, firewoodRate } from './economy';
import { storageCapacity, storeResource } from './storage';
import { cloneState } from './state';
import { currentShape, migrateState } from './migrations';
import { revealOmen, turnOmens } from './hordePlan';
import {
  accept,
  addHero,
  command,
  DAY,
  SUMMER,
  WINTER,
  gameAt,
  guildHall,
  dealt,
  refuse,
  send,
} from './test-helpers';
import type { GameEvent, GameState } from './types';
import type { BattleInput } from './battle';
import { deriveViewState } from './view';

const view = (state: GameState) => deriveViewState(state, state.lastProcessedAt);
const found = (state: GameState, id: RelicId) => {
  grantRelic(state, id, state.lastProcessedAt, []);
  return state;
};
const active = (state: GameState, id: RelicId) => {
  state.settlement.buildings.chapel = 3;
  found(state, id);
  const item = state.settlement.relics.find((entry) => entry.defId === id)!;
  item.placed = true;
  item.effectiveFromMs = state.lastProcessedAt;
  return state;
};
const field = (): BattleInput => ({
  mode: 'defense',
  player: {
    posts: {
      left: { front: null, back: null },
      center: { front: { unit: 'spearman', count: 20 }, back: null },
      right: { front: null, back: null },
    },
    commanders: { left: null, center: null, right: null },
  },
  horde: {
    posts: {
      left: { front: null, back: null },
      center: { front: { unit: 'wolf', count: 20 }, back: null },
      right: { front: null, back: null },
    },
  },
  wall: {},
  watchtowerLevel: 0,
  heroCapture: 'capture',
});

describe('relíquias — um teste por efeito', () => {
  it('Chifre: soma 10 à moral inicial do jogador, inclusive na prévia, sem mudar a base sem relíquia', () => {
    const state = gameAt(SUMMER);
    const base = resolveBattle({ ...field(), ...battleRelicModifiers(state) }, () => 100);
    active(state, 'ancestralHorn');
    const changed = resolveBattle({ ...field(), ...battleRelicModifiers(state) }, () => 100);
    expect(changed.startMorale.D).toBe(base.startMorale.D + 10);
    expect(changed.startMorale.A).toBe(base.startMorale.A);
    expect(view(state).army.text).toContain('Chifre dos Ancestrais');
    expect(fightBattle(cloneState(state), field()).resolution.startMorale).toEqual(
      changed.startMorale,
    );
    const army = readySiege();
    const formation = army.army.formations[0]!;
    const oldSignature = formationSignature(army, formation);
    const before = previewRun(previewInputFor(army, formation), 0).resolution;
    active(army, 'ancestralHorn');
    const after = previewRun(previewInputFor(army, formation), 0).resolution;
    expect(after.startMorale.D).toBe(before.startMorale.D + 10);
    expect(formationSignature(army, formation)).not.toBe(oldSignature);
  });

  it('Coração: Serraria ×23/20, com termo na mesma conta da produção', () => {
    const state = gameAt(SUMMER, (draft) => {
      draft.settlement.workers.lumberMill = 2;
    });
    const base = productionRate(state, 'lumberMill');
    active(state, 'oakHeart');
    expect(productionRate(state, 'lumberMill')).toBe((base * 23) / 20);
    expect(
      view(state).workers.find((entry) => entry.building === 'lumberMill')?.breakdown,
    ).toContain('Coração de Carvalho');
  });

  it('Olho: clareza Nv3 nos mesmos presságios, sem sorteio extra nem alterar o fluxo horde', () => {
    const state = readySiege();
    state.settlement.buildings.watchtower = 1;
    const normal = cloneState(state);
    revealOmen(normal, normal.horde.wavePlan!.waves[0]!, state.lastProcessedAt, []);
    expect(normal.horde.omens.at(-1)?.clarity).not.toBe('exact');
    active(state, 'watchersEye');
    revealOmen(state, state.horde.wavePlan!.waves[0]!, state.lastProcessedAt, []);
    expect(state.horde.omens.at(-1)?.clarity).toBe('partial');
    const a = cloneState(normal),
      b = cloneState(state);
    for (let day = 1; day <= 8; day++) {
      turnOmens(a, state.lastProcessedAt + day * DAY, []);
      turnOmens(b, state.lastProcessedAt + day * DAY, []);
    }
    expect(b.rng).toEqual(a.rng);
    expect(view(state).army.text).toContain('Olho do Vigia');
    state.settlement.buildings.watchtower = 5;
    revealOmen(state, state.horde.wavePlan!.waves[0]!, state.lastProcessedAt, []);
    expect(state.horde.omens.at(-1)?.clarity).toBe('exact');
  });

  it('Selo: metade do ouro nas duas cartas da Coroa, por resposta e expiração; outras cartas intactas', () => {
    for (const [card, option] of [
      ['kingsTax', 'pay'],
      ['kingsCollector', 'fine'],
    ] as const) {
      const state = dealt(
        gameAt(SUMMER, (draft) => {
          draft.settlement.resources.gold = 101_003;
        }),
        card,
      ).state;
      const pending = state.council.pending.at(-1)!;
      const base = accept(
        state,
        command('answerCard', { instanceId: pending.instanceId, optionId: option }),
      ).state;
      const blessed = active(cloneState(state), 'ancientKingsSeal');
      const changed = accept(
        blessed,
        command('answerCard', { instanceId: pending.instanceId, optionId: option }),
      ).state;
      expect(state.settlement.resources.gold - changed.settlement.resources.gold).toBe(
        Math.floor((state.settlement.resources.gold - base.settlement.resources.gold) / 2),
      );
      expect(
        view(blessed)
          .council.pending.find((entry) => entry.instanceId === pending.instanceId)
          ?.options.find((entry) => entry.id === option)?.effectsText,
      ).toContain('Selo do Rei Antigo');
      const expiredBase = cloneState(state),
        expiredSeal = cloneState(blessed);
      expireCards(expiredBase, pending.expiresAtMs, []);
      expireCards(expiredSeal, pending.expiresAtMs, []);
      expect(state.settlement.resources.gold - expiredSeal.settlement.resources.gold).toBe(
        Math.floor((state.settlement.resources.gold - expiredBase.settlement.resources.gold) / 2),
      );
    }

    const third = dealt(gameAt(SUMMER), 'kingsAnswer').state;
    const pending = third.council.pending[0]!;
    const baseline = accept(
      third,
      command('answerCard', { instanceId: pending.instanceId, optionId: 'tribute' }),
    ).state;
    const sealed = active(cloneState(third), 'ancientKingsSeal');
    const unchanged = accept(
      sealed,
      command('answerCard', { instanceId: pending.instanceId, optionId: 'tribute' }),
    ).state;
    expect(unchanged.settlement.resources.gold).toBe(baseline.settlement.resources.gold);
  });

  it('Osso: aplica ×7/10 ao ataque dos lobos, antes da defesa e do piso do dano', () => {
    const state = gameAt(SUMMER);
    const base = resolveBattle({ ...field(), ...battleRelicModifiers(state) }, () => 100);
    active(state, 'wolfBone');
    const changed = resolveBattle({ ...field(), ...battleRelicModifiers(state) }, () => 100);
    const wolfHit = (resolution: typeof base) =>
      resolution.rounds[0]!.actions.find(
        (action) => action.kind === 'attack' && action.unit === 'wolf',
      );
    const before = wolfHit(base),
      after = wolfHit(changed);
    expect(before?.kind).toBe('attack');
    expect(after?.kind).toBe('attack');
    if (before?.kind !== 'attack' || after?.kind !== 'attack')
      throw new Error('Faltou ataque de lobo.');
    expect(after.hits[0]!.raw.num / after.hits[0]!.raw.den).toBe(
      ((before.hits[0]!.raw.num / before.hits[0]!.raw.den) * 7) / 10,
    );
    expect(view(state).army.text).toContain('Osso de Lobo');
  });

  it('Lâmpada: encurta viagens em 10%, retira imediatamente do restante e não encurta a espera da encruzilhada', () => {
    const state = guildHall(SUMMER);
    const hero = addHero(state);
    const baseline = send(cloneState(state), 'patrol', [hero.id]).state;
    active(state, 'hermitsLamp');
    const fast = send(state, 'patrol', [hero.id]).state;
    const end = baseline.guild.expeditions[0]!.nodeEndsAtMs!;
    expect(fast.guild.expeditions[0]!.nodeEndsAtMs! - SUMMER).toBe(
      Math.floor(((end - SUMMER) * 9) / 10),
    );
    expect(view(state).guild.available[0]?.durationNote).toContain('Lâmpada do Eremita');
    const removed = accept(fast, command('removeRelic', { relicId: 'hermitsLamp' })).state;
    expect(removed.guild.expeditions[0]!.nodeEndsAtMs).toBe(end);
  });

  it('Pedra: cap de comida ×6/5 e retirada sem apagar comida acima do novo limite', () => {
    const state = gameAt(SUMMER);
    const cap = storageCapacity(state, 'food')!;
    active(state, 'saltStone');
    expect(storageCapacity(state, 'food')).toBe((cap * 6) / 5);
    expect(view(state).resources.find((entry) => entry.id === 'food')?.capBreakdown).toContain(
      'Pedra de Sal',
    );
    storeResource(state, 'food', cap * 2);
    const amount = state.settlement.resources.food;
    const removed = accept(state, command('removeRelic', { relicId: 'saltStone' })).state;
    expect(storageCapacity(removed, 'food')).toBe(cap);
    expect(removed.settlement.resources.food).toBe(amount);
    expect(storeResource(removed, 'food', 1_000)).toBe(0);
  });

  it('Manto: lenha ×1/2, com termo na conta e previsão do inverno', () => {
    const state = gameAt(WINTER);
    const base = firewoodRate(state);
    active(state, 'wintersCloak');
    expect(firewoodRate(state)).toBe(Math.floor(base / 2));
    expect(view(state).winter?.firewood.text).toContain('Manto do Inverno');
    expect(view(state).resources.find((entry) => entry.id === 'wood')?.breakdown).toContain(
      'Manto do Inverno',
    );
    let upcoming = guildHall(SUMMER);
    const normalWinter = view(upcoming).calendar.nextFirewoodSeason!.firewood;
    upcoming.settlement.buildings.chapel = 1;
    found(upcoming, 'wintersCloak');
    upcoming = accept(upcoming, command('placeRelic', { relicId: 'wintersCloak' })).state;
    const changedWinter = view(upcoming).calendar.nextFirewoodSeason!.firewood;
    expect(changedWinter.perHour).toBe(normalWinter.perHour / 2);
    expect(changedWinter.winterTotal).toBe(normalWinter.winterTotal / 2);
    expect(changedWinter.text).toContain('Manto do Inverno');
  });
});

describe('relíquias — concessão, ordens, prazos e forma', () => {
  it('concede cada relíquia uma vez, sem sorteio, contador ou ordem de concessão', () => {
    const state = gameAt(SUMMER);
    const events: GameEvent[] = [];
    const rng = JSON.stringify(state.rng),
      ids = JSON.stringify(state.ids);
    expect(grantRelic(state, 'oakHeart', SUMMER, events)).toBe(true);
    expect(grantRelic(state, 'oakHeart', SUMMER, events)).toBe(false);
    expect(state.settlement.relics).toEqual([
      { defId: 'oakHeart', placed: false, effectiveFromMs: null },
    ]);
    expect(events.map((event) => event.type)).toEqual(['relicFound']);
    expect(events[0]?.text).toContain(relics.oakHeart.label);
    expect(JSON.stringify(state.rng)).toBe(rng);
    expect(JSON.stringify(state.ids)).toBe(ids);
  });

  it('recusa sem Capela, relíquia ausente, lugar ocupado, colocação repetida e retirada repetida', () => {
    let state = found(gameAt(SUMMER), 'oakHeart');
    expect(refuse(state, command('placeRelic', { relicId: 'oakHeart' })).code).toBe(
      'CHAPEL_REQUIRED',
    );
    state.settlement.buildings.chapel = 1;
    expect(refuse(state, command('placeRelic', { relicId: 'unknown' })).code).toBe(
      'RELIC_NOT_FOUND',
    );
    expect(refuse(state, command('removeRelic', { relicId: 'unknown' })).code).toBe(
      'RELIC_NOT_FOUND',
    );
    expect(refuse(state, command('removeRelic', { relicId: 'oakHeart' })).code).toBe(
      'RELIC_NOT_PLACED',
    );
    state = accept(state, command('placeRelic', { relicId: 'oakHeart' })).state;
    expect(refuse(state, command('placeRelic', { relicId: 'oakHeart' })).code).toBe(
      'RELIC_ALREADY_PLACED',
    );
    found(state, 'saltStone');
    expect(refuse(state, command('placeRelic', { relicId: 'saltStone' })).code).toBe(
      'NO_RELIC_SLOT',
    );
    const blocked = view(state).relics.items.find((item) => item.relicId === 'saltStone')!;
    expect(blocked.blockedCode).toBe('NO_RELIC_SLOT');
    expect(blocked.blockedReason).toContain('Capela');
    state = accept(state, command('removeRelic', { relicId: 'oakHeart' })).state;
    state = accept(state, command('placeRelic', { relicId: 'saltStone' })).state;
    expect(state.settlement.relics.filter((item) => item.placed)).toHaveLength(1);
    expect(currentShape(state, '')).toBeNull();
  });

  it.each([0.5, 1, 3])(
    'só ativa na próxima virada, converte os segundos reais e divide o intervalo exatamente em ritmo %s',
    (timeScale) => {
      let state = guildHall(WINTER + 1_234, (draft) => {
        draft.settings.timeScale = timeScale;
        draft.settlement.buildings.chapel = 3;
        draft.settlement.workers.lumberMill = 2;
        draft.settlement.workers.farm = 3;
      });
      for (const id of ['oakHeart', 'saltStone', 'wintersCloak'] as const) {
        found(state, id);
        state = accept(state, command('placeRelic', { relicId: id })).state;
      }
      const boundary = WINTER + DAY;
      const baseRate = productionRate(state, 'lumberMill');
      const original = JSON.stringify(state);
      const visible = view(state).relics;
      expect(visible.slots).toBe(3);
      expect(
        visible.items.every(
          (item) =>
            !item.active &&
            item.effectiveInSeconds === Math.ceil((DAY - 1_234) / 1_000 / timeScale),
        ),
      ).toBe(true);
      expect(visible.items[0]?.effectiveText).toContain('Vale a partir');
      expect(JSON.stringify(state)).toBe(original);
      const before = advanceTo(state, boundary - 1).state;
      expect(productionRate(before, 'lumberMill')).toBe(baseRate);
      const activated = advanceTo(before, boundary).state;
      expect(
        view(activated).relics.items.every((item) => item.active && item.effectiveInSeconds === 0),
      ).toBe(true);
      const end = boundary + DAY + 123;
      const whole = advanceTo(state, end);
      const first = advanceTo(state, boundary - 1),
        middle = advanceTo(first.state, boundary),
        last = advanceTo(middle.state, end);
      expect(last.state).toEqual(whole.state);
      expect([...first.events, ...middle.events, ...last.events]).toEqual(whole.events);
      const removed = accept(activated, command('removeRelic', { relicId: 'oakHeart' })).state;
      expect(view(removed).relics.items[0]).toMatchObject({
        active: false,
        placed: false,
        effectiveInSeconds: null,
      });
      const replaced = accept(removed, command('placeRelic', { relicId: 'oakHeart' })).state;
      expect(replaced.settlement.relics[0]?.effectiveFromMs).toBe(boundary + DAY);
    },
  );

  it('retirar antes do amanhecer cancela o efeito e outra colocação espera a próxima virada', () => {
    let state = found(gameAt(SUMMER + 1), 'oakHeart');
    state.settlement.buildings.chapel = 1;
    state = accept(state, command('placeRelic', { relicId: 'oakHeart' })).state;
    state = accept(state, command('removeRelic', { relicId: 'oakHeart' })).state;
    expect(view(advanceTo(state, SUMMER + DAY).state).relics.items[0]?.active).toBe(false);
  });

  it('v43 recusa ids desconhecidos, repetidos, campo extra, prazo fora da virada e excesso de colocadas', () => {
    const valid = active(gameAt(SUMMER), 'oakHeart');
    expect(currentShape(valid, '')).toBeNull();
    const variants: unknown[] = [
      [{ defId: 'unknown', placed: false, effectiveFromMs: null }],
      [...valid.settlement.relics, ...valid.settlement.relics],
      [{ ...valid.settlement.relics[0], extra: true }],
      [{ defId: 'oakHeart', placed: true, effectiveFromMs: SUMMER + 1 }],
      [{ defId: 'oakHeart', placed: false, effectiveFromMs: SUMMER }],
    ];
    for (const relics of variants) {
      expect(() =>
        migrateState({ ...valid, settlement: { ...valid.settlement, relics } }, { timeScale: 1 }),
      ).toThrow();
    }
    const noSlots = cloneState(valid);
    noSlots.settlement.buildings.chapel = 0;
    expect(() => migrateState(noSlots, { timeScale: 1 })).toThrow();
  });
});

describe('relíquias em transições de estado', () => {
  it('a Lâmpada só encurta o restante da viagem na ativação e retira esse fator no instante da ordem', () => {
    let state = guildHall(SUMMER + DAY - 1_000);
    state.settlement.buildings.chapel = 1;
    const hero = addHero(state);
    state = send(state, 'patrol', [hero.id]).state;
    const originalEnd = state.guild.expeditions[0]!.nodeEndsAtMs!;
    found(state, 'hermitsLamp');
    state = accept(state, command('placeRelic', { relicId: 'hermitsLamp' })).state;
    expect(state.guild.expeditions[0]!.nodeEndsAtMs).toBe(originalEnd);
    const boundary = SUMMER + DAY;
    const activated = advanceTo(state, boundary);
    const end = boundary + Math.ceil(((originalEnd - boundary) * 9) / 10);
    expect(activated.state.guild.expeditions[0]!.nodeEndsAtMs).toBe(end);
    const later = advanceTo(activated.state, boundary + 10);
    const removed = accept(later.state, command('removeRelic', { relicId: 'hermitsLamp' }));
    expect(removed.state.guild.expeditions[0]!.nodeEndsAtMs).toBe(
      boundary + 10 + Math.ceil(((end - boundary - 10) * 10) / 9),
    );
    const whole = advanceTo(state, originalEnd + DAY);
    const split = advanceTo(activated.state, originalEnd + DAY);
    expect(split.state).toEqual(whole.state);
    expect([...activated.events, ...split.events]).toEqual(whole.events);
  });

  it('a redução da Capela guarda o excedente com evento e mantém a forma válida', () => {
    const state = active(active(active(gameAt(SUMMER), 'oakHeart'), 'saltStone'), 'wintersCloak');
    state.settlement.buildings.chapel = 1;
    const events: GameEvent[] = [];
    settleRelicSlots(state, state.lastProcessedAt, events);
    expect(state.settlement.relics.filter((item) => item.placed).map((item) => item.defId)).toEqual(
      ['oakHeart'],
    );
    expect(events.map((event) => event.type)).toEqual(['relicRemoved', 'relicRemoved']);
    expect(currentShape(state, '')).toBeNull();
  });
});
