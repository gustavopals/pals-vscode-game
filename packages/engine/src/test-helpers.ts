import { buildings, objectives } from '@lotg/content';

import { advanceTo, advanceWith, processEventsAt } from './advance';
import { isDayBoundary } from './clock';
import { applyCommand } from './commands';
import { addMoraleEffect } from './morale';
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

/**
 * Celeiro e Armazém no nível máximo (5.100 de cada recurso em Senhor): para os cenários que não
 * são sobre o limite de estoque e precisam de onde guardar o que produzem.
 */
export function roomy(draft: GameState): void {
  draft.settlement.buildings.granary = buildings.granary.maxLevel;
  draft.settlement.buildings.warehouse = buildings.warehouse.maxLevel;
}

/**
 * A experiência do ofício de todos os edifícios produtivos posta no mesmo valor: para comparar
 * taxas depois de viradas de dia, que a fazem subir.
 */
export function experienced(experience: number): (draft: GameState) => void {
  return (draft) => {
    draft.settlement.craftExperience = {
      farm: experience,
      lumberMill: experience,
      quarry: experience,
      goldMine: experience,
    };
  };
}

/**
 * A mestria de um edifício que está ocupado desde o dia de jogo 0, sem experiência nenhuma, no
 * dia `day`: em milésimos (1012 é × 1,012). Cada virada de dia dá 4 de experiência, até 100.
 */
export function masteryOnDay(day: number): number {
  return 1000 + 3 * Math.min(100, 4 * day);
}

/**
 * A moral de um feudo com comida guardada e vaga nas casas, da primeira virada de dia em
 * diante: a base e o bônus da reserva. Antes dela, todo feudo novo está na base (50).
 */
export const FED_MORALE = 60;

/**
 * Uma taxa, em milésimos por hora, com o fator da moral: × (150 + moral) / 200, para baixo.
 * Só vale como a conta do motor quando `rate` é a taxa exata sem a moral (um inteiro que não
 * foi arredondado): o motor arredonda uma vez, no fim.
 */
export function withMorale(rate: number, morale: number): number {
  return Math.floor((rate * (150 + morale)) / 200);
}

/** Põe a moral do feudo em um valor: para comparar taxas depois de uma virada, que a recalcula. */
export function spirited(morale: number): (draft: GameState) => void {
  return (draft) => {
    draft.settlement.morale = morale;
  };
}

/**
 * O instante em que `missing` milésimos de um recurso se juntam a partir de `fromMs`, quando a
 * taxa (em milésimos por hora) muda a cada virada de dia de jogo. É a conta do motor refeita à
 * mão: o resto de cada dia passa inteiro para o seguinte, e só o instante final é arredondado.
 */
