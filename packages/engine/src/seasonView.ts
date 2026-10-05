import { balance, type Ratio, RESOURCE_IDS, type SeasonDef } from '@lotg/content';

import {
  DAY_MS,
  inSeason,
  nextDayBoundary,
  nextSeasonBoundary,
  ofSeason,
  seasonAfter,
  seasonAt,
  seasonWithArticle,
} from './clock';
import { buildingWithArticle, ofBuilding } from './construction';
import { handsAt } from './craft';
import { type CraftForecast, craftForecast, type CraftOutlook, inMs } from './craftProjection';
import { firewoodRate, foodRunsOutIn, netRates, producerOf, productionRate } from './economy';
import { decimal, durationText, joinList, plural, sentenceCase, thousands } from './format';
import { planCost } from './planned';
import { planStartsIn } from './plannedView';
import { settleScarcity } from './scarcity';
import { endsInSeconds, reliefSentence } from './scarcityView';
import { cloneState } from './state';
import type {
  BuildingId,
  FirewoodView,
  FoodForecastView,
  GameState,
  ProductionBuildingId,
  ResourceId,
} from './types';
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
  /** Os edifícios das obras automáticas que levam a madeira de `numbers.reserved`. */
  reservedFor: BuildingId[];
  /** A estação da conta: a que queima a lenha. */
  season: SeasonDef;
  /**
   * O que falta não sai da soma da estação: a Serraria repõe o bastante até o fim, mas só
   * alcança a lareira mais adiante, e a lenha acaba antes disso (`neededBeforeEnd`).
   */
  catchesUpLate: boolean;
};

/**
 * O que a conta da lenha precisa além do estado: o ritmo, a moral da próxima virada do dia e as
 * taxas e a projeção com que a visão diz quando cada planejada começa.
 */
export type FirewoodContext = {
  timeScale: number;
  nextMorale: number;
  rates: Record<ResourceId, number>;
  forecast: CraftForecast;
  /** O que a visão já previu: daqui sai o fim do frio, quando ele passa sozinho. */
  outlook: CraftOutlook;
};

/** A madeira que uma obra automática leva do estoque, em milésimos, e o instante em que começa. */
type WoodTaken = { atMs: number; milli: number };

/**
 * A madeira que as planejadas automáticas vão levar do estoque até `untilMs`, em unidades, de
 * que edifícios são e quando cada uma começa. O motor as inicia sozinho assim que podem começar, sem olhar a lenha
 * (GDD §6.3): uma conta que as ignorasse diria "dão conta", e o frio abriria na ausência.
 *
 * Entram as que esperam algo que chega antes de `untilMs` (o recurso que a produção junta, a
 * fila, a obra anterior), na ordem em que devem começar, e cada uma só leva o que ainda há em
 * `poolMilli` (o estoque e o que a Serraria junta antes da estação): a que pede mais madeira do
 * que sobrou não começa com a lareira acesa. As manuais e as que esperam uma ordem do jogador
 * ficam de fora. É uma previsão, como o prazo de cada planejada: vale enquanto nada mais mudar
 * as taxas.
 */
function autoStartWood(
  state: GameState,
  untilMs: number,
  poolMilli: number,
  { rates, forecast }: FirewoodContext,
): { units: number; buildings: BuildingId[]; starts: WoodTaken[] } {
  const now = state.lastProcessedAt;
  const starting = state.settlement.planned
    .filter((plan) => plan.autoStart && (planCost(plan).wood ?? 0) > 0)
    .map((plan) => ({ plan, startsIn: planStartsIn(state, plan, rates, forecast) }))
    .filter(
      (entry): entry is typeof entry & { startsIn: number } =>
        entry.startsIn !== null && now + entry.startsIn < untilMs,
    )
    // A ordem em que começam; no empate, a da lista (a ordenação é estável).
    .sort((a, b) => a.startsIn - b.startsIn);
  let left = poolMilli;
  let units = 0;
  const buildings: BuildingId[] = [];
  const starts: WoodTaken[] = [];
  for (const { plan, startsIn } of starting) {
    const wood = planCost(plan).wood ?? 0;
    if (wood * MILLI <= left) {
      left -= wood * MILLI;
      units += wood;
      buildings.push(plan.building);
      starts.push({ atMs: now + startsIn, milli: wood * MILLI });
    }
  }
  return { units, buildings, starts };
}

