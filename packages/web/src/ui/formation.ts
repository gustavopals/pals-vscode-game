import type { ViewState } from '@lotg/protocol';

import { formatNumber } from './format';

/**
 * O rascunho de uma formação (GDD §13.4; ADR 0019, decisões 8 e 9) como estado da tela: nada
 * aqui é regra. O teto do posto, as unidades de cada linha, quem pode comandar e o que falta
 * vêm da visão (`army.editor`, `army.formations`); a ordem só nasce em "Salvar", e o motor
 * recusa o que não vale. O app só monta a forma que o protocolo pede.
 */

export type Army = ViewState['army'];
export type SavedFormation = Army['formations'][number];
type UnitId = Army['units'][number]['id'];

export const WINGS = ['left', 'center', 'right'] as const;
export const LINES = ['front', 'back'] as const;
export type Wing = (typeof WINGS)[number];
export type Line = (typeof LINES)[number];

export type Slot = { unit: UnitId; count: number } | null;

export type Draft = {
  /** A formação salva que está sendo editada; `null` é uma nova. */
  id: string | null;
  name: string;
  posts: Record<Wing, Record<Line, Slot>>;
  commanders: Record<Wing, string | null>;
};

/** Só a posição na grade (a visão traz os nomes das alas em cada formação salva; ver o relatório da T3.3). */
export const WING_LABEL: Record<Wing, string> = {
  left: 'Esquerda',
  center: 'Centro',
  right: 'Direita',
};
export const LINE_LABEL: Record<Line, string> = { front: 'Frente', back: 'Retaguarda' };

export function emptyDraft(): Draft {
  return {
    id: null,
    name: '',
    posts: {
      left: { front: null, back: null },
      center: { front: null, back: null },
      right: { front: null, back: null },
    },
    commanders: { left: null, center: null, right: null },
  };
}

/** O rascunho que começa de uma formação salva. */
export function draftOf(saved: SavedFormation): Draft {
  const draft = emptyDraft();
  draft.id = saved.id;
  draft.name = saved.name;
  for (const post of saved.posts) {
    draft.posts[post.wing][post.line] =
      post.unit === null ? null : { unit: post.unit, count: post.count };
  }
  for (const commander of saved.commanders) {
    draft.commanders[commander.wing] = commander.heroId;
  }
  return draft;
}

/** Uma cópia com um posto trocado (o rascunho nunca é mutado). */
export function withPost(draft: Draft, wing: Wing, line: Line, slot: Slot): Draft {
  return {
    ...draft,
    posts: { ...draft.posts, [wing]: { ...draft.posts[wing], [line]: slot } },
  };
}

export function withCommander(draft: Draft, wing: Wing, heroId: string | null): Draft {
  return { ...draft, commanders: { ...draft.commanders, [wing]: heroId } };
}

/** As unidades que lutam nesta linha, como a visão diz. */
export const unitsOfLine = (army: Army, line: Line): Army['editor']['units'] =>
  army.editor.units.filter((unit) => unit.line === line);

/** "Lanceiro × 4", ou "vazio". */
export function slotText(army: Army, slot: Slot): string {
  if (slot === null) {
    return 'vazio';
  }
  const label = army.editor.units.find((unit) => unit.id === slot.unit)?.label ?? slot.unit;
  return `${label} × ${formatNumber(slot.count)}`;
}

/** A quantidade digitada, de 1 ao teto do posto da visão; `null` quando não serve. */
export function postCount(army: Army, text: string): number | null {
  if (!/^\d{1,6}$/.test(text.trim())) {
    return null;
  }
  const value = Number(text.trim());
  return value >= 1 && value <= army.editor.postMax ? value : null;
}

/** O rascunho tem ao menos um posto cheio. */
export const hasSoldiers = (draft: Draft): boolean =>
  WINGS.some((wing) => LINES.some((line) => draft.posts[wing][line] !== null));

/** O corpo da ordem `saveFormation`. */
export function savePayload(draft: Draft) {
  return {
    confirmed: true,
    id: draft.id,
    name: draft.name.trim(),
    posts: Object.fromEntries(
      WINGS.map((wing) => [
        wing,
        Object.fromEntries(LINES.map((line) => [line, draft.posts[wing][line]])),
      ]),
    ),
    commanders: { ...draft.commanders },
  };
}

/** A célula a uma seta da atual, sem sair da grade. */
export function moveCell(
  cell: { wing: number; line: number },
  key: string,
): { wing: number; line: number } {
  const dWing = (key === 'ArrowRight' ? 1 : 0) - (key === 'ArrowLeft' ? 1 : 0);
  const dLine = (key === 'ArrowDown' ? 1 : 0) - (key === 'ArrowUp' ? 1 : 0);
  return {
    wing: Math.max(0, Math.min(WINGS.length - 1, cell.wing + dWing)),
    line: Math.max(0, Math.min(LINES.length - 1, cell.line + dLine)),
  };
}
