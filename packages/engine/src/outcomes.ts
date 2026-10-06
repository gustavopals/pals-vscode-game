import {
  balance,
  type ExpeditionDisasterId,
  type ExpeditionNodeKind,
  type ExpeditionOutcomeId,
  type HeroHarmId,
  heroHarmTemplates,
  heroTraits,
  type InjurySeverityId,
  startingTiles,
  tileTypes,
} from '@lotg/content';

import { emit } from './chronicle';
import { releaseEquipment } from './equipment';
import { captives } from './heroes';
import type { Expedition, GameEvent, GameState, Hero } from './types';

/**
 * O que o desfecho de um nó faz ao herói e ao mundo (GDD §9.1 e §9.2; ADR 0017, decisão 8 e "Os
 * oito traços"; ADR 0018, decisão 14): ferir, capturar, matar, dar experiência e nível, libertar
 * um cativo, revelar um destino e limpar um tile de ameaça; e, fora das expedições, o ferido que
 * sara e o tile que volta na virada do ano.
 *
 * **Nada aqui sorteia nem dá identificador**: quem sofre é sorteado na resolução do nó
 * (`drawVictim`, em `expeditionTurn.ts`), no fluxo da expedição. Este módulo é conta e mudança
 * de estado em um instante da linha do tempo, e a visão lê dele o que é só leitura.
 */

const { injuries, heroes: heroRules, threat } = balance;

/** O que acontece ao herói sorteado: o dano e se é o ferimento que a dificuldade pôs no lugar da captura. */
export type Harm = { kind: HeroHarmId; spared: boolean };

/**
 * O que o desfecho de um nó faz a um herói (ADR 0017, decisão 8): o Revés fere de leve; o
 * Desastre fere gravemente ou, onde o nó marca captura, faz o que a dificuldade da partida diz
 * (`balance.difficulties[].heroCapture`): em Camponês, ferimento grave no lugar dela; em Senhor,
 * a captura; em Rei de Ferro, a morte. O Sucesso e o Sucesso Pleno não fazem nada.
 */
export function harmOf(
  state: GameState,
  outcome: ExpeditionOutcomeId,
  onDisaster: ExpeditionDisasterId,
): Harm | null {
  if (outcome === 'setback') {
    return { kind: 'light', spared: false };
  }
  if (outcome !== 'disaster') {
    return null;
  }
  if (onDisaster === 'injury') {
    return { kind: 'severe', spared: false };
  }
  const rule = balance.difficulties[state.settings.difficulty].heroCapture;
  if (rule === 'injury') {
    return { kind: 'severe', spared: true };
  }
  return { kind: rule === 'death' ? 'died' : 'captured', spared: false };
}

/**
 * O peso de cada herói da equipe no sorteio de quem sofre, na ordem da equipe: o do conteúdo
 * (`injuries.harmWeight`), ou o do traço que se expõe mais (o Corajoso). Quem tem um traço que
 * escapa do ferimento leve neste tipo de nó (o Prudente, em nó de perigo) pesa zero quando o
 * dano é o leve de um Revés: se a equipe inteira escapa, ninguém se fere.
 */
export function harmCandidates(
  team: readonly Hero[],
  nodeKind: ExpeditionNodeKind,
  harm: Harm,
): Array<{ hero: Hero; weight: number }> {
  return team.map((hero) => {
    const effects = hero.traits.map((trait) => heroTraits[trait].effects);
    const dodges =
      harm.kind === 'light' && effects.some((entry) => entry.dodgesSetbackIn?.includes(nodeKind));
    const weight = Math.max(injuries.harmWeight, ...effects.map((entry) => entry.harmWeight ?? 0));
    return { hero, weight: dodges ? 0 : weight };
  });
}

const SEVERITY_ORDER: readonly InjurySeverityId[] = ['light', 'severe'];

/**
 * Aplica o dano ao herói, com a linha da Crônica de cada caso.
 *
 * - **Ferimento** (leve ou grave): ele termina a expedição e não parte em outra até sarar
 *   (`injury.untilMs`, em tempo de jogo, evento da linha do tempo). Quem já estava ferido fica
 *   com o prazo mais longo e a gravidade maior.
 * - **Captura**: sai da equipe e fica em cativeiro, sem prazo; deixa de receber soldo e de estar
 *   Descontente; o que levava fica com ele, e volta com ele no Resgate.
 * - **Morte**: deixa de servir ao feudo, e o que levava volta ao arsenal.
 */
