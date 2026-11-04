import type { Command, EngineViewState as ViewState } from '@lotg/engine';

import { firewoodReserve, hasBuildingPlan, keepsFirewood, treinarSoldados } from './policies';
import type { Act, Policy } from './types';

type UnitId = ViewState['army']['units'][number]['id'];
type Wave = 1 | 2 | 3;
type Formation = ViewState['army']['formations'][number];
type Posts = Extract<Command, { type: 'saveFormation' }>['payload']['posts'];
const WINGS = ['left', 'center', 'right'] as const;
const NAMES = ['Defesa do bot', 'Defesa do bot B'];
const FOOD_HOURS = 6;
const MIN_WINS = 50;

/** O calendário é público; o rescaldo já não pede investimento militar naquele ano. */
export function preparingSiege(view: ViewState): boolean {
  return (
    (view.calendar.season === 'autumn' || view.calendar.season === 'winter') &&
    (view.siege === null || view.siege.result === null)
  );
}

/**
 * No outono a defesa passa à frente da corrida econômica. Planejar inclui seus custos na
 * demanda dos ofícios; não automatiza madeira reservada à lareira. Os níveis e bloqueios
 * vêm da lista pública: nenhuma obra ou custo do motor é reproduzido aqui.
 */
export const prepareSiege: Policy = {
  name: 'preparar o Cerco',
  run: async (view, act) => {
    if (!preparingSiege(view) || view.famine !== null) return view;
    let current = view;
    const priorities = ['barracks', 'watchtower', 'palisade'] as const;
    const upgrades = priorities.flatMap((building) => {
      const upgrade = view.constructions.available.find((row) => row.building === building);
      return upgrade === undefined ? [] : [upgrade];
    });
    // Primeiro a infraestrutura mínima; depois, cada melhoria que o estoque puder pagar.
    upgrades.sort(
      (a, b) =>
        Number(b.fromLevel < 3) - Number(a.fromLevel < 3) ||
        a.fromLevel - b.fromLevel ||
        priorities.indexOf(a.building as (typeof priorities)[number]) -
          priorities.indexOf(b.building as (typeof priorities)[number]),
    );
    for (const wanted of upgrades) {
      const upgrade = current.constructions.available.find(
        (row) => row.building === wanted.building,
      );
      if (upgrade === undefined) continue;
      if (upgrade.blockedCode === null && keepsFirewood(current, upgrade)) {
        current = await act('startConstruction', { building: upgrade.building });
      } else if (
        !hasBuildingPlan(current, upgrade) &&
        ['INSUFFICIENT_RESOURCES', 'QUEUE_BUSY', 'QUEUE_LOCKED'].includes(upgrade.blockedCode ?? '')
      ) {
        current = await act('planConstruction', {
          building: upgrade.building,
          targetLevel: upgrade.targetLevel,
          autoStart: firewoodReserve(current) === 0,
        });
      }
    }
    const repair = current.threat.defense.wall.repairOffer;
    if (
      current.siege?.current === 0 &&
      repair.canRepair &&
      current.siege.nextWaveInSeconds !== null &&
      repair.seconds < current.siege.nextWaveInSeconds
    ) {
      current = await act('repairWall', {});
    }
    return current;
  },
};

/**
 * O teto é o do Quartel, sem a antiga trava de um quarto dos aldeões. A reserva de comida e
 * os braços disponíveis cobrem o consumo adicional; o lote nunca excede a oferta aceita pela visão.
 * Fora do preparo conserva exatamente o treino mínimo anterior.
 */
export function siegeTrainingPolicy(units: readonly UnitId[]): Policy {
  const minimum = treinarSoldados(units);
  return {
    name: minimum.name,
    run: async (view, act) => {
      if (!preparingSiege(view)) return minimum.run(view, act);
      const food = view.resources.find((row) => row.id === 'food');
      const eats = Number.parseFloat(view.army.units[0]?.foodPerHour.replace(',', '.') ?? '0');
      if (view.famine !== null || food === undefined || eats <= 0 || view.army.training !== null)
        return view;
      const candidates = view.army.offer
        .filter((offer) => units.includes(offer.unit) && offer.maxAmount > 0)
        .sort(
          (a, b) =>
            (view.army.units.find((row) => row.id === a.unit)?.count ?? 0) -
            (view.army.units.find((row) => row.id === b.unit)?.count ?? 0),
        );
      const pick = candidates[0];
      if (pick === undefined) return view;
      let amount = Math.min(
        pick.maxAmount,
        view.army.cap - view.army.total,
        Math.floor((food.stock - view.morale.foodReserve.needed) / (eats * FOOD_HOURS)),
      );
      const farm = view.workers.find((row) => row.resource === 'food');
      if (farm === undefined || farm.perWorkerPerHour <= 0) return view;
      const able = view.population.free + view.workers.reduce((sum, row) => sum + row.assigned, 0);
      const keepMaterials = view.workers
        .filter((row) => row.resource !== 'food')
        .reduce((sum, row) => sum + row.occupiedFrom, 0);
      const consumption = farm.grossPerHour - food.perHour;
      // Reserva lavradores para o consumo novo e para a pior retirada possível no fim do
      // treino. Os demais ofícios conservam os braços que a visão pede para ficarem ocupados.
      while (
        amount > 0 &&
        Math.ceil((consumption + amount * eats) / farm.perWorkerPerHour) + amount >
          able - keepMaterials
      )
        amount -= 1;
      return amount > 0 ? act('trainSoldiers', { unit: pick.unit, amount }) : view;
    },
  };
}

export const trainForSiege = siegeTrainingPolicy(['spearman', 'archer']);

