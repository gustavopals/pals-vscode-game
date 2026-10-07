import type {
  BuildingId,
  DifficultyId,
  EnemyId,
  ExpeditionOutcomeId,
  GameEventType,
  HeroClassId,
  HeroGenderId,
  HeroHarmId,
  HeroStatusId,
  HeroTraitId,
  InjurySeverityId,
  ItemSlotId,
  MarketResourceId,
  MasterId,
  MoraleBandId,
  MoraleTermId,
  NamedHeroId,
  PostureId,
  ProductionBuildingId,
  RaidSizeId,
  Ratio,
  ResourceId,
  SeasonId,
  TileTypeId,
  TradeDirectionId,
} from '@lotg/content';

export type {
  BuildingId,
  DifficultyId,
  EnemyId,
  ExpeditionOutcomeId,
  GameEventType,
  HeroClassId,
  HeroGenderId,
  HeroHarmId,
  HeroStatusId,
  HeroTraitId,
  InjurySeverityId,
  ItemSlotId,
  MarketResourceId,
  MasterId,
  MoraleBandId,
  MoraleTermId,
  NamedHeroId,
  PostureId,
  ProductionBuildingId,
  RaidSizeId,
  ResourceId,
  SeasonId,
  TileTypeId,
  TradeDirectionId,
};

/** Escolhas feitas na criação da partida. Dificuldade e ritmo não mudam durante o ano. */
export type GameSettings = {
  settlementName: string;
  timezone: string;
  vigilHourLocal: number;
  difficulty: DifficultyId;
  /**
   * Ritmo: horas de jogo por hora real (GDD §4.2). O motor roda em tempo de jogo; o ritmo só
   * converte prazos de tempo real no instante em que nascem e os prazos e taxas da visão.
   */
  timeScale: number;
};

export type Construction = {
  building: BuildingId;
  targetLevel: number;
  startedAtMs: number;
  finishesAtMs: number;
};

/**
 * Uma obra planejada. Com `autoStart`, é uma planejada "iniciar quando houver recursos": o motor
 * a inicia sozinho no primeiro instante em que ela puder começar (GDD §6.3).
 */
export type PlannedConstruction = {
  building: BuildingId;
  targetLevel: number;
  autoStart: boolean;
};

/** Uma leva de trabalhadores que chegou junta a um edifício e ainda se adapta ao ofício. */
export type AdaptationCohort = {
  building: ProductionBuildingId;
  count: number;
  untilMs: number;
};

/**
 * Um Mestre do feudo (GDD §5.4; ADR 0018, decisão 18): um aldeão com nome, que conta como
 * habitante e, com edifício, como um trabalhador dele, a quem dá o bônus do conteúdo. **Não é um
 * dos `population.villagers`**: as regras que tiram aldeões do feudo ou do trabalho não o
 * alcançam.
 */
export type Master = {
  /** `master-<n>`, de `nextId`: é o que a ordem `assignMaster` diz. */
  id: string;
  /** Quem ele é no conteúdo (`masters`): o nome, o tratamento e o ofício de origem. */
  masterId: MasterId;
  /** O edifício produtivo em que trabalha; `null` enquanto o senhor não lhe dá um. */
  building: ProductionBuildingId | null;
  /**
   * Até quando ele se adapta ao edifício a que chegou, em tempo de jogo: enquanto dura, rende a
   * fração de quem acabou de chegar e não dá o bônus. `null` quando já rende inteiro, e sem
   * edifício. O fim é um evento da linha do tempo.
   */
  adaptingUntilMs: number | null;
};

/** Um Mestre que chegou sem vaga nas casas e espera à porta, já com o identificador dele. */
export type WaitingMaster = { id: string; masterId: MasterId };

/**
 * Um efeito temporário sobre a moral (GDD §5.7): quanto soma ou tira, com que nome aparece na
 * explicação e até quando vale. Entra na conta de toda virada de dia até `untilMs`, inclusive.
 */
export type MoraleEffect = {
  /** Quem o criou: gravar de novo o mesmo `id` troca o efeito, não o soma. */
  id: string;
  /** Como o termo aparece na explicação: "carta: Tábuas para as reservas". */
  label: string;
  amount: number;
  untilMs: number;
};

/** Uma carta do Conselho à espera de resposta (GDD §7.1). */
export type PendingCard = {
  /**
   * A ocorrência, não o modelo: a mesma carta em outro ano (ou uma recorrente) tem outro
   * `instanceId`. É o id da carta e a ordem de chegada dela na partida: "collapsedWell-3".
   */
  instanceId: string;
  cardId: string;
  drawnAtMs: number;
  /**
   * Quando o conselho decide sozinho. O prazo é de tempo real (24 h) e foi convertido para
   * tempo de jogo, com o ritmo da partida, no instante em que a carta chegou.
   */
  expiresAtMs: number;
  /**
   * A escolha que trouxe esta carta, quando ela é a continuação de outra; `null` na que veio do
   * sorteio. É o que deixa a tela dizer de onde a história vem.
   */
  origin: { cardId: string; optionId: string; instanceId: string } | null;
};

/** Uma continuação agendada: a carta que uma escolha anterior marcou para chegar depois. */
export type ScheduledCard = {
  cardId: string;
  /** A partir de quando ela pode chegar; chega no primeiro instante com vaga entre as pendentes. */
  atMs: number;
  /** A escolha que a agendou: é o que liga as duas linhas na Crônica. */
  previousCardId: string;
  previousOptionId: string;
  previousInstanceId: string;
};

/**
 * O efeito escondido de uma opção já escolhida, à espera do instante dele. Só guarda quem o
 * deixou: o efeito em si é lido do conteúdo quando acontece.
 */
export type DelayedCardEffect = {
  atMs: number;
  instanceId: string;
  cardId: string;
  optionId: string;
};

/**
 * Um tile do mapa (GDD §8.1). O mapa gráfico é da v0.5: até lá um tile é só o tipo dele e se a
 * ameaça que mora nele está ativa.
 */
export type MapTile = {
  type: TileTypeId;
  /**
   * Ativo, o tile faz a Ameaça subir a cada dia de jogo. Uma expedição pode limpá-lo, e na
   * virada do ano ele volta a ficar ativo (ADR 0018, decisão 14).
   */
  threatActive: boolean;
};

/**
 * Uma incursão marcada (GDD §8.2). A do roteiro nasce com a partida; as outras são sorteadas
 * pela Ameaça, na virada do dia. Há no máximo uma sorteada por vez, e nenhuma é sorteada
 * enquanto houver outra marcada. Sai da lista no instante em que é resolvida.
 */
export type ScheduledRaid = {
  /** A ocorrência: o id do roteiro ("wolvesYear1") ou "threat-3", pela ordem das incursões da partida. */
  id: string;
  /** Quando ela chega, em tempo de jogo. */
  atMs: number;
  /** `scripted`: a do roteiro do ano 1. `threat`: sorteada pela Ameaça. */
  kind: 'scripted' | 'threat';
  enemy: EnemyId;
  size: RaidSizeId;
  /**
   * O instante em que os vigias da Torre deram o alarme; `null` enquanto ninguém avisou. Quem
   * chega ao fim sem aviso entra na Crônica como quem ninguém viu vir.
   */
  announcedAtMs: number | null;
};

/**
 * Um aldeão ferido em uma incursão (GDD §8.2): não trabalha até `untilMs` e depois volta ao
 * ofício que tinha. Continua morando e comendo no feudo.
 */
export type InjuredVillager = {
  /** O instante de jogo em que ele sara: é um evento da linha do tempo. */
  untilMs: number;
  /** O edifício de onde ele saiu, e para onde volta já adaptado; `null` para quem não tinha ofício. */
  building: ProductionBuildingId | null;
};

/** Um herói prometido por uma carta, a caminho do feudo (`guild.arriving`). */
export type ArrivingHero = {
  /** O herói com nome do conteúdo; o que o conteúdo já não tem sai da lista sem chegar. */
  namedHeroId: NamedHeroId;
  /** Quando ele chega, em tempo de jogo. */
  atMs: number;
};

/**
 * Um item (GDD §9.1; ADR 0018, decisão 15): o que foi achado, e o que ele é no conteúdo. Mora no
 * arsenal (`guild.inventory`), em um espaço de um herói (`hero.equipment`) ou no saque de uma
 * expedição em curso.
 */
export type Item = {
  /** `item-<n>`, de `nextId(draft, 'item')`: nunca reutilizado. É o que `equipItem` recebe. */
  id: string;
  /** O item do conteúdo (`items`). */
  defId: string;
};

/** O ferimento de um herói (ADR 0017, decisão 8): não parte em outra expedição até `untilMs`. */
export type HeroInjury = {
  severity: InjurySeverityId;
  /** O instante de jogo em que ele sara: é um evento da linha do tempo. */
  untilMs: number;
};

/** O cativeiro de um herói: desde quando, e em que expedição ficou. Sem prazo nesta versão. */
export type HeroCaptivity = { sinceMs: number; modelId: string };

/**
 * Um herói a serviço do feudo (GDD §9.1; ADR 0017). Só o que não se deriva: os atributos e o
 * poder saem da classe, do nível e do Descontente, em `heroes.ts`, e nunca são gravados.
 */
export type Hero = {
  /** `hero-<n>`, de `nextId(draft, 'hero')`: nunca reutilizado. */
  id: string;
  name: string;
  /** A forma de tratamento: a ficha diz "Guerreira" ou "Guerreiro" conforme o nome. */
  gender: HeroGenderId;
  classId: HeroClassId;
  /** De 1 ao nível máximo do conteúdo. */
  level: number;
  /** Experiência acumulada no nível de agora. */
  xp: number;
  traits: HeroTraitId[];
  /**
   * O que ele está fazendo: no feudo e pronto (`idle`), em uma expedição (`expedition`), no
   * feudo se recuperando de um ferimento (`injured`), em cativeiro (`captured`) ou na escolta de
   * uma caravana (`escort`), de onde volta na chegada dela.
   */
  status: HeroStatusId;
  /**
   * O ferimento que ainda não sarou; `null` sem ele. Quem se fere em uma expedição a termina
   * (`status` continua `expedition`) e, na volta, fica `injured` até `untilMs`.
   */
  injury: HeroInjury | null;
  /** O cativeiro; `null` fora dele. Só `status: 'captured'` o tem. */
  captivity: HeroCaptivity | null;
  /** O que ele leva em cada espaço; `null` no espaço vazio. */
  equipment: Record<ItemSlotId, Item | null>;
  /** Quando chegou, em tempo de jogo: quem chegou por último é o primeiro a partir sem soldo. */
  joinedAtMs: number;
  /**
   * Quando voltou do cativeiro pela última vez, em tempo de jogo; `null` para quem nunca esteve
   * lá. Os prazos do soldo em atraso contam, para ele, do maior entre a chegada e a volta: o
   * atraso que correu com ele preso não é dele (revisão da Fase D, M-D1).
   */
  freedAtMs: number | null;
  /**
   * Descontente com o soldo em atraso (GDD §9.1): os atributos valem uma fração enquanto o
   * atraso durar. Só a virada do dia o marca, e ele some quando o atraso fecha.
   */
  discontent: boolean;
};

/**
 * Um candidato que a Taverna oferece até a próxima rotação (GDD §9.1; ADR 0017, decisão 4). O
 * sorteio já aconteceu, na rotação: contratar só cria o herói daqui, sem sortear nada.
 */
export type TavernOffer = {
  /** `offer-<n>`, de `nextId(draft, 'offer')`: nunca reutilizado. É o que `hireHero` recebe. */
  offerId: string;
  /** O modelo do conteúdo (`tavernCandidates`): a classe, os traços e o nível. */
  templateId: string;
  name: string;
  gender: HeroGenderId;
  /** O preço cheio, em ouro, como o modelo o dava na rotação. O desconto é conta da hora. */
  price: number;
};

/** Quem decidiu em uma encruzilhada: o senhor, a Postura, ou a Cautelosa no lugar da Postura. */
export type CrossroadsDecider = 'player' | 'posture' | 'cautiousFallback';

/**
 * Um passo já percorrido de uma expedição: um nó resolvido ou uma encruzilhada decidida. É o
 * que o relatório narra. Não guarda a sorte nem o poder: só o que aconteceu.
 */
