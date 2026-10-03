import {
  balance,
  type EnemyId,
  RAID_SIZE_IDS,
  type RaidSizeId,
  type Ratio,
  type SeasonDef,
  threatMarkTemplates,
  tileTypes,
  type TileTypeId,
  type WatchtowerLevelDef,
} from '@lotg/content';

import { emit } from './chronicle';
import { seasonAt } from './clock';
import type { GameEvent, GameState } from './types';

/**
 * A Ameaça (GDD §8.2; ADR 0014, decisão 11): um número de 0 a 100 que **só muda na virada de
 * cada dia de jogo**. Cada tile de ameaça ativo soma o seu tanto, e cada dia de uma estação
 * marcada no conteúdo (o outono) soma mais um pouco. Logo depois da subida, a mesma virada pode
 * marcar uma incursão (`hordeTurn.ts`); e toda incursão resolvida, repelida ou sofrida, faz a
 * Ameaça cair (`raids.ts`).
 *
 * A Ameaça existe para todo feudo, mas só quem tem a Torre de Vigia a conhece: sem Torre a
 * visão não a mostra (`threatView.ts`) e a Crônica não fala dela (`turnThreat`).
 *
 * A Paliçada é o que segura uma incursão (`palisadeAgainst`). Ela não mexe na Ameaça.
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

/** O nível da Paliçada; 0 enquanto não foi construída. */
export function palisadeLevel(state: GameState): number {
  return state.settlement.buildings.palisade;
}

/**
 * O que a Paliçada faz a uma incursão (GDD §8.2; ADR 0014, decisão 11):
 *
 * - `open`: não há Paliçada, e o ataque custa tudo o que custa;
 * - `held`: ela o segura inteiro, sem perda de recurso e sem ferido;
 * - `breached`: o ataque é maior do que ela segura e passa, mas só com a parte `share` do
 *   estrago (dos recursos e dos feridos).
 */
export type PalisadeOutcome =
  { kind: 'open' } | { kind: 'held' } | { kind: 'breached'; share: Ratio };

/**
 * O desfecho de uma incursão de tamanho `size` contra a Paliçada no nível `level`: cada nível
 * segura até um tamanho (`palisadeLevels`), e o que é maior passa com uma parte do estrago
 * (`palisadeBreach`). É a regra inteira da Paliçada, lida pela visão e por quem resolve a
 * incursão (V2E-T3), que a consulta **depois** das obras concluídas no mesmo instante: a
 * Paliçada que fica pronta na hora do ataque já conta.
 *
 * Não há dano à Paliçada nesta versão: o nível que segura hoje segura sempre.
 */
export function palisadeAgainst(level: number, size: RaidSizeId): PalisadeOutcome {
  const def = rules.palisadeLevels[level - 1];
  if (def === undefined) {
    return { kind: 'open' };
  }
  return RAID_SIZE_IDS.indexOf(size) <= RAID_SIZE_IDS.indexOf(def.absorbs)
    ? { kind: 'held' }
    : { kind: 'breached', share: rules.palisadeBreach };
}

/**
 * A chance de a virada do dia marcar uma incursão com a Ameaça em `threat`, em % (GDD §8.2): o
 * que ela passa de `raidChanceAbove`; zero até lá.
 */
export function raidChancePercent(threat: number): number {
  return Math.max(0, threat - rules.raidChanceAbove);
}

/** O tamanho da incursão que a Ameaça em `threat` marca: média a partir de `mediumRaidAbove`. */
export function raidSizeAt(threat: number): RaidSizeId {
  return threat >= rules.mediumRaidAbove ? 'medium' : 'light';
}

/**
 * Quem ronda o feudo: o inimigo do primeiro tile de ameaça ativo, pela chave (a ordem das
 * chaves de um objeto não sobrevive ao banco). `null` sem tile ativo: não há quem ataque.
 */
export function prowlingEnemy(state: GameState): EnemyId | null {
  const { tiles } = state.map;
  for (const tileId of Object.keys(tiles).sort()) {
    const tile = tiles[tileId];
    if (tile !== undefined && tile.threatActive) {
      return tileTypes[tile.type].enemy;
    }
  }
  return null;
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

/** Quantas vezes a Ameaça já cruzou `mark` para cima, com ou sem Torre. */
const markStat = (mark: number) => `threatCrossed:${mark}`;

/**
 * A Ameaça na virada do dia de jogo, depois do Conselho (ADR 0013, ordem do mesmo instante).
 *
 * Sobe sempre, haja ou não Torre. **A Crônica só fala dela a quem tem a Torre**, e só quando a
 * subida cruza uma das marcas do conteúdo (40 e 70): sem vigias ninguém conta os uivos, e um
 * evento com o número dentro contaria ao jogador o que a névoa esconde. Quem ergue a Torre
 * depois de a marca passar não recebe a linha atrasada: vê o número no painel.
 *
 * Cruzar de novo uma marca dá outra linha, com a frase da volta (`again`): a Ameaça só cai com
 * uma incursão, então quem a cruza de novo é a matilha que voltou depois de um ataque, e a
 * Crônica não repete, palavra por palavra, o anúncio de antes. Toda virada que cruza uma marca
 * conta em `stats["threatCrossed:<marca>"]`, com ou sem Torre: a Torre não muda o estado de
 * quem está fora, só o que ele lê. Quem ergue a Torre depois da primeira vez lê a frase da volta.
 *
 * A virada do dia é um instante da linha do tempo, e a regra só olha o estado daquele instante:
 * avançar de uma vez ou aos pedaços dá a mesma Ameaça e as mesmas linhas.
 */
export function turnThreat(draft: GameState, atMs: number, events: GameEvent[]): void {
  const previous = draft.map.threat;
  const next = threatAfterTurn(draft, atMs);
  draft.map.threat = next;
  const crossed = rules.chronicleMarks.filter((mark) => previous < mark && next >= mark);
  const before = new Map(crossed.map((mark) => [mark, draft.stats[markStat(mark)] ?? 0]));
  for (const [mark, times] of before) {
    draft.stats[markStat(mark)] = times + 1;
  }
  // A marca mais alta que esta virada cruzou: uma linha só, mesmo que a subida pule duas.
  const mark = crossed[crossed.length - 1];
  if (mark === undefined || !isThreatWatched(draft)) {
    return;
  }
  const phrases = threatMarkTemplates[mark];
  emit(
    events,
    draft,
    atMs,
    'threatRose',
    { threat: next, previousThreat: previous, mark },
    { ameaca: next },
    before.get(mark) === 0 ? phrases?.first : phrases?.again,
  );
}
