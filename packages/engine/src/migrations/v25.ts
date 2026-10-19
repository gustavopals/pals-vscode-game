import { exactObject, integer, literal, natural, positive, type Shape } from './shape';
import type { MigrationStep } from './step';
import { rngShape, rngWithinIds, RNG_STREAM_FAMILIES_V13 } from './v13';
import { guildOf, guildWithinState } from './v14';
import { tavernWithinState } from './v16';
import { each, expeditionsWithinState } from './v17';
import { outcomesWithinState } from './v18';
import { freedWithinState } from './v20';
import { marketWithinState, RNG_FIXED_STREAMS_V21 } from './v21';
import { caravansWithinState, marketV22Fields } from './v22';
import { mastersWithinState } from './v23';
import {
  guildV24Fields,
  marketLimitsWithinState,
  settlementV24Fields,
  stateV24Fields,
  workedWithinState,
} from './v24';

// Como nas outras versões, os identificadores e os números ficam escritos aqui: a forma de uma
// versão não acompanha `@lotg/content`. O teste confere que hoje coincidem com o conteúdo
// (`RESOURCE_IDS`, `MARKET_RESOURCE_IDS` e `balance.market`).
/** Os recursos da versão 25: os quatro de antes e o ferro (V4B-T1; ADR 0019, decisão 3). */
export const RESOURCE_IDS_V25: readonly string[] = ['food', 'wood', 'stone', 'gold', 'iron'];
/** O que o Mercado negocia na versão 25, na ordem do sorteio: o ferro entra por último. */
export const MARKET_RESOURCE_IDS_V25: readonly string[] = ['food', 'wood', 'stone', 'iron'];
/** O preço-base do ferro, em milésimos de ouro por unidade (`market.basePrice.iron`). */
export const IRON_BASE_PRICE_V25 = 8000;
/** O piso e o teto do passeio do preço do ferro: 3/5 e 8/5 da base (`market.walk`). */
export const IRON_PRICE_FLOOR_V25 = 4800;
export const IRON_PRICE_CEILING_V25 = 12800;

const amounts: Shape = each(RESOURCE_IDS_V25, natural);

type IronRecords = {
  expeditions?: unknown;
  reports?: unknown;
};

type RecordsHolder = {
  log?: unknown;
  loot?: { resources?: unknown };
  wasted?: unknown;
};

/**
 * Tira o ferro de um registro de quantidades por recurso, depois de conferir que ele está lá e
 * é um natural. Devolve o problema, ou o registro sem o ferro (a forma da versão 24).
 */
function withoutIron(value: unknown, path: string): { problem: string | null; rest: unknown } {
  const problem = amounts(value, path);
  if (problem !== null) {
    return { problem, rest: value };
  }
  const rest: Record<string, unknown> = { ...(value as Record<string, unknown>) };
  delete rest.iron;
  return { problem: null, rest };
}

/**
 * As quantidades por recurso que uma expedição guarda (o que cada nó rendeu, o saque e, no
 * relatório, o que não coube no depósito) ganham o ferro na versão 25. Para não reescrever a
 * forma inteira das expedições (que vem em camadas desde a versão 17), a guarda confere o ferro
 * de cada registro, tira-o, e entrega o resto à forma da versão 24, palavra por palavra a mesma.
 * Um registro sem o ferro, ou com o ferro fora da forma, é recusado com o caminho do campo.
 */
function ironAwareGuild(form: Shape): Shape {
  return (value, path) => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return form(value, path);
    }
    const guild = value as IronRecords;
    const at = path === '' ? '' : `${path}.`;
    const stripped: Record<string, unknown> = { ...(value as Record<string, unknown>) };
    for (const field of ['expeditions', 'reports'] as const) {
      const list = guild[field];
      if (!Array.isArray(list)) {
        continue;
      }
      const copies: unknown[] = [];
      for (const [index, entry] of list.entries()) {
        if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
          copies.push(entry);
          continue;
        }
        const here = `${at}${field}.${index}`;
        const holder = entry as RecordsHolder;
        const copy: Record<string, unknown> = { ...(entry as Record<string, unknown>) };
        if (Array.isArray(holder.log)) {
          const log: unknown[] = [];
          for (const [step, record] of holder.log.entries()) {
            if (typeof record !== 'object' || record === null || !Object.hasOwn(record, 'gained')) {
              log.push(record);
              continue;
            }
            const gained = withoutIron(
              (record as { gained: unknown }).gained,
              `${here}.log.${step}.gained`,
            );
            if (gained.problem !== null) {
              return gained.problem;
            }
            log.push({ ...(record as Record<string, unknown>), gained: gained.rest });
          }
          copy.log = log;
        }
        if (
          typeof holder.loot === 'object' &&
          holder.loot !== null &&
          Object.hasOwn(holder.loot, 'resources')
        ) {
          const loot = withoutIron(holder.loot.resources, `${here}.loot.resources`);
          if (loot.problem !== null) {
            return loot.problem;
          }
          copy.loot = { ...holder.loot, resources: loot.rest };
        }
        if (field === 'reports' && Object.hasOwn(entry, 'wasted')) {
          const wasted = withoutIron(holder.wasted, `${here}.wasted`);
          if (wasted.problem !== null) {
            return wasted.problem;
          }
          copy.wasted = wasted.rest;
        }
        copies.push(copy);
      }
      stripped[field] = copies;
    }
    return form(stripped, path);
  };
}

