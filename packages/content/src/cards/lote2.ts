import type { CouncilCard } from '../council';

/**
 * Cartas avulsas e roteirizadas do lote 2 e do lote 3 do Conselho (docs/content-v0.4.md, seções
 * 7, 8 e 10; roadmap da v0.4, V4H-T1), lidas e aprovadas pelo autor em 2026-10-23. Entram aqui
 * as avulsas já implementadas. A praga e os choques de preço usam o estado 36 (Mercado e
 * risco na virada, V4H-T1); bônus por prazo, expedição especial e mecânicas de fase futura
 * continuam esperando as tarefas delas.
 *
 * Cada carta é uma constante exportada, escrita por extenso (sem espalhamento), como as demais.
 */

/** "Um bardo na Taverna" (7.2). */
export const tavernBard: CouncilCard = {
  id: 'tavernBard',
  title: 'Um bardo na Taverna',
  text: 'Um bardo de passagem pediu o canto da mesa grande da Taverna e começou a afinar o alaúde antes de ser convidado. Conhece as histórias de três reinos e promete incluir o feudo na quarta. Cobra pela canção, pela cama e pela fama. O taverneiro olha o chão e espera.',
  weight: 2,
  requires: { buildings: { tavern: 1 } },
  autoResolve: { peasant: 'dismiss', lord: 'dismiss', ironKing: 'dismiss' },
  options: [
    {
      id: 'pay',
      label: 'Pagar pela canção',
      cost: { gold: 40 },
      effects: [{ type: 'morale', amount: 10, durationDays: 3 }],
      hint: 'Uma noite de canto vale mais que a bolsa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou pela canção do bardo. A Taverna cantou o refrão até de madrugada.',
    },
    {
      id: 'meal',
      label: 'Dar mesa e cama',
      cost: { food: 30 },
      effects: [{ type: 'morale', amount: 5, durationDays: 2 }],
      hint: 'Barriga cheia canta melhor, e paga com a voz.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu mesa e cama ao bardo de passagem. Ele agradeceu com duas estrofes e meia.',
    },
    {
      id: 'dismiss',
      label: 'Mandá-lo embora',
      effects: [],
      hint: 'A Taverna fica quieta, e o bardo canta noutra praça.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o bardo seguir caminho. A Taverna ficou quieta, e o alaúde partiu nas costas dele.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o bardo seguir caminho. A Taverna ficou quieta, e o alaúde partiu nas costas dele.',
    },
  ],
};

/** "O mapa rasgado" (8.2). */
export const tornMap: CouncilCard = {
  id: 'tornMap',
  title: 'O mapa rasgado',
  text: 'Um caçador de barba curta jogou sobre a mesa da Taverna a metade de um mapa, rasgado com cuidado, e disse que a outra metade ficou com um irmão de quem não gosta. O que há é uma trilha, três marcos e um X de tinta velha. Diz que quem tem coragem de seguir a trilha encontra o que o X promete.',
  weight: 1,
  requires: {
    seasons: ['spring', 'summer', 'autumn'],
    buildings: { guild: 1 },
    undiscovered: true,
  },
  autoResolve: { peasant: 'refuse', lord: 'refuse', ironKing: 'refuse' },
  options: [
    {
      id: 'buy',
      label: 'Comprar o meio mapa',
      cost: { gold: 70 },
      effects: [{ type: 'revealDestination' }],
      hint: 'Setenta de ouro a menos, e a Guilda tem um destino a mais.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou o meio mapa do caçador. A Guilda passou a noite em volta dele, traçando a trilha com o dedo.',
    },
    {
      id: 'barter',
      label: 'Pagar em provisões',
      cost: { food: 40, wood: 20 },
      effects: [{ type: 'revealDestination' }],
      hint: 'O caçador aceita o que tem na despensa, e a conversa é a mesma.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o meio mapa em pão e tochas. O caçador saiu mastigando e sem olhar para trás.',
    },
    {
      id: 'refuse',
      label: 'Recusar o negócio',
      effects: [],
      hint: 'Meio mapa é meia mentira.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} recusou o meio mapa. O caçador dobrou o papel e o levou a outra mesa.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou o meio mapa. O caçador dobrou o papel e o levou a outra mesa.',
    },
  ],
};

