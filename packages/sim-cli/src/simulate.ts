import {
  advanceTo,
  applyCommand,
  type BuildingId,
  type Command,
  createInitialState,
  deriveViewState,
  type DifficultyId,
  type GameEvent,
  type GameState,
  type MoraleBandId,
  type ResourceId,
  type SeasonId,
  type ViewState,
} from '@lotg/engine';

import { botFor, strategies, type StrategyName } from './bots';
import { nothingLeftToBuild } from './bots/policies';
import type { Act, Bot } from './bots/types';

const HOUR_MS = 3_600_000;
const HOURS_PER_REAL_DAY = 24;

export { strategies, type StrategyName };

export type SimulationOptions = {
  seed: string;
  /** Dias reais simulados; no ritmo Normal, 7 dias são um ano de jogo. */
  days: number;
  /**
   * Duração em horas reais, para as janelas que não fecham em dias inteiros (um ano de jogo no
   * ritmo 3 são 56 h reais). Quando presente, vale no lugar de `days`.
   */
  hours?: number;
  strategy: StrategyName;
  /** Sessões por dia real, a intervalos iguais. */
  sessionsPerDay: number;
  /**
   * Horas de jogo por hora real (ADR 0011). Padrão 1, o ritmo Normal do GDD; o jogo recomenda o
   * 3. As faixas de balanceamento existem para cada ritmo que o jogo oferece (`bands.ts`).
   */
  timeScale?: number;
  /** Dificuldade da partida (GDD §12.1). Padrão `lord`, a de quem não escolhe. */
  difficulty?: DifficultyId;
  /**
   * Partida de controle: o mesmo bot, mas as obras que ele planeja entram como manuais e nenhuma
   * começa sozinha, como antes do início automático (V2C-T5). Serve para medir o que o início
   * automático muda; o resumo de uma partida traz as duas medidas lado a lado.
   */
  manualPlans?: boolean;
  /**
   * Um bot no lugar do de `strategy`: para medir uma variação (um bot sem uma política) e para
   * os testes que precisam das mesmas ordens em duas partidas. O resumo continua dizendo o
   * nome de `strategy`.
   */
  bot?: Bot;
};

/**
 * Retrato do feudo ao fim de uma hora real, como o jogador o veria no painel. As taxas `perHour`
 * são por hora real. As contagens de ordens são acumuladas desde a criação da partida.
 */
export type HourRow = {
  hour: number;
  realDay: number;
  year: number;
  season: SeasonId;
  dayOfSeason: number;
  stock: Record<ResourceId, number>;
  perHour: Record<ResourceId, number>;
  villagers: number;
  capacity: number;
  free: number;
  inTraining: number;
  levels: Record<BuildingId, number>;
  famine: boolean;
  /** O feudo passa frio: é inverno e a madeira da lareira acabou. */
  cold: boolean;
  /** A moral do feudo naquela hora, de 0 a 100, e a faixa dela, como a visão as mostra. */
  morale: number;
  moraleBand: MoraleBandId;
  /**
   * Desperdício acumulado de cada recurso, em unidades: o que os eventos `storageWasted` já
   * relataram mais o que a visão mostra como ainda não relatado (`wastedToday`).
   */
  wasted: Record<ResourceId, number>;
  /** Algum depósito está cheio e perdendo produção nesta hora. */
  wasting: boolean;
  /**
   * O que cada ofício produz por hora real nesta hora, antes do consumo e do limite do depósito
   * (`workers[].grossPerHour`): é o denominador de "quanto da produção foi ao chão".
   */
  gross: Record<ResourceId, number>;
  /**
   * O feudo não tem mais o que construir: nenhuma obra em curso e nenhuma que esperar resolva
   * (todas no teto, presas ao Salão que não sobe ou com o custo acima do que o depósito guarda).
   */
  exhausted: boolean;
  /** A fila de obras está livre e ao menos uma obra poderia começar agora: ninguém a iniciou. */
  queueIdle: boolean;
  /** Idem, contando só as obras que o jogador deixou planejadas. */
  plannedIdle: boolean;
  /**
   * A Ameaça ao fim da hora, de 0 a 100, **lida do estado**: o simulador mede o mundo, e a
   * visão só a mostra a quem tem a Torre de Vigia. O bot continua sem vê-la.
   */
  threat: number;
  /**
   * O Conselho até aqui, contado dos eventos: as cartas que chegaram (por sorteio ou como
   * continuação), as que o bot respondeu e as que expiraram sem resposta.
   */
  cards: CardCounts;
  /**
   * As incursões até aqui, contadas dos eventos: as sofridas, as repelidas, os aldeões que se
   * feriram e o que os lobos levaram de cada recurso, em unidades (`raided_<recurso>`).
   */
  raids: RaidCounts;
  /** Ordens aceitas pelo motor até aqui. */
  commandsAccepted: number;
  /** Ordens recusadas pelo motor até aqui, por código de recusa. */
  commandsRefused: Record<string, number>;
};

