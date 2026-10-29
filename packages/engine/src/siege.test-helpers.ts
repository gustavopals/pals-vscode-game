import { WING_IDS, type DifficultyId } from '@lotg/content';

import { settleHordeTiles } from './hordePlan';
import { AUTUMN, gameAt, HOUR } from './test-helpers';
import type { Formation, GameState } from './types';
import { wallFullHp } from './wall';

/** Cenário isolado: preparação real da Horda, sem Conselho, incursões ou produção. */
export function siegeYard(difficulty: DifficultyId = 'lord', timeScale = 1): GameState {
  const state = gameAt(AUTUMN);
  state.seed = 'cerco-referencia-v4g';
  state.settings.difficulty = difficulty;
  state.settings.timeScale = timeScale;
  state.council.nextDrawAtMs = Number.MAX_SAFE_INTEGER;
  state.horde.scheduledRaids = [];
  state.map.threat = 0;
  state.map.tiles = {};
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
  settleHordeTiles(state, AUTUMN, []);
  return state;
}

export const WINTER = 144 * HOUR;
export const wingHp = (state: GameState) => WING_IDS.map((wing) => state.settlement.wall.hp[wing]);
