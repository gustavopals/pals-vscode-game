import type {
  BuildingId,
  DifficultyId,
  ExpeditionModelId,
  HeroClassId,
  HeroTraitId,
  MarketResourceId,
  ItemId,
  TileTypeId,
  MasterId,
  NamedHeroId,
  Ratio,
  ResourceAmounts,
  ResourceId,
  SeasonId,
  UnitId,
} from './ids';

/**
 * O Conselho do Feudo (GDD §7; ADR 0014, decisões 1, 9, 18 e 20): os tipos de uma carta. As
 * cartas ficam em `cards/`, uma cadeia por arquivo; os números da cadência e do prazo, em
 * `balance.council`; o schema, em `schemas.ts` (`CouncilCardSchema` e `CouncilCatalogSchema`).
 */

/**
 * O que uma carta pode fazer. Os cinco primeiros são da v0.2; `addHero` chegou com a primeira
 * carta roteirizada (roadmap da v0.3, V3C-T3). Unidade, mapa, Mercado e combate ficam de fora.
 */
export const COUNCIL_EFFECT_TYPES = [
  'resources',
  'morale',
  'setFlag',
  'clearFlag',
  'scheduleCard',
  'addHero',
  'addMaster',
  'revealDestination',
  'addSoldiers',
  'resourcesPercent',
  'marketPrice',
  'rollEffect',
  'tavernExtraOffer',
  'injureHero',
  'healHero',
  'smithySpeed',
  'smithyBatch',
  'addItem',
  'addWeapons',
  'trainBoost',
  'startBuilding',
  'omen',
  'threat',
  'scheduleRaid',
  'repairWall',
  'healWall',
  'revealRaid',
  'repairDiscount',
  'militiaReady',
  'unlockExpedition',
] as const;
export type CouncilEffectType = (typeof COUNCIL_EFFECT_TYPES)[number];

