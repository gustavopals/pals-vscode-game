import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  CHRONICLE_PLACEHOLDERS,
  chronicleTemplates,
  COUNCIL_EFFECT_TYPES,
  type CouncilCard,
  councilCards,
  type CouncilEffect,
  DIFFICULTY_IDS,
} from './index';
import { BalanceSchema, CouncilCardSchema, CouncilCatalogSchema } from './schemas';

const HOUR_MS = 3_600_000;

const card = (id: string): CouncilCard => {
  const found = councilCards.find((entry) => entry.id === id);
  if (found === undefined) {
    throw new Error(`Falta a carta ${id}.`);
  }
  return found;
};

const effectsOf = (entry: CouncilCard): CouncilEffect[] =>
  entry.options.flatMap((option) => [...option.effects, ...(option.hidden?.effects ?? [])]);

/** Todas as frases que uma carta põe na tela ou na Crônica. */
const textsOf = (entry: CouncilCard): string[] => [
  entry.title,
  entry.text,
  entry.arrival ?? '',
  ...(entry.variants ?? []).flatMap((variant) => [variant.text, variant.arrival ?? '']),
  ...entry.options.flatMap((option) => [
    option.label,
    option.hint,
    option.chronicle,
    option.expiredChronicle ?? '',
    option.hidden?.chronicle ?? '',
  ]),
];

/** Uma carta mínima e válida, para os testes do schema estragarem um campo de cada vez. */
const sample: CouncilCard = {
  id: 'sample',
  title: 'Uma carta de teste',
  text: 'Alguém bate à porta do salão. O conselho quer saber o que fazer.',
  weight: 1,
  autoResolve: { peasant: 'wait', lord: 'wait', ironKing: 'wait' },
  options: [
    {
      id: 'open',
      label: 'Abrir a porta',
      cost: { gold: 10 },
      effects: [{ type: 'morale', amount: 5, durationDays: 1 }],
      hint: 'Quem bate pode trazer notícia.',
      chronicle: 'No {dia}º dia {daEstacao}, o senhor de {feudo} abriu a porta.',
    },
    {
      id: 'wait',
      label: 'Esperar',
      effects: [],
      hint: 'Quem espera não gasta.',
      chronicle: 'No {dia}º dia {daEstacao}, o senhor de {feudo} esperou.',
    },
  ],
};

const parses = (changed: object) => CouncilCardSchema.safeParse({ ...sample, ...changed }).success;
const withOption = (changed: object) =>
  parses({ options: [{ ...sample.options[0], ...changed }, sample.options[1]] });

describe('Conselho: os números (GDD §7.1; ADR 0014, decisões 1 e 18)', () => {
  it('um sorteio a cada 4 dias de jogo, no máximo 2 pendentes e 24 h reais para responder', () => {
    expect(balance.council).toEqual({
      drawIntervalDays: 4,
      maxPending: 2,
      expiryRealMs: 24 * HOUR_MS,
    });
  });

  it('a cadência dá 8 h reais no ritmo Normal e 2 h 40 no Rápido, como o GDD promete', () => {
    const intervalMs = balance.council.drawIntervalDays * balance.calendar.dayMs;
    const real = (timeScale: number) => intervalMs / timeScale;
    expect(real(1)).toBe(8 * HOUR_MS);
    expect(real(3)).toBe(2 * HOUR_MS + 40 * 60_000);
  });

  it('em todo ritmo oferecido o prazo de resposta vira um número inteiro de ms de jogo', () => {
    for (const pace of balance.paces) {
      const gameMs = balance.council.expiryRealMs * pace.timeScale;
      expect(Number.isInteger(gameMs), pace.label).toBe(true);
      // E nunca vence antes do sorteio seguinte: há sempre ao menos uma audiência de folga.
      expect(gameMs).toBeGreaterThan(balance.council.drawIntervalDays * balance.calendar.dayMs);
    }
  });

  it('o ano tem um número inteiro de audiências: a cadência de uma partida nova cai na virada do ano', () => {
    const days = balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0);
    expect(days % balance.council.drawIntervalDays).toBe(0);
  });

  it('o schema recusa cadência zero, limite zero e prazo ausente', () => {
    const parse = (council: object) =>
      BalanceSchema.safeParse({ ...balance, council: { ...balance.council, ...council } }).success;
    expect(parse({})).toBe(true);
    expect(parse({ drawIntervalDays: 0 })).toBe(false);
    expect(parse({ maxPending: 0 })).toBe(false);
    expect(parse({ expiryRealMs: undefined })).toBe(false);
    expect(parse({ expiryMs: 1 })).toBe(false);
  });
});

