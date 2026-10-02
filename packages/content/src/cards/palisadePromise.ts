import type { CouncilCard } from '../council';

/**
 * Cadeia "A Promessa da Paliçada" (roadmap da v0.2, §12.2): os aldeões pedem proteção, o senhor
 * promete (ou não), o prazo chega, e a palavra é cumprida ou explicada. A carta não dá
 * proteção nenhuma: quem protege é a Paliçada, que o senhor ergue com as obras de sempre.
 *
 * Só a primeira é sorteada, com o Salão no nível 3 (o que libera a Paliçada). A opção de quem
 * já ergueu a Paliçada aparece nas três cartas, trancada enquanto o edifício não existe. É
 * também a que o conselho aplica sozinho quando a carta expira com a obra de pé
 * (`autoResolveIfUnlocked`): a cerca erguida cumpre a promessa mesmo sem o senhor na sala, e a
 * Crônica nunca diz que ela "não saiu" diante de quem a vê.
 *
 * Flags: `palisadePromise.open` marca a cadeia em curso. Ficam gravados só os desfechos:
 * `kept` (a primeira carta nunca mais volta) e `broken` (ela volta no ano seguinte, e o texto
 * lembra a promessa que não se cumpriu).
 */

export const palisadePromisePlea: CouncilCard = {
  id: 'palisadePromisePlea',
  title: 'Os aldeões pedem uma cerca',
  text: 'Há pegadas grandes na lama, junto aos currais, e as mães já não deixam as crianças buscar água sozinhas. Os aldeões pedem uma paliçada em volta do feudo. O conselho quer saber o que o senhor responde.',
  weight: 3,
  requires: {
    buildings: { townHall: 3 },
    notFlags: ['palisadePromise.open', 'palisadePromise.kept'],
  },
  variants: [
    {
      flag: 'palisadePromise.broken',
      text: 'Os aldeões voltam a pedir uma paliçada em volta do feudo. Lembram, sem levantar a voz, que ela já foi prometida uma vez. O conselho quer saber o que o senhor responde agora.',
      arrival:
        'No {dia}º dia {daEstacao}, os aldeões de {feudo} voltaram a pedir a paliçada que um dia lhes foi prometida: {carta}.',
    },
  ],
  autoResolve: { peasant: 'explain', lord: 'explain', ironKing: 'promise' },
  autoResolveIfUnlocked: 'show',
  options: [
    {
      id: 'show',
      label: 'Mostrar a paliçada erguida',
      requires: { building: 'palisade' },
      effects: [
        { type: 'morale', amount: 10, durationDays: 3 },
        { type: 'clearFlag', flag: 'palisadePromise.broken' },
        { type: 'setFlag', flag: 'palisadePromise.kept' },
      ],
      hint: 'Quem já fez não precisa prometer.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} levou os aldeões até a paliçada já erguida. Ninguém pediu mais nada.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} levou os aldeões até a paliçada já erguida. Ninguém pediu mais nada.',
    },
    {
      id: 'explain',
      label: 'Explicar que não é hora',
      effects: [],
      hint: 'Nada se promete e nada se deve. O medo continua do tamanho que está.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} explicou aos aldeões que a paliçada terá de esperar. Ouviram calados.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} explicou aos aldeões que a paliçada terá de esperar. Ouviram calados.',
    },
    {
      id: 'promise',
      label: 'Prometer a paliçada',
      effects: [
        { type: 'morale', amount: 10, durationDays: 3 },
        { type: 'setFlag', flag: 'palisadePromise.open' },
        { type: 'scheduleCard', cardId: 'palisadePromiseDeadline', afterDays: 4 },
      ],
      hint: 'Promessa aquece hoje. O povo conta os dias, e cobra em quatro.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} prometeu aos aldeões uma paliçada em volta do feudo. Dormiu-se melhor naquela noite.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} prometeu aos aldeões, em nome dele, uma paliçada em volta do feudo.',
    },
  ],
};

