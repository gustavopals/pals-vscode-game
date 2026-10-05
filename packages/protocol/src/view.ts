import {
  BUILDING_IDS,
  DIFFICULTY_IDS,
  ENEMY_IDS,
  EVENT_TYPES,
  MORALE_BAND_IDS,
  MORALE_TERM_IDS,
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
  /** O que a obra muda, ao lado do custo: "Capacidade de comida: 500 → 1.000."; `null` sem frase. */
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

/**
 * Onde um objetivo se cumpre: é para lá que a interface leva quem quer cumpri-lo, sem conhecer
 * objetivo nenhum pelo id.
 */
const ObjectiveTargetSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('workers'), building: z.enum(PRODUCTION_BUILDING_IDS) }),
  z.strictObject({ kind: z.literal('building'), building: buildingId }),
  z.strictObject({ kind: z.literal('recruitment') }),
  z.strictObject({ kind: z.literal('council') }),
  z.strictObject({ kind: z.literal('planned') }),
  z.strictObject({ kind: z.literal('season'), season: z.enum(SEASON_IDS) }),
]);

const ObjectiveSchema = z.strictObject({
  id: z.string(),
  /** A ação, sem ponto: "Construa a Torre de Vigia". */
  title: z.string(),
  /** O porquê, em uma frase. */
  hint: z.string(),
  /** A recompensa, sem ponto: "+40 pedra"; "+10 de moral por 1 dia de jogo (40 min)". */
  reward: z.string(),
  status: z.enum(['active', 'completed']),
  progress: z.strictObject({ current: z.number(), target: z.number() }),
  /**
   * O que falta agora, em uma frase pronta; `null` no objetivo concluído e naquele a que só
   * falta uma ordem que o jogador já pode dar.
   */
  missing: z.string().nullable(),
  target: ObjectiveTargetSchema,
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
  /** Madeira que a Serraria ainda junta antes de a estação da conta começar. */
  gathered: z.number(),
  /** Madeira que as obras planejadas automáticas vão levar do estoque no prazo da conta. */
  reserved: z.number(),
  /** Quanto falta guardar, já sem o que as obras levam; 0 quando o estoque e a Serraria cobrem. */
  missing: z.number(),
  text: z.string(),
});

/**
 * A comida na estação que vem, com os habitantes e os trabalhadores de agora: o saldo logo
 * depois da virada e, se ele não cobre as bocas, quando a comida acaba. É o que o prazo da
 * estação de agora (`resources[].depletesInSeconds`) não vê.
 */
const FoodForecastSchema = z.strictObject({
  /** Saldo de comida por hora real logo depois da virada. */
  perHour: z.number(),
  /** Comida que a virada deve encontrar em estoque, em unidades. */
  stockAtTurn: z.number(),
  /**
   * Segundos reais, a contar de agora, até a comida acabar na estação que vem; `null` quando
   * ela cresce ou atravessa a estação, e quando a lenha acaba antes (com o frio a conta é outra).
   */
  depletesInSeconds: z.number().nullable(),
  text: z.string(),
});

/** O que uma moral vale: o número, a faixa e o fator que ela põe na produção. */
const MoraleLevelSchema = z.strictObject({
  /** De 0 a 100. */
  value: z.number(),
  band: z.enum(MORALE_BAND_IDS),
  /** "Inquieto". */
  bandLabel: z.string(),
  /** O fator na produção, em centésimos: 109 é "produção × 1,09"; pode ter meia unidade. */
  multiplierPercent: z.number(),
});

/**
 * A moral do feudo (GDD §5.7). Ela só muda na virada do dia: `value` é a que vale desde a
 * última virada, e `terms`, a conta que a **próxima** virada vai fazer se nenhuma ordem chegar
 * antes. Quando as duas não coincidem, `next` e `nextText` dizem para onde a moral vai.
 */
