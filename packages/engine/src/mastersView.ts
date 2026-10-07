import {
  buildings,
  masters as masterDefs,
  masterTexts,
  PRODUCTION_BUILDING_IDS,
} from '@lotg/content';

import { handsOf } from './craft';
import { producedBy, productionRate } from './economy';
import { decimal, durationText, fillText, joinList } from './format';
import { masterAdaptingAt, masterBonusPercent, masterLabel, masterOf } from './masters';
import type {
  GameState,
  Master,
  MasterOptionView,
  MasterView,
  ProductionBuildingId,
  ViewState,
} from './types';
import { MILLI, realSecondsCeil } from './units';

/**
 * Os Mestres na visão (GDD §5.4; ADR 0018, decisão 18). Nada aqui sorteia nem muda o estado: são
 * contas sobre o que o feudo tem agora, em tempo real.
 */

/** Segundos reais até o Mestre terminar a adaptação; `null` fora dela. */
function adaptationEndsIn(state: GameState, master: Master, timeScale: number): number | null {
  const now = state.lastProcessedAt;
  return master.adaptingUntilMs !== null && masterAdaptingAt(master, now)
    ? realSecondsCeil(master.adaptingUntilMs - now, timeScale)
    : null;
}

/**
 * O que mudaria se `master` fosse para `building`: quanto o edifício rende a mais por hora real
 * com ele, contra o mesmo edifício sem ele, depois da adaptação (o braço e o bônus) e durante
 * ela (só a fração do braço). É a mesma conta da produção, com outros braços. No edifício em
 * que ele já rende inteiro não há adaptação a pagar: os dois números são o de agora.
 */
function optionView(
  state: GameState,
  master: Master,
  building: ProductionBuildingId,
  timeScale: number,
): MasterOptionView {
  const current = master.building === building;
  const settled = current && !masterAdaptingAt(master, state.lastProcessedAt);
  const holder = masterOf(state, building);
  const hands = handsOf(state, building);
  // O edifício sem este Mestre: os aldeões do ofício, como estão.
  const without = current
    ? {
        adapted: hands.adapted - (settled ? 1 : 0),
        adapting: hands.adapting - (settled ? 0 : 1),
        master: false,
      }
    : { adapted: hands.adapted, adapting: hands.adapting, master: false };
  const base = productionRate(state, building, without);
  const after = productionRate(state, building, {
    adapted: without.adapted + 1,
    adapting: without.adapting,
    master: true,
  });
  const during = settled
    ? after
    : productionRate(state, building, {
        adapted: without.adapted,
        adapting: without.adapting + 1,
        master: false,
      });
  let blockedReason: string | null = null;
  if (state.settlement.buildings[building] <= 0) {
    blockedReason = masterTexts.notBuilt;
  } else if (holder !== null && holder.id !== master.id) {
    blockedReason = fillText(masterTexts.buildingTaken, { mestre: masterLabel(holder.masterId) });
  }
  return {
    building,
    label: buildings[building].label,
    level: state.settlement.buildings[building],
    resource: producedBy(building),
    current,
    gainPerHour: ((after - base) * timeScale) / MILLI,
    gainWhileAdaptingPerHour: ((during - base) * timeScale) / MILLI,
    blockedReason,
  };
}

/** Os Mestres do feudo, na ordem em que entraram, cada um com o que mudaria em cada edifício. */
export function mastersView(state: GameState, timeScale: number): MasterView[] {
  const now = state.lastProcessedAt;
  return state.settlement.masters.map((master) => ({
    id: master.id,
    name: masterLabel(master.masterId),
    originText: masterDefs[master.masterId].originText,
    building: master.building,
    buildingLabel: master.building === null ? masterTexts.free : buildings[master.building].label,
    adaptationEndsInSeconds: adaptationEndsIn(state, master, timeScale),
    bonusPercent: masterBonusPercent(),
    bonusActive: master.building !== null && !masterAdaptingAt(master, now),
    options: PRODUCTION_BUILDING_IDS.map((building) =>
      optionView(state, master, building, timeScale),
    ),
  }));
}

/** Quem espera à porta, e por quê. */
export function mastersWaitingView(state: GameState): ViewState['mastersWaiting'] {
  const names = state.settlement.mastersWaiting.map((master) => masterLabel(master.masterId));
  return {
    count: names.length,
    names,
    note:
      names.length === 0
        ? null
        : fillText(names.length === 1 ? masterTexts.waitingOne : masterTexts.waitingMany, {
            mestres: joinList(names),
          }),
  };
}

/** O Mestre de um edifício na linha dos trabalhadores: quem é e o que soma agora. */
export function workerMasterView(
  state: GameState,
  building: ProductionBuildingId,
  timeScale: number,
): ViewState['workers'][number]['master'] {
  const master = masterOf(state, building);
  if (master === null) {
    return null;
  }
  const endsIn = adaptationEndsIn(state, master, timeScale);
  return {
    id: master.id,
    name: masterLabel(master.masterId),
    adapting: endsIn !== null,
    bonusText:
      endsIn === null
        ? fillText(masterTexts.working, { bonus: decimal(masterBonusPercent()) })
        : fillText(masterTexts.adapting, { prazo: durationText(endsIn) }),
  };
}
