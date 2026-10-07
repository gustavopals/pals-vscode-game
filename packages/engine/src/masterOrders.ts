import { balance, buildings, masterTemplates } from '@lotg/content';

import { emit } from './chronicle';
import { buildingWithArticle } from './construction';
import { sentenceCase } from './format';
import { masterLabel, masterOf } from './masters';
import { isProductionBuilding } from './population';
import { reject } from './rejections';
import type { GameEvent, GameState, Rejection } from './types';

/**
 * A ordem dos Mestres (GDD §5.4; ADR 0018, decisão 18): `assignMaster` põe um Mestre em um
 * edifício produtivo, ou o deixa sem edifício (`building: null`). Não sorteia e não cria
 * entidade. As recusas, na ordem:
 *
 * 1. o Mestre que não está no feudo (`MASTER_NOT_FOUND`), ou que ainda espera à porta
 *    (`MASTER_WAITING`);
 * 2. o que não é um edifício produtivo, ou é um que ainda não foi erguido
 *    (`NOT_A_PRODUCTION_BUILDING`, com a frase de cada caso);
 * 3. o edifício que já tem outro Mestre (`BUILDING_HAS_MASTER`): o bônus não soma.
 *
 * **A primeira alocação é imediata** (resposta do autor de 2026-10-07): o Mestre que nunca
 * trabalhou em edifício nenhum (`worked: false`) rende inteiro e com o bônus no instante da
 * ordem. **Daí em diante, chegar a um edifício custa a adaptação**, venha ele de outro edifício
 * ou de edifício nenhum: por `balance.masters.adaptationMs` de jogo ele rende como quem acabou
 * de chegar e não dá o bônus. Quem já teve um edifício e ficou livre também paga ao voltar a
 * trabalhar (decisão desta correção, a registrar): sem isso a troca sairia de graça por uma
 * ordem intermediária que o deixasse livre. **Pedir o que já vale não muda nada**: a ordem
 * é aceita, sem evento, e a adaptação em curso não recomeça.
 */
export function assignMaster(
  draft: GameState,
  masterId: unknown,
  building: unknown,
  nowMs: number,
  events: GameEvent[],
): Rejection | null {
  const { settlement } = draft;
  const master = settlement.masters.find((entry) => entry.id === masterId);
  if (master === undefined) {
    const waiting = settlement.mastersWaiting.find((entry) => entry.id === masterId);
    return waiting === undefined
      ? reject('MASTER_NOT_FOUND')
      : reject('MASTER_WAITING', { label: masterLabel(waiting.masterId) });
  }
  const label = masterLabel(master.masterId);
  if (building === null || building === undefined) {
    if (master.building === null) {
      return null;
    }
    const left = master.building;
    master.building = null;
    master.adaptingUntilMs = null;
    emit(
      events,
      draft,
      nowMs,
      'masterAssigned',
      { masterId: master.id, masterDefId: master.masterId, from: left },
      { mestre: label },
      masterTemplates.released,
    );
    return null;
  }
  if (!isProductionBuilding(building)) {
    return reject('NOT_A_PRODUCTION_BUILDING');
  }
  if (settlement.buildings[building] <= 0) {
    return reject('NOT_A_PRODUCTION_BUILDING', { label: buildings[building].label });
  }
  if (master.building === building) {
    return null;
  }
  const holder = masterOf(draft, building);
  if (holder !== null) {
    return reject('BUILDING_HAS_MASTER', {
      label: sentenceCase(buildingWithArticle(building)),
      remedy: masterLabel(holder.masterId),
    });
  }
  const from = master.building;
  master.building = building;
  // A primeira alocação é imediata; quem já teve um edifício se adapta ao chegar a outro.
  master.adaptingUntilMs = master.worked ? nowMs + balance.masters.adaptationMs : null;
  master.worked = true;
  emit(
    events,
    draft,
    nowMs,
    'masterAssigned',
    {
      masterId: master.id,
      masterDefId: master.masterId,
      building,
      ...(from === null ? {} : { from }),
    },
    { mestre: label, edificio: buildingWithArticle(building) },
  );
  return null;
}
