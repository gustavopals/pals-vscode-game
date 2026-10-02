import { balance } from '@lotg/content';
import { describe, expect, it } from 'vitest';

import { advanceTo } from './advance';
import { netRates, productionRate } from './economy';
import {
  addMoraleEffect,
  clampMorale,
  famineDesertsAt,
  moraleAt,
  moraleBand,
  moraleTermsAt,
} from './morale';
import { assignedWorkers } from './population';
import { cloneState, createInitialState } from './state';
import {
  accept,
  command,
  DAY,
  eventsOfType,
  gameAt,
  gameWith,
  HOUR,
  impoverishedScenario,
  MINUTE,
  newGame,
  play,
  proudScenario,
  quietGame,
  settings,
  SUMMER,
  WINTER,
  YEAR,
} from './test-helpers';
import { nextEventAt } from './timeline';
import type { GameEvent, GameState } from './types';
import { deriveViewState } from './view';

const view = (state: GameState, timeScale?: number) =>
  deriveViewState(state, state.lastProcessedAt, timeScale === undefined ? {} : { timeScale });

/** Os termos de uma virada em `atMs`, só com o nome e o valor. */
const termsAt = (state: GameState, atMs: number) =>
  moraleTermsAt(state, atMs).map((term) => [term.id, term.amount]);

const types = (events: GameEvent[]) => events.map((event) => event.type);
const moraleEvents = (events: GameEvent[]) =>
  events.filter((event) =>
    ['moraleBandChanged', 'villagerArrived', 'villagerLeft', 'villagerDeserted'].includes(
      event.type,
    ),
  );

/**
 * Verão, no começo de um dia: 22 habitantes em 25 vagas e três lavradores veteranos, que
 * alimentam todos com folga pequena. A reserva de comida deste feudo seria de 528, e a Despensa
 * só guarda 500: o bônus nunca vem. Nada pesa nem ajuda, por quantos dias for: a moral é a
 * base. Os testes mexem em uma coisa de cada vez.
 */
const plain = (edit: (draft: GameState) => void = () => {}) =>
  gameAt(SUMMER, (draft) => {
    draft.settlement.population.villagers = 22;
    draft.settlement.buildings.housing = 4;
    draft.settlement.workers.farm = 3;
    draft.settlement.resources.food = 40_000;
    edit(draft);
  });

/** O feudo do começo (5 habitantes, 10 vagas) no verão, sem lavrador, com `food` de comida. */
const small = (food: number, edit: (draft: GameState) => void = () => {}) =>
  gameAt(SUMMER, (draft) => {
    draft.settlement.resources.food = food;
    edit(draft);
  });

/** Um efeito temporário de teste, longo o bastante para não vencer no caminho. */
const withEffect = (amount: number, edit: (draft: GameState) => void = () => {}) =>
  plain((draft) => {
    addMoraleEffect(draft, {
      id: 'teste',
      label: 'efeito de teste',
      amount,
      untilMs: draft.lastProcessedAt + YEAR,
    });
    edit(draft);
  });

describe('a conta da moral (GDD §5.7; ADR 0013, decisão 19)', () => {
  it('sem nada que pese ou ajude, é a base: 50', () => {
    const state = plain();
    expect(termsAt(state, SUMMER + DAY)).toEqual([['base', 50]]);
    expect(moraleAt(state, SUMMER + DAY)).toBe(50);
    expect(advanceTo(state, SUMMER + DAY).state.settlement.morale).toBe(50);
  });

  it('comida guardada para 24 h de jogo de consumo, sem contar a produção: +10', () => {
    // 5 habitantes comem 120 em 24 h de jogo. Com 120 exatos vale; com um milésimo a menos, não.
    expect(termsAt(small(120_000), SUMMER + DAY)).toEqual([
      ['base', 50],
      ['foodReserve', 10],
    ]);
    expect(termsAt(small(119_999), SUMMER + DAY)).toEqual([['base', 50]]);
    // A reserva é do consumo de agora: com quase o dobro de bocas, a mesma comida não cobre.
    const crowded = small(120_000, (draft) => {
      draft.settlement.population.villagers = 9;
    });
    expect(termsAt(crowded, SUMMER + DAY)).toEqual([['base', 50]]);
    // E é a comida que há na virada, não a de agora: a 5 por hora, 125 viram 115 em um dia.
    expect(advanceTo(small(130_000), SUMMER + DAY).state.settlement.morale).toBe(60);
    expect(advanceTo(small(125_000), SUMMER + DAY).state.settlement.morale).toBe(50);
  });

  it('o resto de produção que ainda não virou milésimo entra na conta da reserva', () => {
    const almost = small(119_999, (draft) => {
      draft.settlement.accumulators.food = HOUR;
    });
    expect(termsAt(almost, SUMMER + DAY)).toContainEqual(['foodReserve', 10]);
    const owing = small(120_000, (draft) => {
      draft.settlement.accumulators.food = -1;
    });
    expect(termsAt(owing, SUMMER + DAY)).toEqual([['base', 50]]);
  });

  it('fome: −20, e mais −2 por dia de jogo inteiro de fome contínua', () => {
    const starving = (since: number) =>
      plain((draft) => {
        draft.settlement.workers.farm = 0;
        draft.settlement.resources.food = 0;
        draft.settlement.famine = { sinceMs: since };
      });
    // A fome começou há meia hora: nenhum dia inteiro ainda.
    const fresh = starving(SUMMER - 30 * MINUTE);
    expect(termsAt(fresh, SUMMER)).toEqual([
      ['base', 50],
      ['famine', -20],
    ]);
    // Um dia inteiro, um milissegundo a menos que dois, e seis.
    expect(termsAt(fresh, SUMMER - 30 * MINUTE + DAY)).toContainEqual(['famineDays', -2]);
    expect(termsAt(fresh, SUMMER - 30 * MINUTE + 2 * DAY - 1)).toContainEqual(['famineDays', -2]);
    expect(termsAt(starving(SUMMER - 6 * DAY), SUMMER)).toEqual([
      ['base', 50],
      ['famine', -20],
      ['famineDays', -12],
    ]);
    expect(moraleAt(starving(SUMMER - 6 * DAY), SUMMER)).toBe(18);
  });

  it('habitação cheia: −10 com tantos habitantes quantas vagas, ou mais', () => {
    const withVillagers = (villagers: number) =>
      plain((draft) => {
        draft.settlement.population.villagers = villagers;
      });
    expect(termsAt(withVillagers(24), SUMMER + DAY)).toEqual([['base', 50]]);
    expect(termsAt(withVillagers(25), SUMMER + DAY)).toEqual([
      ['base', 50],
      ['housingFull', -10],
    ]);
    // Uma partida que veio de antes pode ter mais gente do que vagas.
    expect(termsAt(withVillagers(27), SUMMER + DAY)).toContainEqual(['housingFull', -10]);
    // Quem ainda está a caminho não ocupa casa: só conta quem já mora.
    const training = plain((draft) => {
      draft.settlement.population.villagers = 24;
      draft.settlement.recruitmentQueue = [{ finishesAtMs: SUMMER + 5 * DAY }];
    });
    expect(termsAt(training, SUMMER + DAY)).not.toContainEqual(['housingFull', -10]);
  });

  it('frio: −20 enquanto a estação queima lenha', () => {
    const cold = gameAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources = { food: 40_000, wood: 0, stone: 0, gold: 0 };
      draft.settlement.cold = { sinceMs: WINTER + 2 * DAY };
    });
    expect(termsAt(cold, WINTER + 4 * DAY)).toEqual([
      ['base', 50],
      ['cold', -20],
    ]);
    // Na virada para a primavera o frio termina sempre: a conta dessa virada já não o tem.
    expect(termsAt(cold, YEAR)).toEqual([['base', 50]]);
  });

  it('fome e frio juntos somam, com as casas cheias e os dias de fome: tudo em uma conta', () => {
    const state = gameAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
      draft.settlement.famine = { sinceMs: WINTER + DAY };
      draft.settlement.cold = { sinceMs: WINTER + 2 * DAY };
    });
    expect(termsAt(state, WINTER + 4 * DAY)).toEqual([
      ['base', 50],
      ['famine', -20],
      ['famineDays', -6],
      ['housingFull', -10],
      ['cold', -20],
    ]);
    // 50 − 20 − 6 − 10 − 20 = −6: a moral não desce de zero.
    expect(moraleAt(state, WINTER + 4 * DAY)).toBe(0);
  });

  it('limites: nunca abaixo de 0 nem acima de 100', () => {
    expect(clampMorale(-56)).toBe(0);
    expect(clampMorale(0)).toBe(0);
    expect(clampMorale(100)).toBe(100);
    expect(clampMorale(131)).toBe(100);
    expect(advanceTo(withEffect(70), SUMMER + DAY).state.settlement.morale).toBe(100);
    expect(advanceTo(withEffect(-70), SUMMER + DAY).state.settlement.morale).toBe(0);
  });

  it('as faixas viram em 25, 50 e 75', () => {
    const bandOf = (value: number) => moraleBand(value).id;
    expect([0, 24].map(bandOf)).toEqual(['desperate', 'desperate']);
    expect([25, 49].map(bandOf)).toEqual(['restless', 'restless']);
    expect([50, 74].map(bandOf)).toEqual(['content', 'content']);
    expect([75, 100].map(bandOf)).toEqual(['proud', 'proud']);
  });
});