/**
 * Um trecho da conta da Serraria: de `fromMs` a `toMs` ela entrega `rate` por hora, e já tinha
 * entregado `before` (milésimos × ms por hora) quando o trecho começou.
 */
type ProductionStretch = { fromMs: number; toMs: number; rate: number; before: number };

/**
 * O que `building` entrega de `fromMs` a `toMs`, com os fatores de `season` e os trabalhadores
 * de agora. Quem ainda se adapta rende a fração só até o fim da adaptação: a conta é feita
 * trecho a trecho, cortando em cada leva que termina no caminho.
 *
 * A moral também corta a conta: até a próxima virada do dia vale a de agora, e dali em diante
 * `nextMorale`, a que essa virada vai calcular se nada mudar. No frio é ela que pesa: a conta
 * da lenha não promete a madeira que a moral mais baixa não vai entregar.
 *
 * Sai um trecho por corte, em ordem: o total é o que o último deixa (`producedUntil`), e os do
 * meio servem a quem precisa da ordem dos acontecimentos (`neededBeforeEnd`).
 */
function producedBetween(
  state: GameState,
  building: ProductionBuildingId,
  season: SeasonDef,
  fromMs: number,
  toMs: number,
  nextMorale: number,
): ProductionStretch[] {
  const turn = nextDayBoundary(state.lastProcessedAt);
  const afterTurn: GameState = {
    ...state,
    settlement: { ...state.settlement, morale: nextMorale },
  };
  const ends = state.settlement.adaptation
    .filter((cohort) => cohort.building === building)
    .map((cohort) => cohort.untilMs);
  const inside = [...ends, turn].filter((cut) => cut > fromMs && cut < toMs);
  const cuts = [fromMs, ...[...new Set(inside)].sort((a, b) => a - b), toMs];
  const stretches: ProductionStretch[] = [];
  let total = 0;
  for (let index = 0; index + 1 < cuts.length; index += 1) {
    const start = cuts[index] as number;
    const end = cuts[index + 1] as number;
    const rate = productionRate(
      start >= turn ? afterTurn : state,
      building,
      handsAt(state, building, start),
      season,
    );
    stretches.push({ fromMs: start, toMs: end, rate, before: total });
    total += rate * (end - start);
  }
  return stretches;
}

/** O que os trechos entregam até `atMs`, em milésimos × ms por hora. */
function producedUntil(stretches: readonly ProductionStretch[], atMs: number): number {
  let total = 0;
  for (const stretch of stretches) {
    if (atMs <= stretch.fromMs) {
      break;
    }
    total = stretch.before + stretch.rate * (Math.min(atMs, stretch.toMs) - stretch.fromMs);
  }
  return total;
}

/**
 * O estoque que a lareira pede em algum instante **antes** do fim da conta, em milésimos: o
 * quanto ela, que queima `burned` por hora desde `fromMs`, passa à frente do que a Serraria já
 * entregou, mais a madeira que as obras automáticas já levaram até ali (`taken`). Zero quando a
 * Serraria nunca fica para trás e nenhuma obra começa.
 *
 * É o que a soma da estação inteira não vê: a Serraria que só alcança a lareira depois da
 * próxima virada do dia (a moral sobe) ou do fim de uma adaptação repõe mais do que a estação
 * queima, e mesmo assim a lenha acaba antes, se o estoque não paga a diferença até lá. Entre
 * dois cortes as taxas não mudam, e a obra que começa leva a madeira de uma vez: o maior pedido
 * está sempre em um corte ou no instante em que uma obra começa.
 */
