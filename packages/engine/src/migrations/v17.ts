import type { MigrationStep, StoredState } from './step';
import {
  boolean,
  exactObject,
  listOf,
  listOfLength,
  literal,
  natural,
  nullable,
  oneOf,
  positive,
  type Shape,
  text,
} from './shape';
import { settlementV12Fields } from './v12';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState, heroRoster, heroV14Fields } from './v14';
import { HERO_GENDER_IDS_V15 } from './v15';
import {
  BUILDING_IDS_V16,
  guildV16Fields,
  RNG_FIXED_STREAMS_V16,
  stateV16Fields,
  tavernWithinState,
} from './v16';

// Como nas outras versões, os identificadores e os tetos ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`BUILDING_IDS`, `HERO_STATUS_IDS`, `POSTURE_IDS`, `EXPEDITION_OUTCOME_IDS` e os tetos de
// `balance.expeditions`).
export const BUILDING_IDS_V17: readonly string[] = [...BUILDING_IDS_V16, 'guild'];
export const HERO_STATUS_IDS_V17: readonly string[] = ['idle', 'expedition'];
export const POSTURE_IDS_V17: readonly string[] = ['cautious', 'balanced', 'bold'];
export const EXPEDITION_STATUS_IDS_V17: readonly string[] = [
  'traveling',
  'atCrossroads',
  'returning',
];
/** O que um registro do percurso diz: os quatro desfechos, o nó sem prova e a escolha. */
export const EXPEDITION_LOG_OUTCOMES_V17: readonly string[] = [
  'full',
  'success',
  'setback',
  'disaster',
  'passed',
  'chosen',
];
export const CROSSROADS_DECIDERS_V17: readonly string[] = ['player', 'posture', 'cautiousFallback'];
/** Quantas expedições a Guilda sustenta de uma vez, no máximo (`balance.expeditions.slotsByGuildLevel`). */
export const EXPEDITION_SLOTS_CAP_V17 = 3;
/** Quantos relatórios o feudo guarda (`balance.expeditions.reportsKept`). */
export const EXPEDITION_REPORTS_CAP_V17 = 3;
/** Quantos registros cabem no percurso de uma expedição (`balance.expeditions.graph.maxSteps`). */
export const EXPEDITION_LOG_CAP_V17 = 8;
/** Quantos heróis vão em uma equipe, no máximo (`balance.expeditions.teamMax`). */
export const EXPEDITION_TEAM_CAP_V17 = 4;
/** Quantas variantes de grafo um modelo tem (`balance.expeditions.variantsPerModel`). */
export const EXPEDITION_VARIANTS_V17 = 3;
export const RESOURCE_IDS_V17: readonly string[] = ['food', 'wood', 'stone', 'gold'];
/** Quantas filas de obras o estado guarda, abertas ou não. */
export const QUEUES = 2;

export const EXPEDITION_ID = /^expedition-([1-9][0-9]*)$/;
export const HERO_ID = /^hero-([1-9][0-9]*)$/;
/** A chave de um modelo, de um nó ou de uma opção no conteúdo. */
export const CONTENT_KEY = /^[a-z][A-Za-z0-9]*$/;

export const where = (path: string) => (path === '' ? 'estado' : path);

export const each = (keys: readonly string[], shape: Shape) =>
  exactObject(Object.fromEntries(keys.map((key) => [key, shape])));

export const expeditionId: Shape = (value, path) =>
  typeof value === 'string' &&
  EXPEDITION_ID.test(value) &&
  Number.isSafeInteger(Number(value.slice(11)))
    ? null
    : `${where(path)}: esperado um identificador de expedição (expedition-<n>)`;

export const heroIdRef: Shape = (value, path) =>
  typeof value === 'string' && HERO_ID.test(value)
    ? null
    : `${where(path)}: esperado um identificador de herói (hero-<n>)`;

/**
 * A chave de um modelo, de um nó ou de uma opção. Como o modelo de candidato da versão 16, a
 * guarda confere a **forma**, e não a lista do conteúdo: os grafos crescem, e um grafo novo não
 * é uma versão nova do estado. A expedição cujo grafo o conteúdo já não tem volta para casa.
 */
export const contentKey: Shape = (value, path) =>
  typeof value === 'string' && CONTENT_KEY.test(value)
    ? null
    : `${where(path)}: esperada a chave de um modelo, de um nó ou de uma opção`;

export const variantIndex: Shape = (value, path) =>
  Number.isSafeInteger(value) &&
  (value as number) >= 0 &&
  (value as number) < EXPEDITION_VARIANTS_V17
    ? null
    : `${where(path)}: esperada uma variante de 0 a ${EXPEDITION_VARIANTS_V17 - 1}`;