/** "O mercador itinerante" (8.3), roteirizada no 20º dia de jogo. */
export const itinerantMerchant: CouncilCard = {
  id: 'itinerantMerchant',
  title: 'O mercador itinerante',
  text: 'Uma carroça coberta de lona remendada parou diante da praça, e o homem que desceu dela abriu as mãos sem pedir licença: tem boa conversa, lugar na estrada e bolsa para quem quiser vender hoje. Não é o Mercado, que o feudo ainda não tem, e ele sabe disso. Faz o preço de quem não volta.',
  weight: 0,
  scripted: { atGameDay: 20 },
  autoResolve: { peasant: 'wait', lord: 'wait', ironKing: 'wait' },
  options: [
    {
      id: 'sellWood',
      label: 'Vender madeira',
      cost: { wood: 100 },
      effects: [{ type: 'resources', amounts: { gold: 50 } }],
      hint: 'Um preço ruim hoje, para quem precisa de ouro hoje.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu madeira ao mercador itinerante. O preço foi ruim, e a carroça saiu mais pesada do que chegou.',
    },
    {
      id: 'sellStone',
      label: 'Vender pedra',
      cost: { stone: 80 },
      effects: [{ type: 'resources', amounts: { gold: 60 } }],
      hint: 'A pedra não anda sozinha, e a carroça sim.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} vendeu pedra ao mercador itinerante. A carroça rangeu sob o peso até a curva da estrada.',
    },
    {
      id: 'wait',
      label: 'Esperar ter o Mercado',
      effects: [{ type: 'setFlag', flag: 'itinerant.heardOfMarket' }],
      hint: 'Quem espera pelo balcão certo vende melhor, e leva mais tempo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o mercador itinerante seguir viagem. Ele disse que o feudo ia precisar de um balcão, e foi embora sem insistir.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o mercador itinerante seguir viagem. Ele disse que o feudo ia precisar de um balcão, e foi embora sem insistir.',
    },
  ],
};

/**
 * "O primeiro recruta" (10.1), roteirizada: sai na primeira audiência com lugar depois de o
 * Salão chegar ao nível 4, o que abre o Quartel. A opção de treinar pede o Quartel de pé e vaga.
 */
export const firstRecruit: CouncilCard = {
  id: 'firstRecruit',
  title: 'O primeiro recruta',
  text: 'No dia em que o Salão ganhou o quarto andar e o Quartel pôde ser riscado no chão, um rapaz de ombros largos esperava no portão desde antes do sol. Não é herói, não é nobre e não tem arma. Quer aprender a segurar uma lança, e o pai dele, que lavra o campo ao lado, fingiu que não via.',
  weight: 0,
  scripted: { onHallLevel: 4 },
  autoResolve: { peasant: 'farm', lord: 'farm', ironKing: 'farm' },
  options: [
    {
      id: 'train',
      label: 'Treiná-lo como Lanceiro',
      requires: { building: 'barracks', soldierRoom: 1 },
      effects: [
        { type: 'addSoldiers', unit: 'spearman', amount: 1 },
        { type: 'morale', amount: 5, durationDays: 2 },
      ],
      hint: 'O primeiro soldado do feudo, de graça, pelo preço de um aldeão a menos.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} aceitou o primeiro recruta no Quartel. O rapaz recebeu uma lança mais alta do que ele e a segurou como quem segura um sonho.',
    },
    {
      id: 'farm',
      label: 'Mandá-lo à Fazenda',
      effects: [
        { type: 'resources', amounts: { food: 30 } },
        { type: 'morale', amount: 5, durationDays: 2 },
      ],
      hint: 'Um braço a mais na colheita, e um pai em paz.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o rapaz de volta à Fazenda. O pai trouxe pão ao Salão em sinal de gratidão.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o rapaz de volta à Fazenda. O pai trouxe pão ao Salão em sinal de gratidão.',
    },
  ],
};