export const palisadePromiseDeadline: CouncilCard = {
  id: 'palisadePromiseDeadline',
  title: 'O prazo da paliçada',
  text: 'Passaram-se os dias da promessa. Os aldeões vieram ao salão sem pressa e sem sorriso, e olham para onde a paliçada devia estar. O conselho pergunta o que mostrar a eles.',
  weight: 0,
  arrival:
    'No {dia}º dia {daEstacao}, os aldeões de {feudo} vieram cobrar a paliçada prometida: {carta}.',
  autoResolve: { peasant: 'delay', lord: 'delay', ironKing: 'withdraw' },
  autoResolveIfUnlocked: 'show',
  options: [
    {
      id: 'show',
      label: 'Mostrar a paliçada erguida',
      requires: { building: 'palisade' },
      effects: [
        { type: 'morale', amount: 15, durationDays: 3 },
        { type: 'clearFlag', flag: 'palisadePromise.open' },
        { type: 'clearFlag', flag: 'palisadePromise.broken' },
        { type: 'setFlag', flag: 'palisadePromise.kept' },
      ],
      hint: 'Palavra cumprida no prazo vale mais que a própria cerca.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mostrou aos aldeões a paliçada que prometera. Passaram a mão nas estacas, um por um.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} levou os aldeões até a paliçada prometida. Passaram a mão nas estacas, um por um.',
    },
    {
      id: 'delay',
      label: 'Pedir mais alguns dias',
      effects: [{ type: 'scheduleCard', cardId: 'palisadePromiseReckoning', afterDays: 4 }],
      hint: 'O povo espera mais quatro dias. Não espera uma terceira vez.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pediu aos aldeões mais alguns dias para a paliçada. Concederam, contando nos dedos.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} pediu aos aldeões mais alguns dias para a paliçada. Concederam, contando nos dedos.',
    },
    {
      id: 'withdraw',
      label: 'Desfazer a promessa',
      effects: [
        { type: 'morale', amount: -10, durationDays: 3 },
        { type: 'clearFlag', flag: 'palisadePromise.open' },
        { type: 'setFlag', flag: 'palisadePromise.broken' },
      ],
      hint: 'Dói agora, e acaba aqui. Quem adia e não cumpre paga mais caro.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} desfez a promessa da paliçada diante dos aldeões. Saíram do salão sem se despedir.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} desfez a promessa da paliçada. Os aldeões saíram do salão sem se despedir.',
    },
  ],
};

export const palisadePromiseReckoning: CouncilCard = {
  id: 'palisadePromiseReckoning',
  title: 'A palavra do senhor',
  text: 'O segundo prazo também acabou. Os aldeões já não perguntam pela paliçada: perguntam se a palavra do senhor ainda vale. O conselho não tem mais dias para pedir.',
  weight: 0,
  arrival:
    'No {dia}º dia {daEstacao}, acabou o prazo que o senhor de {feudo} pedira para a paliçada: {carta}.',
  autoResolve: { peasant: 'admit', lord: 'admit', ironKing: 'admit' },
  autoResolveIfUnlocked: 'show',
  options: [
    {
      id: 'show',
      label: 'Mostrar a paliçada, enfim',
      requires: { building: 'palisade' },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'clearFlag', flag: 'palisadePromise.open' },
        { type: 'clearFlag', flag: 'palisadePromise.broken' },
        { type: 'setFlag', flag: 'palisadePromise.kept' },
      ],
      hint: 'Tarde, mas de pé. O povo perdoa atraso; não perdoa ausência.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mostrou enfim a paliçada prometida. Veio tarde, e veio.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mostrou enfim a paliçada prometida. Veio tarde, e veio.',
    },
    {
      id: 'admit',
      label: 'Explicar o atraso',
      effects: [
        { type: 'morale', amount: -15, durationDays: 3 },
        { type: 'clearFlag', flag: 'palisadePromise.open' },
        { type: 'setFlag', flag: 'palisadePromise.broken' },
      ],
      hint: 'Explicação não é estaca. O povo ouve, e lembra.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} explicou por que a paliçada não saiu. Os aldeões ouviram até o fim, e ninguém respondeu.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} tentou explicar por que a paliçada não saiu. Os aldeões ouviram até o fim, e ninguém respondeu.',
    },
  ],
};