export type ExpeditionLogEntry = {
  /** A chave do nó no grafo da variante. Nunca sai na visão como texto. */
  nodeId: string;
  /** Quando aconteceu, em tempo de jogo. */
  atMs: number;
  /** O desfecho de um nó com dificuldade; `passed`, o de um nó sem ela; `chosen`, uma escolha. */
  outcome: ExpeditionOutcomeId | 'passed' | 'chosen';
  /** Em uma escolha, a opção tomada; `null` no resto. */
  optionId: string | null;
  /** Em uma escolha, quem decidiu; `null` no resto. */
  decidedBy: CrossroadsDecider | null;
  /** O que o nó rendeu, em unidades inteiras, já com a parte que o desfecho deixa. */
  gained: Record<ResourceId, number>;
  /** A experiência que cada herói que continuou na equipe ganhou no nó. */
  xp: number;
  /** Quem sofreu o desfecho, pelo nome, e o que sofreu; `null` quando ninguém. */
  harm: { heroName: string; kind: HeroHarmId } | null;
  /** Quem subiu de nível com a experiência do nó, e para qual. */
  leveled: Array<{ heroName: string; level: number }>;
  /** Os itens achados no nó, pelo item do conteúdo. */
  found: string[];
  /** O destino que o nó revelou (o modelo do conteúdo); `null` no resto. */
  revealed: string | null;
  /** O tile de ameaça que o nó limpou (a chave do tile); `null` no resto. */
  cleared: string | null;
  /** Quem o nó tirou do cativeiro, pelo nome; `null` no resto. */
  rescued: string | null;
  /** O Mestre que a equipe encontrou no nó e que tomou a estrada do feudo; `null` no resto. */
  master: MasterId | null;
  /** O saque do nó se perdeu no caminho (o Ganancioso). */
  lootLost: boolean;
  /**
   * Quem se destacou em um nó com prova, pelo nome: o herói de maior poder contra o nó, como a
   * equipe chegou a ele (no empate, o de menor identificador). `null` no resto.
   */
  standout: string | null;
  /**
   * O que o Revés ou o Desastre ensina, escolhido na resolução do nó por um critério fixo, sem
   * sorteio: a classe que o nó pede e a equipe não tinha, o herói que rende mais em outra
   * Postura, o herói que partiu com espaço vago havendo item no arsenal, ou só a falta de força.
   * `null` no Sucesso, no Sucesso Pleno e no que não é prova.
   */
  lesson: ExpeditionLesson | null;
};

/**
 * Os motivos que o relatório dá para um desfecho ruim, na ordem em que o motor os procura. Os
 * dois últimos são a força que faltou: `strength` quando ainda cabia mais um herói na equipe
 * ("mais gente, ou gente mais calejada") e `level` quando ela já ia no tamanho máximo do destino
 * ("gente mais calejada"; revisão da Fase D, B3).
 */
export type ExpeditionLessonKind = 'class' | 'posture' | 'item' | 'strength' | 'level';

export type ExpeditionLesson = {
  kind: ExpeditionLessonKind;
  /** O herói de quem a lição fala (`posture` e `item`); `null` nas outras. */
  heroName: string | null;
  /** A Postura em que ele renderia mais (`posture`); `null` nas outras. */
  posture: PostureId | null;
};

/**
 * Uma expedição em curso (GDD §9.2; ADR 0018, decisões 11 a 13). O grafo é do conteúdo
 * (`modelId` e `variant`); aqui fica só onde a equipe está e o que já aconteceu.
 */
export type Expedition = {
  /** `expedition-<n>`, de `nextId(draft, 'expedition')`: nunca reutilizado. É o nome do fluxo de sorteio dela. */
  id: string;
  /** O modelo do conteúdo (`expeditionModels`). */
  modelId: string;
  /** A variante do grafo, fixada no envio sem sorteio. */
  variant: number;
  /** Quem foi, na ordem da ordem de envio. */
  heroIds: string[];
  posture: PostureId;
  sentAtMs: number;
  /** O fator de duração da estação do envio (o verão encurta): vale para todos os nós. */
  durationFactor: Ratio;
  /** Em viagem por um nó, parada em uma encruzilhada, ou no caminho de volta. */
  status: 'traveling' | 'atCrossroads' | 'returning';
  /** A chave do nó em que a equipe está. */
  nodeId: string;
  /** Quando o nó de agora termina; `null` na encruzilhada, que não tem duração. */
  nodeEndsAtMs: number | null;
  /**
   * A espera na encruzilhada: `decidesAtMs` é o instante de jogo em que a Postura decide, o
   * prazo de tempo real do conteúdo convertido quando a equipe chegou. `null` fora dela.
   */
  crossroads: { decidesAtMs: number } | null;
  /** O saque juntado até aqui: recursos em unidades inteiras e itens. Entra no feudo na volta. */
  loot: ExpeditionLoot;
  /** Um registro por nó resolvido e por encruzilhada decidida, na ordem. */
  log: ExpeditionLogEntry[];
};

/** O saque de uma expedição: recursos em unidades inteiras e os itens achados. */
export type ExpeditionLoot = { resources: Record<ResourceId, number>; items: Item[] };

/** O relatório de uma expedição que voltou: o registro dela e o que entrou no feudo. */
export type ExpeditionReport = {
  expeditionId: string;
  modelId: string;
  variant: number;
  /** Os nomes de quem foi: o herói pode já não servir ao feudo quando o relatório for lido. */
  heroNames: string[];
  posture: PostureId;
  sentAtMs: number;
  returnedAtMs: number;
  log: ExpeditionLogEntry[];
  /** O saque trazido: recursos em unidades inteiras e itens. Vazio quando ninguém voltou. */
  loot: ExpeditionLoot;
  /** O que não coube no depósito na volta, em milésimos. */
  wasted: Record<ResourceId, number>;
  /** Os itens que não couberam no arsenal e viraram ouro, pelo item do conteúdo. */
  sold: string[];
  /** Ninguém da equipe voltou (todos capturados ou mortos): o saque se perdeu. */
  lost: boolean;
};

/**
 * Uma caravana na estrada (GDD §5.9; ADR 0018, decisão 17). Só existe enquanto viaja: na chegada
 * a carga vira ouro, o herói da escolta volta ao feudo e ela sai da lista. **O desfecho não está
 * aqui**: a emboscada é sorteada na chegada, no fluxo `caravan:<id>`, e antes disso não existe
 * em lugar nenhum.
 */
export type Caravan = {
  /** `caravan-<n>`, de `nextId(draft, 'caravan')`: nunca reutilizado. */
  id: string;
  resource: MarketResourceId;
  /** Unidades inteiras que saíram do estoque no envio. */
  amount: number;
  /** O preço por unidade, em milésimos de ouro, **fixado no envio**: o do Mercado pode andar. */
  unitPrice: number;
  /** Quando chega, em ms de jogo: é um instante da linha do tempo. */
  arrivesAtMs: number;
  /** O herói que a escolta, ou `null`: com escolta não há emboscada, nem sorteio. */
  escortHeroId: string | null;
};

/**
 * O Mercado (GDD §5.9; ADR 0018, decisão 16). Os preços são o **passeio**, em milésimos de ouro
 * por unidade, sem o fator da estação: o que o jogador paga e recebe é derivado (`market.ts`).
 *
 * Sem o edifício os preços ficam na base e nada aqui muda: o preço só anda, e o dia só é
 * marcado, na virada de um dia de jogo **com o Mercado de pé**.
 */
export type MarketState = {
  /** O preço de hoje de cada recurso, entre o piso e o teto do conteúdo. */
  prices: Record<MarketResourceId, number>;
  /**
   * O preço de antes do último passeio: é com ele que a visão diz se o preço subiu ou caiu. Nunca
   * sai do servidor. Igual a `prices` enquanto os preços não andaram.
   */
  previousPrices: Record<MarketResourceId, number>;
  /**
   * O dia de jogo da cotação em vigor, contado do começo da partida (o primeiro é o 1): o da
   * última virada que fez os preços andarem. Zero enquanto eles não andaram (sem Mercado, e no
   * dia em que ele fica pronto). É o que a ordem `trade` devolve, para ser recusada se o dia
   * virou entre a tela e a ordem.
   */
  quoteDay: number;
  /**
   * Unidades de cada recurso negociadas desde a última virada do dia, **somando compra e
   * venda**. Zera junto com o passeio do preço.
   */
  tradedToday: Record<MarketResourceId, number>;
  /**
   * As caravanas na estrada, em ordem de identificador, nunca mais do que os lugares do Mercado
   * (ADR 0018, decisão 17). A carga delas não conta em `tradedToday`.
   */
  caravans: Caravan[];
};

/**
 * Estado do jogo: subconjunto do GDD §14.11. Tudo é JSON puro e inteiro (menos o ritmo, em
 * `settings`). Recursos ficam em milésimos; `accumulators` guarda o resto da produção contínua
 * (em milésimos × ms), que ainda não completou um milésimo.
 *
 * Mudar a forma deste tipo é subir `schemaVersion` e escrever um passo em `migrations/`: há
 * estados gravados em produção, e eles só chegam aqui por `migrateState`.
 */
