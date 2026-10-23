import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import {
  accept,
  barracksYard,
  command,
  formationPosts,
  formationYard,
  refuse,
  saveFormationOrder,
} from './test-helpers';
import { riskText } from './warCouncilView';
import { previewInputFor } from './warCouncilOrders';
import { deriveViewState } from './view';
import type { GameState } from './types';

const SOLDIERS = (draft: GameState) => {
  draft.army.units.spearman = 6;
  draft.army.units.archer = 4;
  draft.army.units.swordsman = 5;
};

const simulate = (formationId: string) => command('simulateBattle', { formationId });

/** O Quartel com soldados e a "Formação 1" salva. */
const yard = (count = 1) => formationYard(count, null, SOLDIERS);

describe('simulateBattle (V4D-T2.2)', () => {
  it('recusa a formação que não existe e o Quartel que falta, com frase legível', () => {
    const missing = refuse(yard(), simulate('formation-9'));
    expect(missing.code).toBe('FORMATION_NOT_FOUND');
    expect(missing.message).toMatch(/formação/);
    const noBarracks = yard();
    noBarracks.settlement.buildings.barracks = 0;
    const refused = refuse(noBarracks, simulate('formation-1'));
    expect(refused.code).toBe('BARRACKS_REQUIRED');
    expect(refused.message.length).toBeGreaterThan(10);
  });

  it('grava a prévia, conta a simulação e esconde a linha da Crônica no tipo', () => {
    const before = yard();
    const { state, events } = accept(before, simulate('formation-1'));
    const preview = state.army.preview;
    expect(preview).not.toBeNull();
    expect(preview?.formationId).toBe('formation-1');
    expect(preview?.atMs).toBe(before.lastProcessedAt);
    expect(preview?.runs).toBe(200);
    expect((preview?.wins ?? 0) + (preview?.losses ?? 0)).toBe(200);
    expect(preview?.glorious).toBeLessThanOrEqual(preview?.wins ?? 0);
    expect(preview?.enemy.every((post) => !post.known)).toBe(true);
    expect(state.stats.battlesSimulated).toBe(1);
    expect(events.map((event) => event.type)).toEqual(['battleSimulated']);
  });

  it('não sorteia no fluxo do estado nem cria entidade', () => {
    const before = yard();
    const { state } = accept(before, simulate('formation-1'));
    expect(state.rng).toEqual(before.rng);
    expect(state.ids).toEqual(before.ids);
    expect(state.army.formations).toEqual(before.army.formations);
    expect(state.army.units).toEqual(before.army.units);
  });

  it('repetir dá o mesmo resultado, e a nova substitui a anterior (uma por vez)', () => {
    const first = accept(yard(2), simulate('formation-1')).state;
    const again = accept(first, simulate('formation-1')).state;
    expect({ ...again.army.preview, atMs: 0 }).toEqual({ ...first.army.preview, atMs: 0 });
    expect(again.stats.battlesSimulated).toBe(2);
    const other = accept(again, simulate('formation-2')).state;
    expect(other.army.preview?.formationId).toBe('formation-2');
  });

  it('a visão traz os percentuais, o risco em uma frase e o inimigo com ?', () => {
    const { state } = accept(yard(), simulate('formation-1'));
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army;
    const preview = view.preview;
    expect(preview).not.toBeNull();
    expect((preview?.winsPercent ?? 0) + (preview?.lossesPercent ?? 0)).toBe(100);
    expect(preview?.gloriousPercent).toBeLessThanOrEqual(preview?.winsPercent ?? 0);
    expect(preview?.riskText.length).toBeGreaterThan(10);
    expect(preview?.knownEnemy.length).toBeGreaterThan(0);
    expect(preview?.knownEnemy.every((post) => post.text.endsWith(' ?'))).toBe(true);
    expect(preview?.expectedLosses.map((post) => post.unit)).toContain('spearman');
    expect(view.formations[0]?.previewStale).toBe(false);
  });

  it('a formação que muda depois da prévia fica desatualizada; só a dela', () => {
    const simulated = accept(yard(2), simulate('formation-1')).state;
    const edited = accept(
      simulated,
      saveFormationOrder('Formação 1', {
        id: 'formation-1',
        posts: formationPosts((posts) => {
          posts.right.front = { unit: 'knight', count: 2 };
        }),
      }),
    ).state;
    const view = deriveViewState(edited, edited.lastProcessedAt, { timeScale: 3 }).army;
    expect(view.formations.map((formation) => formation.previewStale)).toEqual([true, false]);
    // Renomear não muda o conteúdo.
    const renamed = accept(
      simulated,
      saveFormationOrder('Outro nome', { id: 'formation-1' }),
    ).state;
    const renamedView = deriveViewState(renamed, renamed.lastProcessedAt, { timeScale: 3 }).army;
    expect(renamedView.formations[0]?.previewStale).toBe(false);
  });

  it('apagar a formação da prévia apaga a prévia', () => {
    const simulated = accept(yard(2), simulate('formation-2')).state;
    const { state } = accept(simulated, command('deleteFormation', { id: 'formation-2' }));
    expect(state.army.preview).toBeNull();
  });

  it('a prévia sem soldados diz que não há tropa, e a Derrota é de 100%', () => {
    const naked = accept(barracksYard(), saveFormationOrder()).state;
    const { state } = accept(naked, simulate('formation-1'));
    const view = deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army.preview;
    expect(view?.lossesPercent).toBe(100);
    expect(view?.riskText).toMatch(/soldado nenhum/);
  });

  it('a prévia sobrevive ao avanço do tempo, sem alterar o gerador do estado', () => {
    const { state } = accept(yard(), simulate('formation-1'));
    const later = advanceTo(state, state.lastProcessedAt + 3_600_000).state;
    expect(later.army.preview).toEqual(state.army.preview);
  });
});

