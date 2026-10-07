import {
  balance,
  BUILDING_IDS,
  DIFFICULTY_IDS,
  ENEMY_IDS,
  EXPEDITION_OUTCOME_IDS,
  HERO_CLASS_IDS,
  HERO_GENDER_IDS,
  HERO_STATUS_IDS,
  HERO_TRAIT_IDS,
  namedHeroes,
  POSTURE_IDS,
  MARKET_RESOURCE_IDS,
  MASTER_IDS,
  PRODUCTION_BUILDING_IDS,
  RAID_SIZE_IDS,
  RESOURCE_IDS,
  TILE_TYPE_IDS,
} from '@lotg/content';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { CATALOG, eligibleCards } from './council';
import { nextId } from './ids';
import { deliverMaster } from './masterTurn';
import {
  CURRENT_SCHEMA_VERSION,
  currentShape,
  type MigrationChain,
  migrateState,
  migrateWith,
  migrationSteps,
  StateMigrationError,
} from './migrations';
import { natural, type Shape } from './migrations/shape';
import { v1ToV2 } from './migrations/v1';
import { stateV2, v2ToV3 } from './migrations/v2';
import { stateV3, v3ToV4 } from './migrations/v3';
import { stateV4, v4ToV5 } from './migrations/v4';
import { stateV5, v5ToV6 } from './migrations/v5';
import { stateV6, v6ToV7 } from './migrations/v6';
import { stateV7, v7ToV8 } from './migrations/v7';
import { stateV8, v8ToV9 } from './migrations/v8';
import { stateV9, v9ToV10 } from './migrations/v9';
import { stateV10, v10ToV11 } from './migrations/v10';
import { stateV11, v11ToV12 } from './migrations/v11';
import { stateV12 } from './migrations/v12';
import {
  idsShape,
  RNG_FIXED_STREAMS_V13,
  RNG_STREAM_FAMILIES_V13,
  rngShape,
} from './migrations/v13';
import {
  HERO_CLASS_IDS_V14,
  HERO_MAX_LEVEL_V14,
  HERO_ROSTER_CAP_V14,
  HERO_GENDER_FROM_V14,
  HERO_TRAIT_IDS_V14,
} from './migrations/v14';
import { HERO_ARRIVING_CAP_V15, HERO_GENDER_IDS_V15 } from './migrations/v15';
import { BUILDING_IDS_V16, RNG_FIXED_STREAMS_V16, TAVERN_OFFERS_CAP_V16 } from './migrations/v16';
import {
  BUILDING_IDS_V17,
  CROSSROADS_DECIDERS_V17,
  EXPEDITION_LOG_CAP_V17,
  EXPEDITION_LOG_OUTCOMES_V17,
  EXPEDITION_REPORTS_CAP_V17,
  EXPEDITION_SLOTS_CAP_V17,
  EXPEDITION_TEAM_CAP_V17,
  EXPEDITION_VARIANTS_V17,
  HERO_STATUS_IDS_V17,
  POSTURE_IDS_V17,
} from './migrations/v17';
import { EXPEDITION_LESSON_KINDS_V19 } from './migrations/v19';
import { EXPEDITION_LESSON_KINDS_V20, MARKET_BASE_PRICES_V21 } from './migrations/v20';
import { BUILDING_IDS_V21, MARKET_RESOURCE_IDS_V21, RNG_FIXED_STREAMS_V21 } from './migrations/v21';
import { CARAVAN_SLOTS_CAP_V22, HERO_STATUS_IDS_V22 } from './migrations/v22';
import { MASTER_IDS_V23, MASTERS_CAP_V23, PRODUCTION_BUILDING_IDS_V23 } from './migrations/v23';
import { entityStream, nextInt, RNG_STREAM_FAMILIES, RNG_STREAMS } from './random';
import { scriptedRaidsAfter } from './raids';
import { famineDesertionPace, famineDesertionsOwedAt } from './morale';
import {
  addHero,
  caravanEscortScenario,
  masterOrder,
  mastersScenario,
  masterWaitingScenario,
  command,
  eventsOfType,
  famineSince,
  gameAt,
  HOUR,
  MINUTE,
  newGame,
  runWeekScenario,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { BuildingId, ExpeditionLessonKind, GameEvent, GameState } from './types';
import { REJECTION_CODES } from './types';
import { deriveViewState } from './view';

const DAY_REAL = 24 * HOUR;

/** Um estado gravado que o teste pode estragar à vontade. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Draft = Record<string, any>;

// O texto de cada retrato, lido pelo Vitest: cada teste interpreta a sua própria cópia.
const files = import.meta.glob<string>('./__fixtures__/state-v*.json', {
  query: '?raw',
  import: 'default',
  eager: true,
});

type Fixture = { name: string; version: number; timeScale: number; text: string };

const fixtures: Fixture[] = Object.entries(files)
  .map(([path, text]) => {
    const name = path.slice(path.lastIndexOf('/') + 1);
    const version = Number(/^state-v(\d+)-/.exec(name)?.[1]);
    // O ritmo da versão 1 não estava no estado: vinha da linha da partida, e o bot jogou no 3.
    // Da versão 2 em diante ele está gravado, e quem carrega informa o mesmo número.
    const stored = (JSON.parse(text) as { settings: { timeScale?: number } }).settings.timeScale;
    return { name, version, timeScale: stored ?? (name.includes('-3x') ? 3 : 1), text };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const read = (fixture: Fixture) => JSON.parse(fixture.text) as Record<string, unknown>;
const migrated = (fixture: Fixture) =>
  migrateState(read(fixture), { timeScale: fixture.timeScale });
const named = (name: string) => {
  const found = fixtures.find((fixture) => fixture.name === name);
  if (found === undefined) {
    throw new Error(`Falta o retrato ${name}.`);
  }
  return found;
};

/** Os campos que o passo 17 → 18 põe em cada registro do percurso de uma expedição. */
const LOG_FIELDS_V18 = [
  'xp',
  'harm',
  'leveled',
  'found',
  'revealed',
  'cleared',
  'rescued',
  'lootLost',
] as const;

/**
 * Tira de um estado, no lugar, o que o passo 22 → 23 acrescenta: os Mestres do feudo, os da
 * porta e o Mestre de cada registro do percurso.
 */
function stripMasters(copy: Draft): void {
  if (copy.settlement !== undefined) {
    delete copy.settlement.masters;
    delete copy.settlement.mastersWaiting;
  }
  for (const journey of [
    ...((copy.guild?.expeditions ?? []) as Draft[]),
    ...((copy.guild?.reports ?? []) as Draft[]),
  ]) {
    for (const entry of (journey.log ?? []) as Draft[]) {
      delete entry.master;
    }
  }
}

/** Um estado como a versão 22 o gravava, a partir de um da versão atual: sem os Mestres. */
function asVersion22(state: GameState): Draft {
  const old = JSON.parse(JSON.stringify(state)) as Draft;
  old.schemaVersion = 22;
  stripMasters(old);
  return old;
}

/**
 * Tira de um estado, no lugar, o que o passo 20 → 21 acrescenta: o Mercado, o edifício e o resto
 * (e, com ele, o do 22 → 23).
 */
function stripMarket(copy: Draft): void {
  stripMasters(copy);
  delete copy.market;
  if (copy.settlement?.buildings !== undefined) {
    delete copy.settlement.buildings.market;
  }
}

/** Um estado como a versão 20 o gravava, a partir de um da versão atual: sem o Mercado. */
function asVersion20(state: GameState): Draft {
  const old = JSON.parse(JSON.stringify(state)) as Draft;
  old.schemaVersion = 20;
  stripMarket(old);
  return old;
}

/** O que o passo 20 → 21 acrescenta a toda partida, tirado de um estado migrado. */
function withoutMarket<T extends Partial<GameState>>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as Draft;
  stripMarket(copy);
  return copy as T;
}

/**
 * Tira de um estado, no lugar, o que o passo 19 → 20 acrescenta: a volta do cativeiro de cada
 * herói (e, com ela, o do 20 → 21).
 */
function stripFreed(copy: Draft): void {
  stripMarket(copy);
  for (const hero of (copy.guild?.heroes ?? []) as Draft[]) {
    delete hero.freedAtMs;
  }
}

/** Um estado como a versão 19 o gravava, a partir de um da versão atual: os heróis sem a volta do cativeiro. */
function asVersion19(state: GameState): Draft {
  const old = JSON.parse(JSON.stringify(state)) as Draft;
  old.schemaVersion = 19;
  stripFreed(old);
  return old;
}

/** O que o passo 19 → 20 acrescenta a toda partida, tirado de um estado migrado. */
function withoutFreed<T extends Partial<GameState>>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as Draft;
  stripFreed(copy);
  return copy as T;
}

/**
 * Tira de um estado, no lugar, o que o passo 18 → 19 acrescenta: o destaque e a lição de cada
 * registro (e, com eles, o do 19 → 20).
 */
function stripReport(copy: Draft): void {
  stripFreed(copy);
  if (copy.guild === undefined) {
    return;
  }
  for (const journey of [
    ...((copy.guild.expeditions ?? []) as Draft[]),
    ...((copy.guild.reports ?? []) as Draft[]),
  ]) {
    for (const entry of journey.log as Draft[]) {
      delete entry.standout;
      delete entry.lesson;
    }
  }
}

/**
 * Um estado como a versão 18 o gravava, a partir de um da versão atual: sem quem se destacou e
 * sem a lição em cada registro do percurso.
 */
function asVersion18(state: GameState): Draft {
  const old = JSON.parse(JSON.stringify(state)) as Draft;
  old.schemaVersion = 18;
  stripReport(old);
  return old;
}

/** O que o passo 18 → 19 acrescenta a toda partida, tirado de um estado migrado. */
function withoutReport<T extends Partial<GameState>>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as Draft;
  stripReport(copy);
  return copy as T;
}

/** Tira de um estado, no lugar, o que o passo 17 → 18 acrescenta (e, com ele, o do 18 → 19). */
function stripOutcomes(copy: Draft): void {
  stripReport(copy);
  if (copy.map !== undefined) {
    delete copy.map.discovered;
  }
  if (copy.guild === undefined) {
    return;
  }
  delete copy.guild.inventory;
  for (const hero of (copy.guild.heroes ?? []) as Draft[]) {
    delete hero.injury;
    delete hero.captivity;
    delete hero.equipment;
  }
  const journeys = [...((copy.guild.expeditions ?? []) as Draft[])];
  for (const report of (copy.guild.reports ?? []) as Draft[]) {
    delete report.sold;
    delete report.lost;
    journeys.push(report);
  }
  for (const journey of journeys) {
    delete journey.loot.items;
    for (const entry of journey.log as Draft[]) {
      for (const field of LOG_FIELDS_V18) {
        delete entry[field];
      }
    }
  }
}

/**
 * Um estado como a versão 17 o gravava, a partir de um da versão atual: os heróis sem ferimento,
 * cativeiro nem equipamento, sem o arsenal, sem os destinos revelados e sem o que o percurso de
 * uma expedição passou a registrar.
 */
function asVersion17(state: GameState): Draft {
  const old = JSON.parse(JSON.stringify(state)) as Draft;
  old.schemaVersion = 17;
  stripOutcomes(old);
  return old;
}

/**
 * O que o passo 17 → 18 acrescenta a toda partida, tirado de um estado migrado: é o que deixa
 * os blocos dos passos anteriores compararem o resto, campo por campo, com o estado antigo. O
 * que o passo escreve é conferido no bloco dele.
 */
function withoutOutcomes<T extends Partial<GameState>>(state: T): T {
  const copy = JSON.parse(JSON.stringify(state)) as Draft;
  stripOutcomes(copy);
  return copy as T;
}

/**
 * Um estado como a versão 16 o gravava, a partir de um da versão atual: sem a Guilda dos
 * Aventureiros entre os edifícios e sem as expedições e os relatórios na guilda.
 */
function asVersion16(state: GameState): Draft {
  const old = asVersion17(state);
  old.schemaVersion = 16;
  delete old.settlement.buildings.guild;
  delete old.guild.expeditions;
  delete old.guild.reports;
  return old;
}

/**
 * O que o passo 16 → 17 acrescenta a toda partida, tirado de um estado migrado: é o que deixa
 * os blocos dos passos anteriores compararem o resto, campo por campo, com o estado antigo. O
 * que o passo escreve é conferido no bloco dele.
 */
function withoutGuildHall<T extends Partial<GameState>>(state: T): T {
  // E, com ela, o que o passo seguinte (17 → 18) acrescenta.
  const copy = withoutOutcomes(state) as Draft;
  delete copy.settlement.buildings.guild;
  if (copy.guild !== undefined) {
    delete copy.guild.expeditions;
    delete copy.guild.reports;
  }
  return copy as T;
}

/**
 * Um estado como a versão 15 o gravava, a partir de um da versão atual: sem a Taverna entre os
 * edifícios e sem os candidatos, a rotação e o festival na guilda.
 */
function asVersion15(state: GameState): Draft {
  const old = asVersion16(state);
  old.schemaVersion = 15;
  delete old.settlement.buildings.tavern;
  delete old.guild.tavernOffers;
  delete old.guild.tavern;
  return old;
}

/**
 * O que o passo 15 → 16 acrescenta a toda partida, tirado de um estado migrado: é o que deixa
 * os blocos dos passos anteriores compararem o resto, campo por campo, com o estado antigo. O
 * que o passo escreve é conferido no bloco dele.
 */
function withoutTavern<T extends Partial<GameState>>(state: T): T {
  // E, com ela, o que o passo seguinte (16 → 17) acrescenta.
  const copy = withoutGuildHall(state) as Draft;
  delete copy.settlement.buildings.tavern;
  if (copy.guild !== undefined) {
    delete copy.guild.tavernOffers;
    delete copy.guild.tavern;
  }
  return copy as T;
}

/**
 * Um estado como a versão 14 o gravava, a partir de um da versão atual: o herói sem a forma de
 * tratamento e a guilda sem a lista dos prometidos.
 */
function asVersion14(state: GameState): Draft {
  const old = asVersion15(state);
  old.schemaVersion = 14;
  delete old.guild.arriving;
  for (const hero of old.guild.heroes as Draft[]) {
    delete hero.gender;
  }
  return old;
}

/**
 * Um estado como a versão 13 o gravava, a partir de um da versão atual: sem a guilda. É o ponto
 * de partida de quem monta, à mão, um estado de uma versão anterior.
 */
function asVersion13(state: GameState): Draft {
  const old = asVersion15(state);
  old.schemaVersion = 13;
  delete old.guild;
  return old;
}

/** Um estado como a versão 12 o gravava: sem os contadores de identidade. */
function asVersion12(state: GameState): Draft {
  const old = asVersion13(state);
  old.schemaVersion = 12;
  delete old.ids;
  return old;
}

/**
 * Um estado como a versão 11 o gravava: a fome só com a data em que começou, e sem o registro
 * da última fome.
 */
function asVersion11(state: GameState): Draft {
  const old = asVersion12(state);
  old.schemaVersion = 11;
  if (old.settlement.famine !== null) {
    old.settlement.famine = { sinceMs: old.settlement.famine.sinceMs };
  }
  delete old.settlement.lastFamine;
  return old;
}

/**
 * Os eventos de uma fronteira, menos os objetivos concluídos. A lista de objetivos cresceu sem
 * mexer na forma do estado (V2E-T4): a partida que chega de uma versão antiga recebe os novos
 * na fronteira, e o que ela já fez (o Celeiro erguido, a Torre, a carta respondida) conta ali.
 * Isso não é obra do passo de migração que cada bloco confere.
 */
const withoutObjectives = (events: GameEvent[]) =>
  events.filter((event) => event.type !== 'objectiveCompleted');

/** FNV-1a de 32 bits do texto do arquivo: o bastante para notar um retrato antigo editado. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Retratos de versões anteriores, com a impressão digital do arquivo. Eles foram gravados pelo
 * motor da época e **nunca mais mudam**: se um destes testes falhar, o defeito está na migração,
 * não no retrato. Quando `schemaVersion` subir, acrescente aqui os retratos da versão que acabou
 * de ficar para trás (o teste abaixo diz quais faltam e qual é a impressão de cada um).
 */
const FROZEN: Record<string, string> = {
  'state-v1-construction.json': '78563339',
  'state-v1-famine.json': '564cd9b6',
  'state-v1-fresh.json': 'abde2cf3',
  'state-v1-objectives.json': 'f0ee3653',
  'state-v1-week-bot-3x.json': '03aad6d4',
  'state-v1-week-scripted.json': 'bd507c88',
  'state-v2-construction.json': 'a7e60886',
  'state-v2-famine.json': '580fb023',
  'state-v2-fresh.json': '635c91de',
  'state-v2-iron-king-half.json': '84be606d',
  'state-v2-migrated-3x.json': 'c9380b87',
  'state-v2-objectives.json': '9518b31a',
  'state-v2-peasant-3x.json': 'a50a387f',
  'state-v2-week-scripted.json': '213bb8f1',
  'state-v3-cold.json': 'c2397ba1',
  'state-v3-construction.json': '375a9be6',
  'state-v3-famine.json': '005f938d',
  'state-v3-fresh.json': '95f85d30',
  'state-v3-iron-king-half.json': '47fd3521',
  'state-v3-migrated-3x.json': 'c9b2677f',
  'state-v3-objectives.json': '74abbb8f',
  'state-v3-peasant-3x.json': '448f9116',
  'state-v3-week-scripted.json': 'd1b11263',
  'state-v4-cold.json': 'd2f0aeaa',
  'state-v4-construction.json': '30a24d04',
  'state-v4-famine.json': 'b5c4e8f5',
  'state-v4-fresh.json': '40ca4e90',
  'state-v4-iron-king-half.json': '89f84fdf',
  'state-v4-migrated-3x.json': '6b80c224',
  'state-v4-objectives.json': '35daec40',
  'state-v4-peasant-3x.json': 'a2f70389',
  'state-v4-storage.json': '797741c0',
  'state-v4-week-scripted.json': '7911107c',
  'state-v5-cold.json': 'f5bf0408',
  'state-v5-construction.json': '2fa2de12',
  'state-v5-famine.json': '61f37e61',
  'state-v5-fresh.json': '6c84d674',
  'state-v5-iron-king-half.json': 'd906632d',
  'state-v5-migrated-3x.json': '3948acce',
  'state-v5-objectives.json': 'e0a56ad8',
  'state-v5-peasant-3x.json': '35d952f7',
  'state-v5-queues.json': '3d4361bc',
  'state-v5-storage.json': '745791ce',
  'state-v5-week-scripted.json': '57b9a3e9',
  'state-v6-cold.json': '8e9a4432',
  'state-v6-construction.json': '0eec000d',
  'state-v6-crafts.json': 'd8a4f6e3',
  'state-v6-famine.json': '89581f3f',
  'state-v6-fresh.json': 'f0d72bce',
  'state-v6-iron-king-half.json': '9bc5fe78',
  'state-v6-migrated-3x.json': '0e9ac73c',
  'state-v6-objectives.json': '0f2384ec',
  'state-v6-peasant-3x.json': 'ea7f6e08',
  'state-v6-queues.json': '64954a3f',
  'state-v6-storage.json': '7bd72034',
  'state-v6-week-scripted.json': 'eae7e998',
  'state-v7-cold.json': 'efcc9093',
  'state-v7-construction.json': '48882d8b',
  'state-v7-crafts.json': '9af45677',
  'state-v7-famine.json': 'b012f471',
  'state-v7-fresh.json': 'aeaa9bee',
  'state-v7-iron-king-half.json': '5c6a7804',
  'state-v7-migrated-3x.json': 'a13b9048',
  'state-v7-morale.json': '1d89febd',
  'state-v7-objectives.json': 'ee0efd88',
  'state-v7-peasant-3x.json': 'e5b676c6',
  'state-v7-queues.json': '3ad142cf',
  'state-v7-storage.json': 'bc10045e',
  'state-v7-week-scripted.json': '677e26d8',
  'state-v8-cold.json': '82fc9306',
  'state-v8-construction.json': '99f12e83',
  'state-v8-council-hidden.json': '1a535819',
  'state-v8-council.json': '93a652f8',
  'state-v8-crafts.json': '9ae18ac2',
  'state-v8-famine.json': '233af930',
  'state-v8-fresh.json': '2f43314a',
  'state-v8-iron-king-half.json': 'a55298d0',
  'state-v8-migrated-3x.json': '979a0cb4',
  'state-v8-morale.json': 'ae198ba9',
  'state-v8-objectives.json': 'e8227458',
  'state-v8-peasant-3x.json': '07e4480d',
  'state-v8-queues.json': '4ed2538f',
  'state-v8-storage.json': 'b4be1be4',
  'state-v8-week-scripted.json': '94561e71',
  'state-v9-cold.json': '51c03693',
  'state-v9-construction.json': 'd693485f',
  'state-v9-council-hidden.json': '833321b6',
  'state-v9-council.json': '41c3639d',
  'state-v9-crafts.json': '4f9d8e88',
  'state-v9-famine.json': 'ff185005',
  'state-v9-fresh.json': '9e126a6e',
  'state-v9-iron-king-half.json': '9b34faf8',
  'state-v9-migrated-3x.json': 'e506f643',
  'state-v9-morale.json': 'd735f216',
  'state-v9-objectives.json': 'a2f765b8',
  'state-v9-peasant-3x.json': '46b43916',
  'state-v9-queues.json': '714eb453',
  'state-v9-storage.json': '3e9b31bb',
  'state-v9-threat.json': 'feb4b550',
  'state-v9-week-scripted.json': 'c957297f',
  'state-v10-cold.json': 'ccc9d2ae',
  'state-v10-construction.json': '7adda350',
  'state-v10-council-hidden.json': '4f36c939',
  'state-v10-council.json': '321471a8',
  'state-v10-crafts.json': '4c7b14bf',
  'state-v10-famine.json': '35753e48',
  'state-v10-fresh.json': 'a6240861',
  'state-v10-iron-king-half.json': 'b3b99675',
  'state-v10-migrated-3x.json': '7ef0fa1a',
  'state-v10-morale.json': 'ed3ecaa7',
  'state-v10-objectives.json': 'fecab483',
  'state-v10-palisade.json': '16a060e5',
  'state-v10-peasant-3x.json': '17dc9e0d',
  'state-v10-queues.json': '965b4086',
  'state-v10-storage.json': 'c839fb4a',
  'state-v10-threat.json': '89f4f1d5',
  'state-v10-week-scripted.json': '31dbc9ff',
  'state-v11-cold.json': '51c3ae5b',
  'state-v11-construction.json': 'a86f8ea7',
  'state-v11-council-hidden.json': '12c3d26e',
  'state-v11-council.json': '602be268',
  'state-v11-crafts.json': '3c40daa1',
  'state-v11-famine-3x.json': 'd482003a',
  'state-v11-famine-half.json': '6f84165e',
  'state-v11-famine.json': '99eac237',
  'state-v11-fresh.json': '193d77e2',
  'state-v11-iron-king-half.json': '3f9af7c2',
  'state-v11-migrated-3x.json': 'cb253082',
  'state-v11-morale.json': 'bb88e20d',
  'state-v11-objectives.json': '5828ca91',
  'state-v11-palisade.json': '6ed05c79',
  'state-v11-peasant-3x.json': '66f7e272',
  'state-v11-queues.json': '70a7aa15',
  'state-v11-raid-announced.json': 'daa6fd1e',
  'state-v11-raid.json': 'a8cefeaf',
  'state-v11-storage.json': '38ec7bfa',
  'state-v11-threat.json': '31a068fc',
  'state-v11-week-scripted.json': 'ea01677f',
  'state-v12-cold.json': 'db902d4f',
  'state-v12-construction.json': '3ac692c5',
  'state-v12-council-hidden.json': 'c71b448e',
  'state-v12-council.json': 'de94a45b',
  'state-v12-crafts.json': 'f7960a29',
  'state-v12-famine-3x.json': '06efb957',
  'state-v12-famine-ended.json': '2191b27f',
  'state-v12-famine-half.json': '736e2dba',
  'state-v12-famine-resumed.json': '415520d7',
  'state-v12-famine.json': 'c1c32f99',
  'state-v12-fresh.json': 'd4914a28',
  'state-v12-iron-king-half.json': 'aa999800',
  'state-v12-migrated-3x.json': '29861af0',
  'state-v12-migrated-iron-king-half.json': '4925dc2f',
  'state-v12-migrated-peasant-3x.json': '6e33bd0c',
  'state-v12-morale.json': '11983191',
  'state-v12-objectives.json': '322c5925',
  'state-v12-palisade.json': '5d9c23d3',
  'state-v12-peasant-3x.json': '4724c9e8',
  'state-v12-queues.json': '99ee3343',
  'state-v12-raid-announced.json': '5eb4fa0a',
  'state-v12-raid.json': '8a8c4c97',
  'state-v12-storage.json': 'b12227a9',
  'state-v12-threat.json': 'ddd4a1f6',
  'state-v12-week-scripted.json': '5d2450d1',
  'state-v13-cold.json': 'a4af57d6',
  'state-v13-construction.json': '7a109e98',
  'state-v13-council-hidden.json': 'a25d8fd5',
  'state-v13-council.json': 'd38a55bc',
  'state-v13-crafts.json': '53df4270',
  'state-v13-famine-3x.json': 'f5cbeeca',
  'state-v13-famine-ended.json': '1ee57e1e',
  'state-v13-famine-half.json': 'a39a80f9',
  'state-v13-famine-resumed.json': 'f6379ac2',
  'state-v13-famine.json': '18aa4a12',
  'state-v13-fresh.json': '5d6865d3',
  'state-v13-iron-king-half.json': '7f3f2bdd',
  'state-v13-migrated-3x.json': '255980e1',
  'state-v13-migrated-iron-king-half.json': 'b165e632',
  'state-v13-migrated-peasant-3x.json': '3e04f1f7',
  'state-v13-morale.json': '7638c6fa',
  'state-v13-objectives.json': '68748506',
  'state-v13-palisade.json': 'b1893a90',
  'state-v13-peasant-3x.json': '9a4917a3',
  'state-v13-queues.json': 'b38a0fe8',
  'state-v13-raid-announced.json': '790ce199',
  'state-v13-raid.json': 'c68877a2',
  'state-v13-storage.json': 'fa472732',
  'state-v13-threat.json': 'ddad56f3',
  'state-v13-week-scripted.json': 'fb868f04',
  'state-v14-cold.json': 'cd418414',
  'state-v14-construction.json': 'c1b5df70',
  'state-v14-council-hidden.json': '60de05bb',
  'state-v14-council.json': '2545abc2',
  'state-v14-crafts.json': 'd930da84',
  'state-v14-famine-3x.json': 'e589fb16',
  'state-v14-famine-ended.json': '2c40ba2a',
  'state-v14-famine-half.json': 'a6282ac3',
  'state-v14-famine-resumed.json': '667e63de',
  'state-v14-famine.json': '59f1a64a',
  'state-v14-fresh.json': '76912091',
  'state-v14-guild.json': '9d351ec3',
  'state-v14-iron-king-half.json': 'a5bcf17f',
  'state-v14-migrated-3x.json': '7e19dcfd',
  'state-v14-migrated-iron-king-half.json': 'd854f43c',
  'state-v14-migrated-peasant-3x.json': '8689eca1',
  'state-v14-morale.json': '273719a8',
  'state-v14-objectives.json': '96a2ddc6',
  'state-v14-palisade.json': '0a0c5a70',
  'state-v14-peasant-3x.json': '0fe165b9',
  'state-v14-queues.json': '9c88646c',
  'state-v14-raid-announced.json': '13cffd8d',
  'state-v14-raid.json': '82d3ebb8',
  'state-v14-storage.json': 'c7cf5342',
  'state-v14-threat.json': '0fac3cad',
  'state-v14-wage-arrears-ended.json': '6e825c16',
  'state-v14-wage-arrears-resumed.json': '332b3dfb',
  'state-v14-wage-arrears.json': '61daf755',
  'state-v14-week-scripted.json': '95987c26',
  'state-v15-cold.json': '6180ec82',
  'state-v15-construction.json': 'ad9face1',
  'state-v15-council-hidden.json': '3f30b688',
  'state-v15-council.json': 'f8ac5860',
  'state-v15-crafts.json': '13599c29',
  'state-v15-famine-3x.json': '934c0cab',
  'state-v15-famine-ended.json': 'bf3f22b3',
  'state-v15-famine-half.json': 'b2403b7c',
  'state-v15-famine-resumed.json': 'bd98b6b7',
  'state-v15-famine.json': '70f843b5',
  'state-v15-fresh.json': '0423481e',
  'state-v15-guild.json': '5100b83a',
  'state-v15-hero-promised.json': '0519cd01',
  'state-v15-iron-king-half.json': '901b8076',
  'state-v15-migrated-3x.json': '6daa08c3',
  'state-v15-migrated-iron-king-half.json': '88494819',
  'state-v15-migrated-peasant-3x.json': '21f205da',
  'state-v15-morale.json': '9f26686f',
  'state-v15-objectives.json': 'bc741e05',
  'state-v15-palisade.json': 'ab54e2ab',
  'state-v15-peasant-3x.json': 'b971148f',
  'state-v15-queues.json': 'acf43adf',
  'state-v15-raid-announced.json': 'b14e13fc',
  'state-v15-raid.json': '4362872d',
  'state-v15-storage.json': '86f9f93f',
  'state-v15-threat.json': 'ea00f5c0',
  'state-v15-wage-arrears-ended.json': 'db76a61c',
  'state-v15-wage-arrears-resumed.json': 'ccd0f7f3',
  'state-v15-wage-arrears.json': '13364041',
  'state-v15-week-scripted.json': '71a56805',
  'state-v16-cold.json': '0e039536',
  'state-v16-construction.json': '7e62d853',
  'state-v16-council-hidden.json': '52813bc4',
  'state-v16-council.json': '6f8ebc6c',
  'state-v16-crafts.json': '61fab3b3',
  'state-v16-famine-3x.json': '84667a25',
  'state-v16-famine-ended.json': 'c6c5ae49',
  'state-v16-famine-half.json': '7aed28f8',
  'state-v16-famine-resumed.json': 'a996eba1',
  'state-v16-famine.json': 'fd9aec6f',
  'state-v16-fresh.json': '0e9f449e',
  'state-v16-guild.json': 'bf5b9c56',
  'state-v16-hero-promised.json': '01a3c9cd',
  'state-v16-iron-king-half.json': '4f6521ae',
  'state-v16-migrated-3x.json': '05dfb1bf',
  'state-v16-migrated-iron-king-half.json': 'dceca9e9',
  'state-v16-migrated-peasant-3x.json': '9ded15e6',
  'state-v16-morale.json': '318d9543',
  'state-v16-objectives.json': '9ec839e3',
  'state-v16-palisade.json': 'cdd828fd',
  'state-v16-peasant-3x.json': 'a112e05d',
  'state-v16-queues.json': 'f0c5b68d',
  'state-v16-raid-announced.json': 'df8561d4',
  'state-v16-raid.json': '8e23e1ed',
  'state-v16-storage.json': '26a8695b',
  'state-v16-tavern-busy.json': '32b482d3',
  'state-v16-tavern.json': '0b496c98',
  'state-v16-threat.json': '439fe87c',
  'state-v16-wage-arrears-ended.json': '791a2fd2',
  'state-v16-wage-arrears-resumed.json': 'd3c8c13c',
  'state-v16-wage-arrears.json': '6ce2ffb1',
  'state-v16-week-scripted.json': '6e145557',
  'state-v17-cold.json': '3da6e029',
  'state-v17-construction.json': 'a907a5ba',
  'state-v17-council-hidden.json': '68834c95',
  'state-v17-council.json': '1717915b',
  'state-v17-crafts.json': '77e3bb70',
  'state-v17-expedition-crossroads.json': 'b9c93b7a',
  'state-v17-expedition-returning.json': '2e3077a8',
  'state-v17-expedition.json': '7175cda9',
  'state-v17-famine-3x.json': 'c7a6221e',
  'state-v17-famine-ended.json': '3e735268',
  'state-v17-famine-half.json': 'cb810c8b',
  'state-v17-famine-resumed.json': 'b96c1892',
  'state-v17-famine.json': '9d6d76b8',
  'state-v17-fresh.json': 'd87ccb87',
  'state-v17-guild.json': '6836e8d9',
  'state-v17-hero-promised.json': 'd50a2516',
  'state-v17-iron-king-half.json': '81b2dabb',
  'state-v17-migrated-3x.json': '8e750a9e',
  'state-v17-migrated-iron-king-half.json': 'd645e5f0',
  'state-v17-migrated-peasant-3x.json': 'ddcec6b7',
  'state-v17-morale.json': '1b184218',
  'state-v17-objectives.json': 'c9dd5af4',
  'state-v17-palisade.json': '6e32e662',
  'state-v17-peasant-3x.json': 'f13d1260',
  'state-v17-queues.json': 'b0b297e0',
  'state-v17-raid-announced.json': '5feebb49',
  'state-v17-raid.json': '8f082f60',
  'state-v17-storage.json': '75fe9872',
  'state-v17-tavern-busy.json': '920f9568',
  'state-v17-tavern.json': '1074cd39',
  'state-v17-threat.json': '7b67fe07',
  'state-v17-wage-arrears-ended.json': 'f5157ad9',
  'state-v17-wage-arrears-resumed.json': '8cb9d17d',
  'state-v17-wage-arrears.json': 'cc3b8d30',
  'state-v17-week-scripted.json': '36025a0e',
  'state-v18-cold.json': 'cfa20556',
  'state-v18-construction.json': '5e2bef3b',
  'state-v18-council-hidden.json': '66b61d1a',
  'state-v18-council.json': 'cc71b8f2',
  'state-v18-crafts.json': '8286854f',
  'state-v18-den-cleared.json': 'cb885c5c',
  'state-v18-expedition-crossroads.json': 'ff1684af',
  'state-v18-expedition-returning.json': '5d002fa6',
  'state-v18-expedition.json': '1a589ff6',
  'state-v18-famine-3x.json': '73b980d7',
  'state-v18-famine-ended.json': 'fbb8bb6d',
  'state-v18-famine-half.json': '0ce2d748',
  'state-v18-famine-resumed.json': 'd34c1c73',
  'state-v18-famine.json': '22a2b5d3',
  'state-v18-fresh.json': '582a6d22',
  'state-v18-guild.json': 'fc004220',
  'state-v18-hero-captured.json': '6313dfd7',
  'state-v18-hero-injured.json': '96668071',
  'state-v18-hero-promised.json': '140a86c3',
  'state-v18-iron-king-half.json': 'b57a32b0',
  'state-v18-migrated-3x.json': 'ac520711',
  'state-v18-migrated-iron-king-half.json': '149bc93b',
  'state-v18-migrated-peasant-3x.json': 'c91135f0',
  'state-v18-morale.json': 'd77fe827',
  'state-v18-objectives.json': '4d435947',
  'state-v18-palisade.json': '0cb75a8b',
  'state-v18-peasant-3x.json': 'ebe6f01b',
  'state-v18-queues.json': '5ac6e823',
  'state-v18-raid-announced.json': '2d1f5d66',
  'state-v18-raid.json': '180f1343',
  'state-v18-storage.json': '55bd699d',
  'state-v18-tavern-busy.json': 'fa6df009',
  'state-v18-tavern.json': 'b4391c8c',
  'state-v18-threat.json': 'c20fb376',
  'state-v18-wage-arrears-ended.json': '2b6d4bb4',
  'state-v18-wage-arrears-resumed.json': 'e6e339f4',
  'state-v18-wage-arrears.json': '7e149885',
  'state-v18-week-scripted.json': '6c05a807',
  'state-v19-cold.json': '1dfdc887',
  'state-v19-construction.json': '8deadfa4',
  'state-v19-council-hidden.json': 'ce84078b',
  'state-v19-council.json': '81c3e37f',
  'state-v19-crafts.json': 'e852e5ec',
  'state-v19-den-cleared.json': '91c99fae',
  'state-v19-expedition-crossroads.json': '5a082b2c',
  'state-v19-expedition-returning.json': 'f9818189',
  'state-v19-expedition.json': 'a4e40c07',
  'state-v19-famine-3x.json': '6322a898',
  'state-v19-famine-ended.json': '324d158e',
  'state-v19-famine-half.json': '8f6d794d',
  'state-v19-famine-resumed.json': '0595702c',
  'state-v19-famine.json': '3f30e66c',
  'state-v19-fresh.json': 'f1bb19e3',
  'state-v19-guild.json': '3a065c81',
  'state-v19-hero-captured.json': '5579ba85',
  'state-v19-hero-injured.json': '4561d173',
  'state-v19-hero-promised.json': '741560ac',
  'state-v19-iron-king-half.json': 'f1362ef3',
  'state-v19-migrated-3x.json': '81e9d6ca',
  'state-v19-migrated-iron-king-half.json': '5b5d6da4',
  'state-v19-migrated-peasant-3x.json': 'f02f4c45',
  'state-v19-morale.json': '1a367180',
  'state-v19-objectives.json': '0929144e',
  'state-v19-palisade.json': 'ca99018a',
  'state-v19-peasant-3x.json': '7d5430e8',
  'state-v19-queues.json': '2bcc52a6',
  'state-v19-raid-announced.json': '270f8bb3',
  'state-v19-raid.json': '00f3b784',
  'state-v19-storage.json': 'a8efe6ce',
  'state-v19-tavern-busy.json': '702db4b4',
  'state-v19-tavern.json': '69b91e03',
  'state-v19-threat.json': '2ab1c329',
  'state-v19-wage-arrears-ended.json': '74158009',
  'state-v19-wage-arrears-resumed.json': '65b5dcab',
  'state-v19-wage-arrears.json': 'fae2f7be',
  'state-v19-week-scripted.json': 'bb4cbfda',
  'state-v20-cold.json': '7d7c6e9f',
  'state-v20-construction.json': '65074d64',
  'state-v20-council-hidden.json': '2931024b',
  'state-v20-council.json': 'aea16b3f',
  'state-v20-crafts.json': '4340222c',
  'state-v20-den-cleared.json': '266d2d4e',
  'state-v20-expedition-crossroads.json': '5bc9435b',
  'state-v20-expedition-returning.json': '3a1c806f',
  'state-v20-expedition.json': 'e558c273',
  'state-v20-famine-3x.json': '84022958',
  'state-v20-famine-ended.json': '25e86a4e',
  'state-v20-famine-half.json': '45950d0d',
  'state-v20-famine-resumed.json': '399f0e6c',
  'state-v20-famine.json': '7a8f9bac',
  'state-v20-fresh.json': '2083dea3',
  'state-v20-guild.json': '123386a1',
  'state-v20-hero-captured.json': 'bf419583',
  'state-v20-hero-injured.json': 'feaa0e31',
  'state-v20-hero-promised.json': 'b968c86c',
  'state-v20-iron-king-half.json': '9e595533',
  'state-v20-migrated-3x.json': '2dccad0a',
  'state-v20-migrated-iron-king-half.json': '10a73464',
  'state-v20-migrated-peasant-3x.json': 'aff0e585',
  'state-v20-morale.json': '438db640',
  'state-v20-objectives.json': '2e073a0e',
  'state-v20-palisade.json': '845421ca',
  'state-v20-peasant-3x.json': '8d8eaf80',
  'state-v20-queues.json': '887f5b66',
  'state-v20-raid-announced.json': 'a2a8dd95',
  'state-v20-raid.json': 'a8533ac4',
  'state-v20-storage.json': '96302174',
  'state-v20-tavern-busy.json': '6d2e2fe4',
  'state-v20-tavern.json': 'd6226727',
  'state-v20-threat.json': '9a474769',
  'state-v20-wage-arrears-ended.json': 'a03cb145',
  'state-v20-wage-arrears-resumed.json': 'bab1e9a7',
  'state-v20-wage-arrears.json': '7e223b12',
  'state-v20-week-scripted.json': 'bdf68300',
  'state-v21-cold.json': '082346e4',
  'state-v21-construction.json': '355c4205',
  'state-v21-council-hidden.json': '265c53e0',
  'state-v21-council.json': 'b3517d2e',
  'state-v21-crafts.json': 'c13b0b3b',
  'state-v21-den-cleared.json': '62c2113f',
  'state-v21-expedition-crossroads.json': '816bf1f8',
  'state-v21-expedition-returning.json': 'e54bec4a',
  'state-v21-expedition.json': '63cdbae2',
  'state-v21-famine-3x.json': '8258d84d',
  'state-v21-famine-ended.json': '87146113',
  'state-v21-famine-half.json': '1f99fca6',
  'state-v21-famine-resumed.json': '191e2795',
  'state-v21-famine.json': 'c6a39e47',
  'state-v21-fresh.json': 'c9209736',
  'state-v21-guild.json': '605b3436',
  'state-v21-hero-captured.json': '6227a4e6',
  'state-v21-hero-injured.json': '5f4a8f54',
  'state-v21-hero-promised.json': 'f10e9abd',
  'state-v21-iron-king-half.json': 'eed8f754',
  'state-v21-market-opening.json': '9c0c8367',
  'state-v21-market.json': 'ad4c304b',
  'state-v21-migrated-3x.json': 'baacfc11',
  'state-v21-migrated-iron-king-half.json': 'a294819f',
  'state-v21-migrated-peasant-3x.json': 'f7653776',
  'state-v21-morale.json': '8b1b6467',
  'state-v21-objectives.json': '6a3b7d89',
  'state-v21-palisade.json': 'dc977a67',
  'state-v21-peasant-3x.json': 'd2fc4a83',
  'state-v21-queues.json': '22bcff0d',
  'state-v21-raid-announced.json': '362c62b8',
  'state-v21-raid.json': '27417f67',
  'state-v21-storage.json': '94a106b7',
  'state-v21-tavern-busy.json': '0c078f5d',
  'state-v21-tavern.json': 'db1c10c8',
  'state-v21-threat.json': '851609d0',
  'state-v21-wage-arrears-ended.json': 'd365d1cc',
  'state-v21-wage-arrears-resumed.json': 'c4b11c60',
  'state-v21-wage-arrears.json': '9b237011',
  'state-v21-week-scripted.json': '91e53259',
  'state-v22-caravan-escort.json': '3755d0a6',
  'state-v22-caravan.json': '80c334bb',
  'state-v22-cold.json': '91be95ee',
  'state-v22-construction.json': '56035433',
  'state-v22-council-hidden.json': '7a06bd7c',
  'state-v22-council.json': 'f36b4d78',
  'state-v22-crafts.json': 'fbaec917',
  'state-v22-den-cleared.json': '3e478d37',
  'state-v22-expedition-crossroads.json': '7a9a9240',
  'state-v22-expedition-returning.json': 'fe9591f6',
  'state-v22-expedition.json': 'c045df5a',
  'state-v22-famine-3x.json': 'f3cda747',
  'state-v22-famine-ended.json': 'b3004c11',
  'state-v22-famine-half.json': 'd1d97e22',
  'state-v22-famine-resumed.json': '175a396b',
  'state-v22-famine.json': '9fb5786f',
  'state-v22-fresh.json': 'be2dc7b4',
  'state-v22-guild.json': 'b50669d8',
  'state-v22-hero-captured.json': 'abd9a222',
  'state-v22-hero-injured.json': '43058494',
  'state-v22-hero-promised.json': '481336bd',
  'state-v22-iron-king-half.json': 'ff0652fe',
  'state-v22-market-opening.json': '73adf5c9',
  'state-v22-market.json': '4a308a8b',
  'state-v22-migrated-3x.json': '32fb3577',
  'state-v22-migrated-iron-king-half.json': '25fee1f1',
  'state-v22-migrated-peasant-3x.json': '4464d60e',
  'state-v22-morale.json': 'ad41dcb1',
  'state-v22-objectives.json': '5f726d63',
  'state-v22-palisade.json': '1a3cec7b',
  'state-v22-peasant-3x.json': 'b8610929',
  'state-v22-queues.json': '4a3141f7',
  'state-v22-raid-announced.json': '3849b448',
  'state-v22-raid.json': '4d0dcc21',
  'state-v22-storage.json': 'a17d46a7',
  'state-v22-tavern-busy.json': '91f605b5',
  'state-v22-tavern.json': 'e47ec7a4',
  'state-v22-threat.json': 'b701e17c',
  'state-v22-wage-arrears-ended.json': '8de74ca0',
  'state-v22-wage-arrears-resumed.json': '8ad7d422',
  'state-v22-wage-arrears.json': 'd743fe6f',
  'state-v22-week-scripted.json': '676704a3',
};