function neededBeforeEnd(
  stretches: readonly ProductionStretch[],
  burned: number,
  taken: readonly WoodTaken[],
): number {
  const fromMs = stretches[0]?.fromMs ?? 0;
  const toMs = stretches[stretches.length - 1]?.toMs ?? fromMs;
  const moments = [
    fromMs,
    ...stretches.slice(1).map((stretch) => stretch.fromMs),
    ...taken.map((start) => start.atMs).filter((atMs) => atMs > fromMs && atMs < toMs),
  ];
  let worst = 0;
  for (const atMs of moments) {
    const behind = Math.ceil((burned * (atMs - fromMs) - producedUntil(stretches, atMs)) / HOUR_MS);
    const gone = taken.reduce((sum, start) => (start.atMs <= atMs ? sum + start.milli : sum), 0);
    worst = Math.max(worst, behind + gone);
  }
  return worst;
}

/**
 * O feudo como a próxima virada de estação deve encontrá-lo: a projeção do ofício até ela, com
 * os fatores de agora, e o relógio da cópia posto na virada (a estação já é a outra, e a fome e
 * o frio se acomodam como no motor). `null` quando a comida ou a lenha acabam antes: dali em
 * diante a visão não adivinha.
 */
export function stateAtNextSeason(state: GameState, forecast: CraftForecast): GameState | null {
  const turn = nextSeasonBoundary(state.lastProcessedAt);
  const found = forecast.stateAt(turn);
  if (found === null) {
    return null;
  }
  // Uma cópia inteira: o acerto de fome e frio mexe em listas que a projeção divide com o estado.
  const atTurn = cloneState(found);
  atTurn.lastProcessedAt = turn;
  atTurn.clock.gameTimeMs = turn;
  settleScarcity(atTurn, turn, []);
  return atTurn;
}

/**
 * O feudo como o começo de uma estação mais à frente deve encontrá-lo: a mesma projeção, uma
 * estação de cada vez, cada uma com os seus fatores, a partir do que a próxima virada encontra
 * (`atNextSeason`). `null` quando a comida ou a lenha acabam no caminho.
 */
function stateAtSeasonStart(atNextSeason: GameState | null, startsMs: number): GameState | null {
  let current = atNextSeason;
  // O calendário tem poucas estações: o laço acaba em no máximo uma volta por elas.
  for (let turns = 0; turns < balance.calendar.seasons.length; turns += 1) {
    if (current === null || current.lastProcessedAt >= startsMs) {
      return current;
    }
    current = stateAtNextSeason(current, craftForecast(current));
  }
  return null;
}

/**
 * A conta da lenha de `season` entre `fromMs` e `toMs` de jogo, com os habitantes e os
 * trabalhadores de agora: o que a lareira queima, o que a Serraria entrega, o que as obras
 * automáticas levam e o que o estoque ainda precisa ter. A lenha é arredondada para cima e a
 * produção para baixo, para a conta nunca prometer mais do que o inverno entrega.
 *
 * `atStart` é o feudo como o começo da estação deve encontrá-lo, quando ela ainda não chegou:
 * o que a Serraria junta até lá entra na conta, até onde o depósito guarda. Sem ele (dentro da
 * estação, ou quando a projeção não chega lá), vale só o estoque de agora.
 */