export type SimulationResult = {
  options: SimulationOptions;
  rows: HourRow[];
  events: GameEvent[];
  finalState: GameState;
  commands: CommandCounts;
  /** Dificuldade e ritmo como a visão os mostra ao jogador. */
  game: { difficultyLabel: string; paceLabel: string };
};

type CommandCounts = { accepted: number; refused: Record<string, number> };
export type CardCounts = { seen: number; answered: number; expired: number };
export type RaidCounts = {
  suffered: number;
  repelled: number;
  /** Incursões que os vigias da Torre anunciaram antes de chegar. */
  announced: number;
  injured: number;
  lost: Record<ResourceId, number>;
};

/**
 * A fila de obras parada à toa, como o jogador a veria no painel: há ao menos uma obra que
 * poderia começar agora (`queueIdle`), ou ao menos uma das que ele planejou (`plannedIdle`). Uma
 * obra só "pode começar" com fila livre, então vale também para a segunda fila: com uma obra em
 * curso e a outra fila aberta e vazia, a fila está ociosa. É um dos sinais de tédio do
 * simulador: o jogo tinha o que fazer e esperou a próxima visita.
 */
export function idleQueue(view: ViewState): { queueIdle: boolean; plannedIdle: boolean } {
  const startable = view.constructions.available.filter((upgrade) => upgrade.blockedCode === null);
  return {
    queueIdle: startable.length > 0,
    plannedIdle: startable.some((upgrade) => upgrade.planned),
  };
}

/**
 * O `act` da partida de controle: o bot dá as mesmas ordens, mas uma planejada nunca entra como
 * automática. `planConstruction` perde a marca e `setAutoStart` não chega ao motor.
 */
export function withManualPlans(act: Act, current: () => ViewState): Act {
  // O tipo de `Act` amarra o payload ao tipo da ordem; aqui a ordem só é repassada.
  type Loose = (type: Command['type'], payload: Command['payload']) => Promise<ViewState>;
  const pass = act as Loose;
  const manual: Loose = async (type, payload) => {
    if (type === 'setAutoStart') {
      return current();
    }
    if (type === 'planConstruction') {
      // Só a marca sai; o resto da ordem (o edifício, o nível que a visão mostrou) segue igual.
      const plan = payload as Extract<Command, { type: 'planConstruction' }>['payload'];
      return pass(type, {
        building: plan.building,
        ...(plan.targetLevel === undefined ? {} : { targetLevel: plan.targetLevel }),
      });
    }
    return pass(type, payload);
  };
  return manual as Act;
}

/** Soma, por recurso, o que os eventos de desperdício relataram (`wasted_<recurso>`). */
function addReportedWaste(reported: Record<ResourceId, number>, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type !== 'storageWasted') {
      continue;
    }
    for (const id of Object.keys(reported) as ResourceId[]) {
      reported[id] += Number(event.data[`wasted_${id}`] ?? 0);
    }
  }
}

/** Conta, dos eventos, as cartas do Conselho que chegaram, foram respondidas e expiraram. */
function addCards(cards: CardCounts, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === 'cardDrawn') {
      cards.seen += 1;
    } else if (event.type === 'cardAnswered') {
      cards.answered += 1;
    } else if (event.type === 'cardExpired') {
      cards.expired += 1;
    }
  }
}

/** Conta, dos eventos, as incursões, os feridos e o que os lobos levaram de cada recurso. */
function addRaids(raids: RaidCounts, events: GameEvent[]): void {
  for (const event of events) {
    if (event.type === 'raidRepelled') {
      raids.repelled += 1;
    } else if (event.type === 'raidAnnounced') {
      raids.announced += 1;
    } else if (event.type === 'raidSuffered') {
      raids.suffered += 1;
      raids.injured += Number(event.data.injured ?? 0);
      for (const id of Object.keys(raids.lost) as ResourceId[]) {
        raids.lost[id] += Number(event.data[`raided_${id}`] ?? 0);
      }
    }
  }
}

function rowAt(
  state: GameState,
  hour: number,
  timeScale: number,
  commands: CommandCounts,
  reportedWaste: Record<ResourceId, number>,
  cards: CardCounts,
  raids: RaidCounts,
): HourRow {
  const view = deriveViewState(state, state.lastProcessedAt, { timeScale });
  const byResource = <T>(pick: (row: (typeof view.resources)[number]) => T) =>
    Object.fromEntries(view.resources.map((row) => [row.id, pick(row)])) as Record<ResourceId, T>;
  return {
    hour,
    realDay: Math.ceil(hour / HOURS_PER_REAL_DAY),
    year: view.calendar.year,
    season: view.calendar.season,
    dayOfSeason: view.calendar.dayOfSeason,
    stock: byResource((row) => row.stock),
    perHour: byResource((row) => row.perHour),
    villagers: view.population.villagers,
    capacity: view.population.capacity,
    free: view.population.free,
    inTraining: view.population.inTraining,
    levels: { ...state.settlement.buildings },
    famine: view.famine !== null,
    cold: view.winter !== null && view.winter.cold !== null,
    morale: view.morale.value,
    moraleBand: view.morale.band,
    wasted: byResource((row) => reportedWaste[row.id] + row.wastedToday),
    wasting: view.resources.some((row) => row.wastingPerHour > 0),
    gross: byResource(
      (row) => view.workers.find((entry) => entry.resource === row.id)?.grossPerHour ?? 0,
    ),
    exhausted: nothingLeftToBuild(view),
    ...idleQueue(view),
    threat: state.map.threat,
    cards: { ...cards },
    raids: { ...raids, lost: { ...raids.lost } },
    commandsAccepted: commands.accepted,
    commandsRefused: { ...commands.refused },
  };
}