/** Um herói como o motor o grava: o ponto de partida dos estados estragados de propósito. */
const HERO = {
  id: 'hero-1',
  name: 'Edda',
  gender: 'f',
  classId: 'warrior',
  level: 1,
  xp: 0,
  traits: ['loyal'],
  status: 'idle',
  injury: null,
  captivity: null,
  equipment: { weapon: null, armor: null, accessory: null },
  joinedAtMs: 0,
  freedAtMs: null,
  discontent: false,
} as const;

/** Um candidato da Taverna como o motor o grava. */
const OFFER = {
  offerId: 'offer-1',
  templateId: 'braveWarrior',
  name: 'Aldara',
  gender: 'f',
  price: 110,
} as const;

/** Põe a Taverna com um candidato bom no estado e deixa o teste estragá-lo. */
function withOffer(state: Draft, damage: (offer: Draft) => unknown): void {
  const offer: Draft = { ...OFFER };
  state.settlement.buildings.tavern = 1;
  state.ids = { ...state.ids, offer: 1 };
  state.guild.tavernOffers = [offer];
  state.guild.tavern = {
    nextRotationAtMs: state.lastProcessedAt + 86_400_000,
    festival: null,
    lastFestivalAtMs: null,
  };
  damage(offer);
}

/** Põe um herói bom no estado e deixa o teste estragá-lo. */
function withHero(state: Draft, damage: (hero: Draft) => unknown): void {
  const hero: Draft = { ...HERO, traits: [...HERO.traits] };
  damage(hero);
  state.ids = { hero: 1 };
  state.guild.heroes = [hero];
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Caminhos das chaves de estrutura fixa de um estado, tendo uma partida nova como referência:
 * só desce onde a partida nova também tem um objeto. Listas, campos que nascem `null` e os
 * objetos de chaves livres (`rng`, `ids`, `stats`, `council.flags`, `map.tiles`) contam como um
 * campo só.
 */
function fixedKeys(value: unknown, reference: unknown = value, path = ''): string[] {
  const freeKeys =
    path === 'rng' ||
    path === 'ids' ||
    path === 'stats' ||
    path === 'council.flags' ||
    path === 'map.tiles';
  if (!isObject(value) || !isObject(reference) || freeKeys) {
    return [];
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const here = path === '' ? key : `${path}.${key}`;
    return [here, ...fixedKeys(child, reference[key], here)];
  });
}

const buildingIds: BuildingId[] = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
  'tavern',
  'guild',
];

describe('a lista de passos', () => {
  it('tem um passo por versão, em ordem, até a versão atual', () => {
    expect(migrationSteps.map((step) => step.from)).toEqual(
      Array.from({ length: CURRENT_SCHEMA_VERSION - 1 }, (_, index) => index + 1),
    );
    for (const step of migrationSteps) {
      expect(step.summary.trim()).not.toBe('');
    }
  });

  it('uma partida nova nasce na versão atual e sem fronteira de atualização', () => {
    const state = newGame();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(state.migratedAtMs).toBeNull();
    expect(migrateState(state, { timeScale: 1 })).toBe(state);
  });

  it('há retratos de todas as versões que já existiram', () => {
    const versions = new Set(fixtures.map((fixture) => fixture.version));
    for (let version = 1; version <= CURRENT_SCHEMA_VERSION; version += 1) {
      expect(versions, `retratos da versão ${version}`).toContain(version);
    }
  });

  it('os retratos de versões anteriores estão congelados', () => {
    const old = Object.fromEntries(
      fixtures
        .filter((fixture) => fixture.version < CURRENT_SCHEMA_VERSION)
        .map((fixture) => [fixture.name, fingerprint(fixture.text)]),
    );
    expect(old).toEqual(FROZEN);
  });
});

