import type { CouncilCard } from '@lotg/content';

import type { CouncilHero, GameState, Hero } from './types';

/** Livre para os encontros da praça: em casa, pronto e sem ferimento. */
export function freeCouncilHero(hero: Hero): boolean {
  return hero.status === 'idle' && hero.injury === null;
}

export function councilHeroCandidates(state: GameState, card: CouncilCard): Hero[] {
  return state.guild.heroes.filter(
    card.requires?.injuredHero === true
      ? (hero) => hero.status === 'injured' && hero.injury !== null
      : freeCouncilHero,
  );
}

/** Os nomes pertencem à ocorrência, não à lista atual da Guilda. */
export function councilHeroWords(heroes: readonly CouncilHero[] = []) {
  return {
    ...(heroes[0] === undefined ? {} : { heroi: heroes[0].name }),
    ...(heroes[1] === undefined ? {} : { heroi2: heroes[1].name }),
  };
}

export function councilHeroData(heroes: readonly CouncilHero[] = []) {
  return {
    ...(heroes[0] === undefined ? {} : { heroId: heroes[0].id, heroName: heroes[0].name }),
    ...(heroes[1] === undefined ? {} : { hero2Id: heroes[1].id, hero2Name: heroes[1].name }),
  };
}
