import type { MoraleBandId, ProductionBuildingId } from './ids';

export const EVENT_TYPES = [
  'dayStarted',
  'seasonChanged',
  'yearStarted',
  'constructionStarted',
  'constructionAutoStarted',
  'constructionFinished',
  'constructionCancelled',
  'buildingFounded',
  'recruitmentStarted',
  'recruitmentFinished',
  'famineStarted',
  'famineEnded',
  'coldStarted',
  'coldEnded',
  'storageFilled',
  'storageWasted',
  'craftMastered',
  'moraleBandChanged',
  'villagerArrived',
  'villagerLeft',
  'villagerDeserted',
  'cardDrawn',
  'cardAnswered',
  'cardExpired',
  'cardEffectApplied',
  'objectiveCompleted',
  'settlementRenamed',
] as const;
export type GameEventType = (typeof EVENT_TYPES)[number];

/**
 * Marcadores aceitos nos modelos de frase:
 * {dia} dia da estação · {estacao} "Primavera" · {aEstacao} "a Primavera" · {daEstacao} "da Primavera"
 * {ano} · {feudo} · {edificio} "a Serraria" · {nivel} · {quantidade} · {objetivo} · {recompensa}
 * {alivio} por que o frio passou: uma das frases de `coldReliefs`
 * {deposito} onde o recurso fica: "o Celeiro", "a despensa" · {recurso} "comida"
 * {perda} o que se perdeu: "120 de comida e 40 de madeira"
 * {artifices} quem trabalha no edifício: "os lenhadores" · {feito} o que se diz de quem domina o
 * ofício: as duas frases vêm de `craftGuilds`
 * {moral} a faixa da moral, em minúscula: "inquieto"
 * {aldeao} quem partiu: "um lenhador" (de `craftGuilds`) ou "um aldeão sem ofício"
 * {carta} o título de uma carta do Conselho: "Tábuas para as reservas"
 * {opcao} a opção escolhida, em minúscula, para o meio da frase: "conservar as reservas"
 */
export const CHRONICLE_PLACEHOLDERS = [
  'dia',
  'estacao',
  'aEstacao',
  'daEstacao',
  'ano',
  'feudo',
  'edificio',
  'nivel',
  'quantidade',
  'objetivo',
  'recompensa',
  'alivio',
  'deposito',
  'recurso',
  'perda',
  'artifices',
  'feito',
  'moral',
  'aldeao',
  'carta',
  'opcao',
] as const;
export type ChroniclePlaceholder = (typeof CHRONICLE_PLACEHOLDERS)[number];

