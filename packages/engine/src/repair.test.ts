import { balance, itemRarities, items } from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { inventoryHasRoom, stowItem } from './equipment';
import { heroPower } from './heroes';
import { cloneState } from './state';
import {
  accept,
  addHero,
  apply,
  command,
  giveItem,
  guildHall,
  HOUR,
  MINUTE,
  send,
  smithyStall,
  wear,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState, Hero, Item } from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

/** Põe a condição de um item em um valor. */
const worn = (item: Item, condition: number): Item => {
  item.condition = condition;
  return item;
};

const refused = (state: GameState, ...args: Parameters<typeof command>) => {
  const result = apply(state, command(...args));
  if (result.ok) {
    throw new Error('A ordem devia ser recusada.');
  }
  return result;
};

const run = (state: GameState, ...stops: number[]): { state: GameState; events: GameEvent[] } => {
  let current = state;
  const events: GameEvent[] = [];
  for (const at of stops) {
    const step = advanceTo(current, at);
    current = step.state;
    events.push(...step.events);
  }
  return { state: current, events };
};

/** Um Ferreiro de pé com um Arco de freixo (Incomum, 10 usos) no arsenal, com a condição dada. */
function bench(condition: number, edit: (draft: GameState) => void = () => {}): GameState {
  return smithyStall(0, (draft) => {
    worn(giveItem(draft, 'ashBow'), condition);
    edit(draft);
  });
}

