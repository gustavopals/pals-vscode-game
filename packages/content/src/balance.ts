import type {
  BuildingId,
  DifficultyId,
  EnemyId,
  ExpeditionOutcomeId,
  HeroAttributeId,
  HeroCaptureRuleId,
  InjurySeverityId,
  MoraleBandId,
  ProductionBuildingId,
  RaidSizeId,
  Ratio,
  ResourceAmounts,
  ResourceId,
  SeasonId,
} from './ids';

/**
 * O que uma estação muda (GDD §4.1). Os fatores de produção valem a partir do instante exato da
 * virada; os de duração são fixados quando a obra começa ou o recrutamento é ordenado, e o prazo
 * não muda na virada seguinte (ADR 0013, decisão 13).
 */
export type SeasonEffects = {
  /** Fator sobre a produção de cada recurso. */
  readonly production: Record<ResourceId, Ratio>;
  /** Fator sobre o prazo de um recrutamento **ordenado** nesta estação. */
  readonly recruitmentDuration: Ratio;
  /** Fator sobre o prazo de uma obra **iniciada** nesta estação. */
  readonly constructionDuration: Ratio;
  /**
   * Fator sobre a duração dos nós de uma expedição **enviada** nesta estação (GDD §4.1: no verão
   * elas são 15% mais rápidas). Fixado no envio: a duração mostrada antes é a que vale.
   */
  readonly expeditionDuration: Ratio;
  /**
   * Lenha: madeira queimada por habitante por hora de jogo, em fração (1/2 é meia unidade).
   * Zero nas estações em que ninguém acende a lareira.
   */
  readonly firewoodPerVillagerPerHour: Ratio;
};

export type SeasonDef = {
  readonly id: SeasonId;
  readonly label: string;
  /** Artigo para montar "a Primavera" e "da Primavera" nas frases. */
  readonly article: 'a' | 'o';
  /** Duração em dias de jogo. */
  readonly days: number;
  readonly effects: SeasonEffects;
};

/**
 * Uma dificuldade (GDD §12.1), com o que a v0.2 usa dela. A opção que o Conselho escolhe quando
 * uma carta expira também depende da dificuldade, mas é marcada em cada carta (ADR 0014,
 * decisão 9): aqui ela só aparece na frase.
 */
export type DifficultyDef = {
  readonly label: string;
  /** Uma frase sobre o que muda nesta versão; as boas-vindas a mostram ao lado da opção. */
  readonly description: string;
  /** A que vale para quem não escolhe. */
  readonly recommended: boolean;
  /** Fator sobre a capacidade do Celeiro e do Armazém (GDD §5.5). */
  readonly storageCapacity: Ratio;
  /** A fome longa faz aldeões partirem (GDD §5.6). */
  readonly famineDesertion: boolean;
  /**
   * O que acontece ao herói onde um nó de expedição marca captura (GDD §12.1; ADR 0017,
   * decisão 8): ferimento grave no lugar dela, a captura, ou a morte.
   */
  readonly heroCapture: HeroCaptureRuleId;
};

/**
 * O que um edifício de armazenamento guarda (GDD §5.5). A capacidade é em unidades e vale para
 * **cada** recurso da lista: o Armazém no nível 1 guarda 1.000 de madeira e 1.000 de pedra.
 */
export type StorageDef = {
  readonly resources: readonly ResourceId[];
  /** Capacidade no nível 1. */
  readonly level1: number;
  /** O que cada nível acima do primeiro acrescenta. */
  readonly perLevel: number;
  /**
   * Onde esses recursos ficam enquanto o edifício não existe: "a despensa", "o pátio". Entra
   * nas frases no lugar do nome do edifício.
   */
  readonly unbuilt: { readonly label: string; readonly article: 'o' | 'a' };
};

/**
 * Troca de ofício e experiência do ofício (GDD §5.4; ADR 0013, decisões 1 e 13). Os prazos são
 * tempo de jogo e escalam com o ritmo.
 */
export type CraftDef = {
  /** Quanto dura a adaptação de quem acabou de chegar a um edifício, em tempo de jogo. */
  readonly adaptationMs: number;
  /** Quanto de um trabalhador adaptado vale quem ainda está em adaptação: 1/2 é metade. */
  readonly adaptationMultiplier: Ratio;
  /** Experiência que um edifício ocupado ganha a cada virada de dia de jogo. */
  readonly experiencePerDay: number;
  /** Experiência que um edifício vazio perde a cada virada de dia de jogo. */
  readonly experienceLossPerDay: number;
  readonly maxExperience: number;
  /** A mestria: o bônus de produção com a experiência no máximo. 3/10 é +30%. */
  readonly masteryBonus: Ratio;
  /**
   * Trabalhadores por nível do edifício para ele contar como ocupado na virada do dia: com 1,
   * a Serraria no nível 3 pede 3. Não é um limite de postos: cabem quantos o senhor mandar.
   */
  readonly occupiedWorkersPerLevel: number;
};

/** Uma faixa da moral: vale até `max`, inclusive, a partir do `max` da faixa anterior mais um. */
export type MoraleBandDef = {
  readonly id: MoraleBandId;
  readonly max: number;
  /** "Inquieto": como o cabeçalho a mostra. */
  readonly label: string;
};

