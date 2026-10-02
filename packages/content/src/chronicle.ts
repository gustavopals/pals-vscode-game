import type { ProductionBuildingId } from './ids';

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
 * entram em {artifices} e {feito} no modelo de `craftMastered`. As duas frases ficam no meio de
 * outra: minúscula, sem ponto.
 */
export const craftGuilds: Record<
  ProductionBuildingId,
  { readonly artisans: string; readonly feat: string }
> = {
  farm: { artisans: 'os lavradores', feat: 'já não há sulco torto nos campos' },
  lumberMill: { artisans: 'os lenhadores', feat: 'já nenhum machado erra o golpe' },
  quarry: { artisans: 'os canteiros', feat: 'a rocha agora se parte onde eles querem' },
  goldMine: { artisans: 'os mineiros', feat: 'já nenhum veio lhes escapa' },
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
