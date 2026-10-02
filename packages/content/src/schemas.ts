import { z } from 'zod';

import {
  CHRONICLE_PLACEHOLDERS,
  cutRewardTemplates,
  EVENT_TYPES,
  foundingTemplates,
  injuryTemplates,
} from './chronicle';
import { COUNCIL_EFFECT_TYPES } from './council';
import {
  BUILDING_IDS,
  DIFFICULTY_IDS,
  ENEMY_IDS,
  MORALE_BAND_IDS,
  PRODUCTION_BUILDING_IDS,
  RAID_SIZE_IDS,
  RESOURCE_IDS,
  SEASON_IDS,
  TILE_TYPE_IDS,
} from './ids';
import { OBJECTIVE_CONDITION_TYPES } from './objectives';

const positiveInt = z.number().int().positive();
const label = z.string().trim().min(1);

const resourceId = z.enum(RESOURCE_IDS);
const buildingId = z.enum(BUILDING_IDS);
const productionBuildingId = z.enum(PRODUCTION_BUILDING_IDS);

const resourceAmounts = z
  .partialRecord(resourceId, positiveInt)
  .refine((amounts) => Object.keys(amounts).length > 0, 'ao menos um recurso');

const ratio = z.strictObject({ num: positiveInt, den: positiveInt });
/** Uma fração que pode ser zero: a lenha das estações em que nada se queima. */
const ratioOrZero = z.strictObject({ num: z.number().int().nonnegative(), den: positiveInt });

const perResource = <T extends z.ZodType>(value: T) =>
  z.strictObject({ food: value, wood: value, stone: value, gold: value });

const exactlyOneRecommended = (items: ReadonlyArray<{ recommended: boolean }>) =>
  items.filter((item) => item.recommended).length === 1;

const seasonEffects = z.strictObject({
  production: perResource(ratio),
  recruitmentDuration: ratio,
  constructionDuration: ratio,
  firewoodPerVillagerPerHour: ratioOrZero,
});

const difficulty = z.strictObject({
  label,
  description: label,
  recommended: z.boolean(),
  storageCapacity: ratio,
  famineDesertion: z.boolean(),
});

const storageBuilding = z.strictObject({
  resources: z.array(resourceId).min(1),
  level1: positiveInt,
  perLevel: positiveInt,
  unbuilt: z.strictObject({ label, article: z.enum(['o', 'a']) }),
});

const negativeInt = z.number().int().negative();
/** Uma chance: de zero a um. */
const chance = ratio.refine(({ num, den }) => num <= den, 'chance maior que 1');

const morale = z
  .strictObject({
    base: z.number().int().nonnegative(),
    foodReserve: z.strictObject({ coverMs: positiveInt, bonus: positiveInt }),
    famine: negativeInt,
    faminePerDay: negativeInt,
    housingFull: negativeInt,
    cold: negativeInt,
    multiplier: z.strictObject({ base: ratio, perPoint: ratio }),
    // Uma faixa por id, na ordem, cada uma acima da anterior: juntas cobrem de 0 ao máximo.
    bands: z
      .array(
        z.strictObject({ id: z.enum(MORALE_BAND_IDS), max: z.number().int().nonnegative(), label }),
      )
      .length(MORALE_BAND_IDS.length)
      .refine(
        (bands) => bands.every((band, index) => band.id === MORALE_BAND_IDS[index]),
        'faixas fora da ordem',
      )
      .refine(
        (bands) =>
          bands.every((band, index) => index === 0 || band.max > (bands[index - 1]?.max ?? 0)),
        'faixas que não sobem',
      ),
    arrival: z.strictObject({ minMorale: positiveInt, chance }),
    departure: z.strictObject({ maxMorale: z.number().int().nonnegative(), chance }),
    famineDesertionAfterMs: positiveInt,
    populationFloor: positiveInt,
  })
  .refine(
    ({ base, bands }) => base <= (bands[bands.length - 1]?.max ?? 0),
    'moral base acima do máximo',
  )
  // Quem pode ganhar um colono não pode perder um aldeão na mesma virada.
  .refine(
    ({ arrival, departure }) => departure.maxMorale < arrival.minMorale,
    'partida e chegada na mesma moral',
  );