describe('reparo no Ferreiro (V4B-T3; ADR 0019, decisão 5)', () => {
  it('cobra 1 de ferro por ponto num item Incomum, tira o item do arsenal para a forja e fixa 2 min por ponto', () => {
    const start = bench(3);
    const { state, events } = accept(start, command('repairItem', { itemId: 'item-1' }));
    // 7 pontos que faltam (10 − 3).
    expect(state.settlement.resources.iron).toBe(start.settlement.resources.iron - 7 * MILLI);
    expect(state.guild.inventory).toEqual([]);
    expect(state.settlement.forge).toEqual({
      kind: 'repair',
      item: { id: 'item-1', defId: 'ashBow', condition: 3 },
      points: 7,
      startedAtMs: 0,
      endsAtMs: 14 * MINUTE,
    });
    expect(events.map((event) => event.type)).toEqual(['repairStarted']);
    expect(events[0]?.data).toMatchObject({ itemId: 'item-1', points: 7, spent_iron: 7 });
    expect(events[0]?.text).toContain('Arco de freixo');
    expect(nextEventAt(state)).toBe(14 * MINUTE);
    // A ordem não altera o estado de entrada.
    expect(start.settlement.forge).toBeNull();
    expect(start.guild.inventory).toHaveLength(1);
  });

  it('o preço por ponto é o da raridade: 1 no Comum e no Incomum, 2 no Raro e no Épico', () => {
    const expected = { huntingSpear: 1, ashBow: 1, veltharBlade: 2, emberStaff: 2 } as const;
    for (const [defId, perPoint] of Object.entries(expected)) {
      const start = smithyStall(0, (draft) =>
        worn(giveItem(draft, defId as keyof typeof items), 0),
      );
      const durability = itemRarities[items[defId as keyof typeof items].rarity].durability;
      const { state } = accept(start, command('repairItem', { itemId: 'item-1' }));
      expect(state.settlement.resources.iron, defId).toBe(
        start.settlement.resources.iron - durability * perPoint * MILLI,
      );
      expect(state.settlement.forge?.endsAtMs, defId).toBe(durability * 2 * MINUTE);
    }
    expect(balance.equipment.repair.ironPerPoint).toEqual({
      common: 1,
      uncommon: 1,
      rare: 2,
      epic: 2,
    });
  });

  it('o fim do reparo é um instante da linha do tempo: um milissegundo antes o item não voltou, no instante volta cheio, com o jogador fora', () => {
    const { state } = accept(bench(3), command('repairItem', { itemId: 'item-1' }));
    const end = 14 * MINUTE;
    const before = advanceTo(state, end - 1);
    expect(before.state.guild.inventory).toEqual([]);
    expect(before.state.settlement.forge).not.toBeNull();
    // Nenhuma ordem entre os dois instantes: o jogador está fora.
    const at = advanceTo(before.state, end);
    expect(at.state.settlement.forge).toBeNull();
    expect(at.state.guild.inventory).toEqual([{ id: 'item-1', defId: 'ashBow', condition: 10 }]);
    const repaired = at.events.filter((event) => event.type === 'itemRepaired');
    expect(repaired).toHaveLength(1);
    expect(repaired[0]?.atMs).toBe(end);
    expect(repaired[0]?.text).toContain('Arco de freixo');
  });

  it('as recusas, na ordem: sem Ferreiro, forja ocupada, item que não está no arsenal, item inteiro, ferro que falta', () => {
    const noSmithy = guildHall(0, (draft) => worn(giveItem(draft, 'ashBow'), 3));
    expect(refused(noSmithy, 'repairItem', { itemId: 'item-1' }).code).toBe('SMITHY_REQUIRED');

    const busy = accept(bench(3), command('forgeWeapons', { amount: 1 })).state;
    expect(refused(busy, 'repairItem', { itemId: 'item-1' }).code).toBe('FORGE_BUSY');
    // E o contrário: um reparo em curso também ocupa a forja.
    const repairing = accept(bench(3), command('repairItem', { itemId: 'item-1' })).state;
    expect(refused(repairing, 'forgeWeapons', { amount: 1 }).code).toBe('FORGE_BUSY');
    expect(refused(repairing, 'repairItem', { itemId: 'item-1' }).code).toBe('FORGE_BUSY');

    expect(refused(bench(3), 'repairItem', { itemId: 'item-99' }).code).toBe('ITEM_NOT_FOUND');
    const carried = smithyStall(0, (draft) => {
      addHero(draft);
      const [edda] = draft.guild.heroes;
      if (edda !== undefined) {
        worn(wear(draft, edda, 'ashBow'), 3);
      }
    });
    const carriedRefusal = refused(carried, 'repairItem', { itemId: 'item-1' });
    expect(carriedRefusal.code).toBe('ITEM_NOT_FOUND');
    expect(carriedRefusal.message).toContain('devolva-o ao arsenal');

    const intact = refused(bench(10), 'repairItem', { itemId: 'item-1' });
    expect(intact.code).toBe('ITEM_INTACT');
    expect(intact.message).toContain('Arco de freixo');

    const poor = bench(0, (draft) => {
      draft.settlement.resources.iron = 9 * MILLI;
    });
    const poorRefusal = refused(poor, 'repairItem', { itemId: 'item-1' });
    expect(poorRefusal.code).toBe('INSUFFICIENT_RESOURCES');
    expect(poorRefusal.message).toContain('ferro');
    // Uma recusa não cobra nada nem mexe no arsenal.
    expect(poor.guild.inventory).toHaveLength(1);
  });

  it('o item em reparo guarda o lugar dele no arsenal: um item que chega com o arsenal cheio é vendido, e o reparado volta', () => {
    const cap = balance.equipment.inventoryCap;
    const start = bench(3, (draft) => {
      while (draft.guild.inventory.length < cap) {
        giveItem(draft, 'luckyCharm');
      }
    });
    const repairing = accept(start, command('repairItem', { itemId: 'item-1' })).state;
    expect(repairing.guild.inventory).toHaveLength(cap - 1);
    expect(inventoryHasRoom(repairing)).toBe(false);
    const draft = cloneState(repairing);
    const events: GameEvent[] = [];
    const kept = stowItem(
      draft,
      { id: 'item-900', defId: 'huntingSpear', condition: 8 },
      0,
      events,
    );
    expect(kept).toBe(false);
    expect(events.map((event) => event.type)).toEqual(['itemSold']);
    // Quando o reparo termina, o item volta ao arsenal (não é vendido).
    const done = advanceTo(repairing, 14 * MINUTE).state;
    expect(done.guild.inventory).toHaveLength(cap);
    expect(done.guild.inventory.at(-1)).toEqual({ id: 'item-1', defId: 'ashBow', condition: 10 });
  });

  it('um reparo não se cancela: cancelForge é recusada e o reparo segue', () => {
    const repairing = accept(bench(3), command('repairItem', { itemId: 'item-1' })).state;
    const refusal = refused(repairing, 'cancelForge', {});
    expect(refusal.code).toBe('NOT_FORGING');
    expect(refusal.message).toContain('reparo');
    expect(repairing.settlement.forge?.kind).toBe('repair');
  });

  it('a venda por ouro com o arsenal cheio vale o conteúdo, e não a condição do item', () => {
    const cap = balance.equipment.inventoryCap;
    for (const condition of [8, 1, 0]) {
      const draft = cloneState(
        smithyStall(0, (state) => {
          while (state.guild.inventory.length < cap) {
            giveItem(state, 'luckyCharm');
          }
        }),
      );
      const events: GameEvent[] = [];
      const gold = draft.settlement.resources.gold;
      stowItem(draft, { id: 'item-900', defId: 'huntingSpear', condition }, 0, events);
      expect(draft.settlement.resources.gold - gold, `condição ${condition}`).toBe(
        items.huntingSpear.value * MILLI,
      );
    }
  });

  it('cortar o tempo em qualquer instante dá o mesmo estado, os mesmos eventos e o mesmo gerador, com o reparo terminando no meio', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(3, 1, 0.5),
        fc.integer({ min: 0, max: 9 }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (timeScale, condition, share) => {
          const base = smithyStall(0, (draft) => worn(giveItem(draft, 'ashBow'), condition), {
            timeScale,
            seed: 'reparo-divisao',
          });
          const start = accept(base, command('repairItem', { itemId: 'item-1' })).state;
          const end = start.lastProcessedAt + 3 * HOUR;
          const cut = start.lastProcessedAt + Math.floor((end - start.lastProcessedAt) * share);
          const whole = run(start, end);
          const split = run(start, cut, end);
          expect(split.state).toStrictEqual(whole.state);
          expect(split.events).toStrictEqual(whole.events);
          expect(whole.state.guild.inventory[0]?.condition).toBe(10);
        },
      ),
      { numRuns: 30 },
    );
  });
});

