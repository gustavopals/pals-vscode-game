import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { accept, command, eventsOfType, MINUTE, refuse, wallSite } from './test-helpers';
import type { GameState } from './types';
import { deriveViewState } from './view';
import { applyWallDamage, wallForBattle } from './wallRepair';

/**
 * A muralha no estado (V4E-T1.2 e T1.3): o reparo (`repairWall`) entra na frente da fila de
 * obras e termina junto delas; a obra da Paliçada soma a vida do nível novo; o dano de uma
 * batalha persiste. As contas puras estão em `wall.test.ts`.
 */

const repair = command('repairWall', {});

describe('a ordem repairWall', () => {
  it('cobra a pedra e o ouro do que falta, marca o fim e deixa cada ala cheia no prazo', () => {
    // Muralha de Pedra Nv3 com 200 de 600 faltando: 75 de pedra, 75 de ouro, 60 min de jogo.
    const start = wallSite(3, { left: 50, right: 150 });
    const { state, events } = accept(start, repair);
    expect(start.settlement.resources.stone - state.settlement.resources.stone).toBe(75_000);
    expect(start.settlement.resources.gold - state.settlement.resources.gold).toBe(75_000);
    expect(state.settlement.wallRepair).toEqual({
      untilMs: 60 * MINUTE,
      toHp: { left: 200, center: 200, right: 200 },
    });
    expect(eventsOfType(events, 'wallRepairStarted').map((event) => event.text)).toEqual([
      'No 1º dia da Primavera, os pedreiros de Pedra Alta largaram as outras obras e subiram à muralha para refazer a ala esquerda (50 de 200) e a ala direita (150 de 200).',
    ]);
    const before = advanceTo(state, 60 * MINUTE - 1);
    expect(before.state.settlement.wall.hp).toEqual({ left: 50, center: 200, right: 150 });
    expect(eventsOfType(before.events, 'wallRepaired')).toEqual([]);
    const after = advanceTo(state, 60 * MINUTE);
    expect(after.state.settlement.wall.hp).toEqual({ left: 200, center: 200, right: 200 });
    expect(after.state.settlement.wallRepair).toBeNull();
    expect(eventsOfType(after.events, 'wallRepaired').map((event) => event.text)).toEqual([
      'No 1º dia da Primavera, a muralha de Pedra Alta voltou a ficar inteira.',
    ]);
  });

  it('as recusas: sem Paliçada, inteira, já em reparo e sem recurso', () => {
    expect(refuse(wallSite(0), repair)).toEqual({
      code: 'WALL_REQUIRED',
      message: 'Sem Paliçada não há muralha para reparar.',
    });
    expect(refuse(wallSite(2), repair)).toEqual({
      code: 'WALL_INTACT',
      message: 'A muralha está inteira: não há o que reparar.',
    });
    const repairing = accept(wallSite(2, { left: 10 }), repair).state;
    expect(refuse(repairing, repair).code).toBe('WALL_REPAIRING');
    const poor = wallSite(6, { left: 0, center: 0, right: 0 }, 0, (draft) => {
      draft.settlement.resources.stone = 100_000;
    });
    expect(refuse(poor, repair)).toMatchObject({ code: 'INSUFFICIENT_RESOURCES' });
  });

  it('entra na frente da fila: a obra em curso espera o prazo do reparo, e a que começa durante ele só corre depois', () => {
    const site = wallSite(3, { left: 150 });
    // A Fazenda em obra; o reparo de 50 de vida leva 15 min de jogo.
    const farming = accept(site, command('startConstruction', { building: 'farm' })).state;
    const farmEnds = farming.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
    const repairing = accept(farming, repair).state;
    expect(repairing.settlement.wallRepair?.untilMs).toBe(15 * MINUTE);
    expect(repairing.settlement.constructionQueues[0]?.finishesAtMs).toBe(farmEnds + 15 * MINUTE);
    expect(advanceTo(repairing, farmEnds).state.settlement.buildings.farm).toBe(1);
    expect(advanceTo(repairing, farmEnds + 15 * MINUTE).state.settlement.buildings.farm).toBe(2);
    // Uma obra que começa com o reparo em curso só termina depois dele.
    const second = accept(repairing, command('startConstruction', { building: 'quarry' })).state;
    const quarry = second.settlement.constructionQueues.find((slot) => slot?.building === 'quarry');
    const fresh = accept(site, command('startConstruction', { building: 'quarry' })).state;
    const quarryAlone = fresh.settlement.constructionQueues[0]?.finishesAtMs ?? 0;
    expect(quarry?.finishesAtMs).toBe(quarryAlone + 15 * MINUTE);
  });

  it('no mesmo instante: o reparo termina antes das obras, e a obra da Paliçada soma o nível novo ao que o reparo deixou', () => {
    const at = 30 * MINUTE;
    const state = wallSite(2, { left: 20 }, 0, (draft) => {
      draft.settlement.wallRepair = { untilMs: at, toHp: { left: 100, center: 100, right: 100 } };
      draft.settlement.constructionQueues[0] = {
        building: 'palisade',
        targetLevel: 3,
        startedAtMs: 0,
        finishesAtMs: at,
      };
    });
    const { state: after, events } = advanceTo(state, at);
    expect(after.settlement.buildings.palisade).toBe(3);
    expect(after.settlement.wall.hp).toEqual({ left: 200, center: 200, right: 200 });
    const order = events
      .filter((event) => event.type === 'wallRepaired' || event.type === 'constructionFinished')
      .map((event) => event.type);
    expect(order).toEqual(['wallRepaired', 'constructionFinished']);
  });

  it('a obra da Paliçada durante o reparo: o alvo do reparo também sobe', () => {
    const state = wallSite(2, { left: 20 }, 0, (draft) => {
      draft.settlement.wallRepair = {
        untilMs: 50 * MINUTE,
        toHp: { left: 100, center: 100, right: 100 },
      };
      draft.settlement.constructionQueues[0] = {
        building: 'palisade',
        targetLevel: 3,
        startedAtMs: 0,
        finishesAtMs: 20 * MINUTE,
      };
    });
    const mid = advanceTo(state, 20 * MINUTE).state;
    expect(mid.settlement.wall.hp).toEqual({ left: 120, center: 200, right: 200 });
    expect(mid.settlement.wallRepair?.toHp).toEqual({ left: 200, center: 200, right: 200 });
    expect(advanceTo(mid, 50 * MINUTE).state.settlement.wall.hp.left).toBe(200);
  });

  it('a divisão de intervalo continua exata com o reparo terminando no meio', () => {
    const repairing = accept(wallSite(4, { left: 0, center: 100 }), repair).state;
    const until = repairing.settlement.wallRepair?.untilMs ?? 0;
    const end = until + 30 * MINUTE;
    const whole = advanceTo(repairing, end);
    fc.assert(
      fc.property(fc.integer({ min: 1, max: end - 1 }), (cut) => {
        const first = advanceTo(repairing, cut);
        const second = advanceTo(first.state, end);
        expect(second.state).toEqual(whole.state);
        expect([...first.events, ...second.events]).toEqual(whole.events);
      }),
      { numRuns: 25 },
    );
    // E no instante exato do fim.
    const first = advanceTo(repairing, until);
    expect(advanceTo(first.state, end).state).toEqual(whole.state);
  });
});

