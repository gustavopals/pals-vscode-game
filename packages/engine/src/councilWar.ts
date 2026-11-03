import {
  balance,
  buildings,
  hordeUnits,
  itemRarities,
  items,
  omenTexts,
  WING_IDS,
  type CouncilCard,
  type CouncilEffect,
  type CouncilOption,
  type ResourceAmounts,
} from '@lotg/content';
import { armyCap, soldierCount } from './army';
import { emit } from './chronicle';
import { DAY_MS, seasonAt } from './clock';
import { startConstruction, upgradeQuote } from './construction';
import { stowItem } from './equipment';
import { traitLabel } from './heroes';
import { omenText } from './hordeMind';
import { nextId } from './ids';
import { ableVillagers } from './population';
import { baseRaidComposition } from './raidArmy';
import { callMilitia } from './siegeOrders';
import { sightedRaid } from './threat';
import type { GameEvent, GameState } from './types';
import { wallHpPerWing } from './wall';
import { currentRepairQuote, repairWall, wallMissingHp, wallRepairBlocked } from './wallRepair';

export const remainingFactor = (discount: { num: number; den: number }) => ({
  num: discount.den - discount.num,
  den: discount.den,
});
export const inAftermath = (state: GameState) =>
  state.siege?.endedAtMs !== null &&
  state.siege?.endedAtMs !== undefined &&
  state.siege.aftermathUntilMs !== null &&
  state.lastProcessedAt < state.siege.aftermathUntilMs &&
  seasonAt(state.lastProcessedAt).id === 'winter';
export const armyHasRoom = (state: GameState, amount: number) =>
  state.settlement.buildings.barracks > 0 &&
  soldierCount(state) + (state.army.training?.amount ?? 0) + amount <= armyCap(state);

/** Custos variáveis são cotados de novo na resposta, pelo mesmo caminho das ordens. */
export function councilOptionCost(state: GameState, option: CouncilOption): ResourceAmounts {
  const cost = { ...option.cost };
  for (const effect of option.effects) {
    if (effect.type === 'startBuilding')
      Object.assign(
        cost,
        upgradeQuote(state, effect.building, remainingFactor(effect.discount)).cost,
      );
    if (effect.type === 'repairWall') {
      const quote = currentRepairQuote(state);
      const factor = remainingFactor(effect.discount);
      cost.stone = Math.floor((quote.stone * factor.num) / factor.den);
      cost.gold = Math.floor((quote.gold * factor.num) / factor.den);
    }
  }
  return cost;
}

export function councilWarLock(state: GameState, option: CouncilOption): string | null {
  const req = option.requires;
  if (req?.armyRoom !== undefined && !armyHasRoom(state, req.armyRoom))
    return `requer vaga para ${req.armyRoom} soldados no Quartel`;
  if (req?.training && state.army.training === null) return 'requer um lote em treino no Quartel';
  if (req?.commanderTrait !== undefined) {
    const formation = state.army.formations.find((f) => f.id === state.army.activeFormationId);
    if (
      formation === undefined ||
      !Object.values(formation.commanders).some((id) =>
        state.guild.heroes.some(
          (hero) =>
            hero.id === id && hero.status === 'idle' && hero.traits.includes(req.commanderTrait!),
        ),
      )
    )
      return `requer um comandante ${traitLabel(req.commanderTrait, 'm')} na Defesa ativa`;
  }
  if (req?.siegeCasualties && (!inAftermath(state) || (state.siege?.deaths ?? 0) === 0))
    return 'requer mortos no cerco deste inverno';
  if (req?.siegeWon && (!inAftermath(state) || state.siege?.result === 'fall'))
    return 'requer o cerco vencido neste inverno';
  if ((option.weaponsCost ?? 0) > state.settlement.weapons)
    return `requer ${option.weaponsCost} armas no estoque`;
  for (const effect of option.effects) {
    if (effect.type === 'startBuilding') {
      if (state.settlement.buildings[effect.building] !== effect.level - 1)
        return `requer ${buildings[effect.building].label} Nv${effect.level - 1}`;
      const blocked = upgradeQuote(
        state,
        effect.building,
        remainingFactor(effect.discount),
      ).blocked;
      if (blocked !== null && blocked.code !== 'INSUFFICIENT_RESOURCES') return blocked.message;
    }
    if (effect.type === 'repairWall') {
      const blocked = wallRepairBlocked(state);
      if (blocked !== null) return blocked.message;
    }
    if (effect.type === 'healWall' && wallMissingHp(state) === 0)
      return 'requer uma ala da muralha danificada';
    if (effect.type === 'revealRaid' && sightedRaid(state) === null)
      return 'requer uma incursão avistada pela Torre';
    if (effect.type === 'omen' && state.horde.wavePlan === null)
      return 'requer as ondas da Horda preparadas';
    if (effect.type === 'repairDiscount' && !inAftermath(state))
      return 'requer o Rescaldo do cerco';
    if (effect.type === 'militiaReady') {
      const probe = JSON.parse(JSON.stringify(state)) as GameState;
      const max = Math.min(
        ableVillagers(state),
        Math.floor(
          (state.settlement.population.villagers * balance.army.militia.maxShare.num) /
            balance.army.militia.maxShare.den,
        ),
      );
      const blocked = callMilitia(probe, max, state.lastProcessedAt, [], true);
      if (blocked !== null) return blocked.message;
    }
  }
  return null;
}