export function reachedAt(
  fromMs: number,
  missing: number,
  rateOnDay: (day: number) => number,
): number {
  let at = fromMs;
  let left = missing * HOUR;
  for (;;) {
    const day = Math.floor(at / DAY);
    const rate = rateOnDay(day);
    const end = (day + 1) * DAY;
    if (rate * (end - at) >= left) {
      return at + Math.ceil(left / rate);
    }
    left -= rate * (end - at);
    at = end;
  }
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
 * e 60 de madeira. A conta da lenha da próxima estação diz quanto falta guardar. O Celeiro
 * (nível 3) e o Armazém (nível 1) têm folga: o cenário é sobre a lenha, não sobre o limite.
 */
export function autumnScenario(): GameState {
  return gameAt(AUTUMN + 22 * DAY, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = 18;
    settlement.workers = { farm: 10, lumberMill: 0, quarry: 5, goldMine: 3 };
    settlement.buildings = {
      ...settlement.buildings,
      townHall: 3,
      farm: 2,
      housing: 3,
      granary: 3,
      warehouse: 1,
    };
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

/**
 * Verão, o Salão no nível 4 e as duas filas ocupadas (a Serraria e a Mina de Ouro, há dois
 * minutos). Na lista, uma planejada para cada espera que a visão sabe dizer: a Serraria de novo
 * (a obra anterior dela), as Habitações, manuais (só a fila), a Fazenda (15 de ouro que a Mina
 * junta), o Salão (875 de madeira não cabem no Pátio) e a Pedreira (pede o Salão no nível 5).
 */
export function queuesScenario(): GameState {
  const start = gameAt(SUMMER + 3 * DAY, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = 20;
    settlement.workers = { farm: 8, lumberMill: 5, quarry: 3, goldMine: 2 };
    settlement.buildings = { ...settlement.buildings, townHall: 4, quarry: 5, granary: 1 };
    settlement.resources = { food: 600_000, wood: 420_000, stone: 300_000, gold: 25_000 };
  });
  return play(start, [
    command('startConstruction', { building: 'lumberMill' }),
    command('startConstruction', { building: 'goldMine' }),
    command('planConstruction', { building: 'lumberMill', autoStart: true }),
    command('planConstruction', { building: 'housing' }),
    command('planConstruction', { building: 'farm', autoStart: true }),
    command('planConstruction', { building: 'townHall', autoStart: true }),
    command('planConstruction', { building: 'quarry', autoStart: true }),
    { at: start.lastProcessedAt + 2 * MINUTE },
  ]).state;
}

/**
 * Outono, no meio de um dia de jogo, com um ofício em cada situação. A Fazenda (nível 3,
 * experiência 40) tem quatro lavradores, dois deles chegados há 1 h 22 min: faltam 38 minutos
 * de adaptação. A Serraria está dominada (100). A Pedreira, no nível 3, tem dois canteiros, um a
 * menos do que o nível pede, e um deles chegou há 22 minutos. A Mina de Ouro está vazia e perde
 * a experiência que tinha (16). Sobram dois aldeões sem ofício.
 */
export function craftScenario(): GameState {
  const start = gameAt(AUTUMN + 3 * DAY, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = 12;
    settlement.workers = { farm: 2, lumberMill: 4, quarry: 1, goldMine: 0 };
    settlement.buildings = {
      ...settlement.buildings,
      townHall: 3,
      farm: 3,
      quarry: 3,
      housing: 2,
      granary: 2,
      warehouse: 2,
    };
    settlement.resources = { food: 420_000, wood: 380_000, stone: 240_000, gold: 310_000 };
    settlement.craftExperience = { farm: 40, lumberMill: 100, quarry: 20, goldMine: 16 };
    settlement.craftMasteredYear.lumberMill = 1;
  });
  return play(start, [
    command('setWorkers', { building: 'farm', count: 4 }),
    { at: start.lastProcessedAt + HOUR },
    command('setWorkers', { building: 'quarry', count: 2 }),
    { at: start.lastProcessedAt + 82 * MINUTE },
  ]).state;
}

/**
 * O feudo empobrecido (roadmap V2C-T4.6): 3º dia do inverno, 3 aldeões sem ofício, nem comida
 * nem madeira, fome há 20 dias de jogo, frio desde a virada da estação e moral zero. É o fundo
 * do poço: o piso de 3 aldeões segura a população, e a saída é pôr gente na Fazenda e na
 * Serraria.
 */
export function impoverishedScenario(difficulty: GameSettings['difficulty'] = 'lord'): GameState {
  return gameAt(WINTER + 2 * DAY + 20 * MINUTE, (draft) => {
    const { settlement } = draft;
    draft.settings.difficulty = difficulty;
    settlement.population.villagers = 3;
    settlement.workers = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
    settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
    settlement.famine = { sinceMs: WINTER - 18 * DAY };
    settlement.cold = { sinceMs: WINTER };
    settlement.morale = 0;
  });
}

/**
 * Um feudo orgulhoso, no 6º dia do verão: 22 habitantes em 25 vagas, todos os ofícios com
 * gente, e dois efeitos temporários de moral gravados no começo do verão, como os que as cartas
 * do Conselho e as incursões vão gravar: +30 por nove dias de jogo e −10 por dois. A moral foi
 * 70 nos dois primeiros dias e 80 dali em diante, e a cada virada com 80 o fluxo `morale`
 * sorteia a chegada de um colono. O efeito de −10 já saiu da lista.
 */
export function proudScenario(): GameState {
  const start = gameAt(SUMMER, (draft) => {
    const { settlement } = draft;
    settlement.population.villagers = 22;
    settlement.workers = { farm: 6, lumberMill: 6, quarry: 5, goldMine: 3 };
    settlement.buildings = { ...settlement.buildings, townHall: 2, housing: 3, farm: 2 };
    settlement.resources = { food: 400_000, wood: 300_000, stone: 200_000, gold: 150_000 };
    addMoraleEffect(draft, {
      id: 'teste:festa',
      label: 'festa da colheita',
      amount: 30,
      untilMs: SUMMER + 9 * DAY,
    });
    addMoraleEffect(draft, {
      id: 'teste:incursao',
      label: 'incursão sofrida',
      amount: -10,
      untilMs: SUMMER + 2 * DAY,
    });
  });
  return advanceTo(start, SUMMER + 5 * DAY + 37 * MINUTE).state;
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
  // A segunda visita do dia cai uma hora mais tarde do que cairia sem a troca de ofício: quem
  // acabou de ganhar ofício rendeu metade nas duas primeiras horas, e a comida e a pedra para
  // estas ordens só fecham agora.
  [13, command('recruitVillagers', { quantity: 5 })],
  [13, command('recruitVillagers', { quantity: 3 })],
  [13, command('startConstruction', { building: 'lumberMill' })],
  [13, command('planConstruction', { building: 'farm' })],
  // Dia 2: mais braços na madeira e no ouro; uma obra cancelada.
  [24, command('setWorkers', { building: 'lumberMill', count: 4 })],
  [24, command('setWorkers', { building: 'goldMine', count: 3 })],
  [24, command('startConstruction', { building: 'farm' })],
  // A Pedreira fica planejada como automática: começa sozinha assim que houver fila e recurso.
  [24, command('planConstruction', { building: 'quarry', autoStart: true })],
  // O Salão no nível 2 liberou os depósitos: o Armazém, antes que a madeira vá para o chão.
  [28, command('startConstruction', { building: 'warehouse' })],
  [36, command('startConstruction', { building: 'quarry' })],
  [36, command('cancelConstruction', { building: 'quarry' })],
  [36, command('startConstruction', { building: 'housing' })],
  [36, command('setWorkers', { building: 'quarry', count: 9 })],
  // Dia 3: o feudo ganha nome novo e o Salão sobe.
  [48, command('recruitVillagers', { quantity: 4 })],
  [48, command('startConstruction', { building: 'goldMine' })],
  [48, command('renameSettlement', { name: 'Pedra Alta do Norte' })],
  [52, command('startConstruction', { building: 'granary' })],
  [60, command('setWorkers', { building: 'quarry', count: 4 })],
  [60, command('startConstruction', { building: 'townHall' })],
  // Dia 4: o senhor tira todos da Fazenda e gasta a comida em recrutas. A fome vem, e com ela
  // a moral cai: inquieto na virada seguinte, desesperado três dias de jogo depois.
  [72, command('setWorkers', { building: 'farm', count: 0 })],
  [72, command('setWorkers', { building: 'lumberMill', count: 6 })],
  [72, command('recruitVillagers', { quantity: 5 })],
  [72, command('startConstruction', { building: 'housing' })],
  [84, command('recruitVillagers', { quantity: 5 })],
  [84, command('startConstruction', { building: 'quarry' })],
  // Dia 5: ordens dadas com o feudo faminto. A fome já dura mais de 12 h de jogo: a moral
  // despencou e três aldeões desertaram. De volta à Fazenda; a fome acaba.
  [108, command('recruitVillagers', { quantity: 1 })],
  [108, command('startConstruction', { building: 'lumberMill' })],
  [108, command('setWorkers', { building: 'lumberMill', count: 2 })],
  [108, command('setWorkers', { building: 'farm', count: 8 })],
  [120, command('startConstruction', { building: 'granary' })],
  // A Serraria entra na lista como manual, e na visita seguinte ganha a marca de automática.
  [120, command('planConstruction', { building: 'lumberMill' })],
  // Dia 6: a despensa se refaz, e a moral com ela.
  [132, command('startConstruction', { building: 'farm' })],
  [132, command('setAutoStart', { building: 'lumberMill', autoStart: true })],
  // Dia 7: o inverno. As obras levam a madeira do Armazém e o senhor tira os lenhadores: a
  // lareira apaga, o frio entra (e o povo fica inquieto de novo), e os lenhadores voltam antes
  // da virada do ano.
  [144, command('startConstruction', { building: 'townHall' })],
  // Com o Salão ainda no nível 3, a segunda obra é recusada, e a recusa diz o que abre a fila.
  [144, command('startConstruction', { building: 'housing' })],
  [144, command('unplanConstruction', { building: 'farm' })],
  [144, command('setWorkers', { building: 'lumberMill', count: 4 })],
  [150, command('setWorkers', { building: 'lumberMill', count: 0 })],
  [150, command('startConstruction', { building: 'housing' })],
  // O Salão chegou ao nível 4: a segunda fila está aberta, e a Pedreira entra nela. Para a
  // Fazenda não há terceira fila.
  [150, command('startConstruction', { building: 'quarry' })],
  [150, command('startConstruction', { building: 'farm' })],
  [156, command('recruitVillagers', { quantity: 3 })],
  [156, command('startConstruction', { building: 'goldMine' })],
  // Sem madeira para a Mina agora: fica planejada, e começa sozinha quando a madeira chegar.
  [156, command('planConstruction', { building: 'goldMine', autoStart: true })],
  [163, command('setWorkers', { building: 'lumberMill', count: 6 })],
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
