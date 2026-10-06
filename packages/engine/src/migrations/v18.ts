import {
  boolean,
  exactObject,
  listOf,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  type Shape,
} from './shape';
import { mapV9Fields } from './v9';
import { guildOf, guildWithinState, heroRoster, heroV14Fields } from './v14';
import { HERO_GENDER_IDS_V15 } from './v15';
import { tavernWithinState } from './v16';
import {
  amounts,
  cappedUnique,
  contentKey,
  CROSSROADS_DECIDERS_V17,
  EXPEDITION_LOG_CAP_V17,
  EXPEDITION_LOG_OUTCOMES_V17,
  EXPEDITION_REPORTS_CAP_V17,
  EXPEDITION_SLOTS_CAP_V17,
  EXPEDITION_STATUS_IDS_V17,
  EXPEDITION_TEAM_CAP_V17,
  expeditionId,
  expeditionsWithinState,
  guildV17Fields,
  heroIdRef,
  nonEmptyName,
  POSTURE_IDS_V17,
  stateV17Fields,
  variantIndex,
} from './v17';
import { rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`HERO_STATUS_IDS`, `INJURY_SEVERITY_IDS`, `HERO_HARM_IDS`, `ITEM_SLOT_IDS`,
// `balance.equipment.inventoryCap`).
export const HERO_STATUS_IDS_V18: readonly string[] = ['idle', 'expedition', 'injured', 'captured'];
export const INJURY_SEVERITY_IDS_V18: readonly string[] = ['light', 'severe'];
export const HERO_HARM_IDS_V18: readonly string[] = ['light', 'severe', 'captured', 'died'];
export const ITEM_SLOT_IDS_V18: readonly string[] = ['weapon', 'armor', 'accessory'];
/** Quantos itens o arsenal guarda (`balance.equipment.inventoryCap`). */
export const INVENTORY_CAP_V18 = 30;
/** Quantos destinos cabem na lista dos revelados: bem mais do que os modelos de qualquer versão. */
export const DISCOVERED_CAP_V18 = 32;

const ITEM_ID = /^item-([1-9][0-9]*)$/;

const where = (path: string) => (path === '' ? 'estado' : path);

const itemId: Shape = (value, path) =>
  typeof value === 'string' && ITEM_ID.test(value) && Number.isSafeInteger(Number(value.slice(5)))
    ? null
    : `${where(path)}: esperado um identificador de item (item-<n>)`;

/** Um item: o identificador e a chave dele no conteúdo (a forma, não a lista: o catálogo cresce). */
const item: Shape = exactObject({ id: itemId, defId: contentKey });

/** Uma lista com teto, que pode estar vazia. */
function capped(entry: Shape, cap: number, what: string): Shape {
  return (value, path) => {
    const found = listOf(entry)(value, path);
    if (found !== null) {
      return found;
    }
    const { length } = value as unknown[];
    return length > cap
      ? `${where(path)}: esperada lista de até ${cap} ${what}, veio de ${length}`
      : null;
  };
}

type HeroV18 = {
  id: string;
  status: string;
  discontent: boolean;
  injury: { untilMs: number } | null;
  captivity: { sinceMs: number } | null;
  equipment: Record<string, { id: string } | null>;
};

/**
 * Um herói: a forma dos campos e o que só se vê olhando dois deles. Só o cativo tem cativeiro, e
 * ele não está ferido nem Descontente; quem se recupera no feudo tem o ferimento, e quem está
 * pronto não tem nenhum (quem se fere em uma expedição continua nela, com o ferimento).
 */
const hero: Shape = (value, path) => {
  const found = exactObject({
    ...heroV14Fields,
    gender: oneOf(HERO_GENDER_IDS_V15),
    status: oneOf(HERO_STATUS_IDS_V18),
    injury: nullable(exactObject({ severity: oneOf(INJURY_SEVERITY_IDS_V18), untilMs: natural })),
    captivity: nullable(exactObject({ sinceMs: natural, modelId: contentKey })),
    equipment: exactObject(
      Object.fromEntries(ITEM_SLOT_IDS_V18.map((slot) => [slot, nullable(item)])),
    ),
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as HeroV18;
  const captive = entry.status === 'captured';
  if (captive !== (entry.captivity !== null)) {
    return `${where(path)}.captivity: só o herói em cativeiro tem cativeiro`;
  }
  if (captive && (entry.injury !== null || entry.discontent)) {
    return `${where(path)}.status: herói em cativeiro ferido ou Descontente`;
  }
  if (entry.status === 'injured' && entry.injury === null) {
    return `${where(path)}.injury: herói em recuperação sem ferimento`;
  }
  if (entry.status === 'idle' && entry.injury !== null) {
    return `${where(path)}.injury: herói pronto com ferimento`;
  }
  return null;
};

const logEntry: Shape = (value, path) => {
  const found = exactObject({
    nodeId: contentKey,
    atMs: natural,
    outcome: oneOf(EXPEDITION_LOG_OUTCOMES_V17),
    optionId: nullable(contentKey),
    decidedBy: nullable(oneOf(CROSSROADS_DECIDERS_V17)),
    gained: amounts,
    xp: natural,
    harm: nullable(exactObject({ heroName: nonEmptyName, kind: oneOf(HERO_HARM_IDS_V18) })),
    leveled: capped(
      exactObject({ heroName: nonEmptyName, level: positive }),
      EXPEDITION_TEAM_CAP_V17,
      'heróis',
    ),
    found: capped(contentKey, 1, 'itens'),
    revealed: nullable(contentKey),
    cleared: nullable(contentKey),
    rescued: nullable(nonEmptyName),
    lootLost: boolean,
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as {
    outcome: string;
    optionId: string | null;
    decidedBy: string | null;
    xp: number;
    harm: unknown;
    found: unknown[];
    lootLost: boolean;
  };
  const chosen = entry.outcome === 'chosen';
  if (chosen !== (entry.optionId !== null) || chosen !== (entry.decidedBy !== null)) {
    return `${where(path)}: só uma escolha tem opção e quem decidiu`;
  }
  const trial = !chosen && entry.outcome !== 'passed';
  if (!trial && (entry.xp !== 0 || entry.harm !== null || entry.lootLost)) {
    return `${where(path)}: só um nó com prova dá experiência, fere e perde o saque`;
  }
  if (chosen && entry.found.length > 0) {
    return `${where(path)}: uma escolha não acha item`;
  }
  return null;
};

/** O percurso: cada registro na forma, em ordem de instante, nunca mais do que o teto. */
const log: Shape = (value, path) => {
  const found = capped(logEntry, EXPEDITION_LOG_CAP_V17, 'registros')(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ atMs: number }>;
  const index = list.findIndex((entry, at) => at > 0 && entry.atMs < (list[at - 1]?.atMs ?? 0));
  return index === -1 ? null : `${where(path)}.${index}.atMs: percurso fora da ordem`;
};

/** O saque: os recursos e os itens, no máximo um por registro do percurso. */
const loot: Shape = exactObject({
  resources: amounts,
  items: capped(item, EXPEDITION_LOG_CAP_V17, 'itens'),
});

type ExpeditionV18 = {
  id: string;
  status: string;
  nodeEndsAtMs: number | null;
  crossroads: { decidesAtMs: number } | null;
  loot: { items: Array<{ id: string }> };
};

const expedition: Shape = (value, path) => {
  const found = exactObject({
    id: expeditionId,
    modelId: contentKey,
    variant: variantIndex,
    heroIds: cappedUnique(heroIdRef, EXPEDITION_TEAM_CAP_V17, 'heróis'),
    posture: oneOf(POSTURE_IDS_V17),
    sentAtMs: natural,
    durationFactor: exactObject({ num: positive, den: positive }),
    status: oneOf(EXPEDITION_STATUS_IDS_V17),
    nodeId: contentKey,
    nodeEndsAtMs: nullable(natural),
    crossroads: nullable(exactObject({ decidesAtMs: natural })),
    loot,
    log,
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as ExpeditionV18;
  const waiting = entry.status === 'atCrossroads';
  if (waiting !== (entry.crossroads !== null)) {
    return `${where(path)}.crossroads: só a expedição parada na encruzilhada tem prazo de decisão`;
  }
  if (waiting === (entry.nodeEndsAtMs !== null)) {
    return `${where(path)}.nodeEndsAtMs: a expedição em um nó tem o fim dele, e a parada na encruzilhada, não`;
  }
  return null;
};

/** As expedições em curso: cada uma na forma, nunca mais do que o teto, em ordem de identificador. */
const expeditions: Shape = (value, path) => {
  const found = capped(expedition, EXPEDITION_SLOTS_CAP_V17, 'expedições')(value, path);
  if (found !== null) {
    return found;
  }
  const numbers = (value as ExpeditionV18[]).map((entry) => Number(entry.id.slice(11)));
  const index = numbers.findIndex((number, at) => at > 0 && number <= (numbers[at - 1] ?? 0));
  return index === -1
    ? null
    : `${where(path)}.${index}.id: expedições fora da ordem de identificador`;
};

type ReportV18 = {
  expeditionId: string;
  lost: boolean;
  sold: string[];
  loot: { resources: Record<string, number>; items: Array<{ id: string; defId: string }> };
};

/** Um relatório: a forma e, no de quem não voltou, o saque vazio; o vendido saiu do saque. */
const report: Shape = (value, path) => {
  const found = exactObject({
    expeditionId,
    modelId: contentKey,
    variant: variantIndex,
    heroNames: cappedUnique(nonEmptyName, EXPEDITION_TEAM_CAP_V17, 'nomes'),
    posture: oneOf(POSTURE_IDS_V17),
    sentAtMs: natural,
    returnedAtMs: natural,
    log,
    loot,
    wasted: amounts,
    sold: capped(contentKey, EXPEDITION_LOG_CAP_V17, 'itens'),
    lost: boolean,
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as ReportV18;
  const carried = entry.loot.items.map((piece) => piece.defId);
  for (const defId of entry.sold) {
    const index = carried.indexOf(defId);
    if (index === -1) {
      return `${where(path)}.sold: item vendido que não estava no saque`;
    }
    carried.splice(index, 1);
  }
  const empty =
    entry.loot.items.length === 0 &&
    Object.values(entry.loot.resources).every((amount) => amount === 0);
  return entry.lost && !empty
    ? `${where(path)}.loot: relatório de quem não voltou com saque`
    : null;
};

/** Os relatórios guardados: cada um na forma, nunca mais do que o teto, nenhuma expedição repetida. */
const reports: Shape = (value, path) => {
  const found = capped(report, EXPEDITION_REPORTS_CAP_V17, 'relatórios')(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as ReportV18[];
  return new Set(list.map((entry) => entry.expeditionId)).size === list.length
    ? null
    : `${where(path)}: relatório repetido`;
};

export const guildV18Fields: Readonly<Record<string, Shape>> = {
  ...guildV17Fields,
  heroes: heroRoster(hero),
  inventory: capped(item, INVENTORY_CAP_V18, 'itens'),
  expeditions,
  reports,
};

const guildV18: Shape = guildOf(exactObject(guildV18Fields));

/** Os destinos revelados: chaves de modelo, sem repetição, com teto. */
const discovered: Shape = (value, path) => {
  const found = capped(contentKey, DISCOVERED_CAP_V18, 'destinos')(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as string[];
  return new Set(list).size === list.length ? null : `${where(path)}: destino repetido`;
};

type OutcomesState = {
  guild: {
    heroes: HeroV18[];
    inventory: Array<{ id: string }>;
    expeditions: ExpeditionV18[];
  };
  ids: Record<string, number>;
  lastProcessedAt: number;
};

/**
 * A conferência dos desfechos com o resto do estado, que uma guarda de campo não alcança:
 *
 * - todo item (no arsenal, no espaço de um herói, no saque de uma expedição em curso) tem um
 *   identificador que `nextId` já deu (`1 ≤ n ≤ ids.item`), e **nenhum item está em dois
 *   lugares**;
 * - o ferimento de um herói sara no futuro: o que venceu já foi processado no instante dele;
 * - nenhum cativeiro começou depois de agora.
 */
export const outcomesWithinState: Shape = (value, path) => {
  const { guild, ids, lastProcessedAt } = value as OutcomesState;
  const at = path === '' ? 'guild' : `${path}.guild`;
  const issued = Object.hasOwn(ids, 'item') ? (ids.item as number) : 0;
  const seen = new Set<string>();
  const check = (piece: { id: string }, here: string): string | null => {
    if (Number(piece.id.slice(5)) > issued) {
      return `${here}.id: item além do contador de ids.item`;
    }
    if (seen.has(piece.id)) {
      return `${here}.id: item em dois lugares`;
    }
    seen.add(piece.id);
    return null;
  };
  for (const [index, piece] of guild.inventory.entries()) {
    const found = check(piece, `${at}.inventory.${index}`);
    if (found !== null) {
      return found;
    }
  }
  for (const [index, entry] of guild.heroes.entries()) {
    const here = `${at}.heroes.${index}`;
    for (const slot of ITEM_SLOT_IDS_V18) {
      const piece = entry.equipment[slot];
      const found =
        piece === null || piece === undefined ? null : check(piece, `${here}.equipment.${slot}`);
      if (found !== null) {
        return found;
      }
    }
    if (entry.injury !== null && entry.injury.untilMs <= lastProcessedAt) {
      return `${here}.injury.untilMs: ferimento vencido e não processado`;
    }
    if (entry.captivity !== null && entry.captivity.sinceMs > lastProcessedAt) {
      return `${here}.captivity.sinceMs: cativeiro que começou depois de agora`;
    }
  }
  for (const [index, entry] of guild.expeditions.entries()) {
    for (const [slot, piece] of entry.loot.items.entries()) {
      const found = check(piece, `${at}.expeditions.${index}.loot.items.${slot}`);
      if (found !== null) {
        return found;
      }
    }
  }
  return null;
};

/**
 * O `GameState` da versão 18: o da versão 17 com os desfechos das expedições (V3D-T2; ADR 0017,
 * decisão 8; ADR 0018, decisões 14 e 15).
 *
 * - O herói pode estar em recuperação (`injured`) ou em cativeiro (`captured`), e ganha
 *   `injury` (a gravidade e o instante em que sara), `captivity` (desde quando e em que
 *   expedição) e `equipment` (um item, ou nada, em cada um dos três espaços).
 * - Entra `guild.inventory`: os itens sem dono, com teto.
 * - Entra `map.discovered`: os destinos que uma expedição revelou.
 * - O saque de uma expedição ganha `items`; cada registro do percurso, o que o nó fez à equipe
 *   e ao mundo (`xp`, `harm`, `leveled`, `found`, `revealed`, `cleared`, `rescued`, `lootLost`);
 *   e o relatório, `sold` e `lost`.
 * - `ids` não muda de forma, e ganha o contador `item` com o primeiro item achado. `rng` não
 *   muda.
 *
 * Quem subir `schemaVersion` para 19 acrescenta aqui o passo `v18ToV19`, com esta forma como
 * entrada, e escreve a forma nova em `v19.ts`.
 */
export const stateV18Fields: Readonly<Record<string, Shape>> = {
  ...stateV17Fields,
  schemaVersion: literal(18),
  map: exactObject({ ...mapV9Fields, discovered }),
  guild: guildV18,
};

const stateV18Form: Shape = exactObject(stateV18Fields);
const stateV18Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV18: Shape = (value, path) =>
  stateV18Form(value, path) ??
  stateV18Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path);