/** As marcas da Crônica, as incursões e a Torre de Vigia (GDD §8.2). */
const threat = z
  .strictObject({
    max: positiveInt,
    perActiveTilePerDay: positiveInt,
    seasonPerDay: z.partialRecord(z.enum(SEASON_IDS), positiveInt),
    chronicleMarks: z
      .array(positiveInt)
      .min(1)
      .refine(
        (marks) => marks.every((mark, index) => index === 0 || mark > (marks[index - 1] ?? 0)),
        'marcas fora de ordem',
      ),
    raidChanceAbove: z.number().int().nonnegative(),
    mediumRaidAbove: positiveInt,
    raidDrop: positiveInt,
    raidLeadMs: positiveInt,
    // Cada nível avisa mais cedo que o anterior, e o que já distingue o tamanho não o esquece.
    watchtowerLevels: z
      .array(z.strictObject({ warningMs: positiveInt, revealsRaidSize: z.boolean() }))
      .min(1)
      .refine(
        (levels) =>
          levels.every((level, index) => {
            const previous = levels[index - 1];
            return (
              previous === undefined ||
              (level.warningMs > previous.warningMs &&
                (level.revealsRaidSize || !previous.revealsRaidSize))
            );
          }),
        'nível da Torre que avisa menos que o anterior',
      ),
    // Cada nível da Paliçada segura um tamanho maior que o anterior.
    palisadeLevels: z
      .array(z.strictObject({ absorbs: z.enum(RAID_SIZE_IDS) }))
      .min(1)
      .refine(
        (levels) =>
          levels.every((level, index) => {
            const previous = levels[index - 1];
            return (
              previous === undefined ||
              RAID_SIZE_IDS.indexOf(level.absorbs) > RAID_SIZE_IDS.indexOf(previous.absorbs)
            );
          }),
        'nível da Paliçada que não segura mais que o anterior',
      ),
    // O que passa por uma Paliçada pequena demais é uma parte do estrago, nunca ele inteiro.
    palisadeBreach: ratio.refine(({ num, den }) => num < den, 'a Paliçada não segura nada'),
  })
  .refine(
    ({ max, chronicleMarks }) => chronicleMarks.every((mark) => mark <= max),
    'marca acima do máximo da Ameaça',
  )
  .refine(
    ({ max, raidChanceAbove, mediumRaidAbove }) =>
      raidChanceAbove < mediumRaidAbove && mediumRaidAbove <= max,
    'limites de incursão fora de ordem',
  )
  // O aviso mais longo cabe no prazo da incursão: ninguém avisa do que ainda não foi sorteado.
  .refine(
    ({ raidLeadMs, watchtowerLevels }) =>
      watchtowerLevels.every((level) => level.warningMs <= raidLeadMs),
    'aviso da Torre maior que o prazo da incursão',
  );

const raidDamage = z.strictObject({
  // Uma incursão leva uma parte do estoque, nunca ele inteiro.
  lossRatio: ratio.refine(({ num, den }) => num < den, 'a incursão leva o estoque inteiro'),
  resources: z
    .array(resourceId)
    .min(1)
    .refine((resources) => new Set(resources).size === resources.length, 'recurso repetido'),
  injuries: positiveInt,
});