const MoraleSchema = MoraleLevelSchema.extend({
  /** "Moral 68 (Contente): produção × 1,09." */
  text: z.string(),
  /** Os termos da conta da próxima virada, a começar pela base; somam `next.value` antes do limite. */
  terms: z.array(
    z.strictObject({ id: z.enum(MORALE_TERM_IDS), label: z.string(), amount: z.number() }),
  ),
  /** A mesma conta em uma linha: "50 (base) + 10 (comida guardada para 8 h) = 60". */
  breakdown: z.string(),
  /** Segundos reais até a próxima virada do dia, quando a moral é recalculada. */
  nextUpdateInSeconds: z.number(),
  /** O que a próxima virada faz da moral, se nada mudar até lá. */
  next: MoraleLevelSchema,
  /** "A moral só muda na virada do dia: na próxima, cai de 60 para 30 (Inquieto)." */
  nextText: z.string(),
  /** O que mais pesa na conta e o que fazer; `null` quando não há o que melhorar. */
  advice: z.string().nullable(),
  /** A comida guardada que vale o bônus: quanto é preciso ter e quanto falta, em unidades. */
  foodReserve: z.strictObject({
    covered: z.boolean(),
    /** A próxima virada do dia vai encontrar a reserva: é ela que decide o bônus. */
    holdsAtNextTurn: z.boolean(),
    needed: z.number(),
    missing: z.number(),
    bonus: z.number(),
    text: z.string(),
  }),
  /** O que a moral e a fome longa fazem com a população nas viradas: frases prontas. */
  notes: z.array(z.string()),
  /** Efeitos temporários que a moral carrega; `endsInSeconds` é quando saem da conta. */
  effects: z.array(
    z.strictObject({ label: z.string(), amount: z.number(), endsInSeconds: z.number() }),
  ),
});

/** Uma opção de uma carta do Conselho: o custo e a consequência conhecida, lado a lado. */
const CouncilOptionSchema = z.strictObject({
  id: z.string(),
  /** "Ceder a madeira". */
  label: z.string(),
  /** O que a opção cobra, com o que falta de cada recurso; vazio quando não custa nada. */
  cost: z.array(ResourceCostSchema),
  /** O estoque paga o custo agora. */
  affordable: z.boolean(),
  /** A opção exige algo que o feudo não tem (um edifício, um estoque mínimo). */
  locked: z.boolean(),
  /** "Requer o Celeiro."; `null` quando não está trancada. */
  lockedReason: z.string().nullable(),
  /**
   * O custo e a consequência conhecida, em uma frase pronta: "−40 madeira; +5 de moral por 2 dias
   * de jogo (1 h 20 min)". O que a opção esconde não sai em lugar nenhum da visão: só a pista.
   */
  effectsText: z.string(),
  /** A pista do que pode vir depois. */
  hint: z.string(),
});

/** Uma carta do Conselho à espera de resposta. */
const CouncilCardSchema = z.strictObject({
  /** O que `answerCard` recebe: a ocorrência, não o modelo. */
  instanceId: z.string(),
  title: z.string(),
  /** A situação, já na variante que lembra a escolha anterior, quando há. */
  text: z.string(),
  /** Segundos reais até o conselho decidir sozinho. */
  expiresInSeconds: z.number(),
  /** A opção que o conselho aplica se o prazo acabar, na dificuldade desta partida. */
  defaultOptionId: z.string(),
  defaultOptionLabel: z.string(),
  /** "Sem resposta até o fim do prazo, o conselho decide sozinho: conservar as reservas." */
  expiryNote: z.string(),
  /**
   * De onde a história vem, quando a carta é a continuação de outra: a carta anterior, a opção
   * aplicada nela e a frase pronta; `null` na carta que veio do sorteio.
   */
  followsFrom: z
    .strictObject({ title: z.string(), optionLabel: z.string(), text: z.string() })
    .nullable(),
  options: z.array(CouncilOptionSchema),
});

