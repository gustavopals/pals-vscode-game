import {
  balance,
  formationTexts,
  LINE_IDS,
  lineLabels,
  UNIT_IDS,
  units,
  WING_IDS,
  wingLabels,
} from '@lotg/content';

import { barracksLevel, isUnitId, troopText } from './army';
import { fillText, joinList } from './format';
import { canDepart } from './heroes';
import { reject } from './rejections';
import type {
  Formation,
  FormationPost,
  GameState,
  Hero,
  LineId,
  Rejection,
  UnitId,
  WingId,
} from './types';

/**
 * As formações salvas (GDD §10.1 e §10.8; ADR 0019, decisões 8 e 9): as contas e a validação
 * puras. **A formação é dado, não reserva**: pode pedir mais soldados do que o feudo tem, e nada
 * aqui toca `army.units`. Nada aqui sorteia, cria identificador ou emite evento; as ordens estão
 * em `formationOrders.ts`.
 */

const { army: rules } = balance;

/** O máximo de soldados por posto: 20, ou 30 com o Quartel no nível 5 ou acima. */
export function postMax(state: GameState): number {
  return barracksLevel(state) >= rules.postMaxFromLevel.level
    ? rules.postMaxFromLevel.max
    : rules.postMax;
}

/** Uma formação sem posto nem comandante: o ponto de partida do editor. */
export function emptyPosts(): Formation['posts'] {
  return Object.fromEntries(
    WING_IDS.map((wing) => [wing, Object.fromEntries(LINE_IDS.map((line) => [line, null]))]),
  ) as Formation['posts'];
}

/** Os postos de uma formação, na ordem fixa: alas da esquerda para a direita, frente antes da retaguarda. */
export function postEntries(
  formation: Formation,
): Array<{ wing: WingId; line: LineId; post: FormationPost | null }> {
  return WING_IDS.flatMap((wing) =>
    LINE_IDS.map((line) => ({ wing, line, post: formation.posts[wing][line] })),
  );
}

/** Quantos soldados de cada unidade a formação pede, no total dos seis postos. */
export function requiredUnits(formation: Formation): Record<UnitId, number> {
  const total = Object.fromEntries(UNIT_IDS.map((id) => [id, 0])) as Record<UnitId, number>;
  for (const { post } of postEntries(formation)) {
    if (post !== null) {
      total[post.unit] += post.count;
    }
  }
  return total;
}

/** O que falta de cada unidade para a formação se preencher com o exército de agora (só o que falta). */
export function formationShortfall(
  state: GameState,
  formation: Formation,
): Array<{ unit: UnitId; missing: number }> {
  const required = requiredUnits(formation);
  return UNIT_IDS.filter((unit) => required[unit] > state.army.units[unit]).map((unit) => ({
    unit,
    missing: required[unit] - state.army.units[unit],
  }));
}

/** "Faltam 3 lanceiros e 2 arqueiros para preencher todos os postos." ou o aviso de que não falta. */
export function shortfallText(state: GameState, formation: Formation): string {
  const missing = formationShortfall(state, formation);
  return missing.length === 0
    ? formationTexts.noShortfall
    : fillText(formationTexts.shortfall, {
        tropa: joinList(missing.map((entry) => troopText(entry.unit, entry.missing))),
      });
}

/** Os heróis que a formação nomeia, uma vez cada. */
export function commanderIds(formation: Formation): string[] {
  return [...new Set(WING_IDS.flatMap((wing) => formation.commanders[wing] ?? []))];
}

export function findFormation(state: GameState, id: unknown): Formation | undefined {
  return state.army.formations.find((entry) => entry.id === id);
}

/** A Defesa ativa; `null` sem ela. */
export function activeFormation(state: GameState): Formation | null {
  const { activeFormationId } = state.army;
  return activeFormationId === null
    ? null
    : (state.army.formations.find((entry) => entry.id === activeFormationId) ?? null);
}

/** A ala que o herói comanda em uma formação; `null` se ele não a comanda. */
export function wingOf(formation: Formation, heroId: string): WingId | null {
  return WING_IDS.find((wing) => formation.commanders[wing] === heroId) ?? null;
}

/** O herói comanda a Defesa ativa: ele não parte (ADR 0019, decisão 8). */
export function isActiveCommander(state: GameState, heroId: string): boolean {
  const active = activeFormation(state);
  return active !== null && wingOf(active, heroId) !== null;
}

/** Pode partir em expedição ou escolta: está pronto e não comanda a Defesa ativa. */
export function canDepartNow(state: GameState, hero: Hero): boolean {
  return canDepart(hero) && !isActiveCommander(state, hero.id);
}

/** Por que o herói da Defesa ativa não parte (`HERO_BUSY`); `null` se ele não a comanda. */
export function commandingBlock(state: GameState, hero: Hero): Rejection | null {
  const active = activeFormation(state);
  if (active === null || wingOf(active, hero.id) === null) {
    return null;
  }
  return reject('HERO_BUSY', {
    label: hero.name,
    note: fillText(formationTexts.commanderBusy, { heroi: hero.name, formacao: active.name }),
  });
}

