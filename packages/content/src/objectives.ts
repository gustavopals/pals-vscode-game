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
  readonly reward: ResourceAmounts;
};

// GDD §12.2, objetivos 1 a 4, na ordem em que são revelados.
// O objetivo 4 recompensa ouro na v0.1 porque Celeiro, Armazém e Torre só chegam na v0.2 (ADR 0002).
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
  },
];
