import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  buildings,
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

  it('tem as 21 cartas do primeiro lote: três cadeias de 3 e as 12 avulsas, nesta ordem', () => {
    // A terceira cadeia, "A Promessa da Paliçada", entrou com a Paliçada (roadmap da v0.2,
    // V2E-T2), antes das avulsas. As fichas estão em docs/content-v0.2.md.
    expect(councilCards).toHaveLength(21);
    expect(councilCards.map((entry) => [entry.id, entry.title])).toEqual([
      ['commonGranaryPlanks', 'Tábuas para as reservas'],
      ['commonGranaryShare', 'A vez de repartir'],
      ['commonGranaryOutcome', 'O que ficou da escolha'],
      ['thawBridgePlea', 'A ponte que o degelo levou'],
      ['thawBridgeSlab', 'A laje no leito do riacho'],
      ['thawBridgeCrossing', 'A passagem volta a servir'],
      ['palisadePromisePlea', 'Os aldeões pedem uma cerca'],
      ['palisadePromiseDeadline', 'O prazo da paliçada'],
      ['palisadePromiseReckoning', 'A palavra do senhor'],
      ['collapsedWell', 'O poço entulhado'],
      ['masonsMeal', 'A refeição dos pedreiros'],
      ['sawmillRest', 'A serraria e o descanso'],
      ['neighborsWatch', 'Vigília entre vizinhos'],
      ['moreMouths', 'Mais bocas à mesa'],
      ['springSeeds', 'Sementes para o próximo campo'],
      ['springNews', 'A notícia da primavera'],
      ['apprenticesTable', 'A mesa dos aprendizes'],
      ['fullGranary', 'O celeiro quase cheio'],
      ['dampFirewood', 'Lenha ainda úmida'],
      ['roofBeforeCold', 'Um teto antes do frio'],
      ['harvestFeast', 'A colheita de todos'],
    ]);
    expect(new Set(councilCards.map((entry) => entry.title)).size).toBe(councilCards.length);
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

  it('a opção que o conselho aplica com o requisito cumprido existe, exige algo, não custa e nunca tira nada', () => {
    const marked = councilCards.filter((entry) => entry.autoResolveIfUnlocked !== undefined);
    // Só a cadeia da Paliçada usa a marca: é a obra que cumpre a promessa.
    expect(marked.map((entry) => entry.id)).toEqual([
      'palisadePromisePlea',
      'palisadePromiseDeadline',
      'palisadePromiseReckoning',
    ]);
    for (const entry of marked) {
      const option = entry.options.find(
        (candidate) => candidate.id === entry.autoResolveIfUnlocked,
      );
      expect(option?.requires, entry.id).toBeDefined();
      expect(option?.cost, entry.id).toBeUndefined();
      expect(option?.hidden, entry.id).toBeUndefined();
      for (const effect of option?.effects ?? []) {
        if (effect.type === 'morale') {
          expect(effect.amount, entry.id).toBeGreaterThan(0);
        }
        expect(effect.type, entry.id).not.toBe('resources');
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
    // E o sorteio tem o que tirar em um feudo recém-fundado: cartas com peso que não pedem
    // estação, edifício, dia nem moral (as recorrentes só pedem a vez delas na ronda).
    expect(
      councilCards.filter(
        (entry) =>
          entry.weight > 0 && Object.keys(entry.requires ?? {}).every((key) => key === 'notFlags'),
      ).length,
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

  it('nenhum texto fala de herói, Mercado, ferro, exército, combate, mapa ou edifício de versão futura', () => {
    const future =
      /\b(her[óo]i|her[óo]is|mercado|mercador|ferro|ferreiro|ex[ée]rcito|combate|batalha|soldado|espada|arqueiro|mapa|expedi[çc]|rel[íi]quia|guilda|taverna|quartel|muralha|horda|cerco)/iu;
    for (const entry of councilCards) {
      for (const text of textsOf(entry)) {
        expect(text, entry.id).not.toMatch(future);
      }
    }
  });

  it('nome de flag não é texto de interface: nenhuma frase traz um identificador com ponto', () => {
    const flags = councilCards
      .flatMap(effectsOf)
      .flatMap((effect) => (effect.type === 'setFlag' ? [effect.flag] : []));
    expect(flags.length).toBeGreaterThan(0);
    for (const entry of councilCards) {
      for (const text of textsOf(entry)) {
        expect(text, entry.id).not.toMatch(/\p{L}\.\p{L}/u);
        for (const flag of flags) {
          expect(text, entry.id).not.toContain(flag.split('.')[0] as string);
        }
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
      const applied = [...Object.values(entry.autoResolve), entry.autoResolveIfUnlocked];
      for (const id of new Set(applied.filter((value) => value !== undefined))) {
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

/** O que uma lista de efeitos faz que o jogador vê antes de escolher: recursos e moral. */
const known = (list: readonly CouncilEffect[]) => {
  const total = { food: 0, wood: 0, stone: 0, gold: 0, morale: 0 };
  for (const effect of list) {
    if (effect.type === 'resources') {
      for (const [resource, amount] of Object.entries(effect.amounts)) {
        total[resource as keyof typeof total] += amount;
      }
    } else if (effect.type === 'morale') {
      // Pontos de moral vezes dias: serve para comparar "+5 por 3 dias" com "+10 por 2".
      total.morale += effect.amount * effect.durationDays;
    }
  }
  return total;
};
const schedules = (option: CouncilCard['options'][number]) =>
  option.effects.some((effect) => effect.type === 'scheduleCard');
const isFree = (option: CouncilCard['options'][number]) =>
  option.cost === undefined && option.requires === undefined;

describe('Conselho: nenhuma opção domina no papel (GDD §7.1 e §15.1, item 8)', () => {
  it('toda carta que o sorteio tira tem ao menos uma opção com custo ou com requisito: há sempre algo a pesar', () => {
    for (const entry of councilCards.filter((candidate) => candidate.weight > 0)) {
      expect(
        entry.options.some((option) => !isFree(option)),
        entry.id,
      ).toBe(true);
    }
  });

  it('entre duas opções sem custo, nenhuma é melhor em tudo o que a tela mostra', () => {
    for (const entry of councilCards) {
      const free = entry.options.filter(isFree);
      for (const better of free) {
        for (const worse of free) {
          // A opção que esconde um efeito ou leva a história adiante não se compara só pelo
          // que mostra: a pista diz que há mais.
          if (better === worse || better.hidden !== undefined || schedules(better)) {
            continue;
          }
          const a = known(better.effects);
          const b = known(worse.effects);
          const keys = Object.keys(a) as Array<keyof typeof a>;
          const dominates =
            keys.every((key) => a[key] >= b[key]) &&
            keys.some((key) => a[key] > b[key]) &&
            worse.hidden === undefined &&
            !schedules(worse);
          expect(dominates, `${entry.id}: ${better.id} domina ${worse.id}`).toBe(false);
        }
      }
    }
  });

  it('toda opção paga dá algo que a opção sem custo não dá: um efeito maior, uma pista ou a continuação', () => {
    for (const entry of councilCards) {
      for (const paid of entry.options.filter((option) => option.cost !== undefined)) {
        const gain = known(paid.effects);
        const keys = Object.keys(gain) as Array<keyof typeof gain>;
        // A opção sem custo que esconde um efeito fica de fora: o que a paga oferece pode ser
        // justamente não correr o risco que a pista anuncia.
        for (const free of entry.options.filter(
          (option) => isFree(option) && option.hidden === undefined,
        )) {
          const other = known(free.effects);
          const offers =
            paid.hidden !== undefined ||
            schedules(paid) ||
            keys.some((key) => gain[key] > other[key]);
          expect(offers, `${entry.id}: ${paid.id} não oferece nada além de ${free.id}`).toBe(true);
        }
      }
    }
  });

  it('o custo nunca passa do que um feudo recém-fundado guarda: 500 por recurso (GDD §5.2)', () => {
    for (const entry of councilCards) {
      for (const option of entry.options) {
        for (const amount of Object.values({ ...option.cost, ...option.requires?.resources })) {
          expect(amount, `${entry.id}/${option.id}`).toBeLessThanOrEqual(
            balance.storage.baseCapacity,
          );
        }
      }
    }
  });
});

describe('Conselho: quem falta não é punido (GDD §15.1, item 5)', () => {
  it('em Camponês e em Senhor, a opção que o conselho aplica sozinho nunca tira recurso, nem depois', () => {
    for (const entry of councilCards) {
      for (const difficulty of ['peasant', 'lord'] as const) {
        const option = entry.options.find(
          (candidate) => candidate.id === entry.autoResolve[difficulty],
        );
        const all = [...(option?.effects ?? []), ...(option?.hidden?.effects ?? [])];
        for (const effect of all) {
          if (effect.type === 'resources') {
            for (const amount of Object.values(effect.amounts)) {
              expect(amount, `${entry.id}/${difficulty}`).toBeGreaterThan(0);
            }
          }
        }
      }
    }
  });

  it('em Camponês e em Senhor, uma carta que o sorteio traz e ninguém responde também não tira moral', () => {
    // Quem não responde perde a oportunidade, e só: o feudo fica como estaria sem a carta, ou
    // melhor. É o que deixa uma carta expirar no meio de uma fome sem empurrar ninguém embora.
    // Vale para as cartas do sorteio: a continuação de uma cadeia só chega porque o senhor (ou,
    // em Rei de Ferro, o conselho) escolheu algo antes, e a consequência dessa escolha pode
    // custar moral mesmo sem resposta.
    for (const entry of councilCards) {
      for (const difficulty of ['peasant', 'lord'] as const) {
        const option = entry.options.find(
          (candidate) => candidate.id === entry.autoResolve[difficulty],
        );
        const all = [...(option?.effects ?? []), ...(option?.hidden?.effects ?? [])];
        for (const effect of all) {
          if (effect.type === 'morale' && entry.weight > 0) {
            expect(effect.amount, `${entry.id}/${difficulty}`).toBeGreaterThan(0);
          }
        }
      }
    }
    // Em uma continuação o conselho, sozinho, só tira moral quando não há outro caminho sem
    // custo: é a conta de uma promessa que o senhor fez e não cumpriu.
    const continuations = councilCards.filter((entry) => entry.weight === 0);
    expect(continuations.length).toBeGreaterThan(0);
    for (const entry of continuations) {
      const option = entry.options.find((candidate) => candidate.id === entry.autoResolve.lord);
      const onlyWay = entry.options.filter(isFree).length === 1;
      if (!onlyWay) {
        expect(known(option?.effects ?? []).morale, entry.id).toBeGreaterThanOrEqual(0);
      }
      expect(option?.hidden, entry.id).toBeUndefined();
    }
  });

  it('em Camponês e em Senhor, a opção automática de uma carta recorrente não mexe em nada', () => {
    // Uma recorrente pode expirar várias vezes por ano com o senhor fora: não pode pingar
    // prêmio nem castigo. A exceção é Rei de Ferro, que fica com a opção mais dura.
    for (const entry of councilCards.filter((candidate) => candidate.recurring === true)) {
      for (const difficulty of ['peasant', 'lord'] as const) {
        const option = entry.options.find(
          (candidate) => candidate.id === entry.autoResolve[difficulty],
        );
        expect(option?.hidden, entry.id).toBeUndefined();
        expect(known(option?.effects ?? []), entry.id).toEqual({
          food: 0,
          wood: 0,
          stone: 0,
          gold: 0,
          morale: 0,
        });
      }
    }
  });

  it('em Rei de Ferro a opção automática é a mais dura das que não têm custo, quando há duas', () => {
    const harsher = councilCards.filter(
      (entry) => entry.autoResolve.ironKing !== entry.autoResolve.lord,
    );
    // Onde só há uma opção sem custo, as três dificuldades decidem igual.
    expect(harsher.length).toBeGreaterThanOrEqual(6);
    for (const entry of councilCards) {
      const free = entry.options.filter(isFree);
      expect(new Set(Object.values(entry.autoResolve)).size, entry.id).toBeLessThanOrEqual(
        free.length,
      );
    }
  });
});

describe('Conselho: a ordem das opções na carta', () => {
  it('primeiro as pagas ou trancadas; depois a que o conselho aplica sozinho em Senhor; por último, a mais dura', () => {
    // É a ordem em que a tela mostra: quem lê de cima para baixo vê o que custa (ou pede um
    // edifício), depois o que não custa nem arrisca, e por fim o que não custa e cobra de outro
    // jeito.
    for (const entry of councilCards) {
      const kinds = entry.options.map((option) => (isFree(option) ? 'free' : 'paid'));
      expect(kinds.join(','), entry.id).toMatch(/^(paid,)*free(,free)*$/);
      const free = entry.options.filter(isFree);
      expect(free[0]?.id, entry.id).toBe(entry.autoResolve.lord);
      expect(entry.autoResolve.peasant, entry.id).toBe(entry.autoResolve.lord);
      if (entry.autoResolve.ironKing !== entry.autoResolve.lord) {
        expect(free[1]?.id, entry.id).toBe(entry.autoResolve.ironKing);
      }
    }
  });
});

describe('Conselho: os números das cartas ficam em uma faixa que a tela explica bem', () => {
  it('moral de 5 a 20 pontos, por 1 a 4 dias de jogo', () => {
    for (const effect of councilCards.flatMap(effectsOf)) {
      if (effect.type === 'morale') {
        expect(Math.abs(effect.amount)).toBeGreaterThanOrEqual(5);
        expect(Math.abs(effect.amount)).toBeLessThanOrEqual(20);
        expect(Math.abs(effect.amount) % 5).toBe(0);
        expect(effect.durationDays).toBeLessThanOrEqual(4);
      }
    }
  });

  it('a continuação de uma cadeia chega de 2 a 4 dias de jogo depois; o efeito escondido, em 2 a 5', () => {
    for (const entry of councilCards) {
      for (const option of entry.options) {
        for (const effect of option.effects) {
          if (effect.type === 'scheduleCard') {
            // Dois dias quando a história só continua; até quatro quando a carta dá um prazo.
            expect(effect.afterDays, `${entry.id}/${option.id}`).toBeGreaterThanOrEqual(2);
            expect(effect.afterDays, `${entry.id}/${option.id}`).toBeLessThanOrEqual(4);
          }
        }
        if (option.hidden !== undefined) {
          expect(option.hidden.afterDays, `${entry.id}/${option.id}`).toBeGreaterThanOrEqual(2);
          expect(option.hidden.afterDays, `${entry.id}/${option.id}`).toBeLessThanOrEqual(5);
          // O que acontece depois nunca agenda carta nem mexe em flag: é só a consequência.
          for (const effect of option.hidden.effects) {
            expect(['resources', 'morale']).toContain(effect.type);
          }
        }
      }
    }
  });

  it('a moral chega a 80 só com as cartas: há festa de +20 e caminhos que somam +20', () => {
    // A base (50) e a comida guardada (+10) dão 60 (GDD §5.7): o colono atraído pela fama do
    // feudo depende de +20 em efeitos temporários.
    const need = balance.morale.arrival.minMorale - 60;
    const single = councilCards
      .flatMap((entry) => entry.options.flatMap((option) => option.effects))
      .filter((effect) => effect.type === 'morale' && effect.amount >= need);
    expect(single.length).toBeGreaterThanOrEqual(1);
    // E as duas cadeias têm um caminho que soma +20 com a continuação: cada continuação chega
    // em 2 dias e o efeito anterior dura 3.
    const peak = (first: string, second: string) => {
      const best = (id: string) =>
        Math.max(
          ...card(id).options.flatMap((option) =>
            option.effects.flatMap((effect) =>
              effect.type === 'morale' && effect.durationDays >= 3 ? [effect.amount] : [0],
            ),
          ),
        );
      return best(first) + best(second);
    };
    expect(peak('commonGranaryShare', 'commonGranaryOutcome')).toBeGreaterThanOrEqual(need);
    expect(peak('thawBridgePlea', 'thawBridgeCrossing')).toBeGreaterThanOrEqual(need);
  });
});

describe('Conselho: há assunto em toda audiência (roadmap da v0.2, V2D-T2.5)', () => {
  const recurring = councilCards.filter((entry) => entry.recurring === true);
  const yearDays = balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0);

  it('o ano tem 21 audiências e só 11 cartas de uma vez por ano: quem cobre o resto são as recorrentes', () => {
    expect(yearDays / balance.council.drawIntervalDays).toBe(21);
    const once = councilCards.filter((entry) => entry.weight > 0 && entry.recurring !== true);
    expect(once.map((entry) => entry.id)).toEqual([
      'commonGranaryPlanks',
      'thawBridgePlea',
      'palisadePromisePlea',
      'collapsedWell',
      'springSeeds',
      'springNews',
      'apprenticesTable',
      'fullGranary',
      'dampFirewood',
      'roofBeforeCold',
      'harvestFeast',
    ]);
  });

  it('quatro recorrentes, sem estação, edifício, dia mínimo nem faixa de moral: valem do 1º dia ao inverno', () => {
    expect(recurring.map((entry) => entry.id)).toEqual([
      'masonsMeal',
      'sawmillRest',
      'neighborsWatch',
      'moreMouths',
    ]);
    for (const entry of recurring) {
      expect(entry.requires, entry.id).toEqual({ notFlags: [`routine.${entry.id}`] });
      expect(entry.weight, entry.id).toBe(1);
    }
  });

  it('a mesma recorrente não vem duas vezes seguidas: cada opção grava a flag dela e apaga as das outras', () => {
    for (const entry of recurring) {
      const others = recurring
        .filter((other) => other !== entry)
        .map((other) => `routine.${other.id}`);
      for (const option of entry.options) {
        const set = option.effects.flatMap((effect) =>
          effect.type === 'setFlag' ? [effect.flag] : [],
        );
        const cleared = option.effects.flatMap((effect) =>
          effect.type === 'clearFlag' ? [effect.flag] : [],
        );
        expect(set, `${entry.id}/${option.id}`).toEqual([`routine.${entry.id}`]);
        expect(cleared, `${entry.id}/${option.id}`).toEqual(others);
      }
    }
    // Com uma delas travada pela ronda, sobram três: é o piso de qualquer audiência.
    expect(recurring.length - 1).toBeGreaterThanOrEqual(3);
  });

  it('em cada estação um feudo recém-fundado tem ao menos 5 cartas ao alcance do sorteio, e as de peso maior são as da estação', () => {
    for (const season of balance.calendar.seasons) {
      const eligible = councilCards.filter(
        (entry) =>
          entry.weight > 0 &&
          (entry.requires?.seasons === undefined || entry.requires.seasons.includes(season.id)) &&
          entry.requires?.buildings === undefined,
      );
      expect(eligible.length, season.id).toBeGreaterThanOrEqual(5);
      const seasonal = eligible.filter((entry) => entry.requires?.seasons !== undefined);
      for (const entry of seasonal) {
        expect(entry.weight, entry.id).toBeGreaterThanOrEqual(3);
      }
    }
    // A primavera, o verão e o outono têm cartas só deles; o inverno vive das de sempre.
    const only = (season: string) =>
      councilCards.filter((entry) => entry.requires?.seasons?.includes(season as never)).length;
    expect([only('spring'), only('summer'), only('autumn'), only('winter')]).toEqual([3, 3, 5, 0]);
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

  it('aceitar leva à segunda carta em 2 dias, por dois caminhos; recusar encerra o ramo', () => {
    const [cede, pay, keep] = card('commonGranaryPlanks').options;
    for (const option of [cede, pay]) {
      expect(option?.effects).toContainEqual({
        type: 'scheduleCard',
        cardId: 'commonGranaryShare',
        afterDays: 2,
      });
      expect(option?.effects).toContainEqual({ type: 'setFlag', flag: 'commonGranary.open' });
      expect(option?.effects).toContainEqual({ type: 'morale', amount: 5, durationDays: 3 });
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
        afterDays: 2,
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
    const ending = { accept: 'commonGranary.stocked', leave: 'commonGranary.gifted' } as const;
    for (const option of outcome.options) {
      const cleared = option.effects.flatMap((effect) =>
        effect.type === 'clearFlag' ? [effect.flag] : [],
      );
      const other = Object.values(ending).find(
        (flag) => flag !== ending[option.id as keyof typeof ending],
      );
      expect(cleared).toEqual([
        'commonGranary.open',
        'commonGranary.supported',
        'commonGranary.paid',
        'commonGranary.shared',
        'commonGranary.reserved',
        other,
      ]);
      expect(option.effects).toContainEqual({
        type: 'setFlag',
        flag: ending[option.id as keyof typeof ending],
      });
      expect(option.cost).toBeUndefined();
      expect(option.effects.some((effect) => effect.type === 'scheduleCard')).toBe(false);
    }
    expect(outcome.options[0]?.effects[0]).toEqual({ type: 'resources', amounts: { food: 40 } });
  });

  it('quando volta em outro ano, a primeira carta lembra como a cadeia terminou', () => {
    expect(card('commonGranaryPlanks').variants?.map((variant) => variant.flag)).toEqual([
      'commonGranary.gifted',
      'commonGranary.stocked',
    ]);
  });
});

describe('Conselho: "A Ponte do Degelo"', () => {
  it('só a primeira carta é sorteada, na primavera e no verão, sem cadeia aberta nem ponte de pedra', () => {
    expect(card('thawBridgePlea').weight).toBeGreaterThan(0);
    expect(card('thawBridgePlea').requires).toEqual({
      seasons: ['spring', 'summer'],
      notFlags: ['thawBridge.open', 'thawBridge.piers'],
    });
    expect(card('thawBridgeSlab').weight).toBe(0);
    expect(card('thawBridgeCrossing').weight).toBe(0);
  });

  it('madeira ou ouro começam a obra; adiar encerra o ramo sem custo nenhum', () => {
    const [timber, hire, postpone] = card('thawBridgePlea').options;
    expect(timber?.cost).toEqual({ wood: 40 });
    expect(hire?.cost).toEqual({ gold: 40 });
    for (const option of [timber, hire]) {
      expect(option?.effects).toContainEqual({
        type: 'scheduleCard',
        cardId: 'thawBridgeSlab',
        afterDays: 2,
      });
      expect(option?.effects).toContainEqual({ type: 'setFlag', flag: 'thawBridge.open' });
    }
    expect(postpone?.effects).toEqual([]);
    expect(postpone?.hidden).toBeUndefined();
  });

  it('no meio: a pedra e a pinguela levam ao desfecho; largar devolve madeira e fecha a cadeia', () => {
    const [piers, plank, abandon] = card('thawBridgeSlab').options;
    expect(piers?.cost).toEqual({ stone: 30 });
    expect(piers?.hidden?.effects).toEqual([{ type: 'resources', amounts: { food: 90 } }]);
    for (const option of [piers, plank]) {
      expect(option?.effects).toContainEqual({
        type: 'scheduleCard',
        cardId: 'thawBridgeCrossing',
        afterDays: 2,
      });
    }
    expect(plank?.cost).toBeUndefined();
    expect(abandon?.effects.some((effect) => effect.type === 'scheduleCard')).toBe(false);
    expect(abandon?.effects).toContainEqual({ type: 'clearFlag', flag: 'thawBridge.open' });
    expect(abandon?.effects).toContainEqual({ type: 'resources', amounts: { wood: 30 } });
    expect(card('thawBridgeSlab').variants?.map((variant) => variant.flag)).toEqual([
      'thawBridge.timber',
      'thawBridge.hired',
    ]);
  });

  it('o desfecho fecha a cadeia e guarda que travessia o feudo tem: a de pedra não volta a cair', () => {
    const crossing = card('thawBridgeCrossing');
    expect(crossing.variants?.map((variant) => variant.flag)).toEqual([
      'thawBridge.piers',
      'thawBridge.plank',
    ]);
    for (const option of crossing.options) {
      const cleared = option.effects.flatMap((effect) =>
        effect.type === 'clearFlag' ? [effect.flag] : [],
      );
      expect(cleared).toEqual(['thawBridge.open', 'thawBridge.timber', 'thawBridge.hired']);
      expect(option.effects.some((effect) => effect.type === 'scheduleCard')).toBe(false);
    }
    // A pinguela fica gravada, e a primeira carta a lembra no ano seguinte.
    expect(card('thawBridgePlea').variants?.map((variant) => variant.flag)).toEqual([
      'thawBridge.plank',
    ]);
  });
});

describe('Conselho: "A Promessa da Paliçada"', () => {
  const morale = (option: CouncilCard['options'][number] | undefined) =>
    option?.effects.find((effect) => effect.type === 'morale');
  const flags = (option: CouncilCard['options'][number] | undefined) =>
    (option?.effects ?? []).flatMap((effect) =>
      effect.type === 'setFlag'
        ? [`+${effect.flag}`]
        : effect.type === 'clearFlag'
          ? [`-${effect.flag}`]
          : [],
    );
  const chain = ['palisadePromisePlea', 'palisadePromiseDeadline', 'palisadePromiseReckoning'];

  it('só a primeira carta é sorteada, com o Salão no nível que libera a Paliçada, sem cadeia aberta nem promessa cumprida', () => {
    expect(card('palisadePromisePlea').weight).toBeGreaterThan(0);
    expect(card('palisadePromisePlea').requires).toEqual({
      buildings: { townHall: 3 },
      notFlags: ['palisadePromise.open', 'palisadePromise.kept'],
    });
    // O pedido só chega quando a obra já pode ser feita: o nível é o que o edifício pede.
    expect(card('palisadePromisePlea').requires?.buildings).toEqual(buildings.palisade.requires);
    expect(card('palisadePromiseDeadline').weight).toBe(0);
    expect(card('palisadePromiseReckoning').weight).toBe(0);
  });

  it('nas três cartas a primeira opção é mostrar a obra, trancada enquanto a Paliçada não existe, e ela fecha a cadeia', () => {
    for (const id of chain) {
      const [show] = card(id).options;
      expect(show?.id, id).toBe('show');
      expect(show?.requires, id).toEqual({ building: 'palisade' });
      expect(show?.cost, id).toBeUndefined();
      expect(flags(show), id).toContain('+palisadePromise.kept');
      expect(flags(show), id).toContain('-palisadePromise.broken');
      expect(
        show?.effects.some((effect) => effect.type === 'scheduleCard'),
        id,
      ).toBe(false);
      // E só ela exige a obra: as outras opções estão ao alcance de qualquer feudo.
      expect(card(id).options.filter((option) => option.requires !== undefined)).toHaveLength(1);
    }
  });

  it('a carta não dá proteção, edifício nem recurso: só moral, flags e a continuação', () => {
    for (const id of chain) {
      for (const effect of effectsOf(card(id))) {
        expect(['morale', 'setFlag', 'clearFlag', 'scheduleCard'], id).toContain(effect.type);
      }
      for (const option of card(id).options) {
        expect(option.cost, `${id}/${option.id}`).toBeUndefined();
        expect(option.hidden, `${id}/${option.id}`).toBeUndefined();
      }
    }
  });

  it('prometer rende +10 na hora e marca a cobrança para 4 dias de jogo depois; explicar não muda nada', () => {
    const [show, explain, promise] = card('palisadePromisePlea').options;
    expect(morale(show)).toEqual({ type: 'morale', amount: 10, durationDays: 3 });
    expect(explain?.effects).toEqual([]);
    expect(promise?.effects).toEqual([
      { type: 'morale', amount: 10, durationDays: 3 },
      { type: 'setFlag', flag: 'palisadePromise.open' },
      { type: 'scheduleCard', cardId: 'palisadePromiseDeadline', afterDays: 4 },
    ]);
    expect(card('palisadePromisePlea').autoResolve).toEqual({
      peasant: 'explain',
      lord: 'explain',
      ironKing: 'promise',
    });
  });

  it('no prazo: mostrar vale +15, pedir mais dias adia a conta por outros 4, desfazer custa 10 e acaba ali', () => {
    const [show, delay, withdraw] = card('palisadePromiseDeadline').options;
    expect(morale(show)).toEqual({ type: 'morale', amount: 15, durationDays: 3 });
    expect(flags(show)).toEqual([
      '-palisadePromise.open',
      '-palisadePromise.broken',
      '+palisadePromise.kept',
    ]);
    expect(delay?.effects).toEqual([
      { type: 'scheduleCard', cardId: 'palisadePromiseReckoning', afterDays: 4 },
    ]);
    expect(morale(withdraw)).toEqual({ type: 'morale', amount: -10, durationDays: 3 });
    expect(flags(withdraw)).toEqual(['-palisadePromise.open', '+palisadePromise.broken']);
    expect(card('palisadePromiseDeadline').autoResolve).toEqual({
      peasant: 'delay',
      lord: 'delay',
      ironKing: 'withdraw',
    });
  });

  it('no segundo prazo não há terceiro: mostrar tarde vale +5, e a outra saída custa 15, mais que desfazer no prazo', () => {
    const reckoning = card('palisadePromiseReckoning');
    const [show, admit] = reckoning.options;
    expect(reckoning.options).toHaveLength(2);
    expect(morale(show)).toEqual({ type: 'morale', amount: 5, durationDays: 2 });
    expect(morale(admit)).toEqual({ type: 'morale', amount: -15, durationDays: 3 });
    expect(flags(admit)).toEqual(['-palisadePromise.open', '+palisadePromise.broken']);
    expect(reckoning.autoResolve).toEqual({ peasant: 'admit', lord: 'admit', ironKing: 'admit' });
    // Adiar e não cumprir pesa mais do que voltar atrás na primeira cobrança.
    const [, , withdraw] = card('palisadePromiseDeadline').options;
    expect(Math.abs(morale(admit)?.amount ?? 0)).toBeGreaterThan(
      Math.abs(morale(withdraw)?.amount ?? 0),
    );
    // E cumprir no prazo vale mais do que cumprir atrasado.
    expect(morale(card('palisadePromiseDeadline').options[0])?.amount).toBeGreaterThan(
      morale(show)?.amount ?? 0,
    );
  });

  it('nenhuma saída deixa a cadeia aberta: toda opção fecha a promessa ou agenda a carta seguinte', () => {
    const opens = (option: CouncilCard['options'][number]) =>
      flags(option).includes('+palisadePromise.open');
    const closes = (option: CouncilCard['options'][number]) =>
      flags(option).includes('-palisadePromise.open');
    const continues = (option: CouncilCard['options'][number]) =>
      option.effects.some((effect) => effect.type === 'scheduleCard');
    // Na primeira carta só quem promete abre a cadeia, e agenda a cobrança.
    for (const option of card('palisadePromisePlea').options) {
      expect(opens(option), option.id).toBe(continues(option));
    }
    // Nas continuações toda opção fecha a promessa ou marca a carta seguinte, nunca as duas.
    for (const id of ['palisadePromiseDeadline', 'palisadePromiseReckoning']) {
      for (const option of card(id).options) {
        expect(closes(option) !== continues(option), `${id}/${option.id}`).toBe(true);
      }
    }
    // E a última carta não agenda nada.
    expect(card('palisadePromiseReckoning').options.some((option) => continues(option))).toBe(
      false,
    );
  });

  it('com a obra de pé, é a opção de mostrá-la que o conselho aplica se a carta expirar, e a Crônica diz que foi ele', () => {
    for (const id of chain) {
      expect(card(id).autoResolveIfUnlocked, id).toBe('show');
      const [show] = card(id).options;
      expect(show?.expiredChronicle, id).toMatch(/sem palavra do senhor, o conselho de \{feudo\}/);
      // Nenhuma frase de quem mostra a obra diz que ela não existe.
      expect(show?.expiredChronicle, id).not.toMatch(/não saiu|esperar|desfez/);
    }
  });

  it('quando volta em outro ano, a primeira carta lembra a promessa que não se cumpriu', () => {
    const plea = card('palisadePromisePlea');
    expect(plea.variants?.map((variant) => variant.flag)).toEqual(['palisadePromise.broken']);
    expect(plea.variants?.[0]?.text).toContain('já foi prometida uma vez');
    expect(plea.variants?.[0]?.arrival).toContain('{carta}');
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

  it('a opção marcada para o requisito cumprido tem de existir, exigir algo e não custar', () => {
    const gated = { ...sample.options[0], cost: undefined, requires: { building: 'granary' } };
    const options = [gated, sample.options[1]];
    expect(parses({ options, autoResolveIfUnlocked: 'open' })).toBe(true);
    expect(parses({ options, autoResolveIfUnlocked: 'flee' })).toBe(false);
    // Sem requisito ela seria só mais uma opção automática: é o que `autoResolve` já marca.
    expect(parses({ options, autoResolveIfUnlocked: 'wait' })).toBe(false);
    // E não pode cobrar: a expiração nunca tira do jogador o que ele não escolheu gastar.
    const paid = { ...gated, cost: { gold: 10 } };
    expect(parses({ options: [paid, sample.options[1]], autoResolveIfUnlocked: 'open' })).toBe(
      false,
    );
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
