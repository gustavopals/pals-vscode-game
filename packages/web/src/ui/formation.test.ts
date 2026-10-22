import { describe, expect, it } from 'vitest';

import { armyIdleView } from '../test-helpers';
import {
  draftOf,
  emptyDraft,
  hasSoldiers,
  moveCell,
  postCount,
  savePayload,
  slotText,
  withCommander,
  withPost,
} from './formation';

const army = armyIdleView.army;

describe('o rascunho de formação', () => {
  it('começa vazio, e trocar um posto não muda o rascunho antigo', () => {
    const empty = emptyDraft();
    const next = withPost(empty, 'center', 'front', { unit: 'spearman', count: 4 });
    expect(hasSoldiers(empty)).toBe(false);
    expect(hasSoldiers(next)).toBe(true);
    expect(next.posts.center.front).toEqual({ unit: 'spearman', count: 4 });
    expect(next.posts.left.front).toBeNull();
  });

  it('monta o corpo da ordem com as três alas, as duas linhas e os comandantes', () => {
    let draft = { ...emptyDraft(), name: '  Muralha ' };
    draft = withPost(draft, 'left', 'back', { unit: 'archer', count: 2 });
    draft = withCommander(draft, 'center', 'hero-1');
    const payload = savePayload(draft);
    expect(payload.id).toBeNull();
    expect(payload.name).toBe('Muralha');
    expect(Object.keys(payload.posts)).toEqual(['left', 'center', 'right']);
    expect(payload.posts.left).toEqual({ front: null, back: { unit: 'archer', count: 2 } });
    expect(payload.commanders).toEqual({ left: null, center: 'hero-1', right: null });
  });

  it('o teto do posto e a forma da quantidade vêm da visão', () => {
    expect(postCount(army, '0')).toBeNull();
    expect(postCount(army, 'abc')).toBeNull();
    expect(postCount(army, '1')).toBe(1);
    expect(postCount(army, String(army.editor.postMax))).toBe(army.editor.postMax);
    expect(postCount(army, String(army.editor.postMax + 1))).toBeNull();
  });

  it('as setas ficam dentro da grade', () => {
    expect(moveCell({ wing: 0, line: 0 }, 'ArrowLeft')).toEqual({ wing: 0, line: 0 });
    expect(moveCell({ wing: 0, line: 0 }, 'ArrowRight')).toEqual({ wing: 1, line: 0 });
    expect(moveCell({ wing: 2, line: 1 }, 'ArrowDown')).toEqual({ wing: 2, line: 1 });
    expect(moveCell({ wing: 2, line: 1 }, 'ArrowUp')).toEqual({ wing: 2, line: 0 });
  });

  it('diz "vazio" no posto sem tropa e o rótulo da unidade no cheio', () => {
    expect(slotText(army, null)).toBe('vazio');
    expect(slotText(army, { unit: 'spearman', count: 4 })).toBe('Lanceiro × 4');
  });

  it('um rascunho de formação salva leva o id, o nome e o comandante', () => {
    const saved = {
      id: 'f-1',
      name: 'Defesa',
      isActive: false,
      posts: [
        {
          wing: 'right',
          wingLabel: 'Ala direita',
          line: 'front',
          lineLabel: 'Frente',
          unit: 'spearman',
          unitLabel: 'Lanceiro',
          count: 3,
          text: '',
        },
      ],
      commanders: [
        {
          wing: 'right',
          wingLabel: 'Ala direita',
          heroId: 'hero-2',
          heroName: 'Rolf',
          classLabel: 'x',
        },
      ],
      total: 3,
      shortfall: [],
      shortfallText: '',
      canDelete: true,
    } as never;
    const draft = draftOf(saved);
    expect(draft.id).toBe('f-1');
    expect(draft.posts.right.front).toEqual({ unit: 'spearman', count: 3 });
    expect(draft.commanders.right).toBe('hero-2');
  });
});
