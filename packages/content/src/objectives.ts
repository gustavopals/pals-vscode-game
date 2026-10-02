import type { BuildingId, ProductionBuildingId, ResourceAmounts, SeasonId } from './ids';

export const OBJECTIVE_CONDITION_TYPES = [
  'workersAtLeast',
  'constructionStarted',
  'villagersRecruited',
  'buildingLevel',
  'anyBuildingLevel',
  'cardAnswered',
  'plannedAutoStart',
  'seasonSurvived',
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
  | { readonly type: 'seasonSurvived'; readonly season: SeasonId; readonly count: number };

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
  /**
   * Recompensa que não é recurso, pronta para entrar depois de "Recompensa:" e ao lado de
   * "+20 ouro": começa em minúscula e não tem ponto final.
   */
  readonly rewardText?: string;
};

// GDD §12.2, na ordem em que são revelados. Os de 1 a 4 são os da v0.1 e não mudam de id; os de
// 5 a 10 são os da v0.2 (ADR 0014, decisão 12): cada um ensina uma ferramenta nova, e nenhum
// depende de herói nem de soldado. O id é o que fica gravado nas partidas: nunca se troca.
// O objetivo 4 recompensa o desbloqueio, como no GDD: na v0.1 dava +50 ouro, porque os edifícios
// ainda não existiam (ADR 0002). Quem libera a obra é o Salão no nível 2 (`requires`, em
// buildings.ts), que é a própria condição do objetivo.
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
    reward: {},
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
];
