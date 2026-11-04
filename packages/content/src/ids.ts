/**
 * Os recursos (GDD §5.1), na ordem canônica. O ferro (V4B-T1; ADR 0019, decisão 3) entra no fim,
 * depois do ouro, para a ordem dos que já existiam não mudar em nenhuma conta nem em tela.
 */
export const RESOURCE_IDS = ['food', 'wood', 'stone', 'gold', 'iron'] as const;
export type ResourceId = (typeof RESOURCE_IDS)[number];

export const BUILDING_IDS = [
  'townHall',
  'farm',
  'lumberMill',
  'quarry',
  'goldMine',
  'housing',
  'granary',
  'warehouse',
  'watchtower',
  'palisade',
  'tavern',
  'guild',
  'market',
  'smithy',
  'barracks',
] as const;
export type BuildingId = (typeof BUILDING_IDS)[number];

/**
 * As unidades que o Quartel treina (GDD §10.2; ADR 0019, decisão 7), na ordem da tabela. O
 * Miliciano (§11.3) é da Fase G e não está aqui. A lista fica gravada no estado
 * (`army.units`): mudar um identificador pede passo de migração.
 */
export const UNIT_IDS = ['spearman', 'swordsman', 'archer', 'knight', 'shieldbearer'] as const;
export type UnitId = (typeof UNIT_IDS)[number];

/**
 * Os inimigos da Horda (GDD §10.3), na ordem da tabela. Ficam gravados nos relatórios de batalha
 * (V4D-T1.5): mudar um identificador pede passo de migração.
 */
export const HORDE_UNIT_IDS = [
  'wolf',
  'raider',
  'banditArcher',
  'blackKnight',
  'ogre',
  'skeleton',
  'shaman',
  'warlord',
] as const;
export type HordeUnitId = (typeof HORDE_UNIT_IDS)[number];

/**
 * As três alas do campo de batalha (GDD §10.1), da esquerda para a direita, e as duas linhas de
 * cada ala (a mesma `UnitLine` das unidades: `front` e `back`). Uma formação salva (V4C-T2; ADR
 * 0019, decisões 8 e 9) tem um posto em cada ala e linha; as listas ficam gravadas no estado
 * (`army.formations`): mudar um identificador pede passo de migração.
 */
export const WING_IDS = ['left', 'center', 'right'] as const;
export type WingId = (typeof WING_IDS)[number];
export const LINE_IDS = ['front', 'back'] as const;
export type LineId = (typeof LINE_IDS)[number];

/**
 * O que o Mercado negocia por ouro (GDD §5.9; ADR 0018, decisão 16), **na ordem do sorteio** do
 * preço de cada dia. O ferro entrou na v0.4 (V4B-T1; ADR 0019, decisão 3), por último: o sorteio
 * de cada virada passa a ser comida, madeira, pedra e ferro. A lista fica gravada no estado
 * (`market.prices`): mudar um identificador pede passo de migração.
 */
export const MARKET_RESOURCE_IDS = ['food', 'wood', 'stone', 'iron'] as const;
export type MarketResourceId = (typeof MARKET_RESOURCE_IDS)[number];

/** Os dois sentidos de uma negociação no Mercado: comprar com ouro, ou vender por ouro. */
export const TRADE_DIRECTION_IDS = ['buy', 'sell'] as const;
export type TradeDirectionId = (typeof TRADE_DIRECTION_IDS)[number];

export const PRODUCTION_BUILDING_IDS = ['farm', 'lumberMill', 'quarry', 'goldMine'] as const;
export type ProductionBuildingId = (typeof PRODUCTION_BUILDING_IDS)[number];

export const SEASON_IDS = ['spring', 'summer', 'autumn', 'winter'] as const;
export type SeasonId = (typeof SEASON_IDS)[number];

/** Dificuldades do GDD §12.1, da mais branda à mais dura. Os fatores estão em `balance.difficulties`. */
export const DIFFICULTY_IDS = ['peasant', 'lord', 'ironKing'] as const;
export type DifficultyId = (typeof DIFFICULTY_IDS)[number];

/** Faixas da moral (GDD §5.7), da mais baixa à mais alta. Os limites estão em `balance.morale.bands`. */
export const MORALE_BAND_IDS = ['desperate', 'restless', 'content', 'proud'] as const;
export type MoraleBandId = (typeof MORALE_BAND_IDS)[number];

/**
 * Os termos da conta da moral (GDD §5.7), na ordem em que a explicação os mostra: a base, a
 * comida guardada, a fome (e cada dia inteiro dela), as casas cheias, o frio, a Taverna (um
 * termo permanente por nível), a fé de cada herói Devoto presente no feudo e os efeitos
 * temporários (cartas do Conselho, incursões, objetivos, o festival da Taverna).
 */
export const MORALE_TERM_IDS = [
  'base',
  'foodReserve',
  'famine',
  'famineDays',
  'housingFull',
  'cold',
  'tavern',
  'devout',
  'effect',
] as const;
export type MoraleTermId = (typeof MORALE_TERM_IDS)[number];

