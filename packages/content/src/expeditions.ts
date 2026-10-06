import type {
  ExpeditionDisasterId,
  ExpeditionModelId,
  ExpeditionNodeKind,
  ExpeditionOutcomeId,
  HeroAttributeId,
  HeroClassId,
  HeroTraitId,
  ItemId,
  PostureId,
  Ratio,
  ResourceId,
} from './ids';
import { oldForest } from './missions/oldForest';
import { patrol } from './missions/patrol';
import { rescue } from './missions/rescue';
import { ruins } from './missions/ruins';
import { swamp } from './missions/swamp';
import { wolfDen } from './missions/wolfDen';

/**
 * As expedições como dados (GDD §9.2 e §9.3; ADR 0018, decisões 11 a 13). Um **modelo** é um
 * destino ("Patrulha dos Arredores"); cada modelo tem **variantes**, e cada variante é um
 * **grafo** de nós que a equipe percorre. O motor só lê: quem escolhe a variante, anda os nós e
 * sorteia é `packages/engine/src/expeditions.ts`. Os números gerais estão em
 * `balance.expeditions`.
 */

/**
 * O que um nó rende (GDD §9.2; ADR 0018, decisões 12, 14 e 15). Os **recursos** vêm em uma faixa,
 * em unidades inteiras, e o desfecho decide a parte (`balance.expeditions.lootShare`). O resto só
 * vem **a partir do Sucesso** (e de um nó sem prova): um **item**, com a chance e a lista de onde
 * sai um, por igual; a **revelação** de um destino (com um Rastreador na equipe, também no
 * Revés); a **limpeza** de um tile de ameaça; e a **libertação** de quem está em cativeiro há
 * mais tempo.
 */
export type ExpeditionItemDrop = { readonly chance: Ratio; readonly from: readonly ItemId[] };

export type ExpeditionReward = {
  readonly resources?: Partial<Record<ResourceId, { readonly min: number; readonly max: number }>>;
  readonly item?: ExpeditionItemDrop;
  readonly reveals?: ExpeditionModelId;
  /** A chave do tile no estado (`startingTiles[].id`). */
  readonly clearsTile?: string;
  readonly rescues?: true;
};

/**
 * A prova de um nó com dificuldade (GDD §9.2; ADR 0017, decisão 7). `weights` troca ou acrescenta
 * pesos de atributo **só neste nó**, sobre os de `balance.heroes.power` ("perícia pesa ×1,5" é
 * `skill: 3/2`). `onDisaster` é o que o Desastre faz a um herói, marcado editorialmente (ADR
 * 0017, decisão 8): ferimento grave ou captura, que a dificuldade da partida ainda pode trocar
 * (`balance.difficulties[].heroCapture`). `xp` é a experiência que o nó dá a cada herói que
 * continua na equipe, antes da parte do desfecho (`balance.expeditions.xpShare`).
 *
 * **O relatório (GDD §9.4).** `outcomes` é a frase de cada desfecho, para a Crônica e para o
 * relatório: diz o que aconteceu e, em `{heroi}`, quem se destacou (o herói de maior poder
 * contra o nó; o motor escolhe, sem sorteio). `helps` é a classe que este nó favorece, marcada
 * aqui (o teste confere que é a de maior poder contra os pesos do nó), e `lesson`, a frase que o
 * Revés e o Desastre ganham **quando a equipe não tinha essa classe**: diz o que teria ajudado,
 * só com o que o jogador pode saber.
 */
export type ExpeditionTrial = {
  readonly difficulty: number;
  readonly xp: number;
  readonly weights?: Partial<Record<HeroAttributeId, Ratio>>;
  readonly onDisaster: ExpeditionDisasterId;
  readonly helps: HeroClassId;
  readonly lesson: string;
  readonly outcomes: Record<ExpeditionOutcomeId, string>;
};

/** Os tipos de nó que a equipe atravessa em um tempo: tudo menos a encruzilhada e o retorno. */
export type ExpeditionStageKind = Exclude<ExpeditionNodeKind, 'crossroads' | 'return'>;

/**
 * Um nó que a equipe atravessa: dura `durationMs` de jogo e, no fim, é resolvido. Com `trial`,
 * o desfecho sai da conta do poder contra a dificuldade, e a frase é a do desfecho; sem ela, o
 * nó só passa, e a frase é `text`. Um dos dois, nunca os dois.
 */
export type ExpeditionStageNode = {
  readonly kind: ExpeditionStageKind;
  readonly title: string;
  readonly durationMs: number;
  readonly text?: string;
  readonly trial?: ExpeditionTrial;
  readonly rewards?: ExpeditionReward;
  readonly next: string;
};