export type GameState = {
  schemaVersion: 23;
  seed: string;
  settings: GameSettings;
  /**
   * Fronteira da atualização mais recente: instante de jogo em que a última migração encontrou
   * a partida, ou seja, até onde ela foi simulada por uma versão anterior das regras. `null` em
   * partidas que nasceram nesta versão. Cada passo de migração a regrava, e os prazos de uma
   * mecânica nova contam a partir da fronteira do passo que a trouxe; nenhuma regra recalcula o
   * que veio antes (ADR 0013, decisão 4).
   */
  migratedAtMs: number | null;
  clock: { gameTimeMs: number; yearStartMs: number; year: number };
  /** Tempo de jogo, em ms, até onde o estado já foi simulado. */
  lastProcessedAt: number;
  /**
   * Estado dos fluxos de sorteio, por nome: quatro inteiros de 32 bits cada (`random.ts`). Um
   * fluxo só aparece aqui depois do primeiro sorteio nele, e o de uma entidade (`expedition:<id>`,
   * `caravan:<id>`) sai quando ela termina. Nunca sai no `ViewState`.
   */
  rng: Record<string, number[]>;
  /**
   * Contadores de identidade, por tipo de entidade: quantos identificadores `<tipo>-<n>` já
   * foram dados (`ids.ts`). Um tipo só aparece aqui depois da primeira entidade dele, e o
   * contador só sobe: um identificador nunca é reutilizado.
   */
  ids: Record<string, number>;
  settlement: {
    name: string;
    resources: Record<ResourceId, number>;
    accumulators: Record<ResourceId, number>;
    population: { villagers: number };
    workers: Record<ProductionBuildingId, number>;
    /**
     * Nível de cada edifício; 0 é "ainda não construído" (o Celeiro, o Armazém e a Torre de
     * Vigia nascem assim).
     */
    buildings: Record<BuildingId, number>;
    /**
     * Uma posição por fila de obra, sempre `balance.construction.queues` delas; `null` é fila
     * livre. A segunda só recebe obra depois que o Salão chega ao nível que a abre (GDD §6.3):
     * quantas estão abertas é derivado do nível do Salão, nunca guardado.
     */
    constructionQueues: Array<Construction | null>;
    /** As obras planejadas, na ordem em que o jogador as pôs: é a ordem do início automático. */
    planned: PlannedConstruction[];
    /** Um item por aldeão em treinamento, em ordem de conclusão. */
    recruitmentQueue: Array<{ finishesAtMs: number }>;
    /**
     * A fome aberta (GDD §5.6). `sinceMs` é o instante em que ela abriu, ou reabriu.
     * `carriedMs` é o quanto ela já tinha durado antes, quando é a continuação de uma fome que
     * acabou há pouco (zero em uma fome nova): a duração que conta para a moral e para a
     * deserção é `agora − sinceMs + carriedMs`. `deserted` é quantos aldeões o prazo da
     * deserção já cobrou nesta fome: os que saíram e os que o piso impediu de sair.
     */
    famine: { sinceMs: number; carriedMs: number; deserted: number } | null;
    /**
     * A última fome que acabou: quando acabou, quanto tinha durado e quantos aldeões o prazo da
     * deserção tinha cobrado nela. A fome que reabre dentro da janela do conteúdo
     * (`famineResumeWithinRealMs`, em tempo real) é a mesma e continua daqui; passada a
     * janela, o registro fica sem efeito até a próxima fome o trocar. `null` enquanto nenhuma
     * fome acabou, e depois de uma fome ser retomada.
     */
    lastFamine: { endedAtMs: number; lastedMs: number; deserted: number } | null;
    /**
     * O frio: aberto no instante em que a madeira acabou em uma estação que queima lenha
     * (GDD §4.1). Enquanto dura, a produção de todo o feudo cai e a madeira não fica negativa.
     */
    cold: { sinceMs: number } | null;
    /**
     * Desperdício que a Crônica ainda não contou, em milésimos: o que a produção e os ganhos
     * discretos deixaram de pôr no estoque porque ele estava no limite (GDD §5.5). A virada do
     * dia relata as unidades inteiras e deixa aqui o resto, para nada se perder na conta. O
     * total de sempre fica em `stats.wasted_<recurso>`, também em milésimos.
     */
    wasted: Record<ResourceId, number>;
    /**
     * Experiência do ofício de cada edifício produtivo, de 0 ao máximo do conteúdo (GDD §5.4):
     * contada na virada de cada dia de jogo, sobe com o edifício ocupado e cai com ele vazio.
     * Dela sai a mestria, um dos fatores da produção.
     */
    craftExperience: Record<ProductionBuildingId, number>;
    /**
     * O ano de jogo em que cada ofício chegou pela última vez à experiência máxima; 0 é
     * "nunca". Só serve para a Crônica dizer isso uma vez por ano.
     */
    craftMasteredYear: Record<ProductionBuildingId, number>;
    /**
     * Quem trocou de ofício e ainda se adapta, em coortes: quantos, em que edifício e até que
     * instante de jogo rendem só uma fração (GDD §5.4). Em ordem de término; o fim de cada uma
     * é um evento da linha do tempo. Quem não está em coorte nenhuma já é adaptado.
     */
    adaptation: AdaptationCohort[];
    /**
     * A moral do feudo, de 0 a 100 (GDD §5.7). Só muda na virada de cada dia de jogo, quando é
     * recalculada do zero com as condições daquele instante; entre uma virada e outra é o
     * número que entra na produção.
     */
    morale: number;
    /**
     * Efeitos temporários sobre a moral, na ordem em que foram gravados: cartas do Conselho,
     * incursões e objetivos escrevem aqui. Cada um entra como um termo na conta da virada do
     * dia enquanto não vence, e sai da lista na primeira virada em que já não conta.
     */
    moraleEffects: MoraleEffect[];
    /**
     * Os feridos das incursões, em ordem de quem sara primeiro (GDD §8.2). Contam como
     * habitantes (moram e comem), mas não como braços: a soma dos trabalhadores nunca passa
     * dos habitantes que não estão feridos.
     */
    injured: InjuredVillager[];
    /**
     * Os Mestres do feudo, na ordem em que entraram (que é a do identificador). Contam como
     * habitantes (casa, comida, lenha) e **não estão em `population.villagers`**. No máximo um
     * por edifício produtivo, e nunca mais do que `balance.masters.rosterCap` somados aos que
     * esperam.
     */
    masters: Master[];
    /**
     * Os Mestres que chegaram sem vaga nas casas, na ordem de chegada: entram no primeiro
     * instante em que houver uma. Não moram, não comem e não trabalham enquanto esperam.
     */
    mastersWaiting: WaitingMaster[];
  };
  /**
   * O Conselho do Feudo (GDD §7; ADR 0014). Os efeitos temporários de moral que as cartas
   * deixam não ficam aqui: vão para `settlement.moraleEffects`, com os das outras mecânicas.
   */
  council: {
    /** As cartas à espera de resposta, na ordem em que chegaram; no máximo `maxPending`. */
    pending: PendingCard[];
    /** Marcadores narrativos gravados pelas cartas. Atravessam os anos e nunca saem na visão. */
    flags: Record<string, true>;
    /** As cartas que já chegaram neste ano de jogo: só as recorrentes saem de novo. Zera na virada do ano. */
    seenThisYear: string[];
    /**
     * O próximo sorteio. A cadência é ancorada: anda de intervalo em intervalo, sempre, haja
     * ou não carta sorteada. Cai sempre em uma virada de dia de jogo.
     */
    nextDrawAtMs: number;
    /** As continuações agendadas, em ordem de prazo. */
    scheduled: ScheduledCard[];
    /** Os efeitos escondidos que ainda vão acontecer, em ordem de instante. */
    delayed: DelayedCardEffect[];
    /**
     * As ocorrências que expiraram neste ano de jogo: é o que deixa a recusa de uma resposta
     * atrasada dizer que o prazo acabou, e não só que a carta saiu da mesa.
     */
    expired: string[];
  };
  /**
   * O mapa, ainda sem grade (GDD §8.1 e §8.2; ADR 0014, decisão 11): os tiles de ameaça, pela
   * chave de cada um, e a Ameaça, de 0 a 100. Ela só muda na virada de cada dia de jogo e só sai
   * na visão de quem tem a Torre de Vigia.
   */
  map: {
    tiles: Record<string, MapTile>;
    threat: number;
    /**
     * Os destinos que uma expedição revelou (os modelos do conteúdo), na ordem em que foram
     * achados, sem repetição (ADR 0018, decisão 12): é o que abre um destino por descoberta.
     * Moram no mapa: são lugares, e o mapa gráfico da v0.5 os herda.
     */
    discovered: string[];
  };
  /** As incursões marcadas, em ordem de chegada (GDD §8.2). */
  horde: { scheduledRaids: ScheduledRaid[] };
  /**
   * Os heróis, o soldo deles e as expedições (GDD §9.1 e §9.2; ADR 0017 e 0018). O edifício da
   * Guilda dos Aventureiros está em `settlement.buildings.guild`.
   */
  guild: {
    /** Os heróis, na ordem em que chegaram; nunca mais do que `balance.heroes.rosterCap`. */
    heroes: Hero[];
    /**
     * Os heróis com nome que uma carta prometeu e que ainda não chegaram, em ordem de instante
     * (ADR 0017, decisão 6): `namedHeroId` é o de `namedHeroes`, no conteúdo, e `atMs`, o
     * instante de jogo em que ele chega. Quem tem o instante vencido espera lugar na lista de
     * heróis, que está no teto, e entra assim que um lugar abrir: uma recompensa nunca se perde.
     * Não é segredo: a visão diz quem vem e quando. Nunca mais do que
     * `balance.heroes.arrivingCap`.
     */
    arriving: ArrivingHero[];
    /**
     * O arsenal: os itens sem dono, na ordem em que chegaram; nunca mais do que
     * `balance.equipment.inventoryCap`. O que um herói leva está em `hero.equipment`.
     */
    inventory: Item[];
    /**
     * O soldo em atraso, aberto no instante em que o ouro acabou com soldo a pagar, no molde
     * de `settlement.famine`. `sinceMs` é o instante em que abriu, ou reabriu; `carriedMs`, o
     * quanto já tinha durado antes, quando é a continuação de um atraso que fechou há pouco: a
     * duração que conta é `agora − sinceMs + carriedMs`. `departed` é quantos heróis o prazo
     * já cobrou neste atraso: os que partiram e os que só os Leais restantes fizeram perdoar.
     */
    wageArrears: { sinceMs: number; carriedMs: number; departed: number } | null;
    /**
     * O último atraso que fechou: quando, quanto tinha durado e quantos heróis tinha cobrado.
     * O atraso que reabre dentro da janela do conteúdo (`arrears.resumeWithinRealMs`, em
     * tempo real) é o mesmo e continua daqui. `null` enquanto nenhum atraso fechou, e depois
     * de um atraso ser retomado.
     */
    lastWageArrears: { endedAtMs: number; lastedMs: number; departed: number } | null;
    /**
     * Os candidatos da Taverna desta rotação, na ordem em que foram sorteados (ADR 0017,
     * decisão 4). Quem é contratado sai; quem sobra sai na rotação seguinte. Vazia sem Taverna.
     * Nunca mais do que a maior lista de `balance.tavern.offersByLevel`.
     */
    tavernOffers: TavernOffer[];
    /**
     * A Taverna além do edifício (que está em `settlement.buildings.tavern`).
     * `nextRotationAtMs` é o instante de jogo da próxima troca de candidatos, ancorado na
     * inauguração: anda `balance.tavern.rotationMs` por vez, sempre; `null` sem Taverna.
     * `festival` é o festival em curso: `untilMs` é o do efeito de moral dele, e a virada de dia
     * que já não o conta o encerra. `lastFestivalAtMs` é o instante do último festival dado, e
     * é o que faz valer "um por estação"; `null` enquanto o feudo nunca deu um.
     */
    tavern: {
      nextRotationAtMs: number | null;
      festival: { untilMs: number } | null;
      lastFestivalAtMs: number | null;
    };
    /**
     * As expedições em curso, na ordem em que partiram (a do identificador). Nunca mais do que
     * o maior número de `balance.expeditions.slotsByGuildLevel`. O fluxo de sorteio de cada uma
     * (`expedition:<id>`) só existe em `rng` enquanto ela está aqui.
     */
    expeditions: Expedition[];
    /**
     * Os relatórios das últimas expedições que voltaram, da mais antiga à mais nova; nunca mais
     * do que `balance.expeditions.reportsKept`.
     */
    reports: ExpeditionReport[];
  };
  /** O Mercado além do edifício (que está em `settlement.buildings.market`). */
  market: MarketState;
  objectives: { active: string[]; completed: string[] };
  stats: Record<string, number>;
};

export type GameEvent = {
  type: GameEventType;
  /** Instante do evento em tempo de jogo. */
  atMs: number;
  /** Frase da Crônica, já pronta em pt-BR. */
  text: string;
  data: Record<string, string | number>;
};

export type Command =
  | {
      commandId: string;
      type: 'setWorkers';
      payload: { building: ProductionBuildingId; count: number };
    }
  | { commandId: string; type: 'startConstruction'; payload: { building: BuildingId } }
  | { commandId: string; type: 'cancelConstruction'; payload: { building: BuildingId } }
  | {
      commandId: string;
      type: 'planConstruction';
      /**
       * `autoStart` marca a planejada como "iniciar quando houver recursos"; sem ele, manual.
       * `targetLevel` é o nível que a tela mostrava ao jogador: se a obra a planejar já não é a
       * desse nível (outra aba passou na frente), a ordem é recusada em vez de valer para outro.
       */
      payload: {
        building: BuildingId;
        autoStart?: boolean | undefined;
        targetLevel?: number | undefined;
      };
    }
  | { commandId: string; type: 'unplanConstruction'; payload: { building: BuildingId } }
  | {
      commandId: string;
      type: 'setAutoStart';
      /** `targetLevel`, como em `planConstruction`: o nível da planejada que a tela mostrava. */
      payload: { building: BuildingId; autoStart: boolean; targetLevel?: number | undefined };
    }
  | { commandId: string; type: 'recruitVillagers'; payload: { quantity: number } }
  | { commandId: string; type: 'renameSettlement'; payload: { name: string } }
  | {
      commandId: string;
      type: 'answerCard';
      /** `instanceId` é a ocorrência que a tela mostrava; `optionId`, a opção escolhida. */
      payload: { instanceId: string; optionId: string };
    }
  /** Dispensa um herói que está no feudo, sem devolução (GDD §9.1). `heroId` é o da visão. */
  | { commandId: string; type: 'dismissHero'; payload: { heroId: string } }
  /** Contrata um candidato da Taverna (GDD §9.1). `offerId` é o da visão. */
  | { commandId: string; type: 'hireHero'; payload: { offerId: string } }
  /** Dá um festival na Taverna (GDD §5.7 e §6.1): um por estação. */
  | { commandId: string; type: 'holdFestival'; payload: Record<string, never> }
  /**
   * Envia uma expedição (GDD §9.2). `modelId` e `heroIds` são os da visão; `posture` é quem
   * decide na encruzilhada se o senhor não responder no prazo.
   */
  | {
      commandId: string;
      type: 'sendExpedition';
      payload: { modelId: string; heroIds: string[]; posture: PostureId };
    }
  /** Escolhe o caminho de uma expedição parada em uma encruzilhada (GDD §9.2). */
  | {
      commandId: string;
      type: 'chooseExpeditionPath';
      payload: { expeditionId: string; optionId: string };
    }
  /** Põe um item do arsenal no espaço dele em um herói que está no feudo (GDD §9.1). */
  | { commandId: string; type: 'equipItem'; payload: { heroId: string; itemId: string } }
  /** Devolve ao arsenal o que um herói leva em um espaço (GDD §9.1). */
  | { commandId: string; type: 'unequipItem'; payload: { heroId: string; slot: ItemSlotId } }
  /**
   * Compra ou vende no Mercado, por ouro (GDD §5.9). `amount` são unidades inteiras; `quoteDay`
   * é o da visão (`market.quoteDay`): se o dia de jogo virou desde então, o preço é outro e a
   * ordem é recusada.
   */
  | {
      commandId: string;
      type: 'trade';
      payload: {
        resource: MarketResourceId;
        direction: TradeDirectionId;
        amount: number;
        quoteDay: number;
      };
    }
  /**
   * Manda uma caravana vender longe (GDD §5.9; ADR 0018, decisão 17): um recurso, `amount`
   * unidades inteiras, pelo preço de venda de agora vezes a fração do conteúdo, fixado nesta
   * ordem. `escortHeroId` é o herói que vai com ela, ou `null` para mandá-la sem escolta.
   * `quoteDay` é o `market.quoteDay` da visão que o jogador viu: se o dia de jogo virou, o preço
   * fixado não é o que ele conferiu, e a ordem é recusada (`PRICE_CHANGED`), como em `trade`.
   */
  | {
      commandId: string;
      type: 'sendCaravan';
      payload: {
        resource: MarketResourceId;
        amount: number;
        escortHeroId: string | null;
        quoteDay: number;
      };
    }
  /**
   * Põe um Mestre para trabalhar em um edifício produtivo, ou o deixa sem edifício
   * (`building: null`) (GDD §5.4; ADR 0018, decisão 18). `masterId` é o identificador que a
   * visão mostra (`masters[].id`). Chegar a um edifício custa a adaptação.
   */
  | {
      commandId: string;
      type: 'assignMaster';
      payload: { masterId: string; building: ProductionBuildingId | null };
    };

