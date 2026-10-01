import {
  BUILDING_IDS,
  EVENT_TYPES,
  PRODUCTION_BUILDING_IDS,
  RESOURCE_IDS,
  SEASON_IDS,
} from '@lotg/content';
import { z } from 'zod';

const resourceId = z.enum(RESOURCE_IDS);
const buildingId = z.enum(BUILDING_IDS);

/** Códigos de recusa do motor. Um teste de tipo garante que a lista é a mesma de `@lotg/engine`. */
export const REJECTION_CODES = [
  'UNKNOWN_COMMAND',
  'INVALID_BUILDING',
  'INVALID_WORKERS',
  'NOT_ENOUGH_VILLAGERS',
  'ALREADY_UPGRADING',
  'QUEUE_BUSY',
  'MAX_LEVEL',
  'GATE_LOCKED',
  'INSUFFICIENT_RESOURCES',
  'NOT_IN_CONSTRUCTION',
  'ALREADY_PLANNED',
  'NOT_PLANNED',
  'INVALID_QUANTITY',
  'FAMINE',
  'RECRUIT_QUEUE_FULL',
  'HOUSING_FULL',
  'INVALID_NAME',
] as const;
export const RejectionCodeSchema = z.enum(REJECTION_CODES);
export type RejectionCode = z.infer<typeof RejectionCodeSchema>;

const ResourceCostSchema = z.strictObject({
  resource: resourceId,
  label: z.string(),
  amount: z.number(),
  missing: z.number(),
});

const UpgradeSchema = z.strictObject({
  building: buildingId,
  label: z.string(),
  fromLevel: z.number(),
  targetLevel: z.number(),
  cost: z.array(ResourceCostSchema),
  durationSeconds: z.number(),
  affordable: z.boolean(),
  blockedCode: RejectionCodeSchema.nullable(),
  blockedReason: z.string().nullable(),
  planned: z.boolean(),
});

const ObjectiveSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  hint: z.string(),
  reward: z.string(),
  status: z.enum(['active', 'completed']),
  progress: z.strictObject({ current: z.number(), target: z.number() }),
});

/** Tudo que a interface exibe. O cliente recebe isto pronto e não calcula regras (GDD §14.5). */
export const ViewStateSchema = z.strictObject({
  settlement: z.strictObject({ name: z.string(), townHallLevel: z.number() }),
  calendar: z.strictObject({
    year: z.number(),
    season: z.enum(SEASON_IDS),
    seasonLabel: z.string(),
    dayOfSeason: z.number(),
    dayOfYear: z.number(),
    secondsToNextDay: z.number(),
    secondsToNextSeason: z.number(),
  }),
  population: z.strictObject({
    villagers: z.number(),
    capacity: z.number(),
    free: z.number(),
    inTraining: z.number(),
    housed: z.number(),
    vacancies: z.number(),
    secondsToNextRecruit: z.number().nullable(),
    breakdown: z.string(),
  }),
  resources: z.array(
    z.strictObject({
      id: resourceId,
      label: z.string(),
      stock: z.number(),
      cap: z.number().nullable(),
      perHour: z.number(),
      depletesInSeconds: z.number().nullable(),
      breakdown: z.string(),
    }),
  ),
  workers: z.array(
    z.strictObject({
      building: z.enum(PRODUCTION_BUILDING_IDS),
      label: z.string(),
      level: z.number(),
      resource: resourceId,
      assigned: z.number(),
      grossPerHour: z.number(),
      perWorkerPerHour: z.number(),
      breakdown: z.string(),
    }),
  ),
  constructions: z.strictObject({
    active: z
      .strictObject({
        building: buildingId,
        label: z.string(),
        targetLevel: z.number(),
        secondsRemaining: z.number(),
        totalSeconds: z.number(),
        progressPercent: z.number(),
        refund: z.array(
          z.strictObject({ resource: resourceId, label: z.string(), amount: z.number() }),
        ),
      })
      .nullable(),
    planned: z.array(UpgradeSchema),
    available: z.array(UpgradeSchema),
  }),
  recruitment: z.strictObject({
    cost: z.array(ResourceCostSchema),
    secondsPerVillager: z.number(),
    maxQuantity: z.number(),
    blockedReason: z.string().nullable(),
  }),
  famine: z
    .strictObject({ sinceMs: z.number(), secondsElapsed: z.number(), text: z.string() })
    .nullable(),
  objectives: z.array(ObjectiveSchema),
  pendingDecisions: z.array(z.never()),
});
export type ViewState = z.infer<typeof ViewStateSchema>;

/** Evento de jogo como a API o entrega: com a sequência na partida e o instante real (UTC). */
export const GameEventSchema = z.strictObject({
  seq: z.number().int().positive(),
  type: z.enum(EVENT_TYPES),
  /** Instante real do evento, ISO 8601 em UTC. */
  at: z.iso.datetime(),
  /** Instante do evento em tempo de jogo. */
  atMs: z.number().int().nonnegative(),
  /** Frase da Crônica, pronta em pt-BR. */
  text: z.string(),
  data: z.record(z.string(), z.union([z.string(), z.number()])),
});
export type GameEvent = z.infer<typeof GameEventSchema>;
