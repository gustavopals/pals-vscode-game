import {
  balance,
  type ExpeditionOutcomeId,
  type ExpeditionNode,
  type ExpeditionReward,
  type ExpeditionStageNode,
  expeditionModels,
  relics,
  type RelicId,
} from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { destinationBlock, modelOf, outcomeOf, powerAgainst } from './expeditions';
import { currentShape } from './migrations';
import { entityStream, nextInt } from './random';
import { grantRelic } from './relics';
import { cloneState } from './state';
import {
  addHero,
  command,
  refuse,
  expeditionAtNode,
  guildHall,
  quietCouncil,
  quietHorde,
  send,
  HOUR,
} from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';

const LEGENDARY = ['ancestralVault', 'hermitsRefuge'] as const;
const LISTS = {
  ancestralVault: ['ancestralHorn', 'watchersEye', 'ancientKingsSeal', 'saltStone'],
  hermitsRefuge: ['oakHeart', 'hermitsLamp', 'wintersCloak'],
  whiteWolfHunt: ['wolfBone'],
} as const;
const STREAM = entityStream('expedition', 'expedition-1');

function ready(modelId: keyof typeof LISTS, seed = 'reliquia-certa'): GameState {
  return guildHall(
    0,
    (draft) => {
      quietCouncil(draft);
      quietHorde(draft);
      draft.settlement.buildings.chapel = modelId === 'whiteWolfHunt' ? 0 : 1;
      draft.settlement.resources.gold = 200_000;
      for (const classId of ['warrior', 'archer', 'mage'] as const) {
        addHero(draft, { classId, level: 2 });
      }
      if (modelId === 'whiteWolfHunt') {
        draft.map.discovered.push(modelId);
        draft.map.expeditionUnlocks[modelId] = 10 * HOUR;
      }
    },
    { level: 4, seed },
  );
}

/** Põe um desfecho exato no último nó com prova, pelo poder real e pela próxima sorte. */
function atTrial(
  modelId: keyof typeof LISTS,
  variant: number,
  outcome: ExpeditionOutcomeId,
  nodeId = modelId === 'whiteWolfHunt' ? 'whiteWolf' : 'sideKeeper',
  initial = ready(modelId),
): { state: GameState; endsAt: number; node: ExpeditionStageNode } {
  const ids = initial.guild.heroes.slice(0, 2).map((hero) => hero.id);
  const sent = send(initial, modelId, ids, 'balanced', variant).state;
  const { state, endsAt } = expeditionAtNode(sent, nodeId);
  const expedition = state.guild.expeditions[0]!;
  const node = modelOf(modelId)!.variants[variant]!.nodes[nodeId] as ExpeditionStageNode;
  const trial = node.trial!;
  for (let size = 1; size <= 2; size += 1) {
    for (let level = 1; level <= balance.heroes.maxLevel; level += 1) {
      expedition.heroIds = ids.slice(0, size);
      for (const hero of state.guild.heroes) {
        hero.level = level;
        hero.status = expedition.heroIds.includes(hero.id) ? 'expedition' : 'idle';
      }
      const team = state.guild.heroes.filter((hero) => hero.status === 'expedition');
      for (let word = 1; word < 200; word += 1) {
        const probe = cloneState(state);
        probe.rng[STREAM] = [1, word, 3, 4];
        const luck = balance.expeditions.luck.min + nextInt(probe, STREAM, 31);
        if (outcomeOf(powerAgainst(team, trial, 'balanced'), luck, trial.difficulty) === outcome) {
          state.rng[STREAM] = [1, word, 3, 4];
          return { state, endsAt, node };
        }
      }
    }
  }
  throw new Error(`Desfecho inalcançável: ${modelId}/${nodeId}/${outcome}.`);
}

const cases = LEGENDARY.flatMap((id) => [0, 1, 2].map((variant) => [id, variant] as const));

