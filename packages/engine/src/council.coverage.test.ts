import { balance, councilCards, type SeasonId } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { CATALOG, DRAW_INTERVAL_MS, eligibleCards } from './council';
import { AUTUMN, DAY, gameAt, newGame, SPRING, SUMMER, WINTER, YEAR } from './test-helpers';
import type { GameState } from './types';

/**
 * A cobertura do catálogo (roadmap da v0.2, V2D-T2.5): quantas cartas o sorteio tem ao alcance
 * em cada estação e em cada estágio do feudo, com as cartas de `@lotg/content`. O piso é de 3
 * cartas elegíveis em qualquer audiência, do 5º dia em diante.
 *
 * O que o bot do simulador de fato vê em um ano, em 50 sementes, é medido em
 * `packages/sim-cli/src/coverage.test.ts`. A tabela desta medida está em docs/content-v0.2.md.
 */

const SEASON_START: Record<SeasonId, number> = {
  spring: SPRING,
  summer: SUMMER,
  autumn: AUTUMN,
  winter: WINTER,
};

/**
 * O feudo em cada nível do Salão, só no que as cartas olham: o que o nível libera. O Salão no
 * nível 2 libera o Celeiro (GDD §6.1), aqui já erguido; o 3 libera a Paliçada, e com ele os
 * aldeões passam a pedi-la (a carta olha o nível do Salão, não a obra).
 */
function feudAt(atMs: number, townHall: number, morale = 60): GameState {
  return gameAt(atMs, (draft) => {
    draft.settlement.buildings.townHall = townHall;
    draft.settlement.buildings.granary = townHall >= 2 ? 1 : 0;
    draft.settlement.buildings.warehouse = townHall >= 2 ? 1 : 0;
    draft.settlement.morale = morale;
  });
}

/** As audiências de uma estação do ano 1: os instantes da cadência que caem nela. */
function audiencesOf(season: SeasonId): number[] {
  const def = balance.calendar.seasons.find((entry) => entry.id === season);
  const start = SEASON_START[season];
  const end = start + (def?.days ?? 0) * DAY;
  const instants: number[] = [];
  for (let at = DRAW_INTERVAL_MS; at < YEAR; at += DRAW_INTERVAL_MS) {
    if (at >= start && at < end) {
      instants.push(at);
    }
  }
  return instants;
}

const ids = (state: GameState, atMs: number, seen: readonly string[] = []) =>
  eligibleCards(state, atMs, CATALOG, seen).map((card) => card.id);

