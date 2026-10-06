import type {
  HeroAttributeId,
  HeroClassId,
  HeroGenderId,
  HeroStatusId,
  HeroTraitId,
  NamedHeroId,
  Ratio,
  TavernCandidateId,
} from './ids';

/**
 * Uma classe de herói (GDD §9.1; ADR 0017, decisão 7 e "Atributos-base das classes"): o nome e os
 * seis atributos do nível 1, todos inteiros. O que o nível e o soldo em atraso fazem com eles
 * está em `balance.heroes`; nesta versão a classe só conta no poder.
 */
export type HeroClassDef = {
  /** "Guerreiro": como a ficha do herói a mostra. */
  readonly label: string;
  /** "Guerreira": a mesma classe na ficha de uma heroína. */
  readonly labelFeminine: string;
  readonly attributes: Record<HeroAttributeId, number>;
};

export const heroClasses: Record<HeroClassId, HeroClassDef> = {
  warrior: {
    label: 'Guerreiro',
    labelFeminine: 'Guerreira',
    attributes: { health: 120, attack: 14, defense: 16, speed: 8, skill: 6, will: 8 },
  },
  archer: {
    label: 'Arqueiro',
    labelFeminine: 'Arqueira',
    attributes: { health: 90, attack: 18, defense: 9, speed: 14, skill: 14, will: 8 },
  },
  mage: {
    label: 'Mago',
    labelFeminine: 'Maga',
    attributes: { health: 70, attack: 22, defense: 6, speed: 9, skill: 10, will: 16 },
  },
  cleric: {
    label: 'Clérigo',
    labelFeminine: 'Clériga',
    attributes: { health: 100, attack: 9, defense: 13, speed: 9, skill: 8, will: 16 },
  },
};

/** Como a explicação do poder chama cada atributo, no meio de uma conta: minúscula, sem ponto. */
export const heroAttributes: Record<HeroAttributeId, { readonly label: string }> = {
  health: { label: 'vida' },
  attack: { label: 'ataque' },
  defense: { label: 'defesa' },
  speed: { label: 'velocidade' },
  skill: { label: 'perícia' },
  will: { label: 'vontade' },
};

/**
 * O que um traço muda nas regras, **só com o que já existe no jogo**. Um efeito entra aqui com a
 * tarefa que o implementa (os das expedições, na Fase D); o que é de outra versão (a aura de
 * comandante do Veterano) não entra nem como campo.
 */
export type HeroTraitEffects = {
  /** Nunca fica Descontente nem parte por soldo em atraso (GDD §9.1). */
  readonly loyalInArrears?: true;
  /**
   * Com um herói destes no feudo, o preço dos candidatos da Taverna é multiplicado por esta
   * fração, **uma vez**: dois não somam (ADR 0017, decisão 4).
   */
  readonly tavernPrice?: Ratio;
  /** Moral do feudo, somada uma vez por herói destes presente no feudo (ADR 0017, "Os oito traços"). */
  readonly morale?: number;
};

/** Um traço de herói (GDD, Apêndice D; ADR 0017, "Os oito traços"). */
export type HeroTraitDef = {
  /** "Leal": como a ficha do herói o mostra. */
  readonly label: string;
  /** "Corajosa": o mesmo traço na ficha de uma heroína; igual a `label` quando não flexiona. */
  readonly labelFeminine: string;
  /** Uma frase sobre o que o traço faz nesta versão, sem números. */
  readonly text: string;
  readonly effects: HeroTraitEffects;
};

export const heroTraits: Record<HeroTraitId, HeroTraitDef> = {
  brave: {
    label: 'Corajoso',
    labelFeminine: 'Corajosa',
    text: 'Rende mais quando a ordem é de ousadia, e se fere com mais facilidade.',
    effects: {},
  },
  prudent: {
    label: 'Prudente',
    labelFeminine: 'Prudente',
    text: 'Rende mais quando a ordem é de cautela, e não cai em armadilha simples.',
    effects: {},
  },
  greedy: {
    label: 'Ganancioso',
    labelFeminine: 'Gananciosa',
    text: 'Volta com mais saque, e às vezes o perde no caminho.',
    effects: {},
  },
  charismatic: {
    label: 'Carismático',
    labelFeminine: 'Carismática',
    text: 'Sabe negociar: abre caminhos no conselho e barateia quem a Taverna oferece.',
    effects: { tavernPrice: { num: 4, den: 5 } },
  },
  devout: {
    label: 'Devoto',
    labelFeminine: 'Devota',
    text: 'Tem fé, e a fé levanta o ânimo do feudo.',
    effects: { morale: 5 },
  },
  veteran: {
    label: 'Veterano',
    labelFeminine: 'Veterana',
    text: 'Já chegou ao feudo com um nível a mais.',
    effects: {},
  },
  loyal: {
    label: 'Leal',
    labelFeminine: 'Leal',
    text: 'Nunca fica descontente nem parte por soldo em atraso.',
    effects: { loyalInArrears: true },
  },
  tracker: {
    label: 'Rastreador',
    labelFeminine: 'Rastreadora',
    text: 'Acha o caminho de volta a um lugar mesmo quando a jornada vai mal.',
    effects: {},
  },
};

