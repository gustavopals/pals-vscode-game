import {
  BUILDING_IDS,
  LINE_IDS,
  MARKET_RESOURCE_IDS,
  PRODUCTION_BUILDING_IDS,
  TRADE_DIRECTION_IDS,
  UNIT_IDS,
  WING_IDS,
} from '@lotg/content';
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

export const SetVigilHourCommandSchema = command(
  'setVigilHour',
  z.strictObject({
    hourLocal: z.number().int(),
    timezone: z.string().min(1).max(64).refine(isStorableText, UNSTORABLE),
  }),
);

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

/**
 * Uma negociação no Mercado: comprar ou vender um recurso por ouro. `quoteDay` é o dia da
 * cotação que a visão mostrava (`market.quoteDay`): se o dia de jogo virou desde então, o motor
 * recusa a ordem e a resposta traz a visão com o preço de hoje. O protocolo só confere a forma:
 * um dos recursos que o Mercado negocia, um dos dois sentidos e dois inteiros de tamanho
 * razoável. Se a quantidade vale, se cabe no volume do dia, no cofre e no depósito é com o motor.
 */
export const TradeCommandSchema = command(
  'trade',
  z.strictObject({
    resource: z.enum(MARKET_RESOURCE_IDS),
    direction: z.enum(TRADE_DIRECTION_IDS),
    amount: z.number().int().min(-1_000_000).max(1_000_000),
    quoteDay: z.number().int().min(0).max(100_000_000),
  }),
);

/**
 * O envio de uma caravana: um recurso, uma quantidade e quem a escolta (`null` para mandá-la sem
 * escolta). O preço por unidade é o que a visão mostrava em `market.caravanOffer.resources[]`,
 * e fica fixado nesta ordem. `quoteDay` é o `market.quoteDay` da visão que o jogador conferiu:
 * se o dia de jogo virou, a ordem é recusada (`PRICE_CHANGED`). O protocolo só confere a forma; se há lugar na estrada, se a carga
 * cabe e existe, e se o herói pode ir é com o motor.
 */
export const SendCaravanCommandSchema = command(
  'sendCaravan',
  z.strictObject({
    resource: z.enum(MARKET_RESOURCE_IDS),
    amount: z.number().int().min(-1_000_000).max(1_000_000),
    escortHeroId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE).nullable(),
    quoteDay: z.number().int().min(0).max(100_000_000),
  }),
);

/**
 * A alocação de um Mestre: o identificador que a visão mostra (`masters[].id`) e o edifício
 * produtivo em que ele passa a trabalhar, ou `null` para deixá-lo sem edifício. O protocolo só
 * confere a forma; se o Mestre está no feudo e se o edifício o aceita é com o motor.
 */
export const AssignMasterCommandSchema = command(
  'assignMaster',
  z.strictObject({
    masterId: z.string().min(1).max(60).refine(isStorableText, UNSTORABLE),
    building: z.enum(PRODUCTION_BUILDING_IDS).nullable(),
  }),
);

/**
 * A ordem de forjar um lote de armas (V4B-T2; ADR 0019, decisão 4). O protocolo só confere a
 * forma; o lote máximo, o Ferreiro e o material são com o motor.
 */
export const ForgeWeaponsCommandSchema = command(
  'forgeWeapons',
  z.strictObject({ amount: z.number().int().min(-1_000_000).max(1_000_000) }),
);

/** A ordem de cancelar o lote na forja: devolve 80% do custo. Sem corpo. */
export const CancelForgeCommandSchema = command('cancelForge', z.strictObject({}));

/**
 * A ordem de mandar reparar um item do arsenal (V4B-T3; ADR 0019, decisão 5). O protocolo só
 * confere a forma; o Ferreiro, a forja livre e o ferro são com o motor.
 */
export const RepairItemCommandSchema = command(
  'repairItem',
  z.strictObject({ itemId: z.string().min(1).max(64) }),
);

/**
 * As ordens do Quartel (V4C-T1; ADR 0019, decisão 7). O protocolo só confere a forma; a unidade,
 * o lote máximo, o limite do exército e o material são com o motor.
 */
export const TrainSoldiersCommandSchema = command(
  'trainSoldiers',
  z.strictObject({
    unit: z.enum(UNIT_IDS),
    amount: z.number().int().min(-1_000_000).max(1_000_000),
  }),
);
export const CancelTrainingCommandSchema = command(
  'cancelTraining',
  z.strictObject({ lotKey: z.string().min(1).max(120) }),
);
export const DisbandSoldiersCommandSchema = command(
  'disbandSoldiers',
  z.strictObject({
    unit: z.enum(UNIT_IDS),
    amount: z.number().int().min(-1_000_000).max(1_000_000),
  }),
);

/**
 * As ordens das formações salvas (V4C-T2; ADR 0019, decisões 8 e 9). O protocolo confere a
 * forma (as três alas, as duas linhas, um posto `null` ou `{ unit, count }`); a linha da
 * unidade, o teto do posto, o comandante e o nome são com o motor.
 */
const formationPost = z
  .strictObject({ unit: z.enum(UNIT_IDS), count: z.number().int().min(-1_000_000).max(1_000_000) })
  .nullable();