describe('a forma da versão atual', () => {
  it('aceita uma partida nova, em qualquer ritmo e dificuldade', () => {
    expect(currentShape(newGame(), '')).toBeNull();
    const other = { ...newGame(), settings: { ...newGame().settings, timeScale: 0.5 } };
    expect(
      currentShape({ ...other, settings: { ...other.settings, difficulty: 'ironKing' } }, ''),
    ).toBeNull();
  });

  it('aceita todos os estados do cenário de 7 dias, depois de passarem pelo banco', () => {
    const { days } = runWeekScenario();
    expect(days.length).toBe(7);
    for (const { state } of days) {
      expect(currentShape(JSON.parse(JSON.stringify(state)), '')).toBeNull();
    }
  });

  const damages: Array<[string, (state: Draft) => unknown]> = [
    ['um campo que o motor não escreve', (state) => (state.settlement.mood = 50)],
    ['a moral ausente', (state) => delete state.settlement.morale],
    ['uma moral negativa', (state) => (state.settlement.morale = -1)],
    ['uma moral quebrada', (state) => (state.settlement.morale = 49.5)],
    ['os efeitos de moral ausentes', (state) => delete state.settlement.moraleEffects],
    [
      'um efeito de moral sem prazo',
      (state) => (state.settlement.moraleEffects = [{ id: 'a', label: 'b', amount: 5 }]),
    ],
    [
      'um efeito de moral com um campo a mais',
      (state) =>
        (state.settlement.moraleEffects = [
          { id: 'a', label: 'b', amount: 5, untilMs: 7_200_000, kind: 'morale' },
        ]),
    ],
    ['o Conselho ausente', (state) => delete state.council],
    ['o Conselho sem a próxima audiência', (state) => delete state.council.nextDrawAtMs],
    ['o Conselho com um campo a mais', (state) => (state.council.effects = [])],
    ['uma flag que não vale `true`', (state) => (state.council.flags = { 'toll.paid': 1 })],
    [
      'uma carta na mesa sem prazo',
      (state) => (state.council.pending = [{ instanceId: 'alms-1', cardId: 'alms', drawnAtMs: 0 }]),
    ],
    [
      'uma continuação sem a escolha que a agendou',
      (state) => (state.council.scheduled = [{ cardId: 'alms', atMs: 7_200_000 }]),
    ],
    [
      'um efeito escondido sem instante',
      (state) =>
        (state.council.delayed = [{ instanceId: 'alms-1', cardId: 'alms', optionId: 'bless' }]),
    ],
    ['uma carta expirada que não é texto', (state) => (state.council.expired = [7])],
    ['a Torre de Vigia ausente', (state) => delete state.settlement.buildings.watchtower],
    ['a Paliçada ausente', (state) => delete state.settlement.buildings.palisade],
    ['a Paliçada com nível quebrado', (state) => (state.settlement.buildings.palisade = 1.5)],
    [
      'uma obra de um edifício que o motor não conhece',
      (state) =>
        (state.settlement.constructionQueues[0] = {
          building: 'stoneWall',
          targetLevel: 3,
          startedAtMs: 0,
          finishesAtMs: 3_600_000,
        }),
    ],
    ['o mapa ausente', (state) => delete state.map],
    ['o mapa sem a Ameaça', (state) => delete state.map.threat],
    ['uma Ameaça negativa', (state) => (state.map.threat = -5)],
    ['uma Ameaça quebrada', (state) => (state.map.threat = 12.5)],
    ['o mapa com um campo a mais', (state) => (state.map.radius = 3)],
    [
      'um tile de um tipo que o motor não conhece',
      (state) => (state.map.tiles.camp = { type: 'raiderCamp', threatActive: true }),
    ],
    [
      'um tile sem dizer se a ameaça está ativa',
      (state) => (state.map.tiles.wolfDen = { type: 'wolfDen' }),
    ],
    ['as incursões ausentes', (state) => delete state.horde],
    ['a Horda com um campo a mais', (state) => (state.horde.memory = [])],
    [
      'uma incursão sem tamanho',
      (state) =>
        (state.horde.scheduledRaids = [
          { id: 'threat-1', atMs: 7_200_000, kind: 'threat', enemy: 'wolves', announcedAtMs: null },
        ]),
    ],
    [
      'uma incursão de um inimigo que o motor não conhece',
      (state) =>
        (state.horde.scheduledRaids = [
          {
            id: 'threat-1',
            atMs: 7_200_000,
            kind: 'threat',
            enemy: 'raiders',
            size: 'light',
            announcedAtMs: null,
          },
        ]),
    ],
    ['os feridos ausentes', (state) => delete state.settlement.injured],
    ['um ferido sem prazo', (state) => (state.settlement.injured = [{ building: 'farm' }])],
    [
      'um ferido sem dizer de onde saiu',
      (state) => (state.settlement.injured = [{ untilMs: 7_200_000 }]),
    ],
    [
      'um ferido de um edifício que não tem ofício',
      (state) => (state.settlement.injured = [{ untilMs: 7_200_000, building: 'housing' }]),
    ],
    [
      'um ferido com um campo a mais',
      (state) =>
        (state.settlement.injured = [{ untilMs: 7_200_000, building: null, raidId: 'threat-1' }]),
    ],
    ['os contadores de identidade ausentes', (state) => delete state.ids],
    ['os contadores de identidade nulos', (state) => (state.ids = null)],
    ['um contador de identidade negativo', (state) => (state.ids = { hero: -1 })],
    ['um contador de identidade quebrado', (state) => (state.ids = { hero: 1.5 })],
    ['um contador de identidade em texto', (state) => (state.ids = { hero: '3' })],
    ['um contador de identidade sem tipo', (state) => (state.ids = { '': 3 })],
    ['um contador de um tipo fora da forma', (state) => (state.ids = { 'hero-1': 3 })],
    ['um fluxo de sorteio de nome desconhecido', (state) => (state.rng = { market: [1, 2, 3, 4] })],
    [
      'um fluxo de uma família desconhecida',
      (state) => (state.rng = { 'hero:hero-1': [1, 2, 3, 4] }),
    ],
    [
      'um fluxo de família sem identificador',
      (state) => (state.rng = { 'expedition:': [1, 2, 3, 4] }),
    ],
    [
      'um fluxo de família com identificador sem número',
      (state) => (state.rng = { 'expedition:expedition': [1, 2, 3, 4] }),
    ],
    [
      'um fluxo de família com o número zero',
      (state) => (state.rng = { 'caravan:caravan-0': [1, 2, 3, 4] }),
    ],
    [
      'um fluxo de uma família com o identificador de outro tipo',
      (state) => {
        state.ids = { hero: 1, expedition: 1 };
        state.rng = { 'expedition:hero-1': [1, 2, 3, 4] };
      },
    ],
    [
      'um fluxo de uma família com o identificador de outra família',
      (state) => {
        state.ids = { expedition: 1, caravan: 1 };
        state.rng = { 'caravan:expedition-1': [1, 2, 3, 4] };
      },
    ],
    [
      'um fluxo de entidade com um número que não é inteiro seguro',
      (state) => {
        state.ids = { expedition: Number.MAX_SAFE_INTEGER };
        state.rng = { 'expedition:expedition-99999999999999999999999': [1, 2, 3, 4] };
      },
    ],
    [
      'um fluxo de entidade sem contador nenhum',
      (state) => (state.rng = { 'expedition:expedition-5': [1, 2, 3, 4] }),
    ],
    [
      'um fluxo de entidade além do contador da família',
      (state) => {
        state.ids = { expedition: 4, caravan: 9 };
        state.rng = { 'expedition:expedition-5': [1, 2, 3, 4] };
      },
    ],
    [
      'um fluxo de entidade com o contador só de outro tipo',
      (state) => {
        state.ids = { hero: 9 };
        state.rng = { 'caravan:caravan-1': [1, 2, 3, 4] };
      },
    ],
    [
      'um fluxo fixo com sufixo de entidade',
      (state) => (state.rng = { 'council:council-1': [1, 2, 3, 4] }),
    ],
    ['um fluxo com três palavras', (state) => (state.rng = { council: [1, 2, 3] })],
    ['um fluxo com cinco palavras', (state) => (state.rng = { council: [1, 2, 3, 4, 5] })],
    ['um fluxo com uma palavra negativa', (state) => (state.rng = { morale: [1, -2, 3, 4] })],
    ['um fluxo com uma palavra quebrada', (state) => (state.rng = { morale: [1, 2.5, 3, 4] })],
    [
      'um fluxo com uma palavra acima de 32 bits',
      (state) => (state.rng = { horde: [1, 2, 3, 0x1_0000_0000] }),
    ],
    ['um fluxo todo zero', (state) => (state.rng = { horde: [0, 0, 0, 0] })],
    ['um fluxo que não é lista', (state) => (state.rng = { horde: { 0: 1 } })],
    ['a chave de limite da versão 1', (state) => (state.settings.capsEnabled = false)],
    ['uma dificuldade desconhecida', (state) => (state.settings.difficulty = 'normal')],
    ['um ritmo zero', (state) => (state.settings.timeScale = 0)],
    ['o ritmo ausente', (state) => delete state.settings.timeScale],
    ['a fronteira ausente', (state) => delete state.migratedAtMs],
    ['o frio ausente', (state) => delete state.settlement.cold],
    ['um frio sem data', (state) => (state.settlement.cold = {})],
    ['o Celeiro ausente', (state) => delete state.settlement.buildings.granary],
    ['um edifício que o motor não conhece', (state) => (state.settlement.buildings.tower = 1)],
    ['o desperdício ausente', (state) => delete state.settlement.wasted],
    ['um desperdício negativo', (state) => (state.settlement.wasted.food = -1)],
    ['o desperdício de um recurso a menos', (state) => delete state.settlement.wasted.gold],
    ['uma fila de obras só', (state) => state.settlement.constructionQueues.pop()],
    ['uma fila de obras a mais', (state) => state.settlement.constructionQueues.push(null)],
    [
      'uma planejada sem dizer se é automática',
      (state) => (state.settlement.planned = [{ building: 'farm', targetLevel: 2 }]),
    ],
    [
      'uma planejada com a marca que não é sim nem não',
      (state) => (state.settlement.planned = [{ building: 'farm', targetLevel: 2, autoStart: 1 }]),
    ],
    ['a guilda ausente', (state) => delete state.guild],
    ['a guilda nula', (state) => (state.guild = null)],
    ['a guilda sem a lista de heróis', (state) => delete state.guild.heroes],
    ['a guilda sem o atraso', (state) => delete state.guild.wageArrears],
    ['a guilda sem o registro do último atraso', (state) => delete state.guild.lastWageArrears],
    // Nada da Fase D antes da Fase D (regra 6 do CLAUDE.md).
    // As expedições (versão 17). O que só se vê olhando dois campos (a equipe, os prazos, o
    // fluxo de sorteio de quem já voltou) está em `expeditions.test.ts`.
    ['a guilda sem as expedições', (state) => delete state.guild.expeditions],
    ['a guilda sem os relatórios de expedição', (state) => delete state.guild.reports],
    ['a Guilda ausente dos edifícios', (state) => delete state.settlement.buildings.guild],
    ['a Guilda com nível quebrado', (state) => (state.settlement.buildings.guild = 1.5)],
    ['as expedições que não são lista', (state) => (state.guild.expeditions = {})],
    ['uma expedição que não é objeto', (state) => (state.guild.expeditions = ['expedition-1'])],
    ['um relatório que não é objeto', (state) => (state.guild.reports = [null])],
    // Os desfechos (versão 18).
    ['a guilda sem o arsenal', (state) => delete state.guild.inventory],
    ['o arsenal que não é lista', (state) => (state.guild.inventory = {})],
    ['um item sem o identificador', (state) => (state.guild.inventory = [{ defId: 'ashBow' }])],
    [
      'um item com desgaste',
      (state) => {
        state.ids = { item: 1 };
        state.guild.inventory = [{ id: 'item-1', defId: 'ashBow', durability: 10 }];
      },
    ],
    [
      'um item além do contador',
      (state) => (state.guild.inventory = [{ id: 'item-1', defId: 'ashBow' }]),
    ],
    ['o mapa sem os destinos revelados', (state) => delete state.map.discovered],
    ['um destino revelado que não é chave', (state) => (state.map.discovered = ['Ruínas!'])],
    // O Mercado (versão 21) e os Mestres (versão 23).
    ['o estado com o Mercado', (state) => (state.market = { prices: {} })],
    ['o feudo sem a lista dos Mestres', (state) => delete state.settlement.masters],
    ['o feudo sem a porta dos Mestres', (state) => delete state.settlement.mastersWaiting],
    ['um Mestre com posto', (state) => (state.settlement.masters = [{ post: 'quarry' }])],
    // A Taverna (versão 16).
    ['a Taverna ausente dos edifícios', (state) => delete state.settlement.buildings.tavern],
    ['a Taverna com nível quebrado', (state) => (state.settlement.buildings.tavern = 0.5)],
    ['a guilda sem as ofertas da Taverna', (state) => delete state.guild.tavernOffers],
    ['a guilda sem a Taverna', (state) => delete state.guild.tavern],
    ['a Taverna sem a próxima rotação', (state) => delete state.guild.tavern.nextRotationAtMs],
    ['a Taverna com um campo a mais', (state) => (state.guild.tavern.festivalSeason = 'spring')],
    [
      'um festival em curso sem prazo',
      (state) => {
        state.settlement.buildings.tavern = 1;
        state.guild.tavern = { nextRotationAtMs: 7_200_000, festival: {}, lastFestivalAtMs: 0 };
      },
    ],
    [
      'um candidato sem Taverna',
      (state) => withOffer(state, () => (state.settlement.buildings.tavern = 0)),
    ],
    [
      'uma rotação marcada sem Taverna',
      (state) => (state.guild.tavern.nextRotationAtMs = 7_200_000),
    ],
    ['um festival dado sem Taverna', (state) => (state.guild.tavern.lastFestivalAtMs = 0)],
    [
      'uma rotação vencida e não processada',
      (state) => {
        state.settlement.buildings.tavern = 1;
        state.guild.tavern.nextRotationAtMs = state.lastProcessedAt;
      },
    ],
    [
      'um festival em curso sem festival dado',
      (state) => {
        state.settlement.buildings.tavern = 1;
        state.guild.tavern.festival = { untilMs: 7_200_000 };
      },
    ],
    [
      'um festival dado depois de agora',
      (state) => {
        state.settlement.buildings.tavern = 1;
        state.guild.tavern.lastFestivalAtMs = state.lastProcessedAt + 1;
      },
    ],
    ['um candidato sem nome', (state) => withOffer(state, (offer) => delete offer.name)],
    ['um candidato de nome vazio', (state) => withOffer(state, (offer) => (offer.name = ' '))],
    ['um candidato sem modelo', (state) => withOffer(state, (offer) => delete offer.templateId)],
    [
      'um candidato de modelo fora da forma',
      (state) => withOffer(state, (offer) => (offer.templateId = 'Brave Warrior')),
    ],
    [
      'um candidato sem forma de tratamento',
      (state) => withOffer(state, (offer) => delete offer.gender),
    ],
    ['um candidato de preço zero', (state) => withOffer(state, (offer) => (offer.price = 0))],
    [
      'um candidato de preço quebrado',
      (state) => withOffer(state, (offer) => (offer.price = 87.5)),
    ],
    [
      'um candidato com um campo a mais',
      (state) => withOffer(state, (offer) => (offer.classId = 'mage')),
    ],
    [
      'um candidato com identificador fora da forma',
      (state) => withOffer(state, (offer) => (offer.offerId = 'offer-01')),
    ],
    [
      'um candidato além do contador de identidades',
      (state) => withOffer(state, (offer) => (offer.offerId = 'offer-2')),
    ],
    [
      'dois candidatos com o mesmo identificador',
      (state) =>
        withOffer(state, () => state.guild.tavernOffers.push({ ...state.guild.tavernOffers[0] })),
    ],
    [
      'mais candidatos do que a maior lista da Taverna',
      (state) =>
        withOffer(state, () => {
          state.ids.offer = 4;
          state.guild.tavernOffers = [1, 2, 3, 4].map((n) => ({ ...OFFER, offerId: `offer-${n}` }));
        }),
    ],
    ['a lista de heróis que não é lista', (state) => (state.guild.heroes = {})],
    [
      'um herói que não é objeto',
      (state) => {
        state.ids = { hero: 1 };
        state.guild.heroes = ['hero-1'];
      },
    ],
    ['um herói sem nome', (state) => withHero(state, (hero) => delete hero.name)],
    ['um herói de nome vazio', (state) => withHero(state, (hero) => (hero.name = '  '))],
    ['um herói sem identificador', (state) => withHero(state, (hero) => delete hero.id)],
    [
      'um herói com identificador de outro tipo',
      (state) => withHero(state, (hero) => (hero.id = 'caravan-1')),
    ],
    [
      'um herói com o identificador zero',
      (state) => withHero(state, (hero) => (hero.id = 'hero-0')),
    ],
    ['um herói com zeros à esquerda', (state) => withHero(state, (hero) => (hero.id = 'hero-01'))],
    ['um herói além do contador', (state) => withHero(state, (hero) => (hero.id = 'hero-2'))],
    [
      'um herói sem contador nenhum',
      (state) => {
        withHero(state, () => undefined);
        state.ids = {};
      },
    ],
    [
      'um herói de uma classe desconhecida',
      (state) => withHero(state, (hero) => (hero.classId = 'paladin')),
    ],
    ['um herói no nível zero', (state) => withHero(state, (hero) => (hero.level = 0))],
    ['um herói acima do nível máximo', (state) => withHero(state, (hero) => (hero.level = 11))],
    ['um herói de nível quebrado', (state) => withHero(state, (hero) => (hero.level = 1.5))],
    ['um herói de experiência negativa', (state) => withHero(state, (hero) => (hero.xp = -1))],
    [
      'um herói com um traço desconhecido',
      (state) => withHero(state, (hero) => (hero.traits = ['cursed'])),
    ],
    [
      'um herói com um traço repetido',
      (state) => withHero(state, (hero) => (hero.traits = ['loyal', 'loyal'])),
    ],
    [
      'um herói com os traços em texto',
      (state) => withHero(state, (hero) => (hero.traits = 'loyal')),
    ],
    // Os estados de quem está fora entram com as tarefas deles.
    ['um herói em expedição', (state) => withHero(state, (hero) => (hero.status = 'expedition'))],
    [
      'um herói em escolta sem caravana',
      (state) => withHero(state, (hero) => (hero.status = 'escort')),
    ],
    [
      'um herói em um estado que não existe',
      (state) => withHero(state, (hero) => (hero.status = 'siege')),
    ],
    [
      'um herói em recuperação sem ferimento',
      (state) => withHero(state, (hero) => (hero.status = 'injured')),
    ],
    ['um herói sem o ferimento', (state) => withHero(state, (hero) => delete hero.injury)],
    ['um herói sem o cativeiro', (state) => withHero(state, (hero) => delete hero.captivity)],
    ['um herói sem os espaços', (state) => withHero(state, (hero) => (hero.equipment = {}))],
    [
      'um herói com um quarto espaço',
      (state) => withHero(state, (hero) => (hero.equipment = { ...hero.equipment, ring: null })),
    ],
    [
      'um herói pronto com ferimento',
      (state) =>
        withHero(state, (hero) => (hero.injury = { severity: 'light', untilMs: 9_999_999 })),
    ],
    [
      'um herói com ferimento de gravidade desconhecida',
      (state) =>
        withHero(state, (hero) =>
          Object.assign(hero, {
            status: 'injured',
            injury: { severity: 'mortal', untilMs: 9_999_999 },
          }),
        ),
    ],
    ['um herói morto na lista', (state) => withHero(state, (hero) => (hero.status = 'dead'))],
    ['um herói com atributos gravados', (state) => withHero(state, (hero) => (hero.power = 42))],
    [
      'um herói sem a data de chegada',
      (state) => withHero(state, (hero) => delete hero.joinedAtMs),
    ],
    [
      'um herói que chegou depois de agora',
      (state) => withHero(state, (hero) => (hero.joinedAtMs = 1)),
    ],
    [
      'um herói sem dizer se está Descontente',
      (state) => withHero(state, (hero) => delete hero.discontent),
    ],
    ['um herói Descontente em número', (state) => withHero(state, (hero) => (hero.discontent = 1))],
    [
      'um herói Descontente sem soldo em atraso',
      (state) => withHero(state, (hero) => (hero.discontent = true)),
    ],
    [
      'dois heróis com o mesmo identificador',
      (state) => {
        withHero(state, () => undefined);
        state.guild.heroes.push({ ...state.guild.heroes[0] });
      },
    ],
    [
      'mais heróis do que o teto da lista',
      (state) => {
        state.ids = { hero: HERO_ROSTER_CAP_V14 + 1 };
        state.guild.heroes = Array.from({ length: HERO_ROSTER_CAP_V14 + 1 }, (_, index) => ({
          ...HERO,
          id: `hero-${index + 1}`,
        }));
      },
    ],
    [
      'um atraso sem o que já durou',
      (state) => (state.guild.wageArrears = { sinceMs: 0, departed: 0 }),
    ],
    [
      'um atraso com um campo a mais',
      (state) => (state.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0, debt: 5 }),
    ],
    [
      'um atraso de duração quebrada',
      (state) => (state.guild.wageArrears = { sinceMs: 0, carriedMs: 0.5, departed: 0 }),
    ],
    [
      'um atraso que abriu depois de agora',
      (state) => (state.guild.wageArrears = { sinceMs: 1, carriedMs: 0, departed: 0 }),
    ],
    [
      'um registro de atraso sem os heróis cobrados',
      (state) => (state.guild.lastWageArrears = { endedAtMs: 0, lastedMs: 5 }),
    ],
    [
      'um registro de atraso que fechou depois de agora',
      (state) => (state.guild.lastWageArrears = { endedAtMs: 1, lastedMs: 5, departed: 0 }),
    ],
    [
      'um atraso aberto junto com o registro do que fechou',
      (state) => {
        state.guild.wageArrears = { sinceMs: 0, carriedMs: 0, departed: 0 };
        state.guild.lastWageArrears = { endedAtMs: 0, lastedMs: 5, departed: 0 };
      },
    ],
    ['o número da versão 3', (state) => (state.schemaVersion = 3)],
    ['o número da versão 2', (state) => (state.schemaVersion = 2)],
    ['o número da versão anterior', (state) => (state.schemaVersion = 1)],
    ['um resto de produção ausente', (state) => delete state.settlement.accumulators.wood],
    ['um estoque negativo', (state) => (state.settlement.resources.stone = -1)],
    // É no que um `NaN` vira depois de passar pelo banco: JSON não tem `NaN`.
    ['um estoque nulo', (state) => (state.settlement.resources.wood = null)],
  ];

  it.each(damages)('recusa %s', (_, damage) => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    damage(state);
    expect(currentShape(state, '')).not.toBeNull();
  });

  // O estado que declara a versão atual é conferido como o de qualquer outra: o número da
  // versão não é salvo-conduto (GDD §15.4).
  it.each(damages)('`migrateState` recusa %s, sem tocar na entrada', (_, damage) => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    damage(state);
    const copy = JSON.parse(JSON.stringify(state)) as unknown;
    let caught: unknown;
    try {
      migrateState(state, { timeScale: 1 });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(StateMigrationError);
    expect((caught as StateMigrationError).reason).toBe('invalid');
    expect(state).toEqual(copy);
  });

  it('o que o motor calcularia a partir de um estado sem um campo nunca chega a existir', () => {
    // Sem a recusa, este estado avançava, a madeira virava `NaN` e o banco gravava `null`.
    const stored = JSON.parse(JSON.stringify(newGame())) as Draft;
    stored.settlement.workers.lumberMill = 3;
    delete stored.settlement.accumulators.wood;
    expect(() => migrateState(stored, { timeScale: 1 })).toThrow(
      new RegExp(
        `versão ${CURRENT_SCHEMA_VERSION}, mas não tem a forma dela \\(settlement\\.accumulators\\.wood: campo ausente\\)`,
      ),
    );
  });

  it('a mensagem de um estado atual fora da forma não cita o que o jogador escreveu', () => {
    const stored = JSON.parse(JSON.stringify(newGame())) as Draft;
    stored.settlement.name = 'Nome Que Não Vai Para o Log';
    stored.settings.vigilHourLocal = 'vinte';
    expect(() => migrateState(stored, { timeScale: 1 })).toThrow(
      /settings\.vigilHourLocal: esperado inteiro a partir de zero, veio texto/,
    );
    expect(() => migrateState(stored, { timeScale: 1 })).not.toThrow(/Nome Que/);
  });

  it('conhece as classes, os traços, o nível máximo e o teto da lista que o conteúdo tem', () => {
    expect(HERO_CLASS_IDS_V14).toEqual([...HERO_CLASS_IDS]);
    expect(HERO_TRAIT_IDS_V14).toEqual([...HERO_TRAIT_IDS]);
    expect(HERO_MAX_LEVEL_V14).toBe(balance.heroes.maxLevel);
    expect(HERO_ROSTER_CAP_V14).toBe(balance.heroes.rosterCap);
    expect(HERO_GENDER_IDS_V15).toEqual([...HERO_GENDER_IDS]);
    expect(HERO_ARRIVING_CAP_V15).toBe(balance.heroes.arrivingCap);
    // Os estados de herói desta versão: no feudo e em expedição (versão 17), em recuperação e
    // em cativeiro (versão 18), e na escolta de uma caravana (versão 22).
    expect(HERO_STATUS_IDS).toEqual(['idle', 'expedition', 'injured', 'captured', 'escort']);
    expect(HERO_STATUS_IDS_V22).toEqual([...HERO_STATUS_IDS]);
    expect(CARAVAN_SLOTS_CAP_V22).toBe(Math.max(...balance.market.caravan.slotsByLevel));
  });

  it('aceita a guilda cheia: o teto de heróis, de todas as classes, todos os traços e níveis, com o atraso aberto', () => {
    const draft = JSON.parse(JSON.stringify(newGame())) as GameState;
    for (let index = 0; index < balance.heroes.rosterCap; index += 1) {
      addHero(draft, {
        classId: HERO_CLASS_IDS[index % HERO_CLASS_IDS.length] ?? 'warrior',
        level: (index % balance.heroes.maxLevel) + 1,
        traits: index === 0 ? [...HERO_TRAIT_IDS] : [],
      });
    }
    expect(() => addHero(draft)).toThrow(/teto da lista/);
    expect(currentShape(JSON.parse(JSON.stringify(draft)), '')).toBeNull();
    draft.guild.wageArrears = { sinceMs: 0, carriedMs: 7, departed: 2 };
    (draft.guild.heroes[1] as GameState['guild']['heroes'][number]).discontent = true;
    expect(currentShape(JSON.parse(JSON.stringify(draft)), '')).toBeNull();
    draft.guild.wageArrears = null;
    expect(currentShape(JSON.parse(JSON.stringify(draft)), '')).toBe(
      'guild.heroes.1.discontent: herói Descontente sem soldo em atraso',
    );
    // Um herói que partiu leva o identificador: o contador fica à frente da lista.
    const gone = JSON.parse(JSON.stringify(newGame())) as GameState;
    addHero(gone);
    addHero(gone);
    gone.guild.heroes.shift();
    gone.guild.lastWageArrears = { endedAtMs: 0, lastedMs: 9, departed: 1 };
    expect(currentShape(JSON.parse(JSON.stringify(gone)), '')).toBeNull();
  });

  it('a mensagem da guilda fora da forma diz o caminho e nunca o nome do herói', () => {
    const broken = (damage: (state: Draft) => unknown) => {
      const state = JSON.parse(JSON.stringify(newGame())) as Draft;
      damage(state);
      return currentShape(state, '');
    };
    expect(broken((state) => withHero(state, (hero) => (hero.id = 'hero-2')))).toBe(
      'guild.heroes.0.id: herói além do contador de ids.hero',
    );
    expect(broken((state) => withHero(state, (hero) => (hero.level = 11)))).toBe(
      'guild.heroes.0.level: esperado um nível de 1 a 10',
    );
    expect(broken((state) => withHero(state, (hero) => (hero.status = 'siege')))).toBe(
      'guild.heroes.0.status: esperado um de idle, expedition, injured, captured, escort, veio texto',
    );
    // Desde a versão 22 a escolta é um estado, mas só de quem escolta uma caravana.
    expect(broken((state) => withHero(state, (hero) => (hero.status = 'escort')))).toBe(
      'guild.heroes.0.status: herói em escolta sem caravana',
    );
    expect(broken((state) => withHero(state, (hero) => (hero.status = 'captured')))).toBe(
      'guild.heroes.0.captivity: só o herói em cativeiro tem cativeiro',
    );
    expect(broken((state) => withHero(state, (hero) => (hero.equipment = {})))).toBe(
      'guild.heroes.0.equipment.weapon: campo ausente',
    );
    expect(broken((state) => withHero(state, (hero) => (hero.durability = 3)))).toBe(
      'guild.heroes.0.durability: campo desconhecido',
    );
    const named = broken((state) =>
      withHero(state, (hero) => {
        hero.name = 'Nome Que Não Vai Para o Log';
        hero.xp = 'muita';
      }),
    );
    expect(named).toBe('guild.heroes.0.xp: esperado inteiro a partir de zero, veio texto');
    // A forma de tratamento: uma das duas, e nunca ausente.
    expect(broken((state) => withHero(state, (hero) => (hero.gender = 'x')))).toBe(
      'guild.heroes.0.gender: esperado um de f, m, veio texto',
    );
    expect(broken((state) => withHero(state, (hero) => delete hero.gender))).toBe(
      'guild.heroes.0.gender: campo ausente',
    );
  });

  it('aceita os heróis prometidos, a caminho e à espera de lugar, e recusa a lista fora da forma', () => {
    const shaped = (arriving: unknown) => {
      const state = JSON.parse(JSON.stringify(advanceTo(newGame(), 30 * HOUR).state)) as Draft;
      state.guild.arriving = arriving;
      return currentShape(state, '');
    };
    expect(shaped([])).toBeNull();
    // Um a caminho e um com o prazo vencido, à espera de lugar: os dois cabem.
    expect(
      shaped([
        { namedHeroId: 'edda', atMs: 20 * HOUR },
        { namedHeroId: 'rolf', atMs: 32 * HOUR },
      ]),
    ).toBeNull();
    // O identificador é conferido pela forma: o herói com nome que o conteúdo ganhar depois não
    // pede versão nova do estado, e o que ele perder sai da lista sem chegar.
    expect(shaped([{ namedHeroId: 'outroHeroi', atMs: 0 }])).toBeNull();
    expect(shaped([{ namedHeroId: 'Nome Que Não Vai Para o Log', atMs: 0 }])).toBe(
      'guild.arriving.0.namedHeroId: esperado o identificador de um herói com nome',
    );
    expect(shaped([{ namedHeroId: 'rolf', atMs: -1 }])).toMatch(/^guild\.arriving\.0\.atMs: /);
    expect(shaped([{ namedHeroId: 'rolf', atMs: 1, name: 'Rolf' }])).toBe(
      'guild.arriving.0.name: campo desconhecido',
    );
    expect(
      shaped([
        { namedHeroId: 'rolf', atMs: 32 * HOUR },
        { namedHeroId: 'edda', atMs: 20 * HOUR },
      ]),
    ).toBe('guild.arriving.1.atMs: lista fora da ordem de chegada');
    const crowd = Array.from({ length: balance.heroes.arrivingCap + 1 }, () => ({
      namedHeroId: 'rolf',
      atMs: 0,
    }));
    expect(shaped(crowd)).toBe(
      `guild.arriving: esperada lista de até ${balance.heroes.arrivingCap} heróis a caminho, veio de ${crowd.length}`,
    );
    expect(shaped(crowd.slice(1))).toBeNull();
  });

  it('conhece os mesmos fluxos de sorteio que o gerador, fixos e de família', () => {
    expect(RNG_FIXED_STREAMS_V21).toEqual([...RNG_STREAMS]);
    // A versão 13 continua com os três de antes: a Taverna só entra na 16, e o Mercado, na 21.
    expect(RNG_FIXED_STREAMS_V13).toEqual(['council', 'morale', 'horde']);
    expect(RNG_FIXED_STREAMS_V16).toEqual(['council', 'morale', 'horde', 'tavern']);
    expect(RNG_STREAM_FAMILIES_V13).toEqual([...RNG_STREAM_FAMILIES]);
    // Tudo o que o gerador e o contador escrevem cabe na forma: os fluxos fixos, um fluxo de
    // cada família (com o identificador que `nextId` dá) e os contadores.
    const draft = JSON.parse(JSON.stringify(newGame())) as GameState;
    for (const stream of RNG_STREAMS) {
      nextInt(draft, stream, 6);
    }
    for (const family of RNG_STREAM_FAMILIES) {
      nextInt(draft, entityStream(family, nextId(draft, family)), 6);
      nextInt(draft, entityStream(family, nextId(draft, family)), 6);
      nextId(draft, 'hero');
    }
    expect(Object.keys(draft.rng)).toEqual([
      'council',
      'morale',
      'horde',
      'tavern',
      'market',
      'expedition:expedition-1',
      'expedition:expedition-2',
      'caravan:caravan-1',
      'caravan:caravan-2',
    ]);
    expect(draft.ids).toEqual({ expedition: 2, hero: 2, caravan: 2 });
    // Gravado, o fluxo de uma expedição só cabe com ela em curso (versão 17; os testes das
    // expedições conferem o caso de verdade): sem expedição nenhuma, a guarda o recusa, e o
    // resto cabe.
    const saved = JSON.parse(JSON.stringify(draft)) as GameState;
    expect(currentShape(saved, '')).toBe(
      'rng.expedition:expedition-1: fluxo de uma expedição que não está em curso',
    );
    delete saved.rng['expedition:expedition-1'];
    delete saved.rng['expedition:expedition-2'];
    // E o do Mercado só cabe depois do primeiro passeio do preço (versão 21; os testes do
    // Mercado conferem o caso de verdade): nesta partida os preços nunca andaram.
    expect(currentShape(saved, '')).toBe('rng.market: fluxo do Mercado sem cotação feita');
    delete saved.rng.market;
    // E o de uma caravana só cabe com ela na estrada (versão 22; no jogo ele nasce e é apagado
    // na chegada, e nunca chega a ser gravado).
    expect(currentShape(saved, '')).toBe(
      'rng.caravan:caravan-1: fluxo de uma caravana que não está na estrada',
    );
    delete saved.rng['caravan:caravan-1'];
    delete saved.rng['caravan:caravan-2'];
    expect(currentShape(saved, '')).toBeNull();
    // O maior valor de cada palavra e um contador em zero também cabem.
    const edge = JSON.parse(JSON.stringify(newGame())) as Draft;
    edge.rng = { council: [0xffff_ffff, 0, 0, 0] };
    edge.ids = { caravan: 120, masterBuilder: 0 };
    expect(currentShape(edge, '')).toBeNull();
  });

  it('a mensagem de um fluxo ou de um contador fora da forma cita o caminho e a regra', () => {
    const broken = (edit: (state: Draft) => void) => {
      const state = JSON.parse(JSON.stringify(newGame())) as Draft;
      edit(state);
      return currentShape(state, '');
    };
    expect(broken((state) => (state.rng = { siege: [1, 2, 3, 4] }))).toBe(
      'rng.siege: chave fora do esperado (um de council, morale, horde, tavern, market, ou expedition:expedition-<n>, caravan:caravan-<n>)',
    );
    expect(broken((state) => (state.rng = { council: [1, 2, 3] }))).toBe(
      'rng.council: esperada lista de 4 itens, veio de 3',
    );
    expect(broken((state) => (state.rng = { council: [1, 2, -3, 4] }))).toBe(
      'rng.council.2: esperado inteiro sem sinal de 32 bits, veio inteiro',
    );
    expect(broken((state) => (state.rng = { council: [0, 0, 0, 0] }))).toBe(
      'rng.council: esperado um fluxo de sorteio com alguma palavra diferente de zero',
    );
    expect(broken((state) => (state.rng = { 'expedition:hero-1': [1, 2, 3, 4] }))).toMatch(
      /^rng\.expedition:hero-1: chave fora do esperado/,
    );
    // A conferência cruzada: o fluxo tem a forma certa, mas é de uma entidade que o contador
    // ainda não deu.
    expect(
      broken((state) => {
        state.ids = { expedition: 4 };
        state.rng = { 'expedition:expedition-5': [1, 2, 3, 4] };
      }),
    ).toBe('rng.expedition:expedition-5: fluxo de uma entidade além do contador de ids.expedition');
    expect(broken((state) => (state.rng = { 'caravan:caravan-1': [1, 2, 3, 4] }))).toBe(
      'rng.caravan:caravan-1: fluxo de uma entidade além do contador de ids.caravan',
    );
    // Dentro do contador, mas sem a expedição em curso: desde a versão 17 também não cabe. O
    // de uma caravana, desde a versão 22, só com ela na estrada.
    expect(
      broken((state) => {
        state.ids = { expedition: 5 };
        state.rng = { 'expedition:expedition-5': [1, 2, 3, 4] };
      }),
    ).toBe('rng.expedition:expedition-5: fluxo de uma expedição que não está em curso');
    expect(
      broken((state) => {
        state.ids = { caravan: 5 };
        state.rng = { 'caravan:caravan-5': [1, 2, 3, 4] };
      }),
    ).toBe('rng.caravan:caravan-5: fluxo de uma caravana que não está na estrada');
    expect(broken((state) => (state.ids = { 'hero-1': 3 }))).toBe(
      'ids.hero-1: chave fora do esperado (um tipo de entidade, só letras, começando por minúscula)',
    );
    expect(broken((state) => (state.ids = { hero: -1 }))).toBe(
      'ids.hero: esperado inteiro a partir de zero, veio inteiro',
    );
  });

  it('a versão seguinte estende a lista de fluxos sem mexer na desta', () => {
    // É o que a versão da Taverna e a do Mercado vão fazer: a forma delas parte das listas
    // desta, com um nome a mais, e a desta continua recusando o nome novo.
    const next = rngShape([...RNG_FIXED_STREAMS_V13, 'tavern'], RNG_STREAM_FAMILIES_V13);
    const rng = { tavern: [1, 2, 3, 4], 'expedition:expedition-2': [5, 6, 7, 8] };
    expect(next(rng, 'rng')).toBeNull();
    expect(rngShape(RNG_FIXED_STREAMS_V13, RNG_STREAM_FAMILIES_V13)(rng, 'rng')).toMatch(
      /^rng\.tavern: chave fora do esperado/,
    );
    expect(idsShape({ hero: 3 }, 'ids')).toBeNull();
  });

  it('conhece as mesmas dificuldades que o conteúdo', () => {
    for (const difficulty of DIFFICULTY_IDS) {
      const state = { ...newGame(), settings: { ...newGame().settings, difficulty } };
      expect(currentShape(state, '')).toBeNull();
    }
  });

  it('conhece os mesmos edifícios e recursos que o conteúdo', () => {
    const state = newGame();
    expect(Object.keys(state.settlement.buildings)).toEqual([...BUILDING_IDS]);
    expect(Object.keys(state.settlement.wasted)).toEqual([...RESOURCE_IDS]);
    // As filas do estado são as do conteúdo, abertas ou não.
    expect(state.settlement.constructionQueues).toHaveLength(balance.construction.queues);
    // Uma obra em cada fila e uma planejada de cada edifício do conteúdo cabem na forma.
    for (const building of BUILDING_IDS) {
      const busy = JSON.parse(JSON.stringify(state)) as Draft;
      const work = { building, targetLevel: 1, startedAtMs: 0, finishesAtMs: 1 };
      busy.settlement.constructionQueues = [work, work];
      busy.settlement.planned = [
        { building, targetLevel: 2, autoStart: true },
        { building, targetLevel: 3, autoStart: false },
      ];
      expect(currentShape(busy, ''), building).toBeNull();
    }
  });

  it('aceita o Conselho com cartas na mesa, flags, continuações, efeitos à espera e expiradas', () => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    state.council = {
      pending: [
        {
          instanceId: 'alms-1',
          cardId: 'alms',
          drawnAtMs: 0,
          expiresAtMs: 86_400_000,
          origin: null,
        },
        {
          instanceId: 'toll-2',
          cardId: 'toll',
          drawnAtMs: 7,
          expiresAtMs: 86_400_007,
          origin: null,
        },
      ],
      flags: { 'toll.paid': true, 'commonGranary.open': true },
      seenThisYear: ['alms', 'toll'],
      nextDrawAtMs: 28_800_000,
      scheduled: [
        {
          cardId: 'tollReturn',
          atMs: 14_400_000,
          previousCardId: 'toll',
          previousOptionId: 'pay',
          previousInstanceId: 'toll-2',
        },
      ],
      delayed: [{ atMs: 14_400_000, instanceId: 'toll-2', cardId: 'toll', optionId: 'refuse' }],
      expired: ['alms-0'],
    };
    expect(currentShape(state, '')).toBeNull();
  });

  it('conhece os mesmos tiles, inimigos e tamanhos de incursão que o conteúdo', () => {
    for (const type of TILE_TYPE_IDS) {
      const state = JSON.parse(JSON.stringify(newGame())) as Draft;
      state.map.tiles = { a: { type, threatActive: true }, b: { type, threatActive: false } };
      state.map.threat = 100;
      expect(currentShape(state, ''), type).toBeNull();
    }
    for (const enemy of ENEMY_IDS) {
      for (const size of RAID_SIZE_IDS) {
        const state = JSON.parse(JSON.stringify(newGame())) as Draft;
        state.horde.scheduledRaids = [
          {
            id: 'scripted-1',
            atMs: 108_000_000,
            kind: 'scripted',
            enemy,
            size,
            announcedAtMs: null,
          },
          {
            id: 'threat-2',
            atMs: 129_600_000,
            kind: 'threat',
            enemy,
            size,
            announcedAtMs: 126_000_000,
          },
        ];
        expect(currentShape(state, ''), `${enemy}/${size}`).toBeNull();
      }
    }
    // Um mapa sem tile nenhum também é um mapa.
    const empty = JSON.parse(JSON.stringify(newGame())) as Draft;
    empty.map.tiles = {};
    expect(currentShape(empty, '')).toBeNull();
  });

  it('conhece os mesmos edifícios produtivos que o conteúdo, e recusa uma coorte vazia', () => {
    const state = newGame();
    expect(Object.keys(state.settlement.craftExperience)).toEqual([...PRODUCTION_BUILDING_IDS]);
    expect(Object.keys(state.settlement.craftMasteredYear)).toEqual([...PRODUCTION_BUILDING_IDS]);
    for (const building of PRODUCTION_BUILDING_IDS) {
      const adapting = JSON.parse(JSON.stringify(state)) as Draft;
      adapting.settlement.adaptation = [{ building, count: 2, untilMs: 7_200_000 }];
      expect(currentShape(adapting, ''), building).toBeNull();
    }
    const broken = (adaptation: unknown) => {
      const draft = JSON.parse(JSON.stringify(state)) as Draft;
      draft.settlement.adaptation = adaptation;
      return currentShape(draft, '');
    };
    expect(broken([{ building: 'farm', count: 0, untilMs: 1 }])).toMatch(
      /^settlement\.adaptation\.0\.count/,
    );
    expect(broken([{ building: 'housing', count: 1, untilMs: 1 }])).toMatch(
      /^settlement\.adaptation\.0\.building/,
    );
    expect(broken([{ building: 'farm', count: 1 }])).toMatch(/untilMs: campo ausente$/);
    expect(broken(null)).toMatch(/^settlement\.adaptation/);
  });

  it('aceita os feridos: de cada edifício produtivo do conteúdo, e os que não tinham ofício', () => {
    const state = JSON.parse(JSON.stringify(newGame())) as Draft;
    state.settlement.injured = [
      ...PRODUCTION_BUILDING_IDS.map((building) => ({ untilMs: 7_200_000, building })),
      { untilMs: 14_400_000, building: null },
    ];
    expect(currentShape(state, '')).toBeNull();
  });
});

