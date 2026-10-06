import {
  balance,
  buildings,
  councilCards,
  expeditionModels,
  type HeroClassId,
  type HeroTraitId,
  type ItemId,
  items,
  objectives,
} from '@lotg/content';

import { advanceTo, advanceWith, processEventsAt, processEventsWith } from './advance';
import { DAY_MS, isDayBoundary } from './clock';
import { applyCommand } from './commands';
import {
  cardOf,
  CATALOG,
  type Catalog,
  defaultOption,
  deliverCard,
  DRAW_INTERVAL_MS,
} from './council';
import { isPosture, modelOf, nextVariant } from './expeditions';
import { addMoraleEffect, famineDesertionsOwedAt } from './morale';
import { scriptedRaidsAfter } from './raids';
import { nextId } from './ids';
import {
  chance,
  dropStream,
  type EntityRngStream,
  entityStream,
  nextInt,
  pickWeighted,
  type RngStreamFamily,
} from './random';
import { cloneState, createInitialState } from './state';
import type {
  Command,
  CommandResult,
  Expedition,
  GameEvent,
  GameSettings,
  GameState,
  Hero,
  Item,
} from './types';
import { MILLI } from './units';
import { deriveViewState } from './view';

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
 * todos cumpridos, para nenhuma recompensa cair no meio da conta, e o Conselho e a Horda estão
 * calados (`quietCouncil`, `quietHorde`), para nenhuma carta e nenhuma incursão caírem no meio
 * dos eventos. O cenário que quer o Conselho chama `councilInSession` no `edit`; o que quer
 * incursões põe as dele em `horde.scheduledRaids`, ou chama `hordeAwake`.
 */
export function gameAt(atMs: number, edit: (draft: GameState) => void = () => {}): GameState {
  return gameWith((draft) => {
    draft.lastProcessedAt = atMs;
    draft.clock.gameTimeMs = atMs;
    draft.clock.year = Math.floor(atMs / YEAR) + 1;
    draft.clock.yearStartMs = Math.floor(atMs / YEAR) * YEAR;
    draft.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
    quietCouncil(draft);
    quietHorde(draft);
    edit(draft);
  });
}

/** Os nomes dos heróis de teste, na ordem em que chegam. */
const TEST_HERO_NAMES = ['Edda', 'Rolf', 'Brann', 'Isolda', 'Tibério', 'Mirela'];

/**
 * Põe um herói no feudo sem passar por carta nenhuma, para os cenários do soldo, do atraso e da
 * ficha: no jogo o primeiro chega pela "Estrangeira ferida" (`settleHeroArrivals`) e os outros
 * virão da Taverna (V3C-T2). O identificador sai do contador do estado (`nextId`), ele chega no
 * instante em que o rascunho está, a não ser que `joinedAtMs` diga outro, e o teto da lista
 * vale aqui como vale para quem chega por recompensa.
 */
export function addHero(
  draft: GameState,
  spec: {
    name?: string;
    gender?: Hero['gender'];
    classId?: HeroClassId;
    level?: number;
    traits?: HeroTraitId[];
    joinedAtMs?: number;
  } = {},
): Hero {
  const { heroes } = draft.guild;
  if (heroes.length >= balance.heroes.rosterCap) {
    throw new Error(`O feudo já tem ${heroes.length} heróis: o teto da lista.`);
  }
  const id = nextId(draft, 'hero');
  const hero: Hero = {
    id,
    name: spec.name ?? TEST_HERO_NAMES[heroes.length % TEST_HERO_NAMES.length] ?? id,
    gender: spec.gender ?? 'm',
    classId: spec.classId ?? 'warrior',
    level: spec.level ?? 1,
    xp: 0,
    traits: spec.traits ?? [],
    status: 'idle',
    injury: null,
    captivity: null,
    equipment: { weapon: null, armor: null, accessory: null },
    joinedAtMs: spec.joinedAtMs ?? draft.lastProcessedAt,
    freedAtMs: null,
    discontent: false,
  };
  heroes.push(hero);
  return hero;
}

/**
 * Põe um item no arsenal, como uma expedição o traria: o identificador sai do contador do
 * estado (`nextId`). Para os cenários do equipamento, que não querem depender de um sorteio.
 */
export function giveItem(draft: GameState, defId: ItemId): Item {
  const item: Item = { id: nextId(draft, 'item'), defId };
  draft.guild.inventory.push(item);
  return item;
}

/**
 * Põe um item novo direto no espaço dele em um herói, sem passar pelo arsenal: para os cenários
 * que querem o herói já equipado.
 */
export function wear(draft: GameState, hero: Hero, defId: ItemId): Item {
  const item = giveItem(draft, defId);
  draft.guild.inventory.pop();
  hero.equipment[items[defId].slot] = item;
  return item;
}

/**
 * Um feudo recém-fundado com três heróis, como as cartas e a Taverna vão pôr: Edda, Guerreira
 * Leal; Rolf, Arqueiro Prudente; e Isolda, Maga Veterana e Gananciosa, de nível 2. Os três
 * chegam no mesmo instante, com `gold` milésimos de ouro no cofre.
 */
export function heroesStart(
  seed: string,
  gold: number,
  changed: Partial<typeof settings> = {},
): GameState {
  const start = createInitialState(seed, { ...settings, ...changed });
  start.settlement.resources.gold = gold;
  addHero(start, { name: 'Edda', gender: 'f', classId: 'warrior', traits: ['loyal'] });
  addHero(start, { name: 'Rolf', classId: 'archer', traits: ['prudent'] });
  addHero(start, {
    name: 'Isolda',
    gender: 'f',
    classId: 'mage',
    level: 2,
    traits: ['veteran', 'greedy'],
  });
  return start;
}

/**
 * A guilda com o soldo quase coberto, no ritmo Rápido: os três heróis de `heroesStart`, 60 de
 * ouro no cofre e um mineiro, que paga dois deles. O ouro cai devagar e tem prazo. Parado no
 * 6º dia de jogo, no meio de um trecho.
 */
