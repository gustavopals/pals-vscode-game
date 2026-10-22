import { balance, buildings, UNIT_IDS, units } from '@lotg/content';

import {
  armyCap,
  barracksLevel,
  soldierCount,
  soldierFoodRate,
  trainingDurationMs,
  trainingRefund,
  troopText,
} from './army';
import { trainingBlock } from './armyOrders';
import { decimal, fillText, plural } from './format';
import { formationEditorView, formationViews } from './formationsView';
import type { ArmyView, BuildingId, GameState } from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * O Quartel e o exército na visão (GDD §6.1 e §10.2; ADR 0019, decisão 7). Só lê o estado: não
 * sorteia, não dá identificador e não anda o tempo. Os prazos saem em tempo real, no ritmo
 * `timeScale`; os atributos e as frases vêm do conteúdo, prontos.
 */

const { army: rules } = balance;
const food = balance.resources.food.label.toLowerCase();

/** "Vence o Cavaleiro." ou a frase do Escudeiro. */
function countersText(unit: keyof typeof units): string {
  const beaten = units[unit].counters;
  return beaten === null
    ? 'Sem vantagem nem fraqueza; protege a retaguarda.'
    : fillText('Vence {unidade}.', {
        unidade: `${buildings.barracks.article === 'o' ? 'o ' : ''}${units[beaten].label}`,
      });
}

/** Percentual do tempo do nível 1 que o treino leva no nível dado. */
function trainingPercent(level: number): number {
  const { num, den } = rules.trainingSpeedPerLevel;
  return Math.round((100 * den) / (den + Math.max(0, level - 1) * num));
}

/**
 * O que a obra do Quartel muda, para ficar ao lado do custo. No nível 1: o que ele passa a
 * fazer; nos seguintes: o limite e quanto do tempo de treino sobra. `null` para os outros.
 */
export function armyEffect(building: BuildingId, targetLevel: number): string | null {
  if (building !== 'barracks') {
    return null;
  }
  const cap = rules.capPerLevel * targetLevel;
  if (targetLevel <= 1) {
    return `Treina soldados, um lote de até ${rules.batchMax} por vez: até ${cap} soldados, que comem ${decimal(rules.foodPerSoldierPerHour.num / rules.foodPerSoldierPerHour.den)} de ${food} por hora.`;
  }
  return `Cabem ${cap} soldados; cada um leva ${trainingPercent(targetLevel)}% do tempo do nível 1 para treinar.`;
}

function armyText(state: GameState): string {
  const level = barracksLevel(state);
  const { label, requires } = buildings.barracks;
  if (level > 0) {
    return `${label} Nv${level}: até ${armyCap(state)} soldados; cada um leva ${trainingPercent(level)}% do tempo do nível 1 para treinar.`;
  }
  const townHall = requires.townHall;
  return townHall !== undefined && state.settlement.buildings.townHall < townHall
    ? `O Quartel abre com o Salão Nv${townHall}: treina soldados, que saem da população.`
    : 'Erga o Quartel: treina soldados, que saem da população.';
}

/** "O custo: 30 de comida, 10 de ouro e 5 de madeira" sem o prefixo, e as armas ao fim. */
function costText(unit: keyof typeof units): string {
  const def = units[unit];
  const parts = Object.entries(def.cost).map(
    ([resource, amount]) =>
      `${amount} de ${balance.resources[resource as 'food'].label.toLowerCase()}`,
  );
  if (def.weapons > 0) {
    parts.push(plural(def.weapons, 'arma', 'armas'));
  }
  return parts.join(', ');
}

/** O maior lote que `trainingBlock` aceita agora, de 0 a `batchMax`. */
function maxAmount(state: GameState, unit: keyof typeof units): number {
  let best = 0;
  for (let amount = 1; amount <= rules.batchMax; amount += 1) {
    if (trainingBlock(state, unit, amount) !== null) {
      break;
    }
    best = amount;
  }
  return best;
}

export function armyView(state: GameState, timeScale: number): ArmyView {
  const level = barracksLevel(state);
  const { training } = state.army;
  const total = soldierCount(state);
  const perSoldier = rules.foodPerSoldierPerHour;
  return {
    building: 'barracks',
    built: level > 0,
    level,
    text: armyText(state),
    total,
    cap: armyCap(state),
    foodText: `${decimal((soldierFoodRate(state) * timeScale) / MILLI)}/h (${plural(total, 'soldado', 'soldados')})`,
    units: UNIT_IDS.map((id) => {
      const def = units[id];
      return {
        id,
        label: def.label,
        count: state.army.units[id],
        line: def.line,
        attack: def.attack,
        defense: def.defense,
        health: def.health,
        initiative: def.initiative,
        counters: countersText(id),
        costText: costText(id),
        secondsEach: level > 0 ? realSecondsCeil(trainingDurationMs(level, id, 1), timeScale) : 0,
        foodPerHour: `${decimal((perSoldier.num / perSoldier.den) * timeScale)}/h`,
      };
    }),
    training:
      training === null
        ? null
        : {
            unit: training.unit,
            unitLabel: units[training.unit].label,
            amount: training.amount,
            label: troopText(training.unit, training.amount),
            endsInSeconds: realSecondsCeil(training.endsAtMs - state.lastProcessedAt, timeScale),
            totalSeconds: realSecondsCeil(training.endsAtMs - training.startedAtMs, timeScale),
            cancelRefundText: refundText(training.unit, training.amount),
          },
    offer: UNIT_IDS.map((id) => ({
      unit: id,
      maxAmount: maxAmount(state, id),
      batchMax: rules.batchMax,
      blockedReason: trainingBlock(state, id, 1)?.message ?? null,
    })),
    formations: formationViews(state),
    editor: formationEditorView(state),
  };
}

/** "Cancelar devolve 80% dos recursos e as armas inteiras que couberem: 1 arma.". */
function refundText(unit: keyof typeof units, amount: number): string {
  const { cancelRefund } = balance.construction;
  const percent = Math.round((100 * cancelRefund.num) / cancelRefund.den);
  const back = trainingRefund(unit, amount);
  return back.weapons > 0
    ? `Cancelar devolve ${percent}% dos recursos e ${plural(back.weapons, 'arma', 'armas')}.`
    : `Cancelar devolve ${percent}% dos recursos.`;
}
