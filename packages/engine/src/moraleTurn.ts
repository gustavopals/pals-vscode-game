import {
  balance,
  chronicleTemplates,
  craftGuilds,
  idleVillager,
  moraleBandTemplates,
  PRODUCTION_BUILDING_IDS,
} from '@lotg/content';

import { emit } from './chronicle';
import {
  aboveFloor,
  dropSpentEffects,
  famineDesertionsOwedAt,
  moraleAt,
  moraleBand,
} from './morale';
import { housingVacancy, releaseExcessWorkers } from './population';
import { chance } from './random';
import type { GameEvent, GameState } from './types';

/**
 * A moral na virada do dia de jogo (GDD §5.6 e §5.7; ADR 0013, decisão 19), em ordem fixa:
 *
 * 1. **Recálculo.** A moral passa a ser a soma dos termos daquele instante, limitada. Os
 *    efeitos temporários que já não contaram saem da lista. Se a faixa mudou, a
 *    Crônica registra (`moraleBandChanged`); a moral que muda dentro da mesma faixa não é linha.
 * 2. **Sorteios**, no fluxo `morale`, com a moral recém-calculada: primeiro a chegada de um
 *    colono (moral alta e vaga nas casas), depois a partida de um aldeão (moral baixa e gente
 *    acima do piso). Só se sorteia o que pode acontecer: sem vaga ou no piso, o fluxo não anda.
 * 3. **Deserção por fome**, sem sorteio: saem os aldeões que o prazo da fome já deve (a carência
 *    e o passo são tempo real, convertidos pelo ritmo) e ainda não saíram, exceto na
 *    dificuldade em que a fome não faz partir, e nunca abaixo do piso.
 *
 * Tudo acontece em uma virada de dia, que já é um instante da linha do tempo: avançar de uma
 * vez ou aos pedaços encontra as mesmas viradas, na mesma ordem, e gasta o gerador igual.
 */
export function turnMorale(draft: GameState, atMs: number, events: GameEvent[]): void {
  recalculate(draft, atMs, events);
  drawArrival(draft, atMs, events);
  drawDeparture(draft, atMs, events);
  desertFromFamine(draft, atMs, events);
}

function recalculate(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { settlement } = draft;
  const previous = settlement.morale;
  const next = moraleAt(draft, atMs);
  settlement.morale = next;
  dropSpentEffects(draft, atMs);
  const from = moraleBand(previous);
  const to = moraleBand(next);
  if (from.id === to.id) {
    return;
  }
  const phrases = moraleBandTemplates[to.id];
  emit(
    events,
    draft,
    atMs,
    'moraleBandChanged',
    { morale: next, band: to.id, previousMorale: previous, previousBand: from.id },
    { moral: to.label.toLowerCase() },
    (next > previous ? phrases.rose : phrases.fell) ?? chronicleTemplates.moraleBandChanged,
  );
}

/** Moral alta e vaga nas casas: a chance de um colono chegar, sem custo e sem ofício. */
function drawArrival(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { arrival } = balance.morale;
  const { settlement } = draft;
  if (settlement.morale < arrival.minMorale || housingVacancy(draft) <= 0) {
    return;
  }
  if (!chance(draft, 'morale', arrival.chance)) {
    return;
  }
  settlement.population.villagers += 1;
  const { villagers } = settlement.population;
  emit(
    events,
    draft,
    atMs,
    'villagerArrived',
    { villagers, morale: settlement.morale },
    { quantidade: villagers },
  );
}

/** Moral baixa e gente acima do piso: a chance de um aldeão partir. */
function drawDeparture(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { departure } = balance.morale;
  if (draft.settlement.morale > departure.maxMorale || !aboveFloor(draft)) {
    return;
  }
  if (chance(draft, 'morale', departure.chance)) {
    loseVillager(draft, atMs, events, 'villagerLeft');
  }
}

/**
 * A fome longa, sem sorteio (GDD §5.6; ADR 0016, item 2). A carência e o passo são tempo real;
 * quem cobra é a virada do dia: saem, um a um, os aldeões que o prazo já deve e que esta fome
 * ainda não cobrou, enquanto o feudo estiver acima do piso. A conta fecha no que era devido: o
 * que o piso impediu de sair fica perdoado, e ninguém sai em bloco se a população subir depois.
 */
function desertFromFamine(draft: GameState, atMs: number, events: GameEvent[]): void {
  const { famine } = draft.settlement;
  const owed = famineDesertionsOwedAt(draft, atMs);
  if (famine === null || owed <= famine.deserted) {
    return;
  }
  for (let due = owed - famine.deserted; due > 0 && aboveFloor(draft); due -= 1) {
    loseVillager(draft, atMs, events, 'villagerDeserted');
  }
  draft.settlement.famine = { ...famine, deserted: owed };
}

/**
 * Um aldeão deixa o feudo. Se sobrava alguém sem ofício, é ele quem vai; se todos trabalhavam,
 * sai do edifício com mais gente, primeiro quem ainda se adapta (`releaseExcessWorkers`). O
 * evento leva o edifício que perdeu o trabalhador, quando houve um, e a frase diz quem foi.
 */
function loseVillager(
  draft: GameState,
  atMs: number,
  events: GameEvent[],
  type: 'villagerLeft' | 'villagerDeserted',
): void {
  const { settlement } = draft;
  settlement.population.villagers -= 1;
  const released = releaseExcessWorkers(draft);
  const building = PRODUCTION_BUILDING_IDS.find((id) => (released[id] ?? 0) > 0);
  const { villagers } = settlement.population;
  emit(
    events,
    draft,
    atMs,
    type,
    { villagers, morale: settlement.morale, ...(building === undefined ? {} : { building }) },
    {
      quantidade: villagers,
      aldeao: building === undefined ? idleVillager : craftGuilds[building].artisan,
    },
  );
}