export function guildScenario(): GameState {
  return play(heroesStart('fixture-guild-view', 60_000, { timeScale: 3 }), [
    command('setWorkers', { building: 'farm', count: 3 }),
    command('setWorkers', { building: 'goldMine', count: 1 }),
    { at: 5 * DAY + 7 * MINUTE + 1_234 },
  ]).state;
}

/**
 * O soldo em atraso há mais de um dia real, no ritmo Normal: os 20 de ouro do cofre e os 20 do
 * primeiro objetivo pagam os três heróis por 6 h 40 de jogo; às 20 h Rolf e Isolda ficam
 * Descontentes, e às 32 h Isolda, a de identificador mais alto entre os que não são Leais (os
 * três chegaram juntos), parte. O feudo fica parado às 33 h 13 de jogo.
 */
export function wageArrearsScenario(): GameState {
  return play(heroesStart('fixture-wage-arrears', 20_000), [
    command('setWorkers', { building: 'farm', count: 3 }),
    { at: 33 * HOUR + 13 * MINUTE + 2_345 },
  ]).state;
}

/** O mesmo feudo logo depois de chegarem `gold` milésimos de ouro, `afterMs` adiante. */
export function wageArrearsPaid(gold: number, afterMs: number): GameState {
  const paid = wageArrearsScenario();
  paid.settlement.resources.gold = gold;
  return advanceTo(paid, paid.lastProcessedAt + afterMs).state;
}

/**
 * O que `guild` guarda da Taverna e da Guilda dos Aventureiros em um feudo que ainda não as
 * ergueu: nenhum candidato, nenhuma rotação marcada, nenhum festival, nenhuma expedição e nenhum
 * relatório. Para os testes que conferem a guilda inteira.
 */
export const NO_TAVERN: Pick<
  GameState['guild'],
  'tavernOffers' | 'tavern' | 'expeditions' | 'reports' | 'inventory'
> = {
  inventory: [],
  tavernOffers: [],
  tavern: { nextRotationAtMs: null, festival: null, lastFestivalAtMs: null },
  expeditions: [],
  reports: [],
};

/**
 * O canteiro da Taverna: um feudo posto em `atMs` com o Salão no nível 3, os depósitos erguidos
 * e cheios o bastante para as obras dela e o ouro para contratar, os objetivos cumpridos e o
 * Conselho e a Horda calados (para nenhuma carta e nenhum lobo caírem no meio da conta). Ninguém
 * trabalha: o estoque só muda com o que os cinco aldeões comem. Falta dar a ordem da obra.
 * `custom` troca a semente, o ritmo ou a dificuldade.
 */
export function tavernSite(
  atMs = 0,
  edit: (draft: GameState) => void = () => {},
  custom: Partial<GameSettings> & { seed?: string } = {},
): GameState {
  const { seed = 'pedra-alta', ...rest } = custom;
  const draft = cloneState(createInitialState(seed, { ...settings, ...rest }));
  draft.lastProcessedAt = atMs;
  draft.clock.gameTimeMs = atMs;
  draft.clock.year = Math.floor(atMs / YEAR) + 1;
  draft.clock.yearStartMs = Math.floor(atMs / YEAR) * YEAR;
  draft.objectives = { active: [], completed: objectives.map((objective) => objective.id) };
  quietCouncil(draft);
  quietHorde(draft);
  Object.assign(draft.settlement.buildings, { townHall: 3, granary: 2, warehouse: 4 });
  Object.assign(draft.settlement.resources, {
    food: 1_000_000,
    wood: 2_800_000,
    stone: 1_000_000,
    gold: 2_000_000,
  });
  edit(draft);
  return draft;
}

/**
 * A Taverna recém-inaugurada, pelo caminho do jogo: a ordem da obra no canteiro (`tavernSite`)
 * e o avanço até o instante exato em que ela fica pronta, que é o do primeiro sorteio de
 * candidatos. Devolve o estado, os eventos do caminho e esse instante.
 */
export function tavernScenario(
  atMs = 0,
  edit: (draft: GameState) => void = () => {},
  custom: Partial<GameSettings> & { seed?: string } = {},
): { state: GameState; events: GameEvent[]; opensAt: number } {
  const ordered = accept(
    tavernSite(atMs, edit, custom),
    command('startConstruction', { building: 'tavern' }),
  );
  const opensAt = ordered.state.settlement.constructionQueues[0]?.finishesAtMs ?? atMs;
  const opened = advanceTo(ordered.state, opensAt);
  return { state: opened.state, events: [...ordered.events, ...opened.events], opensAt };
}

/**
 * O feudo com a Guilda dos Aventureiros de pé, posta à mão no nível `level`: o canteiro da
 * Taverna (`tavernSite`: Salão no nível 3, depósitos e cofre cheios, objetivos cumpridos,
 * Conselho e Horda calados) com a Guilda erguida. Os heróis entram pelo `edit`, com `addHero`.
 */
export function guildHall(
  atMs = 0,
  edit: (draft: GameState) => void = () => {},
  custom: Partial<GameSettings> & { seed?: string; level?: number } = {},
): GameState {
  const { level = 1, ...rest } = custom;
  return tavernSite(
    atMs,
    (draft) => {
      draft.settlement.buildings.guild = level;
      edit(draft);
    },
    rest,
  );
}

/**
 * Faz o próximo envio de um modelo sair com a variante pedida, mexendo só no contador de envios
 * (a variante é uma conta sobre a semente, o modelo e esse contador). Para os testes que querem
 * um grafo certo sem depender da semente.
 */
export function nextVariantIs(draft: GameState, modelId: string, variant: number): void {
  const model = modelOf(modelId);
  if (model === null) {
    throw new Error(`Modelo de expedição desconhecido: ${modelId}.`);
  }
  for (let sent = 0; sent < model.variants.length; sent += 1) {
    draft.stats[`expeditionsSent:${modelId}`] = sent;
    if (nextVariant(draft, model) === variant) {
      return;
    }
  }
  throw new Error(`Não há contador que dê a variante ${variant} de ${modelId}.`);
}