describe.each(fixtures)('$name', (fixture) => {
  it('declara a versão do nome do arquivo', () => {
    expect(read(fixture).schemaVersion).toBe(fixture.version);
  });

  it('migra para a versão atual sem alterar a entrada', () => {
    const input = read(fixture);
    const state = migrateState(input, { timeScale: fixture.timeScale });
    expect(input).toEqual(read(fixture));
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    // Exatamente os campos de uma partida nova: nada sobra da versão antiga, nada falta.
    expect(fixedKeys(state, newGame()).sort()).toEqual(fixedKeys(newGame()).sort());
  });

  it('migrar duas vezes é migrar uma, e a mesma entrada dá sempre o mesmo estado', () => {
    const once = migrated(fixture);
    expect(migrateState(once, { timeScale: fixture.timeScale })).toBe(once);
    // O estado migrado, depois de passar pelo banco (JSON), continua sendo ele mesmo.
    const stored = JSON.parse(JSON.stringify(once)) as unknown;
    expect(migrateState(stored, { timeScale: 7 })).toEqual(once);
    expect(migrated(fixture)).toEqual(once);
  });

  it('a fronteira fica no instante em que a migração encontrou a partida', () => {
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    // Um retrato da versão atual não é migrado: a fronteira dele é a que estava gravada.
    expect(after.migratedAtMs).toBe(
      fixture.version < CURRENT_SCHEMA_VERSION ? before.lastProcessedAt : before.migratedAtMs,
    );
    // Nada do que a migração marcou está vencido: o próximo evento é depois da fronteira.
    expect(nextEventAt(after)).toBeGreaterThan(after.lastProcessedAt);
  });

  it('preserva tudo o que o jogador tem', () => {
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    expect(after.seed).toBe(before.seed);
    expect(after.clock).toEqual(before.clock);
    expect(after.lastProcessedAt).toBe(before.lastProcessedAt);
    expect(after.settlement.name).toBe(before.settlement.name);
    expect(after.settlement.resources).toMatchObject(before.settlement.resources);
    expect(after.settlement.accumulators).toMatchObject(before.settlement.accumulators);
    expect(after.settlement.population.villagers).toBe(before.settlement.population.villagers);
    expect(after.settlement.workers).toMatchObject(before.settlement.workers);
    expect(after.settlement.buildings).toMatchObject(before.settlement.buildings);
    expect(after.settlement.recruitmentQueue).toEqual(before.settlement.recruitmentQueue);
    // A fome continua aberta desde quando abriu; o que a versão 12 acrescenta a ela é do passo.
    expect(after.settlement.famine?.sinceMs ?? null).toBe(
      before.settlement.famine?.sinceMs ?? null,
    );
    expect(after.objectives).toEqual(before.objectives);
    expect(after.stats).toMatchObject(before.stats);
    expect(after.settings.settlementName).toBe(before.settings.settlementName);
    expect(after.settings.timezone).toBe(before.settings.timezone);
    expect(after.settings.vigilHourLocal).toBe(before.settings.vigilHourLocal);
  });

  it('avança 30 dias reais e aceita ordens', () => {
    let state = migrated(fixture);
    const { timeScale } = state.settings;
    const start = state.lastProcessedAt;

    const renamed = applyCommand(
      state,
      command('renameSettlement', { name: 'Vau do Corvo' }),
      start,
    );
    expect(renamed.ok).toBe(true);
    if (renamed.ok) {
      state = renamed.state;
    }
    const idle = applyCommand(state, command('setWorkers', { building: 'farm', count: 0 }), start);
    expect(idle.ok).toBe(true);
    // Qualquer obra é aceita ou recusada com um motivo conhecido: nenhuma lança.
    for (const building of buildingIds) {
      const result = applyCommand(state, command('startConstruction', { building }), start);
      if (!result.ok) {
        expect(REJECTION_CODES).toContain(result.code);
        expect(result.message.trim()).not.toBe('');
      }
    }

    const end = start + Math.round(30 * DAY_REAL * timeScale);
    const advanced = advanceTo(state, end);
    expect(advanced.state.lastProcessedAt).toBe(end);
    expect(advanced.state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(advanced.state.migratedAtMs).toBe(state.migratedAtMs);
    expect(currentShape(JSON.parse(JSON.stringify(advanced.state)), '')).toBeNull();
    expect(advanced.events.filter((event) => event.type === 'dayStarted').length).toBe(
      Math.floor(end / (2 * HOUR)) - Math.floor(start / (2 * HOUR)),
    );
    for (const amount of Object.values(advanced.state.settlement.resources)) {
      expect(Number.isSafeInteger(amount)).toBe(true);
      expect(amount).toBeGreaterThanOrEqual(0);
    }

    const view = deriveViewState(advanced.state, end);
    expect(view.settlement.name).toBe('Vau do Corvo');
    // Depois de um mês, o senhor volta e manda para a Fazenda todo mundo que pode trabalhar
    // (quem os lobos feriram na véspera fica de cama).
    let later = advanced.state;
    const able = later.settlement.population.villagers - later.settlement.injured.length;
    for (const building of ['lumberMill', 'quarry', 'goldMine', 'farm'] as const) {
      const count = building === 'farm' ? able : 0;
      const result = applyCommand(later, command('setWorkers', { building, count }), end);
      expect(result.ok).toBe(true);
      if (result.ok) {
        later = result.state;
      }
    }
    expect(later.settlement.workers.farm).toBe(able);
    expect(able).toBeGreaterThan(0);
  });

  it('a divisão de intervalo continua exata sobre o estado migrado', () => {
    const start = migrated(fixture);
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 * DAY_REAL }),
        fc.integer({ min: 1, max: 20 * DAY_REAL }),
        (a, b) => {
          const middle = start.lastProcessedAt + Math.min(a, b);
          const end = start.lastProcessedAt + Math.max(a, b);
          const direct = advanceTo(start, end);
          const first = advanceTo(start, middle);
          const second = advanceTo(first.state, end);
          expect(second.state).toStrictEqual(direct.state);
          expect([...first.events, ...second.events]).toStrictEqual(direct.events);
        },
      ),
      { numRuns: 40 },
    );
  });
});

describe('versão 1 → 2', () => {
  const construction = named('state-v1-construction.json');
  // Só o primeiro passo: o que a fundação mudou, sem o que as versões seguintes acrescentaram.
  const foundation: MigrationChain = { steps: [v1ToV2], shape: stateV2 };

  it.each(fixtures.filter((fixture) => fixture.version === 1))(
    '$name: muda só o que a fundação exige',
    (fixture) => {
      const before = read(fixture) as unknown as GameState & {
        settings: { capsEnabled: boolean };
      };
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        foundation,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(2);
      expect(after.settings).toStrictEqual({
        settlementName: before.settings.settlementName,
        timezone: before.settings.timezone,
        vigilHourLocal: before.settings.vigilHourLocal,
        difficulty: 'lord',
        timeScale: fixture.timeScale,
      });
      expect(after.migratedAtMs).toBe(before.lastProcessedAt);
      // O resto é o estado antigo, campo por campo.
      const untouched = (state: object) =>
        Object.fromEntries(
          Object.entries(state).filter(
            ([key]) => !['schemaVersion', 'settings', 'migratedAtMs'].includes(key),
          ),
        );
      expect(untouched(after)).toStrictEqual(untouched(before));
      expect(Object.keys(untouched(after)).length).toBe(Object.keys(before).length - 2);
    },
  );

  it('o ritmo vem da linha da partida e passa a valer na visão sem ninguém informar', () => {
    const slow = migrateState(read(construction), { timeScale: 1 });
    const fast = migrateState(read(construction), { timeScale: 3 });
    const half = migrateState(read(construction), { timeScale: 0.5 });
    expect(fast.settings.timeScale).toBe(3);
    expect(half.settings.timeScale).toBe(0.5);

    // A obra do retrato acaba aos 240.000 ms de jogo; o estado está em 127.321 ms.
    const remaining = (state: GameState) =>
      deriveViewState(state, state.lastProcessedAt).constructions.active?.secondsRemaining;
    expect(remaining(slow)).toBe(113);
    expect(remaining(fast)).toBe(38);
    expect(remaining(half)).toBe(226);
    // E quem pede outro ritmo explicitamente continua sendo atendido.
    expect(
      deriveViewState(fast, fast.lastProcessedAt, { timeScale: 1 }).constructions.active
        ?.secondsRemaining,
    ).toBe(113);
  });

  it('a fronteira é o instante até onde as regras antigas valeram, não o da leitura', () => {
    const state = migrateState(read(construction), { timeScale: 3 });
    expect(state.migratedAtMs).toBe(127_321);
    const later = advanceTo(state, 5 * HOUR).state;
    expect(later.migratedAtMs).toBe(127_321);
  });

  it.each([
    ['um ritmo zero', 0],
    ['um ritmo negativo', -1],
    ['um ritmo infinito', Number.POSITIVE_INFINITY],
    ['um ritmo que não é número', Number.NaN],
  ])('recusa %s', (_, timeScale) => {
    expect(() => migrateState(read(construction), { timeScale })).toThrow(/Ritmo inválido/);
  });
});

describe('versão 2 → 3', () => {
  const version2 = fixtures.filter((fixture) => fixture.version === 2);
  const WINTER_DAY_4 = (72 + 3) * 2 * HOUR;
  // Só até a versão 3: o que as estações mudaram, sem o que as versões seguintes acrescentaram.
  const seasons: MigrationChain = { steps: [v1ToV2, v2ToV3], shape: stateV3 };

  /**
   * Um estado como a versão 2 o gravava, parado no 4º dia do inverno, em cima de uma virada de
   * dia: todos na Fazenda, comida de sobra, objetivos cumpridos e `wood` de madeira.
   */
  function version2InWinter(wood: number): Draft {
    const old = asVersion11(gameAt(WINTER_DAY_4));
    old.schemaVersion = 2;
    delete old.settlement.cold;
    delete old.settlement.wasted;
    delete old.settlement.craftExperience;
    delete old.settlement.craftMasteredYear;
    delete old.settlement.adaptation;
    delete old.settlement.morale;
    delete old.settlement.moraleEffects;
    delete old.settlement.injured;
    delete old.council;
    delete old.map;
    delete old.horde;
    delete old.settlement.buildings.granary;
    delete old.settlement.buildings.warehouse;
    delete old.settlement.buildings.watchtower;
    delete old.settlement.buildings.palisade;
    old.settlement.workers.farm = 5;
    old.settlement.resources.food = 500_000;
    old.settlement.resources.wood = wood;
    return old;
  }

  it.each(version2)('$name: só acrescenta o frio, fechado', (fixture) => {
    const before = read(fixture) as unknown as GameState;
    const after = migrateWith(
      read(fixture),
      { timeScale: fixture.timeScale },
      seasons,
    ) as unknown as GameState;
    expect(after.schemaVersion).toBe(3);
    expect(after.settlement.cold).toBeNull();
    // O resto é o estado antigo, campo por campo: estoque, restos de produção, prazos de obra
    // e de recrutamento, fome. A fronteira passa a ser a deste passo.
    expect(after.settlement).toStrictEqual({ ...before.settlement, cold: null });
    expect({ ...after, schemaVersion: 2, settlement: before.settlement }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it('nenhum prazo muda: a obra e o recruta em curso chegam na hora marcada', () => {
    // O retrato tem uma obra que acaba aos 240.000 ms e dois aldeões a caminho, ordenados na
    // primavera com o prazo de tabela (20 min), antes de a estação mexer em prazos.
    const fixture = named('state-v2-construction.json');
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    expect(after.settlement.constructionQueues[0]).toEqual(before.settlement.constructionQueues[0]);
    expect(after.settlement.recruitmentQueue).toEqual([
      { finishesAtMs: 1_200_000 },
      { finishesAtMs: 2_400_000 },
    ]);
    const { events } = advanceTo(after, HOUR);
    expect(
      events.filter((event) => event.type === 'recruitmentFinished').map((event) => event.atMs),
    ).toEqual([1_200_000, 2_400_000]);
    expect(
      events.filter((event) => event.type === 'constructionFinished').map((event) => event.atMs),
    ).toEqual([240_000]);
  });

  it('as taxas passam a levar a estação a partir da fronteira, sem recalcular o que passou', () => {
    const fixture = named('state-v2-construction.json');
    const before = read(fixture) as unknown as GameState;
    const after = migrated(fixture);
    // O estoque na fronteira é o que as regras antigas deixaram.
    expect(after.settlement.resources).toEqual(before.settlement.resources);
    expect(after.settlement.accumulators).toEqual(before.settlement.accumulators);
    // Dali em diante, primavera: os 2 fazendeiros rendem 24 por hora, e não 20.
    const view = deriveViewState(after, after.lastProcessedAt);
    expect(view.workers.find((row) => row.building === 'farm')?.grossPerHour).toBe(24);
  });

  it('partida encontrada no inverno e sem madeira: o frio abre na fronteira, com a linha na Crônica', () => {
    // Uma partida da versão 2 parada no 4º dia do inverno, em cima de uma virada de dia, sem
    // madeira e sem lenhadores. Nas regras antigas ninguém passava frio.
    const old = version2InWinter(0);

    const state = migrateState(old, { timeScale: 3 });
    expect(state.settlement.cold).toBeNull();
    expect(state.migratedAtMs).toBe(WINTER_DAY_4);

    // O primeiro avanço acomoda o estado no instante da fronteira: o frio começa ali, e a
    // virada de dia daquele instante, que as regras antigas já tinham registrado, não se repete.
    const { state: after, events } = advanceTo(state, WINTER_DAY_4 + 1);
    expect(events.map((event) => [event.type, event.atMs])).toEqual([
      ['coldStarted', WINTER_DAY_4],
    ]);
    expect(after.settlement.cold).toEqual({ sinceMs: WINTER_DAY_4 });
    // E a divisão de intervalo continua exata a partir dali.
    const direct = advanceTo(state, WINTER_DAY_4 + 30 * HOUR);
    const first = advanceTo(state, WINTER_DAY_4 + 7 * HOUR + 13);
    const second = advanceTo(first.state, WINTER_DAY_4 + 30 * HOUR);
    expect(second.state).toStrictEqual(direct.state);
    expect([...first.events, ...second.events]).toStrictEqual(direct.events);
  });

  it('partida encontrada no inverno com madeira: nada acontece na fronteira', () => {
    const old = version2InWinter(100_000);
    const state = migrateState(old, { timeScale: 1 });
    expect(advanceTo(state, WINTER_DAY_4 + 1).events).toEqual([]);
  });
});

describe('versão 3 → 4', () => {
  const version3 = fixtures.filter((fixture) => fixture.version === 3);
  const milli = (state: GameState, resource: 'food' | 'wood' | 'stone') =>
    state.settlement.resources[resource];
  // Só até a versão 4: o que o armazenamento mudou, sem o que as versões seguintes acrescentaram.
  const storage: MigrationChain = { steps: [v1ToV2, v2ToV3, v3ToV4], shape: stateV4 };

  it.each(version3)(
    '$name: só acrescenta o Celeiro e o Armazém no nível 0 e o desperdício zerado',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        storage,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(4);
      expect(after.settlement.buildings).toStrictEqual({
        ...before.settlement.buildings,
        granary: 0,
        warehouse: 0,
      });
      expect(after.settlement.wasted).toStrictEqual({ food: 0, wood: 0, stone: 0, gold: 0 });
      // O resto é o estado antigo, campo por campo: estoque (mesmo acima do limite), restos de
      // produção, obras, planejadas, fome, frio, objetivos e contadores.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        buildings: after.settlement.buildings,
        wasted: after.settlement.wasted,
      });
      expect({ ...after, schemaVersion: 3, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
      expect(Object.keys(after.stats).filter((key) => key.startsWith('wasted_'))).toEqual([]);
    },
  );

  it.each(version3)(
    '$name: nada acontece na fronteira, nem "encheu" de estoque herdado',
    (fixture) => {
      const state = migrated(fixture);
      const { events } = advanceTo(state, state.lastProcessedAt + 1);
      expect(events.filter((event) => event.type.startsWith('storage'))).toEqual([]);
    },
  );

  it('estoque acima do limite fica, não recebe produção e pode ser gasto (ADR 0013, decisão 4)', () => {
    // O feudo que veio da v0.1 pelo ritmo 3: dezenas de milhares de madeira e de pedra.
    const fixture = named('state-v3-migrated-3x.json');
    const before = read(fixture) as unknown as GameState;
    const state = migrated(fixture);
    expect(state.settlement.resources).toEqual(before.settlement.resources);
    expect(milli(state, 'wood')).toBeGreaterThan(10_000_000);
    expect(milli(state, 'stone')).toBeGreaterThan(5_000_000);

    const view = deriveViewState(state, state.lastProcessedAt);
    const wood = view.resources.find((row) => row.id === 'wood');
    expect(wood).toMatchObject({ cap: 500, full: true, fullInSeconds: null });
    expect(wood?.stock).toBe(Math.floor(milli(state, 'wood') / 1000));
    expect(wood?.fullNote).toMatch(/^Pátio cheio: .*Construa o Armazém ou gaste madeira\.$/);

    // Um dia de jogo depois: o estoque não cresceu, e o que a Serraria fez foi ao chão.
    const day = 2 * HOUR;
    const later = advanceTo(state, state.lastProcessedAt + day);
    expect(milli(later.state, 'wood')).toBeLessThanOrEqual(milli(state, 'wood'));
    expect(milli(later.state, 'stone')).toBeLessThanOrEqual(milli(state, 'stone'));
    expect(later.state.stats.wasted_wood).toBeGreaterThan(0);
    expect(later.events.filter((event) => event.type === 'storageFilled')).toEqual([]);
    expect(later.events.filter((event) => event.type === 'storageWasted').length).toBe(1);

    // E o que já estava lá paga o Armazém, que nenhum limite de 500 deixaria juntar depois.
    const free = advanceTo(state, state.settlement.constructionQueues[0]?.finishesAtMs ?? 0).state;
    const built = applyCommand(
      free,
      command('startConstruction', { building: 'warehouse' }),
      free.lastProcessedAt,
    );
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(milli(built.state, 'wood')).toBe(milli(free, 'wood') - 160_000);
    }
  });

  it('quem já concluiu o objetivo 4 não ganha nem perde nada, e pode construir', () => {
    const fixture = named('state-v3-objectives.json');
    const before = read(fixture) as unknown as GameState;
    const state = migrated(fixture);
    expect(state.objectives).toEqual(before.objectives);
    expect(state.objectives.completed).toContain('townHallLevel2');
    // O ouro é o que a v0.1 deixou, com os +50 da recompensa antiga. A frase da recompensa é a
    // do conteúdo de hoje, que voltou a dar o ouro (ADR 0016, item 7), mas nada é creditado a
    // quem já concluiu: nem aqui, nem na linha do tempo (abaixo).
    expect(state.settlement.resources.gold).toBe(before.settlement.resources.gold);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.objectives.find((entry) => entry.id === 'townHallLevel2')).toMatchObject({
      status: 'completed',
      reward: '+50 ouro e desbloqueia o Celeiro, o Armazém e a Torre de Vigia',
    });
    // A Paliçada também nasce no nível 0, mas pede o Salão no nível 3: fica na lista, presa.
    const unbuilt = view.constructions.available.filter((entry) => entry.fromLevel === 0);
    expect(unbuilt.map((entry) => entry.building)).toEqual([
      'granary',
      'warehouse',
      'watchtower',
      'palisade',
      'tavern',
      'guild',
      'market',
    ]);
    const storage = unbuilt.filter(
      (entry) =>
        entry.building !== 'palisade' &&
        entry.building !== 'tavern' &&
        entry.building !== 'guild' &&
        entry.building !== 'market',
    );
    for (const entry of storage) {
      expect(entry.blockedCode).not.toBe('GATE_LOCKED');
    }
    // Nenhuma linha de objetivo se repete depois da migração.
    const { events } = advanceTo(state, state.lastProcessedAt + 30 * DAY_REAL);
    expect(events.filter((event) => event.type === 'objectiveCompleted')).toEqual([]);
  });

  it('quem ainda não concluiu o objetivo 4 conclui pela regra de hoje: os 50 de ouro e o desbloqueio', () => {
    const state = migrated(named('state-v3-fresh.json'));
    expect(state.objectives.completed).toEqual([]);
    const ahead = { ...state, settlement: { ...state.settlement } };
    ahead.settlement.buildings = { ...state.settlement.buildings, townHall: 2 };
    const result = applyCommand(
      ahead,
      command('setWorkers', { building: 'farm', count: 2 }),
      ahead.lastProcessedAt,
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.objectives.completed).toEqual(['allocateFarmers', 'townHallLevel2']);
      // Os +20 do primeiro objetivo e os +50 do quarto (ADR 0016, item 7).
      expect(result.state.settlement.resources.gold).toBe(state.settlement.resources.gold + 70_000);
    }
  });

  it('partida no frio ou na fome continua no frio ou na fome, com o estoque que tinha', () => {
    for (const name of ['state-v3-cold.json', 'state-v3-famine.json']) {
      const before = read(named(name)) as unknown as GameState;
      const after = migrated(named(name));
      expect(after.settlement.cold, name).toEqual(before.settlement.cold);
      expect(after.settlement.famine?.sinceMs, name).toBe(before.settlement.famine?.sinceMs);
      expect(after.settlement.recruitmentQueue, name).toEqual(before.settlement.recruitmentQueue);
    }
  });
});

describe('versão 4 → 5', () => {
  const version4 = fixtures.filter((fixture) => fixture.version === 4);
  const autoStarts = (events: Array<{ type: string }>) =>
    events.filter((event) => event.type === 'constructionAutoStarted');
  // Só até a versão 5: o que as filas mudaram, sem o que as versões seguintes acrescentaram.
  const queues: MigrationChain = { steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5], shape: stateV5 };

  it.each(version4)(
    '$name: só acrescenta a segunda fila, vazia, e marca as planejadas como manuais',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        queues,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(5);
      // A obra em curso continua onde estava, e a segunda fila nasce livre.
      expect(before.settlement.constructionQueues).toHaveLength(1);
      expect(after.settlement.constructionQueues).toStrictEqual([
        ...before.settlement.constructionQueues,
        null,
      ]);
      // As planejadas ficam na mesma ordem, com o mesmo nível, todas manuais (ADR 0013, decisão 4).
      expect(after.settlement.planned).toStrictEqual(
        before.settlement.planned.map((plan) => ({ ...plan, autoStart: false })),
      );
      // O resto é o estado antigo, campo por campo.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        constructionQueues: after.settlement.constructionQueues,
        planned: after.settlement.planned,
      });
      expect({ ...after, schemaVersion: 4, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version4)(
    '$name: nenhuma obra começa sozinha por causa da migração, nem na fronteira nem depois',
    (fixture) => {
      const state = migrated(fixture);
      expect(autoStarts(advanceTo(state, state.lastProcessedAt + 1).events)).toEqual([]);
      const month = advanceTo(state, state.lastProcessedAt + 30 * DAY_REAL);
      expect(autoStarts(month.events)).toEqual([]);
      // As planejadas continuam na lista, esperando a ordem.
      expect(month.state.settlement.planned).toEqual(state.settlement.planned);
    },
  );

  it('quem já tinha o Salão no nível 4 ganha a segunda fila na fronteira, e a usa quando quiser', () => {
    // O feudo que veio da v0.1: Salão 4, a Serraria em obra, a Fazenda planejada e estoque de sobra.
    const state = migrated(named('state-v4-migrated-3x.json'));
    expect(state.settlement.buildings.townHall).toBe(4);
    expect(state.settlement.constructionQueues.map((slot) => slot?.building ?? null)).toEqual([
      'lumberMill',
      null,
    ]);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.constructions.queuesUnlocked).toBe(2);
    expect(view.constructions.queues.map((entry) => entry?.building ?? null)).toEqual([
      'lumberMill',
      null,
    ]);
    expect(view.constructions.queuesNote).toBeNull();
    // A planejada antiga é manual e já pode começar: não espera nada, só a ordem.
    expect(view.constructions.planned).toMatchObject([
      { building: 'farm', targetLevel: 5, autoStart: false, waiting: null },
    ]);

    // A ordem do jogador põe a Fazenda na segunda fila, com a Serraria ainda em obra.
    const started = applyCommand(
      state,
      command('startConstruction', { building: 'farm' }),
      state.lastProcessedAt,
    );
    expect(started.ok).toBe(true);
    if (started.ok) {
      expect(
        started.state.settlement.constructionQueues.map((slot) => slot?.building ?? null),
      ).toEqual(['lumberMill', 'farm']);
      expect(started.events.map((event) => event.type)).toEqual(['constructionStarted']);
    }
  });

  it('marcar a planejada antiga como automática é uma ordem do jogador, e vale na hora', () => {
    const state = migrated(named('state-v4-migrated-3x.json'));
    const marked = applyCommand(
      state,
      command('setAutoStart', { building: 'farm', autoStart: true }),
      state.lastProcessedAt,
    );
    expect(marked.ok).toBe(true);
    if (marked.ok) {
      // Havia recurso e fila: a obra começa no instante da ordem, e sai da lista.
      expect(marked.events.map((event) => event.type)).toEqual(['constructionAutoStarted']);
      expect(marked.state.settlement.planned).toEqual([]);
      expect(marked.state.settlement.constructionQueues[1]?.building).toBe('farm');
    }
  });

  it('com o Salão abaixo do nível 4 a segunda fila existe no estado, fechada', () => {
    const state = migrated(named('state-v4-construction.json'));
    expect(state.settlement.constructionQueues).toHaveLength(2);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.constructions.queuesUnlocked).toBe(1);
    expect(view.constructions.queues).toHaveLength(1);
    expect(view.constructions.queuesNote).toBe('A segunda fila abre com o Salão do Senhor Nv4.');
    const refused = applyCommand(
      state,
      command('startConstruction', { building: 'farm' }),
      state.lastProcessedAt,
    );
    expect(refused).toMatchObject({ ok: false, code: 'QUEUE_LOCKED' });
    // A obra em curso termina na hora marcada, como antes.
    const { events } = advanceTo(state, 4 * MINUTE);
    expect(
      events.filter((event) => event.type === 'constructionFinished').map((event) => event.atMs),
    ).toEqual([4 * MINUTE]);
  });
});

describe('versão 5 → 6', () => {
  const version5 = fixtures.filter((fixture) => fixture.version === 5);
  const NOBODY = { farm: 0, lumberMill: 0, quarry: 0, goldMine: 0 };
  // Só até a versão 6: o que o ofício mudou, sem o que as versões seguintes acrescentaram.
  const crafts: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6],
    shape: stateV6,
  };

  it.each(version5)(
    '$name: só acrescenta a experiência em zero e a lista de adaptação vazia',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        crafts,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(6);
      expect(after.settlement.craftExperience).toStrictEqual(NOBODY);
      expect(after.settlement.craftMasteredYear).toStrictEqual(NOBODY);
      // Todo mundo que já trabalha é adaptado (ADR 0013, decisão 4).
      expect(after.settlement.adaptation).toStrictEqual([]);
      // O resto é o estado antigo, campo por campo: ninguém sai do lugar.
      expect(after.settlement).toStrictEqual({
        ...before.settlement,
        craftExperience: NOBODY,
        craftMasteredYear: NOBODY,
        adaptation: [],
      });
      expect({ ...after, schemaVersion: 5, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version5)(
    '$name: ninguém passa a render metade, e nada acontece na fronteira',
    (fixture) => {
      const state = migrated(fixture);
      const view = deriveViewState(state, state.lastProcessedAt);
      for (const row of view.workers) {
        expect(row).toMatchObject({ adapting: 0, adaptationEndsInSeconds: null, experience: 0 });
        // A taxa na fronteira é a de antes: trabalhadores inteiros, sem mestria.
        expect(row.grossPerHour).toBeCloseTo(row.assigned * row.perWorkerPerHour, 9);
        expect(row.breakdown).not.toContain('adaptação');
        expect(row.breakdown).not.toContain('mestria');
      }
      const { events } = advanceTo(state, state.lastProcessedAt + 1);
      expect(events.filter((event) => event.type === 'craftMastered')).toEqual([]);
    },
  );

  it('a experiência começa a contar na primeira virada de dia depois da fronteira', () => {
    // O feudo que veio da v0.1, com gente em todos os ofícios e parado no meio de um dia.
    const state = migrated(named('state-v5-migrated-3x.json'));
    const dayMs = 2 * HOUR;
    const nextDay = (Math.floor(state.lastProcessedAt / dayMs) + 1) * dayMs;
    const before = advanceTo(state, nextDay - 1).state;
    expect(before.settlement.craftExperience).toStrictEqual(NOBODY);
    const after = advanceTo(state, nextDay).state;
    // Ganha 4 quem tem ao menos um trabalhador por nível; os outros ficam onde estão.
    for (const building of ['farm', 'lumberMill', 'quarry', 'goldMine'] as const) {
      const occupied = state.settlement.workers[building] >= state.settlement.buildings[building];
      expect(after.settlement.craftExperience[building], building).toBe(occupied ? 4 : 0);
    }
    expect(Object.values(after.settlement.craftExperience).some((value) => value > 0)).toBe(true);
  });

  it('as trocas feitas depois da fronteira custam como em qualquer partida', () => {
    const state = migrated(named('state-v5-migrated-3x.json'));
    const { villagers } = state.settlement.population;
    const free =
      villagers - Object.values(state.settlement.workers).reduce((sum, count) => sum + count, 0);
    expect(free).toBeGreaterThan(0);
    const moved = applyCommand(
      state,
      command('setWorkers', { building: 'quarry', count: state.settlement.workers.quarry + 1 }),
      state.lastProcessedAt,
    );
    expect(moved.ok).toBe(true);
    if (moved.ok) {
      expect(moved.state.settlement.adaptation).toEqual([
        { building: 'quarry', count: 1, untilMs: state.lastProcessedAt + 2 * HOUR },
      ]);
      // No ritmo 3, o dia de jogo da adaptação são 40 minutos reais.
      const view = deriveViewState(moved.state, state.lastProcessedAt);
      expect(view.workers.find((row) => row.building === 'quarry')).toMatchObject({
        adapting: 1,
        adaptationEndsInSeconds: 40 * 60,
      });
    }
  });
});

