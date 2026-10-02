import type { BuildingId, ProductionBuildingId, ResourceAmounts } from './ids';

export const OBJECTIVE_CONDITION_TYPES = [
  'workersAtLeast',
  'constructionStarted',
  'villagersRecruited',
  'buildingLevel',
] as const;

export type ObjectiveCondition =
  | {
      readonly type: 'workersAtLeast';
      readonly building: ProductionBuildingId;
      readonly count: number;
    }
  | { readonly type: 'constructionStarted'; readonly building: BuildingId }
  | { readonly type: 'villagersRecruited'; readonly count: number }
  | { readonly type: 'buildingLevel'; readonly building: BuildingId; readonly level: number };

export type ObjectiveDef = {
  readonly id: string;
  readonly title: string;
  /** O "porquê" do objetivo: é ele que ensina (GDD §12.2). */
  readonly hint: string;
  readonly condition: ObjectiveCondition;
  /** Recursos creditados na conclusão; vazio quando a recompensa é só o que `rewardText` diz. */
  readonly reward: ResourceAmounts;
  /**
   * Recompensa que não é recurso, pronta para entrar depois de "Recompensa:" e ao lado de
   * "+20 ouro": começa em minúscula e não tem ponto final.
   */
  readonly rewardText?: string;
};

// GDD §12.2, objetivos 1 a 4, na ordem em que são revelados.
// O objetivo 4 recompensa o desbloqueio, como no GDD: na v0.1 dava +50 ouro, porque os edifícios
// ainda não existiam (ADR 0002). Quem libera a obra é o Salão no nível 2 (`requires`, em
// buildings.ts), que é a própria condição do objetivo; a Torre de Vigia entra na frase com ela.
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
    rewardText: 'desbloqueia o Celeiro e o Armazém',
  },
];
