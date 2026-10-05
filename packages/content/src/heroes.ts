import type { HeroAttributeId, HeroClassId, HeroStatusId, HeroTraitId } from './ids';

/**
 * Uma classe de herói (GDD §9.1; ADR 0017, decisão 7 e "Atributos-base das classes"): o nome e os
 * seis atributos do nível 1, todos inteiros. O que o nível e o soldo em atraso fazem com eles
 * está em `balance.heroes`; nesta versão a classe só conta no poder.
 */
export type HeroClassDef = {
  /** "Guerreiro": como a ficha do herói a mostra. */
  readonly label: string;
  readonly attributes: Record<HeroAttributeId, number>;
};

export const heroClasses: Record<HeroClassId, HeroClassDef> = {
  warrior: {
    label: 'Guerreiro',
    attributes: { health: 120, attack: 14, defense: 16, speed: 8, skill: 6, will: 8 },
  },
  archer: {
    label: 'Arqueiro',
    attributes: { health: 90, attack: 18, defense: 9, speed: 14, skill: 14, will: 8 },
  },
  mage: {
    label: 'Mago',
    attributes: { health: 70, attack: 22, defense: 6, speed: 9, skill: 10, will: 16 },
  },
  cleric: {
    label: 'Clérigo',
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
  /** Uma frase sobre o que o traço faz nesta versão, sem números. */
  readonly text: string;
  readonly effects: HeroTraitEffects;
};

export const heroTraits: Record<HeroTraitId, HeroTraitDef> = {
  brave: {
    label: 'Corajoso',
    text: 'Rende mais quando a ordem é de ousadia, e se fere com mais facilidade.',
    effects: {},
  },
  prudent: {
    label: 'Prudente',
    text: 'Rende mais quando a ordem é de cautela, e não cai em armadilha simples.',
    effects: {},
  },
  greedy: {
    label: 'Ganancioso',
    text: 'Volta com mais saque, e às vezes o perde no caminho.',
    effects: {},
  },
  charismatic: {
    label: 'Carismático',
    text: 'Sabe negociar: abre caminhos no conselho e barateia quem a Taverna oferece.',
    effects: {},
  },
  devout: {
    label: 'Devoto',
    text: 'A fé dele levanta o ânimo do feudo.',
    effects: {},
  },
  veteran: {
    label: 'Veterano',
    text: 'Já chegou ao feudo com um nível a mais.',
    effects: {},
  },
  loyal: {
    label: 'Leal',
    text: 'Nunca fica descontente nem parte por soldo em atraso.',
    effects: { loyalInArrears: true },
  },
  tracker: {
    label: 'Rastreador',
    text: 'Acha o caminho de volta a um lugar mesmo quando a jornada vai mal.',
    effects: {},
  },
};

/** Como a ficha diz o que o herói está fazendo. */
export const heroStatuses: Record<HeroStatusId, { readonly label: string }> = {
  idle: { label: 'No feudo' },
};