/** Envia uma expedição no instante em que o estado está e devolve o estado, os eventos e ela. */
export function send(
  state: GameState,
  modelId: string,
  heroIds: string[],
  posture: Expedition['posture'] = 'balanced',
  variant: number | null = null,
): { state: GameState; events: GameEvent[]; expedition: Expedition } {
  const start = cloneState(state);
  if (variant !== null) {
    nextVariantIs(start, modelId, variant);
  }
  const sent = accept(start, command('sendExpedition', { modelId, heroIds, posture }));
  const expedition = sent.state.guild.expeditions.at(-1);
  if (expedition === undefined) {
    throw new Error('A ordem foi aceita e não há expedição.');
  }
  return { ...sent, expedition };
}

/**
 * Leva uma expedição em curso (a primeira, ou a do identificador dado) até a encruzilhada do
 * grafo e responde por ela: a opção dada, a que uma Postura marca (`'cautious'`, `'balanced'`,
 * `'bold'`) ou, sem nada, a que a Postura da expedição marca. Devolve o estado logo depois da escolha, os
 * eventos do caminho e o instante da chegada. Para os testes que querem o que há além da
 * encruzilhada sem esperar o prazo.
 */
export function throughCrossroads(
  state: GameState,
  optionId?: string,
  expeditionId?: string,
): { state: GameState; events: GameEvent[]; arrivedAt: number } {
  let current = state;
  const events: GameEvent[] = [];
  for (let steps = 0; steps < 10; steps += 1) {
    const expedition = current.guild.expeditions.find(
      (entry) => expeditionId === undefined || entry.id === expeditionId,
    );
    if (expedition === undefined) {
      throw new Error('Não há expedição em curso.');
    }
    if (expedition.crossroads !== null) {
      const node = modelOf(expedition.modelId)?.variants[expedition.variant]?.nodes[
        expedition.nodeId
      ];
      const how = isPosture(optionId) ? optionId : expedition.posture;
      const marked = node?.kind === 'crossroads' ? node.posture[how] : '';
      const arrivedAt = current.lastProcessedAt;
      const chosen = accept(
        current,
        command('chooseExpeditionPath', {
          expeditionId: expedition.id,
          optionId: optionId === undefined || isPosture(optionId) ? marked : optionId,
        }),
      );
      return { state: chosen.state, events: [...events, ...chosen.events], arrivedAt };
    }
    const advanced = advanceTo(current, expedition.nodeEndsAtMs ?? current.lastProcessedAt);
    current = advanced.state;
    events.push(...advanced.events);
  }
  throw new Error('A expedição não chegou a uma encruzilhada.');
}

/**
 * A Guilda dos Aventureiros recém-inaugurada, pelo caminho do jogo: a ordem da obra no canteiro
 * (`tavernSite`) e o avanço até o instante exato em que ela fica pronta. Devolve o estado e esse
 * instante.
 */
export function guildOpened(
  atMs = 0,
  edit: (draft: GameState) => void = () => {},
  custom: Partial<GameSettings> & { seed?: string } = {},
): { state: GameState; opensAt: number } {
  const ordered = accept(
    tavernSite(atMs, edit, custom),
    command('startConstruction', { building: 'guild' }),
  );
  const opensAt = ordered.state.settlement.constructionQueues[0]?.finishesAtMs ?? atMs;
  return { state: advanceTo(ordered.state, opensAt).state, opensAt };
}

/** Edda, Guerreira Leal, e Rolf, Arqueiro Prudente, postos no feudo, com lavradores e mineiros. */
function cardHeroes(draft: GameState): void {
  addHero(draft, { name: 'Edda', gender: 'f', traits: ['loyal'] });
  addHero(draft, { name: 'Rolf', classId: 'archer', traits: ['prudent'] });
  Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
}

/**
 * Uma expedição em viagem, no ritmo Rápido, no verão: a Guilda acabou de abrir, Edda saiu em
 * Patrulha com a Postura Ousada e está no meio do primeiro nó, com o fator de duração do verão
 * fixado. O fluxo de sorteio dela ainda não nasceu: nenhum nó terminou. Rolf ficou no feudo.
 */
export function expeditionTravelingScenario(): GameState {
  const { state, opensAt } = guildOpened(SUMMER + 3 * DAY + HOUR, cardHeroes, {
    seed: 'fixture-expedition',
    timeScale: 3,
  });
  const sent = send(state, 'patrol', ['hero-1'], 'bold').state;
  return advanceTo(sent, opensAt + 4 * MINUTE + 1_234).state;
}

/**
 * Uma equipe parada na encruzilhada, no ritmo Normal: Rolf já fez uma Patrulha (o relatório
 * está guardado, e o fluxo dela, apagado), e depois os dois foram à Floresta Antiga com a
 * Postura Equilibrada. Chegaram à encruzilhada há 40 minutos de jogo: o fluxo da expedição já
 * sorteou a lenha da trilha, e o prazo da Postura está a mais de 5 h.
 */
export function expeditionCrossroadsScenario(): GameState {
  const { state, opensAt } = guildOpened(20 * DAY + HOUR, cardHeroes, {
    seed: 'fixture-expedition-crossroads',
  });
  const patrol = send(state, 'patrol', ['hero-2'], 'cautious').state;
  const back = advanceTo(patrol, opensAt + 20 * MINUTE).state;
  // A variante é pedida: a trilha dela rende lenha, e é esse sorteio que põe o fluxo em uso.
  const forest = send(back, 'oldForest', ['hero-1', 'hero-2'], 'balanced', 0);
  const arrivesAt = forest.expedition.nodeEndsAtMs ?? opensAt;
  return advanceTo(forest.state, arrivesAt + 40 * MINUTE + 2_345).state;
}

/**
 * Duas expedições de uma vez, em Rei de Ferro, no ritmo Tranquilo, com a Guilda no nível 2: Edda
 * foi sozinha à Floresta Antiga com a Postura Ousada, ninguém respondeu na encruzilhada, a
 * Postura decidiu no prazo, o nó seguinte foi resolvido e ela está no caminho de volta, com o
 * saque; Rolf saiu em Patrulha há pouco e está no primeiro nó. Brann ficou no feudo.
 */
