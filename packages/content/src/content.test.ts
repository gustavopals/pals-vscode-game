import { describe, expect, it } from 'vitest';

import {
  balance,
  BUILDING_IDS,
  buildings,
  chronicleTemplates,
  coldReliefs,
  craftGuilds,
  DIFFICULTY_IDS,
  EVENT_TYPES,
  foundingTemplates,
  OBJECTIVE_CONDITION_TYPES,
  objectives,
  PRODUCTION_BUILDING_IDS,
  RESOURCE_IDS,
  SEASON_IDS,
} from './index';
import {
  BalanceSchema,
  BuildingsSchema,
  ChronicleTemplatesSchema,
  CraftGuildsSchema,
  FoundingTemplatesSchema,
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

  it('recusa um edifício que nasce no nível máximo e um pré-requisito de edifício desconhecido', () => {
    const farm = buildings.farm;
    const parse = (changed: object) =>
      BuildingsSchema.safeParse({ ...buildings, farm: { ...farm, ...changed } }).success;
    expect(parse({})).toBe(true);
    expect(parse({ initialLevel: farm.maxLevel })).toBe(false);
    expect(parse({ initialLevel: -1 })).toBe(false);
    expect(parse({ requires: { castle: 2 } })).toBe(false);
    expect(parse({ requires: { townHall: 0 } })).toBe(false);
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

describe('estações (GDD §4.1)', () => {
  const { seasons } = balance.calendar;
  const bySeason = Object.fromEntries(seasons.map((season) => [season.id, season.effects]));
  const value = ({ num, den }: { num: number; den: number }) => num / den;

  it('toda estação tem fator de produção para os quatro recursos, todos positivos', () => {
    for (const season of seasons) {
      expect(Object.keys(season.effects.production), season.id).toEqual([...RESOURCE_IDS]);
      for (const id of RESOURCE_IDS) {
        expect(value(season.effects.production[id]), `${season.id} ${id}`).toBeGreaterThan(0);
      }
      expect(value(season.effects.recruitmentDuration), season.id).toBeGreaterThan(0);
      expect(value(season.effects.constructionDuration), season.id).toBeGreaterThan(0);
      expect(season.effects.firewoodPerVillagerPerHour.num, season.id).toBeGreaterThanOrEqual(0);
    }
  });

  it('os fatores de produção são os da tabela', () => {
    const table = (id: (typeof SEASON_IDS)[number]) =>
      RESOURCE_IDS.map((resource) => value(bySeason[id]!.production[resource]));
    // Comida, madeira, pedra, ouro.
    expect(table('spring')).toEqual([1.2, 1, 1, 1]);
    expect(table('summer')).toEqual([1, 1.15, 1.15, 1]);
    expect(table('autumn')).toEqual([1.3, 1, 1, 1.1]);
    expect(table('winter')).toEqual([0.4, 0.8, 0.8, 1]);
  });

  it('só a primavera apressa o recrutamento e só o inverno atrasa as obras e queima lenha', () => {
    expect(SEASON_IDS.map((id) => value(bySeason[id]!.recruitmentDuration))).toEqual([
      0.8, 1, 1, 1,
    ]);
    expect(SEASON_IDS.map((id) => value(bySeason[id]!.constructionDuration))).toEqual([
      1, 1, 1, 1.5,
    ]);
    expect(SEASON_IDS.map((id) => value(bySeason[id]!.firewoodPerVillagerPerHour))).toEqual([
      0, 0, 0, 0.5,
    ]);
  });

  it('a lenha de um habitante é um número inteiro de milésimos por hora', () => {
    for (const season of seasons) {
      const { num, den } = season.effects.firewoodPerVillagerPerHour;
      expect((1000 * num) % den, season.id).toBe(0);
    }
  });

  it('a estação que queima lenha é a última do ano: o frio nunca atravessa a virada', () => {
    // O motor encerra o frio quando a estação deixa de queimar lenha; com o inverno no fim do
    // ano, isso é sempre a virada para a primavera.
    const burning = seasons.filter((season) => season.effects.firewoodPerVillagerPerHour.num > 0);
    expect(burning.map((season) => season.id)).toEqual(['winter']);
    expect(seasons.at(-1)?.id).toBe('winter');
  });

  it('o frio e a fome só tiram produção: é o que impede os dois de oscilar no mesmo instante', () => {
    const cold = balance.winter.cold.productionMultiplier;
    expect(cold).toEqual({ num: 4, den: 5 });
    expect(value(cold)).toBeLessThanOrEqual(1);
    expect(value(balance.famine.productionMultiplier)).toBeLessThanOrEqual(1);
  });

  it('o schema recusa estação sem efeitos, fator zero e lenha negativa', () => {
    const [spring, ...others] = seasons;
    if (spring === undefined) {
      throw new Error('O conteúdo não tem estações.');
    }
    const parse = (first: unknown) =>
      BalanceSchema.safeParse({
        ...balance,
        calendar: { ...balance.calendar, seasons: [first, ...others] },
      }).success;
    expect(parse(spring)).toBe(true);
    const { effects, ...bare } = spring;
    expect(parse(bare)).toBe(false);
    expect(
      parse({
        ...spring,
        effects: { ...effects, production: { ...effects.production, food: { num: 0, den: 1 } } },
      }),
    ).toBe(false);
    expect(
      parse({
        ...spring,
        effects: { ...effects, firewoodPerVillagerPerHour: { num: -1, den: 2 } },
      }),
    ).toBe(false);
    expect(parse({ ...spring, effects: { ...effects, moraleBonus: 5 } })).toBe(false);
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
    expect(BUILDING_IDS.map((id) => [id, buildings[id].maxLevel])).toEqual([
      ['townHall', 8],
      ['farm', 10],
      ['lumberMill', 10],
      ['quarry', 10],
      ['goldMine', 10],
      ['housing', 10],
      ['granary', 8],
      ['warehouse', 8],
    ]);
  });

  it('os seis da v0.1 nascem erguidos e sem pré-requisito, com o custo e o prazo de sempre', () => {
    const founders = ['townHall', 'farm', 'lumberMill', 'quarry', 'goldMine', 'housing'] as const;
    for (const id of founders) {
      expect(buildings[id].initialLevel, id).toBe(1);
      expect(buildings[id].requires, id).toEqual({});
    }
    expect(founders.map((id) => buildings[id].baseCost)).toEqual([
      { wood: 150, stone: 100, gold: 100 },
      { wood: 80, gold: 40 },
      { wood: 100, stone: 50 },
      { wood: 120, gold: 30 },
      { wood: 120, stone: 80 },
      { wood: 80, stone: 20 },
    ]);
    expect(founders.map((id) => buildings[id].baseDurationMs / 60_000)).toEqual([
      10, 5, 5, 6, 8, 4,
    ]);
  });

  it('o Celeiro e o Armazém nascem no nível 0 e pedem o Salão no nível 2 (GDD §6.1 e §6.2)', () => {
    for (const id of ['granary', 'warehouse'] as const) {
      expect(buildings[id].initialLevel, id).toBe(0);
      expect(buildings[id].requires, id).toEqual({ townHall: 2 });
      expect(buildings[id].baseCost, id).toEqual({ wood: 160, stone: 80 });
      expect(buildings[id].baseDurationMs, id).toBe(10 * 60_000);
      expect(buildings[id].produces, id).toBeNull();
    }
    expect([buildings.granary.label, buildings.warehouse.label]).toEqual(['Celeiro', 'Armazém']);
  });

  it('a Torre de Vigia ainda não existe: entra com a Ameaça', () => {
    expect(BUILDING_IDS).toEqual([
      'townHall',
      'farm',
      'lumberMill',
      'quarry',
      'goldMine',
      'housing',
      'granary',
      'warehouse',
    ]);
  });
});

describe('armazenamento (GDD §5.5)', () => {
  const { storage, difficulties } = balance;
  const stores = Object.entries(storage.buildings);

  it('500 por recurso antes do edifício; Celeiro e Armazém guardam 900 e mais 600 por nível', () => {
    expect(storage.baseCapacity).toBe(500);
    expect(storage.buildings.granary).toMatchObject({
      resources: ['food'],
      level1: 900,
      perLevel: 600,
    });
    expect(storage.buildings.warehouse).toMatchObject({
      resources: ['wood', 'stone'],
      level1: 900,
      perLevel: 600,
    });
    expect(Object.keys(storage.buildings)).toEqual(['granary', 'warehouse']);
  });

  it('o ouro não tem limite, e cada recurso guardado tem um edifício só', () => {
    const stored = stores.flatMap(([, def]) => def.resources);
    expect(stored).toEqual(['food', 'wood', 'stone']);
    expect(stored).not.toContain('gold');
    expect(new Set(stored).size).toBe(stored.length);
  });

  it('construir o edifício nunca encolhe o estoque: o nível 1 guarda mais que o começo', () => {
    for (const [id, def] of stores) {
      expect(def.level1, id).toBeGreaterThan(storage.baseCapacity);
      expect(def.perLevel, id).toBeGreaterThan(0);
    }
  });

  it('quem guarda é edifício que se constrói: nasce no nível 0 e não produz nada', () => {
    for (const [id] of stores) {
      const def = buildings[id as (typeof BUILDING_IDS)[number]];
      expect(def.initialLevel, id).toBe(0);
      expect(def.produces, id).toBeNull();
    }
  });

  it('em toda dificuldade e em todo nível o limite é um número inteiro de unidades', () => {
    // O motor arredonda o limite para baixo, em milésimos. Com os fatores de hoje nada é
    // cortado, e a tela mostra o mesmo número que a regra usa.
    for (const id of DIFFICULTY_IDS) {
      const { num, den } = difficulties[id].storageCapacity;
      expect((storage.baseCapacity * num) % den, id).toBe(0);
      for (const [building, def] of stores) {
        const { maxLevel } = buildings[building as (typeof BUILDING_IDS)[number]];
        for (let level = 1; level <= maxLevel; level += 1) {
          const capacity = def.level1 + def.perLevel * (level - 1);
          expect((capacity * num) % den, `${id} ${building} Nv${level}`).toBe(0);
        }
      }
    }
  });

  it('antes do edifício, o recurso fica em um lugar com nome próprio para as frases', () => {
    expect(storage.buildings.granary?.unbuilt).toEqual({ label: 'Despensa', article: 'a' });
    expect(storage.buildings.warehouse?.unbuilt).toEqual({ label: 'Pátio', article: 'o' });
  });

  it('o schema recusa um recurso guardado por dois edifícios e um edifício sem recurso', () => {
    const parse = (buildingsOf: unknown) =>
      BalanceSchema.safeParse({ ...balance, storage: { ...storage, buildings: buildingsOf } })
        .success;
    const { granary, warehouse } = storage.buildings;
    expect(parse({ granary, warehouse })).toBe(true);
    expect(parse({ granary, warehouse: { ...warehouse, resources: ['wood', 'food'] } })).toBe(
      false,
    );
    expect(parse({ granary: { ...granary, resources: [] }, warehouse })).toBe(false);
    expect(parse({ granary, castle: warehouse })).toBe(false);
    expect(
      BalanceSchema.safeParse({ ...balance, storage: { ...storage, baseCapacity: 0 } }).success,
    ).toBe(false);
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
    // O motor calcula taxas em milésimos por hora, em uma conta só com um arredondamento no
    // fim. Com nível, estação, fome e frio, todos juntos, nenhuma taxa é truncada: o
    // arredondamento só age com a mestria (e com a moral, quando entrar).
    const { levelBonus, perWorkerPerHour } = balance.production;
    const famine = balance.famine.productionMultiplier;
    const cold = balance.winter.cold.productionMultiplier;
    for (const season of balance.calendar.seasons) {
      for (const building of PRODUCTION_BUILDING_IDS) {
        const resource = buildings[building].produces;
        if (resource === null) {
          throw new Error(`${building} não produz nada.`);
        }
        const { num, den } = season.effects.production[resource];
        for (let level = 1; level <= buildings[building].maxLevel; level += 1) {
          const bonus = levelBonus.den + levelBonus.num * (level - 1);
          const top = perWorkerPerHour[building] * 1000 * bonus * num * famine.num * cold.num;
          const bottom = levelBonus.den * den * famine.den * cold.den;
          expect(top % bottom, `${season.id} ${building} Nv${level}`).toBe(0);
        }
      }
    }
  });

  it('a capacidade inicial é 10 e a penalidade da fome reduz a produção', () => {
    const { capacityPerLevel } = balance.housing;
    const capacity = BUILDING_IDS.reduce(
      (sum, id) => sum + (capacityPerLevel[id] ?? 0) * buildings[id].initialLevel,
      0,
    );
    expect(capacity).toBe(10);
    const { num, den } = balance.famine.productionMultiplier;
    expect(num).toBeLessThan(den);
  });

  it('o reembolso de cancelamento não passa do que foi pago', () => {
    const { num, den } = balance.construction.cancelRefund;
    expect(num).toBeLessThanOrEqual(den);
  });

  it('são duas filas de obras, e a segunda abre com o Salão no nível 4 (GDD §6.1 e §6.3)', () => {
    const { queues, secondQueueTownHallLevel } = balance.construction;
    expect(queues).toBe(2);
    expect(secondQueueTownHallLevel).toBe(4);
    // O nível que abre a fila é um nível a que o Salão chega depois de nascer.
    expect(secondQueueTownHallLevel).toBeGreaterThan(buildings.townHall.initialLevel);
    expect(secondQueueTownHallLevel).toBeLessThanOrEqual(buildings.townHall.maxLevel);
  });

  it('o schema recusa uma terceira fila, que não teria regra de abertura', () => {
    const withQueues = (queues: number) =>
      BalanceSchema.safeParse({
        ...balance,
        construction: { ...balance.construction, queues },
      }).success;
    expect(withQueues(1)).toBe(true);
    expect(withQueues(2)).toBe(true);
    expect(withQueues(3)).toBe(false);
    expect(withQueues(0)).toBe(false);
  });
});

describe('ofícios (GDD §5.4)', () => {
  const { craft } = balance;
  const withCraft = (change: Partial<typeof craft>) =>
    BalanceSchema.safeParse({ ...balance, craft: { ...craft, ...change } }).success;

  it('quem troca de ofício produz metade por um dia de jogo (ADR 0013, decisões 1 e 13)', () => {
    expect(craft.adaptationMultiplier).toEqual({ num: 1, den: 2 });
    expect(craft.adaptationMs).toBe(balance.calendar.dayMs);
  });

  it('em todo ritmo oferecido a adaptação dura um número inteiro de minutos reais', () => {
    // É o prazo que a tela anuncia antes da troca: "produz metade por 40 min".
    for (const pace of balance.paces) {
      expect((craft.adaptationMs / pace.timeScale) % 60_000, pace.label).toBe(0);
    }
  });

  it('a experiência vai de 0 a 100: +4 por dia ocupado, −8 por dia vazio, mestria de +30%', () => {
    expect(craft.experiencePerDay).toBe(4);
    expect(craft.experienceLossPerDay).toBe(8);
    expect(craft.maxExperience).toBe(100);
    expect(craft.masteryBonus).toEqual({ num: 3, den: 10 });
    // Perder é mais rápido que ganhar: largar um ofício custa mais do que um dia de volta.
    expect(craft.experienceLossPerDay).toBeGreaterThan(craft.experiencePerDay);
    // O máximo se alcança em um número inteiro de dias, sem sobra cortada no último.
    expect(craft.maxExperience % craft.experiencePerDay).toBe(0);
  });

  it('ocupado é um trabalhador por nível do edifício; não há limite de postos', () => {
    expect(craft.occupiedWorkersPerLevel).toBe(1);
    expect(Object.keys(craft)).not.toContain('maxWorkers');
  });

  it('o schema recusa adaptação que rende mais que o ofício, prazo zero e experiência parada', () => {
    expect(withCraft({})).toBe(true);
    expect(withCraft({ adaptationMultiplier: { num: 1, den: 1 } })).toBe(true);
    expect(withCraft({ adaptationMultiplier: { num: 3, den: 2 } })).toBe(false);
    expect(withCraft({ adaptationMultiplier: { num: 0, den: 2 } })).toBe(false);
    expect(withCraft({ adaptationMs: 0 })).toBe(false);
    expect(withCraft({ experiencePerDay: 0 })).toBe(false);
    expect(withCraft({ experienceLossPerDay: -8 })).toBe(false);
    expect(withCraft({ maxExperience: 0 })).toBe(false);
    expect(withCraft({ occupiedWorkersPerLevel: 0 })).toBe(false);
    const withoutCraft = Object.fromEntries(
      Object.entries(balance).filter(([key]) => key !== 'craft'),
    );
    expect(BalanceSchema.safeParse(withoutCraft).success).toBe(false);
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

  it('as recompensas são +20 ouro, +30 madeira, +40 comida e o desbloqueio dos depósitos', () => {
    expect(objectives.map((objective) => objective.reward)).toEqual([
      { gold: 20 },
      { wood: 30 },
      { food: 40 },
      {},
    ]);
    expect(objectives.map((objective) => objective.rewardText)).toEqual([
      undefined,
      undefined,
      undefined,
      'desbloqueia o Celeiro e o Armazém',
    ]);
  });

  it('o objetivo 4 promete o que o Salão no nível 2 libera, e só isso', () => {
    const fourth = objectives.find((objective) => objective.id === 'townHallLevel2');
    expect(fourth?.condition).toEqual({ type: 'buildingLevel', building: 'townHall', level: 2 });
    const unlocked = BUILDING_IDS.filter((id) => buildings[id].requires.townHall === 2);
    expect(unlocked).toEqual(['granary', 'warehouse']);
    for (const id of unlocked) {
      expect(fourth?.rewardText).toContain(buildings[id].label);
    }
    // A Torre de Vigia entra na frase quando existir.
    expect(fourth?.rewardText).not.toContain('Torre');
  });

  it('o schema recusa objetivo sem recompensa e texto de recompensa que não cabe na frase', () => {
    const [first] = objectives;
    if (first === undefined) {
      throw new Error('O conteúdo não tem objetivos.');
    }
    const parse = (changed: object) =>
      ObjectivesSchema.safeParse([{ ...first, ...changed }]).success;
    expect(parse({})).toBe(true);
    expect(parse({ reward: {} })).toBe(false);
    expect(parse({ reward: {}, rewardText: 'desbloqueia o Celeiro' })).toBe(true);
    expect(parse({ rewardText: 'Desbloqueia o Celeiro' })).toBe(false);
    expect(parse({ rewardText: 'desbloqueia o Celeiro.' })).toBe(false);
    expect(parse({ reward: { gold: 0 } })).toBe(false);
  });
});

describe('Crônica', () => {
  it('todo tipo de evento tem modelo de frase', () => {
    expect(Object.keys(chronicleTemplates).sort()).toEqual([...EVENT_TYPES].sort());
    for (const type of EVENT_TYPES) {
      expect(chronicleTemplates[type].trim()).not.toBe('');
    }
  });

  it('a obra que ergue um edifício do zero tem frases próprias, sem nível', () => {
    expect(FoundingTemplatesSchema.safeParse(foundingTemplates).error).toBeUndefined();
    expect(Object.keys(foundingTemplates)).toEqual([
      'constructionStarted',
      'constructionAutoStarted',
      'constructionCancelled',
    ]);
    for (const [type, template] of Object.entries(foundingTemplates)) {
      expect(EVENT_TYPES, type).toContain(type);
      expect(template, type).toContain('{edificio}');
      expect(template, type).not.toContain('{nivel}');
      expect(template, type).not.toBe(chronicleTemplates[type as keyof typeof foundingTemplates]);
    }
    expect(chronicleTemplates.buildingFounded).toContain('{edificio}');
    expect(chronicleTemplates.buildingFounded).not.toContain('{nivel}');
  });

  it('a obra que começa sozinha diz que ninguém a mandou começar, e não repete a frase da ordem', () => {
    for (const template of [
      chronicleTemplates.constructionAutoStarted,
      foundingTemplates.constructionAutoStarted,
    ]) {
      expect(template).toContain('sozinhos');
      expect(template).toContain('com as reservas cheias');
      expect(template).toContain('{edificio}');
    }
    expect(chronicleTemplates.constructionAutoStarted).toContain('{nivel}');
    expect(chronicleTemplates.constructionAutoStarted).not.toBe(
      chronicleTemplates.constructionStarted,
    );
    expect(foundingTemplates.constructionAutoStarted).not.toBe(
      foundingTemplates.constructionStarted,
    );
  });

  it('o depósito cheio diz qual e de quê; o desperdício do dia diz quanto foi ao chão', () => {
    expect(chronicleTemplates.storageFilled).toContain('{deposito}');
    expect(chronicleTemplates.storageFilled).toContain('{recurso}');
    expect(chronicleTemplates.storageFilled).toContain('se perde');
    expect(chronicleTemplates.storageWasted).toContain('{perda}');
    // A frase não depende de quantos recursos nem de quanto: a lista entra depois dos dois pontos.
    expect(chronicleTemplates.storageWasted.endsWith(': {perda}.')).toBe(true);
  });

  it('o frio tem voz própria: não soa como a fome', () => {
    expect(EVENT_TYPES).toContain('coldStarted');
    expect(EVENT_TYPES).toContain('coldEnded');
    expect(chronicleTemplates.coldStarted).toContain('lenha');
    expect(chronicleTemplates.coldStarted).toContain('frio');
    expect(chronicleTemplates.coldStarted).not.toMatch(/fome|despensas|pão/);
    expect(chronicleTemplates.coldEnded).not.toMatch(/fome|despensas|pão/);
    expect(chronicleTemplates.coldStarted).not.toBe(chronicleTemplates.famineStarted);
  });

  it('o fim do frio diz por que ele passou: a lenha voltou ou a estação virou', () => {
    expect(chronicleTemplates.coldEnded).toContain('{alivio}');
    expect(Object.keys(coldReliefs)).toEqual(['firewood', 'thaw']);
    for (const relief of Object.values(coldReliefs)) {
      expect(relief.trim()).not.toBe('');
      // Entra no meio da frase: sem maiúscula e sem ponto.
      expect(relief).toBe(relief.toLowerCase());
      expect(relief).not.toMatch(/[.{}]/);
    }
    expect(coldReliefs.firewood).not.toBe(coldReliefs.thaw);
  });

  it('o ofício dominado diz quem o domina e o que se diz deles, um ofício de cada vez', () => {
    expect(EVENT_TYPES).toContain('craftMastered');
    expect(chronicleTemplates.craftMastered).toContain('{artifices}');
    expect(chronicleTemplates.craftMastered).toContain('{feito}');
    expect(chronicleTemplates.craftMastered).toContain('{feudo}');
    expect(CraftGuildsSchema.safeParse(craftGuilds).error).toBeUndefined();
    expect(Object.keys(craftGuilds)).toEqual([...PRODUCTION_BUILDING_IDS]);
    const guilds = Object.values(craftGuilds);
    expect(new Set(guilds.map((guild) => guild.artisans)).size).toBe(guilds.length);
    expect(new Set(guilds.map((guild) => guild.feat)).size).toBe(guilds.length);
    // "Os pedreiros" já são os da obra: quem tira pedra tem outro nome.
    expect(guilds.map((guild) => guild.artisans)).not.toContain('os pedreiros');
    // As frases entram no meio de outra: o schema recusa maiúscula, ponto e marcador.
    const broken = (guild: { artisans: string; feat: string }) =>
      CraftGuildsSchema.safeParse({ ...craftGuilds, farm: guild }).success;
    expect(broken({ artisans: 'Os lavradores', feat: 'colhem bem' })).toBe(false);
    expect(broken({ artisans: 'os lavradores', feat: 'colhem bem.' })).toBe(false);
    expect(broken({ artisans: 'os lavradores', feat: 'colhem em {feudo}' })).toBe(false);
    const missing = Object.fromEntries(
      Object.entries(craftGuilds).filter(([building]) => building !== 'farm'),
    );
    expect(CraftGuildsSchema.safeParse(missing).success).toBe(false);
  });
});