export function applyHarm(
  draft: GameState,
  expedition: Expedition,
  hero: Hero,
  harm: Harm,
  label: string,
  atMs: number,
  events: GameEvent[],
): void {
  const data = { heroId: hero.id, expeditionId: expedition.id, modelId: expedition.modelId };
  const words = { heroi: hero.name, expedicao: label };
  if (harm.kind === 'light' || harm.kind === 'severe') {
    const untilMs = atMs + injuries.durationMs[harm.kind];
    const before = hero.injury;
    hero.injury = {
      severity:
        before !== null &&
        SEVERITY_ORDER.indexOf(before.severity) > SEVERITY_ORDER.indexOf(harm.kind)
          ? before.severity
          : harm.kind,
      untilMs: Math.max(untilMs, before?.untilMs ?? 0),
    };
    draft.stats.heroesInjured = (draft.stats.heroesInjured ?? 0) + 1;
    emit(
      events,
      draft,
      atMs,
      'heroInjured',
      { ...data, severity: harm.kind, spared: harm.spared ? 1 : 0 },
      words,
      heroHarmTemplates[harm.spared ? 'spared' : harm.kind],
    );
    return;
  }
  expedition.heroIds = expedition.heroIds.filter((id) => id !== hero.id);
  if (harm.kind === 'captured') {
    hero.status = 'captured';
    hero.captivity = { sinceMs: atMs, modelId: expedition.modelId };
    hero.injury = null;
    hero.discontent = false;
    draft.stats.heroesCaptured = (draft.stats.heroesCaptured ?? 0) + 1;
    emit(events, draft, atMs, 'heroCaptured', data, words);
    return;
  }
  draft.guild.heroes = draft.guild.heroes.filter((entry) => entry.id !== hero.id);
  draft.stats.heroesDied = (draft.stats.heroesDied ?? 0) + 1;
  emit(events, draft, atMs, 'heroDied', data, words);
  releaseEquipment(draft, hero, atMs, events);
}

/**
 * Dá `amount` de experiência a cada herói (GDD §9.1; ADR 0017, decisão 7): quem junta o que o
 * nível de agora pede sobe, com linha na Crônica, e leva o resto para o nível seguinte; pode
 * subir mais de um de uma vez. **No nível máximo ninguém junta experiência.** Devolve quem
 * subiu, com o nível a que chegou.
 */
export function grantXp(
  draft: GameState,
  team: readonly Hero[],
  amount: number,
  atMs: number,
  events: GameEvent[],
): Array<{ heroName: string; level: number }> {
  const leveled: Array<{ heroName: string; level: number }> = [];
  if (amount <= 0) {
    return leveled;
  }
  for (const hero of team) {
    if (hero.level >= heroRules.maxLevel) {
      continue;
    }
    hero.xp += amount;
    let rose = false;
    for (;;) {
      const needed = heroRules.xpToNext[hero.level - 1];
      if (hero.level >= heroRules.maxLevel || needed === undefined || hero.xp < needed) {
        break;
      }
      hero.xp -= needed;
      hero.level += 1;
      rose = true;
    }
    if (hero.level >= heroRules.maxLevel) {
      hero.xp = 0;
    }
    if (rose) {
      leveled.push({ heroName: hero.name, level: hero.level });
      emit(
        events,
        draft,
        atMs,
        'heroLeveledUp',
        { heroId: hero.id, level: hero.level },
        { heroi: hero.name, nivel: hero.level },
      );
    }
  }
  return leveled;
}

/**
 * Os heróis feridos cujo prazo chegou saram, na ordem da lista: quem estava em recuperação no
 * feudo volta a poder partir; quem sarou em plena jornada continua nela. É um evento da linha
 * do tempo (`nextHeroRecoveryAt`).
 */
export function recoverHeroes(draft: GameState, atMs: number, events: GameEvent[]): void {
  for (const hero of draft.guild.heroes) {
    if (hero.injury === null || hero.injury.untilMs > atMs) {
      continue;
    }
    hero.injury = null;
    if (hero.status === 'injured') {
      hero.status = 'idle';
    }
    emit(events, draft, atMs, 'heroRecovered', { heroId: hero.id }, { heroi: hero.name });
  }
}

