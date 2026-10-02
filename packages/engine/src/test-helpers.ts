import { buildings, councilCards, objectives } from '@lotg/content';

import { advanceTo, advanceWith, processEventsAt, processEventsWith } from './advance';
import { isDayBoundary } from './clock';
import { applyCommand } from './commands';
import { cardOf, CATALOG, type Catalog, deliverCard, DRAW_INTERVAL_MS } from './council';
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
 * cenários de estação. O relógio fica coerente com `lastProcessedAt`, os objetivos já estão
 * todos cumpridos, para nenhuma recompensa cair no meio da conta, e o Conselho está calado
 * (`quietCouncil`), para nenhuma carta cair no meio dos eventos. O cenário que quer o Conselho
 * chama `councilInSession` no `edit`.
 */
export function gameAt(atMs: number, edit: (draft: GameState) => void = () => {}): GameState {
  return gameWith((draft) => {
    draft.lastProcessedAt = atMs;
    draft.clock.gameTimeMs = atMs;
    draft.clock.year = Math.floor(atMs / YEAR) + 1;
    draft.clock.yearStartMs = Math.floor(atMs / YEAR) * YEAR;
    draft.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
    quietCouncil(draft);
    edit(draft);
  });
}

/**
 * O Conselho de um feudo fundado no instante zero que chegou até aqui jogando: a próxima
 * audiência é a primeira da cadência depois de agora. Chame depois de pôr o relógio no lugar.
 */
export function councilInSession(draft: GameState): void {
  draft.council.nextDrawAtMs =
    (Math.floor(draft.lastProcessedAt / DRAW_INTERVAL_MS) + 1) * DRAW_INTERVAL_MS;
}

/**
 * O Conselho em sessão e sem assunto: a audiência cai na cadência de sempre, mas todas as cartas
 * do jogo já saíram neste ano, e nenhuma chega. É o Conselho dos cenários que servem de retrato
 * de outra mecânica (as estações, as filas, os ofícios, a moral): a visão deles traz o Conselho
 * como ele é, sem carta na mesa para tomar a frente da tela.
 *
 * As recorrentes saem mais de uma vez por ano: para elas também calarem, o cenário grava a flag
 * que cada uma proíbe (a vez dela na ronda). No jogo só uma dessas flags fica gravada por vez;
 * este estado só existe em teste.
 */
export function councilWithoutNews(draft: GameState): void {
  councilInSession(draft);
  draft.council.seenThisYear = councilCards.map((card) => card.id);
  for (const card of councilCards) {
    if (card.recurring === true) {
      for (const flag of card.requires?.notFlags ?? []) {
        draft.council.flags[flag] = true;
      }
    }
  }
}

/**
 * O Conselho calado: a próxima audiência fica para daqui a mil anos de jogo. Para os cenários
 * que contam os eventos de outra mecânica, um a um, e não querem carta nenhuma no meio. Serve
 * de `edit` em `gameWith` e `gameAt`, ou dentro de um.
 */
export function quietCouncil(draft: GameState): void {
  draft.council.nextDrawAtMs = 1000 * YEAR;
}

/** Uma cópia do estado com o Conselho calado (`quietCouncil`). */
export function quiet(state: GameState): GameState {
  const draft = cloneState(state);
  quietCouncil(draft);
  return draft;
}

/** Uma partida nova com o Conselho calado (`quietCouncil`). */
export function quietGame(seed = 'pedra-alta'): GameState {
  const draft = cloneState(newGame(seed));
  quietCouncil(draft);
  return draft;
}

/**
 * O mesmo feudo com uma carta do Conselho posta na mesa agora, sem esperar o sorteio: para os
 * cenários de resposta, de expiração e de visão. Devolve o estado e a ocorrência.
 */
