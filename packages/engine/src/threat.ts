import {
  balance,
  type SeasonDef,
  threatMarkTemplates,
  type TileTypeId,
  type WatchtowerLevelDef,
} from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import type { GameEvent, GameState } from './types';

/**
 * A Ameaça (GDD §8.2; ADR 0014, decisão 11): um número de 0 a 100 que **só muda na virada de
 * cada dia de jogo**. Cada tile de ameaça ativo soma o seu tanto, e cada dia de uma estação
 * marcada no conteúdo (o outono) soma mais um pouco. O sorteio de incursões e a queda que cada
 * incursão traz entram com a incursão de lobos (V2E-T3).
 *
 * A Ameaça existe para todo feudo, mas só quem tem a Torre de Vigia a conhece: sem Torre a
 * visão não a mostra (`threatView.ts`) e a Crônica não fala dela (`turnThreat`).
 */

const { threat: rules } = balance;

/** O nível da Torre de Vigia; 0 enquanto não foi construída. */
export function watchtowerLevel(state: GameState): number {
  return state.settlement.buildings.watchtower;
}

/** O feudo tem vigias: a Ameaça é conhecida, na visão e na Crônica. */
export function isThreatWatched(state: GameState): boolean {
  return watchtowerLevel(state) >= 1;
}

/** O que um nível da Torre dá; `null` no nível 0, e em um nível que o conteúdo não descreve. */
export function watchtowerPerks(level: number): WatchtowerLevelDef | null {
  return rules.watchtowerLevels[level - 1] ?? null;
}

/** Um termo da subida de uma virada de dia: um tile ativo, ou a estação do dia que acabou. */
export type ThreatSource =
  | { kind: 'tile'; tileId: string; type: TileTypeId; amount: number }
  | { kind: 'season'; season: SeasonDef; amount: number };

/**
 * Os termos da subida na virada de dia de `turnMs`, na ordem em que a explicação os mostra: os
 * tiles ativos, pela chave (a ordem das chaves de um objeto não sobrevive ao banco), e depois a
 * estação.
 *
 * A estação é a **do dia que acabou**: cada dia de outono que passa soma, do primeiro ao
 * último. Assim a visão diz "+3/dia: outono" enquanto é outono, e a virada seguinte cumpre.
 */
export function threatSources(state: GameState, turnMs: number): ThreatSource[] {
  const sources: ThreatSource[] = [];
  const { tiles } = state.map;
  for (const tileId of Object.keys(tiles).sort()) {
    const tile = tiles[tileId];
    if (tile !== undefined && tile.threatActive) {
      sources.push({ kind: 'tile', tileId, type: tile.type, amount: rules.perActiveTilePerDay });
    }
  }
  const season = seasonAt(Math.max(0, turnMs - 1));
  const seasonal = rules.seasonPerDay[season.id];
  if (seasonal !== undefined) {
    sources.push({ kind: 'season', season, amount: seasonal });
  }
  return sources;
}

/** A Ameaça depois da virada de dia de `turnMs`: a soma dos termos, limitada ao máximo. */
export function threatAfterTurn(state: GameState, turnMs: number): number {
  const rise = threatSources(state, turnMs).reduce((sum, source) => sum + source.amount, 0);
  return Math.min(rules.max, state.map.threat + rise);
}

/**
 * A Ameaça na virada do dia de jogo, depois do Conselho (ADR 0013, ordem do mesmo instante).
 *
 * Sobe sempre, haja ou não Torre. **A Crônica só fala dela a quem tem a Torre**, e só quando a
 * subida cruza uma das marcas do conteúdo (40 e 70): sem vigias ninguém conta os uivos, e um
 * evento com o número dentro contaria ao jogador o que a névoa esconde. Quem ergue a Torre
 * depois de a marca passar não recebe a linha atrasada: vê o número no painel.
 *
 * A virada do dia é um instante da linha do tempo, e a regra só olha o estado daquele instante:
 * avançar de uma vez ou aos pedaços dá a mesma Ameaça e as mesmas linhas.
 */
export function turnThreat(draft: GameState, atMs: number, events: GameEvent[]): void {
  const previous = draft.map.threat;
  const next = threatAfterTurn(draft, atMs);
  draft.map.threat = next;
  if (!isThreatWatched(draft)) {
    return;
  }
  // A marca mais alta que esta virada cruzou: uma linha só, mesmo que a subida pule duas.
  const crossed = rules.chronicleMarks.filter((mark) => previous < mark && next >= mark);
  const mark = crossed[crossed.length - 1];
  if (mark === undefined) {
    return;
  }
  emit(
    events,
    draft,
    atMs,
    'threatRose',
    { threat: next, previousThreat: previous, mark },
    { ameaca: next },
    threatMarkTemplates[mark],
  );
}