describe('a moral só muda na virada do dia', () => {
  it('um feudo novo nasce com 50 e a primeira virada recalcula: 60, com a comida guardada', () => {
    const start = newGame();
    expect(start.settlement.morale).toBe(50);
    expect(start.settlement.moraleEffects).toEqual([]);
    expect(advanceTo(start, DAY - 1).state.settlement.morale).toBe(50);
    const { state, events } = advanceTo(start, DAY);
    expect(state.settlement.morale).toBe(60);
    // Subiu dentro da mesma faixa: a Crônica não diz nada.
    expect(moraleEvents(events)).toEqual([]);
  });

  it('o fator que mudou no meio do dia só entra na virada seguinte', () => {
    // A comida acaba às 36 h, em cima de uma virada: a conta dessa virada ainda não vê a fome,
    // que abre no fim do instante. A seguinte vê, com um dia inteiro.
    const { state: at36 } = advanceTo(newGame(), 36 * HOUR);
    expect(at36.settlement.famine).toEqual({ sinceMs: 36 * HOUR });
    expect(at36.settlement.morale).toBe(50);
    expect(advanceTo(at36, 38 * HOUR - 1).state.settlement.morale).toBe(50);
    expect(advanceTo(at36, 38 * HOUR).state.settlement.morale).toBe(28);
  });

  it('a ordem dada no meio do dia não mexe na moral; a virada, sim', () => {
    // 200 de comida, 5 bocas e ninguém na Fazenda: uma hora depois há 195.
    const midday = advanceTo(small(200_000), SUMMER + HOUR).state;
    expect(midday.settlement.morale).toBe(50);
    // Gastar 100 em dois recrutas tira a reserva antes da virada: o bônus não vem.
    const spent = accept(midday, command('recruitVillagers', { quantity: 2 })).state;
    expect(spent.settlement.morale).toBe(50);
    expect(advanceTo(spent, SUMMER + DAY).state.settlement.morale).toBe(50);
    expect(advanceTo(midday, SUMMER + DAY).state.settlement.morale).toBe(60);
  });

  it('o frio que passa com a primavera já não pesa na primeira virada dela', () => {
    const cold = gameAt(YEAR - DAY, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources = { food: 40_000, wood: 0, stone: 0, gold: 0 };
      draft.settlement.cold = { sinceMs: WINTER };
      draft.settlement.morale = 30;
    });
    const { state, events } = advanceTo(cold, YEAR);
    expect(state.settlement.morale).toBe(50);
    expect(state.settlement.cold).toBeNull();
    // A estação vira, o dia amanhece, a moral é recalculada e só então o frio fecha.
    expect(types(events)).toEqual([
      'yearStarted',
      'seasonChanged',
      'dayStarted',
      'moraleBandChanged',
      'coldEnded',
    ]);
  });
});

describe('a moral na produção (GDD §5.3)', () => {
  const lone = { adapted: 1, adapting: 0 };
  const farmAt = (morale: number) =>
    productionRate(
      plain((draft) => {
        draft.settlement.morale = morale;
      }),
      'farm',
      lone,
    );

  it('o fator é (150 + moral) / 200: × 0,75 em 0, × 1 em 50 e × 1,25 em 100', () => {
    // Um lavrador no verão: 10 por hora.
    expect(farmAt(0)).toBe(7_500);
    expect(farmAt(50)).toBe(10_000);
    expect(farmAt(100)).toBe(12_500);
    expect(farmAt(68)).toBe(10_900);
    expect(farmAt(51)).toBe(10_050);
  });

  it('entra na conta única, com os outros fatores e um arredondamento só no fim', () => {
    const state = gameAt(WINTER + DAY, (draft) => {
      const { settlement } = draft;
      settlement.workers.farm = 3;
      settlement.buildings.farm = 3;
      settlement.craftExperience.farm = 37;
      settlement.morale = 33;
      settlement.resources.food = 0;
      settlement.resources.wood = 0;
      settlement.famine = { sinceMs: WINTER };
      settlement.cold = { sinceMs: WINTER };
    });
    // 3 × 10 × 1,4 (Nv3) × 1,111 (mestria 37) × 0,4 (inverno) × 0,915 (moral 33) × 0,75 × 0,8
    // = 10,2469752: 10.246 milésimos, arredondado para baixo uma vez.
    const exact = (3 * 10_000 * 14 * 1111 * 4 * 183 * 3 * 4) / (10 * 1000 * 10 * 200 * 4 * 5);
    expect(productionRate(state, 'farm')).toBe(Math.floor(exact));
    expect(exact).toBeCloseTo(10_246.9752, 4);
  });

  it('vale a partir da virada, no milissegundo, e a explicação mostra o termo', () => {
    // Um feudo novo com dois lavradores (em adaptação no primeiro dia) e 180 de comida.
    const start = accept(newGame(), command('setWorkers', { building: 'farm', count: 2 })).state;
    const before = advanceTo(start, DAY - 1).state;
    expect(netRates(before).food).toBe(12_000 - 5_000);
    const after = advanceTo(start, DAY).state;
    // 2 × 10 × 1,2 (primavera) × 1,012 (mestria 4) × 1,05 (moral 60) = 25,5024.
    expect(productionRate(after, 'farm')).toBe(25_502);
    expect(view(after).workers[0]?.breakdown).toBe(
      '2 trabalhadores × 10 × 1 (Nv1) × 1,012 (mestria 4) × 1,2 (primavera) × 1,05 (moral 60) = 25,5/h',
    );
    // Com a moral na base o termo não aparece.
    expect(view(start).workers[0]?.breakdown).not.toContain('moral');
  });
});

describe('faixas na Crônica', () => {
  it('só a mudança de faixa vira linha, com a frase do sentido', () => {
    // Sem o Conselho: uma carta que expira mexe na moral, e aqui só a fome fala.
    const { events } = advanceTo(quietGame(), 22 * DAY - 1);
    const changes = eventsOfType(events, 'moraleBandChanged');
    expect(changes.map((event) => [event.atMs / DAY, event.data])).toEqual([
      // A fome abriu na 18ª virada; a 19ª conta −20 e um dia inteiro.
      [19, { morale: 28, band: 'restless', previousMorale: 50, previousBand: 'content' }],
      // 26 na 20ª (mesma faixa, sem linha) e 24 na 21ª.
      [21, { morale: 24, band: 'desperate', previousMorale: 26, previousBand: 'restless' }],
    ]);
    expect(changes.map((event) => event.text)).toEqual([
      'No 20º dia da Primavera, o povo de Pedra Alta anda inquieto. Há resmungos junto ao poço.',
      'No 22º dia da Primavera, o povo de Pedra Alta perdeu a esperança. Já se fala em ir embora.',
    ]);
  });

  it('quem sobe de faixa ouve outra frase', () => {
    const recovering = plain((draft) => {
      draft.settlement.morale = 10;
    });
    const { state, events } = advanceTo(recovering, SUMMER + DAY);
    expect(state.settlement.morale).toBe(50);
    expect(eventsOfType(events, 'moraleBandChanged').map((event) => event.text)).toEqual([
      'No 2º dia do Verão, os resmungos cessaram em Pedra Alta. O povo está contente.',
    ]);
    const proud = advanceTo(withEffect(30), SUMMER + DAY);
    expect(eventsOfType(proud.events, 'moraleBandChanged').map((event) => event.text)).toEqual([
      'No 2º dia do Verão, o povo de Pedra Alta anda de cabeça erguida. Fala-se do feudo nas estradas.',
    ]);
    const lessProud = advanceTo(
      plain((draft) => {
        draft.settlement.morale = 90;
      }),
      SUMMER + DAY,
    );
    expect(eventsOfType(lessProud.events, 'moraleBandChanged').map((event) => event.text)).toEqual([
      'No 2º dia do Verão, o orgulho de Pedra Alta arrefeceu. O povo segue contente, e só.',
    ]);
    const lessDesperate = advanceTo(
      withEffect(-20, (draft) => {
        draft.settlement.morale = 0;
      }),
      SUMMER + DAY,
    );
    expect(lessDesperate.state.settlement.morale).toBe(30);
    expect(
      eventsOfType(lessDesperate.events, 'moraleBandChanged').map((event) => event.text),
    ).toEqual(['No 2º dia do Verão, o pior passou em Pedra Alta, mas o povo ainda anda inquieto.']);
  });

  it('dias seguidos na mesma faixa não repetem a linha', () => {
    const { state, events } = advanceTo(withEffect(-10), SUMMER + 10 * DAY);
    expect(state.settlement.morale).toBe(40);
    expect(eventsOfType(events, 'moraleBandChanged')).toHaveLength(1);
  });
});

