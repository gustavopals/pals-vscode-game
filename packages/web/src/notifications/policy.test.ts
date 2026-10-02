import type { GameEvent } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  decideNotifications,
  eventIcon,
  isEssential,
  isRelief,
  moraleBandDirection,
  type PolicyInput,
} from './policy';

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

  it('o depósito que enche e o edifício erguido avisam em "todas"; o fecho do desperdício, nunca', () => {
    const events = [
      event('storageFilled', 1),
      event('storageWasted', 2),
      event('buildingFounded', 3),
      event('dayStarted', 4),
    ];
    const all = decideNotifications(input({ level: 'all', events }));
    expect(all.show.map((entry) => entry.type)).toEqual(['storageFilled', 'buildingFounded']);
    // Nada disso é alarme: no nível padrão não interrompe ninguém.
    expect(decideNotifications(input({ level: 'essential', events })).show).toEqual([]);
    expect(isEssential(event('storageFilled'))).toBe(false);
  });

  it('o ofício dominado é boa notícia: avisa em "todas", sem tom de alarme', () => {
    const events = [event('craftMastered', 1), event('dayStarted', 2)];
    const all = decideNotifications(input({ level: 'all', events }));
    expect(all.show.map((entry) => entry.type)).toEqual(['craftMastered']);
    expect(decideNotifications(input({ level: 'essential', events })).show).toEqual([]);
    expect(isEssential(event('craftMastered'))).toBe(false);
    expect(isRelief(event('craftMastered'))).toBe(false);
    // É uma conquista: sai com a estrela, não com o ícone de um aviso qualquer.
    expect(eventIcon(event('craftMastered'))).toBe('star-full');
  });

  it('a obra que começou sozinha avisa em "todas", como o fim de uma obra; a ordenada pelo jogador, não', () => {
    const events = [
      event('constructionStarted', 1),
      event('constructionAutoStarted', 2),
      event('constructionFinished', 3),
    ];
    const all = decideNotifications(input({ level: 'all', events }));
    expect(all.show.map((entry) => entry.type)).toEqual([
      'constructionAutoStarted',
      'constructionFinished',
    ]);
    // Não é alarme nem alívio: no nível padrão não interrompe, e não passa na frente de ninguém.
    expect(decideNotifications(input({ level: 'essential', events })).show).toEqual([]);
    expect(isEssential(event('constructionAutoStarted'))).toBe(false);
    expect(isRelief(event('constructionAutoStarted'))).toBe(false);
    expect(eventIcon(event('constructionAutoStarted'))).toBeUndefined();
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

  describe('moral e gente que chega ou se vai (GDD §5.6 e §5.7)', () => {
    /** A mudança de faixa como o servidor a manda: a moral e a faixa de antes e de agora. */
    const band = (
      seq: number,
      from: { morale: number; band: string },
      to: { morale: number; band: string },
    ): GameEvent => ({
      ...event('moraleBandChanged', seq),
      data: { ...to, previousMorale: from.morale, previousBand: from.band },
    });
    const content = { morale: 60, band: 'content' };
    const restless = { morale: 30, band: 'restless' };
    const proud = { morale: 80, band: 'proud' };
    const fell = band(1, content, restless);
    const rose = band(2, restless, content);

    it('o sentido da mudança de faixa sai dos números do evento', () => {
      expect(moraleBandDirection(fell)).toBe('fell');
      expect(moraleBandDirection(rose)).toBe('rose');
      // Sem os números, ou em outro evento, não há sentido a dizer.
      expect(moraleBandDirection(event('moraleBandChanged'))).toBeNull();
      expect(moraleBandDirection({ ...fell, type: 'dayStarted' })).toBeNull();
      expect(moraleBandDirection(band(3, content, content))).toBeNull();
    });

    it('quem parte e quem deserta são alarmes: chegam no nível padrão, com tom de aviso', () => {
      const events = [event('villagerLeft', 1), event('villagerDeserted', 2)];
      const result = decideNotifications(input({ level: 'essential', events }));
      expect(result.show.map((entry) => entry.type)).toEqual(['villagerLeft', 'villagerDeserted']);
      for (const entry of events) {
        expect(isEssential(entry)).toBe(true);
        expect(isRelief(entry)).toBe(false);
        // A perda tem ícone próprio: não se confunde com a fome que a causou.
        expect(eventIcon(entry)).toBe('sign-out');
      }
    });

    it('a moral que desce de faixa é alarme; a que sobe é o alívio dele', () => {
      expect(isEssential(fell)).toBe(true);
      expect(isRelief(fell)).toBe(false);
      expect(isEssential(rose)).toBe(false);
      expect(isRelief(rose)).toBe(true);
      // Os dois chegam no nível padrão; a queda passa na frente.
      const result = decideNotifications(input({ level: 'essential', events: [rose, fell] }));
      expect(result.show).toEqual([fell, rose]);
      // Descer de "Orgulhoso" para "Contente" também é descer.
      expect(isEssential(band(4, proud, content))).toBe(true);
      expect(isRelief(band(5, content, proud))).toBe(true);
    });

    it('a mudança de faixa leva o ícone da faixa nova, o mesmo do cabeçalho', () => {
      expect(eventIcon(fell)).toBe('comment-discussion');
      expect(eventIcon(rose)).toBe('smiley');
      expect(eventIcon(band(6, content, proud))).toBe('star-full');
      expect(eventIcon(band(7, restless, { morale: 20, band: 'desperate' }))).toBe('thumbsdown');
      // Uma faixa que o app não conhece fica com o ícone do tom.
      expect(eventIcon(band(8, content, { morale: 10, band: 'outra' }))).toBeUndefined();
    });

    it('sem o sentido, a mudança de faixa é só notícia: aparece em "todas"', () => {
      const unknown = event('moraleBandChanged', 9);
      expect(isEssential(unknown)).toBe(false);
      expect(isRelief(unknown)).toBe(false);
      expect(decideNotifications(input({ level: 'essential', events: [unknown] })).show).toEqual(
        [],
      );
      expect(decideNotifications(input({ level: 'all', events: [unknown] })).show).toEqual([
        unknown,
      ]);
    });

    it('o colono que chega sozinho é boa notícia: avisa em "todas", como um recrutado', () => {
      const settler = event('villagerArrived', 10);
      expect(isEssential(settler)).toBe(false);
      expect(isRelief(settler)).toBe(false);
      expect(eventIcon(settler)).toBe('person-add');
      expect(decideNotifications(input({ level: 'essential', events: [settler] })).show).toEqual(
        [],
      );
      expect(decideNotifications(input({ level: 'all', events: [settler] })).show).toEqual([
        settler,
      ]);
    });

    it('com pouco espaço, a fome, a queda da moral e a deserção passam na frente da boa notícia', () => {
      const events = [
        event('villagerArrived', 1),
        event('famineStarted', 2),
        band(3, content, restless),
        event('villagerDeserted', 4),
        band(5, restless, content),
      ];
      const result = decideNotifications(input({ level: 'all', events }));
      expect(result.show.map((entry) => entry.type)).toEqual([
        'famineStarted',
        'moraleBandChanged',
        'villagerDeserted',
      ]);
      expect(result.show[1]).toBe(events[2]);
      expect(result.badge).toBe(2);
    });
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
