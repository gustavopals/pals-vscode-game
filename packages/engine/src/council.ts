import { crownGoldFactor } from './relics';
import { healingDurationMs } from './chapel';
import { unlockExpedition } from './expeditionUnlocks';
import { canDepartNow } from './formations';
import {
  armyHasRoom,
  inAftermath,
  councilWarLock,
  applyCouncilWarEffect,
  councilOptionCost,
} from './councilWar';
import { sightedRaid } from './threat';
import { wallMissingHp } from './wallRepair';
import {
  balance,
  buildings,
  type CouncilCard,
  type CouncilEffect,
  type CouncilOption,
  type HeroTraitId,
  councilCards,
  councilHeroTexts,
  type MasterId,
  type UnitId,
  type ResourceAmounts,
  RESOURCE_IDS,
} from '@lotg/content';

import { grantSoldiers } from './armyTurn';
import { armyCap, soldierCount } from './army';
import { promiseHero } from './arrivals';
import { emit } from './chronicle';
import {
  councilHeroCandidates,
  councilHeroData,
  councilHeroWords,
  freeCouncilHero,
} from './councilHeroes';
import { DAY_MS, YEAR_MS, yearOf, isYearBoundary, nextDayBoundary, seasonAt } from './clock';
import { amountsData, constructionOf, missingResources, payResources } from './construction';
import { plural, thousands } from './format';
import { rosterHasRoom, traitLabel } from './heroes';
import { deliverMaster, masterCanArrive } from './masterTurn';
import { addMoraleEffect } from './morale';
import { recoverHeroes, nextHiddenDestination, revealDestination } from './outcomes';
import { reject } from './rejections';
import { storeResource } from './storage';
import type {
  CouncilHero,
  GameEvent,
  GameState,
  PendingCard,
  Rejection,
  ResourceId,
  ScheduledCard,
} from './types';
import { MILLI, positiveEntries, realToGameMs } from './units';

/**
 * O Conselho do Feudo (GDD §7; ADR 0014, decisões 1, 9, 18 e 20): as regras que não sorteiam.
 * A chegada de uma carta, a expiração, as continuações, os efeitos e a resposta do jogador
 * ficam aqui; quem sorteia é `councilTurn.ts`, na virada do dia; quem mostra, `councilView.ts`.
 * Este módulo não importa o gerador: serve às ordens e à visão, que nunca sorteiam.
 *
 * Toda função recebe o catálogo por parâmetro, e o padrão é o do conteúdo: os testes de unidade
 * jogam com cartas de mentira sem que o jogo tenha outra porta de entrada.
 */

const { council: rules } = balance;

export type Catalog = readonly CouncilCard[];

/** O catálogo do jogo: as cartas de `@lotg/content`, na ordem do conteúdo. */
export const CATALOG: Catalog = councilCards;

/** O intervalo entre dois sorteios, em tempo de jogo. */
export const DRAW_INTERVAL_MS = rules.drawIntervalDays * DAY_MS;

export function cardOf(catalog: Catalog, cardId: string): CouncilCard | null {
  return catalog.find((card) => card.id === cardId) ?? null;
}

export function optionOf(card: CouncilCard, optionId: unknown): CouncilOption | null {
  return card.options.find((option) => option.id === optionId) ?? null;
}

/**
 * A opção que o conselho aplica sozinho quando a carta expira: a da dificuldade da partida ou,
 * se a carta marca uma opção com requisito para este caso (`autoResolveIfUnlocked`) e o feudo
 * tem agora o que ela exige, essa. É como a Paliçada erguida cumpre a promessa sem o senhor na
 * sala. A visão usa a mesma conta para dizer o que acontece se ninguém responder: com a obra
 * pronta, a resposta muda no mesmo instante.
 */
export function defaultOption(state: GameState, card: CouncilCard): CouncilOption | null {
  const unlocked = optionOf(card, card.autoResolveIfUnlocked);
  if (unlocked !== null && optionLock(state, unlocked) === null) {
    return unlocked;
  }
  return optionOf(card, card.autoResolve[state.settings.difficulty]);
}

/**
 * O prazo de resposta em tempo de jogo: as 24 h reais do conteúdo no ritmo desta partida. É um
 * prazo de tempo real, e a conversão acontece uma vez, quando a carta chega (roadmap da v0.2,
 * §0.7, "Relógios explícitos"). Em um ritmo que não dê um número inteiro de milissegundos,
 * arredonda: o estado só guarda inteiros.
 */
export function expiryMs(state: GameState): number {
  return realToGameMs(rules.expiryRealMs, state.settings.timeScale);
}

/** O dia de jogo do feudo a contar da fundação: o primeiro é 1. */
export function gameDayAt(atMs: number): number {
  return Math.floor(atMs / DAY_MS) + 1;
}

/** "ceder a madeira": o rótulo de uma opção no meio de uma frase. */
export function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * As cartas da mesa que o catálogo ainda tem. Só elas ocupam lugar: a que o conteúdo deixou de
 * ter (ele mudou com ela na mesa) ninguém vê nem pode responder, e sai calada no prazo dela.
 */
export function seatedCards(state: GameState, catalog: Catalog): PendingCard[] {
  return state.council.pending.filter((entry) => cardOf(catalog, entry.cardId) !== null);
}