describe('efeitos temporários de moral', () => {
  const effect = (untilMs: number, amount = 5, id = 'carta:tabuas') => ({
    id,
    label: 'carta: Tábuas para as reservas',
    amount,
    untilMs,
  });

  it('criado no meio do dia, por dois dias: conta em exatamente duas viradas e sai da lista', () => {
    const state = cloneState(advanceTo(plain(), SUMMER + 30 * MINUTE).state);
    addMoraleEffect(state, effect(state.lastProcessedAt + 2 * DAY));
    // O efeito não mexe na moral na hora.
    expect(state.settlement.morale).toBe(50);
    const first = advanceTo(state, SUMMER + DAY).state;
    expect(first.settlement.morale).toBe(55);
    const second = advanceTo(first, SUMMER + 2 * DAY).state;
    expect(second.settlement.morale).toBe(55);
    // Enquanto a moral o carrega, ele está na lista.
    expect(second.settlement.moraleEffects).toHaveLength(1);
    const third = advanceTo(second, SUMMER + 3 * DAY).state;
    expect(third.settlement.morale).toBe(50);
    expect(third.settlement.moraleEffects).toEqual([]);
  });

  it('criado em cima de uma virada, por dois dias: também duas viradas', () => {
    const state = plain((draft) => {
      addMoraleEffect(draft, effect(SUMMER + 2 * DAY));
    });
    const on = (day: number) => advanceTo(state, SUMMER + day * DAY).state.settlement;
    expect([1, 2, 3].map((day) => on(day).morale)).toEqual([55, 55, 50]);
    expect([1, 2, 3].map((day) => on(day).moraleEffects.length)).toEqual([1, 1, 0]);
  });

  it('entra na conta como um termo com nome, e vários somam', () => {
    const state = plain((draft) => {
      addMoraleEffect(draft, effect(SUMMER + 3 * DAY));
      addMoraleEffect(draft, {
        id: 'incursao:1',
        label: 'incursão sofrida',
        amount: -10,
        untilMs: SUMMER + 2 * DAY,
      });
    });
    expect(termsAt(state, SUMMER + DAY)).toEqual([
      ['base', 50],
      ['effect', 5],
      ['effect', -10],
    ]);
    const moraleOn = (day: number) => advanceTo(state, SUMMER + day * DAY).state.settlement.morale;
    expect([1, 2, 3, 4].map(moraleOn)).toEqual([45, 45, 55, 50]);
  });

  it('gravar de novo o mesmo efeito troca, não soma', () => {
    const state = plain((draft) => {
      addMoraleEffect(draft, effect(SUMMER + 2 * DAY));
      addMoraleEffect(draft, effect(SUMMER + 4 * DAY, 8));
      addMoraleEffect(draft, effect(SUMMER + 2 * DAY, -3, 'outro'));
    });
    expect(state.settlement.moraleEffects).toEqual([
      effect(SUMMER + 4 * DAY, 8),
      effect(SUMMER + 2 * DAY, -3, 'outro'),
    ]);
  });

  it('recusa efeito sem nome, sem valor ou que já nasce vencido', () => {
    const tryAdd = (change: Partial<ReturnType<typeof effect>>) => () =>
      plain((draft) => {
        addMoraleEffect(draft, { ...effect(SUMMER + DAY), ...change });
      });
    expect(tryAdd({})).not.toThrow();
    expect(tryAdd({ id: '' })).toThrow();
    expect(tryAdd({ label: '' })).toThrow();
    expect(tryAdd({ amount: 0 })).toThrow();
    expect(tryAdd({ amount: 1.5 })).toThrow();
    expect(tryAdd({ untilMs: SUMMER })).toThrow();
    expect(tryAdd({ untilMs: Number.NaN })).toThrow();
  });

  it('avançar de uma vez ou virada a virada dá a mesma moral e a mesma lista', () => {
    const state = plain((draft) => {
      addMoraleEffect(draft, effect(SUMMER + 3 * DAY + 17));
      addMoraleEffect(draft, effect(SUMMER + 5 * DAY, -30, 'incursao:1'));
    });
    const direct = advanceTo(state, SUMMER + 8 * DAY);
    let stepped = state;
    const events: GameEvent[] = [];
    for (let at = SUMMER + 37 * MINUTE; at < SUMMER + 8 * DAY + 37 * MINUTE; at += 37 * MINUTE) {
      const result = advanceTo(stepped, Math.min(at, SUMMER + 8 * DAY));
      stepped = result.state;
      events.push(...result.events);
    }
    expect(direct.state.settlement.moraleEffects).toEqual([]);
    expect(eventsOfType(direct.events, 'moraleBandChanged').length).toBeGreaterThan(0);
    expect(stepped).toStrictEqual(direct.state);
    expect(events).toStrictEqual(direct.events);
  });
});

describe('sorteios da moral (fluxo morale)', () => {
  const seeded = (seed: string, base: GameState): GameState => ({ ...base, seed });
  const seeds = Array.from({ length: 200 }, (_, index) => `semente-${index}`);

  it('moral 80 ou mais com vaga: 20% de chance de um colono chegar, a cada virada', () => {
    // 50 + 30 = 80, com 3 vagas livres.
    const proud = withEffect(30);
    const outcomes = seeds.map((seed) => advanceTo(seeded(seed, proud), SUMMER + DAY));
    const arrived = outcomes.filter(
      ({ events }) => eventsOfType(events, 'villagerArrived').length === 1,
    );
    // 200 viradas a 20%: 40 esperados. As sementes são fixas; a faixa só diz que é sorteio.
    expect(arrived.length).toBeGreaterThan(25);
    expect(arrived.length).toBeLessThan(55);
    for (const { state } of outcomes) {
      // Todo mundo sorteou, chegando alguém ou não.
      expect(state.rng.morale).toBeDefined();
      expect(Object.keys(state.rng)).toEqual(['morale']);
    }
    const [first] = arrived;
    expect(first?.state.settlement.population.villagers).toBe(23);
    // O colono chega sem ofício.
    expect(assignedWorkers(first?.state as GameState)).toBe(3);
    expect(eventsOfType(first?.events ?? [], 'villagerArrived')[0]).toMatchObject({
      atMs: SUMMER + DAY,
      text: 'No 2º dia do Verão, um colono bateu ao portão, atraído pela fama de Pedra Alta. Agora são 23.',
      data: { villagers: 23, morale: 80 },
    });
  });

  it('com 79 ninguém sorteia; sem vaga, também não', () => {
    const almost = advanceTo(withEffect(29), SUMMER + DAY).state;
    expect(almost.settlement.morale).toBe(79);
    expect(almost.rng).toEqual({});
    // 50 + 45 − 10 (casas cheias) = 85, mas não há onde morar.
    const full = withEffect(45, (draft) => {
      draft.settlement.population.villagers = 25;
    });
    const { state, events } = advanceTo(full, SUMMER + 20 * DAY);
    expect(state.settlement.morale).toBe(85);
    expect(state.rng).toEqual({});
    expect(eventsOfType(events, 'villagerArrived')).toEqual([]);
    // A vaga de quem está em treinamento já tem dono: o colono não a toma.
    const reserved = withEffect(40, (draft) => {
      draft.settlement.population.villagers = 24;
      draft.settlement.recruitmentQueue = [{ finishesAtMs: SUMMER + 30 * DAY }];
    });
    const later = advanceTo(reserved, SUMMER + 20 * DAY);
    expect(later.state.settlement.morale).toBe(90);
    expect(later.state.rng).toEqual({});
  });

  it('moral 25 ou menos: 20% de chance de um aldeão partir; com 26, ninguém sorteia', () => {
    const low = withEffect(-25);
    const outcomes = seeds.map((seed) => advanceTo(seeded(seed, low), SUMMER + DAY));
    const left = outcomes.filter(({ events }) => eventsOfType(events, 'villagerLeft').length === 1);
    expect(left.length).toBeGreaterThan(25);
    expect(left.length).toBeLessThan(55);
    const [first] = left;
    expect(first?.state.settlement.morale).toBe(25);
    expect(first?.state.settlement.population.villagers).toBe(21);
    // Havia gente sem ofício: foi um deles, e os lavradores ficaram.
    expect(first?.state.settlement.workers.farm).toBe(3);
    const [event] = eventsOfType(first?.events ?? [], 'villagerLeft');
    expect(event).toMatchObject({
      atMs: SUMMER + DAY,
      text: 'No 2º dia do Verão, um aldeão sem ofício juntou a trouxa e deixou Pedra Alta: o povo anda sem ânimo. Restam 21.',
      data: { villagers: 21, morale: 25 },
    });
    expect(event?.data).not.toHaveProperty('building');
    expect(advanceTo(withEffect(-24), SUMMER + DAY).state.rng).toEqual({});
  });

  it('quando todos trabalham, parte quem está no edifício com mais gente, e a frase diz quem foi', () => {
    const busy = withEffect(-30, (draft) => {
      draft.settlement.workers = { farm: 3, lumberMill: 19, quarry: 0, goldMine: 0 };
    });
    const gone = seeds
      .map((seed) => advanceTo(seeded(seed, busy), SUMMER + DAY))
      .find(({ events }) => eventsOfType(events, 'villagerLeft').length === 1);
    expect(gone?.state.settlement.workers).toEqual({
      farm: 3,
      lumberMill: 18,
      quarry: 0,
      goldMine: 0,
    });
    expect(eventsOfType(gone?.events ?? [], 'villagerLeft')[0]).toMatchObject({
      text: 'No 2º dia do Verão, um lenhador juntou a trouxa e deixou Pedra Alta: o povo anda sem ânimo. Restam 21.',
      data: { villagers: 21, morale: 20, building: 'lumberMill' },
    });
  });

  it('piso de 3 aldeões: no piso ninguém parte, e o gerador nem anda', () => {
    const floor = withEffect(-50, (draft) => {
      draft.settlement.population.villagers = 3;
    });
    const { state, events } = advanceTo(floor, SUMMER + 60 * DAY);
    // Três lavradores para três bocas: a comida sobra e a reserva vem. 50 + 10 − 50.
    expect(state.settlement.morale).toBe(10);
    expect(state.settlement.population.villagers).toBe(3);
    expect(state.rng).toEqual({});
    expect(eventsOfType(events, 'villagerLeft')).toEqual([]);
    // Com gente acima do piso, 120 dias de moral baixa levam até ele e param.
    const crowd = withEffect(-50, (draft) => {
      draft.settlement.population.villagers = 8;
    });
    const emptied = advanceTo(crowd, SUMMER + 120 * DAY);
    expect(emptied.state.settlement.population.villagers).toBe(3);
    expect(eventsOfType(emptied.events, 'villagerLeft')).toHaveLength(5);
    expect(eventsOfType(emptied.events, 'villagerDeserted')).toEqual([]);
  });

  it('a mesma semente dá as mesmas chegadas; outra semente, outras', () => {
    const proud = withEffect(30, (draft) => {
      draft.settlement.buildings.housing = 8;
    });
    const run = (seed: string) =>
      eventsOfType(advanceTo(seeded(seed, proud), SUMMER + 40 * DAY).events, 'villagerArrived').map(
        (event) => event.atMs,
      );
    expect(run('pedra-alta')).toEqual(run('pedra-alta'));
    expect(run('pedra-alta').length).toBeGreaterThan(0);
    expect(run('pedra-alta')).not.toEqual(run('pedra-baixa'));
  });
});

