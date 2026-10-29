import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { currentRepairQuote } from './wallRepair';
import { upgradeCost, upgradeQuote } from './construction';
import { readySiege } from './siege.test-helpers';
import { DAY } from './test-helpers';
import { finishSiege } from './siegeOutcome';
import { cloneState } from './state';
import { YEAR_MS } from './clock';

describe('V4G-T2.6 · Rescaldo e Reconstrução (GDD §11.4; ADR 0020, decisões 19 e 22)', () => {
  it('aplica festa (+15 por 1 dia) na Vitória Gloriosa', () => {
    const state = readySiege();
    state.siege!.result = 'glorious';
    state.siege!.deaths = 2; // Mesmo com baixas de comandantes, Gloriosa celebra festa (G-9)

    finishSiege(state, state.lastProcessedAt, []);

    const feast = state.settlement.moraleEffects.find((e) => e.id === 'siegeFeast');
    expect(feast).toBeDefined();
    expect(feast?.amount).toBe(balance.siege.feast.morale);
    expect(feast?.untilMs).toBe(state.lastProcessedAt + balance.siege.feast.days * DAY);
  });

  it('aplica luto (−10 por 1 dia) na Vitória com mortos', () => {
    const state = readySiege();
    state.siege!.result = 'victory';
    state.siege!.deaths = 5;

    finishSiege(state, state.lastProcessedAt, []);

    const mourning = state.settlement.moraleEffects.find((e) => e.id === 'siegeMourning');
    expect(mourning).toBeDefined();
    expect(mourning?.amount).toBe(balance.siege.mourning.morale);
    expect(mourning?.untilMs).toBe(state.lastProcessedAt + balance.siege.mourning.days * DAY);
  });

  it('aplica desconto de reparo de 20% (4/5) na muralha até o fim do inverno', () => {
    const state = readySiege();
    state.settlement.wall.hp.left = 100; // Danificada (total do nível 6 é 800)

    // Antes do fim do cerco: custo integral
    const quoteBefore = currentRepairQuote(state);

    // Encerra o cerco no inverno
    const at = state.siege!.atMs;
    state.lastProcessedAt = at;
    state.siege!.result = 'victory';
    state.siege!.endedAtMs = at;
    state.siege!.aftermathUntilMs = state.siege!.year * YEAR_MS;

    // Durante o rescaldo no inverno: desconto de 4/5 nos custos, mesma duração
    const quoteDiscounted = currentRepairQuote(state);
    expect(quoteDiscounted.stone).toBe(Math.floor((quoteBefore.stone * 4) / 5));
    expect(quoteDiscounted.gold).toBe(Math.floor((quoteBefore.gold * 4) / 5));
    expect(quoteDiscounted.durationMs).toBe(quoteBefore.durationMs);

    // Após o inverno (ano 2, primavera): desconto encerra
    const nextYear = cloneState(state);
    nextYear.lastProcessedAt = state.siege!.aftermathUntilMs;
    nextYear.clock.gameTimeMs = nextYear.lastProcessedAt;
    const quoteAfterWinter = currentRepairQuote(nextYear);
    expect(quoteAfterWinter.stone).toBe(quoteBefore.stone);
    expect(quoteAfterWinter.gold).toBe(quoteBefore.gold);
  });

  it('inicia a Primavera da Reconstrução após a Queda com custos ×4/5 por 2 dias', () => {
    const state = readySiege();
    // Cerco termina em Queda
    state.siege!.result = 'fall';
    state.siege!.endedAtMs = state.siege!.atMs;
    state.siege!.aftermathUntilMs = state.siege!.year * YEAR_MS;

    // Antes da virada do ano, reconstrução é nula
    expect(state.settlement.reconstructionUntilMs).toBeNull();
    const fromLevel = state.settlement.buildings.farm;
    const costNormal = upgradeCost('farm', fromLevel);

    // Avança para a virada do ano (início da Primavera do Ano 2)
    const springAt = state.siege!.year * YEAR_MS;
    const springTurn = advanceTo(state, springAt);

    // Primavera da Reconstrução começou: evento emitido e prazo de 2 dias de jogo
    expect(springTurn.events.some((e) => e.type === 'reconstructionStarted')).toBe(true);
    expect(springTurn.state.settlement.reconstructionUntilMs).toBe(springAt + 2 * DAY);

    // Custos de novas obras têm desconto de 4/5
    const costDiscounted = upgradeCost('farm', fromLevel, springTurn.state);
    for (const [res, amount] of Object.entries(costNormal)) {
      expect(costDiscounted[res as keyof typeof costDiscounted]).toBe(
        Math.floor((amount! * 4) / 5),
      );
    }

    // Orçamento de melhoria (upgradeQuote) reflete o desconto
    const quote = upgradeQuote(springTurn.state, 'farm');
    expect(quote.cost).toEqual(costDiscounted);

    // Após 2 dias de jogo, o desconto expira
    const afterReconstruction = advanceTo(springTurn.state, springAt + 2 * DAY);
    expect(afterReconstruction.state.settlement.reconstructionUntilMs).toBeNull();
    const costExpired = upgradeCost('farm', fromLevel, afterReconstruction.state);
    expect(costExpired).toEqual(costNormal);
  });

  it('não ativa a Primavera da Reconstrução se o cerco não terminou em Queda', () => {
    const state = readySiege();
    state.siege!.result = 'victory';
    state.siege!.endedAtMs = state.siege!.atMs;
    state.siege!.aftermathUntilMs = state.siege!.year * YEAR_MS;

    const springAt = state.siege!.year * YEAR_MS;
    const springTurn = advanceTo(state, springAt);

    expect(springTurn.events.some((e) => e.type === 'reconstructionStarted')).toBe(false);
    expect(springTurn.state.settlement.reconstructionUntilMs).toBeNull();
  });
});
