import { siegeTexts } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo, deriveViewState } from './index';
import { readySiege } from './siege.test-helpers';
import { YEAR } from './test-helpers';

// Adições públicas sem gravação de estado nem sorteio na leitura.
describe('complementos da visão do Cerco', () => {
  it('oferece termos, identidade do embate e quantidade ativa sem mutar a entrada', () => {
    const state = readySiege();
    const snapshot = JSON.stringify(state);
    const view = deriveViewState(state, state.lastProcessedAt);
    expect(view.siege!.militiaOffer).toMatchObject({
      termsText: siegeTexts.militiaTerms,
      activeCount: 0,
      targetId: expect.any(String),
    });
    expect(JSON.stringify(state)).toBe(snapshot);
    state.settlement.militia = { count: 3, untilMs: state.siege!.nextWaveAtMs! };
    expect(deriveViewState(state, state.lastProcessedAt).siege!.militiaOffer).toMatchObject({
      canCall: false,
      activeCount: 3,
      blockedReason: siegeTexts.militiaActive,
    });
  });
  for (const pace of [0.5, 1, 3]) {
    it(`expõe resumo, prazos reais e Reconstrução no ritmo ${pace}`, () => {
      let state = readySiege('lord', pace);
      for (const unit of Object.keys(state.army.units) as Array<keyof typeof state.army.units>)
        state.army.units[unit] = 0;
      while (state.siege!.nextWaveAtMs !== null)
        state = advanceTo(state, state.siege!.nextWaveAtMs!).state;
      const view = deriveViewState(state, state.lastProcessedAt);
      expect(view.siege!.aftermath).toMatchObject({
        summary: siegeTexts.aftermath.summary
          .replace('{ondas}', String(state.siege!.current))
          .replace('{mortos}', String(state.siege!.deaths)),
        endsInSeconds: Math.ceil(
          (state.siege!.aftermathUntilMs! - state.lastProcessedAt) / pace / 1000,
        ),
        repairText: siegeTexts.aftermath.repair,
      });
      state = advanceTo(state, YEAR).state;
      expect(deriveViewState(state, YEAR).siege!.aftermath).toMatchObject({
        endsInSeconds: 0,
        repairText: null,
        reconstructionText: siegeTexts.reconstruction,
        reconstructionEndsInSeconds: expect.any(Number),
      });
    });
  }
});
