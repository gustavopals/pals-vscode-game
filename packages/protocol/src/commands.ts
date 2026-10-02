import { BUILDING_IDS, PRODUCTION_BUILDING_IDS } from '@lotg/content';
import { z } from 'zod';

import { isStorableText, UNSTORABLE } from './text';

const commandId = z.uuid();
const building = z.enum(BUILDING_IDS);
/**
 * O nível que a tela mostrava quando a ordem foi dada. Opcional: quem não manda aceita a obra
 * que for a da vez. Com ele, duas abas com a visão velha não planejam (nem pagam) um nível que
 * ninguém pediu: o motor recusa a ordem que ficou para trás.
 */
const targetLevel = z.number().int().min(1).max(1_000).optional();

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
  // `autoStart` marca a planejada como "iniciar quando houver recursos"; sem ele, é manual.
  z.strictObject({ building, autoStart: z.boolean().optional(), targetLevel }),
);
export const UnplanConstructionCommandSchema = command(
  'unplanConstruction',
  z.strictObject({ building }),
);
export const SetAutoStartCommandSchema = command(
  'setAutoStart',
  z.strictObject({ building, autoStart: z.boolean(), targetLevel }),
);
export const RecruitVillagersCommandSchema = command(
  'recruitVillagers',
  z.strictObject({ quantity: z.number().int().min(-1_000_000).max(1_000_000) }),
);
export const RenameSettlementCommandSchema = command(
  'renameSettlement',
  z.strictObject({ name: z.string().max(200).refine(isStorableText, UNSTORABLE) }),
);

/**
 * A resposta a uma carta do Conselho. `instanceId` é a ocorrência que a tela mostrava
 * (`council.pending[].instanceId`) e `optionId`, a opção escolhida. O protocolo só confere que
 * são textos de tamanho razoável; se a carta ainda está na mesa e se a opção existe é com o motor.
 */
export const AnswerCardCommandSchema = command(
  'answerCard',
  z.strictObject({
    instanceId: z.string().min(1).max(120).refine(isStorableText, UNSTORABLE),
    optionId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
  }),
);

/** Corpo de `POST /v1/games/:id/commands`. O `commandId` é a chave de idempotência. */
export const CommandSchema = z.discriminatedUnion('type', [
  SetWorkersCommandSchema,
  StartConstructionCommandSchema,
  CancelConstructionCommandSchema,
  PlanConstructionCommandSchema,
  UnplanConstructionCommandSchema,
  SetAutoStartCommandSchema,
  RecruitVillagersCommandSchema,
  RenameSettlementCommandSchema,
  AnswerCardCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];
