import type {
  BuildingId,
  DifficultyId,
  GameEventType,
  MoraleBandId,
  MoraleTermId,
  ProductionBuildingId,
  ResourceId,
  SeasonId,
} from '@lotg/content';

export type {
  BuildingId,
  DifficultyId,
  GameEventType,
  MoraleBandId,
  MoraleTermId,
  ProductionBuildingId,
  ResourceId,
  SeasonId,
};

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

/**
 * Uma obra planejada. Com `autoStart`, é uma planejada "iniciar quando houver recursos": o motor
 * a inicia sozinho no primeiro instante em que ela puder começar (GDD §6.3).
 */
export type PlannedConstruction = {
  building: BuildingId;
  targetLevel: number;
  autoStart: boolean;
};

/** Uma leva de trabalhadores que chegou junta a um edifício e ainda se adapta ao ofício. */
export type AdaptationCohort = {
  building: ProductionBuildingId;
  count: number;
  untilMs: number;
};

/**
 * Um efeito temporário sobre a moral (GDD §5.7): quanto soma ou tira, com que nome aparece na
 * explicação e até quando vale. Entra na conta de toda virada de dia até `untilMs`, inclusive.
 */
export type MoraleEffect = {
  /** Quem o criou: gravar de novo o mesmo `id` troca o efeito, não o soma. */
  id: string;
  /** Como o termo aparece na explicação: "carta: Tábuas para as reservas". */
  label: string;
  amount: number;
  untilMs: number;
};

/**
 * Estado do jogo: subconjunto do GDD §14.11. Tudo é JSON puro e inteiro (menos o ritmo, em
 * `settings`). Recursos ficam em milésimos; `accumulators` guarda o resto da produção contínua
 * (em milésimos × ms), que ainda não completou um milésimo.
 *
 * Mudar a forma deste tipo é subir `schemaVersion` e escrever um passo em `migrations/`: há
 * estados gravados em produção, e eles só chegam aqui por `migrateState`.
 */
export type GameState = {
  schemaVersion: 7;
  seed: string;
  settings: GameSettings;
  /**
   * Fronteira da atualização mais recente: instante de jogo em que a última migração encontrou
   * a partida, ou seja, até onde ela foi simulada por uma versão anterior das regras. `null` em
   * partidas que nasceram nesta versão. Cada passo de migração a regrava, e os prazos de uma
   * mecânica nova contam a partir da fronteira do passo que a trouxe; nenhuma regra recalcula o
   * que veio antes (ADR 0013, decisão 4).
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
    /** Nível de cada edifício; 0 é "ainda não construído" (o Celeiro e o Armazém nascem assim). */
    buildings: Record<BuildingId, number>;
    /**
     * Uma posição por fila de obra, sempre `balance.construction.queues` delas; `null` é fila
     * livre. A segunda só recebe obra depois que o Salão chega ao nível que a abre (GDD §6.3):
     * quantas estão abertas é derivado do nível do Salão, nunca guardado.
     */
    constructionQueues: Array<Construction | null>;
    /** As obras planejadas, na ordem em que o jogador as pôs: é a ordem do início automático. */
    planned: PlannedConstruction[];
    /** Um item por aldeão em treinamento, em ordem de conclusão. */
    recruitmentQueue: Array<{ finishesAtMs: number }>;
    famine: { sinceMs: number } | null;
    /**
     * O frio: aberto no instante em que a madeira acabou em uma estação que queima lenha
     * (GDD §4.1). Enquanto dura, a produção de todo o feudo cai e a madeira não fica negativa.
     */
    cold: { sinceMs: number } | null;
    /**
     * Desperdício que a Crônica ainda não contou, em milésimos: o que a produção e os ganhos
     * discretos deixaram de pôr no estoque porque ele estava no limite (GDD §5.5). A virada do
     * dia relata as unidades inteiras e deixa aqui o resto, para nada se perder na conta. O
     * total de sempre fica em `stats.wasted_<recurso>`, também em milésimos.
     */
    wasted: Record<ResourceId, number>;
    /**
     * Experiência do ofício de cada edifício produtivo, de 0 ao máximo do conteúdo (GDD §5.4):
     * contada na virada de cada dia de jogo, sobe com o edifício ocupado e cai com ele vazio.
     * Dela sai a mestria, um dos fatores da produção.
     */
    craftExperience: Record<ProductionBuildingId, number>;
    /**
     * O ano de jogo em que cada ofício chegou pela última vez à experiência máxima; 0 é
     * "nunca". Só serve para a Crônica dizer isso uma vez por ano.
     */
    craftMasteredYear: Record<ProductionBuildingId, number>;
    /**
     * Quem trocou de ofício e ainda se adapta, em coortes: quantos, em que edifício e até que
     * instante de jogo rendem só uma fração (GDD §5.4). Em ordem de término; o fim de cada uma
     * é um evento da linha do tempo. Quem não está em coorte nenhuma já é adaptado.
     */
    adaptation: AdaptationCohort[];
    /**
     * A moral do feudo, de 0 a 100 (GDD §5.7). Só muda na virada de cada dia de jogo, quando é
     * recalculada do zero com as condições daquele instante; entre uma virada e outra é o
     * número que entra na produção.
     */
    morale: number;
    /**
     * Efeitos temporários sobre a moral, na ordem em que foram gravados: cartas do Conselho,
     * incursões e objetivos escrevem aqui. Cada um entra como um termo na conta da virada do
     * dia enquanto não vence, e sai da lista na primeira virada em que já não conta.
     */
    moraleEffects: MoraleEffect[];
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
  | {
      commandId: string;
      type: 'planConstruction';
      /** `autoStart` marca a planejada como "iniciar quando houver recursos"; sem ele, manual. */
      payload: { building: BuildingId; autoStart?: boolean | undefined };
    }
  | { commandId: string; type: 'unplanConstruction'; payload: { building: BuildingId } }
  | {
      commandId: string;
      type: 'setAutoStart';
      payload: { building: BuildingId; autoStart: boolean };
    }
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
  /** Prazo se a obra começar agora, já com o fator da estação. */
  durationSeconds: number;
  /**
   * Por que o prazo não é o de tabela: "No Inverno, o prazo de uma obra iniciada agora é × 1,5."
   * `null` quando a estação não mexe nele.
   */
  durationNote: string | null;
  affordable: boolean;
  /** Código e motivo pelo qual a obra não pode começar agora; `null` quando pode. */
  blockedCode: RejectionCode | null;
  blockedReason: string | null;
  planned: boolean;
  /**
   * O que a obra muda, ao lado do que ela custa: "Capacidade de comida: 500 → 900." Hoje só os
   * edifícios de armazenamento trazem a frase; nos outros é `null`.
   */
  effect: string | null;
};