/** As incursões: a do roteiro, o estrago de cada tamanho e o que fica depois (GDD §8.2). */
const raids = z.strictObject({
  scripted: z
    .array(
      z
        .strictObject({
          id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
          enemy: z.enum(ENEMY_IDS),
          size: z.enum(RAID_SIZE_IDS),
          atGameDay: positiveInt,
          howlAtGameDay: positiveInt,
        })
        // O prenúncio vem antes do que ele anuncia.
        .refine((raid) => raid.howlAtGameDay < raid.atGameDay, 'uivos depois da incursão'),
    )
    .refine(
      (scripted) => new Set(scripted.map((raid) => raid.id)).size === scripted.length,
      'incursões do roteiro com o mesmo id',
    )
    // No máximo uma incursão marcada por vez: o roteiro não marca duas para o mesmo dia.
    .refine(
      (scripted) => new Set(scripted.map((raid) => raid.atGameDay)).size === scripted.length,
      'duas incursões do roteiro no mesmo dia',
    ),
  damage: z.strictObject(
    Object.fromEntries(
      ENEMY_IDS.map((enemy) => [
        enemy,
        z
          .strictObject(Object.fromEntries(RAID_SIZE_IDS.map((size) => [size, raidDamage])))
          // Um tamanho maior nunca custa menos que o anterior.
          .refine((sizes) => {
            const ordered = RAID_SIZE_IDS.map((size) => sizes[size] as z.infer<typeof raidDamage>);
            return ordered.every((damage, index) => {
              const previous = ordered[index - 1];
              return (
                previous === undefined ||
                (damage.injuries >= previous.injuries &&
                  damage.lossRatio.num * previous.lossRatio.den >=
                    previous.lossRatio.num * damage.lossRatio.den)
              );
            });
          }, 'incursão maior que custa menos que a menor'),
      ]),
    ),
  ),
  injuryMs: positiveInt,
  moraleOnLosses: z.number().int().negative(),
  moraleLossDays: positiveInt,
  // Entra na conta da moral como o nome de um termo: maiúscula, sem ponto.
  moraleLabel: label.regex(/^\p{Lu}[^.{}]*$/u),
});

const pace = z.strictObject({
  timeScale: z.number().positive(),
  label,
  description: label,
  hint: label,
  recommended: z.boolean(),
});

export const BalanceSchema = z.strictObject({
  resources: perResource(z.strictObject({ label })),
  initial: z.strictObject({
    villagers: positiveInt,
    resources: perResource(z.number().int().nonnegative()),
  }),
  production: z.strictObject({
    perWorkerPerHour: z.strictObject({
      farm: positiveInt,
      lumberMill: positiveInt,
      quarry: positiveInt,
      goldMine: positiveInt,
    }),
    levelBonus: ratio,
  }),
  consumption: z.strictObject({ foodPerVillagerPerHour: positiveInt }),
  housing: z.strictObject({ capacityPerLevel: z.partialRecord(buildingId, positiveInt) }),
  recruitment: z.strictObject({
    cost: resourceAmounts,
    durationMs: positiveInt,
    maxQueue: positiveInt,
    maxPerOrder: positiveInt,
  }),
  construction: z.strictObject({
    costFactor: ratio,
    costFactorByBuilding: z.partialRecord(buildingId, ratio),
    timeFactor: ratio,
    maxDurationMs: positiveInt,
    cancelRefund: ratio,
    // Só a segunda fila tem regra de abertura: uma terceira pediria outro número.
    queues: positiveInt.max(2),
    secondQueueTownHallLevel: positiveInt,
    gateLevelsAboveTownHall: z.number().int().nonnegative(),
  }),
  storage: z
    .strictObject({
      baseCapacity: positiveInt,
      buildings: z.partialRecord(buildingId, storageBuilding),
    })
    .refine(({ buildings }) => {
      const stored = Object.values(buildings).flatMap((entry) => entry?.resources ?? []);
      return new Set(stored).size === stored.length;
    }, 'um recurso guardado por dois edifícios'),
  famine: z.strictObject({ productionMultiplier: ratio }),
  craft: z.strictObject({
    adaptationMs: positiveInt,
    // Quem está em adaptação nunca vale mais que um trabalhador adaptado.
    adaptationMultiplier: ratio.refine(({ num, den }) => num <= den, 'adaptação que rende mais'),
    experiencePerDay: positiveInt,
    experienceLossPerDay: positiveInt,
    maxExperience: positiveInt,
    masteryBonus: ratio,
    occupiedWorkersPerLevel: positiveInt,
  }),
  morale,
  winter: z.strictObject({ cold: z.strictObject({ productionMultiplier: ratio }) }),
  calendar: z.strictObject({
    dayMs: positiveInt,
    seasons: z
      .array(
        z.strictObject({
          id: z.enum(SEASON_IDS),
          label,
          article: z.enum(['a', 'o']),
          days: positiveInt,
          effects: seasonEffects,
        }),
      )
      .length(SEASON_IDS.length),
  }),
  settlement: z.strictObject({ nameMinLength: positiveInt, nameMaxLength: positiveInt }),
  objectives: z.strictObject({ maxActive: positiveInt }),
  difficulties: z
    .strictObject({ peasant: difficulty, lord: difficulty, ironKing: difficulty })
    .refine(
      (difficulties) => exactlyOneRecommended(Object.values(difficulties)),
      'exatamente uma dificuldade recomendada',
    ),
  paces: z
    .array(pace)
    .min(1)
    .refine(exactlyOneRecommended, 'exatamente um ritmo recomendado')
    .refine(
      (paces) => new Set(paces.map((entry) => entry.timeScale)).size === paces.length,
      'ritmos repetidos',
    ),
  council: z.strictObject({
    drawIntervalDays: positiveInt,
    maxPending: positiveInt,
    expiryRealMs: positiveInt,
  }),
  threat,
  raids,
});

