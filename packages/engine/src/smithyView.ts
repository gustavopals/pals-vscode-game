import { balance, buildings, equipmentTexts, itemRarities } from '@lotg/content';

import { missingResources } from './construction';
import { decimal, fillText, plural } from './format';
import { durabilityOf, isAtHome, itemDefOf } from './heroes';
import { storageCapacity } from './storage';
import {
  smithySpeedFactor,
  smithyBatchExtra,
  forgeCost,
  forgeDurationMs,
  forgeRefundMilli,
  repairDurationMs,
  repairIronCost,
  repairPoints,
  smithyLevel,
  weaponsText,
} from './smithy';
import type { BuildingId, GameState, Item, RepairItemView, SmithyView } from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * O Ferreiro na visão (GDD §6.1; ADR 0019, decisão 4). Só lê o estado: não sorteia, não dá
 * identificador e não anda o tempo. Os prazos saem em tempo real, no ritmo `timeScale`.
 */

const { smithy: rules } = balance;
const iron = balance.resources.iron.label.toLowerCase();
const wood = balance.resources.wood.label.toLowerCase();

/** "2 de ferro e 1 de madeira por arma". */
const costPerWeaponText = `${rules.recipe.iron} de ${iron} e ${rules.recipe.wood} de ${wood} por arma`;

/**
 * O que a obra do Ferreiro muda, para ficar ao lado do custo. No nível 1: o que ele passa a
 * fazer; nos seguintes: quanto do tempo de uma arma sobra. `null` para os outros edifícios.
 */
export function smithyEffect(building: BuildingId, targetLevel: number): string | null {
  if (building !== 'smithy') {
    return null;
  }
  if (targetLevel <= 1) {
    return `Forja armas: ${costPerWeaponText}, em lotes de até ${rules.batchMax}, um lote por vez.`;
  }
  const { num, den } = rules.speedPerLevel;
  const percent = Math.round((100 * den) / (den + (targetLevel - 1) * num));
  return `Cada arma leva ${percent}% do tempo do nível 1 para forjar.`;
}

/** O que o Ferreiro é agora: o que o nível dá ou, sem ele, o que o abre. */
function smithyText(state: GameState): string {
  const level = smithyLevel(state);
  const { label, requires } = buildings.smithy;
  if (level > 0) {
    const speed = smithySpeedFactor(state);
    const extra = smithyBatchExtra(state, 1);
    const bonus = [speed.num === speed.den ? '' : `× ${decimal(speed.num / speed.den)} (a filha do ferreiro)`, extra === 0 ? '' : `+${extra} arma por lote, até ${rules.batchMax}`].filter(Boolean).join('; ');
    return `${label} Nv${level}: ${costPerWeaponText}, em lotes de até ${rules.batchMax}.${bonus === '' ? '' : ` ${bonus}.`}`;
  }
  const townHall = requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? `O Ferreiro abre com o Salão Nv${townHall}: forja armas com ${iron} e ${wood}.`
    : `Erga o Ferreiro: forja armas com ${iron} e ${wood}.`;
}

/** O maior lote que o estoque paga agora (0 se há um lote na forja ou não há Ferreiro). */
function maxAmount(state: GameState): number {
  if (smithyLevel(state) === 0 || state.settlement.forge !== null) {
    return 0;
  }
  let best = 0;
  for (let amount = 1; amount <= rules.batchMax; amount += 1) {
    if (missingResources(state, forgeCost(amount)) !== null) {
      break;
    }
    best = amount;
  }
  return best;
}

/**
 * Os itens que o Ferreiro pode refazer: todo item gasto ou usado, no arsenal ou com um herói,
 * na ordem do arsenal e depois a dos heróis. `canRepair` diz se a ordem seria aceita agora; o
 * motivo da recusa, na frase da tela, vem em `blockedReason`.
 */
function repairOffer(state: GameState, timeScale: number): SmithyView['repairOffer'] {
  const level = smithyLevel(state);
  const busy = state.settlement.forge !== null;
  const entries: Array<{ item: Item; heroName: string | null; away: boolean }> = [
    ...state.guild.inventory.map((item) => ({ item, heroName: null, away: false })),
    ...state.guild.heroes.flatMap((hero) =>
      Object.values(hero.equipment).flatMap((item) =>
        item === null ? [] : [{ item, heroName: hero.name, away: !isAtHome(hero) }],
      ),
    ),
  ];
  const items: RepairItemView[] = [];
  for (const { item, heroName, away } of entries) {
    const def = itemDefOf(item);
    const points = repairPoints(item);
    if (def === null || points === 0) {
      continue;
    }
    const ironCost = repairIronCost(item, points);
    const missing = ironCost - Math.floor(state.settlement.resources.iron / MILLI);
    let blockedReason: string | null = null;
    if (level === 0) {
      blockedReason = equipmentTexts.repairNoSmithy;
    } else if (busy) {
      blockedReason = equipmentTexts.repairBusy;
    } else if (heroName !== null) {
      // Quem está fora do feudo não devolve o item ao arsenal até voltar: `unequipItem` recusa com
      // `HERO_BUSY` (revisão do reparo, achado 2).
      blockedReason = fillText(away ? equipmentTexts.repairAway : equipmentTexts.repairCarried, {
        item: def.label,
        heroi: heroName,
      });
    } else if (missing > 0) {
      blockedReason = fillText(equipmentTexts.repairNoIron, {
        faltam: missing,
        item: def.label,
      });
    }
    items.push({
      itemId: item.id,
      label: def.label,
      rarityLabel: itemRarities[def.rarity].label,
      condition: item.condition,
      durability: durabilityOf(item),
      points,
      ironCost,
      costText: `${ironCost} de ${iron}`,
      seconds: realSecondsCeil(repairDurationMs(points), timeScale),
      heroName,
      canRepair: blockedReason === null,
      blockedReason,
    });
  }
  return { items };
}

