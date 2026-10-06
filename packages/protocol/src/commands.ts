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

/**
 * A dispensa de um herói. `heroId` é o identificador que a visão mostrava (`guild.heroes[].id`).
 * O protocolo só confere que é um texto de tamanho razoável; se o herói ainda serve ao feudo é
 * com o motor.
 */
export const DismissHeroCommandSchema = command(
  'dismissHero',
  z.strictObject({ heroId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE) }),
);

/**
 * A contratação de um candidato da Taverna. `offerId` é o identificador que a visão mostrava
 * (`tavern.offers[].offerId`). O protocolo só confere que é um texto de tamanho razoável; se a
 * oferta ainda está na lista, se há lugar e se há ouro é com o motor.
 */
export const HireHeroCommandSchema = command(
  'hireHero',
  z.strictObject({ offerId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE) }),
);

/** O festival da Taverna: a ordem não leva nada. Um por estação, e quem confere é o motor. */
export const HoldFestivalCommandSchema = command('holdFestival', z.strictObject({}));

const POSTURE_IDS = ['cautious', 'balanced', 'bold'] as const;

/**
 * O envio de uma expedição. `modelId` é o destino que a visão mostrava
 * (`guild.available[].modelId`), `heroIds`, a equipe (`guild.heroes[].id`), e `posture`, quem
 * decide na encruzilhada se o senhor não responder. O protocolo só confere a forma: textos de
 * tamanho razoável, uma lista curta sem conferir quem está nela, e uma das três Posturas. Se o
 * destino existe, se há lugar na Guilda e se a equipe serve é com o motor.
 */
export const SendExpeditionCommandSchema = command(
  'sendExpedition',
  z.strictObject({
    modelId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
    heroIds: z.array(z.string().min(1).max(60).refine(isStorableText, UNSTORABLE)).max(12),
    posture: z.enum(POSTURE_IDS),
  }),
);

/**
 * A escolha do caminho em uma encruzilhada. `expeditionId` e `optionId` são os que a visão
 * mostrava (`guild.expeditions[].id` e `crossroads.options[].id`). Se a equipe ainda espera e
 * se pode tomar o caminho é com o motor.
 */
export const ChooseExpeditionPathCommandSchema = command(
  'chooseExpeditionPath',
  z.strictObject({
    expeditionId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
    optionId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
  }),
);

/** Os espaços de equipamento (`ITEM_SLOT_IDS`, em `@lotg/content`): o teste confere que coincidem. */
const ITEM_SLOT_IDS = ['weapon', 'armor', 'accessory'] as const;

/**
 * Equipar um herói com um item do arsenal. `heroId` e `itemId` são os que a visão mostrava
 * (`guild.heroes[].id` e `guild.inventory[].id`). O espaço é o do item: a ordem não o escolhe.
 */
export const EquipItemCommandSchema = command(
  'equipItem',
  z.strictObject({
    heroId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
    itemId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
  }),
);

/**
 * Devolver ao arsenal o que um herói leva em um espaço. `slot` é um dos três espaços
 * (`guild.heroes[].equipment[].slot`); se há algo nele é com o motor.
 */
export const UnequipItemCommandSchema = command(
  'unequipItem',
  z.strictObject({
    heroId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
    slot: z.enum(ITEM_SLOT_IDS),
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
  DismissHeroCommandSchema,
  HireHeroCommandSchema,
  HoldFestivalCommandSchema,
  SendExpeditionCommandSchema,
  ChooseExpeditionPathCommandSchema,
  EquipItemCommandSchema,
  UnequipItemCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];