/** Duas disposições fixas, sem buscar combinações: três alas ou uma frente livre à milícia. */
function postsFor(view: ViewState, reserve: boolean): Posts {
  const posts: Posts = {
    left: { front: null, back: null },
    center: { front: null, back: null },
    right: { front: null, back: null },
  };
  for (const line of ['front', 'back'] as const) {
    const wings = reserve && line === 'front' ? WINGS.slice(0, 2) : WINGS;
    const units = view.army.editor.units
      .filter((unit) => unit.line === line && unit.available > 0)
      .map((unit) => ({ id: unit.id, remaining: unit.available }));
    for (const [index, wing] of wings.entries()) {
      units.sort((a, b) => b.remaining - a.remaining);
      const unit = units[0];
      if (unit === undefined || unit.remaining === 0) break;
      const slots = wings.length - index;
      const kinds = units.filter((entry) => entry.remaining > 0).length;
      const count = Math.min(
        view.army.editor.postMax,
        Math.ceil(unit.remaining / Math.max(1, slots - kinds + 1)),
      );
      posts[wing][line] = { unit: unit.id, count };
      unit.remaining -= count;
    }
  }
  return posts;
}

async function saveCandidates(view: ViewState, act: Act): Promise<ViewState> {
  let current = view;
  for (const [index, name] of NAMES.entries()) {
    const posts = postsFor(current, index === 1);
    const saved = current.army.formations.find((formation) => formation.name === name);
    if (saved === undefined && !current.army.editor.canSaveNew) continue;
    const unchanged = saved?.posts.every((post) => {
      const next = posts[post.wing][post.line];
      return post.unit === (next?.unit ?? null) && post.count === (next?.count ?? 0);
    });
    if (!unchanged) {
      current = await act('saveFormation', {
        id: saved?.id ?? null,
        name,
        posts,
        commanders: { left: null, center: null, right: null },
      });
    }
  }
  return current;
}

/**
 * Prévia por onda, apenas com a informação pública. Sem presságio conhecido, uma vitória
 * contra amostra vazia não é evidência: prefere distribuir o maior efetivo disponível.
 * Não altera o Plano de ondas já enfrentadas e só repara entre ondas numa visita real.
 */
export const respondPreparedSiege: Policy = {
  name: 'responder ao cerco preparado',
  run: async (view, act) => {
    if (!preparingSiege(view) || view.siege === null || view.army.total === 0) return view;
    let current = await saveCandidates(view, act);
    const decision = current.pendingDecisions.find((entry) => entry.kind === 'siegeWave');
    if (decision !== undefined && current.threat.defense.wall.repairOffer.canRepair) {
      current = await act('emergencyRepair', {});
    }
    const waves: Wave[] = decision === undefined ? [1, 2, 3] : [decision.wave];
    for (const wave of waves) {
      if (wave <= current.siege!.current) continue;
      const candidates = current.army.formations.filter((formation) =>
        NAMES.includes(formation.name),
      );
      let best: Formation | undefined;
      let bestWins = -1;
      let bestLosses = Infinity;
      let knowledge = false;
      for (const candidate of candidates) {
        current = await act('simulateBattle', { formationId: candidate.id, siegeWave: wave });
        const preview = current.army.preview;
        const known = preview?.knownEnemy.some((post) => post.count > 0) ?? false;
        knowledge ||= known;
        const wins = known ? preview!.winsPercent : 0;
        const losses = known
          ? preview!.expectedLosses.reduce((sum, post) => sum + post.expected, 0)
          : 0;
        if (
          best === undefined ||
          wins > bestWins ||
          (wins === bestWins &&
            (losses < bestLosses || (losses === bestLosses && candidate.total > best.total)))
        ) {
          best = candidate;
          bestWins = wins;
          bestLosses = losses;
        }
      }
      if (best === undefined) continue;
      // A oferta só abre com posto livre. Reserva uma frente antes de pedir a oferta de
      // novo, dentro da antecedência pública; nunca envia callMilitia para testar a recusa.
      const militia = current.siege!.militiaOffer;
      if (
        wave === current.siege!.current + 1 &&
        militia.maxCount > 0 &&
        current.siege!.nextWaveInSeconds !== null &&
        current.siege!.nextWaveInSeconds! <= militia.warningSeconds &&
        (!knowledge || bestWins < MIN_WINS)
      ) {
        best = candidates.find((candidate) => candidate.name === NAMES[1]) ?? best;
      }
      if (current.siege!.current === 0 && current.siege!.plan[wave] !== best.id) {
        current = await act('setBattlePlan', { wave, formationId: best.id });
      } else if (decision !== undefined && current.siege!.plan[wave] !== best.id) {
        current = await act('swapWaveFormation', { formationId: best.id });
      }
      // A Defesa ativa acompanha a próxima onda; a finta do outono continua sendo do Militar.
      if (
        wave === current.siege!.current + 1 &&
        current.calendar.season === 'winter' &&
        !best.isActive
      ) {
        current = await act('setActiveFormation', { id: best.id });
      }
    }
    const offer = current.siege!.militiaOffer;
    const wave = (current.siege!.current + 1) as Wave;
    const id = current.siege!.plan[wave];
    if (offer.canCall && offer.maxCount > 0 && id !== null) {
      current = await act('simulateBattle', { formationId: id, siegeWave: wave });
      const preview = current.army.preview;
      if (
        preview !== null &&
        (!preview.knownEnemy.some((post) => post.count > 0) || preview.winsPercent < MIN_WINS)
      ) {
        current = await act('callMilitia', { count: offer.maxCount });
      }
    }
    return current;
  },
};