export type CouncilImmediateEffect =
  | { readonly type: 'smithySpeed'; readonly factor: Ratio; readonly durationDays: number }
  | { readonly type: 'smithyBatch'; readonly extra: number; readonly durationDays: number }
  | { readonly type: 'addItem'; readonly itemId: ItemId }
  | { readonly type: 'addWeapons'; readonly amount: number }
  | { readonly type: 'trainBoost'; readonly factor: Ratio }
  | {
      readonly type: 'startBuilding';
      readonly building: BuildingId;
      readonly level: number;
      readonly discount: Ratio;
    }
  | { readonly type: 'omen'; readonly wave?: 1 | 2 | 3; readonly clarity: 1 | 3 | 5 }
  | { readonly type: 'threat'; readonly delta: number }
  | { readonly type: 'scheduleRaid'; readonly kind: 'weak'; readonly afterMs: number }
  | { readonly type: 'repairWall'; readonly discount: Ratio }
  | { readonly type: 'healWall'; readonly fraction: Ratio }
  | { readonly type: 'revealRaid' }
  | { readonly type: 'repairDiscount'; readonly points: number }
  | { readonly type: 'militiaReady' }

  /**
   * Recursos, em unidades. Positivo é ganho: entra o que cabe no depósito, e o que não cabe é
   * desperdício contado (GDD §5.5). Negativo é perda: sai o que houver, e o estoque nunca fica
   * abaixo de zero.
   */
  | { readonly type: 'resources'; readonly amounts: Partial<Record<ResourceId, number>> }
  /** Fração do estoque lido na resolução; sinal negativo tira, positivo dá. */
  | { readonly type: 'resourcesPercent'; readonly resource: ResourceId; readonly ratio: Ratio }
  /** Multiplica compra e venda sem mudar o passeio nem o dia da cotação. */
  | {
      readonly type: 'marketPrice';
      readonly resources: readonly MarketResourceId[];
      readonly factor: Ratio;
      readonly durationDays: number;
    }
  /** Moral, por `durationDays` dias de jogo: conta em exatamente esse número de viradas do dia. */
  | { readonly type: 'morale'; readonly amount: number; readonly durationDays: number }
  /** Um marcador narrativo. Nunca é texto de interface nem sai na visão. */
  | { readonly type: 'setFlag'; readonly flag: string }
  | { readonly type: 'clearFlag'; readonly flag: string }
  /** A continuação: outra carta chega `afterDays` dias de jogo depois, furando o sorteio. */
  | {
      readonly type: 'scheduleCard';
      readonly cardId: string;
      readonly afterDays: number;
      readonly ifFlags?: readonly string[];
    }
  /**
   * Um herói com nome próprio (`namedHeroes`) entra para o feudo, sem custo: agora ou, com
   * `afterDays`, esse tanto de dias de jogo depois, contados do instante da escolha. A promessa
   * não é segredo: a visão diz quem vem e quando. O limite de contratação não barra a chegada
   * (ADR 0017, decisão 5). Só vale entre os efeitos conhecidos de uma opção sem custo.
   */
  | { readonly type: 'addHero'; readonly heroId: NamedHeroId; readonly afterDays?: number }
  /**
   * Um Mestre com nome (`masters`) chega ao feudo agora, pela mesma porta da recompensa de
   * expedição (`deliverMaster`): entra se houver vaga nas casas, espera à porta se não, e nunca
   * chega duas vezes. Com `ifFlags`, só chega se **todas** essas flags estiverem gravadas no
   * instante em que o efeito roda (os efeitos de uma opção rodam na ordem em que estão escritos):
   * é como uma mesma opção dá Gil a quem abrigou e Ximena a quem deu provisões. Só vale entre os
   * efeitos conhecidos de uma opção, e a chegada não é segredo.
   */
  | {
      readonly type: 'addMaster';
      readonly masterId: MasterId;
      readonly ifFlags?: readonly string[];
    }
  /**
   * O próximo destino de expedição que só aparece por descoberta e ainda não foi revelado entra
   * em `map.discovered`, na ordem do catálogo (a mesma entrada que a Patrulha e a Floresta Antiga
   * usam). A carta que o dá pede `undiscovered`, e a revelação não é segredo.
   */
  | { readonly type: 'revealDestination'; readonly modelId?: ExpeditionModelId }
  /** Abre um destino especial apenas até o prazo, contado da escolha. */
  | {
      readonly type: 'unlockExpedition';
      readonly modelId: ExpeditionModelId;
      readonly forDays: number;
    }
  /**
   * Soldados já treinados entram no Exército, sem fila nem custo de treino, saindo dos aldeões
   * (a mesma conta do fim do treino). A opção que os dá pede o Quartel e a vaga
   * (`requires.soldierRoom`), então o efeito nunca passa do teto nem do piso de aldeões.
   */
  | {
      readonly type: 'addSoldiers';
      readonly unit: UnitId;
      readonly amount: number;
      readonly fromPopulation?: false;
    }
  /** Um candidato a mais só na próxima rotação; não aumenta o limite de contratação. */
  | { readonly type: 'tavernExtraOffer' }
  /** Fere de leve um dos participantes gravados na carta, escolhido na resolução do risco. */
  | { readonly type: 'injureHero'; readonly kind: 'light' }
  /** Cura o participante gravado, ou reduz pela metade o tempo restante do ferimento. */
  | { readonly type: 'healHero'; readonly mode: 'full' | 'half' };

export type CouncilRollOutcome = {
  readonly effects: readonly CouncilImmediateEffect[];
  readonly chronicle: string;
};

/** Risco conhecido; um sorteio no fluxo council, na primeira virada depois da escolha. */
export type CouncilRollEffect = {
  readonly type: 'rollEffect';
  readonly chance: Ratio;
  readonly withHeroClass?: { readonly heroClass: HeroClassId; readonly chance: Ratio };
  readonly onHit: CouncilRollOutcome;
  readonly onMiss: CouncilRollOutcome;
};