describe('a prévia não vaza a Ameaça (V4D-T5)', () => {
  const enemyAt = (threat: number, tower: number) => {
    const state = yard();
    state.map.threat = threat;
    state.settlement.buildings.watchtower = tower;
    const formation = state.army.formations[0];
    if (formation === undefined) {
      throw new Error('sem formação');
    }
    return previewInputFor(state, formation).enemy;
  };

  it('sem Torre de Vigia, Ameaça 0 e 100 dão a mesma prévia', () => {
    expect(enemyAt(100, 0)).toEqual(enemyAt(0, 0));
  });

  it('com Torre, a Ameaça alta dá a incursão média', () => {
    expect(enemyAt(100, 1)).not.toEqual(enemyAt(0, 1));
  });
});

describe('a frase do risco (V4D-T5)', () => {
  const base = accept(yard(), simulate('formation-1')).state.army.preview;
  const withRisk = (factor: string, wing: 'left' | null) => {
    if (base === null) {
      throw new Error('sem prévia');
    }
    return { ...base, risk: { factor, wing, amount: 10 } } as unknown as typeof base;
  };

  it('nunca começa por vírgula, com ala ou sem ela', () => {
    for (const factor of ['wallAbsorbed', 'counter', 'exposedRear', 'flank', 'tower', 'aura']) {
      for (const wing of ['left', null] as const) {
        const text = riskText(withRisk(factor, wing), true);
        expect(text).toMatch(/^Risco principal: [A-ZÀ-Ý]/);
      }
    }
  });

  it('a aura de uma ala só é a do Xamã; a do exército, a do chefe', () => {
    expect(riskText(withRisk('aura', 'left'), true)).toMatch(/Xamã/);
    expect(riskText(withRisk('aura', null), true)).toMatch(/chefe da Horda/);
  });
});

describe('previewStale (V4D-T5)', () => {
  const staleOf = (state: GameState) =>
    deriveViewState(state, state.lastProcessedAt, { timeScale: 3 }).army.formations[0]
      ?.previewStale;

  it('dispensar ou treinar soldados da formação, e a Torre, desatualizam a prévia', () => {
    const simulated = accept(yard(), simulate('formation-1')).state;
    expect(staleOf(simulated)).toBe(false);
    const dismissed = structuredClone(simulated);
    dismissed.army.units.spearman -= 1;
    expect(staleOf(dismissed)).toBe(true);
    const tower = structuredClone(simulated);
    tower.settlement.buildings.watchtower += 1;
    expect(staleOf(tower)).toBe(true);
  });

  it('uma unidade que a formação não usa não desatualiza', () => {
    const simulated = accept(yard(), simulate('formation-1')).state;
    const other = structuredClone(simulated);
    other.army.units.knight += 3;
    expect(staleOf(other)).toBe(false);
  });
});