/** O Conselho do Feudo (GDD §7). Flags e efeitos escondidos nunca saem do servidor. */
const CouncilSchema = z.strictObject({
  /** As cartas à espera, na ordem em que chegaram. */
  pending: z.array(CouncilCardSchema),
  /**
   * Segundos reais até a próxima audiência, se ela puder trazer carta; `null` quando não pode
   * (a mesa cheia, ou nenhum assunto para o feudo como ele está: `note` diz qual).
   */
  nextCardInSeconds: z.number().nullable(),
  /** Na próxima audiência a mesa ainda vai estar cheia, se nenhuma carta for respondida. */
  blockedByPending: z.boolean(),
  /** Segundos reais até a próxima audiência, traga ela carta ou não. */
  nextAudienceInSeconds: z.number(),
  /** Por que a próxima audiência não traz carta, e o que fazer; `null` quando ela pode trazer. */
  note: z.string().nullable(),
  /** As regras em uma frase, no ritmo da partida: a cadência, o limite e o prazo de resposta. */
  rulesText: z.string(),
});

/** Uma decisão à espera do jogador: hoje, só as cartas do Conselho. `id` é o `instanceId`. */
const PendingDecisionSchema = z.strictObject({
  kind: z.literal('card'),
  id: z.string(),
  title: z.string(),
  expiresInSeconds: z.number(),
});

/**
 * A Torre de Vigia, como o painel da Ameaça a mostra: o que ela faz hoje e o que o próximo nível
 * passaria a fazer. O custo e o botão da obra estão em `constructions.available`.
 */
const ThreatWatchtowerSchema = z.strictObject({
  /** O edifício da Torre: é o que `startConstruction` recebe e o que a lista de obras mostra. */
  building: buildingId,
  /** 0 enquanto não foi construída. */
  level: z.number(),
  /** "Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão com 1 h de antecedência." */
  text: z.string(),
  /** O que o próximo nível passa a fazer; `null` com a Torre no teto desta versão. */
  next: z.string().nullable(),
});

/**
 * O que protege o feudo de um ataque hoje, e o que a próxima obra da Paliçada mudaria. Sai nas
 * duas formas da Ameaça: só depende do nível da Paliçada, que o jogador conhece.
 */
const ThreatDefenseSchema = z.strictObject({
  /** O edifício da Paliçada: é o que `startConstruction` recebe e o que a lista de obras mostra. */
  building: buildingId,
  /** 0 enquanto não foi construída. */
  palisadeLevel: z.number(),
  /**
   * "Sem Paliçada, nada segura um ataque."; "Paliçada Nv1: segura ataques leves, sem perda nem
   * ferido; os médios passam, mas com metade do estrago."
   */
  text: z.string(),
  /** O que o próximo nível passa a segurar; `null` com a Paliçada no teto desta versão. */
  next: z.string().nullable(),
});

/** Uma incursão que os vigias já avistaram. */
const ThreatIncomingSchema = z.strictObject({
  enemy: z.enum(ENEMY_IDS),
  /** "Lobos". */
  enemyLabel: z.string(),
  /** Segundos reais até a incursão chegar. */
  inSeconds: z.number(),
  /** "uma matilha pequena"; `null` quando a Torre ainda não distingue o tamanho. */
  sizeText: z.string().nullable(),
  /** "Lobos a caminho. Os vigias contam uma matilha pequena." O prazo fica em `inSeconds`. */
  text: z.string(),
  /**
   * O que este ataque custa a um feudo sem defesa, para ficar ao lado de `defenseText`: "Sem
   * defesa, uma matilha grande leva 15% do estoque de comida e madeira (hoje, 48 de comida e 45
   * de madeira) e fere 2 aldeões, que ficam 40 min sem trabalhar." Sem o tamanho à vista, diz o
   * que cada tamanho custa, e não o revela.
   */
  costText: z.string(),
  /**
   * O que a Paliçada faz a esta incursão: "A Paliçada Nv1 segura este ataque: sem perda nem
   * ferido."; "Sem Paliçada, nada segura este ataque." Sem o tamanho à vista, a frase vale para
   * qualquer um e não o revela. Com a obra da Paliçada em curso, diz se ela fica pronta a tempo.
   */
  defenseText: z.string(),
});

/**
 * A Ameaça (GDD §8.2), em duas formas fechadas. **Sem a Torre de Vigia (`known: false`) o
 * número, a tendência, as origens, os tiles e as incursões não saem do servidor**, e este
 * schema recusa uma resposta que os trouxesse. Quem lê confere `known` antes de procurar o
 * número.
 */