describe('deserção por fome (GDD §5.6)', () => {
  /** Verão, 8 habitantes sem comida nem lavrador: a fome começou há `agoMs`. */
  const starving = (agoMs: number, edit: (draft: GameState) => void = () => {}) =>
    gameAt(SUMMER, (draft) => {
      draft.settlement.population.villagers = 8;
      draft.settlement.workers = { farm: 0, lumberMill: 3, quarry: 3, goldMine: 2 };
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: SUMMER - agoMs };
      // A moral fica alta de propósito: aqui só a fome tira gente, sem sorteio.
      addMoraleEffect(draft, {
        id: 'teste',
        label: 'efeito de teste',
        amount: 60,
        untilMs: draft.lastProcessedAt + YEAR,
      });
      edit(draft);
    });

  it('com 12 h de jogo de fome contínua, um aldeão deserta a cada virada de dia', () => {
    // A fome começou 10 h e 30 min antes: as 12 h se completam daqui a 90 minutos, no meio de
    // um dia. A primeira virada com 12 h completas é a do fim desse dia.
    const state = starving(10 * HOUR + 30 * MINUTE);
    expect(famineDesertsAt(state, SUMMER)).toBe(false);
    expect(famineDesertsAt(state, SUMMER + DAY)).toBe(true);
    const { state: end, events } = advanceTo(state, SUMMER + 3 * DAY);
    const deserted = eventsOfType(events, 'villagerDeserted');
    expect(deserted.map((event) => event.atMs)).toEqual([
      SUMMER + DAY,
      SUMMER + 2 * DAY,
      SUMMER + 3 * DAY,
    ]);
    expect(end.settlement.population.villagers).toBe(5);
    // Todos trabalhavam: sai do edifício com mais gente, na ordem do conteúdo no empate.
    expect(deserted.map((event) => event.data)).toEqual([
      // 50 + 60 − 20 − 12 (6 dias inteiros de fome) = 78, e dois a menos a cada dia.
      { villagers: 7, morale: 78, building: 'lumberMill' },
      { villagers: 6, morale: 76, building: 'quarry' },
      { villagers: 5, morale: 74, building: 'lumberMill' },
    ]);
    expect(deserted[0]?.text).toBe(
      'No 2º dia do Verão, um lenhador fugiu da fome de Pedra Alta na calada da noite. Restam 7.',
    );
    expect(end.settlement.workers).toEqual({ farm: 0, lumberMill: 1, quarry: 2, goldMine: 2 });
    // Não houve sorteio nenhum: a deserção é certa.
    expect(end.rng).toEqual({});
  });

  it('exatamente 12 h em cima de uma virada: deserta nela', () => {
    const { events } = advanceTo(starving(12 * HOUR - DAY), SUMMER + DAY);
    expect(eventsOfType(events, 'villagerDeserted')).toHaveLength(1);
    const early = advanceTo(starving(12 * HOUR - DAY - 1), SUMMER + DAY);
    expect(eventsOfType(early.events, 'villagerDeserted')).toEqual([]);
  });

  it('para no piso de 3 aldeões', () => {
    const { state, events } = advanceTo(starving(12 * HOUR), SUMMER + 30 * DAY);
    expect(state.settlement.population.villagers).toBe(3);
    expect(eventsOfType(events, 'villagerDeserted')).toHaveLength(5);
    expect(assignedWorkers(state)).toBeLessThanOrEqual(3);
  });

  it('em Camponês ninguém deserta; em Senhor e Rei de Ferro, sim', () => {
    const desertionsIn = (difficulty: GameState['settings']['difficulty']) => {
      const state = starving(12 * HOUR, (draft) => {
        draft.settings.difficulty = difficulty;
      });
      return eventsOfType(advanceTo(state, SUMMER + 4 * DAY).events, 'villagerDeserted').length;
    };
    expect(desertionsIn('peasant')).toBe(0);
    expect(desertionsIn('lord')).toBe(4);
    expect(desertionsIn('ironKing')).toBe(4);
  });

  it('a fome que acaba antes do prazo não leva ninguém', () => {
    const state = starving(11 * HOUR);
    // Seis lavradores, mesmo recém-chegados e com a penalidade, alimentam as 8 bocas.
    const fed = play(state, [
      command('setWorkers', { building: 'lumberMill', count: 0 }),
      command('setWorkers', { building: 'quarry', count: 0 }),
      command('setWorkers', { building: 'farm', count: 6 }),
      { at: SUMMER + DAY },
    ]);
    expect(types(fed.events)).toContain('famineEnded');
    expect(eventsOfType(fed.events, 'villagerDeserted')).toEqual([]);
    expect(fed.state.settlement.famine).toBeNull();
  });

  it('quem deserta alivia a despensa: a fome pode acabar no mesmo instante', () => {
    // 6 habitantes e 1 lavrador veterano, com a moral em zero: 10 × 0,75 (fome) × 0,75 (moral)
    // = 5,625 de comida por hora, no verão.
    const state = gameAt(SUMMER, (draft) => {
      draft.settlement.population.villagers = 6;
      draft.settlement.workers = { farm: 1, lumberMill: 5, quarry: 0, goldMine: 0 };
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: SUMMER - 20 * DAY };
      draft.settlement.morale = 0;
    });
    // 5,625 contra 6 bocas: a fome continua. Na virada, alguém deserta (e talvez outro parta):
    // com 5 bocas ou menos o saldo fica positivo, e a fome acaba ali mesmo.
    expect(netRates(state).food).toBeLessThan(0);
    const { state: end, events } = advanceTo(state, SUMMER + DAY);
    expect(end.settlement.population.villagers).toBeLessThan(6);
    expect(end.settlement.famine).toBeNull();
    const order = types(events);
    expect(order.indexOf('villagerDeserted')).toBeLessThan(order.indexOf('famineEnded'));
  });
});

describe('a ordem na virada do dia (ADR 0013)', () => {
  it('experiência do ofício, moral, sorteios da moral, deserção', () => {
    const state = gameAt(SUMMER, (draft) => {
      const { settlement } = draft;
      settlement.population.villagers = 8;
      settlement.workers = { farm: 0, lumberMill: 3, quarry: 3, goldMine: 2 };
      settlement.craftExperience.lumberMill = 96;
      settlement.resources.food = 0;
      settlement.famine = { sinceMs: SUMMER - 12 * HOUR };
      settlement.morale = 60;
    });
    const seed = Array.from({ length: 200 }, (_, index) => `ordem-${index}`).find((candidate) =>
      types(advanceTo({ ...state, seed: candidate }, SUMMER + DAY).events).includes('villagerLeft'),
    );
    expect(seed).toBeDefined();
    const { events } = advanceTo({ ...state, seed: seed as string }, SUMMER + DAY);
    expect(types(events)).toEqual([
      'dayStarted',
      'craftMastered',
      'moraleBandChanged',
      'villagerLeft',
      'villagerDeserted',
    ]);
    // A moral que os sorteios leem é a recém-calculada: 50 − 20 − 14 (7 dias inteiros).
    expect(eventsOfType(events, 'moraleBandChanged')[0]?.data).toMatchObject({ morale: 16 });
  });
});

describe('a simulação termina', () => {
  it('com a moral mudando de faixa, gente partindo e a fome acabando, o próximo evento é sempre depois de agora', () => {
    // 6 habitantes, um lavrador e a moral no chão: a fome dura até alguém desertar, acaba no
    // mesmo instante, a moral sobe de faixa na virada seguinte, e o feudo segue.
    let state = gameAt(SUMMER, (draft) => {
      draft.settlement.population.villagers = 6;
      draft.settlement.workers = { farm: 1, lumberMill: 5, quarry: 0, goldMine: 0 };
      draft.settlement.resources.food = 0;
      draft.settlement.famine = { sinceMs: SUMMER - 20 * DAY };
      draft.settlement.morale = 0;
    });
    const seen = new Set<string>();
    let steps = 0;
    while (state.lastProcessedAt < SUMMER + 40 * DAY) {
      const next = nextEventAt(state);
      expect(next).not.toBeNull();
      expect(next as number).toBeGreaterThan(state.lastProcessedAt);
      const result = advanceTo(state, next as number);
      // Parar em cima do instante e pedir o mesmo instante de novo não refaz nada.
      expect(advanceTo(result.state, next as number).events).toEqual([]);
      for (const event of result.events) {
        seen.add(event.type);
      }
      state = result.state;
      steps += 1;
    }
    expect(seen).toContain('villagerDeserted');
    expect(seen).toContain('famineEnded');
    expect(seen).toContain('moraleBandChanged');
    // Um evento por virada de dia e mais alguns (o estoque que enche, a fome que acaba): nada
    // de laço no mesmo instante.
    expect(steps).toBeLessThan(120);
  });
});

