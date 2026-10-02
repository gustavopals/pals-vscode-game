import { balance, type Ratio, RESOURCE_IDS, type SeasonDef } from '@lotg/content';

import {
  DAY_MS,
  inSeason,
  nextSeasonBoundary,
  ofSeason,
  seasonAfter,
  seasonAt,
  seasonWithArticle,
} from './clock';
import { buildingWithArticle } from './construction';
import { handsAt } from './craft';
import { firewoodRate, producerOf, productionRate } from './economy';
import { decimal, joinList, plural, sentenceCase } from './format';
import type { FirewoodView, GameState, ProductionBuildingId } from './types';
import { HOUR_MS, MILLI, SECOND_MS } from './units';

const isNeutral = (ratio: Ratio) => ratio.num === ratio.den;
const sameRatio = (a: Ratio, b: Ratio) => a.num * b.den === b.num * a.den;
const times = (ratio: Ratio) => `× ${decimal(ratio.num / ratio.den)}`;

/** Agrupa os recursos que têm a mesma chave, na ordem canônica: "madeira e pedra". */
function groupResources<T>(
  keyOf: (resource: (typeof RESOURCE_IDS)[number]) => T | null,
  same: (a: T, b: T) => boolean,
): Array<{ key: T; labels: string }> {
  const groups: Array<{ key: T; names: string[] }> = [];
  for (const id of RESOURCE_IDS) {
    const key = keyOf(id);
    if (key === null) {
      continue;
    }
    const name = balance.resources[id].label.toLowerCase();
    const group = groups.find((entry) => same(entry.key, key));
    if (group === undefined) {
      groups.push({ key, names: [name] });
    } else {
      group.names.push(name);
    }
  }
  return groups.map(({ key, names }) => ({ key, labels: joinList(names) }));
}

/** "0,5 de madeira por habitante por hora", por hora real. */
function firewoodPerVillager(season: SeasonDef, timeScale: number): string {
  const { num, den } = season.effects.firewoodPerVillagerPerHour;
  const wood = balance.resources.wood.label.toLowerCase();
  return `${decimal((num / den) * timeScale)} de ${wood} por habitante por hora`;
}

/** O que a estação muda, em uma frase: "Outono: comida × 1,3; ouro × 1,1." */
export function seasonEffectsText(season: SeasonDef, timeScale: number): string {
  const { production, recruitmentDuration, constructionDuration, firewoodPerVillagerPerHour } =
    season.effects;
  const parts = groupResources(
    (id) => (isNeutral(production[id]) ? null : production[id]),
    sameRatio,
  ).map(({ key, labels }) => `${labels} ${times(key)}`);
  if (!isNeutral(recruitmentDuration)) {
    parts.push(`recrutamento com prazo ${times(recruitmentDuration)}`);
  }
  if (!isNeutral(constructionDuration)) {
    parts.push(`obras iniciadas com prazo ${times(constructionDuration)}`);
  }
  if (firewoodPerVillagerPerHour.num > 0) {
    parts.push(`a lareira queima ${firewoodPerVillager(season, timeScale)}`);
  }
  return parts.length === 0
    ? `${season.label}: nada muda na produção nem nos prazos.`
    : `${season.label}: ${parts.join('; ')}.`;
}