describe('o dano de uma batalha à muralha', () => {
  it('a vida de cada ala passa a ser a do fim da batalha, e a Crônica diz quais alas sofreram', () => {
    const draft = JSON.parse(JSON.stringify(wallSite(3))) as GameState;
    const events: Parameters<typeof applyWallDamage>[3] = [];
    applyWallDamage(
      draft,
      {
        wall: [
          { wing: 'left', start: 200, end: 40 },
          { wing: 'center', start: 200, end: 200 },
          { wing: 'right', start: 200, end: 0 },
        ],
      },
      0,
      events,
    );
    expect(draft.settlement.wall.hp).toEqual({ left: 40, center: 200, right: 0 });
    expect(events.map((event) => event.text)).toEqual([
      'No 1º dia da Primavera, a batalha deixou marcas na muralha de Pedra Alta: a ala esquerda (40 de 200) e a ala direita (0 de 200).',
    ]);
    expect(events[0]?.data).toMatchObject({ hp_left: 40, hp_center: 200, hp_right: 0 });
    // A ala derrubada entra na batalha seguinte sem muralha.
    expect(wallForBattle(draft)).toEqual({ left: 40, center: 200 });
  });

  it('sem dano, sem linha', () => {
    const draft = JSON.parse(JSON.stringify(wallSite(1))) as GameState;
    const events: Parameters<typeof applyWallDamage>[3] = [];
    applyWallDamage(draft, { wall: [{ wing: 'left', start: 60, end: 60 }] }, 0, events);
    expect(events).toEqual([]);
  });
});

describe('a muralha na visão (`threat.defense.wall`)', () => {
  it('em reparo: o prazo em tempo real e as obras que esperam', () => {
    const repairing = accept(wallSite(3, { left: 150 }), repair).state;
    const { wall } = deriveViewState(repairing, 0, { timeScale: 3 }).threat.defense;
    expect(wall.repairOffer).toMatchObject({
      canRepair: false,
      repairingInSeconds: 5 * 60,
      text: 'Os pedreiros estão na muralha: o reparo termina em 5 min, e as obras esperam por ele.',
      blockedText: 'Os pedreiros já estão na muralha: espere o reparo em curso terminar.',
    });
  });
});