/** O requisito de uma opção de encruzilhada: uma classe ou um traço, nunca os dois. */
export type ExpeditionOptionRequires =
  { readonly heroClass: HeroClassId } | { readonly trait: HeroTraitId };

/** Uma opção de encruzilhada: o que a equipe faz, a pista do risco e da recompensa e para onde leva. */
export type ExpeditionOption = {
  readonly id: string;
  readonly label: string;
  /** A pista (ADR 0018, decisão 13): o que o jogador sabe do caminho antes de escolher. */
  readonly hint: string;
  /** O que a equipe precisa ter para tomar este caminho: um herói da classe, ou um com o traço. */
  readonly requires?: ExpeditionOptionRequires;
  readonly next: string;
};

/**
 * A encruzilhada: a equipe para e espera a palavra do senhor por
 * `balance.expeditions.crossroadsWaitRealMs`. `posture` é a opção que cada Postura toma no fim
 * do prazo, marcada aqui e nunca calculada (ADR 0018, decisão 11); a da Cautelosa não tem
 * requisito, e é a que vale quando a marcada está fora do alcance da equipe.
 */
export type ExpeditionCrossroadsNode = {
  readonly kind: 'crossroads';
  readonly title: string;
  readonly text: string;
  readonly options: readonly ExpeditionOption[];
  readonly posture: Record<PostureId, string>;
};

/** O caminho de volta: no fim dele o saque entra no feudo e os heróis voltam a ficar livres. */
export type ExpeditionReturnNode = {
  readonly kind: 'return';
  readonly title: string;
  readonly durationMs: number;
  readonly text: string;
};

export type ExpeditionNode = ExpeditionStageNode | ExpeditionCrossroadsNode | ExpeditionReturnNode;

/** Um grafo: o nó de partida e os nós, pela chave de cada um. Acíclico, e todo caminho chega a um retorno. */
export type ExpeditionVariant = {
  readonly start: string;
  readonly nodes: Readonly<Record<string, ExpeditionNode>>;
};

/** O que um modelo pede para a equipe partir. */
export type ExpeditionRequires = {
  /** O nível da Guilda dos Aventureiros a partir do qual o destino aparece. */
  readonly guildLevel: number;
  readonly teamMin: number;
  readonly teamMax: number;
  /** O nível que todo herói da equipe precisa ter. */
  readonly minHeroLevel: number;
  /** As classes de que a equipe precisa de ao menos um herói. */
  readonly classes: readonly HeroClassId[];
};

/**
 * Quando um destino aparece na Guilda (ADR 0018, decisão 12): por descoberta, nunca por data.
 * `open`: desde que a Guilda o alcance. `discovered`: depois de uma expedição o revelar
 * (`map.discovered`, no estado). `captive`: enquanto houver um herói em cativeiro. `tile`:
 * conhecido desde sempre, e só há o que fazer lá enquanto o tile de ameaça estiver ativo.
 */
export type ExpeditionAccess =
  | { readonly kind: 'open' }
  | { readonly kind: 'discovered' }
  | { readonly kind: 'captive' }
  | { readonly kind: 'tile'; readonly tileId: string };

export type ExpeditionModelDef = {
  readonly id: ExpeditionModelId;
  readonly label: string;
  /** O risco em palavra, como a tela o mostra antes do envio (ADR 0018, decisão 13). */
  readonly riskLabel: string;
  /**
   * A duração total anunciada, em tempo de jogo, fora do verão e sem contar a espera das
   * encruzilhadas: é a do caminho mais longo de qualquer variante.
   */
  readonly durationMs: number;
  readonly requires: ExpeditionRequires;
  readonly access: ExpeditionAccess;
  readonly variants: readonly ExpeditionVariant[];
};

/**
 * Os modelos, na ordem em que a Guilda os mostra: do mais perto ao mais longe, e do que rende
 * menos ao que rende mais. É o catálogo da v0.3 (V3D-T3; ADR 0018, decisão 12): seis destinos,
 * três variantes cada, dezoito grafos, cada um com a ficha em `docs/content-v0.3.md`.
 * **Os ids de modelo, de nó e de opção são estáveis** (`expeditions.test.ts` os fixa): uma
 * expedição em curso guarda os três. Rascunho que o autor não leu.
 */
export const expeditionModels: readonly ExpeditionModelDef[] = [
  patrol,
  oldForest,
  wolfDen,
  rescue,
  ruins,
  swamp,
];

