import type { GameEvent } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { decideNotifications, type PolicyInput } from './policy';

const HOUR = 3_600_000;
const now = Date.parse('2026-10-01T12:00:00.000Z');

const event = (type: GameEvent['type'], seq = 1): GameEvent => ({
  seq,
  type,
  at: '2026-10-01T12:00:00.000Z',
  atMs: 0,
  text: `${type} ${seq}`,
  data: {},
});

const input = (overrides: Partial<PolicyInput>): PolicyInput => ({
  events: [],
  level: 'essential',
  discreetMode: false,
  mutedUntil: null,
  now,
  history: [],
  ...overrides,
});

const everything: GameEvent[] = [
  event('famineStarted', 1),
  event('constructionFinished', 2),
  event('recruitmentFinished', 3),
  event('objectiveCompleted', 4),
  event('dayStarted', 5),
  event('famineEnded', 6),
];

describe('política de notificações', () => {
  it('silenciosa: nada, nem badge', () => {
    expect(decideNotifications(input({ level: 'silent', events: everything }))).toEqual({
      show: [],
      badge: 0,
      history: [],
    });
  });

  it('essenciais: na v0.1, só a fome', () => {
    const result = decideNotifications(input({ level: 'essential', events: everything }));
    expect(result.show.map((entry) => entry.type)).toEqual(['famineStarted']);
    expect(result.badge).toBe(0);
  });

  it('todas: inclui obras, aldeões e objetivos, mas nunca a virada de dia', () => {
    const result = decideNotifications(input({ level: 'all', events: everything }));
    expect(result.show.map((entry) => entry.type)).toEqual([
      'famineStarted',
      'constructionFinished',
      'recruitmentFinished',
    ]);
    expect(result.badge).toBe(1);
  });

  it('com "todas", 5 obras em uma hora geram 3 notificações e badge 2', () => {
    const works = [1, 2, 3, 4, 5].map((seq) => event('constructionFinished', seq));
    const result = decideNotifications(input({ level: 'all', events: works }));
    expect(result.show).toHaveLength(3);
    expect(result.badge).toBe(2);
    expect(result.history).toEqual([now, now, now]);
  });

  it('o limite de 3 por hora conta o que já foi exibido e se renova depois', () => {
    const history = [now - 50 * 60_000, now - 10 * 60_000];
    const works = [event('constructionFinished', 1), event('constructionFinished', 2)];
    const during = decideNotifications(input({ level: 'all', events: works, history }));
    expect(during.show).toHaveLength(1);
    expect(during.badge).toBe(1);

    const later = decideNotifications(
      input({ level: 'all', events: works, history, now: now + HOUR }),
    );
    expect(later.show).toHaveLength(2);
    expect(later.history).toHaveLength(2);
  });

  it('com pouco espaço, a fome passa na frente', () => {
    const history = [now - 1000, now - 2000];
    const result = decideNotifications(
      input({
        level: 'all',
        history,
        events: [event('constructionFinished', 1), event('famineStarted', 2)],
      }),
    );
    expect(result.show.map((entry) => entry.type)).toEqual(['famineStarted']);
    expect(result.badge).toBe(1);
  });

  it('durante o silêncio de 2 horas nada aparece e tudo vira badge', () => {
    const muted = decideNotifications(
      input({ events: [event('famineStarted')], mutedUntil: now + 60_000 }),
    );
    expect(muted).toEqual({ show: [], badge: 1, history: [] });
    const after = decideNotifications(
      input({ events: [event('famineStarted')], mutedUntil: now - 1 }),
    );
    expect(after.show).toHaveLength(1);
  });

  it('o modo discreto suprime tudo, sem badge', () => {
    const result = decideNotifications(
      input({ level: 'all', discreetMode: true, events: everything }),
    );
    expect(result).toEqual({ show: [], badge: 0, history: [] });
  });

  it('sem eventos notificáveis, só limpa o histórico vencido', () => {
    const result = decideNotifications(
      input({ events: [event('dayStarted')], history: [now - 2 * HOUR, now - 60_000] }),
    );
    expect(result).toEqual({ show: [], badge: 0, history: [now - 60_000] });
  });
});