describe('Conselho: o catálogo', () => {
  it('passa pelo schema, carta a carta e inteiro', () => {
    for (const entry of councilCards) {
      expect(CouncilCardSchema.safeParse(entry).error, entry.id).toBeUndefined();
    }
    expect(CouncilCatalogSchema.safeParse(councilCards).error).toBeUndefined();
  });

  it('tem a cadeia "O Celeiro Comum" inteira e duas avulsas, nesta ordem', () => {
    expect(councilCards.map((entry) => [entry.id, entry.title])).toEqual([
      ['commonGranaryPlanks', 'Tábuas para as reservas'],
      ['commonGranaryShare', 'A vez de repartir'],
      ['commonGranaryOutcome', 'O que ficou da escolha'],
      ['collapsedWell', 'O poço entulhado'],
      ['masonsMeal', 'A refeição dos pedreiros'],
    ]);
  });

  it('ids únicos, e toda opção com id único dentro da carta', () => {
    const ids = councilCards.map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const entry of councilCards) {
      const options = entry.options.map((option) => option.id);
      expect(new Set(options).size, entry.id).toBe(options.length);
    }
  });

  it('as três opções automáticas de cada carta existem e não têm custo nem requisito', () => {
    for (const entry of councilCards) {
      expect(Object.keys(entry.autoResolve)).toEqual([...DIFFICULTY_IDS]);
      for (const difficulty of DIFFICULTY_IDS) {
        const option = entry.options.find(
          (candidate) => candidate.id === entry.autoResolve[difficulty],
        );
        expect(option, `${entry.id}/${difficulty}`).toBeDefined();
        expect(option?.cost, `${entry.id}/${difficulty}`).toBeUndefined();
        expect(option?.requires, `${entry.id}/${difficulty}`).toBeUndefined();
      }
    }
  });

  it('ao menos uma carta decide diferente conforme a dificuldade', () => {
    expect(councilCards.some((entry) => new Set(Object.values(entry.autoResolve)).size > 1)).toBe(
      true,
    );
  });

  it('toda flag exigida, proibida, lembrada ou apagada tem quem a grave', () => {
    const written = new Set(
      councilCards
        .flatMap(effectsOf)
        .flatMap((effect) => (effect.type === 'setFlag' ? [effect.flag] : [])),
    );
    for (const entry of councilCards) {
      const read = [
        ...(entry.requires?.flags ?? []),
        ...(entry.requires?.notFlags ?? []),
        ...(entry.variants ?? []).map((variant) => variant.flag),
        ...effectsOf(entry).flatMap((effect) => (effect.type === 'clearFlag' ? [effect.flag] : [])),
      ];
      for (const flag of read) {
        expect(written, `${entry.id}: ${flag}`).toContain(flag);
      }
    }
  });

  it('toda continuação aponta para uma carta que existe, e toda carta sem peso tem quem a agende', () => {
    const ids = councilCards.map((entry) => entry.id);
    const scheduled = councilCards
      .flatMap(effectsOf)
      .flatMap((effect) => (effect.type === 'scheduleCard' ? [effect.cardId] : []));
    for (const target of scheduled) {
      expect(ids).toContain(target);
    }
    for (const entry of councilCards.filter((candidate) => candidate.weight === 0)) {
      expect(scheduled, entry.id).toContain(entry.id);
    }
    // E o sorteio tem o que tirar em um feudo recém-fundado: cartas com peso e sem requisito.
    expect(
      councilCards.filter((entry) => entry.weight > 0 && entry.requires === undefined).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it('só usa o que a v0.2 tem: os cinco efeitos, os edifícios que existem e nenhuma carta roteirizada', () => {
    for (const entry of councilCards) {
      for (const effect of effectsOf(entry)) {
        expect(COUNCIL_EFFECT_TYPES).toContain(effect.type);
      }
      for (const building of Object.keys(entry.requires?.buildings ?? {})) {
        expect(BUILDING_IDS).toContain(building);
      }
      // ADR 0014, decisão 8: a carta que entrega o herói fica para a v0.3.
      expect(entry.scripted, entry.id).toBeUndefined();
    }
  });

  it('nenhum texto fala de herói, Mercado, ferro, exército ou combate', () => {
    const future = /\b(her[óo]i|her[óo]is|mercado|ferro|ex[ée]rcito|combate|batalha|soldado)/iu;
    for (const entry of councilCards) {
      for (const text of textsOf(entry)) {
        expect(text, entry.id).not.toMatch(future);
      }
    }
  });

  it('a situação tem de 2 a 4 frases, e as variantes também', () => {
    const sentences = (text: string) => text.split(/[.!?]+(?:\s+|$)/u).filter(Boolean).length;
    for (const entry of councilCards) {
      for (const text of [entry.text, ...(entry.variants ?? []).map((variant) => variant.text)]) {
        expect(sentences(text), entry.id).toBeGreaterThanOrEqual(2);
        expect(sentences(text), entry.id).toBeLessThanOrEqual(4);
      }
    }
  });

  it('as opções são verbos no infinitivo e não repetem o número do custo', () => {
    for (const entry of councilCards) {
      for (const option of entry.options) {
        expect(option.label, entry.id).toMatch(/^\p{Lu}\p{Ll}*(ar|er|ir|or|ôr)(\s|$)/u);
        expect(option.label, entry.id).not.toMatch(/\d/);
      }
    }
  });

  it('toda opção traz a pista e a frase da escolha; o efeito escondido traz a dele', () => {
    const placeholders: readonly string[] = CHRONICLE_PLACEHOLDERS;
    for (const entry of councilCards) {
      for (const option of entry.options) {
        expect(option.hint.trim(), `${entry.id}/${option.id}`).not.toBe('');
        const phrases = [
          option.chronicle,
          option.expiredChronicle,
          option.hidden?.chronicle,
          entry.arrival,
          ...(entry.variants ?? []).map((variant) => variant.arrival),
        ].filter((phrase): phrase is string => phrase !== undefined);
        for (const phrase of phrases) {
          // Datada, no lugar certo, e só com marcadores que o motor sabe preencher.
          expect(phrase, `${entry.id}/${option.id}`).toMatch(/^No \{dia\}º dia \{daEstacao\}, /);
          expect(phrase).toContain('{feudo}');
          for (const [, name] of phrase.matchAll(/\{([^}]*)\}/g)) {
            expect(placeholders).toContain(name);
          }
        }
      }
    }
  });

  it('a opção que o conselho aplica sozinho, quando muda algo, diz na Crônica que foi ele', () => {
    for (const entry of councilCards) {
      for (const id of new Set(Object.values(entry.autoResolve))) {
        const option = entry.options.find((candidate) => candidate.id === id);
        const changes = (option?.effects ?? []).some(
          (effect) => effect.type === 'resources' || effect.type === 'morale',
        );
        if (changes) {
          expect(option?.expiredChronicle, `${entry.id}/${id}`).toBeDefined();
        }
      }
    }
  });

  it('a chegada de uma continuação cita a carta, para a Crônica ligar as duas', () => {
    for (const entry of councilCards) {
      for (const variant of entry.variants ?? []) {
        expect(variant.arrival ?? chronicleTemplates.cardDrawn, entry.id).toContain('{carta}');
      }
    }
  });
});

describe('Conselho: "O Celeiro Comum"', () => {
  it('só a primeira carta é sorteada, com o Celeiro erguido e a cadeia fechada', () => {
    expect(card('commonGranaryPlanks').weight).toBeGreaterThan(0);
    expect(card('commonGranaryPlanks').requires).toEqual({
      buildings: { granary: 1 },
      notFlags: ['commonGranary.open'],
    });
    expect(card('commonGranaryShare').weight).toBe(0);
    expect(card('commonGranaryOutcome').weight).toBe(0);
  });

  it('aceitar leva à segunda carta em 3 dias, por dois caminhos; recusar encerra o ramo', () => {
    const [cede, pay, keep] = card('commonGranaryPlanks').options;
    for (const option of [cede, pay]) {
      expect(option?.effects).toContainEqual({
        type: 'scheduleCard',
        cardId: 'commonGranaryShare',
        afterDays: 3,
      });
      expect(option?.effects).toContainEqual({ type: 'setFlag', flag: 'commonGranary.open' });
      expect(option?.effects).toContainEqual({ type: 'morale', amount: 5, durationDays: 2 });
    }
    expect(cede?.cost).toEqual({ wood: 40 });
    expect(pay?.cost).toEqual({ gold: 30 });
    expect(keep?.effects).toEqual([]);
    expect(keep?.cost).toBeUndefined();
  });

  it('a segunda carta leva ao desfecho pelos dois ramos, e a variante lembra quem pagou o quê', () => {
    const share = card('commonGranaryShare');
    for (const option of share.options) {
      expect(option.effects).toContainEqual({
        type: 'scheduleCard',
        cardId: 'commonGranaryOutcome',
        afterDays: 3,
      });
    }
    expect(share.options.map((option) => option.cost)).toEqual([{ food: 30 }, undefined]);
    expect(share.variants?.map((variant) => variant.flag)).toEqual([
      'commonGranary.supported',
      'commonGranary.paid',
    ]);
  });

  it('o desfecho fecha a cadeia nos dois ramos: apaga o que ficou no caminho e grava o fim', () => {
    const outcome = card('commonGranaryOutcome');
    expect(outcome.variants?.map((variant) => variant.flag)).toEqual([
      'commonGranary.shared',
      'commonGranary.reserved',
    ]);
    for (const option of outcome.options) {
      const cleared = option.effects.flatMap((effect) =>
        effect.type === 'clearFlag' ? [effect.flag] : [],
      );
      expect(cleared).toEqual([
        'commonGranary.open',
        'commonGranary.supported',
        'commonGranary.paid',
        'commonGranary.shared',
        'commonGranary.reserved',
      ]);
      expect(option.cost).toBeUndefined();
      expect(option.effects.some((effect) => effect.type === 'scheduleCard')).toBe(false);
    }
    expect(outcome.options[0]?.effects[0]).toEqual({ type: 'resources', amounts: { food: 40 } });
  });
});

describe('Conselho: o schema de uma carta', () => {
  it('aceita a carta de exemplo', () => {
    expect(CouncilCardSchema.safeParse(sample).error).toBeUndefined();
  });

  it('recusa carta com uma opção só, com quatro, com ids repetidos ou com campo a mais', () => {
    const [open, wait] = sample.options;
    expect(parses({ options: [wait] })).toBe(false);
    expect(parses({ options: [open, wait, { ...wait, id: 'a' }, { ...wait, id: 'b' }] })).toBe(
      false,
    );
    expect(parses({ options: [open, { ...wait, id: 'open' }] })).toBe(false);
    expect(parses({ isDefault: true })).toBe(false);
  });

  it('recusa texto de uma frase só, de cinco frases e sem ponto final', () => {
    expect(parses({ text: 'Alguém bate à porta.' })).toBe(false);
    expect(parses({ text: 'Um. Dois. Três. Quatro. Cinco.' })).toBe(false);
    expect(parses({ text: 'Alguém bate. O conselho espera' })).toBe(false);
    expect(parses({ text: 'Alguém bate. O conselho espera. Há pressa? Há.' })).toBe(true);
  });

  it('recusa opção automática que não existe, que custa ou que exige', () => {
    expect(parses({ autoResolve: { peasant: 'wait', lord: 'wait', ironKing: 'flee' } })).toBe(
      false,
    );
    expect(parses({ autoResolve: { peasant: 'wait', lord: 'wait', ironKing: 'open' } })).toBe(
      false,
    );
    expect(parses({ autoResolve: { peasant: 'wait', lord: 'wait' } })).toBe(false);
    const gated = { ...sample.options[1], requires: { building: 'granary' } };
    expect(parses({ options: [sample.options[0], gated] })).toBe(false);
  });

  it('recusa rótulo que não é verbo no infinitivo ou que traz número', () => {
    expect(withOption({ label: 'Abrir a porta' })).toBe(true);
    expect(withOption({ label: 'Pôr a mesa' })).toBe(true);
    expect(withOption({ label: 'A porta aberta' })).toBe(false);
    expect(withOption({ label: 'Ceder 40 de madeira' })).toBe(false);
    expect(withOption({ label: 'abrir a porta' })).toBe(false);
  });

  it('recusa efeito desconhecido, efeito zero, duração zero e dois efeitos de moral juntos', () => {
    const effects = (list: unknown[]) => withOption({ effects: list });
    expect(effects([{ type: 'resources', amounts: { food: -20 } }])).toBe(true);
    expect(effects([{ type: 'addHero', hero: 'edda' }])).toBe(false);
    expect(effects([{ type: 'resources', amounts: {} }])).toBe(false);
    expect(effects([{ type: 'resources', amounts: { food: 0 } }])).toBe(false);
    expect(effects([{ type: 'resources', amounts: { iron: 5 } }])).toBe(false);
    expect(effects([{ type: 'morale', amount: 0, durationDays: 1 }])).toBe(false);
    expect(effects([{ type: 'morale', amount: 5, durationDays: 0 }])).toBe(false);
    expect(effects([{ type: 'scheduleCard', cardId: 'sample', afterDays: 0 }])).toBe(false);
    expect(effects([{ type: 'setFlag', flag: 'sem ponto' }])).toBe(false);
    expect(
      effects([
        { type: 'morale', amount: 5, durationDays: 1 },
        { type: 'morale', amount: 5, durationDays: 2 },
      ]),
    ).toBe(false);
  });

  it('recusa efeito escondido sem prazo, sem efeito ou sem frase, e marcador desconhecido', () => {
    const hidden = {
      afterDays: 2,
      effects: [{ type: 'resources', amounts: { stone: 20 } }],
      chronicle: 'No {dia}º dia {daEstacao}, algo aconteceu em {feudo}.',
    };
    expect(withOption({ hidden })).toBe(true);
    expect(withOption({ hidden: { ...hidden, afterDays: 0 } })).toBe(false);
    expect(withOption({ hidden: { ...hidden, effects: [] } })).toBe(false);
    expect(withOption({ hidden: { ...hidden, chronicle: undefined } })).toBe(false);
    expect(withOption({ chronicle: 'O senhor de {castelo} decidiu.' })).toBe(false);
    expect(withOption({ hint: '' })).toBe(false);
  });

  it('recusa requisito de versão futura, faixa de moral invertida e requisito vazio', () => {
    expect(parses({ requires: { seasons: ['autumn'], minDay: 10, moralRange: [40, 100] } })).toBe(
      true,
    );
    expect(parses({ requires: { buildings: { market: 1 } } })).toBe(false);
    expect(parses({ requires: { heroTrait: 'charismatic' } })).toBe(false);
    expect(parses({ requires: { moralRange: [60, 40] } })).toBe(false);
    expect(parses({ requires: {} })).toBe(false);
    expect(withOption({ requires: { heroTrait: 'charismatic' } })).toBe(false);
    expect(withOption({ requires: { building: 'granary', resources: { food: 100 } } })).toBe(true);
  });
});

describe('Conselho: o schema do catálogo', () => {
  const catalog = (cards: unknown[]) => CouncilCatalogSchema.safeParse(cards).success;
  const chained = (effect: object, extra: Partial<CouncilCard> = {}) => ({
    ...sample,
    ...extra,
    options: [sample.options[0], { ...sample.options[1], effects: [effect] }],
  });

  it('aceita o catálogo de exemplo e recusa carta repetida', () => {
    expect(catalog([sample])).toBe(true);
    expect(catalog([sample, sample])).toBe(false);
  });

  it('recusa flag exigida, proibida, lembrada ou apagada que ninguém grava', () => {
    expect(catalog([{ ...sample, requires: { flags: ['chain.done'] } }])).toBe(false);
    expect(catalog([{ ...sample, requires: { notFlags: ['chain.done'] } }])).toBe(false);
    expect(
      catalog([
        { ...sample, variants: [{ flag: 'chain.done', text: 'Alguém voltou. O conselho ri.' }] },
      ]),
    ).toBe(false);
    expect(catalog([chained({ type: 'clearFlag', flag: 'chain.done' })])).toBe(false);
    expect(
      catalog([
        chained({ type: 'setFlag', flag: 'chain.done' }),
        { ...sample, id: 'later', requires: { flags: ['chain.done'] } },
      ]),
    ).toBe(true);
  });

  it('recusa continuação para carta que não existe e carta sem peso que ninguém agenda', () => {
    expect(catalog([chained({ type: 'scheduleCard', cardId: 'ghost', afterDays: 2 })])).toBe(false);
    expect(catalog([{ ...sample, weight: 0 }])).toBe(false);
    expect(
      catalog([
        chained({ type: 'scheduleCard', cardId: 'later', afterDays: 2 }),
        { ...sample, id: 'later', weight: 0 },
      ]),
    ).toBe(true);
    // Uma carta roteirizada chega pelo roteiro: não precisa de peso nem de quem a agende.
    expect(catalog([{ ...sample, weight: 0, scripted: { atGameDay: 2 } }])).toBe(true);
  });
});

describe('Conselho: as frases gerais da Crônica', () => {
  it('a chegada cita a carta; a expiração diz qual carta e o que o conselho fez', () => {
    expect(chronicleTemplates.cardDrawn).toContain('{carta}');
    expect(chronicleTemplates.cardExpired).toContain('{carta}');
    expect(chronicleTemplates.cardExpired).toContain('{opcao}');
    expect(chronicleTemplates.cardExpired).toMatch(/sozinho/);
    expect(chronicleTemplates.cardAnswered).toContain('{opcao}');
    expect(chronicleTemplates.cardEffectApplied).toContain('{carta}');
  });
});