function countFirewood(
  state: GameState,
  season: SeasonDef,
  fromMs: number,
  toMs: number,
  context: FirewoodContext,
  atStart: GameState | null = null,
): FirewoodCount {
  const { timeScale, nextMorale } = context;
  const producer = producerOf('wood');
  const burned = firewoodRate(state, season);
  const winterTotal = Math.ceil((burned * (toMs - fromMs)) / HOUR_MS / MILLI);
  const stretches = producedBetween(state, producer, season, fromMs, toMs, nextMorale);
  const winterProduction = Math.floor(producedUntil(stretches, toMs) / HOUR_MS / MILLI);
  const stockMilli = state.settlement.resources.wood;
  const stock = Math.floor(stockMilli / MILLI);
  const foundMilli = Math.max(stockMilli, atStart?.settlement.resources.wood ?? 0);
  const gathered = Math.floor(foundMilli / MILLI) - stock;
  const reserved = autoStartWood(state, toMs, foundMilli, context);
  // A soma da estação inteira, e a ordem dos acontecimentos: a lenha que acaba antes de a
  // Serraria alcançar a lareira falta agora, mesmo quando a soma fecha.
  const atEnd = Math.max(0, winterTotal - winterProduction - (stock + gathered - reserved.units));
  const before = Math.max(
    0,
    Math.ceil((neededBeforeEnd(stretches, burned, reserved.starts) - foundMilli) / MILLI),
  );
  return {
    numbers: {
      perHour: (burned * timeScale) / MILLI,
      winterTotal,
      winterProduction,
      stock,
      gathered,
      reserved: reserved.units,
      missing: Math.max(atEnd, before),
    },
    villagers: state.settlement.population.villagers,
    lumberMill: buildingWithArticle(producer),
    reservedFor: reserved.buildings,
    season,
    catchesUpLate: before > atEnd,
  };
}

/**
 * A segunda frase da conta: o que a Serraria repõe, o que há e o que falta; ou que dá conta.
 * Antes da estação, o que a Serraria junta até lá é uma parcela à parte. Quando uma obra
 * automática vai levar madeira do estoque, a frase diz qual e quanto: com falta, vem junto o
 * que fazer (mais gente na Serraria, ou a obra esperar a ordem do jogador).
 *
 * Quando o que falta não sai da soma (`catchesUpLate`), a frase diz por quê: a Serraria repõe o
 * bastante até o fim, mas só alcança a lareira mais adiante, e é antes disso que a lenha falta.
 */
function firewoodSums({
  numbers,
  lumberMill,
  reservedFor,
  season,
  catchesUpLate,
}: FirewoodCount): string {
  const wood = balance.resources.wood.label.toLowerCase();
  const { gathered, missing, reserved, stock, winterProduction } = numbers;
  const [only] = reservedFor;
  const single = reservedFor.length === 1 && only !== undefined;
  const takes = single ? `a obra planejada ${ofBuilding(only)} leva` : 'as obras planejadas levam';
  if (missing > 0) {
    const sources =
      gathered > 0
        ? `${sentenceCase(lumberMill)} junta ${gathered} até lá e repõe ${winterProduction} ${inSeason(season)}, e há ${stock} em estoque`
        : `${sentenceCase(lumberMill)} repõe ${winterProduction} e há ${stock} em estoque`;
    const short = catchesUpLate
      ? `antes disso faltam ${missing} de ${wood}.`
      : `faltam ${missing} de ${wood}.`;
    if (reserved === 0) {
      return catchesUpLate
        ? `${sources}, mas a reposição só alcança a lareira mais adiante: ${short}`
        : `${sources}: ${short}`;
    }
    const alone = single ? 'quando começar sozinha' : 'quando começarem sozinhas';
    const late = catchesUpLate ? ', e a reposição só alcança a lareira mais adiante' : '';
    return (
      `${sources}, mas ${takes} ${reserved} ${alone}${late}: ${short} ` +
      `Mande gente para ${lumberMill} ou desligue o início automático.`
    );
  }
  return reserved === 0
    ? `O estoque e ${lumberMill} dão conta.`
    : `O estoque e ${lumberMill} dão conta, mesmo com os ${reserved} que ${takes}.`;
}

/** A próxima estação que queima lenha, vista de antes: qual é, quando começa e a conta dela. */
export type FirewoodAhead = { season: SeasonDef; startsMs: number; firewood: FirewoodView };