describe('cobertura do catálogo por estação e nível do Salão', () => {
  it('o ano tem 5 audiências na primavera, 6 no verão, 6 no outono e 3 no inverno', () => {
    expect(balance.calendar.seasons.map((season) => audiencesOf(season.id).length)).toEqual([
      5, 6, 6, 3,
    ]);
    // A 21ª cai na virada do ano, e é a primeira da primavera seguinte.
    expect(YEAR % DRAW_INTERVAL_MS).toBe(0);
  });

  it('com a mesa livre e o ano no começo: quantas cartas cada audiência pode tirar', () => {
    const table = balance.calendar.seasons.map((season) => [
      season.id,
      ...[1, 2, 3].map((townHall) => {
        const counts = audiencesOf(season.id).map((at) => ids(feudAt(at, townHall), at).length);
        // A estação inteira vê o mesmo número: nenhuma carta do lote pede dia mínimo.
        expect(new Set(counts).size, `${season.id}, Salão ${townHall}`).toBe(1);
        return counts[0];
      }),
    ]);
    // Colunas: Salão 1 (sem depósitos), Salão 2 (com o Celeiro) e Salão 3 (o que o 2 tem e o
    // pedido da Paliçada, em toda estação).
    expect(table).toEqual([
      ['spring', 8, 9, 10],
      ['summer', 7, 9, 10],
      ['autumn', 9, 11, 12],
      ['winter', 5, 6, 7],
    ]);
    const at = audiencesOf('winter')[0] ?? 0;
    expect(ids(feudAt(at, 3), at)).toContain('palisadePromisePlea');
    expect(ids(feudAt(at, 2), at)).not.toContain('palisadePromisePlea');
  });

  it('nunca menos de 3, nem no pior caso: tudo o que sai uma vez por ano já saiu, e uma recorrente acabou de passar', () => {
    const once = councilCards.filter((card) => card.recurring !== true).map((card) => card.id);
    const recurring = councilCards.filter((card) => card.recurring === true);
    expect(recurring).toHaveLength(4);
    for (const season of balance.calendar.seasons) {
      for (const at of audiencesOf(season.id)) {
        for (const townHall of [1, 2, 3, 4]) {
          for (const last of recurring) {
            const state = feudAt(at, townHall);
            state.council.flags[`routine.${last.id}`] = true;
            const left = ids(state, at, once);
            expect(left, `${season.id}, Salão ${townHall}, depois de ${last.id}`).toHaveLength(3);
            expect(left).not.toContain(last.id);
          }
        }
      }
    }
  });

  it('a moral baixa tira as cartas de fartura, e ainda sobram as de sempre', () => {
    const at = AUTUMN + 4 * DAY;
    const fed = ids(feudAt(at, 2, 60), at);
    const hungry = ids(feudAt(at, 2, 30), at);
    expect(fed).toContain('harvestFeast');
    expect(fed).toContain('fullGranary');
    expect(hungry).not.toContain('harvestFeast');
    expect(hungry).not.toContain('fullGranary');
    expect(hungry.length).toBeGreaterThanOrEqual(3);
  });

  it('as cartas de cada estação: o que só ela tem, com o Celeiro erguido', () => {
    const only = (season: SeasonId) => {
      const at = audiencesOf(season)[0] ?? 0;
      const here = ids(feudAt(at, 2), at);
      const elsewhere = new Set(
        balance.calendar.seasons
          .filter((other) => other.id !== season)
          .flatMap((other) => {
            const instant = audiencesOf(other.id)[0] ?? 0;
            return ids(feudAt(instant, 2), instant);
          }),
      );
      return here.filter((id) => !elsewhere.has(id));
    };
    expect(only('spring')).toEqual(['springSeeds', 'springNews']);
    expect(only('summer')).toEqual([]);
    expect(only('autumn')).toEqual(['dampFirewood', 'roofBeforeCold', 'harvestFeast']);
    // O inverno não tem carta própria no primeiro lote: vive das recorrentes e do que sobrou.
    expect(only('winter')).toEqual([]);
  });

  it('a primeira audiência de um feudo recém-fundado, sem ordem nenhuma, já tem 8 cartas ao alcance', () => {
    const state = advanceTo(newGame('cobertura'), DRAW_INTERVAL_MS - 1).state;
    expect(ids(state, DRAW_INTERVAL_MS)).toEqual([
      'thawBridgePlea',
      'collapsedWell',
      'masonsMeal',
      'sawmillRest',
      'neighborsWatch',
      'moreMouths',
      'springSeeds',
      'springNews',
    ]);
    // E todas elas têm uma opção paga que esse feudo alcança: há o que pesar desde a primeira.
    for (const card of eligibleCards(state, DRAW_INTERVAL_MS, CATALOG)) {
      const has = (amounts: Partial<Record<string, number>> = {}) =>
        Object.entries(amounts).every(
          ([resource, amount]) =>
            state.settlement.resources[resource as 'food'] >= (amount ?? 0) * 1000,
        );
      const reachable = card.options.some(
        (option) =>
          option.cost !== undefined &&
          option.requires?.building === undefined &&
          has(option.requires?.resources) &&
          has(option.cost),
      );
      expect(reachable, card.id).toBe(true);
    }
  });
});