/** Uma frase para cada coisa que muda na virada de `from` para `to`. */
export function seasonChanges(from: SeasonDef, to: SeasonDef, timeScale: number): string[] {
  const changes = groupResources<[Ratio, Ratio]>(
    (id) => {
      const before = from.effects.production[id];
      const after = to.effects.production[id];
      return sameRatio(before, after) ? null : [before, after];
    },
    (a, b) => sameRatio(a[0], b[0]) && sameRatio(a[1], b[1]),
  ).map(
    ({ key: [before, after], labels }) =>
      `A produção de ${labels} passa de ${times(before)} para ${times(after)}.`,
  );

  const recruitBefore = from.effects.recruitmentDuration;
  const recruitAfter = to.effects.recruitmentDuration;
  if (!sameRatio(recruitBefore, recruitAfter)) {
    changes.push(
      isNeutral(recruitAfter)
        ? 'O recrutamento volta ao prazo de sempre.'
        : `O prazo de um recrutamento ordenado ${inSeason(to)} é ${times(recruitAfter)}.`,
    );
  }
  const buildBefore = from.effects.constructionDuration;
  const buildAfter = to.effects.constructionDuration;
  if (!sameRatio(buildBefore, buildAfter)) {
    changes.push(
      isNeutral(buildAfter)
        ? 'As obras voltam ao prazo de sempre.'
        : `O prazo de uma obra iniciada ${inSeason(to)} é ${times(buildAfter)}.`,
    );
  }
  const burnsBefore = from.effects.firewoodPerVillagerPerHour.num > 0;
  const burnsAfter = to.effects.firewoodPerVillagerPerHour.num > 0;
  if (burnsAfter) {
    changes.push(
      `A lareira passa a queimar ${firewoodPerVillager(to, timeScale)}; sem madeira, vem o frio.`,
    );
  } else if (burnsBefore) {
    changes.push('Ninguém queima mais lenha: o frio, se houver, passa.');
  }
  return changes;
}

/** "No Inverno, o prazo de uma obra iniciada agora é × 1,5."; `null` se a estação não mexe nele. */
export function constructionDurationNote(season: SeasonDef): string | null {
  const factor = season.effects.constructionDuration;
  return isNeutral(factor)
    ? null
    : `${sentenceCase(inSeason(season))}, o prazo de uma obra iniciada agora é ${times(factor)}.`;
}

/** "Na Primavera, o prazo de um recrutamento ordenado agora é × 0,8."; `null` sem efeito. */
export function recruitmentDurationNote(season: SeasonDef): string | null {
  const factor = season.effects.recruitmentDuration;
  return isNeutral(factor)
    ? null
    : `${sentenceCase(inSeason(season))}, o prazo de um recrutamento ordenado agora é ${times(factor)}.`;
}

/** A conta da lenha em números, e o que as frases precisam além deles. */
type FirewoodCount = {
  numbers: Omit<FirewoodView, 'text'>;
  villagers: number;
  /** "a Serraria". */
  lumberMill: string;
};

/**
 * O que `building` entrega de `fromMs` a `toMs`, em milésimos × ms por hora, com os fatores de
 * `season` e os trabalhadores de agora. Quem ainda se adapta rende a fração só até o fim da
 * adaptação: a conta é feita trecho a trecho, cortando em cada leva que termina no caminho.
 */
function producedBetween(
  state: GameState,
  building: ProductionBuildingId,
  season: SeasonDef,
  fromMs: number,
  toMs: number,
): number {
  const ends = state.settlement.adaptation
    .filter((cohort) => cohort.building === building)
    .map((cohort) => cohort.untilMs)
    .filter((untilMs) => untilMs > fromMs && untilMs < toMs);
  const cuts = [fromMs, ...[...new Set(ends)].sort((a, b) => a - b), toMs];
  let total = 0;
  for (let index = 0; index + 1 < cuts.length; index += 1) {
    const start = cuts[index] as number;
    const rate = productionRate(state, building, handsAt(state, building, start), season);
    total += rate * ((cuts[index + 1] as number) - start);
  }
  return total;
}

/**
 * A conta da lenha de `season` entre `fromMs` e `toMs` de jogo, com os habitantes e os
 * trabalhadores de agora: o que a lareira queima, o que a Serraria entrega e o que o estoque
 * ainda precisa ter. A lenha é arredondada para cima e a produção para baixo, para a conta
 * nunca prometer mais do que o inverno entrega.
 */
function countFirewood(
  state: GameState,
  season: SeasonDef,
  fromMs: number,
  toMs: number,
  timeScale: number,
): FirewoodCount {
  const producer = producerOf('wood');
  const burned = firewoodRate(state, season);
  const winterTotal = Math.ceil((burned * (toMs - fromMs)) / HOUR_MS / MILLI);
  const winterProduction = Math.floor(
    producedBetween(state, producer, season, fromMs, toMs) / HOUR_MS / MILLI,
  );
  const stock = Math.floor(state.settlement.resources.wood / MILLI);
  return {
    numbers: {
      perHour: (burned * timeScale) / MILLI,
      winterTotal,
      winterProduction,
      stock,
      missing: Math.max(0, winterTotal - winterProduction - stock),
    },
    villagers: state.settlement.population.villagers,
    lumberMill: buildingWithArticle(producer),
  };
}

