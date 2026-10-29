import {
  balance,
  battleOutcomeLabels,
  campaignTexts,
  tileTypes,
  WING_IDS,
  type ResourceId,
  type UnitId,
} from '@lotg/content';

import { applyBattleOutcome } from './battleOutcome';
import { buildBattleReport } from './battleReport';
import { fightBattle } from './battleTurn';
import { seasonAt } from './clock';
import { amountsData } from './construction';
import { clearThreatTile } from './outcomes';
import { buildDefender, toHordePosts } from './raidArmy';
import { storeResource } from './storage';
import { MILLI } from './units';
import { chargeReturned } from './wages';
import { troopText } from './army';
import { emit } from './chronicle';
import { releaseExcessWorkers } from './population';
import type { GameEvent, GameState } from './types';

/**
 * O fim do treino (V4C-T1; ADR 0019, decisão 7). Resolvido junto das obras e dos recrutas que
 * chegam, antes dos Mestres à porta (`processEventsAt`): o soldado sai de um aldeão sem ofício
 * e, se todos trabalham, do edifício com mais gente (`releaseExcessWorkers`, a regra da
 * deserção). **Nada aqui sorteia.** O soldado continua morando nas casas, e por isso a vaga
 * habitacional não muda.
 *
 * O piso de `populationFloor` aldeões protege o feudo: se a população caiu depois da ordem
 * (deserção, partida) e já não sobram aldeões para todos, o lote termina com os que couberem, e
 * os outros ficam por treinar (o custo não volta).
 */
export function finishTraining(draft: GameState, atMs: number, events: GameEvent[]): void {
  const batch = draft.army.training;
  if (batch === null || batch.endsAtMs > atMs) {
    return;
  }
  draft.army.training = null;
  const { settlement } = draft;
  const spare = Math.max(0, settlement.population.villagers - balance.morale.populationFloor);
  const trained = Math.min(batch.amount, spare);
  const lost = batch.amount - trained;
  if (trained > 0) {
    settlement.population.villagers -= trained;
    draft.army.units[batch.unit] += trained;
    releaseExcessWorkers(draft);
    emit(
      events,
      draft,
      atMs,
      'soldiersTrained',
      {
        unit: batch.unit,
        amount: trained,
        lost,
        soldiers: draft.army.units[batch.unit],
        villagers: settlement.population.villagers,
      },
      { tropa: troopText(batch.unit, trained) },
    );
  }
  // A Crônica sempre diz o que o piso de aldeões tirou do lote (C-3: o custo não volta).
  if (lost > 0) {
    emit(
      events,
      draft,
      atMs,
      'trainingShortfall',
      { unit: batch.unit, ordered: batch.amount, amount: trained, lost },
      { tropa: troopText(batch.unit, lost) },
    );
  }
}

/**
 * Soldados que uma carta do Conselho entrega já treinados (V4H-T1): saem dos aldeões acima do
 * piso, como no fim do treino, e entram no Exército sem fila. Devolve quantos entraram; a opção
 * que os dá é trancada sem vaga (`requires.soldierRoom`), então aqui só se protege o piso.
 * Nada aqui sorteia, e a Crônica da carta é quem conta o que aconteceu.
 */
export function grantSoldiers(draft: GameState, unit: UnitId, amount: number): number {
  const { settlement } = draft;
  const spare = Math.max(0, settlement.population.villagers - balance.morale.populationFloor);
  const trained = Math.min(amount, spare);
  if (trained > 0) {
    settlement.population.villagers -= trained;
    draft.army.units[unit] += trained;
    releaseExcessWorkers(draft);
  }
  return trained;
}

/** Chegada e retorno depois das expedições: a incursão no mesmo instante ainda vê a reserva fora. */
export function settleCampaign(draft: GameState, atMs: number, events: GameEvent[]): void {
  const campaign = draft.army.campaign;
  if (campaign === null) return;
  const rules = balance.army.campaign;
  if (campaign.report === null && campaign.battleAtMs <= atMs) {
    const player = buildDefender(campaign.formation, draft.army.units, (heroId) => {
      const hero = draft.guild.heroes.find((entry) => entry.id === heroId);
      return hero?.status === 'campaign' ? hero.classId : null;
    });
    const { id, resolution } = fightBattle(draft, {
      mode: 'attack',
      player,
      horde: { posts: toHordePosts(rules.campGarrison[seasonAt(atMs).id]) },
      wall: Object.fromEntries(WING_IDS.map((wing) => [wing, rules.campWall])),
      watchtowerLevel: 0,
      heroCapture: balance.difficulties[draft.settings.difficulty].heroCapture,
    });
    const report = buildBattleReport(id, atMs, resolution, campaign.formationId);
    campaign.report = report;
    applyBattleOutcome(draft, report, atMs, events);
    draft.army.reports = [...draft.army.reports, report].slice(-balance.army.reportsKept);
    emit(
      events,
      draft,
      atMs,
      'campAssaulted',
      {
        battleId: id,
        formationId: campaign.formationId,
        tileId: campaign.tile,
        outcome: report.outcome,
      },
      { desfecho: battleOutcomeLabels[report.outcome] },
    );
    if (report.outcome === 'victory') {
      clearThreatTile(
        draft,
        campaign.tile,
        campaignTexts.label,
        { battleId: id },
        atMs,
        events,
        campaignTexts.tileCleared,
      );
    }
  }
  if (campaign.report === null || campaign.returnsAtMs > atMs) return;
  const report = campaign.report;
  let lost = 0;
  for (const casualty of report.casualties) {
    if (casualty.owner !== 'player') continue;
    const unit = casualty.unit as UnitId;
    draft.army.units[unit] -= casualty.lost;
    lost += casualty.lost;
  }
  for (const heroId of Object.values(campaign.formation.commanders)) {
    const hero = draft.guild.heroes.find((entry) => entry.id === heroId);
    if (hero?.status === 'campaign') hero.status = hero.injury === null ? 'idle' : 'injured';
  }
  const gained: Record<string, number> = {};
  const wasted: Record<string, number> = {};
  if (report.outcome === 'victory') {
    for (const [resource, amount] of Object.entries(rules.loot)) {
      const milli = amount * MILLI;
      const stored = storeResource(draft, resource as ResourceId, milli);
      gained[resource] = stored / MILLI;
      if (stored < milli) wasted[resource] = (milli - stored) / MILLI;
    }
  }
  draft.army.campaign = null;
  emit(
    events,
    draft,
    atMs,
    'armyReturned',
    {
      formationId: campaign.formationId,
      tileId: campaign.tile,
      battleId: report.id,
      lost,
      ...amountsData('gained', gained),
      ...amountsData('lost', wasted),
    },
    {
      retorno: report.outcome === 'victory' ? campaignTexts.loot : campaignTexts.noLoot,
      lugar: tileTypes.raiderCamp.label,
    },
  );
  // Como a escolta e a expedição: quem voltou entrega o saque e paga o atraso já vencido.
  chargeReturned(
    draft,
    Object.values(campaign.formation.commanders).filter((id): id is string => id !== null),
    atMs,
    events,
  );
}