/**
 * Por que uma obra planejada ainda não começou, e quando a espera acaba. A frase vem pronta e
 * sem o prazo, que anda sozinho na tela: a interface mostra `text` e, quando há `etaSeconds`,
 * acrescenta ": em 2 h 10 min".
 */
export type PlannedWaitingView = {
  /**
   * `upgrading`: o edifício tem outra obra antes desta. `gate`: falta o nível de outro
   * edifício (quase sempre, o Salão). `capacity`: o custo não cabe no depósito. `resources`:
   * falta recurso que a produção ainda junta. `queue`: os pedreiros estão ocupados.
   */
  reason: 'queue' | 'resources' | 'capacity' | 'gate' | 'upgrading';
  /** "espera 120 de madeira"; "não cabe no Armazém: amplie-o". Minúscula, sem ponto final. */
  text: string;
  /**
   * Segundos reais até a espera acabar, com as taxas de agora; `null` quando esperar não
   * resolve (é preciso uma ordem do jogador) ou quando não há como prever.
   */
  etaSeconds: number | null;
};

type PlannedExtras = {
  /** Marcada "iniciar quando houver recursos": o motor a inicia sozinho assim que puder. */
  autoStart: boolean;
  /** O que a obra espera para começar; `null` quando já pode ser iniciada (só nas manuais). */
  waiting: PlannedWaitingView | null;
};

/**
 * Uma obra planejada, na ordem da lista: o orçamento dela, como o de qualquer obra, e mais se é
 * automática e o que ela espera. É um objeto só (e não uma interseção de dois), para ser o
 * mesmo tipo que o protocolo infere do schema.
 */
export type PlannedUpgradeView = {
  [Key in keyof (UpgradeView & PlannedExtras)]: (UpgradeView & PlannedExtras)[Key];
};

