import { balance, WING_IDS, type LineId, type UnitId, type WingId } from '@lotg/content';

import { barracksLevel, barracksRequiresText } from './army';
import type { BattleCommanderInput, BattlePosts } from './battle';
import { emit } from './chronicle';
import { seasonAt } from './clock';
import { findFormation, nominationReason, postEntries } from './formations';
import { hashText } from './hash';
import { reject } from './rejections';
import { raidSizeAt, watchtowerLevel } from './threat';
import type { Formation, GameEvent, GameState, Rejection } from './types';
import { previewBattle, type EnemyGuessPosts, type PreviewInput } from './warCouncil';

/**
 * A ordem do Conselho de Guerra (GDD §10.5; ADR 0019, decisão 10; V4D-T2.2) e as contas de
 * estado que a alimentam. A prévia em si (`warCouncil.ts`) não recebe o estado: este arquivo
 * monta a entrada dela a partir do estado, e é só ele que grava `army.preview`.
 */

/**
 * A impressão digital do conteúdo de uma formação (postos e comandantes, sem o nome): é o que a
 * prévia guarda para a visão saber que a formação mudou depois (`previewStale`).
 */
export function formationSignature(formation: Formation): number {
  return hashText(JSON.stringify([formation.posts, formation.commanders]));
}

/**
 * Os postos que o feudo preenche hoje: a formação é um plano, e a prévia (como a batalha) lança
 * os soldados que há, posto a posto, na ordem fixa dos postos; o posto sem ninguém fica vazio.
 */
function filledPosts(state: GameState, formation: Formation): BattlePosts<UnitId> {
  const left = { ...state.army.units };
  const posts = {} as BattlePosts<UnitId>;
  for (const wing of WING_IDS) {
    posts[wing] = { front: null, back: null };
  }
  for (const { wing, line, post } of postEntries(formation)) {
    if (post === null) {
      continue;
    }
    const count = Math.min(post.count, left[post.unit]);
    if (count > 0) {
      left[post.unit] -= count;
      posts[wing][line] = { unit: post.unit, count };
    }
  }
  return posts;
}

/**
 * O inimigo que a prévia supõe (V4D-T2.1; pendência D-6): nada da Horda é conhecido ainda (a
 * Horda é da Fase E), então todo posto é desconhecido, com a quantidade tirada do total da
 * incursão que a Ameaça marca (`previewEnemy.units`) e da parte de cada posto.
 */
function estimatedEnemy(state: GameState): EnemyGuessPosts {
  const { units: totals, shares } = balance.battle.previewEnemy;
  // Sem Torre de Vigia o jogador não vê a Ameaça: a prévia não a lê e supõe a incursão leve.
  const total = totals[watchtowerLevel(state) > 0 ? raidSizeAt(state.map.threat) : 'light'];
  const guess = (wing: WingId, line: LineId) => {
    const share = shares[wing][line];
    return share === 0
      ? null
      : { kind: 'unknown' as const, count: Math.max(1, Math.floor((total * share) / 100)) };
  };
  return {
    left: { front: guess('left', 'front'), back: guess('left', 'back') },
    center: { front: guess('center', 'front'), back: guess('center', 'back') },
    right: { front: guess('right', 'front'), back: guess('right', 'back') },
  };
}

/** O que `previewBattle` recebe para uma formação do feudo, no estado de agora. */
export function previewInputFor(state: GameState, formation: Formation): PreviewInput {
  const commanders = {} as Record<WingId, BattleCommanderInput | null>;
  for (const wing of WING_IDS) {
    const hero = state.guild.heroes.find((entry) => entry.id === formation.commanders[wing]);
    commanders[wing] =
      hero === undefined || nominationReason(hero) !== null
        ? null
        : { heroId: hero.id, heroClass: hero.classId };
  }
  return {
    seed: state.seed,
    formationId: formation.id,
    season: seasonAt(state.lastProcessedAt).id,
    mode: 'defense',
    player: { posts: filledPosts(state, formation), commanders },
    enemy: estimatedEnemy(state),
    // A muralha com HP é da V4E-T1: até lá a prévia entra sem muralha (pendência D-7).
    wall: {},
    watchtowerLevel: watchtowerLevel(state),
    heroCapture: balance.difficulties[state.settings.difficulty].heroCapture,
  };
}

/**
 * A ordem de simular (`simulateBattle { formationId }`): roda as 200 batalhas da prévia com o
 * gerador próprio dela (`previewBattle`, que nunca toca `state.rng`), grava `army.preview` no
 * lugar da anterior e conta em `stats.battlesSimulated`. Não sorteia no fluxo do estado e não
 * cria entidade. As recusas, nesta ordem: a formação que não existe e o Quartel que falta.
 */
export function simulateBattle(
  draft: GameState,
  formationId: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const formation = findFormation(draft, formationId);
  if (formation === undefined) {
    return reject('FORMATION_NOT_FOUND');
  }
  if (barracksLevel(draft) === 0) {
    return reject('BARRACKS_REQUIRED', { note: barracksRequiresText(draft) });
  }
  const result = previewBattle(previewInputFor(draft, formation));
  draft.army.preview = {
    formationId: formation.id,
    atMs: nowMs,
    signature: formationSignature(formation),
    runs: result.runs,
    wins: result.wins,
    glorious: result.glorious,
    losses: result.losses,
    risk:
      result.risk === null
        ? null
        : { factor: result.risk.factor, wing: result.risk.wing, amount: result.risk.amount },
    expectedLosses: result.expectedLosses.map((post) => ({ ...post })),
    enemy: result.enemy.map((post) => ({ ...post })),
  };
  draft.stats.battlesSimulated = (draft.stats.battlesSimulated ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'battleSimulated',
    {
      formationId: formation.id,
      wins: result.wins,
      glorious: result.glorious,
      losses: result.losses,
    },
    { formacao: formation.name },
  );
  return null;
}