/**
 * Moral (GDD §5.6 e §5.7; ADR 0013, decisões 1 e 19; ADR 0016, itens 2 e 3). Vai de 0 ao `max`
 * da última faixa e só muda na virada de cada dia de jogo: `base` mais os termos, limitada. Os
 * prazos são tempo de jogo e escalam com o ritmo, menos os três da deserção por fome
 * (`…RealMs`), que são **tempo real**: o motor os converte com o ritmo da partida.
 */
export type MoraleDef = {
  readonly base: number;
  /** A comida guardada: o estoque que cobre `coverMs` de consumo dos habitantes vale `bonus`. */
  readonly foodReserve: { readonly coverMs: number; readonly bonus: number };
  /** Com fome. */
  readonly famine: number;
  /** A mais, por dia de jogo inteiro de fome contínua. */
  readonly faminePerDay: number;
  /** Com tantos habitantes quantas vagas, ou mais. */
  readonly housingFull: number;
  /** Com frio (GDD §4.1). */
  readonly cold: number;
  /** O fator da moral na produção: `base + perPoint × moral`. Com 3/4 e 1/200, (150 + moral) / 200. */
  readonly multiplier: { readonly base: Ratio; readonly perPoint: Ratio };
  /** Da mais baixa à mais alta; o `max` da última é o máximo da moral. */
  readonly bands: readonly MoraleBandDef[];
  /** Na virada do dia, com a moral em `minMorale` ou mais e vaga nas casas: a chance de um colono chegar. */
  readonly arrival: { readonly minMorale: number; readonly chance: Ratio };
  /** Na virada do dia, com a moral em `maxMorale` ou menos: a chance de um aldeão partir. */
  readonly departure: { readonly maxMorale: number; readonly chance: Ratio };
  /** A carência da deserção: fome contínua, em tempo real, a partir da qual o primeiro aldeão deserta. */
  readonly famineDesertionAfterRealMs: number;
  /** O passo da deserção: depois da carência, mais um aldeão a cada tanto de fome, em tempo real. */
  readonly famineDesertionEveryRealMs: number;
  /**
   * A janela, em tempo real, em que a fome que reabre é a mesma que acabou: continua de onde
   * parou, com a duração e os desertores que já tinha. Passada a janela, a fome seguinte
   * começa do zero.
   */
  readonly famineResumeWithinRealMs: number;
  /** Nenhuma partida nem deserção deixa o feudo com menos aldeões do que isto. */
  readonly populationFloor: number;
};

/** Um ritmo que o jogador pode escolher ao criar a partida (GDD §4.2). */
export type PaceDef = {
  /** Horas de jogo por hora real. */
  readonly timeScale: number;
  readonly label: string;
  /** Quanto dura o ano em tempo real, pronto para "Rápido: um ano em 56 horas". */
  readonly description: string;
  /** Para quem é este ritmo, em uma frase. */
  readonly hint: string;
  readonly recommended: boolean;
};

/**
 * O Conselho do Feudo (GDD §7.1; ADR 0014, decisões 1 e 18). A cadência é tempo de jogo e escala
 * com o ritmo; o prazo de resposta é o único prazo de **tempo real** desta versão (`…RealMs`):
 * o motor o converte com o ritmo da partida no instante em que a carta chega.
 */
export type CouncilDef = {
  /** Dias de jogo entre um sorteio e o seguinte. A cadência é ancorada: anda sempre, sorteie ou não. */
  readonly drawIntervalDays: number;
  /** Quantas cartas podem esperar resposta ao mesmo tempo. */
  readonly maxPending: number;
  /** Quanto uma carta espera pela resposta, em tempo real, em qualquer ritmo. */
  readonly expiryRealMs: number;
};

/**
 * O que um nível da Torre de Vigia dá (GDD §6.1 e §8.2; ADR 0014, decisão 11; ADR 0016, item
 * 4). Com a Torre em qualquer nível a Ameaça aparece, com a explicação; cada nível diz com que
 * antecedência os vigias avisam de uma incursão e se já distinguem o tamanho dela.
 */
export type WatchtowerLevelDef = {
  /**
   * Antecedência do aviso de uma incursão, em **tempo real**, em qualquer ritmo: o motor a
   * converte com o ritmo da partida ao decidir o instante do aviso.
   */
  readonly warningRealMs: number;
  /** Os vigias dizem o tamanho da incursão que avisam. */
  readonly revealsRaidSize: boolean;
};

/**
 * O que um nível da Paliçada segura (GDD §6.1 e §8.2; ADR 0014, decisão 11). Uma incursão do
 * tamanho que o nível segura, ou menor, não tira nada do feudo: nem recurso, nem aldeão ferido.
 */
export type PalisadeLevelDef = {
  /** O maior tamanho de incursão que este nível segura inteiro. */
  readonly absorbs: RaidSizeId;
};