export const BuildingSchema = z
  .strictObject({
    label,
    article: z.enum(['o', 'a', 'os', 'as']),
    baseCost: resourceAmounts,
    baseDurationMs: positiveInt,
    initialLevel: z.number().int().nonnegative(),
    maxLevel: z.number().int().min(2),
    produces: resourceId.nullable(),
    requires: z.partialRecord(buildingId, positiveInt),
    // Entra depois de "já está no nível máximo.": uma frase inteira.
    maxLevelNote: label.regex(/^\p{Lu}.*\.$/u).optional(),
  })
  .refine((def) => def.maxLevel > def.initialLevel, 'nível máximo abaixo do inicial');

export const BuildingsSchema = z.strictObject({
  townHall: BuildingSchema,
  farm: BuildingSchema,
  lumberMill: BuildingSchema,
  quarry: BuildingSchema,
  goldMine: BuildingSchema,
  housing: BuildingSchema,
  granary: BuildingSchema,
  warehouse: BuildingSchema,
  watchtower: BuildingSchema,
  palisade: BuildingSchema,
});

export const ObjectiveConditionSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('workersAtLeast'),
    building: productionBuildingId,
    count: positiveInt,
  }),
  z.strictObject({ type: z.literal('constructionStarted'), building: buildingId }),
  z.strictObject({ type: z.literal('villagersRecruited'), count: positiveInt }),
  z.strictObject({ type: z.literal('buildingLevel'), building: buildingId, level: positiveInt }),
  z.strictObject({
    type: z.literal('anyBuildingLevel'),
    // Com um edifício só, a condição é `buildingLevel`.
    buildings: z
      .array(buildingId)
      .min(2)
      .refine((list) => new Set(list).size === list.length, 'edifício repetido'),
    level: positiveInt,
  }),
  z.strictObject({ type: z.literal('cardAnswered'), count: positiveInt }),
  z.strictObject({ type: z.literal('plannedAutoStart') }),
  z.strictObject({
    type: z.literal('seasonSurvived'),
    season: z.enum(SEASON_IDS),
    count: positiveInt,
  }),
]);

export const ObjectiveSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    // O título é a ação, sem ponto: entra na Crônica depois de "cumpriu-se um objetivo:".
    title: label.regex(/^\p{Lu}.*[^.]$/u),
    // O porquê é uma frase inteira: a tela a põe ao lado da recompensa.
    hint: label.regex(/^\p{Lu}.*\.$/u),
    condition: ObjectiveConditionSchema,
    reward: z.partialRecord(resourceId, positiveInt),
    // A moral de um objetivo é sempre um prêmio. O nome entra na conta da moral como um termo:
    // maiúscula, sem ponto.
    morale: z
      .strictObject({
        amount: positiveInt,
        durationDays: positiveInt,
        label: label.regex(/^\p{Lu}[^.{}]*$/u),
      })
      .optional(),
    // Entra depois de "Recompensa:" e ao lado de "+20 ouro": minúscula, sem ponto final.
    rewardText: label.regex(/^\p{Ll}.*[^.]$/u).optional(),
  })
  .refine(
    (objective) =>
      Object.keys(objective.reward).length > 0 ||
      objective.morale !== undefined ||
      objective.rewardText !== undefined,
    'objetivo sem recompensa',
  );

