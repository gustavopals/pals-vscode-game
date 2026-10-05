import type {
  HeroAttributeId,
  HeroClassId,
  HeroGenderId,
  HeroStatusId,
  HeroTraitId,
  NamedHeroId,
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
 * tarefa que o implementa (os das expedições, na Fase D; o do Devoto e o do Carismático, com a
 * Taverna); o que é de outra versão (a aura de comandante do Veterano) não entra nem como campo.
 */
export type HeroTraitEffects = {
  /** Nunca fica Descontente nem parte por soldo em atraso (GDD §9.1). */
  readonly loyalInArrears?: true;
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
    effects: {},
  },
  devout: {
    label: 'Devoto',
    labelFeminine: 'Devota',
    text: 'Tem fé, e a fé levanta o ânimo do feudo.',
    effects: {},
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
