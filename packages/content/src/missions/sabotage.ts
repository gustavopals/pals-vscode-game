import type { ExpeditionModelDef, ExpeditionReturnNode } from '../expeditions';

/**
 * "Sabotagem da Fortaleza" (GDD §9.5; ADR 0020, decisão 17; V4F-T1): expedição especial do outono,
 * só com a Fortaleza da Horda de pé. Exige exatamente três heróis e dura 6 horas de jogo (360 min).
 * Cabem até 3 tentativas por ano.
 *
 * Cada nó com sucesso enfraquece uma onda da Horda em 15% (até -45% no ano). O chefe no último nó
 * é um Xamã que, vencido, revela a composição exata da 3ª onda da Horda. O Desastre captura um herói
 * e alerta a Horda (+10% na 1ª onda). A cada tentativa a dificuldade dos nós sobe.
 *
 * A ficha de cada grafo está em docs/content-v0.4.md, seção 13. Rascunho que o autor não leu.
 */

const MINUTE_MS = 60_000;

const home0: ExpeditionReturnNode = {
  kind: 'return',
  title: 'O retorno pela fronteira',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} retornou da Fortaleza da Horda cruzando a fronteira em segurança.',
};

const home1: ExpeditionReturnNode = {
  kind: 'return',
  title: 'O retorno pelos rochedos',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} desceu os rochedos e retornou da Fortaleza da Horda a salvo.',
};

const home2: ExpeditionReturnNode = {
  kind: 'return',
  title: 'O retorno pelas sombras',
  durationMs: 60 * MINUTE_MS,
  text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} escapou pelas sombras da mata e retornou da Fortaleza da Horda.',
};