export const ObjectivesSchema = z
  .array(ObjectiveSchema)
  .min(1)
  .refine(
    (list) => new Set(list.map((objective) => objective.id)).size === list.length,
    'id de objetivo repetido',
  )
  // O nome do termo é o que distingue um efeito do outro na conta da moral.
  .refine((list) => {
    const labels = list.flatMap((objective) => objective.morale?.label ?? []);
    return new Set(labels).size === labels.length;
  }, 'dois objetivos com o mesmo nome de efeito de moral');

const placeholderPattern = /\{([^}]*)\}/g;
const knownPlaceholders: readonly string[] = CHRONICLE_PLACEHOLDERS;

const chronicleTemplate = label.refine(
  (template) =>
    [...template.matchAll(placeholderPattern)].every((match) =>
      knownPlaceholders.includes(match[1] ?? ''),
    ),
  'marcador desconhecido no modelo de frase',
);

export const ChronicleTemplatesSchema = z.strictObject(
  Object.fromEntries(EVENT_TYPES.map((type) => [type, chronicleTemplate])),
);

/** As frases da obra que ergue um edifício do zero: só para eventos que existem. */
export const FoundingTemplatesSchema = z.strictObject(
  Object.fromEntries(Object.keys(foundingTemplates).map((type) => [type, chronicleTemplate])),
);

/** As frases da recompensa cortada no limite do depósito: só para eventos que existem. */
export const CutRewardTemplatesSchema = z.strictObject(
  Object.fromEntries(Object.keys(cutRewardTemplates).map((type) => [type, chronicleTemplate])),
);

/**
 * Quem trabalha em cada edifício produtivo e o que se diz deles: os dois entram no meio de uma
 * frase, em minúscula e sem ponto.
 */
const midSentence = label.regex(/^\p{Ll}[^.{}]*$/u);
export const CraftGuildsSchema = z.strictObject(
  Object.fromEntries(
    PRODUCTION_BUILDING_IDS.map((id) => [
      id,
      z.strictObject({ artisans: midSentence, artisan: midSentence, feat: midSentence }),
    ]),
  ),
);

/** Quem parte sem ofício: entra no meio da frase, como os de `craftGuilds`. */
export const IdleVillagerSchema = midSentence;

/** As frases da mudança de faixa da moral: uma por faixa de chegada e por sentido. */
export const MoraleBandTemplatesSchema = z.strictObject(
  Object.fromEntries(
    MORALE_BAND_IDS.map((id) => [
      id,
      z.strictObject({ rose: chronicleTemplate.optional(), fell: chronicleTemplate.optional() }),
    ]),
  ),
);

/**
 * As frases da Ameaça que cruza uma marca, com o número dela como chave: a da primeira vez e a
 * de quando ela volta depois de uma incursão a derrubar, que não podem ser iguais.
 */
export const ThreatMarkTemplatesSchema = z.record(
  z.string().regex(/^[1-9]\d*$/),
  z
    .strictObject({ first: chronicleTemplate, again: chronicleTemplate })
    .refine(({ first, again }) => first !== again, 'a marca cruzada de novo repete a frase'),
);

/**
 * As frases das incursões, por inimigo. As que abrem a linha levam a data; as que vêm depois
 * (o desfecho e o conselho) são frases inteiras, com maiúscula e ponto, e não repetem a data.
 */
const datedTemplate = chronicleTemplate.regex(/^No \{dia\}º dia \{daEstacao\}, .*\.$/);
const followingSentence = chronicleTemplate
  .regex(/^\p{Lu}.*\.$/u)
  .refine((template) => !template.includes('{dia}'), 'frase de continuação com data');
