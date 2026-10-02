import { objectives } from '@lotg/content';

import { advanceTo, advanceWith, processEventsAt } from './advance';
import { isDayBoundary } from './clock';
import { applyCommand } from './commands';
import { chance, nextInt, pickWeighted } from './random';
import { cloneState, createInitialState } from './state';
import type { Command, CommandResult, GameEvent, GameSettings, GameState } from './types';
import { MILLI } from './units';

export const HOUR = 3_600_000;
export const MINUTE = 60_000;
export const DAY = 2 * HOUR;
/** O primeiro instante de cada estação do ano 1 (24, 24, 24 e 12 dias de jogo). */
export const SPRING = 0;
export const SUMMER = 24 * DAY;
export const AUTUMN = 48 * DAY;
export const WINTER = 72 * DAY;
export const YEAR = 84 * DAY;

export const settings: GameSettings = {
  settlementName: 'Pedra Alta',
  timezone: 'America/Sao_Paulo',
  vigilHourLocal: 20,
  difficulty: 'lord',
  timeScale: 1,
};

export function newGame(seed = 'pedra-alta'): GameState {
  return createInitialState(seed, settings);
}

/** Estado inicial com ajustes diretos, para montar cenários que os comandos não alcançam rápido. */
export function gameWith(edit: (draft: GameState) => void): GameState {
  const draft = cloneState(newGame());
  edit(draft);
  return draft;
}

/**
 * Um feudo posto direto em um instante do calendário, sem simular o caminho até lá: para os
 * cenários de estação. O relógio fica coerente com `lastProcessedAt`, e os objetivos já estão
 * todos cumpridos, para nenhuma recompensa cair no meio da conta.
 */
export function gameAt(atMs: number, edit: (draft: GameState) => void = () => {}): GameState {
  return gameWith((draft) => {
    draft.lastProcessedAt = atMs;
    draft.clock.gameTimeMs = atMs;
    draft.clock.year = Math.floor(atMs / YEAR) + 1;
    draft.clock.yearStartMs = Math.floor(atMs / YEAR) * YEAR;
    draft.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
    edit(draft);
  });
}

let nextCommandId = 0;

export function command<T extends Command['type']>(
  type: T,
  payload: Extract<Command, { type: T }>['payload'],
): Command {
  nextCommandId += 1;
  return { commandId: `test-${nextCommandId}`, type, payload } as Command;
}

/** Aplica um comando no instante atual do estado. */
export function apply(state: GameState, cmd: Command): CommandResult {
  return applyCommand(state, cmd, state.lastProcessedAt);
}

/** Aplica um comando que precisa ser aceito e devolve o novo estado e os eventos. */
export function accept(state: GameState, cmd: Command): { state: GameState; events: GameEvent[] } {
  const result = apply(state, cmd);
  if (!result.ok) {
    throw new Error(`Comando recusado no teste: ${result.code} (${result.message})`);
  }
  return { state: result.state, events: result.events };
}

/** Aplica um comando que precisa ser recusado e devolve a recusa. */
export function refuse(state: GameState, cmd: Command): { code: string; message: string } {
  const result = apply(state, cmd);
  if (result.ok) {
    throw new Error(`Comando aceito no teste, mas a recusa era esperada: ${cmd.type}`);
  }
  return { code: result.code, message: result.message };
}

/** Executa um roteiro de passos (avançar ou comandar) e junta todos os eventos. */
export function play(
  start: GameState,
  steps: Array<{ at: number } | Command>,
): { state: GameState; events: GameEvent[] } {
  let state = start;
  const events: GameEvent[] = [];
  for (const step of steps) {
    const result = 'at' in step ? advanceTo(state, step.at) : accept(state, step);
    state = result.state;
    events.push(...result.events);
  }
  return { state, events };
}

/** Roteiro que cumpre os quatro objetivos da v0.1, na ordem. */
export function objectivesScenario() {
  return play(newGame('pedra-alta'), [
    command('setWorkers', { building: 'farm', count: 2 }),
    command('startConstruction', { building: 'housing' }),
    command('recruitVillagers', { quantity: 3 }),
    { at: HOUR },
    command('setWorkers', { building: 'lumberMill', count: 3 }),
    command('setWorkers', { building: 'quarry', count: 3 }),
    { at: 6 * HOUR },
    command('startConstruction', { building: 'townHall' }),
    { at: 6 * HOUR + 10 * MINUTE },
  ]);
}