/** Uma obra em curso em uma das filas. */
export type ActiveConstructionView = {
  building: BuildingId;
  label: string;
  targetLevel: number;
  secondsRemaining: number;
  totalSeconds: number;
  progressPercent: number;
  /**
   * O que volta ao estoque se a obra for cancelada agora, em unidades: `amount` é o que
   * entra e `lost`, o que não cabe no depósito e se perde.
   */
  refund: Array<{ resource: ResourceId; label: string; amount: number; lost: number }>;
};

export type ObjectiveView = {
  id: string;
  title: string;
  hint: string;
  reward: string;
  status: 'active' | 'completed';
  progress: { current: number; target: number };
};

/**
 * A conta da lenha de uma estação que queima madeira (GDD §4.1), feita com os habitantes e os
 * trabalhadores de agora, em unidades inteiras. No outono é a previsão do inverno inteiro; no
 * inverno, do que falta até a primavera. É o que responde "quanta madeira preciso guardar?".
 */
export type FirewoodView = {
  /** Madeira queimada por hora real. */
  perHour: number;
  /** Madeira que a lareira queima no prazo da conta. */
  winterTotal: number;
  /** Madeira que a Serraria entrega no mesmo prazo. */
  winterProduction: number;
  /** Madeira em estoque agora. */
  stock: number;
  /** Quanto falta guardar para a lareira não apagar; 0 quando o estoque e a Serraria cobrem. */
  missing: number;
  /** A conta em uma frase, pronta para exibir. */
  text: string;
};

/** O que a moral vale: o número, a faixa e o fator que ela põe na produção. */
export type MoraleLevelView = {
  /** De 0 a 100. */
  value: number;
  band: MoraleBandId;
  /** "Inquieto". */
  bandLabel: string;
  /**
   * O fator da moral na produção, em centésimos: 109 é "produção × 1,09"; 75, "× 0,75". Tem
   * meia unidade com a moral ímpar (51 dá 100,5).
   */
  multiplierPercent: number;
};

/**
 * A moral do feudo (GDD §5.7). Ela só muda na virada do dia: `value` é a que está valendo
 * desde a última virada, e `terms`, a conta que a **próxima** virada vai fazer se nada mudar
 * até lá. Quando as duas não coincidem (a fome começou há pouco, a despensa encheu), `next` e
 * `nextText` dizem para onde a moral vai, antes de ela ir.
 */
export type MoraleView = {
  /** De 0 a 100: a moral que vale desde a última virada do dia. */
  value: number;
  band: MoraleBandId;
  bandLabel: string;
  /** O fator da moral na produção agora, em centésimos (ver `MoraleLevelView`). */
  multiplierPercent: number;
  /** "Moral 68 (Contente): produção × 1,09." */
  text: string;
  /**
   * Os termos da conta que a próxima virada vai fazer se nenhuma ordem chegar antes, a começar
   * pela base: já contam com o que acontece até lá (a comida que o consumo leva, o aldeão que
   * chega, a fome que abre). A soma deles, limitada a 0–100, é `next.value`. Um termo só
   * aparece quando vale: sem fome, não há termo de fome.
   */
  terms: Array<{ id: MoraleTermId; label: string; amount: number }>;
  /** A mesma conta em uma linha: "50 (base) + 10 (comida guardada para 8 h) − 10 (casas cheias) = 50". */
  breakdown: string;
  /** Segundos reais até a próxima virada do dia, quando a moral é recalculada. */
  nextUpdateInSeconds: number;
  /** O que a próxima virada faz da moral, se nada mudar até lá. */
  next: MoraleLevelView;
  /**
   * "A moral só muda na virada do dia: na próxima, cai de 60 para 30 (Inquieto)." Quando nada
   * muda: "A moral só muda na virada do dia: na próxima, continua em 60."
   */
  nextText: string;
  /**
   * O que fazer: o termo que mais pesa na conta e a ação que o tira dela. Sem nada pesando,
   * diz como ganhar o bônus da comida guardada, se ele falta. `null` quando não há o que
   * melhorar por ação do jogador.
   */
  advice: string | null;
  /**
   * A comida guardada que vale o bônus: quanto é preciso ter e quanto falta **agora**, em
   * unidades. `holdsAtNextTurn` diz se a próxima virada do dia vai encontrá-la (é ela que
   * decide o bônus): o consumo pode levá-la antes, e a produção pode completá-la.
   */
  foodReserve: {
    covered: boolean;
    holdsAtNextTurn: boolean;
    /** Comida que cobre o prazo do bônus com os habitantes de agora. */
    needed: number;
    /** Quanto falta no estoque; 0 quando já cobre. */
    missing: number;
    /** O bônus, em pontos de moral. */
    bonus: number;
    /** "Com 120 de comida guardada (o que 5 habitantes comem em 8 h), a moral ganha 10." */
    text: string;
  };
  /**
   * O que a moral e a fome longa fazem com a população nas viradas do dia, em frases prontas:
   * a chance de um colono chegar, a de um aldeão partir, a deserção por fome e o piso. Vazio
   * quando nada disso está em jogo.
   */
  notes: string[];
  /**
   * Efeitos temporários que a moral carrega ou vai carregar (cartas, incursões, objetivos).
   * `endsInSeconds` são os segundos reais até a virada do dia em que o efeito sai da conta.
   */
  effects: Array<{ label: string; amount: number; endsInSeconds: number }>;
};

