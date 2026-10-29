import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { callMilitia } from './siegeOrders';
import { readySiege, siegeYard } from './siege.test-helpers';
import { ableVillagers } from './population';
import { watchtowerPerks, watchtowerWarningMs } from './threat';
import { HOUR } from './test-helpers';
import type { GameEvent, ScheduledRaid } from './types';

describe('V4G-T2.5 · Milícia (GDD §11.3; ADR 0020, decisão 21)', () => {
  it('convoca milícia com cerco marcado dentro da antecedência da Torre e emite evento', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.lastProcessedAt = now;
    state.clock.gameTimeMs = now;

    const events: GameEvent[] = [];
    const rejection = callMilitia(state, 10, now, events);

    expect(rejection).toBeNull();
    expect(state.settlement.militia).toEqual({ count: 10, untilMs: state.siege!.nextWaveAtMs });
    expect(state.stats.militiaCalled).toBe(10);
    const called = events.find((e) => e.type === 'militiaCalled');
    expect(called).toBeDefined();
    expect(called?.data).toMatchObject({ count: 10 });
  });

  it('convoca milícia com incursão forte dentro da antecedência da Torre', () => {
    const state = siegeYard();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const raidAt = 10 * HOUR;
    const raid: ScheduledRaid = {
      id: 'test-strong-raid',
      atMs: raidAt,
      kind: 'threat',
      enemy: 'raiders',
      size: 'strong',
      composition: null,
      announcedAtMs: raidAt - warning,
    };
    state.horde.scheduledRaids = [raid];
    const now = raidAt - warning + 500;
    state.lastProcessedAt = now;
    state.clock.gameTimeMs = now;

    const events: GameEvent[] = [];
    const rejection = callMilitia(state, 5, now, events);

    expect(rejection).toBeNull();
    expect(state.settlement.militia).toEqual({ count: 5, untilMs: raidAt });
  });

  it('recusa MILITIA_ACTIVE quando a milícia já está convocada', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.settlement.militia = { count: 8, untilMs: state.siege!.nextWaveAtMs! };

    const events: GameEvent[] = [];
    const rejection = callMilitia(state, 5, now, events);
    expect(rejection?.code).toBe('MILITIA_ACTIVE');
  });

  it('recusa MILITIA_NOT_ALLOWED sem Torre de Vigia ou fora da antecedência', () => {
    const state = readySiege();
    const events: GameEvent[] = [];

    // Sem Torre (nível 0)
    state.settlement.buildings.watchtower = 0;
    const rejectionNoTower = callMilitia(state, 5, state.lastProcessedAt, events);
    expect(rejectionNoTower?.code).toBe('MILITIA_NOT_ALLOWED');

    // Com Torre nível 5, mas muito antes da onda
    state.settlement.buildings.watchtower = 5;
    const tooEarly = state.siege!.nextWaveAtMs! - 20 * HOUR;
    state.lastProcessedAt = tooEarly;
    const rejectionTooEarly = callMilitia(state, 5, tooEarly, events);
    expect(rejectionTooEarly?.code).toBe('MILITIA_NOT_ALLOWED');

    // Com incursão leve dentro da antecedência (só forte é permitida)
    const tower = 5;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const raidAt = tooEarly + warning - 1000;
    state.horde.scheduledRaids = [
      {
        id: 'light-raid',
        atMs: raidAt,
        kind: 'threat',
        enemy: 'wolves',
        size: 'light',
        composition: null,
        announcedAtMs: raidAt - warning,
      },
    ];
    const rejectionLight = callMilitia(state, 5, tooEarly, events);
    expect(rejectionLight?.code).toBe('MILITIA_NOT_ALLOWED');
  });

  it('recusa INVALID_MILITIA_AMOUNT para quantidades inválidas, acima de 50% ou acima dos aptos', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.lastProcessedAt = now;
    state.settlement.population.villagers = 20;
    const events: GameEvent[] = [];

    // 0 ou negativo
    expect(callMilitia(state, 0, now, events)?.code).toBe('INVALID_MILITIA_AMOUNT');
    expect(callMilitia(state, -1, now, events)?.code).toBe('INVALID_MILITIA_AMOUNT');
    expect(callMilitia(state, 1.5, now, events)?.code).toBe('INVALID_MILITIA_AMOUNT');

    // Acima de 50% dos aldeões (50% de 20 é 10)
    expect(callMilitia(state, 11, now, events)?.code).toBe('INVALID_MILITIA_AMOUNT');

    // Limitado pelos aptos (se 15 estão feridos, só sobram 5 aptos)
    state.settlement.injured = Array(15).fill({ severity: 'light', untilMs: now + HOUR });
    expect(ableVillagers(state)).toBe(5);
    expect(callMilitia(state, 6, now, events)?.code).toBe('INVALID_MILITIA_AMOUNT');
    // 5 aptos é aceito
    expect(callMilitia(state, 5, now, events)).toBeNull();
  });

  it('afasta aldeões do trabalho ("não produzem") liberando trabalhadores excedentes', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.lastProcessedAt = now;
    state.settlement.population.villagers = 20;
    state.settlement.workers.farm = 10;
    state.settlement.workers.lumberMill = 10;

    expect(ableVillagers(state)).toBe(20);

    const events: GameEvent[] = [];
    // Convoca 10 aldeões (50%)
    const rej = callMilitia(state, 10, now, events);
    expect(rej).toBeNull();

    // Agora só 10 aldeões estão aptos a trabalhar
    expect(ableVillagers(state)).toBe(10);
    // Trabalhadores excedentes foram liberados: total alocado agora é 10
    const totalWorkers = Object.values(state.settlement.workers).reduce((s, w) => s + w, 0);
    expect(totalWorkers).toBe(10);
  });

  it('milícia combate na batalha, recebe ×5/4 de dano, sofre baixas e dissolve ao final', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.lastProcessedAt = now;
    state.settlement.population.villagers = 30;

    // Remove tropas regulares do centro para que a milícia ocupe centro.frente
    const form = state.army.formations[0]!;
    form.posts.center.front = null;
    state.army.units.shieldbearer = 40;

    // Convoca 10 milicianos
    callMilitia(state, 10, now, []);
    expect(state.settlement.militia?.count).toBe(10);

    // Avança para resolver a primeira onda
    const waveAt = state.siege!.nextWaveAtMs!;
    const afterWave = advanceTo(state, waveAt);

    // Confere relatório de batalha
    const lastReport = afterWave.state.army.reports[afterWave.state.army.reports.length - 1]!;
    const militiaCasualty = lastReport.casualties.find((c) => c.unit === 'militia');
    expect(militiaCasualty).toBeDefined();
    expect(militiaCasualty?.start).toBe(10);

    // Milícia foi desfeita após a batalha
    expect(afterWave.state.settlement.militia).toBeNull();
    expect(afterWave.events.some((e) => e.type === 'militiaDisbanded')).toBe(true);

    // Baixas da milícia reduziram aldeões
    const lostMilitia = militiaCasualty!.lost;
    expect(afterWave.state.settlement.population.villagers).toBe(30 - lostMilitia);
    expect(afterWave.state.siege!.deaths).toBeGreaterThanOrEqual(lostMilitia);
  });

  it('baixas na milícia respeitam o piso mínimo de 3 aldeões', () => {
    const state = readySiege();
    const tower = state.settlement.buildings.watchtower;
    const warning = watchtowerWarningMs(state, watchtowerPerks(tower)!);
    const now = state.siege!.nextWaveAtMs! - warning + 1000;
    state.lastProcessedAt = now;
    state.settlement.population.villagers = 6;
    // Convoca 3 aldeões (50% de 6)
    callMilitia(state, 3, now, []);

    // Zera exército para que a defesa colapse e a milícia sofra todas as baixas
    state.army.units = { spearman: 0, swordsman: 0, archer: 0, knight: 0, shieldbearer: 0 };
    state.settlement.wall.hp = { left: 0, center: 0, right: 0 };

    const waveAt = state.siege!.nextWaveAtMs!;
    const afterWave = advanceTo(state, waveAt);

    // Piso de 3 aldeões é protegido
    expect(afterWave.state.settlement.population.villagers).toBeGreaterThanOrEqual(
      balance.morale.populationFloor,
    );
    expect(afterWave.state.settlement.population.villagers).toBe(3);
  });
});