/** Presságio concedido por carta: lê a versão atual, sem importar o gerador. */
function grantOmen(
  draft: GameState,
  effect: Extract<CouncilEffect, { type: 'omen' }>,
  atMs: number,
  events: GameEvent[],
) {
  const plan = draft.horde.wavePlan;
  const wave = plan?.waves.find((w) => w.number === (effect.wave ?? 1));
  if (plan === null || wave === undefined) return;
  const clarity = effect.clarity === 1 ? 'vague' : effect.clarity === 3 ? 'partial' : 'exact';
  const main = wave.composition.reduce((best, post) => (post.count > best.count ? post : best));
  const composition: Parameters<typeof omenText>[0]['composition'] = {};
  for (const post of wave.composition)
    composition[post.unit] = (composition[post.unit] ?? 0) + post.count;
  let text = omenText(
    {
      number: wave.number,
      mainWing: main.wing,
      composition: clarity === 'partial' ? { [main.unit]: main.count } : composition,
    },
    clarity,
  )!;
  if (clarity === 'exact')
    text = omenTexts.exact.replace('{onda}', omenTexts.waves[wave.number]).replace(
      '{composicao}',
      wave.composition
        .map((post) =>
          omenTexts.post
            .replace('{contagem}', String(post.count))
            .replace(
              '{inimigo}',
              post.count === 1
                ? hordeUnits[post.unit].label.toLowerCase()
                : hordeUnits[post.unit].pluralLabel,
            )
            .replace('{linha}', omenTexts.lines[post.line])
            .replace('{ala}', omenTexts.wings[post.wing]),
        )
        .join('; '),
    );
  const step = balance.omens.roundTo;
  draft.horde.omens.push({
    atMs,
    revision: plan.revision,
    clarity,
    wave: wave.number,
    text,
    reveals:
      clarity === 'exact'
        ? wave.composition.map((p) => ({ ...p }))
        : clarity === 'partial'
          ? [{ ...main, count: Math.max(step, Math.round(main.count / step) * step) }]
          : [],
  });
  draft.horde.omens = draft.horde.omens.slice(-balance.omens.kept);
  draft.stats.omens = (draft.stats.omens ?? 0) + 1;
  emit(
    events,
    draft,
    atMs,
    'omenSeen',
    clarity === 'vague' ? { clarity } : { clarity, wave: wave.number },
    { pressagio: text },
  );
}

/** Efeitos de guerra e forja: todos passam pelas portas existentes, sem sorteio. */
export function applyCouncilWarEffect(
  draft: GameState,
  effect: CouncilEffect,
  _card: CouncilCard,
  instanceId: string,
  atMs: number,
  events: GameEvent[],
): void {
  switch (effect.type) {
    case 'smithySpeed':
      draft.council.bonuses.smithySpeed = {
        factor: { ...effect.factor },
        untilMs: atMs + effect.durationDays * DAY_MS,
      };
      break;
    case 'smithyBatch':
      draft.council.bonuses.smithyBatch = {
        extra: effect.extra,
        untilMs: atMs + effect.durationDays * DAY_MS,
      };
      break;
    case 'addWeapons':
      draft.settlement.weapons += effect.amount;
      break;
    case 'addItem':
      stowItem(
        draft,
        {
          id: nextId(draft, 'item'),
          defId: effect.itemId,
          condition: itemRarities[items[effect.itemId].rarity].durability,
        },
        atMs,
        events,
      );
      break;
    case 'trainBoost':
      if (draft.army.training !== null)
        draft.army.training.endsAtMs =
          atMs +
          Math.ceil(
            (Math.max(0, draft.army.training.endsAtMs - atMs) * effect.factor.num) /
              effect.factor.den,
          );
      break;
    case 'startBuilding':
      startConstruction(
        draft,
        effect.building,
        atMs,
        events,
        'order',
        remainingFactor(effect.discount),
      );
      break;
    case 'omen':
      grantOmen(draft, effect, atMs, events);
      break;
    case 'threat':
      draft.map.threat = Math.max(0, Math.min(balance.threat.max, draft.map.threat + effect.delta));
      break;
    case 'scheduleRaid': {
      const raidAt = atMs + effect.afterMs;
      draft.horde.scheduledRaids.push({
        id: `card:${instanceId}`,
        atMs: raidAt,
        kind: 'scripted',
        enemy: 'raiders',
        size: 'light',
        announcedAtMs: null,
        composition: baseRaidComposition('light', 'summer').map((post) => ({ ...post })),
      });
      draft.horde.scheduledRaids.sort((a, b) => a.atMs - b.atMs);
      break;
    }
    case 'repairWall':
      repairWall(draft, atMs, events, remainingFactor(effect.discount));
      break;
    case 'healWall': {
      const full = wallHpPerWing(draft.settlement.buildings.palisade);
      const wing = WING_IDS.reduce((best, w) =>
        draft.settlement.wall.hp[w] < draft.settlement.wall.hp[best] ? w : best,
      );
      draft.settlement.wall.hp[wing] = Math.min(
        full,
        draft.settlement.wall.hp[wing] +
          Math.floor((full * effect.fraction.num) / effect.fraction.den),
      );
      break;
    }
    case 'revealRaid':
      draft.council.bonuses.revealedRaidId = sightedRaid(draft)?.id ?? null;
      break;
    case 'repairDiscount':
      if (inAftermath(draft))
        draft.council.bonuses.repairDiscount = {
          points: effect.points,
          untilMs: draft.siege!.aftermathUntilMs!,
        };
      break;
    case 'militiaReady':
      callMilitia(
        draft,
        Math.min(
          ableVillagers(draft),
          Math.floor(
            (draft.settlement.population.villagers * balance.army.militia.maxShare.num) /
              balance.army.militia.maxShare.den,
          ),
        ),
        atMs,
        events,
        true,
      );
      break;
  }
}