export function expeditionReturningScenario(): GameState {
  const first = guildOpened(
    40 * DAY + HOUR,
    (draft) => {
      cardHeroes(draft);
      addHero(draft, { name: 'Brann', traits: ['brave'] });
    },
    { seed: 'fixture-expedition-returning', difficulty: 'ironKing', timeScale: 0.5 },
  );
  const upgraded = accept(first.state, command('startConstruction', { building: 'guild' }));
  const opensAt = upgraded.state.settlement.constructionQueues[0]?.finishesAtMs ?? first.opensAt;
  const forest = send(advanceTo(upgraded.state, opensAt).state, 'oldForest', ['hero-1'], 'bold');
  const arrivesAt = forest.expedition.nodeEndsAtMs ?? opensAt;
  const decidesAt = arrivesAt + balance.expeditions.crossroadsWaitRealMs * 0.5;
  // Vinte minutos depois de a Postura decidir, Rolf sai em Patrulha.
  const patrol = send(advanceTo(forest.state, decidesAt + 20 * MINUTE).state, 'patrol', ['hero-2']);
  const resolved = patrol.state.guild.expeditions[0]?.nodeEndsAtMs ?? decidesAt;
  return advanceTo(patrol.state, resolved + 3 * MINUTE + 456).state;
}

/**
 * Abre todos os destinos do conteúdo para os testes que percorrem o catálogo inteiro: revela os
 * que aparecem por descoberta e põe no feudo um herói em cativeiro, que é o que faz o Resgate
 * aparecer. O cativo fica no fim da lista de heróis, depois de quem o teste já pôs.
 */
export function everyDestinationOpen(draft: GameState): void {
  draft.map.discovered = expeditionModels
    .filter((model) => model.access.kind === 'discovered')
    .map((model) => model.id);
  const captive = addHero(draft, { name: 'Cativo' });
  captive.status = 'captured';
  captive.captivity = { sinceMs: draft.lastProcessedAt, modelId: 'ruins' };
}

/**
 * Põe a única expedição em curso no nó dado, a dez minutos de jogo do fim dele, e devolve o
 * estado e esse instante. Para os testes que querem o desfecho de um nó sem depender dos
 * anteriores. O estado continua na forma.
 */
export function expeditionAtNode(
  state: GameState,
  nodeId: string,
): { state: GameState; endsAt: number } {
  const next = cloneState(state);
  const [expedition] = next.guild.expeditions;
  if (expedition === undefined) {
    throw new Error('Não há expedição em curso.');
  }
  const endsAt = next.lastProcessedAt + 10 * MINUTE;
  Object.assign(expedition, {
    nodeId,
    status: 'traveling',
    nodeEndsAtMs: endsAt,
    crossroads: null,
  });
  return { state: next, endsAt };
}

/**
 * Enfraquece os heróis dados para o desfecho ruim ser certo, sem procurar semente: viram
 * Clérigos de nível 1, Descontentes, com o cofre vazio e o soldo em atraso aberto agora. Um
 * vale 25,6 e dois, 51,2: contra 90 é Desastre em toda a faixa da sorte, e um só contra 30 é
 * Revés em toda ela.
 */
export function weakened(state: GameState, heroIds: readonly string[]): GameState {
  const next = cloneState(state);
  for (const hero of next.guild.heroes) {
    if (heroIds.includes(hero.id)) {
      Object.assign(hero, { classId: 'cleric', level: 1, discontent: true });
    }
  }
  next.guild.wageArrears = { sinceMs: next.lastProcessedAt, carriedMs: 0, departed: 0 };
  next.guild.lastWageArrears = null;
  next.settlement.resources.gold = 0;
  return next;
}

/**
 * Uma heroína em recuperação, no ritmo Rápido: Edda, de nível 2, foi sozinha à Floresta Antiga,
 * tomou a mata fechada por ordem do senhor, sofreu um Revés (certo: 45,36 contra 55), ganhou a
 * experiência dele e voltou. Está no feudo há dez minutos de jogo, ferida de leve, com o prazo
 * de sarar marcado. Rolf ficou no feudo, com um item do arsenal, e outro item espera dono.
 */
export function heroInjuredScenario(): GameState {
  const start = guildHall(
    30 * DAY + HOUR,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', level: 2, traits: ['loyal'] });
      addHero(draft, { name: 'Rolf', classId: 'archer', traits: ['prudent'] });
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
      giveItem(draft, 'ashBow');
      giveItem(draft, 'luckyCharm');
    },
    { seed: 'fixture-hero-injured', timeScale: 3 },
  );
  const armed = accept(start, command('equipItem', { heroId: 'hero-2', itemId: 'item-1' })).state;
  const sent = send(armed, 'oldForest', ['hero-1'], 'bold', 0);
  const fork = advanceTo(sent.state, sent.expedition.nodeEndsAtMs ?? 0).state;
  const chosen = accept(
    fork,
    command('chooseExpeditionPath', { expeditionId: 'expedition-1', optionId: 'thicket' }),
  ).state;
  const resolvedAt = chosen.guild.expeditions[0]?.nodeEndsAtMs ?? 0;
  return advanceTo(chosen, resolvedAt + 30 * MINUTE + 789).state;
}

/**
 * Um herói em cativeiro, em Senhor: Edda e Rolf, cada um com um item, foram às Ruínas de
 * Vel'Thar, e o guardião da cripta os venceu (Desastre certo, com os dois enfraquecidos). Um
 * ficou em cativeiro, com o item que levava; o outro voltou e está no feudo. Brann ficou em
 * casa. O soldo está em atraso desde a cripta, e o Resgate aparece na lista da Guilda.
 */
export function heroCapturedScenario(): GameState {
  const start = guildHall(
    50 * DAY + HOUR,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', level: 2 });
      addHero(draft, { name: 'Rolf', classId: 'archer', level: 2, traits: ['tracker'] });
      addHero(draft, { name: 'Brann', traits: ['loyal'] });
      draft.map.discovered = ['ruins'];
      const [edda, rolf] = draft.guild.heroes;
      if (edda !== undefined && rolf !== undefined) {
        wear(draft, edda, 'huntingSpear');
        wear(draft, rolf, 'paddedJerkin');
      }
    },
    { seed: 'fixture-hero-captured' },
  );
  const sent = send(start, 'ruins', ['hero-1', 'hero-2'], 'balanced', 0).state;
  const crypt = expeditionAtNode(weakened(sent, ['hero-1', 'hero-2']), 'stoneGuardian');
  return advanceTo(crypt.state, crypt.endsAt + 50 * MINUTE + 321).state;
}