/** Quantas cartas ainda cabem entre as pendentes. */
export function freeSeats(state: GameState, catalog: Catalog): number {
  return Math.max(0, rules.maxPending - seatedCards(state, catalog).length);
}

/**
 * Os requisitos de uma carta valem em `atMs`: estação, dia mínimo, edifícios, flags e faixa de
 * moral. A moral é a que está valendo (a virada do dia já a recalculou quando o sorteio roda).
 */
export function meetsRequirements(state: GameState, card: CouncilCard, atMs: number): boolean {
  const { requires } = card;
  if (requires === undefined) {
    return true;
  }
  const { settlement, council } = state;
  if (
    requires.tile !== undefined &&
    !Object.values(state.map.tiles).some((tile) => tile.type === requires.tile && tile.threatActive)
  )
    return false;
  if ((requires.clearedTiles ?? []).some((id) => state.map.tiles[id]?.threatActive !== false))
    return false;
  if (requires.wallDamaged && wallMissingHp(state) === 0) return false;
  if (requires.activeRaid && (state.army.activeFormationId === null || sightedRaid(state) === null))
    return false;
  if (requires.phase === 'aftermath' && !inAftermath(state)) return false;
  if (requires.armyRoom !== undefined && !armyHasRoom(state, requires.armyRoom)) return false;
  if (
    (requires.heroPresent !== undefined || requires.injuredHero === true) &&
    councilHeroCandidates(state, card).length < (requires.heroPresent ?? 1)
  )
    return false;
  if (requires.seasons !== undefined && !requires.seasons.includes(seasonAt(atMs).id)) {
    return false;
  }
  if (requires.minDay !== undefined && gameDayAt(atMs) < requires.minDay) {
    return false;
  }
  for (const [building, level] of Object.entries(requires.buildings ?? {})) {
    if ((settlement.buildings[building as keyof typeof settlement.buildings] ?? 0) < level) {
      return false;
    }
  }
  if ((requires.flags ?? []).some((flag) => council.flags[flag] !== true)) {
    return false;
  }
  if ((requires.notFlags ?? []).some((flag) => council.flags[flag] === true)) {
    return false;
  }
  if (requires.undiscovered === true && nextHiddenDestination(state) === null) {
    return false;
  }
  if (
    typeof requires.undiscovered === 'string' &&
    state.map.discovered.includes(requires.undiscovered)
  )
    return false;
  if (
    positiveEntries(requires.resourcesAbove ?? {}).some(
      ([resource, amount]) => settlement.resources[resource] <= amount * MILLI,
    )
  )
    return false;
  if (requires.moralRange !== undefined) {
    const [min, max] = requires.moralRange;
    if (settlement.morale < min || settlement.morale > max) {
      return false;
    }
  }
  return true;
}

/** Quantas vezes uma carta já chegou nesta partida, por sorteio, roteiro ou continuação. */
function timesDrawn(state: GameState, cardId: string): number {
  return state.stats[`cardsDrawn:${cardId}`] ?? 0;
}

const isPending = (state: GameState, cardId: string) =>
  state.council.pending.some((entry) => entry.cardId === cardId);

/**
 * As cartas que o sorteio de `atMs` pode tirar, **na ordem do catálogo** (a ordem faz parte do
 * sorteio): com peso, sem roteiro, com os requisitos em dia, que não estão na mesa nem
 * agendadas e que ainda não saíram neste ano, salvo as recorrentes. `seen` é a lista do ano;
 * quem pergunta por um instante depois da virada do ano passa a lista vazia.
 */
export function eligibleCards(
  state: GameState,
  atMs: number,
  catalog: Catalog,
  seen: readonly string[] = state.council.seenThisYear,
): CouncilCard[] {
  return catalog.filter(
    (card) =>
      card.weight > 0 &&
      card.scripted === undefined &&
      (card.recurring === true || !seen.includes(card.id)) &&
      !isPending(state, card.id) &&
      !state.council.scheduled.some((entry) => entry.cardId === card.id) &&
      meetsRequirements(state, card, atMs),
  );
}

/**
 * A carta roteirizada que fura o sorteio de `atMs`: a primeira do catálogo cujo dia chegou e
 * que ainda não saiu nesta partida. O dia conta da fundação e não tem teto: a partida que já
 * passou dele (a que vem de uma versão anterior, ou a que encontrou a mesa cheia) recebe a carta
 * na primeira audiência com lugar, uma vez, no ano que for. A primeira roteirizada do jogo é
 * "Estrangeira ferida" (ADR 0017, decisão 6).
 */
export function scriptedCard(state: GameState, atMs: number, catalog: Catalog): CouncilCard | null {
  return (
    catalog.find(
      (card) =>
        card.scripted !== undefined &&
        scriptedDue(state, card.scripted, atMs) &&
        (card.recurring === true
          ? !state.council.seenThisYear.includes(card.id) && !isPending(state, card.id)
          : timesDrawn(state, card.id) === 0) &&
        meetsRequirements(state, card, atMs),
    ) ?? null
  );
}

