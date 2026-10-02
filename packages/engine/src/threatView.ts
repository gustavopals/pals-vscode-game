import { balance, buildings, enemies, tileTypes } from '@lotg/content';

import { DAY_MS, nextDayBoundary } from './clock';
import { durationText, sentenceCase } from './format';
import {
  isThreatWatched,
  threatAfterTurn,
  threatSources,
  watchtowerLevel,
  watchtowerPerks,
} from './threat';
import type {
  BuildingId,
  GameState,
  ThreatDefenseView,
  ThreatIncomingView,
  ThreatView,
  ThreatWatchtowerView,
} from './types';
import { realSecondsCeil } from './units';

/**
 * A Ameaça na visão (GDD §8.2): o que os vigias da Torre veem, em frases prontas e em tempo
 * real. **Sem a Torre de Vigia nada da Ameaça sai daqui**: nem o número, nem a tendência, nem
 * de onde ela vem, nem a incursão marcada. Sai só o que o jogador já sabe: que não tem Torre, o
 * que ela daria e o que protege o feudo (roadmap da v0.2, §0.7, "Visão e privacidade
 * narrativa"). Este módulo não sorteia nada.
 */

const { threat: rules } = balance;
const tower = buildings.watchtower;

const real = (gameMs: number, timeScale: number) =>
  durationText(realSecondsCeil(gameMs, timeScale));

/**
 * O que a Torre faz em um nível, para o meio de uma frase: "mostra a Ameaça com a explicação e
 * avisa de uma incursão com 20 min de antecedência". A antecedência é tempo de jogo e sai no
 * relógio do jogador.
 */
function perksText(level: number, timeScale: number): string {
  const perks = watchtowerPerks(level);
  if (perks === null) {
    return 'mostra a Ameaça com a explicação';
  }
  const warning = `avisa de uma incursão com ${real(perks.warningMs, timeScale)} de antecedência`;
  return perks.revealsRaidSize
    ? `mostra a Ameaça com a explicação, ${warning} e diz o tamanho dela`
    : `mostra a Ameaça com a explicação e ${warning}`;
}

/**
 * O que a obra da Torre muda, para ficar ao lado do custo. A construção: "Mostra a Ameaça com a
 * explicação e avisa de uma incursão com 20 min de antecedência." Uma melhoria só diz o que
 * muda: "Aviso de incursão: de 20 min para 40 min de antecedência. Os vigias passam a dizer o
 * tamanho dela." `null` para os outros edifícios e para um nível que o conteúdo não descreve.
 */
export function watchtowerEffect(
  building: BuildingId,
  targetLevel: number,
  timeScale: number,
): string | null {
  const perks = building === 'watchtower' ? watchtowerPerks(targetLevel) : null;
  if (perks === null) {
    return null;
  }
  const before = watchtowerPerks(targetLevel - 1);
  if (before === null) {
    return `${sentenceCase(perksText(targetLevel, timeScale))}.`;
  }
  const warning = `Aviso de incursão: de ${real(before.warningMs, timeScale)} para ${real(
    perks.warningMs,
    timeScale,
  )} de antecedência.`;
  return perks.revealsRaidSize && !before.revealsRaidSize
    ? `${warning} Os vigias passam a dizer o tamanho dela.`
    : warning;
}

function watchtowerView(state: GameState, timeScale: number): ThreatWatchtowerView {
  const level = watchtowerLevel(state);
  const atCeiling = level >= tower.maxLevel;
  const built = `${tower.label} Nv${level}: ${perksText(level, timeScale)}.`;
  return {
    building: 'watchtower',
    level,
    text:
      level === 0
        ? `Sem ${tower.label}, ninguém vê a Ameaça crescer nem avisa de um ataque.`
        : atCeiling && tower.maxLevelNote !== undefined
          ? `${built} ${tower.maxLevelNote}`
          : built,
    next: atCeiling ? null : `${tower.label} Nv${level + 1}: ${gainText(level + 1, timeScale)}.`,
  };
}

/**
 * O que o nível `level` da Torre acrescenta ao anterior, para o meio de uma frase: "avisa com
 * 40 min de antecedência (em vez de 20 min) e passa a dizer o tamanho da incursão". No primeiro
 * nível é tudo o que a Torre faz.
 */