export type CommandType = Command['type'];

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
  'HERO_NOT_FOUND',
  'TAVERN_REQUIRED',
  'OFFER_GONE',
  'HERO_LIMIT',
  'FESTIVAL_ALREADY_HELD',
  'HERO_BUSY',
  'GUILD_REQUIRED',
  'EXPEDITION_LIMIT',
  'EXPEDITION_LOCKED',
  'HERO_UNAVAILABLE',
  'TEAM_INVALID',
  'EXPEDITION_NOT_WAITING',
  'CROSSROADS_DECIDED',
  'ITEM_NOT_FOUND',
  'WRONG_SLOT',
  'INVENTORY_FULL',
  'MARKET_REQUIRED',
  'INVALID_AMOUNT',
  'PRICE_CHANGED',
  'DAILY_VOLUME_EXCEEDED',
  'STORAGE_FULL',
  'MARKET_LEVEL_REQUIRED',
  'CARAVAN_LIMIT',
  'MASTER_NOT_FOUND',
  'MASTER_WAITING',
  'BUILDING_HAS_MASTER',
  'NOT_A_PRODUCTION_BUILDING',
] as const;
export type RejectionCode = (typeof REJECTION_CODES)[number];

export type Rejection = { code: RejectionCode; message: string };

export type CommandResult =
  | { ok: true; state: GameState; events: GameEvent[] }
  | { ok: false; code: RejectionCode; message: string };

export type ResourceCostView = {
  resource: ResourceId;
  label: string;
  amount: number;
  /** Quanto falta no estoque para pagar; 0 quando há o bastante. */
  missing: number;
};

export type UpgradeView = {
  building: BuildingId;
  label: string;
  fromLevel: number;
  targetLevel: number;
  cost: ResourceCostView[];
  /** Prazo se a obra começar agora, já com o fator da estação. */
  durationSeconds: number;
  /**
   * Por que o prazo não é o de tabela: "No Inverno, o prazo de uma obra iniciada agora é × 1,5."
   * `null` quando a estação não mexe nele.
   */
  durationNote: string | null;
  affordable: boolean;
  /** Código e motivo pelo qual a obra não pode começar agora; `null` quando pode. */
  blockedCode: RejectionCode | null;
  blockedReason: string | null;
  planned: boolean;
  /**
   * O que a obra muda, ao lado do que ela custa: "Capacidade de comida: 500 → 1.000."; "Mostra a
   * Ameaça com a explicação e avisa de uma incursão 20 min antes."; "Segura ataques leves, sem
   * perda nem ferido; os médios passam, mas com metade do estrago." Os edifícios de
   * armazenamento, a Torre de Vigia e a Paliçada trazem a frase; nos outros é `null`.
   */
  effect: string | null;
};

/**
 * Por que uma obra planejada ainda não começou, e quando a espera acaba. A frase vem pronta e
 * sem o prazo, que anda sozinho na tela: a interface mostra `text` e, quando há `etaSeconds`,
 * acrescenta ": em 2 h 10 min".
 */
export type PlannedWaitingView = {
  /**
   * `upgrading`: o edifício tem outra obra antes desta. `gate`: falta o nível de outro
   * edifício (quase sempre, o Salão). `capacity`: o custo não cabe no depósito. `resources`:
   * falta recurso que a produção ainda junta. `queue`: os pedreiros estão ocupados.
   */
  reason: 'queue' | 'resources' | 'capacity' | 'gate' | 'upgrading';
  /** "espera 120 de madeira"; "não cabe no Armazém: amplie-o". Minúscula, sem ponto final. */
  text: string;
  /**
   * Segundos reais até a espera acabar, com as taxas de agora; `null` quando esperar não
   * resolve (é preciso uma ordem do jogador) ou quando não há como prever.
   */
  etaSeconds: number | null;
};

type PlannedExtras = {
  /** Marcada "iniciar quando houver recursos": o motor a inicia sozinho assim que puder. */
  autoStart: boolean;
  /** O que a obra espera para começar; `null` quando já pode ser iniciada (só nas manuais). */
  waiting: PlannedWaitingView | null;
};

/**
 * Uma obra planejada, na ordem da lista: o orçamento dela, como o de qualquer obra, e mais se é
 * automática e o que ela espera. É um objeto só (e não uma interseção de dois), para ser o
 * mesmo tipo que o protocolo infere do schema.
 */
export type PlannedUpgradeView = {
  [Key in keyof (UpgradeView & PlannedExtras)]: (UpgradeView & PlannedExtras)[Key];
};

/** Uma obra em curso em uma das filas. */
export type ActiveConstructionView = {
  building: BuildingId;
  label: string;
  targetLevel: number;
  secondsRemaining: number;
  totalSeconds: number;
  progressPercent: number;
  /**
   * O que volta ao estoque se a obra for cancelada agora, em unidades: `amount` é o que
   * entra e `lost`, o que não cabe no depósito e se perde.
   */
  refund: Array<{ resource: ResourceId; label: string; amount: number; lost: number }>;
};

/**
 * Onde um objetivo se cumpre: o ofício, o edifício, o recrutamento, o Conselho, a lista de obras
 * planejadas ou uma estação. É o que deixa a interface levar o jogador até lá sem conhecer
 * objetivo nenhum pelo id.
 */
export type ObjectiveTarget =
  | { kind: 'workers'; building: ProductionBuildingId }
  | { kind: 'building'; building: BuildingId }
  | { kind: 'recruitment' }
  | { kind: 'council' }
  | { kind: 'planned' }
  | { kind: 'season'; season: SeasonId };

/** Um Objetivo do Senhor (GDD §12.2): a ação, o porquê, a recompensa e o que falta. */
export type ObjectiveView = {
  id: string;
  /** A ação, no imperativo e sem ponto: "Construa a Torre de Vigia". */
  title: string;
  /** O porquê, em uma frase: é ele que ensina. */
  hint: string;
  /**
   * A recompensa, sem ponto: "+40 pedra"; "+10 de moral por 1 dia de jogo (40 min)", com o
   * prazo de quem joga entre parênteses; "desbloqueia o Celeiro, o Armazém e a Torre de Vigia".
   */
  reward: string;
  status: 'active' | 'completed';
  progress: { current: number; target: number };
  /**
   * O que falta agora, em uma frase pronta: "Melhore antes o Salão do Senhor para o nível 2.";
   * "Faltam 40 pedra."; "Nenhuma carta espera resposta: vale a próxima que o Conselho trouxer."
   * `null` no objetivo concluído e naquele a que só falta uma ordem que o jogador já pode dar.
   */
  missing: string | null;
  /** Onde ele se cumpre. No de vários edifícios, o que está mais perto de ficar pronto. */
  target: ObjectiveTarget;
};

/**
 * A conta da lenha de uma estação que queima madeira (GDD §4.1), feita com os habitantes e os
 * trabalhadores de agora, em unidades inteiras. No outono é a previsão do inverno inteiro; no
 * inverno, do que falta até a primavera. É o que responde "quanta madeira preciso guardar?".
 */
export type FirewoodView = {
  /** Madeira queimada por hora real. */
  perHour: number;
  /** Madeira que a lareira queima no prazo da conta. */
  winterTotal: number;
  /** Madeira que a Serraria entrega no mesmo prazo. */
  winterProduction: number;
  /** Madeira em estoque agora. */
  stock: number;
  /**
   * Madeira que a Serraria ainda junta antes de a estação da conta começar, até onde o depósito
   * guarda. 0 dentro da estação, e quando a comida acaba antes (a visão não adivinha).
   */
  gathered: number;
  /**
   * Madeira que as obras planejadas automáticas vão levar do estoque antes de o prazo da conta
   * acabar: o motor as inicia sozinho, sem olhar a lenha (GDD §6.3). 0 quando nenhuma começa.
   */
  reserved: number;
  /**
   * Quanto falta guardar para a lareira não apagar, já com o que a Serraria junta até lá e sem
   * o que as obras automáticas levam; 0 quando o estoque e a Serraria cobrem. É o maior entre o
   * que falta na soma do prazo inteiro e o que falta antes disso, quando a Serraria só alcança
   * a lareira mais adiante (depois da virada do dia que muda a moral, ou do fim de uma
   * adaptação): aí pode ser positivo com `winterProduction + stock` acima de `winterTotal`.
   */
  missing: number;
  /** A conta em uma frase, pronta para exibir. */
  text: string;
};

/**
 * A comida na estação que vem (GDD §4.1 e §5.6): o saldo logo depois da virada e, se ele não
 * cobre as bocas, quando a comida acaba. A conta parte do que a virada deve encontrar no
 * estoque, com os habitantes e os trabalhadores de agora, e segue pela estação com o que o
 * ofício e a moral mudam sozinhos. É o que responde "posso sair sem olhar para a Fazenda?"
 * quando o prazo da estação de agora (`resources[].depletesInSeconds`) ainda não diz nada.
 */
export type FoodForecastView = {
  /** Saldo de comida por hora real logo depois da virada. */
  perHour: number;
  /** Comida que a virada deve encontrar em estoque, em unidades. */
  stockAtTurn: number;
  /**
   * Segundos reais, a contar de agora, até a comida acabar na estação que vem. `null` quando
   * ela cresce ou atravessa a estação, e quando a lenha acaba antes: com o frio a conta é outra.
   */
  depletesInSeconds: number | null;
  /** A conta em uma frase, pronta para exibir. */
  text: string;
};

/** O que a moral vale: o número, a faixa e o fator que ela põe na produção. */
export type MoraleLevelView = {
  /** De 0 a 100. */
  value: number;
  band: MoraleBandId;
  /** "Inquieto". */
  bandLabel: string;
  /**
   * O fator da moral na produção, em centésimos: 109 é "produção × 1,09"; 75, "× 0,75". Tem
   * meia unidade com a moral ímpar (51 dá 100,5).
   */
  multiplierPercent: number;
};

/**
 * A moral do feudo (GDD §5.7). Ela só muda na virada do dia: `value` é a que está valendo
 * desde a última virada, e `terms`, a conta que a **próxima** virada vai fazer se nada mudar
 * até lá. Quando as duas não coincidem (a fome começou há pouco, a despensa encheu), `next` e
 * `nextText` dizem para onde a moral vai, antes de ela ir.
 */
export type MoraleView = {
  /** De 0 a 100: a moral que vale desde a última virada do dia. */
  value: number;
  band: MoraleBandId;
  bandLabel: string;
  /** O fator da moral na produção agora, em centésimos (ver `MoraleLevelView`). */
  multiplierPercent: number;
  /** "Moral 68 (Contente): produção × 1,09." */
  text: string;
  /**
   * Os termos da conta que a próxima virada vai fazer se nenhuma ordem chegar antes, a começar
   * pela base: já contam com o que acontece até lá (a comida que o consumo leva, o aldeão que
   * chega, a fome que abre). A soma deles, limitada a 0–100, é `next.value`. Um termo só
   * aparece quando vale: sem fome, não há termo de fome.
   */
  terms: Array<{ id: MoraleTermId; label: string; amount: number }>;
  /** A mesma conta em uma linha: "50 (base) + 10 (comida guardada para 8 h) − 10 (casas cheias) = 50". */
  breakdown: string;
  /** Segundos reais até a próxima virada do dia, quando a moral é recalculada. */
  nextUpdateInSeconds: number;
  /** O que a próxima virada faz da moral, se nada mudar até lá. */
  next: MoraleLevelView;
  /**
   * "A moral só muda na virada do dia: na próxima, cai de 60 para 30 (Inquieto)." Quando nada
   * muda: "A moral só muda na virada do dia: na próxima, continua em 60."
   */
  nextText: string;
  /**
   * O que fazer: o termo que mais pesa na conta e a ação que o tira dela. Sem nada pesando,
   * diz como ganhar o bônus da comida guardada, se ele falta. `null` quando não há o que
   * melhorar por ação do jogador.
   */
  advice: string | null;
  /**
   * A comida guardada que vale o bônus: quanto é preciso ter e quanto falta **agora**, em
   * unidades. `holdsAtNextTurn` diz se a próxima virada do dia vai encontrá-la (é ela que
   * decide o bônus): o consumo pode levá-la antes, e a produção pode completá-la.
   */
  foodReserve: {
    covered: boolean;
    holdsAtNextTurn: boolean;
    /** Comida que cobre o prazo do bônus com os habitantes de agora. */
    needed: number;
    /** Quanto falta no estoque; 0 quando já cobre. */
    missing: number;
    /** O bônus, em pontos de moral. */
    bonus: number;
    /** "Com 120 de comida guardada (o que 5 habitantes comem em 8 h), a moral ganha 10." */
    text: string;
  };
  /**
   * O que a moral e a fome longa fazem com a população nas viradas do dia, em frases prontas:
   * a chance de um colono chegar, a de um aldeão partir, a deserção por fome e o piso. Vazio
   * quando nada disso está em jogo.
   */
  notes: string[];
  /**
   * Efeitos temporários que a moral carrega ou vai carregar (cartas, incursões, objetivos).
   * `endsInSeconds` são os segundos reais até a virada do dia em que o efeito sai da conta.
   */
  effects: Array<{ label: string; amount: number; endsInSeconds: number }>;
};

