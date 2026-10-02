import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  buildings,
  chronicleTemplates,
  DIFFICULTY_IDS,
  EVENT_TYPES,
  OBJECTIVE_CONDITION_TYPES,
  objectives,
  PRODUCTION_BUILDING_IDS,
} from './index';
import {
  BalanceSchema,
  BuildingsSchema,
  ChronicleTemplatesSchema,
  ObjectivesSchema,
} from './schemas';

describe('schemas do conteúdo', () => {
  it('valida o balanceamento', () => {
    expect(BalanceSchema.safeParse(balance).error).toBeUndefined();
  });

  it('valida os edifícios', () => {
    expect(BuildingsSchema.safeParse(buildings).error).toBeUndefined();
  });

  it('valida os objetivos', () => {
    expect(ObjectivesSchema.safeParse(objectives).error).toBeUndefined();
  });

  it('valida os modelos de frase da Crônica', () => {
    expect(ChronicleTemplatesSchema.safeParse(chronicleTemplates).error).toBeUndefined();
  });

  it('recusa um marcador desconhecido em um modelo de frase', () => {
    const broken = { ...chronicleTemplates, dayStarted: 'Amanhece em {castelo}.' };
    expect(ChronicleTemplatesSchema.safeParse(broken).success).toBe(false);
  });

  it('recusa um edifício sem custo ou com nível máximo 1', () => {
    const farm = buildings.farm;
    expect(
      BuildingsSchema.safeParse({ ...buildings, farm: { ...farm, baseCost: {} } }).success,
    ).toBe(false);
    expect(
      BuildingsSchema.safeParse({ ...buildings, farm: { ...farm, maxLevel: 1 } }).success,
    ).toBe(false);
  });
});

describe('dificuldades', () => {
  const { difficulties } = balance;
  const factor = (id: (typeof DIFFICULTY_IDS)[number]) =>
    difficulties[id].storageCapacity.num / difficulties[id].storageCapacity.den;

  it('são as três do GDD §12.1, da mais branda à mais dura', () => {
    expect(DIFFICULTY_IDS).toEqual(['peasant', 'lord', 'ironKing']);
    expect(Object.keys(difficulties)).toEqual([...DIFFICULTY_IDS]);
    expect(DIFFICULTY_IDS.map((id) => difficulties[id].label)).toEqual([
      'Camponês',
      'Senhor',
      'Rei de Ferro',
    ]);
  });

  it('os fatores da v0.2 são os do GDD §12.1 (ADR 0013, decisão 19a)', () => {
    expect(difficulties.peasant.storageCapacity).toEqual({ num: 5, den: 4 });
    expect(difficulties.lord.storageCapacity).toEqual({ num: 1, den: 1 });
    expect(difficulties.ironKing.storageCapacity).toEqual({ num: 4, den: 5 });
    expect(DIFFICULTY_IDS.map((id) => difficulties[id].famineDesertion)).toEqual([
      false,
      true,
      true,
    ]);
    // Da mais branda à mais dura, a capacidade nunca cresce.
    expect(factor('peasant')).toBeGreaterThan(factor('lord'));
    expect(factor('lord')).toBeGreaterThan(factor('ironKing'));
  });

  it('só uma é a recomendada, e é Senhor: a que vale para quem não escolhe', () => {
    expect(DIFFICULTY_IDS.filter((id) => difficulties[id].recommended)).toEqual(['lord']);
  });

  it('a frase de cada uma diz o que muda nesta versão, com o número do fator', () => {
    for (const id of DIFFICULTY_IDS) {
      const { description, famineDesertion } = difficulties[id];
      // Uma frase só, que fala das três linhas da v0.2: armazenamento, fome e Conselho.
      expect(description.endsWith('.'), id).toBe(true);
      expect(description.slice(0, -1), id).not.toContain('.');
      expect(description, id).toContain('Conselho');
      expect(description, id).toContain('fome');
      expect(description.includes('ninguém deserta por fome'), id).toBe(!famineDesertion);
      // O percentual escrito é o do fator: mudar um sem o outro quebra aqui.
      const percent = Math.round(Math.abs(factor(id) - 1) * 100);
      if (percent === 0) {
        expect(description, id).not.toMatch(/\d/);
      } else {
        const direction = factor(id) > 1 ? 'a mais' : 'a menos';
        expect(description, id).toContain(`${percent}% ${direction}`);
      }
    }
  });

  it('o schema recusa uma dificuldade a menos, um campo a mais e duas recomendadas', () => {
    const missing = { peasant: difficulties.peasant, lord: difficulties.lord };
    expect(BalanceSchema.safeParse({ ...balance, difficulties: missing }).success).toBe(false);
    const extra = { ...difficulties, lord: { ...difficulties.lord, waveSize: 1 } };
    expect(BalanceSchema.safeParse({ ...balance, difficulties: extra }).success).toBe(false);
    const two = { ...difficulties, peasant: { ...difficulties.peasant, recommended: true } };
    expect(BalanceSchema.safeParse({ ...balance, difficulties: two }).success).toBe(false);
  });
});

