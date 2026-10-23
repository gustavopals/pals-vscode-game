import { balance } from '@lotg/content';

import { emit } from './chronicle';
import { checkFormation, findFormation } from './formations';
import { nextId } from './ids';
import { reject } from './rejections';
import type { Formation, GameEvent, GameState, Rejection } from './types';

/**
 * As ordens das formações salvas (GDD §10.8; ADR 0019, decisões 8 e 9). **Nenhuma sorteia nem
 * cria instante na linha do tempo**: a formação é dado. Só salvar uma formação nova dá
 * identificador (`nextId(draft, 'formation')`), e só depois de a ordem ter passado em todas as
 * conferências, para uma recusa nunca gastar um número.
 */

/**
 * `saveFormation { id, name, posts, commanders }`: `id: null` cria (até `formationsCap`), um `id`
 * salvo a substitui no mesmo lugar da lista. As recusas, na ordem: a formação que não existe
 * (`FORMATION_NOT_FOUND`), o teto (`FORMATIONS_CAP`) e o conteúdo (`checkFormation`).
 */
export function saveFormation(
  draft: GameState,
  id: unknown,
  name: unknown,
  posts: unknown,
  commanders: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { formations } = draft.army;
  let previous: Formation | null = null;
  if (id !== null && id !== undefined) {
    previous = findFormation(draft, id) ?? null;
    if (previous === null) {
      return reject('FORMATION_NOT_FOUND');
    }
  } else if (formations.length >= balance.army.formationsCap) {
    return reject('FORMATIONS_CAP', { count: balance.army.formationsCap });
  }
  const checked = checkFormation(draft, { name, posts, commanders }, previous);
  if ('code' in checked) {
    return checked;
  }
  const saved: Formation = { id: previous?.id ?? nextId(draft, 'formation'), ...checked };
  if (previous === null) {
    formations.push(saved);
  } else {
    formations[formations.indexOf(previous)] = saved;
  }
  emit(
    events,
    draft,
    nowMs,
    'formationSaved',
    { formationId: saved.id, formations: formations.length, edited: previous === null ? 0 : 1 },
    { formacao: saved.name },
  );
  return null;
}

/** `deleteFormation { id }`: a Defesa ativa não se apaga (`FORMATION_ACTIVE`). */
export function deleteFormation(
  draft: GameState,
  id: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const formation = findFormation(draft, id);
  if (formation === undefined) {
    return reject('FORMATION_NOT_FOUND');
  }
  if (draft.army.activeFormationId === formation.id) {
    return reject('FORMATION_ACTIVE');
  }
  draft.army.formations = draft.army.formations.filter((entry) => entry.id !== formation.id);
  // A prévia de uma formação apagada não tem mais de que falar (a guarda do estado a exige).
  if (draft.army.preview?.formationId === formation.id) {
    draft.army.preview = null;
  }
  emit(
    events,
    draft,
    nowMs,
    'formationDeleted',
    { formationId: formation.id, formations: draft.army.formations.length },
    { formacao: formation.name },
  );
  return null;
}

/**
 * `setActiveFormation { id }`: marca a Defesa ativa; `id: null` a desmarca (sem linha na
 * Crônica). Marcar a que já é a ativa não muda nada e não emite evento. O comandante que está
 * fora do feudo pode ser nomeado na ativa: ele só não parte de novo depois de voltar.
 */
export function setActiveFormation(
  draft: GameState,
  id: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  if (id === null) {
    draft.army.activeFormationId = null;
    return null;
  }
  const formation = findFormation(draft, id);
  if (formation === undefined) {
    return reject('FORMATION_NOT_FOUND');
  }
  if (draft.army.activeFormationId === formation.id) {
    return null;
  }
  draft.army.activeFormationId = formation.id;
  emit(
    events,
    draft,
    nowMs,
    'formationActivated',
    { formationId: formation.id },
    { formacao: formation.name },
  );
  return null;
}
