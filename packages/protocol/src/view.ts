import {
  BUILDING_IDS,
  DIFFICULTY_IDS,
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
  'QUEUE_LOCKED',
  'MAX_LEVEL',
  'GATE_LOCKED',
  'EXCEEDS_STORAGE',
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
  /** Por que o prazo não é o de tabela (fator da estação); `null` sem efeito. */
  durationNote: z.string().nullable(),
  affordable: z.boolean(),
  blockedCode: RejectionCodeSchema.nullable(),
  blockedReason: z.string().nullable(),
  planned: z.boolean(),
  /** O que a obra muda, ao lado do custo: "Capacidade de comida: 500 → 900."; `null` sem frase. */
  effect: z.string().nullable(),
});

/** Por que uma obra planejada ainda não começou, e em quanto tempo a espera acaba. */
const PlannedWaitingSchema = z.strictObject({
  /**
   * `upgrading`: o edifício tem outra obra antes desta. `gate`: falta o nível de outro edifício.
   * `capacity`: o custo não cabe no depósito. `resources`: falta recurso que a produção ainda
   * junta. `queue`: os pedreiros estão ocupados.
   */
  reason: z.enum(['queue', 'resources', 'capacity', 'gate', 'upgrading']),
  /** "espera 120 de madeira"; "não cabe no Armazém: amplie-o". Minúscula, sem ponto final. */
  text: z.string(),
  /** Segundos reais até a espera acabar, com as taxas de agora; `null` quando esperar não resolve. */
  etaSeconds: z.number().nullable(),
});

/** Uma obra planejada: o orçamento, se é automática e o que ela espera. */
const PlannedUpgradeSchema = UpgradeSchema.extend({
  /** Marcada "iniciar quando houver recursos": o motor a inicia sozinho assim que puder. */
  autoStart: z.boolean(),
  /** O que a obra espera para começar; `null` quando já pode ser iniciada (só nas manuais). */
  waiting: PlannedWaitingSchema.nullable(),
});

/** Uma obra em curso em uma das filas. */
const ActiveConstructionSchema = z.strictObject({
  building: buildingId,
  label: z.string(),
  targetLevel: z.number(),
  secondsRemaining: z.number(),
  totalSeconds: z.number(),
  progressPercent: z.number(),
  /** `amount` volta ao estoque; `lost` não cabe no depósito e se perde. */
  refund: z.array(
    z.strictObject({
      resource: resourceId,
      label: z.string(),
      amount: z.number(),
      lost: z.number(),
    }),
  ),
});

const ObjectiveSchema = z.strictObject({
  id: z.string(),
  title: z.string(),
  hint: z.string(),
  reward: z.string(),
  status: z.enum(['active', 'completed']),
  progress: z.strictObject({ current: z.number(), target: z.number() }),
});

/**
 * A conta da lenha, em unidades, com os habitantes e os trabalhadores de agora: o que a lareira
 * queima, o que a Serraria entrega no mesmo prazo e quanto falta guardar.
 */
const FirewoodSchema = z.strictObject({
  /** Madeira queimada por hora real. */
  perHour: z.number(),
  winterTotal: z.number(),
  winterProduction: z.number(),
  stock: z.number(),
  /** Quanto falta guardar; 0 quando o estoque e a Serraria cobrem. */
  missing: z.number(),
  text: z.string(),
});