describe('ritmos', () => {
  const { paces, calendar } = balance;
  const HOUR_MS = 3_600_000;
  const yearMs = calendar.seasons.reduce((sum, season) => sum + season.days, 0) * calendar.dayMs;

  /** "um ano em 56 horas" ou "um ano em 7 dias", pela conta: ano de jogo ÷ ritmo. */
  function yearInRealTime(timeScale: number): string {
    const hours = yearMs / timeScale / HOUR_MS;
    return hours % 24 === 0 ? `um ano em ${hours / 24} dias` : `um ano em ${hours} horas`;
  }

  it('são os três do ADR 0013, decisão 2: Rápido, Normal e Tranquilo', () => {
    expect(paces.map((pace) => [pace.timeScale, pace.label])).toEqual([
      [3, 'Rápido'],
      [1, 'Normal'],
      [0.5, 'Tranquilo'],
    ]);
  });

  it('só um é o recomendado, e é o Rápido', () => {
    expect(paces.filter((pace) => pace.recommended).map((pace) => pace.timeScale)).toEqual([3]);
  });

  it('a descrição em tempo real bate com a conta: ano de jogo ÷ ritmo', () => {
    expect(paces.map((pace) => pace.description)).toEqual([
      'um ano em 56 horas',
      'um ano em 7 dias',
      'um ano em 14 dias',
    ]);
    for (const pace of paces) {
      expect(pace.description, pace.label).toBe(yearInRealTime(pace.timeScale));
    }
  });

  it('em todo ritmo oferecido o dia de jogo dura um número inteiro de minutos reais', () => {
    for (const pace of paces) {
      expect(Number.isInteger(calendar.dayMs / pace.timeScale / 60_000), pace.label).toBe(true);
    }
  });

  it('cada ritmo diz para quem é, em uma frase sem números', () => {
    for (const pace of paces) {
      expect(pace.hint.endsWith('.'), pace.label).toBe(true);
      expect(pace.hint, pace.label).not.toMatch(/\d/);
    }
    expect(new Set(paces.map((pace) => pace.hint)).size).toBe(paces.length);
  });

  it('o schema recusa ritmo repetido, ritmo que não é positivo e lista sem recomendado', () => {
    const [fast, ...others] = paces;
    if (fast === undefined) {
      throw new Error('O conteúdo não tem ritmos.');
    }
    const parse = (list: unknown) => BalanceSchema.safeParse({ ...balance, paces: list }).success;
    expect(parse([fast, fast, ...others])).toBe(false);
    expect(parse([{ ...fast, timeScale: 0 }, ...others])).toBe(false);
    expect(parse([{ ...fast, recommended: false }, ...others])).toBe(false);
    expect(parse(paces.map((pace) => ({ ...pace, recommended: true })))).toBe(false);
    expect(parse([])).toBe(false);
  });
});