export const amounts: Shape = each(RESOURCE_IDS_V17, natural);

export const nonEmptyName: Shape = (value, path) =>
  text(value, path) ??
  ((value as string).trim() === '' ? `${where(path)}: esperado um nome, veio texto vazio` : null);

/** Uma lista sem repetição e com teto. */
export function cappedUnique(item: Shape, cap: number, what: string): Shape {
  return (value, path) => {
    const found = listOf(item)(value, path);
    if (found !== null) {
      return found;
    }
    const list = value as unknown[];
    if (list.length === 0 || list.length > cap) {
      return `${where(path)}: esperada lista de 1 a ${cap} ${what}, veio de ${list.length}`;
    }
    return new Set(list).size === list.length ? null : `${where(path)}: ${what} repetidos`;
  };
}

const logEntry: Shape = (value, path) => {
  const found = exactObject({
    nodeId: contentKey,
    atMs: natural,
    outcome: oneOf(EXPEDITION_LOG_OUTCOMES_V17),
    optionId: nullable(contentKey),
    decidedBy: nullable(oneOf(CROSSROADS_DECIDERS_V17)),
    gained: amounts,
  })(value, path);
  if (found !== null) {
    return found;
  }
  const entry = value as { outcome: string; optionId: string | null; decidedBy: string | null };
  const chosen = entry.outcome === 'chosen';
  return chosen === (entry.optionId !== null) && chosen === (entry.decidedBy !== null)
    ? null
    : `${where(path)}: só uma escolha tem opção e quem decidiu`;
};

/** O percurso: cada registro na forma, em ordem de instante, nunca mais do que o teto. */
const log: Shape = (value, path) => {
  const found = listOf(logEntry)(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ atMs: number }>;
  if (list.length > EXPEDITION_LOG_CAP_V17) {
    return `${where(path)}: esperada lista de até ${EXPEDITION_LOG_CAP_V17} registros, veio de ${list.length}`;
  }
  const index = list.findIndex((entry, at) => at > 0 && entry.atMs < (list[at - 1]?.atMs ?? 0));
  return index === -1 ? null : `${where(path)}.${index}.atMs: percurso fora da ordem`;
};

const loot: Shape = exactObject({ resources: amounts });

type ExpeditionV17 = {
  id: string;
  heroIds: string[];
  sentAtMs: number;
  status: string;
  nodeEndsAtMs: number | null;
  crossroads: { decidesAtMs: number } | null;
  log: Array<{ atMs: number }>;
};

/** Uma expedição: a forma dos campos e o que só se vê olhando dois deles. */
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
  const entry = value as ExpeditionV17;
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
  const found = listOf(expedition)(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as ExpeditionV17[];
  if (list.length > EXPEDITION_SLOTS_CAP_V17) {
    return `${where(path)}: esperada lista de até ${EXPEDITION_SLOTS_CAP_V17} expedições, veio de ${list.length}`;
  }
  const numbers = list.map((entry) => Number(entry.id.slice(11)));
  const index = numbers.findIndex((number, at) => at > 0 && number <= (numbers[at - 1] ?? 0));
  return index === -1
    ? null
    : `${where(path)}.${index}.id: expedições fora da ordem de identificador`;
};

const report: Shape = exactObject({
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
});

/** Os relatórios guardados: cada um na forma, nunca mais do que o teto, nenhuma expedição repetida. */
const reports: Shape = (value, path) => {
  const found = listOf(report)(value, path);
  if (found !== null) {
    return found;
  }
  const list = value as Array<{ expeditionId: string }>;
  if (list.length > EXPEDITION_REPORTS_CAP_V17) {
    return `${where(path)}: esperada lista de até ${EXPEDITION_REPORTS_CAP_V17} relatórios, veio de ${list.length}`;
  }
  return new Set(list.map((entry) => entry.expeditionId)).size === list.length
    ? null
    : `${where(path)}: relatório repetido`;
};

export const guildV17Fields: Readonly<Record<string, Shape>> = {
  ...guildV16Fields,
  heroes: heroRoster(
    exactObject({
      ...heroV14Fields,
      gender: oneOf(HERO_GENDER_IDS_V15),
      status: oneOf(HERO_STATUS_IDS_V17),
    }),
  ),
  expeditions,
  reports,
};

const guildV17: Shape = guildOf(exactObject(guildV17Fields));

type ExpeditionsState = {
  settlement: { buildings: { guild: number } };
  guild: {
    heroes: Array<{ id: string; status: string }>;
    expeditions: ExpeditionV17[];
    reports: Array<{ expeditionId: string; sentAtMs: number; returnedAtMs: number }>;
  };
  rng: Record<string, unknown>;
  ids: Record<string, number>;
  lastProcessedAt: number;
};