/** Uma opção de uma carta do Conselho, com o custo e a consequência conhecida lado a lado. */
export type CouncilOptionView = {
  id: string;
  /** "Ceder a madeira". */
  label: string;
  /** O que a opção cobra, com o que falta de cada recurso; vazio quando não custa nada. */
  cost: ResourceCostView[];
  /** O estoque paga o custo agora. */
  affordable: boolean;
  /** A opção exige algo que o feudo não tem (um edifício, um estoque mínimo). */
  locked: boolean;
  /** "Requer o Celeiro."; `null` quando não está trancada. */
  lockedReason: string | null;
  /**
   * O custo e a consequência **conhecida**, em uma frase pronta: "−40 madeira; +5 de moral por 2
   * dias de jogo (1 h 20 min)". O que a opção esconde não aparece aqui nem em lugar nenhum da
   * visão: só a pista, em `hint`.
   */
  effectsText: string;
  /** A pista do que pode vir depois. */
  hint: string;
};

/** Uma carta do Conselho à espera de resposta. */
export type CouncilCardView = {
  /** O que `answerCard` recebe: a ocorrência, não o modelo. */
  instanceId: string;
  title: string;
  /** A situação, já na variante que lembra a escolha anterior, quando há. */
  text: string;
  /** Segundos reais até o conselho decidir sozinho. */
  expiresInSeconds: number;
  /** A opção que o conselho aplica se o prazo acabar, na dificuldade desta partida. */
  defaultOptionId: string;
  defaultOptionLabel: string;
  /** "Sem resposta até o fim do prazo, o conselho decide sozinho: conservar as reservas." */
  expiryNote: string;
  /**
   * De onde a história vem, quando a carta é a continuação de outra: a carta anterior, a opção
   * que foi aplicada nela (pelo senhor ou, sem resposta, pelo conselho) e a frase pronta. `null`
   * na carta que veio do sorteio.
   */
  followsFrom: { title: string; optionLabel: string; text: string } | null;
  options: CouncilOptionView[];
};

/** O Conselho do Feudo na visão (GDD §7). Flags e efeitos escondidos nunca saem daqui. */
export type CouncilView = {
  /** As cartas à espera, na ordem em que chegaram. */
  pending: CouncilCardView[];
  /**
   * Segundos reais até a próxima audiência, **se ela puder trazer carta**. `null` quando não
   * pode: as pendentes ocupam a mesa (`blockedByPending`) ou o conselho não tem assunto para o
   * feudo como ele está (`note` diz qual dos dois).
   */
  nextCardInSeconds: number | null;
  /**
   * Na próxima audiência a mesa ainda vai estar cheia, se nenhuma carta for respondida até lá:
   * o sorteio daquele instante é pulado.
   */
  blockedByPending: boolean;
  /** Segundos reais até a próxima audiência, traga ela carta ou não. */
  nextAudienceInSeconds: number;
  /** Por que a próxima audiência não traz carta, e o que fazer; `null` quando ela pode trazer. */
  note: string | null;
  /** As regras em uma frase, no ritmo da partida: a cadência, o limite e o prazo de resposta. */
  rulesText: string;
};

/**
 * Uma decisão à espera do jogador: uma carta do Conselho (`id` é o `instanceId`) ou uma
 * expedição parada em uma encruzilhada (`id` é o da expedição).
 */
export type PendingDecisionView =
  | { kind: 'card'; id: string; title: string; expiresInSeconds: number }
  | { kind: 'crossroads'; id: string; title: string; expiresInSeconds: number };

/**
 * A Torre de Vigia, como o painel da Ameaça a mostra: o que ela faz hoje e o que o próximo nível
 * passaria a fazer. O custo e o botão da obra estão em `constructions.available`.
 */
export type ThreatWatchtowerView = {
  /** O edifício da Torre: é o que `startConstruction` recebe e o que a lista de obras mostra. */
  building: BuildingId;
  /** 0 enquanto não foi construída. */
  level: number;
  /** "Torre de Vigia Nv1: mostra a Ameaça com a explicação e avisa de uma incursão 20 min antes." */
  text: string;
  /**
   * O que a próxima obra da Torre muda: "Construa a Torre de Vigia: ela mostra a Ameaça…";
   * `null` com a Torre no teto desta versão (`text` diz que os níveis seguintes vêm depois).
   */
  next: string | null;
};

/**
 * O que protege o feudo de um ataque hoje, e o que a próxima obra da Paliçada mudaria. Sai nas
 * duas formas da Ameaça: só depende do nível da Paliçada, que o jogador conhece. O custo e o
 * botão da obra estão em `constructions.available`.
 */
export type ThreatDefenseView = {
  /** O edifício da Paliçada: é o que `startConstruction` recebe e o que a lista de obras mostra. */
  building: BuildingId;
  /** 0 enquanto não foi construída. */
  palisadeLevel: number;
  /**
   * "Sem Paliçada, nada segura um ataque."; "Paliçada Nv1: segura ataques leves, sem perda nem
   * ferido; os médios passam, mas com metade do estrago."
   */
  text: string;
  /**
   * O que a próxima obra da Paliçada muda: "Paliçada Nv2: passa a segurar também os ataques
   * médios, sem perda nem ferido."; `null` com a Paliçada no teto desta versão (`text` diz o
   * que vem depois).
   */
  next: string | null;
};

/** Uma incursão que os vigias já avistaram. Só existe para quem tem a Torre de Vigia. */
export type ThreatIncomingView = {
  enemy: EnemyId;
  /** "Lobos". */
  enemyLabel: string;
  /** Segundos reais até a incursão chegar. */
  inSeconds: number;
  /** "uma matilha pequena"; `null` quando a Torre ainda não distingue o tamanho. */
  sizeText: string | null;
  /** "Lobos a caminho. Os vigias contam uma matilha pequena." O prazo anda na tela: fica em `inSeconds`. */
  text: string;
  /**
   * O que este ataque custa a um feudo sem defesa, com os números do conteúdo e o estoque de
   * agora: "Uma matilha pequena leva 10% da comida e da madeira (hoje, 32 e 30) e fere 1
   * aldeão por 40 min." Sem o tamanho à vista, diz os dois extremos. É o custo ao lado do que
   * a Paliçada faz (`defenseText`).
   */
  costText: string;
  /**
   * O que a Paliçada faz a esta incursão: "A Paliçada Nv1 segura este ataque: sem perda nem
   * ferido."; "Sem Paliçada, nada segura este ataque." Enquanto a Torre não distingue o
   * tamanho, a frase vale para qualquer um ("…se ele for dos leves; se for dos médios, ele
   * passa, mas com metade do estrago") e não o revela. Com a obra da Paliçada em curso, conta
   * o nível com que o ataque vai encontrá-la ("A Paliçada Nv1, que fica pronta a tempo, …") ou
   * avisa que não dá tempo ("A obra em curso só termina depois dele.").
   */
  defenseText: string;
};

/**
 * A Ameaça (GDD §8.2). **Sem a Torre de Vigia, só sai o que o jogador já sabe**: que não tem
 * Torre e o que protege o feudo. O número, a tendência, as origens e as incursões marcadas não
 * saem do servidor (roadmap da v0.2, §0.7, "Visão e privacidade narrativa"). Por isso são duas
 * formas, e não campos opcionais: quem lê confere `known` antes de procurar o número.
 */
export type ThreatView =
  | {
      known: false;
      /** "Sem uma Torre de Vigia, ninguém sabe o que ronda o feudo." */
      text: string;
      /** Sem Torre não há aviso: sempre `null`. */
      incoming: null;
      /**
       * O que o jogador sabe por ter feito: "O Covil de Lobos está limpo até a virada do ano."
       * `null` sem tile limpo. Não diz o número da Ameaça.
       */
      clearedText: string | null;
      watchtower: ThreatWatchtowerView;
      defense: ThreatDefenseView;
    }
  | {
      known: true;
      /** "Ameaça 45 de 100." */
      text: string;
      /** De 0 a `max`. */
      level: number;
      /** O fim da barra. */
      max: number;
      /** Quanto a próxima virada do dia soma, já com o limite: 0 com a Ameaça no máximo. */
      risePerDay: number;
      /**
       * A Ameaça depois da próxima virada do dia: a subida e, com uma incursão à vista que chega
       * até lá, a queda dela. A incursão que os vigias ainda não viram não entra.
       */
      nextLevel: number;
      /** Segundos reais até a próxima virada do dia, quando a Ameaça sobe. */
      nextRiseInSeconds: number;
      /** "Sobe 5 a cada dia de jogo (40 min): na próxima virada, vai de 45 para 50." */
      trend: string;
      /** De onde vem a subida, um termo por linha: "+2/dia: Covil de Lobos", "+3/dia: outono". */
      sources: string[];
      /** Os tiles de ameaça conhecidos, em lista (GDD §8.1): o mapa gráfico é de outra versão. */
      tiles: Array<{ id: string; label: string; active: boolean }>;
      /**
       * A chance, em %, de a próxima virada do dia marcar uma incursão, com a Ameaça que essa
       * virada vai dar: o que ela passa do limiar. 0 enquanto não passa, e com uma incursão já
       * à vista (só há uma a caminho por vez).
       */
      raidChancePercent: number;
      /**
       * A regra das incursões, em frases prontas e no ritmo da partida: "Na próxima virada do
       * dia, a chance de os vigias perderem o sono é de 25% (a Ameaça menos 40)…". Diz também o
       * tamanho que a Ameaça de agora traz e que toda incursão a faz cair.
       */
      raidRisk: string;
      /**
       * O que cada tamanho de incursão custa a um feudo sem defesa, um por linha, e o que fica
       * depois: "Ataques leves: levam 10% do estoque de comida e madeira e ferem 1 aldeão.";
       * "Quem se fere fica 40 min sem trabalhar e volta ao ofício sozinho. Um ataque com perdas
       * tira 10 da moral por 2 dias de jogo (1 h 20 min)."
       */
      raidCosts: string[];
      /** A incursão que os vigias já avistaram; `null` quando não há nenhuma à vista. */
      incoming: ThreatIncomingView | null;
      /** "O Covil de Lobos está limpo até a virada do ano."; `null` sem tile limpo. */
      clearedText: string | null;
      watchtower: ThreatWatchtowerView;
      defense: ThreatDefenseView;
    };

/** Um item na visão: o nome, o espaço, a raridade e o que soma, em palavras. */
export type ItemView = {
  /** O identificador que `equipItem` recebe. */
  id: string;
  label: string;
  /** A frase de crônica do item. */
  text: string;
  slot: ItemSlotId;
  /** "Arma". */
  slotLabel: string;
  /** "Raro". */
  rarityLabel: string;
  /** "+12% de poder". */
  bonusText: string;
  /** O mesmo ganho, em pontos percentuais: 12. É o que deixa comparar dois itens do mesmo espaço. */
  bonusPercent: number;
};

