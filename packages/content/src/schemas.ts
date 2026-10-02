import { z } from 'zod';

import { CHRONICLE_PLACEHOLDERS, EVENT_TYPES, foundingTemplates } from './chronicle';
import { BUILDING_IDS, PRODUCTION_BUILDING_IDS, RESOURCE_IDS, SEASON_IDS } from './ids';
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
    queues: positiveInt,
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
]);

export const ObjectiveSchema = z
  .strictObject({
    id: z.string().regex(/^[a-z][A-Za-z0-9]*$/),
    title: label,
    hint: label,
    condition: ObjectiveConditionSchema,
    reward: z.partialRecord(resourceId, positiveInt),
    // Entra depois de "Recompensa:" e ao lado de "+20 ouro": minúscula, sem ponto final.
    rewardText: label.regex(/^\p{Ll}.*[^.]$/u).optional(),
  })
  .refine(
    (objective) => Object.keys(objective.reward).length > 0 || objective.rewardText !== undefined,
    'objetivo sem recompensa',
  );

export const ObjectivesSchema = z.array(ObjectiveSchema).min(1);

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

export { EVENT_TYPES, OBJECTIVE_CONDITION_TYPES };
