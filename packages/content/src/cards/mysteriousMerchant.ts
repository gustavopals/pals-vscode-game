import type { CouncilCard } from '../council';

/** Ficha aprovada: docs/content-v0.4.md, §5.1. */
export const mysteriousMerchant: CouncilCard = {
  id: 'mysteriousMerchant',
  title: 'O Mercador Misterioso',
  text: 'Um forasteiro de capa verde armou banca à beira do Mercado sem pedir licença. Vende pouca coisa e promete muito: diz ter um mapa da serra, desenhado por alguém que voltou de lá. Os guardas olham para ele com desconfiança, e ele olha para a bolsa do senhor.',
  weight: 2,
  requires: {
    seasons: ['summer'],
    buildings: {
      market: 1,
      guild: 1,
    },
    undiscovered: 'ruins',
    notFlags: ['merchant.map', 'merchant.hostile'],
  },
  autoResolve: {
    peasant: 'refuse',
    lord: 'refuse',
    ironKing: 'imprison',
  },
  options: [
    {
      id: 'buy',
      label: 'Comprar o mapa',
      requires: {
        resources: {
          gold: 80,
        },
      },
      cost: {
        gold: 80,
      },
      effects: [
        {
          type: 'revealDestination',
          modelId: 'ruins',
        },
        {
          type: 'setFlag',
          flag: 'merchant.map',
        },
        {
          type: 'scheduleCard',
          cardId: 'merchantLead',
          afterDays: 4,
        },
      ],
      hint: 'O mapa é bom ou é desenho de bêbado, e o feudo só saberá depois.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou um mapa do forasteiro de capa verde. A tinta ainda cheirava a fumaça.',
    },
    {
      id: 'imprison',
      label: 'Prender o forasteiro',
      effects: [
        {
          type: 'resources',
          amounts: {
            gold: 50,
          },
        },
        {
          type: 'morale',
          amount: -10,
          durationDays: 2,
        },
        {
          type: 'marketPrice',
          resources: ['food', 'wood', 'stone', 'iron'],
          factor: {
            num: 6,
            den: 5,
          },
          durationDays: 2,
        },
        {
          type: 'setFlag',
          flag: 'merchant.hostile',
        },
        {
          type: 'scheduleCard',
          cardId: 'merchantLead',
          afterDays: 3,
        },
      ],
      hint: 'A bolsa dele paga a cela, e os mercadores da estrada não esquecem.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou prender o mercador de capa verde. Os preços da praça subiram no mesmo dia.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou prender o mercador de capa verde. Os preços da praça subiram no mesmo dia.',
    },
    {
      id: 'refuse',
      label: 'Mandar o homem embora',
      effects: [],
      hint: 'Quem vende mapa a estranhos pode ter vendido o mesmo a outros.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o mercador de capa verde embora. Ele dobrou a banca sem reclamar.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o mercador de capa verde embora. Ele dobrou a banca sem reclamar.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §5.2. */
export const merchantLead: CouncilCard = {
  id: 'merchantLead',
  title: 'O que o mapa mostrava',
  text: 'O mapa do forasteiro era verdadeiro, e mais: no canto dele há uma marca a carvão, um traço para além das Ruínas, e um homem do Mercado jura que já viu aquele traço num livro de contas. Seguir a marca dá trabalho. Vendê-la a quem a procura dá ouro.',
  weight: 0,
  autoResolve: {
    peasant: 'drop',
    lord: 'drop',
    ironKing: 'sell',
  },
  variants: [
    {
      flag: 'merchant.map',
      text: 'O mapa do forasteiro era verdadeiro, e mais: no canto dele há uma marca a carvão, um traço para além das Ruínas, e um homem do Mercado jura que já viu aquele traço num livro de contas. Seguir a marca dá trabalho. Vendê-la a quem a procura dá ouro.',
    },
    {
      flag: 'merchant.hostile',
      text: 'O mercador preso escapou na calada da noite e deixou para trás o livro de contas, com uma rota riscada a tinta. Os companheiros dele rondam o Mercado, calados. Seguir a rota dá trabalho. Vender o livro a quem o procura dá ouro.',
    },
  ],
  options: [
    {
      id: 'follow',
      label: 'Seguir a pista',
      cost: {
        food: 40,
      },
      effects: [
        {
          type: 'resources',
          amounts: {
            gold: 90,
          },
        },
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
        {
          type: 'setFlag',
          flag: 'merchant.lead',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.map',
        },
        {
          type: 'scheduleCard',
          cardId: 'merchantFinalOffer',
          afterDays: 3,
        },
      ],
      hint: 'A pista vale ouro e traz companhia.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou seguir a marca do mercador. Os batedores voltaram com lama até os joelhos e com uma história para contar.',
    },
    {
      id: 'sell',
      label: 'Vender a informação',
      effects: [
        {
          type: 'resources',
          amounts: {
            gold: 120,
          },
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
        {
          type: 'setFlag',
          flag: 'merchant.sold',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.map',
        },
        {
          type: 'scheduleCard',
          cardId: 'merchantFinalOffer',
          afterDays: 3,
        },
      ],
      hint: 'Mais moedas hoje, e um comprador que volta amanhã.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu a pista do mercador a quem a procurava. O comprador pagou em moedas miúdas e saiu sem se despedir.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} vendeu a pista do mercador a quem a procurava. O comprador pagou em moedas miúdas e saiu sem se despedir.',
    },
    {
      id: 'drop',
      label: 'Deixar o assunto de lado',
      effects: [
        {
          type: 'clearFlag',
          flag: 'merchant.map',
        },
      ],
      hint: 'Nem toda pista precisa ser seguida.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a pista do mercador de lado. O mapa foi dobrado e guardado numa arca.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a pista do mercador de lado. O mapa foi dobrado e guardado numa arca.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §5.3. */
export const merchantFinalOffer: CouncilCard = {
  id: 'merchantFinalOffer',
  title: 'A última oferta do mercador',
  text: 'A pista deu em um depósito de caravana esquecido, e o homem de capa verde reaparece na praça com um sorriso de quem sabia. Propõe fechar as contas: uma bolsa pelo que os batedores acharam, ou um último mapa em troca de um favor. O conselho quer saber o que o senhor responde.',
  weight: 0,
  autoResolve: {
    peasant: 'profit',
    lord: 'profit',
    ironKing: 'profit',
  },
  variants: [
    {
      flag: 'merchant.lead',
      text: 'A pista deu em um depósito de caravana esquecido, e o homem de capa verde reaparece na praça com um sorriso de quem sabia. Propõe fechar as contas: uma bolsa pelo que os batedores acharam, ou um último mapa em troca de um favor. O conselho quer saber o que o senhor responde.',
    },
    {
      flag: 'merchant.sold',
      text: 'O comprador da pista voltou à praça com a bolsa leve e a conversa mansa. Diz que a informação valia mais do que pagou, e que está disposto a compensar, de um modo ou de outro. O conselho quer saber o que o senhor responde.',
    },
  ],
  options: [
    {
      id: 'profit',
      label: 'Fechar com lucro',
      effects: [
        {
          type: 'resources',
          amounts: {
            gold: 100,
          },
        },
        {
          type: 'clearFlag',
          flag: 'merchant.lead',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.sold',
        },
      ],
      hint: 'Dinheiro na mão e conta fechada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} fechou as contas com o mercador de capa verde. Ele contou as moedas duas vezes, e nenhuma faltou.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} fechou as contas com o mercador de capa verde. Ele contou as moedas duas vezes, e nenhuma faltou.',
    },
    {
      id: 'destination',
      label: 'Pedir o último mapa',
      requires: {
        buildings: {
          guild: 2,
        },
        undiscovered: 'abandonedMine',
      },
      cost: {
        gold: 50,
      },
      effects: [
        {
          type: 'revealDestination',
          modelId: 'abandonedMine',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.lead',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.sold',
        },
      ],
      hint: 'A serra tem mais de um segredo, e este tem ferro.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pediu ao mercador de capa verde o último mapa. Ele o desenhou ali mesmo, e a Mina Abandonada ficou no papel.',
    },
    {
      id: 'peace',
      label: 'Fazer as pazes com os mercadores',
      requires: {
        flags: ['merchant.hostile'],
      },
      cost: {
        gold: 60,
      },
      effects: [
        {
          type: 'clearFlag',
          flag: 'merchant.hostile',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.lead',
        },
        {
          type: 'clearFlag',
          flag: 'merchant.sold',
        },
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'Um inimigo a menos pesa mais que uma bolsa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} fez as pazes com os mercadores da estrada. Brindou-se na praça, e os preços voltaram ao normal.',
    },
  ],
};