/** Como a ficha diz o que o herói está fazendo. */
export const heroStatuses: Record<HeroStatusId, { readonly label: string }> = {
  idle: { label: 'No feudo' },
};

/**
 * O que a aba Guilda diz no alto, conforme a equipe (GDD §13.1): como o primeiro herói chega,
 * quem já foi prometido e, com gente no feudo, que ainda não há para onde mandá-la. Nenhuma
 * frase promete data nem número: a Guilda dos Aventureiros e as expedições são de outra fase.
 * Rascunho que o autor não leu.
 */
export const guildTexts = {
  noHeroes:
    'Nenhum herói serve ao feudo ainda. O primeiro costuma chegar pelo Conselho: quando alguém pedir abrigo, a resposta é sua. Os seguintes, quem traz é a Taverna.',
  awaited:
    'Nenhum herói serve ao feudo ainda, mas há quem tenha dado a palavra e esteja a caminho.',
  noDestination:
    'Sua equipe ainda não tem para onde ir: as expedições esperam a Guilda dos Aventureiros, que o feudo ainda não sabe erguer. Até lá, os heróis ficam no feudo, e o soldo corre.',
  dismiss:
    'Dispensar não devolve nada: o que foi pago pelo trato não volta, e quem parte não fica à espera. O soldo deixa de correr na mesma hora.',
} as const;

/**
 * As frases do soldo em atraso na aba Guilda (GDD §9.1; ADR 0017, decisão 3), com lacunas que o
 * motor preenche: `{quantidade}` e `{herois}` ("3 heróis"), `{mina}` ("a Mina de Ouro"; "n{mina}"
 * dá "na Mina de Ouro"), os prazos em tempo real como o conteúdo os dá (`{descontente}`,
 * `{partida}`, `{passo}`), `{corte}` (o que o Descontente perde, em pontos percentuais) e
 * `{heroi}`. Nenhum número de regra é escrito aqui. Rascunho que o autor não leu.
 */
export const wageArrearsTexts = {
  /** Ninguém na Mina: o soldo não é pago a ninguém. */
  unpaidOne: 'Soldo em atraso: o cofre está vazio e {quantidade} herói não recebe.',
  unpaidMany: 'Soldo em atraso: o cofre está vazio e {quantidade} heróis não recebem.',
  /** A Mina entrega ouro, mas menos do que o soldo: paga-se em parte. */
  partlyPaid:
    'Soldo em atraso: o cofre está vazio, e o que {mina} entrega paga só parte do soldo de {herois}.',
  loyalHe: 'Ele é Leal: não fica descontente nem parte.',
  loyalShe: 'Ela é Leal: não fica descontente nem parte.',
  loyalAllHe: 'São todos Leais: não ficam descontentes nem partem.',
  loyalAllShe: 'São todas Leais: não ficam descontentes nem partem.',
  deadlines:
    'Com {descontente} de atraso, quem não é Leal fica descontente e perde {corte}% dos atributos; com {partida}, parte um herói a cada {passo}, o que chegou por último. As duas coisas acontecem na virada do dia.',
  /** Só quando há um herói que chegou depois de o atraso abrir. */
  latecomers: 'Para quem chegou com o atraso já aberto, os dois prazos contam da chegada.',
  remedy:
    'O que não foi pago não vira dívida: o atraso fecha quando o ouro voltar a pagar a equipe inteira. Para isso, ponha gente n{mina} ou dispense um herói.',
  /** O atraso fechou há pouco, e a virada do dia ainda cobra o herói que o prazo já devia. */
  lingering:
    'O soldo voltou a ser pago, mas o atraso já devia um herói: {heroi} parte na próxima virada do dia. Pagar antes de o prazo vencer é o que segura quem serve.',
  /** O herói prometido que encontra a lista de heróis no teto. */
  waitingAtDoor:
    'O feudo já abriga {herois}, e não cabe mais nenhum: {heroi} espera à porta até um lugar abrir.',
} as const;

/**
 * Um herói com nome próprio (GDD §9.1 e Apêndice B; ADR 0017, decisão 6): quem uma carta do
 * Conselho entrega, com o efeito `addHero`. Chega sem custo; o soldo conta desde a chegada.
 */
export type NamedHeroDef = {
  readonly name: string;
  readonly gender: HeroGenderId;
  readonly classId: HeroClassId;
  readonly level: number;
  readonly traits: readonly HeroTraitId[];
  /**
   * A frase da Crônica do instante em que ele chega ao feudo, com `{heroi}`: serve a quem chega
   * depois da escolha que o prometeu, e a linha conta de onde ele vem. Sem ela vale o modelo
   * geral de `heroJoined`.
   */
  readonly arrival?: string;
};