/**
 * A Ameaça (GDD §8.2; ADR 0014, decisões 10 e 11): um número de 0 a `max` que só muda na virada
 * de cada dia de jogo e só aparece para quem tem a Torre de Vigia. Os prazos são tempo de jogo e
 * escalam com o ritmo.
 */
export type ThreatDef = {
  readonly max: number;
  /** Quanto a Ameaça cai quando uma expedição limpa um tile de ameaça (ADR 0018, decisão 14). */
  readonly tileClearedDrop: number;
  /** Quanto cada tile de ameaça ativo soma a cada dia de jogo. */
  readonly perActiveTilePerDay: number;
  /** Quanto cada dia de jogo de uma estação soma a mais: no outono os lobos descem a serra. */
  readonly seasonPerDay: Partial<Record<SeasonId, number>>;
  /**
   * Quem desce sobre o feudo em uma estação que soma à Ameaça, **mesmo sem tile de ameaça
   * ativo**: no outono os lobos descem a serra, com o Covil limpo ou não (ADR 0018, decisão 14).
   * Só as estações de `seasonPerDay` podem estar aqui.
   */
  readonly seasonEnemy: Partial<Record<SeasonId, EnemyId>>;
  /**
   * As marcas que, cruzadas para cima, viram linha na Crônica de quem tem a Torre, em ordem
   * crescente: a Ameaça sobe todo dia, e a Crônica só fala dela nestes dois momentos.
   */
  readonly chronicleMarks: readonly number[];
  /** Acima disto, cada virada de dia pode trazer uma incursão: a chance é `Ameaça − este valor`, em %. */
  readonly raidChanceAbove: number;
  /** A partir disto a incursão sorteada é média; abaixo, leve. */
  readonly mediumRaidAbove: number;
  /** Quanto a Ameaça cai em toda incursão, repelida ou sofrida. */
  readonly raidDrop: number;
  /** Quanto tempo de jogo passa entre o sorteio de uma incursão e a chegada dela. */
  readonly raidLeadMs: number;
  /** Um item por nível da Torre de Vigia, a partir do nível 1. */
  readonly watchtowerLevels: readonly WatchtowerLevelDef[];
  /** Um item por nível da Paliçada, a partir do nível 1. */
  readonly palisadeLevels: readonly PalisadeLevelDef[];
  /**
   * A parte do estrago que passa quando a incursão é maior do que a Paliçada segura: a cerca
   * não a detém, mas ainda lhe tira a força. Vale para a perda de recursos e para os feridos.
   */
  readonly palisadeBreach: Ratio;
};

/** A incursão que o roteiro do ano 1 marca para todo feudo (GDD §8.2; ADR 0014, decisão 10). */
export type ScriptedRaidDef = {
  /** A ocorrência: é o `id` da incursão marcada no estado. */
  readonly id: string;
  readonly enemy: EnemyId;
  readonly size: RaidSizeId;
  /** O dia de jogo do ano 1 em cujo início ela chega: o primeiro dia é 1. */
  readonly atGameDay: number;
  /** O dia de jogo do ano 1 em cujo início soa o prenúncio, sem informação nenhuma. */
  readonly howlAtGameDay: number;
};

/** O que uma incursão de um tamanho custa a um feudo sem defesa (GDD §8.2). */
export type RaidDamageDef = {
  /** A parte do estoque que ela leva, de cada recurso da lista: 1/10 é 10%. */
  readonly lossRatio: Ratio;
  /** Os recursos que ela leva. */
  readonly resources: readonly ResourceId[];
  /** Quantos aldeões ela fere. */
  readonly injuries: number;
};

/**
 * As incursões (GDD §8.2 e §5.7; ADR 0014, decisões 10 e 20): a do roteiro, o que cada tamanho
 * custa e o que fica depois. Quando elas são sorteadas, com que antecedência a Torre avisa e o
 * que a Paliçada segura está em `threat`. Os prazos são tempo de jogo e escalam com o ritmo.
 */
export type RaidsDef = {
  /** As incursões do roteiro: só no ano 1, e só para quem ainda não passou do instante delas. */
  readonly scripted: readonly ScriptedRaidDef[];
  /** O estrago de cada inimigo, por tamanho, antes do que a Paliçada segura. */
  readonly damage: Record<EnemyId, Record<RaidSizeId, RaidDamageDef>>;
  /** Quanto tempo de jogo um ferido fica sem trabalhar. */
  readonly injuryMs: number;
  /** O que uma incursão com perdas tira da moral (negativo). */
  readonly moraleOnLosses: number;
  /** Por quantos dias de jogo. */
  readonly moraleLossDays: number;
  /** Como o termo aparece na conta da moral. */
  readonly moraleLabel: string;
};

/**
 * Heróis e soldo (GDD §9.1; ADR 0017, decisões 3, 5 e 7). O soldo é tempo de jogo e escala com
 * o ritmo; os quatro prazos do atraso (`…RealMs`) são **tempo real**, iguais em qualquer ritmo:
 * o motor os converte com o ritmo da partida.
 */
/**
 * A Taverna (GDD §5.7, §6.1 e §9.1; ADR 0017, decisões 4, 5 e 10). Tudo aqui é **tempo de jogo**
 * e escala com o ritmo. O custo e o prazo da obra estão em `buildings.tavern`; os modelos de
 * candidato e os nomes, em `tavernCandidates` e `heroNames`.
 */
