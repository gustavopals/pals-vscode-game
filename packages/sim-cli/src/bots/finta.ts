import type { Command, EngineViewState as ViewState } from '@lotg/engine';

import { montarFormacao } from './policies';
import type { Policy } from './types';

export const BAIT_FORMATION_NAME = 'Isca de arqueiros';

/** Só o militar: mostra arqueiros à Horda no outono e troca quando as ondas congelam. */
export const prepararFinta: Policy = {
  name: 'fintar a Horda',
  run: async (view, act) => {
    const { army, calendar, threat } = view;
    const bait = army.formations.find((formation) => formation.name === BAIT_FORMATION_NAME);
    const alreadySeen =
      bait !== undefined && army.reports.some((report) => report.adjustFormationId === bait.id);
    const strong = threat.known && threat.incoming?.size === 'strong';
    const archer = army.units.find((unit) => unit.id === 'archer');
    if (
      calendar.season !== 'autumn' ||
      (!strong && !alreadySeen) ||
      !army.built ||
      (archer?.count ?? 0) === 0 ||
      (bait === undefined && !army.editor.canSaveNew)
    ) {
      return montarFormacao.run(view, act);
    }
    const wings = ['left', 'center', 'right'] as const;
    let left = archer!.count;
    const posts = Object.fromEntries(
      wings.map((wing, index) => {
        const count = Math.min(army.editor.postMax, Math.ceil(left / (wings.length - index)));
        left -= count;
        return [wing, { front: null, back: count > 0 ? { unit: 'archer', count } : null }];
      }),
    ) as Extract<Command, { type: 'saveFormation' }>['payload']['posts'];
    let current: ViewState = view;
    if (bait === undefined) {
      current = await act('saveFormation', {
        id: null,
        name: BAIT_FORMATION_NAME,
        posts,
        commanders: { left: null, center: null, right: null },
      });
    }
    const target = current.army.formations.find(
      (formation) => formation.name === BAIT_FORMATION_NAME,
    );
    return target !== undefined && !target.isActive
      ? act('setActiveFormation', { id: target.id })
      : current;
  },
};