describe('versão 6 → 7', () => {
  const version6 = fixtures.filter((fixture) => fixture.version === 6);
  const DAY = 2 * HOUR;
  const nextDay = (state: GameState) => (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;
  const moraleTypes = ['moraleBandChanged', 'villagerArrived', 'villagerLeft', 'villagerDeserted'];
  // Só até a versão 7: o que a moral mudou, sem o que as versões seguintes acrescentaram.
  const morale: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7],
    shape: stateV7,
  };

  it.each(version6)('$name: só acrescenta a moral em 50 e a lista de efeitos vazia', (fixture) => {
    const before = read(fixture) as unknown as GameState;
    const after = migrateWith(
      read(fixture),
      { timeScale: fixture.timeScale },
      morale,
    ) as unknown as GameState;
    expect(after.schemaVersion).toBe(7);
    expect(after.settlement.morale).toBe(50);
    expect(after.settlement.moraleEffects).toStrictEqual([]);
    // O resto é o estado antigo, campo por campo: nenhum aldeão, estoque ou prazo muda.
    expect(after.settlement).toStrictEqual({
      ...before.settlement,
      morale: 50,
      moraleEffects: [],
    });
    expect({ ...after, schemaVersion: 6, settlement: before.settlement }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it.each(version6)(
    '$name: a produção de ninguém muda na fronteira, e nada acontece nela',
    (fixture) => {
      const state = migrated(fixture);
      const view = deriveViewState(state, state.lastProcessedAt);
      // Com 50 o fator da moral é × 1: a taxa é a que a versão anterior deixou.
      expect(view.morale).toMatchObject({ value: 50, band: 'content', multiplierPercent: 100 });
      for (const row of view.workers) {
        expect(row.breakdown).not.toContain('moral');
      }
      // Um instante depois da fronteira: nenhuma linha de moral, nenhum sorteio, ninguém a menos.
      const { state: after, events } = advanceTo(state, state.lastProcessedAt + 1);
      expect(events.filter((event) => moraleTypes.includes(event.type))).toEqual([]);
      expect(after.rng).toEqual(state.rng);
      expect(after.settlement.morale).toBe(50);
      expect(after.settlement.population).toEqual(state.settlement.population);
    },
  );

  it.each(version6)(
    '$name: a moral é recalculada na primeira virada de dia depois da fronteira',
    (fixture) => {
      const state = migrated(fixture);
      const turn = nextDay(state);
      expect(advanceTo(state, turn - 1).state.settlement.morale).toBe(50);
      // A visão diz antes para onde a moral vai, e a virada confirma.
      const promised = deriveViewState(state, turn - 1).morale.next.value;
      expect(advanceTo(state, turn).state.settlement.morale).toBe(promised);
    },
  );

  it('uma partida bem cuidada sobe para 60 na primeira virada: a comida guardada já estava lá', () => {
    // O feudo que veio da v0.1, no ritmo da produção, com estoque alto.
    const state = migrated(named('state-v6-migrated-3x.json'));
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.morale.terms.map((term) => term.id)).toContain('foodReserve');
    expect(view.morale.terms.map((term) => term.id)).not.toContain('famine');
    const after = advanceTo(state, nextDay(state));
    expect(after.state.settlement.morale).toBe(view.morale.next.value);
    expect(after.state.settlement.morale).toBeGreaterThanOrEqual(50);
  });

  it('fome antiga: o prazo da deserção conta de quando ela começou, e ninguém deserta antes da primeira virada', () => {
    // A partida foi encontrada com fome há mais de 12 h de jogo. Nas regras antigas ninguém
    // desertava; nas novas, o primeiro aldeão vai embora na primeira virada depois da fronteira.
    const state = migrated(named('state-v6-famine.json'));
    const { famine, population } = state.settlement;
    expect(famine).not.toBeNull();
    expect(state.lastProcessedAt - (famine?.sinceMs ?? 0)).toBeGreaterThan(12 * HOUR);
    const turn = nextDay(state);
    const before = advanceTo(state, turn - 1);
    expect(before.events.filter((event) => moraleTypes.includes(event.type))).toEqual([]);
    expect(before.state.settlement.population).toEqual(population);
    const { state: after, events } = advanceTo(state, turn);
    const deserted = events.filter((event) => event.type === 'villagerDeserted');
    expect(deserted.map((event) => event.atMs)).toEqual([turn]);
    expect(after.settlement.population.villagers).toBeLessThan(population.villagers);
    // E a divisão de intervalo continua exata a partir da fronteira, com sorteios no caminho.
    const end = turn + 40 * DAY;
    const direct = advanceTo(state, end);
    const first = advanceTo(state, turn + 7 * HOUR + 13);
    const second = advanceTo(first.state, end);
    expect(second.state).toStrictEqual(direct.state);
    expect([...first.events, ...second.events]).toStrictEqual(direct.events);
  });

  it('em Camponês a fome antiga não faz ninguém desertar', () => {
    const stored = read(named('state-v6-famine.json')) as Draft;
    stored.settings.difficulty = 'peasant';
    const state = migrateState(stored, { timeScale: 1 });
    const { events } = advanceTo(state, nextDay(state) + 10 * DAY);
    expect(events.filter((event) => event.type === 'villagerDeserted')).toEqual([]);
  });
});

describe('versão 7 → 8', () => {
  const version7 = fixtures.filter((fixture) => fixture.version === 7);
  const DAY = 2 * HOUR;
  const INTERVAL = 4 * DAY;
  const cardTypes = ['cardDrawn', 'cardAnswered', 'cardExpired', 'cardEffectApplied'];
  /** A primeira virada de dia a partir de `fronteira + intervalo`. */
  const firstAudience = (boundaryMs: number) => Math.ceil((boundaryMs + INTERVAL) / DAY) * DAY;

  // Só até a versão 8: o que o Conselho mudou, sem o que as versões seguintes acrescentaram.
  const council: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7, v7ToV8],
    shape: stateV8,
  };

  it('a cadência escrita no passo é a do conteúdo de hoje', () => {
    expect(INTERVAL).toBe(balance.council.drawIntervalDays * balance.calendar.dayMs);
    expect(DAY).toBe(balance.calendar.dayMs);
    // Uma partida encontrada no instante zero recebe a mesma primeira audiência de uma nova.
    const fresh = migrated(named('state-v7-fresh.json'));
    expect(fresh.council).toEqual(newGame().council);
  });

  it.each(version7)('$name: só acrescenta o Conselho, vazio', (fixture) => {
    const before = read(fixture) as unknown as GameState;
    const after = migrateWith(
      read(fixture),
      { timeScale: fixture.timeScale },
      council,
    ) as unknown as GameState;
    expect(after.schemaVersion).toBe(8);
    expect(after.council).toStrictEqual({
      pending: [],
      flags: {},
      seenThisYear: [],
      nextDrawAtMs: firstAudience(before.lastProcessedAt),
      scheduled: [],
      delayed: [],
      expired: [],
    });
    // O resto é o estado antigo, campo por campo: nenhum estoque, prazo ou sorteio muda.
    const rest: Partial<GameState> = { ...after };
    delete rest.council;
    expect({ ...rest, schemaVersion: 7 }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it.each(version7)(
    '$name: a primeira carta conta a partir da fronteira, e cai em uma virada de dia',
    (fixture) => {
      const state = migrated(fixture);
      const boundary = state.lastProcessedAt;
      const { nextDrawAtMs } = state.council;
      expect(nextDrawAtMs % DAY).toBe(0);
      // Nunca antes de um intervalo inteiro, nunca mais de um dia de jogo depois dele.
      expect(nextDrawAtMs).toBeGreaterThanOrEqual(boundary + INTERVAL);
      expect(nextDrawAtMs).toBeLessThan(boundary + INTERVAL + DAY);

      // Nada do Conselho acontece na fronteira nem antes da primeira audiência.
      const atBoundary = advanceTo(state, boundary + 1);
      expect(atBoundary.events.filter((event) => cardTypes.includes(event.type))).toEqual([]);
      expect(atBoundary.state.rng).toEqual(state.rng);
      const before = advanceTo(state, nextDrawAtMs - 1);
      expect(before.events.filter((event) => cardTypes.includes(event.type))).toEqual([]);
      expect(before.state.rng.council).toBeUndefined();

      // Na primeira audiência chega a primeira carta (há sempre uma avulsa sem requisito), e a
      // cadência segue de intervalo em intervalo.
      const { state: after, events } = advanceTo(state, nextDrawAtMs);
      const drawn = events.filter((event) => event.type === 'cardDrawn');
      expect(drawn.map((event) => event.atMs)).toEqual([nextDrawAtMs]);
      expect(after.council.pending).toHaveLength(1);
      expect(after.council.nextDrawAtMs).toBe(nextDrawAtMs + INTERVAL);
      // O prazo de resposta são 24 h reais no ritmo da partida.
      expect(after.council.pending[0]?.expiresAtMs).toBe(
        nextDrawAtMs + 24 * HOUR * state.settings.timeScale,
      );
    },
  );

  it('uma ausência longa antes da migração não gera carta nenhuma', () => {
    // O feudo do bot, encontrado no ano 4: a ausência inteira foi simulada sem o Conselho.
    const state = migrated(named('state-v7-migrated-3x.json'));
    expect(state.clock.year).toBeGreaterThan(1);
    expect(state.stats.cardsDrawn).toBeUndefined();
    expect(state.council.seenThisYear).toEqual([]);
  });

  it('partida sem fronteira e partida migrada há tempos: o prazo fica depois de onde ela está', () => {
    // Nascida na versão 7, no ano 3, sem fronteira; e migrada da v0.1, com a fronteira antiga
    // bem atrás. Nas duas a primeira audiência conta do instante desta migração.
    for (const name of ['state-v7-peasant-3x.json', 'state-v7-migrated-3x.json']) {
      const before = read(named(name)) as unknown as GameState;
      const after = migrated(named(name));
      expect(after.migratedAtMs).toBe(before.lastProcessedAt);
      expect(after.council.nextDrawAtMs).toBe(firstAudience(before.lastProcessedAt));
      expect(after.council.nextDrawAtMs).toBeGreaterThan(after.lastProcessedAt);
    }
    expect(
      (read(named('state-v7-peasant-3x.json')) as unknown as GameState).migratedAtMs,
    ).toBeNull();
    const old = read(named('state-v7-migrated-3x.json')) as unknown as GameState;
    expect(old.migratedAtMs ?? 0).toBeLessThan(old.lastProcessedAt - DAY);
  });

  it('a visão de uma partida recém-migrada diz quando vem a primeira carta', () => {
    const state = migrated(named('state-v7-migrated-3x.json'));
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.council.pending).toEqual([]);
    expect(view.pendingDecisions).toEqual([]);
    // No ritmo 3, a cadência de 4 dias de jogo são 2 h 40 min reais; a primeira audiência vem
    // entre isso e mais um dia de jogo (40 min).
    expect(view.council.nextCardInSeconds).toBeGreaterThanOrEqual(9600);
    expect(view.council.nextCardInSeconds).toBeLessThan(9600 + 2400);
  });
});

describe('versão 8 → 9', () => {
  const version8 = fixtures.filter((fixture) => fixture.version === 8);
  const DAY = 2 * HOUR;
  const nextDay = (state: GameState) => (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;

  // Só até a versão 9: o que a Ameaça mudou, sem o que as versões seguintes acrescentaram.
  const threat: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7, v7ToV8, v8ToV9],
    shape: stateV9,
  };

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v8-fresh.json'));
    expect(fresh.map).toEqual(newGame().map);
    expect(fresh.horde).toEqual(newGame().horde);
    expect(fresh.settlement.buildings).toEqual(newGame().settlement.buildings);
    expect(Object.keys(fresh.settlement.buildings)).toEqual([...BUILDING_IDS]);
  });

  it.each(version8)(
    '$name: só acrescenta a Torre no nível 0, o covil ativo, a Ameaça em zero e nenhuma incursão',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        threat,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(9);
      expect(after.map).toStrictEqual({
        tiles: { wolfDen: { type: 'wolfDen', threatActive: true } },
        threat: 0,
      });
      expect(after.horde).toStrictEqual({ scheduledRaids: [] });
      expect(after.settlement.buildings).toStrictEqual({
        ...before.settlement.buildings,
        watchtower: 0,
      });
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo ou sorteio muda.
      const rest: Partial<GameState> = { ...after };
      delete rest.map;
      delete rest.horde;
      expect({ ...rest, schemaVersion: 8, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
      expect({ ...after.settlement, buildings: before.settlement.buildings }).toStrictEqual(
        before.settlement,
      );
    },
  );

  it.each(version8)(
    '$name: a Ameaça conta a partir da fronteira e sobe na primeira virada de dia depois dela',
    (fixture) => {
      const state = migrated(fixture);
      const turn = nextDay(state);
      // Nada acontece na fronteira: nenhuma linha, nenhum sorteio, a Ameaça parada em zero.
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type === 'threatRose')).toEqual([]);
      expect(atBoundary.state.rng).toEqual(state.rng);
      expect(advanceTo(state, turn - 1).state.map.threat).toBe(0);
      // Na primeira virada sobe o que a visão de quem tivesse a Torre prometeria: o covil, e o
      // outono, se o dia que acaba é de outono.
      const first = advanceTo(state, turn).state.map.threat;
      expect([2, 5]).toContain(first);
      expect(advanceTo(state, turn + DAY).state.map.threat).toBeGreaterThan(first);
    },
  );

  it('uma ausência longa antes da migração não soma Ameaça nenhuma', () => {
    // O feudo do bot, encontrado no ano 4: a ausência inteira foi simulada sem a Ameaça.
    const state = migrated(named('state-v8-migrated-3x.json'));
    expect(state.clock.year).toBeGreaterThan(1);
    expect(state.map.threat).toBe(0);
    expect(state.horde.scheduledRaids).toEqual([]);
  });

  it('a visão de uma partida recém-migrada não mostra a Ameaça: ninguém tinha a Torre', () => {
    for (const fixture of version8) {
      const state = migrated(fixture);
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.threat.known, fixture.name).toBe(false);
      expect(view.threat.incoming).toBeNull();
      expect(view.threat.watchtower.level).toBe(0);
    }
  });

  it('quem já tinha o Salão no nível 2 pode erguer a Torre logo depois da migração', () => {
    const state = migrated(named('state-v8-week-scripted.json'));
    expect(state.settlement.buildings.townHall).toBeGreaterThanOrEqual(2);
    const tower = deriveViewState(state, state.lastProcessedAt).constructions.available.find(
      (entry) => entry.building === 'watchtower',
    );
    expect(tower).toMatchObject({ fromLevel: 0, targetLevel: 1 });
    expect(tower?.blockedCode).not.toBe('GATE_LOCKED');
  });

  it('quem ergue a Torre depois da migração vê a Ameaça que subiu desde a fronteira', () => {
    const migratedState = migrated(named('state-v8-fresh.json'));
    const rich = JSON.parse(JSON.stringify(migratedState)) as GameState;
    rich.settlement.buildings.townHall = 2;
    rich.settlement.resources = { food: 400_000, wood: 400_000, stone: 400_000, gold: 400_000 };
    const started = applyCommand(rich, command('startConstruction', { building: 'watchtower' }), 0);
    expect(started.ok).toBe(true);
    if (!started.ok) {
      return;
    }
    const view = deriveViewState(started.state, 3 * DAY + 5 * MINUTE);
    expect(view.threat).toMatchObject({ known: true, level: 6, nextLevel: 8 });
  });
});

describe('versão 9 → 10', () => {
  const version9 = fixtures.filter((fixture) => fixture.version === 9);
  // Só até a versão 10: o que a Paliçada mudou, sem o que as versões seguintes acrescentaram.
  const palisade: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7, v7ToV8, v8ToV9, v9ToV10],
    shape: stateV10,
  };
  const palisadeOf = (state: GameState) =>
    deriveViewState(state, state.lastProcessedAt).constructions.available.find(
      (entry) => entry.building === 'palisade',
    );

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v9-fresh.json'));
    expect(fresh.settlement.buildings).toEqual(newGame().settlement.buildings);
    expect(Object.keys(fresh.settlement.buildings)).toEqual([...BUILDING_IDS]);
    expect(fresh.settlement.buildings.palisade).toBe(0);
  });

  it.each(version9)('$name: só acrescenta a Paliçada, no nível 0', (fixture) => {
    const before = read(fixture) as unknown as GameState;
    const after = migrateWith(
      read(fixture),
      { timeScale: fixture.timeScale },
      palisade,
    ) as unknown as GameState;
    expect(after.schemaVersion).toBe(10);
    expect(after.settlement.buildings).toStrictEqual({
      ...before.settlement.buildings,
      palisade: 0,
    });
    // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, carta ou sorteio muda.
    expect({ ...after, schemaVersion: 9, settlement: before.settlement }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
    expect({ ...after.settlement, buildings: before.settlement.buildings }).toStrictEqual(
      before.settlement,
    );
  });

  it.each(version9)(
    '$name: nada acontece na fronteira, e a visão diz que não há Paliçada',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      expect(atBoundary.state.rng).toEqual(state.rng);
      expect(atBoundary.state.council).toEqual(state.council);
      const { defense } = deriveViewState(state, state.lastProcessedAt).threat;
      expect(defense).toEqual({
        building: 'palisade',
        palisadeLevel: 0,
        text: 'Sem Paliçada, nada segura um ataque.',
        next: 'Paliçada Nv1: segura ataques leves, sem perda nem ferido; os médios passam, mas com metade do estrago.',
      });
    },
  );

  it('quem já tinha o Salão no nível 3 pode erguer a Paliçada logo depois da migração; quem não tinha vê o que falta', () => {
    const ready = migrated(named('state-v9-week-scripted.json'));
    expect(ready.settlement.buildings.townHall).toBeGreaterThanOrEqual(3);
    expect(palisadeOf(ready)).toMatchObject({ fromLevel: 0, targetLevel: 1 });
    expect(palisadeOf(ready)?.blockedCode).not.toBe('GATE_LOCKED');
    const rich = JSON.parse(JSON.stringify(ready)) as GameState;
    rich.settlement.resources.wood = 400_000;
    rich.settlement.resources.stone = 400_000;
    rich.settlement.constructionQueues = [null, null];
    const started = applyCommand(
      rich,
      command('startConstruction', { building: 'palisade' }),
      rich.lastProcessedAt,
    );
    expect(started.ok).toBe(true);

    const early = migrated(named('state-v9-objectives.json'));
    expect(early.settlement.buildings.townHall).toBe(2);
    expect(palisadeOf(early)).toMatchObject({
      blockedCode: 'GATE_LOCKED',
      blockedReason: 'Melhore antes o Salão do Senhor para o nível 3.',
    });
  });

  it('a Torre que a partida já tinha continua vendo, e a Paliçada entra no painel dela', () => {
    const state = migrated(named('state-v9-threat.json'));
    const { threat } = deriveViewState(state, state.lastProcessedAt);
    expect(threat).toMatchObject({ known: true, level: 45 });
    expect(threat.defense.palisadeLevel).toBe(0);
  });

  it('o pedido dos aldeões só chega na audiência que já estava marcada, e só a quem tem o Salão no nível 3', () => {
    for (const fixture of version9) {
      const before = read(fixture) as unknown as GameState;
      const state = migrated(fixture);
      // O passo não mexe no Conselho: a cadência, a mesa e as flags são as que estavam.
      expect(state.council, fixture.name).toStrictEqual(before.council);
      expect(Object.keys(state.council.flags).join()).not.toContain('palisadePromise');
    }
    const ready = migrated(named('state-v9-migrated-3x.json'));
    const early = migrated(named('state-v9-fresh.json'));
    const eligible = (state: GameState) =>
      eligibleCards(state, state.council.nextDrawAtMs, CATALOG).map((entry) => entry.id);
    expect(ready.settlement.buildings.townHall).toBeGreaterThanOrEqual(3);
    expect(eligible(ready)).toContain('palisadePromisePlea');
    expect(eligible(early)).not.toContain('palisadePromisePlea');
  });
});

describe('versão 10 → 11', () => {
  const version10 = fixtures.filter((fixture) => fixture.version === 10);
  const DAY = 2 * HOUR;
  /** O instante da incursão do roteiro: o início do 16º dia de jogo do ano 1. */
  const WOLVES_AT = 15 * DAY;
  const HOWL_AT = 9 * DAY;
  const WOLVES = {
    id: 'wolvesYear1',
    atMs: WOLVES_AT,
    kind: 'scripted',
    enemy: 'wolves',
    size: 'light',
    announcedAtMs: null,
  };
  const raidEvents = (events: GameEvent[]) =>
    events.filter((event) => /^(raid|wolves|villager(Injured|Recovered))/.test(event.type));
  // Só até a versão 11: o que as incursões mudaram, sem o que as versões seguintes acrescentaram.
  const raids: MigrationChain = {
    steps: [v1ToV2, v2ToV3, v3ToV4, v4ToV5, v5ToV6, v6ToV7, v7ToV8, v8ToV9, v9ToV10, v10ToV11],
    shape: stateV11,
  };

  /** Um estado como a versão 10 o gravava, a partir de um da versão atual. */
  function asVersion10(state: GameState): Draft {
    const old = asVersion11(state);
    old.schemaVersion = 10;
    delete old.settlement.injured;
    old.horde.scheduledRaids = [];
    return old;
  }

  it('o que o passo escreve é o que uma partida nova tem, e a incursão dele é a do conteúdo', () => {
    const fresh = migrated(named('state-v10-fresh.json'));
    expect(fresh.horde).toEqual(newGame().horde);
    expect(fresh.settlement.injured).toEqual(newGame().settlement.injured);
    expect(fresh.horde.scheduledRaids).toEqual([WOLVES]);
    // O número escrito no passo coincide com o do conteúdo de hoje.
    expect(scriptedRaidsAfter(0)).toEqual([WOLVES]);
    expect(balance.raids.scripted).toHaveLength(1);
  });

  it.each(version10)(
    '$name: só acrescenta os feridos, vazios, e os lobos do roteiro para quem ainda não passou deles',
    (fixture) => {
      const before = read(fixture) as unknown as GameState;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        raids,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(11);
      expect(after.settlement.injured).toStrictEqual([]);
      expect(after.horde).toStrictEqual({
        scheduledRaids: before.lastProcessedAt < WOLVES_AT ? [WOLVES] : [],
      });
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, carta ou sorteio muda.
      expect({
        ...after,
        schemaVersion: 10,
        settlement: before.settlement,
        horde: before.horde,
      }).toStrictEqual({ ...before, migratedAtMs: before.lastProcessedAt });
      const settlement: Partial<GameState['settlement']> = { ...after.settlement };
      delete settlement.injured;
      expect(settlement).toStrictEqual(before.settlement);
    },
  );

  it('os retratos cobrem os dois lados: quem ainda vai receber os lobos e quem já passou deles', () => {
    const receives = version10
      .filter((fixture) => migrated(fixture).horde.scheduledRaids.length > 0)
      .map((fixture) => fixture.name);
    expect(receives).toEqual([
      'state-v10-construction.json',
      'state-v10-council-hidden.json',
      'state-v10-fresh.json',
      'state-v10-iron-king-half.json',
      'state-v10-objectives.json',
      'state-v10-palisade.json',
      'state-v10-queues.json',
      'state-v10-threat.json',
    ]);
    expect(receives.length).toBeLessThan(version10.length);
  });

  it.each(version10)(
    '$name: nada acontece na fronteira: nenhum evento, nenhum sorteio, ninguém ferido',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      expect(atBoundary.state.rng).toEqual(state.rng);
      expect(atBoundary.state.settlement.injured).toEqual([]);
      expect(atBoundary.state.horde).toEqual(state.horde);
      // A visão diz zero feridos, e a Ameaça continua fechada ou aberta como estava.
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.population).toMatchObject({ injured: 0, injuredNote: null });
    },
  );

  it('quem migra antes dos uivos ouve os uivos e recebe os lobos, nos instantes do roteiro', () => {
    const state = migrated(named('state-v10-fresh.json'));
    const { events } = advanceTo(state, WOLVES_AT);
    expect(raidEvents(events).map((event) => [event.type, event.atMs])).toEqual([
      ['wolvesHowl', HOWL_AT],
      ['raidSuffered', WOLVES_AT],
      // Ninguém tinha ofício: quem se fere é um aldeão sem ofício.
      ['villagerInjured', WOLVES_AT],
    ]);
  });

  it('quem migra entre os uivos e os lobos recebe os lobos, sem os uivos: o dia deles já passou', () => {
    // O retrato da Ameaça parou no 10º dia de jogo, 23 minutos depois dos uivos.
    const fixture = named('state-v10-threat.json');
    const state = migrated(fixture);
    expect(state.lastProcessedAt).toBeGreaterThan(HOWL_AT);
    expect(state.lastProcessedAt).toBeLessThan(WOLVES_AT);
    const { events } = advanceTo(state, WOLVES_AT);
    expect(raidEvents(events).map((event) => event.type)).toEqual([
      // A Torre do retrato (nível 1) avisa uma hora antes.
      'raidAnnounced',
      'raidSuffered',
      'villagerInjured',
    ]);
    expect(events.filter((event) => event.type === 'wolvesHowl')).toEqual([]);
  });

  it('quem migra no instante exato dos lobos, ou depois, não os recebe: o instante já passou', () => {
    const at = (boundary: number) =>
      migrateState(asVersion10(gameAt(boundary)), { timeScale: 1 }).horde.scheduledRaids;
    expect(at(WOLVES_AT - 1)).toEqual([WOLVES]);
    expect(at(WOLVES_AT)).toEqual([]);
    expect(at(WOLVES_AT + 1)).toEqual([]);
    expect(at(84 * DAY + 3 * DAY)).toEqual([]);
    // Uma ausência longa antes da migração não vira incursão nenhuma.
    for (const name of ['state-v10-migrated-3x.json', 'state-v10-peasant-3x.json']) {
      const state = migrated(named(name));
      expect(state.clock.year, name).toBeGreaterThan(1);
      expect(state.horde.scheduledRaids, name).toEqual([]);
      expect(raidEvents(advanceTo(state, state.lastProcessedAt + DAY - 1).events)).toEqual([]);
    }
  });

  it('as incursões por Ameaça contam da fronteira: a primeira só pode ser sorteada na virada seguinte e chega 6 h de jogo depois', () => {
    // O cenário de 7 dias, encontrado no ano 2 com a Ameaça em 100: a ausência anterior foi
    // simulada sem incursões, e nenhuma delas volta agora.
    const state = migrated(named('state-v10-week-scripted.json'));
    expect(state.map.threat).toBe(100);
    expect(state.rng.horde).toBeUndefined();
    const firstTurn = (Math.floor(state.lastProcessedAt / DAY) + 1) * DAY;
    const earliest = firstTurn + balance.threat.raidLeadMs;
    expect(raidEvents(advanceTo(state, earliest - 1).events).map((event) => event.type)).toEqual(
      // Com a Torre no nível 2 do retrato, o alarme pode soar antes de a incursão chegar.
      expect.not.arrayContaining(['raidSuffered', 'raidRepelled']),
    );
    const { state: later, events } = advanceTo(state, state.lastProcessedAt + 30 * DAY);
    const resolved = events.filter(
      (event) => event.type === 'raidSuffered' || event.type === 'raidRepelled',
    );
    expect(resolved.length).toBeGreaterThan(0);
    for (const event of resolved) {
      expect(event.atMs).toBeGreaterThanOrEqual(earliest);
    }
    expect(later.rng.horde).toHaveLength(4);
  });

  it('uma incursão que o estado antigo já trouxesse marcada fica onde está, e a lista continua em ordem', () => {
    const old = asVersion10(gameAt(3 * DAY));
    const late = { ...WOLVES, id: 'threat-9', kind: 'threat', atMs: 40 * DAY };
    const soon = { ...WOLVES, id: 'threat-8', kind: 'threat', atMs: 5 * DAY };
    old.horde.scheduledRaids = [soon, late];
    const state = migrateState(old, { timeScale: 1 });
    expect(state.horde.scheduledRaids.map((entry) => entry.id)).toEqual([
      'threat-8',
      'wolvesYear1',
      'threat-9',
    ]);
  });

  it('a fronteira dentro da antecedência da Torre: o alarme soa no primeiro avanço, na fronteira, uma vez', () => {
    // Uma partida da versão 10 com a Torre no nível 1, parada meia hora de jogo antes do
    // instante dos lobos: o passo os marca sem aviso, e quem avisa é o primeiro `advanceTo`.
    const boundary = WOLVES_AT - 30 * MINUTE;
    const old = asVersion10(
      gameAt(boundary, (draft) => {
        draft.settlement.buildings.townHall = 2;
        draft.settlement.buildings.watchtower = 1;
      }),
    );
    const state = migrateState(old, { timeScale: 1 });
    expect(state.horde.scheduledRaids).toEqual([WOLVES]);
    expect(state.migratedAtMs).toBe(boundary);
    // A visão já mostra os lobos a caminho, antes de qualquer avanço.
    expect(deriveViewState(state, boundary).threat.incoming).toMatchObject({ inSeconds: 1800 });
    const first = advanceTo(state, boundary + 1);
    expect(first.events.map((event) => [event.type, event.atMs])).toEqual([
      ['raidAnnounced', boundary],
    ]);
    const rest = advanceTo(first.state, WOLVES_AT);
    expect(rest.events.filter((event) => event.type === 'raidAnnounced')).toEqual([]);
    expect(raidEvents(rest.events).map((event) => event.type)).toEqual([
      'raidSuffered',
      'villagerInjured',
    ]);
    // E a divisão de intervalo continua exata a partir da fronteira.
    const direct = advanceTo(state, WOLVES_AT + 3 * DAY);
    const middle = advanceTo(state, WOLVES_AT - 7);
    const end = advanceTo(middle.state, WOLVES_AT + 3 * DAY);
    expect(end.state).toStrictEqual(direct.state);
    expect([...middle.events, ...end.events]).toStrictEqual(direct.events);
  });
});