export type TavernDef = {
  /** Quantos candidatos cada rotação traz, por nível da Taverna (o índice 0 é o nível 1). */
  readonly offersByLevel: readonly number[];
  /** De quanto em quanto tempo de jogo a lista de candidatos troca, a partir da inauguração. */
  readonly rotationMs: number;
  /** Moral permanente por nível da Taverna. */
  readonly moralePerLevel: number;
  /** Heróis que o feudo pode contratar a mais, por nível (somado a `heroes.limitBase`). */
  readonly heroLimitPerLevel: number;
  /** O festival, por ordem do senhor (`holdFestival`). */
  readonly festival: {
    readonly cost: ResourceAmounts;
    /** Moral somada enquanto o festival durar, como efeito temporário. */
    readonly morale: number;
    /** Quanto dura, em tempo de jogo: um número inteiro de dias de jogo. */
    readonly durationMs: number;
    /** O nome do termo na conta da moral. */
    readonly moraleLabel: string;
  };
};

export type HeroesDef = {
  /** Ouro por hora de jogo, por herói que recebe. */
  readonly wagePerHour: number;
  /** Quantos heróis o feudo contrata antes de ter a Taverna. */
  readonly limitBase: number;
  /**
   * O teto da lista de heróis no estado: nem a contratação nem uma recompensa (que o limite de
   * contratação não barra) põem no feudo mais heróis do que isto.
   */
  readonly rosterCap: number;
  /**
   * O teto da lista de heróis prometidos que ainda não chegaram (`guild.arriving`): os que uma
   * carta mandou vir depois e os que esperam lugar na lista cheia.
   */
  readonly arrivingCap: number;
  /** O soldo em atraso: o ouro acabou com soldo a pagar. */
  readonly arrears: {
    /** Atraso contínuo, em tempo real, a partir do qual quem não é Leal fica Descontente. */
    readonly discontentAfterRealMs: number;
    /** Atraso contínuo, em tempo real, a partir do qual o primeiro herói parte. */
    readonly leaveAfterRealMs: number;
    /** Depois disso, mais um herói a cada tanto de atraso, em tempo real. */
    readonly leaveEveryRealMs: number;
    /**
     * A janela, em tempo real, em que o atraso que reabre é o mesmo que fechou: continua de
     * onde parou, com a duração e os heróis que já tinha cobrado.
     */
    readonly resumeWithinRealMs: number;
    /** O fator do Descontente em todos os atributos, enquanto o atraso durar. */
    readonly discontentFactor: Ratio;
  };
  readonly maxLevel: number;
  /** Somado aos atributos a cada nível acima do primeiro, sem compor: 8/100 = +8%. */
  readonly levelBonus: Ratio;
  /**
   * Experiência para passar do nível `n` ao seguinte, a partir do nível 1: `100 × n^1,5`,
   * arredondado para baixo e **escrito número a número** (o motor não calcula potência
   * fracionária). Tem `maxLevel − 1` entradas.
   */
  readonly xpToNext: readonly number[];
  /** O poder de um herói: a soma dos atributos listados, cada um com o peso dele. */
  readonly power: Partial<Record<HeroAttributeId, Ratio>>;
};

/**
 * As expedições (GDD §9.2; ADR 0017, decisões 1, 7 e 9; ADR 0018, decisões 11 a 13). Os grafos
 * estão em `expeditionModels`; o fator de duração do verão, em `calendar.seasons[].effects`.
 */
export type ExpeditionsDef = {
  /**
   * Quanto a equipe espera a palavra do senhor em uma encruzilhada, em **tempo real**: igual em
   * qualquer ritmo, convertido quando a equipe chega ao nó.
   */
  readonly crossroadsWaitRealMs: number;
  /**
   * Os limiares do desfecho: a razão mínima entre `poder × sorte` e a dificuldade para cada um.
   * Abaixo do Revés é Desastre.
   */
  readonly outcome: Record<Exclude<ExpeditionOutcomeId, 'disaster'>, Ratio>;
  /** A sorte: um inteiro de `min` a `max`, uma vez por nó com dificuldade; `base` é o valor neutro. */
  readonly luck: { readonly min: number; readonly max: number; readonly base: number };
  /**
   * A parte do saque do nó que cada desfecho deixa a equipe trazer (pendência D-7): mais do que
   * o nó guarda no Sucesso Pleno, tudo no Sucesso, uma parte no Revés, nada no Desastre.
   */
  readonly lootShare: Record<ExpeditionOutcomeId, { readonly num: number; readonly den: number }>;
  /** A parte da experiência do nó que cada desfecho dá a quem continua na equipe: a derrota ensina. */
  readonly xpShare: Record<ExpeditionOutcomeId, Ratio>;
  /** Quantas expedições saem ao mesmo tempo em cada nível da Guilda dos Aventureiros. */
  readonly slotsByGuildLevel: readonly number[];
  /** Quantos relatórios de expedições concluídas o feudo guarda. */
  readonly reportsKept: number;
  /** Quantas variantes de grafo cada modelo tem. */
  readonly variantsPerModel: number;
  /** O maior número de heróis de uma equipe. */
  readonly teamMax: number;
  /**
   * Os limites de um grafo. A profundidade conta os nós que a equipe atravessa em um caminho,
   * com o retorno e sem as encruzilhadas; `maxSteps` conta todos, e é o teto do registro que a
   * expedição guarda no estado.
   */
  readonly graph: {
    readonly minDepth: number;
    readonly maxDepth: number;
    readonly maxSteps: number;
    readonly minNodeMs: number;
    readonly maxNodeMs: number;
  };
};