/** Tira o herói do comando de todas as formações (dispensado, desertor, capturado ou morto). */
export function dropCommander(draft: GameState, heroId: string): void {
  for (const formation of draft.army.formations) {
    for (const wing of WING_IDS) {
      if (formation.commanders[wing] === heroId) {
        formation.commanders[wing] = null;
      }
    }
  }
}

/** Por que o herói não pode ser nomeado agora, em uma frase curta; `null` quando pode. */
export function nominationReason(hero: Hero): string | null {
  switch (hero.status) {
    case 'idle':
      return null;
    case 'injured':
      return formationTexts.heroInjured;
    case 'captured':
      return formationTexts.heroCaptive;
    case 'escort':
      return formationTexts.heroEscort;
    default:
      return formationTexts.heroAway;
  }
}

const invalid = (note: string): Rejection => reject('INVALID_FORMATION', { note });

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Tem exatamente estas chaves, nem mais nem menos. */
function hasKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return (
    isRecord(value) &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
  );
}

/**
 * Confere o conteúdo de uma ordem de salvar e devolve a formação normalizada (sem `id`: quem
 * chama o dá) ou a recusa. As recusas, na ordem: o nome, a forma, o posto vazio demais, a
 * unidade, a linha (cada unidade tem a sua), a quantidade, o comandante que não existe
 * (`HERO_NOT_FOUND`), o mesmo herói em duas alas, e o herói que não pode ser nomeado
 * (`HERO_UNAVAILABLE`: só vale para quem **passa** a ser nomeado; quem já comandava aquela ala
 * nesta formação fica). `previous` é a formação que está sendo substituída, se houver.
 */
export function checkFormation(
  state: GameState,
  payload: { name: unknown; posts: unknown; commanders: unknown },
  previous: Formation | null,
): Rejection | Omit<Formation, 'id'> {
  const { formationNameMinLength: min, formationNameMaxLength: max } = rules;
  const name = typeof payload.name === 'string' ? payload.name.trim() : '';
  if (name.length < min || name.length > max) {
    return invalid(fillText(formationTexts.nameLength, { min, max }));
  }
  if (!hasKeys(payload.posts, WING_IDS) || !hasKeys(payload.commanders, WING_IDS)) {
    return invalid(formationTexts.shape);
  }
  const limit = postMax(state);
  const posts = emptyPosts();
  let filled = 0;
  for (const wing of WING_IDS) {
    const wingPosts = payload.posts[wing];
    if (!hasKeys(wingPosts, LINE_IDS)) {
      return invalid(formationTexts.shape);
    }
    for (const line of LINE_IDS) {
      const post = wingPosts[line];
      if (post === null) {
        continue;
      }
      if (!hasKeys(post, ['unit', 'count'])) {
        return invalid(formationTexts.shape);
      }
      if (!isUnitId(post.unit)) {
        return invalid(formationTexts.unit);
      }
      if (units[post.unit].line !== line) {
        return invalid(
          fillText(formationTexts.line, {
            unidade: units[post.unit].label,
            linha: lineLabels[units[post.unit].line].toLowerCase(),
            posto: `${wingLabels[wing]}, ${lineLabels[line].toLowerCase()}`,
          }),
        );
      }
      const { count } = post;
      if (typeof count !== 'number' || !Number.isInteger(count) || count < 1 || count > limit) {
        return invalid(fillText(formationTexts.count, { max: limit }));
      }
      posts[wing][line] = { unit: post.unit, count };
      filled += 1;
    }
  }
  if (filled === 0) {
    return invalid(formationTexts.empty);
  }
  const commanders = Object.fromEntries(WING_IDS.map((wing) => [wing, null])) as Record<
    WingId,
    string | null
  >;
  const seen = new Set<string>();
  for (const wing of WING_IDS) {
    const heroId = payload.commanders[wing];
    if (heroId === null) {
      continue;
    }
    if (typeof heroId !== 'string') {
      return invalid(formationTexts.shape);
    }
    const hero = state.guild.heroes.find((entry) => entry.id === heroId);
    if (hero === undefined) {
      return reject('HERO_NOT_FOUND');
    }
    if (seen.has(heroId)) {
      return invalid(fillText(formationTexts.commanderTwice, { heroi: hero.name }));
    }
    seen.add(heroId);
    commanders[wing] = heroId;
  }
  // Só quem passa a ser nomeado precisa estar pronto: quem já comandava a ala fica.
  for (const wing of WING_IDS) {
    const heroId = commanders[wing];
    if (heroId === null || previous?.commanders[wing] === heroId) {
      continue;
    }
    const hero = state.guild.heroes.find((entry) => entry.id === heroId) as Hero;
    const reason = nominationReason(hero);
    if (reason !== null) {
      return reject('HERO_UNAVAILABLE', { label: hero.name, remedy: reason, note: 'comandar' });
    }
  }
  return { name, posts, commanders };
}
