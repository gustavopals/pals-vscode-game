import type { GameEvent } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { gameEvent } from '../test-helpers';
import { decideNotifications, eventIcon, isEssential, type PolicyInput } from './policy';

const input = (events: GameEvent[], overrides: Partial<PolicyInput> = {}): PolicyInput => ({
  events,
  level: 'all',
  discreetMode: false,
  mutedUntil: null,
  now: 1000,
  history: [],
  ...overrides,
});

describe('os avisos do Retorno com a guerra (V4H-T4.1)', () => {
  it.each([
    'weaponsForged',
    'soldiersTrained',
    'battleFought',
    'omenSeen',
    'hordeSabotaged',
    'hordeAlerted',
    'armyReturned',
    'yearEnded',
  ] as const)('%s informa em Todas, respeita o silêncio e não vira alarme essencial', (type) => {
    const event = gameEvent(1, type, 'Uma notícia da ausência.');
    expect(decideNotifications(input([event])).show).toEqual([event]);
    expect(decideNotifications(input([event], { level: 'essential' })).show).toEqual([]);
    expect(decideNotifications(input([event], { level: 'silent' })).show).toEqual([]);
    expect(decideNotifications(input([event], { discreetMode: true })).show).toEqual([]);
    expect(isEssential(event)).toBe(false);
  });

  it('a Crônica do Ano tem ícone próprio e respeita a cota dos informativos', () => {
    const ended = gameEvent(1, 'yearEnded');
    expect(eventIcon(ended)).toBe('book');
    const out = decideNotifications(input([ended], { history: [100, 200, 300] }));
    expect(out.show).toEqual([]);
    expect(out.badge).toBe(1);
  });

  it('a Queda continua alarme, à frente da forja e do fechamento anual', () => {
    const forge = gameEvent(1, 'weaponsForged');
    const ended = gameEvent(2, 'yearEnded');
    const fall = gameEvent(3, 'siegeFell');
    expect(decideNotifications(input([forge, ended, fall])).show).toEqual([fall, forge, ended]);
    expect(decideNotifications(input([forge, ended, fall], { level: 'essential' })).show).toEqual([
      fall,
    ]);
  });
});