export type CouncilEffect = CouncilImmediateEffect | CouncilRollEffect;

/** Quando uma carta pode ser sorteada. Sem um campo, ele não restringe. */
export type CouncilCardRequires = {
  readonly tile?: TileTypeId;
  /** Tiles de ameaça já limpos, pela chave no mapa. */
  readonly clearedTiles?: readonly TileTypeId[];
  readonly wallDamaged?: true;
  readonly activeRaid?: true;
  readonly phase?: 'aftermath';
  readonly armyRoom?: number;
  readonly seasons?: readonly SeasonId[];
  /** O dia de jogo do feudo, a contar da fundação (o primeiro é 1), a partir do qual ela pode sair. */
  readonly minDay?: number;
  /** Nível mínimo de cada edifício: `{ granary: 1 }` é "com o Celeiro erguido". */
  readonly buildings?: Partial<Record<BuildingId, number>>;
  /** Todas gravadas. */
  readonly flags?: readonly string[];
  /** Nenhuma gravada. */
  readonly notFlags?: readonly string[];
  /** A moral do feudo, do mínimo ao máximo, os dois inclusive. */
  readonly moralRange?: readonly [number, number];
  /** Ao menos um destino de expedição que só aparece por descoberta ainda não foi revelado. */
  readonly undiscovered?: true | ExpeditionModelId;
  /** Estoque estritamente maior que estes valores, em unidades. */
  readonly resourcesAbove?: ResourceAmounts;
  /** Quantos heróis livres a chegada escolhe, sem reposição, no fluxo council. */
  readonly heroPresent?: number;
  /** A chegada escolhe um herói em recuperação no feudo. */
  readonly injuredHero?: true;
};

/** O que uma opção exige além do custo. Sem o requisito, ela aparece trancada, com o motivo. */
export type CouncilOptionRequires = {
  /** Heróis livres para partir agora, incluindo a trava dos comandantes. */
  readonly heroPresent?: number;
  readonly armyRoom?: number;
  readonly training?: true;
  readonly commanderTrait?: HeroTraitId;
  readonly siegeCasualties?: true;
  readonly siegeWon?: true;
  /** O edifício tem de existir (nível 1 ou mais). */
  readonly building?: BuildingId;
  readonly buildings?: Partial<Record<BuildingId, number>>;
  /** A opção só aparece enquanto todas as flags estiverem gravadas. */
  readonly flags?: readonly string[];
  readonly undiscovered?: ExpeditionModelId;
  /** Herói livre no feudo; o primeiro na lista fornece {heroi} à Crônica. */
  readonly heroTrait?: HeroTraitId;
  /** Soldados treinados, sem contar o lote em treino. */
  readonly minSoldiers?: number;
  /** Recursos que o feudo tem de ter em estoque, sem gastá-los. */
  readonly resources?: ResourceAmounts;
  /**
   * Vaga para tantos soldados novos: o Quartel de pé com lugar sob o teto (contando o lote em
   * treino) e aldeões sobrando acima do piso. Para o efeito `addSoldiers`.
   */
  readonly soldierRoom?: number;
  /** Cabe mais um herói na lista de heróis (`rosterCap`). Para o efeito `addHero` com custo. */
  readonly rosterRoom?: true;
};

/**
 * O que o jogador não vê ao escolher: acontece `afterDays` viradas do dia depois da escolha, e
 * só então vira evento e linha da Crônica. A opção sempre traz uma pista (`hint`).
 */
export type CouncilHiddenOutcome = {
  readonly afterDays: number;
  readonly effects: readonly CouncilEffect[];
  /** A frase da Crônica do instante em que o efeito acontece. */
  readonly chronicle: string;
};