describe('versão 11 → 12', () => {
  const version11 = fixtures.filter((fixture) => fixture.version === 11);
  // Só os passos até a fome em tempo real, sem o que as versões seguintes acrescentaram.
  const famine: MigrationChain = {
    steps: [
      v1ToV2,
      v2ToV3,
      v3ToV4,
      v4ToV5,
      v5ToV6,
      v6ToV7,
      v7ToV8,
      v8ToV9,
      v9ToV10,
      v10ToV11,
      v11ToV12,
    ],
    shape: stateV12,
  };
  const DAY = 2 * HOUR;
  const lastTurn = (ms: number) => Math.floor(ms / DAY) * DAY;
  const nextTurn = (ms: number) => lastTurn(ms) + DAY;
  const deserters = (events: GameEvent[]) =>
    eventsOfType(events, 'villagerDeserted').map((event) => event.atMs);

  /**
   * Um feudo da versão 11 em fome desde `sinceMs`, parado em `boundary`, sem lavradores nem
   * comida e com gente bastante para a deserção não bater no piso. A moral nasce em 50 e a fome
   * a derruba: quem parte pelo sorteio da moral baixa sai como `villagerLeft`, e não entra na
   * conta dos desertores.
   */
  function starvingV11(
    boundary: number,
    sinceMs: number,
    timeScale: number,
    difficulty: GameState['settings']['difficulty'] = 'lord',
  ): Draft {
    return asVersion11(
      gameAt(boundary, (draft) => {
        draft.settings.timeScale = timeScale;
        draft.settings.difficulty = difficulty;
        draft.settlement.population.villagers = 60;
        draft.settlement.workers = { farm: 0, lumberMill: 3, quarry: 0, goldMine: 0 };
        draft.settlement.resources.food = 0;
        draft.settlement.famine = famineSince(sinceMs);
      }),
    );
  }

  it('os números escritos no passo são os do conteúdo de hoje', () => {
    expect(balance.calendar.dayMs).toBe(DAY);
    expect(balance.morale.famineDesertionAfterRealMs).toBe(12 * HOUR);
    expect(balance.morale.famineDesertionEveryRealMs).toBe(2 * HOUR);
    expect(DIFFICULTY_IDS.filter((id) => balance.difficulties[id].famineDesertion)).toEqual([
      'lord',
      'ironKing',
    ]);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v11-fresh.json'));
    expect(fresh.settlement.famine).toBeNull();
    expect(fresh.settlement.lastFamine).toBeNull();
    expect(fresh.settlement).toStrictEqual(newGame('fixture-fresh').settlement);
  });

  it.each(version11)(
    '$name: só muda a fome aberta, que ganha o que já durou antes e os desertores cobrados, e acrescenta a última fome, vazia',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrateWith(
        read(fixture),
        { timeScale: fixture.timeScale },
        famine,
      ) as unknown as GameState;
      expect(after.schemaVersion).toBe(12);
      expect(after.settlement.lastFamine).toBeNull();
      if (before.settlement.famine === null) {
        expect(after.settlement.famine).toBeNull();
      } else {
        expect(after.settlement.famine).toMatchObject({
          sinceMs: before.settlement.famine.sinceMs,
          carriedMs: 0,
        });
      }
      // O resto é o estado antigo, campo por campo: nenhum aldeão, estoque, prazo ou sorteio muda.
      const settlement: Draft = { ...after.settlement };
      delete settlement.lastFamine;
      expect({ ...settlement, famine: before.settlement.famine }).toStrictEqual(before.settlement);
      expect({ ...after, schemaVersion: 11, settlement: before.settlement }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it('os retratos cobrem os dois lados: partidas sem fome e partidas em fome, nos três ritmos', () => {
    const starving = version11
      .filter((fixture) => migrated(fixture).settlement.famine !== null)
      .map((fixture) => [fixture.name, fixture.timeScale]);
    expect(starving).toEqual([
      ['state-v11-famine-3x.json', 3],
      ['state-v11-famine-half.json', 0.5],
      ['state-v11-famine.json', 1],
    ]);
  });

  it.each(version11)(
    '$name: nada acontece na fronteira: nenhum evento, nenhum sorteio, ninguém a menos',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      expect(atBoundary.state.rng).toEqual(state.rng);
      expect(atBoundary.state.settlement.population).toEqual(state.settlement.population);
      expect(atBoundary.state.settlement.famine).toEqual(state.settlement.famine);
      expect(atBoundary.state.settlement.lastFamine).toBeNull();
    },
  );

  it('a contagem com que a partida em fome entra é a que a regra nova já teria cobrado na última virada', () => {
    for (const fixture of version11) {
      const state = migrated(fixture);
      const { famine } = state.settlement;
      if (famine === null) {
        continue;
      }
      // A mesma conta do motor, feita no estado migrado, na última virada antes da fronteira.
      const owed = famineDesertionsOwedAt(state, lastTurn(state.lastProcessedAt));
      expect(famine.deserted, fixture.name).toBe(owed);
    }
    // À mão, retrato por retrato (a fome em horas de jogo na última virada antes da fronteira).
    // Normal: 14 h de fome, carência de 12 h e passo de 2 h: 2, os mesmos que a regra antiga
    // tirou do feudo (de 5 para 3 aldeões).
    expect(migrated(named('state-v11-famine.json')).settlement.famine?.deserted).toBe(2);
    // Rápido: 45 h 30 de fome, carência de 36 h e passo de 6 h: 2. A regra antiga já tinha
    // levado bem mais gente (um por virada desde as 12 h), e ninguém volta.
    expect(migrated(named('state-v11-famine-3x.json')).settlement.famine?.deserted).toBe(2);
    // Tranquilo: 6 h 20 de fome, carência de 6 h e passo de 1 h: 1. A regra antiga ainda não
    // tinha cobrado ninguém (a carência dela era de 12 h de jogo): esse fica perdoado.
    const half = read(named('state-v11-famine-half.json')) as Draft;
    expect(half.settlement.population.villagers).toBe(12);
    expect(migrated(named('state-v11-famine-half.json')).settlement.famine?.deserted).toBe(1);
  });

  it('no ritmo Normal nada muda: um desertor por virada, a começar pela primeira depois da fronteira', () => {
    // Fome há 15 h e 13 min, no meio de um dia. A regra antiga cobrou nas duas viradas com
    // 12 h ou mais; a nova conta os mesmos dois, e segue de um em um.
    const boundary = 40 * DAY + 73 * MINUTE;
    const since = boundary - (15 * HOUR + 13 * MINUTE);
    const state = migrateState(starvingV11(boundary, since, 1), { timeScale: 1 });
    expect(state.settlement.famine).toEqual({ sinceMs: since, carriedMs: 0, deserted: 2 });
    const { events } = advanceTo(state, boundary + 4 * DAY);
    expect(deserters(events)).toEqual([41 * DAY, 42 * DAY, 43 * DAY, 44 * DAY]);
  });

  it('no ritmo Normal, a fome que ainda não chegou às 12 h cobra o primeiro na mesma virada de antes', () => {
    const boundary = 40 * DAY + 73 * MINUTE;
    const since = boundary - 9 * HOUR;
    const state = migrateState(starvingV11(boundary, since, 1), { timeScale: 1 });
    expect(state.settlement.famine).toEqual({ sinceMs: since, carriedMs: 0, deserted: 0 });
    // 12 h de fome se completam 3 h depois da fronteira: a primeira virada a partir daí.
    const first = nextTurn(since + 12 * HOUR - 1);
    expect(deserters(advanceTo(state, first + 2 * DAY).events)).toEqual([
      first,
      first + DAY,
      first + 2 * DAY,
    ]);
  });

  it('no ritmo Rápido ninguém sai em bloco: quem já desertou a mais não volta, e o próximo só sai quando o prazo novo o deve', () => {
    // 20 h de jogo de fome: a regra antiga já cobrava desde as 12 h; a nova só cobra o primeiro
    // com 36 h de jogo (12 h reais), e depois um a cada 6 h de jogo (três viradas).
    const boundary = 40 * DAY + 73 * MINUTE;
    const since = boundary - 20 * HOUR;
    const state = migrateState(starvingV11(boundary, since, 3), { timeScale: 3 });
    expect(state.settlement.famine).toEqual({ sinceMs: since, carriedMs: 0, deserted: 0 });
    const first = nextTurn(since + 36 * HOUR - 1);
    const { events } = advanceTo(state, first + 6 * DAY);
    expect(deserters(events)).toEqual([first, first + 3 * DAY, first + 6 * DAY]);
    expect(first - boundary).toBeGreaterThan(15 * HOUR);
  });

  it('no ritmo Tranquilo ninguém sai em bloco: o que a regra antiga não cobrou fica perdoado, e dali em diante saem dois por virada', () => {
    // 11 h de jogo de fome: pela regra antiga ninguém tinha desertado (12 h de jogo); pela nova
    // (6 h de jogo de carência, um a cada hora) a fome já devia vários.
    const boundary = 40 * DAY + 73 * MINUTE;
    const since = boundary - 11 * HOUR;
    const stored = starvingV11(boundary, since, 0.5, 'ironKing');
    const state = migrateState(stored, { timeScale: 0.5 });
    // Na última virada antes da fronteira a fome tinha 9 h 47: (9 h 47 − 6 h) ÷ 1 h, mais um.
    expect(state.settlement.famine).toEqual({ sinceMs: since, carriedMs: 0, deserted: 4 });
    expect(state.settlement.population.villagers).toBe(60);
    const { events } = advanceTo(state, boundary + 3 * DAY);
    expect(deserters(events)).toEqual([41 * DAY, 41 * DAY, 42 * DAY, 42 * DAY, 43 * DAY, 43 * DAY]);
  });

  it('a fronteira em cima de uma virada de dia: essa virada já foi cobrada pelas regras antigas', () => {
    const boundary = 40 * DAY;
    const since = boundary - 14 * HOUR;
    const state = migrateState(starvingV11(boundary, since, 1), { timeScale: 1 });
    // 14 h de fome na própria fronteira: a virada das 12 h e a das 14 h.
    expect(state.settlement.famine?.deserted).toBe(2);
    expect(deserters(advanceTo(state, boundary + 2 * DAY).events)).toEqual([41 * DAY, 42 * DAY]);
  });

  it('a contagem sai da fronteira deste passo e do ritmo gravado no estado, não de uma fronteira antiga', () => {
    const boundary = 40 * DAY + 73 * MINUTE;
    const stored = starvingV11(boundary, boundary - 20 * HOUR, 1);
    // Uma migração anterior a encontrou muito antes: se a conta partisse dali, daria zero.
    stored.migratedAtMs = 3 * DAY;
    const state = migrateState(stored, { timeScale: 1 });
    expect(state.migratedAtMs).toBe(boundary);
    // 18 h 47 de fome na última virada: (18 h 47 − 12 h) ÷ 2 h, mais um.
    expect(state.settlement.famine?.deserted).toBe(4);
    const born = starvingV11(boundary, boundary - 20 * HOUR, 1);
    born.migratedAtMs = null;
    expect(migrateState(born, { timeScale: 1 }).settlement.famine?.deserted).toBe(4);
  });

  it('em Camponês a partida em fome entra sem ninguém cobrado, e ninguém deserta', () => {
    const boundary = 40 * DAY + 73 * MINUTE;
    const stored = starvingV11(boundary, boundary - 30 * HOUR, 3, 'peasant');
    const state = migrateState(stored, { timeScale: 3 });
    expect(state.settlement.famine?.deserted).toBe(0);
    expect(deserters(advanceTo(state, boundary + 30 * DAY).events)).toEqual([]);
  });

  it('os retratos em fome: ninguém deserta na fronteira, e os instantes seguintes são os do prazo novo', () => {
    // Rápido: a fome começou meia hora de jogo depois da fundação e a fronteira está nas
    // 46 h 17. Com dois já cobrados, o terceiro é devido às 48 h de fome: a virada das 50 h.
    const fast = migrated(named('state-v11-famine-3x.json'));
    expect(fast.settlement.famine).toEqual({ sinceMs: 30 * MINUTE, carriedMs: 0, deserted: 2 });
    const fastRun = advanceTo(fast, 62 * HOUR);
    expect(deserters(fastRun.events)).toEqual([50 * HOUR, 56 * HOUR, 62 * HOUR]);
    // Tranquilo: fome desde 1 h 40, fronteira nas 9 h 40. Com um já cobrado, a virada das 10 h
    // encontra 8 h 20 de fome (três devidos) e a das 12 h, 10 h 20 (cinco).
    const slow = migrated(named('state-v11-famine-half.json'));
    expect(slow.settlement.famine).toEqual({ sinceMs: 100 * MINUTE, carriedMs: 0, deserted: 1 });
    const slowRun = advanceTo(slow, 12 * HOUR);
    expect(deserters(slowRun.events)).toEqual([10 * HOUR, 10 * HOUR, 12 * HOUR, 12 * HOUR]);
    // Normal: o feudo do retrato já está no piso de 3 aldeões, e ninguém mais deserta.
    const normal = migrated(named('state-v11-famine.json'));
    expect(normal.settlement.population.villagers).toBe(3);
    const normalRun = advanceTo(normal, normal.lastProcessedAt + 10 * DAY);
    expect(deserters(normalRun.events)).toEqual([]);
  });

  it('a divisão de intervalo continua exata a partir da fronteira, com a deserção no caminho', () => {
    for (const name of ['state-v11-famine-3x.json', 'state-v11-famine-half.json']) {
      const state = migrated(named(name));
      const end = state.lastProcessedAt + 12 * DAY;
      const direct = advanceTo(state, end);
      expect(deserters(direct.events).length, name).toBeGreaterThan(1);
      for (const cut of [1, 7 * HOUR + 13, 5 * DAY, 5 * DAY + 1]) {
        const first = advanceTo(state, state.lastProcessedAt + cut);
        const second = advanceTo(first.state, end);
        expect(second.state, name).toStrictEqual(direct.state);
        expect([...first.events, ...second.events], name).toStrictEqual(direct.events);
      }
    }
  });

  it('a conversão dos prazos é a do motor, em todo ritmo oferecido', () => {
    for (const pace of balance.paces) {
      const state = migrateState(starvingV11(40 * DAY, 39 * DAY, pace.timeScale), {
        timeScale: pace.timeScale,
      });
      expect(famineDesertionPace(state)).toEqual({
        graceMs: 12 * HOUR * pace.timeScale,
        stepMs: 2 * HOUR * pace.timeScale,
      });
    }
  });
});

describe('versão 12 → 13', () => {
  const version12 = fixtures.filter((fixture) => fixture.version === 12);

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v12-fresh.json'));
    expect(fresh.ids).toEqual({});
    expect(newGame().ids).toEqual({});
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version12)('$name: só acrescenta os contadores de identidade, vazios', (fixture) => {
    const before = read(fixture) as Draft;
    const after = migrated(fixture);
    expect(after.ids).toStrictEqual({});
    // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, carta ou incursão
    // muda, e o gerador fica palavra por palavra como estava.
    expect(after.rng).toStrictEqual(before.rng);
    // A Taverna é do passo 15 → 16, conferido no bloco dele.
    const rest: Partial<GameState> = { ...withoutTavern(after) };
    delete rest.ids;
    // A guilda é do passo seguinte (13 → 14), conferido no bloco dele.
    delete rest.guild;
    expect({ ...rest, schemaVersion: 12 }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it.each(version12)(
    '$name: nada acontece na fronteira, e a partida segue como seguiria sem o passo',
    (fixture) => {
      const state = migrated(fixture);
      // Nenhum prazo novo: o próximo evento é o que a partida já tinha marcado.
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      // A única regra de hoje que cria entidade é a carta da estrangeira, que dá um herói: um
      // mês real depois o contador conhece esse herói e mais nada, e o gerador só tem os fluxos
      // fixos.
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month).state;
      expect(later.ids).toEqual({ hero: 1 });
      for (const stream of Object.keys(later.rng)) {
        expect(RNG_STREAMS).toContain(stream);
      }
    },
  );

  it('os retratos cobrem os três fluxos em uso, as três dificuldades e os três ritmos, e partidas migradas fora de Senhor', () => {
    const states = version12.map((fixture) => read(fixture) as unknown as GameState);
    expect(new Set(states.flatMap((state) => Object.keys(state.rng)))).toEqual(
      new Set(RNG_FIXED_STREAMS_V13),
    );
    const migratedOnes = states.filter((state) => state.migratedAtMs !== null);
    expect(
      migratedOnes
        .map((state) => `${state.settings.difficulty}@${state.settings.timeScale}`)
        .sort(),
    ).toEqual(['ironKing@0.5', 'lord@3', 'peasant@3']);
  });

  it('um estado da versão 12 com um fluxo que o gerador não conhece é recusado, sem gravar por cima', () => {
    // A forma da versão 12 deixava passar qualquer nome e qualquer lista de inteiros em `rng`;
    // a da 13 confere. Nenhum motor escreveu isto, mas se existir, a migração para e avisa.
    for (const rng of [{ market: [1, 2, 3, 4] }, { council: [1, 2, 3] }, { horde: [0, 0, 0, 0] }]) {
      const old = asVersion12(newGame());
      old.rng = rng;
      const copy = JSON.parse(JSON.stringify(old)) as unknown;
      let caught: unknown;
      try {
        migrateState(old, { timeScale: 1 });
      } catch (error) {
        caught = error;
      }
      expect(caught).toBeInstanceOf(StateMigrationError);
      expect((caught as StateMigrationError).reason).toBe('invalid');
      // Quem recusa é a guarda da versão 13, na entrada do passo seguinte.
      expect((caught as StateMigrationError).message).toMatch(
        /diz ser da versão 13, mas não tem a forma dela \(rng\./,
      );
      expect(old).toEqual(copy);
    }
  });

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const old = asVersion12(advanceTo(newGame(), 400 * HOUR).state);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(400 * HOUR);
  });
});

describe('versão 13 → 14', () => {
  const version13 = fixtures.filter((fixture) => fixture.version === 13);
  // A lista dos prometidos é do passo seguinte (14 → 15), conferido no bloco dele.
  // E a Taverna, do 15 → 16: as comparações da guilda a deixam de fora (`withoutTavern`).
  const EMPTY_GUILD = { heroes: [], arriving: [], wageArrears: null, lastWageArrears: null };

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v13-fresh.json'));
    expect(withoutTavern(fresh).guild).toEqual(EMPTY_GUILD);
    expect(withoutTavern(newGame()).guild).toEqual(EMPTY_GUILD);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version13)('$name: só acrescenta a guilda, vazia', (fixture) => {
    const before = read(fixture) as Draft;
    const after = migrated(fixture);
    expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(withoutTavern(after).guild).toStrictEqual(EMPTY_GUILD);
    // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, carta ou incursão
    // muda, ninguém ganha identificador e o gerador fica palavra por palavra como estava.
    expect(after.rng).toStrictEqual(before.rng);
    expect(after.ids).toStrictEqual(before.ids);
    const rest: Partial<GameState> = { ...withoutTavern(after) };
    delete rest.guild;
    expect({ ...rest, schemaVersion: 13 }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it.each(version13)(
    '$name: nada acontece na fronteira, e até a carta da estrangeira a partida segue sem herói, sem soldo e sem atraso',
    (fixture) => {
      const state = migrated(fixture);
      // Nenhum prazo novo: o próximo evento é o que a partida já tinha marcado.
      expect(nextEventAt(state)).toBe(
        nextEventAt({
          ...state,
          guild: {
            ...state.guild,
            heroes: [],
            arriving: [],
            wageArrears: null,
            lastWageArrears: null,
          },
        }),
      );
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      // Só a carta da estrangeira dá um herói: até ela ser resolvida (a resposta ou o prazo) a
      // guilda continua vazia, nenhum evento do soldo sai e ninguém ganha identificador.
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month);
      const resolved = later.events.find(
        (event) => event.type === 'cardExpired' && event.data.cardId === 'woundedStranger',
      );
      expect(resolved).toBeDefined();
      const before = advanceTo(state, (resolved as GameEvent).atMs - 1);
      expect(withoutTavern(before.state).guild).toEqual(EMPTY_GUILD);
      expect(before.state.ids).toEqual({});
      expect(
        before.events.filter((event) => /^(wageArrears|hero)/.test(event.type)).map((e) => e.type),
      ).toEqual([]);
    },
  );

  it('o ouro de uma partida migrada anda como andava: sem herói não há soldo', () => {
    const fixture = named('state-v13-week-scripted.json');
    const state = migrated(fixture);
    const view = deriveViewState(state, state.lastProcessedAt);
    const gold = view.resources.find((row) => row.id === 'gold');
    expect(gold?.breakdown).not.toMatch(/soldo/);
    expect(gold?.depletesInSeconds).toBeNull();
  });

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const old = asVersion13(advanceTo(newGame(), 400 * HOUR).state);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(400 * HOUR);
    expect(withoutTavern(slow).guild).toEqual(EMPTY_GUILD);
  });

  it('um estado da versão 13 que já traz a guilda é recusado: não é da versão que diz', () => {
    const old = asVersion13(newGame());
    old.guild = EMPTY_GUILD;
    expect(() => migrateState(old, { timeScale: 1 })).toThrow(StateMigrationError);
    expect(() => migrateState(old, { timeScale: 1 })).toThrow(/guild: campo desconhecido/);
  });
});

describe('versão 14 → 15', () => {
  const version14 = fixtures.filter((fixture) => fixture.version === 14);
  const withHeroes = version14.filter(
    (fixture) => (read(fixture) as Draft).guild.heroes.length > 0,
  );

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v14-fresh.json'));
    expect(withoutTavern(fresh).guild).toEqual({
      heroes: [],
      arriving: [],
      wageArrears: null,
      lastWageArrears: null,
    });
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it('há retratos da versão 14 com heróis, com o soldo em dia e em atraso', () => {
    expect(withHeroes.length).toBeGreaterThanOrEqual(2);
    const guilds = withHeroes.map((fixture) => (read(fixture) as Draft).guild);
    expect(guilds.some((guild) => guild.wageArrears !== null)).toBe(true);
    expect(guilds.some((guild) => guild.wageArrears === null)).toBe(true);
  });

  it.each(version14)(
    '$name: só acrescenta a forma de tratamento dos heróis e a lista dos prometidos, vazia',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.guild.arriving).toStrictEqual([]);
      // Quem já estava no feudo fica como estava, com o valor fixo do passo: a ficha continua
      // dizendo a classe e os traços como dizia.
      expect(HERO_GENDER_FROM_V14).toBe('m');
      expect(withoutOutcomes(after).guild.heroes).toStrictEqual(
        (before.guild.heroes as Draft[]).map((hero) => ({ ...hero, gender: 'm' })),
      );
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      // O resto é o estado antigo, campo por campo: o Conselho inclusive. O passo não põe a
      // carta da estrangeira na mesa, não a agenda e não mexe na cadência.
      const rest = withoutTavern(after) as Draft;
      delete rest.guild.arriving;
      for (const hero of rest.guild.heroes as Draft[]) {
        delete hero.gender;
      }
      expect({ ...rest, schemaVersion: 14 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
      expect(after.stats['cardsDrawn:woundedStranger']).toBeUndefined();
    },
  );

  it.each(version14)('$name: nada acontece na fronteira, e o passo não cria prazo', (fixture) => {
    const state = migrated(fixture);
    const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
    expect(withoutObjectives(atBoundary.events)).toEqual([]);
    expect(atBoundary.state.guild.heroes).toEqual(state.guild.heroes);
    expect(atBoundary.state.ids).toEqual(state.ids);
  });

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion14(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow.guild.heroes.map((hero) => [hero.name, hero.gender])).toEqual([['Brann', 'm']]);
    expect(slow.guild.arriving).toEqual([]);
  });

  it('um estado da versão 14 que já traz os campos da 15 é recusado: não é da versão que diz', () => {
    const start = newGame();
    addHero(start);
    const gendered = asVersion14(start);
    (gendered.guild.heroes[0] as Draft).gender = 'f';
    expect(() => migrateState(gendered, { timeScale: 1 })).toThrow(
      /guild\.heroes\.0\.gender: campo desconhecido/,
    );
    const promised = asVersion14(newGame());
    promised.guild.arriving = [];
    expect(() => migrateState(promised, { timeScale: 1 })).toThrow(
      /guild\.arriving: campo desconhecido/,
    );
  });
});

describe('versão 15 → 16', () => {
  const version15 = fixtures.filter((fixture) => fixture.version === 15);
  const NO_TAVERN = { nextRotationAtMs: null, festival: null, lastFestivalAtMs: null };

  it('os identificadores e os tetos escritos na forma são os do conteúdo de hoje', () => {
    expect([...BUILDING_IDS_V16, 'guild', 'market']).toEqual([...BUILDING_IDS]);
    expect(TAVERN_OFFERS_CAP_V16).toBe(Math.max(...balance.tavern.offersByLevel));
    expect(RNG_FIXED_STREAMS_V16).toEqual([...RNG_FIXED_STREAMS_V13, 'tavern']);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v15-fresh.json'));
    expect(fresh.settlement.buildings.tavern).toBe(0);
    expect(fresh.guild.tavernOffers).toEqual([]);
    expect(fresh.guild.tavern).toEqual(NO_TAVERN);
    expect(newGame().guild.tavern).toEqual(NO_TAVERN);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version15)(
    '$name: só acrescenta a Taverna no nível 0, sem candidatos, sem rotação e sem festival',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.settlement.buildings.tavern).toBe(0);
      expect(after.guild.tavernOffers).toStrictEqual([]);
      expect(after.guild.tavern).toStrictEqual(NO_TAVERN);
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, herói, carta ou
      // incursão muda, ninguém ganha identificador e o gerador fica palavra por palavra como
      // estava (o fluxo `tavern` só nasce no primeiro sorteio, na inauguração).
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect({ ...withoutTavern(after), schemaVersion: 15 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version15)(
    '$name: nada acontece na fronteira, o passo não cria prazo, e sem a obra a Taverna nunca sorteia',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      expect(atBoundary.state.guild.tavern).toEqual(NO_TAVERN);
      // A moral de ninguém muda: o termo da Taverna só existe com ela erguida.
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.morale.terms.map((term) => term.id)).not.toContain('tavern');
      expect(view.tavern.level).toBe(0);
      expect(view.tavern.offers).toEqual([]);
      expect(view.tavern.nextRotationInSeconds).toBeNull();
      // O limite de contratação continua em um herói.
      expect(view.guild.heroLimit).toBe(balance.heroes.limitBase);
      // Um mês real depois, sem ninguém mandar erguê-la: nenhum candidato, nenhuma oferta com
      // identificador e nenhum fluxo `tavern`.
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month);
      expect(later.state.settlement.buildings.tavern).toBe(0);
      expect(later.state.guild.tavernOffers).toEqual([]);
      expect(later.state.guild.tavern).toEqual(NO_TAVERN);
      expect(later.state.ids.offer).toBeUndefined();
      expect(later.state.rng.tavern).toBeUndefined();
      expect(later.events.filter((event) => /^(heroHired|festival)/.test(event.type))).toEqual([]);
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion15(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow.guild.heroes.map((hero) => hero.name)).toEqual(['Brann']);
    expect(slow.guild.tavern).toEqual(NO_TAVERN);
  });

  it('um estado da versão 15 que já traz os campos da 16 é recusado: não é da versão que diz', () => {
    const built = asVersion15(newGame());
    built.settlement.buildings.tavern = 0;
    expect(() => migrateState(built, { timeScale: 1 })).toThrow(
      /settlement\.buildings\.tavern: campo desconhecido/,
    );
    const offered = asVersion15(newGame());
    offered.guild.tavernOffers = [];
    expect(() => migrateState(offered, { timeScale: 1 })).toThrow(
      /guild\.tavernOffers: campo desconhecido/,
    );
    const drawn = asVersion15(newGame());
    drawn.rng = { tavern: [1, 2, 3, 4] };
    expect(() => migrateState(drawn, { timeScale: 1 })).toThrow(
      /rng\.tavern: chave fora do esperado/,
    );
  });

  it('a partida migrada com o Salão no nível 3 ergue a Taverna, e os candidatos nascem quando ela fica pronta', () => {
    const ready = version15
      .map((fixture) => migrated(fixture))
      .filter(
        (state) =>
          state.settlement.buildings.townHall >= 3 &&
          state.settlement.constructionQueues[0] === null,
      );
    expect(ready.length).toBeGreaterThan(0);
    for (const state of ready) {
      const draft = JSON.parse(JSON.stringify(state)) as GameState;
      Object.assign(draft.settlement.resources, { wood: 400_000, stone: 400_000, gold: 400_000 });
      const ordered = applyCommand(
        draft,
        command('startConstruction', { building: 'tavern' }),
        draft.lastProcessedAt,
      );
      expect(ordered.ok).toBe(true);
      if (!ordered.ok) {
        continue;
      }
      const opensAt = ordered.state.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
      expect(advanceTo(ordered.state, opensAt - 1).state.guild.tavernOffers).toEqual([]);
      const opened = advanceTo(ordered.state, opensAt).state;
      expect(opened.settlement.buildings.tavern).toBe(1);
      expect(opened.guild.tavernOffers).toHaveLength(balance.tavern.offersByLevel[0] ?? 0);
      // A rotação conta da inauguração, não da fronteira.
      expect(opened.guild.tavern.nextRotationAtMs).toBe(opensAt + balance.tavern.rotationMs);
      expect(currentShape(JSON.parse(JSON.stringify(opened)), '')).toBeNull();
    }
  });
});

