import type { CouncilCard } from '../council';

/**
 * Cadeia "Os Refugiados" (docs/content-v0.4.md, seção 4.1 a 4.3; roadmap da v0.4, V4H-T1): três
 * cartas sobre as famílias que a enchente tirou de casa e o ofício que elas trazem. Só a
 * primeira é sorteada; as outras chegam por continuação.
 *
 * Quem recebe a primeira ajuda decide **qual** Mestre pode chegar: abrigar as famílias (flag
 * `refugees.sheltered`) traz Gil, o carpinteiro; dar provisões para a estrada
 * (`refugees.provisioned`) traz Ximena, a mineira. O Mestre chega **uma vez só**: na segunda
 * carta, se o senhor acolhe (`refugees.welcomed`); na terceira, se emprestou o celeiro e agora
 * ergue a bancada (`refugees.passing`). O efeito `addMaster` escolhe o Mestre pelas flags.
 *
 * Flags: `refugees.open` marca a cadeia em curso; `sheltered` e `provisioned` dizem qual foi a
 * primeira ajuda; `welcomed` e `passing` dizem o que veio depois; `settled` fica e conta que um
 * Mestre chegou por esta cadeia (a primeira carta nunca mais volta). As outras saem no desfecho.
 *
 * A Crônica da opção `welcome` é uma só para os dois Mestres (a ficha tinha uma por Mestre, e a
 * frase de uma opção não muda com a flag); quem chega é dito pela linha da chegada do Mestre,
 * logo depois.
 */

export const refugeesAtGates: CouncilCard = {
  id: 'refugeesAtGates',
  title: 'Refugiados nos portões',
  text: 'Uma dúzia de famílias chegou pela estrada do sul, com carroças vazias e crianças no colo. Dizem que a enchente levou a aldeia delas. Pedem um canto para atravessar a estação, e a despensa do feudo terá de dar para todos.',
  weight: 2,
  requires: {
    minDay: 20,
    seasons: ['spring', 'summer', 'autumn'],
    notFlags: ['refugees.open', 'refugees.settled', 'routine.moreMouths'],
  },
  autoResolve: { peasant: 'refuse', lord: 'refuse', ironKing: 'refuse' },
  options: [
    {
      id: 'shelter',
      label: 'Abrigar as famílias',
      requires: { resources: { food: 150 } },
      cost: { food: 60 },
      effects: [
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'refugees.open' },
        { type: 'setFlag', flag: 'refugees.sheltered' },
        { type: 'scheduleCard', cardId: 'refugeesReturn', afterDays: 3 },
      ],
      hint: 'Quem recebe teto na hora ruim lembra do feudo na hora boa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} abriu os portões aos refugiados da enchente. Houve palha nova nos celeiros e caldo para todos.',
    },
    {
      id: 'provide',
      label: 'Dar provisões para a estrada',
      cost: { food: 30 },
      effects: [
        { type: 'setFlag', flag: 'refugees.open' },
        { type: 'setFlag', flag: 'refugees.provisioned' },
        { type: 'scheduleCard', cardId: 'refugeesReturn', afterDays: 4 },
      ],
      hint: 'Eles seguem viagem de barriga cheia, e a estrada dá voltas.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou encher as carroças dos refugiados com pão e nabos. Eles seguiram para o norte ao amanhecer.',
    },
    {
      id: 'refuse',
      label: 'Fechar os portões',
      effects: [],
      hint: 'Nada se gasta, e as famílias procuram outro feudo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} manteve os portões fechados. Os refugiados seguiram pela estrada sem olhar para trás.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, os portões de {feudo} ficaram fechados. Os refugiados seguiram pela estrada sem olhar para trás.',
    },
  ],
};

