import { describe, expect, it } from 'vitest';

import { intentOf, intentsOf } from './intent';

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

  it('as expedições: o caminho é da expedição, o envio é do destino, e o equipamento, do herói', () => {
    expect(intentOf('chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'a' })).toBe(
      intentOf('chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'b' }),
    );
    expect(
      intentOf('chooseExpeditionPath', { expeditionId: 'expedition-3', optionId: 'a' }),
    ).not.toBe(intentOf('chooseExpeditionPath', { expeditionId: 'expedition-2', optionId: 'a' }));
    expect(
      intentOf('sendExpedition', { modelId: 'patrol', heroIds: ['hero-1'], posture: 'bold' }),
    ).toBe(
      intentOf('sendExpedition', { modelId: 'patrol', heroIds: ['hero-2'], posture: 'cautious' }),
    );
    // O envio também disputa cada herói da equipe: outro destino com o mesmo herói é a mesma
    // disputa (revisão, A12); outra equipe para outro destino, não.
    const patrolRolf = intentsOf('sendExpedition', {
      modelId: 'patrol',
      heroIds: ['hero-2'],
      posture: 'bold',
    });
    const forestBoth = intentsOf('sendExpedition', {
      modelId: 'oldForest',
      heroIds: ['hero-1', 'hero-2'],
      posture: 'bold',
    });
    const forestEdda = intentsOf('sendExpedition', {
      modelId: 'oldForest',
      heroIds: ['hero-1'],
      posture: 'bold',
    });
    const shared = (a: string[], b: string[]) => a.filter((entry) => b.includes(entry));
    expect(shared(patrolRolf, forestBoth)).toEqual(['sendExpedition:hero:hero-2']);
    expect(shared(patrolRolf, forestEdda)).toEqual([]);
    expect(patrolRolf[0]).toBe(
      intentOf('sendExpedition', { modelId: 'patrol', heroIds: [], posture: 'bold' }),
    );
    // As outras ordens têm uma intenção só.
    expect(intentsOf('setWorkers', { building: 'farm', count: 2 })).toEqual(['setWorkers:farm']);
    // Equipar e desequipar mexem no mesmo herói: a ordem nova aposenta a retentativa da outra.
    expect(intentOf('equipItem', { heroId: 'hero-1', itemId: 'item-1' })).toBe(
      intentOf('unequipItem', { heroId: 'hero-1', slot: 'weapon' }),
    );
    expect(intentOf('equipItem', { heroId: 'hero-1', itemId: 'item-1' })).not.toBe(
      intentOf('equipItem', { heroId: 'hero-2', itemId: 'item-1' }),
    );
    // A dispensa do mesmo herói é outra conversa.
    expect(intentOf('dismissHero', { heroId: 'hero-1' })).not.toBe(
      intentOf('equipItem', { heroId: 'hero-1', itemId: 'item-1' }),
    );
  });
});