/** As Posturas, como a tela as mostra: o nome, em minúscula para o meio da frase, e o que cada uma faz. */
export const expeditionPostures: Record<
  PostureId,
  { readonly label: string; readonly text: string }
> = {
  cautious: {
    label: 'Cautelosa',
    text: 'Sem a sua palavra na encruzilhada, a equipe toma o caminho seguro.',
  },
  balanced: {
    label: 'Equilibrada',
    text: 'Sem a sua palavra na encruzilhada, a equipe pesa o risco e o ganho.',
  },
  bold: {
    label: 'Ousada',
    text: 'Sem a sua palavra na encruzilhada, a equipe vai atrás do maior ganho.',
  },
};

/** Como o relatório chama cada desfecho, e o que um nó sem prova e uma escolha levam no lugar. */
export const expeditionOutcomes: Record<
  ExpeditionOutcomeId | 'passed' | 'chosen',
  { readonly label: string }
> = {
  full: { label: 'Sucesso pleno' },
  success: { label: 'Sucesso' },
  setback: { label: 'Revés' },
  disaster: { label: 'Desastre' },
  passed: { label: 'Sem incidentes' },
  chosen: { label: 'Caminho escolhido' },
};

/**
 * As frases da Guilda sobre as expedições, com lacunas que o motor preenche. Nenhum número de
 * regra é escrito aqui: prazos, lugares e dificuldades entram pelas lacunas. Rascunho que o
 * autor não leu.
 */
