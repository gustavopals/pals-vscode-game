import type { HeroGenderId, MasterId, ProductionBuildingId } from './ids';

/**
 * Os Mestres (GDD §5.4; ADR 0018, decisão 18): aldeões com nome, raros, que chegam por uma
 * expedição ou por uma carta e ficam. Os números (o bônus, um por edifício, a adaptação) estão
 * em `balance.masters`; as linhas da Crônica, em `chronicle.ts`. Rascunho que o autor não leu.
 *
 * **O ofício de origem é só narrativa**: o bônus vale em qualquer edifício produtivo. `origin`
 * diz de que edifício o Mestre fala quando conta de onde veio, e `originText` é a frase da
 * ficha, para depois do nome ("Mestre Odo, canteiro das pedreiras velhas").
 *
 * Cada Mestre chega **uma vez só** por partida: quem já está no feudo, ou à porta, não é
 * sorteado nem prometido de novo.
 */
export type MasterDef = {
  readonly name: string;
  readonly gender: HeroGenderId;
  readonly origin: ProductionBuildingId;
  readonly originText: string;
};

export const masters: Record<MasterId, MasterDef> = {
  odo: {
    name: 'Odo',
    gender: 'm',
    origin: 'quarry',
    originText: 'canteiro das pedreiras velhas',
  },
  berta: {
    name: 'Berta',
    gender: 'f',
    origin: 'farm',
    originText: 'lavradora das terras alagadas',
  },
  gil: {
    name: 'Gil',
    gender: 'm',
    origin: 'lumberMill',
    originText: 'carpinteiro de ribeira',
  },
  ximena: {
    name: 'Ximena',
    gender: 'f',
    origin: 'goldMine',
    originText: 'mineira dos veios fundos',
  },
};

/**
 * As frases dos Mestres na tela, com lacunas que o motor preenche. **Nenhum número de regra é
 * escrito aqui**: o que a frase conta vem de `balance.masters` e de `balance.craft`.
 */
export const masterTexts = {
  /** O tratamento, na frente do nome: "Mestre Odo", "Mestra Berta". */
  titleMasculine: 'Mestre',
  titleFeminine: 'Mestra',
  /** Onde está quem ainda não tem edifício. */
  free: 'Sem edifício',
  /** O bônus em uma frase: `{bonus}` são pontos percentuais. */
  bonus: '+{bonus}% na produção do edifício em que trabalha.',
  /** O termo da explicação da produção: "× 1,15 (Mestre Odo)". */
  factor: '{mestre}',
  /** O que a linha do edifício diz do Mestre que rende inteiro, e do que ainda se adapta. */
  working: '+{bonus}% na produção',
  adapting: 'em adaptação por {prazo}: ainda sem o bônus',
  /** As regras, antes de o jogador confirmar: `{prazo}` é tempo real, `{parte}` vem do ofício. */
  rules:
    'Um Mestre conta como um trabalhador do edifício e soma {bonus}% à produção dele. Cabe um Mestre por edifício. Ao chegar a um edifício ele se adapta por {prazo}: rende {parte} e não dá o bônus.',
  /** Quem espera à porta: `{mestres}` é "Mestre Odo" ou "Mestre Odo e Mestra Berta". */
  waitingOne: '{mestres} espera uma vaga nas casas: entra assim que houver uma.',
  waitingMany: '{mestres} esperam uma vaga nas casas: entram assim que houver.',
  /** Por que um edifício não recebe este Mestre. */
  buildingTaken: 'já tem {mestre}',
  notBuilt: 'ainda não foi erguido',
  alreadyThere: 'é onde ele trabalha',
} as const;
