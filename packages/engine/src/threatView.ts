import {
  balance,
  buildings,
  enemies,
  RAID_SIZE_IDS,
  type RaidSizeId,
  raidSizes,
  tileTypes,
} from '@lotg/content';

import { DAY_MS, nextDayBoundary } from './clock';
import { constructionOf } from './construction';
import { decimal, durationText, joinList, plural, sentenceCase, shareText } from './format';
import {
  isThreatWatched,
  palisadeAgainst,
  palisadeLevel,
  type PalisadeOutcome,
  prowlingEnemy,
  raidChancePercent,
  raidSizeAt,
  threatAfterTurn,
  threatSources,
  watchtowerLevel,
  watchtowerPerks,
} from './threat';
import type {
  BuildingId,
  EnemyId,
  GameState,
  ThreatDefenseView,
  ThreatIncomingView,
  ThreatView,
  ThreatWatchtowerView,
} from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * A Ameaça na visão (GDD §8.2): o que os vigias da Torre veem, em frases prontas e em tempo
 * real. **Sem a Torre de Vigia nada da Ameaça sai daqui**: nem o número, nem a tendência, nem
 * de onde ela vem, nem a incursão marcada. Sai só o que o jogador já sabe: que não tem Torre, o
 * que ela daria e o que protege o feudo (roadmap da v0.2, §0.7, "Visão e privacidade
 * narrativa"). Este módulo não sorteia nada.
 *
 * A Paliçada é do feudo, e o jogador a conhece: o que ela segura sai com ou sem Torre. Só a
 * frase sobre a incursão que vem (`incoming.defenseText`) depende dos vigias.
 */

const { threat: rules, raids } = balance;
const tower = buildings.watchtower;
const fence = buildings.palisade;

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

/** Os tamanhos de incursão que a Paliçada do nível `level` trata do jeito `kind`, do menor ao maior. */
function sizesBy(
  level: number,
  kind: PalisadeOutcome['kind'],
  among: readonly RaidSizeId[] = RAID_SIZE_IDS,
): RaidSizeId[] {
  return among.filter((size) => palisadeAgainst(level, size).kind === kind);
}

/** "leves", "leves e médios". */
const sizeNames = (sizes: readonly RaidSizeId[]) =>
  joinList(sizes.map((size) => raidSizes[size].plural));

/** "mas com metade do estrago": o que sobra de um ataque maior do que a Paliçada segura. */
const breachText = () => `mas com ${shareText(rules.palisadeBreach)} do estrago`;

/**
 * O que a Paliçada faz em um nível, para o meio de uma frase: "segura ataques leves, sem perda
 * nem ferido; os médios passam, mas com metade do estrago". No último nível não sobra tamanho
 * que passe, e a frase acaba em "ferido".
 */
function holdsText(level: number): string {
  const holds = `segura ataques ${sizeNames(sizesBy(level, 'held'))}, sem perda nem ferido`;
  const breached = sizesBy(level, 'breached');
  return breached.length === 0
    ? holds
    : `${holds}; os ${sizeNames(breached)} passam, ${breachText()}`;
}

/**
 * O que o nível `level` da Paliçada acrescenta ao anterior, para o meio de uma frase: "passa a
 * segurar também os ataques médios, sem perda nem ferido". No primeiro nível é tudo o que a
 * Paliçada faz. `null` em um nível que o conteúdo não descreve.
 */
function palisadeGainText(level: number): string | null {
  if (rules.palisadeLevels[level - 1] === undefined) {
    return null;
  }
  const before = new Set(sizesBy(level - 1, 'held'));
  const gained = sizesBy(level, 'held').filter((size) => !before.has(size));
  return before.size === 0 || gained.length === 0
    ? holdsText(level)
    : `passa a segurar também os ataques ${sizeNames(gained)}, sem perda nem ferido`;
}

/**
 * O que a obra da Paliçada muda, para ficar ao lado do custo. A construção: "Segura ataques
 * leves, sem perda nem ferido; os médios passam, mas com metade do estrago." A melhoria só diz
 * o que muda: "Passa a segurar também os ataques médios, sem perda nem ferido." `null` para os
 * outros edifícios e para um nível que o conteúdo não descreve.
 */
export function palisadeEffect(building: BuildingId, targetLevel: number): string | null {
  const gain = building === 'palisade' ? palisadeGainText(targetLevel) : null;
  return gain === null ? null : `${sentenceCase(gain)}.`;
}

/**
 * O que protege o feudo de um ataque hoje, e o que a próxima obra da Paliçada mudaria. Não
 * depende da Torre nem da Ameaça: só do nível da Paliçada. A frase fala de ataques pelo
 * tamanho, sem dizer de quem, e não promete o que esta versão não tem: nada danifica a
 * Paliçada, e o nível que segura hoje segura sempre.
 */
function defenseView(state: GameState): ThreatDefenseView {
  const level = palisadeLevel(state);
  const atCeiling = level >= fence.maxLevel;
  const built = () => `${fence.label} Nv${level}: ${holdsText(level)}.`;
  const gain = atCeiling ? null : palisadeGainText(level + 1);
  return {
    building: 'palisade',
    palisadeLevel: level,
    text:
      level === 0
        ? `Sem ${fence.label}, nada segura um ataque.`
        : atCeiling && fence.maxLevelNote !== undefined
          ? `${built()} ${fence.maxLevelNote}`
          : built(),
    next: gain === null ? null : `${fence.label} Nv${level + 1}: ${gain}.`,
  };
}

/**
 * A Paliçada que a incursão vai encontrar: o nível de hoje ou, com uma obra dela em curso que
 * termina até o instante do ataque, o nível dessa obra (as obras concluídas vêm antes da
 * incursão no mesmo instante). `work` diz se há obra e se ela chega a tempo.
 */
function palisadeAtRaid(
  state: GameState,
  raidAtMs: number,
): { level: number; work: 'none' | 'inTime' | 'late' } {
  const underway = constructionOf(state, 'palisade');
  if (underway === null) {
    return { level: palisadeLevel(state), work: 'none' };
  }
  return underway.finishesAtMs <= raidAtMs
    ? { level: underway.targetLevel, work: 'inTime' }
    : { level: palisadeLevel(state), work: 'late' };
}

/**
 * O que a Paliçada faz à incursão que vem, entre os tamanhos que ela pode ter: o único que os
 * vigias contaram, ou todos, enquanto a Torre não distingue. Com todos, a frase só depende do
 * nível da Paliçada, e por isso não conta o tamanho a quem não o vê.
 *
 * Quem recebe o aviso e manda erguer a Paliçada precisa saber se dá tempo: com a obra em
 * curso, a frase conta o nível com que o ataque vai encontrá-la ("que fica pronta a tempo") ou
 * diz que a obra só termina depois dele.
 */
function incomingDefenseText(
  { level, work }: ReturnType<typeof palisadeAtRaid>,
  sizes: readonly RaidSizeId[],
): string {
  const late = work === 'late' ? ' A obra em curso só termina depois dele.' : '';
  if (level === 0) {
    return `Sem ${fence.label}, nada segura este ataque.${late}`;
  }
  const built = `${sentenceCase(fence.article)} ${fence.label} Nv${level}`;
  const name = work === 'inTime' ? `${built}, que fica pronta a tempo,` : built;
  const held = sizesBy(level, 'held', sizes);
  const breached = sizes.filter((size) => !held.includes(size));
  if (breached.length === 0) {
    return `${name} segura este ataque: sem perda nem ferido.${late}`;
  }
  if (held.length === 0) {
    return `${name} não segura um ataque deste tamanho: ele passa, ${breachText()}.${late}`;
  }
  return `${name} segura este ataque se ele for dos ${sizeNames(held)}; se for dos ${sizeNames(
    breached,
  )}, ele passa, ${breachText()}.${late}`;
}

/** "comida e madeira": os recursos que um ataque leva, para o meio da frase. */
const lootNames = (enemy: EnemyId, size: RaidSizeId) =>
  joinList(
    raids.damage[enemy][size].resources.map((resource) =>
      balance.resources[resource].label.toLowerCase(),
    ),
  );

/** "10%": a parte do estoque que um ataque leva. */
const lossPercent = (enemy: EnemyId, size: RaidSizeId) => {
  const { num, den } = raids.damage[enemy][size].lossRatio;
  return `${decimal((num * 100) / den)}%`;
};

const injuredOf = (enemy: EnemyId, size: RaidSizeId) =>
  plural(raids.damage[enemy][size].injuries, 'aldeão', 'aldeões');

/**
 * O que a incursão que vem custa a um feudo sem defesa, para ficar ao lado do que a Paliçada
 * faz a ela. Com o tamanho à vista, a conta sai com o estoque de agora: "Sem defesa, uma
 * matilha grande leva 15% do estoque de comida e madeira (hoje, 48 de comida e 45 de madeira)
 * e fere 2 aldeões, que ficam 40 min sem trabalhar." Sem o tamanho, diz o que cada um custa, e
 * não o revela.
 */
function incomingCostText(
  state: GameState,
  enemy: EnemyId,
  sizes: readonly RaidSizeId[],
  timeScale: number,
): string {
  const rest = real(raids.injuryMs, timeScale);
  const [only] = sizes;
  if (sizes.length === 1 && only !== undefined) {
    const damage = raids.damage[enemy][only];
    const { num, den } = damage.lossRatio;
    const today = joinList(
      damage.resources.map((resource) => {
        const taken = Math.floor((state.settlement.resources[resource] * num) / den);
        return `${decimal(taken / MILLI, 1)} de ${balance.resources[resource].label.toLowerCase()}`;
      }),
    );
    const idle = damage.injuries === 1 ? 'que fica' : 'que ficam';
    return (
      `Sem defesa, ${enemies[enemy].sizes[only]} leva ${lossPercent(enemy, only)} do estoque de ` +
      `${lootNames(enemy, only)} (hoje, ${today}) e fere ${injuredOf(enemy, only)}, ${idle} ${rest} sem trabalhar.`
    );
  }
  const each = sizes.map(
    (size) =>
      `um ataque dos ${raidSizes[size].plural} leva ${lossPercent(enemy, size)} do estoque de ` +
      `${lootNames(enemy, size)} e fere ${injuredOf(enemy, size)}`,
  );
  return `Sem defesa, ${each.join('; ')}. Quem se fere fica ${rest} sem trabalhar.`;
}

/**
 * O que cada tamanho de incursão custa a um feudo sem defesa, um por linha, e o que fica depois:
 * "Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão." A última linha
 * diz quanto dura o ferimento e o que a moral perde. Vazio sem quem ataque.
 */
function raidCostsView(state: GameState, timeScale: number): string[] {
  const enemy = prowlingEnemy(state);
  if (enemy === null) {
    return [];
  }
  const days = plural(raids.moraleLossDays, 'dia de jogo', 'dias de jogo');
  return [
    ...RAID_SIZE_IDS.map(
      (size) =>
        `Ataques ${raidSizes[size].plural}: levam ${lossPercent(enemy, size)} do estoque de ` +
        `${lootNames(enemy, size)} e ferem ${injuredOf(enemy, size)}.`,
    ),
    `Quem se fere fica ${real(raids.injuryMs, timeScale)} sem trabalhar e volta ao ofício sozinho. ` +
      `Um ataque com perdas tira ${Math.abs(raids.moraleOnLosses)} da moral por ${days} ` +
      `(${real(raids.moraleLossDays * DAY_MS, timeScale)}).`,
  ];
}

/**
 * A regra das incursões por Ameaça, para quem a vê: a chance de a próxima virada do dia marcar
 * uma (com a Ameaça que essa virada vai dar), o prazo até ela chegar, o tamanho que a Ameaça
 * traz e a queda que toda incursão provoca. Com uma incursão à vista a chance é zero: só há uma
 * a caminho por vez. A frase não conta o que os vigias ainda não viram: a chance é a de "se não
 * houver outra a caminho".
 */
function raidRiskView(
  nextLevel: number,
  incoming: ThreatIncomingView | null,
  timeScale: number,
): { chancePercent: number; text: string } {
  const lead = real(rules.raidLeadMs, timeScale);
  const drop = `Toda incursão, repelida ou sofrida, baixa a Ameaça em ${rules.raidDrop}.`;
  if (incoming !== null) {
    return {
      chancePercent: 0,
      text: `Há uma incursão a caminho, e só há uma por vez: nenhuma outra é marcada até ela chegar. ${drop}`,
    };
  }
  const chancePercent = raidChancePercent(nextLevel);
  const rule = `a chance é o que a Ameaça passa de ${rules.raidChanceAbove}, em %`;
  if (chancePercent === 0) {
    return {
      chancePercent,
      text:
        `Com a Ameaça em ${rules.raidChanceAbove} ou menos, nenhuma incursão é marcada. Acima disso, ` +
        `cada virada do dia pode marcar uma (${rule}), e ela chega ${lead} depois. ${drop}`,
    };
  }
  const size = raidSizes[raidSizeAt(nextLevel)].plural;
  const others = RAID_SIZE_IDS.filter((id) => id !== raidSizeAt(nextLevel))
    .map((id) => raidSizes[id].plural)
    .join(', ');
  const sizes =
    nextLevel >= rules.mediumRaidAbove
      ? `Com a Ameaça em ${rules.mediumRaidAbove} ou mais, o ataque é dos ${size}; abaixo disso, dos ${others}.`
      : `Com a Ameaça abaixo de ${rules.mediumRaidAbove}, o ataque é dos ${size}; a partir daí, dos ${others}.`;
  return {
    chancePercent,
    text:
      `Se não houver outra a caminho, a próxima virada do dia tem ${chancePercent}% de chance de marcar uma incursão ` +
      `(${rule}); ela chega ${lead} depois. ${sizes} ${drop}`,
  };
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
  // Os tamanhos que a incursão pode ter, para quem olha da Torre: o que os vigias contaram, ou
  // todos, enquanto ela não distingue.
  const sizes: readonly RaidSizeId[] = perks.revealsRaidSize ? [raid.size] : RAID_SIZE_IDS;
  return {
    enemy: raid.enemy,
    enemyLabel,
    inSeconds: realSecondsCeil(raid.atMs - now, timeScale),
    sizeText,
    text:
      sizeText === null
        ? `${enemyLabel} a caminho. Daqui os vigias ainda não distinguem quantos são.`
        : `${enemyLabel} a caminho. Os vigias contam ${sizeText}.`,
    costText: incomingCostText(state, raid.enemy, sizes, timeScale),
    // Sem o tamanho à vista, a frase cobre todos: o que a Paliçada segura não o denuncia.
    defenseText: incomingDefenseText(palisadeAtRaid(state, raid.atMs), sizes),
  };
}

export function threatView(state: GameState, timeScale: number): ThreatView {
  const watchtower = watchtowerView(state, timeScale);
  const defense = defenseView(state);
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
  const incoming = incomingView(state, timeScale);
  const risk = raidRiskView(nextLevel, incoming, timeScale);

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
    raidChancePercent: risk.chancePercent,
    raidRisk: risk.text,
    raidCosts: raidCostsView(state, timeScale),
    incoming,
    watchtower,
    defense,
  };
}