export const expeditionTexts = {
  /** A Guilda no nível dado: `{expedicoes}` é "1 expedição" ou "2 expedições". */
  gives: 'sustenta {expedicoes} por vez',
  /** O alto da aba com a Guilda de pé e gente livre. */
  ready:
    'A Guilda dos Aventureiros sustenta {expedicoes} por vez. Escolha um destino, a equipe e a Postura: o que a tela mostra antes da partida é o que vale.',
  /** Todos os lugares ocupados. */
  full: 'A Guilda dos Aventureiros sustenta {expedicoes} por vez, e não há lugar para outra agora.',
  /** Com a Guilda de pé e nenhum herói no feudo. */
  noneHome: 'Ninguém da equipe está no feudo agora: quem partiu ainda não voltou.',
  /** A duração anunciada não conta a espera na encruzilhada. */
  durationNote: 'Sem contar a espera em uma encruzilhada, que dura até {espera}.',
  summer: 'No {estacao} os caminhos estão secos: a jornada fica mais curta.',
  /** O primeiro trecho: os nós até a primeira encruzilhada, cada um com a dificuldade. */
  stretchTrial: '{no} (dificuldade {dificuldade})',
  stretchPassage: '{no}',
  stretchCrossroads: 'Depois, uma encruzilhada: o que vem além dela só se sabe lá.',
  stretchReturn: 'Depois, o caminho de volta.',
  /** O que o modelo pede: `{equipe}` é "1 herói" ou "de 1 a 2 heróis". */
  team: 'Equipe: {equipe}.',
  minLevel: 'Todos no nível {nivel} ou acima.',
  needsClass: 'Ao menos {classe} na equipe.',
  /** Por que um destino está fechado. */
  lockedGuild: 'Pede a Guilda dos Aventureiros no nível {nivel}.',
  /** O tile de ameaça do destino está limpo: `{lugar}` é o tile, com artigo. Sem ponto: entra em uma recusa. */
  lockedCleared: '{lugar} está limpo até a virada do ano',
  /** O mesmo, como frase inteira, para o painel da Ameaça: `{lugar}` com maiúscula. */
  tileCleared: '{lugar} está limpo: dali ninguém ronda o feudo até a virada do ano.',
  /** O Resgate, sem ninguém em cativeiro. Só a recusa da ordem o diz: o destino nem aparece. */
  lockedNoCaptive: 'não há ninguém em cativeiro',
  lockedUnknown: 'a Guilda não conhece esse caminho',
  /** Por que um herói não pode partir. */
  heroAway: 'já está em expedição',
  heroInjured: 'ainda se recupera dos ferimentos',
  heroCaptured: 'está em cativeiro',
  /** A encruzilhada. */
  postureDecides: 'Sem resposta, a Postura {postura} escolhe: {opcao}.',
  postureFallsBack:
    'Sem resposta, a Postura {postura} escolheria "{marcada}", que esta equipe não pode tomar: vale o caminho seguro, {opcao}.',
  optionNeedsClass: 'requer {classe} na equipe',
  /** `{traco}` é o traço como a ficha o mostra: "Rastreador". */
  optionNeedsTrait: 'requer na equipe alguém com o traço {traco}',
  /**
   * O que a equipe vale contra o primeiro trecho (ADR 0018, decisão 13): `{folga}` é o poder com
   * que nem a pior sorte tira o Sucesso, e `{risco}`, o poder abaixo do qual a pior sorte dá
   * Desastre. A tela soma o poder de quem o senhor escolher.
   */
  fit: 'Contra o primeiro trecho, com {folga} de poder a equipe passa com folga; abaixo de {risco}, arrisca um Desastre.',
  fitComfortable: 'folgada',
  fitTight: 'justa',
  fitRisky: 'arriscada',
  /** O estado de uma expedição em uma frase. */
  traveling: 'A caminho: {no}.',
  waiting: 'Parada na encruzilhada, à espera da sua palavra.',
  returning: 'De volta para casa.',
  /** O que um passo do relatório diz além da frase do nó. */
  reportLight: '{heroi} sofreu um ferimento leve.',
  reportSevere: '{heroi} sofreu um ferimento grave.',
  reportCaptured: '{heroi} ficou em cativeiro.',
  reportDied: '{heroi} não voltou.',
  reportLeveled: '{heroi} chegou ao nível {nivel}.',
  reportFound: 'Achado: {item}.',
  reportRevealed: 'Caminho novo: {destino}.',
  reportCleared: 'Limpo: {lugar}.',
  reportRescued: '{heroi} ganhou a liberdade.',
  reportLootLost: 'A cobiça pesou: o que a equipe juntou neste trecho ficou pelo caminho.',
  /**
   * O que o Revés e o Desastre ensinam quando não é a classe que faltou (essa frase é do nó,
   * `trial.lesson`): o herói que rende mais em outra Postura, o que partiu com espaço vago
   * havendo item no arsenal e, sem nada disso, a força que faltou.
   */
  lessonPosture: '{heroi} rende mais quando a ordem é a Postura {postura}.',
  lessonItem: '{heroi} partiu com espaço vago no equipamento, e havia o que levar no arsenal.',
  lessonStrength: 'A prova pedia mais do que a equipe tinha: mais gente, ou gente mais calejada.',
  /** O fecho do relatório: o que a jornada custou, e o que ela deixou além do saque. */
  lossesNone: 'Sem perdas: todos voltaram inteiros.',
  losses: 'O preço: {perdas}.',
  lossLight: '{heroi}, com um ferimento leve',
  lossSevere: '{heroi}, com um ferimento grave',
  lossCaptured: '{heroi}, em cativeiro',
  lossDied: '{heroi}, que não voltou',
  lossLoot: 'parte do saque, perdida no caminho',
  /** O fecho do relatório. */
  lootAllLost: 'Ninguém da equipe voltou: o que traziam se perdeu.',
  lootItems: 'Para o arsenal: {itens}.',
  lootItemsSold: 'Sem lugar no arsenal, viraram ouro: {itens}.',
  lootNone: 'Voltou de mãos vazias.',
  loot: 'Trouxe {saque}.',
  lootCut: 'Trouxe {saque}. Faltou lugar no depósito, e foi ao chão: {perda}.',
  /** Quem se destaca em um registro antigo, que não guardou o nome. */
  theTeam: 'a equipe',
  /** Quem decidiu em uma encruzilhada, no relatório. */
  decidedByPlayer: 'Por ordem do senhor: {opcao}.',
  decidedByPosture: 'Sem palavra do senhor, a Postura {postura} decidiu: {opcao}.',
  decidedByFallback:
    'Sem palavra do senhor, e com o caminho da Postura {postura} fora do alcance da equipe, valeu o seguro: {opcao}.',
} as const;

/**
 * As outras frases da Crônica de uma expedição: o mesmo evento com outra frase. O prazo que
 * venceu com a opção da Postura fora do alcance da equipe; a volta de mãos vazias; e a volta em
 * que o saque não coube no depósito.
 */
export const expeditionTemplates = {
  postureFallback:
    'No {dia}º dia {daEstacao}, sem palavra do senhor de {feudo}, a expedição "{expedicao}" não pôde tomar o caminho da postura {postura} e foi pelo seguro: {opcao}.',
  returnedEmpty:
    'No {dia}º dia {daEstacao}, a expedição "{expedicao}" voltou a {feudo} de mãos vazias. A equipe está de novo no feudo: {herois}.',
  returnedCut:
    'No {dia}º dia {daEstacao}, a expedição "{expedicao}" voltou a {feudo} com {saque}. Faltou lugar no depósito, e foi ao chão: {perda}. A equipe está de novo no feudo: {herois}.',
} as const;
