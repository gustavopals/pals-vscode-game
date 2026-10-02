import type { GameEvent, ViewState } from '@lotg/protocol';
import { describe, expect, it } from 'vitest';

import {
  autumnView,
  coldView,
  craftsView,
  FOOD_RUNS_OUT_AHEAD,
  initialView,
  palisadeRaisedView,
  raidAftermathView,
  threatIncomingView,
  threatWatchedView,
  withFoodAhead,
} from '../test-helpers';
import {
  decideNotice,
  decideNotifications,
  eventIcon,
  isDecision,
  isEssential,
  isRaidAlarm,
  isRaidOutcome,
  isRelief,
  isSeasonTurn,
  isWatchReport,
  moraleBandDirection,
  type PolicyInput,
  raidAftermath,
  raidAhead,
  SEASON_WARNING_SECONDS,
  seasonAhead,
  seasonArrival,
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
    // A virada de estação também chega neste nível (ver "aviso de estação", mais abaixo).
    expect(result.show.map((entry) => entry.type)).toEqual([
      'coldStarted',
      'seasonChanged',
      'coldEnded',
    ]);
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

  describe('Conselho (GDD §13.5: "carta nova" é essencial)', () => {
    const council = [
      event('cardDrawn', 1),
      event('cardAnswered', 2),
      event('cardExpired', 3),
      event('cardEffectApplied', 4),
    ];

    it('a carta nova avisa no nível padrão, sem tom de alarme e com o ícone do Conselho', () => {
      const result = decideNotifications(input({ level: 'essential', events: council }));
      expect(result.show.map((entry) => entry.type)).toEqual(['cardDrawn']);
      const drawn = event('cardDrawn');
      expect(isDecision(drawn)).toBe(true);
      expect(isEssential(drawn)).toBe(false);
      expect(isRelief(drawn)).toBe(false);
      expect(eventIcon(drawn)).toBe('law');
    });

    it('a resposta do próprio jogador nunca avisa', () => {
      for (const level of ['essential', 'all'] as const) {
        const shown = decideNotifications(input({ level, events: council })).show;
        expect(shown.map((entry) => entry.type)).not.toContain('cardAnswered');
      }
    });

    it('a carta que expirou e o efeito que veio depois são notícia em "todas"', () => {
      const result = decideNotifications(input({ level: 'all', events: council }));
      expect(result.show.map((entry) => entry.type)).toEqual([
        'cardDrawn',
        'cardExpired',
        'cardEffectApplied',
      ]);
      expect(eventIcon(event('cardExpired'))).toBe('law');
      expect(eventIcon(event('cardEffectApplied'))).toBe('law');
      expect(isDecision(event('cardExpired'))).toBe(false);
    });

    it('nos níveis silencioso e discreto, nada', () => {
      expect(decideNotifications(input({ level: 'silent', events: council })).show).toEqual([]);
      expect(
        decideNotifications(input({ level: 'all', discreetMode: true, events: council })),
      ).toMatchObject({ show: [], badge: 0 });
    });

    it('a carta nova nunca vira badge de novidade: quem a conta é a decisão pendente', () => {
      // Durante o silêncio de 2 horas, a obra vira badge e a carta, não.
      const muted = decideNotifications(
        input({
          level: 'all',
          mutedUntil: now + HOUR,
          events: [event('cardDrawn', 1), event('constructionFinished', 2)],
        }),
      );
      expect(muted).toMatchObject({ show: [], badge: 1 });
      // Com as três da hora já exibidas, o mesmo.
      const full = decideNotifications(
        input({
          level: 'all',
          history: [now - 1000, now - 2000, now - 3000],
          events: [event('cardDrawn', 1), event('constructionFinished', 2)],
        }),
      );
      expect(full).toMatchObject({ show: [], badge: 1 });
      expect(
        decideNotifications(
          input({ history: [now - 1000, now - 2000, now - 3000], events: [event('cardDrawn')] }),
        ).badge,
      ).toBe(0);
    });

    it('com pouco espaço: o alarme, depois a carta nova, depois o resto', () => {
      const result = decideNotifications(
        input({
          level: 'all',
          history: [now - 1000],
          events: [
            event('constructionFinished', 1),
            event('cardDrawn', 2),
            event('famineStarted', 3),
          ],
        }),
      );
      expect(result.show.map((entry) => entry.type)).toEqual(['famineStarted', 'cardDrawn']);
      expect(result.badge).toBe(1);
    });
  });

  describe('o relato dos vigias (GDD §8.2): a Ameaça cruzou uma marca', () => {
    const rose: GameEvent = {
      ...event('threatRose', 9),
      text: 'No 9º dia da Primavera, os vigias de Pedra Alta contam mais uivos a cada noite. A Ameaça chegou a 40.',
      data: { threat: 40, previousThreat: 35, mark: 40 },
    };

    it('avisa no nível padrão, sem tom de alarme, com o olho da Ameaça', () => {
      expect(isWatchReport(rose)).toBe(true);
      expect(isEssential(rose)).toBe(false);
      expect(isRelief(rose)).toBe(false);
      expect(isDecision(rose)).toBe(false);
      expect(eventIcon(rose)).toBe('eye');
      for (const level of ['essential', 'all'] as const) {
        expect(decideNotifications(input({ level, events: [rose] })).show).toEqual([rose]);
      }
    });

    it('no nível silencioso e no modo discreto, nada; no silêncio de 2 horas, vira contador', () => {
      expect(decideNotifications(input({ level: 'silent', events: [rose] }))).toMatchObject({
        show: [],
        badge: 0,
      });
      expect(decideNotifications(input({ discreetMode: true, events: [rose] }))).toMatchObject({
        show: [],
        badge: 0,
      });
      expect(decideNotifications(input({ mutedUntil: now + HOUR, events: [rose] }))).toMatchObject({
        show: [],
        badge: 1,
      });
    });

    it('com pouco espaço: o alarme na frente, o relato dos vigias antes do resto', () => {
      const events = [event('constructionFinished', 1), rose, event('famineStarted', 10)];
      const result = decideNotifications(input({ level: 'all', events, history: [now - 1000] }));
      expect(result.show.map((entry) => entry.type)).toEqual(['famineStarted', 'threatRose']);
      expect(result.badge).toBe(1);
    });

    it('os outros eventos não são relato dos vigias', () => {
      for (const type of ['famineStarted', 'seasonChanged', 'cardDrawn', 'dayStarted'] as const) {
        expect(isWatchReport(event(type))).toBe(false);
      }
    });
  });

  describe('a incursão (GDD §8.2 e §13.5): os uivos, o alarme dos vigias e o desfecho', () => {
    const howl = (watched: 0 | 1): GameEvent => ({
      ...event('wolvesHowl', 20),
      text: 'No 10º dia da Primavera, ouviram-se uivos na mata ao redor de Pedra Alta. Sem quem vigie, ninguém sabe quantos são.',
      data: { enemy: 'wolves', watched },
    });
    const announced: GameEvent = {
      ...event('raidAnnounced', 30),
      text: 'No 15º dia da Primavera, os vigias de Pedra Alta deram o alarme: lobos a caminho. Contam uma matilha pequena.',
      data: { raidId: 'wolvesYear1', enemy: 'wolves', warning: 'sized', size: 'light' },
    };
    const suffered: GameEvent = {
      ...event('raidSuffered', 40),
      text: 'No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Nada os deteve: o ataque custou 30 de comida, 12 de madeira e um aldeão ferido. Uma paliçada os teria detido.',
      data: {
        raidId: 'wolvesYear1',
        enemy: 'wolves',
        size: 'light',
        warning: 'unwarned',
        palisadeLevel: 0,
        injured: 1,
        raided_food: 30,
        raided_wood: 12,
        palisadeLevelNeeded: 1,
      },
    };
    const repelled: GameEvent = {
      ...event('raidRepelled', 41),
      text: 'No 16º dia da Primavera, os lobos chegaram a Pedra Alta sem que ninguém os visse vir. Recuaram diante da paliçada: nada se perdeu e ninguém se feriu.',
      data: {
        raidId: 'wolvesYear1',
        enemy: 'wolves',
        size: 'light',
        warning: 'unwarned',
        palisadeLevel: 1,
      },
    };
    const injured: GameEvent = {
      ...event('villagerInjured', 42),
      data: { raidId: 'wolvesYear1', injured: 1, building: 'lumberMill' },
    };
    const recovered: GameEvent = {
      ...event('villagerRecovered', 50),
      data: { injured: 0, building: 'lumberMill' },
    };

    it('o alarme dos vigias e o ataque sofrido são alarmes: nível padrão, tom de aviso, o ícone da incursão', () => {
      for (const raid of [announced, suffered]) {
        expect(isEssential(raid)).toBe(true);
        expect(isRelief(raid)).toBe(false);
        expect(eventIcon(raid)).toBe('megaphone');
        for (const level of ['essential', 'all'] as const) {
          expect(decideNotifications(input({ level, events: [raid] })).show).toEqual([raid]);
        }
      }
      expect(isRaidAlarm(announced)).toBe(true);
      expect(isRaidAlarm(suffered)).toBe(false);
      expect(isRaidOutcome(suffered)).toBe(true);
      expect(isRaidOutcome(announced)).toBe(false);
    });

    it('o ataque que a paliçada deteve é o alívio: mesmo nível, sem tom de alarme, com o escudo', () => {
      expect(isRelief(repelled)).toBe(true);
      expect(isEssential(repelled)).toBe(false);
      expect(isRaidOutcome(repelled)).toBe(true);
      expect(eventIcon(repelled)).toBe('shield');
      expect(decideNotifications(input({ events: [repelled] })).show).toEqual([repelled]);
    });

    it('os uivos são um prenúncio: nível padrão, sem alarme, com o olho de quem tem ou não tem vigias', () => {
      for (const watched of [0, 1] as const) {
        const heard = howl(watched);
        expect(isWatchReport(heard)).toBe(true);
        expect(isEssential(heard)).toBe(false);
        expect(isRelief(heard)).toBe(false);
        expect(decideNotifications(input({ events: [heard] })).show).toEqual([heard]);
      }
      expect(eventIcon(howl(0))).toBe('eye-closed');
      expect(eventIcon(howl(1))).toBe('eye');
    });

    it('quem se fere e quem sara não vira aviso: o ataque já contou, e o painel mostra', () => {
      for (const level of ['essential', 'all'] as const) {
        expect(decideNotifications(input({ level, events: [injured, recovered] }))).toMatchObject({
          show: [],
          badge: 0,
        });
      }
    });

    it('no nível silencioso e no modo discreto, nada; no silêncio de 2 horas, vira contador', () => {
      const events = [howl(1), announced];
      expect(decideNotifications(input({ level: 'silent', events }))).toMatchObject({
        show: [],
        badge: 0,
      });
      expect(decideNotifications(input({ discreetMode: true, events }))).toMatchObject({
        show: [],
        badge: 0,
      });
      expect(decideNotifications(input({ mutedUntil: now + HOUR, events }))).toMatchObject({
        show: [],
        badge: 2,
      });
    });

    it('o alarme de uma incursão que o mesmo lote já resolve não sai: quem fala é o desfecho', () => {
      // A aba ficou ao fundo e leu tarde: o aviso e o ataque chegam juntos.
      for (const outcome of [suffered, repelled]) {
        const result = decideNotifications(input({ events: [announced, outcome] }));
        expect(result.show).toEqual([outcome]);
        expect(result.badge).toBe(0);
      }
      // O alarme de outra incursão, ainda a caminho, continua valendo.
      const other = { ...announced, data: { ...announced.data, raidId: 'threat-9' } };
      expect(
        decideNotifications(input({ events: [other, suffered] })).show.map((entry) => entry.type),
      ).toEqual(['raidAnnounced', 'raidSuffered']);
    });

    it('com pouco espaço: os alarmes da incursão na frente, os uivos e o alívio antes do resto', () => {
      // O alarme é de outra incursão, ainda a caminho: a que recuou já passou.
      const other = { ...announced, data: { ...announced.data, raidId: 'threat-9' } };
      const events = [event('constructionFinished', 1), howl(0), repelled, other];
      const result = decideNotifications(input({ level: 'all', events, history: [now - 1000] }));
      expect(result.show.map((entry) => entry.type)).toEqual(['raidAnnounced', 'wolvesHowl']);
      expect(result.badge).toBe(2);
    });

    describe('o que o alarme diz além da frase da Crônica', () => {
      it('quando o ataque chega, com a hora do relógio, o que ele custa e o que a Paliçada faz a ele', () => {
        expect(
          raidAhead(threatIncomingView, { now: Date.UTC(2026, 9, 2, 20, 0), timeZone: 'UTC' }),
        ).toEqual([
          'Chegada em 16 min, às 20:15.',
          'Sem defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 75 de comida e 65,9 de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar.',
          'Sem Paliçada, nada segura este ataque.',
        ]);
        // No fuso de quem joga.
        expect(
          raidAhead(threatIncomingView, {
            now: Date.UTC(2026, 9, 2, 20, 0),
            timeZone: 'America/Sao_Paulo',
          })[0],
        ).toBe('Chegada em 16 min, às 17:15.');
        // Sem o relógio, só o prazo.
        expect(raidAhead(threatIncomingView)[0]).toBe('Chegada em 16 min.');
        expect(raidAhead(palisadeRaisedView)[2]).toBe(
          'A Paliçada Nv1 não segura um ataque deste tamanho: ele passa, mas com metade do estrago.',
        );
      });

      it('sem incursão à vista na visão (ou sem visão), nada: o app não inventa prazo', () => {
        expect(raidAhead(threatWatchedView)).toEqual([]);
        expect(raidAhead(initialView)).toEqual([]);
        expect(raidAhead(null)).toEqual([]);
      });
    });

    it('o ataque sofrido diz quem ficou ferido e quando sara, na frase do servidor', () => {
      expect(raidAftermath(raidAftermathView)).toEqual([
        '2 aldeões feridos na incursão: não trabalham até sarar. Saram em 20 min; quem tinha ofício volta a ele sozinho.',
      ]);
      expect(raidAftermath(threatWatchedView)).toEqual([]);
      expect(raidAftermath(null)).toEqual([]);
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
  describe('aviso de estação (GDD §13.5)', () => {
    const turn = (season: string, seq = 1): GameEvent => ({
      ...event('seasonChanged', seq),
      text: 'Chega o Inverno a Pedra Alta.',
      data: { season },
    });
    /** O outono do golden, com a virada para o inverno a `seconds` de distância. */
    const autumnAt = (seconds: number): ViewState => ({
      ...autumnView,
      calendar: {
        ...autumnView.calendar,
        secondsToNextSeason: seconds,
        nextSeason: { ...autumnView.calendar.nextSeason, secondsUntil: seconds },
      },
    });

    describe('uma hora antes', () => {
      it('a mais de uma hora da virada, nada', () => {
        expect(seasonAhead(autumnAt(SEASON_WARNING_SECONDS + 1))).toBeNull();
        // O golden está a quatro horas do inverno.
        expect(seasonAhead(autumnView)).toBeNull();
        expect(seasonAhead(initialView)).toBeNull();
      });

      it('a uma hora ou menos: a estação, o prazo e uma frase para cada coisa que muda', () => {
        const notice = seasonAhead(autumnAt(SEASON_WARNING_SECONDS));
        expect(notice?.text).toBe('Inverno à vista: chega em 1 h.');
        // As frases são as do servidor, na ordem dele.
        expect(notice?.details.slice(0, 5)).toEqual(autumnView.calendar.nextSeason.changes);
        expect(notice?.details[0]).toBe('A produção de comida passa de × 1,3 para × 0,4.');
        expect(seasonAhead(autumnAt(25 * 60))?.text).toBe('Inverno à vista: chega em 25 min.');
      });

      it('com o instante e o fuso, diz também a hora do relógio em que a estação vira', () => {
        // O aviso fica na tela até ser dispensado: "em 25 min" envelhece, a hora não.
        const at = (timeZone: string) => seasonAhead(autumnAt(25 * 60), { now, timeZone })?.text;
        expect(at('UTC')).toBe('Inverno à vista: chega em 25 min, às 12:25.');
        expect(at('America/Sao_Paulo')).toBe('Inverno à vista: chega em 25 min, às 09:25.');
        // A virada depois da meia-noite.
        expect(
          seasonAhead(autumnAt(3600), { now: now + 11 * HOUR + 30 * 60_000, timeZone: 'UTC' })
            ?.text,
        ).toBe('Inverno à vista: chega em 1 h, às 00:30.');
        // Um fuso que o navegador não conhece não derruba o aviso: sai sem a hora.
        expect(at('Lua/Mar da Tranquilidade')).toBe('Inverno à vista: chega em 25 min.');
      });

      it('com lenha que não chega, o aviso ganha tom de alerta e a conta do servidor', () => {
        const notice = seasonAhead(autumnAt(1800));
        expect(notice?.kind).toBe('warning');
        expect(notice?.details.at(-1)).toBe(
          'O Inverno vai queimar 216 de madeira com 18 habitantes. A Serraria repõe 0 e há 60 em estoque: faltam 156 de madeira.',
        );
        expect(notice?.details).toHaveLength(6);
      });

      it('com lenha que basta, ou em estação que não queima lenha, é só notícia', () => {
        const enough: ViewState = {
          ...craftsView,
          calendar: {
            ...craftsView.calendar,
            nextSeason: { ...craftsView.calendar.nextSeason, secondsUntil: 600 },
          },
        };
        const notice = seasonAhead(enough);
        expect(notice?.kind).toBe('info');
        expect(notice?.details).toEqual(craftsView.calendar.nextSeason.changes);
        const spring: ViewState = {
          ...coldView,
          calendar: {
            ...coldView.calendar,
            nextSeason: { ...coldView.calendar.nextSeason, secondsUntil: 3000 },
          },
        };
        expect(seasonAhead(spring)).toMatchObject({
          kind: 'info',
          text: 'Primavera à vista: chega em 50 min.',
          details: coldView.calendar.nextSeason.changes,
        });
      });

      it('com comida que acaba na estação que vem, o aviso é de alerta e traz a conta do servidor', () => {
        // Lenha que basta e comida que não: o alerta é só o da comida.
        const fed = withFoodAhead(craftsView, FOOD_RUNS_OUT_AHEAD, 600);
        const notice = seasonAhead(fed);
        expect(notice?.kind).toBe('warning');
        expect(notice?.details).toEqual([
          ...craftsView.calendar.nextSeason.changes,
          FOOD_RUNS_OUT_AHEAD.text,
        ]);
        // As duas contas, a da lenha antes da da comida.
        const both = seasonAhead(withFoodAhead(autumnAt(1800), FOOD_RUNS_OUT_AHEAD, 1800));
        expect(both?.kind).toBe('warning');
        expect(both?.details.slice(-2)).toEqual([
          autumnView.calendar.nextSeason.firewood?.text,
          FOOD_RUNS_OUT_AHEAD.text,
        ]);
        // A comida que atravessa a estação não pede ação: o aviso não muda.
        const lasting = seasonAhead(
          withFoodAhead(fed, { ...FOOD_RUNS_OUT_AHEAD, depletesInSeconds: null }, 600),
        );
        expect(lasting?.kind).toBe('info');
        expect(lasting?.details).toEqual(craftsView.calendar.nextSeason.changes);
      });

      it('não prevê sorteio nem promete proteção: só o que o servidor escreveu', () => {
        const notice = seasonAhead(autumnAt(1800));
        const said = [notice?.text, ...(notice?.details ?? [])].join(' ');
        expect(said).not.toMatch(/sorte|chance|talvez|proteg|garant|a salvo/i);
      });

      it('a chave diz o ano e a estação anunciada: um aviso por virada', () => {
        expect(seasonAhead(autumnAt(1800))?.key).toBe('1:winter');
        expect(seasonAhead(autumnAt(60))?.key).toBe('1:winter');
        const nextYear: ViewState = {
          ...autumnAt(1800),
          calendar: { ...autumnAt(1800).calendar, year: 2 },
        };
        expect(seasonAhead(nextYear)?.key).toBe('2:winter');
      });
    });

    describe('o aviso avulso (o de uma hora antes) segue a mesma política dos eventos', () => {
      // Os mesmos dados da política dos eventos; a lista de eventos, vazia, não entra na conta.
      const state = (overrides: Partial<PolicyInput> = {}) => input(overrides);

      it('é essencial: aparece no nível padrão e em "todas"', () => {
        expect(decideNotice(state())).toEqual({ outcome: 'show', history: [now] });
        expect(decideNotice(state({ level: 'all' })).outcome).toBe('show');
      });

      it('no nível silencioso e no modo discreto, nada, nem contador', () => {
        expect(decideNotice(state({ level: 'silent' }))).toEqual({ outcome: 'skip', history: [] });
        expect(decideNotice(state({ discreetMode: true })).outcome).toBe('skip');
      });

      it('durante o silêncio de 2 horas vira contador', () => {
        expect(decideNotice(state({ mutedUntil: now + 60_000 }))).toEqual({
          outcome: 'badge',
          history: [],
        });
      });

      it('conta no limite de 3 por hora, e o excedente vira contador', () => {
        const full = [now - 1000, now - 2000, now - 3000];
        expect(decideNotice(state({ history: full }))).toEqual({ outcome: 'badge', history: full });
        const old = [now - HOUR - 1, now - 1000];
        expect(decideNotice(state({ history: old }))).toEqual({
          outcome: 'show',
          history: [now - 1000, now],
        });
      });
    });

    describe('na virada', () => {
      it('a virada de estação é notícia para todos, sem tom de alarme, com o ícone do calendário', () => {
        const arrival = turn('winter');
        expect(isSeasonTurn(arrival)).toBe(true);
        expect(isEssential(arrival)).toBe(false);
        expect(eventIcon(arrival)).toBe('calendar');
        const result = decideNotifications(input({ level: 'essential', events: [arrival] }));
        expect(result.show).toEqual([arrival]);
        expect(decideNotifications(input({ level: 'silent', events: [arrival] })).show).toEqual([]);
      });

      it('com pouco espaço, o alarme passa na frente da virada, e a virada, do resto', () => {
        const events = [
          event('constructionFinished', 1),
          turn('winter', 2),
          event('coldStarted', 3),
        ];
        const result = decideNotifications(input({ level: 'all', events, history: [now - 1000] }));
        expect(result.show.map((entry) => entry.type)).toEqual(['coldStarted', 'seasonChanged']);
        expect(result.badge).toBe(1);
      });

      it('só avisa da estação que está valendo: a que já passou não é novidade', () => {
        // Um salto longo com a aba ao fundo traz duas viradas de uma vez.
        const events = [turn('summer', 1), turn('autumn', 2)];
        const result = decideNotifications(input({ level: 'essential', events, season: 'autumn' }));
        expect(result.show).toEqual([events[1]]);
        expect(result.badge).toBe(0);
        // Sem saber a estação de agora, as duas passam.
        expect(decideNotifications(input({ events })).show).toHaveLength(2);
      });

      it('repete as frases do que muda, guardadas de quando a estação ainda era a próxima', () => {
        const remembered = autumnView.calendar.nextSeason.changes;
        expect(seasonArrival(turn('winter'), remembered, coldView)).toEqual(remembered);
      });

      it('sem as frases guardadas, diz o que a estação de agora muda', () => {
        expect(seasonArrival(turn('winter'), undefined, coldView)).toEqual([
          coldView.calendar.seasonEffects,
        ]);
        expect(coldView.calendar.seasonEffects).toMatch(/^Inverno: comida × 0,4/);
        // Se a visão já é de outra estação, o aviso fica só com a frase da Crônica.
        expect(seasonArrival(turn('winter'), undefined, autumnView)).toEqual([]);
        expect(seasonArrival(turn('winter'), undefined, null)).toEqual([]);
      });
    });
  });
});
