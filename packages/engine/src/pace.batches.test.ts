import { balance, units } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { trainingDurationMs } from './army';
import { trainingBlock } from './armyOrders';
import { currentShape, migrateState } from './migrations';
import { stateV41 } from './migrations/v41';
import { recruitmentBlock, recruitmentDurationMs } from './population';
import { seasonAt } from './clock';
import { accept, apply, barracksYard, command, MINUTE } from './test-helpers';
import { MILLI, paceScaled } from './units';
import { deriveViewState } from './view';

function roomy(timeScale: number, level = 3) {
  return barracksYard(
    0,
    (draft) => {
      draft.settings.timeScale = timeScale;
      draft.settlement.population.villagers = 40;
      draft.settlement.buildings.housing = 8;
      draft.settlement.resources = {
        food: 5_000_000,
        wood: 5_000_000,
        stone: 5_000_000,
        gold: 5_000_000,
        iron: 5_000_000,
      };
    },
    { level },
  );
}

describe.each([0.5, 1, 3])('lotes crescem com o ritmo %s (R2)', (timeScale) => {
  const factor = timeScale === 3 ? 3 : 1;
  const batchMax = balance.army.batchMax * factor;
  const recruitMax = balance.recruitment.maxPerOrder * factor;

  it('escala tetos inteiros, inclusive bases ímpares, sem reduzir o conteúdo', () => {
    for (const base of [0, 1, 3, 5, 10, 17]) {
      expect(paceScaled(base, timeScale)).toBe(base * factor);
      expect(Number.isSafeInteger(paceScaled(base, timeScale))).toBe(true);
    }
  });

  it('aceita o lote máximo e recusa o próximo com o teto certo, sem alterar custo ou duração', () => {
    const before = roomy(timeScale);
    expect(trainingBlock(before, 'spearman', batchMax)).toBeNull();
    expect(trainingBlock(before, 'spearman', batchMax + 1)).toEqual({
      code: 'INVALID_AMOUNT',
      message: `Treine um número inteiro de soldados, de 1 a ${batchMax}.`,
    });
    const ordered = accept(
      before,
      command('trainSoldiers', { unit: 'spearman', amount: batchMax }),
    );
    expect(ordered.state.army.training!.amount).toBe(batchMax);
    expect(ordered.state.army.training!.endsAtMs).toBe(trainingDurationMs(3, 'spearman', batchMax));
    for (const resource of ['food', 'gold', 'wood'] as const) {
      expect(
        before.settlement.resources[resource] - ordered.state.settlement.resources[resource],
      ).toBe(units.spearman.cost[resource]! * batchMax * MILLI);
    }
    expect(ordered.state.settlement.weapons).toBe(before.settlement.weapons);
    expect(ordered.state.rng).toEqual(before.rng);
    expect(currentShape(ordered.state, '')).toBeNull();
    const persisted = JSON.parse(JSON.stringify(ordered.state));
    expect(migrateState(persisted, { timeScale })).toEqual(ordered.state);
    const end = ordered.state.army.training!.endsAtMs;
    const justBefore = advanceTo(ordered.state, end - 1);
    expect(justBefore.state.army.units.spearman).toBe(0);
    const result = advanceTo(justBefore.state, end);
    expect(result.state.army.units.spearman).toBe(batchMax);
    expect(result.state.army.training).toBeNull();
    expect(result.events.filter((event) => event.type === 'soldiersTrained')).toHaveLength(1);
    const direct = advanceTo(ordered.state, end);
    expect(result.state).toEqual(direct.state);
    expect([...justBefore.events, ...result.events]).toEqual(direct.events);
  });

  it('a visão oferece todos os lotes válidos; o ritmo de exibição dos prazos não troca o limite', () => {
    const before = roomy(timeScale);
    const view = deriveViewState(before, 0);
    const offer = view.army.offer.find((entry) => entry.unit === 'spearman')!;
    expect(offer.batchMax).toBe(batchMax);
    expect(offer.maxAmount).toBe(batchMax);
    expect(offer.options.map((entry) => entry.amount)).toEqual(
      Array.from({ length: batchMax }, (_, i) => i + 1),
    );
    expect(offer.options.at(-1)!.seconds).toBe(
      Math.ceil(trainingDurationMs(3, 'spearman', batchMax) / timeScale / 1000),
    );
    expect(
      deriveViewState(before, 0, { timeScale: timeScale === 3 ? 1 : 3 }).army.offer.find(
        (entry) => entry.unit === 'spearman',
      ),
    ).toMatchObject({ batchMax, maxAmount: batchMax });
    before.settlement.buildings.barracks = 0;
    expect(
      deriveViewState(before, 0).constructions.available.find(
        (entry) => entry.building === 'barracks',
      )!.effect,
    ).toContain(`um lote de até ${batchMax} por vez`);
  });

  it('não multiplica vagas do Quartel e conserva os demais bloqueios', () => {
    const before = roomy(timeScale, 1);
    const wanted = Math.min(batchMax, balance.army.capPerLevel);
    expect(deriveViewState(before, 0).army.cap).toBe(balance.army.capPerLevel);
    expect(deriveViewState(before, 0).army.offer[0]!.maxAmount).toBe(wanted);
    if (timeScale === 3) expect(trainingBlock(before, 'spearman', 11)?.code).toBe('ARMY_LIMIT');
    before.settlement.buildings.barracks = 3;
    before.settlement.population.villagers = balance.morale.populationFloor;
    expect(trainingBlock(before, 'spearman', 1)?.code).toBe('NOT_ENOUGH_VILLAGERS');
    before.settlement.population.villagers = 40;
    before.settlement.resources.gold = 0;
    expect(trainingBlock(before, 'spearman', batchMax)?.code).toBe('INSUFFICIENT_RESOURCES');
  });

  it('a recusa do recrutamento usa o teto por ordem multiplicado; moradia e fila continuam limitando a oferta', () => {
    const before = roomy(timeScale);
    expect(recruitmentBlock(before, recruitMax + 1)).toEqual({
      code: 'INVALID_QUANTITY',
      message: `Recrute de 1 a ${recruitMax} aldeões por ordem.`,
    });
    const max = Math.min(recruitMax, paceScaled(balance.recruitment.maxQueue, timeScale), 20);
    expect(deriveViewState(before, 0).recruitment.maxQuantity).toBe(max);
    const ordered = accept(before, command('recruitVillagers', { quantity: max }));
    expect(ordered.state.settlement.recruitmentQueue).toHaveLength(max);
    expect(ordered.state.settlement.recruitmentQueue.at(-1)!.finishesAtMs).toBe(
      max * recruitmentDurationMs(seasonAt(0)),
    );
    expect(before.settlement.resources.food - ordered.state.settlement.resources.food).toBe(
      balance.recruitment.cost.food! * max * MILLI,
    );
    expect(currentShape(ordered.state, '')).toBeNull();
    expect(deriveViewState(ordered.state, 0).recruitment.maxQuantity).toBe(0);
    expect(recruitmentBlock(ordered.state, 1)?.message).toBe(
      `Já há ${max} aldeões a caminho. Espere algum chegar.`,
    );
    const end = ordered.state.settlement.recruitmentQueue.at(-1)!.finishesAtMs;
    const cut = advanceTo(ordered.state, end - 1);
    expect(cut.state.settlement.recruitmentQueue).toHaveLength(1);
    const at = advanceTo(cut.state, end);
    expect(at.state.settlement.recruitmentQueue).toEqual([]);
    const direct = advanceTo(ordered.state, end);
    expect(at.state).toEqual(direct.state);
    expect([...cut.events, ...at.events]).toEqual(direct.events);
  });

  it('o teto de recrutamento respeita fila parcialmente ocupada, moradia e recursos', () => {
    const before = roomy(timeScale);
    const queued = accept(before, command('recruitVillagers', { quantity: 2 })).state;
    expect(deriveViewState(queued, 0).recruitment.maxQuantity).toBe(recruitMax - 2);
    expect(recruitmentBlock(queued, recruitMax)?.code).toBe('RECRUIT_QUEUE_FULL');
    before.settlement.population.villagers = 59;
    expect(deriveViewState(before, 0).recruitment.maxQuantity).toBe(1);
    expect(recruitmentBlock(before, 2)?.code).toBe('HOUSING_FULL');
    before.settlement.population.villagers = 40;
    before.settlement.resources.gold = 0;
    expect(recruitmentBlock(before, 1)?.code).toBe('INSUFFICIENT_RESOURCES');
  });
});