/**
 * O gatilho de uma carta roteirizada chegou: o dia marcado (`atGameDay`) ou o nível do Salão
 * (`onHallLevel`), lido no instante do sorteio. Nenhum dos dois grava estado: a partida que já
 * passou do gatilho recebe a carta na primeira audiência com lugar.
 */
function scriptedDue(
  state: GameState,
  scripted: NonNullable<CouncilCard['scripted']>,
  atMs: number,
): boolean {
  if ('atGameDay' in scripted) return scripted.atGameDay <= gameDayAt(atMs);
  if ('onHallLevel' in scripted) return state.settlement.buildings.townHall >= scripted.onHallLevel;
  if ('beforeSiege' in scripted)
    return (
      state.siege !== null &&
      state.siege.year === yearOf(atMs) &&
      state.siege.current === 0 &&
      state.siege.result === null &&
      atMs < state.siege.atMs
    );
  const wanted = 'atSeasonStart' in scripted ? scripted.atSeasonStart : scripted.atSeasonEnd;
  let days = 0;
  for (const season of balance.calendar.seasons) {
    if (season.id === wanted) {
      if ('atSeasonEnd' in scripted) days += season.days - 1;
      break;
    }
    days += season.days;
  }
  return atMs >= (scripted.year - 1) * YEAR_MS + days * DAY_MS;
}

/** Se todas as flags exigidas pela continuação agendada (`scheduleCard.ifFlags`) estão gravadas. */
function continuationReady(state: GameState, entry: ScheduledCard, catalog: Catalog): boolean {
  const previousCard = cardOf(catalog, entry.previousCardId);
  const previousOption =
    previousCard === null ? null : optionOf(previousCard, entry.previousOptionId);
  const scheduled = previousOption?.effects.find(
    (effect): effect is Extract<CouncilEffect, { type: 'scheduleCard' }> =>
      effect.type === 'scheduleCard' && effect.cardId === entry.cardId,
  );
  return (scheduled?.ifFlags ?? []).every((flag) => state.council.flags[flag] === true);
}

/**
 * Se uma continuação exige uma flag de expedição (ex.: `whiteWolf.slain` em H-12) e a janela da
 * expedição já fechou sem abate e sem equipe na estrada, cancela a carta e limpa o ramo.
 */
function cancelUnmetContinuations(draft: GameState, catalog: Catalog): void {
  const { council } = draft;
  for (let index = council.scheduled.length - 1; index >= 0; index--) {
    const entry = council.scheduled[index]!;
    if (continuationReady(draft, entry, catalog)) continue;
    const previousCard = cardOf(catalog, entry.previousCardId);
    const previousOption =
      previousCard === null ? null : optionOf(previousCard, entry.previousOptionId);
    const unlock = previousOption?.effects.find((effect) => effect.type === 'unlockExpedition');
    if (unlock === undefined) continue;
    const windowOpen = draft.map.expeditionUnlocks[unlock.modelId] !== undefined;
    const inFlight = draft.guild.expeditions.some(
      (expedition) => expedition.modelId === unlock.modelId,
    );
    if (windowOpen || inFlight) continue;
    council.scheduled.splice(index, 1);
    for (const effect of previousOption?.effects ?? []) {
      if (effect.type === 'setFlag') {
        delete council.flags[effect.flag];
      }
    }
  }
}

/** As continuações cujo prazo já chegou em `atMs` e cuja carta ainda existe no catálogo. */
export function dueContinuations(
  state: GameState,
  atMs: number,
  catalog: Catalog,
): ScheduledCard[] {
  return state.council.scheduled.filter(
    (entry) =>
      entry.atMs <= atMs &&
      cardOf(catalog, entry.cardId) !== null &&
      continuationReady(state, entry, catalog),
  );
}

/**
 * O texto e a frase de chegada de uma carta, na variante que a história pede: a primeira cuja
 * flag está gravada. É como uma continuação lembra a escolha que a trouxe.
 */
export function cardReading(
  state: GameState,
  card: CouncilCard,
): { text: string; arrival: string | undefined } {
  const variant = (card.variants ?? []).find((entry) => state.council.flags[entry.flag] === true);
  return {
    text: variant?.text ?? card.text,
    arrival: variant?.arrival ?? card.arrival,
  };
}

/** De onde uma carta veio: do sorteio, do roteiro, ou da escolha que a agendou. */
export type CardOrigin = { source: 'draw' | 'scripted' } | ScheduledCard;

/**
 * Põe uma carta na mesa em `atMs`: uma ocorrência nova, com o prazo de resposta convertido
 * agora, e a linha da chegada na Crônica. A de uma continuação leva a escolha que a trouxe
 * (`previousCardId`, `previousOptionId`, `previousInstanceId`), para a Crônica ligar as duas.
 */