/**
 * Outono, dois dias antes do inverno: 18 habitantes, a Fazenda no nível 2, ninguém na Serraria
 * e 60 de madeira. A conta da lenha da próxima estação diz quanto falta guardar.
 */
export function autumnScenario(): GameState {
  return gameAt(AUTUMN + 22 * DAY, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = 18;
    settlement.workers = { farm: 10, lumberMill: 0, quarry: 5, goldMine: 3 };
    settlement.buildings = { ...settlement.buildings, townHall: 3, farm: 2, housing: 3 };
    settlement.resources = { food: 640_000, wood: 60_000, stone: 310_000, gold: 420_000 };
  });
}

/**
 * O mesmo feudo no 4º dia do inverno, sem ninguém ter mexido em nada: os 60 de madeira
 * queimaram em 6 h 40 min (9 por hora) e o frio já dura 50 minutos.
 */
export function winterColdScenario(): GameState {
  return advanceTo(autumnScenario(), WINTER + 3 * DAY + 90 * MINUTE).state;
}

export function eventsOfType(events: GameEvent[], type: GameEvent['type']): GameEvent[] {
  return events.filter((event) => event.type === type);
}

const DAY_REAL = 24 * HOUR;

/** Sete dias reais de um jogador de duas sessões por dia: ordens com os seus instantes. */
const weekScript = (): Array<[hour: number, order: Command]> => [
  // Dia 1: os quatro objetivos.
  [0, command('setWorkers', { building: 'farm', count: 2 })],
  [0, command('startConstruction', { building: 'housing' })],
  [0, command('recruitVillagers', { quantity: 3 })],
  [1, command('setWorkers', { building: 'lumberMill', count: 3 })],
  [1, command('setWorkers', { building: 'quarry', count: 2 })],
  [1, command('setWorkers', { building: 'goldMine', count: 1 })],
  [8, command('startConstruction', { building: 'townHall' })],
  [12, command('recruitVillagers', { quantity: 5 })],
  [12, command('recruitVillagers', { quantity: 3 })],
  [12, command('startConstruction', { building: 'lumberMill' })],
  [12, command('planConstruction', { building: 'farm' })],
  // Dia 2: mais braços na madeira e no ouro; uma obra cancelada.
  [24, command('setWorkers', { building: 'lumberMill', count: 4 })],
  [24, command('setWorkers', { building: 'goldMine', count: 3 })],
  [24, command('startConstruction', { building: 'farm' })],
  [36, command('startConstruction', { building: 'quarry' })],
  [36, command('cancelConstruction', { building: 'quarry' })],
  [36, command('startConstruction', { building: 'housing' })],
  [36, command('setWorkers', { building: 'quarry', count: 9 })],
  // Dia 3: o feudo ganha nome novo e o Salão sobe.
  [48, command('recruitVillagers', { quantity: 4 })],
  [48, command('startConstruction', { building: 'goldMine' })],
  [48, command('renameSettlement', { name: 'Pedra Alta do Norte' })],
  [60, command('setWorkers', { building: 'quarry', count: 4 })],
  [60, command('startConstruction', { building: 'townHall' })],
  // Dia 4: o senhor tira todos da Fazenda e gasta a comida em recrutas. A fome vem.
  [72, command('setWorkers', { building: 'farm', count: 0 })],
  [72, command('setWorkers', { building: 'lumberMill', count: 6 })],
  [72, command('recruitVillagers', { quantity: 5 })],
  [72, command('startConstruction', { building: 'housing' })],
  [84, command('recruitVillagers', { quantity: 5 })],
  [84, command('startConstruction', { building: 'quarry' })],
  // Dia 5: ordens dadas com o feudo faminto.
  [108, command('recruitVillagers', { quantity: 1 })],
  [108, command('startConstruction', { building: 'lumberMill' })],
  // Dia 6: de volta à Fazenda; a fome acaba.
  [132, command('setWorkers', { building: 'lumberMill', count: 2 })],
  [132, command('setWorkers', { building: 'farm', count: 8 })],
  [132, command('startConstruction', { building: 'farm' })],
  // Dia 7: últimas obras antes da virada do ano.
  [144, command('startConstruction', { building: 'townHall' })],
  [144, command('unplanConstruction', { building: 'farm' })],
  [156, command('recruitVillagers', { quantity: 3 })],
  [156, command('startConstruction', { building: 'goldMine' })],
];