/** Horas reais da simulação: `hours`, ou `days` inteiros. */
export function realHoursOf(options: Pick<SimulationOptions, 'days' | 'hours'>): number {
  return options.hours ?? options.days * HOURS_PER_REAL_DAY;
}

/**
 * Joga uma partida inteira em processo, só com o motor. As sessões começam na criação da partida
 * e se repetem a intervalos iguais de tempo real; entre elas o mundo anda sozinho. Uma linha por
 * hora real. No ritmo `N`, cada hora real são `N` horas de jogo: o bot joga as mesmas sessões por
 * dia e encontra `N` vezes mais mundo andado entre uma e outra.
 */
export async function simulate(options: SimulationOptions): Promise<SimulationResult> {
  const { seed, sessionsPerDay } = options;
  const timeScale = options.timeScale ?? 1;
  if (!Number.isFinite(timeScale) || timeScale <= 0) {
    throw new Error(`Ritmo inválido: ${timeScale}.`);
  }
  const realHours = realHoursOf(options);
  if (!Number.isInteger(realHours) || realHours <= 0) {
    throw new Error(`Duração inválida: ${realHours} horas reais.`);
  }
  /** Instante de jogo de um instante real, os dois em ms desde a criação da partida. */
  const gameMs = (realMs: number) => Math.round(realMs * timeScale);
  const bot: Bot = options.bot ?? botFor(options.strategy, sessionsPerDay);
  let state = createInitialState(seed, {
    settlementName: 'Pedra Alta',
    timezone: 'America/Sao_Paulo',
    vigilHourLocal: 20,
    difficulty: options.difficulty ?? 'lord',
    timeScale,
  });
  const { difficultyLabel, paceLabel } = deriveViewState(state, 0, { timeScale }).settlement;
  const events: GameEvent[] = [];
  const rows: HourRow[] = [];
  const commands: CommandCounts = { accepted: 0, refused: {} };
  const reportedWaste: Record<ResourceId, number> = { food: 0, wood: 0, stone: 0, gold: 0 };
  const cards: CardCounts = { seen: 0, answered: 0, expired: 0 };
  const raids: RaidCounts = {
    suffered: 0,
    repelled: 0,
    announced: 0,
    injured: 0,
    lost: { food: 0, wood: 0, stone: 0, gold: 0 },
  };
  let commandCount = 0;

  const order: Act = async (type, payload) => {
    commandCount += 1;
    const command = { commandId: `${seed}-${commandCount}`, type, payload } as Command;
    const result = applyCommand(state, command, state.lastProcessedAt);
    if (result.ok) {
      state = result.state;
      events.push(...result.events);
      // A resposta a uma carta, e a continuação que ela deixa entrar na mesa.
      addCards(cards, result.events);
      commands.accepted += 1;
    } else {
      commands.refused[result.code] = (commands.refused[result.code] ?? 0) + 1;
    }
    return deriveViewState(state, state.lastProcessedAt, { timeScale });
  };
  const act = options.manualPlans
    ? withManualPlans(order, () => deriveViewState(state, state.lastProcessedAt, { timeScale }))
    : order;

  // Daqui em diante os instantes são reais; `gameMs` converte na hora de mover o motor.
  const sessionEveryMs = Math.round((HOURS_PER_REAL_DAY * HOUR_MS) / sessionsPerDay);
  const endMs = realHours * HOUR_MS;
  let nextSessionMs = 0;

  for (let hour = 1; hour <= realHours; hour += 1) {
    const hourEndMs = hour * HOUR_MS;
    while (nextSessionMs < hourEndMs && nextSessionMs < endMs) {
      const advanced = advanceTo(state, gameMs(nextSessionMs));
      state = advanced.state;
      events.push(...advanced.events);
      addReportedWaste(reportedWaste, advanced.events);
      addCards(cards, advanced.events);
      addRaids(raids, advanced.events);
      await bot(deriveViewState(state, state.lastProcessedAt, { timeScale }), act);
      nextSessionMs += sessionEveryMs;
    }
    const advanced = advanceTo(state, gameMs(hourEndMs));
    state = advanced.state;
    events.push(...advanced.events);
    addReportedWaste(reportedWaste, advanced.events);
    addCards(cards, advanced.events);
    addRaids(raids, advanced.events);
    rows.push(rowAt(state, hour, timeScale, commands, reportedWaste, cards, raids));
  }

  return {
    options,
    rows,
    events,
    finalState: state,
    commands,
    game: { difficultyLabel, paceLabel },
  };
}