export function deliverCard(
  draft: GameState,
  card: CouncilCard,
  atMs: number,
  events: GameEvent[],
  origin: CardOrigin,
  heroes: CouncilHero[] = [],
): PendingCard {
  const { council, stats } = draft;
  // A ocorrência é o modelo e a ordem de chegada na partida: determinística, sem sorteio.
  stats.cardsDrawn = (stats.cardsDrawn ?? 0) + 1;
  stats[`cardsDrawn:${card.id}`] = timesDrawn(draft, card.id) + 1;
  const pending: PendingCard = {
    instanceId: `${card.id}-${stats.cardsDrawn}`,
    cardId: card.id,
    ...(heroes.length === 0 ? {} : { heroes }),
    drawnAtMs: atMs,
    expiresAtMs:
      card.scripted !== undefined && 'beforeSiege' in card.scripted
        ? Math.min(atMs + expiryMs(draft), draft.siege!.atMs)
        : atMs + expiryMs(draft),
    origin:
      'source' in origin
        ? null
        : {
            cardId: origin.previousCardId,
            optionId: origin.previousOptionId,
            instanceId: origin.previousInstanceId,
          },
  };
  council.pending.push(pending);
  if (!council.seenThisYear.includes(card.id)) {
    council.seenThisYear.push(card.id);
  }
  emit(
    events,
    draft,
    atMs,
    'cardDrawn',
    'source' in origin
      ? { cardId: card.id, instanceId: pending.instanceId, source: origin.source }
      : {
          cardId: card.id,
          instanceId: pending.instanceId,
          source: 'continuation',
          previousCardId: origin.previousCardId,
          previousOptionId: origin.previousOptionId,
          previousInstanceId: origin.previousInstanceId,
        },
    { carta: card.title, ...councilHeroWords(heroes) },
    cardReading(draft, card).arrival,
  );
  return pending;
}

/** O que uma opção mexeu no estoque e na moral: vai no evento, para o Relatório não refazer conta. */
export type Outcome = {
  /** O que saiu do estoque: o custo e as perdas. Em milésimos. */
  spent: Record<ResourceId, number>;
  /** O que entrou de fato. */
  gained: Record<ResourceId, number>;
  /** O que o limite do depósito cortou de um ganho. */
  lost: Record<ResourceId, number>;
  morale: { amount: number; durationDays: number } | null;
  /** O herói com nome que a opção trouxe ou prometeu, e em quantos dias de jogo ele chega. */
  hero: { namedHeroId: string; afterDays: number } | null;
  /** Os Mestres que a opção traz, na ordem dos efeitos; entram depois da linha da carta. */
  masters: MasterId[];
  /** O destino que a opção revelou, se revelou. */
  revealed: string | null;
  /** Os soldados que a opção trouxe, por unidade. */
  soldiers: Array<{ unit: UnitId; amount: number }>;
  injuredHero: CouncilHero | null;
  healedHeroId: string | null;
  events: GameEvent[];
};

export const noOutcome = (): Outcome => ({
  spent: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 },
  gained: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 },
  lost: { food: 0, wood: 0, stone: 0, gold: 0, iron: 0 },
  morale: null,
  hero: null,
  masters: [],
  revealed: null,
  soldiers: [],
  injuredHero: null,
  healedHeroId: null,
  events: [],
});

const toUnits = (milli: Record<ResourceId, number>): ResourceAmounts =>
  Object.fromEntries(RESOURCE_IDS.map((id) => [id, milli[id] / MILLI]));

export function outcomeData(outcome: Outcome): Record<string, string | number> {
  return {
    ...(outcome.injuredHero === null
      ? {}
      : { injuredHeroId: outcome.injuredHero.id, injuredHeroName: outcome.injuredHero.name }),
    ...(outcome.healedHeroId === null ? {} : { healedHeroId: outcome.healedHeroId }),
    ...amountsData('spent', toUnits(outcome.spent)),
    ...amountsData('gained', toUnits(outcome.gained)),
    ...amountsData('lost', toUnits(outcome.lost)),
    ...(outcome.morale === null
      ? {}
      : { morale: outcome.morale.amount, moraleDays: outcome.morale.durationDays }),
    ...(outcome.hero === null
      ? {}
      : { hero: outcome.hero.namedHeroId, heroAfterDays: outcome.hero.afterDays }),
    ...(outcome.masters.length === 0 ? {} : { master: outcome.masters.join(',') }),
    ...(outcome.revealed === null ? {} : { revealed: outcome.revealed }),
    ...(outcome.soldiers.length === 0
      ? {}
      : {
          soldiers: outcome.soldiers.map((entry) => `${entry.unit}:${entry.amount}`).join(','),
        }),
  };
}

/** A primeira virada de dia depois de `atMs` e mais `days − 1` dias: a `days`-ésima virada. */
function dayTurnAfter(atMs: number, days: number): number {
  return nextDayBoundary(atMs) + (days - 1) * DAY_MS;
}

/** Insere mantendo a lista em ordem de instante; quem empata fica depois de quem já estava. */
function insertByTime<T extends { atMs: number }>(list: T[], entry: T): void {
  const index = list.findIndex((existing) => existing.atMs > entry.atMs);
  list.splice(index === -1 ? list.length : index, 0, entry);
}