/** Os tipos de tile do mapa (GDD §8.1). Na v0.2 só existe o tile de ameaça, em lista: `tiles.ts`. */
export const TILE_TYPE_IDS = ['wolfDen', 'raiderCamp', 'hordeFortress'] as const;
export type TileTypeId = (typeof TILE_TYPE_IDS)[number];

/** Quem ataca o feudo em uma incursão (GDD §8.2). Na v0.2, só os lobos. */
export const ENEMY_IDS = ['wolves', 'raiders', 'horde'] as const;
export type EnemyId = (typeof ENEMY_IDS)[number];

/** Os tamanhos de uma incursão (GDD §8.2), da menor à maior. */
export const RAID_SIZE_IDS = ['light', 'medium'] as const;
export type RaidSizeId = (typeof RAID_SIZE_IDS)[number];

/**
 * O que a Torre de Vigia diz da composição de uma incursão, do menos ao mais (GDD §8.3; ADR
 * 0020, decisão 16): nada (Nv1 e Nv2), os tipos (Nv3), a quantidade por ala (Nv4) e a
 * composição exata (Nv5).
 */
export const WATCHTOWER_COMPOSITION_IDS = ['none', 'archetypes', 'approximate', 'exact'] as const;
export type WatchtowerCompositionId = (typeof WATCHTOWER_COMPOSITION_IDS)[number];

/** As classes de herói da v0.3 (GDD §9.1). Os atributos-base estão em `heroClasses`. */
export const HERO_CLASS_IDS = ['warrior', 'archer', 'mage', 'cleric'] as const;
export type HeroClassId = (typeof HERO_CLASS_IDS)[number];

/** Os seis atributos de um herói (GDD §9.1), na ordem em que a ficha os mostra. */
export const HERO_ATTRIBUTE_IDS = [
  'health',
  'attack',
  'defense',
  'speed',
  'skill',
  'will',
] as const;
export type HeroAttributeId = (typeof HERO_ATTRIBUTE_IDS)[number];

/** Os traços de herói (GDD, Apêndice D; ADR 0017, "Os oito traços"). */
export const HERO_TRAIT_IDS = [
  'brave',
  'prudent',
  'greedy',
  'charismatic',
  'devout',
  'veteran',
  'loyal',
  'tracker',
] as const;
export type HeroTraitId = (typeof HERO_TRAIT_IDS)[number];

/**
 * O que um herói está fazendo: no feudo, em expedição (V3D-T1), ferido no feudo, em cativeiro
 * (V3D-T2) ou na escolta de uma caravana (V3E-T2).
 */
export const HERO_STATUS_IDS = [
  'idle',
  'expedition',
  'injured',
  'captured',
  'escort',
  'campaign',
] as const;
export type HeroStatusId = (typeof HERO_STATUS_IDS)[number];

/**
 * A forma de tratamento de um herói: é o que deixa a ficha concordar com o nome ("Edda —
 * Guerreira", "Rolf — Arqueiro"). A classe e o traço trazem um rótulo para cada uma.
 */
export const HERO_GENDER_IDS = ['f', 'm'] as const;
export type HeroGenderId = (typeof HERO_GENDER_IDS)[number];

/**
 * Os heróis com nome próprio, que uma carta do Conselho entrega (GDD §9.1 e Apêndice B; ADR
 * 0017, decisão 6). Não são modelos da Taverna. A ficha de cada um está em `namedHeroes`.
 */
export const NAMED_HERO_IDS = ['edda', 'rolf', 'osbert'] as const;
export type NamedHeroId = (typeof NAMED_HERO_IDS)[number];

/**
 * Os Mestres: aldeões com nome próprio, raros, que uma expedição ou uma carta traz ao feudo (GDD
 * §5.4; ADR 0018, decisão 18). A ficha de cada um está em `masters`. O id fica gravado no estado
 * (`settlement.masters[].masterId`): mudar um deles pede passo de migração.
 */
export const MASTER_IDS = ['odo', 'berta', 'gil', 'ximena'] as const;
export type MasterId = (typeof MASTER_IDS)[number];

/**
 * Os modelos de candidato que a Taverna oferece (GDD §9.1; ADR 0017, "Modelos de candidato da
 * Taverna"), **na ordem do sorteio**. A ficha de cada um está em `tavernCandidates`. O id fica
 * gravado no estado (`guild.tavernOffers[].templateId`): mudar um deles pede passo de migração.
 */
export const TAVERN_CANDIDATE_IDS = [
  'braveWarrior',
  'steadyWarrior',
  'veteranWarrior',
  'trackerArcher',
  'greedyArcher',
  'veteranArcher',
  'greedyMage',
  'learnedMage',
  'devoutCleric',
  'charismaticCleric',
] as const;
export type TavernCandidateId = (typeof TAVERN_CANDIDATE_IDS)[number];