/** Um herói na visão (GDD §9.1): a ficha, com o poder explicado e o soldo no relógio de quem joga. */
export type HeroView = {
  /** O identificador que `dismissHero` recebe. */
  id: string;
  name: string;
  /** "Guerreiro". */
  classLabel: string;
  level: number;
  /** Experiência acumulada no nível de agora. */
  xp: number;
  /** Quanto falta juntar, no total, para o nível seguinte; `null` no nível máximo. */
  xpToNext: number | null;
  /** Os traços, com o nome e a frase do que cada um faz nesta versão. */
  traits: Array<{ label: string; text: string }>;
  /** "No feudo", "Em expedição", "Em recuperação: volta a poder partir em 1 h 10 min", "Em cativeiro desde …". */
  statusText: string;
  /** Está no feudo (pronto ou em recuperação): pode ser dispensado e equipado. */
  atHome: boolean;
  /** Está no feudo e sem ferimento: pode partir em uma expedição. */
  canDepart: boolean;
  /** O ferimento que ainda não sarou, com o prazo em segundos reais; `null` sem ele. */
  injury: { severityLabel: string; recoversInSeconds: number } | null;
  /** Está em cativeiro: não recebe soldo e só volta com um Resgate. */
  captive: boolean;
  /**
   * É quem o próximo Resgate solta: entre os cativos, o que está lá há mais tempo. Com dois
   * cativos, só um tem a marca; a tela põe "Enviar o Resgate" na ficha dele.
   */
  nextRescued: boolean;
  /**
   * Pode ser dispensado agora: quem está no feudo, e quem está em cativeiro (é desistir dele),
   * salvo com um Resgate a caminho. Quem está em expedição espera a volta.
   */
  canDismiss: boolean;
  /**
   * O aviso para confirmar a dispensa deste herói (o do cativo diz que é para sempre e que o
   * que ele levava se perde) ou, quando não pode, o motivo, em uma frase.
   */
  dismissText: string;
  /** Os três espaços, na ordem do conteúdo, com o que ele leva em cada um; `item` é `null` no vazio. */
  equipment: Array<{ slot: ItemSlotId; slotLabel: string; item: ItemView | null }>;
  /** O poder do herói agora, com nível e Descontente: ataque + defesa + vida ÷ 10, vezes os fatores. */
  power: number;
  /** "(14 de ataque + 16 de defesa + 120 de vida ÷ 10) × 1,08 (Nv2) × 0,8 (descontente) = 36,288". */
  powerBreakdown: string;
  /** O soldo dele, em ouro por hora real: o do nível dele; zero para quem está em cativeiro. */
  wagePerHour: number;
  /**
   * O soldo que ele passa a cobrar no próximo nível, em ouro por hora real; `null` no nível
   * máximo. O soldo muda no instante em que ele sobe de nível.
   */
  wageNextLevelPerHour: number | null;
  /** "O soldo de Edda sobe para 9/h no próximo nível."; `null` no nível máximo. */
  wageNextLevelText: string | null;
  /** Descontente com o soldo em atraso: os atributos valem menos enquanto o atraso durar. */
  discontent: boolean;
};

/**
 * O soldo em atraso na visão (GDD §9.1). Os prazos são segundos reais até a **virada de dia**
 * que cobra cada consequência: é nela, e não no instante exato do prazo, que acontece.
 */
export type WageArrearsView = {
  /**
   * Há quantos segundos reais o atraso dura, na conta dos prazos: o que reabre pouco depois de
   * fechar é o mesmo, e o que ele já tinha durado antes entra aqui.
   */
  secondsElapsed: number;
  /** O que o atraso custa, os prazos em tempo real e o que fazer, em frases prontas. */
  text: string;
  /**
   * Segundos reais até quem não é Leal ficar Descontente; `null` quando não há quem fique
   * (todos já estão, ou são Leais).
   */
  discontentInSeconds: number | null;
  /**
   * Segundos reais até o próximo herói partir; `null` quando ninguém parte (no feudo só há
   * Leais).
   */
  nextDepartureInSeconds: number | null;
};

/** Um herói a caminho do feudo: quem é e em quanto tempo real chega. */
export type ArrivingHeroView = {
  name: string;
  /** "Arqueiro". */
  classLabel: string;
  traits: Array<{ label: string; text: string }>;
  /** Segundos reais até ele chegar; zero quando o prazo já venceu e ele espera lugar. */
  arrivesInSeconds: number;
  /** Por que ele ainda não entrou, com o prazo vencido; `null` enquanto está a caminho. */
  blockedReason: string | null;
};

/** Uma Postura, como a tela a oferece no envio. */
export type PostureView = { id: PostureId; label: string; text: string };

/**
 * Um destino que a Guilda oferece (ADR 0018, decisão 13): o que o jogador sabe antes de enviar.
 * Só o primeiro trecho, até a primeira encruzilhada; o que vem depois não sai do servidor.
 */
export type ExpeditionOfferView = {
  /** O identificador que `sendExpedition` recebe. */
  modelId: string;
  label: string;
  /** "Baixo", "Baixo a médio". */
  riskText: string;
  /** A duração anunciada de quem enviasse agora, em segundos reais, sem a espera das encruzilhadas. */
  durationSeconds: number;
  /** O que a duração não conta (a espera na encruzilhada) e, no verão, por que ela é mais curta. */
  durationNote: string;
  /** "Equipe: 1 herói." */
  requirementsText: string;
  teamMin: number;
  teamMax: number;
  /** O nível que todo herói da equipe precisa ter: o mesmo que `requirementsText` diz. */
  teamMinLevel: number;
  /**
   * A maior dificuldade do primeiro trecho, a mesma que `firstStretchText` escreve; `null` quando
   * o trecho não tem prova. Com o `power` de cada herói, é o que deixa dizer se a equipe passa
   * com folga, sem ler o número em uma frase.
   */
  firstStretchDifficulty: number | null;
  /**
   * O que a equipe precisa valer contra a prova mais dura do primeiro trecho (ADR 0018, decisão
   * 13); `null` quando o trecho não tem prova. Com `comfortPower` ou mais, nem a pior sorte tira
   * o Sucesso ("folgada"); abaixo de `riskPower`, a pior sorte dá Desastre ("arriscada"); entre
   * os dois, a equipe vai "justa". `text` diz o mesmo em uma frase.
   */
  fit: { comfortPower: number; riskPower: number; text: string } | null;
  /**
   * O poder de cada herói que pode partir agora **contra essa prova**, com os pesos dela (a
   * perícia que um nó pesa não aparece no poder da ficha). A equipe vale a soma. Sem prova à
   * vista, é o poder da ficha.
   */
  heroFit: Array<{ heroId: string; power: number }>;
  /** A ordem de envio seria recusada agora para qualquer equipe, pelo destino (não pela equipe). */
  locked: boolean;
  lockedReason: string | null;
  /**
   * Quem pode ir a este destino agora, na ordem da lista do feudo: está pronto e tem o nível
   * que o modelo pede. A classe exigida é da equipe, não de cada um (`canSend` e
   * `suggestedTeam` contam com ela).
   */
  eligibleHeroIds: string[];
  /**
   * Existe agora uma equipe que a ordem de envio aceitaria: o destino está aberto, há lugar na
   * Guilda e os heróis prontos cobrem o tamanho, o nível e a classe que o modelo pede. É a
   * mesma conta da recusa da ordem (`teamShortfall`).
   */
  canSend: boolean;
  /**
   * A equipe que o motor montaria: a menor que serve, com um herói de cada classe exigida e os
   * mais fortes contra o primeiro trecho. Vazia quando `canSend` é falso. É o que a tela marca
   * de saída.
   */
  suggestedTeam: string[];
  /**
   * Por que nenhuma equipe pode partir agora, em uma frase: a de `lockedReason` quando o
   * destino está fechado, ou o que falta à equipe ("Nenhuma equipe do feudo serve agora: falta
   * um Mago."). `null` quando `canSend`.
   */
  sendBlockedReason: string | null;
  /** Os nós do primeiro trecho, com a dificuldade de cada um, e o que vem depois dele. */
  firstStretchText: string;
  /**
   * É o Resgate: o destino que só existe com alguém em cativeiro e que o traz de volta. A tela
   * o oferece ao lado de quem está lá ("Enviar o Resgate"), sem conhecer o nome do modelo.
   */
  rescue: boolean;
};

/**
 * Um passo do relatório: o nó, a frase e o desfecho em palavra. `notes` é o que o passo fez à
 * equipe e ao mundo, uma frase por fato: quem se feriu, quem subiu de nível, o que foi achado.
 */
export type ExpeditionLogView = {
  title: string;
  /**
   * A frase do passo, a mesma da Crônica: o que aconteceu, quem se destacou e, no Revés e no
   * Desastre, o que teria ajudado; depois, o que o nó rendeu.
   */
  text: string;
  /**
   * O desfecho do passo, para a tela escolher o ícone que acompanha a palavra (nada é dito só
   * pela cor): os quatro de uma prova, `passed` no trecho sem prova e `chosen` na escolha de
   * uma encruzilhada. `outcomeLabel` é a palavra.
   */
  outcome: 'full' | 'success' | 'setback' | 'disaster' | 'passed' | 'chosen';
  outcomeLabel: string;
  notes: string[];
  /** Quem se destacou em um nó com prova, pelo nome; `null` no resto. */
  standoutName: string | null;
  /** O que o desfecho ruim ensina, a frase que `text` já traz; `null` no resto. */
  lessonText: string | null;
};

/** A encruzilhada em que uma expedição espera: as opções, o prazo real e o que a Postura fará. */
export type CrossroadsView = {
  title: string;
  text: string;
  /** Segundos reais até a Postura decidir. */
  decidesInSeconds: number;
  /** "Equilibrada". */
  postureLabel: string;
  /** A opção que vale no fim do prazo para esta equipe (a da Cautelosa, se a marcada está fora do alcance). */
  postureOptionId: string;
  postureOptionLabel: string;
  /** "Sem resposta, a Postura Equilibrada escolhe: Seguir o riacho." */
  postureText: string;
  options: Array<{
    /** O identificador que `chooseExpeditionPath` recebe. */
    id: string;
    label: string;
    /** A pista do risco e da recompensa. */
    hint: string;
    locked: boolean;
    lockedReason: string | null;
  }>;
};

/** Uma expedição em curso: onde está, quanto falta para o nó de agora e o que já aconteceu. */
export type ExpeditionView = {
  /** O identificador que `chooseExpeditionPath` recebe. */
  id: string;
  label: string;
  postureLabel: string;
  teamNames: string[];
  /** "A caminho: A ronda pelas cercas." */
  statusText: string;
  /** O título do nó em que a equipe está. */
  nodeTitle: string;
  /** Segundos reais até o nó de agora terminar; `null` na encruzilhada. */
  nodeEndsInSeconds: number | null;
  log: ExpeditionLogView[];
  crossroads: CrossroadsView | null;
};

/** O relatório de uma expedição que voltou, nó a nó, com o fecho do que ela trouxe. */
export type ExpeditionReportView = {
  expeditionId: string;
  label: string;
  postureLabel: string;
  teamNames: string[];
  /** O percurso, um passo por nó e por escolha; o último é o caminho de volta, de quem voltou. */
  log: ExpeditionLogView[];
  /** "O preço: Rolf, com um ferimento leve."; "Sem perdas: todos voltaram inteiros." */
  lossesText: string;
  /** "Caminho novo: Ruínas de Vel'Thar. Edda chegou ao nível 2."; `null` sem nenhum. */
  deedsText: string | null;
  /** "Trouxe 22 de ouro."; "Ninguém da equipe voltou: o que traziam se perdeu." */
  lootText: string;
  /** "Para o arsenal: Lança de caça."; `null` sem item. */
  itemsText: string | null;
  /** Ninguém da equipe voltou. */
  lost: boolean;
};

/**
 * Os heróis, o soldo deles e as expedições (GDD §9.1 e §9.2).
 */
