import { siegeTexts, warCouncilTexts } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { revealWaveThree } from './hordePlan';
import { currentShape } from './migrations';
import { readySiege } from './siege.test-helpers';
import {
  accept,
  barracksYard,
  command,
  formationPosts,
  formationYard,
  refuse,
  saveFormationOrder,
} from './test-helpers';
import { cloneState } from './state';
import { riskText } from './warCouncilView';
import { formationSignature, previewInputFor } from './warCouncilOrders';
import { deriveViewState } from './view';
import type { GameState, SiegeWaveNumber } from './types';

const SOLDIERS = (draft: GameState) => {
  draft.army.units.spearman = 6;
  draft.army.units.archer = 4;
  draft.army.units.swordsman = 5;
};

const simulate = (formationId: string, siegeWave?: SiegeWaveNumber) =>
  command('simulateBattle', siegeWave === undefined ? { formationId } : { formationId, siegeWave });

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

describe('informação pública da Horda na prévia (V4E-T3)', () => {
  const formationOf = (state: GameState) => state.army.formations[0]!;

  it('memória, sorteios e ondas escondidas diferentes dão a mesma entrada e assinatura', () => {
    const before = yard();
    const hidden = cloneState(before);
    hidden.horde.lastFormationSeen = { total: 20, byUnit: { archer: 20 } };
    hidden.horde.wavePlan = {
      year: 1,
      revision: 3,
      generatedAtMs: before.lastProcessedAt,
      waves: [1, 2, 3].map((number) => ({
        number: number as 1 | 2 | 3,
        composition: [{ wing: 'left', line: 'front', unit: 'wolf', count: 30 }],
      })),
    };
    hidden.rng.horde = [1, 2, 3, 4];
    expect(previewInputFor(hidden, formationOf(hidden))).toEqual(
      previewInputFor(before, formationOf(before)),
    );
    expect(formationSignature(hidden, formationOf(hidden))).toBe(
      formationSignature(before, formationOf(before)),
    );
  });

  it('um presságio de onda não muda a prévia da incursão comum, de clareza nenhuma (D-45b)', () => {
    // Antes da revisão o último presságio (de uma onda do Cerco, até 105 inimigos) virava o
    // inimigo conhecido da próxima incursão comum, e o parcial misturava um posto da onda com a
    // estimativa.
    const state = yard();
    const initial = previewInputFor(state, formationOf(state));
    const omens = [
      {
        atMs: state.lastProcessedAt,
        revision: 1,
        clarity: 'partial' as const,
        wave: 2 as const,
        text: 'Cerca de 15 lobos à esquerda.',
        reveals: [
          { wing: 'left' as const, line: 'front' as const, unit: 'wolf' as const, count: 15 },
        ],
      },
      {
        atMs: state.lastProcessedAt,
        revision: 1,
        clarity: 'exact' as const,
        wave: 3 as const,
        text: 'Um Senhor da Guerra no centro.',
        reveals: [
          { wing: 'center' as const, line: 'front' as const, unit: 'warlord' as const, count: 1 },
        ],
      },
    ];
    for (const omen of omens) {
      const seen = cloneState(state);
      seen.horde.omens = [omen];
      expect(previewInputFor(seen, formationOf(seen))).toEqual(initial);
      expect(formationSignature(seen, formationOf(seen))).toBe(
        formationSignature(state, formationOf(state)),
      );
    }
  });

  it('no Nv3, tipos iguais em postos e contagens escondidas diferentes não mudam a prévia', () => {
    const state = yard();
    state.settlement.buildings.watchtower = 3;
    state.horde.scheduledRaids = [
      {
        id: 'threat-1',
        kind: 'threat',
        enemy: 'horde',
        size: 'strong',
        atMs: state.lastProcessedAt + 1,
        announcedAtMs: state.lastProcessedAt,
        composition: [
          { wing: 'left', line: 'front', unit: 'wolf', count: 10 },
          { wing: 'right', line: 'front', unit: 'raider', count: 20 },
        ],
      },
    ];
    const hidden = cloneState(state);
    hidden.horde.scheduledRaids[0]!.composition = [
      { wing: 'center', line: 'front', unit: 'raider', count: 1 },
      { wing: 'right', line: 'front', unit: 'wolf', count: 40 },
    ];
    expect(previewInputFor(state, formationOf(state))).toEqual(
      previewInputFor(hidden, formationOf(hidden)),
    );
  });

  it('a ordem das chaves de JSONB não envelhece a assinatura da formação', () => {
    const state = yard();
    const formation = formationOf(state);
    const original = formationSignature(state, formation);
    for (const wing of ['left', 'center', 'right'] as const) {
      for (const line of ['front', 'back'] as const) {
        const post = formation.posts[wing][line];
        if (post !== null) formation.posts[wing][line] = { count: post.count, unit: post.unit };
      }
    }
    expect(formationSignature(state, formation)).toBe(original);
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
    const dismissed = cloneState(simulated);
    dismissed.army.units.spearman -= 1;
    expect(staleOf(dismissed)).toBe(true);
    const tower = cloneState(simulated);
    tower.settlement.buildings.watchtower += 1;
    expect(staleOf(tower)).toBe(true);
  });

  it('uma unidade que a formação não usa não desatualiza', () => {
    const simulated = accept(yard(), simulate('formation-1')).state;
    const other = cloneState(simulated);
    other.army.units.knight += 3;
    expect(staleOf(other)).toBe(false);
  });
});