describe('versão 16 → 17', () => {
  const version16 = fixtures.filter((fixture) => fixture.version === 16);

  it('os identificadores e os tetos escritos na forma são os do conteúdo de hoje', () => {
    const { expeditions } = balance;
    expect([...BUILDING_IDS_V17, 'market']).toEqual([...BUILDING_IDS]);
    expect(HERO_STATUS_IDS_V17).toEqual(['idle', 'expedition']);
    expect(POSTURE_IDS_V17).toEqual([...POSTURE_IDS]);
    expect(EXPEDITION_LOG_OUTCOMES_V17).toEqual([...EXPEDITION_OUTCOME_IDS, 'passed', 'chosen']);
    expect(CROSSROADS_DECIDERS_V17).toEqual(['player', 'posture', 'cautiousFallback']);
    expect(EXPEDITION_SLOTS_CAP_V17).toBe(Math.max(...expeditions.slotsByGuildLevel));
    expect(EXPEDITION_REPORTS_CAP_V17).toBe(expeditions.reportsKept);
    expect(EXPEDITION_LOG_CAP_V17).toBe(expeditions.graph.maxSteps);
    expect(EXPEDITION_TEAM_CAP_V17).toBe(expeditions.teamMax);
    expect(EXPEDITION_VARIANTS_V17).toBe(expeditions.variantsPerModel);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v16-fresh.json'));
    expect(fresh.settlement.buildings.guild).toBe(0);
    expect(fresh.guild.expeditions).toEqual([]);
    expect(fresh.guild.reports).toEqual([]);
    expect(newGame().guild.expeditions).toEqual([]);
    expect(newGame().guild.reports).toEqual([]);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version16)(
    '$name: só acrescenta a Guilda no nível 0, sem expedições e sem relatórios',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.settlement.buildings.guild).toBe(0);
      expect(after.guild.expeditions).toStrictEqual([]);
      expect(after.guild.reports).toStrictEqual([]);
      // Todos continuam no feudo, como estavam.
      expect(after.guild.heroes.every((hero) => hero.status === 'idle')).toBe(true);
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, herói, oferta, carta
      // ou incursão muda, ninguém ganha identificador e o gerador fica palavra por palavra como
      // estava (o fluxo de uma expedição só nasce no primeiro sorteio dela).
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect({ ...withoutGuildHall(after), schemaVersion: 16 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version16)(
    '$name: nada acontece na fronteira, o passo não cria prazo, e sem a obra nenhuma expedição existe',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(withoutObjectives(atBoundary.events)).toEqual([]);
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.guild).toMatchObject({
        built: false,
        level: 0,
        slots: 0,
        available: [],
        expeditions: [],
        reports: [],
      });
      expect(view.pendingDecisions.every((entry) => entry.kind === 'card')).toBe(true);
      // O soldo de ninguém muda com o passo.
      expect(view.guild.wage.perHour).toBe(
        state.guild.heroes.length * balance.heroes.wagePerHour * state.settings.timeScale,
      );
      // Um mês real depois, sem ninguém mandar erguê-la: nenhuma expedição, nenhum
      // identificador e nenhum fluxo de expedição.
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month);
      expect(later.state.settlement.buildings.guild).toBe(0);
      expect(later.state.guild.expeditions).toEqual([]);
      expect(later.state.guild.reports).toEqual([]);
      expect(later.state.ids.expedition).toBeUndefined();
      expect(Object.keys(later.state.rng).filter((key) => key.includes(':'))).toEqual([]);
      expect(later.events.filter((event) => event.type.startsWith('expedition'))).toEqual([]);
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion16(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow.guild.heroes.map((hero) => [hero.name, hero.status])).toEqual([['Brann', 'idle']]);
    expect(slow.guild.expeditions).toEqual([]);
  });

  it('um estado da versão 16 que já traz os campos da 17 é recusado: não é da versão que diz', () => {
    const built = asVersion16(newGame());
    built.settlement.buildings.guild = 0;
    expect(() => migrateState(built, { timeScale: 1 })).toThrow(
      /settlement\.buildings\.guild: campo desconhecido/,
    );
    const sent = asVersion16(newGame());
    sent.guild.expeditions = [];
    expect(() => migrateState(sent, { timeScale: 1 })).toThrow(
      /guild\.expeditions: campo desconhecido/,
    );
    const staffed = newGame();
    addHero(staffed);
    const away = asVersion16(staffed);
    away.guild.heroes[0].status = 'expedition';
    expect(() => migrateState(away, { timeScale: 1 })).toThrow(/guild\.heroes\.0\.status/);
  });

  it('a partida migrada com o Salão no nível 3 ergue a Guilda e envia uma Patrulha, que volta', () => {
    const ready = version16
      .map((fixture) => migrated(fixture))
      .filter(
        (state) =>
          state.settlement.buildings.townHall >= 3 &&
          state.settlement.constructionQueues[0] === null,
      );
    expect(ready.length).toBeGreaterThan(0);
    for (const state of ready) {
      const draft = JSON.parse(JSON.stringify(state)) as GameState;
      Object.assign(draft.settlement.resources, { wood: 400_000, stone: 400_000, gold: 400_000 });
      if (draft.guild.heroes.length === 0) {
        addHero(draft);
      }
      const ordered = applyCommand(
        draft,
        command('startConstruction', { building: 'guild' }),
        draft.lastProcessedAt,
      );
      expect(ordered.ok).toBe(true);
      if (!ordered.ok) {
        continue;
      }
      const opensAt = ordered.state.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
      const opened = advanceTo(ordered.state, opensAt).state;
      expect(opened.settlement.buildings.guild).toBe(1);
      const free = opened.guild.heroes.find((hero) => hero.status === 'idle');
      if (free === undefined) {
        continue;
      }
      const sent = applyCommand(
        opened,
        command('sendExpedition', { modelId: 'patrol', heroIds: [free.id], posture: 'balanced' }),
        opensAt,
      );
      expect(sent.ok).toBe(true);
      if (!sent.ok) {
        continue;
      }
      expect(currentShape(JSON.parse(JSON.stringify(sent.state)), '')).toBeNull();
      const back = advanceTo(sent.state, opensAt + HOUR);
      expect(back.events.map((event) => event.type)).toContain('expeditionReturned');
      expect(back.state.guild.reports).toHaveLength(1);
      expect(currentShape(JSON.parse(JSON.stringify(back.state)), '')).toBeNull();
    }
  });
});

/**
 * A carta da estrangeira nas partidas que já existiam (ADR 0017, decisão 6: "Sim, a todos";
 * roadmap da v0.3, V3C-T3.4 e QA-01). Nenhum passo de migração a agenda: quem a entrega é o
 * motor, na primeira audiência com lugar depois da fronteira. Vale para todo retrato de toda
 * versão: os que ainda não chegaram ao 13º dia, os que já passaram dele, o que está no ano 2,
 * os que migraram com a cadência fora dos dias 5, 9 e 13 e os que já tinham heróis.
 */
describe('a carta da estrangeira em toda partida que já existia', () => {
  // Até a versão 14: a carta nasceu com a 15, e os retratos dela em diante já a trazem.
  const old = fixtures.filter((fixture) => fixture.version < 15);
  const INTERVAL = balance.council.drawIntervalDays * 2 * HOUR;
  const DAY_13 = 12 * 2 * HOUR;

  it('os retratos cobrem antes e depois do 13º dia, o ano 2, a cadência fora dos dias 5, 9 e 13 e a mesa cheia', () => {
    const states = old.map((fixture) => migrated(fixture));
    expect(states.some((state) => state.lastProcessedAt < DAY_13)).toBe(true);
    expect(states.some((state) => state.lastProcessedAt > DAY_13)).toBe(true);
    expect(states.some((state) => state.clock.year >= 2)).toBe(true);
    expect(states.some((state) => state.council.nextDrawAtMs % INTERVAL !== 0)).toBe(true);
    expect(states.some((state) => state.council.pending.length > 0)).toBe(true);
    expect(states.some((state) => state.council.scheduled.length > 0)).toBe(true);
    expect(states.some((state) => state.guild.heroes.length > 0)).toBe(true);
    for (const state of states) {
      expect(state.stats['cardsDrawn:woundedStranger']).toBeUndefined();
    }
  });

  it.each(old)(
    '$name: a carta chega uma vez, em uma audiência depois da fronteira, e dá um herói',
    (fixture) => {
      const state = migrated(fixture);
      const boundary = state.lastProcessedAt;
      const heroesBefore = state.ids.hero ?? 0;
      const span = Math.round(60 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, boundary + span);
      const stranger = later.events.filter((event) => event.data.cardId === 'woundedStranger');
      // Chega pelo roteiro, uma vez, e o conselho a resolve no prazo: ninguém respondeu.
      expect(stranger.map((event) => event.type)).toEqual(['cardDrawn', 'cardExpired']);
      const [drawn, expired] = stranger as [GameEvent, GameEvent];
      expect(drawn.data.source).toBe('scripted');
      expect(later.state.stats['cardsDrawn:woundedStranger']).toBe(1);
      // Depois da fronteira e nunca antes do 13º dia de jogo.
      expect(drawn.atMs).toBeGreaterThan(boundary);
      expect(drawn.atMs).toBeGreaterThanOrEqual(DAY_13);
      // Em uma audiência: uma virada de dia, a primeira a partir de um instante da cadência.
      expect(drawn.atMs % (2 * HOUR)).toBe(0);
      const sinceCadence =
        (((drawn.atMs - state.council.nextDrawAtMs) % INTERVAL) + INTERVAL) % INTERVAL;
      expect(sinceCadence).toBeLessThan(2 * HOUR);
      // O prazo é o de toda carta: 24 h reais, no ritmo da partida.
      expect(expired.atMs - drawn.atMs).toBe(Math.round(DAY_REAL * state.settings.timeScale));
      // Um herói, e só um: o da opção que a dificuldade aplica.
      const joined = later.events.filter((event) => event.type === 'heroJoined');
      const iron = state.settings.difficulty === 'ironKing';
      expect(expired.data.optionId).toBe(iron ? 'tend' : 'shelter');
      expect(later.state.guild.arriving).toEqual([]);
      // Os retratos da guilda na versão 14 foram montados à mão, com heróis de teste chamados
      // Edda e Rolf (no jogo, ninguém tinha herói antes desta carta). Um herói com nome é um
      // só (`promiseHero`): quem já o tem no feudo não ganha outro.
      const promised = namedHeroes[iron ? 'rolf' : 'edda'].name;
      if (state.guild.heroes.some((hero) => hero.name === promised)) {
        expect(joined).toEqual([]);
        expect(expired.data.hero).toBeUndefined();
        expect(later.state.ids.hero).toBe(heroesBefore);
        return;
      }
      expect(joined).toHaveLength(1);
      expect(joined[0]?.data.namedHeroId).toBe(iron ? 'rolf' : 'edda');
      expect(joined[0]?.atMs).toBe(expired.atMs + (iron ? 2 * HOUR : 0));
      expect(later.state.ids.hero).toBe(heroesBefore + 1);
    },
  );

  it.each(old)('$name: nenhum evento de herói antes da fronteira nem na fronteira', (fixture) => {
    const state = migrated(fixture);
    const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
    expect(
      atBoundary.events.filter((event) =>
        /^hero|woundedStranger/.test(`${event.type}${String(event.data.cardId)}`),
      ),
    ).toEqual([]);
  });
});

describe('a fronteira é de cada passo', () => {
  // A v0.2 chega à produção em mais de uma publicação, e cada uma migra as partidas em um
  // instante diferente. Este passo ainda não existe: é o próximo que alguém vai escrever, com a
  // mesma conta que o passo do Conselho faz para a primeira carta (`v7ToV8`): o primeiro prazo
  // de uma mecânica nova conta a partir da fronteira **deste** passo.
  const NEXT = CURRENT_SCHEMA_VERSION + 1;
  const INTERVAL = 8 * HOUR;
  const nextShape: Shape = (value, path) => {
    const { syntheticDeadlineMs, schemaVersion, ...rest } = value as Draft;
    if (schemaVersion !== NEXT) {
      return 'schemaVersion: esperada a versão do passo sintético';
    }
    return (
      natural(syntheticDeadlineMs, 'syntheticDeadlineMs') ??
      currentShape({ ...rest, schemaVersion: CURRENT_SCHEMA_VERSION }, path)
    );
  };
  const seen: Array<{ boundaryMs: number; timeScale: number }> = [];
  const chain: MigrationChain = {
    steps: [
      ...migrationSteps,
      {
        from: CURRENT_SCHEMA_VERSION,
        summary: 'passo sintético de teste: uma mecânica com prazo',
        shape: currentShape,
        migrate: (state, context) => {
          seen.push({ ...context });
          return {
            ...state,
            schemaVersion: NEXT,
            syntheticDeadlineMs: context.boundaryMs + INTERVAL,
          };
        },
      },
    ],
    shape: nextShape,
  };
  const throughBank = (state: GameState) => JSON.parse(JSON.stringify(state)) as Draft;
  const YEAR_3 = 400 * HOUR;

  it('partida que nasceu na versão atual, sem fronteira: o prazo novo conta de onde ela está', () => {
    const born = throughBank(advanceTo(newGame(), YEAR_3).state);
    expect(born.clock.year).toBe(3);
    expect(born.migratedAtMs).toBeNull();

    const after = migrateWith(born, { timeScale: 1 }, chain);
    expect(after.schemaVersion).toBe(NEXT);
    expect(after.lastProcessedAt).toBe(YEAR_3);
    expect(after.migratedAtMs).toBe(YEAR_3);
    expect(after.syntheticDeadlineMs).toBe(YEAR_3 + INTERVAL);
    expect(born.migratedAtMs).toBeNull();
  });

  it('partida migrada há muito tempo: a fronteira antiga não vale para a mecânica nova', () => {
    const old = migrateState(read(named('state-v1-construction.json')), { timeScale: 3 });
    const played = throughBank(advanceTo(old, YEAR_3).state);
    expect(played.migratedAtMs).toBe(127_321);

    const after = migrateWith(played, { timeScale: 3 }, chain);
    // Com a fronteira antiga, o prazo cairia no passado e a ausência inteira seria recalculada
    // com uma regra que não existia.
    expect(after.migratedAtMs).toBe(YEAR_3);
    expect(after.syntheticDeadlineMs).toBe(YEAR_3 + INTERVAL);
    expect(after.syntheticDeadlineMs).toBeGreaterThan(after.lastProcessedAt as number);
  });

  it('partida que atravessa dois passos de uma vez: os dois veem o mesmo instante', () => {
    seen.length = 0;
    const before = read(named('state-v1-week-bot-3x.json'));
    const after = migrateWith(before, { timeScale: 3 }, chain);
    expect(after.migratedAtMs).toBe(before.lastProcessedAt);
    expect(after.syntheticDeadlineMs).toBe((before.lastProcessedAt as number) + INTERVAL);
    expect(seen).toEqual([{ boundaryMs: before.lastProcessedAt, timeScale: 3 }]);
  });

  it('um passo que esquece a fronteira não a deixa para trás', () => {
    const forgetful: MigrationChain = {
      steps: [
        ...migrationSteps,
        {
          from: CURRENT_SCHEMA_VERSION,
          summary: 'passo sintético de teste: só troca o número da versão',
          shape: currentShape,
          migrate: (state) => ({ ...state, schemaVersion: NEXT, syntheticDeadlineMs: 0 }),
        },
      ],
      shape: nextShape,
    };
    const born = throughBank(advanceTo(newGame(), YEAR_3).state);
    expect(migrateWith(born, { timeScale: 1 }, forgetful).migratedAtMs).toBe(YEAR_3);
  });

  it('a cadeia do jogo é a que `migrateState` usa', () => {
    const real: MigrationChain = { steps: migrationSteps, shape: currentShape };
    for (const fixture of fixtures) {
      expect(migrateWith(read(fixture), { timeScale: fixture.timeScale }, real)).toEqual(
        migrated(fixture),
      );
    }
  });
});

describe('estados que o motor não aceita', () => {
  const valid = () => read(named('state-v1-objectives.json'));
  const failure = (stored: unknown): StateMigrationError => {
    try {
      migrateState(stored, { timeScale: 1 });
    } catch (error) {
      if (error instanceof StateMigrationError) {
        return error;
      }
      throw error;
    }
    throw new Error('A migração aceitou um estado que devia recusar.');
  };

  it('versão mais nova que a do motor: recusa sem tocar no estado', () => {
    const future = { ...newGame(), schemaVersion: CURRENT_SCHEMA_VERSION + 1, novidade: true };
    const copy = JSON.parse(JSON.stringify(future)) as unknown;
    const error = failure(future);
    expect(error.reason).toBe('future');
    expect(error.message).toContain(`versão ${CURRENT_SCHEMA_VERSION + 1}`);
    expect(future).toEqual(copy);
  });

  it.each([
    ['null', null],
    ['uma lista', []],
    ['um texto', 'estado'],
    ['um objeto vazio', {}],
    ['versão em texto', { schemaVersion: '1' }],
    ['versão zero', { schemaVersion: 0 }],
    ['versão fracionária', { schemaVersion: 1.5 }],
  ])('%s: não dá para saber a versão', (_, stored) => {
    expect(failure(stored).reason).toBe('invalid');
  });

  it.each<[string, (state: Draft) => void, string]>([
    [
      'campo ausente',
      (state) => delete state.settlement.famine,
      'settlement.famine: campo ausente',
    ],
    [
      'campo a mais',
      (state) => {
        state.settlement.morale = 50;
      },
      'settlement.morale: campo desconhecido',
    ],
    [
      'estoque fracionário',
      (state) => {
        state.settlement.resources.food = 10.5;
      },
      'settlement.resources.food: esperado inteiro a partir de zero, veio número não inteiro',
    ],
    [
      'estoque negativo',
      (state) => {
        state.settlement.resources.wood = -1;
      },
      'settlement.resources.wood: esperado inteiro a partir de zero',
    ],
    [
      'edifício que a versão 1 não tinha',
      (state) => {
        state.settlement.buildings.granary = 1;
      },
      'settlement.buildings.granary: campo desconhecido',
    ],
    [
      'obra de um edifício desconhecido',
      (state) => {
        state.settlement.constructionQueues[0] = {
          building: 'castle',
          targetLevel: 2,
          startedAtMs: 0,
          finishesAtMs: 1,
        };
      },
      'settlement.constructionQueues.0.building: esperado um de',
    ],
    [
      'limite de estoque ligado, que a v0.1 nunca teve',
      (state) => {
        state.settings.capsEnabled = true;
      },
      'settings.capsEnabled: esperado o valor fixo false',
    ],
    [
      'estado da versão 2 com o número da versão 1',
      (state) => {
        state.migratedAtMs = 0;
      },
      'migratedAtMs: campo desconhecido',
    ],
    [
      'fila de recrutamento que não é lista',
      (state) => {
        state.settlement.recruitmentQueue = {};
      },
      'settlement.recruitmentQueue: esperado lista, veio objeto',
    ],
  ])('versão 1 com %s', (_, damage, expected) => {
    const state = valid();
    damage(state as Draft);
    const copy = JSON.parse(JSON.stringify(state)) as unknown;
    const error = failure(state);
    expect(error.reason).toBe('invalid');
    expect(error.message).toContain(expected);
    // A entrada fica como estava: quem chamou não tem nada novo para gravar.
    expect(state).toEqual(copy);
  });

  it('a mensagem cita o caminho, nunca o que o jogador escreveu', () => {
    const state = valid() as Draft;
    state.settlement.name = 12;
    state.settings.settlementName = 'Nome Que Não Vai Para o Log';
    state.seed = 'semente-secreta';
    const { message } = failure(state);
    expect(message).toContain('settlement.name: esperado texto, veio inteiro');
    expect(message).not.toContain('Nome Que Não Vai Para o Log');
    expect(message).not.toContain('semente-secreta');
  });
});

describe('versão 17 → 18', () => {
  const version17 = fixtures.filter((fixture) => fixture.version === 17);
  const withHeroes = version17.filter(
    (fixture) => (read(fixture) as Draft).guild.heroes.length > 0,
  );
  const withJourneys = version17.filter((fixture) => {
    const { guild } = read(fixture) as Draft;
    return guild.expeditions.length + guild.reports.length > 0;
  });

  it('há retratos da versão 17 com herói, com expedição em curso e com relatório', () => {
    expect(withHeroes.length).toBeGreaterThan(0);
    expect(withJourneys.length).toBeGreaterThan(0);
    expect(version17.some((fixture) => (read(fixture) as Draft).guild.reports.length > 0)).toBe(
      true,
    );
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v17-fresh.json'));
    expect(fresh.guild.inventory).toEqual([]);
    expect(fresh.map.discovered).toEqual([]);
    expect(newGame().guild.inventory).toEqual([]);
    expect(newGame().map.discovered).toEqual([]);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version17)(
    '$name: só acrescenta o arsenal e os destinos vazios, e a cada herói e a cada registro o que nada aconteceu',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.guild.inventory).toStrictEqual([]);
      expect(after.map.discovered).toStrictEqual([]);
      for (const hero of after.guild.heroes) {
        expect(hero.injury).toBeNull();
        expect(hero.captivity).toBeNull();
        expect(hero.equipment).toStrictEqual({ weapon: null, armor: null, accessory: null });
      }
      // Quem estava no feudo continua pronto, e quem estava em expedição continua nela.
      expect(after.guild.heroes.map((hero) => hero.status)).toStrictEqual(
        (before.guild.heroes as Draft[]).map((hero) => hero.status),
      );
      for (const journey of [...after.guild.expeditions, ...after.guild.reports]) {
        expect(journey.loot.items).toStrictEqual([]);
        for (const entry of journey.log) {
          expect(entry).toMatchObject({
            xp: 0,
            harm: null,
            leveled: [],
            found: [],
            revealed: null,
            cleared: null,
            rescued: null,
            lootLost: false,
          });
        }
      }
      for (const report of after.guild.reports) {
        expect(report).toMatchObject({ sold: [], lost: false });
      }
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, tile, expedição ou
      // relatório muda, ninguém ganha identificador e o gerador fica palavra por palavra.
      expect(after.map.tiles).toStrictEqual(before.map.tiles);
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect({ ...withoutOutcomes(after), schemaVersion: 17 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version17)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      const mine =
        /^(hero(Injured|Recovered|Captured|Died|Rescued|LeveledUp)|item|destination|threatTile)/;
      expect(atBoundary.events.filter((event) => mine.test(event.type))).toEqual([]);
      expect(state.ids.item).toBeUndefined();
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.guild.inventory).toEqual([]);
      expect(view.guild.captiveText).toBeNull();
      expect(view.guild.heroes.every((hero) => hero.injury === null && !hero.captive)).toBe(true);
      expect(view.guild.available.map((offer) => offer.modelId)).not.toContain('rescue');
      expect(view.guild.available.map((offer) => offer.modelId)).not.toContain('ruins');
      expect(view.threat.clearedText).toBeNull();
      // O soldo de ninguém muda com o passo.
      expect(view.guild.wage.perHour).toBe(
        state.guild.heroes.length * balance.heroes.wagePerHour * state.settings.timeScale,
      );
    },
  );

  it.each(withJourneys)(
    '$name: a expedição em curso continua de onde estava e termina pelas regras novas',
    (fixture) => {
      const state = migrated(fixture);
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month);
      // Toda expedição que estava em curso voltou ou se perdeu: nenhuma fica presa.
      for (const expedition of state.guild.expeditions) {
        expect(later.state.guild.expeditions.map((entry) => entry.id)).not.toContain(expedition.id);
        const ended = later.events.filter(
          (event) =>
            (event.type === 'expeditionReturned' || event.type === 'expeditionLost') &&
            event.data.expeditionId === expedition.id,
        );
        expect(ended).toHaveLength(1);
      }
      expect(currentShape(JSON.parse(JSON.stringify(later.state)), '')).toBeNull();
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion17(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow.guild.heroes).toMatchObject([
      { name: 'Brann', status: 'idle', injury: null, captivity: null },
    ]);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('um estado da versão 17 que já traz os campos da 18 é recusado: não é da versão que diz', () => {
    const stocked = asVersion17(newGame());
    stocked.guild.inventory = [];
    expect(() => migrateState(stocked, { timeScale: 1 })).toThrow(
      /guild\.inventory: campo desconhecido/,
    );
    const mapped = asVersion17(newGame());
    mapped.map.discovered = [];
    expect(() => migrateState(mapped, { timeScale: 1 })).toThrow(
      /map\.discovered: campo desconhecido/,
    );
    const staffed = newGame();
    addHero(staffed);
    const hurt = asVersion17(staffed);
    hurt.guild.heroes[0].status = 'injured';
    expect(() => migrateState(hurt, { timeScale: 1 })).toThrow(/guild\.heroes\.0\.status/);
    const armed = asVersion17(staffed);
    armed.guild.heroes[0].equipment = { weapon: null, armor: null, accessory: null };
    expect(() => migrateState(armed, { timeScale: 1 })).toThrow(
      /guild\.heroes\.0\.equipment: campo desconhecido/,
    );
  });
});

