import { describe, expect, it } from 'vitest';

import { CURRENT_SCHEMA_VERSION } from './migrations';
import {
  command,
  HOUR,
  MINUTE,
  newGame,
  objectivesScenario,
  play,
  runWeekScenario,
} from './test-helpers';
import type { GameState } from './types';

/**
 * Retratos do estado **na versão atual**, um por cenário, gravados em
 * `__fixtures__/state-v<versão>-<cenário>.json`.
 *
 * Enquanto a versão não sobe, estes arquivos são goldens: uma mudança de regra aparece neles e
 * só é regravada com `UPDATE_GOLDEN=1`. No commit que sobe `schemaVersion`, este teste passa a
 * escrever os arquivos da versão nova e os da versão anterior ficam **congelados** para sempre,
 * como entrada do passo de migração novo (`migrations.test.ts`). Assim toda versão do estado
 * que já existiu tem retratos feitos pelo motor da época, sem ninguém ter de lembrar de gerá-los.
 */
const scenarios: Record<string, () => GameState> = {
  // Feudo recém-criado: ninguém deu ordem nenhuma.
  fresh: () => newGame('fixture-fresh'),

  // Obra em curso, duas planejadas e dois aldeões a caminho, no meio de um trecho de produção.
  construction: () =>
    play(newGame('fixture-construction'), [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 2 }),
      command('setWorkers', { building: 'quarry', count: 1 }),
      command('startConstruction', { building: 'housing' }),
      command('planConstruction', { building: 'farm' }),
      command('planConstruction', { building: 'lumberMill' }),
      command('recruitVillagers', { quantity: 2 }),
      { at: 2 * MINUTE + 7_321 },
    ]).state,

  // Fome: ninguém na Fazenda, a última comida gasta em um recruta, a fila congelada.
  famine: () =>
    play(newGame('fixture-famine'), [
      command('setWorkers', { building: 'lumberMill', count: 3 }),
      command('setWorkers', { building: 'quarry', count: 2 }),
      command('startConstruction', { building: 'housing' }),
      { at: 25 * HOUR + 54 * MINUTE },
      command('recruitVillagers', { quantity: 1 }),
      { at: 41 * HOUR + 13 * MINUTE },
    ]).state,

  // Os quatro primeiros objetivos concluídos.
  objectives: () => objectivesScenario().state,

  // O cenário roteirizado de 7 dias reais: ano 2, feudo renomeado, estoque de uma semana.
  'week-scripted': () => runWeekScenario().state,
};

describe(`retratos do estado na versão ${CURRENT_SCHEMA_VERSION}`, () => {
  it.each(Object.keys(scenarios))('%s', async (name) => {
    const state = (scenarios[name] as () => GameState)();
    expect(state.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    await expect(`${JSON.stringify(state, null, 1)}\n`).toMatchFileSnapshot(
      `./__fixtures__/state-v${CURRENT_SCHEMA_VERSION}-${name}.json`,
    );
  });

  it('os cenários passam pelos estados que uma migração precisa encontrar', () => {
    const built = Object.fromEntries(
      Object.entries(scenarios).map(([name, build]) => [name, build()]),
    ) as Record<keyof typeof scenarios, GameState>;
    const of = (name: string) => built[name] as GameState;

    expect(of('fresh').lastProcessedAt).toBe(0);
    expect(of('construction').settlement.constructionQueues.some((slot) => slot !== null)).toBe(
      true,
    );
    expect(of('construction').settlement.planned.length).toBeGreaterThanOrEqual(2);
    expect(of('construction').settlement.recruitmentQueue.length).toBeGreaterThan(0);
    expect(
      Object.values(of('construction').settlement.accumulators).some((rest) => rest !== 0),
    ).toBe(true);
    expect(of('famine').settlement.famine).not.toBeNull();
    expect(of('famine').settlement.recruitmentQueue.length).toBeGreaterThan(0);
    expect(of('objectives').objectives.completed.length).toBeGreaterThanOrEqual(4);
    expect(of('week-scripted').clock.year).toBeGreaterThan(1);
  });
});