const EXPEDITION_STREAM = /^expedition:(expedition-[1-9][0-9]*)$/;

/**
 * A conferência das expedições com o resto do estado, que uma guarda de campo não alcança:
 *
 * - sem a Guilda dos Aventureiros não há expedição em curso;
 * - toda expedição e todo relatório têm um identificador que `nextId` já deu
 *   (`1 ≤ n ≤ ids.expedition`), e nenhum relatório é de uma expedição ainda em curso;
 * - quem está em expedição está em exatamente uma, e quem está em uma serve ao feudo com o
 *   estado `expedition`;
 * - o fim do nó e o prazo da encruzilhada são futuros: o que venceu já foi processado no
 *   instante dele; e nada do percurso aconteceu depois de agora;
 * - **todo fluxo de sorteio da família `expedition` em `rng` é de uma expedição em curso**: o
 *   fluxo é apagado quando ela volta, e um que sobrasse (ou renascesse) repetiria a sorte.
 */
export const expeditionsWithinState: Shape = (value, path) => {
  const { settlement, guild, rng, ids, lastProcessedAt } = value as ExpeditionsState;
  const at = path === '' ? 'guild' : `${path}.guild`;
  const issued = Object.hasOwn(ids, 'expedition') ? (ids.expedition as number) : 0;
  if (settlement.buildings.guild === 0 && guild.expeditions.length > 0) {
    return `${at}.expeditions: expedição sem a Guilda dos Aventureiros`;
  }
  const away = new Map<string, number>();
  for (const [index, entry] of guild.expeditions.entries()) {
    const here = `${at}.expeditions.${index}`;
    if (Number(entry.id.slice(11)) > issued) {
      return `${here}.id: expedição além do contador de ids.expedition`;
    }
    if (entry.sentAtMs > lastProcessedAt) {
      return `${here}.sentAtMs: expedição enviada depois de agora`;
    }
    if (entry.nodeEndsAtMs !== null && entry.nodeEndsAtMs <= lastProcessedAt) {
      return `${here}.nodeEndsAtMs: fim de nó vencido e não processado`;
    }
    if (entry.crossroads !== null && entry.crossroads.decidesAtMs <= lastProcessedAt) {
      return `${here}.crossroads.decidesAtMs: prazo de encruzilhada vencido e não processado`;
    }
    if (entry.log.some((step) => step.atMs > lastProcessedAt || step.atMs < entry.sentAtMs)) {
      return `${here}.log: registro fora do tempo da expedição`;
    }
    for (const heroId of entry.heroIds) {
      if (away.has(heroId)) {
        return `${here}.heroIds: herói em duas expedições`;
      }
      away.set(heroId, index);
      const hero = guild.heroes.find((candidate) => candidate.id === heroId);
      if (hero === undefined || hero.status !== 'expedition') {
        return `${here}.heroIds: herói que não serve ao feudo em expedição`;
      }
    }
  }
  for (const [index, hero] of guild.heroes.entries()) {
    if (hero.status === 'expedition' && !away.has(hero.id)) {
      return `${at}.heroes.${index}.status: herói em expedição sem expedição`;
    }
  }
  for (const [index, entry] of guild.reports.entries()) {
    const here = `${at}.reports.${index}`;
    if (Number(entry.expeditionId.slice(11)) > issued) {
      return `${here}.expeditionId: relatório além do contador de ids.expedition`;
    }
    if (guild.expeditions.some((live) => live.id === entry.expeditionId)) {
      return `${here}.expeditionId: relatório de uma expedição ainda em curso`;
    }
    if (entry.returnedAtMs > lastProcessedAt || entry.sentAtMs > entry.returnedAtMs) {
      return `${here}.returnedAtMs: relatório fora do tempo`;
    }
  }
  const live = new Set(guild.expeditions.map((entry) => entry.id));
  for (const key of Object.keys(rng)) {
    const match = EXPEDITION_STREAM.exec(key);
    if (match !== null && !live.has(match[1] as string)) {
      const here = path === '' ? `rng.${key}` : `${path}.rng.${key}`;
      return `${here}: fluxo de uma expedição que não está em curso`;
    }
  }
  return null;
};