export const sabotage: ExpeditionModelDef = {
  id: 'sabotage',
  label: 'Sabotagem da Fortaleza',
  riskLabel: 'Alto',
  durationMs: 360 * MINUTE_MS,
  requires: {
    guildLevel: 1,
    teamMin: 3,
    teamMax: 3,
    minHeroLevel: 1,
    classes: [],
    season: 'autumn',
    tile: 'hordeFortress',
    teamSize: 3,
  },
  access: { kind: 'tile', tileId: 'hordeFortress' },
  variants: [
    {
      start: 'trenches',
      nodes: {
        trenches: {
          kind: 'hazard',
          title: 'As trincheiras da vanguarda',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 40,
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'warrior',
            lesson: 'Um Guerreiro teria rompido as barricadas na frente da equipe.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} rompeu as estacas da vanguarda em silêncio absoluto, e a expedição de {feudo} sabotou as paliçadas da primeira onda sem acordar os vigias.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} abriu caminho pelas trincheiras com firmeza, e a expedição de {feudo} danificou os parapeitos da primeira onda.',
              setback:
                'No {dia}º dia {daEstacao}, uma armadilha disparou perto de {heroi}: a expedição de {feudo} sabotou parte das trincheiras da primeira onda, mas teve de se esconder na lama.',
              disaster:
                'No {dia}º dia {daEstacao}, sentinelas cercaram a posição de {heroi}: o alarme ecoou pela paliçada da Fortaleza e a equipe quase não conseguiu escapar.',
            },
          },
          rewards: { weakensWave: 1 },
          next: 'beastPens',
        },
        beastPens: {
          kind: 'hazard',
          title: 'Os cercados das feras',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 124,
            xp: 45,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'cleric',
            lesson: 'Um Clérigo teria acalmado o frenesi das feras com uma oração.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} destrancou as jaulas das feras da retaguarda com calma sobrenatural, dispersando os animais da segunda onda pelas matas.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} espantou os tratadores da Horda, e a expedição de {feudo} afrouxou os portões dos cercados da segunda onda.',
              setback:
                'No {dia}º dia {daEstacao}, o uivo de uma besta atingiu {heroi}: as jaulas da segunda onda foram danificadas, mas a matilha mordeu a retaguarda dos heróis.',
              disaster:
                'No {dia}º dia {daEstacao}, as feras avançaram contra {heroi}: os tratadores ergueram archotes, soando o alarme da Fortaleza.',
            },
          },
          rewards: { weakensWave: 2 },
          next: 'campCrossroads',
        },
        campCrossroads: {
          kind: 'crossroads',
          title: 'O pátio interno da Fortaleza',
          text: 'Entre os barracões de toras e os fossos profundos, a expedição alcança o pátio central. Ao longe erguem-se as oficinas de cerco; acima, o torreão fortificado da guarda.',
          options: [
            {
              id: 'burnSiegeWorks',
              label: 'Queimar as oficinas de assédio',
              hint: 'As madeiras empilhadas ardem com facilidade, atrasando as máquinas do cerco.',
              next: 'siegeTowers',
            },
            {
              id: 'infiltrateKeep',
              label: 'Invadir o torreão da guarda',
              hint: 'O torreão abriga combatentes ferozes e baús de moedas; exige força bruta para romper o portão.',
              requires: { heroClass: 'warrior' },
              next: 'warriorBastion',
            },
            {
              id: 'retreatToWoods',
              label: 'Recuar em silêncio pelos bosques',
              hint: 'A equipe volta com as sabotagens já feitas, sem arriscar a vida dos heróis.',
              next: 'home',
            },
          ],
          posture: {
            cautious: 'retreatToWoods',
            balanced: 'burnSiegeWorks',
            bold: 'infiltrateKeep',
          },
        },
        siegeTowers: {
          kind: 'hazard',
          title: 'As oficinas de cerco',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 124,
            xp: 55,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'archer',
            lesson: 'Um Arqueiro teria atingido os suportes da torre à distância.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} lançou estopas acesas nas vigas mestras, e o fogo devorou os preparativos da terceira onda da Horda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} destruiu as cavilhas das manganelas, enfraquecendo as obras da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, fumaça espessa envolveu {heroi}: parte das oficinas ruiu, mas as sentinelas quase encurralaram a equipe.',
              disaster:
                'No {dia}º dia {daEstacao}, arqueiros da Horda flagraram {heroi}: flechas flamejantes riscaram o pátio e o alarme soou.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 20, max: 40 } } },
          next: 'shamanAltar',
        },
        warriorBastion: {
          kind: 'encounter',
          title: 'O bastião dos guardas negros',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 158,
            xp: 65,
            weights: { defense: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'warrior',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} abateu os campeões da guarda na soleira do torreão, quebrando a coluna da terceira onda e tomando o espólio da câmara.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} empurrou os guardas contra as muralhas, desmantelando o posto de comando da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, os guardas cercaram {heroi} em um corredor estreito: a equipe feriu os oficiais da terceira onda, mas pagou caro.',
              disaster:
                'No {dia}º dia {daEstacao}, reforços da Fortaleza acorreram contra {heroi}: a guarda soou trompas e trancou as saídas.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 50, max: 90 } } },
          next: 'shamanAltar',
        },
        shamanAltar: {
          kind: 'boss',
          title: 'O altar do xamã de sangue',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 112,
            xp: 80,
            weights: { will: { num: 1, den: 2 }, defense: { num: 1, den: 4 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'mage',
            lesson: 'Um Mago teria quebrado os feitiços do xamã antes do ritual.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} derrotou o xamã de sangue sobre o próprio altar, arrancando os pergaminhos que detalham a terceira onda da Horda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} rompeu o círculo ritual do xamã, colhendo mapas e planos com a disposição da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, uma rajada mágica atingiu {heroi}: o xamã foi escorraçado e deixou pistas da terceira onda, mas a equipe saiu cambaleante.',
              disaster:
                'No {dia}º dia {daEstacao}, as maldições do xamã envolveram {heroi}: o alarme acordou a Fortaleza inteira e intrusos foram perseguidos.',
            },
          },
          rewards: { revealsWave: 3, resources: { gold: { min: 40, max: 70 } } },
          next: 'escape',
        },
        escape: {
          kind: 'travel',
          title: 'A saída da Fortaleza',
          durationMs: 60 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} atravessou os fossos da Fortaleza e alcançou a trilha da fronteira.',
          next: 'home',
        },
        home: home0,
      },
    },
    {
      start: 'ravineTrail',
      nodes: {
        ravineTrail: {
          kind: 'hazard',
          title: 'O desfiladeiro das sentinelas',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 40,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'archer',
            lesson: 'Um Arqueiro teria avistado as sentinelas antes da emboscada.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} eliminou os batedores nos rochedos com precisão gélida, desorganizando a vanguarda da primeira onda sem ruído.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} conduziu a equipe pelas frestas do desfiladeiro, sabotando os postos avançados da primeira onda.',
              setback:
                'No {dia}º dia {daEstacao}, uma pedra rolou sob as botas de {heroi}: os batedores da primeira onda foram contidos, mas a subida custou fôlego.',
              disaster:
                'No {dia}º dia {daEstacao}, as sentinelas do desfiladeiro avistaram {heroi}: cornetas de chifre ressoaram pelas ravinas da Fortaleza.',
            },
          },
          rewards: { weakensWave: 1 },
          next: 'wolfKennels',
        },
        wolfKennels: {
          kind: 'encounter',
          title: 'Os canis de guerra',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 122,
            xp: 45,
            weights: { defense: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'warrior',
            lesson: 'Um Guerreiro teria segurado os cães com o escudo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} esmagou a resistência dos adestradores e arrebentou as correntes da matilha, neutralizando a força da segunda onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} conteve as investidas dos animais na entrada dos canis, desfazendo a matilha da segunda onda.',
              setback:
                'No {dia}º dia {daEstacao}, presas afiadas rasgaram a capa de {heroi}: a segunda onda perdeu suas bestas, mas a luta deixou arranhões fundos.',
              disaster:
                'No {dia}º dia {daEstacao}, a matilha inteira saltou sobre {heroi}: o clamor dos canis alertou a guarnição e pôs os guardas no rastro.',
            },
          },
          rewards: { weakensWave: 2 },
          next: 'innerRavine',
        },
        innerRavine: {
          kind: 'crossroads',
          title: 'A bifurcação das ravinas',
          text: 'Na ravina interna, os fundos da Fortaleza se abrem em duas trilhas escarpadas. Uma leva às cisternas escavadas na rocha; a outra, ao salão ritualístico decorado com crânios.',
          options: [
            {
              id: 'poisonCisterns',
              label: 'Envenenar as cisternas da guarnição',
              hint: 'Lançar beladona nas águas enfraquece as fileiras inimigas sem combate direto.',
              next: 'waterSupply',
            },
            {
              id: 'assaultSanctum',
              label: 'Romper os portões do santuário',
              hint: 'O santuário guarda ritos proibidos e tributos em ouro; penetrar a barreira pede conhecimento arcano.',
              requires: { heroClass: 'mage' },
              next: 'skullTrophyHall',
            },
            {
              id: 'fallBackToPass',
              label: 'Recuar pelo desfiladeiro',
              hint: 'A equipe assegura as vantagens obtidas até aqui e retorna sem se expor.',
              next: 'home',
            },
          ],
          posture: {
            cautious: 'fallBackToPass',
            balanced: 'poisonCisterns',
            bold: 'assaultSanctum',
          },
        },
        waterSupply: {
          kind: 'hazard',
          title: 'As cisternas da guarnição',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 122,
            xp: 55,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'cleric',
            lesson: 'Um Clérigo teria purificado a água contaminada do poço.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} despejou extratos venenosos nas nascentes principais, dizimando as provisões da terceira onda da Horda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} quebrou os canais do aqueduto de pedra, deixando a terceira onda sem suprimento fresco.',
              setback:
                'No {dia}º dia {daEstacao}, guardas patrulhavam o poço quando {heroi} agiu: a água da terceira onda foi estragada, mas houve confronto ruidoso.',
              disaster:
                'No {dia}º dia {daEstacao}, vigias flagraram a tentativa de {heroi}: sinos de alarme tocaram junto ao poço e a Fortaleza despertou.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 20, max: 40 } } },
          next: 'boneCircle',
        },
        skullTrophyHall: {
          kind: 'encounter',
          title: 'O salão das caveiras',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 150,
            xp: 65,
            weights: { will: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'mage',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desintegrou os totens de osso do salão sombrio, aniquilando os ritos da terceira onda e tomando as oferendas.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} destroçou os estandartes rituais, abalando a determinação da terceira onda da Horda.',
              setback:
                'No {dia}º dia {daEstacao}, emanações nefastas sufocaram {heroi}: o salão da terceira onda sofreu avarias, mas a equipe engoliu miasmas perigosos.',
              disaster:
                'No {dia}º dia {daEstacao}, guardiões sobrenaturais despertaram diante de {heroi}: urros romperam a noite e o alarme foi acionado.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 60, max: 100 } } },
          next: 'boneCircle',
        },
        boneCircle: {
          kind: 'boss',
          title: 'O círculo de ossos do xamã',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 80,
            weights: { will: { num: 1, den: 2 }, defense: { num: 1, den: 4 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'mage',
            lesson: 'Um Mago teria dissipado a névoa escura do círculo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} subjugou o xamã no centro do círculo de ossos, decifrando as tabuletas com a marcha da terceira onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} partiu o cajado do xamã em dois, recuperando os pergaminhos de guerra da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, relâmpagos espectrais castigaram {heroi}: o xamã fugiu deixando registros da terceira onda, mas a equipe sofreu.',
              disaster:
                'No {dia}º dia {daEstacao}, a fúria do círculo de ossos engoliu {heroi}: o alarme correu os muros e a Fortaleza se colocou em guarda.',
            },
          },
          rewards: { revealsWave: 3, resources: { gold: { min: 40, max: 70 } } },
          next: 'escape',
        },
        escape: {
          kind: 'travel',
          title: 'A saída da Fortaleza',
          durationMs: 60 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} atravessou os fossos da Fortaleza e alcançou a trilha da fronteira.',
          next: 'home',
        },
        home: home1,
      },
    },
    {
      start: 'fallenParapet',
      nodes: {
        fallenParapet: {
          kind: 'hazard',
          title: 'O parapeito ruído da muralha',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 40,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'archer',
            lesson: 'Um Arqueiro teria encontrado a escada de corda no parapeito.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} fixou ganchos de escalada no trecho quebrado da muralha, permitindo à equipe sabotar as defesas da primeira onda sem ruído.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} guiou a subida pelo parapeito ruído, comprometendo os parapeitos da primeira onda.',
              setback:
                'No {dia}º dia {daEstacao}, blocos de argamassa cederam sob {heroi}: as defesas da primeira onda foram danificadas, mas os heróis sofreram quedas.',
              disaster:
                'No {dia}º dia {daEstacao}, vigias avistaram a corda de {heroi}: tochas foram arremessadas do topo e os tambores da Fortaleza soaram.',
            },
          },
          rewards: { weakensWave: 1 },
          next: 'beastStables',
        },
        beastStables: {
          kind: 'encounter',
          title: 'Os estábulos da matilha',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 136,
            xp: 45,
            weights: { will: { num: 3, den: 2 }, attack: { num: 1, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'cleric',
            lesson: 'Um Clérigo teria dispersado o bando com uma prece vigorosa.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} entoou hinos antigos que assustaram as bestas e dispersaram a cavalaria monstruosa da segunda onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} incendiou o feno dos estábulos, desarticulando as montarias da segunda onda.',
              setback:
                'No {dia}º dia {daEstacao}, cascos pesados atingiram {heroi}: os estábulos da segunda onda foram desfeitos, mas os heróis saíram pisoteados.',
              disaster:
                'No {dia}º dia {daEstacao}, os animais em pânico atropelaram a linha de {heroi}: o estardalhaço nos estábulos acordou a Fortaleza inteira.',
            },
          },
          rewards: { weakensWave: 2 },
          next: 'dungeonPassage',
        },
        dungeonPassage: {
          kind: 'crossroads',
          title: 'A galeria das masmorras',
          text: 'Abaixo da muralha externa corre uma galeria úmida de cantaria bruta. À direita acumulam-se os barris de óleo e breu; à esquerda, o paiol fortificado dos guardas de elite.',
          options: [
            {
              id: 'drainOilVats',
              label: 'Esvaziar os tonéis de óleo',
              hint: 'Derramar o combustível nos ralos impede a defesa ardente dos invasores.',
              next: 'oilDepot',
            },
            {
              id: 'breachChamber',
              label: 'Arrombar a câmara interior',
              hint: 'O paiol interior guarda baús pesados de espólio; só quem não teme a morte arrisca cruzar a porta vigiada.',
              requires: { trait: 'brave' },
              next: 'dreadArmory',
            },
            {
              id: 'withdrawInSecret',
              label: 'Partir em segredo pelas sombras',
              hint: 'Satisfeitos com os estragos infligidos, os heróis tomam o rumo de casa.',
              next: 'home',
            },
          ],
          posture: {
            cautious: 'withdrawInSecret',
            balanced: 'drainOilVats',
            bold: 'breachChamber',
          },
        },
        oilDepot: {
          kind: 'hazard',
          title: 'O depósito de óleo e breu',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 122,
            xp: 55,
            weights: { defense: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'warrior',
            lesson: 'Um Guerreiro teria tombado os tonéis pesados de óleo.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} arrebentou as torneiras dos tonéis e drenou o breu nos canais, estragando o combustível da terceira onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} misturou areia nos barris de óleo, inutilizando os projéteis flamejantes da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, líquido inflamável espirrou sobre {heroi}: o depósito da terceira onda foi arruinado, mas vapores sufocaram a equipe.',
              disaster:
                'No {dia}º dia {daEstacao}, chamas involuntárias denunciaram {heroi}: o depósito crepitou e o alarme ecoou por toda a Fortaleza.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 20, max: 40 } } },
          next: 'totemSanctuary',
        },
        dreadArmory: {
          kind: 'encounter',
          title: 'O paiol fortificado',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 152,
            xp: 65,
            weights: { skill: { num: 3, den: 2 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'archer',
            lesson: 'Um Arqueiro teria desarmado os mecanismos de disparo do arsenal.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} surpreendeu a guarda do paiol com tiros certeiros, saqueando as arcas de tributos e quebrando a força da terceira onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} forçou as trancas do paiol, destruindo os estoques de munição da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, virotes de balestras rasparam {heroi}: o paiol da terceira onda foi saqueado, mas os heróis levaram ferimentos.',
              disaster:
                'No {dia}º dia {daEstacao}, armadilhas no piso dispararam contra {heroi}: sinos de metal tiniram e as patrulhas fecharam a galeria.',
            },
          },
          rewards: { weakensWave: 3, resources: { gold: { min: 70, max: 110 } } },
          next: 'totemSanctuary',
        },
        totemSanctuary: {
          kind: 'boss',
          title: 'O santuário dos totens',
          durationMs: 60 * MINUTE_MS,
          trial: {
            difficulty: 110,
            xp: 80,
            weights: { will: { num: 1, den: 2 }, defense: { num: 1, den: 4 } },
            onDisaster: 'capture',
            alertsHorde: true,
            helps: 'mage',
            lesson: 'Um Mago teria neutralizado os totens antes da maldição.',
            outcomes: {
              full: 'No {dia}º dia {daEstacao}, {heroi} desmantelou o santuário e dominou o xamã da Horda, revelando os segredos e a formação da terceira onda.',
              success:
                'No {dia}º dia {daEstacao}, {heroi} derrubou os totens ancestrais do xamã, colhendo pergaminhos com a marcha da terceira onda.',
              setback:
                'No {dia}º dia {daEstacao}, ondas de choque místicas abalaram {heroi}: o xamã bateu em retirada deixando planos da terceira onda, mas os heróis saíram atordoados.',
              disaster:
                'No {dia}º dia {daEstacao}, as forças arcanas do santuário rebentaram sobre {heroi}: o alarme geral foi dado e a Fortaleza entrou em alerta máximo.',
            },
          },
          rewards: { revealsWave: 3, resources: { gold: { min: 40, max: 70 } } },
          next: 'escape',
        },
        escape: {
          kind: 'travel',
          title: 'A saída da Fortaleza',
          durationMs: 60 * MINUTE_MS,
          text: 'No {dia}º dia {daEstacao}, a expedição de {feudo} atravessou os fossos da Fortaleza e alcançou a trilha da fronteira.',
          next: 'home',
        },
        home: home2,
      },
    },
  ],
};