function gainText(level: number, timeScale: number): string {
  const perks = watchtowerPerks(level);
  const before = watchtowerPerks(level - 1);
  if (perks === null || before === null) {
    return perksText(level, timeScale);
  }
  const warning = `avisa com ${real(perks.warningMs, timeScale)} de antecedência (em vez de ${real(
    before.warningMs,
    timeScale,
  )})`;
  return perks.revealsRaidSize && !before.revealsRaidSize
    ? `${warning} e passa a dizer o tamanho da incursão`
    : warning;
}

/**
 * O que protege o feudo de um ataque hoje. A Paliçada entra com a tarefa dela (V2E-T2); até lá
 * o nível é zero, e a frase diz o que isso quer dizer.
 */
function defenseView(): ThreatDefenseView {
  return { palisadeLevel: 0, text: 'Sem Paliçada, nada segura um ataque.' };
}

/**
 * A incursão marcada que os vigias já avistaram: a primeira a chegar, se o prazo dela já está
 * dentro da antecedência que o nível da Torre dá. O tamanho só sai com a Torre que o distingue.
 */
function incomingView(state: GameState, timeScale: number): ThreatIncomingView | null {
  const perks = watchtowerPerks(watchtowerLevel(state));
  if (perks === null) {
    return null;
  }
  const now = state.lastProcessedAt;
  const [raid] = state.horde.scheduledRaids
    .filter((entry) => entry.atMs >= now && entry.atMs - perks.warningMs <= now)
    .sort((a, b) => a.atMs - b.atMs);
  if (raid === undefined) {
    return null;
  }
  const enemy = enemies[raid.enemy];
  const enemyLabel = sentenceCase(enemy.label);
  const sizeText = perks.revealsRaidSize ? enemy.sizes[raid.size] : null;
  return {
    enemy: raid.enemy,
    enemyLabel,
    inSeconds: realSecondsCeil(raid.atMs - now, timeScale),
    sizeText,
    text:
      sizeText === null
        ? `${enemyLabel} a caminho. Daqui os vigias ainda não distinguem quantos são.`
        : `${enemyLabel} a caminho. Os vigias contam ${sizeText}.`,
  };
}

export function threatView(state: GameState, timeScale: number): ThreatView {
  const watchtower = watchtowerView(state, timeScale);
  const defense = defenseView();
  if (!isThreatWatched(state)) {
    return {
      known: false,
      text: `Sem uma ${tower.label}, ninguém sabe o que ronda o feudo.`,
      incoming: null,
      watchtower,
      defense,
    };
  }
  const now = state.lastProcessedAt;
  const turn = nextDayBoundary(now);
  const level = state.map.threat;
  const nextLevel = threatAfterTurn(state, turn);
  const sources = threatSources(state, turn);
  const rise = sources.reduce((sum, source) => sum + source.amount, 0);
  const day = `a cada dia de jogo (${real(DAY_MS, timeScale)})`;
  const { tiles } = state.map;

  let trend: string;
  if (level >= rules.max) {
    trend = 'Está no máximo: não sobe mais.';
  } else if (rise === 0) {
    trend = 'Nada a faz subir hoje.';
  } else {
    const capped = nextLevel - level < rise ? ', até o máximo' : '';
    trend = `Sobe ${rise} ${day}${capped}: na próxima virada, vai de ${level} para ${nextLevel}.`;
  }

  return {
    known: true,
    text: `Ameaça ${level} de ${rules.max}.`,
    level,
    max: rules.max,
    risePerDay: nextLevel - level,
    nextLevel,
    nextRiseInSeconds: realSecondsCeil(turn - now, timeScale),
    trend,
    sources: sources.map((source) =>
      source.kind === 'tile'
        ? `+${source.amount}/dia: ${tileTypes[source.type].label}`
        : `+${source.amount}/dia: ${source.season.label.toLowerCase()}`,
    ),
    tiles: Object.keys(tiles)
      .sort()
      .flatMap((id) => {
        const tile = tiles[id];
        return tile === undefined
          ? []
          : [{ id, label: tileTypes[tile.type].label, active: tile.threatActive }];
      }),
    incoming: incomingView(state, timeScale),
    watchtower,
    defense,
  };
}
