import type { CouncilCard } from '../council';

// Fichas aprovadas pelo autor: docs/content-v0.4.md, §§9–11.
export const passingMercenaries: CouncilCard = {
  id: 'passingMercenaries',
  title: 'Mercenários de passagem',
  text: 'Cinco homens de capa verde-escura e espadas de uso longo pararam diante dos portões, e o mais velho tirou o chapéu sem se curvar. Dizem que vêm de uma guerra que acabou na semana passada e que ainda não gastaram a paga. Aceitam servir, por ouro e por armas, a quem lhes der casa e comida. Não prometem ficar para sempre.',
  weight: 2,
  requires: {
    seasons: ['spring', 'summer', 'autumn'],
    buildings: {
      barracks: 1,
    },
    armyRoom: 5,
  },
  autoResolve: {
    peasant: 'refuse',
    lord: 'refuse',
    ironKing: 'refuse',
  },
  options: [
    {
      id: 'hire',
      label: 'Contratar os cinco',
      cost: {
        gold: 120,
      },
      weaponsCost: 5,
      requires: {
        armyRoom: 5,
      },
      effects: [
        {
          type: 'addSoldiers',
          unit: 'swordsman',
          amount: 5,
          fromPopulation: false,
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'Cinco espadas prontas hoje, sem esperar o treino.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} contratou cinco mercenários de passagem. Eles entraram em fila no Quartel, de capa verde e queixo erguido.',
    },
    {
      id: 'train',
      label: 'Pedir que treinem a tropa',
      cost: {
        food: 40,
      },
      requires: {
        training: true,
      },
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
        {
          type: 'trainBoost',
          factor: {
            num: 1,
            den: 2,
          },
        },
      ],
      hint: 'Eles não ficam, mas deixam os rapazes mais depressa de pé.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pediu aos mercenários que treinassem a tropa. Eles ensinaram numa tarde o que o Quartel levaria uma semana, e seguiram viagem.',
    },
    {
      id: 'refuse',
      label: 'Recusar',
      effects: [],
      hint: 'O Quartel treina os dele, no passo dele.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} recusou os mercenários. Eles puseram os chapéus e tomaram a estrada do norte.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} recusou os mercenários. Eles puseram os chapéus e tomaram a estrada do norte.',
    },
  ],
};

export const smuggledIron: CouncilCard = {
  id: 'smuggledIron',
  title: 'Ferro de contrabando',
  text: 'Um carroceiro de olhos baixos esperou a feira acabar e chamou o senhor a um canto da praça. Tem sacos de ferro bom, diz, e preço que não cabe no balcão do Mercado, por razões que prefere não contar. O ferro é pesado e tem cheiro de terra úmida. Pode ser tudo o que ele diz, ou só pedra pintada.',
  weight: 2,
  requires: {
    buildings: {
      market: 1,
    },
  },
  autoResolve: {
    peasant: 'refuse',
    lord: 'refuse',
    ironKing: 'refuse',
  },
  options: [
    {
      id: 'buy',
      label: 'Comprar tudo, sem provar',
      cost: {
        gold: 260,
      },
      effects: [
        {
          type: 'rollEffect',
          chance: {
            num: 2,
            den: 3,
          },
          onHit: {
            effects: [
              {
                type: 'resources',
                amounts: {
                  iron: 60,
                },
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, os sacos do carroceiro foram abertos, e o ferro era bom. O ferreiro assobiou baixo.',
          },
          onMiss: {
            effects: [
              {
                type: 'morale',
                amount: -5,
                durationDays: 2,
              },
            ],
            chronicle:
              'No {dia}º dia {daEstacao}, os sacos do carroceiro foram abertos, e havia só pedra pintada de preto. O carroceiro já estava a três feudos dali.',
          },
        },
      ],
      hint: 'Dois sacos em cada três valem, e o terceiro não vale nada.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou ferro de um carroceiro sem provar o metal. Os sacos foram para o depósito sem ninguém abrir um.',
    },
    {
      id: 'half',
      label: 'Comprar metade, provando o metal',
      cost: {
        gold: 130,
      },
      requires: {
        building: 'smithy',
      },
      effects: [
        {
          type: 'resources',
          amounts: {
            iron: 30,
          },
        },
      ],
      hint: 'Um ferreiro por perto vale um balcão inteiro.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} comprou metade do ferro do carroceiro, depois de o ferreiro prová-lo na lima. O negócio fechou-se sem sorriso.',
    },
    {
      id: 'refuse',
      label: 'Mandar o carroceiro embora',
      effects: [],
      hint: 'Ouro no cofre e ferro no ferreiro: o feudo dorme.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou o carroceiro embora. Ele resmungou do preço, de ninguém e do tempo.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} mandou o carroceiro embora. Ele resmungou do preço, de ninguém e do tempo.',
    },
  ],
};

export const northernCrows: CouncilCard = {
  id: 'northernCrows',
  title: 'Os corvos do norte',
  text: 'Os corvos chegaram do norte numa nuvem e pousaram nas muralhas, nos telhados, até nas cruzes do cemitério. Não grasnavam. O guarda da torre diz que nunca viu bicho calado daquele jeito. Os mais velhos contam que, quando os corvos descem assim, a Horda vem atrás, e o povo, que ainda não ouviu a notícia direito, já olha para o alto.',
  weight: 0,
  scripted: {
    atSeasonStart: 'autumn',
    year: 1,
  },
  autoResolve: {
    peasant: 'ignore',
    lord: 'ignore',
    ironKing: 'ignore',
  },
  options: [
    {
      id: 'raise',
      label: 'Erguer a Torre de Vigia ao Nv3',
      effects: [
        {
          type: 'startBuilding',
          building: 'watchtower',
          level: 3,
          discount: {
            num: 1,
            den: 4,
          },
        },
      ],
      hint: 'Uma torre mais alta enxerga mais longe, e custa menos hoje do que custaria depois.',
      chronicle:
        'No {dia}º dia {daEstacao}, os corvos do norte pousaram sobre {feudo}, e o senhor mandou erguer mais um andar na torre. Os pedreiros subiram ao amanhecer, e os corvos desceram um a um.',
    },
    {
      id: 'ask',
      label: 'Consultar o eremita',
      cost: {
        gold: 60,
      },
      effects: [
        {
          type: 'omen',
          clarity: 1,
        },
      ],
      hint: 'Pouco se sabe, mas é mais do que antes.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou chamar o eremita por causa dos corvos. Ele olhou o céu um bom tempo e disse que vinham muitas feras.',
    },
    {
      id: 'ignore',
      label: 'Não dar importância',
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'O que o povo não sabe, não o assusta.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} não deu importância aos corvos. O povo agradeceu o sossego e fechou as janelas mais cedo.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} não deu importância aos corvos. O povo agradeceu o sossego e fechou as janelas mais cedo.',
    },
  ],
};

export const hordeDeserter: CouncilCard = {
  id: 'hordeDeserter',
  title: 'O desertor',
  text: 'O homem chegou ao portão com um trapo amarrado no braço e uma marca de ferro quente no pescoço. Diz que marchava com a Horda até anteontem, que a comida lá é pior do que a nossa e que o Senhor da Guerra manda açoitar quem fala de casa. Fala depressa e olha para trás. O inverno bate à porta, e ele sabe o que vem com ele.',
  weight: 0,
  scripted: {
    atSeasonEnd: 'autumn',
    year: 1,
  },
  requires: {
    tile: 'hordeFortress',
  },
  autoResolve: {
    peasant: 'expel',
    lord: 'expel',
    ironKing: 'expel',
  },
  options: [
    {
      id: 'buy',
      label: 'Pagar pela composição de uma onda',
      cost: {
        gold: 60,
      },
      effects: [
        {
          type: 'omen',
          wave: 2,
          clarity: 5,
        },
      ],
      hint: 'Sessenta de ouro por saber exatamente o que vem na segunda noite.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou ao desertor da Horda pela segunda onda do cerco. Ele contou tudo de olho no ouro e não olhou para trás ao sair.',
    },
    {
      id: 'question',
      label: 'Interrogá-lo de graça',
      effects: [
        {
          type: 'omen',
          wave: 1,
          clarity: 3,
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'Ele fala por medo, e o que diz é só metade.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} interrogou o desertor da Horda. A sala ficou fechada até tarde, e a aldeia dormiu mal.',
    },
    {
      id: 'expel',
      label: 'Expulsá-lo',
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'Um problema a menos, e uma pergunta sem resposta.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} expulsou o desertor da Horda. Ele tomou a estrada do sul sem uma palavra.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} expulsou o desertor da Horda. Ele tomou a estrada do sul sem uma palavra.',
    },
  ],
};

export const hordeSpy: CouncilCard = {
  id: 'hordeSpy',
  title: 'O espião da Horda',
  text: 'Os vigias prenderam um homem que dormia dentro de um celeiro, sem fogueira e sem arma, com uma pena de corvo atrás da orelha e um papel dobrado dentro da bota. Nega tudo, e depois pede água. A aldeia, que já viu muita coisa estranha este ano, quer enforcá-lo antes do jantar, e o capitão dos vigias quer ouvi-lo primeiro.',
  weight: 2,
  requires: {
    seasons: ['autumn'],
    tile: 'hordeFortress',
    buildings: {
      watchtower: 1,
    },
  },
  autoResolve: {
    peasant: 'release',
    lord: 'release',
    ironKing: 'release',
  },
  options: [
    {
      id: 'interrogate',
      label: 'Interrogá-lo',
      cost: {
        food: 30,
      },
      effects: [
        {
          type: 'omen',
          clarity: 3,
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'Ele fala se tem fome, e o que diz vale a ração.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} interrogou o espião da Horda. O papel dobrado na bota era um mapa, e o mapa tinha as portas do feudo marcadas com um corvo.',
    },
    {
      id: 'hang',
      label: 'Enforcá-lo',
      effects: [
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'A aldeia dorme melhor, e o feudo sabe menos.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou enforcar o espião da Horda. A aldeia assistiu em silêncio e voltou ao trabalho com a cabeça mais leve.',
    },
    {
      id: 'release',
      label: 'Soltá-lo na estrada',
      effects: [],
      hint: 'Ele leva de volta o que viu, e nada mais.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} soltou o espião da Horda na estrada. Ele agradeceu duas vezes e não olhou para trás.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} soltou o espião da Horda na estrada. Ele agradeceu duas vezes e não olhou para trás.',
    },
  ],
};

export const raidersAskPassage: CouncilCard = {
  id: 'raidersAskPassage',
  title: 'Saqueadores pedem passagem',
  text: 'Um cavaleiro de elmo sem plumas veio a pé até a ponte, deixou a espada no chão e levantou as duas mãos. Fala em nome do acampamento do outro lado da colina. Diz que os homens dele passam fome e que preferem comer a lutar, e que por uma carga de pão a estrada fica livre por um tempo. Pergunta, no fim, se o senhor aguenta a sua fome melhor do que eles aguentam a deles.',
  weight: 2,
  requires: {
    seasons: ['spring', 'summer', 'autumn'],
    tile: 'raiderCamp',
    buildings: {
      watchtower: 1,
    },
  },
  autoResolve: {
    peasant: 'wait',
    lord: 'wait',
    ironKing: 'wait',
  },
  options: [
    {
      id: 'pay',
      label: 'Pagar a passagem',
      cost: {
        food: 40,
      },
      effects: [
        {
          type: 'threat',
          delta: -10,
        },
      ],
      hint: 'Um saco de pão compra um pouco de sossego, e o sossego não dura.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pagou a passagem aos saqueadores. A carroça de pão atravessou a ponte e voltou vazia.',
    },
    {
      id: 'risk',
      label: 'Mandá-los embora',
      effects: [
        {
          type: 'scheduleRaid',
          kind: 'weak',
          afterMs: 21600000,
        },
        {
          type: 'morale',
          amount: 5,
          durationDays: 2,
        },
      ],
      hint: 'Mais uma briga pequena, e a tropa treina com ela.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou os saqueadores embora. O cavaleiro pegou a espada do chão e disse que voltariam, e que não viriam de mãos abertas.',
    },
    {
      id: 'wait',
      label: 'Deixá-lo esperar na ponte',
      effects: [],
      hint: 'O cavaleiro espera, e o feudo pensa.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou o cavaleiro dos saqueadores esperar na ponte. Ao fim da tarde, ele já tinha ido embora.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou o cavaleiro dos saqueadores esperar na ponte. Ao fim da tarde, ele já tinha ido embora.',
    },
  ],
};

export const crackedWall: CouncilCard = {
  id: 'crackedWall',
  title: 'A muralha rachada',
  text: 'O pedreiro subiu na muralha com um prumo e um balde, desceu sem dizer nada e esperou o senhor chegar. Mostrou, no meio da ala, uma fenda do tamanho de um braço, escura por dentro, onde a pedra velha já tinha cedido ao martelo do último ataque. Diz que dá para remendar hoje por pouco, ou esperar, e deixar a pedra decidir sozinha quando cai.',
  weight: 2,
  requires: {
    buildings: {
      palisade: 3,
    },
    wallDamaged: true,
  },
  autoResolve: {
    peasant: 'wait',
    lord: 'wait',
    ironKing: 'wait',
  },
  options: [
    {
      id: 'repair',
      label: 'Reparar agora',
      effects: [
        {
          type: 'repairWall',
          discount: {
            num: 1,
            den: 5,
          },
        },
      ],
      hint: 'O reparo de sempre, mais barato, se for hoje.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou reparar a muralha rachada. Os pedreiros trabalharam até o fim do dia, e o balde subiu e desceu cheio de argamassa.',
    },
    {
      id: 'patch',
      label: 'Remendar o que dá',
      cost: {
        stone: 60,
      },
      effects: [
        {
          type: 'healWall',
          fraction: {
            num: 1,
            den: 4,
          },
        },
      ],
      hint: 'Um remendo de ponte: aguenta a primeira chuva.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou remendar a fenda da muralha. O pedreiro bateu na pedra três vezes e disse que, por enquanto, estava firme.',
    },
    {
      id: 'wait',
      label: 'Esperar',
      effects: [],
      hint: 'A pedra aguenta até aguentar.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou a muralha rachada como estava. O pedreiro desceu da escada e olhou a fenda mais uma vez, sem esperança.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou a muralha rachada como estava. O pedreiro desceu da escada e olhou a fenda mais uma vez, sem esperança.',
    },
  ],
};

export const warCouncil: CouncilCard = {
  id: 'warCouncil',
  title: 'Conselho de Guerra',
  text: 'Os comandantes de ala pediram a mesa grande do Salão e espalharam sobre ela pedras, pinhas e pedaços de pão: cada coisa, um esquadrão. Brigam baixo sobre quem fica à frente e quem fica no flanco. O que fala menos, de braços cruzados, pede só um momento para escutar o que vem, antes de qualquer um mexer numa pinha. Falta saber a quem o senhor dá ouvidos.',
  weight: 2,
  requires: {
    seasons: ['spring', 'summer', 'autumn'],
    activeRaid: true,
  },
  autoResolve: {
    peasant: 'leave',
    lord: 'leave',
    ironKing: 'leave',
  },
  options: [
    {
      id: 'listen',
      label: 'Ouvir o comandante prudente',
      requires: {
        commanderTrait: 'prudent',
      },
      effects: [
        {
          type: 'revealRaid',
        },
      ],
      hint: 'Quem pensa antes de agir conhece o inimigo antes de ele chegar.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} ouviu o comandante prudente no Conselho de Guerra. Ele moveu duas pinhas e disse, baixinho, o que vinha do norte.',
    },
    {
      id: 'hear',
      label: 'Ouvir a todos',
      cost: {
        gold: 50,
      },
      effects: [
        {
          type: 'revealRaid',
        },
      ],
      hint: 'A mesa fica cheia, a prévia também, e o cofre, mais leve.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} ouviu todos os comandantes no Conselho de Guerra. A ceia durou até tarde, e a pinha do meio mudou de lugar três vezes.',
    },
    {
      id: 'leave',
      label: 'Deixar que decidam sozinhos',
      effects: [],
      hint: 'Os comandantes sabem o que fazem, e o senhor confia.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou os comandantes decidirem sozinhos. A mesa grande ficou posta para ninguém.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou os comandantes decidirem sozinhos. A mesa grande ficou posta para ninguém.',
    },
  ],
};

export const afterTheStorm: CouncilCard = {
  id: 'afterTheStorm',
  title: 'Depois da tempestade',
  text: 'O vento parou na manhã seguinte, e com ele o cheiro de fumaça. A aldeia saiu à rua devagar, como depois de um enterro. Os que ficaram contam os que não voltaram, e os que não voltaram vão ser contados de novo no verão. Falta decidir como o feudo vai chorar, ou se vai chorar de uma vez e cuidar do que sobrou.',
  weight: 2,
  requires: {
    phase: 'aftermath',
  },
  autoResolve: {
    peasant: 'leave',
    lord: 'leave',
    ironKing: 'leave',
  },
  options: [
    {
      id: 'mourn',
      label: 'Erguer um marco aos mortos',
      requires: {
        siegeCasualties: true,
      },
      cost: {
        stone: 80,
      },
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 3,
        },
      ],
      hint: 'Uma pedra com os nomes, e a aldeia olha o futuro de cabeça erguida.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} mandou erguer um marco aos mortos do cerco. Os nomes foram riscados a ponta de faca, e a aldeia leu todos em voz alta.',
    },
    {
      id: 'feast',
      label: 'Festejar o cerco vencido',
      requires: {
        siegeWon: true,
      },
      cost: {
        food: 100,
        gold: 50,
      },
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 2,
        },
      ],
      hint: 'Quem sobrevive tem o direito de comer à mesa cheia.',
      chronicle:
        'No {dia}º dia {daEstacao}, {feudo} festejou o cerco vencido. A mesa foi posta na praça, e até os cães comeram à vontade.',
    },
    {
      id: 'rebuild',
      label: 'Pôr todos nas pedras',
      effects: [
        {
          type: 'repairDiscount',
          points: 10,
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 2,
        },
      ],
      hint: 'O luto fica para o verão, e o reparo, para hoje.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} pôs a aldeia inteira nos reparos. O luto ficou para o verão, e as pedras foram assentadas antes do meio-dia.',
    },
    {
      id: 'leave',
      label: 'Deixar cada um com o seu luto',
      effects: [],
      hint: 'A aldeia sabe o que fazer, e o senhor não se mete.',
      chronicle:
        'No {dia}º dia {daEstacao}, o senhor de {feudo} deixou cada um com o seu luto. A aldeia andou em silêncio por três dias.',
      expiredChronicle:
        'No {dia}º dia {daEstacao}, sem palavra do senhor, o conselho de {feudo} deixou cada um com o seu luto. A aldeia andou em silêncio por três dias.',
    },
  ],
};

export const siegeEve: CouncilCard = {
  id: 'siegeEve',
  title: 'A véspera',
  text: 'A noite antes do cerco não parece uma noite. Há luz em todas as janelas, o ferreiro bate numa lâmina que já estava pronta e as crianças foram mandadas cedo para a cama sem que nenhuma dormisse. Alguém deixou uma fogueira acesa no meio da praça e ninguém foi apagá-la. A aldeia espera que o senhor diga o que fazer com a espera.',
  weight: 0,
  scripted: {
    beforeSiege: true,
  },
  recurring: true,
  requires: {
    seasons: ['winter'],
  },
  autoResolve: {
    peasant: 'rest',
    lord: 'rest',
    ironKing: 'rest',
  },
  options: [
    {
      id: 'feast',
      label: 'Fazer uma festa',
      cost: {
        food: 60,
        gold: 30,
      },
      effects: [
        {
          type: 'morale',
          amount: 10,
          durationDays: 2,
        },
      ],
      hint: 'Se for a última noite, que seja boa. Se não for, também.',
      chronicle:
        'Na véspera do cerco, o senhor de {feudo} mandou pôr a mesa na praça. Bebeu-se à saúde de todos, vivos e mortos futuros, e a fogueira ficou acesa até o fim.',
    },
    {
      id: 'vigil',
      label: 'Passar a noite em vigília',
      effects: [
        {
          type: 'militiaReady',
        },
        {
          type: 'morale',
          amount: -5,
          durationDays: 1,
        },
      ],
      hint: 'Todos de pé, e o trabalho não para até o primeiro corno.',
      chronicle:
        'Na véspera do cerco, o senhor de {feudo} mandou fazer vigília. Os aldeões armados se alinharam nas muralhas e o ferro das lanças brilhou de noite.',
    },
    {
      id: 'rest',
      label: 'Mandar o povo descansar',
      effects: [],
      hint: 'O sono vale mais do que a preparação, na noite certa.',
      chronicle:
        'Na véspera do cerco, o senhor de {feudo} mandou o povo descansar. A aldeia dormiu mal, mas dormiu.',
      expiredChronicle:
        'Na véspera do cerco, sem palavra do senhor, o conselho de {feudo} mandou o povo descansar. A aldeia dormiu mal, mas dormiu.',
    },
  ],
};