/** "20 de ferro e 10 de madeira": o custo de um lote de `amount` armas. */
function batchCostText(amount: number): string {
  const cost = forgeCost(amount);
  return `${cost.iron ?? 0} de ${iron} e ${cost.wood ?? 0} de ${wood}`;
}

/** A parte do custo que o cancelamento devolve, em por cento. */
function refundPercent(): number {
  const { num, den } = balance.construction.cancelRefund;
  return Math.round((100 * num) / den);
}

/**
 * "Cancelar devolve 80%: 1,6 de ferro e 0,8 de madeira.": o que o cancelamento devolve ao lote,
 * com a fração que o motor devolve em milésimos e, se o depósito não guarda tudo, o que iria ao
 * chão (revisão da Fase B da v0.4, achado 3; como `constructions.active.refund[].lost`).
 */
function refundText(state: GameState, amount: number): string {
  const refund = forgeRefundMilli(amount);
  const lost = (resource: 'iron' | 'wood'): number => {
    const cap = storageCapacity(state, resource);
    if (cap === null) {
      return 0;
    }
    const room = Math.max(0, cap - state.settlement.resources[resource]);
    return Math.max(0, refund[resource] - room);
  };
  const lostIron = lost('iron');
  const lostWood = lost('wood');
  const back = `Cancelar devolve ${refundPercent()}%: ${decimal(refund.iron / MILLI)} de ${iron} e ${decimal(refund.wood / MILLI)} de ${wood}.`;
  const floor = [
    ...(lostIron > 0 ? [`${decimal(lostIron / MILLI)} de ${iron}`] : []),
    ...(lostWood > 0 ? [`${decimal(lostWood / MILLI)} de ${wood}`] : []),
  ];
  return floor.length === 0
    ? back
    : `${back} O depósito não guarda tudo: ${floor.join(' e ')} iria ao chão.`;
}

export function smithyView(state: GameState, timeScale: number): SmithyView {
  const { settlement } = state;
  const level = smithyLevel(state);
  const forge = settlement.forge;
  return {
    building: 'smithy',
    built: level > 0,
    level,
    text: smithyText(state),
    weapons: settlement.weapons,
    weaponsLabel: rules.weaponsLabel,
    forge:
      forge === null
        ? null
        : {
            kind: forge.kind,
            amount: forge.kind === 'weapons' ? forge.amount + (forge.extra ?? 0) : forge.points,
            label:
              forge.kind === 'weapons'
                ? fillText(equipmentTexts.forgeWeapons, { armas: weaponsText(forge.amount + (forge.extra ?? 0)) })
                : fillText(equipmentTexts.forgeRepair, {
                    item: itemDefOf(forge.item)?.label ?? 'um item',
                    pontos: plural(forge.points, 'ponto', 'pontos'),
                  }),
            endsInSeconds: realSecondsCeil(forge.endsAtMs - state.lastProcessedAt, timeScale),
            totalSeconds: realSecondsCeil(forge.endsAtMs - forge.startedAtMs, timeScale),
            cancelable: forge.kind === 'weapons',
            refundText:
              forge.kind === 'weapons'
                ? refundText(state, forge.amount)
                : 'Um reparo não se cancela: espere o item voltar.',
            cancelLabel: forge.kind === 'weapons' ? `Cancelar (devolve ${refundPercent()}%)` : '',
          },
    repairOffer: repairOffer(state, timeScale),
    perWeaponSeconds: level > 0 ? realSecondsCeil(forgeDurationMs(level, 1, smithySpeedFactor(state)), timeScale) : 0,
    offer: {
      maxAmount: maxAmount(state),
      options: Array.from({ length: rules.batchMax }, (_, index) => {
        const amount = index + 1;
        return {
          amount,
          costText: `${batchCostText(amount)}${smithyBatchExtra(state, amount) === 0 ? '' : `; rende ${amount + smithyBatchExtra(state, amount)} armas`}`,
          seconds: level > 0 ? realSecondsCeil(forgeDurationMs(level, amount, smithySpeedFactor(state)), timeScale) : 0,
          affordable: missingResources(state, forgeCost(amount)) === null,
        };
      }),
      batchMax: rules.batchMax,
      costText: costPerWeaponText,
      batchSeconds:
        level > 0 ? realSecondsCeil(forgeDurationMs(level, rules.batchMax, smithySpeedFactor(state)), timeScale) : 0,
      blockedReason:
        level > 0 && settlement.forge === null && maxAmount(state) === 0
          ? `O estoque não paga nem uma arma: ela pede ${costPerWeaponText.replace(' por arma', '')}.`
          : null,
    },
  };
}