// GDD Apêndice E: tom de crônica medieval, frases curtas.
export const chronicleTemplates: Record<GameEventType, string> = {
  dayStarted: 'Amanhece o {dia}º dia {daEstacao} em {feudo}.',
  seasonChanged: 'Chega {aEstacao} a {feudo}.',
  yearStarted: 'Começa o ano {ano} da Casa de {feudo}.',
  constructionStarted:
    'No {dia}º dia {daEstacao}, os pedreiros começaram a erguer {edificio} ao {nivel}º nível.',
  // A planejada marcada "iniciar quando houver recursos", iniciada pelo motor (GDD §6.3).
  constructionAutoStarted:
    'No {dia}º dia {daEstacao}, com as reservas cheias, os pedreiros começaram sozinhos a erguer {edificio} ao {nivel}º nível.',
  constructionFinished:
    'No {dia}º dia {daEstacao}, os pedreiros ergueram {edificio} ao {nivel}º nível.',
  constructionCancelled:
    'No {dia}º dia {daEstacao}, os pedreiros largaram as ferramentas: {edificio} fica no {nivel}º nível.',
  buildingFounded: 'No {dia}º dia {daEstacao}, ergueu-se {edificio} em {feudo}.',
  recruitmentStarted:
    'No {dia}º dia {daEstacao}, o Salão mandou chamar novos aldeões: {quantidade}.',
  recruitmentFinished:
    'No {dia}º dia {daEstacao}, um novo aldeão se juntou ao feudo. Agora são {quantidade}.',
  famineStarted:
    'No {dia}º dia {daEstacao}, as despensas de {feudo} ficaram vazias. A fome começou.',
  famineEnded: 'No {dia}º dia {daEstacao}, voltou a haver pão em {feudo}. A fome acabou.',
  coldStarted:
    'No {dia}º dia {daEstacao}, queimou-se a última acha de lenha em {feudo}. O frio entrou nas casas.',
  coldEnded: 'No {dia}º dia {daEstacao}, {alivio} em {feudo}. O frio passou.',
  storageFilled:
    'No {dia}º dia {daEstacao}, {deposito} de {feudo} encheu: não cabe mais {recurso}, e o que chegar se perde.',
  // O dia do modelo é o que acabou: a conta fecha na virada.
  storageWasted:
    'No {dia}º dia {daEstacao}, a produção de {feudo} não coube nos depósitos e foi ao chão: {perda}.',
  // A experiência do ofício chegou ao máximo (GDD §5.4): uma vez por edifício e por ano.
  craftMastered: 'No {dia}º dia {daEstacao}, {artifices} de {feudo} dominaram o ofício: {feito}.',
  // A faixa da moral mudou (GDD §5.7). Cada faixa tem a sua frase, para quem sobe e para quem
  // desce, em `moraleBandTemplates`; esta só vale para uma faixa que ainda não tenha a dela.
  moraleBandChanged: 'No {dia}º dia {daEstacao}, o ânimo de {feudo} mudou: o povo está {moral}.',
  // Moral alta e vaga nas casas: um colono chega sem ninguém o chamar.
  villagerArrived:
    'No {dia}º dia {daEstacao}, um colono bateu ao portão, atraído pela fama de {feudo}. Agora são {quantidade}.',
  // Moral baixa: alguém vai embora.
  villagerLeft:
    'No {dia}º dia {daEstacao}, {aldeao} juntou a trouxa e deixou {feudo}: o povo anda sem ânimo. Restam {quantidade}.',
  // Fome longa: alguém foge (GDD §5.6).
  villagerDeserted:
    'No {dia}º dia {daEstacao}, {aldeao} fugiu da fome de {feudo} na calada da noite. Restam {quantidade}.',
  // O Conselho do Feudo (GDD §7). Estas são as frases gerais: cada carta pode trazer a sua para
  // a chegada (`arrival`), cada opção traz a da escolha (`chronicle`) e pode trazer a da
  // expiração (`expiredChronicle`), e o efeito que só aparece depois traz a dele (`hidden`).
  cardDrawn: 'No {dia}º dia {daEstacao}, o conselho de {feudo} pediu audiência: {carta}.',
  cardAnswered: 'No {dia}º dia {daEstacao}, o senhor de {feudo} decidiu sobre "{carta}": {opcao}.',
  // A carta expirou sem resposta: a frase diz qual e o que o conselho fez.
  cardExpired:
    'No {dia}º dia {daEstacao}, o conselho de {feudo} esperou em vão pelo senhor e decidiu sozinho sobre "{carta}": {opcao}.',
  // O efeito que a opção escondia: é aqui que o jogador o descobre.
  cardEffectApplied:
    'No {dia}º dia {daEstacao}, uma decisão antiga do conselho de {feudo} mostrou a que veio: {carta}.',
  objectiveCompleted:
    'No {dia}º dia {daEstacao}, cumpriu-se um objetivo: {objetivo}. Recompensa: {recompensa}.',
  settlementRenamed: 'No {dia}º dia {daEstacao}, o feudo passou a se chamar {feudo}.',
};

/**
 * Por que o frio passou: a frase que entra em {alivio} no modelo de `coldEnded`. `firewood`
 * quando voltou a haver madeira para queimar; `thaw` quando a estação da lenha terminou.
 */
export const coldReliefs = {
  firewood: 'as lareiras voltaram a arder',
  thaw: 'o gelo cedeu',
} as const;
export type ColdRelief = keyof typeof coldReliefs;

