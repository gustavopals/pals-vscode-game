import { balance } from './balance';
import type { HordeUnitId, LineId, Ratio, ResourceId, SeasonId, WingId } from './ids';

/**
 * As incursões como batalha (GDD §8.2 `[v0.4]`; ADR 0019, decisão 14; ADR 0020, decisões 15, 16 e
 * 18). **Conteúdo que o motor ainda não lê** (V4E-T2.1): as incursões de hoje seguem as regras de
 * `balance.raids` e `balance.threat`; a V4E-T2.3 liga estas.
 *
 * Os tamanhos são três (leve, média e forte). `RAID_SIZE_IDS` continua com dois até o estado 32
 * (a incursão marcada guarda o tamanho), e por isso a lista com o forte mora aqui.
 * A composição por estação são os pesos de `hordeBaseMix` (Apêndice A); o inverno usa a do
 * outono até o cerco (Fase F).
 */
export const WAR_RAID_SIZE_IDS = ['light', 'medium', 'strong'] as const;
export type WarRaidSizeId = (typeof WAR_RAID_SIZE_IDS)[number];

/** O que uma incursão leva quando a batalha deixa a horda passar (a regra da v0.2, por tamanho). */
export type WarRaidLossDef = {
  /** A parte do estoque que ela leva se passar inteira; a parte que passou escala isto. */
  readonly lossRatio: Ratio;
  readonly resources: readonly ResourceId[];
  /** Os aldeões que ela fere se passar inteira. */
  readonly injuries: number;
};

/** A incursão do roteiro do ano 1 (a do ensaio do cerco é a do 61º dia). */
export type WarScriptedRaidDef = {
  /** É o `id` da incursão marcada no estado. */
  readonly id: string;
  readonly size: WarRaidSizeId;
  /** O dia de jogo do ano 1 em cujo início ela chega (o "dia 3", "4" e "6" do ritmo Normal). */
  readonly atGameDay: number;
  /** O ensaio do cerco: na Hora da Vigília (V4G-T1); até lá, o início do dia marcado. */
  readonly rehearsal: boolean;
};

export type WarRaidsDef = {
  /** Quanto vale a incursão de cada tamanho, em pontos de tropa (ver `unitCost`). */
  readonly sizeBudget: Record<WarRaidSizeId, number>;
  /**
   * Ameaça a partir da qual a incursão é média ou forte, por estação. O leve é o que está abaixo
   * da média. 101 significa que a estação nunca traz o forte.
   */
  readonly thresholds: Record<SeasonId, { readonly medium: number; readonly strong: number }>;
  /** A parte do orçamento de cada posto do campo, em percentuais que somam 100. */
  readonly postShares: Record<WingId, Record<LineId, number>>;
  /** O custo de um inimigo no orçamento: os fortes valem menos soldados. */
  readonly unitCost: Record<HordeUnitId, number>;
  readonly scripted: readonly WarScriptedRaidDef[];
  readonly losses: Record<WarRaidSizeId, WarRaidLossDef>;
  /** O que os vigias contam de um bando, por tipo e tamanho (entra depois de "contam"). */
  readonly bandSizes: Record<
    'raider' | 'banditArcher' | 'wolf' | 'mixed',
    Record<WarRaidSizeId, string>
  >;
};

export const warRaids: WarRaidsDef = {
  sizeBudget: { light: 24, medium: 40, strong: 64 },
  thresholds: {
    spring: { medium: 70, strong: 101 },
    summer: { medium: 70, strong: 95 },
    autumn: { medium: 70, strong: 85 },
    winter: { medium: 70, strong: 80 },
  },
  postShares: balance.battle.previewEnemy.shares,
  unitCost: {
    wolf: 1,
    raider: 1,
    banditArcher: 1,
    blackKnight: 2,
    ogre: 4,
    skeleton: 1,
    shaman: 1,
    warlord: 12,
  },
  scripted: [
    { id: 'raidersYear1Weak', size: 'light', atGameDay: 25, rehearsal: false },
    { id: 'raidersYear1Medium', size: 'medium', atGameDay: 37, rehearsal: false },
    { id: 'raidersYear1Rehearsal', size: 'strong', atGameDay: 61, rehearsal: true },
  ],
  losses: {
    light: { lossRatio: { num: 1, den: 10 }, resources: ['food', 'wood'], injuries: 1 },
    medium: { lossRatio: { num: 3, den: 20 }, resources: ['food', 'wood'], injuries: 2 },
    strong: { lossRatio: { num: 1, den: 5 }, resources: ['food', 'wood'], injuries: 3 },
  },
  bandSizes: {
    raider: {
      light: 'um punhado de saqueadores',
      medium: 'um bando de saqueadores',
      strong: 'uma horda de saqueadores',
    },
    banditArcher: {
      light: 'meia dúzia de bandoleiros',
      medium: 'uma companhia de bandoleiros',
      strong: 'um exército de bandoleiros',
    },
    wolf: {
      light: 'uma matilha pequena',
      medium: 'uma matilha grande',
      strong: 'uma alcateia inteira',
    },
    mixed: {
      light: 'uma pequena tropa de saqueadores',
      medium: 'uma tropa numerosa, de armas variadas',
      strong: 'uma hoste de guerra',
    },
  },
};