/** A segunda frase da conta: o que a Serraria repõe, o que há e o que falta; ou que dá conta. */
function firewoodSums({ numbers, lumberMill }: FirewoodCount): string {
  const wood = balance.resources.wood.label.toLowerCase();
  return numbers.missing > 0
    ? `${sentenceCase(lumberMill)} repõe ${numbers.winterProduction} e há ${numbers.stock} em estoque: faltam ${numbers.missing} de ${wood}.`
    : `O estoque e ${lumberMill} dão conta.`;
}

/**
 * A previsão da lenha da próxima estação, quando ela queima madeira: o inverno inteiro, visto
 * de antes. `null` quando a próxima estação não queima nada.
 */
export function firewoodForecast(state: GameState, timeScale: number): FirewoodView | null {
  const next = seasonAfter(seasonAt(state.lastProcessedAt));
  if (next.effects.firewoodPerVillagerPerHour.num === 0) {
    return null;
  }
  const starts = nextSeasonBoundary(state.lastProcessedAt);
  const count = countFirewood(state, next, starts, starts + next.days * DAY_MS, timeScale);
  const wood = balance.resources.wood.label.toLowerCase();
  const people = plural(count.villagers, 'habitante', 'habitantes');
  return {
    ...count.numbers,
    text: `${sentenceCase(seasonWithArticle(next))} vai queimar ${count.numbers.winterTotal} de ${wood} com ${people}. ${firewoodSums(count)}`,
  };
}

/** Segundos reais (para baixo) de uma duração em ms de jogo. */
function realSecondsFloor(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.floor(gameMs / timeScale / SECOND_MS));
}

/**
 * A estação da lenha, vista de dentro: o que a lareira queima, a conta do que falta até a
 * estação virar e, se a madeira acabou, o frio, com o que ele custa e o que fazer. `null` nas
 * estações que não queimam lenha.
 */
export function winterView(
  state: GameState,
  timeScale: number,
): {
  firewoodPerHour: number;
  firewood: FirewoodView;
  cold: null | { secondsElapsed: number; text: string };
} | null {
  const now = state.lastProcessedAt;
  const season = seasonAt(now);
  if (season.effects.firewoodPerVillagerPerHour.num === 0) {
    return null;
  }
  const next = seasonAfter(season);
  const count = countFirewood(state, season, now, nextSeasonBoundary(now), timeScale);
  const { numbers } = count;
  const wood = balance.resources.wood.label.toLowerCase();
  const firewood: FirewoodView = {
    ...numbers,
    text: `Até ${seasonWithArticle(next)} a lareira ainda queima ${numbers.winterTotal} de ${wood}. ${firewoodSums(count)}`,
  };

  const { cold } = state.settlement;
  if (cold === null) {
    return { firewoodPerHour: numbers.perHour, firewood, cold: null };
  }
  const { num, den } = balance.winter.cold.productionMultiplier;
  const produced = (productionRate(state, producerOf('wood')) * timeScale) / MILLI;
  const shortfall =
    numbers.missing > 0
      ? ` Faltam ${numbers.missing} de ${wood} para atravessar o resto ${ofSeason(season)}.`
      : '';
  return {
    firewoodPerHour: numbers.perHour,
    firewood,
    cold: {
      secondsElapsed: realSecondsFloor(now - cold.sinceMs, timeScale),
      text:
        `Frio: sem lenha, a produção de todo o feudo cai para ${Math.round((num * 100) / den)}%. ` +
        `A lareira pede ${decimal(numbers.perHour)}/h e ${count.lumberMill} entrega ${decimal(produced)}/h: ` +
        `o frio passa quando sobrar ${wood}, ou ${inSeason(next)}.${shortfall}`,
    },
  };
}