/**
 * Os ferimentos dos heróis (GDD §9.1; ADR 0017, decisão 8). Tempo de jogo: escala com o ritmo.
 * `harmWeight` é o peso de um herói comum no sorteio de quem sofre o desfecho; o traço que se
 * expõe mais traz o dele (`heroTraits[].effects.harmWeight`).
 */
export type InjuriesDef = {
  readonly durationMs: Record<InjurySeverityId, number>;
  readonly harmWeight: number;
};

/** O equipamento (GDD §9.1; ADR 0018, decisão 15): o teto do arsenal do feudo. */
export type EquipmentDef = {
  /** Quantos itens o arsenal guarda sem dono. O que passa disso vira ouro pelo valor do item. */
  readonly inventoryCap: number;
};

export type Balance = {
  readonly resources: Record<ResourceId, { readonly label: string }>;
  readonly initial: {
    readonly villagers: number;
    readonly resources: Record<ResourceId, number>;
  };
  readonly production: {
    /** Unidades por trabalhador por hora no nível 1. */
    readonly perWorkerPerHour: Record<ProductionBuildingId, number>;
    /** Bônus somado a cada nível acima do primeiro: 2/10 = +20%. */
    readonly levelBonus: Ratio;
  };
  readonly consumption: { readonly foodPerVillagerPerHour: number };
  readonly housing: { readonly capacityPerLevel: Partial<Record<BuildingId, number>> };
  readonly recruitment: {
    readonly cost: ResourceAmounts;
    readonly durationMs: number;
    readonly maxQueue: number;
    readonly maxPerOrder: number;
  };
  readonly construction: {
    readonly costFactor: Ratio;
    readonly costFactorByBuilding: Partial<Record<BuildingId, Ratio>>;
    readonly timeFactor: Ratio;
    readonly maxDurationMs: number;
    readonly cancelRefund: Ratio;
    /** Quantas filas de obras o feudo pode ter. A primeira existe desde o começo (GDD §6.3). */
    readonly queues: number;
    /** O nível do Salão que abre a segunda fila. */
    readonly secondQueueTownHallLevel: number;
    /** Um edifício nunca ultrapassa o nível do Salão mais este valor. */
    readonly gateLevelsAboveTownHall: number;
  };
  /**
   * Armazenamento (GDD §5.5): `cap = máx(baseCapacity, capacidade do edifício) × fator da
   * dificuldade`. Recurso que nenhum edifício guarda (o ouro) não tem limite.
   */
  readonly storage: {
    /** Capacidade de cada recurso guardado enquanto o edifício dele não existe. */
    readonly baseCapacity: number;
    readonly buildings: Partial<Record<BuildingId, StorageDef>>;
  };
  readonly famine: { readonly productionMultiplier: Ratio };
  readonly craft: CraftDef;
  readonly morale: MoraleDef;
  /** O frio: sem lenha em uma estação que a queima, a produção de todo o feudo cai (GDD §4.1). */
  readonly winter: { readonly cold: { readonly productionMultiplier: Ratio } };
  readonly calendar: { readonly dayMs: number; readonly seasons: readonly SeasonDef[] };
  readonly settlement: { readonly nameMinLength: number; readonly nameMaxLength: number };
  readonly objectives: { readonly maxActive: number };
  readonly difficulties: Record<DifficultyId, DifficultyDef>;
  /** Na ordem em que as boas-vindas os mostram. */
  readonly paces: readonly PaceDef[];
  readonly council: CouncilDef;
  readonly threat: ThreatDef;
  readonly raids: RaidsDef;
  readonly heroes: HeroesDef;
  readonly tavern: TavernDef;
  readonly expeditions: ExpeditionsDef;
  readonly injuries: InjuriesDef;
  readonly equipment: EquipmentDef;
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;

const SAME: Ratio = { num: 1, den: 1 };
const NO_FIREWOOD: Ratio = { num: 0, den: 1 };

// GDD §5.2, §5.3, §5.6 e §6.2. Todo número de jogo da v0.1 vive aqui ou em buildings.ts.
export const balance: Balance = {
  resources: {
    food: { label: 'Comida' },
    wood: { label: 'Madeira' },
    stone: { label: 'Pedra' },
    gold: { label: 'Ouro' },
  },
  initial: {
    villagers: 5,
    resources: { food: 180, wood: 120, stone: 65, gold: 250 },
  },
  production: {
    perWorkerPerHour: { farm: 10, lumberMill: 8, quarry: 5, goldMine: 4 },
    levelBonus: { num: 2, den: 10 },
  },
  consumption: { foodPerVillagerPerHour: 1 },
  housing: { capacityPerLevel: { townHall: 5, housing: 5 } },
  recruitment: {
    cost: { food: 50, gold: 10 },
    durationMs: 20 * MINUTE_MS,
    maxQueue: 5,
    maxPerOrder: 5,
  },
  construction: {
    costFactor: { num: 16, den: 10 },
    costFactorByBuilding: { townHall: { num: 18, den: 10 } },
    timeFactor: { num: 3, den: 2 },
    maxDurationMs: 8 * HOUR_MS,
    cancelRefund: { num: 8, den: 10 },
    // GDD §6.1 e §6.3 (ADR 0013, decisão 18): o Salão no nível 4 abre a segunda fila.
    queues: 2,
    secondQueueTownHallLevel: 4,
    gateLevelsAboveTownHall: 1,
  },
  // GDD §5.2 e §5.5 (ADR 0013, decisão 17).
  storage: {
    baseCapacity: 500,
    buildings: {
      granary: {
        resources: ['food'],
        level1: 1000,
        perLevel: 600,
        unbuilt: { label: 'Despensa', article: 'a' },
      },
      warehouse: {
        resources: ['wood', 'stone'],
        level1: 1000,
        perLevel: 600,
        unbuilt: { label: 'Pátio', article: 'o' },
      },
    },
  },
  famine: { productionMultiplier: { num: 3, den: 4 } },
  // GDD §5.3 e §5.4 (ADR 0013, decisões 1 e 13). A adaptação dura um dia de jogo: o teste de
  // conteúdo confere contra `calendar.dayMs`.
  craft: {
    adaptationMs: 2 * HOUR_MS,
    adaptationMultiplier: { num: 1, den: 2 },
    experiencePerDay: 4,
    experienceLossPerDay: 8,
    maxExperience: 100,
    masteryBonus: { num: 3, den: 10 },
    occupiedWorkersPerLevel: 1,
  },
  // GDD §5.6 e §5.7 (ADR 0013, decisões 1 e 19; ADR 0016, itens 2 e 3). 24 h de jogo de comida
  // são 12 dias de jogo. A deserção conta tempo real, em qualquer ritmo: 12 h de fome de
  // carência, depois um aldeão a cada 2 h; e a fome que reabre menos de 2 h depois de acabar é
  // a mesma. O teste de conteúdo confere as contas.
  morale: {
    base: 50,
    foodReserve: { coverMs: 24 * HOUR_MS, bonus: 10 },
    famine: -20,
    faminePerDay: -2,
    housingFull: -10,
    cold: -20,
    multiplier: { base: { num: 3, den: 4 }, perPoint: { num: 1, den: 200 } },
    bands: [
      { id: 'desperate', max: 24, label: 'Desesperado' },
      { id: 'restless', max: 49, label: 'Inquieto' },
      { id: 'content', max: 74, label: 'Contente' },
      { id: 'proud', max: 100, label: 'Orgulhoso' },
    ],
    arrival: { minMorale: 80, chance: { num: 1, den: 5 } },
    departure: { maxMorale: 25, chance: { num: 1, den: 5 } },
    famineDesertionAfterRealMs: 12 * HOUR_MS,
    famineDesertionEveryRealMs: 2 * HOUR_MS,
    famineResumeWithinRealMs: 2 * HOUR_MS,
    populationFloor: 3,
  },
  winter: { cold: { productionMultiplier: { num: 4, den: 5 } } },
  // GDD §4.1: a tabela de efeitos das estações, em frações.
  calendar: {
    dayMs: 2 * HOUR_MS,
    seasons: [
      {
        id: 'spring',
        label: 'Primavera',
        article: 'a',
        days: 24,
        effects: {
          production: { food: { num: 6, den: 5 }, wood: SAME, stone: SAME, gold: SAME },
          recruitmentDuration: { num: 4, den: 5 },
          constructionDuration: SAME,
          expeditionDuration: SAME,
          firewoodPerVillagerPerHour: NO_FIREWOOD,
        },
      },
      {
        id: 'summer',
        label: 'Verão',
        article: 'o',
        days: 24,
        effects: {
          production: {
            food: SAME,
            wood: { num: 23, den: 20 },
            stone: { num: 23, den: 20 },
            gold: SAME,
          },
          recruitmentDuration: SAME,
          constructionDuration: SAME,
          expeditionDuration: { num: 17, den: 20 },
          firewoodPerVillagerPerHour: NO_FIREWOOD,
        },
      },
      {
        id: 'autumn',
        label: 'Outono',
        article: 'o',
        days: 24,
        effects: {
          production: {
            food: { num: 13, den: 10 },
            wood: SAME,
            stone: SAME,
            gold: { num: 11, den: 10 },
          },
          recruitmentDuration: SAME,
          constructionDuration: SAME,
          expeditionDuration: SAME,
          firewoodPerVillagerPerHour: NO_FIREWOOD,
        },
      },
      {
        id: 'winter',
        label: 'Inverno',
        article: 'o',
        days: 12,
        effects: {
          production: {
            food: { num: 2, den: 5 },
            wood: { num: 4, den: 5 },
            stone: { num: 4, den: 5 },
            gold: SAME,
          },
          recruitmentDuration: SAME,
          constructionDuration: { num: 3, den: 2 },
          expeditionDuration: SAME,
          firewoodPerVillagerPerHour: { num: 1, den: 2 },
        },
      },
    ],
  },
  settlement: { nameMinLength: 2, nameMaxLength: 24 },
  objectives: { maxActive: 3 },
  // GDD §12.1, só com as linhas da v0.2 (ADR 0013, decisão 19a). O percentual de cada frase é
  // conferido contra o fator pelo teste de conteúdo.
  difficulties: {
    peasant: {
      label: 'Camponês',
      description:
        'O Celeiro e o Armazém guardam 25% a mais, ninguém deserta por fome e o Conselho, sem resposta sua, decide sem cobrar nada do feudo. Em expedição, seus heróis só se ferem.',
      recommended: false,
      storageCapacity: { num: 5, den: 4 },
      famineDesertion: false,
      heroCapture: 'injury',
    },
    lord: {
      label: 'Senhor',
      description:
        'O feudo como foi pensado: a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, decide sem cobrar nada do feudo. Em expedição, seus heróis podem ser capturados, e um resgate os traz de volta.',
      recommended: true,
      storageCapacity: { num: 1, den: 1 },
      famineDesertion: true,
      heroCapture: 'capture',
    },
    ironKing: {
      label: 'Rei de Ferro',
      description:
        'O Celeiro e o Armazém guardam 20% a menos, a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, escolhe o caminho mais duro. Em expedição, seus heróis podem morrer.',
      recommended: false,
      storageCapacity: { num: 4, den: 5 },
      famineDesertion: true,
      heroCapture: 'death',
    },
  },
  // GDD §4.2 (ADR 0013, decisão 2). A descrição é a conta "ano de jogo ÷ ritmo", conferida pelo
  // teste de conteúdo: mudar o calendário ou um ritmo sem mudar a frase quebra o teste.
  paces: [
    {
      timeScale: 3,
      label: 'Rápido',
      description: 'um ano em 56 horas',
      hint: 'Para quem volta várias vezes ao dia e quer ver o inverno ainda nesta semana.',
      recommended: true,
    },
    {
      timeScale: 1,
      label: 'Normal',
      description: 'um ano em 7 dias',
      hint: 'Uma semana, um ano: para quem passa pelo feudo duas ou três vezes por dia.',
      recommended: false,
    },
    {
      timeScale: 0.5,
      label: 'Tranquilo',
      description: 'um ano em 14 dias',
      hint: 'Para quem abre o jogo uma vez por dia: o feudo anda devagar e espera por você.',
      recommended: false,
    },
  ],
  // GDD §7.1 (ADR 0014, decisões 1 e 18): um sorteio a cada 4 dias de jogo, no máximo 2 cartas
  // à espera, e 24 h reais para responder, em qualquer ritmo.
  council: {
    drawIntervalDays: 4,
    maxPending: 2,
    expiryRealMs: 24 * HOUR_MS,
  },
  // GDD §8.2 (ADR 0014, decisões 10 e 11): a subida, o sorteio da incursão (a chance é a Ameaça
  // menos `raidChanceAbove`, em %), o tamanho, a queda, o prazo até ela chegar, a Torre e a
  // Paliçada. O que cada incursão custa está em `raids`. O aviso da Torre é tempo real (ADR
  // 0016, item 4): 1 h no nível 1 e 2 h no nível 2, em qualquer ritmo.
  //
  // A subida, a queda e o limiar da média foram reequilibrados depois da revisão das Fases D e E
  // (eram +5, −10 e 60): com eles a Ameaça subia até 90-100 e ficava, e toda incursão sorteada
  // era média. Com +2, −35 e 70 ela oscila entre a calmaria e a marca dos 40, quase toda
  // incursão é leve, e as médias vêm com o outono (docs/balance-v0.2.md, seção 16).
  threat: {
    max: 100,
    tileClearedDrop: 30,
    perActiveTilePerDay: 2,
    seasonPerDay: { autumn: 3 },
    seasonEnemy: { autumn: 'wolves' },
    chronicleMarks: [40, 70],
    raidChanceAbove: 40,
    mediumRaidAbove: 70,
    raidDrop: 35,
    raidLeadMs: 6 * HOUR_MS,
    watchtowerLevels: [
      { warningRealMs: 1 * HOUR_MS, revealsRaidSize: false },
      { warningRealMs: 2 * HOUR_MS, revealsRaidSize: true },
    ],
    palisadeLevels: [{ absorbs: 'light' }, { absorbs: 'medium' }],
    palisadeBreach: { num: 1, den: 2 },
  },
  // GDD §8.2 e §5.7 (ADR 0014, decisões 10 e 20). Os uivos soam no início do 10º dia de jogo do
  // ano 1 e os lobos chegam no início do 16º (30 h de jogo). O ferido fica de cama um dia de
  // jogo: o teste de conteúdo confere contra `calendar.dayMs`.
  raids: {
    scripted: [
      { id: 'wolvesYear1', enemy: 'wolves', size: 'light', atGameDay: 16, howlAtGameDay: 10 },
    ],
    damage: {
      wolves: {
        light: { lossRatio: { num: 1, den: 10 }, resources: ['food', 'wood'], injuries: 1 },
        medium: { lossRatio: { num: 3, den: 20 }, resources: ['food', 'wood'], injuries: 2 },
      },
    },
    injuryMs: 2 * HOUR_MS,
    moraleOnLosses: -10,
    moraleLossDays: 2,
    moraleLabel: 'Incursão sofrida',
  },
  // GDD §9.1 (ADR 0017, decisões 3, 5 e 7). O soldo é de 2 de ouro por hora de jogo por herói.
  // Os prazos do atraso contam tempo real, em qualquer ritmo: 12 h para o Descontente, 24 h
  // para o primeiro herói partir, depois um a cada 2 h; e o atraso que reabre menos de 2 h
  // depois de fechar é o mesmo. O poder é ataque + defesa + vida ÷ 10. A tabela de experiência
  // é 100 × n^1,5, arredondado para baixo: o teste de conteúdo confere número a número.
  heroes: {
    wagePerHour: 2,
    limitBase: 1,
    rosterCap: 12,
    arrivingCap: 4,
    arrears: {
      discontentAfterRealMs: 12 * HOUR_MS,
      leaveAfterRealMs: 24 * HOUR_MS,
      leaveEveryRealMs: 2 * HOUR_MS,
      resumeWithinRealMs: 2 * HOUR_MS,
      discontentFactor: { num: 4, den: 5 },
    },
    maxLevel: 10,
    levelBonus: { num: 8, den: 100 },
    xpToNext: [100, 282, 519, 800, 1118, 1469, 1852, 2262, 2700],
    power: { attack: SAME, defense: SAME, health: { num: 1, den: 10 } },
  },
  // GDD §5.7, §6.1 e §9.1 (ADR 0017, decisões 4, 5 e 10). 24 h de jogo são 12 dias de jogo: a
  // rotação e o festival duram o mesmo, um dia real no Normal e 8 h no Rápido. O teste de
  // conteúdo confere as contas contra `calendar.dayMs` e a lista contra `buildings.tavern`.
  tavern: {
    offersByLevel: [2, 2, 3, 3, 3],
    rotationMs: 24 * HOUR_MS,
    moralePerLevel: 5,
    heroLimitPerLevel: 1,
    festival: {
      cost: { food: 100, gold: 50 },
      morale: 15,
      durationMs: 24 * HOUR_MS,
      moraleLabel: 'Festival na Taverna',
    },
  },
  // GDD §9.2 (ADR 0017, decisões 1 e 7; ADR 0018, decisões 11 a 13). A espera da encruzilhada é
  // de 6 h reais em qualquer ritmo. O desfecho compara `poder × sorte` com a dificuldade: 1,3
  // para o Sucesso Pleno, 1 para o Sucesso, 0,7 para o Revés. O Sucesso Pleno traz o saque do nó
  // e mais um quarto, o Sucesso, o saque, o Revés, metade, e o Desastre, nada; a experiência
  // segue as mesmas partes, mas o Desastre ainda ensina um quarto. A Guilda sustenta 1, 2, 2 e 3
  // expedições. Um caminho tem de 2 a 5 nós (a Patrulha tem 2), cada um de 5 a 60 minutos de jogo
  // (o Pântano Nebuloso tem cinco nós em cinco horas; pendência D-5).
  expeditions: {
    crossroadsWaitRealMs: 6 * HOUR_MS,
    outcome: {
      full: { num: 13, den: 10 },
      success: SAME,
      setback: { num: 7, den: 10 },
    },
    luck: { min: 85, max: 115, base: 100 },
    lootShare: {
      full: { num: 5, den: 4 },
      success: SAME,
      setback: { num: 1, den: 2 },
      disaster: { num: 0, den: 1 },
    },
    xpShare: {
      full: { num: 5, den: 4 },
      success: SAME,
      setback: { num: 1, den: 2 },
      disaster: { num: 1, den: 4 },
    },
    slotsByGuildLevel: [1, 2, 2, 3],
    reportsKept: 3,
    variantsPerModel: 3,
    teamMax: 4,
    graph: {
      minDepth: 2,
      maxDepth: 5,
      maxSteps: 8,
      minNodeMs: 5 * MINUTE_MS,
      maxNodeMs: 60 * MINUTE_MS,
    },
  },
  // GDD §9.1 (ADR 0017, decisão 8): o ferimento leve dura 2 h de jogo e o grave, 12 h de jogo.
  // No sorteio de quem sofre o desfecho, um herói comum pesa 5; o Corajoso pesa 6.
  injuries: {
    durationMs: { light: 2 * HOUR_MS, severe: 12 * HOUR_MS },
    harmWeight: 5,
  },
  // GDD §9.1 (ADR 0018, decisão 15): o arsenal guarda 30 itens.
  equipment: { inventoryCap: 30 },
};
