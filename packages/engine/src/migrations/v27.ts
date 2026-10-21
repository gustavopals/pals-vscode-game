import { exactObject, literal, natural, nullable, positive, type Shape } from './shape';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { contentKey, expeditionsWithinState } from './v17';
import { itemId, outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState } from './v22';
import { mastersWithinState } from './v23';
import { marketLimitsWithinState, workedWithinState } from './v24';
import { ironMarketWithinState } from './v25';
import {
  DURABILITY_CEILING_V27,
  durabilityOfV27,
  FORGE_BATCH_MAX_V27,
  INVENTORY_CAP_V27,
  ITEM_RARITY_V27,
} from './v27items';
import { guildV26Fields, settlementV26Fields, stateV26Fields } from './v26';

/** Um item da versão 27: o identificador, a chave no conteúdo e a condição, em usos que restam. */
const itemV27: Shape = exactObject({ id: itemId, defId: contentKey, condition: natural });

type ItemHolder = { id?: unknown; defId?: unknown; condition?: unknown };

/**
 * Confere a condição de um item e a tira dele: devolve o problema, ou o item na forma da versão
 * 26. A condição é um natural entre 0 e a durabilidade da raridade (a do item que o conteúdo já
 * não tem, entre 0 e a maior de todas).
 */
function withoutCondition(value: unknown, path: string): { problem: string | null; rest: unknown } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { problem: null, rest: value };
  }
  const holder = value as ItemHolder;
  if (!Object.hasOwn(holder, 'condition')) {
    return { problem: `${path}.condition: campo ausente`, rest: value };
  }
  const { condition, ...rest } = holder;
  const problem = natural(condition, `${path}.condition`);
  if (problem !== null) {
    return { problem, rest: value };
  }
  const ceiling =
    typeof holder.defId === 'string' && Object.hasOwn(ITEM_RARITY_V27, holder.defId)
      ? durabilityOfV27(holder.defId)
      : DURABILITY_CEILING_V27;
  if ((condition as number) > ceiling) {
    return { problem: `${path}.condition: condição acima da durabilidade`, rest: value };
  }
  return { problem: null, rest };
}

/** Tira a condição de cada item de uma lista, ou devolve o problema do primeiro. */
function stripList(list: unknown, path: string): { problem: string | null; rest: unknown } {
  if (!Array.isArray(list)) {
    return { problem: null, rest: list };
  }
  const rest: unknown[] = [];
  for (const [index, entry] of list.entries()) {
    const found = withoutCondition(entry, `${path}.${index}`);
    if (found.problem !== null) {
      return found;
    }
    rest.push(found.rest);
  }
  return { problem: null, rest };
}

type GuildItems = {
  inventory?: unknown;
  heroes?: unknown;
  expeditions?: unknown;
  reports?: unknown;
};

/**
 * Os itens da Guilda ganham a condição na versão 27, em quatro lugares: o arsenal, o que cada
 * herói leva, o saque de cada expedição em curso e o de cada relatório. Para não reescrever a
 * forma inteira da Guilda (que vem em camadas desde a versão 14), a guarda confere a condição
 * de cada item, tira-a, e entrega o resto à forma da versão 26, palavra por palavra a mesma.
 */
function conditionAwareGuild(form: Shape): Shape {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return form(value, path);
    }
    const guild = value as GuildItems;
    const at = path === '' ? '' : `${path}.`;
    const stripped: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    const inventory = stripList(guild.inventory, `${at}inventory`);
    if (inventory.problem !== null) {
      return inventory.problem;
    }
    stripped.inventory = inventory.rest;
    if (Array.isArray(guild.heroes)) {
      const heroes: unknown[] = [];
      for (const [index, hero] of guild.heroes.entries()) {
        const equipment = (hero as { equipment?: unknown } | null)?.equipment;
        if (typeof equipment !== 'object' || equipment === null || Array.isArray(equipment)) {
          heroes.push(hero);
          continue;
        }
        const slots: Record<string, unknown> = {};
        for (const [slot, piece] of Object.entries(equipment)) {
          const found =
            piece === null
              ? { problem: null, rest: piece }
              : withoutCondition(piece, `${at}heroes.${index}.equipment.${slot}`);
          if (found.problem !== null) {
            return found.problem;
          }
          slots[slot] = found.rest;
        }
        heroes.push({ ...(hero as Record<string, unknown>), equipment: slots });
      }
      stripped.heroes = heroes;
    }
    for (const field of ['expeditions', 'reports'] as const) {
      const list = guild[field];
      if (!Array.isArray(list)) {
        continue;
      }
      const copies: unknown[] = [];
      for (const [index, entry] of list.entries()) {
        const holder = entry as { loot?: { items?: unknown } } | null;
        if (typeof holder !== 'object' || holder === null || typeof holder.loot !== 'object') {
          copies.push(entry);
          continue;
        }
        const found = stripList(holder.loot?.items, `${at}${field}.${index}.loot.items`);
        if (found.problem !== null) {
          return found.problem;
        }
        copies.push({ ...holder, loot: { ...holder.loot, items: found.rest } });
      }
      stripped[field] = copies;
    }
    return form(stripped, path);
  };
}