export function dealt(
  state: GameState,
  cardId: string,
  catalog: Catalog = CATALOG,
): { state: GameState; instanceId: string } {
  const card = cardOf(catalog, cardId);
  if (card === null) {
    throw new Error(`Carta desconhecida no teste: ${cardId}.`);
  }
  const draft = cloneState(state);
  const { instanceId } = deliverCard(draft, card, draft.lastProcessedAt, [], { source: 'draw' });
  return { state: draft, instanceId };
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
    councilWithoutNews(draft);
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
    councilWithoutNews(draft);
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
    councilWithoutNews(draft);
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
    councilWithoutNews(draft);
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
    councilWithoutNews(draft);
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

/**
 * A Ameaça vista da Torre de Vigia, no ritmo Rápido: o 5º dia do outono, com a Torre no nível 1
 * e um feudo arrumado. A Ameaça estava em 30 ao fim do 2º dia; as duas viradas seguintes somam
 * o covil e o outono (+8 cada), e a primeira cruza os 40: os vigias contam os uivos.
 */
export function watchScenario(): GameState {
  const start = gameAt(AUTUMN + 2 * DAY, (draft) => {
    const { settlement } = draft;
    councilWithoutNews(draft);
    draft.settings.timeScale = 3;
    settlement.population.villagers = 12;
    settlement.workers = { farm: 4, lumberMill: 4, quarry: 2, goldMine: 2 };
    settlement.buildings = {
      ...settlement.buildings,
      townHall: 2,
      housing: 2,
      farm: 2,
      watchtower: 1,
    };
    settlement.resources = { food: 320_000, wood: 300_000, stone: 250_000, gold: 180_000 };
    draft.map.threat = 30;
  });
  return advanceTo(start, AUTUMN + 4 * DAY + 13 * MINUTE).state;
}

/**
 * O mesmo feudo com a Torre no nível 2 e uma incursão média marcada para daqui a 47 minutos de
 * jogo: dentro do aviso da Torre, que neste nível também diz o tamanho. **O estado é montado à
 * mão**: nada marca incursões nesta versão do motor (quem sorteia e resolve é a incursão de
 * lobos, V2E-T3). Só serve para a visão; não avance este estado até a incursão.
 */
export function raidInSightScenario(): GameState {
  const draft = cloneState(watchScenario());
  draft.settlement.buildings.watchtower = 2;
  draft.horde.scheduledRaids = [
    {
      id: 'threat-1',
      atMs: draft.lastProcessedAt + 47 * MINUTE,
      kind: 'threat',
      enemy: 'wolves',
      size: 'medium',
      announcedAtMs: null,
    },
  ];
  return draft;
}

/**
 * O mesmo feudo, com a mesma incursão média à vista, e agora com o Salão no nível 3 e a
 * Paliçada no nível 1: ela não segura um ataque desse tamanho, e a visão diz o que passa. A
 * obra do nível 2 está na lista, com o que ela muda. O estado é montado à mão, como o de
 * `raidInSightScenario`, e só serve para a visão.
 */
export function palisadeScenario(): GameState {
  const draft = cloneState(raidInSightScenario());
  draft.settlement.buildings.townHall = 3;
  draft.settlement.buildings.palisade = 1;
  draft.settlement.resources.wood = 420_000;
  return draft;
}

/**
 * A promessa cobrada, no ritmo Rápido: o Salão no nível 3, a Paliçada ainda por erguer (o
 * material está no pátio) e "O prazo da paliçada" na mesa, quatro dias de jogo depois de o
 * senhor prometer a cerca aos aldeões. A opção de mostrar a obra está trancada, com o motivo;
 * a carta espera 24 h reais, e a obra leva 20 min de jogo.
 */
export function promiseDueScenario(): GameState {
  const start = gameAt(SUMMER + 6 * DAY, (draft) => {
    const { settlement } = draft;
    councilWithoutNews(draft);
    draft.settings.timeScale = 3;
    settlement.population.villagers = 14;
    settlement.workers = { farm: 5, lumberMill: 4, quarry: 3, goldMine: 2 };
    settlement.buildings = {
      ...settlement.buildings,
      townHall: 3,
      housing: 2,
      farm: 2,
      granary: 1,
      warehouse: 1,
    };
    settlement.resources = { food: 380_000, wood: 260_000, stone: 140_000, gold: 120_000 };
  });
  const plea = dealt(start, 'palisadePromisePlea');
  const promised = accept(
    plea.state,
    command('answerCard', { instanceId: plea.instanceId, optionId: 'promise' }),
  ).state;
  return advanceTo(promised, SUMMER + 10 * DAY + 9 * MINUTE).state;
}

/**
 * O que o senhor do cenário responde a cada carta do jogo; a que não está aqui fica na mesa até
 * expirar. O poço fica para depois (a opção que esconde um efeito) e a madeira é cedida ao
 * celeiro (a opção que abre a cadeia).
 */
const councilAnswers: Readonly<Record<string, string>> = {
  collapsedWell: 'wait',
  commonGranaryPlanks: 'cede',
};

/** Responde, com as cartas do jogo, a toda carta da mesa para a qual `answers` tem resposta. */
function answerCards(
  state: GameState,
  answers: Readonly<Record<string, string>>,
  events: GameEvent[] = [],
): GameState {
  let current = state;
  for (const pending of state.council.pending) {
    const optionId = answers[pending.cardId];
    if (optionId !== undefined) {
      const result = accept(
        current,
        command('answerCard', { instanceId: pending.instanceId, optionId }),
      );
      current = result.state;
      events.push(...result.events);
    }
  }
  return current;
}

/**
 * A semente do cenário do Conselho. Foi escolhida pelas cartas que tira nas três primeiras
 * audiências de um feudo com o Celeiro erguido (o poço, as tábuas e a refeição dos pedreiros):
 * o catálogo é conteúdo e muda, e quando mudar a ordem do sorteio é preciso procurar outra.
 */
export const COUNCIL_SCENARIO_SEED = 'fixture-council-623';

/**
 * O Conselho em uso, com as cartas do jogo e no ritmo Rápido: um feudo com o Celeiro erguido,
 * visitado uma vez por dia de jogo (aos 7 minutos do dia) por um senhor que responde a duas
 * cartas e deixa as outras expirarem. Com a semente do cenário:
 *
 * - dia 5: "O poço entulhado" chega; ele deixa para depois (um efeito escondido para o dia 7);
 * - dia 9: "Tábuas para as reservas"; ele cede a madeira, e a cadeia começa;
 * - dia 11: "A vez de repartir" chega como continuação; dia 13, "A refeição dos pedreiros": a
 *   mesa fica cheia, e ninguém responde;
 * - dia 47: a continuação expira (o conselho guarda o grão) e agenda o desfecho; dia 49, a
 *   refeição expira e chega "O que ficou da escolha".
 */
export function councilScenario(untilMs: number, seed = COUNCIL_SCENARIO_SEED): GameState {
  let state = createInitialState(seed, { ...settings, timeScale: 3 });
  state.settlement.buildings = { ...state.settlement.buildings, townHall: 2, granary: 1 };
  state.settlement.workers = { farm: 3, lumberMill: 1, quarry: 0, goldMine: 1 };
  state.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  for (let visit = DAY + 7 * MINUTE; visit < untilMs; visit += DAY) {
    state = answerCards(advanceTo(state, visit).state, councilAnswers);
  }
  return advanceTo(state, untilMs).state;
}

export function eventsOfType(events: GameEvent[], type: GameEvent['type']): GameEvent[] {
  return events.filter((event) => event.type === type);
}

const DAY_REAL = 24 * HOUR;

/**
 * O que o senhor do cenário de 7 dias responde ao Conselho, a cada visita. Segue as três cadeias
 * até o fim: cede as vigas da ponte, manda assentar os pilares de pedra (o que eles rendem
 * aparece dias depois) e abre a passagem com festa; promete a paliçada aos aldeões, ergue-a e a
 * mostra no prazo; cede a madeira ao celeiro, guarda o grão para o inverno e deixa a colheita
 * com as famílias. Deixa o poço para depois (outro efeito escondido) e fecha o portão aos
 * viajantes: com a mesa livre, a audiência seguinte traz o pedido da cerca. Às outras cartas
 * ele não responde: o prazo acaba e o conselho decide sozinho.
 */
const weekAnswers: Readonly<Record<string, string>> = {
  collapsedWell: 'wait',
  commonGranaryPlanks: 'cede',
  commonGranaryShare: 'reserve',
  commonGranaryOutcome: 'leave',
  thawBridgePlea: 'timber',
  thawBridgeSlab: 'piers',
  thawBridgeCrossing: 'feast',
  moreMouths: 'close',
  palisadePromisePlea: 'promise',
  palisadePromiseDeadline: 'show',
};

/** As horas reais em que o senhor do cenário passa pelo feudo e olha a mesa do conselho. */
const WEEK_VISITS = [13, 24, 36, 48, 60, 72, 84, 108, 120, 132, 144, 150, 156, 163];

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
  // O Salão no nível 2 liberou a Torre de Vigia e os depósitos. Primeiro a Torre: fica pronta
  // a tempo de os vigias contarem a Ameaça passando dos 70, na virada das 28 h.
  [25, command('startConstruction', { building: 'watchtower' })],
  // Depois o Armazém, antes que a madeira vá para o chão.
  [30, command('startConstruction', { building: 'warehouse' })],
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
  // A paliçada prometida aos aldeões na visita anterior (o Salão no nível 3 já a libera): fica
  // de pé em 20 minutos, a tempo da cobrança, que chega às 80 h.
  [76, command('startConstruction', { building: 'palisade' })],
  [84, command('recruitVillagers', { quantity: 5 })],
  [84, command('startConstruction', { building: 'quarry' })],
  // Com o Armazém cheio de madeira e de pedra, a Torre sobe ao nível 2 sem tirar nada de obra
  // nenhuma: o que ela leva o feudo repõe antes da visita seguinte.
  [96, command('startConstruction', { building: 'watchtower' })],
  // E não passa disso nesta versão: a recusa diz que os níveis seguintes ficam para depois.
  [97, command('startConstruction', { building: 'watchtower' })],
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

/**
 * O cenário roteirizado de 7 dias reais no ritmo 1: o golden do motor e uma das fixtures de
 * estado. `answers` troca o que o senhor responde ao Conselho: o golden usa as respostas do
 * roteiro, e o parâmetro serve para procurar, quando o catálogo de cartas mudar o sorteio, as
 * respostas com que a história volta a passar pelas cadeias.
 */
export function runWeekScenario(answers: Readonly<Record<string, string>> = weekAnswers) {
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
  const visited = new Set<number>();
  let cursor = 0;
  for (let day = 1; day <= 7; day += 1) {
    for (; cursor < script.length; cursor += 1) {
      const [hour, order] = script[cursor] as [number, Command];
      if (hour * HOUR >= day * DAY_REAL) {
        break;
      }
      advance(hour * HOUR);
      // Antes das ordens de cada visita, o senhor responde às cartas que encontra na mesa.
      if (WEEK_VISITS.includes(hour) && !visited.has(hour)) {
        visited.add(hour);
        for (const pending of state.council.pending) {
          const optionId = answers[pending.cardId];
          if (optionId === undefined) {
            continue;
          }
          const payload = { instanceId: pending.instanceId, optionId };
          const answered = applyCommand(
            state,
            command('answerCard', payload),
            state.lastProcessedAt,
          );
          if (answered.ok) {
            state = answered.state;
            events.push(...answered.events);
          }
          orders.push({
            hour,
            type: 'answerCard',
            payload,
            result: answered.ok ? 'accepted' : answered.code,
          });
        }
      }
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

/**
 * Um catálogo de cartas de mentira, para os testes do Conselho não dependerem das cartas do
 * jogo, que são conteúdo e mudam. Passa pelo mesmo schema do conteúdo (`council.test.ts`
 * confere) e tem uma carta para cada coisa que o motor precisa provar:
 *
 * - `alms`: três opções sem custo, uma para cada dificuldade (ganho, nada, moral que cai).
 * - `toll`: uma opção paga que grava flag e agenda a continuação; uma trancada por edifício; e
 *   a automática, que esconde um efeito para duas viradas depois e também agenda a continuação.
 * - `tollReturn`: só chega como continuação; o texto lembra quem pagou; o ganho não cabe no
 *   depósito de um feudo novo.
 * - `fair`: recorrente, só no verão.
 * - `granaryFeast`: pede o Celeiro, o 30º dia de jogo, moral de 50 a 100 e a ponte sem pedágio pago.
 */
const told = (what: string) => `No {dia}º dia {daEstacao}, ${what} em {feudo}.`;

export const testCards: Catalog = [
  {
    id: 'alms',
    title: 'Esmola à porta',
    text: 'Um mendigo bate à porta do salão. O conselho quer saber o que fazer.',
    weight: 2,
    autoResolve: { peasant: 'bless', lord: 'ignore', ironKing: 'curse' },
    options: [
      {
        id: 'bless',
        label: 'Abençoar o mendigo',
        effects: [{ type: 'resources', amounts: { food: 20 } }],
        hint: 'Quem abençoa costuma receber.',
        chronicle: told('o senhor abençoou o mendigo'),
        expiredChronicle: told('o conselho abençoou o mendigo sem esperar pelo senhor'),
      },
      {
        id: 'ignore',
        label: 'Ignorar a batida',
        effects: [],
        hint: 'Porta fechada não custa nada.',
        chronicle: told('o senhor deixou a porta fechada'),
      },
      {
        id: 'curse',
        label: 'Enxotar o mendigo',
        effects: [{ type: 'morale', amount: -5, durationDays: 2 }],
        hint: 'O povo vê tudo.',
        chronicle: told('o senhor enxotou o mendigo'),
        expiredChronicle: told('o conselho enxotou o mendigo sem esperar pelo senhor'),
      },
    ],
  },
  {
    id: 'toll',
    title: 'Pedágio na ponte',
    text: 'O barqueiro cobra pedágio na ponte velha. O conselho quer saber se o feudo paga.',
    weight: 1,
    autoResolve: { peasant: 'refuse', lord: 'refuse', ironKing: 'refuse' },
    options: [
      {
        id: 'pay',
        label: 'Pagar o pedágio',
        cost: { gold: 20 },
        effects: [
          { type: 'morale', amount: 5, durationDays: 1 },
          { type: 'setFlag', flag: 'toll.paid' },
          { type: 'scheduleCard', cardId: 'tollReturn', afterDays: 2 },
        ],
        hint: 'O barqueiro tem boa memória.',
        chronicle: told('o senhor pagou o pedágio da ponte'),
      },
      {
        id: 'haggle',
        label: 'Regatear com grão',
        requires: { building: 'granary' },
        effects: [{ type: 'resources', amounts: { gold: 10 } }],
        hint: 'Só regateia quem tem celeiro.',
        chronicle: told('o senhor regateou o pedágio com grão'),
      },
      {
        id: 'refuse',
        label: 'Recusar o pedágio',
        effects: [{ type: 'scheduleCard', cardId: 'tollReturn', afterDays: 2 }],
        hint: 'Dizem que o barqueiro não esquece.',
        hidden: {
          afterDays: 2,
          effects: [
            { type: 'resources', amounts: { wood: -30 } },
            { type: 'morale', amount: -10, durationDays: 1 },
          ],
          chronicle: told('o barqueiro cortou as cordas da ponte'),
        },
        chronicle: told('o senhor recusou o pedágio da ponte'),
      },
    ],
  },
  {
    id: 'tollReturn',
    title: 'O barqueiro volta',
    text: 'O barqueiro voltou à ponte. O conselho quer saber como recebê-lo.',
    weight: 0,
    variants: [
      {
        flag: 'toll.paid',
        text: 'O barqueiro que o senhor pagou voltou com madeira de presente. O conselho quer saber como recebê-lo.',
        arrival: told('o barqueiro pago voltou com um presente: {carta}'),
      },
    ],
    autoResolve: { peasant: 'thank', lord: 'dismiss', ironKing: 'dismiss' },
    options: [
      {
        id: 'thank',
        label: 'Agradecer o presente',
        effects: [
          { type: 'resources', amounts: { wood: 450 } },
          { type: 'clearFlag', flag: 'toll.paid' },
        ],
        hint: 'O que não couber no pátio se perde.',
        chronicle: told('o senhor agradeceu ao barqueiro'),
        expiredChronicle: told('o conselho agradeceu ao barqueiro'),
      },
      {
        id: 'dismiss',
        label: 'Dispensar o barqueiro',
        effects: [{ type: 'clearFlag', flag: 'toll.paid' }],
        hint: 'Nada se ganha, nada se perde.',
        chronicle: told('o senhor dispensou o barqueiro'),
      },
    ],
  },
  {
    id: 'fair',
    title: 'Feira de verão',
    text: 'Os mascates pedem licença para armar a feira. O conselho quer saber se há festa.',
    weight: 1,
    recurring: true,
    requires: { seasons: ['summer'] },
    autoResolve: { peasant: 'skip', lord: 'skip', ironKing: 'skip' },
    options: [
      {
        id: 'hold',
        label: 'Armar a feira',
        cost: { food: 10 },
        effects: [{ type: 'morale', amount: 5, durationDays: 1 }],
        hint: 'Feira alegra.',
        chronicle: told('houve feira'),
      },
      {
        id: 'skip',
        label: 'Dispensar a feira',
        effects: [],
        hint: 'Fica para outra vez.',
        chronicle: told('não houve feira'),
      },
    ],
  },
  {
    id: 'granaryFeast',
    title: 'Festa do celeiro',
    text: 'O celeiro está cheio e o povo quer festa. O conselho quer saber se abre os sacos.',
    weight: 1,
    requires: {
      minDay: 30,
      buildings: { granary: 1 },
      notFlags: ['toll.paid'],
      moralRange: [50, 100],
    },
    autoResolve: { peasant: 'keep', lord: 'keep', ironKing: 'keep' },
    options: [
      {
        id: 'open',
        label: 'Abrir os sacos',
        cost: { food: 30 },
        effects: [{ type: 'morale', amount: 10, durationDays: 2 }],
        hint: 'Festa custa grão.',
        chronicle: told('abriram-se os sacos do celeiro'),
      },
      {
        id: 'keep',
        label: 'Guardar o grão',
        effects: [],
        hint: 'Grão guardado não faz festa.',
        chronicle: told('o grão ficou guardado'),
      },
    ],
  },
];

/** `advanceTo` com outro catálogo de cartas: o mesmo laço do jogo, com as cartas de mentira. */
export function advanceWithCards(
  state: GameState,
  gameTimeMs: number,
  catalog: Catalog = testCards,
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, processEventsWith(catalog));
}