/**
 * Quem trabalha em cada edifício produtivo, e o que a Crônica diz deles quando dominam o ofício:
 * entram em {artifices} e {feito} no modelo de `craftMastered`. `artisan` é um deles, para a
 * linha de quem parte ({aldeao}). As frases ficam no meio de outra: minúscula, sem ponto.
 */
export const craftGuilds: Record<
  ProductionBuildingId,
  { readonly artisans: string; readonly artisan: string; readonly feat: string }
> = {
  farm: {
    artisans: 'os lavradores',
    artisan: 'um lavrador',
    feat: 'já não há sulco torto nos campos',
  },
  lumberMill: {
    artisans: 'os lenhadores',
    artisan: 'um lenhador',
    feat: 'já nenhum machado erra o golpe',
  },
  quarry: {
    artisans: 'os canteiros',
    artisan: 'um canteiro',
    feat: 'a rocha agora se parte onde eles querem',
  },
  goldMine: { artisans: 'os mineiros', artisan: 'um mineiro', feat: 'já nenhum veio lhes escapa' },
};

/** Quem parte sem ter ofício: entra em {aldeao} como os de `craftGuilds`. */
export const idleVillager = 'um aldeão sem ofício';

/**
 * A mudança de faixa da moral é o mesmo evento com uma frase por faixa de chegada e por
 * sentido: `rose` para quem subiu até ela, `fell` para quem desceu. A faixa mais baixa não tem
 * `rose` e a mais alta não tem `fell`: ninguém chega a elas por esse lado.
 */
export const moraleBandTemplates: Record<
  MoraleBandId,
  { readonly rose?: string; readonly fell?: string }
> = {
  desperate: {
    fell: 'No {dia}º dia {daEstacao}, o povo de {feudo} perdeu a esperança. Já se fala em ir embora.',
  },
  restless: {
    rose: 'No {dia}º dia {daEstacao}, o pior passou em {feudo}, mas o povo ainda anda inquieto.',
    fell: 'No {dia}º dia {daEstacao}, o povo de {feudo} anda inquieto. Há resmungos junto ao poço.',
  },
  content: {
    rose: 'No {dia}º dia {daEstacao}, os resmungos cessaram em {feudo}. O povo está contente.',
    fell: 'No {dia}º dia {daEstacao}, o orgulho de {feudo} arrefeceu. O povo segue contente, e só.',
  },
  proud: {
    rose: 'No {dia}º dia {daEstacao}, o povo de {feudo} anda de cabeça erguida. Fala-se do feudo nas estradas.',
  },
};

/**
 * A obra que ergue um edifício do zero (nível 0 → 1) é o mesmo evento com outra frase: não há
 * nível a que subir nem em que ficar. A conclusão tem evento próprio, `buildingFounded`.
 */
export const foundingTemplates = {
  constructionStarted:
    'No {dia}º dia {daEstacao}, os pedreiros começaram a levantar {edificio} em {feudo}.',
  constructionAutoStarted:
    'No {dia}º dia {daEstacao}, com as reservas cheias, os pedreiros começaram sozinhos a levantar {edificio} em {feudo}.',
  constructionCancelled:
    'No {dia}º dia {daEstacao}, os pedreiros largaram as ferramentas: {edificio} ficou só nos alicerces.',
} as const satisfies Partial<Record<GameEventType, string>>;
export type FoundingEventType = keyof typeof foundingTemplates;

/**
 * A recompensa que não coube inteira no depósito (GDD §5.5) é o mesmo evento com outra frase:
 * a linha promete a recompensa inteira e diz o que foi ao chão. {perda} é a lista do que se
 * perdeu ("25,2 de comida") e entra depois dos dois pontos, como no fecho do dia.
 */
export const cutRewardTemplates = {
  objectiveCompleted:
    'No {dia}º dia {daEstacao}, cumpriu-se um objetivo: {objetivo}. Recompensa: {recompensa}. Faltou lugar no depósito, e foi ao chão: {perda}.',
} as const satisfies Partial<Record<GameEventType, string>>;