/**
 * A Postura de uma expedição (GDD §9.2; ADR 0018, decisão 11): quem decide na encruzilhada
 * quando o senhor não responde no prazo. Os rótulos estão em `expeditionPostures`.
 */
export const POSTURE_IDS = ['cautious', 'balanced', 'bold'] as const;
export type PostureId = (typeof POSTURE_IDS)[number];

/** Os tipos de nó de um grafo de expedição (GDD §9.2). */
export const EXPEDITION_NODE_KINDS = [
  'travel',
  'encounter',
  'discovery',
  'crossroads',
  'hazard',
  'camp',
  'boss',
  'return',
] as const;
export type ExpeditionNodeKind = (typeof EXPEDITION_NODE_KINDS)[number];

/** Os desfechos de um nó com dificuldade (GDD §9.2), do melhor ao pior. */
export const EXPEDITION_OUTCOME_IDS = ['full', 'success', 'setback', 'disaster'] as const;
export type ExpeditionOutcomeId = (typeof EXPEDITION_OUTCOME_IDS)[number];

/** O que o Desastre de um nó faz a um herói (ADR 0017, decisão 8): marcado em cada nó. */
export const EXPEDITION_DISASTER_IDS = ['injury', 'capture'] as const;
export type ExpeditionDisasterId = (typeof EXPEDITION_DISASTER_IDS)[number];

/**
 * Os modelos de expedição (GDD §9.3; ADR 0018, decisão 12): os seis da v0.3 (V3D-T3). O id fica
 * gravado no estado (`guild.expeditions[].modelId`, `guild.reports[].modelId`,
 * `map.discovered`), e com ele a variante, a chave do nó e a da opção: **são estáveis**, fixados
 * em `expeditions.test.ts`, e mudar um deles pede passo de migração. A ficha de cada um está em
 * `expeditionModels`.
 */
export const EXPEDITION_MODEL_IDS = [
  'patrol',
  'oldForest',
  'whiteWolfHunt',
  'wolfDen',
  'rescue',
  'ruins',
  // V4B-T1: a Mina Abandonada, o único destino que rende ferro (ADR 0019, decisão 3).
  'abandonedMine',
  'swamp',
  // V4F-T1: a sabotagem da Fortaleza da Horda (ADR 0020, decisão 17).
  'sabotage',
] as const;
export type ExpeditionModelId = (typeof EXPEDITION_MODEL_IDS)[number];

/** A gravidade de um ferimento de herói (ADR 0017, decisão 8): leve no Revés, grave no Desastre. */
export const INJURY_SEVERITY_IDS = ['light', 'severe'] as const;
export type InjurySeverityId = (typeof INJURY_SEVERITY_IDS)[number];

/**
 * O que acontece ao herói onde um nó marca captura, conforme a dificuldade (ADR 0017, decisão 8):
 * ferimento grave no lugar dela, a captura, ou a morte.
 */
export const HERO_CAPTURE_RULE_IDS = ['injury', 'capture', 'death'] as const;
export type HeroCaptureRuleId = (typeof HERO_CAPTURE_RULE_IDS)[number];

/** O que um desfecho fez a um herói: os dois ferimentos, a captura e a morte. */
export const HERO_HARM_IDS = ['light', 'severe', 'captured', 'died'] as const;
export type HeroHarmId = (typeof HERO_HARM_IDS)[number];

/** Os espaços de equipamento de um herói (GDD §9.1; ADR 0018, decisão 15). */
export const ITEM_SLOT_IDS = ['weapon', 'armor', 'accessory'] as const;
export type ItemSlotId = (typeof ITEM_SLOT_IDS)[number];

/** As raridades de item desta versão, da mais comum à mais rara (o Lendário fica fora). */
export const ITEM_RARITY_IDS = ['common', 'uncommon', 'rare', 'epic'] as const;
export type ItemRarityId = (typeof ITEM_RARITY_IDS)[number];

/**
 * Os itens (GDD §9.1; ADR 0018, decisão 15). O id fica gravado no estado
 * (`guild.inventory[].defId`, `hero.equipment`): mudar um deles pede passo de migração. A ficha
 * de cada um está em `items`.
 */
export const ITEM_IDS = [
  'huntingSpear',
  'ashBow',
  'veltharBlade',
  'emberStaff',
  'paddedJerkin',
  'boiledLeather',
  'riveredMail',
  'wardenPlate',
  'luckyCharm',
  'trackerHorn',
  'travelerMedal',
  'captainChain',
  'lordsSword',
] as const;
export type ItemId = (typeof ITEM_IDS)[number];

/** Fração exata: o motor só faz conta com inteiros, então 1,6 vira 16/10. */
export type Ratio = { readonly num: number; readonly den: number };

/** Quantidades em unidades inteiras de recurso (o motor converte para milésimos). */
export type ResourceAmounts = Partial<Record<ResourceId, number>>;