/**
 * O Covil de Lobos limpo, com a Torre de Vigia de pé: Edda e Rolf, de nível 10, enfumaçaram a toca
 * por ordem do senhor (Sucesso Pleno certo), a Ameaça caiu e o tile parou de somar. A equipe já voltou; o relatório
 * está guardado. Parado no dia seguinte, no meio de um trecho.
 */
export function denClearedScenario(): GameState {
  const start = guildHall(
    10 * DAY + HOUR,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', level: 10, traits: ['loyal'] });
      addHero(draft, { name: 'Rolf', classId: 'archer', level: 10, traits: ['greedy'] });
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
      draft.settlement.buildings.watchtower = 1;
      draft.map.threat = 46;
    },
    { seed: 'fixture-den-cleared', timeScale: 0.5 },
  );
  const sent = send(start, 'wolfDen', ['hero-1', 'hero-2'], 'bold', 0);
  // Na boca da toca, o senhor manda enfumaçá-la: o caminho do meio, que limpa o Covil.
  const chosen = throughCrossroads(sent.state, 'smokeOut');
  return advanceTo(chosen.state, sent.state.lastProcessedAt + 3 * HOUR + 654).state;
}

/**
 * A Taverna aberta há pouco, no ritmo Rápido, no 14º dia de jogo: Edda, a da carta, já serve ao
 * feudo, três lavradores e dois mineiros trabalham, a lista tem os dois primeiros candidatos e o
 * festival está à disposição. Parado 40 minutos de jogo depois da inauguração, no meio de um
 * trecho.
 */
export function tavernOpenScenario(): GameState {
  const { state, opensAt } = tavernScenario(
    13 * DAY + 3 * HOUR,
    (draft) => {
      addHero(draft, { name: 'Edda', gender: 'f', traits: ['loyal'] });
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
    },
    { seed: 'fixture-tavern', timeScale: 3 },
  );
  return advanceTo(state, opensAt + 40 * MINUTE + 1_234).state;
}

/**
 * A Taverna cheia e em festa, no ritmo Normal: Mécia, Carismática, já servia ao feudo; o senhor
 * contratou o primeiro candidato, com o desconto dela, e deu o festival da estação. Parado vinte
 * minutos de jogo depois da primeira troca da lista: os candidatos são os da segunda rotação,
 * com o desconto no preço e sem lugar na equipe (a Taverna Nv1 abriga dois heróis), e o
 * festival está na última meia hora.
 */