describe('expedições lendárias (ADR 0022, D-6/D-7)', () => {
  it.each(LEGENDARY)('%s: Ano 1, recusa da Capela e da Guilda na visão e na ordem', (id) => {
    const state = ready(id);
    state.settlement.buildings.guild = 3;
    expect(destinationBlock(state, id)).toMatchObject({
      code: 'EXPEDITION_LOCKED',
      message: expect.stringContaining('nível 4'),
    });
    state.settlement.buildings.guild = 4;
    state.settlement.buildings.chapel = 0;
    expect(destinationBlock(state, id)).toMatchObject({
      code: 'EXPEDITION_LOCKED',
      message: expect.stringContaining('Capela'),
    });
    expect(
      refuse(
        state,
        command('sendExpedition', {
          modelId: id,
          heroIds: ['hero-1', 'hero-2'],
          posture: 'balanced',
        }),
      ),
    ).toMatchObject({ code: 'EXPEDITION_LOCKED', message: expect.stringContaining('Capela') });
    const offer = deriveViewState(state, 0).guild.available.find((entry) => entry.modelId === id)!;
    expect(offer).toMatchObject({ locked: true, lockedReason: expect.stringContaining('Capela') });
    expect(offer.requirementsText).toContain('nível 4');
    expect(offer.requirementsText).toContain('Capela erguida');
    state.settlement.buildings.chapel = 1;
    expect(destinationBlock(state, id)).toBeNull();
    const sent = send(state, id, ['hero-1', 'hero-2']);
    expect(sent.state.guild.expeditions).toHaveLength(1);
    expect(sent.state.rng).toEqual(state.rng);
  });

  it.each(cases)(
    '%s/%i: cada Sucesso entrega a próxima da lista, sem repetir nem sortear',
    (id, variant) => {
      let initial = ready(id);
      for (const expected of LISTS[id]) {
        const { state, endsAt } = atTrial(id, variant, 'success', undefined, initial);
        const before = cloneState(state).settlement.relics;
        const result = advanceTo(state, endsAt);
        expect(result.state.guild.expeditions[0]?.log.at(-1)?.outcome).toBe('success');
        expect(result.state.settlement.relics).toEqual([
          ...before,
          { defId: expected, placed: false, effectiveFromMs: null },
        ]);
        expect(result.events.filter((event) => event.type === 'relicFound')).toMatchObject([
          { data: { relicId: expected }, text: expect.stringContaining(relics[expected].label) },
        ]);
        expect(result.state.guild.expeditions[0]?.log.at(-1)?.found).toEqual([expected]);
        expect(currentShape(result.state, '$')).toBeNull();
        const returned = advanceTo(result.state, result.state.guild.expeditions[0]!.nodeEndsAtMs!);
        const report = deriveViewState(returned.state, returned.state.lastProcessedAt).guild
          .reports[0]!;
        expect(report.log.flatMap((entry) => entry.notes)).toContain(
          `Relíquia encontrada: ${relics[expected].label}.`,
        );
        expect(report.deedsText).toContain(relics[expected].label);
        expect(currentShape(returned.state, '$')).toBeNull();
        // O próximo envio usa a coleção obtida; conceder não coloca automaticamente na Capela.
        initial = ready(id);
        initial.settlement.relics = cloneState(returned.state).settlement.relics;
      }
    },
  );

  it.each(cases)('%s/%i: Sucesso pleno também entrega, no guardião ousado', (id, variant) => {
    const { state, endsAt } = atTrial(id, variant, 'full', 'sealedGuardian');
    const result = advanceTo(state, endsAt);
    expect(result.state.settlement.relics[0]?.defId).toBe(LISTS[id][0]);
  });

  it.each(cases)(
    '%s/%i: mudar só o outro lado da encruzilhada preserva a visão inteira',
    (id, index) => {
      const initial = ready(id);
      const sent = send(initial, id, ['hero-1', 'hero-2'], 'balanced', index);
      const waiting = advanceTo(sent.state, sent.expedition.nodeEndsAtMs!);
      expect(waiting.state.guild.expeditions[0]!.status).toBe('atCrossroads');
      const snapshots = [initial, sent.state, waiting.state].map((state) =>
        deriveViewState(state, state.lastProcessedAt),
      );
      const nodes = modelOf(id)!.variants[index]!.nodes as Record<string, ExpeditionNode>;
      const hidden = ['sealedGuardian', 'sideKeeper', 'home'];
      const saved = hidden.map((key) => nodes[key]!);
      try {
        for (const key of hidden) {
          const node = nodes[key]!;
          if (node.kind === 'crossroads') throw new Error('Nó oculto inesperado.');
          nodes[key] =
            node.kind === 'return'
              ? {
                  ...node,
                  title: 'Retorno oculto',
                  text: 'Segredo da volta.',
                  durationMs: 12345,
                }
              : {
                  ...node,
                  title: 'Prova oculta',
                  durationMs: 98765,
                  ...(node.trial
                    ? {
                        trial: { ...node.trial, difficulty: 9999 },
                        rewards: { relic: { from: ['wolfBone'], consolationGold: 777 } },
                      }
                    : {}),
                };
        }
        const after = [initial, sent.state, waiting.state].map((state) =>
          deriveViewState(state, state.lastProcessedAt),
        );
        expect(after).toEqual(snapshots);
      } finally {
        hidden.forEach((key, at) => {
          nodes[key] = saved[at]!;
        });
      }
    },
  );

  it.each(LEGENDARY)('%s: considera guardadas, colocadas e adquiridas fora da ordem', (id) => {
    const initial = ready(id);
    const list: readonly RelicId[] = LISTS[id];
    grantRelic(initial, list[0]!, 0, []);
    grantRelic(initial, list[2]!, 0, []);
    initial.settlement.relics[0]!.placed = true;
    initial.settlement.relics[0]!.effectiveFromMs = 7_200_000;
    const { state, endsAt } = atTrial(id, 0, 'success', undefined, initial);
    expect(advanceTo(state, endsAt).state.settlement.relics.at(-1)?.defId).toBe(list[1]);
  });

  it.each(['success', 'full'] as const)(
    '%s: lista completa rende consolo fixo, sem cobiça nem sorteio novo',
    (outcome) => {
      for (const id of [...LEGENDARY, 'whiteWolfHunt'] as const) {
        const initial = ready(id);
        for (const relic of LISTS[id]) grantRelic(initial, relic, 0, []);
        const { state, endsAt, node } = atTrial(id, 0, outcome, undefined, initial);
        const without = cloneState(state);
        const reward = node.rewards as { relic?: ExpeditionReward['relic'] };
        const saved = reward.relic;
        let control;
        try {
          delete reward.relic;
          control = advanceTo(without, endsAt);
        } finally {
          reward.relic = saved;
        }
        const result = advanceTo(state, endsAt);
        expect(result.state.rng).toEqual(control.state.rng);
        expect(result.state.guild.expeditions[0]!.loot.resources.gold).toBe(
          control.state.guild.expeditions[0]!.loot.resources.gold + 100,
        );
        expect(result.events.filter((event) => event.type === 'relicFound')).toEqual([]);
        expect(result.state.settlement.relics).toEqual(initial.settlement.relics);
        expect(
          deriveViewState(result.state, endsAt).guild.expeditions[0]!.log.flatMap(
            (entry) => entry.notes,
          ),
        ).toContain('O feudo já possui todas as relíquias deste destino: consolo de 100 de ouro.');
      }
    },
  );

  it.each(cases)('%s/%i: Revés e Desastre não entregam relíquia nem consolo', (id, variant) => {
    for (const outcome of ['setback', 'disaster'] as const) {
      const { state, endsAt } = atTrial(id, variant, outcome);
      const result = advanceTo(state, endsAt);
      expect(result.state.settlement.relics).toEqual([]);
      expect(result.events.some((event) => event.type === 'relicFound')).toBe(false);
    }
  });

  it.each(LEGENDARY)(
    '%s: cobiça pode perder o saque comum, mas preserva relíquia e consolo',
    (id) => {
      const { state, endsAt } = atTrial(id, 0, 'success');
      state.guild.heroes[0]!.traits = ['greedy'];
      let foundLoss = false;
      for (let word = 1; word < 200; word += 1) {
        state.rng[STREAM] = [1, word, 3, 4];
        const result = advanceTo(state, endsAt);
        const entry = result.state.guild.expeditions[0]!.log.at(-1)!;
        if (!entry.lootLost || !['success', 'full'].includes(entry.outcome)) continue;
        expect(result.state.settlement.relics[0]?.defId).toBe(LISTS[id][0]);
        const owned = cloneState(state);
        for (const relic of LISTS[id]) grantRelic(owned, relic, 0, []);
        const consolation = advanceTo(owned, endsAt);
        expect(consolation.state.guild.expeditions[0]!.log.at(-1)).toMatchObject({
          lootLost: true,
          gained: { gold: 100 },
        });
        expect(consolation.state.rng).toEqual(result.state.rng);
        foundLoss = true;
        break;
      }
      expect(foundLoss).toBe(true);
    },
  );

  it.each(LEGENDARY)(
    '%s: dividir o avanço em volta do nó preserva estado, eventos e gerador',
    (id) => {
      const { state, endsAt } = atTrial(id, 0, 'success');
      const whole = advanceTo(state, endsAt);
      const before = advanceTo(state, endsAt - 1);
      const split = advanceTo(before.state, endsAt);
      expect(split.state).toEqual(whole.state);
      expect([...before.events, ...split.events]).toEqual(whole.events);
    },
  );

  it('duas equipes que vencem no mesmo instante recebem relíquias diferentes, em ordem', () => {
    const initial = ready('ancestralVault');
    const { state, endsAt } = atTrial('ancestralVault', 0, 'full', undefined, initial);
    const extra = addHero(state, { level: 10 });
    extra.status = 'expedition';
    const companion = addHero(state, { level: 10 });
    companion.status = 'expedition';
    state.ids.expedition = (state.ids.expedition ?? 0) + 1;
    state.guild.expeditions.push({
      ...cloneState(state).guild.expeditions[0]!,
      id: 'expedition-2',
      heroIds: [extra.id, companion.id],
    });
    const result = advanceTo(state, endsAt);
    expect(result.state.settlement.relics.map((relic) => relic.defId)).toEqual([
      'ancestralHorn',
      'watchersEye',
    ]);
  });
});

