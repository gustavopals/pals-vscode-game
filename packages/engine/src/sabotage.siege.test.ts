import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { settleHordeTiles } from './hordePlan';
import { currentShape } from './migrations';
import { scheduleSiege } from './siegeTurn';
import { cloneState } from './state';
import { addHero, guildHall, HOUR, send, WINTER } from './test-helpers';

describe('V4F-T4.1 · a Fortaleza some com a equipe na encruzilhada', () => {
  it.each([0, 1, 2])('o fim real do Cerco recolhe a variante %i no mesmo instante', (variant) => {
    const start = guildHall(
      WINTER - 2 * HOUR,
      (draft) => {
        draft.settlement.buildings.watchtower = 1;
        for (const name of ['Edda', 'Rolf', 'Isolda']) addHero(draft, { name, level: 10 });
        settleHordeTiles(draft, draft.lastProcessedAt, []);
        scheduleSiege(draft, draft.lastProcessedAt, []);
      },
      { timeScale: 3 },
    );
    const sent = send(start, 'sabotage', ['hero-1', 'hero-2', 'hero-3'], 'balanced', variant);
    const waiting = advanceTo(sent.state, WINTER).state;
    expect(waiting.guild.expeditions[0]!.status).toBe('atCrossroads');
    expect(waiting.guild.expeditions[0]!.crossroads!.decidesAtMs).toBeGreaterThan(
      waiting.siege!.atMs,
    );
    expect(currentShape(waiting, '')).toBeNull();
    const copy = cloneState(waiting);
    const end = waiting.siege!.atMs;
    // Sem tropa regular, a primeira onda encerra o Cerco por Queda e remove a Fortaleza.
    const closed = advanceTo(waiting, end);
    expect(closed.state.siege!.result).toBe('fall');
    expect(closed.state.map.tiles.hordeFortress).toBeUndefined();
    expect(closed.state.guild.expeditions).toEqual([]);
    expect(closed.state.guild.heroes.every((hero) => hero.status === 'idle')).toBe(true);
    expect(closed.state.rng[`expedition:${sent.expedition.id}`]).toBeUndefined();
    expect(closed.events.filter((event) => event.type === 'expeditionReturned')).toHaveLength(1);
    const fell = closed.events.findIndex((event) => event.type === 'siegeFell');
    const returned = closed.events.findIndex((event) => event.type === 'expeditionReturned');
    expect(returned).toBeGreaterThan(fell);
    expect(closed.events[returned]!.atMs).toBe(end);
    const whole = advanceTo(waiting, end + HOUR);
    const tail = advanceTo(closed.state, end + HOUR);
    expect(tail.state).toEqual(whole.state);
    expect([...closed.events, ...tail.events]).toEqual(whole.events);
    expect(currentShape(whole.state, '')).toBeNull();
    expect(waiting).toEqual(copy);
  });
});