/**
 * O Mercado da versão 25: o da 22 (com as caravanas) com o ferro nos preços e no que foi
 * negociado hoje. Uma caravana continua levando só comida, madeira ou pedra (a forma da 22).
 */
export const marketV25Fields: Readonly<Record<string, Shape>> = {
  ...marketV22Fields,
  prices: each(MARKET_RESOURCE_IDS_V25, positive),
  previousPrices: each(MARKET_RESOURCE_IDS_V25, positive),
  tradedToday: each(MARKET_RESOURCE_IDS_V25, natural),
};

type IronMarketState = {
  settlement: { buildings: { market: number } };
  market: {
    prices: Record<string, number>;
    previousPrices: Record<string, number>;
    tradedToday: Record<string, number>;
  };
};

/**
 * A conferência do ferro no Mercado, que a guarda da versão 21 (com a lista dela) não alcança:
 * sem o edifício o preço do ferro não andou e nada dele foi negociado, e o preço de hoje e o de
 * ontem ficam entre o piso e o teto do passeio (o passeio sempre põe o preço entre os dois).
 */
export const ironMarketWithinState: Shape = (value, path) => {
  const { settlement, market } = value as IronMarketState;
  const at = path === '' ? 'market' : `${path}.market`;
  if (settlement.buildings.market === 0) {
    if (market.tradedToday.iron !== 0) {
      return `${at}.tradedToday.iron: negociação sem Mercado`;
    }
    if (market.previousPrices.iron !== market.prices.iron) {
      return `${at}.previousPrices.iron: preço que andou sem Mercado`;
    }
  }
  for (const field of ['prices', 'previousPrices'] as const) {
    const price = market[field].iron as number;
    if (price < IRON_PRICE_FLOOR_V25 || price > IRON_PRICE_CEILING_V25) {
      return `${at}.${field}.iron: preço fora do piso e do teto do passeio`;
    }
  }
  return null;
};

/**
 * O `GameState` da versão 25: o da versão 24 com o ferro (V4B-T1; ADR 0019, decisão 3).
 *
 * - `settlement.resources`, `accumulators` e `wasted` ganham `iron`.
 * - `market.prices`, `previousPrices` e `tradedToday` ganham `iron`; as caravanas não levam ferro.
 * - Cada registro de quantidades de uma expedição (`log[].gained`, `loot.resources` e, no
 *   relatório, `wasted`) ganha `iron`.
 * - `rng` e `ids` não mudam de forma: o ferro anda no fluxo `market`, que já existia.
 *
 * Quem subir `schemaVersion` para 26 acrescenta aqui o passo `v25ToV26`, com esta forma como
 * entrada, e escreve a forma nova em `v26.ts`.
 */
export const settlementV25Fields: Readonly<Record<string, Shape>> = {
  ...settlementV24Fields,
  resources: amounts,
  accumulators: each(RESOURCE_IDS_V25, integer),
  wasted: amounts,
};

export const guildV25Fields: Readonly<Record<string, Shape>> = guildV24Fields;

export const stateV25Fields: Readonly<Record<string, Shape>> = {
  ...stateV24Fields,
  schemaVersion: literal(25),
  settlement: exactObject(settlementV25Fields),
  guild: ironAwareGuild(guildOf(exactObject(guildV25Fields))),
  rng: rngShape(RNG_FIXED_STREAMS_V21, RNG_STREAM_FAMILIES_V13),
  market: exactObject(marketV25Fields),
};

const stateV25Form: Shape = exactObject(stateV25Fields);
const stateV25Streams: Shape = rngWithinIds(RNG_STREAM_FAMILIES_V13);

export const stateV25: Shape = (value, path) =>
  stateV25Form(value, path) ??
  stateV25Streams(value, path) ??
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
  marketLimitsWithinState(value, path);

/**
 * 25 → 26: o Ferreiro e as armas (V4B-T2; ADR 0019, decisão 4).
 *
 * - `settlement.buildings.smithy` entra em **0**: o Ferreiro nasce como a Taverna e a Guilda, e
 *   quem tem o Salão no nível 4 pode erguê-lo a partir da fronteira.
 * - `settlement.weapons` entra em 0 e `settlement.forge`, em `null`: ninguém tem arma nem lote.
 *
 * **O passo não cria prazo** (e por isso não usa a fronteira), não emite evento, não dá
 * identificador a ninguém e não toca o gerador. As obras e as planejadas não mudam.
 */
export const v25ToV26: MigrationStep = {
  from: 25,
  summary: 'entram o Ferreiro (nível 0), as armas (0) e a forja vazia',
  shape: stateV25,
  migrate(state) {
    const settlement = state.settlement as Record<string, unknown>;
    return {
      ...state,
      schemaVersion: 26,
      settlement: {
        ...settlement,
        buildings: { ...(settlement.buildings as Record<string, number>), smithy: 0 },
        weapons: 0,
        forge: null,
      },
    };
  },
};
