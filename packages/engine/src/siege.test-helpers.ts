import { WING_IDS, type DifficultyId } from '@lotg/content';

import { settleHordeTiles } from './hordePlan';
import { AUTUMN, gameAt, HOUR, YEAR } from './test-helpers';
import type { Formation, GameState } from './types';
import { scheduleSiege } from './siegeTurn';
import { wallFullHp } from './wall';

/**
 * Cenário isolado: preparação real da Horda, sem Conselho, incursões ou produção. O outono é o
 * do ano pedido: as ondas do ano 1 têm um terço do tamanho, as do ano 2 dois terços, e as do
 * ano 3 em diante o tamanho inteiro (respostas do autor de 2026-11-04).
 */
export function siegeYard(difficulty: DifficultyId = 'lord', timeScale = 1, year = 1): GameState {
  const autumn = (year - 1) * YEAR + AUTUMN;
  const state = gameAt(autumn, undefined, 'cerco-referencia-v4g');
  state.settings.difficulty = difficulty;
  state.settings.timeScale = timeScale;
  state.council.nextDrawAtMs = Number.MAX_SAFE_INTEGER;
  state.map.threat = 0;
  state.settlement.buildings.barracks = 8;
  state.settlement.buildings.palisade = 6;
  state.settlement.buildings.watchtower = 5;
  state.settlement.buildings.townHall = 8;
  state.settlement.buildings.granary = 8;
  state.settlement.buildings.warehouse = 8;
  state.settlement.population.villagers = 30;
  state.settlement.resources = {
    food: 5_000_000,
    wood: 5_000_000,
    stone: 5_000_000,
    gold: 10_000_000,
    iron: 0,
  };
  state.settlement.wall.hp = wallFullHp(6);
  state.army.units = { spearman: 0, swordsman: 0, knight: 0, shieldbearer: 60, archer: 20 };
  const formation: Formation = {
    id: 'formation-1',
    name: 'Muralha Firme',
    posts: {
      left: { front: { unit: 'shieldbearer', count: 20 }, back: { unit: 'archer', count: 6 } },
      center: { front: { unit: 'shieldbearer', count: 20 }, back: { unit: 'archer', count: 8 } },
      right: { front: { unit: 'shieldbearer', count: 20 }, back: { unit: 'archer', count: 6 } },
    },
    commanders: { left: null, center: null, right: null },
  };
  state.ids.formation = 1;
  state.army.formations = [formation];
  state.army.activeFormationId = formation.id;
  settleHordeTiles(state, autumn, []);
  return state;
}

export const WINTER = 144 * HOUR;
export const wingHp = (state: GameState) => WING_IDS.map((wing) => state.settlement.wall.hp[wing]);

/** Instante imediatamente anterior à primeira onda, sem simular a economia do outono. */
export function readySiege(difficulty: DifficultyId = 'lord', timeScale = 1, year = 1): GameState {
  const state = siegeYard(difficulty, timeScale, year);
  scheduleSiege(state, state.lastProcessedAt, []);
  state.lastProcessedAt = state.siege!.atMs - 1;
  state.clock.gameTimeMs = state.lastProcessedAt;
  return state;
}