/** Tudo que a interface exibe. O cliente recebe isto pronto e não calcula regras (GDD §14.5). */
export const ViewStateSchema = z.strictObject({
  settlement: z.strictObject({
    name: z.string(),
    townHallLevel: z.number(),
    /** Escolhida na criação da partida; não muda durante o ano. */
    difficulty: z.enum(DIFFICULTY_IDS),
    difficultyLabel: z.string(),
    /** O ritmo da partida, pronto para exibir: "Rápido: um ano em 56 horas". */
    paceLabel: z.string(),
  }),
  calendar: z.strictObject({
    year: z.number(),
    season: z.enum(SEASON_IDS),
    seasonLabel: z.string(),
    dayOfSeason: z.number(),
    dayOfYear: z.number(),
    secondsToNextDay: z.number(),
    secondsToNextSeason: z.number(),
    /** O que a estação atual muda, em uma frase. */
    seasonEffects: z.string(),
    nextSeason: z.strictObject({
      id: z.enum(SEASON_IDS),
      label: z.string(),
      secondsUntil: z.number(),
      /** Uma frase para cada coisa que muda na virada. */
      changes: z.array(z.string()),
      /** A previsão da lenha, quando a próxima estação queima madeira. */
      firewood: FirewoodSchema.nullable(),
    }),
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
      /** Limite do estoque, em unidades; `null` para o que não tem limite (o ouro). */
      cap: z.number().nullable(),
      /** De onde vem o limite: "500 iniciais", "Celeiro Nv2: 1.500 × 0,8 (Rei de Ferro) = 1.200". */
      capBreakdown: z.string().nullable(),
      /** O edifício que amplia o limite deste recurso; `null` sem limite. */
      storageBuilding: buildingId.nullable(),
      /** Onde o recurso fica hoje: "Celeiro", ou "Despensa" antes de ele existir. */
      storageLabel: z.string().nullable(),
      /** O estoque está no limite, ou acima dele (partida que veio de antes dos limites). */
      full: z.boolean(),
      /**
       * Segundos reais até encher; `null` quando não está subindo, quando já está cheio e
       * quando o enchimento cai depois de algo que muda a taxa (`fullNote` diz o quê).
       */
      fullInSeconds: z.number().nullable(),
      /**
       * Frase pronta sobre o limite: cheio, o que se perde por hora e o que fazer; enchendo só
       * depois de a taxa mudar, "Não enche antes da virada para o Outono."; `null` no resto.
       */
      fullNote: z.string().nullable(),
      /** Quanto deixa de entrar por hora real com o estoque cheio; 0 quando nada se perde. */
      wastingPerHour: z.number(),
      /** Unidades inteiras perdidas desde o último relato da Crônica (a virada do dia). */
      wastedToday: z.number(),
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
    /** Atalho para a primeira obra em curso, na ordem das filas; `null` sem nenhuma. */
    active: ActiveConstructionSchema.nullable(),
    /** Uma entrada por fila aberta, na ordem: a obra em curso, ou `null` se a fila está livre. */
    queues: z.array(ActiveConstructionSchema.nullable()),
    /** Quantas filas de obras o feudo tem abertas agora. */
    queuesUnlocked: z.number(),
    /** O que abre a próxima fila, em uma frase; `null` quando todas já estão abertas. */
    queuesNote: z.string().nullable(),
    /** As planejadas, na ordem da lista: é a ordem em que as automáticas são tentadas. */
    planned: z.array(PlannedUpgradeSchema),
    available: z.array(UpgradeSchema),
  }),
  recruitment: z.strictObject({
    cost: z.array(ResourceCostSchema),
    secondsPerVillager: z.number(),
    /** Por que o tempo de treinamento não é o de tabela (fator da estação); `null` sem efeito. */
    durationNote: z.string().nullable(),
    maxQuantity: z.number(),
    blockedReason: z.string().nullable(),
  }),
  famine: z
    .strictObject({ sinceMs: z.number(), secondsElapsed: z.number(), text: z.string() })
    .nullable(),
  /** A estação da lenha; `null` fora dela. `cold` é o frio, aberto quando a madeira acabou. */
  winter: z
    .strictObject({
      firewoodPerHour: z.number(),
      firewood: FirewoodSchema,
      cold: z.strictObject({ secondsElapsed: z.number(), text: z.string() }).nullable(),
    })
    .nullable(),
  objectives: z.array(ObjectiveSchema),
  pendingDecisions: z.array(z.never()),
});
export type ViewState = z.infer<typeof ViewStateSchema>;

/**
 * Eventos que existem, saem em `GET /events` e servem ao Relatório de Retorno, mas não são
 * linhas da Crônica: a virada de dia (ADR 0007) e o fecho diário do desperdício (ADR 0015). O
 * servidor os deixa fora de `GET /chronicle` e de `/chronicle.md`; o app, da Crônica recente.
 */
export const CHRONICLE_HIDDEN_EVENT_TYPES = [
  'dayStarted',
  'storageWasted',
] as const satisfies ReadonlyArray<(typeof EVENT_TYPES)[number]>;

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