/**
 * Aplica uma lista de efeitos de uma opção, uma vez, em `atMs`.
 *
 * - **Recursos:** o ganho passa pelo depósito (entra o que cabe; o resto é desperdício contado,
 *   GDD §5.5); a perda leva o que houver, e o estoque nunca fica negativo.
 * - **Moral:** um efeito temporário com o nome da carta, que conta em `durationDays` viradas do
 *   dia. Não mexe na moral na hora (GDD §5.7).
 * - **Flags:** gravadas e apagadas; só outras cartas as leem.
 * - **Continuação:** entra na lista de agendadas, com a escolha que a pediu.
 * - **Herói:** entra na lista dos prometidos (`guild.arriving`), para agora ou para `afterDays`
 *   dias de jogo depois, contados deste instante. Quem cria o herói é `settleHeroArrivals`, que
 *   a ordem e o instante chamam logo em seguida: a linha da chegada vem depois da da carta.
 */
export function applyEffects(
  draft: GameState,
  effects: readonly CouncilEffect[],
  source: {
    card: CouncilCard;
    option: CouncilOption;
    instanceId: string;
    hidden: boolean;
    heroes?: readonly CouncilHero[] | undefined;
    injuredHeroId?: string | undefined;
  },
  atMs: number,
  outcome: Outcome,
): void {
  const { settlement, council } = draft;
  const { card, option, instanceId, hidden } = source;
  for (const effect of effects) {
    switch (effect.type) {
      case 'tavernExtraOffer':
        draft.guild.tavern.extraOffer = true;
        break;
      case 'injureHero': {
        const hero = draft.guild.heroes.find((entry) => entry.id === source.injuredHeroId);
        if (hero !== undefined && freeCouncilHero(hero)) {
          hero.injury = {
            severity: effect.kind,
            untilMs: atMs + healingDurationMs(draft, balance.injuries.durationMs[effect.kind]),
          };
          hero.status = 'injured';
          draft.stats.heroesInjured = (draft.stats.heroesInjured ?? 0) + 1;
          outcome.injuredHero = { id: hero.id, name: hero.name };
        }
        break;
      }
      case 'healHero': {
        const hero = draft.guild.heroes.find((entry) => entry.id === source.heroes?.[0]?.id);
        if (hero?.status === 'injured' && hero.injury !== null) {
          hero.injury.untilMs =
            effect.mode === 'full'
              ? atMs
              : atMs + Math.ceil(Math.max(0, hero.injury.untilMs - atMs) / 2);
          outcome.healedHeroId = hero.id;
        }
        break;
      }
      case 'rollEffect':
        // Só agenda em resolveCard; quem sorteia é councilTurn, na virada seguinte.
        break;
      case 'resourcesPercent': {
        const stock = settlement.resources[effect.resource];
        const requested = Math.floor((stock * Math.abs(effect.ratio.num)) / effect.ratio.den);
        const factor =
          effect.resource === 'gold' && effect.ratio.num < 0
            ? crownGoldFactor(draft, source.card.id, atMs)
            : null;
        const amount =
          factor === null ? requested : Math.floor((requested * factor.num) / factor.den);
        if (effect.ratio.num < 0) {
          settlement.resources[effect.resource] -= amount;
          outcome.spent[effect.resource] += amount;
        } else {
          const stored = storeResource(draft, effect.resource, amount);
          outcome.gained[effect.resource] += stored;
          outcome.lost[effect.resource] += amount - stored;
        }
        break;
      }
      case 'marketPrice':
        for (const resource of effect.resources) {
          // Só a partir da próxima virada de dia: o preço do Mercado só muda na virada, e a
          // cotação do dia não pode mudar no meio dele (nada de comprar e vender com lucro).
          const fromMs = nextDayBoundary(atMs);
          draft.market.effects.push({
            resource,
            factor: { ...effect.factor },
            fromMs,
            untilMs: fromMs + effect.durationDays * DAY_MS,
            label: `Carta: ${card.title}`,
          });
        }
        break;
      case 'resources':
        for (const resource of RESOURCE_IDS) {
          const amount = (effect.amounts[resource] ?? 0) * MILLI;
          if (amount > 0) {
            const stored = storeResource(draft, resource, amount);
            outcome.gained[resource] += stored;
            outcome.lost[resource] += amount - stored;
          } else if (amount < 0) {
            const taken = Math.min(settlement.resources[resource], -amount);
            settlement.resources[resource] -= taken;
            outcome.spent[resource] += taken;
          }
        }
        break;
      case 'morale':
        addMoraleEffect(draft, {
          // Um id por ocorrência e por momento: o efeito conhecido e o escondido da mesma
          // carta somam, e duas cartas diferentes também.
          id: `card:${instanceId}${hidden ? ':later' : ''}`,
          label: `Carta: ${card.title}`,
          amount: effect.amount,
          untilMs: atMs + effect.durationDays * DAY_MS,
        });
        outcome.morale = { amount: effect.amount, durationDays: effect.durationDays };
        break;
      case 'setFlag':
        council.flags[effect.flag] = true;
        break;
      case 'clearFlag':
        delete council.flags[effect.flag];
        break;
      case 'scheduleCard':
        insertByTime(council.scheduled, {
          cardId: effect.cardId,
          atMs: atMs + effect.afterDays * DAY_MS,
          previousCardId: card.id,
          previousOptionId: option.id,
          previousInstanceId: instanceId,
        });
        break;
      case 'addHero': {
        const afterDays = effect.afterDays ?? 0;
        if (promiseHero(draft, effect.heroId, atMs + afterDays * DAY_MS)) {
          outcome.hero = { namedHeroId: effect.heroId, afterDays };
        }
        break;
      }
      case 'unlockExpedition':
        unlockExpedition(draft, effect.modelId, effect.forDays, atMs);
        break;
      case 'revealDestination': {
        const next = effect.modelId ?? nextHiddenDestination(draft);
        if (next !== null && revealDestination(draft, next)) {
          outcome.revealed = next;
        }
        break;
      }
      case 'addSoldiers': {
        const granted =
          effect.fromPopulation === false
            ? armyHasRoom(draft, effect.amount)
              ? effect.amount
              : 0
            : grantSoldiers(draft, effect.unit, effect.amount);
        if (effect.fromPopulation === false) draft.army.units[effect.unit] += granted;
        if (granted > 0) {
          outcome.soldiers.push({ unit: effect.unit, amount: granted });
        }
        break;
      }
      case 'addMaster':
        // O Mestre chega depois da linha da carta (`deliverOutcomeMasters`); aqui só se confere
        // que as flags pedidas estão gravadas **agora** e que ele ainda pode chegar.
        if (
          (effect.ifFlags ?? []).every((name) => council.flags[name] === true) &&
          masterCanArrive(draft, effect.masterId) &&
          !outcome.masters.includes(effect.masterId)
        ) {
          outcome.masters.push(effect.masterId);
        }
        break;
      default:
        applyCouncilWarEffect(draft, effect, card, instanceId, atMs, outcome.events);
    }
  }
}

