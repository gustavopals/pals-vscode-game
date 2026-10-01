import { BUILDING_IDS, PRODUCTION_BUILDING_IDS } from '@lotg/content';
import { z } from 'zod';

import { isStorableText, UNSTORABLE } from './text';

const commandId = z.uuid();
const building = z.enum(BUILDING_IDS);

// O protocolo só valida a forma. Faixas e regras (quantos aldeões, quais níveis) são do motor,
// que recusa com um motivo legível em português (GDD §14.12).
const command = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.strictObject({ commandId, type: z.literal(type), payload });

export const SetWorkersCommandSchema = command(
  'setWorkers',
  z.strictObject({
    building: z.enum(PRODUCTION_BUILDING_IDS),
    count: z.number().int().min(0).max(1_000_000),
  }),
);
export const StartConstructionCommandSchema = command(
  'startConstruction',
  z.strictObject({ building }),
);
export const CancelConstructionCommandSchema = command(
  'cancelConstruction',
  z.strictObject({ building }),
);
export const PlanConstructionCommandSchema = command(
  'planConstruction',
  z.strictObject({ building }),
);
export const UnplanConstructionCommandSchema = command(
  'unplanConstruction',
  z.strictObject({ building }),
);
export const RecruitVillagersCommandSchema = command(
  'recruitVillagers',
  z.strictObject({ quantity: z.number().int().min(-1_000_000).max(1_000_000) }),
);
export const RenameSettlementCommandSchema = command(
  'renameSettlement',
  z.strictObject({ name: z.string().max(200).refine(isStorableText, UNSTORABLE) }),
);

/** Corpo de `POST /v1/games/:id/commands`. O `commandId` é a chave de idempotência. */
export const CommandSchema = z.discriminatedUnion('type', [
  SetWorkersCommandSchema,
  StartConstructionCommandSchema,
  CancelConstructionCommandSchema,
  PlanConstructionCommandSchema,
  UnplanConstructionCommandSchema,
  RecruitVillagersCommandSchema,
  RenameSettlementCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];