export const RaidTemplatesSchema = z.strictObject(
  Object.fromEntries(
    ENEMY_IDS.map((enemy) => [
      enemy,
      z.strictObject({
        howl: z.strictObject({ unwatched: datedTemplate, watched: datedTemplate }),
        announced: z.strictObject({
          warned: datedTemplate,
          // O aviso que distingue o tamanho o diz.
          sized: datedTemplate.refine((template) => template.includes('{bando}'), 'sem {bando}'),
        }),
        arrival: z.strictObject({
          unwarned: datedTemplate,
          warned: datedTemplate,
          sized: datedTemplate.refine((template) => template.includes('{bando}'), 'sem {bando}'),
        }),
        outcome: z.strictObject({
          held: followingSentence,
          // A incursão que passa diz o que custou.
          breached: followingSentence.refine((t) => t.includes('{perda}'), 'sem {perda}'),
          open: followingSentence.refine((t) => t.includes('{perda}'), 'sem {perda}'),
          emptyHanded: followingSentence,
        }),
        advice: z.strictObject({
          build: followingSentence,
          upgrade: followingSentence.refine((t) => t.includes('{nivel}'), 'sem {nivel}'),
        }),
      }),
    ]),
  ),
);

/** As frases de quem se fere e de quem sara: com ofício e sem ofício, todas com {aldeao}. */
const injuryTemplate = datedTemplate.refine((t) => t.includes('{aldeao}'), 'sem {aldeao}');
export const InjuryTemplatesSchema = z.strictObject(
  Object.fromEntries(
    Object.keys(injuryTemplates).map((type) => [
      type,
      z.strictObject({ worker: injuryTemplate, idle: injuryTemplate }),
    ]),
  ),
);

/** O que um ataque custa em gente: entra no fim de uma lista, em minúscula e sem ponto. */
export const InjuredLossSchema = z.strictObject({
  one: label.regex(/^\p{Ll}[^.{}]*$/u),
  many: label.regex(/^\{quantidade\} \p{Ll}[^.{}]*$/u),
});

/** Os tipos de tile: rótulo, artigo e o inimigo que mora nele. */
export const TileTypesSchema = z.strictObject(
  Object.fromEntries(
    TILE_TYPE_IDS.map((id) => [
      id,
      z.strictObject({ label, article: z.enum(['o', 'a']), enemy: z.enum(ENEMY_IDS) }),
    ]),
  ),
);

/** Os tiles com que um feudo nasce: ids únicos, de tipos que existem. */
export const StartingTilesSchema = z
  .array(
    z.strictObject({
      id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
      type: z.enum(TILE_TYPE_IDS),
      threatActive: z.boolean(),
    }),
  )
  .refine(
    (tiles) => new Set(tiles.map((tile) => tile.id)).size === tiles.length,
    'tiles com o mesmo id',
  );

/** Os inimigos: o nome e o que os vigias dizem de cada tamanho, tudo para o meio da frase. */
export const EnemiesSchema = z.strictObject(
  Object.fromEntries(
    ENEMY_IDS.map((id) => [
      id,
      z.strictObject({
        label: midSentence,
        sizes: z.strictObject(Object.fromEntries(RAID_SIZE_IDS.map((size) => [size, midSentence]))),
      }),
    ]),
  ),
);

/** Os tamanhos de incursão, como as frases os chamam em geral: no plural e em minúscula. */
export const RaidSizesSchema = z.strictObject(
  Object.fromEntries(RAID_SIZE_IDS.map((size) => [size, z.strictObject({ plural: midSentence })])),
);

const identifier = z.string().regex(/^[a-z][A-Za-z0-9]*$/);
/** Uma flag: identificadores separados por ponto, o primeiro sendo a cadeia: `commonGranary.open`. */
const flag = z.string().regex(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)+$/);
const nonZeroInt = z
  .number()
  .int()
  .refine((value) => value !== 0, 'zero não é efeito');