export type CouncilOption = {
  readonly id: string;
  /** Verbo no infinitivo, sem números: "Ceder a madeira". O custo vai em `cost`. */
  readonly label: string;
  readonly requires?: CouncilOptionRequires;
  /** Pago na hora da escolha, em unidades. */
  readonly cost?: ResourceAmounts;
  readonly weaponsCost?: number;
  /** As consequências conhecidas: a visão as mostra ao lado do custo, antes da escolha. */
  readonly effects: readonly CouncilEffect[];
  /** A pista: o que pode vir depois, sem dizer o quê. Uma frase curta. */
  readonly hint: string;
  readonly hidden?: CouncilHiddenOutcome;
  /** A frase da Crônica quando o senhor escolhe esta opção. */
  readonly chronicle: string;
  /**
   * A frase da Crônica quando a carta expira e o conselho aplica esta opção sozinho. Sem ela
   * vale o modelo geral de `cardExpired`, que diz a carta e o que foi feito.
   */
  readonly expiredChronicle?: string;
};

/**
 * O mesmo modelo de carta lido de outro jeito conforme a história: a primeira variante cuja
 * flag está gravada troca o texto da carta e, se tiver, a frase da chegada. É como uma
 * continuação lembra a escolha que a trouxe ("Sua escolha voltou"). Não conta como carta nova.
 */
export type CouncilCardVariant = {
  readonly flag: string;
  readonly text: string;
  readonly arrival?: string;
};

export type CouncilCard = {
  readonly id: string;
  readonly title: string;
  /** A situação, em 2 a 4 frases, no tom da Crônica. */
  readonly text: string;
  /** Peso no sorteio. Zero é carta que só chega como continuação de outra. */
  readonly weight: number;
  /** Pode sair mais de uma vez no mesmo ano. */
  readonly recurring?: boolean;
  readonly requires?: CouncilCardRequires;
  /**
   * Carta roteirizada: chega no primeiro sorteio a partir desse dia de jogo, uma vez por
   * partida, na frente das sorteadas. O dia conta da fundação do feudo (o primeiro é 1); a
   * partida que já passou dele recebe a carta na primeira audiência com lugar. A primeira é
   * "Estrangeira ferida" (ADR 0017, decisão 6). A outra forma, `onHallLevel`, chega na primeira
   * audiência com lugar em que o Salão já está nesse nível ou acima (V4H-T1): nenhum campo novo
   * no estado, porque a conta lê o Salão no instante do sorteio.
   */
  readonly scripted?:
    | { readonly atGameDay: number }
    | { readonly onHallLevel: number }
    | { readonly atSeasonStart: SeasonId; readonly year: number }
    | { readonly atSeasonEnd: SeasonId; readonly year: number }
    | { readonly beforeSiege: true };
  /**
   * A opção que o conselho aplica quando a carta expira, por dificuldade (GDD §12.1). É marcada
   * por quem escreve a carta; as três existem e não têm custo nem requisito.
   */
  readonly autoResolve: Record<DifficultyId, string>;
  /**
   * A opção com requisito que o conselho aplica quando a carta expira **e o feudo já tem o que
   * ela exige**, em qualquer dificuldade, no lugar da de `autoResolve`: a promessa que a obra já
   * cumpriu se cumpre mesmo sem o senhor na sala, e a Crônica não diz o contrário do que o
   * feudo vê. Não tem custo. Sem o requisito, vale `autoResolve`.
   */
  readonly autoResolveIfUnlocked?: string;
  /** Duas ou três. */
  readonly options: readonly CouncilOption[];
  readonly variants?: readonly CouncilCardVariant[];
  /** A frase da Crônica quando a carta chega. Sem ela vale o modelo geral de `cardDrawn`. */
  readonly arrival?: string;
};

/** Texto de contingência exigido em §8.1; redação proposta em pendencias-v0.4.md, H-3. */
export const councilHeroTexts = {
  healerLate:
    'No {dia}º dia {daEstacao}, o curandeiro errante chegou tarde a {feudo}: {heroi} já não estava entre os feridos da casa.',
};
