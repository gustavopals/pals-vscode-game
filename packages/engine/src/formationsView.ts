import { balance, lineLabels, UNIT_IDS, units, WING_IDS, wingLabels } from '@lotg/content';

import { availableUnits, campaignWarning } from './campaign';
import { troopText } from './army';
import {
  activeFormation,
  commanderIds,
  formationShortfall,
  nominationReason,
  postEntries,
  postMax,
  requiredUnits,
  shortfallText,
  wingOf,
} from './formations';
import { classLabel } from './heroes';
import type {
  FormationEditorView,
  FormationView,
  GameState,
  Hero,
  HeroCommandingView,
} from './types';
import { previewIsStale } from './warCouncilView';

/**
 * As formações salvas na visão (GDD §10.8 e §13.4; ADR 0019, decisões 8 e 9). Só lê o estado:
 * não sorteia, não dá identificador e não anda o tempo. Os rótulos vêm do conteúdo, prontos.
 */

export function formationViews(state: GameState): FormationView[] {
  const active = activeFormation(state);
  return state.army.formations.map((formation) => {
    const required = requiredUnits(formation);
    return {
      id: formation.id,
      name: formation.name,
      isActive: active?.id === formation.id,
      posts: postEntries(formation).map(({ wing, line, post }) => ({
        wing,
        wingLabel: wingLabels[wing],
        line,
        lineLabel: lineLabels[line],
        unit: post?.unit ?? null,
        unitLabel: post === null ? null : units[post.unit].label,
        count: post?.count ?? 0,
        text: post === null ? 'Vazio' : troopText(post.unit, post.count),
      })),
      commanders: WING_IDS.map((wing) => {
        const hero = state.guild.heroes.find((entry) => entry.id === formation.commanders[wing]);
        return {
          wing,
          wingLabel: wingLabels[wing],
          heroId: hero?.id ?? null,
          heroName: hero?.name ?? null,
          classLabel: hero === undefined ? null : classLabel(hero),
        };
      }),
      total: UNIT_IDS.reduce((sum, unit) => sum + required[unit], 0),
      shortfall: formationShortfall(state, formation).map(({ unit, missing }) => ({
        unit,
        unitLabel: units[unit].label,
        missing,
      })),
      shortfallText: shortfallText(state, formation),
      canDelete: active?.id !== formation.id && state.army.campaign?.formationId !== formation.id,
      previewStale: previewIsStale(state, formation),
    };
  });
}

export function formationEditorView(state: GameState): FormationEditorView {
  return {
    warning: campaignWarning(state),
    postMax: postMax(state),
    formationsCap: balance.army.formationsCap,
    canSaveNew: state.army.formations.length < balance.army.formationsCap,
    // Os nomes das alas e das linhas, do conteúdo: o editor vazio também precisa deles.
    wingLabels: { ...wingLabels },
    lineLabels: { ...lineLabels },
    units: UNIT_IDS.map((id) => ({
      id,
      label: units[id].label,
      line: units[id].line,
      available: availableUnits(state)[id],
    })),
    heroes: state.guild.heroes.map((hero) => ({
      heroId: hero.id,
      name: hero.name,
      classLabel: classLabel(hero),
      reason: nominationReason(hero),
    })),
  };
}

/** A formação que o herói comanda, a ativa antes das outras; `null` se ele não comanda nenhuma. */
export function commandingView(state: GameState, hero: Hero): HeroCommandingView | null {
  const active = activeFormation(state);
  const formations = state.army.formations.filter((entry) => commanderIds(entry).includes(hero.id));
  const formation = formations.find((entry) => entry.id === active?.id) ?? formations[0];
  if (formation === undefined) {
    return null;
  }
  const wing = wingOf(formation, hero.id);
  if (wing === null) {
    return null;
  }
  return {
    formationId: formation.id,
    formationName: formation.name,
    wing,
    wingLabel: wingLabels[wing],
    isActive: active?.id === formation.id,
  };
}