export const refugeesReturn: CouncilCard = {
  id: 'refugeesReturn',
  title: 'O retorno dos refugiados',
  text: 'As famílias que o feudo abrigou foram ver o que restava da aldeia e voltaram: não restava nada. Pedem para ficar de vez. Entre elas vem Gil, carpinteiro de ribeira, que promete pagar o teto com o ofício.',
  weight: 0,
  variants: [
    {
      flag: 'refugees.provisioned',
      text: 'As famílias que partiram com o pão do feudo acharam as outras portas fechadas e voltaram. Pedem para ficar de vez. Entre elas vem Ximena, mineira dos veios fundos, que promete pagar o teto com o ofício.',
    },
  ],
  autoResolve: { peasant: 'lodge', lord: 'lodge', ironKing: 'dismiss' },
  options: [
    {
      id: 'welcome',
      label: 'Acolher quem voltou',
      cost: { food: 40 },
      effects: [
        { type: 'addMaster', masterId: 'gil', ifFlags: ['refugees.sheltered'] },
        { type: 'addMaster', masterId: 'ximena', ifFlags: ['refugees.provisioned'] },
        { type: 'morale', amount: 5, durationDays: 2 },
        { type: 'setFlag', flag: 'refugees.welcomed' },
        { type: 'setFlag', flag: 'refugees.settled' },
        { type: 'scheduleCard', cardId: 'refugeesCraft', afterDays: 2 },
      ],
      hint: 'Um Mestre fica para sempre e precisa de uma casa com vaga.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} acolheu de vez as famílias da enchente. O mestre que veio com elas já media o chão do feudo com o palmo.',
    },
    {
      id: 'lodge',
      label: 'Emprestar o celeiro por umas noites',
      effects: [
        { type: 'setFlag', flag: 'refugees.passing' },
        { type: 'scheduleCard', cardId: 'refugeesCraft', afterDays: 2 },
      ],
      hint: 'Ninguém é mandado embora hoje, e a decisão fica para depois.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} emprestou o celeiro às famílias da enchente por umas noites.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} emprestou o celeiro às famílias da enchente por umas noites.',
    },
    {
      id: 'dismiss',
      label: 'Mandar seguir viagem',
      effects: [
        { type: 'morale', amount: -5, durationDays: 2 },
        { type: 'resources', amounts: { wood: 30 } },
        { type: 'clearFlag', flag: 'refugees.open' },
        { type: 'clearFlag', flag: 'refugees.sheltered' },
        { type: 'clearFlag', flag: 'refugees.provisioned' },
      ],
      hint: 'Eles deixam a lenha das carroças em paga, e o feudo os vê partir.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou as famílias da enchente seguirem viagem. Deixaram a lenha das carroças e levaram o ofício que traziam.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou as famílias da enchente seguirem viagem. Deixaram a lenha das carroças e levaram o ofício que traziam.',
    },
  ],
};

export const refugeesCraft: CouncilCard = {
  id: 'refugeesCraft',
  title: 'O ofício que eles trouxeram',
  text: 'As famílias da enchente já ajudam na lida, e o Mestre que chegou com elas pede o que um mestre pede: um lugar de verdade para trabalhar. Diz que um feudo com ofício e sem bancada perde metade do que faz. O conselho quer saber se a bancada sai.',
  weight: 0,
  variants: [
    {
      flag: 'refugees.passing',
      text: 'As noites emprestadas acabaram, e as famílias da enchente arrumam as carroças. O mestre entre elas oferece ficar, se o feudo lhe der madeira para uma bancada. O conselho quer saber se a bancada sai.',
    },
  ],
  autoResolve: { peasant: 'thank', lord: 'thank', ironKing: 'charge' },
  options: [
    {
      id: 'workshop',
      label: 'Erguer a bancada',
      cost: { wood: 50 },
      effects: [
        {
          type: 'addMaster',
          masterId: 'gil',
          ifFlags: ['refugees.passing', 'refugees.sheltered'],
        },
        {
          type: 'addMaster',
          masterId: 'ximena',
          ifFlags: ['refugees.passing', 'refugees.provisioned'],
        },
        { type: 'morale', amount: 10, durationDays: 2 },
        { type: 'setFlag', flag: 'refugees.settled' },
        { type: 'clearFlag', flag: 'refugees.open' },
        { type: 'clearFlag', flag: 'refugees.sheltered' },
        { type: 'clearFlag', flag: 'refugees.provisioned' },
        { type: 'clearFlag', flag: 'refugees.welcomed' },
        { type: 'clearFlag', flag: 'refugees.passing' },
      ],
      hint: 'Com a bancada o mestre fica, e quem veio com ele trabalha contente.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou erguer a bancada do mestre da enchente. As famílias já não falam em partir.',
    },
    {
      id: 'thank',
      label: 'Agradecer e deixar como está',
      effects: [
        { type: 'clearFlag', flag: 'refugees.open' },
        { type: 'clearFlag', flag: 'refugees.sheltered' },
        { type: 'clearFlag', flag: 'refugees.provisioned' },
        { type: 'clearFlag', flag: 'refugees.welcomed' },
        { type: 'clearFlag', flag: 'refugees.passing' },
      ],
      hint: 'Nada se gasta: quem já ficou continua, e quem estava de passagem segue viagem.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} agradeceu a oferta do mestre e guardou a madeira para as obras.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} agradeceu a oferta do mestre e guardou a madeira para as obras.',
    },
    {
      id: 'charge',
      label: 'Cobrar a hospedagem',
      effects: [
        { type: 'resources', amounts: { gold: 30 } },
        { type: 'morale', amount: -5, durationDays: 2 },
        { type: 'clearFlag', flag: 'refugees.open' },
        { type: 'clearFlag', flag: 'refugees.sheltered' },
        { type: 'clearFlag', flag: 'refugees.provisioned' },
        { type: 'clearFlag', flag: 'refugees.welcomed' },
        { type: 'clearFlag', flag: 'refugees.passing' },
      ],
      hint: 'As moedas entram, e o feudo comenta o preço de um teto.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cobrou das famílias da enchente as noites de teto. Pagaram em moedas miúdas, sem dizer palavra.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} cobrou das famílias da enchente as noites de teto. Pagaram em moedas miúdas, sem dizer palavra.',
    },
  ],
};