export const namedHeroes: Record<NamedHeroId, NamedHeroDef> = {
  edda: {
    name: 'Edda',
    gender: 'f',
    classId: 'warrior',
    level: 1,
    traits: ['loyal'],
  },
  rolf: {
    name: 'Rolf',
    gender: 'm',
    classId: 'archer',
    level: 1,
    traits: ['prudent'],
    arrival:
      'No {dia}º dia {daEstacao}, um arqueiro bateu ao portão de {feudo}: {heroi}, irmão de Edda, vindo pagar a dívida dela. Passou a servir ao senhor.',
  },
};

/**
 * Um modelo de candidato da Taverna (GDD §9.1; ADR 0017, decisão 4 e "Modelos de candidato da
 * Taverna"): a classe, os traços, o nível com que chega, o peso no sorteio e o **preço fixo**,
 * em ouro. O nome é sorteado à parte, de `heroNames`. O Veterano já traz o nível a mais escrito
 * aqui: o traço não tem efeito em tempo de execução.
 */
export type TavernCandidateDef = {
  readonly id: TavernCandidateId;
  readonly classId: HeroClassId;
  readonly traits: readonly HeroTraitId[];
  readonly level: number;
  /** Peso no sorteio da rotação: inteiro. Dentro de uma rotação o sorteio é sem reposição. */
  readonly weight: number;
  /** Preço cheio, em ouro, sem sorteio. */
  readonly price: number;
};

/** **Na ordem do sorteio** (`TAVERN_CANDIDATE_IDS`): mudar a ordem muda quem a Taverna oferece. */
export const tavernCandidates: readonly TavernCandidateDef[] = [
  { id: 'braveWarrior', classId: 'warrior', traits: ['brave'], level: 1, weight: 5, price: 110 },
  { id: 'steadyWarrior', classId: 'warrior', traits: ['prudent'], level: 1, weight: 4, price: 120 },
  {
    id: 'veteranWarrior',
    classId: 'warrior',
    traits: ['veteran', 'loyal'],
    level: 2,
    weight: 1,
    price: 300,
  },
  { id: 'trackerArcher', classId: 'archer', traits: ['tracker'], level: 1, weight: 5, price: 100 },
  { id: 'greedyArcher', classId: 'archer', traits: ['greedy'], level: 1, weight: 4, price: 80 },
  {
    id: 'veteranArcher',
    classId: 'archer',
    traits: ['veteran', 'prudent'],
    level: 2,
    weight: 2,
    price: 220,
  },
  { id: 'greedyMage', classId: 'mage', traits: ['greedy'], level: 1, weight: 3, price: 140 },
  {
    id: 'learnedMage',
    classId: 'mage',
    traits: ['prudent', 'charismatic'],
    level: 1,
    weight: 2,
    price: 200,
  },
  { id: 'devoutCleric', classId: 'cleric', traits: ['devout'], level: 1, weight: 4, price: 130 },
  {
    id: 'charismaticCleric',
    classId: 'cleric',
    traits: ['charismatic'],
    level: 1,
    weight: 3,
    price: 160,
  },
];

/**
 * Os nomes que a Taverna dá aos candidatos, **na ordem do sorteio**, cada um com a forma de
 * tratamento (é ela que faz a ficha dizer "Guerreira" ou "Guerreiro"). Dois heróis do feudo
 * nunca têm o mesmo nome: a rotação só sorteia entre os que ninguém usa, e por isso a lista é
 * maior que o teto de heróis, de prometidos e de candidatos somados (o teste de conteúdo
 * confere). Nenhum é o nome de um herói de carta (`namedHeroes`).
 */
export const heroNames: ReadonlyArray<{ readonly name: string; readonly gender: HeroGenderId }> = [
  { name: 'Aldara', gender: 'f' },
  { name: 'Afonso', gender: 'm' },
  { name: 'Brites', gender: 'f' },
  { name: 'Bernardo', gender: 'm' },
  { name: 'Elvira', gender: 'f' },
  { name: 'Diogo', gender: 'm' },
  { name: 'Guiomar', gender: 'f' },
  { name: 'Egas', gender: 'm' },
  { name: 'Leonor', gender: 'f' },
  { name: 'Fernão', gender: 'm' },
  { name: 'Mafalda', gender: 'f' },
  { name: 'Gonçalo', gender: 'm' },
  { name: 'Mécia', gender: 'f' },
  { name: 'Lopo', gender: 'm' },
  { name: 'Sancha', gender: 'f' },
  { name: 'Martim', gender: 'm' },
  { name: 'Teresa', gender: 'f' },
  { name: 'Nuno', gender: 'm' },
  { name: 'Urraca', gender: 'f' },
  { name: 'Rui', gender: 'm' },
  { name: 'Violante', gender: 'f' },
  { name: 'Soeiro', gender: 'm' },
  { name: 'Aldonça', gender: 'f' },
  { name: 'Vasco', gender: 'm' },
];
