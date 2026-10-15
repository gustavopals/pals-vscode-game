import type { BuildingId, ItemId, ProductionBuildingId, ResourceAmounts, SeasonId } from './ids';

export const OBJECTIVE_CONDITION_TYPES = [
  'workersAtLeast',
  'constructionStarted',
  'villagersRecruited',
  'buildingLevel',
  'anyBuildingLevel',
  'cardAnswered',
  'plannedAutoStart',
  'seasonSurvived',
  'heroCount',
  'expeditionSent',
  'tradeDone',
  'crossroadsChosen',
  'expeditionCompleted',
] as const;

export type ObjectiveCondition =
  | {
      readonly type: 'workersAtLeast';
      readonly building: ProductionBuildingId;
      readonly count: number;
    }
  | { readonly type: 'constructionStarted'; readonly building: BuildingId }
  | { readonly type: 'villagersRecruited'; readonly count: number }
  | { readonly type: 'buildingLevel'; readonly building: BuildingId; readonly level: number }
  /** Um de vários edifícios no nível pedido: basta o primeiro que chegar lá. */
  | {
      readonly type: 'anyBuildingLevel';
      readonly buildings: readonly BuildingId[];
      readonly level: number;
    }
  /** Cartas do Conselho respondidas pelo jogador. A que expira e o conselho decide não conta. */
  | { readonly type: 'cardAnswered'; readonly count: number }
  /** Uma obra planejada marcada para começar sozinha, nem que comece na mesma ordem. */
  | { readonly type: 'plannedAutoStart' }
  /**
   * A estação atravessada inteira, do primeiro ao último dia, sem o feudo passar frio. Só conta
   * a estação acompanhada desde o primeiro instante: a que já estava em curso quando a regra
   * chegou não vale pela metade.
   */
  | { readonly type: 'seasonSurvived'; readonly season: SeasonId; readonly count: number }
  /** Heróis no feudo (v0.3), contando quem está em expedição, ferido ou em recuperação. */
  | { readonly type: 'heroCount'; readonly count: number }
  /** Expedições enviadas ao modelo (`expeditionModels[].id`). */
  | { readonly type: 'expeditionSent'; readonly model: string; readonly count: number }
  /** Ordens de venda aceitas no Mercado, de qualquer recurso (as unidades vendidas, somadas). */
  | { readonly type: 'tradeDone'; readonly direction: 'sell'; readonly count: number }
  /** Escolhas feitas pelo **jogador** em encruzilhadas: a decidida pela Postura não conta. */
  | { readonly type: 'crossroadsChosen'; readonly count: number }
  /** Expedições ao modelo que voltaram para casa (a recolhida antes do fim não conta). */
  | { readonly type: 'expeditionCompleted'; readonly model: string; readonly count: number };

/**
 * Recompensa em moral: um efeito temporário, que entra na conta da moral nas próximas
 * `durationDays` viradas de dia de jogo (GDD §5.7). `label` é o nome do termo nessa conta.
 */
export type ObjectiveMoraleReward = {
  readonly amount: number;
  readonly durationDays: number;
  readonly label: string;
};

export type ObjectiveDef = {
  readonly id: string;
  readonly title: string;
  /** O "porquê" do objetivo: é ele que ensina (GDD §12.2). */
  readonly hint: string;
  readonly condition: ObjectiveCondition;
  /** Recursos creditados na conclusão; vazio quando a recompensa é moral ou só o que `rewardText` diz. */
  readonly reward: ResourceAmounts;
  /** Moral dada na conclusão, por alguns dias de jogo. */
  readonly morale?: ObjectiveMoraleReward;
  /** Item dado ao arsenal na conclusão (v0.3); com o arsenal cheio, vira ouro (decisão 15). */
  readonly item?: ItemId;
  /**
   * Recompensa que não é recurso, pronta para entrar depois de "Recompensa:" e ao lado de
   * "+20 ouro": começa em minúscula e não tem ponto final.
   */
  readonly rewardText?: string;
};