/**
 * A previsão da lenha da próxima estação que queima madeira: o inverno inteiro, visto de antes,
 * seja ele a próxima estação ou não. No ritmo Rápido o outono é mais curto do que um dia de
 * relógio: quem sai no fim do verão volta com o inverno pela metade, e precisa da conta antes.
 * `null` quando a estação de agora já queima lenha: aí a conta é a de `winterView`.
 *
 * `atNextSeason` é o feudo como a próxima virada de estação deve encontrá-lo (`stateAtNextSeason`):
 * dali a projeção segue até o começo do inverno, e o que a Serraria junta no caminho entra na
 * conta. `context.nextMorale` é a moral que a próxima virada do dia vai calcular: é com ela que
 * a Serraria rende no inverno.
 */
export function firewoodForecast(
  state: GameState,
  context: FirewoodContext,
  atNextSeason: GameState | null,
): FirewoodAhead | null {
  const now = state.lastProcessedAt;
  if (seasonAt(now).effects.firewoodPerVillagerPerHour.num > 0) {
    return null;
  }
  let season = seasonAfter(seasonAt(now));
  let startsMs = nextSeasonBoundary(now);
  // Cada estação é visitada uma vez: se nenhuma queima lenha, não há o que prever.
  for (let ahead = 1; season.effects.firewoodPerVillagerPerHour.num === 0; ahead += 1) {
    if (ahead >= balance.calendar.seasons.length) {
      return null;
    }
    startsMs += season.days * DAY_MS;
    season = seasonAfter(season);
  }
  const count = countFirewood(
    state,
    season,
    startsMs,
    startsMs + season.days * DAY_MS,
    context,
    stateAtSeasonStart(atNextSeason, startsMs),
  );
  const wood = balance.resources.wood.label.toLowerCase();
  const people = plural(count.villagers, 'habitante', 'habitantes');
  return {
    season,
    startsMs,
    firewood: {
      ...count.numbers,
      text: `${sentenceCase(seasonWithArticle(season))} vai queimar ${count.numbers.winterTotal} de ${wood} com ${people}. ${firewoodSums(count)}`,
    },
  };
}

/** Segundos reais (para baixo) de uma duração em ms de jogo. */
function realSecondsFloor(gameMs: number, timeScale: number): number {
  return Math.max(0, Math.floor(gameMs / timeScale / SECOND_MS));
}

/**
 * A previsão da comida da próxima estação (GDD §4.1 e §5.6): o saldo logo depois da virada e,
 * se ele não cobre as bocas, quando a comida acaba. O prazo de agora (`depletesInSeconds`) só
 * olha a estação de agora: no outono, com a Fazenda rendendo mais, ele se cala, e é o inverno
 * que esvazia a despensa.
 *
 * A conta é a da projeção do ofício, duas vezes. Primeiro até a virada, com os fatores de
 * agora: é o estoque, a experiência e a moral que a virada deve encontrar. Depois, com o
 * relógio posto na virada (a estação já é a outra, e a fome e o frio se acomodam como no
 * motor), pela estação que vem, virada de dia a virada de dia. Como toda previsão da visão,
 * conta com os habitantes e os trabalhadores de agora e não sorteia nada.
 *
 * `atTurn` é o feudo como a virada deve encontrá-lo (`stateAtNextSeason`). `null` com fome
 * aberta e quando a comida ou a lenha acabam antes da virada: aí o alarme é o da estação de
 * agora, e dali em diante a visão não adivinha.
 */