describe('30 dias sem acesso, com fome', () => {
  const THIRTY_DAYS = 30 * 24 * HOUR;

  it('Senhor: a moral cai, os aldeões partem e desertam, e o feudo para no piso', () => {
    const { state, events } = advanceTo(newGame(), THIRTY_DAYS);
    expect(state.settlement.famine).toEqual({ sinceMs: 36 * HOUR });
    expect(state.settlement.morale).toBe(0);
    expect(state.settlement.population.villagers).toBe(3);
    const gone = events.filter(
      (event) => event.type === 'villagerLeft' || event.type === 'villagerDeserted',
    );
    expect(gone).toHaveLength(2);
    // A primeira deserção é na 24ª virada: 12 h de jogo depois das 36 h.
    expect(eventsOfType(events, 'villagerDeserted')[0]?.atMs).toBe(48 * HOUR);
    expect(eventsOfType(events, 'villagerDeserted')[0]?.atMs).toBe(24 * DAY);
    for (const amount of Object.values(state.settlement.resources)) {
      expect(amount).toBeGreaterThanOrEqual(0);
    }
  });

  it('Camponês: ninguém deserta; a moral baixa ainda pode levar alguém, até o piso', () => {
    const start = createInitialState('pedra-alta', { ...settings, difficulty: 'peasant' });
    const { state, events } = advanceTo(start, THIRTY_DAYS);
    expect(eventsOfType(events, 'villagerDeserted')).toEqual([]);
    expect(state.settlement.population.villagers).toBeGreaterThanOrEqual(3);
    expect(eventsOfType(events, 'villagerLeft')).toHaveLength(
      5 - state.settlement.population.villagers,
    );
  });

  it('de uma vez ou hora a hora: o mesmo estado, os mesmos eventos, o mesmo gerador', () => {
    const direct = advanceTo(newGame(), THIRTY_DAYS);
    let state = newGame();
    const events: GameEvent[] = [];
    for (let hour = 1; hour <= 30 * 24; hour += 1) {
      const result = advanceTo(state, hour * HOUR);
      state = result.state;
      events.push(...result.events);
    }
    expect(state).toStrictEqual(direct.state);
    expect(state.rng).toStrictEqual(direct.state.rng);
    expect(events).toStrictEqual(direct.events);
    expect(direct.state.rng.morale).toBeDefined();
  });
});

