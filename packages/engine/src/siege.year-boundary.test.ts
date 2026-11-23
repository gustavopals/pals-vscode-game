import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentShape, migrateState } from './migrations';
import { siegeYard } from './siege.test-helpers';
import { HOUR, YEAR } from './test-helpers';

describe('V4G-T5.1 · as três ondas precisam caber antes do fechamento anual', () => {
  it('a Vigília perto do fim do inverno não deixa a Crônica fechar com Cerco pendente', () => {
    const state = siegeYard('peasant', 3);
    // Com origem UTC zero, a Vigília das 7 h cai em 165 h de jogo no ritmo 3.
    // As ondas seguintes cairiam em 168 h e 171 h, depois da Crônica do ano 1.
    state.settings.vigil.hourLocal = 7;
    state.settings.vigilHourLocal = 7;
    const after = advanceTo(state, YEAR);
    expect(after.state.siege!.atMs).toBe(156 * HOUR);
    expect(after.state.siege!.result).not.toBeNull();
    const summary = after.events.find((event) => event.type === 'yearEnded')!;
    expect(summary.data.siegeResult).toBe(after.state.siege!.result);
    const waves = after.events.filter((event) => event.type === 'siegeWaveFought');
    expect(waves).toHaveLength(3);
    expect(waves.every((event) => event.atMs < YEAR)).toBe(true);
    const interval = balance.siege.waveIntervalRealMs * state.settings.timeScale;
    expect(waves[1]!.atMs - waves[0]!.atMs).toBe(interval);
    expect(waves[2]!.atMs - waves[1]!.atMs).toBe(interval);
    expect(currentShape(after.state, '')).toBeNull();
  });

  it.each([0.5, 1, 3])(
    'a última onda exatamente no ano novo exige fallback no ritmo %s',
    (pace) => {
      const state = siegeYard('peasant', pace);
      // Alinha uma Vigília das zero horas para que a terceira onda coincida com o ano novo.
      const wanted = YEAR - 2 * HOUR * pace;
      const realDay = 24 * HOUR;
      state.settings.realOriginMs = realDay * 10 - wanted / pace;
      state.settings.vigil.hourLocal = 0;
      state.settings.vigilHourLocal = 0;
      const after = advanceTo(state, YEAR);
      expect(after.state.siege!.result).not.toBeNull();
      expect(after.events.filter((event) => event.type === 'siegeWaveFought')).toHaveLength(3);
      expect(
        after.events
          .filter((event) => event.type === 'siegeWaveFought')
          .every((event) => event.atMs < YEAR),
      ).toBe(true);
      expect(currentShape(after.state, '')).toBeNull();
    },
  );

  it('a partida migrada não agenda uma primeira onda que deixa as outras no ano seguinte', () => {
    const template = siegeYard();
    template.settings.vigil.hourLocal = 6;
    template.settings.vigilHourLocal = 6;
    template.lastProcessedAt = YEAR - 8 * HOUR + 1;
    template.clock.gameTimeMs = template.lastProcessedAt;
    const historical = JSON.parse(JSON.stringify(template));
    historical.schemaVersion = 39;
    delete historical.settlement.relics;
    delete historical.horde.previousYearFormation;
    delete historical.vows;
    delete historical.settlement.buildings.chapel;
    delete historical.siege;
    delete historical.settlement.militia;
    delete historical.settlement.reconstructionUntilMs;
    delete historical.council.bonuses;
    delete historical.map.expeditionUnlocks;
    delete historical.map.hexes;
    delete historical.map.radius;
    const migrated = migrateState(historical, { timeScale: 1 });
    const after = advanceTo(migrated, YEAR - 6 * HOUR);
    // A antecedência de 5 h a partir da virada em 162 h daria 167/168/169 h.
    expect(after.events.some((event) => event.type === 'siegeScheduled')).toBe(false);
    expect(after.state.siege).toBeNull();
    expect(currentShape(after.state, '')).toBeNull();
  });
});