export type GuildView = {
  /**
   * A situação da equipe em uma frase, para o alto da aba Guilda: sem herói, como o primeiro
   * chega; com herói e sem a Guilda dos Aventureiros, o que a abre; com ela, quantas expedições
   * sustenta.
   */
  text: string;
  /** O edifício da Guilda dos Aventureiros, como a lista de obras o chama. */
  building: BuildingId;
  /** A Guilda dos Aventureiros está erguida. */
  built: boolean;
  /** O nível dela; zero enquanto não foi erguida. */
  level: number;
  /** Quantas expedições ela sustenta ao mesmo tempo; zero sem ela. */
  slots: number;
  /** As Posturas, para a escolha no envio. */
  postures: PostureView[];
  /** Os destinos que a Guilda conhece; vazia sem ela. */
  available: ExpeditionOfferView[];
  /** As expedições em curso, na ordem em que partiram. */
  expeditions: ExpeditionView[];
  /** Os relatórios guardados, do mais novo ao mais antigo. */
  reports: ExpeditionReportView[];
  /** O que dispensar um herói custa, para a confirmação da ordem: sem devolução. */
  dismissText: string;
  /** Quantos heróis o feudo pode contratar. Uma recompensa pode passar dele; a contratação, não. */
  heroLimit: number;
  /** Na ordem em que chegaram. */
  heroes: HeroView[];
  /** Os heróis que uma carta prometeu e que ainda não chegaram, na ordem em que chegam. */
  arriving: ArrivingHeroView[];
  /** O arsenal: os itens sem dono, na ordem em que chegaram. */
  inventory: ItemView[];
  /** Quantos itens o arsenal guarda. */
  inventoryCap: number;
  /**
   * Os espaços de equipamento de um herói, na ordem do conteúdo, com o nome de cada um: o `id`
   * é o que `unequipItem` recebe em `slot`. Como `postures`, é para a tela não escrever a lista.
   */
  equipmentSlots: Array<{ id: ItemSlotId; label: string }>;
  /** "Arsenal: 3 de 30 itens.", ou o que acontece com ele vazio ou cheio. */
  inventoryText: string;
  /** O que dizer de quem está em cativeiro; `null` sem ninguém lá. */
  captiveText: string | null;
  /**
   * Quem o próximo Resgate que der certo solta: quem está em cativeiro há mais tempo, pelo
   * nome. `null` sem ninguém lá. É o mesmo herói que traz `nextRescued` na ficha.
   */
  rescueTargetName: string | null;
  wage: {
    /** O soldo de toda a equipe, em ouro por hora real. Zero sem herói. */
    perHour: number;
    /**
     * Por quantos segundos reais o ouro ainda paga a equipe, contando o que a Mina entrega e o
     * que o ofício e a moral mudam sozinhos, pela estação de agora. `null` sem herói e quando
     * o ouro não acaba; zero com o soldo em atraso.
     */
    coveredForSeconds: number | null;
    /**
     * O soldo **depois de chegarem os heróis prometidos** que têm instante marcado: quanto a
     * equipe passa a custar, em ouro por hora real, e por quantos segundos reais o ouro ainda a
     * paga contando o soldo de cada um a partir do instante em que chega, pelo saldo de agora.
     * `coveredForSeconds` é `null` quando o ouro não acaba nem com eles e zero com o atraso
     * aberto. `null` sem ninguém a caminho. Sem isto, o cofre vazio e um herói a uma hora de
     * distância não avisariam nada: hoje não há soldo, e na chegada o atraso abre.
     */
    afterArrivals: { perHour: number; coveredForSeconds: number | null } | null;
    /** O atraso aberto; `null` com o soldo em dia. */
    arrears: WageArrearsView | null;
    /**
     * O atraso que fechou há pouco e ainda tem o que cobrar: o herói que o prazo já devia quando
     * o ouro chegou parte na próxima virada do dia, se ela cair dentro da janela de retomada.
     * `text` diz quem; `departureInSeconds` são segundos reais até essa virada. `null` no caso
     * comum: nada ficou devido, ou a janela já passou.
     */
    lingering: { text: string; departureInSeconds: number } | null;
  };
};

/** Um candidato da Taverna na visão: a ficha, o preço de agora e por que não dá para contratar. */
export type TavernOfferView = {
  /** O identificador que `hireHero` recebe. */
  offerId: string;
  name: string;
  /** "Arqueira". */
  classLabel: string;
  level: number;
  traits: Array<{ label: string; text: string }>;
  /** O ouro que a contratação cobra agora, já com o desconto de um Carismático no feudo. */
  price: number;
  /** "110 de ouro", ou "88 de ouro: 110, menos 20% por Mécia, Carismática". */
  priceText: string;
  /** O soldo dele depois de contratado, em ouro por hora real: o do nível com que chega. */
  wagePerHour: number;
  /** O ouro do cofre paga o preço. */
  affordable: boolean;
  /** Por que a contratação seria recusada agora; `null` quando pode. */
  blockedReason: string | null;
};

/**
 * A Taverna na visão (GDD §6.1 e §9.1). Existe sempre: sem o edifício, `level` é zero, `text`
 * diz como erguê-la e as listas vêm vazias. Só saem os candidatos **desta** rotação: os da
 * próxima ainda não foram sorteados, e o gerador nunca sai do servidor.
 */
export type TavernView = {
  level: number;
  /** O que a Taverna dá no nível de agora, ou como obtê-la. */
  text: string;
  offers: TavernOfferView[];
  /** Segundos reais até a lista trocar; `null` sem Taverna. */
  nextRotationInSeconds: number | null;
  festival: {
    /** A ordem `holdFestival` seria aceita agora. */
    available: boolean;
    cost: ResourceCostView[];
    /** "+15 de moral por 8 h, a partir da virada do dia. Um festival por estação." */
    effectText: string;
    /** Por que o festival seria recusado agora; `null` quando pode. */
    blockedReason: string | null;
    /** Segundos reais até a moral deixar de contar o festival em curso; `null` sem festival. */
    activeForSeconds: number | null;
  };
};

/** Um recurso do Mercado na visão: o preço de hoje, de onde ele vem e quanto ainda cabe negociar. */
export type MarketPriceView = {
  resource: MarketResourceId;
  /** "Comida". */
  label: string;
  /** O que uma unidade custa hoje, em **milésimos de ouro**: a ordem cobra `amount × buy`. */
  buy: number;
  /** O que uma unidade rende hoje, em milésimos de ouro: a ordem paga `amount × sell`. */
  sell: number;
  /** "1,30": o preço de compra em ouro por unidade, pronto para exibir. */
  buyText: string;
  /** "1,105". */
  sellText: string;
  /** O preço-base, em ouro por unidade: "1,00". */
  baseText: string;
  /** O preço de compra de hoje contra o de ontem. `flat` enquanto os preços não andaram. */
  trend: 'up' | 'down' | 'flat';
  /** "1,30 = 1,00 (cotação de hoje; base 1,00) × 1,3 (Outono). A venda paga 85%: 1,105." */
  breakdown: string;
  /** Unidades já negociadas hoje, compra e venda somadas. */
  tradedToday: number;
  /** Unidades que ainda cabem no volume de hoje. */
  remainingToday: number;
  /** A maior compra que seria aceita agora: o volume, o ouro e o lugar no depósito. */
  maxBuyable: number;
  /** A maior venda que seria aceita agora: o volume e o estoque. */
  maxSellable: number;
  /** Por que nem uma unidade pode ser comprada agora; `null` quando pode. */
  buyBlockedReason: string | null;
  /** Por que nem uma unidade pode ser vendida agora; `null` quando pode. */
  sellBlockedReason: string | null;
};

/** Uma caravana na estrada, como a tela a mostra. Não diz, nem deixa deduzir, como ela termina. */
export type CaravanView = {
  id: string;
  resource: MarketResourceId;
  /** Unidades que ela leva. */
  amount: number;
  /** "300 de madeira". */
  cargoText: string;
  /** O preço por unidade fixado no envio, em milésimos de ouro. */
  unitPrice: number;
  /** "1,428". */
  unitPriceText: string;
  /** O ouro que a carga inteira rende a esse preço, se chegar inteira: "351,9". */
  goldText: string;
  /** "Porto do Rio". */
  destination: string;
  /** Segundos reais até a chegada. */
  arrivesInSeconds: number;
  /** Quem a escolta, pelo nome; `null` sem escolta. */
  escortName: string | null;
  /** "A caminho de Porto do Rio com 300 de madeira, a 1,428 de ouro a unidade. Sem escolta." */
  text: string;
};

/** Um recurso na oferta de caravana: o preço que ela pagaria hoje e quanto dá para mandar. */
export type CaravanResourceView = {
  resource: MarketResourceId;
  /** "Madeira". */
  label: string;
  /** O preço por unidade que uma caravana enviada agora fixaria, em milésimos de ouro. */
  unitPrice: number;
  /** "1,428". */
  unitPriceText: string;
  /** "1,428 = 1,02 (venda de hoje) × 1,4." */
  breakdown: string;
  /** A maior carga que seria aceita agora: o teto da caravana e o estoque; 0 sem lugar na estrada. */
  maxSendable: number;
};

/**
 * O que uma caravana enviada agora levaria, pagaria e arriscaria (GDD §5.9; ADR 0018, decisão
 * 17). Existe sempre: sem o Mercado no nível pedido, `available` é falso, `blockedReason` diz
 * por quê e `resources` vem vazia. O risco é o de **agora**: a chance vale com a Torre de Vigia
 * que o feudo tiver na chegada.
 */
export type CaravanOfferView = {
  /** Uma caravana pode partir agora (há Mercado no nível pedido e lugar na estrada). */
  available: boolean;
  /** Por que nenhuma pode partir agora; `null` quando pode. */
  blockedReason: string | null;
  /** "Porto do Rio". */
  destination: string;
  /** O máximo de unidades de uma caravana. */
  maxUnits: number;
  /** "O preço de venda do dia × 1,4, fixado no envio." */
  priceRatioText: string;
  /** Segundos reais de viagem, no ritmo da partida. */
  tripSeconds: number;
  /** A chance de emboscada de uma caravana sem escolta, em pontos percentuais, com a Torre de agora. */
  riskPercent: number;
  /** "5% de chance de emboscada sem escolta; com escolta, nenhuma. …" */
  riskText: string;
  /** "10% na estrada, −5 pela Torre de Vigia Nv1; com escolta, nenhum." */
  riskBreakdown: string;
  /** "A emboscada leva 50% da carga, arredondada para baixo; o resto é vendido pelo preço fixado." */
  lossText: string;
  /** Quantas caravanas o Mercado mantém na estrada, no nível de agora. */
  slots: number;
  /** Quantas estão na estrada. */
  slotsInUse: number;
  resources: CaravanResourceView[];
  /** Os heróis que podem escoltar agora, na ordem da lista do feudo: quem decide é o motor. */
  eligibleEscortIds: string[];
};

/**
 * O Mercado na visão (GDD §5.9). Existe sempre: sem o edifício, `level` é zero, `text` diz como
 * erguê-lo e `prices` vem vazia. Só sai o preço **de hoje**: o de amanhã ainda não foi sorteado,
 * o de ontem só aparece como tendência, e o gerador nunca sai do servidor.
 */
export type MarketView = {
  /** O edifício do Mercado: é o que `startConstruction` recebe e o que a lista de obras mostra. */
  building: BuildingId;
  level: number;
  /** O que o Mercado dá no nível de agora, ou como obtê-lo. */
  text: string;
  /** O dia da cotação: é o que a ordem `trade` devolve em `quoteDay`. */
  quoteDay: number;
  /** Segundos reais até o preço e o volume mudarem (a virada do dia de jogo); `null` sem Mercado. */
  nextChangeInSeconds: number | null;
  /** Unidades por recurso que o Mercado negocia por dia de jogo, no nível de agora; 0 sem ele. */
  dailyVolume: number;
  prices: MarketPriceView[];
  /** As caravanas na estrada, em ordem de envio. O desfecho de nenhuma sai antes da chegada. */
  caravans: CaravanView[];
  /** O que uma caravana enviada agora levaria, pagaria e arriscaria. */
  caravanOffer: CaravanOfferView;
};