export function tavernBusyScenario(): GameState {
  const { state, opensAt } = tavernScenario(
    30 * DAY + HOUR,
    (draft) => {
      addHero(draft, { name: 'Mécia', gender: 'f', classId: 'cleric', traits: ['charismatic'] });
      Object.assign(draft.settlement.workers, { farm: 3, goldMine: 2 });
    },
    { seed: 'fixture-tavern-busy' },
  );
  const [first] = state.guild.tavernOffers;
  if (first === undefined) {
    throw new Error('O cenário esperava um candidato na Taverna.');
  }
  return play(state, [
    command('hireHero', { offerId: first.offerId }),
    command('holdFestival', {}),
    { at: opensAt + balance.tavern.rotationMs + 20 * MINUTE + 2_345 },
  ]).state;
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
    // A roteirizada não olha a lista do ano: sai uma vez por partida. Aqui ela já saiu.
    if (card.scripted !== undefined) {
      draft.stats[`cardsDrawn:${card.id}`] = 1;
    }
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

/**
 * A Horda calada: no lugar das incursões marcadas fica uma só, para daqui a mil anos de jogo.
 * Como só há uma marcada por vez, a Ameaça não sorteia nenhuma outra, a do roteiro do ano 1 não
 * acontece, e nenhum vigia a avista: a Ameaça sobe como sempre, e mais nada. Para os cenários
 * que contam os eventos e os estoques de outra mecânica. Serve de `edit` em `gameWith` e
 * `gameAt`, ou dentro de um. Este estado só existe em teste.
 */
export function quietHorde(draft: GameState): void {
  draft.horde.scheduledRaids = [
    {
      id: 'never',
      atMs: 1000 * YEAR,
      kind: 'threat',
      enemy: 'wolves',
      size: 'light',
      announcedAtMs: null,
    },
  ];
}

/**
 * A Horda de um feudo que chegou até aqui jogando, sem nenhuma incursão marcada: a do roteiro,
 * se o instante dela ainda não passou, e mais nenhuma. A Ameaça volta a sortear nas viradas do
 * dia. Chame depois de pôr o relógio no lugar.
 */
export function hordeAwake(draft: GameState): void {
  draft.horde.scheduledRaids = scriptedRaidsAfter(draft.lastProcessedAt);
}

/**
 * Uma fome nova, aberta em `sinceMs`, como o estado a guarda: sem nada de uma fome anterior e,
 * por padrão, sem nenhum desertor cobrado ainda.
 */
export function famineSince(
  sinceMs: number,
  deserted = 0,
): NonNullable<GameState['settlement']['famine']> {
  return { sinceMs, carriedMs: 0, deserted };
}

/**
 * Põe o feudo em fome desde `sinceMs`, com a deserção em dia: os aldeões que o prazo já devia
 * na última virada de dia antes de agora contam como cobrados, como em um feudo que chegou até
 * aqui jogando. Sem isso, a primeira virada cobraria de uma vez tudo o que a fome antiga deve.
 * Chame depois de pôr o relógio, o ritmo e a dificuldade no lugar.
 */
export function starve(draft: GameState, sinceMs: number): void {
  draft.settlement.famine = famineSince(sinceMs);
  const lastTurn = Math.floor(draft.lastProcessedAt / DAY) * DAY;
  draft.settlement.famine.deserted = famineDesertionsOwedAt(draft, lastTurn);
}

/** Uma cópia do estado com o Conselho e a Horda calados (`quietCouncil`, `quietHorde`). */
export function quiet(state: GameState): GameState {
  const draft = cloneState(state);
  quietCouncil(draft);
  quietHorde(draft);
  return draft;
}

/** Uma partida nova com o Conselho e a Horda calados (`quietCouncil`, `quietHorde`). */
export function quietGame(seed = 'pedra-alta'): GameState {
  return quiet(newGame(seed));
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
 * Celeiro e Armazém no nível máximo (5.200 de cada recurso em Senhor): para os cenários que não
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

/** Roteiro que cumpre os quatro primeiros objetivos (os da v0.1), na ordem. */
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
 * A resposta de quem joga pela tela: a carta que chegou primeiro à mesa e, dela, a primeira
 * opção que o feudo pode pagar e não está trancada. Só lê a visão, como o app.
 */
export function answerFirstCard(state: GameState): Command {
  const [card] = deriveViewState(state, state.lastProcessedAt).council.pending;
  const option = card?.options.find((entry) => entry.affordable && !entry.locked);
  if (card === undefined || option === undefined) {
    throw new Error('O roteiro esperava uma carta do Conselho na mesa, com uma opção ao alcance.');
  }
  return command('answerCard', { instanceId: card.instanceId, optionId: option.id });
}

/**
 * Roteiro que cumpre os seis objetivos da v0.2, na ordem, a partir de um feudo que cumpriu os
 * quatro primeiros no 4º dia da primavera (`objectivesScenario`, ou o retrato da v0.1 migrado):
 * a Torre de Vigia, a resposta à primeira carta, o Celeiro, o Salão marcado para subir sozinho,
 * a Paliçada (que pede o Salão no nível 3) e o inverno atravessado com a Serraria cheia de
 * gente. O Conselho e a Horda ficam como o jogo os deixa: as cartas sem resposta expiram, e os
 * lobos vêm.
 */
export function laterObjectivesScenario(start: GameState): {
  state: GameState;
  events: GameEvent[];
} {
  const tower = play(start, [
    { at: 14 * HOUR },
    command('startConstruction', { building: 'watchtower' }),
    // A primeira carta de um feudo migrado só chega depois da fronteira: às 16 h já chegou.
    { at: 17 * HOUR },
  ]);
  const rest = play(tower.state, [
    answerFirstCard(tower.state),
    { at: 21 * HOUR },
    command('startConstruction', { building: 'granary' }),
    { at: 21 * HOUR + 10 * MINUTE },
    // O Salão ainda não pode subir: a obra fica na lista e começa quando houver com quê.
    command('planConstruction', { building: 'townHall', autoStart: true }),
    command('setWorkers', { building: 'quarry', count: 2 }),
    command('setWorkers', { building: 'goldMine', count: 1 }),
    { at: SUMMER },
    command('startConstruction', { building: 'palisade' }),
    { at: YEAR },
  ]);
  return { state: rest.state, events: [...tower.events, ...rest.events] };
}

/** Roteiro que cumpre os dez objetivos da v0.2, na ordem, em uma partida nova: um ano de jogo. */
export function allObjectivesScenario(): { state: GameState; events: GameEvent[] } {
  const first = objectivesScenario();
  const later = laterObjectivesScenario(first.state);
  return { state: later.state, events: [...first.events, ...later.events] };
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
    starve(draft, WINTER - 18 * DAY);
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
 * e um feudo arrumado. A Ameaça estava em 36 ao fim do 2º dia; as duas viradas seguintes somam
 * o covil e o outono (+5 cada), e a primeira cruza os 40: os vigias contam os uivos.
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
    draft.map.threat = 36;
  });
  return advanceTo(start, AUTUMN + 4 * DAY + 13 * MINUTE).state;
}

/**
 * O mesmo feudo com a Torre no nível 2 e uma incursão média marcada para daqui a 47 minutos de
 * jogo: dentro do aviso da Torre, que neste nível também diz o tamanho. O estado é montado à
 * mão, para a incursão cair onde o retrato a quer: no jogo ela chega sempre em uma virada de
 * dia (`threat.raids.test.ts`).
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
      // Como se os vigias do nível 2 a tivessem anunciado na hora deles, 2 h de jogo antes.
      announcedAtMs: draft.lastProcessedAt + 47 * MINUTE - 2 * HOUR,
    },
  ];
  return draft;
}

/**
 * O dia seguinte ao ataque, no ritmo Rápido: o feudo do cenário da Torre sem Paliçada, uma hora
 * de jogo depois de uma matilha grande passar por ele. Dois feridos (um lavrador e um lenhador,
 * que voltam ao ofício sozinhos), a comida e a madeira que os lobos levaram, o termo de moral
 * da incursão na conta da próxima virada, e a Ameaça derrubada por ela, mas ainda acima dos 40.
 * É o que a tela mostra a quem volta e quer saber o que aconteceu e o que fazer.
 */