const ThreatSchema = z.discriminatedUnion('known', [
  z.strictObject({
    known: z.literal(false),
    /** "Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo." */
    text: z.string(),
    /** Sem Torre não há aviso: sempre `null`. */
    incoming: z.null(),
    watchtower: ThreatWatchtowerSchema,
    defense: ThreatDefenseSchema,
  }),
  z.strictObject({
    known: z.literal(true),
    /** "Ameaça 45 de 100." */
    text: z.string(),
    /** De 0 a `max`. */
    level: z.number(),
    /** O fim da barra. */
    max: z.number(),
    /** Quanto a próxima virada do dia soma, já com o limite: 0 com a Ameaça no máximo. */
    risePerDay: z.number(),
    /**
     * A Ameaça depois da próxima virada do dia: a subida e, com uma incursão à vista que chega
     * até lá, a queda dela. A incursão que os vigias ainda não viram não entra.
     */
    nextLevel: z.number(),
    /** Segundos reais até a próxima virada do dia, quando a Ameaça sobe. */
    nextRiseInSeconds: z.number(),
    /** "Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 45 para 50." */
    trend: z.string(),
    /** De onde vem a subida, um termo por linha: "+2/dia: Covil de Lobos", "+3/dia: outono". */
    sources: z.array(z.string()),
    /** Os tiles de ameaça conhecidos, em lista: o mapa gráfico é de outra versão. */
    tiles: z.array(z.strictObject({ id: z.string(), label: z.string(), active: z.boolean() })),
    /**
     * A chance, em %, de a próxima virada do dia marcar uma incursão, com a Ameaça que essa
     * virada vai dar; 0 enquanto ela não passa do limiar, e com uma incursão já à vista.
     */
    raidChancePercent: z.number(),
    /** A regra das incursões em frases prontas, no ritmo da partida: a chance, o prazo, o tamanho e a queda. */
    raidRisk: z.string(),
    /**
     * O que cada tamanho de incursão custa a um feudo sem defesa, um por linha, e o que fica
     * depois (o ferimento e a moral): "Ataques leves: levam 10% do estoque de comida e madeira
     * e ferem 1 aldeão."
     */
    raidCosts: z.array(z.string()),
    /** A incursão que os vigias já avistaram; `null` quando não há nenhuma à vista. */
    incoming: ThreatIncomingSchema.nullable(),
    watchtower: ThreatWatchtowerSchema,
    defense: ThreatDefenseSchema,
  }),
]);

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
      /**
       * A previsão da comida depois da virada; `null` com fome, e quando a comida ou a lenha
       * acabam antes da virada (o alarme é o da estação de agora).
       */
      food: FoodForecastSchema.nullable(),
    }),
    /**
     * A próxima estação que queima lenha, com o prazo até ela e a conta; `null` quando a estação
     * de agora já queima (a conta é a de `winter.firewood`).
     */
    nextFirewoodSeason: z
      .strictObject({
        id: z.enum(SEASON_IDS),
        label: z.string(),
        secondsUntil: z.number(),
        firewood: FirewoodSchema,
      })
      .nullable(),
  }),
  population: z.strictObject({
    villagers: z.number(),
    capacity: z.number(),
    free: z.number(),
    inTraining: z.number(),
    housed: z.number(),
    vacancies: z.number(),
    secondsToNextRecruit: z.number().nullable(),
    /**
     * Aldeões feridos em uma incursão: moram e comem no feudo, mas não trabalham até sarar. Não
     * entram em `free`.
     */
    injured: z.number(),
    /** Segundos reais até o próximo ferido sarar; `null` sem feridos. */
    secondsToNextRecovery: z.number().nullable(),
    /**
     * "1 aldeão ferido na incursão: não trabalha até sarar, em 40 min, e então volta à
     * Serraria."; `null` sem feridos.
     */
    injuredNote: z.string().nullable(),
    breakdown: z.string(),
  }),
  resources: z.array(
    z.strictObject({
      id: resourceId,
      label: z.string(),
      stock: z.number(),
      /** Limite do estoque, em unidades; `null` para o que não tem limite (o ouro). */
      cap: z.number().nullable(),
      /** De onde vem o limite: "500 iniciais", "Celeiro Nv2: 1.600 × 0,8 (Rei de Ferro) = 1.280". */
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
  /**
   * As regras da troca de ofício e da experiência, em frases prontas e no ritmo da partida: é o
   * que a lista de alocação mostra antes de o jogador confirmar.
   */
  workersRules: z.strictObject({
    /** Quanto dura a adaptação de quem trocar de ofício agora, em segundos reais. */
    adaptationSeconds: z.number(),
    /** "Quem troca de ofício produz metade por 40 min." */
    adaptationText: z.string(),
    /** "Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação." */
    removalText: z.string(),
    /** A regra da experiência do ofício e da mestria, em uma frase. */
    experienceText: z.string(),
    /** O máximo da experiência do ofício: o fim da barra. */
    experienceMax: z.number(),
    /** O bônus de produção com a experiência no máximo, em pontos percentuais. */
    masteryMaxBonusPercent: z.number(),
  }),
  workers: z.array(
    z.strictObject({
      building: z.enum(PRODUCTION_BUILDING_IDS),
      label: z.string(),
      level: z.number(),
      resource: resourceId,
      assigned: z.number(),
      grossPerHour: z.number(),
      /** O que um trabalhador adaptado rende por hora real neste edifício agora. */
      perWorkerPerHour: z.number(),
      /** O que rende por hora real um trabalhador que chegar agora, enquanto se adapta. */
      perNewWorkerPerHour: z.number(),
      breakdown: z.string(),
      /** Experiência do ofício, de 0 a `workersRules.experienceMax`. */
      experience: z.number(),
      /** O que a experiência acrescenta à produção agora, em pontos percentuais. */
      masteryBonusPercent: z.number(),
      /** Com quantos trabalhadores o edifício conta como ocupado na virada do dia. */
      occupiedFrom: z.number(),
      /** Para onde a experiência vai na próxima virada do dia, se nada mudar. */
      experienceTrend: z.enum(['rising', 'steady', 'falling']),
      /** O porquê da tendência e o que fazer, em uma frase pronta. */
      experienceNote: z.string(),
      /** Quantos dos trabalhadores ainda estão em adaptação. */
      adapting: z.number(),
      /** Segundos reais até o último deles terminar a adaptação; `null` sem ninguém. */
      adaptationEndsInSeconds: z.number().nullable(),
      /** As levas em adaptação, da que termina antes à que termina depois. */
      adaptingCohorts: z.array(z.strictObject({ count: z.number(), endsInSeconds: z.number() })),
      /**
       * Feridos que saíram deste edifício e voltam a ele ao sarar, já adaptados. Não estão em
       * `assigned`: a ordem de trabalhadores não os conta nem os tira.
       */
      injured: z.number(),
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
    /** O que recrutar agora custa à moral (a comida guardada, as casas cheias); `null` sem custo. */
    moraleNote: z.string().nullable(),
  }),
  famine: z
    .strictObject({
      sinceMs: z.number(),
      secondsElapsed: z.number(),
      /** Segundos reais até a fome acabar sozinha; `null` quando só acaba com uma ordem. */
      endsInSeconds: z.number().nullable(),
      text: z.string(),
    })
    .nullable(),
  morale: MoraleSchema,
  /** A estação da lenha; `null` fora dela. `cold` é o frio, aberto quando a madeira acabou. */
  winter: z
    .strictObject({
      firewoodPerHour: z.number(),
      firewood: FirewoodSchema,
      cold: z
        .strictObject({
          secondsElapsed: z.number(),
          /** Segundos reais até o frio passar sozinho; `null` quando só passa com uma ordem. */
          endsInSeconds: z.number().nullable(),
          text: z.string(),
        })
        .nullable(),
    })
    .nullable(),
  objectives: z.array(ObjectiveSchema),
  council: CouncilSchema,
  /** A Ameaça, vista (ou não) pela Torre de Vigia. */
  threat: ThreatSchema,
  /**
   * O que espera uma decisão do jogador, do prazo mais curto ao mais longo: o resumo para a
   * barra de status, a árvore e os avisos. A carta inteira está em `council.pending`.
   */
  pendingDecisions: z.array(PendingDecisionSchema),
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
