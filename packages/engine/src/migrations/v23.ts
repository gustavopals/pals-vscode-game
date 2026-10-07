import { exactObject, listOf, literal, natural, nullable, oneOf, type Shape } from './shape';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { expeditionsWithinState, where } from './v17';
import { expeditionShapesOf, outcomesWithinState } from './v18';
import { logEntryShapeOf } from './v19';
import { EXPEDITION_LESSON_KINDS_V20, freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21, settlementV21Fields } from './v21';
import { caravansWithinState, guildV22Fields, stateV22Fields } from './v22';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`MASTER_IDS`, `PRODUCTION_BUILDING_IDS`, `balance.masters.rosterCap` e `maxPerBuilding`).
export const MASTER_IDS_V23: readonly string[] = ['odo', 'berta', 'gil', 'ximena'];
export const PRODUCTION_BUILDING_IDS_V23: readonly string[] = [
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
];
/** Quantos Mestres o estado guarda, somando os do feudo e os que esperam à porta. */
export const MASTERS_CAP_V23 = 4;

const MASTER_ID = /^master-([1-9][0-9]*)$/;

const masterEntityId: Shape = (value, path) =>
  typeof value === 'string' && MASTER_ID.test(value) && Number.isSafeInteger(Number(value.slice(7)))
    ? null
    : `${where(path)}: esperado um identificador de Mestre (master-<n>)`;

/** Um Mestre do feudo: quem é, onde trabalha e até quando se adapta. */
const master: Shape = exactObject({
  id: masterEntityId,
  masterId: oneOf(MASTER_IDS_V23),
  building: nullable(oneOf(PRODUCTION_BUILDING_IDS_V23)),
  adaptingUntilMs: nullable(natural),
});

/** Um Mestre à porta: só quem é. Não tem edifício nem adaptação enquanto espera. */
const waitingMaster: Shape = exactObject({
  id: masterEntityId,
  masterId: oneOf(MASTER_IDS_V23),
});

type MasterV23 = {
  id: string;
  masterId: string;
  building?: string | null;
  adaptingUntilMs?: number | null;
};

type MastersState = {
  settlement: { masters: MasterV23[]; mastersWaiting: MasterV23[] };
  ids: Record<string, number>;
  lastProcessedAt: number;
};

const numberOf = (entry: MasterV23) => Number(entry.id.slice(7));

/**
 * A conferência dos Mestres com o resto do estado, que uma guarda de campo não alcança:
 *
 * - os do feudo e os da porta, somados, cabem no teto;
 * - cada lista está em ordem de identificador (a ordem de chegada), e quem está à porta chegou
 *   depois de todos os que já entraram: a porta é uma fila;
 * - todo identificador é um que `nextId` já deu (`1 ≤ n ≤ ids.master`);
 * - **um Mestre com nome é um só**, no feudo e na porta;
 * - no máximo um Mestre por edifício;
 * - só se adapta quem tem edifício, e o prazo é futuro: o que venceu já foi processado no
 *   instante dele.
 */