it('a guarda atual aceita o lote ampliado sem afrouxar as guardas históricas ou o teto do Quartel', () => {
  const result = accept(roomy(3), command('trainSoldiers', { unit: 'spearman', amount: 30 }));
  const serialized = JSON.stringify(result.state);
  expect(currentShape(result.state, '')).toBeNull();
  expect(JSON.stringify(result.state)).toBe(serialized);
  const { expeditionUnlocks, ...oldMap } = result.state.map;
  expect(expeditionUnlocks).toEqual({});
  expect(stateV41({ ...result.state, schemaVersion: 41, map: oldMap }, '')).toBe(
    'army.training.amount: lote acima do máximo',
  );
  const invalid = JSON.parse(JSON.stringify(result.state));
  invalid.army.training.amount = 31;
  expect(currentShape(invalid, '')).toBe('army.training.amount: lote acima do máximo');
  invalid.army.training.amount = 30;
  invalid.settlement.buildings.barracks = 2;
  expect(currentShape(invalid, '')).toBe(
    'army.training.amount: soldados e lote acima do limite do Quartel',
  );
  invalid.stats.siegesFallen = 1;
  expect(currentShape(invalid, '')).toBeNull();
  invalid.army.units.spearman = 60;
  expect(currentShape(invalid, '')).not.toBeNull();
  invalid.army.units.spearman = 0;
  invalid.settlement.buildings.barracks = 3;
  invalid.army.training.endsAtMs = -1;
  expect(currentShape(invalid, '')).not.toBeNull();
  invalid.army.training.endsAtMs = MINUTE;
  invalid.army.training.amount = 10.5;
  expect(currentShape(invalid, '')).not.toBeNull();
  expect(apply(roomy(1), command('trainSoldiers', { unit: 'spearman', amount: 30 })).ok).toBe(
    false,
  );
});

it('congela as ofertas de lotes derivadas nos três ritmos', async () => {
  const views = [0.5, 1, 3].map((timeScale) => {
    const view = deriveViewState(roomy(timeScale), 0);
    return {
      timeScale,
      cap: view.army.cap,
      spearman: view.army.offer.find((entry) => entry.unit === 'spearman'),
      recruitment: view.recruitment,
    };
  });
  await expect(`${JSON.stringify(views, null, 2)}\n`).toMatchFileSnapshot(
    './__golden__/pace-batches.json',
  );
});