describe('versão 18 → 19', () => {
  const version18 = fixtures.filter((fixture) => fixture.version === 18);
  const withJourneys = version18.filter((fixture) => {
    const { guild } = read(fixture) as Draft;
    return guild.expeditions.length + guild.reports.length > 0;
  });

  it('há retratos da versão 18 com expedição em curso, com relatório e com um nó que deu errado', () => {
    expect(withJourneys.length).toBeGreaterThan(2);
    const entries = withJourneys.flatMap((fixture) => {
      const { guild } = read(fixture) as Draft;
      return [...guild.expeditions, ...guild.reports].flatMap(
        (journey: Draft) => journey.log as Draft[],
      );
    });
    expect(entries.some((entry) => entry.outcome === 'setback')).toBe(true);
    expect(entries.some((entry) => entry.outcome === 'chosen')).toBe(true);
    expect(entries.some((entry) => entry.outcome === 'passed')).toBe(true);
  });

  it('os tipos de lição da forma são os do motor', () => {
    // A versão 20 acrescentou `level`; a 19 continua com os quatro dela.
    const kinds: ExpeditionLessonKind[] = ['class', 'posture', 'item', 'strength'];
    expect(EXPEDITION_LESSON_KINDS_V19).toEqual(kinds);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v18-fresh.json'));
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version18)(
    '$name: só acrescenta a cada registro do percurso o destaque e a lição, vazios',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      for (const journey of [...after.guild.expeditions, ...after.guild.reports]) {
        for (const entry of journey.log) {
          // Nada é reconstituído: a versão 18 não escolhia quem se destacava.
          expect(entry.standout).toBeNull();
          expect(entry.lesson).toBeNull();
        }
      }
      // O resto é o estado antigo, campo por campo: nenhum estoque, prazo, herói, expedição ou
      // relatório muda, ninguém ganha identificador e o gerador fica palavra por palavra.
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect({ ...withoutReport(after), schemaVersion: 18 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version18)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const before = read(fixture) as Draft;
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type.startsWith('expedition'))).toEqual([]);
      expect(atBoundary.state.ids).toStrictEqual(before.ids);
      expect(atBoundary.state.rng).toStrictEqual(before.rng);
    },
  );

  it.each(withJourneys)(
    '$name: a expedição em curso termina pelas regras novas, e o relatório antigo continua legível',
    (fixture) => {
      const state = migrated(fixture);
      // O relatório gravado pela versão 18 não tem destaque: a visão não deixa lacuna à vista.
      const view = deriveViewState(state, state.lastProcessedAt);
      const texts = [...view.guild.reports, ...view.guild.expeditions].flatMap((journey) =>
        journey.log.map((step) => step.text),
      );
      for (const text of texts) {
        expect(text).not.toMatch(/[{}]/);
      }
      const month = Math.round(30 * DAY_REAL * state.settings.timeScale);
      const later = advanceTo(state, state.lastProcessedAt + month);
      // Toda expedição que estava em curso voltou ou se perdeu: nenhuma fica presa, mesmo com o
      // grafo trocado debaixo dela (o catálogo mudou na mesma tarefa).
      for (const expedition of state.guild.expeditions) {
        expect(later.state.guild.expeditions.map((entry) => entry.id)).not.toContain(expedition.id);
        const ended = later.events.filter(
          (event) =>
            (event.type === 'expeditionReturned' || event.type === 'expeditionLost') &&
            event.data.expeditionId === expedition.id,
        );
        expect(ended).toHaveLength(1);
      }
      expect(currentShape(JSON.parse(JSON.stringify(later.state)), '')).toBeNull();
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion18(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('um estado da versão 18 que já traz os campos da 19 é recusado, e a 19 recusa o destaque fora de uma prova e a lição fora de um desfecho ruim', () => {
    const journey = read(named('state-v18-hero-injured.json')) as Draft;
    const entry = journey.guild.reports[0].log.find((step: Draft) => step.outcome === 'setback');
    expect(entry).toBeDefined();
    entry.standout = 'Edda';
    expect(() => migrateState(journey, { timeScale: 3 })).toThrow(/standout: campo desconhecido/);
    const current = migrated(named('state-v18-hero-injured.json'));
    const broken = (edit: (step: Draft) => void, outcome: string): string | null => {
      const copy = JSON.parse(JSON.stringify(current)) as Draft;
      edit(copy.guild.reports[0].log.find((step: Draft) => step.outcome === outcome));
      return currentShape(copy, '');
    };
    expect(broken(() => undefined, 'setback')).toBeNull();
    expect(broken((step) => (step.standout = 'Edda'), 'setback')).toBeNull();
    expect(
      broken(
        (step) => (step.lesson = { kind: 'strength', heroName: null, posture: null }),
        'setback',
      ),
    ).toBeNull();
    expect(broken((step) => (step.standout = 'Edda'), 'chosen')).toMatch(/standout/);
    expect(
      broken((step) => (step.lesson = { kind: 'class', heroName: null, posture: null }), 'passed'),
    ).toMatch(/lesson/);
    expect(
      broken((step) => (step.lesson = { kind: 'luck', heroName: null, posture: null }), 'setback'),
    ).toMatch(/lesson\.kind/);
    expect(
      broken((step) => (step.lesson = { kind: 'item', heroName: null, posture: null }), 'setback'),
    ).toMatch(/lesson\.heroName/);
    expect(
      broken(
        (step) => (step.lesson = { kind: 'posture', heroName: 'Edda', posture: null }),
        'setback',
      ),
    ).toMatch(/lesson\.posture/);
  });
});

describe('versão 19 → 20', () => {
  const version19 = fixtures.filter((fixture) => fixture.version === 19);
  const withHeroes = version19.filter(
    (fixture) => (read(fixture) as Draft).guild.heroes.length > 0,
  );

  it('há retratos da versão 19 com heróis, com um cativo e com o soldo em atraso', () => {
    expect(withHeroes.length).toBeGreaterThan(5);
    const states = withHeroes.map((fixture) => read(fixture) as Draft);
    expect(
      states.some((state) => state.guild.heroes.some((hero: Draft) => hero.status === 'captured')),
    ).toBe(true);
    expect(states.some((state) => state.guild.wageArrears !== null)).toBe(true);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v19-fresh.json'));
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version19)('$name: só acrescenta a cada herói a volta do cativeiro, vazia', (fixture) => {
    const before = read(fixture) as Draft;
    const after = migrated(fixture);
    expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    for (const hero of after.guild.heroes) {
      // Nada é reconstituído: a versão 19 não guardava a volta.
      expect(hero.freedAtMs).toBeNull();
    }
    expect(after.rng).toStrictEqual(before.rng);
    expect(after.ids).toStrictEqual(before.ids);
    expect({ ...withoutFreed(after), schemaVersion: 19 }).toStrictEqual({
      ...before,
      migratedAtMs: before.lastProcessedAt,
    });
  });

  it.each(version19)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const before = read(fixture) as Draft;
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type.startsWith('hero'))).toEqual([]);
      expect(atBoundary.state.ids).toStrictEqual(before.ids);
      expect(atBoundary.state.rng).toStrictEqual(before.rng);
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    addHero(start, { name: 'Brann' });
    const old = asVersion19(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('os tipos de lição da forma são os do motor, e só a versão 20 aceita a lição da equipe completa', () => {
    const kinds: ExpeditionLessonKind[] = ['class', 'posture', 'item', 'strength', 'level'];
    expect(EXPEDITION_LESSON_KINDS_V20).toEqual(kinds);
    const old = read(named('state-v19-hero-injured.json')) as Draft;
    const setback = (state: Draft): Draft =>
      state.guild.reports[0].log.find((step: Draft) => step.outcome === 'setback');
    expect(setback(old)).toBeDefined();
    setback(old).lesson = { kind: 'level', heroName: null, posture: null };
    expect(() => migrateState(old, { timeScale: 3 })).toThrow(/lesson\.kind/);
    const current = JSON.parse(
      JSON.stringify(migrated(named('state-v19-hero-injured.json'))),
    ) as Draft;
    setback(current).lesson = { kind: 'level', heroName: null, posture: null };
    expect(currentShape(current, '')).toBeNull();
    setback(current).lesson = { kind: 'level', heroName: 'Edda', posture: null };
    expect(currentShape(current, '')).toMatch(/lesson\.heroName/);
  });

  it('um estado da versão 19 que já traz o campo da 20 é recusado, e a 20 recusa a volta no futuro ou antes da chegada', () => {
    const old = read(named('state-v19-hero-captured.json')) as Draft;
    old.guild.heroes[0].freedAtMs = null;
    expect(() => migrateState(old, { timeScale: 3 })).toThrow(/freedAtMs: campo desconhecido/);
    const current = migrated(named('state-v19-hero-captured.json'));
    const broken = (edit: (hero: Draft) => void): string | null => {
      const copy = JSON.parse(JSON.stringify(current)) as Draft;
      edit(copy.guild.heroes[0]);
      return currentShape(copy, '');
    };
    expect(broken(() => undefined)).toBeNull();
    expect(broken((hero) => (hero.freedAtMs = hero.joinedAtMs))).toBeNull();
    expect(broken((hero) => (hero.freedAtMs = current.lastProcessedAt + 1))).toMatch(
      /freedAtMs: herói que voltou do cativeiro depois de agora/,
    );
    expect(
      broken((hero) => {
        hero.joinedAtMs = 10;
        hero.freedAtMs = 9;
      }),
    ).toMatch(/freedAtMs: herói que voltou do cativeiro antes de chegar/);
    expect(broken((hero) => (hero.freedAtMs = -1))).toMatch(/freedAtMs/);
    expect(broken((hero) => delete hero.freedAtMs)).toMatch(/freedAtMs/);
  });
});

describe('versão 20 → 21', () => {
  const version20 = fixtures.filter((fixture) => fixture.version === 20);
  const NO_MARKET = {
    prices: { food: 1000, wood: 1200, stone: 2000 },
    previousPrices: { food: 1000, wood: 1200, stone: 2000 },
    quoteDay: 0,
    tradedToday: { food: 0, wood: 0, stone: 0 },
    // As caravanas são da versão 22: toda partida antiga chega sem nenhuma na estrada.
    caravans: [],
  };

  it('os identificadores e os preços escritos na forma e no passo são os do conteúdo de hoje', () => {
    expect(BUILDING_IDS_V21).toEqual([...BUILDING_IDS]);
    expect(MARKET_RESOURCE_IDS_V21).toEqual([...MARKET_RESOURCE_IDS]);
    expect(MARKET_RESOURCE_IDS_V21).toEqual([...balance.market.resources]);
    expect(RNG_FIXED_STREAMS_V21).toEqual([...RNG_FIXED_STREAMS_V16, 'market']);
    expect(MARKET_BASE_PRICES_V21).toEqual(balance.market.basePrice);
  });

  it('há retratos da versão 20 com o Salão no nível 3 ou mais, com obra em curso e com o gerador em uso', () => {
    expect(version20.length).toBeGreaterThan(30);
    const states = version20.map((fixture) => read(fixture) as Draft);
    expect(states.some((state) => state.settlement.buildings.townHall >= 3)).toBe(true);
    expect(
      states.some((state) =>
        state.settlement.constructionQueues.some((slot: unknown) => slot !== null),
      ),
    ).toBe(true);
    expect(states.some((state) => Object.keys(state.rng).length >= 3)).toBe(true);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v20-fresh.json'));
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version20)(
    '$name: só acrescenta o Mercado, por erguer, com os preços na base e nada negociado',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.settlement.buildings.market).toBe(0);
      expect(after.market).toStrictEqual(NO_MARKET);
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.rng.market).toBeUndefined();
      expect(after.ids).toStrictEqual(before.ids);
      expect({ ...withoutMarket(after), schemaVersion: 20 }).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version20)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const before = read(fixture) as Draft;
      const state = migrated(fixture);
      expect(nextEventAt(state)).toBe(
        nextEventAt({ ...state, market: { ...state.market, quoteDay: 99 } }),
      );
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type.startsWith('market'))).toEqual([]);
      expect(atBoundary.state.market).toStrictEqual(NO_MARKET);
      expect(atBoundary.state.ids).toStrictEqual(before.ids);
      expect(atBoundary.state.rng).toStrictEqual(before.rng);
    },
  );

  it.each(version20)(
    '$name: sem o Mercado, os preços não andam por mais dias que passem, e o fluxo dele não nasce',
    (fixture) => {
      const state = migrated(fixture);
      const later = advanceTo(state, state.lastProcessedAt + 3 * 2 * HOUR + 7).state;
      if (later.settlement.buildings.market === 0) {
        expect(later.market).toStrictEqual(NO_MARKET);
        expect(later.rng.market).toBeUndefined();
      }
      // A visão diz como obter o Mercado e não mostra preço nenhum.
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.market).toMatchObject({
        level: 0,
        quoteDay: 0,
        nextChangeInSeconds: null,
        prices: [],
      });
      const listed = view.constructions.available.find((entry) => entry.building === 'market');
      expect(listed).toMatchObject({ fromLevel: 0, targetLevel: 1 });
      // Com o Salão no nível 3 a obra não fica presa por ele (pode ficar pela fila ou pelo custo).
      if (state.settlement.buildings.townHall >= 3) {
        expect(listed?.blockedCode).not.toBe('GATE_LOCKED');
      }
    },
  );

  it('quem já tem o Salão no nível 3 ergue o Mercado logo depois da migração, e o preço anda na primeira virada com ele de pé', () => {
    const start = advanceTo(newGame('mercado-migrado'), 20 * HOUR).state;
    const old = asVersion20(start);
    old.settlement.buildings.townHall = 3;
    old.settlement.constructionQueues = [null, null];
    old.settlement.planned = [];
    Object.assign(old.settlement.resources, { wood: 400_000, stone: 400_000, gold: 400_000 });
    const state = migrateState(old, { timeScale: 1 });
    expect(state.migratedAtMs).toBe(20 * HOUR);
    const ordered = applyCommand(
      state,
      command('startConstruction', { building: 'market' }),
      state.lastProcessedAt,
    );
    expect(ordered.ok).toBe(true);
    if (!ordered.ok) {
      return;
    }
    const opened = advanceTo(ordered.state, 21 * HOUR).state;
    expect(opened.settlement.buildings.market).toBe(1);
    expect(opened.market).toStrictEqual(NO_MARKET);
    // A virada seguinte é a das 22 h de jogo: o 12º dia.
    const turned = advanceTo(opened, 22 * HOUR).state;
    expect(turned.market.quoteDay).toBe(12);
    expect(turned.market.previousPrices).toStrictEqual(NO_MARKET.prices);
    expect(turned.rng.market).toBeDefined();
  });

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    const old = asVersion20(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow.migratedAtMs).toBe(20 * HOUR);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('um estado da versão 20 que já traz o Mercado é recusado, e a 21 recusa o Mercado fora da forma', () => {
    const old = read(named('state-v20-fresh.json')) as Draft;
    old.market = NO_MARKET;
    expect(() => migrateState(old, { timeScale: 1 })).toThrow(/market: campo desconhecido/);
    const built = read(named('state-v20-fresh.json')) as Draft;
    built.settlement.buildings.market = 0;
    expect(() => migrateState(built, { timeScale: 1 })).toThrow(/buildings\.market/);
    const streamed = read(named('state-v20-fresh.json')) as Draft;
    streamed.rng.market = [1, 2, 3, 4];
    expect(() => migrateState(streamed, { timeScale: 1 })).toThrow(/rng\.market/);

    const current = migrated(named('state-v20-fresh.json'));
    const broken = (edit: (state: Draft) => void): string | null => {
      const copy = JSON.parse(JSON.stringify(current)) as Draft;
      edit(copy);
      return currentShape(copy, '');
    };
    expect(broken(() => undefined)).toBeNull();
    expect(broken((state) => delete state.market)).toMatch(/market/);
    expect(broken((state) => (state.market.prices.food = 0))).toMatch(/market\.prices\.food/);
    expect(broken((state) => (state.market.prices.food = 1.5))).toMatch(/market\.prices\.food/);
    expect(broken((state) => (state.market.prices.iron = 8000))).toMatch(/market\.prices\.iron/);
    expect(broken((state) => delete state.market.prices.stone)).toMatch(/market\.prices\.stone/);
    expect(broken((state) => (state.market.tradedToday.wood = -1))).toMatch(
      /market\.tradedToday\.wood/,
    );
    expect(broken((state) => (state.market.quoteDay = -1))).toMatch(/market\.quoteDay/);
    expect(broken((state) => (state.market.effects = []))).toMatch(/market\.effects/);
    expect(broken((state) => delete state.market.caravans)).toMatch(/market\.caravans/);
    // Sem o edifício nada andou: nem cotação, nem negociação, nem preço diferente do de ontem.
    expect(broken((state) => (state.market.quoteDay = 3))).toBe(
      'market.quoteDay: cotação sem Mercado',
    );
    expect(broken((state) => (state.market.tradedToday.food = 5))).toBe(
      'market.tradedToday.food: negociação sem Mercado',
    );
    expect(broken((state) => (state.market.prices.wood = 1300))).toBe(
      'market.previousPrices.wood: preço que andou sem Mercado',
    );
    // Com o edifício, o fluxo e a cotação andam juntos.
    const open = (edit: (state: Draft) => void) =>
      broken((state) => {
        state.settlement.buildings.market = 1;
        edit(state);
      });
    expect(open(() => undefined)).toBeNull();
    expect(open((state) => (state.market.tradedToday.food = 5))).toBeNull();
    expect(open((state) => (state.market.quoteDay = 3))).toBe(
      'market.quoteDay: cotação feita sem o fluxo do Mercado',
    );
    expect(open((state) => (state.rng.market = [1, 2, 3, 4]))).toBe(
      'rng.market: fluxo do Mercado sem cotação feita',
    );
    expect(
      open((state) => {
        state.market.quoteDay = 3;
        state.market.prices.wood = 1300;
        state.rng.market = [1, 2, 3, 4];
      }),
    ).toBeNull();
  });
});

describe('versão 21 → 22', () => {
  const version21 = fixtures.filter((fixture) => fixture.version === 21);
  /** Um estado da versão atual como a versão 21 o gravava: sem a lista de caravanas. */
  const asVersion21 = (state: GameState): Draft => {
    const old = JSON.parse(JSON.stringify(state)) as Draft;
    old.schemaVersion = 21;
    stripMasters(old);
    delete old.market.caravans;
    return old;
  };

  it('há retratos da versão 21 com o Mercado de pé, com heróis e com expedição em curso', () => {
    expect(version21.length).toBeGreaterThan(35);
    const states = version21.map((fixture) => read(fixture) as Draft);
    expect(states.some((state) => state.settlement.buildings.market > 0)).toBe(true);
    expect(states.some((state) => state.guild.heroes.length > 0)).toBe(true);
    expect(states.some((state) => state.guild.expeditions.length > 0)).toBe(true);
    expect(states.some((state) => state.rng.market !== undefined)).toBe(true);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v21-fresh.json'));
    expect(fresh.market.caravans).toEqual([]);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version21)(
    '$name: só acrescenta a lista de caravanas, vazia; ninguém muda de estado, e o gerador e os contadores ficam como estavam',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.market.caravans).toEqual([]);
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect(after.ids.caravan).toBeUndefined();
      expect(after.guild.heroes.map((hero) => hero.status)).toEqual(
        before.guild.heroes.map((hero: { status: string }) => hero.status),
      );
      expect(asVersion21(after)).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version21)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const before = read(fixture) as Draft;
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type.startsWith('caravan'))).toEqual([]);
      expect(atBoundary.state.market.caravans).toEqual([]);
      expect(atBoundary.state.ids).toStrictEqual(before.ids);
      expect(Object.keys(atBoundary.state.rng).filter((key) => key.startsWith('caravan:'))).toEqual(
        [],
      );
      // Trinta dias sem ordem nenhuma: nenhuma caravana nasce sozinha.
      const later = advanceTo(state, state.lastProcessedAt + 30 * 2 * HOUR).state;
      expect(later.market.caravans).toEqual([]);
      expect(later.ids.caravan).toBeUndefined();
    },
  );

  it('quem já tem o Mercado no nível 2 manda uma caravana logo depois da migração, e ela chega 4 h de jogo depois', () => {
    const old = read(named('state-v21-market.json')) as Draft;
    old.settlement.buildings.market = 2;
    const state = migrateState(old, { timeScale: 3 });
    const sent = applyCommand(
      state,
      command('sendCaravan', {
        resource: 'food',
        amount: 50,
        escortHeroId: null,
        quoteDay: state.market.quoteDay,
      }),
      state.lastProcessedAt,
    );
    if (!sent.ok) {
      throw new Error(sent.message);
    }
    expect(sent.state.market.caravans).toHaveLength(1);
    expect(sent.state.ids.caravan).toBe(1);
    const arrived = advanceTo(sent.state, state.lastProcessedAt + balance.market.caravan.tripMs);
    expect(arrived.state.market.caravans).toEqual([]);
    expect(
      arrived.events.filter(
        (event) => event.type === 'caravanArrived' || event.type === 'caravanAmbushed',
      ),
    ).toHaveLength(1);
  });

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    const old = asVersion21(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('um estado da versão 21 que já traz caravanas ou um herói em escolta é recusado', () => {
    const old = read(named('state-v21-fresh.json')) as Draft;
    old.market.caravans = [];
    expect(() => migrateState(old, { timeScale: 1 })).toThrow(
      /market\.caravans: campo desconhecido/,
    );
    const guild = read(named('state-v21-guild.json')) as Draft;
    guild.guild.heroes[0].status = 'escort';
    expect(() => migrateState(guild, { timeScale: 3 })).toThrow(/guild\.heroes\.0\.status/);
  });

  it('a 22 recusa a caravana fora da forma, fora do tempo, sem Mercado, sem escolta de verdade e o fluxo de quem não está na estrada', () => {
    // Um feudo com o Mercado no nível 4, dois heróis e duas caravanas na estrada, uma com escolta.
    const road = JSON.parse(JSON.stringify(caravanEscortScenario())) as Draft;
    const broken = (edit: (state: Draft) => void): string | null => {
      const copy = JSON.parse(JSON.stringify(road)) as Draft;
      edit(copy);
      return currentShape(copy, '');
    };
    const first = (state: Draft) => state.market.caravans[0];
    expect(broken(() => undefined)).toBeNull();
    expect(road.market.caravans).toHaveLength(2);
    expect(broken((state) => (first(state).id = 'caravan-0'))).toMatch(/caravans\.0\.id/);
    expect(broken((state) => (first(state).id = 'expedition-1'))).toMatch(/caravans\.0\.id/);
    expect(broken((state) => (first(state).resource = 'gold'))).toMatch(/caravans\.0\.resource/);
    expect(broken((state) => (first(state).amount = 0))).toMatch(/caravans\.0\.amount/);
    expect(broken((state) => (first(state).amount = 1.5))).toMatch(/caravans\.0\.amount/);
    expect(broken((state) => (first(state).unitPrice = 0))).toMatch(/caravans\.0\.unitPrice/);
    expect(broken((state) => delete first(state).escortHeroId)).toMatch(
      /caravans\.0\.escortHeroId: campo ausente/,
    );
    // O desfecho não cabe no estado: ele só existe na chegada.
    expect(broken((state) => (first(state).ambushed = true))).toBe(
      'market.caravans.0.ambushed: campo desconhecido',
    );
    expect(broken((state) => (state.market.caravans[1].id = 'caravan-9'))).toBe(
      'market.caravans.1.id: caravana além do contador de ids.caravan',
    );
    expect(broken((state) => state.market.caravans.reverse())).toBe(
      'market.caravans.1.id: caravanas fora da ordem de identificador',
    );
    expect(
      broken((state) => {
        state.ids.caravan = 3;
        state.market.caravans.push({ ...state.market.caravans[1], id: 'caravan-3' });
      }),
    ).toBe('market.caravans: esperada lista de até 2 caravanas, veio de 3');
    expect(broken((state) => (first(state).arrivesAtMs = state.lastProcessedAt))).toBe(
      'market.caravans.0.arrivesAtMs: chegada vencida e não processada',
    );
    expect(
      broken((state) => {
        state.settlement.buildings.market = 0;
        state.market.quoteDay = 0;
        state.market.previousPrices = { ...state.market.prices };
        state.market.tradedToday = { food: 0, wood: 0, stone: 0 };
        delete state.rng.market;
      }),
    ).toBe('market.caravans: caravana sem Mercado');
    // A escolta: quem escolta está em escolta, em uma caravana só, e quem está em escolta escolta.
    expect(broken((state) => (first(state).escortHeroId = 'hero-2'))).toBe(
      'market.caravans.0.escortHeroId: herói que não serve ao feudo em escolta',
    );
    expect(broken((state) => (first(state).escortHeroId = 'hero-9'))).toBe(
      'market.caravans.0.escortHeroId: herói que não serve ao feudo em escolta',
    );
    expect(broken((state) => (first(state).escortHeroId = null))).toBe(
      'guild.heroes.0.status: herói em escolta sem caravana',
    );
    expect(broken((state) => (state.market.caravans[1].escortHeroId = 'hero-1'))).toBe(
      'market.caravans.1.escortHeroId: herói em duas escoltas',
    );
    expect(
      broken((state) => {
        state.guild.heroes[0].injury = { severity: 'light', untilMs: state.lastProcessedAt + 1 };
      }),
    ).toBe('guild.heroes.0.injury: herói em escolta com ferimento');
    // O fluxo (R2): só o de uma caravana na estrada cabe; o de uma que já chegou, não.
    expect(broken((state) => (state.rng['caravan:caravan-2'] = [1, 2, 3, 4]))).toBeNull();
    expect(
      broken((state) => {
        state.ids.caravan = 3;
        state.rng['caravan:caravan-3'] = [1, 2, 3, 4];
      }),
    ).toBe('rng.caravan:caravan-3: fluxo de uma caravana que não está na estrada');
    expect(broken((state) => (state.rng['caravan:caravan-7'] = [1, 2, 3, 4]))).toBe(
      'rng.caravan:caravan-7: fluxo de uma entidade além do contador de ids.caravan',
    );
  });
});

describe('versão 22 → 23', () => {
  const version22 = fixtures.filter((fixture) => fixture.version === 22);
  const journeysOf = (state: Draft): Draft[] => [
    ...(state.guild.expeditions as Draft[]),
    ...(state.guild.reports as Draft[]),
  ];

  it('os identificadores e os tetos escritos na forma são os do conteúdo de hoje', () => {
    expect(MASTER_IDS_V23).toEqual([...MASTER_IDS]);
    expect(PRODUCTION_BUILDING_IDS_V23).toEqual([...PRODUCTION_BUILDING_IDS]);
    expect(MASTERS_CAP_V23).toBe(balance.masters.rosterCap);
    // A guarda recusa dois Mestres no mesmo edifício: é o `maxPerBuilding` do conteúdo.
    expect(balance.masters.maxPerBuilding).toBe(1);
  });

  it('há retratos da versão 22 com expedição em curso, com relatório guardado, com casas cheias e com gente em adaptação', () => {
    expect(version22.length).toBeGreaterThan(40);
    const states = version22.map((fixture) => read(fixture) as Draft);
    expect(states.some((state) => state.guild.expeditions.length > 0)).toBe(true);
    expect(states.some((state) => state.guild.reports.length > 0)).toBe(true);
    expect(
      states.some((state) => journeysOf(state).some((journey) => journey.log.length > 0)),
    ).toBe(true);
    expect(states.some((state) => state.settlement.adaptation.length > 0)).toBe(true);
    expect(states.some((state) => state.settlement.injured.length > 0)).toBe(true);
  });

  it('o que o passo escreve é o que uma partida nova tem', () => {
    const fresh = migrated(named('state-v22-fresh.json'));
    expect(fresh.settlement.masters).toEqual([]);
    expect(fresh.settlement.mastersWaiting).toEqual([]);
    expect({ ...fresh, migratedAtMs: null }).toEqual(newGame('fixture-fresh'));
  });

  it.each(version22)(
    '$name: só acrescenta as duas listas de Mestres, vazias, e o Mestre de cada registro do percurso, nulo; os aldeões, o gerador e os contadores ficam como estavam',
    (fixture) => {
      const before = read(fixture) as Draft;
      const after = migrated(fixture);
      expect(after.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
      expect(after.settlement.masters).toEqual([]);
      expect(after.settlement.mastersWaiting).toEqual([]);
      expect(after.settlement.population).toStrictEqual(before.settlement.population);
      expect(after.settlement.workers).toStrictEqual(before.settlement.workers);
      expect(after.rng).toStrictEqual(before.rng);
      expect(after.ids).toStrictEqual(before.ids);
      expect(after.ids.master).toBeUndefined();
      for (const journey of journeysOf(after as unknown as Draft)) {
        for (const entry of journey.log as Draft[]) {
          expect(entry.master).toBeNull();
        }
      }
      expect(asVersion22(after)).toStrictEqual({
        ...before,
        migratedAtMs: before.lastProcessedAt,
      });
    },
  );

  it.each(version22)(
    '$name: nada acontece na fronteira, e o passo não cria prazo, identificador nem sorteio',
    (fixture) => {
      const before = read(fixture) as Draft;
      const state = migrated(fixture);
      const atBoundary = advanceTo(state, state.lastProcessedAt + 1);
      expect(atBoundary.events.filter((event) => event.type.startsWith('master'))).toEqual([]);
      expect(atBoundary.state.settlement.masters).toEqual([]);
      expect(atBoundary.state.settlement.mastersWaiting).toEqual([]);
      expect(atBoundary.state.ids.master).toBeUndefined();
      expect(atBoundary.state.ids).toStrictEqual(before.ids);
      // Trinta dias sem ordem nenhuma e sem expedição ao lugar certo: nenhum Mestre nasce sozinho
      // do passo (o que uma expedição em curso encontrar é regra do motor, não do passo).
      expect(Object.keys(atBoundary.state.rng).filter((key) => key.startsWith('master'))).toEqual(
        [],
      );
    },
  );

  it('o passo não altera a entrada e não depende do ritmo nem da fronteira', () => {
    const start = advanceTo(newGame(), 20 * HOUR).state;
    const old = asVersion22(start);
    const copy = JSON.parse(JSON.stringify(old)) as unknown;
    const slow = migrateState(old, { timeScale: 0.5 });
    const fast = migrateState(old, { timeScale: 3 });
    expect(old).toEqual(copy);
    expect(slow).toEqual(fast);
    expect(slow).toEqual({ ...start, migratedAtMs: 20 * HOUR });
  });

  it('um estado da versão 22 que já traz Mestres, ou um registro com Mestre, é recusado', () => {
    const old = read(named('state-v22-fresh.json')) as Draft;
    old.settlement.masters = [];
    expect(() => migrateState(old, { timeScale: 1 })).toThrow(
      /settlement\.masters: campo desconhecido/,
    );
    const away = read(named('state-v22-expedition-returning.json')) as Draft;
    (journeysOf(away)[0] as Draft).log[0].master = null;
    expect(() => migrateState(away, { timeScale: 1 })).toThrow(
      /log\.0\.master: campo desconhecido/,
    );
  });

  it('a 23 recusa o Mestre fora da forma, repetido, fora da ordem, além do contador, em edifício ocupado e em adaptação sem edifício ou vencida', () => {
    // Odo na Pedreira, já adaptado, e Berta na Fazenda, em adaptação.
    const crafted = JSON.parse(JSON.stringify(mastersScenario())) as Draft;
    const broken = (edit: (state: Draft) => void, from: Draft = crafted): string | null => {
      const copy = JSON.parse(JSON.stringify(from)) as Draft;
      edit(copy);
      return currentShape(copy, '');
    };
    const first = (state: Draft) => state.settlement.masters[0];
    const second = (state: Draft) => state.settlement.masters[1];
    expect(broken(() => undefined)).toBeNull();
    expect(crafted.settlement.masters).toHaveLength(2);
    expect(broken((state) => (first(state).id = 'master-0'))).toMatch(/masters\.0\.id/);
    expect(broken((state) => (first(state).id = 'hero-1'))).toMatch(/masters\.0\.id/);
    expect(broken((state) => (first(state).masterId = 'merlin'))).toMatch(/masters\.0\.masterId/);
    expect(broken((state) => (first(state).building = 'tavern'))).toMatch(/masters\.0\.building/);
    expect(broken((state) => (first(state).adaptingUntilMs = 1.5))).toMatch(
      /masters\.0\.adaptingUntilMs/,
    );
    expect(broken((state) => delete first(state).building)).toBe(
      'settlement.masters.0.building: campo ausente',
    );
    // O Mestre não tem nome gravado, nem posto, nem data de partida.
    expect(broken((state) => (first(state).name = 'Odo'))).toBe(
      'settlement.masters.0.name: campo desconhecido',
    );
    expect(broken((state) => (second(state).masterId = 'odo'))).toBe(
      'settlement.masters.1.masterId: o mesmo Mestre duas vezes',
    );
    expect(broken((state) => state.settlement.masters.reverse())).toBe(
      'settlement.masters.1.id: Mestres fora da ordem de chegada',
    );
    expect(broken((state) => (second(state).id = 'master-9'))).toBe(
      'settlement.masters.1.id: Mestre além do contador de ids.master',
    );
    expect(broken((state) => (second(state).building = 'quarry'))).toBe(
      'settlement.masters.1.building: dois Mestres no mesmo edifício',
    );
    expect(
      broken((state) => {
        second(state).building = null;
      }),
    ).toBe('settlement.masters.1.adaptingUntilMs: Mestre sem edifício em adaptação');
    expect(broken((state) => (second(state).adaptingUntilMs = state.lastProcessedAt))).toBe(
      'settlement.masters.1.adaptingUntilMs: adaptação vencida e não processada',
    );
    // O teto vale para a soma do feudo com a porta.
    expect(
      broken((state) => {
        state.ids.master = 5;
        state.settlement.masters.push(
          { id: 'master-3', masterId: 'gil', building: null, adaptingUntilMs: null },
          { id: 'master-4', masterId: 'ximena', building: null, adaptingUntilMs: null },
        );
        state.settlement.mastersWaiting.push({ id: 'master-5', masterId: 'odo' });
      }),
    ).toBe('settlement.masters: esperados até 4 Mestres, no feudo e à porta, vieram 5');
    // A porta: só quem é; em ordem, depois de quem já entrou, sem repetir ninguém.
    const atDoor = JSON.parse(JSON.stringify(masterWaitingScenario())) as Draft;
    expect(broken(() => undefined, atDoor)).toBeNull();
    expect(broken((state) => (state.settlement.mastersWaiting[0].building = null), atDoor)).toBe(
      'settlement.mastersWaiting.0.building: campo desconhecido',
    );
    expect(broken((state) => (state.settlement.mastersWaiting[0].masterId = 'odo'), atDoor)).toBe(
      'settlement.mastersWaiting.0.masterId: o mesmo Mestre duas vezes',
    );
    expect(broken((state) => (state.settlement.mastersWaiting[0].id = 'master-1'), atDoor)).toBe(
      'settlement.mastersWaiting.0.id: Mestres fora da ordem de chegada',
    );
    expect(broken((state) => (state.settlement.mastersWaiting[0].id = 'master-3'), atDoor)).toBe(
      'settlement.mastersWaiting.0.id: Mestre além do contador de ids.master',
    );
    // Mestre nenhum tem fluxo de sorteio: a família não existe.
    expect(broken((state) => (state.rng['master:master-1'] = [1, 2, 3, 4]))).toMatch(/rng/);
  });

  it('a 23 recusa o registro do percurso sem o Mestre, com um Mestre que o conteúdo não tem e com Mestre em nó perdido ou em escolha', () => {
    const away = migrated(named('state-v22-expedition-returning.json')) as unknown as Draft;
    const broken = (edit: (entry: Draft, state: Draft) => void): string | null => {
      const copy = JSON.parse(JSON.stringify(away)) as Draft;
      const journey = journeysOf(copy).find((entry) => entry.log.length > 0) as Draft;
      edit(journey.log[0], copy);
      return currentShape(copy, '');
    };
    expect(broken(() => undefined)).toBeNull();
    expect(broken((entry) => delete entry.master)).toMatch(/log\.0\.master: campo ausente/);
    expect(broken((entry) => (entry.master = 'merlin'))).toMatch(/log\.0\.master/);
    expect(
      broken((entry) => {
        entry.master = 'odo';
        entry.outcome = 'chosen';
        entry.optionId = 'stream';
        entry.decidedBy = 'player';
        entry.xp = 0;
        entry.standout = null;
        entry.lesson = null;
        entry.harm = null;
        entry.lootLost = false;
        entry.found = [];
      }),
    ).toMatch(/log\.0\.master: só um nó vencido encontra um Mestre/);
  });

  it('quem migra recebe um Mestre, dá-lhe um edifício e o vê render logo depois da migração', () => {
    const old = read(named('state-v22-crafts.json')) as Draft;
    const state = JSON.parse(JSON.stringify(migrateState(old, { timeScale: 1 }))) as GameState;
    const arrived: GameEvent[] = [];
    expect(deliverMaster(state, 'odo', state.lastProcessedAt, arrived)).toBe(true);
    expect(arrived.map((event) => event.type)).toEqual(['masterArrived']);
    const assigned = applyCommand(
      state,
      masterOrder('master-1', 'goldMine'),
      state.lastProcessedAt,
    );
    if (!assigned.ok) {
      throw new Error(assigned.message);
    }
    expect(assigned.state.settlement.masters).toEqual([
      {
        id: 'master-1',
        masterId: 'odo',
        building: 'goldMine',
        adaptingUntilMs: state.lastProcessedAt + balance.masters.adaptationMs,
      },
    ]);
    const settled = advanceTo(
      assigned.state,
      state.lastProcessedAt + balance.masters.adaptationMs,
    ).state;
    expect(settled.settlement.masters[0]?.adaptingUntilMs).toBeNull();
    expect(currentShape(settled, '')).toBeNull();
  });
});