export function raidAftermathScenario(): GameState {
  const start = cloneState(watchScenario());
  const arrival = AUTUMN + 5 * DAY;
  // A matilha grande vem da Ameaça acima dos 70; depois do ataque ela fica acima dos 40, e a
  // próxima virada ainda pode marcar outra incursão.
  start.map.threat = 71;
  // Todos no ofício: os feridos saem da Fazenda e da Serraria.
  start.settlement.workers = { farm: 4, lumberMill: 4, quarry: 2, goldMine: 2 };
  start.horde.scheduledRaids = [
    {
      id: 'threat-1',
      atMs: arrival,
      kind: 'threat',
      enemy: 'wolves',
      size: 'medium',
      announcedAtMs: null,
    },
  ];
  return advanceTo(start, arrival + HOUR).state;
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
 * Responde a toda carta da mesa como o conselho responderia sozinho (a opção de `defaultOption`,
 * que nunca tem custo nem está trancada), salvo as cartas de `choices`, que levam a opção dita,
 * e as de `skip`, que ficam na mesa. É o senhor que não deixa carta esperando: a mesa dele está
 * livre para a audiência seguinte.
 */
export function answerTable(
  state: GameState,
  choices: Readonly<Record<string, string>> = {},
  events: GameEvent[] = [],
  skip: readonly string[] = [],
): GameState {
  let current = state;
  for (const pending of state.council.pending) {
    const card = cardOf(CATALOG, pending.cardId);
    if (card === null || skip.includes(card.id)) {
      continue;
    }
    const optionId = choices[card.id] ?? defaultOption(current, card)?.id;
    if (optionId === undefined) {
      continue;
    }
    const result = accept(
      current,
      command('answerCard', { instanceId: pending.instanceId, optionId }),
    );
    current = result.state;
    events.push(...result.events);
  }
  return current;
}

/**
 * Um senhor atento: passa pelo feudo uma vez por dia de jogo, aos 7 minutos do dia, e responde a
 * tudo o que encontra na mesa (`answerTable`). Avança até `untilMs` e devolve o estado e todos os
 * eventos do caminho. `skip` são as cartas que ele deixa na mesa.
 */
export function attentiveLord(
  start: GameState,
  untilMs: number,
  choices: Readonly<Record<string, string>> = {},
  skip: readonly string[] = [],
): { state: GameState; events: GameEvent[] } {
  let state = start;
  const events: GameEvent[] = [];
  const advance = (toMs: number) => {
    const result = advanceTo(state, toMs);
    state = result.state;
    events.push(...result.events);
  };
  const firstVisit = Math.floor(start.lastProcessedAt / DAY) * DAY + 7 * MINUTE;
  for (let visit = firstVisit; visit < untilMs; visit += DAY) {
    if (visit > state.lastProcessedAt) {
      advance(visit);
      state = answerTable(state, choices, events, skip);
    }
  }
  advance(untilMs);
  return { state, events };
}

/**
 * O herói prometido, a caminho: uma partida nova em Rei de Ferro, com um senhor atento. A carta
 * da estrangeira chega na audiência do 13º dia; ele manda cuidar dela e a deixa partir, e o
 * feudo fica parado 33 minutos depois: o ouro dela no cofre, o efeito de moral valendo e o
 * arqueiro a um dia de jogo de distância, na lista dos prometidos.
 */
export function heroPromisedScenario(): GameState {
  const start = createInitialState('fixture-hero-promised', {
    ...settings,
    difficulty: 'ironKing',
  });
  const { state } = attentiveLord(start, 12 * DAY + 40 * MINUTE + 1_234, {
    woundedStranger: 'tend',
  });
  return state;
}

/**
 * A semente do cenário do Conselho. Foi escolhida pelas cartas que tira nas duas primeiras
 * audiências de um feudo com o Celeiro erguido (o poço e as tábuas): o catálogo é conteúdo e
 * muda, e quando mudar a ordem do sorteio é preciso procurar outra. A terceira audiência, a do
 * 13º dia, é da carta roteirizada e não gasta o gerador.
 */
export const COUNCIL_SCENARIO_SEED = 'fixture-council-623';

/**
 * O Conselho em uso, com as cartas do jogo e no ritmo Rápido: um feudo com o Celeiro erguido,
 * visitado uma vez por dia de jogo (aos 7 minutos do dia) por um senhor que responde a duas
 * cartas e deixa as outras expirarem. Com a semente do cenário:
 *
 * - dia 5: "O poço entulhado" chega; ele deixa para depois (um efeito escondido para o dia 7);
 * - dia 9: "Tábuas para as reservas"; ele cede a madeira, e a cadeia começa;
 * - dia 11: "A vez de repartir" chega como continuação; dia 13, a roteirizada "Estrangeira
 *   ferida": a mesa fica cheia, e ninguém responde;
 * - dia 47: a continuação expira (o conselho guarda o grão) e agenda o desfecho; dia 49, a
 *   carta da estrangeira expira (o conselho a acolhe, e Edda entra para o feudo) e chega "O que
 *   ficou da escolha".
 *
 * Com `strangerCameBefore`, o feudo é um em que a roteirizada já saiu (só existe em teste): a
 * audiência do dia 13 volta a ser do sorteio e traz "A refeição dos pedreiros", com uma opção
 * trancada. É a mesa de duas cartas comuns que a visão de exemplo do app usa.
 */
export function councilScenario(
  untilMs: number,
  seed = COUNCIL_SCENARIO_SEED,
  strangerCameBefore = false,
): GameState {
  let state = createInitialState(seed, { ...settings, timeScale: 3 });
  if (strangerCameBefore) {
    for (const card of councilCards.filter((entry) => entry.scripted !== undefined)) {
      state.stats[`cardsDrawn:${card.id}`] = 1;
    }
  }
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
 * com as famílias. Fecha o portão aos viajantes: com a mesa livre, a audiência seguinte traz o
 * pedido da cerca. O poço, se chegar a tempo, fica para depois (outro efeito escondido); no
 * roteiro de hoje ele só chega na virada do ano. Às outras cartas ele não responde: o prazo
 * acaba e o conselho decide sozinho.
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
  woundedStranger: 'shelter',
  palisadePromisePlea: 'show',
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
  // a tempo de os vigias avistarem os lobos do roteiro uma hora antes de eles chegarem (30 h).
  [25, command('startConstruction', { building: 'watchtower' })],
  // Depois o Armazém, antes que a madeira vá para o chão.
  [30, command('startConstruction', { building: 'warehouse' })],
  [36, command('startConstruction', { building: 'quarry' })],
  [36, command('cancelConstruction', { building: 'quarry' })],
  [36, command('startConstruction', { building: 'housing' })],
  [36, command('setWorkers', { building: 'quarry', count: 9 })],
  // Não há nove braços livres: os dois que sobram vão para a Pedreira.
  [36, command('setWorkers', { building: 'quarry', count: 4 })],
  // Dia 3: o feudo ganha nome novo e o Salão sobe.
  [48, command('recruitVillagers', { quantity: 4 })],
  [48, command('startConstruction', { building: 'goldMine' })],
  [48, command('renameSettlement', { name: 'Pedra Alta do Norte' })],
  [52, command('startConstruction', { building: 'granary' })],
  [60, command('setWorkers', { building: 'quarry', count: 4 })],
  [60, command('startConstruction', { building: 'townHall' })],
  // Dia 4: o senhor tira todos da Fazenda e gasta a comida em recrutas. A fome vem (90 h), e
  // com ela a moral cai: o povo fica inquieto.
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
  // O outono começa e a Ameaça sobe mais depressa: o senhor leva a Paliçada ao nível 2. Daí em
  // diante toda matilha recua.
  [97, command('startConstruction', { building: 'palisade' })],
  // A fome já dura sete horas de jogo e o povo anda inquieto. De volta à Fazenda; a fome acaba.
  [97, command('setWorkers', { building: 'lumberMill', count: 2 })],
  [97, command('setWorkers', { building: 'farm', count: 8 })],
  // Dia 5: a despensa ainda se refaz.
  [108, command('recruitVillagers', { quantity: 1 })],
  [108, command('startConstruction', { building: 'lumberMill' })],
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

/** Tipo dos eventos das entidades sintéticas: não existe no conteúdo nem chega a jogador nenhum. */
export const SYNTHETIC_ENTITY = 'syntheticEntity' as GameEvent['type'];

/** Uma entidade do roteiro sintético: nasce na virada do dia `bornOnDay` e vive `lifeDays`. */
export type SyntheticEntityPlan = {
  /** O dia de jogo (a virada de número tal desde a fundação) em que ela nasce. */
  bornOnDay: number;
  family: RngStreamFamily;
  /** Por quantas viradas ela sorteia antes de terminar; a última é a do fim. A partir de 1. */
  lifeDays: number;
};

/** Uma entidade sintética viva, como fica no estado entre uma virada e outra. */
export type SyntheticEntity = { id: string; stream: EntityRngStream; endsOnDay: number };

/** O estado com as entidades sintéticas: um campo que só o cenário de teste escreve. */
export type SyntheticEntityState = GameState & { syntheticEntities?: SyntheticEntity[] };

export const syntheticEntitiesOf = (state: GameState): SyntheticEntity[] =>
  (state as SyntheticEntityState).syntheticEntities ?? [];

/**
 * A virada de dia das entidades sintéticas, na ordem que toda mecânica com entidades segue:
 *
 * 1. nascem as do roteiro marcadas para este dia, na ordem do roteiro, cada uma com o
 *    identificador de `nextId` (o tipo é o nome da família);
 * 2. cada entidade viva, **na ordem do identificador**, sorteia no próprio fluxo: um dado de mil
 *    faces, que vai para o evento, e um achado de madeira, que mexe no estoque e, por ele, nas
 *    taxas, nos limites e em tudo o que vem depois;
 * 3. as que chegaram ao último dia terminam, e o fluxo delas é apagado.
 *
 * Nenhuma regra do jogo é assim. O número de sorteios de cada entidade não depende do estoque
 * nem das outras: é o que deixa comparar os sorteios dela com e sem uma vizinha.
 */
function syntheticEntityTurn(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  plan: readonly SyntheticEntityPlan[],
): void {
  const day = atMs / DAY_MS;
  const holder = draft as SyntheticEntityState;
  const alive = holder.syntheticEntities ?? [];
  const emit = (data: Record<string, string | number>) =>
    events.push({ type: SYNTHETIC_ENTITY, atMs, text: 'Entidade sintética de teste.', data });

  for (const entry of plan) {
    if (entry.bornOnDay === day) {
      const id = nextId(draft, entry.family);
      alive.push({
        id,
        stream: entityStream(entry.family, id),
        endsOnDay: day + entry.lifeDays - 1,
      });
      emit({ step: 'born', entity: id });
    }
  }
  // A ordem do identificador: o tipo e, dentro dele, o número (e não o texto: 10 vem depois de 9).
  const number = (id: string) => Number(id.slice(id.lastIndexOf('-') + 1));
  alive.sort((a, b) => {
    const [kindA, kindB] = [a.id.split('-')[0] ?? '', b.id.split('-')[0] ?? ''];
    return kindA === kindB ? number(a.id) - number(b.id) : kindA < kindB ? -1 : 1;
  });
  for (const entity of alive) {
    const roll = nextInt(draft, entity.stream, 1000);
    const found = chance(draft, entity.stream, { num: 2, den: 5 }) ? (roll % 7) + 1 : 0;
    draft.settlement.resources.wood += found * MILLI;
    emit({ step: 'drew', entity: entity.id, roll, found });
  }
  const remaining: SyntheticEntity[] = [];
  for (const entity of alive) {
    if (entity.endsOnDay <= day) {
      dropStream(draft, entity.stream);
      emit({ step: 'ended', entity: entity.id });
    } else {
      remaining.push(entity);
    }
  }
  holder.syntheticEntities = remaining;
}

/**
 * `advanceTo` com entidades que nascem, sorteiam nos próprios fluxos e terminam, segundo um
 * roteiro (`plan`), além dos sorteios diários nos três fluxos fixos de `advanceWithDailyDraws`.
 * É o laço do jogo, com os eventos de verdade processados logo depois. O motor ainda não tem
 * entidade nenhuma: este cenário prova a divisão de intervalo com fluxos que nascem e morrem no
 * caminho antes de a primeira expedição existir.
 *
 * As entidades vivas ficam em um campo a mais do estado (`syntheticEntities`), que só existe
 * aqui: tudo o que o cenário precisa lembrar entre dois avanços está no estado, e não em quem
 * chamou. O roteiro tem de ser o mesmo em todo avanço da mesma partida.
 */
export function advanceWithEntities(
  state: GameState,
  gameTimeMs: number,
  plan: readonly SyntheticEntityPlan[],
): { state: GameState; events: GameEvent[] } {
  return advanceWith(state, gameTimeMs, (draft, atMs, events) => {
    if (isDayBoundary(atMs)) {
      syntheticDayTurn(draft, atMs, events);
      syntheticEntityTurn(draft, atMs, events, plan);
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
