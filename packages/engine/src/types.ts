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

/** Uma carta do Conselho à espera de resposta (GDD §7.1). */
export type PendingCard = {
  /**
   * A ocorrência, não o modelo: a mesma carta em outro ano (ou uma recorrente) tem outro
   * `instanceId`. É o id da carta e a ordem de chegada dela na partida: "collapsedWell-3".
   */
  instanceId: string;
  cardId: string;
  drawnAtMs: number;
  /**
   * Quando o conselho decide sozinho. O prazo é de tempo real (24 h) e foi convertido para
   * tempo de jogo, com o ritmo da partida, no instante em que a carta chegou.
   */
  expiresAtMs: number;
  /**
   * A escolha que trouxe esta carta, quando ela é a continuação de outra; `null` na que veio do
   * sorteio. É o que deixa a tela dizer de onde a história vem.
   */
  origin: { cardId: string; optionId: string; instanceId: string } | null;
};

/** Uma continuação agendada: a carta que uma escolha anterior marcou para chegar depois. */
export type ScheduledCard = {
  cardId: string;
  /** A partir de quando ela pode chegar; chega no primeiro instante com vaga entre as pendentes. */
  atMs: number;
  /** A escolha que a agendou: é o que liga as duas linhas na Crônica. */
  previousCardId: string;
  previousOptionId: string;
  previousInstanceId: string;
};

/**
 * O efeito escondido de uma opção já escolhida, à espera do instante dele. Só guarda quem o
 * deixou: o efeito em si é lido do conteúdo quando acontece.
 */
export type DelayedCardEffect = {
  atMs: number;
  instanceId: string;
  cardId: string;
  optionId: string;
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
  schemaVersion: 8;
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
  /**
   * O Conselho do Feudo (GDD §7; ADR 0014). Os efeitos temporários de moral que as cartas
   * deixam não ficam aqui: vão para `settlement.moraleEffects`, com os das outras mecânicas.
   */
  council: {
    /** As cartas à espera de resposta, na ordem em que chegaram; no máximo `maxPending`. */
    pending: PendingCard[];
    /** Marcadores narrativos gravados pelas cartas. Atravessam os anos e nunca saem na visão. */
    flags: Record<string, true>;
    /** As cartas que já chegaram neste ano de jogo: só as recorrentes saem de novo. Zera na virada do ano. */
    seenThisYear: string[];
    /**
     * O próximo sorteio. A cadência é ancorada: anda de intervalo em intervalo, sempre, haja
     * ou não carta sorteada. Cai sempre em uma virada de dia de jogo.
     */
    nextDrawAtMs: number;
    /** As continuações agendadas, em ordem de prazo. */
    scheduled: ScheduledCard[];
    /** Os efeitos escondidos que ainda vão acontecer, em ordem de instante. */
    delayed: DelayedCardEffect[];
    /**
     * As ocorrências que expiraram neste ano de jogo: é o que deixa a recusa de uma resposta
     * atrasada dizer que o prazo acabou, e não só que a carta saiu da mesa.
     */
    expired: string[];
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
      /**
       * `autoStart` marca a planejada como "iniciar quando houver recursos"; sem ele, manual.
       * `targetLevel` é o nível que a tela mostrava ao jogador: se a obra a planejar já não é a
       * desse nível (outra aba passou na frente), a ordem é recusada em vez de valer para outro.
       */
      payload: {
        building: BuildingId;
        autoStart?: boolean | undefined;
        targetLevel?: number | undefined;
      };
    }
  | { commandId: string; type: 'unplanConstruction'; payload: { building: BuildingId } }
  | {
      commandId: string;
      type: 'setAutoStart';
      /** `targetLevel`, como em `planConstruction`: o nível da planejada que a tela mostrava. */
      payload: { building: BuildingId; autoStart: boolean; targetLevel?: number | undefined };
    }
  | { commandId: string; type: 'recruitVillagers'; payload: { quantity: number } }
  | { commandId: string; type: 'renameSettlement'; payload: { name: string } }
  | {
      commandId: string;
      type: 'answerCard';
      /** `instanceId` é a ocorrência que a tela mostrava; `optionId`, a opção escolhida. */
      payload: { instanceId: string; optionId: string };
    };

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
  'STALE_LEVEL',
  'INVALID_QUANTITY',
  'FAMINE',
  'RECRUIT_QUEUE_FULL',
  'HOUSING_FULL',
  'INVALID_NAME',
  'CARD_NOT_PENDING',
  'CARD_EXPIRED',
  'INVALID_OPTION',
  'OPTION_LOCKED',
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
  /**
   * Madeira que a Serraria ainda junta antes de a estação da conta começar, até onde o depósito
   * guarda. 0 dentro da estação, e quando a comida acaba antes (a visão não adivinha).
   */
  gathered: number;
  /**
   * Madeira que as obras planejadas automáticas vão levar do estoque antes de o prazo da conta
   * acabar: o motor as inicia sozinho, sem olhar a lenha (GDD §6.3). 0 quando nenhuma começa.
   */
  reserved: number;
  /**
   * Quanto falta guardar para a lareira não apagar, já com o que a Serraria junta até lá e sem
   * o que as obras automáticas levam; 0 quando o estoque e a Serraria cobrem.
   */
  missing: number;
  /** A conta em uma frase, pronta para exibir. */
  text: string;
};