describe('prévia de onda do Cerco (V4G-T2.10 · G-16)', () => {
  it('recusa siegeWave fora de 1..3 com INVALID_WAVE', () => {
    for (const bad of [0, 4, -1, '3'] as unknown as SiegeWaveNumber[]) {
      const refused = refuse(yard(), simulate('formation-1', bad));
      expect(refused.code).toBe('INVALID_WAVE');
      expect(refused.message).toBe(siegeTexts.invalidWave);
    }
  });

  it('se a onda não é conhecida (ou só há presságio vago), a prévia diz isso em vez de inventar', () => {
    const state = readySiege();
    state.horde.omens = [
      {
        atMs: state.lastProcessedAt,
        revision: state.horde.wavePlan!.revision,
        clarity: 'vague',
        wave: 3,
        text: 'Um estandarte negro foi visto além do rio: a Horda terá um chefe.',
        reveals: [],
      },
    ];
    const { state: after } = accept(state, simulate('formation-1', 3));
    expect(after.army.preview).toMatchObject({
      formationId: 'formation-1',
      siegeWave: 3,
      runs: 200,
      wins: 0,
      glorious: 0,
      losses: 200,
      risk: null,
      expectedLosses: [],
      enemy: [],
    });
    const view = deriveViewState(after, after.lastProcessedAt).army.preview;
    expect(view).toMatchObject({
      formationId: 'formation-1',
      siegeWave: 3,
      runs: 200,
      winsPercent: 0,
      gloriousPercent: 0,
      lossesPercent: 100,
      riskText: warCouncilTexts.unknownWave,
      expectedLosses: [],
      knownEnemy: [],
    });
    expect(currentShape(after, 'state')).toBeNull();
  });

  it('usa só o que os presságios não vagos da revisão atual e a Torre revelam da onda', () => {
    const state = readySiege();
    state.horde.omens = [
      {
        atMs: state.lastProcessedAt,
        revision: state.horde.wavePlan!.revision,
        clarity: 'partial',
        wave: 3,
        text: 'Cerca de 15 cavaleiros negros pela ala esquerda na terceira noite.',
        reveals: [{ wing: 'left', line: 'front', unit: 'blackKnight', count: 15 }],
      },
    ];
    const partialState = accept(state, simulate('formation-1', 3)).state;
    const partialView = deriveViewState(partialState, partialState.lastProcessedAt).army.preview;
    expect(partialView?.siegeWave).toBe(3);
    expect(partialView?.knownEnemy).toEqual([
      {
        wing: 'left',
        wingLabel: 'Ala esquerda',
        line: 'front',
        lineLabel: 'Frente',
        known: false,
        unitLabel: 'Cavaleiros negros',
        count: 15,
        text: 'Cavaleiros negros ~15 ?',
      },
    ]);

    const exactSource = readySiege();
    revealWaveThree(exactSource, exactSource.lastProcessedAt, []);
    const exactState = accept(exactSource, simulate('formation-1', 3)).state;
    const exactView = deriveViewState(exactState, exactState.lastProcessedAt).army.preview;
    expect(exactView?.siegeWave).toBe(3);
    expect(exactView?.knownEnemy.length).toBeGreaterThan(1);
    expect(exactView?.knownEnemy.every((post) => post.known && !post.text.endsWith(' ?'))).toBe(
      true,
    );
  });

  it('névoa: duas partidas que diferem só na composição oculta dão a mesma visão e a mesma prévia', () => {
    const first = readySiege();
    const second = cloneState(first);
    second.horde.lastFormationSeen = { total: 40, byUnit: { archer: 40 } };
    second.rng.horde = [9, 8, 7, 6];
    second.horde.wavePlan!.waves[2]!.composition = [
      { wing: 'left', line: 'front', unit: 'ogre', count: 90 },
      { wing: 'center', line: 'front', unit: 'warlord', count: 1 },
      { wing: 'right', line: 'back', unit: 'shaman', count: 50 },
    ];
    second.siege!.waves = second.horde.wavePlan!.waves.map((wave) => ({
      ...wave,
      composition: wave.composition.map((post) => ({ ...post })),
    }));

    expect(deriveViewState(first, first.lastProcessedAt)).toEqual(
      deriveViewState(second, second.lastProcessedAt),
    );
    const simUnknownA = accept(first, simulate('formation-1', 3)).state;
    const simUnknownB = accept(second, simulate('formation-1', 3)).state;
    expect(simUnknownA.army.preview).toEqual(simUnknownB.army.preview);
    expect(deriveViewState(simUnknownA, simUnknownA.lastProcessedAt)).toEqual(
      deriveViewState(simUnknownB, simUnknownB.lastProcessedAt),
    );

    const partialOmen = {
      atMs: first.lastProcessedAt,
      revision: first.horde.wavePlan!.revision,
      clarity: 'partial' as const,
      wave: 3 as const,
      text: 'Cerca de 25 cavaleiros negros pela ala esquerda na terceira noite.',
      reveals: [
        { wing: 'left' as const, line: 'front' as const, unit: 'blackKnight' as const, count: 25 },
      ],
    };
    first.horde.omens = [partialOmen];
    second.horde.omens = [{ ...partialOmen, reveals: partialOmen.reveals.map((p) => ({ ...p })) }];

    expect(deriveViewState(first, first.lastProcessedAt)).toEqual(
      deriveViewState(second, second.lastProcessedAt),
    );
    const simPartialA = accept(first, simulate('formation-1', 3)).state;
    const simPartialB = accept(second, simulate('formation-1', 3)).state;
    expect(simPartialA.army.preview).toEqual(simPartialB.army.preview);
    expect(deriveViewState(simPartialA, simPartialA.lastProcessedAt)).toEqual(
      deriveViewState(simPartialB, simPartialB.lastProcessedAt),
    );
  });

  it('previewStale acompanha a onda simulada quando chega presságio novo daquela onda', () => {
    const base = readySiege();
    const simulated = accept(base, simulate('formation-1', 3)).state;
    expect(
      deriveViewState(simulated, simulated.lastProcessedAt).army.formations[0]?.previewStale,
    ).toBe(false);

    const wave2Omen = cloneState(simulated);
    wave2Omen.horde.omens.push({
      atMs: wave2Omen.lastProcessedAt,
      revision: wave2Omen.horde.wavePlan!.revision,
      clarity: 'partial',
      wave: 2,
      text: 'Feras na segunda noite.',
      reveals: [{ wing: 'center', line: 'front', unit: 'wolf', count: 30 }],
    });
    expect(
      deriveViewState(wave2Omen, wave2Omen.lastProcessedAt).army.formations[0]?.previewStale,
    ).toBe(false);

    const wave3Omen = cloneState(simulated);
    revealWaveThree(wave3Omen, wave3Omen.lastProcessedAt, []);
    expect(
      deriveViewState(wave3Omen, wave3Omen.lastProcessedAt).army.formations[0]?.previewStale,
    ).toBe(true);
  });
});
