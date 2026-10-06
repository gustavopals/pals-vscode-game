import { describe, expect, it } from 'vitest';

import { intentOf } from './intent';

describe('a intenção de uma ordem', () => {
  it('é o alvo, sem o valor escolhido', () => {
    expect(intentOf('setWorkers', { building: 'farm', count: 2 })).toBe(
      intentOf('setWorkers', { building: 'farm', count: 3 }),
    );
    expect(intentOf('setWorkers', { building: 'farm', count: 2 })).not.toBe(
      intentOf('setWorkers', { building: 'quarry', count: 2 }),
    );
    expect(intentOf('answerCard', { instanceId: 'masonsMeal-4', optionId: 'bread' })).toBe(
      intentOf('answerCard', { instanceId: 'masonsMeal-4', optionId: 'feast' }),
    );
    expect(intentOf('recruitVillagers', { quantity: 1 })).toBe(
      intentOf('recruitVillagers', { quantity: 5 }),
    );
  });

  it('as ordens da obra de um edifício são uma intenção só', () => {
    const farm = intentOf('startConstruction', { building: 'farm' });
    expect(intentOf('planConstruction', { building: 'farm', autoStart: true })).toBe(farm);
    expect(intentOf('cancelConstruction', { building: 'farm' })).toBe(farm);
    expect(intentOf('unplanConstruction', { building: 'farm' })).toBe(farm);
    expect(intentOf('setAutoStart', { building: 'farm', autoStart: false })).toBe(farm);
    expect(intentOf('startConstruction', { building: 'granary' })).not.toBe(farm);
    // Os trabalhadores do mesmo edifício são outra conversa.
    expect(intentOf('setWorkers', { building: 'farm', count: 1 })).not.toBe(farm);
  });

  it('cada candidato, cada herói e o festival têm a sua', () => {
    expect(intentOf('hireHero', { offerId: 'offer-1' })).not.toBe(
      intentOf('hireHero', { offerId: 'offer-2' }),
    );
    expect(intentOf('dismissHero', { heroId: 'hero-1' })).toBe('dismissHero:hero-1');
    expect(intentOf('holdFestival', {})).toBe('holdFestival');
  });
});