export function foodForecast(
  state: GameState,
  timeScale: number,
  atTurn: GameState | null,
): FoodForecastView | null {
  if (state.settlement.famine !== null || atTurn === null) {
    return null;
  }
  const now = state.lastProcessedAt;
  const next = seasonAfter(seasonAt(now));
  const turn = atTurn.lastProcessedAt;

  const rate = netRates(atTurn).food;
  const perHour = (rate * timeScale) / MILLI;
  const stockAtTurn = Math.floor(atTurn.settlement.resources.food / MILLI);
  const farm = buildingWithArticle(producerOf('food'));
  const food = balance.resources.food.label.toLowerCase();
  const lead = `Com a gente de agora n${farm}, o saldo de ${food} ${inSeason(next)} será de ${rate >= 0 ? '+' : '−'}${decimal(Math.abs(perHour))}/h`;
  const numbers = { perHour: Math.round(perHour * 10) / 10, stockAtTurn };
  if (rate >= 0) {
    return { ...numbers, depletesInSeconds: null, text: `${lead}.` };
  }
  const remedy = `Mande mais gente para ${farm} ou guarde ${food} antes.`;
  const stock = `o estoque de ${thousands(stockAtTurn)} que a virada encontra`;
  if (atTurn.settlement.famine !== null) {
    return {
      ...numbers,
      depletesInSeconds: realSecondsFloor(turn - now, timeScale),
      text: `${lead}, e a virada encontra o estoque vazio: a fome começa com ela. ${remedy}`,
    };
  }
  const ahead = craftForecast(atTurn);
  const seasonEnd = turn + next.days * DAY_MS;
  const runsOut = ahead.find(
    (stretch, rates) => inMs(foodRunsOutIn(stretch, rates)),
    seasonEnd,
  )?.inMs;
  if (runsOut !== undefined) {
    // Para baixo, ao minuto (`durationText` arredonda para cima a partir de dez minutos): a
    // frase nunca promete mais comida do que há.
    const seconds = realSecondsFloor(runsOut, timeScale);
    const afterTurn = seconds < 600 ? seconds : Math.floor(seconds / 60) * 60;
    return {
      ...numbers,
      depletesInSeconds: realSecondsFloor(turn - now + runsOut, timeScale),
      text: `${lead}: ${stock} acaba ${durationText(afterTurn)} depois dela. ${remedy}`,
    };
  }
  return {
    ...numbers,
    depletesInSeconds: null,
    text:
      ahead.stateAt(seasonEnd) === null
        ? // A projeção parou antes do fim da estação: a lenha acaba primeiro.
          `${lead}. A lenha acaba antes da ${food}: com o frio, ${farm} rende menos ainda.`
        : `${lead}: ${stock} atravessa a estação.`,
  };
}

/**
 * A estação da lenha, vista de dentro: o que a lareira queima, a conta do que falta até a
 * estação virar e, se a madeira acabou, o frio, com o que ele custa e o que fazer. `null` nas
 * estações que não queimam lenha.
 */
export function winterView(
  state: GameState,
  context: FirewoodContext,
): {
  firewoodPerHour: number;
  firewood: FirewoodView;
  cold: null | { secondsElapsed: number; endsInSeconds: number | null; text: string };
} | null {
  const now = state.lastProcessedAt;
  const season = seasonAt(now);
  if (season.effects.firewoodPerVillagerPerHour.num === 0) {
    return null;
  }
  const next = seasonAfter(season);
  const { timeScale } = context;
  const count = countFirewood(state, season, now, nextSeasonBoundary(now), context);
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
  const { coldEndsIn } = context.outlook;
  const balanceNow = `A lareira pede ${decimal(numbers.perHour)}/h e ${count.lumberMill} entrega ${decimal(produced)}/h`;
  // Quando o frio passa sozinho (o lenhador que ainda se adapta vai render inteiro, ou a fome
  // que cortava a Serraria acaba), a frase diz isso e o prazo, em vez de pedir a madeira que já
  // está a caminho. A conta do que faltaria, feita com as penalidades de agora, sai da frase:
  // o frio passa antes, e as duas juntas se desmentiriam.
  const ending =
    coldEndsIn === null
      ? `${balanceNow}: o frio passa quando sobrar ${wood}, ou ${inSeason(next)}.${shortfall}`
      : `${balanceNow}. ${reliefSentence(state, 'cold', coldEndsIn, timeScale)}`;
  return {
    firewoodPerHour: numbers.perHour,
    firewood,
    cold: {
      secondsElapsed: realSecondsFloor(now - cold.sinceMs, timeScale),
      endsInSeconds: endsInSeconds(coldEndsIn, timeScale),
      text:
        `Frio: sem lenha, a produção de todo o feudo cai para ${Math.round((num * 100) / den)}%. ` +
        ending,
    },
  };
}