export const mastersWithinState: Shape = (value, path) => {
  const { settlement, ids, lastProcessedAt } = value as MastersState;
  const at = path === '' ? 'settlement' : `${path}.settlement`;
  const { masters, mastersWaiting } = settlement;
  if (masters.length + mastersWaiting.length > MASTERS_CAP_V23) {
    return `${at}.masters: esperados até ${MASTERS_CAP_V23} Mestres, no feudo e à porta, vieram ${masters.length + mastersWaiting.length}`;
  }
  const issued = Object.hasOwn(ids, 'master') ? (ids.master as number) : 0;
  const names = new Set<string>();
  const places = new Set<string>();
  let previous = 0;
  const lists: Array<[string, MasterV23[]]> = [
    ['masters', masters],
    ['mastersWaiting', mastersWaiting],
  ];
  for (const [field, list] of lists) {
    for (const [index, entry] of list.entries()) {
      const here = `${at}.${field}.${index}`;
      if (numberOf(entry) <= previous) {
        return `${here}.id: Mestres fora da ordem de chegada`;
      }
      previous = numberOf(entry);
      if (previous > issued) {
        return `${here}.id: Mestre além do contador de ids.master`;
      }
      if (names.has(entry.masterId)) {
        return `${here}.masterId: o mesmo Mestre duas vezes`;
      }
      names.add(entry.masterId);
      if (field !== 'masters') {
        continue;
      }
      if (entry.building !== null && entry.building !== undefined) {
        if (places.has(entry.building)) {
          return `${here}.building: dois Mestres no mesmo edifício`;
        }
        places.add(entry.building);
      }
      if (entry.adaptingUntilMs === null || entry.adaptingUntilMs === undefined) {
        continue;
      }
      if (entry.building === null) {
        return `${here}.adaptingUntilMs: Mestre sem edifício em adaptação`;
      }
      if (entry.adaptingUntilMs <= lastProcessedAt) {
        return `${here}.adaptingUntilMs: adaptação vencida e não processada`;
      }
    }
  }
  return null;
};

const logEntryV20: Shape = logEntryShapeOf(EXPEDITION_LESSON_KINDS_V20);
const masterRef: Shape = nullable(oneOf(MASTER_IDS_V23));

/**
 * Um registro do percurso da versão 23: o da 20 com o Mestre que a equipe encontrou no nó. Uma
 * escolha de encruzilhada não encontra ninguém, nem o Revés, nem o Desastre.
 */
const logEntry: Shape = (value, path) => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return logEntryV20(value, path);
  }
  if (!Object.hasOwn(value, 'master')) {
    return `${path === '' ? '' : `${path}.`}master: campo ausente`;
  }
  const { master: found, ...rest } = value as Record<string, unknown>;
  const problem =
    logEntryV20(rest, path) ?? masterRef(found, path === '' ? 'master' : `${path}.master`);
  if (problem !== null) {
    return problem;
  }
  const outcome = rest.outcome as string;
  if (found !== null && (outcome === 'chosen' || outcome === 'setback' || outcome === 'disaster')) {
    return `${where(path)}.master: só um nó vencido encontra um Mestre`;
  }
  return null;
};

const { expeditions, reports } = expeditionShapesOf(logEntry);

/**
 * O `GameState` da versão 23: o da versão 22 com os Mestres (V3E-T3; ADR 0018, decisão 18).
 *
 * - `settlement` ganha `masters` (os do feudo: o identificador, quem é, o edifício em que
 *   trabalha e até quando se adapta) e `mastersWaiting` (os que chegaram sem vaga nas casas).
 *   **O Mestre não está em `population.villagers`.**
 * - Cada registro do percurso de uma expedição ganha `master`: o Mestre que a equipe encontrou
 *   no nó, ou `null`.
 * - `rng` e `ids` não mudam de forma: o contador `ids.master` nasce com o primeiro Mestre, e
 *   Mestre nenhum tem fluxo de sorteio (a chance de o encontrar é do fluxo da expedição).
 *
 * Quem subir `schemaVersion` para 24 acrescenta aqui o passo `v23ToV24`, com esta forma como
 * entrada, e escreve a forma nova em `v24.ts`.
 */
export const settlementV23Fields: Readonly<Record<string, Shape>> = {
  ...settlementV21Fields,
  masters: listOf(master),
  mastersWaiting: listOf(waitingMaster),
};

export const guildV23Fields: Readonly<Record<string, Shape>> = {
  ...guildV22Fields,
  expeditions,
  reports,
};

export const stateV23Fields: Readonly<Record<string, Shape>> = {
  ...stateV22Fields,
  schemaVersion: literal(23),
  settlement: exactObject(settlementV23Fields),
  guild: guildOf(exactObject(guildV23Fields)),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

const stateV23Form: Shape = exactObject(stateV23Fields);
const stateV23Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV23: Shape = (value, path) =>
  stateV23Form(value, path) ??
  stateV23Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  caravansWithinState(value, path) ??
  mastersWithinState(value, path);