export const CouncilEffectSchema = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('resources'),
    amounts: z
      .partialRecord(resourceId, nonZeroInt)
      .refine((amounts) => Object.keys(amounts).length > 0, 'ao menos um recurso'),
  }),
  z.strictObject({ type: z.literal('morale'), amount: nonZeroInt, durationDays: positiveInt }),
  z.strictObject({ type: z.literal('setFlag'), flag }),
  z.strictObject({ type: z.literal('clearFlag'), flag }),
  z.strictObject({ type: z.literal('scheduleCard'), cardId: identifier, afterDays: positiveInt }),
]);

const effects = z
  .array(CouncilEffectSchema)
  // Dois efeitos de moral na mesma lista seriam um só com a soma, e a explicação diria dois.
  .refine(
    (list) => list.filter((effect) => effect.type === 'morale').length <= 1,
    'mais de um efeito de moral na mesma lista',
  );

/** Uma frase de pista ou de situação: começa em maiúscula e termina com ponto. */
const sentence = label.regex(/^\p{Lu}.*[.!?]$/su);
const sentenceCount = (text: string) => text.split(/[.!?]+(?:\s+|$)/u).filter(Boolean).length;

export const CouncilOptionSchema = z.strictObject({
  id: identifier,
  // Verbo no infinitivo, sem números: o custo aparece ao lado, e não pode haver dois lugares
  // dizendo o mesmo número.
  label: label.regex(
    /^\p{Lu}\p{Ll}*(?:ar|er|ir|or|ôr)(?:\s[^\d.]*)?$/u,
    'verbo no infinitivo, sem números',
  ),
  requires: z
    .strictObject({ building: buildingId.optional(), resources: resourceAmounts.optional() })
    .refine((requires) => Object.keys(requires).length > 0, 'requisito vazio')
    .optional(),
  cost: resourceAmounts.optional(),
  effects,
  hint: sentence,
  hidden: z
    .strictObject({
      afterDays: positiveInt,
      effects: effects.min(1),
      chronicle: chronicleTemplate,
    })
    .optional(),
  chronicle: chronicleTemplate,
  expiredChronicle: chronicleTemplate.optional(),
});

const moralRange = z
  .tuple([z.number().int().nonnegative(), z.number().int().nonnegative()])
  .refine(([min, max]) => min <= max, 'faixa de moral invertida');

export const CouncilCardSchema = z
  .strictObject({
    id: identifier,
    title: label,
    // De 2 a 4 frases, no tom da Crônica (GDD Apêndice B).
    text: sentence.refine((text) => {
      const count = sentenceCount(text);
      return count >= 2 && count <= 4;
    }, 'a situação tem de 2 a 4 frases'),
    weight: z.number().int().nonnegative(),
    recurring: z.boolean().optional(),
    requires: z
      .strictObject({
        seasons: z.array(z.enum(SEASON_IDS)).min(1).optional(),
        minDay: positiveInt.optional(),
        buildings: z.partialRecord(buildingId, positiveInt).optional(),
        flags: z.array(flag).min(1).optional(),
        notFlags: z.array(flag).min(1).optional(),
        moralRange: moralRange.optional(),
      })
      .refine((requires) => Object.keys(requires).length > 0, 'requisito vazio')
      .optional(),
    scripted: z.strictObject({ atGameDay: positiveInt }).optional(),
    autoResolve: z.strictObject(
      Object.fromEntries(DIFFICULTY_IDS.map((id) => [id, identifier])) as Record<
        (typeof DIFFICULTY_IDS)[number],
        typeof identifier
      >,
    ),
    autoResolveIfUnlocked: identifier.optional(),
    options: z.array(CouncilOptionSchema).min(2).max(3),
    variants: z
      .array(
        z.strictObject({
          flag,
          text: sentence.refine((text) => {
            const count = sentenceCount(text);
            return count >= 2 && count <= 4;
          }, 'a situação tem de 2 a 4 frases'),
          arrival: chronicleTemplate.optional(),
        }),
      )
      .min(1)
      .optional(),
    arrival: chronicleTemplate.optional(),
  })
  .superRefine((card, context) => {
    const ids = card.options.map((option) => option.id);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({ code: 'custom', message: 'opções com o mesmo id', path: ['options'] });
    }
    // A opção que o conselho aplica sozinho existe e não cobra nada: a expiração nunca tira do
    // jogador o que ele não tem (ADR 0014, decisão 9).
    for (const difficulty of DIFFICULTY_IDS) {
      const option = card.options.find((entry) => entry.id === card.autoResolve[difficulty]);
      const path = ['autoResolve', difficulty];
      if (option === undefined) {
        context.addIssue({ code: 'custom', message: 'opção automática inexistente', path });
      } else if (option.cost !== undefined || option.requires !== undefined) {
        context.addIssue({
          code: 'custom',
          message: 'opção automática com custo ou requisito',
          path,
        });
      }
    }
    // A que o conselho aplica quando o feudo já tem o que ela exige: existe, exige algo (sem
    // requisito ela seria só mais uma automática) e também não cobra nada.
    if (card.autoResolveIfUnlocked !== undefined) {
      const option = card.options.find((entry) => entry.id === card.autoResolveIfUnlocked);
      const path = ['autoResolveIfUnlocked'];
      if (option === undefined) {
        context.addIssue({ code: 'custom', message: 'opção automática inexistente', path });
      } else if (option.requires === undefined || option.cost !== undefined) {
        context.addIssue({
          code: 'custom',
          message: 'opção automática destrancada sem requisito ou com custo',
          path,
        });
      }
    }
  });

