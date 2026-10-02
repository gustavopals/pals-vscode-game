import type {
  BuildingId,
  DifficultyId,
  ProductionBuildingId,
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

export type Balance = {
  readonly resources: Record<ResourceId, { readonly label: string }>;
  readonly initial: {
    readonly villagers: number;
    readonly resources: Record<ResourceId, number>;
    readonly buildingLevel: number;
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
    readonly queues: number;
    /** Um edifício nunca ultrapassa o nível do Salão mais este valor. */
    readonly gateLevelsAboveTownHall: number;
  };
  readonly famine: { readonly productionMultiplier: Ratio };
  /** O frio: sem lenha em uma estação que a queima, a produção de todo o feudo cai (GDD §4.1). */
  readonly winter: { readonly cold: { readonly productionMultiplier: Ratio } };
  readonly calendar: { readonly dayMs: number; readonly seasons: readonly SeasonDef[] };
  readonly settlement: { readonly nameMinLength: number; readonly nameMaxLength: number };
  readonly objectives: { readonly maxActive: number };
  readonly difficulties: Record<DifficultyId, DifficultyDef>;
  /** Na ordem em que as boas-vindas os mostram. */
  readonly paces: readonly PaceDef[];
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
    buildingLevel: 1,
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
    queues: 1,
    gateLevelsAboveTownHall: 1,
  },
  famine: { productionMultiplier: { num: 3, den: 4 } },
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
        'O Celeiro e o Armazém guardam 25% a mais, ninguém deserta por fome e o Conselho, sem resposta sua, escolhe o melhor caminho.',
      recommended: false,
      storageCapacity: { num: 5, den: 4 },
      famineDesertion: false,
    },
    lord: {
      label: 'Senhor',
      description:
        'O feudo como foi pensado: a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, decide com cautela.',
      recommended: true,
      storageCapacity: { num: 1, den: 1 },
      famineDesertion: true,
    },
    ironKing: {
      label: 'Rei de Ferro',
      description:
        'O Celeiro e o Armazém guardam 20% a menos, a fome longa faz aldeões desertarem e o Conselho, sem resposta sua, escolhe o pior caminho.',
      recommended: false,
      storageCapacity: { num: 4, den: 5 },
      famineDesertion: true,
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
};