/**
 * A comida na estação que vem (GDD §4.1 e §5.6): o saldo logo depois da virada e, se ele não
 * cobre as bocas, quando a comida acaba. A conta parte do que a virada deve encontrar no
 * estoque, com os habitantes e os trabalhadores de agora, e segue pela estação com o que o
 * ofício e a moral mudam sozinhos. É o que responde "posso sair sem olhar para a Fazenda?"
 * quando o prazo da estação de agora (`resources[].depletesInSeconds`) ainda não diz nada.
 */
export type FoodForecastView = {
  /** Saldo de comida por hora real logo depois da virada. */
  perHour: number;
  /** Comida que a virada deve encontrar em estoque, em unidades. */
  stockAtTurn: number;
  /**
   * Segundos reais, a contar de agora, até a comida acabar na estação que vem. `null` quando
   * ela cresce ou atravessa a estação, e quando a lenha acaba antes: com o frio a conta é outra.
   */
  depletesInSeconds: number | null;
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

/** Uma opção de uma carta do Conselho, com o custo e a consequência conhecida lado a lado. */
export type CouncilOptionView = {
  id: string;
  /** "Ceder a madeira". */
  label: string;
  /** O que a opção cobra, com o que falta de cada recurso; vazio quando não custa nada. */
  cost: ResourceCostView[];
  /** O estoque paga o custo agora. */
  affordable: boolean;
  /** A opção exige algo que o feudo não tem (um edifício, um estoque mínimo). */
  locked: boolean;
  /** "Requer o Celeiro."; `null` quando não está trancada. */
  lockedReason: string | null;
  /**
   * O custo e a consequência **conhecida**, em uma frase pronta: "−40 madeira; +5 de moral por 2
   * dias de jogo (1 h 20 min)". O que a opção esconde não aparece aqui nem em lugar nenhum da
   * visão: só a pista, em `hint`.
   */
  effectsText: string;
  /** A pista do que pode vir depois. */
  hint: string;
};

/** Uma carta do Conselho à espera de resposta. */
export type CouncilCardView = {
  /** O que `answerCard` recebe: a ocorrência, não o modelo. */
  instanceId: string;
  title: string;
  /** A situação, já na variante que lembra a escolha anterior, quando há. */
  text: string;
  /** Segundos reais até o conselho decidir sozinho. */
  expiresInSeconds: number;
  /** A opção que o conselho aplica se o prazo acabar, na dificuldade desta partida. */
  defaultOptionId: string;
  defaultOptionLabel: string;
  /** "Sem resposta até o fim do prazo, o conselho decide sozinho: conservar as reservas." */
  expiryNote: string;
  /**
   * De onde a história vem, quando a carta é a continuação de outra: a carta anterior, a opção
   * que foi aplicada nela (pelo senhor ou, sem resposta, pelo conselho) e a frase pronta. `null`
   * na carta que veio do sorteio.
   */
  followsFrom: { title: string; optionLabel: string; text: string } | null;
  options: CouncilOptionView[];
};

/** O Conselho do Feudo na visão (GDD §7). Flags e efeitos escondidos nunca saem daqui. */
export type CouncilView = {
  /** As cartas à espera, na ordem em que chegaram. */
  pending: CouncilCardView[];
  /**
   * Segundos reais até a próxima audiência, **se ela puder trazer carta**. `null` quando não
   * pode: as pendentes ocupam a mesa (`blockedByPending`) ou o conselho não tem assunto para o
   * feudo como ele está (`note` diz qual dos dois).
   */
  nextCardInSeconds: number | null;
  /**
   * Na próxima audiência a mesa ainda vai estar cheia, se nenhuma carta for respondida até lá:
   * o sorteio daquele instante é pulado.
   */
  blockedByPending: boolean;
  /** Segundos reais até a próxima audiência, traga ela carta ou não. */
  nextAudienceInSeconds: number;
  /** Por que a próxima audiência não traz carta, e o que fazer; `null` quando ela pode trazer. */
  note: string | null;
  /** As regras em uma frase, no ritmo da partida: a cadência, o limite e o prazo de resposta. */
  rulesText: string;
};

/** Uma decisão à espera do jogador: hoje, só as cartas do Conselho. `id` é o `instanceId`. */
export type PendingDecisionView = {
  kind: 'card';
  id: string;
  title: string;
  expiresInSeconds: number;
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
      /**
       * A previsão da comida depois da virada. `null` com fome, e quando a comida ou a lenha
       * acabam antes da virada: o alarme é o da estação de agora.
       */
      food: FoodForecastView | null;
    };
    /**
     * A próxima estação que queima lenha, com o prazo até ela e a conta: é `nextSeason` no
     * outono, e o inverno ainda distante no resto do ano (no ritmo Rápido ele pode estar a menos
     * de um dia de relógio com o outono no meio). `null` quando a estação de agora já queima
     * lenha: a conta é a de `winter.firewood`.
     */
    nextFirewoodSeason: null | {
      id: SeasonId;
      label: string;
      secondsUntil: number;
      firewood: FirewoodView;
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
     * o que fazer ("Armazém cheio: 12/h de madeira indo ao chão. Amplie o Armazém ou gaste
     * madeira."; para a comida, que nenhuma obra custa, "…recrute aldeões ou ponha parte dos
     * lavradores em outro ofício."). Enchendo, mas só depois de a taxa mudar: "Não enche antes
     * da virada para o Outono." `null` no resto do tempo.
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
  famine: null | {
    sinceMs: number;
    secondsElapsed: number;
    /**
     * Segundos reais até a fome acabar sozinha, sem nenhuma ordem: quem ainda se adapta passa a
     * render inteiro, ou a virada do dia muda a moral. `null` quando ela só acaba com uma ordem
     * do jogador (ou quando a estação vira antes): o texto diz o porquê quando há prazo.
     */
    endsInSeconds: number | null;
    text: string;
  };
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
    cold: null | {
      secondsElapsed: number;
      /** Segundos reais até o frio passar sozinho, como em `famine.endsInSeconds`; `null` se não passa. */
      endsInSeconds: number | null;
      text: string;
    };
  };
  objectives: ObjectiveView[];
  council: CouncilView;
  /**
   * O que espera uma decisão do jogador, do prazo mais curto ao mais longo: as cartas do
   * Conselho. É o resumo para a barra de status, a árvore e os avisos; a carta inteira está em
   * `council.pending`.
   */
  pendingDecisions: PendingDecisionView[];
};