/** Tudo que a interface exibe, já calculado. A UI só formata números (GDD §14.5). */
export type ViewState = {
  settlement: {
    name: string;
    townHallLevel: number;
    /** Escolhida na criação da partida; não muda durante o ano (GDD §12.1). */
    difficulty: DifficultyId;
    /** "Senhor". */
    difficultyLabel: string;
    /** O ritmo da partida, pronto para exibir: "Rápido: um ano em 56 horas" (GDD §4.2). */
    paceLabel: string;
  };
  calendar: {
    year: number;
    season: SeasonId;
    seasonLabel: string;
    dayOfSeason: number;
    dayOfYear: number;
    secondsToNextDay: number;
    secondsToNextSeason: number;
    /** O que a estação atual muda, em uma frase: "Outono: comida × 1,3; ouro × 1,1." */
    seasonEffects: string;
    nextSeason: {
      id: SeasonId;
      label: string;
      secondsUntil: number;
      /** Uma frase para cada coisa que muda na virada. */
      changes: string[];
      /** A conta da lenha, quando a próxima estação queima madeira; `null` nas outras. */
      firewood: FirewoodView | null;
    };
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
    /** Limite do estoque, em unidades; `null` para o que não tem limite (o ouro). */
    cap: number | null;
    /**
     * De onde vem o limite: "500 iniciais" ou "Celeiro Nv2: 1.500 × 0,8 (Rei de Ferro) = 1.200".
     * `null` sem limite.
     */
    capBreakdown: string | null;
    /** O edifício que amplia o limite deste recurso; `null` sem limite. */
    storageBuilding: BuildingId | null;
    /** Onde o recurso fica hoje: "Celeiro", ou "Despensa" antes de ele existir; `null` sem limite. */
    storageLabel: string | null;
    /** O estoque está no limite (ou acima dele, em uma partida que veio de antes dos limites). */
    full: boolean;
    /**
     * Segundos até encher. `null` quando o estoque não está subindo, quando já está cheio e
     * quando o enchimento cai depois de algo que muda a taxa (`fullNote` diz o quê).
     */
    fullInSeconds: number | null;
    /**
     * O que os números do limite não dizem, pronto para exibir. Cheio: o que se perde por hora e
     * o que fazer ("Celeiro cheio: 12/h de comida vão ao chão. Amplie o Celeiro ou gaste
     * comida."). Enchendo, mas só depois de a taxa mudar: "Não enche antes da virada para o
     * Outono." `null` no resto do tempo.
     */
    fullNote: string | null;
    /** Quanto deixa de entrar por hora real com o estoque cheio; 0 quando nada se perde. */
    wastingPerHour: number;
    /** Unidades inteiras perdidas desde o último relato da Crônica (a virada do dia). */
    wastedToday: number;
    /** Saldo líquido por hora, com uma casa decimal. */
    perHour: number;
    /**
     * Segundos até o estoque acabar; `null` quando não está caindo. Vale para a comida e, no
     * inverno, para a madeira que a lareira queima.
     */
    depletesInSeconds: number | null;
    breakdown: string;
  }>;
  /**
   * As regras da troca de ofício e da experiência, em frases prontas e no ritmo da partida: é o
   * que a lista de alocação mostra **antes** de o jogador confirmar (GDD §5.4).
   */
  workersRules: {
    /** Quanto dura a adaptação de quem trocar de ofício agora, em segundos reais. */
    adaptationSeconds: number;
    /** "Quem troca de ofício produz metade por 40 min." */
    adaptationText: string;
    /** "Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação." */
    removalText: string;
    /** A regra da experiência do ofício e da mestria, em uma frase. */
    experienceText: string;
    /** O máximo da experiência do ofício: o fim da barra. */
    experienceMax: number;
    /** O bônus de produção com a experiência no máximo, em pontos percentuais: 30. */
    masteryMaxBonusPercent: number;
  };
  workers: Array<{
    building: ProductionBuildingId;
    label: string;
    level: number;
    resource: ResourceId;
    assigned: number;
    grossPerHour: number;
    /**
     * Quanto um trabalhador **adaptado** produz por hora neste edifício agora, já com nível,
     * mestria, estação, fome e frio.
     */
    perWorkerPerHour: number;
    /**
     * Quanto produz por hora um trabalhador que chegar agora, enquanto se adapta. Ao lado de
     * `perWorkerPerHour`, é o custo da troca: "+4/h agora, +8/h depois da adaptação".
     */
    perNewWorkerPerHour: number;
    breakdown: string;
    /** Experiência do ofício deste edifício, de 0 a `workersRules.experienceMax`. */
    experience: number;
    /** O que a experiência acrescenta à produção agora, em pontos percentuais: 12 é "+12%". */
    masteryBonusPercent: number;
    /** Com quantos trabalhadores o edifício conta como ocupado na virada do dia. */
    occupiedFrom: number;
    /** Para onde a experiência vai na próxima virada do dia, se nada mudar. */
    experienceTrend: 'rising' | 'steady' | 'falling';
    /** O porquê da tendência e o que fazer, em uma frase pronta. */
    experienceNote: string;
    /** Quantos dos trabalhadores ainda estão em adaptação. */
    adapting: number;
    /**
     * Segundos reais até o último deles terminar a adaptação e o edifício render inteiro;
     * `null` sem ninguém em adaptação.
     */
    adaptationEndsInSeconds: number | null;
    /** As levas em adaptação, da que termina antes à que termina depois. */
    adaptingCohorts: Array<{ count: number; endsInSeconds: number }>;
  }>;
  constructions: {
    /** Atalho para a primeira obra em curso, na ordem das filas; `null` sem nenhuma. */
    active: ActiveConstructionView | null;
    /** Uma entrada por fila **aberta**, na ordem: a obra em curso, ou `null` se a fila está livre. */
    queues: Array<ActiveConstructionView | null>;
    /** Quantas filas de obras o feudo tem abertas agora. */
    queuesUnlocked: number;
    /**
     * O que abre a próxima fila: "A segunda fila de obras abre com o Salão do Senhor no nível
     * 4." `null` quando todas já estão abertas.
     */
    queuesNote: string | null;
    /** As planejadas, na ordem da lista: é a ordem em que as automáticas são tentadas. */
    planned: PlannedUpgradeView[];
    available: UpgradeView[];
  };
  recruitment: {
    cost: ResourceCostView[];
    /** Tempo de treinamento de cada aldeão de uma ordem dada agora, já com o fator da estação. */
    secondsPerVillager: number;
    /**
     * Por que o tempo não é o de tabela: "Na Primavera, o prazo de um recrutamento ordenado agora
     * é × 0,8." `null` quando a estação não mexe nele.
     */
    durationNote: string | null;
    /** Quantos aldeões cabem em uma nova ordem agora. */
    maxQuantity: number;
    blockedReason: string | null;
    /**
     * O que uma ordem de recrutamento dada agora custa à moral, ao lado do custo em recursos:
     * "Chamar aldeões agora gasta a comida guardada, que vale 10 de moral. Com as casas cheias
     * a moral perde 10: para evitar, chame até 4." `null` quando recrutar não mexe na moral, ou
     * quando não dá para recrutar.
     */
    moraleNote: string | null;
  };
  famine: null | { sinceMs: number; secondsElapsed: number; text: string };
  morale: MoraleView;
  /**
   * A estação da lenha: `null` fora dela. `cold` é o frio, aberto quando a madeira acabou; o
   * texto diz o que ele custa, quanto falta e o que fazer.
   */
  winter: null | {
    /** Madeira queimada por hora real. */
    firewoodPerHour: number;
    /** A conta do que falta queimar até a estação virar. */
    firewood: FirewoodView;
    cold: null | { secondsElapsed: number; text: string };
  };
  objectives: ObjectiveView[];
  /** Vazio na v0.1: cartas e encruzilhadas chegam nas versões seguintes. */
  pendingDecisions: never[];
};