/**
 * Entrega os Mestres que a opção trouxe, depois de a linha da carta ter sido emitida: a Crônica
 * conta a escolha e, em seguida, a chegada (ou a espera à porta). É a única porta do Mestre de
 * carta; `deliverMaster` não sorteia.
 */
function deliverOutcomeMasters(
  draft: GameState,
  outcome: Outcome,
  atMs: number,
  events: GameEvent[],
): void {
  events.push(...outcome.events);
  if (outcome.healedHeroId !== null) recoverHeroes(draft, atMs, events);
  for (const masterId of outcome.masters) {
    deliverMaster(draft, masterId, atMs, events);
  }
}

/**
 * Aplica uma opção a uma carta que já saiu da mesa: os efeitos conhecidos agora, e o escondido,
 * se houver, fica marcado para a virada de dia dele. O custo é de quem chamou: a expiração não
 * cobra nada.
 *
 * O efeito escondido acontece sempre em uma virada de dia, depois da moral: a visão, que prevê
 * a próxima virada sem processá-la, nunca o vê antes da hora.
 */
function resolveCard(
  draft: GameState,
  pending: PendingCard,
  card: CouncilCard,
  option: CouncilOption,
  atMs: number,
  outcome: Outcome,
): void {
  const { instanceId } = pending;
  applyEffects(
    draft,
    option.effects,
    { card, option, instanceId, hidden: false, heroes: pending.heroes },
    atMs,
    outcome,
  );
  if (
    option.hidden !== undefined ||
    option.effects.some((effect) => effect.type === 'rollEffect')
  ) {
    insertByTime(draft.council.delayed, {
      ...(pending.heroes === undefined
        ? {}
        : { heroes: pending.heroes.map((hero) => ({ ...hero })) }),
      atMs: dayTurnAfter(atMs, option.hidden?.afterDays ?? 1),
      instanceId,
      cardId: card.id,
      optionId: option.id,
    });
  }
}

/** A ficha §8.1 manda narrar a chegada tardia nas opções de cura se o alvo já sarou ou partiu. */
function healerIsLate(state: GameState, option: CouncilOption, pending: PendingCard): boolean {
  return (
    option.effects.some((effect) => effect.type === 'healHero') &&
    !state.guild.heroes.some(
      (hero) =>
        hero.id === pending.heroes?.[0]?.id && hero.status === 'injured' && hero.injury !== null,
    )
  );
}

/**
 * As cartas cujo prazo acabou em `atMs`: o conselho aplica a opção da dificuldade, sem custo, e
 * a Crônica diz o que foi feito (`cardExpired`). Roda antes de qualquer ordem do mesmo
 * instante: a resposta que chega junto encontra a carta já decidida (`CARD_EXPIRED`).
 *
 * Uma carta que o catálogo já não tem (o conteúdo mudou com ela na mesa) sai sem efeito e sem
 * linha: não há o que aplicar nem o que dizer. Até lá ela não ocupa lugar (`seatedCards`).
 */
export function expireCards(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council, stats } = draft;
  const due = council.pending.filter((entry) => entry.expiresAtMs <= atMs);
  if (due.length === 0) {
    return;
  }
  council.pending = council.pending.filter((entry) => entry.expiresAtMs > atMs);
  for (const pending of due) {
    const card = cardOf(catalog, pending.cardId);
    const option = card === null ? null : defaultOption(draft, card);
    if (card === null || option === null) {
      continue;
    }
    const late = healerIsLate(draft, option, pending);
    const outcome = noOutcome();
    resolveCard(draft, pending, card, option, atMs, outcome);
    council.expired.push(pending.instanceId);
    stats.cardsExpired = (stats.cardsExpired ?? 0) + 1;
    emit(
      events,
      draft,
      atMs,
      'cardExpired',
      {
        cardId: card.id,
        instanceId: pending.instanceId,
        optionId: option.id,
        difficulty: draft.settings.difficulty,
        ...councilHeroData(pending.heroes),
        ...outcomeData(outcome),
      },
      { carta: card.title, opcao: lowerFirst(option.label), ...councilHeroWords(pending.heroes) },
      late ? councilHeroTexts.healerLate : option.expiredChronicle,
    );
    deliverOutcomeMasters(draft, outcome, atMs, events);
  }
}