/**
 * Liberta quem está em cativeiro **há mais tempo** (no empate, quem chegou antes ao feudo): ele
 * volta ao feudo neste instante, pronto, com o que levava, e o soldo dele volta a correr.
 * Devolve o herói, ou `null` quando já não há ninguém lá.
 */
export function rescueCaptive(
  draft: GameState,
  expedition: Expedition,
  label: string,
  atMs: number,
  events: GameEvent[],
): Hero | null {
  const [hero] = captives(draft);
  if (hero === undefined) {
    return null;
  }
  hero.status = 'idle';
  hero.captivity = null;
  draft.stats.heroesRescued = (draft.stats.heroesRescued ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'heroRescued',
    { heroId: hero.id, expeditionId: expedition.id, modelId: expedition.modelId },
    { heroi: hero.name, expedicao: label },
  );
  return hero;
}

/** "o Covil de Lobos": um tile do estado, com artigo; `null` para uma chave que o estado não tem. */
export function tileWithArticle(state: GameState, tileId: string): string | null {
  const tile = Object.hasOwn(state.map.tiles, tileId) ? state.map.tiles[tileId] : undefined;
  if (tile === undefined) {
    return null;
  }
  const def = tileTypes[tile.type];
  return `${def.article} ${def.label}`;
}

/**
 * Limpa um tile de ameaça (ADR 0018, decisão 14): ele deixa de somar à Ameaça a cada virada, e
 * a Ameaça cai `threat.tileClearedDrop`, sem passar de zero. Diz se limpou: um tile que o estado
 * não tem, ou que já estava limpo (outra equipe chegou antes), não muda nada.
 *
 * **O evento não leva o número da Ameaça**: sem Torre, o jogador sabe que limpou o Covil, e não
 * quanto a Ameaça vale. A incursão que já estava marcada continua marcada.
 */
export function clearTile(
  draft: GameState,
  expedition: Expedition,
  tileId: string,
  label: string,
  atMs: number,
  events: GameEvent[],
): boolean {
  const tile = Object.hasOwn(draft.map.tiles, tileId) ? draft.map.tiles[tileId] : undefined;
  if (tile === undefined || !tile.threatActive) {
    return false;
  }
  tile.threatActive = false;
  draft.map.threat = Math.max(0, draft.map.threat - threat.tileClearedDrop);
  draft.stats.tilesCleared = (draft.stats.tilesCleared ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'threatTileCleared',
    { tileId, expeditionId: expedition.id, modelId: expedition.modelId },
    { expedicao: label, lugar: tileWithArticle(draft, tileId) ?? '' },
  );
  return true;
}

/**
 * Na virada do ano, os tiles de ameaça com que o feudo nasceu voltam a ficar ativos (ADR 0018,
 * decisão 14): os lobos voltam ao Covil. Roda antes de a Ameaça subir naquela virada, que já
 * conta o tile. A linha só sai para o tile que estava limpo: é o jogador que o limpou quem lê.
 */
export function restoreTiles(draft: GameState, atMs: number, events: GameEvent[]): void {
  for (const start of startingTiles) {
    const tile = Object.hasOwn(draft.map.tiles, start.id) ? draft.map.tiles[start.id] : undefined;
    if (tile === undefined || !start.threatActive || tile.threatActive) {
      continue;
    }
    tile.threatActive = true;
    emit(
      events,
      draft,
      atMs,
      'threatTileRestored',
      { tileId: start.id },
      { lugar: tileWithArticle(draft, start.id) ?? '' },
    );
  }
}

/** Os tiles de ameaça limpos agora, pela chave, em ordem. */
export function clearedTiles(state: GameState): string[] {
  return startingTiles
    .filter((start) => start.threatActive && state.map.tiles[start.id]?.threatActive === false)
    .map((start) => start.id)
    .sort();
}

/**
 * Revela um destino (ADR 0018, decisão 12): entra na lista dos descobertos, uma vez. Diz se
 * revelou; o que já era conhecido não muda nada.
 */
export function revealDestination(draft: GameState, modelId: string): boolean {
  if (draft.map.discovered.includes(modelId)) {
    return false;
  }
  draft.map.discovered.push(modelId);
  return true;
}
