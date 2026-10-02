import type { GameEvent } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import { decideNotifications, eventIcon, isEssential, isRelief, type PolicyInput } from './policy';

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

  it('essenciais: a fome e o fim dela; obras, aldeões e objetivos ficam de fora', () => {
    const result = decideNotifications(input({ level: 'essential', events: everything }));
    expect(result.show.map((entry) => entry.type)).toEqual(['famineStarted', 'famineEnded']);
    expect(result.badge).toBe(0);
  });

  it('essenciais: o frio avisa quando começa e quando passa, como a fome', () => {
    const result = decideNotifications(
      input({
        level: 'essential',
        events: [
          event('seasonChanged', 1),
          event('coldStarted', 2),
          event('constructionFinished', 3),
          event('coldEnded', 4),
        ],
      }),
    );
    expect(result.show.map((entry) => entry.type)).toEqual(['coldStarted', 'coldEnded']);
    expect(result.badge).toBe(0);
  });

  it('o começo é alarme, o fim é alívio, e o frio tem o seu próprio ícone', () => {
    expect(isEssential(event('coldStarted'))).toBe(true);
    expect(isEssential(event('famineStarted'))).toBe(true);
    // O alívio chega no mesmo nível do alarme, mas não é alarme: sai sem o tom de aviso.
    expect(isEssential(event('coldEnded'))).toBe(false);
    expect(isEssential(event('famineEnded'))).toBe(false);
    expect(isRelief(event('coldEnded'))).toBe(true);
    expect(isRelief(event('famineEnded'))).toBe(true);
    expect(isRelief(event('coldStarted'))).toBe(false);
    expect(isRelief(event('constructionFinished'))).toBe(false);

    expect(eventIcon(event('coldStarted'))).toBe('flame');
    expect(eventIcon(event('coldEnded'))).toBe('flame');
    // A fome fica com o ícone do tom: o frio não se confunde com ela.
    expect(eventIcon(event('famineStarted'))).toBeUndefined();
    expect(eventIcon(event('famineEnded'))).toBeUndefined();
  });

  it('todas: inclui obras, aldeões e objetivos, mas nunca a virada de dia', () => {
    const result = decideNotifications(input({ level: 'all', events: everything }));
    // Três por hora: o alarme, o alívio dele e a primeira das outras, na ordem em que vieram.
    expect(result.show.map((entry) => entry.type)).toEqual([
      'famineStarted',
      'famineEnded',
      'constructionFinished',
    ]);
    expect(result.badge).toBe(2);
    expect(
      decideNotifications(
        input({ level: 'all', events: everything.filter((entry) => entry.type !== 'famineEnded') }),
      ).show.map((entry) => entry.type),
    ).toEqual(['famineStarted', 'constructionFinished', 'recruitmentFinished']);
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

  it('com pouco espaço: primeiro os alarmes, depois os alívios, depois o resto', () => {
    const events = [
      event('constructionFinished', 1),
      event('coldEnded', 2),
      event('famineStarted', 3),
      event('coldStarted', 4),
    ];
    const result = decideNotifications(input({ level: 'all', events }));
    // Dentro de cada grupo vale a ordem em que as coisas aconteceram.
    expect(result.show.map((entry) => entry.type)).toEqual([
      'famineStarted',
      'coldStarted',
      'coldEnded',
    ]);
    expect(result.badge).toBe(1);
    // Com uma vaga só, quem fica é o alarme.
    const tight = decideNotifications(
      input({ level: 'essential', history: [now - 1000, now - 2000], events }),
    );
    expect(tight.show.map((entry) => entry.type)).toEqual(['famineStarted']);
    expect(tight.badge).toBe(2);
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