/** Tudo que a interface exibe, já calculado. A UI só formata números (GDD §14.5). */
export type ViewState = {
  settlement: {
    name: string;
    townHallLevel: number;
    /** Escolhida na criação da partida; não muda durante o ano (GDD §12.1). */
    difficulty: DifficultyId;
    /** "Senhor". */
    difficultyLabel: string;
    /** O ritmo da partida, pronto para exibir: "Rápido: um ano em 56 horas" (GDD §4.2). */
    paceLabel: string;
  };
  calendar: {
    year: number;
    season: SeasonId;
    seasonLabel: string;
    dayOfSeason: number;
    dayOfYear: number;
    secondsToNextDay: number;
    secondsToNextSeason: number;
    /** O que a estação atual muda, em uma frase: "Outono: comida × 1,3; ouro × 1,1." */
    seasonEffects: string;
    nextSeason: {
      id: SeasonId;
      label: string;
      secondsUntil: number;
      /** Uma frase para cada coisa que muda na virada. */
      changes: string[];
      /** A conta da lenha, quando a próxima estação queima madeira; `null` nas outras. */
      firewood: FirewoodView | null;
      /**
       * A previsão da comida depois da virada. `null` com fome, e quando a comida ou a lenha
       * acabam antes da virada: o alarme é o da estação de agora.
       */
      food: FoodForecastView | null;
    };
    /**
     * A próxima estação que queima lenha, com o prazo até ela e a conta: é `nextSeason` no
     * outono, e o inverno ainda distante no resto do ano (no ritmo Rápido ele pode estar a menos
     * de um dia de relógio com o outono no meio). `null` quando a estação de agora já queima
     * lenha: a conta é a de `winter.firewood`.
     */
    nextFirewoodSeason: null | {
      id: SeasonId;
      label: string;
      secondsUntil: number;
      firewood: FirewoodView;
    };
  };
  population: {
    villagers: number;
    capacity: number;
    free: number;
    inTraining: number;
    /** Lugares ocupados nas habitações: quem já mora e quem está a caminho. */
    housed: number;
    /** Lugares livres nas habitações. */
    vacancies: number;
    /** Segundos até o próximo aldeão chegar; `null` sem fila ou com a fila congelada pela fome. */
    secondsToNextRecruit: number | null;
    /**
     * Aldeões feridos em uma incursão (GDD §8.2): moram e comem no feudo, mas não trabalham até
     * sarar. Não entram em `free`.
     */
    injured: number;
    /** Segundos reais até o próximo ferido sarar; `null` sem feridos. */
    secondsToNextRecovery: number | null;
    /**
     * "1 aldeão ferido na incursão: não trabalha até sarar, em 40 min, e então volta à
     * Serraria."; `null` sem feridos.
     */
    injuredNote: string | null;
    /**
     * Os Mestres que moram no feudo (GDD §5.4): ocupam casa e comem como os aldeões, e não estão
     * em `villagers` nem em `free`. Quem espera à porta não entra aqui.
     */
    masters: number;
    breakdown: string;
  };
  resources: Array<{
    id: ResourceId;
    label: string;
    /** Estoque em unidades inteiras. */
    stock: number;
    /** Limite do estoque, em unidades; `null` para o que não tem limite (o ouro). */
    cap: number | null;
    /**
     * De onde vem o limite: "500 iniciais" ou "Celeiro Nv2: 1.600 × 0,8 (Rei de Ferro) = 1.280".
     * `null` sem limite.
     */
    capBreakdown: string | null;
    /** O edifício que amplia o limite deste recurso; `null` sem limite. */
    storageBuilding: BuildingId | null;
    /** Onde o recurso fica hoje: "Celeiro", ou "Despensa" antes de ele existir; `null` sem limite. */
    storageLabel: string | null;
    /** O estoque está no limite (ou acima dele, em uma partida que veio de antes dos limites). */
    full: boolean;
    /**
     * Segundos até encher. `null` quando o estoque não está subindo, quando já está cheio e
     * quando o enchimento cai depois de algo que muda a taxa (`fullNote` diz o quê).
     */
    fullInSeconds: number | null;
    /**
     * O que os números do limite não dizem, pronto para exibir. Cheio: o que se perde por hora e
     * o que fazer ("Armazém cheio: 12/h de madeira indo ao chão. Amplie o Armazém ou gaste
     * madeira."; para a comida, que nenhuma obra custa, "…recrute aldeões ou ponha parte dos
     * lavradores em outro ofício."). Enchendo, mas só depois de a taxa mudar: "Não enche antes
     * da virada para o Outono." `null` no resto do tempo.
     */
    fullNote: string | null;
    /** Quanto deixa de entrar por hora real com o estoque cheio; 0 quando nada se perde. */
    wastingPerHour: number;
    /** Unidades inteiras perdidas desde o último relato da Crônica (a virada do dia). */
    wastedToday: number;
    /** Saldo líquido por hora, com uma casa decimal. */
    perHour: number;
    /**
     * Segundos até o estoque acabar; `null` quando não acaba. Vale para a comida e, no inverno,
     * para a madeira que a lareira queima. Conta com o que a outra escassez muda no caminho: a
     * lenha que acaba antes abre o frio, e a comida acaba mais cedo por isso (e pode ter prazo
     * com o saldo de agora ainda positivo). O prazo que cai depois de a outra escassez abrir só
     * vem dentro da estação de agora.
     */
    depletesInSeconds: number | null;
    breakdown: string;
  }>;
  /**
   * As regras da troca de ofício e da experiência, em frases prontas e no ritmo da partida: é o
   * que a lista de alocação mostra **antes** de o jogador confirmar (GDD §5.4).
   */
  workersRules: {
    /** Quanto dura a adaptação de quem trocar de ofício agora, em segundos reais. */
    adaptationSeconds: number;
    /** "Quem troca de ofício produz metade por 40 min." */
    adaptationText: string;
    /** "Ao tirar trabalhadores, saem primeiro os que ainda estão em adaptação." */
    removalText: string;
    /** A regra da experiência do ofício e da mestria, em uma frase. */
    experienceText: string;
    /** O máximo da experiência do ofício: o fim da barra. */
    experienceMax: number;
    /** O bônus de produção com a experiência no máximo, em pontos percentuais: 30. */
    masteryMaxBonusPercent: number;
    /** O que um Mestre soma ao edifício em que trabalha, em pontos percentuais: 15. */
    masterBonusPercent: number;
    /** Quanto dura a adaptação do Mestre que chegar a um edifício agora, em segundos reais. */
    masterAdaptationSeconds: number;
    /** As regras do Mestre em uma frase: é o que a tela mostra antes de o jogador o mover. */
    masterText: string;
  };
  workers: Array<{
    building: ProductionBuildingId;
    label: string;
    level: number;
    resource: ResourceId;
    assigned: number;
    grossPerHour: number;
    /**
     * Quanto um trabalhador **adaptado** produz por hora neste edifício agora, já com nível,
     * mestria, estação, fome e frio.
     */
    perWorkerPerHour: number;
    /**
     * Quanto produz por hora um trabalhador que chegar agora, enquanto se adapta. Ao lado de
     * `perWorkerPerHour`, é o custo da troca: "+4/h agora, +8/h depois da adaptação".
     */
    perNewWorkerPerHour: number;
    breakdown: string;
    /** Experiência do ofício deste edifício, de 0 a `workersRules.experienceMax`. */
    experience: number;
    /** O que a experiência acrescenta à produção agora, em pontos percentuais: 12 é "+12%". */
    masteryBonusPercent: number;
    /** Com quantos trabalhadores o edifício conta como ocupado na virada do dia. */
    occupiedFrom: number;
    /** Para onde a experiência vai na próxima virada do dia, se nada mudar. */
    experienceTrend: 'rising' | 'steady' | 'falling';
    /** O porquê da tendência e o que fazer, em uma frase pronta. */
    experienceNote: string;
    /** Quantos dos trabalhadores ainda estão em adaptação. */
    adapting: number;
    /**
     * Segundos reais até o último deles terminar a adaptação e o edifício render inteiro;
     * `null` sem ninguém em adaptação.
     */
    adaptationEndsInSeconds: number | null;
    /** As levas em adaptação, da que termina antes à que termina depois. */
    adaptingCohorts: Array<{ count: number; endsInSeconds: number }>;
    /**
     * Feridos que saíram deste edifício e voltam a ele ao sarar, já adaptados (GDD §8.2). Não
     * estão em `assigned`: a ordem de trabalhadores não os conta nem os tira.
     */
    injured: number;
    /**
     * O Mestre que trabalha neste edifício (GDD §5.4), ou `null`. Não está em `assigned`: conta
     * como um trabalhador a mais na produção (`grossPerHour` e `breakdown` já o incluem), e a
     * ordem de trabalhadores não o conta nem o tira. `bonusText` diz o que ele soma agora:
     * "+15% na produção", ou "em adaptação por 40 min: ainda sem o bônus".
     */
    master: null | { id: string; name: string; adapting: boolean; bonusText: string };
  }>;
  constructions: {
    /** Atalho para a primeira obra em curso, na ordem das filas; `null` sem nenhuma. */
    active: ActiveConstructionView | null;
    /** Uma entrada por fila **aberta**, na ordem: a obra em curso, ou `null` se a fila está livre. */
    queues: Array<ActiveConstructionView | null>;
    /** Quantas filas de obras o feudo tem abertas agora. */
    queuesUnlocked: number;
    /**
     * O que abre a próxima fila: "A segunda fila de obras abre com o Salão do Senhor no nível
     * 4." `null` quando todas já estão abertas.
     */
    queuesNote: string | null;
    /** As planejadas, na ordem da lista: é a ordem em que as automáticas são tentadas. */
    planned: PlannedUpgradeView[];
    available: UpgradeView[];
  };
  recruitment: {
    cost: ResourceCostView[];
    /** Tempo de treinamento de cada aldeão de uma ordem dada agora, já com o fator da estação. */
    secondsPerVillager: number;
    /**
     * Por que o tempo não é o de tabela: "Na Primavera, o prazo de um recrutamento ordenado agora
     * é × 0,8." `null` quando a estação não mexe nele.
     */
    durationNote: string | null;
    /** Quantos aldeões cabem em uma nova ordem agora. */
    maxQuantity: number;
    blockedReason: string | null;
    /**
     * O que uma ordem de recrutamento dada agora custa à moral, ao lado do custo em recursos:
     * "Chamar aldeões agora gasta a comida guardada, que vale 10 de moral. Com as casas cheias
     * a moral perde 10: para evitar, chame até 4." `null` quando recrutar não mexe na moral, ou
     * quando não dá para recrutar.
     */
    moraleNote: string | null;
  };
  famine: null | {
    /** O instante de jogo em que a fome abriu, ou reabriu. */
    sinceMs: number;
    /**
     * Há quantos segundos reais a fome dura, na conta da moral e da deserção: a fome que reabre
     * pouco depois de acabar é a mesma (GDD §5.6), e o que ela já tinha durado antes entra aqui.
     */
    secondsElapsed: number;
    /**
     * Segundos reais até a fome acabar sozinha, sem nenhuma ordem: quem ainda se adapta passa a
     * render inteiro, ou a virada do dia muda a moral. `null` quando ela só acaba com uma ordem
     * do jogador (ou quando a estação vira antes): o texto diz o porquê quando há prazo.
     */
    endsInSeconds: number | null;
    text: string;
  };
  morale: MoraleView;
  /**
   * A estação da lenha: `null` fora dela. `cold` é o frio, aberto quando a madeira acabou; o
   * texto diz o que ele custa, quanto falta e o que fazer.
   */
  winter: null | {
    /** Madeira queimada por hora real. */
    firewoodPerHour: number;
    /** A conta do que falta queimar até a estação virar. */
    firewood: FirewoodView;
    cold: null | {
      secondsElapsed: number;
      /** Segundos reais até o frio passar sozinho, como em `famine.endsInSeconds`; `null` se não passa. */
      endsInSeconds: number | null;
      text: string;
    };
  };
  objectives: ObjectiveView[];
  council: CouncilView;
  /** A Ameaça, vista (ou não) pela Torre de Vigia. */
  threat: ThreatView;
  /** Os heróis a serviço do feudo e o soldo deles. */
  guild: GuildView;
  /** A Taverna: os candidatos, a troca da lista e o festival. */
  tavern: TavernView;
  /** O Mercado: os preços de hoje e o volume que ainda cabe negociar. */
  market: MarketView;
  /** Os Mestres do feudo, na ordem em que entraram (GDD §5.4; ADR 0018, decisão 18). */
  masters: MasterView[];
  /** Os Mestres que chegaram e esperam uma vaga nas casas. */
  mastersWaiting: {
    count: number;
    /** Quem espera, com o tratamento, na ordem de chegada: "Mestre Odo". */
    names: string[];
    /** "Mestre Odo espera uma vaga nas casas: entra assim que houver uma."; `null` sem ninguém. */
    note: string | null;
  };
  /**
   * O que espera uma decisão do jogador, do prazo mais curto ao mais longo: as cartas do
   * Conselho e as expedições paradas em uma encruzilhada. É o resumo para a barra de status, a
   * árvore e os avisos; a carta inteira está em `council.pending`, e a encruzilhada, em
   * `guild.expeditions[].crossroads`.
   */
  pendingDecisions: PendingDecisionView[];
};

/**
 * O que mudaria se um Mestre fosse para um edifício produtivo: é o que a tela mostra **antes**
 * de o jogador confirmar. Os ganhos são por hora real, contra o edifício sem este Mestre.
 */
export type MasterOptionView = {
  building: ProductionBuildingId;
  /** "Pedreira". */
  label: string;
  level: number;
  resource: ResourceId;
  /** É o edifício em que ele já trabalha: a ordem não mudaria nada. */
  current: boolean;
  /** Quanto o edifício rende a mais com este Mestre já adaptado: o braço dele e o bônus. */
  gainPerHour: number;
  /**
   * Quanto rende a mais enquanto ele se adapta: só a fração do braço, sem o bônus. No edifício
   * em que ele já rende inteiro, é igual a `gainPerHour`.
   */
  gainWhileAdaptingPerHour: number;
  /** Por que a ordem seria recusada ("já tem Mestra Berta"); `null` quando seria aceita. */
  blockedReason: string | null;
};

export type MasterView = {
  /** O identificador que a ordem `assignMaster` leva. */
  id: string;
  /** "Mestre Odo". */
  name: string;
  /** "canteiro das pedreiras velhas": de onde veio; é só narrativa. */
  originText: string;
  building: ProductionBuildingId | null;
  /** "Pedreira", ou "Sem edifício". */
  buildingLabel: string;
  /** Segundos reais até ele terminar a adaptação e passar a dar o bônus; `null` fora dela. */
  adaptationEndsInSeconds: number | null;
  /** O que ele soma à produção do edifício em que trabalha, em pontos percentuais: 15. */
  bonusPercent: number;
  /** O bônus vale agora: tem edifício e já se adaptou. */
  bonusActive: boolean;
  /** Um edifício produtivo por linha, na ordem do conteúdo. */
  options: MasterOptionView[];
};
