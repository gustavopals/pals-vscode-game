import type {
  BuildingId,
  DifficultyId,
  GameEventType,
  ProductionBuildingId,
  ResourceId,
  SeasonId,
} from '@lotg/content';

export type { BuildingId, DifficultyId, GameEventType, ProductionBuildingId, ResourceId, SeasonId };

/** Escolhas feitas na criação da partida. Dificuldade e ritmo não mudam durante o ano. */
export type GameSettings = {
  settlementName: string;
  timezone: string;
  vigilHourLocal: number;
  difficulty: DifficultyId;
  /**
   * Ritmo: horas de jogo por hora real (GDD §4.2). O motor roda em tempo de jogo; o ritmo só
   * converte prazos de tempo real no instante em que nascem e os prazos e taxas da visão.
   */
  timeScale: number;
};

export type Construction = {
  building: BuildingId;
  targetLevel: number;
  startedAtMs: number;
  finishesAtMs: number;
};

export type PlannedConstruction = { building: BuildingId; targetLevel: number };

/**
 * Estado do jogo: subconjunto do GDD §14.11. Tudo é JSON puro e inteiro (menos o ritmo, em
 * `settings`). Recursos ficam em milésimos; `accumulators` guarda o resto da produção contínua
 * (em milésimos × ms), que ainda não completou um milésimo.
 *
 * Mudar a forma deste tipo é subir `schemaVersion` e escrever um passo em `migrations/`: há
 * estados gravados em produção, e eles só chegam aqui por `migrateState`.
 */
export type GameState = {
  schemaVersion: 2;
  seed: string;
  settings: GameSettings;
  /**
   * Fronteira da atualização: instante de jogo até onde o estado foi simulado por uma versão
   * anterior das regras. `null` em partidas que já nasceram nesta versão. Regras novas contam
   * a partir daqui e nunca recalculam o que veio antes (ADR 0013, decisão 4).
   */
  migratedAtMs: number | null;
  clock: { gameTimeMs: number; yearStartMs: number; year: number };
  /** Tempo de jogo, em ms, até onde o estado já foi simulado. */
  lastProcessedAt: number;
  /**
   * Estado dos fluxos de sorteio, por nome: quatro inteiros de 32 bits cada (`random.ts`). Um
   * fluxo só aparece aqui depois do primeiro sorteio nele. Nunca sai no `ViewState`.
   */
  rng: Record<string, number[]>;
  settlement: {
    name: string;
    resources: Record<ResourceId, number>;
    accumulators: Record<ResourceId, number>;
    population: { villagers: number };
    workers: Record<ProductionBuildingId, number>;
    buildings: Record<BuildingId, number>;
    /** Uma posição por fila de obra; `null` é fila livre. A v0.1 tem uma fila. */
    constructionQueues: Array<Construction | null>;
    planned: PlannedConstruction[];
    /** Um item por aldeão em treinamento, em ordem de conclusão. */
    recruitmentQueue: Array<{ finishesAtMs: number }>;
    famine: { sinceMs: number } | null;
  };
  objectives: { active: string[]; completed: string[] };
  stats: Record<string, number>;
};

export type GameEvent = {
  type: GameEventType;
  /** Instante do evento em tempo de jogo. */
  atMs: number;
  /** Frase da Crônica, já pronta em pt-BR. */
  text: string;
  data: Record<string, string | number>;
};

export type Command =
  | {
      commandId: string;
      type: 'setWorkers';
      payload: { building: ProductionBuildingId; count: number };
    }
  | { commandId: string; type: 'startConstruction'; payload: { building: BuildingId } }
  | { commandId: string; type: 'cancelConstruction'; payload: { building: BuildingId } }
  | { commandId: string; type: 'planConstruction'; payload: { building: BuildingId } }
  | { commandId: string; type: 'unplanConstruction'; payload: { building: BuildingId } }
  | { commandId: string; type: 'recruitVillagers'; payload: { quantity: number } }
  | { commandId: string; type: 'renameSettlement'; payload: { name: string } };

export type CommandType = Command['type'];

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
export type RejectionCode = (typeof REJECTION_CODES)[number];

export type Rejection = { code: RejectionCode; message: string };

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: RejectionCode; message: string };

export type ResourceCostView = {
  resource: ResourceId;
  label: string;
  amount: number;
  /** Quanto falta no estoque para pagar; 0 quando há o bastante. */
  missing: number;
};

export type UpgradeView = {
  building: BuildingId;
  label: string;
  fromLevel: number;
  targetLevel: number;
  cost: ResourceCostView[];
  durationSeconds: number;
  affordable: boolean;
  /** Código e motivo pelo qual a obra não pode começar agora; `null` quando pode. */
  blockedCode: RejectionCode | null;
  blockedReason: string | null;
  planned: boolean;
};

export type ObjectiveView = {
  id: string;
  title: string;
  hint: string;
  reward: string;
  status: 'active' | 'completed';
  progress: { current: number; target: number };
};

/** Tudo que a interface exibe, já calculado. A UI só formata números (GDD §14.5). */
export type ViewState = {
  settlement: { name: string; townHallLevel: number };
  calendar: {
    year: number;
    season: SeasonId;
    seasonLabel: string;
    dayOfSeason: number;
    dayOfYear: number;
    secondsToNextDay: number;
    secondsToNextSeason: number;
  };
  population: {
    villagers: number;
    capacity: number;
    free: number;
    inTraining: number;
    /** Lugares ocupados nas habitações: quem já mora e quem está a caminho. */
    housed: number;
    /** Lugares livres nas habitações. */
    vacancies: number;
    /** Segundos até o próximo aldeão chegar; `null` sem fila ou com a fila congelada pela fome. */
    secondsToNextRecruit: number | null;
    breakdown: string;
  };
  resources: Array<{
    id: ResourceId;
    label: string;
    /** Estoque em unidades inteiras. */
    stock: number;
    cap: number | null;
    /** Saldo líquido por hora, com uma casa decimal. */
    perHour: number;
    /** Segundos até o estoque acabar; `null` quando não está caindo. */
    depletesInSeconds: number | null;
    breakdown: string;
  }>;
  workers: Array<{
    building: ProductionBuildingId;
    label: string;
    level: number;
    resource: ResourceId;
    assigned: number;
    grossPerHour: number;
    /** Quanto cada trabalhador produz por hora neste edifício agora, já com nível e fome. */
    perWorkerPerHour: number;
    breakdown: string;
  }>;
  constructions: {
    active: null | {
      building: BuildingId;
      label: string;
      targetLevel: number;
      secondsRemaining: number;
      totalSeconds: number;
      progressPercent: number;
      /** O que volta ao estoque se a obra for cancelada agora, em unidades. */
      refund: Array<{ resource: ResourceId; label: string; amount: number }>;
    };
    planned: UpgradeView[];
    available: UpgradeView[];
  };
  recruitment: {
    cost: ResourceCostView[];
    secondsPerVillager: number;
    /** Quantos aldeões cabem em uma nova ordem agora. */
    maxQuantity: number;
    blockedReason: string | null;
  };
  famine: null | { sinceMs: number; secondsElapsed: number; text: string };
  objectives: ObjectiveView[];
  /** Vazio na v0.1: cartas e encruzilhadas chegam nas versões seguintes. */
  pendingDecisions: never[];
};