describe('feudo empobrecido (roadmap V2C-T4.6): há caminho de volta', () => {
  // O fundo do poço: inverno, 3 aldeões sem ofício, nem comida nem madeira, fome há 20 dias,
  // frio desde a virada da estação e moral zero.
  const ruined = impoverishedScenario;

  it('a visão diz o que mais pesa e o que fazer', () => {
    const { morale, famine, winter } = view(ruined());
    expect(famine).not.toBeNull();
    expect(winter?.cold).not.toBeNull();
    expect(morale).toMatchObject({ value: 0, band: 'desperate', multiplierPercent: 75 });
    expect(morale.advice).toBe(
      'O que mais pesa é a fome (−62). Ponha mais gente na Fazenda: quando a comida voltar a sobrar, a fome acaba e a moral sobe na virada seguinte.',
    );
    // No piso, a visão não ameaça com o que não pode acontecer: diz a proteção.
    expect(morale.notes).toEqual([
      'Restam 3 aldeões: com 3 ou menos, ninguém mais parte nem deserta.',
    ]);
    // Com um aldeão a mais, os dois avisos aparecem.
    const four = gameWith((draft) => {
      Object.assign(draft, cloneState(ruined()));
      draft.settlement.population.villagers = 4;
    });
    expect(view(four).morale.notes).toEqual([
      'Com a moral em 25 ou menos, cada virada do dia tem 20% de chance de levar um aldeão embora.',
      'A fome já dura 12 h ou mais: um aldeão deserta a cada virada do dia, até a comida voltar.',
    ]);
  });

  it.each(['lord', 'ironKing'] as const)(
    '%s: dois na Fazenda e um na Serraria tiram o feudo da fome, do frio e do desespero',
    (difficulty) => {
      const start = ruined(difficulty);
      const now = start.lastProcessedAt;
      const ordered = play(start, [
        command('setWorkers', { building: 'farm', count: 2 }),
        command('setWorkers', { building: 'lumberMill', count: 1 }),
      ]);
      // Enquanto se adaptam, rendem metade: nem a fome nem o frio passam ainda.
      expect(ordered.state.settlement.famine).not.toBeNull();
      expect(ordered.state.settlement.cold).not.toBeNull();

      // No fim da adaptação, um dia de jogo depois, os dois lavradores rendem 2 × 10 × 0,4 ×
      // 0,75 (fome) × 0,8 (frio) × 0,75 (moral 0) = 3,6 e pouco, contra 3 bocas; o lenhador,
      // 8 × 0,8 × 0,75 × 0,8 × 0,75 = 2,88 e pouco, contra 1,5 de lenha. A fome e o frio
      // acabam no mesmo instante.
      const adapted = advanceTo(ordered.state, now + DAY);
      expect(adapted.state.settlement.famine).toBeNull();
      expect(adapted.state.settlement.cold).toBeNull();
      const ended = adapted.events.filter(
        (event) => event.type === 'famineEnded' || event.type === 'coldEnded',
      );
      expect(ended.map((event) => [event.type, event.atMs])).toEqual([
        ['famineEnded', now + DAY],
        ['coldEnded', now + DAY],
      ]);
      const rates = netRates(adapted.state);
      expect(rates.food).toBeGreaterThan(0);
      expect(rates.wood).toBeGreaterThan(0);

      // Na virada seguinte a moral sai do zero: sem fome e sem frio, é a base.
      const recovered = advanceTo(adapted.state, WINTER + 4 * DAY);
      expect(recovered.state.settlement.morale).toBe(50);
      expect(eventsOfType(recovered.events, 'moraleBandChanged')[0]?.text).toBe(
        'No 5º dia do Inverno, os resmungos cessaram em Pedra Alta. O povo está contente.',
      );
      // E o feudo atravessa o resto do inverno com os três, sem fome nem frio de novo.
      const spring = advanceTo(recovered.state, YEAR + DAY);
      expect(spring.state.settlement.population.villagers).toBe(3);
      expect(types(spring.events)).not.toContain('famineStarted');
      expect(types(spring.events)).not.toContain('coldStarted');
      expect(spring.state.settlement.resources.food).toBeGreaterThan(0);
      expect(spring.state.settlement.morale).toBeGreaterThanOrEqual(50);
    },
  );

  it('entre a ordem certa e o fim da adaptação, a tela diz que a fome e o frio acabam sozinhos, e quando', () => {
    const start = ruined();
    const now = start.lastProcessedAt;
    // Antes da ordem não há o que prever: a tela manda pôr gente na Fazenda.
    expect(view(start).famine).toEqual({
      sinceMs: WINTER - 18 * DAY,
      secondsElapsed: (20 * DAY + 20 * MINUTE) / 1000,
      endsInSeconds: null,
      text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar.',
    });
    expect(view(start).winter?.cold?.endsInSeconds).toBeNull();

    const ordered = play(start, [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
    ]).state;
    const derived = view(ordered);
    // Os três acabaram de chegar ao ofício e rendem metade: a comida e a madeira ainda caem.
    expect(derived.resources.find((row) => row.id === 'food')?.perHour).toBe(-1.2);
    expect(derived.resources.find((row) => row.id === 'wood')?.perHour).toBe(-0.1);
    expect(derived.population.free).toBe(0);
    // Mas a adaptação termina em um dia de jogo (2 h), e com ela a fome e o frio: é o que o
    // motor faz (teste acima), e a tela já diz, em vez de pedir mais gente.
    expect(derived.famine).toMatchObject({
      endsInSeconds: 7200,
      text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar. Os lavradores ainda se adaptam: em 2 h rendem inteiro, a comida volta a sobrar e a fome acaba. Não é preciso mexer neles.',
    });
    expect(derived.winter?.cold).toMatchObject({
      endsInSeconds: 7200,
      text: 'Frio: sem lenha, a produção de todo o feudo cai para 80%. A lareira pede 1,5/h e a Serraria entrega 1,44/h. Os lenhadores ainda se adaptam: em 2 h rendem inteiro e o frio passa. Não é preciso mexer neles.',
    });
    expect(derived.morale.advice).toBe(
      'O que mais pesa é a fome (−62). Ela acaba sozinha em 2 h, sem ninguém mudar de ofício, e a moral sobe na virada seguinte.',
    );
    const relieved = advanceTo(ordered, now + DAY);
    expect(relieved.state.settlement.famine).toBeNull();
    expect(relieved.state.settlement.cold).toBeNull();
    expect(advanceTo(ordered, now + DAY - 1).state.settlement.famine).not.toBeNull();

    // No ritmo Rápido os mesmos dois dias de jogo são 40 minutos de relógio.
    const fast = view(ordered, 3);
    expect(fast.famine?.endsInSeconds).toBe(2400);
    expect(fast.famine?.text).toContain('em 40 min rendem inteiro');
    expect(fast.winter?.cold?.endsInSeconds).toBe(2400);
    // Meia hora de jogo depois, o prazo desceu junto.
    expect(deriveViewState(ordered, now + 30 * MINUTE).famine?.endsInSeconds).toBe(5400);
  });

  it('os três na Fazenda, como o conselho mandava: a fome acaba sozinha, e o frio continua pedindo a Serraria', () => {
    const start = ruined();
    const now = start.lastProcessedAt;
    const farmers = accept(start, command('setWorkers', { building: 'farm', count: 3 })).state;
    const derived = view(farmers);
    expect(derived.resources.find((row) => row.id === 'food')?.perHour).toBe(-0.3);
    expect(derived.famine?.endsInSeconds).toBe(7200);
    expect(derived.morale.advice).toBe(
      'O que mais pesa é a fome (−62). Ela acaba sozinha em 2 h, sem ninguém mudar de ofício, e a moral sobe na virada seguinte.',
    );
    // Ninguém corta lenha: o frio não passa sozinho, e a frase continua dizendo o que falta.
    expect(derived.winter?.cold?.endsInSeconds).toBeNull();
    expect(derived.winter?.cold?.text).toContain(
      'A lareira pede 1,5/h e a Serraria entrega 0/h: o frio passa quando sobrar madeira, ou na Primavera.',
    );
    const relieved = advanceTo(farmers, now + DAY).state.settlement;
    expect(relieved.famine).toBeNull();
    expect(relieved.cold).not.toBeNull();
  });

  it('o frio que só passa porque a fome acaba: a frase diz o prazo, sem a conta do que faltaria', () => {
    // Seis aldeões, um lenhador veterano: com a fome cortando a Serraria ele entrega 2,88 por
    // hora, contra 3 da lareira. Quatro lavradores acabam de chegar à Fazenda: quando rendem
    // inteiro a fome acaba, a Serraria deixa de levar o corte dela e passa a cobrir a lareira.
    const start = gameWith((draft) => {
      Object.assign(draft, cloneState(ruined()));
      draft.settlement.population.villagers = 6;
      draft.settlement.workers.lumberMill = 1;
    });
    const now = start.lastProcessedAt;
    const ordered = accept(start, command('setWorkers', { building: 'farm', count: 4 })).state;
    expect(ordered.settlement.cold).not.toBeNull();
    const { winter, famine } = view(ordered);
    expect(famine?.endsInSeconds).toBe(7200);
    // A conta da lenha, feita com a fome ainda aberta, acusaria falta: o aviso não a repete,
    // porque o frio passa antes.
    expect(winter?.firewood.missing).toBeGreaterThan(0);
    expect(winter?.cold).toMatchObject({
      endsInSeconds: 7200,
      text: 'Frio: sem lenha, a produção de todo o feudo cai para 80%. A lareira pede 3/h e a Serraria entrega 2,88/h. Sem mexer em nada, a Serraria passa a cobrir a lareira em 2 h, e o frio passa.',
    });
    // O motor confirma, se ninguém desertar no caminho (seis aldeões estão acima do piso).
    const relieved = advanceTo(ordered, now + DAY);
    if (eventsOfType(relieved.events, 'villagerDeserted').length === 0) {
      expect(relieved.state.settlement.cold).toBeNull();
    }
  });

  it('gente de menos na Fazenda: a adaptação termina e a fome não acaba, e a tela não promete nada', () => {
    const one = accept(ruined(), command('setWorkers', { building: 'farm', count: 1 })).state;
    expect(view(one).famine).toMatchObject({
      endsInSeconds: null,
      text: 'Fome: a produção cai para 75% e ninguém se junta ao feudo até a comida voltar.',
    });
    expect(view(one).morale.advice).toContain('Ponha mais gente na Fazenda');
    expect(advanceTo(one, one.lastProcessedAt + 3 * DAY).state.settlement.famine).not.toBeNull();
  });

  it('ninguém faz nada: o piso segura os três, por um ano inteiro, e a saída continua aberta', () => {
    const { state, events } = advanceTo(ruined(), WINTER + YEAR);
    expect(state.settlement.population.villagers).toBe(3);
    expect(eventsOfType(events, 'villagerLeft')).toEqual([]);
    expect(eventsOfType(events, 'villagerDeserted')).toEqual([]);
    // No piso ninguém parte: o fluxo da moral nem chegou a nascer.
    expect(state.rng.morale).toBeUndefined();
    // Um ano depois, as mesmas duas ordens ainda resolvem.
    const late = play(state, [
      command('setWorkers', { building: 'farm', count: 2 }),
      command('setWorkers', { building: 'lumberMill', count: 1 }),
      { at: state.lastProcessedAt + DAY },
    ]);
    expect(late.state.settlement.famine).toBeNull();
    expect(late.state.settlement.cold).toBeNull();
  });

  it('acima do piso, a deserção continua durante a recuperação e leva quem acabou de ir para a Fazenda', () => {
    // O mesmo fundo do poço com cinco aldeões, todos postos a trabalhar: três na Fazenda e dois
    // na Serraria. A fome só acaba com o fim da adaptação, e antes dele há uma virada de dia.
    const five = cloneState(ruined());
    five.settlement.population.villagers = 5;
    const ordered = play(five, [
      command('setWorkers', { building: 'farm', count: 3 }),
      command('setWorkers', { building: 'lumberMill', count: 2 }),
    ]).state;
    const { state, events } = advanceTo(ordered, WINTER + 3 * DAY);
    // Quem deserta sai do edifício com mais gente, primeiro quem ainda se adapta: um lavrador.
    const [deserted] = eventsOfType(events, 'villagerDeserted');
    expect(deserted?.data).toMatchObject({ building: 'farm' });
    expect(deserted?.text).toContain('um lavrador fugiu da fome');
    expect(state.settlement.workers.farm).toBeLessThan(3);
    expect(state.settlement.adaptation.every((cohort) => cohort.count > 0)).toBe(true);
    expect(assignedWorkers(state)).toBe(state.settlement.population.villagers);
    // Não é o fim: com quem ficou, as mesmas ordens ainda tiram o feudo da fome e do frio.
    const rest = state.settlement.population.villagers;
    const again = play(state, [
      command('setWorkers', { building: 'lumberMill', count: 1 }),
      command('setWorkers', { building: 'farm', count: rest - 1 }),
      { at: state.lastProcessedAt + 2 * DAY },
    ]).state;
    expect(again.settlement.famine).toBeNull();
    expect(again.settlement.cold).toBeNull();
    expect(again.settlement.population.villagers).toBeGreaterThanOrEqual(3);
  });

  it('no piso, com a pior conta possível, três lavradores sempre alimentam três bocas', () => {
    const worst = play(ruined(), [command('setWorkers', { building: 'farm', count: 3 })]).state;
    const adapted = advanceTo(worst, worst.lastProcessedAt + balance.craft.adaptationMs).state;
    expect(adapted.settlement.famine).toBeNull();
    expect(netRates(adapted).food).toBeGreaterThan(0);
  });
});