describe('desgaste do equipamento (V4B-T3; ADR 0019, decisão 5)', () => {
  /** Edda (com um Arco) e Rolf (com um Gibão) no feudo, mais um item solto no arsenal. */
  function company(conditions: { edda: number; rolf: number; spare: number }): GameState {
    return guildHall(
      0,
      (draft) => {
        addHero(draft, { level: 4 });
        addHero(draft, { classId: 'archer', level: 4 });
        const [edda, rolf] = draft.guild.heroes as [Hero, Hero];
        worn(wear(draft, edda, 'ashBow'), conditions.edda);
        worn(wear(draft, rolf, 'paddedJerkin'), conditions.rolf);
        worn(giveItem(draft, 'luckyCharm'), conditions.spare);
        draft.settlement.buildings.smithy = 1;
        draft.settlement.resources.iron = 100 * MILLI;
      },
      { seed: 'desgaste' },
    );
  }

  const heroOf = (state: GameState, id: string): Hero => {
    const hero = state.guild.heroes.find((entry) => entry.id === id);
    if (hero === undefined) {
      throw new Error(id);
    }
    return hero;
  };

  it('cada item de quem volta perde 1 ponto, no instante da volta; o de quem ficou e o do arsenal, não', () => {
    const start = company({ edda: 10, rolf: 8, spare: 8 });
    const sent = send(start, 'patrol', ['hero-1'], 'cautious', 0);
    const returnsAt = advanceTo(sent.state, 6 * HOUR);
    const edda = heroOf(returnsAt.state, 'hero-1');
    // Voltou para o feudo (inteira ou ferida): é a equipe que voltou.
    expect(['idle', 'injured']).toContain(edda.status);
    expect(edda.equipment.weapon?.condition).toBe(9);
    expect(heroOf(returnsAt.state, 'hero-2').equipment.armor?.condition).toBe(8);
    expect(returnsAt.state.guild.inventory[0]?.condition).toBe(8);
    const returned = returnsAt.events.find((event) => event.type === 'expeditionReturned');
    expect(returned).toBeDefined();
    expect(returnsAt.events.filter((event) => event.type === 'itemWorn')).toEqual([]);
  });

  it('o desgaste conta no fim da expedição e não antes: com a equipe ainda na estrada o item está como saiu', () => {
    const start = company({ edda: 10, rolf: 8, spare: 8 });
    const sent = send(start, 'patrol', ['hero-1'], 'cautious', 0);
    const afterSent = advanceTo(sent.state, 1);
    expect(heroOf(afterSent.state, 'hero-1').equipment.weapon?.condition).toBe(10);
    const done = advanceTo(sent.state, 6 * HOUR);
    const returnedAt = done.events.find((event) => event.type === 'expeditionReturned')?.atMs ?? -1;
    expect(returnedAt).toBeGreaterThan(0);
    const justBefore = advanceTo(sent.state, returnedAt - 1);
    expect(heroOf(justBefore.state, 'hero-1').equipment.weapon?.condition).toBe(10);
    const atReturn = advanceTo(justBefore.state, returnedAt);
    expect(heroOf(atReturn.state, 'hero-1').equipment.weapon?.condition).toBe(9);
  });

  it('o item que chega a 0 na volta ganha uma linha na Crônica, e continua com o herói, sem bônus', () => {
    const start = company({ edda: 1, rolf: 8, spare: 8 });
    const sent = send(start, 'patrol', ['hero-1'], 'cautious', 0);
    const { state, events } = advanceTo(sent.state, 6 * HOUR);
    const edda = heroOf(state, 'hero-1');
    expect(edda.equipment.weapon).toEqual({ id: 'item-1', defId: 'ashBow', condition: 0 });
    const lines = events.filter((event) => event.type === 'itemWorn');
    expect(lines).toHaveLength(1);
    expect(lines[0]?.data).toMatchObject({ heroId: 'hero-1', itemId: 'item-1' });
    expect(lines[0]?.text).toContain('Arco de freixo');
    // Em 0, uma volta a mais não gasta mais nada nem repete a linha.
    const again = send(
      advanceTo(state, state.lastProcessedAt + 3 * HOUR).state,
      'patrol',
      ['hero-1'],
      'cautious',
      0,
    );
    const second = advanceTo(again.state, again.state.lastProcessedAt + 6 * HOUR);
    expect(heroOf(second.state, 'hero-1').equipment.weapon?.condition).toBe(0);
    expect(second.events.filter((event) => event.type === 'itemWorn')).toEqual([]);
  });

  it('o item em 0 não dá bônus no poder, a ficha diz que está gasto, e o reparo devolve o bônus', () => {
    const fresh = company({ edda: 10, rolf: 8, spare: 8 });
    const spent = company({ edda: 0, rolf: 8, spare: 8 });
    const bare = guildHall(0, (draft) => addHero(draft, { level: 4 }), { seed: 'desgaste' });
    const edda = (state: GameState) => heroOf(state, 'hero-1');
    expect(heroPower(edda(spent))).toBe(heroPower(edda(bare)));
    expect(heroPower(edda(fresh))).toBeGreaterThan(heroPower(edda(spent)));

    const view = deriveViewState(spent, spent.lastProcessedAt, { timeScale: 1 });
    const sheet = view.guild.heroes[0];
    expect(sheet?.powerBreakdown).toContain('arco de freixo gasto, sem bônus');
    expect(sheet?.equipment[0]?.item).toMatchObject({
      worn: true,
      condition: 0,
      durability: 10,
      conditionText: 'Gasto: não dá bônus até o Ferreiro repará-lo.',
    });
    const whole = deriveViewState(fresh, fresh.lastProcessedAt, { timeScale: 1 });
    expect(whole.guild.heroes[0]?.equipment[0]?.item).toMatchObject({
      worn: false,
      conditionText: 'Em perfeito estado.',
    });
    expect(whole.guild.heroes[0]?.powerBreakdown).not.toContain('gasto');
    const partial = company({ edda: 4, rolf: 8, spare: 8 });
    const partialView = deriveViewState(partial, partial.lastProcessedAt, { timeScale: 1 });
    expect(partialView.guild.heroes[0]?.equipment[0]?.item?.conditionText).toBe(
      'Condição: 4 de 10 usos.',
    );

    // Edda larga o arco gasto no arsenal, o Ferreiro o refaz e ela o põe de volta.
    let state = accept(spent, command('unequipItem', { heroId: 'hero-1', slot: 'weapon' })).state;
    state = accept(state, command('repairItem', { itemId: 'item-1' })).state;
    state = advanceTo(state, state.lastProcessedAt + 20 * MINUTE).state;
    state = accept(state, command('equipItem', { heroId: 'hero-1', itemId: 'item-1' })).state;
    expect(heroPower(edda(state))).toBe(heroPower(edda(fresh)));
  });

  it('a expedição perdida não gasta o item que não voltou, e a recolhida antes do fim não conta', () => {
    // Uma equipe só pode ser "recolhida" quando o conteúdo deixa de ter o nó: o desgaste exige a
    // expedição concluída. O caso da perda (herói que não volta) é provado em `outcomes.test.ts`:
    // o item do cativo não é cobrado.
    const start = company({ edda: 10, rolf: 8, spare: 8 });
    expect(balance.equipment.wearPerExpedition).toBe(1);
    expect(start.guild.heroes[0]?.equipment.weapon?.condition).toBe(10);
  });
});