/** "O capitão veterano" (10.4): Osbert, Guerreiro Veterano e Leal, nível 2, por 240 de ouro. */
export const veteranCaptain: CouncilCard = {
  id: 'veteranCaptain',
  title: 'O capitão veterano',
  text: 'Um homem de barba cinzenta e cicatriz de ponta a ponta no rosto entrou na Taverna e pagou a rodada com uma moeda de ouro de um rei que já morreu. Disse que lutou em onze cercos, que perdeu a conta dos feridos e que só quer uma cama e um posto onde não o chamem de velho. Quem o ouve conta que ele passou a noite sem sentar.',
  weight: 2,
  // `veteranCaptain.hired` impede o senhor de pagar duas vezes por quem já serve: o herói com nome
  // é um só (`promiseHero`), e a carta volta a cada ano.
  requires: { buildings: { tavern: 2 }, notFlags: ['veteranCaptain.hired'] },
  autoResolve: { peasant: 'refuse', lord: 'refuse', ironKing: 'refuse' },
  options: [
    {
      id: 'hire',
      label: 'Contratar o capitão',
      requires: { rosterRoom: true },
      cost: { gold: 240 },
      effects: [
        { type: 'addHero', heroId: 'osbert' },
        { type: 'setFlag', flag: 'veteranCaptain.hired' },
      ],
      hint: 'Um veterano de casa pronta, mais barato do que no balcão.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} contratou o capitão Osbert. Ele pendurou a espada atrás da porta e perguntou onde ficava a pedra de amolar.',
    },
    {
      id: 'feast',
      label: 'Pagar-lhe a mesa e ouvir as histórias',
      cost: { food: 40 },
      effects: [{ type: 'morale', amount: 5, durationDays: 3 }],
      hint: 'Não é um herói que fica, mas é uma noite que o povo conta.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a mesa ao capitão veterano. Ele contou onze cercos até o galo cantar, e ninguém quis ir dormir.',
    },
    {
      id: 'refuse',
      label: 'Agradecer e deixá-lo seguir',
      effects: [],
      hint: 'A Taverna tem outros hóspedes, e o ouro fica no cofre.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o capitão veterano seguir viagem. Ele tomou a estrada sem olhar para trás, que é o hábito de quem já se despediu muitas vezes.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o capitão veterano seguir viagem. Ele tomou a estrada sem olhar para trás, que é o hábito de quem já se despediu muitas vezes.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §4.4. */
export const fieldBlight: CouncilCard = {
  id: 'fieldBlight',
  title: 'Praga nos campos',
  text: 'As folhas do trigo amarelam de ponta a ponta, e o cheiro de mofo chega até o portão. Os velhos dizem que a praga se espalha rápido e que a hora de decidir é agora. A despensa depende da colheita.',
  weight: 2,
  requires: {
    seasons: ['summer'],
    resourcesAbove: {
      food: 200,
    },
  },
  autoResolve: {
    peasant: 'pray',
    lord: 'pray',
    ironKing: 'burn',
  },
  options: [
    {
      id: 'burn',
      label: 'Queimar a plantação',
      effects: [
        {
          type: 'resourcesPercent',
          resource: 'food',
          ratio: {
            num: -30,
            den: 100,
          },
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'A fumaça sobe cedo. O que resta fica a salvo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou queimar o trigo doente. A fumaça cobriu o vale até o meio-dia.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou queimar o trigo doente. A fumaça cobriu o vale até o meio-dia.',
    },
    {
      id: 'pray',
      label: 'Rezar e esperar',
      effects: [
        {
          type: 'rollEffect',
          chance: {
            num: 1,
            den: 2,
          },
          withHeroClass: {
            heroClass: 'cleric',
            chance: {
              num: 1,
              den: 5,
            },
          },
          onHit: {
            effects: [
              {
                type: 'resourcesPercent',
                resource: 'food',
                ratio: {
                  num: -50,
                  den: 100,
                },
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, a praga levou metade do que {feudo} guardava nos celeiros.',
          },
          onMiss: {
            effects: [
              {
                type: 'morale',
                amount: 5,
                durationDays: 2,
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, a praga cedeu sozinha. O povo de {feudo} diz que foi a reza.',
          },
        },
      ],
      hint: 'Fé não se mede em sacos. Uma Clériga costuma acalmar o campo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou rezar nos campos e esperar.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou rezar nos campos e esperar.',
    },
    {
      id: 'alchemist',
      label: 'Pagar o alquimista',
      cost: {
        gold: 120,
      },
      effects: [],
      hint: 'Ouro rende pó de cal e fé, nessa ordem.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou ao alquimista para tratar os campos. O homem espalhou cal e disse palavras demoradas.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §5.4. */
export const merchantBoycott: CouncilCard = {
  id: 'merchantBoycott',
  title: 'Boicote dos mercadores',
  text: 'Os mercadores da estrada não esqueceram o homem que o feudo prendeu. Mandaram dizer que as carroças deles passarão por outro caminho, e que o que ficar na praça será vendido mais caro. O Mercado de {feudo} começa a sentir o vazio das bancas.',
  weight: 2,
  requires: {
    seasons: ['autumn', 'winter'],
    buildings: {
      market: 1,
    },
    flags: ['merchant.hostile'],
  },
  autoResolve: {
    peasant: 'resist',
    lord: 'resist',
    ironKing: 'resist',
  },
  options: [
    {
      id: 'yield',
      label: 'Ceder às exigências',
      cost: {
        gold: 100,
      },
      effects: [
        {
          type: 'clearFlag',
          flag: 'merchant.hostile',
        },
      ],
      hint: 'O ouro compra a paz, e a memória dura mais que ele.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou aos mercadores o preço da paz. As carroças voltaram à praça antes do fim da semana.',
    },
    {
      id: 'resist',
      label: 'Resistir ao boicote',
      effects: [
        {
          type: 'marketPrice',
          resources: ['food', 'wood', 'stone', 'iron'],
          factor: {
            num: 6,
            den: 5,
          },
          durationDays: 3,
        },
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'merchant.hostile',
        },
      ],
      hint: 'Os preços sobem uns dias, e o feudo mostra de que lado está.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} recusou-se a ceder ao boicote dos mercadores. As bancas ficaram vazias, e o povo cantou na praça.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou-se a ceder ao boicote dos mercadores. As bancas ficaram vazias, e o povo cantou na praça.',
    },
    {
      id: 'route',
      label: 'Buscar outra rota',
      cost: {
        wood: 60,
      },
      effects: [
        {
          type: 'marketPrice',
          resources: ['food', 'wood', 'stone', 'iron'],
          factor: {
            num: 11,
            den: 10,
          },
          durationDays: 2,
        },
        {
          type: 'clearFlag',
          flag: 'merchant.hostile',
        },
      ],
      hint: 'A estrada nova custa madeira e cura o rancor.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou abrir uma estrada nova para as carroças. Os mercadores a percorreram a contragosto.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §5.5. */
export const royalCaravan: CouncilCard = {
  id: 'royalCaravan',
  title: 'A caravana real',
  text: 'Uma caravana com o estandarte do rei parou à porta do Mercado. Os cavalariços comem como lobos, e o intendente diz que a coroa compra o que o feudo tiver de sobra, e a bom preço, mas só enquanto a caravana estiver na praça. O inverno vem depois, e a despensa depende de quanto o senhor guardar.',
  weight: 2,
  requires: {
    seasons: ['summer', 'autumn'],
    buildings: {
      market: 1,
    },
  },
  autoResolve: {
    peasant: 'winter',
    lord: 'winter',
    ironKing: 'winter',
  },
  options: [
    {
      id: 'sellNow',
      label: 'Vender à caravana agora',
      effects: [
        {
          type: 'marketPrice',
          resources: ['food', 'wood', 'stone'],
          factor: {
            num: 5,
            den: 4,
          },
          durationDays: 1,
        },
      ],
      hint: 'Um dia de preço alto, e só um dia.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} abriu o Mercado à caravana do rei. As bancas esvaziaram antes do pôr do sol.',
    },
    {
      id: 'hospitality',
      label: 'Dar hospitalidade à caravana',
      cost: {
        food: 40,
      },
      effects: [
        {
          type: 'marketPrice',
          resources: ['food', 'wood', 'stone'],
          factor: {
            num: 11,
            den: 10,
          },
          durationDays: 3,
        },
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'A coroa lembra quem a recebeu à mesa: a alta dura mais, só que menor.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deu mesa à caravana do rei. O intendente elogiou o caldo e a sela dos cavalos.',
    },
    {
      id: 'winter',
      label: 'Guardar o excedente para o inverno',
      effects: [],
      hint: 'O celeiro cheio vale mais quando a neve cai e a comida custa 30% a mais.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a caravana do rei seguir viagem e guardou o excedente nos celeiros.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a caravana do rei seguir viagem e guardou o excedente nos celeiros.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §7.3. */
export const passingRecruiter: CouncilCard = {
  id: 'passingRecruiter',
  title: 'Recrutador de passagem',
  text: 'Um recrutador de capa gasta bateu à porta da Taverna e abriu a bolsa de couro sem rodeios. Conhece gente que procura trabalho de espada e que não pediria mal. Cobra a taxa de quem encontra, não de quem contrata, e diz que não volta tão cedo.',
  weight: 2,
  requires: {
    buildings: {
      tavern: 1,
    },
  },
  autoResolve: {
    peasant: 'refuse',
    lord: 'refuse',
    ironKing: 'refuse',
  },
  options: [
    {
      id: 'pay',
      label: 'Pagar a taxa do recrutador',
      cost: {
        gold: 100,
      },
      effects: [
        {
          type: 'tavernExtraOffer',
        },
      ],
      hint: 'O candidato extra sai da rotação seguinte, e a bolsa sai agora.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a taxa do recrutador de passagem. Ele garantiu mais um nome na lista da Taverna e pegou a estrada.',
    },
    {
      id: 'refuse',
      label: 'Dispensar o recrutador',
      effects: [],
      hint: 'A Taverna escolhe quem aparece por conta própria.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} dispensou o recrutador. Ele guardou a bolsa e foi bater a outra porta.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} dispensou o recrutador. Ele guardou a bolsa e foi bater a outra porta.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §7.4. */
export const gamblingDebt: CouncilCard = {
  id: 'gamblingDebt',
  title: 'A dívida de jogo',
  text: 'Um cobrador de dados e baralhos bateu à porta com um papel dobrado na mão: {heroi}, dizem, perdeu na mesa mais do que o soldo de um mês e não tem como pagar. O homem não fala alto, mas não parece disposto a esperar. O conselho quer saber o que o senhor responde.',
  weight: 2,
  requires: {
    buildings: {
      tavern: 1,
    },
    heroPresent: 1,
  },
  autoResolve: {
    peasant: 'leave',
    lord: 'leave',
    ironKing: 'leave',
  },
  options: [
    {
      id: 'cover',
      label: 'Cobrir a dívida',
      cost: {
        gold: 90,
      },
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'Uma dívida paga é lealdade comprada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} cobriu a dívida de jogo de {heroi}. O cobrador contou as moedas duas vezes e se foi sem dizer o nome da taverna.',
    },
    {
      id: 'leave',
      label: 'Deixá-lo resolver sozinho',
      effects: [
        {
          type: 'rollEffect',
          chance: {
            num: 1,
            den: 2,
          },
          onHit: {
            effects: [
              {
                type: 'injureHero',
                kind: 'light',
              },
              {
                type: 'morale',
                amount: -5,
                durationDays: 3,
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, {heroi} voltou da conversa com o cobrador de olho roxo e costelas doloridas. A Taverna comentou por uma semana.',
          },
          onMiss: {
            effects: [
              {
                type: 'morale',
                amount: 5,
                durationDays: 2,
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, {heroi} acertou as contas com o cobrador sem derramar sangue. Ninguém soube explicar como, e ninguém perguntou.',
          },
        },
      ],
      hint: 'Cada um sabe da própria mesa, e do próprio fim de noite.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou {heroi} se resolver com o cobrador.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou {heroi} se resolver com o cobrador.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §7.5. */
export const squareDuel: CouncilCard = {
  id: 'squareDuel',
  title: 'Duelo na praça',
  text: '{heroi} e {heroi2} trocaram palavras duras na Taverna, e a coisa foi parar na praça, onde se juntou a aldeia inteira com os braços cruzados. Ambos querem resolver com o aço. O capitão da guarda olha para o senhor, esperando uma palavra.',
  weight: 2,
  requires: {
    seasons: ['spring', 'summer', 'autumn'],
    heroPresent: 2,
  },
  autoResolve: {
    peasant: 'forbid',
    lord: 'forbid',
    ironKing: 'forbid',
  },
  options: [
    {
      id: 'allow',
      label: 'Permitir o duelo',
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 2,
        },
        {
          type: 'rollEffect',
          chance: {
            num: 1,
            den: 3,
          },
          onHit: {
            effects: [
              {
                type: 'injureHero',
                kind: 'light',
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, {heroiFerido} saiu do duelo na praça com um corte no braço, e a aldeia cantou o nome do outro.',
          },
          onMiss: {
            effects: [],
            chronicle:
              'No {dia}º dia {daEstacao}, o duelo entre {heroi} e {heroi2} acabou em abraço e vinho. Ninguém saiu ferido.',
          },
        },
      ],
      hint: 'O povo gosta de ver o aço, e o aço nem sempre sai limpo.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} permitiu o duelo entre {heroi} e {heroi2}. A praça lotou antes do meio-dia.',
    },
    {
      id: 'train',
      label: 'Marcar um duelo de treino',
      cost: {
        gold: 30,
      },
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'Madeira no lugar de aço: a honra fica salva, e as costelas também.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou {heroi} e {heroi2} duelarem com lanças de madeira. Ganhou quem apanhou menos, e a praça aplaudiu os dois.',
    },
    {
      id: 'forbid',
      label: 'Proibir o duelo',
      effects: [
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'A ordem do senhor vale mais que a honra dos dois, mesmo que ninguém goste.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} proibiu o duelo na praça. A aldeia resmungou e foi para casa.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} proibiu o duelo na praça. A aldeia resmungou e foi para casa.',
    },
  ],
};

/** Ficha aprovada: docs/content-v0.4.md, §8.1. */
export const wanderingHealer: CouncilCard = {
  id: 'wanderingHealer',
  title: 'O curandeiro errante',
  text: 'Um homem magro, de bolsa cheia de ervas e dedos manchados de verde, parou diante dos portões e perguntou, sem cumprimentar, quem era o ferido da casa. Já ouviu falar de {heroi}. Diz que cura numa noite o que o tempo cura em muitas, e cobra pela noite.',
  weight: 2,
  requires: {
    injuredHero: true,
  },
  autoResolve: {
    peasant: 'wait',
    lord: 'wait',
    ironKing: 'wait',
  },
  options: [
    {
      id: 'pay',
      label: 'Pagar pela cura',
      cost: {
        gold: 60,
      },
      effects: [
        {
          type: 'healHero',
          mode: 'full',
        },
      ],
      hint: 'A bolsa esvazia hoje, e a espada volta ao trabalho amanhã.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou o curandeiro errante. {heroi} acordou sem febre e sem dor, e o homem das ervas sumiu na estrada.',
    },
    {
      id: 'herbs',
      label: 'Comprar só as ervas',
      cost: {
        food: 30,
      },
      effects: [
        {
          type: 'healHero',
          mode: 'half',
        },
      ],
      hint: 'Mais lento, mais barato, e a cozinha cheira a mato.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou as ervas do curandeiro errante. O caldo fedia, e {heroi} jurou que melhorou por teimosia.',
    },
    {
      id: 'wait',
      label: 'Deixar o tempo curar',
      effects: [],
      hint: 'O ferimento sara sozinho, no passo dele.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} dispensou o curandeiro errante. {heroi} continuou de cama, e o homem das ervas foi cobrar noutra porta.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} dispensou o curandeiro errante. {heroi} continuou de cama, e o homem das ervas foi cobrar noutra porta.',
    },
  ],
};