describe('a moral na visão', () => {
  it('feudo novo: 50, e a conta da próxima virada diz que sobe para 60', () => {
    expect(view(newGame()).morale).toEqual({
      value: 50,
      band: 'content',
      bandLabel: 'Contente',
      multiplierPercent: 100,
      text: 'Moral 50 (Contente): não mexe na produção.',
      terms: [
        { id: 'base', label: 'Base', amount: 50 },
        { id: 'foodReserve', label: 'Comida guardada para 24 h', amount: 10 },
      ],
      breakdown: '50 (base) + 10 (comida guardada para 24 h) = 60',
      nextUpdateInSeconds: 7200,
      next: { value: 60, band: 'content', bandLabel: 'Contente', multiplierPercent: 105 },
      nextText: 'A moral só muda na virada do dia: na próxima, sobe de 50 para 60 (Contente).',
      advice: null,
      foodReserve: {
        covered: true,
        holdsAtNextTurn: true,
        needed: 120,
        missing: 0,
        bonus: 10,
        text: 'Há comida guardada para 24 h (120 para 5 habitantes): a moral ganha 10.',
      },
      notes: [],
      effects: [],
    });
  });

  it('depois da virada: 60, × 1,05, e nada muda na próxima', () => {
    const { morale } = view(advanceTo(newGame(), DAY + 37 * MINUTE).state);
    expect(morale).toMatchObject({
      value: 60,
      multiplierPercent: 105,
      text: 'Moral 60 (Contente): produção × 1,05.',
      nextUpdateInSeconds: 83 * 60,
      next: { value: 60 },
      nextText: 'A moral só muda na virada do dia: na próxima, continua em 60.',
    });
  });

  it('no ritmo Rápido os prazos saem em tempo real: a virada em 40 min, a reserva de 8 h', () => {
    const { morale } = view(newGame(), 3);
    expect(morale.nextUpdateInSeconds).toBe(2400);
    expect(morale.terms[1]).toEqual({
      id: 'foodReserve',
      label: 'Comida guardada para 8 h',
      amount: 10,
    });
    expect(morale.foodReserve.text).toBe(
      'Há comida guardada para 8 h (120 para 5 habitantes): a moral ganha 10.',
    );
    expect(view(newGame(), 0.5).morale.terms[1]?.label).toBe('Comida guardada para 48 h');
  });

  it('sem a reserva: a dica diz quanto guardar e quanto falta', () => {
    const { morale } = view(small(40_000));
    expect(morale.foodReserve).toEqual({
      covered: false,
      holdsAtNextTurn: false,
      needed: 120,
      missing: 80,
      bonus: 10,
      text: 'Com 120 de comida guardada (o que 5 habitantes comem em 24 h), a moral ganha 10. Faltam 80.',
    });
    expect(morale.advice).toBe(morale.foodReserve.text);
    expect(morale.breakdown).toBe('50 (base) = 50');
  });

  it('a conta é a da virada: a comida que o consumo leva antes dela já não vale o bônus', () => {
    // 125 de comida, 5 bocas e ninguém na Fazenda: agora cobre os 120, mas em 2 h serão 115.
    const state = small(125_000);
    const { morale } = view(state);
    expect(morale.foodReserve).toEqual({
      covered: true,
      holdsAtNextTurn: false,
      needed: 120,
      missing: 0,
      bonus: 10,
      text: 'Há comida guardada para 24 h agora, mas não na virada do dia: lá serão precisos 120 para 5 habitantes, e faltarão 5. A moral deixa de ganhar 10.',
    });
    expect(morale.terms.map((term) => term.id)).toEqual(['base']);
    expect(morale.next.value).toBe(50);
    expect(morale.advice).toBe(morale.foodReserve.text);
    expect(advanceTo(state, SUMMER + DAY).state.settlement.morale).toBe(50);
  });

  it('a conta é a da virada: a reserva que a produção completa antes dela já vale', () => {
    // 100 de comida e dois lavradores veteranos: +15 por hora, 130 na virada.
    const state = small(100_000, (draft) => {
      draft.settlement.workers.farm = 2;
    });
    const { morale } = view(state);
    expect(morale.foodReserve).toMatchObject({
      covered: false,
      holdsAtNextTurn: true,
      missing: 20,
      text: 'Com 120 de comida guardada (o que 5 habitantes comem em 24 h), a moral ganha 10. Faltam 20, e a produção os junta antes da virada do dia.',
    });
    expect(morale.terms.map((term) => term.id)).toEqual(['base', 'foodReserve']);
    expect(morale.next.value).toBe(60);
    expect(morale.advice).toBeNull();
    expect(advanceTo(state, SUMMER + DAY).state.settlement.morale).toBe(60);
  });

  it('a conta é a da virada: os recrutas que vão encher as casas já pesam, antes de chegar', () => {
    // 5 habitantes em 10 vagas, cinco aldeões chamados: no verão chegam em 100 min.
    const ordered = accept(small(900_000), command('recruitVillagers', { quantity: 5 })).state;
    const { morale, population } = view(ordered);
    expect(population).toMatchObject({ villagers: 5, inTraining: 5 });
    expect(morale.terms).toContainEqual({ id: 'housingFull', label: 'Casas cheias', amount: -10 });
    expect(morale.advice).toContain('O que mais pesa são as casas cheias (−10)');
    const turned = advanceTo(ordered, SUMMER + DAY).state;
    expect(turned.settlement.population.villagers).toBe(10);
    expect(turned.settlement.morale).toBe(morale.next.value);
  });

  it('a conta é a da virada: a fome que vai abrir antes dela já está na conta', () => {
    // 6 de comida e 5 bocas: a fome abre em 1 h 12 min, antes da virada.
    const state = small(6_000);
    const { morale, famine } = view(state);
    expect(famine).toBeNull();
    expect(morale.terms.map((term) => [term.id, term.amount])).toEqual([
      ['base', 50],
      ['famine', -20],
    ]);
    expect(morale.nextText).toBe(
      'A moral só muda na virada do dia: na próxima, cai de 50 para 30 (Inquieto).',
    );
    expect(morale.advice).toContain('O que mais pesa é a fome (−20)');
    // E avisa da deserção, contada de quando a fome vai começar.
    expect(morale.notes).toEqual([
      'Depois de 12 h de fome, um aldeão deserta a cada virada do dia. Faltam 14 h para o primeiro.',
    ]);
    expect(advanceTo(state, SUMMER + DAY).state.settlement.morale).toBe(30);
  });

  it('a conta é a da virada: a obra que termina em cima dela e abre vagas já conta', () => {
    // As casas estão cheias e as Habitações sobem de nível exatamente na virada do dia.
    const building = small(900_000, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.settlement.workers.farm = 6;
      draft.settlement.constructionQueues = [
        { building: 'housing', targetLevel: 2, startedAtMs: SUMMER, finishesAtMs: SUMMER + DAY },
        null,
      ];
    });
    const { morale } = view(building);
    expect(morale.terms.map((term) => term.id)).not.toContain('housingFull');
    expect(advanceTo(building, SUMMER + DAY).state.settlement.morale).toBe(morale.next.value);
    // Um milissegundo depois da virada, a obra ainda não terminou na hora da conta.
    const late = small(900_000, (draft) => {
      draft.settlement.population.villagers = 10;
      draft.settlement.workers.farm = 6;
      draft.settlement.constructionQueues = [
        {
          building: 'housing',
          targetLevel: 2,
          startedAtMs: SUMMER,
          finishesAtMs: SUMMER + DAY + 1,
        },
        null,
      ];
    });
    expect(view(late).morale.terms.map((term) => term.id)).toContain('housingFull');
  });

  it('a reserva que não cabe na despensa diz o que ampliar', () => {
    // 30 habitantes comem 720 em 24 h, e a Despensa guarda 500.
    const crowded = plain((draft) => {
      draft.settlement.population.villagers = 30;
      draft.settlement.buildings.housing = 8;
    });
    expect(view(crowded).morale.foodReserve.text).toBe(
      'Com 720 de comida guardada (o que 30 habitantes comem em 24 h), a moral ganha 10. Faltam 680. A Despensa só guarda 500: construa o Celeiro.',
    );
    // Com o Celeiro erguido e ainda pequeno, a frase manda ampliá-lo; com ele maior, some.
    const built = (level: number, villagers: number) =>
      view(
        plain((draft) => {
          draft.settlement.population.villagers = villagers;
          draft.settlement.buildings.housing = 8;
          draft.settlement.buildings.granary = level;
        }),
      ).morale.foodReserve.text;
    expect(built(1, 40)).toBe(
      'Com 960 de comida guardada (o que 40 habitantes comem em 24 h), a moral ganha 10. Faltam 920. O Celeiro só guarda 900: amplie o Celeiro.',
    );
    expect(built(2, 40)).toBe(
      'Com 960 de comida guardada (o que 40 habitantes comem em 24 h), a moral ganha 10. Faltam 920.',
    );
  });

  it('a fome que começou há pouco: a moral ainda é a de antes, e a visão avisa para onde vai', () => {
    // Às 37 h a fome tem uma hora; a moral ainda é a da última virada.
    const { morale } = view(advanceTo(newGame(), 37 * HOUR).state);
    expect(morale).toMatchObject({
      value: 50,
      band: 'content',
      terms: [
        { id: 'base', label: 'Base', amount: 50 },
        { id: 'famine', label: 'Fome', amount: -20 },
        { id: 'famineDays', label: '1 dia inteiro de fome', amount: -2 },
      ],
      breakdown: '50 (base) − 20 (fome) − 2 (1 dia inteiro de fome) = 28',
      nextUpdateInSeconds: 3600,
      next: { value: 28, band: 'restless', bandLabel: 'Inquieto', multiplierPercent: 89 },
      nextText: 'A moral só muda na virada do dia: na próxima, cai de 50 para 28 (Inquieto).',
      advice:
        'O que mais pesa é a fome (−22). Ponha mais gente na Fazenda: quando a comida voltar a sobrar, a fome acaba e a moral sobe na virada seguinte.',
      notes: [
        'Depois de 12 h de fome, um aldeão deserta a cada virada do dia. Faltam 11 h para o primeiro.',
      ],
    });
  });

  it('no ritmo Rápido o aviso da deserção conta em tempo real', () => {
    const { morale } = view(advanceTo(newGame(), 37 * HOUR).state, 3);
    expect(morale.notes).toEqual([
      'Depois de 4 h de fome, um aldeão deserta a cada virada do dia. Faltam 3 h 40 min para o primeiro.',
    ]);
  });

  it('em Camponês a visão diz que ninguém deserta', () => {
    const start = createInitialState('pedra-alta', { ...settings, difficulty: 'peasant' });
    expect(view(advanceTo(start, 37 * HOUR).state).morale.notes).toEqual([
      'Em Camponês, ninguém deserta por fome.',
    ]);
  });

  it('casas cheias: o que pesa e o que fazer', () => {
    const full = small(300_000, (draft) => {
      draft.settlement.population.villagers = 10;
    });
    const { morale } = view(full);
    expect(morale.breakdown).toBe(
      '50 (base) + 10 (comida guardada para 24 h) − 10 (casas cheias) = 50',
    );
    expect(morale.advice).toBe(
      'O que mais pesa são as casas cheias (−10). Melhore as Habitações ou o Salão: com uma vaga livre, a moral sobe na virada seguinte.',
    );
  });

  it('frio: o que pesa e o que fazer; com fome e frio empatados, a fome vem primeiro', () => {
    const cold = gameAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.workers.farm = 5;
      draft.settlement.resources = { food: 40_000, wood: 0, stone: 0, gold: 0 };
      draft.settlement.cold = { sinceMs: WINTER + 2 * DAY };
    });
    expect(view(cold).morale.advice).toBe(
      'O que mais pesa é o frio (−20). Ponha gente na Serraria: com lenha na lareira o frio passa, e a moral sobe na virada seguinte.',
    );
    const both = gameAt(WINTER + 3 * DAY, (draft) => {
      draft.settlement.resources = { food: 0, wood: 0, stone: 0, gold: 0 };
      draft.settlement.famine = { sinceMs: WINTER + 3 * DAY };
      draft.settlement.cold = { sinceMs: WINTER + 2 * DAY };
    });
    expect(view(both).morale.advice).toContain('O que mais pesa é a fome (−22)');
  });

  it('efeitos temporários: o termo com o nome, a lista com o prazo e o que passa sozinho', () => {
    const state = plain((draft) => {
      addMoraleEffect(draft, {
        id: 'carta:tabuas',
        label: 'carta: Tábuas para as reservas',
        amount: 5,
        untilMs: SUMMER + 2 * DAY,
      });
      addMoraleEffect(draft, {
        id: 'incursao:1',
        label: 'incursão sofrida',
        amount: -10,
        untilMs: SUMMER + 3 * DAY,
      });
    });
    const { morale } = view(state, 3);
    expect(morale.terms).toEqual([
      { id: 'base', label: 'Base', amount: 50 },
      { id: 'effect', label: 'carta: Tábuas para as reservas', amount: 5 },
      { id: 'effect', label: 'incursão sofrida', amount: -10 },
    ]);
    expect(morale.breakdown).toBe(
      '50 (base) + 5 (carta: Tábuas para as reservas) − 10 (incursão sofrida) = 45',
    );
    // O efeito que conta até a virada do 3º dia sai da moral na virada do 4º: três dias de jogo
    // são 2 h reais no ritmo 3.
    expect(morale.effects).toEqual([
      { label: 'carta: Tábuas para as reservas', amount: 5, endsInSeconds: 7200 },
      { label: 'incursão sofrida', amount: -10, endsInSeconds: 9600 },
    ]);
    expect(morale.advice).toBe(
      'O que mais pesa é "incursão sofrida" (−10): passa sozinho em 2 h 40 min.',
    );
  });

  it('moral alta: a chance do colono, e o aviso quando não há vaga', () => {
    expect(view(withEffect(30)).morale.notes).toEqual([
      'Com a moral em 80 ou mais e vaga nas casas, cada virada do dia tem 20% de chance de trazer um colono.',
    ]);
    const full = withEffect(45, (draft) => {
      draft.settlement.population.villagers = 25;
    });
    expect(view(full).morale.notes).toEqual([
      'Com a moral em 80 ou mais, cada virada do dia poderia trazer um colono, mas não há vaga nas casas: melhore as Habitações ou o Salão.',
    ]);
  });

  it('o feudo orgulhoso: o efeito que ainda vale, o que já saiu e a chance do colono', () => {
    const state = proudScenario();
    // O −10 contou em duas viradas e saiu da lista na terceira; o +30 continua.
    expect(state.settlement.moraleEffects.map((effect) => effect.id)).toEqual(['teste:festa']);
    expect(state.rng.morale).toBeDefined();
    const { morale } = view(state);
    expect(morale).toMatchObject({
      value: 80,
      band: 'proud',
      bandLabel: 'Orgulhoso',
      multiplierPercent: 115,
      text: 'Moral 80 (Orgulhoso): produção × 1,15.',
      breakdown: '50 (base) + 30 (festa da colheita) = 80',
      nextText: 'A moral só muda na virada do dia: na próxima, continua em 80.',
      advice: view(state).morale.foodReserve.text,
      // Conta até a virada do 10º dia e sai da moral na do 11º: faltam 4 dias e 83 minutos.
      effects: [{ label: 'festa da colheita', amount: 30, endsInSeconds: (4 * 120 + 83) * 60 }],
    });
    expect(morale.notes).toHaveLength(1);
    expect(morale.notes[0]).toContain('colono');
  });

  it('a soma fora do intervalo diz o limite que a segurou', () => {
    expect(view(withEffect(70)).morale.breakdown).toBe(
      '50 (base) + 70 (efeito de teste) = 120; a moral não passa de 100',
    );
    expect(view(withEffect(-70)).morale.breakdown).toBe(
      '50 (base) − 70 (efeito de teste) = −20; a moral não desce de 0',
    );
  });

  describe('o que recrutar custa à moral, ao lado do custo em recursos', () => {
    const noteOf = (state: GameState) => view(state).recruitment.moraleNote;
    /** Verão, 10 habitantes em 25 vagas, dois lavradores e `food` de comida no Celeiro. */
    const town = (food: number, edit: (draft: GameState) => void = () => {}) =>
      gameAt(SUMMER, (draft) => {
        draft.settlement.population.villagers = 10;
        draft.settlement.buildings.housing = 4;
        draft.settlement.buildings.granary = 2;
        draft.settlement.workers.farm = 2;
        draft.settlement.resources.food = food;
        draft.settlement.resources.gold = 900_000;
        edit(draft);
      });

    it('com comida de sobra e camas de sobra, recrutar não custa nada à moral', () => {
      // 10 bocas pedem 240; cinco recrutas custam 250 e pedem mais 120: 610 bastam.
      expect(noteOf(town(610_000))).toBeNull();
      expect(view(town(610_000)).recruitment.maxQuantity).toBe(5);
    });

    it('diz quantos chamar sem gastar a comida guardada', () => {
      // 609 não chegam para os cinco: quatro custam 200 e a reserva de 14 bocas é 336.
      expect(noteOf(town(609_000))).toBe(
        'Chamar mais de 4 aldeões agora gasta a comida guardada, que vale 10 de moral.',
      );
      // 388: um custa 50 e 11 bocas pedem 264 (314); dois, 100 e 288 (388).
      expect(noteOf(town(388_000))).toBe(
        'Chamar mais de 2 aldeões agora gasta a comida guardada, que vale 10 de moral.',
      );
      expect(noteOf(town(387_999))).toBe(
        'Chamar mais de 1 aldeão agora gasta a comida guardada, que vale 10 de moral.',
      );
      expect(noteOf(town(313_999))).toBe(
        'Chamar aldeões agora gasta a comida guardada, que vale 10 de moral.',
      );
    });

    it('sem a reserva feita não há o que gastar: a frase some', () => {
      expect(view(town(239_999)).morale.foodReserve.covered).toBe(false);
      expect(noteOf(town(239_999))).toBeNull();
      // Quem já está a caminho conta como boca: com dois em treinamento, 240 não cobrem 12.
      const queued = town(260_000, (draft) => {
        draft.settlement.recruitmentQueue = [
          { finishesAtMs: SUMMER + HOUR },
          { finishesAtMs: SUMMER + 2 * HOUR },
        ];
      });
      expect(noteOf(queued)).toBeNull();
    });

    it('diz quando a ordem enche as casas, e quantos chamar para sobrar uma cama', () => {
      const nearlyFull = (vacancies: number) =>
        town(900_000, (draft) => {
          draft.settlement.population.villagers = 25 - vacancies;
          draft.settlement.buildings.granary = 4;
        });
      expect(noteOf(nearlyFull(6))).toBeNull();
      expect(noteOf(nearlyFull(5))).toBe(
        'Com as casas cheias a moral perde 10: para evitar, chame até 4.',
      );
      expect(noteOf(nearlyFull(2))).toBe(
        'Com as casas cheias a moral perde 10: para evitar, chame até 1.',
      );
      expect(noteOf(nearlyFull(1))).toBe(
        'Com as casas cheias a moral perde 10: é o que custa ocupar a última cama.',
      );
      // Sem cama nenhuma, ou na fome, não há ordem a dar: não há custo a mostrar.
      expect(noteOf(nearlyFull(0))).toBeNull();
      const starving = town(0, (draft) => {
        draft.settlement.workers.farm = 0;
        draft.settlement.famine = { sinceMs: SUMMER - HOUR };
      });
      expect(view(starving).recruitment.blockedReason).not.toBeNull();
      expect(noteOf(starving)).toBeNull();
    });

    it('é verdade: quem segue a frase mantém a moral, quem não segue a perde', () => {
      const state = town(388_000);
      const turn = (quantity: number) =>
        advanceTo(accept(state, command('recruitVillagers', { quantity })).state, SUMMER + DAY)
          .state.settlement.morale;
      // Dois lavradores veteranos rendem 20 por hora para 10 a 13 bocas: a comida quase não
      // muda até a virada, e a reserva decide.
      expect(turn(2)).toBe(60);
      expect(turn(5)).toBe(50);
    });
  });

  it('o estado do gerador nunca sai na visão', () => {
    const { state } = advanceTo(newGame(), 30 * DAY);
    expect(state.rng.morale).toBeDefined();
    const text = JSON.stringify(view(state));
    for (const word of state.rng.morale ?? []) {
      expect(text).not.toContain(String(word));
    }
    expect(text).not.toContain('"rng"');
  });
});
