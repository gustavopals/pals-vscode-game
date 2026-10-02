import { balance } from '@lotg/content';
import { describe, expect, it, vi } from 'vitest';

import { impoverishedScenario } from './test-helpers';
import { deriveViewState } from './view';

/**
 * Os avisos de fome e de frio dizem quanto a produção cai. Esse número é de `@lotg/content`
 * (`balance.famine` e `balance.winter.cold`): a frase tem de sair dele, não de um "75%" escrito
 * à mão. Aqui o conteúdo é trocado por fatores que o jogo não usa (3/5 e 9/10): uma frase fixa
 * continuaria dizendo o número antigo, e a conta da produção, ao lado, diria outro.
 */
vi.mock('@lotg/content', async (importOriginal) => {
  const content = await importOriginal<{ balance: Record<string, unknown> }>();
  return {
    ...content,
    balance: {
      ...content.balance,
      famine: { productionMultiplier: { num: 3, den: 5 } },
      winter: { cold: { productionMultiplier: { num: 9, den: 10 } } },
    },
  };
});

describe('o percentual dos avisos de fome e de frio vem do conteúdo', () => {
  // Fome e frio juntos, com um lavrador: a conta da produção mostra os dois fatores.
  const state = impoverishedScenario();
  state.settlement.workers.farm = 1;
  const view = deriveViewState(state, state.lastProcessedAt);

  it('o conteúdo deste teste não é o do jogo', () => {
    expect(balance.famine.productionMultiplier).toEqual({ num: 3, den: 5 });
    expect(balance.winter.cold.productionMultiplier).toEqual({ num: 9, den: 10 });
  });

  it('a fome diz o fator de balance.famine.productionMultiplier', () => {
    expect(view.famine?.text).toMatch(
      /^Fome: a produção cai para 60% e ninguém se junta ao feudo até a comida voltar\./,
    );
    expect(view.famine?.text).not.toContain('75%');
  });

  it('o frio diz o fator de balance.winter.cold.productionMultiplier', () => {
    expect(view.winter?.cold?.text).toMatch(
      /^Frio: sem lenha, a produção de todo o feudo cai para 90%\./,
    );
    expect(view.winter?.cold?.text).not.toContain('80%');
  });

  it('e a conta da produção, na mesma tela, diz os mesmos fatores', () => {
    const farm = view.workers.find((row) => row.building === 'farm');
    expect(farm?.breakdown).toContain('× 0,6 (fome)');
    expect(farm?.breakdown).toContain('× 0,9 (frio)');
  });
});