/**
 * As continuações cujo prazo chegou entram na mesa enquanto houver lugar, na ordem do prazo. A
 * que não cabe fica na lista e chega no primeiro instante em que uma pendente sair: uma
 * expiração (este mesmo passo, logo depois dela) ou uma resposta do jogador.
 */
export function deliverContinuations(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): void {
  const { council } = draft;
  cancelUnmetContinuations(draft, catalog);
  for (;;) {
    const index = council.scheduled.findIndex(
      (entry) => entry.atMs <= atMs && continuationReady(draft, entry, catalog),
    );
    if (index === -1) {
      return;
    }
    const entry = council.scheduled[index] as ScheduledCard;
    const card = cardOf(catalog, entry.cardId);
    if (card !== null && freeSeats(draft, catalog) === 0) {
      return;
    }
    council.scheduled.splice(index, 1);
    // A carta que o catálogo já não tem sai da lista sem chegar.
    if (card !== null) {
      deliverCard(draft, card, atMs, events, entry);
    }
  }
}

/**
 * A virada do ano no Conselho (ADR 0014, decisão 20): só a lista das cartas vistas no ano zera
 * (e, com ela, a das expiradas, que só serve às recusas). Flags, cartas na mesa, continuações
 * agendadas e efeitos em curso continuam.
 */
export function turnCouncilYear(draft: GameState, atMs: number): void {
  if (isYearBoundary(atMs)) {
    draft.council.seenThisYear = [];
    draft.council.expired = [];
  }
}

/**
 * Instante, em ms de jogo, do próximo evento do Conselho com hora marcada: uma carta que
 * expira, um efeito escondido que acontece ou uma continuação cujo prazo ainda não chegou.
 * `null` sem nenhum. O sorteio não entra: ele é da virada do dia, que já é um instante da linha
 * do tempo. A continuação vencida que espera lugar também não: quem abre o lugar é uma
 * expiração (que está aqui) ou uma ordem.
 */
export function nextCouncilEventAt(state: GameState): number | null {
  const now = state.lastProcessedAt;
  const { pending, delayed, scheduled } = state.council;
  const instants = [
    ...pending.map((entry) => entry.expiresAtMs),
    ...delayed.map((entry) => entry.atMs),
    ...scheduled.map((entry) => entry.atMs).filter((atMs) => atMs > now),
  ];
  return instants.length === 0 ? null : Math.min(...instants);
}

/**
 * O que tranca uma opção, em um pedaço de frase: "requer o Celeiro"; com a obra do edifício em
 * curso, "requer a Paliçada, que ainda está em obras". `null` quando o feudo tem o que ela
 * exige. O custo não entra aqui: quem não pode pagar vê o que falta, não uma tranca.
 */
export function optionLock(state: GameState, option: CouncilOption): string | null {
  const warLock = councilWarLock(state, option);
  if (warLock !== null) return warLock;
  const { requires } = option;
  if (requires === undefined) {
    return null;
  }
  const { settlement } = state;
  if (
    requires.heroPresent !== undefined &&
    state.guild.heroes.filter((hero) => canDepartNow(state, hero)).length < requires.heroPresent
  )
    return 'requer um herói livre no feudo para partir';
  if (!optionVisible(state, option)) return 'requer a história dos mercadores em curso';
  for (const [id, level] of Object.entries(requires.buildings ?? {})) {
    const building = id as keyof typeof settlement.buildings;
    if (settlement.buildings[building] < level)
      return `requer ${buildings[building].article} ${buildings[building].label} Nv${level}`;
  }
  if (requires.undiscovered !== undefined && state.map.discovered.includes(requires.undiscovered))
    return 'requer um destino ainda não revelado';
  if (requires.heroTrait !== undefined && optionHero(state, requires.heroTrait) === null)
    return `requer um herói ${traitLabel(requires.heroTrait, 'm')} livre no feudo`;
  if (requires.minSoldiers !== undefined && soldierCount(state) < requires.minSoldiers)
    return `requer ${plural(requires.minSoldiers, 'soldado treinado', 'soldados treinados')} no Exército`;
  if (requires.building !== undefined && settlement.buildings[requires.building] < 1) {
    const def = buildings[requires.building];
    // Com a obra em curso a frase diz que falta pouco: quem já mandou erguer sabe o que esperar.
    return constructionOf(state, requires.building) === null
      ? `requer ${def.article} ${def.label}`
      : `requer ${def.article} ${def.label}, que ainda está em obras`;
  }
  if (requires.soldierRoom !== undefined) {
    const room = soldierRoomText(state, requires.soldierRoom);
    if (room !== null) {
      return room;
    }
  }
  if (requires.rosterRoom === true && !rosterHasRoom(state)) {
    return 'requer lugar na lista de heróis';
  }
  const short = positiveEntries(requires.resources ?? {}).find(
    ([resource, amount]) => settlement.resources[resource] < amount * MILLI,
  );
  if (short !== undefined) {
    const [resource, amount] = short;
    return `requer ${thousands(amount)} de ${balance.resources[resource].label.toLowerCase()} em estoque`;
  }
  return null;
}