/**
 * O `GameState` da versão 17: o da versão 16 com a Guilda dos Aventureiros e as expedições
 * (V3D-T1; ADR 0017, decisões 1, 7 e 9; ADR 0018, decisões 11 a 13).
 *
 * - `settlement.buildings` ganha a Guilda (`guild`), e ela pode estar em obra e na lista das
 *   planejadas.
 * - O herói pode estar em expedição (`status: 'expedition'`).
 * - Entra `guild.expeditions`: as expedições em curso, cada uma com o identificador
 *   (`expedition-<n>`, do contador `ids.expedition`), o modelo e a variante do grafo, a equipe,
 *   a Postura, o fator de duração fixado no envio, onde está, o fim do nó ou o prazo da
 *   encruzilhada, o saque e o percurso.
 * - Entra `guild.reports`: os relatórios das últimas que voltaram.
 * - `rng` não muda de forma, mas a guarda passa a exigir que todo fluxo `expedition:<id>` seja
 *   de uma expedição em curso. `ids` não muda de forma.
 *
 * O passo que sai daqui é o `v17ToV18`, abaixo; a forma da versão 18 está em `v18.ts`.
 */
export const settlementV17Fields: Readonly<Record<string, Shape>> = {
  ...settlementV12Fields,
  buildings: each(BUILDING_IDS_V17, natural),
  constructionQueues: listOfLength(
    QUEUES,
    nullable(
      exactObject({
        building: oneOf(BUILDING_IDS_V17),
        targetLevel: natural,
        startedAtMs: natural,
        finishesAtMs: natural,
      }),
    ),
  ),
  planned: listOf(
    exactObject({ building: oneOf(BUILDING_IDS_V17), targetLevel: natural, autoStart: boolean }),
  ),
};

export const stateV17Fields: Readonly<Record<string, Shape>> = {
  ...stateV16Fields,
  schemaVersion: literal(17),
  settlement: exactObject(settlementV17Fields),
  rng: rngShape(RNG_FIXED_STREAMS_V16, RNG_STREAM_FAMILIES_V13),
  guild: guildV17,
};

const stateV17Form: Shape = exactObject(stateV17Fields);
const stateV17Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV17: Shape = (value, path) =>
  stateV17Form(value, path) ??
  stateV17Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path);

/** O que um registro do percurso da versão 17 ganha na 18: nada aconteceu a ninguém. */
const LOG_FROM_V17 = {
  xp: 0,
  harm: null,
  leveled: [],
  found: [],
  revealed: null,
  cleared: null,
  rescued: null,
  lootLost: false,
} as const;

const logToV18 = (log: unknown): StoredState[] =>
  (log as StoredState[]).map((entry) => ({
    ...entry,
    ...LOG_FROM_V17,
    leveled: [],
    found: [],
  }));

const lootToV18 = (loot: unknown): StoredState => ({ ...(loot as StoredState), items: [] });

/**
 * Versão 17 → 18: os desfechos das expedições (V3D-T2; ADR 0017, decisão 8; ADR 0018, decisões
 * 14 e 15).
 *
 * - Cada herói que já existia entra **sem ferimento, sem cativeiro e sem equipamento**
 *   (`injury: null`, `captivity: null`, os três espaços vazios). O estado dele não muda: quem
 *   estava no feudo continua pronto, quem estava em expedição continua nela.
 * - Entra `guild.inventory`, vazio: nenhum item foi achado.
 * - Entra `map.discovered`, vazio: nenhum destino foi revelado. Os tiles ficam como estavam.
 * - As expedições em curso continuam de onde estavam: o saque ganha a lista de itens, vazia, e
 *   cada registro do percurso ganha os campos do que o nó fez à equipe e ao mundo, todos
 *   neutros (a versão 17 não feria, não dava experiência e não achava item). Os relatórios
 *   guardados ganham os mesmos campos, mais `sold` vazio e `lost: false`.
 *
 * **O passo não cria prazo, não emite evento, não dá identificador a ninguém e não toca o
 * gerador.** A experiência de um nó que a versão 17 já resolveu não é paga depois, e o nó em que
 * uma equipe está agora é resolvido pelas regras novas no fim dele.
 */
export const v17ToV18: MigrationStep = {
  from: 17,
  summary: 'heróis sem ferimento, cativeiro nem equipamento; arsenal e destinos revelados vazios',
  shape: stateV17,
  migrate(state) {
    const guild = state.guild as StoredState;
    const map = state.map as StoredState;
    return {
      ...state,
      schemaVersion: 18,
      map: { ...map, discovered: [] },
      guild: {
        ...guild,
        heroes: (guild.heroes as StoredState[]).map((hero) => ({
          ...hero,
          injury: null,
          captivity: null,
          equipment: { weapon: null, armor: null, accessory: null },
        })),
        inventory: [],
        expeditions: (guild.expeditions as StoredState[]).map((expedition) => ({
          ...expedition,
          loot: lootToV18(expedition.loot),
          log: logToV18(expedition.log),
        })),
        reports: (guild.reports as StoredState[]).map((report) => ({
          ...report,
          loot: lootToV18(report.loot),
          log: logToV18(report.log),
          sold: [],
          lost: false,
        })),
      },
    };
  },
};