const formationWing = z.strictObject(
  Object.fromEntries(LINE_IDS.map((line) => [line, formationPost])) as Record<
    (typeof LINE_IDS)[number],
    typeof formationPost
  >,
);
export const SaveFormationCommandSchema = command(
  'saveFormation',
  z.strictObject({
    id: z.string().min(1).max(64).nullable(),
    name: z.string().max(200),
    posts: z.strictObject(
      Object.fromEntries(WING_IDS.map((wing) => [wing, formationWing])) as Record<
        (typeof WING_IDS)[number],
        typeof formationWing
      >,
    ),
    commanders: z.strictObject(
      Object.fromEntries(
        WING_IDS.map((wing) => [wing, z.string().min(1).max(64).nullable()]),
      ) as Record<(typeof WING_IDS)[number], z.ZodNullable<z.ZodString>>,
    ),
  }),
);
export const DeleteFormationCommandSchema = command(
  'deleteFormation',
  z.strictObject({ id: z.string().min(1).max(64) }),
);
export const SetActiveFormationCommandSchema = command(
  'setActiveFormation',
  z.strictObject({ id: z.string().min(1).max(64).nullable() }),
);
const siegeWaveNumber = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const SimulateBattleCommandSchema = command(
  'simulateBattle',
  z.strictObject({
    formationId: z.string().min(1).max(64),
    siegeWave: siegeWaveNumber.optional(),
  }),
);

export const AttackCampCommandSchema = command(
  'attackCamp',
  z.strictObject({ formationId: z.string().min(1).max(64) }),
);

/** Repara a muralha (V4E-T1): o reparo entra na frente das obras e termina junto delas. */
export const RepairWallCommandSchema = command('repairWall', z.strictObject({}));

/** Plano por onda; `null` usa a Defesa ativa. A disponibilidade é validada pelo motor. */
export const SetBattlePlanCommandSchema = command(
  'setBattlePlan',
  z.strictObject({
    wave: siegeWaveNumber,
    formationId: z.string().min(1).max(64).refine(isStorableText, UNSTORABLE).nullable(),
  }),
);

/**
 * Troca a formação da próxima onda enquanto a decisão está aberta. `wave` é a onda da
 * decisão que o jogador viu: se ela já foi lutada quando a ordem chega, o motor recusa.
 */
export const SwapWaveFormationCommandSchema = command(
  'swapWaveFormation',
  z.strictObject({
    wave: siegeWaveNumber,
    formationId: z.string().min(1).max(64).refine(isStorableText, UNSTORABLE).nullable(),
  }),
);

/** Reparo imediato antes da onda `wave` (a da decisão vista); custo e prazo, pelo motor. */
export const EmergencyRepairCommandSchema = command(
  'emergencyRepair',
  z.strictObject({ wave: siegeWaveNumber }),
);

export const CallMilitiaCommandSchema = command(
  'callMilitia',
  z.strictObject({ count: z.number().int().min(-1_000_000).max(1_000_000) }),
);

/** Corpo de `POST /v1/games/:id/commands`. O `commandId` é a chave de idempotência. */
export const PlaceRelicCommandSchema = command(
  'placeRelic',
  z.strictObject({ relicId: z.string().min(1).max(80) }),
);
export const RemoveRelicCommandSchema = command(
  'removeRelic',
  z.strictObject({ relicId: z.string().min(1).max(80) }),
);

export const TakeVowsCommandSchema = command(
  'takeVows',
  z.strictObject({ vows: z.array(z.string().min(1).max(80)) }),
);

export const ClaimOutpostCommandSchema = command(
  'claimOutpost',
  z.strictObject({
    hex: z
      .string()
      .max(64)
      .regex(/^-?\d+,-?\d+$/),
  }),
);

export const RepairOutpostCommandSchema = command(
  'repairOutpost',
  z.strictObject({
    outpostId: z.string().min(1).max(64).refine(isStorableText, UNSTORABLE),
  }),
);

export const CommandSchema = z.discriminatedUnion('type', [
  ClaimOutpostCommandSchema,
  RepairOutpostCommandSchema,
  TakeVowsCommandSchema,
  PlaceRelicCommandSchema,
  RemoveRelicCommandSchema,
  SetVigilHourCommandSchema,
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
  TradeCommandSchema,
  SendCaravanCommandSchema,
  AssignMasterCommandSchema,
  ForgeWeaponsCommandSchema,
  CancelForgeCommandSchema,
  RepairItemCommandSchema,
  TrainSoldiersCommandSchema,
  CancelTrainingCommandSchema,
  DisbandSoldiersCommandSchema,
  SaveFormationCommandSchema,
  DeleteFormationCommandSchema,
  SetActiveFormationCommandSchema,
  SimulateBattleCommandSchema,
  AttackCampCommandSchema,
  RepairWallCommandSchema,
  SetBattlePlanCommandSchema,
  SwapWaveFormationCommandSchema,
  EmergencyRepairCommandSchema,
  CallMilitiaCommandSchema,
]);
export type Command = z.infer<typeof CommandSchema>;
export type CommandType = Command['type'];