/** Flag de opção controla a presença; os demais requisitos continuam aparecendo como tranca. */
export function optionVisible(state: GameState, option: CouncilOption): boolean {
  return (option.requires?.flags ?? []).every((flag) => state.council.flags[flag] === true);
}

export function optionHero(state: GameState, trait: HeroTraitId) {
  return (
    state.guild.heroes.find((hero) => hero.status === 'idle' && hero.traits.includes(trait)) ?? null
  );
}

/**
 * Por que não cabem `amount` soldados novos, em um pedaço de frase; `null` quando cabem. O teto
 * do Quartel conta o lote em treino, e os aldeões que o piso protege não saem.
 */
function soldierRoomText(state: GameState, amount: number): string | null {
  if (state.settlement.buildings.barracks < 1) {
    return `requer ${buildings.barracks.article} ${buildings.barracks.label}`;
  }
  const training = state.army.training?.amount ?? 0;
  if (soldierCount(state) + training + amount > armyCap(state)) {
    return `requer vaga para ${plural(amount, 'soldado', 'soldados')} no Quartel`;
  }
  if (state.settlement.population.villagers - balance.morale.populationFloor < amount) {
    return 'requer aldeões sobrando para virar soldado';
  }
  return null;
}

/**
 * A resposta do jogador a uma carta (GDD §7.1). Recusas, na ordem: a carta não está na mesa
 * (`CARD_EXPIRED` se o prazo dela acabou neste ano, `CARD_NOT_PENDING` no resto), a opção não
 * existe (`INVALID_OPTION`), está trancada (`OPTION_LOCKED`) ou custa mais do que há
 * (`INSUFFICIENT_RESOURCES`, com o que falta).
 *
 * Aceita, a ordem paga o custo e aplica os efeitos conhecidos uma vez; o que a opção esconde
 * fica marcado para depois e **não** aparece no evento desta ordem. A carta sai da mesa, e uma
 * continuação que esperava lugar chega no mesmo instante. Não sorteia nada.
 */
export function answerCard(
  draft: GameState,
  instanceId: unknown,
  optionId: unknown,
  nowMs: number,
  events: GameEvent[],
  catalog: Catalog = CATALOG,
): Rejection | null {
  const { council, stats } = draft;
  const index = council.pending.findIndex((entry) => entry.instanceId === instanceId);
  const pending = council.pending[index];
  const card = pending === undefined ? null : cardOf(catalog, pending.cardId);
  if (pending === undefined || card === null) {
    return reject(
      typeof instanceId === 'string' && council.expired.includes(instanceId)
        ? 'CARD_EXPIRED'
        : 'CARD_NOT_PENDING',
    );
  }
  const option = optionOf(card, optionId);
  if (option === null) {
    return reject('INVALID_OPTION', { label: card.title });
  }
  const lock = optionLock(draft, option);
  if (lock !== null) {
    return reject('OPTION_LOCKED', { remedy: lock });
  }
  // Obras e reparos pagam pela porta própria; os demais custos são cobrados aqui.
  const dynamicCost = councilOptionCost(draft, option);
  const cost = option.cost ?? {};
  const missing = missingResources(draft, dynamicCost);
  if (missing !== null) {
    return reject('INSUFFICIENT_RESOURCES', { missing });
  }
  const late = healerIsLate(draft, option, pending);
  payResources(draft, cost);
  draft.settlement.weapons -= option.weaponsCost ?? 0;
  const speaker =
    option.requires?.heroTrait === undefined ? null : optionHero(draft, option.requires.heroTrait);
  council.pending.splice(index, 1);
  const outcome = noOutcome();
  for (const [resource, amount] of positiveEntries(cost)) {
    outcome.spent[resource] += amount * MILLI;
  }
  resolveCard(draft, pending, card, option, nowMs, outcome);
  stats.cardsAnswered = (stats.cardsAnswered ?? 0) + 1;
  emit(
    events,
    draft,
    nowMs,
    'cardAnswered',
    {
      cardId: card.id,
      instanceId: pending.instanceId,
      optionId: option.id,
      ...councilHeroData(pending.heroes),
      ...(speaker === null ? {} : { heroId: speaker.id, heroName: speaker.name }),
      ...outcomeData(outcome),
    },
    {
      carta: card.title,
      opcao: lowerFirst(option.label),
      ...councilHeroWords(pending.heroes),
      ...(speaker === null ? {} : { heroi: speaker.name }),
    },
    late ? councilHeroTexts.healerLate : option.chronicle,
  );
  deliverOutcomeMasters(draft, outcome, nowMs, events);
  // O lugar que a carta deixou pode ser de uma continuação que já esperava.
  deliverContinuations(draft, nowMs, events, catalog);
  return null;
}