describe('Lobo Branco e sorteios preservados', () => {
  it.each([0, 1, 2])(
    'variante %i: Osso de Lobo sem Capela e sem gastar nem um sorteio extra',
    (variant) => {
      const { state, endsAt, node } = atTrial('whiteWolfHunt', variant, 'success');
      const reward = node.rewards as { relic?: ExpeditionReward['relic'] };
      const saved = reward.relic;
      let control;
      try {
        delete reward.relic;
        control = advanceTo(state, endsAt);
      } finally {
        reward.relic = saved;
      }
      const result = advanceTo(state, endsAt);
      expect(result.state.settlement.relics[0]?.defId).toBe('wolfBone');
      expect(result.state.rng).toEqual(control.state.rng);
      expect(result.state.ids).toEqual(control.state.ids);
      expect(result.events.filter((event) => event.type !== 'relicFound')).toEqual(control.events);
    },
  );

  it.each(cases)(
    '%s/%i: coleção vazia ou completa não desloca sorte, cobiça ou quantidades',
    (id, variant) => {
      const { state, endsAt } = atTrial(id, variant, 'success');
      state.guild.heroes[0]!.traits.push('greedy');
      const owned = cloneState(state);
      for (const relic of LISTS[id]) grantRelic(owned, relic, 0, []);
      const found = advanceTo(state, endsAt);
      const consolation = advanceTo(owned, endsAt);
      expect(found.state.rng).toEqual(consolation.state.rng);
      expect(found.state.guild.expeditions[0]!.log.at(-1)?.outcome).toBe(
        consolation.state.guild.expeditions[0]!.log.at(-1)?.outcome,
      );
    },
  );

  it('os modelos publicados conservam três variantes e não recebem requisito lendário', () => {
    for (const model of expeditionModels.filter(
      (entry) => !LEGENDARY.some((id) => id === entry.id),
    )) {
      expect(model.variants).toHaveLength(3);
      expect(model.requires.chapel).toBeUndefined();
    }
  });
});
