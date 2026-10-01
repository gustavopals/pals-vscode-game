import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { applyCommand } from './commands';
import { describeAmounts, reject } from './rejections';
import { accept, apply, command, gameWith, HOUR, newGame, refuse } from './test-helpers';
import { type Command, REJECTION_CODES } from './types';

describe('applyCommand', () => {
  it('exige o estado avançado até o instante do comando', () => {
    const state = newGame();
    const order = command('setWorkers', { building: 'farm', count: 1 });
    expect(() => applyCommand(state, order, HOUR)).toThrow(/exige o estado avançado/);
    const advanced = advanceTo(state, HOUR).state;
    expect(applyCommand(advanced, order, HOUR).ok).toBe(true);
  });

  it('não muta o estado de entrada, aceite ou recuse', () => {
    const state = newGame();
    const before = JSON.stringify(state);
    accept(state, command('startConstruction', { building: 'farm' }));
    refuse(state, command('startConstruction', { building: 'townHall' }));
    expect(JSON.stringify(state)).toBe(before);
  });

  it('uma recusa devolve código e mensagem, sem estado nem eventos', () => {
    const result = apply(newGame(), command('recruitVillagers', { quantity: 9 }));
    expect(result).toEqual({
      ok: false,
      code: 'INVALID_QUANTITY',
      message: 'Recrute de 1 a 5 aldeões por ordem.',
    });
  });

  it('recusa um comando desconhecido', () => {
    const bogus = { commandId: 'x', type: 'declareWar', payload: {} } as unknown as Command;
    expect(refuse(newGame(), bogus)).toEqual({
      code: 'UNKNOWN_COMMAND',
      message: 'O feudo não conhece essa ordem.',
    });
  });

  it('recusa um comando sem payload em vez de lançar exceção', () => {
    const bare = { commandId: 'x', type: 'startConstruction' } as unknown as Command;
    expect(refuse(newGame(), bare).code).toBe('INVALID_BUILDING');
  });

  it('um comando aceito devolve os eventos que causou', () => {
    const { events } = accept(newGame(), command('setWorkers', { building: 'farm', count: 2 }));
    expect(events.map((event) => event.type)).toEqual(['objectiveCompleted']);
  });
});

describe('renameSettlement', () => {
  it('troca o nome, aparando espaços, e registra na Crônica', () => {
    const { state, events } = accept(
      newGame(),
      command('renameSettlement', { name: '  Vau Alto ' }),
    );
    expect(state.settlement.name).toBe('Vau Alto');
    expect(events).toMatchObject([{ type: 'settlementRenamed', data: { name: 'Vau Alto' } }]);
    expect(events[0]?.text).toBe('No 1º dia da Primavera, o feudo passou a se chamar Vau Alto.');
  });

  it('aceita de 2 a 24 caracteres', () => {
    expect(apply(newGame(), command('renameSettlement', { name: 'Ab' })).ok).toBe(true);
    expect(apply(newGame(), command('renameSettlement', { name: 'x'.repeat(24) })).ok).toBe(true);
  });

  it.each([['A'], ['x'.repeat(25)], ['   '], [42 as unknown as string]])('recusa %j', (name) => {
    expect(refuse(newGame(), command('renameSettlement', { name }))).toEqual({
      code: 'INVALID_NAME',
      message: 'O nome do feudo deve ter de 2 a 24 caracteres.',
    });
  });
});

describe('catálogo de recusas', () => {
  // Um cenário por código: nenhuma recusa fica sem teste.
  const rich = gameWith((draft) => {
    draft.settlement.resources = { food: 9e6, wood: 9e6, stone: 9e6, gold: 9e6 };
  });
  const building = accept(rich, command('startConstruction', { building: 'farm' })).state;
  const planned = accept(rich, command('planConstruction', { building: 'farm' })).state;
  const starving = gameWith((draft) => {
    draft.settlement.resources.food = 0;
    draft.settlement.famine = { sinceMs: 0 };
  });
  const queued = accept(
    gameWith((draft) => {
      Object.assign(draft.settlement, rich.settlement);
      draft.settlement.buildings = { ...draft.settlement.buildings, housing: 5 };
    }),
    command('recruitVillagers', { quantity: 5 }),
  ).state;
  const maxed = gameWith((draft) => {
    draft.settlement.buildings.townHall = 8;
  });
  const gated = gameWith((draft) => {
    Object.assign(draft.settlement, rich.settlement);
    draft.settlement.buildings = { ...draft.settlement.buildings, quarry: 2 };
  });
  const crowded = gameWith((draft) => {
    Object.assign(draft.settlement, rich.settlement);
    draft.settlement.population = { villagers: 10 };
  });
  const unknown = { commandId: 'x', type: 'siege', payload: {} } as unknown as Command;
  const bogus = { building: 'keep' } as unknown as { building: 'farm' };

  const scenarios: Record<(typeof REJECTION_CODES)[number], [typeof rich, Command]> = {
    UNKNOWN_COMMAND: [rich, unknown],
    INVALID_BUILDING: [rich, command('startConstruction', bogus)],
    INVALID_WORKERS: [rich, command('setWorkers', { building: 'farm', count: -2 })],
    NOT_ENOUGH_VILLAGERS: [rich, command('setWorkers', { building: 'farm', count: 6 })],
    ALREADY_UPGRADING: [building, command('startConstruction', { building: 'farm' })],
    QUEUE_BUSY: [building, command('startConstruction', { building: 'housing' })],
    MAX_LEVEL: [maxed, command('startConstruction', { building: 'townHall' })],
    GATE_LOCKED: [gated, command('startConstruction', { building: 'quarry' })],
    INSUFFICIENT_RESOURCES: [newGame(), command('startConstruction', { building: 'townHall' })],
    NOT_IN_CONSTRUCTION: [rich, command('cancelConstruction', { building: 'farm' })],
    ALREADY_PLANNED: [planned, command('planConstruction', { building: 'farm' })],
    NOT_PLANNED: [rich, command('unplanConstruction', { building: 'farm' })],
    INVALID_QUANTITY: [rich, command('recruitVillagers', { quantity: 0 })],
    FAMINE: [starving, command('recruitVillagers', { quantity: 1 })],
    RECRUIT_QUEUE_FULL: [queued, command('recruitVillagers', { quantity: 1 })],
    HOUSING_FULL: [crowded, command('recruitVillagers', { quantity: 1 })],
    INVALID_NAME: [rich, command('renameSettlement', { name: '' })],
  };

  it.each(REJECTION_CODES)('%s', (code) => {
    const [state, order] = scenarios[code];
    const before = JSON.stringify(state);
    const refusal = refuse(state, order);
    expect(refusal.code).toBe(code);
    expect(refusal.message).toMatch(/\S.*\.$/);
    expect(JSON.stringify(state)).toBe(before);
  });

  it('toda mensagem funciona mesmo sem parâmetros', () => {
    for (const code of REJECTION_CODES) {
      expect(reject(code).message).not.toBe('');
    }
  });

  it('descreve quantidades em português', () => {
    expect(describeAmounts({ wood: 40, stone: 10 })).toBe('40 madeira e 10 pedra');
    expect(describeAmounts({ gold: 5, food: 1, wood: 2 })).toBe('1 comida, 2 madeira e 5 ouro');
    expect(describeAmounts({ gold: 7 })).toBe('7 ouro');
    expect(describeAmounts({})).toBe('');
  });
});