/** O cenário roteirizado de 7 dias reais no ritmo 1: o golden do motor e uma das fixtures de estado. */
export function runWeekScenario() {
  let state: GameState = newGame('pedra-alta-golden');
  const events: GameEvent[] = [];
  const orders: Array<Record<string, unknown>> = [];
  const days: Array<Record<string, unknown>> = [];

  const advance = (toMs: number) => {
    const result = advanceTo(state, toMs);
    state = result.state;
    events.push(...result.events);
  };

  const script = weekScript();
  let cursor = 0;
  for (let day = 1; day <= 7; day += 1) {
    for (; cursor < script.length; cursor += 1) {
      const [hour, order] = script[cursor] as [number, Command];
      if (hour * HOUR >= day * DAY_REAL) {
        break;
      }
      advance(hour * HOUR);
      const result = applyCommand(state, order, state.lastProcessedAt);
      if (result.ok) {
        state = result.state;
        events.push(...result.events);
      }
      orders.push({
        hour,
        type: order.type,
        payload: order.payload,
        result: result.ok ? 'accepted' : result.code,
      });
    }
    advance(day * DAY_REAL);
    days.push({ day, eventsSoFar: events.length, state });
  }
  return { state, events, orders, days };
}

/** Tipo dos eventos do cenário sintético: não existe no conteúdo nem chega a jogador nenhum. */
export const SYNTHETIC_DRAW = 'syntheticDraw' as GameEvent['type'];

const syntheticGifts = [
  { weight: 5, resource: 'wood' },
  { weight: 3, resource: 'stone' },
  { weight: 0, resource: 'gold' },
] as const;

/**
 * A virada de dia do cenário sintético: sorteia nos três fluxos, e o que sai mexe no estoque,
 * portanto nas taxas, na fome e em tudo o que vem depois. Nenhuma regra do jogo é assim.
 */
function syntheticDayTurn(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { resources } = draft.settlement;
  const data: Record<string, string | number> = { gift: 'none', amount: 0, raided: 0, omen: 0 };

  // `council`: um presente de tamanho sorteado, em um recurso sorteado por peso.
  const gift = pickWeighted(draft, 'council', syntheticGifts);
  if (gift !== null) {
    const amount = (nextInt(draft, 'council', 20) + 1) * MILLI;
    resources[gift.resource] += amount;
    data.gift = gift.resource;
    data.amount = amount;
  }
  // `horde`: uma em cada quatro viradas leva um décimo da comida e da madeira.
  if (chance(draft, 'horde', { num: 1, den: 4 })) {
    resources.food -= Math.floor(resources.food / 10);
    resources.wood -= Math.floor(resources.wood / 10);
    data.raided = 1;
  }
  // `morale`: só conta, para o terceiro fluxo também andar.
  if (chance(draft, 'morale', { num: 1, den: 3 })) {
    draft.stats.syntheticOmens = (draft.stats.syntheticOmens ?? 0) + 1;
    data.omen = 1;
  }
  events.push({ type: SYNTHETIC_DRAW, atMs, text: 'Sorteio sintético de teste.', data });
}

/**
 * `advanceTo` com um evento a mais, que só existe em teste: toda virada de dia sorteia. É o
 * mesmo laço do jogo, com os eventos de verdade processados logo depois dos sorteios. Prova que
 * avançar de uma vez ou aos pedaços consome o gerador igual, antes de a primeira mecânica que
 * sorteia existir.
 */
export function advanceWithDailyDraws(
  state: GameState,
  gameTimeMs: number,
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, (draft, atMs, events) => {
    if (isDayBoundary(atMs)) {
      syntheticDayTurn(draft, atMs, events);
    }
    processEventsAt(draft, atMs, events);
  });
}