/**
 * O catálogo inteiro: além de cada carta, o que só se vê olhando todas. Ids únicos; toda flag
 * exigida, proibida, lembrada ou apagada tem quem a grave; toda continuação aponta para uma
 * carta que existe; e toda carta de peso zero tem como chegar (uma continuação ou um roteiro).
 */
export const CouncilCatalogSchema = z.array(CouncilCardSchema).superRefine((cards, context) => {
  const ids = cards.map((card) => card.id);
  ids.forEach((id, index) => {
    if (ids.indexOf(id) !== index) {
      context.addIssue({ code: 'custom', message: `carta repetida: ${id}`, path: [index, 'id'] });
    }
  });
  const everyEffect = cards.flatMap((card) =>
    card.options.flatMap((option) => [...option.effects, ...(option.hidden?.effects ?? [])]),
  );
  const written = new Set(
    everyEffect.flatMap((effect) => (effect.type === 'setFlag' ? [effect.flag] : [])),
  );
  const scheduled = new Set(
    everyEffect.flatMap((effect) => (effect.type === 'scheduleCard' ? [effect.cardId] : [])),
  );
  cards.forEach((card, index) => {
    const read = [
      ...(card.requires?.flags ?? []),
      ...(card.requires?.notFlags ?? []),
      ...(card.variants ?? []).map((variant) => variant.flag),
      ...card.options.flatMap((option) =>
        [...option.effects, ...(option.hidden?.effects ?? [])].flatMap((effect) =>
          effect.type === 'clearFlag' ? [effect.flag] : [],
        ),
      ),
    ];
    for (const name of read) {
      if (!written.has(name)) {
        context.addIssue({
          code: 'custom',
          message: `flag que ninguém grava: ${name}`,
          path: [index],
        });
      }
    }
    for (const option of card.options) {
      for (const effect of [...option.effects, ...(option.hidden?.effects ?? [])]) {
        if (effect.type === 'scheduleCard' && !ids.includes(effect.cardId)) {
          context.addIssue({
            code: 'custom',
            message: `continuação para uma carta que não existe: ${effect.cardId}`,
            path: [index, 'options'],
          });
        }
      }
    }
    if (card.weight === 0 && card.scripted === undefined && !scheduled.has(card.id)) {
      context.addIssue({
        code: 'custom',
        message: `carta sem peso e sem quem a agende: ${card.id}`,
        path: [index, 'weight'],
      });
    }
  });
});

export { COUNCIL_EFFECT_TYPES, EVENT_TYPES, OBJECTIVE_CONDITION_TYPES };