describe('edifícios', () => {
  it.each(BUILDING_IDS)('%s tem rótulo, custo e tempo positivos e ao menos 2 níveis', (id) => {
    const def = buildings[id];
    expect(def.label.trim()).not.toBe('');
    expect(def.baseDurationMs).toBeGreaterThan(0);
    expect(def.maxLevel).toBeGreaterThanOrEqual(2);
    const costs = Object.values(def.baseCost);
    expect(costs.length).toBeGreaterThan(0);
    for (const cost of costs) {
      expect(cost).toBeGreaterThan(0);
    }
  });

  it('todo edifício produtivo declara o recurso e tem taxa base', () => {
    for (const id of PRODUCTION_BUILDING_IDS) {
      expect(buildings[id].produces).not.toBeNull();
      expect(balance.production.perWorkerPerHour[id]).toBeGreaterThan(0);
    }
    const producers = BUILDING_IDS.filter((id) => buildings[id].produces !== null);
    expect(producers).toEqual([...PRODUCTION_BUILDING_IDS]);
  });

  it('os níveis máximos seguem o GDD §6.1', () => {
    expect(buildings.townHall.maxLevel).toBe(8);
    for (const id of BUILDING_IDS.filter((building) => building !== 'townHall')) {
      expect(buildings[id].maxLevel).toBe(10);
    }
  });
});

describe('balanceamento', () => {
  it('o ano tem 84 dias de jogo de 2 horas', () => {
    const days = balance.calendar.seasons.reduce((sum, season) => sum + season.days, 0);
    expect(days).toBe(84);
    expect(balance.calendar.dayMs).toBe(7_200_000);
    expect(balance.calendar.seasons.map((season) => season.id)).toEqual([
      'spring',
      'summer',
      'autumn',
      'winter',
    ]);
  });

  it('as frações permitem taxas inteiras em milésimos', () => {
    // O motor calcula taxas em milésimos por hora: o bônus por nível e a penalidade da fome
    // precisam dividir 1000 sem resto para nenhuma taxa ser truncada.
    expect(1000 % balance.production.levelBonus.den).toBe(0);
    expect(1000 % balance.famine.productionMultiplier.den).toBe(0);
  });

  it('a capacidade inicial é 10 e a penalidade da fome reduz a produção', () => {
    const { capacityPerLevel } = balance.housing;
    const perLevel = Object.values(capacityPerLevel).reduce((sum, value) => sum + value, 0);
    expect(perLevel * balance.initial.buildingLevel).toBe(10);
    const { num, den } = balance.famine.productionMultiplier;
    expect(num).toBeLessThan(den);
  });

  it('o reembolso de cancelamento não passa do que foi pago', () => {
    const { num, den } = balance.construction.cancelRefund;
    expect(num).toBeLessThanOrEqual(den);
  });
});

describe('objetivos', () => {
  it('têm ids únicos e condições conhecidas', () => {
    const ids = objectives.map((objective) => objective.id);
    expect(new Set(ids).size).toBe(ids.length);
    const known: readonly string[] = OBJECTIVE_CONDITION_TYPES;
    for (const objective of objectives) {
      expect(known).toContain(objective.condition.type);
    }
  });

  it('as recompensas da v0.1 são +20 ouro, +30 madeira, +40 comida e +50 ouro', () => {
    expect(objectives.map((objective) => objective.reward)).toEqual([
      { gold: 20 },
      { wood: 30 },
      { food: 40 },
      { gold: 50 },
    ]);
  });
});

describe('Crônica', () => {
  it('todo tipo de evento tem modelo de frase', () => {
    expect(Object.keys(chronicleTemplates).sort()).toEqual([...EVENT_TYPES].sort());
    for (const type of EVENT_TYPES) {
      expect(chronicleTemplates[type].trim()).not.toBe('');
    }
  });
});