// GDD §12.2, na ordem em que são revelados. Os de 1 a 4 são os da v0.1 e não mudam de id; os de
// 5 a 10 são os da v0.2 (ADR 0014, decisão 12): cada um ensina uma ferramenta nova, e nenhum
// depende de herói nem de soldado. O id é o que fica gravado nas partidas: nunca se troca.
// O objetivo 4 recompensa o desbloqueio e mais 50 de ouro (ADR 0016, item 7): na v0.1 dava só o
// ouro, porque os edifícios ainda não existiam (ADR 0002), e a v0.2 nasceu só com o desbloqueio.
// Quem libera a obra é o Salão no nível 2 (`requires`, em buildings.ts), que é a própria condição
// do objetivo. Quem já tinha cumprido o objetivo antes da volta do ouro não recebe nada depois.
export const objectives: readonly ObjectiveDef[] = [
  {
    id: 'allocateFarmers',
    title: 'Aloque 2 aldeões na Fazenda',
    hint: 'Comida é o que mantém todo o resto.',
    condition: { type: 'workersAtLeast', building: 'farm', count: 2 },
    reward: { gold: 20 },
  },
  {
    id: 'upgradeHousing',
    title: 'Inicie a melhoria das Habitações',
    hint: 'Sem teto, ninguém vem morar no feudo.',
    condition: { type: 'constructionStarted', building: 'housing' },
    reward: { wood: 30 },
  },
  {
    id: 'recruitVillagers',
    title: 'Recrute 3 aldeões',
    hint: 'Mais braços, mais colheita, mais madeira.',
    condition: { type: 'villagersRecruited', count: 3 },
    reward: { food: 40 },
  },
  {
    id: 'townHallLevel2',
    title: 'Alcance o Salão do Senhor Nv2',
    hint: 'O Salão dita até onde os outros edifícios podem crescer.',
    condition: { type: 'buildingLevel', building: 'townHall', level: 2 },
    reward: { gold: 50 },
    rewardText: 'desbloqueia o Celeiro, o Armazém e a Torre de Vigia',
  },
  {
    id: 'buildWatchtower',
    title: 'Construa a Torre de Vigia',
    hint: 'Ver o inimigo é metade da batalha.',
    condition: { type: 'buildingLevel', building: 'watchtower', level: 1 },
    reward: { stone: 40 },
  },
  {
    id: 'answerFirstCard',
    title: 'Responda à primeira carta do Conselho',
    hint: 'Quem se cala deixa o conselho decidir em seu lugar.',
    condition: { type: 'cardAnswered', count: 1 },
    reward: {},
    morale: { amount: 10, durationDays: 1, label: 'O Senhor ouviu o Conselho' },
  },
  {
    id: 'buildGranaryOrWarehouse',
    title: 'Construa o Celeiro ou o Armazém',
    hint: 'Amplie o estoque antes que a produção vá para o chão.',
    condition: { type: 'anyBuildingLevel', buildings: ['granary', 'warehouse'], level: 1 },
    reward: { wood: 60 },
  },
  {
    id: 'planAutoStart',
    title: 'Deixe uma obra marcada para começar sozinha',
    hint: 'A obra marcada começa assim que houver recursos, mesmo com o Senhor longe.',
    condition: { type: 'plannedAutoStart' },
    reward: { gold: 30 },
  },
  {
    id: 'buildPalisade',
    title: 'Construa a Paliçada',
    hint: 'Estaca firme faz o lobo recuar de barriga vazia.',
    condition: { type: 'buildingLevel', building: 'palisade', level: 1 },
    reward: { wood: 100 },
  },
  {
    id: 'surviveWinterWithoutCold',
    title: 'Atravesse o inverno sem passar frio',
    hint: 'A lareira queima madeira o inverno inteiro: guarde lenha no outono.',
    condition: { type: 'seasonSurvived', season: 'winter', count: 1 },
    reward: {},
    morale: { amount: 15, durationDays: 1, label: 'Inverno sem frio' },
  },
  // Os da v0.3 (ADR 0018, decisão 20): cada um aparece quando a ferramenta nova resolve um problema
  // já sentido. Os de exército continuam fora, sem buraco na sequência.
  {
    id: 'welcomeFirstHero',
    title: 'Acolha ou contrate o primeiro herói',
    hint: 'Quem sai do feudo por ele volta com o que o feudo não produz.',
    condition: { type: 'heroCount', count: 1 },
    reward: {},
    item: 'huntingSpear',
  },
  {
    id: 'buildGuild',
    title: 'Erga a Guilda dos Aventureiros',
    hint: 'Quem recebe soldo precisa de trabalho: sem a Guilda, o herói só custa ouro.',
    condition: { type: 'buildingLevel', building: 'guild', level: 1 },
    reward: { stone: 60 },
  },
  {
    id: 'sendPatrol',
    title: 'Envie uma Patrulha',
    hint: 'A Patrulha é a saída mais curta e de menor risco: quem volta traz notícia dos caminhos.',
    condition: { type: 'expeditionSent', model: 'patrol', count: 1 },
    reward: { gold: 50 },
  },
  {
    id: 'sellSurplus',
    title: 'Venda no Mercado o que iria para o chão',
    hint: 'O que passa do depósito se perde; o que se vende vira ouro.',
    condition: { type: 'tradeDone', direction: 'sell', count: 1 },
    reward: { wood: 40 },
  },
  {
    id: 'chooseAtCrossroads',
    title: 'Escolha um caminho em uma encruzilhada',
    hint: 'A Postura decide por quem se cala; quem escolhe sabe o que arrisca.',
    condition: { type: 'crossroadsChosen', count: 1 },
    reward: {},
    morale: { amount: 10, durationDays: 1, label: 'O Senhor escolheu o caminho' },
  },
  {
    id: 'exploreRuins',
    title: "Explore as Ruínas de Vel'Thar",
    hint: 'O que dorme nas ruínas não se acha em mais parte nenhuma.',
    condition: { type: 'expeditionCompleted', model: 'ruins', count: 1 },
    reward: {},
    item: 'ashBow',
  },
];