describe('o Ferreiro na visão: o que se pode reparar e por quê', () => {
  it('lista o item gasto do arsenal com custo e prazo, e o que um herói leva com o motivo', () => {
    const state = smithyStall(0, (draft) => {
      addHero(draft);
      const [edda] = draft.guild.heroes as [Hero];
      worn(wear(draft, edda, 'veltharBlade'), 4);
      worn(giveItem(draft, 'ashBow'), 3);
      giveItem(draft, 'luckyCharm');
    });
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 });
    const offer = view.smithy.repairOffer.items;
    // O Amuleto está inteiro e não entra; o Arco está no arsenal; a Lâmina, com Edda.
    expect(offer.map((entry) => entry.label)).toEqual(['Arco de freixo', "Lâmina de Vel'Thar"]);
    expect(offer[0]).toMatchObject({
      itemId: 'item-2',
      points: 7,
      ironCost: 7,
      costText: '7 de ferro',
      // 7 pontos × 2 min de jogo, ao ritmo 3.
      seconds: Math.ceil((14 * 60) / 3),
      heroName: null,
      canRepair: true,
      blockedReason: null,
    });
    expect(offer[1]).toMatchObject({
      points: 10,
      ironCost: 20,
      heroName: 'Edda',
      canRepair: false,
    });
    expect(offer[1]?.blockedReason).toContain('Edda');
    expect(view.smithy.forge).toBeNull();

    const repairing = accept(state, command('repairItem', { itemId: 'item-2' })).state;
    const busy = deriveViewState(repairing, repairing.lastProcessedAt, { timeScale: 3 });
    expect(busy.smithy.forge).toMatchObject({
      kind: 'repair',
      amount: 7,
      label: 'Reparo de Arco de freixo: 7 pontos',
    });
    // Com a forja ocupada nenhum item pode ir; o que está na bancada já não está na lista.
    expect(busy.smithy.repairOffer.items.map((entry) => entry.canRepair)).toEqual([false]);
    expect(busy.smithy.repairOffer.items[0]?.blockedReason).toContain('ocupada');
  });

  it('aponta o ferro que falta e a falta do Ferreiro', () => {
    const poor = bench(0, (draft) => {
      draft.settlement.resources.iron = 4 * MILLI;
    });
    const view = deriveViewState(poor, poor.lastProcessedAt, { timeScale: 1 });
    expect(view.smithy.repairOffer.items[0]?.blockedReason).toBe(
      'Faltam 6 de ferro para o reparo de Arco de freixo.',
    );
    const none = guildHall(0, (draft) => worn(giveItem(draft, 'ashBow'), 3));
    const bare = deriveViewState(none, none.lastProcessedAt, { timeScale: 1 });
    expect(bare.smithy.repairOffer.items[0]?.blockedReason).toBe('Sem o Ferreiro não há reparo.');
  });

  it('a névoa não muda: a visão e o instante seguinte não mexem no gerador nem nos contadores', () => {
    const repairing = accept(bench(3), command('repairItem', { itemId: 'item-1' })).state;
    const before = JSON.stringify([repairing.rng, repairing.ids]);
    deriveViewState(repairing, repairing.lastProcessedAt, { timeScale: 1 });
    nextEventAt(repairing);
    expect(JSON.stringify([repairing.rng, repairing.ids])).toBe(before);
    expect(applyCommand(repairing, command('cancelForge', {}), 0).ok).toBe(false);
  });
});