/**
 * O que a forja guarda na versão 27: um lote de armas (o da 26, agora com o tipo) ou o reparo de
 * um item, que fica na forja, fora do arsenal, até terminar.
 */
const forgeJobV27: Shape = (value, path) => {
  const kind = (value as { kind?: unknown } | null)?.kind;
  const where = path === '' ? 'settlement.forge' : path;
  if (kind === 'weapons') {
    return exactObject({
      kind: literal('weapons'),
      amount: positive,
      startedAtMs: natural,
      endsAtMs: natural,
    })(value, path);
  }
  if (kind === 'repair') {
    return exactObject({
      kind: literal('repair'),
      item: itemV27,
      points: positive,
      startedAtMs: natural,
      endsAtMs: natural,
    })(value, path);
  }
  return `${where}.kind: esperado "weapons" ou "repair"`;
};

/**
 * O `GameState` da versão 27: o da versão 26 com o desgaste e o reparo do equipamento (V4B-T3;
 * ADR 0019, decisão 5).
 *
 * - Todo `Item` (no arsenal, no que um herói leva e no saque de uma expedição ou relatório) ganha
 *   `condition`: os usos que lhe restam, de 0 à durabilidade da raridade.
 * - `settlement.forge` passa a ter `kind`: um lote de armas (`weapons`, `amount`) ou o reparo de
 *   um item (`repair`, `item`, `points`). O item em reparo fica na forja e ocupa o lugar dele no
 *   arsenal até voltar.
 * - `rng` e `ids` não mudam de forma: o reparo não sorteia nem cria entidade.
 *
 * Quem subir `schemaVersion` para 28 acrescenta aqui o passo `v27ToV28`, com esta forma como
 * entrada, e escreve a forma nova em `v28.ts`.
 */
export const settlementV27Fields: Readonly<Record<string, Shape>> = {
  ...settlementV26Fields,
  forge: nullable(forgeJobV27),
};

export const guildV27Fields: Readonly<Record<string, Shape>> = guildV26Fields;

export const stateV27Fields: Readonly<Record<string, Shape>> = {
  ...stateV26Fields,
  schemaVersion: literal(27),
  settlement: exactObject(settlementV27Fields),
  guild: conditionAwareGuild(stateV26Fields.guild as Shape),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
};

type ForgeWithin = {
  settlement: { buildings: { smithy: number }; forge: Record<string, unknown> | null };
  guild: { inventory: unknown[] };
};

/**
 * A conferência da forja com o resto do estado, que uma guarda de campo não alcança: o trabalho
 * só existe com o Ferreiro erguido e termina depois de começar; o lote cabe no lote máximo; o
 * reparo devolve exatamente o que falta ao item (o item volta cheio), e o arsenal, somado ao
 * item que está na forja, não passa do teto.
 */
export const forgeWithinStateV27: Shape = (value, path) => {
  const { settlement, guild } = value as ForgeWithin;
  const at = path === '' ? 'settlement.forge' : `${path}.settlement.forge`;
  const forge = settlement.forge;
  if (forge === null) {
    return null;
  }
  if (settlement.buildings.smithy === 0) {
    return `${at}: trabalho na forja sem Ferreiro`;
  }
  if ((forge.endsAtMs as number) < (forge.startedAtMs as number)) {
    return `${at}.endsAtMs: trabalho que termina antes de começar`;
  }
  if (forge.kind === 'weapons') {
    return (forge.amount as number) > FORGE_BATCH_MAX_V27
      ? `${at}.amount: lote acima do máximo`
      : null;
  }
  const item = forge.item as { defId: string; condition: number };
  const points = forge.points as number;
  // Para um item que esta forma conhece, o reparo devolve exatamente o que falta. Um item que o
  // conteúdo acrescentou depois da versão 27 não está na tabela congelada: confere-se só o teto
  // de toda durabilidade (revisão do reparo, achado 1). Acrescentar um item continua livre.
  if (Object.hasOwn(ITEM_RARITY_V27, item.defId)) {
    if (item.condition + points !== durabilityOfV27(item.defId)) {
      return `${at}.points: o reparo não devolve exatamente o que falta ao item`;
    }
  } else if (points < 1 || item.condition + points > DURABILITY_CEILING_V27) {
    return `${at}.points: o reparo passa da maior durabilidade`;
  }
  if (guild.inventory.length + 1 > INVENTORY_CAP_V27) {
    return `${at}.item: arsenal e item em reparo acima do teto`;
  }
  return null;
};

const stateV27Form: Shape = exactObject(stateV27Fields);
const stateV27Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV27: Shape = (value, path) =>
  stateV27Form(value, path) ??
  stateV27Streams(value, path) ??
  guildWithinState(value, path) ??
  tavernWithinState(value, path) ??
  expeditionsWithinState(value, path) ??
  outcomesWithinState(value, path) ??
  freedWithinState(value, path) ??
  marketWithinState(value, path) ??
  ironMarketWithinState(value, path) ??
  caravansWithinState(value, path) ??
  mastersWithinState(value, path) ??
  workedWithinState(value, path) ??
  marketLimitsWithinState(value, path) ??
  forgeWithinStateV27(value, path);
